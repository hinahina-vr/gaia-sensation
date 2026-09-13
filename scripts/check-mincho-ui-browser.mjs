import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/mincho-ui-20260912/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,checks:[],errors:[],scope:'Installed Chrome and production CSP on local application files. External feeds blocked, repository fire snapshot. Responsive/touch emulation, not physical devices or production.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const capture=async(label,width,keepPointer=false)=>{
  if(!keepPointer)await page.mouse.move(0,0);await page.waitForTimeout(180);
  const scan=await page.evaluate(()=>{
    const rows=[],jp=/[ぁ-んァ-ヶ一-龯]/u;
    const add=(node,text,pseudo=null)=>{
      if(!jp.test(text)||!node.checkVisibility({checkVisibilityCSS:true}))return;
      const rect=node.getBoundingClientRect(),s=getComputedStyle(node,pseudo);
      if(rect.width<=1||rect.height<=1||rect.bottom<0||rect.top>innerHeight||s.clipPath==='inset(50%)')return;
      if(['OPTION','SCRIPT','STYLE','TITLE','CANVAS'].includes(node.tagName))return;
      rows.push({tag:node.tagName,id:node.id,className:typeof node.className==='string'?node.className:'',text:text.trim().slice(0,110),pseudo,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,rect:rect.toJSON(),overflowX:node.scrollWidth-node.clientWidth});
    };
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())add(walker.currentNode.parentElement,walker.currentNode.textContent);
    for(const node of document.querySelectorAll('[data-map-symbol]'))for(const pseudo of ['::before','::after'])add(node,getComputedStyle(node,pseudo).content,pseudo);
    return {rows,nonMincho:rows.filter(row=>!/Mincho|明朝|(?<!sans-)serif/iu.test(row.fontFamily)),overflow:document.documentElement.scrollWidth-innerWidth};
  });
  report.checks.push({label,width,...scan});
  await page.screenshot({path:path.join(output,`${width}-${label}.png`)});
  console.log(`${before?'BASELINE':'SCAN'} ${width} ${label}: ${scan.rows.length} Japanese text runs, ${scan.nonMincho.length} non-Mincho`);
  if(!before){assert.equal(scan.overflow,0);assert.deepEqual(scan.nonMincho,[],`${label}: non-Mincho Japanese copy`);}
  return scan;
};
try{
  const sizes=before?[[1440,900],[3840,2160],[390,844]]:[[1440,900],[3840,2160],[1024,768],[390,844],[320,568]];
  for(const [width,height] of sizes.filter(([width])=>!process.env.QA_WIDTHS||process.env.QA_WIDTHS.split(',').map(Number).includes(width))){
    const mobile=width<=900;
    const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile,reducedMotion:'reduce'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',route=>route.abort());
    await context.route('**/api/live/v1/firms',route=>route.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
    page=await context.newPage();page.on('pageerror',error=>report.errors.push(`${width}: ${error.message}`));
    await page.goto(base+'/?exhibit=8#world',{waitUntil:'domcontentloaded'});
    await page.locator('[data-feature-start]').click();
    await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
    await page.waitForFunction(()=>globalThis.GaiaMapCategories?.buttons().length===71);
    await page.evaluate(async()=>{await GaiaMapObservationAdapter.waitSignalsReady();GaiaMapDemo.stop();GaiaMapCategories.buttons()[7].click();});
    await page.waitForFunction(()=>Number(document.querySelector('#japan-mode-number').textContent)===8&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
    const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#japan-title'});
    report.checks.push({width,label:'reference-title-rendered-fonts',...(await cdp.send('CSS.getPlatformFontsForNode',{nodeId}))});
    await capture('map-8',width);
    const menu=page.locator(mobile?'#map-mobile-sheet':'.map-dock-bank-popover');
    if(mobile)await page.locator('[data-mobile-sheet="exhibits"]').click();else await page.locator('.map-dock-bank-trigger').click();
    await menu.waitFor({state:'visible'});
    for(const scope of ['world','japan']){
      await menu.locator(`[role="tab"][data-map-scope="${scope}"]`).click();
      const tiles=await menu.locator(mobile?'[data-mobile-exhibit]:visible':'.map-mode-button:visible').evaluateAll(nodes=>nodes.map(node=>{
        const s=getComputedStyle(node,'::before'),r=node.getBoundingClientRect(),ctx=document.createElement('canvas').getContext('2d');ctx.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        return {label:node.dataset.mapSymbol,width:r.width,height:r.height,font:s.fontFamily,textWidth:ctx.measureText(node.dataset.mapSymbol).width};
      }));
      report.checks.push({label:`${scope}-tile-geometry`,width,tiles});
      if(!before)for(const tile of tiles){assert(tile.width>=44&&tile.height>=44);assert(tile.textWidth<=tile.width-6,`${width} ${tile.label} clipped`);}
      await capture(`menu-${scope}`,width);
      if(scope==='world'&&!mobile){
        await menu.locator('[data-map-symbol="森林"]').hover();
        await page.waitForTimeout(300);
        await capture('menu-forest-hover',width,true);
      }
    }
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
    if(mobile)await page.locator('[data-mobile-sheet="reading"]').click();else await page.locator('#map-reading-guide > summary').click();
    await capture('reading',width);
    if(mobile)await page.locator('[data-mobile-sheet-close]').click();else await page.locator('#map-reading-guide > summary').click();
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{
  report.hashes=Object.fromEntries(['typography.css','styles.css','opening.css','map-exhibit-categories.css','map-ui-grid-polish.css','map-mobile-shell.css','app.js','gaia-mode-loader.js','index.html','sensors/sensor-platform.css'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
