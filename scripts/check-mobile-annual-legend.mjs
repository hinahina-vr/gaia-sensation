import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='artifacts/map-followups-20260913/mobile';fs.mkdirSync(dir,{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await p.route('https://**',r=>r.abort());
 await p.goto('http://127.0.0.1:4492/#world-38');await p.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
 await p.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
 await p.locator('[data-mobile-sheet="reading"]').click();
 const sheet=p.locator('#map-mobile-sheet');await sheet.waitFor({state:'visible'});
 assert.match(await sheet.innerText(),/気温 年平均値/);
 assert.equal(await sheet.locator('.gaia-annual-metric-legend').count(),1);
 assert.equal(await sheet.locator('.gaia-annual-metric-legend summary').count(),0);
 assert(await sheet.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
 await p.screenshot({path:`${dir}/reading.png`});
 fs.writeFileSync(`${dir}/verification.json`,JSON.stringify({width:390,height:844,status:'PASS',checks:['annual legend accessible from reading sheet','no old details','no horizontal overflow']}));
 console.log('PASS mobile annual legend reading sheet');
}finally{await b.close();}
