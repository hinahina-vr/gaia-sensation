# 表示を維持するリファクタリング・性能診断（2026-09-22）

## 結論と対応範囲

モード読込の共通処理を整理し、変更前 `0bf1d94` と表示・依存ファイル・実行順を比較した。CSS、画像、文言、演出時間、保存形式は変更していない。性能改善は候補と根拠を洗い出した段階で、画質低下や先読み方針の変更はしていない。

今回の実装は全モード共通の入口に限定した。`app.js` 全体、翻訳エンジン、個々の描画エンジンまで全面的に書き換えたという意味ではない。既存の未コミット変更は保持。コミット・プッシュ・デプロイはしていない。

### 内部整理

- `gaia-mode-loader.js`: CSS/通常スクリプトの重複防止・既存資源検出・失敗後の除去／再試行を共通化。挿入先と `async=false` は明示的に維持。
- グループの依存資源読込と、準備完了判定／完了通知を分離。先読み → CSS → ESM → 通常スクリプトの順序と、音楽モードだけの並列読込を維持。
- ボタンの待機状態と、ホバー／フォーカス時の先読みを共通化。
- 直リンクの依存関係を段階別の定義へ整理。キャラクターは探索と並列、ツアーは探索完了後、`/story` の優先順位も維持。
- `index.html`: loader のキャッシュキーを `20260922-loader-refactor` に更新。
- `package.json`: 再実行可能な回帰テスト・性能計測コマンドを追加。

## 対象版

ベース: `0bf1d94d8324ad35758232957ff7eafe29c1a88a` ＋今回のローカル差分。

| ファイル | SHA-256 |
| --- | --- |
| gaia-mode-loader.js | `22be064e2fbabc159dec8bd05d378cba774714540d7777f15583582a6bca5389` |
| index.html | `466de38bd45776562bf325a7e3399bce66a227e1968775342e4f9a3d6f93ce4d` |
| opening.js（変更なし） | `2783e1cf7dd4a22505d9831d0be276cb081f53646300db6c9122ce54ea4326d0` |

## 検証結果

| 検証 | 結果／範囲 |
| --- | --- |
| `npm run check:mode-loader` | PASS。ライフサイクル37項目＋既存の先読みテスト。8モードの資源定義・挿入／実行順、18直リンク、共有資源、二重クリック、CSS/JS失敗後の再試行、クリック再送、イベントの detail、探索準備待ちを確認 |
| `npm run check:mode-loader:browser` | PASS。Chrome 1440×900／390×844、変更前後の文字・計算済みCSS・座標・選択画像・復帰するストーリー位置が一致 |
| 入口カードの画素比較 | PC差分0.0184%、スマホ差分0.00835%。RGB差20超の画素を集計、許容0.5%。全画面の動的背景まで完全一致という意味ではない |
| 実操作 | サウンドOFF → タイトル → データ入口 → 人物選択／戻る → 音楽／戻る → 地図の「体験する」。ストーリー直リンク、セーブスロット保存 → リロード → LOAD、コメントを含むMarkdownの実ダウンロードまで両幅でPASS |
| 全モードの実資源読込 | 統計・GX・宇宙・ツアーも実ブラウザで読込成功。これら4モードの全画面／全操作を総当たりしたわけではない |
| セキュリティ／実行エラー | ローカルに既存CSPを適用したブラウザ試験で違反0、pageerror 0 |
| `node scripts/check-intro-card-text.mjs` | 360／390／412／768／1440pxすべてPASS。「折り返さず文字を小さくする」既存仕様を維持 |
| `node scripts/check-i18n-catalog.mjs` | PASS。7756件の辞書、本文377＋エンディング164ステップ。全画面の多言語表示試験とは区別する |
| 構文／差分 | 変更JS・テストの `node --check`、`git diff --check` PASS |

単体試験はDOM・通信をモデル化している。ブラウザ試験は実Chrome／同一オリジンの実ファイルを使用し、外部APIは遮断した。保存値へのフォールバックであり、ライブ観測の疎通確認ではない。実機Android/iOS、全展示、全ストーリー、ESM通信途絶からの復旧は未確認。

証跡: `artifacts/refactor-20260922/browser/report.json`、同フォルダのbefore/after PNG・ダウンロード済みMarkdown、`artifacts/intro-card-text/after-*.png`。比較試験では旧loaderだけをGitの固定コミットから差し戻して応答し、他の資源は同じ作業ツリーを使っている。

## 性能計測の条件

Chrome DevTools MCPで起動トレース、LCP内訳、リソース、強制レイアウト、アクセシビリティツリーを確認。その後、独立したChromeで起動・実クリック経路を計測した。

- PC: 1440×900、DPR 1、CPU制限なし、通信制限なし。
- スマホ相当の反復計測: 390×844、DPR 2、CPU 4倍スローダウン、遅延150ms、下り200,000 B/s、上り93,750 B/s。
- 各3回、新規ブラウザコンテキスト・キャッシュ無効。反復計測中は他のブラウザテストを実行していない。
- 最終計測はローカルBrotli有効、HTTP/1.1、`Cache-Control: no-store`。本番のHTTP/2・3やCDNキャッシュを再現した測定ではない。
- サウンド設定が操作可能になる時点は、起動カバーが `hidden` かつ設定画面が `is-visible` の最初のフレーム。
- データ入口への遷移時間は、ボタン操作開始から入口カードが可視になるまで。全画像／地図データの読込完了時間ではない。通信量はその時点で完了したリソースのみ。

### 最終反復計測（Brotli）

| 指標 | PC | スマホ相当 | 解釈 |
| --- | ---: | ---: | --- |
| LCP中央値 | 116ms | 1108ms | 起動ロゴが対象。どちらも良好域だが、アプリの操作開始を表さない |
| CLS | 0.0000154 | 0.000210 | 起動区間は良好域 |
| FCP中央値 | 116ms | 692ms | 初回の内容描画 |
| サウンド設定の操作可能時点・中央値 | 772.6ms | 4756.2ms | スマホ側の実際の待ち時間が残る |
| 操作可能時点の範囲 | 768.4–811.8ms | 4686.5–4886.0ms | 各3回 |
| データ入口カード可視まで | 5423.5ms | 10946.5ms | 各1経路。自動演出・読込待ちも含む |
| 上記のうち探索モード読込 measure | 4912.3ms | 8464.0ms | `gaia:exploration-load`。ボタン応答とは別の準備待ち |
| 3クリック中の最長Event Timing | 96ms | 136ms | ローカルの個別イベント値。フィールドINPではない |
| フィールドINP／CrUX | 未取得 | 未取得 | 合否を断定しない |

LCP≤2.5秒、CLS≤0.1を良好域として参照。ただし本来のCore Web Vitals判定は実ユーザーの75パーセンタイルで行うため、このラボ値で本番合格とは言わない。[Web Vitals公式](https://web.dev/articles/vitals)

個別値・リソース・ハッシュは `artifacts/refactor-20260922/performance-br-final/report.json`。JS Coverageは最終タイミング測定で無効。別の診断走行 `performance/report.json` でのみ実行回数を取得した。

補助情報として、未圧縮ローカルのDevTools単回トレースはPC LCP110ms、スマホSlow 4GでLCP2791ms／FCP1992ms／CLS0。反復測定とはスロットル設定・計測方式が異なるので混ぜて平均しない。同じ未圧縮環境の補助反復走行ではスマホの操作可能時点が中央値9307.7msだったが、これは本番の所要時間ではない。DevToolsの詳細は `artifacts/refactor-20260922/devtools-insights.json`。

## 改善候補（未実装・優先順）

### 1. データ入口を地図本体の初期化から分離する：高

根拠: `opening.js` の `finish()` がデータ入口を開く段階で `GaiaModeLoader.load('exploration')` を待つ。`src/exploration/index.js` は各展示のモジュールを読み込み、loaderはさらに地図のCSS・`app.js`などとruntime-readyを待つ。Brotli／スマホ条件でも、この準備が8.46秒、入口カード可視まで10.95秒。

対応案: 入口ページのDOM・ガイド・ナビゲーションを軽量な独立入口へ分離し、「世界を観測する」を選んだ時に地図本体を初期化する。タイトルからの先読みは回線／余裕時間に限定。地図直リンク、ツアー、ストーリーからの地図起動は現行の依存順を保持する。

見込効果: 地図初期化を入口表示の必須条件から外せる。8.46秒をそのまま全額削減できるとは未検証。現状のLCP改善ではなく「次の操作へ進めるまで」を主な評価軸にする。

### 2. 翻訳辞書のモード別読込と登録のまとめ処理：高

根拠: 初期56スクリプトのうち41本が `locales/`。原文サイズ785,470 B、JS全体997,294 Bの約79%。最終Brotli実測でも辞書だけで326,904 B、41リクエストを初回に受信している。統計関連など後でしか使わない画面の辞書も含む。

別のCoverage走行では、日本語起動でも `register` 44回、`refresh` 46回、`translate` 53回、`translateSource` 約29,090回を確認。`gaia-i18n.js` の登録ごとにテンプレート再整列・キャッシュ破棄・DOM更新を行うため。

対応案: 共通入口辞書を残し、統計／人物／各展示の辞書を該当モードへ所属させる。連続登録をまとめ、DOM翻訳を一度に行う。未知の文やユーザー入力を誤訳しない既存の保護処理は維持する。

見込効果: 上記326.9kB／41要求の一部と重複DOM走査が対象。共通文言が必要なので全量削除は不可。辞書が「不要」なのではなく「初回には不要」。JA/EN/中文の初回表示・途中切替・Canvasを検証してから導入する。

### 3. 同一画像のURLを統一する：中（低リスクの先行候補）

根拠: PCのデータ入口経路で、`index.html` の人物サムネイルと `character-mode.js` の先読みが同じ画像に異なる `?v=` を付けて二重要求。

| 画像 | 重複分（実応答ボディ） |
| --- | ---: |
| mizuha-calm-07-v2.png | 686,832 B |
| sakuya-calm-07-v1.png | 655,444 B |
| amane-calm-07-v2.png | 562,980 B |
| 計 | **1,905,256 B** |

対応案: サムネイル・立ち絵・preloadで一つの正規URLを共有する。画像内容・描画サイズは変えない。これは同一パスへの別URL要求であり、異なる表情画像を削る話ではない。

ESMにも `japan-prefecture-view.js`、`metric-legend.js`、`food-catalog.js` の異なるクエリがあり、重複原文は計12,005 B。こちらは通信量より二重モジュールインスタンスの影響を確認してから正規化する。

### 4. 未表示画像の先読み範囲を絞る：中

根拠: 入口遷移の実ネットワークで `gateway-keyvisual-v2.png` 4.01MB、`sound-archive-bg-v3.png` 2.19MB、物語の背景PNG 2.24MB等の要求を確認。DOMテンプレート内に文字列があるだけで初回に取得された、と推定したものではない。音楽モードは `opening.js` の入口へのhandoff時に明示的にwarm-upする。

対応案: 音楽カード等のホバー／フォーカスを保ちつつ、テンプレートをwarm-upするだけで全画像まで取得しない責務分割を検討。入口で実際に表示する背景は残す。既存の小画面用WebPを使える資源は表示解像度／DPRと照合する。画像を削除したり、今回勝手に再圧縮したりはしていない。

### 5. 起動時のレイアウト読み出しをまとめる：中

根拠: DevToolsスマホトレースで `opening.js` のサウンド背景 `resize()`、`soundModal.clientWidth/clientHeight` に強制レイアウト総時間472msが帰属。`showSoundModal()` で表示クラスを変更した直後に背景を開始している。

対応案: 寸法を読む段階とCanvas／クラスを書き換える段階を分け、同じ寸法を共有する。ResizeObserver等へ変更するなら、初フレーム、回転・リサイズ、reduced-motionで現状と比較する。472msすべてを削減できる保証ではなく、要再計測。

### 今回は優先しない項目

- 本番の圧縮・長期キャッシュ追加: 2026-09-22の公開URLへの読み取り専用HEADで、HTML／`gaia-i18n.js` は `Content-Encoding: br`。HTMLは `max-age=0, must-revalidate`、JS／画像は `max-age=31536000, immutable` を確認済み。ローカル `no-store` を本番の問題に取り違えない。
- 起動ロゴ等の再圧縮: DevToolsの画像削減推定は約67kB、LCP改善推定0ms。見た目を変える圧縮より、上記の準備待ちを優先する。
- CSSの機械的削除: 初期8CSS、213,189 B。別モードや動的状態で使う規則があり、未使用を確認せず削除しない。
- DevToolsのRenderBlocking推定: スマホでFCP削減3467msと表示されたが、同トレースの実測FCP1992msを上回る。削減効果として採用しない。LCP改善推定は0ms。

補足: 素のHTML/CSS/JS＋ネイティブESM構成で、現状の入口に本番用のbundle/tree-shaking工程はない。巨大な `app.js` の機械的分割だけでは待ち時間は消えず、読込境界の変更が必要。

## 再実行

```powershell
# ターミナル1: 表示・操作の回帰テスト用
node scripts/serve-novel-preview.mjs 4492

# ターミナル2
npm run check:mode-loader
npm run check:mode-loader:browser
node scripts/check-intro-card-text.mjs

# 性能測定用サーバー（別ターミナル）
$env:GAIA_PREVIEW_COMPRESSION='br'
node scripts/serve-novel-preview.mjs 4493

# 他のブラウザ試験を止めて測定
$env:GAIA_BASE_URL='http://127.0.0.1:4493'
$env:GAIA_OUTPUT_DIR='artifacts/refactor-20260922/performance-br-final'
npm run measure:entry-performance
```

性能診断では、実測とコード・ネットワークの照合を優先した。詳細な計測手法は[Chrome Performance公式](https://developer.chrome.com/docs/devtools/performance)、レイアウトの扱いは[Forced reflow公式](https://developer.chrome.com/docs/performance/insights/forced-reflow)を参照。完全なアクセシビリティ監査、Speed Index、標準定義のTBT、実ユーザーINP、本番全経路の性能は今回の測定範囲外。
