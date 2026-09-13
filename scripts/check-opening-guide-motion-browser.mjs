import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/release-story-unlock-20260910/guide-${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, base, checks: [], errors: [], violations: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const scan = () => page.evaluate(() => {
  const guide = document.querySelector('.gaia-opening-route-guide');
  const bubble = guide.querySelector('.gaia-opening-route-guide-bubble');
  const target = document.querySelector('.gaia-opening-route[aria-describedby~="gaia-opening-route-guide-copy"], .gaia-opening-route.is-route-guide-target');
  if (!target) return { visible: false };
  const b = bubble.getBoundingClientRect(), t = target.getBoundingClientRect();
  return { visible: !guide.hidden, target: target.id, placement: bubble.dataset.placement,
    gap: Math.min(Math.abs(b.top - t.bottom), Math.abs(t.top - b.bottom)),
    arrowDelta: Math.abs(b.left + parseFloat(getComputedStyle(bubble).getPropertyValue('--route-guide-arrow-left')) - (t.left + t.width / 2)),
    bubble: b.toJSON(), targetRect: t.toJSON(), fonts: document.fonts.status,
    menuTransform: getComputedStyle(document.querySelector('#gaia-opening-final-menu')).transform,
    targetTransform: getComputedStyle(target).transform,
  };
});
try {
  for (const [name, width, height, early] of [['wide-early', 2048, 839, true], ['pc-early', 1440, 900, true], ['wide-settled', 2048, 839, false]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-opening-sound-off').click();
    await page.locator('#gaia-opening-sound-modal').waitFor({ state: 'hidden' });
    await page.locator('#gaia-opening-skip').click();
    await page.locator('#gaia-opening-final-menu.is-visible').waitFor();
    if (!early) await page.waitForTimeout(1100);
    const target = await page.locator('#gaia-opening-route-story').boundingBox();
    // Real pointer input while the entrance is moving; deliberately no
    // Playwright actionability wait that might hide the early-hover path.
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    await page.locator('.gaia-opening-route-guide.is-visible').waitFor();
    const samples = [];
    for (let i = 0; i < 6; i++) { samples.push(await scan()); await page.waitForTimeout(250); }
    const settled = samples.at(-1);
    await page.screenshot({ path: path.join(output, name + '.png') });
    report.checks.push({ name, samples, settled });
    if (!before) {
      assert(settled.gap >= 17 && settled.gap <= 21, `${name}: settled pointer gutter ${settled.gap}`);
      assert(settled.arrowDelta <= 2, `${name}: pointer targets the settled button`);
    }
    report.violations.push(...await page.evaluate(() => window.__securityViolations || []));
    await context.close();
    console.log(`${name}: ${samples.map(s => s.gap.toFixed(1)).join(' → ')}`);
  }
  if (before) assert(report.checks.some(c => c.settled.gap > 21), 'Must reproduce the misplaced tooltip before changing runtime');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.violations, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
