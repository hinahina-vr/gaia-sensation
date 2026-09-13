import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = 'http://127.0.0.1:4447';
const root = path.resolve('artifacts/concept-copy-trim-2026-09-09');
const output = process.env.GAIA_CONCEPT_COPY_OUTPUT ? path.resolve(process.env.GAIA_CONCEPT_COPY_OUTPUT) : path.join(root, before ? 'before' : 'after');
fs.mkdirSync(output, { recursive: true });
const baselineHtml = fs.readFileSync(path.join(root, 'before/index.html'), 'utf8');
const report = { status: 'running', version: before ? 'concept-15-before-copy-trim' : 'concept-16-summary-removed', testedAt: new Date().toISOString(), environment: 'Local installed Chrome; desktop/mobile viewport emulation, not physical devices or production.', checks: [], errors: [], hashes: {} };
for (const file of ['concept/index.html', 'concept/concept.css', 'concept/concept.js']) report.hashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expectedOverview = [
  '地球環境のオープンデータを可視化する観測システムと、ある海辺の展示ブースから始まる出会いを描いた体験型ビジュアルノベルです。',
  '宇宙から見下ろす衛星の観測データと、街角の日陰や部屋の机の上で測られた、ちっぽけな1点のセンサー値。 冷徹なデータの集積に、測定場所や理由という人間の生きた文脈を重ね合わせることで、無機質な数値は「地球の鼓動」へと変わっていきます。',
  '画面の向こうを巡る大気や海洋の循環を自ら動かし、そこに居合わせた仲間たちと言葉を交わす。 この惑星の途方もない時間の中で、いま私たちがどこに立ち、次にどんな一歩を踏み出すのかを問い直す物語です。',
];
const expectedExperience = [
  'CO₂濃度や気温偏差などの公開データを、地図と時間軸の上でインタラクティブに可視化。',
  '出典や観測単位を確かめながら、季節の呼吸と半世紀に及ぶ構造的変化を読み解く。',
  '大気の流れや海流の速さ・向きを動的なグラフィックとして描画。',
  '地域や国境を越えてすべてが連環する、地球規模の巨大な循環を感覚的に捉える。',
  '観測ツールを操作しながら読み進める、選択肢のない一本道のビジュアルノベル。',
  '展示の場で出会った仲間たちと共に、ただ数値を消費するのではなく、「次にどこを測り、どう生きるか」を思考していく。',
];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const photo = async (selector, name) => {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  await target.screenshot({ path: path.join(output, `${name}.png`), style: '.site-header, .skip-link { visibility: hidden !important; }' });
};
try {
  for (const [width, height] of before ? [[1440, 900], [390, 844]] : [[1440, 900], [1280, 900], [1024, 900], [768, 1024], [390, 844], [320, 568]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**/*', route => route.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(`${width}: ${response.status()} ${response.url()}`); });
    await page.goto(`${base}/concept/?v=${before ? 'concept-15' : 'concept-16'}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    if (before) {
      assert.equal(await page.locator('.overview-topics span').count(), 3);
      assert.equal(await page.locator('#position').count(), 1);
      assert.equal(await page.locator('.vision-agent').count(), 5);
      for (const [selector, name] of [['.overview-topics', 'topics'], ['.experience-explore', 'map'], ['#position', 'closing'], ['.vision-steps', 'english-labels']]) await photo(selector, `${width}-${name}`);
    } else {
      assert.equal(await page.locator('.overview-topics, #position, .world-caption, .world-closing-title, .return-to-world, .vision-agent').count(), 0);
      assert.equal(await page.locator('img[src*="myth-possible-worlds"]').count(), 0);
      assert.equal(await page.locator('.overview-summary').count(), 0);
      assert(!(await page.locator('body').innerText()).includes('地球の感覚器をつくる、私たちの放課後。'));
      assert(!(await page.locator('meta[name="description"]').getAttribute('content')).includes('地球の感覚器をつくる、私たちの放課後。'));
      assert.deepEqual(await page.locator('.overview-description').allTextContents(), expectedOverview);
      assert.deepEqual(await page.locator('.experience-copy > p:not(.experience-label)').allTextContents(), expectedExperience);
      assert.deepEqual(await page.locator('.experience-heading h3').allTextContents(), ['地球を、比較する', '地球の動きを、感じる', '対話から、深まる']);
      assert.equal(await page.locator('.overview-description strong').textContent(), '体験型ビジュアルノベル');
      const preserved = await page.evaluate(baseline => {
        const previous = new DOMParser().parseFromString(baseline, 'text/html');
        const removedLearningCopy = previous.querySelector('.learning-copy');
        const precedingWhitespace = removedLearningCopy?.previousSibling;
        if (precedingWhitespace?.nodeType === Node.TEXT_NODE && !precedingWhitespace.textContent.trim()) precedingWhitespace.remove();
        removedLearningCopy?.remove(); // Later author-selected whole-line deletion.
        const same = selector => document.querySelector(selector).outerHTML === previous.querySelector(selector).outerHTML;
        const priorMechanism = previous.querySelector('#mechanism');
        priorMechanism.querySelectorAll('.vision-agent').forEach(node => node.remove());
        const actualMechanism = document.querySelector('#mechanism').cloneNode(true);
        actualMechanism.querySelector('[data-open-diagram]').removeAttribute('hidden');
        priorMechanism.querySelector('[data-open-diagram]').removeAttribute('hidden');
        return { learning: same('#learning'), threshold: same('#surface'), depth: same('#depth'), seeds: same('#question'), footer: same('.site-footer'), mechanism: actualMechanism.outerHTML === priorMechanism.outerHTML };
      }, baselineHtml);
      assert(Object.values(preserved).every(Boolean), `Preserve everything outside requested edits: ${JSON.stringify(preserved)}`);
      assert.equal(await page.locator('.learning-copy, .learning-lead, a[href*="education_mission"]').count(), 0);
      assert.equal(await page.locator('.vision-step').count(), 6);
      for (const selector of ['#top', '.world-experiences', '.vision-steps', '.site-footer']) await photo(selector, `${width}-${selector.replace(/[.#]/gu, '')}`);
      for (const img of await page.locator('main img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(el => el.decode());
      }
      await page.locator('[data-open-diagram]').click();
      await page.locator('.viewer-stage img').evaluate(img => img.decode());
      await page.locator('[data-zoom-diagram]').click();
      assert.equal(await page.locator('[data-zoom-diagram]').getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('Escape');
      assert(await page.locator('[data-open-diagram]').evaluate(el => el === document.activeElement));
      await page.locator('.footer-bottom a[href="#top"]').click();
      assert((await page.locator('#page-title').boundingBox()).y >= 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    }
    const lines = await page.locator('.experience-copy > p:not(.experience-label)').evaluateAll(nodes => nodes.map(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      const bounds = el.getBoundingClientRect();
      return { text: el.textContent, lines: new Set(rects.map(rect => Math.round(rect.top))).size, size: parseFloat(getComputedStyle(el).fontSize), clipped: rects.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.left < -1 || rect.right > innerWidth + 1) };
    }));
    if (before && width === 1440) assert(lines[0].lines > 1 && lines[1].lines > 1, 'Reproduce the reported paragraph wrap');
    if (!before) {
      assert(lines.every(item => !item.clipped && item.size >= 14), 'Do not hide or shrink the supplied copy');
      if (width >= 1024) assert(lines.every(item => item.lines === 1), `${width}: each description is a single line: ${JSON.stringify(lines)}`);
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ width, height, lines, before, passed: true });
    await context.close();
    console.log(`PASS ${before ? 'before' : 'after'} ${width}`);
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
