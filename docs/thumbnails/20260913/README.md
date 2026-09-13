# README・応募用サムネイル

2026-09-13制作。README用7枚、コンテスト応募用2枚、計9種類です。[ブラウザで一覧を見る](index.html)。

これは作品の世界観を伝える紹介用イラストです。実画面のスクリーンショット、観測値を正確に可視化した図、受賞・主催者公認を示す画像ではありません。

## 素材一覧

| 用途 | JPEG（軽量版） | PNG（原寸） | 寸法 |
|---|---|---|---|
| README 表紙 | [readme-cover.jpg](readme-cover.jpg) | [PNG](originals/readme-cover.png) | 1672 × 941 |
| 応募用・横長（修正版） | [contest-wide.jpg](contest-wide.jpg) | [PNG](originals/contest-wide.png) | 1672 × 941 |
| 応募用・正方形（修正版） | [contest-square.jpg](contest-square.jpg) | [PNG](originals/contest-square.png) | 1254 × 1254 |
| 71の地図展示 | [readme-map.jpg](readme-map.jpg) | [PNG](originals/readme-map.png) | 1672 × 941 |
| 物語をはじめる | [readme-story.jpg](readme-story.jpg) | [PNG](originals/readme-story.png) | 1672 × 941 |
| データを深く読む | [readme-analysis.jpg](readme-analysis.jpg) | [PNG](originals/readme-analysis.png) | 1672 × 941 |
| みんなのセンサー | [readme-sensor.jpg](readme-sensor.jpg) | [PNG](originals/readme-sensor.png) | 1672 × 941 |
| 登場人物の記録 | [readme-character.jpg](readme-character.jpg) | [PNG](originals/readme-character.png) | 1672 × 941 |
| 音楽と星座 | [readme-sound.jpg](readme-sound.jpg) | [PNG](originals/readme-sound.png) | 1672 × 941 |

応募用は横長版を第一候補とし、正方形が指定された場合は正方形版を使えます。横長は約16:9で、厳密な1920 × 1080ではありません。応募フォームの指定サイズ・容量は未確認のため、送信前に合わせてください。JPEGは全て1 MB未満です。正確なバイト数は[manifest.json](manifest.json)に記録しています。

## 制作・書き出し

- 生成モード: OpenAIの組み込み画像生成（imagegen）。本作品の既存キャラクター・キービジュアル等を参照して制作。
- 配色・文字: 紺・青緑・アイボリーを基調に、日本語の明朝体風見出しと作品名を統一。
- 参照したリポジトリ内画像と、実行した生成・修正プロンプトは[prompts.json](prompts.json)に全9種類分を保存。
- 応募用横長: みずのお腹から手が出て見える描写を修正し、片腕を地球の奥に隠したv2を採用。
- 応募用正方形: あめの手首・指を自然に頬を支える形に整え、もう一方の手を地球の奥に隠したv2を採用。
- 分析: あめの手と虫眼鏡が重なって余分な腕に見える箇所を修正したv2を採用。
- 原寸PNG: 採用した生成出力をバイト単位でそのまま複製。生成元ファイル名はプロンプト記録に残しています。
- JPEG: sharpで品質85、4:4:4、mozjpeg形式に変換。リサイズ・トリミング・文字の描き直しは行っていません。
- [manifest.json](manifest.json)に寸法、容量、PNG/JPEG/参照画像のSHA-256を保存。採用前の生成ファイルは生成先に残し、応募用素材とは区別しています。

参照素材の条件は既存の[メディア権利台帳](../../MEDIA_RIGHTS_LEDGER.md)と[LICENSE.md](../../../LICENSE.md)を参照してください。この制作記録は新しいオープンライセンスを付与するものではありません。既存の自動台帳はassets配下を対象とするため、docs配下のこの9枚の由来と参照画像ハッシュは上記の専用記録で管理します。

## 確認範囲

採用画像の日本語・英語見出し、人物の手・腕、端の文字切れを目視確認。原寸PNGと生成出力のハッシュ一致、JPEGの寸法維持を確認しています。ブラウザ表示とリンク検査の記録は[CHECKS.md](CHECKS.md)を参照してください。

画像と文書のローカル追加であり、GitHubへのpush、公開サイトへの配信、応募フォームへのアップロードはしていません。

## 応募時の注意

[公式応募規約](https://progedu.github.io/webappcontest/2026/summer/index.html)はGitHubリポジトリのPublic公開を求めています（2026-09-13確認）。リポジトリがPrivateの場合は、提出前に所有者の判断が必要です。この作業では公開設定を変更していません。
