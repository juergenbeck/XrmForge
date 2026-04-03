import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetadataClient } from '../src/metadata/client.js';
import { DataverseHttpClient } from '../src/http/client.js';
import { MetadataError, ErrorCode } from '../src/errors.js';
import { configureLogging, SilentLogSink, ConsoleLogSink, LogLevel } from '../src/logger.js';
import type { TokenCredential, AccessToken, GetTokenOptions } from '@azure/identity';

beforeEach(() => configureLogging({ sink: new SilentLogSink() }));
afterEach(() => {
  configureLogging({ sink: new ConsoleLogSink(), minLevel: LogLevel.INFO });
  vi.unstubAllGlobals();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockCredential(): TokenCredential {
  return {
    getToken: vi.fn<[string | string[], GetTokenOptions?], Promise<AccessToken>>().mockResolvedValue({
      token: 'mock-token',
      expiresOnTimestamp: Date.now() + 60 * 60 * 1000,
    }),
  };
}

function mockFetchSequence(...responses: Array<{ status: number; body: unknown }>): void {
  const mockFetch = vi.fn();
  for (const resp of responses) {
    mockFetch.mockResolvedValueOnce({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      statusText: resp.status === 200 ? 'OK' : 'Error',
      headers: new Headers(),
      json: () => Promise.resolve(resp.body),
      text: () => Promise.resolve(JSON.stringify(resp.body)),
    });
  }
  vi.stubGlobal('fetch', mockFetch);
}

function createClient(): MetadataClient {
  const httpClient = new DataverseHttpClient({
    environmentUrl: 'https://testorg.crm4.dynamics.com',
    credential: createMockCredential(),
    maxRetries: 0,
    retryBaseDelayMs: 1,
    timeoutMs: 5000,
    maxConcurrency: 5,
  });
  return new MetadataClient(httpClient);
}

// ─── Entity Metadata ─────────────────────────────────────────────────────────

describe('MetadataClient.getEntityWithAttributes', () => {
  it('should fetch entity metadata with attributes', async () => {
    const entityResponse = {
      LogicalName: 'account',
      SchemaName: 'Account',
      EntitySetName: 'accounts',
      DisplayName: { UserLocalizedLabel: { Label: 'Account', LanguageCode: 1033 }, LocalizedLabels: [] },
      PrimaryIdAttribute: 'accountid',
      PrimaryNameAttribute: 'name',
      MetadataId: 'abc-123',
      Attributes: [
        {
          LogicalName: 'name',
          SchemaName: 'Name',
          AttributeType: 'String',
          MetadataId: 'attr-1',
        },
        {
          LogicalName: 'accountid',
          SchemaName: 'AccountId',
          AttributeType: 'Uniqueidentifier',
          MetadataId: 'attr-2',
        },
      ],
    };

    mockFetchSequence({ status: 200, body: entityResponse });
    const client = createClient();

    const result = await client.getEntityWithAttributes('account');

    expect(result.LogicalName).toBe('account');
    expect(result.Attributes).toHaveLength(2);
    expect(result.Attributes![0]!.LogicalName).toBe('name');
  });

  it('should sanitize entity name (prevents OData injection)', async () => {
    const client = createClient();

    await expect(client.getEntityWithAttributes("account' OR 1=1--")).rejects.toThrow();
  });
});

// ─── List Entities ───────────────────────────────────────────────────────────

describe('MetadataClient.listEntities', () => {
  it('should list entities without filter', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          { LogicalName: 'account', SchemaName: 'Account', MetadataId: '1' },
          { LogicalName: 'contact', SchemaName: 'Contact', MetadataId: '2' },
        ],
      },
    });

    const client = createClient();
    const entities = await client.listEntities();

    expect(entities).toHaveLength(2);
    expect(entities[0]!.LogicalName).toBe('account');
  });

  it('should pass filter parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ value: [] }),
      text: () => Promise.resolve('{"value":[]}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createClient();
    await client.listEntities('IsCustomEntity eq true');

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('$filter=IsCustomEntity eq true');
  });
});

// ─── Picklist Attributes ─────────────────────────────────────────────────────

describe('MetadataClient.getPicklistAttributes', () => {
  it('should fetch picklist attributes with option sets', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          {
            LogicalName: 'accountcategorycode',
            SchemaName: 'AccountCategoryCode',
            MetadataId: 'p-1',
            OptionSet: {
              Name: 'account_accountcategorycode',
              Options: [
                { Value: 1, Label: { UserLocalizedLabel: { Label: 'Preferred', LanguageCode: 1033 } } },
                { Value: 2, Label: { UserLocalizedLabel: { Label: 'Standard', LanguageCode: 1033 } } },
              ],
            },
            GlobalOptionSet: null,
          },
        ],
      },
    });

    const client = createClient();
    const picklists = await client.getPicklistAttributes('account');

    expect(picklists).toHaveLength(1);
    expect(picklists[0]!.LogicalName).toBe('accountcategorycode');
    expect(picklists[0]!.OptionSet!.Options).toHaveLength(2);
    expect(picklists[0]!.GlobalOptionSet).toBeNull();
  });
});

// ─── Lookup Attributes ───────────────────────────────────────────────────────

describe('MetadataClient.getLookupAttributes', () => {
  it('should fetch lookup attributes with targets', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          {
            LogicalName: 'parentcustomerid',
            SchemaName: 'ParentCustomerId',
            Targets: ['account', 'contact'],
            MetadataId: 'l-1',
          },
        ],
      },
    });

    const client = createClient();
    const lookups = await client.getLookupAttributes('contact');

    expect(lookups).toHaveLength(1);
    expect(lookups[0]!.Targets).toEqual(['account', 'contact']);
  });
});

// ─── Forms ───────────────────────────────────────────────────────────────────

describe('MetadataClient.getMainForms', () => {
  it('should fetch and parse main forms', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          {
            name: 'Account',
            formid: 'form-1',
            formxml: '<form><tabs><tab name="TAB1" id="{guid}"><columns><column><sections><section name="SEC1" id="{guid}"><rows><row><cell id="{c}"><control id="name" classid="{4273EDBD-AC1D-40D3-9FB2-095C621B552D}" datafieldname="name" /></cell></row></rows></section></sections></column></columns></tab></tabs></form>',
            description: null,
            isdefault: true,
          },
        ],
      },
    });

    const client = createClient();
    const forms = await client.getMainForms('account');

    expect(forms).toHaveLength(1);
    expect(forms[0]!.name).toBe('Account');
    expect(forms[0]!.allControls).toHaveLength(1);
    expect(forms[0]!.allControls[0]!.datafieldname).toBe('name');
  });

  it('should handle malformed formxml gracefully', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          {
            name: 'Broken Form',
            formid: 'form-bad',
            formxml: '<form><this-is-not-valid>',
            description: null,
            isdefault: false,
          },
        ],
      },
    });

    const client = createClient();
    const forms = await client.getMainForms('account');

    // Should not throw, returns form with empty controls
    expect(forms).toHaveLength(1);
    expect(forms[0]!.allControls).toHaveLength(0);
  });
});

// ─── Solution Filter ─────────────────────────────────────────────────────────

describe('MetadataClient.getEntityNamesForSolution', () => {
  it('should resolve solution MetadataIds to LogicalNames', async () => {
    // Call 1: solutions query
    // Call 2: solutioncomponents query (returns MetadataId GUIDs)
    // Call 3: EntityDefinitions query (resolves GUIDs to LogicalNames)
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({
          value: [{ solutionid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', uniquename: 'MySolution', friendlyname: 'My Solution' }],
        }),
        text: () => Promise.resolve('{}'),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({
          value: [
            { objectid: '11111111-1111-1111-1111-111111111111', componenttype: 1 },
            { objectid: '22222222-2222-2222-2222-222222222222', componenttype: 1 },
          ],
        }),
        text: () => Promise.resolve('{}'),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({
          value: [
            { LogicalName: 'account' },
            { LogicalName: 'contact' },
          ],
        }),
        text: () => Promise.resolve('{}'),
      });
    vi.stubGlobal('fetch', mockFetch);

    const client = createClient();
    const entityNames = await client.getEntityNamesForSolution('MySolution');

    expect(entityNames).toEqual(['account', 'contact']);
    // Verify 3 API calls were made
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should throw META_SOLUTION_NOT_FOUND for unknown solution', async () => {
    mockFetchSequence({ status: 200, body: { value: [] } });

    const client = createClient();

    const error = await client.getEntityNamesForSolution('NonExistent').catch((e: MetadataError) => e);
    expect(error).toBeInstanceOf(MetadataError);
    expect(error.code).toBe(ErrorCode.META_SOLUTION_NOT_FOUND);
  });
});

// ─── Global OptionSets ───────────────────────────────────────────────────────

describe('MetadataClient.getGlobalOptionSet', () => {
  it('should fetch a global option set by name', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        Name: 'incident_caseorigincode',
        OptionSetType: 'Picklist',
        IsGlobal: true,
        Options: [
          { Value: 1, Label: { UserLocalizedLabel: { Label: 'Phone', LanguageCode: 1033 } } },
          { Value: 2, Label: { UserLocalizedLabel: { Label: 'Email', LanguageCode: 1033 } } },
        ],
        MetadataId: 'os-1',
      },
    });

    const client = createClient();
    const optionSet = await client.getGlobalOptionSet('incident_caseorigincode');

    expect(optionSet.Name).toBe('incident_caseorigincode');
    expect(optionSet.Options).toHaveLength(2);
  });
});

// ─── State Attributes (R4-10) ────────────────────────────────────────────────

describe('MetadataClient.getStateAttributes', () => {
  it('should fetch state attributes with option sets', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          {
            LogicalName: 'statecode',
            SchemaName: 'StateCode',
            MetadataId: 'state-1',
            OptionSet: {
              Options: [
                { Value: 0, Label: { UserLocalizedLabel: { Label: 'Active', LanguageCode: 1033 } } },
                { Value: 1, Label: { UserLocalizedLabel: { Label: 'Inactive', LanguageCode: 1033 } } },
              ],
            },
          },
        ],
      },
    });

    const client = createClient();
    const stateAttrs = await client.getStateAttributes('account');

    expect(stateAttrs).toHaveLength(1);
    expect(stateAttrs[0]!.LogicalName).toBe('statecode');
    expect(stateAttrs[0]!.OptionSet!.Options).toHaveLength(2);
  });
});

// ─── Relationships (R4-12) ───────────────────────────────────────────────────

describe('MetadataClient.getOneToManyRelationships', () => {
  it('should fetch 1:N relationships', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          {
            SchemaName: 'account_primary_contact',
            ReferencingEntity: 'contact',
            ReferencingAttribute: 'parentcustomerid',
            ReferencedEntity: 'account',
            ReferencedAttribute: 'accountid',
            MetadataId: 'rel-1',
          },
        ],
      },
    });

    const client = createClient();
    const rels = await client.getOneToManyRelationships('account');

    expect(rels).toHaveLength(1);
    expect(rels[0]!.ReferencingEntity).toBe('contact');
  });
});

describe('MetadataClient.getManyToManyRelationships', () => {
  it('should fetch N:N relationships', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          {
            SchemaName: 'account_contacts',
            Entity1LogicalName: 'account',
            Entity2LogicalName: 'contact',
            IntersectEntityName: 'accountcontact',
            MetadataId: 'nn-1',
          },
        ],
      },
    });

    const client = createClient();
    const rels = await client.getManyToManyRelationships('account');

    expect(rels).toHaveLength(1);
    expect(rels[0]!.IntersectEntityName).toBe('accountcontact');
  });
});

// ─── List Global OptionSets (R4-13) ──────────────────────────────────────────

describe('MetadataClient.listGlobalOptionSets', () => {
  it('should list all global option sets', async () => {
    mockFetchSequence({
      status: 200,
      body: {
        value: [
          { Name: 'incident_caseorigincode', OptionSetType: 'Picklist', IsGlobal: true, MetadataId: 'g-1' },
          { Name: 'markant_sourcesystemlist', OptionSetType: 'Picklist', IsGlobal: true, MetadataId: 'g-2' },
        ],
      },
    });

    const client = createClient();
    const optionSets = await client.listGlobalOptionSets();

    expect(optionSets).toHaveLength(2);
    expect(optionSets[0]!.Name).toBe('incident_caseorigincode');
  });
});

// ─── Aggregated getEntityTypeInfo (R4-11) ────────────────────────────────────

describe('MetadataClient.getEntityTypeInfo', () => {
  it('should aggregate all metadata in parallel', async () => {
    // 7 parallel API calls: entity+attrs, picklists, lookups, status, state, forms, relationships (2 calls)
    // The HTTP client makes these in order due to concurrency, but they're all Promise.all'd
    const mockFetch = vi.fn()
      // Call 1: getEntityWithAttributes
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({
          LogicalName: 'account', SchemaName: 'Account', EntitySetName: 'accounts',
          DisplayName: { UserLocalizedLabel: { Label: 'Account', LanguageCode: 1033 }, LocalizedLabels: [] },
          PrimaryIdAttribute: 'accountid', PrimaryNameAttribute: 'name', MetadataId: 'e-1',
          Attributes: [
            { LogicalName: 'name', SchemaName: 'Name', AttributeType: 'String', MetadataId: 'a-1',
              IsValidForRead: true, IsValidForCreate: true, IsValidForUpdate: true },
          ],
        }),
        text: () => Promise.resolve('{}'),
      })
      // Call 2: getPicklistAttributes
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({ value: [{ LogicalName: 'accountcategorycode', MetadataId: 'p-1' }] }),
        text: () => Promise.resolve('{}'),
      })
      // Call 3: getLookupAttributes
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({ value: [{ LogicalName: 'primarycontactid', Targets: ['contact'], MetadataId: 'l-1' }] }),
        text: () => Promise.resolve('{}'),
      })
      // Call 4: getStatusAttributes
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({ value: [{ LogicalName: 'statuscode', MetadataId: 's-1' }] }),
        text: () => Promise.resolve('{}'),
      })
      // Call 5: getStateAttributes
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({ value: [{ LogicalName: 'statecode', MetadataId: 'st-1' }] }),
        text: () => Promise.resolve('{}'),
      })
      // Call 6: getMainForms
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({ value: [] }),
        text: () => Promise.resolve('{}'),
      })
      // Call 7: getOneToManyRelationships
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({ value: [{ SchemaName: 'account_contacts', MetadataId: 'r-1' }] }),
        text: () => Promise.resolve('{}'),
      })
      // Call 8: getManyToManyRelationships
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({ value: [] }),
        text: () => Promise.resolve('{}'),
      });
    vi.stubGlobal('fetch', mockFetch);

    const client = createClient();
    const info = await client.getEntityTypeInfo('account');

    expect(info.entity.LogicalName).toBe('account');
    expect(info.attributes).toHaveLength(1);
    expect(info.picklistAttributes).toHaveLength(1);
    expect(info.lookupAttributes).toHaveLength(1);
    expect(info.statusAttributes).toHaveLength(1);
    expect(info.stateAttributes).toHaveLength(1);
    expect(info.forms).toHaveLength(0);
    expect(info.oneToManyRelationships).toHaveLength(1);
    expect(info.manyToManyRelationships).toHaveLength(0);

    // Should have made 8 fetch calls (7 parallel via Promise.all, relationships = 2 sub-calls)
    expect(mockFetch).toHaveBeenCalledTimes(8);
  });
});

// ─── Custom APIs (R6-01) ────────────────────────────────────────────────────

describe('MetadataClient.getCustomApis', () => {
  it('should fetch and join Custom APIs with parameters and properties', async () => {
    const mockFetch = vi.fn()
      // Call 1: customapis
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({
          value: [
            { customapiid: 'api-1', uniquename: 'markant_test', bindingtype: 0, isfunction: false, boundentitylogicalname: null, displayname: 'Test', description: '' },
          ],
        }),
        text: () => Promise.resolve('{}'),
      })
      // Call 2: customapirequestparameters
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({
          value: [
            { _customapiid_value: 'api-1', uniquename: 'Input', type: 10, isoptional: false, logicalentityname: null, description: 'Input param' },
          ],
        }),
        text: () => Promise.resolve('{}'),
      })
      // Call 3: customapiresponseproperties
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({
          value: [
            { _customapiid_value: 'api-1', uniquename: 'Output', type: 10, logicalentityname: null, description: 'Output prop' },
          ],
        }),
        text: () => Promise.resolve('{}'),
      });
    vi.stubGlobal('fetch', mockFetch);

    const client = createClient();
    const apis = await client.getCustomApis();

    expect(apis).toHaveLength(1);
    expect(apis[0]!.api.uniquename).toBe('markant_test');
    expect(apis[0]!.requestParameters).toHaveLength(1);
    expect(apis[0]!.requestParameters[0]!.uniquename).toBe('Input');
    expect(apis[0]!.responseProperties).toHaveLength(1);
    expect(apis[0]!.responseProperties[0]!.uniquename).toBe('Output');
  });

  it('should return empty array when no Custom APIs exist', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers(),
        json: () => Promise.resolve({ value: [] }),
        text: () => Promise.resolve('{}'),
      });
    vi.stubGlobal('fetch', mockFetch);

    const client = createClient();
    const apis = await client.getCustomApis();

    expect(apis).toHaveLength(0);
    // Should only make 1 call (short-circuit when no APIs)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Multiple Entity Type Infos ─────────────────────────────────────────────

describe('MetadataClient.getMultipleEntityTypeInfos', () => {
  it('should fetch type info for multiple entities in parallel', async () => {
    // Need 2x8 calls (one per entity, each with 8 sub-calls)
    const makeEntityResponses = (name: string) => [
      { ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ LogicalName: name, SchemaName: name, EntitySetName: name + 's', DisplayName: { LocalizedLabels: [] }, PrimaryIdAttribute: name + 'id', PrimaryNameAttribute: 'name', MetadataId: 'e', Attributes: [] }), text: () => Promise.resolve('{}') },
      { ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ value: [] }), text: () => Promise.resolve('{}') },
      { ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ value: [] }), text: () => Promise.resolve('{}') },
      { ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ value: [] }), text: () => Promise.resolve('{}') },
      { ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ value: [] }), text: () => Promise.resolve('{}') },
      { ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ value: [] }), text: () => Promise.resolve('{}') },
      { ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ value: [] }), text: () => Promise.resolve('{}') },
      { ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({ value: [] }), text: () => Promise.resolve('{}') },
    ];

    const mockFetch = vi.fn();
    for (const resp of [...makeEntityResponses('account'), ...makeEntityResponses('contact')]) {
      mockFetch.mockResolvedValueOnce(resp);
    }
    vi.stubGlobal('fetch', mockFetch);

    const client = createClient();
    const results = await client.getMultipleEntityTypeInfos(['account', 'contact']);

    expect(results).toHaveLength(2);
    expect(results[0]!.entity.LogicalName).toBe('account');
    expect(results[1]!.entity.LogicalName).toBe('contact');
  });
});
