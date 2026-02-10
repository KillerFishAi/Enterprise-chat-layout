import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";
import { inferPlatform } from "@/lib/push-notification";

/**
 * POST /api/me/device-token
 * 注册当前用户的设备 Token（FCM 或 APNs），用于离线推送
 *
 * Body: { token: string; platform?: "fcm" | "apns" }
 * 若不传 platform，则根据 token 格式自动推断
 */
export async function POST(req: NextRequest) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  let body: { token?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const rawToken = body.token?.trim();
  if (!rawToken) {
    return NextResponse.json({ error: "token 不能为空" }, { status: 400 });
  }

  const platform = (body.platform?.toLowerCase() === "apns" ? "apns" : "fcm") as "fcm" | "apns";
  const resolved = body.platform ? platform : inferPlatform(rawToken);

  // 确保同一物理设备（token）只属于当前登录用户：
  // 先清理所有绑定到该 token 的旧记录，避免“幽灵设备”收到其他账号推送
  await prisma.deviceToken.deleteMany({
    where: { token: rawToken },
  });

  await prisma.deviceToken.upsert({
    where: {
      userId_token: { userId: payload.userId, token: rawToken },
    },
    create: {
      userId: payload.userId,
      token: rawToken,
      platform: resolved,
    },
    update: { platform: resolved, updatedAt: new Date() },
  });

  return NextResponse.json({ data: { registered: true, platform: resolved } });
}
