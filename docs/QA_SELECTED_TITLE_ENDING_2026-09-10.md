# 指定タイトル画像・エンディング画像の採用

## 依頼と対象

ユーザー原文: 「タイトル画像はこれに変更」`assets/title-candidates-20260909/01-starlit-observatory.png`、「エンディングはこれ」`assets/ending-candidates-20260909/01-turning-in-the-sunset.png`。

指定された候補01をメインタイトルと本編エンディングに採用。新しい絵の生成や描き換えは行っていない。対象はHEAD `cdc82c8ffd4fee607bd2d838ec3157b7095952d3`上の未公開ローカル作業ツリーで、先行する未コミット変更を保持している。

## 反映範囲

- `opening.css`: 通常・軽量設定のタイトル背景を指定画像に変更。横長PCでは上端基準、縦向きスマホでは既存の上部全幅表示を使用。高さ350px以下の横向き画面ではロゴを小さくして上端の欠けを防ぐ。
- `novel-background-cues.js`・`novel-mode.css`: 帰り道から最後の会話までの3つの背景キューを統一し、スタッフロールにも引き継ぐ。縦画面では二人の顔を残す表示位置と下部フェード、短い横画面では顔の下に収まる会話欄を適用。
- `character-mode.js`・`sound-mode.js`: 人物資料のエンディングCGと、エンディング曲のジャケットも同じ絵に統一。既存の解放ID・保存形式は変更していない。
- `index.html`・`gaia-mode-loader.js`: 関係するCSS・JSの読込キャッシュキーを更新。
- 候補フォルダのREADME・メディア権利台帳に採用と変換手順を追記。旧画像と候補PNGは削除せず保持。
- `scripts/check-selected-title-ending-browser.mjs`、`scripts/check-selected-ending-sound-browser.mjs`を追加し、既存のタイトル・CG試験の画像期待値を更新。`package.json`に`check:selected-art:browser`を追加。

### 配信用画像

元PNGは無変更。`scripts/encode-selected-title-ending.mjs`で同寸法1672×941のWebP（quality 92）を作成した。リサイズ・画像への文字追加・切抜き・再描画はなく、ブラウザーの表示枠だけを調整している。WebPは非可逆圧縮であり、PNGと画素単位で同一という意味ではない。

| 用途 | 元PNG | 配信用WebP |
| --- | ---: | ---: |
| タイトル | 2,586,954 bytes | 421,302 bytes |
| エンディング | 2,502,680 bytes | 402,344 bytes |

約84%の容量削減。ファイル名は元PNGと同じで拡張子のみ`.webp`。原本・WebPのSHA-256、寸法、変換前後のバイト数は`artifacts/selected-title-ending-2026-09-10/conversion.json`に記録。

## 最終版の検証

インストール済みChromeで実際のローカル画像を表示し、本番CSPを適用した。外部APIを遮断し、独立したブラウザー保存領域で検証。判定対象の実装7ファイルとWebP2枚のSHA-256は`artifacts/selected-title-ending-2026-09-10/after/report.json`に記録。

| 試験 | 結果と範囲 |
| --- | --- |
| PC・スマホ表示 | 1440×900、3840×2160、2560×1080、390×844、320×568、844×390、568×320の7条件。画像の実デコード、指定画像の適用、横はみ出しなし、ロゴ全体の画面内配置、メニューボタンの有効な44px以上の当たり判定を確認 |
| 入口から本編 | 1440・390でタイトルの「物語を始める」→白いプロローグ→「本編へ」→`festival_concept_001`まで実操作 |
| 保存・読込 | 全7条件でエンディングの`welcome_chat_new_025`に入り、画面のSAVE・LOADからスロット0を保存・再読込。指定画像が維持されることを確認 |
| 終了からタイトル帰還 | 全7条件で最後の実会話を進める→スタッフロール→スキップ→データ入口→「タイトル」。スタッフロール・戻ったタイトルで新画像が表示されることを確認 |
| ギャラリー | 全7条件で実際の人物資料画面からエンディングCGを開き、表示・デコードを確認。本編内の旧CGボタンは既存実装で撤去済みのため、旧ギャラリーについては登録情報の一致だけを検査 |
| サウンド鑑賞 | 1440・390でエンディング曲を画面から選択し、新ジャケットの実表示を確認。スマホはジャケットまでスクロールして撮影 |
| タイトル読込遅延 | 新しいタイトルWebPのHTTP応答を1800ms遅らせ、`/#top`直入りと繰り返し帰還の2回を検査。不透明な待機、フェード、同一ページ内の復帰が維持される |
| HTTP配信と保存 | ローカルHTTPからPNG2枚・WebP2枚を実取得して保存し、作業ツリーの各元ファイルとバイト単位で一致 |
| 静的検査 | 背景キュー整合性（台本v13・6シーン・380ステップ・38キュー）、メディア権利台帳（319素材・6ソース）、9モード・15カタログ、遅延読込順・重複排除、変更JS/MJS構文、`git diff --check`を確認 |

主担当がPC・縦横スマホの実スクリーンショットで、指定された二人の絵、タイトルのロゴと操作部、エンディングの顔と会話欄、スタッフロール、人物資料のCG、サウンドジャケットを確認。4Kの確認用WebPは撮影PNGの形式変換のみで、撮影内容は変更していない。

短い横画面で見つかった会話欄と顔の重なりは、エンディングの3キューに限定して高さを調整した。568×320ではタイトルロゴの矩形上端が約-18pxとなる状態も確認し、高さ350px以下の横向きだけロゴを縮小。ロゴ全体が画面内に収まることを回帰検査に追加した。修正後の7条件の正本は`after/report.json`。`preview/`や`failure.png`は途中の試行記録で、最終合否には使用しない。

```powershell
node scripts/check-selected-title-ending-browser.mjs
node scripts/check-selected-ending-sound-browser.mjs
node scripts/check-title-return-transition-browser.mjs --only=1440-slow-art --output=artifacts/selected-title-ending-2026-09-10/title-return-slow
node scripts/check-novel-background-cues.mjs
node scripts/build-media-rights-ledger.mjs --check
node scripts/check-app-content.mjs
node scripts/check-mode-loader-prefetch.mjs
git -c core.safecrlf=false diff --check
```

## 確認の境界・残件

今回の指定画像差し替えはローカル実装・検証まで。push・デプロイ・本番スモークは未実施で、本番未公開。ZIP等の配布物は作成していない。

画面サイズ・タッチ操作はChromeでのエミュレーションで、実機スマホ・他ブラウザーの確認ではない。エンディング開始位置とサウンドの視聴済み履歴は試験用に保存領域へ設定している。全編を最初から通読して解放した試験や、実スピーカーでの試聴ではない。セーブ画面の実操作と、試験用開始位置の設定を区別する。

画像のHTTP保存は確認したが、CSV・センサー設定等の無関係な書き出し機能は変更も再試験もしていない。先行する地図見出し、下線撤去、タイトル帰還演出等は保持し、今回は画像変更に関連する帰還と入口を再検証した。今回の画像差し替えに実装待ち・検証待ちの残件はない。
