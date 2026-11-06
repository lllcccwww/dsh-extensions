/**
 * Host aggregate checks for the DH extensions bundle: every feature mounts its
 * routes, the instructions feature keeps its state/save contract, and the
 * notify focus route answers without spawning the window helper.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

const home = mkdtempSync(join(tmpdir(), 'dh-extensions-'));
process.env.DSH_HOME = home;
process.env.DSH_AGENTS_HOME = join(home, '.agents');
process.env.DH_EXTENSIONS_NO_FOCUS_HELPER = '1';

const { apply } = await import('../index.js');

const routes = new Map();
/** Minimal Cordis context: `effect` runs immediately and `webServer.register` records the handler. */
const ctx = {
  effect(run, _label) {
    return run();
  },
  webServer: {
    register(route) {
      routes.set(route.path, route.handler);
      return () => routes.delete(route.path);
    },
  },
};
apply(ctx);

assert.deepEqual([...routes.keys()].sort(), [
  '/dh/instructions/save',
  '/dh/instructions/state',
  '/dh/notify/focus',
]);

/**
 * Invoke one registered handler with a small Node-shaped request.
 * @param path - registered route path.
 * @param method - HTTP method.
 * @param body - optional JSON or raw body text.
 * @param settleMs - how long to wait for an async handler to respond.
 * @returns `{ status, json }`.
 */
async function call(path, method, body, settleMs = 300) {
  const handler = routes.get(path);
  assert.ok(handler, `route ${path} is registered`);
  const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const req = Readable.from(payload === '' ? [] : [Buffer.from(payload, 'utf8')]);
  req.method = method;
  const chunks = [];
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      if (chunk !== undefined) chunks.push(Buffer.from(chunk));
    },
  };
  handler(req, res);
  const started = Date.now();
  while (res.statusCode === 0 && Date.now() - started < settleMs) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return { status: res.statusCode, json: text === '' ? undefined : JSON.parse(text) };
}

const file = join(home, 'AGENTS.md');

// Instructions: missing file, create, digest, conflict, force.
let state = await call('/dh/instructions/state', 'GET');
assert.equal(state.status, 200);
assert.equal(state.json.exists, false);
assert.equal(state.json.content, '');
assert.equal(state.json.maxBytes, 65536);
assert.equal(state.json.sourceLimitBytes, 1024 * 1024);

let saved = await call('/dh/instructions/save', 'POST', { content: '# 偏好\n' });
assert.equal(saved.status, 200);
assert.equal(readFileSync(file, 'utf8'), '# 偏好\n');
assert.deepEqual(readdirSync(home).filter((name) => name.endsWith('.tmp')), []);

const firstDigest = saved.json.digest;
saved = await call('/dh/instructions/save', 'POST', { content: '# 偏好\n\n- 简洁\n', baseDigest: firstDigest });
assert.equal(saved.status, 200);

const stale = await call('/dh/instructions/save', 'POST', { content: '# 覆盖\n', baseDigest: firstDigest });
assert.equal(stale.status, 409);
assert.ok(stale.json.state);
assert.equal(readFileSync(file, 'utf8'), '# 偏好\n\n- 简洁\n');

const forced = await call('/dh/instructions/save', 'POST', { content: '# 覆盖\n', baseDigest: firstDigest, force: true });
assert.equal(forced.status, 200);
assert.equal(readFileSync(file, 'utf8'), '# 覆盖\n');

assert.equal((await call('/dh/instructions/save', 'POST', { content: 42 })).status, 400);
assert.equal((await call('/dh/instructions/save', 'POST', 'not json')).status, 400);
assert.equal((await call('/dh/instructions/state', 'POST')).status, 405);
assert.equal((await call('/dh/instructions/save', 'GET')).status, 405);

const oversized = await call('/dh/instructions/save', 'POST', { content: 'x'.repeat(1024 * 1024 + 1) });
assert.equal(oversized.status, 413);
assert.equal(readFileSync(file, 'utf8'), '# 覆盖\n');

mkdirSync(join(home, '.agents'), { recursive: true });
writeFileSync(join(home, '.agents', 'AGENTS.md'), '# shared\n');
state = await call('/dh/instructions/state', 'GET');
assert.equal(state.json.sharedExists, true);

// Notify: GET probe answers JSON; unsupported methods are refused; POST is not
// exercised here because it would launch the window helper.
const probe = await call('/dh/notify/focus', 'GET');
assert.equal(probe.status, 200);
assert.equal(probe.json.ok, true);
assert.equal(typeof probe.json.last, 'string');
assert.equal((await call('/dh/notify/focus', 'PUT')).status, 405);
assert.equal((await call('/dh/notify/focus', 'DELETE')).status, 405);

rmSync(home, { recursive: true, force: true });
console.log('host aggregate checks passed');
