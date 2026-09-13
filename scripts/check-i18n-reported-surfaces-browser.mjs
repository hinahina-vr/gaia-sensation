import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const before = process.argv.includes('--before');
const out = `artifacts/i18n/reported-surfaces/${before ? 'before' : 'after'}`;
fs.mkdirSync(out, {recursive:true});
const report = {status:'running', scope:'Real local Chrome: title focus hints and title-to-story white prologue; desktop and touch emulation. Not production.', checks:[]};
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
try {
  for(const width of (before ? [1440] : [1440,390])) for(const lang of (before ? ['en'] : ['en','zh-CN'])) {
    const context = await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390});
    await context.route('https://**',r=>r.abort());
    await context.addInitScript(lang=>{sessionStorage.setItem('gaia:title-return-resume','1');localStorage.setItem('gaia:language:v1',lang);},lang);
    page = await context.newPage();
    await page.goto('http://127.0.0.1:4492/');
    const story = page.locator('#gaia-opening-route-story');
    await story.waitFor({state:'visible',timeout:30000});
    const hints=[];
    for(const selector of ['#gaia-opening-route-story','#gaia-opening-route-other']) {
      await page.locator(selector).focus();
      await page.locator('#gaia-opening-route-guide.is-visible').waitFor();
      await page.waitForTimeout(500);
      hints.push(await page.locator('[data-route-guide-copy]').textContent());
    }
    // Touch presents the two-step entry guide, not a hover-only tooltip.
    // Dismiss that real guide before activating the route beneath it.
    await page.keyboard.press('Escape');
    await story.click();
    await page.locator('#gaia-story-prologue[data-phase="breathing"]').waitFor({timeout:30000});
    const copy = await page.locator('.gaia-story-prologue-copy p').allTextContents();
    await page.screenshot({path:`${out}/${width}-${lang}-white-prologue.png`});
    if(!before) {
      assert(copy.every(s=>!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s)),`Untranslated prologue: ${copy}`);
      assert(hints.every(s=>!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s)),`Untranslated focus hints: ${hints}`);
      assert.equal(copy[0],lang==='en'?'Beyond the white light, the sea was swaying.':'白光的彼端，海面轻轻摇曳。');
      const buttons=await page.locator('.gaia-story-prologue-controls button').allTextContents();
      assert(buttons.every(s=>!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s)),`Untranslated prologue controls: ${buttons}`);
      const overflow=await page.locator('.gaia-story-prologue-copy').evaluate(el=>el.scrollWidth>el.clientWidth+1);
      assert(!overflow,'White prologue overflows horizontally');
      await page.evaluate(()=>GaiaI18n.set('ja'));
      assert.equal(await page.locator('.gaia-story-prologue-copy p').first().textContent(),'白い光の向こうで、海が揺れていた。');
    }
    report.checks.push({width,lang,hints,copy});
    await context.close();
  }
  report.status=before?'reproduced':'passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
