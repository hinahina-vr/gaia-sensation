import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/ame-quote-wrap-2026-09-10/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, base, checks: [], errors: [], sha256: Object.fromEntries(['index.html','opening.css'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), environment: 'Local installed Chrome, real opening playback and rendered glyph positions; mobile viewport/touch emulation; production CSP.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width,height] of before ? [[1440,900]] : [[1440,900],[3840,2160],[390,844],[320,568]]) {
    const context = await browser.newContext({ viewport: { width,height }, hasTouch: width < 600, isMobile: width < 600 });
    await enforceBrowserSecurity(context, base);
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-opening-sound-off').click();
    await page.waitForFunction(() => {
      const panel = document.querySelector('.gaia-vn-panel-sora');
      const quote = panel.querySelector('strong');
      return Number(getComputedStyle(panel).opacity) > .98 && Number(getComputedStyle(quote.parentElement).opacity) > .98 && Number(getComputedStyle(quote).opacity) > .98 && !quote.classList.contains('is-opening-focus-pending');
    }, null, { timeout: 60000 });
    // Freeze the reached, naturally playing scene for deterministic visual QA.
    await page.evaluate(() => document.getAnimations().forEach(animation => animation.pause()));
    await page.evaluate(() => document.fonts.ready);
    const scan = await page.locator('.gaia-vn-panel-sora strong').evaluate(quote => {
      const walker = document.createTreeWalker(quote, NodeFilter.SHOW_TEXT);
      const glyphs = []; let node;
      while ((node = walker.nextNode())) for (let i = 0; i < node.length; i++) {
        const range = document.createRange(); range.setStart(node,i); range.setEnd(node,i+1);
        const r = range.getBoundingClientRect();
        glyphs.push({ char: node.textContent[i], top: Math.round(r.top), left:r.left, right:r.right });
      }
      const lines = [...new Set(glyphs.map(g => g.top))].map(top => glyphs.filter(g => g.top === top).map(g => g.char).join(''));
      return { text:quote.textContent, lines, glyphs, bounds: quote.getBoundingClientRect().toJSON(), fontSize:getComputedStyle(quote).fontSize, mizu:document.querySelector('.gaia-vn-panel-minamo strong').textContent, mizuKeep: document.querySelector('.gaia-vn-panel-minamo .gaia-vn-quote-keep').textContent };
    });
    await page.screenshot({ path: path.join(output, `${width}-ame.png`) });
    await page.locator('.gaia-vn-panel-sora strong').screenshot({ path: path.join(output, `${width}-quote.png`) });
    assert.equal(scan.text, '「数値で見ると、地球が呼吸してるリズムがちゃんとわかるね。」');
    if (before) assert(scan.lines.some(line => line.endsWith('呼吸して')) && scan.lines.some(line => line.startsWith('るリズム')), 'Reproduce the reported mid-phrase break');
    else {
      assert(scan.lines.some(line => line.endsWith('呼吸してる')), 'Keep the whole phrase together at the end of a line');
      assert(scan.lines.some(line => line.startsWith('リズム')), 'Start the following line at リズム');
      assert(scan.glyphs.every(g => g.left >= -1 && g.right <= width+1), 'No horizontal clipping');
      if (width >= 390) assert.equal(scan.lines.length, 2);
      assert.equal(scan.mizuKeep, '影響し合って', 'Preserve the existing Mizu line-wrap rule');
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    report.checks.push({ width,height,...scan });
    console.log(`PASS ${before ? 'before' : 'after'}/${width}: ${scan.lines.join(' / ')}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch(e) { report.status = 'failed'; report.failure = e.stack; process.exitCode = 1; }
finally { await browser.close(); fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2)); console.log(JSON.stringify({status: report.status, failure: report.failure})); }
