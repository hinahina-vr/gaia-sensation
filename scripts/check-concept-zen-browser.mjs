import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity, securityHeaders } from './lib/browser-security-qa.mjs';

const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const liveLinks = process.argv.includes('--live-links');
assert(!(before && liveLinks), 'The old copy has no university-source links');
const output = path.resolve(process.env.GAIA_CONCEPT_ZEN_OUTPUT || `artifacts/concept-zen-background-${before ? 'before' : liveLinks ? 'links' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
// A preserved local snapshot is necessary: HEAD predates several already
// completed edits and does not reproduce the version the user reviewed.
const files = ['concept/index.html', 'concept/concept.css', 'concept/concept.js'];
const sources = Object.fromEntries(files.map(file => [file, fs.readFileSync(before ? path.join(output, path.basename(file)) : file, 'utf8')]));
const report = { status: 'running', revision: before ? 'concept-11-user-reviewed-snapshot' : 'concept-15-original-v5-restoration', before, liveLinks, base,
  testedAt: new Date().toISOString(), environment: 'Local Chrome on Windows, viewport emulation, local CSP. Live official pages are contacted only with --live-links; no physical-device or production deployment test.',
  hashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(sources[file]).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const photo = async (selector, name) => {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await page.locator(selector).screenshot({ path: path.join(output, `${name}.png`), style: '.site-header, .skip-link { visibility: hidden !important; }' });
};
try {
  for (const width of liveLinks ? [1440] : before ? [1440, 390] : [1440, 390, 320, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width <= 390, hasTouch: width <= 768, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    if (!liveLinks) await context.route('https://**/*', route => route.abort());
    if (before) await context.route(`${base}/concept/**`, route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname === '/concept/' ? 'concept/index.html' : pathname.slice(1);
      if (!(file in sources)) return route.fallback();
      return route.fulfill({ body: sources[file], headers: securityHeaders, contentType: file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' });
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/concept/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const allText = await page.locator('main').innerText();
    if (liveLinks) {
      const destinations = [
        ['#liberal-arts .source-link:nth-of-type(1)', '知能情報社会学部'],
        ['#liberal-arts .source-link:nth-of-type(2)', '3つのポリシー'],
        ['#online-festival .source-link', '展軸祭'],
        ['#graduation-context .source-link', 'プロジェクト実践'],
        ...['共創地球論', '人新世の人類学', 'リテラシーと応用のための物語理論', '統計学入門'].map((title, i) => [`.learning-courses li:nth-child(${i + 1}) .source-link`, title]),
      ];
      const navigationResponses = [];
      context.on('response', response => {
        if (response.request().isNavigationRequest()) navigationResponses.push({ url: response.url(), status: response.status() });
      });
      for (const [selector, expected] of destinations) {
        const link = page.locator(selector);
        const href = await link.getAttribute('href');
        const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
        await popup.waitForLoadState('domcontentloaded');
        await popup.waitForFunction(expectedText => document.body.innerText.normalize('NFKC').includes(expectedText), expected, { timeout: 30000 });
        const title = await popup.title();
        const h1 = await popup.locator('h1').allTextContents();
        const status = navigationResponses.findLast(response => response.url === popup.url())?.status;
        assert.equal(status, 200, `Live official destination must load successfully: ${href}`);
        assert.equal(new URL(popup.url()).hostname, new URL(href).hostname, 'No unrelated or login destination');
        if (href.includes('syllabus.zen.ac.jp')) assert(h1.some(text => text.normalize('NFKC').trim() === expected), `Actual syllabus title must match: ${expected}`);
        assert.equal(await popup.evaluate(() => window.opener === null), true, 'The external page cannot control the concept page');
        await popup.screenshot({ path: path.join(output, `${report.checks.length + 1}-official-source.png`) });
        report.checks.push({ href, actualUrl: popup.url(), status, expected, title, h1, clicked: true });
        console.log(`PASS live official link: ${expected}`);
        await popup.close();
      }
    } else {
      await photo('#top', `${width}-overview`);
      await photo('.experience-meet', `${width}-linear-story`);
      await photo(before ? '.learning-copy' : '.university-pillars', `${width}-university`);
      await photo('.vision-steps', `${width}-ai-wording`);
      if (before) {
        assert.match(allText, /お前/u);
        assert.match(allText, /大奥/u);
        assert.match(await page.locator('.experience-meet').innerText(), /対話や選択/u);
        assert.match(await page.locator('.overview-description').innerText(), /自分にとっての実感.*卒業プロジェクト/u);
        assert.equal(await page.locator('a[href^="https://syllabus.zen.ac.jp/"]').count(), 0);
        assert.equal(await page.locator('.university-pillars').count(), 0);
        report.checks.push({ width, reproduced: ['rejected address and AI group name', 'nonexistent story choices', 'graduation claim before university context', 'personal-sensation framing', 'no official course links', 'missing university mission and festival context'] });
      } else {
        assert.doesNotMatch(allText, /お前|大奥|自分にとっての実感|意味を持つ体験|対話や選択|物語の中で選んだり/u);
        assert.match(await page.locator('.experience-meet').innerText(), /選択肢のない一本道のビジュアルノベル/u);
        assert.match(await page.locator('.university-story').innerText(), /生命・環境・技術.*文明の未来/u);
        assert.equal(await page.locator('.learning-copy, .learning-lead, a[href*="education_mission"]').count(), 0);
        assert.doesNotMatch(allText, /高等教育の機会を開く|一人ひとりの生活に合った学び|教育理念・教育目的/u);
        const order = ['.learning-heading', '.university-pillars', '.university-story', '.learning-courses', '.project-note', '#depth'];
        const positions = await Promise.all(order.map(selector => page.locator(selector).evaluate(el => el.getBoundingClientRect().top + scrollY)));
        assert(positions.every((y, i) => !i || y > positions[i - 1]), 'Retained heading precedes curriculum/festival, narrative, courses, project model and AI concept');
        const gap = await page.evaluate(() => document.querySelector('.university-pillars').getBoundingClientRect().top - document.querySelector('.learning-heading').getBoundingClientRect().bottom);
        assert(gap >= 0 && gap <= 64, `Removed introduction leaves no empty row: ${gap}`);
        await page.locator('.site-header a[href="#learning"]').click();
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(output, `${width}-learning-top.png`) });
        const links = await page.locator('#learning .source-link').evaluateAll(nodes => nodes.map(el => ({ href: el.href, target: el.target, rel: el.rel, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
        assert.equal(links.length, 8);
        assert(links.every(link => link.target === '_blank' && link.rel.includes('noopener') && link.rel.includes('noreferrer') && link.height >= 44 && link.width > 100), 'Primary-source links have usable touch targets and safe new tabs');
        const typography = [];
        for (const selector of ['.university-pillars', '.university-story', '.learning-courses', '.project-note']) {
          await photo(selector, `${width}-${selector.slice(1)}`);
          const bounds = await page.locator(`${selector} p, ${selector} h3, ${selector} a`).evaluateAll(nodes => nodes.map(el => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const rects = [];
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (!node.textContent.trim()) continue;
              const range = document.createRange(); range.selectNodeContents(node);
              rects.push(...[...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right })));
            }
            const column = el.getBoundingClientRect();
            return { text: el.textContent.trim().slice(0, 60), size: parseFloat(getComputedStyle(el).fontSize), clipped: rects.some(rect => rect.left < column.left - 1 || rect.right > column.right + 1 || rect.left < -1 || rect.right > innerWidth + 1) };
          }));
          assert(bounds.every(item => !item.clipped), `${width}: new university copy must not clip: ${JSON.stringify(bounds.filter(item => item.clipped))}`);
          typography.push(...bounds);
        }
        assert.match(await page.locator('#machine-diagram').getAttribute('src'), /myth-machine-circulation-v3\.png$/u);
        await page.locator('[data-open-diagram]').click();
        await page.locator('.viewer-stage img').evaluate(img => img.decode());
        await photo('.viewer-stage', `${width}-revised-image`);
        assert.match(await page.locator('.viewer-stage img').getAttribute('src'), /myth-machine-circulation-v3\.png$/u);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-open-diagram]').evaluate(el => el === document.activeElement), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
        assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
        report.checks.push({ width, readingOrder: order, links, typography, revisedImageAndViewer: true });
      }
      console.log(`PASS ${before ? 'reproduction' : 'revised university copy'} ${width}px`);
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
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
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, output }));
}
