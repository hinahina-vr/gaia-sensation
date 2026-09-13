import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const images = [
  ["novel-bg-zushi-coast-autumn-day-v3.png", "brochure-coast-v1.webp", 1200],
  ["sound-archive-bg-v2.png", "brochure-sound-v1.webp", 960],
  ["event-cg-circle-welcome-v2.png", "brochure-meet-v1.webp", 960],
];

// Format/size conversion only: preserve the complete existing illustration.
// Sources and reuse are documented in docs/CONCEPT_PAGE_2026-09-07.md.
for (const [source, output, width] of images) {
  const result = await sharp(path.join(root, "assets/visuals-07", source))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6 })
    .toFile(path.join(root, "assets/concept", output));
  console.log(JSON.stringify({ source, output, ...result }));
}
