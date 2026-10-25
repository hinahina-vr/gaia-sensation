// Map-only reading guidance for 61–70. Source values, scales and taxon names stay intact.
const translations = [];
const t = (ja, en, zh) => { translations.push([ja, en, zh]); return ja; };
const water = {
  readingBasis: t('環境省 · 公共用水域の年度記録', 'Ministry of the Environment · Annual water records', '日本环境省 · 公共水域年度记录'),
  visualMap: t('光点の色と大きさは年度平均値。青→緑→橙→赤の順に大きくなり、目盛りは展示内の全年度で共通です。', 'Point color and size show annual means, increasing from blue through green and orange to red. Each exhibit uses one scale across all fiscal years.', '光点颜色与大小表示年度平均值，按蓝、绿、橙、红的顺序增大。每个展示的所有年度使用同一刻度。'),
  qualityNote: t('灰色の輪：欠測・注記付きの記録', 'Gray rings: missing or qualified records', '灰色圆环：缺测或附注记录'),
  guide: t('地点を選ぶと、水域名と原資料の値を確認できます。「<」はその数値未満という記録。小さな値や注記も、そのまま読み取れます。', 'Choose a site to see the water-body name and original value. “<” records a value below the stated level; small values and qualifiers are preserved.', '选择地点查看水域名称和原始数值。“<”表示低于所示数值，微小数值与附注均按原样保留。'),
  sourceRecordKind: 'water',
};
const prtr = {
  readingBasis: t('環境省・経済産業省 / NITE · 事業所の年度届出', 'MOE / METI / NITE · Annual facility reports', '日本环境省、经济产业省 / NITE · 事业所年度申报'),
  visualMap: t('光点は事業所、色と大きさは届出量。桁の違いを対数目盛で表示し、光の動きで排出先・移動区分を表します。', 'Points mark facilities; color and size show reported quantities on a logarithmic scale. Motion symbolizes the release or transfer category.', '光点表示事业所，颜色与大小按对数刻度表示申报量，光的运动象征排放去向或转移类别。'),
  qualityNote: t('kg単位の届出物質を合計 · 対数目盛', 'Sum of substances reported in kg · Logarithmic scale', '合计以kg申报的物质 · 对数刻度'),
  guide: t('事業所を選び「物質別の内訳を見る」へ。分析では、選択年度の物質ごとの量を比較できます。年度間で事業所をつなぐ推定は行っていません。', 'Choose a facility, then open its substance breakdown. Analysis compares quantities by substance within the selected year; facilities are not inferred to match across years.', '选择事业所后查看物质明细。分析比较所选年度各物质的数量，不推定跨年度的事业所对应关系。'),
  sourceRecordKind: 'prtr',
};
const biology = {
  readingBasis: t('国土交通省 / 国総研 · 河川水辺の国勢調査', 'MLIT / NILIM · National Census on River Environments', '日本国土交通省 / 国总研 · 河流水边国势调查'),
  visualMap: t('光点は調査地区、色と大きさは確認分類群数。シルエットは調査対象の区分を表し、地区ごとの記録へ案内します。', 'Points mark survey districts; color and size show recorded taxon counts. Silhouettes identify the survey group and lead to each district’s records.', '光点表示调查地区，颜色与大小表示确认的分类群数。轮廓象征调查对象类别，引导查看各地区记录。'),
  qualityNote: t('原表の種コードを地区・年度ごとに重複除去', 'Source taxon codes deduplicated by district and year', '按地区与年度对原表分类代码去重'),
  guide: t('地区を選び「確認された名前を見る」へ。名前やコードで検索できます。年を比べるときは、調査された地区・季節・方法の違いにも目を向けましょう。', 'Choose a district to see recorded names and search by name or code. When comparing years, consider differences in surveyed districts, seasons and methods.', '选择地区查看确认名称，可按名称或代码搜索。比较年度时，请留意调查地区、季节与方法的差异。'),
  sourceRecordKind: 'biology',
};
const entries = [
  [61, water,
    t('水からn-ヘキサンで抽出される油分などの量です。採水地点ごとの年度平均値を、mg/Lでたどります。', 'Amounts of oils and other material extracted from water with n-hexane. Follow annual sampling-site means in mg/L.', '用正己烷从水中萃取的油分等物质量，以mg/L追溯各采样地点的年度平均值。'),
    t('水に含まれる抽出物の質量を測る指標です。検出下限未満の記録が多いため、色のついた点だけでなく、灰色の輪に残された原注記にも注目してみましょう。', 'This measure records the mass of extractable material in water. Many records fall below detection limits; inspect the original qualifiers in gray rings as well as colored points.', '该指标测量水中可萃取物的质量。许多记录低于检出限，除彩色光点外，也可查看灰色圆环保留的原始附注。')],
  [62, water,
    t('水に含まれる亜鉛の全量を測った、全亜鉛Znの年度平均濃度です。溶けた状態と粒子に含まれる分を合わせて読みます。', 'Annual mean total zinc (Zn) in water, including dissolved zinc and zinc contained in particles.', '水中全锌Zn的年度平均浓度，合计读取溶解态与颗粒物中所含的锌。'),
    t('単位はmg/L。0.001mg/Lは1μg/Lに相当します。同じ採水地点の記録をたどり、小さな濃度の変化と、測定下限の注記を確かめます。', 'Values use mg/L; 0.001 mg/L equals 1 μg/L. Follow the same sampling site to examine small concentration changes and measurement-limit qualifiers.', '单位为mg/L，0.001mg/L等于1μg/L。追溯同一采样地点，观察微小浓度变化并确认测量下限附注。')],
  [63, water,
    t('洗浄に使われる陰イオン界面活性剤の一群、LASの記録です。川・湖・海の採水地点で測られた年度平均濃度を表示します。', 'Records of LAS, a group of anionic surfactants used in cleaning. Explore annual mean concentrations at river, lake and coastal sampling sites.', '用于清洗的阴离子表面活性剂类LAS记录，显示河流、湖泊及海域采样地点的年度平均浓度。'),
    t('原資料の「直鎖アルキルベンゼンスルホン酸及びその塩」をmg/Lで表示します。水域名を確かめ、同じ地点で記録のある年度を比べてみましょう。', 'The source measure is linear alkylbenzene sulfonic acid and its salts, shown in mg/L. Check the water-body name and compare available years at the same site.', '原资料测量的是直链烷基苯磺酸及其盐，以mg/L显示。确认水域名称，比较同一地点有记录的年度。')],
  [64, water,
    t('水中のノニルフェノールを測った年度平均濃度です。微量の記録を、原資料の小数桁と注記を保って表示します。', 'Annual mean nonylphenol concentrations in water. Trace-level records retain the source decimal places and qualifiers.', '水中壬基酚的年度平均浓度，微量记录保留原资料的小数位与附注。'),
    t('ノニルフェノールは、一部の界面活性剤の分解などから生じる物質です。0.0001mg/Lは0.1μg/L。小さな数値も、地点ごとの原記録から読み取れます。', 'Nonylphenol can arise from the breakdown of certain surfactants. A value of 0.0001 mg/L equals 0.1 μg/L; inspect the original site records to read these trace amounts.', '壬基酚可由部分表面活性剂分解等过程产生。0.0001mg/L等于0.1μg/L，可从各地点原始记录读取这些微量数值。')],
  [65, prtr,
    t('事業所から大気へ排出されたと届け出られた化学物質の量です。2018〜2022年度の記録を、事業所ごとにkg/年度で表示します。', 'Reported quantities of chemicals released by facilities into the air. Explore facility records for fiscal years 2018–2022 in kg per year.', '事业所申报向大气排放的化学物质量，按事业所以kg/年度显示2018至2022年度记录。'),
    t('kg単位で届け出られた物質を合計しています。物質別の内訳を開くと、何がどれだけ報告されたかを確認できます。mg-TEQ単位のダイオキシン類は合計から除外しています。', 'Totals add substances reported in kg. Open the breakdown to see which chemicals were reported and in what quantities. Dioxins reported in mg-TEQ are excluded from the sum.', '合计以kg申报的物质。打开明细可确认报告的物质与数量，以mg-TEQ申报的二噁英类不计入合计。')],
  [66, prtr,
    t('事業所から川・湖・海などの公共用水域へ、排出されたと届け出られた量です。水色の光から、物質別の年度記録をひらきます。', 'Reported releases from facilities into public waters such as rivers, lakes and seas. Follow the blue light into annual substance-level records.', '事业所申报向河流、湖泊、海域等公共水域排放的数量。从水蓝色光点查看各物质的年度记录。'),
    t('地図は事業所の位置、数値はその年度の届出排出量です。採水地点の濃度を示す61〜64とは測る対象が異なります。内訳ではkg単位の物質ごとの量を確認できます。', 'The map locates facilities and shows their annual reported releases. This differs from sampling-site concentrations in exhibits 61–64. The breakdown lists quantities by substance in kg.', '地图标示事业所位置及其年度申报排放量，与展示61至64的采样地点浓度测量对象不同。明细列出各物质以kg计的数量。')],
  [67, prtr,
    t('事業所から下水道や、廃棄物として外へ移された化学物質の届出量です。二つの移動区分を合わせ、年度ごとにたどります。', 'Reported transfers of chemicals from facilities to sewers or off-site as waste. Follow the combined quantities of these two transfer categories by year.', '事业所申报转入下水道或作为废弃物转移至场外的化学物质量，合计这两类转移量并按年度查看。'),
    t('「物質別の内訳を見る」では、下水道への移動と廃棄物としての移動を分けて表示します。65・66の環境への排出と区別し、事業所の外へ向かう量を読みます。', 'The substance breakdown separates transfers to sewers from off-site waste transfers. Read these outward transfers separately from environmental releases in exhibits 65 and 66.', '物质明细分别显示转入下水道与作为废弃物转移的数量，与展示65、66向环境排放的数量区分读取。')],
  [68, biology,
    t('川底の昆虫や貝など、調査で確認された生きものの分類群数です。地区を選ぶと、原表に記録された名前をたどれます。', 'Counts of benthic taxa recorded in river surveys, including insects and molluscs. Choose a district to explore names preserved from the source lists.', '河流调查中确认的底栖昆虫、贝类等生物分类群数。选择地区可追溯原表记录的名称。'),
    t('同じ地区・年度の種コードを重複除去して数えています。種に加えて属・科までの同定も含む「分類群」の記録です。原表に複数の表記がある場合は、そのまま併記します。', 'Counts deduplicate taxon codes within each district and year. Identification may reach species, genus or family level, so these are taxon counts. Multiple source name variants are preserved together.', '按同一地区与年度对分类代码去重计数。鉴定层级包含种、属或科，因此采用分类群数。原表有多种名称写法时，按原样并列保留。')],
  [69, biology,
    t('河川の調査地区で確認された魚類の分類群数です。光点を選び、どんな魚の名前が記録されているかを見てみましょう。', 'Fish taxon counts recorded in river survey districts. Choose a point to discover which fish names appear in the records.', '河流调查地区确认的鱼类分类群数。选择光点，查看记录中出现的鱼类名称。'),
    t('同じ地区・年度の種コードを一つずつ数えた記録です。原表の名前とコードを組み合わせて確認でき、属などの同定や表記の違いも保持しています。', 'Each source taxon code is counted once per district and year. Explore names alongside codes; genus-level identifications and source spelling variants are retained.', '在同一地区与年度，每个原表分类代码计数一次。可对照名称与代码，属级鉴定及名称写法差异均予以保留。')],
];
export const recordReadings = Object.freeze(Object.fromEntries(entries.map(([number, group, caption, explanation]) => [number, Object.freeze({ ...group, caption, picker: caption, explanation })])));
export const foodBalanceReading = Object.freeze({
  caption: t('国ごとの食料の生産・輸入・輸出をたどります。9つの品目群から選び、重量ベースの品目別自給率を国土の色で比べます。', 'Explore food production, imports and exports by country. Choose among nine commodity groups and compare weight-based self-sufficiency through country colors.', '追溯各国食物的生产、进口与出口。从9类品目中选择，以国土颜色比较按重量计算的品目自给率。'),
  basis: t('FAOSTAT · 食料需給表 / 日本の農水省参照値', 'FAOSTAT · Food balance sheets / Japan MAFF reference data', 'FAOSTAT · 食物平衡表 / 日本农林水产省参考值'),
  map: t('青→緑→黄で自給率が高くなり、緑が100%。国と品目を選ぶと、生産・輸入・輸出の内訳を確認できます。', 'Self-sufficiency rises from blue through green to yellow; green marks 100%. Choose a country and commodity to inspect production, imports and exports.', '自给率按蓝、绿、黄递增，绿色表示100%。选择国家和品目可查看生产、进口与出口明细。'),
  key: t('国土の色：重量ベースの品目別自給率 · 灰色：算出・数値なし · 黄色の国境：選択国', 'Country color: commodity self-sufficiency by weight · Gray: unavailable · Yellow border: selected country', '国土颜色：按重量计算的品目自给率 · 灰色：无可用数值 · 黄色国界：所选国家'),
  formula: t('自給率 ＝ 生産 ÷（生産 ＋ 輸入 − 輸出）× 100', 'Self-sufficiency = Production ÷ (Production + Imports − Exports) × 100', '自给率 ＝ 生产 ÷（生产 ＋ 进口 − 出口）× 100'),
  guide: t('100%を超える値も表示します。旧・新FAOと農水省の参照値は、出典と年・年度を確認して読み分けましょう。推計・補完の区分は各数量に添えています。', 'Values above 100% are retained. Check the source and calendar or fiscal year to distinguish old and new FAO methods from MAFF reference data. Each quantity retains its estimation or imputation flag.', '保留超过100%的数值。请确认出处及年或年度，区分FAO新旧方法与农林水产省参考值。各数量均附有估算或补全标记。'),
});
export const recordReadingTranslations = [
  ...translations,
  ['事業所の年度届出', 'Annual facility reports', '事业所年度申报'],
  ['河川の生物確認記録', 'River biological survey records', '河流生物确认记录'],
  ['原整理番号', 'Source report ID', '原整理编号'], ['届出業種', 'Reported industry', '申报行业'],
  ['届出物質数（kg単位）', 'Reported substances (kg unit)', '申报物质数（kg单位）'],
  ['水系・河川名', 'River system and river', '水系与河流名称'], ['調査管理番号', 'Survey IDs', '调查管理编号'],
  ['確認分類群数', 'Recorded taxon count', '确认分类群数'],
  ['選択国・品目の原数量', 'Source quantities for country and commodity', '所选国家与品目的原始数量'],
  ['生産（千t）', 'Production (1,000 t)', '生产（千吨）'], ['輸入（千t）', 'Imports (1,000 t)', '进口（千吨）'], ['輸出（千t）', 'Exports (1,000 t)', '出口（千吨）'],
  ['出典・期間', 'Source and period', '出处与期间'], ['国・品目', 'Country and commodity', '国家与品目'],
  ['年次 · 9品目群から選択', 'Annual · Choose among nine commodity groups', '年度记录 · 从9类品目中选择'],
  ['事業所を選び、物質ごとの届出量を確認', 'Choose a facility to inspect reported quantities by substance', '选择事业所，查看各物质的申报量'],
];
