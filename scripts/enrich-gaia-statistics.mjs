import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichSnapshotWithStatistics } from "./statistics.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const snapshotPath = resolve(scriptDirectory, "..", "data", "gaia-signals.json");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const enriched = enrichSnapshotWithStatistics(snapshot);
await writeFile(snapshotPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");

const breathing = enriched.modes.find((mode) => mode.id === "breathing-earth");
const waste = enriched.modes.find((mode) => mode.id === "nothing-is-waste");
const observedCells = breathing.signals.gosat.frames.reduce((sum, frame) => sum + frame.observedCells, 0);
const imputedCells = breathing.signals.gosat.frames.reduce((sum, frame) => sum + frame.imputedCells, 0);
const imputedWaste = waste.signals.countryWaste.filter((row) => row.valueStatus === "IMPUTED").length;
console.log(`Statistical layer written: GOSAT ${observedCells} observed + ${imputedCells} imputed cells; waste ${imputedWaste} imputed countries.`);
