export { MetadataClient } from './client.js';
export { MetadataCache } from './cache.js';
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
