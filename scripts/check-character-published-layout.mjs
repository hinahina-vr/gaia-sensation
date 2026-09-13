import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='artifacts/character-published-layout-20260913';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
const p=await b.newPage();await p.route('https://**',r=>r.abort());
const results=[];
for(const [width,height] of [[1920,1080],[1440,900],[3840,2160],[1024,768],[390,844],[844,390]]) {
 await p.setViewportSize({width,height});await p.goto('http://127.0.0.1:4492/#character');await p.locator('#character-book-layer.is-open').waitFor();await p.waitForTimeout(700);
 const layout=await p.locator('#character-book-layer').evaluate(n=>{const figure=n.querySelector('.character-book-hero-figure'),quote=n.querySelector('.character-book-hero-quote');return {writing:getComputedStyle(quote).writingMode,position:getComputedStyle(figure).position,overflow:n.scrollWidth>n.clientWidth+1};});
 assert(!layout.overflow);if(width>1100){assert.equal(layout.writing,'vertical-rl');assert.equal(layout.position,'absolute');}
 for(const button of await p.locator('[data-character-select]').all()){await button.click();await p.waitForTimeout(100);}
 await p.locator('[data-character-select]').first().click();await p.waitForTimeout(3500);
 await p.screenshot({path:`${out}/${width}.png`});results.push({width,height,...layout});
}
fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(results);
} finally {await b.close();}
