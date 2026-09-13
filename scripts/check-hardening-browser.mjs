import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";
const base = process.argv[2] || "http://127.0.0.1:4397";
const sensorBase = process.argv[3] || "http://127.0.0.1:4399";
const output = path.resolve(process.argv[4] || "artifacts/hardening/browser");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = { status: "running", checks: [], errors: [], apiScope: "AI responses and account UI use isolated mocks. Real account/permission behavior is tested separately with local D1/workerd." };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await enforceBrowserSecurity(context, base);
    await enforceBrowserSecurity(context, sensorBase);
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    let approve = true, prompts = [];
    page.on("dialog", async dialog => { prompts.push(dialog.message()); await (approve ? dialog.accept() : dialog.dismiss()); });
    const requests = [];
    let responseMode = "success", held;
    await context.route("https://*.qa.invalid/**", async route => {
      const request = route.request();
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
      requests.push({ url: request.url(), headers: request.headers(), body: request.postData() });
      if (responseMode === "hold") await new Promise(resolve => { held = resolve; });
      if (responseMode === "redirect") return route.fulfill({ status: 302, headers: { Location: "https://redirect.qa.invalid/steal", "Access-Control-Allow-Origin": "*" } });
      await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ choices: [{ message: { content: responseMode === "large" ? "a".repeat(2_000_001) : "<img src=x onerror=alert(1)> synthetic-key-do-not-use" } }] }) }).catch(() => {});
    });
    await page.goto(`${base}/concept/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      window.__ai = await import("/byok-ai.js?v=gaia-hardening-1");
      window.__ask = async endpoint => {
        try { return { answer: await __ai.requestAiAnswer({ requestUrl: endpoint, preset: { adapter: "openai" }, model: "fixture", apiKey: "synthetic-key-do-not-use", prompt: { system: "fixture", user: "public data only" } }) }; }
        catch (error) { return { error: error.message, name: error.name }; }
      };
    });
    approve = false;
    assert.match((await page.evaluate(() => __ask("https://first.qa.invalid/v1"))).error, /取り消し/);
    assert.equal(requests.length, 0);
    approve = true;
    const first = await page.evaluate(() => __ask("https://first.qa.invalid/v1"));
    assert(!first.answer.includes("synthetic-key-do-not-use"));
    assert(first.answer.includes("[非表示]"));
    const confirmedCount = prompts.length;
    await page.evaluate(() => __ask("https://first.qa.invalid/v2"));
    assert.equal(prompts.length, confirmedCount, "unchanged key/origin must not ask again");
    approve = false;
    const before = requests.length;
    await page.evaluate(() => __ask("https://second.qa.invalid/v1"));
    assert.equal(requests.length, before, "changed destination sent the old key without consent");
    approve = true;
    await page.evaluate(() => __ask("https://second.qa.invalid/v1"));
    assert(prompts.at(-1).includes("https://second.qa.invalid"));
    responseMode = "redirect";
    assert((await page.evaluate(() => __ask("https://second.qa.invalid/v1"))).error);
    assert(!requests.some(request => request.url.includes("redirect.qa.invalid")), "key followed a redirect");
    responseMode = "large";
    assert.match((await page.evaluate(() => __ask("https://second.qa.invalid/v1"))).error, /2MB/);
    responseMode = "hold";
    const pending = page.evaluate(() => __ask("https://second.qa.invalid/v1"));
    while (!held) await new Promise(resolve => setTimeout(resolve, 20));
    await page.evaluate(() => {
      localStorage.setItem("gaia-senseware-ai-key-v1", "synthetic-key-do-not-use");
      localStorage.setItem("gaia-senseware-ai-config-v1", "{}");
      localStorage.setItem("qa-story-save", "preserve");
      __ai.endAiSession();
    });
    const cancelled = await pending;
    responseMode = "success"; held();
    assert.equal(cancelled.name, "AbortError");
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem("gaia-senseware-ai-key-v1"), localStorage.getItem("gaia-senseware-ai-config-v1"), localStorage.getItem("qa-story-save")]), [null, null, "preserve"]);
    assert(requests.every(request => !request.headers.cookie && !request.headers.referer && !request.body.includes("synthetic-key-do-not-use")));
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push(`${width}px: native origin consent, refusal blocks network, origin binding, redaction, redirect rejection, 2MB limit, abort and shared-session cleanup`);

    await fetch(`${sensorBase}/__qa/reset`, { method: "POST" });
    await page.goto(`${sensorBase}/sensors/?authenticated=1#profile`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-view=profile]").waitFor({ state: "visible" });
    const details = page.locator(".sensor-account-delete"); await details.locator("summary").click();
    const form = page.locator("#sensor-account-delete-form");
    await form.locator("input").fill("NO");
    await form.locator("button").click();
    const countDeletes = async () => (await (await fetch(`${sensorBase}/__qa/report`)).json()).requests.filter(request => request.path === "/api/web/v1/account").length;
    assert.equal(await countDeletes(), 0);
    await form.locator("input").fill("削除");
    approve = false; await form.locator("button").click();
    assert.equal(await countDeletes(), 0);
    await page.screenshot({ path: path.join(output, `${width}-account-delete.png`), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    approve = true; await form.locator("button").click();
    await page.locator("[data-view=login]").waitFor({ state: "visible" });
    assert.equal(await countDeletes(), 1);
    assert.equal(await page.locator("#sensor-logout").isVisible(), false);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push(`${width}px: deletion UI validates typed confirmation, cancellation, one DELETE request, then unauthenticated view (mock API)`);
    await page.goto(`${base}/?mode=21#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaDataLedger && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(() => {
      GaiaDataLedger.create().updateMode({ id: "qa", titleJa: "<img src=x onerror=alert(1)>", act: { number: 1, title: "QA", en: "QA" }, datasets: [{ id: "qa", title: "<script>bad()</script>", organisation: "QA", url: "javascript:alert(1)", termsUrl: "data:text/html,bad" }] }, 1, "2026-09-07T00:00:00Z");
    });
    assert.equal(await page.locator(".data-ledger-card a").count(), 0, "external metadata became an executable URL");
    assert.equal(await page.locator(".data-ledger-card script, #data-ledger-mode-title img").count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await page.evaluate(() => { const script = document.createElement("script"); script.textContent = "window.qaInlineExecuted = true"; document.body.append(script); });
    assert.equal(await page.evaluate(() => Boolean(window.qaInlineExecuted)), false);
    report.checks.push(`${width}px: untrusted dataset labels stay text, javascript/data links are rejected, CSP blocks unapproved inline execution`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report, null, 2));
