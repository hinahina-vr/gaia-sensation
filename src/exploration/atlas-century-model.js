// Distinct measurements with their own spatial and statistical meanings.
const wdi=code=>`https://data.worldbank.org/indicator/${code}`;
const terms='https://data.worldbank.org/summary-terms-of-use';
export const ATLAS_CENTURY_EXHIBITS=Object.freeze([
  {id:'oceanheat',number:'91',shortTitle:'海の奥にたまる熱',subtitle:'水面の下にも、温まる地球の記録がある',
    metric:'0–2,000mの海洋熱量偏差',legendMetric:'海域平均の熱量偏差（10²² J）',unit:'×10²² J',range:[-10,10],colors:['#408fba','#8896a1','#f9a664'],labels:['−10','0','+10'],view:'heatdepth',start:2005,end:2024,category:'世界 · 気候と炭素',organisation:'NOAA NCEI / Ocean Heat Content',
    source:'https://www.ncei.noaa.gov/access/global-ocean-heat-content/basin_heat_data.html',termsUrl:'https://www.noaa.gov/disclaimer',provenance:'SOURCE',
    guide:'NOAAの海域別年次熱量偏差。0–700mと0–2,000mの原系列を使い、700–2,000mは両者の差から算出。単位は10²²J、基準は1955–2006年の気候値。海面の色は3海域平均の0–2,000m熱量偏差を滑らかにつないだ描画です。流れる光は蓄熱を表す演出。地点の数値と分析は各海域の原値を使います。海域全体の集計で、海中の局所的な温度分布とは区別します。大西洋には北極海を含みます。0–2,000mの年次原本がそろう2005–2024年に限定。原本の標準誤差を保持し、深層差の誤差は共分散不明のため計算しません。',
    visualReading:'対応する海域の色と光に、海域全体の熱量の変化を重ねています。深さ別の値は詳細へ。'},
  {id:'ozone',number:'92',shortTitle:'南極の空を守るもの',subtitle:'春の空に開いた穴は、年ごとに姿を変える',
    metric:'南極オゾンホールの季節平均面積',unit:'百万km²',range:[0,30],colors:['#626e9c','#a695bf','#e0b9c5'],labels:['0','15','30'],view:'ozonearea',start:1979,end:2024,category:'世界 · 大気と汚染',organisation:'NASA Ozone Watch',provenance:'SOURCE',
    source:'https://ozonewatch.gsfc.nasa.gov/statistics/annual_data.html',termsUrl:'https://www.nasa.gov/nasa-brand-center/images-and-media/',
    guide:'NASA Ozone Watchの9月7日–10月13日の平均面積。南緯40度以南でオゾン全量220DU未満となる領域を集計。衛星欠損域にはNASAの同化データを利用しています。1995年は欠測のまま保持。南極域の光の強さに季節平均面積を重ねています。光は集計値に応じた模式描画で、各年のオゾンホール境界は原データで確認できます。併記する最低オゾン量は9月21日–10月16日の南半球最低値の平均で、面積とは集計期間が異なります。',
    visualReading:'南極域の空に重ねた光が、その春のオゾンホール面積に応じて変化します。'},
  {id:'glaciers',number:'93',shortTitle:'氷河が残す目盛り',subtitle:'一冬の雪と一夏の融け方が、長い時間を刻む',
    metric:'参照氷河の累積質量収支 · 1970年比',unit:'m水当量',range:[-30,0],colors:['#a6b7d8','#72bfcf','#d4f1eb'],labels:['−30','−15','0'],view:'glacierbalance',start:1970,end:2024,category:'世界 · 気候と炭素',organisation:'WGMS / 参照氷河',provenance:'SOURCE',
    source:'https://wgms.ch/global-glacier-state/',termsUrl:'https://wgms.ch/data_policy/',
    guide:'WGMS参照氷河の地域平均を等重みでまとめた質量収支指数。1970年を基準とする累積値をmmからm水当量へ換算。地図の氷河地形はNatural Earthの固定の分布です。色合いに参照氷河全体の収支指数を重ね、地形の形は年によって変更しません。年ごとの参照氷河数と年次収支も保持。観測対象の構成は年によって異なります。地図上の個々の氷河へ全球指数を割り当てません。',
    visualReading:'山地に残る氷河の地形に光を重ねています。全体の収支と年次推移は詳細・分析画面で読めます。'},
  {id:'volcanoes',number:'94',shortTitle:'山が目を覚ますとき',subtitle:'大地の営みを、その年、その場所の記録から',
    metric:'記録された噴火の件数',legendMetric:'火山爆発指数（VEI）',unit:'件',range:[0,8],colors:['#687b89','#e8b181','#f5d6a0'],labels:['VEI 0','VEI 4','VEI 8'],view:'events',start:1980,end:2024,category:'世界 · 大地の活動',organisation:'NOAA NCEI / Significant Volcanic Eruptions',provenance:'DERIVED',
    source:'https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/volcanoes',termsUrl:'https://www.noaa.gov/disclaimer',
    guide:'NOAAの重要火山事象カタログからeruption=trueの噴火を抽出。山形は記録された火山の位置、上に重なる段は火山爆発指数VEI。VEIは段階尺度で、噴煙の高さや噴出量の比例図ではありません。欠測VEIは山形のみで表示。国別の件数は対象事象を独自集計したもので、すべての噴火を網羅する頻度とは区別します。0件はこのカタログでの該当記録なしを意味します。',
    visualReading:'実際の火山の位置に山形が現れ、上の段が記録されたVEIを示します。'},
  {id:'tsunamis',number:'95',shortTitle:'岸に届いた波',subtitle:'海を渡った出来事を、発生の記録からたどる',
    metric:'確認された津波の対象件数',legendMetric:'確認された津波の発生位置',qualitativeLegend:true,unit:'件',range:[0,20],colors:['#547e96','#86c3d3','#d6eee6'],labels:['波の記号','沿岸観測高は詳細へ'],view:'events',start:1980,end:2024,category:'世界 · 大地の活動',organisation:'NOAA NCEI / Historical Tsunami Database',provenance:'DERIVED',
    source:'https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis',termsUrl:'https://www.noaa.gov/disclaimer',
    guide:'NOAAの津波カタログで確度4（確認済み）の事象を抽出。波の記号は記録された発生位置です。座標欠測の記録は件数に含め、地図には置きません。詳細の最大観測高は沿岸の水位・遡上高を含み、発生地点の波高とは区別します。地震・火山・崩壊などによる事象を含みます。年ごとの件数は対象の記録の集計で、観測網や記録の充実度にも左右されます。',
    visualReading:'波の記号が発生位置。地点を選ぶと日付と沿岸の最大観測高を確認できます。'},
  {id:'wateruse',number:'96',shortTitle:'水の行き先',subtitle:'畑へ、工場へ、暮らしへ。同じ水が役割を変える',
    metric:'農業向けの取水割合',unit:'%',range:[0,100],colors:['#466b72','#88bea1','#cce4b7'],labels:['農業','工業','生活'],view:'countries',start:2000,end:2022,category:'世界 · 水と森',organisation:'FAO AQUASTAT / World Bank WDI',source:wdi('ER.H2O.FWAG.ZS'),termsUrl:terms,
    guide:'総取水量に占める農業・工業・生活向けの割合。農業には灌漑・畜産を含みます。取水は水消費とは異なり、環境へ戻される水も含みます。原系列には報告・推計が混在。3部門がそろい、各値0–100%かつ合計が100±1ポイントの年だけ内訳を描画。外れた原値は保存し、画面では内訳の整合未確認と表示します。独自の100%正規化や欠測補間は行いません。',
    visualReading:'三つの枝の太さが農業・工業・生活の割合。左から同じ順に並びます。'},
  {id:'hunger',number:'97',shortTitle:'食卓まで届く量',subtitle:'食べもののある世界で、日々の必要量は満たされているだろう',
    metric:'栄養不足の人口割合 · 3年平均',unit:'%',range:[0,60],colors:['#a7b9a0','#d8b88b','#e7a58f'],labels:['0','30','60%以上'],view:'countries',start:2001,end:2024,category:'世界 · 食卓と世界',organisation:'FAO / World Bank WDI',source:wdi('SN.ITK.DEFC.ZS'),code:'SN.ITK.DEFC.ZS',termsUrl:terms,
    guide:'日常的な食事エネルギー摂取が必要水準に足りない人口の割合。FAOによる3年移動平均の推計で、各年単独の測定値とは区別します。WDIの2.5%は公表下限を表す場合があるため「2.5%以下」と表示し、正確な点推計として差分・統計分析に使いません。欠測は灰色。',
    visualReading:'皿の欠けた角度が栄養不足の割合。公表下限は斜線で示します。'},
  {id:'fisheries',number:'98',shortTitle:'獲る海、育てる水',subtitle:'食卓を支える水産物は、どこで生まれているだろう',
    metric:'漁獲と養殖の総生産量',unit:'万t',range:[0,1000],colors:['#447b93','#89cdb9','#dfd7aa'],labels:['0','500','1,000以上'],view:'countries',start:2000,end:2024,category:'世界 · 食卓と世界',organisation:'FAO / World Bank WDI',source:wdi('ER.FSH.CAPT.MT'),termsUrl:terms,provenance:'DERIVED',
    guide:'FAOの漁獲生産量と養殖生産量を国・地域別に合算し、tから万tへ換算。海洋と内水面、魚類・甲殻類・軟体動物・水生植物などを含みます。国の色と値は総生産量。漁獲と養殖の内訳は詳細と分析画面で比較します。片方が欠測の場合、総量も欠測として原値を保持します。国の規模の違いを含む総量です。',
    visualReading:'国の色が水産物の総生産量。漁獲と養殖の内訳は詳細へ。'},
  {id:'internet',number:'99',shortTitle:'つながる、その手前で',subtitle:'画面の向こうへ届く人と、まだ届かない人',
    metric:'インターネット利用者の人口割合',unit:'%',range:[0,100],colors:['#424e79','#9c9ece','#dbd5ef'],labels:['0','50','100%'],view:'countries',start:2000,end:2024,category:'世界 · 人口と暮らし',organisation:'ITU / World Bank WDI',source:wdi('IT.NET.USER.ZS'),code:'IT.NET.USER.ZS',termsUrl:terms,
    guide:'過去3か月に場所や端末を問わずインターネットを利用した人の割合。ITUの調査・推計をWDIから取得。接続可能な地域の面積や通信速度、ケーブル経路を示す値とは区別します。連なる線は人口割合を読むための図。灰色は欠測で、独自の補間は行いません。',
    visualReading:'結ばれていく線の長さが、インターネットを使った人口の割合です。'},
  {id:'refugees',number:'100',shortTitle:'故郷を離れて',subtitle:'ひとつの数の向こうに、続いていく暮らしがある',
    metric:'出身国別の難民人口 · UNHCR所管',unit:'人',range:[0,7000000],colors:['#67647c','#b5a9b0','#efdab7'],labels:['0','350万','700万以上'],view:'countries',start:2000,end:2024,category:'世界 · 人口と暮らし',organisation:'UNHCR Refugee Population Statistics Database / World Bank WDI',source:wdi('SM.POP.RHCR.EO'),code:'SM.POP.RHCR.EO',termsUrl:'https://www.unhcr.org/terms-use-datasets',
    guide:'UNHCR所管の難民と難民に類似する状況の人々を、出身国・地域別の年末人口として表示。庇護申請者・国内避難民・UNRWA所管のパレスチナ難民は含めません。年間の新規流出数とは異なります。図は人数を面積で比べる記号で、移動経路や現在の居場所を描いたものとは区別します。0と欠測を分け、独自の補間は行いません。',
    visualReading:'開いた扉の向こうの面積が、故郷の外で暮らす難民人口を表します。'},
].map(d=>Object.freeze({...d,century:true,signalLabel:d.metric,picker:`${d.organisation}の記録。${d.metric}をたどります。`,rawManifest:'data/atlas-history/century-sources.json'})));

export function centuryValue(d,row,format){
  if(row?.invalidComposition)return '内訳の整合未確認';
  if(row?.censored)return '2.5%以下';
  return Number.isFinite(row?.value)?`${format(row.value)} ${d.unit}`:'欠測';
}
export function centuryDetail(d,row,format){
  if(d.id==='oceanheat')return `上層 ${format(row?.upper)} / 深層 ${format(row?.deep)} · 標準誤差 ±${format(row?.se)}`;
  if(d.id==='ozone')return `平均最低オゾン ${format(row?.ozone)} DU · 9/21–10/16`;
  if(d.id==='glaciers')return `年次 ${format(row?.annual)} m水当量 / 参照氷河 ${row?.count??'—'}`;
  if(d.view==='events')return `記録位置 ${row?.located??0}件 / ${d.id==='volcanoes'?'VEI未記録':'最大観測高未記録'} ${row?.missingMagnitude??0}件`;
  if(d.id==='wateruse')return `農業 ${format(row?.agriculture)} / 工業 ${format(row?.industry)} / 生活 ${format(row?.domestic)} %`;
  if(d.id==='hunger')return row?.censored?'公表下限 · 点推計として分析しません':'日常的な食事エネルギーの不足 · 推計';
  if(d.id==='fisheries')return `漁獲 ${format(row?.capture)} / 養殖 ${format(row?.aquaculture)} 万t`;
  if(d.id==='refugees')return '出身国別の年末人口 · 年間流出数とは区別';
  return '国・地域の公表・推計値';
}
