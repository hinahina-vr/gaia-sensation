# 31〜71 背景の陸地除外

共通シェーダーの陸地側18%残留を、31〜71ではゼロに変更。21と同じNatural Earthマスク・境界しきい値を使用し、陸上の背景はRGBAすべてゼロにする。陸地マスクのないCSS代替演出もこの範囲では無効化。01・15〜20・21の背景仕様は変更しない。

検証対象はローカル作業ツリー。Chrome 1440×900 / 390×844、保存データ使用、外部API遮断。

- 地図31・38・54・69・70・71：実WebGL描画直後に内陸の座標のRGBAを読み取り、完全透明を検査。海側の非ゼロピクセルと時間経過による変化、横溢れなしを検査。
- 同じ6展示から21・15への切り替えも別実行で合格。
- PC31のスクリーンショットを目視確認。
- 構文検査 `node --check src/exploration/map-theme-background.js` 合格。

再実行: `QA_NUMBERS=31,38,54,69,70,71 GAIA_OUTPUT_DIR=artifacts/map-ocean-only-20260912 node scripts/check-map-theme-background-browser.mjs`（PowerShellでは環境変数を個別設定）。結果・対象ファイルハッシュは同ディレクトリのreport.json。

31〜71の全展示個別の目視、実機スマホ、本番配信は未検証。ローカルのみ、未公開。
