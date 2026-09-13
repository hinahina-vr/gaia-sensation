// Population is a global country/economy series, not the 31-site climate sample.
export const POPULATION_COUNTRIES_URL = "https://api.worldbank.org/v2/country?format=json&per_page=400";
export const POPULATION_SERIES_URL = "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?date=1960:2025&format=json&per_page=20000";
const GIBRALTAR_POSITION = { lat: 36.129426, lon: -5.3467 };
const POSITION_SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";

async function fetchPages(url) {
  const rows = [];
  let lastUpdated = null;
  for (let page = 1, pages = 1; page <= pages; page += 1) {
    const response = await fetch(`${url}&page=${page}`, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`World Bank population: HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.[1]) || !Number.isInteger(Number(payload[0]?.pages))) throw new Error("Invalid World Bank response");
    pages = Number(payload[0].pages);
    lastUpdated = payload[0].lastupdated || lastUpdated;
    rows.push(...payload[1]);
  }
  return { rows, lastUpdated };
}

export function buildPopulationData(countries, observations, geography, lastUpdated = null) {
  const economies = countries.filter(country => country.region?.id && country.region.id !== "NA");
  const sites = new Map(economies.map(country => {
    const code = country.id === "XKX" ? "KOS" : country.id;
    const feature = geography.features.find(({ properties: p }) => [p.WB_A3, p.ISO_A3, p.ADM0_A3].includes(code));
    const position = country.id === "GIB" ? GIBRALTAR_POSITION
      : { lat: feature?.properties.LABEL_Y, lon: feature?.properties.LABEL_X };
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lon)) throw new Error(`Population position missing: ${country.id}`);
    return [country.id, { id: country.id.toLowerCase(), name: country.name, country: country.name,
      countryJa: country.id === "CHI" ? "チャネル諸島" : feature?.properties.NAME_JA || country.name,
      iso2: country.iso2Code, iso3: country.id, ...position }];
  }));
  const seen = new Set();
  const rows = observations.flatMap(row => {
    const site = sites.get(row.countryiso3code), year = Number(row.date);
    if (!site || year < 1960 || year > 2025 || row.value === null) return [];
    if (!Number.isInteger(year) || !Number.isFinite(row.value) || row.value < 0) throw new Error("Invalid population observation");
    const key = `${site.iso3}:${year}`;
    if (seen.has(key)) throw new Error(`Duplicate population: ${key}`);
    seen.add(key);
    return [{ ...site, year, population: row.value }];
  }).sort((a, b) => a.year - b.year || a.iso3.localeCompare(b.iso3));
  const coverage = {
    countryCount: sites.size, countryCodes: [...sites.keys()].sort(), firstYear: 1960, lastYear: 2025,
    sourceLastUpdated: lastUpdated, aggregatesExcluded: true, missingPolicy: "omit-null-country-years; no interpolation or zero fill",
    missingCountryYears: sites.size * 66 - rows.length,
    byYear: Array.from({ length: 66 }, (_, index) => {
      const year = 1960 + index, available = new Set(rows.filter(row => row.year === year).map(row => row.iso3));
      return { year, count: available.size, missing: [...sites.keys()].filter(code => !available.has(code)).sort() };
    }),
  };
  if (coverage.byYear.some(year => year.count < 200)) throw new Error("Global population coverage unexpectedly incomplete");
  return { rows, coverage };
}

export async function fetchPopulationData(geography) {
  const [countries, series] = await Promise.all([fetchPages(POPULATION_COUNTRIES_URL), fetchPages(POPULATION_SERIES_URL)]);
  return buildPopulationData(countries.rows, series.rows, geography, series.lastUpdated);
}

export function populationDataset({ rows, coverage }, retrievedAt) {
  return {
    id: "worldbank-population", kind: "SOURCE", organisation: "World Bank / United Nations Population Division",
    title: "Population, total (SP.POP.TOTL)", url: "https://data.worldbank.org/indicator/SP.POP.TOTL", retrievedAt,
    period: "1960–2025", unit: "people", resolution: `${rows.length} annual values / ${coverage.countryCount} countries and economies`,
    transformation: "世界銀行の国・地域を全件対象とし、世界・地域・所得階層などの集計値を除外。選択年の人口を、全年共通の面積尺度で円に変換します。欠測年は補間せず非表示にします。",
    caveat: "点はNatural Earthの国・地域ラベル位置で、人口分布や密度ではありません。歴史的な国境ではなく現在の統計区分です。年によって収録数が異なります。人口の多さは豊かさや環境負荷を意味しません。",
    countryMetadataUrl: POPULATION_COUNTRIES_URL, dataUrl: POPULATION_SERIES_URL,
    positionSource: "data/natural-earth-50m-countries.geojson / LABEL_X, LABEL_Y; Gibraltar: Natural Earth 10m",
    positionSupplementUrl: POSITION_SOURCE, sourceLastUpdated: coverage.sourceLastUpdated, preview: rows.slice(0, 10),
  };
}
