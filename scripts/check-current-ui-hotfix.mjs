import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const css = read("novel-mode.css");
const novel = read("novel-mode.js");
const openingCss = read("opening.css");
const opening = read("opening.js");
const builder = read("scripts/build-novel-story.mjs");
const canon = read("story/物語台本.md");
const retained = read("contest-limited/story/limited-feature-script.md");
const characterCanon = read("story/CHARACTER_SETTINGS.md");
const gx = read("gx-mode.js");
const generatedBefore = read("novel-story-data.js");
await import(`${pathToFileURL(path.join(root, "novel-story-data.js")).href}?hotfix=${Date.now()}`);
const generatedStory = globalThis.GAIA_NOVEL_STORY;
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, passed: true }); };

check("EVES/footer hidden without data removal", () => {
  assert.match(html, /id="novel-eves-button"[^>]*aria-hidden="true"[^>]*tabindex="-1"[^>]*disabled[^>]*hidden/u);
  assert.match(html, /id="novel-eves-panel"[^>]*inert[^>]*hidden/u);
  assert.match(css, /#novel-eves-button,[\s\S]*\.novel-footer-location\s*\{[\s\S]*display:\s*none\s*!important/u);
  assert.match(novel, /evesRoute/u);
  assert.match(html, /CLICK \/ SPACE — NEXT/u);
});

check("changed runtime assets use the current cache keys", () => {
  assert.match(html, /opening\.css\?v=gaia-opening-route-cards-1/u);
  assert.match(html, /opening\.js\?v=gaia-opening-route-cards-1/u);
  assert.match(html, /novel-mode\.css\?v=gaia-ending-action-delay-1/u);
  assert.match(html, /novel-mode\.js\?v=gaia-ending-action-delay-1/u);
  assert.match(html, /gx-mode\.js\?v=gaia-gx-auto-return-1/u);
  assert.match(html, /novel-story-data\.js\?v=gaia-script-natural-copy-1/u);
});

check("SAVE whole-card and hidden-scrollbar contract", () => {
  assert.match(novel, /article\.setAttribute\("role", "button"\)/u);
  assert.match(novel, /article\.addEventListener\("click"/u);
  assert.match(novel, /event\.key !== "Enter" && event\.key !== " "/u);
  assert.match(css, /\.novel-save-panel\s*\{[^}]*scrollbar-width:\s*none/u);
  assert.match(css, /\.novel-save-slots\s*\{[^}]*scrollbar-gutter:\s*auto/u);
  assert.match(css, /\.novel-save-slots::-webkit-scrollbar\s*\{[^}]*display:\s*none/u);
});

check("opening sound setup owns the first frame and blocks cinematic start", () => {
  assert.match(html, /novel-start-button[^>]*aria-label="はじめる">はじめる</u);
  assert.equal(html.includes('id="gaia-opening-sound-gate"'), false);
  assert.match(html, /class="gaia-opening is-preloading is-awaiting-sound"/u);
  assert.match(html, /id="gaia-opening-final-menu"[\s\S]*id="gaia-opening-route-story"[\s\S]*id="gaia-opening-route-other"/u);
  assert.match(html, /id="gaia-opening-sound-modal"[\s\S]*role="dialog"[\s\S]*id="gaia-opening-sound-on"[\s\S]*id="gaia-opening-sound-off"/u);
  assert.equal(html.includes('id="gaia-opening-sound-start"'), false);
  assert.equal(/id="gaia-opening-final-menu"[\s\S]*class="gaia-opening-menu-audio"[\s\S]*id="gaia-opening-sound-modal"/u.test(html), false);
  assert.match(html, /gaia-opening-sound-on[^>]*aria-pressed="false"/u);
  assert.match(openingCss, /\.gaia-opening-menu-audio\s*\{/u);
  assert.match(openingCss, /\.gaia-opening-sound-modal\s*\{/u);
  assert.match(openingCss, /\.gaia-opening\.is-sound-modal-open \.gaia-opening-final-menu\.is-visible/u);
  assert.match(openingCss, /gaia-opening-sound-actions button\[aria-pressed="true"\]\s*\{[^}]*border-color:\s*transparent\s*!important[^}]*background:\s*transparent\s*!important[^}]*box-shadow:\s*none\s*!important/u);
  assert.match(opening, /finalMenu\.inert = true/u);
  assert.match(opening, /await chooseSound\(pendingSoundEnabled\)/u);
  assert.match(opening, /soundOnButton\?\.addEventListener\("click", \(\) => void confirmSoundSetup\(true\)\)/u);
  assert.match(opening, /soundOffButton\?\.addEventListener\("click", \(\) => void confirmSoundSetup\(false\)\)/u);
  assert.match(opening, /soundSetupConfirmed = true;[\s\S]*opening\.classList\.remove\("is-awaiting-sound"\);[\s\S]*hideSoundModal\(\);/u);
  assert.match(opening, /if \(!soundSetupConfirmed \|\| !preloadReady \|\| openingStarted\) return;/u);
  assert.match(opening, /showSoundModal\(\);\s*updatePreload\(\);/u);
});

check("story isolation and opening retirement", () => {
  assert.match(novel, /const BASE_INTERFACE_SELECTOR/u);
  assert.match(novel, /opening\.setAttribute\("aria-hidden", "true"\)/u);
  assert.match(novel, /node\.inert = true;[\s\S]*node\.hidden = true/u);
  assert.match(opening, /gaia:novel-open/u);
  assert.match(opening, /particleSystem\.stop\(\)/u);
});

check("gallery typography follows archive hierarchy", () => {
  assert.match(css, /\.novel-gallery-header h2[\s\S]*Georgia, "Times New Roman", serif/u);
  for (const selector of ["novel-gallery-progress strong", "novel-gallery-card strong", "novel-gallery-card small", "novel-gallery-viewer strong"]) {
    assert.match(css, new RegExp(`\\.${selector.replace(/ /gu, "[\\s\\S]*?")}[^}]*font(?:-family)?:[^;}]*var\\(--novel-font\\)`, "u"));
  }
});

check("background is real, cover, and motionless", () => {
  const cues = read("novel-background-cues.js");
  assert.match(cues, /festival-convention-hall-entrance[^\n]*from:\s*1[^\n]*to:\s*7[^\n]*novel-bg-convention-hall-entrance-autumn-morning-v2\.png/u);
  assert.match(css, /data-background-motion[\s\S]*animation:\s*none\s*!important[\s\S]*background-size:\s*cover,\s*cover\s*!important[\s\S]*transform:\s*none\s*!important/u);
});

check("story footer metadata remains hidden", () => {
  assert.match(css, /#novel-eves-button,[\s\S]*#novel-eves-panel,[\s\S]*\.novel-footer-location\s*\{[^}]*display:\s*none\s*!important/u);
});

check("title omits promotional catchphrases", () => {
  assert.equal(html.includes("『今日、はじめまして。』"), false);
  assert.equal(html.includes("『記録にないことを、勝手に事実へ変えない。』"), false);
  assert.equal(html.includes('class="novel-title-sub"'), false);
});

check("campus name and formal-name canonical metadata", () => {
  assert.equal(canon, retained);
  assert.equal(canon.includes("あまあま"), false);
  assert.equal(generatedBefore.includes("あまあま"), false);
  assert.equal(novel.includes("あまあま"), false);
  assert.equal(gx.includes("あまあま"), false);
  assert.match(builder, /\["アマネ", "あめ"\]/u);
  assert.match(novel, /amane:\s*\{ name:\s*"あめ", formalName:\s*"雨音", reading:\s*"アマネ"/u);
  for (const exact of ["【雨音（アマネ）】", "【瑞葉（ミズハ）】", "【咲弥（サクヤ）】"]) assert.equal(characterCanon.split(exact).length - 1, 1);
  assert.match(novel, /INTRODUCTION_STEPS = Object\.freeze\(\{ amane: 21, mizuha: 23 \}\)/u);
  assert.match(novel, /ANONYMOUS_SPEAKER_NAMES = Object\.freeze\(\{ amane: "短髪の女性", mizuha: "長髪の女性" \}\)/u);
});

check("chat uses symbolic non-human icons", () => {
  for (const [speaker, symbol] of [["amane", "cloud"], ["mizuha", "water"], ["sakuya", "flower"], ["visitor", "green-apple"], ["bluecat", "green-apple"]]) {
    assert.match(novel, new RegExp(`${speaker}: Object\\.freeze\\(\\{ id: "${symbol}"`, "u"));
  }
  assert.match(novel, /avatar\.dataset\.symbol = symbol\?\.id \|\| "system"/u);
  assert.equal(/slack-avatar-(?:amane|mizuha|sakuya)[^}]*background-image/u.test(css), false);
  assert.match(css, /\.novel-slack-symbol\s*\{[^}]*object-fit:\s*cover/u);
  assert.equal(fs.existsSync(path.join(root, "assets", "visuals-07", "slack-symbol-blue-apple-v1.svg")), true);
});

check("generated story is current and structurally stable", () => {
  const sourceHash = crypto.createHash("sha256").update(Buffer.from(canon)).digest("hex");
  assert.match(builder, new RegExp(sourceHash, "u"));
  const story = generatedStory;
  assert.equal(story.scenes.length, 6);
  assert.equal(story.scenes.flatMap((scene) => scene.steps).length, 380);
  assert.deepEqual(story.characters, {
    amane: { formalName: "雨音", reading: "アマネ", campusName: "あめ" },
    mizuha: { formalName: "瑞葉", reading: "ミズハ", campusName: "みず" },
    sakuya: { formalName: "咲弥", reading: "サクヤ", campusName: "saku" },
  });
  const productionText = JSON.stringify(story);
  assert.equal(productionText.includes("あまあま"), false);
  assert.equal(productionText.includes("\"speaker\":\"amane\""), true);
});

const report = { status: "passed", checks, sceneCount: generatedStory?.scenes.length, stepCount: generatedStory?.scenes.flatMap((scene) => scene.steps).length };
console.log(JSON.stringify(report, null, 2));
