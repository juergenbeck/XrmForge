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
  EntityMetadata,
  PicklistAttributeMetadata,
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

/** Dataverse SolutionComponent type code for Entity */
const COMPONENT_TYPE_ENTITY = 1;

// ─── Select Constants ────────────────────────────────────────────────────────

const ENTITY_SELECT = 'LogicalName,SchemaName,EntitySetName,DisplayName,PrimaryIdAttribute,PrimaryNameAttribute,OwnershipType,IsCustomEntity,LogicalCollectionName,MetadataId';
const ATTRIBUTE_SELECT = 'LogicalName,SchemaName,AttributeType,AttributeTypeName,DisplayName,IsPrimaryId,IsPrimaryName,RequiredLevel,IsValidForRead,IsValidForCreate,IsValidForUpdate,MetadataId';
const FORM_SELECT = 'name,formid,formxml,description,isdefault';

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
   * Get and parse Main forms (type=2) for an entity.
   * Returns parsed form structures with tabs, sections, and controls.
   */
  async getMainForms(logicalName: string): Promise<ParsedForm[]> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.info(`Fetching Main forms for: ${safeName}`);

    const forms = await this.http.getAll<SystemFormMetadata>(
      `/systemforms?$filter=objecttypecode eq '${safeName}' and type eq ${FORM_TYPE_MAIN}&$select=${FORM_SELECT}`,
    );

    log.info(`Found ${forms.length} Main form(s) for "${safeName}"`);

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
          tabs: [],
          allControls: [],
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
   *
   * @param solutionUniqueName - The unique name of the solution
   * @returns Array of entity MetadataIds (use with getEntityWithAttributes)
   */
  async getEntityIdsForSolution(solutionUniqueName: string): Promise<string[]> {
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

    log.info(`Solution "${solutionName}" contains ${components.length} entities`);

    return components.map((c) => c.objectid);
  }

  // ─── Aggregated Metadata ───────────────────────────────────────────────

  /**
   * Fetch complete metadata for a single entity: all attributes (typed),
   * forms, and relationships. This is the primary method for type generation.
   *
   * Makes 7 parallel API calls per entity for optimal performance.
   */
  async getEntityTypeInfo(logicalName: string): Promise<EntityTypeInfo> {
    const safeName = DataverseHttpClient.sanitizeIdentifier(logicalName);

    log.info(`Fetching complete type info for: ${safeName}`);

    const [entity, picklistAttributes, lookupAttributes, statusAttributes, stateAttributes, forms, relationships] =
      await Promise.all([
        this.getEntityWithAttributes(safeName),
        this.getPicklistAttributes(safeName),
        this.getLookupAttributes(safeName),
        this.getStatusAttributes(safeName),
        this.getStateAttributes(safeName),
        this.getMainForms(safeName),
        this.getRelationships(safeName),
      ]);

    const result: EntityTypeInfo = {
      entity,
      attributes: entity.Attributes ?? [],
      picklistAttributes,
      lookupAttributes,
      statusAttributes,
      stateAttributes,
      forms,
      oneToManyRelationships: relationships.oneToMany,
      manyToManyRelationships: relationships.manyToMany,
    };

    log.info(
      `Type info for "${safeName}": ${result.attributes.length} attrs, ` +
        `${picklistAttributes.length} picklists, ${lookupAttributes.length} lookups, ` +
        `${stateAttributes.length} state, ${forms.length} forms, ` +
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
