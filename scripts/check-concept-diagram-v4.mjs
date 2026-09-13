import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const out='artifacts/concept-diagram-v4-20260913';await mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{for(const width of [1440,390]){
 const p=await b.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 await p.goto('http://127.0.0.1:4492/concept/');
 await p.waitForFunction(()=>document.body.dataset.enhanced==='true');
 const img=p.locator('#machine-diagram');await img.scrollIntoViewIfNeeded();
 await img.evaluate(n=>n.decode());
 assert.deepEqual(await img.evaluate(n=>[n.naturalWidth,n.naturalHeight]),[1536,1024]);
 assert.match(await img.getAttribute('src'),/myth-machine-circulation-v4\.png/);
 await img.screenshot({path:`${out}/diagram-${width}.png`});
 await p.locator('[data-open-diagram]').click();
 const dialog=p.locator('.diagram-viewer');assert(await dialog.isVisible());
 assert.equal(await dialog.locator('img').getAttribute('src'),await img.getAttribute('src'));
 await p.locator('[data-zoom-diagram]').click();assert.equal(await p.locator('[data-zoom-diagram]').getAttribute('aria-pressed'),'true');
 await p.locator('[data-close-diagram]').click();assert(!(await dialog.isVisible()));
 await p.close();console.log(`PASS diagram v4 load/open/zoom/close ${width}`);
}}finally{await b.close();}
