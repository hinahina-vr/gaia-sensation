import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const stage = process.env.GAIA_QUAKE_STAGE || 'after';
const output = path.resolve(`artifacts/quake-first-view-20261020/${stage}`);
fs.mkdirSync(output, { recursive: true });
const generated = Date.parse('2026-10-20T03:00:00Z');
const locations = [
  [143.2,39.1,6.1,28,'三陸沖',.5], [139.8,35.3,2.1,15,'関東南部',18],
  [130.1,30.2,3.2,40,'九州南方',6], [126.9,1.6,4.9,54,'モルッカ海',3],
  [-176.4,-22.1,5.3,71,'トンガ南方',12], [-71.7,-30.2,4.4,42,'チリ中部',8],
  [-149.8,61.3,1.1,36,'アラスカ南部',22], [96.1,3.2,4.6,67,'スマトラ北部',4],
  [-122.1,37.2,.8,8,'California',2], [-117.1,33.8,1.6,6,'California',15],
  [152.3,-5.2,5.1,23,'New Britain',20], [169.1,-18.3,3.9,48,'Vanuatu',1],
];
const feature = ([lon,lat,mag,depth,place,hours], index) => ({
  type: 'Feature', id: `test-quake-${index}`,
  properties: { mag, place, time: generated - hours * 3600000 },
  geometry: { type: 'Point', coordinates: [lon,lat,depth] },
});
const report = {
  baseCommit: execFileSync('git', ['rev-parse','HEAD'], { encoding: 'utf8' }).trim(),
  tree: 'uncommitted changes', stage,
  environment: 'Local headless Chrome; mobile/touch emulation. Synthetic deterministic USGS fixture, not live observations. Animation phases may differ.',
  checks: [], errors: [],
};
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const sizes = [[1920,1080], [390,844], ...(stage === 'before' ? [] : [[320,568,'reduce'], [1440,900,'dense'], [390,844,'offline']])];
  for (const [width,height,variant] of sizes) {
    const context = await browser.newContext({ viewport: { width,height }, hasTouch: width < 900,
      isMobile: width < 900, reducedMotion: variant === 'reduce' ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('gaia-senseware-bgm-muted','true'));
    let quakeRequests = 0;
    let phase = 'entry';
    const requests = [];
    const events = variant === 'dense' ? Array.from({ length: 1000 }, (_, i) =>
      feature([-179+(i*137.508)%358, -70+(i*23.1)%140, .5+(i%58)/10, 20, `Test station ${i}`, i%24],i))
      : locations.map(feature);
    await context.route('https://**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'earthquake.usgs.gov') {
        quakeRequests++;
        requests.push({ phase,url: url.href });
        return variant === 'offline' ? route.abort() : route.fulfill({ json: { type: 'FeatureCollection', metadata: { generated }, features: events } });
      }
      if (url.hostname.includes('open-meteo.com')) {
        const points = (url.searchParams.get('latitude') || '0').split(',');
        return route.fulfill({ json: points.map(() => ({ current: { time: '2026-10-20T03:00',
          wind_speed_10m: 7, wind_direction_10m: 270, surface_pressure: 1012, cloud_cover: 42,
          shortwave_radiation: 320, pm2_5: 12, aerosol_optical_depth: .15 } })) });
      }
      return route.abort();
    });
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push({ width, variant, message: e.message }));
    await page.goto(`${process.env.GAIA_BASE_URL}/world#world`, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
    await page.waitForFunction(() => globalThis.GaiaPlanetSignals);
    await page.evaluate(() => GaiaPlanetSignals.select(GaiaPlanetSignals.definitions.findIndex(d => d.renderer === 'quake')));
    await page.waitForFunction(() => GaiaPlanetSignals.getState().id === 'usgs-earthquake-ripples' && GaiaPlanetSignals.getState().pointCount > 0);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-feature-start]')[width < 900 ? 'tap' : 'click']();
    await page.waitForFunction(() => document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    await page.waitForTimeout(1200);
    const band = await page.locator('.map-title-transition').evaluate(el => getComputedStyle(el,'::before').height);
    await page.screenshot({ path: path.join(output,`${width}-${variant || 'normal'}-title.png`) });
    await page.waitForFunction(() => document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
    assert.equal(await page.locator('.map-title-transition').evaluate(el => getComputedStyle(el,'::before').height), band);
    await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-data-intro'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output,`${width}-${variant || 'normal'}-overview.png`) });
    const overview = await page.locator('#gaia-planet-signals-canvas').evaluate(el => ({ ...el.dataset }));
    phase = 'interaction';
    const requestsBeforeSelection = quakeRequests;
    const target = await page.evaluate(() => {
      const rect = document.querySelector('#japan-map').getBoundingClientRect();
      const overlay = document.querySelector('#japan-overlay');
      const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(overlay.dataset.earthZoom || 1);
      const originX = (rect.width - 360 * scale) / 2 + Number(overlay.dataset.earthOffsetX || 0);
      const originY = (rect.height - 180 * scale) / 2 + Number(overlay.dataset.earthOffsetY || 0);
      return GaiaPlanetSignals.getCruisePoints().map((p,index) => ({ ...p,index,
        x: rect.left+originX+((p.lon-150+540)%360)*scale, y:rect.top+originY+(90-p.lat)*scale }))
        .filter(p => p.x > innerWidth*.25 && p.x < innerWidth*.7 && p.y > innerHeight*.3 && p.y < innerHeight*.6)
        .sort((a,b) => b.magnitude-a.magnitude)[0];
    });
    assert(target, 'Visible epicenter available');
    if (width < 900) await page.touchscreen.tap(target.x,target.y);
    else await page.mouse.click(target.x,target.y);
    await page.waitForFunction(() => GaiaMapObservationAdapter.getPoiInteraction().selected);
    const selectedIndex = await page.evaluate(() => GaiaMapObservationAdapter.getPoiInteraction().selected.index);
    const chosen = await page.evaluate(index => GaiaPlanetSignals.getCruisePoints()[index], selectedIndex);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output,`${width}-${variant || 'normal'}-selected.png`) });
    const state = await page.evaluate(() => ({
      canvas: { ...document.querySelector('#gaia-planet-signals-canvas').dataset },
      card: document.querySelector('#japan-poi-card').innerText,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    }));
    assert.equal(state.horizontalOverflow,0);
    assert(state.card.includes(`M${chosen.magnitude.toFixed(1)}`));
    if (stage !== 'before') {
      assert.equal(context.pages().length,1,'A map tap must not click through to the newly opened source link');
      assert.equal(variant === 'offline' ? 'SAVED VALUES' : 'LIVE', state.canvas.planetSourceState);
      assert.equal(state.canvas.planetPoiFocusState,'selected');
      assert.equal(Number(state.canvas.planetFocusedPoiIndex),selectedIndex);
      assert(state.card.includes('発生時刻'));
      assert.equal(state.canvas.planetQuakeStyle,'magnitude-recency');
      assert.equal(state.canvas.planetQuakeMotion, variant === 'reduce' ? 'static' : 'ripple');
      assert.equal(state.canvas.planetWindCue,'none');
      assert.equal(overview.planetQuakeVisible > 0,true);
      if (variant === 'dense') {
        assert.equal(Number(overview.planetPointCount),1000);
        assert(Number(overview.planetQuakeRings) <= Number(overview.planetQuakeVisible), 'Dense scene limits rings to one per visible epicenter');
      }
      const time = await page.locator('#japan-poi-card .japan-poi-observed-time').textContent();
      const date = new Date(chosen.time);
      assert(time.includes(new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)), 'Card shows event time, not feed timestamp');
      if (width === 1920) {
        for (const language of ['en','zh-CN','ja']) {
          await page.evaluate(language => GaiaI18n.set(language),language);
          await page.waitForTimeout(150);
          assert.equal(await page.locator('.japan-poi-time-label').textContent(),language==='en'?'Occurred at':language==='zh-CN'?'发生时间':'発生時刻');
        }
      }
    }
    await page.locator('#japan-poi-close').click();
    await page.mouse.move(0,0);
    if (stage !== 'before') await page.waitForFunction(() => document.querySelector('#gaia-planet-signals-canvas').dataset.planetPoiFocusState === 'none');
    // Exercise the original maximum-epicenter shortcut, including the mobile sheet.
    if (width > 900) await page.locator('[data-planet-epicenter]').click();
    else {
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.getByRole('button',{ name: '最大の震源へ', exact: true }).last().click();
    }
    await page.waitForFunction(() => document.querySelector('#gaia-planet-signals-canvas').dataset.planetFocusedEpicenter);
    await page.waitForTimeout(1000);
    const maxFocus = await page.locator('#gaia-planet-signals-canvas').evaluate(el => ({ ...el.dataset }));
    const strongest = await page.evaluate(() => GaiaPlanetSignals.getCruisePoints().reduce((a,b)=>b.magnitude>a.magnitude?b:a));
    assert.equal(maxFocus.planetFocusedEpicenter,strongest.id);
    if (stage !== 'before') assert.equal(maxFocus.planetPoiFocusState,'epicenter');
    await page.screenshot({ path: path.join(output,`${width}-${variant || 'normal'}-maximum.png`) });
    if (stage !== 'before') {
      assert.equal(quakeRequests,requestsBeforeSelection,`No new requests while selecting/focusing: ${JSON.stringify(requests)}`);
      if (variant === 'reduce') {
        const pixels = await page.locator('#gaia-planet-signals-canvas').evaluate(el => el.toDataURL());
        await page.waitForTimeout(350);
        assert.equal(await page.locator('#gaia-planet-signals-canvas').evaluate(el => el.toDataURL()),pixels,'Reduced motion renders static quake rings');
      }
      // Existing 01 field stays available and receives no quake decoration.
      await page.evaluate(() => GaiaPlanetSignals.select(0));
      await page.waitForFunction(() => document.querySelector('.gaia-planet-atmosphere-canvas').dataset.fieldState === 'ready');
      await page.waitForTimeout(350);
      assert.equal(await page.locator('#gaia-planet-signals-canvas').getAttribute('data-planet-quake-style'),'none');
      await page.evaluate(() => GaiaPlanetSignals.select(GaiaPlanetSignals.definitions.findIndex(d => d.renderer === 'quake')));
      await page.waitForFunction(() => document.querySelector('#gaia-planet-signals-canvas').dataset.planetQuakeStyle === 'magnitude-recency');
      if (variant !== 'offline') assert.equal(quakeRequests,requestsBeforeSelection,'Cached return reuses the same feed');
      assert.equal(await page.locator('#japan-poi-card').isVisible(),false);
      // A deliberate source-link press remains usable after the guard.
      if (width === 390 && !variant) {
        await page.waitForFunction(() => document.querySelector('#gaia-planet-signals-canvas').dataset.planetArrivalPhase === 'settled');
        await page.touchscreen.tap(target.x,target.y);
        await page.locator('#japan-poi-source').waitFor({state:'visible'});
        const opened = context.waitForEvent('page');
        await page.locator('#japan-poi-source').tap();
        const popup = await opened;
        await popup.waitForLoadState('domcontentloaded');
        assert(popup.url().includes('earthquake.usgs.gov/earthquakes/eventpage/'));
        await popup.close();
      }
    }
    report.checks.push({ width,height,variant:variant || 'normal',band,overview,target,chosen,...state,maxFocus,quakeRequests,requests });
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
  report.status='passed';
} catch(error) {
  report.status='failed'; report.failure=error.stack; process.exitCode=1;
  await page?.screenshot({ path:path.join(output,'failure.png') }).catch(()=>{});
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors,failure:report.failure,output}));
}
