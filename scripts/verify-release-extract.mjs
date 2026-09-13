import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [commit, directory] = process.argv.slice(2);
assert(/^[a-f0-9]{40}$/.test(commit || ''), 'Use a full reviewed commit SHA');
assert(directory, 'A newly extracted directory is required');
const root = path.resolve(directory);
assert(fs.statSync(root).isDirectory());
const entries = execFileSync('git', ['ls-tree', '-rz', commit], { encoding: 'utf8', maxBuffer: 10000000 }).split('\0').filter(Boolean);
let bytes = 0;
for (const entry of entries) {
  const [header, file] = entry.split('\t');
  const [mode, type, expected] = header.split(' ');
  assert.equal(type, 'blob');
  assert(['100644', '100755'].includes(mode), `Unsupported release mode ${file}`);
  const target = path.resolve(root, file);
  assert(target.startsWith(root + path.sep), `Path escaped release directory: ${file}`);
  const value = fs.readFileSync(target);
  const actual = createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex');
  assert.equal(actual, expected, `Extracted bytes match Git commit: ${file}`);
  bytes += value.length;
}
console.log(JSON.stringify({ status: 'pass', commit, root, files: entries.length, bytes }));
