// Country electricity shares are independent of the 31-point NASA climate sample.
export const RENEWABLE_COUNTRIES_URL = "https://api.worldbank.org/v2/country?format=json&per_page=400";
export const RENEWABLE_SERIES_URL = "https://api.worldbank.org/v2/country/all/indicator/EG.ELC.RNEW.ZS?format=json&mrnev=1&per_page=400&source=2";
// Same Natural Earth 10m label point used by the population exhibit. The
// 50m map omits this small territory and World Bank leaves its position empty.
const GIBRALTAR_POSITION = { lat: 36.129426, lon: -5.3467 };

async function fetchPages(url) {
  const rows = [];
  let lastUpdated = null;
  for (let page = 1, pages = 1; page <= pages; page += 1) {
    let payload;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`${url}&page=${page}`, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`World Bank renewable: HTTP ${response.status}`);
        payload = await response.json();
        if (!Array.isArray(payload?.[1]) || !Number.isInteger(Number(payload[0]?.pages)) || Number(payload[0].pages) < 1) throw new Error("Invalid World Bank response");
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    pages = Number(payload[0].pages);
    lastUpdated = payload[0].lastupdated || lastUpdated;
    rows.push(...payload[1]);
  }
  return { rows, lastUpdated };
}

export function buildRenewableData(countries, observations, geography, referenceSites = [], lastUpdated = null) {
  const economies = new Map(countries.filter(country => country.region?.id && country.region.id !== "NA").map(country => [country.id, country]));
  const latest = new Map();
  const seen = new Set();
  for (const observation of observations) {
    const code = observation.countryiso3code;
    if (!economies.has(code) || observation.value === null) continue;
    const year = Number(observation.date), value = observation.value;
    if (!Number.isInteger(year) || year < 1900 || !Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Invalid renewable observation: ${code}`);
    const key = `${code}:${year}`;
    if (seen.has(key)) throw new Error(`Duplicate renewable observation: ${key}`);
    seen.add(key);
    if (!latest.has(code) || year > Number(latest.get(code).date)) latest.set(code, observation);
  }
  const names = new Intl.DisplayNames(["ja"], { type: "region" });
  const rows = [...latest].map(([iso3, observation]) => {
    const country = economies.get(iso3);
    const geographicCode = iso3 === "XKX" ? "KOS" : iso3;
    const feature = geography.features.find(({ properties: p }) => [p.WB_A3, p.ISO_A3, p.ADM0_A3].includes(geographicCode));
    const properties = feature?.properties;
    const reference = referenceSites.find(site => site.iso3 === iso3);
    const coordinates = reference || (iso3 === "GIB" ? GIBRALTAR_POSITION : Number.isFinite(properties?.LABEL_X) && Number.isFinite(properties?.LABEL_Y)
      ? { lat: properties.LABEL_Y, lon: properties.LABEL_X }
      : { lat: country.latitude?.trim() ? Number(country.latitude) : null, lon: country.longitude?.trim() ? Number(country.longitude) : null });
    if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lon) || Math.abs(coordinates.lat) > 90 || Math.abs(coordinates.lon) > 180) throw new Error(`Renewable position missing: ${iso3}`);
    // Match the map loader's geographic key; do not assign a territory its sovereign's value.
    const mapIso3 = properties && [properties.ADM0_A3, properties.ISO_A3, properties.SOV_A3, properties.BRK_A3, properties.WB_A3]
      .find(code => typeof code === "string" && /^[A-Z]{3}$/.test(code));
    return {
      id: reference?.id || iso3.toLowerCase(), name: country.name, country: country.name,
      countryJa: names.of(country.iso2Code) || properties?.NAME_JA || country.name,
      iso2: country.iso2Code, iso3, mapIso3: mapIso3 || null,
      lat: coordinates.lat, lon: coordinates.lon,
      positionSource: reference ? "existing NASA POWER reference point" : iso3 === "GIB" ? "Natural Earth 10m label point" : properties ? "Natural Earth label point" : "World Bank capital coordinates",
      year: Number(observation.date), renewablePercent: observation.value,
    };
  }).sort((a, b) => a.iso3.localeCompare(b.iso3));
  const years = rows.map(row => row.year);
  const coverage = {
    countryCount: rows.length, economyCount: economies.size, countryCodes: rows.map(row => row.iso3),
    firstYear: years.length ? Math.min(...years) : null, lastYear: years.length ? Math.max(...years) : null,
    sourceLastUpdated: lastUpdated, aggregatesExcluded: true,
    missingPolicy: "latest non-null country value; no interpolation or zero fill",
    missingCountries: [...economies.keys()].filter(code => !latest.has(code)).sort(),
    pointOnlyCountries: rows.filter(row => !row.mapIso3).map(row => row.iso3),
    byYear: [...new Set(years)].sort((a, b) => a - b).map(year => ({ year, count: years.filter(value => value === year).length })),
  };
  return { rows, coverage };
}

export async function fetchRenewableData(geography, referenceSites = []) {
  const [countries, series] = await Promise.all([fetchPages(RENEWABLE_COUNTRIES_URL), fetchPages(RENEWABLE_SERIES_URL)]);
  const result = buildRenewableData(countries.rows, series.rows, geography, referenceSites, series.lastUpdated);
  if (result.rows.length < 200) throw new Error(`Global renewable coverage unexpectedly incomplete: ${result.rows.length}`);
  return result;
}

export function renewableDataset({ rows, coverage }, retrievedAt) {
  return {
    id: "worldbank-renewable", kind: "SOURCE", organisation: "World Bank / International Energy Agency",
    title: "Renewable electricity output (% of total electricity output)",
    url: "https://data.worldbank.org/indicator/EG.ELC.RNEW.ZS", retrievedAt,
    apiUrl: RENEWABLE_SERIES_URL, countriesUrl: RENEWABLE_COUNTRIES_URL, license: "CC BY 4.0",
    period: `${coverage.firstYear}–${coverage.lastYear} / latest available by country or economy`, unit: "%",
    resolution: `${rows.length} countries and economies / aggregates excluded`,
    transformation: `${rows.length}の国・地域の国土を同じ0〜100%尺度で、暗い青から明るい水色へ塗り分けます。自動再生とスライダーは発電割合の高い国から低い国へ移動します。小さな地域は代表点でも選べます。`,
    caveat: `COUNTRY VALUE。各国・地域の最新の非欠測値で、収録値の年は${coverage.firstYear}〜${coverage.lastYear}年と異なります。同一年の順位ではありません。世界・地域合計は除外し、未収録を0%で埋めません。日射・風は別の31代表地点の気候値です。`,
    preview: rows.slice(0, 10),
  };
}
