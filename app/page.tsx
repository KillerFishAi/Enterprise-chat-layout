"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useChatStream, generateClientMsgId, type StreamMessage } from "@/hooks/use-chat-stream";
import { useRouter } from "next/navigation";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { GroupSettings, type GroupMember } from "@/components/chat/group-settings";
import { AddGroupMemberDialog } from "@/components/chat/add-group-member-dialog";
import { CreateGroupDialog } from "@/components/chat/create-group-dialog";
import { SearchChatDialog } from "@/components/chat/search-chat-dialog";
import { SettingsPanel } from "@/components/chat/settings-panel";
import { AddFriendPanel } from "@/components/chat/add-friend-panel";
import { UserProfilePopup } from "@/components/chat/user-profile-popup";
import type { Message } from "@/components/chat/message-list";
import type { Contact } from "@/components/chat/contacts-list";
import type { FileAttachment } from "@/components/chat/message-input";

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
    id?: string;
    name: string;
    email?: string;
    department?: string;
    title?: string;
  } | null>(null);
  const [groupMembersByChat, setGroupMembersByChat] = useState<Record<string, GroupMember[]>>({});
  const [isAddGroupMemberOpen, setIsAddGroupMemberOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // ── SeqId 追踪：每个会话的最大已知 seqId ──
  const [seqIdMap, setSeqIdMap] = useState<Record<string, number>>({});

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
              id?: string;
              nickname?: string;
              email?: string;
              department?: string;
              title?: string;
            };
          };
          if (meJson.data) {
            setCurrentUser({
              id: meJson.data.id,
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

  /** 仅刷新会话列表，可选打开指定会话（如接受好友后的新私聊） */
  const loadChats = useCallback(async (conversationIdToSelect?: string) => {
    try {
      const chatsRes = await fetch("/api/chats");
      if (!chatsRes.ok) return;
      const chatsJson = (await chatsRes.json()) as { data?: ChatSummary[] };
      if (Array.isArray(chatsJson.data)) {
        setChats(chatsJson.data);
        if (conversationIdToSelect && chatsJson.data.some((c) => c.id === conversationIdToSelect)) {
          setSelectedChatId(conversationIdToSelect);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 在线状态心跳：每 30 秒上报一次
  useEffect(() => {
    if (!currentUser?.id) return;
    const tick = () => {
      fetch("/api/me/online", { method: "POST" }).catch(() => {});
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // 切换会话时加载消息
  useEffect(() => {
    if (!selectedChatId) return;

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/chats/${selectedChatId}/messages`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: Message[] };
        if (Array.isArray(json.data) && json.data.length > 0) {
          // 按 seqId 排序存储
          const sorted = [...json.data].sort((a, b) => (a.seqId ?? 0) - (b.seqId ?? 0));
          setMessages((prev) => ({
            ...prev,
            [selectedChatId]: sorted,
          }));

          // 更新 seqId 追踪
          const maxSeq = Math.max(...sorted.map((m) => m.seqId ?? 0));
          if (maxSeq > 0) {
            setSeqIdMap((prev) => ({
              ...prev,
              [selectedChatId]: Math.max(prev[selectedChatId] ?? 0, maxSeq),
            }));
          }

          const ids = json.data!.map((m) => m.id);
          await fetch(`/api/chats/${selectedChatId}/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: ids }),
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    void loadMessages();
  }, [selectedChatId]);

  // ── 实时消息处理：seqId 排序 + 去重 + 追踪 ──
  const handleStreamMessage = useCallback((chatId: string, data: Message) => {
    setMessages((prev) => {
      const list = prev[chatId] ?? [];

      // 基于 id 和 clientMsgId 双重去重
      if (list.some((m) => m.id === data.id)) return prev;
      if (data.clientMsgId && list.some((m) => m.clientMsgId === data.clientMsgId)) {
        // clientMsgId 匹配到临时消息 → 用服务器版本替换
        const updated = list.map((m) =>
          m.clientMsgId === data.clientMsgId ? { ...data } : m
        );
        return { ...prev, [chatId]: updated };
      }

      // 按 seqId 插入到正确位置（而非简单追加）
      const newList = [...list, data];
      if (data.seqId) {
        newList.sort((a, b) => (a.seqId ?? 0) - (b.seqId ?? 0));
      }

      return { ...prev, [chatId]: newList };
    });

    // 更新 seqId 追踪
    if (data.seqId) {
      setSeqIdMap((prev) => ({
        ...prev,
        [chatId]: Math.max(prev[chatId] ?? 0, data.seqId!),
      }));
    }
  }, []);

  // 订阅所有已加载会话的实时消息
  const chatIds = useMemo(() => chats.map((c) => c.id), [chats]);
  const { manualSync } = useChatStream(chatIds, handleStreamMessage, { seqIdMap });

  // 打开群设置时加载群成员
  useEffect(() => {
    if (!selectedChatId || !isGroupSettingsOpen) return;
    const chat = chats.find((c) => c.id === selectedChatId);
    if (!chat?.isGroup) return;
    const loadMembers = async () => {
      try {
        const res = await fetch(`/api/chats/groups/${selectedChatId}/members`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: GroupMember[] };
        if (Array.isArray(json.data)) {
          setGroupMembersByChat((prev) => ({ ...prev, [selectedChatId]: json.data! }));
        }
      } catch (err) {
        console.error(err);
      }
    };
    void loadMembers();
  }, [selectedChatId, isGroupSettingsOpen, chats]);

  const selectedChat = selectedChatId
    ? chats.find((chat) => chat.id === selectedChatId) ?? null
    : null;

  const currentMessages = selectedChatId ? messages[selectedChatId] ?? [] : [];

  /**
   * 上传单个文件到服务器
   */
  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: string } | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error("文件上传失败");
        return null;
      }

      const json = (await res.json()) as { url: string; name: string; size: string };
      return json;
    } catch (err) {
      console.error("上传文件出错:", err);
      return null;
    }
  };

  /**
   * 根据文件类型获取消息类型
   */
  const getMessageType = (attachmentType: FileAttachment["type"]): "IMAGE" | "VIDEO" | "FILE" => {
    switch (attachmentType) {
      case "image":
        return "IMAGE";
      case "video":
        return "VIDEO";
      default:
        return "FILE";
    }
  };

  /**
   * 发送单条消息到服务器（带 clientMsgId 幂等 key）
   */
  const sendMessageToServer = async (payload: {
    content?: string;
    type?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    replyToMessageId?: string;
    clientMsgId?: string;
  }): Promise<Message | null> => {
    if (!selectedChatId) return null;

    // 自动生成 clientMsgId（如果未提供）
    const msgPayload = {
      ...payload,
      clientMsgId: payload.clientMsgId || generateClientMsgId(),
    };

    try {
      const res = await fetch(`/api/chats/${selectedChatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(msgPayload),
      });

      if (!res.ok) {
        console.error("发送消息失败");
        return null;
      }

      const json = (await res.json()) as { data?: Message };
      return json.data ?? null;
    } catch (err) {
      console.error("发送消息出错:", err);
      return null;
    }
  };

  /**
   * 本地添加消息（乐观更新，seqId 排序插入）
   */
  const addMessageLocally = useCallback((chatId: string, message: Message) => {
    setMessages((prev) => {
      const list = prev[chatId] ?? [];

      // 基于 id 去重
      if (list.some((m) => m.id === message.id)) return prev;

      // 如果有 clientMsgId，替换同 clientMsgId 的临时消息
      if (message.clientMsgId) {
        const tempIdx = list.findIndex((m) => m.clientMsgId === message.clientMsgId);
        if (tempIdx >= 0) {
          const updated = [...list];
          updated[tempIdx] = message;
          return { ...prev, [chatId]: updated };
        }
      }

      // 插入并按 seqId 排序
      const newList = [...list, message];
      if (message.seqId) {
        newList.sort((a, b) => (a.seqId ?? 0) - (b.seqId ?? 0));
      }
      return { ...prev, [chatId]: newList };
    });

    // 更新 seqId 追踪
    if (message.seqId) {
      setSeqIdMap((prevMap) => ({
        ...prevMap,
        [chatId]: Math.max(prevMap[chatId] ?? 0, message.seqId!),
      }));
    }
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, attachments?: FileAttachment[], replyToMessageId?: string) => {
      if (!selectedChatId) return;

      // 情况1: 纯文本消息（无附件）
      if (!attachments || attachments.length === 0) {
        if (!content.trim()) return;

        const clientMsgId = generateClientMsgId();
        const newMessage = await sendMessageToServer({
          content,
          type: "TEXT",
          replyToMessageId,
          clientMsgId,
        });
        if (newMessage) {
          addMessageLocally(selectedChatId, newMessage);
        }
        return;
      }

      // 情况2: 有附件的消息，需要先上传文件再发送消息
      let firstAttachment = true;
      for (const attachment of attachments) {
        const replyIdForThis = firstAttachment ? replyToMessageId : undefined;
        firstAttachment = false;
        // 生成 clientMsgId 用于幂等去重和临时消息关联
        const clientMsgId = generateClientMsgId();
        const tempId = `temp-${clientMsgId}`;
        const messageType = getMessageType(attachment.type);

        // 构造临时消息用于乐观更新（立即显示）
        const tempMessage: Message = {
          id: tempId,
          clientMsgId,
          content: content || "",
          timestamp: new Date().toISOString(),
          senderId: "current",
          senderName: currentUser?.name ?? "我",
          isOwn: true,
          status: "sending",
          type: attachment.type,
          // 根据类型设置对应的 URL 字段
          ...(attachment.type === "image" && { imageUrl: attachment.url }),
          ...(attachment.type === "video" && { videoUrl: attachment.url }),
          ...(attachment.type === "file" && { 
            fileName: attachment.name, 
            fileSize: attachment.size 
          }),
          fileUrl: attachment.url,
          fileName: attachment.name,
          fileSize: attachment.size,
        };

        // 乐观更新：立即显示消息
        addMessageLocally(selectedChatId, tempMessage);

        // 上传文件
        if (attachment.file) {
          const uploadResult = await uploadFile(attachment.file);
          
          if (!uploadResult) {
            // 上传失败，更新消息状态
            setMessages((prev) => {
              const list = prev[selectedChatId] ?? [];
              return {
                ...prev,
                [selectedChatId]: list.map((m) =>
                  m.id === tempId ? { ...m, status: "failed" as const } : m
                ),
              };
            });
            continue;
          }

          // 发送消息到服务器（携带 clientMsgId 保证幂等）
          const serverMessage = await sendMessageToServer({
            content: content || "",
            type: messageType,
            fileUrl: uploadResult.url,
            fileName: uploadResult.name,
            fileSize: uploadResult.size,
            replyToMessageId: replyIdForThis,
            clientMsgId,
          });

          if (serverMessage) {
            // 用服务器返回的消息替换临时消息
            setMessages((prev) => {
              const list = prev[selectedChatId] ?? [];
              // 移除临时消息（通过 clientMsgId 或 tempId 匹配）
              const filtered = list.filter(
                (m) => m.id !== tempId && m.clientMsgId !== clientMsgId
              );
              // 检查是否已经存在（WebSocket 可能已经推送）
              if (filtered.some((m) => m.id === serverMessage.id)) {
                return { ...prev, [selectedChatId]: filtered };
              }
              const newList = [...filtered, serverMessage];
              if (serverMessage.seqId) {
                newList.sort((a, b) => (a.seqId ?? 0) - (b.seqId ?? 0));
              }
              return { ...prev, [selectedChatId]: newList };
            });
          }
        }

        // 只有第一个附件携带文本内容
        content = "";
      }
    },
    [selectedChatId, currentUser, addMessageLocally]
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

  const handleAddFriend = useCallback(
    async (userId: string, conversationId?: string) => {
      setFriendsList((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      await loadChats(conversationId);
      setIsAddFriendOpen(false);
    },
    [loadChats]
  );

  const handleCreateGroupSuccess = useCallback(
    async (groupId: string) => {
      await loadChats(groupId);
      setIsCreateGroupOpen(false);
    },
    [loadChats]
  );

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

  const loadGroupMembers = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/groups/${chatId}/members`);
      if (!res.ok) return;
      const json = (await res.json()) as { data?: GroupMember[] };
      if (Array.isArray(json.data)) {
        setGroupMembersByChat((prev) => ({ ...prev, [chatId]: json.data! }));
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleAddGroupMember = useCallback(() => {
    setIsAddGroupMemberOpen(true);
  }, []);

  const handleRemoveGroupMember = useCallback(
    async (memberId: string) => {
      if (!selectedChatId) return;
      try {
        const res = await fetch(
          `/api/chats/groups/${selectedChatId}/members/${memberId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string };
          alert(data?.error ?? "移除失败");
          return;
        }
        await loadGroupMembers(selectedChatId);
      } catch (err) {
        console.error(err);
        alert("移除失败");
      }
    },
    [selectedChatId, loadGroupMembers]
  );

  const handleLeaveGroup = useCallback(async () => {
    if (!selectedChatId) return;
    if (!confirm("确定要退出该群聊吗？")) return;
    try {
      const res = await fetch(`/api/chats/groups/${selectedChatId}/leave`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string };
        alert(data?.error ?? "退出失败");
        return;
      }
      setChats((prev) => prev.filter((c) => c.id !== selectedChatId));
      setSelectedChatId((prev) => (prev === selectedChatId ? null : prev));
      setIsGroupSettingsOpen(false);
      setMessages((prev) => {
        const next = { ...prev };
        delete next[selectedChatId];
        return next;
      });
    } catch (err) {
      console.error(err);
      alert("退出失败");
    }
  }, [selectedChatId]);

  const handleEditGroupName = useCallback(async () => {
    if (!selectedChatId || !selectedChat) return;
    const name = prompt("新群名称", selectedChat.name);
    if (name === null || !name.trim()) return;
    try {
      const res = await fetch(`/api/chats/groups/${selectedChatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string };
        alert(data?.error ?? "修改失败");
        return;
      }
      setChats((prev) =>
        prev.map((c) =>
          c.id === selectedChatId ? { ...c, name: name.trim() } : c
        )
      );
    } catch (err) {
      console.error(err);
      alert("修改失败");
    }
  }, [selectedChatId, selectedChat]);

  const handleKickFromGroup = useCallback((userId: string) => {
    handleRemoveGroupMember(userId);
    setSelectedUserForProfile(null);
  }, [handleRemoveGroupMember]);

  const handleMuteUser = useCallback((userId: string) => {
    setSelectedUserForProfile(null);
  }, []);

  const currentGroupMembers: GroupMember[] = selectedChatId
    ? groupMembersByChat[selectedChatId] ?? []
    : [];
  const isCurrentUserAdmin = currentUser?.id
    ? currentGroupMembers.some(
        (m) => m.id === currentUser.id && m.role === "admin"
      )
    : false;

  const handleReplyMessage = useCallback((message: Message) => {
    setReplyingTo({
      id: message.id,
      content: message.content ?? "",
      senderName: message.senderName ?? "未知",
    });
  }, []);

  const handleDeleteMessage = useCallback(
    async (message: Message) => {
      if (!selectedChatId) return;
      if (!message.isOwn) return;
      try {
        const res = await fetch(
          `/api/chats/${selectedChatId}/messages/${message.id}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string };
          alert(data?.error ?? "撤回失败");
          return;
        }
        setMessages((prev) => {
          const list = prev[selectedChatId] ?? [];
          return {
            ...prev,
            [selectedChatId]: list.map((m) =>
              m.id === message.id
                ? { ...m, content: "[已撤回]", type: "text", revoked: true }
                : m
            ),
          };
        });
      } catch (err) {
        console.error(err);
        alert("撤回失败");
      }
    },
    [selectedChatId]
  );

  const handleForwardMessage = useCallback(
    async (message: Message) => {
      const targetChat = chats.find((c) => c.id !== selectedChatId && !c.isGroup);
      if (!targetChat) {
        alert("暂无可转发的会话");
        return;
      }
      try {
        const payload: {
          content: string;
          type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
          fileUrl?: string;
          fileName?: string;
          fileSize?: string;
        } = {
          content: message.content ?? "",
          type: (message.type?.toUpperCase() as "TEXT" | "IMAGE" | "VIDEO" | "FILE") || "TEXT",
        };
        if (message.fileUrl) {
          payload.fileUrl = message.fileUrl;
          payload.fileName = message.fileName;
          payload.fileSize = message.fileSize;
        }
        const res = await fetch(`/api/chats/${targetChat.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string };
          alert(data?.error ?? "转发失败");
          return;
        }
        const json = (await res.json()) as { data?: Message };
        if (json.data) {
          addMessageLocally(targetChat.id, json.data);
        }
      } catch (err) {
        console.error(err);
        alert("转发失败");
      }
    },
    [chats, selectedChatId, addMessageLocally]
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
        chats={chats.map((c) => ({
          ...c,
          lastMessage: c.lastMessage ?? "",
          timestamp: c.timestamp ?? "",
        }))}
        contacts={contacts}
        selectedChatId={selectedChatId}
        onSelectChat={handleSelectChat}
        onStartChatWithContact={handleStartChatWithContact}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onSettingsClick={toggleAppSettings}
        onAddFriendClick={toggleAddFriend}
        onCreateGroupClick={() => setIsCreateGroupOpen(true)}
      />

      {/* Chat Area */}
      <ChatArea
        selectedChat={selectedChat}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
        onMobileMenuClick={toggleMobileSidebar}
        onSettingsClick={selectedChat?.isGroup ? toggleGroupSettings : undefined}
        onAvatarClick={handleAvatarClick}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onReplyMessage={handleReplyMessage}
        onDeleteMessage={handleDeleteMessage}
        onForwardMessage={handleForwardMessage}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      {/* Group Settings Panel */}
      {selectedChat?.isGroup && (
        <GroupSettings
          isOpen={isGroupSettingsOpen}
          onClose={() => setIsGroupSettingsOpen(false)}
          groupName={selectedChat.name}
          groupAvatar={undefined}
          members={currentGroupMembers}
          isAdmin={isCurrentUserAdmin}
          onAddMember={handleAddGroupMember}
          onRemoveMember={handleRemoveGroupMember}
          onLeaveGroup={handleLeaveGroup}
          onEditGroupName={handleEditGroupName}
        />
      )}

      {/* Create Group Dialog */}
      {isCreateGroupOpen && (
        <CreateGroupDialog
          contacts={contacts}
          onClose={() => setIsCreateGroupOpen(false)}
          onCreated={handleCreateGroupSuccess}
        />
      )}

      {/* Add Group Member Dialog */}
      {isAddGroupMemberOpen && selectedChatId && (
        <AddGroupMemberDialog
          chatId={selectedChatId}
          currentMembers={currentGroupMembers}
          contacts={contacts}
          onClose={() => setIsAddGroupMemberOpen(false)}
          onAdded={() => {
            loadGroupMembers(selectedChatId);
            setIsAddGroupMemberOpen(false);
          }}
        />
      )}

      {/* App Settings Panel - 仅在有当前用户时渲染，避免构建时 prerender 报错 */}
      {currentUser && (
        <SettingsPanel
          isOpen={isAppSettingsOpen}
          onClose={() => setIsAppSettingsOpen(false)}
          user={{
            name: currentUser.name,
            email: currentUser.email ?? "",
            department: currentUser.department ?? "",
            title: currentUser.title ?? "",
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Add Friend Panel */}
      <AddFriendPanel
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        onAddFriend={handleAddFriend}
      />

      {/* Search Chat Dialog */}
      <SearchChatDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        conversationId={selectedChatId}
        onSelectResult={(convId) => {
          setSelectedChatId(convId);
          setIsSearchOpen(false);
        }}
      />

      {/* User Profile Popup */}
      {selectedUserForProfile && (
        <UserProfilePopup
          isOpen={!!selectedUserForProfile}
          onClose={() => setSelectedUserForProfile(null)}
          user={{
            id: selectedUserForProfile.id,
            name: selectedUserForProfile.name,
            title: selectedUserForProfile.title,
            department: selectedUserForProfile.department,
            isFriend: selectedUserForProfile.isFriend,
          }}
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
