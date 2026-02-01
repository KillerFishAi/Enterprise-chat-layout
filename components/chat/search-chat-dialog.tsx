"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

type SearchResult = {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  senderName: string;
  conversationId: string;
  conversationName: string;
  isGroup: boolean;
};

interface SearchChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string | null;
  onSelectResult: (conversationId: string) => void;
}

export function SearchChatDialog({
  isOpen,
  onClose,
  conversationId,
  onSelectResult,
}: SearchChatDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "30" });
      if (conversationId) params.set("conversationId", conversationId);
      const res = await fetch(`/api/chats/search?${params.toString()}`);
      if (!res.ok) throw new Error("搜索失败");
      const json = (await res.json()) as { data?: SearchResult[] };
      setResults(json.data ?? []);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (convId: string) => {
    onSelectResult(convId);
    onClose();
    setQuery("");
    setResults([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>搜索聊天记录</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 py-2">
          <Input
            placeholder="输入关键词..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={!query.trim() || isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="sr-only">搜索</span>
          </Button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-2">
          {results.length === 0 && !isSearching && query.trim() && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              未找到相关消息
            </p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r.conversationId)}
              className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
            >
              <p className="text-xs text-muted-foreground mb-0.5">
                {r.conversationName}
                {r.isGroup ? ` · ${r.senderName}` : ""}
              </p>
              <p className="text-sm text-foreground line-clamp-2">{r.content}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(r.createdAt).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
