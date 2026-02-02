"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X, MessageSquare, Users, Settings, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactsList, type Contact } from "./contacts-list";

interface Chat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: string;
  unread?: number;
  isGroup?: boolean;
  online?: boolean;
}

type TabType = "chats" | "contacts";

interface ChatSidebarProps {
  chats: Chat[];
  contacts: Contact[];
  selectedChatId: string | null;
  onSelectChat: (id: string) => void;
  onStartChatWithContact: (contact: Contact) => void;
  onMobileClose?: () => void;
  isMobileOpen?: boolean;
  onSettingsClick?: () => void;
  onAddFriendClick?: () => void;
  /** 创建群聊入口 */
  onCreateGroupClick?: () => void;
}

export function ChatSidebar({
  chats,
  contacts,
  selectedChatId,
  onSelectChat,
  onStartChatWithContact,
  onMobileClose,
  isMobileOpen,
  onSettingsClick,
  onAddFriendClick,
  onCreateGroupClick,
}: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread || 0), 0);

  return (
    <aside
      className={cn(
        "flex flex-col bg-card h-full",
        "w-full md:w-[300px] shrink-0",
        "fixed md:relative inset-y-0 left-0 z-40",
        "transition-transform duration-200 ease-in-out",
        "border-r border-border",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Tabs */}
      <div className="flex border-b border-border bg-secondary">
        <button
          type="button"
          onClick={() => setActiveTab("chats")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative",
            activeTab === "chats"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          <span>消息</span>
          {totalUnread > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
          {activeTab === "chats" && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contacts")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative",
            activeTab === "contacts"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-4 w-4" />
          <span>通讯录</span>
          {activeTab === "contacts" && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary" />
          )}
        </button>
        {/* Create Group button */}
        {onCreateGroupClick && (
          <button
            type="button"
            onClick={onCreateGroupClick}
            className="flex items-center justify-center w-10 py-3 text-muted-foreground hover:text-primary transition-colors"
            title="创建群聊"
          >
            <UsersRound className="h-4 w-4" />
            <span className="sr-only">创建群聊</span>
          </button>
        )}
        {/* Add Friend button */}
        <button
          type="button"
          onClick={onAddFriendClick}
          className="flex items-center justify-center w-10 py-3 text-muted-foreground hover:text-primary transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          <span className="sr-only">添加好友</span>
        </button>
        {/* Settings button */}
        <button
          type="button"
          onClick={onSettingsClick}
          className="flex items-center justify-center w-10 py-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span className="sr-only">设置</span>
        </button>
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1.5 right-2 md:hidden text-muted-foreground h-8 w-8"
          onClick={onMobileClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">关闭侧边栏</span>
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === "chats" ? (
        <>
          {/* Search Header */}
          <div className="px-3 py-2.5 border-b border-border">
            <div
              className={cn(
                "flex items-center gap-2 h-8 px-2.5 rounded bg-muted/60 transition-colors",
                isSearchFocused && "bg-muted ring-1 ring-border"
              )}
            >
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="搜索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">清除搜索</span>
                </button>
              )}
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                暂无聊天记录
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => {
                    onSelectChat(chat.id);
                    onMobileClose?.();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    "border-b border-border/50",
                    selectedChatId === chat.id
                      ? "bg-muted"
                      : "hover:bg-muted/50 active:bg-muted/70"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11">
                      <AvatarImage
                        src={chat.avatar || "/placeholder.svg"}
                        alt={chat.name}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                        {chat.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Top row: Name + Timestamp */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground text-sm truncate">
                        {chat.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {chat.timestamp}
                      </span>
                    </div>
                    {/* Bottom row: Last message + Unread badge */}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-[13px] text-muted-foreground truncate leading-snug">
                        {chat.lastMessage}
                      </p>
                      {chat.unread && chat.unread > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-medium">
                          {chat.unread > 99 ? "99+" : chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <ContactsList
          contacts={contacts}
          onStartChat={(contact) => {
            onStartChatWithContact(contact);
            onMobileClose?.();
          }}
        />
      )}
    </aside>
  );
}
