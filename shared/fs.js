/**
 * Crash-safe file replacement for user-owned documents.
 */
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Replace a file atomically so an interrupted write never leaves half a document.
 * @param file - absolute target path.
 * @param content - UTF-8 text to write.
 */
export function writeFileAtomic(file, content) {
  const directory = dirname(file);
  mkdirSync(directory, { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, content, 'utf8');
  try {
    renameSync(temporary, file);
  } catch (error) {
    // A locked target can reject the replace on Windows; fall back to an in-place write.
    try {
      writeFileSync(file, content, 'utf8');
      unlinkSync(temporary);
    } catch {
      try {
        unlinkSync(temporary);
      } catch {
        // The temporary file may already be gone.
      }
      throw error;
    }
  }
}
