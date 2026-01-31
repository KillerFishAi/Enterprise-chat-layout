"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X, MessageSquare } from "lucide-react";

export interface Contact {
  id: string;
  name: string;
  avatar?: string;
  role: "admin" | "member";
  department?: string;
  title?: string;
  online?: boolean;
}

interface ContactsListProps {
  contacts: Contact[];
  onStartChat: (contact: Contact) => void;
}

export function ContactsList({ contacts, onStartChat }: ContactsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group contacts by first letter
  const groupedContacts = filteredContacts.reduce(
    (groups, contact) => {
      const letter = contact.name[0].toUpperCase();
      if (!groups[letter]) {
        groups[letter] = [];
      }
      groups[letter].push(contact);
      return groups;
    },
    {} as Record<string, Contact[]>
  );

  const sortedLetters = Object.keys(groupedContacts).sort();

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-border">
        <div
          className={cn(
            "flex items-center gap-2 h-8 px-2.5 rounded bg-muted/60 transition-colors",
            isSearchFocused && "bg-muted ring-1 ring-border"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="搜索联系人"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">清除搜索</span>
            </button>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            暂无联系人
          </div>
        ) : (
          sortedLetters.map((letter) => (
            <div key={letter}>
              {/* Letter Header */}
              <div className="sticky top-0 px-3 py-1.5 bg-secondary border-b border-border/50">
                <span className="text-xs font-medium text-muted-foreground">
                  {letter}
                </span>
              </div>

              {/* Contacts under this letter */}
              {groupedContacts[letter].map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => onStartChat(contact)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 active:bg-muted/70 border-b border-border/30 group"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={contact.avatar || "/placeholder.svg"}
                        alt={contact.name}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {contact.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-card" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm truncate">
                        {contact.name}
                      </span>
                      {contact.role === "admin" && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
                          管理员
                        </span>
                      )}
                    </div>
                    {(contact.title || contact.department) && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {contact.title}
                        {contact.title && contact.department && " · "}
                        {contact.department}
                      </p>
                    )}
                  </div>

                  {/* Chat action (shows on hover) */}
                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer with count */}
      <div className="px-3 py-2 border-t border-border bg-secondary">
        <p className="text-xs text-muted-foreground text-center">
          共 {filteredContacts.length} 位联系人
        </p>
      </div>
    </div>
  );
}
