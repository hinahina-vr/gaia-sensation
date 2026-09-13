import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const [input, output, widthArg, heightArg] = process.argv.slice(2);

if (!input || !output) {
  throw new Error("usage: node scripts/install-generated-image.mjs <input> <output> [width height]");
}

const dependencyRoot = process.env.CODEX_NODE_MODULES;
if (!dependencyRoot) {
  throw new Error("CODEX_NODE_MODULES must point to the bundled Node dependency directory");
}

const require = createRequire(path.join(dependencyRoot, "package.json"));
const sharp = require("sharp");
const width = widthArg ? Number.parseInt(widthArg, 10) : undefined;
const height = heightArg ? Number.parseInt(heightArg, 10) : undefined;

await fs.mkdir(path.dirname(output), { recursive: true });

let pipeline = sharp(input);
if (width && height) {
  pipeline = pipeline.resize(width, height, { fit: "cover", position: "centre" });
}

const extension = path.extname(output).toLowerCase();
if (extension === ".webp") {
  pipeline = pipeline.webp({ quality: 92, smartSubsample: true });
} else if (extension === ".png") {
  pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
} else {
  throw new Error(`unsupported output extension: ${extension}`);
}

await pipeline.toFile(output);
