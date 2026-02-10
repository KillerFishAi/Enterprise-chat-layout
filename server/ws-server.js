/**
 * ================================================================
 * 企业 IM WebSocket 服务器 v2 — 可靠消息投递架构
 * ================================================================
 *
 * 核心改进：
 *   1. Ack 机制：客户端确认收到消息，服务端追踪投递状态
 *   2. 断线处理：disconnect 时立即更新在线状态，触发离线队列
 *   3. 自动入会：连接时自动加入用户所有会话的 Room
 *   4. 重传机制：未 Ack 的消息自动重发（最多 3 次）
 *   5. 离线队列：离线用户的消息暂存，上线后批量推送
 *   6. 断线重连同步：客户端提供 lastSeqId，服务端推送遗漏消息
 *
 * 依赖：REDIS_URL, JWT_SECRET, DATABASE_URL
 * 启动：REDIS_URL=redis://localhost:6379 JWT_SECRET=xxx node server/ws-server.js
 * 端口：3001（可通过 SOCKET_PORT 环境变量配置）
 */

const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");

// ─── 配置 ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
const REDIS_URL = process.env.REDIS_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const CHAT_CHANNEL = "chat:messages";
const SERVER_ID = `ws-${PORT}-${process.pid}`; // 唯一服务器标识

// Ack 重传配置
const ACK_TIMEOUT_MS = 5000;      // 等待 Ack 超时时间
const MAX_RETRY_COUNT = 3;        // 最大重传次数
const ONLINE_TTL_SEC = 90;        // 在线状态 TTL

// ─── 前置检查 ──────────────────────────────────────────────────
if (!REDIS_URL) {
  console.error("REDIS_URL is required for WebSocket server");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("JWT_SECRET is required for WebSocket server");
  process.exit(1);
}

// ─── 初始化 ──────────────────────────────────────────────────
const prisma = new PrismaClient();
const redisSub = new Redis(REDIS_URL);     // Chat 消息订阅
const redisPub = new Redis(REDIS_URL);     // Chat 消息发布
const redisStore = new Redis(REDIS_URL);   // 状态存储

// Socket.IO Redis Adapter 专用连接（跨服务器 Room 广播）
const adapterPub = new Redis(REDIS_URL);
const adapterSub = new Redis(REDIS_URL);

// Key 前缀（与 lib/redis.ts 保持一致）
const ONLINE_KEY = (id) => `user:lastSeen:${id}`;
const WS_KEY = (id) => `user:ws:${id}`;
const ACK_KEY = (uid, cid) => `user:ack:${uid}:${cid}`;
const OFFLINE_QUEUE_KEY = (id) => `offline:msgs:${id}`;

// ─── userId -> Set<socketId> 映射（支持多设备） ───────────────
const userSockets = new Map();   // Map<userId, Set<socketId>>
const socketUsers = new Map();   // Map<socketId, userId>

// ─── 未 Ack 消息重传追踪 ────────────────────────────────────
// Map<socketId, Map<msgKey, { timer, retryCount, payload, chatId }>>
const pendingAcks = new Map();

// ─── JWT 认证 ──────────────────────────────────────────────────
function getTokenFromHandshake(handshake) {
  const authToken = handshake.auth?.token;
  if (authToken && typeof authToken === "string") return authToken;
  const cookie = handshake.headers?.cookie;
  if (cookie) {
    const match = cookie.match(/token=([^;]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

// ─── 获取用户所有会话 ───────────────────────────────────────
async function getUserConversationIds(userId) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  return memberships.map((m) => m.conversationId);
}

// ─── 获取会话的所有成员 ID ──────────────────────────────────
async function getConversationMemberIds(conversationId) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

// ─── 在线状态管理 ────────────────────────────────────────────
async function markUserOnline(userId, socketId) {
  await redisStore.set(ONLINE_KEY(userId), Date.now().toString(), "EX", ONLINE_TTL_SEC);
  await redisStore.set(WS_KEY(userId), socketId, "EX", ONLINE_TTL_SEC);
}

async function markUserOffline(userId) {
  await redisStore.del(ONLINE_KEY(userId));
  await redisStore.del(WS_KEY(userId));
}

async function isUserWsOnline(userId) {
  const val = await redisStore.get(WS_KEY(userId));
  return val != null;
}

// ─── Ack 追踪 ────────────────────────────────────────────────
async function updateUserAck(userId, chatId, seqId) {
  const key = ACK_KEY(userId, chatId);
  // Lua 脚本：仅当新 seqId 更大时才更新
  const script = `
    local current = tonumber(redis.call('GET', KEYS[1]) or '0')
    if tonumber(ARGV[1]) > current then
      redis.call('SET', KEYS[1], ARGV[1])
      redis.call('EXPIRE', KEYS[1], 604800)
      return 1
    end
    return 0
  `;
  await redisStore.eval(script, 1, key, seqId.toString());
}

async function getUserAck(userId, chatId) {
  const val = await redisStore.get(ACK_KEY(userId, chatId));
  return val ? parseInt(val, 10) : 0;
}

// ─── 离线消息队列 ────────────────────────────────────────────
async function enqueueOfflineMessage(userId, chatId, payload) {
  const key = OFFLINE_QUEUE_KEY(userId);
  await redisStore.rpush(key, JSON.stringify({ chatId, payload }));
  await redisStore.expire(key, 7 * 24 * 60 * 60); // 7 天过期
}

// ─── 离线推送（调用 Next 内部 API） ───────────────────────────
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

async function sendOfflinePush(userId, chatId, messageId, conversationName, isGroup) {
  if (!INTERNAL_API_SECRET) return;
  try {
    const res = await fetch(`${APP_URL}/api/internal/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        userId,
        chatId,
        messageId,
        conversationName: conversationName || undefined,
        isGroup: Boolean(isGroup),
      }),
    });
    if (!res.ok) {
      console.error("[ws] Offline push failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[ws] Offline push error:", err.message);
  }
}

async function flushOfflineMessages(userId) {
  const key = OFFLINE_QUEUE_KEY(userId);
  const LIMIT = 200; // 单次最多回放 200 条离线消息，其余交给 Sync 补偿

  const pipeline = redisStore.pipeline();
  // 只取前 LIMIT 条，避免一次性拉取超大队列造成内存压力
  pipeline.lrange(key, 0, LIMIT - 1);
  // 保留后续消息，下次登录或通过其它机制再补偿
  pipeline.ltrim(key, LIMIT, -1);
  // 查看是否还有剩余离线消息
  pipeline.llen(key);
  const results = await pipeline.exec();
  if (!results || !results[0] || !results[0][1]) {
    return { messages: [], truncated: false };
  }
  const messages = results[0][1]
    .map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const remaining = results[2]?.[1] ?? 0;
  return { messages, truncated: remaining > 0 };
}

// ─── 消息投递（带 Ack 重传） ──────────────────────────────────

/**
 * 向指定 socket 发送消息，并启动 Ack 等待计时器。
 * 如果超时未收到 Ack，自动重传（最多 MAX_RETRY_COUNT 次）。
 */
function sendWithAck(socket, chatId, payload) {
  const msgKey = `${chatId}:${payload.id}`;
  socket.emit("message", { chatId, ...payload });

  // 初始化该 socket 的 pending ack map
  if (!pendingAcks.has(socket.id)) {
    pendingAcks.set(socket.id, new Map());
  }
  const socketPending = pendingAcks.get(socket.id);

  // 如果已有该消息的重传计划（说明是重传），不要重新设置
  if (socketPending.has(msgKey)) return;

  const retryState = {
    retryCount: 0,
    chatId,
    payload,
    timer: null,
  };

  const scheduleRetry = () => {
    retryState.timer = setTimeout(() => {
      retryState.retryCount++;
      if (retryState.retryCount > MAX_RETRY_COUNT) {
        // 超过最大重传次数，清理
        socketPending.delete(msgKey);
        console.log(`[ws] Message ${payload.id} to ${socket.userId}: exceeded max retries`);
        return;
      }
      // 检查 socket 是否仍然连接
      if (socket.connected) {
        console.log(`[ws] Retransmitting ${payload.id} to ${socket.userId} (attempt ${retryState.retryCount})`);
        socket.emit("message", { chatId, ...payload });
        scheduleRetry();
      } else {
        socketPending.delete(msgKey);
      }
    }, ACK_TIMEOUT_MS);
  };

  retryState.timer = null;
  socketPending.set(msgKey, retryState);
  scheduleRetry();
}

/**
 * 处理客户端的 Ack，取消重传计时器
 */
function handleAck(socket, chatId, msgId, seqId) {
  const socketPending = pendingAcks.get(socket.id);
  if (socketPending) {
    const msgKey = `${chatId}:${msgId}`;
    const state = socketPending.get(msgKey);
    if (state && state.timer) {
      clearTimeout(state.timer);
    }
    socketPending.delete(msgKey);
  }
  // 更新 Redis 中的 Ack 位置
  if (socket.userId && seqId) {
    updateUserAck(socket.userId, chatId, seqId);
  }
}

/**
 * 处理批量聚合 Ack：清除指定 chatId 下 seqId <= maxSeqId 的所有 pending 消息。
 * 批量 Ack 比逐条 Ack 高效得多：万人群一次 Ack 可清除所有 pending。
 */
function handleBatchAck(socket, chatId, maxSeqId) {
  const socketPending = pendingAcks.get(socket.id);
  if (!socketPending) return;

  // 遍历所有 pending 消息，清除属于该 chatId 且 seqId <= maxSeqId 的
  for (const [msgKey, state] of socketPending) {
    // msgKey 格式为 "chatId:msgId"
    if (!msgKey.startsWith(chatId + ":")) continue;
    if (state.payload && state.payload.seqId && state.payload.seqId <= maxSeqId) {
      if (state.timer) clearTimeout(state.timer);
      socketPending.delete(msgKey);
    }
  }
}

/**
 * 清理 socket 的所有 pending ack 计时器
 */
function cleanupPendingAcks(socketId) {
  const socketPending = pendingAcks.get(socketId);
  if (socketPending) {
    for (const [, state] of socketPending) {
      if (state.timer) clearTimeout(state.timer);
    }
    pendingAcks.delete(socketId);
  }
}

// ─── HTTP & Socket.IO 服务器 ──────────────────────────────────
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
  // Socket.IO 内置心跳配置
  pingInterval: 25000,
  pingTimeout: 10000,
});

// ── 挂载 Redis Adapter：实现跨服务器 Room 广播 ──
// 当 Server 1 调用 io.to(chatId).emit()，消息会通过 Redis 自动
// 转发到 Server 2 上同一 Room 的所有 socket。
io.adapter(createAdapter(adapterPub, adapterSub));
console.log(`[ws] Redis Adapter enabled (server: ${SERVER_ID})`);

// ─── JWT 认证中间件 ──────────────────────────────────────────
io.use((socket, next) => {
  const token = getTokenFromHandshake(socket.handshake);
  if (!token) {
    return next(new Error("未提供认证令牌"));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.userId) {
      return next(new Error("无效的认证令牌"));
    }
    socket.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error("无效或过期的认证令牌"));
  }
});

// ─── Redis 订阅 → 跨服务器消息分发 ──────────────────────────
//
// 分布式架构要点：
//   用户 A 在 Server 1，用户 B 在 Server 2。
//   消息通过 Redis PUB/SUB 到达所有 WS 服务器。
//   每台服务器只投递给「本机上连接的」用户。
//   对于「全局不在线」的用户才入离线队列（通过 Redis WS_KEY 判断）。
//   由一台服务器负责离线入队（避免重复），通过分布式锁选主。
//
redisSub.subscribe(CHAT_CHANNEL);
redisSub.on("message", async (channel, message) => {
  if (channel !== CHAT_CHANNEL) return;
  try {
    const { chatId, payload } = JSON.parse(message);

    // 获取会话信息（用于离线推送摘要：群名 / 私聊）
    let conversation = null;
    try {
      conversation = await prisma.conversation.findUnique({
        where: { id: chatId },
        select: { name: true, isGroup: true },
      });
    } catch (e) {
      // ignore
    }

    // 获取会话所有成员
    const memberIds = await getConversationMemberIds(chatId);

    for (const memberId of memberIds) {
      // 跳过发送者自己（发送者通过 HTTP 响应已获得消息）
      if (memberId === payload.senderId) continue;

      // ── 策略 1：投递给本机上的 socket（带 Ack 重传） ──
      const localSockets = userSockets.get(memberId);
      if (localSockets && localSockets.size > 0) {
        for (const socketId of localSockets) {
          const socket = io.sockets.sockets.get(socketId);
          if (socket && socket.connected) {
            sendWithAck(socket, chatId, { ...payload, isOwn: false });
          }
        }
        // 本机已投递，不需要入离线队列
        continue;
      }

      // ── 策略 2：用户不在本机 → 检查是否在其他服务器上 ──
      const isOnlineAnywhere = await isUserWsOnline(memberId);
      if (isOnlineAnywhere) continue;

      // ── 策略 3：用户全局离线 → 分布式锁入离线队列 + 离线推送 ──
      const lockKey = `offline:lock:${memberId}:${payload.id}`;
      try {
        const acquired = await redisStore.set(lockKey, SERVER_ID, "EX", 30, "NX");
        if (acquired) {
          await enqueueOfflineMessage(memberId, chatId, { ...payload, isOwn: false });
          // 静默通知与摘要：私聊「您收到一条新消息」，群聊「[群名]有新动态」；推送包带 unreadCount
          await sendOfflinePush(
            memberId,
            chatId,
            payload.id,
            conversation?.name,
            conversation?.isGroup ?? false
          );
        }
      } catch (lockErr) {
        console.error(`[ws] Offline lock failed for ${memberId}:`, lockErr);
      }
    }
  } catch (err) {
    console.error("[ws] Invalid message from Redis:", err);
  }
});
redisSub.on("error", (err) => console.error("[ws] Redis sub error:", err));

// ─── Socket.IO 连接处理 ──────────────────────────────────────
io.on("connection", async (socket) => {
  const userId = socket.userId;
  console.log(`[ws] User ${userId} connected (socket: ${socket.id})`);

  // 1. 注册 userId <-> socketId 映射
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);
  socketUsers.set(socket.id, userId);

  // 2. 标记在线
  await markUserOnline(userId, socket.id);

  // 3. 自动加入用户所有会话的 Room
  try {
    const conversationIds = await getUserConversationIds(userId);
    for (const convId of conversationIds) {
      socket.join(convId);
    }
    console.log(`[ws] User ${userId} auto-joined ${conversationIds.length} rooms`);
  } catch (err) {
    console.error(`[ws] Auto-join failed for ${userId}:`, err);
  }

  // 4. 推送离线消息队列
  try {
    const { messages: offlineMessages, truncated } = await flushOfflineMessages(userId);
    if (offlineMessages.length > 0) {
      console.log(`[ws] Flushing ${offlineMessages.length} offline messages to ${userId}`);
      for (const { chatId, payload } of offlineMessages) {
        sendWithAck(socket, chatId, payload);
      }
      // 若仍有剩余离线消息未回放，提示客户端主动发起 Sync 补偿
      if (truncated) {
        socket.emit("offline_truncated");
      }
    }
  } catch (err) {
    console.error(`[ws] Offline flush failed for ${userId}:`, err);
  }

  // ── 事件：手动加入/离开 Room（新建会话时使用） ──
  socket.on("join", (chatId) => {
    if (chatId && typeof chatId === "string") {
      socket.join(chatId);
    }
  });

  socket.on("leave", (chatId) => {
    if (chatId && typeof chatId === "string") {
      socket.leave(chatId);
    }
  });

  // ── 事件：逐条消息 Ack（向后兼容） ──
  socket.on("ack", (data) => {
    if (!data || typeof data !== "object") return;
    const { chatId, msgId, seqId } = data;
    if (chatId && msgId) {
      handleAck(socket, chatId, msgId, seqId);
    }
  });

  // ── 事件：批量聚合 Ack（高性能模式） ──
  // 客户端在 200ms 窗口内将多条消息的 Ack 合并为一个批量请求
  // 格式：[{ chatId, seqId, msgId }, ...]
  // 每条只包含该 chatId 在窗口内的最大 seqId
  socket.on("batch_ack", (batch) => {
    if (!Array.isArray(batch)) return;
    for (const item of batch) {
      if (!item || typeof item !== "object") continue;
      const { chatId, msgId, seqId } = item;
      if (chatId && seqId) {
        // 用最大 seqId 清除该 chatId 下所有 <= seqId 的 pending 消息
        handleBatchAck(socket, chatId, seqId);
        // 更新 Redis Ack 位置
        updateUserAck(socket.userId, chatId, seqId);
      }
    }
  });

  // ── 事件：断线重连同步请求 ──
  // 客户端提供每个会话的 lastSeqId，服务端返回遗漏的消息
  socket.on("sync", async (syncData) => {
    if (!Array.isArray(syncData)) return;

    try {
      for (const { chatId, lastSeqId } of syncData) {
        if (!chatId || typeof lastSeqId !== "number") continue;

        // 从 DB 拉取遗漏的消息
        const missed = await prisma.message.findMany({
          where: {
            conversationId: chatId,
            seqId: { gt: lastSeqId },
          },
          include: {
            sender: true,
            replyTo: {
              select: {
                id: true,
                content: true,
                type: true,
                sender: { select: { nickname: true } },
              },
            },
          },
          orderBy: { seqId: "asc" },
          take: 200,
        });

        for (const msg of missed) {
          const payload = {
            id: msg.id,
            seqId: msg.seqId,
            clientMsgId: msg.clientMsgId || undefined,
            content: msg.content,
            timestamp: msg.createdAt.toISOString(),
            senderId: msg.senderId,
            senderName: msg.sender.nickname,
            isOwn: msg.senderId === userId,
            status: "delivered",
            type: msg.type.toLowerCase(),
            fileUrl: msg.fileUrl,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            ...(msg.type === "IMAGE" && { imageUrl: msg.fileUrl }),
            ...(msg.type === "VIDEO" && { videoUrl: msg.fileUrl }),
            ...(msg.replyTo && {
              replyTo: {
                id: msg.replyTo.id,
                content: msg.replyTo.content.slice(0, 100),
                senderName: msg.replyTo.sender.nickname,
                type: msg.replyTo.type.toLowerCase(),
              },
            }),
          };
          sendWithAck(socket, chatId, payload);
        }

        // 更新 Ack 位置
        if (missed.length > 0) {
          const maxSeq = missed[missed.length - 1].seqId;
          await updateUserAck(userId, chatId, maxSeq);
        }
      }
    } catch (err) {
      console.error(`[ws] Sync failed for ${userId}:`, err);
      socket.emit("sync_error", { error: "同步消息失败" });
    }
  });

  // ── 事件：心跳续期 ──
  socket.on("heartbeat", async () => {
    await markUserOnline(userId, socket.id);
    socket.emit("heartbeat_ack");
  });

  // ── 事件：断开连接 ──
  socket.on("disconnect", async (reason) => {
    console.log(`[ws] User ${userId} disconnected (reason: ${reason})`);

    // 1. 清理 userId <-> socketId 映射
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(userId);
        // 所有设备都断开 → 标记离线
        await markUserOffline(userId);
        console.log(`[ws] User ${userId} fully offline`);
      }
    }
    socketUsers.delete(socket.id);

    // 2. 清理所有 pending ack 计时器
    cleanupPendingAcks(socket.id);
  });
});

// ─── 定期清理无效的映射数据 ──────────────────────────────────
setInterval(() => {
  for (const [socketId, userId] of socketUsers) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket || !socket.connected) {
      socketUsers.delete(socketId);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
      cleanupPendingAcks(socketId);
    }
  }
}, 60000); // 每分钟清理一次

// ─── 启动服务器 ──────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[ws] WebSocket server v3 (distributed) listening on port ${PORT}`);
  console.log(`[ws] Server ID: ${SERVER_ID}`);
  console.log(`[ws] Ack timeout: ${ACK_TIMEOUT_MS}ms, Max retries: ${MAX_RETRY_COUNT}`);
});

// ─── 优雅关闭 ─────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`[ws] ${signal} received, shutting down...`);
  io.close();
  redisSub.disconnect();
  redisPub.disconnect();
  redisStore.disconnect();
  adapterPub.disconnect();
  adapterSub.disconnect();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
