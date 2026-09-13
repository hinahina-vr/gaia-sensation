# 31以降の初期位置

31〜69と70〜71の展示選択時のカメラを、30が使うjapanPrefectureView(innerWidth)に統一。全体表示ボタン・個別POIフォーカスは変更しない。

check-map-initial-view-browser.mjs合格。ローカルChrome1440/390幅で30の実カメラ値を基準に、31・38・44・55・65・69・70・71のズーム・XYオフセットが一致することを確認。PC31のスクリーンショットを目視確認。証跡artifacts/map-initial-view-20260912/report.json。

31〜71全展示個別の目視ではなく共通実装の代表展示検証。外部通信遮断、保存データ使用。実機・本番未検証、未公開。
