import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = [
  'mode-entry-guide.js', 'mode-feature-intro.css', 'app.js', 'sensors/sensor-platform.js',
  'gaia-mode-loader.js', 'index.html', 'sensors/index.html', 'navigation-controls.css',
  'data-journey.js', 'map-ui-grid-polish.css', 'realtime-exhibits.css',
  'src/exploration/index.js', 'src/exploration/realtime-exhibit-status.js',
  'src/exploration/live-exhibits.js', 'src/exploration/firms-exhibit.js',
  'src/exploration/planet-signals-exhibit.js',
];
const reports = [
  ['artifacts/feature-intro/report.json', 'passed'],
  ['artifacts/feature-intro-guide-regression/report.json', 'passed'],
  ['artifacts/map-header-cleanup-before/report.json', 'reproduced'],
  ['artifacts/map-header-cleanup-after/report.json', 'passed'],
  ['artifacts/feature-intro-live-red/report.json', 'passed'],
  ['artifacts/realtime-status/report.json', 'passed'],
  ['artifacts/sensor-onboarding/regression-report.json', 'passed'],
].map(([file, expected]) => {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(report.status, expected, file);
  return { file, status: report.status, sha256: hash(file), writtenAt: fs.statSync(file).mtime.toISOString() };
});
const feature = JSON.parse(fs.readFileSync(reports[0].file, 'utf8'));
for (const [file, expected] of Object.entries(feature.sha256)) assert.equal(hash(file), expected, `${file}: changed after the final feature test`);
assert.equal(feature.checks.length, 14);
const output = path.resolve('artifacts/feature-intro-final');
fs.mkdirSync(output, { recursive: true });
const manifest = {
  recordedAt: new Date().toISOString(),
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source: 'Uncommitted local working tree, not a published build',
  scope: 'Feature introductions, top-only header restoration, red readout LIVE badges and clean map headings; 2026-09-08',
  sourceSha256: Object.fromEntries(sources.map(file => [file, hash(file)])),
  reports,
  validationSequence: 'The six-size seven-step guide regression passed after feature implementation. Header, title and badge cleanup followed without changing guide logic. Final entry/replay tests were rerun at six sizes after the cleanup and cache-key updates, plus sensor login/devices landings. Four-size header regression and five-size realtime layouts were rerun on those final files. Sensor onboarding/save flows passed on the final sensor code. Full npm check, map-guide/demo and realtime-state unit checks, CSP and diff whitespace checks passed; see the accompanying document for scope.',
  limitations: 'Local Chrome desktop/mobile emulation; local sensor and external-data fixtures. No physical phones, Safari, physical ESP32, production API writes, live-provider verification, push/deployment or distribution ZIP.',
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ status: 'recorded', sources: sources.length, reports: reports.length, output }));
