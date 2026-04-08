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
 * @returns Number of violations
 */
function checkPattern(label, files, regex, excludeFiles = []) {
  const violations = [];
  for (const file of files) {
    const relPath = relative(process.cwd(), file);
    if (excludeFiles.some((ex) => relPath.includes(ex))) continue;

    const lines = readFileSync(file, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
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

// 3a. Raw strings in getAttribute/getControl (must use Fields Enum)
checkPattern(
  'Raw field strings in getAttribute/getControl (must use Fields Enum)',
  formFiles,
  /(?:getAttribute|getControl)\s*\(\s*['"][a-z]/,
);

// 3b. console.log/warn/error outside logger.ts (must use Logger)
checkPattern(
  'console.* outside logger.ts (must use Logger)',
  allSrcFiles,
  /\bconsole\.(log|warn|error|info|debug)\b/,
  ['logger.ts'],
);

// 3c. Exported handlers without wrapHandler
checkPattern(
  'Exported handlers without wrapHandler',
  formFiles,
  /^export\s+(const|async\s+function|function)\s+\w+(?!.*wrapHandler)/,
);

// 3d. Raw entity name strings in WebApi calls (must use EntityNames Enum)
checkPattern(
  'Raw entity names in WebApi (must use EntityNames Enum)',
  allSrcFiles,
  /(?:retrieveRecord|retrieveMultipleRecords|createRecord|updateRecord|deleteRecord)\s*\(\s*['"]/,
  ['generated/'],
);

// 3e. Xrm.Page (deprecated since D365 v9.0)
checkPattern(
  'Xrm.Page (deprecated since D365 v9.0)',
  allSrcFiles,
  /\bXrm\.Page\b/,
);

// 3f. Raw $select strings (must use select() from @xrmforge/helpers)
checkPattern(
  'Raw $select strings (must use select() from @xrmforge/helpers)',
  allSrcFiles,
  /['"]\?\$select=/,
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
