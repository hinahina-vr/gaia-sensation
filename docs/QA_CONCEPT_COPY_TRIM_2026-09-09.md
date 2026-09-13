# QA — concept-16：支給文の反映・指定ブロック削除

## 対象

2026-09-09の連続指示をまとめて反映。ローカル作業のみ。push・deploy・本番公開は行っていない。

- 冒頭の「地球と生命の共進化」「リベラルアーツ」「学生の共同制作」の3項目を削除。
- 作品概要と3つの体験を、支給された文章に差し替え。段落・強調を維持し、貼り付け由来の末尾空白エンティティは表示しない。
- 体験の説明6文は、PCでは画像・見出しの下の全幅行に配置。縮小・省略・横スクロールでは対応しない。狭い画面では自然に折り返す。
- 「最初の作品が、『惑星の放課後』。」と付随するイラスト、および「第01世界 / CONCEPT MODEL」「世界は、まだ物語ではない。」を含む締めのブロックを削除。
- 構成要素の英語副題5つ（Personal Akashic Records / Deep Agent / Simulacrum Agent / God Agent / Oracle Insight）を削除。日本語の6見出し・説明・神託の3条件・構想図本体は維持。
- 削除はページの掲載要素が対象。画像ファイルは削除していない。変更前のHTML/CSS/JSを `artifacts/concept-copy-trim-2026-09-09/before/` に保存。

## 実施済みの検証

- `node scripts/check-concept-copy-trim-browser.mjs --before`：1440×900、390×844で変更前を実際に描画。削除対象の表示と、PCの説明文折り返しを再現。
- `node scripts/check-concept-copy-trim-browser.mjs`：1440×900、1280×900、1024×900、768×1024、390×844、320×568の6条件で合格。
- PC 1024/1280/1440px：説明6文すべて描画上の行数1、本文14px以上、切り取りなし。モバイル・タブレットは自然な折り返し、横方向のはみ出しなし。
- 支給された概要3段落・体験6文・体験見出しの文字列一致、強調の維持、削除対象のDOM不在、未指定の学び・境界・深層・神話素材・フッターの維持を確認。
- 構想図の読込み・拡大・Esc・フォーカス復帰、フッターの先頭リンク、画像デコード、CSP違反なし、保存領域未使用を確認。
- `npm run check:concept`：合格。
- `node scripts/check-concept-page-browser.mjs http://127.0.0.1:4447 artifacts/concept-page-v16`：合格（7チェック）。1440/390/320/768/3840px、JavaScript無効表示等。既存の導線・図のビューア・キーボード操作・印刷内容・画像の実サイズ・文字サイズとコントラストを確認。
- 実際に保存されたPC/スマホの概要・3体験・構成要素・フッター画像を目視確認。

## 記録

- 焦点を絞った試験：`artifacts/concept-copy-trim-2026-09-09/after/report.json`
- ページ全体の回帰試験：`artifacts/concept-page-v16/report.json`
- 再実行：`npm run check:concept-copy-trim:browser`
- 今回は静的な紹介ページの変更であり、実ゲームの新機能追加や配布ZIP作成はない。

## 検証範囲の制限

WindowsにインストールされたChromeでのローカル描画とビューポートエミュレーション。物理スマートフォン、実プリンターへの出力、本番配信、外部大学サイトの再検証は対象外。画像5案は別途作成した比較用成果物であり、現在の構想図には採用・差し替えしていない。

## 検証対象 SHA-256

- `concept/index.html`: `fd2201005626b8e175babf7aae215354e84d818a4a433843dffdd2401d4ba506`
- `concept/concept.css`: `7dc9318dfe1e46cc4bf629f76c44dfb20c4ff400fe413446d4db554b5c35a2e5`
- `concept/concept.js`: `4696cfa83134cef43cce1dcf47feb3eec05aeb00316d0927aae1bbc9c9eac78a`
