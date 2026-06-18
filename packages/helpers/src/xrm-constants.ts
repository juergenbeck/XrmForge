/**
 * @xrmforge/helpers - Xrm API Constants
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
 * import { DisplayState } from '@xrmforge/helpers';
 *
 * if (tab.getDisplayState() === DisplayState.Expanded) { ... }
 * ```
 */

/** Tab/Section display state */
export const enum DisplayState {
  Expanded = 'expanded',
  Collapsed = 'collapsed',
}

/**
 * Form type (formContext.ui.getFormType()).
 *
 * WARNING: XrmEnum.FormType from @types/xrm is a const enum that does NOT exist
 * at runtime. esbuild does not resolve const enums from .d.ts files. Using
 * XrmEnum.FormType.Create in code produces "XrmEnum is not defined" at runtime.
 * Use this FormType enum instead (same values, zero runtime overhead).
 */
export const enum FormType {
  Undefined = 0,
  Create = 1,
  Update = 2,
  ReadOnly = 3,
  Disabled = 4,
  BulkEdit = 6,
}

/**
 * True when the form is currently shown in the given {@link FormType}.
 *
 * `formContext.ui.getFormType()` is typed as `XrmEnum.FormType` (from
 * @types/xrm), which is a nominally distinct type from the {@link FormType}
 * const enum above. A direct `getFormType() === FormType.Create` therefore
 * fails to compile under `strict` with TS2367 ("This comparison appears to be
 * unintentional because the types have no overlap"). Relational operators
 * (`>`/`<`) slip past TS2367 but cannot express an exact match. This helper
 * bridges both numeric enums for the equality case without a hand-written cast.
 *
 * @example
 * if (isFormType(form.$context, FormType.Create)) {
 *   // only on create
 * }
 */
export function isFormType(formContext: Xrm.FormContext, formType: FormType): boolean {
  return (formContext.ui.getFormType() as number) === (formType as number);
}

/** Form notification level (formContext.ui.setFormNotification) */
export const enum FormNotificationLevel {
  Error = 'ERROR',
  Warning = 'WARNING',
  Info = 'INFO',
}

/**
 * App-level (global) notification level for Xrm.App.addGlobalNotification.
 *
 * Mirrors XrmEnum.AppNotificationLevel, which (like all XrmEnum const enums) does
 * NOT exist at runtime. Use this enum; {@link addAppNotification} applies the cast
 * to the @types/xrm typings at a single boundary.
 */
export const enum AppNotificationLevel {
  Success = 1,
  Error = 2,
  Warning = 3,
  Information = 4,
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

// WebApi Execute Constants

/** Operation type for Xrm.WebApi.execute getMetadata().operationType */
export const enum OperationType {
  /** Custom Action or OOB Action (POST) */
  Action = 0,
  /** Custom Function or OOB Function (GET) */
  Function = 1,
  /** CRUD operation (Create, Retrieve, Update, Delete) */
  CRUD = 2,
}

/** Structural property for getMetadata().parameterTypes[].structuralProperty */
export const enum StructuralProperty {
  Unknown = 0,
  PrimitiveType = 1,
  ComplexType = 2,
  EnumerationType = 3,
  Collection = 4,
  EntityType = 5,
}

/** Binding type for Custom API definitions */
export const enum BindingType {
  /** Not bound to an entity (globally callable) */
  Global = 0,
  /** Bound to a single entity record */
  Entity = 1,
  /** Bound to an entity collection */
  EntityCollection = 2,
}
