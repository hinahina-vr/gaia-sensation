import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENTRY_BUDGET_BYTES, assertEntryBudget } from './lib/contest-entry-budget.mjs';

test('initial-load policy uses the approved decimal 2 MB limit', () => {
  assert.equal(ENTRY_BUDGET_BYTES, 2_000_000);
  for (const bytes of [0, 1_000_000, 1_680_000, 1_855_628, 1_999_999, 2_000_000]) {
    assert.doesNotThrow(() => assertEntryBudget(bytes, 'initial payload'));
  }
});

test('capacity checks still reject one byte over budget and larger payloads', () => {
  for (const bytes of [2_000_001, 2_097_152, 3_000_000]) {
    assert.throws(() => assertEntryBudget(bytes, 'initial payload'), {
      code: 'ERR_ASSERTION', message: `initial payload: ${bytes} bytes exceeds 2000000 bytes (2 MB)`,
    });
  }
});

test('missing or invalid measurements cannot silently pass the gate', () => {
  for (const bytes of [undefined, null, NaN, Infinity, -1, 1.5, '1680000']) {
    assert.throws(() => assertEntryBudget(bytes, 'initial payload'), /invalid byte count/);
  }
});
