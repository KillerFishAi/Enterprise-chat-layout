"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Plus, ChevronRight, LogOut, UserMinus, Edit2 } from "lucide-react";

export interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
  role?: "admin" | "member";
  status?: string;
}

interface GroupSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  groupAvatar?: string;
  members: GroupMember[];
  isAdmin?: boolean;
  onAddMember?: () => void;
  onRemoveMember?: (memberId: string) => void;
  onLeaveGroup?: () => void;
  onEditGroupName?: () => void;
}

export function GroupSettings({
  isOpen,
  onClose,
  groupName,
  groupAvatar,
  members,
  isAdmin = false,
  onAddMember,
  onRemoveMember,
  onLeaveGroup,
  onEditGroupName,
}: GroupSettingsProps) {
  const [showAllMembers, setShowAllMembers] = useState(false);
  const displayedMembers = showAllMembers ? members : members.slice(0, 8);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 bottom-0 w-full max-w-[320px] bg-secondary z-50",
          "flex flex-col shadow-lg",
          "animate-in slide-in-from-right duration-200"
        )}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 h-14 bg-card border-b border-border">
          <h2 className="font-medium text-[15px] text-foreground">群聊信息</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">关闭</span>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Group Info Section */}
          <section className="bg-card px-4 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 rounded">
                <AvatarImage src={groupAvatar || "/placeholder.svg"} alt={groupName} />
                <AvatarFallback className="bg-muted text-muted-foreground text-lg font-medium rounded">
                  {groupName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[16px] text-foreground truncate">
                    {groupName}
                  </h3>
                  {isAdmin && (
                    <button
                      onClick={onEditGroupName}
                      className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span className="sr-only">编辑群名称</span>
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {members.length} 位成员
                </p>
              </div>
            </div>
          </section>

          {/* Members Section */}
          <section className="bg-card mt-2 border-y border-border">
            <div className="px-4 py-3 border-b border-border/50">
              <h4 className="text-[13px] text-muted-foreground font-medium">
                群成员 ({members.length})
              </h4>
            </div>

            {/* Add Member Button */}
            {isAdmin && (
              <button
                onClick={onAddMember}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50"
              >
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[14px] text-primary font-medium">
                  添加成员
                </span>
              </button>
            )}

            {/* Member List */}
            <div>
              {displayedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors group"
                >
                  <Avatar className="h-10 w-10 rounded">
                    <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium rounded">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-foreground truncate">
                        {member.name}
                      </span>
                      {member.role === "admin" && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium text-primary bg-accent rounded">
                          管理员
                        </span>
                      )}
                    </div>
                    {member.status && (
                      <p className="text-[12px] text-muted-foreground truncate">
                        {member.status}
                      </p>
                    )}
                  </div>
                  {isAdmin && member.role !== "admin" && (
                    <button
                      onClick={() => onRemoveMember?.(member.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <UserMinus className="h-4 w-4" />
                      <span className="sr-only">移除成员</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Show More Button */}
            {members.length > 8 && (
              <button
                onClick={() => setShowAllMembers(!showAllMembers)}
                className="w-full flex items-center justify-center gap-1 px-4 py-3 text-[13px] text-primary hover:bg-muted/50 transition-colors border-t border-border/50"
              >
                {showAllMembers ? "收起" : `查看全部 ${members.length} 位成员`}
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    showAllMembers && "rotate-90"
                  )}
                />
              </button>
            )}
          </section>

          {/* Actions Section */}
          <section className="bg-card mt-2 border-y border-border">
            <button
              onClick={onLeaveGroup}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-destructive/5 transition-colors text-destructive"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-[14px] font-medium">退出群聊</span>
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
