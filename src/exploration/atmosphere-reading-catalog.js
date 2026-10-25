// Exhibits 41–50: reading guidance only; source values and scales stay intact.
// Loaded with the map, not the title screen.
const translations = [];
const t = (ja, en, zh) => { translations.push([ja, en, zh]); return ja; };
const weatherBasis = t('気象庁 · 全国38官署の年次記録', 'JMA · Annual records at 38 weather stations', '日本气象厅 · 全国38个气象站的年度记录');
const airBasis = t('国立環境研究所 · 大気測定局の年度記録', 'NIES · Annual air-monitoring station records', '日本国立环境研究所 · 大气监测站年度记录');
const qualityNote = t('灰色の輪：欠測・注記付きの記録', 'Gray rings: missing or qualified records', '灰色圆环：缺测或附注记录');
const guide = t('光点か地域・地点を選び、年を動かして同じ場所の変化をたどれます。', 'Select a point or choose a region and station, then move through years to follow the same site.', '选择光点或地区与站点，再移动年份，追溯同一地点的变化。');
const colorMap = t('青→緑→橙→赤の順に数値が大きくなります。色の目盛りは全期間共通です。', 'Values increase from blue through green and orange to red. The scale is shared across years.', '数值按蓝、绿、橙、红的顺序增大。所有年份使用统一颜色刻度。');
const airGuide = t('一般環境局・道路沿いの自排局など、局の区分と測定時間も確認できます。同じ局を選び、年度ごとの変化を比べてみましょう。', 'Check the station type and recorded monitoring hours, including ambient and roadside stations. Follow the same station across fiscal years.', '可查看一般环境站、道路旁汽车尾气监测站等站点类型及监测时数。选择同一站点，比较各年度的变化。');
const airColor = t('光点の色と大きさは濃度。青→緑→橙→赤の順に高くなり、目盛りは全年度共通です。', 'Point color and size encode concentration, increasing from blue through green and orange to red on a scale shared across fiscal years.', '光点的颜色与大小表示浓度，按蓝、绿、橙、红的顺序增高，各年度使用统一刻度。');
const readings = {
  41: {
    readingBasis: weatherBasis, qualityNote, guide, visualMap: colorMap,
    caption: t('雨や雪が一年に届けた水の量です。雪も水に換算した降水量の年合計を、全国38か所の気象官署で比べます。', 'The water delivered by rain and snow over a year. Compare annual precipitation totals, with snow expressed as water, at 38 weather stations.', '雨雪一年带来的水量。雪也换算为水量，比较全国38个气象站的年降水总量。'),
    explanation: t('降水量1mmは、1m²の面積に水1Lが降った量に相当します。地点を選んで年を動かすと、雨雪の多かった年や少なかった年をたどれます。', 'One millimetre of precipitation equals one litre of water over one square metre. Select a station and move through years to explore wetter and drier years.', '1毫米降水相当于每平方米降下1升水。选择站点并移动年份，追溯雨雪较多或较少的年份。'),
  },
  42: {
    readingBasis: weatherBasis, qualityNote, guide, visualMap: colorMap,
    caption: t('観測された風速を一年分まとめた年平均です。全国38か所の気象官署で、風の強さの長期的な変化をたどります。', 'Observed wind speeds summarized as annual means. Follow long-term changes in wind speed at 38 weather stations.', '将观测风速汇总为年平均值，追溯全国38个气象站风速的长期变化。'),
    explanation: t('1m/sは、空気が1秒に1m進む速さです。地点間の違いには地形、風速計の高さ、周囲の建物なども関係するため、同じ地点の年ごとの変化に注目します。', 'One metre per second means air travels one metre in a second. Terrain, anemometer height and surrounding buildings affect differences between stations; focus on changes at the same site.', '1米每秒表示空气每秒移动1米。地形、风速仪高度及周围建筑也影响站点差异，可重点观察同一站点的年度变化。'),
  },
  43: {
    readingBasis: weatherBasis, qualityNote, guide,
    visualMap: t('光点は、夜間も含む24時間平均相当のW/m²。原資料の日積算量と換算方法は「指標と見方」で確認できます。', 'Points show W/m² as a 24-hour mean including night. Open “About this measure” for the source daily total and conversion.', '光点显示包含夜间的24小时平均等效值W/m²。展开“指标与读法”可查看原始日累计量及换算方式。'),
    caption: t('地表に届いた太陽のエネルギー、全天日射の記録です。一日分のエネルギーの年平均を、24時間平均相当のW/m²で表示します。', 'Global solar radiation records the solar energy reaching the ground. The annual mean of daily energy totals is expressed as an equivalent 24-hour mean in W/m².', '全天太阳辐射记录到达地表的太阳能。将每日能量累计量的年平均值换算为24小时平均等效值W/m²。'),
    explanation: t('原資料のMJ/m²/dayを1,000,000倍し、1日86,400秒で割ってW/m²へ換算しています。日中に受けたエネルギーを、夜間も含めた一日全体で平均した値です。', 'Multiply source MJ/m²/day by 1,000,000 and divide by 86,400 seconds to obtain W/m². This spreads the energy received during daylight over the full day, including night.', '将原资料的MJ/m²/day乘以1,000,000，再除以一天的86,400秒，得到W/m²。这是将白天收到的能量平均到包含夜间的整天。'),
  },
};
const air = [
  [44,
    t('燃料に含まれる硫黄の燃焼などで生じる、二酸化硫黄SO₂の年度平均濃度です。各測定局で、空気に含まれる割合をppmで示します。', 'Annual mean sulfur dioxide (SO₂) concentration, associated with burning sulfur-containing fuels and other sources. Each station reports its proportion in air in ppm.', '二氧化硫SO₂与含硫燃料燃烧等来源有关。各监测站以ppm表示其在空气中的年度平均浓度。'),
    t('同じ測定局を選ぶと、燃料や排出対策の変化を考える手がかりになります。濃度には、風による運ばれ方や自然由来の影響も重なります。', 'Follow the same station for clues to changes in fuels and emission controls. Concentrations also reflect wind transport and natural sources.', '追溯同一站点，可获得思考燃料与排放措施变化的线索。浓度也受到风输送及自然来源的影响。')],
  [45,
    t('燃焼などで生じる一酸化窒素NOの年度平均濃度です。道路沿いと一般環境の測定局で、空気の記録をたどります。', 'Annual mean nitric oxide (NO), produced by combustion and other processes. Explore records at roadside and ambient monitoring stations.', '燃烧等过程产生的一氧化氮NO的年度平均浓度。追溯道路旁与一般环境监测站的空气记录。'),
    t('NOは大気中で反応し、NO₂へ変わります。46のNO₂、47のNOxと、同じ年度・測定局を見比べると、窒素酸化物の内訳に目を向けられます。', 'NO reacts in the atmosphere to form NO₂. Compare with NO₂ in exhibit 46 and NOx in 47 at the same station and fiscal year to explore their composition.', 'NO在大气中反应转化为NO₂。对照展示46的NO₂和47的NOx，选择同一年度与站点，关注氮氧化物的组成。')],
  [46,
    t('燃焼や大気中の反応に関係する、二酸化窒素NO₂の年度平均濃度です。同じ測定局の記録から、街の空気の変化を読み取ります。', 'Annual mean nitrogen dioxide (NO₂), linked to combustion and atmospheric reactions. Follow changes in urban air at the same station.', '与燃烧及大气反应有关的二氧化氮NO₂年度平均浓度。通过同一监测站的记录观察城市空气的变化。'),
    t('一年を通した濃度の水準に注目する展示です。一般環境局と道路沿いの自排局を区別し、測定時間や局の移転にも目を向けて比べます。', 'Focus on concentration levels over a full year. Distinguish ambient from roadside stations and consider monitoring hours and station relocations when comparing records.', '本展示关注全年的浓度水平。比较时区分一般环境站与道路旁站点，并留意监测时数及迁站。')],
  [47,
    t('一酸化窒素NOと二酸化窒素NO₂を合わせた、窒素酸化物NOxの年度平均濃度です。同時測定に基づく原資料の値を表示します。', 'Annual mean nitrogen oxides (NOx), comprising NO and NO₂. Values come from the source’s simultaneous measurements.', '由一氧化氮NO与二氧化氮NO₂组成的氮氧化物NOx年度平均浓度，显示原资料基于同步测量的数值。'),
    t('NOとNO₂を同じ時間に測った記録から、NOxが集計されています。45・46と同じ測定局を見比べ、合計と成分それぞれの変化をたどれます。', 'NOx is compiled from records measuring NO and NO₂ at the same time. Compare the same station in exhibits 45 and 46 to follow the total and individual components.', 'NOx根据同一时段测得的NO与NO₂记录汇总。对照展示45、46的同一站点，追溯总量与各成分的变化。')],
  [48,
    t('不完全燃焼などで生じる、一酸化炭素COの屋外濃度の記録です。各測定局の年度平均値をppmで表示します。', 'Outdoor carbon monoxide (CO), associated with incomplete combustion and other sources. Annual mean concentrations are shown in ppm for each station.', '与不完全燃烧等来源有关的一氧化碳CO室外浓度记录。以ppm显示各站点的年度平均值。'),
    t('COは炭素と酸素が一つずつ結びついた気体です。一年の平均濃度を手がかりに、同じ場所の長期的な変化を読みます。', 'CO contains one carbon atom and one oxygen atom. Use annual mean concentration to explore long-term changes at the same location.', 'CO由一个碳原子和一个氧原子结合而成。以年度平均浓度为线索，观察同一地点的长期变化。')],
  [49,
    t('日差しによる大気の反応で生じる、光化学オキシダントOxの記録です。原資料の昼間5〜20時の測定から集計した年度平均濃度を示します。', 'Photochemical oxidants (Ox) form through sunlight-driven atmospheric reactions. This annual mean uses the source’s daytime measurements from 05:00 to 20:00.', '光化学氧化剂Ox由阳光驱动的大气反应形成。显示原资料白天5至20时测量汇总的年度平均浓度。'),
    t('主成分はオゾンです。光の強さ、原因物質、風による輸送などが関係します。昼間という共通の集計時間帯で、年度ごとの変化をたどります。', 'Ozone is the main component. Sunlight, precursor substances and wind transport influence concentrations. Follow changes using the same daytime reporting window.', '主要成分为臭氧，浓度受阳光、前体物质及风输送等影响。在统一的白天统计时段下追溯年度变化。')],
  [50,
    t('メタンを除く炭化水素、NMHCの年度平均濃度です。含まれる炭素の数で換算したppmCで、各測定局の記録を示します。', 'Annual mean non-methane hydrocarbons (NMHC). Station records use ppmC, a concentration expressed on a carbon-atom basis.', '除甲烷外的碳氢化合物NMHC年度平均浓度。各站点记录使用按碳原子数换算的ppmC。'),
    t('炭化水素には、燃料や溶剤などに由来する多様な成分があります。光化学反応に関わる成分も含まれ、49のOxと同じ年度の記録を見比べられます。', 'Hydrocarbons include diverse components from fuels, solvents and other sources. Some participate in photochemical reactions; compare records for the same fiscal year with Ox in exhibit 49.', '碳氢化合物包含来自燃料、溶剂等多种成分，其中部分参与光化学反应。可与展示49的Ox对照同一年度记录。')],
];
for (const [number, caption, explanation] of air) readings[number] = {
  readingBasis: airBasis, qualityNote, guide: airGuide, visualMap: airColor, caption, explanation,
  samplingWindow: number === 49
    ? t('昼間 5〜20時 · 年度平均', 'Daytime 05:00–20:00 · Annual mean', '白天5至20时 · 年度平均')
    : t('全時間帯 · 年度平均', 'All hours · Annual mean', '全时段 · 年度平均'),
};
export const atmosphereReadings = Object.freeze(Object.fromEntries(Object.entries(readings).map(([number, value]) => [number, Object.freeze({ ...value, picker: value.caption })])));
export const atmosphereReadingTranslations = [
  ...translations,
  ['選択地点の原記録', 'Selected station record', '所选站点原始记录'],
  ['測定局区分', 'Station type', '监测站类型'],
  ['集計時間帯', 'Reporting window', '统计时段'],
  ['観測時間の記録', 'Recorded monitoring hours', '监测时数记录'],
  ['原資料の日積算量', 'Source daily energy', '原资料日累计能量'],
  ['24時間平均相当', 'Equivalent 24-hour mean', '24小时平均等效值'],
  ['大気の年度記録', 'Annual air-quality records', '年度大气记录'],
  ['測定局区分{value}', 'Station type {value}', '监测站类型{value}'],
  ['一般環境大気測定局', 'Ambient air monitoring station', '一般环境大气监测站'],
  ['自動車排出ガス測定局', 'Roadside air monitoring station', '汽车尾气监测站'],
  ['原資料の測定時間(時間): {value}', 'Source monitoring hours: {value}', '原资料监测时数：{value}'],
  ['原資料の昼間測定時間(時間): {value}', 'Source daytime monitoring hours: {value}', '原资料白天监测时数：{value}'],
];
