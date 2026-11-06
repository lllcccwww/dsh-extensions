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
    /** Unchanged from the standalone plugin so an existing preference survives. */
    const NOTIFY_KEY = 'dsh.turn-notify.enabled';
    const STATE_URL = '/dh/instructions/state';
    const SAVE_URL = '/dh/instructions/save';
    const FOCUS_URL = '/dh/notify/focus';
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

      'settings.title': '回答完成通知',
      'settings.description': '应用窗口最小化或不在前台时，回答完成后发送桌面通知。',
      'badge.label': '扩展',
      'badge.hint': '这一行由 DSH扩展 提供',
      'notify.title': '回答完成通知',
      'notify.desc': '窗口最小化或在后台时，回答结束发系统通知。',
      'notify.permTitle': '系统通知权限',
      'notify.permDesc': '被系统拒绝时不会弹出任何通知',
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

      'settings.title': 'Completion notifications',
      'settings.description': 'Send a desktop notification when an answer finishes while the window is minimized or in the background.',
      'badge.label': 'Extension',
      'badge.hint': 'This row is provided by DSH extensions',
      'notify.title': 'Completion notifications',
      'notify.desc': 'Notifies you when an answer finishes while the window is minimized or in the background.',
      'notify.permTitle': 'System notification permission',
      'notify.permDesc': 'Nothing appears when the system denies notifications',
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
.dx-sub-list{display:flex;flex-direction:column;margin:2px 0 0 2px;padding-left:14px;border-left:1px solid var(--dsw-alias-border-l2)}
.dx-sub-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0}
.dx-sub-row + .dx-sub-row{border-top:.5px solid var(--dsw-alias-border-l2)}
.dx-sub-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.dx-sub-title{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dx-sub-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dx-sub-value{flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}
.dx-sub-value-warn{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.dx-editor-wrap{position:relative;display:flex;flex-direction:column}
.dx-editor{width:100%;box-sizing:border-box;min-height:300px;resize:vertical;padding:12px 12px 32px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-base,transparent);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:20px;outline:none;tab-size:2}
.dx-editor:focus{border-color:var(--dsw-alias-brand-primary)}
.dx-editor::placeholder{color:var(--dsw-alias-label-tertiary)}
.dx-editor-meta{position:absolute;left:12px;right:18px;bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;pointer-events:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.dx-count-over{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-primary))}
.dx-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
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
.dx-row{display:flex;align-items:center;gap:8px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dx-row-text{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0;padding-right:48px}
.dx-row-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.dx-row-title-line{display:flex;align-items:center;gap:6px;min-width:0}
.dx-badge{display:inline-flex;align-items:center;flex:none;height:18px;padding:0 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-weight:400;white-space:nowrap}
.dx-row-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
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

      return h('div', { className: 'dx-setting' },
        h('div', { className: 'dx-setting-row' },
          h('div', { className: 'dx-setting-text' },
            h('div', { className: 'dx-setting-title' }, t('notify.title')),
            h('div', { className: 'dx-setting-desc' }, t('notify.desc'))),
          h('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': enabled ? 'true' : 'false',
            'aria-label': t('notify.title'),
            className: 'dx-switch',
            onClick: toggle,
          }, h('span', { className: 'dx-knob' }))),
        h('div', { className: 'dx-sub-list' },
          h('div', { className: 'dx-sub-row' },
            h('div', { className: 'dx-sub-text' },
              h('div', { className: 'dx-sub-title' }, t('notify.permTitle')),
              h('div', { className: 'dx-sub-desc' }, t('notify.permDesc'))),
            h('span', {
              className: `dx-sub-value${permission === 'denied' ? ' dx-sub-value-warn' : ''}`,
              role: 'status',
            }, permissionLabel(t, permission))),
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

    /** One General-settings row that keeps the quick notification switch. */
    /**
     * Quiet chip marking a Settings row this bundle contributed, so it reads as
     * third-party beside built-in rows without shouting.
     */
    function extensionBadge(t) {
      return h('span', {
        className: 'dx-badge',
        title: t('badge.hint'),
      }, t('badge.label'));
    }

    /** One General-settings row: the quick switch for completion notifications. */
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
      return h(React.Fragment, null,
        h('style', { key: 'style' }, CSS),
        h('div', { className: 'dx-row' },
          h('div', { className: 'dx-row-text' },
            h('div', { className: 'dx-row-title-line' },
              h('span', { className: 'dx-row-title' }, t('settings.title')),
              extensionBadge(t)),
            h('div', { className: 'dx-row-desc' }, t('settings.description'))),
          h('div', { className: 'dx-actions' },
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

    /** The DSH extensions settings page: stacked settings rows, like General. */
    function DhExtensionsSection(props) {
      const t = translator(props);
      return h('section', { className: 'dx-root' },
        h('style', null, CSS),
        h(PanelBoundary, { t, key: 'instructions' },
          h(InstructionsPanel, { t })),
        h(PanelBoundary, { t, key: 'notify' },
          h(NotifyPanel, { t })));
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



