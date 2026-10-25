import { OBSERVATION_CITIES } from "./observation-cities.js?v=gaia-exhibit-catalog-1";

const METRICS = Object.freeze({
  weatherWindSpeed: ["weather", "m/s"], forecastCo2: ["air", "ppm"],
  weatherPrecipitation: ["weather", "mm"], weatherTemperature: ["weather", "℃"],
  cloudCover: ["weather", "%"], pm25: ["air", "µg/m³"],
});

// Same national scope for all six exhibits, independent of the selected city.
// Exclude missing samples; never fill them with zero or another city's value.
export const buildLiveStatistics = (exhibit, _state, _windField, prefectureField) => {
  const metric = METRICS[exhibit?.key];
  if (!metric) return null;
  const [provider, unit] = metric;
  const field = prefectureField?.[provider];
  if (!field || !["open-meteo", "stale-cache", "snapshot"].includes(field.source)) return null;
  const points = new Map((field.points || []).map(point => [point.id, point]));
  const missingLocations = [];
  const rows = OBSERVATION_CITIES.flatMap((city, index) => {
    const point = points.get(city.id), value = point?.measurements?.[exhibit.key];
    if (typeof value !== "number" || !Number.isFinite(value) || !point.observedAt || !Number.isFinite(Date.parse(point.observedAt))) {
      missingLocations.push(city.name); return [];
    }
    return [{ id: city.id, label: city.name, x: index + 1, y: value, value,
      lat: city.lat, lon: city.lon, observedAt: point.observedAt,
      provenance: "SOURCE", measurementKind: "MODEL" }];
  });
  if (!rows.length) return null;
  const times = rows.map(row => row.observedAt).sort();
  const status = field.source === "snapshot" ? "保存済み" : field.source === "stale-cache" ? "前回取得・更新失敗" : "取得済み";
  const coverage = { targetCount: OBSERVATION_CITIES.length, availableCount: rows.length, missingCount: missingLocations.length, missingLocations };
  return {
    id: `live-${exhibit.id}`, modeId: exhibit.id,
    title: `${exhibit.number} ${exhibit.shortTitle} — ${exhibit.signalLabel}（モデル値・${rows.length}/47都道府県）`,
    rows, unit, xLabel: "都道府県番号（北からの表示順・時間ではない）", yLabel: exhibit.signalLabel,
    defaultMethod: "discovery", provenance: ["SOURCE"],
    insightContext: { measurementKind: "MODEL", axis: "locations" }, coverage,
    comparisonNote: `47都道府県の代表地点（県平均ではありません）。有効${rows.length}地点・欠測${missingLocations.length}地点。${status}モデル値。地点間の比較であり時系列ではありません。`,
    periodStart: times[0], periodEnd: times.at(-1),
    sourceName: `${provider === "air" ? "Open-Meteo / CAMS" : "Open-Meteo Best Match"} / 47都道府県代表地点 / ${status}モデル値`,
    sourceUrl: field.provenance?.sourceUrl, sourceState: field.source, retrievedAt: field.generatedAt,
  };
};
