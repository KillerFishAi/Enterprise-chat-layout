"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { Message } from "@/components/chat/message-list";

const WS_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "https:" : "http:"}//${window.location.hostname}:3001`
    : "";
const SOCKET_CONNECT_TIMEOUT = 2000;

export function useChatStream(
  chatId: string | null,
  onMessage: (chatId: string, message: Message) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!chatId) return;

    let useSocket = false;
    let socket: Socket | null = null;
    let es: EventSource | null = null;
    let socketTimeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (socketTimeout) clearTimeout(socketTimeout);
      if (socket) {
        socket.emit("leave", chatId);
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
      });
      socketRef.current = socket;

      socketTimeout = setTimeout(() => {
        socketTimeout = null;
        if (socket && !socket.connected) {
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
        useSocket = true;
        socket?.emit("join", chatId);
      });

      socket.on("message", (data: Message) => {
        onMessageRef.current(chatId, data);
      });

      socket.on("connect_error", () => {
        if (!useSocket) startSSE();
      });

      socket.on("disconnect", (reason) => {
        if (reason === "io server disconnect") startSSE();
      });
    };

    const startSSE = () => {
      if (!chatId) return;
      if (socket) {
        socket.disconnect();
        socket = null;
        socketRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      es = new EventSource(`/api/chats/${chatId}/stream`);
      eventSourceRef.current = es;
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Message;
          onMessageRef.current(chatId, data);
        } catch (err) {
          console.error("解析实时消息失败", err);
        }
      };
      es.onerror = () => {
        es?.close();
      };
    };

    trySocket();

    return () => {
      cleanup();
    };
  }, [chatId]);
}
