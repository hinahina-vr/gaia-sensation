# 展示メニュー・前後移動の常設 — ローカル検証記録

## 依頼

ユーザー原文:「左下のUIの上に『展示メニュー』ボタンと『次の展示へ』『前の展示へ』ボタンが必要　次の展示ボタンは目立たせて、ドクンドクンしてる感じでアピールしまくって」「展示に入って、一つだけしかないと思われると悲しいため」

## 実装

- 左下の観測UIの上に「前の展示へ」「展示メニュー」「次の展示へ」を常設した。
- 「次の展示へ」は大きめの金色ボタン。2.8秒周期で二拍の膨張と光を繰り返す。動くのは背景面で、クリック領域は拡大縮小しない。
- 「展示メニュー」に「全71展示」を併記。既存の世界／日本の展示一覧から実際の展示を選択する。
- 下部パネル・地図クレジットの実寸に合わせて位置を調整する。連打中と展示タイトルの切替中は位置を固定し、別の演出に移っても同じ場所を続けて押せる。
- スマホも同じ3ボタンを使用。下段の重複する展示一覧・前後ボタンは非表示にし、「読み方・凡例」「操作」を残した。元の機能・内部ターゲットは削除していない。
- 展示メニューのポップアップは新しいボタン列より上に開く。Escapeや閉じる操作からメニューボタンへフォーカスを戻す。
- 手動の前後移動・メニュー操作ではクルージングを停止。既存の番号付きURL更新を維持した。
- OSの「動きを減らす」設定では鼓動を止め、金色の強調を残す。ホバー・フォーカス・ガイド表示中も鼓動を一時停止する。
- 入口ガイドの対象と説明を新しいメニューに合わせた。モバイルの旧メニューを非表示にしたことでガイドの準備待ちが終わらない経路も修正した。

## 主な変更ファイル

- `map-stable-navigation.js` / `map-stable-navigation.css`: 共通ナビゲーション、鼓動、配置追従、連打時の位置固定。
- `map-ui-grid-polish.js`: 既存展示一覧の開閉API、ポップアップ位置、フォーカス復帰。
- `map-mobile-shell.js`: 共通メニューからスマホの展示一覧を開く入口。
- `app.js`: 入口ガイドのターゲットと説明。
- `gaia-mode-loader.js` / `index.html`: 変更資産のキャッシュバージョン更新。
- `package.json` / 関連ブラウザテスト: 再実行入口と回帰テスト。

## 合格した検証

対象は `0034ee39cd906960c458d0cf84f6a48e719c39ab` に、未公開のクルージング・演出別URL・本変更を加えたローカル作業ツリー。

1. `node scripts/check-map-exhibit-navigation-browser.mjs`
   - 1440×900、390×844、320×568、844×390の全4画面で合格。
   - 鼓動の実時間サンプリング、拡大の発生、クリック領域の寸法維持、動きを減らす設定を確認。
   - 前後移動、URL追従、展示メニューで13を選択、メニューの再クリック開閉・Escape・フォーカス復帰、71↔01の循環を確認。
   - 01・02・08・12・17・21・31・69・70・71のボタン位置・表示領域・ネイティブなヒットテストを確認。
   - 証跡: `artifacts/map-exhibit-navigation/results.json`、同フォルダの各幅のスクリーンショットと `*-heartbeat.json`。
2. `scripts/check-map-stable-next-browser.mjs`
   - 1440×900、3840×2160、901×900で各71演出、計213件合格。
   - 表示中の次ボタンが1個であること、横あふれなし、ボタンが画面内にあり実際にクリック可能であることを確認。
   - 新仕様では待機中の高さが下部UIに追従するため、旧テストの全演出同一Y座標という条件を改めた。左揃え・遮蔽なしを全数確認し、連打中の座標不変は次の試験で別途厳密に確認する。
   - 証跡: `artifacts/map-exhibit-navigation/all-71/report.json`（passed、213件、エラー0）。
3. `scripts/check-map-stable-next-interactions-browser.mjs`
   - PC幅1440／タッチ幅390で、前後連打6系列ずつを実操作。21→33、33→20、69→03、05→08、14→17、63→67。
   - 同じ画面座標を65ms間隔でクリック／タップ。全12系列で記録中のX・Y変動は0、元のボタン要素とクリック可能領域を維持した。
   - PCのEnter／Space、メニュー、出典パネル、実データの統計表示・戻る、画面幅切替、地図を閉じる操作も合格。
   - 旧ボタンを隠したモバイルでも、通常の `?exhibit=21#world` の入口ガイドから正常に開始できることを確認した。
   - 証跡: `artifacts/map-exhibit-navigation/stable-interactions-final/report.json`（passed、14項目、エラー0）。
4. `npm run check`（precheck/check/postcheck）合格。ログ: `artifacts/map-exhibit-navigation/npm-check.log`。
5. 変更JSの構文、`git diff --check`、演出別URLとクルージングの単体回帰テスト合格。

ブラウザはWindowsのインストール済みChrome（headless）。モバイルは画面幅・タッチエミュレーションで、物理端末ではない。保存済み実データを使い外部HTTPSサービスは遮断。既存の全数／連打試験ではFIRMS保存データをAPI応答に使用し、本番CSPも適用した。本番・外部ライブサービス・配布物の検証ではない。公開・プッシュ・デプロイは行っていない。

## 最終ソース SHA-256

```text
map-stable-navigation.js   76f88d7227df9dbe5e0ba7e1f4145b63a702a21819e61c205d318cc9c14c25b3
map-stable-navigation.css  c5b254f0342dac26edab58966f8fb090c25c9b83dbb68a7f676c110c1b0e92e6
map-ui-grid-polish.js      75f9eb061dcb4e533f8fa1ff297f233a11692931718d089623db985063fb004a
map-mobile-shell.js        6440a5ae3df16d83d366ab80cf06d1979adbd8d0e5b55b4654fd4cfa10b83f31
app.js                     2ae76e67f6c424891f46f2efbaea68876441f9350852237ee31572ecc872e348
gaia-mode-loader.js        edd51319e162cc5faaf9351771da0d7b1cf72b614de8dbc4ea33338137796fa8
index.html                 aff2aed2f892e9ee4b684d5e1ac3bb7ff50db0b56e17bee9ab8bfd46ee2322cd
package.json               34eec2d1e5f279ee420a378174b753dee9907bdfa82873e47cbbf3a5c10afddc
```
