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

    // 仅当明确配置 COOKIE_SECURE=true 时才用 Secure（HTTPS）；用 HTTP 访问时必须为 false，否则浏览器不保存 Cookie，登录后无法跳转
    const secure = process.env.COOKIE_SECURE === "true";

    // 方案：用 302 重定向到首页，并在同一响应里 Set-Cookie，浏览器会保存 Cookie 并跳转，比“返回 JSON + 前端再跳转”更可靠（尤其 HTTP / IP 访问）
    const redirectUrl = new URL("/", req.url);
    const response = NextResponse.redirect(redirectUrl, 302);

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


