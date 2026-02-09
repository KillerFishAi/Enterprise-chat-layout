import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";
import { decrUserUnread } from "@/lib/redis";

type RouteParams = { params: Promise<{ id: string }> };

/** POST: 标记消息为已读 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const body = (await req.json().catch(() => null)) as { messageIds?: string[]; upToMessageId?: string } | null;
  const messageIds = body?.messageIds ?? (body?.upToMessageId ? [body.upToMessageId] : []);

  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: payload.userId },
  });
  if (!isMember) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  if (messageIds.length === 0) {
    return NextResponse.json({ data: { marked: 0 } });
  }

  const messagesInConversation = await prisma.message.findMany({
    where: { id: { in: messageIds }, conversationId },
    select: { id: true },
  });
  const validIds = messagesInConversation.map((m) => m.id);

  await prisma.messageRead.createMany({
    data: validIds.map((messageId) => ({
      messageId,
      userId: payload.userId,
    })),
    skipDuplicates: true,
  });

  // 扣减角标未读数，与离线推送的 incr 对应
  await decrUserUnread(payload.userId, validIds.length);

  return NextResponse.json({ data: { marked: validIds.length } });
}
