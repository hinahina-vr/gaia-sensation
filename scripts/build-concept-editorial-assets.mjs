import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "artifacts/concept-page-v7/source");
const assets = [
  ["earth-emblem", "earth", 640, 88, true],
  ["field-ribbon", "ribbon", 1800, 88, true],
  ["learning-desk", "learning", 1440, 86, false],
  ["deep-archive", "archive", 1800, 88, false],
];
const report = { mode: "built-in ImageGen", operation: "resize and WebP encoding only; original PNGs retained", assets: [] };
for (const [sourceName, assetName, width, quality, transparent] of assets) {
  const source = path.join(sourceDirectory, `${sourceName}-v1.png`);
  const destination = `assets/concept/brochure-ornament-${assetName}-v1.webp`;
  const input = await sharp(source).metadata();
  if (transparent) assert(input.hasAlpha, `${sourceName} must have generated transparency`);
  const output = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toFile(path.join(root, destination));
  const metadata = await sharp(path.join(root, destination)).metadata();
  const stats = transparent ? await sharp(path.join(root, destination)).stats() : null;
  if (transparent) {
    assert(metadata.hasAlpha, "Preserve the original generated alpha channel");
    assert.equal(stats.channels[3].min, 0, "The cutout must include fully transparent pixels");
    assert.equal(stats.channels[3].max, 255, "The illustration itself must remain opaque");
  }
  report.assets.push({ source: path.relative(root, source).split(path.sep).join("/"), destination, input: { width: input.width, height: input.height, hasAlpha: input.hasAlpha }, output, hasAlpha: metadata.hasAlpha, alphaRange: stats ? [stats.channels[3].min, stats.channels[3].max] : null, sha256: createHash("sha256").update(fs.readFileSync(path.join(root, destination))).digest("hex") });
}
fs.writeFileSync(path.join(sourceDirectory, "conversion-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
