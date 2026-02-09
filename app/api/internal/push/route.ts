import { NextRequest, NextResponse } from "next/server";
import {
  sendPushToUser,
  buildPushPayload,
} from "@/lib/push-notification";
import { incrUserUnread } from "@/lib/redis";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

/**
 * POST /api/internal/push
 *
 * 内部接口：由 ws-server 在用户离线时调用。
 * 先递增该用户未读数，再按会话类型生成静默摘要并发送 FCM/APNs。
 * - 私聊：您收到一条新消息
 * - 群聊：[群名]有新动态
 * 推送 data 中携带 unreadCount，供 App 角标红点展示。
 *
 * Body: {
 *   userId: string;
 *   chatId: string;
 *   isGroup: boolean;
 *   conversationName?: string;
 *   messageId?: string;
 * }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("X-Internal-Secret");
  if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    userId: string;
    chatId: string;
    isGroup: boolean;
    conversationName?: string;
    messageId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, chatId, isGroup, conversationName, messageId } = body;
  if (!userId || !chatId) {
    return NextResponse.json(
      { error: "Missing userId or chatId" },
      { status: 400 }
    );
  }

  // 递增未读数并得到当前值，用于角标
  const unreadCount = await incrUserUnread(userId);
  const payload = buildPushPayload({
    chatId,
    isGroup: Boolean(isGroup),
    conversationName,
    unreadCount,
    messageId,
  });

  const result = await sendPushToUser(userId, payload);
  return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed, unreadCount });
}
