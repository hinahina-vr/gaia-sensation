import { ApiError, isRecord, optionalString, requireExactKeys, requireString } from "./http";
import { getMeasurementDefinition } from "./measurements";
import { getMunicipality, getSubdivision, hasValidMunicipalityCheckDigit } from "./regions";

export type PairRequest = { pairingCode: string };
export type DeviceDraft = {
  name: string;
  countryCode: string;
  subdivisionCode: string | null;
  municipalityCode: string | null;
  admin1Code: string | null;
  localityName: string | null;
  isPublic: boolean;
  publicLatitude: number | null;
  publicLongitude: number | null;
  measurementKeys: string[] | null;
};
export type ProfileDraft = { displayName: string; xUrl: string | null; githubUrl: string | null; instagramUrl: string | null };
export type TelemetryInput = {
  seq: number;
  observedAt: string | null;
  data: Record<string, number>;
};

export const validatePairRequest = (value: unknown): PairRequest => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Request body must be an object.");
  requireExactKeys(value, ["pairingCode"]);
  const pairingCode = requireString(value.pairingCode, "pairingCode", 9, 9).toUpperCase();
  if (!/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/u.test(pairingCode)) {
    throw new ApiError(400, "INVALID_PAIRING_CODE", "Pairing code format is invalid.");
  }
  return { pairingCode };
};

export const validateDeviceDraft = (value: unknown): DeviceDraft => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Request body must be an object.");
  requireExactKeys(value, ["name", "countryCode", "subdivisionCode", "municipalityCode", "admin1Code", "localityName", "isPublic", "publicLatitude", "publicLongitude", "measurementKeys"]);
  const name = requireString(value.name, "name", 1, 80);
  const countryCode = requireString(value.countryCode, "countryCode", 2, 2).normalize("NFKC").toUpperCase();
  if (!/^[A-Z]{2}$/u.test(countryCode)) throw new ApiError(400, "INVALID_COUNTRY", "countryCode must be ISO 3166-1 alpha-2.");
  let subdivisionCode = optionalString(value.subdivisionCode, "subdivisionCode", 6)?.normalize("NFKC").toUpperCase() ?? null;
  const municipalityCode = optionalString(value.municipalityCode, "municipalityCode", 6)?.normalize("NFKC") ?? null;
  const legacyAdmin1Code = optionalString(value.admin1Code, "admin1Code", 32);
  const legacyLocalityName = optionalString(value.localityName, "localityName", 80);
  if (subdivisionCode) {
    if (!/^[A-Z]{2}-[A-Z0-9]{1,3}$/u.test(subdivisionCode) || !getSubdivision(subdivisionCode)) {
      throw new ApiError(400, "INVALID_SUBDIVISION", "subdivisionCode must be a current complete ISO 3166-2 code.");
    }
    if (!subdivisionCode.startsWith(`${countryCode}-`)) {
      throw new ApiError(400, "REGION_FIELD_CONFLICT", "subdivisionCode does not belong to countryCode.");
    }
  }
  const municipality = municipalityCode ? getMunicipality(municipalityCode) : null;
  if (municipalityCode) {
    if (countryCode !== "JP") {
      throw new ApiError(400, "INVALID_MUNICIPALITY", "municipalityCode is available only when countryCode is JP.");
    }
    if (!hasValidMunicipalityCheckDigit(municipalityCode) || !municipality) {
      throw new ApiError(400, "INVALID_MUNICIPALITY", "municipalityCode must be a current six-digit Japanese local public body code with a valid check digit.");
    }
    if (subdivisionCode && municipality.subdivisionCode !== subdivisionCode) {
      throw new ApiError(400, "REGION_FIELD_CONFLICT", "municipalityCode does not belong to subdivisionCode.");
    }
    subdivisionCode ??= municipality.subdivisionCode;
  }
  if (subdivisionCode && legacyAdmin1Code && legacyAdmin1Code.normalize("NFKC").toUpperCase() !== subdivisionCode) {
    throw new ApiError(400, "REGION_FIELD_CONFLICT", "admin1Code conflicts with subdivisionCode.");
  }
  if (municipality && legacyLocalityName && legacyLocalityName !== municipality.name) {
    throw new ApiError(400, "REGION_FIELD_CONFLICT", "localityName conflicts with municipalityCode.");
  }
  if (value.isPublic !== true) {
    throw new ApiError(400, "PUBLIC_SENSOR_REQUIRED", "GAIA SENSEWARE sensors must be published with an approximate location.");
  }
  const isPublic = true;
  const publicLatitude = coordinate(value.publicLatitude, "publicLatitude", -90, 90);
  const publicLongitude = coordinate(value.publicLongitude, "publicLongitude", -180, 180);
  if (publicLatitude === null || publicLongitude === null) {
    throw new ApiError(400, "PUBLIC_LOCATION_REQUIRED", "Select an approximate public map location.");
  }
  return {
    name,
    countryCode,
    subdivisionCode,
    municipalityCode,
    admin1Code: subdivisionCode ?? legacyAdmin1Code,
    localityName: municipality?.name ?? legacyLocalityName,
    isPublic,
    publicLatitude,
    publicLongitude,
    measurementKeys: validateMeasurementKeys(value.measurementKeys),
  };
};

const validateMeasurementKeys = (value: unknown): string[] | null => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) {
    throw new ApiError(400, "INVALID_MEASUREMENT_KEYS", "measurementKeys must contain between 1 and 16 catalog keys.");
  }
  const keys: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string" || !getMeasurementDefinition(candidate)) {
      throw new ApiError(400, "INVALID_MEASUREMENT_KEY", `Unsupported measurement key: ${String(candidate)}.`);
    }
    if (!keys.includes(candidate)) keys.push(candidate);
  }
  return keys;
};

export const validateProfileDraft = (value: unknown): ProfileDraft => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Request body must be an object.");
  requireExactKeys(value, ["displayName", "xUrl", "githubUrl", "instagramUrl"]);
  return {
    displayName: requireString(value.displayName, "displayName", 1, 60),
    xUrl: socialUrl(value.xUrl, "xUrl", ["x.com"]),
    githubUrl: socialUrl(value.githubUrl, "githubUrl", ["github.com"]),
    instagramUrl: socialUrl(value.instagramUrl, "instagramUrl", ["instagram.com"]),
  };
};

const coordinate = (value: unknown, field: string, minimum: number, maximum: number): number | null => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ApiError(400, "INVALID_PUBLIC_LOCATION", `${field} is outside the accepted range.`);
  }
  return Math.round(value * 100_000) / 100_000;
};

const socialUrl = (value: unknown, field: string, hosts: readonly string[]): string | null => {
  const raw = optionalString(value, field, 240);
  if (!raw) return null;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new ApiError(400, "INVALID_SOCIAL_URL", `${field} must be a valid HTTPS profile URL.`); }
  const host = parsed.hostname.toLowerCase().replace(/^www\./u, "");
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (parsed.protocol !== "https:" || !hosts.includes(host) || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash || segments.length !== 1 || !/^[A-Za-z0-9_.-]{1,80}$/u.test(segments[0] ?? "")) {
    throw new ApiError(400, "INVALID_SOCIAL_URL", `${field} must be an HTTPS account profile URL.`);
  }
  return `https://${host}/${segments[0]}`;
};

export const validateTelemetry = (value: unknown): TelemetryInput => {
  if (!isRecord(value)) throw new ApiError(400, "INVALID_BODY", "Request body must be an object.");
  requireExactKeys(value, ["seq", "observedAt", "data"]);
  if (!Number.isSafeInteger(value.seq) || (value.seq as number) < 0) {
    throw new ApiError(400, "INVALID_SEQUENCE", "seq must be a non-negative safe integer.");
  }
  let observedAt: string | null = null;
  if (value.observedAt !== undefined && value.observedAt !== null) {
    observedAt = requireString(value.observedAt, "observedAt", 20, 35);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(observedAt)) {
      throw new ApiError(400, "INVALID_TIMESTAMP", "observedAt must be an RFC 3339 UTC timestamp.");
    }
    const timestamp = Date.parse(observedAt);
    if (!Number.isFinite(timestamp)) {
      throw new ApiError(400, "INVALID_TIMESTAMP", "observedAt must be an RFC 3339 UTC timestamp.");
    }
    const skew = Math.abs(Date.now() - timestamp);
    if (skew > 31 * 24 * 60 * 60 * 1000) {
      throw new ApiError(400, "INVALID_TIMESTAMP", "observedAt must be within 31 days of receipt.");
    }
  }
  if (!isRecord(value.data)) throw new ApiError(400, "INVALID_SENSOR_DATA", "data must be an object.");
  const entries = Object.entries(value.data);
  if (entries.length < 1 || entries.length > 16) {
    throw new ApiError(400, "INVALID_SENSOR_DATA", "data must contain between 1 and 16 measurements.");
  }
  const data: Record<string, number> = {};
  for (const [key, measurement] of entries) {
    if (!/^[a-z][a-z0-9_]{0,31}$/u.test(key)) throw new ApiError(400, "INVALID_SENSOR_KEY", `Invalid sensor key: ${key}.`);
    if (typeof measurement !== "number" || !Number.isFinite(measurement)) {
      throw new ApiError(400, "INVALID_SENSOR_VALUE", `${key} must be a finite number.`);
    }
    const definition = getMeasurementDefinition(key);
    if (!definition) {
      throw new ApiError(400, "UNSUPPORTED_SENSOR_KEY", `${key} is not registered in the GAIA measurement catalog.`);
    }
    if (measurement < definition.minimum || measurement > definition.maximum) {
      throw new ApiError(400, "SENSOR_VALUE_OUT_OF_RANGE", `${key} is outside the accepted catalog range.`);
    }
    data[key] = measurement;
  }
  return { seq: value.seq as number, observedAt: observedAt === null ? null : new Date(observedAt).toISOString(), data };
};
