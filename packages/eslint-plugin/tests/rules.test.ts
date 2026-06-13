import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import plugin from '../src/index.js';

function createLinter(): Linter {
  const linter = new Linter({ configType: 'flat' });
  return linter;
}

function lint(code: string, rules: Record<string, string | [string, unknown]>): Linter.LintMessage[] {
  const linter = createLinter();
  return linter.verify(code, [
    {
      plugins: { '@xrmforge': plugin },
      rules,
    },
  ]);
}

// ─── no-xrm-page ──────────────────────────────────────────────────────────

describe('no-xrm-page', () => {
  const rules = { '@xrmforge/no-xrm-page': 'error' as const };

  it('should report Xrm.Page usage', () => {
    const messages = lint('const ctx = Xrm.Page.getAttribute("name");', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noXrmPage');
  });

  it('should report Xrm.Page.data', () => {
    const messages = lint('Xrm.Page.data.refresh();', rules);
    expect(messages).toHaveLength(1);
  });

  it('should not report Xrm.Navigation', () => {
    const messages = lint('Xrm.Navigation.openAlertDialog({text: "hi"});', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not report Xrm.WebApi', () => {
    const messages = lint('Xrm.WebApi.retrieveRecord("account", id);', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not report formContext usage', () => {
    const messages = lint('const name = formContext.getAttribute("name");', rules);
    expect(messages).toHaveLength(0);
  });
});

// ─── no-magic-optionset ────────────────────────────────────────────────────

describe('no-magic-optionset', () => {
  const rules = { '@xrmforge/no-magic-optionset': 'warn' as const };

  it('should warn on getValue() === large number', () => {
    const messages = lint('if (attr.getValue() === 595300000) {}', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noMagicOptionSet');
  });

  it('should warn on getValue() !== number', () => {
    const messages = lint('if (attr.getValue() !== 3) {}', rules);
    expect(messages).toHaveLength(1);
  });

  it('should warn on number === getValue()', () => {
    const messages = lint('if (100 === attr.getValue()) {}', rules);
    expect(messages).toHaveLength(1);
  });

  it('should not warn on getValue() === 0', () => {
    const messages = lint('if (attr.getValue() === 0) {}', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not warn on getValue() === 1', () => {
    const messages = lint('if (attr.getValue() === 1) {}', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not warn on getValue() === null', () => {
    const messages = lint('if (attr.getValue() === null) {}', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not warn on non-getValue comparisons', () => {
    const messages = lint('if (count === 5) {}', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not warn on string comparisons with getValue', () => {
    const messages = lint('if (attr.getValue() === "active") {}', rules);
    expect(messages).toHaveLength(0);
  });
});

// ─── no-sync-webapi ────────────────────────────────────────────────────────

describe('no-sync-webapi', () => {
  const rules = { '@xrmforge/no-sync-webapi': 'error' as const };

  it('should report new XMLHttpRequest()', () => {
    const messages = lint('const xhr = new XMLHttpRequest();', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noSyncXhr');
  });

  it('should report xhr.open with async=false', () => {
    const messages = lint('xhr.open("GET", url, false);', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noSyncOpen');
  });

  it('should not report xhr.open with async=true', () => {
    const messages = lint('xhr.open("GET", url, true);', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not report fetch()', () => {
    const messages = lint('fetch(url).then(r => r.json());', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not report Xrm.WebApi', () => {
    const messages = lint('Xrm.WebApi.retrieveRecord("account", id);', rules);
    expect(messages).toHaveLength(0);
  });
});

// ─── require-error-handling ─────────────────────────────────────────────────

describe('require-error-handling', () => {
  const rules = { '@xrmforge/require-error-handling': 'warn' as const };

  it('should warn on async onLoad without try/catch', () => {
    const messages = lint('export async function onLoad(ctx) { await fetch("/api"); }', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('requireTryCatch');
  });

  it('should warn on async onChange without try/catch', () => {
    const messages = lint('export async function onChange(ctx) { await doSomething(); }', rules);
    expect(messages).toHaveLength(1);
  });

  it('should not warn when try/catch is present', () => {
    const messages = lint('export async function onLoad(ctx) { try { await fetch("/api"); } catch(e) { console.error(e); } }', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not warn on non-async onLoad', () => {
    const messages = lint('export function onLoad(ctx) { doSync(); }', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not warn on async functions not starting with "on"', () => {
    const messages = lint('export async function fetchData() { await fetch("/api"); }', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not warn on non-exported async on* functions', () => {
    const messages = lint('async function onLoad(ctx) { await fetch("/api"); }', rules);
    expect(messages).toHaveLength(0);
  });
});

// ─── require-namespace ─────────────────────────────────────────────────────

describe('require-namespace', () => {
  const rules = { '@xrmforge/require-namespace': 'warn' as const };

  it('should warn on window.onLoad assignment', () => {
    const messages = lint('window.onLoad = function() {};', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noGlobalAssignment');
  });

  it('should warn on globalThis assignment', () => {
    const messages = lint('globalThis.myHandler = () => {};', rules);
    expect(messages).toHaveLength(1);
  });

  it('should warn on self assignment', () => {
    const messages = lint('self.handler = function() {};', rules);
    expect(messages).toHaveLength(1);
  });

  it('should not warn on module exports', () => {
    const messages = lint('export function onLoad() {}', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not warn on regular object assignment', () => {
    const messages = lint('const obj = {}; obj.handler = () => {};', rules);
    expect(messages).toHaveLength(0);
  });
});

// ─── plugin structure ──────────────────────────────────────────────────────

describe('plugin', () => {
  it('should export all rules', () => {
    expect(plugin.rules['no-xrm-page']).toBeDefined();
    expect(plugin.rules['no-magic-optionset']).toBeDefined();
    expect(plugin.rules['no-sync-webapi']).toBeDefined();
    expect(plugin.rules['require-error-handling']).toBeDefined();
    expect(plugin.rules['require-namespace']).toBeDefined();
    expect(plugin.rules['no-typegen-import']).toBeDefined();
    expect(plugin.rules['no-raw-field-strings']).toBeDefined();
    expect(plugin.rules['no-raw-entity-names']).toBeDefined();
    expect(plugin.rules['no-raw-select']).toBeDefined();
  });

  it('should export recommended config', () => {
    expect(plugin.configs['recommended']).toBeDefined();
  });

  it('should include the no-raw rules in recommended as error', () => {
    const recommended = plugin.configs['recommended'] as { rules: Record<string, string> };
    expect(recommended.rules['@xrmforge/no-raw-field-strings']).toBe('error');
    expect(recommended.rules['@xrmforge/no-raw-entity-names']).toBe('error');
    expect(recommended.rules['@xrmforge/no-raw-select']).toBe('error');
  });

  it('should have meta with name and version', () => {
    expect(plugin.meta.name).toBe('@xrmforge/eslint-plugin');
    expect(plugin.meta.version).toBe('0.3.0');
  });
});

// ─── no-raw-field-strings ───────────────────────────────────────────────────

describe('no-raw-field-strings', () => {
  const rules = { '@xrmforge/no-raw-field-strings': 'error' as const };

  it('should report raw string in getAttribute()', () => {
    const messages = lint('form.getAttribute("name");', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noRawField');
  });

  it('should report raw string in getControl()', () => {
    const messages = lint('formContext.getControl("revenue");', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noRawField');
  });

  it('should not report Fields enum in getAttribute()', () => {
    const messages = lint('form.getAttribute(Fields.Name);', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not report a variable in getControl()', () => {
    const messages = lint('form.getControl(fieldName);', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not report getAttribute() with no argument (collection overload)', () => {
    const messages = lint('const all = form.getAttribute();', rules);
    expect(messages).toHaveLength(0);
  });
});

// ─── no-raw-entity-names ────────────────────────────────────────────────────

describe('no-raw-entity-names', () => {
  const rules = { '@xrmforge/no-raw-entity-names': 'error' as const };

  it('should report raw entity name in retrieveRecord()', () => {
    const messages = lint('Xrm.WebApi.retrieveRecord("account", id);', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noRawEntity');
  });

  it('should report raw entity name in retrieveMultipleRecords()', () => {
    const messages = lint('Xrm.WebApi.retrieveMultipleRecords("contact", query);', rules);
    expect(messages).toHaveLength(1);
  });

  it('should report raw entity name in openForm({ entityName })', () => {
    const messages = lint('Xrm.Navigation.openForm({ entityName: "account", entityId: id });', rules);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.messageId).toBe('noRawEntity');
  });

  it('should not report EntityNames enum in retrieveRecord()', () => {
    const messages = lint('Xrm.WebApi.retrieveRecord(EntityNames.Account, id);', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not report EntityNames enum in openForm()', () => {
    const messages = lint('Xrm.Navigation.openForm({ entityName: EntityNames.Account });', rules);
    expect(messages).toHaveLength(0);
  });
});

// ─── no-raw-select ──────────────────────────────────────────────────────────

describe('no-raw-select', () => {
  const rules = { '@xrmforge/no-raw-select': 'error' as const };

  it('should report raw strings in variadic select()', () => {
    const messages = lint('select("name", "revenue");', rules);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.messageId).toBe('noRawSelect');
  });

  it('should report raw strings in array select()', () => {
    const messages = lint('select(["name", "revenue"]);', rules);
    expect(messages).toHaveLength(2);
  });

  it('should report raw field array in selectExpand()', () => {
    const messages = lint('selectExpand(["name"], "primarycontactid($select=fullname)");', rules);
    expect(messages).toHaveLength(1);
  });

  it('should not report Fields enum in select()', () => {
    const messages = lint('select(AccountFields.Name, AccountFields.Revenue);', rules);
    expect(messages).toHaveLength(0);
  });

  it('should not report the expand clause (second selectExpand arg)', () => {
    const messages = lint('selectExpand([AccountFields.Name], "primarycontactid($select=fullname)");', rules);
    expect(messages).toHaveLength(0);
  });
});

// ─── no-typegen-import ───────────────────────────────────────────────────────

describe('no-typegen-import', () => {
  it('should report import from @xrmforge/typegen', () => {
    const result = lint(`import { select } from '@xrmforge/typegen';`, {
      '@xrmforge/no-typegen-import': 'error',
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toContain('Do not import from @xrmforge/typegen');
  });

  it('should report import from @xrmforge/typegen/helpers subpath', () => {
    const result = lint(`import { select } from '@xrmforge/typegen/helpers';`, {
      '@xrmforge/no-typegen-import': 'error',
    });
    expect(result).toHaveLength(1);
  });

  it('should not report import from @xrmforge/helpers', () => {
    const result = lint(`import { select } from '@xrmforge/helpers';`, {
      '@xrmforge/no-typegen-import': 'error',
    });
    expect(result).toHaveLength(0);
  });

  it('should not report import from @xrmforge/testing', () => {
    const result = lint(`import { createFormMock } from '@xrmforge/testing';`, {
      '@xrmforge/no-typegen-import': 'error',
    });
    expect(result).toHaveLength(0);
  });

  it('should have rule metadata', () => {
    const rule = plugin.rules['no-typegen-import']!;
    expect(rule.meta?.type).toBe('problem');
    expect(rule.meta?.messages).toHaveProperty('noTypegenImport');
  });
});
