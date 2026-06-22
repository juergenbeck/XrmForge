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
  getFormMockValueType,
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
export { generateEntityFieldsEnum, generateEntityNavigationProperties, generateEntityExpands } from './entity-fields-generator.js';
export type { EntityFieldsGeneratorOptions } from './entity-fields-generator.js';

// Entity Names Enum Generator (for Xrm.WebApi entity name parameters)
export { generateEntityNamesEnum } from './entity-names-generator.js';
export type { EntityNamesGeneratorOptions } from './entity-names-generator.js';

// Action/Function Generator
export {
  generateActionDeclarations,
  generateActionModule,
  groupCustomApis,
} from './action-generator.js';
export type { ActionGeneratorOptions, GroupedCustomApis } from './action-generator.js';
