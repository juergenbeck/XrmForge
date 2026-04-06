/**
 * @xrmforge/testing - MockAttribute
 *
 * Mock implementation of Xrm.Attributes.Attribute.
 * Tracks value changes, required level, submit mode, and onChange handlers.
 */

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
  private _requiredLevel: Xrm.Attributes.RequirementLevel = 'none';
  private _submitMode: Xrm.SubmitMode = 'dirty';
  private _onChangeHandlers: OnChangeHandler[] = [];

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
    forEach: (callback: (item: Xrm.Controls.Control, index: number) => void) => {
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
