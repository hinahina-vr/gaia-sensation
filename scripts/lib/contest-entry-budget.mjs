import assert from 'node:assert/strict';

// Owner-approved initial-load budget. MB is decimal, not MiB.
// Both the conservative source total and browser encoded-body total use it.
export const ENTRY_BUDGET_BYTES = 2_000_000;

export function assertEntryBudget(bytes, measurement) {
  assert(Number.isSafeInteger(bytes) && bytes >= 0, `${measurement}: invalid byte count ${bytes}`);
  assert(bytes <= ENTRY_BUDGET_BYTES,
    `${measurement}: ${bytes} bytes exceeds ${ENTRY_BUDGET_BYTES} bytes (${ENTRY_BUDGET_BYTES / 1_000_000} MB)`);
}
