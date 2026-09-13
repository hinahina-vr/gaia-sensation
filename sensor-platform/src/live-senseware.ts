import { cachedPrefectureField } from "./prefecture-field";

const HAWAII_BBOX = [-156.2, 18.8, -154.7, 20.3] as const;
const HAWAII_CENTER = { lat: 19.55, lon: -155.45 } as const;
const CITY_LOCATIONS = Object.freeze({
  sapporo: Object.freeze({ id: "sapporo", name: "北海道・札幌", lat: 43.0618, lon: 141.3545 }),
  aomori: Object.freeze({ id: "aomori", name: "青森県・青森", lat: 40.8244, lon: 140.74 }),
  morioka: Object.freeze({ id: "morioka", name: "岩手県・盛岡", lat: 39.7036, lon: 141.1527 }),
  sendai: Object.freeze({ id: "sendai", name: "宮城県・仙台", lat: 38.2682, lon: 140.8694 }),
  akita: Object.freeze({ id: "akita", name: "秋田県・秋田", lat: 39.7186, lon: 140.1024 }),
  yamagata: Object.freeze({ id: "yamagata", name: "山形県・山形", lat: 38.2404, lon: 140.3633 }),
  fukushima: Object.freeze({ id: "fukushima", name: "福島県・福島", lat: 37.7503, lon: 140.4676 }),
  mito: Object.freeze({ id: "mito", name: "茨城県・水戸", lat: 36.3418, lon: 140.4468 }),
  utsunomiya: Object.freeze({ id: "utsunomiya", name: "栃木県・宇都宮", lat: 36.5658, lon: 139.8836 }),
  maebashi: Object.freeze({ id: "maebashi", name: "群馬県・前橋", lat: 36.3911, lon: 139.0608 }),
  saitama: Object.freeze({ id: "saitama", name: "埼玉県・さいたま", lat: 35.8569, lon: 139.6489 }),
  chiba: Object.freeze({ id: "chiba", name: "千葉県・千葉", lat: 35.6074, lon: 140.1065 }),
  tokyo: Object.freeze({ id: "tokyo", name: "東京都・東京", lat: 35.6762, lon: 139.6503 }),
  yokohama: Object.freeze({ id: "yokohama", name: "神奈川県・横浜", lat: 35.4437, lon: 139.638 }),
  niigata: Object.freeze({ id: "niigata", name: "新潟県・新潟", lat: 37.9026, lon: 139.0232 }),
  toyama: Object.freeze({ id: "toyama", name: "富山県・富山", lat: 36.6953, lon: 137.2113 }),
  kanazawa: Object.freeze({ id: "kanazawa", name: "石川県・金沢", lat: 36.5613, lon: 136.6562 }),
  fukui: Object.freeze({ id: "fukui", name: "福井県・福井", lat: 36.0652, lon: 136.2216 }),
  kofu: Object.freeze({ id: "kofu", name: "山梨県・甲府", lat: 35.6642, lon: 138.5684 }),
  nagano: Object.freeze({ id: "nagano", name: "長野県・長野", lat: 36.6513, lon: 138.181 }),
  gifu: Object.freeze({ id: "gifu", name: "岐阜県・岐阜", lat: 35.4233, lon: 136.7606 }),
  shizuoka: Object.freeze({ id: "shizuoka", name: "静岡県・静岡", lat: 34.9756, lon: 138.3828 }),
  nagoya: Object.freeze({ id: "nagoya", name: "愛知県・名古屋", lat: 35.1815, lon: 136.9066 }),
  tsu: Object.freeze({ id: "tsu", name: "三重県・津", lat: 34.7303, lon: 136.5086 }),
  otsu: Object.freeze({ id: "otsu", name: "滋賀県・大津", lat: 35.0179, lon: 135.8546 }),
  kyoto: Object.freeze({ id: "kyoto", name: "京都府・京都", lat: 35.0116, lon: 135.7681 }),
  osaka: Object.freeze({ id: "osaka", name: "大阪府・大阪", lat: 34.6937, lon: 135.5023 }),
  kobe: Object.freeze({ id: "kobe", name: "兵庫県・神戸", lat: 34.6901, lon: 135.1955 }),
  nara: Object.freeze({ id: "nara", name: "奈良県・奈良", lat: 34.6851, lon: 135.8048 }),
  wakayama: Object.freeze({ id: "wakayama", name: "和歌山県・和歌山", lat: 34.226, lon: 135.1675 }),
  tottori: Object.freeze({ id: "tottori", name: "鳥取県・鳥取", lat: 35.5011, lon: 134.2351 }),
  matsue: Object.freeze({ id: "matsue", name: "島根県・松江", lat: 35.4681, lon: 133.0484 }),
  okayama: Object.freeze({ id: "okayama", name: "岡山県・岡山", lat: 34.6618, lon: 133.9344 }),
  hiroshima: Object.freeze({ id: "hiroshima", name: "広島県・広島", lat: 34.3853, lon: 132.4553 }),
  yamaguchi: Object.freeze({ id: "yamaguchi", name: "山口県・山口", lat: 34.1859, lon: 131.4714 }),
  tokushima: Object.freeze({ id: "tokushima", name: "徳島県・徳島", lat: 34.0703, lon: 134.5548 }),
  takamatsu: Object.freeze({ id: "takamatsu", name: "香川県・高松", lat: 34.3428, lon: 134.0466 }),
  matsuyama: Object.freeze({ id: "matsuyama", name: "愛媛県・松山", lat: 33.8392, lon: 132.7657 }),
  kochi: Object.freeze({ id: "kochi", name: "高知県・高知", lat: 33.5597, lon: 133.5311 }),
  fukuoka: Object.freeze({ id: "fukuoka", name: "福岡県・福岡", lat: 33.5904, lon: 130.4017 }),
  saga: Object.freeze({ id: "saga", name: "佐賀県・佐賀", lat: 33.2635, lon: 130.3009 }),
  nagasaki: Object.freeze({ id: "nagasaki", name: "長崎県・長崎", lat: 32.7503, lon: 129.8777 }),
  kumamoto: Object.freeze({ id: "kumamoto", name: "熊本県・熊本", lat: 32.8031, lon: 130.7079 }),
  oita: Object.freeze({ id: "oita", name: "大分県・大分", lat: 33.2382, lon: 131.6126 }),
  miyazaki: Object.freeze({ id: "miyazaki", name: "宮崎県・宮崎", lat: 31.9077, lon: 131.4202 }),
  kagoshima: Object.freeze({ id: "kagoshima", name: "鹿児島県・鹿児島", lat: 31.5966, lon: 130.5571 }),
  naha: Object.freeze({ id: "naha", name: "沖縄県・那覇", lat: 26.2124, lon: 127.6809 }),
});
type ObservationCity = (typeof CITY_LOCATIONS)[keyof typeof CITY_LOCATIONS];
const DEFAULT_CITY = CITY_LOCATIONS.sapporo;
const cityBbox = (city: ObservationCity): readonly number[] => [city.lon - 0.3, city.lat - 0.25, city.lon + 0.3, city.lat + 0.25];
const resolveObservationCity = (value: string | null): ObservationCity => CITY_LOCATIONS[value as keyof typeof CITY_LOCATIONS] || DEFAULT_CITY;
const TRANSFORM_VERSION = "live-senseware-v5-japan-wind-field";
const STREAM_LIFETIME_MS = 10 * 60 * 1_000;
const STREAM_REFRESH_MS = 5 * 60 * 1_000;
const HEARTBEAT_MS = 15_000;
const FIRMS_SOURCE_URL = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv";
const FIRMS_SOURCE_PAGE = "https://firms.modaps.eosdis.nasa.gov/active_fire/";
const FIRMS_CACHE_KEY = "nasa-firms-modis-global-24h-v1";
const FIRMS_TTL_MS = 15 * 60 * 1_000;
const FIRMS_MAX_SOURCE_BYTES = 4_000_000;
const FIRMS_MAX_POINTS = 1_600;
const FIRMS_CONFIDENCE_MIN = 60;
const FIRMS_SPATIAL_BIN_DEGREES = 2.5;
const FIRMS_TIME_BIN_MINUTES = 60;

type Provider = "noaa" | "jaxa" | "esa" | "open-meteo";
type LiveStatus = "near-real-time" | "latest-published" | "stale" | "snapshot";
type MeasurementKey = "windSpeed" | "airTemperature" | "co2" | "precipitation" | "no2"
  | "weatherWindSpeed" | "weatherTemperature" | "weatherPrecipitation" | "cloudCover" | "forecastCo2" | "pm25";

interface LiveMeasurement {
  key: MeasurementKey;
  value: number | null;
  unit: string;
  quality: "valid" | "estimated" | "missing";
  sourceKind: "SOURCE" | "MODEL";
}

export interface LiveObservationEvent {
  schemaVersion: 1;
  eventId: string;
  provider: Provider;
  datasetId: string;
  status: LiveStatus;
  observedAt: string;
  retrievedAt: string;
  location: { label: string; lat: number; lon: number; bbox: readonly number[] };
  measurements: LiveMeasurement[];
  provenance: { sourceUrl: string; licenseUrl: string; transformVersion: string };
  fallbackReason?: string;
}

interface LiveEnv {
  ASSETS: Fetcher;
  LIVE_SENSEWARE_ENABLED?: string;
  LIVE_SENSEWARE_JAXA_ENABLED?: string;
  LIVE_SENSEWARE_ESA_ENABLED?: string;
  CDSE_CLIENT_ID?: string;
  CDSE_CLIENT_SECRET?: string;
}

interface CachedEvent {
  event: LiveObservationEvent;
  upstreamEtag?: string;
  upstreamLastModified?: string;
}

interface LiveWindPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  windSpeed: number | null;
  observedAt: string | null;
  quality: "estimated" | "missing";
}

interface LiveWindField {
  schemaVersion: 1;
  source: "open-meteo" | "stale-cache" | "unavailable";
  generatedAt: string;
  points: LiveWindPoint[];
  provenance: { sourceUrl: string; licenseUrl: string; transformVersion: string };
  fallbackReason?: string;
}


interface FirmsFirePoint {
  id: string;
  lat: number;
  lon: number;
  brightness: number;
  frp: number;
  confidence: number;
  daynight: "D" | "N";
  acquiredAt: string;
  satellite: string;
}

interface FirmsFireSnapshot {
  schemaVersion: 1;
  source: "nasa-firms-modis" | "stale-cache" | "snapshot";
  generatedAt: string;
  points: FirmsFirePoint[];
  summary: {
    detected: number;
    displayed: number;
    maxFrp: number;
    totalFrp: number;
    nightShare: number;
    highConfidenceShare: number;
    start: string;
    end: string;
  };
  provenance: {
    provider: string;
    dataset: string;
    sourceUrl: string;
    sourcePage: string;
    resolution: string;
    transformVersion: string;
    filters: Record<string, string | number>;
  };
  fallbackReason?: string;
}

interface CachedFirmsFireSnapshot {
  snapshot: FirmsFireSnapshot;
  retrievedAt: string;
  upstreamEtag?: string;
  upstreamLastModified?: string;
}

interface ProviderDefinition {
  cacheKey: string;
  ttlMs: number;
  load: (conditional: Headers) => Promise<CachedEvent>;
}

const jsonHeaders = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
});

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12_000): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("upstream-timeout"), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const sourceHeaders = (response: Response): Pick<CachedEvent, "upstreamEtag" | "upstreamLastModified"> => ({
  upstreamEtag: response.headers.get("ETag") || undefined,
  upstreamLastModified: response.headers.get("Last-Modified") || undefined,
});

const conditionalHeaders = (cached?: { upstreamEtag?: string; upstreamLastModified?: string }): Headers => {
  const headers = new Headers({ Accept: "application/json,text/plain;q=0.9,*/*;q=0.5" });
  if (cached?.upstreamEtag) headers.set("If-None-Match", cached.upstreamEtag);
  if (cached?.upstreamLastModified) headers.set("If-Modified-Since", cached.upstreamLastModified);
  return headers;
};

const cacheRequest = (key: string): Request => new Request(`https://gaia-live-cache.invalid/${encodeURIComponent(key)}`);
const liveCache = (): Cache => (caches as CacheStorage & { default: Cache }).default;

const readCacheJson = async <Payload>(key: string): Promise<Payload | undefined> => {
  const response = await liveCache().match(cacheRequest(key));
  if (!response) return undefined;
  try {
    return await response.json<Payload>();
  } catch {
    return undefined;
  }
};

const writeCacheJson = async (key: string, payload: unknown): Promise<void> => {
  const response = new Response(JSON.stringify(payload), {
    headers: { "Cache-Control": "public, max-age=604800", "Content-Type": "application/json" },
  });
  await liveCache().put(cacheRequest(key), response);
};

const readCached = (key: string): Promise<CachedEvent | undefined> => readCacheJson<CachedEvent>(key);
const writeCached = (key: string, cached: CachedEvent): Promise<void> => writeCacheJson(key, cached);

const firmsPointScore = (point: FirmsFirePoint): number => Math.log1p(point.frp)
  * (0.55 + point.confidence / 200)
  + (point.daynight === "N" ? 0.04 : 0);

const firmsAcquiredAt = (date: string, time: string): string => {
  const digits = String(time || "").padStart(4, "0");
  const value = `${date}T${digits.slice(0, 2)}:${digits.slice(2)}:00Z`;
  return Number.isFinite(Date.parse(value)) ? value : "";
};

const compactFirmsCsv = (csv: string): Pick<FirmsFireSnapshot, "points" | "summary"> => {
  const lines = csv.trim().split(/\r?\n/u);
  const header = lines.shift()?.split(",") || [];
  const columns = new Map(header.map((name, index) => [name.trim(), index]));
  const indexOf = (name: string): number => {
    const index = columns.get(name);
    if (index === undefined) throw new Error(`FIRMS column missing: ${name}`);
    return index;
  };
  const latitudeIndex = indexOf("latitude");
  const longitudeIndex = indexOf("longitude");
  const brightnessIndex = indexOf("brightness");
  const dateIndex = indexOf("acq_date");
  const timeIndex = indexOf("acq_time");
  const satelliteIndex = indexOf("satellite");
  const confidenceIndex = indexOf("confidence");
  const frpIndex = indexOf("frp");
  const daynightIndex = indexOf("daynight");
  const bins = new Map<string, FirmsFirePoint>();
  let detected = 0;

  for (const line of lines) {
    if (!line) continue;
    const cells = line.split(",");
    const lat = Number(cells[latitudeIndex]);
    const lon = Number(cells[longitudeIndex]);
    const brightness = Number(cells[brightnessIndex]);
    const frp = Number(cells[frpIndex]);
    const confidence = Number(cells[confidenceIndex]);
    const acquiredAt = firmsAcquiredAt(cells[dateIndex] || "", cells[timeIndex] || "");
    const daynight: "D" | "N" = cells[daynightIndex] === "N" ? "N" : "D";
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
      || !Number.isFinite(brightness) || !(frp >= 0) || confidence < FIRMS_CONFIDENCE_MIN || !acquiredAt) continue;
    detected += 1;
    const point: FirmsFirePoint = {
      id: `${cells[satelliteIndex] || "M"}:${acquiredAt}:${lat.toFixed(5)}:${lon.toFixed(5)}`,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      brightness: Number(brightness.toFixed(2)),
      frp: Number(frp.toFixed(2)),
      confidence: Math.round(confidence),
      daynight,
      acquiredAt,
      satellite: cells[satelliteIndex] || "MODIS",
    };
    const minutes = Math.floor(Date.parse(acquiredAt) / 60_000 / FIRMS_TIME_BIN_MINUTES);
    const key = `${Math.floor((lon + 180) / FIRMS_SPATIAL_BIN_DEGREES)}:${Math.floor((lat + 90) / FIRMS_SPATIAL_BIN_DEGREES)}:${minutes}`;
    const previous = bins.get(key);
    if (!previous || firmsPointScore(point) > firmsPointScore(previous)) bins.set(key, point);
  }

  const points = [...bins.values()]
    .sort((left, right) => firmsPointScore(right) - firmsPointScore(left))
    .slice(0, FIRMS_MAX_POINTS)
    .sort((left, right) => left.acquiredAt.localeCompare(right.acquiredAt) || left.id.localeCompare(right.id));
  if (!points.length) throw new Error("FIRMS feed contains no usable detections");
  return {
    points,
    summary: {
      detected,
      displayed: points.length,
      maxFrp: Number(Math.max(...points.map((point) => point.frp)).toFixed(2)),
      totalFrp: Number(points.reduce((sum, point) => sum + point.frp, 0).toFixed(2)),
      nightShare: Number((points.filter((point) => point.daynight === "N").length / points.length).toFixed(4)),
      highConfidenceShare: Number((points.filter((point) => point.confidence >= 80).length / points.length).toFixed(4)),
      start: points[0]?.acquiredAt || "",
      end: points.at(-1)?.acquiredAt || "",
    },
  };
};

const freshFirmsSnapshot = async (cached?: CachedFirmsFireSnapshot): Promise<CachedFirmsFireSnapshot> => {
  const headers = conditionalHeaders(cached);
  headers.set("Accept", "text/csv");
  const response = await fetchWithTimeout(FIRMS_SOURCE_URL, { headers }, 15_000);
  if (response.status === 304 && cached) {
    return { ...cached, retrievedAt: new Date().toISOString(), snapshot: { ...cached.snapshot, source: "nasa-firms-modis", fallbackReason: undefined } };
  }
  if (!response.ok) throw new Error(`NASA FIRMS ${response.status}`);
  const contentLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > FIRMS_MAX_SOURCE_BYTES) {
    throw new Error(`NASA FIRMS response exceeds ${FIRMS_MAX_SOURCE_BYTES} bytes`);
  }
  const csv = await response.text();
  if (new TextEncoder().encode(csv).byteLength > FIRMS_MAX_SOURCE_BYTES) {
    throw new Error(`NASA FIRMS response exceeds ${FIRMS_MAX_SOURCE_BYTES} bytes`);
  }
  const generatedAt = new Date().toISOString();
  const compacted = compactFirmsCsv(csv);
  return {
    snapshot: {
      schemaVersion: 1,
      source: "nasa-firms-modis",
      generatedAt,
      ...compacted,
      provenance: {
        provider: "NASA LANCE FIRMS",
        dataset: "MODIS Collection 6.1 NRT Global 24h",
        sourceUrl: FIRMS_SOURCE_URL,
        sourcePage: FIRMS_SOURCE_PAGE,
        resolution: "1 km nominal",
        transformVersion: "firms-global-fire-v1",
        filters: {
          confidenceMin: FIRMS_CONFIDENCE_MIN,
          spatialBinDegrees: FIRMS_SPATIAL_BIN_DEGREES,
          timeBinMinutes: FIRMS_TIME_BIN_MINUTES,
          maxPoints: FIRMS_MAX_POINTS,
          method: "highest FRP-weighted confidence detection per space-time bin",
        },
      },
    },
    retrievedAt: generatedAt,
    upstreamEtag: response.headers.get("ETag") || undefined,
    upstreamLastModified: response.headers.get("Last-Modified") || undefined,
  };
};

const eventAge = (event: LiveObservationEvent): number => Date.now() - Date.parse(event.retrievedAt);

const withStaleStatus = (cached: CachedEvent, reason: string): LiveObservationEvent => ({
  ...cached.event,
  status: "stale",
  fallbackReason: reason,
});

const loadCachedProvider = async (definition: ProviderDefinition, ctx: ExecutionContext): Promise<LiveObservationEvent> => {
  const cached = await readCached(definition.cacheKey);
  if (cached && eventAge(cached.event) < definition.ttlMs) return cached.event;
  try {
    const fresh = await definition.load(conditionalHeaders(cached));
    ctx.waitUntil(writeCached(definition.cacheKey, fresh));
    return fresh.event;
  } catch (error) {
    if (cached && error instanceof Error && /(?:304|not-modified)/iu.test(error.message)) {
      const refreshed = { ...cached, event: { ...cached.event, retrievedAt: new Date().toISOString() } };
      ctx.waitUntil(writeCached(definition.cacheKey, refreshed));
      return refreshed.event;
    }
    if (cached) return withStaleStatus(cached, error instanceof Error ? error.message : "upstream-failure");
    throw error;
  }
};

const degrees = (value: number): number => value * Math.PI / 180;
const distanceKm = (lat: number, lon: number): number => {
  const deltaLat = degrees(lat - HAWAII_CENTER.lat);
  const deltaLon = degrees(lon - HAWAII_CENTER.lon);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(degrees(HAWAII_CENTER.lat)) * Math.cos(degrees(lat)) * Math.sin(deltaLon / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const loadNdbc = async (headers: Headers): Promise<CachedEvent> => {
  const sourceUrl = "https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt";
  const response = await fetchWithTimeout(sourceUrl, { headers });
  if (response.status === 304) throw new Error("not-modified-without-refresh");
  if (!response.ok) throw new Error(`NDBC ${response.status}`);
  const candidates = (await response.text()).split(/\r?\n/u).slice(2).map((line) => line.trim().split(/\s+/u)).map((columns) => {
    const lat = Number(columns[1]);
    const lon = Number(columns[2]);
    const wind = Number(columns[9]);
    const temperature = Number(columns[16]);
    const observedAt = `${columns[3]}-${columns[4]}-${columns[5]}T${columns[6]}:${columns[7]}:00Z`;
    return { station: columns[0] || "unknown", lat, lon, wind, temperature, observedAt };
  }).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon) && (Number.isFinite(row.wind) || Number.isFinite(row.temperature)))
    .sort((left, right) => distanceKm(left.lat, left.lon) - distanceKm(right.lat, right.lon));
  const row = candidates[0];
  if (!row) throw new Error("NDBC valid station missing");
  const retrievedAt = new Date().toISOString();
  const status: LiveStatus = Date.now() - Date.parse(row.observedAt) <= 3 * 60 * 60 * 1_000 ? "near-real-time" : "stale";
  return {
    event: {
      schemaVersion: 1,
      eventId: `noaa:ndbc:${row.station}:${row.observedAt}`,
      provider: "noaa",
      datasetId: `NDBC latest observations / ${row.station}`,
      status,
      observedAt: row.observedAt,
      retrievedAt,
      location: { label: `NDBC ${row.station} (${Math.round(distanceKm(row.lat, row.lon))} km from bbox center)`, lat: row.lat, lon: row.lon, bbox: HAWAII_BBOX },
      measurements: [
        { key: "windSpeed", value: Number.isFinite(row.wind) ? row.wind : null, unit: "m/s", quality: Number.isFinite(row.wind) ? "valid" : "missing", sourceKind: "SOURCE" },
        { key: "airTemperature", value: Number.isFinite(row.temperature) ? row.temperature : null, unit: "degree C", quality: Number.isFinite(row.temperature) ? "valid" : "missing", sourceKind: "SOURCE" },
      ],
      provenance: { sourceUrl, licenseUrl: "https://www.noaa.gov/information-technology/open-data-dissemination", transformVersion: TRANSFORM_VERSION },
    },
    ...sourceHeaders(response),
  };
};

const loadCo2 = async (headers: Headers): Promise<CachedEvent> => {
  const sourceUrl = "https://erddap.gml.noaa.gov/erddap/tabledap/greenhouse_gases_co2_insitu_hourly_averages_surface.csv?time,site_code,latitude,longitude,value&site_code=%22MLO%22&orderByMax(%22time%22)";
  headers.set("Accept", "text/csv");
  const response = await fetchWithTimeout(sourceUrl, { headers });
  if (response.status === 304) throw new Error("NOAA GML 304 not-modified");
  if (!response.ok) throw new Error(`NOAA GML ${response.status}`);
  const rows = (await response.text()).trim().split(/\r?\n/u);
  const values = rows.at(-1)?.split(",");
  const observedAt = values?.[0] || "";
  const lat = Number(values?.[2]);
  const lon = Number(values?.[3]);
  const co2 = Number(values?.[4]);
  if (!observedAt || !Number.isFinite(co2)) throw new Error("NOAA GML malformed value");
  return {
    event: {
      schemaVersion: 1,
      eventId: `noaa:gml-mlo-co2:${observedAt}`,
      provider: "noaa",
      datasetId: "NOAA GML Mauna Loa hourly CO2",
      status: "latest-published",
      observedAt,
      retrievedAt: new Date().toISOString(),
      location: { label: "Mauna Loa Observatory", lat, lon, bbox: HAWAII_BBOX },
      measurements: [{ key: "co2", value: co2, unit: "micromol mol-1", quality: "valid", sourceKind: "SOURCE" }],
      provenance: { sourceUrl, licenseUrl: "https://gml.noaa.gov/ccgg/about/co2_measurements.html", transformVersion: TRANSFORM_VERSION },
    },
    ...sourceHeaders(response),
  };
};

interface OpenMeteoCurrent {
  time?: string;
  temperature_2m?: number;
  precipitation?: number;
  cloud_cover?: number;
  wind_speed_10m?: number;
  carbon_dioxide?: number;
  pm2_5?: number;
}

interface OpenMeteoPayload {
  latitude?: number;
  longitude?: number;
  current?: OpenMeteoCurrent;
}

const openMeteoObservedAt = (value?: string): string => {
  if (!value) throw new Error("Open-Meteo current time missing");
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/u.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error("Open-Meteo current time malformed");
  return date.toISOString();
};

const numericOrNull = (value: unknown): number | null => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const loadOpenMeteoWeather = async (headers: Headers, city: ObservationCity): Promise<CachedEvent> => {
  const sourceUrl = new URL("https://api.open-meteo.com/v1/forecast");
  sourceUrl.search = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    current: "temperature_2m,precipitation,cloud_cover,wind_speed_10m",
    wind_speed_unit: "ms",
    timezone: "GMT",
    forecast_days: "1",
  }).toString();
  const response = await fetchWithTimeout(sourceUrl, { headers });
  if (response.status === 304) throw new Error("Open-Meteo weather 304 not-modified");
  if (!response.ok) throw new Error(`Open-Meteo weather ${response.status}`);
  const current = (await response.json<OpenMeteoPayload>()).current;
  if (!current) throw new Error("Open-Meteo weather current missing");
  const observedAt = openMeteoObservedAt(current.time);
  const wind = numericOrNull(current.wind_speed_10m);
  const temperature = numericOrNull(current.temperature_2m);
  const precipitation = numericOrNull(current.precipitation);
  const cloudCover = numericOrNull(current.cloud_cover);
  if ([wind, temperature, precipitation, cloudCover].every((value) => value === null)) throw new Error("Open-Meteo weather values missing");
  return {
    event: {
      schemaVersion: 1,
      eventId: `open-meteo:${city.id}-weather:${observedAt}`,
      provider: "open-meteo",
      datasetId: `Open-Meteo Best Match / ${city.name} current weather`,
      status: "near-real-time",
      observedAt,
      retrievedAt: new Date().toISOString(),
      location: { label: `Open-Meteo / ${city.name}`, lat: city.lat, lon: city.lon, bbox: cityBbox(city) },
      measurements: [
        { key: "weatherWindSpeed", value: wind, unit: "m/s", quality: wind === null ? "missing" : "estimated", sourceKind: "MODEL" },
        { key: "weatherTemperature", value: temperature, unit: "℃", quality: temperature === null ? "missing" : "estimated", sourceKind: "MODEL" },
        { key: "weatherPrecipitation", value: precipitation, unit: "mm", quality: precipitation === null ? "missing" : "estimated", sourceKind: "MODEL" },
        { key: "cloudCover", value: cloudCover, unit: "%", quality: cloudCover === null ? "missing" : "estimated", sourceKind: "MODEL" },
      ],
      provenance: { sourceUrl: sourceUrl.href, licenseUrl: "https://open-meteo.com/en/pricing", transformVersion: TRANSFORM_VERSION },
    },
    ...sourceHeaders(response),
  };
};


const liveWindField = async (env: LiveEnv, ctx: ExecutionContext): Promise<LiveWindField> => {
  const field = await cachedPrefectureField("weather", Object.values(CITY_LOCATIONS), env.LIVE_SENSEWARE_ENABLED === "true", ctx);
  return { ...field, points: field.points.map(point => ({ ...point,
    windSpeed: point.measurements.weatherWindSpeed ?? null,
    quality: point.measurements.weatherWindSpeed == null ? "missing" : "estimated",
  })) };
};

const loadOpenMeteoAir = async (headers: Headers, city: ObservationCity): Promise<CachedEvent> => {
  const sourceUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  sourceUrl.search = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    current: "carbon_dioxide,pm2_5",
    timezone: "GMT",
    forecast_days: "1",
  }).toString();
  const response = await fetchWithTimeout(sourceUrl, { headers });
  if (response.status === 304) throw new Error("Open-Meteo air quality 304 not-modified");
  if (!response.ok) throw new Error(`Open-Meteo air quality ${response.status}`);
  const current = (await response.json<OpenMeteoPayload>()).current;
  if (!current) throw new Error("Open-Meteo air quality current missing");
  const observedAt = openMeteoObservedAt(current.time);
  const co2 = numericOrNull(current.carbon_dioxide);
  const pm25 = numericOrNull(current.pm2_5);
  if (co2 === null && pm25 === null) throw new Error("Open-Meteo air quality values missing");
  return {
    event: {
      schemaVersion: 1,
      eventId: `open-meteo:${city.id}-cams:${observedAt}`,
      provider: "open-meteo",
      datasetId: "Open-Meteo / CAMS global atmosphere forecast",
      status: "latest-published",
      observedAt,
      retrievedAt: new Date().toISOString(),
      location: { label: `CAMSモデル / ${city.name}格子`, lat: city.lat, lon: city.lon, bbox: cityBbox(city) },
      measurements: [
        { key: "forecastCo2", value: co2, unit: "ppm", quality: co2 === null ? "missing" : "estimated", sourceKind: "MODEL" },
        { key: "pm25", value: pm25, unit: "µg/m³", quality: pm25 === null ? "missing" : "estimated", sourceKind: "MODEL" },
      ],
      provenance: { sourceUrl: sourceUrl.href, licenseUrl: "https://open-meteo.com/en/pricing", transformVersion: TRANSFORM_VERSION },
    },
    ...sourceHeaders(response),
  };
};

// The contest release intentionally omits the optional GeoTIFF decoder.
// Existing JAXA snapshot fallback remains available; do not fabricate live values.
const loadJaxa = async (_headers: Headers): Promise<CachedEvent> => {
  throw new Error("JAXA live decoder is not included in the contest release; using saved snapshot");
};

const loadEsa = async (env: LiveEnv): Promise<CachedEvent> => {
  if (!env.CDSE_CLIENT_ID || !env.CDSE_CLIENT_SECRET) throw new Error("ESA credentials unavailable");
  const tokenResponse = await fetchWithTimeout("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.CDSE_CLIENT_ID,
      client_secret: env.CDSE_CLIENT_SECRET,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`ESA OAuth ${tokenResponse.status}`);
  const token = await tokenResponse.json<{ access_token?: string }>();
  if (!token.access_token) throw new Error("ESA OAuth token missing");
  const to = new Date();
  const from = new Date(to.getTime() - 72 * 60 * 60 * 1_000);
  const sourceUrl = "https://sh.dataspace.copernicus.eu/api/v1/statistics";
  const statisticsResponse = await fetchWithTimeout(sourceUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: { bbox: HAWAII_BBOX, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
        data: [{ type: "sentinel-5p-l2", dataFilter: { timeRange: { from: from.toISOString(), to: to.toISOString() }, timeliness: "NRTI" } }],
      },
      aggregation: {
        timeRange: { from: from.toISOString(), to: to.toISOString() },
        aggregationInterval: { of: "P1D" },
        resolution: { x: 0.02, y: 0.02 },
        evalscript: "//VERSION=3\nfunction setup(){return {input:[{bands:[\"NO2\",\"dataMask\"]}],output:[{id:\"data\",bands:1,sampleType:\"FLOAT32\"}]};}\nfunction evaluatePixel(s){return {data:[s.dataMask ? s.NO2 : NaN]};}",
      },
      calculations: { default: {} },
    }),
  }, 20_000);
  if (!statisticsResponse.ok) throw new Error(`ESA statistics ${statisticsResponse.status}`);
  const payload = await statisticsResponse.json<{ data?: Array<{ interval?: { from?: string }; outputs?: { data?: { bands?: { B0?: { stats?: { mean?: number } } } } } }> }>();
  const latest = payload.data?.filter((entry) => Number.isFinite(entry.outputs?.data?.bands?.B0?.stats?.mean)).at(-1);
  const mean = latest?.outputs?.data?.bands?.B0?.stats?.mean;
  const observedAt = latest?.interval?.from;
  if (typeof mean !== "number" || !Number.isFinite(mean) || !observedAt) throw new Error("ESA NO2 valid mean missing");
  return {
    event: {
      schemaVersion: 1,
      eventId: `esa:sentinel-5p-no2:${observedAt}`,
      provider: "esa",
      datasetId: "Sentinel-5P L2 NO2 NRTI",
      status: "near-real-time",
      observedAt,
      retrievedAt: new Date().toISOString(),
      location: { label: "Hawaii fixed bbox quality-masked mean", ...HAWAII_CENTER, bbox: HAWAII_BBOX },
      measurements: [{ key: "no2", value: mean, unit: "mol/m2", quality: "estimated", sourceKind: "SOURCE" }],
      provenance: { sourceUrl, licenseUrl: "https://dataspace.copernicus.eu/terms-and-conditions", transformVersion: TRANSFORM_VERSION },
    },
  };
};

const eventIdentity = (event: LiveObservationEvent): string => {
  if (event.provider === "open-meteo") return `${event.provider}:${event.datasetId.includes("CAMS") ? "air" : "weather"}`;
  return `${event.provider}:${event.datasetId.includes("CO2") ? "co2" : "main"}`;
};

const fallbackSnapshot = async (request: Request, env: LiveEnv, reason: string): Promise<{ schemaVersion: 1; source: "snapshot"; generatedAt?: string; bbox?: readonly number[]; events: LiveObservationEvent[]; fallbackReason: string }> => {
  const fallbackUrl = new URL("/data/live-observation-fallback-v1.json", request.url);
  const response = await env.ASSETS.fetch(new Request(fallbackUrl, { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Versioned live snapshot ${response.status}`);
  const payload = await response.json<{ generatedAt?: string; bbox?: readonly number[]; events: LiveObservationEvent[] }>();
  return { schemaVersion: 1, source: "snapshot", generatedAt: payload.generatedAt, bbox: payload.bbox, events: payload.events, fallbackReason: reason };
};

const fallbackFirmsSnapshot = async (request: Request, env: LiveEnv, reason: string): Promise<FirmsFireSnapshot> => {
  const fallbackUrl = new URL("/data/firms-active-fire-snapshot.json", request.url);
  const response = await env.ASSETS.fetch(new Request(fallbackUrl, { headers: { Accept: "application/json" } }));
  if (!response.ok) throw new Error(`Versioned FIRMS snapshot ${response.status}`);
  const payload = await response.json<FirmsFireSnapshot>();
  return { ...payload, source: "snapshot", fallbackReason: reason };
};

const liveFirmsSnapshot = async (request: Request, env: LiveEnv, ctx: ExecutionContext): Promise<FirmsFireSnapshot> => {
  const cached = await readCacheJson<CachedFirmsFireSnapshot>(FIRMS_CACHE_KEY);
  const cacheAge = cached ? Date.now() - Date.parse(cached.retrievedAt) : Number.POSITIVE_INFINITY;
  if (cached && cacheAge < FIRMS_TTL_MS) return cached.snapshot;
  if (env.LIVE_SENSEWARE_ENABLED !== "true") {
    if (cached) return { ...cached.snapshot, source: "stale-cache", fallbackReason: "LIVE_SENSEWARE_ENABLED is not true" };
    return fallbackFirmsSnapshot(request, env, "LIVE_SENSEWARE_ENABLED is not true");
  }
  try {
    const fresh = await freshFirmsSnapshot(cached);
    ctx.waitUntil(writeCacheJson(FIRMS_CACHE_KEY, fresh));
    return fresh.snapshot;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "NASA FIRMS upstream failure";
    if (cached) return { ...cached.snapshot, source: "stale-cache", fallbackReason: reason };
    return fallbackFirmsSnapshot(request, env, reason);
  }
};

const liveSnapshot = async (request: Request, env: LiveEnv, ctx: ExecutionContext): Promise<{ schemaVersion: 1; source: "live" | "snapshot"; generatedAt?: string; bbox?: readonly number[]; events: LiveObservationEvent[]; errors?: string[]; fallbackReason?: string }> => {
  const city = resolveObservationCity(new URL(request.url).searchParams.get("city"));
  if (env.LIVE_SENSEWARE_ENABLED !== "true") return fallbackSnapshot(request, env, "LIVE_SENSEWARE_ENABLED is not true");
  const definitions: ProviderDefinition[] = [
    { cacheKey: "noaa-ndbc", ttlMs: 5 * 60 * 1_000, load: loadNdbc },
    { cacheKey: "noaa-co2", ttlMs: 60 * 60 * 1_000, load: loadCo2 },
    { cacheKey: `open-meteo-${city.id}-weather-v1`, ttlMs: 30 * 60 * 1_000, load: (headers) => loadOpenMeteoWeather(headers, city) },
    { cacheKey: `open-meteo-${city.id}-air-v1`, ttlMs: 3 * 60 * 60 * 1_000, load: (headers) => loadOpenMeteoAir(headers, city) },
  ];
  if (env.LIVE_SENSEWARE_JAXA_ENABLED === "true") {
    definitions.push({ cacheKey: "jaxa-gsmap", ttlMs: 6 * 60 * 60 * 1_000, load: loadJaxa });
  }
  if (env.LIVE_SENSEWARE_ESA_ENABLED === "true" && env.CDSE_CLIENT_ID && env.CDSE_CLIENT_SECRET) {
    definitions.push({ cacheKey: "esa-no2", ttlMs: 30 * 60 * 1_000, load: () => loadEsa(env) });
  }
  const settled = await Promise.allSettled(definitions.map((definition) => loadCachedProvider(definition, ctx)));
  const events = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const errors = settled.flatMap((result) => result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "provider failure"] : []);
  if (!events.length) return fallbackSnapshot(request, env, errors.join("; "));
  const fallback = await fallbackSnapshot(request, env, "Some providers use saved snapshots");
  const available = new Set(events.map(eventIdentity));
  const disabledReasons = new Map<string, string>([
    ["jaxa:main", env.LIVE_SENSEWARE_JAXA_ENABLED === "true" ? "JAXA upstream unavailable" : "JAXA live disabled for free-plan CPU safety"],
    ["esa:main", env.LIVE_SENSEWARE_ESA_ENABLED !== "true" ? "ESA live disabled" : !env.CDSE_CLIENT_ID || !env.CDSE_CLIENT_SECRET ? "ESA credentials unavailable" : "ESA upstream unavailable"],
    ["open-meteo:weather", "Open-Meteo weather upstream unavailable"],
    ["open-meteo:air", "Open-Meteo CAMS upstream unavailable"],
  ]);
  for (const event of fallback.events) {
    const identity = eventIdentity(event);
    if (!available.has(identity)) {
      events.push({ ...event, fallbackReason: disabledReasons.get(identity) || errors.join("; ") || "provider snapshot fallback" });
    }
  }
  return { schemaVersion: 1, source: "live", generatedAt: new Date().toISOString(), bbox: cityBbox(city), events, errors: errors.length ? errors : undefined };
};

const sseLine = (event: string, data: unknown, id?: string): string => `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const streamResponse = (request: Request, env: LiveEnv, ctx: ExecutionContext): Response => {
  const encoder = new TextEncoder();
  let heartbeat = 0;
  let refresh = 0;
  let lifetime = 0;
  let closed = false;
  let refreshInFlight = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(refresh);
        clearTimeout(lifetime);
        try { controller.close(); } catch {}
      };
      const emitSnapshot = async () => {
        if (closed || refreshInFlight) return;
        refreshInFlight = true;
        try {
          const snapshot = await liveSnapshot(request, env, ctx);
          if (closed) return;
          const lastEventId = request.headers.get("Last-Event-ID") || new URL(request.url).searchParams.get("lastEventId") || "";
          const snapshotId = `snapshot:${snapshot.generatedAt || new Date().toISOString()}`;
          controller.enqueue(encoder.encode(sseLine("snapshot", { ...snapshot, resumedAfter: lastEventId || undefined }, snapshotId)));
          for (const event of snapshot.events) controller.enqueue(encoder.encode(sseLine("provider", event, event.eventId)));
          controller.enqueue(encoder.encode(sseLine("status", { state: "streaming", source: snapshot.source, refreshSeconds: STREAM_REFRESH_MS / 1_000 }, `status:${Date.now()}`)));
        } catch (error) {
          if (!closed) controller.error(error);
          close();
        } finally {
          refreshInFlight = false;
        }
      };
      request.signal.addEventListener("abort", close, { once: true });
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: heartbeat ${new Date().toISOString()}\n\n`));
      }, HEARTBEAT_MS) as unknown as number;
      refresh = setInterval(() => void emitSnapshot(), STREAM_REFRESH_MS) as unknown as number;
      lifetime = setTimeout(() => {
        controller.enqueue(encoder.encode(sseLine("status", { state: "complete", reconnect: true })));
        close();
      }, STREAM_LIFETIME_MS) as unknown as number;
      void emitSnapshot();
    },
    cancel() {
      closed = true;
      clearInterval(heartbeat);
      clearInterval(refresh);
      clearTimeout(lifetime);
    },
  });
  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

export const handleLiveSenseware = async (request: Request, env: LiveEnv, ctx: ExecutionContext): Promise<Response | null> => {
  const url = new URL(request.url);
  if (!["/api/live/v1/snapshot", "/api/live/v1/stream", "/api/live/v1/wind-field", "/api/live/v1/prefecture-field", "/api/live/v1/firms"].includes(url.pathname)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  if (url.pathname.endsWith("/stream")) return request.method === "HEAD" ? new Response(null, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } }) : streamResponse(request, env, ctx);
  if (url.pathname.endsWith("/firms")) {
    const snapshot = await liveFirmsSnapshot(request, env, ctx);
    return new Response(request.method === "HEAD" ? null : JSON.stringify(snapshot), {
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=60, stale-while-revalidate=840" },
    });
  }
  if (url.pathname.endsWith("/wind-field")) {
    const field = await liveWindField(env, ctx);
    return new Response(request.method === "HEAD" ? null : JSON.stringify(field), {
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=60, stale-while-revalidate=240" },
    });
  }
  if (url.pathname.endsWith("/prefecture-field")) {
    const [weather, air] = await Promise.all((["weather", "air"] as const).map(provider =>
      cachedPrefectureField(provider, Object.values(CITY_LOCATIONS), env.LIVE_SENSEWARE_ENABLED === "true", ctx)));
    return new Response(request.method === "HEAD" ? null : JSON.stringify({ schemaVersion: 1, scope: "japan-prefectures", targetCount: 47, weather, air }), {
      headers: { ...jsonHeaders, "Cache-Control": "public, max-age=60, stale-while-revalidate=240" },
    });
  }
  const snapshot = await liveSnapshot(request, env, ctx);
  const body = request.method === "HEAD" ? null : JSON.stringify(snapshot);
  return new Response(body, { headers: jsonHeaders });
};
