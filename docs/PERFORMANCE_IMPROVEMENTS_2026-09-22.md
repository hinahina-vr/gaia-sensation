# 表示を維持した性能改善（2026-09-22）

依頼: 「改善点に基づいて改善して　見た目は一切変えないこと」。

前回の [性能診断](REFACTOR_PERFORMANCE_2026-09-22.md) に基づくローカル実装。CSS、画像・音楽のバイト列、文言、レイアウト、描画品質、展示の演出ロジックは変更していない。本報告の検証完了時点ではコミット・プッシュ・デプロイは行っていない。

## 変更

1. **翻訳の取得・登録を集約** — 初期の41辞書を1ファイルにまとめた。6,692登録行の順序と内容を生成時に照合し、重複キーの最終訳・テンプレート優先順位を保持。初期JS要求は56→16。辞書のBrotli quality 4換算は326,904→254,227 B（約22%減）。原本は引き続き `locales/` で編集し、`npm run build:ui-locales` で生成する。日本語で辞書を登録する際の、訳が変わらない全DOM再走査も省いた。言語切替時の復元・更新は同期のまま。
2. **入口をGPUコンパイル待ちから分離** — `gaia:entry-ready` と `gaia:app-ready` を区別。入口・キャラクター直リンクは入口準備完了で操作可能にし、地図・ソース・ツアーは従来どおり描画準備完了を待つ。入口から地図を押した場合も同じゲートを通す。独立した6動的importを並行取得。
3. **同一資源の二重取得を削減** — キャラクターのサムネイルと立ち絵のURLを統一。既存診断で確認した重複3画像分1,905,256 Bを削減する構成とし、実ブラウザでも同じ画像に別クエリURLがないことを検査。`japan-prefecture-view.js` のURLも既存の共通URLに合わせた。画像内容・解像度・表示サイズは変更していない。
4. **起動背景の強制レイアウトを回避** — サウンド画面を表示した直後の寸法読み取りをResizeObserverによる実レイアウト寸法へ変更。最初の背景フレームが描かれてから起動カバーを外す。非対応環境には従来の測定経路を残す。終了時は監視・描画ループ・待機を解放。

## 回帰確認

対象はローカル作業ツリー。ChromeのPC 1440px、スマホ390px、横向き844×390で確認。スマホはエミュレーションであり実機ではない。変更前ファイルは `artifacts/performance-improvement/baseline/` に保存。検証版のSHA-256は表示比較・性能レポート内に記録する。

- `npm run check:mode-loader`: 38チェック、8モードの依存順・二重読込防止・失敗後リトライ・18直リンク・入口／地図の独立した準備完了ゲート。
- `npm run check:i18n`: 生成辞書の一致、既存7,756訳、ユーザー入力の保護、JA/EN/中文の切替、Canvasの描画。
- `check-mode-loader-browser.mjs`: 変更前後の文字・位置・サイズ・色・余白、入口カード画素比較。キャラクター選択、音楽、地図、各モード実ロード、物語の保存→再読込→ロード→コメント付きMarkdown書き出し。ローカルCSP確認。
- `check-performance-compatibility-browser.mjs`: サウンド画面の描画画素・文字位置が変更前後で一致。PC／スマホ／横向きリサイズ。GPU完了を意図的に保留したテストで、入口操作が可能かつ地図は待機し、解除後に地図の自動再生が始まることを確認。物語のみを新規ロードした状態から「戻る」ボタンで入口に復帰する経路も確認。GPU遅延の部分は合成条件であり実測性能ではない。
- EN/中文キャラクター16ケース、宇宙／GXの72ケースを既存ブラウザ試験で確認。
- `check-map-exhibit-link-entry-browser.mjs`: オープニングからの展示直リンク、連続ハッシュ変更をPC／スマホで確認。
- `check-firms-cruise-browser.mjs`: 展示01の炎の変化・消火→展示02、別の自動再生の停止／再開をPC／スマホで確認。
- `check-map-cruise-lifecycle-browser.mjs`: 5秒間隔の観測点移動、展示遷移、手動操作による停止、モバイルパネル中の一時停止。長い年次スライダーの終端検証のみテスト時計を進めている。
- `check-map-entry-bottom-menu.mjs`: 地図への入口でメニューが開かず自動再生すること、下部メニューの位置を確認。

証跡: `artifacts/performance-improvement/browser/`, `artifacts/performance-improvement/compatibility/`, `artifacts/i18n/character/`, `artifacts/i18n/secondary-runtime/`, `artifacts/map-exhibit-link-entry/`, `artifacts/firms-cruise-20260914/`, `artifacts/map-cruise-lifecycle/`, `artifacts/map-entry-bottom-menu-20260914/`。

注: 古い `check-map-playback-lifecycle-browser.mjs` は、以前の仕様変更で表示されなくなった `#gaia-map-demo-toggle` を操作しようとしてタイムアウトした。これを今回の製品不具合の修正済み証跡にはせず、現行のクルージング／自動再生の試験で置き換えて検証した。旧試験の更新は残る。

## 表示維持を優先して残した境界

- 辞書のモード別遅延読込は今回採用せず、同一順序の一括登録を採用。共通キーの上書き・可変テンプレートがモードをまたぐため、文言の不変性を優先した。
- 入口と地図の**準備完了待ち**は分離したが、ネットワーク上の全依存ファイルの完全分割までは行っていない。
- 非表示画像の先読み削減・背景画像の再圧縮は未実施。ホバーやモード切替の最初のフレームを変える可能性があり、表示品質・演出を削る変更はしない。
- 小さな `metric-legend.js` / `food-catalog.js` の残る別クエリURLは未統一。前者はモジュール内状態を持つため、今回の描画待ち解消と混ぜない。
- 本番キャッシュ・圧縮・配信設定は変更していない。実配信、物理スマホ、Firefox/Safari、全71展示すべての詳細操作は今回未検証。

## 再計測結果

変更前の保存ファイルを読み取り専用オーバーレイで配信し、変更後と同じBrotli quality 4、HTTP/1.1、no-store、Chromeのキャッシュ無効で比較した。初回画面は各3回の中央値。PCは1440×900/DPR1/CPU等速、スマホは390×844/DPR2/CPU4倍遅延・通信遅延150ms・下り200,000 B/s・上り93,750 B/s。測定中は他のブラウザ試験を実行せず、試行間に2秒置いてローカル圧縮処理を分離した。

| 計測対象 | 変更前 | 変更後 |
| --- | ---: | ---: |
| PC 初期サウンド選択が操作可能 | 745ms | 657ms |
| スマホ条件 初期サウンド選択が操作可能 | 4,652ms | 4,086ms |
| PC 入口ボタンクリック→カード表示（1回） | 5,411ms | 2,312ms |
| スマホ条件 同遷移（1回） | 10,145ms | 9,524ms |
| PC LCP / FCP | 108 / 108ms | 92 / 92ms |
| スマホ条件 LCP / FCP | 1,076 / 660ms | 1,092 / 660ms |
| PC CLS | 0.0000154 | 0.0000154 |
| スマホ条件 CLS | 0.000210 | 0.000210 |

入口遷移はPCで約57%短縮、スマホの初期操作可能時間は約12%短縮。LCP/FCPは起動カバーが主対象で、アプリの操作可能時間とは別。全指標が改善したとは評価していない。初期操作可能時間の全試行範囲はPCで741–801→656–762ms、スマホで4,624–4,657→4,078–4,147ms。PCのLCP範囲は96–204→92–396msで初回試行に揺れがある。

実クリックの最大EventTimingはPC 80→96ms、スマホ112→112ms。少数のラボ操作であり、**実ユーザーINPではない**。Speed Index、標準TBT、実ユーザーCWVは未計測。ローカル配信の値からCDN配信や実機の速度を保証しない。

証跡は `artifacts/performance-improvement/performance-before/report.json` と `performance-after/report.json`。最初の予備測定も `performance/report.json` に残した。変更前オーバーレイで未使用の生成バンドルのハッシュも記録されるが、実際に読み込んだ資源は各レポートの `resources` を正とする。

別条件のDevTools MCPトレース（4492、非圧縮、Slow 4G・CPU4倍）では、変更後LCP 2,036ms、CLS約0.0002。サウンド背景の `resize()` に帰属していた強制レイアウトは出なくなった一方、帰属不明の257msは残っている。「強制レイアウトが全てゼロになった」とは扱わない。トレースとアクセシビリティツリーは `artifacts/performance-improvement/devtools-insights.json`。サウンド選択・言語・音量のアクセシブル名も維持されている。

## 再実行

```powershell
# プレビューを別ターミナルで起動
node scripts/serve-novel-preview.mjs 4492

npm run check:mode-loader
npm run check:i18n
npm run check:performance-compatibility
$env:GAIA_COMPARE_BASELINE='artifacts/performance-improvement/baseline'
$env:GAIA_OUTPUT_DIR='artifacts/performance-improvement/browser'
npm run check:mode-loader:browser
```

表示比較には作業開始時の保存ファイルを使う。互換性試験は保存ファイルがない新規checkoutでは `0bf1d94` の原本にフォールバックする。

性能測定は `GAIA_PREVIEW_COMPRESSION=br` で4493を起動してから、`GAIA_BASE_URL=http://127.0.0.1:4493`、`GAIA_OUTPUT_DIR=artifacts/performance-improvement/performance-after` を指定して `npm run measure:entry-performance` を実行する。変更前は別ポート4494に `GAIA_PREVIEW_BASELINE=artifacts/performance-improvement/baseline` を設定し、測定側の `GAIA_COMPARE_BASELINE` にも同じパスを設定する。標準プレビューはこれらの環境変数なしなら従来どおりで、オーバーレイは作業ツリー内の読み取りに限定している。
