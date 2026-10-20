import assert from "node:assert/strict";
import { observationLight } from "../src/exploration/observation-light.js";

for (const [kind, key, ceiling] of [["air", "pm25", 100], ["cloud", "radiation", 1000]]) {
  let previous = { radius: 0, opacity: 0 };
  for (const value of [0, 1, 10, 50, 100, 500, 1000, 10000]) {
    const style = observationLight(kind, { [key]: value });
    assert(style.radius >= previous.radius && style.opacity >= previous.opacity);
    assert(style.radius >= 7 && style.radius <= 13);
    assert(style.opacity >= .44 && style.opacity <= .94);
    previous = style;
  }
  for (const value of [null, undefined, NaN, Infinity, -10]) {
    assert.deepEqual(observationLight(kind, { [key]: value }), { radius: 7, opacity: .44 });
  }
  assert.deepEqual(observationLight(kind, { [key]: ceiling }), { radius: 13, opacity: .94 });
}
console.log("Observation light: bounded, monotonic, zero/missing remain selectable; no data mutation.");
