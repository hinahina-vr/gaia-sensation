import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [baseUrl = "http://127.0.0.1:4397", outputArgument = "artifacts/estat-picker"] = process.argv.slice(2);
const output = path.resolve(outputArgument);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", cases: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 3840, height: 2088 }, { width: 768, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const compact = viewport.width <= 900;
    const context = await browser.newContext({ viewport, isMobile: compact, hasTouch: compact, reducedMotion: compact ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", (route) => route.fulfill({ contentType: "application/json", body: fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8") }));
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.goto(`${baseUrl}/?preview=estat-picker#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".map-mode-bank .map-mode-button").length === 30, null, { timeout: 30_000 });
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    await page.waitForFunction(() => document.querySelector("#japan-layer").getAttribute("aria-hidden") === "false");
    await page.waitForTimeout(1600);
    const selectFromCode = async (number) => {
      await page.evaluate((number) => [...document.querySelectorAll(".map-mode-bank .map-mode-button")].find((button) => button.textContent.trim() === number).click(), number);
      await page.waitForFunction((number) => document.querySelector("#japan-mode-number").textContent === number, number);
    };
    const titleButton = page.locator(".gaia-estat-selector-toggle");
    const picker = page.locator(compact ? ".map-mode-bank" : ".map-dock-bank-popover");
    const clickTitle = () => compact ? titleButton.tap() : titleButton.click();
    await selectFromCode("23");
    assert.equal(await page.locator(".gaia-estat-chapter > p").count(), 0, "English overline must be removed");
    assert.equal(await titleButton.locator("strong").textContent(), "光の貯金");
    await clickTitle();
    await page.waitForFunction(() => document.querySelector(".gaia-estat-selector-toggle").getAttribute("aria-expanded") === "true");
    await page.waitForTimeout(320);
    const bounds = await picker.boundingBox();
    assert.ok(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, `Picker fits ${viewport.width}: ${JSON.stringify(bounds)}`);
    await page.screenshot({ path: path.join(output, `${viewport.width}-23-picker.png`) });
    await clickTitle();
    assert.equal(await titleButton.getAttribute("aria-expanded"), "false", "Clicking the title again must close, not reopen");
    await page.keyboard.press("Tab");
    await titleButton.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    assert.equal(await titleButton.getAttribute("aria-expanded"), "false");
    assert.equal(await titleButton.evaluate((node) => node === document.activeElement), true, "Escape restores focus to the visible title");
    assert.equal(await page.locator("#japan-layer").getAttribute("aria-hidden"), "false", "Escape must not leave the map");

    const targets = ["16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "01", "10", "26", "27", "28", "29", "30"];
    for (const number of targets) {
      await selectFromCode("23");
      await clickTitle();
      const choice = page.locator(".map-mode-bank .map-mode-button").filter({ hasText: new RegExp(`^${number}$`) });
      if (compact) await choice.tap();
      else await choice.click();
      await page.waitForFunction((number) => document.querySelector("#japan-mode-number").textContent === number, number);
      await page.waitForFunction(() => document.querySelector(".gaia-estat-selector-toggle").getAttribute("aria-expanded") === "false");
      report.cases.push({ width: viewport.width, from: "23", selected: number, title: await page.locator("#japan-title").textContent() });
    }
    // Every statistics title is also an opener, not only the reported MAP 23.
    for (let number = 16; number <= 25; number++) {
      await selectFromCode(String(number));
      await clickTitle();
      assert.equal(await titleButton.getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Escape");
    }
    await selectFromCode("23");
    await page.locator('[data-estat-step="1"]').click();
    await page.waitForFunction(() => document.querySelector("#japan-mode-number").textContent === "24");
    await page.locator('[data-estat-step="-1"]').click();
    await page.waitForFunction(() => document.querySelector("#japan-mode-number").textContent === "23");
    await page.screenshot({ path: path.join(output, `${viewport.width}-23-closed.png`) });
    await context.close();
    console.log(`${viewport.width}px: title toggle, keyboard, 17 list destinations, 10 openers, and arrows passed`);
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
