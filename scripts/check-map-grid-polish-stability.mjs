import fs from "node:fs";

const source = fs.readFileSync(new URL("../map-ui-grid-polish.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../map-ui-grid-polish.css", import.meta.url), "utf8");
const loader = fs.readFileSync(new URL("../gaia-mode-loader.js", import.meta.url), "utf8");
const browserChecker = fs.readFileSync(new URL("./check-map-gx-p1-browser.mjs", import.meta.url), "utf8");

const checks = [
  ["map panels use stable scoped selectors", ["japan-heading", "map-mode-bank", "signal-console-map"].every((name) => source.includes(`:scope > .${name}`))],
  ["command dock mounts once", /japanLayer\.querySelector\("\.map-command-dock"\)/.test(source)],
  ["existing mode groups move into the dock popover", /bankPopover\.append\(modeGroups\)/.test(source)],
  ["source and statistics controls proxy their canonical buttons", /target\?\.click\(\)/.test(source)],
  ["bank and guide panels are mutually exclusive", /if \(shouldOpen\) guide\.open = false/.test(source) && /if \(guide\.open && innerWidth >= DESKTOP_MIN\) setBankOpen\(false\)/.test(source)],
  ["schedule coalesces without cancel/requeue", /if \(scheduled\) return;\s*scheduled = requestAnimationFrame\(measureLayout\)/.test(source)],
  ["desktop dock is fixed to the bottom", /body\.map-grid-desktop \.map-command-dock[\s\S]*position: fixed[\s\S]*bottom: 0/.test(styles)],
  ["mobile keeps the legacy flow", /@media \(max-width: 900px\)[\s\S]*\.map-command-dock\s*{\s*display: contents/.test(styles)],
  ["live exhibits collapse irrelevant dock cells", /is-live-exhibit \.map-command-dock > :is\(\.signal-console-map, \.map-reading-guide\)[\s\S]*display: none !important/.test(styles)],
  ["standard chapter has previous and next controls", /makeBankStep\(-1[\s\S]*makeBankStep\(1/.test(source) && /stepBankMode/.test(source)],
  ["all chapter centers open the shared selector", /data-map-bank-toggle/.test(source) && /pickerTrigger\(\)\?\.click/.test(source)],
  ["desktop map guide follows transient focus intent", /is-dock-guide-visible/.test(source) && /pointerenter/.test(source) && /focusin/.test(source) && /pointerleave/.test(source) && /focusout/.test(source)],
  ["desktop map guide keeps its readable, restrained fade", /map-reading-guide-body[\s\S]*opacity 200ms ease/.test(styles) && /font: 400 clamp\(15px, \.9vw, 16px\)\/1\.85 var\(--font-ui-ja\)/.test(styles)],
  ["map POIs advertise hover interactivity", /\.japan-map\.has-poi-hover:not\(\.is-dragging\)[\s\S]*cursor: pointer/.test(styles)],
  ["map POI preview has a restrained focus transition", /\.japan-poi-preview\.is-visible/.test(styles) && /japan-poi-preview-glint/.test(styles)],
  ["command dock assets use the current cache key", ["map-ui-grid-polish.css?v=gaia-place-picker-1", "map-ui-grid-polish.js?v=gaia-story-map-dock-1"].every((asset) => loader.includes(asset))],
  ["dock motion loads after the mobile shell", loader.includes("map-dock-motion.js?v=gaia-map-dock-motion-1") && loader.indexOf("map-dock-motion.js") > loader.indexOf("map-mobile-shell.js")],
  ["browser checker samples the exact map panel", /#japan-layer > \.signal-console-map/.test(browserChecker)],
  ["browser checker requires 1200 samples", /polishTrace\.frames >= 1200/.test(browserChecker)],
  ["browser checker rejects marker churn", /markerMutations, 0/.test(browserChecker)],
];

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failures.length) throw new Error(`map grid polish stability check failed: ${failures.join(", ")}`);
console.log(`map grid polish stability check passed: ${checks.length}/${checks.length}`);
