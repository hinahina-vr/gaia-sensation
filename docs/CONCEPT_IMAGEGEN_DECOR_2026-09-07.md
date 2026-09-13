# コンセプトページのImageGen装飾 — 2026-09-07

## 制作範囲と生成方法

ユーザー指示「デザイン、生成AI臭いので、もっとふんだんにimage genで装飾して」に対応したconcept-7用の4点。内蔵ImageGenを使用し、素材ごとに1回ずつ独立した新規生成を実行。CLI/APIキー方式は使用していない。入力参照画像なし。プロンプトは以下に全文を保存する。

青い版画、紙の切れ端、鉛筆線、地球と記録という共通の質感で、冒頭の欄外カット・章間の帯・学びの図版・深層の扉絵を作成。実モードのスクリーンショット、スタッフロールに記載された4科目、ゲーム本編03の画像、既存の神話製作機械の図版は描き換えていない。新しい絵は装飾として区別し、地理・統計の正確な資料、実際の授業ノート、本編の未登場シーンとして紹介しない。画像内に読ませる本文や重要情報は置いていない。

生成PNGを確認後、原本を保持したまま `artifacts/concept-page-v7/source/` にコピー。Web用には `scripts/build-concept-editorial-assets.mjs` で縦横比を保持して縮小し、WebP形式に変換した。合成・着色・切り抜きなどの画像編集は行っていない。地球と帯の透明背景はImageGenが生成したアルファを保存し、変換後も透明度0〜255を検証した。元の既存画像は削除していない。

## 保存先

リポジトリ: `E:/CodexData/home/worktrees/ba60/touch-prism-mvp`

| 素材 | 採用ファイル | 元PNG → WebP寸法 | bytes |
| --- | --- | --- | --- |
| earth-emblem | [brochure-ornament-earth-v1.webp](../assets/concept/brochure-ornament-earth-v1.webp) | 1254 × 1254 → 640 × 640 | 140,310 |
| field-ribbon | [brochure-ornament-ribbon-v1.webp](../assets/concept/brochure-ornament-ribbon-v1.webp) | 2172 × 724 → 1800 × 600 | 391,960 |
| learning-desk | [brochure-ornament-learning-v1.webp](../assets/concept/brochure-ornament-learning-v1.webp) | 1536 × 1024 → 1440 × 960 | 237,472 |
| deep-archive | [brochure-ornament-archive-v1.webp](../assets/concept/brochure-ornament-archive-v1.webp) | 2172 × 724 → 1800 × 600 | 119,480 |

4点の合計は889,222 bytes。LP内だけで使用し、下部の大きな装飾には遅延読み込みを設定。既存の本編入口からリンク・プリロードしていない。

### earth-emblem

- Web: `assets/concept/brochure-ornament-earth-v1.webp`
- 原本コピー: `artifacts/concept-page-v7/source/earth-emblem-v1.png`
- 生成時の原本: `E:/CodexData/home/generated_images/01a067a6-1244-7f52-9325-1463844bcacb/exec-dc18e0ae-3c29-4d3b-8cb9-9c5597053a60.png`
- 採用WebPのSHA-256: `75fe68e75411dac19f13a5fa7c9080d03de5616d59b52e0b008641488fbdfdff`

最終プロンプト:

```text
Use case: stylized-concept
Asset type: transparent spot illustration for the margins of a Japanese university graduation-project brochure about Earth data, perception and interactive narrative.
Primary request: an original, tactile hand-printed Earth observation emblem, not a polished app icon.
Subject: one small globe with loosely observed blue oceans and sage land, crossed by a few orbit and contour-pencil lines, with a folded fragment of a contour map tucked beneath it. The globe is the dominant readable silhouette.
Style/medium: Japanese independent science-zine illustration; uneven navy drypoint outlines, dense cyan and sage risograph ink, modest ochre accents, real-looking paper cut edges and slightly misregistered layers. Deliberately crafted and specific, with organic mark-making rather than glossy perfect geometry.
Composition: square image, one clustered isolated cut-paper vignette, comfortable transparent space around all edges. Do not fill the canvas with tiny symbols. The object should remain clearly readable when shown 150px wide.
Backdrop: genuinely transparent alpha outside the illustrated paper pieces; no white canvas and no checkerboard painted into the image.
Text: none.
Constraints: no characters, no game scene, no user interface, no fake data, no numbers, no letters, no logos, no sparkle icon, no neon, no 3D render, no watermark. Bright, fresh, bookish; retain the restrained cream/navy/cyan/sage/ochre material language.
```

### field-ribbon

- Web: `assets/concept/brochure-ornament-ribbon-v1.webp`
- 原本コピー: `artifacts/concept-page-v7/source/field-ribbon-v1.png`
- 生成時の原本: `E:/CodexData/home/generated_images/01a067a6-1244-7f52-9325-1463844bcacb/exec-f4837da9-4314-4c85-8771-75f0293f5c2c.png`
- 採用WebPのSHA-256: `13fa96b0781719cf6074fa5208e4a2c1c8fe3cdd49539b36f5f26f823a824cd1`

最終プロンプト:

```text
Use case: stylized-concept
Asset type: wide decorative editorial ribbon between sections of an Earth-data graduation-project brochure, NOT a screenshot or a scene from the game.
Primary request: a richly hand-drawn observation notebook collage in a long landscape composition, connecting geography, ocean movement and perception.
Subject: overlapping torn contour-map fragments, several sweeping deep-blue ocean-current ink strokes, a small hand-drawn globe at one end, a transparent tracing-paper orbit sketch, and a few simple blank data-plot shapes. The objects connect in one flowing irregular horizontal band rather than separate icon tiles.
Style/medium: handmade Japanese science field-notebook spread, confident navy dip-pen and pencil drawing, cyanotype blue washes, sage risograph patches, one restrained ochre paper accent, visible print grain and real-looking torn fibrous edges. Lively and precise, not symmetrical vector clipart.
Composition: approximately 3:1 panoramic raster illustration with a low continuous collage ribbon occupying the middle two thirds in height. Irregular silhouette with truly transparent alpha around the whole assembly; generous empty margins above and below. No rectangular background.
Text: none; plotted marks are decorative and have no values or axis labels.
Constraints: no people, no anime figures, no scenery purporting to be in the game, no typography, no arrows implying validated science, no fake interface, no watermark, no glow, no generic corporate illustration, no glossy 3D.
```

### learning-desk

- Web: `assets/concept/brochure-ornament-learning-v1.webp`
- 原本コピー: `artifacts/concept-page-v7/source/learning-desk-v1.png`
- 生成時の原本: `E:/CodexData/home/generated_images/01a067a6-1244-7f52-9325-1463844bcacb/exec-7c19d116-431a-4c73-acec-b53e280d30bc.png`
- 採用WebPのSHA-256: `4abb638a1ab73e054a0aa4f5e62f8fcf655b1779e068deac3842b5543db3d734`

最終プロンプト:

```text
Use case: stylized-concept
Asset type: large editorial chapter illustration for the university-learning section of a graduation-project concept brochure.
Primary request: an inviting overhead illustration of the physical process of learning and connecting ideas.
Subject: a well-used open notebook with a hand-drawn Earth and several flowing observational pencil sketches, a loose sheet with an unlabeled distribution curve and sparse dots, two closed plain books with no lettering, and a single wooden pencil. Arrange them as one slightly asymmetrical working composition, with a torn blue map sheet peeking out. No invented syllabus text.
Style/medium: hand-painted gouache plus navy pencil lines and cyan risograph overprint on warm uncoated paper, detailed but economical marks, obvious organic edges and uneven pigment. An illustrated small-press university exhibition catalogue, tactile and thoughtful.
Composition: landscape 3:2 top-down view; all main objects fully within the frame, ample warm cream paper around them, off-center grouping with airy margins. Background is a flat warm ivory paper color near #f6f4e9, not a room, no tabletop wood grain. Bright natural feel with very subtle painted contact shadows.
Color palette: deep ink navy, muted cyan, sage green, off-white, a little ochre.
Text: none, including book covers and notebook pages.
Constraints: no people, no human hands, no characters, no game scene, no logos, no typed formulas, no legible prose, no neon, no smooth vector icons, no faux web layout, no watermark.
```

### deep-archive

- Web: `assets/concept/brochure-ornament-archive-v1.webp`
- 原本コピー: `artifacts/concept-page-v7/source/deep-archive-v1.png`
- 生成時の原本: `E:/CodexData/home/generated_images/01a067a6-1244-7f52-9325-1463844bcacb/exec-7d3df55c-6950-45a5-a465-a7bc10aa8c02.png`
- 採用WebPのSHA-256: `66a09c0227241ed281fb9139c6ed0b291fe4d2c9d9ba130f2b8f871c43c72d1b`

最終プロンプト:

```text
Use case: stylized-concept
Asset type: atmospheric panoramic chapter plate for the deep underlying philosophy section of the same Japanese university graduation-project brochure.
Primary request: a handmade print about memory becoming interpretation, quiet and mysterious rather than spectacular science fiction.
Subject: an open small record notebook on dark blue paper, several cream loose pages lifting from it in a gentle arc, their fine ink paths connecting to a modest terrestrial globe on the far side; some records become loose abstract constellations of small ink dots. Suggest an archive of personal experience without portraying a machine as a finished working product.
Style/medium: deep-indigo cyanotype and drypoint engraving, hand-cut collage on richly grained dark navy paper, fine warm ivory hatching and a restrained pale-cyan line. Handmade book frontispiece, deliberately asymmetrical, specific material texture.
Composition: very wide 3:1 landscape plate, notebook towards lower left, pages crossing low across the center, globe toward right. Keep the upper third relatively quiet. Solid dark navy background near #07111d reaching every edge; no frame. Clearly illustrated symbolic objects, not a real place.
Text: none.
Constraints: no human figures, no portraits, no anime scene, no goddess, no gold luxury ornament, no neon cyberpunk, no 3D glass spheres, no fantasy castle, no web interface, no logos, no watermark. No pseudo-language. This image decorates a chapter and carries no essential explanatory text.
```


## 検証・権利記録

- 4点すべての実出力を表示し、共通の紙・版画の質感、人物やUIを増やしていないこと、画像内に重要な説明本文がないことを確認。
- `artifacts/concept-page-v7/source/conversion-report.json` に元寸法、採用寸法、容量、アルファ、SHA-256を保存。
- レスポンシブな実画面、文字との分離、実モード画面との区別、既存機能の試験は [CONCEPT_PAGE_2026-09-07.md](CONCEPT_PAGE_2026-09-07.md) のconcept-7記録を参照。
- 素材台帳ではOpenAI ImageGenとして分類。本生成の記録と出力を保存するが、利用プラン・第三者権利・利用規約適合性を独立に確認したとは表現しない。
- ローカル制作のみ。push・公開デプロイは実施していない。

