# 外部データ利用・二次加工・ダウンロード監査レポート

- 監査対象: GAIA SENSEWARE
- 監査日: 2026-09-04（日本時間）
- 監査対象リビジョン: 本レポートと同時に公開するコミット
- 対象範囲: 展示、ライブ表示、地図、統計ラボ、センサー登録で取得・同梱・参照する外部データ
- 対象外: 画像生成物、キャラクターCG、音源、フォント、npm依存パッケージ（別途メディア／ソフトウェア監査の対象）

提供元、使用データ、取得・加工方法、ライセンス表示を横断的に確認する場合は、先に[データ出典・ライセンス一覧](DATA_SOURCES.md)を参照してください。本レポートは判定根拠と未解決事項の正本です。

## 2026-09-07追補: 製作者判断と対応済み事項

- **GOSAT**: 製作者は非営利・公益目的の現行利用に問題ないと判断し、加工表示・表示用JSONの配信継続を指示した。[判断記録](GOSAT_OWNER_DECISION_2026-09-07.md)に基づき、書面許諾の取得待ちを公開前提条件とはしない。提供元の個別許諾を取得したという記録ではない。
- **JAXA FNF画像**: 未使用の `assets/data/jaxa-fnf-riau.png` は製作者指示で削除し、素材台帳からも除外。[整理記録](MEDIA_OWNER_DECISION_2026-09-07.md)を参照。
- **GBIF**: 既存62記録の出典・権利情報は `data/gbif-rights.json` へ補完済み。
- **世界遺産24地点**: 名称・座標・分類・地域の例示について、[製作者が現行利用の継続を了承](UNESCO_OWNER_DECISION_2026-09-07.md)。本項目も公開保留を解除し、個別書面許諾の取得待ちを公開前提条件とはしない。

以下の監査当初の記録のうち、上記項目の対応状態はこの追補で更新する。現行の公開判断は `docs/rights-review.json` を参照。

## 1. 結論と言明

本レポートは、リポジトリ内の取得スクリプト、同梱データ、画面表示、画面内での二次加工、公開ファイルとしての直接取得可能性を、各提供元の2026-09-02時点の公式利用条件と照合した結果である。統計ラボのCSV・JSON・PNGダウンロード機能は同日廃止済みである。

### 1.1 問題ないと言明できる範囲

本レポートで **「可」** としたデータは、各行に記載した出典表示、改変表示、免責、非推奨用途等の条件を守る限り、このサイトでの表示、記載した二次加工、加工結果のダウンロード提供に問題はないと判断し、その旨を言明する。

本レポートで **「条件付可」** としたデータも、各行の条件を満たす運用に限定すれば利用可能である。特に、商用運用を開始する場合の通知・契約、データセット単位の帰属表示、標準タイルの再配布禁止を守る必要がある。

### 1.2 サイト全体についての言明

**現状のサイトに含まれる全外部データについて、表示・二次加工・第三者ダウンロードのすべてに無条件で問題がない、とは言明できない。** 主な理由は次の4点である。

1. GOSATの公式利用条件は、データ製品・画像・関連文書の第三者への配布／譲渡を禁止している。現在は公式画像から復元した格子値とその補完値を `data/gaia-signals.json` に同梱している。
2. UNESCO World Heritage Centreは、データの再掲載に事前の書面許可を求めている。現在は選定した世界遺産データが同梱JSONと画面内分析の対象に入っている。
3. GBIFはレコードごとにCC0、CC BY、CC BY-NCのいずれかが適用されるが、現在の生成処理は各レコードのライセンス、データセット識別子、権利者情報を保存していない。
4. `assets/data/jaxa-fnf-riau.png` は公開配置されている一方、現在の展示から参照されず、個別の取得元・加工内容・適用条件を確定できない。JAXA FNFの元データそのものの再配布は禁止されている。

したがって、末尾の「必須是正」を完了するまでは、本レポートをサイト全体の無条件な権利保証書として使用してはならない。

> 本書は技術・運用上のライセンス監査記録であり、弁護士による法律意見書ではない。提供元の条件変更、第三者権利、準拠法上の最終判断まで保証するものではない。

## 2. 判定基準

| 判定 | 意味 |
|---|---|
| 可 | 現在の用途、二次加工、再配布が公式条件上許容される。記載した出典・免責等は必要 |
| 条件付可 | 用途、契約、商用性、データセット固有の帰属、配信方法等に条件がある |
| 要対応 | 現状の同梱またはダウンロード提供を問題なしとは言明できない |
| 参照のみ | 取得候補または説明資料であり、現行の展示値には使っていない |

「二次加工」には、抽出、単位換算、色・座標への変換、補間、集計、相関・回帰、画像化を含む。「ダウンロード」には、画面上の保存ボタンだけでなく、公開サイトから静的JSON、GeoJSON、TopoJSON、PNGへ直接アクセスできる状態も含む。

## 3. MAP 01〜09と関連レイヤーの外部データ一覧

| 展示／データ | このサイトでの利用・二次加工 | 公開／ダウンロード面 | 判定と条件 |
|---|---|---|---|
| NOAA SWPC OVATION 2020 | 30〜90分オーロラ予報を発光帯へ変換。5分更新、失敗時は同梱スナップショット | ライブJSONの加工表示、`data/ovation-aurora-snapshot.json` | **可**。NOAAを出典表示し、公式予報や保証済み観測と誤認させず、政府の推奨・承認を示唆しない |
| GOSAT FTS SWIR L3 XCO₂ | 公式閲覧画像の色から2.5°格子の近似ppmを復元し、8近傍IDW補完、時点間補間、過去年の空間再構成に使用 | 復元値・補完値を `data/gaia-signals.json` に同梱 | **製作者判断により継続**。非営利・公益目的で現行利用に問題ないと判断。出典・加工表示を維持。2026-09-07の判断記録を参照 |
| NOAA GML Mauna Loa CO₂ | 月平均を季節変化、長期傾向、過去再構成の濃度水準、直近120か月OLS試算へ使用 | 同梱JSON、画面内分析 | **可**。NOAA出典、改変・試算の明示、非公式加工物であることの明示が必要 |
| NASA GISS GISTEMP v4 | 全球気温偏差を背景色の応答へ変換 | 同梱JSON、加工表示 | **可**。NASA出典とデータセット引用を付し、NASAの承認を示唆しない |
| 気象庁 国内3地点CO₂ | 年平均を地点比較・統計教材へ使用 | 同梱JSON、画面内分析 | **可**。気象庁の出典と、編集した場合は編集した旨を表示。気象業務法上の予報・警報として提供しない |
| NASA/JPL PO.DAAC OSCAR | 海流データ候補として台帳に記載 | 取得失敗のため現行展示値には不使用 | **参照のみ**。表示値がOSCARであると誤認させない現行注記を維持 |
| NOAA CoastWatch Blended NRT currents | u/vから流速・流向を計算し、0〜14日の定常ベクトル移流を作品内計算 | 同梱JSON、統計・可視化 | **可**。NOAA出典、定常流を仮定した計算であること、公式予測でないことを明示 |
| NASA POWER | 31代表地点の風、降水、日射の気候値を抽出し、矢印、点、再生可能電力との比較へ使用 | 同梱JSON、画面内分析 | **可**。NASA POWERと元データを引用し、標本地点と気候値であることを明示 |
| NASA GIBS / MODIS MCD12Q1 | 2023年土地被覆WMSを1024×1024 PNGへ描画し、背景層に使用 | `assets/data/modis-land-cover-2023.png` | **可**。NASA／MODIS／GIBSを出典表示し、解析用の元画素ではなく表示画像である旨を維持 |
| GloBI pollination interactions | `Apis mellifera` の送粉関係を抽出し、非地理ネットワークへ変換 | 同梱JSON、画面内分析 | **可**。GloBIデータは原則CC BY 4.0。GloBIと可能な限り元データセットを帰属表示する |
| GBIF occurrences | 31か国から座標付き記録を最大2件ずつ抽出し、観察点と統計教材へ使用 | 同梱JSON、画面内分析 | **要対応**。レコードごとのライセンスと所有者識別子を保持していないため、再配布条件を検証できない |
| UN SDG 12.5.1 | 各国の最新非欠測値を抽出。欠測国は地理的5近傍中央値で補完し、SOURCEとIMPUTEDを分離 | 同梱JSON、画面内分析 | **条件付可**。UNdataを出典表示すれば複製・再配布可能。元の担当機関、報告年、補完箇所、加工者を明記する |
| Global Carbon Project / CICERO GCB2024 | 31か国の1945〜2023年の化石燃料由来CO₂を抽出し、記号半径を対数尺度化 | 同梱JSON、画面内分析 | **可**。CC BY 4.0として著者、版、DOI、変更内容を表示する |
| NASA GIBS / VIIRS Night Lights | 2016年WMSを固定背景PNGへ変換し、排出量とは独立した参照面として表示 | `assets/data/viirs-night-lights-2016.png` | **可**。NASA／VIIRS／GIBS出典、2016年固定参照である旨を維持 |
| 気象庁 震度データベース | 代表6地震の震度6弱以上の地点を抽出 | `data/jma-intensity-history.json` | **可**。出典と抽出・編集内容を明示し、公式警報・公式原票と誤認させない |
| USGS FDSN Event Web Service | M7.5以上の世界地震を取得し、年別集計と発生間隔へ加工 | 同梱JSON、画面内分析 | **可**。USGS出典、取得条件、加工内容を表示。第三者著作物が個別に示される場合はその条件を優先 |
| World Bank WDI: Forest area | 最新の森林率を31か国で抽出し、都市化率と比較・相関 | 同梱JSON、画面内分析 | **可**。WDIのCC BY 4.0、World Bankと原提供元FAOの帰属、変更表示が必要 |
| World Bank WDI: Urban population | 最新の都市人口率を31か国で抽出し、森林率・排出量と比較 | 同梱JSON、画面内分析 | **可**。World Bankと原提供元UN Population Divisionを帰属表示し、変更を示す |
| UNESCO World Heritage List | 世界各地域から24地点を独自選定し、名称・位置・分類・地域を文化・記憶レイヤーで紹介。森林率・都市人口率の相関計算とは分離 | 同梱JSON、MAP 12の「03 文化・記憶」 | **製作者判断により継続**。2026-09-07の判断記録に基づき、出典リンクと24例の説明を維持 |
| World Bank WDI: Renewable electricity | 最新の再生可能電力比率を31か国で抽出し、POWERの自然条件と比較・回帰 | 同梱JSON、画面内分析 | **可**。CC BY 4.0の帰属、原提供元、変更表示が必要 |
| World Bank WDI: Population, total | 1960年以降の国別人口を時系列表示 | 同梱JSON、統計ラボへの将来連携対象 | **可**。CC BY 4.0の帰属、原提供元UN Population Division、変更表示が必要 |

### 3.1 日本・47都道府県展示16〜25

| 展示／公的統計 | 収録範囲と二次加工 | 公開／ダウンロード面 | 判定と条件 |
|---|---|---|---|
| 16 人の潮目／総務省「住民基本台帳人口移動報告」月報 | 2026年2〜6月、47都道府県の転入超過数。JIS X 0401順に抽出し、正負・絶対値を流向、色、環の長さへ変換 | `data/estat-prefecture-series.json` を表示用スナップショットとして配信。サイト内のデータ書き出し機能は設けない | **可**。e-Statおよび統計名を出典表示し、「加工して作成」であることを明示する |
| 17 旅の灯／観光庁「宿泊旅行統計調査」第2次速報 | 2026年2〜6月、47都道府県の延べ宿泊者数。値を灯の面積、光量、余韻へ変換 | 同上 | **可**。出典・加工表示を維持し、速報値を確定値と誤認させない |
| 18 住まいの芽吹き／国土交通省「建築着工統計調査（住宅着工統計）」 | 2026年2〜6月、47都道府県の新設住宅着工戸数。値を光柱の高さ、太さ、枝分かれへ変換 | 同上 | **可**。出典・加工表示を維持する |
| 19 空の体温／気象庁「過去の気象データ検索・年ごとの値」 | 1955〜2025年、47都道府県の代表気象台・測候所における年平均気温。71年間共通尺度で熱の光環へ変換 | `data/estat-prefecture-series.json` を表示用スナップショットとして配信。地点ごとの公式年次表へリンク | **可**。気象庁を出典表示し、観測点移転・観測方法・都市化の影響を含む系列であることを明記する |
| 20 日最高気温の年平均 | 1955〜2025年、毎日の日最高気温を年単位で平均した値。夏だけの平均や単日の最高記録ではないことを明記して陽炎へ変換 | 同上 | **可**。指標の定義と観測地点を省略せず表示する |
| 21 日最低気温の年平均 | 1955〜2025年、毎日の日最低気温を年単位で平均した値。冬だけの平均ではなく、低いほど強い氷晶として反転尺度で描画 | 同上 | **可**。反転尺度の加工を説明し、単日の最低記録と誤認させない |
| 22 湿りの膜／同 `#B02201` | 2020〜2024年、年平均相対湿度。水膜の広がりへ変換。公式表の欠測1セルは補完しない | 同上 | **可**。欠測を0扱いせず「欠測」と表示する |
| 23 光の貯金／同 `#B02401` | 2020〜2024年、年間日照時間。光条の長さと密度へ変換。公式表の欠測1セルは補完しない | 同上 | **可**。出典・加工・欠測表示を維持する |
| 24 雨の器／同 `#B02402` | 2020〜2024年、年間降水量。雨筋と波紋へ変換。公式表の欠測2セルは補完しない | 同上 | **可**。出典・加工・欠測表示を維持する |
| 25 雨の足跡／同 `#B02303` | 2020〜2024年、年間雨日数。波紋の層へ変換。公式表の欠測1セルは補完しない | 同上 | **可**。降水量と雨日数を混同せず、欠測表示を維持する |

10統計は、e-Statの月次3展示、自然環境の年次4展示、気象庁の長期気温3展示に分け、都道府県を網羅し期間内の変化が視覚的に現れる指標として選定した。長期気温は1955〜2025年の71年分を採用し、長期系列を確保できない県庁所在地については同一都道府県内の熊谷、銚子、彦根、下関を代表観測点とした。これは各地点で観測された気温の推移であり、都市化や観測環境の変化を除去した地球温暖化の寄与推定ではない。残る年次4展示は「統計でみる都道府県のすがた」2022〜2026年版のB表をつなぎ、各表の指標年度2020〜2024年を採用した。ブラウザから外部APIへ接続せず、取得・検証済みの公式データを表示用JSONへ加工している。表示時のe-Stat APIキー、D1読み取り、外部APIリクエストは発生しない。

### 3.2 全球展示26「燃える惑星」

| 展示／データ | 収録範囲と二次加工 | 公開／ダウンロード面 | 判定と条件 |
|---|---|---|---|
| NASA LANCE FIRMS / MODIS Collection 6.1 NRT Global 24h | 全球の直近24時間の火災・熱異常検知から信頼度60以上を抽出。2.5度・1時間の時空間セルごとにFRPと信頼度を加味した代表点を残し、最大1,600点へ制限。観測時刻を点灯順、FRPを粒径、信頼度を透明度、昼夜フラグを炎色へ変換 | 本番はWorkerで15分論理キャッシュし、失敗時は `data/firms-active-fire-snapshot.json` を配信。スナップショットには緯度経度、brightness、FRP、confidence、daynight、観測時刻、衛星識別子を収録 | **可**。NASA LANCE FIRMSを明示し、火災境界ではなく衛星の熱異常代表点であること、NRTデータであること、抽出・間引き済みであることを表示する。NASAの承認を示唆せず、出典URL・データセット名・加工内容を維持する |

MODISの公称空間分解能は1 kmであり、点の光環は焼失面積や火災範囲を表さない。誤認を防ぐため画面内にこの注意を常設し、「森林火災」だけに限定せず「火災・熱異常」と表記する。API応答は4 MBを上限に検査し、ブラウザへ渡す点数を制限する。FIRMSの公開24時間CSVをWorkerが取得するため、認証キーをクライアントへ配布しない。

### 3.3 全球展示27〜30「LIVE OPEN DATA」

| 展示／データ | 取得範囲と二次加工 | 公開／ダウンロード面 | 判定と条件 |
|---|---|---|---|
| 27 大気をなぞる／Open-Meteo Forecast API | 球面上へ均等配置した全球240サンプル点から風速、風向、地表気圧を取得。風向を光跡の進行方向、風速を移動速度と線長、気圧を色へ変換 | 48地点ずつ5リクエストに分け、取得値はセッション中だけ5分キャッシュ。ファイル書き出しは行わず、通信失敗時はコード内の保存値へ切り替え | **条件付可**。Open-Meteoおよび元モデル提供者を表示し、格子モデル値を観測所実測や補間済み連続場と誤認させない。無料APIの非商用条件と呼出上限を守る |
| 28 大気の散乱／Open-Meteo Air Quality API / CAMS | 同じ全球240サンプル点のPM2.5と550 nmエアロゾル光学的厚さをCAMS Globalから取得。値を光環の半径、色、浮遊粒子密度へ変換 | 同上 | **条件付可**。Open-MeteoとCAMSを表示し、11〜45 km級の格子モデル値であることを維持する |
| 29 地殻の波紋／USGS All Earthquakes Past Day GeoJSON Feed | 全球の直近24時間に収録された全規模イベントを最大1,000件取得。緯度経度を震源位置、マグニチュードを波紋半径、発生時刻を表示順へ変換 | 取得値はセッション中だけ5分キャッシュ。再配布用ファイルは生成しない | **可**。USGS、取得条件、加工内容を表示し、波紋を震度分布や被害範囲と誤認させない |
| 30 雲を透る光／Open-Meteo Forecast API | MAP 27と同じ全球240サンプル点の雲量と短波放射を取得。雲量を光点の開き、短波放射を光量と半径へ変換 | MAP 27の5分キャッシュを共有し、追加取得とファイル書き出しは行わない | **条件付可**。格子モデル値であること、地点間を補間した連続分布ではないことを表示する |

4展示はいずれもAPIキーをクライアントへ埋め込まない。外部取得値は表示と描画にだけ用い、ダウンロード機能や永続保存を提供しない。画面には提供元、データ時刻、ライブ／キャッシュ／保存値の状態を常設する。

## 4. 宇宙展示の外部データ一覧

`data/space-signals.json` は閲覧時に外部APIへ接続せず、取得済みスナップショットを配信する。したがって、このJSONの公開はデータの再配布に当たる。

| データ | 利用・二次加工 | 判定と条件 |
|---|---|---|
| NASA DONKI FLR / CME / GST / SEP | 時刻、等級、速度、Kp、関連イベント等を抽出し、光・円弧・磁力線・粒子へ変換 | **可**。NASA出典、取得期間、抽出項目、非公式可視化であることを表示 |
| NASA/JPL CNEOS CAD | 2024年の接近記録を抽出し、距離と速度を軌道表現へ変換 | **可**。NASA/JPL CNEOS出典と取得条件を表示 |
| NASA/JPL CNEOS Fireball | 火球の位置、エネルギー、速度を残光表現へ変換 | **可**。NASA/JPL CNEOS出典と推定値である旨を表示 |
| NASA Exoplanet Archive | 近傍1000件から距離、半径、質量、温度等を抽出し、同心円・色・大きさへ変換 | **条件付可**。Archiveの標準Acknowledgment、DOI、各文献由来値の引用を公開物へ付す |
| ISAS/JAXA DARTS Hayabusa2 LIDAR | Level 2時系列から高度・時刻等を抽出し、小惑星輪郭へ変換 | **可**。LIDAR BundleはCC BY 4.0。DOI `10.17597/isas.darts/hyb2-00500` とISAS/JAXA DARTSを帰属表示する |

## 5. MAP 10〜15のPages APIと補助provider

| データ | 現在の用途と取得・加工 | 判定と条件 |
|---|---|---|
| Open-Meteo Forecast | MAP 10「風脈」は47都道府県代表都市の風速モデル値を5分キャッシュで取得。MAP 12〜14は選択都市（初期値は東京）の降水量、地上2m気温、総雲量を30分キャッシュで取得 | **条件付可**。Open-Meteoと元モデル提供者を表示し、モデル値を観測所の実測と誤認させない。無料APIの非商用条件と呼出上限を守る |
| Open-Meteo Air Quality / CAMS | MAP 11「炭素の呼吸」と15「微粒子の霞」で、選択都市の格子CO₂予測値とPM2.5予測値を最大3時間キャッシュ。現在値を光環・呼吸周期・粒子密度へ変換 | **条件付可**。Open-MeteoとCAMS／各元モデルを表示し、モデルの格子値・予測値であることを維持する |
| NOAA NDBC latest observations | Pages APIの補助providerとして風速・風向・気温を取得可能。現行MAP 10〜15のカード表示値には使用しない。取得失敗時はprovider単位の保存値へ切替 | **可**。将来表示へ使う場合はNOAA/NDBC、観測点、観測時刻、フォールバック状態を明示する |
| NOAA GML Mauna Loa hourly CO₂ | Pages APIの補助providerとしてERDDAPの最新時別値を取得可能。現行MAP 10〜15のカード表示値には使用しない | **可**。将来表示へ使う場合はNOAA/GML、地点、時刻、速報性を明示する |
| JAXA GSMaP daily precipitation | `LIVE_SENSEWARE_JAXA_ENABLED=true` の場合だけ補助providerとして取得。現行MAP 10〜15のカード表示値には使用せず、通常は無効 | **条件付可**。JAXA出典が必要。商用利用時は事前通知が必要 |
| Copernicus Sentinel-5P L2 NO₂ NRTI | `LIVE_SENSEWARE_ESA_ENABLED=true` と認証情報がある場合だけ補助providerとして取得。現行MAP 10〜15のカード表示値には使用せず、通常は無効 | **可**。公開・配布時は「Contains modified Copernicus Sentinel data [YEAR]」相当の通知を付す |

Pages APIは `/api/live/v1/snapshot`、`/stream`、`/wind-field` を使用する。画面には提供元、地点、JPTのデータ時刻、ライブ／保存値の状態を表示する。各providerの取得失敗は別providerの値で穴埋めせず、同じ項目・地点・単位のキャッシュまたは版管理スナップショットへ退避する。

## 6. 地図・地域コード・補助データ

| データ | 利用・公開状態 | 判定と条件 |
|---|---|---|
| Natural Earth 1:50m Land / Countries | GeoJSONを同梱し、Canvasで陸地・国境を描画 | **可**。Public Domain。加工・電子配布・商用利用可。任意の推奨表記「Made with Natural Earth」を維持するとよい |
| 地球地図日本／国土地理院（dataofjapan変換TopoJSON） | 47都道府県境界を同梱し、地図に重ねる | **条件付可**。現行の展示は出典表示で利用可能と判断。生TopoJSON再配布、商用利用、測量成果としての複製に該当する用途はGSI条件・測量法上の手続を個別確認する |
| OpenStreetMap Standard raster tiles | `tile.openstreetmap.org` を都市地図の表示に使用 | **条件付可**。画面表示は可。見える位置の帰属、Referer、HTTPキャッシュを維持し、タイルの一括取得・オフライン保存・再配布を提供しない。高負荷時は別プロバイダまたは自己ホストへ移行 |
| Unicode CLDR 48.2 | 国・行政区分コードと英語名を生成 | **可**。Unicode License v3の許諾文を付属文書へ保持する。`docs/REGION-CODE-SOURCES.md` に全文を収録済み |
| J-LIS 全国地方公共団体コード | 6桁コードと自治体名だけを抽出し、センサー登録候補へ使用 | **条件付可**。出所明示が必要。J-LISサイト条件は営利目的の複製に事前相談を求め、無断改変を認めていない |
| 国土地理院の自治体庁舎検索結果 | 日本地域選択時の初期POI座標としてキャッシュ | **条件付可**。公開POIであること、初期値であること、GSI出典を表示。地図・測量成果の再配布として使う場合は個別確認する |
| `data/japan-earthquakes-fallback.json` | USGS週間M2.5+フィードの旧フォールバック。現行コードから参照されないが公開配置 | **可**。USGS出典を保持。不要なら公開対象から除外する方が台帳を簡潔にできる |
| `assets/data/jaxa-fnf-riau.png` | 未使用 | **削除済み（2026-09-07）**。製作者指示で作業ツリーと素材台帳から除外。本番の過去配信・Git履歴は未変更 |

## 7. 参考文献としてのみ使用する外部情報

`data/gx-deep-time.json` のInternational Chronostratigraphic Chart、USGS解説、国立科学博物館、IUGS/ICS、PNAS、Nature等は、年代・地質説明の事実確認と出典リンクに使っている。論文本文、図版、表を同梱・再配布していないため、本監査では「外部データの再配布」ではなく参考文献・要約として扱う。

要約はサイト独自文であり、出典リンクを維持し、原文・図表の大量転載を行わない限り、現在の使い方に問題はないと判断する。

## 8. 現在のダウンロード経路と評価

### 8.1 静的ファイルの直接取得

Cloudflare Pagesの公開ルートにある次のファイルは、画面にダウンロードボタンがなくてもURLを知れば取得できる。

- `data/gaia-signals.json`
- `data/space-signals.json`
- `data/gx-deep-time.json`
- `data/jma-intensity-history.json`
- `data/japan-earthquakes-fallback.json`
- `data/live-observation-fallback-v1.json`
- `data/estat-prefecture-series.json`
- `data/firms-active-fire-snapshot.json`
- `data/ovation-aurora-snapshot.json`
- `data/natural-earth-50m-land.geojson`
- `data/natural-earth-50m-countries.geojson`
- `data/japan-prefectures.topojson`
- `assets/data/modis-land-cover-2023.png`
- `assets/data/viirs-night-lights-2016.png`
- `assets/data/jaxa-fnf-riau.png`（監査当時。2026-09-07にローカル削除済み）

このため、公開リポジトリへの同梱とPagesへの配置は「表示だけ」ではなく、複製物または加工物の配布として判定した。

### 8.2 統計ラボの書き出し（廃止済み）

2026-09-02に、統計ラボから選択データをCSV／JSONへ、グラフをPNGへ保存するボタン、生成処理、公開JavaScript APIをすべて削除した。分析結果は画面内表示に限定され、統計ラボ内に `download` 属性を持つ要素も存在しない。

この変更により、GBIF、UNESCO、GloBI、World Bank等の外部データをサイト機能からファイルとして書き出す経路はなくなった。ただし、8.1の公開静的ファイルはアプリ表示に必要な配信物であり、URLから直接取得できる状態が残るため、再配布条件の監査対象からは外せない。

### 8.3 外部の「元データを開く」リンク

公式サイトを新しいタブで開くだけの導線は、このサイトによる再配布ではない。リンク先の利用者が公式条件に従って取得するため、同梱データより権利上のリスクは低い。

## 9. 必須是正

### 優先度P0: 全体を「問題なし」と言明する前に必要

1. **GOSAT / 対応済み**: 2026-09-07の製作者判断により現行利用を継続し、書面許諾の取得待ちによる公開保留を解除。出典・加工表示を維持する。
2. **UNESCO / 対応済み**: 世界遺産24地点の基本情報の例示を、2026-09-07の製作者判断により継続。個別書面許諾の取得待ちによる公開保留を解除。
3. **GBIF**: 取得時に `license`、`datasetKey`、`publishingOrgKey`、`occurrence key`、`references` を保存する。商用利用を想定する場合はCC BY-NCを除外し、各レコードの所有者識別子とデータセット引用を再配布物に残す。
4. **JAXA FNF未使用PNG / 対応済み**: `assets/data/jaxa-fnf-riau.png` は製作者指示により削除し、素材台帳から除外。

### 優先度P1: 条件履行を機械的に保証するために必要

5. 各データセットへ `licenseName`、`licenseUrl`、`attribution`、`modifiedNotice`、`commercialUse`、`redistribution` を持たせる。
6. 廃止したCSV／JSON／PNG書き出しを、権利メタデータと再配布条件の再監査なしに復活させない。
7. Open-Meteoの `licenseUrl` を料金ページではなく公式の `/en/terms` または `/en/licence` に変更し、無料APIは非商用であることを運用文書へ明記する。
8. JAXA GSMaPを商用運用する場合はJAXAへ事前通知する。Open-Meteoを商用運用する場合は有料契約またはセルフホストへ切り替える。
9. DARTS LIDAR、NASA Exoplanet Archive、World Bank原提供元、GloBI元データセットの引用を画面と書き出しへ追加する。
10. READMEの「EDGAR」表記を、実装どおりGlobal Carbon Project / CICEROへ統一する。

### 優先度P2: 配信事故を防ぐ運用改善

11. OpenStreetMap標準タイルをダウンロード対象から明示的に除外し、アクセス増加時は利用量を保証するタイル事業者または自己ホストへ移行する。
12. 公開ビルドの許可リストを作り、未使用の外部データファイルを自動的に配信しない。
13. データ更新時に、データセット版、取得日時、ライセンスURL、SHA-256、加工スクリプト版をCIで検査する。

## 10. 是正後に使用できる最終言明文

P0とP1を完了し、再監査で差分がないことを確認した後は、次の文言を公開レポートの結論として使用できる。

> GAIA SENSEWAREが利用する外部データについて、提供元、取得日、適用ライセンス、加工内容、表示箇所、ダウンロード経路を確認した。各データは、出典表示、改変表示、用途・商用条件、再配布条件を満たす範囲で利用しており、サイト上の表示、明記した二次加工、出典・ライセンスを伴う加工結果のダウンロードに、監査日時点で判明している権利上の問題はない。元データの権利は各提供元に帰属し、本サイトは提供元の承認・保証を示唆しない。

現状はP0未完了のため、この最終言明文はまだ適用しない。

## 11. 根拠となる公式利用条件

- [NOAA National Ocean Service Disclaimer](https://oceanservice.noaa.gov/disclaimer.html)
- [NOAA digital media copyright guidance](https://sos.noaa.gov/copyright/)
- [NASA Earthdata: Data Use and Citation Guidance](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy)
- [Natural Earth: Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/)
- [気象庁ホームページ利用規約](https://www.jma.go.jp/jma/kishou/info/coment.html)
- [USGS Copyrights and Credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)
- [NIES GOSAT Project: Site Policy](https://www.gosat.nies.go.jp/eng/about/policy.htm)
- [World Bank Data Catalog: Data Access and Licensing](https://datacatalog.worldbank.org/public-licenses)
- [GBIF Terms of Use](https://www.gbif.org/terms)
- [GBIF Data User Agreement](https://www.gbif.org/terms/data-user)
- [GloBI repository and data license](https://github.com/globalbioticinteractions/globalbioticinteractions)
- [UNdata Terms and Conditions of Use](https://data.un.org/Host.aspx?Content=UNdataUse)
- [Global Carbon Project fossil CO₂ dataset, DOI 10.5281/zenodo.13981696](https://zenodo.org/records/13981696)
- [Open-Meteo Terms](https://open-meteo.com/en/terms)
- [Open-Meteo Data Licence](https://open-meteo.com/en/licence)
- [Copernicus Data Space Ecosystem Terms and Conditions](https://dataspace.copernicus.eu/terms-and-conditions)
- [Copernicus Sentinel data use summary](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S3OLCIL2.html)
- [JAXA Terms of Use of Research Data](https://earth.jaxa.jp/en/data/policy/)
- [JAXA ALOS FNF data use notice](https://www.eorc.jaxa.jp/ALOS/palsar_fnf/fnf_jindex20140116.htm)
- [Hayabusa2 LIDAR Bundle, DOI 10.17597/isas.darts/hyb2-00500](https://darts.isas.jaxa.jp/doi/hyb2/hyb2-00500.html)
- [NASA Exoplanet Archive acknowledgment guidance](https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html)
- [UNESCO/WHC data conditions of use](https://whc.unesco.org/en/faq/126)
- [国土地理院 地球地図日本](https://www.gsi.go.jp/kankyochiri/gm_jpn.html)
- [国土地理院 地図の利用手続](https://maps.gsi.go.jp/help/intro/general/tetuduki.html)
- [OpenStreetMap Standard Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [Unicode License v3](https://www.unicode.org/license.txt)
- [J-LIS リンク・著作権について](https://www.j-lis.go.jp/cms_1142.html)
- [e-Stat 利用規約](https://www.e-stat.go.jp/terms-of-use)
- [e-Stat API 3.0 利用ガイド](https://www.e-stat.go.jp/api/api-info/e-stat-manual3-0)
- [e-Stat「統計でみる都道府県のすがた2026」B 自然環境](https://www.e-stat.go.jp/stat-search/files?cycle=0&layout=datalist&lid=000001477298&month=0&page=1&stat_infid=000040412523&tclass1=000001240737&tclass2val=0&toukei=00200502&tstat=000001240736&year=20260)
- [気象庁「過去の気象データ検索・年ごとの値（詳細）」](https://www.data.jma.go.jp/stats/etrn/index.php)
- [NASA FIRMS Active Fire Data](https://firms.modaps.eosdis.nasa.gov/active_fire/)
- [NASA FIRMS MODIS Fire / Hotspot field descriptions](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_MODIS_Firehotspots.html)
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)
- [USGS Earthquake GeoJSON Summary Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
- [NOAA SWPC Real-Time Solar Wind](https://www.swpc.noaa.gov/products/real-time-solar-wind)

## 12. 監査した実装箇所

- `scripts/build-gaia-data.mjs`: MAP 01〜09と関連レイヤーの取得・抽出・加工
- `data/gaia-signals.json`: 同梱データ、SOURCE／DERIVED／SCENARIO台帳
- `scripts/build-space-data.mjs`, `data/space-signals.json`: 宇宙展示の取得とスナップショット
- `sensor-platform/src/live-senseware.ts`, `data/live-observation-fallback-v1.json`: ライブ取得、キャッシュ、フォールバック
- `app.js`, `space-mode.js`, `data-ledger.js`: 表示、地図、出典UI
- `statistics-lab.js`: ブラウザ内の分析・画面表示（ファイル書き出しなし）
- `scripts/build-region-code-data.mjs`, `sensor-platform/src/region-code-data.ts`: CLDR・J-LIS地域コード
- `scripts/build-jma-prefecture-temperature-history.mjs`, `src/exploration/estat-exhibits.js`, `src/exploration/estat-prefecture-data.js`, `data/estat-prefecture-series.json`: e-Stat都道府県月次・年次自然環境展示、気象庁71年気温系列、表示用スナップショット
- `scripts/build-firms-active-fire-snapshot.mjs`, `src/exploration/firms-exhibit.js`, `sensor-platform/src/live-senseware.ts`, `data/firms-active-fire-snapshot.json`: FIRMS取得、時空間サンプリング、15分キャッシュ、WebGL火災展示
- `src/exploration/planet-signals-exhibit.js`, `planet-signals-exhibit.css`, `scripts/check-planet-signals-browser.mjs`: 全球ライブデータ5展示の取得、セッションキャッシュ、Canvas粒子・波紋描画、PC／モバイル検証
- `data/japan-prefectures-NOTICE.md`, `docs/REGION-CODE-SOURCES.md`: 地図・コードの既存出典記録
