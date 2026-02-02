import { EventEmitter } from "events";
import Redis from "ioredis";

export type ChatMessagePayload = {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  senderName: string;
  isOwn: boolean;
  status: "sent" | "delivered" | "read";
  type?: "text" | "file" | "image" | "video";
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  replyTo?: { id: string; content: string; senderName: string; type?: string };
  revoked?: boolean;
};

type ChatEvents = {
  message: (chatId: string, payload: ChatMessagePayload) => void;
};

type ChatEventEmitter = EventEmitter & {
  on<U extends keyof ChatEvents>(event: U, listener: ChatEvents[U]): this;
  off<U extends keyof ChatEvents>(event: U, listener: ChatEvents[U]): this;
  emit<U extends keyof ChatEvents>(
    event: U,
    ...args: Parameters<ChatEvents[U]>
  ): boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var chatEmitter: ChatEventEmitter | undefined;
  // eslint-disable-next-line no-var
  var chatRedisSub: Redis | undefined;
}

const CHAT_CHANNEL = "chat:messages";
const MAX_PUBLISH_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/** In-process emitter: always used for dispatching to local subscribers */
const emitter: ChatEventEmitter =
  (global.chatEmitter as ChatEventEmitter | undefined) ??
  (new EventEmitter() as ChatEventEmitter);

if (!global.chatEmitter) {
  global.chatEmitter = emitter;
}

/** Redis publish client (lazy init when REDIS_URL is set) */
let redisPub: Redis | null = null;

function getRedisPub(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (redisPub) return redisPub;
  try {
    redisPub = new Redis(url, { maxRetriesPerRequest: 3 });
    redisPub.on("error", (err) => console.error("[chat-events] Redis pub error:", err));
    return redisPub;
  } catch (err) {
    console.error("[chat-events] Redis connect failed:", err);
    return null;
  }
}

/** Redis subscriber: subscribes to CHAT_CHANNEL and forwards to local emitter */
function ensureRedisSub(): void {
  const url = process.env.REDIS_URL;
  if (!url || global.chatRedisSub) return;
  try {
    const sub = new Redis(url, { maxRetriesPerRequest: 3 });
    sub.subscribe(CHAT_CHANNEL, (err) => {
      if (err) {
        console.error("[chat-events] Redis sub subscribe error:", err);
        return;
      }
    });
    sub.on("message", (_channel: string, message: string) => {
      try {
        const { chatId, payload } = JSON.parse(message) as {
          chatId: string;
          payload: ChatMessagePayload;
        };
        emitter.emit("message", chatId, payload);
      } catch (e) {
        console.error("[chat-events] Invalid message:", e);
      }
    });
    sub.on("error", (err) => console.error("[chat-events] Redis sub error:", err));
    global.chatRedisSub = sub;
  } catch (err) {
    console.error("[chat-events] Redis sub connect failed:", err);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 发布聊天消息到 Redis，失败时重试并降级到本地广播。
 * @returns 是否通过 Redis 成功发布（false 表示降级到本地）
 */
export async function publishChatMessage(
  chatId: string,
  payload: ChatMessagePayload,
  retries = MAX_PUBLISH_RETRIES
): Promise<boolean> {
  const client = getRedisPub();

  if (!client) {
    emitter.emit("message", chatId, payload);
    return false;
  }

  try {
    await client.publish(CHAT_CHANNEL, JSON.stringify({ chatId, payload }));
    return true;
  } catch (err) {
    console.error("[chat-events] Redis publish error:", err);
    if (retries > 0) {
      await delay(RETRY_DELAY_MS);
      return publishChatMessage(chatId, payload, retries - 1);
    }
    emitter.emit("message", chatId, payload);
    return false;
  }
}

export function subscribeChatMessages(
  chatId: string,
  listener: (payload: ChatMessagePayload) => void
) {
  ensureRedisSub();
  const handler: ChatEvents["message"] = (incomingChatId, payload) => {
    if (incomingChatId === chatId) {
      listener(payload);
    }
  };
  emitter.on("message", handler);
  return () => {
    emitter.off("message", handler);
  };
}
