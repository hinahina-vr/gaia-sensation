import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const output = 'artifacts/sensor-analysis-planned-20260912';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('http://127.0.0.1:4492/sensors/#map');
    const cards = page.locator('[data-feature-cards]');
    await cards.waitFor({ state: 'visible' });
    const card = cards.locator(':scope > *').nth(2);
    assert.match(await card.innerText(), /記録の分析・AIへの質問/);
    assert.doesNotMatch(await card.innerText(), /今後実装予定/);
    assert.match(await card.innerText(), /観測履歴の平均・範囲・変化を分析できます/);
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: `${output}/${width}.png` });
    console.log(`PASS ${width}: planned analysis card`);
    await page.close();
  }
} finally { await browser.close(); }
