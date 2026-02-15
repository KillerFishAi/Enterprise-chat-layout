# 在含中文等非 ASCII 路径下可靠执行 git（供 Cursor 终端或本机 PowerShell 调用）
# 用法：先 cd 到项目根目录，再执行 .\scripts\cursor-git.ps1 <git 子命令及参数>
# 示例：.\scripts\cursor-git.ps1 status
#       .\scripts\cursor-git.ps1 add -A
#       .\scripts\cursor-git.ps1 commit -m "message"
#       .\scripts\cursor-git.ps1 push origin main
#
# 原理：通过脚本所在目录推断仓库根，并尝试转为 Windows 8.3 短路径再执行 git，
# 避免 Git for Windows 在中文路径下误报 "not a git repository"。
# 注意：若在 Cursor 内置终端中因编码导致路径乱码，请在本机 PowerShell 中 cd 到
# 项目根后手动执行本脚本或 git。

$ErrorActionPreference = "Stop"
$repoRoot = (Get-Item $PSScriptRoot).Parent.FullName

# 尝试获取 8.3 短路径（仅含 ASCII），避免中文路径导致 git 识别失败
$workDir = $repoRoot
try {
    $fso = New-Object -ComObject Scripting.FileSystemObject
    $folder = $fso.GetFolder($repoRoot)
    if ($folder.ShortPath -and $folder.ShortPath -ne $repoRoot) {
        $workDir = $folder.ShortPath
    }
} catch {
    # 无 COM 或权限时沿用原路径
}

Set-Location -LiteralPath $workDir
& git @args
exit $LASTEXITCODE
