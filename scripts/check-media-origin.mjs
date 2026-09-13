import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildOrigins, validateOrigins, originalDate, sha256 } from './media-origin.mjs';

// A real pair of disposable Git repositories models old history -> new main.
const root = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const fixture = fs.mkdtempSync(path.join(root, 'artifacts', 'media-origin-test-'));
const bytes = Buffer.from('synthetic image bytes, not a real artwork');
const file = 'assets/fixture.png', date = '2001-01-01T00:00:00+00:00';
function repository(name, stamp) {
  const directory = path.join(fixture, name);
  fs.mkdirSync(path.join(directory, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(directory, file), bytes);
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp } }).trim();
  git(['init', '--quiet', '--initial-branch=main']);
  git(['add', '--', file]);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false',
    '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'Synthetic fixture']);
  return { directory, git };
}
const old = repository('old', date);
const ledger = Buffer.from(JSON.stringify({ assets: [{ path: file, sha256: sha256(bytes), firstRepositoryEvidenceAt: date }] }));
const snapshot = buildOrigins(old.git(['rev-parse', 'HEAD']), ledger, p => fs.readFileSync(path.join(old.directory, p)));
const fresh = repository('fresh', '2026-09-13T00:00:00+00:00');
fs.mkdirSync(path.join(fresh.directory, 'docs'));
fs.writeFileSync(path.join(fresh.directory, 'docs/media-origin-snapshot.json'), JSON.stringify(snapshot));
const origins = validateOrigins(JSON.parse(fs.readFileSync(path.join(fresh.directory, 'docs/media-origin-snapshot.json'))));
const newDate = fresh.git(['log', '-1', '--format=%aI', '--', file]);
assert.notEqual(newDate, date);
assert.equal(fresh.git(['rev-list', '--count', 'HEAD']), '1');
assert.equal(originalDate(file, sha256(bytes), newDate, origins), date);
assert.equal(originalDate('assets/new.png', sha256(bytes), newDate, origins), newDate);
assert.equal(originalDate(file, sha256(bytes), newDate, null), newDate);
assert.throws(() => originalDate(file, sha256('changed'), newDate, origins));
assert.throws(() => buildOrigins(snapshot.sourceCommit, ledger, () => Buffer.from('stale')));
assert.throws(() => validateOrigins({ ...snapshot, assets: [...snapshot.assets, ...snapshot.assets] }));
assert.throws(() => validateOrigins({ ...snapshot, assets: [{ ...snapshot.assets[0], path: 'assets/../escape.png' }] }));
assert.throws(() => validateOrigins({ ...snapshot, sourceCommit: 'HEAD' }));
console.log(JSON.stringify({ status: 'passed', assertions: 10, actualGitRepositories: 2, syntheticAssets: true, fixture }));
