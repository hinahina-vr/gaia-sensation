# タイトルの2つの入口

- WebGLで物語側に光の曲線、データ側に観測点と走査光。文字領域は暗く保ち、ホバー・フォーカスで反応。描画密度を1.5倍まで、更新約30fpsに制限し、画面外・非表示タブは停止。動き低減では静止描画、WebGL取得失敗時はCSSのみ。
- 追加のユーザー指示で左側の太いインセット線を通常・ホバーとも削除。細い低コントラスト境界と内側の光で表現。キーボードのフォーカス表示は保持。
- Chrome headless PC1440 / mobile390、動き低減、WebGLなしの4条件をcheck-route-art-browser.mjsで確認。最終PCホバー画像を目視確認。非対応試験はgetContextの戻り値をテスト内でnullにした模擬条件。
- 既存check-opening-route-navigation-browser.mjsは18条件合格（太線削除前、機能コードは同一）。
- 証跡 artifacts/route-art-20260912。ローカル未コミット・未公開。
