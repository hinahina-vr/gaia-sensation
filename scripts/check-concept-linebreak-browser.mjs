import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity, securityHeaders } from './lib/browser-security-qa.mjs';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const baseline = 'aaa9153116c704f14d82f48969a396b907388451';
const files = ['concept/index.html', 'concept/concept.css', 'concept/concept.js'];
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/concept-linebreak-${before ? 'before' : 'v19'}`);
fs.mkdirSync(output, { recursive: true });
const sources = Object.fromEntries(files.map(file => [file, before
  ? execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8', maxBuffer: 5_000_000 })
  : fs.readFileSync(file, 'utf8')]));
const report = { status: 'running', before, baseline, testedAt: new Date().toISOString(),
  environment: 'Local Chrome on Windows with mobile/desktop viewport emulation and CSP. Baseline HTML/CSS/JS served from the recorded commit; current version from local HTTP. Not a physical phone or production test.',
  hashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(sources[file]).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

// Inspect each painted character, so a passing declaration cannot hide a split
// word, a lonely sentence ending, clipping, or an oversized no-wrap phrase.
async function measureCopy(page, selector) {
  return page.locator(selector).evaluate(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const chars = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (let i = 0; i < node.length; i++) {
        if (/\s/u.test(node.data[i])) continue;
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        chars.push({ text: node.data[i], top: Math.round(rect.top), left: rect.left, right: rect.right });
      }
    }
    const lines = [];
    for (const char of chars) {
      if (lines.at(-1)?.top !== char.top) lines.push({ top: char.top, text: '' });
      lines.at(-1).text += char.text;
    }
    const bounds = el.getBoundingClientRect();
    return { text: chars.map(char => char.text).join(''), chars, lines: lines.map(line => line.text),
      fontSize: parseFloat(getComputedStyle(el).fontSize), left: bounds.left, right: bounds.right };
  });
}

try {
  for (const width of (before ? [360, 390] : [280, 320, 360, 390, 412, 480, 768, 900, 1440])) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 },
      isMobile: width < 600, hasTouch: width < 900, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    if (before) await context.route(`${base}/concept/**`, route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname === '/concept/' ? 'concept/index.html' : pathname.slice(1);
      if (!(file in sources)) return route.fallback();
      return route.fulfill({ body: sources[file], headers: securityHeaders,
        contentType: file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' });
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(`${width}: ${response.status()} ${response.url()}`); });
    await page.goto(`${base}/concept/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.threshold-copy').evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - document.querySelector('.site-header').getBoundingClientRect().height - 20, behavior: 'instant' }));
    await page.waitForTimeout(100);
    const heading = await measureCopy(page, '#surface-title');
    const description = before ? await measureCopy(page, '.threshold-copy > p:not(.eyebrow)') : null;
    const note = await measureCopy(page, '.project-note p:first-of-type');
    report.checks.push({ width, heading, description, note });
    await page.screenshot({ path: path.join(output, `${width}-threshold.png`) });
    if (before) {
      assert.equal(heading.text, '地球を見ていたはずが、いつの間にか、自分を見ている。');
      assert.equal(description.text, '大学での学びを、ひとつの体験へ。その体験から生まれる実感や問いは、さらに奥にある構想へつながります。');
      assert.equal(note.text, '授業で得た視点を、作品としてどう表現できるか。情報を伝えるだけでなく、情報が「自分にとって意味を持つ体験」になる可能性を探っています。');
      if (width === 360) assert.deepEqual(heading.lines, ['地球を見ていたはずが、', 'いつの間にか、自分を見てい', 'る。'], 'Reproduce the reported orphan ending at 360px');
    } else {
      assert.equal(heading.text, '世界を知り、どんな未来をつくるのか。');
      assert.equal(await page.locator('.threshold-copy > p:not(.eyebrow)').count(), 0, 'Remove the entire requested bridge paragraph, not just its text');
      assert.equal((await page.locator('.threshold-copy .text-link').textContent()).trim(), '構想へ ↓');
      assert.match(note.text, /卒業プロジェクトを見据えて制作するコンセプトモデル/u);
      assert(heading.fontSize >= 22 && note.fontSize >= 14, 'Keep the existing readable type sizes');
      for (const [copy, phrases] of [[heading, ['世界を知り、', 'どんな未来を', 'つくるのか。']],
        [note, []]]) {
        for (const phrase of phrases) assert(copy.lines.some(line => line.includes(phrase)), `${width}: phrase must remain on one painted line: ${phrase}`);
        assert(copy.chars.every(char => char.left >= copy.left - 1 && char.right <= copy.right + 1 && char.left >= -1 && char.right <= width + 1), `${width}: painted copy stays inside its column and viewport`);
        assert(copy.lines.every(line => !/^[、。）」』]/u.test(line) && line.length > 2), `${width}: no orphan punctuation or sentence ending`);
      }
      if (width >= 768) assert.equal(heading.lines.length, 2, 'Wide layouts keep the original two-line heading');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${width}: horizontal page overflow`);
      await page.locator('.threshold-copy .text-link').click();
      await page.waitForTimeout(100);
      assert.equal(new URL(page.url()).hash, '#depth');
      const depthTop = await page.locator('#depth').evaluate(el => el.getBoundingClientRect().top);
      const headerBottom = await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().bottom);
      assert(depthTop >= headerBottom - 1 && depthTop < headerBottom + 150, `${width}: depth link still clears fixed navigation`);
      assert.equal(await page.locator('.site-header').getAttribute('data-theme'), 'deep');
      await page.locator('.project-note').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${width}-project-note.png`) });
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'reproduced' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, output, checks: report.checks.map(({ width, heading }) => ({ width, lines: heading.lines })), failure: report.failure }, null, 2));
}
