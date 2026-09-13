import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/estat-copy-transparent-2026-09-09/${before ? "before" : "after"}`);
const sizes = process.env.ESTAT_SIZES?.split(",").map(size => size.split("x").map(Number))
  || (before ? [[1920,1080]] : [[3840,2160],[2560,1440],[1920,1080],[1501,900],[1500,900],[1024,768],[390,844]]);
const files = ["panel-surfaces.css","map-chapter-navigation.css","gaia-mode-loader.js","index.html"];
const tested = Object.fromEntries(files.map(file => [file, before && file.endsWith("css") ? execFileSync("git",["show",`HEAD:${file}`]) : fs.readFileSync(file)]));
const report = { status: "running", before, environment: "Local Windows Chrome; bundled statistical data, actual map screenshots and controlled-backdrop pixel comparison",
  sha256: Object.fromEntries(files.map(file => [file,createHash("sha256").update(tested[file]).digest("hex")])), checks: [], errors: [] };
fs.mkdirSync(output,{recursive:true});
const browser = await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
let page;
try {
  for (const [width,height] of sizes) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:width<=900,reducedMotion:"reduce"});
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5","seen");
      localStorage.setItem("gaia-senseware-bgm-muted","true");
    });
    if (before) for (const file of files.filter(file => file.endsWith("css"))) await context.route(`${base}/${file}*`,route => route.fulfill({body:tested[file],contentType:"text/css"}));
    await context.route("https://services.swpc.noaa.gov/**",route => route.fulfill({path:"data/ovation-aurora-snapshot.json",contentType:"application/json"}));
    page = await context.newPage();
    page.on("pageerror",error => report.errors.push({width,message:error.message}));
    await page.goto(`${base}/?exhibit=30#world`,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(() => globalThis.GaiaEstatExhibits && globalThis.GaiaMapDemo && document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(async () => {
      GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map",{restoreFocus:false});
      GaiaMapCategories.buttons().find(button => Number(button.textContent) === 30).click();
      await document.fonts.ready;
    });
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.mouse.move(0,0); await page.evaluate(() => document.activeElement?.blur());
    const dock = page.locator(".gaia-estat-readout");
    const layout = await dock.evaluate(node => {
      const copy = node.querySelector(".gaia-estat-copy"), css = getComputedStyle(node), pseudo = getComputedStyle(node,"::before");
      return { dock:node.getBoundingClientRect().toJSON(),copy:copy.getBoundingClientRect().toJSON(),text:copy.textContent,background:css.background,
        filter:css.backdropFilter,shadow:css.boxShadow,pseudo:pseudo.background,pseudoHeight:pseudo.height,overflow:document.documentElement.scrollWidth-innerWidth };
    });
    report.checks.push({width,height,...layout});
    assert(layout.text.includes("日降水量1.0mm以上"),"Retain the reported explanation");
    assert.equal(layout.overflow,0);
    await page.screenshot({path:path.join(output,`${width}-full.png`)});
    await dock.screenshot({path:path.join(output,`${width}-dock.png`)});
    if (width > 1500) {
      // Hold the pixels behind the UI constant without mocking its styles.
      // Hide only letters and compare the caption text band with its parent
      // hidden. Exclude its 9px lower padding where the unchanged action
      // buttons' soft glow can reach up from the control row.
      const clip = {x:Math.ceil(layout.dock.left),y:Math.ceil(layout.dock.top),width:Math.floor(layout.dock.width)-2,
        height:Math.floor(layout.copy.bottom)-Math.ceil(layout.dock.top)-10};
      await page.evaluate(() => {
        const node = document.createElement("div"); node.id = "qa-caption-backdrop";
        node.style.cssText = "position:fixed;inset:0;z-index:31;pointer-events:none;background:repeating-conic-gradient(#edf2df 0 25%,#23539c 0 50%) 0 0 / 16px 16px";
        document.querySelector("#japan-layer").append(node);
        document.querySelectorAll(".gaia-estat-copy > *").forEach(child => child.style.visibility = "hidden");
      });
      const captionPixels = await page.screenshot({clip,path:path.join(output,`${width}-surface-probe.png`)});
      await dock.evaluate(node => node.style.visibility = "hidden");
      const referencePixels = await page.screenshot({clip,path:path.join(output,`${width}-uncovered-reference.png`)});
      const transparent = captionPixels.equals(referencePixels);
      report.checks.push({width,height,pixelIdenticalToUncoveredMap:transparent});
      assert.equal(transparent,!before,`${width}: explanation must show the exact underlying pixels`);
      await dock.evaluate(node => node.style.removeProperty("visibility"));
      await page.evaluate(() => {
        document.querySelector("#qa-caption-backdrop").remove();
        document.querySelectorAll(".gaia-estat-copy > *").forEach(child => child.style.removeProperty("visibility"));
      });
      if (!before) {
        assert.equal(layout.filter,"none"); assert.equal(layout.shadow,"none");
        assert(layout.pseudo.includes("0.8"),"Keep the lower controls' instrument surface");
      }
    }
    if (!before && width > 900) {
      await dock.locator('[data-estat-step="-1"]').click();
      await page.waitForFunction(() => document.querySelector("[data-estat-number]").textContent === "29");
      await dock.locator(".gaia-map-action--source").click();
      await page.waitForFunction(() => document.querySelector("#japan-layer").classList.contains("japan-data-open"));
      await page.locator("#japan-data-close").click();
      report.checks.push({width,height,previousAndSource:true});
    } else if (!before) {
      await page.locator('[data-mobile-sheet="reading"]').click();
      assert((await page.locator("#map-mobile-sheet").innerText()).includes("雨の頻度"));
      await page.keyboard.press("Escape");
      report.checks.push({width,height,mobileExplanation:true});
    }
    await context.close(); console.log(`PASS ${width}x${height}`);
  }
  assert.deepEqual(report.errors,[]); report.status = before ? "reproduced" : "passed";
} catch(error) {
  report.status="failed";report.failure=error.stack;
  if(page && !page.isClosed()) await page.screenshot({path:path.join(output,"failure.png")});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2));
  await browser.close();
}
