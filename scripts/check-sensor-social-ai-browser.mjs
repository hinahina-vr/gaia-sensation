import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4397"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(path.resolve(playwrightEntry)).href);
const outputDir = path.resolve(outputArgument || "artifacts/sensor-social-ai");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-first-run", "--disable-background-networking"] });
const report = { status: "running", viewports: [], consoleErrors: [], pageErrors: [] };
const testKey = "qa_secret_should_never_reach_gaia";

try {
  for (const viewport of [{ name: "pc-1440", width: 1440, height: 900 }, { name: "mobile-390", width: 390, height: 844 }]) {
    await fetch(new URL("/__qa/reset", baseUrl), { method: "POST" });
    await fetch(new URL("/api/auth/trial", baseUrl), { method: "POST" });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on("dialog", dialog => dialog.accept());
    const aiRequests = [];
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    await page.route("https://ai-qa.example/**", async (route) => {
      const request = route.request();
      const cors = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
      aiRequests.push({ method: request.method(), headers: request.headers(), body: request.postData() || "" });
      return route.fulfill({
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify({ choices: [{ message: { content: "観測データは安定しています。実測期間を延ばして確認してください。" } }] }),
      });
    });

    const socialLoaded = page.waitForResponse((response) => response.url().endsWith("/api/web/v1/social") && response.ok(), { timeout: 60_000 });
    await page.goto(new URL("/sensors/?authenticated=1#map", baseUrl).href, { waitUntil: "domcontentloaded" });
    await socialLoaded;
    await page.locator(".sensor-map-marker[data-sensor-id='sensor_browserqa']").waitFor({ state: "visible" });
    await page.locator(".sensor-map-marker[data-sensor-id='sensor_browserqa']").dispatchEvent("click");
    await page.locator("#public-sensor-detail").waitFor({ state: "visible" });
    await page.waitForTimeout(700);
    const expand = page.locator(".sensor-map-card-expand");
    if (viewport.width <= 760 && await expand.isVisible()) await expand.click();

    const like = page.locator("#public-sensor-detail [data-relationship='like']");
    await like.waitFor({ state: "visible" });
    assert.equal(await page.locator("#public-sensor-detail [data-relationship='favorite']").count(), 0);
    assert.equal(await page.locator("[data-public-filter='FAVORITE']").count(), 0);
    assert.doesNotMatch(await page.locator("#public-sensor-detail").textContent(), /お気に入り/u);
    assert.equal(await like.locator("svg[aria-hidden='true'] path").count(), 1);
    assert.equal(await like.locator("svg").evaluate(icon => getComputedStyle(icon).fill), "none");
    const likeResponse = page.waitForResponse((response) => response.url().endsWith("/like") && response.ok(), { timeout: 30_000 });
    await like.dispatchEvent("click");
    await likeResponse;
    await page.waitForFunction(() => document.querySelector("#public-sensor-detail [data-relationship='like']")?.getAttribute("aria-pressed") === "true");
    assert.equal(await like.getAttribute("aria-pressed"), "true");
    assert.equal(await like.locator("svg[aria-hidden='true'] path").count(), 1);
    assert.notEqual(await like.locator("svg").evaluate(icon => getComputedStyle(icon).fill), "none");
    assert.match(await like.getAttribute("aria-label"), /応援を取り消す（現在1件）/u);
    const relationshipLayout = await page.locator("#public-sensor-detail .sensor-relationship-bar").evaluate((bar) => {
      const heart = bar.querySelector(".sensor-like-trigger").getBoundingClientRect();
      const analyze = bar.querySelector(".sensor-analyze-trigger").getBoundingClientRect();
      return {
        controls: bar.querySelectorAll("button").length,
        heartWidth: heart.width,
        heartHeight: heart.height,
        heartRadius: getComputedStyle(bar.querySelector(".sensor-like-trigger")).borderRadius,
        analyzeWidth: analyze.width,
      };
    });
    assert.equal(relationshipLayout.controls, 2);
    assert(relationshipLayout.heartWidth >= 44 && relationshipLayout.heartHeight >= 44, `heart target is too small: ${JSON.stringify(relationshipLayout)}`);
    assert(Math.abs(relationshipLayout.heartWidth - relationshipLayout.heartHeight) < .5, `heart target is not square: ${JSON.stringify(relationshipLayout)}`);
    assert.equal(relationshipLayout.heartRadius, "50%");
    assert(relationshipLayout.analyzeWidth > relationshipLayout.heartWidth * 2, `analysis action lacks visual priority: ${JSON.stringify(relationshipLayout)}`);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-detail.png`), fullPage: false });

    await page.locator("#public-sensor-detail .sensor-analyze-trigger").dispatchEvent("click");
    await page.waitForTimeout(100);
    if (await page.locator("#sensor-analysis-dialog").isHidden()) {
      throw new Error(`analysis dialog did not open: ${JSON.stringify({ pageErrors: report.pageErrors, consoleErrors: report.consoleErrors })}`);
    }
    await page.locator("#sensor-analysis-dialog").waitFor({ state: "visible" });
    assert.match(await page.locator("#sensor-analysis-target").textContent(), /ベランダ環境センサー/u);
    assert((await page.locator("#sensor-analysis-stats article").count()) >= 3);
    assert.match(await page.locator("#sensor-analysis-summary").textContent(), /12件/u);
    const layout = await page.evaluate(() => {
      const dialog = document.querySelector("#sensor-analysis-dialog");
      const close = document.querySelector("#sensor-analysis-close").getBoundingClientRect();
      return {
        dialogWidth: dialog.getBoundingClientRect().width,
        viewportWidth: innerWidth,
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        closeWidth: close.width,
        closeHeight: close.height,
      };
    });
    assert(layout.dialogWidth <= layout.viewportWidth, `analysis dialog overflows: ${JSON.stringify(layout)}`);
    assert(layout.documentOverflow <= 1, `document overflows horizontally: ${JSON.stringify(layout)}`);
    assert(layout.closeWidth >= 44 && layout.closeHeight >= 44, `close target is too small: ${JSON.stringify(layout)}`);

    const providerValues = await page.locator("#sensor-ai-provider option").evaluateAll((options) => options.map((option) => option.value));
    assert.deepEqual(providerValues, [
      "openrouter", "openai", "xai", "gemini", "anthropic", "mistral", "groq", "deepseek",
      "together", "fireworks", "cerebras", "perplexity", "cohere", "custom",
    ]);
    for (const provider of providerValues.filter((value) => value !== "custom")) {
      await page.locator("#sensor-ai-provider").selectOption(provider);
      assert.match(await page.locator("#sensor-ai-endpoint").inputValue(), /^https:\/\//u);
      assert((await page.locator("#sensor-ai-model").inputValue()).length > 0);
    }
    await page.locator("#sensor-ai-provider").selectOption("custom");
    await page.locator("#sensor-ai-endpoint").fill("https://ai-qa.example/v1/chat/completions");
    await page.locator("#sensor-ai-model").fill("qa-model");
    await page.locator("#sensor-ai-key").fill(testKey);
    await page.locator("#sensor-ai-form textarea[name='question']").fill("目立つ変化を教えて");
    await page.locator("#sensor-ai-form button[type='submit']").click();
    await page.locator("#sensor-ai-answer[data-state='complete']").waitFor({ state: "visible" });
    assert.match(await page.locator("#sensor-ai-answer").textContent(), /安定しています/u);
    assert.equal(aiRequests.length, 1);
    assert.equal(aiRequests[0].headers.authorization, `Bearer ${testKey}`);
    assert.equal(aiRequests[0].headers.cookie, undefined);
    assert.equal(aiRequests[0].headers.referer, undefined);
    assert.match(aiRequests[0].body, /ベランダ環境センサー/u);
    assert.match(aiRequests[0].body, /目立つ変化/u);
    const firstStorage = await page.evaluate(() => ({
      local: localStorage.getItem("gaia-senseware-ai-key-v1"),
      session: sessionStorage.getItem("gaia-senseware-ai-session-key-v1"),
    }));
    assert.equal(firstStorage.local, null);
    assert.equal(firstStorage.session, testKey);

    await page.locator("#sensor-ai-form input[name='rememberKey']").check();
    await page.locator("#sensor-ai-form button[type='submit']").click();
    await page.waitForFunction(() => localStorage.getItem("gaia-senseware-ai-key-v1") !== null);
    const remembered = await page.evaluate(() => ({
      local: localStorage.getItem("gaia-senseware-ai-key-v1"),
      session: sessionStorage.getItem("gaia-senseware-ai-session-key-v1"),
    }));
    assert.equal(remembered.local, testKey);
    assert.equal(remembered.session, null);
    await page.locator("#sensor-ai-clear-key").click();
    assert.deepEqual(await page.evaluate(() => ({
      local: localStorage.getItem("gaia-senseware-ai-key-v1"),
      session: sessionStorage.getItem("gaia-senseware-ai-session-key-v1"),
    })), { local: null, session: null });

    const qaReport = await (await fetch(new URL("/__qa/report", baseUrl))).json();
    assert(qaReport.requests.some((request) => request.method === "PUT" && request.path.endsWith("/like")));
    assert.equal(qaReport.requests.some((request) => request.path.endsWith("/favorite")), false);
    assert(qaReport.requests.every((request) => request.authorizationPresent === false && request.apiKeyPresent === false));
    assert.equal(JSON.stringify(qaReport).includes(testKey), false);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`), fullPage: false });
    report.viewports.push({ ...viewport, analysisCards: await page.locator("#sensor-analysis-stats article").count(), aiRequests: aiRequests.length });
    await context.close();
  }
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.pageErrors, []);
  report.status = "passed";
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
