import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "data", "space-signals.json");
const retrievedAt = new Date().toISOString();

const endpoints = {
  flares: "https://api.nasa.gov/DONKI/FLR?startDate=2024-05-01&endDate=2024-05-31&api_key=DEMO_KEY",
  cmes: "https://api.nasa.gov/DONKI/CME?startDate=2024-05-01&endDate=2024-05-31&api_key=DEMO_KEY",
  storms: "https://api.nasa.gov/DONKI/GST?startDate=2024-05-01&endDate=2024-05-31&api_key=DEMO_KEY",
  particles: "https://api.nasa.gov/DONKI/SEP?startDate=2024-05-01&endDate=2024-05-31&api_key=DEMO_KEY",
  approaches: "https://ssd-api.jpl.nasa.gov/cad.api?date-min=2024-01-01&date-max=2024-12-31&dist-max=10LD&limit=60&sort=dist",
  fireballs: "https://ssd-api.jpl.nasa.gov/fireball.api?limit=60&req-loc=true",
  exoplanets: "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select%20top%201000%20pl_name,hostname,disc_year,discoverymethod,pl_orbper,pl_rade,pl_bmasse,pl_eqt,sy_dist%20from%20pscomppars%20where%20sy_dist%20is%20not%20null%20order%20by%20sy_dist&format=json",
  ryugu: "https://data.darts.isas.jaxa.jp/pub/hayabusa2/lidar_bundle/data/Ryugu/l2/hyb2_ldr_l2_aocsm_topo_ts_20180701_v102.csv",
};

const fetchPayload = async (url, type = "json") => {
  const response = await fetch(url, {
    headers: { "user-agent": "GAIA-SENSEWARE/1.0 open-data-snapshot" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return type === "text" ? response.text() : response.json();
};

const settled = await Promise.allSettled([
  fetchPayload(endpoints.flares),
  fetchPayload(endpoints.cmes),
  fetchPayload(endpoints.storms),
  fetchPayload(endpoints.particles),
  fetchPayload(endpoints.approaches),
  fetchPayload(endpoints.fireballs),
  fetchPayload(endpoints.exoplanets),
  fetchPayload(endpoints.ryugu, "text"),
]);

const readResult = (index, fallback) =>
  settled[index].status === "fulfilled" ? settled[index].value : fallback;
const readError = (index) =>
  settled[index].status === "rejected" ? String(settled[index].reason?.message || settled[index].reason) : null;

const mapTable = (payload) => {
  if (!payload?.fields || !Array.isArray(payload.data)) return [];
  return payload.data.map((values) =>
    Object.fromEntries(payload.fields.map((field, index) => [field, values[index]])),
  );
};

const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCsvLine = (line) => {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
};

const flareRows = readResult(0, []).slice(0, 40).map((row) => ({
  id: row.flrID,
  beginTime: row.beginTime,
  peakTime: row.peakTime,
  classType: row.classType,
  sourceLocation: row.sourceLocation,
  activeRegion: row.activeRegionNum,
}));

const cmeRows = readResult(1, []).slice(0, 40).map((row) => {
  const analysis = (row.cmeAnalyses || []).find((entry) => entry.isMostAccurate) || row.cmeAnalyses?.[0] || {};
  return {
    id: row.activityID,
    startTime: row.startTime,
    sourceLocation: row.sourceLocation,
    speedKmS: numberOrNull(analysis.speed),
    halfAngleDeg: numberOrNull(analysis.halfAngle),
    latitudeDeg: numberOrNull(analysis.latitude),
    longitudeDeg: numberOrNull(analysis.longitude),
  };
});

const stormRows = readResult(2, []).slice(0, 30).map((row) => ({
  id: row.gstID,
  startTime: row.startTime,
  kp: Math.max(...(row.allKpIndex || []).map((entry) => Number(entry.kpIndex) || 0)),
  observations: (row.allKpIndex || []).slice(0, 8).map((entry) => ({
    time: entry.observedTime,
    kp: numberOrNull(entry.kpIndex),
    source: entry.source,
  })),
}));

const particleRows = readResult(3, []).slice(0, 30).map((row) => ({
  id: row.sepID,
  eventTime: row.eventTime,
  instruments: (row.instruments || []).map((entry) => entry.displayName),
  linkedEvents: (row.linkedEvents || []).map((entry) => entry.activityID),
}));

const approachRows = mapTable(readResult(4, {})).map((row) => ({
  designation: row.fullname || row.des,
  date: row.cd,
  distanceAu: numberOrNull(row.dist),
  distanceLunar: numberOrNull(row.dist) === null ? null : numberOrNull(row.dist) * 389.174,
  velocityKmS: numberOrNull(row.v_rel),
  absoluteMagnitude: numberOrNull(row.h),
}));

const fireballRows = mapTable(readResult(5, {})).map((row) => ({
  date: row.date,
  latitude: row.lat === null ? null : numberOrNull(row.lat) * (row["lat-dir"] === "S" ? -1 : 1),
  longitude: row.lon === null ? null : numberOrNull(row.lon) * (row["lon-dir"] === "W" ? -1 : 1),
  altitudeKm: numberOrNull(row.alt),
  energyTenBillionJ: numberOrNull(row.energy),
  impactKilotons: numberOrNull(row["impact-e"]),
  velocityKmS: [row.vx, row.vy, row.vz].every((value) => numberOrNull(value) !== null)
    ? Math.hypot(Number(row.vx), Number(row.vy), Number(row.vz))
    : null,
}));

const exoplanetRows = readResult(6, []).map((row) => ({
  planet: row.pl_name,
  star: row.hostname,
  discovered: numberOrNull(row.disc_year),
  method: row.discoverymethod,
  orbitalDays: numberOrNull(row.pl_orbper),
  radiusEarth: numberOrNull(row.pl_rade),
  massEarth: numberOrNull(row.pl_bmasse),
  equilibriumK: numberOrNull(row.pl_eqt),
  distancePc: numberOrNull(row.sy_dist),
}));
const earthScaleRows = exoplanetRows
  .filter((row) => row.radiusEarth !== null && row.radiusEarth >= 0.5 && row.radiusEarth <= 2.0)
  .filter((row) => row.equilibriumK !== null && row.equilibriumK >= 180 && row.equilibriumK <= 330)
  .slice(0, 40);

const ryuguText = readResult(7, "");
const ryuguLines = ryuguText.split(/\r?\n/).filter((line) => line && !line.trim().startsWith("#"));
const ryuguColumns = [
  "shotTime",
  "rangeM",
  "topoLongitudeDeg",
  "topoLatitudeDeg",
  "topoHeightM",
  "topoXM",
  "topoYM",
  "topoZM",
  "spacecraftXM",
  "spacecraftYM",
  "spacecraftZM",
];
const ryuguRows = ryuguLines.slice(0, 80).map((line) => {
  const values = parseCsvLine(line);
  return Object.fromEntries(ryuguColumns.map((field, index) => [
    field,
    index === 0 ? values[index] : numberOrNull(values[index]),
  ]));
});

const maxOf = (rows, key) => {
  const values = rows.map((row) => numberOrNull(row[key])).filter((value) => value !== null);
  return values.length ? Math.max(...values) : null;
};
const nearestApproach = approachRows[0] || null;
const strongestFireball = [...fireballRows].sort((a, b) => (b.impactKilotons || 0) - (a.impactKilotons || 0))[0] || null;
const nearestExoplanet = exoplanetRows[0] || null;

const source = (id, organisation, title, url, period, unit, resolution, transformation, caveat, preview, error = null) => ({
  id,
  kind: "SOURCE",
  organisation,
  title,
  url,
  retrievedAt,
  period,
  unit,
  resolution,
  transformation,
  caveat,
  status: error ? "UNAVAILABLE_AT_BUILD" : "SNAPSHOT_SAVED",
  error,
  preview: preview.slice(0, 10),
});

const sources = [
  source("nasa-donki-flr", "NASA GSFC / DONKI", "Solar Flare notifications", "https://api.nasa.gov/", "2024-05-01–2024-05-31", "GOES X-ray class", "event notifications", "開始・極大時刻とフレア等級を抜き出しました。", "通知は観測・解析をまとめたイベント情報で、太陽表面の連続画像ではありません。", flareRows, readError(0)),
  source("nasa-donki-cme", "NASA GSFC / DONKI", "Coronal Mass Ejection analyses", "https://api.nasa.gov/", "2024-05-01–2024-05-31", "km/s, degree", "event analyses", "最も確からしい解析値から速度と広がりを抜き出しました。", "CMEの形を単純な円錐として扱う解析値で、粒子一つずつの実測軌跡ではありません。", cmeRows, readError(1)),
  source("nasa-donki-gst", "NASA GSFC / DONKI", "Geomagnetic Storm notifications", "https://api.nasa.gov/", "2024-05-01–2024-05-31", "Kp index", "3-hour geomagnetic index linked to events", "イベントごとの最大Kpを表示用に集計しました。", "Kpは地球規模の磁気活動を示す指数で、特定地点のオーロラを保証する値ではありません。", stormRows, readError(2)),
  source("nasa-donki-sep", "NASA GSFC / DONKI", "Solar Energetic Particle notifications", "https://api.nasa.gov/", "2024-05-01–2024-05-31", "event", "instrument-linked event notifications", "時刻、観測機器、関連イベントを保存しました。", "粒子フラックスの連続値ではなく、現象が確認されたという通知です。", particleRows, readError(3)),
  source("jpl-cneos-cad", "NASA/JPL CNEOS", "Small-Body Close-Approach Data", "https://ssd-api.jpl.nasa.gov/doc/cad.html", "2024-01-01–2024-12-31", "au, lunar distance, km/s", "Earth approaches within 10 lunar distances", "距離を月までの平均距離でも読めるよう換算しました。", "軌道には不確かさがあります。この表示は衝突予報ではありません。", approachRows, readError(4)),
  source("jpl-cneos-fireball", "NASA/JPL CNEOS", "Fireball atmospheric impact records", "https://ssd-api.jpl.nasa.gov/doc/fireball.html", "API取得時点の直近60件（位置あり）", "10^10 J, kt, km", "peak-brightness events", "緯度経度の方向を符号へ変換し、速度成分が揃う場合は合成速度を計算しました。", "米国政府センサーから報告された火球記録で、すべての流星を網羅するものではありません。", fireballRows, readError(5)),
  source("nasa-exoplanet-archive", "NASA Exoplanet Science Institute", "Planetary Systems Composite Parameters", "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html", "取得時点までの確認済み系外惑星から近傍1000件", "pc, Earth radius, Earth mass, K, day", "published composite parameters", "近い順に取得し、地球サイズ候補は半径0.5〜2.0地球、平衡温度180〜330Kで抽出しました。", "平衡温度は大気を直接測った表面温度ではありません。抽出条件も生命の存在を意味しません。", exoplanetRows, readError(6)),
  source("jaxa-darts-ryugu-lidar", "ISAS/JAXA DARTS", "Hayabusa2 LIDAR Level 2 Ryugu topography time series", "https://data.darts.isas.jaxa.jp/pub/hayabusa2/lidar_bundle/browse/", "2018-07-01", "archive CSV fields", "Hayabusa2 LIDAR time series", "公式CSVの列名と先頭80行をそのまま保存しました。", "一日の時系列の一部であり、リュウグウ全面の完成地形図ではありません。", ryuguRows, readError(7)),
];

const modes = [
  {
    id: "solar-flare",
    number: 1,
    code: "FLARE",
    title: "太陽の閃光",
    titleEn: "Solar Flare",
    accent: "255, 178, 92",
    sourceIds: ["nasa-donki-flr"],
    metric: { label: "収録した観測記録", value: flareRows.length, unit: "件", detail: `最大等級 ${flareRows.map((row) => row.classType).filter(Boolean).sort().at(-1) || "—"}` },
    narrative: "太陽フレアは、太陽の表面付近で起きる爆発的なエネルギー放出です。NASAが2024年5月に記録したフレアを再生し、観測されたX線が強いほど光を大きく開きます。",
    interaction: "画面を押すと、次のフレア記録がその場所から開きます。過去の観測を見比べる作品であり、未来の発生予測ではありません。",
    records: flareRows,
  },
  {
    id: "coronal-mass-ejection",
    number: 2,
    code: "CME",
    title: "太陽風の波",
    titleEn: "Coronal Mass Ejection",
    accent: "255, 118, 94",
    sourceIds: ["nasa-donki-cme"],
    metric: { label: "記録中の最高速度", value: maxOf(cmeRows, "speedKmS"), unit: "km/s", detail: `${cmeRows.length}件 / 円錐モデル` },
    narrative: "太陽では、ときどき電気を帯びたガスの巨大な塊が宇宙へ噴き出します。この画面ではNASAの解析速度を波の速さへ、噴き出す範囲を扇形の広がりへ変えています。",
    interaction: "画面をドラッグすると、波を見る方向を変えられます。宇宙空間を実寸で再現したものではなく、記録同士を見比べるために距離と時間を縮めています。",
    records: cmeRows,
  },
  {
    id: "geomagnetic-storm",
    number: 3,
    code: "Kp",
    title: "磁気圏の嵐",
    titleEn: "Geomagnetic Storm",
    accent: "118, 255, 204",
    sourceIds: ["nasa-donki-gst"],
    metric: { label: "記録中の最大Kp指数", value: maxOf(stormRows, "kp"), unit: "Kp", detail: `${stormRows.length}件の磁気嵐通知` },
    narrative: "太陽から届く粒子や磁場は、地球を守る磁気圏を揺らすことがあります。その強さの目安であるKp指数を使い、数字が大きい記録ほど磁力線を激しく震わせます。",
    interaction: "地球の周囲を押すと、磁力線が一時的にたわみます。Kpは地球全体の磁気活動の目安で、特定の場所にオーロラが出る予報ではありません。",
    records: stormRows,
  },
  {
    id: "energetic-particles",
    number: 4,
    code: "SEP",
    title: "太陽から届く粒子",
    titleEn: "Energetic Particles",
    accent: "255, 226, 122",
    sourceIds: ["nasa-donki-sep"],
    metric: { label: "収録した粒子イベント", value: particleRows.length, unit: "件", detail: "観測機器と結びついた通知" },
    narrative: "太陽の活動で加速された高エネルギー粒子は、宇宙空間を通って地球の近くまで届きます。粒子の増加を捉えた時刻と観測機器を、一列ずつ異なる光の雨へ変えています。",
    interaction: "画面へ線を引くと仮想の盾が生まれ、光の粒子がその線を避けます。表示しているのは粒子の連続測定値ではなく、現象が確認されたという通知です。",
    records: particleRows,
  },
  {
    id: "close-approach",
    number: 5,
    code: "NEO",
    title: "地球をかすめる小惑星",
    titleEn: "Close Approach",
    accent: "145, 207, 255",
    sourceIds: ["jpl-cneos-cad"],
    metric: { label: "最も近かった記録", value: nearestApproach?.distanceLunar, unit: "月距離", detail: nearestApproach?.designation || "—" },
    narrative: "2024年に地球の近くを通った小惑星を、地球と月の軌道を基準に並べます。軌道線が地球へ近いほど、NASAが記録した最接近距離も短い天体です。",
    interaction: "左右へなぞると時間が進み、別の接近記録を見られます。1月距離は地球から月までの平均距離です。この表示は衝突予報ではありません。",
    records: approachRows,
  },
  {
    id: "fireball",
    number: 6,
    code: "BOLIDE",
    title: "大気に燃える火球",
    titleEn: "Atmospheric Fireball",
    accent: "255, 105, 68",
    sourceIds: ["jpl-cneos-fireball"],
    metric: { label: "記録中の最大エネルギー", value: strongestFireball?.impactKilotons, unit: "kt", detail: strongestFireball?.date || "—" },
    narrative: "小さな天体が大気へ高速で飛び込むと、強く光る火球になることがあります。NASA/JPLの推定エネルギーが大きい記録ほど、流星を明るく、残光を長く描きます。",
    interaction: "ドラッグした方向へ火球が流れます。向きだけが観客の操作で、明るさと発光高度は観測記録に基づきます。すべての流星を網羅した統計ではありません。",
    records: fireballRows,
  },
  {
    id: "nearby-worlds",
    number: 7,
    code: "EXO NEAR",
    title: "近くの惑星系",
    titleEn: "Nearby Worlds",
    accent: "177, 168, 255",
    sourceIds: ["nasa-exoplanet-archive"],
    metric: { label: "最も近い収録惑星", value: nearestExoplanet?.distancePc, unit: "pc", detail: nearestExoplanet?.planet || "—" },
    narrative: "太陽以外の星を回る惑星を、地球からの距離で並べた星図です。中心に近いほど私たちに近い惑星ですが、遠近の差が大きいため距離は対数で縮めています。",
    interaction: "星図を動かして惑星を選ぶと、名前・距離・見つけ方が切り替わります。1パーセクは約3.26光年です。円の大きさは惑星の実寸ではありません。",
    records: exoplanetRows.slice(0, 60),
  },
  {
    id: "earth-scale-worlds",
    number: 8,
    code: "EXO EARTH",
    title: "地球サイズの遠い世界",
    titleEn: "Earth-scale Worlds",
    accent: "105, 224, 255",
    sourceIds: ["nasa-exoplanet-archive"],
    metric: { label: "条件に当てはまる惑星", value: earthScaleRows.length, unit: "天体", detail: "地球半径0.5–2.0倍 / 180–330K" },
    narrative: "確認済みの系外惑星から、地球に近い大きさと温度条件を持つものを抜き出しました。円の大きさが惑星の半径、色が恒星から受ける熱をもとに計算した平衡温度を表します。",
    interaction: "惑星へ触れると、地球との大きさと温度の違いを見比べられます。平衡温度は実測した地表温度ではなく、この条件だけで生命の存在も判定できません。",
    records: earthScaleRows,
  },
  {
    id: "ryugu-lidar",
    number: 9,
    code: "RYUGU",
    title: "リュウグウに触れる光",
    titleEn: "Ryugu LIDAR",
    accent: "222, 196, 164",
    sourceIds: ["jaxa-darts-ryugu-lidar"],
    metric: { label: "収録したレーザー測距", value: ryuguRows.length, unit: "点", detail: "2018年7月1日 / JAXA DARTS" },
    narrative: "はやぶさ2はレーザーを当て、光が戻るまでの時間からリュウグウとの距離を測りました。その距離と機体の位置を使い、測定点を凹凸のある輪郭として立ち上げます。",
    interaction: "リュウグウへ触れると測定点を選び、輪郭に小さな起伏を残せます。収録した一日の一部分であり、天体全面の完成地形図ではありません。",
    records: ryuguRows,
  },
  {
    id: "cosmic-senseware",
    number: 10,
    code: "COSMOS",
    title: "宇宙の感覚神経系",
    titleEn: "Cosmic Senseware",
    accent: "210, 228, 255",
    sourceIds: sources.map((entry) => entry.id),
    metric: { label: "収録した公開記録", value: flareRows.length + cmeRows.length + stormRows.length + particleRows.length + approachRows.length + fireballRows.length + exoplanetRows.length + ryuguRows.length, unit: "件", detail: `${sources.filter((entry) => entry.status === "SNAPSHOT_SAVED").length}/${sources.length}データ源を保存` },
    narrative: "01から09までの観測記録を、一つの空間に重ねる最終演出です。単位の違う数字を無理に総合点へせず、太陽・地球・小惑星・惑星から届く別々の信号として見せます。",
    interaction: "データ源の光を順に触れると、観客だけの信号網が生まれます。結ばれた線はあなたが作る仮想の関係で、天体同士の物理的な因果関係ではありません。",
    records: [],
  },
];

const snapshot = {
  title: "GAIA ORBITAL SENSEWARE",
  subtitle: "宇宙を読む、10の観測窓",
  generatedAt: retrievedAt,
  snapshotPolicy: "The runtime reads this bundled file only. Source APIs are used by the build script, not by visitors.",
  dateNote: "太陽活動は2024年5月、小惑星接近は2024年、その他は各データセット記載の期間を保存しています。現在値ではありません。",
  legend: {
    SOURCE: "公開機関から取得して保存した値",
    DERIVED: "単位換算・並べ替え・抽出をした値",
    SCENARIO: "観客の操作で生まれる仮想の線や配置",
  },
  sources,
  modes,
};

await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Saved ${outputPath}`);
sources.forEach((entry) => {
  console.log(`${entry.status.padEnd(22)} ${entry.id.padEnd(26)} ${entry.preview.length} preview rows`);
  if (entry.error) console.warn(`  ${entry.error}`);
});
