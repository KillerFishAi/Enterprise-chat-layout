"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Smile, Folder, ImageIcon, Scissors, Send, X, Film, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./emoji-picker";

export interface FileAttachment {
  id: string;
  name: string;
  size: string;
  type: "file" | "image" | "video";
  url?: string;
  file?: File;
}

interface ReplyingTo {
  id: string;
  content: string;
  senderName: string;
}

interface MessageInputProps {
  onSendMessage: (content: string, attachments?: FileAttachment[], replyToMessageId?: string) => void;
  disabled?: boolean;
  replyingTo?: ReplyingTo | null;
  onCancelReply?: () => void;
}

export function MessageInput({ onSendMessage, disabled, replyingTo, onCancelReply }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || attachments.length > 0) && !disabled) {
      onSendMessage(
        message.trim(),
        attachments.length > 0 ? attachments : undefined,
        replyingTo?.id
      );
      setMessage("");
      setAttachments([]);
      onCancelReply?.();
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: FileAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newAttachments.push({
        id: `file-${Date.now()}-${i}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: "file",
        file: file,
      });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: FileAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      
      if (isImage || isVideo) {
        const url = URL.createObjectURL(file);
        newAttachments.push({
          id: `media-${Date.now()}-${i}`,
          name: file.name,
          size: formatFileSize(file.size),
          type: isVideo ? "video" : "image",
          url: url,
          file: file,
        });
      }
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment?.url) {
        URL.revokeObjectURL(attachment.url);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-secondary shrink-0">
      {/* Replying to */}
      {replyingTo && (
        <div className="px-4 py-2 flex items-center gap-2 border-t border-border bg-muted/50">
          <span className="text-xs text-muted-foreground shrink-0">回复 {replyingTo.senderName ?? "未知"}:</span>
          <span className="text-xs text-foreground truncate flex-1">{(replyingTo.content ?? "").slice(0, 50)}{(replyingTo.content ?? "").length > 50 ? "…" : ""}</span>
          {onCancelReply && (
            <button type="button" onClick={onCancelReply} className="p-1 rounded hover:bg-muted text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">取消回复</span>
            </button>
          )}
        </div>
      )}
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group bg-card border border-border rounded-lg overflow-hidden"
            >
              {attachment.type === "image" && attachment.url && (
                <div className="w-20 h-20">
                  <img
                    src={attachment.url || "/placeholder.svg"}
                    alt={attachment.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {attachment.type === "video" && attachment.url && (
                <div className="w-20 h-20 bg-muted flex items-center justify-center">
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              {attachment.type === "file" && (
                <div className="w-40 h-14 flex items-center gap-2 px-3">
                  <FileText className="h-6 w-6 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{attachment.name}</p>
                    <p className="text-[10px] text-muted-foreground">{attachment.size}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="absolute top-1 right-1 w-5 h-5 bg-foreground/80 text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-t border-border">
        <div className="relative">
          <ToolbarButton 
            icon={Smile} 
            label="表情" 
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            isActive={isEmojiPickerOpen}
          />
          <EmojiPicker
            isOpen={isEmojiPickerOpen}
            onClose={() => setIsEmojiPickerOpen(false)}
            onSelectEmoji={handleEmojiSelect}
          />
        </div>
        <ToolbarButton 
          icon={Folder} 
          label="文件" 
          onClick={() => fileInputRef.current?.click()}
        />
        <ToolbarButton 
          icon={ImageIcon} 
          label="图片/视频" 
          onClick={() => mediaInputRef.current?.click()}
        />
        <ToolbarButton icon={Scissors} label="截图" />
        
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={mediaInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleMediaSelect}
        />
      </div>

      {/* Input area */}
      <div className="px-4 pb-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={disabled}
            rows={3}
            className={cn(
              "resize-none bg-card rounded mx-0 my-0 py-2.5 px-3 leading-7 w-full h-auto",
              "text-[14px] leading-relaxed text-foreground",
              "placeholder:text-muted-foreground",
              "border border-border focus:border-ring",
              "focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[72px] max-h-[120px]"
            )}
          />
        </div>

        {/* Bottom row with send button */}
        <div className="flex items-center justify-end mt-2">
          <button
            type="submit"
            disabled={disabled || (!message.trim() && attachments.length === 0)}
            className={cn(
              "px-5 py-1.5 rounded text-[13px] font-medium transition-colors",
              "border",
              message.trim() || attachments.length > 0
                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                : "bg-secondary text-muted-foreground border-border cursor-not-allowed"
            )}
          >
            发送
          </button>
        </div>
      </div>
    </form>
  );
}

// Toolbar button component
function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  isActive,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-2 rounded transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={1.5} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
