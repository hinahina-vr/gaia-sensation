import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { LIVE_EXHIBITS } from "../src/exploration/live-exhibit-catalog.js";
import { ESTAT_EXHIBITS } from "../src/exploration/estat-exhibit-catalog.js";
import { MARINE_COD_EXHIBIT } from "../src/exploration/marine-cod-catalog.js";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(read("app-content.js"), sandbox);
const content = sandbox.window.GaiaAppContent;
const fixture = [...JSON.parse(read("docs/design/map-editorial-20260907/copy.json")).exhibits,
  JSON.parse(read("docs/design/marine-cod-20260908.json"))];
const recyclingRevision = JSON.parse(read("docs/design/recycling-map-20260907.json"));
// The approved copy is unchanged; only the first exhibits moved on 2026-09-25.
const renumber = { "01": "04", "02": "01", "04": "02" };
for (const row of fixture) row.number = renumber[row.number] || row.number;
fixture.sort((a, b) => a.number.localeCompare(b.number));
const liveRevision = JSON.parse(read("docs/design/live-prefecture-fill-20260912.json")).exhibits;
const annualRevision = JSON.parse(read("docs/design/annual-picker-copy-20260912.json")).exhibits;
const annualSeries = JSON.parse(read("data/estat-prefecture-series.json"));
for (const key of ["migration", "lodging"]) {
  assert.equal(ESTAT_EXHIBITS.find(item => item.key === key).frequency, "年次");
  assert(Object.keys(annualSeries[key]).every(period => /^\d{4}$/u.test(period)), `${key}: picker must match annual observations`);
}
// Evaluate only the frozen, browser-independent definition blocks.
const fire = read("src/exploration/firms-exhibit.js").match(/const DEFINITION = (Object\.freeze\(\{[\s\S]*?\n\}\));/u)?.[1];
const planet = read("src/exploration/planet-signals-exhibit.js").match(/const DEFINITIONS = (Object\.freeze\(\[[\s\S]*?\n\]\));/u)?.[1];
assert(fire && planet);
const extra = [vm.runInNewContext(fire, { SOURCE_PAGE: "https://firms.modaps.eosdis.nasa.gov/active_fire/" }),
  ...vm.runInNewContext(planet), ...LIVE_EXHIBITS, ...ESTAT_EXHIBITS, MARINE_COD_EXHIBIT];
const records = [
  ...content.modes.map(mode => ({ number: mode.mapNumber, id: mode.id, title: mode.titleJa, body: mode.description })),
  ...extra.map(exhibit => ({ number: exhibit.number, id: exhibit.id, title: exhibit.shortTitle, body: exhibit.caption, question: exhibit.question })),
].sort((a, b) => a.number.localeCompare(b.number));
assert.equal(fixture.length, 31);
assert.equal(records.length, 31);
assert.equal(new Set(records.map(record => record.id)).size, 31);
for (const [index, record] of records.entries()) {
  const expected = record.number === recyclingRevision.number
    ? { ...fixture[index], body: recyclingRevision.body }
    : { ...fixture[index], ...liveRevision.find(item => item.number === record.number), ...annualRevision.find(item => item.number === record.number) };
  assert.equal(record.number, String(index + 1).padStart(2, "0"));
  for (const key of ["number", "id", "title", "body", "question"]) {
    assert.equal(record[key], expected[key], `${record.number}: ${key}`);
  }
  assert.equal(content.MAP_TITLE_SUBTITLES[record.number], expected.subtitle);
  assert.equal(content.MAP_MODE_DESCRIPTIONS[record.id], expected.picker);
  assert(expected.subtitle.length >= 12 && expected.subtitle.length <= 32);
  assert(expected.picker.length <= 85);
  assert(expected.body.length >= 50);
}
for (const exhibit of extra.filter(item => !LIVE_EXHIBITS.includes(item))) {
  assert.match(exhibit.source || exhibit.sourcePage || "", /^https:\/\//u);
}
const liveRuntime = read("src/exploration/live-exhibits.js");
assert.match(liveRuntime, /data-live-deck-source/u);
assert.match(liveRuntime, /https:\/\/open-meteo\.com\//u);
assert.match(liveRuntime, /https:\/\/ads\.atmosphere\.copernicus\.eu\//u);
for (const [number, pattern] of [
  ["04", /熱異常.*焼失面積.*被害.*原因は分かりません/u],
  ["03", /モデル.*曝露量.*健康被害は分かりません/u],
  ["02", /波紋は演出.*予測ではありません/u],
  ["06", /再構成.*試算.*因果関係を示す展示ではありません/u],
  ["07", /変わらない.*予報ではありません/u],
  ["08", /因果関係は計算していません/u],
  ["09", /国連SDG.*91地域.*世界銀行.*54地域.*未収録.*推計.*分母.*厳密な順位/u],
  ["13", /年は異なり.*0%.*未収録/u],
  ["21", /転入者数.*転出者数.*出生・死亡/u],
  ["25", /毎日の日最高気温.*一年で平均.*夏だけ.*最高記録.*猛暑日数/u],
  ["26", /毎日の日最低気温.*一年で平均.*冬だけ.*最低記録.*冬日数/u],
  ["30", /雨日以外の日を晴天日数とはみなしません/u],
  ["31", /COD.*年度平均値.*波紋は演出.*DO.*酸欠の分布ではありません/u],
]) assert.match(records[Number(number) - 1].body, pattern, `${number}: material limitation`);
console.log("PASS MAP editorial: all 31 titles, relevance subtitles, picker copy, bodies, sources and critical data limits match the copy fixtures");
