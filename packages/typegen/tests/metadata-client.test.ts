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

describe('MetadataClient.getEntityIdsForSolution', () => {
  it('should resolve solution and return entity IDs', async () => {
    // Call 1: solutions query
    // Call 2: solutioncomponents query
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
            { objectid: 'entity-1', componenttype: 1 },
            { objectid: 'entity-2', componenttype: 1 },
          ],
        }),
        text: () => Promise.resolve('{}'),
      });
    vi.stubGlobal('fetch', mockFetch);

    const client = createClient();
    const entityIds = await client.getEntityIdsForSolution('MySolution');

    expect(entityIds).toEqual(['entity-1', 'entity-2']);
  });

  it('should throw META_SOLUTION_NOT_FOUND for unknown solution', async () => {
    mockFetchSequence({ status: 200, body: { value: [] } });

    const client = createClient();

    const error = await client.getEntityIdsForSolution('NonExistent').catch((e: MetadataError) => e);
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
