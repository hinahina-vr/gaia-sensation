// Conservative dependency inventory. No reference found is NOT proof of non-use.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256 } from './media-origin.mjs';
import { JAPAN_SENSOR_OPEN_EXHIBITS } from '../src/exploration/japan-sensor-open-catalog.js';
import { JAPAN_POLLUTION_EXHIBITS } from '../src/exploration/japan-pollution-catalog.js';
import { PRTR_BIOLOGY_EXHIBITS } from '../src/exploration/prtr-biology-catalog.js';
import { FOOD_EXHIBITS } from '../src/exploration/food-catalog.js';

export function manifestParts(file, value) {
  const parts = [];
  if (file === 'data/runtime/gaia-manifest.json') {
    for (const chunk of value.chunks || []) if (typeof chunk.file === 'string') {
      if (!/^[a-z0-9-]+\.[a-f0-9]{16}\.json$/.test(chunk.file)) throw new Error('Unsafe runtime chunk');
      parts.push(`data/runtime/${chunk.file}`);
    }
  } else if (value.schemaVersion === 2 && Array.isArray(value.periods) && Array.isArray(value.historyShards)) {
    for (const part of [...value.periods, ...value.historyShards]) {
      if (!/^annual\/[a-z0-9-]+\/(?:\d{4}|history-\d+)\.json(?:\.gz)?$/.test(part.file || '')) throw new Error('Unsafe annual part');
      parts.push(`data/${part.file}`);
    }
  }
  return parts;
}

export function referenceKind(file) {
  if (/^(?:scripts|tests)\//.test(file) || /(^|\/)(?:test|tests)\//.test(file)) return 'build-test';
  if (/\.(?:md|txt)$/.test(file) || /^docs\//.test(file)) return 'documentation';
  return 'runtime-candidate';
}

export function dataTokens(text) {
  return [...text.matchAll(/[A-Za-z0-9_./-]+\.(?:json(?:\.gz)?|csv|tsv|geojson|topojson|bin|zip|pdf|html|txt|md)\b/g)].map(match => match[0]);
}

export function audit(root) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20e6, windowsHide: true });
  const baseCommit = git(['rev-parse', 'HEAD']).trim();
  const listed = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))];
  const files = listed.filter(f => fs.existsSync(path.join(root, f)));
  const metadata = new Map(), hashes = new Map(), skipped = [], missing = [];
  const rows = new Map(files.filter(f => f.startsWith('data/')).map(file => {
    const stat = fs.statSync(path.join(root, file));
    metadata.set(file, [stat.size, stat.mtimeMs]);
    return [file, { path: file, bytes: stat.size, references: [] }];
  }));
  const byName = new Map();
  for (const file of rows.keys()) {
    const name = path.posix.basename(file);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(file);
  }
  const add = (target, source, kind) => {
    const row = rows.get(target);
    if (!row) { missing.push({ target, source, kind }); return; }
    if (!row.references.some(r => r.source === source && r.kind === kind)) row.references.push({ source, kind });
  };
  const read = file => {
    const bytes = fs.readFileSync(path.join(root, file));
    hashes.set(file, sha256(bytes));
    return bytes.toString('utf8');
  };
  const sources = files.filter(f => !/^(?:data|artifacts|output|node_modules)\//.test(f)
    && /\.(?:js|mjs|ts|html|css|py|json|jsonc|md|txt|yml|yaml)$/.test(f));
  for (const source of sources) {
    if (fs.statSync(path.join(root, source)).size > 5_000_000) { skipped.push(source); continue; }
    const text = read(source), kind = referenceKind(source);
    // Literal names also cover paths assembled with a data-directory variable.
    for (const token of dataTokens(text)) {
      const start = token.indexOf('data/');
      const target = start >= 0 ? token.slice(start) : null;
      if (target && rows.has(target)) add(target, source, kind);
      else {
        const candidates = byName.get(path.posix.basename(token));
        if (candidates?.length === 1) add(candidates[0], source, kind);
      }
    }
  }
  // These runtime catalogues assemble their filenames, so literal search is insufficient.
  const catalogues = [
    ['src/exploration/japan-sensor-open-catalog.js', JAPAN_SENSOR_OPEN_EXHIBITS],
    ['src/exploration/japan-pollution-catalog.js', JAPAN_POLLUTION_EXHIBITS],
    ['src/exploration/prtr-biology-catalog.js', PRTR_BIOLOGY_EXHIBITS],
    ['src/exploration/food-catalog.js', FOOD_EXHIBITS],
    ['src/exploration/marine-cod-exhibit.js', [{ dataFile: 'japan-marine-cod.json' }]],
  ];
  for (const [source, definitions] of catalogues) for (const item of definitions) add(`data/${item.dataFile}`, source, 'runtime-catalogue');
  const roots = [...rows.values()].filter(row => row.references.some(r => r.kind.startsWith('runtime')) && row.path.endsWith('.json') && !row.path.startsWith('data/annual/'));
  for (const row of roots) {
    if (row.bytes > 5_000_000) { skipped.push(row.path); continue; }
    const value = JSON.parse(read(row.path));
    for (const target of manifestParts(row.path, value)) add(target, row.path, 'runtime-manifest');
  }
  const summary = {};
  for (const row of rows.values()) {
    row.status = row.references.some(r => r.kind.startsWith('runtime')) ? 'retain-runtime-candidate'
      : row.references.some(r => r.kind === 'build-test') ? 'build-test-only-review'
      : row.references.length ? 'documentation-only-review' : 'no-detected-reference-review';
    summary[row.status] ||= { files: 0, bytes: 0 };
    summary[row.status].files++; summary[row.status].bytes += row.bytes;
  }
  const drift = [];
  for (const [file, hash] of hashes) if (!fs.existsSync(path.join(root, file)) || sha256(fs.readFileSync(path.join(root, file))) !== hash) drift.push(file);
  for (const [file, [size, mtime]] of metadata) {
    const stat = fs.existsSync(path.join(root, file)) && fs.statSync(path.join(root, file));
    if (!stat || stat.size !== size || stat.mtimeMs !== mtime) drift.push(file);
  }
  if (git(['rev-parse', 'HEAD']).trim() !== baseCommit) drift.push('HEAD');
  return { schemaVersion: 1, status: drift.length ? 'retry-source-changed' : 'provisional-audit', baseCommit,
    source: 'current-working-tree-including-uncommitted-files', deletionAuthorizedByReport: false,
    limitations: ['Static conservative candidates, not complete runtime reachability or a secret scan.',
      'No reference does not prove non-use; dynamic URLs and server behavior need browser verification.',
      'Payloads are size/mtime checked; scanned source and manifests are SHA-256 checked. Re-run on the final fixed commit.'],
    summary, missing, skipped, drift, scannedTextFiles: hashes.size,
    inputHashes: Object.fromEntries(hashes), files: [...rows.values()] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, '..'), report = audit(root);
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'artifacts', 'production-data-audit-'));
  fs.writeFileSync(path.join(directory, 'REPORT.json'), JSON.stringify(report, null, 2) + '\n');
  const lines = ['# 本番データ参照調査（暫定）', '', `基点: ${report.baseCommit}。未コミット変更を含む。`, '',
    '削除済み・未使用確定の一覧ではありません。候補の参照元をREPORT.jsonに記録。', '',
    ...Object.entries(report.summary).map(([key, value]) => `- ${key}: ${value.files} files / ${(value.bytes / 1048576).toFixed(2)} MiB`), '',
    `見つからない索引参照: ${report.missing.length}、大容量のため本文未走査: ${report.skipped.length}、走査中変更検出: ${report.drift.length}`, '',
    '## 動作確認が必要な候補', '',
    ...report.files.filter(f => f.status !== 'retain-runtime-candidate').map(f => `- ${f.path}: ${f.status} (${f.bytes} bytes)`), ''];
  fs.writeFileSync(path.join(directory, 'REPORT.md'), lines.join('\n'));
  console.log(JSON.stringify({ status: report.status, summary: report.summary, missing: report.missing.length, skipped: report.skipped.length, drift: report.drift.length, directory }, null, 2));
  if (report.drift.length || report.missing.length) process.exitCode = 1;
}
