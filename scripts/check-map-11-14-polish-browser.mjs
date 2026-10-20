import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const stage = process.env.GAIA_POLISH_STAGE || 'after';
const output = path.resolve(`artifacts/map-11-14-polish-20261020/${stage}`);
fs.mkdirSync(output, { recursive: true });
const manifest = JSON.parse(fs.readFileSync('data/runtime/gaia-manifest.json', 'utf8'));
const ids = ['rhythm-of-disaster', 'three-ecologies', 'earth-organ', 'population-tide'];
const data = Object.fromEntries(ids.map(id => [id, JSON.parse(fs.readFileSync(
  `data/runtime/${manifest.chunks.find(chunk => chunk.id === id).file}`, 'utf8')).signals]));
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  tree: 'uncommitted changes', stage, checks: [], errors: [],
  environment: 'Local installed Chrome, bundled data; external requests blocked. Mobile emulation, not physical device.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const width of (process.env.GAIA_POLISH_WIDTHS || '1920,390,320').split(',').map(Number)) {
    const height = width === 1920 ? 1080 : width === 320 ? 568 : 844;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, isMobile: width < 900,
      reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => localStorage.setItem('gaia-senseware-bgm-muted', 'true'));
    await context.route('https://**/*', route => route.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${process.env.GAIA_BASE_URL}/world#world-11`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true');
    for (let index = 0; index < ids.length; index++) {
      const number = index + 11, id = ids[index], s = data[id];
      if (process.env.GAIA_POLISH_NUMBERS && !process.env.GAIA_POLISH_NUMBERS.split(',').includes(String(number))) continue;
      await page.evaluate(index => GaiaMapObservationAdapter.selectMode(index + 5), index);
      await page.waitForFunction(number => Number(document.querySelector('#japan-mode-number').textContent) === number, number);
      await page.evaluate(() => GaiaMapPlayback.stop());
      await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning')
        && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro')
        && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1300);
      await page.screenshot({ path: path.join(output, `${width}-${number}-overview.png`) });
      if (number === 12) {
        if (width === 320 && !stage.startsWith('before')) assert.equal(await page.locator('#map-responsive-data').isVisible(), false);
        if (width < 900) await page.locator('.map-mobile-ecology-summary button').click();
        const panel = page.locator('#ecologies-exhibit');
        await panel.locator('.eco-country').selectOption('JPN');
        await page.waitForFunction(() => document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running'
          && document.querySelector('#ecologies-exhibit').dataset.selected === 'JPN');
        await page.waitForTimeout(800);
        const pairs = await panel.locator('.eco-country-card').allTextContents();
        assert.equal(pairs.length, 2);
        if (!stage.startsWith('before')) assert.equal(await panel.locator('.eco-metric-year').count(), 4);
        await page.screenshot({ path: path.join(output, `${width}-12-compare.png`) });
        await panel.locator('[data-eco-view="pattern"]').click();
        assert.equal(await panel.locator('.eco-regression').count(), 1);
        const dots = await panel.locator('.eco-scatter-point').count();
        assert(dots > 200);
        await panel.locator('[data-eco-country="CAN"]').press('Enter');
        await page.waitForFunction(() => document.querySelector('#ecologies-exhibit .eco-country').value === 'CAN');
        assert.equal(await panel.locator('.eco-country').inputValue(), 'CAN');
        await panel.locator('[data-eco-view="culture"]').click();
        await panel.locator('.eco-site').selectOption('1');
        assert(await panel.locator('.eco-site-card h3').textContent());
        assert.equal(await panel.locator('.eco-site option').count(), 24);
        await panel.locator('[data-eco-view="compare"]').click();
        const overflow = await panel.evaluate(el => el.scrollWidth - el.clientWidth);
        assert.equal(overflow, 0);
        report.checks.push({ number, width, pairs, dots, overflow });
        if (width < 900) await page.locator('[data-mobile-sheet-close]').click();
        continue;
      }
      const year = number === 11 ? await page.locator('#japan-overlay').getAttribute('data-earthquake-year') : 2016;
      const row = number === 11 ? s.globalEvents.find(row => row.occurredAt.startsWith(String(year)))
        : number === 13 ? s.current.find(row => row.iso3 === 'JPN')
        : s.population.find(row => row.iso3 === 'JPN' && Number(row.year) === Number(year));
      assert(row, `${number} saved row exists for ${year}`);
      const location = { lon: row.lon ?? row.longitude, lat: row.lat ?? row.latitude };
      if (number === 11) {
        // A user pan explicitly takes ownership from the earthquake flyover.
        // Stopping the timeline alone intentionally leaves the arrival camera.
        await page.mouse.move(width / 2, height * .5);
        await page.mouse.down();
        await page.mouse.move(width / 2 + 24, height * .5 + 15, { steps: 5 });
        await page.mouse.up();
      }
      await page.evaluate(location => GaiaMapObservationAdapter.focusEarthLocation({
        ...location, zoom: 1.8, targetX: .5, targetY: .4, durationMs: 0,
      }), location);
      await page.waitForFunction(() => document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
      await page.waitForTimeout(150);
      const point = await page.evaluate(row => {
        const rect = document.querySelector('#japan-map').getBoundingClientRect(), d = document.querySelector('#japan-overlay').dataset;
        const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(d.earthZoom);
        return { x: rect.left + rect.width / 2 + Number(d.earthOffsetX) + (((row.lon - Number(d.earthCenterLongitude) + 540) % 360) - 180) * scale,
          y: rect.top + rect.height / 2 + Number(d.earthOffsetY) - row.lat * scale };
      }, location);
      if (width < 900) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
      await page.locator('#japan-poi-card').waitFor({ state: 'visible' });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(output, `${width}-${number}-selected.png`) });
      const scan = await page.locator('#japan-poi-card').evaluate(card => ({
        text: card.innerText, box: card.getBoundingClientRect().toJSON(), facts: card.querySelectorAll('.japan-poi-metric-label').length,
        overflow: card.scrollWidth - card.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth,
        source: card.querySelector('#japan-poi-source').href, overlay: { ...document.querySelector('#japan-overlay').dataset },
      }));
      assert.equal(scan.overflow, 0); assert.equal(scan.pageOverflow, 0);
      assert(scan.box.top >= 0 && scan.box.left >= 0 && scan.box.right <= width && scan.box.bottom <= height);
      assert.match(scan.source, /^https:/);
      if (!stage.startsWith('before')) {
        assert(scan.facts > 0);
        assert.equal(scan.overlay.selectedReadingMode, id);
        if (number === 11) assert(scan.text.includes(`M${row.magnitude.toFixed(1)}`) && scan.text.includes('JST'));
        if (number === 13) assert(scan.text.includes(`${row.renewablePercent.toFixed(1)}%`) && scan.text.includes(String(row.year)));
        if (number === 14) assert(scan.text.includes(Number(row.population).toLocaleString('en-US')) && scan.text.includes('2016'));
      }
      report.checks.push({ number, width, ...scan });
      await page.locator('#japan-poi-close').click();
      await page.waitForFunction(() => document.querySelector('#japan-poi-card').hidden);
      if (width === 320 && number === 13) assert.equal(await page.locator('#map-responsive-data').isVisible(), true, 'Other exhibits retain the compact drawer');
      if (process.env.GAIA_POLISH_INTERACTIONS === '1') {
        const slider = page.locator('[data-signal-time]:visible').last();
        for (const endpoint of ['Home', 'End']) {
          await slider.press(endpoint);
          await page.waitForTimeout(1100);
          const state = await page.locator('#japan-overlay').evaluate(el => ({ ...el.dataset }));
          if (number === 11) {
            const years = s.globalEvents.map(row => Number(row.occurredAt.slice(0, 4)));
            assert.equal(Number(state.earthquakeYear), endpoint === 'Home' ? Math.min(...years) : Math.max(...years));
            assert.equal(state.earthquakeMarkerStyle, 'red-heavy-cross');
          } else if (number === 13) {
            const rows = s.current.slice().sort((a,b) => b.renewablePercent-a.renewablePercent);
            const row = endpoint === 'Home' ? rows[0] : rows.at(-1);
            assert.equal(state.renewableSelectedIso3, row.iso3);
            assert.equal(state.renewableSelectedPercent, row.renewablePercent.toFixed(1));
          } else {
            assert.equal(state.populationSelectedYear, endpoint === 'Home' ? '1960' : '2025');
            assert.equal(state.populationVisualStyle, 'porcelain-celadon');
            assert.equal(state.populationEncoding, 'circle-area-proportional-to-population');
            assert.equal(state.populationAreaReference, scan.overlay.populationAreaReference);
          }
          report.checks.push({ number, width, endpoint, overlay: state });
        }
      }
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure }));
}
