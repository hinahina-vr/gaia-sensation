import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before'),base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/map-theme-background-20260912/${before?'before':'after'}`);fs.mkdirSync(output,{recursive:true});
const representatives=[1,15,16,17,18,19,20,21,31,34,38,41,44,54,59,65,68,69,70,71];
const report={status:'running',before,checks:[],errors:[],scope:'Local installed Chrome, production CSP, repository data (FIRMS endpoint served with repository snapshot), emulated viewports. Not production, live APIs, or physical devices.'};
const files=['src/exploration/map-theme-background.js','src/exploration/map-theme-shaders.js','src/exploration/map-theme-catalog.js','src/exploration/index.js','map-theme-background.css','food-exhibits.css','gaia-mode-loader.js','index.html'];
const hashes=()=>Object.fromEntries(files.filter(f=>fs.existsSync(f)).map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
report.hashes=hashes();
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try{
 for(const [width,height] of (process.env.QA_VIEWPORTS||'1440x900,390x844').split(',').map(v=>v.split('x').map(Number))){
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<=900,isMobile:width<=900,reducedMotion:'no-preference'});await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());
  await ctx.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  await ctx.addInitScript(()=>{
   window.__themeSamples=[];window.__captureTheme=false;
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=original.call(this,type,...args);if(gl&&this.id==='gaia-map-theme-background'&&String(type).startsWith('webgl')&&!gl.__qaWrapped){gl.__qaWrapped=true;const draw=gl.drawArrays.bind(gl);gl.drawArrays=(...drawArgs)=>{draw(...drawArgs);if(!window.__captureTheme)return;window.__captureTheme=false;const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let hash=2166136261,nonzero=0,total=0,min=255,max=0;const colors=new Set();for(let i=0;i<pixels.length;i+=16){const l=(pixels[i]+pixels[i+1]+pixels[i+2])/3;total+=l;if(l>1)nonzero++;min=Math.min(min,l);max=Math.max(max,l);colors.add((pixels[i]>>3)*1024+(pixels[i+1]>>3)*32+(pixels[i+2]>>3));for(let c=0;c<3;c++)hash=Math.imul(hash^pixels[i+c],16777619);}window.__themeSamples.push({w,h,hash:hash>>>0,nonzero,mean:total/(pixels.length/16),min,max,colors:colors.size,time:performance.now(),theme:this.dataset.themeId});};}return gl;};
  });
  await ctx.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(...args){
    const gl=original.apply(this,args);
    if(gl&&this.id==='gaia-map-theme-background'&&!gl.__landCheck){
     gl.__landCheck=true;const draw=gl.drawArrays.bind(gl);
     gl.drawArrays=(...a)=>{
      draw(...a);
      const program=gl.getParameter(gl.CURRENT_PROGRAM);
      const view=gl.getUniform(program,gl.getUniformLocation(program,'u_geo_view'));
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      window.__landPixels=[];
      for(const [lon,lat] of [[138,36],[142,44],[110,40],[105,35],[100,50],[80,25],[-100,40],[20,10]]){
       const mapLon=lon<-30?lon+360:lon;
       const x=Math.floor((mapLon-view[0])/view[2]*w),y=Math.floor((1-(view[1]-lat)/view[3])*h);
       if(x<0||x>=w||y<0||y>=h)continue;
       const pixel=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
       window.__landPixels.push({lon,lat,pixel:[...pixel]});
      }
     };
    }
    return gl;
   };
  });
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(`${width}: ${e.message}`));
  await page.goto(base+'/?exhibit=31#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});await page.evaluate(()=>GaiaMapDemo.stop());
  const numbers=process.env.QA_NUMBERS?.split(',').map(Number)||(before?representatives:[1,...Array.from({length:41},(_,i)=>31+i),21,15]);
  for(const number of numbers){
   await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),number);
   await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running',number);
   if(number>=31&&number<=69)await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready'&&document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState==='complete');
   if(number>=70)await page.waitForFunction(()=>GaiaFoodExhibits.getState().dataState==='ready'&&document.querySelector('#gaia-food-canvas').dataset.foodArrivalState==='complete');
   if(number===1)await page.waitForFunction(()=>Number(document.querySelector('#gaia-firms-canvas').dataset.firmsPointCount)>0);
   const scan=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,canvases:[...document.querySelectorAll('#japan-map canvas')].filter(e=>e.checkVisibility()).map(e=>({id:e.id,width:e.width,height:e.height})),theme:globalThis.GaiaMapThemeBackground?.getState?.()||null}));
   assert.equal(scan.overflow,0);
   if(before){assert.equal(scan.theme,null);}
   else if(number===21){assert.equal(await page.locator('#gaia-map-theme-background').isVisible(),false);}
   else{
    await page.waitForFunction(()=>GaiaMapThemeBackground.getState().engine==='webgl2'&&GaiaMapThemeBackground.getState().mask==='ready');
    assert.equal(await page.locator('#gaia-map-theme-background').isVisible(),true);
    assert.equal(await page.locator('#gaia-map-theme-background').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    const capture=async()=>{const count=await page.evaluate(()=>{const previous=__themeSamples.length;window.__captureTheme=true;GaiaMapThemeBackground.redraw();return previous;});await page.waitForFunction(count=>__themeSamples.length>count,count);return page.evaluate(()=>__themeSamples.at(-1));};
    const first=await capture();await page.waitForTimeout(700);const second=await capture();
    assert(first.nonzero>100&&first.colors>12&&first.max-first.min>12,`${number}: visible textured WebGL output ${JSON.stringify(first)}`);assert.notEqual(first.hash,second.hash,`${number}: pixels really animate`);
    scan.pixels={first,second};scan.theme=await page.evaluate(()=>GaiaMapThemeBackground.getState());
    if(number===17||number>=31){
     scan.landPixels=await page.evaluate(()=>__landPixels);
     assert(scan.landPixels.length>0,'At least one inland point is visible');
     for(const sample of scan.landPixels)assert.deepEqual(sample.pixel,[0,0,0,0],`Land must be transparent: ${JSON.stringify(sample)}`);
    }
    assert.equal(scan.theme.number,number,'The current exhibit, not the previous exhibit, owns the background');
    assert.equal(scan.theme.contextCount,1,'All themes share one WebGL context');
   }
   report.checks.push({width,height,number,...scan});if(representatives.includes(number))await page.screenshot({path:path.join(output,`${width}-${number}.png`)});
   console.log(`PASS ${width}/${number}`);
  }
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),report.hashes,'Runtime files must stay unchanged throughout the browser run');report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
