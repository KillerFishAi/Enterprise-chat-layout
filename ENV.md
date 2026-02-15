# 环境变量说明与检查

## 一、需要配置的变量

| 变量 | Next 应用 | WebSocket 服务 | 说明 |
|------|-----------|----------------|------|
| `DATABASE_URL` | 必填 | 必填 | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 生产必填 | 必填 | JWT 签名密钥，两服务必须一致 |
| `REDIS_URL` | 可选 | 必填 | Redis 连接，多实例/实时消息必填 |
| `SOCKET_PORT` | - | 可选 | WS 端口，默认 3001 |
| `INTERNAL_API_SECRET` | 必填（有 ws 时） | 必填 | 内部 API 密钥，ws 调 /api/internal/* 时携带，两服务必须一致 |
| `APP_URL` | - | 必填（离线推送时） | Next 应用地址，ws 调内部接口用；Docker 内网可用 `http://app:3000` |
| `COOKIE_SECURE` | 可选 | - | 生产 HTTPS 时设为 `true`，否则登录 Cookie 可能无法持久化 |
| `FCM_SERVER_KEY` / `GOOGLE_APPLICATION_CREDENTIALS` | 可选 | - | FCM 推送；不配则无 Android 离线推送 |
| `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_BUNDLE_ID` / `APNS_KEY_PATH` | 可选 | - | APNs 推送；不配则无 iOS 离线推送 |
| `NODE_ENV` | 可选 | 可选 | 生产部署建议设为 `production` |

## 二、如何确认是否已配置

### 1. 本地（开发机）

- **方式 A：看文件**  
  在项目根目录确认是否有 `.env` 或 `.env.local`，且其中包含上述变量（值可脱敏，只关心“有没有”）。
- **方式 B：跑检查脚本**  
  在项目根目录执行：
  ```bash
  npm run env:check
  ```
  只检查 Next 应用所需变量。  
  若还要检查 WebSocket 服务所需变量：
  ```bash
  npm run env:check:ws
  ```
  脚本只显示“是否已设置”，不会打印变量值。

### 2. 服务器上

- **方式 A：看环境来源**  
  确认环境变量是从哪里注入的（例如 `~/.bashrc`、`systemd`、Docker、面板等），并确认其中包含 `DATABASE_URL`、`JWT_SECRET`、`REDIS_URL`（若用 Redis/WS）。
- **方式 B：在项目目录跑同一脚本**  
  拉取代码后，在项目根目录执行：
  ```bash
  npm run env:check
  ```
  若服务器上会单独跑 WebSocket 服务，再执行：
  ```bash
  npm run env:check:ws
  ```
- **方式 C：命令行查看（仅确认是否存在，不要在生产机打印敏感值）**  
  Linux/macOS 示例（只检查“是否有值”）：
  ```bash
  [ -n "$DATABASE_URL" ] && echo "DATABASE_URL 已设置" || echo "DATABASE_URL 未设置"
  [ -n "$JWT_SECRET" ] && echo "JWT_SECRET 已设置" || echo "JWT_SECRET 未设置"
  [ -n "$REDIS_URL" ] && echo "REDIS_URL 已设置" || echo "REDIS_URL 未设置"
  ```
  Windows PowerShell 示例：
  ```powershell
  if ($env:DATABASE_URL) { "DATABASE_URL 已设置" } else { "DATABASE_URL 未设置" }
  if ($env:JWT_SECRET) { "JWT_SECRET 已设置" } else { "JWT_SECRET 未设置" }
  if ($env:REDIS_URL) { "REDIS_URL 已设置" } else { "REDIS_URL 未设置" }
  ```

## 三、生产环境 env 样例

项目根目录 **`.env.example`** 已按生产环境整理，包含：

- **通用**：`NODE_ENV`、`DATABASE_URL`、`JWT_SECRET`、`REDIS_URL`
- **Next**：`COOKIE_SECURE`、`INTERNAL_API_SECRET`
- **WebSocket**：`SOCKET_PORT`、`APP_URL`、`INTERNAL_API_SECRET`
- **推送（可选）**：`FCM_SERVER_KEY`、`APNS_*`

部署步骤建议：

1. 复制 `.env.example` 为 `.env`（或 Docker 使用的 `env_file` 路径）。
2. 必改项：`JWT_SECRET`、`INTERNAL_API_SECRET` 改为足够长的随机字符串（如 `openssl rand -base64 32`）。
3. 按实际环境填写 `DATABASE_URL`、`REDIS_URL`；Docker Compose 内网可用 `http://app:3000` 作为 `APP_URL`。
4. 若启用 HTTPS，将 `COOKIE_SECURE` 设为 `true`。
5. 需要离线推送时再配置 FCM/APNs 相关变量。

Docker 部署时在项目根目录创建 `.env`（从 `.env.example` 复制并填值），Compose 会自动用其做变量替换；**务必**在 `.env` 中设置 `JWT_SECRET`、`INTERNAL_API_SECRET`，不要使用默认占位。

## 四、从哪里复制变量名（不写真实值）

可参考项目根目录的 **`.env.example`**，里面列出了所有变量名和注释；部署时复制为 `.env` 或 `.env.local`，再填入真实值。

## 五、小结

- **确认方式**：优先在项目根目录执行 `npm run env:check`（以及需要时的 `npm run env:check:ws`）。  
- **变量清单与说明**：见本文件表格和 `.env.example`。
