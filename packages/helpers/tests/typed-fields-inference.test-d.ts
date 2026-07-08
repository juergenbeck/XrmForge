/**
 * Type-level tests for typedFields inference.
 * This file is checked by tsc --noEmit but not executed by vitest.
 * If this compiles without errors, the type inference is correct.
 */
import { typedFields, typedField } from '../src/typed-form.js';
import type { AttrKind, KindMap, KindToAttribute, TypedFields } from '../src/typed-form.js';

declare const fc: Xrm.FormContext;

// ─── A kindMap as typegen emits it (XxxFieldKinds, keyed by logical name) ────

const QuotedetailFieldKinds = {
  quantity: 'number',
  lm_einheittext: 'string',
  ispriceoverridden: 'boolean',
  producttypecode: 'optionset',
  productid: 'lookup',
  createdon: 'date',
} as const;

const f = typedFields(fc, QuotedetailFieldKinds);

// Each accessor is NULLABLE and typed by its kind (no cast):
const _q: Xrm.Attributes.NumberAttribute | null = f.quantity;
const _t: Xrm.Attributes.StringAttribute | null = f.lm_einheittext;
const _b: Xrm.Attributes.BooleanAttribute | null = f.ispriceoverridden;
const _o: Xrm.Attributes.OptionSetAttribute | null = f.producttypecode;
const _l: Xrm.Attributes.LookupAttribute | null = f.productid;
const _d: Xrm.Attributes.DateAttribute | null = f.createdon;

// getValue is reached via optional chaining (the attribute may be absent):
const _qv: number | null | undefined = f.quantity?.getValue();

// Controls are nullable StandardControl:
const _c: Xrm.Controls.StandardControl | null = f.controls.quantity;

// Escape hatches:
const _en: string = f.$context.data.entity.getEntityName();
const _u: Xrm.Attributes.Attribute | null = f.$unsafe('whatever');

// ─── Hand-written cross-entity map (bespoke group of named constants) ────────

const address = typedFields(fc, {
  address1_line1: 'string',
  address1_country: 'string',
  transactioncurrencyid: 'lookup',
} as const);
const _a: Xrm.Attributes.StringAttribute | null = address.address1_line1;
const _ac: Xrm.Attributes.LookupAttribute | null = address.transactioncurrencyid;

// ─── Exported types are usable directly ──────────────────────────────────────

const _kindString: AttrKind = 'string';
const _kindMulti: AttrKind = 'multiselect';
const _map: KindMap = { anyfield: 'date' };
const _multiAttr: KindToAttribute['multiselect'] = null as unknown as Xrm.Attributes.MultiSelectOptionSetAttribute;
// typedFields' return type is exactly TypedFields<M> (return-type stability):
const _explicit: TypedFields<typeof QuotedetailFieldKinds> = f;

// Suppress unused variable warnings
void _q;
void _t;
void _b;
void _o;
void _l;
void _d;
void _qv;
void _c;
void _en;
void _u;
void _a;
void _ac;
void _kindString;
void _kindMulti;
void _map;
void _multiAttr;
void _explicit;

// ─── typedField: single field by a variable (non-literal) name (F-LMA12-01) ──
// A heterogeneous kindMap over non-literal PARAMETER keys collapses to an attribute
// union (the trap). typedField takes one generic K per call, so each access stays
// EXACT even when the field name is a runtime string. If any assignment below needed
// a wider type, this file would fail tsc - that is the proof the trap is solved.

declare const flagField: string;
declare const dateField: string;

const _tfString: Xrm.Attributes.StringAttribute | null = typedField(fc, 'name', 'string');
const _tfNumber: Xrm.Attributes.NumberAttribute | null = typedField(fc, 'revenue', 'number');
const _tfBool: Xrm.Attributes.BooleanAttribute | null = typedField(fc, flagField, 'boolean');
const _tfDate: Xrm.Attributes.DateAttribute | null = typedField(fc, dateField, 'date');
const _tfOption: Xrm.Attributes.OptionSetAttribute | null = typedField(fc, 'statecode', 'optionset');
const _tfMulti: Xrm.Attributes.MultiSelectOptionSetAttribute | null = typedField(fc, 'somemulti', 'multiselect');
const _tfLookup: Xrm.Attributes.LookupAttribute | null = typedField(fc, 'ownerid', 'lookup');

// getValue via optional chaining (the attribute may be absent):
const _tfBoolV: boolean | null | undefined = typedField(fc, flagField, 'boolean')?.getValue();

void _tfString;
void _tfNumber;
void _tfBool;
void _tfDate;
void _tfOption;
void _tfMulti;
void _tfLookup;
void _tfBoolV;
