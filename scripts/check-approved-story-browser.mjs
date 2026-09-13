import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4173"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module root and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/approved-story-browser");
fs.mkdirSync(outputDir, { recursive: true });
const projectRoot = process.cwd();
const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const allowedScripts = new Set([
  "opening-audio.js",
  "ui-sound.js",
  "scene-transition.js",
  "novel-story-data.js",
  "true-end-data.js",
  "true-end-webgl.js",
  "true-end-mode.js",
  "novel-background-cues.js",
  "novel-back-half-cues.js",
  "novel-temporal.js",
  "novel-mode.js",
]);
const allowedStyles = new Set(["styles.css", "scene-transition.css", "novel-mode.css", "true-end.css"]);
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"],
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".webp", "image/webp"],
  [".mp3", "audio/mpeg"], [".wav", "audio/wav"], [".woff2", "font/woff2"], [".ico", "image/x-icon"],
]);

await import(new URL("../novel-story-data.js", import.meta.url));
await import(new URL("../true-end-data.js", import.meta.url));
const mainStory = globalThis.GAIA_NOVEL_STORY;
const trueEndStory = globalThis.GAIA_TRUE_END_STORY;
const trueEndSteps = trueEndStory.scenes.flatMap((scene) => scene.steps);
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const progressFor = (stepId, label) => ({
  storyVersion: mainStory.storyVersion,
  stepId,
  reachedSceneIds: [mainStory.scenes.find((scene) => scene.steps.some((step) => step.id === stepId))?.id].filter(Boolean),
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `approved-story-${label}`,
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`${label}: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() === 404) report.responses404.push(`${label}: ${response.url()}`);
  });
};

const installLocalRoute = (context) => context.route("http://gaia.local/**", async (route) => {
  const request = route.request();
  const pathname = decodeURIComponent(new URL(request.url()).pathname);
  const relative = ["/", "/story", "/story/"].includes(pathname) ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(projectRoot, relative);
  if (!file.startsWith(`${projectRoot}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    await route.fulfill({ status: 404, contentType: "text/plain; charset=utf-8", body: "Not found" });
    return;
  }
  const body = fs.readFileSync(file);
  const headers = { "Cache-Control": "no-store", "Accept-Ranges": "bytes" };
  const range = request.headers().range?.match(/^bytes=(\d*)-(\d*)$/u);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    await route.fulfill({
      status: 206,
      contentType: mime.get(path.extname(file).toLowerCase()) || "application/octet-stream",
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${body.length}` },
      body: body.subarray(start, end + 1),
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: mime.get(path.extname(file).toLowerCase()) || "application/octet-stream",
    headers,
    body,
  });
});

const buildHarness = (initialStorage = {}) => {
  const storage = JSON.stringify(initialStorage).replaceAll("<", "\\u003c");
  const storageScript = `<script>\n(() => {\n  const values = new Map(Object.entries(${storage}));\n  const storage = {\n    get length() { return values.size; },\n    clear() { values.clear(); },\n    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },\n    key(index) { return [...values.keys()][index] ?? null; },\n    removeItem(key) { values.delete(String(key)); },\n    setItem(key, value) { values.set(String(key), String(value)); },\n  };\n  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });\n  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });\n  history.replaceState = () => {};\n  history.pushState = () => {};\n})();\n</script>`;
  return indexSource
    .replace(/<link\b[^>]*>/giu, (tag) => {
      const href = tag.match(/href=["']([^"']+)["']/iu)?.[1] || "";
      const file = href.split(/[?#]/u)[0].split("/").at(-1);
      return allowedStyles.has(file) ? tag : "";
    })
    .replace(/<script\b([^>]*)>[\s\S]*?<\/script>/giu, (tag, attributes) => {
      const src = attributes.match(/src=["']([^"']+)["']/iu)?.[1] || "";
      const file = src.split(/[?#]/u)[0].split("/").at(-1);
      return allowedScripts.has(file) ? tag : "";
    })
    .replace(/<head>/iu, `<head><base href="http://gaia.local/">${storageScript}`);
};

const bootAt = async (page, stepId, label) => {
  const progress = progressFor(stepId, label);
  const storage = {
    "gaiaSensewareNovel:progress": JSON.stringify(progress),
    "gaiaSensewareNovel:manual-saves": JSON.stringify([{
      progress,
      savedAt: Date.now(),
      meta: { title: "Approved story QA", excerpt: progress.stepId },
    }]),
    "gaiaSensewareNovel:config:v3": JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }),
    "gaia-senseware-bgm-volume": "0",
  };
  await page.setContent(buildHarness(storage), { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
  await page.evaluate(() => globalThis.GaiaNovel.open());
  await page.waitForFunction((expected) => document.querySelector("#novel-layer")?.dataset.stepId === expected, stepId);
  await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
};

const scanMain = (page) => page.evaluate(() => ({
  stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
  text: document.querySelector("#novel-text")?.textContent || "",
  speaker: document.querySelector("#novel-speaker")?.textContent?.trim() || "",
  cue: document.querySelector("#novel-layer")?.dataset.backgroundCue || "",
  overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
}));

const advanceMainTo = async (page, targetStepId) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.locator("#novel-dialogue").click();
    const reached = await page.waitForFunction(
      (target) => document.querySelector("#novel-layer")?.dataset.stepId === target,
      targetStepId,
      { timeout: 1_500 },
    ).then(() => true).catch(() => false);
    if (reached) {
      await page.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
      return;
    }
  }
  throw new Error(`クリックしても${targetStepId}へ進みませんでした`);
};

const startTrueEnd = async (page) => {
  await page.evaluate(() => {
    const layer = document.querySelector("#novel-layer");
    const host = document.querySelector("#novel-result-surface");
    layer.hidden = false;
    layer.setAttribute("aria-hidden", "false");
    layer.classList.add("is-result", "is-true-end");
    Object.assign(layer.style, { display: "block", visibility: "visible", opacity: "1", position: "fixed", inset: "0" });
    host.hidden = false;
    Object.assign(host.style, { display: "block", visibility: "visible", opacity: "1" });
    globalThis.__approvedTrueEndRuntime = globalThis.GaiaTrueEnd.start({
      host,
      layer,
      onStepRead(step) { layer.dataset.qaBeyondStep = step.id; },
    });
  });
  await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.qaBeyondStep === "beyond_01_001");
};

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await installLocalRoute(context);
    const page = await context.newPage();
    attachDiagnostics(page, viewport.name);

    await bootAt(page, "gx_experience_020", `${viewport.name}-gx-time`);
    await advanceMainTo(page, "gx_experience_021");
    const gx = await scanMain(page);
    const gxApprovedText = await page.evaluate(() => globalThis.GAIA_NOVEL_STORY.scenes.flatMap((scene) => scene.steps).find((step) => step.id === "gx_experience_021")?.text || "");
    assert.match(gxApprovedText, /約二十七億年前/u);
    assert.match(gx.text, /年代表示が、今度はゆっくり/u);
    assert.equal(gx.overflowX, 0);

    await page.close();
    const learningPage = await context.newPage();
    attachDiagnostics(learningPage, `${viewport.name}-esp32-learning`);
    await bootAt(learningPage, "esp32_pitch_016", `${viewport.name}-esp32-learning`);
    const expectedIds = ["esp32_pitch_016", "esp32_pitch_016a", "esp32_pitch_016b", "esp32_pitch_016c", "esp32_pitch_016d", "esp32_pitch_016e", "esp32_pitch_016f", "esp32_pitch_016g", "esp32_pitch_016h", "esp32_pitch_016i"];
    const seen = [];
    for (let index = 0; index < expectedIds.length; index += 1) {
      const expectedId = expectedIds[index];
      await learningPage.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, expectedId);
      await learningPage.waitForFunction(() => document.querySelector("#novel-text")?.dataset.revealState === "complete");
      seen.push(await scanMain(learningPage));
      if (index < expectedIds.length - 1) await advanceMainTo(learningPage, expectedIds[index + 1]);
    }
    assert.doesNotMatch(seen[0].text, /時刻|設置条件/u);
    assert.match(seen.at(-1).text, /比較の土台/u);
    assert(seen.every((scan) => scan.cue === seen[0].cue), `${viewport.name}: ESP32学習シーケンスで背景が途切れました`);
    assert(seen.every((scan) => scan.overflowX === 0));
    await learningPage.screenshot({ path: path.join(outputDir, `${viewport.name}-esp32-learning.png`), animations: "disabled" });

    const trueEndPage = await context.newPage();
    attachDiagnostics(trueEndPage, `${viewport.name}-novacene`);
    await trueEndPage.setContent(buildHarness({ "gaia-senseware-bgm-volume": "0" }), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await trueEndPage.waitForFunction(() => Boolean(globalThis.GaiaTrueEnd && globalThis.GAIA_TRUE_END_STORY));
    await startTrueEnd(trueEndPage);
    const visited = [];
    for (const expected of trueEndSteps) {
      await trueEndPage.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.qaBeyondStep === id, expected.id);
      const scan = await trueEndPage.evaluate(() => ({
        stepId: document.querySelector("#novel-layer")?.dataset.qaBeyondStep || "",
        scene: document.querySelector(".true-end-shell")?.dataset.scene || "",
        text: document.querySelector(".true-end-message")?.textContent || "",
        counter: document.querySelector(".true-end-footer span")?.textContent || "",
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      }));
      assert.equal(scan.text, expected.text, `${viewport.name}: ${expected.id}の本文が不一致です`);
      assert.equal(scan.overflowX, 0);
      visited.push(scan.stepId);
      await trueEndPage.evaluate(() => document.querySelector(".true-end-dialogue")?.click());
    }
    await trueEndPage.waitForFunction(() => document.querySelector(".true-end-finale")?.hidden === false);
    assert.deepEqual(visited, trueEndSteps.map((step) => step.id));
    await trueEndPage.screenshot({ path: path.join(outputDir, `${viewport.name}-novacene-finale.png`), animations: "disabled" });
    report.scans.push({ viewport: viewport.name, gxStep: gx.stepId, esp32Steps: seen.map((scan) => scan.stepId), trueEndSteps: visited.length, passed: true });
    await context.close();
  }

  assert.equal(report.consoleErrors.length, 0, `console errors:\n${report.consoleErrors.join("\n")}`);
  assert.equal(report.pageErrors.length, 0, `page errors:\n${report.pageErrors.join("\n")}`);
  assert.equal(report.responses404.length, 0, `404 responses:\n${report.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Approved story browser check passed: ${report.scans.length} viewports / ${trueEndSteps.length} APEIRONCENE messages each`);
