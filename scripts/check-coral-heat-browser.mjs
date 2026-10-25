import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {recordCoralMotion} from './lib/record-coral-motion.mjs';
const stage=process.env.GAIA_CORAL_STAGE||'after',out=path.resolve(process.env.GAIA_CORAL_OUT||`artifacts/coral-heat-20261022/${stage}`);
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const source=JSON.parse(fs.readFileSync('data/climate-history/coral.json')),region=source.regions.find(p=>p.id==='southern_ryukyu_islands');
const report={stage,browser:browser.version(),sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'uncommitted changes',sourceHash:createHash('sha256').update(fs.readFileSync('data/climate-history/coral.json')).digest('hex'),checks:[],errors:[]};
try{
  for(const [width,height] of JSON.parse(process.env.GAIA_CORAL_SIZES||JSON.stringify(stage==='before'?[[1440,900],[390,844]]:[[1440,900],[1920,1080],[1366,768],[390,844],[320,568]]))){
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,deviceScaleFactor:1});
    await enforceBrowserSecurity(context,process.env.GAIA_BASE_URL);await context.route('https://**',r=>r.abort());
    await context.addInitScript(()=>{
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
      window.__coralFrames=[];window.__assignments=0;
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        const c=get.call(this,type,...args);
        if(type==='webgl2'&&this.dataset.coralHeat){window.__coralGl=c;
          if(c&&!c.__testedSurface){c.__testedSurface=true;
            const draw=c.drawArrays.bind(c),locate=c.getUniformLocation.bind(c),uniform=c.uniform1f.bind(c),times=new WeakSet();
            c.drawArrays=(mode,...args)=>{if(mode===c.LINES&&window.__hideCoralStreams)return;return draw(mode,...args);};
            c.getUniformLocation=(p,name)=>{const location=locate(p,name);if(location&&name==='time')times.add(location);return location;};
            c.uniform1f=(location,value)=>uniform(location,times.has(location)&&Number.isFinite(window.__surfaceTime)?window.__surfaceTime:value);
          }
        }return c;
      };
      for(const key of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(HTMLCanvasElement.prototype,key,{...d,set(v){if(this.id==='gaia-climate-canvas')window.__assignments++;d.set.call(this,v);}});}
      const capture=()=>{const intro=document.querySelector('#map-data-intro'),c=document.querySelector('#gaia-climate-canvas');if(intro&&!intro.hidden&&__coralFrames.length<2000)__coralFrames.push({opacity:Number(getComputedStyle(intro).opacity),canvasShown:c?.checkVisibility({visibilityProperty:true}),draws:globalThis.GaiaClimateHistory?.getCoralState?.().draws||0});requestAnimationFrame(capture);};requestAnimationFrame(capture);
    });
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(60000);
    await page.goto(`${process.env.GAIA_BASE_URL}/world.html#world-73`);
    await page.waitForFunction(()=>globalThis.GaiaClimateHistory?.getState().dataState==='ready');
    await page.evaluate(()=>{GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapPlayback.stop();});
    if(stage==='after'&&width===390){await page.waitForFunction(()=>!document.querySelector('#map-data-intro').hidden);await page.waitForTimeout(200);await page.touchscreen.tap(210,450);}
    await page.waitForFunction(()=>!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&Number(document.querySelector('#gaia-climate-canvas').dataset.climateVisibleCount)>0);
    await page.waitForTimeout(2700);
    await page.screenshot({path:path.join(out,`${width}-73.png`)});
    const result={width,height,state:await page.evaluate(()=>GaiaClimateHistory.getState())};report.checks.push(result);
    if(stage==='after'){
      const stable=()=>page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');
      await stable();result.engine=await page.evaluate(()=>GaiaClimateHistory.getCoralState());assert.equal(result.engine.engine,'webgl2',JSON.stringify(result.engine));assert(result.engine.glyphs>0);
      assert.equal(result.engine.field.engine,'webgl2',JSON.stringify(result.engine.field));assert.equal(result.engine.field.landMasked,true);assert(result.engine.field.builds>0);assert(result.engine.field.samples<=1024*768);
      const frames=await page.evaluate(()=>__coralFrames);assert(frames.length>3);assert(!frames.some(f=>f.canvasShown||f.draws>0),'No glyph before the intro has faded');assert(frames.at(-1).opacity<.01);result.introFade={frames:frames.length,lastOpacity:frames.at(-1).opacity,tapped:width===390};
      const layout=await page.locator('.gaia-climate-legend').evaluate(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom,overflow:document.documentElement.scrollWidth-innerWidth};});assert(layout.left>=0&&layout.right<=width&&layout.overflow<=1);if(width<900)assert(layout.bottom<height-170,JSON.stringify(layout));
      const row=region.years.find(r=>r.year===2016);assert.equal(await page.locator('[data-coral-days="8"]').textContent(),`${row.days8}日`);
      const fieldBefore=await page.evaluate(()=>GaiaClimateHistory.getCoralState().field);await page.waitForTimeout(500);
      const fieldAfter=await page.evaluate(()=>GaiaClimateHistory.getCoralState().field);
      assert(fieldAfter.draws>fieldBefore.draws,'Ocean circulation keeps moving while the year is paused');
      assert(fieldAfter.flowTime>fieldBefore.flowTime);assert.equal(fieldAfter.builds,fieldBefore.builds,'Flow reuses the year colour texture');
      assert.equal(fieldAfter.maskBuilds,fieldBefore.maskBuilds,'Flow reuses the geographic land mask');
      assert.equal(fieldAfter.streams,390);result.cachedOceanFlow={before:fieldBefore,after:fieldAfter};
      if(width===1440){
        if(process.env.GAIA_CORAL_VIDEO)result.video=await recordCoralMotion(page,path.join(out,'73-ocean-motion.mp4'),16);
        await page.evaluate(()=>{window.__hideCoralStreams=true;});await page.waitForTimeout(100);
        result.oceanCoverage=await page.evaluate(async()=>{
          const {earthBaseScale,earthLongitudeToMapX}=await import('./src/exploration/world-projection.js?v=gaia-japan-center-1');
          const r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=earthBaseScale(r)*Number(d.earthZoom);
          const canvas=document.querySelector('#gaia-climate-canvas'),ctx=canvas.getContext('2d'),box=canvas.getBoundingClientRect();
          const sample=([lon,lat])=>{const x=(r.width-360*s)/2+Number(d.earthOffsetX)+earthLongitudeToMapX(lon)*s,y=(r.height-180*s)/2+Number(d.earthOffsetY)+(90-lat)*s;
            return{lon,lat,rgba:Array.from(ctx.getImageData(Math.round(x*canvas.width/box.width),Math.round(y*canvas.height/box.height),1,1).data)};};
          window.__oceanPixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          return{ocean:[[-145,-45],[-145,0],[-30,0],[80,-45],[160,45]].map(sample),land:[[100,45],[25,0],[-65,-10],[135,-25]].map(sample)};
        });
        assert(result.oceanCoverage.ocean.every(p=>p.rgba[3]>=70),'Colour covers open ocean far from the reef POIs');
        assert(result.oceanCoverage.land.every(p=>p.rgba[3]<=5),'Continental interiors stay unpainted');
        await page.waitForTimeout(1000);
        result.surfaceMotion=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let changed=0,ocean=0;
          for(let i=0;i<p.length;i+=4)if(p[i+3]===107&&__oceanPixels[i+3]===107){ocean++;if(Math.abs(p[i]-__oceanPixels[i])+Math.abs(p[i+1]-__oceanPixels[i+1])+Math.abs(p[i+2]-__oceanPixels[i+2])>3)changed++;}delete window.__oceanPixels;window.__hideCoralStreams=false;return{changed,ocean,share:changed/ocean,streamLinesDisabled:true};});
        assert(result.surfaceMotion.share>.15,'The colour surface itself moves, with stream lines disabled and POIs excluded');
        result.phaseSeams=[];
        for(const seam of [6,12]){
          await page.evaluate(t=>{window.__hideCoralStreams=true;window.__surfaceTime=t;},seam-.001);await page.waitForTimeout(100);
          await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas');window.__seamPixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;});
          await page.evaluate(t=>{window.__surfaceTime=t;},seam+.001);await page.waitForTimeout(100);
          const delta=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let max=0,total=0,count=0;
            for(let i=0;i<p.length;i+=4)if(p[i+3]===107&&__seamPixels[i+3]===107)for(let k=0;k<3;k++){const d=Math.abs(p[i+k]-__seamPixels[i+k]);max=Math.max(max,d);total+=d;count++;}
            delete window.__seamPixels;return{max,mean:total/count};});
          assert(delta.max<=5&&delta.mean<.1,`No flashing at the ${seam}s phase reset: ${JSON.stringify(delta)}`);result.phaseSeams.push({seam,...delta});
        }
        await page.evaluate(()=>{delete window.__surfaceTime;window.__hideCoralStreams=false;});
      }
      await page.evaluate(()=>GaiaClimateHistory.selectPoint('southern_ryukyu_islands'));await stable();await page.waitForTimeout(150);
      const pixel=await page.evaluate(p=>{const r=GaiaMapObservationAdapter.getViewportRect(),d=document.querySelector('#japan-overlay').dataset,s=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom),x=r.left+(r.width-360*s)/2+Number(d.earthOffsetX)+((p.lon+390)%360)*s,y=r.top+(r.height-180*s)/2+Number(d.earthOffsetY)+(90-p.lat)*s;return{x,y,hit:GaiaClimateHistory.findPoiAt(x,y,'touch')?.record.id,blocked:!!document.elementFromPoint(x,y)?.closest('button,select,.gaia-climate-legend,.gaia-climate-readout,#map-responsive-data')};},region);
      assert.equal(pixel.hit,region.id);assert(!pixel.blocked,JSON.stringify(pixel));
      result.softFieldPixels=await page.evaluate(p=>{const c=document.querySelector('#gaia-climate-canvas'),r=c.getBoundingClientRect(),ctx=c.getContext('2d'),sx=c.width/r.width,sy=c.height/r.height;let coloured=0;for(let angle=0;angle<Math.PI*2;angle+=Math.PI/32){const x=Math.round((p.x-r.left+Math.cos(angle)*44)*sx),y=Math.round((p.y-r.top+Math.sin(angle)*44)*sy);if(x>=0&&y>=0&&x<c.width&&y<c.height&&ctx.getImageData(x,y,1,1).data[3]>8)coloured++;}return coloured;},pixel);assert(result.softFieldPixels>0,'Smooth colour extends beyond the original POI radius');
      await page.evaluate(id=>GaiaClimateHistory.selectPoint(id,{focus:false}),source.regions.find(p=>p.id!==region.id).id);
      if(width<900)await page.touchscreen.tap(pixel.x,pixel.y);else await page.mouse.click(pixel.x,pixel.y);
      await page.waitForFunction(id=>GaiaClimateHistory.getState().selectedId===id,region.id);result.actualPoiClick=true;
      if(await page.locator('#map-responsive-data > summary').isVisible()&&!(await page.locator('#map-responsive-data').getAttribute('open')))await page.locator('#map-responsive-data > summary').click();
      const assignments=await page.evaluate(()=>__assignments);
      await page.locator('[data-climate-year]').fill('2017');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.yearFade==='running');await stable();
      assert.equal(await page.locator('[data-coral-days="8"]').textContent(),`${region.years.find(r=>r.year===2017).days8}日`);assert.equal(await page.evaluate(()=>__assignments),assignments,'Year change reuses canvas allocation');result.yearCrossfade=true;
      const stats=await page.evaluate(()=>GaiaClimateHistory.getStatisticsDataset());assert(stats.rows.length>=35);assert.deepEqual(await page.evaluate(id=>GaiaClimateHistory.restoreStatisticsDataset(id),stats.id),stats);result.statisticsRows=stats.rows.length;
      await page.locator('[data-climate-year]').fill('2016');await stable();
      if(await page.locator('#map-responsive-data').getAttribute('open')!==null)await page.locator('#map-responsive-data > summary').click();
      await page.screenshot({path:path.join(out,`${width}-73-selected.png`)});
      if(width===1440){
        await page.evaluate(()=>{window.__coralLoss=__coralGl.getExtension('WEBGL_lose_context');__coralLoss.loseContext();});await page.waitForFunction(()=>GaiaClimateHistory.getCoralState().engine==='lost');
        await page.waitForTimeout(150);assert(Number(await page.locator('#gaia-climate-canvas').getAttribute('data-climate-visible-count'))>0);
        assert.equal(await page.evaluate(()=>GaiaClimateHistory.getCoralState().field.engine),'canvas2d');
        const fallbackStart=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas');window.__fallbackPixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return GaiaClimateHistory.getCoralState().field;});
        await page.waitForTimeout(1000);
        result.fallbackMotion=await page.evaluate(()=>{const c=document.querySelector('#gaia-climate-canvas'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let changed=0;for(let i=0;i<p.length;i+=4)if(p[i+3]===107&&__fallbackPixels[i+3]===107&&Math.abs(p[i]-__fallbackPixels[i])+Math.abs(p[i+1]-__fallbackPixels[i+1])+Math.abs(p[i+2]-__fallbackPixels[i+2])>3)changed++;delete window.__fallbackPixels;return{changed,...GaiaClimateHistory.getCoralState().field};});
        assert(result.fallbackMotion.changed>500);assert.equal(result.fallbackMotion.builds,fallbackStart.builds);
        await page.screenshot({path:path.join(out,'1440-73-fallback.png')});
        await page.evaluate(()=>__coralLoss.restoreContext());await page.waitForFunction(()=>GaiaClimateHistory.getCoralState().engine==='webgl2');result.contextRecovery=true;
        await page.evaluate(()=>GaiaClimateHistory.select('cyclones'));await page.waitForFunction(()=>GaiaClimateHistory.getState().id==='cyclones'&&GaiaClimateHistory.getState().dataState==='ready');assert.equal(await page.evaluate(()=>GaiaClimateHistory.getCoralState().width),1);result.resourcesReleased=true;
      }
      if(width===320){await page.emulateMedia({reducedMotion:'reduce'});if(await page.locator('#map-responsive-data > summary').isVisible())await page.locator('#map-responsive-data > summary').click();await page.locator('[data-climate-year]').fill('2018');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2018');assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-year-fade'),'complete');
        const stopped=await page.evaluate(()=>GaiaClimateHistory.getCoralState());await page.waitForTimeout(400);
        assert.equal(await page.evaluate(()=>GaiaClimateHistory.getCoralState().paintCount),stopped.paintCount,'Reduced motion keeps a still ocean');assert.equal(stopped.field.flowTime,0);result.reducedMotion=true;}
    }
    console.log(`Coral ${width}×${height}: passed`);
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(report);}
