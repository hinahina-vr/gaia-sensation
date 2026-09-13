import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const dependencyRoot = process.env.CODEX_NODE_MODULES;
if (!dependencyRoot) throw new Error("CODEX_NODE_MODULES must point to the bundled Node dependency directory");
const require = createRequire(path.join(dependencyRoot, "package.json"));
const sharp = require("sharp");

const spriteFiles = [
  "amane-calm-07-v3.png", "amane-exasperated-07-v3.png", "amane-soft-07-v3.png", "amane-startled-07-v3.png",
  "mizuha-calm-07-v2.png", "mizuha-sad-07-v2.png", "mizuha-teasing-07-v2.png", "mizuha-worried-07-v2.png",
  "sakuya-calm-07-v1.png", "sakuya-sad-07-v1.png", "sakuya-teasing-07-v1.png", "sakuya-worried-07-v1.png",
];

const sceneFiles = [
  "event-cg-amane-closeup-five-plane-v4.png",
  "event-cg-circle-invitation-card-v3.png",
  "event-cg-circle-welcome-v2.png",
  "event-cg-esp32-collaboration-v2.png",
  "event-cg-exhibition-finale-sunset-v1.png",
  "event-cg-festival-map-transition-five-plane-v3.png",
  "event-cg-first-encounter-five-plane-v3.png",
  "event-cg-mizuha-closeup-five-plane-v3.png",
  "gateway-keyvisual-v2.png",
  "mode-abstract-v1.webp",
  "mode-map-v1.webp",
  "novel-background-v1.webp",
  "novel-bg-coastal-venue-autumn-morning-v1.png",
  "novel-bg-convention-hall-entrance-autumn-morning-v2.png",
  "novel-bg-coastal-venue-v3.png",
  "novel-bg-exhibition-autumn-morning-close-v4.png",
  "novel-bg-exhibition-autumn-morning-wide-v4.png",
  "novel-bg-exhibition-v2.png",
  "novel-bg-exhibition-v3.png",
  "novel-bg-festival-b-hall-autumn-morning-v1.png",
  "novel-bg-festival-b-hall-overview-v1.png",
  "novel-bg-festival-five-plane-projection-autumn-morning-v2.png",
  "novel-bg-festival-five-plane-projection-v1.png",
  "novel-bg-gx-ancient-ocean-autumn-morning-v3.png",
  "novel-bg-gx-ancient-ocean-five-plane-v1.png",
  "novel-bg-gx-breathing-points-autumn-morning-v3.png",
  "novel-bg-gx-breathing-points-five-plane-v1.png",
  "novel-bg-gx-mode-gateway-autumn-morning-v4.png",
  "novel-bg-gx-mode-gateway-five-plane-v2.png",
  "novel-bg-gx-temperature-anomaly-autumn-morning-v3.png",
  "novel-bg-gx-temperature-anomaly-five-plane-v1.png",
  "novel-bg-map01-data-provenance-autumn-morning-v3.png",
  "novel-bg-map01-data-provenance-five-plane-v1.png",
  "novel-bg-zushi-coast-autumn-day-v3.png",
  "novel-bg-zushi-coast-night-v2.png",
  "novel-title-keyvisual-v3.png",
  "opening-keyvisual-v2.png",
];

const mobileSceneFiles = [
  "event-cg-first-encounter-five-plane-mobile-v2.png",
  "event-cg-festival-map-transition-five-plane-mobile-v1.png",
  "event-cg-esp32-collaboration-mobile-v1.png",
  "event-cg-circle-invitation-card-mobile-v1.png",
  "event-cg-circle-welcome-mobile-v1.png",
  "event-cg-exhibition-finale-sunset-mobile-v1.png",
  "novel-title-keyvisual-mobile-v1.png",
];

const report = { sprites: [], scenes: [] };

for (const file of spriteFiles) {
  const filePath = path.join(root, "assets", "characters", file);
  const metadata = await sharp(filePath).metadata();
  assert(metadata.width >= 800 && metadata.height >= 1500, `${file}: sprite resolution is too small`);
  assert(metadata.hasAlpha, `${file}: transparent alpha channel is missing`);
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
  const corners = [alphaAt(0, 0), alphaAt(info.width - 1, 0), alphaAt(0, info.height - 1), alphaAt(info.width - 1, info.height - 1)];
  assert(corners.every((alpha) => alpha === 0), `${file}: opaque chroma-key residue remains at a corner`);
  report.sprites.push({ file, width: metadata.width, height: metadata.height, corners });
}

for (const file of sceneFiles) {
  const filePath = path.join(root, "assets", "visuals-07", file);
  const metadata = await sharp(filePath).metadata();
  report.scenes.push({ file, width: metadata.width, height: metadata.height, format: metadata.format });
}

const sceneDimensionFailures = report.scenes.filter(({ width, height }) => width !== 1672 || height !== 941);
assert.deepEqual(sceneDimensionFailures, [], `scene dimensions changed: ${JSON.stringify(sceneDimensionFailures)}`);

for (const file of mobileSceneFiles) {
  const metadata = await sharp(path.join(root, "assets", "visuals-07", file)).metadata();
  assert.equal(metadata.width, 941, `${file}: mobile width changed`);
  assert.equal(metadata.height, 1672, `${file}: mobile height changed`);
  report.scenes.push({ file, width: metadata.width, height: metadata.height, format: metadata.format, mobile: true });
}

await fs.mkdir(path.join(root, "artifacts"), { recursive: true });
await fs.writeFile(path.join(root, "artifacts", "illustration-v8-assets-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Illustration v8 assets passed: ${report.sprites.length} sprites, ${report.scenes.length} scenes`);
