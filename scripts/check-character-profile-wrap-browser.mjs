import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/character-profile-wrap");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const expectedLines = {
  mizuha: [
    "海色の長い髪とおっとりした丁寧語が印象的な大学2年生。",
    "大気と水系の循環に関心を持ち、観測データの科学考証と、",
    "地球の動態を読み解くストーリーテリングを担当する。",
    "物腰は穏やかだが、データの出典や数字の正確さ、",
    "観測条件の厳密さには決して妥協しない。",
  ],
  sakuya: [
    "海外からオンラインで参加するサークルのプロデューサー。",
    "普段のチャットでは無駄口を叩かないが、作品の構想や",
    "システムデザインの議論では、圧倒的な解像度を発揮する。",
    "『GAIA SENSEWARE』の名付け親であり、",
    "プロジェクトの骨格を支えるシステムアーキテクト。",
  ],
};
const expected = {
  amane: "水色のショートボブと眠そうな目元が特徴の大学2年生。普段は無口で省エネ運転だが、電気やエネルギーの話になると途端にスイッチが入る。電気工事士・電気主任技術者の資格を持ち、現場の機材設営から安全管理までを一手に担う実践派。",
  mizuha: expectedLines.mizuha.join(""),
  sakuya: expectedLines.sakuya.join(""),
};
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let currentPage;
try {
  for (const width of [1440, 1920, 2560, 3840, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 3840 ? 2160 : width === 2560 ? 1440 : width < 720 ? 844 : 1080 },
      reducedMotion: width === 1440 ? "no-preference" : "reduce",
    });
    const page = await context.newPage();
    currentPage = page;
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/#character`, { waitUntil: "domcontentloaded" });
    await page.locator(".character-book-selector").waitFor({ state: "visible" });
    for (const id of Object.keys(expected)) {
      await page.locator(`[data-character-select="${id}"]`).click();
      await page.waitForFunction(text => document.querySelector("#character-book-profile")?.textContent.replaceAll("\u00a0", " ") === text, expected[id]);
      await page.waitForTimeout(width === 1440 ? 2200 : 80);
      const scan = await page.locator("#character-book-profile").evaluate(profile => {
        const box = profile.getBoundingClientRect();
        const sentences = [...profile.children].map(sentence => {
          const rows = new Map();
          for (const glyph of sentence.querySelectorAll(".character-book-letter")) {
            const y = Math.round(glyph.getBoundingClientRect().y);
            rows.set(y, (rows.get(y) || "") + glyph.textContent.replaceAll("\u00a0", " "));
          }
          return [...rows.values()];
        });
        return {
          text: profile.textContent.replaceAll("\u00a0", " "), label: profile.getAttribute("aria-label"), sentences,
          overflow: profile.scrollWidth - profile.clientWidth,
          bottom: box.bottom, expressionTop: document.querySelector(".character-book-expressions").getBoundingClientRect().top,
          glyphCount: profile.querySelectorAll(".character-book-letter").length,
          phrases: [...profile.querySelectorAll(".character-book-profile-phrase")].map(phrase => {
            const rect = phrase.getBoundingClientRect();
            const rows = new Set([...phrase.children].map(glyph => Math.round(glyph.getBoundingClientRect().y)));
            return { text: phrase.textContent, rows: rows.size, inside: rect.x >= box.x - 1 && rect.right <= box.right + 1 };
          }),
          animation: getComputedStyle(profile.querySelector(".character-book-letter")).animationName,
          inFrontOfPortrait: Number(getComputedStyle(profile.closest(".character-book-hero-detail")).zIndex)
            > Number(getComputedStyle(document.querySelector(".character-book-hero-figure")).zIndex),
        };
      });
      report.checks.push({ width, id, ...scan });
      assert.equal(scan.text, expected[id]);
      assert.equal(scan.label, expected[id], "Accessible copy changed");
      assert.equal(scan.glyphCount, Array.from(expected[id]).length, "Letter reveal lost characters");
      assert.equal(scan.animation, "character-letter-in");
      assert(scan.inFrontOfPortrait, `${width}/${id}: portrait covers biography`);
      assert.equal(scan.sentences.length, id === "amane" ? 3 : 5);
      if (expectedLines[id]) {
        assert.deepEqual(scan.sentences.flat(), expectedLines[id], `${width}/${id}: profile must fit the five supplied lines`);
      }
      assert(scan.overflow <= 1, `${width}/${id}: profile overflowed`);
      assert(scan.bottom < scan.expressionTop, `${width}/${id}: profile overlaps expression controls`);
      for (const phrase of scan.phrases) {
        assert.equal(phrase.rows, 1, `${width}/${id}: phrase split: ${phrase.text}`);
        assert(phrase.inside, `${width}/${id}: phrase outside column: ${phrase.text}`);
      }
      for (const line of scan.sentences.flat()) {
        assert(!/^[、。』」）]/u.test(line), `${width}/${id}: closing mark starts a line`);
        assert(!/[『「（]$/u.test(line), `${width}/${id}: opening mark ends a line`);
      }
      await page.locator("#character-book-profile").screenshot({ path: path.join(output, `${width}-${id}-profile.png`) });
      if ([1440, 390].includes(width) && id === "sakuya") {
        await page.screenshot({ path: path.join(output, `${width}-layout.jpg`), type: "jpeg", quality: 85 });
      }
    }
    console.log(`PASS ${width}: exact revised copy in five lines, Amane unchanged, punctuation and letter reveal`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  await currentPage?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
