import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const baseline=process.argv.includes('--baseline');
const out=process.env.GAIA_CARD_TEXT_OUTPUT||'artifacts/intro-card-text';await fs.mkdir(out,{recursive:true});
const base=process.env.GAIA_PREVIEW_URL||'http://127.0.0.1:4492';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
for(const width of (baseline?[390]:[360,390,412,768,1440])) {
 const page=await browser.newPage({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768});
 await page.goto(base+'/');
 await page.locator('#gaia-opening-sound-off').click();
 await page.locator('#gaia-opening-skip').click();
 await page.locator('#gaia-opening-route-other').click();
 await page.locator('.intro-path-card').first().waitFor({state:'visible'});
 await page.waitForTimeout(1800);
 await page.locator('#intro-path-grid').scrollIntoViewIfNeeded();
 const result=await page.locator('.intro-path-card').evaluateAll(cards=>cards.map(card=>{
   const box=card.getBoundingClientRect();
   return {title:card.querySelector('strong').textContent,children:[...card.querySelectorAll(':scope > strong,:scope > p')].map(e=>{
     const r=document.createRange();r.selectNodeContents(e);
     const rects=[...r.getClientRects()];
     return {text:e.textContent,whiteSpace:getComputedStyle(e).whiteSpace,font:getComputedStyle(e).fontSize,overflow:e.scrollWidth>e.clientWidth+1||rects.some(r=>r.left<box.left||r.right>box.right+1||r.bottom>box.bottom+1)};
   })};
 }));
 await page.screenshot({path:`${out}/${baseline?'before':'after'}-${width}.png`});
 console.log(width,JSON.stringify(result));
 if(!baseline)assert(result.every(c=>c.children.every(t=>!t.overflow&&t.whiteSpace==='nowrap')),'All button text must fit on one line');
 await page.close();
}
}finally{await browser.close();}
