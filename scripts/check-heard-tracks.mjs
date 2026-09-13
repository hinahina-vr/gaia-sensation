import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../opening-audio.js", import.meta.url), "utf8");
const key = "gaia-senseware-heard-tracks:v1";
const storage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
};
const boot = (localStorage = storage(), failPlay = false) => {
  let now = 0, frameId = 0;
  const frames = new Map(), players = [];
  class Audio extends EventTarget {
    constructor(src) { super(); Object.assign(this, { src, paused: true, muted: false, seeking: false, volume: 0, currentTime: 0, duration: 120, readyState: 4 }); players.push(this); }
    load() {}
    async play() { if (failPlay) throw new Error("Autoplay blocked"); this.paused = false; this.dispatchEvent(new Event("playing")); }
    pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
  }
  const window = Object.assign(new EventTarget(), { localStorage, sessionStorage: storage(), setTimeout, clearTimeout });
  const document = Object.assign(new EventTarget(), { currentScript: { src: "https://test.invalid/opening-audio.js" }, baseURI: "https://test.invalid/" });
  vm.runInNewContext(source, {
    window, document, Audio, URL, Event, CustomEvent, HTMLMediaElement: { HAVE_FUTURE_DATA: 3, HAVE_CURRENT_DATA: 2, HAVE_METADATA: 1 },
    performance: { now: () => now }, requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id),
  });
  const advance = async (seconds = 2) => {
    for (let elapsed = 0; elapsed < seconds; elapsed += .25) {
      now += 250;
      const next = [...frames.values()]; frames.clear(); next.forEach(fn => fn(now));
      await Promise.resolve(); await Promise.resolve();
      for (const p of players) if (!p.paused) { p.currentTime += .25; p.dispatchEvent(new Event("timeupdate")); }
    }
  };
  return { api: window.GaiaOpeningAudio, window, players, advance };
};
const heard = app => [...app.api.getHeardTracks()].sort();
// Unit contract (mock media): temporary owners compose with scene mixing and
// cannot release another owner's mute or alter the saved visitor preference.
const ducked = boot();
await ducked.api.start(.2); await ducked.advance();
ducked.api.setMixGain(.5, 0);
ducked.api.setDuckGain('story-prologue', 0, 2.1);
await ducked.advance(1);
assert(ducked.api.getPlaybackState().outputVolume > 0, 'Long fade still has a tail at one second');
await ducked.advance(2);
assert.equal(ducked.api.getPlaybackState().outputVolume, 0);
ducked.api.setDuckGain('other-owner', .5, 0);
ducked.api.setDuckGain('story-prologue', 1, 0);
await ducked.advance();
assert.equal(ducked.api.getState().volume, .2);
assert.equal(ducked.api.getState().mixGain, .5);
assert.equal(ducked.api.getState().duckGain, .5);
assert.equal(ducked.api.getPlaybackState().outputVolume, .05);
await ducked.api.setMuted(true);
ducked.api.setDuckGain('other-owner', 1, 0); await ducked.advance();
assert.equal(ducked.api.getPlaybackState().outputVolume, 0);
const saved = storage();
const app = boot(saved);
await app.api.preloadTrack("trueend");
await app.api.switchTrack("ending", 0);
await app.advance();
assert.deepEqual(heard(app), [], "preloads and muted scene visits must stay locked");
await app.api.start(0);
await app.advance();
assert.deepEqual(heard(app), [], "zero volume must not count");
app.api.setVolume(.1, 0);
await app.advance();
assert.deepEqual(heard(app), ["ending"]);
assert.deepEqual(heard(boot(saved)), ["ending"], "listening persists after reload");
await app.api.setMuted(true);
await app.api.switchTrack("trueend", 0);
await app.advance();
assert.equal(app.api.hasTrackBeenHeard("trueend"), false);
app.api.setMixGain(0, 0);
await app.api.start(.1);
await app.advance();
assert.equal(app.api.hasTrackBeenHeard("trueend"), false, "silent mix must not count");
app.api.setMixGain(1, 0);
await app.advance();
assert.equal(app.api.hasTrackBeenHeard("trueend"), true);
await app.api.switchTrack("sensorfield", 0);
await app.advance();
assert.equal(app.api.hasTrackBeenHeard("moonbook"), true);
assert.equal(app.api.hasTrackBeenHeard("sensorfield"), true, "shared source aliases unlock one recording");
assert.equal(heard(app).includes("sensorfield"), false);

const blocked = boot(storage(), true);
assert.equal(await blocked.api.start(.1), false);
await blocked.advance();
assert.deepEqual(heard(blocked), []);
const seeking = boot();
await seeking.api.start(.1);
await seeking.advance(.25);
const p = seeking.players[0];
p.seeking = true; p.dispatchEvent(new Event("seeking"));
p.currentTime = 60; p.dispatchEvent(new Event("timeupdate"));
p.seeking = false; p.dispatchEvent(new Event("seeked"));
p.dispatchEvent(new Event("timeupdate"));
assert.deepEqual(heard(seeking), [], "seeking and successful play alone are not listening");
await seeking.advance();
assert.deepEqual(heard(seeking), ["opening"]);

for (const invalid of ["{bad", "true", '["trueend"]', '{"version":2,"tracks":["trueend"]}']) {
  assert.deepEqual(heard(boot(storage({ [key]: invalid }))), []);
}
assert.deepEqual(heard(boot(storage({ [key]: JSON.stringify({ version: 1, tracks: ["bogus", "__proto__", 1, "sensorfield", "moonbook"] }) }))), ["moonbook"]);
assert.deepEqual(heard(boot(storage({ "gaiaSensewareNovel:progress": JSON.stringify({ clear: true, archivesUnlocked: true }) }))), []);
const optional = boot({ getItem() { throw new Error("Storage blocked"); }, setItem() { throw new Error("Storage blocked"); } });
await optional.api.start(); await optional.advance();
assert.deepEqual(heard(optional), ["opening"]);
const crossTab = new Event("storage");
Object.assign(crossTab, { key, newValue: JSON.stringify({ version: 1, tracks: ["story"] }) });
app.window.dispatchEvent(crossTab);
assert.deepEqual(heard(app), ["story"]);
const clear = new Event("storage"); Object.assign(clear, { key: null, newValue: null });
app.window.dispatchEvent(clear);
assert.deepEqual(heard(app), []);
console.log("PASS: audible listening, preloads, mute, zero volume/mix, blocked play, seeking, aliases, persistence, malformed/legacy storage and cross-tab changes");
