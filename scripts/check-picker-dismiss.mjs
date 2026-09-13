import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
const page=await browser.newPage({viewport:{width:1920,height:1080}});
await page.route('https://**',r=>r.abort());
await page.goto('http://127.0.0.1:4492/#world-28');
await page.waitForFunction(()=>globalThis.GaiaMapPicker && globalThis.GaiaEstatExhibits?.getStatisticsDataset(),null,{timeout:60000});
await page.locator('#gaia-boot').waitFor({state:'hidden'});
await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
const menu=page.locator('[data-map-menu-toggle]'), bank=page.locator('.map-mode-bank');
await menu.hover();
await page.waitForFunction(()=>document.getAnimations().some(a=>a.id==='map-picker-reveal'));
const end=await page.evaluate(()=>Math.max(...document.getAnimations().filter(a=>a.id==='map-picker-reveal').map(a=>a.effect.getComputedTiming().endTime)));
assert(end<=800 && end>=790,`Reveal ends at ${end}ms`);
await page.locator('#map-dock-bank-popover [role="tab"][aria-selected="true"]').hover();
await page.waitForTimeout(180);
assert(await bank.evaluate(n=>n.classList.contains('is-dock-bank-expanded')),'Moving inside keeps menu open');
await page.mouse.move(1910,1070);await page.waitForTimeout(180);
assert(!(await bank.evaluate(n=>n.classList.contains('is-dock-bank-expanded'))),'Pointer leaving closes menu');
await menu.focus();
await page.keyboard.press('ArrowDown');
assert(await bank.evaluate(n=>n.classList.contains('is-dock-bank-expanded')),'Keyboard entering keeps menu open');
await page.locator('[data-map-stable-step="1"]').focus();
assert(!(await bank.evaluate(n=>n.classList.contains('is-dock-bank-expanded'))),'Focus leaving closes menu');
await menu.hover();
assert(await bank.evaluate(n=>n.classList.contains('is-dock-bank-expanded')),'Menu reopens');
console.log(`PASS pointer/focus exit, internal movement, reopen; reveal ${end}ms`);
} finally {await browser.close();}
