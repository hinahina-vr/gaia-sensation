// Short introductions describe the displayed measurement and its visual encoding.
// Evidence: app-content.js and the provider catalogs, not decorative backgrounds.
(() => {
'use strict';
const entries = {};
const translations = [];
const t = (ja, en = ja, zh = ja) => {
  translations.push([ja, en, zh]);
  return ja;
};
const add = (number, subject, reading, source, kind = 'saved') => {
  const key = String(number).padStart(2, '0');
  if (entries[key]) throw new Error(`Duplicate data introduction: ${key}`);
  entries[key] = Object.freeze({ number: key, subject, reading, source, kind });
};
const source = {
  weather: t('気象モデル値｜Open-Meteo', 'Weather-model values | Open-Meteo', '气象模型值｜Open-Meteo'),
  cams: t('大気モデル値｜CAMS', 'Atmospheric model | CAMS', '大气模型值｜CAMS'),
  jma: t('年次観測統計｜気象庁', 'Annual observations | JMA', '年度观测统计｜日本气象厅'),
  water: t('水質の年度記録｜環境省', 'Annual water-quality records | MOE Japan', '水质年度记录｜日本环境省'),
  air: t('大気の年度記録｜国立環境研究所', 'Annual air-quality records | NIES', '大气年度记录｜日本国立环境研究所'),
  prtr: t('年度別届出量｜環境省・経済産業省・NITE', 'Annual reported quantities | MOE / METI / NITE', '年度申报量｜环境省·经济产业省·NITE'),
  biology: t('河川水辺の国勢調査｜国土交通省', 'National river survey | MLIT Japan', '河流水边国势调查｜日本国土交通省'),
};
add(1,
  t('世界各地の地上10mで、風がどちらへ、どれくらいの速さで吹いているか。', 'Which way is the wind blowing, and how fast, 10 metres above the ground around the world?', '世界各地距地面10米处，风吹向何方，速度有多快？'),
  t('気象予測モデルのデータをもとに、その様子を光の流れで表しています。', 'Streams of light show these winds using data from weather prediction models.', '我们根据气象预测模型的数据，用流动的光展现风的样子。'),
  t('風速・風向｜気象モデル値｜Open-Meteo／DWD・ECMWFほか', 'Wind speed & direction | Weather-model values | Open-Meteo / DWD, ECMWF and others', '风速·风向｜气象模型值｜Open-Meteo／DWD·ECMWF等'), 'planet');
add(2,
  t('USGSが公開する、直近24時間の地震の記録です。', 'Earthquakes reported by USGS over the past 24 hours.', 'USGS公开的最近24小时地震记录。'),
  t('発生した場所と規模を光の輪で示します。', 'Rings mark earthquake locations and magnitudes.', '用光环表示地震发生地点与震级。'),
  t('震源・時刻・マグニチュード｜USGS', 'Epicentre / time / magnitude | USGS', '震中·时间·震级｜USGS'), 'planet');
add(3,
  t('大気モデルが計算した、PM2.5濃度と微粒子による光の通りにくさです。', 'Modeled PM2.5 and the attenuation of light by atmospheric particles.', '大气模型计算的PM2.5浓度与微粒对光的阻碍程度。'),
  t('地点ごとの値を霞の濃淡で表します。', 'Haze shading represents the values at each location.', '以薄雾深浅呈现各地点的数值。'), source.cams, 'planet');
add(4,
  t('NASAの衛星が検知した、火災や熱異常の記録です。', 'Satellite detections of fires and thermal anomalies from NASA.', 'NASA卫星检测到的火灾与热异常记录。'),
  t('検知時刻に沿って光点を灯し、放射熱の強さを表します。', 'Lights follow detection times and show radiative power.', '按检测时刻点亮光点，呈现辐射热强度。'),
  t('衛星観測・FRP｜NASA FIRMS／MODIS', 'Satellite observations / FRP | NASA FIRMS / MODIS', '卫星观测·FRP｜NASA FIRMS／MODIS'), 'firms');
add(5,
  t('気象モデルによる雲量と、地表に届く日射のデータです。', 'Modeled cloud cover and solar radiation reaching the ground.', '气象模型中的云量及到达地表的太阳辐射数据。'),
  t('過去の雲の参考画像を背景に、地点ごとの光の違いを表します。', 'Compare light at different locations against a historical cloud reference image.', '以历史云层参考图像为背景，呈现各地点光照的差异。'), source.weather, 'planet');
add(6,
  t('地上観測と衛星観測をもとに、大気中のCO₂濃度の変化をたどります。', 'Follow atmospheric CO₂ changes using ground and satellite observations.', '根据地面与卫星观测，追踪大气中CO₂浓度的变化。'),
  t('濃度を色で表し、観測値・過去の再構成・未来の試算を区別しています。', 'Color represents concentration; observations, historical reconstructions and future scenarios remain distinct.', '用颜色表示浓度，并区分观测值、历史重建与未来情景估算。'),
  t('CO₂濃度｜NOAA・GOSAT｜観測・再構成・試算', 'CO₂ | NOAA / GOSAT | Observed, reconstructed, scenario', 'CO₂浓度｜NOAA·GOSAT｜观测·重建·情景估算'));
add(7,
  t('ある一日の海流データから、流れの向きと速さを矢印で示します。', 'Arrows show current direction and speed from one day of ocean data.', '根据某一天的洋流数据，用箭头表示方向与速度。'),
  t('線は同じ流れが続いた場合の14日間の移動を計算したものです。', 'Trails estimate 14 days of travel if the current stays unchanged.', '线条估算洋流保持不变时14天的移动。'),
  t('海流｜NOAA CoastWatch｜一定流速の試算', 'Currents | NOAA CoastWatch | Constant-flow estimate', '洋流｜NOAA CoastWatch｜恒定流速估算'));
add(8,
  t('衛星による森林分布に、世界の参照地点の平均降水量を重ねています。', 'Satellite forest cover is overlaid with mean rainfall at reference locations.', '在卫星森林分布上叠加全球参考地点的平均降水量。'),
  t('緑が森林、水色の円が雨の量です。二つの分布を地図上で見比べられます。', 'Green shows forest and cyan circles show rainfall, letting you compare their distributions.', '绿色表示森林，浅蓝圆表示雨量，可在地图上比较两者的分布。'),
  t('森林・降水量｜MODIS・NASA POWER', 'Forest / rainfall | MODIS / NASA POWER', '森林·降水量｜MODIS·NASA POWER'));
add(9,
  t('国連と世界銀行が公開する、ごみの再資源化・回収の割合です。', 'Recycling and recovery shares published by the UN and World Bank.', '联合国与世界银行公开的废物再利用及回收比例。'),
  t('割合を国土の青の明るさで比べます。明るい国ほど割合が高くなります。', 'Country colors compare the shares: brighter blue indicates a higher share.', '通过国土蓝色的明暗比较，越亮表示比例越高。'),
  t('再資源化・回収率｜国連SDG・世界銀行', 'Recycling / recovery shares | UN SDG / World Bank', '再利用·回收率｜联合国SDG·世界银行'));
add(10,
  t('国別の化石燃料由来CO₂排出量に、衛星が捉えた夜の明かりを重ねます。', 'National fossil-fuel CO₂ emissions are overlaid with satellite night lights.', '在各国化石燃料CO₂排放量上叠加卫星夜间灯光。'),
  t('国土の色は選んだ年の排出量、白い光は2016年の夜間光です。', 'Country colors show emissions for the selected year; white lights remain the 2016 reference.', '国土颜色表示所选年份的排放，白光始终是2016年的参考图像。'),
  t('排出量・夜間光｜Global Carbon Project・NASA VIIRS', 'Emissions / night lights | GCP / NASA VIIRS', '排放·夜间灯光｜GCP·NASA VIIRS'));
add(11,
  t('2000年以降に起きた、世界のマグニチュード7.5以上の地震の記録です。', 'Recorded earthquakes of magnitude 7.5 or above worldwide since 2000.', '2000年以来全球震级7.5及以上的地震记录。'),
  t('震源の印と、規模から推定した揺れの到達範囲の目安を示します。', 'Markers show epicentres, and rings estimate the felt extent from magnitude.', '标记表示震中，圆环示意由震级估算的有感范围。'),
  t('地震記録・推定可感半径｜USGS', 'Earthquake records / estimated felt radius | USGS', '地震记录·估算有感半径｜USGS'));
add(12,
  t('国ごとの森林面積率と都市人口率を、文化遺産の記録とともに見ます。', 'Explore national forest and urban-population shares alongside cultural heritage records.', '结合文化遗产记录，查看各国森林面积与城市人口比例。'),
  t('森・暮らし・文化の層を切り替えて比較します。', 'Switch among forest, settlement and culture layers to compare them.', '切换森林、生活与文化图层进行比较。'),
  t('森林・都市人口・文化遺産｜世界銀行・UNESCOほか', 'Forest / urban population / heritage | World Bank / UNESCO et al.', '森林·城市人口·遗产｜世界银行·UNESCO等'));
add(13,
  t('各国の電力のうち、再生可能エネルギーでつくられた割合です。', 'The share of each country’s electricity generated from renewable sources.', '各国电力中由可再生能源产生的比例。'),
  t('国ごとの公表値を、国土の青の明るさで比べます。明るいほど割合が高くなります。', 'Country colors compare published values; brighter blue indicates a higher share.', '通过国土蓝色的明暗比较各国公布值，越亮表示比例越高。'),
  t('再生可能電力の割合｜世界銀行', 'Renewable electricity share | World Bank', '可再生电力比例｜世界银行'));
add(14,
  t('世界銀行の国・地域別人口を、1960年から年ごとにたどります。', 'Follow World Bank national and regional population records from 1960 onward.', '按年份追踪世界银行自1960年以来的国家与地区人口记录。'),
  t('円の面積が総人口に比例します。年代を動かすと、人口の変化を見比べられます。', 'Circle area is proportional to total population. Move through the years to compare changes.', '圆面积与总人口成正比，切换年份可比较人口变化。'),
  t('国・地域の総人口｜世界銀行', 'Total population by country / region | World Bank', '国家·地区总人口｜世界银行'));

// Japan model fields represent one city per prefecture, not area averages.
const liveMetrics = [
  [15, ['地上10mの風速', 'wind speed at 10 m', '地上10米风速'], source.weather],
  [16, ['CO₂濃度', 'CO₂ concentration', 'CO₂浓度'], source.cams],
  [17, ['降水量', 'precipitation', '降水量'], source.weather],
  [18, ['地上2mの気温', 'air temperature at 2 m', '地上2米气温'], source.weather],
  [19, ['総雲量', 'total cloud cover', '总云量'], source.weather],
  [20, ['PM2.5濃度', 'PM2.5 concentration', 'PM2.5浓度'], source.cams],
];
for (const [number, [ja, en, zh], credit] of liveMetrics) add(number,
  t(`47都道府県の代表都市における、${ja}のモデル値です。`, `Modeled ${en} for one representative city in each of Japan’s 47 prefectures.`, `日本47个都道府县各代表城市的${zh}模型值。`),
  t('代表都市の値の違いを、都道府県の色で比べます。', 'Prefecture colors compare the values for their representative cities.', '用都道府县颜色比较各代表城市的数值。'), credit, 'live');
add(21,
  t('日本人の転入者数から転出者数を引いた、都道府県ごとの年次統計です。', 'Annual inward minus outward migration of Japanese nationals by prefecture.', '各都道府县日本人迁入数减迁出数的年度统计。'),
  t('人数の差を県の色で示し、地域ごとの人の動きをたどります。', 'Prefecture colors show net migration, tracing how people move between regions.', '用都道府县颜色表示净迁移人数，追踪各地区的人口流动。'),
  t('転入超過｜総務省統計局', 'Net migration | Statistics Bureau of Japan', '净迁入｜日本总务省统计局'));
add(22,
  t('従業者10人以上の宿泊施設で、年間に何人が何泊したかを合計した統計です。', 'Annual guest-nights at accommodation establishments with at least ten employees.', '员工10人及以上住宿设施的年度累计住宿人夜数。'),
  t('県の色と灯の大きさで延べ宿泊者数を比べます。', 'Prefecture colors and light sizes compare guest-nights.', '用都道府县颜色与光点大小比较住宿人夜数。'),
  t('年間延べ宿泊者数｜観光庁', 'Annual guest-nights | Japan Tourism Agency', '年度累计住宿人夜数｜日本观光厅'));
add(23,
  t('都道府県ごとに、その年に工事を始めた新しい住宅の戸数です。', 'New housing units whose construction began in each prefecture during the year.', '各都道府县在该年开始施工的新建住宅户数。'),
  t('着工戸数を光柱の高さや枝分かれで表します。', 'Column height and branching represent housing starts.', '以光柱高度与分支呈现住宅开工户数。'),
  t('新設住宅着工戸数｜国土交通省', 'Housing starts | MLIT Japan', '新建住宅开工户数｜日本国土交通省'));

const annualWeather = [
  [24, ['年平均気温', 'annual mean temperature', '年平均气温'], ['県の色で年ごとの気温の違いを比べます。', 'Prefecture colors compare temperatures across years.', '通过都道府县颜色比较各年的气温差异。']],
  [25, ['日最高気温の年平均', 'annual mean of daily maximum temperatures', '日最高气温的年平均'], ['毎日の最高気温の平均を、県の色で比べます。', 'Prefecture colors compare mean daily high temperatures.', '通过都道府县颜色比较日最高气温的平均值。']],
  [26, ['日最低気温の年平均', 'annual mean of daily minimum temperatures', '日最低气温的年平均'], ['毎日の最低気温の平均を、県の色で比べます。', 'Prefecture colors compare mean daily low temperatures.', '通过都道府县颜色比较日最低气温的平均值。']],
  [27, ['年平均相対湿度', 'annual mean relative humidity', '年平均相对湿度'], ['県の色で湿度の違いを示します。', 'Prefecture colors compare humidity.', '用都道府县颜色比较湿度。']],
  [28, ['年間日照時間', 'annual sunshine duration', '年度日照时间'], ['光条の長さや数で、日が差した時間を表します。', 'The length and number of light rays represent hours of sunshine.', '用光线长度与数量呈现日照时间。']],
  [29, ['年間降水量', 'annual precipitation', '年降水量'], ['雨筋や波紋で一年の水の量を表します。', 'Rain streaks and ripples represent annual precipitation.', '用雨线与涟漪表示全年降水量。']],
  [30, ['年間降水日数', 'annual precipitation-day count', '年度降水日数'], ['日降水量1mm以上の日数を波紋の層で表します。', 'Ripple layers represent days with at least 1 mm of precipitation.', '用涟漪层数表示日降水量至少1毫米的天数。']],
];
for (const [number, [ja, en, zh], reading] of annualWeather) add(number,
  t(`気象庁の代表観測地点で記録された、${ja}です。`, `JMA records of ${en} at representative observation sites.`, `日本气象厅代表观测地点记录的${zh}。`),
  t(...reading), source.jma);

const pointReading = t('地点ごとの値を光点の色と大きさで示し、年ごとの変化をたどれます。', 'Point color and size show each site’s value, with records available year by year.', '以光点颜色与大小表示各地点数值，可逐年追踪变化。');
add(31,
  t('沿岸の測定地点で記録された、有機物などの指標・CODの年度平均値です。', 'Annual mean coastal COD, an indicator of chemically oxidizable substances.', '沿岸测量地点记录的COD年度平均值，反映可化学氧化物质。'),
  pointReading, source.water, 'records');
for (const [first, [ja, en, zh]] of [[32, ['海域', 'coastal waters', '海域']], [34, ['河川', 'rivers', '河流']], [36, ['湖沼', 'lakes', '湖泊']]]) {
  add(first,
    t(`${ja}の測定地点で記録された、酸性・アルカリ性の指標、pHです。`, `Recorded pH, a measure of acidity and alkalinity, at sites in ${en}.`, `${zh}测量地点记录的酸碱性指标pH。`),
    t('光点は年度最小値を表し、地点を選ぶと最大値も確認できます。', 'Points show annual minima; selecting a site also reveals maxima.', '光点表示年度最小值，选择地点可查看最大值。'), source.water, 'records');
  add(first + 1,
    t(`${ja}の水に溶けている酸素量、DOの年度平均値です。`, `Annual mean dissolved oxygen (DO) at observation sites in ${en}.`, `${zh}观测地点水中溶解氧DO的年度平均值。`),
    t('地点の色と光の大きさで、酸素量の違いを比べます。', 'Point colors and sizes compare dissolved oxygen levels.', '通过光点颜色与大小比较溶解氧含量。'), source.water, 'records');
}
const stationWeather = [
  [38, ['気温の年平均', 'annual mean air temperature', '气温年平均']],
  [39, ['相対湿度の年平均', 'annual mean relative humidity', '相对湿度年平均']],
  [40, ['現地気圧の年平均', 'annual mean station pressure', '本站气压年平均']],
  [41, ['降水量の年合計', 'annual total precipitation', '降水量年合计']],
  [42, ['風速の年平均', 'annual mean wind speed', '风速年平均']],
  [43, ['全天日射の24時間平均相当値', 'solar radiation expressed as a 24-hour mean', '全天太阳辐射的24小时平均等效值']],
];
for (const [number, [ja, en, zh]] of stationWeather) add(number,
  t(`国内の気象官署で観測された、${ja}です。`, `Observed ${en} at Japanese weather stations.`, `日本气象观测站记录的${zh}。`),
  number === 40 ? t('観測地点の標高での気圧を、光点の色と大きさで比べます。', 'Point color and size compare pressure at each station’s elevation.', '用光点颜色与大小比较各观测站海拔处的气压。')
    : number === 43 ? t('日積算量の年平均をW/m²に換算し、地点の色と大きさで示します。', 'Annual mean daily energy is converted to W/m² and shown by point color and size.', '将日累计辐射量的年平均换算成W/m²，以光点颜色与大小表示。')
      : pointReading, source.jma, 'records');

const airMetrics = [
  [44, ['二酸化硫黄（SO₂）', 'sulfur dioxide (SO₂)', '二氧化硫（SO₂）']],
  [45, ['一酸化窒素（NO）', 'nitric oxide (NO)', '一氧化氮（NO）']],
  [46, ['二酸化窒素（NO₂）', 'nitrogen dioxide (NO₂)', '二氧化氮（NO₂）']],
  [47, ['窒素酸化物（NOx）', 'nitrogen oxides (NOx)', '氮氧化物（NOx）']],
  [48, ['一酸化炭素（CO）', 'carbon monoxide (CO)', '一氧化碳（CO）']],
  [49, ['光化学オキシダント（Ox）', 'photochemical oxidants (Ox)', '光化学氧化剂（Ox）']],
  [50, ['非メタン炭化水素（NMHC）', 'non-methane hydrocarbons (NMHC)', '非甲烷碳氢化合物（NMHC）']],
  [51, ['メタン（CH₄）', 'methane (CH₄)', '甲烷（CH₄）']],
  [52, ['全炭化水素（THC）', 'total hydrocarbons (THC)', '总碳氢化合物（THC）']],
  [53, ['浮遊粒子状物質（SPM）', 'suspended particulate matter (SPM)', '悬浮颗粒物（SPM）']],
  [54, ['微小粒子状物質（PM2.5）', 'fine particulate matter (PM2.5)', '细颗粒物（PM2.5）']],
];
for (const [number, [ja, en, zh]] of airMetrics) add(number,
  t(`国内の大気測定局で記録された、${ja}の${number === 49 ? '昼間の' : ''}年平均濃度です。`, `Recorded annual ${number === 49 ? 'daytime ' : ''}mean ${en} concentrations at Japanese air-monitoring stations.`, `日本大气监测站记录的${ja === '光化学オキシダント（Ox）' ? '白天' : ''}${zh}年平均浓度。`),
  t('光点の色と大きさで濃度を比べ、年ごとの変化をたどれます。', 'Point colors and sizes compare concentrations and trace changes over the years.', '通过光点颜色与大小比较浓度，追踪逐年变化。'), source.air, 'records');

const waterMetrics = [
  [55, ['河川のBOD（分解で消費される酸素の指標）', 'river BOD, an oxygen-demand indicator', '河流BOD（生化需氧量指标）']],
  [56, ['河川のCOD（有機物などの指標）', 'river COD, a chemical oxygen-demand indicator', '河流COD（化学需氧量指标）']],
  [57, ['湖沼のCOD（有機物などの指標）', 'lake COD, a chemical oxygen-demand indicator', '湖泊COD（化学需氧量指标）']],
  [58, ['水中の浮遊物質量（SS）', 'suspended solids (SS) in water', '水中悬浮物（SS）']],
  [59, ['水中の全窒素（T-N）', 'total nitrogen (T-N) in water', '水中总氮（T-N）']],
  [60, ['水中の全りん（T-P）', 'total phosphorus (T-P) in water', '水中总磷（T-P）']],
  [61, ['n-ヘキサン抽出物質（油分の指標）', 'n-hexane extractable substances, an oil-content indicator', '正己烷提取物（油分指标）']],
  [62, ['水中の全亜鉛（Zn）', 'total zinc (Zn) in water', '水中总锌（Zn）']],
  [63, ['水中のLAS（界面活性剤の一群）', 'LAS, a group of surfactants in water', '水中LAS（一类表面活性剂）']],
  [64, ['水中のノニルフェノール', 'nonylphenol in water', '水中壬基酚']],
];
for (const [number, [ja, en, zh]] of waterMetrics) add(number,
  t(`公共用水域の測定地点で記録された、${ja}の年度平均値です。`, `Annual mean ${en} recorded at public-water monitoring sites.`, `公共水域测量地点记录的${zh}年度平均值。`),
  t('地点の色と光の大きさで値を比べ、年ごとの変化をたどれます。', 'Point colors and sizes compare values and trace changes over the years.', '通过光点颜色与大小比较数值，追踪逐年变化。'), source.water, 'records');

for (const [number, [ja, en, zh]] of [
  [65, ['大気への排出量', 'releases to air', '向大气排放的量']],
  [66, ['公共用水域への排出量', 'releases to public waters', '向公共水域排放的量']],
  [67, ['下水道・廃棄物として事業所外へ移した量', 'off-site transfers via sewerage and waste', '经下水道及废物转移至企业外的量']],
]) add(number,
  t(`PRTR制度で事業所が届け出た、化学物質の${ja}です。`, `Facility-reported chemical ${en} under the PRTR system.`, `企业通过PRTR制度申报的化学物质${zh}。`),
  t('事業所の点の色と大きさで、届け出られた量を比べます。', 'Facility point colors and sizes compare reported quantities.', '用企业光点的颜色与大小比较申报量。'), source.prtr, 'records');
for (const [number, [ja, en, zh]] of [[68, ['底生生物', 'bottom-dwelling organisms', '底栖生物']], [69, ['魚類', 'fish', '鱼类']]]) add(number,
  t(`河川調査で確認された${ja}の分類群数を、地区ごとに示します。`, `The number of ${en} taxa recorded in each river survey district.`, `按调查地区显示河流调查确认的${zh}分类群数量。`),
  t('光点の色と大きさで、確認された分類群数を比べます。', 'Point colors and sizes compare the number of recorded taxa.', '用光点颜色与大小比较确认的分类群数量。'), source.biology, 'records');
add(70,
  t('各国の食料の生産・輸入・輸出量から、品目別の自給率を計算しています。', 'Food production, imports and exports are used to calculate commodity-level self-sufficiency.', '根据各国食物生产、进口和出口量计算各品类自给率。'),
  t('品目を切り替えながら、重量ベースの自給率を国土の色で比べます。', 'Switch commodities to compare weight-based self-sufficiency using country colors.', '切换食物品类，通过国土颜色比较按重量计算的自给率。'),
  t('食料需給｜FAO・農水省｜元数量から算出', 'Food balances | FAO / MAFF | Derived ratios', '食物供需｜FAO·日本农水省｜原始数量推算'), 'food');
add(71,
  t('穀物の輸入依存度と、食事エネルギーの供給充足率を比べる展示です。', 'Compare cereal import dependency and the adequacy of dietary energy supply.', '比较谷物进口依赖度与膳食能量供应充足率。'),
  t('主にFAOの3年平均を国土の色で示し、各国の食料供給を見比べられます。', 'Country colors mainly show FAO three-year averages, letting you compare national food supplies.', '国土颜色主要呈现FAO三年平均，可比较各国食物供应情况。'),
  t('食料安全保障｜FAO・農水省参照値', 'Food-security indicators | FAO / MAFF reference data', '粮食安全指标｜FAO·日本农水省参考值'), 'food');

const messages = Object.freeze({
  loading: t('データを読み込んでいます。', 'Loading data.', '正在读取数据。'),
  error: t('データ取得エラー', 'Data loading error', '数据加载错误'),
  sample: t('演出用の参考値を表示しています。', 'Showing illustrative sample values.', '当前显示演示参考值。'),
  windSample: t('演出用の参考値を表示しています。', 'Showing illustrative sample values.', '当前显示演示参考值。'),
  saved: t('保存済みのデータを表示しています。', 'Saved data are currently shown.', '当前显示已保存的数据。'),
  cached: t('取得済みのデータを表示しています。', 'Previously retrieved data are currently shown.', '当前显示之前获取的数据。'),
});
const status = (number, runtime = globalThis) => {
  const entry = entries[number];
  if (!entry) return '';
  if (entry.kind === 'planet') {
    const state = runtime.GaiaPlanetSignals?.getState?.().sourceState;
    return ({ LIVE: '', 'LIVE CACHE': messages.cached, 'SAVED SNAPSHOT': messages.saved,
      'SAVED VALUES': number === '01' ? messages.windSample : messages.sample, ERROR: messages.error })[state] ?? messages.loading;
  }
  if (entry.kind === 'firms') {
    const state = runtime.GaiaFirmsExhibit?.getState?.();
    if (runtime.document?.querySelector('.gaia-firms-readout .gaia-realtime-status')?.dataset.realtimeState === 'error') return messages.error;
    return !state?.source ? messages.loading : state.source === 'nasa-firms-modis' ? messages.cached : messages.saved;
  }
  if (entry.kind === 'live') {
    const state = runtime.GaiaLiveData?.getState?.();
    const definition = runtime.GaiaLiveExhibits?.definitions?.find(item => item.number === number);
    const measurement = state?.measurements?.[definition?.key];
    if (measurement?.value == null || !Number.isFinite(Number(measurement.value))) {
      return !state || state.requestState === 'loading' ? messages.loading : messages.error;
    }
    if (measurement.status === 'snapshot' || state.source === 'snapshot' || !state.connected) return messages.saved;
    return state.requestState === 'unavailable' ? messages.cached : '';
  }
  if (entry.kind === 'records' || entry.kind === 'food') {
    const state = (entry.kind === 'records' ? runtime.GaiaMarineCod : runtime.GaiaFoodExhibits)?.getState?.();
    return state?.dataState === 'ready' ? '' : state?.dataState === 'error' ? messages.error : messages.loading;
  }
  return '';
};
globalThis.GaiaMapDataIntro = Object.freeze({ entries: Object.freeze(entries), status, messages });
globalThis.GaiaI18n?.register(translations);
})();
