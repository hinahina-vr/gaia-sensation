import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
// Exact development sources at 0bf1d94; keep regression tests reproducible
// in the separate production repository without importing development history.
const baseline=JSON.parse(gunzipSync(fs.readFileSync(new URL('../fixtures/startup-baseline-0bf1d94.json.gz',import.meta.url))));
export const readStartupBaseline=file=>baseline[file];
