# 2C4G Ubuntu 22.04 VPS 部署下一步

你已有：**2 核 4G、Ubuntu 22.04 LTS**。按下面顺序在服务器上执行即可。

---

## 1. SSH 登录服务器

在你本机终端执行（把 `你的服务器IP` 换成实际 IP，用户名不是 root 就改掉）：

```bash
ssh root@你的服务器IP
```

---

## 2. 安装 Docker 和 Docker Compose

在服务器上执行：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
```

检查：

```bash
docker --version
docker-compose --version
```

若提示没有 `docker-compose` 命令，可改用 Docker 官方安装方式（会带 `docker compose` 插件，命令是 `docker compose` 中间有空格）。

---

## 3. 把代码拉到服务器

选一个目录（例如 `/opt`），执行（**把仓库地址换成你自己的**）：

```bash
cd /opt
sudo git clone https://你的仓库地址.git enterprise-chat-layout
cd enterprise-chat-layout
```

若没有 Git 仓库：先把本地项目推到 GitHub/Gitee，再在服务器上 clone 该地址。

---

## 4. 修改 JWT 密钥（必做）

在服务器上，仍在项目目录：

```bash
cd /opt/enterprise-chat-layout
openssl rand -base64 32
```

复制输出的那一行。然后编辑配置：

```bash
nano docker-compose.yml
```

找到这一行：

```yaml
JWT_SECRET: CHANGE_ME_IN_PRODUCTION
```

改成（把下面 `你复制的随机字符串` 换成上一步生成的内容）：

```yaml
JWT_SECRET: 你复制的随机字符串
```

保存：`Ctrl+O` 回车，`Ctrl+X` 退出。

---

## 5. 构建并启动

仍在项目目录执行：

```bash
docker-compose up -d --build
```

等待构建和启动完成（第一次会拉镜像、编译 Next.js，可能几分钟）。查看日志确认无报错：

```bash
docker-compose logs -f app
```

看到有监听 3000 或 Next.js 相关输出即可，按 `Ctrl+C` 退出日志。

---

## 6. 放行 3000 端口（防火墙）

Ubuntu 若开了 ufw，需要放行 3000：

```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

（若没开 ufw，可跳过；云厂商控制台若有「安全组 / 防火墙」，也需放行 3000 端口。）

---

## 7. 浏览器访问

在电脑浏览器打开：

**http://你的服务器IP:3000**

- 能打开**登录页**即表示部署成功。
- 点击「立即注册」注册账号，登录后即可使用聊天。

---

## 常用命令（在项目目录 `/opt/enterprise-chat-layout` 执行）

| 操作           | 命令 |
|----------------|------|
| 查看应用日志   | `docker-compose logs -f app` |
| 停止所有服务   | `docker-compose down` |
| 再次启动       | `docker-compose up -d` |
| 更新代码后重启 | `git pull` 然后 `docker-compose up -d --build` |

更详细说明见 **服务器部署步骤-新手版.md**。
