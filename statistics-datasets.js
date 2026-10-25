// Pure data adapters: no DOM, storage, mutable UI state, or network access.
// Keep missing values distinct from zero and retain source row identity.
import { RECYCLING_COMPARABILITY, recyclingSourceLabel, recyclingDefinition, recyclingScope, recyclingYearNote } from "./src/data/recycling-provenance.js?v=recycling-coverage-1";
export const finiteNumber = value => value === null || value === undefined || value === "" || typeof value === "boolean"
  ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const finite = finiteNumber;
const pad2 = value => String(value).padStart(2, "0");
const joinById = (left, right) => {
  const rightMap = new Map(right.map((row) => [row.id || row.iso3 || row.country || row.name, row]));
  return left.map((row) => ({ ...row, ...(rightMap.get(row.id || row.iso3 || row.country || row.name) || {}) }));
};

export const buildAnnualDataset = (snapshot, modeId, position = 100) => {
  const population = modeId === "population-tide";
  const signals = snapshot.modes.find(mode => mode.id === modeId)?.signals || {};
  const rows = signals[population ? "population" : "emissions"] || [];
  const years = [...new Set(rows.map(row => row.year))].sort((a, b) => a - b);
  // Match the map's year slots; missing country-years stay missing.
  const progress = Math.max(0, Math.min(100, Number(position) || 0));
  const year = years[Math.min(years.length - 1, Math.floor(progress / 100 * years.length))];
  const metric = population ? "population" : "emissionsMtCo2";
  const selected = rows.filter(row => row.year === year && Number.isFinite(row[metric]));
  const urban = new Map((signals.nightLights || []).map(row => [row.id, row]));
  const urbanYear = signals.nightLights?.[0]?.year;
  const label = population ? "人口" : "化石燃料由来CO₂排出量";
  return {
    id: population ? "population" : "emissions-urban", modeId, defaultMethod: "summary",
    title: `${year}年の${label}（${selected.length}国・地域）`, unit: population ? "人" : "Mt CO₂", yLabel: label,
    xLabel: population ? "国・地域" : `都市化率（${urbanYear}年）`,
    periodStart: String(year), periodEnd: String(year), provenance: ["SOURCE"],
    rows: selected.map(row => ({ id: row.iso3 || row.id, label: row.countryJa || row.country || row.name,
      value: row[metric], y: row[metric], year: row.year, provenance: "SOURCE",
      ...(population ? {} : { x: urban.get(row.id)?.urbanPercent, urbanYear }),
    })),
  };
};

export const buildDatasets = (snapshot) => {
  const modes = new Map(snapshot.modes.map((mode) => [mode.id, mode]));
  const breathing = modes.get("breathing-earth")?.signals || {};
  const blue = modes.get("blue-circulation")?.signals || {};
  const forest = modes.get("forest-cloud-engine")?.signals || {};
  const pollination = modes.get("pollination-protocol")?.signals || {};
  const waste = modes.get("nothing-is-waste")?.signals || {};
  const disaster = modes.get("rhythm-of-disaster")?.signals || {};
  const ecologies = modes.get("three-ecologies")?.signals || {};
  const organ = modes.get("earth-organ")?.signals || {};
  const co2 = (breathing.co2 || []).filter((row) => finite(row.deseasonalizedPpm) !== null).slice(-120).map((row, index) => ({
    id: `${row.year}-${pad2(row.month)}`, label: `${row.year}-${pad2(row.month)}`,
    x: row.year + (row.month - 0.5) / 12, y: Number(row.deseasonalizedPpm), value: Number(row.deseasonalizedPpm), provenance: "SOURCE", index,
  }));
  const co2MonthSpan = co2.length
    ? Math.round((co2.at(-1).x - co2[0].x) * 12) + 1
    : 0;
  const co2MissingMonths = Math.max(0, co2MonthSpan - co2.length);
  const co2Period = co2.length ? `${co2[0].label}〜${co2.at(-1).label}` : "観測なし";
  const jma = (breathing.japanCo2 || []).filter((row) => [row.ryoriPpm, row.minamitorishimaPpm, row.yonagunijimaPpm].every((value) => finite(value) !== null)).map((row) => ({
    id: String(row.year), label: String(row.year), x: Number(row.ryoriPpm), y: Number(row.minamitorishimaPpm), value: Number(row.ryoriPpm), paired: Number(row.yonagunijimaPpm), provenance: "SOURCE",
  }));
  const rainfall = (forest.precipitation || []).map((row) => ({ ...row, id: row.id, label: row.name, value: Number(row.precipitationMmDay), x: Number(row.lon), y: Number(row.precipitationMmDay), provenance: "SOURCE" }));
  const currents = (blue.currents || []).filter(row => Number.isFinite(row.uMs) && Number.isFinite(row.vMs)).map((row, index) => ({ ...row,
    id: `current-${index}`, label: `${row.lat}°, ${row.lon}°`, x: row.uMs, y: row.vMs, value: Math.hypot(row.uMs, row.vMs), provenance: "SOURCE", valueKind: "derived-vector-speed",
  }));
  const climate = (blue.climate || []).map((row) => ({ id: row.id, label: row.name, value: Number(row.windSpeedMs), x: Number(row.temperatureC), y: Number(row.windSpeedMs), provenance: "SOURCE", ...row }));
  const earthquakeEvents = (disaster.globalEvents || []).map((row) => ({ ...row, date: new Date(row.occurredAt) })).filter((row) => !Number.isNaN(row.date.valueOf()));
  const yearly = [];
  const earthquakeCountsByYear = new Map();
  for (const row of earthquakeEvents) {
    const year = row.date.getUTCFullYear();
    earthquakeCountsByYear.set(year, (earthquakeCountsByYear.get(year) || 0) + 1);
  }
  for (let year = 2001; year <= 2025; year += 1) {
    const count = earthquakeCountsByYear.get(year) || 0;
    yearly.push({ id: String(year), label: String(year), value: count, x: year, y: count, provenance: "SOURCE" });
  }
  const sortedEvents = [...earthquakeEvents].sort((a, b) => a.date - b.date);
  const gaps = sortedEvents.slice(1).map((row, index) => ({ id: row.id, label: row.date.toISOString().slice(0, 10), value: (row.date - sortedEvents[index].date) / 86_400_000, provenance: "DERIVED" }));
  const wasteRows = (waste.countryWaste || []).map((row) => ({ id: row.id, label: row.name, value: Number(row.recyclePercent), x: Number(row.lon), y: Number(row.recyclePercent), provenance: row.valueStatus === "SOURCE" ? "SOURCE" : "IMPUTED", ...row,
    sourceLabel: recyclingSourceLabel(row), sourceDefinition: recyclingDefinition(row), sourceScope: recyclingScope(row), yearMeaning: recyclingYearNote(row) }));
  const forestUrban = (ecologies.pairedCountries || []).map((row) => ({ id: row.id, label: row.name, x: Number(row.forestPercent), y: Number(row.urbanPercent), value: Number(row.forestPercent), provenance: "SOURCE", ...row }));
  const renewables = joinById(organ.current || [], organ.potential || []).map((row) => ({ id: row.id, label: row.name, x: Number(row.solarKwhM2Day), y: Number(row.renewablePercent), value: Number(row.renewablePercent), provenance: "SOURCE", ...row }));
  const culture = (ecologies.culture || []).map((row, index) => ({ id: String(index), label: row.name, category: row.category, group: row.region, value: index, provenance: "SOURCE", ...row }));
  const interactions = (pollination.interactions || []).map((row, index) => ({ id: `i${index}`, label: row.targetTaxon, category: row.interaction, group: row.sourceTaxon, value: index, provenance: "SOURCE", ...row }));
  const occurrences = (pollination.occurrences || []).map((row, index) => ({ id: `o${index}`, label: row.country, category: row.basisOfRecord, group: row.sampling, value: index, provenance: "SOURCE", ...row }));
  return [
    {
      id: "co2-trend",
      modeId: "breathing-earth",
      title: `CO₂ 観測${co2.length}件（${co2Period} / 欠測${co2MissingMonths}か月）`,
      rows: co2,
      unit: "ppm",
      xLabel: "観測月",
      xKind: "month",
      yLabel: "CO₂",
      reference: co2[0]?.value,
      provenance: ["SOURCE"],
      periodStart: co2[0]?.label,
      periodEnd: co2.at(-1)?.label,
      missingPeriods: co2MissingMonths,
    },
    { id: "jma-co2", modeId: "breathing-earth", title: "JMA CO₂ 3観測所 共通期間", rows: jma, unit: "ppm", valueLabel: "綾里のCO₂", xLabel: "綾里", yLabel: "南鳥島", pairedLabel: "与那国島", provenance: ["SOURCE"] },
    { id: "ocean-currents", modeId: "blue-circulation", title: `${currents.length}地点の表層海流（${currents[0]?.time?.slice(0, 10) || "収録時点"}）`, rows: currents, unit: "m/s", xLabel: "東西成分", yLabel: "南北成分", valueLabel: "流速", provenance: ["SOURCE"], insightContext: { measurementKind: "MODEL", axis: "locations" } },
    { id: "wind-climate", modeId: "blue-circulation", title: `${climate.length}地点の風速と気温`, rows: climate, unit: "m/s", xLabel: "気温", yLabel: "風速", provenance: ["SOURCE"] },
    { id: "rainfall", modeId: "forest-cloud-engine", title: `${rainfall.length}地点の平均降水量`, rows: rainfall, unit: "mm/day", xLabel: "経度", yLabel: "降水量", provenance: ["SOURCE"] },
    { id: "pollination", modeId: "pollination-protocol", title: "送粉相互作用と記録方式", rows: [...interactions, ...occurrences], categoricalSets: [interactions, occurrences], unit: "件", provenance: ["SOURCE"] },
    { id: "waste", modeId: "nothing-is-waste", title: `${wasteRows.length}の国・地域の再資源化率`, rows: wasteRows, unit: "%", xLabel: "経度", yLabel: "再資源化率", provenance: [...new Set(wasteRows.map(row => row.provenance))],
      comparisonNote: RECYCLING_COMPARABILITY, periodStart: wasteRows.length ? String(Math.min(...wasteRows.map(row => row.year))) : undefined, periodEnd: wasteRows.length ? String(Math.max(...wasteRows.map(row => row.year))) : undefined },
    buildAnnualDataset(snapshot, "anthropocene-scar"),
    { id: "earthquakes", modeId: "rhythm-of-disaster", title: "収録されたM7.5以上地震の年別件数（2001–2025）", rows: yearly, gaps, unit: "件/年", xLabel: "年", yLabel: "発生件数", provenance: ["SOURCE", "DERIVED"] },
    { id: "forest-urban", modeId: "three-ecologies", title: `${forestUrban.length}の国・地域の森林率と都市化率`, rows: forestUrban, unit: "%", valueLabel: "森林率", xLabel: "森林率", yLabel: "都市化率", provenance: ["SOURCE"] },
    { id: "culture", modeId: "three-ecologies", title: "文化遺産カテゴリと地域", rows: culture, unit: "件", provenance: ["SOURCE"] },
    { id: "renewables", modeId: "earth-organ", title: `${renewables.length}の国・地域の再生可能電力（各国の最新収録年）`, rows: renewables, unit: "%", valueLabel: "再生可能エネルギー発電割合", xLabel: "代表地点の日射（収録31地点）", yLabel: "再生可能エネルギー発電割合", provenance: ["SOURCE"] },
    buildAnnualDataset(snapshot, "population-tide"),
  ];
};
