# 再資源化率の収録拡張 — 2026-09-08

## 結果と対象版

ローカル実装完了。91 → 145の国・地域（国連91を保持、世界銀行54を追加）。ごみ排出量への切り替えは追加していない。commit・push・deploy・ZIP配布は行っていない。

- 基準コミット: `b236255db4dc60f748aecfe4327d45d39f8ad33b`。既存の画面調整等の未コミット変更は保持。
- データSHA-256: `966602fbe7d7ea737ebd9ac01f9eb302196aca2071e99f25d297d4097a5414fe`
- 新runtime: `data/runtime/nothing-is-waste.85ede5375885281b.json`。旧生成チャンク `nothing-is-waste.f5f069c7cc577c24.json` を置換。旧版はgitから復元可能で、チャンクは元データから再生成できる。
- 最終ブラウザー試験のコード／データSHA-256: `artifacts/recycling-expansion/verified/report.json`。

## 出典・採用基準

[World Bank What a Waste 3.0 国別データ・コードブック](https://datacatalog.worldbank.org/search/dataset/0039597/what-a-waste-global-database)の2026年3月版を使用。取得日2026-09-08、ライセンスCC BY 4.0。引用情報、元資料URL、資料注記、Excelセル位置、コードブック行番号、取得日を保存。

- 原本: `artifacts/recycling-expansion/source/what-a-waste-3-country.xlsx`
- 原本SHA-256: `42ec5fb213bbf79b9f6d860c24da3d19fc7f7e0ed274fdea9d73791e356172ee`
- 百分率セルの数値130件／欠測87地域。元の小数を100倍して%へ単位変換し、保存値は丸めない。
- 元Excelとコードブックを読み取り専用で抽出し、130件すべての値・年・出典・注記を再照合。欠測を0に置き換えない。
- 130件中75件は既存国連値を優先。差分55件のうちFJIはNadi Town・Lautoka Cityの2都市限定のため全国値としては採用せず、54件を追加。先に提示した146は候補数で、採用後は145。
- CHN・INDは今回の国別率が欠測のため追加しない。旧What a Waste 2.0 CSVにも追加候補16地域があるが、指標固有の年・定義を検証できていないため採用しない。資料公開年を観測年として代入していない。
- MYSは国連の177.65764%を引き続き除外し、別出典の世界銀行0.123192419620067%（2022年）を追加。元の除外記録は保持。
- 国連の既存91件は値・年・位置・ID・注記を含め全フィールド不変。他の9モードのデータも不変。
- 145地域の年の範囲は2000–2024。世界銀行の年は測定年不明の場合、出典の公表年等を含む。
- 国土を塗れるのは144地域。合算地域のチャネル諸島には独立ポリゴンを割り当てず、代表点・スライダーから参照できる。Kosovoは既存のXKX→KOS対応を使用。

国連の都市ごみ再資源化率と、世界銀行の再資源化向け回収率は同一定義ではない。資料側の推計、年度・対象ごみ・分母の違いがあるため、世界平均や厳密な国別順位と読まない旨を地図説明・詳細・分析結果に表示。ARMのプラスチック限定、MARの都市部限定などの注記も保持・表示する。

## 実装範囲

- `scripts/extract-worldbank-recycling.py`、`data/worldbank-waste-recycling-source.json`: 元資料の再現可能な抽出。
- `scripts/recycling-coverage-data.mjs`、`scripts/build-recycling-coverage.mjs`: 国連を上書きしない、冪等な補足ビルダー。既存の国別／全体ビルダーにも接続。
- `data/gaia-signals.json`、runtime manifest／チャンク、`docs/THIRD_PARTY_INVENTORY.json`: 配信データと出典台帳の更新。
- `src/data/recycling-provenance.js`、`app.js`、`app-content.js`: 選択国の出典・資料年・定義・対象範囲、説明、読み上げ文、capture API。
- `statistics-datasets.js`、`statistics-lab.js`、`statistics-game.css`: 145件をそのまま分析。出典別検索、比較の注意、資料年・対象範囲を示すレコード表。小画面では注記を横幅いっぱいの行に表示。
- ローダー／HTMLのキャッシュ識別子、説明文のfixtureと回帰試験を更新。

## 合格した検証

1. 原本再抽出: `scripts/extract-worldbank-recycling.py ... --check`。130件・87欠測と原本ハッシュ一致。
2. `npm run check:recycling`: 91件不変、54件の全値／年／元資料／注記、重複・範囲外・欠測・年欠落の拒否、FJI除外、実0%、MYS別出典、再実行不変、統計値一致。
3. `node scripts/check-country-coverage.mjs`: 既存の風・雨・CO₂・森林／都市化率のカバレッジ、0と欠測、再補間防止。
4. runtimeの生成・復元・`--check`: 元データと損失なしで一致。
5. `check-recycling-country-fill-browser.mjs`: 1440×900、390×844、3840×2088で145地域／144塗り分け、追加国選択、0%と未収録、ブラジル国土クリック、国連出典、MAP 13の既存塗り分け。証跡: `artifacts/recycling-expansion/country-fill/`。
6. `check-recycling-expansion-browser.mjs`: 最終コードで1440×900、390×844、320×844に合格。ロシアの国土クリック→世界銀行の出典リンク、8地域の選択・capture API、出典パネル、145件すべての統計入力値、国連91／世界銀行54での検索、個別注記、比較の注意の可視表示、実際の分析ビュー保存→ページ再読み込み→検索条件復元、画面幅・注記列幅・行高を確認。証跡: `artifacts/recycling-expansion/verified/`。ページ例外0件。
7. `check-statistics-game-browser.mjs`: 1440×900、390×844で既存の地震解析、グラフ／詳細、ポインター・キーボード、解析メニュー、キーなしAI画面の開閉、保存条件の復元が合格。実AI通信はしていない。証跡: `artifacts/recycling-expansion/statistics-regression/`。
8. 統計データアダプター・25手法のinsight／discovery・公開ゲートの21 fixture試験・対象形式の秘密情報検査、JavaScript構文、`git diff --check`に合格。

元症状（ロシア・インドネシアがない91件）は基準コミットのデータで再現し、同じ国コードの追加後選択をブラウザーで確認。最初の小画面表では長い出典が細い列になったため、実画像を確認して修正し、列幅・行高の回帰検査を追加。最終のロシア詳細、スマホ表、比較注意、PC表のPNGを目視確認した。

現行UIではファイル書き出しと観測ノート保存は無効。これらの実操作を確認済みとはしていない。使用中の保存機能である分析ビューを実操作で検証し、map capture APIはデータ契約として別に確認した。

## 全体チェックと未確認範囲

`npm run check`は通常の本体検査、今回の再資源化回帰、統計・runtime・セキュリティ設定・GBIF・出典台帳まで合格した後、公開審査のscope照合で停止した。ログ: `artifacts/recycling-expansion/npm-check-final.log`。全体コマンドを成功扱いにしない。

- 既存承認scope: `815177c138e583d4a92155178cb6035a6efd836755d5e5c120c80ac77f976654`
- データ追加後scope: `ccc12a0d1fbbc28e1349d8b0a6331704f030fe4b48dd0cf2e09a414748440908`
- 審査は全収録データ／台帳の一括ハッシュに結び付いているため、最初の`gosat`行で不一致になる。GOSATデータ自体の変更ではない。
- `docs/rights-review.json`や所有者の承認記録は更新していない。ローカル実装は可能だが、公開する場合は追加資料を含む対象範囲の確認と今回版への明示的な公開指示が必要。

検証はローカルChromeのデスクトップ／タッチ画面エミュレーション。今回の公開資料は実ファイルを使い、無関係のNOAAオーロラ通信だけ保存fixtureに分離。実スマートフォン、Safari、実AI、センサー機器、Cloudflare公開先、配布ZIPは未確認・未実施。
