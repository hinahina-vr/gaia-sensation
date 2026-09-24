/** 概要: 現在の展示の自動再生・停止を共通管理する。観測データの更新は各展示の処理に任せる。 */
// One transport for the current exhibit. Touring owns chapter changes; this
// owns only playback intent and delegates observations to their real provider.
export function mountMapPlayback() {
  const layer = document.querySelector('#japan-layer');
  if (!layer || globalThis.GaiaMapPlayback) return;
  const button = document.createElement('button');
  layer.classList.add('has-map-playback');
  button.id = 'gaia-map-playback-toggle'; button.type = 'button';
  button.innerHTML = '<span data-playback-icon aria-hidden="true">▶</span><span data-playback-label>自動表示する</span>';
  const help = document.createElement('span');
  help.id = 'gaia-map-playback-help'; help.className = 'map-demo-visually-hidden';
  button.setAttribute('aria-describedby', help.id);
  const status = document.createElement('span');
  status.className = 'map-demo-visually-hidden'; status.setAttribute('role', 'status');
  layer.querySelector('.japan-map-actions').append(button);
  layer.append(help, status);
  let intent = false, chapter = 0, applying = false, lastKey = '', scheduled = false;
  const inMap = () => !layer.hidden && layer.getAttribute('aria-hidden') === 'false' && !layer.dataset.storyMode
    && !document.body.classList.contains('novel-mode-detour');
  const current = () => Number(layer.querySelector('#japan-mode-number')?.textContent);
  const provider = () => {
    const n = current();
    if (n === Number(globalThis.GaiaFirmsExhibit?.definition.number)) return globalThis.GaiaFirmsExhibit;
    if (n >= 6 && n <= 14) return globalThis.GaiaMapObservationAdapter;
    if (n >= 15 && n <= 20) return globalThis.GaiaLiveExhibits;
    if (n >= 21 && n <= 30) return globalThis.GaiaEstatExhibits;
    if (n >= 31 && n <= 69) return globalThis.GaiaMarineCod;
    if (n >= 70) return globalThis.GaiaFoodExhibits;
    return null;
  };
  const info = () => provider()?.getPlaybackState?.() || { ready: true, supported: false, playing: false,
    reason: 'この展示には時間順に再生できるデータがありません。' };
  const suspended = () => document.hidden || !inMap()
    || globalThis.GaiaModeEntryGuide?.getState?.()?.active
    || layer.classList.contains('is-map-title-transitioning')
    || layer.classList.contains('japan-data-open')
    || document.body.matches('.gaia-statistics-open, .gaia-tour-open, .novel-open');
  const getState = () => {
    const data = info();
    return { number: current(), requested: intent, playing: Boolean(intent && data.playing && !suspended()),
      paused: Boolean(intent && suspended()), ready: Boolean(data.ready), supported: Boolean(data.supported),
      reason: data.reason || (data.ready ? '' : '展示データを読み込んでいます。'), detail: data.detail || '' };
  };
  const sync = () => {
    scheduled = false;
    if (applying) return;
    const n = current();
    if (chapter !== n) { chapter = n; intent = !globalThis.GaiaMapCruise?.getState().active; }
    if (!inMap()) intent = false;
    const data = info();
    const next = Boolean(intent && data.ready && data.supported && !suspended() && !globalThis.GaiaMapCruise?.getState().active);
    applying = true;
    try {
      // The novel owns the embedded MAP's timed completion. Hiding the full
      // MAP transport must not send a pause command into that separate flow.
      const storyOwned = layer.dataset.storyMode || document.body.classList.contains('novel-mode-detour');
      if (!storyOwned && Boolean(data.playing) !== next) provider()?.setPlayback?.(next);
    }
    finally { applying = false; }
    const state = getState();
    button.disabled = !inMap() || !state.ready || !state.supported;
    button.setAttribute('aria-pressed', String(intent && state.supported));
    button.dataset.disabledReason = state.reason;
    const label = intent && state.supported ? '自動表示をやめる' : '自動表示する';
    button.setAttribute('aria-label', label);
    button.querySelector('[data-playback-label]').textContent = label;
    button.querySelector('[data-playback-icon]').textContent = intent && state.supported ? '■' : '▶';
    help.textContent = state.reason || `${state.detail} 展示ページは切り替えません。操作すると停止します。`;
    button.title = state.paused ? '読込・ガイド・非表示中は一時停止しています。' : help.textContent;
    for (const proxy of layer.querySelectorAll('[data-firms-play], [data-cod-play], [data-food-play]')) {
      const active = proxy.closest('[hidden]') === null;
      proxy.dataset.mapPlaybackProxy = '';
      if (!active) continue;
      proxy.textContent = label; proxy.setAttribute('aria-pressed', String(intent && state.supported));
      proxy.disabled = button.disabled; proxy.title = button.title;
    }
    const key = JSON.stringify(state);
    if (lastKey !== key) { lastKey = key; dispatchEvent(new CustomEvent('gaia:map-playback-change', {detail: state})); }
  };
  const scheduleSync = () => { if (!scheduled && !applying) { scheduled = true; queueMicrotask(sync); } };
  const stop = (reason = 'stop') => {
    const changed = intent; intent = false; sync();
    if (changed && reason === 'stop') status.textContent = 'この展示の再生を停止しました。';
    return changed;
  };
  const start = ({ waitForReady = false } = {}) => {
    const data = info(); if (!inMap() || (!waitForReady && (!data.ready || !data.supported))) return false;
    globalThis.GaiaMapDemo?.stop?.('current-playback');
    intent = true; sync(); status.textContent = '自動表示を開始します。展示ページは切り替えません。'; return true;
  };
  const toggle = () => { if (intent) { globalThis.GaiaMapDemo?.stop?.('current-playback'); stop(); } else start(); };
  button.addEventListener('click', toggle);
  const keepsPlayback = event => {
    if (event.type === 'keydown' && !['Enter', ' ', 'Tab', 'Shift'].includes(event.key)) return false;
    return event.composedPath().some(node => node instanceof Element && node.matches(
      '#gaia-map-playback-toggle, #gaia-map-demo-toggle, [data-map-playback-proxy], [data-mobile-transport], [data-mobile-guide], [data-mobile-sheet="tools"], [data-mobile-sheet-close], [data-gaia-mode-guide-replay="map"]'));
  };
  const onInput = event => {
    if (!event.isTrusted || !inMap() || !intent || keepsPlayback(event)
      || globalThis.GaiaModeEntryGuide?.getState?.()?.active) return;
    // Merely moving keyboard focus inside the mobile tools dialog is not stop.
    if (event.type === 'keydown' && ['Tab', 'Shift'].includes(event.key)) return;
    stop('interaction');
    if (event.type === 'keydown' && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  for (const name of ['pointerdown', 'wheel']) addEventListener(name, onInput, {capture: true, passive: true});
  addEventListener('keydown', onInput, true);
  for (const name of ['gaia:app-ready', 'gaia:japan-open', 'gaia:japan-close', 'gaia:japan-mode-change', 'gaia:live-exhibit-change',
    'gaia:estat-exhibit-change', 'gaia:firms-change', 'gaia:firms-exhibit-change', 'gaia:planet-signals-change', 'gaia:marine-cod-change', 'gaia:marine-cod-ready',
    'gaia:food-change', 'gaia:food-ready', 'gaia:signals-ready', 'gaia:live-prefecture-field', 'gaia:live-update',
    'gaia:mode-guide-open', 'gaia:mode-guide-close', 'gaia:provider-playback-change']) addEventListener(name, scheduleSync);
  new MutationObserver(scheduleSync).observe(layer, {attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden', 'data-story-mode']});
  new MutationObserver(scheduleSync).observe(document.body, {attributes: true, attributeFilter: ['class']});
  document.addEventListener('visibilitychange', sync);
  addEventListener('gaia:japan-open', () => { if(inMap()) { intent = true; scheduleSync(); } });
  addEventListener('pagehide', () => stop('leave'));
  globalThis.GaiaMapPlayback = Object.freeze({start, stop, toggle, sync: scheduleSync, getState, keepsPlayback,
    setTour: active => { intent = Boolean(active); sync(); }});
  sync();
}
