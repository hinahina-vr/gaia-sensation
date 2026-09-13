# データ出典・ライセンス一覧

> 展示番号について: この文書には監査当時の旧番号が含まれます。現行の71展示との対応は [README](../README.md#map-0171-とデータ経路) と [ARCHITECTURE.md](ARCHITECTURE.md#mapの実装境界) を参照してください。例えば旧MAP 26は現行01、旧27—30は現行02—05です。この注記の追加は利用条件の再監査を意味しません。

- 対象: GAIA SENSEWAREの地図展示、宇宙展示、参加型センサーで参照・取得・同梱する外部データ
- 最終確認日: 2026-09-04（日本時間）
- 詳細判定の正本: [外部データ利用・二次加工・ダウンロード監査](EXTERNAL_DATA_USAGE_AUDIT.md)
- 地域コードの詳細: [地域コード出典](REGION-CODE-SOURCES.md)
- 画像・音声・フォント: [メディア権利台帳](MEDIA_RIGHTS_LEDGER.md)
- 2026-09-10追加: [STORY気温偏差デモの地域別GISTEMPデータ](STORY_TEMPERATURE_SOURCES_2026-09-10.md)。既存の全球平均系列とは別の、年平均2°格子データ。

この一覧は、審査者と利用者が「どの提供元の、何のデータを、どのように取得・加工し、どの条件で表示しているか」を短時間で確認するための索引です。データ提供元の名称やロゴを記載しても、各機関が本作品を承認・保証していることを意味しません。

公開版は保存済みJSONと閲覧中の外部API通信を併用します。2026-09-06に取得状態の説明を実装と照合しました（上記の利用条件の確認日とは別です）。接続経路、`LIVE CACHE`、期限切れキャッシュ、演出用サンプルの区別は[アーキテクチャの「取得状態の読み方」](ARCHITECTURE.md#取得状態の読み方)を参照してください。MAP 27—30の `SAVED VALUES` は演出用サンプルであり、提供元の過去の実測データではありません。

## 重要な前提

GAIA SENSEWAREは、広告・課金を伴わないコンテスト向け公開を現在の運用前提としています。外部データを作品全体のライセンスで再許諾せず、各データセット固有の利用条件を優先します。商用公開、広告掲載、有料提供、データ書き出し機能の追加、取得元や用途の変更を行う場合は、公開前に再監査します。

現行の利用判断は `docs/rights-review.json` を参照してください。2026-09-07に、GOSATは非営利・公益目的の製作者判断により利用継続とし、未使用JAXA FNF画像はローカル削除しました。GBIFの既存62記録の出典・権利情報は補完済みです。この文書は出典と利用形態の記録であり、全データの無条件な利用・再配布を保証するものではありません。

## 判定の読み方

| 判定 | 意味 |
|---|---|
| **可** | 現在の用途と配信方法は、記載した出典・改変表示・免責等を守る範囲で利用可能と判断 |
| **条件付可** | 非商用、契約、データセット固有の帰属、配信方法など追加条件を満たす場合に利用可能 |
| **要対応** | 許諾または権利メタデータが不足し、現状の同梱・公開配信を問題なしとは言明できない |
| **参照のみ** | 取得候補または補助実装であり、現在の展示値には使用していない |

## 正当な利用のために行っていること

1. 画面の `OPEN DATA` と `SOURCE` に提供元、データセット名、公式URL、対象期間、取得日時、単位、加工内容、注意事項を表示します。
2. 元データを `SOURCE`、補間・集計・単位換算を `DERIVED`、仮定や観客操作を `SCENARIO` として分離します。
3. 気象・海洋のモデル値を観測所の実測値として扱わず、火災点・地震波紋・将来試算なども公式の警報、被害範囲、予測結果と誤認させない説明を付けます。
4. ライブ展示はデータ時刻、取得時刻、経過時間、ライブ／キャッシュ／保存値の状態を表示し、保存値を現在の観測として表示しません。
5. APIキーをブラウザへ埋め込まず、提供元の呼出上限とキャッシュ条件を守ります。統計ラボから外部データをCSV・JSON・PNGとして書き出す機能は設けていません。
6. 同梱JSON、GeoJSON、TopoJSON、PNGはURLから直接取得できるため、単なる画面表示ではなく再配布として監査します。
7. 加工したデータには「加工して作成」「抽出・集計・補間」等を明記し、提供元が作成した原票であるかのように表示しません。

## MAP 01—09と基礎データ

| 提供元・データセット | 使用データ | 取得・加工と表示 | 利用条件・表示 | 判定 |
|---|---|---|---|---|
| [NOAA SWPC OVATION 2020](https://www.swpc.noaa.gov/products/aurora-30-minute-forecast) | 30〜90分オーロラ予報 | 5分更新し、極域の発光帯へ変換。失敗時は保存スナップショット | NOAAを出典表示。公式予報の代替や政府の承認を示す表現にしない | **可** |
| [GOSAT FTS SWIR L3 XCO₂](https://data2.gosat.nies.go.jp/gallery/fts_l3_swir_co2_gallery_en.html) | 月別XCO₂分布 | 公式閲覧画像の色から近似ppmを復元し、欠測補完・時点間補間を行った格子値を同梱 | 非営利・公益目的で現行利用に問題ないとの[製作者判断](GOSAT_OWNER_DECISION_2026-09-07.md)に基づき利用を継続。出典・加工表示を維持 | **製作者判断により継続** |
| [NOAA GML Mauna Loa CO₂](https://gml.noaa.gov/ccgg/trends/data.html) | 月平均CO₂濃度 | 季節変化、長期傾向、過去再構成の濃度水準、直近120か月OLS試算に使用 | NOAA出典、試算・改変、非公式加工物であることを表示 | **可** |
| [NASA GISS GISTEMP v4](https://data.giss.nasa.gov/gistemp/) | 全球気温偏差 | 背景色と温度応答へ変換 | NASAとデータセットを引用し、NASAの承認を示唆しない | **可** |
| [気象庁 国内3地点CO₂](https://www.data.jma.go.jp/ghg/kanshi/obs/co2_yearave.csv) | 綾里、南鳥島、与那国島等の年平均CO₂ | 地点比較と統計表示 | [気象庁利用規約](https://www.jma.go.jp/jma/kishou/info/coment.html)に従い、出典と加工表示を付け、予報・警報として提供しない | **可** |
| [NOAA CoastWatch Blended NRT currents](https://coastwatch.noaa.gov/cwn/products/noaacwblendednrtcurrentsdaily.html) | 海面流速u/v | 流速・流向を算出し、一定の流れが続く仮定で0〜14日の移動距離を計算 | NOAA出典と「定常流を仮定した作品内計算で、公式予測ではない」ことを表示 | **可** |
| [NASA POWER](https://power.larc.nasa.gov/) | 代表地点の風、降水、日射の気候値 | 矢印、点、森林・再生可能電力との比較 | NASA POWERと元データを引用し、代表地点の気候値であることを表示 | **可** |
| [NASA GIBS / MODIS MCD12Q1](https://gibs.earthdata.nasa.gov/) | 2023年土地被覆 | WMSを表示用PNGへ変換し背景層に使用 | NASA、MODIS、GIBSを出典表示。解析用の元画素ではなく加工済み表示画像と明記 | **可** |
| [Global Biotic Interactions](https://www.globalbioticinteractions.org/) | `Apis mellifera` の送粉関係 | 関係を抽出し、非地理ネットワークへ変換 | [GloBIのデータライセンス](https://github.com/globalbioticinteractions/globalbioticinteractions)と取得元データセットを確認し、双方を可能な限り帰属表示 | **可** |
| [GBIF occurrence records](https://www.gbif.org/terms) | 31か国の座標付き観察記録 | 各国最大2件を抽出し、観察点と分析へ使用 | レコードごとのCC0／CC BY／CC BY-NC、所有者識別子、データセットDOIを保持する必要がある。現行JSONは不足 | **要対応** |
| [UN SDG 12.5.1](https://unstats.un.org/sdgs/dataportal/database) | 都市廃棄物の再資源化率 | 全ページから91の国・地域の最新公表値を抽出。欠測は推定・ゼロ埋めしない | [UNdata利用条件](https://data.un.org/Host.aspx?Content=UNdataUse)に従い、担当機関、報告年、加工者、Nature属性・注記を保持 | **条件付可** |
| [Global Carbon Project / CICERO GCB2024](https://doi.org/10.5281/zenodo.13981696) | 国別化石燃料由来CO₂、1945〜2023年 | 213の国・地域、15,438年次値を固定対数尺度へ変換。年別欠測は非表示 | CC BY 4.0。著者、版、DOI、変更内容を表示 | **可** |
| [NASA GIBS / VIIRS Night Lights](https://gibs.earthdata.nasa.gov/) | 2016年夜間光 | 固定背景PNGへ変換し、排出量とは独立した比較層に使用 | NASA、VIIRS、GIBSを出典表示し、2016年固定参照と明記 | **可** |
| [気象庁 震度データベース](https://www.data.jma.go.jp/eqdb/data/shindo/) | 代表6地震の震度6弱以上の地点 | 地点を抽出して保存表示 | 気象庁出典と抽出・編集内容を表示し、公式警報・原票と誤認させない | **可** |
| [USGS FDSN Event Web Service](https://earthquake.usgs.gov/fdsnws/event/1/) | 世界のM7.5以上の地震 | 年別集計、発生間隔、位置表示へ加工 | USGS出典、取得条件、加工内容を表示。個別に第三者権利が示される場合はその条件を優先 | **可** |
| [World Bank WDI](https://datacatalog.worldbank.org/public-licenses) | 森林率、都市人口率、再生可能電力比率、総人口 | 国別比較、相関・回帰、時系列へ加工 | 原則CC BY 4.0。World Bankと各指標の原提供元を帰属し、変更を表示 | **可** |
| [UNESCO World Heritage List](https://whc.unesco.org/en/list/) | 独自選定した24地点の名称、位置、分類、地域 | MAP 12「街と森、そのあいだ」の「03 文化・記憶」で例示。相関計算には含めない | 2026-09-07の[製作者判断](UNESCO_OWNER_DECISION_2026-09-07.md)により現行利用を継続。出典リンクと24例の説明を維持 | **製作者判断により継続** |

NASA由来データは、個別制限が示されていない場合の一般方針として[NASA Earthdata Data Use and Citation Guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy)を参照し、データセットを特定できる引用と加工説明を付けます。NOAAとUSGSは[NOAAの免責・利用案内](https://oceanservice.noaa.gov/disclaimer.html)および[USGS Copyrights and Credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)を参照し、第三者著作物の表示がある場合は個別条件を優先します。

## MAP 10—15、26—30のライブ／モデルデータ

| 展示 | 提供元・データセット | 使用データ | 取得・保存 | 利用条件・表示 | 判定 |
|---|---|---|---|---|---|
| 10、12—14、27、30 | [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | 風速、風向、気圧、降水、気温、雲量、短波放射 | MAP 10・12—14はPages API経由で天気30分・風速場5分を基準にキャッシュ。MAP 27・30は全球240サンプル点を5分割して直接取得し、タブ内で5分キャッシュ。取得失敗時の演出用サンプルは実測と区別 | [APIデータはCC BY 4.0](https://open-meteo.com/en/license)。Open-Meteoと元モデルを表示し、変更を明記。無料APIは非商用・呼出上限内で使用 | **条件付可** |
| 11、15、28 | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) / CAMS | 格子CO₂、PM2.5、550nmエアロゾル光学的厚さ | MAP 28はCAMS Globalの全球240サンプル点を5分割してブラウザから取得。5分〜3時間キャッシュし、格子・モデル値として表示 | Open-MeteoとCAMSを表示。CC BY 4.0、無料APIの非商用条件、元モデルの条件を守る | **条件付可** |
| 26 | [NASA LANCE FIRMS / MODIS C6.1 NRT](https://firms.modaps.eosdis.nasa.gov/active_fire/) | 全球・直近24時間の火災／熱異常 | Workerで15分キャッシュ。信頼度60以上を時空間セルで抽出し最大1,600点へ制限 | NASA LANCE FIRMS、データセット名、抽出条件を表示。点は火災境界や焼失面積ではない | **可** |
| 29 | [USGS All Earthquakes Past Day GeoJSON Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | 全球・直近24時間の全規模イベント | ブラウザから最大1,000件取得し、5分キャッシュ | USGS、条件、時刻、加工を表示。波紋は震度分布・被害範囲ではない | **可** |

[Open-Meteo Terms](https://open-meteo.com/en/terms)に基づき、無料APIは広告・課金を伴わない非商用公開でのみ使用します。商用化する場合は、有料API契約またはライセンス条件を満たすセルフホストへ切り替えます。

## MAP 21—30の日本公的統計（2026-09-07 年次系列更新）

| 展示 | 提供元・統計 | 使用データ | 取得・加工 | 利用条件・表示 | 判定 |
|---|---|---|---|---|---|
| 21 | [統計局／住民基本台帳人口移動報告](https://www.stat.go.jp/data/idou/6.html) | 1954〜2025年の日本人移動者の転入超過数 | 第5表の年計を47都道府県順に抽出し、正負・絶対値を演出へ変換 | 統計名、期間、日本人のみの対象と加工を表示。沖縄は1973年から | **可** |
| 22 | [観光庁／宿泊旅行統計調査](https://www.mlit.go.jp/kankocho/tokei_hakusyo/shukuhakutokei.html) | 2007〜2025年の延べ宿泊者数（従業者10人以上） | 推移表「旧5-1」年計を抽出。全施設系列とは接続しない | 出典・加工・対象規模を表示。実人数ではなく宿泊数に応じた延べ人数 | **可** |
| 23 | [国土交通省／建築着工統計調査](https://www.mlit.go.jp/sogoseisaku/jouhouka/sosei_jouhouka_tk4_000002.html) | 1951〜2025年の新設住宅着工戸数 | 都道府県別「年計」表を抽出し、固定尺度の演出へ変換 | 出典・対象年・加工を表示。沖縄は1973年から。完成戸数ではない | **可** |
| 24—26 | [気象庁 過去の気象データ検索](https://www.data.jma.go.jp/stats/etrn/index.php) | 1955〜2025年の年平均気温、日最高気温の年平均、日最低気温の年平均 | 47代表観測点を用い、71年間共通尺度で表示（既存値を維持） | 観測点、指標定義、移転・都市化等の注意、反転尺度を表示。単日の最高・最低記録ではない | **可** |
| 27—30 | [気象庁 年ごとの値（詳細）](https://www.data.jma.go.jp/stats/etrn/index.php) | 1955〜2025年の相対湿度、日照時間、降水量、降水日数（1mm以上） | 47代表地点を抽出。資料不足値は欠測、準正常値は品質情報を保持 | 県平均ではないことと日照計変更を表示。欠測を0として扱わない | **可** |

e-Statは[利用規約](https://www.e-stat.go.jp/terms-of-use)に基づき、出典を明示し、編集・加工した場合はその旨を表示します。閲覧時にe-Stat APIへ接続せず、取得・検証済みの表示用スナップショットを配信します。

原本の直接URL、対象集団、欠測処理、再生成方法と検証は[長期年次系列の実装記録](PREFECTURE_ANNUAL_HISTORY.md)を参照してください。この年次更新は、文書上部に示す利用条件の確認日を更新するものではありません。

## ORBITALの宇宙データ

| 提供元・データセット | 使用データ | 取得・加工 | 利用条件・表示 | 判定 |
|---|---|---|---|---|
| [NASA DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) | 太陽フレア、CME、磁気嵐、高エネルギー粒子 | 2024年5月の時刻、等級、速度、Kp、関連イベントを抽出して同梱 | NASA GSFC／DONKI、期間、項目、非公式可視化であることを表示 | **可** |
| [NASA/JPL CNEOS](https://cneos.jpl.nasa.gov/) | 小天体接近、火球 | 接近距離・速度、火球位置・エネルギー等を軌道や残光へ変換 | NASA/JPL CNEOS、取得条件、推定値を表示 | **可** |
| [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) | 系外惑星の距離、半径、質量、温度等 | 近傍1,000件から抽出して同梱 | [標準Acknowledgment](https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html)、データセットDOI、値の原文献を表示する必要がある | **条件付可** |
| [ISAS/JAXA DARTS Hayabusa2 LIDAR Bundle v2.0](https://doi.org/10.17597/isas.darts/hyb2-00500) | リュウグウまでの高度・時刻等 | Level 2時系列を抽出し、小惑星の輪郭と距離へ変換 | CC BY 4.0。DOI、版、データセット作成者、ISAS/JAXA DARTSを帰属表示 | **可** |

ORBITALは閲覧中に外部APIへ接続せず、`data/space-signals.json` に保存したスナップショットを表示します。データ更新時だけ `npm run data:space` を実行し、取得日時、期間、単位、加工、注意事項をJSONと画面に残します。

## 地図・地域コード・補助データ

| 提供元・データセット | 用途 | 利用条件・表示 | 判定 |
|---|---|---|---|
| [Natural Earth 1:50m Land / Countries](https://www.naturalearthdata.com/about/terms-of-use/) | 世界の陸地・国境GeoJSON | Public Domain。加工・電子配布・商用利用可。`Made with Natural Earth`を表示 | **可** |
| [地球地図日本／国土地理院](https://www.gsi.go.jp/kankyochiri/gm_jpn.html) | 変換済み47都道府県境界TopoJSON | 国土地理院出典を表示。測量成果の複製、商用再配布、生データ配布に当たる用途は個別確認 | **条件付可** |
| [OpenStreetMap Standard raster tiles](https://operations.osmfoundation.org/policies/tiles/) | センサー登録画面の都市地図 | `© OpenStreetMap contributors`を見える位置に表示。RefererとHTTPキャッシュを維持し、一括取得・先読み・オフライン保存・再配布を行わない | **条件付可** |
| [Unicode CLDR 48.2](https://cldr.unicode.org/) | 国・行政区分コードと英語名 | [Unicode License v3](https://www.unicode.org/license.txt)。許諾文を[地域コード出典](REGION-CODE-SOURCES.md)に保持 | **可** |
| [J-LIS 全国地方公共団体コード](https://www.j-lis.go.jp/spd/code-address/jititai-code.html) | 6桁自治体コードと名称 | 出所を表示。営利目的の複製や改変を伴う利用は[J-LIS条件](https://www.j-lis.go.jp/cms_1142.html)を個別確認 | **条件付可** |
| [国土地理院](https://maps.gsi.go.jp/)の自治体庁舎検索結果 | 日本のセンサー登録時の初期POI座標 | 国土地理院出典と、編集可能な初期値であることを表示 | **条件付可** |

## 現在の展示値に使っていない候補・補助実装

| 提供元・データ | 現在の状態 | 利用条件上の扱い | 判定 |
|---|---|---|---|
| NASA/JPL PO.DAAC OSCAR | 海流の取得候補。取得失敗のため現行展示値には不使用 | OSCARの値を表示していると誤認させない | **参照のみ** |
| NOAA NDBC latest observations | Pages APIの補助provider。現行MAPカードには不使用 | 将来使う場合は観測点、時刻、NOAA/NDBC、フォールバック状態を表示 | **参照のみ** |
| NOAA GML Mauna Loa hourly CO₂ | Pages APIの補助provider。現行MAPカードには不使用 | 将来使う場合は地点、観測時刻、速報性を表示 | **参照のみ** |
| JAXA GSMaP daily precipitation | 環境変数で有効化できる補助provider。通常は無効 | 有効化時はJAXA出典を表示し、[JAXA研究データ利用条件](https://earth.jaxa.jp/en/data/policy/)とデータ固有条件を再確認 | **条件付可／通常無効** |
| Copernicus Sentinel-5P L2 NO₂ NRTI | 認証設定時だけ有効な補助provider。通常は無効 | [Copernicus Data Space利用条件](https://dataspace.copernicus.eu/terms-and-conditions)を確認し、公開時は `Contains modified Copernicus Sentinel data [YEAR]` 相当の通知を表示 | **条件付可／通常無効** |
| `data/japan-earthquakes-fallback.json` | 現行コードから参照されない旧USGS保存値 | USGS出典を保持。公開物からの除外を推奨 | **可／未使用** |
| `assets/data/jaxa-fnf-riau.png` | 未使用画像 | 製作者指示により2026-09-07に作業ツリー・素材台帳から削除。本番の過去配信・Git履歴は未変更 | **削除済み** |

## 公開リポジトリに同梱する主なデータファイル

| ファイル | 内容 | 公開上の扱い |
|---|---|---|
| `data/gaia-signals.json` | MAP 01—09の観測値、加工値、シナリオ、出典メタデータ | 外部データを含む加工JSONとして監査対象 |
| `data/space-signals.json` | ORBITALのNASA／JPL／JAXAスナップショットと出典 | 外部データの再配布として引用・条件を維持 |
| `data/estat-prefecture-series.json` | e-Stat・気象庁の47都道府県時系列 | 「加工して作成」と出典を維持 |
| `data/firms-active-fire-snapshot.json` | FIRMS障害時の保存値 | NRT、抽出条件、生成日時を維持 |
| `data/ovation-aurora-snapshot.json` | OVATION障害時の保存値 | NOAA、予報時刻、保存値状態を維持 |
| `data/jma-intensity-history.json` | 気象庁の代表地震震度履歴 | 抽出・編集済みであることを維持 |
| `data/live-observation-fallback-v1.json` | Pages API障害時の同項目・同単位フォールバック | ライブ値と区別し、生成日時を表示 |
| `data/natural-earth-50m-land.geojson`、`data/natural-earth-50m-countries.geojson` | 世界地図形状 | Natural Earth Public Domain |
| `data/japan-prefectures.topojson` | 47都道府県境界 | 国土地理院由来であることを表示 |
| `assets/data/modis-land-cover-2023.png` | MODIS土地被覆の表示用画像 | NASA／MODIS／GIBSと加工表示を維持 |
| `assets/data/viirs-night-lights-2016.png` | VIIRS夜間光の固定表示画像 | NASA／VIIRS／GIBS、2016年固定と表示 |
| `assets/data/jaxa-fnf-riau.png` | 未使用画像 | **2026-09-07にローカル削除済み** |

GitHub上のファイルとCloudflare Pages上の静的ファイルは第三者が直接取得できるため、作品にダウンロードボタンがなくても「再配布」に含めて判断します。

## 表示する共通クレジット

作品内では、各展示の個別出典に加えて次の原則を使用します。

> GAIA SENSEWAREは、NASA、NOAA、USGS、気象庁、e-Stat、Open-Meteo、World Bank、JAXAほか各提供元のデータを、出典と加工内容を明示して可視化しています。表示はGAIA SENSEWAREによる非公式の加工表現であり、各提供元による承認・保証、公式警報、航海・防災・医療上の判断を示すものではありません。元データの権利と利用条件は各提供元に帰属します。

この共通文だけで個別データセットの帰属条件を置き換えることはできません。DOI、原提供元、CC BYの改変表示、OpenStreetMapの画面内帰属など、各行に記載した個別条件を併記します。

## 更新時の確認項目

- データセット名、版、公式URL、取得日時、対象期間、単位、空間・時間解像度を残す
- `licenseName`、`licenseUrl`、`attribution`、`modifiedNotice`、商用条件、再配布条件を確認する
- APIのレート制限、キャッシュ、認証情報、CORS、利用目的の条件を確認する
- 欠測、補間、集計、尺度変換、サンプリングを明記する
- 静的ファイルの追加は直接ダウンロード可能な再配布として再監査する
- `npm run check:contest`、`npm run check:rights`、該当するデータ検査を実行する
- 提供元の条件は変更され得るため、公開・応募・商用化の前に公式ページを再確認する

本書は利用状況を説明する技術・運用資料であり、弁護士による法律意見書ではありません。
