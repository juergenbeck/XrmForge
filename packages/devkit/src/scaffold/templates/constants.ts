/**
 * Central constants for notifications and messages.
 */

/** Unique IDs for form-level notifications. */
export const NOTIFICATION_IDS = {
  genericError: '{namespace}.notification.generic-error'.toLowerCase(),
} as const;

/** Localized message strings (extend as needed). */
export const MESSAGES = {
  de: {
    unsavedRecord: 'Der Datensatz muss zuerst gespeichert werden.',
  },
  en: {
    unsavedRecord: 'The record must be saved first.',
  },
} as const;

/**
 * Pick the correct language table based on the user's D365 language setting.
 *
 * @param languageId - LCID from Xrm.Utility.getGlobalContext().userSettings.languageId
 * @param table - Object with 'de' and 'en' keys containing the same message keys
 * @returns The matching language table (defaults to English)
 */
export function pickLang<K extends string>(
  languageId: number,
  table: { de: Record<K, string>; en: Record<K, string> },
): Record<K, string> {
  return languageId === 1031 ? table.de : table.en;
}
