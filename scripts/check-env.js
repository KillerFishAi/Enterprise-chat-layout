/**
 * 检查环境变量是否已配置（不输出变量值，只显示是否已设置）
 * 用法: node scripts/check-env.js  或  npm run env:check
 * 可选: npm run env:check:ws 或 node scripts/check-env.js --ws 表示同时检查 WebSocket 所需变量
 * 会主动加载项目根目录的 .env 文件，与 Next.js 行为一致
 */
const path = require("path");
const fs = require("fs");

// 加载项目根目录的 .env，使 npm run env:check 能读到 .env 里的变量
function loadEnv() {
  const root = path.resolve(__dirname, "..");
  const envPath = path.join(root, ".env");
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eq = trimmed.indexOf("=");
          if (eq > 0) {
            const key = trimmed.slice(0, eq).trim();
            let val = trimmed.slice(eq + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = val;
          }
        }
      }
    }
  } catch (e) {
    // 忽略 .env 读取错误
  }
}
loadEnv();

const CHECK_WS = process.env.CHECK_WS === "1" || process.argv.includes("--ws");

const NEXT_APP_VARS = [
  { name: "DATABASE_URL", desc: "PostgreSQL 连接字符串（Next 应用 + Prisma）" },
  { name: "JWT_SECRET", desc: "JWT 签名密钥（生产环境必填）" },
  { name: "REDIS_URL", desc: "Redis 连接（可选，无则实时消息仅本机）" },
];

const WS_SERVER_VARS = [
  { name: "REDIS_URL", desc: "Redis 连接（WebSocket 服务必填）" },
  { name: "JWT_SECRET", desc: "JWT 签名密钥（WebSocket 鉴权必填）" },
  { name: "DATABASE_URL", desc: "数据库连接（WebSocket 成员校验必填）" },
  { name: "INTERNAL_API_SECRET", desc: "内部 API 密钥（离线推送等必填，与 Next 一致）" },
  { name: "APP_URL", desc: "Next 应用地址（离线推送时必填，如 http://app:3000）" },
  { name: "SOCKET_PORT", desc: "WebSocket 端口（可选，默认 3001）" },
];

function check(vars) {
  let allOk = true;
  for (const { name, desc } of vars) {
    const value = process.env[name];
    const set = value !== undefined && value !== "";
    if (!set) allOk = false;
    console.log(`  ${set ? "✓" : "✗"} ${name}  ${desc}`);
  }
  return allOk;
}

console.log("\n【Next 应用 / Prisma】");
const nextOk = check(NEXT_APP_VARS);

if (CHECK_WS) {
  console.log("\n【WebSocket 服务 (start:ws)】");
  const wsOk = check(WS_SERVER_VARS);
  if (!nextOk || !wsOk) {
    console.log("\n请设置缺失的环境变量（可参考 .env.example）\n");
    process.exit(1);
  }
} else {
  if (!nextOk) {
    console.log("\n请设置缺失的环境变量（可参考 .env.example）");
    console.log("检查 WebSocket 所需变量请执行: npm run env:check:ws\n");
    process.exit(1);
  }
}

console.log("\n环境变量检查通过。\n");
process.exit(0);
