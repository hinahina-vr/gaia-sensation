import { readFile, writeFile } from "node:fs/promises";
import { fetchCountryCoverage, applyCountryCoverage } from "./country-coverage-data.mjs";
import { applyEcologiesReadingMetadata } from "./update-ecologies-reading-data.mjs";
import { applyRecyclingSupplement } from "./recycling-coverage-data.mjs";

const snapshotUrl = new URL("../data/gaia-signals.json", import.meta.url);
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
const geography = JSON.parse(await readFile(new URL("../data/natural-earth-50m-countries.geojson", import.meta.url), "utf8"));
const referenceSites = snapshot.modes.find(mode => mode.id === "earth-organ").signals.potential;
const data = await fetchCountryCoverage(geography, referenceSites, {
  cacheDirectory: new URL(`../artifacts/country-coverage-source-${new Date().toISOString().slice(0, 10)}/`, import.meta.url),
});
applyCountryCoverage(snapshot, data);
applyRecyclingSupplement(snapshot.modes.find(mode => mode.id === "nothing-is-waste"),
  JSON.parse(await readFile(new URL("../data/worldbank-waste-recycling-source.json", import.meta.url), "utf8")), data.catalog);
applyEcologiesReadingMetadata(snapshot.modes.find(mode => mode.id === "three-ecologies"));
await writeFile(snapshotUrl, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log("Expanded MAP 07, 08, 09, 10, 12; unrelated modes and snapshot timestamps preserved.");
