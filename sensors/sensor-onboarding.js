const sourceRoot = 'https://github.com/hinahina-vr/gaia-senseware/tree/de7e661dbccb151a963d755f5772db53e7d419f9/smartcity-sensor-starter-kit/esp32-arduino/SmartCitySensorDemo';
const context = `GAIA SENSEWARE（https://gaia-senseware.pages.dev/sensors/）へESP32を接続する作業です。ESP32をUSBでつないだこのPCで作業してください。ソースは ${sourceRoot} です。手元にプロジェクトがなければ、この固定版のREADME.md、SmartCitySensorDemo.ino、config.example.h、root_ca.example.hを作業フォルダへ取得し、内容を読んでください。既存ファイルは上書きせず差分を確認してください。`;
const safety = '機種・COMポート・現在のファームウェアと認証状態を先に確認してください。秘密を含むNVSを画面へダンプしないでください。Wi-Fiパスワード・Pairing Code・Device Tokenは会話、引数、履歴、ログ、Gitへ出さず、必要な秘密はユーザーがPC上の非表示入力で渡せるようにしてください。USBへアクセスできない、必要な権限・ツールがない場合は、その不足と次に必要な操作を説明して停止してください。';
export const setupRequests = {
  prepare: `${context}\n${safety}\n初めて接続するための準備です。ESP32-WROOM-32 / ESP32-D0WD-V3 revision 3.1 / 4MB / CH340と保護設定を確認し、不一致、Secure Boot、フラッシュ暗号化があれば停止してください。すでにGAIAへ接続済みなら書き込まず接続状態の確認へ切り替えてください。書き込みが必要なら全フラッシュのバックアップ、4,194,304 bytesとSHA-256、復元手順を確認してから進めてください。READMEに沿ってArduino環境、config.h、API URL、証明書を確認してビルドし、書き込み・起動・115200 baudのUSB設定受付を確認してください。実測とUSE_MOCK_SENSORの模擬データを区別してください。準備ができた時点で止まり、Webのマイセンサーで観測点を登録してPairing Codeを発行するよう案内してください。`,
  connect: `${context}\n${safety}\nWebで新しい観測点と10分間有効なPairing Codeを作成済みです。ファームウェアの準備を行ったタスクからの続きです。GAIA_USB_PROVISION対応を確認し、115200 baudのUSB Serialへ1行JSONでcommand=GAIA_USB_PROVISION、ssid、password、pairingCodeを送る設定方法をREADMEとソースに照らして用意してください。秘密の入力・送信はユーザーのPC上だけで行い、シリアル送信内容をログへ出さないでください。すでに機器側の認証情報がある場合は新コードを送らず停止し、既存登録との対応を確認してください。対応しない旧ファームウェアでも勝手に書き換えたりBOOT初期化したりせず停止してください。設定後は秘密を含まない接続結果だけを確認し、WebのマイセンサーでONLINEと観測値更新を確認するよう案内してください。`,
  existing: `${context}\n${safety}\nすでにWebへ登録済みのESP32です。まず読み取り中心の診断だけを行ってください。Web上の登録と機器側の設定完了は別なので、電源、USB、Wi-Fi、ファームウェア、機器認証の有無と観測値の更新を確認してください。端末削除・再登録・BOOT長押し・再書き込み・認証情報の消去はしないでください。USB診断コマンドが未対応なら、その事実を説明して停止してください。Wi-Fiだけの変更が必要で、機器側に認証情報が残っている場合は、READMEのPairing Code空欄で認証を保持する手順を提示し、変更前に私に確認してください。`,
};

export const localizedSetupRequest = kind => setupRequests[kind].split('\n')
  .map(paragraph => window.GaiaI18n?.t(paragraph) || paragraph).join('\n');

export function initSetupRequests(showStatus) {
  const previews = [];
  document.querySelectorAll('[data-setup-request]').forEach(container => {
    const kind = container.dataset.setupRequest;
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'sensor-secondary', textContent: kind === 'existing' ? 'Codexへの確認依頼をコピー' : 'Codexへの依頼文をコピー' });
    button.dataset.copySetup = kind;
    const details = document.createElement('details');
    details.className = 'sensor-request-preview';
    details.append(Object.assign(document.createElement('summary'), { textContent: 'コピーする内容を見る（秘密は含みません）' }));
    const text = Object.assign(document.createElement('pre'), { textContent: localizedSetupRequest(kind) });
    previews.push({ kind, text });
    details.append(text);
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(localizedSetupRequest(kind)); showStatus('依頼文をコピーしました。ESP32をつないだPCのCodexへ貼り付けてください。'); }
      catch { details.open = true; const range = document.createRange(); range.selectNodeContents(text); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); showStatus('依頼文を選択しました。手動でコピーしてください。'); }
    });
    container.append(button, details);
  });
  const guideRequest = document.querySelector('#sensor-guide-request-text');
  const refreshPreviews = () => {
    for (const { kind, text } of previews) text.textContent = localizedSetupRequest(kind);
    if (guideRequest) guideRequest.textContent = localizedSetupRequest('prepare');
  };
  refreshPreviews();
  window.addEventListener('gaia:language-change', refreshPreviews);
}

export function renderCompactMeasurementPicker(container, categories, catalogue) {
  const firstRender = !container.dataset.pickerReady;
  const existing = new Set([...container.querySelectorAll('input[name="measurementKeys"]:checked')].map(input => input.value));
  if (firstRender && container.dataset.measurementPicker === 'add') ['temperature', 'humidity', 'pm25'].forEach(key => existing.add(key));
  container.dataset.pickerReady = 'true';
  container.classList.add('sensor-measurement-picker', 'sensor-compact-picker');
  container.replaceChildren();
  const selected = Object.assign(document.createElement('div'), { className: 'sensor-selected-measurements' });
  selected.setAttribute('aria-label', '選択中の計測項目');
  const limit = Object.assign(document.createElement('p'), { className: 'sensor-measurement-limit' });
  limit.setAttribute('aria-live', 'polite');
  const editor = document.createElement('details');
  editor.className = 'sensor-measurement-editor';
  editor.append(Object.assign(document.createElement('summary'), { textContent: '計測項目を変更する' }));
  const search = Object.assign(document.createElement('input'), { type: 'search', placeholder: '項目・キー・部品名で検索', autocomplete: 'off' });
  search.setAttribute('aria-label', '計測項目を検索');
  const presets = document.createElement('div');
  presets.className = 'sensor-measurement-presets';
  for (const [label, keys] of [['気温・湿度', ['temperature','humidity']], ['水質', ['water_temperature','ph','turbidity']], ['初期設定（模擬）', ['temperature','humidity','pm25']]]) {
    const button = Object.assign(document.createElement('button'), { type: 'button', textContent: label });
    button.addEventListener('click', () => {
      container.querySelectorAll('input[name="measurementKeys"]').forEach(input => { input.checked = keys.includes(input.value); });
      syncCompactMeasurementPicker(container);
    });
    presets.append(button);
  }
  editor.append(search, presets);
  for (const category of categories) {
    const definitions = [...catalogue.values()].filter(item => item.category === category.id);
    if (!definitions.length) continue;
    const details = document.createElement('details');
    details.dataset.measurementCategory = category.id;
    const summary = document.createElement('summary');
    summary.append(Object.assign(document.createElement('b'), { textContent: category.labelJa }), Object.assign(document.createElement('span'), { textContent: `${definitions.length}項目` }));
    const options = Object.assign(document.createElement('div'), { className: 'sensor-measurement-options' });
    for (const definition of definitions) {
      const label = Object.assign(document.createElement('label'), { className: 'sensor-measurement-option' });
      label.dataset.search = JSON.stringify(definition).normalize('NFKC').toLocaleLowerCase();
      const input = Object.assign(document.createElement('input'), { type: 'checkbox', name: 'measurementKeys', value: definition.key, checked: existing.has(definition.key) });
      input.dataset.label = definition.labelJa;
      const copy = document.createElement('span');
      copy.append(Object.assign(document.createElement('b'), { textContent: definition.labelJa }), Object.assign(document.createElement('small'), { textContent: `${definition.key} · ${definition.unit}` }));
      label.append(input, copy); options.append(label);
    }
    details.append(summary, options); editor.append(details);
  }
  const empty = Object.assign(document.createElement('p'), { textContent: '一致する項目がありません。別の言葉で検索してください。', hidden: true });
  editor.append(empty);
  search.addEventListener('input', () => {
    const query = search.value.normalize('NFKC').trim().toLocaleLowerCase();
    let matches = 0;
    editor.querySelectorAll('[data-measurement-category]').forEach(group => {
      let count = 0;
      group.querySelectorAll('.sensor-measurement-option').forEach(option => {
        const searchText = `${option.dataset.search} ${option.textContent}`.normalize('NFKC').toLocaleLowerCase();
        option.hidden = Boolean(query) && !searchText.includes(query); if (!option.hidden) count++;
      });
      group.hidden = count === 0;
      if (query) { if (!Object.hasOwn(group.dataset, 'beforeSearchOpen')) group.dataset.beforeSearchOpen = String(group.open); group.open = count > 0; }
      else if (Object.hasOwn(group.dataset, 'beforeSearchOpen')) { group.open = group.dataset.beforeSearchOpen === 'true'; delete group.dataset.beforeSearchOpen; }
      matches += count;
    });
    empty.hidden = matches > 0;
  });
  container.onchange = () => syncCompactMeasurementPicker(container);
  container.append(selected, limit, editor);
  syncCompactMeasurementPicker(container);
}

export function syncCompactMeasurementPicker(container) {
  const inputs = [...container.querySelectorAll('input[name="measurementKeys"]')];
  const checked = inputs.filter(input => input.checked);
  inputs.forEach(input => { input.disabled = !input.checked && checked.length >= 16; });
  container.querySelector('.sensor-measurement-limit').textContent = `${checked.length} / 16 項目を選択${checked.length ? '' : ' — 1項目以上選んでください'}`;
  const selected = container.querySelector('.sensor-selected-measurements');
  selected.replaceChildren();
  checked.forEach(input => {
    const chip = Object.assign(document.createElement('button'), { type: 'button', textContent: `${input.dataset.label} ×` });
    chip.setAttribute('aria-label', `${input.dataset.label}を選択から外す`);
    chip.addEventListener('click', () => { const index = [...selected.children].indexOf(chip); input.checked = false; syncCompactMeasurementPicker(container); (selected.children[Math.min(index, selected.children.length - 1)] || container.querySelector('.sensor-measurement-editor > summary')).focus(); });
    selected.append(chip);
  });
}
