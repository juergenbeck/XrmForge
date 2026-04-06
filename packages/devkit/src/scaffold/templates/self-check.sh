#!/usr/bin/env bash
# XrmForge Self-Check - Pattern Compliance Verification
# Run this before tests to catch common violations.
# Exit code: 0 = all clean, 1 = violations found

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

violations=0
category_count=0

check() {
  local label="$1"
  shift
  local count
  count=$("$@" 2>/dev/null | wc -l | tr -d ' ')
  category_count=$((category_count + 1))
  if [ "$count" -gt 0 ]; then
    echo -e "${RED}FAIL${NC} [$count] $label"
    "$@" 2>/dev/null | head -20
    violations=$((violations + count))
  else
    echo -e "${GREEN}OK${NC}   [0] $label"
  fi
}

echo "=== XrmForge Self-Check ==="
echo ""
echo "--- Pattern Compliance ---"

check "Raw field strings in getAttribute/getControl (must use Fields Enum)" \
  bash -c 'grep -rn "getAttribute('" '"'"'" src/forms/ --include="*.ts" | grep -v "Fields\." ; grep -rn "getControl('" '"'"'" src/forms/ --include="*.ts" | grep -v "Fields\."'

check "Magic numbers in OptionSet comparisons (must use OptionSet Enum)" \
  bash -c 'grep -rn "getValue() ===" src/ --include="*.ts" | grep -E "[0-9]{3,}"'

check "Direct _value access instead of parseLookup (Web API responses)" \
  bash -c 'grep -rn "_value\b" src/ --include="*.ts" | grep -v "generated/" | grep -v "parseLookup" | grep -v "getValue"'

check "Raw entity names in WebApi calls (must use EntityNames)" \
  bash -c 'grep -rn "retrieveRecord\|retrieveMultipleRecords\|deleteRecord\|createRecord\|updateRecord" src/ --include="*.ts" | grep "'"'"'[a-z]" | grep -v "EntityNames"'

check "Raw \$select strings (must use select() from @xrmforge/helpers)" \
  bash -c 'grep -rn '"'"'\$select'"'"' src/ --include="*.ts" | grep -v "select(" | grep -v "generated/"'

check "Missing FormContext cast in onLoad (must have 'as <Generated>Form')" \
  bash -c 'grep -rn "getFormContext()" src/forms/ --include="*.ts" | grep -v " as "'

check "Exported handlers without wrapHandler" \
  bash -c 'grep -rn "^export const\|^export async function\|^export function" src/forms/ --include="*.ts" | grep -v "wrapHandler"'

echo ""
echo "--- Code Quality ---"

check "console.* outside logger.ts" \
  bash -c 'grep -rn "console\." src/ --include="*.ts" | grep -v "logger.ts"'

check "Xrm.Page (deprecated since D365 v9.0)" \
  bash -c 'grep -rn "Xrm\.Page" src/ --include="*.ts"'

check "var declarations" \
  bash -c 'grep -rnE "^\s*var " src/ --include="*.ts"'

check "eval()" \
  bash -c 'grep -rn "\beval(" src/ --include="*.ts"'

check "XMLHttpRequest" \
  bash -c 'grep -rn "XMLHttpRequest" src/ --include="*.ts"'

check "as any without eslint-disable comment" \
  bash -c 'grep -rn "as any" src/ --include="*.ts" | grep -v "eslint-disable"'

check "Import from @xrmforge/typegen in browser code (use @xrmforge/helpers)" \
  bash -c 'grep -rn "from.*@xrmforge/typegen" src/ --include="*.ts" | grep -v "generated/"'

echo ""
echo "--- Test Completeness ---"

missing_tests=0
for f in src/forms/*.ts; do
  [ -f "$f" ] || continue
  base=$(basename "$f" .ts)
  if [ ! -f "tests/forms/${base}.test.ts" ]; then
    echo -e "${YELLOW}WARN${NC} No test file: $f"
    missing_tests=$((missing_tests + 1))
  fi
done
if [ "$missing_tests" -eq 0 ]; then
  echo -e "${GREEN}OK${NC}   All form scripts have test files"
else
  echo -e "${YELLOW}WARN${NC} $missing_tests form scripts without tests"
fi

echo ""
echo "=== Results ==="
if [ "$violations" -eq 0 ]; then
  echo -e "${GREEN}All $category_count checks passed. 0 violations.${NC}"
  exit 0
else
  echo -e "${RED}$violations violations found across $category_count checks.${NC}"
  exit 1
fi
