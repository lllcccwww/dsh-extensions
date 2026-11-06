/**
 * Host aggregate for the DSH extensions bundle.
 *
 * Each feature owns its routes and optional setup; this file only mounts them,
 * so a failing feature is reported without preventing the others from loading.
 */
import { features } from './features/registry.js';

/** Every feature serves JSON routes on the Host web server. */
export const inject = ['webServer'];

/**
 * Mount every registered feature on the Host.
 * @param ctx - Host plugin context providing `webServer`.
 */
export function apply(ctx) {
  for (const feature of features) {
    try {
      feature.setup?.(ctx);
    } catch (error) {
      console.error(`[dh-extensions] ${feature.id} setup failed:`, error);
    }
    for (const route of feature.routes ?? []) {
      ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: route.path,
        handler: route.handler,
      }), `dh-extensions: ${feature.id} ${route.path}`);
    }
  }
}

