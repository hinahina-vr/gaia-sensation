import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { statisticsAiQuestions } from "../statistics-ai.js";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/statistics-ai");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = { status: "running", checks: [], errors: [] };
const testKey = "qa-statistics-only-not-a-real-key";
const endpoint = "https://ai-qa.example/v1/chat/completions";
const fixture = {
  id: "qa-ai", modeId: "estat-prefecture", title: "観測データ QA", unit: "ppm", defaultMethod: "summary", xLabel: "時点", yLabel: "CO₂", provenance: ["SOURCE", "IMPUTED"], secret: "never-send-private-field",
  rows: [
    { id: "a1", label: "Alpha 1", x: 1, y: 410, value: 410, provenance: "SOURCE", privateToken: "never-send-private-field" },
    { id: "a2", label: "Alpha 2", x: 2, y: 420, value: 420, provenance: "SOURCE" },
    { id: "b1", label: "Beta", x: 3, y: 430, value: 430, provenance: "SOURCE" },
    { id: "a3", label: "Alpha imputed", x: 4, y: 440, value: 440, provenance: "IMPUTED" },
  ],
};
let page;
try {
  const requestedWidths = process.argv[4]?.split(",").map(Number);
  for (const [width, height] of [[3840, 2088], [2176, 1072], [1440, 900], [768, 844], [390, 844], [320, 844], [812, 390]].filter(([width]) => !requestedWidths || requestedWidths.includes(width))) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 901, reducedMotion: width === 320 ? "reduce" : "no-preference" });
    await enforceBrowserSecurity(context, base);
    await context.addInitScript(({ endpoint, testKey }) => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      localStorage.setItem("gaia-senseware-ai-config-v1", JSON.stringify({ provider: "custom", endpoint, model: "qa-model" }));
      sessionStorage.setItem("gaia-senseware-ai-session-key-v1", testKey);
    }, { endpoint, testKey });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    const requests = [];
    let reply = "success";
    let release;
    await context.route("https://ai-qa.example/**", async route => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
      requests.push({ body: route.request().postDataJSON(), headers: route.request().headers() });
      if (reply === "delay") await new Promise(resolve => { release = resolve; });
      const status = reply === "error" ? 401 : 200;
      const body = status === 401 ? { error: { message: "QA authentication error" } } : { choices: [{ message: { content: reply === "xss" ? '<img src=x onerror="window.qaXss=true">' : reply === "long" ? "数値的根拠：平均は415 ppmです。\n限界：観測数が少ないため、期間を延ばして確認してください。\n\n".repeat(48) : "平均は415 ppmです。観測数が少ないため、期間を延ばして確認してください。" } }] };
      await route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) }).catch(() => {});
    });
    page = await context.newPage();
    page.on("dialog", dialog => dialog.accept());
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("request", request => {
      if (new URL(request.url()).origin === new URL(base).origin) {
        assert(!JSON.stringify(request.headers()).includes(testKey), "API key reached GAIA headers");
        assert(!(request.postData() || "").includes(testKey), "API key reached GAIA body");
      }
    });
    await page.goto(`${base}/?preview=statistics-ai#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaStatisticsLab && globalThis.GaiaMapDemo);
    await page.evaluate(() => { GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false }); });
    const settle = () => page.waitForFunction(() => ["解析済み", "条件不足"].includes(document.querySelector("#gaia-statistics-status").textContent));
    await page.evaluate(data => globalThis.GaiaStatisticsLab.open({ dataset: data }), fixture);
    await settle();
    await page.locator("#gaia-statistics-menu-toggle").click();
    await page.locator('[data-analysis-group="descriptive"]').click();
    await page.locator('[data-method="summary"]').click();
    await settle();
    const trigger = page.locator("#gaia-statistics-ai-open");
    assert.equal(await trigger.textContent(), "AIで分析する");
    const triggerBox = await trigger.boundingBox();
    assert(triggerBox.height >= 44 && triggerBox.x >= 0 && triggerBox.x + triggerBox.width <= width, `AI entry outside viewport: ${JSON.stringify(triggerBox)}`);
    await page.screenshot({ path: path.join(output, `${width}-button.jpg`), type: "jpeg", quality: 90 });
    await page.locator("#gaia-statistics-menu-toggle").click();
    await page.locator(".gaia-statistics-data-options > summary").click();
    await page.locator("#gaia-statistics-record-filter").fill("Alpha");
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab.getState().recordQuery === "Alpha");
    await settle();
    await page.locator("#gaia-statistics-menu-close").click();
    await trigger.click();
    const dialog = page.locator("#gaia-statistics-ai-dialog");
    const form = dialog.locator("form");
    const field = name => form.locator(`[name="${name}"]`);
    const answer = dialog.locator("[data-ai-answer]");
    const submit = form.locator('[type="submit"]');
    await dialog.waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.activeElement.id), "gaia-statistics-ai-title", "Opening jumped to an input / could open the mobile keyboard");
    assert.equal(await dialog.evaluate(node => node.scrollTop), 0);
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    const presentation = await dialog.evaluate(node => {
      const style = getComputedStyle(node);
      const backdrop = getComputedStyle(node, "::backdrop");
      return { animation: style.animationName, duration: style.animationDuration, backdropAnimation: backdrop.animationName, backdrop: backdrop.backgroundColor, blur: backdrop.backdropFilter };
    });
    assert.equal(presentation.animation, width === 320 ? "none" : "gaia-ai-dialog-enter");
    assert.equal(presentation.backdropAnimation, width === 320 ? "none" : "gaia-ai-backdrop-enter");
    if (width !== 320) assert.equal(presentation.duration, "0.22s");
    assert.equal(presentation.backdrop, "rgba(2, 11, 16, 0.24)");
    assert.equal(presentation.blur, "blur(1px)");
    // Let the short entrance finish before checking the stable bounds.
    await dialog.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
    const openingBox = await dialog.boundingBox();
    const margin = height <= 600 ? 24 : width <= 720 ? 48 : 64;
    assert(openingBox.y >= margin - 1 && openingBox.y + openingBox.height <= height - margin + 1, "Dialog lost the surrounding observation context");
    assert(openingBox.width <= Math.min(2800, width - (width <= 720 ? 16 : 48)) + 1);
    assert(openingBox.width >= Math.min(2800, width - (width <= 720 ? 16 : 48)) - 2, "Use the available display width instead of a narrow legacy dialog");
    await dialog.locator(".gaia-statistics-ai-companions").evaluate(img => img.decode());
    assert.equal(await page.locator("#gaia-statistics-lab").isVisible(), true);
    await dialog.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: path.join(output, `${width}-opening.jpg`), type: "jpeg", quality: 90 });
    await page.keyboard.press("Tab");
    assert.equal(await dialog.locator("[data-ai-close]").evaluate(node => node === document.activeElement), true, "Close is not the first keyboard control");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, "Keyboard focus escaped the dialog");
    assert.equal(requests.length, 0, "Opening a dialog sent data without submit");
    assert.equal(await field("apiKey").inputValue(), testKey, "Existing sensor key not restored");
    assert.equal(await field("endpoint").inputValue(), endpoint);
    assert.equal(await field("rememberKey").isChecked(), false);
    assert.equal(await field("provider").locator("option").count(), 14);
    const prompts = dialog.locator("[data-ai-prompt]");
    assert.equal(await prompts.count(), 6);
    for (const preset of statisticsAiQuestions) {
      const option = dialog.locator(`[data-ai-prompt="${preset.id}"]`);
      await option.click();
      assert.equal(await field("question").inputValue(), preset.question);
      assert.equal(await option.getAttribute("aria-pressed"), "true");
      assert.equal(await dialog.locator('[data-ai-prompt][aria-pressed="true"]').count(), 1);
      const box = await option.boundingBox();
      assert(box.height >= 44 && box.x >= 0 && box.x + box.width <= width);
    }
    await field("question").fill("この観測値の限界を教えてください。");
    assert.equal(await dialog.locator('[data-ai-prompt][aria-pressed="true"]').count(), 0);
    await prompts.first().focus();
    await page.keyboard.press("Space");
    assert.equal(await field("question").inputValue(), statisticsAiQuestions[0].question);
    assert.equal(requests.length, 0, "Choosing/editing a question sent data without submit");
    const privacy = dialog.locator("#gaia-statistics-ai-privacy");
    assert.match(await privacy.textContent(), /ブラウザだけ/);
    assert.match(await privacy.textContent(), /GAIAのサーバーには保管・中継しません/);
    assert.match(await privacy.textContent(), /AIサービスへ直接送信/);
    assert.match(await dialog.locator(".gaia-statistics-ai-remember").textContent(), /暗号化されません/);
    await field("provider").selectOption("openrouter");
    assert.equal(await dialog.locator(".gaia-statistics-ai-endpoint").getAttribute("open"), null);
    await field("provider").selectOption("custom");
    assert.equal(await field("endpoint").inputValue(), endpoint, "Custom endpoint was lost after provider switch");
    assert.equal(await field("model").inputValue(), "qa-model");
    assert.equal(requests.length, 0);
    const headingChunks = await dialog.locator("h2 span").evaluateAll(nodes => nodes.map(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return { lines: range.getClientRects().length, right: node.getBoundingClientRect().right };
    }));
    assert(headingChunks.every(chunk => chunk.lines === 1 && chunk.right <= width), "Heading left a dangling character or overflowed");
    let snapshot = JSON.parse(await dialog.locator("[data-ai-preview]").textContent());
    assert.equal(snapshot.selection.filteredRows, 2);
    assert.equal(snapshot.selection.sentRows, 2);
    assert.equal(snapshot.selection.includeDerived, false);
    assert.deepEqual(snapshot.samples.map(row => row.value), [410, 420]);
    assert(!JSON.stringify(snapshot).includes("never-send-private-field"));
    const geometry = await dialog.evaluate(node => ({ width: node.getBoundingClientRect().width, overflow: node.scrollWidth - node.clientWidth }));
    assert(geometry.width <= width && geometry.overflow <= 1);
    await dialog.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: path.join(output, `${width}-dialog.jpg`), type: "jpeg", quality: 90 });
    await field("provider").selectOption("openrouter");
    await dialog.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: path.join(output, `${width}-preset-provider.jpg`), type: "jpeg", quality: 90 });
    await dialog.screenshot({ path: path.join(output, `${width}-dialog-crop.png`) });
    await field("provider").selectOption("custom");
    await privacy.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${width}-privacy.jpg`), type: "jpeg", quality: 90 });
    await submit.click();
    await answer.locator("xpath=self::*[@data-state='complete']").waitFor();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.authorization, `Bearer ${testKey}`);
    assert.equal(requests[0].headers.cookie, undefined);
    assert.equal(requests[0].headers.referer, undefined);
    assert(!JSON.stringify(requests[0].body).includes(testKey));
    assert.match(requests[0].body.messages[1].content, /415/);
    assert(requests[0].body.messages[1].content.includes(statisticsAiQuestions[0].question));
    assert.equal(await dialog.locator("[data-ai-empty]").isVisible(), false);
    assert.equal(await page.evaluate(() => localStorage.getItem("gaia-senseware-ai-key-v1")), null);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 3000 });
    assert.equal(await dialog.isVisible(), false);
    assert.equal(await page.locator("#gaia-statistics-lab").isVisible(), true, "Escape also closed the observation workspace");
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => globalThis.GaiaStatisticsLab.getState().recordQuery), "Alpha", "Closing lost the observation filter");

    await trigger.click();
    await field("endpoint").fill(`${base}/api/should-never-receive-key`);
    await submit.click();
    await answer.locator("xpath=self::*[@data-state='error']").waitFor();
    assert.match(await answer.textContent(), /GAIA自身/);
    assert.equal(requests.length, 1);
    await field("endpoint").fill(endpoint);
    reply = "error";
    await submit.click();
    await page.waitForFunction(() => document.querySelector("[data-ai-answer]").textContent.includes("401"));
    assert.equal(await submit.isEnabled(), true, "Error prevented retry");
    reply = "xss";
    await submit.click();
    await answer.locator("xpath=self::*[@data-state='complete']").waitFor();
    assert.equal(await answer.locator("img").count(), 0, "AI output became executable HTML");
    assert.equal(await page.evaluate(() => Boolean(window.qaXss)), false);
    reply = "delay";
    await submit.click();
    await answer.locator("xpath=self::*[@data-state='loading']").waitFor();
    await page.waitForFunction(() => document.querySelector('#gaia-statistics-ai-form [type="submit"]').disabled);
    for (const preset of statisticsAiQuestions) assert.equal(await dialog.locator(`[data-ai-prompt="${preset.id}"]`).isDisabled(), true);
    await page.keyboard.press("Escape");
    await trigger.click();
    reply = "success";
    release?.();
    await page.waitForTimeout(100);
    assert.equal(await answer.getAttribute("data-state"), "idle", "Old response replaced the newly opened analysis");
    reply = "long";
    await field("rememberKey").check();
    await submit.click();
    await answer.locator("xpath=self::*[@data-state='complete']").waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("gaia-senseware-ai-key-v1")), testKey);
    await answer.scrollIntoViewIfNeeded();
    assert((await dialog.evaluate(node => node.scrollWidth - node.clientWidth)) <= 1, "Long result caused horizontal overflow");
    if (width > 900) {
      const resultBox = await dialog.locator(".gaia-statistics-ai-result").boundingBox();
      assert(resultBox.height <= Math.min(540, height - 320) + 1, "Long result did not stay inside its reading panel");
      assert.equal(await answer.evaluate(node => node.scrollHeight > node.clientHeight), true, "Long result cannot scroll");
      await answer.focus();
      await page.keyboard.press("End");
      await page.waitForFunction(() => document.querySelector("[data-ai-answer]").scrollTop > 0);
      await answer.evaluate(node => { node.scrollTop = 0; });
    }
    const closeBox = await dialog.locator("[data-ai-close]").boundingBox();
    assert(closeBox.y >= 0 && closeBox.y + closeBox.height <= height, "Close control disappeared during long result");
    await page.screenshot({ path: path.join(output, `${width}-result.jpg`), type: "jpeg", quality: 90 });
    await form.locator("[data-ai-clear]").click();
    assert.equal(await field("apiKey").inputValue(), "");
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem("gaia-senseware-ai-key-v1"), sessionStorage.getItem("gaia-senseware-ai-session-key-v1")]), [null, null]);
    await page.keyboard.press("Escape");
    await trigger.click();
    assert.equal(await field("apiKey").inputValue(), "");
    assert.equal(await page.evaluate(() => document.activeElement.id), "gaia-statistics-ai-title", "An empty key automatically focused the input");
    await dialog.locator("[data-ai-close]").click();
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    await page.locator("#gaia-statistics-menu-toggle").click();
    await page.locator("#gaia-statistics-record-filter").fill("No match whatsoever");
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab.getState().recordQuery === "No match whatsoever");
    await settle();
    await page.locator("#gaia-statistics-menu-close").click();
    assert.equal(await trigger.isDisabled(), true);
    report.checks.push({ width, height, requests: requests.length, geometry, openingBox, presentation, nonInputInitialFocus: true, contextPreserved: true, restoredConfiguration: true, questionPresets: 6, keyboardSelection: true, truthfulPrivacy: true, longResultLayout: true, filteredPayload: "2 SOURCE rows", explicitSendOnly: true, sameOriginBlocked: true, errorsAndCancellation: "passed", textOnlyOutput: true });
    console.log(`PASS ${width}px: 6 editable question presets, privacy, responsive/long-result layout, shared BYOK settings, selected data only, explicit send, secure transport, retry, cancel, stale response and key removal`);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), [], "CSP blocked a legitimate analysis feature");
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" });
  if (page && !page.isClosed()) report.failureGeometry = await page.evaluate(() => ["html", "body", "#gaia-statistics-lab", ".gaia-statistics-shell", ".gaia-statistics-controls", "#gaia-statistics-ai-open"].map(selector => {
    const node = document.querySelector(selector); const style = getComputedStyle(node);
    return { selector, rect: node.getBoundingClientRect().toJSON(), scrollLeft: node.scrollLeft, scrollTop: node.scrollTop, scrollWidth: node.scrollWidth, position: style.position, transform: style.transform };
  }));
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
