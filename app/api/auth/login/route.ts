import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signAuthToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    account?: string;
    phone?: string;
    email?: string;
    password?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "请求体不能为空" }, { status: 400 });
  }

  const { account, phone, email, password } = body;

  if (!password) {
    return NextResponse.json({ error: "密码不能为空" }, { status: 400 });
  }

  if (!account && !phone && !email) {
    return NextResponse.json(
      { error: "需要至少提供一种登录凭据（账号 / 手机 / 邮箱）" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          account ? { account } : undefined,
          phone ? { phone } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean) as { account?: string; phone?: string; email?: string }[],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return NextResponse.json(
        { error: "账号或密码错误" },
        { status: 401 }
      );
    }

    const token = signAuthToken(user.id);

    // 仅当明确配置 COOKIE_SECURE=true 时才用 Secure（HTTPS）；用 HTTP 访问时必须为 false，否则浏览器不保存 Cookie
    const secure = process.env.COOKIE_SECURE === "true";

    // 返回 200 JSON + Set-Cookie，由前端 window.location.href="/" 跳转，避免 302/307 被 fetch 跟随导致 Cookie 或方法异常（尤其 Docker/反向代理环境）
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}


