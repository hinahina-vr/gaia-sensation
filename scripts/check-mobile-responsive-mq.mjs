import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const html = read("index.html");
const novelCss = read("novel-mode.css");
const css = read("styles.css");
const story = read("novel-story-data.js");

assert(html.includes("styles.css?v=gaia-mobile-responsive-1"));
assert(html.includes("novel-mode.css?v=gaia-mobile-responsive-1"));
assert.match(novelCss, /@media \(max-width: 720px\)[\s\S]*?\.novel-nav-label\s*\{\s*font-size:\s*8px;/u);
assert.match(novelCss, /\.novel-layer\.is-title \.novel-title-screen\s*\{\s*bottom:\s*max\(64px,/u);
assert.match(novelCss, /\.novel-save-header > button,[\s\S]*?\.novel-gallery-header > button\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/u);
assert.match(css, /grid-template-columns:\s*repeat\(5, 44px\);/u);
assert.match(css, /\.mode-button\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/u);
assert.match(css, /#concept-open,[\s\S]*?#intro-button\s*\{\s*min-height:\s*44px;/u);
assert.equal((story.match(/["']id["']:\s*["']map_mode01_004["']/gu) || []).length, 1);
assert.equal((story.match(/["']id["']:\s*["']gx_experience_017["']/gu) || []).length, 1);
assert(!html.includes("sensor-platform"));
console.log("mobile responsive MQ static check passed: 8/8");
