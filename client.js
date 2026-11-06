/**
 * Client half of the DSH extensions bundle: one Settings section that hosts a
 * tab per feature, plus the General-settings row the notify feature keeps.
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
    /** Last selected tab, so reopening Settings returns to the same feature. */
    const TAB_KEY = 'dsh.dh-extensions.tab';
    /** Unchanged from the standalone plugin so an existing preference survives. */
    const NOTIFY_KEY = 'dsh.turn-notify.enabled';
    const STATE_URL = '/dh/instructions/state';
    const SAVE_URL = '/dh/instructions/save';
    const FOCUS_URL = '/dh/notify/focus';
    const NOTICE_TTL_MS = 3200;

    const zh = {
      nav: 'DSH扩展',
      intro: '一个入口收着几个小功能，各自独立开关。后面新增的功能也会出现在这里。',
      'tabs.label': '功能',
      'crash.title': '这一页没能渲染',
      'crash.hint': '其它页不受影响；刷新页面可以重试。',

      'ins.title': '全局 AGENTS.md',
      'ins.intro': '为所有会话准备全局 AGENTS.md。它与每个项目的 AGENTS.md 一起加载，项目里更具体的文件优先。',
      'ins.loading': '正在读取…',
      'ins.retry': '重试',
      'ins.readFailed': '读取全局 AGENTS.md 失败',
      'ins.missingTag': '尚未创建',
      'ins.existsTag': '已创建',
      'ins.modified': '{time} 修改',
      'ins.editorLabel': '全局 AGENTS.md 内容',
      'ins.placeholder': '# 我的偏好\n\n- 默认用简体中文回答\n- 代码、命令、路径保持英文原文\n- 提交信息说明改了什么、为什么改',
      'ins.emptyHint': '这个文件还不存在。写入内容并保存后会创建它。',
      'ins.template': '使用起始模板',
      'ins.reload': '重新载入',
      'ins.save': '保存',
      'ins.saving': '保存中…',
      'ins.saved': '已保存，新会话开始时会加载新内容。',
      'ins.saveFailed': '保存失败',
      'ins.discardConfirm': '放弃未保存的修改？',
      'ins.conflictTitle': '磁盘上的文件已被修改',
      'ins.conflictBody': '载入之后这个文件在磁盘上发生了变化。选择覆盖磁盘内容，或者载入磁盘上的版本。',
      'ins.overwrite': '覆盖保存',
      'ins.loadDisk': '载入磁盘版本',
      'ins.truncated': '文件超过加载上限（1 MiB），已截断显示；请先在外部编辑器中缩短它。',
      'ins.budgetOver': '超过单条链的 65,536 字节预算，多出的部分会被截断。',
      'ins.budgetHint': '字节 · 单条链上限',
      'ins.sharedNote': '另外还存在 {path}，它也会作为全局指令加载。',
      'ins.unsaved': '有未保存的修改',
      'ins.explainSummary': '全局文件与项目 AGENTS.md 如何组合',
      'ins.explainMerge': '两者都会注入，先全局后项目，按从宽泛到具体排序；内容会拼接在一起，更具体的文件在措辞上优先。',
      'ins.explainDedupe': '去重只发生在同一目录内：同目录的 AGENTS.md 与 CLAUDE.md 内容完全相同才只出现一次，项目文件即使与全局文件一字不差也会各自注入。',
      'ins.explainTiming': '注入发生在会话第一次请求；改完最稳妥的是新开一个会话，当前会话会在下一次文件操作后对账。',

      'settings.title': '回答完成通知',
      'settings.description': '应用窗口最小化或不在前台时，回答完成后发送桌面通知。',
      'settings.test': '测试',
      'notify.title': '回答完成通知',
      'notify.intro': '窗口最小化或不在前台时，回答结束后发一条系统通知；点击通知会恢复窗口并打开对应会话。',
      'notify.toggle': '启用通知',
      'notify.statusOn': '已开启',
      'notify.statusOff': '已关闭',
      'notify.test': '发送测试通知',
      'notify.permission': '系统通知权限',
      'notify.permGranted': '已允许',
      'notify.permDenied': '已拒绝（需在系统设置里重新允许）',
      'notify.permDefault': '尚未授权（下次通知时会询问）',
      'notify.unsupported': '当前环境不支持系统通知',
      'notify.foregroundHint': '窗口在前台且聚焦时不会打扰；测试会忽略这个判断。',
      'notify.limits': '限制',
      'notify.limit1': '页面必须还在运行：最小化或隐藏到托盘都可以，退出应用后不会通知。',
      'notify.limit2': '通知的图标、声音与展示样式由操作系统决定。',
      'notify.body': '「{title}」已完成回答',
      'notify.bodyFallback': '会话已完成回答',
      'notify.done': '回答完成',
      'notify.test.title': '通知已开启',
      'notify.test.body': '窗口最小化或不在前台时，回答完成后会在这里提醒你。',
    };

    const en = {
      nav: 'DSH extensions',
      intro: 'One entry collects a few small features, each with its own switch. Features added later show up here too.',
      'tabs.label': 'Features',
      'crash.title': 'This panel failed to render',
      'crash.hint': 'Other panels keep working; reload the page to retry.',

      'ins.title': 'Global AGENTS.md',
      'ins.intro': 'Prepare a global AGENTS.md for every session. It loads together with each project AGENTS.md, and the more specific project file takes precedence.',
      'ins.loading': 'Reading…',
      'ins.retry': 'Retry',
      'ins.readFailed': 'Could not read the global AGENTS.md',
      'ins.missingTag': 'Not created yet',
      'ins.existsTag': 'Created',
      'ins.modified': 'modified {time}',
      'ins.editorLabel': 'Global AGENTS.md content',
      'ins.placeholder': '# My preferences\n\n- Answer in English\n- Keep code, commands, and paths verbatim\n- Commit messages explain what changed and why',
      'ins.emptyHint': 'This file does not exist yet. Saving content creates it.',
      'ins.template': 'Use starter template',
      'ins.reload': 'Reload',
      'ins.save': 'Save',
      'ins.saving': 'Saving…',
      'ins.saved': 'Saved. New sessions pick up the new content.',
      'ins.saveFailed': 'Could not save',
      'ins.discardConfirm': 'Discard unsaved changes?',
      'ins.conflictTitle': 'The file changed on disk',
      'ins.conflictBody': 'This file changed on disk after it was loaded. Overwrite the disk copy, or load the version on disk.',
      'ins.overwrite': 'Overwrite',
      'ins.loadDisk': 'Load disk version',
      'ins.truncated': 'The file exceeds the 1 MiB loader limit and is shown truncated; shorten it in an external editor first.',
      'ins.budgetOver': 'This exceeds the 65,536-byte per-chain budget, so the excess is truncated.',
      'ins.budgetHint': 'bytes · per-chain limit',
      'ins.sharedNote': '{path} also exists and loads as global instructions.',
      'ins.unsaved': 'Unsaved changes',
      'ins.explainSummary': 'How the global and project AGENTS.md combine',
      'ins.explainMerge': 'Both are injected: global first, then project files ordered broad to specific. The text is concatenated, and the more specific file takes precedence in wording.',
      'ins.explainDedupe': 'Deduplication only happens within one directory: AGENTS.md and CLAUDE.md collapse only when their content matches, while a project file is injected even when it is identical to the global one.',
      'ins.explainTiming': 'Injection happens on the first request of a session; a new session is the reliable way to pick up an edit, and the current one reconciles after the next file operation.',

      'settings.title': 'Completion notifications',
      'settings.description': 'Send a desktop notification when an answer finishes while the window is minimized or in the background.',
      'settings.test': 'Test',
      'notify.title': 'Completion notifications',
      'notify.intro': 'When the window is minimized or in the background, a finished answer sends a system notification; clicking it restores the window and opens that session.',
      'notify.toggle': 'Enable notifications',
      'notify.statusOn': 'On',
      'notify.statusOff': 'Off',
      'notify.test': 'Send a test notification',
      'notify.permission': 'System notification permission',
      'notify.permGranted': 'Allowed',
      'notify.permDenied': 'Denied (allow it again in system settings)',
      'notify.permDefault': 'Not requested yet (asked on the next notification)',
      'notify.unsupported': 'This environment does not support system notifications',
      'notify.foregroundHint': 'Nothing fires while the window is focused in front; a test ignores that check.',
      'notify.limits': 'Limits',
      'notify.limit1': 'The page must still be running: minimized or hidden to the tray is fine, a quit application is not.',
      'notify.limit2': 'The icon, sound, and presentation of a notification are decided by the operating system.',
      'notify.body': '“{title}” has finished answering',
      'notify.bodyFallback': 'The session has finished answering',
      'notify.done': 'Answer ready',
      'notify.test.title': 'Notifications are on',
      'notify.test.body': 'When the window is minimized or in the background, a finished answer is announced here.',
    };

    const CSS = `
.dx-root{display:flex;flex-direction:column;gap:14px;padding:2px 0 28px}
.dx-head{display:flex;flex-direction:column;gap:4px}
.dx-title{margin:0;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:500;line-height:24px}
.dx-intro{margin:0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.dx-tabs{display:flex;align-items:center;gap:4px;padding:3px;border-radius:calc(var(--dsw-radius-md,10px) + 2px);background:var(--dsw-alias-bg-module-platform);align-self:flex-start;max-width:100%;overflow-x:auto}
.dx-tab{font:inherit;font-size:13px;line-height:18px;padding:5px 12px;border:none;border-radius:var(--dsw-radius-md,10px);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;white-space:nowrap}
.dx-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dx-tab[aria-selected="true"]{background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.dx-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dx-panel{display:flex;flex-direction:column;gap:14px}
.dx-panel-title{margin:0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}
.dx-panel-intro{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12.5px;line-height:19px}
.dx-card{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-module-platform)}
.dx-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:20px}
.dx-path{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base,transparent);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:1px 6px}
.dx-tag{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dx-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;background:var(--dsw-alias-label-tertiary);vertical-align:1px}
.dx-dot-on{background:var(--dsw-alias-brand-primary)}
.dx-editor{width:100%;box-sizing:border-box;min-height:300px;resize:vertical;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:20px;outline:none;tab-size:2}
.dx-editor:focus{border-color:var(--dsw-alias-brand-primary)}
.dx-editor::placeholder{color:var(--dsw-alias-label-tertiary)}
.dx-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.dx-count{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dx-count-over{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-primary))}
.dx-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dx-btn{font:inherit;font-size:13px;line-height:18px;padding:6px 12px;border-radius:var(--dsw-radius-md,10px);border:1px solid transparent;cursor:pointer;white-space:nowrap}
.dx-btn:disabled{cursor:default;opacity:.45}
.dx-btn-primary{background:var(--dsw-alias-brand-primary);color:#fff}
.dx-btn-primary:not(:disabled):hover{opacity:.9}
.dx-btn-ghost{background:transparent;color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.dx-btn-ghost:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}
.dx-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dx-notice{padding:9px 12px;border-radius:var(--dsw-radius-md,10px);font-size:13px;line-height:20px}
.dx-notice-error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));background:var(--dsw-alias-state-error-bg,var(--dsw-alias-bg-module-platform))}
.dx-notice-ok{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform)}
.dx-warn{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:0}
.dx-empty{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.dx-empty-text{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.dx-conflict{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px)}
.dx-conflict-title{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}
.dx-conflict-body{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dx-explain{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:12.5px;line-height:19px}
.dx-explain summary{cursor:pointer;font-size:12.5px;line-height:19px}
.dx-explain ul{margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.dx-switch-row{display:flex;align-items:center;gap:12px;justify-content:space-between}
.dx-switch-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.dx-switch{position:relative;flex:none;width:40px;height:22px;padding:0;border:none;border-radius:999px;background:var(--dsw-alias-bg-module-platform);cursor:pointer;transition:background .15s ease}
.dx-switch:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dx-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}
.dx-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dx-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s ease}
.dx-switch[aria-checked="true"] .dx-knob{transform:translateX(18px)}
.dx-kv{display:flex;align-items:baseline;gap:8px;font-size:12.5px;line-height:19px}
.dx-k{color:var(--dsw-alias-label-tertiary);flex:none}
.dx-v{color:var(--dsw-alias-label-primary)}
.dx-error{padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px)}
.dx-error-title{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dx-error-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin-top:4px}
.dx-row{display:flex;align-items:center;gap:8px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dx-row-text{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0;padding-right:48px}
.dx-row-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.dx-row-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
`;

    //#region helpers
    /** Byte length of the UTF-8 document, matching what the loader budgets. */
    function utf8Length(text) {
      if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
      return unescape(encodeURIComponent(text)).length;
    }

    /** Human-readable byte size. */
    function formatBytes(count) {
      if (count < 1024) return `${count} B`;
      const kb = count / 1024;
      return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
    }

    /** Local wall-clock label for a server ISO timestamp. */
    function formatTime(iso) {
      if (typeof iso !== 'string') return '';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' });
    }

    /** Translator with a Chinese fallback when the slot does not pass one. */
    function translator(props) {
      if (typeof props?.t === 'function') return props.t;
      return (key) => zh[key] ?? key;
    }

    /** Fetch one JSON document from the Host half. */
    async function requestJson(url) {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    }
    //#endregion

    //#region notify preference
    /** A localStorage-backed boolean shared by the Settings row and the panel. */
    function createToastPreference() {
      let value = true;
      try {
        const raw = localStorage.getItem(NOTIFY_KEY);
        value = raw === null ? true : raw !== 'false';
      } catch {
        value = true;
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
            localStorage.setItem(NOTIFY_KEY, next ? 'true' : 'false');
          } catch {
            // Storage can be disabled; the session preference still applies.
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

    const notificationPreference = createToastPreference();
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

    //#region instructions panel
    /** The starter document offered when the global file does not exist yet. */
    const STARTER = [
      '# 我的偏好',
      '',
      '## 语言与表达',
      '- 默认用简体中文回答；代码、命令、路径、标识符保持原文。',
      '- 先给结论或改动结果，再给必要的解释；不重复显而易见的步骤。',
      '',
      '## 代码习惯',
      '- 改动前先读相关实现，沿用仓库已有的模式与命名。',
      '- 不做与任务无关的重构；新增依赖前先确认现有依赖是否够用。',
      '',
      '## 协作',
      '- 改动完成后说明验证方式；没验证的部分明确说出来。',
      '',
    ].join('\n');

    /** Global AGENTS.md editor. */
    function InstructionsPanel(props) {
      const t = translator(props);
      const mounted = React.useRef(true);
      const [phase, setPhase] = React.useState('loading');
      const [error, setError] = React.useState('');
      const [state, setState] = React.useState(null);
      const [draft, setDraft] = React.useState('');
      const [saving, setSaving] = React.useState(false);
      const [notice, setNotice] = React.useState(null);
      const [conflict, setConflict] = React.useState(null);

      React.useEffect(() => () => {
        mounted.current = false;
      }, []);

      const applyState = React.useCallback((next) => {
        setState(next);
        setDraft(next.content ?? '');
        setPhase('ready');
        setError('');
      }, []);

      const load = React.useCallback(() => {
        setPhase('loading');
        setError('');
        setConflict(null);
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

      React.useEffect(() => {
        if (notice === null) return undefined;
        const timer = setTimeout(() => setNotice(null), NOTICE_TTL_MS);
        return () => clearTimeout(timer);
      }, [notice]);

      const based = state?.content ?? '';
      const dirty = phase === 'ready' && draft !== based;
      const bytes = utf8Length(draft);
      const budget = typeof state?.maxBytes === 'number' ? state.maxBytes : 65536;
      const overBudget = phase === 'ready' && bytes > budget;

      const save = async (force) => {
        if (saving || phase !== 'ready') return;
        setSaving(true);
        setNotice(null);
        try {
          const response = await fetch(SAVE_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              content: draft,
              baseDigest: typeof state?.digest === 'string' ? state.digest : undefined,
              force: force === true,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!mounted.current) return;
          if (response.status === 409) {
            setConflict(payload.state ?? null);
            return;
          }
          if (!response.ok) {
            setNotice({ kind: 'error', text: payload.error ?? t('ins.saveFailed') });
            return;
          }
          applyState(payload);
          setConflict(null);
          setNotice({ kind: 'ok', text: t('ins.saved') });
        } catch (reason) {
          if (mounted.current) {
            setNotice({ kind: 'error', text: reason instanceof Error ? reason.message : String(reason) });
          }
        } finally {
          if (mounted.current) setSaving(false);
        }
      };

      const reload = () => {
        if (dirty && typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm(t('ins.discardConfirm'))) return;
        }
        load();
      };

      const onKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'S')) {
          event.preventDefault();
          void save(false);
        }
      };

      if (phase === 'loading') {
        return h('div', { className: 'dx-panel' },
          h('h3', { className: 'dx-panel-title' }, t('ins.title')),
          h('p', { className: 'dx-panel-intro' }, t('ins.loading')));
      }

      if (phase === 'error') {
        return h('div', { className: 'dx-panel' },
          h('h3', { className: 'dx-panel-title' }, t('ins.title')),
          h('p', { className: 'dx-panel-intro' }, t('ins.intro')),
          h('div', { className: 'dx-notice dx-notice-error', role: 'alert' },
            `${t('ins.readFailed')}: ${error}`),
          h('div', { className: 'dx-actions' },
            h('button', { type: 'button', className: 'dx-btn dx-btn-ghost', onClick: load }, t('ins.retry'))));
      }

      const meta = h('div', { className: 'dx-meta' },
        h('code', { className: 'dx-path' }, state?.displayPath ?? '~/.dsh/AGENTS.md'),
        h('span', { className: 'dx-tag' },
          h('span', { className: `dx-dot${state?.exists ? ' dx-dot-on' : ''}` }),
          state?.exists ? t('ins.existsTag') : t('ins.missingTag')),
        state?.exists && typeof state.updatedAt === 'string'
          ? h('span', { className: 'dx-tag' },
            `${formatBytes(state.bytes)} · ${t('ins.modified', { time: formatTime(state.updatedAt) })}`)
          : null,
        dirty ? h('span', { className: 'dx-tag' }, `· ${t('ins.unsaved')}`) : null);

      const editor = h('textarea', {
        className: 'dx-editor',
        spellCheck: false,
        'aria-label': t('ins.editorLabel'),
        placeholder: t('ins.placeholder'),
        value: draft,
        onChange: (event) => setDraft(event.target.value),
        onKeyDown,
      });

      const footer = h('div', { className: 'dx-foot' },
        h('span', { className: `dx-count${overBudget ? ' dx-count-over' : ''}` },
          `${bytes.toLocaleString()} / ${budget.toLocaleString()} ${t('ins.budgetHint')}`),
        h('div', { className: 'dx-actions' },
          h('button', {
            type: 'button',
            className: 'dx-btn dx-btn-ghost',
            onClick: reload,
            disabled: saving,
          }, t('ins.reload')),
          h('button', {
            type: 'button',
            className: 'dx-btn dx-btn-primary',
            onClick: () => void save(false),
            disabled: saving || !dirty,
          }, saving ? t('ins.saving') : t('ins.save'))));

      const emptyRow = state?.exists
        ? null
        : h('div', { className: 'dx-empty' },
          h('span', { className: 'dx-empty-text' }, t('ins.emptyHint')),
          h('button', {
            type: 'button',
            className: 'dx-btn dx-btn-ghost',
            onClick: () => setDraft(STARTER),
          }, t('ins.template')));

      const warnings = [];
      if (state?.truncated) warnings.push(h('p', { className: 'dx-warn', key: 'truncated' }, t('ins.truncated')));
      if (overBudget) warnings.push(h('p', { className: 'dx-warn', key: 'budget' }, t('ins.budgetOver')));
      if (state?.sharedExists) {
        warnings.push(h('p', { className: 'dx-warn', key: 'shared' },
          t('ins.sharedNote', { path: state.sharedDisplayPath })));
      }

      const conflictRow = conflict === null ? null : h('div', { className: 'dx-conflict', role: 'alert' },
        h('div', { className: 'dx-conflict-title' }, t('ins.conflictTitle')),
        h('div', { className: 'dx-conflict-body' }, t('ins.conflictBody')),
        h('div', { className: 'dx-actions' },
          h('button', {
            type: 'button',
            className: 'dx-btn dx-btn-ghost',
            onClick: () => {
              applyState(conflict);
              setConflict(null);
            },
          }, t('ins.loadDisk')),
          h('button', {
            type: 'button',
            className: 'dx-btn dx-btn-primary',
            onClick: () => {
              setConflict(null);
              void save(true);
            },
          }, t('ins.overwrite'))));

      const noticeRow = notice === null ? null : h('div', {
        className: `dx-notice dx-notice-${notice.kind === 'ok' ? 'ok' : 'error'}`,
        role: notice.kind === 'ok' ? 'status' : 'alert',
      }, notice.text);

      const explainer = h('details', { className: 'dx-explain' },
        h('summary', null, t('ins.explainSummary')),
        h('ul', null,
          h('li', null, t('ins.explainMerge')),
          h('li', null, t('ins.explainDedupe')),
          h('li', null, t('ins.explainTiming'))));

      return h('div', { className: 'dx-panel' },
        h('h3', { className: 'dx-panel-title' }, t('ins.title')),
        h('p', { className: 'dx-panel-intro' }, t('ins.intro')),
        h('div', { className: 'dx-card' }, meta, emptyRow, editor, footer),
        noticeRow,
        conflictRow,
        warnings,
        explainer);
    }
    //#endregion

    //#region notify panel
    /** Live permission label for the panel. */
    function permissionLabel(t) {
      if (typeof Notification !== 'function') return t('notify.unsupported');
      if (Notification.permission === 'granted') return t('notify.permGranted');
      if (Notification.permission === 'denied') return t('notify.permDenied');
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
      const [permission, setPermission] = React.useState(() => permissionLabel(t));
      React.useEffect(() => {
        setPermission(permissionLabel(t));
      }, [enabled, t]);

      const toggle = () => {
        const next = !notificationPreference.getSnapshot();
        notificationPreference.set(next);
        if (next) ensureNotificationPermission().then(() => setPermission(permissionLabel(t)), () => {});
      };

      const sendTest = () => {
        void presentCompletion({
          title: t('notify.test.title'),
          body: t('notify.test.body'),
          sessionId: 'test',
          force: true,
        }).then(() => setPermission(permissionLabel(t)), () => {});
      };

      return h('div', { className: 'dx-panel' },
        h('h3', { className: 'dx-panel-title' }, t('notify.title')),
        h('p', { className: 'dx-panel-intro' }, t('notify.intro')),
        h('div', { className: 'dx-card' },
          h('div', { className: 'dx-switch-row' },
            h('div', { className: 'dx-switch-text' },
              h('div', { className: 'dx-row-title' }, t('notify.toggle')),
              h('div', { className: 'dx-row-desc' },
                enabled ? t('notify.statusOn') : t('notify.statusOff'))),
            h('button', {
              type: 'button',
              role: 'switch',
              'aria-checked': enabled ? 'true' : 'false',
              'aria-label': t('notify.toggle'),
              className: 'dx-switch',
              onClick: toggle,
            }, h('span', { className: 'dx-knob' }))),
          h('div', { className: 'dx-kv' },
            h('span', { className: 'dx-k' }, t('notify.permission')),
            h('span', { className: 'dx-v' }, permission)),
          h('div', { className: 'dx-actions' },
            h('button', {
              type: 'button',
              className: 'dx-btn dx-btn-ghost',
              disabled: !enabled,
              onClick: sendTest,
            }, t('notify.test')))),
        h('p', { className: 'dx-warn' }, t('notify.foregroundHint')),
        h('details', { className: 'dx-explain' },
          h('summary', null, t('notify.limits')),
          h('ul', null,
            h('li', null, t('notify.limit1')),
            h('li', null, t('notify.limit2')))));
    }

    /** One General-settings row that keeps the quick notification switch. */
    function NotifyRow(props) {
      const t = translator(props);
      const enabled = React.useSyncExternalStore(
        notificationPreference.subscribe,
        notificationPreference.getSnapshot,
        notificationPreference.getSnapshot,
      );
      const toggle = () => {
        const next = !notificationPreference.getSnapshot();
        notificationPreference.set(next);
        if (next) void ensureNotificationPermission();
      };
      const sendTest = () => {
        void presentCompletion({
          title: t('notify.test.title'),
          body: t('notify.test.body'),
          sessionId: 'test',
          force: true,
        });
      };
      return h(React.Fragment, null,
        h('style', { key: 'style' }, CSS),
        h('div', { className: 'dx-row' },
          h('div', { className: 'dx-row-text' },
            h('div', { className: 'dx-row-title' }, t('settings.title')),
            h('div', { className: 'dx-row-desc' }, t('settings.description'))),
          h('div', { className: 'dx-actions' },
            h('button', {
              type: 'button',
              className: 'dx-btn dx-btn-ghost',
              disabled: !enabled,
              onClick: sendTest,
            }, t('settings.test')),
            h('button', {
              type: 'button',
              role: 'switch',
              'aria-checked': enabled ? 'true' : 'false',
              'aria-label': t('settings.title'),
              className: 'dx-switch',
              onClick: toggle,
            }, h('span', { className: 'dx-knob' })))));
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

    /** Feature tabs rendered as one settings section. */
    const FEATURES = [
      { id: 'instructions', titleKey: 'ins.title', Panel: InstructionsPanel },
      { id: 'notify', titleKey: 'notify.title', Panel: NotifyPanel },
    ];

    /** Persisted tab choice; an unknown id falls back to the first feature. */
    function initialTab() {
      try {
        const saved = localStorage.getItem(TAB_KEY);
        if (typeof saved === 'string' && FEATURES.some((feature) => feature.id === saved)) return saved;
      } catch {
        // Storage can be disabled.
      }
      return FEATURES[0].id;
    }

    /** The DSH extensions settings section. */
    function DhExtensionsSection(props) {
      const t = translator(props);
      const [tab, setTab] = React.useState(initialTab);

      const select = (id) => {
        setTab(id);
        try {
          localStorage.setItem(TAB_KEY, id);
        } catch {
          // The tab still switches for this session.
        }
      };

      const onTabKeyDown = (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const index = FEATURES.findIndex((feature) => feature.id === tab);
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = FEATURES[(index + delta + FEATURES.length) % FEATURES.length];
        select(next.id);
        const node = event.currentTarget.parentElement?.querySelector(`[data-tab="${next.id}"]`);
        node?.focus?.();
      };

      const active = FEATURES.find((feature) => feature.id === tab) ?? FEATURES[0];
      const Panel = active.Panel;

      return h('section', { className: 'dx-root' },
        h('style', null, CSS),
        h('div', { className: 'dx-head' },
          h('h2', { className: 'dx-title' }, t('nav')),
          h('p', { className: 'dx-intro' }, t('intro'))),
        h('div', {
          className: 'dx-tabs',
          role: 'tablist',
          'aria-label': t('tabs.label'),
        }, FEATURES.map((feature) => h('button', {
          key: feature.id,
          type: 'button',
          role: 'tab',
          'data-tab': feature.id,
          'aria-selected': feature.id === tab ? 'true' : 'false',
          tabIndex: feature.id === tab ? 0 : -1,
          className: 'dx-tab',
          onClick: () => select(feature.id),
          onKeyDown: onTabKeyDown,
        }, t(feature.titleKey)))),
        h(PanelBoundary, { t, key: active.id },
          h(Panel, { t })));
    }
    //#endregion

    return {
      inject: ['slots', 'locale', 'sessions', 'remote'],
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

        ctx.slots.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item',
          id: 'dh-notify',
          order: 21,
          locale: NS,
        }, NotifyRow));

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

