#!/bin/sh
# 在项目根目录执行：将当前所有改动提交并推送到远程仓库
# 用法：cd 到项目根目录后执行 sh scripts/git-push-latest.sh

cd "$(dirname "$0")/.." || exit 1

if [ -z "$(git status --porcelain)" ]; then
  echo "没有需要提交的改动。"
  exit 0
fi

echo "当前改动："
git status --short

git add -A
git commit -m "feat: IM 架构升级 - 推送/未读数/批量写入/增量同步与 Message 扩展

- 推送: lib/push-notification.ts FCM/APNs 抽象，静默摘要与 unreadCount
- 离线: ws-server 入队时调用内部推送 API，未读数 Redis 与已读扣减
- 设备: DeviceToken 模型与 POST /api/me/device-token，内部 /api/internal/push
- 同步: sync 基于 seqId 索引注释，增量拉取优化
- 消息: message-buffer 500ms/50 条 createMany，POST 返回 202 暂存消息
- 模型: Message.contentJson 预留，DeviceToken 表迁移"

if ! git push; then
  echo "推送失败。若需先拉取: git pull --rebase 后再执行本脚本。"
  exit 1
fi
echo "已提交并推送到远程仓库。"
