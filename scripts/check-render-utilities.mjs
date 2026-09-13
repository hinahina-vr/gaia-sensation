import assert from "node:assert/strict";
import { formatJapaneseNumber } from "../src/shared/number-format.js";
import { setAttributeIfChanged, setTextIfChanged, setStyleIfChanged } from "../src/shared/dom-updates.js";

// Keep coercion, signs, rounding, grouping, and non-finite output identical to
// the native formatter previously constructed at each call site.
let cases = 0;
for (const value of [-Infinity, -1234567.895, -1.005, -0, 0, 0.00001, 1.005, 1234567.895, Infinity, NaN]) {
  for (let maximumFractionDigits = 0; maximumFractionDigits <= 8; maximumFractionDigits++) {
    for (const minimumFractionDigits of new Set([0, maximumFractionDigits])) {
      assert.equal(formatJapaneseNumber(value, maximumFractionDigits, minimumFractionDigits),
        value.toLocaleString("ja-JP", { maximumFractionDigits, minimumFractionDigits }));
      cases++;
    }
  }
}

let attributeWrites = 0, textWrites = 0, styleWrites = 0;
const attributes = new Map(), styles = new Map();
let content = "";
const element = {
  getAttribute: name => attributes.get(name) ?? null,
  setAttribute(name, value) { attributes.set(name, value); attributeWrites++; },
  get textContent() { return content; },
  set textContent(value) { content = value; textWrites++; },
  style: {
    getPropertyValue: name => styles.get(name) || "",
    setProperty(name, value) { styles.set(name, value); styleWrites++; },
  },
};
for (let frame = 0; frame < 180; frame++) {
  setAttributeIfChanged(element, "aria-current", false);
  setTextIfChanged(element, "欠測");
  setStyleIfChanged(element, "--estat-strength", "0.000");
}
assert.deepEqual([attributeWrites, textWrites, styleWrites], [1, 1, 1]);
attributes.set("aria-current", "true"); content = "external update"; styles.set("--estat-strength", "1.000");
setAttributeIfChanged(element, "aria-current", false);
setTextIfChanged(element, "欠測");
setStyleIfChanged(element, "--estat-strength", "0.000");
assert.deepEqual([attributeWrites, textWrites, styleWrites], [2, 2, 2], "External DOM updates must not leave a stale cached value");
console.log(`Render utilities PASS: ${cases} number-format equivalence cases; unchanged writes and external updates`);
