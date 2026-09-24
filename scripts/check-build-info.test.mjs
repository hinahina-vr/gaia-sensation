import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { readBuildInfo } from './lib/build-info.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gaia-build-info-'));
const git = (...args) => execFileSync('git', ['-C', fixtureRoot, ...args], { encoding: 'utf8', windowsHide: true }).trim();
git('init', '--quiet');
fs.writeFileSync(path.join(fixtureRoot, '.gitignore'), '/build-info.json\n');
fs.writeFileSync(path.join(fixtureRoot, 'index.html'), 'first');
git('add', '.');
git('-c', 'user.name=Build info test', '-c', 'user.email=build-test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture');
const commit = git('rev-parse', 'HEAD');
const read = env => readBuildInfo(fixtureRoot, { env: env || {} });

test('identifies actual HEAD and preserves its full SHA', () => {
  assert.deepEqual(read(), { schemaVersion: 1, commit, shortCommit: commit.slice(0, 7), worktree: 'clean', source: 'git', context: 'build' });
});
test('generated metadata does not dirty its own build', () => {
  fs.writeFileSync(path.join(fixtureRoot, 'build-info.json'), JSON.stringify(read()));
  assert.equal(read().worktree, 'clean');
});
test('matching Pages SHA is checked against Git, not blindly trusted', () => {
  assert.equal(read({ CF_PAGES_COMMIT_SHA: commit }).source, 'git');
  assert.throws(() => read({ CF_PAGES_COMMIT_SHA: 'a'.repeat(40) }), /does not match/);
  assert.throws(() => read({ CF_PAGES_COMMIT_SHA: '<script>' }), /Invalid/);
});
test('modified and staged files keep HEAD but cannot appear clean', () => {
  fs.writeFileSync(path.join(fixtureRoot, 'index.html'), 'edited');
  assert.equal(read().worktree, 'modified');
  git('add', 'index.html');
  assert.equal(read().worktree, 'modified');
  assert.equal(read().commit, commit);
});
test('a new commit updates the identity automatically', () => {
  git('-c', 'user.name=Build info test', '-c', 'user.email=build-test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'second');
  assert.notEqual(read().commit, commit);
  assert.equal(read().worktree, 'clean');
});
test('untracked files count as uncommitted changes', () => {
  fs.writeFileSync(path.join(fixtureRoot, 'new.js'), '');
  assert.equal(read().worktree, 'modified');
});
test('an archive under a parent repository does not inherit the parent SHA', () => {
  const archive = path.join(fixtureRoot, 'extracted');
  fs.mkdirSync(archive);
  assert.equal(readBuildInfo(archive, { env: {} }).commit, null);
  const info = readBuildInfo(archive, { env: { CF_PAGES_COMMIT_SHA: commit } });
  assert.equal(info.commit, commit);
  assert.equal(info.source, 'cloudflare');
  assert.equal(info.worktree, 'unknown');
});
test('release hook, uncached metadata and unchanged package version', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  assert.equal(pkg.version, '1.0.0');
  assert.match(pkg.scripts['build:release'], /&& npm run build:info$/);
  assert.match(fs.readFileSync(path.join(root, '_headers'), 'utf8'), /\/build-info\.json\r?\n  Cache-Control: no-store/);
});
// Fixtures are kept in a uniquely named OS temp directory for test diagnosis.
