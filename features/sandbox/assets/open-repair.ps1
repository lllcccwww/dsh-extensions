<#
  Unelevated launcher for the Workspace sandbox repair.

  Reads the Workspace's own sandbox identity from its root ACL, then starts one
  elevated PowerShell window that runs the repair. UAC is the confirmation step;
  nothing has to be typed or pasted by hand.

  Exit codes: 0 window started, 2 bad arguments, 3 no sandbox identity,
  4 elevation refused or the window failed to start.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$WorkspacePath,
  [Parameter(Mandatory)][string]$WorkerPath,
  [switch]$Check
)

$ErrorActionPreference = 'Stop'

function Stop-Launcher([int]$Code, [string]$Message) {
  [Console]::Error.WriteLine('[dh-extensions] ' + $Message)
  exit $Code
}

if (-not (Test-Path -LiteralPath $WorkspacePath -PathType Container)) {
  Stop-Launcher 2 "工作区目录不存在：$WorkspacePath"
}
if (-not (Test-Path -LiteralPath $WorkerPath -PathType Leaf)) {
  Stop-Launcher 2 "修复脚本缺失：$WorkerPath"
}

$acl = Get-Acl -LiteralPath $WorkspacePath
$candidates = @($acl.Access | Where-Object { $_.IdentityReference.Value -like 'S-1-4-*' })
if ($candidates.Count -eq 0) {
  Stop-Launcher 3 "这个工作区的根目录没有 DSH 沙箱标识，可能不是 DSH 工作区"
}
# A nested Workspace can inherit its parent's identity; prefer the one set on
# this Workspace's own root.
$direct = @($candidates | Where-Object { -not $_.IsInherited })
$sid = if ($direct.Count -gt 0) { $direct[0].IdentityReference.Value } else { $candidates[0].IdentityReference.Value }

# Quote the paths here: Start-Process joins array items with spaces and does not
# add quoting of its own.
$launchArguments = '-NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File "{0}" -WorkspacePath "{1}" -Sid {2}' -f $WorkerPath, $WorkspacePath, $sid

if ($Check) {
  Write-Host "工作区：$WorkspacePath"
  Write-Host "沙箱标识：$sid"
  Write-Host "启动参数：$launchArguments"
  exit 0
}

try {
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -WorkingDirectory $WorkspacePath -ArgumentList $launchArguments | Out-Null
} catch {
  Stop-Launcher 4 ('没能打开管理员窗口：' + $_.Exception.Message)
}
exit 0
