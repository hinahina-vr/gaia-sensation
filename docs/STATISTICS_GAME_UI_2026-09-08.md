# みず・あめのデータ発見ラボ

## 依頼・対象

2026-09-08。分析画面の過剰な余白・小さい文字・暗いUIを見直し、みず・あめを使った楽しいゲーム風UIへ変更する依頼。「分析する」はまずグラフを表示し、「分かること」へ案内する。変更はローカルのみ。既存の世界観ページ・地図スマホUI・初回ガイド変更は保持。push・デプロイは未実施。

## 制作素材

- 内蔵 `image_gen` を使用。CLI/API fallbackは使用していない。
- 配信用：`assets/modes/analysis-mizu-ame-companions-v1.webp`。1536×1024、WebP quality 90。背景込みの不透明イラスト。
- 採用原稿：`exec-17d25b13-3354-438d-99d6-430dfed97f90.png`。ローカル原稿コピー：`artifacts/statistics-game/mizu-ame-source.png`。
- 参照：既存の `assets/characters/mizuha-calm-07-v2.png`、`assets/characters/amane-soft-07-v3.png`、前回制作した `assets/modes/guide-map-discovery-mizu-ame-v1.webp`。第三者素材は追加していない。
- 初稿 `exec-fbe2eaff-fad3-41e7-97ff-4e51edef65bf.png` は透明背景指定に対して市松模様が焼き込まれており、アルファチャンネルなしを確認。不採用とし、内蔵ImageGenで背景だけを明るい雲に修正した。採用版の顔・髪飾り・服装・手・背景を目視確認し、形式変換で切り抜きや描き換えは行っていない。
- 用途：グラフから「分かること」へ進む案内ボタン、発見カードの見出し、任意のAI質問画面。イラストは装飾であり、実データ・AI回答・スコア等を表すものではない。

## プロンプト全文

### 初稿

```text
Use case: illustration-story.
Asset type: transparent-background character duo cutout for a bright Japanese mobile-game-style data discovery interface. This is decoration beside REAL charts, not a chart itself.
Input image 1: Mizu canonical identity/outfit reference (long slate-blue half-up braided hair, white infinity hairclip, teal eyes, cream blouse/mint ribbon, belted navy-teal pinafore). Input image 2: Ame canonical identity/outfit reference (very pale blue bob, white cloud hairclip, blue-violet eyes, pale-blue cardigan, white pleated dress/blue ribbon). Input image 3: approved CHIBI RENDERING style reference only. These are references, not edit targets.
Primary request: Exactly these two girls as expressive polished 3-head-tall chibi companions inviting the viewer to explore a graph. Mizu has a delighted open smile, holds a small closed mint notebook in one hand and gestures invitingly with her other open palm. Ame smiles brightly and holds a small magnifying glass in one hand, with her other hand excitedly near her chest. Their heads are close together so both faces remain large and readable; poses differ naturally. Use waist-up / upper skirt framing with the lower outline gracefully rounded, all hair, hands and props comfortably within the frame. Keep the original everyday outfits.
Composition: 1536x1024 horizontal 3:2 compact duo grouping centered, BOTH characters equally prominent, fill most of frame with only a small transparent margin. Bright high-key refined anime mobile-game art, luminous clean cel shading, vivid cyan and soft lilac highlights, glossy lively eyes, friendly and playful. A few small aqua and gold four-point sparkles around the duo, no backdrop scene.
Background: genuinely TRANSPARENT with alpha, not a white/black/checkerboard background. Crisp clean cutout edges, no rectangular card, no huge glow halo.
Constraints: exactly two characters; each has exactly two arms and two hands; no extra hands or detached fingers; no letters, words, numbers, logos, UI buttons or borders; no real-data graphics, no charts, no trophy or reward, no named-game imitation. Maintain the original hair accessories and outfit identities.
```

### 採用版への背景修正

```text
Use case: lighting-weather / background replacement.
Input image 1 is the edit target. Keep exactly the same two chibi girls, their faces, hair, hair clips, original clothing, hands, notebook and magnifying glass, rendering style and framing. Change ONLY the background.
The current checkerboard is incorrectly painted into the image. REMOVE every checkerboard square. Replace all background with a continuous luminous pale aqua and warm cream cloud background, with small soft pale-gold and mint sparkles. Give the whole scene a bright playful high-quality mobile-game finish that sits naturally in a light aqua UI card. This time the final background should be OPAQUE, fully painted from edge to edge, NOT transparent and NOT pretending to show alpha.
No checkerboards, no grid, no dark shadows, no extra characters, no new props, no text, numbers, logos or UI elements. Do not alter the girls' faces, costumes, hands or poses.
```

## 実装・検証

### 実装

- `index.html`、`gaia-mode-loader.js`、`statistics-lab.js`、新規 `statistics-game.css`：分析開始・再表示はグラフ。「分かることへ」のキャラクターボタンとグラフ横の案内から発見カードへ進む。タブのキーボード移動・フォーカス復帰も保持。
- 4Kでの固定上限1480×840を撤去。3840×2088の同じ表示条件でグラフ画面を3792×2040へ拡大し、本文・軸ラベル・点・操作ボタンも拡大。白いグラフ、明るい水色・紫のカード、立体的なボタンに変更。発見画面は内容に合わせた高さとし、不要な下部の空枠を削減。
- スマホはグラフ、読み取り、次の操作を縦に配置。横持ちはヘッダーを圧縮して初期画面にグラフを表示。隠れていた保存設定欄を分析メニュー内に復帰。
- `statistics-ai.js`：質問画面にも同じ新規イラストと配色を採用。AI送信、鍵保存、計算方法、元データ、分析結果の値、注意書きの意味は変更していない。
- 新規ブラウザー回帰試験と既存4試験を更新。`package.json` に `check:statistics-game:browser` を追加。素材台帳の生成元と生成物を更新し、297素材を検査。

### 検証対象・再現

- 検証日：2026-09-08。基点コミット `3a14ec587a8fb7203b37674c12d95a77c1cf4a78` に本件および先行依頼の未コミット変更を含むローカル作業ツリー。コミット・push・デプロイは実施していない。
- 配信元：`http://127.0.0.1:4447`、ローカルChrome。最終実行時のHTML・ローダー・分析JS・AI JS・新規CSS・採用WebPのSHA-256を `artifacts/statistics-game/verified/report.json` に記録し、実行後に一致確認済み。
- 変更前に実際の地震展示の「分析する」で、最初に「分かること」が開く状態と、4Kでも1480×840・本文15pxの狭い画面を再現。変更後も同じ入口で確認。スマホはツールシートの「統計分析」を実際に押して検証。
- 比較画像：`artifacts/statistics-game/3840-before-findings.png`、`3840-before-chart.png`。最終画像：`artifacts/statistics-game/verified/1440-chart.png`、`3840-findings.png`、`390-findings.png`、`844-chart.png` など。最終版の画像を開き、文字、グラフ、キャラクター、カード配置、横持ち表示を目視確認した。

### 合格したブラウザー試験

以下は `node scripts/<script> http://127.0.0.1:4447 artifacts/statistics-game/<directory>` で実行。5レポート、計81ケースが `passed`、各レポートの `errors` は0。

| スクリプト | 保存先 | ケース・確認内容 |
| --- | --- | --- |
| `check-statistics-game-browser.mjs` | `verified` | 8画面：3840×2088、2560×1392、1440×900、1024×768、768×1024、390×844、320×568、844×390。グラフ初期表示・再表示、画像decode、白いグラフ、拡大表示、横はみ出しなし、44px以上のタブ、主要CTA文字のコントラスト4.5以上、発見への誘導、元レコード選択、キーボード・ポインター操作。1440/390では条件変更→保存→実際のページ再読込→適用→試験用保存の削除まで確認。 |
| `check-statistics-discovery-browser.mjs` | `exhibits` | 全30展示×PC/スマホの60ケース。対応展示はグラフから発見へ進むこと、対象外の無効化、データ範囲・注意書き・レコード同一性を確認。 |
| `check-statistics-readable-comparison-browser.mjs` | `comparison` | 1920/1440/1024/390/320の5ケース。観察と意味の対応、数値不変、元レコードへのリンク、派生値除外、フィルターリセット。 |
| `check-statistics-studio-browser.mjs` | `studio` | 1440/390/320の3ケース。5ビュー、分析方法変更、値の一致、タブキー操作、AI質問候補。 |
| `check-statistics-ai-browser.mjs` | `ai` | 3840/1440/390/320/812の5ケース。6種類の質問先、明示送信、鍵の保存・削除、同一オリジン拒否、401・再試行、XSS文字列の安全表示、キャンセル、長文スクロール、フォーカス復帰。AI通信は試験用応答であり、実プロバイダー配信ではない。 |

関連4ブラウザー試験の後に行った最終変更は、CTAの色コントラストと横持ちCSSの調整。調整後の全ランタイムを使って主試験8画面を再実行し、合格を確認した。

### その他の合格チェック

- `npm run check:statistics-lab`：26分析方法・統計計算・10モードのデータ契約。
- `npm run check:statistics-data-insights`：25方法、発見文の反例、補完値・フィルターの扱い。
- `node scripts/check-statistics-ai.mjs`：14プリセット、送信先・アダプター、データ量制限、秘匿情報除去。
- `node scripts/check-statistics-datasets.mjs`：13データセット。
- `node scripts/check-app-content.mjs`：9モード・15カタログ。
- `npm run check:security-policy`、`npm run check:rights`、`node scripts/check-mode-loader-prefetch.mjs`：最終変更後にも再実行し合格。
- 変更JS・新規回帰試験の `node --check` と `git diff --check`：合格。

### 未確認の範囲

物理スマホ、Safari、外部AIプロバイダーの実送信、公開環境での動作は未確認。ブラウザー試験にはリポジトリーのデータスナップショットと試験用API応答を使用した。新規の書き出し機能・配布ZIPは作成していないため、その導入確認は対象外。本件はローカル実装・検証までであり、本番反映済みとは扱わない。
