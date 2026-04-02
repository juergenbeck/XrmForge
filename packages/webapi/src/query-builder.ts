/**
 * @xrmforge/webapi - Query Builder
 *
 * Fluent builder for OData query strings used with Xrm.WebApi.
 * All methods return the builder for chaining.
 *
 * @example
 * ```typescript
 * import { query } from '@xrmforge/webapi';
 * import AccountFields = XrmForge.Entities.AccountFields;
 *
 * const q = query
 *   .select(AccountFields.AccountName, AccountFields.City)
 *   .filter(`${AccountFields.City} ne null`)
 *   .orderBy(AccountFields.AccountName)
 *   .top(50);
 *
 * // q.build() => "?$select=name,address1_city&$filter=address1_city ne null&$orderby=name asc&$top=50"
 * ```
 */

export class QueryBuilder {
  private _select: string[] = [];
  private _filter: string[] = [];
  private _orderBy: string[] = [];
  private _top: number | null = null;
  private _expand: string[] = [];

  /** Add fields to $select */
  select(...fields: string[]): this {
    this._select.push(...fields);
    return this;
  }

  /** Add a $filter expression (multiple calls are combined with 'and') */
  filter(expression: string): this {
    this._filter.push(expression);
    return this;
  }

  /** Add $orderby (default direction: asc) */
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this._orderBy.push(`${field} ${direction}`);
    return this;
  }

  /** Set $top limit */
  top(count: number): this {
    this._top = count;
    return this;
  }

  /** Add $expand for navigation properties */
  expand(navigationProperty: string, subSelect?: string[]): this {
    if (subSelect && subSelect.length > 0) {
      this._expand.push(`${navigationProperty}($select=${subSelect.join(',')})`);
    } else {
      this._expand.push(navigationProperty);
    }
    return this;
  }

  /** Build the OData query string (starts with ?) */
  build(): string {
    const parts: string[] = [];

    if (this._select.length > 0) {
      parts.push(`$select=${this._select.join(',')}`);
    }
    if (this._filter.length > 0) {
      parts.push(`$filter=${this._filter.join(' and ')}`);
    }
    if (this._orderBy.length > 0) {
      parts.push(`$orderby=${this._orderBy.join(',')}`);
    }
    if (this._top !== null) {
      parts.push(`$top=${this._top}`);
    }
    if (this._expand.length > 0) {
      parts.push(`$expand=${this._expand.join(',')}`);
    }

    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }

  /** Convert to string (same as build()) */
  toString(): string {
    return this.build();
  }
}

/** Create a new QueryBuilder instance */
export function createQuery(): QueryBuilder {
  return new QueryBuilder();
}

/**
 * Shorthand: create a QueryBuilder with initial $select fields.
 *
 * @example
 * ```typescript
 * const q = query.select(Fields.Name, Fields.City).top(10);
 * ```
 */
export const query = {
  /** Start a query with $select fields */
  select(...fields: string[]): QueryBuilder {
    return new QueryBuilder().select(...fields);
  },
  /** Start a query with a $filter expression */
  filter(expression: string): QueryBuilder {
    return new QueryBuilder().filter(expression);
  },
  /** Start a query with $top */
  top(count: number): QueryBuilder {
    return new QueryBuilder().top(count);
  },
  /** Start a query with $expand */
  expand(navigationProperty: string, subSelect?: string[]): QueryBuilder {
    return new QueryBuilder().expand(navigationProperty, subSelect);
  },
};
