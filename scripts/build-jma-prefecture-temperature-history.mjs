import fs from "node:fs";

const OUTPUT_URL = new URL("../data/estat-prefecture-series.json", import.meta.url);
const START_YEAR = 1955;
const END_YEAR = 2025;
const years = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, index) => String(START_YEAR + index));

// One long-running JMA surface observatory per prefecture, in JIS X 0401 order.
// Kumagaya, Choshi, Hikone and Shimonoseki replace prefectural-capital sites whose
// official continuous surface-observatory series does not cover this period.
const stations = [
  ["01", "北海道", "札幌", "14", "47412"],
  ["02", "青森県", "青森", "31", "47575"],
  ["03", "岩手県", "盛岡", "33", "47584"],
  ["04", "宮城県", "仙台", "34", "47590"],
  ["05", "秋田県", "秋田", "32", "47582"],
  ["06", "山形県", "山形", "35", "47588"],
  ["07", "福島県", "福島", "36", "47595"],
  ["08", "茨城県", "水戸", "40", "47629"],
  ["09", "栃木県", "宇都宮", "41", "47615"],
  ["10", "群馬県", "前橋", "42", "47624"],
  ["11", "埼玉県", "熊谷", "43", "47626"],
  ["12", "千葉県", "銚子", "45", "47648"],
  ["13", "東京都", "東京", "44", "47662"],
  ["14", "神奈川県", "横浜", "46", "47670"],
  ["15", "新潟県", "新潟", "54", "47604"],
  ["16", "富山県", "富山", "55", "47607"],
  ["17", "石川県", "金沢", "56", "47605"],
  ["18", "福井県", "福井", "57", "47616"],
  ["19", "山梨県", "甲府", "49", "47638"],
  ["20", "長野県", "長野", "48", "47610"],
  ["21", "岐阜県", "岐阜", "52", "47632"],
  ["22", "静岡県", "静岡", "50", "47656"],
  ["23", "愛知県", "名古屋", "51", "47636"],
  ["24", "三重県", "津", "53", "47651"],
  ["25", "滋賀県", "彦根", "60", "47761"],
  ["26", "京都府", "京都", "61", "47759"],
  ["27", "大阪府", "大阪", "62", "47772"],
  ["28", "兵庫県", "神戸", "63", "47770"],
  ["29", "奈良県", "奈良", "64", "47780"],
  ["30", "和歌山県", "和歌山", "65", "47777"],
  ["31", "鳥取県", "鳥取", "69", "47746"],
  ["32", "島根県", "松江", "68", "47741"],
  ["33", "岡山県", "岡山", "66", "47768"],
  ["34", "広島県", "広島", "67", "47765"],
  ["35", "山口県", "下関", "81", "47762"],
  ["36", "徳島県", "徳島", "71", "47895"],
  ["37", "香川県", "高松", "72", "47891"],
  ["38", "愛媛県", "松山", "73", "47887"],
  ["39", "高知県", "高知", "74", "47893"],
  ["40", "福岡県", "福岡", "82", "47807"],
  ["41", "佐賀県", "佐賀", "85", "47813"],
  ["42", "長崎県", "長崎", "84", "47817"],
  ["43", "熊本県", "熊本", "86", "47819"],
  ["44", "大分県", "大分", "83", "47815"],
  ["45", "宮崎県", "宮崎", "87", "47830"],
  ["46", "鹿児島県", "鹿児島", "88", "47827"],
  ["47", "沖縄県", "那覇", "91", "47936"],
].map(([code, prefecture, station, precNo, blockNo]) => ({ code, prefecture, station, precNo, blockNo }));

const decodeText = (value) => value
  .replace(/<br\s*\/?>/giu, " ")
  .replace(/<[^>]+>/gu, "")
  .replace(/&nbsp;|&#160;/gu, " ")
  .replace(/&minus;/gu, "-")
  .replace(/&amp;/gu, "&")
  .replace(/\s+/gu, " ")
  .trim();

const parseNumber = (value) => {
  const text = decodeText(value).replace(/[\]\[*#]/gu, "");
  if (!text || text.includes("×")) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/u);
  return match ? Number(match[0]) : null;
};

const sourceUrl = ({ precNo, blockNo }) => (
  `https://www.data.jma.go.jp/stats/etrn/view/annually_s.php?prec_no=${precNo}&block_no=${blockNo}&year=&month=&day=&view=a2`
);

const parseAnnualRows = (html, station) => {
  if (!html.includes(`${station.station}（`) && !html.includes(`>${station.station}<`)) {
    throw new Error(`${station.code} ${station.station}: station name was not found in the JMA response`);
  }
  const result = new Map();
  for (const rowMatch of html.matchAll(/<tr class="mtx2"[^>]*>([\s\S]*?)<\/tr>/giu)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/giu)].map((match) => match[1]);
    const yearMatch = decodeText(cells[0] || "").match(/(?:19|20)\d{2}/u);
    if (!yearMatch) continue;
    const year = yearMatch[0];
    if (Number(year) < START_YEAR || Number(year) > END_YEAR) continue;
    // JMA detailed annual temperature table: mean, mean daily maximum,
    // annual maximum/date/minimum/date, mean daily minimum, ...
    result.set(year, {
      averageTemperature: parseNumber(cells[1]),
      summerHigh: parseNumber(cells[2]),
      winterLow: parseNumber(cells[7]),
    });
  }
  return result;
};

const fetched = [];
for (const [index, station] of stations.entries()) {
  const url = sourceUrl(station);
  const response = await fetch(url, { headers: { "user-agent": "GAIA-SENSEWARE-data-build/1.0" } });
  if (!response.ok) throw new Error(`${station.code} ${station.station}: JMA HTTP ${response.status}`);
  const annual = parseAnnualRows(await response.text(), station);
  const missing = years.filter((year) => {
    const row = annual.get(year);
    return !row || Object.values(row).some((value) => !Number.isFinite(value));
  });
  if (missing.length) throw new Error(`${station.code} ${station.station}: missing ${missing.join(", ")}`);
  fetched.push({ ...station, url, annual });
  process.stdout.write(`\r${String(index + 1).padStart(2, "0")}/47 ${station.prefecture} ${station.station}`);
}
process.stdout.write("\n");

const data = JSON.parse(fs.readFileSync(OUTPUT_URL, "utf8"));
for (const key of ["averageTemperature", "summerHigh", "winterLow"]) {
  data.periodsBySeries[key] = years;
  data[key] = Object.fromEntries(years.map((year) => [
    year,
    fetched.map(({ annual }) => annual.get(year)[key]),
  ]));
}
data.temperatureHistorySource = {
  name: "過去の気象データ検索『年ごとの値／詳細（気温・蒸気圧・湿度）』",
  publisher: "気象庁",
  coverage: `${START_YEAR}-${END_YEAR} / 47都道府県の代表気象台・測候所`,
  metrics: {
    averageTemperature: "年平均気温",
    summerHigh: "日最高気温の年平均",
    winterLow: "日最低気温の年平均",
  },
  comparisonNote: "観測点の移転や観測方法変更により長期系列が均質でない場合があります。都市化の影響も含みます。",
  missingValuePolicy: "欠損補完なし",
  generatedAt: new Date().toISOString(),
  stations: fetched.map(({ annual: _annual, ...station }) => station),
};

fs.writeFileSync(OUTPUT_URL, `${JSON.stringify(data, null, 2)}\n`);
console.log(JSON.stringify({
  status: "written",
  output: OUTPUT_URL.pathname,
  years: years.length,
  start: years[0],
  end: years.at(-1),
  prefectures: fetched.length,
  values: years.length * fetched.length * 3,
}, null, 2));
