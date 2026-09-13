/**
 * 概要: 音の設定とオープニングから、物語／データ探索へ案内する。素材の準備とユーザー操作に合わせて表示を切り替える。
 */
(() => {
  "use strict";

  const opening = document.querySelector("#gaia-opening");
  const skipButton = document.querySelector("#gaia-opening-skip");
  const preloadPanel = document.querySelector("#gaia-opening-preload");
  const preloadPercent = document.querySelector("#gaia-preload-percent");
  const preloadBar = document.querySelector("#gaia-preload-bar");
  const preloadStatus = document.querySelector("#gaia-preload-status");
  const soundOnButton = document.querySelector("#gaia-opening-sound-on");
  const soundOffButton = document.querySelector("#gaia-opening-sound-off");
  const particleCanvas = document.querySelector("#gaia-opening-particles");
  const openingVolume = document.querySelector("#gaia-opening-volume");
  const openingVolumeValue = document.querySelector("#gaia-opening-volume-value");
  const audioDock = document.querySelector("#gaia-audio-dock");
  const audioToggle = document.querySelector("#gaia-audio-toggle");
  const audioToggleIcon = document.querySelector("#gaia-audio-toggle-icon");
  const audioVolume = document.querySelector("#gaia-audio-volume");
  const audioVolumePanel = document.querySelector("#gaia-audio-volume-panel");
  const audioVolumeValue = document.querySelector("#gaia-audio-volume-value");
  const finalMenu = document.querySelector("#gaia-opening-final-menu");
  const aboutNav = finalMenu?.querySelector(".gaia-opening-about");
  const desktopAboutMedia = window.matchMedia("(min-width: 961px) and (hover: hover) and (pointer: fine)");
  const syncAboutPlacement = () => {
    if (!opening || !finalMenu || !aboutNav) return;
    const destination = desktopAboutMedia.matches ? opening : finalMenu;
    if (aboutNav.parentElement === destination) return;
    const focusedLink = aboutNav.contains(document.activeElement) ? document.activeElement : null;
    // Move the same native link outside the transformed title lockup on PC.
    // Touch layouts keep their existing below-menu position and tab order.
    destination.append(aboutNav);
    focusedLink?.focus({ preventScroll: true });
  };
  syncAboutPlacement();
  desktopAboutMedia.addEventListener("change", syncAboutPlacement);
  const finalStoryButton = document.querySelector("#gaia-opening-route-story");
  const finalOtherButton = document.querySelector("#gaia-opening-route-other");
  const routeGuideReplay = document.querySelector("#gaia-opening-route-guide-replay");
  const soundModal = document.querySelector("#gaia-opening-sound-modal");
  const soundDialog = soundModal?.querySelector(".gaia-opening-sound-dialog");
  const languageButtons = Array.from(soundModal?.querySelectorAll("[data-gaia-language]") || []);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AUDIO_DOCK_COLLAPSE_DELAY_MS = 6000;
  let audioDockCollapseTimer = 0;
  let soundModalRevealTimer = 0;
  let soundModalHideTimer = 0;
  let soundModalOpen = false;
  let soundSetupConfirmed = false;
  let soundSetupSubmitting = false;
  let pendingSoundEnabled = true;
  const editableCopySelector = "input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only']";
  document.addEventListener("copy", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(editableCopySelector)) return;
    event.preventDefault();
  }, true);
  const signalInitialViewReady = () => {
    if (window.__gaiaInitialViewReady === true) return;
    window.__gaiaInitialViewReady = true;
    window.dispatchEvent(new CustomEvent("gaia:initial-view-ready"));
    window.__gaiaBootCheck?.();
  };
  const directDestination = ["#top", "#world", "#earth", "#japan", "#data", "#source", "#concept", "#sound", "#character", "#story", "#tour"].includes(
    window.location.hash,
  ) || globalThis.GaiaMapRoute.isMapHash(window.location.hash) || /\/story\/?$/i.test(window.location.pathname);
  const directMapAmbientDestination = globalThis.GaiaMapRoute.numberFromHash(window.location.hash) !== null || ["#world", "#japan", "#data", "#source"].includes(
    window.location.hash,
  );
  const directSensewareDestination = ["#top", "#earth", "#concept", "#tour"].includes(window.location.hash);
  const TITLE_RETURN_RESUME_KEY = "gaia:title-return-resume";
  const rememberTitleReturn = () => {
    try {
      sessionStorage.setItem(TITLE_RETURN_RESUME_KEY, "1");
    } catch (_error) {
      // Navigation still works when storage is unavailable; only the fast
      // return to the final title menu is skipped.
    }
  };
  const takeTitleReturn = () => {
    try {
      const requested = sessionStorage.getItem(TITLE_RETURN_RESUME_KEY) === "1";
      sessionStorage.removeItem(TITLE_RETURN_RESUME_KEY);
      return requested;
    } catch (_error) {
      return false;
    }
  };
  const resumeAtTitleMenu = !directDestination && takeTitleReturn();
  document.querySelector("#gaia-opening-concept")?.addEventListener("click", (event) => {
    // Keep native link navigation, including modified clicks/new tabs. A normal
    // visit can return directly to the title instead of replaying the opening.
    if (event.currentTarget.target !== "_blank" && !event.defaultPrevented && event.button === 0
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) rememberTitleReturn();
  });

  const syncAudioControls = (state = window.GaiaOpeningAudio?.getState?.()) => {
    const volume = Math.round(Math.max(0, Math.min(1, state?.volume ?? 0.1)) * 100);
    const isMuted = state?.muted ?? true;
    const controlSoundEnabled = soundModalOpen ? pendingSoundEnabled : !isMuted;
    if (openingVolume instanceof HTMLInputElement) {
      openingVolume.value = String(volume);
      openingVolume.style.setProperty("--volume-fill", `${volume}%`);
    }
    if (audioVolume instanceof HTMLInputElement) audioVolume.value = String(volume);
    if (openingVolumeValue) openingVolumeValue.textContent = `${volume}%`;
    if (audioVolumeValue) audioVolumeValue.textContent = `${volume}%`;
    soundOnButton?.setAttribute("aria-pressed", String(controlSoundEnabled));
    soundOffButton?.setAttribute("aria-pressed", String(!controlSoundEnabled));
    if (audioDock) audioDock.dataset.muted = String(isMuted);
    if (audioToggle) {
      audioToggle.setAttribute("aria-pressed", String(isMuted));
      const isExpanded = audioDock?.classList.contains("is-expanded") ?? false;
      audioToggle.setAttribute("aria-expanded", String(isExpanded));
      audioToggle.setAttribute("aria-label", isExpanded
        ? (isMuted ? "BGMを再生" : "BGMを消音")
        : "音量調整を開く");
      audioVolumePanel?.setAttribute("aria-hidden", String(!isExpanded));
      if (audioVolume instanceof HTMLInputElement) audioVolume.tabIndex = isExpanded ? 0 : -1;
    }
    if (audioToggleIcon) audioToggleIcon.dataset.muted = String(isMuted);
  };

  const LANGUAGE_STORAGE_KEY = "gaia:language:v1";
  const SUPPORTED_LANGUAGES = new Set(["ja", "en", "zh-CN"]);
  const readLanguagePreference = () => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return SUPPORTED_LANGUAGES.has(saved) ? saved : "ja";
    } catch {
      return "ja";
    }
  };
  const setLanguagePreference = (language, { persist = true, notify = true } = {}) => {
    if (window.GaiaI18n) return window.GaiaI18n.set(language, { persist, notify });
    const nextLanguage = SUPPORTED_LANGUAGES.has(language) ? language : "ja";
    document.documentElement.lang = nextLanguage;
    document.documentElement.dataset.gaiaLanguageCurrent = nextLanguage;
    languageButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.gaiaLanguage === nextLanguage));
    });
    if (persist) {
      try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage); }
      catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
    }
    if (notify) {
      window.dispatchEvent(new CustomEvent("gaia:language-change", { detail: { language: nextLanguage } }));
    }
    return nextLanguage;
  };
  setLanguagePreference(readLanguagePreference(), { persist: false, notify: false });
  languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguagePreference(button.dataset.gaiaLanguage));
  });
  window.GaiaLanguagePreference = Object.freeze({
    get: () => document.documentElement.dataset.gaiaLanguageCurrent || "ja",
    set: (language) => setLanguagePreference(language),
  });

  const revealAudioDock = () => {
    if (!audioDock) return;
    audioDock.hidden = false;
    audioDock.classList.remove("is-expanded");
    audioDock.dataset.expanded = "false";
    requestAnimationFrame(() => audioDock.classList.add("is-visible"));
  };

  const clearAudioDockCollapse = () => {
    window.clearTimeout(audioDockCollapseTimer);
    audioDockCollapseTimer = 0;
  };

  const setAudioDockExpanded = (expanded, { focusVolume = false } = {}) => {
    if (!audioDock) return;
    clearAudioDockCollapse();
    const nextExpanded = Boolean(expanded);
    audioDock.classList.toggle("is-expanded", nextExpanded);
    audioDock.dataset.expanded = String(nextExpanded);
    syncAudioControls();
    if (nextExpanded) {
      if (focusVolume) window.setTimeout(() => audioVolume?.focus({ preventScroll: true }), 260);
      audioDockCollapseTimer = window.setTimeout(() => setAudioDockExpanded(false), AUDIO_DOCK_COLLAPSE_DELAY_MS);
    }
  };

  const scheduleAudioDockCollapse = (delay = AUDIO_DOCK_COLLAPSE_DELAY_MS) => {
    if (!audioDock?.classList.contains("is-expanded")) return;
    clearAudioDockCollapse();
    audioDockCollapseTimer = window.setTimeout(() => setAudioDockExpanded(false), delay);
  };

  const setVolumeFromInput = (input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const nextVolume = Number(input.value) / 100;
    window.GaiaOpeningAudio?.setVolume?.(nextVolume);
    if (input === audioVolume) {
      const state = window.GaiaOpeningAudio?.getState?.();
      if (nextVolume <= 0 && !state?.muted) void window.GaiaOpeningAudio?.setMuted?.(true);
      else if (nextVolume > 0 && state?.muted) void window.GaiaOpeningAudio?.setMuted?.(false);
      scheduleAudioDockCollapse();
    }
  };

  openingVolume?.addEventListener("input", () => setVolumeFromInput(openingVolume));
  audioVolume?.addEventListener("input", () => setVolumeFromInput(audioVolume));
  audioToggle?.addEventListener("click", async () => {
    if (!audioDock?.classList.contains("is-expanded")) {
      setAudioDockExpanded(true);
      return;
    }
    await window.GaiaOpeningAudio?.toggleMuted?.();
    syncAudioControls();
    scheduleAudioDockCollapse();
  });
  audioDock?.addEventListener("pointerenter", clearAudioDockCollapse);
  audioDock?.addEventListener("pointerleave", () => scheduleAudioDockCollapse(2200));
  audioDock?.addEventListener("focusin", clearAudioDockCollapse);
  audioDock?.addEventListener("focusout", () => scheduleAudioDockCollapse(2200));
  document.addEventListener("pointerdown", (event) => {
    if (!audioDock?.classList.contains("is-expanded") || audioDock.contains(event.target)) return;
    setAudioDockExpanded(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !audioDock?.classList.contains("is-expanded")) return;
    event.preventDefault();
    setAudioDockExpanded(false);
    audioToggle?.focus({ preventScroll: true });
  });
  window.addEventListener("gaia:audio-state", (event) => syncAudioControls(event.detail));
  syncAudioControls();

  if (!opening) {
    revealAudioDock();
    signalInitialViewReady();
    return;
  }
  let openingUi = null;
  let titleReturnRunning = false;
  const fadeTitleCover = async (cover, from, to, duration) => {
    const animation = cover.animate([{ opacity: from }, { opacity: to }], {
      duration, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards",
    });
    await animation.finished;
    cover.style.opacity = String(to);
    animation.cancel();
  };
  const returnWithDissolve = async (event) => {
    if (titleReturnRunning || !opening.hidden) return;
    titleReturnRunning = true;
    const surface = document.querySelector(".experience");
    const wasInert = surface?.inert || false;
    const previousFocus = document.activeElement;
    const cover = document.createElement("div");
    cover.id = "gaia-title-return-transition";
    cover.dataset.phase = "cover";
    cover.setAttribute("role", "status");
    cover.setAttribute("aria-label", "タイトルへ戻っています");
    cover.tabIndex = -1;
    document.body.append(cover);
    document.body.classList.add("gaia-title-returning");
    cover.focus({ preventScroll: true });
    if (surface) surface.inert = true;
    let committed = false;
    try {
      // Direct #top entries keep the title controller lazy. Initialize it on
      // this first return, without reloading the app or replaying its boot gate.
      const title = initializeOpening();
      const ready = title.prepare();
      await fadeTitleCover(cover, 0, 1, reducedMotion ? 70 : 560);
      cover.dataset.phase = "hold";
      await Promise.all([ready, new Promise(resolve => setTimeout(resolve, reducedMotion ? 0 : 100))]);
      event.detail?.onCovered?.();
      title.show();
      committed = true;
      // The first complete title frame is painted behind the opaque cover.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      cover.dataset.phase = "reveal";
      await fadeTitleCover(cover, 1, 0, reducedMotion ? 130 : 1000);
    } catch (error) {
      console.error("Title return transition failed", error);
    } finally {
      cover.remove();
      if (surface) surface.inert = wasInert;
      document.body.classList.remove("gaia-title-returning");
      titleReturnRunning = false;
      if (committed) openingUi?.release();
      else previousFocus?.focus({ preventScroll: true });
    }
  };
  window.addEventListener("gaia:return-to-title", event => { void returnWithDissolve(event); });
  window.addEventListener("keydown", event => {
    if (!titleReturnRunning || !["Escape", "Enter", " ", "Tab", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  if (directDestination) {
    // Direct hashes mount their lazy destination after this opening layer is
    // removed. Keep the abstract WebGL base suppressed for that whole gap.
    document.body.classList.add("gaia-route-handoff");
    opening.hidden = true;
    document.body.classList.remove("gaia-opening-active");
    const destinationTrack = directMapAmbientDestination
      ? "mapambient"
      : (directSensewareDestination ? "senseware" : null);
    void (async () => {
      const restored = await window.GaiaOpeningAudio?.restoreNavigationState?.(destinationTrack);
      if (!restored?.restored && destinationTrack) {
        await window.GaiaOpeningAudio?.switchTrack?.(destinationTrack, 0);
      }
    })();
    revealAudioDock();
    if (document.documentElement.dataset.gaiaAppReady === "true") signalInitialViewReady();
    else {
      window.addEventListener("gaia:app-ready", signalInitialViewReady, { once: true });
      window.setTimeout(signalInitialViewReady, 12000);
    }
    return;
  }

  document.body.classList.add("gaia-opening-active");
  initializeOpening({ initial: true });

  function initializeOpening({ initial = false } = {}) {
  if (openingUi) return openingUi;
  const finalCopy = opening.querySelector(".gaia-vn-panel-final .gaia-vn-final-copy");
  const routeHoverMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
  const routeGuideSteps = [
    {
      target: finalStoryButton,
      copy: ["ビジュアルノベル風の", "ストーリーを読みながら、", "インタラクティブに", "展示の世界を楽しめます。"],
    },
    {
      target: finalOtherButton,
      copy: ["気候変動や観測ポイントを、", "インタラクティブな地図上で", "探索・分析できます。"],
    },
  ].filter((step) => step.target instanceof HTMLButtonElement);
  const replayRouteGlint = (target) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // A selection owns one reflection. Re-entry must start a new animation,
    // independently of a lingering focus state or the menu's entrance.
    target.classList.remove("is-route-glint");
    void target.offsetWidth;
    target.classList.add("is-route-glint");
  };
  const routeGuideLayer = document.createElement("section");
  routeGuideLayer.className = "gaia-opening-route-guide";
  routeGuideLayer.id = "gaia-opening-route-guide";
  routeGuideLayer.hidden = true;
  routeGuideLayer.inert = true;
  routeGuideLayer.setAttribute("aria-hidden", "true");
  routeGuideLayer.setAttribute("role", "dialog");
  routeGuideLayer.setAttribute("aria-modal", "false");
  routeGuideLayer.setAttribute("aria-label", "入口ガイド");
  routeGuideLayer.setAttribute("aria-describedby", "gaia-opening-route-guide-copy");
  routeGuideLayer.tabIndex = 0;
  routeGuideLayer.innerHTML = `
    <div class="gaia-opening-route-guide-shade" aria-hidden="true"></div>
    <article class="gaia-opening-route-guide-bubble" aria-live="polite" aria-atomic="true">
      <div class="gaia-opening-route-guide-surface">
        <h2 data-route-guide-title hidden></h2>
        <p id="gaia-opening-route-guide-copy" data-route-guide-copy></p>
      </div>
    </article>`;
  opening.append(routeGuideLayer);

  const routeGuideShade = routeGuideLayer.querySelector(".gaia-opening-route-guide-shade");
  const routeGuideBubble = routeGuideLayer.querySelector(".gaia-opening-route-guide-bubble");
  const ROUTE_GUIDE_AUTO_DELAY_MS = 3000;
  let routeGuideActive = false;
  let routeGuideIndex = 0;
  let routeGuidePositionFrame = 0;
  let routeGuideRevealFrame = 0;
  let routeGuideCloseTimer = 0;
  let gatewayLayoutFrame = 0;
  let routeGuideStartTimer = 0;
  let routeHintActive = false;
  let routeHintPointerTarget = null;
  let routeHintFocusTarget = null;
  let routeHintBubbleHovered = false;
  let routeHintDismissedTarget = null;
  let routeHintCloseTimer = 0;
  const routeDescriptions = new Map(routeGuideSteps.map(({ target }) => [target, target.getAttribute("aria-describedby")]));

  const clearRouteGuideTarget = () => {
    routeGuideSteps.forEach(({ target }) => {
      target.classList.remove("is-route-guide-target");
      const description = routeDescriptions.get(target);
      if (description === null) target.removeAttribute("aria-describedby");
      else target.setAttribute("aria-describedby", description);
    });
  };

  const positionRouteGuideBubble = () => {
    routeGuidePositionFrame = 0;
    if (!routeGuideActive || !(routeGuideBubble instanceof HTMLElement)) return;
    const target = routeGuideSteps[routeGuideIndex]?.target;
    if (!(target instanceof HTMLElement) || target.getClientRects().length === 0) return;
    const targetRect = target.getBoundingClientRect();
    if (routeGuideShade instanceof HTMLElement) {
      const targetStyle = getComputedStyle(target);
      routeGuideShade.style.setProperty("--route-guide-focus-left", `${targetRect.left}px`);
      routeGuideShade.style.setProperty("--route-guide-focus-top", `${targetRect.top}px`);
      routeGuideShade.style.setProperty("--route-guide-focus-width", `${targetRect.width}px`);
      routeGuideShade.style.setProperty("--route-guide-focus-height", `${targetRect.height}px`);
      routeGuideShade.style.setProperty("--route-guide-focus-radius", targetStyle.borderRadius);
    }
    const bubbleRect = routeGuideBubble.getBoundingClientRect();
    const gutter = 18;
    const viewportInset = 12;
    const preferredLeft = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2;
    const left = Math.max(viewportInset, Math.min(innerWidth - bubbleRect.width - viewportInset, preferredLeft));
    const below = targetRect.bottom + gutter;
    const above = targetRect.top - bubbleRect.height - gutter;
    const placeBelow = below + bubbleRect.height <= innerHeight - viewportInset;
    const top = placeBelow
      ? below
      : Math.max(viewportInset, above);
    const arrowLeft = Math.max(22, Math.min(bubbleRect.width - 22, targetRect.left + targetRect.width / 2 - left));
    routeGuideBubble.style.left = `${Math.round(left)}px`;
    routeGuideBubble.style.top = `${Math.round(top)}px`;
    routeGuideBubble.style.setProperty("--route-guide-arrow-left", `${Math.round(arrowLeft)}px`);
    routeGuideBubble.dataset.placement = placeBelow ? "below" : "above";
    // A real pointer can enter before the menu/cards finish moving. Follow
    // their finite transform transitions, then stop; a one-time measurement
    // otherwise leaves the tooltip stranded at the entrance's old position.
    const targetIsMoving = finalMenu.getAnimations({ subtree: true }).some(animation => (
      animation.transitionProperty === "transform" && (animation.playState === "running" || animation.pending)
    ));
    if (targetIsMoving) routeGuidePositionFrame = requestAnimationFrame(positionRouteGuideBubble);
  };

  const scheduleRouteGuidePosition = () => {
    cancelAnimationFrame(routeGuidePositionFrame);
    routeGuidePositionFrame = requestAnimationFrame(() => {
      routeGuidePositionFrame = requestAnimationFrame(positionRouteGuideBubble);
    });
  };

  const syncFinalGatewayPlacement = () => {
    gatewayLayoutFrame = 0;
    if (!(finalCopy instanceof HTMLElement) || !(finalMenu instanceof HTMLElement)) return;
    finalCopy.style.removeProperty("--opening-gateway-top");
    finalCopy.style.removeProperty("--opening-gateway-offset");
    scheduleRouteGuidePosition();
  };

  const scheduleFinalGatewayPlacement = () => {
    cancelAnimationFrame(gatewayLayoutFrame);
    gatewayLayoutFrame = requestAnimationFrame(syncFinalGatewayPlacement);
  };

  const setRouteGuideStep = (nextIndex) => {
    if (!routeGuideActive || routeGuideSteps.length === 0) return;
    cancelAnimationFrame(routeGuideRevealFrame);
    routeGuideLayer.classList.remove("is-presented");
    routeGuideIndex = Math.max(0, Math.min(routeGuideSteps.length - 1, nextIndex));
    clearRouteGuideTarget();
    const step = routeGuideSteps[routeGuideIndex];
    if (routeHintActive) {
      step.target.setAttribute("aria-describedby", [routeDescriptions.get(step.target), "gaia-opening-route-guide-copy"].filter(Boolean).join(" "));
    } else {
      routeGuideSteps.forEach(({ target }) => target.classList.remove("is-route-glint"));
      step.target.classList.add("is-route-guide-target");
      replayRouteGlint(step.target);
    }
    const title = routeGuideLayer.querySelector("[data-route-guide-title]");
    title.textContent = step.title || "";
    title.hidden = !step.title;
    const guideCopy = routeGuideLayer.querySelector("[data-route-guide-copy]");
    // Bind the complete sentence before layout; translating individual Japanese
    // wrapping fragments cannot preserve English or Chinese sentence order.
    if (globalThis.GaiaI18n) globalThis.GaiaI18n.bind(guideCopy, step.copy.join(""));
    else guideCopy.textContent = step.copy.join("");
    routeGuideLayer.dataset.step = String(routeGuideIndex + 1);
    // Measure an untransformed wrapper before revealing its animated surface.
    // The layout read also resets the one-shot entrance for every new step.
    cancelAnimationFrame(routeGuidePositionFrame);
    positionRouteGuideBubble();
    routeGuideRevealFrame = requestAnimationFrame(() => {
      routeGuideRevealFrame = 0;
      if (routeGuideActive) routeGuideLayer.classList.add("is-visible", "is-presented");
    });
    scheduleRouteGuidePosition();
  };

  const closeRouteGuide = ({ restoreFocus = true } = {}) => {
    const wasHint = routeHintActive;
    window.clearTimeout(routeHintCloseTimer);
    routeHintCloseTimer = 0;
    window.clearTimeout(routeGuideStartTimer);
    routeGuideStartTimer = 0;
    routeGuideActive = false;
    routeHintActive = false;
    cancelAnimationFrame(routeGuideRevealFrame);
    cancelAnimationFrame(routeGuidePositionFrame);
    routeGuideRevealFrame = 0;
    routeGuidePositionFrame = 0;
    clearRouteGuideTarget();
    routeGuideSteps.forEach(({ target }) => target.classList.remove("is-route-glint"));
    opening.classList.remove("is-route-guide-active");
    routeGuideLayer.classList.remove("is-visible");
    routeGuideLayer.inert = true;
    routeGuideLayer.setAttribute("aria-hidden", "true");
    window.clearTimeout(routeGuideCloseTimer);
    routeGuideCloseTimer = window.setTimeout(() => {
      routeGuideCloseTimer = 0;
      if (!routeGuideActive) {
        routeGuideLayer.hidden = true;
        routeGuideLayer.classList.remove("is-presented");
      }
    }, reducedMotion ? 0 : 220);
    if (restoreFocus && !wasHint) finalStoryButton?.focus({ preventScroll: true });
  };

  const openRouteGuide = () => {
    if (routeHoverMedia.matches || routeGuideActive || routeGuideSteps.length === 0 || finished) return;
    window.clearTimeout(routeGuideCloseTimer);
    routeGuideCloseTimer = 0;
    routeGuideLayer.dataset.openedAt = performance.now().toFixed(3);
    routeGuideActive = true;
    routeHintActive = false;
    routeGuideLayer.classList.remove("is-route-tooltip");
    routeGuideLayer.setAttribute("role", "dialog");
    routeGuideLayer.setAttribute("aria-modal", "false");
    routeGuideLayer.tabIndex = 0;
    routeGuideLayer.hidden = false;
    routeGuideLayer.inert = false;
    routeGuideLayer.setAttribute("aria-hidden", "false");
    opening.classList.add("is-route-guide-active");
    setRouteGuideStep(0);
    routeGuideLayer.focus({ preventScroll: true });
  };

  const maybeStartRouteGuide = () => {
    window.clearTimeout(routeGuideStartTimer);
    routeGuideStartTimer = window.setTimeout(() => {
      finalMenu.dataset.revealCompleteAt = performance.now().toFixed(3);
      routeGuideStartTimer = 0;
      if (!routeHoverMedia.matches) openRouteGuide();
    }, ROUTE_GUIDE_AUTO_DELAY_MS);
  };

  const advanceRouteGuide = () => {
    if (!routeGuideActive) return;
    if (routeGuideIndex >= routeGuideSteps.length - 1) closeRouteGuide();
    else setRouteGuideStep(routeGuideIndex + 1);
  };

  routeGuideLayer.addEventListener("click", (event) => {
    if (!routeGuideActive || routeHintActive) return;
    event.preventDefault();
    advanceRouteGuide();
  });
  routeGuideLayer.addEventListener("keydown", (event) => {
    if (!routeGuideActive || routeHintActive) return;
    if (event.key === "Escape") { event.preventDefault(); closeRouteGuide(); }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); advanceRouteGuide(); }
  });
  // A pointer-only hint can be open while focus is on body (e.g. reduced
  // motion). Listen at document level without moving focus into the tooltip.
  document.addEventListener("keydown", (event) => {
    if (!routeGuideActive || event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (routeHintActive) routeHintDismissedTarget = routeGuideSteps[routeGuideIndex]?.target;
      closeRouteGuide();
    }
  });
  routeGuideReplay?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openRouteGuide();
  });
  const showRouteHint = (target) => {
    if (!routeHoverMedia.matches || finished || finalMenu.hidden || finalMenu.inert
      || !finalMenu.classList.contains("is-visible") || target === routeHintDismissedTarget) return;
    const index = routeGuideSteps.findIndex(step => step.target === target);
    if (index < 0) return;
    window.clearTimeout(routeHintCloseTimer);
    if (routeHintActive && routeGuideIndex === index) return;
    window.clearTimeout(routeGuideCloseTimer);
    routeGuideCloseTimer = 0;
    routeGuideActive = true;
    routeHintActive = true;
    routeGuideLayer.hidden = false;
    routeGuideLayer.inert = false;
    routeGuideLayer.classList.add("is-route-tooltip");
    routeGuideLayer.setAttribute("role", "tooltip");
    routeGuideLayer.removeAttribute("aria-modal");
    routeGuideLayer.setAttribute("aria-hidden", "false");
    routeGuideLayer.tabIndex = -1;
    routeGuideLayer.dataset.openedAt = performance.now().toFixed(3);
    setRouteGuideStep(index);
  };
  const syncRouteHint = () => {
    const target = routeHintPointerTarget || routeHintFocusTarget;
    if (target) showRouteHint(target);
    else if (!routeHintBubbleHovered) {
      window.clearTimeout(routeHintCloseTimer);
      // Let the pointer cross the speech bubble's small gap without dismissing it.
      routeHintCloseTimer = window.setTimeout(() => {
        if (routeHintActive && !routeHintPointerTarget && !routeHintFocusTarget && !routeHintBubbleHovered) {
          closeRouteGuide({ restoreFocus: false });
        }
      }, 220);
    }
  };
  for (const { target } of routeGuideSteps) {
    target.addEventListener("pointerenter", event => {
      if (event.pointerType === "touch") return;
      replayRouteGlint(target);
      routeHintPointerTarget = target;
      routeHintDismissedTarget = null;
      syncRouteHint();
    });
    target.addEventListener("pointerleave", () => {
      if (!target.matches(":focus-visible")) target.classList.remove("is-route-glint");
      if (routeHintPointerTarget === target) routeHintPointerTarget = null;
      syncRouteHint();
    });
    target.addEventListener("focus", () => {
      if (!target.matches(":focus-visible")) return;
      replayRouteGlint(target);
      routeHintFocusTarget = target;
      routeHintDismissedTarget = null;
      syncRouteHint();
    });
    target.addEventListener("blur", () => {
      if (!target.matches(":hover")) target.classList.remove("is-route-glint");
      if (routeHintFocusTarget === target) routeHintFocusTarget = null;
      syncRouteHint();
    });
    target.addEventListener("animationend", event => {
      if (event.animationName === "opening-route-focus-flash") target.classList.remove("is-route-glint");
    });
  }
  routeGuideBubble.addEventListener("pointerenter", () => {
    routeHintBubbleHovered = true;
    window.clearTimeout(routeHintCloseTimer);
  });
  routeGuideBubble.addEventListener("pointerleave", () => {
    routeHintBubbleHovered = false;
    syncRouteHint();
  });
  const syncRouteHelpMode = () => {
    if (routeGuideReplay) routeGuideReplay.hidden = routeHoverMedia.matches;
    finalMenu.dataset.routeHelpMode = routeHoverMedia.matches ? "hover" : "guide";
    routeHintPointerTarget = null;
    routeHintFocusTarget = null;
    routeHintBubbleHovered = false;
    routeHintDismissedTarget = null;
  };
  syncRouteHelpMode();
  routeHoverMedia.addEventListener("change", () => {
    closeRouteGuide({ restoreFocus: false });
    syncRouteHelpMode();
  });
  window.addEventListener("resize", scheduleFinalGatewayPlacement, { passive: true });

  const OPENING_TIME_SCALE = 1.275;
  const openingMs = (value) => Math.round(value * OPENING_TIME_SCALE);
  // The final title panel starts here. Reveal its two destinations with the
  // title itself instead of leaving a several-second title-only dead zone.
  const FINAL_MENU_REVEAL_DELAY = openingMs(13100);
  const EXIT_DURATION = openingMs(1440);
  const STORY_FADE_IN_LEAD_MS = 720;
  const compactArtwork = (Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 4)
    || (Number(navigator.hardwareConcurrency) > 0 && Number(navigator.hardwareConcurrency) <= 4);
  document.documentElement.dataset.gaiaArtworkQuality = compactArtwork ? "compact" : "full";
  const artworkSource = (path) => compactArtwork ? path.replace(/\.webp$/u, "-834.webp") : path;
  const OPENING_ART = [
    "./assets/opening-selected-20260912/opening-mizu-01.webp",
    "./assets/opening-selected-20260912/opening-ame-01.webp",
    "./assets/opening-selected-20260912/opening-prologue-01.webp",
    "./assets/visuals-07/open-data-archive-bg-v1.webp",
  ].map(artworkSource);
  const focusTargets = Array.from(opening.querySelectorAll("[data-opening-focus]"));
  focusTargets.forEach((target) => target.classList.add("is-opening-focus-pending"));
  const textTimers = [];
  let finishTimer = 0;
  let exitTimer = 0;
  let finished = false;
  let finishRequested = false;
  let openingStarted = false;
  let preloadReady = false;
  let preloadStarted = false;
  let artPreloadPromise = null;
  let audioPreloadPromise = null;
  let preloadAssetCount = OPENING_ART.length;
  let settledPreloads = 0;
  let preloadPanelShownAt = 0;
  let preloadRevealTimer = 0;
  let openingArtWarmTimer = 0;
  let preloadLabel = "オープニングの光と人物";
  if (preloadPanel instanceof HTMLElement) preloadPanel.hidden = true;

  const createOpeningParticles = (canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { start() {}, stop() {} };
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return { start() {}, stop() {} };

    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let running = false;
    let lastTime = 0;
    let motes = [];
    let streams = [];
    let glows = [];

    const random = (min, max) => min + Math.random() * (max - min);

    const makeMote = (fromBottom = false) => ({
      x: random(-40, width + 40),
      y: fromBottom ? height + random(0, 100) : random(-30, height + 30),
      radius: random(0.45, 1.75),
      vx: random(0.018, 0.085),
      vy: random(-0.105, -0.025),
      phase: random(0, Math.PI * 2),
      pulse: random(0.0007, 0.0018),
      alpha: random(0.18, 0.6),
      hueOffset: random(-18, 22),
    });

    const makeStream = (fromBottom = false) => ({
      x: random(-width * 0.08, width * 1.08),
      y: fromBottom ? height + random(20, 160) : random(0, height),
      speed: random(0.035, 0.11),
      drift: random(0.012, 0.055),
      width: random(0.55, 1.3),
      length: Math.round(random(12, 28)),
      phase: random(0, Math.PI * 2),
      amplitude: random(7, 24),
      frequency: random(0.00035, 0.0008),
      hueOffset: random(-10, 28),
      trail: [],
    });

    const rebuild = () => {
      const compact = width < 720;
      const area = Math.max(1, (width * height) / 150000);
      const moteCount = Math.min(compact ? 34 : 76, Math.max(compact ? 22 : 42, Math.round(area * 10)));
      const streamCount = compact ? 4 : 8;
      motes = Array.from({ length: moteCount }, () => makeMote());
      streams = Array.from({ length: streamCount }, () => makeStream());
      glows = Array.from({ length: compact ? 2 : 4 }, (_, index) => ({
        x: width * random(0.08, 0.92),
        y: height * random(0.12, 0.88),
        radius: Math.max(width, height) * random(0.11, 0.24),
        phase: index * 1.7 + random(0, 1),
        drift: random(0.00008, 0.0002),
      }));
    };

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      rebuild();
    };

    const draw = (time) => {
      if (!running) return;
      const delta = Math.min(34, Math.max(0, time - (lastTime || time)));
      lastTime = time;
      const hue = 181 + Math.sin(time * 0.00016) * 12;

      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";

      glows.forEach((glow) => {
        const x = glow.x + Math.sin(time * glow.drift + glow.phase) * width * 0.055;
        const y = glow.y + Math.cos(time * glow.drift * 0.74 + glow.phase) * height * 0.045;
        const pulse = 0.86 + Math.sin(time * 0.00042 + glow.phase) * 0.14;
        const radius = glow.radius * pulse;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `hsla(${hue + 8}, 74%, 73%, 0.042)`);
        gradient.addColorStop(0.42, `hsla(${hue}, 72%, 58%, 0.018)`);
        gradient.addColorStop(1, `hsla(${hue - 8}, 70%, 40%, 0)`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      });

      motes.forEach((mote, index) => {
        mote.x += mote.vx * delta;
        mote.y += mote.vy * delta;
        if (mote.y < -24 || mote.x > width + 30) Object.assign(mote, makeMote(true), { x: random(-40, width * 0.82) });
        const pulse = 0.52 + Math.sin(time * mote.pulse + mote.phase) * 0.48;
        const alpha = mote.alpha * (0.36 + pulse * 0.64);
        const radius = mote.radius * (0.75 + pulse * 0.55);
        context.shadowColor = `hsla(${hue + mote.hueOffset}, 92%, 82%, ${alpha})`;
        context.shadowBlur = radius * 7;
        context.fillStyle = `hsla(${hue + mote.hueOffset}, 86%, ${index % 7 === 0 ? 92 : 76}%, ${alpha})`;
        context.beginPath();
        context.arc(mote.x, mote.y, radius, 0, Math.PI * 2);
        context.fill();
      });

      context.shadowBlur = 0;
      streams.forEach((stream) => {
        stream.y -= stream.speed * delta;
        stream.x += stream.drift * delta;
        const wave = Math.sin(time * stream.frequency + stream.phase) * stream.amplitude;
        stream.trail.push({ x: stream.x + wave, y: stream.y });
        if (stream.trail.length > stream.length) stream.trail.shift();
        if (stream.y < -80 || stream.x > width + 100) Object.assign(stream, makeStream(true));
        if (stream.trail.length < 3) return;

        const gradient = context.createLinearGradient(
          stream.trail[0].x,
          stream.trail[0].y,
          stream.trail[stream.trail.length - 1].x,
          stream.trail[stream.trail.length - 1].y,
        );
        gradient.addColorStop(0, `hsla(${hue + stream.hueOffset}, 86%, 70%, 0)`);
        gradient.addColorStop(0.62, `hsla(${hue + stream.hueOffset}, 88%, 76%, 0.12)`);
        gradient.addColorStop(1, `hsla(${hue + stream.hueOffset}, 96%, 92%, 0.42)`);
        context.strokeStyle = gradient;
        context.lineWidth = stream.width;
        context.beginPath();
        context.moveTo(stream.trail[0].x, stream.trail[0].y);
        for (let index = 1; index < stream.trail.length; index += 1) {
          const previous = stream.trail[index - 1];
          const current = stream.trail[index];
          context.quadraticCurveTo(
            previous.x,
            previous.y,
            (previous.x + current.x) * 0.5,
            (previous.y + current.y) * 0.5,
          );
        }
        context.stroke();
      });

      context.restore();
      frame = requestAnimationFrame(draw);
    };

    return {
      start() {
        if (running) return;
        running = true;
        resize();
        window.addEventListener("resize", resize, { passive: true });
        frame = requestAnimationFrame(draw);
      },
      stop() {
        running = false;
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        context.clearRect(0, 0, width, height);
      },
    };
  };

  const particleSystem = window.GaiaParticles?.create?.(particleCanvas, {
    variant: "opening",
    intensity: 1,
  }) || createOpeningParticles(particleCanvas);

  // A small, separate field for the sound entrance. It is retired before the
  // opening particles start, so the two scenes never keep competing draw loops.
  const createSoundAtmosphere = (canvas) => {
    const noop = { start() {}, stop() {} };
    if (!(canvas instanceof HTMLCanvasElement)) return noop;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      canvas.dataset.state = "unsupported";
      return noop;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let calmMotion = motion.matches;
    const random = (min, max) => min + Math.random() * (max - min);
    const colors = ["183, 225, 204", "157, 199, 224", "230, 214, 170"];
    const sprites = colors.map((color) => {
      const sprite = document.createElement("canvas");
      sprite.width = sprite.height = 96;
      const brush = sprite.getContext("2d");
      if (!brush) return null;
      const glow = brush.createRadialGradient(48, 48, 0, 48, 48, 48);
      glow.addColorStop(0, `rgba(${color}, .9)`);
      glow.addColorStop(.12, `rgba(${color}, .44)`);
      glow.addColorStop(.4, `rgba(${color}, .12)`);
      glow.addColorStop(1, `rgba(${color}, 0)`);
      brush.fillStyle = glow;
      brush.fillRect(0, 0, 96, 96);
      return sprite;
    });
    let active = false;
    let frame = 0;
    let startedAt = 0;
    let lastPaint = 0;
    let frames = 0;
    let width = 1;
    let height = 1;
    let motes = [];
    const pointer = { x: .5, y: .5, targetX: .5, targetY: .5 };

    const render = (now) => {
      const time = calmMotion ? 0 : (now - startedAt) / 1000;
      pointer.x += (pointer.targetX - pointer.x) * .04;
      pointer.y += (pointer.targetY - pointer.y) * .04;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";

      // Broad, low-contrast light pools give the drifting points a sense of depth.
      for (let i = 0; i < 3; i += 1) {
        if (!sprites[i]) continue;
        const x = width * ([.12, .88, .68][i] + Math.sin(time * .08 + i * 2) * .07);
        const y = height * ([.7, .3, .86][i] + Math.cos(time * .07 + i) * .04);
        const size = Math.min(width, height) * (.9 + Math.sin(time * .09 + i) * .08);
        context.globalAlpha = .23;
        context.drawImage(sprites[i], x - size / 2, y - size / 2, size, size);
      }

      // Refracted tide lines travel slowly across the artwork, below the text.
      for (let i = 0; i < 3; i += 1) {
        const drift = Math.sin(time * .13 + i * 1.1);
        const y = height * (.58 + i * .065 + drift * .03);
        const ribbon = context.createLinearGradient(0, y, width, y);
        ribbon.addColorStop(0, "rgba(151, 218, 207, 0)");
        ribbon.addColorStop(.18, "rgba(151, 218, 207, .2)");
        ribbon.addColorStop(.48, "rgba(183, 211, 228, .015)");
        ribbon.addColorStop(.78, "rgba(221, 223, 187, .17)");
        ribbon.addColorStop(1, "rgba(221, 223, 187, 0)");
        context.strokeStyle = ribbon;
        context.beginPath();
        context.moveTo(-30, y + height * .15);
        context.bezierCurveTo(width * .24, y - height * .28, width * .62, y + height * .28, width + 30, y - height * .16);
        for (const [lineWidth, alpha] of [[18, .1], [5, .2], [.7, .5]]) {
          context.lineWidth = lineWidth;
          context.globalAlpha = alpha;
          context.stroke();
        }
      }

      motes.forEach((mote) => {
        const x = width * mote.x + Math.sin(time * mote.sway + mote.phase) * 24
          + (pointer.x - .5) * mote.depth * 14;
        const y = ((mote.y * height - time * mote.speed) % (height + 80) + height + 80) % (height + 80) - 40
          + (pointer.y - .5) * mote.depth * 10;
        const central = Math.abs(x / width - .5) < .24 && Math.abs(y / height - .5) < .32;
        const pulse = .68 + Math.sin(time * .55 + mote.phase) * .32;
        const alpha = mote.alpha * pulse * (central ? .23 : 1);
        const glowSize = mote.radius * (mote.depth > .75 ? 15 : 8);
        const sprite = sprites[mote.color];
        context.globalAlpha = alpha;
        if (sprite) context.drawImage(sprite, x - glowSize / 2, y - glowSize / 2, glowSize, glowSize);
        context.globalAlpha = alpha * .8;
        context.fillStyle = `rgb(${colors[mote.color]})`;
        context.beginPath();
        context.arc(x, y, mote.radius * .45, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
      canvas.dataset.frames = String(++frames);
    };

    const draw = (now) => {
      frame = 0;
      if (!active || document.hidden || calmMotion) return;
      if (now - lastPaint >= 1000 / 30) {
        render(now);
        lastPaint = now;
      }
      frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = Math.max(1, soundModal.clientWidth);
      height = Math.max(1, soundModal.clientHeight);
      const ratio = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(1100000 / (width * height)));
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      const count = width < 720 ? 36 : 68;
      if (motes.length !== count) motes = Array.from({ length: count }, (_, index) => ({
        x: random(0, 1), y: random(0, 1), phase: random(0, Math.PI * 2),
        radius: index % 9 === 0 ? random(2.2, 4.8) : random(.7, 1.8),
        depth: random(.2, 1), speed: random(3, 11), sway: random(.08, .18),
        alpha: random(.3, .85), color: index % colors.length,
      }));
      canvas.dataset.particles = String(count);
      if (active && !document.hidden) render(performance.now());
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      calmMotion = motion.matches;
      soundModal.classList.toggle("is-atmosphere-paused", document.hidden || calmMotion);
      canvas.dataset.state = document.hidden ? "paused" : calmMotion ? "reduced" : "running";
      if (document.hidden || !active) return;
      render(performance.now());
      if (!calmMotion) frame = requestAnimationFrame(draw);
    };
    const followPointer = (event) => {
      if (event.pointerType !== "mouse" || calmMotion) return;
      pointer.targetX = event.clientX / width;
      pointer.targetY = event.clientY / height;
    };
    return {
      start() {
        if (active) return;
        active = true;
        startedAt = performance.now();
        lastPaint = 0;
        window.addEventListener("resize", resize, { passive: true });
        document.addEventListener("visibilitychange", resume);
        motion.addEventListener("change", resume);
        soundModal.addEventListener("pointermove", followPointer, { passive: true });
        resize();
        resume();
      },
      stop() {
        active = false;
        cancelAnimationFrame(frame);
        frame = 0;
        canvas.dataset.state = "stopped";
        soundModal.classList.add("is-atmosphere-paused");
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", resume);
        motion.removeEventListener("change", resume);
        soundModal.removeEventListener("pointermove", followPointer);
      },
    };
  };
  const soundAtmosphere = createSoundAtmosphere(document.querySelector("#gaia-opening-sound-atmosphere"));

  const updatePreload = (message = "") => {
    const total = Math.max(1, preloadAssetCount);
    const percentage = Math.round((settledPreloads / total) * 100);
    if (preloadPercent) preloadPercent.textContent = String(percentage);
    if (preloadBar) preloadBar.style.transform = `scaleX(${percentage / 100})`;
    if (preloadStatus) {
      preloadStatus.textContent = message || `${preloadLabel}を準備しています　${settledPreloads} / ${total}`;
    }
  };

  const preloadOpeningArt = (source, fetchPriority = "low") => new Promise((resolve) => {
    const artwork = new Image();
    artwork.decoding = "async";
    artwork.fetchPriority = fetchPriority;
    let settled = false;
    const complete = () => {
      if (settled) return;
      settled = true;
      settledPreloads += 1;
      updatePreload();
      resolve();
    };
    const settle = () => {
      if (typeof artwork.decode !== "function") {
        complete();
        return;
      }
      artwork.decode().catch(() => {}).finally(complete);
    };
    artwork.onload = settle;
    artwork.onerror = complete;
    artwork.src = new URL(source, document.baseURI).href;
  });

  const startOpeningArtPreload = ({ fetchPriority = "low" } = {}) => {
    if (artPreloadPromise) return artPreloadPromise;
    artPreloadPromise = Promise.all(OPENING_ART.map((source) => preloadOpeningArt(source, fetchPriority)));
    return artPreloadPromise;
  };

  const startOpeningAudioPreload = () => {
    if (audioPreloadPromise) return audioPreloadPromise;
    preloadAssetCount += 1;
    preloadLabel = "オープニングの光・人物・音";
    updatePreload();
    audioPreloadPromise = (async () => {
      try {
        await window.GaiaOpeningAudio?.preload();
      } finally {
        settledPreloads += 1;
        updatePreload();
      }
    })();
    return audioPreloadPromise;
  };

  const startOpeningPreload = ({ includeAudio = true } = {}) => {
    if (preloadStarted) return;
    preloadStarted = true;
    preloadLabel = includeAudio ? "オープニングの光・人物・音" : "オープニングの光と人物";
    updatePreload();
    window.clearTimeout(preloadRevealTimer);
    preloadRevealTimer = window.setTimeout(() => {
      if (preloadReady || openingStarted || !(preloadPanel instanceof HTMLElement)) return;
      preloadPanel.hidden = false;
      preloadPanelShownAt = performance.now();
    }, 240);

    const tasks = [startOpeningArtPreload({ fetchPriority: "high" })];
    if (includeAudio) tasks.push(startOpeningAudioPreload());
    Promise.race([
      Promise.all(tasks),
      new Promise((resolve) => window.setTimeout(() => resolve("timeout"), 5000)),
    ]).then((result) => {
      window.clearTimeout(preloadRevealTimer);
      const panelWasShown = preloadPanel instanceof HTMLElement && !preloadPanel.hidden;
      if (result === "timeout") {
        if (preloadBar) preloadBar.style.transform = "scaleX(1)";
        if (preloadPercent) preloadPercent.textContent = "100";
        if (preloadStatus) preloadStatus.textContent = "準備できた素材からオープニングを開始します";
      } else {
        updatePreload("準備ができました。オープニングを開始します");
      }
      const minimumVisible = panelWasShown ? Math.max(0, 420 - (performance.now() - preloadPanelShownAt)) : 0;
      window.setTimeout(() => {
        preloadReady = true;
        tryStart();
      }, minimumVisible);
    });
  };

  const revealFocusText = (target, delay, duration) => {
    target.style.setProperty("--opening-focus-duration", `${duration}ms`);
    textTimers.push(window.setTimeout(() => {
      if (finished) return;
      target.classList.remove("is-opening-focus-pending");
    }, delay));
  };

  const settleFocusText = () => {
    textTimers.forEach((timer) => window.clearTimeout(timer));
    focusTargets.forEach((target) => target.classList.remove("is-opening-focus-pending"));
  };

  const closeSoundModalImmediately = () => {
    window.clearTimeout(soundModalRevealTimer);
    window.clearTimeout(soundModalHideTimer);
    soundModalOpen = false;
    soundAtmosphere.stop();
    opening.classList.remove("is-sound-modal-open");
    if (soundModal instanceof HTMLElement) {
      soundModal.classList.remove("is-visible");
      soundModal.hidden = true;
      soundModal.inert = true;
      soundModal.setAttribute("aria-hidden", "true");
    }
    if (finalMenu instanceof HTMLElement) {
      finalMenu.inert = false;
      finalMenu.removeAttribute("aria-hidden");
    }
  };

  const hideSoundModal = () => {
    if (!soundModalOpen || !(soundModal instanceof HTMLElement)) return;
    window.clearTimeout(soundModalRevealTimer);
    soundModalOpen = false;
    soundAtmosphere.stop();
    opening.classList.remove("is-sound-modal-open");
    soundModal.classList.remove("is-visible");
    soundModal.inert = true;
    soundModal.setAttribute("aria-hidden", "true");
    if (finalMenu instanceof HTMLElement) {
      finalMenu.inert = false;
      finalMenu.removeAttribute("aria-hidden");
    }
    soundModalHideTimer = window.setTimeout(() => {
      soundModal.hidden = true;
    }, reducedMotion ? 0 : 420);
  };

  const showSoundModal = () => {
    if (
      !(soundModal instanceof HTMLElement)
      || !(soundOnButton instanceof HTMLButtonElement)
      || !(soundOffButton instanceof HTMLButtonElement)
    ) {
      finalStoryButton?.focus({ preventScroll: true });
      return;
    }

    window.clearTimeout(soundModalHideTimer);
    const state = window.GaiaOpeningAudio?.getState?.();
    pendingSoundEnabled = true;
    soundModalOpen = true;
    syncAudioControls(state);
    if (finalMenu instanceof HTMLElement) {
      finalMenu.inert = true;
      finalMenu.setAttribute("aria-hidden", "true");
    }
    soundModal.hidden = false;
    soundModal.inert = false;
    soundModal.setAttribute("aria-hidden", "false");
    opening.classList.add("is-sound-modal-open");
    const focusSelectedSound = () => {
      if (!soundModalOpen) return;
      const selectedButton = pendingSoundEnabled ? soundOnButton : soundOffButton;
      selectedButton?.focus({ preventScroll: true });
    };
    requestAnimationFrame(() => {
      soundModal.classList.add("is-visible");
      soundAtmosphere.start();
      signalInitialViewReady();
      window.clearTimeout(openingArtWarmTimer);
      const warmOpeningArtAfterHandoff = () => {
        focusSelectedSound();
        openingArtWarmTimer = 0;
      };
      if (document.querySelector("#gaia-boot")?.hidden) warmOpeningArtAfterHandoff();
      else window.addEventListener("gaia:boot-handoff", warmOpeningArtAfterHandoff, { once: true });
    });
  };

  const finish = async (destination = "menu") => {
    if (finished || finishRequested || titleReturnRunning) return;
    if (typeof destination !== "string") destination = "menu";
    closeRouteGuide({ remember: true, restoreFocus: false });
    finishRequested = true;
    document.querySelector("#gaia-story-entry-error")?.remove();
    finalMenu?.setAttribute("aria-busy", "true");
    if (finalStoryButton instanceof HTMLButtonElement) finalStoryButton.disabled = true;
    if (finalOtherButton instanceof HTMLButtonElement) finalOtherButton.disabled = true;
    if (routeGuideReplay instanceof HTMLButtonElement) routeGuideReplay.disabled = true;
    performance.mark(`gaia:${destination}-route-load-request`);
    const routeReady = destination === "tour"
      ? (async () => {
          await window.GaiaModeLoader?.load?.("exploration");
          await window.GaiaModeLoader?.load?.("tour");
        })()
      : Promise.resolve(window.GaiaModeLoader?.load?.(destination === "story" ? "story" : "exploration"));
    const destinationReady = destination === "story"
      ? Promise.resolve(routeReady).then(async () => {
          for (let frame = 0; frame < 120 && !window.GaiaNovel?.prepareEntry; frame += 1) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          return window.GaiaNovel?.prepareEntry?.({ fresh: true });
        })
      : routeReady;
    // The sound archive used to begin fetching only after its card was pressed.
    // Warm it during the menu handoff so the four-card entrance remains responsive
    // without adding sound-mode work to the initial opening load.
    if (destination === "menu") {
      void Promise.resolve(window.GaiaModeLoader?.load?.("sound")).catch(() => {});
    }
    const soundtrackReady = destination === "menu" || destination === "tour"
      ? Promise.resolve(window.GaiaOpeningAudio?.switchTrack?.("senseware", 0.25))
      : Promise.resolve(true);
    finished = true;
    window.clearTimeout(finishTimer);
    closeSoundModalImmediately();
    settleFocusText();
    // Fade the choice cards without removing their layout box. The final lockup
    // is bottom-anchored, so display:none here would make the logo drop by the
    // menu height during the route handoff.
    if (finalMenu instanceof HTMLElement) {
      finalMenu.classList.remove("is-visible");
      finalMenu.inert = true;
      finalMenu.setAttribute("aria-hidden", "true");
    }
    let storyOpenedDirectly = false;
    try {
      if (destination === "story" && window.GaiaStoryPrologue) {
        storyOpenedDirectly = await window.GaiaStoryPrologue.run(destinationReady, async (reveal) => {
          if (!window.GaiaNovel?.open) throw new Error("Story entry is unavailable");
          document.body.classList.add("gaia-route-handoff");
          opening.classList.add("is-leaving");
          return window.GaiaNovel.open(null, {
            autoStartFresh: true,
            deferOpenEvent: true,
            entryPrepared: true,
            prologueReveal: reveal,
          });
        });
      } else {
      // Decode the first story background before beginning the outgoing fade.
      // The opening artwork therefore remains the visible surface during slow
      // loads instead of revealing a black or unpainted story layer.
      if (destination === "story") await Promise.all([destinationReady, soundtrackReady]);
      // Lazy route assets can finish before or after the opening dissolve. Hide
      // the abstract WebGL base for that entire interval, not only after loading.
      document.body.classList.add("gaia-route-handoff");
      opening.classList.add("is-leaving");
      const exitReady = new Promise((resolve) => {
        exitTimer = window.setTimeout(resolve, EXIT_DURATION);
      });
      const storyOpenReady = destination === "story" && window.GaiaNovel?.open
        ? new Promise((resolve, reject) => {
            window.setTimeout(() => {
              Promise.resolve(window.GaiaNovel.open(null, {
                autoStartFresh: true,
                deferOpenEvent: true,
                entryPrepared: true,
              })).then(resolve, reject);
            }, Math.max(0, EXIT_DURATION - STORY_FADE_IN_LEAD_MS));
          })
        : Promise.resolve(false);
      const [, , , openedStory] = await Promise.all([
        destination === "story" ? Promise.resolve() : destinationReady,
        exitReady,
        destination === "story" ? Promise.resolve() : soundtrackReady,
        storyOpenReady,
      ]);
      storyOpenedDirectly = Boolean(openedStory);
      }
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
      finished = false;
      finishRequested = false;
      document.body.classList.remove("gaia-route-handoff");
      opening.classList.remove("is-leaving");
      finalMenu?.removeAttribute("aria-busy");
      if (finalMenu instanceof HTMLElement) {
        finalMenu.hidden = false;
        finalMenu.inert = false;
        finalMenu.removeAttribute("aria-hidden");
        requestAnimationFrame(() => finalMenu.classList.add("is-visible"));
      }
      if (finalStoryButton instanceof HTMLButtonElement) finalStoryButton.disabled = false;
      if (finalOtherButton instanceof HTMLButtonElement) finalOtherButton.disabled = false;
      if (routeGuideReplay instanceof HTMLButtonElement) routeGuideReplay.disabled = false;
      if (error.name !== "AbortError" && finalMenu) {
        const notice = document.createElement("p");
        notice.id = "gaia-story-entry-error";
        notice.setAttribute("role", "status");
        notice.textContent = "物語を読み込めませんでした。通信を確認して、もう一度お試しください。";
        finalMenu.append(notice);
      }
      requestAnimationFrame(() => finalStoryButton?.focus({ preventScroll: true }));
      return;
    }
    if (destination === "story") {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#story`);
    }
    if (destination === "menu") {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#top`);
    }
    if (destination === "tour") history.replaceState(null, "", `${window.location.pathname}${window.location.search}#tour`);
    window.dispatchEvent(new CustomEvent("gaia:opening-complete", { detail: { destination } }));
    if (storyOpenedDirectly) {
      await new Promise((resolve) => {
        let remainingFrames = 30;
        const confirmStoryPaint = () => {
          const novelLayer = document.querySelector("#novel-layer");
          const style = novelLayer ? getComputedStyle(novelLayer) : null;
          const ready = Boolean(
            novelLayer
            && !novelLayer.hidden
            && style?.visibility === "visible"
            && Number(style.opacity) > 0.98
            && style.backgroundImage.includes("url("),
          );
          if (ready || remainingFrames <= 0) resolve();
          else {
            remainingFrames -= 1;
            requestAnimationFrame(confirmStoryPaint);
          }
        };
        requestAnimationFrame(confirmStoryPaint);
      });
      window.dispatchEvent(new CustomEvent("gaia:novel-open"));
    }
    opening.hidden = true;
    opening.classList.remove("is-active", "is-leaving");
    document.body.classList.remove("gaia-opening-active");
    particleSystem.stop();
    revealAudioDock();
    if (destination === "story" && !storyOpenedDirectly) {
      window.dispatchEvent(new CustomEvent("gaia:novel-open-at-mode", {
        detail: { index: 0, source: "opening" },
      }));
    }
    if (destination === "tour") window.GaiaGuidedTour?.start?.({ source: "opening" });
    requestAnimationFrame(() => document.body.classList.remove("gaia-route-handoff"));
  };

  const retireOpeningForDestination = () => {
    window.clearTimeout(finishTimer);
    window.clearTimeout(exitTimer);
    closeSoundModalImmediately();
    settleFocusText();
    opening.inert = true;
    opening.setAttribute("aria-hidden", "true");
    opening.classList.add("is-leaving");
    if (finalMenu instanceof HTMLElement) {
      finalMenu.classList.remove("is-visible");
      finalMenu.hidden = true;
    }
    particleSystem.stop();
    window.setTimeout(() => {
      opening.hidden = true;
      opening.classList.remove("is-active", "is-leaving");
      document.body.classList.remove("gaia-opening-active");
      revealAudioDock();
    }, reducedMotion ? 0 : 260);
  };
  window.addEventListener("gaia:novel-open", retireOpeningForDestination);
  window.addEventListener("hashchange", () => {
    if (opening.hidden || globalThis.GaiaMapRoute.numberFromHash(window.location.hash) === null) return;
    // Pasting a numbered link while the sound/title screen is open is a
    // same-document navigation too. Retire its UI and pending opening steps.
    finished = true;
    retireOpeningForDestination();
  });

  const showFinalMenu = () => {
    if (finished || !(finalMenu instanceof HTMLElement)) return;
    syncRouteHelpMode();
    finalMenu.hidden = false;
    opening.classList.add("is-menu-ready");
    if (!window.GaiaOpeningAudio?.getState?.().muted) void window.GaiaOpeningAudio?.preloadTrack?.("senseware");
    syncAudioControls();
    revealAudioDock();
    requestAnimationFrame(() => {
      finalMenu.classList.add("is-visible");
      finalMenu.dataset.revealStartedAt = performance.now().toFixed(3);
      delete finalMenu.dataset.revealCompleteAt;
      delete routeGuideLayer.dataset.openedAt;
      scheduleFinalGatewayPlacement();
      if (!titleReturnRunning) maybeStartRouteGuide();
      let focusAttempts = 0;
      const focusFinalMenu = () => {
        soundModalRevealTimer = 0;
        if (finished || titleReturnRunning || routeGuideActive || finalMenu.hidden || finalMenu.inert
          || finalMenu.contains(document.activeElement) || aboutNav?.contains(document.activeElement)) return;
        // Reduced-motion entry can still be inside the CSS visibility handoff
        // when this timer fires. Wait for a focusable surface, not a fixed guess.
        if (getComputedStyle(finalMenu).visibility !== "visible" || !finalMenu.getClientRects().length) {
          if (focusAttempts++ < 20) soundModalRevealTimer = window.setTimeout(focusFinalMenu, 50);
          return;
        }
        // Focus the neutral group, not an unchosen destination. Tab still enters
        // the route buttons in order without lighting the story card on arrival.
        finalMenu.focus({ preventScroll: true });
      };
      soundModalRevealTimer = window.setTimeout(focusFinalMenu, reducedMotion ? 80 : 240);
    });
  };

  const skipToFinalMenu = () => {
    if (finished || opening.classList.contains("is-menu-ready")) return;
    window.clearTimeout(finishTimer);
    settleFocusText();
    opening.classList.add("is-skipping-to-menu");
    showFinalMenu();
  };

  const returnToTitle = () => {
    window.clearTimeout(finishTimer);
    window.clearTimeout(exitTimer);
    window.clearTimeout(soundModalRevealTimer);
    closeRouteGuide({ remember: true, restoreFocus: false });
    closeSoundModalImmediately();
    settleFocusText();
    finished = false;
    finishRequested = false;
    soundSetupConfirmed = true;
    openingStarted = true;
    preloadReady = true;
    document.body.classList.remove("gaia-route-handoff");
    document.body.classList.add("gaia-opening-active");
    opening.hidden = false;
    opening.inert = false;
    opening.setAttribute("aria-hidden", "false");
    opening.classList.remove("is-leaving", "is-preloading", "is-awaiting-sound");
    opening.classList.add("is-preloaded", "is-active", "is-skipping-to-menu");
    if (preloadPanel instanceof HTMLElement) preloadPanel.hidden = true;
    if (finalMenu instanceof HTMLElement) {
      finalMenu.hidden = true;
      finalMenu.inert = false;
      finalMenu.classList.remove("is-visible");
      finalMenu.removeAttribute("aria-busy");
      finalMenu.removeAttribute("aria-hidden");
    }
    if (finalStoryButton instanceof HTMLButtonElement) finalStoryButton.disabled = false;
    if (finalOtherButton instanceof HTMLButtonElement) finalOtherButton.disabled = false;
    if (routeGuideReplay instanceof HTMLButtonElement) routeGuideReplay.disabled = false;
    particleSystem.start();
    void window.GaiaOpeningAudio?.switchTrack?.("opening", 0.2);
    requestAnimationFrame(showFinalMenu);
  };

  const start = () => {
    if (openingStarted || !preloadReady || !soundSetupConfirmed) return;
    openingStarted = true;
    particleSystem.start();
    opening.hidden = false;
    opening.classList.add("is-preloaded");
    window.setTimeout(() => {
      if (preloadPanel) preloadPanel.hidden = true;
      opening.classList.remove("is-preloading");
    }, 380);
    void opening.offsetWidth;
    opening.classList.add("is-active");
    if (!window.GaiaOpeningAudio?.getState?.().muted) {
      window.setTimeout(() => void window.GaiaOpeningAudio?.preloadTrack?.("story"), 1000);
    }
    focusTargets.forEach((target) => {
      // Keep timing with its text. Inserting a new line must not shift the
      // fourth voice onto the final title's reveal time again.
      const timing = target.dataset.openingFocus.trim().split(/\s+/u).map(Number);
      const [delay, duration] = timing.length === 2 && timing.every((value) => Number.isFinite(value) && value >= 0)
        ? timing : [0, 520];
      revealFocusText(target, openingMs(delay), openingMs(duration));
    });
    finishTimer = window.setTimeout(showFinalMenu, FINAL_MENU_REVEAL_DELAY);

  };

  const tryStart = () => {
    if (!soundSetupConfirmed || !preloadReady || openingStarted) return;
    requestAnimationFrame(start);
  };

  const showReducedMotionMenu = () => {
    if (openingStarted || finished) return;
    openingStarted = true;
    opening.hidden = false;
    opening.classList.add("is-preloaded");
    opening.classList.add("is-skipping-to-menu");
    if (preloadPanel) preloadPanel.hidden = true;
    opening.classList.remove("is-preloading");
    settleFocusText();
    showFinalMenu();
  };

  const chooseSound = (enabled) => {
    soundOnButton?.setAttribute("aria-pressed", String(Boolean(enabled)));
    soundOffButton?.setAttribute("aria-pressed", String(!enabled));

    const selectedVolume = Number(openingVolume?.value ?? 10) / 100;
    window.GaiaOpeningAudio?.setVolume?.(selectedVolume);

    if (enabled) {
      // Keep play() in the click task for autoplay permission, but do not wait
      // for media startup before painting the selected state.
      void window.GaiaOpeningAudio?.start(selectedVolume)?.catch?.(() => {});
      // Warm both destinations while the opening or route menu is still visible,
      // so neither route has to keep the next screen waiting for its soundtrack.
      void window.GaiaOpeningAudio?.preloadTrack?.("story");
      void window.GaiaOpeningAudio?.preloadTrack?.("senseware");
    } else {
      void window.GaiaOpeningAudio?.setMuted?.(true);
    }

    syncAudioControls();
  };

  const scheduleAfterInputPaint = (callback) => {
    requestAnimationFrame(() => {
      performance.mark("gaia:sound-choice-feedback-painted");
      requestAnimationFrame(() => {
        window.setTimeout(() => {
          if (globalThis.scheduler?.postTask) {
            void globalThis.scheduler.postTask(callback, { priority: "background" });
          } else {
            callback();
          }
        }, 120);
      });
    });
  };

  const confirmSoundSetup = (enabled) => {
    if (!soundModalOpen || soundSetupSubmitting) return;
    performance.mark("gaia:sound-choice-click");
    soundSetupSubmitting = true;
    window.clearTimeout(openingArtWarmTimer);
    pendingSoundEnabled = Boolean(enabled);
    if (soundOnButton instanceof HTMLButtonElement) soundOnButton.disabled = true;
    if (soundOffButton instanceof HTMLButtonElement) soundOffButton.disabled = true;
    if (openingVolume instanceof HTMLInputElement) openingVolume.disabled = true;
    syncAudioControls();
    chooseSound(pendingSoundEnabled);
    scheduleAfterInputPaint(() => {
      soundSetupConfirmed = true;
      opening.classList.remove("is-awaiting-sound");
      hideSoundModal();
      soundSetupSubmitting = false;
      if (soundOnButton instanceof HTMLButtonElement) soundOnButton.disabled = false;
      if (soundOffButton instanceof HTMLButtonElement) soundOffButton.disabled = false;
      if (openingVolume instanceof HTMLInputElement) openingVolume.disabled = false;
      if (reducedMotion) {
        showReducedMotionMenu();
        return;
      }
      performance.mark("gaia:opening-preload-start");
      startOpeningPreload({ includeAudio: pendingSoundEnabled });
      tryStart();
    });
  };

  skipButton?.addEventListener("click", skipToFinalMenu);
  finalStoryButton?.addEventListener("click", () => void finish("story"));
  finalOtherButton?.addEventListener("click", () => void finish("menu"));
  soundOnButton?.addEventListener("click", () => void confirmSoundSetup(true));
  soundOffButton?.addEventListener("click", () => void confirmSoundSetup(false));
  // Restart on every intentional entry, including hover while focus remains.
  // Selection feedback itself stays synchronous in confirmSoundSetup above.
  [soundOnButton, soundOffButton].forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const glint = () => {
      if (!soundModalOpen || button.disabled || reducedMotion) return;
      button.classList.remove("is-sound-glint");
      void button.offsetWidth;
      button.classList.add("is-sound-glint");
    };
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") glint();
    });
    button.addEventListener("focus", () => {
      if (button.matches(":focus-visible")) glint();
    });
    button.addEventListener("animationend", (event) => {
      if (event.animationName === "sound-choice-sheen") button.classList.remove("is-sound-glint");
    });
  });
  soundModal?.addEventListener("keydown", (event) => {
    if (!soundModalOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      (pendingSoundEnabled ? soundOnButton : soundOffButton)?.focus({ preventScroll: true });
      return;
    }
    if (event.key !== "Tab" || !(soundDialog instanceof HTMLElement)) return;
    const focusable = Array.from(
      soundDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !opening.hidden && !opening.classList.contains("is-preloading")) skipToFinalMenu();
  });
  window.addEventListener("pagehide", () => {
    window.clearTimeout(finishTimer);
    window.clearTimeout(exitTimer);
    window.clearTimeout(soundModalRevealTimer);
    window.clearTimeout(soundModalHideTimer);
    window.clearTimeout(preloadRevealTimer);
    window.clearTimeout(openingArtWarmTimer);
    window.clearTimeout(routeGuideStartTimer);
    window.clearTimeout(routeGuideCloseTimer);
    cancelAnimationFrame(routeGuideRevealFrame);
    cancelAnimationFrame(routeGuidePositionFrame);
    textTimers.forEach((timer) => window.clearTimeout(timer));
    particleSystem.stop();
    soundAtmosphere.stop();
  });

  openingUi = {
    show: returnToTitle,
    prepare: async () => {
      const background = getComputedStyle(opening).getPropertyValue("--opening-final-keyvisual-image").match(/url\(["']?([^"')]+)["']?\)/u)?.[1];
      const art = background ? preloadOpeningArt(background, "high") : Promise.resolve();
      const logos = [...opening.querySelectorAll(".gaia-vn-final-copy img")].map(img => img.decode?.().catch(() => {}));
      let timeout;
      try {
        await Promise.race([Promise.all([art, ...logos]), new Promise(resolve => { timeout = setTimeout(resolve, 5000); })]);
      } finally { clearTimeout(timeout); }
    },
    release: () => {
      finalMenu?.focus({ preventScroll: true });
      maybeStartRouteGuide();
    },
  };
  if (!initial) return openingUi;
  if (resumeAtTitleMenu) {
    soundSetupConfirmed = true;
    opening.classList.remove("is-awaiting-sound");
    closeSoundModalImmediately();
    particleSystem.start();
    // Returning from the separate concept page restores this title shell.
    // Preserve the visitor's preference and select the title score.
    void (async () => {
      const restored = await window.GaiaOpeningAudio?.restoreNavigationState?.("opening");
      if (!restored?.restored) await window.GaiaOpeningAudio?.switchTrack?.("opening", 0);
    })();
    requestAnimationFrame(showReducedMotionMenu);
    signalInitialViewReady();
  } else {
    showSoundModal();
  }
  return openingUi;
  }
})();
