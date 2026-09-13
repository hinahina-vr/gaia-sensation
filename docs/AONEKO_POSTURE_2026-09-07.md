# 青猫：首の傾きと頭身の修正

2026-09-07の製作者依頼に対応。ローカル差し替えのみ。push・デプロイ・配布ZIPの作成はしていない。

## 採用素材と変更

- 採用先: `assets/characters/aoneko-silhouette-imagegen-v4.png`（941×1489px / RGBA）。
- 生成サービス: OpenAI ImageGen、Codexの組み込み画像生成ツール。CLI/API fallbackは使用していない。
- 元画像: `aoneko-silhouette-imagegen-v3.png`。旧版は削除せず保存。
- 採用した生成出力: `exec-e42b62a5-87b8-472d-924c-f20b0f90f2c0.png`（941×1672px）。
- 首を横に傾けた姿勢をやめ、短い自然な首の上へ頭を起こす。5.5〜6頭身を目安に頭を相対的に大きく、脚を短くした。
- 顔を描かない青灰色の中性的なシルエット、カーディガン、二本脚のパンツ、平底靴、鞄とスマートフォンは維持。物語本文・人物設定・他の3人の素材は変更していない。
- `character-mode.js` と `index.html` の立ち絵・選択アイコンを新素材へ変更。`character-mode.css` の青猫専用アイコン切り抜き位置を合わせ、`gaia-mode-loader.js` とHTMLの読み込み識別子を更新した。
- 読み込み識別子: `gaia-aoneko-natural-posture-1`。
- 共通ローダーのHTML参照は既存のhardening識別子を継承し、`gaia-hardening-1-aoneko-natural-posture-1` に更新。

## 透過処理

生成ツールへ透過PNGを指定したが、今回の出力は背景に市松模様を描いたRGB画像だった。生成だけで真の透過を得たとは扱わない。

製作者へ確認し、「背景だけ画像処理で透過する」という明示回答を受けてから、既存の `scripts/remove_checkerboard_alpha.py` を使用。外周からの背景除去に加え、今回の青灰色シルエット専用オプションで髪の隙間・輪郭に残った明るい無彩色の背景を透過した。一般の白い服やカラー人物にはこの専用オプションを適用しない。

上下の空の余白だけを各30pxに整理し、足元が既存の画面位置に収まるようにした。生成画像の y=105〜1593 をそのまま採用しており、人物の拡大縮小・変形・描き足し・RGBの色変更は一切していない。切り出した元画像とのRGB完全一致を検査する。

再処理コマンド（`SOURCE.png` は上記採用出力の保存先）:

```powershell
python scripts/remove_checkerboard_alpha.py SOURCE.png assets/characters/aoneko-silhouette-imagegen-v4.png --vertical-padding 30 --blue-silhouette
```

PythonのPillow・NumPyが必要。今回の実行にはアプリ付属ランタイムを使用した。OS既定のPythonはPillow未導入だったため使用していない。

## 採用画像の最終生成プロンプト

```text
Redraw this existing anonymous blue-gray silhouette as a CLEARLY SHORTER-PROPORTIONED, natural 5.5-head-tall androgynous young adult. The attached image is the outfit and silhouette-style reference; do NOT copy its long-legged body or its tilted neck. Upright head directly centered over a short relaxed neck, vertical head axis, level shoulders, ordinary balanced standing pose. A noticeably larger head and a shorter compact torso-to-leg silhouette: crown-to-chin is about one fifth and a half of the complete crown-to-soles height; the legs are NOT the majority of the figure. Shorten the shins and thighs. This is an ordinary approachable anime protagonist, not a fashion model or romance-game love interest. Keep the loose cardigan, undershirt, relaxed two-legged trousers, flat rounded shoes, short shaggy bob hiding an entirely blank featureless face, same small phone held near the abdomen and hand quietly holding a shoulder-bag strap. Not a child or super-deformed chibi. Same flat muted medium slate-blue silhouette with very subtle near-tone thin clothing outlines. Full body, both shoes visible. Make a production-ready CUTOUT PNG with a genuinely TRANSPARENT ALPHA BACKGROUND, just like the transparent source image. Outside the figure every pixel must be empty/transparent, NOT painted checkerboard, NOT white or gray. No floor or shadow, no text, no decorative effects. The figure should occupy about 80% of the portrait canvas height, with empty transparent margins, and have substantial head size relative to its shortened body.
```

## 検証

- 変更前の実ブラウザー記録: `artifacts/aoneko-posture-before`。旧素材で5画面幅の切替動作を確認し、旧ポーズを保存。
- 差し替え後の初回記録: `artifacts/aoneko-posture-after`。5画面幅の機能試験は合格したが、目視で髪の白い背景残りを検出したため最終版とはしていない。
- 輪郭修正後の記録: `artifacts/aoneko-posture-final`。5画面幅の機能試験が合格。1920pxの全身と丸いアイコンを目視し、白い背景残りが解消したことを確認。
- 最終の読み込み識別子まで含めた記録: `artifacts/aoneko-posture-verified`。5画面幅すべて合格、pageerror・404とも0件。3840pxの全身と390pxの紹介配置も保存画像を開いて確認。
- PNGのSHA-256: `2C95EDB345045D4B12C41B9B2D239364F51EC4ABDA5D092BB09CCA62FF44CE50`。
- 画像の透明画素72.0192%、不透明画素27.9808%、四隅alpha=0。残存する明るい無彩色の背景画素は0。元の生成画像の対応領域とRGBが完全一致することを検査済み。

素材台帳を293件へ更新し、`npm run check:rights` は合格。共通テストが旧キャッシュ識別子を固定していた箇所は現行のCSS/JS同時更新・立ち絵/アイコン一致の検査へ更新した。

素材台帳の追加で全体の対象ハッシュも変わるため、権利台帳の対象ハッシュを整備した。新しい青猫の1件だけを除いたインメモリ再計算が旧 `aa5443bd...` と完全一致することを確認し、今回の製作者依頼に対応した画像追加だけを新 `a712bb90...` に記録した。GOSAT等のデータ・依存・既存素材や各判定は変わっておらず、保留項目も解除していない。詳細は `docs/rights-review.json` の `scopeMaintenance`。公開承認や提供元許諾取得の追加を意味しない。

回帰試験は立ち絵とアイコンの新素材参照、実ピクセルのalpha、寸法、画像読込、4人の切替・キーボード周回、青猫の本名非表示と他3人の表情復元、紹介文の画面内配置、閉じる操作を検査する。頭の角度・頭身・見た目はスクリーンショットを実際に開いて別途確認し、コードやalpha試験の合格だけを姿勢確認としない。

```powershell
node scripts/check-aoneko-character-browser.mjs http://127.0.0.1:4447 artifacts/aoneko-posture-verified
npm run rights:build
npm run check:rights
npm run check
git diff --check
```

対象はローカルChrome実描画で3840・1920・1440・390・320px。スマホは画面幅とタッチ入力のエミュレーションであり実機ではない。公開環境、Safari/Firefox、物語全編、ZIP導入、実機スマホは今回未確認。保存機能の仕様は変更していない。

最終結果: `npm run check`（precheck / postcheckを含む）、`npm run check:rights`、変更JSの構文検査、`git diff --check` が合格。背景残りの画素検査も恒久的な回帰試験へ追加し、`artifacts/aoneko-posture-regression-final/report.json` で5画面幅の再実行がすべて合格、残存白背景画素0、pageerror・404とも0件を確認した。検証後に画像や実装の変更はしていない。
