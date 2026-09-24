# データ出典・利用条件

2026-09-13の実装カタログと同梱データを基準にした案内です。提供元の最新データをすべて取得済みという意味ではありません。展示別のデータ名・収録期間・原本の参照先は[素材・データ台帳](MEDIA_RIGHTS_LEDGER.md#データ出典)で確認できます。

## データの扱い

- `SOURCE` は提供元の観測・統計・モデル値、`DERIVED` は集計・補間・変換、`SCENARIO` は仮定や観客操作です。
- モデルの格子値、観測所の実測、届出量、分類群の確認記録は異なる種類のデータです。
- 保存値の取得日と観測対象の年・年度は別です。年次データは常時更新されません。欠測は0として扱いません。
- 火災の光、風の粒子、海流の軌跡、地震の波紋は可視化の表現です。被害範囲・公式警報・将来の実際の経路を示しません。
- 取得失敗時は展示ごとに保存値、期限切れキャッシュ、演出用サンプル、欠測を使い分けます。[取得状態の読み方](ARCHITECTURE.md#取得状態の読み方)をご覧ください。

## 主な提供元と用途

| 分野・展示 | 提供元 | 使用内容 |
|---|---|---|
| 04 火災・熱異常 | [NASA LANCE FIRMS](https://firms.modaps.eosdis.nasa.gov/active_fire/) | MODIS C6.1 NRTの直近24時間。サイトAPI経由で抽出 |
| 01・05・15・17–19 気象 | [Open-Meteo Forecast](https://open-meteo.com/en/docs) | 風、気圧、気温、降水、雲、日射のモデル値 |
| 03・16・20 大気質 | [Open-Meteo / CAMS](https://open-meteo.com/en/docs/air-quality-api) | PM2.5、格子CO₂等のモデル値 |
| 02・11 地震 | [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)、[気象庁](https://www.data.jma.go.jp/eqdb/data/shindo/) | 直近イベント、世界の保存履歴、国内の代表地震の震度記録 |
| 06 CO₂・気温 | [GOSAT / JAXA・NIES・環境省](https://data2.gosat.nies.go.jp/gallery/fts_l3_swir_co2_gallery_en.html)、[NOAA GML](https://gml.noaa.gov/ccgg/trends/data.html)、[NASA GISS](https://data.giss.nasa.gov/gistemp/)、[気象庁](https://www.data.jma.go.jp/ghg/kanshi/obs/co2_yearave.csv) | XCO₂分布、月平均・年平均CO₂、全球気温偏差。近似復元・補完・未来試算は原値と区別 |
| 補助オーロラ層 | [NOAA SWPC](https://www.swpc.noaa.gov/products/aurora-30-minute-forecast) | OVATION予報。失敗時は保存スナップショット |
| 07 海流 | [NOAA CoastWatch](https://coastwatch.noaa.gov/cwn/products/noaacwblendednrtcurrentsdaily.html)、[NASA POWER](https://power.larc.nasa.gov/) | 保存海面流速と代表地点の風の気候値。移動距離は一定流速を仮定した独自計算 |
| 08・10・12 森林・夜間光 | [NASA GIBS](https://gibs.earthdata.nasa.gov/) | MODIS土地被覆、VIIRS夜間光の固定参照画像 |
| 08・13 気候値 | [NASA POWER](https://power.larc.nasa.gov/) | 代表地点の降水・日射・風 |
| 09 再資源化 | [UN SDG](https://unstats.un.org/sdgs/dataportal/database)、[World Bank What a Waste](https://datacatalog.worldbank.org/search/dataset/0039597/what-a-waste-global-database) | 国・地域別再資源化率、再資源化向け回収率 |
| 10 化石燃料CO₂ | [Global Carbon Project / CICERO](https://doi.org/10.5281/zenodo.13981696) | GCB2024の国別年次排出量 |
| 12 生態・文化 | [GloBI](https://www.globalbioticinteractions.org/)、[GBIF](https://www.gbif.org/)、[UNESCO](https://whc.unesco.org/en/list/) | 送粉関係、座標付き観察記録、選定した世界遺産の名称・位置・分類 |
| 12–14 森林・都市・エネルギー・人口 | [World Bank WDI](https://data.worldbank.org/) | 森林率、都市人口率、再生可能電力比率、総人口 |
| 21 人口移動 | [総務省統計局](https://www.stat.go.jp/data/idou/6.html) | 1954–2025年の日本人移動者の転入超過。沖縄は1973年から |
| 22 宿泊 | [観光庁](https://www.mlit.go.jp/kankocho/tokei_hakusyo/shukuhakutokei.html) | 2007–2025年の延べ宿泊者数。従業者10人以上の施設 |
| 23 住宅 | [国土交通省](https://www.mlit.go.jp/sogoseisaku/jouhouka/sosei_jouhouka_tk4_000002.html) | 1951–2025年の新設住宅着工戸数。沖縄は1973年から |
| 24–30・38–43 気象の年次記録 | [気象庁](https://www.data.jma.go.jp/stats/etrn/) | 代表観測点の気温、湿度、日照、雨、現地気圧、風速、日射。県全域の平均ではない |
| 31–37・55–64 水質 | [環境省 水環境総合情報サイト](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | 海・川・湖のCOD、BOD、pH、DO、栄養塩・汚濁物質等。年度統計・限界値を区別 |
| 44–54 大気汚染 | [国立環境研究所 環境展望台](https://tenbou.nies.go.jp/download/) | 大気汚染常時監視の年度値。物質ごとに収録期間が異なる |
| 65–67 PRTR | [環境省・経済産業省](https://www.env.go.jp/chemi/prtr/kaiji/index.html)、NITE | 2018–2022年度の事業所別届出とGIS。周辺の濃度や危険度とは異なる |
| 68–69 河川生物 | [国土交通省・国総研](https://www.nilim.go.jp/lab/fbg/ksnkankyo/) | 河川水辺の国勢調査の確認リスト・GISを照合した分類群数 |
| 70–71 食料 | [FAO](https://www.fao.org/faostat/)、[農林水産省 / e-Stat](https://www.e-stat.go.jp/stat-search/files?layout=datalist&lid=000001478566&page=1) | 旧・新食料需給表、食料安全保障指標、日本の年度系列。独自の自給率算出とFAO公表値を区別 |
| ORBITAL | [NASA DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/)、[NASA/JPL CNEOS](https://cneos.jpl.nasa.gov/)、[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/)、[ISAS/JAXA DARTS](https://doi.org/10.17597/isas.darts/hyb2-00500) | 太陽活動、小天体、系外惑星、リュウグウの保存スナップショット |
| STORY気温デモ | [NASA GISS / GISTEMP v4](https://data.giss.nasa.gov/gistemp/data_v4.html) | 1958–2025年の2°格子を年平均に加工。全球平均の系列とは別 |
| GX | [ICS](https://stratigraphy.org/chart/)、[USGS](https://pubs.usgs.gov/gip/fossils/scale.html)、国立科学博物館、IUGS | 地球史の解説資料。ライブ観測データではない |

## 地図・コード・参加型センサー

世界地図は[Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)、都道府県境界は[地球地図日本由来の境界](../data/japan-prefectures-NOTICE.md)を使用しています。登録画面の都市地図は[OpenStreetMap](https://www.openstreetmap.org/copyright)、地域コードは[Unicode CLDR・J-LIS等](REGION-CODE-SOURCES.md)を参照します。

参加者の観測値は公的機関のデータとは別です。設置位置・校正・真正性は保証しません。公開POIや保存情報については[プライバシー](../PRIVACY.md)を参照してください。

## 判定の読み方

権利確認で用いる区分は次の意味です。本ページで全データに一括した判定を与えるものではありません。

| 区分 | 意味 |
|---|---|
| **可** | 確認した用途・表示・条件の範囲で利用可能と判断 |
| **条件付可** | 非商用、帰属表示、データセット固有条件などを満たす必要がある |
| **要対応** | 許諾・条件・メタデータに未確認事項があり、無条件に利用可能とは扱わない |

## 再利用するときの注意

本作品は広告・課金を伴わない公開を前提としています。第三者のデータや素材を、作品のコードと同じ条件で一括再許諾するものではありません。

- 出典、原提供元、データセット名・版・DOI、対象期間、加工内容を保持してください。
- Open-Meteoの無料APIには非商用・呼出制限等の条件があります。[Open-Meteo Terms](https://open-meteo.com/en/terms)を確認してください。
- NASA由来データの引用は[NASA Earthdata Data Use and Citation Guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy)と個別データセットの条件を参照してください。機関名の表示は作品への承認・保証を意味しません。
- GBIFはレコード・原データセットごとの条件が異なります。CC BY-NCを含むため、商用利用できるものとして一括扱いしないでください。帰属・DOI等は同梱の記録に保持しています。
- GOSAT・UNESCO等の現行利用には製作者判断が含まれます。提供元の個別許諾取得済み、または無条件の再配布可という説明はしていません。
- FAO、World Bank、GCB、DARTSなども原提供元の指定引用・個別条件を確認してください。
- 静的JSON・画像はURLから取得できるため、ダウンロードボタンがなくても配布物として扱います。
- 商用化、用途・加工・配布範囲の変更時には、改めて提供元の条件を確認してください。

詳細な一覧は[素材・データ台帳](MEDIA_RIGHTS_LEDGER.md)、コードの条件は[LICENSE](../LICENSE.md)を参照してください。未確認事項がないことや、全データの無条件な再利用を保証する文書ではありません。
