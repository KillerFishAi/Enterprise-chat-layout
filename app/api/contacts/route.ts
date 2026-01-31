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

  const friendships = await prisma.friendship.findMany({
    where: { userId: payload.userId },
    include: { friend: true },
    orderBy: { createdAt: "desc" },
  });

  const contacts = friendships.map((f) => ({
    id: f.friend.id,
    name: f.friend.nickname,
    role: "member" as const,
    title: f.friend.title ?? undefined,
    department: f.friend.department ?? undefined,
    online: true,
  }));

  return NextResponse.json({
    data: contacts,
  });
}



