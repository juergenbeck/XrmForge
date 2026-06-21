/**
 * @xrmforge/typegen - Metadata Client
 *
 * High-level client for querying Dataverse Metadata API endpoints.
 * Built on top of DataverseHttpClient for resilient HTTP communication.
 *
 * Provides methods for:
 * - Entity metadata with attributes
 * - Typed attribute queries (Picklist, Lookup, Status/State)
 * - Form metadata (SystemForms + FormXml parsing)
 * - Global OptionSet definitions
 * - Solution-based entity filtering
 * - Relationship metadata (1:N, N:N)
 */

import { DataverseHttpClient } from '../http/client.js';
import { MetadataError, ErrorCode } from '../errors.js';
import { createLogger } from '../logger.js';
import { parseForm } from './form-parser.js';
import type {
  AttributeMetadata,
  EntityMetadata,
  PicklistAttributeMetadata,
  MultiSelectPicklistAttributeMetadata,
  LookupAttributeMetadata,
  StatusAttributeMetadata,
  StateAttributeMetadata,
  OptionSetMetadata,
  SystemFormMetadata,
  ParsedForm,
  OneToManyRelationshipMetadata,
  ManyToManyRelationshipMetadata,
  SolutionComponent,
  EntityTypeInfo,
} from './types.js';
import type {
  CustomApiTypeInfo,
  CustomApiMetadata,
  CustomApiRequestParameter,
  CustomApiResponseProperty,
} from './custom-api-types.js';

const log = createLogger('metadata');

// ─── OData Response Wrappers ─────────────────────────────────────────────────

interface ODataCollection<T> {
  value: T[];
}

interface SolutionRecord {
  solutionid: string;
  uniquename: string;
  friendlyname: string;
}

// ─── Dataverse Constants ─────────────────────────────────────────────────────

/** Dataverse SystemForm type code for Main forms */
const FORM_TYPE_MAIN = 2;

/** Dataverse SystemForm type code for Quick Create forms */
const FORM_TYPE_QUICK_CREATE = 7;

/** Dataverse SystemForm activation state (systemform_formactivationstate): Active */
const FORM_ACTIVATION_ACTIVE = 1;

/** Dataverse SolutionComponent type code for Entity */
const COMPONENT_TYPE_ENTITY = 1;

// ─── Sorting ─────────────────────────────────────────────────────────────────

/**
 * Ordinal comparator for deterministic ordering by uniquename.
 * OData returns rows in server order (no $orderby on customapi tables),
 * which is not guaranteed to be stable. Deterministic output is a
 * prerequisite for drift detection (generate --check) and keeps
 * generate diffs free of reordering noise.
 */
function byUniqueName(a: { uniquename: string }, b: { uniquename: string }): number {
  return a.uniquename < b.uniquename ? -1 : a.uniquename > b.uniquename ? 1 : 0;
}

// ─── Select Constants ────────────────────────────────────────────────────────

const ENTITY_SELECT = 'LogicalName,SchemaName,EntitySetName,DisplayName,PrimaryIdAttribute,PrimaryNameAttribute,OwnershipType,IsCustomEntity,LogicalCollectionName,MetadataId';
const ATTRIBUTE_SELECT = 'LogicalName,SchemaName,AttributeType,AttributeTypeName,DisplayName,IsPrimaryId,IsPrimaryName,RequiredLevel,IsValidForRead,IsValidForCreate,IsValidForUpdate,MetadataId';
const FORM_SELECT = 'name,formid,formxml,description,isdefault,type,formactivationstate';

/**
 * @odata.type annotation that marks a multi-select choice attribute. Its base
 * AttributeType is "Virtual", so without this it would not be recognized as an
 * OptionSet-bearing field (F-MK9-09).
 */
const MULTISELECT_ODATA_TYPE = '#Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata';

/**
 * Normalize multi-select choice attributes in place: their metadata reports
 * AttributeType "Virtual" and is only distinguishable via @odata.type. Rewriting
 * it to "MultiSelectPicklist" lets the type-mapping resolve them correctly
 * (entity property -> string, form attribute -> MultiSelectOptionSetAttribute)
 * instead of falling through to "unknown" (F-MK9-09).
 */
function normalizeMultiSelectAttributeTypes(attributes: AttributeMetadata[] | undefined): void {
  if (!attributes) return;
  for (const attr of attributes) {
    const odataType = (attr as unknown as Record<string, unknown>)['@odata.type'];
    if (odataType === MULTISELECT_ODATA_TYPE) {
      attr.AttributeType = 'MultiSelectPicklist';
    }
  }
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class MetadataClient {
  private readonly http: DataverseHttpClient;

  constructor(httpClient: DataverseHttpClient) {
    this.http = httpClient;
  }

  // ─── Entity Metadata ───────────────────────────────────────────────────

  /**
   * Get metadata for a single entity by LogicalName, including all attributes.
   *
   * @throws {MetadataError} if the entity is not found
   */
  async getEntityWithAttributes(logicalName: string): Promise<EntityMetadata> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.info(`Fetching entity metadata: ${safeName}`);

    const entity = await this.http.get<EntityMetadata>(
      `/EntityDefinitions(LogicalName='${safeName}')?$select=${ENTITY_SELECT}&$expand=Attributes($select=${ATTRIBUTE_SELECT})`,
    );

    normalizeMultiSelectAttributeTypes(entity.Attributes);

    log.info(`Entity "${safeName}": ${entity.Attributes?.length ?? 0} attributes`);
    return entity;
  }

  /**
   * List all entities (without attributes) for discovery.
   * Use `$filter` parameter to narrow results.
   */
  async listEntities(filter?: string): Promise<EntityMetadata[]> {
    let path = `/EntityDefinitions?$select=${ENTITY_SELECT}`;
    if (filter) {
      path += `&$filter=${filter}`;
    }

    log.info('Listing entities');
    return this.http.getAll<EntityMetadata>(path);
  }

  // ─── Typed Attribute Queries ───────────────────────────────────────────

  /**
   * Get all Picklist attributes with their OptionSets for an entity.
   * Includes both local and global OptionSets.
   */
  async getPicklistAttributes(logicalName: string): Promise<PicklistAttributeMetadata[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.debug(`Fetching Picklist attributes for: ${safeName}`);

    return this.http.getAll<PicklistAttributeMetadata>(
      `/EntityDefinitions(LogicalName='${safeName}')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName,SchemaName,MetadataId&$expand=OptionSet($select=Options,Name,IsGlobal,MetadataId),GlobalOptionSet($select=Options,Name,MetadataId)`,
    );
  }

  /**
   * Get all MultiSelect Picklist attributes with their OptionSets for an entity.
   * Multi-select choices are a distinct metadata type (not a Picklist subtype),
   * so they need their own cast query; otherwise their OptionSet is never loaded
   * and no enum is generated (F-MK9-09). Includes both local and global OptionSets.
   */
  async getMultiSelectPicklistAttributes(logicalName: string): Promise<MultiSelectPicklistAttributeMetadata[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.debug(`Fetching MultiSelect Picklist attributes for: ${safeName}`);

    return this.http.getAll<MultiSelectPicklistAttributeMetadata>(
      `/EntityDefinitions(LogicalName='${safeName}')/Attributes/Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata?$select=LogicalName,SchemaName,MetadataId&$expand=OptionSet($select=Options,Name,IsGlobal,MetadataId),GlobalOptionSet($select=Options,Name,MetadataId)`,
    );
  }

  /**
   * Get all Lookup attributes with their target entity names.
   */
  async getLookupAttributes(logicalName: string): Promise<LookupAttributeMetadata[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.debug(`Fetching Lookup attributes for: ${safeName}`);

    return this.http.getAll<LookupAttributeMetadata>(
      `/EntityDefinitions(LogicalName='${safeName}')/Attributes/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=LogicalName,SchemaName,Targets,MetadataId`,
    );
  }

  /**
   * Get Status attributes (statuscode) with their OptionSets.
   */
  async getStatusAttributes(logicalName: string): Promise<StatusAttributeMetadata[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.debug(`Fetching Status attributes for: ${safeName}`);

    return this.http.getAll<StatusAttributeMetadata>(
      `/EntityDefinitions(LogicalName='${safeName}')/Attributes/Microsoft.Dynamics.CRM.StatusAttributeMetadata?$select=LogicalName,SchemaName,MetadataId&$expand=OptionSet($select=Options)`,
    );
  }

  /**
   * Get State attributes (statecode) with their OptionSets.
   */
  async getStateAttributes(logicalName: string): Promise<StateAttributeMetadata[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.debug(`Fetching State attributes for: ${safeName}`);

    return this.http.getAll<StateAttributeMetadata>(
      `/EntityDefinitions(LogicalName='${safeName}')/Attributes/Microsoft.Dynamics.CRM.StateAttributeMetadata?$select=LogicalName,SchemaName,MetadataId&$expand=OptionSet($select=Options)`,
    );
  }

  // ─── Form Metadata ────────────────────────────────────────────────────

  /**
   * Get and parse the form types relevant for type generation (Main type=2 and
   * Quick Create type=7), restricted to ACTIVE forms (formactivationstate=1).
   * Inactive forms are leftovers that no app surfaces, so they get no interface -
   * this applies to both Main and Quick Create forms.
   *
   * Returns parsed form structures with tabs, sections, controls, and the form type.
   */
  async getForms(logicalName: string): Promise<ParsedForm[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.info(`Fetching active Main + Quick Create forms for: ${safeName}`);

    const forms = await this.http.getAll<SystemFormMetadata>(
      `/systemforms?$filter=objecttypecode eq '${safeName}' and ` +
        `(type eq ${FORM_TYPE_MAIN} or type eq ${FORM_TYPE_QUICK_CREATE}) and ` +
        `formactivationstate eq ${FORM_ACTIVATION_ACTIVE}` +
        `&$select=${FORM_SELECT}`,
    );

    const mainCount = forms.filter((f) => f.type === FORM_TYPE_MAIN).length;
    const qcCount = forms.filter((f) => f.type === FORM_TYPE_QUICK_CREATE).length;
    log.info(`Found ${mainCount} Main + ${qcCount} Quick Create active form(s) for "${safeName}"`);

    return forms.map((form) => {
      try {
        return parseForm(form);
      } catch (error: unknown) {
        log.warn(`Failed to parse form "${form.name}" (${form.formid}), skipping`, {
          formName: form.name,
          formId: form.formid,
          error: error instanceof Error ? error.message : String(error),
        });
        // Return a minimal parsed form with no controls rather than failing entirely
        return {
          name: form.name,
          formId: form.formid,
          isDefault: form.isdefault,
          type: form.type,
          tabs: [],
          allControls: [],
          allSpecialControls: [],
        };
      }
    });
  }

  // ─── Global OptionSets ─────────────────────────────────────────────────

  /**
   * Get a global OptionSet by its exact name.
   */
  async getGlobalOptionSet(name: string): Promise<OptionSetMetadata> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(name);

    log.debug(`Fetching GlobalOptionSet: ${safeName}`);

    return this.http.get<OptionSetMetadata>(
      `/GlobalOptionSetDefinitions(Name='${safeName}')`,
    );
  }

  /**
   * List all global OptionSets (names and types only).
   */
  async listGlobalOptionSets(): Promise<OptionSetMetadata[]> {
    log.debug('Listing all GlobalOptionSets');

    return this.http.getAll<OptionSetMetadata>(
      `/GlobalOptionSetDefinitions?$select=Name,DisplayName,OptionSetType,IsGlobal,MetadataId`,
    );
  }

  // ─── Relationships ─────────────────────────────────────────────────────

  /**
   * Get all 1:N relationships where this entity is the referenced (parent) entity.
   */
  async getOneToManyRelationships(logicalName: string): Promise<OneToManyRelationshipMetadata[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.debug(`Fetching 1:N relationships for: ${safeName}`);

    return this.http.getAll<OneToManyRelationshipMetadata>(
      `/EntityDefinitions(LogicalName='${safeName}')/OneToManyRelationships?$select=SchemaName,ReferencingEntity,ReferencingAttribute,ReferencedEntity,ReferencedAttribute,MetadataId`,
    );
  }

  /**
   * Get all N:N relationships for an entity.
   */
  async getManyToManyRelationships(logicalName: string): Promise<ManyToManyRelationshipMetadata[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.debug(`Fetching N:N relationships for: ${safeName}`);

    return this.http.getAll<ManyToManyRelationshipMetadata>(
      `/EntityDefinitions(LogicalName='${safeName}')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName,MetadataId`,
    );
  }

  // ─── Solution Filter ───────────────────────────────────────────────────

  /**
   * Get all entity LogicalNames that belong to a specific solution.
   * Resolves SolutionComponent MetadataIds to EntityDefinition LogicalNames.
   *
   * @param solutionUniqueName - The unique name of the solution
   * @returns Array of entity LogicalNames (e.g. ["account", "contact"])
   */
  async getEntityNamesForSolution(solutionUniqueName: string): Promise<string[]> {
    const safeName = DataverseHttpClient.escapeODataString(solutionUniqueName);

    log.info(`Fetching solution: ${solutionUniqueName}`);

    // Step 1: Get solution ID
    const solutions = await this.http.get<ODataCollection<SolutionRecord>>(
      `/solutions?$filter=uniquename eq '${safeName}'&$select=solutionid,uniquename,friendlyname`,
    );

    if (solutions.value.length === 0) {
      throw new MetadataError(
        ErrorCode.META_SOLUTION_NOT_FOUND,
        `Solution "${solutionUniqueName}" not found`,
        { solutionUniqueName },
      );
    }

    const solutionId = solutions.value[0]!.solutionid;
    const solutionName = solutions.value[0]!.friendlyname;

    log.info(`Solution "${solutionName}" (${solutionId})`);

    // Step 2: Get entity components (componenttype=1)
    const components = await this.http.getAll<SolutionComponent>(
      `/solutioncomponents?$filter=_solutionid_value eq ${DataverseHttpClient.sanitizeGuid(solutionId)} and componenttype eq ${COMPONENT_TYPE_ENTITY}&$select=objectid,componenttype`,
    );

    log.info(`Solution "${solutionName}" contains ${components.length} entity components`);

    if (components.length === 0) return [];

    // Step 3: Resolve MetadataIds to LogicalNames via EntityDefinitions
    // The objectid in solutioncomponents is the MetadataId of the EntityDefinition,
    // NOT the LogicalName. We need an additional query to resolve.
    const metadataIds = components.map((c) => c.objectid);
    const filterClauses = metadataIds.map((id) => `MetadataId eq ${DataverseHttpClient.sanitizeGuid(id)}`);

    // Batch in groups of 15 to avoid excessively long filter strings
    const BATCH_SIZE = 15;
    const logicalNames: string[] = [];

    for (let i = 0; i < filterClauses.length; i += BATCH_SIZE) {
      const batch = filterClauses.slice(i, i + BATCH_SIZE);
      const filter = batch.join(' or ');
      const entities = await this.http.getAll<{ LogicalName: string }>(
        `/EntityDefinitions?$filter=${filter}&$select=LogicalName`,
      );
      for (const e of entities) {
        logicalNames.push(e.LogicalName);
      }
    }

    log.info(`Resolved ${logicalNames.length} entity logical names from solution "${solutionName}"`);

    return logicalNames;
  }

  /**
   * Get all entity LogicalNames from multiple solutions, merged and deduplicated.
   *
   * @param solutionUniqueNames - Array of solution unique names
   * @returns Deduplicated array of entity LogicalNames
   */
  async getEntityNamesForSolutions(solutionUniqueNames: string[]): Promise<string[]> {
    const allNames = new Set<string>();

    for (const name of solutionUniqueNames) {
      const names = await this.getEntityNamesForSolution(name);
      for (const n of names) {
        allNames.add(n);
      }
    }

    const result = [...allNames].sort();
    log.info(`${result.length} unique entities from ${solutionUniqueNames.length} solutions`);
    return result;
  }

  // ─── Aggregated Metadata ───────────────────────────────────────────────

  /**
   * Fetch complete metadata for a single entity: all attributes (typed),
   * forms, and relationships. This is the primary method for type generation.
   *
   * Makes 8 parallel API calls per entity for optimal performance.
   */
  async getEntityTypeInfo(logicalName: string): Promise<EntityTypeInfo> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.info(`Fetching complete type info for: ${safeName}`);

    const [entity, picklistAttributes, multiSelectPicklistAttributes, lookupAttributes, statusAttributes, stateAttributes, forms, relationships] =
      await Promise.all([
        this.getEntityWithAttributes(safeName),
        this.getPicklistAttributes(safeName),
        this.getMultiSelectPicklistAttributes(safeName),
        this.getLookupAttributes(safeName),
        this.getStatusAttributes(safeName),
        this.getStateAttributes(safeName),
        this.getForms(safeName),
        this.getRelationships(safeName),
      ]);

    const result: EntityTypeInfo = {
      entity,
      attributes: entity.Attributes ?? [],
      picklistAttributes,
      multiSelectPicklistAttributes,
      lookupAttributes,
      statusAttributes,
      stateAttributes,
      forms,
      oneToManyRelationships: relationships.oneToMany,
      manyToManyRelationships: relationships.manyToMany,
    };

    log.info(
      `Type info for "${safeName}": ${result.attributes.length} attrs, ` +
        `${picklistAttributes.length} picklists, ${multiSelectPicklistAttributes.length} multi-select, ` +
        `${lookupAttributes.length} lookups, ${stateAttributes.length} state, ${forms.length} forms, ` +
        `${relationships.oneToMany.length} 1:N, ${relationships.manyToMany.length} N:N`,
    );

    return result;
  }

  /**
   * Fetch complete metadata for multiple entities in parallel.
   * Respects the HTTP client's concurrency limit automatically.
   */
  async getMultipleEntityTypeInfos(logicalNames: string[]): Promise<EntityTypeInfo[]> {
    log.info(`Fetching type info for ${logicalNames.length} entities`);
    return Promise.all(logicalNames.map((name) => this.getEntityTypeInfo(name)));
  }

  // ─── Custom API Metadata ───────────────────────────────────────────────

  /**
   * Fetch all Custom APIs with their request parameters and response properties.
   *
   * Queries the customapi, customapirequestparameter, and customapiresponseproperty
   * tables and joins them into CustomApiTypeInfo objects.
   *
   * APIs, request parameters, and response properties are sorted alphabetically
   * by uniquename (ordinal) so the result is deterministic regardless of
   * server row order.
   *
   * @param solutionFilter - Optional: filter by solution unique name
   * @returns Array of complete Custom API definitions
   */
  async getCustomApis(solutionFilter?: string): Promise<CustomApiTypeInfo[]> {
    log.info('Fetching Custom APIs...');

    // 1. Load all Custom APIs
    let apiUrl = '/customapis?$select=uniquename,bindingtype,isfunction,boundentitylogicalname,displayname,description';
    if (solutionFilter) {
      const safeSolution = DataverseHttpClient.sanitizeIdentifier(solutionFilter);
      apiUrl += `&$filter=solutionid/uniquename eq '${safeSolution}'`;
    }

    const apis = await this.http.get<ODataCollection<CustomApiMetadata & { customapiid: string }>>(apiUrl);
    log.info(`Found ${apis.value.length} Custom APIs`);

    if (apis.value.length === 0) return [];

    // 2. Load all request parameters
    const params = await this.http.get<ODataCollection<CustomApiRequestParameter & { _customapiid_value: string }>>(
      '/customapirequestparameters?$select=uniquename,type,isoptional,logicalentityname,description,_customapiid_value',
    );

    // 3. Load all response properties
    const props = await this.http.get<ODataCollection<CustomApiResponseProperty & { _customapiid_value: string }>>(
      '/customapiresponseproperties?$select=uniquename,type,logicalentityname,description,_customapiid_value',
    );

    // 4. Group parameters and properties by Custom API ID
    const paramsByApi = new Map<string, CustomApiRequestParameter[]>();
    for (const p of params.value) {
      const apiId = p._customapiid_value;
      if (!paramsByApi.has(apiId)) paramsByApi.set(apiId, []);
      paramsByApi.get(apiId)!.push({
        uniquename: p.uniquename,
        type: p.type,
        isoptional: p.isoptional,
        logicalentityname: p.logicalentityname,
        description: p.description,
      });
    }

    const propsByApi = new Map<string, CustomApiResponseProperty[]>();
    for (const p of props.value) {
      const apiId = p._customapiid_value;
      if (!propsByApi.has(apiId)) propsByApi.set(apiId, []);
      propsByApi.get(apiId)!.push({
        uniquename: p.uniquename,
        type: p.type,
        logicalentityname: p.logicalentityname,
        description: p.description,
      });
    }

    // 5. Build CustomApiTypeInfo objects (deterministic order, see byUniqueName)
    const result: CustomApiTypeInfo[] = [];
    for (const api of apis.value) {
      result.push({
        api: {
          uniquename: api.uniquename,
          bindingtype: api.bindingtype,
          isfunction: api.isfunction,
          boundentitylogicalname: api.boundentitylogicalname,
          displayname: api.displayname,
          description: api.description,
        },
        requestParameters: (paramsByApi.get(api.customapiid) ?? []).sort(byUniqueName),
        responseProperties: (propsByApi.get(api.customapiid) ?? []).sort(byUniqueName),
      });
    }
    result.sort((a, b) => byUniqueName(a.api, b.api));

    log.info(`Loaded ${result.length} Custom APIs with parameters and response properties`);
    return result;
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────

  private async getRelationships(logicalName: string): Promise<{
    oneToMany: OneToManyRelationshipMetadata[];
    manyToMany: ManyToManyRelationshipMetadata[];
  }> {
    const [oneToMany, manyToMany] = await Promise.all([
      this.getOneToManyRelationships(logicalName),
      this.getManyToManyRelationships(logicalName),
    ]);
    return { oneToMany, manyToMany };
  }
}
