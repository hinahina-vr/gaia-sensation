import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { seedHeardSoundArchive } from './sound-archive-fixture.mjs';
const out = 'artifacts/sound-adoption-20260913';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await seedHeardSoundArchive(context);
    const page = await context.newPage();
    await page.route('https://**', route => route.abort());
    await page.goto('http://127.0.0.1:4492/#sound');
    await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#sound-layer')?.classList.contains('is-open'));
    await page.waitForTimeout(1600);
    const source = await page.locator('.sound-character-scene').evaluate(img => ({ src: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight }));
    assert(source.src.includes('sound-archive-bg-v3.png') && source.width > 1000 && source.height > 500);
    await page.screenshot({ path: `${out}/adopted-${width}.png` });
    await page.locator('[data-sound-track="opening"]').click();
    await page.waitForFunction(() => document.querySelector('#sound-layer')?.dataset.playing === 'true');
    await context.close();
    console.log(`PASS adopted candidate 1, loaded background and playback: ${width}px`);
  }
} finally { await browser.close(); }
