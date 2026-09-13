# データ末尾からの初回ストーリー起動 修正 — 2026-09-09

後続の地図・統計UI変更でもこの修正を保持し、入口・保存・読込・書き出しを再確認した。後続版の結果は [観測画面の検証記録](QA_OBSERVATION_PORTAL_2026-09-09.md) を参照。本書の修正時点の証跡はそのまま残す。

## 対象と公開状態

製作者の明示指示「不具合直して」に対応。基点は公開版と同じ `cdc82c8ffd4fee607bd2d838ec3157b7095952d3`。ローカル修正であり、この作業でコミット・push・デプロイは行わない。

対象はデータ探索画面の末尾にある「ストーリーモードへ」。ストーリー機能が未読込の初回だけ無反応で、先に別の入口からストーリーを開くと動く不具合。

## 原因と変更

- `novel-mode.js` は読込時に `[data-novel-open]` のクリック処理を登録するが、そのボタンが `gaia-mode-loader.js` の読込開始対象から漏れていた。
- 既存の `interceptClick` に `[data-novel-open]` → `story` を追加。最初のクリックで必要なファイルを読み込み、完了後に既存のクリック処理を実行する。
- 読込中の連打は既存の保留フラグでまとめる。読込済みの場合はそのまま既存処理へ渡す。物語・画像・保存形式・演出は変更しない。
- `index.html` のローダーURLを更新。ページを開いただけではストーリーを先読みしない設計を維持する。

## 修正前の再現

新規の隔離Chromeコンテキストで、ローカル `http://127.0.0.1:4492/#top` と、タイトル → データ探索の2経路を操作した。PC 1440×900／タッチエミュレーション390×844の計4ケースが全て失敗。ボタン押下後も `storyLoaded: false`、`storyApi: undefined` のまま15秒以内に起動しない。

記録：`artifacts/footer-story-20260909/before/report.json` と同フォルダの画面画像。修正前の失敗記録は保持する。

## 回帰テスト

- `scripts/check-entry-actions-browser.mjs`：初回のマウス・タップ・Enter・Space、タイトル経由、上部とタイトルの既存入口、再訪、保存・再読込・LOAD・Markdown実ダウンロード、同じ入口画面の関連操作。
- 追加の低速ケースは、実際の `novel-mode.js` の応答を最低1.5秒遅延させる。本文は差し替えず、4回押しても1回だけ起動すること、保留状態が解除されること、戻って再度開けることを確認する。通信速度の実測ではない。
- `scripts/check-contest-experience-browser.mjs`：通常のCIで実行される総合Chrome試験に、PC・スマホ相当それぞれの未読込状態からの末尾クリックを追加。事前のstory API呼出しや保存データ投入をせず、実際の先頭ページ表示まで検証する。

## 修正後の結果

Windowsの実Chrome 152.0.7977.76で実行。PC画面1440×900、スマホ相当390×844（タッチエミュレーション）。修正前と同じクリック・タップ手順が全て合格した。

| 検証 | 結果と記録 |
| --- | --- |
| 入口・関連操作の全32ケース | 全件合格。`artifacts/footer-story-20260909/after/report.json` |
| PC／スマホ相当の低速読込＋連打 | それぞれ4回の保留中クリックから起動1回。スクリプト要求1回。戻って再度押すと正常に2回目の起動。上記レポートの`slowLoad`に記録 |
| 上部／末尾入口からの保存・再読込・LOAD・書き出し | 両入口×両画面の4ケース合格。コメントと全台本のMarkdown計8ファイルを実際にダウンロードし、内容を照合。全台本は各161,870 bytes |
| 通常CIで使用する総合Chrome試験 | 同じ試験をローカルで実行し合格。`artifacts/footer-story-20260909/contest-network/report.json`。新設したPC／スマホ相当の初回末尾クリックも合格 |
| 全体の静的・データ・回帰検査 | `npm run check`（precheck／postcheck込み）が終了コード0。ローダーの要求時読込・実行順・重複防止とCSP検査も合格 |
| 画面の目視確認 | 修正前の末尾ボタン無反応画面と、修正後のPC／スマホ相当の物語先頭画面を確認。背景・本文・操作欄が表示され、探索画面の下に隠れていない |

総合Chrome試験の最初の実行は、実行環境の`net::ERR_NETWORK_ACCESS_DENIED`をコンソールエラー検査が検出して不合格。失敗記録は`artifacts/footer-story-20260909/contest/report.json`に保持した。アプリや合格条件を変えず、通信許可付きで再実行した結果、console error・page error・unhandled rejection・404はいずれも0で合格。性能下限は通常CIと同じ`--min-fps 24`を明示指定しており、物理スマホの性能合格を意味しない。

検証対象は`cdc82c8`に今回の未コミット差分を加えたローカル版。`after/report.json`に基点コミットと4ファイルのSHA-256を記録し、検証後の実ファイルとの不一致0件を確認した。`gaia-mode-loader.js`は`af29c9582fb2d3e45e0c717105a1fe71e467c038a542b1207e17e532b7c4e46c`、`index.html`は`54fe46ab20d00efffd6d57a298b932be3c6c7ceef7995c1586ed2d207f43c390`。以後の変更は検証文書のみ。

GitHub上で今回の差分のCIを実行したわけではなく、push・デプロイ・本番確認は未実施。配布ZIPは作成していない。

```powershell
node scripts/serve-novel-preview.mjs 4492
node scripts/check-entry-actions-browser.mjs http://127.0.0.1:4492 artifacts/footer-story-20260909/after
node scripts/check-contest-experience-browser.mjs --browser "C:/Program Files/Google/Chrome/Application/chrome.exe" --output artifacts/footer-story-20260909/contest-network --min-fps 24
npm run check
```

## 過去の記録との区別

`QA_ENTRY_ACTIONS_2026-09-09.md` と `RELEASE_OBSERVATIONS_2026-09-09.md` の未修正記録は、当時の公開版に対するもの。7:36の製作者の原文は「おしてもなんもならん　ちゃんと全部テストして」であり、「検証のみ」という限定は主担当の解釈だった。今回は明示の修正指示に基づき、ローカルで実装と再検証まで進める。

## 未確認の範囲

物理スマートフォン、Safari／Firefox、公開後の動作は未確認。ESP32実機、外部AI送信、実アカウント・本番DBの登録や削除は対象外。本番はこの修正をまだ含まない。
