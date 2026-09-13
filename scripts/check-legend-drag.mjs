import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await page.route('https://**',r=>r.abort());
await page.goto('http://127.0.0.1:4492/#world-22');
await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
await page.evaluate(()=>{GaiaModeEntryGuide?.close('map',{restoreFocus:false});globalThis.GaiaMapPlayback?.stop?.();});
const legend=page.locator('.gaia-estat-heat-legend.map-draggable-legend:visible');
await legend.waitFor();await page.waitForTimeout(400);
const before=await legend.boundingBox();
await page.mouse.move(before.x+50,before.y+30);await page.mouse.down();
await page.mouse.move(before.x-130,before.y+120,{steps:12});await page.mouse.up();
const after=await legend.boundingBox();
assert(Math.abs(after.x-before.x+180)<3 && Math.abs(after.y-before.y-90)<3,'Legend follows mouse drag');
await page.keyboard.press('ArrowLeft');
assert(Math.abs((await legend.boundingBox()).x-after.x+10)<2,'Keyboard movement');
fs.mkdirSync('artifacts/legend-drag',{recursive:true});await page.screenshot({path:'artifacts/legend-drag/moved.png'});
const pos=await legend.boundingBox();await page.mouse.move(pos.x+40,pos.y+25);await page.mouse.down();await page.mouse.move(-200,-200,{steps:10});await page.mouse.up();
const edge=await legend.boundingBox();assert(edge.x>=7&&edge.y>=7,'Legend remains on screen');
await legend.dblclick({position:{x:edge.width-30,y:edge.height-25}});
assert.equal(await legend.evaluate(n=>n.style.translate),'','Double click resets');
console.log('PASS legend drag, keyboard, viewport clamp, reset');
}finally{await browser.close();}
