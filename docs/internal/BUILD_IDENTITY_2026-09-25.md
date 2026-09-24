# ビルド識別と表示

## 方針・表示場所

- 通常の版識別はコミットSHA。`package.json`の`1.0.0`は変更せず、毎回の手動採番・タグ作成は行わない。
- タイトル画面の「このサイトについて」→コンセプトページの最下部、免責文の後に小さく2行表示する。
  - `Build: <短縮SHA>`（変更がある場合は「未コミット変更あり」）
  - `SHA: <完全な40桁のSHA>`（選択・コピー可能。狭い画面では必要に応じて折り返す）
- 地図・物語・タイトル画面への常設表示は追加しない。既存の本文や操作部品の配置は変えない。

## 生成・配信手順

1. 配信対象のチェックアウトで既存の `npm run build:release` を実行する。既存の権利・検証ゲートとWorker生成を維持し、最後に `npm run build:info` が `build-info.json` を生成する。
2. 版情報だけをローカル確認する場合は `npm run build:info`。これは公開操作ではない。
3. 生成されたJSONを**同じチェックアウトの成果物と一緒に**配信する。生成後に編集・コミット・チェックアウトを変更した場合は再生成・再検証する。別のチェックアウトや最新版ブランチのSHAを転記しない。
4. JSONは生成物としてGit対象外。直接アップロード、`git archive`での展開、別のビルドコマンドでは自動的に含まれないため、配信する最終成果物に正しいJSONが含まれることを確認する。Gitのない展開先では元のビルドで生成済みのJSONも引き継ぐ。
5. Pagesの既存ビルドコマンドが `build:release` 以外なら、次回公開作業時に生成処理を組み込む。今回、外部のビルド設定や公開状態は変更・確認していない。

実際のローカルHEADを優先し、`CF_PAGES_COMMIT_SHA`がある場合は一致を確認する。不一致・不正値は生成を失敗させる。Gitがない環境ではPagesのSHAを利用できるが、変更状態は「未確認」とし、クリーンな版とは表示しない。GitもPagesのSHAもない場合は生成を失敗させ、固定値では代用しない。

Cloudflareの環境変数は[公式ビルド設定](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)を確認。Cloudflareスキルに従い、配信方式は維持し、生成とキャッシュ設定だけを追加した。

`build-info.json`には`Cache-Control: no-store`を設定し、ブラウザ側も`cache: no-store`で取得する。取得失敗・不正なJSON・未生成の場合は「未取得」。古いSHAを保存・再利用しない。これは取得時点の配信ビルドの識別であり、既に開いている別タブのJS、外部データ、CDNやブラウザの全資産が同一版であることの証明ではない。既存JS/CSSのキャッシュ更新は別途必要。

## ローカル確認

- `node scripts/serve-novel-preview.mjs <port>`ではリクエストごとにHEADと変更状態を読み、生成済みJSONが古くてもローカル状態を表示する。
- 比較用のベースラインを重ねている場合は、現在のHEADとして表示しない。
- `GAIA_PREVIEW_BUILD_INFO=static`では生成済みJSONを通常の静的ファイルとして配信できる（成果物検証用）。
- `npm run check:build-info`：クリーン／未コミット／ステージ済み／未追跡／新コミット／Gitなし／CI値不一致など8試験。
- `npm run check:build-info:browser`：Chromeで1440・390・320px、完全SHA・変更状態・多言語・収まり・既存要素の位置・ページ先頭リンク・図の開閉・CSP・欠損／不正メタデータ・静的生成物のHTTP配信を確認する。

## 2026-09-25 検証記録

- 対象：`01fab3746df3360787fe860c7ca0d3e2a30efa5e` ＋ 今回の未コミット変更。既存の他の未コミット変更は保持。
- 合格：上記8試験、Chromeブラウザ試験、`npm run check:concept`、`npm run check:security-policy`、変更JSの構文チェック、`git diff --check`。
- ChromeのPC・スマホ幅のフッター画像も目視確認。証跡・対象ファイルのSHA-256は `artifacts/build-info-2026-09-25/report.json`、`footer-1440.png`、`footer-390.png`、`footer-320.png`（ローカル生成物）。
- 実機スマホ・Cloudflare本番配信・外部ビルド設定・全リリース工程は未確認。ブラウザ試験のCSPはローカルで本番と同じポリシーを適用したもの。本番確認ではない。
- コミット・プッシュ・デプロイは行っていない。
