import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";
import { publishChatMessage } from "@/lib/chat-events";
import { MessageType } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * 根据消息类型映射返回字段
 * 将数据库的 fileUrl 映射为前端需要的 imageUrl/videoUrl 等
 */
function mapMessageFields(message: {
  id: string;
  content: string;
  type: MessageType;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: string | null;
  createdAt: Date;
  senderId: string;
  sender: { nickname: string };
}, currentUserId: string, isNew: boolean = false) {
  // 基础字段
  const base = {
    id: message.id,
    content: message.content,
    timestamp: message.createdAt.toISOString(),
    senderId: message.senderId,
    senderName: message.sender.nickname,
    isOwn: message.senderId === currentUserId,
    status: isNew ? ("sent" as const) : ("read" as const),
    type: message.type.toLowerCase() as "text" | "image" | "video" | "file",
    fileUrl: message.fileUrl,
    fileName: message.fileName,
    fileSize: message.fileSize,
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
    include: { sender: true },
    orderBy: { createdAt: "asc" },
  });

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
  });

  if (!isMember) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  // 创建消息，写入所有字段
  const created = await prisma.message.create({
    data: {
      conversationId: id,
      senderId: payload.userId,
      content: body.content?.trim() || "",
      type: type,
      fileUrl: body.fileUrl || null,
      fileName: body.fileName || null,
      fileSize: body.fileSize || null,
    },
    include: {
      sender: true,
    },
  });

  // 使用统一的字段映射函数
  const message = mapMessageFields(created, payload.userId, true);

  // 推送给订阅该会话的所有客户端
  publishChatMessage(id, message);

  return NextResponse.json(
    { data: message },
    { status: 201 }
  );
}


