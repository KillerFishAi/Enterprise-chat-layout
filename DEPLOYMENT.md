# 部署指南

本文说明如何将企业通讯应用部署到生产环境，包括 Docker 部署与 AWS 部署要点。

## 一、部署前检查

1. **环境变量**  
   在项目根目录执行：
   ```bash
   npm run env:check      # Next 应用
   npm run env:check:ws   # 若单独跑 WebSocket 服务，再执行此项
   ```
   变量说明见 [ENV.md](./ENV.md) 与 [.env.example](./.env.example)。

2. **生产必改项**  
   - `JWT_SECRET`、`INTERNAL_API_SECRET`：改为足够长的随机字符串（如 `openssl rand -base64 32`）。  
   - 使用 HTTPS 时设置 `COOKIE_SECURE=true`。  
   - 若 WebSocket 与页面不同端口或域名，配置 `NEXT_PUBLIC_WS_URL`（如 `wss://ws.你的域名`），否则前端默认连接 `当前 host:3001`。

3. **构建**  
   ```bash
   npm run build
   ```

## 二、Docker 部署（推荐单机/内网）

```bash
# 从 .env.example 复制为 .env 并填写 JWT_SECRET、INTERNAL_API_SECRET 等
docker-compose up -d
```

- 会启动：PostgreSQL、Redis、Next 应用（app）、WebSocket 服务（ws）。  
- 应用入口：`http://主机:3000`；WS 端口：`3001`。  
- 若浏览器通过公网访问且 WS 与页面同机同端口（例如反向代理把 /socket.io 转到 3001），需设置 `NEXT_PUBLIC_WS_URL` 为实际 WS 地址。

## 三、AWS 正式部署要点

### 3.1 架构建议

- **Next 应用**：可部署到 ECS/Fargate、Elastic Beanstalk，或配合 Lambda 使用（需满足 Next 运行要求）。  
- **WebSocket 服务**：与 Next 同机部署（同一 Task/实例）时，可共用一个域名，由 ALB/反向代理按路径（如 `/socket.io`）转发到 3001；若 WS 独立部署，需单独域名或子域名（如 `wss://ws.你的域名`），并配置 `NEXT_PUBLIC_WS_URL`。  
- **数据库**：使用 RDS PostgreSQL，`DATABASE_URL` 指向 RDS 端点。  
- **Redis**：使用 ElastiCache Redis，`REDIS_URL` 指向 ElastiCache 端点。  
- **HTTPS**：用 ALB 或 CloudFront 终止 SSL，并设置 `COOKIE_SECURE=true`。

### 3.2 环境变量（AWS）

在 ECS Task 定义、Elastic Beanstalk 或 Lambda 配置中设置：

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | RDS PostgreSQL 连接串 |
| `JWT_SECRET` | 生产用随机密钥 |
| `REDIS_URL` | ElastiCache Redis 连接串 |
| `INTERNAL_API_SECRET` | 与 WS 服务一致，供内部调用 /api/internal/* |
| `APP_URL` | WS 服务访问 Next 的地址（如 `http://app:3000` 或内网 URL） |
| `COOKIE_SECURE` | HTTPS 时设为 `true` |
| `NEXT_PUBLIC_WS_URL` | 浏览器连 WS 的地址（如 `wss://ws.你的域名`），与 ALB/域名方案一致 |

### 3.3 健康检查

- 应用：`GET /api/health`（无需登录），返回 `{ ok, db, redis }`。  
- 可用于 ALB 或 ECS 健康检查。

### 3.4 数据库迁移

- 部署时需执行 Prisma 迁移：`npx prisma migrate deploy`。  
- Dockerfile 中已包含 `prisma migrate deploy`；若不用 Docker，在首次部署或发版时在运行 Next 的节点上执行一次。

### 3.5 多实例与 WebSocket

- 多实例部署 Next 时，WebSocket 需使用 Redis Adapter（项目已使用 `@socket.io/redis-adapter`），且所有 WS 实例连同一 ElastiCache，保证 Room 广播一致。  
- 离线推送由 WS 调用 Next 的 `/api/internal/push`，需保证 `APP_URL` 与 `INTERNAL_API_SECRET` 正确。

## 四、小结

- **代码与逻辑**：项目具备完整聊天、通讯录、群组、推送与离线队列逻辑，构建通过即可部署。  
- **正式上线前**：务必修改 `JWT_SECRET`、`INTERNAL_API_SECRET`，配置好 `DATABASE_URL`、`REDIS_URL` 与（按需）`NEXT_PUBLIC_WS_URL`，并启用 HTTPS 与 `COOKIE_SECURE`。  
- 更多变量说明见 [ENV.md](./ENV.md)。
