import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

/** GET: 获取群成员列表 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const { id } = await params;
  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
    include: { conversation: true },
  });
  if (!isMember || !isMember.conversation.isGroup) {
    return NextResponse.json({ error: "无权访问该群聊" }, { status: 403 });
  }

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: id },
    include: { user: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    data: members.map((m) => ({
      id: m.userId,
      name: m.user.nickname,
      avatar: undefined,
      role: m.role === "ADMIN" ? "admin" : "member",
      status: m.user.department && m.user.title ? `${m.user.department} · ${m.user.title}` : m.user.department ?? m.user.title ?? undefined,
      mutedUntil: m.mutedUntil?.toISOString() ?? null,
    })),
  });
}

/** POST: 添加成员，仅管理员 */
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
  const body = (await req.json().catch(() => null)) as { userIds?: string[] } | null;
  const userIds = Array.isArray(body?.userIds) ? body.userIds : [];
  if (userIds.length === 0) {
    return NextResponse.json({ error: "请选择要添加的成员" }, { status: 400 });
  }

  const myMembership = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
    include: { conversation: true },
  });
  if (!myMembership || !myMembership.conversation.isGroup) {
    return NextResponse.json({ error: "会话不存在或不是群聊" }, { status: 404 });
  }
  if (myMembership.role !== "ADMIN") {
    return NextResponse.json({ error: "仅管理员可添加成员" }, { status: 403 });
  }

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId: id, userId: { in: userIds } },
  });
  const existingIds = new Set(existing.map((e) => e.userId));
  const toAdd = userIds.filter((uid) => !existingIds.has(uid) && uid !== payload.userId);
  if (toAdd.length === 0) {
    return NextResponse.json({ error: "没有可添加的新成员" }, { status: 400 });
  }

  const usersExist = await prisma.user.findMany({
    where: { id: { in: toAdd } },
    select: { id: true },
  });
  const validIds = new Set(usersExist.map((u) => u.id));
  const finalAdd = toAdd.filter((uid) => validIds.has(uid));

  await prisma.conversationMember.createMany({
    data: finalAdd.map((userId) => ({
      conversationId: id,
      userId,
      role: "MEMBER",
    })),
  });

  return NextResponse.json({
    data: { added: finalAdd.length, userIds: finalAdd },
  });
}
