# QA — 2026-09-09 シナリオLOG修正・地名統一

## 反映内容

- 添付 `gaia-codex-log-comments-20260908T165926Z.md` の11件を指定どおり反映。
- 追加指示「シナリオ中の逗子はぜんぶ海辺」により、`beyond_03_047` も変更。現在の正本・実行データ・現行統合台本・ブラウザの全台本表示と書き出しに「逗子」は残っていない。
- 計12件（本編4件・BEYOND8件）。ほか532件の本文・話者・演出・安定ID・シーン順は変更前の全体ハッシュとの比較で維持を検証。
- 長文化したBEYONDは本文を省略せず、`beyond_01_002` を4ページ、`beyond_01_032` と `beyond_02_005` を3ページ、`beyond_03_021` を2ページに分割。全ページの連結が指定本文に完全一致。
- 過去の支給原稿、LOG修正指示、修正履歴、旧台本は変更していない。今回の支給ファイルは `story/LOG_COMMENTS_2026-09-09.md`、変更前後と履歴ハッシュは `story/LOG_REVISION_2026-09-09.json` に保存。
- 正本から `novel-story-data.js`、`true-end-data.js`、`story/現行統合台本.md` を再生成。旧原稿の照合処理には、入力ハッシュが一致するときだけ今回の修正を再現する処理を追加。過去の指示に対する検査も、今回の変更前の内容を復元して検査する。
- 本編の保存形式は `storyVersion: 13` のまま。`revisionId: observation-log-20260909`、BEYONDは `true-end-beyond-log-20260909`。データとローダーのキャッシュ識別子を更新。
- 既存のCONCEPTページのHTML/CSS/JSのSHA-256は、この作業開始前と一致。既存作業を保持。

## 合格した検証

- `npm run check:story-log-followup`：指定11件との完全一致、追加地名1件、全544件の整合、532件の非対象データ、過去9ファイルのハッシュ維持。
- `npm run check:user-script`：旧支給原稿を保存したまま、12件の後続修正を含む正本を再現。380本編＋164 BEYOND、安定ID全件維持。
- `node scripts/check-novel-story.mjs`：現在の正本・実行データに加え、過去109件・59件・2件の修正契約も合格。
- `node scripts/build-true-end-story.mjs --check`、`node scripts/export-current-story-script.mjs --check`：生成物一致。
- `node scripts/check-story-log-followup-browser.mjs`：Chrome、1440×900／390×844で、本編4件を実際に全ページ再生。文字列・話者・表示領域・改ページを検証。画面が表示完了してから撮影し、PC／スマホの出力を目視確認。
- 同ブラウザ試験で実SAVE操作→次の台詞→LOAD操作、旧版セーブのLOAD、再読込、全544件のLOG表示、全台本Markdownの実ダウンロードを確認。書き出した全544件のIDと本文、および12件の指定修正を照合。「逗子」がないことも確認。
- `node scripts/check-beyond-log-comments-browser.mjs http://127.0.0.1:4447 artifacts/story-log-2026-09-09/beyond-supported 1440,390`：PC／スマホ幅でBEYOND全164メッセージの全ページ、話者、文字切れ・横はみ出しなし、フィナーレ到達を確認。今回修正した台詞と過去修正箇所のスクリーンショットを保存。
- ブラウザ試験のpage errorは0件。
- `git diff --check`：合格（Gitの改行変換に関する警告のみ）。

## 残っている制約・未合格範囲

- 追加で試した320×844では、今回未変更の `beyond_01_003` に文字の表示切れを検出。320px幅の全編表示は合格として扱わない。本文の同一性は変更前ハッシュで確認でき、今回の修正対象には含めていない。失敗結果・画面は `artifacts/story-log-2026-09-09/beyond/report.json` と `failure.png` に保存。
- `npm run check` の本体（台本・演出・生成物確認を含む）は合格したが、postcheckの公開権利チェック `scripts/check-release-rights.mjs --validate` で `gosat` のscope SHA不一致となり、コマンド全体は不合格。記録値 `ccc12a0d1fbbc28e1349d8b0a6331704f030fe4b48dd0cf2e09a414748440908` に対し、現行スコープは `e6f11b9ebb3f1960d134c1555d1860de739ce6e5504af8f5580c034956a3dd30`。権利の再承認や承認データの書換えは実施していない。
- Windows Chromeのローカル描画・ビューポートエミュレーションでの確認。物理スマートフォンや本番配信、実データ提供APIの動作確認ではない。ローカルQAサーバーとNOAAデータのテスト用応答を使用。
- 今回はローカル修正のみ。push、deploy、公開、ZIP配布は依頼されておらず実施していない。

## 証跡

- 本編・保存読込・書き出し：`artifacts/story-log-2026-09-09/main/report.json`
- ダウンロードした全台本：`artifacts/story-log-2026-09-09/main/1440-complete-script.md`、`390-complete-script.md`
- BEYOND PC／スマホ：`artifacts/story-log-2026-09-09/beyond-supported/report.json`
- 基点コミット：`aaa9153116c704f14d82f48969a396b907388451`（未コミットの既存作業を保持）。

## 検証対象 SHA-256

正本のみ改行をLFに正規化したハッシュ。ほかは実ファイルのバイト列。

- `story/APPROVED_SCRIPT_2026-08-24.md`：`f021e23ef7b94d0c32ab0c4b2bea0a916028746b100cdc943f8bc9bdb6ff1de5`
- `novel-story-data.js`：`8cce6e1c155ff36cac8f8859c396105901b58357b1ed07c31b32adaa631d20c9`
- `true-end-data.js`：`7a0d6eef4c5518c9fbd92372f484df53898db68eebd45cafc436884a830a2500`
- `story/現行統合台本.md`：`f8818804be9ddf253e49c0d51f6ce6dadba8d30696ab1b16ab278fffbeffb10f`
- `gaia-mode-loader.js`：`91cc78555b47ffbbe80c2b6f891ac08dbacd6bf60797193621ab80a3296b5f90`
- `index.html`：`2aeaf36dd597f9d4d01f663a4ff73a40cdbe9f7a57a9f37966f634a71f93e430`
