// Deployment cache marker: gaia-human-history-2.
(() => {
  "use strict";

  const JAPAN_NODES = [
    {
      name: "NAHA",
      nameJa: "那覇・南西諸島",
      lon: 127.68,
      lat: 26.21,
      description: "那覇のまわりには、暖かい海流、サンゴ礁、台風の通り道、観光都市があります。海の変化が暮らしに近い場所です。",
      relation: "関係する展示：07 海流と風、12 自然・社会・文化の三つの層。",
    },
    {
      name: "YAKUSHIMA",
      nameJa: "屋久島",
      lon: 130.52,
      lat: 30.36,
      description: "屋久島では、高い山に降った雨が古い森を通り、川になって海へ流れます。森と水のつながりを見やすい場所です。",
      relation: "関係する展示：08 森林と雨。",
    },
    {
      name: "ASO",
      nameJa: "阿蘇",
      lon: 131.1,
      lat: 32.88,
      description: "阿蘇の地形は火山活動によってできました。その上で草原、農業、湧水、集落の暮らしが続いています。",
      relation: "関係する展示：11 地震と大地の変化。",
    },
    {
      name: "NOTO",
      nameJa: "能登",
      lon: 136.9,
      lat: 37.3,
      description: "能登では、里山と里海、農業と漁業、祭りや集落の暮らしが近い距離で結ばれてきました。",
      relation: "関係する展示：09 資源の行方、12 自然・社会・文化の三つの層。",
    },
    {
      name: "TOKYO",
      nameJa: "東京",
      lon: 139.69,
      lat: 35.68,
      description: "東京には、遠くから食料、電力、水、物が集まり、大量のごみや排出も生まれます。都市と地球のつながりが見える場所です。",
      relation: "関係する展示：10 夜の光と排出量、13 エネルギー。",
    },
    {
      name: "SENDAI",
      nameJa: "仙台・三陸沿岸",
      lon: 140.87,
      lat: 38.27,
      description: "仙台と三陸沿岸は、海、川、平野、都市が接する地域です。災害の記録と、その後の防災やまちづくりが重なっています。",
      relation: "関係する展示：11 地震、12 自然・社会・文化の三つの層。",
    },
    {
      name: "NEMURO",
      nameJa: "根室・道東",
      lon: 145.58,
      lat: 43.33,
      description: "根室の暮らしは、寒流、湿原、漁業、渡り鳥など、国境を越えて動く海や生きものと深く関わっています。",
      relation: "関係する展示：07 海流と風。",
    },
  ];

  const JMA_CO2_SITES = Object.freeze([
    {
      id: "ryori",
      title: "綾里 CO₂観測所",
      shortTitle: "綾里",
      lon: 141.82,
      lat: 39.03,
      valueKey: "ryoriPpm",
      flagKey: "ryoriFlag",
      note: "岩手県大船渡市。1987年から続く気象庁の大気CO₂観測地点です。",
    },
    {
      id: "minamitorishima",
      title: "南鳥島 CO₂観測所",
      shortTitle: "南鳥島",
      lon: 153.98,
      lat: 24.28,
      valueKey: "minamitorishimaPpm",
      flagKey: "minamitorishimaFlag",
      note: "日本の最東端にある海洋上の観測地点。1993年からの年平均値を表示します。",
    },
    {
      id: "yonagunijima",
      title: "与那国島 CO₂観測所",
      shortTitle: "与那国島",
      lon: 123.02,
      lat: 24.47,
      valueKey: "yonagunijimaPpm",
      flagKey: "yonagunijimaFlag",
      observationEnded: 2024,
      note: "日本の最西端に近い観測地点。観測は2024年3月末で終了したため、最新年は直近の有効値を表示します。",
    },
  ]);

  const EARTH_NODES = [
    {
      name: "AMAZON",
      nameJa: "アマゾン流域",
      lon: -60,
      lat: -3,
      description: "アマゾンでは、広い森林と雨、大気、生きもの、人の暮らしが結びついています。遠く離れた地域での消費も、土地利用に影響します。",
      relation: "関係する展示：08 森林と雨、10 夜の光と排出量。",
    },
    {
      name: "ARCTIC",
      nameJa: "北極圏",
      lon: 20,
      lat: 74,
      description: "北極圏では、氷、海、大気の変化が互いに影響します。人の少ない地域ですが、その変化は世界の気候とつながっています。",
      relation: "関係する展示：06 CO₂と気温、12 自然・社会・文化の三つの層。",
    },
    {
      name: "SAHEL",
      nameJa: "サヘル",
      lon: 15,
      lat: 15,
      description: "サヘルでは、雨の量や時期が農業、牧畜、人の移動に大きく関わります。気候と暮らしを一緒に見るための地点です。",
      relation: "関係する展示：11 地球の変動、12 自然・社会・文化の三つの層。",
    },
    {
      name: "HIMALAYA",
      nameJa: "ヒマラヤ水系",
      lon: 85,
      lat: 28,
      description: "ヒマラヤの雪や氷河から流れ出す水は、国境を越える大きな川となり、上流から下流まで多くの暮らしを支えます。",
      relation: "関係する展示：07 水と風の循環。",
    },
    {
      name: "CORAL SEA",
      nameJa: "サンゴ海",
      lon: 150,
      lat: -18,
      description: "サンゴ海では、海水温の変化がサンゴや魚に影響し、沿岸の暮らしや観光にもつながります。",
      relation: "関係する展示：07 水と風の循環。",
    },
    {
      name: "ANDES",
      nameJa: "アンデス",
      lon: -70,
      lat: -22,
      description: "アンデスでは、鉱物資源、高地の水、生態系、鉱山の町が近くにあります。私たちが使う機器の材料が採られる地域の一つです。",
      relation: "関係する展示：09 資源の行方、13 エネルギーと人工物。",
    },
    {
      name: "SOUTHERN OCEAN",
      nameJa: "南大洋",
      lon: 30,
      lat: -55,
      description: "南大洋の海流は、熱と炭素を世界の海へ運びます。陸から遠く見えますが、地球の気候に大きく関わる海です。",
      relation: "関係する展示：06 CO₂と気温、07 海流と風。",
    },
  ];

  // Emergency-only geometry shown while the local Natural Earth reference is
  // loading or unavailable. The normal map uses the 1:50m coastline dataset.
  const SIMPLE_WORLD_LANDMASSES = [
    {
      label: "NORTH AMERICA",
      labelAt: [-106, 48],
      points: [
        [-168, 72], [-150, 70], [-136, 60], [-128, 52], [-124, 42],
        [-117, 32], [-106, 24], [-97, 18], [-86, 20], [-81, 26],
        [-82, 31], [-75, 38], [-66, 45], [-60, 53], [-67, 59],
        [-79, 63], [-91, 70], [-108, 73], [-127, 72], [-148, 76],
      ],
    },
    {
      label: "SOUTH AMERICA",
      labelAt: [-60, -20],
      points: [
        [-81, 12], [-70, 10], [-60, 7], [-50, 2], [-45, -10],
        [-40, -23], [-48, -29], [-52, -41], [-66, -55], [-74, -50],
        [-76, -35], [-80, -20], [-78, -5],
      ],
    },
    {
      label: "EURASIA",
      labelAt: [73, 49],
      points: [
        [-11, 36], [-10, 44], [1, 51], [12, 57], [26, 60],
        [41, 69], [61, 72], [82, 72], [103, 77], [126, 72],
        [150, 61], [171, 60], [179, 52], [169, 45], [151, 42],
        [144, 35], [135, 34], [125, 25], [115, 20], [105, 8],
        [98, 5], [92, 20], [80, 22], [70, 27], [60, 24],
        [52, 30], [44, 28], [36, 36], [25, 40], [15, 36],
        [6, 43], [-4, 42],
      ],
    },
    {
      label: "AFRICA",
      labelAt: [20, 5],
      points: [
        [-17, 37], [0, 35], [15, 33], [32, 30], [42, 12],
        [50, 2], [44, -12], [35, -25], [28, -34], [18, -35],
        [10, -28], [2, -10], [-8, 5], [-16, 20],
      ],
    },
    {
      label: "AUSTRALIA",
      labelAt: [134, -25],
      points: [
        [112, -11], [130, -10], [145, -18], [153, -28],
        [146, -39], [132, -43], [116, -35], [110, -22],
      ],
    },
    {
      label: "GREENLAND",
      labelAt: [-41, 72],
      points: [
        [-55, 83], [-25, 80], [-18, 70], [-35, 60], [-52, 64], [-62, 74],
      ],
    },
    {
      label: "ANTARCTICA",
      labelAt: [28, -76],
      points: [
        [-180, -70], [-145, -72], [-110, -73], [-70, -70], [-30, -75],
        [10, -72], [48, -68], [88, -70], [128, -66], [162, -71],
        [180, -70], [180, -84], [-180, -84],
      ],
    },
  ];

  const SIMPLE_WORLD_ISLAND_LINES = [
    [[130, 31], [133, 33], [136, 35], [139, 37], [141, 41], [145, 44]],
    [[166, -35], [173, -41], [178, -46]],
    [[-9, 51], [-4, 55], [0, 58]],
    [[47, -13], [49, -20], [46, -25]],
  ];

  const JMA_EVENT_TITLES = {
    20110311144618: "東北地方太平洋沖地震",
    20160416012505: "熊本地震",
    20180906030759: "北海道胆振東部地震",
    20240101161022: "能登半島地震",
    20240417231448: "豊後水道の地震",
    20240808164255: "日向灘の地震",
  };

  const INTRO_PATHS = {
    abstract: {
      kicker: "Abstract mode / Touch the signal",
      title: "どの感覚に、<br />触れますか？",
      lead: "地球が発している9つの信号から、最初に触れるものを選んでください。指やマウスの動きに、光が応答します。",
      prompt: "最初に触れる感覚器を選ぶ",
      note: "マウスを重ねると説明が変わります。クリックすると、選んだ光をすぐに始めます。",
    },
    map: {
      kicker: "Map mode / Read the planet",
      title: "どの信号を、<br />地図で読みますか？",
      lead: "毎日の空気、使う電気、移り変わる街。暮らしや生きものとのつながりから展示を選び、何が記録され、何は分からないのかを確かめます。",
      prompt: "最初に地図へ重ねる感覚器を選ぶ",
      note: "マウスを重ねると説明が変わります。クリックすると、その信号の地図をすぐに開きます。",
    },
    novel: {
      kicker: "Story mode / Listen to the planet",
      title: "どこから、<br />物語を始めますか？",
      lead: "毎週オンラインで話していたミズハとアマネが、海の近くで初めて出会います。二人は、待ち合わせに来ないサクヤが残した9つの観測記録をたどりながら、人間と地球のこれからを探します。最初から読むなら「01 空気」を選んでください。",
      prompt: "物語を始める場面を選ぶ",
      note: "カードにマウスを重ねると、その場面のあらすじが表示されます。クリックすると、選んだ場面から始まります。",
    },
    space: {
      kicker: "Space mode / Read the cosmos",
      title: "どの宇宙の信号を、<br />観測しますか？",
      lead: "NASA・JPL・JAXAから取得して作品内に保存した記録です。太陽から系外惑星まで、最初に開く観測窓を選んでください。",
      prompt: "最初に見る宇宙の観測窓を選ぶ",
      note: "マウスを重ねると説明が変わります。クリックすると、その観測窓をすぐに開きます。表示は保存済みデータです。",
    },
  };

  const INTRO_MODE_CHOICES = [
    {
      label: "空気",
      cue: "CO₂と気温",
      code: "AIR",
      copy: "CO₂が季節ごとに上下しながら、長い目では増えてきた様子を見る。",
    },
    {
      label: "海",
      cue: "海流の14日移動",
      code: "OCEAN",
      copy: "ある一日の海流が変わらないと仮定し、0〜14日後の移動距離をたどる。白い風矢印は比較用です。",
    },
    {
      label: "森",
      cue: "森林と雨",
      code: "FOREST",
      copy: "森林だけを緑で強調し、世界の参照地点の雨量と同じ場所で見比べる。",
    },
    {
      label: "ごみ",
      cue: "再資源化率を比べる",
      code: "RECYCLING",
      copy: "公表値のある国・地域を切り替え、再資源化率の公表値と報告年を比べる。",
    },
    {
      label: "都市",
      cue: "1945年からの排出",
      code: "CITY",
      copy: "1945年からの国別化石燃料由来CO₂を年送りし、2016年の夜間光と見比べる。",
    },
    {
      label: "地震",
      cue: "地球の揺れ",
      code: "QUAKE",
      copy: "世界の大地震と、日本各地で実際に記録された揺れをたどる。",
    },
    {
      label: "暮らし",
      cue: "三つの生態系",
      code: "ECOLOGIES",
      copy: "都市人口率が近い二国を比べ、森の割合の違いと、数字にできない場所の意味を見る。",
    },
    {
      label: "エネルギー",
      cue: "太陽と風",
      code: "ENERGY",
      copy: "国土の青で再生可能エネルギー発電割合を比べ、選択国の日差しと風を補足で見る。",
    },
    {
      label: "人口",
      cue: "1960年からの変化",
      code: "POPULATION",
      copy: "世界の国・地域の人口を年ごとに送り、増え方と減り方を同じ面積尺度で比べる。",
    },
  ];

  // Picker copy connects the signal to everyday life, then names its evidence
  // and limits. Exhibition titles and detailed data notes stay in the catalogs.
  const MAP_MODE_DESCRIPTIONS = Object.freeze({
    "japan-marine-cod": "海の水質は、沿岸の生きものや暮らしとどう関わる？ 公共用水域のCOD年度平均値を地点ごとにたどります。酸欠や汚染の広がりを示す地図ではありません。",
    "nasa-firms-active-fire": "火が広がれば、生きもののすみかも人の暮らしも脅かされます。衛星の火災・熱異常の検知をたどります。光点から焼失面積や被害は分かりません。",
    "global-wind-pressure": "遠くから運ばれる熱や水も、風のつながりの中にあります。風速・風向・気圧の気象モデル値を比べます。光の筋は実際の移動経路ではありません。",
    "global-aerosol-light": "空を漂う微粒子は、吸う空気と届く光に関わります。PM2.5と光学的厚さのモデル値を霞で比較します。汚染源や個人の健康被害は分かりません。",
    "usgs-earthquake-ripples": "揺れる大地で暮らすために、まず起きた場所を知る。USGSの直近24時間の地震をたどります。光の輪は震度や被害の範囲ではありません。",
    "global-cloud-radiance": "雲が遮り、通す光は、地上の暖かさや植物の暮らしに関わります。雲量と日射のモデル値を見る展示です。現在の衛星写真ではありません。",
    "breathing-earth": "日々のエネルギー利用ともつながるCO₂の蓄積。1958年からの濃度をたどり、観測・再構成・未来の試算を分けて読みます。",
    "blue-circulation": "海流は熱や生きものを運び、遠くの海をつなぎます。一日の海流の速さと向きを固定した14日間の試算です。漂流の予報ではありません。",
    "forest-cloud-engine": "森と雨の関係は、水と生きものの居場所を考える手がかりです。森林分布と世界の参照地点の雨量を比較します。この重なりだけで因果は分かりません。",
    "nothing-is-waste": "使い終えたものを、次の資源へ戻せるか。国連91地域に世界銀行54地域を補足。年度・対象・分母の違いに注意し、未収録はゼロや推定値で埋めません。",
    "anthropocene-scar": "街の明かりを支える暮らしと、積み重なった排出。1945年からの国別CO₂と2016年の夜間光を比べます。明るさを排出量へ換算する地図ではありません。",
    "rhythm-of-disaster": "大きな揺れへの備えを、記録から考える。2000年以降の世界M7.5以上の地震をたどります。輪は揺れの学習用の目安で、被害予測ではありません。",
    "three-ecologies": "街も森も、誰かの居場所です。都市人口率と森林率を世界の国・地域で比べ、文化や記憶も別に見つめます。二つの割合だけでは暮らしの質や因果は分かりません。",
    "earth-organ": "暮らしを支える電気を、何からつくるか。再生可能エネルギーの発電割合を国別に比べます。値の年は国ごとに異なり、太陽や風だけで割合は決まりません。",
    "population-tide": "人口が変わると、暮らしを支える仕組みも問い直されます。1960年から217の国・地域の人口を追います。人口の多さを豊かさや環境負荷とはみなしません。",
    "wind-field": "風が違えば、外での一日も変わります。代表都市の風速モデル値を県の色で比べます。都道府県平均や風向ではありません。",
    "carbon-pulse": "身近な空も、地球の大気の一部です。代表都市のCO₂濃度予測を県の色で比べます。都道府県平均、排出量、室内濃度ではありません。",
    "rain-chorus": "雨は水を届け、街の予定も変えます。代表都市の降水モデル値を県の色で比べます。都道府県平均や洪水・浸水の範囲ではありません。",
    "temperature-field": "外での過ごし方や冷暖房とつながる気温。代表都市の地上2m気温モデル値を県の色で比べます。都道府県平均や個人の危険度ではありません。",
    "cloud-drift": "雲の多さが、街の日なたと日陰を変えます。代表都市の総雲量モデル値を県の色で比べます。都道府県平均や空の写真ではありません。",
    "pm25-haze": "毎日吸う空気に、どれだけ微粒子が混じるのか。代表都市のPM2.5濃度予測を県の色で比べます。都道府県平均、曝露量、健康被害ではありません。",
    "estat-migration": "人が集まる土地、離れていく土地。交通や住まいの支えはどう変わる？ 都道府県の年ごとの転入超過を比べます。移動の理由や人口全体の増減は示しません。",
    "estat-lodging": "旅する人を迎える土地の、仕事と暮らしを考える。都道府県別の年ごとの延べ宿泊者数を比べます。旅行者の実人数や観光収入ではありません。",
    "estat-housing": "新しい住まいが、街の選択肢を変えていきます。都道府県ごとの月別住宅着工戸数を比べます。完成した戸数や空き家、必要な住宅数を示す値ではありません。",
    "estat-average-temperature": "住み慣れた土地の気温は、長い時間でどう変わった？ 1955年から代表観測地点の年平均気温を比べます。県全域の平均や変化の原因を表す値ではありません。",
    "estat-summer-high": "外で働く時間や作物の環境を、日々の高い気温から考える。毎日の最高気温を一年で平均した値を比べます。夏だけの平均や一年の最高記録ではありません。",
    "estat-winter-low": "暖房を使う暮らしや生きものの環境を、低い気温から考える。毎日の最低気温を一年で平均した値を比べます。冬だけの平均や一年の最低記録ではありません。",
    "estat-relative-humidity": "空気の湿りは、住まいや植物の環境に関わります。都道府県の代表地点の年平均相対湿度を比べます。空気中の水の量や、今日の蒸し暑さとは異なる値です。",
    "estat-sunshine-hours": "日差しを受け取る時間は、作物や暮らしに関わります。代表地点の年間日照時間を比べます。日射エネルギーや太陽光の発電量を示す値ではありません。",
    "estat-precipitation": "雨や雪が届ける水は、田畑と暮らしと生きものを支えます。代表地点の年間降水量を比べます。雨の降り方や洪水・渇水の被害は、この総量だけでは分かりません。",
    "estat-rainy-days": "雨の多い暦は、外の仕事や暮らしの予定に関わります。代表地点の年間雨日数を比べます。雨が降らなかった日が、すべて晴れだったとは限りません。",
  });

  // Why enter this exhibition? Shared by the chapter separator and map header.
  // Data sources, measurements and limits belong in the picker and full body.
  const MAP_TITLE_SUBTITLES = Object.freeze({
    "01": "熱や水を運ぶ風が、遠くの空と暮らしをつなぐ",
    "02": "足もとの変動を知り、揺れに備える暮らしを考える",
    "03": "空を漂う微粒子は、吸う空気と届く光に関わる",
    "04": "生きもののすみかと暮らしを脅かす火を、観測から考える",
    "05": "雲が変える日差しは、地上の暖かさと生命に関わる",
    "06": "空気に残る炭素は、私たちが暮らす気候に関わる",
    "07": "熱や生きものを運ぶ海流が、遠くの海をつなぐ",
    "08": "森と雨から、生きものと暮らしを支える水を考える",
    "09": "捨てればごみ、戻せば資源。使い終えた先を変える",
    "10": "便利な暮らしを支えるエネルギーは、何を残すのか",
    "11": "大地震の記録から、備えを受け継ぐ意味を考える",
    "12": "住まう場所を、生態系・社会・文化から見つめ直す",
    "13": "暮らしを支える電気を、何からつくるか",
    "14": "人の数の変化は、住まいと暮らしの支えに関わる",
    "15": "同じ日の風も街ごとに違い、移動や仕事に関わる",
    "16": "身近な空のCO₂から、地球の気候とのつながりを考える",
    "17": "雨は水を届け、街で過ごす一日の段取りも変える",
    "18": "気温の違いは、外での過ごし方や使う電力に関わる",
    "19": "雲がつくる日なたと日陰が、暮らしの明るさを変える",
    "20": "街の空気に混じる微粒子を、毎日の呼吸から考える",
    "21": "人が移ると、交通や住まいを支える仕組みはどう変わる？",
    "22": "訪れる人を迎える街で、仕事と暮らしはどう重なる？",
    "23": "新しい住まいは、街のかたちや暮らしの選択肢に関わる",
    "24": "長い気温の変化から、暮らしと生きものの環境を考える",
    "25": "日々の高い気温から、外での仕事や作物の環境を考える",
    "26": "日々の低い気温から、暖房や生きものの環境を考える",
    "27": "空気の湿りは、住まいの過ごしやすさや植物に関わる",
    "28": "日が差す時間は、作物の育ちや日々の過ごし方に関わる",
    "29": "雨や雪が届ける水は、田畑と生きものと暮らしを支える",
    "30": "雨が降る日の多さは、外の仕事や日々の予定に関わる",
    "31": "沿岸の水質の記録から、生きものと暮らしの海を考える",
  });

  const SPACE_MODE_CHOICES = [
    { label: "太陽の閃光", cue: "フレア等級", code: "FLARE", copy: "2024年5月に記録された太陽フレアを、等級に応じて開く光として見る。" },
    { label: "太陽風の波", cue: "CME速度", code: "CME", copy: "太陽から放たれたプラズマの速度と広がりを、宇宙を横切る円弧として見る。" },
    { label: "磁気圏の嵐", cue: "Kp指数", code: "Kp", copy: "太陽活動で地球の磁場が揺さぶられた強さを、曲がる磁力線として見る。" },
    { label: "太陽から届く粒子", cue: "SEP通知", code: "SEP", copy: "観測機器が高エネルギー粒子を捉えた時刻を、細い光の雨として見る。" },
    { label: "近づく小惑星", cue: "最接近距離", code: "NEO", copy: "2024年に月軌道の内側へ近づいた小惑星を、地球をかすめる軌道として見る。" },
    { label: "大気に燃える火球", cue: "推定エネルギー", code: "BOLIDE", copy: "大気中で強く光った天体の場所とエネルギーを、流星と残光として見る。" },
    { label: "近くの惑星系", cue: "星までの距離", code: "EXO NEAR", copy: "太陽系の外で確認された惑星を、地球から近い順の同心円で見る。" },
    { label: "地球サイズの世界", cue: "半径と平衡温度", code: "EXO EARTH", copy: "大きさと平衡温度が設定範囲に入る系外惑星を、生命判定とは分けて見る。" },
    { label: "リュウグウの地形", cue: "JAXA LIDAR", code: "RYUGU", copy: "はやぶさ2のレーザー高度計が測った距離と表面位置を、凹凸のある輪郭で見る。" },
    { label: "宇宙の感覚神経系", cue: "八つの公開資料", code: "COSMOS", copy: "太陽、地球近傍、小惑星、系外惑星の違う信号を、合計せず一つの網へ重ねる。" },
  ];

  const modes = [
    {
      id: "breathing-earth",
      mapNumber: "06",
      title: "Breathing Earth",
      titleJa: "積み重なるCO₂",
      description: "NOAAとGOSATのCO₂濃度を時間順にたどり、過去の再構成と未来の試算を観測から区別します。極域の光はNOAA SWPCの30〜90分先のオーロラ予報です。CO₂とオーロラの因果関係を示す展示ではありません。",
      accent: "#8ed8ff",
      rgb: "142, 216, 255",
      source: `
vec3 modeBreathingEarth(vec2 p, float t, vec2 response, float memory) {
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float breath = 0.5 + 0.5 * sin(t * 0.52);
  float membrane = lineGlow(radius - (0.48 + breath * 0.07), 0.024);
  float innerPulse = lineGlow(
    radius - fract(t * 0.12 + response.y * 0.08) * 1.05,
    0.025
  );
  float meridian = lineGlow(
    sin(angle * 7.0 + radius * 3.0 - t * 0.18),
    0.032
  ) * smoothstep(0.68, 0.12, radius);
  float livingVein = lineGlow(
    sin(p.x * 7.2 + p.y * 2.4 + fbm(p * 2.1) * 3.0 - t * 0.24),
    0.038
  );
  float reply = response.x * (0.65 + breath * 0.35);
  float density = membrane * 0.74 + innerPulse * 0.24
    + meridian * 0.24 + livingVein * 0.16 + reply;
  vec3 background = baseGradient(p, vec3(0.02, 0.11, 0.18));
  vec3 cool = mix(vec3(0.16, 0.48, 0.68), vec3(0.58, 0.9, 1.0), breath);
  return background + cool * density
    + vec3(0.48, 0.7, 1.0) * response.y * 0.28
    + vec3(0.1, 0.36, 0.44) * memory * membrane * 0.18;
}
`.trim(),
    },
    {
      id: "blue-circulation",
      mapNumber: "07",
      title: "Blue Circulation",
      titleJa: "海は、どこへ運ぶ",
      description: "NOAA CoastWatchのある一日の海流を使い、速さと向きが変わらない場合の0〜14日後の移動距離を示します。白い矢印は比較用のNASA POWERの平均風で、距離計算には使いません。漂流や未来の海況の予報ではありません。",
      accent: "#63e3ff",
      rgb: "99, 227, 255",
      source: `
float currentBrushBody(float signedDistance, float halfWidth, float roughness) {
  float roughWidth = halfWidth * mix(0.82, 1.16, roughness);
  float edge = abs(signedDistance) / max(roughWidth, 0.001);
  return 1.0 - smoothstep(0.8, 1.025, edge);
}

float currentBrushBristles(float signedDistance, float halfWidth, float phase) {
  float across = signedDistance / max(halfWidth, 0.001);
  float broadFibers = pow(0.5 + 0.5 * cos(across * 5.6 + phase), 3.4);
  float fineFibers = pow(0.5 + 0.5 * cos(across * 17.0 - phase * 0.47), 9.0);
  return broadFibers * 0.76 + fineFibers * 0.24;
}

vec3 modeBlueCirculation(vec2 p, float t, vec2 response, float memory) {
  // Every uploaded NOAA POI still owns a measured brush stroke. A continuous
  // inverse-distance field underneath blends the observed vectors between
  // points, so the sea reads as one current rather than isolated brush marks.
  // The date slider changes the calculated displacement only; pigment keeps
  // flowing inside the fixed brush shapes even while that slider is held.
  float currentEnergy = clamp(uSignal.x * 0.58 + uSignal.y * 0.42, 0.0, 1.0);
  float contourTime = t * 0.055;
  float pigmentTime = t * mix(0.78, 1.5, currentEnergy);
  float waterPaper = fbm(p * 1.35 + vec2(contourTime * 0.08, -contourTime * 0.045));
  float waterGrain = fbm(p * 6.4 + vec2(-pigmentTime * 0.035, pigmentTime * 0.018));
  vec3 poiInk = vec3(0.0);
  vec3 poiLight = vec3(0.0);
  float poiCoverage = 0.0;

  for (int i = 0; i < 96; i++) {
    if (i >= uCurrentSampleCount) break;
    vec4 observed = uCurrentSamples[i];
    float measuredSpeed = clamp(observed.z, 0.0, 1.0);
    // rot(a) is the world-to-local matrix in GLSL column-major order.
    // Passing the observed angle directly makes local +X follow the same
    // east/north vector as the canvas strand and its advected destination.
    vec2 local = rot(observed.w) * (p - observed.xy);
    float pointPhase = fract(sin(float(i) * 91.731 + 0.37) * 43758.5453);
    float backReach = mix(0.06, 0.11, measuredSpeed);
    float forwardReach = mix(0.42, 0.78, measuredSpeed);
    // Outside this conservative bound both the stroke and its source bloom
    // are invisible. Keep the original paint, skip its costly trigonometry.
    if (local.x < -backReach - 0.09 || local.x > forwardReach + 0.09 || abs(local.y) > 0.19) continue;
    float strokeProgress = (local.x + backReach) / (forwardReach + backReach);
    float longitudinal = smoothstep(-0.015, 0.055, strokeProgress)
      * (1.0 - smoothstep(0.88, 1.02, strokeProgress));
    float pressure = pow(max(0.0, sin(clamp(strokeProgress, 0.0, 1.0) * 3.14159265)), 0.38);
    pressure *= mix(0.7, 1.08, 0.5 + 0.5 * sin(strokeProgress * 8.0 + pointPhase * 6.283));
    float width = mix(0.018, 0.052, measuredSpeed);
    float curl = sin(
      strokeProgress * mix(4.6, 7.2, pointPhase)
        + pointPhase * 6.283
        + contourTime * mix(0.22, 0.48, measuredSpeed)
    ) * width * mix(0.55, 1.22, pointPhase);
    curl += sin(strokeProgress * 13.0 - pointPhase * 4.7) * width * 0.16;
    curl *= smoothstep(0.0, 0.2, strokeProgress)
      * (1.0 - smoothstep(0.8, 1.05, strokeProgress));
    float localDistance = local.y - curl;
    float roughness = 0.5 + 0.5 * sin(
      local.x * mix(34.0, 52.0, pointPhase)
        + local.y * 21.0
        + float(i) * 2.37
    );
    float stroke = currentBrushBody(
      localDistance,
      width * max(0.14, pressure),
      roughness
    ) * longitudinal;
    float bristle = currentBrushBristles(
      localDistance,
      width * max(0.28, pressure),
      strokeProgress * 8.0 - pigmentTime * 0.92 + float(i) * 0.71
    ) * stroke;
    float travelingPigment = 0.5 + 0.5 * sin(
      strokeProgress * mix(13.0, 8.0, measuredSpeed)
        - pigmentTime * mix(2.5, 5.8, measuredSpeed)
        + pointPhase * 9.0
    );
    float wetPulse = pow(0.5 + 0.5 * cos(
      strokeProgress * 18.0
        - pigmentTime * mix(3.4, 7.2, measuredSpeed)
        + float(i) * 1.13
    ), 5.0);
    float dryGap = smoothstep(0.34, 0.78, waterGrain + roughness * 0.22);
    float deposit = stroke * mix(0.58, 1.08, dryGap);

    vec3 slowInk = vec3(0.16, 0.25, 0.92);
    vec3 middleInk = vec3(0.04, 0.9, 1.05);
    vec3 fastInk = vec3(1.15, 0.5, 0.12);
    vec3 speedInk = mix(slowInk, middleInk, smoothstep(0.08, 0.58, measuredSpeed));
    speedInk = mix(speedInk, fastInk, smoothstep(0.62, 0.96, measuredSpeed));
    vec3 movingInk = mix(speedInk * 0.52, speedInk * 1.22, travelingPigment);
    vec3 pearlInk = mix(vec3(0.42, 0.9, 1.16), vec3(1.24, 0.9, 0.42), measuredSpeed);
    poiInk += movingInk * deposit * mix(0.62, 1.08, measuredSpeed);
    poiLight += pearlInk * (bristle * 0.32 + wetPulse * stroke * 0.7);
    poiCoverage += stroke;

    // A small source bloom is registered exactly at the clickable POI above.
    float sourceRadius = mix(0.012, 0.022, measuredSpeed);
    float sourceBloom = exp(-dot(local, local) / max(sourceRadius * sourceRadius, 0.00001));
    poiLight += pearlInk * sourceBloom * (0.28 + measuredSpeed * 0.42);
  }

  // The underpainting follows integrated, interpolated u/v streamlines.
  // Geography-anchored Fourier terms let pigment flow with two texture reads;
  // no per-pixel all-POI interpolation and no per-frame particle simulation.
  vec2 geo = uCurrentGeoView.xy + p * uCurrentGeoView.z;
  vec2 fieldUv = (geo + vec2(180.0, 90.0)) / vec2(360.0, 180.0);
  vec4 vectorField = texture(uCurrentVectorField, fieldUv);
  vec4 weave = texture(uCurrentWeave, fieldUv);
  float localSpeed = clamp(vectorField.a / 1.5, 0.0, 1.0);
  float fieldPresence = weave.a * uCurrentWeaveReady;
  float phase = t * 0.72;
  float travelingWeave = (weave.g - 0.5) * cos(phase) - (weave.b - 0.5) * sin(phase);
  float wetLanes = smoothstep(0.18, 0.84, weave.r + travelingWeave * 0.65);
  float continuousCoverage = fieldPresence * (0.16 + wetLanes * 0.92);
  vec3 fieldInk = mix(vec3(0.07, 0.22, 0.62), vec3(0.025, 0.62, 0.79),
    smoothstep(0.04, 0.45, localSpeed));
  fieldInk = mix(fieldInk, vec3(0.52, 0.83, 0.65), smoothstep(0.50, 0.96, localSpeed));
  vec3 continuousSea = fieldInk * continuousCoverage;
  vec3 continuousLight = vec3(0.12, 0.48, 0.62) * fieldPresence
    * pow(max(0.0, wetLanes), 3.0) * 0.26;
  vec3 background = baseGradient(p, vec3(0.001, 0.035, 0.08));
  background += mix(vec3(0.0, 0.025, 0.07), vec3(0.0, 0.09, 0.13), waterPaper) * 0.32;
  vec3 paintedSea = continuousSea
    + continuousLight
    + min(poiInk, vec3(1.72)) * 0.48
    + min(poiLight, vec3(1.35)) * 0.7;
  float softCoverage = min(poiCoverage, 2.0);
  return background
    + paintedSea
    + vec3(0.02, 0.16, 0.26) * softCoverage * (0.08 + memory * 0.08)
    + vec3(0.22, 0.82, 0.9) * response.x * 0.18
    + vec3(0.72, 0.9, 1.0) * response.y * 0.08;
}
`.trim(),
    },
    {
      id: "forest-cloud-engine",
      mapNumber: "08",
      title: "Forest & Rain",
      titleJa: "森と水のつながり",
      description: "2023年MODISの森林分布に、NASA POWERの世界の参照地点の平均降水量を重ねます。水色円の直径が雨の量、緑が森林です。地点間は補間せず、森林が雨を増やす程度や因果関係は計算していません。",
      accent: "#7ff0b5",
      rgb: "127, 240, 181",
      source: `
vec3 modeForestCloudEngine(vec2 p, float t, vec2 response, float memory) {
  float climate = fbm(p * vec2(1.4, 1.0) + vec2(t * 0.018, -t * 0.026));
  float lane = abs(fract((p.x + climate * 0.08) * 7.0) - 0.5);
  float trunkMask = smoothstep(-0.9, -0.16, p.y)
    * (1.0 - smoothstep(0.18, 0.68, p.y));
  float trunks = lineGlow(lane, 0.044) * trunkMask;
  float branches = lineGlow(
    sin(p.x * 11.0 + abs(p.y) * 8.0 + climate * 3.0 - t * 0.1),
    0.032
  ) * smoothstep(-0.15, 0.58, p.y);
  float canopy = smoothstep(
    0.5,
    0.78,
    fbm(p * vec2(3.2, 2.1) + vec2(0.0, t * 0.025))
      + smoothstep(-0.1, 0.68, p.y) * 0.22
  );
  float roots = lineGlow(
    sin(p.x * 14.0 - p.y * 5.0 + climate * 4.0),
    0.025
  ) * (1.0 - smoothstep(-0.72, -0.04, p.y));
  float cloud = smoothstep(
    0.62,
    0.84,
    fbm(p * vec2(1.7, 3.0) + vec2(t * 0.03, -t * 0.015))
  ) * smoothstep(0.05, 0.85, p.y);
  float density = trunks * 0.5 + branches * 0.3 + canopy * 0.34
    + roots * 0.25 + cloud * 0.32 + response.x * 0.64;
  vec3 background = baseGradient(p, vec3(0.015, 0.12, 0.085));
  vec3 forest = mix(vec3(0.06, 0.34, 0.18), vec3(0.46, 0.96, 0.66), canopy);
  return background + forest * density
    + vec3(0.42, 0.8, 0.9) * cloud * (0.15 + memory * 0.18)
    + vec3(0.66, 1.0, 0.78) * response.y * 0.2;
}
`.trim(),
    },
    {
      id: "nothing-is-waste",
      mapNumber: "09",
      title: "Recycling: Country Values",
      titleJa: "捨てた先の未来",
      description: "145の国・地域を収録。国連SDGの再資源化率91地域に、世界銀行の再資源化向け回収率54地域を補足しています。国土の青が明るいほど割合が高い0〜100%の共通尺度で、無着色の未収録と0%を区別します。資料側の推計を含み、年度・対象ごみ・分母が異なるため、世界平均や厳密な順位としては読めません。出典と個別注記を確認できます。",
      accent: "#b4ef6d",
      rgb: "180, 239, 109",
      source: `
vec3 modeNothingIsWaste(vec2 p, float t, vec2 response, float memory) {
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float spiral = lineGlow(
    sin(angle * 3.0 - radius * 8.0 + t * 0.48),
    0.036
  ) * smoothstep(1.2, 0.12, radius);
  float cycleA = lineGlow(radius - 0.34 - sin(angle * 3.0 + t * 0.3) * 0.06, 0.025);
  float cycleB = lineGlow(radius - 0.68 - cos(angle * 4.0 - t * 0.24) * 0.05, 0.021);
  vec2 movingGrid = p * 7.0 + vec2(t * 0.18, -t * 0.13);
  vec2 fragmentCell = fract(movingGrid) - 0.5;
  float fragmentSeed = hash21(floor(movingGrid));
  float fragments = exp(
    -pow(abs(fragmentCell.x) / 0.25, 4.0)
    -pow(abs(fragmentCell.y) / 0.09, 2.0)
  ) * smoothstep(0.55, 0.9, fragmentSeed);
  float transformed = response.x * (0.6 + cycleA + cycleB);
  float density = spiral * 0.36 + cycleA * 0.52 + cycleB * 0.34
    + fragments * 0.24 + transformed + response.y * 0.18;
  vec3 background = baseGradient(p, vec3(0.08, 0.11, 0.035));
  vec3 cycleColor = mix(vec3(0.24, 0.58, 0.16), vec3(0.88, 0.94, 0.35), radius);
  return background + cycleColor * density
    + vec3(0.35, 1.0, 0.68) * memory * spiral * 0.2;
}
`.trim(),
    },
    {
      id: "anthropocene-scar",
      mapNumber: "10",
      title: "Anthropocene Scar",
      titleJa: "街の明かりと炭素",
      description: "Global Carbon Projectの1945〜2023年の国別化石燃料由来CO₂を、全年共通の色尺度で表示します。NASA VIIRSの2016年の夜間光は固定の比較資料です。過去の夜間光、個人の排出量、排出の原因を示す地図ではありません。",
      accent: "#ff8a67",
      rgb: "255, 138, 103",
      source: `
vec3 modeAnthropoceneScar(vec2 p, float t, vec2 response, float memory) {
  float organicNoise = fbm(p * 1.8 + vec2(t * 0.018, -t * 0.014));
  float organic = lineGlow(
    sin(p.x * 5.3 + p.y * 2.1 + organicNoise * 4.0 - t * 0.18),
    0.045
  );
  float gridX = lineGlow(sin(p.x * 19.0 + uVelocity.x * 0.2), 0.02);
  float gridY = lineGlow(sin(p.y * 15.0 + uVelocity.y * 0.2), 0.02);
  float grid = gridX + gridY;
  float scarA = lineGlow(
    p.y - sin(p.x * 3.8 + t * 0.11) * 0.12
      - (organicNoise - 0.5) * 0.32,
    0.026
  );
  float scarB = lineGlow(
    p.x + p.y * 0.42 - sin(p.y * 6.0 - t * 0.17) * 0.06,
    0.019
  );
  float rigidity = 0.28 + memory * 0.62;
  float healing = response.x * (0.8 + organic * 0.4);
  vec3 background = baseGradient(p, vec3(0.12, 0.045, 0.025));
  vec3 color = background
    + vec3(0.9, 0.24, 0.12) * (scarA * 0.7 + scarB * 0.44)
    + vec3(0.68, 0.46, 0.22) * grid * rigidity * 0.3
    + vec3(0.1, 0.48, 0.5) * organic * (0.18 + healing * 0.7);
  return color + vec3(0.55, 0.9, 0.78) * response.y * 0.2;
}
`.trim(),
    },
    {
      id: "rhythm-of-disaster",
      mapNumber: "11",
      title: "Message from Earth",
      titleJa: "大地の変動と暮らす",
      description: "USGSの2000〜2026年の世界M7.5以上の地震を、年ごと・発生日時順に表示します。輪は規模から見積もった学習用の可感半径で、実際の震度分布、被害範囲、津波範囲ではありません。気象庁の日本の実測震度は別層で確認できます。",
      accent: "#ffb45f",
      rgb: "255, 180, 95",
      source: `
vec3 modeRhythmOfDisaster(vec2 p, float t, vec2 response, float memory) {
  float terrain = fbm(p * 1.55 + vec2(4.2, t * 0.014));
  float strata = lineGlow(
    sin((p.y + terrain * 0.14) * 18.0 + p.x * 1.8),
    0.04
  );
  float fault = lineGlow(
    p.y - sin(p.x * 4.1 + terrain * 5.0) * 0.16,
    0.022
  );
  float waves = 0.0;
  float regrowth = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 origin = (hash22(vec2(fi, 14.7)) - 0.5) * vec2(1.45, 0.9);
    float phase = fract(t * (0.055 + fi * 0.006) + fi * 0.31);
    float distanceToWave = length(p - origin);
    waves += lineGlow(distanceToWave - phase * 1.25, 0.025)
      * (1.0 - phase);
    regrowth += exp(-distanceToWave * 3.8)
      * smoothstep(0.22, 0.68, phase)
      * (1.0 - smoothstep(0.7, 1.0, phase));
  }
  float seedlings = smoothstep(
    0.58,
    0.78,
    noise(p * 13.0 + terrain * 2.0)
  ) * (fault + regrowth);
  float density = fault * 0.58 + waves * 0.72 + seedlings * 0.44
    + response.y * 0.5;
  vec3 background = baseGradient(p, vec3(0.11, 0.05, 0.025));
  return background
    + vec3(0.48, 0.2, 0.08) * strata * 0.24
    + vec3(1.0, 0.38, 0.13) * (fault * 0.68 + waves * 0.56)
    + vec3(0.32, 0.88, 0.44) * regrowth * 0.22
    + vec3(0.56, 1.0, 0.58) * seedlings * (0.52 + memory * 0.32)
    + vec3(1.0, 0.58, 0.18) * density * 0.08
    + vec3(1.0, 0.78, 0.28) * response.x * 0.45;
}
`.trim(),
    },
    {
      id: "three-ecologies",
      mapNumber: "12",
      title: "Three Ecologies",
      titleJa: "街と森、そのあいだ",
      description: "両指標のある世界の国・地域の森林面積率と都市人口率を比較します。陸地と人口という異なる分母の割合で、足して100%にはなりません。都市人口率の近い二国と標本内の相関を読み、文化・記憶は別の表示で考えます。相関は因果や暮らしの質の評価ではありません。",
      accent: "#c7a2ff",
      rgb: "199, 162, 255",
      source: `
vec3 modeThreeEcologies(vec2 p, float t, vec2 response, float memory) {
  vec2 ecoCenter = vec2(-0.32, 0.08) + vec2(sin(t * 0.12), cos(t * 0.1)) * 0.06;
  vec2 socialCenter = vec2(0.3, 0.13) + vec2(cos(t * 0.09), sin(t * 0.14)) * 0.07;
  vec2 mindCenter = vec2(0.0, -0.31) + vec2(sin(t * 0.07), cos(t * 0.08)) * 0.055;
  float ecoRadius = length(p - ecoCenter);
  float socialRadius = length(p - socialCenter);
  float mindRadius = length(p - mindCenter);
  float eco = lineGlow(sin(ecoRadius * 18.0 - t * 0.42), 0.035)
    * exp(-ecoRadius * 0.68);
  float social = lineGlow(sin(socialRadius * 15.0 + t * 0.31), 0.038)
    * exp(-socialRadius * 0.72);
  float mind = lineGlow(sin(mindRadius * 20.0 - t * 0.2), 0.03)
    * exp(-mindRadius * 0.7);
  float overlap = min(1.0, eco * social + social * mind + mind * eco);
  float dialogue = response.x * (eco + social + mind + 0.2);
  vec3 background = baseGradient(p, vec3(0.055, 0.045, 0.12));
  vec3 color = background
    + vec3(0.25, 0.9, 0.62) * eco * 0.43
    + vec3(0.24, 0.58, 1.0) * social * 0.42
    + vec3(0.82, 0.44, 1.0) * mind * 0.42;
  return color + vec3(0.86, 0.95, 1.0) * overlap * (0.34 + memory * 0.25)
    + vec3(0.74, 0.6, 1.0) * dialogue * 0.36 + response.y * 0.08;
}
`.trim(),
    },
    {
      id: "earth-organ",
      mapNumber: "13",
      title: "Earth Organ",
      titleJa: "電気のつくり方",
      description: "世界銀行の再生可能エネルギー発電割合を、国土の青で比較します。国ごとに最新の非欠測値を使うため年は異なり、無着色は0%ではなく未収録です。NASA POWERの日射・風は31代表地点の補足で、導入可能量や割合の原因を計算した値ではありません。",
      accent: "#75f3d1",
      rgb: "117, 243, 209",
      source: `
vec3 modeEarthOrgan(vec2 p, float t, vec2 response, float memory) {
  vec2 q = rot(-0.08) * p;
  float tissue = fbm(q * 1.8 + vec2(t * 0.016, -t * 0.012));
  float gridX = lineGlow(sin(q.x * 17.0 + tissue * 2.0), 0.024);
  float gridY = lineGlow(sin(q.y * 13.0 - tissue * 2.4), 0.024);
  float city = (gridX + gridY) * 0.34;
  float vesselA = lineGlow(
    sin(q.x * 6.0 + q.y * 2.4 + tissue * 4.0 - t * 0.16),
    0.038
  );
  float vesselB = lineGlow(
    sin(q.y * 8.0 - q.x * 1.7 - tissue * 3.0 + t * 0.11),
    0.033
  );
  float nodes = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 node = (hash22(vec2(fi, 31.2)) - 0.5) * vec2(1.55, 1.0);
    float pulse = 0.65 + 0.35 * sin(t * 0.8 + fi * 1.4);
    nodes += exp(-dot(p - node, p - node) * 120.0) * pulse;
  }
  float organicization = 0.22 + memory * 0.58 + response.x * 0.55;
  vec3 background = baseGradient(p, vec3(0.015, 0.105, 0.095));
  vec3 color = background
    + vec3(0.15, 0.58, 0.68) * city * (1.0 - organicization * 0.35)
    + vec3(0.32, 0.98, 0.72) * (vesselA + vesselB) * organicization * 0.48
    + vec3(0.78, 1.0, 0.86) * nodes * (0.24 + organicization * 0.26);
  return color + vec3(0.34, 0.86, 1.0) * response.y * 0.26;
}
`.trim(),
    },
    {
      id: "population-tide",
      mapNumber: "14",
      title: "Population Tide",
      titleJa: "人口が変える暮らし",
      description: "世界銀行の1960〜2025年の人口を、217の国・地域を対象に表示します。円の面積が人口に比例する全年共通尺度で、欠測年は補間しません。国・地域の総人口であり、都市の人口密度、豊かさ、環境負荷を表す値ではありません。",
      accent: "#ffcf80",
      rgb: "255, 207, 128",
      source: `
vec3 modePopulationTide(vec2 p, float t, vec2 response, float memory) {
  float slowTime = t * 0.055;
  float field = fbm(p * 1.22 + vec2(slowTime * 0.11, -slowTime * 0.07));
  float waveA = lineGlow(
    sin(p.x * 4.6 + p.y * 2.1 + field * 3.4 - slowTime),
    0.048
  );
  float waveB = lineGlow(
    sin(p.y * 6.2 - p.x * 1.4 - field * 2.6 + slowTime * 0.72),
    0.04
  );
  float settlements = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 origin = (hash22(vec2(fi, 47.3)) - 0.5) * vec2(1.65, 1.05);
    float breath = 0.72 + 0.28 * sin(slowTime * 1.7 + fi * 1.21);
    settlements += exp(-dot(p - origin, p - origin) * 55.0) * breath;
  }
  float density = (waveA + waveB) * (0.14 + field * 0.2)
    + settlements * 0.36
    + response.x * 0.48
    + response.y * 0.22;
  vec3 background = baseGradient(p, vec3(0.08, 0.055, 0.025));
  vec3 amber = mix(vec3(0.54, 0.22, 0.08), vec3(1.0, 0.78, 0.34), field);
  return background + amber * density
    + vec3(0.48, 0.95, 0.86) * settlements * memory * 0.12;
}
`.trim(),
    },
  ];

  const modeConcepts = {
    "breathing-earth": {
      lead:
        "毎日のエネルギー利用ともつながる炭素が、空気に積み重なります。季節ごとの上下と何十年もの増加を分けて読み、暮らしを包む大気の変化を考えます。",
      seeing:
        "球体の伸び縮みはCO₂の季節変化、明るさは長期的な増加、背景色は地球の平均気温の変化です。世界地図は1958年から2050年まで進みます。実際の記録、計算で補った値、未来の試算には、それぞれ違う表示をつけました。",
      touch:
        "画面に触れると、指先から波が広がります。データの値は変わりません。観測した数字に、自分の動きが重なる仕組みです。",
      context:
        "授業では、風や海流、熱の移動を、地球を動かす大きな循環として学びます。この展示ではCO₂の季節変化を「呼吸」に見立て、そのくり返しの奥にある長期的な変化を見せています。",
      question: "季節の上下だけでなく、長い時間の変化も見えたでしょうか。",
    },
    "blue-circulation": {
      lead:
        "遠く離れた海も、熱や生きものを運ぶ流れでつながっています。この展示は、その広がりを一日の海流から計算した距離で考えるものです。未来の海況や漂流の予報ではありません。",
      seeing:
        "色付きの矢印が海流です。青から水色、黄、橙に近づくほど速くなります。点から伸びる線は、同じ速さと向きが続くと仮定した移動先です。白い矢印は別資料の平均風で、距離計算には使いません。",
      touch:
        "色付きの点を押すと自動再生が止まり、その地点の海流の速さ・向き・選んだ日数後の移動距離を読めます。スライダーで0〜14日を動かせます。",
      context:
        "風と海流はどちらも熱を運びますが、この画面は両者の因果関係を計算していません。風は比較用に重ね、海流の移動距離だけを計算しています。",
      question: "同じ速さと向きが14日続くと、選んだ地点から何km先まで進む計算になりましたか。",
    },
    "forest-cloud-engine": {
      lead:
        "飲み水や田畑、生きものの居場所を支える水は、森とどのようにつながっているのでしょう。森林の分布と世界の参照地点の雨量を同じ地図で比べ、そこから分かることと分からないことを考えます。",
      seeing:
        "緑はMODISから抜き出した森林域です。水色円は世界の参照地点の平均降水量（国平均ではありません）で、直径が大きいほど雨が多い地点です。雨の多い円にはmm/dayの数値も表示します。ブラジルのアマゾン付近は5.33 mm/dayです。地点間には値を入れていません。",
      touch:
        "大きな水色円を押すと自動走査が止まり、地図上とカードに代表地点名・平均降水量・資料区分が表示されます。別の円を押して森林との重なり方を比べられます。",
      context:
        "授業「森は地球の気候安定装置」では、森を木材の量だけでなく、水や土、気温を支える働きから見ます。この展示は、そのうち森林と雨の分布を並べたものです。",
      question: "大きな水色円と森林の緑は、アマゾン、東南アジア、アフリカのどこで重なって見えましたか。",
    },
    "nothing-is-waste": {
      lead:
        "使い終えたものを捨てて終わりにするか、次の資源へ戻すか。暮らしの中の選択と回収の仕組みを考える入口として、国連の再資源化率と世界銀行の再資源化向け回収率を読みます。",
      seeing:
        "国土の青が明るいほど割合が高く、0〜100%の同じ色尺度で145の国・地域を表示します。0%の濃い青と無着色の未収録を区別し、未収録は推定値で埋めません。資料側の推計を含み、年度・対象ごみ・分母が異なるため、世界平均や厳密な順位にはできません。",
      touch:
        "左右ボタンかスライダーで国・地域を切り替えます。国土を押すと割合、資料の年、国連・世界銀行の出典と対象範囲を確認できます。世界銀行の年は測定年不明の場合に公表年等を含みます。小さな国・地域もスライダーから選べます。",
      context:
        "授業「自然界にはゴミもうんちも存在しない」では、ある生きものの不要物が次の生きものの材料になる循環を扱います。人の製品も、作るときから回収や修理まで考える必要があります。",
      question: "青が明るい国と暗い国はどこでしょう。報告年や定義の違い、未収録に注意して、国ごとの差を比べてみましょう。",
    },
    "anthropocene-scar": {
      lead:
        "夜の明かりや便利な暮らしを支えるエネルギーは、何を残してきたのでしょう。国別のCO₂排出の長い記録と2016年の夜間光を分けて読み、個人の責任や排出の原因まで決めつけずに考えます。",
      seeing:
        "国土の色は選択年度の国全体の化石燃料由来CO₂です。全年度共通の固定対数尺度で、濃紺から紫・赤・橙・淡黄へ明るくなるほど排出量が大きくなります。白い発光はNASA VIIRSが2016年に捉えた夜間光で、選択年度に合わせて変化する資料ではありません。",
      touch:
        "スライダーと左右ボタンで1945〜2023年を動かせます。色の付いた国土を押すとその国を選んだまま年を追えます。地図を0.65秒以上長押しすると夜間光だけが6秒間薄くなります。",
      context:
        "授業「人類世3.0」では、産業革命以降、人の活動が地球規模に大きくなったことを扱います。ただし排出量も、その影響を受ける大きさも、地域や人によって同じではありません。",
      question: "1945年から2023年へ進めたとき、どの国の色が早く明るくなり、どの国は遅れて変わりましたか。",
    },
    "rhythm-of-disaster": {
      lead:
        "地球の変動を止めることはできなくても、起きたことを記録し、備えを受け継ぐことはできます。2000年以降の世界の大地震を時刻と場所からたどります。これは被害や次の地震の予測ではありません。",
      seeing:
        "赤い×は選択年度にUSGSが記録したM7.5以上の震源だけです。発生日時の早い地震から順に×と輪が立ち上がり、M7.5は約500km、M9.1は約2,000kmの推定可感半径で止まります。別年度の震源は表示しません。",
      touch:
        "年度は自動で進み、発生日時順に震源へイーズアウトで移動します。到着の0.5秒後に×印、その0.9秒後に日本時間の発生日時・位置・深さ・Magnitudeを表示します。最後は世界表示へ戻り、旧年の震源を一斉にフェードアウトしてから次年度を再生します。地図を自分で動かすと、その年の自動追従だけ止まります。日本の震度6弱以上の実測記録は、左下の切替から別層で見られます。",
      context:
        "授業では、地球の変動を止めるのではなく、変動に備えられる社会を考えます。輪はUSGSの距離目安とM9.1の広域可感記録から補間した学習用の推定です。実際の揺れは深さ・地盤・断層方向などで変わります。",
      question: "大地震が多い年と少ない年では、震源の分布と波の重なり方がどう違って見えましたか。",
    },
    "three-ecologies": {
      lead:
        "街も森も、誰かの居場所です。暮らす場所を自然の割合だけで評価せず、都市人口率の近い二国の違いを比べ、社会や文化・記憶からも見つめ直します。",
      seeing:
        "緑の棒は陸地のうち森林が占める割合、青の棒は人口のうち都市に暮らす人の割合です。分母が違うので足して100%にはなりません。「関係を見る」の散布図は横軸が都市人口率、縦軸が森林率。回帰線と相関係数rは両指標のある国・地域の範囲内の傾向です。",
      touch:
        "国の選択欄か地図の棒を押して比べます。スライダーでは都市人口率の低い国から高い国へ移動します。散布図の点も選択できます。自動再生は任意で、文化・記憶は別タブで見られます。",
      context:
        "森林率と都市人口率の基準年は異なり、都市の定義も国で異なります。両指標の公表値がある国・地域を対象とし、世界・地域合計と欠測を除外します。同じ国の時間変化は示しません。相関は因果ではありません。文化・記憶の世界遺産24例は数値の比較から分けています。",
      question: "似た都市人口率の二国で、森林率はどれだけ違いましたか。二つの割合だけでは見えない、その場所の事情は何でしょうか。",
    },
    "earth-organ": {
      lead:
        "暮らしを支える電気を、何からつくるか。国ごとの再生可能エネルギーの発電割合を比べ、太陽や風の条件だけでなく、設備や社会の選択も含めて考えます。",
      seeing:
        "公開値のある国・地域を同じ0〜100%の尺度で塗ります。暗い青ほど比率が低く、明るい水色ほど高い国です。日射・風が収録された31代表地点だけに、黄色の日射円と緑の風矢印を重ねます。無着色は未収録で、0%ではありません。",
      touch:
        "自動再生とスライダーは、再生可能エネルギー発電割合の高い国から低い国へ順番に選択します。国を押しても値を読めます。地点同士を結ぶ機能はなくし、地図の色と国別比較に集中します。",
      context:
        "国・地域ごとの最新の非欠測値を使うため、データの年は異なり、同一年の順位ではありません。世界・地域合計は除外します。発電割合は水力、政策、送電網、設備、需要などにも左右され、31代表地点の日射・風は導入可能量や因果関係を計算した値ではありません。",
      question: "自然条件が豊かでも現在の割合が低い国、またはその逆の国はあるでしょうか。何が違いを生むのでしょう。",
    },
    "population-tide": {
      lead:
        "人の数が変わると、住まい、交通、学校など、暮らしを支える仕組みも問い直されます。増える国と減る国が同時にある世界を、1960年からの人口の記録でたどります。",
      seeing:
        "淡青の円は選択した年の人口です。円の面積が人口に比例し、全年で同じ尺度です。217の国・地域を対象に、データのある年だけを表示します。世界合計や地域合計は含みません。",
      touch:
        "スライダーと左右ボタンで1960〜2025年を移動できます。国の円を押すと、その国を選択したまま年だけを動かして人口の変化を追えます。",
      context:
        "人口の変化は出生・死亡だけでなく、移動、医療、経済、制度、紛争など多くの条件が重なった結果です。この展示は人口の多さを豊かさや環境負荷へ直接変換しません。",
      question: "1960年と最新年を比べたとき、地図上の人口の重心はどちらへ動いたように見えましたか。",
    },
  };

  const modeDataNarratives = Object.freeze({
    "breathing-earth": "地図の見方：色はCO₂濃度です。斜線のマスは、近くの8地点から計算した値です。1958〜2009年は後年の衛星地図を使った再構成、2026年以降は最近10年の傾向が続いた場合の試算です。",
    "blue-circulation": "地図の見方：色付きの矢印は海流で、青→水色→黄→橙の順に速くなります。点から伸びる線は、同じ海流が続くと仮定した0〜14日後の移動距離です。白い矢印は比較用の平均風で、距離計算には使いません。海の予報ではありません。",
    "forest-cloud-engine": "地図の見方：緑は2023年MODIS土地被覆から抜き出した森林域、大きな水色円は世界の参照地点の平均降水量（国平均ではありません）です。直径が大きいほど雨が多く、雨の多い円にはmm/dayも直接表示します。ブラジルのアマゾン付近は5.33 mm/dayです。地点間は補間せず、相関係数や因果関係を示す図ではありません。",
    "nothing-is-waste": "地図の見方：国土の青が明るいほど割合が高い0〜100%の尺度で145の国・地域を表示。国連91地域に世界銀行54地域を補足し、無着色の未収録と濃い青の0%を区別します。国土を押すか左右ボタンとスライダーで選び、年・出典・対象範囲を確認できます。年度・定義・分母の差があり、厳密な順位にはできません。",
    "anthropocene-scar": "地図の見方：1945〜2023年の国別化石燃料由来CO₂を国土の色で示します。全年度共通の固定対数尺度で、濃紺→紫→赤→橙→淡黄ほど排出量が大きくなります。白い発光は2016年のNASA VIIRS夜間光を固定した比較用レイヤーで、過去の夜間光ではありません。0.65秒以上長押しすると白だけが6秒間薄くなります。",
    "rhythm-of-disaster": "地図の見方：初期表示は世界です。2000〜2026年のUSGS M7.5以上を発生日時の早い順にカメラで追い、到着の0.5秒後に×印、さらに0.9秒後に日本時間の発生日時・位置・深さを表示します。年の再生時間は地震件数に合わせて変わり、最後は世界表示へ戻り、旧年の震源が一斉にフェードアウトしてから次年を再生します。実際の震度分布・被害・津波範囲ではなく、日本の実測震度は別層です。",
    "three-ecologies": "地図の見方：森林面積率は緑の棒、都市人口率は青の棒。ともに0〜100%ですが、陸地と人口という別の分母です。都市人口率が最も近い二国を比較し、散布図では回帰線と相関係数rを確認できます。公表値のある国・地域が対象で、合計と欠測を除外します。文化・記憶は別タブで、相関計算へ含めません。",
    "earth-organ": "地図の見方：公開値のある国・地域の国土を、電力に占める再生可能エネルギーの割合で塗ります。暗い青は0%に近く、明るい水色は100%に近い比率です。自動再生とスライダーは高い国から低い国へ移動します。国名と値の年も確かめてください。無着色は未収録。日射・風は31代表地点だけの補足で、発電割合を説明する因果モデルではありません。",
    "population-tide": "地図の見方：1960〜2025年を一年ずつ切り替え、217の国・地域を対象に人口を淡青の円で表示します。円の面積が人口に比例する全年共通尺度です。欠測年は非表示。点は代表位置で、都市の場所や人口密度ではありません。",
  });

  const lectureResumeLinks = Object.freeze({
    "breathing-earth": "授業とのつながり：『なぜ風は吹くのか？――宇宙船地球号の循環系を理解する』",
    "blue-circulation": "授業とのつながり：『なぜ風は吹くのか？――宇宙船地球号の循環系を理解する』",
    "forest-cloud-engine": "授業とのつながり：『森は地球の気候安定装置』",
    "nothing-is-waste": "授業とのつながり：『自然界にはゴミもうんちも存在しない』",
    "anthropocene-scar": "授業とのつながり：『人類世3.0――産業革命以降「ガリバー化」した人類』",
    "rhythm-of-disaster": "授業とのつながり：『地球の変動リズムと同期しうる文明設計』",
    "three-ecologies": "授業とのつながり：『三つのエコロジー――生態・社会・精神』",
    "earth-organ": "授業とのつながり：『地球の変動リズムと同期しうる文明設計』",
    "population-tide": "授業とのつながり：『人類世3.0――産業革命以降「ガリバー化」した人類』",
  });

  window.GaiaAppContent = Object.freeze({
    JAPAN_NODES,
    JMA_CO2_SITES,
    EARTH_NODES,
    SIMPLE_WORLD_LANDMASSES,
    SIMPLE_WORLD_ISLAND_LINES,
    JMA_EVENT_TITLES,
    INTRO_PATHS,
    INTRO_MODE_CHOICES,
    MAP_MODE_DESCRIPTIONS,
    MAP_TITLE_SUBTITLES,
    SPACE_MODE_CHOICES,
    modes,
    modeConcepts,
    modeDataNarratives,
    lectureResumeLinks,
  });
})();
