import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const folder = path.resolve('assets/opening-candidates-20260911');
const output = path.resolve('artifacts/opening-candidates-20260911');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
fs.mkdirSync(output, { recursive: true });
const variants = JSON.parse(fs.readFileSync(path.join(folder, 'prompts.json'), 'utf8')).variants;
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { scope: 'Nine opening candidates after the user hair-end revision; standalone gallery only. No main-app replacement or production validation.', files: [], checks: [], errors: [] };
assert.equal(variants.length, 9);
for (const group of ['prologue', 'mizu', 'ame']) assert.equal(variants.filter(v => v.id.startsWith(group + '-')).length, 3);
for (const variant of variants) {
  const file = path.join(folder, variant.file);
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert(width > height && Math.abs(width / height - 16 / 9) < .01, variant.id + ' must be landscape 16:9');
  report.files.push({ file: variant.file, width, height, bytes: bytes.length, sha256: digest(file) });
}
assert.equal(new Set(report.files.map(f => f.sha256)).size, 9, 'All nine are different files');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); });
    await page.goto(pathToFileURL(path.join(folder, 'index.html')).href);
    await page.locator('main img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.equal(await page.locator('a[download]').count(), 0);
    const [local] = await Promise.all([context.waitForEvent('page'), page.locator('.save').first().click()]);
    await local.waitForLoadState();
    assert(local.url().endsWith('/prologue-01.png'));
    await local.close();
    await page.goto(base + '/assets/opening-candidates-20260911/index.html');
    await page.locator('main img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.equal(await page.locator('main figure').count(), 9);
    const state = await page.evaluate(() => ({
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      images: [...document.querySelectorAll('main img')].map(image => ({
        source: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight,
        complete: image.complete, renderedWidth: image.getBoundingClientRect().width
      }))
    }));
    assert(state.scrollWidth <= state.width, 'No horizontal overflow');
    for (const image of state.images) assert(image.complete && image.width > 0 && image.renderedWidth > 0);
    await page.screenshot({ path: path.join(output, width + '-gallery.png'), fullPage: true });
    const filesToExercise = width === 1440 ? variants : variants.filter((v, i) => i % 3 === 0);
    for (const variant of filesToExercise) {
      const [popup] = await Promise.all([context.waitForEvent('page'), page.locator('#' + variant.id + ' .preview').click()]);
      await popup.waitForLoadState();
      await popup.locator('img').evaluate(image => image.decode());
      assert(popup.url().endsWith('/' + variant.file));
      assert.equal(await popup.locator('img').evaluate(image => image.naturalWidth), report.files.find(f => f.file === variant.file).width);
      await popup.close();
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#' + variant.id + ' .save').click()]);
      const saved = path.join(output, width + '-' + variant.file);
      await download.saveAs(saved);
      assert.equal(digest(saved), report.files.find(f => f.file === variant.file).sha256);
    }
    report.checks.push({ viewport: width, status: 'PASS', exercisedOpeningAndDownload: filesToExercise.map(v => v.id), localFileOpening: 'PASS', ...state });
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

