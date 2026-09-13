# 14 人口のカウント演出

選択人口のカードと地図ラベルで、同じ900msの補間値を全桁表示する。初回は0から、以後は直前の表示値から増減し、最後は整数の原資料値へ到達する。分析・出典・書き出しの原資料値は変更しない。reduced-motion時は即時表示。

node --check app.js 合格。check-population-count-browser.mjsでローカルChrome1440/390幅、スライダー変更後に100msごとに数字を読み、複数の中間値、全桁カンマ表示、ページ例外なしを検証。証跡artifacts/population-count。外部API遮断、実機・本番未検証。未公開。
