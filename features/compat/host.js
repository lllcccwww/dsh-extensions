/**
 * Compatibility feature (host): check this bundle against the running DSH.
 *
 * DSH blocks a plugin only when its manifest declares `engines.dsh` or DSH
 * peer requirements; this bundle declares neither, so an upgrade is judged by
 * loading the real entry points. The report combines the declared requirements
 * with the bundle patch, the host module, the client module, and the route
 * contract shared by both halves.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as vm from 'node:vm';
import { sendJson } from '../../shared/http.js';
import { dshHome } from '../../shared/paths.js';

/** Route the settings panel calls to run the check. */
const REPORT_ROUTE = '/dh/compat/report';
/** Repository root: `features/compat/` is two levels below it. */
const PACKAGE_DIR = dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));
const PACKAGE_FILE = join(PACKAGE_DIR, 'package.json');
const CLIENT_FILE = join(PACKAGE_DIR, 'client.js');
/** Implicit module-table entries a client bundle may request without declaring them. */
const BASELINE_MODULES = new Set(['react', 'react-dom', 'react/jsx-runtime']);

/** Host context captured by `setup`, used to verify the webServer service is still present. */
let hostContext;

/** Maximum wait for the host entry to import before the report calls it failed. */
const HOST_LOAD_TIMEOUT_MS = 5000;

/**
 * Message of an unknown thrown value.
 * @param error - value thrown by Node or plugin code.
 * @returns a printable message.
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Import one absolute file, refusing to wait forever. The import itself keeps
 * running after a timeout; the rejection only stops this report.
 * @param file - absolute entry path.
 * @param timeoutMs - maximum wait.
 * @returns the module namespace.
 */
function importWithTimeout(file, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`加载超时（${timeoutMs}ms）`)), timeoutMs);
    import(pathToFileURL(file).href).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Build one report issue. `data` and `detail` are omitted when empty so the
 * client never receives undefined fields.
 * @param code - stable code the client localizes.
 * @param level - `ok`, `info`, `warn`, or `error`.
 * @param data - placeholders for the localized message.
 * @param detail - raw diagnostic from the failing operation.
 * @returns the issue object.
 */
function issue(code, level, data, detail) {
  const item = { code, level };
  if (data !== undefined) item.data = data;
  if (typeof detail === 'string' && detail !== '') item.detail = detail;
  return item;
}

/**
 * Group issues and derive the group status. `info` never lowers the status:
 * it is a hint the report shows without calling the bundle incompatible.
 * @param id - stable group id.
 * @param issues - issues found in this group.
 * @returns the group object.
 */
function makeGroup(id, issues) {
  let status = 'ok';
  for (const item of issues) {
    if (item.level === 'error') status = 'error';
    else if (item.level === 'warn' && status === 'ok') status = 'warn';
  }
  return { id, status, issues };
}

/**
 * Whether a value is a plain object.
 * @param value - value to inspect.
 * @returns true for a non-null, non-array object.
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read and parse one JSON file.
 * @param file - absolute path.
 * @returns the parsed value.
 */
function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Active profile directory: the launcher's own variable first, then the
 * Harness-home convention.
 * @returns an absolute profile directory (it may not exist in tests).
 */
function resolveProfileDir() {
  const configured = process.env.DSH_PROFILE_DIR;
  if (typeof configured === 'string' && configured.trim() !== '') return configured;
  const name = process.env.DSH_PROFILE;
  if (typeof name === 'string' && name.trim() !== '') return join(dshHome(), 'profiles', name);
  return join(dshHome(), 'profiles');
}

/**
 * Display name of the active profile.
 * @param profileDir - active profile directory.
 * @returns `DSH_PROFILE`, else the directory name.
 */
function profileLabel(profileDir) {
  const name = process.env.DSH_PROFILE;
  return typeof name === 'string' && name.trim() !== '' ? name : basename(profileDir);
}

/**
 * Require one module from the profile first, then from the shared profiles
 * tree. Both are how DSH itself resolves these helpers for a linked bundle.
 * @param profileDir - active profile directory.
 * @param specifier - module specifier.
 * @returns the module, or undefined when neither anchor resolves it.
 */
function loadFromProfile(profileDir, specifier) {
  const anchors = [join(profileDir, 'package.json'), join(dshHome(), 'profiles', 'package.json')];
  for (const anchor of anchors) {
    try {
      return createRequire(anchor)(specifier);
    } catch {
      // Try the next anchor.
    }
  }
  return undefined;
}

/**
 * Load DSH's own patch parser from the profile. Using the running runtime's
 * parser keeps `!!js` and every other patch-field rule identical to startup.
 * @param profileDir - active profile directory.
 * @returns `loadOverlayPatches`, or undefined when it cannot be imported.
 */
async function loadPatchParser(profileDir) {
  const anchors = [join(profileDir, 'package.json'), join(dshHome(), 'profiles', 'package.json')];
  for (const anchor of anchors) {
    try {
      const specifier = createRequire(anchor).resolve('@deepseek-ai/dsh-app-boot');
      const mod = await import(pathToFileURL(specifier).href);
      if (typeof mod.loadOverlayPatches === 'function') return mod.loadOverlayPatches;
    } catch {
      // Try the next anchor.
    }
  }
  return undefined;
}

/**
 * Running DSH version, read from the same manifest DSH uses for its own
 * compatibility gate (`@deepseek-ai/dsh-app-boot`). The environment override
 * exists so tests do not depend on an installed profile.
 * @param profileDir - active profile directory.
 * @returns the version string, or undefined.
 */
function resolveRuntimeVersion(profileDir) {
  const override = process.env.DH_EXTENSIONS_RUNTIME_VERSION;
  if (typeof override === 'string' && override.trim() !== '') return override.trim();
  const anchors = [join(profileDir, 'package.json'), join(dshHome(), 'profiles', 'package.json')];
  for (const anchor of anchors) {
    let requireFrom;
    try {
      requireFrom = createRequire(anchor);
    } catch {
      continue;
    }
    for (const specifier of ['@deepseek-ai/dsh-app-boot/package.json', '@deepseek-ai/dsh/package.json']) {
      try {
        const manifest = readJson(requireFrom.resolve(specifier));
        if (typeof manifest.version === 'string' && manifest.version !== '') return manifest.version;
      } catch {
        // Try the next specifier.
      }
    }
  }
  const direct = [
    join(dshHome(), 'profiles', 'node_modules', '@deepseek-ai', 'dsh-app-boot', 'package.json'),
    join(dshHome(), 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
  ];
  for (const file of direct) {
    try {
      const manifest = readJson(file);
      if (typeof manifest.version === 'string' && manifest.version !== '') return manifest.version;
    } catch {
      // Try the next file.
    }
  }
  return undefined;
}

/**
 * Read the profile's exact-version exemptions. A malformed record is skipped
 * rather than failing the whole check, matching how DSH treats the file.
 * @param profileDir - active profile directory.
 * @returns accepted exemptions plus a warning for rejected records.
 */
function readExemptions(profileDir) {
  const file = join(profileDir, 'compatibility.json');
  let value;
  try {
    value = readJson(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return { exemptions: {}, warning: '' };
    return { exemptions: {}, warning: messageOf(error) };
  }
  if (!isObject(value)) return { exemptions: {}, warning: 'compatibility.json 顶层必须是对象' };
  const exemptions = {};
  const warnings = [];
  for (const [key, versions] of Object.entries(value)) {
    if (Array.isArray(versions) && versions.every((version) => typeof version === 'string')) {
      exemptions[key] = versions;
    } else {
      warnings.push(`${key} 不是版本数组`);
    }
  }
  return { exemptions, warning: warnings.join('；') };
}

/**
 * Declared DSH requirements, preserving DSH's precedence: an own
 * `engines.dsh` decides alone and peer dependencies are ignored.
 * @param manifest - parsed plugin manifest.
 * @returns kind plus the requirement pairs.
 */
function declaredRequirements(manifest) {
  if (manifest?.engines !== undefined && !isObject(manifest.engines)) {
    throw new Error('engines 必须是对象');
  }
  const engines = isObject(manifest?.engines) ? manifest.engines : {};
  if (Object.hasOwn(engines, 'dsh')) {
    if (typeof engines.dsh !== 'string') throw new Error('engines.dsh 必须是字符串');
    return { kind: 'engines', requirements: { 'engines.dsh': engines.dsh } };
  }
  if (manifest?.peerDependencies !== undefined && !isObject(manifest.peerDependencies)) {
    throw new Error('peerDependencies 必须是对象');
  }
  const peers = isObject(manifest?.peerDependencies) ? manifest.peerDependencies : {};
  const requirements = {};
  for (const [name, range] of Object.entries(peers)) {
    if (name !== '@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-')) continue;
    if (typeof range !== 'string') throw new Error(`peerDependencies["${name}"] 必须是字符串`);
    requirements[name] = range;
  }
  return { kind: Object.keys(requirements).length === 0 ? 'none' : 'peers', requirements };
}

/**
 * Whether the runtime satisfies the declared requirements, using the same
 * rules and prerelease handling as DSH. Exported so tests can pin the
 * engines-vs-peers precedence without an installed profile.
 * @param manifest - parsed plugin manifest.
 * @param runtimeVersion - running DSH version.
 * @param satisfies - range predicate for the runtime version.
 * @returns unmet requirements keyed as DSH keys them.
 */
export function unmetRequirements(manifest, runtimeVersion, satisfies) {
  const { kind, requirements } = declaredRequirements(manifest);
  if (kind === 'none') return {};
  if (typeof satisfies !== 'function') throw new Error('无法校验语义化版本范围');
  const unmet = {};
  for (const [name, range] of Object.entries(requirements)) {
    const effective = name === 'engines.dsh' || !['workspace:^', 'workspace:~', 'workspace:*'].includes(range)
      ? range
      : runtimeVersion;
    if (!satisfies(effective)) unmet[name] = range;
  }
  return unmet;
}

/**
 * Range predicate backed by the `semver` package DSH itself uses.
 * @param runtimeVersion - running DSH version.
 * @param semver - loaded semver module, or undefined.
 * @returns a predicate, or undefined when semver is unavailable.
 */
function makeSatisfies(runtimeVersion, semver) {
  if (typeof semver?.satisfies !== 'function') return undefined;
  return (range) => {
    const trimmed = range.trim();
    if (trimmed === '') return false;
    return semver.satisfies(runtimeVersion, trimmed, { includePrerelease: true });
  };
}

/**
 * Resolve one conditional export target to a file path.
 * @param target - `exports` value or nested condition.
 * @returns the relative file path, or undefined.
 */
function resolveConditional(target) {
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) {
    for (const item of target) {
      const resolved = resolveConditional(item);
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  }
  if (isObject(target)) {
    for (const key of ['import', 'default', 'node', 'require']) {
      if (!Object.hasOwn(target, key)) continue;
      const resolved = resolveConditional(target[key]);
      if (resolved !== undefined) return resolved;
    }
  }
  return undefined;
}

/**
 * Resolve an `exports` subpath, including a conditions-only root object.
 * @param exportsField - manifest `exports` value.
 * @param subpath - `.` or `./client`.
 * @returns the relative file path, or undefined.
 */
function resolveExportField(exportsField, subpath) {
  if (typeof exportsField === 'string') return subpath === '.' ? exportsField : undefined;
  if (!isObject(exportsField)) return undefined;
  if (Object.hasOwn(exportsField, subpath)) return resolveConditional(exportsField[subpath]);
  const hasSubpaths = Object.keys(exportsField).some((key) => key.startsWith('.'));
  if (subpath === '.' && !hasSubpaths) return resolveConditional(exportsField);
  return undefined;
}

/**
 * Absolute entry file for one package subpath.
 * @param manifest - parsed plugin manifest.
 * @param packageDir - package root.
 * @param subpath - `.` or `./client`.
 * @returns the absolute file path, or undefined.
 */
function packageEntry(manifest, packageDir, subpath) {
  const declared = resolveExportField(manifest?.exports, subpath);
  const fallback = subpath === '.' ? manifest?.main ?? manifest?.module ?? './index.js' : undefined;
  const file = declared ?? fallback;
  return typeof file === 'string' ? join(packageDir, file) : undefined;
}

/**
 * Whether a composed patch mounts the package itself.
 * @param parsed - parsed YAML value.
 * @param packageName - plugin package name.
 * @returns true when a row names the package.
 */
function patchMountsPackage(parsed, packageName) {
  const visit = (rows) => {
    if (!Array.isArray(rows)) return false;
    return rows.some((row) => {
      if (!isObject(row)) return false;
      if (row.name === packageName) return true;
      return visit(row.insert) || visit(row.config);
    });
  };
  return visit(parsed);
}

/**
 * Minimal React surface the client factory touches while it defines its
 * components. Rendering never runs during the check.
 * @returns a React-shaped stub.
 */
function createReactStub() {
  const noop = () => {};
  class Component {
    constructor(props) {
      this.props = props ?? {};
      this.state = {};
    }

    setState() {}
  }
  return {
    Component,
    Fragment: 'Fragment',
    StrictMode: 'StrictMode',
    createElement: (type, props, ...children) => ({ type, props, children }),
    useCallback: (callback) => callback,
    useEffect: noop,
    useLayoutEffect: noop,
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, noop],
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    memo: (component) => component,
    forwardRef: (component) => component,
  };
}

/**
 * Client context stub used only to run the client plugin's `apply`. It mirrors
 * the services this bundle declares so registration failures surface here
 * instead of at the next Settings mount.
 * @returns a minimal applied-plugin context.
 */
function createClientContext() {
  const noop = () => {};
  const slots = {
    inject(_name, callback) {
      callback();
      return noop;
    },
    register() {
      return noop;
    },
  };
  const locale = {
    bind() {
      return (key) => key;
    },
    register() {
      return noop;
    },
  };
  return {
    slots,
    locale,
    remote: { $on: () => noop },
    contextMenus: { register: () => noop, notify: noop },
    sessions: { list: { getSnapshot: () => undefined, subscribe: () => noop } },
    effect(run) {
      return run();
    },
    get() {
      return undefined;
    },
  };
}

/**
 * Run one `client.js` in a sandboxed context with browser stubs, capture the
 * module registration, then call its factory to inspect the plugin object.
 * @param source - client entry source.
 * @param filename - path used in stack traces.
 * @param platform - host platform, used to mirror the Windows-only branch.
 * @returns registration, plugin object, requested module ids, or an error.
 */
function evaluateClient(source, filename, platform) {
  let registration;
  const window = {
    __ModuleLoader__: {
      load(value) {
        registration = value;
      },
    },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
  };
  const document = {
    hasFocus: () => true,
    visibilityState: 'visible',
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
  const sandbox = {
    window,
    document,
    navigator: { userAgent: platform === 'win32' ? 'Windows' : 'compat-check' },
    localStorage: { getItem: () => null, setItem: () => {} },
    console,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    setTimeout: () => 0,
    clearTimeout: () => {},
    Notification: class Notification {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(source, { filename }).runInContext(sandbox, { timeout: 2000 });
  if (!isObject(registration) || typeof registration.id !== 'string' || typeof registration.factory !== 'function') {
    return { error: '未通过 window.__ModuleLoader__.load 注册有效的模块' };
  }
  const requested = [];
  const react = createReactStub();
  sandbox.__factory = registration.factory;
  sandbox.__require = (id) => {
    requested.push(id);
    if (id === 'react') return react;
    return new Proxy({}, { get: () => () => undefined });
  };
  try {
    vm.runInContext('__plugin = __factory(__require)', sandbox, { timeout: 2000 });
  } catch (error) {
    return { registration, error: `factory 执行失败：${messageOf(error)}` };
  }
  const plugin = sandbox.__plugin;
  if (!isObject(plugin) || typeof plugin.apply !== 'function') {
    return { registration, plugin, requested };
  }
  sandbox.__ctx = createClientContext();
  try {
    vm.runInContext('__applied = __plugin.apply(__ctx)', sandbox, { timeout: 2000 });
  } catch (error) {
    return { registration, plugin, requested, applyError: messageOf(error) };
  }
  return { registration, plugin, requested };
}

/**
 * Inspect the client declaration and entry file.
 * @param manifest - parsed plugin manifest.
 * @param packageDir - package root.
 * @param platform - host platform.
 * @returns the client group issues.
 */
function inspectClient(manifest, packageDir, platform) {
  const issues = [];
  const client = manifest?.dsh?.client;
  if (!isObject(client)) {
    issues.push(issue('client-missing-manifest', 'warn'));
    return issues;
  }
  if (typeof client.platform !== 'string' || client.platform === '') {
    issues.push(issue('client-platform-invalid', 'error'));
  } else if (client.platform !== 'web') {
    issues.push(issue('client-platform', 'error', { platform: client.platform }));
  }
  if (client.immediately !== undefined && typeof client.immediately !== 'boolean') {
    issues.push(issue('client-immediately-invalid', 'error'));
  }
  const checkStringArray = (names, code) => {
    if (names === undefined) return;
    if (!Array.isArray(names) || !names.every((name) => typeof name === 'string')) {
      issues.push(issue(`${code}-invalid`, 'error'));
    }
  };
  // `inject` and `external` name client-graph rows, not Node packages: the
  // application supplies some of them from its own bundle, so resolution from
  // the profile would report a false mismatch.
  checkStringArray(client.inject, 'client-inject');
  checkStringArray(client.external, 'client-external');

  const entryFile = packageEntry(manifest, packageDir, './client');
  if (entryFile === undefined || !existsSync(entryFile)) {
    issues.push(issue('client-entry-missing', 'error', { path: entryFile ?? '' }));
    return issues;
  }
  let source;
  try {
    source = readFileSync(entryFile, 'utf8');
  } catch (error) {
    issues.push(issue('client-read', 'error', {}, messageOf(error)));
    return issues;
  }
  let result;
  try {
    result = evaluateClient(source, entryFile, platform);
  } catch (error) {
    issues.push(issue(error instanceof SyntaxError ? 'client-syntax' : 'client-evaluate', 'error', {}, messageOf(error)));
    return issues;
  }
  if (result.error !== undefined) {
    issues.push(issue('client-registration', 'error', {}, result.error));
    return issues;
  }
  if (result.registration.id !== manifest.name) {
    issues.push(issue('client-id-mismatch', 'warn', { id: result.registration.id, name: manifest.name }));
  }
  const plugin = result.plugin;
  if (!isObject(plugin)) {
    issues.push(issue('client-apply', 'error', {}, 'factory 没有返回插件对象'));
    return issues;
  }
  if (typeof plugin.apply !== 'function') issues.push(issue('client-apply', 'error', {}, '插件对象没有 apply 函数'));
  if (plugin.inject === undefined) {
    issues.push(issue('client-services-missing', 'warn'));
  } else if (!Array.isArray(plugin.inject) || !plugin.inject.every((name) => typeof name === 'string')) {
    issues.push(issue('client-services', 'error', {}, 'apply 的 inject 不是字符串数组'));
  }
  const declaredExternal = new Set(Array.isArray(client.external) ? client.external : []);
  const undeclared = [...new Set(result.requested)]
    .filter((id) => !BASELINE_MODULES.has(id) && !declaredExternal.has(id));
  if (undeclared.length > 0) issues.push(issue('client-require-undeclared', 'warn', { names: undeclared }));
  if (result.applyError !== undefined) issues.push(issue('client-apply-runtime', 'error', {}, result.applyError));
  if (issues.length === 0) issues.push(issue('client-ok', 'info'));
  return issues;
}

/**
 * Inspect the bundle declaration, patch files, and platform gate.
 * @param manifest - parsed plugin manifest.
 * @param packageDir - package root.
 * @param platform - host platform.
 * @param profileDir - active profile directory, used to load DSH's patch parser.
 * @returns the bundle group issues.
 */
async function inspectBundle(manifest, packageDir, platform, profileDir) {
  const issues = [];
  const bundle = manifest?.dsh?.bundle;
  if (!isObject(bundle)) {
    issues.push(issue('bundle-missing', 'error'));
    return issues;
  }
  const declared = typeof bundle.patch === 'string' ? [bundle.patch] : bundle.patch;
  if (!Array.isArray(declared) || declared.length === 0 || !declared.every((file) => typeof file === 'string')) {
    issues.push(issue('bundle-patch-invalid', 'error'));
  } else {
    const files = declared.map((file) => join(packageDir, file));
    const missing = files.filter((file) => !existsSync(file));
    if (missing.length > 0) {
      issues.push(issue('bundle-patch-missing', 'error', { paths: missing }));
    } else {
      const parser = await loadPatchParser(profileDir);
      if (parser === undefined) {
        issues.push(issue('bundle-patch-unverified', 'info'));
      } else {
        let parsed = [];
        let failed = '';
        for (const file of files) {
          try {
            const value = parser('dsh', file);
            if (!Array.isArray(value)) {
              failed = `${file} 不是补丁数组`;
              break;
            }
            parsed = parsed.concat(value);
          } catch (error) {
            failed = messageOf(error);
            break;
          }
        }
        if (failed !== '') issues.push(issue('bundle-patch-syntax', 'error', {}, failed));
        else if (!patchMountsPackage(parsed, manifest.name)) issues.push(issue('bundle-patch-self', 'warn'));
      }
    }
  }
  if (bundle.platforms !== undefined) {
    if (!Array.isArray(bundle.platforms) || bundle.platforms.length === 0
      || !bundle.platforms.every((value) => typeof value === 'string')) {
      issues.push(issue('bundle-platform-invalid', 'error'));
    } else if (!bundle.platforms.includes(platform)) {
      issues.push(issue('bundle-platform-unsupported', 'error', { platforms: bundle.platforms, platform }));
    }
  }
  if (issues.length === 0) issues.push(issue('bundle-ok', 'info', { patchCount: declared.length }));
  return issues;
}

/**
 * Inspect declared DSH requirements, the runtime version, and exemptions.
 * @param manifest - parsed plugin manifest.
 * @param runtimeVersion - running DSH version, or undefined.
 * @param semver - loaded semver module, or undefined.
 * @param exemptions - accepted exact-version exemptions.
 * @returns the requirements group issues.
 */
function inspectRequirements(manifest, runtimeVersion, semver, exemptions) {
  const issues = [];
  let declared;
  try {
    declared = declaredRequirements(manifest);
  } catch (error) {
    issues.push(issue('requirements-invalid', 'error', {}, messageOf(error)));
    return issues;
  }
  if (declared.kind === 'none') {
    issues.push(issue('requirements-missing', 'info'));
    return issues;
  }
  if (typeof runtimeVersion !== 'string' || runtimeVersion === '') {
    issues.push(issue('requirements-runtime-unknown', 'warn', { requirements: declared.requirements }));
    return issues;
  }
  const satisfies = makeSatisfies(runtimeVersion, semver);
  if (satisfies === undefined) {
    issues.push(issue('requirements-unverified', 'warn', { requirements: declared.requirements }));
    return issues;
  }
  let unmet;
  try {
    unmet = unmetRequirements(manifest, runtimeVersion, satisfies);
  } catch (error) {
    issues.push(issue('requirements-invalid', 'error', {}, messageOf(error)));
    return issues;
  }
  if (Object.keys(unmet).length === 0) {
    issues.push(issue('requirements-ok', 'info', { requirements: declared.requirements, runtimeVersion }));
    return issues;
  }
  const key = typeof manifest?.name === 'string' && typeof manifest?.version === 'string'
    ? `${manifest.name}@${manifest.version}`
    : '';
  const exempted = key !== '' && Array.isArray(exemptions[key]) && exemptions[key].includes(runtimeVersion);
  issues.push(issue(exempted ? 'requirements-exempted' : 'requirements-unmet', exempted ? 'warn' : 'error', {
    requirements: unmet,
    runtimeVersion,
    exemptionKey: key,
  }));
  return issues;
}

/**
 * Inspect the host entry: load it with Node, then check the Cordis contract.
 * @param manifest - parsed plugin manifest.
 * @returns the host group issues.
 */
async function inspectHost(manifest) {
  const issues = [];
  const entryFile = packageEntry(manifest, PACKAGE_DIR, '.');
  if (entryFile === undefined || !existsSync(entryFile)) {
    issues.push(issue('host-entry-missing', 'error', { path: entryFile ?? '' }));
    return issues;
  }
  let mod;
  try {
    mod = await importWithTimeout(entryFile, HOST_LOAD_TIMEOUT_MS);
  } catch (error) {
    issues.push(issue('host-load', 'error', {}, messageOf(error)));
    return issues;
  }
  const fallback = mod?.default;
  const apply = typeof mod?.apply === 'function'
    ? mod.apply
    : typeof fallback === 'function'
      ? fallback
      : typeof fallback?.apply === 'function'
        ? fallback.apply
        : undefined;
  if (typeof apply !== 'function') issues.push(issue('host-apply', 'error'));
  const inject = Array.isArray(mod?.inject) ? mod.inject : Array.isArray(fallback?.inject) ? fallback.inject : undefined;
  if (inject === undefined) {
    issues.push(issue('host-inject-web', 'error'));
  } else if (!inject.every((name) => typeof name === 'string')) {
    issues.push(issue('host-inject', 'error'));
  } else if (!inject.includes('webServer')) {
    issues.push(issue('host-inject-web', 'error'));
  }
  let webServer;
  try {
    webServer = hostContext?.get?.('webServer');
  } catch {
    webServer = undefined;
  }
  if (webServer === undefined || typeof webServer.register !== 'function') {
    issues.push(issue('host-webserver', 'error'));
  }
  if (issues.length === 0) issues.push(issue('host-ok', 'info', { inject: inject ?? [] }));
  return issues;
}

/**
 * Inspect the feature registry and the route names both halves share.
 * @returns the contracts group issues.
 */
async function inspectContracts() {
  const issues = [];
  let features;
  try {
    features = (await import('../registry.js')).features;
  } catch (error) {
    issues.push(issue('contracts-registry', 'error', {}, messageOf(error)));
    return issues;
  }
  if (!Array.isArray(features) || features.length === 0) {
    issues.push(issue('contracts-registry', 'error', {}, 'feature 清单为空'));
    return issues;
  }
  const ids = new Set();
  const paths = new Set();
  let shapeError = '';
  for (const feature of features) {
    if (!isObject(feature) || typeof feature.id !== 'string' || feature.id === '') {
      shapeError = '存在没有 id 的 feature';
      break;
    }
    if (ids.has(feature.id)) {
      shapeError = `feature id 重复：${feature.id}`;
      break;
    }
    ids.add(feature.id);
    if (feature.routes !== undefined && !Array.isArray(feature.routes)) {
      shapeError = `${feature.id} 的 routes 不是数组`;
      break;
    }
    for (const route of feature.routes ?? []) {
      if (!isObject(route) || typeof route.path !== 'string' || typeof route.handler !== 'function') {
        shapeError = `${feature.id} 存在无效路由`;
        break;
      }
      if (!route.path.startsWith(`/dh/${feature.id}/`)) {
        shapeError = `${feature.id} 的路由 ${route.path} 没有使用 /dh/${feature.id}/ 前缀`;
        break;
      }
      if (paths.has(route.path)) {
        shapeError = `路由重复：${route.path}`;
        break;
      }
      paths.add(route.path);
    }
    if (shapeError !== '') break;
  }
  if (shapeError !== '') issues.push(issue('contracts-routes', 'error', {}, shapeError));

  let clientSource;
  try {
    clientSource = readFileSync(CLIENT_FILE, 'utf8');
  } catch (error) {
    issues.push(issue('contracts-client-read', 'error', {}, messageOf(error)));
    return issues;
  }
  const clientPaths = new Set();
  for (const match of clientSource.matchAll(/['"`](\/dh\/[^'"`\n]+)['"`]/g)) clientPaths.add(match[1]);
  const unreferenced = [...paths].filter((path) => !clientPaths.has(path));
  const orphans = [...clientPaths].filter((path) => !paths.has(path));
  if (unreferenced.length > 0) issues.push(issue('contracts-unreferenced', 'warn', { paths: unreferenced }));
  if (orphans.length > 0) issues.push(issue('contracts-orphan', 'warn', { paths: orphans }));
  if (issues.length === 0) issues.push(issue('contracts-ok', 'info', { routeCount: paths.size }));
  return issues;
}

/**
 * Inspect the package identity exposed in the report header.
 * @param manifest - parsed plugin manifest.
 * @returns the manifest group issues.
 */
function inspectManifest(manifest) {
  const issues = [];
  if (typeof manifest?.name !== 'string' || manifest.name === '') issues.push(issue('manifest-name', 'error'));
  if (typeof manifest?.version !== 'string' || manifest.version === '') issues.push(issue('manifest-version', 'error'));
  if (issues.length === 0) {
    issues.push(issue('manifest-ok', 'info', { name: manifest.name, version: manifest.version }));
  }
  return issues;
}

/**
 * Assemble the final report and derive its overall status.
 * @param options - runtime identity and collected groups.
 * @returns the JSON body served to the settings panel.
 */
function finalize({ runtimeVersion, profileDir, manifest, groups }) {
  let status = 'ok';
  for (const group of groups) {
    if (group.status === 'error') status = 'error';
    else if (group.status === 'warn' && status === 'ok') status = 'warn';
  }
  return {
    checkedAt: new Date().toISOString(),
    status,
    runtimeVersion: runtimeVersion ?? null,
    profile: profileLabel(profileDir),
    platform: process.platform,
    package: {
      name: typeof manifest?.name === 'string' ? manifest.name : '',
      version: typeof manifest?.version === 'string' ? manifest.version : '',
    },
    groups,
  };
}

/**
 * Run every check and build the report.
 * @returns the report body.
 */
async function buildReport() {
  const profileDir = resolveProfileDir();
  const runtimeVersion = resolveRuntimeVersion(profileDir);
  const semver = typeof runtimeVersion === 'string' ? loadFromProfile(profileDir, 'semver') : undefined;
  const exemptionState = readExemptions(profileDir);
  const groups = [makeGroup('environment', [
    typeof runtimeVersion === 'string' && runtimeVersion !== ''
      ? issue('runtime-ok', 'info', { version: runtimeVersion, profile: profileLabel(profileDir) })
      : issue('runtime-unknown', 'warn'),
  ])];

  let manifest;
  try {
    manifest = readJson(PACKAGE_FILE);
  } catch (error) {
    groups.push(makeGroup('manifest', [issue('manifest-parse', 'error', {}, messageOf(error))]));
    return finalize({ runtimeVersion, profileDir, manifest: undefined, groups });
  }
  groups.push(makeGroup('manifest', inspectManifest(manifest)));

  const requirements = inspectRequirements(manifest, runtimeVersion, semver, exemptionState.exemptions);
  if (exemptionState.warning !== '') {
    requirements.unshift(issue('exemptions-invalid', 'warn', {}, exemptionState.warning));
  }
  groups.push(makeGroup('requirements', requirements));
  groups.push(makeGroup('bundle', await inspectBundle(manifest, PACKAGE_DIR, process.platform, profileDir)));
  groups.push(makeGroup('client', inspectClient(manifest, PACKAGE_DIR, process.platform)));
  groups.push(makeGroup('host', await inspectHost(manifest)));
  groups.push(makeGroup('contracts', await inspectContracts()));
  return finalize({ runtimeVersion, profileDir, manifest, groups });
}

/**
 * Serve the report route. The check is read-only and reuses cached host
 * modules, so repeated openings do not re-run plugin top-level code.
 * @param req - Node request.
 * @param res - Node response.
 */
async function handleReport(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    sendJson(res, 200, await buildReport());
  } catch (error) {
    sendJson(res, 500, { error: messageOf(error) });
  }
}

/** Host half of the compatibility feature. */
export default {
  id: 'compat',
  /**
   * Keep the host context so the check can verify the webServer service.
   * @param ctx - Host plugin context.
   */
  setup(ctx) {
    hostContext = ctx;
  },
  routes: [
    { path: REPORT_ROUTE, handler: handleReport },
  ],
};
