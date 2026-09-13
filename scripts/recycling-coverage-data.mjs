import assert from "node:assert/strict";
import { coverage } from "./country-coverage-data.mjs";
import { RECYCLING_COMPARABILITY } from "../src/data/recycling-provenance.js";
export { RECYCLING_COMPARABILITY };

export const WORLD_BANK_RECYCLING_ID = "worldbank-waw3-recycling";

// These are translations of the retained source codebook notes, not changes to
// the reported values. In particular, a partial numerator is not grossed up.
const SOURCE_SCOPE_JA = Object.freeze({
  AFG: "再使用を含む。資料側の専門家推計。",
  ARM: "プラスチックのみ。紙・金属・ガラスの量は未収録で、実際の再資源化率を過小評価する可能性。",
  CHI: "ジャージーとガーンジーを合算。再使用を含む。",
  CYM: "処理先の量を合算して割合を算出した資料値。",
  EGY: "元資料の分母は回収されたごみ。発生量全体とは異なる。",
  ETH: "資料側の概算値を含む。",
  FRO: "2施設に入る廃棄物全体。都市ごみ以外も含む。",
  IDN: "未報告自治体を資料側で推計。非公式・公式部門を合算。",
  IRN: "複数年の文献を使った資料側の推計。",
  JOR: "資料側の推計値。",
  KIR: "PETボトルとアルミ缶の回収量に基づく。",
  MAR: "都市部のみ。農村部の処理を反映しない。",
  MNG: "他産業の中間投入を再資源化とみなす資料側の算定。",
  MOZ: "回収ごみに対する非公式部門の再使用・再資源化の割合。",
  MYS: "資料に収録された回収量から算出。国連の範囲外値とは別資料。",
  NZL: "クラス1処分施設から転用された量。2023/2024年の資料。",
  PER: "有機系の回収量に基づく。資料の対象範囲が異なる。",
  PLW: "現地での再資源化分を除外した資料値。",
  PRI: "堆肥化と仮定された4ポイント分を含む資料値。",
  SUR: "資料側の推計を含む。",
  SWZ: "資料側の推計値。",
  SXM: "非公式な回収・転用が対象。元資料では回収量の10%未満。",
  SYC: "家庭ごみのみ。",
  SYR: "資料側の推計・正規化を含む。回収ごみの処理割合が基礎。",
  TKM: "資料側の推計値。",
  TON: "輸出と国内の再資源化・再使用を含む。",
  TUV: "輸出と国内の再資源化・再使用を含む。2011年のごみ調査が基礎。",
  TZA: "資料にある5〜10%の平均値。",
  UZB: "元資料の分母は処分量。発生量全体とは異なる。",
  VNM: "未回収分を考慮して資料側で換算。",
  VUT: "国内処理ではなく再資源化向けの輸出量。資料側の推計を含む。",
});

export function buildWorldBankRecycling(source, catalog) {
  assert.equal(source.schemaVersion, 1);
  assert.equal(source.datasetId, WORLD_BANK_RECYCLING_ID);
  assert.equal(source.measurement, "waste_treatment_recycling_percent");
  const sites = new Map(catalog.map(row => [row.iso3, row]));
  const seen = new Set(), rows = [], excluded = [];
  for (const raw of source.rows) {
    assert(!seen.has(raw.iso3), `Duplicate World Bank country ${raw.iso3}`);
    seen.add(raw.iso3);
    assert(raw.rawFraction !== null && typeof raw.rawFraction === "number" && Number.isFinite(raw.rawFraction));
    assert(raw.rawFraction >= 0 && raw.rawFraction <= 1 && raw.numberFormat.includes("%"), `Invalid percentage ${raw.iso3}`);
    assert.equal(raw.source.iso3, raw.iso3);
    assert.equal(raw.source.measurement, source.measurement);
    assert(Number.isInteger(raw.source.year) && raw.source.year >= 1900 && raw.source.year <= 2026);
    const site = sites.get(raw.iso3);
    if (!site) {
      excluded.push({ iso3: raw.iso3, datasetId: source.datasetId, exclusionCode: "unmatched-country", reason: "No verified country/territory mapping" });
      continue;
    }
    const row = {
      ...site, year: raw.source.year, recyclePercent: raw.rawFraction * 100,
      valueStatus: "SOURCE", datasetId: source.datasetId, sourceLabel: "世界銀行公表値",
      sourceDefinition: "再資源化向けに回収されたごみの割合（資料ごとの対象・分母の差を含む）",
      sourceScope: SOURCE_SCOPE_JA[raw.iso3] || "資料側の対象範囲・算定方法による公表値。",
      source: raw.source.reference, sourceUrl: source.url, url: source.url,
      sourceReferenceUrl: raw.source.referenceUrl, sourceReferencePage: raw.source.referencePage,
      sourceMethod: raw.source.method, sourcePointOfMeasurement: raw.source.pointOfMeasurement,
      sourceNotes: raw.source.notes, sourceMethodNotes: raw.source.methodNotes,
      yearMeaning: "世界銀行コードブックの年。測定年不明の場合は出典の公表年等を含む。",
      footnotes: [raw.source.methodNotes, raw.source.notes].filter(value => typeof value === "string" && value.trim()),
      sourceValueCell: raw.valueCell, sourceCodebookRow: raw.codebookRow, sourceRawFraction: raw.rawFraction,
    };
    if (raw.iso3 === "FJI") {
      assert.match(raw.source.notes || "", /Nadi Town and Lautoka City/);
      excluded.push({ ...row, exclusionCode: "subnational-only", reason: "Nadi Town and Lautoka City only; not a national recycling rate. No extrapolation to Fiji." });
      continue;
    }
    rows.push(row);
  }
  return { rows: rows.sort((a, b) => a.iso3.localeCompare(b.iso3)), excluded };
}

export function applyRecyclingSupplement(mode, source, catalog) {
  assert.equal(mode.id, "nothing-is-waste");
  // Idempotent: keep every UN observation unchanged, and rebuild only the WB supplement.
  const unRows = mode.signals.countryWaste.filter(row => !row.datasetId || row.datasetId === "un-sdg");
  const unCodes = new Set(unRows.map(row => row.iso3));
  assert.equal(unCodes.size, unRows.length);
  const built = buildWorldBankRecycling(source, catalog);
  const added = built.rows.filter(row => !unCodes.has(row.iso3));
  const rows = [...unRows, ...added].sort((a, b) => a.iso3.localeCompare(b.iso3));
  const unExcluded = (mode.signals.countryCoverage?.excludedSourceValues || [])
    .filter(row => !row.datasetId || row.datasetId === "un-sdg");
  mode.signals.countryWaste = rows;
  mode.signals.countryCoverage = {
    ...coverage(rows, catalog), sourceOnly: true,
    sourceCounts: { "un-sdg": unRows.length, [source.datasetId]: added.length },
    selectionPolicy: "Preserve valid UN SDG values. Supplement absent countries from World Bank WaW 3.0 with source-specific year and definition. No interpolation, zero fill or city-to-country extrapolation.",
    comparability: RECYCLING_COMPARABILITY,
    excludedSourceValues: [...unExcluded, ...built.excluded],
    worldBankCandidates: source.rows.length,
    worldBankOverlapPreservedUn: built.rows.filter(row => unCodes.has(row.iso3)).length,
  };
  const dataset = {
    id: source.datasetId, kind: "SOURCE", organisation: "World Bank Group",
    title: "What a Waste 3.0 / 再資源化向け回収率",
    url: source.url, downloadUrl: source.downloadUrl, retrievedAt: source.retrievedAt,
    termsUrl: source.licenseUrl, license: source.license, citation: source.citation,
    sourceSha256: source.sourceSha256,
    period: `${Math.min(...added.map(row => row.year))}–${Math.max(...added.map(row => row.year))}`,
    unit: "% of waste collected for recycling (source definitions vary)",
    resolution: `${added.length} supplemental countries and territories / ${source.rows.length} non-missing source rates`,
    transformation: "世界銀行の国別Excelの百分率セルを100倍して%へ単位変換し、国連に有効値のない国・地域だけを補足。値の丸め・補間・ゼロ埋めはせず、コードブックの年・元資料・注記を保持。フィジーの2都市限定値は全国へ拡張せず除外。",
    caveat: `${RECYCLING_COMPARABILITY} 測定年不明の場合、世界銀行の年は公表年等を示します。都市部・家庭ごみ・一部素材のみ、再使用や堆肥化を含むなどの個別差は各行の注記を確認してください。`,
    preview: added.slice(0, 10),
  };
  mode.datasets = [...mode.datasets.filter(row => row.id !== source.datasetId), dataset];
  return mode;
}

export function recyclingCatalog(snapshot) {
  const fields = ["id", "name", "country", "countryJa", "iso3", "iso2", "mapIso3", "m49", "lat", "lon", "positionSource", "worldBankEconomy"];
  const modes = new Map(snapshot.modes.map(mode => [mode.id, mode]));
  const sites = new Map();
  for (const row of [...modes.get("blue-circulation").signals.climate, ...modes.get("three-ecologies").signals.social]) {
    if (!sites.has(row.iso3)) sites.set(row.iso3, Object.fromEntries(fields.filter(key => key in row).map(key => [key, row[key]])));
  }
  return [...sites.values()].sort((a, b) => a.iso3.localeCompare(b.iso3));
}
