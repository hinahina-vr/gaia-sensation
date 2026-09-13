import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const output = path.resolve("artifacts/ecologies-interactive-debug");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: false });
const context = await browser.newContext({ viewport: null });
await context.addInitScript(() => {
  sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
  localStorage.setItem("gaia-senseware-bgm-muted", "true");
  const actions = [];
  globalThis.ecologiesDebugActions = actions;
  for (const type of ["click", "change", "keydown"]) document.addEventListener(type, event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#ecologies-exhibit, .map-mode-bank, #map-mobile-sheet, #map-mobile-toolbar")) return;
    actions.push({ at: performance.now(), type, target: target.tagName, className: target.getAttribute("class"),
      view: target.getAttribute("data-eco-view"), value: target.value, key: event.key, trusted: event.isTrusted });
    if (actions.length > 160) actions.shift();
  }, true);
});
const page = await context.newPage();
const report = { startedAt: new Date().toISOString(), errors: [], snapshots: [] };
let saving = false;
const capture = async reason => {
  if (saving || page.isClosed()) return;
  saving = true;
  try {
    const snapshot = await page.evaluate(() => ({
      at: performance.now(), visibility: document.visibilityState,
      title: document.querySelector("#japan-mode-title")?.textContent,
      number: document.querySelector("#japan-mode-number")?.textContent,
      state: globalThis.GaiaMapObservationAdapter?.getState(),
      panelHidden: document.querySelector("#ecologies-exhibit")?.hidden,
      selected: document.querySelector(".eco-country")?.value,
      card: document.querySelector("#ecologies-exhibit")?.dataset.selected,
      layer: document.querySelector("#japan-layer")?.className,
      overlay: { ...document.querySelector("#japan-overlay")?.dataset },
      actions: globalThis.ecologiesDebugActions,
    }));
    report.snapshots.push({ reason, ...snapshot });
    if (report.snapshots.length > 30) report.snapshots.shift();
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    if (reason !== "sample") {
      await page.screenshot({ path: path.join(output, `${reason}.png`) });
      console.log(reason, JSON.stringify({ number: snapshot.number, state: snapshot.state, selected: snapshot.selected, card: snapshot.card, panelHidden: snapshot.panelHidden }));
    }
  } finally { saving = false; }
};
page.on("pageerror", error => { report.errors.push({ at: new Date().toISOString(), stack: error.stack }); console.error(error.stack); void capture("page-error"); });
await page.goto("http://127.0.0.1:4447/?exhibit=12#world", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); });
const cdp = await context.newCDPSession(page);
const { windowId } = await cdp.send("Browser.getWindowForTarget");
await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
await page.bringToFront();
await capture("opened");
console.log("Interactive local MAP 12 is open. Only this page's ecologies controls and rendering state are recorded.");
const timer = setInterval(() => { void capture("sample"); }, 2000);
await new Promise(resolve => page.once("close", resolve));
clearInterval(timer);
await browser.close();
