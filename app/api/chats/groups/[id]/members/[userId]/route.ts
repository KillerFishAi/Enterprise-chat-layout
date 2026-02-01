import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

/** DELETE: 移除成员（踢出），仅管理员；或群主移除任何人 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const { id, userId: targetUserId } = await params;

  const myMembership = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
    include: { conversation: true },
  });
  if (!myMembership || !myMembership.conversation.isGroup) {
    return NextResponse.json({ error: "会话不存在或不是群聊" }, { status: 404 });
  }
  if (myMembership.role !== "ADMIN") {
    return NextResponse.json({ error: "仅管理员可移除成员" }, { status: 403 });
  }

  const targetMembership = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: targetUserId },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "该用户不是群成员" }, { status: 404 });
  }
  if (targetMembership.role === "ADMIN") {
    return NextResponse.json({ error: "不能移除其他管理员" }, { status: 403 });
  }

  await prisma.conversationMember.delete({
    where: { id: targetMembership.id },
  });

  return NextResponse.json({ data: { removed: true } });
}
