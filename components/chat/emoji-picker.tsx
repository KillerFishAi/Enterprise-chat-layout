"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

// Default emoji categories
const emojiCategories = {
  "常用": [
    "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃",
    "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙",
    "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫",
  ],
  "表情": [
    "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬",
    "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢",
    "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸",
  ],
  "手势": [
    "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
    "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍",
    "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🙏",
  ],
  "符号": [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️",
    "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐",
  ],
  "物品": [
    "📱", "💻", "🖥️", "🖨️", "⌨️", "🖱️", "💾", "💿", "📀", "📷",
    "📹", "🎥", "📽️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️",
    "⏰", "⏱️", "⏲️", "🕰️", "📡", "🔋", "🔌", "💡", "🔦", "🕯️",
  ],
  "自然": [
    "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️",
    "❄️", "💨", "🌪️", "🌫️", "🌈", "☔", "⚡", "🔥", "💧", "🌊",
    "🌸", "💮", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱",
  ],
};

type CategoryKey = keyof typeof emojiCategories;

export function EmojiPicker({ isOpen, onClose, onSelectEmoji }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("常用");

  if (!isOpen) return null;

  const categories = Object.keys(emojiCategories) as CategoryKey[];

  return (
    <div className="absolute bottom-full left-0 mb-2 w-[320px] bg-card border border-border rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium text-foreground">表情</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border overflow-x-auto">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              "px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors",
              activeCategory === category
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="p-2 h-[200px] overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {emojiCategories[activeCategory].map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => {
                onSelectEmoji(emoji);
              }}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
