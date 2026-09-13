# MAP 07–10・12：国・地域の収録範囲

2026-09-07のローカル更新。展示用の31か国・地点リストから国別統計を切り離し、公式資料の収録範囲へ拡張した。

| 展示 | 変更前 | 変更後 | データの意味 |
| --- | --- | --- | --- |
| 07 海は、どこへ運ぶ | 31地点の風 | 237の国・地域の参照地点 | NASA POWERの2001–2020年気候平年値。海流79点・移動距離計算は変更しない |
| 08 森と水のつながり | 31地点の雨 | 237の国・地域の参照地点 | NASA POWERの同期間の平均降水量。国全体の平均ではない |
| 09 捨てた先の未来 | 公表17＋近隣国による推定14 | 公表値91国・地域 | UN SDG `EN_MWT_RCYR` の国・地域別最新非欠測値 |
| 10 街の明かりと炭素 | 31か国、2,432年次値 | 213国・地域、15,438年次値 | GCB2024v17の1945–2023年の化石燃料・セメント等由来CO₂ |
| 12 街と森、そのあいだ | 31か国 | 両指標のある214国・地域 | World Bankの森林面積率と都市人口率の最新非欠測値 |

## 出典と追加方法

- [NASA POWER Climatology API](https://power.larc.nasa.gov/docs/services/api/temporal/climatology/): 既存31地点の参照座標を維持。追加分にはNatural Earthの地図ラベル座標等を使用し、風速・風向・降水量を各地点で取得。APIの`header.range`、`fill_value`を確認する。複数の国・地域が同じ気候格子に入る場合もある。日射・風が補足資料である13の31地点は変更しない。
- [GCB2024v17](https://zenodo.org/records/13981696): 同じ既存版の`Total`列を使い、別年・別版の値を混ぜない。国際航空・海運・世界合計・旧国家は現在の国へ再配分しない。南極および地図座標を照合できない小地域は対象外。夜間光は2016年のまま。
- [UN SDG Series API](https://unstats.un.org/SDGAPI/v1/sdg/Series/Data?seriesCode=EN_MWT_RCYR): 全ページを読み、系列・単位・国地域コードを照合。公表された推計を含むため、SOURCEは「国連公表値」であって全て実測という意味ではない。Nature・Observation Status・Reporting Type・footnotesを保持する。
- [森林面積率](https://data.worldbank.org/indicator/AG.LND.FRST.ZS)・[都市人口率](https://data.worldbank.org/indicator/SP.URB.TOTL.IN.ZS): World Bankの国一覧から世界・地域合計を除外し、各国の最新非欠測値を取得。両方ある国だけを比較する。基準年・分母・都市定義は一致せず、相関は因果ではない。

## 欠測・例外

- 未収録を0、近隣国の値、線形補間で埋めない。09の従来の5近傍補完を廃止し、別の統計ビルドでも再適用しない。
- 09のマレーシア最新値はAPI上で2020年177.65764%。0〜100%の構成比の円に表せないため表示対象外。100%へ丸めず、古い年へ黙って置き換えず、`countryCoverage.excludedSourceValues`に値・注記・理由を保持する。
- 10の国数は年により異なる。1955年の元資料にない値は2023年の値で埋めない。
- コソボはGCB `KSV`、World Bank `XKX`、Natural Earth `KOS`を明示的に照合。森林率が欠測なので12のペアには加えない。
- Channel Islands（CHI）は複数地域をまとめたWorld Bank経済単位。ジャージーの国土へそのまま割り当てず、風・雨ではジャージー／ガーンジーと重複させない。
- Natural Earthの`ISO_A3_EH`は付属地域に本国コードを割り当てる場合がある。正規の国コードと一致する地理形状を優先し、オーストラリアをアシュモア・カルティエ諸島で上書きしない。

## 再生成と検証

`npm run data:country-coverage`は5展示だけを更新する。`scripts/build-gaia-data.mjs`のフル生成経路も同じ拡張を適用し、取得に失敗したら31か国版へ縮退せず終了する。

取得応答は無視対象の`artifacts/country-coverage-source-YYYY-MM-DD/`へURL・取得時刻付きで保存。同日の再実行はキャッシュを再利用する。データは全件取得・形式・最低件数の確認を終えてから書き込む。

`npm run check:country-coverage`で件数、座標、コード照合、年次欠測、真の0、出典区分、再補完の防止を検証する。スクリプトに取得キャッシュのパスを渡すと、全数値を元応答と突き合わせ、未対象展示がHEAD版と同一であることも確認する。`npm run check:country-coverage:browser`でPC・スマホの5展示、追加国の選択、CO₂履歴、214点の散布図、横はみ出しを確認する。
