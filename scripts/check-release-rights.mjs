import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
const review = JSON.parse(fs.readFileSync(path.join(root, "docs/rights-review.json"), "utf8"));
const scopeFiles = ["data/gaia-signals.json", "data/gbif-rights.json", "docs/media-rights-ledger.json", "docs/THIRD_PARTY_INVENTORY.json", "package-lock.json", "sensor-platform/package-lock.json"];
const scope = createHash("sha256");
for (const file of scopeFiles) scope.update(file).update("\0").update(fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n")).update("\0");
const scopeSha256 = scope.digest("hex");
const publishable = new Set(["approved", "owner-accepted"]);
const allowed = new Set([...publishable, "documented-conditions", "evidence-required", "review-required", "excluded"]);
assert.equal(review.schemaVersion, 1);
assert(review.reviews.length >= 6);
assert.equal(new Set(review.reviews.map(row => row.id)).size, review.reviews.length);
for (const id of ["gosat", "unesco", "gbif", "jaxa-fnf-image", "generated-images-music", "remaining-data-and-software"]) assert(review.reviews.some(row => row.id === id), `required review missing: ${id}`);
for (const row of review.reviews) {
  assert(allowed.has(row.status), row.id);
  assert(row.requiredAction && row.evidence && fs.existsSync(path.join(root, row.evidence)), row.id);
  if (publishable.has(row.status) || row.status === "excluded") assert(row.decisionEvidence && row.decidedBy && row.decidedAt, `a documented owner decision is required: ${row.id}`);
  if (row.status === "owner-accepted") {
    assert(typeof row.decisionBasis === "string" && row.decisionBasis.trim(), `an owner decision basis is required: ${row.id}`);
    assert.equal(row.providerPermissionVerified, false, `owner acceptance must not be represented as verified provider permission: ${row.id}`);
  }
  if (publishable.has(row.status)) {
    assert.equal(row.scopeSha256, scopeSha256, `review must cover the current data/material/dependency scope: ${row.id}`);
    const evidence = path.resolve(root, row.decisionEvidence);
    assert(evidence.startsWith(`${root}${path.sep}`) && fs.existsSync(evidence) && fs.statSync(evidence).isFile(), `decision evidence file missing: ${row.id}`);
    if (row.excludedPaths) {
      assert(Array.isArray(row.excludedPaths) && row.excludedPaths.length, `excluded paths are required: ${row.id}`);
      const media = JSON.parse(fs.readFileSync(path.join(root, "docs/media-rights-ledger.json"), "utf8")).assets || [];
      for (const file of row.excludedPaths) {
        const target = path.resolve(root, file);
        assert(target.startsWith(`${root}${path.sep}`) && !fs.existsSync(target), `excluded public file must be absent: ${file}`);
        assert(!media.some(asset => path.resolve(root, asset.path) === target), `excluded public file must not remain in the media ledger: ${file}`);
      }
    }
  }
}
// "Excluded" alone cannot unblock publication: the owner must first remove
// the affected screen/direct files, verify the clean tree and record its decision.
// Owner acceptance clears the operational hold, not the provider's legal terms.
const unresolved = review.reviews.filter(row => !publishable.has(row.status));
const validationOnly = process.argv.includes("--validate");
console.log(JSON.stringify({ status: validationOnly ? "valid-register" : unresolved.length ? "release-blocked" : "release-cleared", scopeSha256, ownerAccepted: review.reviews.filter(row => row.status === "owner-accepted").map(({ id, decisionBasis, providerPermissionVerified }) => ({ id, decisionBasis, providerPermissionVerified })), unresolved: unresolved.map(({ id, status, requiredAction }) => ({ id, status, requiredAction })), localImplementationAllowed: true }, null, 2));
if (!validationOnly && unresolved.length) process.exitCode = 1;
