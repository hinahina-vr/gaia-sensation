import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = [
  'index.html', 'gaia-mode-loader.js', 'app.js', 'opening.css', 'navigation-controls.css',
  'panel-surfaces.css', 'map-mobile-shell.css', 'map-mobile-shell.js', 'map-ui-grid-polish.js',
  'data-journey.css', 'character-mode.css', 'sound-mode.js', 'realtime-exhibits.css',
  'sensors/index.html', 'sensors/sensor-platform.css',
  'src/exploration/index.js', 'src/exploration/estat-exhibits.js', 'src/exploration/live-exhibits.js',
  'src/exploration/firms-exhibit.js', 'src/exploration/planet-signals-exhibit.js',
  'src/exploration/map-exhibit-actions.js', 'src/exploration/realtime-exhibit-status.js',
  '_headers', 'sensor-platform/src/browser-security.ts',
];
const reports = [
  ['artifacts/map-ui-polish-before/report.json', 'reproduced'],
  ['artifacts/map-ui-polish-after/report.json', 'passed'],
  ['artifacts/map-ui-polish-layout/report.json', 'passed'],
  ['artifacts/realtime-ui-polish/report.json', 'passed'],
  ['artifacts/realtime-status/report.json', 'passed'],
  ['artifacts/co2-timeline-3x/report.json', 'passed'],
  ['artifacts/ui-cleanup/report.json', 'passed'],
  ['artifacts/unified-navigation/regression-report.json', 'passed'],
  ['artifacts/sensor-onboarding/regression-report.json', 'passed'],
  ['artifacts/boot-style-race/before-report.json', 'reproduced'],
  ['artifacts/boot-style-race/after-report.json', 'passed'],
].map(([file, expected]) => {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(report.status, expected, file);
  return { file, status: report.status, sha256: hash(file), writtenAt: fs.statSync(file).mtime.toISOString() };
});
const output = path.resolve('artifacts/ui-polish-final');
fs.mkdirSync(output, { recursive: true });
const manifest = {
  recordedAt: new Date().toISOString(),
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source: 'Uncommitted local working tree; final source snapshot, not a published build',
  scope: 'UI polish bundle, 2026-09-08',
  validationSequence: 'After the full 30-exhibit navigation and realtime/CO2 checks, the inline CSS preload race and mobile POI title/close spacing were refined. Bootstrap was rechecked with delayed CSS, actual sensor return links, and the full UI-cleanup flow; CSP hashes were regenerated and checked. The final POI spacing and CSS version were rechecked in five viewports with --layout-only, including the year controls, actual POI tapping, scroll and close; unchanged full-30 navigation is retained from the earlier report.',
  limitations: 'Chrome desktop and mobile/touch emulation; external feed and sensor API fixtures, not physical phones, real ESP32, production providers, deployment or a distribution ZIP.',
  sourceSha256: Object.fromEntries(sources.map(file => [file, hash(file)])),
  reports,
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ status: 'recorded', sources: sources.length, reports: reports.length, output }));
