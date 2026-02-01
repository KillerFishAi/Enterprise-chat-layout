import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/** POST: 退出群聊 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const { id } = await params;

  const membership = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
    include: { conversation: true },
  });
  if (!membership || !membership.conversation.isGroup) {
    return NextResponse.json({ error: "会话不存在或不是群聊" }, { status: 404 });
  }

  const memberCount = await prisma.conversationMember.count({
    where: { conversationId: id },
  });
  if (memberCount <= 1) {
    await prisma.conversationMember.delete({ where: { id: membership.id } });
    await prisma.conversation.delete({ where: { id } });
  } else {
    await prisma.conversationMember.delete({ where: { id: membership.id } });
  }

  return NextResponse.json({ data: { left: true } });
}
