import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAP_BACKGROUND_THEMES,mapBackgroundTheme,MAP_BACKGROUND_NOTE} from '../src/exploration/map-theme-catalog.js';
import {MAP_THEME_VERTEX,MAP_THEME_FRAGMENT} from '../src/exploration/map-theme-shaders.js';
import {MARINE_COD_EXHIBIT} from '../src/exploration/marine-cod-catalog.js';
import {JAPAN_SENSOR_OPEN_EXHIBITS} from '../src/exploration/japan-sensor-open-catalog.js';
import {JAPAN_POLLUTION_EXHIBITS} from '../src/exploration/japan-pollution-catalog.js';
import {PRTR_BIOLOGY_EXHIBITS} from '../src/exploration/prtr-biology-catalog.js';
import {FOOD_EXHIBITS} from '../src/exploration/food-catalog.js';
import {LIVE_EXHIBITS} from '../src/exploration/live-exhibit-catalog.js';
import {CLIMATE_EXHIBITS} from '../src/exploration/climate-history-model.js';
const expected=[{id:'nasa-firms-active-fire',number:4},...LIVE_EXHIBITS,MARINE_COD_EXHIBIT,...JAPAN_SENSOR_OPEN_EXHIBITS,...JAPAN_POLLUTION_EXHIBITS,...PRTR_BIOLOGY_EXHIBITS,...FOOD_EXHIBITS,...CLIMATE_EXHIBITS];
assert.deepEqual(MAP_BACKGROUND_THEMES.map(t=>[t.number,t.id]),expected.map(t=>[Number(t.number),t.id]));
assert.equal(new Set(MAP_BACKGROUND_THEMES.map(t=>t.id)).size,expected.length);
assert.equal(new Set(MAP_BACKGROUND_THEMES.map(t=>t.pattern)).size,18);
// Live rain and historical rain intentionally share a motif and seed.
assert.equal(new Set(MAP_BACKGROUND_THEMES.map(t=>JSON.stringify([t.pattern,t.accent,t.secondary,t.seed]))).size,expected.length - 1);
for(const theme of MAP_BACKGROUND_THEMES){
 assert.equal(mapBackgroundTheme(theme.id),theme);assert(Object.isFrozen(theme));
 assert(theme.label.length>2&&theme.speed>0&&theme.speed<=1);
 for(const color of [theme.accent,theme.secondary]){assert.equal(color.length,3);assert(color.every(v=>Number.isFinite(v)&&v>=0&&v<=1));}
}
assert.equal(mapBackgroundTheme('unknown'),null);assert.equal(mapBackgroundTheme(undefined),null);
assert(MAP_BACKGROUND_NOTE.includes('観測値の分布'));
assert(MAP_THEME_VERTEX.startsWith('#version 300 es'));assert(MAP_THEME_FRAGMENT.startsWith('#version 300 es'));
assert.deepEqual([...MAP_THEME_FRAGMENT.matchAll(/uniform\s+\w+\s+(\w+);/g)].map(m=>m[1]).sort(),['u_resolution','u_geo_view','u_land','u_mask_ready','u_ocean_only','u_time','u_seed','u_pattern','u_accent','u_secondary'].sort());
const entry=fs.readFileSync('src/exploration/index.js','utf8'),loader=fs.readFileSync('gaia-mode-loader.js','utf8');
assert(entry.includes('map-theme-background.js?v=theme-background-20260912'));assert(loader.includes('map-theme-background.css?v=theme-background-20260912'));
console.log(`PASS ${expected.length} canonical exhibits, 18 motif families; no observation-value shader inputs; lazy runtime and stylesheet wiring`);
