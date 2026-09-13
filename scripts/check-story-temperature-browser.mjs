import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/story-temperature-2026-09-10/${before ? 'before' : only || 'after'}`);
fs.mkdirSync(output, {recursive: true});
const report = {status: 'running', base, before, checks: [], errors: [], missing: [], hashes: {}, environment: 'Installed Chrome, actual same-origin assets/data; viewport/touch emulation, isolated seeded save then native input; external services blocked. HTTPS headers are unmodified.'};
for (const f of ['app.js', 'novel-mode.js', 'novel-background-cues.js', 'story-temperature.js', 'story-temperature.css', 'index.html', 'gaia-mode-loader.js', 'data/story-temperature-annual.json', 'data/story-temperature-annual.bin']) {
  if (fs.existsSync(f)) report.hashes[f] = createHash('sha256').update(fs.readFileSync(f)).digest('hex');
}
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
let page;
let releaseData = () => {};
const binary=fs.readFileSync('data/story-temperature-annual.bin');
const scenarios=[['pc',1440,900], ['mobile',390,844], ...before ? [] : [['small',320,568],['landscape',844,390],['reduced',390,844],['failure',390,844],['cancel',1440,900]]].filter(s=>!only||s[0]===only);
try {
  for (const [name, width, height] of scenarios) {
    const context = await browser.newContext({viewport: {width,height}, hasTouch: width < 900, isMobile: width < 900, reducedMotion:name==='reduced'?'reduce':'no-preference'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    if(name==='failure') await context.route('**/story-temperature-annual.bin',route=>route.fulfill({status:503,body:'intentional QA failure'}));
    if(name==='cancel') {
      const gate=new Promise(resolve=>{releaseData=resolve;});
      await context.route('**/story-temperature-annual.bin',async route=>{await gate;await route.continue();});
    }
    await context.addInitScript(({reduced}) => {
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({messageSpeedPercent:400,reducedMotion:reduced}));
    },{reduced:name==='reduced'});
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', r => {if (r.status() === 404) report.missing.push(r.url());});
    const activate=selector=>width<900?page.locator(selector).tap():page.locator(selector).click();
    await page.goto(base + '/story', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.GaiaNovel && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
    await page.evaluate(() => {
      const s = GaiaNovel.getState();
      s.stepId = 'map_mode01_022';
      s.clear = false;
      s.metCharacters = {amane:true,mizuha:true,sakuya:true};
      localStorage.setItem(GaiaNovel.storageKey, JSON.stringify(s));
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.stepId === 'map_mode01_022' && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    for (let i = 0; i < 12 && await page.locator('#novel-layer').getAttribute('data-step-id') === 'map_mode01_022'; i++) {
      await activate('#novel-dialogue');
      await page.waitForTimeout(120);
    }
    await page.waitForFunction(() => document.body.dataset.novelInteractionState === 'open');
    if (!before) {
      const skip = page.locator('[data-temperature-return]');
      await skip.waitFor({state:'visible'});
      assert.equal((await skip.textContent()).replace(/\s/g,''),'スキップ▶','The visible return button uses the requested skip label');
      assert.equal(await skip.getAttribute('aria-label'),'スキップして物語へ戻る');
    }
    if (before) {
      await page.waitForFunction(() => document.querySelector('#japan-overlay')?.dataset.quantitativeLegendId === 'co2-concentration');
      await page.screenshot({path:path.join(output, name + '-demo.png')});
      const slider = page.locator('#japan-layer [data-signal-time]').first();
      await slider.focus();
      await slider.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.stepId === 'map_mode01_024');
      await page.waitForTimeout(700);
      await page.screenshot({path:path.join(output, name + '-narration.png')});
      const cue = await page.evaluate(() => GAIA_NOVEL_BACKGROUND_CUES.forStep(GAIA_NOVEL_STORY.scenes.flatMap(s => s.steps).find(s => s.id === 'map_mode01_024')).assetPath);
      assert(cue.includes('modis-land-cover'));
      report.checks.push({name, reproduced:'CO2 legend in temperature demo; one slider move auto-returns before location exploration; land-cover narration background', cue});
    } else if(['failure','cancel'].includes(name)) {
      await page.locator('[data-temperature-return]').waitFor({state:'visible'});
      if(name==='failure') await page.waitForFunction(()=>document.querySelector('[data-temperature-status]')?.textContent.includes('読み込めませんでした'));
      assert.equal(await page.locator('[data-temperature-time]').isDisabled(),true);
      await page.screenshot({path:path.join(output,name+'-pending.png')});
      await activate('[data-temperature-return]');
      await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_024');
      releaseData();
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('.story-temperature').count(),0,'No stale async mount after returning');
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_024');
      report.checks.push({name, safeReturn:true});
    } else {
      await page.waitForFunction(() => document.querySelector('.story-temperature')?.dataset.ready === 'true');
      // 2026-09-11: automatic playback/return is now requested. Pause to test
      // deliberate comparisons before the end; the separate autoplay suite tests completion.
      await activate('[data-temperature-play]');
      await page.locator('[data-temperature-time]').press('Home');
      await page.screenshot({path:path.join(output,name+'-1958.png')});
      const slider=page.locator('[data-temperature-time]');
      const firstWarm=Number(await page.locator('.story-temperature').getAttribute('data-warm-cells'));
      const firstPng=await page.locator('.story-temperature canvas').screenshot();
      await slider.press('ArrowRight');
      await page.waitForTimeout(900);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023','Reported single-slider operation must not close the demo');
      assert.equal(await page.locator('.story-temperature').getAttribute('data-year'),'1959');
      await slider.press('End');
      await slider.press('ArrowLeft');
      await page.waitForTimeout(900);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_023');
      assert.equal(await page.locator('.story-temperature').getAttribute('data-year'),'2024');
      const canvas=page.locator('.story-temperature canvas');
      if(name==='landscape') {
        const cb=await canvas.boundingBox(),sb=await slider.boundingBox();
        assert(cb.y<height&&cb.y+cb.height<=height&&sb.y>cb.y&&sb.y+sb.height<=height,'Short landscape keeps the map and slider in view together');
        assert(sb.x>cb.x+cb.width,'Short landscape controls sit alongside the map');
      }
      const finalWarm=Number(await page.locator('.story-temperature').getAttribute('data-warm-cells'));
      assert(finalWarm>firstWarm+4000,'The actual data, not a fabricated pattern, shows the longer-term warming');
      assert(!firstPng.equals(await canvas.screenshot()),'Rendered map changes with the year');
      const samples=[];
      const tapPoint=async (lon,lat)=> {
        await canvas.scrollIntoViewIfNeeded();
        const b=await canvas.boundingBox(),w=Math.min(b.width,b.height*2),h=w/2;
        const x=b.x+(b.width-w)/2+(lon+180)/360*w,y=b.y+(b.height-h)/2+(90-lat)/180*h;
        if(width<900)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
        const actual=await page.locator('.story-temperature').getAttribute('data-selected-value');
        const cell=await page.locator('.story-temperature').getAttribute('data-selected-cell');
        const [r,c]=cell.split(',').map(Number),year=Number(await slider.inputValue());
        const raw=binary.readInt16LE(((year-1958)*16200+r*180+c)*2);
        assert.equal(actual,raw===32767?'missing':String(raw/100),'Touched point equals the local source cell');
        samples.push({lon,lat,year,cell,actual});
      };
      await tapPoint(139,35);
      await page.screenshot({path:path.join(output,name+'-2024.png')});
      const selected=await page.locator('[data-temperature-point]').textContent();
      assert(selected.includes('2024年') && selected.includes('℃'));
      await tapPoint(-61,-3);
      let missingCell=0;
      while(binary.readInt16LE((66*16200+missingCell)*2)!==32767)missingCell++;
      await tapPoint(-179+(missingCell%180)*2,89-Math.floor(missingCell/180)*2);
      assert((await page.locator('[data-temperature-point]').textContent()).includes('データなし'));
      await slider.press('Home');
      await tapPoint(139,35);
      await activate('[data-temperature-next]');
      assert.equal(await slider.inputValue(),'1959');
      await activate('[data-temperature-prev]');
      assert.equal(await slider.inputValue(),'1958');
      // Native pointer/touch seek as well as keyboard; repeat without returning.
      await slider.scrollIntoViewIfNeeded();
      const sb=await slider.boundingBox(),sx=sb.x+sb.width*.57,sy=sb.y+sb.height/2;
      if(width<900)await page.touchscreen.tap(sx,sy);else await page.mouse.click(sx,sy);
      assert(Number(await slider.inputValue())>1960);
      await tapPoint(-61,-3);
      await activate('.story-temperature-source summary');
      await page.locator('[data-temperature-retrieved]').scrollIntoViewIfNeeded();
      const source=await page.locator('.story-temperature-source').textContent();
      for(const term of ['1951–1980','12か月','欠測','1958–2025','NASA GISS','Natural Earth'])assert(source.includes(term));
      await page.screenshot({path:path.join(output,name+'-source.png')});
      await activate('.story-temperature-source summary');
      const layout=await page.evaluate(()=>{
        const s=document.querySelector('.story-temperature');
        return {pageOverflow:document.documentElement.scrollWidth-innerWidth,modalOverflow:s.scrollWidth-s.clientWidth};
      });
      assert(layout.pageOverflow<=1&&layout.modalOverflow<=1);
      if(name==='pc') {
        await canvas.press('Enter');
        await canvas.press('ArrowLeft');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-temperature-return]').evaluate(e=>e===document.activeElement),true);
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.locator('.story-temperature-source summary').evaluate(e=>e===document.activeElement),true);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('[data-temperature-return]').evaluate(e=>e===document.activeElement),true);
      }
      await page.evaluate(()=> {
        window.__temperatureExit=[];
        const sample=()=> {
          const map=document.querySelector('#japan-layer');
          __temperatureExit.push({hidden:map.hidden,temperature:map.classList.contains('is-story-temperature')});
          if(__temperatureExit.length<100)requestAnimationFrame(sample);
        };requestAnimationFrame(sample);
      });
      await activate('[data-temperature-return]');
      await page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_024' && !document.body.dataset.novelInteractionState);
      await page.waitForTimeout(700);
      await page.screenshot({path:path.join(output,name+'-narration.png')});
      assert.equal(await page.locator('.story-temperature').count(),0);
      const exit=await page.evaluate(()=>__temperatureExit);
      assert(exit.every(f=>f.hidden||f.temperature),'Never expose the old CO2 canvas while the modal fades out');
      // Save/load the exact reported narration, then the preceding dialogue -> replay.
      await activate('#novel-save-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      await activate('#novel-save-close');
      await activate('#novel-load-button');
      await activate('.novel-save-slot[data-slot-index="0"]');
      await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='map_mode01_024'&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
      const cue=await page.evaluate(()=>GAIA_NOVEL_BACKGROUND_CUES.forStep(GAIA_NOVEL_STORY.scenes.flatMap(s=>s.steps).find(s=>s.id==='map_mode01_024')).assetPath);
      assert(cue.includes('temperature-anomaly'));
      await activate('#novel-log-button');
      await activate('#novel-log-view-script');
      const downloadReady=page.waitForEvent('download');
      await activate('#novel-log-script-export');
      const download=await downloadReady;
      const downloaded=path.join(output,name+'-script.md');await download.saveAs(downloaded);
      assert(fs.readFileSync(downloaded,'utf8').includes('スライダーを動かしながら各地をタップすると、青、黄、赤の等高線'));
      await activate('#novel-log-close');
      for(let count=0;count<18 && await page.locator('#novel-layer').getAttribute('data-step-id')==='map_mode01_024';count++) {
        await activate('#novel-dialogue');await page.waitForTimeout(120);
      }
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'),'map_mode01_025');
      report.checks.push({name, selected, samples, firstWarm,finalWarm,layout,exit,source,nativeSaveLoadAndScriptExport:true,repeatedComparison:true});
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
    console.log('PASS ' + name);
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missing, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
