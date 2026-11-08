/**
 * Host aggregate checks for the DSH extensions bundle: every feature mounts its
 * routes, the instructions feature keeps its state/save contract, the notify
 * focus route answers without spawning the window helper, and the compatibility
 * report answers for a healthy bundle.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

const home = mkdtempSync(join(tmpdir(), 'dh-extensions-'));
process.env.DSH_HOME = home;
process.env.DSH_AGENTS_HOME = join(home, '.agents');
process.env.DSH_PROFILE_DIR = join(home, 'profiles', 'desktop');
process.env.DSH_PROFILE = 'desktop';
process.env.DH_EXTENSIONS_RUNTIME_VERSION = '0.1.5-rc.1';
process.env.DH_EXTENSIONS_NO_FOCUS_HELPER = '1';
process.env.DH_EXTENSIONS_NO_SANDBOX_LAUNCH = '1';
mkdirSync(process.env.DSH_PROFILE_DIR, { recursive: true });
writeFileSync(join(process.env.DSH_PROFILE_DIR, 'package.json'), JSON.stringify({ name: 'test-profile', private: true }));

const { apply } = await import('../index.js');
const { unmetRequirements } = await import('../features/compat/host.js');

const routes = new Map();
/** Minimal Cordis context: `effect` runs immediately and `webServer.register` records the handler. */
const webServer = {
  register(route) {
    routes.set(route.path, route.handler);
    return () => routes.delete(route.path);
  },
};
const ctx = {
  effect(run, _label) {
    return run();
  },
  get(name) {
    return name === 'webServer' ? webServer : undefined;
  },
  webServer,
};
apply(ctx);

assert.deepEqual([...routes.keys()].sort(), [
  '/dh/compat/report',
  '/dh/instructions/save',
  '/dh/instructions/state',
  '/dh/notify/focus',
  '/dh/sandbox/repair',
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

// Sandbox repair: method and path validation answer before any launcher runs.
assert.equal((await call('/dh/sandbox/repair', 'GET')).status, 405);
assert.equal((await call('/dh/sandbox/repair', 'POST', {})).status, 400);
assert.equal((await call('/dh/sandbox/repair', 'POST', { path: '' })).status, 400);
assert.equal((await call('/dh/sandbox/repair', 'POST', { path: 7 })).status, 400);
assert.equal((await call('/dh/sandbox/repair', 'POST', { path: 'relative\\dir' })).status, 400);
assert.equal((await call('/dh/sandbox/repair', 'POST', { path: join(home, 'missing') })).status, 400);
assert.equal((await call('/dh/sandbox/repair', 'POST', 'not json')).status, 400);

if (process.platform === 'win32') {
  const workspace = join(home, 'workspace');
  mkdirSync(workspace);
  const repair = await call('/dh/sandbox/repair', 'POST', { path: workspace });
  // The launch shortcut keeps the test free of UAC prompts; the route still
  // validates the path and answers 200.
  assert.equal(repair.status, 200);
  assert.equal(repair.json.launched, false);
}

// Windows PowerShell reads a script as ANSI unless it starts with a BOM, and
// both sandbox assets print Chinese, so a missing BOM breaks them at parse time.
for (const name of ['open-repair.ps1', 'repair-sandbox-acl.ps1']) {
  const asset = new URL(`../features/sandbox/assets/${name}`, import.meta.url);
  assert.deepEqual([...readFileSync(asset).subarray(0, 3)], [0xef, 0xbb, 0xbf], `${name} starts with a UTF-8 BOM`);
}

// Compatibility: the self-check reports the runtime and never errors on a
// healthy bundle, and requirement evaluation mirrors DSH's precedence.
const compat = await call('/dh/compat/report', 'GET');
assert.equal(compat.status, 200);
assert.equal(compat.json.runtimeVersion, '0.1.5-rc.1');
assert.equal(compat.json.package.name, '@local/dh-extensions');
assert.equal(compat.json.status, 'ok');
assert.ok(Array.isArray(compat.json.groups) && compat.json.groups.length > 0);
for (const group of compat.json.groups) assert.ok(Array.isArray(group.issues), `${group.id} has issues`);
const compatErrors = compat.json.groups.flatMap((group) => group.issues).filter((item) => item.level === 'error');
assert.deepEqual(compatErrors, [], 'healthy bundle has no error-level compatibility issues');
assert.equal((await call('/dh/compat/report', 'POST')).status, 405);

assert.deepEqual(
  unmetRequirements(
    { engines: { dsh: '^0.1.5-rc.1' }, peerDependencies: { '@deepseek-ai/dsh-agent': '^9.0.0' } },
    '0.1.5-rc.1',
    (range) => range === '^0.1.5-rc.1',
  ),
  {},
  'engines.dsh decides alone',
);
assert.deepEqual(
  unmetRequirements(
    { peerDependencies: { '@deepseek-ai/dsh-agent': '^0.1.5', react: '^18' } },
    '0.1.5-rc.1',
    (range) => range === '^0.1.5',
  ),
  {},
  'only DSH peers are checked',
);
assert.deepEqual(
  unmetRequirements({ engines: { dsh: '^0.2.0' } }, '0.1.5-rc.1', () => false),
  { 'engines.dsh': '^0.2.0' },
);
assert.deepEqual(
  unmetRequirements(
    { peerDependencies: { '@deepseek-ai/dsh-agent': 'workspace:^' } },
    '0.1.5-rc.1',
    (range) => range === '0.1.5-rc.1',
  ),
  {},
  'workspace peers mean the current runtime',
);
assert.throws(() => unmetRequirements({ engines: { dsh: 7 } }, '0.1.5-rc.1', () => true), /engines\.dsh/u);

rmSync(home, { recursive: true, force: true });
console.log('host aggregate checks passed');

