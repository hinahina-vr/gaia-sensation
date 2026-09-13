(() => {
  "use strict";

  const dock = document.querySelector("#gaia-audio-dock");
  const toggle = document.querySelector("#gaia-audio-toggle");
  const toggleIcon = document.querySelector("#gaia-audio-toggle-icon");
  const volume = document.querySelector("#gaia-audio-volume");
  const volumePanel = document.querySelector("#gaia-audio-volume-panel");
  const volumeValue = document.querySelector("#gaia-audio-volume-value");
  const audio = window.GaiaOpeningAudio;
  if (!(dock instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement) || !audio) return;

  const COLLAPSE_DELAY_MS = 6000;
  let collapseTimer = 0;

  const sync = (state = audio.getState()) => {
    const level = Math.round(Math.max(0, Math.min(1, state?.volume ?? 0.1)) * 100);
    const muted = state?.muted ?? true;
    const expanded = dock.classList.contains("is-expanded");
    if (volume instanceof HTMLInputElement) {
      volume.value = String(level);
      volume.tabIndex = expanded ? 0 : -1;
    }
    if (volumeValue) volumeValue.textContent = `${level}%`;
    dock.dataset.muted = String(muted);
    dock.dataset.expanded = String(expanded);
    toggle.setAttribute("aria-pressed", String(muted));
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", expanded ? (muted ? "BGMを再生" : "BGMを消音") : "音量調整を開く");
    volumePanel?.setAttribute("aria-hidden", String(!expanded));
    if (toggleIcon instanceof HTMLElement) toggleIcon.dataset.muted = String(muted);
  };

  const clearCollapse = () => {
    window.clearTimeout(collapseTimer);
    collapseTimer = 0;
  };

  const setExpanded = (expanded, { focusVolume = false } = {}) => {
    clearCollapse();
    const nextExpanded = Boolean(expanded);
    dock.classList.toggle("is-expanded", nextExpanded);
    sync();
    if (!nextExpanded) return;
    if (focusVolume && volume instanceof HTMLInputElement) {
      window.setTimeout(() => volume.focus({ preventScroll: true }), 260);
    }
    collapseTimer = window.setTimeout(() => setExpanded(false), COLLAPSE_DELAY_MS);
  };

  const scheduleCollapse = (delay = COLLAPSE_DELAY_MS) => {
    if (!dock.classList.contains("is-expanded")) return;
    clearCollapse();
    collapseTimer = window.setTimeout(() => setExpanded(false), delay);
  };

  toggle.addEventListener("click", async () => {
    if (!dock.classList.contains("is-expanded")) {
      setExpanded(true);
      return;
    }
    await audio.toggleMuted();
    sync();
    scheduleCollapse();
  });

  volume?.addEventListener("input", () => {
    if (!(volume instanceof HTMLInputElement)) return;
    const nextVolume = Number(volume.value) / 100;
    audio.setVolume(nextVolume);
    const state = audio.getState();
    if (nextVolume <= 0 && !state.muted) void audio.setMuted(true);
    else if (nextVolume > 0 && state.muted) void audio.setMuted(false);
    scheduleCollapse();
  });

  dock.addEventListener("pointerenter", clearCollapse);
  dock.addEventListener("pointerleave", () => scheduleCollapse(2200));
  dock.addEventListener("focusin", clearCollapse);
  dock.addEventListener("focusout", () => scheduleCollapse(2200));
  // Commit the outside click's target before collapsing an in-flow strip.
  // Collapsing on pointerdown can move that target before pointerup arrives.
  document.addEventListener("click", (event) => {
    if (!dock.classList.contains("is-expanded") || dock.contains(event.target)) return;
    setExpanded(false);
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !dock.classList.contains("is-expanded")) return;
    event.preventDefault();
    setExpanded(false);
    toggle.focus({ preventScroll: true });
  });
  window.addEventListener("gaia:audio-state", (event) => sync(event.detail));

  dock.hidden = false;
  sync();
  requestAnimationFrame(() => dock.classList.add("is-visible"));
  void audio.restoreNavigationState().then(() => sync());
})();
