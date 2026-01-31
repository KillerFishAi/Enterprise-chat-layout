"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  X,
  UserPlus,
  UserMinus,
  MessageSquare,
  Ban,
  VolumeX,
  Building2,
  Briefcase,
} from "lucide-react";

export interface UserProfileInfo {
  id: string;
  name: string;
  avatar?: string;
  title?: string;
  department?: string;
  email?: string;
  isFriend?: boolean;
  isOnline?: boolean;
}

interface UserProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfileInfo | null;
  isGroupChat?: boolean;
  isAdmin?: boolean;
  onAddFriend?: (userId: string) => void;
  onRemoveFriend?: (userId: string) => void;
  onStartChat?: (userId: string) => void;
  onKickFromGroup?: (userId: string) => void;
  onMuteUser?: (userId: string) => void;
}

export function UserProfilePopup({
  isOpen,
  onClose,
  user,
  isGroupChat = false,
  isAdmin = false,
  onAddFriend,
  onRemoveFriend,
  onStartChat,
  onKickFromGroup,
  onMuteUser,
}: UserProfilePopupProps) {
  if (!isOpen || !user) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/40 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-sm bg-card rounded-lg shadow-xl animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-end px-3 py-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="px-6 pb-4 text-center">
            {/* Avatar */}
            <div className="relative inline-block mb-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xl font-medium">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              {user.isOnline && (
                <span className="absolute bottom-1 right-1 w-4 h-4 bg-success rounded-full border-2 border-card" />
              )}
            </div>

            {/* Name */}
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {user.name}
            </h3>

            {/* Title & Department */}
            <div className="space-y-1 mb-4">
              {user.title && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{user.title}</span>
                </div>
              )}
              {user.department && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{user.department}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {/* Start Chat Button */}
              <Button
                onClick={() => onStartChat?.(user.id)}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                发消息
              </Button>

              {/* Add/Remove Friend */}
              {user.isFriend ? (
                <Button
                  variant="outline"
                  onClick={() => onRemoveFriend?.(user.id)}
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  删除好友
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => onAddFriend?.(user.id)}
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  添加好友
                </Button>
              )}

              {/* Group Chat Admin Actions */}
              {isGroupChat && isAdmin && (
                <>
                  <div className="pt-2 border-t border-border mt-2" />
                  <p className="text-xs text-muted-foreground mb-2">群管理操作</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onMuteUser?.(user.id)}
                      className="flex-1 text-warning border-warning/30 hover:bg-warning/10"
                    >
                      <VolumeX className="h-4 w-4 mr-1.5" />
                      禁言
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onKickFromGroup?.(user.id)}
                      className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <Ban className="h-4 w-4 mr-1.5" />
                      踢出群聊
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
