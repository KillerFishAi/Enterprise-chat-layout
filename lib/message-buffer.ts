/**
 * 消息批量写入 Buffer
 *
 * 高并发下避免每条消息都 prisma.message.create，改为：
 * - 每 500ms 或凑齐 50 条时使用 createMany 批量写入
 * - 写入后按 (conversationId, seqId) 查回完整记录并发布到 Redis
 */

import { prisma } from "@/lib/db";
import { publishChatMessage } from "@/lib/chat-events";
import { addMessageToDLQ } from "@/lib/redis";

const FLUSH_INTERVAL_MS = 500;
const FLUSH_THRESHOLD = 50;

export type BufferedMessage = {
  conversationId: string;
  senderId: string;
  seqId: number;
  clientMsgId: string | null;
  content: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
  fileUrl: string | null;
  fileName: string | null;
  fileSize: string | null;
  replyToMessageId: string | null;
};

const buffer: BufferedMessage[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * 将一条消息加入缓冲；达到阈值或定时触发时批量写入并发布
 */
export function pushToMessageBuffer(msg: BufferedMessage): void {
  buffer.push(msg);
  if (buffer.length >= FLUSH_THRESHOLD) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush();
  } else {
    scheduleFlush();
  }
}

/**
 * 立即执行一次 flush（用于测试或优雅关闭）
 */
export async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  // ── 第一步：尝试批量写入（带 skipDuplicates，避免单条重复拖垮整批） ──
  try {
    await prisma.message.createMany(
      {
        data: batch.map((m) => ({
          conversationId: m.conversationId,
          senderId: m.senderId,
          seqId: m.seqId,
          clientMsgId: m.clientMsgId || undefined,
          content: m.content,
          type: m.type,
          fileUrl: m.fileUrl,
          fileName: m.fileName,
          fileSize: m.fileSize,
          replyToMessageId: m.replyToMessageId || undefined,
        })),
        skipDuplicates: true,
      } as any
    );
  } catch (err) {
    console.error("[message-buffer] createMany failed, falling back to per-message insert:", err);

    // ── 降级策略：逐条 create，尽量“能救几条是几条” ──
    for (const m of batch) {
      try {
        await prisma.message.create(
          {
            data: {
              conversationId: m.conversationId,
              senderId: m.senderId,
              seqId: m.seqId,
              clientMsgId: m.clientMsgId || undefined,
              content: m.content,
              type: m.type,
              fileUrl: m.fileUrl,
              fileName: m.fileName,
              fileSize: m.fileSize,
              replyToMessageId: m.replyToMessageId || undefined,
            },
          } as any
        );
      } catch (innerErr) {
        // 单条依然失败：记录为“死信”，供后续排障
        console.error(
          `[message-buffer] dropped message seqId=${m.seqId}, clientMsgId=${m.clientMsgId ?? "null"}`,
          innerErr
        );
        void addMessageToDLQ({
          conversationId: m.conversationId,
          senderId: m.senderId,
          seqId: m.seqId,
          clientMsgId: m.clientMsgId,
          reason: `[message-buffer] insert failed: ${
            innerErr instanceof Error ? innerErr.message : String(innerErr)
          }`,
        });
      }
    }
  }

  // 按 (conversationId, seqId) 查回完整记录以获取 id 和 relation
  const orConditions = batch.map((m) => ({
    conversationId: m.conversationId,
    seqId: m.seqId,
  }));

  const created = (await prisma.message.findMany(
    {
      where: { OR: orConditions },
      include: {
        sender: true,
        replyTo: {
          select: { id: true, content: true, type: true, sender: { select: { nickname: true } } },
        },
      },
    } as any
  )) as any[];

  for (const msg of created) {
    const payload = mapToPayload(msg);
    await publishChatMessage(msg.conversationId, payload);
  }
}

function mapToPayload(message: any) {
  const base = {
    id: message.id,
    seqId: message.seqId,
    clientMsgId: message.clientMsgId ?? undefined,
    content: message.content,
    timestamp: message.createdAt.toISOString(),
    senderId: message.senderId,
    senderName: message.sender.nickname,
    isOwn: false, // 由各端根据 senderId 判断
    status: "sent" as const,
    type: message.type.toLowerCase() as "text" | "image" | "video" | "file",
    fileUrl: message.fileUrl,
    fileName: message.fileName ?? undefined,
    fileSize: message.fileSize ?? undefined,
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
