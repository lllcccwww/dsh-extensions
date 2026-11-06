using System;
using System.Text;
using System.Runtime.InteropServices;

/// <summary>Win32 surface the focus helper needs. Compiled once by the Host at startup.</summary>
public static class FocusNative
{
    /// <summary>StdCall callback receiving every top-level window handle.</summary>
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    /// <summary>Enumerate top-level windows.</summary>
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    /// <summary>Whether the window is currently visible on screen.</summary>
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);

    /// <summary>Whether the window is minimized.</summary>
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);

    /// <summary>Change the window's show state (SW_RESTORE = 9, SW_SHOW = 5, SW_MINIMIZE = 6).</summary>
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);

    /// <summary>Bring the window to the foreground.</summary>
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);

    /// <summary>Current foreground window.</summary>
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();

    /// <summary>Owning process of a window.</summary>
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    /// <summary>Window title.</summary>
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    /// <summary>Window bounds in screen coordinates.</summary>
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    /// <summary>Synthesize a key event; an Alt tap earns this thread foreground permission.</summary>
    [DllImport("user32.dll")] public static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);

    /// <summary>Win32 rectangle.</summary>
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
