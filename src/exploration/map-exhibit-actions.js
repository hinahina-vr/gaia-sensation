let iconSerial = 0;
let unavailableTooltip = null;
const REALTIME_ANALYSIS_REASON = "リアルタイム表示では統計分析を利用できません。時系列・比較データの展示でご利用ください。";

// aria-disabled keeps the explanation discoverable by hover AND keyboard.
// Activation is blocked here, before any exhibit's dialog handler can run.
const disableRealtimeAnalysis = button => {
  if (!unavailableTooltip) {
    unavailableTooltip = document.createElement("div");
    unavailableTooltip.id = "map-analysis-unavailable-tooltip";
    unavailableTooltip.role = "tooltip";
    unavailableTooltip.textContent = REALTIME_ANALYSIS_REASON;
    unavailableTooltip.hidden = true;
    document.body.append(unavailableTooltip);
    const hide = () => { unavailableTooltip.hidden = true; };
    addEventListener("keydown", event => {
      if (event.key === "Escape" && !unavailableTooltip.hidden) {
        event.preventDefault(); event.stopImmediatePropagation(); hide();
      }
    }, { capture: true });
    addEventListener("resize", hide);
    for (const name of ["gaia:japan-mode-change", "gaia:live-exhibit-change", "gaia:estat-exhibit-change", "gaia:firms-change", "gaia:planet-signals-change"]) addEventListener(name, hide);
  }
  button.disabled = false;
  button.setAttribute("aria-disabled", "true");
  button.setAttribute("aria-label", "統計分析（リアルタイム表示では利用できません）");
  button.setAttribute("aria-describedby", unavailableTooltip.id);
  button.removeAttribute("aria-haspopup");
  button.removeAttribute("aria-controls");
  button.dataset.disabledReason = REALTIME_ANALYSIS_REASON;
  const show = () => {
    unavailableTooltip.hidden = false;
    const rect = button.getBoundingClientRect(), tip = unavailableTooltip.getBoundingClientRect();
    unavailableTooltip.style.left = `${Math.max(12, Math.min(innerWidth - tip.width - 12, rect.right - tip.width))}px`;
    unavailableTooltip.style.top = `${Math.max(12, Math.min(innerHeight - tip.height - 12, rect.top - tip.height - 10))}px`;
  };
  button.addEventListener("mouseenter", show);
  button.addEventListener("mouseleave", () => { if (document.activeElement !== button) unavailableTooltip.hidden = true; });
  button.addEventListener("focus", show);
  button.addEventListener("blur", () => { unavailableTooltip.hidden = true; });
  button.addEventListener("click", event => { event.preventDefault(); event.stopImmediatePropagation(); show(); }, { capture: true });
  button.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopImmediatePropagation(); show(); }
  }, { capture: true });
};

// Reuse the canonical 01–09 dock icons, including their gradient fills.
// All source actions open the in-page ledger; external links live inside it.
export const decorateMapActions = (container, source, analysis) => {
  container.classList.add("gaia-map-actions");
  container.setAttribute("aria-label", "データの出典と統計分析");
  for (const [button, kind, canonicalKind, kicker, label] of [
    [source, "source", "source", "出典", "データの出典"],
    [analysis, "analysis", "statistics", "分析", "統計分析"],
  ]) {
    button.className = `gaia-map-action gaia-map-action--${kind}`;
    const icon = document.createElement("i");
    icon.setAttribute("aria-hidden", "true");
    const svg = document.querySelector(`.map-command-dock > .map-dock-action--${canonicalKind} svg`)?.cloneNode(true);
    if (svg) {
      for (const definition of svg.querySelectorAll("[id]")) {
        const oldId = definition.id;
        definition.id = `map-exhibit-icon-${++iconSerial}`;
        for (const shape of svg.querySelectorAll("[fill]")) {
          if (shape.getAttribute("fill") === `url(#${oldId})`) shape.setAttribute("fill", `url(#${definition.id})`);
        }
      }
      icon.append(svg);
    }
    const copy = document.createElement("span");
    const small = document.createElement("small");
    small.textContent = kicker;
    const strong = document.createElement("strong");
    strong.textContent = label;
    copy.append(small, strong);
    button.replaceChildren(icon, copy);
    if (kind === "source") {
      button.setAttribute("aria-label", "データの出典をページ内に表示する");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "japan-data-panel");
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", () => document.querySelector("#japan-data-button")?.click());
    } else {
      button.setAttribute("aria-label", "現在の展示データを統計分析する");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "gaia-statistics-lab");
    }
  }
  if (container.closest(".gaia-live-exhibit-readout, .gaia-firms-readout, .gaia-planet-signals-readout")) disableRealtimeAnalysis(analysis);
};
