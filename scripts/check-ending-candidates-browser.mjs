import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const folder = path.resolve('assets/ending-candidates-20260909');
const output = path.resolve('artifacts/ending-candidates-20260909');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4487';
fs.mkdirSync(output, { recursive: true });
const variants = JSON.parse(fs.readFileSync(path.join(folder, 'prompts.json'), 'utf8')).variants;
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { date: '2026-09-09', scope: 'Five ending-scene candidates and standalone gallery only; no main-app replacement or deployment.', files: [], checks: [], errors: [] };
for (const variant of variants) {
  const file = path.join(folder, variant.file);
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert(width > height && Math.abs(width / height - 16 / 9) < 0.01);
  report.files.push({ file: variant.file, width, height, bytes: bytes.length, sha256: digest(file) });
}
assert.equal(variants.length, 5);
assert.equal(new Set(report.files.map(f => f.sha256)).size, 5);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(pathToFileURL(path.join(folder, 'index.html')).href);
    assert.equal(await page.locator('a[download]').count(), 0, 'Local file links use an honest open-image fallback');
    const [localImage] = await Promise.all([context.waitForEvent('page'), page.locator('figcaption a').first().click()]);
    await localImage.waitForLoadState();
    assert(localImage.url().endsWith('/' + variants[0].file));
    await localImage.close();
    await page.goto(base + '/assets/ending-candidates-20260909/index.html');
    await page.locator('main img').evaluateAll(async images => {
      for (const image of images) image.loading = 'eager';
      await Promise.all(images.map(image => image.decode()));
    });
    assert.equal(await page.locator('main figure').count(), 5);
    const state = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      images: [...document.querySelectorAll('main img')].map(image => ({
        source: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight,
        complete: image.complete, renderedWidth: image.getBoundingClientRect().width
      }))
    }));
    assert(state.scrollWidth <= state.width, 'No horizontal overflow');
    for (const image of state.images) assert(image.complete && image.width > 0 && image.renderedWidth > 0);
    await page.screenshot({ path: path.join(output, width + '-gallery.png'), fullPage: true });
    const [popup] = await Promise.all([context.waitForEvent('page'), page.locator('main figure > a').first().click()]);
    await popup.waitForLoadState();
    assert(popup.url().endsWith('/' + variants[0].file));
    assert.equal(await popup.locator('img').evaluate(image => image.naturalWidth), report.files[0].width);
    await popup.close();
    const download = await Promise.all([page.waitForEvent('download'), page.locator('figcaption a').first().click()]).then(values => values[0]);
    const saved = path.join(output, width + '-download.png');
    await download.saveAs(saved);
    assert.equal(digest(saved), report.files[0].sha256, 'Downloaded PNG is byte-identical');
    report.checks.push({ viewport: width, result: 'PASS', detail: 'All 5 images decoded; no horizontal overflow; full-size opening and HTTP PNG download verified; local-file opening fallback verified.', ...state });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.errors.push(error.stack);
  throw error;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
