# 風速に応じたWebGLの色（2026-09-13、ローカル）

依頼：「WebGLエフェクト、風の強さに応じて色変えてほしい　雰囲気でいいから　凡例は不要」

対象は風の流線を描く展示02「風がつなぐ世界」。弱風は青緑、中間は淡い金色、強風は珊瑚色へsmoothstepで連続的に変化する。色の凡例や新しいUIは追加しない。既存のデータ出典・参照値の注意書きは残す。

- 実装：`src/exploration/atmosphere-webgl.js` のwind分岐の色だけを変更。風向・動き・透明度・元の観測値・POIは変更しない。
- 色には補間した風速スカラーを使用。相反する方向のベクトルが打ち消し合っても、その地点を誤って弱風色にしない。値の分類・警戒レベルを表す配色ではない。
- キャッシュ更新：`planet-signals-exhibit.js` → `src/exploration/index.js` → `gaia-mode-loader.js` → `index.html` の依存参照に `wind-strength-color-20260913`。
- 検証版：HEAD `0034ee39cd906960c458d0cf84f6a48e719c39ab`＋翻訳等の既存ローカル変更＋今回の差分。以前のi18n最終manifestは今回変更前の証跡として保持。
- 描画ファイルSHA-256：`b60b70ad1cf52e81399e825ed139b52e5f31f73de4581ba2d1b2c22adb9b4fdf`。

## 実描画・回帰

`node scripts/check-wind-strength-color-browser.mjs --before` で変更前を採取後、変更後に `node scripts/check-wind-strength-color-browser.mjs` を実行。

- Chromeの実WebGL2で0・2・8・18・35 m/sと相反方向18 m/sを描画し、GPUのRGBAピクセルを確認。0／2は青緑、8は金色、18以上は珊瑚色。色の変化を文字列やコードの存在だけで判定していない。
- 代表RGB：変更前2 m/s＝104/190/204、18 m/s＝199/240/245。変更後2 m/s＝100/185/194、8 m/s＝232/204/120、18 m/s＝245/117/97。
- 既存の透明度上限、通常アニメーション、reduced-motionの静止、GLエラーなし。雲／霞の静止フレームの平均RGBは変更前と一致。
- 実展示をPC1440px／スマホ相当390pxで開き、可視・動きと02→03→05→02の切替を確認。実画面のスクリーンショットを目視し、地図・文字・操作を遮らないことを確認。
- `node --check`（描画・回帰試験）、`check-mode-loader-prefetch.mjs`、`git diff --check` も合格。

証跡：`artifacts/wind-strength-color-20260913/before/`、`after/` のreport.json、風速別画像とPC／スマホの展示画像。

ローカル実Chromeの試験。制御した風速fixtureと、外部通信を遮断した保存フォールバックで検証した。実ライブ値取得・物理スマホ・本番公開の合格ではない。コミット・プッシュ・デプロイは実施していない。

前の翻訳作業の既知残件（展示10の読み上げ説明1件、年次分析の保存再読込追加確認）は変更せず保持。今回の色変更は当該経路に影響しない。
