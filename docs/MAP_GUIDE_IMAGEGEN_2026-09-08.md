# みずとあめの地図ガイド：ImageGen制作記録

- 制作日：2026-09-08。ユーザーの明示依頼で内蔵 image_gen を使用（CLI/API fallbackは不使用）。
- 用途：地図の初回見どころ紹介。明るく大きなソシャゲ風のカード用イラスト。実観測や実際のUI画面ではなく装飾。
- 参照：既存の `assets/characters/mizuha-calm-07-v2.png` と `assets/characters/amane-soft-07-v3.png`。みず（青野瑞葉）とあめ（雨宮周）の衣装・髪・髪飾りを参照。第三者の画像は追加していない。
- 3枚とも1536×1024。生成原稿は変更せず保存、同解像度のWebP quality 90へ形式変換。切り抜き・色補正・描き直しは変換処理では行っていない。
- 3枚目の初稿には手が余分に描かれたため、内蔵ImageGenによる部分修正後の出力のみ採用。採用版の顔・衣装・手を目視確認。
- PNG原稿コピー：`artifacts/feature-bright/imagegen-sources/`。配信側は以下のWebPを使用する。

| 配信ファイル | 生成原稿ファイル名 |
| --- | --- |
| assets/modes/guide-map-live-mizu-ame-v1.webp | exec-581b87cd-2775-4240-9e79-4ae6eeee1d44.png |
| assets/modes/guide-map-time-mizu-ame-v1.webp | exec-7912f223-62dc-4018-9141-fc88cffa872d.png |
| assets/modes/guide-map-discovery-mizu-ame-v1.webp | exec-78e80b42-d93a-4502-971b-1219852634ab.png |

## 実装・検証記録

- 対象：ベースコミット `3a14ec587a8fb7203b37674c12d95a77c1cf4a78` に本依頼を反映したローカル作業ツリー。コミット・push・本番配信は未実施。
- `app.js`、`mode-entry-guide.js`、`mode-feature-intro.css` で地図の見どころ紹介に限定して明色テーマとイラスト3枚を追加。共通ファイルの参照更新は `gaia-mode-loader.js`、`index.html`、`sensors/index.html`。センサーの紹介画面は従来の表示を維持。
- 4K幅で案内画面は1060pxから2640px、本文は12pxから29pxに拡大。スマホは縦スクロール、横向き・タブレットは画像と説明を横並びにし、開始・閉じる操作を固定表示。画像は切り抜かず全体表示する。
- 制作記録をメディア権利台帳の生成処理に登録し、台帳を更新（296アセット）。ここでの台帳更新は本番への配信を意味しない。
- ローカルChrome・保存データfixtureによる比較回帰試験：`node scripts/check-feature-bright-browser.mjs http://127.0.0.1:4447`。1440×900、2560×1392、3840×2088の3ケース合格。変更前後を同条件で撮影し、画像のデコード、明るい背景、文字サイズ、画面内への収まり、操作領域を検証。
- ローカルChromeによる関連機能回帰試験：`GAIA_FEATURE_OUTPUT=artifacts/feature-bright-lifecycle` を設定して `node scripts/check-feature-intro-browser.mjs http://127.0.0.1:4447`。地図・センサーの1440×900、390×844、320×568、844×390、768×1024、3840×2160、およびセンサーのログイン・機器ページを合わせた14ケース合格。初回表示、開始、再表示、任意の操作ガイド、Escape、フォーカス循環、スクロール、セッション保存後の再読み込みを実操作で確認。
- JavaScript構文、メディア権利台帳、セキュリティポリシー、アプリ内容、モード先読み、地図デモ、`git diff --check` のチェックに合格。
- 証跡：`artifacts/feature-bright/report.json` と `artifacts/feature-bright-lifecycle/report.json`。両レポートの記録対象SHA-256は検証後の現ファイルと一致、エラー0。スクリーンショットも各ディレクトリに保存。スマホ縦・横、小画面の下部説明、4Kの実出力を目視確認した。
- 未確認：物理スマートフォン、Safari等の別ブラウザー、本番配信、外部プロバイダーのライブ取得、実APIキーを使用するAI分析。fixtureによる画面試験を実配信・実API確認とは扱わない。本変更にZIP等の配布物はない。

## 使用したプロンプト全文

### 1. 地球のいま

```text
Use case: illustration-story. Asset type: final in-app illustration for a bright Japanese social/mobile game onboarding card about watching Earth's changing present.
Input images: Image 1 is the canonical character reference for Mizu (long dark slate-blue hair, half-up braid, white infinity-shaped hair clip, teal eyes, cream long-sleeved blouse with mint ribbon and navy-teal belted pinafore dress). Image 2 is the canonical character reference for Ame (short very pale sky-blue bob, white cloud hair clip, blue-violet eyes, light-blue cardigan, white collared pleated dress with a light-blue ribbon). These are identity/outfit references only, NOT an edit target. Reinterpret both as adorable polished 3-head-tall chibi characters while keeping hair, accessories, outfit colours and identities recognizable.
Primary request: An exciting, cheerful, high-key gacha-game-style illustration with BOTH Mizu and Ame gleefully exploring a small floating Earth globe together. Mizu gestures with an open hand toward the globe and smiles; Ame raises one hand delightedly as she notices a little cloud curling above it. The globe is between them; a few luminous curved wind trails, small fluffy clouds and friendly sparkle shapes convey a living planet. This is decorative illustration, not an observation chart.
Composition: horizontal 3:2 landscape, approximately 1536x1024; medium-full view with both complete heads and hands comfortably inside the central 85%, faces LARGE and legible at card size, characters fill most of the frame. Mizu on the left, Ame on the right, globe central. Keep all important content away from the outer 8% to allow responsive cropping. Pale aqua sky and creamy white clouds fill background edge to edge.
Style: high-quality original anime mobile-game illustration, clean refined linework, bright luminous cel shading with gentle painterly highlights, colourful expressive eyes, rich cyan/mint/sky blue with warm peach skin; welcoming, playful, lively and sunlit, not a dark control room. Clear large shapes, no clutter.
Constraints: exactly these TWO fictional characters, correct number of limbs/fingers, no extra people, no logos, no lettering, no numbers, no UI, no frames, no watermarks, no brand/game imitation, no night sky, no grim blue-black shadows. Keep the two original outfits, do not turn them into revealing fantasy costumes. Do not include the reference sprite backgrounds or glow cutout halos.
```

### 2. 時間の変化

```text
Use case: illustration-story. Asset type: the SECOND illustration in the same bright Japanese mobile-game onboarding card set, introducing changing years / exploring historical change.
Input image 1 is the approved style and character consistency reference for this three-card set: preserve exactly its two chibi girls, clear rendering, delightful faces and sunlit finish. Input image 2 is Mizu's original outfit and hair reference. Input image 3 is Ame's original outfit and hair reference. All images are references, not edit targets.
Primary request: Mizu and Ame happily playing with a small floating globe and a magical ribbon of TIME. Mizu, long dark slate-blue half-up hair with a white infinity clip, cream blouse/mint bow and dark teal belted pinafore dress, is on the left with an excited curious smile and one hand gently turning a large luminous circular clock-like ring around a small planet. Ame, pale-blue bob with white cloud clip, light-blue cardigan and white pleated dress/blue bow, is on the right joyfully pointing along a flowing ribbon showing THREE tiny seasonal tree/island miniatures (fresh greenery, warm sun, golden leaves). The ribbon feels like a playful timeline sliding from one moment to the next, NOT a graph of real numbers. The globe stays clearly secondary to their expressive faces. No actual numerals or letters anywhere.
Composition: 1536x1024 horizontal 3:2 card illustration. The two girls' heads and hands large and safely inside central 85%. Use a different pose from reference image 1; full or medium-full chibi bodies with no crop of heads/hands. Plenty of breathing room. Background edge to edge luminous cream, apricot and pale gold sky with soft pastel clouds. Teal and pale-blue clothing stays original.
Style: same polished original anime mobile-game art as image 1, refined lines, vivid but soft cel shading, big expressive eyes, warm high-key daylight, rounded readable forms. Cheerful discovery and movement, no dark console mood.
Constraints: exactly TWO characters, preserve clothing/hair identity and 3-head chibi scale, no extra people/limbs, no labels, no text, no numbers, no UI mockup elements, no card border, no watermark or logos, no imitation of any named game. No exposing costume redesigns. Bright, fun, warm, readable at small sizes.
```

### 3. データの発見：初稿

```text
Use case: illustration-story. Asset type: THIRD final in-app illustration in a bright original Japanese mobile-game onboarding set; this card is about discovering relationships in data and asking questions.
Input image 1 is the approved style and character consistency reference for the set. Input image 2 is Mizu's canonical character design and outfit. Input image 3 is Ame's canonical design and outfit. These are references, not edit targets. Retain their identities faithfully.
Primary request: Two delighted 3-head-tall chibi girls, Mizu and Ame, discovering a sparkling connection together. Mizu on the left has long dark slate-blue half-up braided hair with a white infinity clip, cream blouse and mint bow under a dark teal belted pinafore dress. She holds an open notebook with simple colourful abstract dots and curves but NO readable text. Ame on the right has a pale-blue bob, white cloud clip, blue-violet eyes, light-blue cardigan and white pleated dress/blue bow. She holds a magnifying glass toward several floating rounded translucent chart blocks between them. Use three pastel bars and a simple curved connection of star-like points as decorative symbols of analysis, NOT actual data. Include a small decorative turquoise globe near the blocks. Their faces are large, very happy and curious; the action feels like solving a little discovery together.
Composition: 1536x1024 horizontal 3:2, medium-full chibi view, both heads and hands fully in the central 85%, no crop of hair clips. Main grouping fills the frame, clear silhouettes and breathing room. Edge-to-edge luminous lavender, rosy pink and creamy white cloud background, plenty of light.
Style: match reference image 1's polished anime mobile-game illustration, refined outlines, vibrant expressive eyes, clean cel shading with soft painterly glow and sunny peach skin. Keep original pale-blue/teal costumes despite the lavender background. Joyful, friendly, playful, high-key, bright enough for a light-coloured UI.
Constraints: exactly these TWO fictional girls, correct anatomy, no extra limbs, no other people, no labels, no numbers, no text, no question-mark glyphs, no logos, no UI buttons, no border, no watermark. No named-game imitation, no dark cockpit, no exposing outfit changes.
```

### 3. データの発見：採用版への局所修正

```text
Use case: precise-object-edit. Input image 1 is the EDIT TARGET, the third illustration in our bright game onboarding set.
Make exactly one anatomical cleanup while preserving every other detail, the two girls' identities, their expressions, costumes, the notebook, magnifying glass, decorative charts, globe, framing, colours and sunny pastel style.
Mizu, the long dark-blue-haired girl on the left, currently has THREE hands: one supporting the LOWER LEFT EDGE of the open notebook (viewer left), one pointing upward near the image centre, and an extra small hand gripping the UPPER RIGHT EDGE of the notebook near the image centre. REMOVE ONLY that extra hand at the notebook's upper-right edge and any detached forearm belonging to it. Restore the notebook edge and pale background cleanly at that spot.
Mizu should have exactly TWO arms/hands: one visible hand supporting the notebook at its lower-left edge, one raised pointing hand. Keep those two existing hands and their poses intact. Ame on the right already has two hands, holding a magnifying glass and a curled hand by her ribbon; keep her entirely unchanged.
No other changes, no text, no logos, no additional limbs.
```
