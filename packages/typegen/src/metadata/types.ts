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
}

/** Parsed control from FormXml */
export interface FormControl {
  /** Control ID (often same as datafieldname) */
  id: string;
  /** Attribute logical name this control is bound to */
  datafieldname: string;
  /** Control class ID (GUID identifying the control type) */
  classid: string;
}

/** Parsed tab from FormXml */
export interface FormTab {
  name: string;
  sections: FormSection[];
}

/** Parsed section from FormXml */
export interface FormSection {
  name: string;
  controls: FormControl[];
}

/** Parsed form structure */
export interface ParsedForm {
  name: string;
  formId: string;
  isDefault: boolean;
  tabs: FormTab[];
  /** All controls across all tabs/sections (flattened for convenience) */
  allControls: FormControl[];
}

// ─── Relationship Metadata ───────────────────────────────────────────────────

export interface OneToManyRelationshipMetadata {
  SchemaName: string;
  ReferencingEntity: string;
  ReferencingAttribute: string;
  ReferencedEntity: string;
  ReferencedAttribute: string;
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
  lookupAttributes: LookupAttributeMetadata[];
  statusAttributes: StatusAttributeMetadata[];
  stateAttributes: StateAttributeMetadata[];
  forms: ParsedForm[];
  oneToManyRelationships: OneToManyRelationshipMetadata[];
  manyToManyRelationships: ManyToManyRelationshipMetadata[];
}
