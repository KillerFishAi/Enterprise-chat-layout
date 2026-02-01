import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

/** POST: 禁言/解除禁言。body: { mute: boolean, durationMinutes?: number }，仅管理员 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const { id, userId: targetUserId } = await params;
  const body = (await req.json().catch(() => null)) as {
    mute?: boolean;
    durationMinutes?: number;
  } | null;
  const mute = body?.mute ?? true;
  const durationMinutes = body?.durationMinutes ?? 60;

  const myMembership = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
    include: { conversation: true },
  });
  if (!myMembership || !myMembership.conversation.isGroup) {
    return NextResponse.json({ error: "会话不存在或不是群聊" }, { status: 404 });
  }
  if (myMembership.role !== "ADMIN") {
    return NextResponse.json({ error: "仅管理员可禁言成员" }, { status: 403 });
  }

  const targetMembership = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: targetUserId },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "该用户不是群成员" }, { status: 404 });
  }
  if (targetMembership.role === "ADMIN") {
    return NextResponse.json({ error: "不能禁言管理员" }, { status: 403 });
  }

  const mutedUntil = mute
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : null;

  await prisma.conversationMember.update({
    where: { id: targetMembership.id },
    data: { mutedUntil },
  });

  return NextResponse.json({
    data: {
      userId: targetUserId,
      muted: mute,
      mutedUntil: mutedUntil?.toISOString() ?? null,
    },
  });
}
