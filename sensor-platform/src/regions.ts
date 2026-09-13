import { ApiError, json } from "./http";
import { JAPAN_MUNICIPALITY_RECORDS, REGION_DATA_VERSION, SUBDIVISION_RECORDS } from "./region-code-data";

export type RegionOption = { code: string; name: string };
export type RegionOfficeLocation = {
  latitude: number;
  longitude: number;
  precision: "PREFECTURAL_GOVERNMENT_OFFICE" | "MUNICIPAL_MAIN_OFFICE";
};

type RegionOfficeRow = RegionOfficeLocation;

const subdivisionsByCountry = new Map<string, RegionOption[]>();
const subdivisionsByCode = new Map<string, RegionOption>();
for (const [code, countryCode, name] of SUBDIVISION_RECORDS) {
  const option = { code, name };
  subdivisionsByCode.set(code, option);
  const countryOptions = subdivisionsByCountry.get(countryCode) ?? [];
  countryOptions.push(option);
  subdivisionsByCountry.set(countryCode, countryOptions);
}

const municipalitiesBySubdivision = new Map<string, RegionOption[]>();
const municipalitiesByCode = new Map<string, RegionOption & { subdivisionCode: string }>();
for (const [code, subdivisionCode, name] of JAPAN_MUNICIPALITY_RECORDS) {
  const option = { code, name };
  municipalitiesByCode.set(code, { ...option, subdivisionCode });
  const subdivisionOptions = municipalitiesBySubdivision.get(subdivisionCode) ?? [];
  subdivisionOptions.push(option);
  municipalitiesBySubdivision.set(subdivisionCode, subdivisionOptions);
}

export const listRegions = (url: URL): Response => {
  const countryCode = (url.searchParams.get("countryCode") ?? "").normalize("NFKC").toUpperCase();
  const subdivisionCode = (url.searchParams.get("subdivisionCode") ?? "").normalize("NFKC").toUpperCase();
  if (!/^[A-Z]{2}$/u.test(countryCode)) {
    throw new ApiError(400, "INVALID_COUNTRY", "countryCode must be ISO 3166-1 alpha-2.");
  }
  if (subdivisionCode && !/^[A-Z]{2}-[A-Z0-9]{1,3}$/u.test(subdivisionCode)) {
    throw new ApiError(400, "INVALID_SUBDIVISION", "subdivisionCode must be a complete ISO 3166-2 code.");
  }
  if (subdivisionCode && !subdivisionCode.startsWith(`${countryCode}-`)) {
    throw new ApiError(400, "REGION_FIELD_CONFLICT", "subdivisionCode does not belong to countryCode.");
  }
  const subdivisions = subdivisionsByCountry.get(countryCode) ?? [];
  const municipalities = countryCode === "JP" && subdivisionCode
    ? municipalitiesBySubdivision.get(subdivisionCode) ?? []
    : [];
  return json({ version: REGION_DATA_VERSION, subdivisions, municipalities });
};

export const locateRegion = async (url: URL, env: Env): Promise<Response> => {
  const countryCode = (url.searchParams.get("countryCode") ?? "").normalize("NFKC").toUpperCase();
  const subdivisionCode = (url.searchParams.get("subdivisionCode") ?? "").normalize("NFKC").toUpperCase();
  const municipalityCode = (url.searchParams.get("municipalityCode") ?? "").normalize("NFKC");
  return json({ location: await resolveRegionOfficeLocation(env, countryCode, subdivisionCode, municipalityCode || null) });
};

export const resolveRegionOfficeLocation = async (
  env: Env,
  countryCode: string,
  subdivisionCode: string,
  municipalityCode: string | null,
): Promise<RegionOfficeLocation> => {
  if (countryCode !== "JP") throw new ApiError(400, "UNSUPPORTED_REGION_LOCATION", "Region plotting currently supports Japan.");
  const subdivision = subdivisionsByCode.get(subdivisionCode);
  if (!subdivision || !subdivisionCode.startsWith("JP-")) {
    throw new ApiError(400, "INVALID_SUBDIVISION", "A current Japanese subdivisionCode is required.");
  }
  const municipality = municipalityCode ? municipalitiesByCode.get(municipalityCode) : null;
  if (municipalityCode && (!municipality || municipality.subdivisionCode !== subdivisionCode)) {
    throw new ApiError(400, "INVALID_MUNICIPALITY", "municipalityCode must belong to subdivisionCode.");
  }
  const regionKey = municipalityCode ? `JP:MUNICIPALITY:${municipalityCode}` : `JP:PREFECTURE:${subdivisionCode}`;
  const cached = await env.DB.prepare(
    "SELECT latitude, longitude, precision FROM region_office_locations WHERE region_key = ?1",
  ).bind(regionKey).first<RegionOfficeRow>();
  if (cached) return cached;

  const precision = municipalityCode ? "MUNICIPAL_MAIN_OFFICE" : "PREFECTURAL_GOVERNMENT_OFFICE";
  const queries = municipality
    ? municipalityOfficeQueries(subdivision.name, municipality.name)
    : [`${subdivision.name}庁本庁舎`, `${subdivision.name}庁`];
  const coordinates = await locateGovernmentOffice(queries);
  if (!coordinates) throw new ApiError(502, "REGION_LOCATION_UNAVAILABLE", "The selected government office location was not found.");
  const location: RegionOfficeLocation = { ...coordinates, precision };
  await env.DB.prepare(
    `INSERT INTO region_office_locations
       (region_key, country_code, subdivision_code, municipality_code, latitude, longitude, precision, source, updated_at)
     VALUES (?1, 'JP', ?2, ?3, ?4, ?5, ?6, 'GSI_ADDRESS_SEARCH', ?7)
     ON CONFLICT(region_key) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude,
       precision = excluded.precision, updated_at = excluded.updated_at`,
  ).bind(regionKey, subdivisionCode, municipalityCode, location.latitude, location.longitude, precision, new Date().toISOString()).run();
  return location;
};

const municipalityOfficeQueries = (subdivisionName: string, municipalityName: string): string[] => {
  const officeName = /[町村]$/u.test(municipalityName) ? "役場" : "役所";
  return [
    `${subdivisionName}${municipalityName}${officeName}本庁舎`,
    `${subdivisionName}${municipalityName}${officeName}`,
  ];
};

const locateGovernmentOffice = async (queries: string[]): Promise<{ latitude: number; longitude: number } | null> => {
  for (const query of queries) {
    const upstream = new URL("https://msearch.gsi.go.jp/address-search/AddressSearch");
    upstream.searchParams.set("q", query);
    let response: Response;
    try {
      response = await fetch(upstream, { headers: { Accept: "application/json" } });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const declaredLength = Number(response.headers.get("Content-Length") ?? 0);
    if (declaredLength > 64 * 1024) continue;
    const payload: unknown = await response.json().catch(() => null);
    const coordinates = readCoordinates(payload);
    if (coordinates) return coordinates;
  }
  return null;
};

const readCoordinates = (payload: unknown): { latitude: number; longitude: number } | null => {
  if (!Array.isArray(payload)) return null;
  for (const feature of payload) {
    if (typeof feature !== "object" || feature === null) continue;
    const geometry = (feature as { geometry?: unknown }).geometry;
    if (typeof geometry !== "object" || geometry === null) continue;
    const coordinates = (geometry as { coordinates?: unknown }).coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= 20 && latitude <= 48 && longitude >= 122 && longitude <= 154) {
      return { latitude, longitude };
    }
  }
  return null;
};

export const getSubdivision = (code: string): RegionOption | null => subdivisionsByCode.get(code) ?? null;

export const getMunicipality = (code: string): (RegionOption & { subdivisionCode: string }) | null =>
  municipalitiesByCode.get(code) ?? null;

export const hasValidMunicipalityCheckDigit = (code: string): boolean => {
  if (!/^\d{6}$/u.test(code)) return false;
  const digits = [...code].map(Number);
  const weighted = digits.slice(0, 5).reduce((sum, digit, index) => sum + digit * (6 - index), 0);
  return digits[5] === (11 - (weighted % 11)) % 10;
};
