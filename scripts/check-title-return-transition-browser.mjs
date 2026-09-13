import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const output = path.resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || `artifacts/title-return-transition-2026-09-10/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, checks: [], errors: [], sha256: {}, note: 'Installed Chrome; actual frames and native clicks/taps, local content, production CSP. Viewport emulation, not physical devices.' };
for (const f of ['opening.js','opening.css','app.js','gaia-mode-loader.js','index.html']) report.sha256[f] = createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const cases = before ? [{ width:1440, height:900 }] : [
    {width:1440,height:900}, {width:390,height:844}, {width:320,height:568},
    {width:844,height:390}, {width:3840,height:2160}, {width:1440,height:900,reduced:true},
    {width:1440,height:900,slow:true}, {width:1440,height:900,keyboard:true}, {width:390,height:844,double:true},
  ];
  for (const test of cases) {
    const name = `${test.width}${test.reduced ? '-reduced' : test.slow ? '-slow-art' : test.keyboard ? '-keyboard' : test.double ? '-double' : ''}`;
    if (only && name !== only) continue;
    const context = await browser.newContext({ viewport: { width:test.width,height:test.height }, hasTouch:test.width<=900, isMobile:test.width<=900, reducedMotion:test.reduced ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    let delayedRequests = 0;
    if (test.slow) await context.route('**/01-starlit-observatory.webp', async route => {
      delayedRequests++;
      await new Promise(resolve => setTimeout(resolve, 1800));
      await route.continue();
    });
    await context.addInitScript(() => {
      localStorage.setItem('gaia-senseware-bgm-muted','true');
      localStorage.setItem('gaia-senseware-bgm-volume','0.37');
      globalThis.__returnFrames = [];
      document.addEventListener('click', event => {
        if (!event.target.closest?.('#intro-title-return')) return;
        const started = performance.now();
        const frames = [];
        globalThis.__returnFrames = frames;
        const sample = () => {
          const veil=document.querySelector('#gaia-title-return-transition'), intro=document.querySelector('#intro-layer'), opening=document.querySelector('#gaia-opening');
          frames.push({ t:performance.now()-started, phase:veil?.dataset.phase||null, alpha:veil ? Number(getComputedStyle(veil).opacity) : 0,
            intro:intro?.getAttribute('aria-hidden')==='false', title:!opening?.hidden, bodyActive:document.body.classList.contains('gaia-opening-active'),
            blocked:document.querySelector('.experience')?.inert });
          if (performance.now()-started<5000) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },true);
    });
    page = await context.newPage(); page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));
    const press = async selector => test.width <= 900 ? page.locator(selector).tap() : page.locator(selector).click();
    const waitIntro = async () => {
      await page.waitForFunction(() => document.querySelector('#intro-layer')?.getAttribute('aria-hidden')==='false' && document.querySelector('#gaia-opening')?.hidden && document.querySelector('#gaia-boot')?.hidden);
      await page.evaluate(() => GaiaIntroEntryGuide?.close?.({restoreFocus:false}));
    };
    const waitTitle = () => page.waitForFunction(() => {
      const o=document.querySelector('#gaia-opening'),m=document.querySelector('#gaia-opening-final-menu');
      return o&&!o.hidden&&!o.inert&&m&&!m.hidden&&!m.inert&&m.classList.contains('is-visible')&&!document.querySelector('#gaia-title-return-transition')&&document.querySelector('#gaia-boot')?.hidden;
    },null,{timeout:20000});
    await page.goto(`${base}/#top`,{waitUntil:'domcontentloaded'}); await waitIntro();
    const initialDocument = await page.evaluate(()=>performance.timeOrigin);
    await page.screenshot({path:path.join(output,`${name}-intro.png`)});
    for (const cycle of [1,2]) {
      const started = Date.now();
      if (test.keyboard) { await page.locator('#intro-title-return').focus(); await page.keyboard.press('Enter'); }
      else if (test.double) await page.locator('#intro-title-return').dblclick();
      else await press('#intro-title-return');
      // A full-resolution 4K PNG can take longer than the transition itself.
      // Its paint-frame probe still runs; capture its complete landing below.
      if (!before && !test.reduced && test.width < 3840 && !test.double) {
        await page.waitForFunction(()=>document.querySelector('#gaia-title-return-transition')?.dataset.phase==='cover');
        await page.waitForTimeout(200);
        await page.screenshot({path:path.join(output,`${name}-${cycle}-outgoing.png`)});
        await page.waitForFunction(()=>document.querySelector('#gaia-title-return-transition')?.dataset.phase==='reveal');
        await page.waitForTimeout(350);
        await page.screenshot({path:path.join(output,`${name}-${cycle}-incoming.png`)});
      }
      await waitTitle();
      const duration=Date.now()-started, documentId=await page.evaluate(()=>performance.timeOrigin);
      const frames=await page.evaluate(()=>__returnFrames);
      if (before) {
        if (cycle===1) assert.notEqual(documentId,initialDocument,'Baseline direct return reloads the document');
        if (cycle===2) {
          assert(frames.length);
          assert(frames[0].title&&!frames[0].intro&&!frames[0].phase,'Baseline same-document return swaps by its first paint');
        }
      } else {
        assert.equal(documentId,initialDocument,'Returning to title must not reboot the app');
        const out=frames.filter(f=>f.phase==='cover'), incoming=frames.filter(f=>f.phase==='reveal');
        assert(out.length&&incoming.length,'Both sides of the dissolve have real painted frames');
        assert(out.every(f=>f.intro&&!f.title&&f.blocked),'Outgoing scene remains behind the cover');
        assert(incoming.every(f=>f.title&&!f.intro&&f.blocked),'Title appears only after the covered scene swap');
        if (!test.reduced) {
          assert(out.filter(f=>f.alpha>0.05&&f.alpha<0.95).length>=4,'Outgoing fade is not a one-frame cut');
          assert(incoming.filter(f=>f.alpha>0.05&&f.alpha<0.95).length>=8,'Incoming fade is not a one-frame cut');
          assert(duration>=1300&&duration<10000,`Unexpected transition duration ${duration}`);
        } else assert(duration<3000,'Reduced-motion return remains brief');
        if (test.slow && cycle===1) {
          const hold=frames.filter(f=>f.phase==='hold');
          assert(delayedRequests>0&&hold.length>1&&hold.at(-1).t-hold[0].t>700,'Opaque cover waits for the delayed title artwork');
          assert(hold.every(f=>f.alpha>=.999),'Delayed decoding must never expose a half-loaded title');
        }
        assert.equal(await page.locator('.experience').getAttribute('inert'),null);
        assert.equal(await page.locator('#gaia-opening-final-menu').evaluate(m=>m.contains(document.activeElement)||m===document.activeElement||document.querySelector('#gaia-opening-route-guide')?.contains(document.activeElement)),true);
      }
      assert.equal(new URL(page.url()).hash,'');
      assert.equal(await page.evaluate(()=>localStorage.getItem('gaia-senseware-bgm-volume')),'0.37');
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('gaia:title-return-resume')),null);
      assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
      await page.screenshot({path:path.join(output,`${name}-${cycle}-title.png`)});
      report.checks.push({name,cycle,duration,documentId,frames});
      if (cycle===1) { await press('#gaia-opening-route-other'); await waitIntro(); }
    }
    if (!before && !test.reduced && !test.slow && !test.keyboard && !test.double && [1440,390].includes(test.width)) {
      await press('#gaia-opening-route-story');
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor({timeout:15000});
      await page.locator('#gaia-story-prologue button').first().click();
      await page.waitForFunction(()=>!document.querySelector('#gaia-story-prologue') && location.hash==='#story' && Boolean(document.querySelector('#novel-layer')?.dataset.stepId),null,{timeout:20000});
      assert.equal(await page.locator('#gaia-opening').isHidden(),true);
      assert.equal(await page.locator('#novel-layer').evaluate(n=>getComputedStyle(n).visibility),'visible');
      report.checks.push({name,check:'Returned title enters the existing story prologue and first rendered scene',step:await page.locator('#novel-layer').getAttribute('data-step-id')});
      await page.screenshot({path:path.join(output,`${name}-story-reentry.png`)});
    }
    await context.close(); console.log(`PASS ${name}: ${before?'baseline abrupt paths':'direct and repeated title dissolve'}`);
  }
  assert(report.checks.length > 0, 'Requested title-return case must exist');
  assert.deepEqual(report.errors,[]); report.status='passed';
} catch (error) {
  report.status='failed'; report.failure=error.stack;
  if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)); await browser.close();
}
