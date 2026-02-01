import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

/** GET: 搜索聊天记录。query: q=关键词, conversationId=可选限定会话 */
export async function GET(req: NextRequest) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const conversationId = searchParams.get("conversationId") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  if (!q || q.length < 1) {
    return NextResponse.json({ error: "请输入搜索关键词" }, { status: 400 });
  }

  const myMemberships = await prisma.conversationMember.findMany({
    where: { userId: payload.userId },
    select: { conversationId: true },
  });
  const myConversationIds = myMemberships.map((m) => m.conversationId);

  const conversationFilter =
    conversationId && myConversationIds.includes(conversationId)
      ? { conversationId }
      : { conversationId: { in: myConversationIds } };

  const messages = await prisma.message.findMany({
    where: {
      ...conversationFilter,
      OR: [
        { content: { contains: q, mode: "insensitive" } },
        { fileName: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      sender: { select: { id: true, nickname: true } },
      conversation: { select: { id: true, name: true, isGroup: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const data = messages.map((m) => ({
    id: m.id,
    content: m.content,
    type: m.type.toLowerCase(),
    fileUrl: m.fileUrl,
    fileName: m.fileName,
    createdAt: m.createdAt.toISOString(),
    senderId: m.senderId,
    senderName: m.sender.nickname,
    conversationId: m.conversation.id,
    conversationName: m.conversation.name,
    isGroup: m.conversation.isGroup,
  }));

  return NextResponse.json({ data });
}
