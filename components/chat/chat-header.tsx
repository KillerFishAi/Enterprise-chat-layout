"use client";

import { Button } from "@/components/ui/button";
import { Menu, MoreHorizontal, Search } from "lucide-react";

interface ChatHeaderProps {
  name: string;
  isGroup?: boolean;
  memberCount?: number;
  onMobileMenuClick?: () => void;
  onSettingsClick?: () => void;
  onSearchClick?: () => void;
}

export function ChatHeader({
  name,
  isGroup,
  memberCount,
  onMobileMenuClick,
  onSettingsClick,
  onSearchClick,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground h-8 w-8"
          onClick={onMobileMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开菜单</span>
        </Button>
        <button
          onClick={onSettingsClick}
          className="text-left hover:opacity-80 transition-opacity"
        >
          <h2 className="font-medium text-foreground text-sm">{name}</h2>
          {isGroup && memberCount && (
            <p className="text-xs text-muted-foreground">
              {memberCount} 位成员
            </p>
          )}
        </button>
      </div>

      <div className="flex items-center gap-1">
        {onSearchClick && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8"
            onClick={onSearchClick}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">搜索聊天记录</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8"
          onClick={onSettingsClick}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">更多选项</span>
        </Button>
      </div>
    </header>
  );
}
