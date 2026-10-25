// Reading copy for exhibits 31–40. Loaded with the map, never at title entry.
// This module changes no source records, units, thresholds or color scales.
const translations = [];
const t = (ja, en, zh) => { translations.push([ja, en, zh]); return ja; };
const readings = {};
const waterBasis = t('環境省 · 公共用水域の年度記録', 'Ministry of the Environment · Annual water records', '日本环境省 · 公共水域年度记录');
const weatherBasis = t('気象庁 · 全国38官署の年次記録', 'JMA · Annual records at 38 weather stations', '日本气象厅 · 全国38个气象站的年度记录');
const qualityNote = t('灰色の輪：欠測・注記付きの記録', 'Gray rings: missing or qualified records', '灰色圆环：缺测或附注记录');
const guide = t('光点か地域・地点を選び、年を動かして同じ場所の変化をたどれます。', 'Select a point or choose a region and station, then move through years to follow the same site.', '选择光点或地区与站点，再移动年份，追溯同一地点的变化。');
const colorMap = t('青→緑→橙→赤の順に数値が大きくなります。色の目盛りは全期間共通です。', 'Values increase from blue through green and orange to red. The scale is shared across years.', '数值按蓝、绿、橙、红的顺序增大。所有年份使用统一颜色刻度。');
readings[31] = {
  readingBasis: waterBasis, qualityNote, guide,
  caption: t('沿岸のCODは、有機物などを化学的に酸化するときに必要な酸素量の指標です。測定地点ごとの年度平均値をたどります。', 'Coastal COD measures the oxygen required to chemically oxidize organic matter and other substances. Follow annual means at each site.', '沿岸COD表示化学氧化有机物等物质所需氧量的指标。追溯各测量地点的年度平均值。'),
  explanation: t('光点の色と大きさはCODの年度平均値です。地点欄のCOD75は、測定値を小さい順に並べたときの75%値です。', 'Point color and size represent annual mean COD. COD75 in the station readout is the 75% value of measurements ordered from low to high.', '光点的颜色与大小表示COD年度平均值。地点栏的COD75是将测量值由小到大排列后的75%值。'),
  visualMap: t('青→緑→黄→赤の順にCOD値が大きくなります。光点を選ぶとCOD75も確認できます。', 'COD increases from blue through green and yellow to red. Select a point to see COD75 as well.', 'COD数值按蓝、绿、黄、红的顺序增大。选择光点还可查看COD75。'),
};
for (const [number, ja, en, zh] of [[32, '海域', 'coastal waters', '海域'], [34, '河川', 'rivers', '河流'], [36, '湖沼', 'lakes', '湖泊']]) {
  readings[number] = {
    readingBasis: waterBasis, qualityNote, guide,
    caption: t(`${ja}の酸性・アルカリ性の度合いを表すpHです。光点は年度最小値、地点を選ぶと年度最大値も確認できます。`, `pH describes acidity and alkalinity in ${en}. Points show annual minima; selecting a site also reveals its annual maximum.`, `pH表示${zh}的酸碱程度。光点表示年度最小值，选择地点还可查看年度最大值。`),
    explanation: t('pHは7を目安に、小さい側が酸性、大きい側がアルカリ性です。対数で表す指標なので、1の差は水素イオンの活量で10倍の違いに対応します。', 'Around pH 7, lower values indicate the acidic side and higher values the alkaline side. A difference of one pH unit corresponds to a tenfold difference in hydrogen-ion activity.', '以pH 7为参考，较低值表示酸性侧，较高值表示碱性侧。pH相差1对应氢离子活度相差10倍。'),
    visualMap: t('光点の色と大きさは年度最小値。選択地点の最小〜最大を同じpH目盛りで示します。', 'Point color and size show annual minima. The selected site’s minimum and maximum share one pH scale.', '光点颜色与大小表示年度最小值。所选地点的最小值与最大值使用同一pH刻度。'),
  };
  readings[number + 1] = {
    readingBasis: waterBasis, qualityNote, guide,
    caption: t(`${ja}の水に溶けている酸素の量、DOの年度平均値です。水1Lあたりの酸素量をmgで表し、地点ごとの変化をたどります。`, `Annual mean dissolved oxygen (DO) in ${en}, expressed as milligrams of oxygen per litre of water. Follow changes at each site.`, `${zh}水中溶解氧DO的年度平均值，以每升水中氧的毫克数表示。追溯各地点的变化。`),
    explanation: t('DOは水温や流れ、光合成、呼吸・分解などで変化します。一年を通した酸素量の記録として、同じ地点の年ごとの違いを比べます。', 'DO varies with water temperature, mixing, photosynthesis, respiration and decomposition. Compare annual records at the same site.', 'DO随水温、水流、光合作用、呼吸及分解等变化。将其作为全年氧含量记录，比较同一地点各年的差异。'),
    visualMap: t('青→緑→橙→赤の順に、溶けている酸素量が増えます。色は濃度の目盛りです。', 'Dissolved oxygen increases from blue through green and orange to red. Colors encode concentration.', '溶解氧含量按蓝、绿、橙、红的顺序增加。颜色表示浓度刻度。'),
  };
}
readings[38] = {
  readingBasis: weatherBasis, qualityNote, guide, visualMap: colorMap,
  caption: t('毎日の日平均気温を一年分まとめた年平均値です。全国38か所の気象官署で、1955〜2024年の気温を比べます。', 'Annual means of daily mean air temperature. Compare records from 1955 to 2024 at 38 weather stations across Japan.', '将每日平均气温汇总为年平均值。比较日本全国38个气象站1955至2024年的气温记录。'),
  explanation: t('同じ地点の年を動かすと、暖かかった年や冷えた年をたどれます。長期の比較には、都市化や観測環境・移設の影響も含まれます。', 'Move through years at the same station to find warmer and cooler years. Long-term comparisons also reflect urbanization, observing conditions and relocations.', '在同一站点移动年份，寻找较暖或较冷的年份。长期比较也包含城市化、观测环境及迁站的影响。'),
};
readings[39] = {
  readingBasis: weatherBasis, qualityNote, guide, visualMap: colorMap,
  caption: t('全国38か所の気象官署で記録した相対湿度の年平均です。その気温での飽和水蒸気圧に対する、水蒸気圧の割合を示します。', 'Annual mean relative humidity at 38 weather stations: water-vapour pressure as a percentage of saturation vapour pressure at that temperature.', '全国38个气象站记录的相对湿度年平均值，表示水汽压占该温度下饱和水汽压的百分比。'),
  explanation: t('相対湿度は水蒸気の量だけでなく気温にも左右されます。38の気温と見比べ、同じ地点の湿り方を年ごとにたどれます。', 'Relative humidity depends on temperature as well as moisture. Compare with temperature in exhibit 38 to follow humidity at the same station over time.', '相对湿度既受水汽量影响，也受气温影响。与展示38的气温对照，逐年追溯同一站点的湿润程度。'),
};
readings[40] = {
  readingBasis: weatherBasis, qualityNote, guide, visualMap: colorMap,
  caption: t('観測地点の標高で測った、現地気圧の年平均です。全国38か所の気象官署の記録から、空気の重さをたどります。', 'Annual mean station pressure measured at each site’s elevation. Explore records from 38 Japanese weather stations.', '在观测站自身海拔处测得的本站气压年平均值。通过日本全国38个气象站的记录探索空气的重量。'),
  explanation: t('標高が高い地点ほど、上に重なる空気が少なく気圧は低くなります。地点間では標高差に注目し、年ごとの変化は同じ地点で比べます。', 'Higher stations have less air above them and lower pressure. Consider elevation when comparing sites, and use the same station to compare years.', '海拔越高，上方空气越少，气压越低。比较站点时留意海拔差异，比较年度变化时选择同一站点。'),
};
export const observationReadings = Object.freeze(Object.fromEntries(Object.entries(readings).map(([number, value]) => [number, Object.freeze({ ...value, picker: value.caption })])));
export const observationReadingTranslations = [
  ...translations,
  ['年度最小〜最大', 'Annual minimum–maximum', '年度最小值至最大值'],
  ['指標と見方', 'About this measure', '指标与读法'],
  ['観測地点を選択', 'Select an observation site', '选择观测地点'],
  ['{value}以上 {unit}', '{value}+ {unit}', '{value}以上 {unit}'],
  ['{start}–{end}年', '{start}–{end}', '{start}至{end}年'],
  ['{start}–{end}年度', 'FY {start}–{end}', '{start}至{end}年度'],
  ['酸性側', 'Acidic side', '酸性侧'], ['アルカリ性側', 'Alkaline side', '碱性侧'],
  ['地点を選ぶと、その年度の幅を表示', 'Select a site to see its annual range', '选择地点可查看该年度范围'],
  ['年度最小値・最大値の数値がそろう年に幅を表示', 'Range appears when both annual extrema are numeric', '年度最小值和最大值均有数值时显示范围'],
  ['水質の年度記録', 'Annual water-quality records', '年度水质记录'],
  ['気象の年次記録', 'Annual weather records', '年度气象记录'],
];
