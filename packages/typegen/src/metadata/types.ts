/**
 * @xrmforge/typegen - Metadata Types
 *
 * TypeScript interfaces for Dataverse Metadata API responses.
 * These types model the JSON structures returned by the EntityDefinitions,
 * Attributes, SystemForms, and GlobalOptionSetDefinitions endpoints.
 */

// ─── Labels ──────────────────────────────────────────────────────────────────

export interface LocalizedLabel {
  Label: string;
  LanguageCode: number;
}

export interface Label {
  LocalizedLabels: LocalizedLabel[];
  UserLocalizedLabel: LocalizedLabel | null;
}

// ─── Entity Metadata ─────────────────────────────────────────────────────────

export interface EntityMetadata {
  LogicalName: string;
  SchemaName: string;
  EntitySetName: string;
  DisplayName: Label;
  PrimaryIdAttribute: string;
  PrimaryNameAttribute: string;
  OwnershipType: string;
  IsCustomEntity: boolean;
  LogicalCollectionName: string;
  MetadataId: string;
  Attributes?: AttributeMetadata[];
}

// ─── Attribute Metadata ──────────────────────────────────────────────────────

export interface AttributeMetadata {
  '@odata.type'?: string;
  LogicalName: string;
  SchemaName: string;
  AttributeType: string;
  AttributeTypeName?: { Value: string };
  /**
   * For a companion attribute (one that extends another), the LogicalName of the attribute it
   * extends; null/undefined for a standalone attribute. Dataverse sets this on the EntityName
   * type-discriminator of a polymorphic lookup (e.g. `owneridtype` -> `AttributeOf: 'ownerid'`),
   * which lets typegen tell a lookup companion apart from a genuine standalone EntityName field
   * (e.g. `activitytypecode`, AttributeOf null). See shouldIncludeInEntityInterface (F-LMA11-04).
   */
  AttributeOf?: string | null;
  DisplayName: Label;
  IsPrimaryId: boolean;
  IsPrimaryName: boolean;
  RequiredLevel: { Value: string };
  IsValidForRead: boolean;
  IsValidForCreate: boolean;
  IsValidForUpdate: boolean;
  MetadataId: string;
}

export interface StringAttributeMetadata extends AttributeMetadata {
  MaxLength: number;
  FormatName: { Value: string } | null;
}

export interface IntegerAttributeMetadata extends AttributeMetadata {
  MaxValue: number;
  MinValue: number;
}

export interface DecimalAttributeMetadata extends AttributeMetadata {
  MaxValue: number;
  MinValue: number;
  Precision: number;
}

export interface MoneyAttributeMetadata extends AttributeMetadata {
  MaxValue: number;
  MinValue: number;
  Precision: number;
  PrecisionSource: number;
}

export interface DateTimeAttributeMetadata extends AttributeMetadata {
  DateTimeBehavior: { Value: string };
  Format: string;
}

export interface LookupAttributeMetadata extends AttributeMetadata {
  Targets: string[];
}

export interface PicklistAttributeMetadata extends AttributeMetadata {
  OptionSet: OptionSetMetadata | null;
  GlobalOptionSet: OptionSetMetadata | null;
}

/**
 * Multi-select choice attribute. In the metadata its base AttributeType is
 * "Virtual"; it is identified by @odata.type and normalized to
 * "MultiSelectPicklist" on load (F-MK9-09). Like Picklist it carries a local or
 * global OptionSet.
 */
export interface MultiSelectPicklistAttributeMetadata extends AttributeMetadata {
  OptionSet: OptionSetMetadata | null;
  GlobalOptionSet: OptionSetMetadata | null;
}

export interface StatusAttributeMetadata extends AttributeMetadata {
  OptionSet: OptionSetMetadata | null;
}

export interface StateAttributeMetadata extends AttributeMetadata {
  OptionSet: OptionSetMetadata | null;
}

// ─── OptionSet Metadata ──────────────────────────────────────────────────────

export interface OptionMetadata {
  Value: number;
  Label: Label;
  Description: Label;
  Color: string | null;
}

export interface OptionSetMetadata {
  '@odata.type'?: string;
  Name: string;
  DisplayName: Label;
  IsCustomOptionSet: boolean;
  IsGlobal: boolean;
  OptionSetType: string;
  Options: OptionMetadata[];
  MetadataId: string;
}

// ─── Form Metadata ───────────────────────────────────────────────────────────

export interface SystemFormMetadata {
  name: string;
  formid: string;
  formxml: string;
  description: string | null;
  isdefault: boolean;
  /** Form type (systemform_type): 2 = Main, 7 = Quick Create, ... */
  type: number;
  /** Activation state (systemform_formactivationstate): 0 = Inactive, 1 = Active */
  formactivationstate: number;
}

/** Parsed data-bound control from FormXml (bound to an attribute) */
export interface FormControl {
  /** Control ID (often same as datafieldname) */
  id: string;
  /** Attribute logical name this control is bound to */
  datafieldname: string;
  /** Control class ID (GUID identifying the control type) */
  classid: string;
}

/** Type of special (non-data-bound) control on a form */
export type SpecialControlType = 'subgrid' | 'editablegrid' | 'quickview' | 'webresource' | 'iframe' | 'notes' | 'map' | 'timer' | 'unknown';

/** Parsed special control from FormXml (subgrid, quick view, web resource, etc.) */
export interface FormSpecialControl {
  /** Control ID (used for getControl) */
  id: string;
  /** Control class ID (GUID) */
  classid: string;
  /** Resolved control type */
  controlType: SpecialControlType;
  /** Target entity for subgrids (from parameters) */
  targetEntityType?: string;
  /** Relationship name for subgrids (from parameters) */
  relationshipName?: string;
  /** Web resource name (for web resource controls) */
  webResourceName?: string;
}

/** Parsed tab from FormXml */
export interface FormTab {
  name: string;
  /** Tab label (for display, may be localized) */
  label?: string;
  /** Whether the tab is visible by default */
  visible?: boolean;
  sections: FormSection[];
}

/** Parsed section from FormXml */
export interface FormSection {
  name: string;
  /** Section label */
  label?: string;
  /** Whether the section is visible by default */
  visible?: boolean;
  controls: FormControl[];
  /** Special controls in this section (subgrids, quick views, etc.) */
  specialControls: FormSpecialControl[];
}

/** Parsed form structure */
export interface ParsedForm {
  name: string;
  formId: string;
  isDefault: boolean;
  /** Form type (systemform_type): 2 = Main, 7 = Quick Create */
  type: number;
  tabs: FormTab[];
  /** All data-bound controls across all tabs/sections (flattened) */
  allControls: FormControl[];
  /** All special controls across all tabs/sections (flattened) */
  allSpecialControls: FormSpecialControl[];
}

// ─── Relationship Metadata ───────────────────────────────────────────────────

export interface OneToManyRelationshipMetadata {
  SchemaName: string;
  ReferencingEntity: string;
  ReferencingAttribute: string;
  ReferencedEntity: string;
  ReferencedAttribute: string;
  /**
   * The case-sensitive name of the single-valued navigation property (the `$expand`
   * path). For a multi-table (polymorphic) lookup, each target has its own
   * relationship with its own value here (e.g. `customerid_account`, `owninguser`).
   * Only populated for the ManyToOne fetch (`getManyToOneRelationships`); the
   * OneToMany fetch does not select it, so it is `undefined` there. Microsoft warns
   * that this value must NOT be guessed/constructed - it is the authoritative source.
   */
  ReferencingEntityNavigationPropertyName?: string;
  MetadataId: string;
}

export interface ManyToManyRelationshipMetadata {
  SchemaName: string;
  Entity1LogicalName: string;
  Entity2LogicalName: string;
  IntersectEntityName: string;
  MetadataId: string;
}

// ─── Solution Component ──────────────────────────────────────────────────────

export interface SolutionComponent {
  objectid: string;
  componenttype: number;
}

// ─── Aggregated Result ───────────────────────────────────────────────────────

/** Complete metadata for a single entity, ready for type generation */
export interface EntityTypeInfo {
  entity: EntityMetadata;
  attributes: AttributeMetadata[];
  picklistAttributes: PicklistAttributeMetadata[];
  multiSelectPicklistAttributes: MultiSelectPicklistAttributeMetadata[];
  lookupAttributes: LookupAttributeMetadata[];
  statusAttributes: StatusAttributeMetadata[];
  stateAttributes: StateAttributeMetadata[];
  forms: ParsedForm[];
  oneToManyRelationships: OneToManyRelationshipMetadata[];
  /**
   * N:1 relationships where THIS entity is the referencing (child) entity, i.e. one
   * per lookup target. Source of the authoritative, case-sensitive navigation
   * property names for `$expand` on polymorphic lookups
   * (`ReferencingEntityNavigationPropertyName`).
   */
  manyToOneRelationships: OneToManyRelationshipMetadata[];
  manyToManyRelationships: ManyToManyRelationshipMetadata[];
}
