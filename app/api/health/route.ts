import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";

/**
 * 健康检查接口：用于检查聊天应用在服务器上的运行状态
 * GET /api/health
 * - 无需登录即可访问，适合监控与运维
 */
export async function GET() {
  const result: {
    ok: boolean;
    timestamp: string;
    app: "ok";
    db?: "ok" | "error";
    redis?: "ok" | "error" | "unconfigured";
  } = {
    ok: true,
    timestamp: new Date().toISOString(),
    app: "ok",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.db = "ok";
  } catch (e) {
    result.db = "error";
    result.ok = false;
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
      result.redis = "ok";
    } catch {
      result.redis = "error";
      result.ok = false;
    }
  } else {
    result.redis = "unconfigured";
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
  });
}
