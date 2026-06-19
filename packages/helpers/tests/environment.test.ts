import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getEnvironmentVariable,
  clearEnvironmentVariableCache,
} from '../src/environment.js';

const retrieveMultipleRecords = vi.fn();

beforeEach(() => {
  clearEnvironmentVariableCache();
  retrieveMultipleRecords.mockReset();
  (globalThis as Record<string, unknown>).Xrm = { WebApi: { retrieveMultipleRecords } };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).Xrm;
});

describe('getEnvironmentVariable', () => {
  it('returns the current value when one is set', async () => {
    retrieveMultipleRecords.mockResolvedValue({
      entities: [
        {
          defaultvalue: 'def',
          environmentvariabledefinition_environmentvariablevalue: [{ value: 'current' }],
        },
      ],
    });

    const value = await getEnvironmentVariable('new_FlowUrl');

    expect(value).toBe('current');
    expect(retrieveMultipleRecords).toHaveBeenCalledWith(
      'environmentvariabledefinition',
      expect.stringContaining("schemaname eq 'new_FlowUrl'"),
    );
  });

  it('falls back to the default value when no current value exists', async () => {
    retrieveMultipleRecords.mockResolvedValue({
      entities: [{ defaultvalue: 'def', environmentvariabledefinition_environmentvariablevalue: [] }],
    });

    expect(await getEnvironmentVariable('new_X')).toBe('def');
  });

  it('treats an empty current value as absent and uses the default', async () => {
    retrieveMultipleRecords.mockResolvedValue({
      entities: [
        {
          defaultvalue: 'def',
          environmentvariabledefinition_environmentvariablevalue: [{ value: '' }],
        },
      ],
    });

    expect(await getEnvironmentVariable('new_X')).toBe('def');
  });

  it('returns null when the definition is not found', async () => {
    retrieveMultipleRecords.mockResolvedValue({ entities: [] });

    expect(await getEnvironmentVariable('missing')).toBeNull();
  });

  it('caches per schema name (one query per name)', async () => {
    retrieveMultipleRecords.mockResolvedValue({
      entities: [{ environmentvariabledefinition_environmentvariablevalue: [{ value: 'v' }] }],
    });

    await getEnvironmentVariable('new_Cached');
    await getEnvironmentVariable('new_Cached');

    expect(retrieveMultipleRecords).toHaveBeenCalledTimes(1);
  });

  it('caches null results too (no re-query for a known-missing variable)', async () => {
    retrieveMultipleRecords.mockResolvedValue({ entities: [] });

    expect(await getEnvironmentVariable('absent')).toBeNull();
    expect(await getEnvironmentVariable('absent')).toBeNull();

    expect(retrieveMultipleRecords).toHaveBeenCalledTimes(1);
  });

  it('escapes single quotes in the schema name (OData injection defense)', async () => {
    retrieveMultipleRecords.mockResolvedValue({ entities: [] });

    await getEnvironmentVariable("new_O'Brien");

    expect(retrieveMultipleRecords).toHaveBeenCalledWith(
      'environmentvariabledefinition',
      expect.stringContaining("schemaname eq 'new_O''Brien'"),
    );
  });

  it('propagates WebApi errors (no swallow)', async () => {
    retrieveMultipleRecords.mockRejectedValue(new Error('boom'));

    await expect(getEnvironmentVariable('new_Err')).rejects.toThrow('boom');
  });
});
