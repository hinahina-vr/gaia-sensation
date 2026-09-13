# 公開素材・データ権利台帳

この文書は `scripts/build-media-rights-ledger.mjs` により機械可読JSONから生成されます。制作元・出典・加工内容を記録します。生成イラスト: OpenAI Imagegen。生成音楽: Suno AI。

- 登録メディア（公開・ローカル候補を含む）: 341件
- 各ファイル: SHA-256、制作サービス、最初のリポジトリ証拠日、加工説明、元台帳、利用条件URLをJSONへ収録

## データ出典

2026-09-13に現行カタログ・同梱メタデータと照合。収録期間は提供元の最新版の保証ではありません。今回、観測データの再取得や利用許諾の再判定は行っていません。

登録: 116件（展示別の同一提供元、独自加工、補助経路も区別して収録）。日本の年次系列と食料の追加系列は実装カタログ・同梱JSONから生成します。各行の「記録」から取得日・加工内容・原データURLを確認できます。

利用条件と再利用上の注意は [データ出典・利用条件](DATA_SOURCES.md) を参照してください。本一覧は提供元の個別許諾や全データの無条件な再利用を保証するものではありません。

### ライブ・モデル取得

| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |
|---|---|---|---|
| [NASA LANCE FIRMS](https://firms.modaps.eosdis.nasa.gov/active_fire/) | MAP 01 / MODIS C6.1 NRT 火災・熱異常 | サイトAPI経由・15分キャッシュ。直近24時間を抽出。失敗時は保存値。火災の境界ではない。 | [記録](../sensor-platform/src/live-senseware.ts) |
| [Open-Meteo](https://open-meteo.com/en/docs) | MAP 02・05・15・17–19 / 風・気象・雲 | 全球はブラウザ取得・5分タブ内キャッシュ。日本はサイトAPI経由。保存値・演出用サンプルを現在値と区別。 | [記録](../src/exploration/live-exhibits.js) |
| [Open-Meteo / CAMS](https://open-meteo.com/en/docs/air-quality-api) | MAP 03・16・20 / 大気質・格子CO₂・PM2.5 | 予報モデルの格子値。全球はブラウザ取得、日本はサイトAPI経由。地上観測の実測とは区別。 | [記録](../sensor-platform/src/live-senseware.ts) |
| [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | MAP 04 / All Earthquakes Past Day | ブラウザ取得・5分タブ内キャッシュ。波紋は被害範囲や震度分布ではない。 | [記録](../src/exploration/live-exhibits.js) |

### 世界展示・基礎データ

| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |
|---|---|---|---|
| [NOAA / NWS Space Weather Prediction Center](https://www.swpc.noaa.gov/products/aurora-30-minute-forecast) | OVATION 2020 オーロラ30〜90分予報<br>最新予報・5分更新 | 5分更新の予報。失敗時は同梱スナップショット。 | [記録](../data/gaia-signals.json) |
| [JAXA / NIES / MOE](https://data2.gosat.nies.go.jp/gallery/fts_l3_swir_co2_gallery_en.html) | GOSAT FTS SWIR Level 3 XCO₂ monthly maps V03.05<br>2010-03–2025-12（同梱16時点） | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NOAA Global Monitoring Laboratory](https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv) | Mauna Loa CO₂ monthly mean<br>1958–2026 | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NASA GISS](https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv) | GISTEMP v4 global temperature anomaly<br>1880–2025 | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [気象庁](https://www.data.jma.go.jp/ghg/kanshi/obs/co2_yearave.csv) | 国内3地点の年平均CO₂濃度<br>1987–2025 | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NOAA CoastWatch](https://coastwatch.noaa.gov/erddap/griddap/noaacwBLENDEDNRTcurrentsDaily.csv?u_current%5B3345%5D%5B120:120:600%5D%5B0:240:1200%5D,v_current%5B3345%5D%5B120:120:600%5D%5B0:240:1200%5D) | Blended NRT surface currents<br>2026-07-30T00:00:00Z | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NASA POWER](https://power.larc.nasa.gov/api/temporal/climatology/point) | 10 m wind climatology<br>20-year Meteorological and Solar Monthly & Annual Climatologies (January 2001 - December 2020) | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NASA GIBS / MODIS](https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual.json) | MCD12Q1 IGBP Land Cover Type<br>2023 annual | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NASA POWER](https://power.larc.nasa.gov/api/temporal/climatology/point) | Precipitation climatology / global stratified sample<br>20-year Meteorological and Solar Monthly & Annual Climatologies (January 2001 - December 2020) | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [Global Biotic Interactions](https://api.globalbioticinteractions.org/interaction.csv?sourceTaxon=Apis%20mellifera&interactionType=pollinates&limit=24) | Documented pollination interactions<br>literature aggregation | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [GBIF](https://api.gbif.org/v1/occurrence/search) | Apis mellifera occurrences / global stratified sample<br>latest API snapshot | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [United Nations Statistics Division](https://unstats.un.org/SDGAPI/v1/sdg/Series/Data?seriesCode=EN_MWT_RCYR) | SDG 12.5.1 / municipal waste recycled<br>2000–2022 | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [World Bank Group](https://datacatalog.worldbank.org/search/dataset/0039597/what-a-waste-global-database) | What a Waste 3.0 / 再資源化向け回収率<br>2005–2024 | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [Global Carbon Project / CICERO](https://doi.org/10.5281/zenodo.13981696) | GCB2024 national fossil CO₂ emissions<br>1945–2023 | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NASA GIBS](https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/VIIRS_Night_Lights.json) | VIIRS Night Lights / Black Marble<br>2016 annual / fixed reference | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [気象庁](https://www.data.jma.go.jp/eqdb/data/shindo/) | 震度データベース検索<br>2011–2024 representative events | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [USGS](https://earthquake.usgs.gov/fdsnws/event/1/query) | FDSN Event Web Service / global M7.5+<br>2000–snapshot date | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NASA GIBS / MODIS](https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual.json) | MCD12Q1 IGBP Land Cover Type<br>2023 annual | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [World Bank / FAO](https://data.worldbank.org/indicator/AG.LND.FRST.ZS) | Forest area (% of land area)<br>latest available by country | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [World Bank / UN Population Division](https://data.worldbank.org/indicator/SP.URB.TOTL.IN.ZS) | Urban population (% of total)<br>latest available by country | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [UNESCO World Heritage Centre](https://whc.unesco.org/en/list/) | World Heritage List / global curated sample<br>current catalogue reference | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [World Bank / International Energy Agency](https://data.worldbank.org/indicator/EG.ELC.RNEW.ZS) | Renewable electricity output (% of total electricity output)<br>2011–2021 / latest available by country or economy | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [NASA POWER](https://power.larc.nasa.gov/api/temporal/climatology/point) | Solar and wind climatology / global stratified sample<br>climatology | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |
| [World Bank / United Nations Population Division](https://data.worldbank.org/indicator/SP.POP.TOTL) | Population, total (SP.POP.TOTL)<br>1960–2025 | 同梱スナップショット／表示用加工値。閲覧時に原データ全体を再取得しない。 | [記録](../data/gaia-signals.json) |

### 独自加工・シナリオ

| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |
|---|---|---|---|
| [GAIA SENSEWARE](../data/gaia-signals.json) | GOSAT公式閲覧画像から復元したXCO₂色階級<br>2010-03–2025-12 | DERIVED：原観測と区別した独自計算・仮定。 | [記録](../data/gaia-signals.json) |
| [GAIA SENSEWARE](https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv) | 1958–2009 CO₂空間再構成<br>1958–2009 | DERIVED：原観測と区別した独自計算・仮定。 | [記録](../data/gaia-signals.json) |
| [GAIA SENSEWARE / statistics layer](../scripts/statistics.mjs) | NOAA直近120か月によるCO₂最小二乗トレンド投影<br>2026–2050 | SCENARIO：原観測と区別した独自計算・仮定。 | [記録](../data/gaia-signals.json) |
| [GAIA SENSEWARE / statistics layer](../scripts/statistics.mjs) | GOSAT欠測セルの空間k近傍IDW補完<br>2010-03–2025-12 | DERIVED：原観測と区別した独自計算・仮定。 | [記録](../data/gaia-signals.json) |
| [GAIA SENSEWARE](../scripts/build-gaia-data.mjs) | 0–14 day constant-vector local transport<br>2026-07-30T00:00:00Z + 0–14 days | DERIVED：原観測と区別した独自計算・仮定。 | [記録](../data/gaia-signals.json) |
| Audience / local browser | 再資源化率の仮想経路<br>current session | SCENARIO：原観測と区別した独自計算・仮定。 | [記録](../data/gaia-signals.json) |
| [GAIA SENSEWARE](../scripts/build-gaia-data.mjs) | Paired-country forest × urban comparison<br>latest non-missing value for each indicator | DERIVED：原観測と区別した独自計算・仮定。 | [記録](../data/gaia-signals.json) |

### 補助・未使用の取得経路

| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |
|---|---|---|---|
| [NASA/JPL PO.DAAC](https://podaac.jpl.nasa.gov/dataset/oscar_l4_oc_nrt_v2.0) | OSCAR near-surface ocean currents<br>1993–present | 取得候補。現行海流値はNOAA CoastWatchを使用。OSCAR取得済みとは扱わない。 | [記録](../data/gaia-signals.json) |
| [NOAA NDBC](https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt) | latest observations | 補助provider（設定依存・現行展示での使用とは別）：live: 5 minutes; versioned snapshot fallback | [記録](../sensor-platform/src/live-senseware.ts) |
| [NOAA GML](https://erddap.gml.noaa.gov/erddap/tabledap/greenhouse_gases_co2_insitu_hourly_averages_surface.html) | Mauna Loa hourly CO2 | 補助provider（設定依存・現行展示での使用とは別）：latest published: 1 hour; versioned snapshot fallback | [記録](../sensor-platform/src/live-senseware.ts) |
| [JAXA Earth API](https://data.earth.jaxa.jp/en/) | JAXA.EORC_GSMaP_standard.Gauge.00Z-23Z.v6_daily | 補助provider（設定依存・現行展示での使用とは別）：live: 6 hours; fixed Hawaii bbox mean; versioned snapshot fallback | [記録](../sensor-platform/src/live-senseware.ts) |
| [ESA / Copernicus Data Space](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S5PL2.html) | Sentinel-5P L2 NO2 NRTI | 補助provider（設定依存・現行展示での使用とは別）：live: 30 minutes; 72-hour quality-masked bbox mean; versioned snapshot fallback | [記録](../sensor-platform/src/live-senseware.ts) |

### 日本の公的統計・観測（MAP 21–69）

| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |
|---|---|---|---|
| [総務省統計局](https://www.stat.go.jp/data/idou/6.html) | MAP 21 / 年間転入超過（日本人）<br>1954–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [観光庁](https://www.mlit.go.jp/kankocho/tokei_hakusyo/shukuhakutokei.html) | MAP 22 / 年間延べ宿泊者数（従業者10人以上）<br>2007–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [国土交通省](https://www.mlit.go.jp/sogoseisaku/jouhouka/sosei_jouhouka_tk4_000002.html) | MAP 23 / 新設住宅着工戸数<br>1951–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/index.php) | MAP 24 / 年平均気温<br>1955–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/index.php) | MAP 25 / 日最高気温の年平均<br>1955–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/index.php) | MAP 26 / 日最低気温の年平均<br>1955–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/index.php) | MAP 27 / 年平均相対湿度<br>1955–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/index.php) | MAP 28 / 年間日照時間<br>1955–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/index.php) | MAP 29 / 年間降水量<br>1955–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/index.php) | MAP 30 / 年間降水日数（1mm以上）<br>1955–2025 | 取得済み年次系列を同梱。欠測を0埋めせず、対象集団・代表観測地点・品質情報を区別。 | [記録](../data/estat-prefecture-series.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 31 / 海域のCOD / 年度平均<br>1971–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-marine-cod.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 32 / pH 年度最小値<br>1978–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-marine-ph.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 33 / DO 年度平均値<br>1976–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-marine-do.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 34 / pH 年度最小値<br>1978–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-river-ph.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 35 / DO 年度平均値<br>1976–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-river-do.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 36 / pH 年度最小値<br>1978–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-lake-ph.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 37 / DO 年度平均値<br>1976–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-lake-do.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/) | MAP 38 / 気温 年平均値<br>1955–2024年 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-weather-temperature.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/) | MAP 39 / 相対湿度 年平均値<br>1955–2024年 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-weather-humidity.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/) | MAP 40 / 現地気圧 年平均値<br>1955–2024年 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-weather-pressure.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/) | MAP 41 / 降水量 年合計<br>1955–2024年 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-weather-rainfall.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/) | MAP 42 / 風速 年平均値<br>1955–2024年 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-weather-wind-speed.json) |
| [気象庁](https://www.data.jma.go.jp/stats/etrn/) | MAP 43 / 全天日射 年平均相当<br>1961–2024年 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-weather-solar-irradiance.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 44 / 二酸化硫黄 SO₂ 年度平均<br>1971–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-so2.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 45 / 一酸化窒素 NO 年度平均<br>1971–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-no.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 46 / 二酸化窒素 NO₂ 年度平均<br>1971–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-no2.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 47 / 窒素酸化物 NOx 年度平均<br>1971–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-nox.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 48 / 一酸化炭素 CO 年度平均<br>1971–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-co.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 49 / 光化学オキシダント Ox 昼間年度平均<br>1985–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-ox.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 50 / 非メタン炭化水素 NMHC 年度平均<br>1975–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-nmhc.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 51 / メタン CH₄ 年度平均<br>1976–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-ch4.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 52 / 全炭化水素 THC 年度平均<br>1971–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-thc.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 53 / 浮遊粒子状物質 SPM 年度平均<br>1974–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-spm.json) |
| [国立環境研究所](https://tenbou.nies.go.jp/download/) | MAP 54 / 微小粒子状物質 PM2.5 年度平均<br>2010–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-air-pm25.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 55 / 河川 BOD 年度平均<br>1971–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-river-bod.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 56 / 河川 COD 年度平均<br>1971–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-river-cod.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 57 / 湖沼 COD 年度平均<br>1971–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-lake-cod.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 58 / 浮遊物質量 SS 年度平均<br>1977–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-ss.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 59 / 全窒素 T-N 年度平均<br>1984–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-tn.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 60 / 全りん T-P 年度平均<br>1984–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-tp.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 61 / n-ヘキサン抽出物質 年度平均<br>1978–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-hex.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 62 / 全亜鉛 Zn 年度平均<br>2007–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-zinc.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 63 / 直鎖アルキルベンゼンスルホン酸等 LAS 年度平均<br>2013–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-las.json) |
| [環境省](https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp) | MAP 64 / ノニルフェノール 年度平均<br>2012–2024年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-water-nonylphenol.json) |
| [環境省・経済産業省 / NITE](https://www.env.go.jp/chemi/prtr/kaiji/index.html) | MAP 65 / 大気への届出排出量<br>2018–2022年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-prtr-2022.json) |
| [環境省・経済産業省 / NITE](https://www.env.go.jp/chemi/prtr/kaiji/index.html) | MAP 66 / 公共用水域への届出排出量<br>2018–2022年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-prtr-2022.json) |
| [環境省・経済産業省 / NITE](https://www.env.go.jp/chemi/prtr/kaiji/index.html) | MAP 67 / 届出移動量（下水道＋廃棄物）<br>2018–2022年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-prtr-2022.json) |
| [国土交通省 / 国総研](https://www.nilim.go.jp/lab/fbg/ksnkankyo/) | MAP 68 / 底生生物の確認分類群数<br>1996–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-river-benthos.json) |
| [国土交通省 / 国総研](https://www.nilim.go.jp/lab/fbg/ksnkankyo/) | MAP 69 / 魚類の確認分類群数<br>1994–2023年度 | 年次・年度別の保存データ。圧縮JSONを必要時に読込。期間内でも地点別欠測あり。 | [記録](../data/japan-river-fish.json) |

### 食料（MAP 70–71）

| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |
|---|---|---|---|
| [FAO](https://data.fao.org/catalog/iso/2f264bb6-1238-459a-bf8b-0e2d0a16804a) | MAP 70 / FAOSTAT FBS | 世界は1961〜2023年、日本の参照値は1960年度から。9品目群の生産／輸入／輸出と重量ベースの品目別自給率。旧・新FAOと農水省の違いを明記。 | [記録](../data/fao-food-balances.json) |
| [FAO](https://bulks-faostat.fao.org/production/FoodBalanceSheetsHistoric_E_All_Data_(Normalized).zip) | FAOSTAT FBSH / 旧方式の食料需給表 | 同梱の追加系列。FAO旧・新方式と日本の年度系列を区別。独自算出は公式指標と同一視しない。 | [記録](../data/fao-food-balances.json) |
| [農林水産省 / e-Stat](https://www.e-stat.go.jp/stat-search/files?layout=datalist&lid=000001478566&page=1) | 農林水産省 食料需給表 令和6年度 項目別累年表 | 同梱の追加系列。FAO旧・新方式と日本の年度系列を区別。独自算出は公式指標と同一視しない。 | [記録](../data/fao-food-balances.json) |
| [FAO](https://data.fao.org/catalog/dataset/955d6564-40a9-48b4-b51b-f19d65bb3539) | MAP 71 / FAOSTAT FS | FAO公表の3年平均（2000年開始以降）。日本の穀物依存には1960年度以降の農水省数量から算出した別系列の参照値を追加。 | [記録](../data/fao-food-security.json) |
| [農林水産省 / e-Stat](https://www.e-stat.go.jp/stat-search/files?layout=datalist&lid=000001478566&page=1) | 農林水産省 食料需給表 令和6年度 項目別累年表 | 同梱の追加系列。FAO旧・新方式と日本の年度系列を区別。独自算出は公式指標と同一視しない。 | [記録](../data/fao-food-security.json) |

### ORBITAL・STORY・GX

| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |
|---|---|---|---|
| [NASA GSFC / DONKI](https://api.nasa.gov/) | Solar Flare notifications<br>2024-05-01–2024-05-31 | ORBITALの保存スナップショット。閲覧中の外部API取得なし。 | [記録](../data/space-signals.json) |
| [NASA GSFC / DONKI](https://api.nasa.gov/) | Coronal Mass Ejection analyses<br>2024-05-01–2024-05-31 | ORBITALの保存スナップショット。閲覧中の外部API取得なし。 | [記録](../data/space-signals.json) |
| [NASA GSFC / DONKI](https://api.nasa.gov/) | Geomagnetic Storm notifications<br>2024-05-01–2024-05-31 | ORBITALの保存スナップショット。閲覧中の外部API取得なし。 | [記録](../data/space-signals.json) |
| [NASA GSFC / DONKI](https://api.nasa.gov/) | Solar Energetic Particle notifications<br>2024-05-01–2024-05-31 | ORBITALの保存スナップショット。閲覧中の外部API取得なし。 | [記録](../data/space-signals.json) |
| [NASA/JPL CNEOS](https://ssd-api.jpl.nasa.gov/doc/cad.html) | Small-Body Close-Approach Data<br>2024-01-01–2024-12-31 | ORBITALの保存スナップショット。閲覧中の外部API取得なし。 | [記録](../data/space-signals.json) |
| [NASA/JPL CNEOS](https://ssd-api.jpl.nasa.gov/doc/fireball.html) | Fireball atmospheric impact records<br>API取得時点の直近60件（位置あり） | ORBITALの保存スナップショット。閲覧中の外部API取得なし。 | [記録](../data/space-signals.json) |
| [NASA Exoplanet Science Institute](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html) | Planetary Systems Composite Parameters<br>取得時点までの確認済み系外惑星から近傍1000件 | ORBITALの保存スナップショット。閲覧中の外部API取得なし。 | [記録](../data/space-signals.json) |
| [ISAS/JAXA DARTS](https://data.darts.isas.jaxa.jp/pub/hayabusa2/lidar_bundle/browse/) | Hayabusa2 LIDAR Level 2 Ryugu topography time series<br>2018-07-01 | ORBITALの保存スナップショット。閲覧中の外部API取得なし。 | [記録](../data/space-signals.json) |
| [NASA GISS](https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz) | GISTEMP v4 Land-Ocean Temperature Index, ERSSTv5, 1200 km smoothing | STORY用。1958–2025年の月次2°格子を年平均に加工し同梱。全球平均系列とは別。 | [記録](../data/story-temperature-annual.json) |
| [International Commission on Stratigraphy](https://stratigraphy.org/chart/) | International Chronostratigraphic Chart | GXの解説参照：地質年代境界の基準。数値のライブ観測ではない。 | [記録](../data/gx-deep-time.json) |
| [U.S. Geological Survey](https://pubs.usgs.gov/gip/fossils/scale.html) | Fossils, Rocks, and Time | GXの解説参照：岩石と化石から地球史を読む基本説明。数値のライブ観測ではない。 | [記録](../data/gx-deep-time.json) |
| [U.S. Geological Survey](https://pubs.usgs.gov/fs/2007/3004/) | The Precambrian: Beginning of Life | GXの解説参照：先カンブリア時代の環境と生命。数値のライブ観測ではない。 | [記録](../data/gx-deep-time.json) |
| [国立科学博物館](https://www.kahaku.go.jp/pickup-science/nid00000957.html) | 米国における恐竜絶滅層（K–Pg境界層）の調査 | GXの解説参照：K–Pg境界層とイリジウム。数値のライブ観測ではない。 | [記録](../data/gx-deep-time.json) |
| [IUGS / ICS](https://www.iugs.org/_files/ugd/f1fc07_a9ed7d24766444c69007c86a01745c56.pdf?index=true) | Joint statement on the Anthropocene proposal | GXの解説参照：人新世が正式な地質年代ではないこと。数値のライブ観測ではない。 | [記録](../data/gx-deep-time.json) |
| [PNAS](https://doi.org/10.1073/pnas.1517943113) | Delayed fungal evolution did not cause the Paleozoic peak in coal production | GXの解説参照：石炭形成を分解菌不在だけで説明しないための注意。数値のライブ観測ではない。 | [記録](../data/gx-deep-time.json) |
| [Nature](https://www.nature.com/articles/s41586-023-06896-7) | Oldest thylakoids in fossil cells directly evidence oxygenic photosynthesis | GXの解説参照：酸素発生型光合成の直接証拠。数値のライブ観測ではない。 | [記録](../data/gx-deep-time.json) |

### 地図・地域コード

| 提供者・出典 | データ・収録期間 | 取得・加工・退避方針 | ローカル根拠 |
|---|---|---|---|
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) | 世界の陸地・国境 | 加工した地図形状を同梱。 | [記録](../data/natural-earth-50m-land.geojson) |
| [国土地理院 / 地球地図日本](https://www.gsi.go.jp/kankyochiri/gm_jpn.html) | 47都道府県境界 | TopoJSONへ変換。個別の出典・加工記録を保持。 | [記録](../data/japan-prefectures-NOTICE.md) |
| [OpenStreetMap contributors](https://operations.osmfoundation.org/policies/tiles/) | センサー登録画面の都市地図 | 閲覧時のタイル取得。画面内帰属表示。一括保存しない。 | [記録](../docs/DATA_SOURCES.md) |
| [Unicode CLDR](https://cldr.unicode.org/) | 国・行政区分コード | コード・英語名を収録。許諾文は地域コード出典を参照。 | [記録](../docs/REGION-CODE-SOURCES.md) |
| [J-LIS](https://www.j-lis.go.jp/spd/code-address/jititai-code.html) | 全国地方公共団体コード | 自治体コードと名称を収録。 | [記録](../docs/REGION-CODE-SOURCES.md) |
| [国土地理院](https://maps.gsi.go.jp/) | 自治体庁舎の初期POI | 登録画面の編集可能な初期座標。端末の実位置ではない。 | [記録](../docs/REGION-CODE-SOURCES.md) |

## 検査

`npm run check:rights` はメディアのSHA-256、出典の必須項目・ID重複・ローカル根拠の存在、生成結果の差分を検査します。外部サイトの全リンク到達性や利用条件の再監査ではありません。利用条件の確認とは別の、ファイルと記載の整合検査です。
