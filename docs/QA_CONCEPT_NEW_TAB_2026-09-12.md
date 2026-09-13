# このサイトについて: 別タブ

- タイトルのリンクに target=_blank と rel=noopener noreferrer を付与。別タブ時は元画面への復帰マーカーを書かない。
- Chrome headless 1440 / 390 で実クリックし、新タブ /concept/、元ページURLとタイトル画面維持、window.opener=nullを確認。
- 回帰試験: scripts/check-concept-new-tab-browser.mjs、2条件合格。
- ローカル未コミット・未公開。
- 追加指示: ホバー下線を削除し、700msで一度だけ通過する光へ変更。動き低減では移動せず文字の光のみ。Chrome PC/スマホで下線なし・光のアニメーション指定・別タブ遷移を再確認。
