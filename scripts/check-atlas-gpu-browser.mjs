import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,out=path.resolve(process.env.GAIA_ATLAS_OUT||'artifacts/atlas-expansion-20261022/gpu-lifecycle');fs.mkdirSync(out,{recursive:true});
const report={scope:'Installed headless Chrome WebGL2, real local data; actual driver context-loss extension; injected denial and visibility',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
  for(const deny of [false,true]){
    const context=await browser.newContext({viewport:{width:1366,height:768}});await enforceBrowserSecurity(context,base);await context.route('https://**/*',r=>r.abort());
    await context.addInitScript(deny=>{
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,options){
        const atlas=type==='webgl2'&&options?.preserveDrawingBuffer===true&&options?.powerPreference==='low-power';
        if(atlas&&deny)return null;
        // Preserve the first atlas context: the sea renderer later creates its
        // own context with the same options and must not replace this probe.
        const gl=original.call(this,type,options);if(gl&&atlas&&!window.__atlasTestGl)window.__atlasTestGl=gl;return gl;
      };
    },deny);
    page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.text().startsWith('Atlas data GPU unavailable'))console.log(m.text());});
    const ready=async id=>{await page.waitForFunction(id=>globalThis.GaiaClimateHistory?.getState().id===id,id);await page.waitForFunction(()=>GaiaClimateHistory.getState().dataState==='ready'&&!document.querySelector('#japan-layer').matches('.is-map-title-transitioning,.is-map-data-intro')&&document.querySelector('#japan-overlay').dataset.viewAnimation!=='running'&&document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');await page.evaluate(()=>GaiaMapPlayback.stop());};
    await page.goto(`${base}/world.html#world-81`,{waitUntil:'domcontentloaded'});await ready('waterstress');
    const state=()=>page.evaluate(()=>GaiaClimateHistory.getRenderState());
    assert.equal((await state()).glyphs,0);assert.equal((await state()).contexts,0);assert.equal((await state()).style,'countries');
    assert(await page.locator('[data-stress-panel]').isVisible());report.checks.push('81 uses national polygons without creating a glyph GPU context');
    await page.locator('[data-map-stable-step="1"]').click();await ready('cropland');assert.equal((await state()).glyphs,0);assert.equal((await state()).contexts,0);assert(await page.locator('[data-cropland-panel]').isVisible());report.checks.push('82 uses country polygons without creating a glyph GPU context');
    await page.locator('[data-map-stable-step="1"]').click();await ready('yield');
    assert.equal((await state()).glyphs,0);assert.equal((await state()).contexts,0);assert(await page.locator('[data-yield-panel]').isVisible());report.checks.push('83 uses geographic selection and yield comparisons without a glyph GPU context');
    await page.locator('[data-map-stable-step="1"]').click();await ready('fertilizer');
    assert.equal((await state()).glyphs,0);assert.equal((await state()).contexts,0);assert(await page.locator('[data-fertilizer-panel]').isVisible());report.checks.push('84 uses source country polygons and consumption distribution without a glyph GPU context');
    await page.locator('[data-map-stable-step="1"]').click();await ready('longevity');
    assert.equal((await state()).glyphs,0);assert.equal((await state()).contexts,0);assert(await page.locator('[data-longevity-panel]').isVisible());report.checks.push('85 uses source country polygons and paired chronology without a glyph GPU context');
    await page.locator('[data-map-stable-step="1"]').click();await ready('urban');
    assert.equal((await state()).glyphs,0);assert.equal((await state()).contexts,0);assert(await page.locator('[data-urban-panel]').isVisible());report.checks.push('86 uses national population composition without a glyph GPU context');
    await page.locator('[data-map-stable-step="1"]').click();await ready('ageing');
    if(deny){assert.equal((await state()).engine,'unavailable');assert((await page.locator('[data-climate-detail]').textContent()).includes('互換表示'));await page.locator('[data-climate-year]').fill('2005');assert((await page.locator('[data-climate-detail]').textContent()).includes('互換表示'));assert.notEqual(await page.locator('[data-climate-value]').textContent(),'欠測');await page.screenshot({path:path.join(out,'unavailable.png')});report.checks.push('WebGL denial keeps real values, country selection, year slider and explicit compatibility text');}
    else{
      assert.equal((await state()).engine,'webgl2',JSON.stringify(await state()));assert.equal((await state()).contexts,1);assert((await state()).glyphs>10);
      const driver=await page.evaluate(()=>{const g=window.__atlasTestGl,e=g.getExtension('WEBGL_debug_renderer_info');return{version:g.getParameter(g.VERSION),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)};});report.checks.push({driver,initial:await state()});
      const before=await state();await page.waitForTimeout(400);assert.equal((await state()).draws,before.draws);report.checks.push('No idle GPU redraw');
      await page.locator('[data-climate-year]').fill('2005');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2005'&&document.querySelector('#gaia-climate-canvas').dataset.yearFade==='complete');assert((await state()).draws>before.draws);
      await page.evaluate(()=>{window.__atlasLoss=window.__atlasTestGl.getExtension('WEBGL_lose_context');window.__atlasLoss.loseContext();});await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().engine==='lost');await page.waitForFunction(()=>document.querySelector('[data-climate-detail]').textContent.includes('互換表示'));assert.notEqual(await page.locator('[data-climate-value]').textContent(),'欠測');
      await page.locator('[data-climate-year]').fill('2016');await page.waitForTimeout(450);assert((await page.locator('[data-climate-detail]').textContent()).includes('互換表示'));
      await page.evaluate(()=>window.__atlasLoss.restoreContext());await page.waitForFunction(()=>GaiaClimateHistory.getRenderState().engine==='webgl2'&&GaiaClimateHistory.getRenderState().glyphs>0);assert.equal((await state()).contexts,1);report.checks.push('Actual WebGL loss falls back; restore rebuilds resources on the same context');
      await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-climate-year]').fill('2010');await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateRenderedYear==='2010');assert.equal(await page.locator('#gaia-climate-canvas').getAttribute('data-year-fade'),'complete');
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await state();await page.waitForTimeout(350);assert.equal((await state()).draws,hidden.draws);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});report.checks.push('Reduced motion and hidden-document suspension');
      await page.evaluate(()=>{location.hash='#world-88';});await ready('childsurvival');assert.equal((await state()).contexts,1);await page.screenshot({path:path.join(out,'childsurvival.png')});
      await page.evaluate(()=>{location.hash='#world-81';});await ready('waterstress');assert.equal((await state()).glyphs,0);assert.equal((await state()).width,1);assert.equal((await state()).height,1);assert.equal((await state()).style,'countries');assert.equal((await state()).contexts,1);report.checks.push('Return to 81 releases the glyph backing store without allocating another context');
      await page.evaluate(()=>{location.hash='#world-76';});await ready('sealevel');assert.deepEqual(await page.evaluate(()=>({width:window.__atlasTestGl.canvas.width,height:window.__atlasTestGl.canvas.height})),{width:1,height:1});assert.equal((await state()).engine,'webgl2');assert((await state()).surface.landMasked);assert((await state()).stations>0);report.checks.push('76 uses its own WebGL sea surface and tide stations while the inactive atlas glyph backing store stays released');
    }
    assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;if(page&&!page.isClosed()){report.state=await page.evaluate(()=>globalThis.GaiaClimateHistory?.getRenderState());await page.screenshot({path:path.join(out,'failure.png')});}throw e;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
