import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:4447';
const baseline = '3a14ec587a8fb7203b37674c12d95a77c1cf4a78';
const output = path.resolve(process.env.GAIA_FEATURE_BRIGHT_OUTPUT || 'artifacts/feature-bright');
fs.mkdirSync(output, { recursive: true });
const files = ['app.js', 'mode-entry-guide.js', 'mode-feature-intro.css', 'gaia-mode-loader.js', 'index.html',
  ...['live','time','discovery'].map(kind => `assets/modes/guide-map-${kind}-mizu-ame-v1.webp`)];
const report = { status: 'running', environment: 'Local Chrome, saved fixture data; screenshot/layout regression, not live-provider or physical-device QA',
  baseCommit: execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8' }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks:[], errors:[] };
const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true });
let page;
try {
  for (const [width,height] of [[1440,900],[2560,1392],[3840,2088]]) {
    const scans = [];
    for (const before of [true,false]) {
      const context = await browser.newContext({ viewport:{width,height}, reducedMotion:'reduce' });
      await context.addInitScript(() => { localStorage.setItem('gaia-senseware-bgm-muted','true'); globalThis.EventSource = class { addEventListener(){} close(){} }; });
      await context.route('https://services.swpc.noaa.gov/**', r => r.fulfill({ path:'data/ovation-aurora-snapshot.json', contentType:'application/json' }));
      await context.route('**/api/live/v1/firms', r => r.fulfill({ path:'data/firms-active-fire-snapshot.json', contentType:'application/json' }));
      if (before) for (const file of ['mode-feature-intro.css','mode-entry-guide.js','app.js']) {
        const body = execFileSync('git', ['show',`${baseline}:${file}`], { encoding:'utf8' });
        await context.route(`**/${file}*`, r => r.fulfill({ body, contentType:file.endsWith('css')?'text/css':'text/javascript' }));
      }
      page = await context.newPage();
      page.on('pageerror', error => report.errors.push({width,before,error:error.message}));
      await page.goto(`${base}/#world`, { waitUntil:'domcontentloaded' });
      await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.gaia-feature-intro')).opacity === '1');
      await page.evaluate(() => document.fonts.ready);
      if (!before) await page.locator('.has-feature-art img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await page.waitForTimeout(300);
      const scan = await page.locator('.gaia-feature-intro').evaluate(panel => {
        const copy = panel.querySelector('.gaia-feature-card-copy > span');
        const scroll = panel.querySelector('.gaia-feature-scroll');
        return { rect:panel.getBoundingClientRect().toJSON(), title:panel.querySelector('h2').textContent,
          titleSize:parseFloat(getComputedStyle(panel.querySelector('h2')).fontSize), bodySize:parseFloat(getComputedStyle(copy).fontSize),
          bodyColor:getComputedStyle(copy).color, background:getComputedStyle(panel).backgroundImage, opacity:getComputedStyle(panel).opacity,
          images:[...panel.querySelectorAll('img')].map(image => ({src:image.getAttribute('src'),complete:image.complete,naturalWidth:image.naturalWidth,width:image.clientWidth,height:image.clientHeight,fit:getComputedStyle(image).objectFit})),
          overflow:scroll.scrollWidth-scroll.clientWidth, documentOverflow:document.documentElement.scrollWidth-innerWidth,
          controls:[...panel.querySelectorAll('button')].map(button => ({rect:button.getBoundingClientRect().toJSON(),hit:button.contains(document.elementFromPoint(button.getBoundingClientRect().x+button.clientWidth/2,button.getBoundingClientRect().y+button.clientHeight/2))})) };
      });
      scans.push(scan);
      assert.equal(scan.overflow,0); assert.equal(scan.documentOverflow,0);
      assert(scan.controls.every(c => c.hit && c.rect.width>=44 && c.rect.height>=44));
      if (!before) {
        assert.equal(scan.images.length,3); assert(scan.images.every(i => i.complete && i.naturalWidth===1536 && i.fit==='contain'));
        assert(scan.background.includes('242, 252, 255, 0.8')); assert.equal(scan.opacity,'1');
        assert.match(scan.title,/地球のふしぎ/); assert.equal(scan.bodyColor,'rgb(52, 79, 99)');
        assert(scan.rect.x>=0 && scan.rect.y>=0 && scan.rect.right<=width+1 && scan.rect.bottom<=height+1);
        assert(scan.bodySize>=15); if(width===3840) assert(scan.bodySize>=26);
      } else assert.equal(scan.images.length,0);
      await page.screenshot({ path:path.join(output,`${width}-${before?'before':'after'}.png`) });
      await context.close();
    }
    assert(scans[1].rect.width > scans[0].rect.width*1.2, 'Window is substantially larger');
    assert(scans[1].bodySize > scans[0].bodySize*1.2, 'Body text remains larger than the original dark introduction');
    report.checks.push({width,height,before:scans[0],after:scans[1]}); console.log(`PASS ${width}: larger, bright, illustrated and readable`);
  }
  assert.deepEqual(report.errors,[]); report.status='passed';
} catch(error) { report.status='failed'; report.failure=error.stack; process.exitCode=1; await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{}); }
finally { await browser.close(); fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify({status:report.status,failure:report.failure})); }
