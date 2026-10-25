import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { foodValue, foodAppearance, foodFormat } from '../src/exploration/food-catalog.js';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/food-country-fill-2026-09-10/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, base, checks: [], errors: [], sha256: {}, environment: 'Local installed Chrome; real same-origin datasets and Canvas pixels, desktop/touch emulation; saved NOAA/FIRMS and empty USGS, production CSP. No live-provider / physical-device claim.' };
for (const f of ['app.js','src/exploration/food-exhibits.js','src/exploration/food-catalog.js','src/exploration/food-drawing.js','src/exploration/food-country-fill.js','data/fao-food-balances.json','data/fao-food-security.json','data/natural-earth-50m-countries.geojson','gaia-mode-loader.js','src/exploration/index.js','index.html']) if (fs.existsSync(f)) report.sha256[f] = createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true });
let page;
const idle = () => page.waitForFunction(() => GaiaFoodExhibits?.getState().dataState === 'ready' && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running' && document.querySelector('#gaia-food-canvas').dataset.foodArrivalState === 'complete');
async function select(number) {
  await page.evaluate(n => GaiaMapCategories.buttons().find(b => b.textContent.trim() === String(n)).click(), number);
  if (number >= 70) await idle();
  else await page.waitForFunction(() => Number(document.querySelector('#japan-overlay').dataset.renewableCountryFillCount) > 0 && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
}
async function pixels() {
  return page.evaluate(() => {
    const canvas = document.querySelector('#gaia-food-canvas'), ctx = canvas.getContext('2d');
    const r = document.querySelector('#japan-map').getBoundingClientRect(), d = document.querySelector('#japan-overlay').dataset;
    const scale = (r.width >= 901 ? r.width/360 : Math.max(r.width/360,r.height/180)) * Number(d.earthZoom);
    const samples = [['Australia',134,-25],['China',105,35],['Brazil',-53,-10],['US',-100,39],['Russia',100,61],['Pacific',170,0]].map(([name,lon,lat]) => {
      const x = (r.width-360*scale)/2 + Number(d.earthOffsetX) + ((lon-150+540)%360)*scale;
      const y = (r.height-180*scale)/2 + Number(d.earthOffsetY) + (90-lat)*scale;
      const inside = x>=25&&y>=25&&x<r.width-25&&y<r.height-25;
      let filledFraction = null;
      if (inside) {
        const side = Math.max(1,Math.round(40*canvas.width/r.width)), patch = ctx.getImageData(Math.floor((x-20)*canvas.width/r.width),Math.floor((y-20)*canvas.height/r.height),side,side).data;
        let filled = 0; for(let i=3;i<patch.length;i+=4) if(patch[i]>30) filled++;
        filledFraction = filled/(side*side);
      }
      return {name, x,y, filledFraction, rgba: x>=0&&y>=0&&x<r.width&&y<r.height ? [...ctx.getImageData(Math.floor(x*canvas.width/r.width),Math.floor(y*canvas.height/r.height),1,1).data] : null};
    });
    return {samples, attributes:{...canvas.dataset}, state:GaiaFoodExhibits.getState()};
  });
}
async function pointAt(lon,lat) {
  return page.evaluate(([lon,lat]) => {
    const canvas=document.querySelector('#gaia-food-canvas'), r=document.querySelector('#japan-map').getBoundingClientRect(), d=document.querySelector('#japan-overlay').dataset;
    const scale=(r.width>=901?r.width/360:Math.max(r.width/360,r.height/180))*Number(d.earthZoom);
    const x=(r.width-360*scale)/2+Number(d.earthOffsetX)+((lon-150+540)%360)*scale;
    const y=(r.height-180*scale)/2+Number(d.earthOffsetY)+(90-lat)*scale;
    const rgba=[...canvas.getContext('2d').getImageData(Math.floor(x*canvas.width/r.width),Math.floor(y*canvas.height/r.height),1,1).data];
    return {x:x+r.left,y:y+r.top,rgba,hit:GaiaFoodExhibits.findPoiAt(x+r.left,y+r.top,'mouse')?.record.id,topElement:document.elementFromPoint(x+r.left,y+r.top)?.id};
  },[lon,lat]);
}
async function waitPaint() {
  await idle();
  await page.waitForFunction(()=>{const s=GaiaFoodExhibits.getState(),d=document.querySelector('#gaia-food-canvas').dataset;return d.foodFillPeriodKey===s.periodKey&&d.foodFillSeriesId===s.seriesId&&d.foodFillSelectedId===s.selectedId;});
}
function assertColor(pixel,style) {
  const rgb=style.color.startsWith('#')?[158,174,182]:style.color.match(/\d+/g).map(Number);
  rgb.forEach((channel,i)=>assert(Math.abs(pixel.rgba[i]-channel)<=4,`Actual country color ${pixel.rgba} must match legend ${style.color}`));
  assert(pixel.rgba[3]>30);
}
try {
  const sizes = before ? [[1440,900]] : [[1440,900],[390,844],[320,568],[844,390],[3840,2160]];
  for (const [width,height] of sizes) {
    const context = await browser.newContext({viewport:{width,height}, hasTouch:width<901, isMobile:width<901, reducedMotion:'reduce'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://services.swpc.noaa.gov/**', r=>r.fulfill({path:'data/ovation-aurora-snapshot.json',contentType:'application/json'}));
    await context.route('https://earthquake.usgs.gov/**', r=>r.fulfill({json:{type:'FeatureCollection',features:[]}}));
    await context.route('**/api/live/v1/firms', r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
    page = await context.newPage(); page.on('pageerror', e=>report.errors.push(e.message));
    await page.goto(base+'/?exhibit=70#world',{waitUntil:'domcontentloaded'});
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
    await page.locator('[data-feature-start]').click();
    await page.evaluate(()=>GaiaMapDemo.stop());
    for (const number of [70,71]) {
      await select(number);
      await page.locator('[data-food-overview]').click(); await idle();
      const scan = await pixels();
      await page.screenshot({path:path.join(output,`${width}-${number}-overview.png`)});
      if (before) assert(scan.samples.filter(s=>s.name!=='Pacific'&&s.filledFraction>.7).length < 2, 'Reproduce: country-interior areas are not filled (small glyphs may cross individual pixels)');
      else {
        assert.equal(scan.attributes.foodEncoding,'country-choropleth');
        assert(Number(scan.attributes.foodFilledCountryCount)>150);
        if (width>=901) assert(scan.samples.filter(s=>s.name!=='Pacific'&&s.rgba&&s.rgba[3]>50).length>=4, 'Country interiors really contain painted pixels');
        const ocean = scan.samples.find(s=>s.name==='Pacific');
        if(ocean.rgba) assert.equal(ocean.rgba[3],0, 'Do not fill the ocean');
      }
      report.checks.push({width,height,number,...scan});
      if (!before && [1440,390].includes(width)) {
        const kind=number===70?'food-balances':'food-security', data=JSON.parse(fs.readFileSync(`data/fao-${kind}.json`));
        const target=await pointAt(125,-23);
        assert.equal(target.topElement,'japan-map','Country interior is exposed to real map input');
        assert.equal(target.hit,'036','Polygon hit reaches Australia far from its representative marker');
        if(width<901) await page.touchscreen.tap(target.x,target.y); else await page.mouse.click(target.x,target.y);
        assert.equal(await page.locator('[data-food-country]').inputValue(),'036');
        await page.locator('[data-food-country]').selectOption('036'); await waitPaint();
        for(const id of number===70?['2905','2511']:['21035','21010']) {
          await page.locator('[data-food-series]').selectOption(id);
          const series=data.series.find(s=>s.id===id);
          for(const index of [0,series.periods.length-1]) {
            await page.locator('[data-food-year]').fill(String(index)); await waitPaint();
            const period=series.periods[index],value=foodValue(kind,period.rows.find(r=>r[0]==='036'));
            const pixel=await pointAt(125,-23);assertColor(pixel,foodAppearance(kind,id,value));
            assert.equal(await page.locator('[data-food-value]').textContent(),Number.isFinite(value)?`${foodFormat(value)} %`:'算出・数値なし');
            report.checks.push({width,number,series:id,period:period.key,country:'036',value,rgba:pixel.rgba,check:'real fill color / legend / readout match'});
          }
        }
        const paints=await page.locator('#gaia-food-canvas').getAttribute('data-food-fill-paint-count');
        await page.waitForTimeout(450);
        assert.equal(await page.locator('#gaia-food-canvas').getAttribute('data-food-fill-paint-count'),paints,'Stable country fills are cached, not repainted every animation frame');
        await page.screenshot({path:path.join(output,`${width}-${number}-selected.png`)});
        if(number===70) {
          await page.locator('[data-food-country]').selectOption('392'); await waitPaint();
          assert.equal(await page.locator('[data-food-value]').textContent(),'算出・数値なし');
          const missing=await pointAt(140.3,39.4); assertColor(missing,foodAppearance(kind,'2511',null));
          assert.equal(missing.hit,'392');
          report.checks.push({width,number,check:'missing Japan remains gray, not zero',rgba:missing.rgba});
        }
        await page.locator('[data-food-country]').selectOption('250'); await waitPaint();
        assert(!(await page.locator('[data-food-country] option:checked').textContent()).includes('なし'),'France is correctly mapped with its own extended ISO code');
        assert.equal((await pointAt(2,47)).hit,'250');
        if(width===1440) {
          await page.locator('[data-food-overview]').click(); await waitPaint();
          for(const lon of [-35,-25]) assert.equal((await pointAt(lon,75)).hit,'304','Greenland is pickable on both sides of the 30 W world seam');
          const geometry=await page.evaluate(()=>GaiaMapObservationAdapter.getCountryGeometry().countries.map(({id,iso3})=>({id,iso3})));
          assert.equal(geometry.find(c=>c.id==='578').iso3,'NOR');
          assert.deepEqual(geometry.filter(c=>c.id==='036'),[{id:'036',iso3:'AUS'}],'Do not substitute Australia-owned territory polygons');
          assert(!geometry.some(c=>c.id==='891'),'Do not map a historical state onto modern countries');
          report.checks.push({width,number,check:'own M49 mapping / France / Norway / historical states / world seam'});
        }
      }
    }
    if (width===1440) { await select(13); await page.waitForTimeout(900); await page.screenshot({path:path.join(output,'13-reference.png')}); }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();
  }
  if(!before) {
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',r=>r.abort());
    let fail=true,requests=0;
    await context.route('**/data/natural-earth-50m-countries.geojson*',r=>{requests++;return fail?r.fulfill({status:503,json:{error:'Deliberate local geometry failure'}}):r.continue();});
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(base+'/?exhibit=70#world',{waitUntil:'domcontentloaded'});
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();await page.locator('[data-feature-start]').click();await page.evaluate(()=>GaiaMapDemo.stop());
    await page.locator('#gaia-food-canvas[data-food-geometry-state="error"]').waitFor({state:'attached'});
    assert((await page.locator('[data-food-status]').textContent()).includes('国境図形を読み込めません'));
    assert.equal(await page.locator('[data-food-controls]').isDisabled(),false,'Original numeric data is still usable if geometry fails');
    await page.screenshot({path:path.join(output,'geometry-error.png')});
    fail=false;await page.locator('[data-food-retry]').click();await waitPaint();
    assert.equal(requests,2,'Retry only loads the failed shared geometry again');
    assert.equal(await page.locator('[data-food-retry]').isVisible(),false);
    assert(Number(await page.locator('#gaia-food-canvas').getAttribute('data-food-filled-country-count'))>150);
    await page.screenshot({path:path.join(output,'geometry-retry.png')});
    report.checks.push({check:'Injected geometry failure is explicit, numeric controls survive, actual retry restores country fills',requests});
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
} catch(e) {report.status='failed';report.failure=e.stack;process.exitCode=1;}
finally {await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure}));}
