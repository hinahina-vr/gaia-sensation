# GAIA SENSEWARE GX Official Setting Book

映画パンフレットを意識した10ページの公式設定集です。

文章で管理する公式設定の正本は
`../../docs/GAIA_SENSEWARE_GX_OFFICIAL_SETTING.md` です。

## Page structure

1. 表紙・GXキービジュアル
2. 世界観とGaia Transformationの定義
3. 逗子の海辺で始まるプロローグ
4. ミズハとアマネの人物設定
5. コノハナサクヤヒメを基に再設計したサクヤ
6. GAIA SENSEWAREと10の感覚器官
7. 抽象・地図・ノベル・宇宙のシステムUI
8. オープンデータ、GOSAT、SOURCE / DERIVED / SCENARIO
9. 三幕構成と観客＝第四の共創者
10. GXマニフェスト・最終キービジュアル

## ImageGen prompt set

- サクヤ再設計：桜、火、富士、再生を現代服へ変換。黒褐色の高いサイドポニー、琥珀色の目、短い炭色ジャケット、朱のタイ、富士型の裾を持つ灰桜スカート。巫女服・青髪・長い波髪は禁止。
- 新三人設定画：既存07案のミズハとアマネを固定し、新サクヤを混ぜずに並べる。
- プロローグ：オンライン大学の三人が逗子の海辺で初めて会う自然な場面。
- 表紙：青い時間の海辺、10の信号、未完の地球神経網、観客の手、画面外に巨大な太陽の縁。

日本語本文とUI説明は、文字化けを避けるためImageGen画像へ直接焼き込まず、Noto Serif JP / Noto Sans JPで組版しています。

## Build

Bundled Pythonで `build_book.py` を実行すると、`pages/` のPNG、`contact-sheet.png`、`output/pdf/gaia-senseware-gx-official-setting-book-v1.pdf` を再生成します。
