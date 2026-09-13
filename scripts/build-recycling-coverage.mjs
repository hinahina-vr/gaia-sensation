import assert from "node:assert/strict";
import fs from "node:fs";
import { applyRecyclingSupplement, recyclingCatalog } from "./recycling-coverage-data.mjs";

const file = new URL("../data/gaia-signals.json", import.meta.url);
const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
const original = structuredClone(snapshot);
const source = JSON.parse(fs.readFileSync(new URL("../data/worldbank-waste-recycling-source.json", import.meta.url), "utf8"));
const mode = snapshot.modes.find(row => row.id === "nothing-is-waste");
applyRecyclingSupplement(mode, source, recyclingCatalog(snapshot));
if (process.argv.includes("--check")) assert.deepEqual(snapshot, original, "Recycling supplement is stale");
else fs.writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ status: process.argv.includes("--check") ? "passed" : "generated",
  countryCount: mode.signals.countryWaste.length, sourceCounts: mode.signals.countryCoverage.sourceCounts,
  excluded: mode.signals.countryCoverage.excludedSourceValues.map(row => ({ iso3: row.iso3, reason: row.reason })) }));
