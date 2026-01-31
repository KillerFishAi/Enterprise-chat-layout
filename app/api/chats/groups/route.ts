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
    name?: string;
    memberIds?: string[];
  } | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "群聊名称不能为空" }, { status: 400 });
  }

  const memberIds = Array.from(
    new Set([payload.userId, ...(body.memberIds ?? [])])
  );

  try {
    const conversation = await prisma.conversation.create({
      data: {
        name: body.name.trim(),
        isGroup: true,
        members: {
          create: memberIds.map((userId, index) => ({
            userId,
            role: index === 0 ? "ADMIN" : "MEMBER",
          })),
        },
      },
    });

    return NextResponse.json(
      {
        data: {
          id: conversation.id,
          name: conversation.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "创建群聊失败" }, { status: 500 });
  }
}
