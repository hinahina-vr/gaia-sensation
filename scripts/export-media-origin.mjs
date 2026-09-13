// Export from an immutable commit only. Never promote a dirty tree implicitly.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildOrigins } from './media-origin.mjs';

const root = path.resolve(import.meta.dirname, '..');
const commit = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Provide a reviewed full commit SHA');
const read = file => execFileSync('git', ['show', `${commit}:${file}`], { cwd: root, maxBuffer: 128 * 1024 * 1024, windowsHide: true });
const snapshot = buildOrigins(commit, read('docs/media-rights-ledger.json'), read);
const artifacts = path.join(root, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const directory = fs.mkdtempSync(path.join(artifacts, 'media-origin-'));
const target = path.join(directory, 'media-origin-snapshot.json');
fs.writeFileSync(target, JSON.stringify(snapshot, null, 2) + '\n');
console.log(JSON.stringify({ status: 'exported-provenance-only', sourceCommit: commit, assets: snapshot.assets.length, target }));
