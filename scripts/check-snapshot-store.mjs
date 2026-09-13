import assert from "node:assert/strict";
import { createSnapshotStore, validateSnapshot } from "../src/data/snapshot-store.js";

const url = "https://example.test/data/runtime/gaia-manifest.json";
const mode = { id: "test-mode", signals: { values: [1, null, 0, 1.23456789012345] }, datasets: [] };
const manifest = { schemaVersion: 1, metadata: { title: "fixture" }, chunks: [{ id: mode.id, file: "test-mode.0123456789abcdef.json" }] };
let calls = 0;
const store = createSnapshotStore({ manifestUrl: url, fetchImpl: async target => {
  calls++;
  await new Promise(resolve => setTimeout(resolve, 2));
  return Response.json(target === url ? manifest : mode);
} });
const [first, second] = await Promise.all([store.load(), store.load()]);
assert.equal(calls, 2, "two concurrent consumers share one manifest/chunk load");
assert.equal(first, second, "parsed snapshot is shared");
assert.equal(await store.load(), first, "completed load is reused");
assert.equal(calls, 2);
assert.deepEqual(first.modes[0].signals.values, mode.signals.values);
store.dispose();
await assert.rejects(store.load(), { name: "AbortError" });
let attempts = 0;
const retry = createSnapshotStore({ manifestUrl: url, fetchImpl: async target => {
  if (++attempts === 1) return new Response("offline", { status: 503 });
  return Response.json(target === url ? manifest : mode);
} });
await assert.rejects(retry.load(), /503/);
assert.deepEqual((await retry.load()).modes[0], mode);
const bad = createSnapshotStore({ manifestUrl: url, fetchImpl: async () => Response.json({ ...manifest, chunks: [{ id: mode.id, file: "https://other.test/private.json" }] }) });
await assert.rejects(bad.load(), /chunk path/);
assert.throws(() => validateSnapshot({ modes: [mode, mode] }), /duplicate/);
const abort = createSnapshotStore({ manifestUrl: url, timeoutMs: 5, fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })) });
await assert.rejects(abort.load(), { name: "AbortError" });
console.log("Snapshot store PASS: single-flight fetch and parse, exact values, bounded retry, invalid manifests, timeout and disposal.");

const other = { ...mode, id: "other-mode" }, third = { ...mode, id: "third-mode" };
const partialManifest = { ...manifest, chunks: [mode, other, third].map(m => ({ id: m.id, file: `${m.id}.0123456789abcdef.json` })) };
const requested = [];
const partial = createSnapshotStore({ manifestUrl: url, fetchImpl: async target => {
  requested.push(target);
  await new Promise(resolve => setTimeout(resolve, 2));
  return Response.json(target === url ? partialManifest : [mode, other, third].find(m => target.includes(m.id)));
} });
const one = await partial.loadMode(mode.id);
assert.deepEqual(one.modes, [mode]);
assert.equal(requested.length, 2, "One mode requests only the manifest and its own chunk");
const [whole, sameOther] = await Promise.all([partial.load(), partial.loadMode(other.id)]);
assert.deepEqual(whole.modes, [mode, other, third]);
assert.equal(sameOther.modes[0], whole.modes[1], "Partial and complete consumers share decoded records");
assert.equal(requested.length, 4, "Complete load reuses prior and concurrently loading chunks");
await assert.rejects(partial.loadMode("unknown-mode"), /Unknown GAIA mode/);
assert.equal(requested.length, 4, "Unknown IDs cannot fetch arbitrary paths");
partial.dispose();
await assert.rejects(partial.loadMode(mode.id), { name: "AbortError" });
console.log("Snapshot store PASS: on-demand modes, shared partial/full loads, exact observations, unknown IDs and disposal.");
