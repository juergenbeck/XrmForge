# 3. Generierte Typen

Die Ausführung von `xrmforge generate` erzeugt die folgenden TypeScript-ES-Module:

## 3.1 Entitäts-Interfaces (`entities/{entity}.ts`)

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

**Typ-Zuordnung:** String/Memo/EntityName zu `string`, Integer/BigInt/Decimal/Double/Money zu `number`, Boolean zu `boolean`, DateTime/Uniqueidentifier/Lookup zu `string`, Picklist/State/Status zu `number`.

## 3.2 Entity Fields Enums (`fields/{entity}.ts`)

```typescript
// generated/fields/account.ts
export const enum AccountFields {
  /** Account Name | Kontoname */
  Name = 'name',
  Telephone1 = 'telephone1',
  Revenue = 'revenue',
  // alle Entitätsattribute für $select-Abfragen
}

export const enum AccountNavigationProperties {
  PrimaryContact = 'primarycontactid',
  ContactCustomerAccounts = 'contact_customer_accounts',
  // alle Lookup-Navigations-Properties
}
```

Verwendet für Web API `$select`: `select(AccountFields.Name, AccountFields.Revenue)`.

## 3.3 Navigations-Properties (`fields/{entity}.ts`)

Navigations-Property-Enums befinden sich zusammen mit den Fields-Enums in derselben Datei (siehe 3.2 oben). Beispielverwendung:

```typescript
import { AccountNavigationProperties } from '../generated/fields/account';
// verwendet für $expand-Abfragen
```

## 3.4 Formular-Interfaces (`forms/{entity}.ts`)

```typescript
// generated/forms/account.ts

// Union-Typ, der gültige Feldnamen einschränkt
export type AccountMainFormFields = 'name' | 'telephone1' | 'revenue';

// Gemappter Typ: Feldname zu Xrm-Attributtyp
export type AccountMainFormAttributeMap = {
  name: Xrm.Attributes.StringAttribute;
  telephone1: Xrm.Attributes.StringAttribute;
  revenue: Xrm.Attributes.NumberAttribute;
};

// Gemappter Typ: Feldname zu Xrm-Steuerelementtyp
export type AccountMainFormControlMap = {
  name: Xrm.Controls.StringControl;
  telephone1: Xrm.Controls.StringControl;
  revenue: Xrm.Controls.NumberControl;
};

// Fields-Enum für Autovervollständigung
export const enum AccountMainFormFieldsEnum {
  /** Account Name | Kontoname */
  AccountName = 'name',
  Telephone1 = 'telephone1',
  Revenue = 'revenue',
}

// Typsicherer FormContext mit überladenen getAttribute/getControl
export interface AccountMainForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
  getAttribute<K extends AccountMainFormFields>(name: K): AccountMainFormAttributeMap[K];
  getAttribute(index: number): Xrm.Attributes.Attribute;
  getAttribute(): Xrm.Attributes.Attribute[];

  getControl<K extends AccountMainFormFields>(name: K): AccountMainFormControlMap[K];
  getControl(index: number): Xrm.Controls.Control;
  getControl(): Xrm.Controls.Control[];
}
```

**Spezielle Steuerelemente** werden anhand ihrer FormXml-ClassID typisiert:
- Subgrid: `Xrm.Controls.GridControl`
- Editierbares Grid: `Xrm.Controls.GridControl`
- Quick View: `Xrm.Controls.QuickFormControl`
- Web Resource / iFrame: `Xrm.Controls.IframeControl`

## 3.5 Tabs/Sections/Subgrids/QuickViews Enums

```typescript
const enum AccountMainFormTabs { Summary = 'SUMMARY_TAB', Details = 'DETAILS_TAB' }
const enum AccountMainFormSections { General = 'GENERAL', Address = 'ADDRESS' }
const enum AccountMainFormSubgrids { Contacts = 'Contacts_Subgrid' }
const enum AccountMainFormQuickViews { ContactPreview = 'ContactQuickView' }
```

## 3.6 OptionSet Enums (`optionsets/{entity}.ts`)

```typescript
// generated/optionsets/account.ts
/** Account Category Code | Kontokategoriecode */
export const enum AccountCategoryCode {
  /** Preferred Customer | Bevorzugter Kunde */
  PreferredCustomer = 1,
  Standard = 2,
}
```

Umfasst Picklist-, Status-, State- und MultiSelectPicklist-Attribute. Doppelte Labels werden mit dem Suffix `_{Value}` disambiguiert.

## 3.7 EntityNames Enum (`entity-names.ts`)

```typescript
// generated/entity-names.ts
export const enum EntityNames {
  Account = 'account',
  Contact = 'contact',
  // alle Entitäten im Scope
}
```

## 3.8 MockValues-Typen (in Formular-Interfaces)

```typescript
type AccountMainFormMockValues = {
  name?: string | null;
  telephone1?: string | null;
  revenue?: number | null;
};
```

Verwendet mit `createFormMock<AccountMainForm, AccountMainFormMockValues>({ name: 'Test' })`.

## 3.9 Action/Function Executors (`actions/{entity|global}.ts`)

```typescript
// generated/actions/global.ts
import { createUnboundAction } from '@xrmforge/helpers';

export interface NormalizePhoneParams { Input: string; AllowSuspicious?: boolean; }
export interface NormalizePhoneResult { Normalized: string; Status: number; }

export const NormalizePhone = createUnboundAction<NormalizePhoneParams, NormalizePhoneResult>(
  'markant_NormalizePhone',
  { Input: { typeName: 'String', structuralProperty: 1 } }
);
// Verwendung: const result = await NormalizePhone.execute({ Input: '123' });
```

Factory-Funktionen: `createBoundAction`, `createUnboundAction`, `createBoundFunction`, `createUnboundFunction`. Batch-Ausführung über `executeMultiple()`, Fortschritts-UI über `withProgress()`.

## 3.10 Zweisprachige Labels

Alle generierten JSDoc-Kommentare unterstützen zweisprachige Labels:
```typescript
/** Account Name | Kontoname */
Name = 'name',
```

Deutsche Umlaute werden in Bezeichnern transliteriert: ae, oe, ue, ss (z.B. "Übergeordnet" wird zu `Uebergeordnet`).
