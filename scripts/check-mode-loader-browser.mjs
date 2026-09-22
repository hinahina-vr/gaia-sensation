import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readStartupBaseline } from './lib/startup-baseline.mjs';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = process.env.GAIA_OUTPUT_DIR || 'artifacts/refactor-20260922/browser';
const baselineDir = process.env.GAIA_COMPARE_BASELINE;
const previousLoader = readStartupBaseline('gaia-mode-loader.js');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', baseline: baselineDir || '0bf1d94', checks: [], errors: [],
  hashes: Object.fromEntries(['index.html', 'app.js', 'opening.js', 'gaia-i18n.js', 'gaia-mode-loader.js'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  scope: 'Installed headless Chrome, PC and mobile emulation; local assets, external APIs blocked. Baseline uses saved pre-change files when GAIA_COMPARE_BASELINE is supplied, otherwise the previous loader only. Text/style/geometry and stable card pixels compared; animated full-page screenshots are evidence, not pixel assertions.' };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
async function scan(selector) {
  return page.locator(selector).evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    return { text: element.textContent.trim(), src: element.getAttribute('src'),
      box: [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 10) / 10),
      styles: Object.fromEntries(['fontFamily', 'fontSize', 'lineHeight', 'color', 'backgroundColor', 'whiteSpace', 'padding', 'borderRadius'].map(key => [key, style[key]])),
    };
  }));
}
try {
  for (const width of [1440, 390]) {
    const versions = [];
    for (const version of ['before', 'after']) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 },
        hasTouch: width === 390, isMobile: width === 390, locale: 'ja-JP', reducedMotion: 'reduce' });
      await enforceBrowserSecurity(context, base);
      await context.route('https://**', route => route.abort());
      if (version === 'before') {
        if (baselineDir) await context.route(base + '/**', route => {
          const pathname = new URL(route.request().url()).pathname;
          const file = pathname === '/' ? 'index.html' : pathname.slice(1);
          const saved = path.join(baselineDir, file);
          if (fs.existsSync(saved) && fs.statSync(saved).isFile()) return route.fulfill({ body: fs.readFileSync(saved), contentType: file.endsWith('.html') ? 'text/html' : 'application/javascript' });
          return route.fallback();
        });
        else await context.route(base + '/**', route => {
          const pathname = new URL(route.request().url()).pathname;
          const file = pathname === '/' ? 'index.html' : pathname.slice(1);
          const body = readStartupBaseline(file);
          return body ? route.fulfill({ body, contentType: file.endsWith('.html') ? 'text/html' : 'application/javascript' }) : route.fallback();
        });
      }
      await context.addInitScript(() => {
        localStorage.setItem('gaia-senseware-bgm-muted', 'true');
        sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen');
        localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      });
      page = await context.newPage(); page.setDefaultTimeout(45000);
      page.on('pageerror', error => report.errors.push({ width, version, error: error.message }));
      const result = {};
      await page.goto(base);
      await page.locator('#gaia-opening-sound-off').click();
      // Reduced motion reaches the title directly; skip only when still present.
      if (await page.locator('#gaia-opening-skip').isVisible()) await page.locator('#gaia-opening-skip').click();
      await page.locator('#gaia-opening-route-other').click();
      await page.locator('.intro-path-card').first().waitFor({ state: 'visible' });
      await page.locator('#intro-entry-guide.is-visible').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('#intro-entry-guide').waitFor({ state: 'hidden' });
      await page.locator('#intro-path-grid').scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      result.cards = await scan('.intro-path-card, .intro-path-card > strong, .intro-path-card > p');
      await page.locator('#intro-path-grid').screenshot({ path: `${output}/${width}-${version}-cards.png`, animations: 'disabled' });
      await page.screenshot({ path: `${output}/${width}-${version}-menu.png`, animations: 'disabled' });

      await page.locator('.intro-path-card[data-character-gallery-open]').click();
      await page.waitForFunction(() => document.querySelector('#character-book-layer')?.dataset.imageState === 'ready');
      await page.locator('#gaia-character-preloader').waitFor({ state: 'hidden' });
      await page.waitForTimeout(800);
      result.character = await scan('#character-book-page-title, #character-book-profile, #character-book-image, #character-book-close');
      await page.locator('[data-character-select="mizuha"]').click();
      await page.waitForFunction(() => document.querySelector('#character-book-layer')?.dataset.characterId === 'mizuha' && document.querySelector('#character-book-layer')?.dataset.imageState === 'ready');
      result.selectedCharacter = await page.locator('#character-book-image').getAttribute('src');
      if (version === 'after') {
        const portraits = await page.evaluate(() => performance.getEntriesByType('resource')
          .map(entry => entry.name).filter(url => /\/(amane|mizuha|sakuya)-calm-07-v\d\.png/.test(url)));
        const urls = new Map();
        for (const url of portraits) {
          const file = new URL(url).pathname;
          if (!urls.has(file)) urls.set(file, new Set());
          urls.get(file).add(url);
        }
        for (const [file, variants] of urls) assert.equal(variants.size, 1, file + ': duplicate portrait request');
      }
      await page.screenshot({ path: `${output}/${width}-${version}-character.png`, animations: 'disabled' });
      await page.locator('#character-book-close').click();
      await page.evaluate(() => GaiaIntroEntryGuide.close({ restoreFocus: false }));
      await page.locator('.intro-path-card[data-sound-gallery-open]').click();
      await page.locator('#sound-layer.is-open').waitFor();
      await page.waitForTimeout(800);
      result.sound = await scan('#sound-mode-title, #sound-track-title, #sound-mode-description, #sound-close');
      await page.screenshot({ path: `${output}/${width}-${version}-sound.png`, animations: 'disabled' });
      await page.locator('#sound-close').click();
      await page.evaluate(() => GaiaIntroEntryGuide.close({ restoreFocus: false }));
      await page.locator('.intro-path-card[data-intro-guide="map"]').click();
      await page.locator('[data-feature-start]').click();
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      await page.waitForFunction(() => globalThis.GaiaMapPlayback?.getState().ready);
      await page.waitForTimeout(1500);
      result.map = await page.evaluate(() => ({ ready: GaiaModeLoader.isLoaded('exploration'), number: GaiaMapPlayback.getState().number }));
      await page.screenshot({ path: `${output}/${width}-${version}-map.png`, animations: 'disabled' });
      // Exercise the remaining real module/script dependency chains. Their
      // visual presentation is not altered by this refactor.
      await page.evaluate(async () => {
        for (const group of ['statistics', 'gx', 'space', 'tour']) await GaiaModeLoader.load(group);
      });
      await page.goto(base + '/#story');
      await page.waitForFunction(() => globalThis.GaiaNovel && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible' && document.querySelector('#novel-text')?.dataset.revealState === 'complete');
      result.story = await scan('#novel-text, #novel-save-button, #novel-load-button');
      result.storyStep = await page.evaluate(() => GaiaNovel.getState().stepId);
      await page.screenshot({ path: `${output}/${width}-${version}-story.png`, animations: 'disabled' });
      // A real reload consumes the progress persisted by the story runtime.
      const stored = await page.evaluate(() => localStorage.getItem('gaiaSensewareNovel:progress'));
      assert(stored, 'Story must persist progress');
      await page.locator('#novel-save-button').click();
      await page.locator('.novel-save-slot[data-slot-index="0"]').click();
      await page.locator('.novel-save-slot[data-slot-index="0"][data-empty="false"]').waitFor();
      await page.reload();
      await page.waitForFunction(() => globalThis.GaiaNovel && document.querySelector('#novel-text')?.dataset.revealState === 'complete');
      assert.equal(await page.evaluate(() => GaiaNovel.getState().stepId), result.storyStep);
      await page.locator('#novel-load-button').click();
      await page.locator('.novel-save-slot[data-slot-index="0"]').click();
      await page.locator('#novel-save-panel').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => GaiaNovel.getState().stepId), result.storyStep);
      await page.locator('#novel-log-button').click();
      await page.keyboard.type('ruu');
      const comment = 'Mode loader regression: save, reload and export.';
      const editor = page.locator('.novel-log-comment-field textarea').first();
      await editor.fill(comment); await editor.blur();
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#novel-log-export').click()]);
      const stream = await download.createReadStream(), chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const markdown = Buffer.concat(chunks);
      assert(markdown.length > 100 && markdown.toString('utf8').includes(comment), 'Downloaded log must retain the user comment');
      await download.saveAs(`${output}/${width}-${version}-log.md`);
      assert.deepEqual(await page.evaluate(() => __securityViolations), []);
      versions.push(result);
      await context.close();
    }
    assert.deepEqual(versions[1], versions[0], `${width}: text, styles, geometry, selected assets and restored story must match`);
    const before = await sharp(`${output}/${width}-before-cards.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const after = await sharp(`${output}/${width}-after-cards.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual(after.info, before.info);
    let changed = 0;
    for (let offset = 0; offset < before.data.length; offset += 4) {
      if ([0, 1, 2].some(channel => Math.abs(before.data[offset + channel] - after.data[offset + channel]) > 20)) changed++;
    }
    const changedRatio = changed / (before.info.width * before.info.height);
    assert(changedRatio < 0.005, `${width}: static card pixel difference ${changedRatio}`);
    report.checks.push({ width, matched: versions[1], cardPixelDifference: changedRatio });
    console.log('PASS mode lifecycle, visual equivalence and saved story reload', width, changedRatio);
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
