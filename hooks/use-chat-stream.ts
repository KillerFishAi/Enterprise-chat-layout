"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { Message } from "@/components/chat/message-list";

// ─── 配置 ─────────────────────────────────────────────────────
// 生产环境可配置 NEXT_PUBLIC_WS_URL（如 wss://ws.example.com），否则默认当前 host + 3001
const WS_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_WS_URL ||
        `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:3001`)
    : "";
const SOCKET_CONNECT_TIMEOUT = 4000;
const RECONNECT_SYNC_DELAY = 500;  // 重连后延迟同步时间
const ACK_DEBOUNCE_MS = 200;       // Ack 聚合窗口（毫秒）

// ─── 工具函数 ─────────────────────────────────────────────────

function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/token=([^;]+)/);
  return m ? m[1].trim() : null;
}

/**
 * 生成客户端消息 ID（幂等 key）
 * 格式：cmsg-{timestamp}-{random}
 */
export function generateClientMsgId(): string {
  return `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── 消息类型（扩展 seqId） ──────────────────────────────────

export type StreamMessage = Message & {
  seqId: number;
  clientMsgId?: string;
  chatId?: string;
};

// ─── SeqId 本地存储管理 ──────────────────────────────────────

const SEQ_STORAGE_KEY = "im:lastSeqIds";

/** 获取所有会话的本地 lastSeqId */
function getLocalSeqIds(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SEQ_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** 更新某个会话的本地 lastSeqId（仅当更大时） */
function updateLocalSeqId(chatId: string, seqId: number): void {
  try {
    const ids = getLocalSeqIds();
    if (!seqId || (ids[chatId] && ids[chatId] >= seqId)) return;
    ids[chatId] = seqId;
    localStorage.setItem(SEQ_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage 不可用时静默失败
  }
}

/** 获取某个会话的本地 lastSeqId */
function getLocalSeqId(chatId: string): number {
  const ids = getLocalSeqIds();
  return ids[chatId] ?? 0;
}

// ─── 延迟聚合 Ack 管理器 ────────────────────────────────────
//
// 问题：万人群聊中，一条消息触发上万个逐条 Ack，网络开销巨大。
// 方案：在 ACK_DEBOUNCE_MS（200ms）滑动窗口内，将同一 chatId 下
//        收到的多条消息合并为一个"最大 seqId"的批量 Ack。
//
// 效果：200ms 内收到 50 条群消息 → 只发送 1 个 Ack 包
//        { chatId → maxSeqId, chatId2 → maxSeqId2, ... }
//

type AckAggregator = {
  /** 各 chatId 在当前窗口内的最大 seqId */
  pending: Map<string, { maxSeqId: number; lastMsgId: string }>;
  /** 当前窗口的 debounce 定时器 */
  timer: ReturnType<typeof setTimeout> | null;
  /** 发送聚合 Ack 的 Socket 引用 */
  socket: Socket | null;
};

function createAckAggregator(): AckAggregator {
  return { pending: new Map(), timer: null, socket: null };
}

/**
 * 将一条消息的 Ack 信息加入聚合器。
 * 在 ACK_DEBOUNCE_MS 后统一发送一个 batch_ack 事件。
 */
function enqueueAck(
  agg: AckAggregator,
  chatId: string,
  msgId: string,
  seqId: number
): void {
  const existing = agg.pending.get(chatId);
  if (!existing || seqId > existing.maxSeqId) {
    agg.pending.set(chatId, { maxSeqId: seqId, lastMsgId: msgId });
  }

  // 重置滑动窗口定时器
  if (agg.timer) clearTimeout(agg.timer);
  agg.timer = setTimeout(() => flushAcks(agg), ACK_DEBOUNCE_MS);
}

/**
 * 立即发送聚合 Ack（窗口到期或连接断开前调用）。
 * 发送格式：batch_ack [{ chatId, maxSeqId, lastMsgId }, ...]
 */
function flushAcks(agg: AckAggregator): void {
  if (agg.pending.size === 0) return;
  if (!agg.socket || !agg.socket.connected) return;

  const batch = Array.from(agg.pending.entries()).map(
    ([chatId, { maxSeqId, lastMsgId }]) => ({
      chatId,
      seqId: maxSeqId,
      msgId: lastMsgId,
    })
  );

  agg.socket.emit("batch_ack", batch);
  agg.pending.clear();
  agg.timer = null;
}

/**
 * 清理聚合器（组件卸载或断线时调用）
 */
function destroyAckAggregator(agg: AckAggregator): void {
  if (agg.timer) clearTimeout(agg.timer);
  // 尝试在断开前发送最后一批 Ack
  flushAcks(agg);
  agg.pending.clear();
  agg.socket = null;
}

// ─── 主 Hook ─────────────────────────────────────────────────

export function useChatStream(
  chatIds: string[],
  onMessage: (chatId: string, message: StreamMessage) => void,
  options?: {
    /** 外部提供的 seqId 映射（优先于 localStorage） */
    seqIdMap?: Record<string, number>;
  }
) {
  const socketRef = useRef<Socket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const seqIdMapRef = useRef<Record<string, number>>(options?.seqIdMap ?? {});
  seqIdMapRef.current = options?.seqIdMap ?? seqIdMapRef.current;

  // chatIds 的稳定引用
  const chatIdsRef = useRef<string[]>(chatIds);
  chatIdsRef.current = chatIds;

  // ── 延迟聚合 Ack 实例 ──
  const ackAggRef = useRef<AckAggregator>(createAckAggregator());

  // 处理收到的消息：聚合 Ack + 更新 seqId + 回调
  const handleIncomingMessage = useCallback(
    (socket: Socket | null, data: StreamMessage & { chatId?: string }) => {
      const chatId = data.chatId;
      if (!chatId) return;

      // 去除 chatId 字段，还原为纯消息
      const { chatId: _, ...message } = data;

      // 1. 加入 Ack 聚合器（200ms 窗口内合并为一次发送）
      if (socket && socket.connected && message.id && message.seqId) {
        ackAggRef.current.socket = socket;
        enqueueAck(ackAggRef.current, chatId, message.id, message.seqId);
      }

      // 2. 更新本地 seqId 追踪
      if (message.seqId) {
        updateLocalSeqId(chatId, message.seqId);
        // 同时更新内存引用
        const currentMax = seqIdMapRef.current[chatId] ?? 0;
        if (message.seqId > currentMax) {
          seqIdMapRef.current[chatId] = message.seqId;
        }
      }

      // 3. 回调给上层
      onMessageRef.current(chatId, message as StreamMessage);
    },
    []
  );

  // 断线重连时的同步逻辑
  const syncOnReconnect = useCallback(
    (socket: Socket) => {
      const syncData = chatIdsRef.current.map((chatId) => {
        // 优先使用内存中的 seqId，其次 localStorage
        const lastSeqId =
          seqIdMapRef.current[chatId] ?? getLocalSeqId(chatId);
        return { chatId, lastSeqId };
      });

      if (syncData.length > 0) {
        console.log("[ws-hook] Requesting sync after reconnect:", syncData);
        socket.emit("sync", syncData);
      }
    },
    []
  );

  // Gap Detection：检查消息 seqId 是否连续
  const detectAndFillGaps = useCallback(
    async (chatId: string, receivedSeqId: number) => {
      const lastKnown = seqIdMapRef.current[chatId] ?? getLocalSeqId(chatId);
      const gap = receivedSeqId - lastKnown;

      // 如果有超过 1 的 gap（跳号），通过 HTTP 拉取缺失消息
      if (gap > 1 && lastKnown > 0) {
        console.log(
          `[ws-hook] Gap detected in ${chatId}: expected ${lastKnown + 1}, got ${receivedSeqId}. Filling...`
        );
        try {
          const res = await fetch(
            `/api/chats/${chatId}/sync?afterSeq=${lastKnown}&limit=200`
          );
          if (res.ok) {
            const json = (await res.json()) as { data?: StreamMessage[] };
            if (Array.isArray(json.data)) {
              for (const msg of json.data) {
                onMessageRef.current(chatId, msg);
                if (msg.seqId) {
                  updateLocalSeqId(chatId, msg.seqId);
                  seqIdMapRef.current[chatId] = msg.seqId;
                }
              }
            }
          }
        } catch (err) {
          console.error("[ws-hook] Gap fill failed:", err);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (chatIds.length === 0) return;

    let socket: Socket | null = null;
    let es: EventSource | null = null;
    let socketTimeout: ReturnType<typeof setTimeout> | null = null;
    let isCleanedUp = false;
    let wasConnected = false;

    const cleanup = () => {
      isCleanedUp = true;
      if (socketTimeout) clearTimeout(socketTimeout);
      // 在断开前发送最后一批聚合 Ack
      destroyAckAggregator(ackAggRef.current);
      ackAggRef.current = createAckAggregator();
      if (socket) {
        socket.disconnect();
        socket = null;
        socketRef.current = null;
      }
      if (es) {
        es.close();
        es = null;
        eventSourceRef.current = null;
      }
    };

    const trySocket = () => {
      if (!WS_URL) {
        startSSE();
        return;
      }

      socket = io(WS_URL, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        timeout: SOCKET_CONNECT_TIMEOUT,
        auth: { token: getAuthToken() ?? "" },
        // 自动重连配置
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
      });
      socketRef.current = socket;

      // 首次连接超时 → 降级到 SSE
      socketTimeout = setTimeout(() => {
        socketTimeout = null;
        if (socket && !socket.connected && !wasConnected) {
          socket.disconnect();
          socket = null;
          socketRef.current = null;
          startSSE();
        }
      }, SOCKET_CONNECT_TIMEOUT);

      socket.on("connect", () => {
        if (socketTimeout) {
          clearTimeout(socketTimeout);
          socketTimeout = null;
        }

        const isReconnect = wasConnected;
        wasConnected = true;
        console.log(
          `[ws-hook] Connected${isReconnect ? " (reconnect)" : ""}`
        );

        // 重连后发送同步请求，补偿断线期间遗漏的消息
        if (isReconnect) {
          setTimeout(() => {
            if (socket && socket.connected) {
              syncOnReconnect(socket);
            }
          }, RECONNECT_SYNC_DELAY);
        }
      });

      // 接收消息
      socket.on("message", (data: StreamMessage & { chatId?: string }) => {
        if (!data || !data.chatId) return;

        // Gap Detection：检查是否有跳号
        if (data.seqId && data.chatId) {
          detectAndFillGaps(data.chatId, data.seqId);
        }

        handleIncomingMessage(socket, data);
      });

      socket.on("connect_error", (err) => {
        console.error("[ws-hook] Connection error:", err.message);
        if (!wasConnected && !isCleanedUp) {
          startSSE();
        }
      });

      // 离线消息被截断：服务端仅回放了部分离线，提示客户端主动 Sync 补偿
      socket.on("offline_truncated", () => {
        console.log("[ws-hook] offline_truncated received, triggering sync for all chats");
        if (socket && socket.connected) {
          syncOnReconnect(socket);
        }
      });

      socket.on("disconnect", (reason) => {
        console.log(`[ws-hook] Disconnected: ${reason}`);
        // Socket.IO 会自动重连，不需要手动处理
        // 但如果是服务端主动断开，降级到 SSE
        if (reason === "io server disconnect" && !isCleanedUp) {
          startSSE();
        }
      });

      // 心跳续期
      const heartbeatInterval = setInterval(() => {
        if (socket && socket.connected) {
          socket.emit("heartbeat");
        }
      }, 30000);

      // 存储清理函数
      const originalCleanup = cleanup;
      // 覆写 cleanup 以包含心跳清理
      Object.assign(cleanup, () => {
        clearInterval(heartbeatInterval);
        originalCleanup();
      });
    };

    // SSE 降级（仅支持单会话，作为 WebSocket 的备用方案）
    const startSSE = () => {
      if (isCleanedUp) return;
      const primaryChatId = chatIds[0];
      if (!primaryChatId) return;

      if (socket) {
        socket.disconnect();
        socket = null;
        socketRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      console.log("[ws-hook] Falling back to SSE for chat:", primaryChatId);
      es = new EventSource(`/api/chats/${primaryChatId}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamMessage;
          onMessageRef.current(primaryChatId, data);
          if (data.seqId) {
            updateLocalSeqId(primaryChatId, data.seqId);
          }
        } catch (err) {
          console.error("[ws-hook] SSE parse error:", err);
        }
      };

      es.onerror = () => {
        console.error("[ws-hook] SSE error, closing");
        es?.close();
      };
    };

    trySocket();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIds.join(",")]);

  // 暴露手动同步方法
  const manualSync = useCallback(
    (chatId: string) => {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        const lastSeqId =
          seqIdMapRef.current[chatId] ?? getLocalSeqId(chatId);
        socket.emit("sync", [{ chatId, lastSeqId }]);
      }
    },
    []
  );

  return { manualSync, socket: socketRef };
}
