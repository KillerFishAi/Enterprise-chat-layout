/**
 * Standalone WebSocket server for chat messages.
 * Subscribes to Redis "chat:messages" and emits to Socket.IO rooms.
 * Requires: REDIS_URL, JWT_SECRET, DATABASE_URL
 * Run: REDIS_URL=redis://localhost:6379 JWT_SECRET=xxx node server/ws-server.js
 * Port: 3001 by default (SOCKET_PORT env).
 */
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
const REDIS_URL = process.env.REDIS_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!REDIS_URL) {
  console.error("REDIS_URL is required for WebSocket server");
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error("JWT_SECRET is required for WebSocket server");
  process.exit(1);
}

const prisma = new PrismaClient();

function getTokenFromHandshake(handshake) {
  const authToken = handshake.auth?.token;
  if (authToken && typeof authToken === "string") return authToken;
  const cookie = handshake.headers?.cookie;
  if (cookie) {
    const match = cookie.match(/token=([^;]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

async function checkMembership(userId, conversationId) {
  const member = await prisma.conversationMember.findFirst({
    where: { userId, conversationId },
  });
  return !!member;
}

const Redis = require("ioredis");
const redisSub = new Redis(REDIS_URL);
const CHAT_CHANNEL = "chat:messages";

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

io.use((socket, next) => {
  const token = getTokenFromHandshake(socket.handshake);
  if (!token) {
    return next(new Error("未提供认证令牌"));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.userId) {
      return next(new Error("无效的认证令牌"));
    }
    socket.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error("无效或过期的认证令牌"));
  }
});

redisSub.subscribe(CHAT_CHANNEL);
redisSub.on("message", (channel, message) => {
  if (channel !== CHAT_CHANNEL) return;
  try {
    const { chatId, payload } = JSON.parse(message);
    io.to(chatId).emit("message", payload);
  } catch (err) {
    console.error("ws-server: invalid message", err);
  }
});
redisSub.on("error", (err) => console.error("ws-server: Redis sub error", err));

io.on("connection", (socket) => {
  socket.on("join", async (chatId) => {
    if (!chatId || typeof chatId !== "string") return;
    try {
      const isMember = await checkMembership(socket.userId, chatId);
      if (isMember) {
        socket.join(chatId);
      } else {
        socket.emit("error", { message: "无权访问该会话" });
      }
    } catch (err) {
      console.error("ws-server: join check error", err);
      socket.emit("error", { message: "加入会话失败" });
    }
  });

  socket.on("leave", (chatId) => {
    if (chatId && typeof chatId === "string") {
      socket.leave(chatId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});
