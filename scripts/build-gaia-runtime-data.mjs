import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateSnapshot } from "../src/data/snapshot-store.js";

const root = path.resolve(import.meta.dirname, "..");
const input = fs.readFileSync(path.join(root, "data/gaia-signals.json"));
const snapshot = validateSnapshot(JSON.parse(input));
const directory = path.join(root, "data/runtime");
const checkOnly = process.argv.includes("--check");
const { modes, ...metadata } = snapshot;
const chunks = modes.map(mode => {
  const body = `${JSON.stringify(mode)}\n`;
  const sha256 = createHash("sha256").update(body).digest("hex");
  return { id: mode.id, file: `${mode.id}.${sha256.slice(0, 16)}.json`, sha256, bytes: Buffer.byteLength(body), body };
});
const manifest = { schemaVersion: 1, sourceSha256: createHash("sha256").update(input.toString("utf8").replace(/\r\n/g, "\n")).digest("hex"), metadata, chunks: chunks.map(({ body, ...entry }) => entry) };
const outputs = [...chunks.map(({ file, body }) => [file, body]), ["gaia-manifest.json", `${JSON.stringify(manifest)}\n`]];
if (!checkOnly) fs.mkdirSync(directory, { recursive: true });
const expected = new Set(outputs.map(([file]) => file));
for (const file of fs.readdirSync(directory)) {
  if (expected.has(file)) continue;
  assert.match(file, /^[a-z0-9-]+\.[a-f0-9]{16}\.json$/, "unexpected file in generated runtime folder");
  const target = path.resolve(directory, file);
  assert.equal(path.dirname(target), directory, "runtime cleanup must stay inside generated data folder");
  if (checkOnly) throw new Error(`Obsolete runtime chunk: ${file}`);
  fs.unlinkSync(target);
}
for (const [file, body] of outputs) {
  const target = path.join(directory, file);
  if (checkOnly) assert.equal(fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n"), body, `stale runtime data: ${file}`);
  else fs.writeFileSync(target, body);
}
// Exact round-trip equivalence: no rounding, sample removal, or missing-value conversion.
assert.deepEqual(validateSnapshot({ ...manifest.metadata, modes: chunks.map(chunk => JSON.parse(chunk.body)) }), snapshot);
console.log(JSON.stringify({ status: checkOnly ? "passed" : "generated", sourceBytes: input.length, runtimeBytes: outputs.reduce((total, [, body]) => total + Buffer.byteLength(body), 0), chunks: chunks.length, lossless: true }));
