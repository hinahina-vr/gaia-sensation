# 観測マップ案内・Imagegen再構成（2026-09-10）

ユーザー依頼: 「添付のやつも毎回出して余白があるんでちゃんとImagegenで余白でないようにして」。

制作: 組み込み Imagegen、既存のプロジェクト画像3枚を編集対象として個別に参照。CLI/APIフォールバックなし。各参照画像と生成結果を目視確認。人物の同一性と各カードの内容を保持し、余白なしの2:1構図へ再生成。

採用元PNG: 1774×887。元画像を artifacts/map-calm-repeat-2026-09-10/source に無加工コピーし、同じ解像度のWebP（quality 92）へ形式変換のみ。切り抜き・余白追加・描き直し・リサイズなし。旧v1は保持。画面は2:1の枠とobject-fit:coverを使用し、表示枠による帯状余白も解消。

## 保存先と最終プロンプト

### live

- 参照（編集対象）: assets/modes/guide-map-live-mizu-ame-v1.webp
- 採用: assets/modes/guide-map-live-mizu-ame-v2.webp
- 無加工PNG: artifacts/map-calm-repeat-2026-09-10/source/live.png

```text
Use case: identity-preserve. Asset type: final production bitmap for a Japanese Earth-observation onboarding card. Edit the supplied project-owned illustration, preserving the same two chibi characters' identities, hair accessories, clothes and polished anime-watercolor rendering. Mizu on the left has long navy hair, white infinity hair clip, teal eyes, white blouse and navy pinafore with mint bow; Ame on the right has short icy-blue hair, white cloud clip, violet eyes, white dress and blue cardigan. Recompose to a WIDE 2:1 landscape (2048 x 1024 preferred), genuinely FULL BLEED artwork extending to all four edges. Closer waist-up framing: characters and the educational subject fill the card, no tiny full-body figures floating in vast sky. Keep both faces and the important subject in the central 80% of the canvas with modest crop safety, but NO blank margin, no white perimeter, no letterbox bars, no border, no blank caption area. The bottom should contain actual scene content, not a fade to white. Gentle friendly smiles, refined soft daylight, less busy sparkle decoration. No text, labels, digits, lettering, logos or watermark; live HTML carries all readable copy. Preserve two characters only. Scene: a large blue-and-green Earth globe between them, delicate flowing weather/cloud currents. Preserve the blue-cyan scene identity. The globe and both guides form one tightly framed continuous composition. Atmospheric sky/cloud detail continues naturally off every edge.
```

### time

- 参照（編集対象）: assets/modes/guide-map-time-mizu-ame-v1.webp
- 採用: assets/modes/guide-map-time-mizu-ame-v2.webp
- 無加工PNG: artifacts/map-calm-repeat-2026-09-10/source/time.png

```text
Use case: identity-preserve. Asset type: final production bitmap for a Japanese Earth-observation onboarding card. Edit the supplied project-owned illustration, preserving the same two chibi characters' identities, hair accessories, clothes and polished anime-watercolor rendering. Mizu on the left has long navy hair, white infinity hair clip, teal eyes, white blouse and navy pinafore with mint bow; Ame on the right has short icy-blue hair, white cloud clip, violet eyes, white dress and blue cardigan. Recompose to a WIDE 2:1 landscape (2048 x 1024 preferred), genuinely FULL BLEED artwork extending to all four edges. Closer waist-up framing: characters and the educational subject fill the card, no tiny full-body figures floating in vast sky. Keep both faces and the important subject in the central 80% of the canvas with modest crop safety, but NO blank margin, no white perimeter, no letterbox bars, no border, no blank caption area. The bottom should contain actual scene content, not a fade to white. Gentle friendly smiles, refined soft daylight, less busy sparkle decoration. No text, labels, digits, lettering, logos or watermark; live HTML carries all readable copy. Preserve two characters only. Scene: the two guides interact with a luminous Earth time wheel and a continuous ribbon showing a tree in three seasons. Preserve the soft warm gold/apricot scene identity. Keep the wheel and seasonal ribbon readable without text and fill the space around them with coherent scenic color and detail, not a blank pale border.
```

### discovery

- 参照（編集対象）: assets/modes/guide-map-discovery-mizu-ame-v1.webp
- 採用: assets/modes/guide-map-discovery-mizu-ame-v2.webp
- 無加工PNG: artifacts/map-calm-repeat-2026-09-10/source/discovery.png

```text
Use case: identity-preserve. Asset type: final production bitmap for a Japanese Earth-observation onboarding card. Edit the supplied project-owned illustration, preserving the same two chibi characters' identities, hair accessories, clothes and polished anime-watercolor rendering. Mizu on the left has long navy hair, white infinity hair clip, teal eyes, white blouse and navy pinafore with mint bow; Ame on the right has short icy-blue hair, white cloud clip, violet eyes, white dress and blue cardigan. Recompose to a WIDE 2:1 landscape (2048 x 1024 preferred), genuinely FULL BLEED artwork extending to all four edges. Closer waist-up framing: characters and the educational subject fill the card, no tiny full-body figures floating in vast sky. Keep both faces and the important subject in the central 80% of the canvas with modest crop safety, but NO blank margin, no white perimeter, no letterbox bars, no border, no blank caption area. The bottom should contain actual scene content, not a fade to white. Gentle friendly smiles, refined soft daylight, less busy sparkle decoration. No text, labels, digits, lettering, logos or watermark; live HTML carries all readable copy. Preserve two characters only. Scene: Mizu holds her open observation notebook with simple colored connection nodes; Ame holds a magnifying glass; a small globe and simple unlabeled graph shapes connect their discovery. Preserve the lavender/blue scene identity. Fit notebook, magnifier and faces clearly into one close full-bleed wide composition without large empty regions.
```

変換・ハッシュ記録: artifacts/map-calm-repeat-2026-09-10/source/conversion-report.json。画面検証は docs/QA_MAP_CALM_REPEAT_2026-09-10.md に記録。
