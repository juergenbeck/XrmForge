/**
 * @xrmforge/testing - MockEntity
 *
 * Mock implementation of Xrm.Entity.
 */

import type { MockAttribute } from './mock-attribute.js';

const NULL_GUID = '00000000-0000-0000-0000-000000000000';

export class MockEntity {
  private _id: string;
  private _entityName: string;
  private _attributes: Map<string, MockAttribute>;

  constructor(
    entityName: string,
    entityId: string,
    attributes: Map<string, MockAttribute>,
  ) {
    this._entityName = entityName;
    this._id = entityId || NULL_GUID;
    this._attributes = attributes;
  }

  getId(): string {
    return `{${this._id}}`;
  }

  getEntityName(): string {
    return this._entityName;
  }

  getEntityReference(): Xrm.LookupValue {
    return {
      id: this._id,
      entityType: this._entityName,
      name: '',
    };
  }

  getIsDirty(): boolean {
    for (const attr of this._attributes.values()) {
      if (attr.getIsDirty()) return true;
    }
    return false;
  }

  getPrimaryAttributeValue(): string {
    return '';
  }

  getDataXml(): string {
    return '';
  }

  attributes: Xrm.Collection.ItemCollection<Xrm.Attributes.Attribute> = {
    forEach: () => {},
    get: (() => null) as unknown as Xrm.Collection.ItemCollection<Xrm.Attributes.Attribute>['get'],
    getLength: () => 0,
  };

  save(): Xrm.Async.PromiseLike<void> {
    return { then: (cb: () => void) => cb() } as Xrm.Async.PromiseLike<void>;
  }
}
