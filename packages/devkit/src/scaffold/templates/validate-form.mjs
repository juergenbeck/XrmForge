/**
 * validate-form.mjs - Quality Gate for XrmForge Form Scripts
 *
 * Runs three checks in one command:
 * 1. TypeScript Compiler (tsc --noEmit)
 * 2. ESLint (src/ --max-warnings=0)
 * 3. Pattern Compliance (critical rule violations via text search)
 *
 * Exit code: 0 = all green, 1 = errors found
 *
 * Usage:
 *   node scripts/validate-form.mjs
 *   npm run validate
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const NC = '\x1b[0m';

let totalErrors = 0;

// ============================================================
// 1. TypeScript Compiler
// ============================================================

console.log('=== XrmForge Quality Gate ===\n');
console.log('--- TypeScript ---');

try {
  execSync('npx tsc --noEmit', { stdio: 'pipe', encoding: 'utf-8' });
  console.log(`${GREEN}OK${NC}   tsc --noEmit`);
} catch (err) {
  const output = (err.stdout || '') + (err.stderr || '');
  const errorCount = (output.match(/error TS/g) || []).length;
  console.log(`${RED}FAIL${NC} tsc --noEmit (${errorCount} errors)`);
  console.log(output.split('\n').slice(0, 20).join('\n'));
  totalErrors += errorCount || 1;
}

// ============================================================
// 2. ESLint
// ============================================================

console.log('\n--- ESLint ---');

try {
  execSync('npx eslint src/ --max-warnings=0', { stdio: 'pipe', encoding: 'utf-8' });
  console.log(`${GREEN}OK${NC}   eslint src/ --max-warnings=0`);
} catch (err) {
  const output = (err.stdout || '') + (err.stderr || '');
  const problemMatch = output.match(/(\d+) problems?/);
  const count = problemMatch ? problemMatch[1] : '?';
  console.log(`${RED}FAIL${NC} eslint (${count} problems)`);
  console.log(output.split('\n').slice(0, 20).join('\n'));
  totalErrors += parseInt(count) || 1;
}

// ============================================================
// 3. Pattern Compliance (critical rules)
// ============================================================

console.log('\n--- Pattern Compliance ---');

/**
 * Collect all .ts files recursively from a directory.
 */
function collectTsFiles(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        results.push(...collectTsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory does not exist
  }
  return results;
}

/**
 * Check a pattern rule against all files.
 * @param {string} label - Description of the check
 * @param {string[]} files - Files to check
 * @param {RegExp} regex - Pattern to match (violation)
 * @param {string[]} excludeFiles - File paths to exclude
 * @param {RegExp[]} excludePatterns - Line patterns to exclude (not violations even if regex matches)
 * @returns Number of violations
 */
function checkPattern(label, files, regex, excludeFiles = [], excludePatterns = []) {
  const violations = [];
  for (const file of files) {
    const relPath = relative(process.cwd(), file);
    if (excludeFiles.some((ex) => relPath.includes(ex))) continue;

    const lines = readFileSync(file, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (excludePatterns.some((ep) => ep.test(trimmed))) continue;
      if (regex.test(line)) {
        violations.push(`  ${relPath}:${i + 1}: ${trimmed}`);
      }
    }
  }

  if (violations.length === 0) {
    console.log(`${GREEN}OK${NC}   [0] ${label}`);
  } else {
    console.log(`${RED}FAIL${NC} [${violations.length}] ${label}`);
    violations.slice(0, 10).forEach((v) => console.log(v));
    if (violations.length > 10) {
      console.log(`  ... and ${violations.length - 10} more`);
    }
    totalErrors += violations.length;
  }
  return violations.length;
}

const formFiles = collectTsFiles('src/forms');
const allSrcFiles = collectTsFiles('src');

// ── Field Access ─────────────────────────────────────────────────────────────

// 3a. Raw strings in getAttribute/getControl (must use Fields Enum)
checkPattern(
  'Raw field strings in getAttribute/getControl',
  formFiles,
  /(?:getAttribute|getControl)\s*\(\s*['"][a-z]/,
);

// 3b. Raw strings in helper wrappers (getValue, setFieldValue, setDisabled, addOnChange, setVisible, setRequiredLevel)
checkPattern(
  'Raw field strings in helper functions (use typedForm or Fields Enum)',
  allSrcFiles,
  /(?:getValue|setFieldValue|setDisabled|addOnChange|setVisible|setRequiredLevel|addPreSearch)\s*\(\s*\w+\s*,\s*['"][a-z]/,
  ['generated/', 'logger.ts'],
);

// 3c. Raw strings in select() (must use entity-level Fields Enum)
checkPattern(
  'Raw field strings in select() (use entity-level Fields Enum)',
  allSrcFiles,
  /\bselect\s*\(\s*['"][a-z]/,
  ['generated/'],
);

// ── Entity Names ─────────────────────────────────────────────────────────────

// 3d. Raw entity name strings in WebApi calls (must use EntityNames Enum)
checkPattern(
  'Raw entity names in WebApi (must use EntityNames Enum)',
  allSrcFiles,
  /(?:retrieveRecord|retrieveMultipleRecords|createRecord|updateRecord|deleteRecord)\s*\(\s*['"]/,
  ['generated/'],
);

// 3e. SystemEntities workaround (must extend generation instead)
checkPattern(
  'SystemEntities workaround (extend generation with --entities instead)',
  allSrcFiles,
  /SystemEntities\./,
);

// ── Magic Values ─────────────────────────────────────────────────────────────

// 3f. Magic numbers in OptionSet comparisons (must use OptionSet Enum)
checkPattern(
  'Magic numbers in value comparisons (use OptionSet Enum)',
  allSrcFiles,
  /getValue\(\)\s*===?\s*\d{3,}/,
  ['generated/'],
);

// 3g. Magic number 86400000 (must use named constant MS_PER_DAY)
checkPattern(
  'Magic number 86400000 (use named constant MS_PER_DAY)',
  allSrcFiles,
  /86400000/,
);

// 3h. Raw notification level strings (must use FormNotificationLevel)
checkPattern(
  'Raw notification level strings (use FormNotificationLevel from @xrmforge/helpers)',
  allSrcFiles,
  /setFormNotification\s*\([^)]*['"](?:ERROR|WARNING|INFO)['"]/,
);

// ── Deprecated / Unsafe ──────────────────────────────────────────────────────

// 3i. Xrm.Page (deprecated since D365 v9.0)
checkPattern(
  'Xrm.Page (deprecated since D365 v9.0)',
  allSrcFiles,
  /\bXrm\.Page\b/,
);

// 3j. eval() usage
checkPattern(
  'eval() usage (use Number() or JSON.parse())',
  allSrcFiles,
  /\beval\s*\(/,
);

// 3k. console.log/warn/error outside logger.ts (must use Logger)
checkPattern(
  'console.* outside logger.ts (must use Logger)',
  allSrcFiles,
  /\bconsole\.(log|warn|error|info|debug)\b/,
  ['logger.ts'],
);

// ── Handler Pattern ──────────────────────────────────────────────────────────

// 3l. Exported handlers without wrapHandler or wrapCommand
checkPattern(
  'Exported handlers without wrapHandler/wrapCommand',
  formFiles,
  /^export\s+(const|async\s+function|function)\s+\w+(?!.*(?:wrapHandler|wrapCommand))/,
  [],
  [
    // Re-exports: `export const form_OnLoad = onLoad;` (alias for a wrapped handler)
    /^export\s+const\s+\w+\s*=\s*[a-zA-Z][a-zA-Z0-9]*\s*;/,
  ],
);

// ── Raw $select ──────────────────────────────────────────────────────────────

// 3m. Raw $select strings (must use select() from @xrmforge/helpers)
checkPattern(
  'Raw $select strings (must use select() from @xrmforge/helpers)',
  allSrcFiles,
  /['"]\?\$select=/,
  ['generated/'],
);

// ── FetchXML ─────────────────────────────────────────────────────────────────

// 3n. Raw field names in FetchXML attribute= (should use Fields Enum interpolation)
checkPattern(
  'Raw field names in FetchXML (use Fields Enum interpolation)',
  allSrcFiles,
  /attribute\s*=\s*'[a-z][a-z0-9_]+'/,
  ['generated/'],
);

// 3o. Magic numbers in FetchXML <value> (should use OptionSet Enum)
checkPattern(
  'Magic numbers in FetchXML values (use OptionSet Enum)',
  allSrcFiles,
  /<value>\d{3,}<\/value>/,
  ['generated/'],
);

// ============================================================
// Result
// ============================================================

console.log('\n=== Result ===');
if (totalErrors === 0) {
  console.log(`${GREEN}All checks passed. 0 violations.${NC}`);
  process.exit(0);
} else {
  console.log(`${RED}${totalErrors} violations found.${NC}`);
  process.exit(1);
}
