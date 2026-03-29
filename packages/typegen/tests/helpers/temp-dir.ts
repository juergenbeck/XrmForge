/**
 * Test helper: Temporary directory management.
 * Creates isolated temp directories for filesystem integration tests.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a temporary directory with a unique name.
 * @returns Absolute path to the created directory
 */
export async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'xrmforge-test-'));
}

/**
 * Remove a temporary directory and all its contents.
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
