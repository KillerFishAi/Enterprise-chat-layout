import Redis from "ioredis";

let redis: Redis | null = null;

const ONLINE_KEY_PREFIX = "user:lastSeen:";
const ONLINE_TTL_SEC = 90;

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (redis) return redis;
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 3 });
    redis.on("error", (err) => console.error("[redis] error:", err));
    return redis;
  } catch (err) {
    console.error("[redis] connect failed:", err);
    return null;
  }
}

export async function setUserOnline(userId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  const key = `${ONLINE_KEY_PREFIX}${userId}`;
  await client.set(key, Date.now().toString(), "EX", ONLINE_TTL_SEC);
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  const key = `${ONLINE_KEY_PREFIX}${userId}`;
  const val = await client.get(key);
  return val != null;
}

export async function getOnlineUserIds(userIds: string[]): Promise<Set<string>> {
  const client = getRedis();
  if (!client || userIds.length === 0) return new Set();
  const keys = userIds.map((id) => `${ONLINE_KEY_PREFIX}${id}`);
  const vals = await client.mget(...keys);
  const online = new Set<string>();
  userIds.forEach((id, i) => {
    if (vals[i] != null) online.add(id);
  });
  return online;
}
