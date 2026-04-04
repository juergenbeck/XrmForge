# Generated Types

Running `xrmforge generate` produces the following TypeScript declarations:

### 3.1 Entity Interfaces (`entities/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Entities {
  /** Account | Konto */
  interface Account {
    /** Account Name | Kontoname */
    name: string | null;
    accountid: string | null;
    revenue: number | null;
    _parentaccountid_value: string | null;  // Lookup GUID
    // ...
  }
}
```

**Type mapping:** String/Memo/EntityName to `string`, Integer/BigInt/Decimal/Double/Money to `number`, Boolean to `boolean`, DateTime/Uniqueidentifier/Lookup to `string`, Picklist/State/Status to `number`.

### 3.2 Entity Fields Enums (`entities/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Entities {
  const enum AccountFields {
    /** Account Name | Kontoname */
    Name = 'name',
    Revenue = 'revenue',
    // all readable attributes
  }
}
```

Used for Web API `$select`: `select(AccountFields.Name, AccountFields.Revenue)`.

### 3.3 Navigation Properties (`entities/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Entities {
  const enum AccountNavigation {
    PrimaryContactId = 'primarycontactid',
    ContactCustomerAccounts = 'contact_customer_accounts',
    // OneToMany + ManyToMany relationships
  }
}
```

### 3.4 Form Interfaces (`forms/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Forms.Account {
  // Union type restricting valid field names
  type AccountMainFormFields = 'name' | 'telephone1' | 'revenue';

  // Mapped type: field name to Xrm attribute type
  type AccountMainFormAttributeMap = {
    name: Xrm.Attributes.StringAttribute;
    telephone1: Xrm.Attributes.StringAttribute;
    revenue: Xrm.Attributes.NumberAttribute;
  };

  // Mapped type: field name to Xrm control type
  type AccountMainFormControlMap = {
    name: Xrm.Controls.StringControl;
    telephone1: Xrm.Controls.StringControl;
    revenue: Xrm.Controls.NumberControl;
  };

  // Fields enum for autocomplete
  const enum AccountMainFormFieldsEnum {
    /** Account Name | Kontoname */
    AccountName = 'name',
    Telephone1 = 'telephone1',
    Revenue = 'revenue',
  }

  // Type-safe FormContext with overloaded getAttribute/getControl
  interface AccountMainForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
    getAttribute<K extends AccountMainFormFields>(name: K): AccountMainFormAttributeMap[K];
    getAttribute(index: number): Xrm.Attributes.Attribute;
    getAttribute(): Xrm.Attributes.Attribute[];

    getControl<K extends AccountMainFormFields>(name: K): AccountMainFormControlMap[K];
    getControl(index: number): Xrm.Controls.Control;
    getControl(): Xrm.Controls.Control[];
  }
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

### 3.6 OptionSet Enums (`optionsets/{entity}.d.ts`)

```typescript
declare namespace XrmForge.OptionSets.Account {
  /** Account Category Code | Kontokategoriecode */
  const enum AccountCategoryCode {
    /** Preferred Customer | Bevorzugter Kunde */
    PreferredCustomer = 1,
    Standard = 2,
  }
}
```

Includes Picklist, Status, State, and MultiSelectPicklist attributes. Duplicate labels are disambiguated with `_{Value}` suffix.

### 3.7 EntityNames Enum (`entity-names.d.ts`)

```typescript
declare namespace XrmForge {
  const enum EntityNames {
    Account = 'account',
    Contact = 'contact',
    // all entities in scope
  }
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

### 3.9 Action/Function Executors (`actions/{entity|global}.d.ts` + `.ts`)

**Declaration (.d.ts):**
```typescript
declare namespace XrmForge.Actions {
  interface NormalizePhoneParams { Input: string; AllowSuspicious?: boolean; }
  interface NormalizePhoneResult { Normalized: string; Status: number; }
}
```

**Runtime module (.ts):**
```typescript
import { createUnboundAction } from '@xrmforge/typegen';
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
