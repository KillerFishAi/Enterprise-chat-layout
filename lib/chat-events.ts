import { EventEmitter } from "events";

export type ChatMessagePayload = {
  id: string;
  content: string;
  timestamp: string;
  senderId: string;
  senderName: string;
  isOwn: boolean;
  status: "sent" | "delivered" | "read";
  type?: "text" | "file" | "image";
  fileName?: string;
  fileSize?: string;
  imageUrl?: string;
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
}

const emitter: ChatEventEmitter =
  (global.chatEmitter as ChatEventEmitter | undefined) ??
  (new EventEmitter() as ChatEventEmitter);

if (!global.chatEmitter) {
  global.chatEmitter = emitter;
}

export function publishChatMessage(chatId: string, payload: ChatMessagePayload) {
  emitter.emit("message", chatId, payload);
}

export function subscribeChatMessages(
  chatId: string,
  listener: (payload: ChatMessagePayload) => void
) {
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
