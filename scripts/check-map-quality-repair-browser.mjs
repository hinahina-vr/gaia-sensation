import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const stage=process.env.GAIA_QUALITY_STAGE||'after';
const output=path.resolve(`artifacts/map-quality-repair-20261022/${stage}`);
fs.mkdirSync(output,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',stage,
  scope:'Local installed Chrome; bundled records; HTTPS blocked. Emulated mobile, not a physical device or production.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const [width,height] of [[1920,1080],[390,844],...(stage==='before'?[]:[[320,568]])]
    .filter(([w])=>!process.env.GAIA_QUALITY_WIDTH||w===Number(process.env.GAIA_QUALITY_WIDTH))) {
    const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900});
    await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);
    await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(()=>{
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
      window.__rain={circles:[],texts:[]};const gradients=new WeakMap();
      const p=CanvasRenderingContext2D.prototype, clear=p.clearRect,gradient=p.createRadialGradient,fill=p.fill,text=p.fillText,stop=CanvasGradient.prototype.addColorStop;
      const active=c=>c.canvas.id==='japan-overlay'&&document.querySelector('#japan-mode-number')?.textContent==='08';
      p.clearRect=function(...a){if(active(this))window.__rain={circles:[],texts:[]};return clear.apply(this,a);};
      p.createRadialGradient=function(...a){const g=gradient.apply(this,a);if(active(this))gradients.set(g,{x:a[3],y:a[4],radius:a[5],colors:[]});return g;};
      CanvasGradient.prototype.addColorStop=function(at,color){gradients.get(this)?.colors.push(color);return stop.call(this,at,color);};
      p.fill=function(...a){const g=gradients.get(this.fillStyle);if(active(this)&&g?.colors.some(c=>c.startsWith('rgba(91,218,255,')))window.__rain.circles.push({...g,blend:this.globalCompositeOperation});return fill.apply(this,a);};
      p.fillText=function(value,x,y,...a){if(active(this))window.__rain.texts.push({value:String(value),x,y,font:this.font});return text.call(this,value,x,y,...a);};
    });
    const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-06`);
    await page.waitForFunction(()=>document.documentElement.dataset.gaiaAppReady==='true');
    await page.waitForFunction(()=>{const e=document.querySelector('#map-data-intro');return e&&!e.hidden;});
    for(const number of (stage==='before'?[6,8,14]:[6,7,8,9,10,11,13,14])) {
      if(number!==6)await page.locator('.map-mode-bank .map-mode-button').filter({hasText:new RegExp(`^${String(number).padStart(2,'0')}$`)}).evaluate(b=>b.click());
      await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n,number);
      await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running');
      await page.evaluate(()=>{GaiaMapPlayback.stop();GaiaMapObservationAdapter.setSignalTime(0);});
      await page.waitForTimeout(2200);await page.evaluate(()=>document.fonts.ready);
      if(number===8)await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.forestRevealState==='complete'&&window.__rain.circles.length>5);
      const primary=page.locator('#japan-layer .signal-value-primary');
      if(!await primary.isVisible())await page.locator('#map-responsive-data > summary').click();
      assert(await primary.isVisible(),`${width}/${number}: measure the opened panel, not hidden content`);
      const scan=await page.evaluate(()=>{
        const p=document.querySelector('#japan-layer .signal-value-primary'),d=p?.querySelector('span'),u=p?.querySelector('small');
        const box=d?.getBoundingClientRect(),host=p?.parentElement;
        const rain=window.__rain;
        return {digits:d?.textContent,valueColor:d&&getComputedStyle(d).color,valueFont:d&&parseFloat(getComputedStyle(d).fontSize),parentFont:p&&parseFloat(getComputedStyle(p).fontSize),unitFont:u&&parseFloat(getComputedStyle(u).fontSize),
          box:box?.toJSON(),hostOverflow:host&&host.scrollWidth-host.clientWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth,
          rain:{count:rain.circles.length,maxRadius:Math.max(0,...rain.circles.map(c=>c.radius)),inkArea:rain.circles.reduce((s,c)=>s+Math.PI*c.radius*c.radius,0),
            embeddedLabels:rain.texts.filter(t=>t.font.includes('7px')&&rain.circles.some(c=>Math.hypot(t.x-c.x,t.y-c.y)<c.radius)).length,
            sourceOver:rain.circles.every(c=>c.blend==='source-over'),brazil:document.querySelector('#japan-overlay').dataset.forestRainBrazil}};
      });
      assert.equal(scan.pageOverflow,0);
      if(stage!=='before') {
        assert(scan.valueFont>=20,`${width}/${number}: digits must be readable`);
        assert.equal(scan.valueFont,scan.parentFont,`${width}/${number}: heading styles must not shrink digits`);
        assert(scan.valueFont>scan.unitFont,`${width}/${number}: value must be larger than its unit`);
        assert.equal(scan.hostOverflow,0,`${width}/${number}: metric must fit`);
        assert(scan.box.width>0&&scan.box.height>0&&scan.box.right<=width,`${width}/${number}: visible value stays inside the viewport`);
        if(number===8){assert(scan.rain.count>5);assert(scan.rain.maxRadius<=28);assert.equal(scan.rain.embeddedLabels,0);assert(scan.rain.sourceOver);assert.equal(scan.rain.brazil,'5.33 mm/日');}
      } else if(width===390&&[6,8,14].includes(number)) assert.equal(scan.valueFont,7,'Reproduce tiny mobile digits');
      await page.screenshot({path:path.join(output,`${width}-${String(number).padStart(2,'0')}.png`)});
      report.checks.push({width,height,number,...scan});console.log(`PASS ${stage} ${width}/${number}`);
    }
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;throw e;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
