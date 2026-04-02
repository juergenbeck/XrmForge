/**
 * @xrmforge/testing - MockAttribute
 *
 * Mock implementation of Xrm.Attributes.Attribute.
 * Tracks value changes, required level, submit mode, and onChange handlers.
 */

type OnChangeHandler = (context: Xrm.Events.EventContext) => void;

export class MockAttribute {
  private _name: string;
  private _value: unknown;
  private _initialValue: unknown;
  private _requiredLevel: Xrm.Attributes.RequirementLevel = 'none';
  private _submitMode: Xrm.SubmitMode = 'dirty';
  private _onChangeHandlers: OnChangeHandler[] = [];

  constructor(name: string, value: unknown = null) {
    this._name = name;
    this._value = value;
    this._initialValue = value;
  }

  getName(): string {
    return this._name;
  }

  getValue(): unknown {
    return this._value;
  }

  setValue(value: unknown): void {
    this._value = value;
  }

  getIsDirty(): boolean {
    return this._value !== this._initialValue;
  }

  getRequiredLevel(): Xrm.Attributes.RequirementLevel {
    return this._requiredLevel;
  }

  setRequiredLevel(level: Xrm.Attributes.RequirementLevel): void {
    this._requiredLevel = level;
  }

  getSubmitMode(): Xrm.SubmitMode {
    return this._submitMode;
  }

  setSubmitMode(mode: Xrm.SubmitMode): void {
    this._submitMode = mode;
  }

  addOnChange(handler: OnChangeHandler): void {
    this._onChangeHandlers.push(handler);
  }

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

  getAttributeType(): string {
    return 'string';
  }

  getFormat(): string | null {
    return null;
  }

  getParent(): Xrm.Entity {
    return {} as Xrm.Entity;
  }

  getUserPrivilege(): Xrm.Privilege {
    return { canRead: true, canUpdate: true, canCreate: true };
  }

  controls: Xrm.Collection.ItemCollection<Xrm.Controls.Control> = {
    forEach: () => {},
    get: (() => null) as unknown as Xrm.Collection.ItemCollection<Xrm.Controls.Control>['get'],
    getLength: () => 0,
  };
}
