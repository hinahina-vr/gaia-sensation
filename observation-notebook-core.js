(() => {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "gaiaSenseware:observationNotebook:v1";
  const MAX_RECORDS = 24;
  const MAX_SHARED_RECORDS = 2;
  const MAX_FRAGMENT_LENGTH = 6000;
  const memoryRecords = [];
  let persistentStorageAvailable = true;

  const text = (value, maximum) => String(value ?? "").trim().slice(0, maximum);
  const validDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  };
  const identifier = () => globalThis.crypto?.randomUUID?.()
    || `gaia-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  const normalizeMetric = (metric) => {
    const key = text(metric?.key, 48).replace(/[^a-zA-Z0-9_.:-]/gu, "-");
    const value = Number(metric?.value);
    if (!key || !Number.isFinite(value)) return null;
    return Object.freeze({
      key,
      label: text(metric?.label || key, 64),
      value,
      unit: text(metric?.unit, 24),
    });
  };

  const normalizeRecord = (record, { shared = false } = {}) => {
    const source = record?.source === "sensor" ? "sensor" : record?.source === "map" ? "map" : "";
    if (!source) throw new TypeError("観測種別が不正です。");
    const metrics = Array.from(record?.metrics || []).slice(0, 12).map(normalizeMetric).filter(Boolean);
    if (!metrics.length) throw new TypeError("比較できる数値がありません。");
    const datasetIds = Array.from(record?.provenance?.datasetIds || [])
      .map((value) => text(value, 80))
      .filter(Boolean)
      .slice(0, 12);
    const context = shared ? [] : Array.from(record?.context || []).slice(0, 8).map((entry) => ({
      label: text(entry?.label, 40),
      value: text(entry?.value, 120),
    })).filter((entry) => entry.label && entry.value);
    return Object.freeze({
      version: VERSION,
      id: shared ? identifier() : text(record?.id, 80) || identifier(),
      source,
      capturedAt: validDate(record?.capturedAt),
      title: text(record?.title, 80) || (source === "map" ? "地図の観測" : "センサーの観測"),
      subtitle: text(record?.subtitle, 160),
      compareKey: text(record?.compareKey, 80) || `${source}:${metrics.map((metric) => metric.key).sort().join(",")}`,
      metrics,
      context,
      provenance: Object.freeze({
        classification: text(record?.provenance?.classification, 48),
        datasetIds,
      }),
    });
  };

  const read = () => {
    if (!persistentStorageAvailable) return memoryRecords.slice();
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, MAX_RECORDS).map((record) => normalizeRecord(record)).filter(Boolean);
    } catch {
      persistentStorageAvailable = false;
      return memoryRecords.slice();
    }
  };

  const write = (records) => {
    const normalized = records.slice(0, MAX_RECORDS).map((record) => normalizeRecord(record));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      persistentStorageAvailable = true;
      memoryRecords.splice(0, memoryRecords.length, ...normalized);
      return { records: normalized, persistent: true };
    } catch {
      persistentStorageAvailable = false;
      memoryRecords.splice(0, memoryRecords.length, ...normalized);
      return { records: normalized, persistent: false };
    }
  };

  const save = (record) => {
    const normalized = normalizeRecord(record);
    const records = read().filter((entry) => entry.id !== normalized.id);
    records.unshift(normalized);
    const result = write(records);
    return { record: normalized, ...result };
  };

  const remove = (id) => write(read().filter((record) => record.id !== id));
  const clear = () => write([]);

  const commonMetricKeys = (first, second) => {
    const secondMetrics = new Map(second.metrics.map((metric) => [`${metric.key}\u0000${metric.unit}`, metric]));
    return first.metrics.filter((metric) => secondMetrics.has(`${metric.key}\u0000${metric.unit}`));
  };

  const isComparable = (firstRecord, secondRecord) => {
    try {
      const first = normalizeRecord(firstRecord);
      const second = normalizeRecord(secondRecord);
      if (first.source !== second.source) return false;
      if (first.source === "map") return first.compareKey === second.compareKey && commonMetricKeys(first, second).length > 0;
      return commonMetricKeys(first, second).length > 0;
    } catch {
      return false;
    }
  };

  const compare = (firstRecord, secondRecord) => {
    const first = normalizeRecord(firstRecord);
    const second = normalizeRecord(secondRecord);
    if (!isComparable(first, second)) throw new TypeError("この2件は単位や観測条件が異なるため比較できません。");
    const secondMetrics = new Map(second.metrics.map((metric) => [`${metric.key}\u0000${metric.unit}`, metric]));
    return commonMetricKeys(first, second).map((metric) => {
      const peer = secondMetrics.get(`${metric.key}\u0000${metric.unit}`);
      return Object.freeze({
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        first: metric.value,
        second: peer.value,
        delta: peer.value - metric.value,
      });
    });
  };

  const shareRecord = (record) => {
    const normalized = normalizeRecord(record, { shared: true });
    return {
      version: VERSION,
      type: normalized.compareKey,
      capturedAt: normalized.capturedAt,
      displayName: normalized.title,
      values: normalized.metrics.map((metric) => ({
        type: metric.key,
        displayName: metric.label,
        value: metric.value,
        unit: metric.unit,
      })),
      sourceIds: normalized.provenance.datasetIds,
    };
  };

  const toBase64Url = (value) => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
  };

  const fromBase64Url = (value) => {
    if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new TypeError("共有URLの形式が不正です。");
    const padded = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  };

  const encodeShare = (records) => {
    const selected = Array.from(records || []);
    if (!selected.length) throw new TypeError("共有する観測を選んでください。");
    if (selected.length > MAX_SHARED_RECORDS) throw new RangeError("共有できる観測は2件までです。");
    const payload = toBase64Url(JSON.stringify({ version: VERSION, records: selected.map(shareRecord) }));
    if (payload.length > MAX_FRAGMENT_LENGTH) throw new RangeError("共有データがURLの上限を超えました。");
    return payload;
  };

  const decodeShare = (payload) => {
    if (!payload || payload.length > MAX_FRAGMENT_LENGTH) throw new RangeError("共有URLが空、または長すぎます。");
    const decoded = JSON.parse(fromBase64Url(payload));
    if (decoded?.version !== VERSION || !Array.isArray(decoded.records)) throw new TypeError("未対応の共有データです。");
    if (decoded.records.length < 1 || decoded.records.length > MAX_SHARED_RECORDS) throw new RangeError("共有できる観測は2件までです。");
    return decoded.records.map((record) => {
      if (record?.version !== VERSION) throw new TypeError("未対応の共有データです。");
      const compareKey = text(record?.type, 80);
      const source = compareKey.startsWith("map:") ? "map" : compareKey.startsWith("sensor:") ? "sensor" : "";
      if (!source) throw new TypeError("観測種別が不正です。");
      return normalizeRecord({
        source,
        capturedAt: record.capturedAt,
        title: record.displayName,
        compareKey,
        metrics: Array.from(record?.values || []).map((metric) => ({
          key: metric?.type,
          label: metric?.displayName,
          value: metric?.value,
          unit: metric?.unit,
        })),
        provenance: { datasetIds: record?.sourceIds },
      }, { shared: true });
    });
  };

  const publicApi = Object.freeze({
    VERSION,
    STORAGE_KEY,
    MAX_RECORDS,
    MAX_SHARED_RECORDS,
    MAX_FRAGMENT_LENGTH,
    normalizeRecord,
    list: read,
    save,
    remove,
    clear,
    isComparable,
    compare,
    encodeShare,
    decodeShare,
    shareRecord,
  });

  globalThis.GaiaObservationCore = publicApi;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("gaia:observation-core-ready"));
})();
