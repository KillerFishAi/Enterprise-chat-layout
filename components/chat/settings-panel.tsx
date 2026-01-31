"use client";

import React from "react";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  ChevronRight,
  User,
  Bell,
  Globe,
  LogOut,
  Camera,
  Mail,
  Building2,
  Briefcase,
  Check,
  Pencil,
} from "lucide-react";
import { AvatarPicker } from "./avatar-picker";

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  department: string;
  title: string;
}

interface NotificationSettings {
  messages: boolean;
  mentions: boolean;
  sounds: boolean;
  desktop: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onLogout: () => void;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
}

export function SettingsPanel({
  isOpen,
  onClose,
  user,
  onLogout,
  onUpdateProfile,
}: SettingsPanelProps) {
  const [notifications, setNotifications] = useState<NotificationSettings>({
    messages: true,
    mentions: true,
    sounds: true,
    desktop: false,
  });
  const [language, setLanguage] = useState("zh");
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState(user.avatar);
  
  // Editable fields state
  const [isEditingDepartment, setIsEditingDepartment] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [department, setDepartment] = useState(user.department);
  const [title, setTitle] = useState(user.title);

  const handleNotificationChange = (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));
  };

  const handleAvatarSelect = (avatarUrl: string) => {
    setCurrentAvatar(avatarUrl);
    onUpdateProfile?.({ avatar: avatarUrl });
  };

  const handleSaveDepartment = () => {
    setIsEditingDepartment(false);
    onUpdateProfile?.({ department });
  };

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    onUpdateProfile?.({ title });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 z-40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 w-full max-w-md bg-secondary z-50",
          "transform transition-transform duration-200 ease-in-out",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 h-14 bg-card border-b border-border">
          <h1 className="text-base font-medium text-foreground">设置</h1>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">关闭设置</span>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Profile Section */}
          <section className="bg-card mt-3">
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  个人资料
                </span>
              </div>
            </div>

            {/* Avatar and name */}
            <div className="flex items-center gap-4 px-4 py-4 border-b border-border/50">
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={currentAvatar || "/placeholder.svg"} alt={user.name} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-lg font-medium">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => setIsAvatarPickerOpen(true)}
                  className="absolute bottom-0 right-0 p-1 bg-card rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span className="sr-only">更换头像</span>
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-medium text-foreground truncate">
                  {user.name}
                </h2>
                <p className="text-sm text-muted-foreground truncate">{title}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/50 shrink-0" />
            </div>

            {/* Profile details */}
            <div className="divide-y divide-border/50">
              <ProfileRow icon={Mail} label="邮箱" value={user.email} />
              
              {/* Editable Department */}
              <div className="flex items-center px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">部门</p>
                    {isEditingDepartment ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <Input
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveDepartment}
                          className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDepartment(user.department);
                            setIsEditingDepartment(false);
                          }}
                          className="p-1.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-foreground truncate">{department}</p>
                        <button
                          onClick={() => setIsEditingDepartment(true)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Editable Title */}
              <div className="flex items-center px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">职位</p>
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <Input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveTitle}
                          className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setTitle(user.title);
                            setIsEditingTitle(false);
                          }}
                          className="p-1.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-foreground truncate">{title}</p>
                        <button
                          onClick={() => setIsEditingTitle(true)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section className="bg-card mt-3">
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Bell className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  通知设置
                </span>
              </div>
            </div>

            <div className="divide-y divide-border/50">
              <ToggleRow
                label="消息通知"
                description="接收新消息时发送通知"
                checked={notifications.messages}
                onChange={(v) => handleNotificationChange("messages", v)}
              />
              <ToggleRow
                label="@提醒"
                description="当有人提及你时发送通知"
                checked={notifications.mentions}
                onChange={(v) => handleNotificationChange("mentions", v)}
              />
              <ToggleRow
                label="提示音"
                description="收到通知时播放声音"
                checked={notifications.sounds}
                onChange={(v) => handleNotificationChange("sounds", v)}
              />
              <ToggleRow
                label="桌面通知"
                description="在桌面显示通知弹窗"
                checked={notifications.desktop}
                onChange={(v) => handleNotificationChange("desktop", v)}
              />
            </div>
          </section>

          {/* Language Section */}
          <section className="bg-card mt-3">
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  语言设置
                </span>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    显示语言
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    选择您偏好的语言
                  </p>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[140px] h-9 bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">简体中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh-TW">繁體中文</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                    <SelectItem value="ko">한국어</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Logout Section */}
          <section className="bg-card mt-3 mb-6">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">退出登录</span>
            </button>
          </section>
        </div>

        {/* Footer */}
        <footer className="px-4 py-3 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            企业通讯 v1.0.0
          </p>
        </footer>
      </aside>

      {/* Avatar Picker Modal */}
      <AvatarPicker
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        currentAvatar={currentAvatar}
        onSelectAvatar={handleAvatarSelect}
      />
    </>
  );
}

// Profile row component
function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center px-4 py-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm text-foreground truncate mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Toggle row component
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  );
}
