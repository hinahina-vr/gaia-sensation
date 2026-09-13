import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const [html, ledgerSource, statisticsLabSource, snapshotText] = await Promise.all([
  readFile(resolve(projectDirectory, "index.html"), "utf8"),
  readFile(resolve(projectDirectory, "data-ledger.js"), "utf8"),
  readFile(resolve(projectDirectory, "statistics-lab.js"), "utf8"),
  readFile(resolve(projectDirectory, "data", "gaia-signals.json"), "utf8"),
]);

const requiredIds = [...ledgerSource.matchAll(/getRequiredElement\("([^\"]+)"\)/g)].map(
  (match) => match[1],
);
const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));
if (missingIds.length) throw new Error(`Missing data-ledger DOM ids: ${missingIds.join(", ")}`);

const removedDownloadMarkers = [
  "gaia-statistics-export-csv",
  "gaia-statistics-export-json",
  "gaia-statistics-export-png",
  "createExportReport",
  "downloadBlob",
  "exportCsv",
  "exportJson",
  "exportPng",
];
const remainingDownloadMarkers = removedDownloadMarkers.filter((marker) => html.includes(marker) || statisticsLabSource.includes(marker));
if (remainingDownloadMarkers.length) {
  throw new Error(`Statistics external-data download functionality returned: ${remainingDownloadMarkers.join(", ")}`);
}
if (!html.includes("分析結果は画面内表示のみです")) {
  throw new Error("Statistics screen-only disclosure is missing");
}

const snapshot = JSON.parse(snapshotText);
const breathing = snapshot.modes.find((mode) => mode.id === "breathing-earth");
if (!breathing?.signals?.gosat?.frames?.length) throw new Error("GOSAT frames are missing");
for (const frame of breathing.signals.gosat.frames) {
  if (frame.values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Unfilled GOSAT frame: ${frame.date}`);
  }
  if (frame.observedCells + frame.imputedCells !== frame.values.length) {
    throw new Error(`GOSAT provenance count mismatch: ${frame.date}`);
  }
  if (frame.imputedIndices.some((index) => !Number.isFinite(frame.values[index]))) {
    throw new Error(`Invalid imputed GOSAT index: ${frame.date}`);
  }
  if (!Number.isFinite(frame.imputation?.validation?.rmsePpm)) {
    throw new Error(`Missing GOSAT validation error: ${frame.date}`);
  }
}

const forecast = breathing.signals.co2ForecastModel;
if (
  forecast?.trainingMonths !== 120 ||
  !Number.isFinite(forecast.slopePpmYear) ||
  !Number.isFinite(forecast.rSquared) ||
  !Number.isFinite(forecast.residualStandardErrorPpm)
) {
  throw new Error("OLS forecast metadata is incomplete");
}

const waste = snapshot.modes.find((mode) => mode.id === "nothing-is-waste")?.signals?.countryWaste || [];
const sourceWaste = waste.filter((row) => row.valueStatus === "SOURCE");
const imputedWaste = waste.filter((row) => row.valueStatus === "IMPUTED");
if (waste.length < 90 || sourceWaste.length !== waste.length || imputedWaste.length !== 0) {
  throw new Error("Global recycling coverage must retain at least 90 source-only country values, without neighbor imputation");
}
if (imputedWaste.some((row) => row.donorIso3?.length !== 5)) {
  throw new Error("Every imputed waste row must disclose five donors");
}

console.log(
  `Statistics check passed: ${breathing.signals.gosat.frames.length} complete GOSAT frames; ` +
    `${sourceWaste.length} SOURCE + ${imputedWaste.length} IMPUTED waste regions; ` +
    `OLS beta1=${forecast.slopePpmYear} ppm/year; file export disabled.`,
);
