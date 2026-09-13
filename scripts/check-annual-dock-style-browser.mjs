import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4483";
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/annual-dock-style-2026-09-09/${before ? "before" : "after"}`);
const sizes = process.env.ANNUAL_UI_SIZES?.split(",").map(s => s.split("x").map(Number)) || (before ? [[3840,2088],[1440,900],[390,844]] : [[1440,900],[390,844],[3840,2088],[1920,1080],[1024,768],[320,568],[844,390]]);
const files = ["marine-cod-exhibit.css", "map-chapter-navigation.css", "map-observation-typography.css", "src/exploration/marine-cod-exhibit.js", "src/exploration/annual-poi-arrival.js", "src/exploration/index.js", "gaia-mode-loader.js", "index.html"];
const report = { status: "running", before, environment: "Local Chrome; original bundled source data; external network blocked; desktop and touch emulation, not production or physical phones.",
  sha256: Object.fromEntries(files.map(f => [f, createHash("sha256").update(fs.readFileSync(f)).digest("hex")])), checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height] of sizes) {
    const mobile = width <= 900;
    const context = await browser.newContext({ viewport: {width,height}, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://**", route => route.abort());
    page = await context.newPage(); page.on("pageerror", e => report.errors.push(e.message));
    await page.goto(`${base}/?exhibit=31#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMarineCod?.getState().count > 0);
    await page.evaluate(() => GaiaMapDemo.stop());
    const numbers = process.env.ANNUAL_UI_NUMBERS?.split(",").map(Number) || (before ? [30,31,44,64] : [30,...([1440,390].includes(width) ? Array.from({length:34},(_,i)=>31+i) : [31,32,38,43,44,52,54,55,63,64])]);
    let reference;
    for (const number of numbers) {
      let currentRow, currentData;
      await page.evaluate(number => GaiaMapCategories.buttons().find(b => Number(b.textContent) === number).click(), number);
      if (number >= 31) {
        await page.waitForFunction(number => Number(GaiaMarineCod.definition.number) === number && GaiaMarineCod.getState().count > 0 && !document.querySelector("[data-cod-controls]").disabled, number);
        const file = await page.evaluate(() => GaiaMarineCod.definition.dataFile);
        const data = JSON.parse(fs.readFileSync(`data/${file}`, "utf8"));
        const row = data.periods.at(-1).stations.find(r => (r.measurement || r.cod).value !== null);
        currentRow = row; currentData = data;
        await page.locator("[data-cod-prefecture]").selectOption(row.prefCode);
        await page.locator("[data-cod-station]").selectOption(row.id);
      }
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle" && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      await page.evaluate(() => document.fonts.ready);
      const selector = number === 30 ? ".gaia-estat-readout" : ".gaia-marine-cod-readout";
      const dock = page.locator(selector); await dock.waitFor({ state: "visible" });
      const layout = await dock.evaluate(node => {
        const describe = el => {
          if (!el) return null;
          const c = getComputedStyle(el), r = el.getBoundingClientRect();
          return { text: el.innerText, rect: r.toJSON(), size: parseFloat(c.fontSize), family: c.fontFamily, weight: c.fontWeight, lineHeight: c.lineHeight,
            visible: el.checkVisibility({visibilityProperty:true}), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
        };
        const chapter = node.querySelector(".gaia-marine-cod-chapter, .gaia-estat-chapter");
        const button = chapter.querySelector("[data-map-bank-toggle], .gaia-estat-selector-toggle");
        return { dock: describe(node), category: describe(chapter.querySelector("[data-map-category-label]")), chapter: describe(chapter), number: describe(button.querySelector("b")), title: describe(button.querySelector("strong")),
          next: describe(chapter.querySelector('[data-cod-step="1"], [data-estat-step="1"]')),
          place: describe(node.querySelector("[data-cod-place], .gaia-estat-place strong")), value: describe(node.querySelector("[data-cod-value], .gaia-estat-primary strong")),
          instrument: describe(node.querySelector(".gaia-cod-primary")),
          pickers: describe(node.querySelector(".gaia-cod-pickers")), timeline: describe(node.querySelector(".gaia-cod-timeline")), actions: describe(node.querySelector(".gaia-map-actions")),
          controls: [...node.querySelectorAll("button,select,input")].filter(el=>el.checkVisibility({visibilityProperty:true})).map(el=>{
            const r=el.getBoundingClientRect();return {tag:el.tagName,label:el.getAttribute("aria-label"),size:parseFloat(getComputedStyle(el).fontSize),rect:r.toJSON(),hit:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
          }) };
      });
      report.checks.push({ width,height,exhibit:number,...layout });
      if (number === 30) reference = layout;
      if (!before && number >= 31 && !mobile) {
        assert(layout.title.scrollWidth <= layout.title.clientWidth + 1, `${width}/${number}: full title without truncation`);
        assert(layout.title.rect.right <= layout.chapter.rect.right - 44, `${width}/${number}: title leaves space for next arrow`);
        assert(layout.title.rect.right <= layout.next.rect.left && layout.next.rect.right <= layout.chapter.rect.right, `${width}/${number}: next arrow at the expanded chapter edge`);
        assert.equal(layout.number.size, reference.number.size, `${width}/${number}: chapter number size`);
        assert.equal(layout.title.size, reference.title.size, `${width}/${number}: chapter title size`);
        for (const field of ["number","title","category"]) {
          assert.equal(layout[field].family, reference[field].family, `${width}/${number}: ${field} typeface`);
          assert.equal(layout[field].weight, reference[field].weight, `${width}/${number}: ${field} weight`);
        }
      }
      if (!before && number >= 31) {
        const r = layout.dock.rect;
        assert(r.left >= 0 && r.right <= width + 1 && r.bottom <= height + 1);
        for (const control of layout.controls) {
          const c = control.rect;
          assert(control.hit && c.left >= r.left - 1 && c.right <= r.right + 1 && c.top >= r.top - 1 && c.bottom <= r.bottom + 1,
            `${width}/${number}: control clipped or obscured ${JSON.stringify(control)}`);
          if (control.tag === "SELECT") assert(control.size >= 14, `${width}/${number}: readable selector`);
        }
        if (width > 1399) {
          const columns = [layout.chapter,layout.pickers,layout.instrument,layout.timeline,layout.actions].map(c=>c.rect);
          for (let i=1;i<columns.length;i++) assert(columns[i].left >= columns[i-1].right - 1, `${width}/${number}: chapter/place/measurement/year/actions order`);
          const selects = layout.controls.filter(c=>c.tag==="SELECT");
          assert(Math.abs(selects[0].rect.left-selects[1].rect.left)<1, "Place selectors share their left edge");
        }
        assert(layout.value.rect.right <= layout.instrument.rect.right + 1 && layout.value.rect.bottom <= r.bottom + 1, `${width}/${number}: observed value stays inside its column`);
        assert.equal(await page.locator("[data-cod-value]").innerText(), `${(currentRow.measurement || currentRow.cod).text} ${await page.evaluate(()=>GaiaMarineCod.definition.unit)}`);
        assert.equal(await page.locator(".experience").evaluate(n=>n.scrollLeft),0);
      }
      if (before || [31,43,44,63,64].includes(number)) {
        await dock.screenshot({ path: path.join(output, `${width}-${number}-dock.png`) });
        if (!mobile) await page.locator(`${selector} > :is(.gaia-estat-chapter,.gaia-marine-cod-chapter)`).screenshot({path:path.join(output,`${width}-${number}-chapter.png`)});
        await page.screenshot({ path: path.join(output, `${width}-${number}-full.png`) });
      }
      if (!before && number >= 31 && ([1440,390].includes(width) ? [31,38,44,64].includes(number) : number === 31)) {
        const action = async kind => {
          if (mobile) { await page.locator('[data-mobile-sheet="tools"]').click(); await page.getByRole("button",{name:kind==="source"?"データの出典":"統計分析",exact:true}).last().click(); }
          else await page.locator(`[data-cod-${kind}]`).click();
        };
        await action("source"); await page.locator("#japan-data-panel").waitFor({state:"visible"}); await page.locator("#japan-data-close").click();
        await action("analysis");
        await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady && document.querySelector("#gaia-statistics-canvas").dataset.analysisDataset===GaiaMarineCod.getStatisticsDataset().id);
        await page.locator("#gaia-statistics-close").click();
        const year=page.locator("[data-cod-year]"); await year.focus(); await page.keyboard.press("ArrowLeft");
        assert.equal(await page.evaluate(()=>GaiaMarineCod.getState().year),currentData.periods.at(-2).year);
        await page.keyboard.press("ArrowRight"); assert.equal(await year.inputValue(),String(currentData.periods.at(-1).year));
        await page.locator("[data-cod-play]").click(); assert.equal(await page.locator("[data-cod-play]").getAttribute("aria-pressed"),"true");
        await page.locator("[data-cod-play]").click(); assert.equal(await page.locator("[data-cod-play]").getAttribute("aria-pressed"),"false");
        if (!mobile) {
          const trigger=page.locator(".gaia-marine-cod-chapter [data-map-bank-toggle]");
          await trigger.click(); await page.locator("#map-dock-bank-popover").waitFor({state:"visible"});
          const menu=await page.locator("#map-dock-bank-popover").boundingBox(); assert(menu.y>=0 && menu.y+menu.height<layout.dock.rect.top);
          await trigger.click();
        }
        await page.locator(mobile?'[data-mobile-exhibit-step="1"]':'[data-cod-step="1"]').click();
        await page.waitForFunction(next=>GaiaMapCategories.buttons().some(b=>Number(b.textContent)===next&&b.getAttribute("aria-current")==="true"),number===64?1:number+1);
        assert.equal(await page.locator(".experience").evaluate(n=>n.scrollLeft),0);
        report.checks.at(-1).interactions="source, analysis, keyboard year, autoplay, next; desktop chapter menu";
      }
      console.log(`${before ? "BASELINE" : "PASS"} ${width}/${number}: title ${layout.title.size}px, number ${layout.number.size}px, dock ${layout.dock.rect.height}px`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]); report.status=before ? "recorded" : "passed";
} catch(e) { report.status="failed"; report.failure=e.stack; if(page&&!page.isClosed())await page.screenshot({path:path.join(output,"failure.png")}).catch(()=>{});throw e; }
finally { fs.writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2));await browser.close(); }
