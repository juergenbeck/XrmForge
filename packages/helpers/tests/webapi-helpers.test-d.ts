/**
 * Type-level tests for the Web API response readers (OE-21,
 * ADR-2026-07-19-0200). Checked by `tsc --noEmit -p tsconfig.test-d.json`
 * (wired into the typecheck script), NOT executed by vitest. If this compiles
 * without errors, the reader signatures behave as decided.
 *
 * OE-21: the readers accept a response cast to a generated Entity interface
 * DIRECTLY (no `Record<string, unknown>` cast, no leaving it as `any`), while a
 * whole result collection (a forgotten `[0]`) stays a compile error. The
 * `WebApiRecord` parameter (`object & { length? : never }`) is the mechanism.
 */
import {
  parseLookup,
  parseLookups,
  parseFormattedValue,
  expanded,
  expandedMany,
} from '../src/webapi-helpers.js';

// Simulated typegen Entity interface: NO index signature (like real output).
interface Account {
  name?: string;
  _parentaccountid_value?: string;
}

const account = {} as Account;
const accountArray = [] as Account[];
const anyResp = {} as unknown as { [k: string]: unknown };
const record = {} as Record<string, unknown>;

// OE-21 goal: an entity-cast response goes DIRECTLY into every reader.
parseLookup(account, 'parentaccountid');
parseLookups(account, ['parentaccountid']);
parseFormattedValue(account, 'statecode');
expanded<Account>(account, 'primarycontactid');
expandedMany<Account>(account, 'contact_customer_accounts');

// Backward compatible: Record<string, unknown> still accepted (no regression).
parseLookup(record, 'x');
expanded<Account>(record, 'x');

// Still accepts a broad annotation-key record.
parseFormattedValue(anyResp, 'x');

// Array-Regress guard: passing a whole collection (forgotten `[0]`) is rejected.
// @ts-expect-error - an array is not a single record
parseLookup(accountArray, 'x');
// @ts-expect-error - an array is not a single record
parseLookups(accountArray, ['x']);
// @ts-expect-error - an array is not a single record
expanded<Account>(accountArray, 'x');
// @ts-expect-error - an array is not a single record
expandedMany<Account>(accountArray, 'x');

// A function (also carries `length`) is rejected too.
// @ts-expect-error - a function is not a record
parseLookup(() => undefined, 'x');
