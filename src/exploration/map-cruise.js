// 展示内の一巡を終えてから次へ。ガイド・読込・非表示中は時計を進めない。
export function createCruiseController({ inspect, advance, available, paused, onChange = () => {}, now = () => performance.now() }) {
  let active = false, visit = null, elapsed = 0, previous = 0, phase = 'idle', poiIndex = 0;
  const getState = () => ({active, number: visit?.number || null, phase, elapsed, poiIndex, duration:visit?.duration || 0, paused: active && paused()});
  const publish = () => onChange(getState());
  const clearVisit = () => { visit?.dispose?.(); visit = null; };
  const stop = () => { active = false; clearVisit(); phase = 'idle'; publish(); };
  const start = () => { if (!available()) return false; active = true; clearVisit(); previous = now(); phase = 'loading'; publish(); return true; };
  const tick = () => {
    const time = now(), delta = Math.max(0, time - previous); previous = time;
    if (!active) return;
    if (!available()) { stop(); return; }
    if (paused()) return;
    const next = inspect();
    if (!next?.ready) return;
    if (!visit || visit.number !== next.number) {
      clearVisit();
      visit = next; elapsed = 0; poiIndex = 0; phase = visit.kind;
      if (phase === 'slider') visit.seek(0); else visit.selectPoi(0);
      publish(); return;
    }
    elapsed += delta;
    if (phase === 'slider') {
      const progress = Math.min(1, elapsed / visit.duration);
      visit.seek(progress);
      if (progress === 1) { phase = 'hold'; elapsed = 0; publish(); }
    } else if (phase === 'hold' && elapsed >= 3000) {
      clearVisit(); phase = 'loading'; advance(); publish();
    } else if (phase === 'poi' && elapsed >= 5000) {
      elapsed = 0; poiIndex++;
      if (poiIndex >= Math.min(5, Math.max(1, visit.poiCount))) { clearVisit(); phase = 'loading'; advance(); }
      else visit.selectPoi(poiIndex);
      publish();
    }
  };
  return {start, stop, tick, getState, resetClock: () => { previous = now(); }};
}

export function mountMapCruise() {
  if (globalThis.GaiaMapCruise) return;
  const layer = document.querySelector('#japan-layer');
  const button = document.createElement('button');
  button.id = 'gaia-map-cruise-toggle'; button.type = 'button';
  button.title = '全展示を自動的にめぐる旅に出ます';
  layer.querySelector('.japan-map-actions').append(button);
  const current = () => Number(layer.querySelector('#japan-mode-number').textContent);
  const available = () => !layer.hidden && layer.getAttribute('aria-hidden') === 'false' && !layer.dataset.storyMode && !document.body.classList.contains('novel-open');
  const paused = () => document.hidden || globalThis.GaiaModeEntryGuide?.getState?.()?.active
    || layer.matches('.is-map-title-transitioning, .japan-data-open') || document.body.matches('.gaia-statistics-open, .gaia-tour-open')
    || Boolean(layer.querySelector('#map-mobile-sheet[open]'));
  const inspect = () => {
    const n = current(), g = globalThis;
    const provider = n === 1 ? g.GaiaFirmsExhibit : n <= 5 ? g.GaiaPlanetSignals : n <= 14 ? g.GaiaMapObservationAdapter
      : n <= 20 ? g.GaiaLiveExhibits : n <= 30 ? g.GaiaEstatExhibits : n <= 69 ? g.GaiaMarineCod : g.GaiaFoodExhibits;
    const ready = n >= 2 && n <= 5 ? provider?.getState().pointCount > 0 : provider?.getPlaybackState?.().ready;
    if (!ready) return {number:n, ready:false};
    const selector = n === 1 ? '[data-firms-progress]' : n <= 5 ? null : n <= 14 ? '.signal-console-map [data-signal-time]'
      : n <= 20 ? '#gaia-live-time' : n <= 30 ? '[data-estat-month]' : n <= 69 ? '[data-cod-year]' : '[data-food-year]';
    const slider = selector && layer.querySelector(selector);
    if (slider && !slider.disabled && Number(slider.max) > Number(slider.min)) {
      const min = Number(slider.min), max = Number(slider.max), originalStep = slider.step, step = Number(originalStep) || 1;
      let last = NaN;
      const duration = n === 1 ? 30000 : n <= 14 ? g.GaiaMapObservationAdapter.getTimelineDuration() : (max - min) / step * 4000;
      return {number:n, ready:true, kind:'slider', duration:Math.max(4000,duration), dispose: () => {
        slider.step = originalStep; if (Number.isFinite(last)) slider.value = String(last);
      }, seek: progress => {
        const value = min + progress * (max - min);
        const record = progress === 1 ? max : min + Math.floor((value - min) / step) * step;
        // 記録を切り替える時だけinput。つまみは50ms刻みで連続的に進める。
        if (record !== last) { slider.value = String(record); slider.dispatchEvent(new Event('input', {bubbles:true})); last = record; }
        slider.step = 'any'; slider.value = String(value);
      }};
    }
    const points = provider?.getCruisePoints?.() || provider?.observationPoints || [];
    return {number:n, ready:true, kind:'poi', poiCount:points.length, selectPoi: i => {
      if (!points.length) return;
      const index = Math.floor(i * points.length / Math.min(5,points.length)), point = points[index];
      provider.selectCruisePoi?.(index);
      if (n >= 15 && n <= 20) provider.selectObservationPoint(point.id);
    }};
  };
  const controller = createCruiseController({inspect, available, paused, advance: () => {
    globalThis.GaiaMapObservationAdapter?.closePoi();
    const buttons = globalThis.GaiaMapCategories.buttons(layer).filter(b=>!b.disabled);
    const index = buttons.findIndex(b=>Number(b.textContent.trim())===current());
    buttons[(index+1)%buttons.length]?.click();
  }, onChange: state => {
    button.setAttribute('aria-pressed', String(state.active));
    button.textContent = state.active ? '■ クルージング停止' : '▷ クルージングモード';
    layer.classList.toggle('is-cruising', state.active);
    globalThis.GaiaMapPlayback?.sync();
    dispatchEvent(new CustomEvent('gaia:map-cruise-change',{detail:state}));
  }});
  const stop = () => { const wasActive = controller.getState().active; controller.stop(); if (wasActive) globalThis.GaiaMapPlayback?.stop('cruise'); };
  const start = () => { globalThis.GaiaMapDemo?.stop('cruise'); if (!controller.start()) return false; globalThis.GaiaMapPlayback?.stop('cruise'); controller.tick(); return true; };
  const toggle = () => controller.getState().active ? stop() : start();
  button.addEventListener('click', toggle);
  const onInput = event => {
    if (!event.isTrusted || !controller.getState().active || globalThis.GaiaModeEntryGuide?.getState?.()?.active) return;
    if (event.type==='keydown' && ['Tab','Shift'].includes(event.key)) return;
    if (event.composedPath().some(el=>el instanceof Element && el.matches('#gaia-map-cruise-toggle, [data-mobile-cruise], [data-mobile-sheet="tools"], [data-mobile-sheet-close], [data-gaia-mode-guide-replay="map"]'))) return;
    stop();
  };
  for (const type of ['pointerdown','wheel','keydown']) addEventListener(type,onInput,{capture:true,passive:true});
  addEventListener('gaia:japan-close',stop);addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',controller.resetClock);
  setInterval(controller.tick,50);
  globalThis.GaiaMapCruise = Object.freeze({start,stop,toggle,getState:controller.getState});
  controller.stop();
}
