import { readFile, writeFile } from "node:fs/promises";
import { fetchRenewableData, renewableDataset } from "./renewable-data.mjs";

const snapshotUrl = new URL("../data/gaia-signals.json", import.meta.url);
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
const geography = JSON.parse(await readFile(new URL("../data/natural-earth-50m-countries.geojson", import.meta.url), "utf8"));
const mode = snapshot.modes.find(mode => mode.id === "earth-organ");
if (!mode) throw new Error("Renewable exhibit is missing");
const renewable = await fetchRenewableData(geography, mode.signals.potential);
// Refresh only the electricity dataset; climate points and every other exhibit stay intact.
mode.signals.current = renewable.rows;
mode.signals.renewableCoverage = renewable.coverage;
mode.datasets = mode.datasets.map(dataset => dataset.id === "worldbank-renewable"
  ? renewableDataset(renewable, new Date().toISOString()) : dataset);
await writeFile(snapshotUrl, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify(renewable.coverage, null, 2));
