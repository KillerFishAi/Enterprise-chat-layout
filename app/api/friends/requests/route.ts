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

  const [incoming, outgoing] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { toUserId: payload.userId, status: "PENDING" },
      include: { from: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { fromUserId: payload.userId, status: "PENDING" },
      include: { to: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    data: {
      incoming: incoming.map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        fromName: r.from.nickname,
        fromDepartment: r.from.department ?? undefined,
        fromTitle: r.from.title ?? undefined,
        createdAt: r.createdAt.toISOString(),
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        toUserId: r.toUserId,
        toName: r.to.nickname,
        toDepartment: r.to.department ?? undefined,
        toTitle: r.to.title ?? undefined,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  });
}

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
    return NextResponse.json({ error: "不能添加自己为好友" }, { status: 400 });
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: body.targetUserId },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        userId: payload.userId,
        friendId: body.targetUserId,
      },
    });
    if (existingFriendship) {
      return NextResponse.json({ error: "你们已经是好友了" }, { status: 409 });
    }

    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        fromUserId: payload.userId,
        toUserId: body.targetUserId,
        status: "PENDING",
      },
    });
    if (existingRequest) {
      return NextResponse.json(
        { error: "已发送好友请求，请等待对方同意" },
        { status: 409 }
      );
    }

    const created = await prisma.friendRequest.create({
      data: {
        fromUserId: payload.userId,
        toUserId: body.targetUserId,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: created.id,
          toUserId: created.toUserId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "发送好友请求失败" }, { status: 500 });
  }
}
