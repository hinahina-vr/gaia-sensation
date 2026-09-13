import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const record = process.argv.includes('--record');
const output = path.resolve('artifacts/sakuya-expression-alignment');
fs.mkdirSync(output, { recursive: true });
// The calm and rightmost worried portraits both have the chin at source y=270
// in their unchanged 1024 x 1536 PNGs. Hair/expressions themselves are not edited.
const report = { status: 'running', record, base, checks: [], errors: [], sha256: Object.fromEntries(
  ['character-mode.css', 'gaia-mode-loader.js', 'index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]),
)};
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
try {
  for (const width of record ? [3840] : [3840, 1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2160 : width === 1440 ? 900 : 844 }, reducedMotion: width === 1440 ? 'no-preference' : 'reduce' });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/#character`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-character-select="sakuya"]').click();
    await page.waitForFunction(() => document.querySelector('#character-book-layer').dataset.characterId === 'sakuya'
      && document.querySelectorAll('[data-character-id="sakuya"][data-character-expression]').length === 4
      && [...document.querySelectorAll('.character-book-expression-list img')].every(img => img.complete && img.naturalHeight));
    const list = page.locator('#character-book-expression-list');
    await list.scrollIntoViewIfNeeded();
    const inspect = () => list.locator('img').evaluateAll(images => images.map(img => {
      const image = img.getBoundingClientRect(), frame = img.parentElement.getBoundingClientRect();
      return { id: img.closest('button').dataset.characterExpression, image: image.toJSON(), frame: frame.toJSON(),
        source: img.currentSrc, sourceWidth: img.naturalWidth, sourceHeight: img.naturalHeight,
        chinY: image.y + 270 * image.height / img.naturalHeight,
        hit: img.closest('button').contains(document.elementFromPoint(frame.x + frame.width / 2, frame.y + frame.height / 2)) };
    }));
    let initial;
    for (const id of ['calm', 'sad', 'teasing', 'worried']) {
      const button = page.locator(`[data-character-id="sakuya"][data-character-expression="${id}"]`);
      await button.click();
      await page.waitForFunction(id => document.querySelector('#character-book-layer').dataset.expressionId === id, id);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      const faces = await inspect();
      initial ||= faces;
      const chinDelta = faces[0].chinY - faces[3].chinY;
      report.checks.push({ width, selected: id, chinDelta, faces });
      if (!record) {
        assert(Math.abs(chinDelta) < .25, `${width}/${id}: left chin differs from right (${chinDelta}px)`);
        assert.deepEqual(faces, initial, `${width}/${id}: selecting a portrait moved its crop`);
        assert(faces.every(face => face.hit && face.frame.x >= 0 && face.frame.right <= width));
        assert.equal(await list.locator('[aria-pressed="true"]').count(), 1);
        for (const action of ['hover', 'focus']) {
          await button[action]();
          await page.waitForTimeout(350);
          assert.deepEqual(await inspect(), initial, `${width}/${id}: ${action} moved a portrait`);
        }
      }
      const box = await list.boundingBox();
      await page.screenshot({ path: path.join(output, `${record ? 'before' : 'after'}-${width}-${id}.png`), clip: { x: box.x - 6, y: box.y - 6, width: box.width + 12, height: box.height + 12 } });
    }
    if (record) assert(report.checks[0].chinDelta < -1, 'The reported raised left chin was not reproduced');
    else {
      await page.locator('#character-book-close').click();
      await page.locator('#character-book-layer').waitFor({ state: 'hidden' });
    }
    await context.close();
    console.log(`${record ? 'REPRODUCED' : 'PASS'} ${width}: chin position and four expression states`);
  }
  assert.deepEqual(report.errors, []);
  report.status = record ? 'reproduced' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, `${record ? 'baseline' : 'regression'}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, errors: report.errors }));
}
