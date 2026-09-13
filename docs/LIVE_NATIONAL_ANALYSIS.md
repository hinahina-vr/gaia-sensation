# 15–20 全国分析（2026-09-07、ローカル実装）

> 後続のUI方針変更：リアルタイム展示（01–05・15–20）の統計分析ボタンは無効化。ホバー・フォーカス時に「リアルタイム表示では統計分析を利用できません」と案内し、スマホでは理由を常時表示する。以下は全国データ取得・分析データ生成の実装記録であり、現在の画面から分析を開けるという意味ではない。取得済みデータと既存の証跡は保持。

16–20 が選択中の1地点だけを分析していた処理を修正。15の風速を含む6展示で、47都道府県の代表地点を共通の分析対象とする。県全体の平均ではなく、指定座標に対応するモデル値。

## 変更ファイル

- `sensor-platform/src/prefecture-field.ts`：気象4変数・大気2変数を各47座標の2リクエストで取得。プロバイダー別キャッシュ、時刻・有限値検査、タイムアウト、応答サイズ上限。
- `sensor-platform/src/live-senseware.ts`、`_worker.js`：`/api/live/v1/prefecture-field` を追加。既存風速APIも同じ気象キャッシュを使用。生成Workerはローカルで再ビルド。
- `src/exploration/live-data.js`、`live-exhibits.js`、`index.js`：全国データの取得・受け渡し、同時要求の一本化、ロード中・再試行・前回値の処理。
- `src/exploration/live-statistics.js`：選択中の都市によらない47地点スコープ。欠測を除外し、0は保持。対象数・欠測・モデル出典・各地点の時刻を保持。
- `statistics-lab.js`、`statistics-ai.js`：全国47地点を分母とする利用率とAI用の対象・モデル・地点比較の情報。
- `data/live-prefecture-fallback-v1.json`、`scripts/update-live-prefecture-snapshot.mjs`：公開APIの実データから生成した、出典・取得時刻付きの静的プレビュー用保存値。模擬値や1地点の複製は使用しない。
- `scripts/check-live-national-analysis.mjs`、`scripts/check-live-national-analysis-browser.mjs`、`scripts/check-map-action-statistics.mjs`、`sensor-platform/test/run-pages-functions-tests.mjs`：回帰テスト。

## 確認

- 公開APIから6変数すべて有効47地点を取得。保存時刻は2026-09-06 21:30 UTC（翌日06:30 JST）。
- PC 1440px・スマホ390pxで15–20の計12画面。統計47件、AI用データ47件、47個の一意な都道府県ID、画面内表示を確認。
- 欠測・空文字・真偽値・無限値の除外と数値0の保持、地点順の安定、キャッシュ再利用、大気側失敗時の気象側維持を検証。
- ブラウザでも同時更新の一本化、46/47地点・利用率97.9%、通信失敗後の前回値保持、未取得状態からの再試行で47件へ復帰を確認。
- `node scripts/check-map-action-statistics.mjs`
- `node scripts/check-live-national-analysis-browser.mjs`
- 全国データ整形は画面側の静的検査で確認。プロバイダー取得・キャッシュの検査は `sensor-platform/test/check-prefecture-field.mjs` に分離し、`npm --prefix sensor-platform run test:pages` から実行する（画面側のCIにTypeScript依存を持ち込まない）。
- `node scripts/check-statistics-discovery.mjs`
- `node scripts/check-statistics-data-insights.mjs`
- `node scripts/check-statistics-methods.mjs`
- `npm run typecheck`、`npm run test:pages`（sensor-platform、20チェック）
- `node scripts/build-sensor-pages-worker.mjs`（dry-runビルド）、`git diff --check`

ブラウザ証跡は `artifacts/live-national-analysis/report.json` と各画面PNG。AIの課金リクエストは送信せず、画面で実際に生成された対象データとAI入力の構築を検証した。

静的HTTPプレビューでは「保存済みモデル値」と取得時刻を表示する。公開環境では全国APIから更新する。今回はpush・deployを行っていない。

実装時に参照した仕様：[Open-Meteo気象API](https://open-meteo.com/en/docs)、[大気API](https://open-meteo.com/en/docs/air-quality-api)、[Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)。
