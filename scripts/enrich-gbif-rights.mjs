import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { extractGbifRights, gbifRightsComplete } from "./lib/gbif-rights.mjs";

const root = path.resolve(import.meta.dirname, "..");
const snapshotPath = path.join(root, "data/gaia-signals.json");
const output = path.join(root, "data/gbif-rights.json");
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const mode = snapshot.modes.find(mode => mode.id === "pollination-protocol");
const rows = mode.signals.occurrences;
const fetchMode = process.argv.includes("--fetch");
if (!fetchMode) {
  const ledger = JSON.parse(fs.readFileSync(output, "utf8"));
  for (const row of rows) {
    assert.ok(gbifRightsComplete(row), `GBIF occurrence ${row.key}: missing license or source metadata`);
    assert.ok(ledger.records.some(record => record.key === row.key && record.datasetKey === row.datasetKey && record.license === row.license), `GBIF occurrence ${row.key}: evidence missing`);
    assert.ok(ledger.datasets.some(dataset => dataset.key === row.datasetKey && dataset.title && dataset.citation), `GBIF occurrence ${row.key}: dataset citation missing`);
  }
  console.log(JSON.stringify({ status: "passed", records: rows.length, datasets: ledger.datasets.length }));
} else {
  const json = async url => {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`GBIF metadata HTTP ${response.status}: ${url}`);
    return response.json();
  };
  const records = new Array(rows.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < rows.length) {
      const index = cursor++, row = rows[index];
      const source = await json(`https://api.gbif.org/v1/occurrence/${row.key}`);
      assert.equal(source.key, row.key);
      const rights = extractGbifRights(source);
      assert.ok(gbifRightsComplete(rights), `GBIF record ${row.key} has incomplete or unsupported licensing; keep pending`);
      records[index] = { key: row.key, ...rights };
    }
  }));
  const datasets = [];
  for (const key of [...new Set(records.map(record => record.datasetKey))].sort()) {
    const dataset = await json(`https://api.gbif.org/v1/dataset/${key}`);
    assert.ok(dataset.title);
    const citation = typeof dataset.citation === "string" ? dataset.citation : dataset.citation?.text;
    datasets.push({ key, title: dataset.title, license: dataset.license || null,
      publishingOrganizationKey: dataset.publishingOrganizationKey || null,
      doi: dataset.doi || null, citation: citation || `${dataset.title}. GBIF dataset ${key}. https://www.gbif.org/dataset/${key}`,
      citationIsProviderSupplied: Boolean(citation), url: `https://www.gbif.org/dataset/${key}` });
  }
  const ledger = { schemaVersion: 1, retrievedAt: new Date().toISOString(), purpose: "Attribution metadata for the existing unchanged occurrence selection; not a fresh occurrence download", records, datasets };
  const byKey = new Map(records.map(record => [record.key, record]));
  const enrich = row => ({ ...row, ...byKey.get(row.key) });
  mode.signals.occurrences = rows.map(enrich);
  const preview = mode.datasets.find(dataset => dataset.id === "gbif")?.preview;
  if (Array.isArray(preview)) mode.datasets.find(dataset => dataset.id === "gbif").preview = preview.map(enrich);
  for (let index = 0; index < rows.length; index++) {
    for (const [key, value] of Object.entries(rows[index])) assert.deepEqual(mode.signals.occurrences[index][key], value, `original occurrence ${rows[index].key}/${key} changed`);
  }
  // No writes until every selected occurrence has a valid license and source ID.
  fs.writeFileSync(output, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(JSON.stringify({ status: "enriched", records: records.length, datasets: datasets.length, originalObservationsPreserved: true }));
}
