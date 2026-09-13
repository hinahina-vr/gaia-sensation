import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../gaia-mode-loader.js", import.meta.url), "utf8");
const events = [], preloads = [], executed = [], scripts = [];
const document = {
  baseURI: "https://gaia.test/", styleSheets: [], scripts,
  documentElement: { dataset: {} }, querySelector: () => null, getElementById: () => null,
  addEventListener() {},
  createElement(tag) { return { tag, dataset: {} }; },
  head: { append(node) {
    if (node.rel === "preload") { preloads.push(node.href); events.push(`preload:${node.href}`); }
    else queueMicrotask(() => { events.push(`style:${node.href}`); node.onload(); });
  } },
  body: { append(node) {
    assert.equal(node.async, false, "Classic scripts must retain ordered evaluation");
    scripts.push(node);
    queueMicrotask(() => { events.push(`execute:${node.src}`); executed.push(node.src); node.onload(); });
  } },
};
const window = { location: { hash: "", search: "", pathname: "/" }, addEventListener() {}, dispatchEvent() {}, setTimeout, clearTimeout };
const context = vm.createContext({ document, window, URL, URLSearchParams, performance, console,
  HTMLTemplateElement: class {}, HTMLElement: class {}, CustomEvent: class {},
});
vm.runInContext(fs.readFileSync(new URL("../map-exhibit-route.js", import.meta.url), "utf8"), context);
vm.runInContext(source, context);
assert.deepEqual(preloads, [], "The entry screen must not preload any unrequested mode");
const first = context.GaiaModeLoader.load("character"), duplicate = context.GaiaModeLoader.load("character");
assert.equal(first, duplicate, "Concurrent requests must share a single load");
await first;
assert.equal(preloads.length, 2);
assert.deepEqual(executed, preloads, "Preloads must not execute code; normal script order must be retained");
assert(events.indexOf(`preload:${preloads[1]}`) < events.indexOf(`execute:${executed[0]}`), "Later scripts must be discovered before earlier scripts execute");
assert(events.filter(value => value.startsWith("style:")).every(value => events.indexOf(value) < events.indexOf(`execute:${executed[0]}`)));
await context.GaiaModeLoader.load("character");
assert.equal(preloads.length, 2); assert.equal(executed.length, 2);
await context.GaiaModeLoader.load("sound");
assert.equal(preloads.length, 2, "Already-parallel groups do not need extra preload hints");
await assert.rejects(context.GaiaModeLoader.load("unknown"), /Unknown GAIA mode group/);
console.log("Mode loader PASS: lazy entry, early fetch hints, original CSS/script order, deduplication and parallel groups");
