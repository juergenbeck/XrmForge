/**
 * @xrmforge/devkit
 *
 * Build orchestration and project tooling for Dynamics 365 WebResources.
 * Abstracts esbuild to produce IIFE bundles with named globals for
 * D365 form event binding.
 *
 * @packageDocumentation
 */

// ─── Config ─────────────────────────────────────────────────────────────────
export type { BuildConfig, BuildEntry, ResolvedBuildConfig } from './config.js';
export { validateBuildConfig, resolveBuildConfig } from './config.js';

// ─── Builder ────────────────────────────────────────────────────────────────
export type { BuildResult, BuildResultEntry } from './builder/index.js';
export { build, watch } from './builder/index.js';

// ─── Scaffold ───────────────────────────────────────────────────────────────
export type { ScaffoldConfig, ScaffoldResult } from './scaffold/index.js';
export { scaffoldProject } from './scaffold/index.js';

// ─── Errors ─────────────────────────────────────────────────────────────────
export { BuildError, BuildErrorCode } from './errors.js';
