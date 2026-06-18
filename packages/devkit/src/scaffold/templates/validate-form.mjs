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
const YELLOW = '\x1b[33m';
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

// ── Type Safety Bypass ───────────────────────────────────────────────────────

// 3l2. Cast to Xrm.FormContext (bypasses typed form interface)
checkPattern(
  'Cast to Xrm.FormContext (use typedForm $unsafe() for off-form fields)',
  formFiles,
  /as\s+(?:unknown\s+as\s+)?Xrm\.FormContext/,
);

// 3l3. Raw strings in $filter (field names must use Fields Enum interpolation)
checkPattern(
  'Raw field names in $filter (use Fields Enum interpolation)',
  allSrcFiles,
  /\$filter=[^$]*\b(?:eq|ne|gt|lt|ge|le|contains|startswith)\b/,
  ['generated/', 'validate-form'],
  [
    // Allow if the line contains template literal interpolation (${...})
    /\$\{/,
  ],
);

// 3l4. Raw strings in $unsafe() (must use Entity-level Fields Enum)
checkPattern(
  'Raw field strings in $unsafe() (use Entity-level Fields Enum)',
  formFiles,
  /\$unsafe\s*\(\s*['"][a-z]/,
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

// ── WebApi Response Typing ────────────────────────────────────────────────────

// 3p. Untyped WebApi responses (must use generated Entity interfaces)
checkPattern(
  'Untyped WebApi response cast (use generated Entity interface instead of Record<string, unknown>)',
  allSrcFiles,
  /as\s+Record\s*<\s*string\s*,\s*unknown\s*>/,
  ['generated/'],
);

// 3q. Manual OData annotation access (use parseLookup instead)
checkPattern(
  'Manual OData annotation access (use parseLookup() from @xrmforge/helpers)',
  allSrcFiles,
  /@OData\.Community\.Display|@Microsoft\.Dynamics\.CRM\.lookuplogicalname|_value(?:@|\s*as\s)/,
  ['generated/', 'node_modules'],
);

// ── Lookup Convention (Fields vs NavigationProperties, F-LMA7-05) ─────────────

// 3q2. Hand-built `_<field>_value` key (Fields enum is already _value-form, never wrap again).
// Compiles green (plain string concatenation) but produces __..._value_value -> OData 400 at runtime.
checkPattern(
  'Double _value wrap on a lookup (Fields enum is already _value-form, no _${...}_value)',
  allSrcFiles,
  /_\$\{[^}]*\}_value/,
  ['generated/'],
);

// 3q3. parseLookup with a Fields enum value (must use the NavigationProperties enum).
// parseLookup builds the key itself as _${nav}_value; a Fields value (already _value) yields null.
checkPattern(
  'parseLookup with a Fields enum (use the NavigationProperties enum instead)',
  allSrcFiles,
  /parseLookup\s*\(\s*\w+\s*,\s*\w*Fields\b/,
  ['generated/'],
);

// ── Legacy Helper Wrappers ───────────────────────────────────────────────────

// 3r. Forbidden legacy helper functions (must use typedForm + @xrmforge/helpers)
checkPattern(
  'Forbidden helper: getLookupId (use formLookupId from @xrmforge/helpers)',
  allSrcFiles,
  /\bgetLookupId\s*\(/,
  ['generated/'],
);

checkPattern(
  'Forbidden helper: setLookupValue (use form.field.setValue([{...}]))',
  allSrcFiles,
  /\bsetLookupValue\s*\(/,
  ['generated/'],
);

// ── UI Localization ──────────────────────────────────────────────────────────

// 3s. Hardcoded UI strings in dialogs/progress (must use pickLang from constants.ts)
checkPattern(
  'Hardcoded UI string in dialog/progress (use pickLang(MESSAGES) from constants.ts)',
  allSrcFiles,
  /(?:openAlertDialog|openConfirmDialog|openErrorDialog|showProgressIndicator)\s*\(\s*(?:\{\s*text\s*:\s*)?['"]/,
  ['generated/', 'constants.ts'],
);

// ── Duplicate Framework Functions ────────────────────────────────────────────

// 3t. Own normalizeGuid/compareGuid (use normalizeGuid from @xrmforge/helpers)
checkPattern(
  'Own normalizeGuid/compareGuid definition (use normalizeGuid from @xrmforge/helpers)',
  allSrcFiles,
  /(?:export\s+)?function\s+(?:normalizeGuid|compareGuid)\s*\(/,
);

// ── Legacy Code Smells ───────────────────────────────────────────────────────

// 3u. var declarations (use const/let)
checkPattern(
  'var declarations (use const or let)',
  allSrcFiles,
  /^\s*var\s/,
);

// 3v. Synchronous XMLHttpRequest (use fetch or Xrm.WebApi)
checkPattern(
  'XMLHttpRequest (use fetch or Xrm.WebApi)',
  allSrcFiles,
  /\bXMLHttpRequest\b/,
);

// ============================================================
// Test Completeness (warning only, does not fail the gate)
// ============================================================

console.log('\n--- Test Completeness ---');

let missingTests = 0;
for (const formFile of formFiles) {
  const base = formFile.replace(/.*[\\/]/, '').replace(/\.ts$/, '');
  try {
    readFileSync(join('tests', 'forms', `${base}.test.ts`));
  } catch {
    console.log(`${YELLOW}WARN${NC} No test file for ${relative(process.cwd(), formFile)}`);
    missingTests++;
  }
}
if (missingTests === 0) {
  console.log(`${GREEN}OK${NC}   [0] All form scripts have test files`);
}

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
