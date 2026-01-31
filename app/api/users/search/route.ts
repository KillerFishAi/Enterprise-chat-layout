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

  const { searchParams } = new URL(req.url);
  const method = searchParams.get("method") ?? "account";
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ data: [] });
  }

  const where =
    method === "phone"
      ? { phone: { contains: q } }
      : method === "email"
        ? { email: { contains: q, mode: "insensitive" } }
        : {
            OR: [
              { account: { contains: q, mode: "insensitive" } },
              { nickname: { contains: q, mode: "insensitive" } },
            ],
          };

  const [users, friendships, outgoing, incoming] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...where,
        NOT: { id: payload.userId },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendship.findMany({
      where: { userId: payload.userId },
    }),
    prisma.friendRequest.findMany({
      where: { fromUserId: payload.userId, status: "PENDING" },
    }),
    prisma.friendRequest.findMany({
      where: { toUserId: payload.userId, status: "PENDING" },
    }),
  ]);

  const friendIds = new Set(friendships.map((f) => f.friendId));
  const outgoingIds = new Set(outgoing.map((r) => r.toUserId));
  const incomingIds = new Set(incoming.map((r) => r.fromUserId));

  const results = users.map((u) => ({
    id: u.id,
    name: u.nickname,
    account: u.account ?? undefined,
    phone: u.phone ?? undefined,
    email: u.email ?? undefined,
    department: u.department ?? undefined,
    title: u.title ?? undefined,
    isFriend: friendIds.has(u.id),
    hasRequested: outgoingIds.has(u.id),
    hasRequestFromTarget: incomingIds.has(u.id),
  }));

  return NextResponse.json({ data: results });
}
