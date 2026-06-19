/**
 * @xrmforge/testing - MockAttribute
 *
 * Mock implementation of Xrm.Attributes.Attribute.
 * Tracks value changes, required level, submit mode, and onChange handlers.
 */

/**
 * Default values matching @xrmforge/helpers const enums.
 * Cannot import const enums across module boundaries with isolatedModules,
 * so we mirror the values here with semantic names.
 */
const DEFAULT_REQUIRED_LEVEL: Xrm.Attributes.RequirementLevel = 'none'; // RequiredLevel.None
const DEFAULT_SUBMIT_MODE: Xrm.SubmitMode = 'dirty'; // SubmitMode.Dirty

type OnChangeHandler = (context: Xrm.Events.EventContext) => void;

/**
 * Mock implementation of {@link Xrm.Attributes.Attribute} for unit testing D365 form scripts.
 *
 * Tracks value changes, required level, submit mode, and onChange handlers.
 * Instances are created automatically by {@link createFormMock}.
 *
 * @example
 * ```typescript
 * const mock = createFormMock<AccountMainForm>({ name: 'Contoso' });
 * const attr = mock.getAttribute('name');
 * attr.setValue('NewName');
 * expect(attr.getIsDirty()).toBe(true);
 * ```
 */
export class MockAttribute {
  private _name: string;
  private _value: unknown;
  private _initialValue: unknown;
  private _requiredLevel: Xrm.Attributes.RequirementLevel = DEFAULT_REQUIRED_LEVEL;
  private _submitMode: Xrm.SubmitMode = DEFAULT_SUBMIT_MODE;
  private _onChangeHandlers: OnChangeHandler[] = [];
  private _text = '';
  private _precision = 0;
  private _options: Array<{ text: string; value: number }> = [];

  /**
   * @param name - Logical name of the attribute (e.g. 'name', 'revenue')
   * @param value - Initial value (defaults to null)
   */
  constructor(name: string, value: unknown = null) {
    this._name = name;
    this._value = value;
    this._initialValue = value;
  }

  /** Returns the logical name of the attribute. */
  getName(): string {
    return this._name;
  }

  /** Returns the current value of the attribute. */
  getValue(): unknown {
    return this._value;
  }

  /**
   * Sets the attribute value.
   *
   * @param value - The new value to assign
   */
  setValue(value: unknown): void {
    this._value = value;
  }

  /** Returns true if the current value differs from the initial value. */
  getIsDirty(): boolean {
    return this._value !== this._initialValue;
  }

  /** Returns the current required level ('none', 'required', or 'recommended'). */
  getRequiredLevel(): Xrm.Attributes.RequirementLevel {
    return this._requiredLevel;
  }

  /**
   * Sets the required level for the attribute.
   *
   * @param level - The required level to set
   */
  setRequiredLevel(level: Xrm.Attributes.RequirementLevel): void {
    this._requiredLevel = level;
  }

  /** Returns the current submit mode ('always', 'never', or 'dirty'). */
  getSubmitMode(): Xrm.SubmitMode {
    return this._submitMode;
  }

  /**
   * Sets the submit mode for the attribute.
   *
   * @param mode - The submit mode to set
   */
  setSubmitMode(mode: Xrm.SubmitMode): void {
    this._submitMode = mode;
  }

  /**
   * Registers an onChange handler for this attribute.
   *
   * @param handler - The handler function to call when the attribute value changes
   */
  addOnChange(handler: OnChangeHandler): void {
    this._onChangeHandlers.push(handler);
  }

  /**
   * Removes a previously registered onChange handler.
   *
   * @param handler - The handler function to remove
   */
  removeOnChange(handler: OnChangeHandler): void {
    const index = this._onChangeHandlers.indexOf(handler);
    if (index >= 0) {
      this._onChangeHandlers.splice(index, 1);
    }
  }

  /** @internal Get registered onChange handlers (for testing/event simulation) */
  getOnChangeHandlers(): readonly OnChangeHandler[] {
    return this._onChangeHandlers;
  }

  /**
   * Fire all registered onChange handlers with the given event context.
   * @internal Called by FormMock.fireOnChange(fieldName)
   */
  fireOnChange(eventContext: Xrm.Events.EventContext): void {
    for (const handler of this._onChangeHandlers) {
      handler(eventContext);
    }
  }

  /** Returns the attribute type string (always 'string' in this mock). */
  getAttributeType(): string {
    return 'string';
  }

  /** Returns the format string (always null in this mock). */
  getFormat(): string | null {
    return null;
  }

  /**
   * Returns the text label of the currently selected value
   * (`OptionSetAttribute.getText()`). Defaults to `''`; seed it with
   * {@link setText} for tests that build strings from an option label.
   */
  getText(): string {
    return this._text;
  }

  /**
   * Seeds the value returned by {@link getText} (test helper; the real Xrm
   * API has no setter - getText() reflects the selected option's label).
   *
   * @param text - The label getText() should return
   */
  setText(text: string): void {
    this._text = text;
  }

  /**
   * Returns the number of allowed decimal places
   * (`NumberAttribute.getPrecision()`). Defaults to `0`; seed it with
   * {@link setPrecision} for decimal/money fields.
   */
  getPrecision(): number {
    return this._precision;
  }

  /**
   * Seeds the value returned by {@link getPrecision} (test helper; the real
   * Xrm API derives precision from metadata).
   *
   * @param precision - The precision getPrecision() should return
   */
  setPrecision(precision: number): void {
    this._precision = precision;
  }

  /**
   * Returns the OptionSet options (`OptionSetAttribute.getOptions()`). Defaults to
   * `[]`; seed them with {@link setOptions} for tests that read the option list.
   */
  getOptions(): Array<{ text: string; value: number }> {
    return this._options;
  }

  /**
   * Seeds the value returned by {@link getOptions} (test helper; the real Xrm API
   * derives options from metadata).
   *
   * @param options - The options getOptions() should return
   */
  setOptions(options: Array<{ text: string; value: number }>): void {
    this._options = options;
  }

  /** Returns a stub parent entity reference. */
  getParent(): Xrm.Entity {
    return {} as Xrm.Entity;
  }

  /** Returns full read/update/create privileges. */
  getUserPrivilege(): Xrm.Privilege {
    return { canRead: true, canUpdate: true, canCreate: true };
  }

  /** @internal Mutable backing array for the controls collection. */
  private _controls: Xrm.Controls.Control[] = [];

  /**
   * Controls collection that mirrors the real Xrm.Collection.ItemCollection behavior.
   * Supports forEach, get() (all items), get(index), get(name), and getLength().
   */
  controls: Xrm.Collection.ItemCollection<Xrm.Controls.Control> = {
    forEach: (callback: (item: Xrm.Controls.Control, index?: number) => void) => {
      this._controls.forEach(callback);
    },
    get: ((nameOrIndexOrChooser?: string | number | ((item: Xrm.Controls.Control, index: number) => boolean)) => {
      if (nameOrIndexOrChooser === undefined) {
        return [...this._controls];
      }
      if (typeof nameOrIndexOrChooser === 'function') {
        return this._controls.filter(nameOrIndexOrChooser);
      }
      if (typeof nameOrIndexOrChooser === 'number') {
        return this._controls[nameOrIndexOrChooser] ?? null;
      }
      return this._controls.find((c) => (c as { getName(): string }).getName() === nameOrIndexOrChooser) ?? null;
    }) as Xrm.Collection.ItemCollection<Xrm.Controls.Control>['get'],
    getLength: () => this._controls.length,
  };

  /**
   * @internal Add a control to this attribute's controls collection.
   * Called by createFormMock to link controls to their attributes.
   */
  addControl(control: Xrm.Controls.Control): void {
    this._controls.push(control);
  }
}
