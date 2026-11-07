<#
  Elevated half of the Workspace sandbox repair.

  DSH lets a sandboxed command write only where both the signed-in user and the
  Workspace's own S-1-4-* sandbox identity are allowed. Directories created by
  another tool can miss that identity, and objects created before the grant was
  added carry no Low integrity label, so this script fixes both across the tree.

  Two APIs are deliberately avoided for the access entries:

  - icacls cannot add this identity ("No mapping between account names and
    security IDs"), because it resolves the SID before writing the DACL.
  - PowerShell's Set-Acl writes more than the access section; on an object whose
    DACL is protected it fails with "does not possess SeSecurityPrivilege".

  The file-system security API reads and writes only the access section.
  Windows PowerShell exposes it on FileSystemInfo; PowerShell 7 only through
  FileSystemAclExtensions. icacls is still used for the integrity label, which
  needs no account name.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$WorkspacePath,
  [Parameter(Mandatory)][string]$Sid,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Write-Result([string]$Text, [ConsoleColor]$Color) {
  Write-Host ''
  Write-Host $Text -ForegroundColor $Color
}

try {
  $sidObject = [System.Security.Principal.SecurityIdentifier]::new($Sid)
} catch {
  Write-Result "结果：失败 - 不是有效的 SID：$Sid" Red
  exit 1
}
if (-not (Test-Path -LiteralPath $WorkspacePath -PathType Container)) {
  Write-Result "结果：失败 - 目录不存在：$WorkspacePath" Red
  exit 1
}
$root = (Resolve-Path -LiteralPath $WorkspacePath).ProviderPath

# Re-read the root before touching anything: a rebuilt Workspace would carry a
# different sandbox identity, and repairing with a stale one is useless.
$rootAcl = Get-Acl -LiteralPath $root
if (@($rootAcl.Access | Where-Object { $_.IdentityReference.Value -eq $Sid }).Count -eq 0) {
  Write-Result "结果：失败 - 根目录权限里没有 $Sid，这个工作区可能已被重建" Red
  exit 1
}

# Same rights DSH grants its own Workspaces: write, delete, delete children.
$rights = [System.Security.AccessControl.FileSystemRights]'Write, Delete, DeleteSubdirectoriesAndFiles'
$propagation = [System.Security.AccessControl.PropagationFlags]::None
$allow = [System.Security.AccessControl.AccessControlType]::Allow
$dirInheritance = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
$accessSection = [System.Security.AccessControl.AccessControlSections]::Access

# Windows PowerShell exposes the security API on FileSystemInfo; PowerShell 7
# only through FileSystemAclExtensions. Probe once instead of per object.
$instanceApi = $null -ne [System.IO.DirectoryInfo].GetMethod(
  'GetAccessControl', [type[]]@($accessSection.GetType())
)

# Paths past MAX_PATH fail in the security API unless they carry the extended
# prefix; node_modules trees easily reach that depth.
function ConvertTo-SecurityPath([string]$Path) {
  if ($Path.StartsWith('\\?\')) {
    return $Path
  }
  if ($Path.Length -lt 248) {
    return $Path
  }
  if ($Path.StartsWith('\\')) {
    return '\\?\UNC\' + $Path.Substring(2)
  }
  return '\\?\' + $Path
}

function Get-AccessTarget {
  param([System.IO.FileSystemInfo]$Item)
  $path = ConvertTo-SecurityPath $Item.FullName
  if ($path -eq $Item.FullName) {
    return $Item
  }
  if ($Item -is [System.IO.DirectoryInfo]) {
    return [System.IO.DirectoryInfo]::new($path)
  }
  return [System.IO.FileInfo]::new($path)
}

function Get-AccessSecurity {
  param([System.IO.FileSystemInfo]$Item)
  $target = Get-AccessTarget $Item
  if ($instanceApi) {
    return $target.GetAccessControl($accessSection)
  }
  if ($target -is [System.IO.DirectoryInfo]) {
    return [System.IO.FileSystemAclExtensions]::GetAccessControl([System.IO.DirectoryInfo]$target, $accessSection)
  }
  return [System.IO.FileSystemAclExtensions]::GetAccessControl([System.IO.FileInfo]$target, $accessSection)
}

function Set-AccessSecurity {
  param([System.IO.FileSystemInfo]$Item, $Security)
  $target = Get-AccessTarget $Item
  if ($instanceApi) {
    $target.SetAccessControl($Security)
    return
  }
  if ($target -is [System.IO.DirectoryInfo]) {
    [System.IO.FileSystemAclExtensions]::SetAccessControl(
      [System.IO.DirectoryInfo]$target, [System.Security.AccessControl.DirectorySecurity]$Security
    )
    return
  }
  [System.IO.FileSystemAclExtensions]::SetAccessControl(
    [System.IO.FileInfo]$target, [System.Security.AccessControl.FileSecurity]$Security
  )
}

function Update-Entry {
  param([System.IO.FileSystemInfo]$Item)
  $security = Get-AccessSecurity $Item
  if (@($security.Access | Where-Object { $_.IdentityReference.Value -eq $Sid }).Count -gt 0) {
    return 'skip'
  }
  if ($DryRun) {
    return 'missing'
  }
  $inheritance = if ($Item -is [System.IO.DirectoryInfo]) {
    [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
  } else {
    [System.Security.AccessControl.InheritanceFlags]::None
  }
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $sidObject, $rights, $inheritance, $propagation, $allow
  )
  $security.AddAccessRule($rule)
  Set-AccessSecurity $Item $security
  return 'changed'
}

$scanSource = @'
using System;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;

// Bulk check: the same walk the script would do in PowerShell, but compiled, so
// a six-figure tree is checked in seconds instead of minutes.
public static class DhAclScan
{
    static string Ext(string path)
    {
        if (path.StartsWith(@"\\?\")) return path;
        if (path.Length < 248) return path;
        if (path.StartsWith(@"\\")) return @"\\?\UNC\" + path.Substring(2);
        return @"\\?\" + path;
    }

    public static long[] Scan(string root, string sid)
    {
        var id = new SecurityIdentifier(sid);
        long total = 0, missing = 0, failed = 0;
        var stack = new System.Collections.Generic.Stack<string>();
        stack.Push(root);
        while (stack.Count > 0)
        {
            var dirPath = stack.Pop();
            FileSystemInfo[] entries;
            try { entries = new DirectoryInfo(Ext(dirPath)).GetFileSystemInfos(); }
            catch { failed++; continue; }
            foreach (var entry in entries)
            {
                // Junctions and symlinks can point back up the tree.
                if ((entry.Attributes & FileAttributes.ReparsePoint) != 0) continue;
                total++;
                bool has = false;
                try
                {
                    var full = Ext(entry.FullName);
                    FileSystemSecurity security;
                    if (entry is DirectoryInfo) security = new DirectoryInfo(full).GetAccessControl(AccessControlSections.Access);
                    else security = new FileInfo(full).GetAccessControl(AccessControlSections.Access);
                    foreach (FileSystemAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier)))
                    {
                        if (rule.IdentityReference.Equals(id)) { has = true; break; }
                    }
                }
                catch { failed++; continue; }
                if (!has) missing++;
                if (entry is DirectoryInfo) stack.Push(entry.FullName);
            }
        }
        return new long[] { total, missing, failed };
    }
}
'@

function Invoke-AclScan {
  param([string]$RootPath, [string]$Identity)
  if (-not ('DhAclScan' -as [type])) {
    Add-Type -TypeDefinition $scanSource -Language CSharp
  }
  $result = [DhAclScan]::Scan($RootPath, $Identity)
  return [pscustomobject]@{
    Total = [int]$result[0]
    Missing = [int]$result[1]
    Failed = [int]$result[2]
  }
}

$backup = ''
if (-not $DryRun) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup = Join-Path $env:TEMP "dh-sandbox-acl-$stamp.txt"
  try {
    Set-Content -LiteralPath $backup -Value $rootAcl.Sddl -Encoding ascii
  } catch {
    $backup = "（备份失败：$($_.Exception.Message)）"
  }
}

Write-Host "工作区：$root"
Write-Host "沙箱标识：$Sid"
if ($DryRun) {
  Write-Host '检查模式：只统计，不修改任何权限' -ForegroundColor Yellow
} else {
  Write-Host "根目录权限已备份：$backup"
}

# A compiled pass settles the common case in seconds, and tells us whether the
# expensive propagation write is needed at all.
$scan = $null
try {
  Write-Host '全量核对…'
  $scan = Invoke-AclScan -RootPath $root -Identity $Sid
  Write-Host ("核对结果：对象 {0} 个，缺少权限项 {1}，读取失败 {2}" -f $scan.Total, $scan.Missing, $scan.Failed)
} catch {
  Write-Host "核对器不可用，改为逐个核对：$($_.Exception.Message)" -ForegroundColor Yellow
}
$scanClean = $null -ne $scan -and $scan.Missing -eq 0 -and $scan.Failed -eq 0

if ($DryRun -and $null -ne $scan) {
  Write-Result ("检查结果：{0} 个对象缺少沙箱权限" -f $scan.Missing) Yellow
  exit 0
}

# Fast path: writing the root DACL makes the system apply every inheritable ACE
# to the existing descendants in one operation. The root already carries the
# real ACE, so a temporary Read ACE forces the change and is removed right after;
# without it a no-op write would not propagate anything.
$fastPath = 'skipped'
if (-not $DryRun -and -not $scanClean) {
  Write-Host '先在根目录上触发一次权限下推…'
  try {
    $rootItem = Get-Item -LiteralPath $root -Force
    $probe = [System.Security.AccessControl.FileSystemAccessRule]::new(
      $sidObject, [System.Security.AccessControl.FileSystemRights]'Read', $dirInheritance, $propagation, $allow
    )
    # An interrupted run can leave the probe behind; an explicit ACE for this
    # identity without write rights can only be that probe.
    $security = Get-AccessSecurity $rootItem
    $stale = @($security.Access | Where-Object {
      $_.IdentityReference.Value -eq $Sid -and -not $_.IsInherited -and
      (($_.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::Write) -eq 0)
    })
    foreach ($staleRule in $stale) {
      $security.RemoveAccessRule($staleRule) | Out-Null
    }
    if ($stale.Count -gt 0) {
      Set-AccessSecurity $rootItem $security
    }

    $security = Get-AccessSecurity $rootItem
    $security.AddAccessRule($probe)
    Set-AccessSecurity $rootItem $security

    $security = Get-AccessSecurity $rootItem
    $security.RemoveAccessRule($probe) | Out-Null
    Set-AccessSecurity $rootItem $security
    $fastPath = 'done'
  } catch {
    $fastPath = "failed: $($_.Exception.Message)"
  }
  # Re-check so the per-object loop is skipped when propagation covered it.
  if ($fastPath -eq 'done') {
    try {
      $scan = Invoke-AclScan -RootPath $root -Identity $Sid
      Write-Host ("核对结果：对象 {0} 个，缺少权限项 {1}，读取失败 {2}" -f $scan.Total, $scan.Missing, $scan.Failed)
      $scanClean = $scan.Missing -eq 0 -and $scan.Failed -eq 0
    } catch {
      $scanClean = $false
    }
  }
}

$pending = [System.Collections.Generic.Queue[object]]::new()
$pending.Enqueue((Get-Item -LiteralPath $root -Force))
$total = 0
$changed = 0
$skipped = 0
$missing = 0
$failures = [System.Collections.Generic.List[string]]::new()

$runLoop = $true
if ($DryRun) {
  Write-Host '开始逐个核对…' -ForegroundColor Yellow
} elseif ($scanClean) {
  $total = $scan.Total
  $skipped = $scan.Total
  $runLoop = $false
  Write-Host '全量核对通过，不需要逐个补充'
} else {
  Write-Host '开始逐个核对并补齐；对象多时需要几分钟，不要关窗口…' -ForegroundColor Yellow
}

if ($runLoop) {
  while ($pending.Count -gt 0) {
    $node = $pending.Dequeue()
    $total += 1
    try {
      switch (Update-Entry $node) {
        'changed' { $changed += 1 }
        'missing' { $missing += 1 }
        default { $skipped += 1 }
      }
    } catch {
      $failures.Add("$($node.FullName) -> $($_.Exception.Message)")
    }

    if ($node -is [System.IO.DirectoryInfo]) {
      # Enumerate through .NET so directories past MAX_PATH are still walked;
      # Get-ChildItem cannot open those paths.
      try {
        $directory = [System.IO.DirectoryInfo]::new((ConvertTo-SecurityPath $node.FullName))
        foreach ($child in $directory.EnumerateFileSystemInfos()) {
          # Junctions and symlinks can point back up the tree; skip them.
          if (($child.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            continue
          }
          $pending.Enqueue($child)
        }
      } catch {
        $failures.Add("$($node.FullName) -> 无法列出子项：$($_.Exception.Message)")
      }
    }

    if ($total % 200 -eq 0) {
      Write-Progress -Activity '修复工作区权限' -Status "已检查 $total 个对象"
    }
  }
  Write-Progress -Activity '修复工作区权限' -Completed
}

$labelFailures = [System.Collections.Generic.List[string]]::new()
if (-not $DryRun) {
  Write-Host '设置低完整性标签…'
  # icacls reports per-object denials on stderr; with ErrorActionPreference
  # Stop a redirected native error would abort before the summary prints.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $labelOutput = & icacls.exe $root /setintegritylevel '(OI)(CI)L' /T 2>&1
  $labelExit = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($labelExit -ne 0) {
    $labelFailures.Add("icacls 退出码 $labelExit")
    $labelOutput | Select-Object -Last 5 | ForEach-Object { $labelFailures.Add("$_") }
  }
}

$verified = @((Get-Acl -LiteralPath $root).Access | Where-Object { $_.IdentityReference.Value -eq $Sid }).Count -gt 0

Write-Host ''
if ($fastPath -eq 'done') {
  Write-Host '根目录下推：已完成，子对象应已继承'
} elseif ($fastPath -like 'failed:*') {
  Write-Host ("根目录下推：失败（{0}）；已改为逐个补充" -f $fastPath.Substring('failed: '.Length)) -ForegroundColor Yellow
}
Write-Host ("对象 {0} 个：补充 {1}，原本已有 {2}，读写权限失败 {3}" -f $total, $changed, $skipped, $failures.Count)
if ($failures.Count -gt 0) {
  $failures | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  if ($failures.Count -gt 10) {
    Write-Host ("  …还有 {0} 条" -f ($failures.Count - 10)) -ForegroundColor Red
  }
}
if ($DryRun) {
  Write-Result ("检查结果：{0} 个对象缺少沙箱权限" -f $missing) Yellow
  exit 0
}
if ($failures.Count -gt 0 -or -not $verified) {
  Write-Result '结果：失败 - 有对象没能修复，请把本窗口内容发给助手' Red
  exit 1
}
if ($labelFailures.Count -gt 0) {
  Write-Host ''
  Write-Host '完整性标签没能设置：' -ForegroundColor Red
  $labelFailures | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Write-Result '结果：部分成功 - 权限项已补齐，但低完整性标签没设置好；把本窗口内容发给助手' Yellow
  exit 1
}
Write-Result '结果：成功 - 整个目录树已补上沙箱权限和低完整性标签' Green
Write-Host '请回到该工作区试一次写操作；如果仍然失败，把本窗口内容发给助手。'
exit 0
