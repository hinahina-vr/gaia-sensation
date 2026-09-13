# 演出別URL — ローカル実装・検証記録

## 依頼と実装

ユーザー原文:「演出別にURLリンク貼れるようにしたい / 08の演出であれば #world-08 みたいな / で、直撃で開けるようにしたい」

- 01〜71を `#world-01`〜`#world-71` で直接表示。世界・日本とも公開展示番号を使用する。
- 番号付きリンクはオープニングと自動の入口ガイドを省略する。展示自体のタイトル演出と「地図ガイド」ボタンは維持する。
- 演出変更後のアドレスも更新し、そのままコピーして共有できる。自動切替のたびに履歴を増やさないよう `replaceState` を使用する。
- 新しい番号付きハッシュを受け取った場合は、実際の展示ボタン経由で選択し直す。クルージング中なら停止する。
- `?exhibit=08#world`、`#earth`、`#japan`、`#data` を維持。番号付きハッシュは `?exhibit=` より優先する。
- `#world-8` は `#world-08` に正規化。範囲外の数値リンクは通常の地図へフォールバックし、新規起動時は01になる。

## 変更箇所

- `map-exhibit-route.js`: 起動前にも利用できる共通の番号解析・URL判定。
- `index.html` / `gaia-mode-loader.js` / `src/exploration/index.js`: 共通処理の読み込み、遅延ロード、変更した資産のバージョン更新。
- `opening.js`: 番号付きURLの直接起動と、オープニング表示中の同一ページ内URL移動。
- `app.js`: 初期選択、同一ページ内移動、番号付き入口でのガイド省略。
- `map-exhibit-categories.js`: 全プロバイダー共通のURL更新、遅延読み込み中・受信直後のハッシュの保護。
- `src/exploration/marine-cod-exhibit.js`: 年次展示の番号付きURLからの先行データ読込。
- `package.json` / `scripts/check-map-exhibit-link*.mjs`: 再実行できる単体・ブラウザ回帰テスト。

## 検証結果

対象: `0034ee39cd906960c458d0cf84f6a48e719c39ab` にローカルのクルージング実装と本変更を加えた作業ツリー。公開操作なし。

- `npm run check:map-exhibit-links`: 全71番号、別名、正規化、不正値の単体テスト合格。
- `node scripts/check-map-exhibit-links-browser.mjs`: PC 1440×900 / モバイル幅390×900、それぞれ19項目の結果を保存。全38項目合格。
  - 01・02・08・15・21・31・70・71を、それぞれ新しいドキュメントとして直接起動。画面・データ準備・ガイド不表示を確認し、スクリーンショット保存。
  - PCで全71演出の同一ページ内リンク切替。モバイル幅で12・17・33・69・70・71・08を切替。
  - 再読込、クエリとの優先順位、クエリ保持、ブラウザの戻る／進む、UI切替時のURL更新・履歴数維持。
  - クルージング71→01のURL追従、クルージング中のリンク受信による停止。
  - 従来の入口ガイド、範囲外番号、データパネルの `#data` 保持、`#top` からの再入場。
- `node scripts/check-map-exhibit-link-entry-browser.mjs`: 両画面幅で合格。
  - オープニングの音声選択画面からハッシュだけを変え、08が実際に見えることを確認。
  - 描画フレーム上で08↔13を12回ずつ切替。古い番号への巻き戻りなし。
- 両ブラウザ試験の `pageerror` は0件。
- `node scripts/check-map-cruise.mjs`: 71演出ループ、終点3秒、POI5秒×5、読込・非表示一時停止の回帰テスト合格。
- 最終の `npm run check`: precheck / check / postcheck、既存データ・ストーリー・統計・セキュリティのチェック合格。ログは `artifacts/map-exhibit-links/npm-check.log`。
- 変更JSの構文チェック、`git diff --check` 合格。

検証中、描画フレームが `hashchange` より先に走り、08→13の要求を08に戻す不具合を再現した。受理済みハッシュとの一致を確認してからURL同期するよう修正し、同じ操作とフレーム境界の連続操作で合格した。

オープニング表示中の同一ページ内リンクで音声選択画面が残る問題も実ブラウザで再現。既存の入口終了処理を共有し、同じ操作でオーバーレイが消えて08が表示されることを確認した。

## 証跡と未確認範囲

`artifacts/map-exhibit-links/results.json`、同フォルダのPC・モバイル幅スクリーンショット、`artifacts/map-exhibit-link-entry/results.json` と同フォルダのスクリーンショット。

Windowsのインストール済みChromeをheadlessで使用。モバイルはビューポート検証であり実機試験ではない。ローカルの保存済み実データを使用し、外部HTTPSサービスは遮断した。クルージングのURL追従試験だけはクルージング用の時計を加速し、既存の描画・データ処理はそのまま動かした。

最終のオープニング受信経路の追加後は、当該入口とフレーム境界のブラウザ回帰テスト、および `npm run check` を再実行した。全71演出の新規ドキュメント起動、実機、外部ライブデータ、本番配信は未検証。新規ドキュメント起動は上記8演出、全71は同一ページ内の選択として検証した。

## 最終対象ファイルのSHA-256

```text
map-exhibit-route.js                     8bf09c35dcac0dd83888a7bc5070fff6d1328c3c047b360d393d942c7acdbc29
index.html                               07ed2b0779860e8cd9dce5d9475b574087649c52a4551b65a5b6abe9621bfaf8
opening.js                               4b25cdabdbb1e20d159500fc5c74f94b10d3ae786da120418f4a2ae503e63741
gaia-mode-loader.js                      156629287b7ca90ac36940584a93e16ff7c899a57a909486907d5171a33e55ba
app.js                                   e2ab3c0997b34a085cc373b0dc6f34eadfe9cf3b5a814e1b13da849c9f74bc46
map-exhibit-categories.js                 ade6b0cc314e1f1bac6f1c1b49fb09b8d7d2cf17cb991f34fa1587a74363f397
src/exploration/index.js                 0e353e062b46651362defbd130ce4d0cb82811395d5e15b256d767b2b6a066fd
src/exploration/marine-cod-exhibit.js     a89b7733f8b25135c4e235dfe6e54a687db29b7053a364fbb63cde5501501b79
package.json                             38e4e40eb87d5b24dc2c0f798e7b78ca9b413125ed83b7fc702119d780ac193c
```
