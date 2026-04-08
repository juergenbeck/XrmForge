/**
 * @xrmforge/helpers - TypedForm Proxy
 *
 * Creates a proxy around Xrm.FormContext that allows direct property access
 * to form fields. Instead of `form.getAttribute("name").setValue("X")`,
 * write `form.name.setValue("X")`.
 *
 * Works with generated form types from @xrmforge/typegen. The generated
 * forms export Fields, AttributeMap, and ControlMap types that TypedForm uses
 * for full compile-time type safety.
 *
 * @example
 * ```typescript
 * import { typedForm } from '@xrmforge/helpers';
 * import type { AccountLMFirmaForm } from '../../generated/forms/account.js';
 * import { AccountLMFirmaFormFieldsEnum as Fields } from '../../generated/forms/account.js';
 *
 * export const onLoad = wrapHandler('LM.Account.onLoad', logger, (ctx) => {
 *   const form = typedForm<AccountLMFirmaForm>(ctx.getFormContext());
 *
 *   // Direct field access - fully typed
 *   const name = form.name.getValue();         // string | null (StringAttribute)
 *   form.revenue.setValue(150000);              // NumberAttribute
 *   const parent = form.parentaccountid.getValue(); // LookupValue[] | null
 *
 *   // Control access
 *   form.$control('name').setDisabled(true);
 *
 *   // Full FormContext for ui, data, tabs
 *   form.$context.ui.setFormNotification('Loaded', FormNotificationLevel.Info, 'load');
 *
 *   // Fields enum still works for addOnChange, WebApi queries, etc.
 *   form.$context.getAttribute(Fields.Name).addOnChange(() => { ... });
 * });
 * ```
 */

// ─── Type Extraction from Generated Form Interfaces ──────────────────────────

/**
 * Extract the Fields union type from a generated Form interface.
 *
 * Generated interfaces follow the pattern:
 *   getAttribute<K extends SomeFormFields>(name: K): SomeFormAttributeMap[K];
 *   getAttribute(index: number): Xrm.Attributes.Attribute;
 *   getAttribute(): Xrm.Attributes.Attribute[];
 *
 * TypeScript resolves overloaded function types to the LAST matching signature.
 * For our generated interfaces, the generic overload is first, so conditional
 * type inference on the function signature gets the wrong overload.
 *
 * Solution: We use a different extraction strategy. The generated interfaces
 * extend Omit<Xrm.FormContext, 'getAttribute' | 'getControl'>, so we know
 * the first getAttribute overload has the K constraint. We extract it by
 * matching on the mapped return type pattern.
 */
type ExtractFields<TForm> =
  TForm extends { getAttribute<K extends infer F>(name: K): unknown }
    ? F extends string ? F : never
    : never;

/**
 * Extract the AttributeMap from a generated Form interface.
 *
 * Maps each field name to its Xrm.Attributes type by calling getAttribute
 * with each specific field name from the Fields union.
 */
type ExtractAttributeMap<TForm, TFields extends string> = {
  [K in TFields]: TForm extends { getAttribute(name: K): infer R }
    ? R extends Xrm.Attributes.Attribute ? R : Xrm.Attributes.Attribute
    : Xrm.Attributes.Attribute;
};

/**
 * Extract the ControlMap from a generated Form interface.
 */
type ExtractControlMap<TForm, TFields extends string> = {
  [K in TFields]: TForm extends { getControl(name: K): infer R }
    ? R extends Xrm.Controls.Control ? R : Xrm.Controls.Control
    : Xrm.Controls.Control;
};

// ─── TypedForm Type ──────────────────────────────────────────────────────────

/**
 * TypedForm: proxy type that maps field names to their attribute types.
 *
 * Provides direct property access to form fields (e.g. `form.name` returns
 * the StringAttribute), plus `$context` for full FormContext access and
 * `$control(name)` for typed control access.
 */
export type TypedForm<
  TForm,
  TFields extends string = ExtractFields<TForm>,
  TAttrMap extends Record<string, Xrm.Attributes.Attribute> = ExtractAttributeMap<TForm, TFields>,
  TCtrlMap extends Record<string, Xrm.Controls.Control> = ExtractControlMap<TForm, TFields>,
> = {
  /** Direct field access: form.fieldName returns the typed Attribute */
  readonly [K in TFields]: K extends keyof TAttrMap
    ? TAttrMap[K]
    : Xrm.Attributes.Attribute;
} & {
  /** Access the underlying FormContext for ui, data, tabs, etc. */
  readonly $context: TForm extends Xrm.FormContext ? TForm : Xrm.FormContext;
  /** Access a typed control by field name */
  $control<K extends TFields>(name: K): K extends keyof TCtrlMap ? TCtrlMap[K] : Xrm.Controls.Control;
};

/**
 * Create a typed form proxy around a FormContext.
 *
 * The proxy intercepts property access and delegates to getAttribute().
 * Special properties `$context` and `$control` provide access to the full
 * FormContext and controls respectively.
 *
 * Usage with a single type parameter (recommended):
 * ```typescript
 * const form = typedForm<AccountLMFirmaForm>(ctx.getFormContext());
 * form.name.getValue();  // typed as StringAttribute
 * ```
 *
 * @param formContext - The Xrm.FormContext from executionContext.getFormContext()
 * @returns A proxy with direct typed property access to form fields
 */
export function typedForm<TForm>(
  formContext: Xrm.FormContext,
): TypedForm<TForm> {
  return new Proxy(formContext as unknown as TypedForm<TForm>, {
    get(_target, prop) {
      // Symbols and non-string keys: delegate to formContext
      if (typeof prop !== 'string') {
        return (formContext as unknown as Record<symbol, unknown>)[prop];
      }
      if (prop === '$context') return formContext;
      if (prop === '$control') {
        return (name: string) => formContext.getControl(name);
      }
      // Try getAttribute first (form field access)
      const attr = formContext.getAttribute(prop);
      if (attr) return attr;
      // Fallback to FormContext properties (data, ui, etc.)
      return (formContext as unknown as Record<string, unknown>)[prop];
    },

    set(_target, prop, _value) {
      throw new TypeError(
        `Cannot assign to '${String(prop)}'. Use form.${String(prop)}.setValue() instead.`,
      );
    },

    has(_target, prop) {
      if (typeof prop !== 'string') return false;
      if (prop === '$context' || prop === '$control') return true;
      return formContext.getAttribute(prop) !== null;
    },
  });
}

// ─── Legacy Exports (backwards compatible) ───────────────────────────────────

/** @deprecated Use ExtractFields<TForm> instead */
export type FormFields<TForm> = ExtractFields<TForm>;
