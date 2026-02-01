/**
 * Standalone WebSocket server for chat messages.
 * Subscribes to Redis "chat:messages" and emits to Socket.IO rooms.
 * Run: REDIS_URL=redis://localhost:6379 node server/ws-server.js
 * Port: 3001 by default (SOCKET_PORT env).
 */
const http = require("http");
const { Server } = require("socket.io");

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("REDIS_URL is required for WebSocket server");
  process.exit(1);
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
  socket.on("join", (chatId) => {
    if (chatId && typeof chatId === "string") {
      socket.join(chatId);
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
