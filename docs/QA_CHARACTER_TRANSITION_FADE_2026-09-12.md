# 背景切替後の立ち絵フェード — 2026-09-12

- 依頼: 「ここトランジションのあとキャラフェードインせずに1フレームで出現したので直しておいて」。画像の本文は `circle_invitation_068`。
- 再現経路: `circle_invitation_new_023`（スマートフォンのメンバー一覧）から実際に会話欄をクリックして `circle_invitation_068` へ。Chromeの描画フレームごとに背景切替フェーズ、キャラと親レイヤーのopacity／visibilityを取得。
- 原因: 背景切替中はruntimeを非表示にし、キャラのtransitionを停止して新しいポーズへ確定していた。幕を外したときに完成状態がそのまま現れた。
- 修正: `runBackgroundTransition` の幕を外す時点で、cast全体に620msのopacityフェードを開始。画像・表情の即時切替は変更しない。次の背景切替開始時は前のフェードをキャンセル。動きを減らす設定では従来どおり即時表示。
- 読込URLを更新。新規回帰試験は `npm run check:character-transition-fade:browser`。

## 実ブラウザー結果

インストール済みChrome headless、ローカル4492、本番相当CSP、分離した保存領域。外部HTTPS遮断。

- 修正前: 1440×900／390×900とも、中間透明度のフレーム0。症状再現。
- 修正後: 同じ2幅とも、中間透明度（0.02～0.98）のフレーム30。最終opacityは1。約200ms時点の透けた立ち絵と、完了後の立ち絵を画像でも確認。
- reduced-motionの1440×900では中間フレーム0、最終opacity 1。動きを減らす設定を維持。
- 既存の背景順序試験: PC／スマホ幅の6経路合格。背景完了前の本文・キャラ露出、地の文への切替でのキャラ残りを検査。
- 既存の表情試験: 9表情と2直接表示が合格。前回の引き継ぎセリフの笑顔も維持。
- 証跡: `artifacts/character-transition-fade-20260912/` の `before/report.json`、`after/report.json`、`after/*-entering.png`、`after/*-settled.png`、`background-order/`、`expressions/`。
- JS構文、ローダーprefetch、CSPハッシュ、差分空白チェック合格。

## 対象版と限界

基点 `bd6c1c3c95ab245507293acd7f2f3714714f2606` ＋既存ローカル変更＋今回の修正。検証時novel-mode.js SHA-256: `1ae6a885000615016ae66ffc395c2076dc89289d2ded4fc1abb4af6d79710c48`。

ローカルのみ、未コミット・未公開。モバイルはChromeの画面幅エミュレーションで、実スマホではない。保存形式・本文・書き出し・配布物は今回変更せず、保存／ZIP導入の再試験は行っていない。
