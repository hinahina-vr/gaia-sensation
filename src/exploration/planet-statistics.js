const METRICS = Object.freeze({
  wind: { key: "windSpeed", label: "風速", unit: "m/s" },
  air: { key: "pm25", label: "PM2.5", unit: "µg/m³" },
  quake: { key: "magnitude", label: "マグニチュード", unit: "M" },
  cloud: { key: "radiation", label: "短波放射", unit: "W/m²" },
});

export const buildPlanetStatistics = (definition, data) => {
  const metric = METRICS[definition?.renderer];
  // The embedded FALLBACKS are illustrative values, not archived observations.
  // Never publish those generated numbers as SOURCE rows in the statistics lab.
  if (!metric || !data?.points?.length || data.sourceState === "SAVED VALUES") return null;
  const rows = data.points.filter(point => Number.isFinite(point[metric.key])).map((point, index) => ({
    id: point.id || `${definition.id}-${index}`,
    label: point.label,
    x: definition.renderer === "quake" ? point.time : index + 1,
    y: point[metric.key], value: point[metric.key],
    lat: point.lat, lon: point.lon,
    ...Object.fromEntries(["windDirection", "pressure", "aerosol", "depth", "time"].filter(key => Number.isFinite(point[key])).map(key => [key, point[key]])),
    ...(Number.isFinite(point.cloud) ? { cloudCover: point.cloud } : {}),
    provenance: "SOURCE",
  }));
  if (!rows.length) return null;
  return {
    id: `planet-${definition.id}`, modeId: definition.id,
    title: `${definition.number} ${definition.shortTitle} — ${metric.label}（${definition.renderer === "quake" ? "" : "モデル値・"}${rows.length}地点）`,
    rows, unit: metric.unit,
    xLabel: definition.renderer === "quake" ? "発生時刻" : "地点番号（表示順）",
    yLabel: metric.label, defaultMethod: "discovery", provenance: ["SOURCE"],
    insightContext: { measurementKind: definition.renderer === "quake" ? "OBSERVED" : "MODEL", axis: definition.renderer === "quake" ? "events" : "locations" },
    periodStart: data.observedAt, periodEnd: data.observedAt,
    sourceName: definition.sourceName, sourceUrl: definition.sourcePage,
  };
};
