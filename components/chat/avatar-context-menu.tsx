"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { 
  AtSign, 
  User, 
  UserPlus, 
  MessageSquare,
  UserMinus,
  VolumeX
} from "lucide-react";

interface AvatarContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onMention: () => void;
  onViewProfile: () => void;
  onAddFriend: () => void;
  onSendMessage: () => void;
  onKickFromGroup?: () => void;
  onMute?: () => void;
  isGroupChat?: boolean;
  isGroupAdmin?: boolean;
  isFriend?: boolean;
}

export function AvatarContextMenu({
  isOpen,
  position,
  onClose,
  onMention,
  onViewProfile,
  onAddFriend,
  onSendMessage,
  onKickFromGroup,
  onMute,
  isGroupChat = false,
  isGroupAdmin = false,
  isFriend = false,
}: AvatarContextMenuProps) {
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

  const baseMenuItems = [
    { id: "mention", label: "@提及", icon: AtSign, action: onMention },
    { id: "profile", label: "查看资料", icon: User, action: onViewProfile },
    { 
      id: "friend", 
      label: isFriend ? "删除好友" : "添加好友", 
      icon: isFriend ? UserMinus : UserPlus, 
      action: onAddFriend,
      danger: isFriend 
    },
    { id: "message", label: "发送消息", icon: MessageSquare, action: onSendMessage },
  ];

  const adminMenuItems = isGroupChat && isGroupAdmin ? [
    { id: "kick", label: "踢出群聊", icon: UserMinus, action: onKickFromGroup, danger: true },
    { id: "mute", label: "禁言", icon: VolumeX, action: onMute, danger: true },
  ] : [];

  const menuItems = [...baseMenuItems, ...adminMenuItems];

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
      {menuItems.map((item, index) => (
        <div key={item.id}>
          {/* Separator before admin items */}
          {index === baseMenuItems.length && adminMenuItems.length > 0 && (
            <div className="my-1 border-t border-border" />
          )}
          <button
            onClick={() => {
              item.action?.();
              onClose();
            }}
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
        </div>
      ))}
    </div>
  );
}
