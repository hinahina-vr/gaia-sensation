(() => {
  "use strict";

  const layer = document.querySelector("#japan-layer");
  const title = layer?.querySelector("#japan-title");
  if (!layer || !title) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 900px)");
  const readouts = ".gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout, .gaia-marine-cod-readout, .gaia-food-readout";
  let previous = null;
  let scheduled = 0;
  let motion = null;
  let sequence = 0;

  const isOpen = () => !document.hidden && !layer.hidden && layer.getAttribute("aria-hidden") === "false"
    && !layer.dataset.storyMode && !document.body.classList.contains("novel-mode-detour");
  const visible = node => {
    if (!node || node.hidden || !node.getClientRects().length) return false;
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const activePanel = () => [...layer.querySelectorAll(readouts)].find(visible)
    || (mobile.matches
      ? [layer.querySelector(".map-mobile-ecology-summary"), layer.querySelector(".signal-console-map")].find(visible)
      : [layer.querySelector(".map-command-dock")].find(visible));

  const cancel = () => {
    if (!motion) return;
    motion.animation.onfinish = null;
    motion.animation.cancel();
    delete motion.panel.dataset.mapDockMotion;
    motion = null;
    layer.dataset.dockMotionPhase = "cancelled";
  };
  const sync = () => {
    scheduled = 0;
    if (!isOpen()) {
      cancel();
      previous = null;
      return;
    }
    const number = title.dataset.exhibitNumber;
    const panel = activePanel();
    if (!number || !panel) return;
    const current = { number, panel };
    const before = previous;
    previous = current;
    // A refresh, POI selection or timeline tick must never replay the entrance.
    // Coalescing on the settled heading also skips intermediate provider restores.
    if (!before || (before.number === number && before.panel === panel)) return;
    cancel();
    layer.dataset.dockMotionSequence = String(++sequence);
    layer.dataset.dockMotionFrom = before.number;
    layer.dataset.dockMotionTo = number;
    if (reduced.matches || typeof panel.animate !== "function") {
      layer.dataset.dockMotionPhase = reduced.matches ? "reduced" : "complete";
      return;
    }

    // Animate only the replacement observation surface. The mobile menu stays
    // anchored. Individual translate preserves each dock's existing transform
    // and avoids animating height or reflowing text/controls on every frame.
    const lift = Math.min(48, Math.max(24, panel.offsetHeight * .3));
    const animation = panel.animate([
      { translate: `0 ${lift}px`, opacity: 0, offset: 0, easing: "cubic-bezier(.16, 1, .3, 1)" },
      { translate: "0 -2px", opacity: 1, offset: .74, easing: "ease-in-out" },
      { translate: "0 0", opacity: 1, offset: 1 },
    ], { duration: 480, fill: "both" });
    animation.id = "map-dock-enter";
    motion = { animation, panel };
    panel.dataset.mapDockMotion = "entering";
    layer.dataset.dockMotionPhase = "entering";
    animation.onfinish = () => {
      if (motion?.animation !== animation) return;
      animation.cancel();
      delete panel.dataset.mapDockMotion;
      motion = null;
      layer.dataset.dockMotionPhase = "complete";
    };
  };
  const schedule = () => {
    if (!scheduled) scheduled = requestAnimationFrame(sync);
  };
  const reset = () => {
    cancel();
    previous = null;
    schedule();
  };

  new MutationObserver(schedule).observe(title, { attributes: true, attributeFilter: ["data-exhibit-number"] });
  // Provider modules mount their readouts lazily and toggle the layer's mode.
  // Do not observe their continuously changing text or the entire subtree.
  new MutationObserver(schedule).observe(layer, {
    childList: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "aria-hidden", "data-story-mode"],
  });
  for (const event of ["gaia:japan-open", "gaia:japan-mode-change", "gaia:live-exhibit-change", "gaia:estat-exhibit-change", "gaia:firms-change", "gaia:planet-signals-change"]) {
    addEventListener(event, schedule);
  }
  addEventListener("resize", reset, { passive: true });
  // A dock can open fixed-position pickers/sheets. Settle its decorative
  // translation before those handlers measure their anchor; never delay input.
  layer.addEventListener("click", event => {
    if (motion?.panel.contains(event.target)) cancel();
  }, { capture: true });
  document.addEventListener("visibilitychange", reset);
  reduced.addEventListener("change", reset);
  mobile.addEventListener("change", reset);
  schedule();
})();
