/**
 * 推送通知抽象层
 *
 * 统一接口，根据 deviceToken 所属平台（FCM / APNs）分发到对应通道。
 * - 私聊：推送文案「您收到一条新消息」
 * - 群聊：推送文案「[群名]有新动态」
 * - 推送包携带 unreadCount，供 App 角标红点展示
 */

import { prisma } from "@/lib/db";

// ─── 类型定义 ─────────────────────────────────────────────────

export type PushPlatform = "fcm" | "apns";

export interface DeviceTokenRecord {
  token: string;
  platform: PushPlatform;
}

export interface PushPayload {
  /** 通知标题（可选，部分场景静默） */
  title?: string;
  /** 通知正文 */
  body: string;
  /** 自定义数据，会带到客户端 */
  data: {
    /** 当前总未读数，用于角标 */
    unreadCount: number;
    /** 触发推送的会话 ID */
    chatId: string;
    /** 是否群聊 */
    isGroup: boolean;
    /** 会话名称（群名或对方昵称） */
    conversationName?: string;
    /** 消息 ID（可选，用于点击跳转） */
    messageId?: string;
  };
}

/** 根据 token 特征推断平台：FCM 通常较长且含冒号/连字符，APNs 为 64 位十六进制 */
export function inferPlatform(token: string): PushPlatform {
  const trimmed = token.trim();
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return "apns";
  return "fcm";
}

// ─── 获取用户设备 Token ───────────────────────────────────────

export async function getDeviceTokens(userId: string): Promise<DeviceTokenRecord[]> {
  try {
    const rows = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true, platform: true },
    });
    return rows.map((r) => ({
      token: r.token,
      platform: r.platform.toLowerCase() as PushPlatform,
    }));
  } catch (err) {
    console.error("[push] getDeviceTokens failed:", err);
    return [];
  }
}

// ─── 统一推送入口 ─────────────────────────────────────────────

/**
 * 向指定用户的所有设备发送推送。
 * 根据 token 的 platform 分发到 FCM 或 APNs。
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const tokens = await getDeviceTokens(userId);
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const { token, platform } of tokens) {
    try {
      if (platform === "fcm") {
        await sendFCM(token, payload);
      } else {
        await sendAPNs(token, payload);
      }
      sent++;
    } catch (err) {
      console.error(`[push] send failed (${platform}):`, err);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * 静默通知 + 摘要文案
 * - 私聊：您收到一条新消息
 * - 群聊：[群名]有新动态
 */
export function buildPushPayload(options: {
  chatId: string;
  isGroup: boolean;
  conversationName?: string;
  unreadCount: number;
  messageId?: string;
}): PushPayload {
  const { chatId, isGroup, conversationName, unreadCount, messageId } = options;
  const body = isGroup
    ? (conversationName ? `[${conversationName}]有新动态` : "群聊有新动态")
    : "您收到一条新消息";

  return {
    title: "新消息",
    body,
    data: {
      unreadCount,
      chatId,
      isGroup,
      conversationName: conversationName ?? undefined,
      messageId,
    },
  };
}

// ─── FCM (Firebase Cloud Messaging) ───────────────────────────

async function sendFCM(token: string, payload: PushPayload): Promise<void> {
  const key = process.env.FCM_SERVER_KEY ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!key) {
    console.warn("[push] FCM not configured (FCM_SERVER_KEY or GOOGLE_APPLICATION_CREDENTIALS)");
    return;
  }

  // 使用 FCM HTTP v1 或 Legacy HTTP API
  const url = "https://fcm.googleapis.com/fcm/send";
  // FCM data 层所有值必须为字符串
  const data: Record<string, string> = {
    unreadCount: String(payload.data.unreadCount),
    chatId: payload.data.chatId,
    isGroup: String(payload.data.isGroup),
  };
  if (payload.data.conversationName) data.conversationName = payload.data.conversationName;
  if (payload.data.messageId) data.messageId = payload.data.messageId;

  const body = {
    to: token,
    notification: {
      title: payload.title,
      body: payload.body,
      sound: "default",
    },
    data,
    priority: "high",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FCM error ${res.status}: ${text}`);
  }
}

// ─── APNs (Apple Push Notification service) ───────────────────

async function sendAPNs(token: string, payload: PushPayload): Promise<void> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;
  const keyPath = process.env.APNS_KEY_PATH;

  if (!keyId || !teamId || !bundleId || !keyPath) {
    console.warn("[push] APNs not configured (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_PATH)");
    return;
  }

  // 使用 @parse/node-apn 或 node-apn 需要额外依赖；这里用 HTTP/2 的 APNs API 占位
  // 生产环境建议：npm install apn 或 node-apn，然后调用 provider.send(notification, token)
  const apnPayload = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      badge: payload.data.unreadCount,
      "mutable-content": 1,
    },
    ...payload.data,
    unreadCount: payload.data.unreadCount,
  };

  // 占位：实际发送需引入 apn 包并配置 .p8 证书
  console.log("[push] APNs (stub) would send to", token.slice(0, 16) + "...", apnPayload);
}
