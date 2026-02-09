import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";
import { publishChatMessage } from "@/lib/chat-events";
import { getNextSeqId, initConversationSeq } from "@/lib/redis";
import { pushToMessageBuffer } from "@/lib/message-buffer";
import { MessageType } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 根据消息类型映射返回字段
 * 将数据库的 fileUrl 映射为前端需要的 imageUrl/videoUrl 等
 */
function mapMessageFields(
  message: {
    id: string;
    seqId: number;
    clientMsgId?: string | null;
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
    replyTo?: { id: string; content: string; type: MessageType; sender: { nickname: string } } | null;
  },
  currentUserId: string,
  isNew: boolean = false
) {
  const isRead = message.reads?.some((r) => r.userId === currentUserId) ?? false;
  const readCount = message._count?.reads ?? 0;
  const status: "sent" | "delivered" | "read" =
    message.senderId === currentUserId
      ? isNew
        ? "sent"
        : isRead
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

  // 根据类型添加特定字段
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

  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
  });

  if (!isMember) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    include: {
      sender: true,
      _count: { select: { reads: true } },
      reads: { where: { userId: payload.userId }, select: { userId: true } },
      replyTo: {
        select: { id: true, content: true, type: true, sender: { select: { nickname: true } } },
      },
    },
    orderBy: { seqId: "asc" },  // 按 seqId 排序，保证时序一致性
  });

  // 初始化 Redis 序号计数器（首次加载时同步 DB 最大值）
  if (messages.length > 0) {
    const maxSeq = Math.max(...messages.map((m) => m.seqId));
    await initConversationSeq(id, maxSeq);
  }

  return NextResponse.json({
    data: messages.map((m) => mapMessageFields(m, payload.userId)),
  });
}

// 请求体类型定义
type MessageRequestBody = {
  content?: string;
  type?: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  replyToMessageId?: string;
  clientMsgId?: string;    // 客户端幂等 ID，防止重复提交
};

// 有效的消息类型
const validMessageTypes = ["TEXT", "IMAGE", "VIDEO", "FILE"] as const;

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
  const body = (await req.json().catch(() => null)) as MessageRequestBody | null;

  if (!body) {
    return NextResponse.json(
      { error: "请求体不能为空" },
      { status: 400 }
    );
  }

  // 解析消息类型，默认为 TEXT
  const messageType = body.type?.toUpperCase() as MessageType | undefined;
  const type: MessageType = messageType && validMessageTypes.includes(messageType as typeof validMessageTypes[number])
    ? messageType
    : "TEXT";

  // 校验逻辑
  // TEXT 类型：content 必填
  // 其他类型：fileUrl 必填，content 可选（作为文件描述）
  if (type === "TEXT") {
    if (!body.content || !body.content.trim()) {
      return NextResponse.json(
        { error: "文本消息内容不能为空" },
        { status: 400 }
      );
    }
  } else {
    // IMAGE, VIDEO, FILE 类型需要 fileUrl
    if (!body.fileUrl) {
      return NextResponse.json(
        { error: "多媒体消息需要提供文件URL" },
        { status: 400 }
      );
    }
  }

  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
    include: { conversation: true, user: { select: { nickname: true } } },
  });

  if (!isMember) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }
  if (isMember.conversation.isGroup && isMember.mutedUntil && isMember.mutedUntil > new Date()) {
    return NextResponse.json({ error: "您已被禁言，暂时无法发送消息" }, { status: 403 });
  }

  // ── 幂等去重：如果客户端提供了 clientMsgId，先检查是否已存在 ──
  const clientMsgId = body.clientMsgId?.trim() || null;
  if (clientMsgId) {
    const existing = await prisma.message.findUnique({
      where: { clientMsgId },
      include: {
        sender: true,
        replyTo: {
          select: { id: true, content: true, type: true, sender: { select: { nickname: true } } },
        },
      },
    });
    if (existing) {
      // 消息已存在，直接返回（幂等）
      const message = mapMessageFields(existing, payload.userId, false);
      return NextResponse.json({ data: message }, { status: 200 });
    }
  }

  const replyToMessageId =
    body.replyToMessageId && body.replyToMessageId.trim()
      ? body.replyToMessageId.trim()
      : null;
  if (replyToMessageId) {
    const replyTo = await prisma.message.findFirst({
      where: { id: replyToMessageId, conversationId: id },
    });
    if (!replyTo) {
      return NextResponse.json({ error: "被引用的消息不存在" }, { status: 400 });
    }
  }

  // ── 原子分配 seqId ──
  const seqId = await getNextSeqId(id);

  // ── 批量写入：入 Buffer，由 message-buffer 在 500ms 或 50 条时 createMany + 发布 ──
  pushToMessageBuffer({
    conversationId: id,
    senderId: payload.userId,
    seqId,
    clientMsgId: clientMsgId || null,
    content: body.content?.trim() || "",
    type: type,
    fileUrl: body.fileUrl || null,
    fileName: body.fileName || null,
    fileSize: body.fileSize || null,
    replyToMessageId: replyToMessageId || null,
  });

  // 返回 202 + 暂存消息（无真实 id，客户端用 clientMsgId 做乐观展示；真实消息经 WS 推送后替换）
  const senderName = isMember.conversation?.name ?? ""; // 当前上下文中无 conversation name，用占位
  const stagedMessage = {
    id: clientMsgId || `staged-${seqId}`,
    seqId,
    clientMsgId: clientMsgId ?? undefined,
    content: body.content?.trim() || "",
    timestamp: new Date().toISOString(),
    senderId: payload.userId,
    senderName: isMember.user?.nickname ?? "我",
    isOwn: true,
    status: "sent" as const,
    type: type.toLowerCase() as "text" | "image" | "video" | "file",
    fileUrl: body.fileUrl ?? null,
    fileName: body.fileName ?? null,
    fileSize: body.fileSize ?? null,
    replyTo: undefined,
  };

  return NextResponse.json(
    { data: stagedMessage },
    { status: 202 }
  );
}


