# 企业通讯应用 - 部署步骤

**当前方案：直接部署到服务器**（不要求在本地先跑通）。

新手建议按 **[服务器部署步骤-新手版.md](./服务器部署步骤-新手版.md)** 逐步操作；下面为简要版与可选内容。

---

## 一、直接部署到服务器（推荐路径）

### 前提

- 能 SSH 登录服务器（Linux 推荐）。
- 服务器已安装 **Docker** 和 **Docker Compose**（推荐），或 **Node.js 18+** + **PostgreSQL**。
- 项目代码在 Git 仓库中，且 **prisma/migrations** 已提交（当前项目已包含初始迁移）。

---

### 方式一：Docker Compose（推荐）

1. **在服务器上拉取代码**  
   `git clone <你的仓库地址>`，然后 `cd enterprise-chat-layout`（或你的项目目录名）。

2. **修改生产密钥**  
   编辑 `docker-compose.yml`，将 `JWT_SECRET: CHANGE_ME_IN_PRODUCTION` 改为随机长字符串（可用 `openssl rand -base64 32` 生成）。

3. **构建并启动**  
   ```bash
   docker-compose up -d --build
   ```
   会先启动 PostgreSQL，再启动应用；应用启动时会自动执行 `npx prisma migrate deploy` 建表。

4. **验证**  
   浏览器访问 **http://服务器IP:3000**，能打开登录页即成功。先注册再登录即可使用。

**常用命令**：`docker-compose logs -f app` 看日志；`docker-compose down` 停止；`docker-compose restart app` 仅重启应用。

---

### 方式二：Node + PM2 + 本机 PostgreSQL

1. 服务器安装 Node.js 18+ 与 PostgreSQL，创建数据库和用户。
2. `git clone` 项目，`cd` 进项目目录，执行 `npm install`。
3. 在项目根目录创建 `.env`，填写 `DATABASE_URL`（PostgreSQL 连接串）和 `JWT_SECRET`（随机长字符串）。
4. 执行 `npx prisma migrate deploy`，再 `npm run build`。
5. 使用 PM2：`pm2 start npm --name chat-app -- start`，`pm2 save`，`pm2 startup`。
6. 访问 **http://服务器IP:3000** 验证。

---

## 二、部署后建议

- **JWT_SECRET**：生产环境必须使用随机长字符串，不要用默认值。
- **HTTPS**：对外访问建议用 Nginx/Caddy 反向代理到 3000 端口并配置 SSL。
- **防火墙**：若直接暴露 3000，需在防火墙中放行该端口；或只暴露 80/443，由反向代理转发。
- **数据库备份**：对 PostgreSQL 做定期备份（如 `pg_dump` 或托管备份）。

---

## 三、常见问题

**Q：迁移报错 `relation "User" does not exist`？**  
A：确认 `prisma/migrations` 目录存在且包含 `20260128000000_init`，再执行 `npx prisma migrate deploy`。

**Q：Docker 启动后访问 3000 无响应？**  
A：执行 `docker-compose logs -f app` 查看日志；检查 `docker-compose ps` 确认 `db` 已健康，且 `DATABASE_URL` 与 `docker-compose.yml` 中一致。

**Q：登录后白屏或转圈？**  
A：浏览器 F12 看 Network 和 Console。常见原因：未登录被重定向、接口 401（Cookie）、或访问地址/端口与前端不一致。

---

## 四、可选：本地运行

若之后需要在本地跑通再部署，可参考项目中的 **本地运行步骤-新手版.md**（当前方案已改为直接部署，该文件会引导至服务器部署文档）。
