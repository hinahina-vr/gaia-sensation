# 展示31〜64：下部タイトル幅とPOIの順次出現

検証日：2026-09-09。ローカル修正・検証完了。push / deploy / 配布物の作成なし。

## 対象

- 依頼：31以降の下部タイトルを見切れない幅に広げ、POIをセパレーターが消えてから順番にポコポコ出す。
- 基点：`2a4f51385b69a0fda1ef285b0058acae7207640b` の既存作業ツリー。先行の汚染展示・操作欄・書体変更を保持。今回の差分は未コミット。
- Chrome実ブラウザー、ローカル静的プレビュー `http://127.0.0.1:4485`。観測データはリポジトリの実データを使用し、外部HTTPS通信は遮断。スマホはタッチ／画面サイズのエミュレーションであり、物理端末や本番配信の確認ではない。

## 変更

- `marine-cod-exhibit.css`：タイトル列を内容に応じて拡張。901〜1399pxでは選択・年度とタイトル・値・アクションを2段に配置。長い説明に必要な高さは自動調整。セパレーター表示中はPOIキャンバスを非表示。
- `map-chapter-navigation.css`：31〜64のタイトルを省略せず表示。既存書体・文字サイズは維持。右矢印を拡張された列の右端に固定し、文字への重なりを防止。
- `src/exploration/annual-poi-arrival.js`：各地点に別の開始時刻を持つ、小さな拡大・フェード出現。最初の110msを置き、広がりは最大1800ms、各点520ms、全体最大2430ms。地点ごとのタイマーは作らない。
- `src/exploration/marine-cod-exhibit.js`：セパレーター終了と初期カメラ移動完了後の描画フレームから出現を開始。遅延読込でも演出時間を確保。未出現の地点は当たり判定から除外。年度操作では再演せず、展示切替ではリセット。
- 動きを減らす設定では、セパレーターが消えてからバウンドなしで表示。
- `gaia-mode-loader.js`、`src/exploration/index.js`、`index.html`：変更したCSS／JSの参照に `title-poi-20260909` を追加。
- 01〜30用の既存 `src/exploration/poi-arrival.js` は最終的にHEADと同一。実装途中のモジュール名衝突で起動試験が失敗したため、31以降の処理を専用ファイルへ分離し、起動から再試験済み。

## 再現・検証結果

証跡ルート：`artifacts/annual-title-poi-2026-09-09/`。各フォルダーに `report.json` とスクリーンショット。

- 修正前 `before/`：31のタイトル領域は1440px幅で約133px、1024px幅で約88pxしかなく、全文が省略される画面を記録。
- 修正前 `motion-before/`：展示38への切替中、セパレーターの下に実際のPOI描画が残ることを再現。1440px幅で5882画素、390px幅で5157画素。
- `layout-final/`：140ケース合格。1440×900・390×844では31〜64全展示、3840×2088・1920×1080・1280×800・1024×768・901×768・320×568・844×390では代表9展示。各画面で30も書体比較の基準として確認。全文幅、左右矢印、操作対象の当たり判定、値・操作欄の包含、横スクロールなしを検証。
- `title-boundaries/`：追加16ケース合格。1280×800・1024×768・901×768・1400×900で30・52・63・64。長い「THC・炭化水素をまとめて見る」も約300pxの文字幅を確保し、省略なし・右矢印との重なりなし。
- `motion-after-fixed/`：1440px・390px × 通常・動きを減らす × 展示38・63・31の12ケース合格。セパレーター中の可視POI描画0画素、最初の描画はセパレーター消失後。最終38／8336／2042地点。通常設定では段階的に可視地点数が増えることを実キャンバスの画素・フレーム記録で確認。
- `motion-final/`：矢印位置の最終CSS変更後、展示38のPC・スマホ／通常・動きを減らすの4ケースを再確認。専用ヘルパーを含む最終アセットハッシュを保存。
- `edge-cases/`：本物の展示38のJSON要求を4500ms遅らせ、セパレーター消失後も待機し、到着後に演出を最初から行うことを確認。未出現地点への実クリックでは選択されず、出現後に同位置のクリックで選択。年度変更で再演しない。31の出現中→44のセパレーター中→38と連続切替して、古い点や遅れて届くデータが混ざらないことを確認。
- `interaction-regression/`：1440×900・390×844で既存COD操作を再検証。512倍ズーム、密集地点の個別クリック／タップ、ホイール、ドラッグ、実ブラウザーの2本指ピンチ、同一座標地点の選択、凡例の実画素色、他展示への切替でズーム上限が戻ることを確認。
- 出典パネル、統計分析、年度キー操作・自動送り、展示一覧・前後移動もレイアウト試験の代表ケースで実操作。全最終ブラウザー試験のpageerrorは0件。
- 構文チェック、`check-poi-arrival.mjs`、`check-poi-light-bloom.mjs`、`npm run check:japan-pollution`、`npm run check:japan-sensor-open`、`npm run check:marine-cod`、`check-mode-loader-prefetch.mjs`、`git diff --check` 合格。

中間失敗の `layout-probe/`、`layout-probe-fixed/`、`motion-after/` は最終版の証跡ではない。最終レイアウト・境界・motion-final・edge-cases・interaction-regression各レポートの対象アセットと作業ツリーのハッシュ一致を確認済み。

## 再実行

```powershell
node scripts/serve-novel-preview.mjs 4485
```

別のPowerShellで実行する。

```powershell
$env:GAIA_BASE_URL='http://127.0.0.1:4485'
$env:GAIA_OUTPUT_DIR='artifacts/annual-title-poi-2026-09-09/layout-rerun'
$env:ANNUAL_UI_SIZES='1440x900,390x844,3840x2088,1920x1080,1280x800,1024x768,901x768,320x568,844x390'
node scripts/check-annual-dock-style-browser.mjs
$env:GAIA_OUTPUT_DIR='artifacts/annual-title-poi-2026-09-09/motion-rerun'
node scripts/check-annual-poi-arrival-browser.mjs
$env:GAIA_OUTPUT_DIR='artifacts/annual-title-poi-2026-09-09/edge-rerun'
node scripts/check-annual-poi-edge-browser.mjs
$env:GAIA_OUTPUT_DIR='artifacts/annual-title-poi-2026-09-09/interaction-rerun'
$env:COD_UI_SIZES='1440x900,390x844'
node scripts/check-marine-cod-ui-browser.mjs
```

ブラウザー試験には既存の `playwright-core` とインストール済みChromeが必要。現在のレイアウト試験は代表サイズの既定対象に52も追加しているため、再実行時は今回の140ケースより多くなる。

## 最終版のSHA-256

```text
src/exploration/annual-poi-arrival.js  7a0f81c8d7bf294c5d2edb6d0aaaea53c242256b5c170ddc1b59de615594607c
src/exploration/marine-cod-exhibit.js  2a9ee1869e3215f6f00276ea7c7d6c7a4cce1fa6db0228b46dd125a47bc20cbe
marine-cod-exhibit.css  60d3b9f5722a643eeac20d0657281393be8f31f809fa1ed3435d89fcd70b1a17
map-chapter-navigation.css  96e240025fb56a24071c35d6c8eac701ba9a3b82f4ba9d21980bd42d4594f51e
gaia-mode-loader.js  e2059ae977f88b8c32fd029ca5546493c1aa29e93c59784200b7dd2b60cd827f
src/exploration/index.js  474411a6b78fb2b23302a554de549c4abe48a34e173b37e00b2f2f918a94ca3c
index.html  6975c5c5cc77c114650431daa93fbf41e91d68d8ede7495618e599d2288bfba7
```

未確認：本番配信、物理スマホ、Safari／Firefox、ライブ外部データとの通信。この変更に保存形式・書き出し・ZIP配布はないため、新規展開試験は対象外。
