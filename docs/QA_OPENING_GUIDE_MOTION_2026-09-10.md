# 公開前CIで検出したタイトル吹き出しの位置ずれ

ユーザーの2026-09-10「デプロイ」に基づく公開前検証中、`4ed41a0` のGitHub CI実行34395642704がタイトル案内の位置で失敗した。センサー側、静的・データ検証は合格。本番デプロイは行わず、失敗した条件をローカルで再現した。

## 原因と修正

タイトルの入口カードが移動している途中にマウスを乗せると、吹き出しの固定位置が初期座標に残る。アニメーションが終わっても戻らず、ボタンとの間隔が想定18pxに対し37px（2048×839）／39.5px（1440×900）になった。CIの測定値は36pxだった。テストの許容範囲を広げて回避していない。

`opening.js` で、メニュー／カードの有限なtransform transitionが動いている間だけ位置を再計算する。終了時には追従を止め、閉じる時は従来どおり予約フレームを解除する。`index.html` の当該JSのキャッシュ識別子も更新した。文言・素材・ストーリー終了判定は変更していない。

## 検証

- `node scripts/check-opening-guide-motion-browser.mjs --before`：未修正の上記2条件を実ポインター移動で再現。カード移動後に乗せる対照条件では問題が出ないことも確認。
- 同スクリプトの修正後試験：同じ3条件で、間隔18〜18.5px、矢印とボタン中心の横ずれ2px以内。pageerror／CSP違反0。修正前後の実画面を主担当が目視した。
- `node scripts/check-contest-experience-browser.mjs --browser <installed Chrome> --output artifacts/release-story-unlock-20260910/contest-guide-final`：PC・横長・モバイルの入口／案内、地図・フッター・ストーリー連携、展示、ツアー、WebGL復旧まで全合格。中央値59.88fps、通常55fps下限を維持。console error／pageerror／unhandled rejection／404は0。
- `npm run check`：precheck／check／postcheckを含め全合格。追加回帰スクリプトと変更JSの構文検査、`git diff --check` も合格。

証跡：`artifacts/release-story-unlock-20260910/` の `ci-attempt1`、`guide-before`、`guide-after`、`contest-guide-final`。新規展開と本番での追加検証は同ディレクトリのリリース記録に分けて保存する。

インストール済みChromeによる実HTML/CSSの試験であり、物理スマホや実ユーザーの保存領域は使用していない。修正前CIの失敗記録を保持し、本修正後の対象コミットのCIを改めて確認してから公開する。
