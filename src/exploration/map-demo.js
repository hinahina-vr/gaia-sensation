import { createMapDemoController } from "./map-demo-controller.js?v=gaia-map-demo-1-perf-high-20260909";
import { mountMapPlayback } from './map-playback.js?v=unified-playback-20260912-i18n-20260913';
import { mountMapCruise } from './map-cruise.js?v=i18n-20260913';

function mountMapDemo() {
  const layer = document.querySelector("#japan-layer");
  if (!layer || globalThis.GaiaMapDemo) return;
  const button = document.createElement("button");
  button.id = "gaia-map-demo-toggle";
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-describedby", "gaia-map-demo-help");
  button.innerHTML = `<span data-demo-fill aria-hidden="true"></span><span data-demo-icon aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path data-demo-play d="m9 6 9 6-9 6Z"/><path data-demo-stop d="M7 7h10v10H7Z"/></svg></span><span data-demo-label>展示巡回</span>`;
  const help = document.createElement("span");
  help.id = "gaia-map-demo-help";
  help.className = "map-demo-visually-hidden";
  help.textContent = "すべての展示を25秒ごとに巡回し、対応展示では年・時刻なども再生します。巡回を停止すると展示内の再生も停止します。この展示だけを見る場合は「この展示を再生」を使ってください。読込中・ガイド中・非表示中は一時停止します。";
  const status = document.createElement("span");
  status.className = "map-demo-visually-hidden";
  status.setAttribute("role", "status");
  // Touring is no longer a visible control. Keep the API for existing callers.
  const label = button.querySelector("[data-demo-label]");
  const fill = button.querySelector("[data-demo-fill]");
  let progressAnimation = null;
  let previousProgress = { active: false, paused: false, remainingMs: 0 };
  const syncProgress = state => {
    const remaining = Math.max(0, Math.min(1, state.remainingMs / state.intervalMs));
    button.style.setProperty("--demo-remaining", String(remaining));
    const restart = state.active && (!previousProgress.active || previousProgress.paused !== state.paused
      || state.remainingMs > previousProgress.remainingMs + 1);
    if (!state.active || state.paused || restart) {
      progressAnimation?.cancel();
      progressAnimation = null;
      const clipPath = `inset(0 ${(1 - remaining) * 100}% 0 0)`;
      fill.style.clipPath = clipPath;
      if (state.active && !state.paused) {
        // Reveal the unchanged gradient through a shrinking window. The right
        // edge travels left; the text and colors themselves never get squashed.
        progressAnimation = fill.animate([{ clipPath }, { clipPath: "inset(0 100% 0 0)" }], {
          duration: state.remainingMs, easing: "linear", fill: "forwards",
        });
      }
    }
    previousProgress = { active: state.active, paused: state.paused, remainingMs: state.remainingMs };
  };
  const buttons = () => globalThis.GaiaMapCategories?.buttons(layer).filter(item => !item.disabled) || [];
  const number = item => Number(item.textContent.trim());
  const isAvailable = () => !layer.hidden && layer.getAttribute("aria-hidden") === "false"
    && !layer.classList.contains("japan-data-open")
    && !layer.dataset.storyMode
    && !document.body.matches(".gaia-tour-open, .gaia-statistics-open, .novel-open");
  let wasActive = false;
  const controller = createMapDemoController({
    getItems: () => buttons().map(number),
    getCurrent: () => Number(layer.querySelector("#japan-mode-number")?.textContent.trim()),
    select: next => {
      const target = buttons().find(item => number(item) === next);
      if (!target) return false;
      // Use exactly the manual navigation path for every registered renderer.
      target.click();
      return true;
    },
    isAvailable,
    onChange: state => {
      layer.classList.toggle("is-demo-running", state.active);
      button.setAttribute("aria-pressed", String(state.active));
      button.setAttribute("aria-label", state.active ? "展示巡回を停止" : "展示巡回を開始");
      button.title = state.active ? state.paused ? "展示巡回はオン — 読込中・ガイド中・非表示中は一時停止" : "25秒ごとに次の展示へ。操作すると停止します。" : "すべての展示を25秒ごとに巡回します。";
      label.textContent = state.active ? "巡回を停止" : "展示巡回";
      syncProgress(state);
      if (state.active !== wasActive) {
        status.textContent = state.active ? "展示巡回を開始しました。25秒ごとに次の展示へ進みます。操作すると停止します。"
          : state.reason === "error" ? "展示を切り替えられなかったため巡回を停止しました。" : "展示巡回と展示内の再生を停止しました。";
        wasActive = state.active;
        globalThis.GaiaMapPlayback?.setTour(state.active);
      }
    },
  });
  const guideIsOpen = () => {
    const guide = globalThis.GaiaModeEntryGuide?.getState?.();
    return guide?.active && guide.id === "map";
  };
  const dataIsPending = () => {
    if (layer.classList.contains("is-marine-cod-exhibit")) return globalThis.GaiaMarineCod?.getState().dataState !== "ready";
    if (layer.classList.contains("is-food-exhibit")) return globalThis.GaiaFoodExhibits?.getState().dataState !== "ready";
    const external = layer.matches(".is-live-exhibit, .is-estat-exhibit, .is-firms-exhibit, .is-planet-signals-exhibit");
    return !external && globalThis.GaiaMapObservationAdapter?.getState().signalReady === false;
  };
  const syncPause = () => controller.setPaused(document.hidden || guideIsOpen() || dataIsPending());
  const start = ({ automatic = false } = {}) => {
    if (document.hidden || !isAvailable()) return false;
    if (!automatic) globalThis.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
    for (const selector of [".map-dock-bank-trigger", "#map-mobile-bank-toggle"]) {
      const toggle = layer.querySelector(selector);
      if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
    }
    const started = controller.start();
    syncPause();
    return started;
  };
  button.setAttribute("aria-label", "展示巡回を開始");
  button.title = "展示をゆっくり巡る";
  button.addEventListener("click", () => {
    if (controller.getState().active) stop();
    else start();
  });
  // Real input yields immediately to the visitor. Programmatic exhibit clicks
  // must not cancel the loop, and the stop control must not restart itself.
  const onInput = event => {
    if (!event.isTrusted || !controller.getState().active) return;
    // Reading, stepping through, or replaying the guide keeps the default on.
    // Its lifecycle pauses the countdown instead of cancelling the demo.
    if (guideIsOpen() || event.composedPath().some(node => node instanceof Element
      && node.matches('[data-gaia-mode-guide-replay="map"]'))) return;
    if (globalThis.GaiaMapPlayback?.keepsPlayback(event)) return;
    if (event.type === 'keydown' && ['Tab', 'Shift'].includes(event.key)) return;
    const onToggle = event.composedPath().includes(button);
    if (onToggle && (["pointerdown", "click"].includes(event.type)
      || (event.type === "keydown" && ["Enter", " "].includes(event.key)))) return;
    stop("interaction");
    if (event.type === "keydown" && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  for (const type of ["pointerdown", "click", "wheel"]) addEventListener(type, onInput, { capture: true, passive: true });
  addEventListener("keydown", onInput, true);
  let defaultPending = false;
  document.addEventListener("visibilitychange", () => { syncAvailability(); syncPause(); });
  for (const name of ["gaia:mode-guide-open", "gaia:mode-guide-close"]) {
    addEventListener(name, event => { if (event.detail?.id === "map") syncPause(); });
  }
  addEventListener("pagehide", () => controller.stop("leave"));
  addEventListener("gaia:japan-close", () => { defaultPending = false; controller.stop("leave"); });
  const syncAvailability = () => {
    const available = isAvailable();
    button.disabled = !available || buttons().length < 2;
    if (!available) controller.stop("unavailable");
    if (defaultPending && !button.disabled && !document.hidden) {
      // One automatic start per map visit. A manual stop stays stopped until
      // the visitor explicitly starts again or leaves and re-enters the map.
      defaultPending = false;
      start({ automatic: true });
    }
    syncPause();
  };
  const observer = new MutationObserver(syncAvailability);
  observer.observe(layer, { attributes: true, attributeFilter: ["hidden", "aria-hidden", "class", "data-story-mode"] });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  addEventListener("gaia:japan-open", () => {
    defaultPending = false;
    syncAvailability();
  });
  addEventListener("gaia:app-ready", syncAvailability);
  for (const name of ["gaia:food-change", "gaia:food-ready", "gaia:marine-cod-change", "gaia:marine-cod-ready", "gaia:signals-ready", "gaia:japan-mode-change", "gaia:estat-exhibit-change", "gaia:firms-exhibit-change"]) addEventListener(name, syncPause);
  for (const name of ["gaia:food-error", "gaia:marine-cod-error", "gaia:signals-error"]) addEventListener(name, () => controller.stop("error"));
  const stop = (reason = 'stop') => {
    const changed = controller.stop(reason);
    if (changed || reason === 'stop') globalThis.GaiaMapPlayback?.stop(reason);
    return changed;
  };
  globalThis.GaiaMapDemo = Object.freeze({ start, stop, getState: controller.getState });
  mountMapPlayback();
  mountMapCruise();
  syncAvailability();
}

mountMapDemo();
