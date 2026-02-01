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

export function publishChatMessage(chatId: string, payload: ChatMessagePayload) {
  const client = getRedisPub();
  if (client) {
    client
      .publish(CHAT_CHANNEL, JSON.stringify({ chatId, payload }))
      .catch((err) => console.error("[chat-events] Redis publish error:", err));
  } else {
    emitter.emit("message", chatId, payload);
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
