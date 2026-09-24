import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { readBuildInfo } from './lib/build-info.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'artifacts/build-info-2026-09-25');
fs.mkdirSync(output, { recursive: true });
execFileSync(process.execPath, ['scripts/build-info.mjs'], { cwd: root });
const expected = readBuildInfo(root, { env: {}, context: 'preview' });
const generated = JSON.parse(fs.readFileSync(path.join(root, 'build-info.json')));
const report = { commit: expected.commit, worktree: expected.worktree,
  environment: 'Installed Chrome, local HTTP with enforced CSP; desktop and emulated touch phones. Not production or physical phones.', checks: [], errors: [] };
const servers = [];
const startServer = async extraEnv => {
  const child = spawn(process.execPath, ['scripts/serve-novel-preview.mjs', '0'], {
    cwd: root, env: { ...process.env, GAIA_PREVIEW_PORT: '0', GAIA_PREVIEW_BASELINE: '', GAIA_PREVIEW_COMPRESSION: '', ...extraEnv }, windowsHide: true,
  });
  servers.push(child);
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Preview exited: ${code}`)));
    child.stdout.on('data', chunk => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
  });
};
let browser;
try {
  const base = await startServer({});
  const response = await fetch(`${base}/build-info.json`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), expected);
  const head = await fetch(`${base}/build-info.json`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(`${base}/build-info.json`, { method: 'POST' })).status, 405);
  report.checks.push('preview metadata GET/HEAD/no-store and POST rejection');
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/concept/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(sha => document.querySelector('[data-build-sha]').textContent === sha, expected.commit);
    assert.equal(await page.locator('[data-build-short]').textContent(), expected.shortCommit);
    if (expected.worktree === 'modified') assert.match(await page.locator('[data-build-state]').textContent(), /未コミット変更あり/);
    // Only the new footer rows may change the existing page layout.
    const positions = await page.evaluate(() => {
      const measure = () => ['#page-title', '#learning-title', '.author-colophon', '.footer-bottom', '.work-disclaimer'].map(selector => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      });
      const shown = measure();
      const info = document.querySelector('[data-build-info]');
      info.hidden = true;
      const hidden = measure();
      info.hidden = false;
      return { shown, hidden };
    });
    assert.deepEqual(positions.shown, positions.hidden);
    await page.locator('[data-build-info]').scrollIntoViewIfNeeded();
    const bounds = await page.locator('[data-build-info]').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, font: getComputedStyle(el).fontSize }));
    assert(bounds.scroll <= bounds.width + 1, `SHA overflows at ${width}px`);
    assert.equal(bounds.font, '12px');
    await page.locator('.site-footer').screenshot({ path: path.join(output, `footer-${width}.png`) });
    // SHA must survive language changes verbatim; state labels follow the language.
    for (const [language, label] of [['en', 'local preview'], ['zh-CN', '本地预览'], ['ja', 'ローカル']]) {
      await page.evaluate(lang => GaiaI18n.set(lang), language);
      assert.equal(await page.locator('[data-build-sha]').textContent(), expected.commit);
      assert.match(await page.locator('[data-build-state]').textContent(), new RegExp(label));
    }
    await page.locator('.footer-bottom a[href="#top"]').click();
    await page.waitForFunction(() => location.hash === '#top' && scrollY < 100);
    await page.locator('[data-open-diagram]').click();
    assert(await page.locator('.diagram-viewer').evaluate(el => el.open));
    await page.locator('[data-close-diagram]').click();
    assert.equal(await page.locator('.diagram-viewer').evaluate(el => el.open), false);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push(`${width}px: SHA/state, layout, selectable full SHA, languages, top link, diagram, CSP`);
    await context.close();
  }
  // Read the generated artifact through ordinary static HTTP, without dynamic Git lookup.
  const staticBase = await startServer({ GAIA_PREVIEW_BUILD_INFO: 'static' });
  assert.deepEqual(await (await fetch(`${staticBase}/build-info.json`)).json(), generated);
  const page = await browser.newPage();
  await page.goto(`${staticBase}/concept/`);
  await page.waitForFunction(sha => document.querySelector('[data-build-sha]').textContent === sha, generated.commit);
  assert.doesNotMatch(await page.locator('[data-build-state]').textContent(), /ローカル/);
  report.checks.push('generated build-info.json served statically and rendered with exact full SHA');
  for (const [name, status, body] of [
    ['missing', 404, 'Not found'], ['invalid', 200, JSON.stringify({ schemaVersion: 1, commit: '<img src=x onerror=alert(1)>' })],
  ]) {
    await page.route('**/build-info.json', route => route.fulfill({ status, body, contentType: 'application/json' }));
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-build-sha]').textContent(), '未取得');
    assert.equal(await page.locator('[data-build-info] img').count(), 0);
    report.checks.push(`${name} metadata: no stale or fabricated SHA`);
    await page.unroute('**/build-info.json');
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} finally {
  await browser?.close();
  for (const server of servers) server.kill();
  report.hashes = Object.fromEntries(['concept/index.html', 'concept/concept.css', 'concept/build-info.js', 'scripts/lib/build-info.mjs', 'scripts/build-info.mjs', 'scripts/serve-novel-preview.mjs', 'build-info.json'].map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
  fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
