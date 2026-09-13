# STORY気温偏差デモ：収録データと加工

対象は `map_mode01_023` の体験デモ。既存のCO₂展示とGISTEMP全球平均系列は変更しない。台本の気温偏差の説明に対して、CO₂格子を気温のように見せたり、全球平均から架空の地域差を作ることを避けるため、同じNASA GISS/GISTEMPの地域別版を収録した。

## 提供元と取得

- [NASA GISS / GISTEMP v4](https://data.giss.nasa.gov/gistemp/)
- [公式データ一覧](https://data.giss.nasa.gov/gistemp/data_v4.html)
- [NetCDF原本](https://data.giss.nasa.gov/pub/gistemp/gistemp1200_GHCNv4_ERSSTv5.nc.gz)：GISTEMP v4 Land-Ocean Temperature Index, ERSSTv5, 1200 km smoothing。
- 原本内部の作成記録：2026-08-10。取得日時・原本SHA-256・出力SHA-256は `data/story-temperature-annual.json` に収録。
- 引用：GISTEMP Team, 2026; Lenssen et al. (2024), *A GISTEMPv4 observational uncertainty ensemble*, doi:10.1029/2023JD040179。公式ページの指定に従い、出典と引用・取得日をデモ内にも表示。
- 原本約24.6 MiBは検証用 `artifacts/story-temperature-2026-09-10/` にのみ保存。公開用のデータには原本全体を含めない。

## 加工と表示範囲

`scripts/build-story-temperature.py` が、原本の月次2°格子から1958–2025年の68年分を抽出する。各セルで12か月すべてが有効な場合だけ、その単純平均を計算し、0.01 ℃に丸める。原本の欠測32767は欠測のまま保存する。追加の空間補完・地域差の生成・将来への外挿はしない。温度差の単位Kは℃の差と同値。

基準期間は1951–1980年。陸域の気温と海面水温を統合したNASAの推定格子で、地点の温度計の生観測ではない。NASAの1200 km平滑化済みデータであることを画面内に明記する。

- `data/story-temperature-annual.bin`：2,203,200 bytes。little-endian Int16、℃×100、北→南・西→東。欠測32767。
- `data/story-temperature-annual.json`：出典・加工・期間・各年の有効セル数・ハッシュ。`areaMeanC` は検証用の面積加重格子平均で、公式の全球平均指数ではない。デモの値には使用しない。
- 色は−4〜+4 ℃の固定尺度。範囲外は端色で表す。灰色は欠測。色面は元の2°格子、等値線だけ格子間を線形補間して描画し、その違いも注記する。
- 海岸線は既存の `data/natural-earth-50m-land.geojson`（Natural Earth / public domain）を再利用。
- 物語の背景には既存の `assets/visuals-07/novel-bg-gx-temperature-anomaly-autumn-morning-v3.png` を再利用。これは演出背景であり、数値を読む地図ではない。新たな画像生成・画像改変は行っていない。

データはローカル配信で、閲覧中にNASAへアクセスしない。新規データは第三者一覧にも登録した。NASAの承認・保証を示唆しない。公開指示は受けておらず、今回の実装・検証はローカルのみ。

## 再生成・照合

```powershell
python scripts/build-story-temperature.py artifacts/story-temperature-2026-09-10/gistemp1200_GHCNv4_ERSSTv5.nc.gz
node scripts/check-story-temperature-data.mjs
```

生成にはnumpyを使う。検証は全1,101,600セルの個数・範囲・欠測数・ハッシュを照合する。原本がある場合、別実装のNodeコードでも68年×7地点＝476組についてNetCDFの月次値を直接読み、年平均・緯度方向・欠測の扱いを照合する。原本の固定ヘッダー位置を参照する検査は記録済み原本SHA-256との一致が前提であり、別版に差し替えてそのまま合格にはしない。
