import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: payload.userId },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { conversation: { createdAt: "desc" } },
  });

  const chats = memberships.map((m) => {
    const lastMessage = m.conversation.messages[0];
    return {
      id: m.conversation.id,
      name: m.conversation.name,
      isGroup: m.conversation.isGroup,
      lastMessage: lastMessage?.content ?? "",
      timestamp: lastMessage?.createdAt.toISOString() ?? "",
      memberCount: m.conversation.isGroup ? undefined : undefined,
    };
  });

  return NextResponse.json({
    data: chats,
  });
}


