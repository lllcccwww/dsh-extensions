/**
 * Ordered host feature registry. Adding a feature means importing it here;
 * the aggregate mounts its routes and runs its setup.
 */
import compat from './compat/host.js';
import instructions from './instructions/host.js';
import notify from './notify/host.js';
import sandbox from './sandbox/host.js';

/** Features in activation order. */
export const features = [
  instructions,
  notify,
  sandbox,
  compat,
];
