"use client";

import React from "react"

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// Default avatar options
const defaultAvatars = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bailey",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Cali",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Dusty",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Eliza",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Frank",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Grace",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Henry",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Ivy",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jack",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Kate",
];

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar?: string;
  onSelectAvatar: (avatarUrl: string) => void;
}

export function AvatarPicker({
  isOpen,
  onClose,
  currentAvatar,
  onSelectAvatar,
}: AvatarPickerProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(
    currentAvatar || null
  );
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith("image/")) {
        return;
      }
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setCustomAvatar(dataUrl);
        setSelectedAvatar(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = () => {
    if (selectedAvatar) {
      onSelectAvatar(selectedAvatar);
      onClose();
    }
  };

  if (!isOpen) return null;

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
          className="w-full max-w-md bg-card rounded-lg shadow-xl animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-base font-medium text-foreground">选择头像</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Upload Custom Avatar */}
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-muted/50 transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  上传自定义头像
                </span>
              </button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                支持 JPG、PNG 格式，最大 5MB
              </p>
            </div>

            {/* Custom Avatar Preview */}
            {customAvatar && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">已上传</p>
                <button
                  onClick={() => setSelectedAvatar(customAvatar)}
                  className={cn(
                    "relative w-16 h-16 rounded-full overflow-hidden border-2 transition-colors",
                    selectedAvatar === customAvatar
                      ? "border-primary"
                      : "border-transparent hover:border-primary/50"
                  )}
                >
                  <Avatar className="w-full h-full">
                    <AvatarImage src={customAvatar || "/placeholder.svg"} alt="Custom avatar" />
                    <AvatarFallback>自定义</AvatarFallback>
                  </Avatar>
                  {selectedAvatar === customAvatar && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="h-6 w-6 text-primary" />
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* Default Avatars */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">默认头像</p>
              <div className="grid grid-cols-6 gap-2">
                {defaultAvatars.map((avatar, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={cn(
                      "relative w-12 h-12 rounded-full overflow-hidden border-2 transition-colors",
                      selectedAvatar === avatar
                        ? "border-primary"
                        : "border-transparent hover:border-primary/50"
                    )}
                  >
                    <Avatar className="w-full h-full">
                      <AvatarImage src={avatar || "/placeholder.svg"} alt={`Avatar ${index + 1}`} />
                      <AvatarFallback>{index + 1}</AvatarFallback>
                    </Avatar>
                    {selectedAvatar === avatar && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <Button
              variant="outline"
              onClick={onClose}
              className="px-4 bg-transparent"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedAvatar}
              className="px-4 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              确认
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
