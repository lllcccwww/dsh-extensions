/**
 * Notify feature (host): restore and raise the application window when a
 * completion notification is clicked.
 *
 * A minimized Electron window ignores `focus()` from the page and the page has
 * no `restore()`, so the page posts to this route and the Host runs a Windows
 * helper. On other platforms the system already activates the application.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendJson } from '../../shared/http.js';

/** Route the page posts to when a completion notification is clicked. */
const FOCUS_ROUTE = '/dh/notify/focus';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, 'assets');
const FOCUS_SCRIPT = join(ASSETS, 'focus-window.ps1');
const FOCUS_SOURCE = join(ASSETS, 'FocusNative.cs');

/** Bump when the helper source changes so a stale compiled DLL is never reused. */
const HELPER_VERSION = '1';

/** Version-scoped cache so an upgraded bundle never loads a stale helper. */
const FOCUS_DLL = join(tmpdir(), `dh-extensions-notify-${HELPER_VERSION}`, 'FocusNative.dll');

/** Last helper run, kept for the GET probe so a failed raise can be explained. */
let lastFocus = '';

/** Locate the .NET Framework C# compiler shipped with every Windows install. */
function compilerPath() {
  const root = process.env.WINDIR ?? 'C:\\Windows';
  const candidates = [
    join(root, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    join(root, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

/**
 * Build the P/Invoke helper once per version. Compiling it inline with
 * PowerShell's `Add-Type` costs about two seconds on every click, so the Host
 * precompiles it at startup and the click path only loads the assembly.
 */
function ensureHelper() {
  if (process.platform !== 'win32') return;
  // Escape hatch for tests and headless hosts: no compiler work at activation.
  if (process.env.DH_EXTENSIONS_NO_FOCUS_HELPER === '1') return;
  try {
    if (existsSync(FOCUS_DLL)) return;
    const compiler = compilerPath();
    if (compiler === undefined) return;
    mkdirSync(dirname(FOCUS_DLL), { recursive: true });
    execFile(compiler, [
      '/nologo',
      '/target:library',
      `/out:${FOCUS_DLL}`,
      FOCUS_SOURCE,
    ], { timeout: 30000, windowsHide: true }, () => {});
  } catch (error) {
    lastFocus = `compile-failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Restore and raise the application window. The Electron process that owns the
 * window is the Host's parent.
 */
function raiseWindow() {
  if (process.platform !== 'win32') {
    lastFocus = 'skipped: not win32';
    return;
  }
  try {
    execFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', FOCUS_SCRIPT,
      '-ProcessId', String(process.ppid ?? 0),
      '-Assembly', FOCUS_DLL,
    ], { timeout: 15000, windowsHide: true }, (error, stdout, stderr) => {
      const output = `${stdout ?? ''}`.trim().split(/\r?\n/u).pop() ?? '';
      lastFocus = [
        new Date().toISOString(),
        `pid=${String(process.ppid ?? 0)}`,
        output === '' ? 'no-output' : output,
        error === null ? '' : `error=${error.message}`,
        `${stderr ?? ''}`.trim() === '' ? '' : `stderr=${`${stderr}`.trim()}`,
      ].filter((part) => part !== '').join(' ');
    });
  } catch (error) {
    lastFocus = `spawn-failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Serve the focus route the Client calls from its notification click handler.
 * @param req - Node request.
 * @param res - Node response.
 */
function handleFocus(req, res) {
  if (req.method === 'POST') {
    raiseWindow();
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === 'GET') {
    sendJson(res, 200, { ok: true, last: lastFocus });
    return;
  }
  res.statusCode = 405;
  res.end();
}

/** Host half of the notify feature. */
export default {
  id: 'notify',
  /**
   * Precompile the window helper at activation so the first click is fast.
   * @param _ctx - Host plugin context, unused.
   */
  setup(_ctx) {
    ensureHelper();
  },
  routes: [
    { path: FOCUS_ROUTE, handler: handleFocus },
  ],
};
