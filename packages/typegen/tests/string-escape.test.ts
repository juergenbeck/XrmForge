import { describe, it, expect } from 'vitest';
import { singleQuoted } from '../src/generators/string-escape.js';

describe('singleQuoted', () => {
  it('wraps a plain value in single quotes unchanged (idempotent for identifiers)', () => {
    expect(singleQuoted('account')).toBe("'account'");
    expect(singleQuoted('_invoiceid_value')).toBe("'_invoiceid_value'");
  });

  it('escapes a single quote (the K32-02 apostrophe case)', () => {
    expect(singleQuoted("note's information")).toBe("'note\\'s information'");
  });

  it('escapes a backslash before quotes', () => {
    expect(singleQuoted('a\\b')).toBe("'a\\\\b'");
    // A trailing backslash must not escape the closing quote.
    expect(singleQuoted('end\\')).toBe("'end\\\\'");
  });

  it('escapes CR and LF line terminators', () => {
    expect(singleQuoted('a\nb')).toBe("'a\\nb'");
    expect(singleQuoted('a\rb')).toBe("'a\\rb'");
  });

  it('produces a literal that evals back to the original value', () => {
    for (const input of ['account', "note's information", 'a\\b', "x'y\\z", 'plain text']) {
      // eslint-disable-next-line no-eval
      expect(eval(singleQuoted(input))).toBe(input);
    }
  });
});
