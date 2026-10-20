import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const stage=process.env.GAIA_POLISH_STAGE||'after';
const output=path.resolve(`artifacts/map-03-05-polish-20261020/${stage}`);
fs.mkdirSync(output,{recursive:true});
const points=Array.from({length:1200},(_,i)=>({
  id:`test-fire-${i}`,lon:110+(i*137.508)%70,lat:-24+(i*17.37)%72,
  frp:5+(i*37)%600,confidence:65+(i%36),brightness:315,daynight:i%2?'N':'D',
  acquiredAt:new Date(Date.parse('2026-10-19T03:00Z')+i*72000).toISOString(),
}));
const fire={schemaVersion:1,source:'nasa-firms-modis',generatedAt:'2026-10-20T03:00:00Z',points,
  summary:{start:points[0].acquiredAt,end:points.at(-1).acquiredAt,displayed:points.length,
    detected:points.length,maxFrp:604,nightShare:.5,highConfidenceShare:.6}};
const report={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  tree:'uncommitted changes',stage,environment:'Local Chrome, mobile emulation, deterministic synthetic weather/FIRMS fixtures; not live data.',
  checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try {
  const profiles=[[1920,1080],[390,844],...(stage==='before'?[]:[[320,568,'reduce'],[1440,900,'fallback']])]
    .filter(([width])=>!process.env.GAIA_POLISH_WIDTH||width===Number(process.env.GAIA_POLISH_WIDTH));
  for(const [width,height,variant] of profiles){
    const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,
      reducedMotion:variant==='reduce'?'reduce':'no-preference'});
    await context.addInitScript(()=>localStorage.setItem('gaia-senseware-bgm-muted','true'));
    if(variant==='fallback')await context.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        if(type==='webgl2'&&this.classList.contains('gaia-planet-atmosphere-canvas'))return null;
        return original.call(this,type,...args);
      };
    });
    await context.route('**/firms-active-fire-snapshot.json',route=>route.fulfill({json:fire}));
    await context.route('**/api/live/v1/firms',route=>route.fulfill({json:fire}));
    await context.route('https://**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname.includes('open-meteo.com')){
        const lat=(url.searchParams.get('latitude')||'0').split(',').map(Number);
        const lon=(url.searchParams.get('longitude')||'0').split(',').map(Number);
        return route.fulfill({json:lat.map((v,i)=>({current:{time:'2026-10-20T03:00',
          wind_speed_10m:7,wind_direction_10m:270,surface_pressure:1012,
          cloud_cover:Math.round((Math.sin(lon[i]*Math.PI/95)+1)*47),
          shortwave_radiation:Math.max(0,Math.round(750*Math.cos(lon[i]*Math.PI/180))),
          pm2_5:Math.round(4+75*(Math.sin(lon[i]*Math.PI/80)*.5+.5)),
          aerosol_optical_depth:.05+.65*(Math.sin(lon[i]*Math.PI/80)*.5+.5),
        }}))});
      }
      if(url.hostname==='earthquake.usgs.gov')return route.fulfill({json:{metadata:{generated:Date.now()},features:[]}});
      return route.abort();
    });
    page=await context.newPage();
    page.on('pageerror',e=>report.errors.push({width,variant,message:e.message}));
    await page.goto(`${process.env.GAIA_BASE_URL}/world#world-03`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.GaiaPlanetSignals&&globalThis.GaiaFirmsExhibit);
    for(const number of ['03','04','05']){
      if(number==='04')await page.evaluate(()=>GaiaFirmsExhibit.select());
      if(number==='05')await page.evaluate(()=>GaiaPlanetSignals.select(GaiaPlanetSignals.definitions.findIndex(d=>d.number==='05')));
      const canvas=page.locator(number==='04'?'#gaia-firms-canvas':'#gaia-planet-signals-canvas');
      await page.waitForFunction(number=>number==='04'?Number(document.querySelector('#gaia-firms-canvas')?.dataset.firmsFrame)>2
        :GaiaPlanetSignals.getState().id===(number==='03'?'global-aerosol-light':'global-cloud-radiance')&&Number(document.querySelector('#gaia-planet-signals-canvas')?.dataset.planetFrame)>2,number);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
      const band=await page.locator('.map-title-transition').evaluate(n=>getComputedStyle(n,'::before').height);
      await page.waitForTimeout(700);
      await page.screenshot({path:path.join(output,`${width}-${number}-title.png`)});
      await page.waitForFunction(()=>document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
      assert.equal(await page.locator('.map-title-transition').evaluate(n=>getComputedStyle(n,'::before').height),band);
      await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
      if(number==='04'){
        await page.evaluate(()=>GaiaFirmsExhibit.seekCruise(.6));
        await page.waitForTimeout(300);
      } else if(variant!=='fallback'){
        await page.waitForFunction(()=>document.querySelector('.gaia-planet-atmosphere-canvas').dataset.fieldState==='ready');
        if(number==='05')await page.waitForFunction(()=>document.querySelector('.gaia-planet-atmosphere-canvas').dataset.cloudTextureState==='ready');
      }
      await page.waitForTimeout(400);
      await page.screenshot({path:path.join(output,`${width}-${number}-overview.png`)});
      const target=await page.evaluate(number=>{
        const rect=document.querySelector('#japan-map').getBoundingClientRect(),o=document.querySelector('#japan-overlay');
        const scale=(rect.width>=901?rect.width/360:Math.max(rect.width/360,rect.height/180))*Number(o.dataset.earthZoom||1);
        const data=number==='04'?GaiaFirmsExhibit.getStatisticsDataset().rows:GaiaPlanetSignals.getCruisePoints();
        const eligible=data.map((p,index)=>({...p,index,
          x:rect.left+(rect.width-360*scale)/2+Number(o.dataset.earthOffsetX||0)+((p.lon-150+540)%360)*scale,
          y:rect.top+(rect.height-180*scale)/2+Number(o.dataset.earthOffsetY||0)+(90-p.lat)*scale}))
          .filter(p=>p.x>innerWidth*.3&&p.x<innerWidth*.65&&p.y>innerHeight*.32&&p.y<innerHeight*.56);
        return eligible.find(p=>(number==='04'?GaiaFirmsExhibit:GaiaPlanetSignals).findPoiAt(p.x,p.y,'touch'));
      },number);
      assert(target,`${number}: a visible, pickable observation`);
      // Cruise seeking deliberately holds a sampled phase. Resume the actual
      // timeline so the tap below tests a playing -> paused interaction.
      if(number==='04'&&stage!=='before')await page.evaluate(()=>GaiaFirmsExhibit.setPlayback(true));
      if(width<900)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);
      await page.locator('#japan-poi-card').waitFor({state:'visible'});
      await page.waitForTimeout(650);
      await page.screenshot({path:path.join(output,`${width}-${number}-selected.png`)});
      const state=await page.evaluate(number=>({
        canvas:{...document.querySelector(number==='04'?'#gaia-firms-canvas':'#gaia-planet-signals-canvas').dataset},
        card:document.querySelector('#japan-poi-card').innerText,
        selection:GaiaMapObservationAdapter.getPoiInteraction().selected,
        overflow:document.documentElement.scrollWidth-innerWidth,
      }),number);
      report.checks.push({width,height,variant:variant||'normal',number,band,...state});
      assert.equal(state.overflow,0);
      assert.equal(context.pages().length,1,'POI tap must not activate the underlying source link');
      if(stage!=='before'){
        assert.equal(state.canvas[number==='04'?'firmsPoiFocusState':'planetPoiFocusState'],'selected');
        assert.equal(await page.locator('#japan-poi-card.has-observation-summary').count(),1);
        assert.equal(await page.locator('#japan-poi-card .japan-poi-fact').count(),number==='04'?2:2);
        if(number==='04'){
          assert(state.card.includes('観測時刻')&&state.card.includes('MW'));
          assert(Number(state.canvas.firmsActiveColumns)<=Number(state.canvas.firmsColumnLimit));
          assert(Number(state.canvas.firmsSelectedPoint)===state.selection.index);
          assert.equal(state.canvas.firmsPlaybackPhase,'paused');
        }else{
          assert.equal(state.canvas.planetObservationStyle,number==='03'?'pm25-light':'radiation-light');
          assert(state.card.includes(number==='03'?'PM2.5':'日射'));
          assert.equal(await page.locator('#japan-poi-card .japan-poi-wind-direction').count(),0);
          if(variant!=='fallback'){
            const pixels=await page.locator('.gaia-planet-atmosphere-canvas').evaluate(n=>n.width*n.height);
            assert(pixels<=(width<720?300000:760000)+2000);
          }
        }
        if(process.env.GAIA_POLISH_EXTENDED==='1'){
          if(number==='04'){
            const shader=await page.evaluate(()=>new Promise(resolve=>{
              const canvas=document.querySelector('#gaia-firms-canvas'),start=canvas.dataset.firmsFrame;
              const read=()=>{
                if(canvas.dataset.firmsFrame===start)return requestAnimationFrame(read);
                const gl=canvas.getContext('webgl'),program=gl.getParameter(gl.CURRENT_PROGRAM);
                resolve({focus:gl.getUniform(program,gl.getUniformLocation(program,'u_focusSequence')),
                  quiet:gl.getUniform(program,gl.getUniformLocation(program,'u_introQuiet')),error:gl.getError()});
              };
              requestAnimationFrame(read);
            }));
            assert(Math.abs(shader.focus-state.selection.index/1199*.982)<.00001,'The rendered GPU selection matches the opened observation');
            assert.equal(shader.quiet,0);assert.equal(shader.error,0);
            state.shader=shader;
          }
          for(const language of ['en','zh-CN','ja']){
            await page.evaluate(language=>GaiaI18n.set(language),language);
            const expected=number==='03'?'AOD':number==='04'
              ?({en:'Observed at','zh-CN':'观测时间',ja:'観測時刻'})[language]
              :({en:'Sunlight','zh-CN':'日射',ja:'日射'})[language];
            await page.waitForFunction(expected=>document.querySelector('#japan-poi-card').innerText.includes(expected),expected);
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
          }
          await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')
            && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
          const link=page.locator('#japan-poi-source'),href=await link.getAttribute('href');
          await context.route(href,route=>route.fulfill({contentType:'text/html',body:'Source navigation test fixture'}));
          const popupPromise=context.waitForEvent('page');
          if(width<900)await link.tap();else await link.click();
          const popup=await popupPromise;
          await popup.waitForLoadState('domcontentloaded');
          assert.equal(popup.url(),href);await popup.close();
          state.extended='Rendered selection, Japanese/English/Chinese card and intentional source click passed';
        }
      }
      await page.locator('#japan-poi-close').click();
      await page.mouse.move(0,0);
      if(stage!=='before'){
        await page.waitForFunction(number=>document.querySelector(number==='04'?'#gaia-firms-canvas':'#gaia-planet-signals-canvas')
          .dataset[number==='04'?'firmsPoiFocusState':'planetPoiFocusState']==='none',number);
        if(number==='04'){
          await page.evaluate(()=>GaiaFirmsExhibit.setPlayback(true));
          const before=Number(await canvas.getAttribute('data-firms-playback-progress'));
          await page.waitForTimeout(600);
          assert(Number(await canvas.getAttribute('data-firms-playback-progress'))>before,'04 resumes chronological playback after selection');
          await page.evaluate(()=>GaiaFirmsExhibit.seekCruise(.98));
          await page.waitForTimeout(150);
          assert.equal(await canvas.getAttribute('data-firms-playback-phase'),'extinguishing');
        }else if(variant==='reduce'){
          await page.waitForTimeout(900);
          const draws=await page.locator('.gaia-planet-atmosphere-canvas').getAttribute('data-draws');
          await page.waitForTimeout(350);
          assert.equal(await page.locator('.gaia-planet-atmosphere-canvas').getAttribute('data-draws'),draws);
        }
        if(process.env.GAIA_POLISH_EXTENDED==='1'&&width>=900){
          const legend=page.locator(number==='04'?'.gaia-firms-legend details':'.gaia-planet-signals-legend details');
          await legend.locator('summary').click();
          assert((await legend.innerText()).includes(number==='03'?'PM2.5':number==='04'?'火点の大きさ':'日射'));
          await page.screenshot({path:path.join(output,`${width}-${number}-legend.png`)});
          await legend.locator('summary').click();
        }
      }
      Object.assign(report.checks.at(-1),state);
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){
  report.status='failed';report.failure=error.stack;process.exitCode=1;
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
  await browser.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,cases:report.checks.length,errors:report.errors,failure:report.failure,output}));
}
