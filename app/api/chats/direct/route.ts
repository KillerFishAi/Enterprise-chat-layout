import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    targetUserId?: string;
  } | null;

  if (!body?.targetUserId) {
    return NextResponse.json({ error: "目标用户不能为空" }, { status: 400 });
  }

  if (body.targetUserId === payload.userId) {
    return NextResponse.json({ error: "不能与自己创建单聊" }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: body.targetUserId },
    });
    if (!target) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const memberships = await prisma.conversationMember.findMany({
      where: {
        userId: { in: [payload.userId, body.targetUserId] },
      },
      include: {
        conversation: true,
      },
    });

    const candidateConversations = memberships
      .filter((m) => !m.conversation.isGroup)
      .reduce<
        Record<string, { id: string; members: Set<string> }>
      >((map, m) => {
        const key = m.conversationId;
        if (!map[key]) {
          map[key] = { id: key, members: new Set() };
        }
        map[key]!.members.add(m.userId);
        return map;
      }, {});

    const existing = Object.values(candidateConversations).find((c) => {
      return (
        c.members.size === 2 &&
        c.members.has(payload.userId) &&
        c.members.has(body.targetUserId!)
      );
    });

    if (existing) {
      return NextResponse.json({
        data: { id: existing.id },
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        name: target.nickname,
        isGroup: false,
        members: {
          createMany: {
            data: [
              { userId: payload.userId, role: "MEMBER" },
              { userId: body.targetUserId, role: "MEMBER" },
            ],
          },
        },
      },
    });

    return NextResponse.json({
      data: { id: conversation.id },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "创建单聊失败" }, { status: 500 });
  }
}
