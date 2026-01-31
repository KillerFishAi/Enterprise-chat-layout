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

  await prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED" },
  });

  return NextResponse.json({ data: { id: request.id } });
}
