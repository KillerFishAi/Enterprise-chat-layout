"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { GroupMember } from "@/components/chat/group-settings";
import type { Contact } from "@/components/chat/contacts-list";

interface AddGroupMemberDialogProps {
  chatId: string;
  currentMembers: GroupMember[];
  contacts: Contact[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddGroupMemberDialog({
  chatId,
  currentMembers,
  contacts,
  onClose,
  onAdded,
}: AddGroupMemberDialogProps) {
  const memberIds = new Set(currentMembers.map((m) => m.id));
  const availableContacts = contacts.filter((c) => !memberIds.has(c.id));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/chats/groups/${chatId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string };
        alert(data?.error ?? "添加失败");
        return;
      }
      onAdded();
    } catch (err) {
      console.error(err);
      alert("添加失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加群成员</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 py-2">
          {availableContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              没有可添加的联系人（好友已在群内或已全部添加）
            </p>
          ) : (
            availableContacts.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedIds.has(contact.id)}
                  onCheckedChange={() => toggle(contact.id)}
                />
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {contact.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{contact.name}</p>
                  {(contact.department || contact.title) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.department} · {contact.title}
                    </p>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || isSubmitting}
          >
            {isSubmitting ? "添加中..." : `添加 (${selectedIds.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
