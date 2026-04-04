# 3. Generierte Typen

Die Ausführung von `xrmforge generate` erzeugt die folgenden TypeScript-Deklarationen:

## 3.1 Entitäts-Interfaces (`entities/{entity}.d.ts`)

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

**Typ-Zuordnung:** String/Memo/EntityName zu `string`, Integer/BigInt/Decimal/Double/Money zu `number`, Boolean zu `boolean`, DateTime/Uniqueidentifier/Lookup zu `string`, Picklist/State/Status zu `number`.

## 3.2 Entity Fields Enums (`entities/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Entities {
  const enum AccountFields {
    /** Account Name | Kontoname */
    Name = 'name',
    Revenue = 'revenue',
    // alle lesbaren Attribute
  }
}
```

Verwendet für Web API `$select`: `select(AccountFields.Name, AccountFields.Revenue)`.

## 3.3 Navigations-Properties (`entities/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Entities {
  const enum AccountNavigation {
    PrimaryContactId = 'primarycontactid',
    ContactCustomerAccounts = 'contact_customer_accounts',
    // OneToMany- + ManyToMany-Beziehungen
  }
}
```

## 3.4 Formular-Interfaces (`forms/{entity}.d.ts`)

```typescript
declare namespace XrmForge.Forms.Account {
  // Union-Typ, der gültige Feldnamen einschränkt
  type AccountMainFormFields = 'name' | 'telephone1' | 'revenue';

  // Gemappter Typ: Feldname zu Xrm-Attributtyp
  type AccountMainFormAttributeMap = {
    name: Xrm.Attributes.StringAttribute;
    telephone1: Xrm.Attributes.StringAttribute;
    revenue: Xrm.Attributes.NumberAttribute;
  };

  // Gemappter Typ: Feldname zu Xrm-Steuerelementtyp
  type AccountMainFormControlMap = {
    name: Xrm.Controls.StringControl;
    telephone1: Xrm.Controls.StringControl;
    revenue: Xrm.Controls.NumberControl;
  };

  // Fields-Enum für Autovervollständigung
  const enum AccountMainFormFieldsEnum {
    /** Account Name | Kontoname */
    AccountName = 'name',
    Telephone1 = 'telephone1',
    Revenue = 'revenue',
  }

  // Typsicherer FormContext mit überladenen getAttribute/getControl
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

## 3.6 OptionSet Enums (`optionsets/{entity}.d.ts`)

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

Umfasst Picklist-, Status-, State- und MultiSelectPicklist-Attribute. Doppelte Labels werden mit dem Suffix `_{Value}` disambiguiert.

## 3.7 EntityNames Enum (`entity-names.d.ts`)

```typescript
declare namespace XrmForge {
  const enum EntityNames {
    Account = 'account',
    Contact = 'contact',
    // alle Entitäten im Scope
  }
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

## 3.9 Action/Function Executors (`actions/{entity|global}.d.ts` + `.ts`)

**Deklaration (.d.ts):**
```typescript
declare namespace XrmForge.Actions {
  interface NormalizePhoneParams { Input: string; AllowSuspicious?: boolean; }
  interface NormalizePhoneResult { Normalized: string; Status: number; }
}
```

**Laufzeitmodul (.ts):**
```typescript
import { createUnboundAction } from '@xrmforge/typegen';
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
