// Carry original repository dates across a history-free export, bound to bytes.
// This preserves provenance metadata, not a copyright or publication approval.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const validPath = file => typeof file === 'string' && /^assets\//.test(file)
  && !file.includes('\\') && !file.split('/').some(p => !p || p === '.' || p === '..');

export function validateOrigins(snapshot) {
  assert.equal(snapshot.schemaVersion, 1);
  assert.match(snapshot.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(snapshot.sourceLedgerSha256, /^[a-f0-9]{64}$/);
  assert(Array.isArray(snapshot.assets) && snapshot.assets.length > 0);
  const records = new Map();
  for (const row of snapshot.assets) {
    assert(validPath(row.path), 'Origin asset must stay under assets/');
    assert(!records.has(row.path), `Duplicate origin: ${row.path}`);
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
    assert(row.firstRepositoryEvidenceAt === null || (typeof row.firstRepositoryEvidenceAt === 'string'
      && /^\d{4}-\d{2}-\d{2}T/.test(row.firstRepositoryEvidenceAt)
      && Number.isFinite(Date.parse(row.firstRepositoryEvidenceAt))), `Invalid origin date: ${row.path}`);
    records.set(row.path, row);
  }
  return records;
}

export function buildOrigins(sourceCommit, ledgerBytes, readAsset) {
  const text = ledgerBytes.toString('utf8').replace(/\r\n/g, '\n');
  const ledger = JSON.parse(text);
  const snapshot = { schemaVersion: 1, sourceCommit, sourceLedgerSha256: sha256(text),
    assets: ledger.assets.map(({ path, sha256, firstRepositoryEvidenceAt }) => ({ path, sha256, firstRepositoryEvidenceAt })) };
  validateOrigins(snapshot);
  for (const row of snapshot.assets) assert.equal(sha256(readAsset(row.path)), row.sha256,
    `Source ledger is stale; reconcile before export: ${row.path}`);
  return snapshot;
}

export function originalDate(file, hash, gitDate, origins) {
  const origin = origins?.get(file);
  if (!origin) return gitDate || null;
  assert.equal(hash, origin.sha256, `Migrated asset changed; reconcile origin record: ${file}`);
  return origin.firstRepositoryEvidenceAt;
}
