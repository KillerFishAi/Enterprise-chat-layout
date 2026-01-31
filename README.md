# 企业通讯应用（Enterprise Chat）

一个现代化的企业级即时通讯平台，使用Next.js 16、React 19和TypeScript构建。

## 功能特性

### 核心功能
- 💬 实时聊天消息
- 👥 通讯录管理
- 🤝 好友搜索和添加（支持账号、手机号、邮箱）
- 👤 用户资料卡片
- 🎯 群聊管理（移出群聊、禁言等）
- ⚙️ 个性化设置面板

### 用户认证
- 📱 手机号注册/登录
- 📧 邮箱注册/登录
- 👤 账号注册/登录

### 个性化功能
- 🎨 可自定义头像（8个默认头像 + 本地上传）
- 📝 可编辑部门和职位
- 🔔 通知偏好设置
- 🌍 多语言支持（中文为主）

## 技术栈

- **框架**: Next.js 16 + React 19
- **语言**: TypeScript
- **样式**: Tailwind CSS v4
- **UI组件**: Radix UI + shadcn/ui
- **表单**: React Hook Form + Zod验证
- **图标**: Lucide React
- **主题**: next-themes（支持浅色/深色模式）

## 项目结构

```
├── app/
│   ├── login/          # 登录页面
│   ├── register/       # 注册页面
│   ├── page.tsx        # 主聊天页面
│   ├── layout.tsx      # 根布局
│   └── globals.css     # 全局样式 + 语义化色彩令牌
├── components/
│   ├── chat/           # 聊天相关组件
│   │   ├── chat-area.tsx
│   │   ├── chat-sidebar.tsx
│   │   ├── message-list.tsx
│   │   ├── message-input.tsx
│   │   ├── contacts-list.tsx
│   │   ├── group-settings.tsx
│   │   ├── settings-panel.tsx
│   │   ├── add-friend-panel.tsx
│   │   ├── avatar-picker.tsx
│   │   └── user-profile-popup.tsx
│   └── ui/             # 基础UI组件
├── lib/                # 工具函数
├── hooks/              # 自定义hooks
└── public/             # 静态资源
```

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 打开浏览器
open http://localhost:3000
```

### 生产构建

```bash
# 构建应用
npm run build

# 启动生产服务器
npm start
```

## 部署

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

### 快速部署到Vercel

```bash
npm install -g vercel
vercel
```

### Docker部署

```bash
docker-compose up -d
```

## 使用说明

### 首次使用
1. 访问 `/register` 进行账号注册
2. 使用账号在 `/login` 登录
3. 进入主页面进行聊天

### 功能导航
- **消息**: 查看对话和群聊
- **通讯录**: 浏览所有联系人
- **设置**: 修改头像、部门、职位、通知偏好、语言设置
- **添加好友**: 通过账号、手机号或邮箱搜索并添加

### 群聊操作
- 点击群成员头像查看资料
- 管理员可移出成员或禁言

## 设计系统

应用采用语义化色彩令牌设计系统，支持浅色和深色主题自动切换：

```css
/* 语义化令牌示例 */
--background       /* 页面背景 */
--foreground       /* 文本颜色 */
--primary          /* 主操作色 */
--destructive      /* 删除/警告色 */
--muted            /* 辅助颜色 */
--chat-bubble-own  /* 自己的消息气泡 */
--success          /* 成功色 */
--warning          /* 警告色 */
```

## 环境变量

当前应用无需环境变量即可运行。生产部署时可添加：

```env
# 可选：API端点配置
NEXT_PUBLIC_API_URL=https://api.example.com
```

## 浏览器支持

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 许可证

MIT

## 贡献

欢迎提交问题和改进建议！
