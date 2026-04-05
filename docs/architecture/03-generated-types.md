# Generated Types

Running `xrmforge generate` produces the following TypeScript ES modules:

### 3.1 Entity Interfaces (`entities/{entity}.ts`)

```typescript
// generated/entities/account.ts
/** Account | Konto */
export interface Account {
  /** Account Name | Kontoname */
  name: string | null;
  accountid: string | null;
  revenue: number | null;
  _parentaccountid_value: string | null;  // Lookup GUID
  // ...
}
```

**Type mapping:** String/Memo/EntityName to `string`, Integer/BigInt/Decimal/Double/Money to `number`, Boolean to `boolean`, DateTime/Uniqueidentifier/Lookup to `string`, Picklist/State/Status to `number`.

### 3.2 Entity Fields Enums (`fields/{entity}.ts`)

```typescript
// generated/fields/account.ts
export const enum AccountFields {
  /** Account Name | Kontoname */
  Name = 'name',
  Telephone1 = 'telephone1',
  Revenue = 'revenue',
  // all entity attributes for $select queries
}

export const enum AccountNavigationProperties {
  PrimaryContact = 'primarycontactid',
  ContactCustomerAccounts = 'contact_customer_accounts',
  // all lookup navigation properties
}
```

Used for Web API `$select`: `select(AccountFields.Name, AccountFields.Revenue)`.

### 3.3 Navigation Properties (`fields/{entity}.ts`)

Navigation property enums are co-located with the Fields enums in the same file (see 3.2 above). Example usage:

```typescript
import { AccountNavigationProperties } from '../generated/fields/account';
// used for $expand queries
```

### 3.4 Form Interfaces (`forms/{entity}.ts`)

```typescript
// generated/forms/account.ts

// Union type restricting valid field names
export type AccountMainFormFields = 'name' | 'telephone1' | 'revenue';

// Mapped type: field name to Xrm attribute type
export type AccountMainFormAttributeMap = {
  name: Xrm.Attributes.StringAttribute;
  telephone1: Xrm.Attributes.StringAttribute;
  revenue: Xrm.Attributes.NumberAttribute;
};

// Mapped type: field name to Xrm control type
export type AccountMainFormControlMap = {
  name: Xrm.Controls.StringControl;
  telephone1: Xrm.Controls.StringControl;
  revenue: Xrm.Controls.NumberControl;
};

// Fields enum for autocomplete
export const enum AccountMainFormFieldsEnum {
  /** Account Name | Kontoname */
  AccountName = 'name',
  Telephone1 = 'telephone1',
  Revenue = 'revenue',
}

// Type-safe FormContext with overloaded getAttribute/getControl
export interface AccountMainForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
  getAttribute<K extends AccountMainFormFields>(name: K): AccountMainFormAttributeMap[K];
  getAttribute(index: number): Xrm.Attributes.Attribute;
  getAttribute(): Xrm.Attributes.Attribute[];

  getControl<K extends AccountMainFormFields>(name: K): AccountMainFormControlMap[K];
  getControl(index: number): Xrm.Controls.Control;
  getControl(): Xrm.Controls.Control[];
}
```

**Special controls** are typed based on their FormXml ClassID:
- Subgrid: `Xrm.Controls.GridControl`
- Editable Grid: `Xrm.Controls.GridControl`
- Quick View: `Xrm.Controls.QuickFormControl`
- Web Resource / iFrame: `Xrm.Controls.IframeControl`

### 3.5 Tabs/Sections/Subgrids/QuickViews Enums

```typescript
const enum AccountMainFormTabs { Summary = 'SUMMARY_TAB', Details = 'DETAILS_TAB' }
const enum AccountMainFormSections { General = 'GENERAL', Address = 'ADDRESS' }
const enum AccountMainFormSubgrids { Contacts = 'Contacts_Subgrid' }
const enum AccountMainFormQuickViews { ContactPreview = 'ContactQuickView' }
```

### 3.6 OptionSet Enums (`optionsets/{entity}.ts`)

```typescript
// generated/optionsets/account.ts
/** Account Category Code | Kontokategoriecode */
export const enum AccountCategoryCode {
  /** Preferred Customer | Bevorzugter Kunde */
  PreferredCustomer = 1,
  Standard = 2,
}
```

Includes Picklist, Status, State, and MultiSelectPicklist attributes. Duplicate labels are disambiguated with `_{Value}` suffix.

### 3.7 EntityNames Enum (`entity-names.ts`)

```typescript
// generated/entity-names.ts
export const enum EntityNames {
  Account = 'account',
  Contact = 'contact',
  // all entities in scope
}
```

### 3.8 MockValues Types (in form interfaces)

```typescript
type AccountMainFormMockValues = {
  name?: string | null;
  telephone1?: string | null;
  revenue?: number | null;
};
```

Used with `createFormMock<AccountMainForm, AccountMainFormMockValues>({ name: 'Test' })`.

### 3.9 Action/Function Executors (`actions/{entity|global}.ts`)

```typescript
// generated/actions/global.ts
import { createUnboundAction } from '@xrmforge/helpers';

export interface NormalizePhoneParams { Input: string; AllowSuspicious?: boolean; }
export interface NormalizePhoneResult { Normalized: string; Status: number; }

export const NormalizePhone = createUnboundAction<NormalizePhoneParams, NormalizePhoneResult>(
  'markant_NormalizePhone',
  { Input: { typeName: 'String', structuralProperty: 1 } }
);
// Usage: const result = await NormalizePhone.execute({ Input: '123' });
```

Factory functions: `createBoundAction`, `createUnboundAction`, `createBoundFunction`, `createUnboundFunction`. Batch execution via `executeMultiple()`, progress UI via `withProgress()`.

### 3.10 Dual-Language Labels

All generated JSDoc comments support dual-language labels:
```typescript
/** Account Name | Kontoname */
Name = 'name',
```

German umlauts are transliterated in identifiers: ae, oe, ue, ss (e.g. "Ubergeordnet" becomes `Uebergeordnet`).
