/**
 * @xrmforge/typegen - String literal escaping for generated code
 *
 * Dataverse form structure names (tab/section names) and control ids come from
 * the FormXML and are NOT restricted to schema-identifier characters. They can
 * contain apostrophes (a real form had a section literally named
 * `note's information`). Emitting such a value directly inside a single-quoted
 * TypeScript string literal produces an unterminated literal and therefore
 * invalid TypeScript.
 *
 * Schema identifiers (entity/attribute logical names, navigation property
 * names, custom-api unique names) are constrained to `[a-z0-9_]` and cannot
 * contain these characters, so only the FormXML-derived emitters need this.
 */

/**
 * Wrap a raw string in a single-quoted TypeScript string literal, escaping the
 * characters that would otherwise break the literal: backslash, single quote,
 * and the CR/LF line terminators. The surrounding quotes are part of the
 * returned value.
 *
 * Idempotent for values without these characters: `singleQuoted('account')`
 * returns `'account'` byte-for-byte, so existing output is unchanged.
 *
 * @example
 * singleQuoted("note's information") // "'note\\'s information'"
 * singleQuoted('account')            // "'account'"
 */
export function singleQuoted(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `'${escaped}'`;
}
