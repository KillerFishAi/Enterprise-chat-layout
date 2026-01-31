import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    account?: string;
    phone?: string;
    email?: string;
    password?: string;
    nickname?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "请求体不能为空" }, { status: 400 });
  }

  const { account, phone, email, password, nickname } = body;

  if (!password || !nickname) {
    return NextResponse.json(
      { error: "密码和昵称为必填项" },
      { status: 400 }
    );
  }

  if (!account && !phone && !email) {
    return NextResponse.json(
      { error: "需要至少提供一种登录凭据（账号 / 手机 / 邮箱）" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          account ? { account } : undefined,
          phone ? { phone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean) as { account?: string; phone?: string; email?: string }[],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "该用户已存在" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 确保至少有一个公共群聊可用
    const conversation = await prisma.conversation.upsert({
      where: { id: "global-public" },
      update: {},
      create: {
        id: "global-public",
        name: "企业公共群聊",
        isGroup: true,
      },
    });

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          account,
          phone,
          email,
          nickname,
          passwordHash,
        },
      });

      // 新用户自动加入公共群聊
      await tx.conversationMember.create({
        data: {
          userId: createdUser.id,
          conversationId: conversation.id,
          role: "MEMBER",
        },
      });

      return createdUser;
    });

    return NextResponse.json(
      {
        data: {
          id: user.id,
          account: user.account,
          phone: user.phone,
          email: user.email,
          nickname: user.nickname,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}


