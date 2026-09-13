import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4487';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/release-prtr-20260909/candidate-browser');
fs.mkdirSync(output, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
const report = { status: 'running', base, conditions: 'Installed Chrome, desktop and touch emulation. Real HTTP image bytes and downloads; local runs add the current production CSP to real navigation responses. No content mocks.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, isMobile: width === 390, hasTouch: width === 390, acceptDownloads: true });
    if (!base.startsWith('https:')) await enforceBrowserSecurity(context, base);
    else await context.addInitScript(() => {
      window.__securityViolations = [];
      document.addEventListener('securitypolicyviolation', e => window.__securityViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }));
    });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    for (const kind of ['title', 'ending']) {
      const folder = `assets/${kind}-candidates-20260909`;
      const response = await page.goto(`${base}/${folder}/index.html`);
      assert.equal(response.status(), 200);
      assert(response.headers()['content-security-policy'], 'Production CSP is applied');
      await page.locator('main img').evaluateAll(async images => {
        images.forEach(image => { image.loading = 'eager'; });
        await Promise.all(images.map(image => image.decode()));
      });
      assert.equal(await page.locator('main figure').count(), 5);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(await page.evaluate(() => window.__securityViolations), [], 'Gallery scripts obey the real publication CSP');
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('figcaption a').first().click()]);
      const file = path.join(output, `${width}-${kind}.png`);
      await download.saveAs(file);
      const original = path.join(folder, JSON.parse(fs.readFileSync(`${folder}/prompts.json`)).variants[0].file);
      assert.equal(hash(fs.readFileSync(file)), hash(fs.readFileSync(original)));
      for (const link of await page.locator('footer a').evaluateAll(links => links.map(link => link.href))) {
        const result = await context.request.get(link);
        assert.equal(result.status(), 200, `Gallery footer link ${link}`);
      }
      await page.screenshot({ path: path.join(output, `${width}-${kind}-gallery.png`), fullPage: true });
      report.checks.push({ width, kind, status: 'pass', downloadSha256: hash(fs.readFileSync(file)) });
      console.log(`PASS ${width} ${kind} gallery, production CSP, links and PNG download`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'pass';
} catch (error) { report.status = 'fail'; report.failure = error.stack; throw error; }
finally { await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
