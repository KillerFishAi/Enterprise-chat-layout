"use client";

import { ChatHeader } from "./chat-header";
import { MessageList, type Message } from "./message-list";
import { MessageInput } from "./message-input";
import { MessageSquare } from "lucide-react";

interface ChatAreaProps {
  selectedChat: {
    id: string;
    name: string;
    avatar?: string;
    status?: string;
    isGroup?: boolean;
    memberCount?: number;
  } | null;
  messages: Message[];
  onSendMessage: (content: string, attachments?: import("./message-input").FileAttachment[], replyToMessageId?: string) => void;
  onMobileMenuClick?: () => void;
  onSettingsClick?: () => void;
  onAvatarClick?: (senderId: string, senderName: string, senderAvatar?: string) => void;
  replyingTo?: { id: string; content: string; senderName: string } | null;
  onCancelReply?: () => void;
  onReplyMessage?: (message: Message) => void;
  onDeleteMessage?: (message: Message) => void;
  onForwardMessage?: (message: Message) => void;
  onSearchClick?: () => void;
}

export function ChatArea({
  selectedChat,
  messages,
  onSendMessage,
  onMobileMenuClick,
  onSettingsClick,
  onAvatarClick,
  replyingTo,
  onCancelReply,
  onReplyMessage,
  onDeleteMessage,
  onForwardMessage,
  onSearchClick,
}: ChatAreaProps) {
  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-center p-8">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          欢迎使用企业通讯
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          从侧边栏选择一个对话开始与团队沟通
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <ChatHeader
        name={selectedChat.name ?? ""}
        isGroup={selectedChat.isGroup}
        memberCount={selectedChat.memberCount}
        onMobileMenuClick={onMobileMenuClick}
        onSettingsClick={onSettingsClick}
        onSearchClick={onSearchClick}
      />
      <MessageList
        messages={messages}
        onAvatarClick={onAvatarClick}
        onReplyMessage={onReplyMessage}
        onDeleteMessage={onDeleteMessage}
        onForwardMessage={onForwardMessage}
      />
      <MessageInput
        onSendMessage={onSendMessage}
        replyingTo={replyingTo}
        onCancelReply={onCancelReply}
      />
    </div>
  );
}
