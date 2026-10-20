import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const stage = process.env.GAIA_POLISH_STAGE || 'after';
const output = path.resolve(`artifacts/map-06-10-polish-20261020/${stage}`);
fs.mkdirSync(output, { recursive: true });
const manifest = JSON.parse(fs.readFileSync('data/runtime/gaia-manifest.json', 'utf8'));
const definitions = [
  ['06', 'breathing-earth', 0], ['07', 'blue-circulation', 1],
  ['08', 'forest-cloud-engine', 2], ['09', 'nothing-is-waste', 3],
  ['10', 'anthropocene-scar', 4],
];
const data = Object.fromEntries(definitions.map(([, id]) => [id, JSON.parse(fs.readFileSync(
  `data/runtime/${manifest.chunks.find(chunk => chunk.id === id).file}`, 'utf8')).signals]));
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: 'uncommitted changes', stage, environment: 'Local Chrome; bundled snapshots; external requests blocked. Mobile emulation, not a physical phone.',
  checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height] of [[1920, 1080], [390, 844], ...(stage === 'before' ? [] : [[320, 568]])]
    .filter(([w]) => !process.env.GAIA_POLISH_WIDTH || w === Number(process.env.GAIA_POLISH_WIDTH))) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900,
      isMobile: width < 900, reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('gaia-senseware-bgm-muted', 'true'));
    await context.route('https://**/*', route => route.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${process.env.GAIA_BASE_URL}/world#world-06`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true');
    for (const [number, id, index] of definitions) {
      if (process.env.GAIA_POLISH_NUMBERS && !process.env.GAIA_POLISH_NUMBERS.split(',').includes(number)) continue;
      if (index) await page.evaluate(index => GaiaMapObservationAdapter.selectMode(index), index);
      await page.waitForFunction(number => document.querySelector('#japan-mode-number').textContent === number, number);
      await page.evaluate(() => GaiaMapPlayback.stop());
      await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')
        && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro')
        && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1400);
      const s = data[id];
      const row = number === '06' ? { lon: 135, lat: 30 }
        : number === '07' ? s.currents.find(row => row.lon > 125 && row.lon < 145 && row.lat > 20 && row.lat < 35)
        : number === '08' ? s.precipitation.find(row => row.id === 'japan') || s.precipitation[0]
        : number === '09' ? s.countryWaste.find(row => row.iso3 === 'JPN')
        : s.emissions.find(row => row.iso3 === 'JPN' && row.year === 2016);
      assert(row, `${number}: saved observation exists`);
      await page.screenshot({ path: path.join(output, `${width}-${number}-overview.png`) });
      await page.evaluate(row => GaiaMapObservationAdapter.focusEarthLocation({
        lon: row.lon, lat: row.lat, zoom: 1.8, targetX: .5, targetY: .4, durationMs: 0,
      }), row);
      // durationMs:0 is the runtime's default animation, not an instant jump.
      // Wait for its completion before projecting a clickable point.
      await page.waitForFunction(() => document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
      await page.waitForTimeout(100);
      const point = await page.evaluate(row => {
        const rect = document.querySelector('#japan-map').getBoundingClientRect(), d = document.querySelector('#japan-overlay').dataset;
        const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(d.earthZoom);
        return { x: rect.left + rect.width / 2 + Number(d.earthOffsetX) + (((row.lon - Number(d.earthCenterLongitude) + 540) % 360) - 180) * scale,
          y: rect.top + rect.height / 2 + Number(d.earthOffsetY) - row.lat * scale };
      }, row);
      if (width < 900) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
      await page.locator('#japan-poi-card').waitFor({ state: 'visible' });
      if (number === '10') await page.waitForFunction(() => document.querySelector('#japan-poi-history').dataset.state === 'ready');
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(output, `${width}-${number}-selected.png`) });
      const scan = await page.locator('#japan-poi-card').evaluate(card => ({
        text: card.innerText, box: card.getBoundingClientRect().toJSON(),
        source: card.querySelector('#japan-poi-source').href,
        facts: card.querySelectorAll('.japan-poi-metric-label').length,
        overflow: card.scrollWidth - card.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth,
        overlay: { ...document.querySelector('#japan-overlay').dataset },
      }));
      assert.equal(scan.overflow, 0); assert.equal(scan.pageOverflow, 0);
      assert(scan.box.left >= 0 && scan.box.right <= width && scan.box.top >= 0 && scan.box.bottom <= height);
      assert.match(scan.source, /^https:/);
      if (stage !== 'before') {
        assert(scan.facts > 0, `${number}: structured measurement`);
        assert.equal(scan.overlay.selectedReadingMode, id);
        if (number === '07') assert.match(scan.text, /m\/s/);
        if (number === '08') assert.match(scan.text, /NASA POWER/);
        if (number === '09') assert.match(scan.text, /報告年/);
        if (number === '10') assert.match(scan.text, /2016/);
      }
      report.checks.push({ number, width, height, point, ...scan });
      await page.locator('#japan-poi-close').click();
      await page.waitForFunction(() => document.querySelector('#japan-poi-card').hidden);
      if (process.env.GAIA_POLISH_INTERACTIONS === '1') {
        const clickPoint = async () => {
          if (width < 900) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
          await page.locator('#japan-poi-card').waitFor({state:'visible'});
        };
        const seek = async position => {
          // Country selectors use integer indices, whereas time sliders use
          // percentages. Exercise the native control, not the generic adapter.
          await page.locator('[data-signal-time]:visible').last().press(position === 100 ? 'End' : 'Home');
          await page.waitForTimeout(250);
        };
        if (number === '06') {
          for (const [position, kind] of [[0,'DERIVED'],[100,'SCENARIO']]) {
            await seek(position); await clickPoint();
            assert((await page.locator('#japan-poi-card').innerText()).includes(kind));
            await page.locator('#japan-poi-close').click();
          }
        }
        if (number === '07') {
          await seek(100); await clickPoint();
          const values = await page.locator('.japan-poi-metrics strong').allTextContents();
          assert.equal(values[3],'14.0 日');
          assert.equal(values[2],`${(Math.hypot(row.uMs,row.vMs)*14*86.4).toFixed(1)} km`);
          await page.screenshot({path:path.join(output,`${width}-07-fourteen-days.png`)});
          await page.locator('#japan-poi-close').click();
        }
        if (number === '09') {
          await seek(100);
          assert.equal(await page.locator('#japan-overlay').getAttribute('data-recycling-selected-index'),String(s.countryWaste.length-1));
          await seek(0);
          assert.equal(await page.locator('#japan-overlay').getAttribute('data-recycling-selected-index'),'0');
        }
        if (number === '10') {
          await seek(0); await clickPoint();
          await page.waitForFunction(()=>document.querySelector('#japan-poi-history').dataset.state==='ready');
          assert.match(await page.locator('#japan-poi-card').innerText(),/1945/);
          assert.match(await page.locator('#japan-poi-card').innerText(),/2016/);
          await page.locator('#japan-poi-close').click();
          // Real held pointer, not a call into the peel implementation.
          await page.mouse.move(point.x,point.y); await page.mouse.down();
          await page.waitForTimeout(800); await page.mouse.up();
          await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.nightLightsLayer==='dimmed');
          await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.nightLightsLayer==='visible',{},{timeout:9000});
        }
        // Shared card/source path must remain keyboard-accessible in every mode.
        await clickPoint();
        for (const language of ['en','zh-CN','ja']) {
          await page.evaluate(language=>GaiaI18n.set(language),language);
          await page.waitForTimeout(150);
          assert.equal(await page.locator('#japan-poi-card').evaluate(n=>n.scrollWidth-n.clientWidth),0);
          const translated=await page.locator('#japan-poi-card').innerText();
          const labels = {
            '06':['Reference date','对应时间','対象時点'],
            '07':['Flow direction','流动方向','流れる向き'],
            '08':['Averaging period','统计期间','集計期間'],
            '09':['Reporting year','报告年份','報告年'],
            '10':['Emissions year','排放年份','排出年'],
          };
          assert(translated.includes(labels[number][['en','zh-CN','ja'].indexOf(language)]),`${number}: translated card label ${language}`);
        }
        const popup = context.waitForEvent('page');
        await page.locator('#japan-poi-source').focus();
        await page.keyboard.press('Enter');
        const sourcePage = await popup; await sourcePage.close();
        await page.bringToFront();
        await page.locator('#japan-poi-close').click();
        await page.waitForFunction(()=>!document.querySelector('#japan-overlay').dataset.selectedReadingMode);
        const start = await page.evaluate(()=>GaiaMapObservationAdapter.getState().signalTimePosition);
        // Playback intent belongs to the shared transport; a provider-only
        // start is correctly cancelled when that transport is stopped.
        await page.evaluate(()=>GaiaMapPlayback.start());
        await page.waitForFunction(start=>GaiaMapObservationAdapter.getState().signalTimePosition!==start,start,{timeout:9000});
        const next = await page.evaluate(()=>GaiaMapObservationAdapter.getState().signalTimePosition);
        assert.notEqual(next,start,`${number}: playback advances after closing the card`);
        await page.evaluate(()=>GaiaMapPlayback.stop());
        report.checks.at(-1).interactions = 'timeline endpoints, language/overflow, source activation, selection reset, playback';
      }
      console.log(`PASS ${width}/${number}: actual point tap, source, card geometry, close`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  report.lastState = await page?.evaluate(()=>({app:globalThis.GaiaMapObservationAdapter?.getState(),hidden:document.hidden,
    playback:globalThis.GaiaMapObservationAdapter?.getPlaybackState(),overlay:{...document.querySelector('#japan-overlay')?.dataset}})).catch(()=>null);
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
