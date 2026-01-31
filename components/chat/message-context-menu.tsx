"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { 
  Reply, 
  Pin, 
  Copy, 
  Forward, 
  Trash2, 
  CheckSquare 
} from "lucide-react";

interface MessageContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: () => void;
  onPin: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDelete: () => void;
  onSelect: () => void;
  isOwnMessage?: boolean;
}

const menuItems = [
  { id: "reply", label: "回复", icon: Reply },
  { id: "pin", label: "置顶", icon: Pin },
  { id: "copy", label: "拷贝", icon: Copy },
  { id: "forward", label: "转发", icon: Forward },
  { id: "delete", label: "删除", icon: Trash2, danger: true },
  { id: "select", label: "选择", icon: CheckSquare },
];

export function MessageContextMenu({
  isOpen,
  position,
  onClose,
  onReply,
  onPin,
  onCopy,
  onForward,
  onDelete,
  onSelect,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", handleScroll, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case "reply":
        onReply();
        break;
      case "pin":
        onPin();
        break;
      case "copy":
        onCopy();
        break;
      case "forward":
        onForward();
        break;
      case "delete":
        onDelete();
        break;
      case "select":
        onSelect();
        break;
    }
    onClose();
  };

  // Adjust position to keep menu within viewport
  const adjustedPosition = { ...position };
  if (typeof window !== "undefined") {
    const menuWidth = 160;
    const menuHeight = menuItems.length * 40 + 16;
    
    if (position.x + menuWidth > window.innerWidth) {
      adjustedPosition.x = position.x - menuWidth;
    }
    if (position.y + menuHeight > window.innerHeight) {
      adjustedPosition.y = position.y - menuHeight;
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[150px] bg-card border border-border rounded-lg shadow-lg py-2 animate-in fade-in-0 zoom-in-95"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => handleAction(item.id)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors",
            item.danger
              ? "text-destructive hover:bg-destructive/10"
              : "text-foreground hover:bg-muted"
          )}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
