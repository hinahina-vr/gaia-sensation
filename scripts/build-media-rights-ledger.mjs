import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { mediaDataSources, renderDataSources } from "./media-data-sources.mjs";
import { validateOrigins, originalDate } from "./media-origin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "docs", "media-rights-ledger.json");
const markdownPath = path.join(root, "docs", "MEDIA_RIGHTS_LEDGER.md");
const checkOnly = process.argv.includes("--check");
// Only the history-free release copy receives this immutable origin snapshot.
const originPath = path.join(root, "docs/media-origin-snapshot.json");
const origins = fs.existsSync(originPath) ? validateOrigins(JSON.parse(fs.readFileSync(originPath, "utf8"))) : null;
const nasaCloudFile = "assets/maps/nasa-blue-marble-clouds-2048.jpg";
const nasaCloudCredit = "NASA Goddard Space Flight Center / Reto Stöckli";
const mediaPattern = /\.(?:avif|gif|jpe?g|m4a|mp3|ogg|png|wav|webp)$/iu;

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

const normalize = (file) => path.relative(root, file).split(path.sep).join("/");
const media = walk(path.join(root, "assets")).filter((file) => mediaPattern.test(file)).sort();
const evidenceDates = new Map();
let activeDate = null;
const history = execFileSync("git", ["log", "--reverse", "--diff-filter=A", "--format=@@%aI", "--name-only", "--", "assets"], { cwd: root, encoding: "utf8" });
for (const line of history.split(/\r?\n/u)) {
  if (line.startsWith("@@")) activeDate = line.slice(2);
  else if (activeDate && mediaPattern.test(line) && !evidenceDates.has(line)) evidenceDates.set(line, activeDate);
}

const ledgerFor = (relative) => {
  if (relative === 'assets/guide-previews/story.jpg') return 'docs/QA_OPENING_ROUTE_PREVIEWS_20260914.md';
  if (relative === 'assets/concept/myth-machine-circulation-v4.png') return 'docs/QA_CONCEPT_DIAGRAM_V4_20260913.md';
  if (relative === 'assets/visuals-07/sound-archive-bg-v3.png') return 'docs/QA_SOUND_BACKGROUND_ADOPTION_20260913.md';
  if (relative === 'assets/architecture/gaia-field-sensor-whiteboard-20260912.png') return 'docs/QA_WHITEBOARD_ADOPTION_2026-09-12.md';
  if (/^assets\/opening-(?:candidates-20260911|selected-20260912)\//u.test(relative)) return `${path.posix.dirname(relative)}/README.md`;
  if (/^assets\/(?:title|ending)-candidates-20260909\//u.test(relative)) return `${path.posix.dirname(relative)}/README.md`;
  if (relative === "assets/concept/myth-machine-circulation-v3.png") return "docs/CONCEPT_ORIGINAL_V5_IMAGEGEN_2026-09-08.md";
  if (relative === "assets/concept/myth-agency-loop-v2.png") return "docs/CONCEPT_ZEN_BACKGROUND_2026-09-08.md";
  if (/^assets\/concept\/myth-(?:agency-loop|possible-worlds)-v1\.png$/u.test(relative)) return "docs/CONCEPT_AGENCY_IMAGEGEN_2026-09-08.md";
  if (relative === "assets/modes/analysis-mizu-ame-companions-v1.webp") return "docs/STATISTICS_GAME_UI_2026-09-08.md";
  if (/^assets\/modes\/guide-map-(?:live|time|discovery)-mizu-ame-v1\.webp$/u.test(relative)) return "docs/MAP_GUIDE_IMAGEGEN_2026-09-08.md";
  if (/^assets\/modes\/guide-map-(?:live|time|discovery)-mizu-ame-v2\.webp$/u.test(relative)) return "docs/MAP_GUIDE_IMAGEGEN_2026-09-10.md";
  if (/^assets\/modes\/guide-sensor-(?:live|connect|analysis)-mizu-ame-v1\.webp$/u.test(relative)) return "docs/SENSOR_GUIDE_IMAGEGEN_2026-09-09.md";
  if (/^assets\/concept\/brochure-ornament-/u.test(relative)) return "docs/CONCEPT_IMAGEGEN_DECOR_2026-09-07.md";
  if (/^assets\/concept\/(?:myth-machine-|brochure-)/u.test(relative)) return "docs/CONCEPT_PAGE_2026-09-07.md";
  if (relative === "assets/characters/aoneko-silhouette-imagegen-v3.png") return "docs/AONEKO_IMAGEGEN_2026-09-07.md";
  if (relative === "assets/characters/aoneko-silhouette-imagegen-v4.png") return "docs/AONEKO_POSTURE_2026-09-07.md";
  if (relative === nasaCloudFile) return "assets/maps/NASA-CLOUDS-RIGHTS.md";
  if (relative === "assets/audio/gaia-map-ambient-harp-felt-piano.wav") return "scripts/build-map-ambient-score.mjs";
  if (/^assets\/audio\//u.test(relative)) return "README.md#credits";
  if (/^assets\/characters\//u.test(relative)) return "assets/characters/AMANE-STYLE-V3-RIGHTS.md";
  if (/^assets\/visuals-07\//u.test(relative)) return "assets/visuals-07/README.md";
  return "assets/ILLUSTRATION-V8.md";
};

const serviceFor = (relative) => {
  if (relative === 'assets/guide-previews/story.jpg') return 'GAIA SENSEWARE application screenshot supplied by owner';
  if (relative === 'assets/architecture/gaia-field-sensor-whiteboard-20260912.png') return 'OpenAI Imagegen';
  if (/^assets\/opening-(?:candidates-20260911|selected-20260912)\//u.test(relative)) return "OpenAI Imagegen";
  if (/^assets\/(?:title|ending)-candidates-20260909\//u.test(relative)) return "OpenAI Imagegen";
  if (/^assets\/concept\/brochure-map-/u.test(relative)) return "GAIA SENSEWARE local application screenshot";
  if (/^assets\/concept\/(?:myth-machine-|myth-agency-|myth-possible-|brochure-|concept-)/u.test(relative)) return "OpenAI Imagegen";
  if (relative === nasaCloudFile) return nasaCloudCredit;
  if (relative === "assets/audio/gaia-map-ambient-harp-felt-piano.wav") return "In-repository procedural synthesis (Node.js)";
  if (/\.(?:m4a|mp3|ogg|wav)$/iu.test(relative)) return "Suno AI";
  if (/^assets\/(?:characters|visuals-07|visuals-08|true-end|modes)\//u.test(relative)) return "OpenAI Imagegen";
  return "未特定（元台帳参照）";
};

const termsFor = (service) => {
  if (service === nasaCloudCredit) return "https://www.nasa.gov/nasa-brand-center/images-and-media/";
  if (service === "OpenAI Imagegen") return "https://openai.com/policies/service-terms/";
  if (service === "Suno AI") return "https://suno.com/terms";
  return null;
};

const processingFor = (relative) => /^assets\/opening-selected-20260912\//u.test(relative)
  ? "2026-09-12作者添付の3枚を初対面・みず・あめのオープニングにローカル採用。初対面は初回生成版、みず・あめは毛先編集後の案1。元PNG無変更。全画角WebPは初対面品質84、人物品質92、通常1672×941／軽量834×469。再描画なし。selection.jsonに原本・派生のSHA-256、READMEに制作履歴、docs/QA_SELECTED_OPENING_2026-09-12.mdに検証範囲。未公開"
  : /^assets\/opening-candidates-20260911\//u.test(relative)
  ? "既存立ち絵と対応場面を参照しOpenAI内蔵画像生成で各3案、計9案を制作。毛先の追加編集後PNGを無変更で保存。候補制作記録は同フォルダのREADME.md、prompts.json、verification.json。2026-09-12採用の初対面は今回添付の初回版でこのフォルダの編集後版とは異なる。未公開"
  : /^assets\/(?:title-candidates-20260909\/01-starlit-observatory|ending-candidates-20260909\/01-turning-in-the-sunset)\.(?:png|webp)$/u.test(relative)
  ? "2026-09-10作者指定で候補01をメインタイトル／本編エンディングに採用。組み込みImagegenによる元PNGは無変更で保存。表示用WebPは品質92・同寸法1672×941の形式変換のみで、構図や人物の描き換えなし。変換手順はscripts/encode-selected-title-ending.mjs、採用・検証記録はdocs/QA_SELECTED_TITLE_ENDING_2026-09-10.md。公開状態はdocs/RELEASE_STORY_TEMPERATURE_2026-09-10.mdと公開証跡を参照"
  : /^assets\/(?:title|ending)-candidates-20260909\//u.test(relative)
  ? "みず・あめの既存キャラクター画像を参照し、組み込みImagegenで独立した5案を生成。生成元PNGを無加工で保存しSHA-256一致を確認。プロンプトと参照画像は同じフォルダのprompts.json、目視・保存試験はREADME.mdを参照。本編への採用ではなく候補比較ページとして公開"
  : /^assets\/concept\/brochure-map-/u.test(relative)
  ? "ローカルChromeの実装画面を撮影。収録データを使用し外部ライブAPIは遮断。UIや数値の描き換えなし、全画面を1200px幅へ縮小しWebP変換。撮影手順と元画像はコンセプトページ記録を参照"
  : relative === "assets/concept/myth-machine-circulation-v3.png"
  ? "作者の原図v5を意味・構成の参照とし、内蔵ImageGenで7要素と因果／情報の2系統を再描画。Deep Agentは深層AI群と表記。原図のコラージュ人物・製品ロゴは再使用せず、生成された1672×941 PNGを無加工で保存。旧版は保持"
  : relative === "assets/concept/myth-agency-loop-v2.png"
  ? "組み込みImageGenでv1の末尾ラベルを『選ぶのはあなた』に修正。構図・人物・矢印を維持する編集指示。生成結果を目視確認し、1086×1448 PNGを無加工で採用。元画像は保存"
  : relative === "assets/audio/gaia-map-ambient-harp-felt-piano.wav"
  ? "純粋なNode.jsによる決定的ステレオPCM合成。ハープ、フェルトピアノ、弦、低域ドローン、濾波ノイズ、拡散リバーブを生成"
  : relative === nasaCloudFile ? "NASA公開JPEGを無加工で保存。描画時に輝度を雲形の透過マスクとして使用。濃淡・微小な移動は演出。現在の衛星画像ではなく参考画像として明記"
  : "採用ファイル。個別の加工履歴は元台帳を参照";

const assets = media.map((file) => {
  const relative = normalize(file);
  const service = serviceFor(relative);
  const sha256 = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  return {
    path: relative,
    sha256,
    generationService: service,
    // This newly exported screenshot first appeared in development commit f6bed3c.
    firstRepositoryEvidenceAt: relative === 'assets/guide-previews/story.jpg' ? '2026-09-14T03:37:54+09:00' : originalDate(relative, sha256, evidenceDates.get(relative), origins),
    processing: relative === 'assets/guide-previews/story.jpg' ? 'Owner-supplied application screenshot resized to 960x540 JPEG, without cropping or redrawing; source development commit f6bed3c. See sourceLedger for adoption evidence.' : processingFor(relative),
    sourceLedger: ledgerFor(relative),
    officialTermsUrl: termsFor(service),
    publicationStatus: /^assets\/opening-(?:candidates-20260911|selected-20260912)\//u.test(relative) ? "local-only" : "public",
  };
});

const providers = [
  { provider: "NOAA NDBC", datasetId: "latest observations", sourceUrl: "https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt", termsUrl: "https://www.noaa.gov/information-technology/open-data-dissemination", retrievalPolicy: "live: 5 minutes; versioned snapshot fallback" },
  { provider: "NOAA GML", datasetId: "Mauna Loa hourly CO2", sourceUrl: "https://erddap.gml.noaa.gov/erddap/tabledap/greenhouse_gases_co2_insitu_hourly_averages_surface.html", termsUrl: "https://gml.noaa.gov/ccgg/about/co2_measurements.html", retrievalPolicy: "latest published: 1 hour; versioned snapshot fallback" },
  { provider: "JAXA Earth API", datasetId: "JAXA.EORC_GSMaP_standard.Gauge.00Z-23Z.v6_daily", sourceUrl: "https://data.earth.jaxa.jp/en/", termsUrl: "https://data.earth.jaxa.jp/en/terms-of-use/", retrievalPolicy: "live: 6 hours; fixed Hawaii bbox mean; versioned snapshot fallback" },
  { provider: "ESA / Copernicus Data Space", datasetId: "Sentinel-5P L2 NO2 NRTI", sourceUrl: "https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S5PL2.html", termsUrl: "https://dataspace.copernicus.eu/terms-and-conditions", retrievalPolicy: "live: 30 minutes; 72-hour quality-masked bbox mean; versioned snapshot fallback" },
];

const sources = mediaDataSources(root, providers);
const sourceIndexNote = "2026-09-13に現行カタログ・同梱メタデータと照合。収録期間は提供元の最新版の保証ではありません。今回、観測データの再取得や利用許諾の再判定は行っていません。";
for (const source of sources) {
  if (!source.id || !source.provider || !source.datasetId || !source.sourceUrl || !source.retrievalPolicy) throw new Error(`Incomplete data source: ${JSON.stringify(source)}`);
  if (!fs.existsSync(path.join(root, source.evidence))) throw new Error(`Missing data source evidence: ${source.evidence}`);
}
if (new Set(sources.map(source => source.id)).size !== sources.length) throw new Error("Duplicate data source ID");
const payload = { schemaVersion: 1, generatedBy: "scripts/build-media-rights-ledger.mjs", sourceIndexNote, assets, sources };
const json = `${JSON.stringify(payload, null, 2)}\n`;
const markdown = `# 公開素材・データ権利台帳\n\nこの文書は \`scripts/build-media-rights-ledger.mjs\` により機械可読JSONから生成されます。制作元・出典・加工内容を記録します。生成イラスト: OpenAI Imagegen。生成音楽: Suno AI。\n\n- 登録メディア（公開・ローカル候補を含む）: ${assets.length}件\n- 各ファイル: SHA-256、制作サービス、最初のリポジトリ証拠日、加工説明、元台帳、利用条件URLをJSONへ収録\n\n## データ出典\n\n${sourceIndexNote}\n\n登録: ${sources.length}件（展示別の同一提供元、独自加工、補助経路も区別して収録）。日本の年次系列と食料の追加系列は実装カタログ・同梱JSONから生成します。各行の「記録」から取得日・加工内容・原データURLを確認できます。\n\n利用条件と再利用上の注意は [データ出典・利用条件](DATA_SOURCES.md) を参照してください。本一覧は提供元の個別許諾や全データの無条件な再利用を保証するものではありません。\n\n${renderDataSources(sources)}\n\n## 検査\n\n\`npm run check:rights\` はメディアのSHA-256、出典の必須項目・ID重複・ローカル根拠の存在、生成結果の差分を検査します。外部サイトの全リンク到達性や利用条件の再監査ではありません。利用条件の確認とは別の、ファイルと記載の整合検査です。\n`;

if (assets.length !== media.length) throw new Error("Every public media file must have one ledger entry");
for (const asset of assets) {
  if (!asset.path || !asset.sha256 || !asset.generationService || !asset.processing || !asset.sourceLedger || !asset.publicationStatus) throw new Error(`Incomplete ledger entry: ${asset.path}`);
  if (!fs.existsSync(path.join(root, asset.path))) throw new Error(`Missing public media: ${asset.path}`);
}

if (checkOnly) {
  if (!fs.existsSync(jsonPath) || fs.readFileSync(jsonPath, "utf8").replace(/\r\n/g, "\n") !== json) throw new Error("docs/media-rights-ledger.json is stale; run npm run rights:build");
  if (!fs.existsSync(markdownPath) || fs.readFileSync(markdownPath, "utf8").replace(/\r\n/g, "\n") !== markdown) throw new Error("docs/MEDIA_RIGHTS_LEDGER.md is stale; run npm run rights:build");
  console.log(JSON.stringify({ status: "passed", assets: assets.length, sources: sources.length }));
} else {
  fs.writeFileSync(jsonPath, json);
  fs.writeFileSync(markdownPath, markdown);
  console.log(JSON.stringify({ status: "generated", assets: assets.length, sources: sources.length }));
}
