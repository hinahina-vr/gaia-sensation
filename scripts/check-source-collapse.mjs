import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import fs from 'node:fs';
const out='artifacts/source-collapse-20260913';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await page.route('https://**',r=>r.abort());
 for(const [world,width] of [[12,1440],[28,390]]){
  await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:4492/#world-${world}`);await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
  await page.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
  await page.waitForTimeout(1500);await page.screenshot({path:`${out}/entry-${width}.png`});
  if(width<600)await page.getByRole('button',{name:'操作',exact:true}).click();
  const opener=page.getByRole('button',{name:/データの出典|^出典$/}).filter({visible:true}).first();await opener.click();
  const common=page.locator('.map-base-sources');await common.waitFor({state:'visible'});
  assert.equal(await common.evaluate(n=>n.open),false);assert.equal(await common.locator('.source-use-card').first().isVisible(),false);
  if(world===12){const own=page.locator('.data-ledger-card').filter({hasText:'GAIA SENSEWARE'});assert(await own.count()>0);assert.equal(await own.locator('a').count(),0);assert((await own.textContent()).includes('作品内の加工・計算'));assert(await page.locator('#data-ledger-sources a[href*="worldbank.org"]').count()>=2);}
  await page.locator('#japan-data-panel').screenshot({path:`${out}/closed-${width}.png`});
  await common.locator('summary').click();assert(await common.locator('.source-use-card').first().isVisible());
  await page.locator('#japan-data-panel').screenshot({path:`${out}/expanded-${width}.png`});
  await page.locator('#japan-data-close').click();if(width<600&&!await opener.isVisible())await page.getByRole('button',{name:'操作',exact:true}).click();await opener.click();assert.equal(await common.evaluate(n=>n.open),false);
 }
 console.log('PASS desktop/mobile collapse, expand, reopen closed, internal link withheld, original World Bank sources retained');
}finally{await browser.close();}
