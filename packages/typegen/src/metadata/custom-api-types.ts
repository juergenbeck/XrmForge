/**
 * @xrmforge/typegen - Custom API Metadata Types
 *
 * TypeScript interfaces for Dataverse Custom API definitions.
 * These types model the JSON structures from the customapi,
 * customapirequestparameter, and customapiresponseproperty tables.
 *
 * Used by the action-generator to produce typed Action/Function executors.
 */

// ─── Custom API Parameter Type ──────────────────────────────────────────────

/**
 * Custom API parameter type (picklist values from customapirequestparameter.type).
 *
 * Maps to TypeScript types and OData metadata for getMetadata().
 */
export const enum CustomApiParameterType {
  Boolean = 0,
  DateTime = 1,
  Decimal = 2,
  Entity = 3,
  EntityCollection = 4,
  EntityReference = 5,
  Float = 6,
  Integer = 7,
  Money = 8,
  Picklist = 9,
  String = 10,
  StringArray = 11,
  Guid = 12,
}

/**
 * Custom API binding type (picklist values from customapi.bindingtype).
 */
export const enum CustomApiBindingType {
  /** Nicht an eine Entity gebunden (global aufrufbar) */
  Global = 0,
  /** An einen einzelnen Entity-Datensatz gebunden */
  Entity = 1,
  /** An eine Entity-Collection gebunden */
  EntityCollection = 2,
}

// ─── Metadata Interfaces ────────────────────────────────────────────────────

/** Custom API definition (from the customapi table) */
export interface CustomApiMetadata {
  /** Unique message name (e.g. "markant_NormalizePhone") */
  uniquename: string;
  /** 0=Global, 1=Entity, 2=EntityCollection */
  bindingtype: CustomApiBindingType;
  /** true = Function (GET), false = Action (POST) */
  isfunction: boolean;
  /** Bound entity logical name (null for unbound) */
  boundentitylogicalname: string | null;
  /** Display name for documentation */
  displayname?: string;
  /** Description for JSDoc */
  description?: string;
}

/** Custom API request parameter (from the customapirequestparameter table) */
export interface CustomApiRequestParameter {
  /** Parameter name (e.g. "Input", "TargetId") */
  uniquename: string;
  /** Parameter type (0-12, see CustomApiParameterType) */
  type: CustomApiParameterType;
  /** Whether the parameter is optional */
  isoptional: boolean;
  /** Entity logical name (for Entity/EntityReference types) */
  logicalentityname?: string | null;
  /** Description for JSDoc */
  description?: string;
}

/** Custom API response property (from the customapiresponseproperty table) */
export interface CustomApiResponseProperty {
  /** Property name (e.g. "Normalized", "IsValid") */
  uniquename: string;
  /** Property type (0-12, see CustomApiParameterType) */
  type: CustomApiParameterType;
  /** Entity logical name (for Entity/EntityReference types) */
  logicalentityname?: string | null;
  /** Description for JSDoc */
  description?: string;
}

/** Complete Custom API definition with parameters and response */
export interface CustomApiTypeInfo {
  api: CustomApiMetadata;
  requestParameters: CustomApiRequestParameter[];
  responseProperties: CustomApiResponseProperty[];
}

// ─── Type Mapping ───────────────────────────────────────────────────────────

/** Mapped type information for code generation */
export interface MappedParameterType {
  /** TypeScript type string (e.g. "string", "number", "boolean") */
  tsType: string;
  /** OData type name for getMetadata() (e.g. "Edm.String", "mscrm.quote") */
  typeName: string;
  /** structuralProperty value for getMetadata() */
  structuralProperty: number;
}

/**
 * Map a Custom API parameter type (0-12) to TypeScript + OData metadata.
 *
 * @param type - Custom API parameter type value
 * @param entityName - Entity logical name (for Entity/EntityReference types)
 * @returns TypeScript type, OData typeName, and structuralProperty
 */
export function mapCustomApiParameterType(
  type: CustomApiParameterType,
  entityName?: string | null,
): MappedParameterType {
  switch (type) {
    case CustomApiParameterType.Boolean:
      return { tsType: 'boolean', typeName: 'Edm.Boolean', structuralProperty: 1 };
    case CustomApiParameterType.DateTime:
      return { tsType: 'string', typeName: 'Edm.DateTimeOffset', structuralProperty: 1 };
    case CustomApiParameterType.Decimal:
      return { tsType: 'number', typeName: 'Edm.Decimal', structuralProperty: 1 };
    case CustomApiParameterType.Entity:
      return {
        tsType: 'Record<string, unknown>',
        typeName: `mscrm.${entityName || 'crmbaseentity'}`,
        structuralProperty: 5,
      };
    case CustomApiParameterType.EntityCollection:
      return {
        tsType: 'Array<Record<string, unknown>>',
        typeName: 'Collection(mscrm.crmbaseentity)',
        structuralProperty: 4,
      };
    case CustomApiParameterType.EntityReference:
      return {
        tsType: '{ id: string; entityType: string; name?: string }',
        typeName: `mscrm.${entityName || 'crmbaseentity'}`,
        structuralProperty: 5,
      };
    case CustomApiParameterType.Float:
      return { tsType: 'number', typeName: 'Edm.Double', structuralProperty: 1 };
    case CustomApiParameterType.Integer:
      return { tsType: 'number', typeName: 'Edm.Int32', structuralProperty: 1 };
    case CustomApiParameterType.Money:
      return { tsType: 'number', typeName: 'Edm.Decimal', structuralProperty: 1 };
    case CustomApiParameterType.Picklist:
      return { tsType: 'number', typeName: 'Edm.Int32', structuralProperty: 1 };
    case CustomApiParameterType.String:
      return { tsType: 'string', typeName: 'Edm.String', structuralProperty: 1 };
    case CustomApiParameterType.StringArray:
      return { tsType: 'string[]', typeName: 'Collection(Edm.String)', structuralProperty: 4 };
    case CustomApiParameterType.Guid:
      return { tsType: 'string', typeName: 'Edm.Guid', structuralProperty: 1 };
    default:
      return { tsType: 'unknown', typeName: 'Edm.String', structuralProperty: 0 };
  }
}
