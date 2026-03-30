/**
 * @xrmforge/typegen - Xrm API Constants
 *
 * Const enums for all common Xrm string/number constants.
 * Eliminates raw strings in D365 form scripts.
 *
 * @types/xrm defines these as string literal types for compile-time checking,
 * but does NOT provide runtime constants (XrmEnum is not available at runtime).
 * These const enums are erased at compile time (zero runtime overhead).
 *
 * @example
 * ```typescript
 * // Statt Raw-String:
 * if (tab.getDisplayState() === 'expanded') { ... }
 *
 * // Mit XrmForge-Konstante:
 * if (tab.getDisplayState() === XrmConstants.DisplayState.Expanded) { ... }
 * ```
 */

/** Tab/Section display state */
export const enum DisplayState {
  Expanded = 'expanded',
  Collapsed = 'collapsed',
}

// FormType: verwende XrmEnum.FormType aus @types/xrm (dort bereits als const enum definiert)

/** Form notification level (formContext.ui.setFormNotification) */
export const enum FormNotificationLevel {
  Error = 'ERROR',
  Warning = 'WARNING',
  Info = 'INFO',
}

/** Attribute required level (attribute.setRequiredLevel) */
export const enum RequiredLevel {
  None = 'none',
  Required = 'required',
  Recommended = 'recommended',
}

/** Attribute submit mode (attribute.setSubmitMode) */
export const enum SubmitMode {
  Always = 'always',
  Never = 'never',
  Dirty = 'dirty',
}

/** Save mode (eventArgs.getSaveMode()) */
export const enum SaveMode {
  Save = 1,
  SaveAndClose = 2,
  Deactivate = 5,
  Reactivate = 6,
  Send = 7,
  Disqualify = 15,
  Qualify = 16,
  Assign = 47,
  SaveAsCompleted = 58,
  SaveAndNew = 59,
  AutoSave = 70,
}

/** Client type (Xrm.Utility.getGlobalContext().client.getClient()) */
export const enum ClientType {
  Web = 'Web',
  Outlook = 'Outlook',
  Mobile = 'Mobile',
}

/** Client state (Xrm.Utility.getGlobalContext().client.getClientState()) */
export const enum ClientState {
  Online = 'Online',
  Offline = 'Offline',
}
