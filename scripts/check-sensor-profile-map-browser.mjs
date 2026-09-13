import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/sensor-profile-map");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 568 },
];
const report = { status: "running", viewports, scans: [], consoleErrors: [], expectedAuth401: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });
const png = fs.readFileSync(path.resolve("gaia-mode-01.png"));

try {
  for (const viewport of viewports) {
    await fetch(new URL("/__qa/reset", baseUrl), { method: "POST" });
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript(() => sessionStorage.setItem("gaia:mode-entry-guide:sensor:v3", "seen"));
    const page = await context.newPage();
    const label = viewport.name;
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (text === "Failed to load resource: the server responded with a status of 401 (Unauthorized)") report.expectedAuth401.push(`${label}: session probe`);
      else report.consoleErrors.push(`${label}: ${text}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });

    await page.goto(new URL("/sensors/#map", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view='map']").waitFor({ state: "visible" });
    await page.locator(".sensor-map-marker[data-sensor-id='sensor_browserqa']").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("#public-sensor-map")?.dataset.basemap === "ready");
    await page.waitForFunction(() => {
      const image = document.querySelector("#public-sensor-detail img");
      return Boolean(image?.complete && image.naturalWidth > 0);
    });
    const publicMap = await page.evaluate(() => {
      const marker = document.querySelector(".sensor-map-marker[data-sensor-id='sensor_browserqa']");
      const detail = document.querySelector("#public-sensor-detail");
      const links = [...detail.querySelectorAll("a")].map((link) => ({ text: link.textContent, href: link.href }));
      return {
        markerLabel: marker?.getAttribute("aria-label"),
        owner: detail.querySelector(".sensor-map-owner small")?.textContent,
        sensor: detail.querySelector("h2")?.textContent,
        links,
        avatarLoaded: Boolean(detail.querySelector("img")?.complete && detail.querySelector("img")?.naturalWidth),
        mapCanvasReady: Boolean(document.querySelector("#public-sensor-map .sensor-map-canvas")?.width > 100),
        inlineMapSvgCount: document.querySelectorAll("#public-sensor-map > svg").length,
        markerTouchTarget: Math.min(marker?.getBoundingClientRect().width ?? 0, marker?.getBoundingClientRect().height ?? 0),
        visibleText: document.body.innerText,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.match(publicMap.markerLabel, /^(?:青猫センサーさんのベランダ環境センサー、ONLINE|\d+件の観測点。選択するとこの位置を拡大します。)$/u);
    assert.equal(publicMap.owner, "青猫センサー");
    assert.equal(publicMap.sensor, "ベランダ環境センサー");
    assert.deepEqual(publicMap.links, []);
    assert.equal(publicMap.avatarLoaded, true);
    assert.equal(publicMap.mapCanvasReady, true);
    assert.equal(publicMap.inlineMapSvgCount, 1);
    assert(Math.round(publicMap.markerTouchTarget) >= 44, `${label}: marker touch target is ${publicMap.markerTouchTarget}px`);
    assert.equal(publicMap.overflowX, false);
    assert.doesNotMatch(publicMap.visibleText, /user_browser_qa|@example|owner_user_id/iu);
    await page.screenshot({ path: path.join(outputDir, `${label}-public-map.png`), fullPage: true });

    await page.goto(new URL("/sensors/?authenticated=1#profile", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view='profile']").waitFor({ state: "visible" });
    assert.equal(await page.locator("#profile-form input[name='displayName']").inputValue(), "青猫センサー");
    await page.locator("#profile-form input[name='displayName']").fill("青猫観測所");
    // Do not leave made-up account links in a shared local preview after QA.
    for (const field of ["xUrl", "githubUrl", "instagramUrl"]) {
      assert.equal(await page.locator(`#profile-form input[name='${field}']`).inputValue(), "");
      await page.locator(`#profile-form input[name='${field}']`).fill("");
    }
    await page.locator("#profile-form button[type='submit']").click();
    await page.waitForFunction(() => document.querySelector("#sensor-status")?.textContent === "プロフィールを保存しました。");
    await page.locator("#profile-avatar-input").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
    await page.waitForFunction(() => document.querySelector("#sensor-status")?.textContent === "アイコンを保存しました。");
    await page.locator("#profile-avatar-preview img").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(outputDir, `${label}-profile.png`), fullPage: true });

    await page.locator("[data-nav='map']").click();
    await page.waitForFunction(() => !document.querySelector("[data-view='map']")?.hidden && location.hash === "#map");
    await page.waitForFunction(() => document.querySelector("#public-sensor-detail .sensor-map-owner small")?.textContent === "青猫観測所");
    assert.equal(await page.locator("#public-sensor-detail h2").textContent(), "ベランダ環境センサー");

    await page.locator(".sensor-topbar [data-nav='devices']").click();
    await page.locator("[data-view='devices']").waitFor({ state: "visible" });
    await page.locator("[data-action='show-add']").click();
    assert.equal(await page.locator("#device-form input[name='measurementKeys']:checked").count(), 3);
    await page.locator("#device-form .sensor-measurement-editor > summary").click();
    await page.locator("#device-form [data-measurement-category='water'] > summary").click();
    await page.locator("#device-form input[name='measurementKeys'][value='water_temperature']").check();
    await page.locator("#device-form input[name='measurementKeys'][value='ph']").check();
    await page.locator("#device-form input[name='measurementKeys'][value='turbidity']").check();
    await page.locator("#device-form input[name='name']").fill("校庭ESP32");
    await page.locator("#device-form select[name='countryCode']").selectOption("JP");
    await page.waitForFunction(() => document.querySelector("#device-form [data-location-picker]")?.dataset.mapView === "JP");
    assert.equal(await page.locator("#device-form [data-location-picker] [data-map-basis]").textContent(), "BASEMAP / NATURAL EARTH / JP");
    await page.screenshot({ path: path.join(outputDir, `${label}-japan-zoom.png`), fullPage: true });
    await page.waitForFunction(() => !document.querySelector("#device-form select[name='subdivisionCode']")?.disabled);
    await page.locator("#device-form select[name='subdivisionCode']").selectOption("JP-13");
    await page.waitForFunction(() => !document.querySelector("#device-form select[name='municipalityCode']")?.disabled);
    assert.match(await page.locator("#device-form [data-location-output]").textContent(), /都道府県庁所在地 35\.68944, 139\.69167/u);
    await page.locator("#device-form select[name='municipalityCode']").selectOption("131130");
    await page.waitForFunction(() => document.querySelector("#device-form [data-location-picker]")?.dataset.regionPlot === "ready");
    assert.match(await page.locator("#device-form [data-location-output]").textContent(), /本庁所在地 35\.70000, 139\.70000/u);
    assert.equal(await page.locator("#device-form input[name='isPublic']").inputValue(), "true");
    const picker = page.locator("#device-form [data-location-picker]");
    const box = await picker.boundingBox();
    assert(box);
    assert.equal(await picker.getAttribute("role"), "group");
    assert(await picker.getAttribute("aria-describedby"));
    await picker.click({ position: { x: box.width * 0.58, y: box.height * 0.5 } });
    const beforeKeyboard = Number(await page.locator("#device-form input[name='publicLongitude']").inputValue());
    await picker.focus();
    await page.keyboard.press("ArrowRight");
    assert(Math.abs(Number(await page.locator("#device-form input[name='publicLongitude']").inputValue()) - Math.min(180, beforeKeyboard + .01)) < 1e-9);
    const picked = await page.evaluate(() => ({
      latitude: document.querySelector("#device-form input[name='publicLatitude']")?.value,
      longitude: document.querySelector("#device-form input[name='publicLongitude']")?.value,
    }));
    assert.notEqual(picked.latitude, "");
    assert.notEqual(picked.longitude, "");
    assert(Number(picked.latitude) >= 20 && Number(picked.latitude) <= 48);
    assert(Number(picked.longitude) >= 122 && Number(picked.longitude) <= 154);
    await page.locator("#device-form input[name='acceptTerms']").check();
    await page.locator("#device-form input[name='firmwareReady']").check();
    await page.locator("#device-form button[type='submit']").click();
    await page.locator("#sensor-pairing-panel").waitFor({ state: "visible" });
    const qa = await (await fetch(new URL("/__qa/report", baseUrl))).json();
    assert.equal(qa.avatarUploaded, true);
    assert.equal(qa.profile.displayName, "青猫観測所");
    for (const field of ["xUrl", "githubUrl", "instagramUrl"]) assert.equal(qa.profile[field], null);
    assert.equal(qa.lastPairingDraft.name, "校庭ESP32");
    assert.equal(qa.lastPairingDraft.subdivisionCode, "JP-13");
    assert.equal(qa.lastPairingDraft.municipalityCode, "131130");
    assert.equal(qa.lastPairingDraft.isPublic, true);
    assert.equal(qa.lastPairingDraft.publicLatitude, Number(picked.latitude));
    assert.equal(qa.lastPairingDraft.publicLongitude, Number(picked.longitude));
    assert.deepEqual(qa.lastPairingDraft.measurementKeys, ["temperature", "humidity", "pm25", "water_temperature", "ph", "turbidity"]);
    await page.locator("#pairing-complete").click();
    await page.locator(".sensor-device-card button").click();
    await page.locator("[data-view='detail']").waitFor({ state: "visible" });
    assert.equal(await page.locator("#location-form input[name='measurementKeys']:checked").count(), 6);
    await page.waitForFunction(() => document.querySelector("#location-form select[name='subdivisionCode']")?.value === "JP-13");
    assert.equal(await page.locator("#location-form select[name='municipalityCode']").inputValue(), "131130");
    await page.locator("#location-form select[name='subdivisionCode']").selectOption("JP-14");
    await page.waitForFunction(() => !document.querySelector("#location-form select[name='municipalityCode']")?.disabled);
    assert.equal(await page.locator("#location-form select[name='municipalityCode'] option[value='131130']").count(), 0);
    await page.locator("#location-form select[name='municipalityCode']").selectOption("142085");
    await page.waitForFunction(() => document.querySelector("#location-form [data-location-picker]")?.dataset.regionPlot === "ready");
    assert.match(await page.locator("#location-form [data-location-output]").textContent(), /本庁所在地 35\.30000, 139\.60000/u);
    await page.locator("#location-form button[type='submit']").click();
    await page.waitForFunction(() => document.querySelector("#sensor-status")?.textContent === "計測項目・地域・公開位置を更新しました。");
    const edited = await (await fetch(new URL("/__qa/report", baseUrl))).json();
    assert.equal(edited.lastDeviceDraft.subdivisionCode, "JP-14");
    assert.equal(edited.lastDeviceDraft.municipalityCode, "142085");
    assert.equal(edited.lastDeviceDraft.admin1Code, null);
    assert.equal(edited.lastDeviceDraft.localityName, null);
    assert.match(await page.locator("#detail-location").textContent(), /神奈川県.*JP-14.*逗子市.*142085/u);

    await page.locator("#location-form select[name='subdivisionCode']").selectOption("JP-47");
    await page.waitForFunction(() => document.querySelector("#location-form [data-location-picker]")?.dataset.regionPlot === "ready");
    assert.match(await page.locator("#location-form [data-location-output]").textContent(), /都道府県庁所在地 26\.21240, 127\.68090/u);
    await page.locator("#location-form button[type='submit']").click();
    await page.waitForFunction(() => document.querySelector("#sensor-status")?.textContent === "計測項目・地域・公開位置を更新しました。");
    const okinawa = await (await fetch(new URL("/__qa/report", baseUrl))).json();
    assert.equal(okinawa.lastDeviceDraft.subdivisionCode, "JP-47");
    assert.equal(okinawa.lastDeviceDraft.municipalityCode, null);
    assert.equal(okinawa.lastDeviceDraft.publicLatitude, 26.2124);
    assert.equal(okinawa.lastDeviceDraft.publicLongitude, 127.6809);
    await page.locator("[data-nav='map']").click();
    await page.locator("[data-view='map']").waitFor({ state: "visible" });
    const updatedMarker = page.locator(".sensor-map-marker[data-sensor-id='sensor_browserqa']");
    assert.equal(await updatedMarker.getAttribute("data-latitude"), "26.2124");
    assert.equal(await updatedMarker.getAttribute("data-longitude"), "127.6809");
    const mapEditButton = page.locator(".sensor-public-location-action button");
    if (!(await mapEditButton.isVisible())) await page.locator(".sensor-map-card-expand").click();
    await mapEditButton.click();
    await page.locator("#public-map-location-editor").waitFor({ state: "visible" });
    assert.equal(await page.locator("#public-sensor-map").getAttribute("data-location-editing"), "true");
    const publicMapBox = await page.locator("#public-sensor-map").boundingBox();
    assert(publicMapBox);
    // Choose exposed map pixels; fixed screen fractions can hit the editor's
    // cancel button after a responsive layout change.
    const mapPoint = await page.locator("#public-sensor-map").evaluate(map => {
      const r = map.getBoundingClientRect();
      for (const yRatio of [.25, .4, .6, .15, .8]) for (const xRatio of [.2, .4, .6, .8]) {
        const x = r.x + r.width * xRatio, y = r.y + r.height * yRatio;
        const hit = document.elementFromPoint(x, y);
        if (map.contains(hit) && !hit.closest('button,a,.sensor-map-location-editor,.sensor-belonging,.sensor-map-lead,.sensor-page-head')) return { x, y };
      }
      return null;
    });
    assert(mapPoint, 'no exposed map pixels for public POI editing');
    await page.mouse.click(mapPoint.x, mapPoint.y);
    const editedCoordinates = (await page.locator("#public-map-location-output").textContent()).split(",").map((value) => Number(value.trim()));
    assert(editedCoordinates.every(Number.isFinite));
    await page.locator("#public-map-location-save").click();
    await page.waitForFunction(() => document.querySelector("#sensor-status")?.textContent === "公開POIを更新しました。");
    const mapEdited = await (await fetch(new URL("/__qa/report", baseUrl))).json();
    assert.equal(mapEdited.lastDeviceDraft.publicLatitude, editedCoordinates[0]);
    assert.equal(mapEdited.lastDeviceDraft.publicLongitude, editedCoordinates[1]);
    assert.equal(await page.locator("#public-map-location-editor").isVisible(), false);
    await page.screenshot({ path: path.join(outputDir, `${label}-device-detail.png`), fullPage: true });
    report.scans.push({ viewport: label, publicMap: { ...publicMap, visibleText: undefined }, picked, profile: qa.profile, editedRegion: edited.lastDeviceDraft, okinawaRegion: okinawa.lastDeviceDraft, mapEdited: mapEdited.lastDeviceDraft, passed: true });
    await context.close();
  }
  assert.equal(report.expectedAuth401.length, viewports.length);
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.responses404, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log("sensor profile and public map browser check passed");
