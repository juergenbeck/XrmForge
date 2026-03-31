import { describe, it, expect } from 'vitest';
import {
  mapCustomApiParameterType,
  CustomApiParameterType,
} from '../src/metadata/custom-api-types.js';

describe('mapCustomApiParameterType', () => {
  it('should map Boolean (0) to Edm.Boolean', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Boolean);
    expect(result).toEqual({
      tsType: 'boolean',
      typeName: 'Edm.Boolean',
      structuralProperty: 1,
    });
  });

  it('should map DateTime (1) to Edm.DateTimeOffset', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.DateTime);
    expect(result.tsType).toBe('string');
    expect(result.typeName).toBe('Edm.DateTimeOffset');
    expect(result.structuralProperty).toBe(1);
  });

  it('should map Decimal (2) to Edm.Decimal', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Decimal);
    expect(result.tsType).toBe('number');
    expect(result.typeName).toBe('Edm.Decimal');
  });

  it('should map Entity (3) with entity name', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Entity, 'account');
    expect(result.tsType).toBe('Record<string, unknown>');
    expect(result.typeName).toBe('mscrm.account');
    expect(result.structuralProperty).toBe(5);
  });

  it('should map Entity (3) without entity name to crmbaseentity', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Entity);
    expect(result.typeName).toBe('mscrm.crmbaseentity');
  });

  it('should map EntityCollection (4)', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.EntityCollection);
    expect(result.tsType).toBe('Array<Record<string, unknown>>');
    expect(result.typeName).toBe('Collection(mscrm.crmbaseentity)');
    expect(result.structuralProperty).toBe(4);
  });

  it('should map EntityReference (5) with entity name', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.EntityReference, 'contact');
    expect(result.tsType).toContain('id: string');
    expect(result.typeName).toBe('mscrm.contact');
    expect(result.structuralProperty).toBe(5);
  });

  it('should map Float (6) to Edm.Double', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Float);
    expect(result.tsType).toBe('number');
    expect(result.typeName).toBe('Edm.Double');
  });

  it('should map Integer (7) to Edm.Int32', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Integer);
    expect(result.tsType).toBe('number');
    expect(result.typeName).toBe('Edm.Int32');
  });

  it('should map Money (8) to Edm.Decimal', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Money);
    expect(result.tsType).toBe('number');
    expect(result.typeName).toBe('Edm.Decimal');
  });

  it('should map Picklist (9) to Edm.Int32', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Picklist);
    expect(result.tsType).toBe('number');
    expect(result.typeName).toBe('Edm.Int32');
  });

  it('should map String (10) to Edm.String', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.String);
    expect(result.tsType).toBe('string');
    expect(result.typeName).toBe('Edm.String');
    expect(result.structuralProperty).toBe(1);
  });

  it('should map StringArray (11) to Collection(Edm.String)', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.StringArray);
    expect(result.tsType).toBe('string[]');
    expect(result.typeName).toBe('Collection(Edm.String)');
    expect(result.structuralProperty).toBe(4);
  });

  it('should map Guid (12) to Edm.Guid', () => {
    const result = mapCustomApiParameterType(CustomApiParameterType.Guid);
    expect(result.tsType).toBe('string');
    expect(result.typeName).toBe('Edm.Guid');
  });

  it('should handle unknown type gracefully', () => {
    const result = mapCustomApiParameterType(99 as CustomApiParameterType);
    expect(result.tsType).toBe('unknown');
    expect(result.structuralProperty).toBe(0);
  });
});
