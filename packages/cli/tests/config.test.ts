import { describe, it, expect } from 'vitest';
import { mergeWithCliOptions } from '../src/config.js';

describe('mergeWithCliOptions', () => {
  // ─── actions (boolean) ─────────────────────────────────────────────────────

  it('reads actions from config when the CLI does not set it', () => {
    const merged = mergeWithCliOptions({ actions: true }, {});
    expect(merged['actions']).toBe(true);
  });

  it('lets a CLI --actions value take precedence over config', () => {
    const merged = mergeWithCliOptions({ actions: false }, { actions: true });
    expect(merged['actions']).toBe(true);
  });

  it('leaves actions undefined when neither CLI nor config set it', () => {
    const merged = mergeWithCliOptions({}, {});
    expect(merged['actions']).toBeUndefined();
  });

  // ─── actionsFilter (string) ────────────────────────────────────────────────

  it('reads actionsFilter from config when the CLI does not set it', () => {
    const merged = mergeWithCliOptions({ actionsFilter: 'lm_' }, {});
    expect(merged['actionsFilter']).toBe('lm_');
  });

  it('lets a CLI --actions-filter value take precedence over config', () => {
    const merged = mergeWithCliOptions({ actionsFilter: 'lm_' }, { actionsFilter: 'markant_' });
    expect(merged['actionsFilter']).toBe('markant_');
  });

  // ─── regression: existing fields still merge ───────────────────────────────

  it('still merges existing config fields (output, entities)', () => {
    const merged = mergeWithCliOptions(
      { output: './gen', entities: ['account', 'contact'] },
      {},
    );
    expect(merged['output']).toBe('./gen');
    expect(merged['entities']).toBe('account,contact');
  });
});
