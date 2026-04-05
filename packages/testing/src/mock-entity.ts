/**
 * @xrmforge/testing - MockEntity
 *
 * Mock implementation of Xrm.Entity.
 */

import type { MockAttribute } from './mock-attribute.js';

const NULL_GUID = '00000000-0000-0000-0000-000000000000';

/**
 * Mock implementation of {@link Xrm.Entity} for unit testing.
 *
 * Provides entity metadata (ID, logical name) and dirty-state tracking
 * based on the underlying mock attributes.
 */
export class MockEntity {
  private _id: string;
  private _entityName: string;
  private _attributes: Map<string, MockAttribute>;

  /**
   * @param entityName - Logical name of the entity (e.g. 'account')
   * @param entityId - GUID of the entity record
   * @param attributes - Map of mock attributes belonging to this entity
   */
  constructor(
    entityName: string,
    entityId: string,
    attributes: Map<string, MockAttribute>,
  ) {
    this._entityName = entityName;
    this._id = entityId || NULL_GUID;
    this._attributes = attributes;
  }

  /** Returns the entity record ID wrapped in braces (e.g. '{guid}'). */
  getId(): string {
    return `{${this._id}}`;
  }

  /** Returns the logical name of the entity (e.g. 'account'). */
  getEntityName(): string {
    return this._entityName;
  }

  /** Returns an entity reference with id, entityType, and name. */
  getEntityReference(): Xrm.LookupValue {
    return {
      id: this._id,
      entityType: this._entityName,
      name: '',
    };
  }

  /** Returns true if any attribute in the entity has been modified. */
  getIsDirty(): boolean {
    for (const attr of this._attributes.values()) {
      if (attr.getIsDirty()) return true;
    }
    return false;
  }

  /** Returns the primary attribute value (empty string in this mock). */
  getPrimaryAttributeValue(): string {
    return '';
  }

  /** Returns the data XML representation (empty string in this mock). */
  getDataXml(): string {
    return '';
  }

  /** Stub attributes collection (empty). */
  attributes: Xrm.Collection.ItemCollection<Xrm.Attributes.Attribute> = {
    forEach: () => {},
    get: (() => null) as unknown as Xrm.Collection.ItemCollection<Xrm.Attributes.Attribute>['get'],
    getLength: () => 0,
  };

  /** Simulates a save operation that resolves immediately. */
  save(): Xrm.Async.PromiseLike<void> {
    return { then: (cb: () => void) => cb() } as Xrm.Async.PromiseLike<void>;
  }
}
