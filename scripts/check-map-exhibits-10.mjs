import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import "./check-live-loading.mjs";
import "./check-statistics-methods.mjs";
import "./check-exhibit-catalog.mjs";
import "./check-map-editorial.mjs";
import "./check-map-demo.mjs";
import "./check-japan-sensor-open.mjs";
import "./check-japan-pollution.mjs";
import "./check-prtr-biology.mjs";
import "./check-fao-food.mjs";
import { LIVE_EXHIBITS } from "../src/exploration/live-exhibit-catalog.js";
import { ESTAT_EXHIBITS } from "../src/exploration/estat-exhibit-catalog.js";
// Both transport checks temporarily replace globals; run BYOK after imports settle.
await import("./check-statistics-ai.mjs");

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const appContentSource = read("app-content.js");
const appSource = read("app.js");
const particlesSource = read("particles-v9.js");
const modeLoaderSource = read("gaia-mode-loader.js");
const liveExhibitsSource = read("src/exploration/live-exhibits.js");
const liveDataSource = read("src/exploration/live-data.js");
const liveTransformsSource = read("src/exploration/transforms.js");
const stylesSource = read("styles.css");
const mapGridStylesSource = read("map-ui-grid-polish.css");
for (const animation of ["gaia-live-poi-depart", "gaia-live-poi-arrive", "gaia-live-poi-label", "gaia-live-anchor-depart", "gaia-live-anchor-arrive"]) {
  const frames = mapGridStylesSource.match(new RegExp(`@keyframes ${animation} \\{([\\s\\S]*?)\\n\\}`));
  assert(frames, `${animation}: missing reveal animation`);
  assert.doesNotMatch(frames[1], /\b(?:transform|translate|scale|left|top)\s*:/u, `${animation}: POI reveal must not change its geographic position`);
}
const mapGridScriptSource = read("map-ui-grid-polish.js");
const categorySource = read("map-exhibit-categories.js");
const categorySandbox = { document: { querySelector: () => null, addEventListener() {} }, matchMedia: () => ({ matches: true, addEventListener() {} }) };
vm.runInNewContext(categorySource, categorySandbox, { filename: "map-exhibit-categories.js" });
const categories = JSON.parse(JSON.stringify(categorySandbox.GaiaMapCategories.definitions));
assert.deepEqual(categories.map(category => category.label), ["惑星のいま", "気候と炭素", "空と天気", "大気と汚染", "水と森", "水質と汚濁", "化学物質の行方", "生きものの記録", "食卓と世界", "人口と暮らし", "資源とエネルギー", "大地の活動"]);
assert.deepEqual(categories.flatMap(category => category.numbers).sort((a, b) => a - b), Array.from({ length: 71 }, (_, index) => index + 1), "Each exhibit has exactly one subject category");
assert.equal(categorySandbox.GaiaMapCategories.get("01").id, "planet");
assert.equal(categorySandbox.GaiaMapCategories.get("17").id, "water");
assert.equal(categorySandbox.GaiaMapCategories.get(0), null);
assert.match(mapGridScriptSource, /data-map-category-label/u);
assert.match(categorySource, /\.gaia-live-deck-chapter, \.gaia-estat-chapter, \.gaia-firms-chapter, \.gaia-planet-chapter/u);
const html = read("index.html");
const packageJson = read("package.json");
const gaiaData = JSON.parse(read("data/gaia-signals.json"));
const sandbox = { window: {} };

vm.runInNewContext(appContentSource, sandbox, { filename: "app-content.js" });
const content = sandbox.window.GaiaAppContent;
const expectedIds = [
  "breathing-earth",
  "blue-circulation",
  "forest-cloud-engine",
  "nothing-is-waste",
  "anthropocene-scar",
  "rhythm-of-disaster",
  "three-ecologies",
  "earth-organ",
  "population-tide",
];
const retiredIds = [
  "breathing-earth-data",
  "blue-circulation-live",
  "forest-cloud-engine-live",
  "pollination-protocol-live",
  "nothing-is-waste-live",
  "anthropocene-scar-live",
  "rhythm-of-disaster-live",
  "three-ecologies-live",
  "earth-organ-live",
  "senseware-2050",
  "senseware-2050-live",
];

assert.equal(content.modes.length, 9, "Earth catalog must contain exactly 9 exhibits");
assert.equal(content.INTRO_MODE_CHOICES.length, 9, "Entrance must contain exactly 9 exhibits");
assert.deepEqual(Array.from(content.modes, ({ id }) => id), expectedIds);
assert.equal(new Set(content.modes.map(({ id }) => id)).size, 9);
for (const id of expectedIds) {
  assert(content.modeConcepts[id]?.question, `${id}: question is missing`);
  assert(content.modeDataNarratives[id], `${id}: data narrative is missing`);
  assert(content.lectureResumeLinks[id], `${id}: lecture reference is missing`);
}
for (const id of retiredIds) {
  assert(!appContentSource.includes(id), `${id}: retired exhibit remains in app-content.js`);
  assert(!appSource.includes(id), `${id}: retired exhibit remains in app.js`);
}

assert.equal(content.modes[2].titleJa, "森と水のつながり");
assert.match(content.modeConcepts["forest-cloud-engine"].seeing, /森林域/u);
assert.match(content.modeConcepts["forest-cloud-engine"].touch, /大きな水色円.*代表地点名・平均降水量/u);
assert.match(appSource, /const FOREST_RAIN_MIN_RADIUS = 10;/u);
assert.match(appSource, /const FOREST_RAIN_MAX_RADIUS = 54;/u);
assert.match(appSource, /row\.id === "brazil" \? "ブラジル" : getCountryNameJa\(row\)/u);
assert.equal(content.modes.some(({ id }) => id === "pollination-protocol"), false);
assert.doesNotMatch(appContentSource, /pollination-protocol|ミツバチ|GloBI|GBIF/u);
assert.equal(content.modes[3].titleJa, "捨てた先の未来");
assert.match(content.modeConcepts["nothing-is-waste"].seeing, /国土の青.*0〜100%.*145の国・地域.*無着色/u);
assert.match(content.modeConcepts["nothing-is-waste"].touch, /左右ボタン.*スライダー.*国・地域.*国連・世界銀行の出典と対象範囲/u);
assert.doesNotMatch(appSource, /scenarioRecycle|scenarioIncrease|drawOuterTargetRing/u);
// 09も自動表示の対象。手動停止の制御は共通タイムライン側に残る。
assert.match(appSource, /co2TimelineHeld \|\| performance\.now\(\) < co2TimelinePausedUntil/u);
assert.match(content.modes[4].description, /1945〜2023年.*VIIRS.*2016年.*固定.*比較/u);
assert.match(content.modeConcepts["anthropocene-scar"].seeing, /国土の色.*固定対数尺度.*濃紺.*淡黄.*2016年/u);
assert.match(content.modeConcepts["anthropocene-scar"].touch, /1945〜2023年.*色の付いた国土.*0\.65秒以上/u);
assert.match(appSource, /glow-plus-radiance-core/u);
assert.match(appSource, /web-mercator-to-geographic/u);
assert.match(appSource, /const ANTHROPOCENE_EMISSIONS_SCALE_MT = 12000;/u);
assert.match(appSource, /const ANTHROPOCENE_HEAT_STOPS/u);
assert.match(appSource, /const getAnthropoceneEmissionHeat/u);
assert.match(appSource, /const drawAnthropoceneCountryChoropleth/u);
assert.match(appSource, /emissionsEncoding = "country-fixed-log-color"/u);
assert.match(appSource, /emissionsGeometry = "natural-earth-country-choropleth"/u);
assert.match(appSource, /emissionsHitSurface = "country-regions"/u);
assert.match(appSource, /化石燃料由来CO₂[ 　]\$\{selected\.emissionsMtCo2\.toFixed\(1\)\} Mt/u);
assert.doesNotMatch(appSource, /国全体の色|FOSSIL CO₂ \$\{selected\.emissionsMtCo2/u);
assert.match(content.modes[5].description, /USGS.*2000〜2026年.*M7\.5.*発生日時順.*学習用.*可感半径.*実際の震度分布.*被害範囲.*津波範囲.*気象庁.*実測震度/u);
assert.match(content.modeConcepts["rhythm-of-disaster"].seeing, /発生日時の早い地震から順.*M7\.5.*約500km.*M9\.1.*約2,000km.*別年度の震源は表示しません/u);
assert.match(content.modeDataNarratives["rhythm-of-disaster"], /初期表示は世界.*発生日時の早い順.*カメラで追い.*到着の0\.5秒後.*0\.9秒後.*地震件数に合わせて変わり.*世界表示へ戻/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_WAVE_MIN_DURATION_MS = 2200/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_WAVE_MAX_DURATION_MS = 3600/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_EVENT_APPEAR_MS = 460/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_EVENT_EXIT_STAGGER_MS = 0/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS = 320/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_RING_DELAY_MS = 90/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_CAMERA_FLY_MS = 780/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_MARKER_DELAY_MS = 500/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_CALLOUT_DELAY_MS = 900/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_EVENT_HOLD_MS = 2000/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_EVENT_STAGGER_MS =[\s\S]*GLOBAL_EARTHQUAKE_APPEAR_LEAD_MS \+ GLOBAL_EARTHQUAKE_CALLOUT_DELAY_MS \+ GLOBAL_EARTHQUAKE_EVENT_HOLD_MS/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_CAMERA_RETURN_DELAY_MS =[\s\S]*GLOBAL_EARTHQUAKE_EVENT_HOLD_MS/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_CAMERA_RETURN_MS = 620/u);
assert.match(appSource, /earthquakeCameraMode = "chronological-epicenter-flyover"/u);
assert.match(appSource, /syncEarthquakeCameraSequence/u);
assert.match(appSource, /GLOBAL_EARTHQUAKE_YEAR_COUNT = 27/u);
assert.match(appSource, /getGlobalEarthquakePlaybackSchedule/u);
assert.match(appSource, /earthquakeSchedule\.entries\.find/u);
assert.match(appSource, /getGlobalEarthquakeImpactRadiusKm/u);
assert.match(appSource, /earthquakeWaveSync = "chronological-sequential-distance-limited"/u);
assert.match(appSource, /earthquakeWaveModel = "usgs-estimated-felt-radius"/u);
assert.match(appSource, /earthquakeTimelinePlayback = "auto-loop"/u);
assert.match(appSource, /earthquakeRevealOrder = "occurred-at-ascending"/u);
assert.match(appSource, /earthquakeExitOrder = "simultaneous"/u);
assert.match(appSource, /earthquakeExitOrderedEventTimes = yearTransition\.exitOrderIndices/u);
assert.match(appSource, /earthquakeYearTransitionMode = "chronological-in-simultaneous-fade-out"/u);
assert.match(appSource, /compactProminent: true, anchor: point, allowDuringPlotReveal: true/u);
assert.match(appSource, /earthquakeYearSummary = "hidden"/u);
assert.doesNotMatch(appSource, /`\$\{displayedYear\} \/ \$\{displayedEvents\.length\} EVENTS`/u);
assert.doesNotMatch(appSource, /cameraSequence\.activeIndex \+ 1\)\.padStart/u);
assert.match(appSource, /earthquakeWaveProjection = "equirectangular-geodesic-distance"/u);
assert.match(appSource, /earthquakeMarkerStyle = "red-heavy-cross"/u);
assert.match(appSource, /earthquakeMarkerColor = "rgb\(255,43,51\)"/u);
assert.match(appSource, /traceEpicenterCross\(sourceRadius\)/u);
assert.match(appSource, /ctx\.fillText\(`M\$\{event\.magnitude\.toFixed\(1\)\}`, point\.x, magnitudeY\)/u);
assert.match(appSource, /const magnitudeY = point\.y \+ sourceRadius \+ markerLineWidth \/ 2 \+ 3/u);
assert.match(appSource, /"below-marker"/u);
assert.doesNotMatch(appSource, /"callout-only"|hasVisibleCallout/u);
assert.match(appSource, /"赤い× \/ この年の震源"/u);
assert.match(appSource, /getEarthquakeYearTransition/u);
assert.match(appSource, /reducedMotionStillAdvances = signalMode\?\.id === "rhythm-of-disaster"/u);
assert.match(appSource, /setJapanDataLayer\("snapshot"\)/u);
assert.match(content.modes[6].description, /世界の国・地域.*森林面積率.*都市人口率.*異なる分母.*100%.*標本内の相関.*相関は因果/u);
assert.match(content.modeConcepts["three-ecologies"].seeing, /回帰線.*相関係数r/u);
assert.match(content.modeConcepts["three-ecologies"].touch, /都市人口率の低い国から高い国/u);
assert.match(content.modeDataNarratives["three-ecologies"], /森林面積率.*緑の棒.*青の棒/u);
assert.match(appSource, /const getThreeEcologiesComparison/u);
assert.match(appSource, /ecologiesPlot = "paired-bars-with-linked-scatter"/u);
assert.match(appSource, /drawMemoryContext\(unescoGlobalSample\)/u);
const threeEcologiesData = gaiaData.modes.find(({ id }) => id === "three-ecologies");
assert(threeEcologiesData.signals.pairedCountries.length >= 200);
assert(threeEcologiesData.signals.ecological.length >= 200);
assert(threeEcologiesData.signals.social.length >= 200);
assert.equal(threeEcologiesData.signals.culture.length, 24);
assert(threeEcologiesData.signals.pairedCountries.every((row) => Number.isFinite(row.forestPercent) && Number.isFinite(row.urbanPercent)));
assert.match(appSource, /const ECOLOGIES_SEQUENCE_DURATION_MS = MODE_SEQUENCE_DURATION_MS \* 2;/u);
assert.match(appSource, /const ECOLOGIES_SELECTION_TRANSITION_MS = 920;/u);
assert.match(appSource, /const getEcologiesSelectionTransition = \(rows, selected, now\)/u);
assert.match(appSource, /getThreeEcologiesComparison\(signalMode.signals\)\?\.rows.length \|\| 0\) \* 4000/u);
assert.match(appSource, /ecologiesCountryDisplayMs[\s\S]{0,500}ecologiesSelectionTransitionProgress/u);
assert.match(content.modes[7].description, /世界銀行.*発電割合.*国土の青.*年は異なり.*0%.*未収録.*代表地点.*原因を計算した値ではありません/u);
assert.match(content.modeConcepts["earth-organ"].seeing, /国・地域.*暗い青.*明るい水色/u);
assert.match(content.modeConcepts["earth-organ"].touch, /自動再生とスライダー.*高い国から低い国.*結ぶ機能はなくし/u);
assert.match(appSource, /\.sort\(\(a, b\) => b\.renewablePercent - a\.renewablePercent\)/u);
assert.match(appSource, /再生可能エネルギー発電割合が高い → 低い/u);
assert.match(gaiaData.modes.find(({ id }) => id === "earth-organ").datasets.find(({ id }) => id === "worldbank-renewable").transformation, /高い国から低い国/u);
assert.match(content.modeDataNarratives["earth-organ"], /国・地域の国土.*0%.*100%/u);
assert.match(appSource, /const drawRenewableCountryChoropleth/u);
assert.match(appSource, /renewableCountryFillCount/u);
assert.match(appSource, /再生可能エネルギー発電割合 \/ \$\{String\(rows\.length\)\}の国・地域中/u);
assert.match(appSource, /drawRenewableObservationLabel/u);
assert.match(appSource, /selectionLabelTypography: "mincho"/u);
assert.match(appSource, /renewable \? \[primary, secondary\] : \[primary, secondary, detail\]/u);
assert.doesNotMatch(appSource, /日射・風：代表点の値は未収録/u);
assert.match(appSource, /energyConnectionRemoved = "true"/u);
assert.doesNotMatch(appSource, /selectedEnergyRegions|SCENARIO \/ DISTRIBUTED LINK|scenarioLinks\.push/u);
const earthOrganData = gaiaData.modes.find(({ id }) => id === "earth-organ");
assert(earthOrganData.signals.current.length >= 200);
assert.equal(earthOrganData.signals.current.length, earthOrganData.signals.renewableCoverage.countryCount);
assert.equal(earthOrganData.signals.potential.length, 31);
assert.equal(Object.hasOwn(earthOrganData.signals, "scenarioLinks"), false);
assert.equal(earthOrganData.datasets.some(({ id }) => id === "distributed-link-scenario"), false);
assert.equal(content.modes[8].id, "population-tide");
assert.match(content.modes[8].description, /1960〜2025年.*円の面積.*人口/u);
assert.match(content.modeConcepts["population-tide"].touch, /1960〜2025年.*年だけを動か/u);
assert.match(appSource, /const drawQuantitativeLegendPanel/u);
for (const legendId of [
  "co2-concentration",
  "ocean-current-speed",
  "precipitation",
  "recycling-rate",
  "fossil-co2",
  "earthquake-magnitude",
  "population",
]) {
  assert.match(appSource, new RegExp(`id: "${legendId}"`), `${legendId}: quantitative legend is missing`);
}
assert.match(appSource, /title: "マグニチュード \/ この年最大"/u);
const anthropoceneData = gaiaData.modes.find(({ id }) => id === "anthropocene-scar");
assert.equal(Math.min(...anthropoceneData.signals.emissions.map(({ year }) => year)), 1945);
assert.equal(Math.max(...anthropoceneData.signals.emissions.map(({ year }) => year)), 2023);
assert(anthropoceneData.signals.emissions.every((row) => Number.isFinite(row.emissionsMtCo2)));
const populationData = gaiaData.modes.find(({ id }) => id === "population-tide");
assert.equal(Math.min(...populationData.signals.population.map(({ year }) => year)), 1960);
assert.equal(Math.max(...populationData.signals.population.map(({ year }) => year)), 2025);
assert.equal(populationData.signals.population.filter(({ year }) => year === 1960).length, 216);
assert.equal(populationData.signals.population.filter(({ year }) => year === 2025).length, 217);
assert.equal(populationData.signals.populationCoverage.countryCount, 217);
assert.equal(populationData.signals.populationCoverage.missingCountryYears, 30);
for (const [iso3, population] of [["FRA", 50722791], ["DEU", 76951336], ["ITA", 52900500]]) {
  assert.equal(populationData.signals.population.find(row => row.iso3 === iso3 && row.year === 1967)?.population, population);
}
assert(populationData.signals.population.every(row => Number.isFinite(row.population) && row.population > 0 && Number.isFinite(row.lat) && Number.isFinite(row.lon)));
assert.equal(populationData.signals.population.some(row => ["WLD", "EUU", "HIC", "ECS"].includes(row.iso3)), false);
assert.equal(populationData.signals.population.some(row => row.iso3 === "PSE" && row.year < 1990), false);
assert.match(appSource, /POPULATION_AREA_REFERENCE = 1_500_000_000/u);
assert.match(appSource, /Math.sqrt\(Math.max\(0, population\) \/ POPULATION_AREA_REFERENCE\)/u);
assert.equal(content.modes.at(-1).id, "population-tide");
assert.equal(gaiaData.modes.length, 10);
assert.equal(gaiaData.modes.some(({ id }) => id === "senseware-2050"), false);
assert.doesNotMatch(appSource, /getNineSignalCards|sensewareDisplay|nine-data-cards|9つの測定 ≠ 1つの地球スコア/u);

assert.match(appSource, /const MODE_COUNT = 9;/u);
assert.doesNotMatch(appSource, /mode == (?:1[0-9]|[2-9][0-9])/u);
assert.match(appSource, /const getEarthWorldCopies = \(projection\)/u);
assert((appSource.match(/getEarthWorldCopies\(projection\)/gu) || []).length >= 2, "vector and raster must share getEarthWorldCopies");
assert.match(appSource, /dataset\.vectorWorldCopies/u);
assert.match(appSource, /dataset\.rasterWorldCopies/u);
assert.match(appSource, /const getForestGeographicRaster/u);
assert.match(appSource, /forestOnly: true/u);
assert.match(appSource, /const animateEarthViewForMode/u);
assert.match(appSource, /durationMs = 1150/u);
assert.match(appSource, /const duration = clamp\(Number\(durationMs\) \|\| 1150/u);
assert.match(appSource, /const frameDelta = clamp\(now - previousFrameAt, 0, 64\)/u);
assert.match(appSource, /cancelEarthViewAnimation\("user-pointer"\)/u);
assert.match(appSource, /cancelEarthViewAnimation\("user-wheel"\)/u);
assert.match(appSource, /cancelEarthViewAnimation\("user-keyboard"\)/u);
assert.match(appSource, /dataset\.japanScreenX/u);
assert.match(appSource, /BLUE_CIRCULATION_FOCUS = Object\.freeze\(\{[\s\S]*label: "tokyo"[\s\S]*lon: 139\.6503[\s\S]*lat: 35\.6762/u);
assert.match(appSource, /dataset\.tokyoScreenX/u);
assert.match(appSource, /currentVisualLanguage = "continuous-interpolated-current-brush"/u);
assert.match(appSource, /currentBrushLanguage = "continuous-interpolated-field-with-poi-anchors"/u);
assert.match(appSource, /currentCoverageMode = "gapless-idw-vector-field"/u);
assert.match(appSource, /currentInterpolationSource = "inverse-distance-weighted-noaa-vectors"/u);
assert.match(appSource, /currentAmbientMotion = "continuous-timeline-independent-gradient"/u);
assert.match(appSource, /MAP_LIGHT_OPACITIES = Object\.freeze\(\[0\.09, 0\.72,/u);
assert.match(appContentSource, /float currentBrushBody/u);
assert.match(appContentSource, /float currentBrushBristles/u);
assert.match(appContentSource, /float pigmentTime = t \* mix\(0\.78, 1\.5, currentEnergy\)/u);
assert.match(appContentSource, /for \(int i = 0; i < 96; i\+\+\)/u);
assert.match(appContentSource, /float forwardReach = mix\(0\.42, 0\.78, measuredSpeed\)/u);
assert.match(appContentSource, /vec3 poiInk = vec3\(0\.0\)/u);
assert.match(appContentSource, /float sourceBloom/u);
assert.doesNotMatch(appContentSource, /float travelingPearl|float observedPearls/u);
assert.match(stylesSource, /data-integrated-map-mode="02"/u);

assert.match(html, /地球観測データの9つの展示/u);
assert.match(html, /INSTALLATION BANK \/ MAP 01—30/u);
assert.match(html, /aria-label="地図の31展示を選ぶ"/u);
assert.match(html, /9つの観測展示/u);
assert.match(html, /01 \/ 09/u);
assert.doesNotMatch(html, /japan-instruction|DRAG \/ ZOOM|点を押して読む/u);
assert.doesNotMatch(html, /data-signal-note/u);
assert.doesNotMatch(appSource, /data-signal-note/u);
assert.doesNotMatch(html, /data-encoding-value/u);
assert.doesNotMatch(appSource, /setEncodingValue|data-encoding-value/u);
assert.doesNotMatch(stylesSource, /\.signal-encoding-legend dd/u);
assert.doesNotMatch(mapGridStylesSource, /\.signal-encoding-legend dd/u);
assert.match(html, /id="japan-poi-source"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"[\s\S]*元データを確認する/u);
assert.doesNotMatch(html, /id="japan-poi-(?:title|description|relation)"/u);
assert.doesNotMatch(appSource, /この地点の海流が続いたら|japanPoiTitle|japanPoiDescription|japanPoiRelation/u);
assert.match(appSource, /"blue-circulation": "noaa-current-fallback"/u);
assert.match(appSource, /japanPoiSource\.href = sourceUrl/u);
assert.doesNotMatch(html, /data-gaia-live-receipt|gaia-live-receipt|変換レシート/u);
assert.doesNotMatch(appSource, /gaiaLiveReceipt/u);
assert.doesNotMatch(liveDataSource, /ensureSpaceReceipt|data-gaia-live-receipt|gaia-live-receipt/u);
assert.doesNotMatch(stylesSource, /gaia-live-receipt|gaia-live-sound-controls/u);
assert.doesNotMatch(mapGridStylesSource, /gaia-live-receipt/u);
const liveContracts = JSON.parse(read("docs/design/live-prefecture-fill-20260912.json")).exhibits.map(({ number, id, body }) => [number, id, body]);
assert.deepEqual(LIVE_EXHIBITS.map(({ number, id, caption }) => [number, id, caption]), liveContracts, "Live prefecture-fill explanatory contracts changed");
assert.match(liveExhibitsSource, /createLivePrefectureMap/u);
assert.match(liveExhibitsSource, /prefectureMap.update/u);
assert.match(liveExhibitsSource, /liveMapDisplay = "prefecture-choropleth"/u);
assert.doesNotMatch(liveExhibitsSource, /getContext|WEBGL_FRAGMENT_SOURCE|cityMarkerButtons|lightTouchField/u);
await import("./check-live-prefecture-map.mjs");
assert.match(liveExhibitsSource, /data-live-poi-step="-1"[\s\S]*data-live-poi-step="1"/u);
assert.match(liveDataSource, /\/api\/live\/v1\/prefecture-field/u);
assert.match(liveDataSource, /gaia:live-prefecture-field/u);
assert.match(liveDataSource, /gaia:live-wind-field/u);
for (const exhibit of LIVE_EXHIBITS) assert.deepEqual(exhibit.location, { lon: 139.6503, lat: 35.6762, label: "東京" });
assert.match(liveExhibitsSource, /class="gaia-live-data-credit"/u);
assert.match(liveExhibitsSource, /href="https:\/\/open-meteo\.com\/"/u);
assert.match(liveExhibitsSource, /href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/u);
assert.match(liveExhibitsSource, /data-live-cams-credit[\s\S]*Copernicus Atmosphere Monitoring Service/u);
assert.match(html, /id="gaia-map-zoom-controls"[\s\S]*id="gaia-map-zoom-in"[\s\S]*id="gaia-map-zoom-out"[\s\S]*id="gaia-map-zoom-reset"/u);
assert.match(liveTransformsSource, /location: event\.location \? \{ \.\.\.event\.location \} : null/u);
assert.doesNotMatch(liveExhibitsSource, /data-live-light-touch|光に触れる/u);
assert.doesNotMatch(liveExhibitsSource, /data-live-deck-standard|gaia-live-deck-return|通常展示へ戻る/u);
assert.match(liveExhibitsSource, /decorateMapActions\(readout\.querySelector/u);
assert.match(liveExhibitsSource, /data-live-stage="observe"[\s\S]*data-live-stage="locate"[\s\S]*data-live-stage="visualize"/u);
assert((liveExhibitsSource.match(/<svg viewBox="0 0 64 64">/gu) || []).length >= 3, "live transformation stages require graphic symbols");
assert.match(liveExhibitsSource, /data-live-exhibit-input[\s\S]*data-live-exhibit-location[\s\S]*data-live-exhibit-visual-map/u);
assert.doesNotMatch(liveExhibitsSource, /proceduralAudio|procedural-audio|data-live-sound|展示音|BPM|data-live-stage="sonify"/u);
assert.doesNotMatch(liveDataSource, /proceduralAudio|procedural-audio|data-live-sound|展示音|BPM/u);
assert.doesNotMatch(modeLoaderSource, /procedural-audio/u);
assert.doesNotMatch(stylesSource, /data-live-sound|gaia-live-sound/u);
assert.match(stylesSource, /\.gaia-live-exhibit-touch-hint[\s\S]*cursor: pointer/u);
assert.match(stylesSource, /\.gaia-live-exhibit-a11y[\s\S]*clip-path: inset\(50%\)/u);
assert.match(stylesSource, /\.gaia-live-exhibit-primary > strong[\s\S]*font: 500 42px/u);
assert.match(stylesSource, /\.gaia-live-exhibit-path::after[\s\S]*gaia-live-data-travel/u);
assert.match(stylesSource, /\.gaia-live-exhibit-explanation[\s\S]*gaia-live-exhibit-summary/u);
assert.match(liveExhibitsSource, /保存データを再現中/u);
assert.match(liveExhibitsSource, /公開観測値 \/ 5分ごとに再確認/u);
assert.match(liveExhibitsSource, /混在状態を明示します/u);
assert.doesNotMatch(mapGridStylesSource, /\.japan-layer\.is-live-exhibit \.map-grid-bank[\s\S]{0,320}width: clamp\(400px, 22vw, 720px\)/u);
assert.doesNotMatch(liveExhibitsSource, /fillRect\(x - 2, y - 1/u, "wind field must not render sperm-like particle heads");
assert.doesNotMatch(html, /01—10|01〜10|10の観測展示|10番目の展示/u);
assert.doesNotMatch(html, /01—20|01〜20|20の感覚器|20の展示|10テーマ・20演出/u);
assert.doesNotMatch(html, /class="map-scope-switch"|MAP SCALE/u);
assert.match(html, /gaia-mode-loader\.js\?v=gaia-hardening-1/u);
assert.equal(ESTAT_EXHIBITS.find(exhibit => exhibit.key === "lodging").unit, "人");
assert.match(liveExhibitsSource, /この地図で確かめること/u);
assert.equal(LIVE_EXHIBITS.filter(exhibit => typeof exhibit.question === "string" && exhibit.question.length).length, 6);
assert.doesNotMatch(liveExhibitsSource, /LIVE WAVE|live-wave-bar|gaia-live-deck-wave/u);
assert.match(modeLoaderSource, /data-ledger\.css\?v=gaia-inline-data-sources-1/u);
assert.match(modeLoaderSource, /data-ledger\.js\?v=gaia-hardening-1/u);
assert.doesNotMatch(read("src/exploration/estat-exhibits.js"), /47 PREFECTURES \/ AUTO RELAY/u);
assert.match(modeLoaderSource, /map-ui-grid-polish\.css\?v=gaia-place-picker-1/u);
const titleCopyFade = mapGridStylesSource.match(/@keyframes map-title-separator-copy-fade \{([\s\S]*?)\n\}/u)?.[1];
assert(titleCopyFade, "Title exit uses a dedicated fade");
assert.doesNotMatch(titleCopyFade, /transform|translate/u);
assert.match(titleCopyFade, /73\.333333% \{ opacity: 1; \}/u);
assert.match(titleCopyFade, /83\.333333%, 100% \{ opacity: 0; \}/u);
assert.match(modeLoaderSource, /map-ui-grid-polish\.js\?v=entry-bottom-menu-20260914-gaia-story-map-dock-1/u);
assert.match(modeLoaderSource, /map-exhibit-categories\.css\?v=gaia-exhibit-profile-1/u);
assert.match(modeLoaderSource, /map-exhibit-categories\.js\?v=gaia-exhibit-profile-1/u);
assert.match(modeLoaderSource, /app-content\.js\?v=gaia-recycling-coverage-1/u);
assert.match(modeLoaderSource, /app\.js\?v=entry-bottom-menu-20260914-gaia-hardening-1/u);
assert.match(modeLoaderSource, /map-observation-panels\.css\?v=gaia-observation-panels-jst-1/u);
assert.match(modeLoaderSource, /map-legend-drag\.js\?v=gaia-story-map-left-ui-1/u);
assert.match(modeLoaderSource, /map-legend-drag\.css\?v=gaia-movable-legends-1/u);
assert.match(modeLoaderSource, /metric-legend\.css\?v=gaia-unified-metric-legend-1/u);
assert.match(modeLoaderSource, /map-instrument-ui\.css\?v=gaia-country-emissions-history-1/u);
assert.match(modeLoaderSource, /styles\.css\?v=gaia-recycling-country-fill-1/u);
assert.match(modeLoaderSource, /mode-entry-guide\.js\?v=entry-bottom-menu-20260914-gaia-map-guide-sequence-1/u);
assert.match(appSource, /setIntroEntryGuideStep\(0\);\s*introEntryGuide\.focus/u);
assert.match(appSource, /generation === introEntryGuideGeneration[\s\S]{0,140}introEntryGuide\.classList\.add\("is-visible", "is-presented"\)/u);
assert.match(appSource, /releaseIntroEntryGuideSurface\(step\.target\)/u);
assert.match(appSource, /const scheduleIntroEntryGuide = \(delay = 2000\)[\s\S]{0,260}\}, delay\);/u);
assert.match(stylesSource, /\.intro-entry-guide-shade \{[\s\S]{0,760}0 0 0 9999px rgba\(0, 5, 18, 0\.78\)/u);
assert.match(stylesSource, /@keyframes intro-guide-condense[\s\S]{0,300}filter: blur\(8px\)/u);
assert.match(stylesSource, /animation: intro-guide-release 620ms/u);
assert.doesNotMatch(stylesSource, /\.intro-entry-guide-bubble \{[\s\S]{0,1200}transition:[^;}]*(?:top|left)/u);
assert.match(appSource, /avoid: "\.gaia-live-exhibit-readout, \.gaia-firms-readout, \.gaia-planet-signals-readout, \.gaia-estat-readout, #map-mobile-toolbar"/u);
assert.match(appSource, /version: "v5"[\s\S]{0,3000}title: "左下から、展示を選ぶ"[\s\S]{0,900}title: "観測値と単位を読む"[\s\S]{0,900}title: "時間をたどる"[\s\S]{0,900}title: "データの出典を確認する"[\s\S]{0,900}title: "データを詳しく分析する"/u);
assert.match(modeLoaderSource, /particles-v9\.js\?v=gaia-light-surface-fps-1/u);
assert.match(appSource, /const mapSurfaceIsVisible = japanIsOpen/u);
assert.match(appSource, /if \(mapSurfaceIsVisible\) \{\s*renderJapanTiles\(\);\s*renderJapanOverlay\(now\);/u);
assert.match(appSource, /mapZoomIn\.addEventListener\("click", \(\) => zoomEarthBy\(1\.35\)\)/u);
assert.match(appSource, /japanMap\.addEventListener\(\s*"wheel"/u);
assert.match(appSource, /const setLightCanvasMounted = \(mounted\)[\s\S]*japanOverlay\.before\(canvas\)[\s\S]*below-reference-map-and-poi/u);
assert.match(appSource, /const syncIntegratedMapLight = \(\) =>[\s\S]*has-integrated-map-light[\s\S]*mode-matched/u);
assert.match(appSource, /uniform vec4 uCurrentSamples\[\$\{CURRENT_FIELD_SAMPLE_LIMIT\}\][\s\S]*uniform int uCurrentSampleCount/u);
assert.match(appSource, /getCurrentFieldUniformData[\s\S]*Math\.hypot\(row\.uMs, row\.vMs\)[\s\S]*Math\.atan2\(row\.vMs, row\.uMs\)/u);
assert.match(appSource, /gl\.uniform4fv\(uniforms\.currentSamples, currentField\.data\)[\s\S]*gl\.uniform1i\(uniforms\.currentSampleCount, currentField\.count\)/u);
assert.match(appContentSource, /uCurrentSamples\[i\][\s\S]*measuredSpeed[\s\S]*poiInk[\s\S]*sourceBloom/u);
assert.match(appContentSource, /texture\(uCurrentVectorField[\s\S]*texture\(uCurrentWeave[\s\S]*continuousCoverage[\s\S]*continuousSea/u);
assert.match(appSource, /new Worker\("\.\/current-flow-worker\.js\?v=gaia-current-weave-1"/u);
await import("./check-current-flow.mjs");
await import("./check-atmosphere-field.mjs");
assert.match(appContentSource, /vec2 local = rot\(observed\.w\) \* \(p - observed\.xy\)/u);
assert.doesNotMatch(appContentSource, /vec2 local = rot\(-observed\.w\) \* \(p - observed\.xy\)/u);
assert.match(appSource, /currentDirectionTransform = "noaa-east-north-to-gl-local-positive-rotation"/u);
assert.match(appSource, /CURRENT_FIELD_SAMPLE_LIMIT = 96/u);
assert.match(appSource, /currentSampleSelection = "all-visible-poi-stable-order"/u);
assert.doesNotMatch(appSource, /\.sort\(\(a, b\) => b\.speed - a\.speed\)/u);
assert.match(appSource, /const brushCurrentIsActive = getActiveSignalMode\(\)\?\.id === "blue-circulation"/u);
assert.match(appSource, /brushCurrentIsActive[\s\S]*Math\.max\(30, lodTarget\)/u);
assert.match(appSource, /do nextJapanOverlayRenderAt \+= mapFrameInterval;\s*while \(nextJapanOverlayRenderAt <= now\)/u);
assert.doesNotMatch(appSource, /lastJapanOverlayRenderAt/u);
assert.match(appSource, /float grainBlend = smoothstep\(0\.0, 1\.0, fract\(grainTime\)\)/u);
assert.match(particlesSource, /const installationIsOpen = \(\) => Boolean\(document\.querySelector\("\.experience\.japan-open"\)\)/u);
assert.match(particlesSource, /&& !installationIsOpen\(\)/u);
assert.match(modeLoaderSource, /src\/exploration\/index\.js\?v=gaia-firms-cruise-animation-20260914/u);
assert.match(modeLoaderSource, /map-observation-typography\.css\?v=gaia-lodging-color-1/u);
assert.match(modeLoaderSource, /live-observation-ui\.css\?v=gaia-action-corner-1/u);
assert.match(modeLoaderSource, /observation-place-picker\.css\?v=gaia-place-inline-1/u);
assert.match(liveExhibitsSource, /createMetricLegend\(\{ className: "gaia-live-metric-legend"/u);
assert.match(liveExhibitsSource, /querySelector\("\.japan-credits"\)\.append\(weatherCredit\)/u);
assert.doesNotMatch(liveExhibitsSource, /OBSERVATION RELAY \/ PREFECTURE|MODEL \/ JAPAN · 47 PREFECTURES|className = "gaia-live-city-picker"/u);
assert.match(modeLoaderSource, /map-exhibit-actions\.css\?v=gaia-estat-copy-wrap-1/u);
assert.match(modeLoaderSource, /statistics-lab\.js\?v=inline-workspace-20260913/u);
assert.match(modeLoaderSource, /statistics-atmosphere\.css\?v=gaia-observation-studio-1/u);
await import("./check-map-action-statistics.mjs");
assert.match(modeLoaderSource, /firms-exhibit\.css\?v=gaia-firms-readout-fit-1/u);
assert.match(modeLoaderSource, /planet-signals-exhibit\.css\?v=gaia-epicenter-jump-1/u);
assert.match(modeLoaderSource, /map-chapter-navigation\.css\?v=gaia-estat-copy-wrap-1/u);
assert.match(html, /id="japan-title" data-exhibit-number="06" aria-label="積み重なるCO₂" aria-live="polite">積み重なるCO₂<\/h2>/u);
assert.match(html, /id="map-title-transition"[\s\S]{0,120}id="map-title-transition-text"/u);
assert.match(html, /class="map-title-transition-copy"[\s\S]{0,140}id="map-title-transition-subtitle"/u);
assert.match(html, /class="japan-map-actions"[\s\S]{0,320}id="japan-close"/u);
assert.match(html, /id="japan-poi-preview"[\s\S]{0,900}クリックで詳しく見る/u);
assert.match(appSource, /const updateJapanPoiHover = \(event\) =>[\s\S]{0,620}allowGridFallback: false/u);
assert.match(appSource, /renderJapanPoiFocus\(ctx, rect, left, top, now, ratio\)/u);
assert.match(appSource, /japanTitle\.textContent = selectedMapMode\.titleJa;/u);
assert.match(appSource, /const animateMapTitleTransition = \(title\) =>/u);
assert.match(appSource, /mapTitleTransitionText\.textContent = japanTitle\.textContent;/u);
assert.match(appSource, /mapTitleObserver\.observe\(japanTitle,[\s\S]{0,200}attributeFilter: \["data-exhibit-number"\]/u);
assert.match(appSource, /if \(mapTitleTransitionTitle === title\) return;/u);
assert.match(appSource, /japanLayer\.classList\.add\("is-map-title-transitioning"\)/u);
assert.match(appSource, /const MAP_TITLE_SEPARATOR_DURATION_MS = 3000;[\s\S]*const restartMapPlotReveal = \(reason = "mode-change"\)[\s\S]*waiting-for-separator/u);
assert.match(appSource, /const MAP_TITLE_SEPARATOR_REDUCED_DURATION_MS = 1960;/u);
assert.match(appSource, /mapTitleTransitionSubtitle.textContent = getMapTitleSubtitle\(japanTitle.dataset.exhibitNumber\)/u);
assert.match(appSource, /setProperty\("--map-title-duration", `\$\{separatorDuration\}ms`\)/u);
assert.match(appSource, /mapPlotRevealBlockedUntil = separatorStartedAt \+ separatorDuration[\s\S]*titleSeparatorEndsAt/u);
assert.match(appSource, /if \(mapPlotRevealBlockedUntil > 0 \|\| now < mapPlotRevealStartedAt\) \{\s*return \{ progress: 0, alpha: 0, scale: 0\.14 \};/u);
assert.match(appSource, /const firstPoiVisibleAt = mapPlotRevealStartedAt \+ \(reducedMotion \? 0 : MAP_PLOT_REVEAL_LEAD_MS\);[\s\S]*return null/u);
assert.match(appSource, /expansive = rect\.width >= 2400/u);
assert.match(appSource, /const blocks = \(renewable \? \[primary, secondary\] : \[primary, secondary, detail\]\)/u);
assert.match(appSource, /compact \? 19 : expansive \? 30 : 23/u);
assert.match(appSource, /compact \? 14 : expansive \? 22 : 17/u);
assert.match(appSource, /selectionLabelShape: "observation-card"/u);
assert.match(appSource, /selectionLabelTypography: "mincho"/u);
assert.match(appSource, /selectionLabelShadowBlur: "0"/u);
assert.match(appSource, /observationLabels\.forEach\(drawObservationLabel\)/u);
assert.match(appSource, /drawRainSelectionLabel\(point, row, getForestRainRadius\(row\.precipitationMmDay\)\)/u);
assert.match(appSource, /ctx\.fillText\(line\.text, x \+ padding \+ line\.left, y \+ line\.offset\)/u);
assert.match(appSource, /selectionLabelBackgroundAlpha: "0\.8"/u);
assert.doesNotMatch(appSource, /const traceSpeechBubble =/u);
assert.match(appSource, /\{ tone: "quiet", prominent: true, compactProminent: true, anchor: point, allowDuringPlotReveal: true,[\s\S]{0,180}preferBelow: true/u);
assert.match(appSource, /ctx\.globalAlpha \*= reveal\.alpha/u);
assert.match(appSource, /signalMode\.id === "blue-circulation"[\s\S]*getMapPlotReveal\(currentIndex, state\.currents\.length, now\)[\s\S]*applyMapPlotReveal\(ctx, point, reveal\)/u);
assert.match(appSource, /tier: "native", ratioCap: 3, maxPixels: 9000000/u);
assert.match(appSource, /dataset\.renderPixelRatio/u);
assert.match(mapGridStylesSource, /--map-grid-bank-height: 320px/u);
assert.match(mapGridScriptSource, /setProperty\("--map-grid-bank-height", `\$\{Math\.ceil\(bankHeight\)\}px`\)/u);
assert.match(mapGridStylesSource, /\.map-grid-bank \{[\s\S]{0,240}var\(--map-grid-route-stack\) \+ var\(--map-grid-gap\)/u);
assert.match(mapGridStylesSource, /\.map-grid-data \{[\s\S]{0,280}var\(--map-grid-bank-height\)/u);
assert.match(appSource, /dataset\.recyclingEncoding = "country-choropleth"/u);
assert.match(appSource, /国土の青 \/ 再資源化率/u);
assert.match(content.modes[3].description, /145の国・地域.*91地域.*54地域.*国土の青/u);
assert.match(modeLoaderSource, /styles\.css\?v=gaia-recycling-country-fill-1/u);
assert.match(appSource, /tooltip\.dataset\.placement = placement/u);
assert.match(appSource, /const target = usesCompactMapUi\(\) \? japanModeBank : japanLayer/u);
assert.match(appSource, /--map-tooltip-anchor-y/u);
assert.match(stylesSource, /\.map-mode-01-tooltip::before,\s*\.map-mode-01-tooltip::after\s*\{\s*content: none;/u);
assert.match(stylesSource, /\.map-mode-01-tooltip div > b[\s\S]{0,200}var\(--font-ui-ja\)/u);
assert.match(stylesSource, /\.map-mode-01-tooltip div > p[\s\S]{0,300}400 14px\/1\.8 var\(--font-ui-ja\)/u);
assert.match(appSource, /const animateMapReadingGuide = \(guide\) =>/u);
assert.match(appSource, /mapReadingGuideBody\?\.setAttribute\("aria-busy", "true"\)/u);
assert.match(stylesSource, /\.map-reading-guide\.is-mode-entering[\s\S]{0,180}map-reading-guide-enter/u);
assert.match(stylesSource, /@keyframes map-reading-guide-enter/u);
assert.match(html, /id="map-mode-preview"[\s\S]*id="map-mode-preview-number">06 \/ AIR<[\s\S]*id="map-mode-preview-label">積み重なるCO₂<[\s\S]*1958年からの濃度をたどり、観測・再構成・未来の試算を分けて読みます。/u);
assert.doesNotMatch(html, /id="map-mode-preview-(?:surface|title|lead|note)"/u);
assert.doesNotMatch(html, /data-intro-path="abstract"/u);
assert.doesNotMatch(html, /id="map-surface-map"|id="map-surface-light"|class="map-surface-switch"/u);
assert.match(html, /class="map-mode-groups"[\s\S]*id="japan-mode-list"/u);
assert.doesNotMatch(html, /id="map-light-overlay"|id="abstract-mode-list"|id="map-light-overlay-open"/u);
assert.doesNotMatch(appSource, /mapModePreview(?:Surface|Title|Lead|Note)/u);
assert.doesNotMatch(appSource, /setMapSurface|is-abstract-exhibit|abstractModeButton|abstractModeList/u);
assert.match(appSource, /getMapModePreviewContent[\s\S]*INTRO_MODE_CHOICES\[index\][\s\S]*choice\.copy/u);
assert.match(stylesSource, /\.japan-layer\.has-integrated-map-light \.japan-map > #gaia-canvas[\s\S]*z-index: 1[\s\S]*pointer-events: none !important[\s\S]*mix-blend-mode: screen/u);
assert.match(mapGridStylesSource, /\.japan-layer \.japan-heading \.japan-kicker[\s\S]{0,100}display: none !important/u);
assert.match(mapGridStylesSource, /\.japan-layer #japan-description[\s\S]{0,320}clip-path: inset\(50%\)/u);
assert.match(mapGridStylesSource, /body\.map-grid-desktop \.japan-layer \.map-grid-intro #japan-title[\s\S]{0,100}justify-self: center/u);
assert.match(mapGridStylesSource, /\.japan-layer \.japan-heading[\s\S]{0,220}background: transparent !important/u);
assert.match(mapGridStylesSource, /@keyframes map-title-separator-crossfade/u);
assert.match(mapGridStylesSource, /@keyframes map-title-return-home/u);
assert.match(appSource, /if \(path === "map"\)[\s\S]{0,440}openJapan\(\{ respectUrlMode: false, focusModeBank: false, entryExhibit: 1 \}\)/u);
assert.match(appSource, /aria-describedby", "map-mode-preview"/u);
assert.match(stylesSource, /\.intro-lp-hero :is\(\.intro-path-grid, \.intro-story-return\[data-primary-action="true"\]\)[\s\S]{0,220}width: min\(1000px, 100%\)/u);
assert.match(html, /データの出典を表示する/u);
assert.match(html, /データを統計分析する/u);
assert.doesNotMatch(html, /class="japan-data-button japan-story-button"/u);
assert.match(html, /data-signal-encoding-legend-title[\s\S]*凡例[\s\S]*MAP LEGEND/u);
assert.match(html, /id="map-mobile-heading-toggle"[\s\S]*id="map-mobile-legend-toggle"[\s\S]*id="map-mobile-bank-toggle"/u);
assert.match(appSource, /setMobileMapBankExpanded[\s\S]*is-mobile-bank-expanded[\s\S]*restoreFocus/u);
assert.match(appSource, /resetMobileMapUi\(\);/u);
assert.match(mapGridStylesSource, /Mobile exhibit HUD[\s\S]*is-mobile-heading-expanded[\s\S]*is-mobile-bank-expanded/u);
assert.match(liveExhibitsSource, /id="gaia-live-mobile-toggle"[\s\S]*gaia-live-exhibit-details/u);
assert.match(stylesSource, /\.signal-encoding-legend-title[\s\S]*font-size: 12px/u);
assert.match(stylesSource, /\.japan-layer\.is-live-exhibit \.japan-overlay \{[\s\S]*opacity: 0\.92;[\s\S]*visibility: visible;/u);
assert.match(stylesSource, /\.gaia-live-exhibit-readout \{[\s\S]*width: min\(590px, calc\(100vw - 520px\)\);[\s\S]*max-height: min\(440px/u);
assert.doesNotMatch(mapGridStylesSource, /\.japan-layer\.is-live-exhibit \.japan-heading \.japan-data-button[\s\S]{0,80}display: none/u);
assert.match(appSource, /dataLedger\.updateLiveExhibit\(liveExhibit/u);
assert.match(liveExhibitsSource, /timeZone: "Asia\/Tokyo"[\s\S]*JST/u);
assert.match(appSource, /renderCachedReferenceWorldModel\(ctx, rect, left, top\);[\s\S]*referenceBackdropOnly = liveBackdropOnly \|\| estatBackdropOnly[\s\S]*estat-reference-map-only[\s\S]*if \(referenceBackdropOnly\) \{[\s\S]*ctx\.restore\(\);[\s\S]*return;/u);
assert.match(appSource, /signalMode\.id === "anthropocene-scar"[\s\S]{0,700}drawNightLightsLayer\(nightLightsImage, nightLightsDimmed\);[\s\S]{0,320}renderCachedReferenceWorldModel\(ctx, rect, left, top\);/u);
assert.match(appSource, /"gaia:live-exhibit-change"[\s\S]*"gaia:planet-signals-change"[\s\S]*addEventListener\(eventName, syncExclusiveMapExhibit\)/u);
assert.match(appSource, /syncExclusiveMapExhibit[\s\S]*closeJapanPoi\(\)[\s\S]*renderJapanOverlay\(performance\.now\(\)\)/u);
assert.doesNotMatch(html, /gaia-remix-20/u);
assert.doesNotMatch(packageJson, /check-remix-modes/u);

console.log(JSON.stringify({
  status: "passed",
  exhibits: expectedIds,
  sharedWorldCopyHelperUses: (appSource.match(/getEarthWorldCopies\(projection\)/gu) || []).length,
}, null, 2));
