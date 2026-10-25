// Exhibits 51–60: map-only reading guidance. Observations, scales and units stay intact.
const translations = [];
const t = (ja, en, zh) => { translations.push([ja, en, zh]); return ja; };
const airBasis = t('国立環境研究所 · 大気測定局の年度記録', 'NIES · Annual air-monitoring station records', '日本国立环境研究所 · 大气监测站年度记录');
const waterBasis = t('環境省 · 公共用水域の年度記録', 'Ministry of the Environment · Annual water records', '日本环境省 · 公共水域年度记录');
const qualityNote = t('灰色の輪：欠測・注記付きの記録', 'Gray rings: missing or qualified records', '灰色圆环：缺测或附注记录');
const visualMap = t('光点の色と大きさは年度平均値。青→緑→橙→赤の順に大きくなり、目盛りは展示内の全年度で共通です。', 'Point color and size show annual means, increasing from blue through green and orange to red. Each exhibit uses one scale across all fiscal years.', '光点颜色与大小表示年度平均值，按蓝、绿、橙、红的顺序增大。每个展示的所有年度使用同一刻度。');
const airGuide = t('同じ測定局を選び、年度ごとの変化をたどれます。一般環境局・道路沿いの自排局などの区分と、観測期間も確認して比べましょう。', 'Follow the same station across fiscal years. Compare records alongside the station type, such as ambient or roadside, and monitoring coverage.', '选择同一监测站，追溯各年度变化。比较时留意一般环境站、道路旁站点等类型及监测时段。');
const waterGuide = t('光点か地域・地点を選び、同じ場所の変化をたどれます。河川・湖沼・海域の区分と水域名を確認し、記録のある年度を比べましょう。', 'Select a point or choose a region and site to follow the same location. Check its river, lake or coastal setting and water-body name, then compare available fiscal years.', '选择光点或地区与地点，追溯同一位置。确认河流、湖泊或海域类型及水域名称，比较有记录的年度。');
const entries = [
  [51,
    t('地上の測定局で捉えた、メタンCH₄の年度平均濃度です。炭素数で換算した原資料の単位ppmCで、各地点の空気をたどります。', 'Annual mean methane (CH₄) measured at ground-level stations. Follow local air records in the source unit ppmC, expressed on a carbon-atom basis.', '地面监测站测得的甲烷CH₄年度平均浓度。保留原资料按碳原子数换算的ppmC单位，追溯各地点的空气记录。'),
    t('メタンは炭素原子を一つ持つ炭化水素で、自然界の分解や人間の活動などから生じます。地上の同じ測定局を選び、背景濃度と地域の変化を考える手がかりにします。', 'Methane is a hydrocarbon with one carbon atom, arising from natural decomposition and human activities. Follow the same ground station for clues to background concentrations and local changes.', '甲烷是含一个碳原子的碳氢化合物，来源包括自然分解及人类活动。追溯同一地面站点，获得思考背景浓度与地区变化的线索。')],
  [52,
    t('メタンと、それ以外の炭化水素を含むTHCの年度平均濃度です。各成分に含まれる炭素の数で換算したppmCで表示します。', 'Annual mean total hydrocarbons (THC), including methane and other hydrocarbons. Concentrations are shown in ppmC on a carbon-atom basis.', '包含甲烷及其他碳氢化合物的THC年度平均浓度，以按各成分碳原子数换算的ppmC显示。'),
    t('51のCH₄、50のNMHCと同じ年度・測定局を見比べると、全体と成分の関係に目を向けられます。各展示では、それぞれの指標について公表された年度平均値を使っています。', 'Compare the same station and fiscal year with CH₄ in exhibit 51 and NMHC in 50 to explore the whole and its components. Each exhibit uses the published annual mean for its own measure.', '与展示51的CH₄、50的NMHC对照同一年度与站点，关注整体与成分的关系。各展示采用各自指标公布的年度平均值。')],
  [53,
    t('空気に浮かぶ粒子のうち、粒径10μm以下のSPMの年度平均濃度です。空気1m³に含まれる粒子の質量をmgで表します。', 'Annual mean suspended particulate matter (SPM), particles up to 10 μm in diameter. Values express milligrams of particles per cubic metre of air.', '空气中粒径10μm以下悬浮颗粒物SPM的年度平均浓度，表示每立方米空气中颗粒物的毫克数。'),
    t('1mg/m³は1,000μg/m³に相当します。54のPM2.5とは粒径の範囲と表示単位が異なるため、それぞれの目盛りを確かめながら、同じ測定局の年ごとの変化を比べます。', 'One mg/m³ equals 1,000 μg/m³. SPM and PM2.5 in exhibit 54 use different particle-size ranges and displayed units; check each scale when comparing changes at the same station.', '1mg/m³相当于1,000μg/m³。SPM与展示54的PM2.5在粒径范围和显示单位上不同，比较同一站点年度变化时请确认各自刻度。')],
  [54,
    t('粒径がおおむね2.5μm以下の小さな粒子、PM2.5の記録です。日平均値から集計した年度平均濃度を、μg/m³で表示します。', 'Records of fine particles roughly 2.5 μm or smaller: PM2.5. Annual mean concentrations compiled from daily means are shown in μg/m³.', '粒径约2.5μm以下的细颗粒物PM2.5记录。以μg/m³显示由日平均值汇总的年度平均浓度。'),
    t('燃焼で直接生じる粒子に加え、大気中の反応でできる粒子も含まれます。選択地点の有効測定日数とともに、2010年度からの年ごとの濃度の変化をたどれます。', 'Particles include those emitted directly by combustion and those formed by atmospheric reactions. Follow annual concentrations since fiscal year 2010 alongside each station’s valid monitoring-day count.', '既包含燃烧直接产生的颗粒，也包含大气反应形成的颗粒。结合所选站点的有效监测天数，追溯2010年度以来的浓度变化。')],
  [55,
    t('川の有機物などを微生物が分解するときに使う酸素量の指標、BODです。採水地点ごとの年度平均値をmg/Lで表示します。', 'BOD indicates the oxygen used by microorganisms to break down organic matter and other substances in river water. Annual site means are shown in mg/L.', 'BOD表示微生物分解河水中有机物等物质时消耗的氧量，以mg/L显示各采样地点的年度平均值。'),
    t('標準的なBODは、20℃で5日間に消費される酸素量を測ります。水1Lあたりの酸素要求量として読み、56のCODと測り方の違いに注目してみましょう。', 'Standard BOD measures oxygen consumed over five days at 20°C. Read it as oxygen demand per litre, and compare its measurement approach with COD in exhibit 56.', '标准BOD测量20℃下5天内消耗的氧量。将其理解为每升水的需氧量，并关注与展示56的COD测量方式的差异。')],
  [56,
    t('川の水に含まれる有機物などを、薬品で酸化するときの酸素要求量、CODです。公表された採水地点の年度平均値をたどります。', 'River COD measures the oxygen demand of chemically oxidizing organic matter and other substances in water. Follow published annual means at sampling sites.', '河流COD表示用化学药剂氧化水中有机物等物质所需的氧量，追溯公布的采样地点年度平均值。'),
    t('BODが微生物の働きに注目するのに対し、CODは化学的な酸化を利用する指標です。年代によって収録地点や年度が変わるため、同じ地点で記録のある年を比べます。', 'BOD focuses on microbial activity, while COD uses chemical oxidation. Site and year coverage varies over time; compare available years at the same location.', 'BOD关注微生物作用，COD采用化学氧化。不同年代收录的地点与年份有所变化，可比较同一地点有记录的年份。')],
  [57,
    t('湖や沼の有機物などを化学的に酸化するときの酸素要求量、CODです。湖内の採水地点ごとに、年度平均値の変化をたどります。', 'Lake COD indicates the oxygen demand of chemically oxidizing organic matter and other substances. Follow annual means at individual sampling sites within lakes.', '湖泊COD表示化学氧化有机物等物质所需的氧量，追溯湖内各采样地点年度平均值的变化。'),
    t('湖では、流れ込む物質に加え、湖内で増えるプランクトンなどもCODに関係します。水の滞留や採水場所に目を向け、同じ湖の中の違いを読みます。', 'Lake COD reflects incoming material as well as plankton growing within the lake. Consider water retention and sampling locations when exploring differences within one lake.', '湖泊COD既受流入物质影响，也与湖内生长的浮游生物等有关。观察同一湖泊内的差异时，留意水体滞留及采样位置。')],
  [58,
    t('水に溶けずに浮かぶ粒子の量、SSの年度平均濃度です。土砂や有機物などの質量を、水1Lあたりのmgで表示します。', 'Annual mean suspended solids (SS): particles suspended rather than dissolved in water. Values express milligrams of sediment, organic matter and other particles per litre.', '水中悬浮而未溶解的颗粒量SS的年度平均浓度，以每升水中的毫克数表示泥沙、有机物等颗粒的质量。'),
    t('雨による流入、川の流れ、底泥の巻き上がりなどが粒子の量に関わります。河川・湖沼・海域を区別し、同じ地点の記録から水中の粒子の変化をたどります。', 'Runoff, river flow and resuspension of bottom sediment influence particle amounts. Distinguish rivers, lakes and coastal waters, and follow changes at the same site.', '降雨径流、河流流动及底泥再悬浮等影响颗粒量。区分河流、湖泊和海域，通过同一地点的记录追溯变化。')],
  [59,
    t('水中の窒素を、有機態・無機態を合わせて測った全窒素T-Nの年度平均濃度です。水1Lあたりの窒素量をmgで示します。', 'Annual mean total nitrogen (T-N), combining organic and inorganic forms in water. Values express milligrams of nitrogen per litre.', '将水中有机态与无机态氮合计测得的全氮T-N年度平均浓度，表示每升水中的氮毫克数。'),
    t('窒素は生きものの栄養となり、りんや光、水の滞留とともにプランクトンの増殖に関わります。60の全りんと同じ地点・年度を見比べ、水域の栄養の変化を考えます。', 'Nitrogen is a nutrient; together with phosphorus, light and water retention, it influences plankton growth. Compare the same site and year with total phosphorus in exhibit 60.', '氮是生物的营养元素，与磷、光照及水体滞留共同影响浮游生物生长。可与展示60的全磷对照同一地点及年度。')],
  [60,
    t('水中のりんを、有機態・無機態を合わせて測った全りんT-Pの年度平均濃度です。水1Lあたりのりん量をmgで示します。', 'Annual mean total phosphorus (T-P), combining organic and inorganic forms in water. Values express milligrams of phosphorus per litre.', '将水中有机态与无机态磷合计测得的全磷T-P年度平均浓度，表示每升水中的磷毫克数。'),
    t('りんは窒素とともに生きものの栄養となります。小さな数値も読み取れるよう、0.001mg/Lは1μg/Lと考えられます。59の全窒素や湖のCODと、同じ場所の記録を見比べましょう。', 'Phosphorus and nitrogen are nutrients for living organisms. To interpret small values, 0.001 mg/L equals 1 μg/L. Compare the same location with total nitrogen in 59 or lake COD.', '磷与氮同为生物的营养元素。理解较小数值时，可参考0.001mg/L等于1μg/L。对照展示59的全氮或湖泊COD中同一地点的记录。')],
];
export const pollutionReadings = Object.freeze(Object.fromEntries(entries.map(([number, caption, explanation]) => [number, Object.freeze({
  caption, picker: caption, explanation, visualMap, qualityNote,
  readingBasis: number <= 54 ? airBasis : waterBasis,
  guide: number <= 54 ? airGuide : waterGuide,
  ...(number <= 54 ? {
    samplingWindow: number === 54
      ? t('日平均値から集計 · 年度平均', 'Compiled from daily means · Annual mean', '由日平均值汇总 · 年度平均')
      : t('全時間帯 · 年度平均', 'All hours · Annual mean', '全时段 · 年度平均'),
    coverageLabel: number === 54 ? t('有効測定日数の記録', 'Recorded valid monitoring days', '有效监测天数记录') : '観測時間の記録',
  } : { sourceRecordKind: 'water' }),
})])));
export const pollutionReadingTranslations = [
  ...translations,
  ['水域区分・水域名', 'Water setting and name', '水域类型与名称'],
  ['原資料の地点コード', 'Source station code', '原资料地点代码'],
  ['原資料の年度平均', 'Source annual mean', '原资料年度平均值'],
  ['原資料の有効測定日数(日): {value}', 'Source valid monitoring days: {value}', '原资料有效监测天数：{value}'],
];
