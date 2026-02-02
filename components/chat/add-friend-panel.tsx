"use client";

import { useState, useEffect } from "react";
import { X, Search, Smartphone, Mail, User, UserPlus, Check, Loader2, UserCheck, UserX, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type SearchMethod = "account" | "phone" | "email";
type PanelTab = "search" | "requests";

interface SearchResult {
  id: string;
  name: string;
  avatar?: string;
  account?: string;
  phone?: string;
  email?: string;
  department?: string;
  title?: string;
  isFriend?: boolean;
  hasRequested?: boolean;
  hasRequestFromTarget?: boolean;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  fromName: string;
  fromDepartment?: string;
  fromTitle?: string;
  createdAt: string;
}

interface AddFriendPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** 接受好友后回调，conversationId 为新创建的私聊会话 id，用于前端刷新列表并打开聊天 */
  onAddFriend: (userId: string, conversationId?: string) => void;
}

export function AddFriendPanel({ isOpen, onClose, onAddFriend }: AddFriendPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("search");
  const [searchMethod, setSearchMethod] = useState<SearchMethod>("account");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  
  // 好友请求相关状态
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // 加载好友请求列表
  const loadFriendRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const res = await fetch("/api/friends/requests");
      if (!res.ok) throw new Error("获取好友请求失败");
      const json = (await res.json()) as { data?: { incoming?: FriendRequest[] } };
      setFriendRequests(json.data?.incoming ?? []);
    } catch (err) {
      console.error(err);
      setFriendRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // 切换到请求标签页时加载请求列表
  useEffect(() => {
    if (isOpen && activeTab === "requests") {
      loadFriendRequests();
    }
  }, [isOpen, activeTab]);

  // 打开面板时也加载一次（用于显示请求数量）
  useEffect(() => {
    if (isOpen) {
      loadFriendRequests();
    }
  }, [isOpen]);

  // 接受好友请求
  const handleAcceptRequest = async (requestId: string) => {
    setProcessingIds((prev) => new Set(prev).add(requestId));
    try {
      const res = await fetch(`/api/friends/requests/${requestId}/accept`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("接受请求失败");
      const json = (await res.json()) as { data?: { id?: string; conversationId?: string } };
      const conversationId = json.data?.conversationId;
      // 移除已处理的请求
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
      const request = friendRequests.find((r) => r.id === requestId);
      if (request) {
        onAddFriend(request.fromUserId, conversationId);
      }
    } catch (err) {
      alert((err as Error).message ?? "操作失败，请稍后重试");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  // 拒绝好友请求
  const handleRejectRequest = async (requestId: string) => {
    setProcessingIds((prev) => new Set(prev).add(requestId));
    try {
      const res = await fetch(`/api/friends/requests/${requestId}/reject`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("拒绝请求失败");
      // 移除已处理的请求
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      alert((err as Error).message ?? "操作失败，请稍后重试");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        method: searchMethod,
        q: searchQuery.trim(),
      });
      const res = await fetch(`/api/users/search?${params.toString()}`);
      if (!res.ok) throw new Error("搜索失败");
      const json = (await res.json()) as { data?: SearchResult[] };
      setSearchResults(json.data ?? []);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (userId: string) => {
    setAddingIds((prev) => new Set(prev).add(userId));
    try {
      const res = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "发送好友请求失败");
      }
      setAddedIds((prev) => new Set(prev).add(userId));
      onAddFriend(userId);
    } catch (err) {
      alert((err as Error).message ?? "发送好友请求失败，请稍后重试");
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setAddingIds(new Set());
    setAddedIds(new Set());
    setActiveTab("search");
    onClose();
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  const getPlaceholder = () => {
    switch (searchMethod) {
      case "phone":
        return "请输入手机号";
      case "email":
        return "请输入邮箱地址";
      default:
        return "请输入账号";
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={handleClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card z-50 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary">
          <h2 className="font-semibold text-foreground text-base">添加好友</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">关闭</span>
          </button>
        </div>

        {/* Main Tabs: Search / Requests */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "search"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Search className="h-4 w-4" />
              搜索用户
            </span>
            {activeTab === "search" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === "requests"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Bell className="h-4 w-4" />
              好友请求
              {friendRequests.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {friendRequests.length}
                </span>
              )}
            </span>
            {activeTab === "requests" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* Search Tab Content */}
        {activeTab === "search" && (
          <>
        {/* Search Method Tabs */}
        <div className="px-4 pt-4">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => {
                setSearchMethod("account");
                setSearchResults([]);
                setHasSearched(false);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                searchMethod === "account"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="h-4 w-4" />
              <span>账号</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchMethod("phone");
                setSearchResults([]);
                setHasSearched(false);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                searchMethod === "phone"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="h-4 w-4" />
              <span>手机号</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchMethod("email");
                setSearchResults([]);
                setHasSearched(false);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors",
                searchMethod === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mail className="h-4 w-4" />
              <span>邮箱</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="px-4 py-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={getPlaceholder()}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className="bg-primary hover:bg-primary/90"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "搜索"}
            </Button>
          </div>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" />
              <p className="text-sm">搜索中...</p>
            </div>
          ) : hasSearched && searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">未找到相关用户</p>
              <p className="text-xs mt-1">请检查输入信息是否正确</p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                找到 {searchResults.length} 个结果
              </p>
              {searchResults.map((result) => {
                const isAdding = addingIds.has(result.id);
                const isAdded =
                  addedIds.has(result.id) ||
                  result.isFriend ||
                  result.hasRequested ||
                  result.hasRequestFromTarget;

                return (
                  <div
                    key={result.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={result.avatar || "/placeholder.svg"} alt={result.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {result.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{result.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.account && `账号: ${result.account}`}
                        {result.phone && ` 手机: ${result.phone}`}
                        {result.email && ` 邮箱: ${result.email}`}
                      </p>
                      {result.department && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.department} · {result.title}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isAdded ? "secondary" : "default"}
                      disabled={isAdding || isAdded}
                      onClick={() => handleAddFriend(result.id)}
                      className={cn(
                        "min-w-[80px]",
                        isAdded && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : result.isFriend ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          已是好友
                        </>
                      ) : result.hasRequested || addedIds.has(result.id) ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          已申请
                        </>
                      ) : result.hasRequestFromTarget ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          对方向你申请
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" />
                          添加
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserPlus className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">搜索好友</p>
              <p className="text-xs mt-1">通过账号、手机号或邮箱查找好友</p>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            添加好友后，对方需要同意才能成为好友
          </p>
        </div>
          </>
        )}

        {/* Requests Tab Content */}
        {activeTab === "requests" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {isLoadingRequests ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm">加载中...</p>
              </div>
            ) : friendRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">暂无好友请求</p>
                <p className="text-xs mt-1">当有人向你发送好友请求时，会显示在这里</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  {friendRequests.length} 条待处理请求
                </p>
                {friendRequests.map((request) => {
                  const isProcessing = processingIds.has(request.id);
                  return (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {request.fromName.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">
                          {request.fromName}
                        </p>
                        {request.fromDepartment && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {request.fromDepartment} · {request.fromTitle}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(request.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          disabled={isProcessing}
                          onClick={() => handleAcceptRequest(request.id)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-1" />
                              接受
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isProcessing}
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          拒绝
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
