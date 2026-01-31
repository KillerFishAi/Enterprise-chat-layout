import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";
import { publishChatMessage } from "@/lib/chat-events";

type RouteParams = {
  params: Promise<{ id: string }>;
};

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
  });

  if (!isMember) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    include: { sender: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    data: messages.map((m) => ({
      id: m.id,
      content: m.content,
      timestamp: m.createdAt.toISOString(),
      senderId: m.senderId,
      senderName: m.sender.nickname,
      isOwn: m.senderId === payload.userId,
      status: "read" as const,
      type: "text" as const,
    })),
  });
}

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
  const body = (await req.json().catch(() => null)) as { content?: string } | null;

  if (!body?.content || !body.content.trim()) {
    return NextResponse.json(
      { error: "消息内容不能为空" },
      { status: 400 }
    );
  }

  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
  });

  if (!isMember) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  const created = await prisma.message.create({
    data: {
      conversationId: id,
      senderId: payload.userId,
      content: body.content.trim(),
    },
    include: {
      sender: true,
    },
  });

  const message = {
    id: created.id,
    content: created.content,
    timestamp: created.createdAt.toISOString(),
    senderId: created.senderId,
    senderName: created.sender.nickname,
    isOwn: true,
    status: "sent" as const,
    type: "text" as const,
  };

  // 推送给订阅该会话的所有客户端
  publishChatMessage(id, message);

  return NextResponse.json(
    { data: message },
    { status: 201 }
  );
}


