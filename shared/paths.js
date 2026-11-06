/**
 * Harness-home paths shared by every DH feature.
 *
 * Resolves exactly like `@deepseek-ai/dsh-home-paths` so a feature reads and
 * writes the same files the instruction loader reads.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * The harness home: `$DSH_HOME`, else `~/.dsh`.
 * @returns the absolute harness home directory.
 */
export function dshHome() {
  const configured = process.env.DSH_HOME;
  return configured !== undefined && configured.trim() !== '' ? configured : join(homedir(), '.dsh');
}

/**
 * The shared agents root: `$DSH_AGENTS_HOME`, else `~/.agents`.
 * @returns the absolute shared agents directory.
 */
export function agentsHome() {
  const configured = process.env.DSH_AGENTS_HOME;
  return configured !== undefined && configured.trim() !== '' ? configured : join(homedir(), '.agents');
}

/** @returns the user-global instruction file. */
export function globalInstructionFile() {
  return join(dshHome(), 'AGENTS.md');
}

/** @returns the shared-root instruction file, which the loader also reads. */
export function sharedInstructionFile() {
  return join(agentsHome(), 'AGENTS.md');
}

/**
 * Shorten an absolute path for display, folding only the home directory.
 * @param absolutePath - absolute path of a user-owned file.
 * @returns the path with the home directory replaced by `~`.
 */
export function displayPath(absolutePath) {
  const home = homedir();
  return absolutePath.startsWith(home) ? `~${absolutePath.slice(home.length)}` : absolutePath;
}

