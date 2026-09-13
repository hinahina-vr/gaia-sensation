import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const base = process.argv[2] || "http://127.0.0.1:4397";
const report = { status: "running", environment: "Local Chrome UI, synthetic clock and browser offline state; no provider polling", checks: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  await page.clock.install({ time: new Date("2026-09-07T03:00:00Z") });
  // Same local origin, isolated from the map's animation/network workload.
  await page.goto(`${base}/realtime-exhibits.css`);
  await page.evaluate(async () => {
    const { createRealtimeStatus, updateRealtimeStatus } = await import("./src/exploration/realtime-exhibit-status.js");
    const status = createRealtimeStatus();
    document.body.replaceChildren(status);
    globalThis.refreshFixture = () => updateRealtimeStatus(status, { sourceState: "LIVE", observedAt: new Date(Date.now()).toISOString(), source: "Test public feed" });
    refreshFixture();
  });
  const state = () => page.locator(".gaia-realtime-status").getAttribute("data-realtime-state");
  const badge = page.locator(".gaia-broadcast-badge");
  assert.equal(await state(), "live");
  assert.equal(await badge.innerText(), "LIVE");
  await page.clock.fastForward(25 * 3600_000);
  assert.equal(await state(), "delayed", "A visible installation must not keep yesterday's LIVE badge");
  assert.equal(await badge.getAttribute("data-broadcast-state"), "delayed");
  report.checks.push("Visible 25-hour age transition updates both status and badge");
  await page.evaluate(() => {
    refreshFixture();
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(25 * 3600_000);
  assert.equal(await state(), "live", "Hidden tabs should not keep rewriting UI");
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  assert.equal(await state(), "delayed", "Returning to the tab must immediately re-evaluate freshness");
  report.checks.push("Hidden tab suspends updates and refreshes immediately on return");
  await page.evaluate(() => refreshFixture());
  await page.context().setOffline(true);
  await page.clock.runFor(32);
  assert.equal(await state(), "offline");
  assert.equal(await badge.innerText(), "接続停止");
  await page.context().setOffline(false);
  await page.clock.runFor(32);
  assert.equal(await state(), "live");
  assert.equal(await badge.innerText(), "LIVE");
  report.checks.push("Real browser offline/online events update the Japanese badge");
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack; process.exitCode = 1;
} finally {
  await browser.close();
  const output = path.resolve(process.argv[3] || "artifacts/realtime-status");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
