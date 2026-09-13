# タイトル背景候補：みず・あめ（2026-09-09）

みず・あめのキャラクター画像を参照した、2人だけのタイトル背景5案です。
候補制作時点ではタイトル画像・アプリコードは差し替えていませんでした。

## 2026-09-10：01をタイトルに採用

作者の指定により `01-starlit-observatory.png` をメインタイトル背景に採用。元PNGは保持し、同寸法1672×941の `01-starlit-observatory.webp` を配信用に作成（品質92、構図・人物の描き換えや切り抜きなし）。標準・軽量表示とも同じ選定画像を使用する。

変換手順: `scripts/encode-selected-title-ending.mjs`。本編への適用と検証範囲は `docs/QA_SELECTED_TITLE_ENDING_2026-09-10.md` を参照。ローカル反映で、本番公開は未実施。

| 番号 | 構図 | 画像 |
| --- | --- | --- |
| 1 | 星空の観測室 | [PNG](01-starlit-observatory.png) |
| 2 | 雨上がりの窓辺 | [PNG](02-after-rain-window.png) |
| 3 | 夕暮れの海辺 | [PNG](03-sunset-seaside.png) |
| 4 | 水と星の幻想 | [PNG](04-water-and-stars.png) |
| 5 | 夜明けのキャンパス | [PNG](05-dawn-campus.png) |

- 生成方法：組み込み image_gen。5案それぞれを独立したプロンプトで生成。
- 参照：`../characters/mizuha-calm-07-v2.png`、`../characters/amane-calm-07-v2.png`。
- 既存の `../visuals-08/opening-final-observatory-keyvisual-v4.webp` は雰囲気とタイトル用余白のみの参考。キャラクターの服装は立ち絵を優先。
- タイトル・ロゴ・操作ボタンは画像に焼き込まず、別途重ねる前提。
- プロンプト全文：[prompts.json](prompts.json)
- 比較用ページ：[index.html](index.html)。候補画像の閲覧専用で、本編への適用は行いません。

## 検証結果

- 最終画像5枚：PNG、1672 × 941 px（約16:9）。生成元と保存先のSHA-256一致を全5枚で確認。無加工でコピー。
- 全5案を目視確認：登場人物はみず・あめの2人、長髪／短髪、波形／雲形の髪飾り、濃い青緑／淡い水色の衣装を確認。タイトル・ロゴは未合成。
- 比較ページ：ローカルChromiumの1440 px幅／390 px幅で画像5枚の読み込み、横はみ出しなし、原寸画像を開く操作、HTTP経由のPNG保存と保存後のSHA-256一致を確認。
- HTMLをファイルとして直接開く場合は「PNGを開く」に切り替え。両幅で原寸画像が開くことを確認。画像の保存は開いた画像の右クリックメニューから可能。
- 再実行：別ターミナルで `node scripts/serve-novel-preview.mjs 4487` を起動し、`node scripts/check-title-candidates-browser.mjs` を実行。
- 機械検証記録：`artifacts/title-candidates-20260909/report.json`。比較ページのスクリーンショットも同じディレクトリに保存。
- 未確認：実機スマートフォン、本編への適用後のロゴ・操作UIとの重なり、本番配信。今回の依頼は候補制作のため本編を変更せず、push／デプロイは行っていません。
