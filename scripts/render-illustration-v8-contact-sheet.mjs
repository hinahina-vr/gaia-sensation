import { createRequire } from "node:module";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const dependencyRoot = process.env.CODEX_NODE_MODULES;
const require = dependencyRoot
  ? createRequire(path.join(dependencyRoot, "package.json"))
  : createRequire(import.meta.url);
const sharp = require("sharp");

const root = process.cwd();
const [sourceArg = "assets/characters", outputArg = "artifacts/illustration-v8-contact-sheet.png"] = process.argv.slice(2);
const source = path.resolve(root, sourceArg);
const output = path.resolve(root, outputArg);
const supported = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const files = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && supported.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort();

if (!files.length) throw new Error(`No images found in ${source}`);

const columns = 4;
const tileWidth = 420;
const tileHeight = 300;
const labelHeight = 48;
const gap = 18;
const rows = Math.ceil(files.length / columns);
const width = columns * tileWidth + (columns + 1) * gap;
const height = rows * (tileHeight + labelHeight) + (rows + 1) * gap;
const composites = [];

for (const [index, file] of files.entries()) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const left = gap + column * (tileWidth + gap);
  const top = gap + row * (tileHeight + labelHeight + gap);
  const image = await sharp(path.join(source, file))
    .resize(tileWidth, tileHeight, { fit: "contain", background: "#eef6fb" })
    .png()
    .toBuffer();
  const label = Buffer.from(`
    <svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#102431"/>
      <text x="16" y="31" fill="#f7fbff" font-family="Segoe UI, sans-serif" font-size="16">${file.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text>
    </svg>`);
  composites.push({ input: image, left, top });
  composites.push({ input: label, left, top: top + tileHeight });
}

await mkdir(path.dirname(output), { recursive: true });
await sharp({
  create: {
    width,
    height,
    channels: 3,
    background: "#d8e8f1",
  },
}).composite(composites).png().toFile(output);

console.log(output);
