import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
export const readAnnualPart = file => {
  const buffer = fs.readFileSync(path.resolve('data', file));
  return JSON.parse(file.endsWith('.gz') ? gunzipSync(buffer) : buffer);
};
export const readAnnualSnapshot = file => {
  const data = JSON.parse(fs.readFileSync(path.resolve('data', file)));
  if (data.schemaVersion === 2) data.periods = data.periods.map(p => readAnnualPart(p.file));
  return data;
};
