"use client";

import React from "react"

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, Download, Film, Play } from "lucide-react";
import { MessageContextMenu } from "./message-context-menu";
import { AvatarContextMenu } from "./avatar-context-menu";

export type MessageType = "text" | "image" | "file" | "video";

export interface Message {
  id: string;
  seqId?: number;         // 会话内单调递增消息序号
  clientMsgId?: string;   // 客户端幂等 ID
  content: string;
  timestamp: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  isOwn: boolean;
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  type?: MessageType;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  readCount?: number;
  isRead?: boolean;
  replyTo?: { id: string; content: string; senderName: string; type?: string };
  revoked?: boolean;
}

interface MessageListProps {
  messages: Message[];
  isGroupChat?: boolean;
  isGroupAdmin?: boolean;
  onReplyMessage?: (message: Message) => void;
  onPinMessage?: (message: Message) => void;
  onCopyMessage?: (message: Message) => void;
  onForwardMessage?: (message: Message) => void;
  onDeleteMessage?: (message: Message) => void;
  onSelectMessage?: (message: Message) => void;
  onMentionUser?: (userName: string) => void;
  onViewProfile?: (senderId: string, senderName: string) => void;
  onAddFriend?: (senderId: string) => void;
  onRemoveFriend?: (senderId: string) => void;
  onSendMessageToUser?: (senderId: string) => void;
  onKickFromGroup?: (senderId: string) => void;
  onMuteUser?: (senderId: string) => void;
  friendsList?: string[];
}

// Text bubble component
function TextBubble({ content, isOwn }: { content: string; isOwn: boolean }) {
  return (
    <div
      className={cn(
        "px-3 py-2 rounded text-[14px] leading-relaxed",
        isOwn
          ? "bg-chat-bubble-own text-chat-bubble-own-foreground"
          : "bg-chat-bubble-other text-chat-bubble-other-foreground shadow-sm"
      )}
    >
      <p className="whitespace-pre-wrap break-words">{content}</p>
    </div>
  );
}

// Image message component
function ImageBubble({
  imageUrl,
  isOwn,
}: {
  imageUrl: string;
  isOwn: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded overflow-hidden max-w-[240px]",
        isOwn ? "bg-chat-bubble-own" : "bg-chat-bubble-other shadow-sm"
      )}
    >
      <img
        src={imageUrl || "/placeholder.svg"}
        alt="Shared image"
        className="w-full h-auto block"
        loading="lazy"
      />
    </div>
  );
}

// Video message component
function VideoBubble({
  videoUrl,
  isOwn,
}: {
  videoUrl: string;
  isOwn: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded overflow-hidden max-w-[280px]",
        isOwn ? "bg-chat-bubble-own" : "bg-chat-bubble-other shadow-sm"
      )}
    >
      <div className="relative">
        <video
          src={videoUrl}
          className="w-full h-auto block max-h-[200px]"
          controls
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="h-6 w-6 text-white ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

// File message component
function FileBubble({
  fileName,
  fileSize,
  isOwn,
}: {
  fileName: string;
  fileSize?: string;
  isOwn: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded min-w-[200px] max-w-[280px]",
        isOwn ? "bg-chat-bubble-own" : "bg-chat-bubble-other shadow-sm"
      )}
    >
      <div className="shrink-0 w-10 h-10 rounded bg-muted/60 flex items-center justify-center">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isOwn ? "text-chat-bubble-own-foreground" : "text-foreground"
          )}
        >
          {fileName}
        </p>
        {fileSize && (
          <p className="text-xs text-muted-foreground mt-0.5">{fileSize}</p>
        )}
      </div>
      <button
        className={cn(
          "shrink-0 p-1.5 rounded hover:bg-foreground/5 transition-colors",
          isOwn ? "text-chat-bubble-own-foreground/70" : "text-muted-foreground"
        )}
      >
        <Download className="h-4 w-4" />
        <span className="sr-only">下载文件</span>
      </button>
    </div>
  );
}

export function MessageList({ 
  messages, 
  isGroupChat = false,
  isGroupAdmin = false,
  onReplyMessage,
  onPinMessage,
  onCopyMessage,
  onForwardMessage,
  onDeleteMessage,
  onSelectMessage,
  onMentionUser,
  onViewProfile,
  onAddFriend,
  onRemoveFriend,
  onSendMessageToUser,
  onKickFromGroup,
  onMuteUser,
  friendsList = [],
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    message: Message | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, message: null });
  
  const [avatarContextMenu, setAvatarContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    senderId: string;
    senderName: string;
  }>({ isOpen: false, position: { x: 0, y: 0 }, senderId: "", senderName: "" });

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Group messages by time intervals
  const shouldShowTimestamp = (index: number) => {
    if (index === 0) return true;
    return index % 4 === 0;
  };

  const handleMessageContextMenu = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    message: Message
  ) => {
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    
    setMessageContextMenu({
      isOpen: true,
      position: { x: clientX, y: clientY },
      message,
    });
    setAvatarContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleAvatarContextMenu = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    senderId: string,
    senderName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (senderId === "current") return;
    
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    
    setAvatarContextMenu({
      isOpen: true,
      position: { x: clientX, y: clientY },
      senderId,
      senderName,
    });
    setMessageContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleTouchStart = useCallback((
    e: React.TouchEvent,
    message: Message
  ) => {
    longPressTimer.current = setTimeout(() => {
      handleMessageContextMenu(e, message);
    }, 500);
  }, [handleMessageContextMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleAvatarTouchStart = useCallback((
    e: React.TouchEvent,
    senderId: string,
    senderName: string
  ) => {
    longPressTimer.current = setTimeout(() => {
      handleAvatarContextMenu(e, senderId, senderName);
    }, 500);
  }, [handleAvatarContextMenu]);

  const isFriend = (senderId: string) => friendsList.includes(senderId);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 bg-chat-bg">
      {/* Date separator */}
      {messages.length > 0 && (
        <div className="flex items-center justify-center my-4">
          <span className="px-2.5 py-1 text-[11px] text-muted-foreground bg-muted rounded-sm">
            今天
          </span>
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => {
        // #region agent log
        const hasUndefContent = message.content === undefined || message.replyTo?.content === undefined;
        const hasUndefName = message.senderName === undefined || message.replyTo?.senderName === undefined;
        if (hasUndefContent || hasUndefName) {
          fetch("http://127.0.0.1:7242/ingest/2b6503fa-2fda-4338-ae3c-6481ce886ad7", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "message-list.tsx:map", message: "message undefined content or name", data: { messageId: message.id, hasUndefContent, hasUndefName, contentType: typeof message.content, senderNameType: typeof message.senderName }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: hasUndefContent ? "H2" : "H3" }) }).catch(() => {});
        }
        // #endregion
        const showAvatar =
          !message.isOwn &&
          (index === 0 || messages[index - 1].senderId !== message.senderId);

        const showTimestamp = shouldShowTimestamp(index);
        const messageType = message.type || "text";
        const safeContent = message.content ?? "";
        const safeSenderName = message.senderName ?? "未知";
        const safeReplyContent = message.replyTo?.content ?? "";
        const safeReplySenderName = message.replyTo?.senderName ?? "";

        return (
          <div key={message.id}>
            {/* Timestamp separator */}
            {showTimestamp && index > 0 && (
              <div className="flex items-center justify-center my-4">
                <span className="text-[11px] text-muted-foreground">
                  {message.timestamp}
                </span>
              </div>
            )}

            <div
              className={cn(
                "flex items-start gap-2.5 mb-4",
                message.isOwn ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar */}
              <div className="w-10 shrink-0">
                {(showAvatar || message.isOwn) && (
                  <div
                    onContextMenu={(e) => handleAvatarContextMenu(e, message.senderId, safeSenderName)}
                    onTouchStart={(e) => handleAvatarTouchStart(e, message.senderId, safeSenderName)}
                    onTouchEnd={handleTouchEnd}
                    className={cn(
                      "block rounded transition-opacity select-none",
                      !message.isOwn && "cursor-context-menu"
                    )}
                  >
                    <Avatar className="h-10 w-10 rounded">
                      <AvatarImage
                        src={message.senderAvatar || "/placeholder.svg"}
                        alt={safeSenderName}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium rounded">
                        {(safeSenderName || "?")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div
                className={cn(
                  "max-w-[65%] md:max-w-[50%]",
                  message.isOwn ? "items-end" : "items-start"
                )}
                onContextMenu={(e) => handleMessageContextMenu(e, message)}
                onTouchStart={(e) => handleTouchStart(e, message)}
                onTouchEnd={handleTouchEnd}
              >
                {/* Sender name for group chats */}
                {!message.isOwn && showAvatar && (
                  <p className="text-[12px] text-muted-foreground mb-1 ml-0.5">
                    {safeSenderName}
                  </p>
                )}

                {/* Message bubble based on type */}
                <div className="select-none">
                  {message.replyTo && (
                    <div
                      className={cn(
                        "mb-1.5 pl-2 border-l-2 rounded-r text-xs truncate",
                        message.isOwn
                          ? "border-chat-bubble-own text-chat-bubble-own-foreground/80"
                          : "border-chat-bubble-other text-chat-bubble-other-foreground/80"
                      )}
                    >
                      <span className="font-medium">{safeReplySenderName}</span>
                      <span className="ml-1 opacity-90">{safeReplyContent}</span>
                    </div>
                  )}
                  {messageType === "text" && (
                    <TextBubble content={safeContent} isOwn={message.isOwn} />
                  )}
                  {messageType === "image" && message.imageUrl && (
                    <ImageBubble
                      imageUrl={message.imageUrl}
                      isOwn={message.isOwn}
                    />
                  )}
                  {messageType === "video" && message.videoUrl && (
                    <VideoBubble
                      videoUrl={message.videoUrl}
                      isOwn={message.isOwn}
                    />
                  )}
                  {messageType === "file" && message.fileName && (
                    <FileBubble
                      fileName={message.fileName}
                      fileSize={message.fileSize}
                      isOwn={message.isOwn}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />

      {/* Message Context Menu */}
      <MessageContextMenu
        isOpen={messageContextMenu.isOpen}
        position={messageContextMenu.position}
        onClose={() => setMessageContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onReply={() => messageContextMenu.message && onReplyMessage?.(messageContextMenu.message)}
        onPin={() => messageContextMenu.message && onPinMessage?.(messageContextMenu.message)}
        onCopy={() => {
          const text = messageContextMenu.message?.content ?? "";
          if (text) {
            navigator.clipboard.writeText(text);
          }
          onCopyMessage?.(messageContextMenu.message!);
        }}
        onForward={() => messageContextMenu.message && onForwardMessage?.(messageContextMenu.message)}
        onDelete={() => messageContextMenu.message && onDeleteMessage?.(messageContextMenu.message)}
        onSelect={() => messageContextMenu.message && onSelectMessage?.(messageContextMenu.message)}
        isOwnMessage={messageContextMenu.message?.isOwn}
      />

      {/* Avatar Context Menu */}
      <AvatarContextMenu
        isOpen={avatarContextMenu.isOpen}
        position={avatarContextMenu.position}
        onClose={() => setAvatarContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onMention={() => onMentionUser?.(avatarContextMenu.senderName)}
        onViewProfile={() => onViewProfile?.(avatarContextMenu.senderId, avatarContextMenu.senderName)}
        onAddFriend={() => {
          if (isFriend(avatarContextMenu.senderId)) {
            onRemoveFriend?.(avatarContextMenu.senderId);
          } else {
            onAddFriend?.(avatarContextMenu.senderId);
          }
        }}
        onSendMessage={() => onSendMessageToUser?.(avatarContextMenu.senderId)}
        onKickFromGroup={() => onKickFromGroup?.(avatarContextMenu.senderId)}
        onMute={() => onMuteUser?.(avatarContextMenu.senderId)}
        isGroupChat={isGroupChat}
        isGroupAdmin={isGroupAdmin}
        isFriend={isFriend(avatarContextMenu.senderId)}
      />
    </div>
  );
}
