import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const before=process.argv.includes('--before'),out='artifacts/opening-icon-overlap-20260913';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
const results=[];
for(const [w,h] of [[390,844],[320,568],[667,375],[844,390],[768,1024],[1024,768],[1440,900]]) {
 const c=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true});await c.route('https://**',r=>r.abort());
 const p=await c.newPage();await p.goto('http://127.0.0.1:4492/');
 await p.locator('#gaia-opening-sound-off').click();await p.locator('#gaia-opening-skip').click();
 await p.locator('#gaia-opening-route-story').waitFor({state:'visible'});await p.waitForTimeout(1700);
 const read=()=>p.locator('.gaia-opening-route-grid .gaia-opening-route').evaluateAll(es=>es.map(e=>{const text=e.querySelector('strong'),range=document.createRange();range.selectNodeContents(text);const icon=e.querySelector('.gaia-opening-route-symbol').getBoundingClientRect();const rects=[...range.getClientRects()];return{id:e.id,overlap:rects.some(r=>r.right>icon.left&&r.left<icon.right&&r.bottom>icon.top&&r.top<icon.bottom)};}));
 const values=await read();results.push({w,h,values});await p.screenshot({path:`${out}/${before?'before':'after'}-${w}.png`});
 if(!before){assert(values.every(v=>!v.overlap));for(const lang of ['en','zh-CN']){await p.evaluate(l=>GaiaI18n.set(l),lang);await p.waitForTimeout(150);assert((await read()).every(v=>!v.overlap),`${w} ${lang}`);}}
 await c.close();
}
fs.writeFileSync(`${out}/${before?'before':'after'}.json`,JSON.stringify(results,null,2));console.log(results);
}finally{await b.close();}
