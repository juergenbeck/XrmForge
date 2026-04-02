import { describe, it, expect } from 'vitest';
import { QueryBuilder, query, createQuery } from '../src/query-builder.js';

describe('QueryBuilder', () => {
  it('should build empty query', () => {
    expect(new QueryBuilder().build()).toBe('');
  });

  it('should build $select', () => {
    const q = new QueryBuilder().select('name', 'address1_city');
    expect(q.build()).toBe('?$select=name,address1_city');
  });

  it('should build $filter', () => {
    const q = new QueryBuilder().filter('statecode eq 0');
    expect(q.build()).toBe('?$filter=statecode eq 0');
  });

  it('should combine multiple filters with and', () => {
    const q = new QueryBuilder()
      .filter('statecode eq 0')
      .filter('name ne null');
    expect(q.build()).toBe('?$filter=statecode eq 0 and name ne null');
  });

  it('should build $orderby', () => {
    const q = new QueryBuilder().orderBy('name');
    expect(q.build()).toBe('?$orderby=name asc');
  });

  it('should build $orderby desc', () => {
    const q = new QueryBuilder().orderBy('createdon', 'desc');
    expect(q.build()).toBe('?$orderby=createdon desc');
  });

  it('should build $top', () => {
    const q = new QueryBuilder().top(50);
    expect(q.build()).toBe('?$top=50');
  });

  it('should build $expand', () => {
    const q = new QueryBuilder().expand('primarycontactid');
    expect(q.build()).toBe('?$expand=primarycontactid');
  });

  it('should build $expand with subSelect', () => {
    const q = new QueryBuilder().expand('primarycontactid', ['fullname', 'emailaddress1']);
    expect(q.build()).toBe('?$expand=primarycontactid($select=fullname,emailaddress1)');
  });

  it('should combine all options', () => {
    const q = new QueryBuilder()
      .select('name', 'revenue')
      .filter('statecode eq 0')
      .orderBy('name')
      .top(10)
      .expand('primarycontactid', ['fullname']);

    expect(q.build()).toBe(
      '?$select=name,revenue&$filter=statecode eq 0&$orderby=name asc&$top=10&$expand=primarycontactid($select=fullname)',
    );
  });

  it('should support toString()', () => {
    const q = new QueryBuilder().select('name');
    expect(q.toString()).toBe('?$select=name');
    expect(`${q}`).toBe('?$select=name');
  });

  it('should support chaining', () => {
    const q = new QueryBuilder()
      .select('name')
      .filter('x eq 1')
      .orderBy('name')
      .top(5);
    expect(q).toBeInstanceOf(QueryBuilder);
  });
});

describe('query shorthand', () => {
  it('should create query with select', () => {
    const q = query.select('name', 'city');
    expect(q.build()).toBe('?$select=name,city');
  });

  it('should create query with filter', () => {
    const q = query.filter('statecode eq 0');
    expect(q.build()).toBe('?$filter=statecode eq 0');
  });

  it('should create query with top', () => {
    const q = query.top(100);
    expect(q.build()).toBe('?$top=100');
  });

  it('should chain from shorthand', () => {
    const q = query.select('name').filter('x eq 1').top(10);
    expect(q.build()).toBe('?$select=name&$filter=x eq 1&$top=10');
  });
});

describe('createQuery', () => {
  it('should create empty QueryBuilder', () => {
    const q = createQuery();
    expect(q).toBeInstanceOf(QueryBuilder);
    expect(q.build()).toBe('');
  });
});
