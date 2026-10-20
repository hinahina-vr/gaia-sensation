import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before=process.env.GAIA_BEFORE==='1';
const out=process.env.GAIA_QA_OUTPUT_DIR||`artifacts/gx-gesture-guide-20261019/${before?'before':'after'}`;
fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'SHA + uncommitted changes',before,checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cases=[{name:'desktop',width:1440,height:900},{name:'phone',width:390,height:844,touch:true},
  {name:'landscape',width:844,height:390,touch:true},{name:'small-phone',width:320,height:568,touch:true,reduced:true}];
let page;
try {
  for(const item of cases.filter(item=>(!before||['desktop','phone'].includes(item.name))&&(!process.env.GAIA_GESTURE_VIEWPORTS||process.env.GAIA_GESTURE_VIEWPORTS.split(',').includes(item.name)))){
    const context=await browser.newContext({viewport:{width:item.width,height:item.height},hasTouch:!!item.touch,reducedMotion:item.reduced?'reduce':'no-preference'});
    await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);
    await context.route('https://**',r=>r.abort());
    if(before){
      const original=execFileSync('git',['show','HEAD:gx-mode.js'],{encoding:'utf8'});
      await context.route('**/gx-mode.js?*',r=>r.fulfill({contentType:'text/javascript',body:original}));
    }
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(process.env.GAIA_BASE_URL,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!globalThis.GaiaModeLoader);
    await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
    await page.evaluate(async()=>{
      await GaiaModeLoader.load('gx');
      document.querySelector('#gaia-opening').hidden=true;
      document.body.classList.remove('gaia-opening-active');
      const intro=document.querySelector('#intro-layer');
      if(intro)intro.hidden=true;
    });
    const session=await context.newCDPSession(page);
    for(const returnTo of ['novel','intro']){
      console.log(`${item.name} ${returnTo}`);
      await page.evaluate(async returnTo=>{
        document.body.dataset.novelInteractionState=returnTo==='novel'?'open':'';
        await GaiaGX.open({returnTo,storyMode:'gesture-qa',phase:2});
        document.querySelector('#gx-restart').click();
        GaiaGX.setPhase(2);
      },returnTo);
      await page.waitForFunction(()=>document.querySelector('#gx-layer').classList.contains('is-open')&&document.querySelector('#gx-loading').hidden);
      await page.waitForFunction(()=>!document.querySelector('.gx-time').classList.contains('is-counting'));
      await page.locator('#gx-era-progress').waitFor({state:'visible'});
      const progress=()=>page.locator('#gx-era-progress-value').innerText().then(Number.parseFloat);
      assert.equal(await progress(),0);
      const rect=await page.locator('#gx-canvas').boundingBox();
      const centerX=rect.width*(rect.width<=620?.5:returnTo==='novel'?.69:.76);
      const centerY=rect.height*(rect.width<=620?(rect.height<=650?.3:.36):returnTo==='novel'?.5:.48);
      const radius=rect.width<=620?rect.width*.32:Math.min(rect.width,rect.height)*(returnTo==='novel'?.37:.34);
      const start={x:rect.x+centerX-radius*.3,y:rect.y+centerY-radius*.25};
      await page.mouse.move(start.x,start.y);
      await page.mouse.move(start.x+radius*.4,start.y,{steps:6});
      assert.equal(await progress(),0,'Hover and the demonstration must not change progress');
      await page.screenshot({path:`${out}/${item.name}-${returnTo}-hint.png`});
      if(!before){
        assert.match(await page.locator('#gx-phase-guide').innerText(),item.touch?/指を置き.*離さず/:/左ボタンを押したまま/);
        assert.equal(await page.locator('#gx-layer').getAttribute('data-gesture-hint'),'visible');
        const guide=await page.locator('#gx-era-progress').boundingBox();
        assert(guide.x>=0&&guide.y>=0&&guide.x+guide.width<=item.width+1&&guide.y+guide.height<=item.height+1,'Instruction HUD stays in viewport');
        const touch=async(type,x,y)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
        if(item.touch)await touch('touchStart',start.x,start.y);
        else {await page.mouse.move(start.x,start.y);await page.mouse.down();}
        assert.equal(await page.locator('#gx-layer').getAttribute('data-gesture-hint'),'visible','Press alone does not dismiss a drag example');
        const downProgress=await progress();
        if(item.touch){await touch('touchMove',start.x+radius*.25,start.y);await touch('touchEnd',start.x+radius*.25,start.y);}
        else {await page.mouse.move(start.x+radius*.25,start.y);await page.mouse.up();}
        assert(await progress()>downProgress,'A held drag advances oxidation');
        assert.equal(await page.locator('#gx-layer').getAttribute('data-gesture-hint'),'done');
        await page.screenshot({path:`${out}/${item.name}-${returnTo}-operated.png`});
        for(const [language,term]of [['en',item.touch?/finger.*without lifting/:/left mouse button/],['zh-CN',item.touch?/手指/:/鼠标左键/],['ja',item.touch?/指を置き/:/左ボタン/]]){
          await page.evaluate(language=>GaiaI18n.set(language),language);
          assert.match(await page.locator('#gx-phase-guide').innerText(),term);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        }
        // Complete the same task with actual input, without a phase-jump hook.
        for(let n=0;n<24;n++){
          if(await page.locator('#gx-layer').evaluate(el=>el.dataset.phase!=='proterozoic-oxygen'||el.classList.contains('is-era-transitioning')))break;
          const x=start.x+radius*(n%2?.65:0);
          if(item.touch){await touch('touchStart',x,start.y);await touch('touchMove',x+(n%2?-.3:.3)*radius,start.y);await touch('touchEnd',x,start.y);}
          else {await page.mouse.move(x,start.y);await page.mouse.down();await page.mouse.move(x+(n%2?-.3:.3)*radius,start.y);await page.mouse.up();}
        }
        await page.waitForFunction(()=>document.querySelector('#gx-layer').dataset.phase==='paleozoic-coal',null,{timeout:10000});
        assert.equal(await page.locator('#gx-layer').getAttribute('data-gesture-hint'),'visible','The next era gets its own example');
        if(item.reduced){
          for(const [phase,kind,words]of [[0,'tap',/タップ/],[4,'tap',/タップ/],[5,'vertical',/上下/],[7,'circle',/一周/]]){
            await page.evaluate(phase=>GaiaGX.setPhase(phase),phase);
            assert.equal(await page.locator('#gx-layer').getAttribute('data-gesture-kind'),kind);
            assert.match(await page.locator('#gx-phase-guide').innerText(),words);
            await page.screenshot({path:`${out}/${item.name}-${returnTo}-${phase+1}-${kind}.png`});
          }
        }
      }
      report.checks.push({name:item.name,returnTo,oxidation:true,drag:!before,autoAdvance:!before,languages:before?['ja']:['ja','en','zh-CN']});
      await page.locator('#gx-modal-skip').click();
      await page.waitForFunction(()=>document.querySelector('#gx-layer').hidden);
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`});throw error;}
finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
