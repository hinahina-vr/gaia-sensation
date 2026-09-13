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
const outputDir = path.resolve(outputArgument || "artifacts/sensor-privacy-auth");
fs.mkdirSync(outputDir, { recursive: true });
const qaMode = ["127.0.0.1", "localhost"].includes(new URL(baseUrl).hostname);

const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 568 },
];
const report = { status: "running", mode: qaMode ? "local-qa" : "production-smoke", scans: [], consoleErrors: [], expectedAuth401: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

try {
  for (const viewport of viewports) {
    if (qaMode) await fetch(new URL("/__qa/reset", baseUrl), { method: "POST" });
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addInitScript(() => sessionStorage.setItem("gaia:mode-entry-guide:sensor:v3", "seen"));
    const page = await context.newPage();
    const label = viewport.name;
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/Failed to load resource: the server responded with a status of 401\b/u.test(text)) report.expectedAuth401.push(`${label}: session probe`);
      else report.consoleErrors.push(`${label}: ${text}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`); });

    await page.goto(new URL("/sensors/", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view='login']").waitFor({ state: "visible" });
    const login = await page.evaluate(() => {
      const buttons = [document.querySelector("#google-login"), document.querySelector("#trial-login")];
      return {
        google: buttons[0]?.textContent.replace(/\s+/gu, " ").trim(),
        trial: buttons[1]?.textContent.replace(/\s+/gu, " ").trim(),
        buttonHeights: buttons.map((button) => button.getBoundingClientRect().height),
        infoButtonHeight: document.querySelector("#participation-info-open")?.getBoundingClientRect().height,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    assert.match(login.google, /Googleで続ける/u);
    assert.match(login.trial, /名前・メールなしでおためし/u);
    assert(login.buttonHeights.every((height) => height >= 44));
    assert(Math.round(login.infoButtonHeight) >= 42);
    assert.equal(login.overflowX, false);
    await page.locator("#participation-info-open").click();
    await page.locator("#participation-info").waitFor({ state: "visible" });
    const participation = await page.evaluate(() => ({
      text: document.querySelector("#participation-info")?.textContent.replace(/\s+/gu, " ").trim(),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.match(participation.text, /名前・メールは保存しません/u);
    assert.match(participation.text, /観測点は公開されます/u);
    assert.match(participation.text, /現在のプログラムを上書きします/u);
    await page.locator("#participation-info [data-participation-route][data-nav='terms']").click();
    await page.locator("#participation-info").waitFor({ state: "hidden", timeout: 2_000 });
    await page.locator("[data-view='terms']").waitFor({ state: "visible" });
    assert.equal(new URL(page.url()).hash, "#terms");
    await page.locator(".sensor-topbar [data-nav='devices']").click();
    await page.locator("[data-view='login']").waitFor({ state: "visible" });
    await page.locator("#participation-info-open").click();
    await page.locator("#participation-info").waitFor({ state: "visible" });
    await page.locator("#participation-info .sensor-dialog-actions button").click();
    await page.locator("#participation-info").waitFor({ state: "hidden" });
    assert.equal(participation.overflowX, false);
    await page.screenshot({ path: path.join(outputDir, `${label}-login.png`), fullPage: true });

    await page.locator("#trial-login").click();
    await page.locator("[data-view='devices']").waitFor({ state: "visible" });
    const trial = await page.evaluate(() => ({
      logoutVisible: !document.querySelector("#sensor-logout").hidden,
      logoutHeight: document.querySelector("#sensor-logout").getBoundingClientRect().height,
      profileHidden: document.querySelector("#profile-nav").hidden,
      note: document.querySelector("#sensor-account-note").textContent,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(trial.logoutVisible, true);
    assert(trial.logoutHeight >= 44);
    assert.equal(trial.profileHidden, true);
    assert.match(trial.note, /おためし利用中/u);
    assert.match(trial.note, /ログアウトすると/u);
    assert.equal(trial.overflowX, false);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-view='devices']").waitFor({ state: "visible" });
    assert.match(await page.locator("#sensor-account-note").textContent(), /おためし利用中/u);
    await page.screenshot({ path: path.join(outputDir, `${label}-trial.png`), fullPage: true });

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#sensor-logout").click();
    assert.equal(await page.locator("[data-view='devices']").isVisible(), true);
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#sensor-logout").click();
    await page.locator("[data-view='login']").waitFor({ state: "visible" });
    assert.equal(await page.locator("#sensor-logout").isHidden(), true);

    let google = { maintained: await page.locator("#google-login").isVisible() };
    let trialStarts = 1;
    let logouts = 1;
    if (qaMode) {
      await page.goto(new URL("/sensors/?authenticated=1#devices", baseUrl).href, { waitUntil: "domcontentloaded" });
      await page.locator("[data-view='devices']").waitFor({ state: "visible" });
      google = await page.evaluate(() => ({
        logoutVisible: !document.querySelector("#sensor-logout").hidden,
        profileVisible: !document.querySelector("#profile-nav").hidden,
        note: document.querySelector("#sensor-account-note").textContent,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      assert.equal(google.logoutVisible, true);
      assert.equal(google.profileVisible, true);
      assert.match(google.note, /Google連携中/u);
      assert.match(google.note, /名前・メールアドレスは保存していません/u);
      assert.equal(google.overflowX, false);
      await page.locator("#sensor-logout").click();
      await page.locator("[data-view='login']").waitFor({ state: "visible" });

      const qa = await (await fetch(new URL("/__qa/report", baseUrl))).json();
      trialStarts = qa.requests.filter(({ method, path: requestPath }) => method === "POST" && requestPath === "/api/auth/trial").length;
      logouts = qa.requests.filter(({ method, path: requestPath }) => method === "POST" && requestPath === "/api/web/v1/logout").length;
      assert.equal(trialStarts, 1);
      assert.equal(logouts, 2);
    } else {
      assert.equal(google.maintained, true);
    }
    report.scans.push({ viewport: label, login, participation, trial, google, trialStarts, logouts, passed: true });
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

console.log("sensor privacy auth browser check passed");
