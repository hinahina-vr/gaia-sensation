import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const runtime = read("novel-mode.js");
const css = read("novel-mode.css");
const timings = { EXIT_COVER: 215, EXIT_HOLD: 250, EXIT_REVEAL: 2700, ENTRY_BACKGROUND_HOLD: 120 };
for (const [name, duration] of Object.entries(timings)) assert(runtime.includes(`const STAFF_ROLL_${name}_MS = ${duration};`));
assert.equal(Object.values(timings).reduce((sum, duration) => sum + duration, 0), 3285);
assert.match(css, /novel-staff-roll-exit-cover 215ms/u);
assert.match(css, /novel-staff-roll-exit-reveal 2700ms/u);
assert.match(css, /novel-staff-roll-depart 180ms/u);
assert.match(css, /background-size: 128px 128px/u);
assert.match(css, /ending-static-noise\.svg/u);
assert.match(read("assets/effects/ending-static-noise.svg"), /feTurbulence.*numOctaves="1"/u);
assert.match(runtime, /if \(!motionReduced\(\)\) \{\s*const noise = document\.createElement\("div"\);/u);
assert.match(runtime, /launchTrueEnd\(\{ onReady: revealTrueEnd, deferInterfaceReveal: true \}\)/u);
assert.doesNotMatch(css, /novel-staff-roll-exit-strobe/u);
for (const effect of ["depart", "exit-bands", "exit-dropout", "exit-noise"]) {
  const start = css.indexOf(`@keyframes novel-staff-roll-${effect}`);
  assert(start > 0, `Missing ${effect}`);
  const frames = css.slice(start, css.indexOf("\n}", start));
  assert.doesNotMatch(frames, /translateY|translate\(|translate3d/u, `${effect} must never move vertically`);
  assert.match(frames, /translateX\(var\(--glitch-/u, `${effect} does not use per-burst randomness`);
}
const window = { matchMedia: () => ({ matches: false }) };
vm.runInNewContext(read("ending-glitch.js"), { window });
const samples = [];
for (let run = 0; run < 30; run++) {
  const properties = {};
  window.GaiaEndingGlitch.randomize({ style: { setProperty: (key, value) => { properties[key] = value; } } });
  samples.push(properties);
  for (const [layer, amplitude, durationMin, durationMax] of [["stage", 32, 155, 180], ["bands", 12, 170, 210], ["dropout", 19, 140, 200], ["noise", 56, 155, 210]]) {
    const duration = parseFloat(properties[`--glitch-${layer}-duration`]);
    assert(duration >= durationMin && duration <= durationMax);
    for (let index = 1; index <= 8; index++) assert(Math.abs(parseFloat(properties[`--glitch-${layer}-x${index}`])) <= amplitude);
  }
}
assert.equal(new Set(samples.map(sample => JSON.stringify(sample))).size, 30, "Repeated bursts use an identical sequence");
assert(new Set(samples.map(sample => sample["--glitch-noise-duration"])).size > 5, "Noise cadence never varies");
window.matchMedia = () => ({ matches: true });
window.GaiaEndingGlitch.randomize({ style: { setProperty: () => assert.fail("Reduced motion must not start a glitch") } });
assert.match(runtime, /if \(!motionReduced\(\)\) window\.GaiaEndingGlitch\?\.randomize\(layer\)/u);
assert.match(runtime, /window\.GaiaEndingGlitch\?\.randomize\(veil\)/u);
assert.match(read("gaia-mode-loader.js"), /ending-glitch\.js[^\n]*\n\s*"\.\/novel-mode\.js/u);
console.log("True-end transition passed: existing horizontal-only bursts, 2.7-second reveal, 3.285-second choreography and reduced-motion/ready guards.");
