import { readFile, writeFile } from "node:fs/promises";
import { fetchPopulationData, populationDataset } from "./population-data.mjs";

const snapshotUrl = new URL("../data/gaia-signals.json", import.meta.url);
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
const geography = JSON.parse(await readFile(new URL("../data/natural-earth-50m-countries.geojson", import.meta.url), "utf8"));
const population = await fetchPopulationData(geography);
const mode = snapshot.modes.find(mode => mode.id === "population-tide");
if (!mode) throw new Error("Population exhibit is missing");
// Update only this exhibit. Other sources and their retrieval dates stay intact.
mode.signals.population = population.rows;
mode.signals.populationCoverage = population.coverage;
mode.datasets = [populationDataset(population, new Date().toISOString())];
await writeFile(snapshotUrl, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify(population.coverage, null, 2));
