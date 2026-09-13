(() => {
  "use strict";
  const layer = document.querySelector("#japan-layer");
  const legend = document.querySelector("#map-signal-encoding-legend-dock");
  if (!layer || !legend || globalThis.GaiaMapLegendDrag) return;

  // The quantitative card is painted on the map canvas. This transparent,
  // accessible hit surface moves its drawing coordinates, never the map.
  const metric = document.createElement("button");
  metric.type = "button";
  metric.className = "map-metric-drag-handle";
  metric.hidden = true;
  metric.setAttribute("aria-label", "数値パネルを移動");
  layer.append(metric);
  const heading = legend.querySelector("[data-signal-encoding-legend-title]");
  heading.tabIndex = 0;
  heading.setAttribute("role", "button");
  heading.setAttribute("aria-label", "凡例を移動");
  const instructions = "ドラッグで移動。矢印キーでも移動できます。ダブルクリック・ダブルタップまたはHomeキーで元の位置に戻します。";
  for (const element of [heading, metric]) {
    element.title = instructions;
    element.setAttribute("aria-description", instructions);
  }
  legend.classList.add("is-draggable-legend");
  const states = {
    legend: { element: legend, position: null, width: null },
    metric: { element: metric, position: null, bounds: null },
  };
  let drag = null, metricDrawn = false, desktop = innerWidth > 900;
  let lastTap = null;
  let guideHome = null;
  const visible = element => element.getClientRects().length && getComputedStyle(element).display !== "none";
  const clampPoint = (point, width, height) => {
    let bottom = innerHeight - 8;
    for (const dock of layer.querySelectorAll(".map-command-dock, .map-mode-bank")) {
      const bounds = dock.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0 && bounds.top > innerHeight / 2) bottom = Math.min(bottom, bounds.top - 8);
    }
    return {
      x: Math.max(8, Math.min(point.x, Math.max(8, innerWidth - width - 8))),
      y: Math.max(8, Math.min(point.y, Math.max(8, bottom - height))),
    };
  };
  const setStyle = (element, name, value) => {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  };
  const syncGuide = () => {
    const guide = layer.querySelector('[data-gaia-mode-guide-replay="map"]');
    if (!guide) return;
    const attached = desktop && (states.legend.position || layer.dataset.storyMode === "map01") && visible(legend);
    if (attached && !guideHome) {
      guideHome = { parent: guide.parentNode, next: guide.nextSibling };
      legend.append(guide);
    } else if (!attached && guideHome) {
      guideHome.parent.insertBefore(guide, guideHome.next?.parentNode === guideHome.parent ? guideHome.next : null);
      guideHome = null;
    }
  };
  const applyLegend = () => {
    const state = states.legend;
    legend.classList.toggle("is-user-positioned", Boolean(state.position));
    // Mobile normally nests the key in a transformed console. A floating
    // panel must live at the map root so fixed coordinates stay viewport-based.
    const host = state.position || desktop ? layer : layer.querySelector(".signal-console-map");
    if (host && legend.parentNode !== host) host.append(legend);
    if (state.position) {
      setStyle(legend, "--legend-drag-width", `${Math.min(state.width, innerWidth - 16)}px`);
      const bounds = legend.getBoundingClientRect();
      state.position = clampPoint(state.position, bounds.width, bounds.height);
      setStyle(legend, "--legend-drag-x", `${state.position.x}px`);
      setStyle(legend, "--legend-drag-y", `${state.position.y}px`);
    }
    syncGuide();
  };
  const reset = key => {
    states[key].position = null;
    if (key === "legend") applyLegend();
  };
  const move = (key, point) => {
    const state = states[key], bounds = state.element.getBoundingClientRect();
    state.position = clampPoint(point, bounds.width, bounds.height);
    if (key === "legend") {
      state.width ??= bounds.width;
      applyLegend();
    }
  };
  const finish = (cancel = false) => {
    if (!drag) return;
    const previous = drag; drag = null;
    if (cancel) {
      states[previous.key].position = previous.original;
      if (previous.key === "legend") applyLegend();
    }
    previous.surface.classList.remove("is-panel-dragging");
    if (previous.surface.hasPointerCapture(previous.pointerId)) previous.surface.releasePointerCapture(previous.pointerId);
  };
  const bind = (surface, key, keyboardTarget) => {
    const isControl = target => key === "legend" && target.closest("button, a, input, select, textarea, summary");
    surface.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !event.isPrimary || drag || isControl(event.target)) return;
      const bounds = surface.getBoundingClientRect();
      drag = { key, surface, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
        left: bounds.left, top: bounds.top, original: states[key].position && { ...states[key].position } };
      event.preventDefault(); event.stopPropagation();
      // Reparent before taking pointer capture: moving a captured element to
      // another parent can cancel an in-progress touch drag in Chromium.
      if (key === "legend") move(key, { x: bounds.left, y: bounds.top });
      keyboardTarget.focus({ preventScroll: true });
      surface.setPointerCapture(event.pointerId);
      surface.classList.add("is-panel-dragging");
    });
    surface.addEventListener("pointermove", event => {
      if (!drag || drag.surface !== surface || event.pointerId !== drag.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) < 3 && !drag.moved) return;
      drag.moved = true;
      move(key, { x: drag.left + dx, y: drag.top + dy });
    });
    surface.addEventListener("pointerup", event => {
      if (drag?.surface !== surface || event.pointerId !== drag.pointerId) return;
      const tapped = !drag.moved;
      event.preventDefault(); event.stopPropagation(); finish(tapped);
      if (event.pointerType === "touch" && tapped) {
        if (lastTap?.key === key && event.timeStamp - lastTap.time < 400
          && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) {
          reset(key); lastTap = null;
        } else lastTap = { key, time: event.timeStamp, x: event.clientX, y: event.clientY };
      } else lastTap = null;
    });
    surface.addEventListener("pointercancel", () => { if (drag?.surface === surface) finish(true); });
    surface.addEventListener("lostpointercapture", () => { if (drag?.surface === surface) finish(true); });
    surface.addEventListener("dblclick", event => {
      if (isControl(event.target)) return;
      event.preventDefault(); event.stopPropagation(); reset(key);
    });
    surface.addEventListener("click", event => { if (!isControl(event.target)) event.stopPropagation(); });
    keyboardTarget.addEventListener("keydown", event => {
      if (event.target !== keyboardTarget) return;
      if (event.key === "Home") { event.preventDefault(); event.stopPropagation(); finish(); reset(key); return; }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault(); event.stopPropagation();
      const bounds = surface.getBoundingClientRect(), step = event.shiftKey ? 32 : 8;
      move(key, { x: bounds.left + direction[0] * step, y: bounds.top + direction[1] * step });
    });
  };
  bind(legend, "legend", heading);
  bind(metric, "metric", metric);
  addEventListener("keydown", event => {
    if (event.key !== "Escape" || !drag) return;
    event.preventDefault(); event.stopImmediatePropagation(); finish(true);
  }, true);
  addEventListener("blur", () => finish(true));
  addEventListener("resize", () => {
    finish(true);
    if (desktop !== (innerWidth > 900)) {
      desktop = innerWidth > 900;
      reset("legend"); reset("metric"); states.legend.width = null;
    } else applyLegend();
  });
  let visibilityKey = "", panelSyncFrame = 0;
  const schedulePanelSync = () => {
    if (!panelSyncFrame) panelSyncFrame = requestAnimationFrame(() => { panelSyncFrame = 0; syncObservationPanels(); });
  };
  const syncVisibility = () => {
    const key = `${layer.className}|${layer.hidden}|${layer.getAttribute("aria-hidden")}|${layer.dataset.storyMode}|${desktop}`;
    if (key === visibilityKey) return;
    visibilityKey = key;
    const unavailable = layer.hidden || layer.getAttribute("aria-hidden") === "true"
      || layer.matches(".is-live-exhibit, .is-estat-exhibit, .is-firms-exhibit, .is-planet-signals-exhibit, .is-marine-cod-exhibit, .is-food-exhibit");
    if (unavailable) { if (!metric.hidden) metric.hidden = true; finish(true); }
    applyLegend();
    schedulePanelSync();
  };
  // DOM instruments use the same clear lane as canvas instruments. Their
  // height is content-driven now, so stack from actual legend bounds.
  const observedPanels = new WeakSet();
  const panelResize = new ResizeObserver(schedulePanelSync);
  const syncObservationPanels = () => {
    if (layer.hidden || layer.getAttribute("aria-hidden") === "true" || layer.matches(".is-marine-cod-exhibit, .is-food-exhibit") || document.body.classList.contains("novel-mode-detour")) return;
    const legendBox = visible(legend) && getComputedStyle(legend).visibility !== "hidden" ? legend.getBoundingClientRect() : null;
    const layerBox = layer.getBoundingClientRect();
    for (const panel of layer.querySelectorAll(".gaia-firms-legend, .gaia-planet-signals-legend, .gaia-live-metric-legend, .gaia-estat-heat-legend")) {
      if (!observedPanels.has(panel)) { observedPanels.add(panel); panelResize.observe(panel); }
      panel.style.removeProperty("top");
      if (!visible(panel) || !legendBox?.width || !legendBox.height) continue;
      const box = panel.getBoundingClientRect();
      if (box.left < legendBox.right && box.right > legendBox.left && box.top < legendBox.bottom && box.bottom > legendBox.top) {
        const top = legendBox.bottom + 10 - layerBox.top;
        if (top + box.height < layerBox.height - 100) panel.style.top = `${top}px`;
      }
    }
    globalThis.GaiaLiveExhibits?.reflowObservationLabel?.();
  };
  new MutationObserver(syncVisibility).observe(layer, { attributes: true, attributeFilter: ["class", "hidden", "aria-hidden", "data-story-mode"] });
  new ResizeObserver(() => { if (states.legend.position) applyLegend(); schedulePanelSync(); }).observe(legend);
  globalThis.GaiaMapLegendDrag = Object.freeze({
    syncObservationPanels,
    beginFrame: () => { metricDrawn = false; },
    placeMetric: bounds => {
      metricDrawn = true;
      const position = states.metric.position || { x: bounds.left, y: bounds.top };
      const clamped = clampPoint(position, bounds.width, bounds.height);
      if (states.metric.position) states.metric.position = clamped;
      const placed = { ...bounds, left: clamped.x, top: clamped.y };
      states.metric.bounds = placed;
      for (const [name, value] of Object.entries({ left: placed.left, top: placed.top, width: placed.width, height: placed.height })) {
        setStyle(metric, name, `${value}px`);
      }
      if (metric.hidden) metric.hidden = false;
      return placed;
    },
    endFrame: () => { if (!metricDrawn && !metric.hidden) { metric.hidden = true; if (drag?.key === "metric") finish(true); } },
  });
})();
