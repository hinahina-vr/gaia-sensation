import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const base = process.env.GAIA_BASE_URL;
assert(base?.startsWith('https://'), 'An explicit deployed HTTPS origin is required');
const commit = process.env.GAIA_EXPECTED_COMMIT;
assert(/^[a-f0-9]{40}$/.test(commit || ''), 'An exact reviewed commit is required');
const root = path.resolve(process.env.GAIA_RELEASE_ROOT || '.');
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/release-prtr-20260909/production-http');
fs.mkdirSync(output, { recursive: true });
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 50000000 }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = git(['diff', '--name-only', '2a4f513', commit]).split('\n').filter(file => /^(?:src\/|data\/|assets\/|concept\/)|^[^/]+\.(?:js|css|html)$/.test(file));
const report = { status: 'running', base, commit, testedAt: new Date().toISOString(), conditions: 'Real deployed HTTP responses, no mocks. Body hashes are compared with a newly extracted Git commit. Read-only API/security checks.', files: [], checks: [] };
try {
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++];
      const bytes = fs.readFileSync(path.join(root, file));
      const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      assert.equal(blob, git(['rev-parse', `${commit}:${file}`]), `Extracted file matches commit: ${file}`);
      const response = await fetch(new URL(file, base + '/'), { signal: AbortSignal.timeout(90000), headers: { 'Cache-Control': 'no-cache' } });
      assert.equal(response.status, 200, file);
      const received = Buffer.from(await response.arrayBuffer());
      assert.equal(hash(received), hash(bytes), `Published bytes: ${file}`);
      report.files.push({ file, bytes: received.length, sha256: hash(received), status: response.status, contentType: response.headers.get('content-type') });
    }
  }));
  const entry = await fetch(base + '/', { signal: AbortSignal.timeout(30000) });
  assert.equal(entry.status, 200);
  assert(entry.headers.get('content-security-policy')?.includes("script-src 'self'"));
  assert.equal(entry.headers.get('x-content-type-options'), 'nosniff');
  report.checks.push({ check: 'HTML response and production security headers', status: 'pass' });
  const health = await fetch(base + '/api/health', { signal: AbortSignal.timeout(30000) });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, service: 'gaia-senseware-sensor-platform' });
  report.checks.push({ check: 'Read-only production sensor API health', status: 'pass' });
  for (const route of ['/AGENTS.md', '/docs/rights-review.json', '/scripts/check-observation-release-http.mjs', '/sensor-platform/package.json']) {
    const response = await fetch(base + route, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 404, `Private path ${route}`);
    report.checks.push({ check: `Private path ${route}`, status: 'pass' });
  }
  report.status = 'pass';
} catch (error) { report.status = 'fail'; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, files: report.files.length, checks: report.checks.length, commit }));
