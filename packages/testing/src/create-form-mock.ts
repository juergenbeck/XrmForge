/**
 * @xrmforge/testing - createFormMock
 *
 * Creates a type-safe mock FormContext from a simple values object.
 * The generated form interfaces provide compile-time field validation.
 *
 * @example
 * ```typescript
 * import { createFormMock } from '@xrmforge/testing';
 *
 * const mock = createFormMock<AccountMainForm>({
 *   name: 'Contoso',
 *   revenue: 150000,
 * });
 *
 * myOnLoad(mock.asEventContext());
 * expect(mock.getValue('name')).toBe('Contoso');
 * ```
 */

import type { CreateFormMockOptions, FormMock } from './types.js';
import { MockAttribute } from './mock-attribute.js';
import { MockControl } from './mock-control.js';
import { MockEntity } from './mock-entity.js';
import { MockUi } from './mock-ui.js';
import { MockEventContext } from './mock-event-context.js';

/**
 * Create a type-safe mock FormContext for testing D365 form scripts.
 *
 * @typeParam TForm - Generated form interface (e.g. AccountMainForm)
 * @param values - Field values as a plain object (field name to value)
 * @param options - Optional entity ID and name
 * @returns FormMock with typed formContext and test accessors
 */
export function createFormMock<TForm>(
  values: Record<string, unknown> = {},
  options: CreateFormMockOptions = {},
): FormMock<TForm> {
  const entityName = options.entityName ?? 'unknown';
  const entityId = options.entityId ?? '00000000-0000-0000-0000-000000000000';

  // Build attribute and control maps from values
  const attributes = new Map<string, MockAttribute>();
  const controls = new Map<string, MockControl>();

  for (const [name, value] of Object.entries(values)) {
    attributes.set(name, new MockAttribute(name, value));
    controls.set(name, new MockControl(name));
  }

  // Lazy-init: fields accessed but not in initial values get null
  const getOrCreateAttribute = (name: string): MockAttribute => {
    let attr = attributes.get(name);
    if (!attr) {
      attr = new MockAttribute(name, null);
      attributes.set(name, attr);
    }
    return attr;
  };

  const getOrCreateControl = (name: string): MockControl => {
    let ctrl = controls.get(name);
    if (!ctrl) {
      ctrl = new MockControl(name);
      controls.set(name, ctrl);
    }
    return ctrl;
  };

  const mockEntity = new MockEntity(entityName, entityId, attributes);
  const mockUi = new MockUi();

  // Build the formContext object that satisfies the TForm interface
  const formContext = {
    getAttribute: ((nameOrIndex?: string | number) => {
      if (typeof nameOrIndex === 'string') {
        return getOrCreateAttribute(nameOrIndex);
      }
      if (typeof nameOrIndex === 'number') {
        return [...attributes.values()][nameOrIndex] ?? null;
      }
      return [...attributes.values()];
    }) as Xrm.FormContext['getAttribute'],

    getControl: ((nameOrIndex?: string | number) => {
      if (typeof nameOrIndex === 'string') {
        return getOrCreateControl(nameOrIndex);
      }
      if (typeof nameOrIndex === 'number') {
        return [...controls.values()][nameOrIndex] ?? null;
      }
      return [...controls.values()];
    }) as Xrm.FormContext['getControl'],

    data: {
      entity: mockEntity as unknown as Xrm.Entity,
      process: {} as Xrm.ProcessFlow.ProcessManager,
      refresh: () =>
        ({ then: (cb: () => void) => cb() }) as Xrm.Async.PromiseLike<void>,
      save: () =>
        ({ then: (cb: () => void) => cb() }) as Xrm.Async.PromiseLike<void>,
      getIsDirty: () => mockEntity.getIsDirty(),
      isValid: () => true,
      attributes: {
        forEach: () => {},
        get: (() => null) as any,
        getLength: () => attributes.size,
      },
    },

    ui: mockUi as unknown as Xrm.Ui,
  } as unknown as TForm;

  return {
    formContext,

    getValue(name: string): unknown {
      return getOrCreateAttribute(name).getValue();
    },

    setValue(name: string, value: unknown): void {
      getOrCreateAttribute(name).setValue(value);
    },

    getAttribute(name: string): MockAttribute {
      return getOrCreateAttribute(name);
    },

    getControl(name: string): MockControl {
      return getOrCreateControl(name);
    },

    ui: mockUi,

    asEventContext(): Xrm.Events.EventContext {
      return new MockEventContext(
        formContext as unknown as Xrm.FormContext,
      ) as unknown as Xrm.Events.EventContext;
    },

    asAttributeEventContext(fieldName: string): Xrm.Events.EventContext {
      return new MockEventContext(
        formContext as unknown as Xrm.FormContext,
        getOrCreateAttribute(fieldName),
      ) as unknown as Xrm.Events.EventContext;
    },
  };
}
