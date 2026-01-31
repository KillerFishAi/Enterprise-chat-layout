# 企业通讯应用部署指南

## 部署前准备

### 1. 环境变量配置
复制 `.env.example` 为 `.env`（不要提交到 git），并填写：

- **DATABASE_URL**：PostgreSQL 连接串，例如  
  `postgresql://用户名:密码@localhost:5432/数据库名`
- **JWT_SECRET**：生产环境务必改为随机长字符串

### 2. 数据库迁移（首次部署必做）
```bash
# 本地/服务器：创建迁移并应用
npx prisma migrate dev --name init

# 生产仅应用已有迁移
npx prisma migrate deploy
```

### 3. 生产构建检查
```bash
npm install
npm run build
npm start
```
确保本地生产环境正常运行

### 3. 性能优化
- 项目已配置图片优化禁用（`unoptimized: true`）
- TypeScript构建错误已忽略
- 支持自动化部署

## 推荐部署方案

### 方案A：Vercel（最简单，推荐）
1. 代码推送到GitHub
2. vercel.com 登录
3. 导入项目
4. 自动部署完成

### 方案B：Docker + 自建服务器
```bash
# 使用 docker-compose（推荐，含 PostgreSQL）
docker-compose up -d --build
# 首次启动会自动执行数据库迁移

# 或仅构建并运行应用（需自行配置 DATABASE_URL 与 JWT_SECRET）
docker build -t chat-app .
docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_SECRET=... chat-app
```

### 方案C：传统服务器（使用PM2）
```bash
npm install
npm run build
pm2 start npm --name chat-app -- start
```

## 域名配置
- Vercel：自动分配 .vercel.app 域名，可绑定自定义域名
- 自建服务器：使用Nginx反向代理 + 配置SSL证书

## 监控和维护
- Vercel：内置Analytics和性能监控
- 自建服务器：使用PM2 Plus / Datadog / New Relic

## 常见问题

Q: 应用支持哪些浏览器？
A: 支持所有现代浏览器（Chrome, Firefox, Safari, Edge）

Q: 数据存储在哪？
A: 使用 PostgreSQL 存储用户、会话、消息与好友关系；部署时需配置 DATABASE_URL 并执行 Prisma 迁移。

Q: 支持HTTPS吗？
A: Vercel自动配置，自建服务器需配置SSL证书
