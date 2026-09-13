import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity, securityHeaders } from './lib/browser-security-qa.mjs';

const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const closing = process.argv.includes('--closing');
const group = closing ? 'concept-closing-trim' : 'concept-trim';
const output = path.resolve(`artifacts/${group}-${before ? 'before' : 'v14'}`);
fs.mkdirSync(output, { recursive: true });
const baselineHtml = fs.readFileSync(`artifacts/${group}-before/index.html`, 'utf8');
const baselineCss = closing && before ? fs.readFileSync('artifacts/concept-closing-trim-before/concept.css', 'utf8') : null;
const firstTargets = [
  ['.overview-facts', '作品の入口'],
  ['.world-heading > p', 'データを調べる。変化を読む。'],
  ['.experience-feel .experience-footnote', '海流 / 光 / 動き'],
  ['.experience-explore .experience-footnote', '地図 / 時系列 / 公開データ'],
  ['.experience-meet .experience-footnote', 'オンライン大学 / 学園祭 / 共同制作'],
  ['.illustration-note', '冒頭・01・02はローカル実装のスクリーンショット'],
  ['.learning-heading > p:not(.section-index)', '大学がひらく可能性を、物語として描く。'],
  ['.mechanism-lead', '最後の選択は、機械に渡さない。'],
  ['.origin-note', '着想の出発点は、DARPAのLifeLog。'],
  ['#mechanism .concept-limit', 'LifeLogから着想した本作独自の応答'],
];
const closingTargets = [
  ['.world-caption > div:nth-child(2)', '現在の作品では、地球の公開データを調べ'],
  ['#position .concept-limit', '図は将来構想のイメージで'],
  ['.footer-note', '図で紹介したAIの仕組みは、これからつくりたいものです。'],
];
const targets = closing ? closingTargets : before ? firstTargets : [...firstTargets, ...closingTargets];
const report = { status: 'running', revision: before ? closing ? 'concept-13-trim' : 'concept-12-home-link' : 'concept-14-closing-trim', before, closing, testedAt: new Date().toISOString(), environment: 'Local Chrome with desktop/mobile emulation and CSP. Not physical-device or production QA.', hashes: {}, checks: [], errors: [] };
for (const file of ['concept/index.html', 'concept/concept.css', 'concept/concept.js']) report.hashes[file] = createHash('sha256').update(before && file.endsWith('index.html') ? baselineHtml : baselineCss && file.endsWith('.css') ? baselineCss : fs.readFileSync(file)).digest('hex');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height] of (closing && !before ? [[1440, 900], [390, 844], [320, 568], [768, 1024]] : [[1440, 900], [390, 844]])) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    if (before) await context.route(`${base}/concept/`, route => route.fulfill({ body: baselineHtml, headers: securityHeaders, contentType: 'text/html; charset=utf-8' }));
    if (baselineCss) await context.route(`${base}/concept/concept.css*`, route => route.fulfill({ body: baselineCss, contentType: 'text/css; charset=utf-8' }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/concept/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    for (const [i, [selector, text]] of targets.entries()) {
      const target = page.locator(selector);
      assert.equal(await target.count(), before ? 1 : 0, `${width}: screenshot ${i + 1} target ${before ? 'reproduced' : 'removed'}: ${selector}`);
      if (before) {
        await target.scrollIntoViewIfNeeded();
        await page.waitForTimeout(80);
        assert((await target.innerText()).includes(text));
        await target.screenshot({ path: path.join(output, `${width}-target-${i + 1}.png`), style: '.site-header, .skip-link { visibility: hidden !important; }' });
      }
    }
    if (!before) {
      const preserved = await page.evaluate(({ baselineHtml, selectors }) => {
        const expected = new DOMParser().parseFromString(baselineHtml, 'text/html');
        for (const selector of selectors) expected.querySelector(selector).remove();
        const content = doc => ({
          text: doc.querySelector('main').textContent.replace(/\s+/gu, ''),
          footer: doc.querySelector('.site-footer').textContent.replace(/\s+/gu, ''),
          images: [...doc.querySelectorAll('main img')].map(img => [img.getAttribute('src'), img.alt, img.getAttribute('width'), img.getAttribute('height')]),
          links: [...doc.querySelectorAll('main a')].map(link => [link.getAttribute('href'), link.textContent]),
          headings: [...doc.querySelectorAll('main h1, main h2, main h3')].map(heading => heading.textContent),
        });
        return { expected: content(expected), actual: content(document) };
      }, { baselineHtml, selectors: targets.map(([selector]) => selector) });
      assert.deepEqual(preserved.actual, preserved.expected, 'Only the requested blocks change; retain all other text, headings, images and links');
      assert.equal(await page.locator('.site-signature').getAttribute('href'), '../');
      assert.equal(await page.locator('#learning .source-link').count(), 9);
      assert.equal(await page.locator('#position .concept-limit, .footer-note, .world-caption > div:nth-child(2)').count(), 0, 'Keep the later closing-copy deletions');
      assert.equal(await page.locator('.footer-bottom').evaluate(el => getComputedStyle(el).marginTop), '0px', 'Do not leave the removed footer-note spacing');
      for (const selector of (closing ? ['#position', '.world-caption', '.world-closing-title', '.site-footer'] : ['#top', '.world-heading', '.world-experiences', '.learning-heading', '.mechanism-heading', '.agency-layout', '.agency-note'])) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
        await page.locator(selector).screenshot({ path: path.join(output, `${width}-${selector.slice(1)}.png`), style: '.site-header, .skip-link { visibility: hidden !important; }' });
      }
      await page.locator('[data-open-diagram]').click();
      await page.locator('.viewer-stage img').evaluate(img => img.decode());
      await page.locator('[data-zoom-diagram]').click();
      assert.equal(await page.locator('[data-zoom-diagram]').getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-open-diagram]').evaluate(el => document.activeElement === el), true);
      const closingLines = await page.locator('.world-closing-title').evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el);
        return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
      });
      assert.equal(closingLines, 1);
      if (closing) {
        await page.locator('.footer-bottom a[href="#top"]').click();
        await page.waitForURL(`${base}/concept/#top`);
        await page.waitForFunction(() => document.querySelector('.site-header')?.dataset.theme === 'light');
      }
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ width, height, targetCount: targets.length, result: before ? 'reproduced' : 'removed', unselectedContentPreserved: !before, viewerAndClosingLine: !before });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'reproduced' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, checks: report.checks, failure: report.failure, output }));
}
