import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { OBSERVATION_CITIES } from "../src/exploration/observation-cities.js";

// Generate the offline preview from the exact same parser and public upstream
// requests as the Worker. Never generate or interpolate missing model values.
const require = createRequire(new URL("../sensor-platform/package.json", import.meta.url));
const ts = require("typescript");
const source = await fs.readFile(new URL("../sensor-platform/src/prefecture-field.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { fetchPrefectureField } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const cities = OBSERVATION_CITIES.map(({ id, name, lat, lon }) => ({ id, name, lat, lon }));
const [weather, air] = await Promise.all(["weather", "air"].map(async provider => ({
  ...await fetchPrefectureField(provider, cities), source: "snapshot",
})));
const snapshot = { schemaVersion: 1, scope: "japan-prefectures", targetCount: 47, weather, air };
await fs.writeFile(new URL("../data/live-prefecture-fallback-v1.json", import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ saved: "data/live-prefecture-fallback-v1.json", weather: weather.generatedAt, air: air.generatedAt,
  counts: Object.fromEntries([weather, air].flatMap(field => Object.keys(field.points[0].measurements)
    .map(key => [key, field.points.filter(point => Number.isFinite(point.measurements[key])).length]))) }));
