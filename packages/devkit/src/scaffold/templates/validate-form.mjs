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

// Error-handling wrappers an exported entry point may use (Check 3l). Single
// source of truth - keep in sync with src/shared/error-handler.ts. wrapGridCommand
// (subgrid ribbon commands, F-MK9-02), wrapWebResource (HTML WebResource init,
// Runde 10 F-LMA10-02) and wrapEnableRule (ribbon Enable Rules, sync boolean) are
// NOT substrings of wrapCommand, so they must be listed explicitly or the gate
// false-flags correct code (FW-3 / F-LMA10-02).
const HANDLER_WRAPPERS = ['wrapHandler', 'wrapCommand', 'wrapGridCommand', 'wrapWebResource', 'wrapEnableRule'];

// ── Optional file/dir scope (OE-23) ──────────────────────────────────────────
// Without arguments the gate scans the whole project (the real, final gate).
// With file/dir/`*`-glob arguments it narrows ESLint + pattern checks to those
// files - handy for parallel conversion (check only your own files, not a
// co-worker's still-open ones): `npm run validate:form -- src/forms/foo.ts`.
// tsc ALWAYS runs project-wide (a single-file tsc loses the tsconfig/type
// context); in scope mode its errors OUTSIDE the scope are shown as info but do
// NOT fail the gate. IMPORTANT: scoped-green is dev convenience only - the final
// argument-less run is the gate you commit/publish on.
const scopeArgs = process.argv.slice(2).filter((a) => a && !a.startsWith('-'));
const scopeFiles = resolveScope(scopeArgs); // [] = whole project (default)
const scoped = scopeFiles.length > 0;
const toRel = (p) => relative(process.cwd(), p).replace(/\\/g, '/');
const inScope = (relPath) => !scoped || scopeFiles.includes(relPath.replace(/\\/g, '/'));
if (scoped) {
  console.log(`(scope: ${scopeFiles.length} file(s); tsc still project-wide, final gate is the argument-less run)\n`);
} else if (scopeArgs.length > 0) {
  console.log(`${YELLOW}WARN${NC} scope arguments matched no src/*.ts files; scanning the whole project.\n`);
}

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
  const errorLines = output.split('\n').filter((l) => /error TS/.test(l));
  if (!scoped) {
    console.log(`${RED}FAIL${NC} tsc --noEmit (${errorLines.length} errors)`);
    console.log(output.split('\n').slice(0, 20).join('\n'));
    totalErrors += errorLines.length || 1;
  } else {
    // Scope mode: tsc is project-wide; only errors in scope files fail the gate,
    // errors elsewhere are shown as info (never swallowed - a broken neighbour
    // still surfaces, it just does not gate your scoped run).
    const scopeErrs = errorLines.filter((l) => inScope(l.split('(')[0]));
    const otherErrs = errorLines.length - scopeErrs.length;
    if (scopeErrs.length > 0) {
      console.log(`${RED}FAIL${NC} tsc --noEmit (${scopeErrs.length} errors in scope)`);
      console.log(scopeErrs.slice(0, 20).join('\n'));
      totalErrors += scopeErrs.length;
    } else {
      console.log(`${GREEN}OK${NC}   tsc --noEmit (scope clean)`);
    }
    if (otherErrs > 0) {
      console.log(`${YELLOW}INFO${NC} ${otherErrs} tsc error(s) OUTSIDE the scope (not counted; run without arguments for the full gate).`);
    }
  }
}

// ============================================================
// 2. ESLint
// ============================================================

console.log('\n--- ESLint ---');

const eslintTarget = scoped ? scopeFiles.join(' ') : 'src/';
try {
  execSync(`npx eslint ${eslintTarget} --max-warnings=0`, { stdio: 'pipe', encoding: 'utf-8' });
  console.log(`${GREEN}OK${NC}   eslint ${scoped ? `${scopeFiles.length} scope file(s)` : 'src/'} --max-warnings=0`);
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
 * Resolve optional scope arguments (files, directories, or `*` globs under src/)
 * to a sorted list of forward-slash relative .ts paths. Empty = whole project.
 * Globs are matched in-process (no shell expansion, Windows-safe).
 */
function resolveScope(args) {
  if (args.length === 0) return [];
  const rel = (p) => relative(process.cwd(), p).replace(/\\/g, '/');
  const all = collectTsFiles('src').map(rel);
  const out = new Set();
  for (const raw of args) {
    const arg = raw.replace(/\\/g, '/').replace(/^\.\//, '');
    if (arg.includes('*')) {
      const re = new RegExp(
        '^' + arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      );
      all.filter((f) => re.test(f)).forEach((f) => out.add(f));
    } else if (arg.endsWith('.ts')) {
      if (all.includes(arg)) out.add(arg);
    } else {
      collectTsFiles(arg).map(rel).forEach((f) => out.add(f));
    }
  }
  return [...out].sort();
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

/**
 * Multi-line check for untyped (any) Xrm.WebApi.retrieveRecord responses (F-CONS-02).
 *
 * retrieveRecord<T = any> returns `any` by default (@types/xrm), so a response
 * assigned WITHOUT a cast/type-parameter/annotation is silently `any` - with no
 * `any` keyword anywhere in the code. Passing it to a reader (parseLookup,
 * expanded, ...) loses all field type-safety, and no other gate catches it:
 * no-explicit-any sees no explicit any, tsc is green, Check 3p only matches the
 * `as Record<...>` cast.
 *
 * Deliberately NOT checkPattern (which is per-line): the correct inline cast is
 * almost always multi-line, with `as Entity` on the CLOSING line, not on the
 * retrieveRecord line (markant: 24 of 28 calls). A per-line regex would false-flag
 * every multi-line cast. So we scan the whole expression from the declaration up
 * to its terminating `;` and accept any of three typed forms in that window:
 *   1. `) as Foo`            inline cast (incl. `)) as Foo`, `as unknown as Foo`)
 *   2. `retrieveRecord<Foo>` explicit type parameter
 *   3. `const x: Foo = ...`  PascalCase type annotation on the variable
 * Only the pure any-case (NO `as` cast at all) is flagged here; `as any`/`as Record`
 * go to no-explicit-any / Check 3p, so there is no double reporting. This is a text
 * heuristic, not a type system - see ADR-2026-07-19-0730 for the accepted residual
 * risks (`.then()` callbacks, retyped parameters, hand-invented cast names).
 */
function checkUntypedRetrieveRecord(label, files, excludeFiles = []) {
  const declStart = /(?:const|let)\s+\w+[^=]*=\s*\(?\s*await\s+Xrm\.WebApi\.retrieveRecord\b(<[^>]*>)?/;
  const pascalAnnotation = /(?:const|let)\s+\w+\s*:\s*(?!any\b|unknown\b|object\b|Record\b)[A-Z]\w*/;
  const entityCast = /\bas\s+(?!any\b|unknown\b|Record\b|\{)[A-Z]\w*/;
  // `as any` / `as unknown as {...}` / `as Record<...>` are the other gates' job
  // (no-explicit-any, Check 3p). Recognise them so we don't double-report, but do
  // NOT let an unrelated argument cast (e.g. `opts as string`) mute a real finding.
  const coveredElsewhere = /\bas\s+(?:any\b|unknown\b|Record\b|\{)/;
  const violations = [];
  for (const file of files) {
    const relPath = relative(process.cwd(), file);
    if (excludeFiles.some((ex) => relPath.includes(ex))) continue;

    const lines = readFileSync(file, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      const decl = declStart.exec(lines[i]);
      if (!decl) continue;

      // Collect the whole expression window: from here to the first line ending in `;`.
      let j = i;
      let windowText = lines[i];
      while (!/;\s*(\/\/.*)?$/.test(lines[j]) && j < lines.length - 1 && j - i < 40) {
        j++;
        windowText += '\n' + lines[j];
      }

      const typed =
        Boolean(decl[1]) ||                 // 2. explicit type parameter <Foo>
        pascalAnnotation.test(lines[i]) ||  // 3. PascalCase variable annotation
        entityCast.test(windowText);        // 1. `as Entity` cast in the window
      // Flag the any-case (no valid entity cast); `as any`/`as Record`/`as {}`
      // are covered by no-explicit-any / Check 3p (avoid double reporting).
      if (!typed && !coveredElsewhere.test(windowText)) {
        violations.push(`  ${relPath}:${i + 1}: ${trimmed}`);
      }
      i = j; // skip past the consumed expression
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

const formFiles = collectTsFiles('src/forms').filter((f) => inScope(toRel(f)));
const allSrcFiles = collectTsFiles('src').filter((f) => inScope(toRel(f)));

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

// 3c2. Raw field names as keys in a typedFields kindMap (must use named constants).
// A kindMap key is either a computed key `[FieldsEnum.X]: 'kind'` (compliant) or a raw inline
// key `fieldname: 'kind'` / `'fieldname': 'kind'` (violation). Computed keys start with `[`
// right after the `{` and are not matched; a named-constant argument (typedFields(fc, XKINDS))
// has no `{` and is not matched. The `[^,]+` tolerates any first argument (fc, ctx.getFormContext()).
// Catches M12-A, which eslint/tsc pass (valid TS, wrong convention).
checkPattern(
  'Raw field names in typedFields kindMap (use named constants: [FieldsEnum.X]: kind)',
  allSrcFiles,
  /typedFields\s*\(\s*[^,]+,\s*\{\s*['"]?[a-zA-Z_]\w*['"]?\s*:/,
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

// 3l5. Off-form $unsafe(...).setValue() without submit (RETRO13-01 / F-LMA7-07).
// The on-form proxy wraps setValue() to force SubmitMode.Always, but $unsafe()
// returns the RAW attribute (no wrap). Off-form fields are never dirtied by the
// user, so a value set this way is SILENTLY DROPPED on AutoSave. Off-form writes
// must go through setUnsafeAndSubmit(form, field, value) (or setUnsafeAndSubmit(..,
// null) to clear). Reading ($unsafe().getValue()) and event wiring
// ($unsafe().addOnChange()) are NOT flagged - only the value-set path. A rare
// deliberate set-without-submit must make the intent explicit via the raw
// form.$context.getAttribute(field).setValue(v) path, which is not flagged.
checkPattern(
  'Off-form $unsafe().setValue() drops on AutoSave (use setUnsafeAndSubmit; off-form fields are never dirty)',
  formFiles,
  /\$unsafe\s*\([^)]*\)\s*\??\.\s*setValue\s*\(/,
);

// ── Handler Pattern ──────────────────────────────────────────────────────────

// 3l. Exported handlers/commands/WebResource entries without an error-handling wrapper
checkPattern(
  `Exported entry without an error-handling wrapper (${HANDLER_WRAPPERS.join('/')})`,
  formFiles,
  new RegExp(`^export\\s+(const|async\\s+function|function)\\s+\\w+(?!.*(?:${HANDLER_WRAPPERS.join('|')}))`),
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

// 3n. Raw field names in FetchXML attribute= (should use Fields Enum interpolation).
// Matches both single- AND double-quote: attribute="parentcustomerid" is the common form in
// Views / addCustomView / setFilterXml, and the old single-quote-only pattern let it through.
// The [a-z] right after the quote is the interpolation exemption - attribute="${Fields.X}" begins
// with $ and is not flagged, while a raw lowercase name is. This is position-precise on purpose:
// a line-wide ${ exclude would hide a raw attribute that shares a line with an interpolated value.
checkPattern(
  'Raw field names in FetchXML (use Fields Enum interpolation)',
  allSrcFiles,
  /attribute\s*=\s*["'][a-z]/,
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

// 3p. Untyped WebApi responses (must use generated Entity interfaces).
// Catches `as Record<string, unknown>` AND the equivalent inline index signature
// `as { [key: string]: unknown }` (F-CONS-03). The latter slipped a typed response
// past this gate before OE-21 let the readers (parseLookup etc.) take an
// entity-cast response directly - since then neither cast is needed.
checkPattern(
  'Untyped WebApi response cast (use generated Entity interface; readers accept it directly)',
  allSrcFiles,
  /as\s+(?:Record\s*<\s*string\s*,\s*unknown\s*>|\{\s*\[\s*\w+\s*:\s*string\s*\]\s*:\s*unknown\s*\})/,
  ['generated/'],
);

// 3p2. Untyped (any) retrieveRecord response (F-CONS-02). retrieveRecord<T = any>
// returns `any` by default; an uncast response is silently any and no other gate
// catches it (no-explicit-any, tsc, Check 3p all pass). Multi-line: the cast is on
// the closing line, so a per-line regex would false-flag every multi-line cast.
checkUntypedRetrieveRecord(
  'Untyped retrieveRecord response (cast to a generated Entity interface; never leave it any)',
  allSrcFiles,
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
