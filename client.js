/**
 * Client half of the DSH extensions bundle: one Settings section that hosts a
 * row per feature. Every entry lives in that section; nothing is injected into
 * host Settings pages.
 *
 * The browser artifact registers a lazy factory whose id equals the package
 * name. Only React comes from the module table; every control is local so a
 * Harness Client internal change cannot break these panels.
 */
window.__ModuleLoader__.load({
  id: '@local/dh-extensions',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace owned by this bundle. */
    const NS = 'dhExtensions';
    /** Unchanged from the standalone plugin so an existing preference survives. */
    const NOTIFY_KEY = 'dsh.turn-notify.enabled';
    /** Whether the workspace menu carries the sandbox repair item. */
    const REPAIR_MENU_KEY = 'dsh.workspace-repair.enabled';
    /** Whether the workspace menu carries the bulk archive item. */
    const ARCHIVE_MENU_KEY = 'dsh.workspace-archive.enabled';
    const STATE_URL = '/dh/instructions/state';
    const SAVE_URL = '/dh/instructions/save';
    const FOCUS_URL = '/dh/notify/focus';
    const REPAIR_URL = '/dh/sandbox/repair';
    const COMPAT_URL = '/dh/compat/report';
    /** Glyph key registered for the workspace repair item. */
    const REPAIR_ICON_KEY = 'dh-extensions.repair';
    /** Glyph key registered for the bulk archive item. */
    const ARCHIVE_ICON_KEY = 'dh-extensions.archive-all';
    const NOTICE_TTL_MS = 3200;

    const zh = {
      nav: 'DSH扩展',
      'crash.title': '这一项没能渲染',
      'crash.hint': '其它配置项不受影响；刷新页面可以重试。',

      'ins.title': '全局 AGENTS.md',
      'ins.desc': '所有会话都会加载；与项目里的 AGENTS.md 一起注入，更具体的优先。',
      'ins.loading': '正在读取…',
      'ins.readFailed': '读取全局 AGENTS.md 失败',
      'ins.editorLabel': '全局 AGENTS.md 内容',
      'ins.placeholder': '# 我的偏好\n\n- 默认用简体中文回答\n- 代码、命令、路径保持英文原文\n- 提交信息说明改了什么、为什么改',
      'ins.saving': '保存中…',
      'ins.saved': '已自动保存 · 新会话生效',
      'ins.saveFailed': '保存失败',
      'ins.budgetHint': '字节',

      'notify.title': '回答完成通知',
      'notify.desc': '窗口最小化或在后台时，回答结束发系统通知。',
      'notify.toggleTitle': '启用通知',
      'notify.toggleDesc': '系统权限：{state}',
      'notify.testTitle': '发送测试通知',
      'notify.testDesc': '立即弹一条，检验系统通知能否正常出现',
      'notify.testSend': '发送',
      'notify.permGranted': '已允许',
      'notify.permDenied': '已拒绝，需在系统设置里恢复',
      'notify.permDefault': '尚未授权',
      'notify.unsupported': '当前环境不支持系统通知',
      'notify.body': '「{title}」已完成回答',
      'notify.bodyFallback': '会话已完成回答',
      'notify.done': '回答完成',
      'notify.test.title': '通知已开启',
      'notify.test.body': '窗口最小化或不在前台时，回答完成后会在这里提醒你。',

      'menu.title': '工作区菜单',
      'menu.desc': '控制工作区右键和「…」菜单里的扩展项',

      'sandbox.title': '修复沙箱权限',
      'sandbox.desc': '打开管理员窗口，修复当前工作区的权限',
      'sandbox.menu': '修复沙箱权限',
      'sandbox.opened': '已打开管理员窗口，修复正在运行；结果看窗口最后一行',
      'sandbox.failed': '没能打开修复窗口',

      'archive.title': '归档全部会话',
      'archive.desc': '一次归档当前工作区的所有已有会话',
      'archive.menu': '归档全部会话',
      'archive.done': '已归档 {count} 个会话',
      'archive.partial': '已归档 {count} 个；{failed} 个失败',
      'archive.failed': '归档失败',
      'archive.reason': '归档失败：{reason}',
      'archive.canceled': '已取消归档',
      'archive.none': '没有可归档的会话',
      'archive.runningConfirm': '有 {count} 个会话正在运行。继续会停止它们并归档，确定吗？',
      'archive.unavailable': '当前 DSH 版本不支持批量归档',

      'compat.title': '插件兼容性检测',
      'compat.desc': '对照当前 DSH 检查本扩展的版本要求、入口和路由',
      'compat.run': '检测',
      'compat.retry': '重新检测',
      'compat.running': '正在检测中…',
      'compat.failed': '检测失败',
      'compat.hostOutdated': '宿主端还没有加载检测路由；请完全退出并重启应用，刷新页面不够。',
      'compat.unknown': '未知',
      'compat.tooltip.pass': '通过 · DSH {version}',
      'compat.tooltip.passHints': '通过 · DSH {version} · {count} 条提示',
      'compat.tooltip.warn': '需要注意 · DSH {version}',
      'compat.tooltip.fail': '不通过 · DSH {version}',

      'compat.group.environment': '运行环境',
      'compat.group.manifest': '插件清单',
      'compat.group.requirements': '版本要求',
      'compat.group.bundle': 'bundle 补丁',
      'compat.group.client': '客户端入口',
      'compat.group.host': '宿主入口',
      'compat.group.contracts': '内部契约',

      'compat.issue.runtimeUnknown': '无法确定当前 DSH 版本',
      'compat.issue.manifestParse': 'package.json 无法解析',
      'compat.issue.manifestName': 'package.json 缺少 name',
      'compat.issue.manifestVersion': 'package.json 缺少 version',
      'compat.issue.requirementsMissing': '未声明 engines.dsh；DSH 不会自动拦截版本不匹配',
      'compat.issue.requirementsUnverified': '已声明要求，但无法校验版本范围',
      'compat.issue.requirementsRuntimeUnknown': '已声明要求，但当前 DSH 版本未知',
      'compat.issue.requirementsInvalid': '版本要求字段无效',
      'compat.issue.requirementsUnmet': '当前 DSH 会拒绝加载：{requirements}',
      'compat.issue.requirementsExempted': '要求不满足，但已按精确版本豁免',
      'compat.issue.exemptionsInvalid': 'compatibility.json 存在无效记录',
      'compat.issue.bundleMissing': '未声明 dsh.bundle',
      'compat.issue.bundlePatchInvalid': 'dsh.bundle.patch 格式无效',
      'compat.issue.bundlePatchMissing': '补丁文件不存在：{paths}',
      'compat.issue.bundlePatchUnverified': '补丁存在，但无法加载 DSH 的补丁解析器',
      'compat.issue.bundlePatchSyntax': '补丁无法解析',
      'compat.issue.bundlePatchSelf': '补丁没有插入本插件',
      'compat.issue.bundlePlatformInvalid': 'dsh.bundle.platforms 格式无效',
      'compat.issue.bundlePlatformUnsupported': '仅支持 {platforms}，当前是 {platform}',
      'compat.issue.clientMissingManifest': '未声明 dsh.client',
      'compat.issue.clientPlatformInvalid': 'client platform 无效',
      'compat.issue.clientPlatform': 'client platform 是 {platform}，不是 web',
      'compat.issue.clientImmediatelyInvalid': 'dsh.client.immediately 不是布尔值',
      'compat.issue.clientInjectInvalid': 'dsh.client.inject 格式无效',
      'compat.issue.clientExternalInvalid': 'dsh.client.external 格式无效',
      'compat.issue.clientEntryMissing': '客户端入口不存在',
      'compat.issue.clientRead': '客户端入口无法读取',
      'compat.issue.clientSyntax': '客户端入口语法错误',
      'compat.issue.clientEvaluate': '客户端入口执行失败',
      'compat.issue.clientRegistration': '客户端入口没有注册模块',
      'compat.issue.clientIdMismatch': '模块 id {id} 与包名 {name} 不一致',
      'compat.issue.clientApply': '返回值不是可用的插件对象',
      'compat.issue.clientApplyRuntime': 'apply 执行失败',
      'compat.issue.clientServicesMissing': '未声明 apply 的服务依赖',
      'compat.issue.clientServices': 'apply 的 inject 不是字符串数组',
      'compat.issue.clientRequireUndeclared': '请求了未声明的模块：{names}',
      'compat.issue.hostEntryMissing': '宿主入口不存在',
      'compat.issue.hostLoad': '宿主入口无法加载',
      'compat.issue.hostApply': '未导出 apply 函数',
      'compat.issue.hostInject': 'inject 不是字符串数组',
      'compat.issue.hostInjectWeb': '宿主没有声明 webServer 服务依赖',
      'compat.issue.hostWebserver': '当前 DSH 缺少 webServer 服务',
      'compat.issue.contractsRegistry': 'feature 清单无效',
      'compat.issue.contractsRoutes': '路由不符合 /dh/<id>/ 约定',
      'compat.issue.contractsClientRead': 'client.js 无法读取',
      'compat.issue.contractsUnreferenced': '客户端未引用：{paths}',
      'compat.issue.contractsOrphan': '客户端引用了不存在的路由：{paths}',
    };

    const en = {
      nav: 'DSH extensions',
      'crash.title': 'This setting failed to render',
      'crash.hint': 'Other settings keep working; reload the page to retry.',

      'ins.title': 'Global AGENTS.md',
      'ins.desc': 'Loaded by every session together with each project AGENTS.md; the more specific one takes precedence.',
      'ins.loading': 'Reading…',
      'ins.readFailed': 'Could not read the global AGENTS.md',
      'ins.editorLabel': 'Global AGENTS.md content',
      'ins.placeholder': '# My preferences\n\n- Answer in English\n- Keep code, commands, and paths verbatim\n- Commit messages explain what changed and why',
      'ins.saving': 'Saving…',
      'ins.saved': 'Saved · applies to new sessions',
      'ins.saveFailed': 'Could not save',
      'ins.budgetHint': 'bytes',

      'notify.title': 'Completion notifications',
      'notify.desc': 'Notifies you when an answer finishes while the window is minimized or in the background.',
      'notify.toggleTitle': 'Enable notifications',
      'notify.toggleDesc': 'System permission: {state}',
      'notify.testTitle': 'Send a test notification',
      'notify.testDesc': 'Show one now to check that system notifications appear',
      'notify.testSend': 'Send',
      'notify.permGranted': 'Allowed',
      'notify.permDenied': 'Denied; allow it again in system settings',
      'notify.permDefault': 'Not granted yet',
      'notify.unsupported': 'This environment does not support system notifications',
      'notify.body': '“{title}” has finished answering',
      'notify.bodyFallback': 'The session has finished answering',
      'notify.done': 'Answer ready',
      'notify.test.title': 'Notifications are on',
      'notify.test.body': 'When the window is minimized or in the background, a finished answer is announced here.',

      'menu.title': 'Workspace menu',
      'menu.desc': 'Controls the extension items in the Workspace right-click and “…” menus',

      'sandbox.title': 'Repair sandbox access',
      'sandbox.desc': 'Open the elevated window to repair this Workspace’s access',
      'sandbox.menu': 'Repair sandbox access',
      'sandbox.opened': 'The elevated window is running the repair; read its last line for the result',
      'sandbox.failed': 'Could not open the repair window',

      'archive.title': 'Archive all sessions',
      'archive.desc': 'Archive every existing session in this Workspace at once',
      'archive.menu': 'Archive all sessions',
      'archive.done': 'Archived {count} session(s)',
      'archive.partial': 'Archived {count}; {failed} failed',
      'archive.failed': 'Could not archive the sessions',
      'archive.reason': 'Could not archive: {reason}',
      'archive.canceled': 'Archive canceled',
      'archive.none': 'No sessions to archive',
      'archive.runningConfirm': '{count} session(s) are running. Continuing stops them and archives them. Continue?',
      'archive.unavailable': 'This DSH version does not expose archiving',

      'compat.title': 'Plugin compatibility',
      'compat.desc': 'Check this extension’s version requirements, entries, and routes against the running DSH',
      'compat.run': 'Check',
      'compat.retry': 'Check again',
      'compat.running': 'Checking…',
      'compat.failed': 'Check failed',
      'compat.hostOutdated': 'The host half has not loaded the check route yet; fully quit and restart the app—reloading the page is not enough.',
      'compat.unknown': 'unknown',
      'compat.tooltip.pass': 'Passed · DSH {version}',
      'compat.tooltip.passHints': 'Passed · DSH {version} · {count} hint(s)',
      'compat.tooltip.warn': 'Needs attention · DSH {version}',
      'compat.tooltip.fail': 'Failed · DSH {version}',

      'compat.group.environment': 'Runtime',
      'compat.group.manifest': 'Manifest',
      'compat.group.requirements': 'Version requirements',
      'compat.group.bundle': 'Bundle patch',
      'compat.group.client': 'Client entry',
      'compat.group.host': 'Host entry',
      'compat.group.contracts': 'Internal contracts',

      'compat.issue.runtimeUnknown': 'Could not determine the running DSH version',
      'compat.issue.manifestParse': 'package.json cannot be parsed',
      'compat.issue.manifestName': 'package.json has no name',
      'compat.issue.manifestVersion': 'package.json has no version',
      'compat.issue.requirementsMissing': 'No engines.dsh declared; DSH will not block a version mismatch',
      'compat.issue.requirementsUnverified': 'Requirements are declared but the range cannot be checked',
      'compat.issue.requirementsRuntimeUnknown': 'Requirements are declared but the DSH version is unknown',
      'compat.issue.requirementsInvalid': 'The version requirement fields are invalid',
      'compat.issue.requirementsUnmet': 'This DSH version refuses to load it: {requirements}',
      'compat.issue.requirementsExempted': 'Requirements are unmet but an exact-version exemption is active',
      'compat.issue.exemptionsInvalid': 'compatibility.json contains invalid records',
      'compat.issue.bundleMissing': 'No dsh.bundle declared',
      'compat.issue.bundlePatchInvalid': 'dsh.bundle.patch has an invalid shape',
      'compat.issue.bundlePatchMissing': 'Patch file missing: {paths}',
      'compat.issue.bundlePatchUnverified': 'Patch exists but DSH’s patch parser could not be loaded',
      'compat.issue.bundlePatchSyntax': 'Patch cannot be parsed',
      'compat.issue.bundlePatchSelf': 'The patch does not mount this plugin',
      'compat.issue.bundlePlatformInvalid': 'dsh.bundle.platforms has an invalid shape',
      'compat.issue.bundlePlatformUnsupported': 'Supports only {platforms}; this host is {platform}',
      'compat.issue.clientMissingManifest': 'No dsh.client declared',
      'compat.issue.clientPlatformInvalid': 'The client platform is invalid',
      'compat.issue.clientPlatform': 'The client platform is {platform}, not web',
      'compat.issue.clientImmediatelyInvalid': 'dsh.client.immediately is not a boolean',
      'compat.issue.clientInjectInvalid': 'dsh.client.inject has an invalid shape',
      'compat.issue.clientExternalInvalid': 'dsh.client.external has an invalid shape',
      'compat.issue.clientEntryMissing': 'The client entry does not exist',
      'compat.issue.clientRead': 'The client entry cannot be read',
      'compat.issue.clientSyntax': 'The client entry has a syntax error',
      'compat.issue.clientEvaluate': 'The client entry fails to execute',
      'compat.issue.clientRegistration': 'The client entry registers no module',
      'compat.issue.clientIdMismatch': 'Module id {id} does not match package name {name}',
      'compat.issue.clientApply': 'The factory did not return a usable plugin object',
      'compat.issue.clientApplyRuntime': 'apply failed while registering',
      'compat.issue.clientServicesMissing': 'The apply services are not declared',
      'compat.issue.clientServices': 'The apply inject is not an array of strings',
      'compat.issue.clientRequireUndeclared': 'Undeclared modules requested: {names}',
      'compat.issue.hostEntryMissing': 'The host entry does not exist',
      'compat.issue.hostLoad': 'The host entry cannot be loaded',
      'compat.issue.hostApply': 'No apply function is exported',
      'compat.issue.hostInject': 'inject is not an array of strings',
      'compat.issue.hostInjectWeb': 'The host half does not declare the webServer service',
      'compat.issue.hostWebserver': 'The running DSH has no webServer service',
      'compat.issue.contractsRegistry': 'The feature registry is invalid',
      'compat.issue.contractsRoutes': 'A route does not follow the /dh/<id>/ convention',
      'compat.issue.contractsClientRead': 'client.js cannot be read',
      'compat.issue.contractsUnreferenced': 'The client does not reference: {paths}',
      'compat.issue.contractsOrphan': 'The client references routes that do not exist: {paths}',
    };

    const CSS = `
.dx-root{display:flex;flex-direction:column;padding:2px 0 8px}
.dx-setting{display:flex;flex-direction:column;gap:10px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dx-setting:last-child{border-bottom:none}
.dx-setting-head{display:flex;flex-direction:column;gap:4px;min-width:0}
.dx-setting-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.dx-setting-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dx-setting-row{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:16px}
.dx-setting-text{display:flex;flex-direction:column;gap:4px;min-width:0;padding-right:32px}
.dx-sub-list{display:flex;flex-direction:column;margin-top:2px;padding-left:12px}
.dx-sub-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:6px 0}
.dx-sub-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.dx-sub-title{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dx-sub-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dx-sub-desc-warn{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.dx-compat-actions{display:flex;align-items:center;gap:10px;flex:none}
.dx-compat-status-icon{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;outline:none;cursor:help}
.dx-compat-status-icon svg{pointer-events:none}
.dx-compat-status-icon:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dx-compat-status-icon-ok{color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary))}
.dx-compat-status-icon-warn{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-primary))}
.dx-compat-status-icon-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.dx-btn-inline{display:inline-flex;align-items:center;gap:6px}
.dx-btn[aria-busy="true"]:disabled{opacity:.75}
.dx-spinner{flex:none;width:14px;height:14px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:dx-spin .7s linear infinite}
@keyframes dx-spin{to{transform:rotate(360deg)}}
.dx-editor-wrap{position:relative;display:flex;flex-direction:column}
.dx-editor{width:100%;box-sizing:border-box;min-height:300px;resize:vertical;padding:12px 12px 32px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:20px;outline:none;tab-size:2}
.dx-editor:focus{border-color:var(--dsw-alias-brand-primary)}
.dx-editor::placeholder{color:var(--dsw-alias-label-tertiary)}
.dx-editor-meta{position:absolute;left:12px;right:18px;bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;pointer-events:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.dx-count-over{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-primary))}
.dx-btn{font:inherit;font-size:13px;line-height:18px;padding:6px 12px;border-radius:var(--dsw-radius-md,10px);border:1px solid transparent;cursor:pointer;white-space:nowrap}
.dx-btn:disabled{cursor:default;opacity:.45}
.dx-btn-ghost{background:transparent;color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.dx-btn-ghost:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}
.dx-btn-sm{padding:4px 10px;font-size:12px;line-height:16px}
.dx-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dx-notice{padding:9px 12px;border-radius:var(--dsw-radius-md,10px);font-size:13px;line-height:20px}
.dx-notice-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));background:var(--dsw-alias-state-error-bg,var(--dsw-alias-bg-module-platform))}
.dx-notice-ok{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform)}
.dx-save-status{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.dx-save-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.dx-warn{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:0}
.dx-switch{position:relative;flex:none;width:40px;height:22px;padding:0;border:none;border-radius:999px;background:var(--dsw-alias-bg-module-platform);cursor:pointer;transition:background .15s ease}
.dx-switch:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dx-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
.dx-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dx-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s ease}
.dx-switch[aria-checked="true"] .dx-knob{transform:translateX(18px)}
.dx-error{padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px)}
.dx-error-title{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dx-error-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin-top:4px}
`;

    //#region helpers
    /** Byte length of the UTF-8 document, matching what the loader budgets. */
    function utf8Length(text) {
      if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
      return unescape(encodeURIComponent(text)).length;
    }

    /** Translator with a Chinese fallback when the slot does not pass one. */
    function translator(props) {
      if (typeof props?.t === 'function') return props.t;
      return (key) => zh[key] ?? key;
    }

    /** Title plus one-line description for a settings row. */
    function settingHead(t, titleKey, descKey) {
      return h('div', { className: 'dx-setting-head' },
        h('div', { className: 'dx-setting-title' }, t(titleKey)),
        h('div', { className: 'dx-setting-desc' }, t(descKey)));
    }

    /** Fetch one JSON document from the Host half. */
    async function requestJson(url) {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    }
    //#endregion

    //#region stored preferences
    /**
     * A localStorage-backed boolean shared by a Settings row and the code that
     * acts on it. Storage can be unavailable; the in-memory value still applies.
     * @param key - localStorage key, kept stable across releases.
     * @param fallback - value when nothing is stored.
     */
    function createStoredFlag(key, fallback) {
      let value = fallback;
      try {
        const raw = localStorage.getItem(key);
        value = raw === null ? fallback : raw !== 'false';
      } catch {
        value = fallback;
      }
      const listeners = new Set();
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(next) {
          if (next === value) return;
          value = next;
          try {
            localStorage.setItem(key, next ? 'true' : 'false');
          } catch {
            // Storage can be disabled; the in-memory preference still applies.
          }
          for (const listener of [...listeners]) {
            try {
              listener();
            } catch {
              // A broken row must not break the rest of the setting.
            }
          }
        },
      };
    }

    const notificationPreference = createStoredFlag(NOTIFY_KEY, true);
    const repairMenuPreference = createStoredFlag(REPAIR_MENU_KEY, true);
    const archiveMenuPreference = createStoredFlag(ARCHIVE_MENU_KEY, true);
    //#endregion

    //#region notification runtime
    /** Whether the document is the active, visible page. */
    let pageActive = typeof document === 'undefined'
      ? false
      : typeof document.hasFocus === 'function'
        ? document.hasFocus()
        : true;

    /** Track blur/focus/visibility so a minimized or backgrounded window reads as away. */
    function installActivityTracking() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
      const sync = () => {
        pageActive = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
      };
      const onBlur = () => { pageActive = false; };
      const onFocus = () => { pageActive = true; };
      const onVisibility = () => {
        if (document.visibilityState === 'hidden' || document.hidden === true) pageActive = false;
        else sync();
      };
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
      }
      if (typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', onVisibility);
      }
      sync();
      return () => {
        if (typeof window.removeEventListener === 'function') {
          window.removeEventListener('blur', onBlur);
          window.removeEventListener('focus', onFocus);
        }
        if (typeof document.removeEventListener === 'function') {
          document.removeEventListener('visibilitychange', onVisibility);
        }
      };
    }

    /** True when the page is minimized, hidden to the tray, or another window is in front. */
    function windowIsAway() {
      if (typeof document === 'undefined') return false;
      if (document.visibilityState === 'hidden' || document.hidden === true) return true;
      return pageActive === false;
    }

    /** Resolve notification permission, asking once when the platform still allows a prompt. */
    function ensureNotificationPermission() {
      if (typeof Notification !== 'function') return Promise.resolve(false);
      if (Notification.permission === 'granted') return Promise.resolve(true);
      if (Notification.permission === 'denied') return Promise.resolve(false);
      try {
        return Promise.resolve(Notification.requestPermission()).then(
          (state) => state === 'granted',
          () => false,
        );
      } catch {
        return Promise.resolve(false);
      }
    }

    /**
     * Notification tag for one Session. Chromium prefixes the tag with
     * `n#<origin>#` and hands the whole string to Windows as the toast tag,
     * which Windows rejects past 64 characters.
     * @param sessionId - Session identity.
     * @returns a short, stable per-Session tag.
     */
    function sessionTag(sessionId) {
      let hash = 2166136261;
      for (let i = 0; i < sessionId.length; i += 1) {
        hash ^= sessionId.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return `tn-${(hash >>> 0).toString(36)}`;
    }

    /**
     * Shown notifications keyed by tag. A wrapper garbage collected while the
     * toast is still on screen would leave the click on a dead handler.
     */
    const liveNotifications = new Map();
    const NOTIFICATION_TTL_MS = 10 * 60 * 1000;

    /** Drop the strong reference and the TTL timer for one tag. */
    function releaseNotification(tag) {
      const held = liveNotifications.get(tag);
      if (held === undefined) return;
      liveNotifications.delete(tag);
      try {
        clearTimeout(held.timer);
      } catch {
        // Timers are best-effort.
      }
    }

    /**
     * Ask the Host half to restore and raise the window. A minimized Electron
     * window ignores `window.focus()` and the page has no `restore()`.
     */
    function requestWindowFocus() {
      if (typeof fetch !== 'function') return;
      try {
        void fetch(FOCUS_URL, { method: 'POST', keepalive: true }).catch(() => {});
      } catch {
        // A missing fetch only means the window is not raised.
      }
    }

    /** Bring the app back and open the finished Session. */
    function activateCompletion(options, notification) {
      requestWindowFocus();
      try {
        window.focus();
      } catch {
        // Focus is best-effort in every host.
      }
      try {
        options.open?.();
      } catch (error) {
        console.error('[dh-extensions] could not open the session:', error);
      }
      try {
        notification.close();
      } catch {
        // Already closed.
      }
    }

    /**
     * Show one completion notification when the preference is on and the window is away.
     * @param options - localized copy, Session identity, the open action, and a test bypass.
     */
    async function presentCompletion(options) {
      if (!notificationPreference.getSnapshot()) return;
      if (options.force !== true && !windowIsAway()) return;
      if (typeof Notification !== 'function') return;
      const granted = await ensureNotificationPermission();
      if (!granted) return;
      if (!notificationPreference.getSnapshot()) return;
      const tag = sessionTag(options.sessionId);
      let notification;
      try {
        notification = new Notification(options.title, { body: options.body, tag, silent: false });
      } catch (error) {
        console.error('[dh-extensions] could not show notification:', error);
        return;
      }
      releaseNotification(tag);
      const held = { notification, timer: undefined };
      liveNotifications.set(tag, held);
      try {
        held.timer = setTimeout(() => releaseNotification(tag), NOTIFICATION_TTL_MS);
      } catch {
        // A missing timer only means the TTL backstop is unavailable.
      }
      notification.onclick = () => {
        releaseNotification(tag);
        activateCompletion(options, notification);
      };
      notification.onclose = () => releaseNotification(tag);
      notification.onerror = () => releaseNotification(tag);
    }
    //#endregion

    //#region workspace repair menu
    /** Whether this renderer runs on Windows, where the repair is implemented. */
    const onWindows = typeof navigator === 'undefined'
      ? false
      : /Windows/i.test(navigator.userAgent ?? '');

    /**
     * Shield glyph for the repair item. The menu aligns every row on a 16px
     * slot, and the built-in glyphs come from a package this bundle must not
     * import, so the icon is drawn here.
     */
    function RepairIcon() {
      return h('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      h('path', {
        d: 'M8 1.75 13 3.6v4.05c0 3.03-2.06 5.3-5 6.35-2.94-1.05-5-3.32-5-6.35V3.6L8 1.75Z',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      h('path', {
        d: 'm5.7 7.9 1.5 1.5 3.1-3.1',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }));
    }

    /**
     * Ask the Host to open the elevated repair window for one Workspace. The
     * request stays open while the user answers the UAC prompt, so the outcome
     * can be reported either way.
     * @param path - Workspace root captured from the menu target.
     * @param t - translator bound to this bundle's namespace.
     * @param ctx - applied Client plugin context.
     */
    async function requestRepair(path, t, ctx) {
      try {
        const response = await fetch(REPAIR_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
        ctx.contextMenus.notify(t('sandbox.opened'), true);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        ctx.contextMenus.notify(`${t('sandbox.failed')}: ${message}`, false);
      }
    }
    //#endregion

    //#region workspace archive all
    /**
     * Archive-box glyph for the bulk archive item. The menu aligns every row on
     * a 16px slot, and the built-in glyph package is not importable here, so the
     * icon is drawn with the same 16px geometry.
     */
    function ArchiveIcon() {
      return h('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
      },
      h('path', {
        d: 'M13.5 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V4.5C1.5 5.05228 1.94772 5.5 2.5 5.5H13.5C14.0523 5.5 14.5 5.05228 14.5 4.5V3.5C14.5 2.94772 14.0523 2.5 13.5 2.5Z',
        stroke: 'currentColor',
        strokeWidth: 1.2,
      }),
      h('path', {
        d: 'M2.5 5.5V13.5C2.5 13.7652 2.60536 14.0196 2.79289 14.2071C2.98043 14.3946 3.23478 14.5 3.5 14.5H12.5C12.7652 14.5 13.0196 14.3946 13.2071 14.2071C13.3946 14.0196 13.5 13.7652 13.5 13.5V5.5',
        stroke: 'currentColor',
        strokeWidth: 1.2,
      }),
      h('path', {
        d: 'M6.5 9.5H9.5',
        stroke: 'currentColor',
        strokeWidth: 1.2,
      }));
    }

    /**
     * Read one Workspace and its conversations that are still visible. The
     * Workspace list is already access-filtered; when either list is not ready
     * the menu item stays hidden instead of offering an action that cannot run.
     * A blank draft is the list's "new session" affordance, not a conversation,
     * so it is left in place.
     * @param ctx - applied Client plugin context.
     * @param workspaceId - Workspace captured from the menu target.
     * @returns `{ candidates }`, or undefined when that row cannot be read.
     */
    function visibleWorkspaceSessions(ctx, workspaceId) {
      try {
        const workspaces = ctx.get('workspaces')?.list?.getSnapshot?.();
        const sessions = ctx.sessions?.list?.getSnapshot?.();
        if (workspaces?.phase !== 'ready' || sessions?.phase !== 'ready') return undefined;
        if (!Array.isArray(workspaces.items)) return undefined;
        const workspace = workspaces.items.find((item) => item.workspaceId === workspaceId);
        if (workspace === undefined) return undefined;
        const archived = new Set(workspaces.archivedSessionIds ?? []);
        const candidates = (workspace.sessionIds ?? []).filter((id) => (
          typeof id === 'string'
          && !archived.has(id)
          && sessions.byId?.[id]?.blank !== true
        ));
        return { candidates };
      } catch {
        return undefined;
      }
    }

    /**
     * Archive every visible Session of one Workspace. Running Sessions are
     * stopped only after the operator confirms; the candidate set is read again
     * at run time so a menu opened against older state cannot archive stale ids.
     * @param workspaceId - Workspace captured from the menu target.
     * @param t - translator bound to this bundle's namespace.
     * @param ctx - applied Client plugin context.
     */
    async function archiveWorkspaceSessions(workspaceId, t, ctx) {
      const notify = (text, success) => ctx.contextMenus?.notify?.(text, success);
      const controller = ctx.get('workspaces');
      if (typeof controller?.archiveSession !== 'function') {
        notify(t('archive.unavailable'), false);
        return;
      }
      const found = visibleWorkspaceSessions(ctx, workspaceId);
      if (found === undefined || found.candidates.length === 0) {
        notify(t('archive.none'), false);
        return;
      }
      const sessions = ctx.sessions?.list?.getSnapshot?.();
      const running = new Set(found.candidates.filter((id) => sessions?.byId?.[id]?.running === true));
      if (running.size > 0) {
        const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(t('archive.runningConfirm', { count: running.size }))
          : false;
        if (!confirmed) {
          notify(t('archive.canceled'), false);
          return;
        }
      }
      let archived = 0;
      let failed = 0;
      let firstError = '';
      for (const sessionId of found.candidates) {
        try {
          await controller.archiveSession(sessionId, { stopActivity: running.has(sessionId) });
          archived += 1;
        } catch (reason) {
          failed += 1;
          if (firstError === '') firstError = reason instanceof Error ? reason.message : String(reason);
          console.error('[dh-extensions] archive failed:', sessionId, reason);
        }
      }
      if (failed === 0) {
        notify(t('archive.done', { count: archived }), true);
      } else if (archived === 0) {
        notify(t('archive.reason', { reason: firstError }), false);
      } else {
        notify(t('archive.partial', { count: archived, failed }), false);
      }
    }
    //#endregion

    //#region instructions panel
    /** Debounce before an edit is written, so typing does not spam the Host. */
    const AUTOSAVE_DELAY_MS = 700;

    /** Global AGENTS.md editor: the textarea is the whole control and saves as you type. */
    function InstructionsPanel(props) {
      const t = translator(props);
      const mounted = React.useRef(true);
      const [phase, setPhase] = React.useState('loading');
      const [error, setError] = React.useState('');
      const [state, setState] = React.useState(null);
      const [draft, setDraft] = React.useState('');
      const [status, setStatus] = React.useState('idle');
      const [saveError, setSaveError] = React.useState('');
      const stateRef = React.useRef(null);
      const draftRef = React.useRef('');
      const saving = React.useRef(false);

      const applyState = React.useCallback((next) => {
        stateRef.current = next;
        draftRef.current = next.content ?? '';
        setState(next);
        setDraft(next.content ?? '');
        setPhase('ready');
        setError('');
      }, []);

      const load = React.useCallback(() => {
        setPhase('loading');
        setError('');
        requestJson(STATE_URL).then(
          (next) => {
            if (mounted.current) applyState(next);
          },
          (reason) => {
            if (!mounted.current) return;
            setPhase('error');
            setError(reason instanceof Error ? reason.message : String(reason));
          },
        );
      }, [applyState]);

      React.useEffect(() => {
        load();
      }, [load]);

      // A failed load retries itself; the panel exposes no button to press.
      React.useEffect(() => {
        if (phase !== 'error') return undefined;
        const timer = setTimeout(load, 3000);
        return () => clearTimeout(timer);
      }, [phase, load]);

      const persist = React.useCallback(async () => {
        const current = stateRef.current;
        const content = draftRef.current;
        if (content === (current?.content ?? '') || saving.current) return;
        saving.current = true;
        setStatus('saving');
        setSaveError('');
        const post = (force) => fetch(SAVE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content, baseDigest: current?.digest, force }),
        });
        try {
          let response = await post(false);
          let payload = await response.json().catch(() => ({}));
          if (response.status === 409) {
            // Another writer touched the file: the text in this editor wins,
            // which is what keeps auto-save free of conflict buttons.
            response = await post(true);
            payload = await response.json().catch(() => ({}));
          }
          if (!mounted.current) return;
          if (!response.ok) {
            setStatus('error');
            setSaveError(payload.error ?? t('ins.saveFailed'));
            return;
          }
          // Keep typing that arrived during the request: only adopt the returned
          // document when the draft still matches what was sent.
          if (draftRef.current === content) {
            applyState(payload);
          } else {
            stateRef.current = payload;
            setState(payload);
          }
          setStatus('saved');
        } catch (reason) {
          if (mounted.current) {
            setStatus('error');
            setSaveError(reason instanceof Error ? reason.message : String(reason));
          }
        } finally {
          saving.current = false;
        }
      }, [applyState, t]);

      // Debounced auto-save: the effect re-arms while typing continues.
      React.useEffect(() => {
        if (phase !== 'ready') return undefined;
        if (draft === (state?.content ?? '')) return undefined;
        const timer = setTimeout(() => { void persist(); }, AUTOSAVE_DELAY_MS);
        return () => clearTimeout(timer);
      }, [draft, state, phase, persist]);

      // "Saved" fades back to idle so the line stays quiet.
      React.useEffect(() => {
        if (status !== 'saved') return undefined;
        const timer = setTimeout(() => setStatus('idle'), 1800);
        return () => clearTimeout(timer);
      }, [status]);

      // Flush a pending draft when Settings closes so typing is never lost.
      React.useEffect(() => () => {
        mounted.current = false;
        const current = stateRef.current;
        const content = draftRef.current;
        if (content === (current?.content ?? '')) return;
        try {
          void fetch(SAVE_URL, {
            method: 'POST',
            keepalive: true,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content, baseDigest: current?.digest, force: true }),
          });
        } catch {
          // A closing page may cancel the request; the file keeps the older text.
        }
      }, []);

      const onKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
          event.preventDefault();
          void persist();
        }
      };

      if (phase === 'loading') {
        return h('div', { className: 'dx-setting' },
          settingHead(t, 'ins.title', 'ins.desc'),
          h('p', { className: 'dx-warn' }, t('ins.loading')));
      }

      if (phase === 'error') {
        return h('div', { className: 'dx-setting' },
          settingHead(t, 'ins.title', 'ins.desc'),
          h('div', { className: 'dx-notice dx-notice-error', role: 'alert' },
            `${t('ins.readFailed')}: ${error}`));
      }

      const bytes = utf8Length(draft);
      const budget = typeof state?.maxBytes === 'number' ? state.maxBytes : 65536;
      const overBudget = bytes > budget;

      const statusText = status === 'saving'
        ? t('ins.saving')
        : status === 'saved'
          ? t('ins.saved')
          : status === 'error'
            ? (saveError === '' ? t('ins.saveFailed') : saveError)
            : '';

      // The counter and the save state sit inside the input, so the field is the
      // only chrome this setting shows.
      const editor = h('div', { className: 'dx-editor-wrap' },
        h('textarea', {
          className: 'dx-editor',
          spellCheck: false,
          'aria-label': t('ins.editorLabel'),
          placeholder: t('ins.placeholder'),
          value: draft,
          onChange: (event) => {
            draftRef.current = event.target.value;
            setDraft(event.target.value);
          },
          onKeyDown,
        }),
        h('div', { className: 'dx-editor-meta', 'aria-hidden': statusText === '' ? 'true' : undefined },
          h('span', {
            className: `dx-save-status${status === 'error' ? ' dx-save-error' : ''}`,
            role: status === 'error' ? 'alert' : 'status',
          }, statusText),
          h('span', { className: `dx-count${overBudget ? ' dx-count-over' : ''}` },
            `${bytes.toLocaleString()} / ${budget.toLocaleString()} ${t('ins.budgetHint')}`)));

      return h('div', { className: 'dx-setting' },
        settingHead(t, 'ins.title', 'ins.desc'),
        editor);
    }
    //#endregion

    //#region notify panel
    /** Raw system-notification permission, kept as a code so the label can follow the locale. */
    function permissionCode() {
      if (typeof Notification !== 'function') return 'unsupported';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      return 'default';
    }

    /** Localized label for one permission code. */
    function permissionLabel(t, code) {
      if (code === 'unsupported') return t('notify.unsupported');
      if (code === 'granted') return t('notify.permGranted');
      if (code === 'denied') return t('notify.permDenied');
      return t('notify.permDefault');
    }

    /** Completion-notification settings. */
    function NotifyPanel(props) {
      const t = translator(props);
      const enabled = React.useSyncExternalStore(
        notificationPreference.subscribe,
        notificationPreference.getSnapshot,
        notificationPreference.getSnapshot,
      );
      const [permission, setPermission] = React.useState(permissionCode);
      React.useEffect(() => {
        setPermission(permissionCode());
      }, [enabled]);

      const toggle = () => {
        const next = !notificationPreference.getSnapshot();
        notificationPreference.set(next);
        if (next) ensureNotificationPermission().then(() => setPermission(permissionCode()), () => {});
      };

      const sendTest = () => {
        void presentCompletion({
          title: t('notify.test.title'),
          body: t('notify.test.body'),
          sessionId: 'test',
          force: true,
        }).then(() => setPermission(permissionCode()), () => {});
      };

      const permissionText = permissionLabel(t, permission);

      return h('div', { className: 'dx-setting' },
        settingHead(t, 'notify.title', 'notify.desc'),
        h('div', { className: 'dx-sub-list' },
          h('div', { className: 'dx-sub-row' },
            h('div', { className: 'dx-sub-text' },
              h('div', { className: 'dx-sub-title' }, t('notify.toggleTitle')),
              h('div', { className: `dx-sub-desc${permission === 'denied' ? ' dx-sub-desc-warn' : ''}` },
                t('notify.toggleDesc', { state: permissionText }))),
            h('button', {
              type: 'button',
              role: 'switch',
              'aria-checked': enabled ? 'true' : 'false',
              'aria-label': t('notify.toggleTitle'),
              className: 'dx-switch',
              onClick: toggle,
            }, h('span', { className: 'dx-knob' }))),
          h('div', { className: 'dx-sub-row' },
            h('div', { className: 'dx-sub-text' },
              h('div', { className: 'dx-sub-title' }, t('notify.testTitle')),
              h('div', { className: 'dx-sub-desc' }, t('notify.testDesc'))),
            h('button', {
              type: 'button',
              className: 'dx-btn dx-btn-ghost dx-btn-sm',
              disabled: !enabled,
              onClick: sendTest,
            }, t('notify.testSend')))));
    }

    //#endregion

    //#region workspace menu panel
    /** Switches for the two workspace-menu items; each registration follows its switch. */
    function WorkspaceMenuPanel(props) {
      const t = translator(props);
      const repairEnabled = React.useSyncExternalStore(
        repairMenuPreference.subscribe,
        repairMenuPreference.getSnapshot,
        repairMenuPreference.getSnapshot,
      );
      const archiveEnabled = React.useSyncExternalStore(
        archiveMenuPreference.subscribe,
        archiveMenuPreference.getSnapshot,
        archiveMenuPreference.getSnapshot,
      );
      const repairRow = onWindows
        ? h('div', { className: 'dx-sub-row' },
          h('div', { className: 'dx-sub-text' },
            h('div', { className: 'dx-sub-title' }, t('sandbox.title')),
            h('div', { className: 'dx-sub-desc' }, t('sandbox.desc'))),
          h('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': repairEnabled ? 'true' : 'false',
            'aria-label': t('sandbox.title'),
            className: 'dx-switch',
            onClick: () => repairMenuPreference.set(!repairMenuPreference.getSnapshot()),
          }, h('span', { className: 'dx-knob' })))
        : null;
      const archiveRow = h('div', { className: 'dx-sub-row' },
        h('div', { className: 'dx-sub-text' },
          h('div', { className: 'dx-sub-title' }, t('archive.title')),
          h('div', { className: 'dx-sub-desc' }, t('archive.desc'))),
        h('button', {
          type: 'button',
          role: 'switch',
          'aria-checked': archiveEnabled ? 'true' : 'false',
          'aria-label': t('archive.title'),
          className: 'dx-switch',
          onClick: () => archiveMenuPreference.set(!archiveMenuPreference.getSnapshot()),
        }, h('span', { className: 'dx-knob' })));
      return h('div', { className: 'dx-setting' },
        settingHead(t, 'menu.title', 'menu.desc'),
        h('div', { className: 'dx-sub-list' },
          ...(repairRow === null ? [] : [repairRow]),
          archiveRow));
    }
    //#endregion

    //#region compatibility panel
    /** Join one list placeholder for display. */
    function compactList(value) {
      return Array.isArray(value) ? value.join(', ') : String(value ?? '');
    }

    /** Format a requirements object as `name range` pairs. */
    function formatRequirements(value) {
      if (value === null || typeof value !== 'object') return '';
      return Object.entries(value).map(([name, range]) => `${name} ${range}`).join('；');
    }

    /** First line of a raw diagnostic, bounded so a row stays readable. */
    function firstLine(value) {
      const text = String(value ?? '').split(/\r?\n/u)[0].trim();
      return text.length > 160 ? `${text.slice(0, 160)}…` : text;
    }

    /** Localized text for one report issue; raw details append after it. */
    function compatIssueText(t, item) {
      const data = item.data ?? {};
      let text;
      switch (item.code) {
        case 'runtime-unknown': text = t('compat.issue.runtimeUnknown'); break;
        case 'manifest-parse': text = t('compat.issue.manifestParse'); break;
        case 'manifest-name': text = t('compat.issue.manifestName'); break;
        case 'manifest-version': text = t('compat.issue.manifestVersion'); break;
        case 'requirements-missing': text = t('compat.issue.requirementsMissing'); break;
        case 'requirements-unverified': text = t('compat.issue.requirementsUnverified'); break;
        case 'requirements-runtime-unknown': text = t('compat.issue.requirementsRuntimeUnknown'); break;
        case 'requirements-invalid': text = t('compat.issue.requirementsInvalid'); break;
        case 'requirements-unmet':
          text = t('compat.issue.requirementsUnmet', { requirements: formatRequirements(data.requirements) });
          break;
        case 'requirements-exempted': text = t('compat.issue.requirementsExempted'); break;
        case 'exemptions-invalid': text = t('compat.issue.exemptionsInvalid'); break;
        case 'bundle-missing': text = t('compat.issue.bundleMissing'); break;
        case 'bundle-patch-invalid': text = t('compat.issue.bundlePatchInvalid'); break;
        case 'bundle-patch-missing': text = t('compat.issue.bundlePatchMissing', { paths: compactList(data.paths) }); break;
        case 'bundle-patch-unverified': text = t('compat.issue.bundlePatchUnverified'); break;
        case 'bundle-patch-syntax': text = t('compat.issue.bundlePatchSyntax'); break;
        case 'bundle-patch-self': text = t('compat.issue.bundlePatchSelf'); break;
        case 'bundle-platform-invalid': text = t('compat.issue.bundlePlatformInvalid'); break;
        case 'bundle-platform-unsupported':
          text = t('compat.issue.bundlePlatformUnsupported', { platforms: compactList(data.platforms), platform: data.platform });
          break;
        case 'client-missing-manifest': text = t('compat.issue.clientMissingManifest'); break;
        case 'client-platform-invalid': text = t('compat.issue.clientPlatformInvalid'); break;
        case 'client-platform': text = t('compat.issue.clientPlatform', { platform: data.platform }); break;
        case 'client-immediately-invalid': text = t('compat.issue.clientImmediatelyInvalid'); break;
        case 'client-inject-invalid': text = t('compat.issue.clientInjectInvalid'); break;
        case 'client-external-invalid': text = t('compat.issue.clientExternalInvalid'); break;
        case 'client-entry-missing': text = t('compat.issue.clientEntryMissing'); break;
        case 'client-read': text = t('compat.issue.clientRead'); break;
        case 'client-syntax': text = t('compat.issue.clientSyntax'); break;
        case 'client-evaluate': text = t('compat.issue.clientEvaluate'); break;
        case 'client-registration': text = t('compat.issue.clientRegistration'); break;
        case 'client-id-mismatch': text = t('compat.issue.clientIdMismatch', { id: data.id, name: data.name }); break;
        case 'client-apply': text = t('compat.issue.clientApply'); break;
        case 'client-apply-runtime': text = t('compat.issue.clientApplyRuntime'); break;
        case 'client-services-missing': text = t('compat.issue.clientServicesMissing'); break;
        case 'client-services': text = t('compat.issue.clientServices'); break;
        case 'client-require-undeclared': text = t('compat.issue.clientRequireUndeclared', { names: compactList(data.names) }); break;
        case 'host-entry-missing': text = t('compat.issue.hostEntryMissing'); break;
        case 'host-load': text = t('compat.issue.hostLoad'); break;
        case 'host-apply': text = t('compat.issue.hostApply'); break;
        case 'host-inject': text = t('compat.issue.hostInject'); break;
        case 'host-inject-web': text = t('compat.issue.hostInjectWeb'); break;
        case 'host-webserver': text = t('compat.issue.hostWebserver'); break;
        case 'contracts-registry': text = t('compat.issue.contractsRegistry'); break;
        case 'contracts-routes': text = t('compat.issue.contractsRoutes'); break;
        case 'contracts-client-read': text = t('compat.issue.contractsClientRead'); break;
        case 'contracts-unreferenced': text = t('compat.issue.contractsUnreferenced', { paths: compactList(data.paths) }); break;
        case 'contracts-orphan': text = t('compat.issue.contractsOrphan', { paths: compactList(data.paths) }); break;
        default: text = item.code;
      }
      if (item.detail !== undefined) {
        const detail = firstLine(item.detail);
        if (detail !== '' && !text.includes(detail)) text = `${text}：${detail}`;
      }
      return text;
    }

    /** One status glyph: check for pass, triangle for notes, cross for failure. */
    function CompatStatusIcon({ state }) {
      const svg = {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
      };
      if (state === 'ok') {
        return h('svg', svg,
          h('circle', { cx: 8, cy: 8, r: 6.4, stroke: 'currentColor', strokeWidth: 1.4 }),
          h('path', {
            d: 'm5 8.2 2 2 4-4.3',
            stroke: 'currentColor',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }));
      }
      if (state === 'warn') {
        return h('svg', svg,
          h('path', {
            d: 'M8 2.2 14 13H2L8 2.2Z',
            stroke: 'currentColor',
            strokeWidth: 1.4,
            strokeLinejoin: 'round',
          }),
          h('path', { d: 'M8 6v3.2', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
          h('circle', { cx: 8, cy: 11.2, r: 0.8, fill: 'currentColor' }));
      }
      return h('svg', svg,
        h('circle', { cx: 8, cy: 8, r: 6.4, stroke: 'currentColor', strokeWidth: 1.4 }),
        h('path', {
          d: 'm5.6 5.6 4.8 4.8m0-4.8-4.8 4.8',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }));
    }

    /** Self-check against the running DSH: runs on mount and on demand. */
    function CompatPanel(props) {
      const t = translator(props);
      const mounted = React.useRef(true);
      const [phase, setPhase] = React.useState('loading');
      const [report, setReport] = React.useState(null);
      const [error, setError] = React.useState('');
      const [hostOutdated, setHostOutdated] = React.useState(false);

      const scan = React.useCallback(() => {
        setPhase('loading');
        setError('');
        setHostOutdated(false);
        requestJson(COMPAT_URL).then(
          (next) => {
            if (!mounted.current) return;
            setReport(next);
            setPhase('ready');
          },
          (reason) => {
            if (!mounted.current) return;
            const message = reason instanceof Error ? reason.message : String(reason);
            setPhase('error');
            setError(message);
            setHostOutdated(message === 'HTTP 404');
          },
        );
      }, []);

      React.useEffect(() => {
        mounted.current = true;
        scan();
        return () => {
          mounted.current = false;
        };
      }, [scan]);

      const problems = [];
      if (report !== null) {
        for (const group of report.groups ?? []) {
          for (const item of group.issues ?? []) {
            if (typeof item.code === 'string' && item.code.endsWith('-ok')) continue;
            problems.push({ ...item, group: group.id });
          }
        }
      }
      const hints = problems.filter((item) => item.level === 'info').length;
      const version = typeof report?.runtimeVersion === 'string' && report.runtimeVersion !== ''
        ? report.runtimeVersion
        : t('compat.unknown');
      const checking = phase === 'loading';
      const iconState = checking
        ? null
        : phase === 'error' ? 'error' : report === null ? null : report.status;
      let tooltip = '';
      if (phase === 'error') {
        tooltip = `${t('compat.failed')}：${hostOutdated ? t('compat.hostOutdated') : error}`;
      } else if (report !== null) {
        const head = report.status === 'error'
          ? t('compat.tooltip.fail', { version })
          : report.status === 'warn'
            ? t('compat.tooltip.warn', { version })
            : hints > 0
              ? t('compat.tooltip.passHints', { version, count: hints })
              : t('compat.tooltip.pass', { version });
        tooltip = [
          head,
          ...problems.map((item) => `${t(`compat.group.${item.group}`)}：${compatIssueText(t, item)}`),
        ].join('\n');
      }
      const statusIcon = iconState === null ? null : h('span', {
        className: `dx-compat-status-icon dx-compat-status-icon-${iconState}`,
        title: tooltip,
        'aria-label': tooltip,
        role: 'img',
        tabIndex: 0,
      }, h(CompatStatusIcon, { state: iconState }));
      const buttonLabel = report === null && phase !== 'error' ? t('compat.run') : t('compat.retry');

      return h('div', { className: 'dx-setting' },
        h('div', { className: 'dx-setting-row' },
          h('div', { className: 'dx-setting-text' },
            h('div', { className: 'dx-setting-title' }, t('compat.title')),
            h('div', { className: 'dx-setting-desc' }, t('compat.desc'))),
          h('div', { className: 'dx-compat-actions' },
            statusIcon,
            h('button', {
              type: 'button',
              className: 'dx-btn dx-btn-ghost dx-btn-sm dx-btn-inline',
              disabled: checking,
              'aria-busy': checking ? 'true' : undefined,
              onClick: scan,
            }, checking
              ? h(React.Fragment, null,
                h('span', { className: 'dx-spinner', 'aria-hidden': 'true' }),
                t('compat.running'))
              : buttonLabel))));
    }
    //#endregion

    //#region hub shell
    /**
     * Isolate one panel: a throwing feature renders a local error instead of
     * blanking the whole Settings section.
     */
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }

      static getDerivedStateFromError() {
        return { failed: true };
      }

      componentDidCatch(error) {
        console.error('[dh-extensions] panel crashed:', error);
      }

      render() {
        if (this.state.failed) {
          const t = this.props.t;
          return h('div', { className: 'dx-error', role: 'alert' },
            h('div', { className: 'dx-error-title' }, t('crash.title')),
            h('div', { className: 'dx-error-hint' }, t('crash.hint')));
        }
        return this.props.children;
      }
    }

    /** The DSH extensions settings page: stacked settings rows, like General. */
    function DhExtensionsSection(props) {
      const t = translator(props);
      return h('section', { className: 'dx-root' },
        h('style', null, CSS),
        h(PanelBoundary, { t, key: 'instructions' },
          h(InstructionsPanel, { t })),
        h(PanelBoundary, { t, key: 'notify' },
          h(NotifyPanel, { t })),
        h(PanelBoundary, { t, key: 'workspace-menu' },
          h(WorkspaceMenuPanel, { t })),
        h(PanelBoundary, { t, key: 'compat' },
          h(CompatPanel, { t })));
    }
    //#endregion

    return {
      inject: ['slots', 'locale', 'sessions', 'remote', 'contextMenus'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dh-extensions: dictionaries');
        ctx.effect(installActivityTracking, 'dh-extensions: window activity');
        ctx.effect(() => () => {
          for (const tag of [...liveNotifications.keys()]) releaseNotification(tag);
        }, 'dh-extensions: notification retention');

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dh-extensions',
          order: 25,
          label: () => ctx.locale.bind(NS)('nav'),
          locale: NS,
        }, DhExtensionsSection));

        // The one entry outside the Settings section: no other surface carries
        // a Workspace path. The Settings switch only adds or drops this
        // registration, so a change takes effect on the next menu opening.
        if (onWindows) {
          ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
            name: 'contextMenu.icon',
            key: REPAIR_ICON_KEY,
          }, RepairIcon));
        }
        if (onWindows && ctx.contextMenus !== undefined) {
          ctx.effect(() => {
            let dispose = () => {};
            const sync = () => {
              dispose();
              dispose = () => {};
              if (!repairMenuPreference.getSnapshot()) return;
              dispose = ctx.contextMenus.register({
                id: 'dh-extensions.sandbox-repair',
                target: 'workspace',
                order: 250,
                resolve: ({ path }) => (typeof path === 'string' && path !== ''
                  ? [{
                    id: 'repair',
                    icon: { key: REPAIR_ICON_KEY },
                    label: t('sandbox.menu'),
                    failureLabel: t('sandbox.failed'),
                    run: () => requestRepair(path, t, ctx),
                  }]
                  : []),
              });
            };
            const stop = repairMenuPreference.subscribe(sync);
            sync();
            return () => {
              stop();
              dispose();
            };
          }, 'dh-extensions: workspace sandbox repair');
        } else if (onWindows) {
          console.warn('[dh-extensions] contextMenus is unavailable; the workspace repair item is hidden');
        }

        // Bulk archiving also needs the Workspace identity, which only this
        // menu carries. The item is hidden while the Workspace has no visible
        // Sessions, so an empty menu never offers a no-op action.
        if (ctx.contextMenus !== undefined) {
          ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
            name: 'contextMenu.icon',
            key: ARCHIVE_ICON_KEY,
          }, ArchiveIcon));
          ctx.effect(() => {
            let dispose = () => {};
            const sync = () => {
              dispose();
              dispose = () => {};
              if (!archiveMenuPreference.getSnapshot()) return;
              dispose = ctx.contextMenus.register({
                id: 'dh-extensions.archive-all',
                target: 'workspace',
                order: 260,
                resolve: ({ workspaceId }) => {
                  if (typeof workspaceId !== 'string' || workspaceId === '') return [];
                  const found = visibleWorkspaceSessions(ctx, workspaceId);
                  if (found === undefined || found.candidates.length === 0) return [];
                  return [{
                    id: 'archive-all',
                    icon: { key: ARCHIVE_ICON_KEY },
                    label: t('archive.menu'),
                    failureLabel: t('archive.failed'),
                    run: () => archiveWorkspaceSessions(workspaceId, t, ctx),
                  }];
                },
              });
            };
            const stop = archiveMenuPreference.subscribe(sync);
            sync();
            return () => {
              stop();
              dispose();
            };
          }, 'dh-extensions: workspace archive all');
        }

        const list = ctx.sessions?.list;
        const listSnapshot = () => {
          try {
            return list?.getSnapshot?.();
          } catch {
            return undefined;
          }
        };
        const subscribeList = (listener) => {
          try {
            return list?.subscribe?.(listener) ?? (() => {});
          } catch {
            return () => {};
          }
        };

        /** Announce one finished turn for a Session with the current copy. */
        const announceCompletion = (sessionId) => {
          const row = listSnapshot()?.byId?.[sessionId];
          // Subagent Sessions finish with their parent turn; the parent already notifies.
          if (row?.parentId !== undefined) return;
          const label = typeof row?.displayTitle === 'string' && row.displayTitle !== ''
            ? row.displayTitle
            : undefined;
          void presentCompletion({
            title: t('notify.done'),
            body: label === undefined ? t('notify.bodyFallback') : t('notify.body', { title: label }),
            sessionId,
            open: () => ctx.get('uiWorkspace')?.openSession?.(sessionId),
          });
        };

        /**
         * Running state per Session. The list only seeds ids this map has not
         * seen yet: its flush runs from the same status dispatch, so overwriting
         * would erase the true -> false transition we need to observe.
         */
        const running = new Map();
        const seedFromList = () => {
          const snapshot = listSnapshot();
          if (!snapshot || snapshot.phase !== 'ready') return;
          for (const id of snapshot.ids ?? []) {
            if (running.has(id)) continue;
            running.set(id, snapshot.byId?.[id]?.running === true);
          }
        };
        seedFromList();

        ctx.effect(() => {
          let statusWatching = false;
          let stopStatus = () => {};
          try {
            stopStatus = ctx.remote.$on('api-session/status', (sessionId, isRunning) => {
              const wasRunning = running.get(sessionId);
              running.set(sessionId, isRunning === true);
              if (isRunning === true || wasRunning !== true) return;
              announceCompletion(sessionId);
            });
            statusWatching = true;
          } catch (error) {
            // Older or read-only Clients cannot receive forwarded events; the
            // list projection below still carries the same running state.
            console.warn('[dh-extensions] Session status events are unavailable:', error);
          }

          // Fallback: observe the Session list projection directly when the
          // forwarded status event is not available.
          let listRunning;
          const observeList = () => {
            const snapshot = listSnapshot();
            if (!snapshot || snapshot.phase !== 'ready') return;
            const next = new Map();
            for (const id of snapshot.ids ?? []) {
              next.set(id, snapshot.byId?.[id]?.running === true);
            }
            if (listRunning === undefined) {
              listRunning = next;
              return;
            }
            for (const [id, isRunning] of next) {
              if (isRunning === false && listRunning.get(id) === true) announceCompletion(id);
            }
            listRunning = next;
          };
          const stopList = subscribeList(() => {
            seedFromList();
            if (!statusWatching) observeList();
          });
          return () => {
            stopStatus();
            stopList();
          };
        }, 'dh-extensions: Session completion watch');
      },
    };
  },
});




