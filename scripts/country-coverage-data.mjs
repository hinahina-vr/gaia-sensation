import { readFile, writeFile, mkdir } from "node:fs/promises";
import { applyRecyclingMapMetadata } from "./update-recycling-map-data.mjs";

export const COUNTRY_SOURCE_URLS = {
  countries: "https://api.worldbank.org/v2/country?format=json&per_page=400",
  forest: "https://api.worldbank.org/v2/country/all/indicator/AG.LND.FRST.ZS?format=json&mrnev=1&per_page=400&source=2",
  urban: "https://api.worldbank.org/v2/country/all/indicator/SP.URB.TOTL.IN.ZS?format=json&mrnev=1&per_page=400&source=2",
  waste: "https://unstats.un.org/SDGAPI/v1/sdg/Series/Data?seriesCode=EN_MWT_RCYR&pageSize=2000",
  emissions: "https://zenodo.org/records/13981696/files/GCB2024v17_MtCO2_flat.csv?download=1",
  power: "https://power.larc.nasa.gov/api/temporal/climatology/point",
};
const number = value => value === null || value === undefined || String(value).trim() === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const validIso = value => typeof value === "string" && /^[A-Z]{3}$/.test(value);
export function countryCatalog(geography, countries, references = []) {
  const catalog = new Map();
  for (const { properties: p } of geography.features) {
    // Prefer the feature's own ISO code. EH also assigns parent codes to some
    // disputed/dependent polygons (e.g. Ashmore and Cartier -> AUS); those must
    // never overwrite the parent country's position, name or complete polygon.
    const iso3 = validIso(p.ISO_A3) ? p.ISO_A3 : p.ISO_A3_EH === p.ADM0_A3 ? p.ISO_A3_EH : null;
    if (!iso3 || iso3 === "ATA") continue;
    const reference = references.find(row => row.iso3 === iso3);
    catalog.set(iso3, { id: reference?.id || iso3.toLowerCase(), name: p.NAME_EN || p.ADMIN,
      country: p.NAME_EN || p.ADMIN, countryJa: p.NAME_JA, iso3, iso2: p.ISO_A2_EH || p.ISO_A2,
      mapIso3: [p.ADM0_A3, p.ISO_A3, p.SOV_A3, p.BRK_A3, p.WB_A3].find(validIso),
      m49: String(p.ISO_N3_EH || p.ISO_N3).padStart(3, "0"),
      lat: reference?.lat ?? p.LABEL_Y, lon: reference?.lon ?? p.LABEL_X,
      positionSource: reference ? "Existing NASA POWER reference point" : "Natural Earth label point" });
  }
  for (const country of countries.filter(row => row.region?.id && row.region.id !== "NA")) {
    const existing = catalog.get(country.id);
    if (existing) { existing.worldBankEconomy = true; continue; }
    // Channel Islands uses a point near Jersey but must not inherit its polygon/M49.
    const p = geography.features.find(({ properties: p }) => p.WB_A3 === country.id || (country.id === "XKX" && p.ADM0_A3 === "KOS"))?.properties;
    const lat = country.id === "GIB" ? 36.129426 : p?.LABEL_Y ?? number(country.latitude);
    const lon = country.id === "GIB" ? -5.3467 : p?.LABEL_X ?? number(country.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`Country position missing: ${country.id}`);
    catalog.set(country.id, { id: country.id.toLowerCase(), name: country.name, country: country.name,
      countryJa: country.id === "CHI" ? "チャネル諸島" : p?.NAME_JA || new Intl.DisplayNames(["ja"], { type: "region" }).of(country.iso2Code),
      iso3: country.id, iso2: country.iso2Code, mapIso3: country.id === "CHI" ? null : p?.ADM0_A3 || null,
      m49: country.id === "CHI" ? "830" : p && /^\d{3}$/.test(p.ISO_N3_EH) ? p.ISO_N3_EH : country.id === "GIB" ? "292" : null,
      lat, lon, worldBankEconomy: true, positionSource: country.id === "GIB" ? "Natural Earth 10m label point" : p ? "Natural Earth label point" : "World Bank capital coordinates" });
  }
  return [...catalog.values()].sort((a, b) => a.iso3.localeCompare(b.iso3));
}
export function parseCsv(text) {
  const rows = []; let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}
export function buildEmissions(text, catalog) {
  const [header, ...table] = parseCsv(text);
  const indexes = ["Country", "ISO 3166-1 alpha-3", "Year", "Total"].map(key => header.indexOf(key));
  if (indexes.some(index => index < 0)) throw new Error("Invalid GCB columns");
  const sites = new Map(catalog.map(row => [row.iso3, row]));
  const [country, iso, date, total] = indexes;
  return table.flatMap(raw => {
    // GCB uses KSV, World Bank uses XKX, and Natural Earth uses KOS for Kosovo.
    const site = sites.get(raw[iso] === "KSV" ? "XKX" : raw[iso]), year = number(raw[date]), emissionsMtCo2 = number(raw[total]);
    if (!site || !Number.isInteger(year) || year < 1945 || emissionsMtCo2 === null) return [];
    if (emissionsMtCo2 < 0) throw new Error(`Negative emissions: ${site.iso3}/${year}`);
    return [{ ...site, country: raw[country], ...(raw[iso] !== site.iso3 ? { sourceIso3: raw[iso] } : {}), year, emissionsMtCo2 }];
  }).sort((a, b) => a.year - b.year || a.iso3.localeCompare(b.iso3));
}
export function buildLatest(observations, catalog, key) {
  const sites = new Map(catalog.filter(row => row.worldBankEconomy).map(row => [row.iso3, row]));
  const latest = new Map();
  for (const observation of observations) {
    const site = sites.get(observation.countryiso3code), value = number(observation.value), year = number(observation.date);
    if (!site || value === null) continue;
    if (!Number.isInteger(year) || value < 0 || value > 100) throw new Error(`Invalid ${key}: ${site.iso3}`);
    if (!latest.has(site.iso3) || year > latest.get(site.iso3).year) latest.set(site.iso3, { ...site, year, [key]: value });
  }
  return [...latest.values()].sort((a, b) => a.iso3.localeCompare(b.iso3));
}
export function buildWaste(observations, catalog, excluded = []) {
  const sites = new Map(catalog.filter(row => row.m49).map(row => [row.m49, row]));
  const latest = new Map();
  for (const observation of observations) {
    const site = sites.get(String(observation.geoAreaCode).padStart(3, "0"));
    const value = number(observation.value), year = number(observation.timePeriodStart);
    if (!site || observation.series !== "EN_MWT_RCYR" || observation.attributes?.Units !== "PERCENT" || value === null) continue;
    if (!Number.isInteger(year)) throw new Error(`Invalid recycling year: ${site.iso3}`);
    const previous = latest.get(site.iso3);
    if (previous && previous.year === year && previous.recyclePercent !== value) throw new Error(`Ambiguous recycling value: ${site.iso3}/${year}`);
    if (!previous || year > previous.year) latest.set(site.iso3, { ...site, year, recyclePercent: value,
      valueStatus: "SOURCE", source: observation.source, nature: observation.attributes?.Nature,
      reportingType: observation.dimensions?.["Reporting Type"], observationStatus: observation.attributes?.["Observation Status"], footnotes: observation.footnotes || [] });
  }
  return [...latest.values()].filter(row => {
    if (row.recyclePercent >= 0 && row.recyclePercent <= 100) return true;
    excluded.push({ ...row, reason: "Latest source percentage outside 0–100; cannot represent on the percentage map. Not clamped or replaced with an older year." });
    return false;
  }).sort((a, b) => a.iso3.localeCompare(b.iso3));
}
export function coverage(rows, catalog) {
  const codes = [...new Set(rows.map(row => row.iso3))].sort();
  const years = [...new Set(rows.map(row => row.year).filter(Number.isInteger))].sort((a, b) => a - b);
  return { countryCount: codes.length, countryCodes: codes, aggregatesExcluded: true,
    missingPolicy: "No interpolation, neighbor estimates, zero fill, or reassignment of historical entities",
    firstYear: years[0] ?? null, lastYear: years.at(-1) ?? null,
    missingCountries: catalog.filter(row => !codes.includes(row.iso3)).map(row => row.iso3),
    byYear: years.map(year => ({ year, count: rows.filter(row => row.year === year).length })) };
}
async function fetchText(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.text();
    } catch (error) { if (attempt === 2) throw error; }
  }
}
export async function fetchCountryCoverage(geography, referenceSites, { cacheDirectory } = {}) {
  if (cacheDirectory) await mkdir(cacheDirectory, { recursive: true });
  // This is an explicitly dated build cache, not a silent fallback on API failure.
  const cached = async (name, url) => {
    const path = cacheDirectory ? new URL(`${name}.json`, cacheDirectory) : null;
    if (path) { const prior = await readFile(path, "utf8").catch(() => null); if (prior) { const entry = JSON.parse(prior); if (entry.url === url) return entry.text; } }
    const text = await fetchText(url);
    if (path) await writeFile(path, JSON.stringify({ url, retrievedAt: new Date().toISOString(), text }));
    return text;
  };
  const wb = async name => {
    const result = [];
    for (let page = 1, pages = 1; page <= pages; page++) {
      const payload = JSON.parse(await cached(`${name}-${page}`, `${COUNTRY_SOURCE_URLS[name]}&page=${page}`));
      if (!Array.isArray(payload?.[1]) || !(Number(payload[0]?.pages) >= 1)) throw new Error(`Invalid ${name} response`);
      pages = Number(payload[0].pages); result.push(...payload[1]);
    }
    return result;
  };
  const [countries, forestObservations, urbanObservations, emissionsText] = await Promise.all([
    wb("countries"), wb("forest"), wb("urban"), cached("emissions", COUNTRY_SOURCE_URLS.emissions),
  ]);
  const catalog = countryCatalog(geography, countries, referenceSites);
  const wasteObservations = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const payload = JSON.parse(await cached(`waste-${page}`, `${COUNTRY_SOURCE_URLS.waste}&page=${page}`));
    if (!Array.isArray(payload.data) || !(payload.totalPages >= 1)) throw new Error("Invalid UN recycling response");
    pages = payload.totalPages; wasteObservations.push(...payload.data);
    if (page === pages && wasteObservations.length !== Number(payload.totalElements)) throw new Error("Incomplete UN pagination");
  }
  const emissions = buildEmissions(emissionsText, catalog);
  const forest = buildLatest(forestObservations, catalog, "forestPercent");
  const urban = buildLatest(urbanObservations, catalog, "urbanPercent");
  const wasteExcluded = [];
  const waste = buildWaste(wasteObservations, catalog, wasteExcluded);
  const paired = urban.flatMap(row => { const f = forest.find(f => f.iso3 === row.iso3); return f ? [{ ...row, urbanYear: row.year, forestYear: f.year, forestPercent: f.forestPercent }] : []; });
  console.log(`National data: CO2 ${new Set(emissions.map(row => row.iso3)).size}, recycling ${waste.length}, forest/urban pairs ${paired.length}`);
  // Four concurrent requests respect the POWER service while covering small territories too.
  const climateSites = catalog.filter(row => row.iso3 !== "CHI");
  const climate = new Array(climateSites.length); let cursor = 0, completed = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < climateSites.length) {
      const index = cursor++, site = climateSites[index];
      const query = new URLSearchParams({ parameters: "WS10M,WD10M,T2M,ALLSKY_SFC_SW_DWN,PRECTOTCORR", community: "RE", longitude: String(site.lon), latitude: String(site.lat), format: "JSON" });
      const payload = JSON.parse(await cached(`power-${site.iso3}`, `${COUNTRY_SOURCE_URLS.power}?${query}`));
      if (!payload.properties?.parameter || !payload.header?.range) throw new Error(`Invalid POWER response: ${site.iso3}`);
      const annual = key => { const value = number(payload.properties.parameter[key]?.ANN); return value === payload.header.fill_value ? null : value; };
      climate[index] = { ...site, windSpeedMs: annual("WS10M"), windDirectionDeg: annual("WD10M"), temperatureC: annual("T2M"), solarKwhM2Day: annual("ALLSKY_SFC_SW_DWN"), precipitationMmDay: annual("PRECTOTCORR"),
        period: payload.header.range, valueStatus: "SOURCE", spatialMeaning: "Point climatology, not a country average" };
      if (++completed % 25 === 0 || completed === climateSites.length) console.log(`NASA POWER: ${completed}/${climateSites.length} points`);
    }
  }));
  if (new Set(emissions.map(row => row.iso3)).size < 200 || paired.length < 200 || waste.length < 60 || climate.length < 200) throw new Error("Unexpectedly incomplete global country coverage");
  return { catalog, emissions, forest, urban, waste, wasteExcluded, paired, climate };
}

export function applyCountryCoverage(snapshot, data, retrievedAt = new Date().toISOString()) {
  const mode = id => snapshot.modes.find(row => row.id === id);
  const update = (id, datasetId, rows, extra = {}) => {
    const dataset = mode(id).datasets.find(row => row.id === datasetId);
    if (!dataset) throw new Error(`Missing dataset ${datasetId}`);
    Object.assign(dataset, { retrievedAt, preview: rows.slice(0, 10), ...extra });
  };
  const wind = data.climate.filter(row => Number.isFinite(row.windSpeedMs) && Number.isFinite(row.windDirectionDeg));
  const rain = data.climate.filter(row => Number.isFinite(row.precipitationMmDay));
  if (wind.length < 200 || rain.length < 200) throw new Error("Insufficient non-missing global climate observations");
  if (wind.some(row => row.windSpeedMs < 0 || row.windDirectionDeg < 0 || row.windDirectionDeg > 360) || rain.some(row => row.precipitationMmDay < 0)) throw new Error("Invalid climate observation range");
  mode("blue-circulation").signals.climate = wind;
  mode("forest-cloud-engine").signals.precipitation = rain;
  for (const [id, rows] of [["blue-circulation", wind], ["forest-cloud-engine", rain]]) {
    mode(id).signals.climateCoverage = { ...coverage(rows, data.catalog), spatialMeaning: "One point per country/territory, not a national average", period: rows[0].period };
    for (const dataset of mode(id).datasets.filter(row => row.id.startsWith("nasa-power"))) {
      Object.assign(dataset, { retrievedAt, preview: rows.slice(0, 10), period: rows[0].period, resolution: `${rows.length} reference points across countries and territories`,
        transformation: `${rows.length}の国・地域に置いた参照座標の気候値を表示。既存31地点の座標は維持し、追加地点にはNatural Earthの地図ラベル座標等を使用。`,
        caveat: "国平均ではなく参照座標を含む格子の気候平年値。国境内を平均した値や現在の天気ではありません。地点間の補間・欠測のゼロ埋めはしません。海流の移動距離計算には風を使いません。" });
    }
  }
  const wasteMode = mode("nothing-is-waste");
  wasteMode.signals.countryWaste = data.waste;
  wasteMode.signals.countryCoverage = coverage(data.waste, data.catalog);
  wasteMode.signals.countryCoverage.sourceOnly = true;
  wasteMode.signals.countryCoverage.excludedSourceValues = data.wasteExcluded;
  wasteMode.datasets = wasteMode.datasets.filter(row => row.id !== "waste-geographic-knn-median");
  wasteMode.statisticalMethods = (wasteMode.statisticalMethods || []).filter(row => row.id !== "GEOGRAPHIC_KNN_MEDIAN");
  update("nothing-is-waste", "un-sdg", data.waste, { apiUrl: COUNTRY_SOURCE_URLS.waste,
    resolution: `${data.waste.length} countries and territories / latest available source values`,
    period: `${Math.min(...data.waste.map(row => row.year))}–${Math.max(...data.waste.map(row => row.year))}`,
    transformation: "国連SDG APIの全ページから自治体ごみ再資源化率の最新公表値を国・地域別に採用。世界・地域合計は除外。",
    caveat: "報告年・制度・廃棄物定義は国で異なります。公表値がない国は未収録で、近隣国からの推定値や0%では埋めません。SOURCEにも国連側の推計値が含まれ、Nature属性・注記を保存しています。最新値が0〜100%外の国は円グラフから除外し、元値と理由をcountryCoverage.excludedSourceValuesに保持します。" });
  applyRecyclingMapMetadata(wasteMode);
  mode("anthropocene-scar").signals.emissions = data.emissions;
  mode("anthropocene-scar").signals.emissionsCoverage = coverage(data.emissions, data.catalog);
  update("anthropocene-scar", "gcp-fossil-co2", data.emissions, {
    resolution: `${data.emissions.length} annual values / ${new Set(data.emissions.map(row => row.iso3)).size} countries and territories`,
    transformation: "GCB2024の全ての照合可能な国・地域について1945年以降のTotal列を採用。現行の地図境界で表示し、旧国家・地域合計・国際輸送は現在の国へ振り分けません。年別の欠測は未収録のままです。" });
  const ecologies = mode("three-ecologies");
  Object.assign(ecologies.signals, { ecological: data.forest, social: data.urban, pairedCountries: data.paired, countryCoverage: coverage(data.paired, data.catalog) });
  for (const [id, rows, url] of [["worldbank-forest", data.forest, COUNTRY_SOURCE_URLS.forest], ["worldbank-urban", data.urban, COUNTRY_SOURCE_URLS.urban], ["forest-urban-correlation", data.paired, null]]) {
    update("three-ecologies", id, rows, { resolution: `${rows.length} countries and economies / aggregates excluded`, ...(url ? { apiUrl: url } : {}),
      caveat: "公表値のある国・地域を対象とし、世界・地域合計と欠測を除外。森林率と都市人口率で基準年・分母が異なります。相関は因果ではなく、各国の時間変化も示しません。" });
  }
  return snapshot;
}
