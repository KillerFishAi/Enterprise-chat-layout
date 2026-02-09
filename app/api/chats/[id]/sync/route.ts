import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";
import { setUserLastAck } from "@/lib/redis";
import { MessageType } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/chats/:id/sync?afterSeq=N&limit=100
 *
 * 断线重连消息补偿端点。
 * 客户端传入本地已有的最大 seqId，服务器返回该 seqId 之后的所有消息。
 * 用于：
 *   1. WebSocket 断线重连后的消息补偿
 *   2. 客户端检测到 seqId gap 时的主动拉取
 *   3. 首次加载对话时的消息同步
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ error: "无效的令牌" }, { status: 401 });
  }

  const { id } = await params;
  const afterSeq = parseInt(req.nextUrl.searchParams.get("afterSeq") ?? "0", 10);
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10),
    500 // 单次最多返回 500 条
  );

  // 验证会话成员权限
  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
  });

  if (!isMember) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  // 增量拉取：严格走 (conversationId, seqId) 复合索引，避免全表扫描
  // 索引顺序与 WHERE + ORDER BY 一致，适合百万级消息表
  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      seqId: { gt: afterSeq },
    },
    include: {
      sender: true,
      _count: { select: { reads: true } },
      reads: { where: { userId: payload.userId }, select: { userId: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          sender: { select: { nickname: true } },
        },
      },
    },
    orderBy: { seqId: "asc" },
    take: limit,
  });

  const data = messages.map((m) => mapSyncMessageFields(m, payload.userId));

  // 更新用户的 Ack 位置
  if (data.length > 0) {
    const maxSeq = data[data.length - 1].seqId;
    await setUserLastAck(payload.userId, id, maxSeq);
  }

  return NextResponse.json({
    data,
    hasMore: messages.length === limit,
    afterSeq,
    latestSeq: data.length > 0 ? data[data.length - 1].seqId : afterSeq,
  });
}

/** 映射消息字段（与 messages route 保持一致） */
function mapSyncMessageFields(
  message: {
    id: string;
    seqId: number;
    clientMsgId: string | null;
    content: string;
    type: MessageType;
    fileUrl: string | null;
    fileName: string | null;
    fileSize: string | null;
    createdAt: Date;
    senderId: string;
    sender: { nickname: string };
    _count?: { reads: number };
    reads?: { userId: string }[];
    replyTo?: {
      id: string;
      content: string;
      type: MessageType;
      sender: { nickname: string };
    } | null;
  },
  currentUserId: string
) {
  const isRead = message.reads?.some((r) => r.userId === currentUserId) ?? false;
  const readCount = message._count?.reads ?? 0;
  const status: "sent" | "delivered" | "read" =
    message.senderId === currentUserId
      ? isRead
        ? "read"
        : readCount > 0
          ? "delivered"
          : "sent"
      : "read";

  const base = {
    id: message.id,
    seqId: message.seqId,
    clientMsgId: message.clientMsgId ?? undefined,
    content: message.content,
    timestamp: message.createdAt.toISOString(),
    senderId: message.senderId,
    senderName: message.sender.nickname,
    isOwn: message.senderId === currentUserId,
    status,
    type: message.type.toLowerCase() as "text" | "image" | "video" | "file",
    fileUrl: message.fileUrl,
    fileName: message.fileName,
    fileSize: message.fileSize,
    readCount,
    isRead,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.content.slice(0, 100),
          senderName: message.replyTo.sender.nickname,
          type: message.replyTo.type.toLowerCase(),
        }
      : undefined,
  };

  switch (message.type) {
    case "IMAGE":
      return { ...base, imageUrl: message.fileUrl };
    case "VIDEO":
      return { ...base, videoUrl: message.fileUrl };
    case "FILE":
      return { ...base, fileName: message.fileName, fileSize: message.fileSize };
    default:
      return base;
  }
}
