import Redis from "ioredis";
import { prisma } from "@/lib/db";

let redis: Redis | null = null;

// ─── Key 前缀定义 ────────────────────────────────────────────
const ONLINE_KEY_PREFIX = "user:lastSeen:";
const ONLINE_TTL_SEC = 90;
const SEQ_KEY_PREFIX = "conv:seq:";             // 会话消息序号计数器
const OFFLINE_QUEUE_PREFIX = "offline:msgs:";    // 离线消息队列
const ACK_KEY_PREFIX = "user:ack:";             // 用户已确认的最大 seqId
const WS_ONLINE_PREFIX = "user:ws:";            // WebSocket 活跃连接标记
const UNREAD_KEY_PREFIX = "user:unread:";       // 用户总未读数（角标用）
const MESSAGE_DLQ_KEY = "msg:dlq";              // 消息死信队列（仅用于排障）

// ─── Redis 健康状态追踪 ──────────────────────────────────────
let redisAvailable = true;
let redisRetryTimer: ReturnType<typeof setTimeout> | null = null;
const REDIS_HEALTH_CHECK_MS = 5000; // Redis 不可用后每 5 秒重试探测

function markRedisDown(): void {
  if (redisAvailable) {
    redisAvailable = false;
    console.error("[redis] ⚠ Marked as unavailable, degrading to DB fallback");
  }
  // 定时探测恢复
  if (!redisRetryTimer) {
    redisRetryTimer = setInterval(async () => {
      try {
        const client = getRedis();
        if (client) {
          await client.ping();
          redisAvailable = true;
          console.log("[redis] ✓ Recovered, switching back to Redis");
          if (redisRetryTimer) {
            clearInterval(redisRetryTimer);
            redisRetryTimer = null;
          }
        }
      } catch {
        // 仍然不可用，继续等待
      }
    }, REDIS_HEALTH_CHECK_MS);
  }
}

// ─── Redis 客户端 ────────────────────────────────────────────

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (redis) return redis;
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          markRedisDown();
          return null; // 停止重连，由健康检查接管
        }
        return Math.min(times * 200, 2000);
      },
    });
    redis.on("error", (err) => {
      console.error("[redis] error:", err.message);
      markRedisDown();
    });
    redis.on("connect", () => {
      redisAvailable = true;
    });
    return redis;
  } catch (err) {
    console.error("[redis] connect failed:", err);
    markRedisDown();
    return null;
  }
}

/** 检查 Redis 是否可用（客户端存在且健康状态正常） */
export function isRedisAvailable(): boolean {
  return redisAvailable && getRedis() !== null;
}

// ─── 安全执行 Redis 命令（统一异常捕获） ─────────────────────

/**
 * 安全地执行 Redis 操作，失败时返回 fallback 值。
 * 自动追踪 Redis 健康状态。
 */
async function safeRedisOp<T>(
  operation: (client: Redis) => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  const client = getRedis();
  if (!client || !redisAvailable) return fallback;
  try {
    return await operation(client);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[redis] ${context ?? "operation"} failed: ${msg}`);
    markRedisDown();
    return fallback;
  }
}

// ─── 在线状态管理 ────────────────────────────────────────────

/** 设置用户在线（心跳续期） */
export async function setUserOnline(userId: string): Promise<void> {
  await safeRedisOp(
    (c) => c.set(`${ONLINE_KEY_PREFIX}${userId}`, Date.now().toString(), "EX", ONLINE_TTL_SEC).then(() => {}),
    undefined,
    "setUserOnline"
  );
}

/** 立即设置用户离线（WebSocket 断开时调用） */
export async function setUserOffline(userId: string): Promise<void> {
  await safeRedisOp(
    async (c) => {
      const pipeline = c.pipeline();
      pipeline.del(`${ONLINE_KEY_PREFIX}${userId}`);
      pipeline.del(`${WS_ONLINE_PREFIX}${userId}`);
      await pipeline.exec();
    },
    undefined,
    "setUserOffline"
  );
}

/** 标记用户有活跃 WebSocket 连接 */
export async function setUserWsConnected(userId: string, socketId: string): Promise<void> {
  await safeRedisOp(
    (c) => c.set(`${WS_ONLINE_PREFIX}${userId}`, socketId, "EX", ONLINE_TTL_SEC).then(() => {}),
    undefined,
    "setUserWsConnected"
  );
}

/** 检查用户是否有活跃 WebSocket 连接 */
export async function isUserWsConnected(userId: string): Promise<boolean> {
  return safeRedisOp(
    async (c) => (await c.get(`${WS_ONLINE_PREFIX}${userId}`)) != null,
    false,
    "isUserWsConnected"
  );
}

export async function isUserOnline(userId: string): Promise<boolean> {
  return safeRedisOp(
    async (c) => (await c.get(`${ONLINE_KEY_PREFIX}${userId}`)) != null,
    false,
    "isUserOnline"
  );
}

export async function getOnlineUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  return safeRedisOp(
    async (c) => {
      const keys = userIds.map((id) => `${ONLINE_KEY_PREFIX}${id}`);
      const vals = await c.mget(...keys);
      const online = new Set<string>();
      userIds.forEach((id, i) => {
        if (vals[i] != null) online.add(id);
      });
      return online;
    },
    new Set<string>(),
    "getOnlineUserIds"
  );
}

// ─── SeqId 生成器（双层容灾） ────────────────────────────────

/**
 * 原子递增并返回下一个 seqId（会话级别）
 *
 * 三层策略：
 *   L1 - Redis INCR（纳秒级，高并发安全）
 *   L2 - PostgreSQL SELECT MAX(seqId)+1 FOR UPDATE（毫秒级，事务安全）
 *   L3 - 高精度时间戳 + 随机偏移（最后兜底，仅紧急使用）
 */
export async function getNextSeqId(conversationId: string): Promise<number> {
  // ── L1: Redis（主路径） ──
  const redisResult = await safeRedisOp(
    (c) => c.incr(`${SEQ_KEY_PREFIX}${conversationId}`),
    null as number | null,
    "getNextSeqId:redis"
  );
  if (redisResult !== null) return redisResult;

  // ── L2: DB 事务降级（行级锁保证原子性） ──
  console.warn(`[redis] getNextSeqId degraded to DB for conversation ${conversationId}`);
  try {
    const result = await prisma.$transaction(async (tx) => {
      // FOR UPDATE 保证并发安全（同一会话的写操作排队）
      const rows = await tx.$queryRaw<{ max_seq: number | null }[]>`
        SELECT MAX("seqId") as max_seq
        FROM "Message"
        WHERE "conversationId" = ${conversationId}
        FOR UPDATE
      `;
      const currentMax = rows[0]?.max_seq ?? 0;
      return currentMax + 1;
    });

    // 尝试将 DB 值回写到 Redis（Redis 恢复后自动同步）
    safeRedisOp(
      async (c) => {
        // 使用 Lua 脚本确保只在 Redis 值更小时才更新
        const script = `
          local current = tonumber(redis.call('GET', KEYS[1]) or '0')
          if tonumber(ARGV[1]) > current then
            redis.call('SET', KEYS[1], ARGV[1])
            return 1
          end
          return 0
        `;
        await c.eval(script, 1, `${SEQ_KEY_PREFIX}${conversationId}`, result.toString());
      },
      undefined,
      "getNextSeqId:syncBackToRedis"
    );

    return result;
  } catch (dbErr) {
    console.error("[redis] getNextSeqId DB fallback also failed:", dbErr);
  }

  // ── L3: 高精度时间戳兜底（极端情况） ──
  // 使用微秒级时间戳 + 随机偏移，碰撞概率极低
  // 注意：这个值会很大，但 Prisma Int 是 32 位，需要控制在安全范围内
  const microTime = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  // 取模到安全范围（~21亿），避免 Int32 溢出
  return microTime % 2_000_000_000;
}

/**
 * 初始化会话的 seqId 计数器（部署后首次同步用）
 * 将 Redis 计数器设置为当前最大 seqId，避免冲突
 */
export async function initConversationSeq(
  conversationId: string,
  currentMax: number
): Promise<void> {
  await safeRedisOp(
    async (c) => {
      const key = `${SEQ_KEY_PREFIX}${conversationId}`;
      // Lua：仅当 key 不存在或当前值更小时设置
      const script = `
        local current = tonumber(redis.call('GET', KEYS[1]) or '0')
        if tonumber(ARGV[1]) > current then
          redis.call('SET', KEYS[1], ARGV[1])
          return 1
        end
        return 0
      `;
      await c.eval(script, 1, key, currentMax.toString());
    },
    undefined,
    "initConversationSeq"
  );
}

// ─── 离线消息队列 ────────────────────────────────────────────

/**
 * 将消息加入用户的离线队列
 * 当消息无法通过 WebSocket 实时投递时调用
 */
export async function addToOfflineQueue(
  userId: string,
  message: Record<string, unknown>
): Promise<void> {
  await safeRedisOp(
    async (c) => {
      const key = `${OFFLINE_QUEUE_PREFIX}${userId}`;
      const pipeline = c.pipeline();
      pipeline.rpush(key, JSON.stringify(message));
      pipeline.expire(key, 7 * 24 * 60 * 60);
      await pipeline.exec();
    },
    undefined,
    "addToOfflineQueue"
  );
}

/**
 * 获取并清空用户的离线消息队列（原子操作）
 * 用户重新连接 WebSocket 时调用
 */
export async function getAndClearOfflineQueue(
  userId: string
): Promise<Record<string, unknown>[]> {
  return safeRedisOp(
    async (c) => {
      const key = `${OFFLINE_QUEUE_PREFIX}${userId}`;
      const pipeline = c.pipeline();
      pipeline.lrange(key, 0, -1);
      pipeline.del(key);
      const results = await pipeline.exec();
      if (!results || !results[0] || results[0][1] === null) return [];
      const rawMessages = results[0][1] as string[];
      return rawMessages
        .map((raw) => {
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return {};
          }
        })
        .filter((m) => Object.keys(m).length > 0);
    },
    [],
    "getAndClearOfflineQueue"
  );
}

// ─── Ack 追踪 ────────────────────────────────────────────────

/**
 * 记录用户在某会话中已确认的最大 seqId
 * 仅当新值大于旧值时更新（保证单调性）
 */
export async function setUserLastAck(
  userId: string,
  chatId: string,
  seqId: number
): Promise<void> {
  await safeRedisOp(
    async (c) => {
      const key = `${ACK_KEY_PREFIX}${userId}:${chatId}`;
      const script = `
        local current = tonumber(redis.call('GET', KEYS[1]) or '0')
        if tonumber(ARGV[1]) > current then
          redis.call('SET', KEYS[1], ARGV[1])
          redis.call('EXPIRE', KEYS[1], 604800)
          return 1
        end
        return 0
      `;
      await c.eval(script, 1, key, seqId.toString());
    },
    undefined,
    "setUserLastAck"
  );
}

/**
 * 获取用户在某会话中已确认的最大 seqId
 * 用于断线重连时确定需要补发的消息范围
 */
export async function getUserLastAck(
  userId: string,
  chatId: string
): Promise<number> {
  return safeRedisOp(
    async (c) => {
      const val = await c.get(`${ACK_KEY_PREFIX}${userId}:${chatId}`);
      return val ? parseInt(val, 10) : 0;
    },
    0,
    "getUserLastAck"
  );
}

/**
 * 批量获取用户在多个会话中的最后 Ack seqId
 */
export async function getUserLastAcks(
  userId: string,
  chatIds: string[]
): Promise<Record<string, number>> {
  if (chatIds.length === 0) return {};
  return safeRedisOp(
    async (c) => {
      const keys = chatIds.map((id) => `${ACK_KEY_PREFIX}${userId}:${id}`);
      const vals = await c.mget(...keys);
      const result: Record<string, number> = {};
      chatIds.forEach((id, i) => {
        result[id] = vals[i] ? parseInt(vals[i]!, 10) : 0;
      });
      return result;
    },
    {} as Record<string, number>,
    "getUserLastAcks"
  );
}

// ─── 消息死信队列（DLQ） ───────────────────────────────────────

/**
 * 将无法持久化的消息写入 DLQ，方便后续排查。
 * 注意：这是用于排障的“黑匣子”，不要作为业务读路径。
 */
export async function addMessageToDLQ(entry: {
  conversationId: string;
  senderId: string;
  seqId: number;
  clientMsgId?: string | null;
  reason: string;
}): Promise<void> {
  const record = {
    ...entry,
    clientMsgId: entry.clientMsgId ?? null,
    ts: new Date().toISOString(),
  };

  await safeRedisOp(
    async (c) => {
      await c.rpush(MESSAGE_DLQ_KEY, JSON.stringify(record));
      // 保留 7 天，防止无限堆积
      await c.expire(MESSAGE_DLQ_KEY, 7 * 24 * 60 * 60);
    },
    undefined,
    "addMessageToDLQ"
  );
}

// ─── 未读数（角标 / 推送 payload） ─────────────────────────────

/**
 * 递增用户总未读数，并返回递增后的值（用于推送中的 unreadCount）
 */
export async function incrUserUnread(userId: string): Promise<number> {
  return safeRedisOp(
    async (c) => {
      const key = `${UNREAD_KEY_PREFIX}${userId}`;
      const next = await c.incr(key);
      await c.expire(key, 30 * 24 * 60 * 60); // 30 天过期
      return next;
    },
    1,
    "incrUserUnread"
  );
}

/**
 * 获取用户当前总未读数
 */
export async function getUserUnread(userId: string): Promise<number> {
  return safeRedisOp(
    async (c) => {
      const val = await c.get(`${UNREAD_KEY_PREFIX}${userId}`);
      return val ? parseInt(val, 10) : 0;
    },
    0,
    "getUserUnread"
  );
}

/**
 * 将用户总未读数设为 0（进入 App 或全部已读时调用）
 */
export async function resetUserUnread(userId: string): Promise<void> {
  await safeRedisOp(
    (c) => c.del(`${UNREAD_KEY_PREFIX}${userId}`).then(() => {}),
    undefined,
    "resetUserUnread"
  );
}

/**
 * 扣减用户总未读数（标记已读时调用，扣减数量为本次标记的消息数）
 */
export async function decrUserUnread(userId: string, by: number): Promise<void> {
  if (by <= 0) return;
  await safeRedisOp(
    async (c) => {
      const key = `${UNREAD_KEY_PREFIX}${userId}`;
      const val = await c.get(key);
      const current = val ? parseInt(val, 10) : 0;
      const next = Math.max(0, current - by);
      if (next === 0) await c.del(key);
      else await c.set(key, next.toString(), "EX", 30 * 24 * 60 * 60);
    },
    undefined,
    "decrUserUnread"
  );
}
