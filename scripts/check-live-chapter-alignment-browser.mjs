import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/live-chapter-alignment',before=process.argv.includes('--before');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];
try{for(const width of [1440,2560,390]){
 const page=await browser.newPage({viewport:{width,height:900}});await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:4492/?exhibit=21#world');await page.locator('[data-feature-start]').click();
 await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
 for(const n of [21,15,16,17,18,19,20]){
  if(n!==21)await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
  await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n,n);await page.waitForTimeout(500);
  const state=await page.evaluate(n=>{
   const root=document.querySelector(n===21?'.gaia-estat-chapter':'.gaia-live-deck-chapter'),r=root.getBoundingClientRect();
   const read=el=>{if(!el)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height,font:s.fontSize,line:s.lineHeight,position:s.position,padding:s.padding,display:s.display,align:s.alignItems};};
   return {root:read(root),category:read(root.querySelector('p')),button:read(root.querySelector('[data-map-bank-toggle]')),number:read(root.querySelector('[data-estat-number],[data-live-deck-number]')),title:read(root.querySelector('strong'))};
  },n);
  if(!before&&width>=901&&n!==21){const reference=report.find(x=>x.width===width&&x.n===21);for(const key of ['category','number','title']){assert(Math.abs(state[key].x-reference[key].x)<1,`${width}/${n} ${key} x`);assert(Math.abs(state[key].y-reference[key].y)<1,`${width}/${n} ${key} y`);}}
  report.push({width,n,...state});
  if([21,15].includes(n))await page.screenshot({path:`${out}/${before?'before':'after'}-${width}-${n}.png`});
 }
 await page.close();
}fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));console.log(report.filter(x=>x.width===1440&&[21,15].includes(x.n)));}finally{await browser.close();}
