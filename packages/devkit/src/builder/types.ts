/**
 * @xrmforge/devkit - Build Result Types
 */

/** Result of building a single entry */
export interface BuildResultEntry {
  /** Entry name from the config */
  name: string;
  /** Absolute path of the output file */
  outFile: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Build duration in milliseconds */
  durationMs: number;
}

/** Overall result of building all entries */
export interface BuildResult {
  /** Per-entry results */
  entries: BuildResultEntry[];
  /** Total build duration in milliseconds */
  totalDurationMs: number;
  /** Build errors (entry name + message) */
  errors: string[];
  /** Build warnings (entry name + message) */
  warnings: string[];
}
