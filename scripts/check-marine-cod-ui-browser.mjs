import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const before = process.argv.includes("--before");
const base = process.env.GAIA_BASE_URL || "http://127.0.0.1:4447";
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/marine-cod-ui-2026-09-09/${before ? "before" : "after"}`);
const files = ["app.js", "src/exploration/marine-cod-exhibit.js", "marine-cod-exhibit.css", "map-chapter-navigation.css", "map-exhibit-categories.js", "map-mobile-shell.js", "gaia-mode-loader.js", "src/exploration/index.js", "index.html", "data/japan-marine-cod.json"];
const sources = Object.fromEntries(files.map(file => [file, fs.readFileSync(file, "utf8")]));
if (before) {
  for (const file of ["src/exploration/marine-cod-exhibit.js", "marine-cod-exhibit.css"]) sources[file] = execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
  sources["app.js"] = sources["app.js"].replace('classList.contains("is-marine-cod-exhibit") ? 512 : 8', 'classList.contains("is-marine-cod-exhibit") ? 8 : 8');
  sources["map-chapter-navigation.css"] = sources["map-chapter-navigation.css"].replaceAll(", .gaia-marine-cod-chapter", "").replaceAll(", [data-cod-step]", "").replaceAll(', [data-cod-step="1"]', "");
  sources["map-exhibit-categories.js"] = sources["map-exhibit-categories.js"].replaceAll(", .gaia-marine-cod-chapter", "");
}
const rows = JSON.parse(sources["data/japan-marine-cod.json"]).periods.at(-1).stations;
const tokyo = rows.find(row => row.id === "1360101"), near = rows.find(row => row.id === "1360152");
const report = { status: "running", before, baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  environment: "Local Chrome, actual bundled MOE data. Real browser mouse/touch/pinch and rendered canvas. Touch uses device emulation, not physical phones; external live requests blocked. Before replays old COD JS/CSS and old 8x zoom limit.",
  sha256: Object.fromEntries(files.map(file => [file, createHash("sha256").update(sources[file]).digest("hex")])), checks: [], errors: [] };
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const zoom = () => page.locator("#japan-overlay").getAttribute("data-earth-zoom").then(Number);
const idle = () => page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
const zoomButton = async (mobile, direction) => {
  if (mobile) { await page.locator('[data-mobile-sheet="tools"]').click(); await page.getByRole("button", {name: direction === "in" ? "＋ 拡大" : "− 縮小",exact:true}).click(); }
  else await page.locator(`#gaia-map-zoom-${direction}`).click();
};
const projected = row => page.evaluate(row => {
  const rect = document.querySelector("#japan-map").getBoundingClientRect(), d = document.querySelector("#japan-overlay").dataset;
  const scale = (rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180)) * Number(d.earthZoom);
  return { x: rect.left + (rect.width - 360 * scale) / 2 + Number(d.earthOffsetX) + ((row.lon - 150 + 540) % 360) * scale,
    y: rect.top + (rect.height - 180 * scale) / 2 + Number(d.earthOffsetY) + (90 - row.lat) * scale };
}, row);
try {
  const sizes = process.env.COD_UI_SIZES?.split(",").map(size => size.split("x").map(Number))
    || (before ? [[1440,900],[390,844]] : [[2560,1440],[1920,1080],[1440,900],[1280,800],[1024,768],[390,844],[320,568],[844,390]]);
  for (const [width,height] of sizes) {
    const mobile = width <= 900;
    const context = await browser.newContext({ viewport: { width,height }, hasTouch: mobile, isMobile: mobile, reducedMotion: "reduce" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://**", route => route.abort());
    if (before) await context.route(`${base}/**`, async route => {
      const file = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
      if (file in sources) return route.fulfill({ body: sources[file], contentType: file.endsWith(".css") ? "text/css" : file.endsWith(".html") ? "text/html" : file.endsWith(".json") ? "application/json" : "application/javascript" });
      await route.continue();
    });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.goto(`${base}/?exhibit=31&cod-ui-qa=1#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().count === 2042 && globalThis.GaiaMapDemo);
    await page.evaluate(() => GaiaMapDemo.stop()); await idle();
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await page.evaluate(() => document.fonts.ready);
    const exposed = await page.evaluate(rows => {
      const rect = document.querySelector("#japan-map").getBoundingClientRect(), d = document.querySelector("#japan-overlay").dataset;
      const scale = (rect.width >= 901 ? rect.width/360 : Math.max(rect.width/360,rect.height/180)) * Number(d.earthZoom);
      return rows.filter(row => {
        const x = rect.left+(rect.width-360*scale)/2+Number(d.earthOffsetX)+((row.lon-150+540)%360)*scale;
        const y = rect.top+(rect.height-180*scale)/2+Number(d.earthOffsetY)+(90-row.lat)*scale;
        return document.elementFromPoint(x,y)?.id === "japan-map";
      }).length;
    }, rows);
    if (!before) assert.equal(exposed, rows.length, `${width}: every real station centre exposed`);
    await page.screenshot({ path: path.join(output, `${width}-overview.png`) });
    await page.locator("[data-cod-prefecture]").selectOption("13");
    await page.locator("[data-cod-station]").selectOption(tokyo.id); await idle();
    const dock = await page.locator(".gaia-marine-cod-readout").boundingBox();
    if (before) {
      assert.equal(await zoom(), 8);
      assert(await page.locator("#gaia-map-zoom-in").isDisabled());
      if (!mobile) { assert.equal(dock.width, 320); assert(dock.height > 300); }
      assert.equal(await page.locator(".gaia-cod-scale").isVisible(), false);
      report.checks.push({ width,height, reproduced: "Independent vertical card, no visible scale and 8x zoom cap", dock });
      await page.screenshot({ path: path.join(output, `${width}-selected.png`) });
      await context.close(); continue;
    }
    assert.equal(await zoom(), 64);
    assert(await page.locator(".gaia-cod-legend-key").isVisible(), "Legend is visible without opening reading");
    const legend = await page.locator(".gaia-cod-legend-key").boundingBox();
    assert(legend.y + legend.height < dock.y - 2, `${width}: legend and dock separated`);
    if (!mobile) {
      assert(dock.width >= width - 45 && Math.abs(dock.y + dock.height - height) < 1, "Same bottom strip as other exhibits");
      assert.equal(await page.locator(".gaia-marine-cod-chapter [data-map-category-label]").innerText(), "水と森");
    }
    for (const selector of ["[data-cod-prefecture]", "[data-cod-station]", "[data-cod-year]", "[data-cod-play]", "[data-cod-overview]", ...(!mobile ? ["[data-cod-source]", "[data-cod-analysis]", "[data-cod-step='-1']", "[data-cod-step='1']"] : [])]) {
      const bounds = await page.locator(selector).evaluate(node => { const r = node.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height, hit: node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)), sw:node.scrollWidth,cw:node.clientWidth }; });
      assert(bounds.hit && bounds.x >= 0 && bounds.x + bounds.w <= width + 1 && bounds.y >= dock.y && bounds.y + bounds.h <= dock.y + dock.height + 1, `${width}: reachable and contained ${selector}: ${JSON.stringify(bounds)}`);
    }
    const texts = await page.locator(".gaia-cod-primary").evaluate(node => [...node.querySelectorAll("span, p, strong, small")].filter(child=>child.getClientRects().length).map(child => { const r=child.getBoundingClientRect(); return { text:child.textContent, y:r.y, bottom:r.bottom, right:r.right }; }));
    assert(texts.every(r=>r.y >= dock.y - 1 && r.bottom <= height && r.right <= width), `${width}: value and explanation inside dock ${JSON.stringify(texts)}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.screenshot({ path: path.join(output, `${width}-selected.png`) });
    if (width === 1440) {
      const trigger=page.locator(".gaia-marine-cod-chapter [data-map-bank-toggle]");
      await trigger.click(); await page.locator("#map-dock-bank-popover").waitFor({state:"visible"});
      assert.equal(await trigger.getAttribute("aria-expanded"),"true");
      const menu=await page.locator("#map-dock-bank-popover").boundingBox();
      assert(menu.y >= 0 && menu.y+menu.height < dock.y, "The shared exhibition list opens above COD dock");
      await page.screenshot({path:path.join(output,`${width}-exhibit-list.png`)});
      await trigger.click(); assert.equal(await trigger.getAttribute("aria-expanded"),"false");
    }
    if (width === 1440 || width === 390) {
      for (let step = 0; step < 20 && await zoom() < 512; step++) await zoomButton(mobile, "in");
      assert.equal(await zoom(), 512); assert(await page.locator("#gaia-map-zoom-in").isDisabled());
      // Recentering a selection must preserve the user's close zoom.
      await page.locator("[data-cod-station]").selectOption(tokyo.id); await idle();
      assert.equal(await zoom(), 512);
      const a = await projected(tokyo), b = await projected(near);
      assert(Math.hypot(a.x-b.x,a.y-b.y) > 30, "Previously overlapping source stations are separated");
      for (const row of [near,tokyo]) {
        const point = await projected(row);
        assert(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.id === "japan-map", point), "Actual canvas point is exposed");
        if (mobile) await page.touchscreen.tap(point.x,point.y); else await page.mouse.click(point.x,point.y);
        assert.equal(await page.evaluate(() => GaiaMarineCod.getState().selectedId), row.id);
        assert.equal(await page.locator("[data-cod-value]").innerText(), `${row.cod.text} mg/L`);
      }
      assert(await page.locator('[data-cod-station] optgroup').first().getAttribute("label").then(label=>label.includes("選択地点の近く")));
      assert(await page.locator(`[data-cod-station] optgroup:first-of-type option[value='${near.id}']`).count());
      await page.screenshot({ path: path.join(output, `${width}-dense-poi.png`) });
      if (!mobile) {
        const moduleUrl = `/src/exploration/${sources["src/exploration/index.js"].match(/import "\.\/(marine-cod-exhibit\.js[^\"]*)"/)[1]}`;
        const palette = await page.evaluate(async url => {
          const {codAppearance} = await import(url);
          return [0,1,2,3,5,9,20,null].map(value => codAppearance(value));
        },moduleUrl);
        assert.deepEqual(palette.map(item=>item.color),["rgb(74, 157, 255)","rgb(69, 206, 235)","rgb(129, 221, 167)","rgb(247, 221, 104)","rgb(255, 145, 81)","rgb(247, 79, 103)","rgb(247, 79, 103)","#abb5be"]);
        assert.equal(await page.locator("[data-cod-value]").evaluate(node=>getComputedStyle(node).color),"rgb(249, 198, 97)");
        await page.waitForTimeout(120);
        const pixel = await page.evaluate(({x,y})=>{
          const c=document.querySelector("#gaia-marine-cod-canvas"),r=c.getBoundingClientRect();
          return [...c.getContext("2d").getImageData(Math.round((x-r.left)*c.width/r.width),Math.round((y-r.top)*c.height/r.height),1,1).data];
        }, await projected(tokyo));
        assert(pixel.slice(0,3).every((value,i)=>Math.abs(value-[249,198,97][i])<=2) && pixel[3]>200, `Actual point pixel uses COD palette: ${pixel}`);
        const scale = await page.locator(".gaia-marine-cod-legend .gaia-cod-scale").evaluate(node=>node.style.background);
        assert(scale.includes("rgb(247, 79, 103) 100%") && scale.includes("rgb(74, 157, 255) 0%"));
        report.checks.push({palette:"Fixed 0,1,2,3,5,9 mg/L stops, capped high values, separate missing ring; actual 3.6 mg/L point pixel and readout color verified",pixel});
      }
      await zoomButton(mobile, "out"); assert(await zoom() < 512);
      if (!mobile) {
        const point = await projected(tokyo); await page.mouse.move(point.x,point.y); const previous=await zoom();
        await page.mouse.wheel(0, -100); await page.waitForTimeout(160); assert(await zoom() > previous);
        const start = await projected(tokyo);
        await page.mouse.move(start.x,start.y); await page.mouse.down(); await page.mouse.move(start.x+60,start.y+20,{steps:5}); await page.mouse.up();
        const moved=await projected(tokyo); assert(Math.abs(moved.x-start.x-60) < 2 && Math.abs(moved.y-start.y-20) < 2);
        await page.mouse.click(moved.x,moved.y); assert.equal(await page.evaluate(()=>GaiaMarineCod.getState().selectedId),tokyo.id);
      } else {
        await zoomButton(mobile, "out");
        const previous=await zoom(), c=await projected(tokyo), cdp=await context.newCDPSession(page);
        const touch = (x,y,id) => ({x,y,id,radiusX:2,radiusY:2});
        await cdp.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[touch(c.x-30,c.y,0),touch(c.x+30,c.y,1)]});
        await cdp.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[touch(c.x-55,c.y,0),touch(c.x+55,c.y,1)]});
        await cdp.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
        assert(await zoom() > previous, "Real browser two-finger pinch works above old cap");
      }
      // Identical source coordinates remain separately available without jitter.
      const duplicates=rows.filter((row,i)=>rows.some((other,j)=>i!==j && row.lon===other.lon && row.lat===other.lat));
      if (duplicates.length) {
        const first=duplicates[0], second=duplicates.find(row=>row.id!==first.id && row.lon===first.lon && row.lat===first.lat);
        await page.locator("[data-cod-prefecture]").selectOption(first.prefCode);
        await page.locator("[data-cod-station]").selectOption(first.id); await idle();
        assert(await page.locator(`[data-cod-station] optgroup:first-of-type option[value='${second.id}']`).count());
        await page.locator("[data-cod-station]").selectOption(second.id); await idle();
        assert.equal(await page.evaluate(()=>GaiaMarineCod.getState().selectedId), second.id);
      }
      if (mobile) { await page.locator('[data-mobile-sheet="reading"]').click(); assert.match(await page.locator("#map-mobile-sheet").innerText(), /BOD（生物化学的酸素要求量）/); await page.screenshot({path:path.join(output,`${width}-explanation.png`)}); await page.locator("[data-mobile-sheet-close]").click(); }
      else { await page.locator(".gaia-marine-cod-legend summary").click(); assert.match(await page.locator(".gaia-cod-guide").innerText(), /BOD（生物化学的酸素要求量）/); await page.screenshot({path:path.join(output,`${width}-explanation.png`)}); }
      await page.locator("[data-cod-overview]").click(); await idle(); assert(await zoom() < 10);
      // Switching providers returns the ordinary 8x limit.
      await page.evaluate(() => GaiaMapCategories.buttons().find(node=>Number(node.textContent)===6).click()); await idle();
      await page.evaluate(() => GaiaMapObservationAdapter.zoomEarthBy(100)); assert.equal(await zoom(),8);
      assert.equal(await page.locator(".gaia-marine-cod-legend").isVisible(),false);
      if (!mobile) {
        await page.evaluate(()=>GaiaMapCategories.buttons().find(node=>Number(node.textContent)===31).click()); await idle();
        await page.waitForFunction(()=>!document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
        await page.locator("[data-cod-step='-1']").click();
        await page.waitForFunction(()=>Number(document.querySelector("#japan-mode-number").textContent)===30);
        await page.evaluate(()=>GaiaMapCategories.buttons().find(node=>Number(node.textContent)===31).click()); await idle();
        await page.waitForFunction(()=>!document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
        await page.locator("[data-cod-step='1']").click();
        await page.waitForFunction(()=>Number(document.querySelector("#japan-mode-number").textContent)===32);
      }
    }
    report.checks.push({width,height,dock,legend,exposedOverviewStations:exposed,result:"passed"});
    console.log(`PASS COD UI ${width}x${height}: dock, reachable controls, visible legend${[1440,390].includes(width)?", 512x dense picking, zoom/pan/pinch and provider limit":""}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status="passed";
} catch(error) {
  report.status="failed"; report.failure=error.stack;
  if(page && !page.isClosed()) await page.screenshot({path:path.join(output,"failure.png")}).catch(()=>{});
  throw error;
} finally { fs.writeFileSync(path.join(output,"report.json"),JSON.stringify(report,null,2)); await browser.close(); }
