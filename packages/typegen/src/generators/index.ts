// Type Mapping
export {
  getEntityPropertyType,
  getFormAttributeType,
  getFormControlType,
  toSafeIdentifier,
  toPascalCase,
  toLookupValueProperty,
  isLookupType,
  isPartyListType,
  shouldIncludeInEntityInterface,
} from './type-mapping.js';

// ActivityParty Base Interface
export { generateActivityPartyInterface } from './activity-party.js';

// Label Utilities
export {
  getPrimaryLabel,
  getSecondaryLabel,
  formatDualLabel,
  labelToEnumMember,
  disambiguateEnumMembers,
  DEFAULT_LABEL_CONFIG,
} from './label-utils.js';
export type { LabelConfig } from './label-utils.js';

// Entity Interface Generator
export { generateEntityInterface } from './entity-generator.js';
export type { EntityGeneratorOptions } from './entity-generator.js';

// OptionSet Enum Generator
export { generateOptionSetEnum, generateEntityOptionSets } from './optionset-generator.js';
export type { OptionSetGeneratorOptions } from './optionset-generator.js';

// Form Interface Generator
export { generateFormInterface, generateEntityForms } from './form-generator.js';
export type { FormGeneratorOptions } from './form-generator.js';

// Entity Fields Enum Generator (for Web API $select)
export { generateEntityFieldsEnum } from './entity-fields-generator.js';
export type { EntityFieldsGeneratorOptions } from './entity-fields-generator.js';

// Web API Helpers
export { select, selectExpand, parseLookup, parseLookups, parseFormattedValue } from './webapi-helpers.js';
