import { createMapTextLayer } from './map-text-layer.js?v=labels75-c363152-20261027';
import { earthBaseScale, earthLongitudeToMapX } from "./world-projection.js?v=gaia-japan-center-1";
import { decorateMapActions } from "./map-exhibit-actions.js?v=action-icons-ready-20260926";
import { CLIMATE_EXHIBITS, BASINS, windMS, format, stormPeak, stormLabel, colorFor, coralInsight, cycloneInsight, statisticsFor, daysInYear } from "./climate-history-model.js?v=insights75-scope-20261026";
import { atlasDefinition, atlasInsight, atlasStatistics, atlasRow } from "./atlas-history-model.js?v=insights75-scope-20261026";
import { createPoiYearCrossfade } from "./poi-year-crossfade.js?v=20260926";
import { lakeInsight, lakeStatistics } from "./surface-water-model.js?v=lakes-20261022";
import { createLakeView } from "./surface-water-view.js?v=labels75-c363152-20261027";
import { lakeFitCamera } from "./surface-water-spatial.js?v=lake-gis-20261022";
import { poiArrival, poiArrivalDuration } from "./annual-poi-arrival.js?v=20260909";
import { decodeWaterGrid, waterCellById, waterCellRegion, waterCellStatistics, waterCoordinates, waterRgba } from "./water-storage-grid.js?v=water-gis-20261022";
import { createWaterStorageView } from "./water-storage-view.js?v=labels75-c363152-20261027";
import { WATER_ARRIVAL_MS } from "./water-storage-poi.js?v=water-poi-20261023";
import { createCoralHeatView, CORAL_ARRIVAL_MS } from "./coral-heat-view.js?v=coral-current-20261023";
const cache = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Map(), buttons = /* @__PURE__ */ new Map();
let regionalPanel, lakeView;
const lakeTextLayer = createMapTextLayer('lakes');
const atlasFade = createPoiYearCrossfade();
let atlasArrival = null, atlasViewKey = "", lakeArrival = null, lakeDetail = !1, lakeAutoDetail = !1;
const waterView = createWaterStorageView();
let waterGrid = null, waterSelection = null, waterEntryFocus = !1;
const coralView = createCoralHeatView();
let coralArrival = null, countryEntryLayout = null;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let definition = CLIMATE_EXHIBITS[0], active = !1, dataState = "idle", generation = 0, data, season, year = 2016, month = 9, basin = "ALL", selectedId = "", playing = !1, frame = 0, lastStep = 0, lastDraw = 0, layer, map, canvas, context, buffer, bufferContext, readout, legend, geometryKey = "", hitPoints = [];
const q = (selector) => readout.querySelector(selector) || legend.querySelector(selector), isCoral = () => definition.id === "coral", isLake = () => definition.id === "lakes", isWater = () => definition.id === "waterstore", isAtlas = () => !!definition.atlas, isRegion = () => isCoral() || isLake() || isAtlas(), years = () => isRegion() ? [...new Set(data.regions.flatMap((r) => r.years.map((y) => y.year)))].sort((a, b) => a - b) : data.years.map((y) => y.year), storms = () => (season?.storms || []).filter((s) => basin === "ALL" || s.basin === basin), items = () => isRegion() ? data?.regions || [] : storms(), selected = () => isWater() && waterSelection ? waterCellRegion(waterGrid, waterSelection) : items().find((p) => p.id === selectedId);
const selectedRow = () => isAtlas() ? atlasRow(selected(), year, month) : selected()?.years?.find((r) => r.year === year), emit = (type) => dispatchEvent(new CustomEvent(`gaia:climate-${type}`, { detail: { active, id: definition.id, year, dataState } }));
async function load(file) {
  if (cache.has(file)) return cache.get(file);
  const url = file === "waterstore-grid" ? "../../data/atlas-history/waterstore-grid.json?v=water-gis-20261022" : atlasDefinition(file) ? `../../data/atlas-history/${file}.json?v=waterstore-20261025` : file === "lakes" ? "../../data/surface-water/lakes.json?v=20261022" : `../../data/climate-history/${file}.json?v=20261013`;
  return pending.has(file) || pending.set(file, fetch(new URL(url, import.meta.url), { signal: AbortSignal.timeout(3e4) }).then(async (response) => {
    if (!response.ok) throw new Error(`Climate snapshot HTTP ${response.status}`);
    let payload = file === "waterstore-grid" ? decodeWaterGrid(await response.json()) : await response.json();
    if (payload.schemaVersion !== 1 || !(payload.regions?.length || payload.years?.length || Array.isArray(payload.storms) && Number.isInteger(payload.year))) throw new Error("Invalid climate snapshot");
    cache.set(file, payload);
    const detailKeys = [...cache.keys()].filter((key) => key.startsWith("cyclones/"));
    for (; detailKeys.length > 3; ) cache.delete(detailKeys.shift());
    return payload;
  }).finally(() => pending.delete(file))), pending.get(file);
}
const setPlayback = (value) => {
  playing = !!value && active && dataState === "ready", lastStep = performance.now();
}, stopForInteraction = () => {
  setPlayback(!1), globalThis.GaiaMapPlayback?.stop("interaction");
}, setBusy = (value) => {
  readout.setAttribute("aria-busy", String(value)), legend.setAttribute("aria-busy", String(value));
}, focusAll = () => {
  if (isLake() && (lakeDetail = !1, lakeAutoDetail = !1, layer.classList.remove("is-lake-detail"), lakeView.setDetail(!1), geometryKey = "", q("[data-climate-overview]").textContent = "湖に戻る"), isAtlas() && innerWidth <= 900 && !isWater()) {
    focusPoint(selected());
    return;
  }
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: 150, lat: 8, zoom: 1, targetX: 0.5, targetY: 0.46, durationMs: isLake() ? 4200 : 450, easing: isLake() ? "lake-flight" : "smoothstep", label: "climate-world" });
};
function openLakeDetail({ durationMs = 4200 } = {}) {
  lakeDetail = !0, lakeAutoDetail = !1, layer.classList.add("is-lake-detail"), lakeView.setDetail(!0), geometryKey = "", hitPoints = [], q("[data-climate-overview]").textContent = "3湖の位置";
  const rect = map.getBoundingClientRect(), compact = innerWidth <= 900, shown = (e) => e?.checkVisibility({ visibilityProperty: !0 }), bottom = Math.min(rect.bottom - 30, ...[readout, document.querySelector("#map-responsive-data"), document.querySelector("#map-mobile-bottom")].filter(shown).map((e) => e.getBoundingClientRect().top - (compact ? 34 : 42))) - rect.top, top = (compact ? legend.getBoundingClientRect().bottom : parseFloat(getComputedStyle(layer).getPropertyValue("--responsive-legend-top")) || 150) - rect.top + (compact ? 18 : 28), left = compact ? 28 : 90, right = compact ? rect.width - 28 : Math.min(rect.width - 70, legend.getBoundingClientRect().left - rect.left - 45), area = { x: left, y: top, width: Math.max(100, right - left), height: Math.max(100, bottom - top) };
  globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ ...lakeFitCamera(selected().bounds, rect, area), durationMs: reduced.matches ? 0 : durationMs, easing: "lake-flight", label: "lake-geographic-window" });
}
let lakeLocatorKey = "", lakePanelKey = "";
function syncLakePanel() {
  if (!isLake() || !selected() || !lakeView) return;
  const point = selected(), row = selectedRow(), state = lakeView.getState(), adapter = globalThis.GaiaMapObservationAdapter, g = adapter?.getCountryGeometry?.(), panelKey = JSON.stringify([point.id, row?.year, state.compare, state.referenceReady, state.sample, g?.state]);
  if (panelKey === lakePanelKey) return;
  lakePanelKey = panelKey, q("[data-lake-name]").textContent = point.name, q("[data-lake-country]").textContent = point.country, q("[data-lake-compare]").setAttribute("aria-pressed", String(state.compare)), q("[data-lake-compare]").disabled = !state.referenceReady, q("[data-lake-change]").textContent = Number.isFinite(row?.changePercent) ? `2000年比 ${row.changePercent > 0 ? "+" : ""}${format(row.changePercent)}% · 共通観測部分` : "共通観測が揃う年を比較";
  const s = state.sample;
  q("[data-lake-panel]").dataset.hasSample = String(!!s), q("[data-lake-sample]").textContent = s ? `${s.year}年 ${s.label} / 2000年 ${s.referenceLabel || "読込中"}` : "水域をタップして、その場所の変化を見る", q("[data-lake-coordinates]").textContent = s ? `表示セル · ${Math.abs(s.lat).toFixed(3)}°${s.lat < 0 ? "S" : "N"} ${Math.abs(s.lon).toFixed(3)}°${s.lon < 0 ? "W" : "E"}` : "年を動かすと、同じ場所で比較できます";
  const key = `${point.id}/${g?.state}`;
  if (key === lakeLocatorKey) return;
  lakeLocatorKey = key;
  const mini = q("[data-lake-locator]"), c = mini.getContext("2d");
  c.clearRect(0, 0, mini.width, mini.height);
  const scale = mini.width / 60, x = mini.width / 2 - (point.lon + 180) * scale, y = mini.height / 2 - (90 - point.lat) * scale;
  c.save(), c.translate(x, y), c.scale(scale, scale), c.fillStyle = "#25434e", c.strokeStyle = "#7ca4ad", c.lineWidth = 0.45 / scale;
  for (const country of g?.countries || []) {
    const path = adapter.getCountryPath(country.iso3);
    path && (c.fill(path, "evenodd"), c.stroke(path));
  }
  c.restore(), c.fillStyle = "#ffdf9b", c.beginPath(), c.arc(mini.width / 2, mini.height / 2, 3, 0, Math.PI * 2), c.fill(), mini.setAttribute("aria-label", `${point.country}、${point.name}の位置`);
}
const focusPoint = (point) => {
  let p = isRegion() ? point : point?.points?.[Math.floor(point.points.length / 2)];
  if (isCoral() && p) {
    const compact = innerWidth <= 900, rect = map.getBoundingClientRect(), drawer = document.querySelector("#map-responsive-data"), dock = document.querySelector("#map-mobile-bottom"), visible = (e) => e?.checkVisibility({ visibilityProperty: !0 }), bottom = visible(drawer) ? drawer.getBoundingClientRect().bottom - drawer.querySelector(":scope > summary").getBoundingClientRect().height : visible(readout) ? readout.getBoundingClientRect().top : rect.bottom, top = legend.getBoundingClientRect().bottom, limit = Math.min(bottom, visible(dock) ? dock.getBoundingClientRect().top : rect.bottom);
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: p.lon, lat: p.lat, zoom: compact ? 2 : 2.4, targetX: compact ? 0.5 : 0.43, targetY: compact ? Math.max(0.4, Math.min(0.75, ((top + limit) / 2 - rect.top) / rect.height)) : 0.5, durationMs: reduced.matches ? 0 : 850, label: "coral-monitoring-region" });
    return;
  }
  if (isWater() && p) {
    const compact = innerWidth <= 900, rect = map.getBoundingClientRect(), drawer = document.querySelector("#map-responsive-data"), dock = document.querySelector("#map-mobile-bottom"), visible = (e) => e?.checkVisibility({ visibilityProperty: !0 }), controls = visible(drawer) ? drawer.getBoundingClientRect().bottom - drawer.querySelector(":scope > summary").getBoundingClientRect().height : visible(readout) ? readout.getBoundingClientRect().top : rect.bottom, top = legend.getBoundingClientRect().bottom, bottom = Math.min(controls, visible(dock) ? dock.getBoundingClientRect().top : rect.bottom), targetY = compact ? Math.max(0.4, Math.min(0.8, ((top + bottom) / 2 - rect.top) / rect.height)) : 0.5;
    globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: p.lon, lat: p.lat, zoom: compact ? 2 : 2.4, targetX: compact ? 0.5 : 0.42, targetY, durationMs: reduced.matches ? 0 : 900, label: "water-storage-region" });
    return;
  }
  p && (!isRegion() || Number.isFinite(p.lon) && Number.isFinite(p.lat)) && globalThis.GaiaMapObservationAdapter?.focusEarthLocation?.({ lon: isRegion() ? p.lon : p[2], lat: isRegion() ? p.lat : p[1], zoom: innerWidth <= 900 ? 1.25 : 1, targetX: isLake() ? 0.5 : 0.48, targetY: 0.45, durationMs: 500, label: "climate-observation" });
}, countryLayoutReady = (now) => {
  const key = [map, legend, document.querySelector("#map-responsive-data"), document.querySelector("#map-mobile-bottom")].map((e) => {
    const r = e?.getBoundingClientRect();
    return r ? [r.top, r.bottom, r.width, r.height, e.checkVisibility({ visibilityProperty: !0 })].join(",") : "";
  }).join("/");
  return !countryEntryLayout || countryEntryLayout.key !== key ? (countryEntryLayout = { key, since: now }, !1) : now - countryEntryLayout.since >= 100 && !0;
}, sync = () => {
  const coral = isCoral(), point = selected(), row = selectedRow(), peak = stormPeak(point);
  q("[data-climate-point]").value = selectedId, q("[data-climate-year]").value = String(year), q("[data-climate-period]").textContent = `${year}${isRegion() ? "年" : "シーズン"}`, q("[data-climate-metric]").textContent = coral ? "年内最大DHW" : "経路内の最大1分平均風速", q("[data-climate-value]").textContent = coral ? `${format(row?.max)}${row ? " ℃・週" : ""}` : `${format(windMS(peak))}${peak != null ? " m/s" : ""}`, q("[data-climate-detail]").textContent = isLake() || isAtlas() ? "" : coral ? row ? `DHW ≥ 8：${row.days8}日 / 有効 ${row.validDays}/${daysInYear(year)}日` : "この年の記録なし" : point ? `${point.points.length}時刻 / ${new Date(point.points[0][0] * 36e5).toISOString().slice(0, 10)}から` : "この海域の経路なし", q("[data-climate-selected]").textContent = point ? isRegion() ? point.name : stormLabel(point) : "記録なし", q("[data-climate-insight]").textContent = coral ? coralInsight(point, row) : cycloneInsight(storms(), year), q("[data-climate-analysis]").disabled = !point && isRegion(), q("[data-climate-status]").textContent = coral ? `NOAA Coral Reef Watch / ${data.regions.length}監視海域 / 1986–2025年` : `NOAA IBTrACS v4r01 / ${storms().length}主要経路 / 1980–2024シーズン`, isLake() && (q("[data-climate-metric]").textContent = "湖周辺の水面積", q("[data-climate-value]").textContent = row?.coverage > 0 ? `${format(row.water)} km²` : "欠測", q("[data-climate-detail]").textContent = row ? `水域内の観測カバー率 ${format(row.coverage)}%` : "この年の記録なし", q("[data-climate-insight]").textContent = lakeInsight(point, row), q("[data-climate-status]").textContent = "Source: EC JRC/Google · GSW v1.0 · 1984–2015年 · 3湖周辺の固定範囲", point && row && lakeView.show(point, row)), isAtlas() && (q("[data-climate-metric]").textContent = definition.metric, q("[data-climate-value]").textContent = Number.isFinite(row?.value) ? `${format(row.value)} ${definition.unit}` : "欠測", q("[data-climate-detail]").textContent = definition.id === "snowcover" ? "扇の面積 = 各月の積雪面積" : definition.id === "waterstore" ? `有効 ${row?.months || 0}/12か月` : definition.id === "sealevel" ? `${row?.mission || ""} / ${row?.samples || 0}観測` : "国・地域の公表・推計値", q("[data-climate-insight]").textContent = `${atlasInsight(definition, point, year, month)}${definition.visualReading ? ` ${definition.visualReading}` : ""}`, q("[data-climate-status]").textContent = `${definition.organisation} / ${data.period.join("–")}年 / ${data.regions.length}対象範囲`, q("[data-climate-guide]").textContent = `${definition.guide} ${data.method || ""}`, q("[data-climate-analysis]").disabled = !point || !atlasStatistics(definition, data, point, month)?.rows.length), isWater() && syncWaterPanel(), isCoral() && syncCoralPanel(), geometryKey = "", emit("update");
};
function syncCoralPanel() {
  const point = selected(), row = selectedRow();
  q("[data-coral-name]").textContent = point?.name || "監視海域を選択", q("[data-coral-period]").textContent = `${year}年 · 熱ストレスが高かった日数`;
  for (const threshold of [4, 8]) {
    const value = row?.[`days${threshold}`], valid = Number.isFinite(value), bar = q(`[data-coral-days="${threshold}"]`);
    bar.textContent = valid ? `${value}日` : "欠測", q(`[data-coral-bar="${threshold}"]`).style.width = `${valid ? Math.max(0, Math.min(100, value / daysInYear(year) * 100)) : 0}%`;
  }
  q("[data-coral-coverage]").textContent = `有効 ${row?.validDays ?? 0}/${daysInYear(year)}日 · 円弧：DHW ≥ 8 の日数`;
}
function syncWaterPanel() {
  const point = selected(), row = selectedRow();
  q("[data-water-title]").textContent = waterSelection ? "選択した陸域" : point.name, q("[data-water-place]").textContent = waterSelection ? waterCoordinates(waterSelection) : "固定範囲の平均", q("[data-water-value]").textContent = Number.isFinite(row?.value) ? `${row.value > 0 ? "+" : ""}${format(row.value)} cm` : "欠測", q("[data-water-period]").textContent = `${year}年 · 有効 ${row?.months || 0}/12か月`, q("[data-water-chart]").setAttribute("aria-label", `${point.name}、2003年から2024年の陸水量偏差。${year}年 ${Number.isFinite(row?.value) ? format(row.value) + "cm" : "欠測"}。基準は2004–2009年。`);
  const c = q("[data-water-chart]").getContext("2d"), w = c.canvas.width, h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  const max = Math.max(10, ...point.years.filter((r) => Number.isFinite(r.value)).map((r) => Math.abs(r.value))), zero = h / 2;
  c.strokeStyle = "#aac8ce40", c.lineWidth = 1, c.beginPath(), c.moveTo(0, zero), c.lineTo(w, zero), c.stroke();
  for (const [i, r] of point.years.entries()) {
    const x = 5 + i * (w - 10) / 22, bw = (w - 10) / 22 - 3;
    if (Number.isFinite(r.value)) {
      const y = zero - r.value / max * (h / 2 - 8), [red, g, b] = waterRgba(r.value);
      c.fillStyle = `rgb(${red},${g},${b})`, c.globalAlpha = r.year === year ? 1 : 0.65, c.fillRect(x, Math.min(y, zero), bw, Math.max(1, Math.abs(y - zero)));
    } else
      c.strokeStyle = "#8c9da780", c.beginPath(), c.moveTo(x, zero + 4), c.lineTo(x + bw, zero - 4), c.stroke();
    r.year === year && (c.globalAlpha = 1, c.strokeStyle = "#ffdf9b", c.strokeRect(x - 1, 1, bw + 2, h - 2));
  }
  c.globalAlpha = 1, q("[data-climate-metric]").textContent = waterSelection ? "選択セル · 陸水量偏差" : "広域平均 · 陸水量偏差", q("[data-climate-detail]").textContent = `${waterSelection ? "配布0.5° / 推定約3° · " : ""}有効 ${row?.months || 0}/12か月`, q("[data-climate-status]").textContent = "NASA JPL / GRACE・GRACE-FO · 2003–2024年 · 2004–2009年基準";
}
function fillPoints() {
  const list = items();
  if (isWater() && waterSelection) {
    q("[data-climate-point]").replaceChildren(...list.map((p) => new Option(p.name, p.id)), new Option(`選択セル ${waterCoordinates(waterSelection)}`, selectedId));
    return;
  }
  list.some((p) => p.id === selectedId) || (selectedId = isRegion() ? list.find((p) => p.id === (isAtlas(), "southern_ryukyu_islands"))?.id || list[0]?.id || "" : list.reduce((best, p) => !best || (stormPeak(p) ?? -1) > (stormPeak(best) ?? -1) ? p : best, null)?.id || ""), q("[data-climate-point]").replaceChildren(...list.map((p) => new Option(isRegion() ? p.name : stormLabel(p), p.id)));
}
async function setYear(next) {
  if (!active || !data || !years().includes(Number(next))) return;
  (isAtlas() || isCoral()) && dataState === "ready" && Number(next) !== year && !reduced.matches && !canvas.hidden && atlasFade.capture(canvas, atlasViewKey);
  // Keep the year fieldset enabled so native mouse/touch drags are not cancelled.
  // The generation ticket already rejects obsolete asynchronous loads.
  const ticket = ++generation;
  year = Number(next), dataState = "loading", season = null, geometryKey = "", hitPoints = [], setBusy(!0), !isAtlas() && !isCoral() && context.clearRect(0, 0, canvas.width, canvas.height), q("[data-climate-analysis]").disabled = !0, q("[data-climate-value]").textContent = "—", q("[data-climate-period]").textContent = `${year}${isRegion() ? "年" : "シーズン"}`, q("[data-climate-detail]").textContent = "", q("[data-climate-selected]").textContent = `${year}の記録`, q("[data-climate-insight]").textContent = `${year}の記録を読み込んでいます。`, q("[data-climate-status]").textContent = isAtlas() ? "保存データを読込中…" : isLake() ? "JRC保存データを読込中…" : "NOAA保存データを読込中…", q("[data-climate-retry]").hidden = !0;
  try {
    const payload = isRegion() ? null : await load(`cyclones/${year}`);
    if (!active || ticket !== generation) return;
    season = payload, dataState = "ready", fillPoints(), sync(), setBusy(!1), q("[data-climate-controls]").disabled = !1, legend.hidden = !1, lastStep = performance.now(), emit("ready"), resume();
  } catch (error) {
    active && ticket === generation && fail(error);
  }
}
function fail(error) {
  lakeView?.clear(), setBusy(!1), dataState = "error", playing = !1, q("[data-climate-status]").textContent = "保存データの読込に失敗しました。再試行できます。", q("[data-climate-retry]").hidden = !1, emit("error"), console.warn("Climate snapshot unavailable", error);
}
function selectPoint(id, { focus = !0, sample = null } = {}) {
  if (isCoral() && !focus && stopForInteraction(), isWater() && dataState === "ready") {
    focus || stopForInteraction();
    const cell = waterCellById(waterGrid, id);
    if (cell) {
      stopForInteraction(), waterSelection = cell, selectedId = cell.id, fillPoints(), sync(), focus && focusPoint(selected());
      return;
    }
    if (!items().some((p) => p.id === id)) return;
    waterSelection = null;
  }
  if (!(dataState !== "ready" || !items().some((p) => p.id === id))) {
    if (isLake() && sample) {
      stopForInteraction(), lakeView.selectSample(sample);
      return;
    }
    selectedId = id, sync(), isLake() ? openLakeDetail() : (focus || isWater()) && focusPoint(selected());
  }
}
const projection = () => {
  const rect = globalThis.GaiaMapObservationAdapter?.getViewportRect?.() || map.getBoundingClientRect(), d = document.querySelector("#japan-overlay").dataset, scale = earthBaseScale(rect) * Math.max(1, Number(d.earthZoom) || 1);
  return { rect, scale, x: (rect.width - 360 * scale) / 2 + (Number(d.earthOffsetX) || 0), y: (rect.height - 180 * scale) / 2 + (Number(d.earthOffsetY) || 0) };
};
function paint(view, ratio, now) {
  if(isLake())return lakeTextLayer.record(bufferContext,ctx=>paintScene(view,ratio,now,ctx),{host:canvas,width:view.rect.width,height:view.rect.height,view,ratio,key:[year,selectedId].join('/')});
  return paintScene(view,ratio,now,bufferContext);
}
function paintScene(view, ratio, now, ctx) {
  const { rect, scale } = view;
  buffer.width !== canvas.width && (buffer.width = canvas.width), buffer.height !== canvas.height && (buffer.height = canvas.height), ctx.setTransform(1, 0, 0, 1, 0, 0), ctx.clearRect(0, 0, buffer.width, buffer.height), ctx.setTransform(ratio, 0, 0, ratio, 0, 0), hitPoints = [];
  const xy = (lon, lat) => ({ x: view.x + earthLongitudeToMapX(lon) * scale, y: view.y + (90 - lat) * scale }), visible = (p) => p.x >= -12 && p.y >= -12 && p.x <= rect.width + 12 && p.y <= rect.height + 12;
  if (isCoral())
    hitPoints = coralView.paint(ctx, { regions: data.regions, year, selectedId, xy, scale, width: rect.width, height: rect.height, ratio, elapsed: coralArrival === null ? -1 : now - coralArrival, reduced: reduced.matches }), canvas.dataset.coralEngine = coralView.getState().engine;
  else if (isWater()) {
    const result = waterView.paint(ctx, { data: waterGrid, regions: data.regions, year, view, ratio, labelHost: canvas, elapsed: atlasArrival === null ? -1 : now - atlasArrival, reduced: reduced.matches, cell: waterSelection, region: selected() });
    hitPoints = result.points, canvas.dataset.atlasGeometryState = result.state, canvas.dataset.atlasEngine = waterView.getState().engine;
  } else if (isRegion())
    for (const [index, region] of data.regions.entries()) {
      const point = xy(region.lon, region.lat), row = region.years.find((y) => y.year === year);
      if (!visible(point) || isLake() && lakeDetail && scale > 30) continue;
      const arrival = isLake() ? poiArrival(index, data.regions.length, lakeArrival === null ? -1 : now - lakeArrival, reduced.matches) : { alpha: 1, scale: 1 };
      if (!arrival.alpha) continue;
      const color = isLake() ? "#8ad9ca" : colorFor("coral", row?.max), chosen = region.id === selectedId, radius = chosen ? 7 : 4;
      ctx.beginPath(), ctx.arc(point.x, point.y, radius * arrival.scale, 0, Math.PI * 2), ctx.fillStyle = color, ctx.globalAlpha = arrival.alpha * (chosen ? 1 : 0.7), ctx.fill(), chosen && (ctx.strokeStyle = "#fff1ba", ctx.lineWidth = 1.5, ctx.beginPath(), ctx.arc(point.x, point.y, 11 * arrival.scale, 0, Math.PI * 2), ctx.stroke()), isLake() && (ctx.font = "14px sans-serif", ctx.textAlign = "center", ctx.lineWidth = 4, ctx.strokeStyle = "#081923", ctx.strokeText(region.name, point.x, point.y - 20), ctx.fillStyle = "#d9f5ef", ctx.fillText(region.name, point.x, point.y - 20)), arrival.alpha >= 0.9 && hitPoints.push({ ...point, id: region.id, lon: region.lon, lat: region.lat });
    }
  else {
    const ordered = [...storms()].sort((a, b) => +(a.id === selectedId) - +(b.id === selectedId));
    for (const storm of ordered) {
      const chosen = storm.id === selectedId;
      ctx.lineWidth = chosen ? 3 : 1.2, ctx.globalAlpha = chosen ? 1 : 0.58;
      for (let i = 1; i < storm.points.length; i++) {
        const a = storm.points[i - 1], b = storm.points[i], p = xy(a[2], a[1]), n = xy(b[2], b[1]);
        Math.abs(p.x - n.x) > 180 * scale || (ctx.strokeStyle = colorFor("cyclones", windMS(b[3])), ctx.beginPath(), ctx.moveTo(p.x, p.y), ctx.lineTo(n.x, n.y), ctx.stroke(), visible(n) && hitPoints.push({ ...n, id: storm.id, lon: b[2], lat: b[1] }));
      }
      if (chosen) {
        const peakIndex = storm.points.findIndex((p2) => p2[3] === stormPeak(storm)), p = storm.points[Math.max(0, peakIndex)], n = xy(p[2], p[1]);
        ctx.strokeStyle = "#fff1ba", ctx.lineWidth = 2, ctx.beginPath(), ctx.arc(n.x, n.y, 8, 0, Math.PI * 2), ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1, canvas.dataset.climateVisibleCount = String(new Set(hitPoints.map((p) => p.id)).size), canvas.dataset.climateRenderedYear = String(year), canvas.dataset.climatePaintCount = String(Number(canvas.dataset.climatePaintCount || 0) + 1);
}
function draw(now) {
  if (frame = 0, !active || document.hidden || layer.hidden) return;
  if (frame = requestAnimationFrame(draw), canvas.hidden = layer.matches(".is-map-title-transitioning, .is-map-data-intro"), canvas.hidden) {
    countryEntryLayout = null, lastStep = now, isLake() && (lakeArrival = null, lakeView.setVisible(!1)), (isAtlas() || isCoral()) && (atlasArrival = coralArrival = null, atlasFade.reset());
    return;
  }
  const fps = isCoral() && coralView.getState().field.engine === "canvas2d" ? 12 : 24;
  if (dataState !== "ready" || now - lastDraw < 1e3 / fps) return;
  if (lastDraw = now, isWater() && waterEntryFocus) {
    if (lastStep = now, !countryLayoutReady(now)) return;
    waterEntryFocus = !1, countryEntryLayout = null, focusPoint(selected());
    return;
  }
  let arriving = !1;
  if (isCoral()) {
    if (document.querySelector("#japan-overlay").dataset.viewAnimation === "running" && coralArrival === null) {
      lastStep = now;
      return;
    }
    coralArrival ??= now, arriving = !reduced.matches && now - coralArrival < CORAL_ARRIVAL_MS, canvas.dataset.climateArrival = arriving ? "running" : "complete", arriving && (lastStep = now);
  }
  if (isAtlas()) {
    if (document.querySelector("#japan-overlay").dataset.viewAnimation === "running" && atlasArrival === null) {
      lastStep = now;
      return;
    }
    const seaGeography = null;
    atlasArrival ??= now, arriving = atlasArrival === null || now - atlasArrival < (isWater() ? WATER_ARRIVAL_MS : poiArrivalDuration(data.regions.length)), canvas.dataset.climateArrival = arriving ? "running" : "complete", arriving && (lastStep = now);
  }
  if (isLake()) {
    const moving = document.querySelector("#japan-overlay").dataset.viewAnimation === "running";
    if (moving && (lastStep = now), moving && lakeArrival === null) return;
    lakeArrival ??= now, arriving = now - lakeArrival < poiArrivalDuration(data.regions.length), canvas.dataset.climateArrival = arriving ? "running" : "complete", arriving && (lastStep = now), !arriving && lakeAutoDetail && now - lakeArrival >= poiArrivalDuration(data.regions.length) + 700 && openLakeDetail(), lakeView.setVisible(!0), lakeView.paint(projection(), now), syncLakePanel();
  }
  if (playing && now - lastStep >= 6500) {
    const list = years();
    lastStep = now, setYear(list[(list.indexOf(year) + 1) % list.length]);
    return;
  }
  const view = projection(), { rect } = view, ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(18e5 / Math.max(1, rect.width * rect.height))), key = [definition.id, year, month, basin, selectedId, "", "", rect.width, rect.height, view.scale, view.x, view.y, ratio, isCoral() ? globalThis.GaiaMapObservationAdapter?.getCountryGeometry?.()?.state : ""].join("/"), flowing = (isCoral() || !1) && !reduced.matches;
  if (key === geometryKey && !arriving && !atlasFade.getState().active && !flowing) return;
  geometryKey = arriving ? "" : key;
  const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
  canvas.width !== width && (canvas.width = width), canvas.height !== height && (canvas.height = height), paint(view, ratio, now), context.setTransform(1, 0, 0, 1, 0, 0), context.clearRect(0, 0, width, height), context.drawImage(buffer, 0, 0), atlasViewKey = [rect.width, rect.height, view.scale, view.x, view.y, ratio].join("/"), (isAtlas() || isCoral()) && atlasFade.paint(context, atlasViewKey, now, reduced.matches), canvas.dataset.yearFade = atlasFade.getState().active ? "running" : "complete";
  if(isWater())waterView.presentLabels(atlasFade.getState());
  else if(isLake())lakeTextLayer.present();
}
function resume() {
  active && !frame && !document.hidden && !layer.hidden && (frame = requestAnimationFrame(draw));
}
function findPoiAt(clientX, clientY, pointerType) {
  if (!active || dataState !== "ready" || layer.matches(".is-map-title-transitioning, .is-map-data-intro")) return null;
  if (isWater()) {
    if (canvas.dataset.climateArrival !== "complete") return null;
    const hit = waterView.pick(clientX, clientY, projection(), data.regions), p = hit?.region || (hit?.cell ? waterCellRegion(waterGrid, hit.cell) : null);
    return p ? { type: "exhibit", index: Math.max(0, items().findIndex((r) => r.id === p.id)), record: { id: p.id, exhibitId: "waterstore", lon: p.lon, lat: p.lat, title: p.name, kicker: hit.cell ? "75 / 配布0.5° · 推定約3°" : "75 / 広域平均", preview: `${year}年 ${format(atlasRow(p, year)?.value)} cm`, url: definition.source } } : null;
  }
  if (isLake() && lakeDetail && projection().scale > 30) {
    const sample = lakeView.pick(clientX, clientY);
    return sample ? { type: "exhibit", index: items().indexOf(selected()), record: {
      id: selectedId,
      exhibitId: "lakes",
      lon: sample.lon,
      lat: sample.lat,
      title: selected().name,
      lakeSample: sample,
      kicker: "74 / 表示セルの年次分類",
      preview: `${sample.year}年 ${sample.label}`,
      url: definition.source
    } } : null;
  }
  const { rect } = projection(), x = clientX - rect.left, y = clientY - rect.top;
  let best = null, distance = pointerType === "touch" ? 22 : 12;
  {
    const view = projection(), points = (isLake() || isCoral()) && canvas.dataset.climateArrival === "complete" ? data.regions.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, x: view.x + earthLongitudeToMapX(p.lon) * view.scale, y: view.y + (90 - p.lat) * view.scale })) : hitPoints;
    for (const p of points) {
      const d = Math.hypot(p.x - x, p.y - y);
      d < distance && (best = p, distance = d);
    }
  }
  if (!best) return null;
  const item = items().find((p) => p.id === best.id), title = best.event?.name || (isRegion() ? item.name : stormLabel(item)), lakeRow = isLake() ? item.years.find((r) => r.year === year) : null;
  return isAtlas() ? { type: "exhibit", index: items().indexOf(item), record: {
    id: item.id,
    exhibitId: definition.id,
    lon: best.lon,
    lat: best.lat,
    title,
    kicker: `${definition.number} / ${definition.metric}`,
    preview: best.event ? `${year}/${best.event.month ?? "—"}/${best.event.day ?? "—"} · ${definition.id === "volcanoes" ? "VEI" : "沿岸最大観測高"} ${format(best.event.magnitude)}${definition.id === "tsunamis" ? " m" : ""}` : `${year}年 / ${format(atlasRow(item, year, month)?.value)} ${definition.unit}`,
    url: definition.source
  } } : { type: "exhibit", index: items().indexOf(item), record: {
    id: item.id,
    exhibitId: definition.id,
    lon: best.lon,
    lat: best.lat,
    title,
    kicker: `${definition.number} / ${isLake() ? "EC JRC/Google" : "NOAA"}`,
    preview: `${year} / ${isLake() ? lakeRow?.coverage > 0 ? format(lakeRow.water) + " km²" : "欠測" : isCoral() ? format(item.years.find((r) => r.year === year)?.max) + " ℃・週" : format(windMS(stormPeak(item))) + " m/s"}`,
    url: definition.source
  } };
}
function deactivate() {
  lakeTextLayer.reset();
  active && (active = !1, generation++, playing = !1, dataState = "idle", cancelAnimationFrame(frame), frame = 0, hitPoints = [], regionalPanel?.closeRegionalAnalysis(), lakeView?.clear(), lakeArrival = null, lakeDetail = !1, lakeAutoDetail = !1, atlasArrival = null, atlasFade.reset(), waterView.reset(), waterGrid = null, waterSelection = null, waterEntryFocus = !1, coralView.reset(), coralArrival = null, layer.classList.remove("is-climate-history-exhibit", "is-lake-detail"), delete layer.dataset.climateExhibit, canvas.hidden = readout.hidden = legend.hidden = !0, buttons.get(definition.id)?.setAttribute("aria-current", "false"), emit("change"), setBusy(!1));
}
async function select(id) {
  lakeTextLayer.reset();
  const target = CLIMATE_EXHIBITS.find((d) => d.id === id);
  if (!target) return;
  regionalPanel?.closeRegionalAnalysis(), lakeView?.clear(), layer.classList.remove("is-lake-detail"), lakeLocatorKey = lakePanelKey = "", lakeArrival = null, lakeDetail = !1, lakeAutoDetail = !1, atlasArrival = null, atlasFade.reset(), waterView.reset(), waterGrid = null, waterSelection = null, waterEntryFocus = !1, coralView.reset(), coralArrival = null;
  for (const provider of [globalThis.GaiaLiveExhibits, globalThis.GaiaEstatExhibits, globalThis.GaiaFirmsExhibit, globalThis.GaiaPlanetSignals, globalThis.GaiaMarineCod, globalThis.GaiaFoodExhibits]) provider?.deactivate?.();
  const ticket = ++generation;
  definition = target, active = !0, dataState = "loading", data = null, season = null, year = 2016, month = definition.defaultMonth || 9, basin = "ALL", selectedId = "", playing = !1, geometryKey = "", hitPoints = [], layer.classList.add("is-climate-history-exhibit"), layer.dataset.climateExhibit = id, canvas.dataset.climateArrival = "waiting", canvas.dataset.climateRenderedYear = "", canvas.dataset.yearFade = "complete", canvas.dataset.atlasEngine = "idle", globalThis.GaiaMapObservationAdapter?.closePoi?.(), canvas.hidden = readout.hidden = !1, legend.hidden = !0, context.clearRect(0, 0, canvas.width, canvas.height);
  for (const b of globalThis.GaiaMapCategories.buttons()) b.setAttribute("aria-current", String(b === buttons.get(id)));
  for (const selector of ["#japan-mode-title", "#japan-title"]) document.querySelector(selector).textContent = target.shortTitle;
  document.querySelector("#japan-mode-number").textContent = target.number;
  const title = document.querySelector("#japan-title");
  title.dataset.exhibitNumber = target.number, title.setAttribute("aria-label", `${target.number} ${target.shortTitle}`), q("[data-climate-number]").textContent = target.number, q("[data-climate-title]").textContent = target.shortTitle, q("[data-climate-category]").textContent = definition.category || (isRegion() ? "世界 · 水と森" : "世界 · 空と天気"), q(".gaia-climate-scale").style.background = isAtlas() ? `linear-gradient(90deg,${definition.colors.join(",")})` : "", q(".gaia-climate-scale").hidden = !!definition.qualitativeLegend, q("[data-climate-guide]").closest("details").open = !1, q("[data-lake-panel]").hidden = !isLake(), q("[data-water-panel]").hidden = !isWater(), q("[data-coral-panel]").hidden = !isCoral(), q("[data-climate-point]").setAttribute("aria-label", isWater() ? "比較する地域・選択した陸域" : "監視海域・台風を選択"), q("[data-climate-controls]").disabled = q("[data-climate-analysis]").disabled = !0, setBusy(!0), q("[data-climate-basin-label]").hidden = isRegion() && !0, q("[data-climate-basin-caption]").textContent = "海域", q("[data-climate-basin]").setAttribute("aria-label", "台風の海域"), q("[data-climate-basin]").replaceChildren(...Object.entries(BASINS).map(([id2, label]) => new Option(label, id2))), q("[data-climate-basin]").value = "ALL", q("[data-climate-point]").replaceChildren(), q("[data-climate-regional]").hidden = isRegion(), q("[data-climate-overview]").textContent = isAtlas() && innerWidth <= 900 ? "選択へ戻る" : "全体を見る", q("[data-climate-value]").textContent = "—", q("[data-climate-detail]").textContent = "", q("[data-climate-retry]").hidden = !0, q("[data-climate-status]").textContent = "NOAA保存データを読込中…", q("[data-climate-key-title]").textContent = isCoral() ? "年内最大DHW（℃・週）" : "1分平均風速（m/s）", q("[data-climate-labels]").replaceChildren(...(isCoral() ? ["0", "2", "4", "8", "16+"] : ["0", "17", "33", "50", "65+"]).map((label) => {
    const span = document.createElement("span");
    return span.textContent = label, span;
  })), q("[data-climate-guide]").textContent = isCoral() ? "衛星による水温観測から、監視海域の高温域（HotSpotの90パーセンタイル）を取り出し、直近84日間の熱ストレスをDHWとして積算。点は監視海域の代表位置。色と描画上の大きさは年内最大DHW（大きさは16で上限）、円弧は一年のうちDHWが8以上だった日数。海全体の色面は点の色を滑らかにつないだ演出、流線は海の循環をイメージした動きです。観測値は点を選んで確認できます。4・8℃・週はNOAAが白化リスクの目安に用いる水準です。灰色の輪は欠測。" : "NOAA IBTrACS v4r01の主要経路（MAIN）を表示。線の色はUSA_WIND（1分平均風速）をm/sに換算し、灰色は風速欠測。輪は選択経路の最大風速地点です。位置記録には補間時刻を含みます。南半球のシーズンは暦年をまたぎます。海域は各経路の最初の記録で分類し、別経路（spur）は除外しています。", isLake() && (q("[data-climate-key-title]").textContent = "水域の記録", q("[data-climate-labels]").replaceChildren(...["● 通年", "● 季節的", "● 観測なし"].map((text) => {
    const span = document.createElement("span");
    return span.textContent = text, span;
  })), q("[data-climate-status]").textContent = "JRC保存データを読込中…", q("[data-climate-guide]").textContent = "Landsatの年次水域分類（GSW v1.0、1984–2015年）を、3湖周辺の固定矩形範囲で集計しています。通年と季節的な水域の合計です。原画素のWGS84楕円体面積を足し、図だけを縮小。湖周辺の別の水域も含みます。観測カバー率は通期に一度でも水域と分類された範囲が分母。2000年比は両年で観測できた画素だけで計算し、共通カバー率95%以上で表示します。年次分類は一年の観測をまとめた記録で、単日の湖岸線や年平均面積とは区別します。欠測は補間せず、分類・観測時期・湖岸の画素誤差を含みます。新版の位置補正を混在させず、2015年までの原版に限定しています。"), isAtlas() && (q("[data-climate-key-title]").textContent = isWater() ? "陸水量偏差 · 2004–09年比" : definition.legendMetric || definition.metric, q("[data-climate-labels]").replaceChildren(...definition.labels.map((text) => {
    const span = document.createElement("span");
    return span.textContent = text, span;
  })), q("[data-climate-guide]").textContent = definition.guide, q("[data-climate-status]").textContent = "保存データを読込中…"), emit("change");
  try {
    const [payload, grid] = await Promise.all([load(id), isWater() ? load("waterstore-grid") : null]);
    if (!active || generation !== ticket) return;
    data = payload, waterGrid = grid;
    const list = years(), slider = q("[data-climate-year]");
    if (slider.min = String(list[0]), slider.max = String(list.at(-1)), slider.step = "1", slider.value = "2016", await setYear(isLake() ? 2010 : 2016), !active || definition.id !== id) return;
    isLake() ? (focusPoint(selected()), lakeAutoDetail = !0) : isWater() && innerWidth <= 900 ? (selectedId = "india", sync(), waterEntryFocus = !0) : isCoral() && innerWidth <= 900 ? focusPoint(selected()) : focusAll(), resume();
  } catch (error) {
    active && generation === ticket && fail(error);
  }
}
const statisticsDataset = () => active && dataState === "ready" ? isWater() && waterSelection ? waterCellStatistics(definition, waterGrid, waterSelection) : isAtlas() ? atlasStatistics(definition, data, selected(), month) : isLake() ? lakeStatistics(selected()) : statisticsFor({ kind: definition.id, data, region: selected(), basin }) : null;
async function restoreStatisticsDataset(id) {
  const match = /^climate-([a-z]+)-([a-zA-Z0-9_-]+)$/.exec(id);
  if (!match || !CLIMATE_EXHIBITS.some((d2) => d2.id === match[1])) return null;
  const [, kind, key] = match, payload = await load(kind), d = atlasDefinition(kind), period = d?.monthly ? /^(.*)-m(\d{2})$/.exec(key) : null;
  if (kind === "waterstore" && key.startsWith("cell-")) {
    const grid = await load("waterstore-grid"), cell = waterCellById(grid, key);
    return cell ? waterCellStatistics(d, grid, cell) : null;
  }
  if (d?.monthly && (!period || +period[2] < 1 || +period[2] > 12)) return null;
  const region = payload.regions?.find((r) => r.id === (period ? period[1] : key));
  return (kind !== "cyclones" ? !region : !Object.hasOwn(BASINS, key)) ? null : d ? atlasStatistics(d, payload, region, period ? +period[2] : void 0) : kind === "lakes" ? lakeStatistics(region) : statisticsFor({ kind, data: payload, region, basin: key });
}
function mount() {
  if (readout || (layer = document.querySelector("#japan-layer"), map = document.querySelector("#japan-map"), !map)) return;
  canvas = document.createElement("canvas"), canvas.id = "gaia-climate-canvas", canvas.hidden = !0, canvas.setAttribute("aria-hidden", "true"), map.append(canvas), context = canvas.getContext("2d"), buffer = document.createElement("canvas"), bufferContext = buffer.getContext("2d"), readout = document.createElement("section"), readout.className = "gaia-climate-readout", readout.hidden = !0, readout.setAttribute("aria-label", "気候記録の海域・対象・年"), readout.innerHTML = `<div class="gaia-climate-chapter"><p data-climate-category></p><button type="button" data-map-bank-toggle aria-expanded="false" aria-controls="map-dock-bank-popover"><b data-climate-number></b><strong data-climate-title></strong></button></div>
    <p class="gaia-climate-status" data-climate-status role="status"></p><button type="button" data-climate-retry hidden>再試行</button>
    <fieldset data-climate-controls disabled><legend class="gaia-climate-sr">観測記録を選ぶ</legend><div class="gaia-climate-pickers"><label data-climate-basin-label><span data-climate-basin-caption>海域</span><select data-climate-basin aria-label="台風の海域"></select></label><label>記録<select data-climate-point aria-label="監視海域・台風を選択"></select></label></div>
    <div class="gaia-climate-primary"><span data-climate-metric></span><strong data-climate-value>—</strong><small data-climate-detail></small></div>
    <div class="gaia-climate-timeline"><label><b data-climate-period></b><input type="range" data-climate-year min="1980" max="2024" value="2016" step="1" aria-label="気候記録の年" /></label><button type="button" data-climate-overview>全体を見る</button><button type="button" data-climate-regional aria-haspopup="dialog">地域別の接近を分析</button></div></fieldset>
    <div class="gaia-climate-actions"><button type="button" data-climate-source></button><button type="button" data-climate-analysis disabled></button></div>`, legend = document.createElement("section"), legend.className = "gaia-climate-legend", legend.hidden = !0, legend.innerHTML = '<div class="gaia-climate-key"><h3 data-climate-key-title></h3><div class="gaia-climate-scale"></div><p data-climate-labels></p></div><div class="gaia-climate-insight"><h3 data-climate-selected></h3><p data-climate-insight></p></div><details><summary>指標と出典の読み方</summary><p class="gaia-climate-guide" data-climate-guide></p></details>';
  const lakePanel = document.createElement("div");
  lakePanel.dataset.lakePanel = "", lakePanel.hidden = !0, lakePanel.innerHTML = '<header><h3 data-lake-name></h3><small data-lake-country></small></header><canvas data-lake-locator width="240" height="110" role="img"></canvas><button type="button" data-lake-compare aria-pressed="true">2000年の水域を重ねる</button><p data-lake-change></p><p data-lake-sample role="status"></p><small data-lake-coordinates></small>', legend.prepend(lakePanel), layer.append(readout, legend), lakeView = createLakeView(map, syncLakePanel), decorateMapActions(q(".gaia-climate-actions"), q("[data-climate-source]"), q("[data-climate-analysis]"));
  const waterPanel = document.createElement("div");
  waterPanel.dataset.waterPanel = "", waterPanel.hidden = !0, waterPanel.innerHTML = '<h3 data-water-title></h3><small data-water-place></small><div class="water-reading"><strong data-water-value></strong><span data-water-period></span></div><canvas data-water-chart width="480" height="144" role="img"></canvas><div class="water-chart-years"><span>2003</span><span>2024</span></div><p class="water-instruction">陸地をタップして、同じ場所の変化を追う</p><small class="water-scale-note">配布格子 0.5° · 推定の広さ 約3°</small>', legend.prepend(waterPanel);
  const coralPanel = document.createElement("div");
  coralPanel.dataset.coralPanel = "", coralPanel.hidden = !0, coralPanel.innerHTML = '<h3 data-coral-name></h3><small data-coral-period></small><div class="coral-duration"><span>DHW ≥ 4</span><div><i data-coral-bar="4"></i></div><b data-coral-days="4"></b></div><div class="coral-duration"><span>DHW ≥ 8</span><div><i data-coral-bar="8"></i></div><b data-coral-days="8"></b></div><small data-coral-coverage></small>', legend.prepend(coralPanel), q("[data-lake-compare]").addEventListener("click", () => {
    stopForInteraction(), lakeView.setCompare(!lakeView.getState().compare);
  });
  const layoutObserver = new ResizeObserver(() => {
    geometryKey = "";
  });
  layoutObserver.observe(readout), layoutObserver.observe(legend), new MutationObserver(() => {
  }).observe(legend, { attributes: !0, attributeFilter: ["style"] });
  const refitLake = () => requestAnimationFrame(() => {
    active && isLake() && lakeDetail && selected() && openLakeDetail({ durationMs: 1400 });
  });
  document.addEventListener("toggle", (event) => {
    event.target.id === "map-responsive-data" && (event.target.open || refitLake());
  }, !0), addEventListener("resize", refitLake), q("[data-climate-basin]").replaceChildren(...Object.entries(BASINS).map(([id, label]) => new Option(label, id)));
  for (const d of CLIMATE_EXHIBITS) {
    const b = document.createElement("button");
    b.type = "button", b.className = "map-mode-button", b.textContent = d.number, b.dataset.climateExhibit = d.id, b.dataset.mapPreviewSurface = "map", b.setAttribute("aria-current", "false"), b.setAttribute("aria-label", `${d.number} ${d.shortTitle}`), b.setAttribute("aria-describedby", "map-mode-preview"), b.addEventListener("click", () => {
      select(d.id);
    }), layer.querySelector(".map-mode-list").append(b), buttons.set(d.id, b);
  }
  layer.querySelector(".map-mode-bank").addEventListener("click", (event) => {
    const b = event.target.closest?.(".map-mode-button");
    b && !b.dataset.climateExhibit && deactivate();
  }, { capture: !0 });
  for (const node of [readout, legend]) for (const type of ["pointerdown", "wheel", "keydown", "keyup"]) node.addEventListener(type, (event) => event.stopPropagation());
  q("[data-climate-year]").addEventListener("input", (event) => {
    event.isTrusted && stopForInteraction(), setYear(Number(event.target.value));
  }), q("[data-climate-basin]").addEventListener("change", (event) => {
    stopForInteraction(), basin = event.target.value, fillPoints(), sync();
  }), q("[data-climate-point]").addEventListener("change", (event) => {
    stopForInteraction(), selectPoint(event.target.value);
  }), q("[data-climate-overview]").addEventListener("click", () => {
    stopForInteraction(), isLake() && !lakeDetail ? openLakeDetail() : focusAll();
  }), q("[data-climate-regional]").addEventListener("click", async (event) => {
    stopForInteraction();
    const button = event.currentTarget, ticket = generation;
    button.disabled = !0;
    try {
      regionalPanel = await import("./cyclone-regional-panel.js?v=regions-20261018"), active && !isRegion() && generation === ticket && regionalPanel.openRegionalAnalysis({ year, trigger: button }), button.textContent = "地域別の接近を分析";
    } catch {
      button.textContent = "地域別分析を再試行";
    } finally {
      button.disabled = !1;
    }
  }), q("[data-climate-retry]").addEventListener("click", () => {
    isAtlas() && canvas.dataset.atlasGeometryState === "error" && globalThis.GaiaMapObservationAdapter?.retryCountryGeometry?.(), data ? setYear(year) : select(definition.id);
  }), q("[data-climate-analysis]").addEventListener("click", () => {
    const dataset = statisticsDataset();
    if (!dataset) return;
    setPlayback(!1);
    const open = () => globalThis.GaiaStatisticsLab?.open?.({ modeId: dataset.modeId, datasetId: dataset.id, dataset });
    globalThis.GaiaStatisticsLab?.open ? open() : addEventListener("gaia:statistics-lab-ready", open, { once: !0 });
  }), document.addEventListener("visibilitychange", () => {
    document.hidden ? (cancelAnimationFrame(frame), frame = 0) : resume();
  }), addEventListener("gaia:japan-close", () => {
    cancelAnimationFrame(frame), frame = 0, playing = !1, lakeView.setVisible(!1), regionalPanel?.closeRegionalAnalysis();
  }), addEventListener("gaia:japan-open", resume);
  for (const name of ["live-exhibit", "estat-exhibit", "firms-exhibit", "planet-signals", "marine-cod", "food"]) addEventListener(`gaia:${name}-change`, (event) => {
    event.detail?.active && active && deactivate();
  });
  reduced.addEventListener("change", () => {
    geometryKey = "";
  }), emit("mounted"), addEventListener("gaia:atlas-renderer-change", () => {
    geometryKey = "", resume();
  }), addEventListener("gaia:coral-renderer-change", () => {
    geometryKey = "", resume();
  }), addEventListener("gaia:sea-renderer-change", () => {
    geometryKey = "", resume();
  });
}
globalThis.GaiaClimateHistory = Object.freeze({
  definitions: CLIMATE_EXHIBITS,
  select,
  deactivate,
  setYear,
  selectPoint,
  findPoiAt,
  focusAll,
  setPlayback,
  getState: () => ({ active, id: definition.id, year, month: null, basin, selectedId, playing, dataState }),
  getPlaybackState: () => ({ ready: active && dataState === "ready", supported: !0, playing: active && playing, detail: "対象年を順番に表示します。" }),
  getStatisticsDataset: statisticsDataset,
  restoreStatisticsDataset,
  getRenderState: () => isCoral() ? coralView.getState() : isWater() ? waterView.getState() : { engine: "idle" },
  getCruisePoints: () => items(),
  selectCruisePoi: (index) => {
    const p = items()[index];
    p && selectPoint(p.id);
  },
  getCoralState: () => coralView.getState(),
  getLakeState: () => lakeView?.getState(),
  getWaterState: () => ({ ...waterView.getState(), cell: waterSelection ? { ...waterSelection } : null, gridReady: !!waterGrid }),
  getSourceInfo: () => active ? { number: definition.number, shortTitle: definition.shortTitle, datasets: [{
    id: definition.id,
    title: definition.signalLabel,
    organisation: definition.organisation || (isLake() ? "Source: EC JRC/Google" : isCoral() ? "NOAA Coral Reef Watch" : "NOAA NCEI / IBTrACS v4r01"),
    url: definition.source,
    attributionNote: `${q("[data-climate-guide]").textContent} 取得 ${data?.retrievedAt?.slice(0, 10) || data?.builtAt || "読込後表示"}。${isCoral() ? data?.attribution || "" : data?.citation || ""} ${data?.license || ""}`
  }] } : null
});
globalThis.GaiaMapObservationAdapter ? mount() : addEventListener("gaia:map-adapter-ready", mount, { once: !0 });

addEventListener('gaia:atlas-renderer-change',()=>{geometryKey='';resume();});
