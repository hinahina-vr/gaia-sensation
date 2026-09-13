import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const out = 'artifacts/i18n/story-browser';
fs.mkdirSync(out, { recursive: true });
const report = { status: 'running', scope: 'Local Chrome, desktop and emulated mobile; title, opening, story language changes, pagination, save/load. Not production.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) for (const language of ['en', 'zh-CN']) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900 });
    await context.route('https://**', route => route.abort());
    await context.addInitScript(() => localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false })));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto('http://127.0.0.1:4492/');
    await page.locator('#gaia-opening-sound-modal').waitFor({ state: 'visible' });
    await page.locator(`[data-gaia-language="${language}"]`).click();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    assert.equal(await page.locator('#gaia-opening-sound-title').textContent(), language === 'en' ? 'Sound settings' : '声音设置');
    await page.screenshot({ path: `${out}/${width}-${language}-sound.png` });
    await page.locator('#gaia-opening-sound-off').click();
    await page.locator('#gaia-opening.is-active').waitFor({ state: 'attached', timeout: 20000 });
    await page.waitForTimeout(2200);
    const opening = await page.evaluate(() => {
      const title = document.querySelector('.gaia-vn-prologue-lockup h2');
      const copy = document.querySelector('.gaia-vn-prologue-copy');
      return { title: title.textContent, copy: copy.textContent, width: innerWidth, heading: title.getBoundingClientRect().toJSON(), scrollWidth: title.scrollWidth, clientWidth: title.clientWidth };
    });
    assert.equal(opening.title, language === 'en' ? '“Nice to meet you.”' : '“初次见面。”');
    assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(opening.copy));
    assert(opening.scrollWidth <= opening.clientWidth + 1, `Opening heading overflows: ${JSON.stringify(opening)}`);
    await page.screenshot({ path: `${out}/${width}-${language}-opening.png` });
    await page.goto('http://127.0.0.1:4492/#story');
    await page.waitForFunction(() => !!globalThis.GaiaNovel);
    await page.evaluate(() => GaiaNovel.open(null, { autoStartFresh: true }));
    await page.waitForFunction(() => document.querySelector('#novel-text')?.dataset.revealState === 'complete', null, { timeout: 30000 });
    const first = await page.evaluate(() => ({ state: GaiaNovel.getState(), text: document.querySelector('#novel-text').textContent, location: document.querySelector('#novel-location').textContent,
      expected: GaiaI18n.t(GAIA_NOVEL_STORY.scenes[0].steps[0].text) }));
    assert(first.expected.startsWith(first.text), 'The first rendered page must be the translated source, in order');
    assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(first.location));
    await page.screenshot({ path: `${out}/${width}-${language}-story.png` });
    const pagination = await page.evaluate(() => {
      const selected = GAIA_NOVEL_STORY.scenes.flatMap(scene => scene.steps.filter(step => ['narration', 'dialogue'].includes(step.type)).sort((a,b) => b.text.length - a.text.length).slice(0,3));
      return selected.map(step => {
        const source = GaiaI18n.t(step.text), result = GaiaNovel.inspectDialoguePagination(source);
        return { id: step.id, source, pages: result.pages.map(({ text, fits, horizontalOverflow }) => ({ text, fits, horizontalOverflow })) };
      });
    });
    for (const item of pagination) {
      assert.equal(item.pages.map(p => p.text).join(''), item.source, `Lost text: ${item.id}`);
      assert(item.pages.every(p => p.fits && !p.horizontalOverflow), `Page overflow: ${width}/${language}/${item.id}`);
    }
    await page.locator('#novel-save-button').click();
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('gaiaSensewareNovel:manual-saves'))[0]);
    assert.equal(save.progress.stepId, first.state.stepId);
    await page.locator('#novel-save-close').click();
    const nextLanguage = language === 'en' ? 'zh-CN' : 'en';
    await page.evaluate(lang => GaiaI18n.set(lang), nextLanguage);
    await page.waitForFunction(() => document.querySelector('#novel-text').dataset.revealState === 'complete');
    const changed = await page.evaluate(() => ({ state: GaiaNovel.getState(), text: document.querySelector('#novel-text').textContent,
      expected: GaiaI18n.t(GAIA_NOVEL_STORY.scenes[0].steps[0].text) }));
    assert.equal(changed.state.stepId, first.state.stepId);
    assert.equal(changed.state.sessionId, first.state.sessionId);
    assert(changed.expected.startsWith(changed.text));
    await page.locator('#novel-load-button').click();
    const preview = await page.locator('.novel-save-slot[data-slot-index="0"] p').textContent();
    assert(changed.expected.startsWith(preview), 'Save preview follows selected language');
    await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    await page.waitForFunction(() => document.querySelector('#novel-text').dataset.revealState === 'complete');
    assert.equal(await page.evaluate(() => GaiaNovel.getState().stepId), first.state.stepId);
    report.checks.push({ width, language, opening, location: first.location, pagination: pagination.map(({id,pages}) => ({id,pages:pages.length})), savedAndRestoredStep: first.state.stepId, changedLanguage: nextLanguage });
    console.log('Passed', width, language);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  report.hashes = Object.fromEntries(['gaia-i18n.js','novel-mode.js','true-end-mode.js','dialogue-typography.js','gaia-i18n.css'].map(file => [file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
