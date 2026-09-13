import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const out = 'artifacts/i18n/sound-glyphs'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = { status: 'running', scope: 'Local Chrome, real desktop focus effect; reduced motion settles the glyph reveal. No audio output claim.', checks: [], errors: [] };
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await context.route('https://**', r => r.abort());
  await context.addInitScript(() => { sessionStorage.setItem('gaia:title-return-resume', '1'); localStorage.setItem('gaia-senseware-bgm-volume', '0'); });
  page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#sound'); await page.locator('#sound-layer.is-open').waitFor();
  const buttons = page.locator('[data-sound-track]');
  for (let i = 0; i < await buttons.count(); i++) {
    const button = buttons.nth(i); await button.focus();
    const track = await button.getAttribute('data-sound-track');
    for (const language of ['en', 'zh-CN', 'ja']) {
      await page.evaluate(language => GaiaI18n.set(language), language);
      await page.waitForFunction(track => { const b = document.querySelector(`[data-sound-track="${track}"]`); return b?.classList.contains('is-morph-focus') && b.querySelector('canvas')?.dataset.reveal === '1.000'; }, track);
      const result = await button.locator('canvas').evaluate(canvas => {
        const ctx = canvas.getContext('2d');
        const top = Math.floor(canvas.height * .15), height = Math.floor(canvas.height * .65);
        const pixels = ctx.getImageData(0, top, canvas.width, height).data.filter((v, i) => i % 4 === 3 && v > 30).length;
        return { title: canvas.dataset.title, geometry: canvas.dataset.geometry, pixels, width: canvas.width, height: canvas.height };
      });
      assert(result.pixels > 150, `Track ${track}/${language}: title did not draw`);
      if (language === 'ja') assert.equal(result.geometry, 'authored-strokes', 'Original Japanese hand-drawn paths must be preserved');
      report.checks.push({ track, language, ...result });
      if (language === 'zh-CN' && result.geometry === 'localized-font' && !report.screenshot) {
        await page.screenshot({ path: `${out}/zh-CN-native-glyphs.png` }); report.screenshot = 'zh-CN-native-glyphs.png';
      }
    }
  }
  assert(report.checks.some(row => row.language === 'zh-CN' && row.geometry === 'localized-font'));
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack; await page?.screenshot({ path: `${out}/failure.png` }).catch(() => {}); process.exitCode = 1; }
finally { await browser.close(); fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure })); }
