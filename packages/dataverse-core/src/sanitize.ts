/**
 * @xrmforge/dataverse-core - OData input sanitizers
 *
 * Guards against OData injection in identifiers, GUIDs, and string literals.
 * Extracted from the typegen HTTP client so the browser and Node layers share a
 * single implementation without pulling Node-only dependencies (e.g.
 * @azure/identity) into browser bundles.
 */

import { DataverseError } from './errors.js';

/** Max characters of a user-provided value echoed in an error (limits log injection). */
const MAX_ERROR_VALUE_LENGTH = 100;

/** Truncate and strip CR/LF from a value before echoing it in an error message. */
function safeEcho(value: string): string {
  return value.substring(0, MAX_ERROR_VALUE_LENGTH).replace(/[\r\n]/g, '');
}

/**
 * Validate that a value is a safe OData identifier (entity set name, attribute
 * name). Allows only a leading letter/underscore followed by letters, digits, or
 * underscores.
 *
 * @param value - The identifier to validate.
 * @returns The unchanged value when valid.
 * @throws {DataverseError} code `INVALID_IDENTIFIER` when the value is malformed.
 */
export function sanitizeIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new DataverseError(
      'INVALID_IDENTIFIER',
      `Invalid OData identifier: "${safeEcho(value)}". ` +
        `Only letters, digits, and underscores are allowed; must start with a letter or underscore.`,
      { value: safeEcho(value) },
    );
  }
  return value;
}

/**
 * Validate that a value is a properly formatted GUID.
 *
 * @param value - The GUID to validate.
 * @returns The unchanged value when valid.
 * @throws {DataverseError} code `INVALID_GUID` when the format is invalid.
 */
export function sanitizeGuid(value: string): string {
  const guidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!guidPattern.test(value)) {
    throw new DataverseError('INVALID_GUID', `Invalid GUID format: "${safeEcho(value)}".`, {
      value: safeEcho(value),
    });
  }
  return value;
}

/**
 * Escape a string for use inside an OData single-quoted string literal by
 * doubling single quotes, preventing a break out of the literal.
 *
 * @param value - The raw string to embed in an OData literal.
 * @returns The escaped string (no surrounding quotes added).
 */
export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}
