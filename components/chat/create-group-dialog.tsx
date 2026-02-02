"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Contact } from "@/components/chat/contacts-list";

interface CreateGroupDialogProps {
  contacts: Contact[];
  onClose: () => void;
  /** 创建成功后回调，传入新群聊 id，用于刷新列表并打开该群 */
  onCreated: (groupId: string) => void;
}

export function CreateGroupDialog({
  contacts,
  onClose,
  onCreated,
}: CreateGroupDialogProps) {
  const [name, setName] = useState("");
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
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert("请输入群名称");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/chats/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          memberIds: Array.from(selectedIds),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string };
        alert(data?.error ?? "创建群聊失败");
        return;
      }
      const json = (await res.json()) as { data?: { id: string; name: string } };
      if (json.data?.id) {
        onCreated(json.data.id);
      }
    } catch (err) {
      console.error(err);
      alert("创建群聊失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>创建群聊</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="group-name">群名称</Label>
            <Input
              id="group-name"
              placeholder="输入群名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Label className="text-muted-foreground text-sm">选择成员（从通讯录）</Label>
            <div className="max-h-[40vh] overflow-y-auto space-y-2 mt-2 border rounded-lg p-2">
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  暂无联系人，请先添加好友
                </p>
              ) : (
                contacts.map((contact) => (
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
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? "创建中..." : "创建"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
