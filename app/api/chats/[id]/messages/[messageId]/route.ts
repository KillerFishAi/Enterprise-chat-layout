import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";
import { publishChatMessage } from "@/lib/chat-events";

type RouteParams = { params: Promise<{ id: string; messageId: string }> };

const REVOKE_WINDOW_MS = 2 * 60 * 1000; // 2 分钟

/** DELETE: 撤回消息（仅发送者，2 分钟内） */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const { id: conversationId, messageId } = await params;

  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: payload.userId },
  });
  if (!isMember) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!message) {
    return NextResponse.json({ error: "消息不存在" }, { status: 404 });
  }
  if (message.senderId !== payload.userId) {
    return NextResponse.json({ error: "只能撤回自己的消息" }, { status: 403 });
  }
  const age = Date.now() - message.createdAt.getTime();
  if (age > REVOKE_WINDOW_MS) {
    return NextResponse.json({ error: "超过 2 分钟无法撤回" }, { status: 400 });
  }

  const sender = await prisma.user.findUnique({
    where: { id: message.senderId },
    select: { nickname: true },
  });

  await prisma.message.update({
    where: { id: messageId },
    data: { content: "[已撤回]", type: "TEXT", fileUrl: null, fileName: null, fileSize: null },
  });

  const revoked = {
    id: message.id,
    seqId: message.seqId,
    content: "[已撤回]",
    timestamp: message.createdAt.toISOString(),
    senderId: message.senderId,
    senderName: sender?.nickname ?? "",
    isOwn: message.senderId === payload.userId,
    status: "read" as const,
    type: "text" as const,
    revoked: true,
  };
  await publishChatMessage(conversationId, revoked as Parameters<typeof publishChatMessage>[1]);

  return NextResponse.json({ data: { revoked: true } });
}
