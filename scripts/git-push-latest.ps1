# 在项目根目录执行：将当前所有改动提交并推送到远程仓库
# 用法：在 PowerShell 中 cd 到项目根目录后执行 .\scripts\git-push-latest.ps1

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
# 在含中文路径下用 8.3 短路径执行 git，避免 "not a git repository"
try {
    $fso = New-Object -ComObject Scripting.FileSystemObject
    $folder = $fso.GetFolder($repoRoot)
    if ($folder.ShortPath -and $folder.ShortPath -ne $repoRoot) { $repoRoot = $folder.ShortPath }
} catch { }
Set-Location -LiteralPath $repoRoot

$status = git status --porcelain
if (-not $status) {
    Write-Host "没有需要提交的改动。"
    exit 0
}

Write-Host "当前改动："
git status --short

git add -A
git commit -m "feat: IM 架构升级 - 推送/未读数/批量写入/增量同步与 Message 扩展

- 推送: lib/push-notification.ts FCM/APNs 抽象，静默摘要与 unreadCount
- 离线: ws-server 入队时调用内部推送 API，未读数 Redis 与已读扣减
- 设备: DeviceToken 模型与 POST /api/me/device-token，内部 /api/internal/push
- 同步: sync 基于 seqId 索引注释，增量拉取优化
- 消息: message-buffer 500ms/50 条 createMany，POST 返回 202 暂存消息
- 模型: Message.contentJson 预留，DeviceToken 表迁移"

$push = git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "推送失败。若需先拉取: git pull --rebase 后再执行本脚本。"
    exit 1
}
Write-Host "已提交并推送到远程仓库。"
