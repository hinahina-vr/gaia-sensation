import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';

const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const sensor=process.env.GAIA_SENSOR_QA_BASE||'http://127.0.0.1:4458';
assert(['localhost','127.0.0.1'].includes(new URL(sensor).hostname));
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||'artifacts/mincho-ui-20260912/modes');
fs.mkdirSync(output,{recursive:true});
const report={status:'running',checks:[],errors:[],scope:'Local Chrome under production CSP; sensor account/data are fixtures. Seeded isolated story save; real UI, controls and chart painting. Emulated viewports, not real devices or production.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const capture=async(label,width)=>{
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
  const scan=await page.evaluate(()=>{
    const rows=[],jp=/[ぁ-んァ-ヶ一-龯]/u;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode.parentElement,text=walker.currentNode.textContent;
      if(!jp.test(text)||!node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||['STYLE','SCRIPT','OPTION','CANVAS','TITLE'].includes(node.tagName))continue;
      const r=node.getBoundingClientRect(),s=getComputedStyle(node);
      if(r.width<=1||r.height<=1||r.bottom<0||r.top>innerHeight||s.clipPath==='inset(50%)')continue;
      rows.push({text:text.trim().slice(0,95),id:node.id,className:String(node.className),font:s.fontFamily,size:s.fontSize,rect:r.toJSON()});
    }
    return {rows,nonMincho:rows.filter(x=>!/Mincho|明朝|(?<!sans-)serif/iu.test(x.font)),overflow:document.documentElement.scrollWidth-innerWidth,canvas:globalThis.__paintedFonts||[]};
  });
  report.checks.push({label,width,...scan});
  await page.screenshot({path:path.join(output,`${width}-${label}.png`)});
  console.log(`${width} ${label}: ${scan.rows.length} Japanese runs; ${scan.nonMincho.length} non-Mincho`);
  assert(scan.rows.length>0,`${label} had no rendered Japanese copy`);
  assert.equal(scan.overflow,0,`${label} document overflow`);
  assert.deepEqual(scan.nonMincho,[],`${label} still has Gothic copy`);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
};
try{
 for(const [width,height] of [[1440,900],[390,844]].filter(([w])=>!process.env.QA_WIDTHS||process.env.QA_WIDTHS.split(',').map(Number).includes(w))){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:'reduce'});
  await enforceBrowserSecurity(context,base);await enforceBrowserSecurity(context,sensor);
  await context.route('https://**',r=>r.abort());
  await context.route('**/api/live/v1/firms',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  await context.addInitScript(version=>{
    localStorage.setItem('gaia-senseware-bgm-muted','true');
    sessionStorage.setItem('gaia:mode-entry-guide:sensor:v3','seen');
    localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
    localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify({storyVersion:version,stepId:'festival_concept_new_025',reachedSceneIds:[],viewed:{},metCharacters:{amane:true,mizuha:true,sakuya:true},evesRoute:[],reflectionIds:[],readStepIds:[],clear:false,archivesUnlocked:false,audio:{muted:true,volume:0}}));
    globalThis.__paintedFonts=[];
    const fill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){
      if(this.canvas.id==='gaia-statistics-canvas'){
        const key={text:String(text),font:this.font};
        if(!__paintedFonts.some(x=>x.text===key.text&&x.font===key.font))__paintedFonts.push(key);
      }
      return fill.call(this,text,...args);
    };
  },GAIA_NOVEL_STORY.storyVersion);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(`${width}: ${e.message}`));
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.locator('#gaia-boot').waitFor({state:'hidden'});await capture('opening',width);
  for(const [mode,ready] of [['sound','#sound-layer.is-open'],['character','#character-book-layer.is-open'],['space','#space-layer:not([hidden])'],['gx','#gx-layer.is-open']]){
    await page.goto(base+'/?qa-mincho='+mode+(['space','gx'].includes(mode)?'#top':'#'+mode),{waitUntil:'domcontentloaded'});
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    // These embedded scenes have no #space/#gx route; use their supported scene APIs.
    if(['space','gx'].includes(mode))await page.evaluate(async mode=>{await GaiaModeLoader.load(mode);const opening=document.querySelector('#gaia-opening');opening.hidden=true;opening.classList.remove('is-active');document.body.classList.remove('gaia-opening-active');if(mode==='gx')await GaiaGX.open({returnTo:'intro',phase:0});else await GaiaSpace.open(0);},mode);
    await page.locator('#gaia-boot').waitFor({state:'hidden'});await page.locator(ready).waitFor();
    await capture(mode,width);
    if(mode==='space'&&width>900){
      const layout=await page.evaluate(()=>{const h=document.querySelector('.space-header').getBoundingClientRect(),r=document.querySelector('.space-readout').getBoundingClientRect();return {heading:h.toJSON(),reading:r.toJSON()};});
      assert(layout.reading.top>=layout.heading.bottom+20,'SPACE reading does not overlap its heading');
      report.checks.push({label:'space-header-clearance',width,...layout});
      await page.locator('.space-readout').hover();await page.mouse.wheel(0,900);await capture('space-reading-bottom',width);
    }
    if(mode==='character'){
      await page.locator('.character-book-concept').scrollIntoViewIfNeeded();
      await capture('character-concept',width);
    }
  }
  await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.runtimeReveal==='revealed'&&document.querySelector('#novel-text')?.dataset.revealState==='complete');
  await capture('story',width);
  await page.locator('#novel-config-button').click();await capture('story-settings',width);
  await page.locator('#novel-config-close').click();
  await page.locator('#novel-save-button').click();await capture('story-save',width);
  await page.locator('#novel-save-close').click();
  await page.goto(base+'/?exhibit=8#world',{waitUntil:'domcontentloaded'});
  await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
  await page.evaluate(async()=>{await GaiaMapObservationAdapter.waitSignalsReady();GaiaMapDemo.stop();GaiaMapCategories.buttons()[7].click();});
  await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
  if(width>980)await page.locator('.map-dock-action--statistics').click();
  else {await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('#map-mobile-sheet').getByRole('button',{name:'統計分析',exact:true}).click();}
  await page.waitForFunction(()=>Number(document.querySelector('#gaia-statistics-canvas')?.dataset.pointCount)>0);
  await capture('statistics',width);
  const painted=await page.evaluate(()=>__paintedFonts);
  assert(painted.some(x=>/[一-龯]/u.test(x.text)),'Actually painted Japanese axis/legend');
  assert(painted.every(x=>/Mincho|明朝|serif/iu.test(x.font)),'All actual canvas labels use Mincho');
  for(const view of ['login','map','devices','add','profile','guide','terms']){
    await page.goto(sensor+'/sensors/'+(['devices','add','profile'].includes(view)?'?authenticated=1':'')+'#'+view,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(view=>document.documentElement.dataset.sensorView===view,view);
    await page.locator('[data-gaia-mode-guide-replay="sensor"]').waitFor();
    await capture('sensor-'+view,width);
    if(view==='devices'){
      const register=page.getByRole('link',{name:'センサーを登録',exact:true});
      if(await register.count()){await register.click();await capture('sensor-registration',width);}
    }
  }
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
finally{
 const files=[...fs.readdirSync('.').filter(f=>/\.(css|js)$/.test(f)),'index.html','sensors/index.html',...fs.readdirSync('sensors').filter(f=>/\.css$/.test(f)).map(f=>'sensors/'+f)];
 report.hashes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
