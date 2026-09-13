import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [baseUrl = "http://127.0.0.1:4397", outputArgument = "artifacts/map-preview-copy"] = process.argv.slice(2);
const output = path.resolve(outputArgument);
const requestedWidths = process.argv[4]?.split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", previews: [], titles: [], bodies: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 3840, height: 2088 }, { width: 390, height: 844 }, { width: 320, height: 844 }]
    .filter(viewport => requestedWidths ? requestedWidths.includes(viewport.width) : viewport.width !== 320)) {
    const mobile = viewport.width < 720;
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: mobile ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({ contentType: "application/json", body: fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8") }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, (route) => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, () => ({ current: {
          time: "2026-09-05T00:00", wind_speed_10m: 5, wind_direction_10m: 80,
          surface_pressure: 1005, cloud_cover: 58, shortwave_radiation: 194,
          pm2_5: 9.9, aerosol_optical_depth: .18,
        } }));
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(count === 1 ? rows[0] : rows) });
      });
    }
    await context.route("https://earthquake.usgs.gov/**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({
      type: "FeatureCollection", metadata: { generated: Date.now() }, features: [{ type: "Feature", id: "copy-test", geometry: { type: "Point", coordinates: [140, 36, 10] }, properties: { mag: 3, time: Date.now(), place: "TEST" } }],
    }) }));
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.goto(`${baseUrl}/?preview=map-copy#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30);
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    const catalog = await page.evaluate(() => {
      const content = window.GaiaAppContent;
      const base = content.modes.map((mode) => ({ id: mode.id, number: mode.mapNumber, title: mode.titleJa }));
      const extra = [...GaiaLiveExhibits.definitions, ...GaiaEstatExhibits.definitions, GaiaFirmsExhibit.definition, ...GaiaPlanetSignals.definitions]
        .map((exhibit) => ({ id: exhibit.id, number: exhibit.number, title: exhibit.shortTitle }));
      return { entries: [...base, ...extra].map((entry) => ({ ...entry, copy: content.MAP_MODE_DESCRIPTIONS[entry.id], subtitle: content.MAP_TITLE_SUBTITLES[entry.number] })).sort((a, b) => a.number.localeCompare(b.number)), copyIds: Object.keys(content.MAP_MODE_DESCRIPTIONS) };
    });
    assert.equal(catalog.entries.length, 30);
    assert.deepEqual(catalog.copyIds.sort(), catalog.entries.map(({ id }) => id).sort(), "Copy keys must match the live exhibit catalog exactly");
    const approved = JSON.parse(fs.readFileSync("docs/design/map-editorial-20260907/copy.json", "utf8")).exhibits;
    for (const [index, entry] of catalog.entries.entries()) {
      assert.equal(entry.number, String(index + 1).padStart(2, "0"));
      assert.equal(entry.id, approved[index].id);
      assert.equal(entry.title, approved[index].title);
      assert.equal(entry.copy, approved[index].picker);
      assert.equal(entry.subtitle, approved[index].subtitle);
    }
    const initialTitle = await page.locator("#japan-title").textContent();

    // Featured exhibits (01–05) have their own visible selector; all selectors
    // open the same 30-exhibit bank and preview surface.
    const toggle = mobile
      ? page.getByRole("button", { name: "展示一覧", exact: true })
      : page.locator("[data-map-bank-toggle]:visible, .map-dock-bank-trigger:visible").first();
    await toggle.click();
    if (mobile) {
      await page.locator('#map-mobile-sheet[open] [data-mobile-exhibit="1"]').waitFor();
      for (const entry of catalog.entries) {
        const button = page.locator(`[data-mobile-exhibit="${Number(entry.number)}"]`);
        await button.scrollIntoViewIfNeeded();
        const scan = await button.evaluate(node => ({
          title: node.querySelector("b").textContent,
          subtitle: node.querySelector("small").textContent,
          overflow: node.scrollWidth - node.clientWidth,
          rect: node.getBoundingClientRect().toJSON(),
        }));
        report.previews.push({ width: viewport.width, number: entry.number, ...scan });
        assert.equal(scan.title, `${entry.number} ${entry.title}`, "Mobile titles must preserve punctuation and the full name");
        assert.equal(scan.subtitle, entry.subtitle);
        assert(scan.overflow <= 1 && scan.rect.left >= 0 && scan.rect.right <= viewport.width);
        if (["01", "21", "30"].includes(entry.number)) await page.screenshot({ path: path.join(output, `${viewport.width}-preview-${entry.number}.png`) });
      }
      await page.locator("[data-mobile-sheet-close]").click();
    } else {
    await page.waitForFunction(() => document.querySelector(".map-mode-bank .map-mode-button").checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
    for (const entry of catalog.entries) {
      const button = page.locator(".map-mode-bank .map-mode-button").filter({ hasText: new RegExp(`^${entry.number}$`) });
      if (mobile) {
        await page.keyboard.press("Tab");
        await button.focus();
      } else {
        await button.hover();
      }
      await page.waitForFunction((number) => document.querySelector("#map-mode-preview").classList.contains("is-open") && document.querySelector("#map-mode-preview-number").textContent.startsWith(`${number} /`), entry.number);
      await page.waitForTimeout(120);
      const scan = await page.locator("#map-mode-preview").evaluate((node) => ({
        title: node.querySelector("b").textContent,
        copy: node.querySelector("p").textContent,
        rect: node.getBoundingClientRect().toJSON(),
        overflow: node.scrollWidth - node.clientWidth,
        copyOverflow: node.querySelector("p").scrollHeight - node.querySelector("p").clientHeight,
        ariaHidden: node.getAttribute("aria-hidden"),
      }));
      report.previews.push({ width: viewport.width, number: entry.number, ...scan });
      assert.equal(scan.title, entry.title, `${entry.number}: preview title`);
      assert.equal(scan.copy, entry.copy, `${entry.number}: map-only description`);
      assert.equal(scan.ariaHidden, "false");
      assert.ok(scan.rect.left >= -1 && scan.rect.right <= viewport.width + 1, `${entry.number}: horizontal overflow`);
      assert.ok(scan.rect.top >= -1 && scan.rect.bottom <= viewport.height + 1, `${entry.number}: vertical overflow`);
      assert.ok(scan.overflow <= 1 && scan.copyOverflow <= 1, `${entry.number}: copy must not be clipped`);
      if (["01", "20", "30"].includes(entry.number)) {
        await page.screenshot({ path: path.join(output, `${viewport.width}-preview-${entry.number}.png`) });
      }
    }
    }

    // Previewing another map must not change the active title. Once selected,
    // the tooltip, upper heading, bank heading, and dock must all agree.
    assert.equal(await page.locator("#japan-title").textContent(), initialTitle);
    for (const entry of catalog.entries) {
      if (mobile) {
        await page.locator('[data-mobile-sheet="exhibits"]').click();
        await page.locator(`[data-mobile-exhibit="${Number(entry.number)}"]`).click();
      } else {
        await page.evaluate((number) => [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find((button) => button.textContent.trim() === number).click(), entry.number);
      }
      await page.waitForFunction((number) => document.querySelector("#japan-mode-number").textContent === number, entry.number);
      const scan = await page.evaluate(() => ({
        top: document.querySelector("#japan-title").textContent,
        dock: document.querySelector("[data-map-dock-title]").textContent,
        bank: document.querySelector("#japan-mode-title").textContent,
        subtitle: document.querySelector("#japan-description").textContent,
      }));
      report.titles.push({ width: viewport.width, number: entry.number, ...scan });
      for (const title of [scan.top, scan.dock, scan.bank]) assert.equal(title, entry.title, `${entry.number}: selected title must match its preview`);
      assert.equal(scan.subtitle, entry.subtitle, `${entry.number}: persistent subtitle must explain the exhibit's relevance`);
      const number = Number(entry.number);
      const captionSelector = number === 1 ? ".gaia-firms-copy > p" : number <= 5 ? "[data-planet-caption]"
        : number >= 21 ? "[data-estat-caption]" : number >= 15 ? "[data-live-exhibit-caption]" : null;
      let expectedBody = approved[number - 1].body;
      if (captionSelector) {
        const body = await page.evaluate(selector => {
          const node = document.querySelector(selector);
          const cityId = document.querySelector(".gaia-live-prefecture-picker select")?.value;
          return { text: node.textContent, city: GaiaLiveExhibits.observationPoints.find(city => city.id === cityId)?.city,
            sourceAction: Boolean(node.closest(".gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout")?.querySelector(".gaia-map-action--source")) };
        }, captionSelector);
        if (number >= 15 && number <= 20) expectedBody = expectedBody.replaceAll("東京", body.city);
        if (number >= 21) expectedBody += " 海の光と流れは抽象演出で、実測海流や人の移動経路ではありません。";
        assert.equal(body.text, expectedBody, `${entry.number}: rendered data explanation`);
        assert.equal(body.sourceAction, true, `${entry.number}: source access must remain available`);
        report.bodies.push({ width: viewport.width, number: entry.number, ...body });
      }
      if (mobile) {
        await page.locator('[data-mobile-sheet="reading"]').click();
        const reading = page.locator("#map-mobile-sheet .map-mobile-sheet-body");
        const text = await reading.innerText();
        assert(text.includes(entry.subtitle), `${entry.number}: relevance must remain readable after the separator`);
        if (captionSelector) assert(text.includes(expectedBody), `${entry.number}: mobile reading panel must show the data explanation`);
        const overflow = await reading.evaluate(node => node.scrollWidth - node.clientWidth);
        assert(overflow <= 1, `${entry.number}: mobile reading copy overflows`);
        if (["01", "13", "21", "25", "30"].includes(entry.number)) await page.screenshot({ path: path.join(output, `${viewport.width}-reading-${entry.number}.png`) });
        await page.locator("[data-mobile-sheet-close]").click();
      }
    }
    await context.close();
    console.log(`${viewport.width}px: 30 previews and 30 selected titles passed`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
