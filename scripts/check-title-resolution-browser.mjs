import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL;
const before = process.env.GAIA_BEFORE === '1';
const actions = process.env.GAIA_ACTION_SMOKE === '1';
const out = `artifacts/title-resolution-20261019/${before ? 'before' : actions ? 'actions' : 'after'}`;
fs.mkdirSync(out, {recursive: true});
const report = {sha: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), tree:'SHA + uncommitted changes', before, checks:[], errors:[]};
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
const cases = [
  {name:'fhd-mouse', width:1920, height:1080},
  {name:'fhd-touch', width:1920, height:1080, touch:true},
  {name:'4k-mouse', width:3840, height:2160},
  {name:'reference-wide', width:2560, height:1260},
  {name:'wide-mouse', width:1920, height:946},
  {name:'laptop', width:1366, height:768},
  {name:'narrow-desktop', width:961, height:768},
  {name:'mobile', width:390, height:844, touch:true},
];
let page;
try {
  for (const item of cases.filter(item => !actions || item.name.startsWith('fhd-'))) {
    console.log(item.name);
    const context = await browser.newContext({viewport:{width:item.width,height:item.height}, hasTouch:!!item.touch, reducedMotion:actions?'no-preference':'reduce'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.addInitScript(actions => {
      if (!actions) sessionStorage.setItem('gaia:title-return-resume','1');
      localStorage.setItem('gaia:opening-route-guide:v3','seen');
      localStorage.setItem('gaia:language:v1','ja');
    }, actions);
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${item.name}: ${error.message}`));
    await page.goto(`${base}/?routeGuide=0`, {waitUntil:'domcontentloaded'});
    if (actions) {
      await page.locator('#gaia-opening-sound-off').click();
      await page.locator('#gaia-opening-skip').click();
    }
    await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    await page.evaluate(() => document.fonts.ready);
    if (actions) await page.waitForTimeout(900);
    const state = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        hover:matchMedia('(hover:hover) and (pointer:fine)').matches,
        anyHover:matchMedia('(any-hover:hover) and (any-pointer:fine)').matches,
        aboutParent:document.querySelector('#gaia-opening-concept').parentElement.parentElement.id,
        guideHidden:document.querySelector('#gaia-opening-route-guide-replay').hidden,
        menu:rect('#gaia-opening-final-menu'), logo:rect('.gaia-vn-work-title'),
        routes:rect('.gaia-opening-route-grid'), about:rect('#gaia-opening-concept'), audio:rect('#gaia-audio-dock'),
        overflow:document.documentElement.scrollWidth-innerWidth,
        labelOverflows:[...document.querySelectorAll('.gaia-opening-route-grid .gaia-opening-route strong')].map(el => el.scrollWidth-el.clientWidth),
      };
    });
    await page.screenshot({path:`${out}/${item.name}.png`});
    report.checks.push({...item,...state});
    assert.equal(state.overflow,0);
    if (!before && item.width > 960) {
      assert.equal(state.aboutParent,'gaia-opening');
      assert.equal(state.guideHidden,!item.touch, 'Explicit help stays available on touch devices without rollover');
      assert(Math.abs(state.about.top-state.audio.top)<1);
      assert(state.about.right<state.audio.left);
      assert(state.logo.right < item.width*.52, 'Title stays left of the cast');
      assert(Math.abs(state.logo.width/item.width-.36)<.01, 'Desktop title has a consistent relative size');
      assert(Math.abs(state.logo.top/item.height-.24)<.01, 'Desktop title has a consistent vertical anchor');
      assert(Math.abs(state.routes.width/state.logo.width-(item.width<=1440?1:.84))<.01, 'Both actions use the complete menu row');
      assert(state.routes.bottom < item.height*.69, 'Actions remain in the sky above the horizon');
      assert(state.labelOverflows.every(n => n<=1), 'Labels fit without wrapping');
    }
    if (!before && item.touch) {
      if (await page.locator('#gaia-opening-route-guide').isVisible()) await page.keyboard.press('Escape');
      await page.locator('#gaia-opening-route-guide-replay').tap();
      await page.locator('#gaia-opening-route-guide').waitFor({state:'visible'});
      assert.equal(await page.locator('#gaia-opening-route-guide').getAttribute('role'),'dialog');
      await page.keyboard.press('Escape');
      await page.locator('#gaia-opening-route-guide').waitFor({state:'hidden'});
      report.checks.at(-1).touchGuide='tap opens; Escape closes';
    }
    if (actions) {
      if (!item.touch) {
        await page.locator('#gaia-opening-route-other').hover();
        await page.locator('#gaia-opening-route-guide').waitFor({state:'visible'});
        assert.equal(await page.locator('#gaia-opening-route-guide').getAttribute('role'),'tooltip');
        await page.keyboard.press('Escape');
        await page.locator('#gaia-opening-route-guide').waitFor({state:'hidden'});
      }
      const about = page.locator('#gaia-opening-concept');
      assert.equal(await about.getAttribute('href'),'./concept/');
      assert(await about.evaluate(el => { const r=el.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return hit===el || el.contains(hit); }));
      await page.locator('#gaia-opening-route-other')[item.touch?'tap':'click']();
      await page.waitForURL(url => url.pathname==='/world', {waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => document.querySelector('#japan-layer')?.getAttribute('aria-hidden')==='false'
        && document.documentElement.dataset.gaiaAppReady==='true', null, {timeout:60000});
      await page.locator('#gaia-opening').waitFor({state:'hidden'});
      await page.locator('[data-feature-start]').click();
      await page.locator('#japan-close').click();
      await page.locator('#intro-path-stage').waitFor({state:'visible'});
      if (await page.locator('#intro-entry-guide').isVisible()) await page.keyboard.press('Escape');
      await page.locator('#intro-title-return').click();
      await page.locator('#gaia-opening-route-other').waitFor({state:'visible'});
      await page.waitForFunction(() => !document.body.classList.contains('gaia-title-returning'));
      assert.equal(await page.locator('#gaia-opening-route-guide-replay').isVisible(),!!item.touch);
      report.checks.at(-1).actions='natural opening skipped; pointer help; about hit target; map entry; return to title';
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
  report.status='passed';
} catch (error) {
  report.status='failed'; report.failure=error.stack; throw error;
} finally {
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2)); await browser.close();
}
