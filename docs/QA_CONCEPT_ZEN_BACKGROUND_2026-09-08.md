# QA — ZEN大学の背景と物語の紹介（concept-12）

2026-09-08。`aaa9153116c704f14d82f48969a396b907388451` を祖先とする既存ローカル変更を保持した候補。今回の編集対象はコンセプトページのHTML/CSS、画像1点、検証スクリプト・素材台帳・制作記録です。コンセプトのJavaScript、本編シナリオ、タイトル画面の既存変更は今回変更していません。push・デプロイなし。

制作根拠・公式出典・ImageGenプロンプト：`docs/CONCEPT_ZEN_BACKGROUND_2026-09-08.md`。

## 報告症状の再現

ユーザーが見た直前のローカル版を `artifacts/concept-zen-background-before/` に保存し、同じHTML/CSS/JSをローカルHTTPで配信。古いHEADの画面を今回の再現画面とは扱っていません。

`node scripts/check-concept-zen-browser.mjs --before`：1440px・390pxで再現。

- 本文の不適切な呼称とAI群名。
- 本編に存在しない「対話や選択」の説明。
- 大学紹介より先に卒業プロジェクトと述べる冒頭。
- 「自分にとっての実感」を中心にした導入。
- 大学の使命・学園祭等の背景説明、公式シラバスリンクの欠落。

修正後も同じローカル配信・画面幅・CSPで比較し、回帰テストを残しました。旧素材・既存QA記録は削除していません。

## 最終候補の合格項目

- `npm run check:concept`：構文と静的契約。スタッフロールの4科目名、現行本編380ステップに選択肢・ルート分岐がないこと、本文のNG語除去、大学紹介→作品→AI構想の順序、ローカル素材、外部出典の許可リスト。
- `npm run check:concept-zen:browser`：1440・390・320・768px。新しい大学紹介・物語・授業概要・作者の位置づけを実描画で検査。文字のクリップなし、公式リンク9件の44px以上のタップ領域、安全な新規タブ指定、修正画像の読込と拡大ビュー、Escape後のフォーカス復帰、ページ横溢れ・保存領域への書込なし。`artifacts/concept-zen-background-after/report.json`。
- `npm run check:concept-zen:links`相当の `node scripts/check-concept-zen-browser.mjs --live-links`：9件すべてをローカルページから実際にクリックし、公式の実ページでHTTP 200・表示内容を確認。シラバス5件は実ページのh1が科目名と一致（Unicode NFKCで互換字形を正規化）。2026年度の4科目と2028年度の「プロジェクト実践」を区別。`window.opener`がnullであることも確認。`artifacts/concept-zen-background-links/report.json` と各遷移先のスクリーンショット。
- `npm run check:concept:browser`：1440×900、390×844、320×568、768×1024、3840×2160、JavaScript無効、既存本編入口の計7ケース。新しい大学紹介本文を含む実描画フォント・文字サイズ・コントラスト、配置、図の全体表示とズーム／スクロール／クローズ／フォーカス、固定ヘッダーとアンカー、表層・深層の配色切替、動きを減らす設定、印刷メディアでの内容表示を確認。ローカルのページエラー・CSP違反なし。`artifacts/concept-page-v12/report.json`。
- `node scripts/check-concept-linebreak-browser.mjs`：280・320・360・390・412・480・768・900・1440px。新しい移行見出し・説明文の語句を分断しないことと、作者の位置づけの文章末尾を確認。390pxで末尾の「す。」が独立する問題をこの検証で発見し、最後の句を保つ修正後に全幅で再実行・合格。`artifacts/concept-linebreak-v12/report.json`。
- `node scripts/check-concept-closing-line-browser.mjs`：280・320・327・390・595・1440px。「世界は、まだ物語ではない。」が引き続き1行、17px以上、クリップなし。`artifacts/concept-closing-line-v12/report.json`。
- `node scripts/check-concept-plain-copy-browser.mjs`：既存の4画面幅で平易な説明と構想／現行機能の区別、図への移動・拡大・閉じる・フォーカス・先頭への戻りを再確認。`artifacts/concept-plain-copy-v12/report.json`。
- `node scripts/export-current-story-script.mjs --check`：380 main + 164 APEIRONCENE steps、実装と台本の同期に合格。
- `npm run rights:build`後の`npm run check:rights`：300素材・6データソース、画像v2のSHA-256・制作元・加工記録に合格。
- `git diff --check`：合格。既存のLF/CRLF変換警告のみ。

新しい本文の最終編集後に上記の現行版テストを実行しました。各現行レポートのHTML/CSS/JSハッシュと最終ファイルの一致を確認。画面もPC／スマホの大学紹介、科目一覧、物語の背景、冒頭、作者の位置づけ、画像v2を目視確認しました。

## 検証上の区別と対象外

- 公式リンクの最初のブラウザー試験はネットワーク制限により失敗。読み取り専用の外部アクセス承認後に再試験しました。教育方針ページの初期表示にない語を待っていたテストは、実ページを調べ、表示される正式見出しで確認するよう修正。リンク先のページを偽のローカル応答に置き換えていません。
- ローカルChromeのPC／モバイル画面エミュレーションです。物理スマホ・実運用配信での検証ではありません。
- 本編は入口のスモークとデータ契約を確認したもので、全編の再プレイではありません。ゲームの保存・書き出し・外部観測API・センサー接続は今回変更せず、再検証の対象外です。
- コンセプトページには保存・書き出しUIがありません。印刷はメディア表示の検査であり、PDF出力や紙の実印刷の確認ではありません。
- 配布ZIPは作成していません。画像と静的ページをローカルHTTPから読み込む導線を確認しました。第三者サイト自身の全機能は検証していません。

## 最終ファイル SHA-256

- `concept/index.html`：`1b944a60d3be121633cc2637536d6aacad85e755d2524ede936e7f5f83da4c4e`
- `concept/concept.css`：`2ef004bbf8eff276a6abda6d50dba6ff70e306479639d41268ea3b730b0b62da`
- `concept/concept.js`（今回不変）：`4696cfa83134cef43cce1dcf47feb3eec05aeb00316d0927aae1bbc9c9eac78a`
- `assets/concept/myth-agency-loop-v2.png`：`16f86267b4bdc205b5232662591addd342ff892750bac5554dda164ef31780e0`
