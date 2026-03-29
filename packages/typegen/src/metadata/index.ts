export { MetadataClient } from './client.js';
export { MetadataCache } from './cache.js';
export {
  getPrimaryLabel,
  getJSDocLabel,
  labelToIdentifier,
  generateEnumMembers,
  getLabelLanguagesParam,
  transliterateUmlauts,
  DEFAULT_LABEL_CONFIG,
} from './labels.js';
export type { LabelConfig } from './labels.js';
export { parseForm, extractControlFields } from './form-parser.js';
export { FastXmlParser, defaultXmlParser } from './xml-parser.js';
export type { XmlParser, XmlElement } from './xml-parser.js';
export type {
  EntityMetadata,
  AttributeMetadata,
  StringAttributeMetadata,
  IntegerAttributeMetadata,
  DecimalAttributeMetadata,
  MoneyAttributeMetadata,
  DateTimeAttributeMetadata,
  LookupAttributeMetadata,
  PicklistAttributeMetadata,
  StatusAttributeMetadata,
  StateAttributeMetadata,
  OptionSetMetadata,
  OptionMetadata,
  SystemFormMetadata,
  ParsedForm,
  FormControl,
  FormTab,
  FormSection,
  OneToManyRelationshipMetadata,
  ManyToManyRelationshipMetadata,
  SolutionComponent,
  EntityTypeInfo,
  Label,
  LocalizedLabel,
} from './types.js';
