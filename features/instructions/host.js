/**
 * Instructions feature (host): read and replace the user-global `AGENTS.md`
 * that every session loads.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { writeFileAtomic } from '../../shared/fs.js';
import { readBody, sendJson } from '../../shared/http.js';
import {
  displayPath,
  globalInstructionFile,
  sharedInstructionFile,
} from '../../shared/paths.js';

/** Same cap the instruction loader applies to one source file. */
const SOURCE_LIMIT_BYTES = 1024 * 1024;

/** `dsh-base` mounts `dsh-agent-instructions` with this per-chain budget. */
const CHAIN_BUDGET_BYTES = 65536;

/**
 * Content identity used for the optimistic-concurrency check.
 * @param text - instruction file content.
 * @returns hex SHA-1 of the UTF-8 content.
 */
function digestOf(text) {
  return createHash('sha1').update(text, 'utf8').digest('hex');
}

/**
 * Whether a path currently holds a regular file.
 * @param path - absolute path to probe.
 * @returns true when the path exists as a file.
 */
function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Read the current state of the global instruction files.
 * @returns a JSON-serializable snapshot for the Client panel.
 */
export function instructionSnapshot() {
  const file = globalInstructionFile();
  const shared = sharedInstructionFile();
  let exists = false;
  let content = '';
  let bytes = 0;
  let updatedAt = null;
  let truncated = false;
  if (isFile(file)) {
    const stat = statSync(file);
    exists = true;
    bytes = stat.size;
    updatedAt = stat.mtime.toISOString();
    const buffer = readFileSync(file);
    truncated = buffer.length > SOURCE_LIMIT_BYTES;
    content = (truncated ? buffer.subarray(0, SOURCE_LIMIT_BYTES) : buffer).toString('utf8');
  }
  return {
    path: file,
    displayPath: displayPath(file),
    exists,
    content,
    digest: digestOf(content),
    bytes,
    truncated,
    updatedAt,
    maxBytes: CHAIN_BUDGET_BYTES,
    sourceLimitBytes: SOURCE_LIMIT_BYTES,
    sharedPath: shared,
    sharedDisplayPath: displayPath(shared),
    sharedExists: isFile(shared),
  };
}

/**
 * Serve the editor state.
 * @param req - Node request.
 * @param res - Node response.
 */
function handleState(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }
  try {
    sendJson(res, 200, instructionSnapshot());
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Persist a submitted document. A stale `baseDigest` is a conflict, not a write.
 * @param req - Node request carrying `{ content, baseDigest?, force? }`.
 * @param res - Node response.
 */
async function handleSave(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method not allowed' });
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
  if (typeof body?.content !== 'string') {
    sendJson(res, 400, { error: 'content must be a string' });
    return;
  }
  const bytes = Buffer.byteLength(body.content, 'utf8');
  if (bytes > SOURCE_LIMIT_BYTES) {
    sendJson(res, 413, {
      error: `the document is ${bytes} bytes; the instruction loader reads at most ${SOURCE_LIMIT_BYTES}`,
    });
    return;
  }
  try {
    const current = instructionSnapshot();
    if (current.truncated) {
      sendJson(res, 409, {
        error: 'the file on disk is larger than the loader limit; shorten it outside this editor first',
        state: current,
      });
      return;
    }
    const stale = body.force !== true
      && typeof body.baseDigest === 'string'
      && body.baseDigest !== digestOf(current.content);
    if (stale) {
      sendJson(res, 409, { error: 'the file changed on disk after it was loaded', state: current });
      return;
    }
    writeFileAtomic(globalInstructionFile(), body.content);
    sendJson(res, 200, instructionSnapshot());
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

/** Host half of the instructions feature. */
export default {
  id: 'instructions',
  routes: [
    { path: '/dh/instructions/state', handler: handleState },
    { path: '/dh/instructions/save', handler: (req, res) => void handleSave(req, res) },
  ],
};

