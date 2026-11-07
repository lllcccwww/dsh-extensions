/**
 * Sandbox feature (host): open an elevated PowerShell window that repairs one
 * Workspace's DSH sandbox grant.
 *
 * The page cannot read a DACL, so it sends the Workspace path and the Host
 * derives the sandbox identity from that path's own root ACL. An unelevated
 * launcher then starts one console with the repair command on its input line;
 * nothing runs until the user presses Enter there.
 */
import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBody, sendJson } from '../../shared/http.js';

/** Route the page posts a Workspace path to. */
const REPAIR_ROUTE = '/dh/sandbox/repair';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCHER = join(HERE, 'assets', 'open-repair.ps1');
const WORKER = join(HERE, 'assets', 'repair-sandbox-acl.ps1');

/** A UAC prompt can stay open for a while; this bounds the waiting request. */
const LAUNCH_TIMEOUT_MS = 180000;

/** Exit codes `open-repair.ps1` uses. */
const EXIT_BAD_ARGUMENT = 2;
const EXIT_NO_IDENTITY = 3;
const EXIT_ELEVATION = 4;

/**
 * Whether a path currently holds a directory.
 * @param path - absolute path to probe.
 * @returns true when the path exists as a directory.
 */
function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Start the launcher and wait until the elevated window is up or the user
 * dismisses the UAC prompt.
 * @param workspacePath - Workspace root to repair.
 * @returns `{ ok, status, error }`.
 */
function openRepairWindow(workspacePath) {
  return new Promise((resolve) => {
    execFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', LAUNCHER,
      '-WorkspacePath', workspacePath,
      '-WorkerPath', WORKER,
    ], { timeout: LAUNCH_TIMEOUT_MS, windowsHide: true }, (error, stdout, stderr) => {
      if (error === null) {
        resolve({ ok: true, status: 200, error: '' });
        return;
      }
      const stream = `${stderr ?? ''}`.trim() !== '' ? `${stderr}` : `${stdout ?? ''}`;
      const line = stream
        .split(/\r?\n/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry.startsWith('[dh-extensions] '))
        .pop();
      const detail = line === undefined ? '' : line.slice('[dh-extensions] '.length);
      if (error.killed === true) {
        resolve({ ok: false, status: 504, error: '等待管理员授权超时，请重试' });
        return;
      }
      const status = error.code === EXIT_BAD_ARGUMENT
        ? 400
        : error.code === EXIT_NO_IDENTITY
          ? 409
          : error.code === EXIT_ELEVATION
            ? 502
            : 500;
      resolve({ ok: false, status, error: detail === '' ? error.message : detail });
    });
  });
}

/**
 * Serve the repair request.
 * @param req - Node request carrying `{ path }`.
 * @param res - Node response.
 */
async function handleRepair(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }
  if (process.platform !== 'win32') {
    sendJson(res, 501, { error: 'this repair is only implemented on Windows' });
    return;
  }
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 400;
    sendJson(res, status, { error: error instanceof Error ? error.message : String(error) });
    return;
  }
  const path = body?.path;
  if (typeof path !== 'string' || path.trim() === '') {
    sendJson(res, 400, { error: 'path must be a non-empty string' });
    return;
  }
  if (!isAbsolute(path) || !isDirectory(path)) {
    sendJson(res, 400, { error: `not an existing directory: ${path}` });
    return;
  }
  // Tests and headless hosts must not spawn a UAC prompt.
  if (process.env.DH_EXTENSIONS_NO_SANDBOX_LAUNCH === '1') {
    sendJson(res, 200, { ok: true, launched: false });
    return;
  }
  try {
    const result = await openRepairWindow(path);
    if (result.ok) {
      sendJson(res, 200, { ok: true, launched: true });
      return;
    }
    sendJson(res, result.status, { error: result.error });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

/** Host half of the sandbox feature. */
export default {
  id: 'sandbox',
  routes: [
    { path: REPAIR_ROUTE, handler: (req, res) => void handleRepair(req, res) },
  ],
};
