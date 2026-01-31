"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { GroupSettings, type GroupMember } from "@/components/chat/group-settings";
import { SettingsPanel } from "@/components/chat/settings-panel";
import { AddFriendPanel } from "@/components/chat/add-friend-panel";
import { UserProfilePopup } from "@/components/chat/user-profile-popup";
import type { Message } from "@/components/chat/message-list";
import type { Contact } from "@/components/chat/contacts-list";

type ChatSummary = {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  isGroup?: boolean;
  memberCount?: number;
  online?: boolean;
  status?: string;
};

const mockGroupMembers: Record<string, GroupMember[]> = {
  "1": [
    { id: "u1", name: "张明", role: "admin", status: "产品经理" },
    { id: "u2", name: "陈晓", role: "member", status: "设计师" },
    { id: "u3", name: "李伟", role: "member", status: "开发工程师" },
    { id: "u4", name: "王芳", role: "member", status: "市场主管" },
    { id: "u5", name: "刘强", role: "member", status: "开发工程师" },
    { id: "u6", name: "赵敏", role: "member", status: "测试工程师" },
    { id: "u7", name: "孙磊", role: "member", status: "运维工程师" },
    { id: "u8", name: "许萍", role: "member", status: "数据分析师" },
  ],
  "4": [
    { id: "u1", name: "张明", role: "admin", status: "技术负责人" },
    { id: "u3", name: "李伟", role: "member", status: "高级开发" },
    { id: "u5", name: "刘强", role: "member", status: "开发工程师" },
    { id: "u6", name: "赵敏", role: "member", status: "测试工程师" },
    { id: "u7", name: "孙磊", role: "member", status: "运维工程师" },
    { id: "u9", name: "徐超", role: "member", status: "后端开发" },
    { id: "u10", name: "韩雪", role: "member", status: "前端开发" },
    { id: "u11", name: "黄伟", role: "member", status: "全栈开发" },
    { id: "u12", name: "郑佳", role: "member", status: "移动端开发" },
    { id: "u13", name: "吴杰", role: "member", status: "平台工程师" },
    { id: "u14", name: "周婷", role: "member", status: "安全工程师" },
    { id: "u15", name: "钱坤", role: "member", status: "运维工程师" },
  ],
  "7": [
    { id: "u1", name: "张明", role: "member", status: "产品部" },
    { id: "u4", name: "王芳", role: "admin", status: "市场主管" },
    { id: "u16", name: "杨蕾", role: "member", status: "内容编辑" },
    { id: "u17", name: "何涛", role: "member", status: "新媒体运营" },
    { id: "u18", name: "林娜", role: "member", status: "品牌设计师" },
  ],
};

export default function ChatPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<{
    id: string;
    name: string;
    title?: string;
    department?: string;
    isFriend: boolean;
  } | null>(null);
  const [friendsList, setFriendsList] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email?: string;
    department?: string;
    title?: string;
  } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 初始加载会话和联系人
  useEffect(() => {
    const loadBaseData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [meRes, chatsRes, contactsRes] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/chats"),
          fetch("/api/contacts"),
        ]);

        if (meRes.ok) {
          const meJson = (await meRes.json()) as {
            data?: {
              nickname?: string;
              email?: string;
              department?: string;
              title?: string;
            };
          };
          if (meJson.data) {
            setCurrentUser({
              name: meJson.data.nickname ?? "未命名用户",
              email: meJson.data.email,
              department: meJson.data.department,
              title: meJson.data.title,
            });
          }
        } else if (meRes.status === 401) {
          router.push("/login");
          return;
        }

        if (chatsRes.ok) {
          const chatsJson = (await chatsRes.json()) as { data?: ChatSummary[] };
          if (Array.isArray(chatsJson.data)) {
            setChats(chatsJson.data);
            setSelectedChatId((prev) => {
              if (!chatsJson.data!.length) return null;
              const exists = prev && chatsJson.data!.some((c) => c.id === prev);
              return exists ? prev : chatsJson.data![0]!.id;
            });
          }
        }

        if (contactsRes.ok) {
          const contactsJson = (await contactsRes.json()) as { data?: Contact[] };
          if (Array.isArray(contactsJson.data)) {
            setContacts(contactsJson.data);
            setFriendsList(contactsJson.data.map((c) => c.id));
          }
        }
      } catch (err) {
        console.error(err);
        setError("加载会话数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    void loadBaseData();
  }, [router]);

  // 切换会话时加载消息
  useEffect(() => {
    if (!selectedChatId) return;

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/chats/${selectedChatId}/messages`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: Message[] };
        if (Array.isArray(json.data)) {
          setMessages((prev) => ({
            ...prev,
            [selectedChatId]: json.data!,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    };

    void loadMessages();

    // 建立 SSE 连接，实时接收新消息
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource(`/api/chats/${selectedChatId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Message;
        setMessages((prev) => {
          const list = prev[selectedChatId] ?? [];
          if (list.some((m) => m.id === data.id)) {
            return prev;
          }
          return {
            ...prev,
            [selectedChatId]: [...list, data],
          };
        });
      } catch (err) {
        console.error("解析实时消息失败", err);
      }
    };

    es.onerror = (err) => {
      console.error("SSE 连接错误", err);
      es.close();
    };

    return () => {
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };
  }, [selectedChatId]);

  const selectedChat = selectedChatId
    ? chats.find((chat) => chat.id === selectedChatId) ?? null
    : null;

  const currentMessages = selectedChatId ? messages[selectedChatId] ?? [] : [];

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedChatId) return;

      try {
        const res = await fetch(`/api/chats/${selectedChatId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        });

        if (!res.ok) {
          console.error("发送消息失败");
          return;
        }

        const json = (await res.json()) as { data?: Message };
        if (!json.data) return;

        const newMessage = json.data;

        // 本地立即插入一条，提升体验；SSE 到来时会通过 id 去重
        setMessages((prev) => {
          const list = prev[selectedChatId] ?? [];
          if (list.some((m) => m.id === newMessage.id)) {
            return prev;
          }
          return {
            ...prev,
            [selectedChatId]: [...list, newMessage],
          };
        });
      } catch (err) {
        console.error(err);
      }
    },
    [selectedChatId]
  );

  const handleSelectChat = useCallback((id: string) => {
    setSelectedChatId(id);
  }, []);

  const handleStartChatWithContact = useCallback((contact: Contact) => {
    const existingChat = chats.find(
      (chat) => !chat.isGroup && chat.name === contact.name
    );
    if (existingChat) {
      setSelectedChatId(existingChat.id);
    } else {
      const matchingChat = chats.find((chat) =>
        chat.name.toLowerCase().includes(contact.name.split(" ")[0].toLowerCase())
      );
      if (matchingChat) {
        setSelectedChatId(matchingChat.id);
      }
    }
  }, [chats]);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  const toggleGroupSettings = useCallback(() => {
    setIsGroupSettingsOpen((prev) => !prev);
  }, []);

  const toggleAppSettings = useCallback(() => {
    setIsAppSettingsOpen((prev) => !prev);
  }, []);

  const toggleAddFriend = useCallback(() => {
    setIsAddFriendOpen((prev) => !prev);
  }, []);

  const handleAddFriend = useCallback((userId: string) => {
    // Handle add friend logic
  }, []);

  const handleLogout = useCallback(async () => {
    // 清理 token：通过设置过期 cookie
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  }, [router]);

  const handleAvatarClick = useCallback(
    (senderId: string, senderName: string) => {
      if (senderId === "current") return; // Don't show profile for self

      // Find user info from contacts or group members
      const contact = contacts.find((c) => c.name === senderName || c.id === senderId);
      const isFriend = contact ? friendsList.includes(contact.id) : false;

      setSelectedUserForProfile({
        id: senderId,
        name: senderName,
        title: contact?.title,
        department: contact?.department,
        isFriend,
      });
    },
    [contacts, friendsList]
  );

  const handleAddFriendFromProfile = useCallback((userId: string) => {
    setFriendsList((prev) => [...prev, userId]);
    setSelectedUserForProfile(null);
  }, []);

  const handleRemoveFriend = useCallback((userId: string) => {
    setFriendsList((prev) => prev.filter((id) => id !== userId));
    setSelectedUserForProfile(null);
  }, []);

  const handleKickFromGroup = useCallback((userId: string) => {
    // Handle kick from group logic
    setSelectedUserForProfile(null);
  }, []);

  const handleMuteUser = useCallback((userId: string) => {
    // Handle mute user logic
    setSelectedUserForProfile(null);
  }, []);

  const currentGroupMembers: GroupMember[] = [];
  const isCurrentUserAdmin = currentGroupMembers.some(
    (m) => m.id === "u1" && m.role === "admin"
  );

  return (
    <main className="h-screen flex overflow-hidden bg-background">
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        contacts={contacts}
        selectedChatId={selectedChatId}
        onSelectChat={handleSelectChat}
        onStartChatWithContact={handleStartChatWithContact}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onSettingsClick={toggleAppSettings}
        onAddFriendClick={toggleAddFriend}
      />

      {/* Chat Area */}
      <ChatArea
        selectedChat={selectedChat}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
        onMobileMenuClick={toggleMobileSidebar}
        onSettingsClick={selectedChat?.isGroup ? toggleGroupSettings : undefined}
        onAvatarClick={handleAvatarClick}
      />

      {/* Group Settings Panel */}
      {selectedChat?.isGroup && (
        <GroupSettings
          isOpen={isGroupSettingsOpen}
          onClose={() => setIsGroupSettingsOpen(false)}
          groupName={selectedChat.name}
          groupAvatar={selectedChat.avatar}
          members={currentGroupMembers}
          isAdmin={isCurrentUserAdmin}
          onAddMember={() => {}}
          onRemoveMember={() => {}}
          onLeaveGroup={() => {}}
          onEditGroupName={() => {}}
        />
      )}

      {/* App Settings Panel */}
      <SettingsPanel
        isOpen={isAppSettingsOpen}
        onClose={() => setIsAppSettingsOpen(false)}
        user={currentUser}
        onLogout={handleLogout}
      />

      {/* Add Friend Panel */}
      <AddFriendPanel
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        onAddFriend={handleAddFriend}
      />

      {/* User Profile Popup */}
      {selectedUserForProfile && (
        <UserProfilePopup
          isOpen={!!selectedUserForProfile}
          onClose={() => setSelectedUserForProfile(null)}
          user={selectedUserForProfile}
          isFriend={selectedUserForProfile.isFriend}
          isGroupChat={selectedChat?.isGroup ?? false}
          onAddFriend={handleAddFriendFromProfile}
          onRemoveFriend={handleRemoveFriend}
          onKickFromGroup={handleKickFromGroup}
          onMuteUser={handleMuteUser}
        />
      )}
    </main>
  );
}
