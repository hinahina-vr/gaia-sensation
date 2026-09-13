// One canonical representative point per prefecture, in JIS X 0401 code order.
// This order drives both the picker and the automatic north-to-south observation relay.
export const OBSERVATION_CITIES = Object.freeze([
  ["01", "sapporo", "北海道", "札幌", 43.0618, 141.3545],
  ["02", "aomori", "青森県", "青森", 40.8244, 140.74],
  ["03", "morioka", "岩手県", "盛岡", 39.7036, 141.1527],
  ["04", "sendai", "宮城県", "仙台", 38.2682, 140.8694],
  ["05", "akita", "秋田県", "秋田", 39.7186, 140.1024],
  ["06", "yamagata", "山形県", "山形", 38.2404, 140.3633],
  ["07", "fukushima", "福島県", "福島", 37.7503, 140.4676],
  ["08", "mito", "茨城県", "水戸", 36.3418, 140.4468],
  ["09", "utsunomiya", "栃木県", "宇都宮", 36.5658, 139.8836],
  ["10", "maebashi", "群馬県", "前橋", 36.3911, 139.0608],
  ["11", "saitama", "埼玉県", "さいたま", 35.8569, 139.6489],
  ["12", "chiba", "千葉県", "千葉", 35.6074, 140.1065],
  ["13", "tokyo", "東京都", "東京", 35.6762, 139.6503],
  ["14", "yokohama", "神奈川県", "横浜", 35.4437, 139.638],
  ["15", "niigata", "新潟県", "新潟", 37.9026, 139.0232],
  ["16", "toyama", "富山県", "富山", 36.6953, 137.2113],
  ["17", "kanazawa", "石川県", "金沢", 36.5613, 136.6562],
  ["18", "fukui", "福井県", "福井", 36.0652, 136.2216],
  ["19", "kofu", "山梨県", "甲府", 35.6642, 138.5684],
  ["20", "nagano", "長野県", "長野", 36.6513, 138.181],
  ["21", "gifu", "岐阜県", "岐阜", 35.4233, 136.7606],
  ["22", "shizuoka", "静岡県", "静岡", 34.9756, 138.3828],
  ["23", "nagoya", "愛知県", "名古屋", 35.1815, 136.9066],
  ["24", "tsu", "三重県", "津", 34.7303, 136.5086],
  ["25", "otsu", "滋賀県", "大津", 35.0179, 135.8546],
  ["26", "kyoto", "京都府", "京都", 35.0116, 135.7681],
  ["27", "osaka", "大阪府", "大阪", 34.6937, 135.5023],
  ["28", "kobe", "兵庫県", "神戸", 34.6901, 135.1955],
  ["29", "nara", "奈良県", "奈良", 34.6851, 135.8048],
  ["30", "wakayama", "和歌山県", "和歌山", 34.226, 135.1675],
  ["31", "tottori", "鳥取県", "鳥取", 35.5011, 134.2351],
  ["32", "matsue", "島根県", "松江", 35.4681, 133.0484],
  ["33", "okayama", "岡山県", "岡山", 34.6618, 133.9344],
  ["34", "hiroshima", "広島県", "広島", 34.3853, 132.4553],
  ["35", "yamaguchi", "山口県", "山口", 34.1859, 131.4714],
  ["36", "tokushima", "徳島県", "徳島", 34.0703, 134.5548],
  ["37", "takamatsu", "香川県", "高松", 34.3428, 134.0466],
  ["38", "matsuyama", "愛媛県", "松山", 33.8392, 132.7657],
  ["39", "kochi", "高知県", "高知", 33.5597, 133.5311],
  ["40", "fukuoka", "福岡県", "福岡", 33.5904, 130.4017],
  ["41", "saga", "佐賀県", "佐賀", 33.2635, 130.3009],
  ["42", "nagasaki", "長崎県", "長崎", 32.7503, 129.8777],
  ["43", "kumamoto", "熊本県", "熊本", 32.8031, 130.7079],
  ["44", "oita", "大分県", "大分", 33.2382, 131.6126],
  ["45", "miyazaki", "宮崎県", "宮崎", 31.9077, 131.4202],
  ["46", "kagoshima", "鹿児島県", "鹿児島", 31.5966, 130.5571],
  ["47", "naha", "沖縄県", "那覇", 26.2124, 127.6809],
].map(([code, id, prefecture, city, lat, lon]) => Object.freeze({
  code,
  id,
  prefecture,
  city,
  name: `${prefecture} / ${city}`,
  label: `${prefecture}・${city}`,
  lat,
  lon,
})));

const cityIndex = new Map(OBSERVATION_CITIES.map((city, index) => [city.id, { city, index }]));

export const findObservationCity = id => cityIndex.get(id)?.city;

// Unknown IDs use the first prefecture, matching the picker's existing fallback.
// Keep the same ordering for the button labels, manual steps and automatic relay.
export function adjacentObservationCity(id, direction) {
  const index = cityIndex.get(id)?.index ?? 0;
  const count = OBSERVATION_CITIES.length;
  return OBSERVATION_CITIES[((index + direction) % count + count) % count];
}
