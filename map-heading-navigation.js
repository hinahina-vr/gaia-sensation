(() => {
  "use strict";
  const layer = document.querySelector("#japan-layer");
  const title = layer?.querySelector("#japan-title");
  const bank = layer?.querySelector(".map-mode-bank");
  if (!title || !bank || globalThis.GaiaMapHeadingNavigation) return;

  const enabled = () => !layer.hidden && layer.getAttribute("aria-hidden") !== "true"
    && !layer.dataset.storyMode && !document.body.classList.contains("novel-mode-detour");
  const catalog = () => globalThis.GaiaMapCategories?.buttons() || [];
  const makeStep = (direction, label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-heading-step";
    button.dataset.mapHeadingStep = String(direction);
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-controls", "japan-title");
    button.disabled = true;
    // A narrow chevron with an optical centre independent of the title font.
    const mark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    mark.classList.add("map-heading-chevron");
    mark.setAttribute("viewBox", "0 0 24 24");
    mark.setAttribute("aria-hidden", "true");
    mark.setAttribute("focusable", "false");
    const stroke = document.createElementNS("http://www.w3.org/2000/svg", "path");
    stroke.setAttribute("d", direction < 0 ? "M15 5l-6 7 6 7" : "M9 5l6 7-6 7");
    mark.append(stroke);
    button.append(mark);
    button.addEventListener("click", () => {
      if (!enabled() || layer.querySelector("#map-mobile-sheet")?.open) return;
      const buttons = catalog();
      const index = buttons.findIndex(item => item.getAttribute("aria-current") === "true");
      if (index < 0 || buttons.length < 2) return;
      // Reuse the canonical order and provider handlers, including 30 ↔ 01.
      buttons[(index + direction + buttons.length) % buttons.length].click();
    });
    return button;
  };
  const previous = makeStep(-1, "前の演出へ");
  const next = makeStep(1, "次の演出へ");
  title.before(previous);
  title.after(next);

  const actions = layer.querySelector(".japan-map-actions");
  const updatePosition = () => {
    if (!enabled() || !actions) return;
    // Desktop also has the demo control beside Back. Reserve the actual group
    // width so its label/visibility cannot cover the previous arrow.
    layer.style.setProperty("--map-heading-left", `${Math.ceil(actions.getBoundingClientRect().right + 8)}px`);
  };

  const sync = () => {
    const active = enabled(), buttons = catalog();
    layer.classList.toggle("has-map-heading-navigation", active);
    const ready = active && buttons.length > 1 && buttons.some(item => item.getAttribute("aria-current") === "true");
    previous.disabled = next.disabled = !ready;
    updatePosition();
  };
  // Observe only the catalog and map lifecycle, not live measurements/title text.
  new MutationObserver(sync).observe(bank, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current"] });
  new MutationObserver(sync).observe(layer, { attributes: true, attributeFilter: ["hidden", "aria-hidden", "data-story-mode"] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (actions) new ResizeObserver(updatePosition).observe(actions);
  addEventListener("resize", updatePosition, { passive: true });
  globalThis.GaiaMapHeadingNavigation = Object.freeze({ isActive: enabled });
  sync();
})();
