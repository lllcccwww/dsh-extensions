/**
 * Side chat (host): fork one session into a persisted child and append the
 * boundary instruction that keeps the child explanatory.
 *
 * No `@deepseek-ai/*` imports on purpose: this bundle is linked into the
 * profile without its own dependencies, so a plugin-local peer import resolves
 * to the profile's harness copy, which is not the copy the desktop runtime
 * runs. The fork therefore goes through the mounted `sessionController`
 * service, and the boundary message through the live agent's session.
 */
import { randomUUID } from 'node:crypto';
import { readBody, sendJson } from '../../shared/http.js';

/** Instruction appended after the fork cut; the tab hides it with the prefix. */
const BOUNDARY = [
  'This is a side conversation, separate from the main task.',
  'The conversation before this point is reference context only. Do not continue, execute, or complete the main task from it.',
  'The user selected part of the main conversation and wants it explained or discussed.',
  'Do not modify files, source, git state, permissions, configuration, or any other workspace state unless the user explicitly requests that mutation here.',
  'If the user explicitly requests a mutation, keep it minimal and local to the request, and do not disturb the main thread.',
  'Sub-agents are off-limits in this side conversation.',
].join(' ');

const TITLE_LIMIT = 160;

/** Host context captured by `setup`; route handlers have no ctx argument. */
let host;

export default {
  id: 'sidechat',
  setup(ctx) {
    host = ctx;
  },
  routes: [{ path: '/dh/sidechat/fork', handler: handleFork }],
};

/**
 * Answer one route with a stable code and human-readable reason.
 * @param res - Node response.
 * @param status - HTTP status.
 * @param code - stable machine code.
 * @param message - caller-visible reason.
 */
function failure(res, status, code, message) {
  return sendJson(res, status, { code, message });
}

/**
 * Fork one session and append the side-conversation boundary.
 * @param req - Node request with a JSON `{ sessionId, title? }` body.
 * @param res - Node response carrying `{ childId, hideThroughSeq }`.
 */
async function handleFork(req, res) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'method-not-allowed', 'POST required');
  }
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return failure(res, 400, 'bad-request', 'request body must be JSON');
  }
  const sessionId = body?.sessionId;
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    return failure(res, 400, 'bad-request', 'sessionId is required');
  }
  const ctx = host;
  if (ctx === undefined) {
    return failure(res, 503, 'unavailable', 'host context is not mounted');
  }
  const controller = ctx.get('sessionController');
  if (controller?.fork === undefined) {
    return failure(res, 503, 'unavailable', 'session controller is not mounted');
  }

  let childId;
  try {
    const result = await controller.fork({ sessionId });
    childId = result?.sessionId;
  } catch (error) {
    const code = error?.code ?? error?.rpcError?.code ?? '';
    if (code === 'session/fork-unavailable') {
      return failure(res, 409, 'no-completed-turn', '当前会话还没有已完成的回合，无法开启辅助对话');
    }
    if (code === 'session/not-found') {
      return failure(res, 404, 'session-not-found', '会话不存在或已被删除');
    }
    console.error('[dh-extensions] sidechat fork failed:', error);
    return failure(res, 502, 'fork-failed', error?.message ?? String(error));
  }
  if (typeof childId !== 'string' || childId === '') {
    return failure(res, 502, 'fork-failed', 'fork returned no session id');
  }

  let session;
  try {
    session = ctx.get('agents')?.get?.(childId)?.session;
  } catch (error) {
    console.warn('[dh-extensions] sidechat child session lookup failed:', error);
  }
  if (session === undefined) {
    return failure(res, 502, 'boundary-failed', '子会话已创建，但无法写入边界说明；请重试或删除该会话');
  }

  let hideThroughSeq;
  try {
    const event = session.append('user/message', {
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text: BOUNDARY }],
      source: { kind: 'dh-sidechat' },
    }, { surfaceOp: 'append' });
    hideThroughSeq = typeof event?.seq === 'number' ? event.seq : undefined;
  } catch (error) {
    console.error('[dh-extensions] sidechat boundary append failed:', error);
    return failure(res, 502, 'boundary-failed', '无法写入辅助对话的边界说明');
  }

  const requestedTitle = typeof body?.title === 'string' ? body.title.trim() : '';
  const title = (requestedTitle === '' ? '辅助对话' : requestedTitle).slice(0, TITLE_LIMIT);
  try {
    ctx.get('sessionTitle')?.rename?.(session, title);
  } catch (error) {
    console.warn('[dh-extensions] sidechat title rename failed:', error);
  }

  // The boundary must survive a restart even though the child has not started a
  // turn yet; the writer otherwise batches it.
  try {
    const store = ctx.get('sessions');
    if (typeof store?.flush === 'function') {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await store.flush(session);
    }
  } catch (error) {
    console.warn('[dh-extensions] sidechat flush failed:', error);
  }

  return sendJson(res, 200, {
    childId,
    hideThroughSeq: hideThroughSeq ?? null,
    title,
  });
}
