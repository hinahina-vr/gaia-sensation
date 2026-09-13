import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error("Usage: node scripts/chroma-key-sprite.mjs <input> <output>");
}

const input = path.resolve(process.cwd(), inputArg);
const output = path.resolve(process.cwd(), outputArg);
const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const pixels = Buffer.alloc(info.width * info.height * 4);
const alphas = new Float32Array(info.width * info.height);
// ImageGen can render the requested #FF00FF as a slightly graded hot magenta.
// A channel-dominance key is therefore more reliable than an exact RGB key.
const transparentDominance = 190;
const opaqueDominance = 30;
const background = { red: 249, green: 7, blue: 231 };
const backgroundAlphaFloor = 0.42;

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

for (let source = 0, pixel = 0; source < data.length; source += 3, pixel += 1) {
  const red = data[source];
  const green = data[source + 1];
  const blue = data[source + 2];
  const magentaDominance = Math.min(red - green, blue - green);
  const alpha = Math.max(0, Math.min(1,
    (transparentDominance - magentaDominance) / (transparentDominance - opaqueDominance),
  ));
  alphas[pixel] = alpha < backgroundAlphaFloor ? 0 : alpha;
}

const nearestOpaqueColor = (pixel) => {
  const x = pixel % info.width;
  const y = Math.floor(pixel / info.width);
  for (let radius = 1; radius <= 5; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
        const neighborX = x + offsetX;
        const neighborY = y + offsetY;
        if (neighborX < 0 || neighborY < 0 || neighborX >= info.width || neighborY >= info.height) continue;
        const neighbor = neighborY * info.width + neighborX;
        if (alphas[neighbor] < 0.995) continue;
        const source = neighbor * 3;
        return [data[source], data[source + 1], data[source + 2]];
      }
    }
  }
  return null;
};

for (let source = 0, target = 0, pixel = 0; source < data.length; source += 3, target += 4, pixel += 1) {
  const red = data[source];
  const green = data[source + 1];
  const blue = data[source + 2];
  const alpha = alphas[pixel];

  if (alpha <= 0.001) {
    pixels[target] = 0;
    pixels[target + 1] = 0;
    pixels[target + 2] = 0;
    pixels[target + 3] = 0;
    continue;
  }

  const edgeColor = alpha < 0.995 ? nearestOpaqueColor(pixel) : null;
  const inverse = 1 - alpha;
  pixels[target] = edgeColor?.[0] ?? clamp((red - inverse * background.red) / alpha);
  pixels[target + 1] = edgeColor?.[1] ?? clamp((green - inverse * background.green) / alpha);
  pixels[target + 2] = edgeColor?.[2] ?? clamp((blue - inverse * background.blue) / alpha);
  pixels[target + 3] = clamp(alpha * 255);
}

await sharp(pixels, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  },
}).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(output);

console.log(output);
