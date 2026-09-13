import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve("artifacts/true-end-finale-glint-2026-09-09/" + (before ? "before" : "after"));
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [1440,390]) for (const reduced of (before ? [false] : [false,true])) {
    const label = width + "-" + (reduced ? "reduced" : "motion");
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: "no-preference" });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.addInitScript(() => {
      globalThis.GAIA_BUILD_PROFILE = "debug";
      const progress = { storyVersion: 13, stepId: "welcome_chat_094", reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null, metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0 }, readStepIds: [], clear: false, archivesUnlocked: false, sessionId: "finale-glint-qa" };
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    await page.goto(base + "/?preview=finale-glint#story", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#novel-layer")?.dataset.entryTransition === "visible");
    // The global button glint is installed when the map has been loaded.
    await page.evaluate(() => GaiaModeLoader.load("exploration"));
    await page.waitForSelector(".gaia-global-button-glint", { state: "attached" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#novel-jump-button").click();
    await page.locator('.novel-jump-item[data-scene-id="true-end"]').click();
    for (let scene=0; scene<2; scene++) {
      await page.waitForFunction(() => document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "idle");
      const old = await page.locator(".true-end-shell").getAttribute("data-scene");
      await page.locator(".true-end-skip-button").click();
      await page.waitForFunction(old => document.querySelector(".true-end-shell")?.dataset.scene !== old && document.querySelector(".true-end-shell")?.dataset.sectionTransitionPhase === "idle", old);
    }
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.evaluate(reduced => {
      const checkbox = document.querySelector("#novel-reduced-motion");
      checkbox.checked = reduced;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }, reduced);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => {
      globalThis.__finaleTrace = [];
      globalThis.__finaleCompleteCount = 0;
      window.addEventListener("gaia:true-end-complete", () => __finaleCompleteCount++);
      const sample = () => {
        const finale = document.querySelector(".true-end-finale"), button = finale.querySelector("button"), glint = document.querySelector(".gaia-global-button-glint");
        __finaleTrace.push({ time: performance.now(), opacity: Number(getComputedStyle(finale).opacity), filter: getComputedStyle(finale).filter, animation: getComputedStyle(finale).animation, animations: finale.getAnimations().map(a=>({time:a.currentTime,state:a.playState})), inert: finale.inert, focus: document.activeElement === button, glint: glint.classList.contains("is-active"), glintOpacity: Number(getComputedStyle(glint).opacity) });
        if (__finaleTrace.length < 180) requestAnimationFrame(sample);
      };
      document.querySelector(".true-end-skip-button").click();
      requestAnimationFrame(sample);
    });
    await page.waitForTimeout(100);
    if (!before && !reduced) {
      const position = await page.locator(".true-end-finale button").boundingBox();
      await page.mouse.click(position.x + position.width / 2, position.y + position.height / 2);
      await page.locator(".true-end-finale button").evaluate(button => button.focus());
      assert.equal(await page.locator(".true-end-exit-veil").count(), 0, "Invisible button accepted a click");
      assert.equal(await page.locator(".true-end-finale button").evaluate(button => button === document.activeElement), false, "Invisible button accepted focus");
    }
    await page.screenshot({ path: path.join(output,label+"-early.png") });
    await page.waitForTimeout(2650);
    const trace = await page.evaluate(() => __finaleTrace);
    const early = trace.filter(f => f.opacity < 0.99 && f.glint);
    report.checks.push({label, earlyGlints: early.length, trace});
    if (before) assert(early.length > 0, label + ": early detached glint did not reproduce");
    else {
      assert.equal(early.length, 0, label + ": glint preceded the button");
      assert(trace.some(f=>f.opacity===1 && f.focus), label + ": accessible focus was not restored");
      if (!reduced) assert(trace.filter(f=>f.opacity<0.99).every(f=>f.inert && !f.focus), label + ": unrevealed finale was interactive");
      assert.equal(await page.locator(".true-end-finale").evaluate(node=>node.inert), false);
      assert.equal(await page.evaluate(() => __finaleCompleteCount), 1);
      const completion = await page.evaluate(() => localStorage.getItem("gaiaSensewareTrueEnd:complete:v1"));
      assert(completion && Number.isFinite(Date.parse(completion)), "Ending completion was not saved");
      assert.equal(await page.evaluate(() => localStorage.getItem("gaiaSensewareTrueEnd:pending:v1")), null);
      await page.screenshot({path:path.join(output,label+"-ready.png")});
      await page.mouse.move(2,2);
      await page.locator(".true-end-finale button").hover();
      if (!reduced) assert(await page.locator(".gaia-global-button-glint").evaluate(node=>node.classList.contains("is-active")), "Visible button hover lost its effect");
      if (width < 600) {
        await page.locator(".true-end-finale button").focus();
        await page.keyboard.press("Enter");
      } else await page.locator(".true-end-finale button").click();
      await page.waitForFunction(()=>!document.querySelector(".true-end-exit-veil") && document.querySelector("#intro-layer")?.getAttribute("aria-hidden")==="false",null,{timeout:18000});
      assert.equal(await page.locator("#novel-layer").getAttribute("aria-hidden"),"true");
      await page.screenshot({path:path.join(output,label+"-return.png")});
      await page.reload({waitUntil:"domcontentloaded"});
      assert.equal(await page.evaluate(() => localStorage.getItem("gaiaSensewareTrueEnd:complete:v1")), completion, "Ending completion did not persist after reload");
    }
    console.log("PASS "+label+": early glint frames="+early.length);
    await context.close();
  }
  assert.deepEqual(report.errors,[]);
  report.status=before?"reproduced":"passed";
} catch(error) {
  report.status="failed"; report.failure=error.stack;
  if(page&&!page.isClosed())await page.screenshot({path:path.join(output,"failure.png")});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2));
  await browser.close();
}
