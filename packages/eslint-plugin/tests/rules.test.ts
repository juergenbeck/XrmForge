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

// ─── plugin structure ──────────────────────────────────────────────────────

describe('plugin', () => {
  it('should export all rules', () => {
    expect(plugin.rules['no-xrm-page']).toBeDefined();
    expect(plugin.rules['no-magic-optionset']).toBeDefined();
    expect(plugin.rules['no-sync-webapi']).toBeDefined();
  });

  it('should export recommended config', () => {
    expect(plugin.configs['recommended']).toBeDefined();
  });

  it('should have meta with name and version', () => {
    expect(plugin.meta.name).toBe('@xrmforge/eslint-plugin');
    expect(plugin.meta.version).toBe('0.1.0');
  });
});
