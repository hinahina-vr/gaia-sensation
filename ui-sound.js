(() => {
  "use strict";

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const INTERACTIVE_SELECTOR = [
    "button",
    "a[href]",
    "[role='button']",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const BACK_PATTERN = /(close|back|return|reset|restart|skip|閉じ|戻る|消音|ミュート)/i;
  const MIN_HOVER_GAP_MS = 62;

  let context = null;
  let master = null;
  let lastHoverAt = 0;
  let lastPointerAt = 0;
  let hoveredInteractive = null;
  let prologueQuiet = false;
  window.addEventListener("gaia:story-prologue-audio", ({ detail }) => {
    prologueQuiet = Boolean(detail?.active);
    if (!master || !context) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(prologueQuiet ? 0 : 1, now + (prologueQuiet ? 1.35 : 0.35));
  });

  const getAudioState = () => window.GaiaOpeningAudio?.getState?.() || {
    volume: 0,
    muted: true,
  };

  const effectVolume = () => {
    const state = getAudioState();
    if (prologueQuiet || state.muted || state.volume <= 0) return 0;
    return Math.min(0.055, state.volume * 0.42);
  };

  const ensureContext = () => {
    if (!context) {
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = 1;
      master.connect(context.destination);
    }
    if (context.state === "suspended") void context.resume();
    return context;
  };

  const playTone = ({
    frequency,
    endFrequency = frequency,
    duration,
    delay = 0,
    level = 1,
    type = "sine",
  }) => {
    const volume = effectVolume();
    if (volume <= 0) return;
    const audioContext = ensureContext();
    const startsAt = audioContext.currentTime + delay;
    const endsAt = startsAt + duration;
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), startsAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endsAt);
    envelope.gain.setValueAtTime(0.0001, startsAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * level), startsAt + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(startsAt);
    oscillator.stop(endsAt + 0.025);
  };

  const playHover = () => {
    playTone({ frequency: 760, endFrequency: 1120, duration: 0.095, level: 0.34 });
    playTone({ frequency: 1520, endFrequency: 1900, duration: 0.07, delay: 0.012, level: 0.12 });
  };

  const playConfirm = () => {
    playTone({ frequency: 390, endFrequency: 520, duration: 0.13, level: 0.58 });
    playTone({ frequency: 650, endFrequency: 920, duration: 0.18, delay: 0.036, level: 0.42 });
  };

  const playBack = () => {
    playTone({ frequency: 560, endFrequency: 350, duration: 0.16, level: 0.5, type: "triangle" });
    playTone({ frequency: 840, endFrequency: 610, duration: 0.11, delay: 0.018, level: 0.18 });
  };

  const interactiveFrom = (target) => {
    if (!(target instanceof Element)) return null;
    const interactive = target.closest(INTERACTIVE_SELECTOR);
    if (!(interactive instanceof HTMLElement)) return null;
    if (interactive.dataset.uiSound === "none") return null;
    if (interactive.matches(":disabled, [aria-disabled='true']")) return null;
    return interactive;
  };

  const isBackControl = (interactive) => BACK_PATTERN.test([
    interactive.id,
    interactive.className,
    interactive.getAttribute("aria-label"),
    interactive.textContent,
  ].filter(Boolean).join(" "));

  // Layout changes can fire pointerover on a new control under a stationary
  // cursor after a click. Only real pointer movement should make a hover cue.
  document.addEventListener("pointermove", (event) => {
    lastPointerAt = performance.now();
    if (event.pointerType === "touch") return;
    const interactive = interactiveFrom(event.target);
    const previous = hoveredInteractive;
    hoveredInteractive = interactive;
    if (!interactive || interactive === previous) return;
    const now = performance.now();
    if (now - lastHoverAt < MIN_HOVER_GAP_MS || !context) return;
    lastHoverAt = now;
    playHover();
  }, { passive: true });

  // A pointer press can focus a button long after the pointer entered it.
  // That focus is part of the click, not a second keyboard-hover cue.
  document.addEventListener("pointerdown", (event) => {
    lastPointerAt = performance.now();
    hoveredInteractive = interactiveFrom(event.target);
  }, { capture: true, passive: true });

  document.addEventListener("focusin", (event) => {
    const interactive = interactiveFrom(event.target);
    if (!interactive || performance.now() - lastPointerAt < 320 || !context) return;
    playHover();
  });

  document.addEventListener("click", (event) => {
    // Proxy controls (including map arrows) call another button's .click().
    // Only the original user activation owns the sound; native Enter/Space
    // and touch clicks are trusted too. Do not time-debounce genuine repeats.
    if (!event.isTrusted) return;
    const interactive = interactiveFrom(event.target);
    if (!interactive) {
      const novelSurface = event.target instanceof Element
        ? event.target.closest("#novel-layer:not([hidden])")
        : null;
      if (novelSurface && effectVolume() > 0) playConfirm();
      return;
    }
    if (effectVolume() <= 0) return;
    ensureContext();
    if (isBackControl(interactive)) playBack();
    else playConfirm();
  }, { capture: true });
})();
