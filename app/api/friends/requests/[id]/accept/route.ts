import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

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

  const request = await prisma.friendRequest.findUnique({
    where: { id },
  });

  if (!request || request.toUserId !== payload.userId) {
    return NextResponse.json({ error: "请求不存在" }, { status: 404 });
  }

  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "请求已处理" }, { status: 400 });
  }

  let newConversationId: string | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.friendRequest.update({
        where: { id: request.id },
        data: { status: "ACCEPTED" },
      });

      await tx.friendship.createMany({
        data: [
          { userId: request.fromUserId, friendId: request.toUserId },
          { userId: request.toUserId, friendId: request.fromUserId },
        ],
        skipDuplicates: true,
      });

      const existingMemberships = await tx.conversationMember.findMany({
        where: {
          userId: { in: [request.fromUserId, request.toUserId] },
        },
        include: { conversation: true },
      });

      const byConv = existingMemberships.reduce<
        Record<string, Set<string>>
      >((map, m) => {
        if (!map[m.conversationId]) map[m.conversationId] = new Set();
        map[m.conversationId].add(m.userId);
        return map;
      }, {});

      const hasDirectChat = Object.values(byConv).some(
        (members) =>
          members.size === 2 &&
          members.has(request.fromUserId) &&
          members.has(request.toUserId)
      );

      if (!hasDirectChat) {
        const fromUser = await tx.user.findUnique({
          where: { id: request.fromUserId },
        });
        const conversation = await tx.conversation.create({
          data: {
            name: fromUser?.nickname ?? "单聊",
            isGroup: false,
          },
        });
        await tx.conversationMember.createMany({
          data: [
            { conversationId: conversation.id, userId: request.fromUserId, role: "MEMBER" },
            { conversationId: conversation.id, userId: request.toUserId, role: "MEMBER" },
          ],
        });
        newConversationId = conversation.id;
      }
    });

    return NextResponse.json({
      data: { id: request.id, conversationId: newConversationId ?? undefined },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "处理好友请求失败" }, { status: 500 });
  }
}
