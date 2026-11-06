# Bring the DeepSeek Harness (Electron) main window back to the foreground on Windows.
#
# Contract:
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File focus-window.ps1
#     -ProcessId 12345 [-Assembly C:\...\FocusNative.dll]
#   * -ProcessId <int>: pid that owns the window (the Electron browser process).
#     Omitted or 0 falls back to matching the process name "DeepSeek*".
#   * -Assembly: precompiled helper the Host builds at startup. Compiling the same
#     P/Invoke surface inline with Add-Type costs ~2s per click; loading this DLL
#     costs ~30ms, which keeps a click at a few hundred milliseconds.
#   * stdout's last line is "FOCUSED=1" or "FOCUSED=0"; the script always exits 0.
#
# Order: restore a minimized window, then raise it. The Alt tap grants this
# process foreground permission so SetForegroundWindow is not refused by the
# Windows foreground lock (the click belongs to the shell, not to us).
# ASCII only: Windows PowerShell 5.1 reads a BOM-less script as the ANSI code page.

param(
    [int]$ProcessId = 0,
    [string]$Assembly = ''
)

$ErrorActionPreference = 'SilentlyContinue'

if ($Assembly -ne '' -and (Test-Path -LiteralPath $Assembly)) {
    try { [void][System.Reflection.Assembly]::LoadFrom($Assembly) } catch { }
}

if (-not ('FocusNative' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class FocusNative
{
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
}

$script:bestHandle = [System.IntPtr]::Zero
$script:bestScore = -1
$script:bestVisible = $false

# The pid check is the cheap Win32 call, so it runs before reading a title or
# a rectangle: only windows owned by the application are inspected.
function Find-TargetWindow([System.Collections.Generic.HashSet[uint32]]$owners) {
    $script:bestHandle = [System.IntPtr]::Zero
    $script:bestScore = -1
    $script:bestVisible = $false

    $callback = [FocusNative+EnumWindowsProc]{
        param($handle, $state)

        $owner = [uint32]0
        [void][FocusNative]::GetWindowThreadProcessId($handle, [ref]$owner)
        if (-not $owners.Contains($owner)) { return $true }

        $text = New-Object System.Text.StringBuilder 256
        [void][FocusNative]::GetWindowText($handle, $text, 256)
        if ($text.Length -eq 0) { return $true }

        $rect = New-Object FocusNative+RECT
        [void][FocusNative]::GetWindowRect($handle, [ref]$rect)
        $visible = [FocusNative]::IsWindowVisible($handle)
        $score = ($rect.Right - $rect.Left) * ($rect.Bottom - $rect.Top)
        if ($visible) { $score += 1000000000 }

        if ($score -gt $script:bestScore) {
            $script:bestScore = $score
            $script:bestHandle = $handle
            $script:bestVisible = $visible
        }
        return $true
    }

    [void][FocusNative]::EnumWindows($callback, [System.IntPtr]::Zero)
    return $script:bestHandle
}

$owners = New-Object 'System.Collections.Generic.HashSet[uint32]'
if ($ProcessId -gt 0) { [void]$owners.Add([uint32]$ProcessId) }
$handle = Find-TargetWindow $owners

if ($handle -eq [System.IntPtr]::Zero) {
    $owners = New-Object 'System.Collections.Generic.HashSet[uint32]'
    Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -like 'DeepSeek*' } |
        ForEach-Object { [void]$owners.Add([uint32]$_.Id) }
    $handle = Find-TargetWindow $owners
}

if ($handle -eq [System.IntPtr]::Zero) {
    'FOCUSED=0'
    exit 0
}

if (-not $script:bestVisible) { [void][FocusNative]::ShowWindow($handle, 5) }
if ([FocusNative]::IsIconic($handle)) { [void][FocusNative]::ShowWindow($handle, 9) }
Start-Sleep -Milliseconds 20

if ([FocusNative]::GetForegroundWindow() -ne $handle) {
    [FocusNative]::keybd_event(0x12, 0, 0, [System.UIntPtr]::Zero)
    [FocusNative]::keybd_event(0x12, 0, 2, [System.UIntPtr]::Zero)
    [void][FocusNative]::SetForegroundWindow($handle)
    Start-Sleep -Milliseconds 20
    if ([FocusNative]::GetForegroundWindow() -ne $handle) {
        [void][FocusNative]::SetForegroundWindow($handle)
    }
}

if (-not [FocusNative]::IsIconic($handle) -and [FocusNative]::GetForegroundWindow() -eq $handle) {
    'FOCUSED=1'
} else {
    'FOCUSED=0'
}
