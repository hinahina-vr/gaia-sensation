# 今回の分割とライフサイクル

2026-09-07 / `gaia-hardening-1`。フレームワーク移行や全ファイルの再構成ではなく、測定で確認した重複読み込みと外部通信境界から分離した。

| 責務 | 所有者 | 終了・再利用 |
|---|---|---|
| 正準データと出典 | `data/gaia-signals.json` | 観測値・元ID・時刻を保持。GBIFの権利情報だけ補完 |
| 配信用データ生成 | `scripts/build-gaia-runtime-data.mjs` | 10モードを無損失でcompact化。hash名チャンクとmanifest。元JSONとのround-trip一致を検査 |
| ブラウザ内の共有読み込み | `src/data/snapshot-store.js` | 同時要求は同一Promise。最大3取得を並行、20秒タイムアウト、失敗は再試行可。保持は1snapshot |
| MAP/地震の利用 | `app.js` | 同一storeを参照。パネルを閉じても別利用者の取得を中止しない。BFCache以外のpagehideで破棄 |
| 統計データ加工 | `statistics-datasets.js` | DOM・通信・保存を持たない純粋関数。年次選択と元の値を維持 |
| 統計表示・分析 | `statistics-lab.js` / 既存coreとWorker | 既存の責務分離を維持。表示終了時の描画停止、AI通信中止、キーボード解除 |
| 持ち込みAI通信 | `byok-ai.js` | 送信先/キー束縛、キャンセル集合、45秒timeout、2MB応答上限。消去/pagehide時に通信中止 |
| AI画面 | `statistics-ai.js` / `sensors/sensor-platform.js` | 画面所有のAbortControllerと世代番号で、終了後の遅い回答を反映しない |
| ブラウザ防御 | `scripts/build-browser-security.mjs` | HTMLのhashから`_headers`とWorkerの共通ポリシーを生成。変更後の再生成漏れを検査 |
| 削除/運用境界 | `sensor-platform/src/account.ts` / `operation-mode.ts` | 本人の削除を1つのFK cascadeで処理。受付状態は運営者設定のみ |

全10チャンクは最初のsnapshot要求時に読み込む。今回は既存の全モード集計との互換性を保つため、モードを開くたびの完全なオンデマンド取得へは変更していない。画像・音声の品質と既存の先読み規則も維持した。

構造分離後に、4つの統計データタイトルに残っていた固定件数「31」を実際の行数に連動させた。これは意図した表示修正で、計算・記録・MAP描画の変更ではない。同等性試験は該当タイトルに由来する2つの文章フィールドだけを許可し、それ以外の全結果を比較する。

## テストの責務

- `check-statistics-lab.mjs`: 固定の小さなfixtureで計算式を独立検証。
- `check-statistics-data-contract.mjs`: 更新される実データの有限性・ID・年次・出典・算術整合性。
- `check-statistics-datasets.mjs`: 加工関数の入力非破壊・欠測/0の区別・年次選択。
- `check-snapshot-store.mjs`: single-flight、再試行、timeout、破棄、異常manifest。
- `check-refactor-equivalence-browser.mjs`: 11統計結果と10展示のデータ・位置・ピクセルを保存点と比較。
- `check-hardening-soak-browser.mjs`: 30分・2画面幅で反復開閉し、取得回数、GC後heap、DOM、listener数を記録。

今後さらに分割する場合も、この数値/表示比較を維持し、画像・音声や長大な物語コードを一度に作り直さない。
