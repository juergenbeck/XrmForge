import { describe, it, expect } from 'vitest';
import { MockEntity } from '../src/mock-entity.js';
import { MockAttribute } from '../src/mock-attribute.js';

describe('MockEntity', () => {
  it('should return entity ID with braces', () => {
    const attrs = new Map<string, MockAttribute>();
    const entity = new MockEntity('account', 'abc-123', attrs);
    expect(entity.getId()).toBe('{abc-123}');
  });

  it('should return entity name', () => {
    const attrs = new Map<string, MockAttribute>();
    const entity = new MockEntity('account', 'abc-123', attrs);
    expect(entity.getEntityName()).toBe('account');
  });

  it('should return entity reference', () => {
    const attrs = new Map<string, MockAttribute>();
    const entity = new MockEntity('account', 'abc-123', attrs);
    const ref = entity.getEntityReference();
    expect(ref.id).toBe('abc-123');
    expect(ref.entityType).toBe('account');
  });

  it('should detect dirty state from attributes', () => {
    const attr = new MockAttribute('name', 'Contoso');
    const attrs = new Map([['name', attr]]);
    const entity = new MockEntity('account', 'abc-123', attrs);

    expect(entity.getIsDirty()).toBe(false);
    attr.setValue('Fabrikam');
    expect(entity.getIsDirty()).toBe(true);
  });

  it('should default to null GUID', () => {
    const attrs = new Map<string, MockAttribute>();
    const entity = new MockEntity('account', '', attrs);
    expect(entity.getId()).toBe('{00000000-0000-0000-0000-000000000000}');
  });

  it('should return empty string for getPrimaryAttributeValue', () => {
    const attrs = new Map<string, MockAttribute>();
    const entity = new MockEntity('account', 'abc', attrs);
    expect(entity.getPrimaryAttributeValue()).toBe('');
  });

  it('should return empty string for getDataXml', () => {
    const attrs = new Map<string, MockAttribute>();
    const entity = new MockEntity('account', 'abc', attrs);
    expect(entity.getDataXml()).toBe('');
  });

  it('should have attributes collection', () => {
    const attrs = new Map<string, MockAttribute>();
    const entity = new MockEntity('account', 'abc', attrs);
    expect(entity.attributes.getLength()).toBe(0);
  });

  it('should have a save method that resolves', async () => {
    const attrs = new Map<string, MockAttribute>();
    const entity = new MockEntity('account', 'abc', attrs);
    await entity.save();
  });

  it('should not be dirty when no attributes changed', () => {
    const attr = new MockAttribute('name', 'Contoso');
    const attrs = new Map([['name', attr]]);
    const entity = new MockEntity('account', 'abc', attrs);
    expect(entity.getIsDirty()).toBe(false);
  });

  it('should register and track onSave handlers', () => {
    const entity = new MockEntity('account', 'abc', new Map());
    const handler = () => {};
    entity.addOnSave(handler);
    expect(entity.getOnSaveHandlers()).toHaveLength(1);
  });

  it('should remove onSave handlers', () => {
    const entity = new MockEntity('account', 'abc', new Map());
    const handler = () => {};
    entity.addOnSave(handler);
    entity.removeOnSave(handler);
    expect(entity.getOnSaveHandlers()).toHaveLength(0);
  });

  it('should fire onSave handlers with the given context', () => {
    const entity = new MockEntity('account', 'abc', new Map());
    let fired = false;
    entity.addOnSave(() => {
      fired = true;
    });
    entity.fireOnSave({} as Xrm.Events.SaveEventContext);
    expect(fired).toBe(true);
  });
});
