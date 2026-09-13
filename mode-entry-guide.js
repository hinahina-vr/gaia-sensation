/**
 * 概要: 各モードの入口紹介と操作ガイド。登録された文章・案内対象を表示し、開閉通知とフォーカス復帰で元画面と連携する。
 */
(() => {
  "use strict";
  if (globalThis.GaiaModeEntryGuide || typeof document === "undefined") return;

  const registry = new Map();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = document.createElement("section");
  layer.className = "gaia-mode-entry-guide";
  layer.id = "gaia-mode-entry-guide";
  // Focus and hover may overlap; restart the sweep for each new interaction.
  const replayFeatureGlint = event => {
    const button = event.target.closest?.('.gaia-feature-intro button');
    if (!button || !layer.classList.contains('is-feature-ready')) return;
    button.classList.remove('is-feature-glint');
    void button.offsetWidth;
    button.classList.add('is-feature-glint');
  };
  layer.addEventListener('focusin', replayFeatureGlint);
  layer.addEventListener('pointerover', event => {
    const button = event.target.closest?.('.gaia-feature-intro button');
    if (button && !button.contains(event.relatedTarget)) replayFeatureGlint(event);
  });
  layer.hidden = true;
  layer.inert = true;
  layer.tabIndex = -1;
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-labelledby", "gaia-mode-entry-guide-title");
  layer.setAttribute("aria-describedby", "gaia-mode-entry-guide-copy");
  layer.innerHTML = `
    <article class="gaia-mode-entry-title" hidden>
      <p class="gaia-mode-entry-title-kicker">GAIA / OBSERVATION</p>
      <h2 id="gaia-mode-entry-title-text"></h2>
      <p id="gaia-mode-entry-title-copy">この星の、まだ知らない表情へ。</p>
      <button type="button" data-entry-title-skip aria-label="体験する">
        <span class="entry-highlight-orbit" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M12 8 24 16 12 24Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>
        <span class="entry-highlight-copy"><span class="entry-highlight-kicker" aria-hidden="true">EXPERIENCE</span><span class="entry-highlight-label">体験する</span></span>
        <span class="entry-highlight-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13m-5-5 5 5-5 5"/></svg></span>
      </button>
    </article>
    <div class="gaia-mode-entry-guide-spotlight" aria-hidden="true"></div>
    <article class="gaia-mode-entry-guide-card" aria-live="polite" aria-atomic="true">
      <header>
        <span data-mode-guide-kicker>操作ガイド</span>
        <b><i data-mode-guide-step>1</i> / <span data-mode-guide-total>1</span></b>
      </header>
      <h2 id="gaia-mode-entry-guide-title" data-mode-guide-title></h2>
      <p id="gaia-mode-entry-guide-copy" data-mode-guide-copy></p>
      <nav class="gaia-mode-entry-guide-controls" aria-label="ガイドの操作">
        <button type="button" data-mode-guide-skip>閉じる</button>
        <button type="button" data-mode-guide-back>戻る</button>
        <button type="button" data-mode-guide-next>次へ →</button>
      </nav>
    </article>
    <article class="gaia-feature-intro" hidden>
      <button class="gaia-feature-close" type="button" data-feature-close aria-label="入口ガイドを閉じる"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      <div class="gaia-feature-scroll">
        <header class="gaia-feature-heading">
          <p data-feature-kicker></p>
          <h2 id="gaia-feature-title" data-feature-title></h2>
          <p id="gaia-feature-copy" data-feature-copy></p>
        </header>
        <div class="gaia-feature-cards" data-feature-cards></div>
        <p class="gaia-feature-note" data-feature-note></p>
      </div>
      <footer class="gaia-feature-footer">
        <p><span data-feature-visit-note></span><span>ガイドから、いつでも見返せます。</span></p>
        <div>
          <button type="button" data-feature-guide>操作ガイドを見る</button>
          <button type="button" data-feature-start><span></span><b aria-hidden="true">→</b></button>
        </div>
      </footer>
    </article>`;
  document.body.append(layer);

  const spotlight = layer.querySelector(".gaia-mode-entry-guide-spotlight");
  const card = layer.querySelector(".gaia-mode-entry-guide-card");
  const featureIntro = layer.querySelector(".gaia-feature-intro");
  const entryTitle = layer.querySelector(".gaia-mode-entry-title");
  const featureIcons = {
    live: '<circle cx="64" cy="42" r="29"/><ellipse cx="64" cy="42" rx="12" ry="29"/><path d="M36 35h56M36 49h56M17 60h15l6-15 9 28 8-13h20l8-21 9 21h19"/><circle class="feature-beacon" cx="90" cy="20" r="4"/>',
    timeline: '<path d="M16 63h96M24 56V39M51 56V29M78 56V19M105 56V10"/><path class="feature-trace" d="m24 39 27-10 27-10 27-9"/><circle cx="24" cy="63" r="4"/><circle cx="51" cy="63" r="4"/><circle cx="78" cy="63" r="4"/><circle cx="105" cy="63" r="4"/>',
    analysis: '<path d="M19 64V47h12v17M43 64V35h12v29M67 64V21h12v43M15 69h80"/><circle cx="94" cy="28" r="15"/><path d="m105 39 12 12m-31-22 5 5 10-12"/>',
    sensor: '<path d="M64 18v11m-8-5 8-6 8 6M50 12a20 20 0 0 1 28 0M43 5a30 30 0 0 1 42 0"/><rect x="42" y="34" width="44" height="32" rx="5"/><path d="M49 44h15m-15 8h8M49 66v8m15-8v8m15-8v8M22 48h12m60 0h12"/><circle cx="75" cy="51" r="4"/>',
    network: '<path d="m27 57 37-30 38 30M64 27v40M27 57l37 10 38-10"/><circle cx="64" cy="22" r="10"/><circle cx="22" cy="60" r="9"/><circle cx="107" cy="60" r="9"/><circle cx="64" cy="69" r="7"/><path d="M59 22h10m-5-5v10"/>',
  };
  let activeId = null;
  let activeConfig = null;
  let activeSteps = [];
  let activeIndex = 0;
  let activeTarget = null;
  let returnFocus = null;
  let positionFrame = 0;
  let settleTimer = 0;
  let openRequest = 0;
  let preparingGuide = false;
  let titleTimer = 0;
  let titleLeaving = false;
  let closeTimer = 0;

  const seenKey = (id, version) => `gaia:mode-entry-guide:${id}:${version || "v1"}`;
  const wasSeen = (key) => { try { return Boolean(sessionStorage.getItem(key)); } catch { return false; } };
  const rememberSeen = (key) => { try { sessionStorage.setItem(key, "seen"); } catch { /* The introduction still works without storage. */ } };
  const isVisible = (element) => {
    if (!(element instanceof HTMLElement) || element.hidden || element.closest("[hidden], [inert]")) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
  };
  const resolveTarget = (step) => {
    const target = typeof step.target === "function" ? step.target() : document.querySelector(step.target);
    return target instanceof HTMLElement ? target : null;
  };
  const clamp = (minimum, maximum, value) => Math.max(minimum, Math.min(maximum, value));
  const overlapArea = (first, second) => Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
    * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  const resolveAvoidRects = (step) => {
    const sources = [activeConfig?.avoid, step?.avoid].flat().filter(Boolean);
    return sources.flatMap((source) => {
      const resolved = typeof source === "function" ? source() : source;
      if (typeof resolved === "string") return Array.from(document.querySelectorAll(resolved));
      if (resolved instanceof Element) return [resolved];
      return [];
    }).filter(isVisible).map((element) => element.getBoundingClientRect());
  };

  const clearTarget = () => {
    activeTarget?.classList.remove("is-gaia-mode-guide-target");
    activeTarget = null;
  };

  const position = () => {
    positionFrame = 0;
    if (layer.dataset.phase !== "guide") return;
    if (!activeId || !isVisible(activeTarget) || !(card instanceof HTMLElement) || !(spotlight instanceof HTMLElement)) return;
    const rawTarget = activeTarget.getBoundingClientRect();
    const target = {
      left: clamp(0, innerWidth, rawTarget.left),
      top: clamp(0, innerHeight, rawTarget.top),
      right: clamp(0, innerWidth, rawTarget.right),
      bottom: clamp(0, innerHeight, rawTarget.bottom),
    };
    target.width = Math.max(1, target.right - target.left);
    target.height = Math.max(1, target.bottom - target.top);
    spotlight.style.left = `${Math.round(target.left)}px`;
    spotlight.style.top = `${Math.round(target.top)}px`;
    spotlight.style.width = `${Math.round(target.width)}px`;
    spotlight.style.height = `${Math.round(target.height)}px`;
    spotlight.style.borderRadius = getComputedStyle(activeTarget).borderRadius || "8px";

    const cardRect = card.getBoundingClientRect();
    const inset = innerWidth <= 640 ? 10 : 14;
    const gap = innerWidth <= 640 ? 10 : 14;
    const width = Math.min(cardRect.width, innerWidth - inset * 2);
    const height = Math.min(cardRect.height, innerHeight - inset * 2);
    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;
    const avoidRects = resolveAvoidRects(activeSteps[activeIndex]);
    const bottomBarrier = avoidRects
      .filter((rect) => rect.width >= innerWidth * 0.55 && rect.bottom >= innerHeight - inset * 2)
      .reduce((top, rect) => Math.min(top, rect.top), innerHeight - inset);
    const maximumTop = Math.max(inset, Math.min(innerHeight - inset - height, bottomBarrier - gap - height));
    const candidates = [
      { placement: "below", left: centerX - width / 2, top: target.bottom + gap, priority: 0 },
      { placement: "above", left: centerX - width / 2, top: target.top - height - gap, priority: 1 },
      { placement: "right", left: target.right + gap, top: centerY - height / 2, priority: 2 },
      { placement: "left", left: target.left - width - gap, top: centerY - height / 2, priority: 3 },
      { placement: "above-left", left: inset, top: target.top - height - gap, priority: 4 },
      { placement: "above-right", left: innerWidth - inset - width, top: target.top - height - gap, priority: 5 },
      { placement: "below-left", left: inset, top: target.bottom + gap, priority: 6 },
      { placement: "below-right", left: innerWidth - inset - width, top: target.bottom + gap, priority: 7 },
    ].map((candidate) => {
      const left = clamp(inset, Math.max(inset, innerWidth - inset - width), candidate.left);
      const top = clamp(inset, maximumTop, candidate.top);
      const bounds = { left, top, right: left + width, bottom: top + height };
      const targetOverlap = overlapArea(bounds, target);
      const avoidedOverlap = avoidRects.reduce((sum, avoidRect) => sum + overlapArea(bounds, avoidRect), 0);
      return { ...candidate, ...bounds, score: targetOverlap * 1000 + avoidedOverlap * 100 + candidate.priority };
    }).sort((first, second) => first.score - second.score)[0];

    card.style.left = `${Math.round(candidates.left)}px`;
    card.style.top = `${Math.round(candidates.top)}px`;
    card.dataset.placement = candidates.placement;
    card.dataset.positioned = "true";
    if (document.activeElement === layer) layer.querySelector("[data-mode-guide-next]").focus({ preventScroll: true });
  };

  const schedulePosition = () => {
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      positionFrame = requestAnimationFrame(position);
    });
  };

  const findAvailableStep = (requestedIndex, direction = 1) => {
    for (let index = requestedIndex; index >= 0 && index < activeSteps.length; index += direction) {
      const target = resolveTarget(activeSteps[index]);
      if (isVisible(target)) return { index, target };
    }
    return null;
  };

  const setStep = (requestedIndex, direction = 1) => {
    if (!activeId || activeSteps.length === 0) return;
    const available = findAvailableStep(clamp(0, activeSteps.length - 1, requestedIndex), direction);
    if (!available) {
      close({ restoreFocus: false });
      return;
    }
    clearTarget();
    activeIndex = available.index;
    activeTarget = available.target;
    activeTarget.classList.add("is-gaia-mode-guide-target");
    const step = activeSteps[activeIndex];
    layer.dataset.mode = activeId;
    layer.dataset.step = String(activeIndex + 1);
    layer.querySelector("[data-mode-guide-kicker]").textContent = step.kicker || activeConfig.kicker || "操作ガイド";
    layer.querySelector("[data-mode-guide-step]").textContent = String(activeIndex + 1);
    layer.querySelector("[data-mode-guide-total]").textContent = String(activeSteps.length);
    layer.querySelector("[data-mode-guide-title]").textContent = step.title;
    layer.querySelector("[data-mode-guide-copy]").textContent = step.copy;
    layer.querySelector("[data-mode-guide-back]").disabled = activeIndex === 0;
    layer.querySelector("[data-mode-guide-next]").textContent = activeIndex === activeSteps.length - 1 ? activeConfig.finishLabel || "はじめる" : "次へ →";

    const rect = activeTarget.getBoundingClientRect();
    if (rect.height < innerHeight * 0.9 && (rect.top < 12 || rect.bottom > innerHeight - 12)) {
      activeTarget.scrollIntoView({ block: "center", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    }
    schedulePosition();
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(schedulePosition, reducedMotion ? 0 : 380);
  };

  function close({ restoreFocus = true } = {}) {
    openRequest += 1;
    if (!activeId) return false;
    const closingConfig = activeConfig;
    const closingId = activeId;
    activeId = null;
    activeConfig = null;
    activeSteps = [];
    preparingGuide = false;
    clearTimeout(titleTimer);
    titleTimer = 0;
    titleLeaving = false;
    clearTimeout(settleTimer);
    settleTimer = 0;
    cancelAnimationFrame(positionFrame);
    positionFrame = 0;
    clearTarget();
    layer.classList.remove("is-visible", "is-feature-ready", "is-title-visible", "is-title-leaving");
    layer.inert = true;
    layer.setAttribute("aria-hidden", "true");
    clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (!activeId) layer.hidden = true;
      closeTimer = 0;
    }, reducedMotion ? 0 : 180);
    closingConfig?.onClose?.();
    dispatchEvent(new CustomEvent("gaia:mode-guide-close", { detail: { id: closingId } }));
    if (restoreFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
    return true;
  }

  const setPhase = (phase) => {
    const features = phase === "features", title = phase === "title";
    layer.dataset.phase = phase;
    entryTitle.hidden = !title;
    featureIntro.hidden = !features;
    card.hidden = phase !== "guide";
    spotlight.hidden = phase !== "guide";
    layer.setAttribute("aria-labelledby", title ? "gaia-mode-entry-title-text" : features ? "gaia-feature-title" : "gaia-mode-entry-guide-title");
    layer.setAttribute("aria-describedby", title ? "gaia-mode-entry-title-copy" : features ? "gaia-feature-copy" : "gaia-mode-entry-guide-copy");
  };
  const showFeaturePanel = (request) => {
    if (!activeId || request !== openRequest) return;
    if (activeConfig.available && !activeConfig.available()) { close({ restoreFocus: false }); return; }
    setPhase("features");
    layer.classList.remove("is-title-visible", "is-title-leaving");
    // Commit the hidden -> visible starting frame before starting the fade.
    // Checking the request prevents a closed/reopened intro from resurfacing.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!activeId || request !== openRequest || layer.dataset.phase !== "features") return;
      layer.classList.add("is-feature-ready");
      featureIntro.querySelector("[data-feature-start]").focus({ preventScroll: true });
    }));
  };
  const finishTitle = () => {
    if (!activeId || layer.dataset.phase !== "title" || titleLeaving) return;
    clearTimeout(titleTimer);
    titleLeaving = true;
    const request = openRequest;
    layer.classList.add("is-title-leaving");
    titleTimer = window.setTimeout(() => showFeaturePanel(request), reducedMotion ? 0 : 360);
  };
  const renderFeatures = (features) => {
    featureIntro.classList.toggle("is-illustrated", Boolean(features.illustrated));
    for (const name of ["kicker", "title", "copy", "note"]) featureIntro.querySelector(`[data-feature-${name}]`).textContent = features[name] || "";
    featureIntro.querySelector('[data-feature-note]').hidden = !features.note;
    featureIntro.querySelector("[data-feature-start] span").textContent = features.startLabel || "はじめる";
    featureIntro.querySelector("[data-feature-visit-note]").textContent = features.visitNote || "初回のご案内です。";
    const items = features.items.map((item, index) => {
      const article = document.createElement("section");
      article.className = "gaia-feature-card";
      article.dataset.featureKind = item.icon;
      article.innerHTML = `<div class="gaia-feature-visual" aria-hidden="true"><span>0${index + 1}</span><svg viewBox="0 0 128 84" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${featureIcons[item.icon] || featureIcons.analysis}</svg></div><div class="gaia-feature-card-copy"><p></p><h3></h3><span></span></div>`;
      if (features.illustrated && item.image) {
        const visual = article.querySelector(".gaia-feature-visual");
        visual.classList.add("has-feature-art");
        const illustration = document.createElement("img");
        illustration.src = item.image;
        illustration.alt = ""; // Decorative scene, not an actual data observation.
        illustration.width = features.imageWidth || 1536;
        illustration.height = features.imageHeight || 1024;
        illustration.decoding = "async";
        illustration.draggable = false;
        visual.querySelector("svg").replaceWith(illustration);
        const sparkle = document.createElement("i");
        sparkle.className = "feature-beacon";
        visual.append(sparkle);
      }
      article.querySelector(".gaia-feature-card-copy > p").textContent = item.tag;
      article.querySelector("h3").textContent = item.title;
      article.querySelector(".gaia-feature-card-copy > span").textContent = item.copy;
      return article;
    });
    featureIntro.querySelector("[data-feature-cards]").replaceChildren(...items);
    featureIntro.querySelector(".gaia-feature-scroll").scrollTop = 0;
  };
  const beginGuide = async () => {
    if (!activeId || preparingGuide) return;
    preparingGuide = true;
    const id = activeId, config = activeConfig, request = openRequest;
    try {
      await config.prepare?.();
      if (activeId !== id || openRequest !== request || (config.available && !config.available())) return;
      activeSteps = config.steps.filter(step => isVisible(resolveTarget(step)));
      if (!activeSteps.length) { close(); return; }
      setPhase("guide");
      delete card.dataset.positioned;
      setStep(0);
      layer.focus({ preventScroll: true });
    } finally { preparingGuide = false; }
  };

  const open = async (id, { force = false, guideOnly = false } = {}) => {
    const config = registry.get(id);
    if (!config || !Array.isArray(config.steps) || config.steps.length === 0) return false;
    // Map welcome is part of every entry. Other modes retain first-visit behavior.
    if (!force && !config.repeatEveryEntry && wasSeen(seenKey(id, config.version))) return false;
    if (activeId === id) return false;
    if (activeId) close({ restoreFocus: false });
    const request = ++openRequest;
    const showFeatures = Boolean(config.features && !guideOnly);
    const showTitle = Boolean(showFeatures && config.features.entryTitle);
    if (!showFeatures) await config.prepare?.();
    if (request !== openRequest || (config.available && !config.available()) || document.querySelector("dialog[open]")) return false;

    // Some modes reveal their controls after an opening transition. Wait until
    // at least one guide target is actually visible before consuming the
    // first-visit flag or trying to render the first step.
    let visibleSteps = config.steps.filter((step) => isVisible(resolveTarget(step)));
    for (let attempt = 0; ((!showFeatures && visibleSteps.length === 0) || (config.ready && !config.ready())) && attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      if (request !== openRequest || (config.available && !config.available())) return false;
      visibleSteps = config.steps.filter((step) => isVisible(resolveTarget(step)));
    }
    if (request !== openRequest || (!showFeatures && visibleSteps.length === 0) || (config.ready && !config.ready()) || activeId === id || document.querySelector("dialog[open]")) return false;

    activeId = id;
    activeConfig = config;
    activeSteps = visibleSteps;
    activeIndex = 0;
    returnFocus = document.activeElement === document.body ? config.focusTarget?.() || null : document.activeElement;
    rememberSeen(seenKey(id, config.version));
    layer.classList.remove("is-feature-ready", "is-title-visible", "is-title-leaving");
    titleLeaving = false;
    entryTitle.querySelector("h2").textContent = config.features?.entryTitle || "";
    setPhase(showTitle ? "title" : showFeatures ? "features" : "guide");
    if (showFeatures) renderFeatures(config.features);
    layer.dataset.mode = id;
    delete card.dataset.positioned;
    clearTimeout(closeTimer);
    closeTimer = 0;
    layer.hidden = false;
    layer.inert = false;
    layer.setAttribute("aria-hidden", "false");
    dispatchEvent(new CustomEvent("gaia:mode-guide-open", { detail: { id } }));
    requestAnimationFrame(() => {
      if (activeId !== id || request !== openRequest) return;
      layer.classList.add("is-visible");
      if (showTitle) {
        layer.classList.add("is-title-visible");
        entryTitle.querySelector("button").focus({ preventScroll: true });
        titleTimer = window.setTimeout(finishTitle, 2400);
      }
      else if (showFeatures) showFeaturePanel(request);
      else { setStep(0); layer.focus({ preventScroll: true }); }
    });
    return true;
  };

  const register = (id, config) => {
    if (!id || !config) return null;
    registry.set(id, Object.freeze({ ...config, steps: Object.freeze([...config.steps]) }));
    return registry.get(id);
  };

  const mountReplay = (id, host, { label = "操作ガイド" } = {}) => {
    if (!(host instanceof HTMLElement)) return null;
    const existing = host.querySelector(`[data-gaia-mode-guide-replay='${id}']`);
    if (existing) return existing;
    const button = document.createElement("button");
    button.className = "gaia-mode-entry-guide-replay";
    button.type = "button";
    button.dataset.gaiaModeGuideReplay = id;
    button.setAttribute("aria-label", `${label}をもう一度見る`);
    button.setAttribute("aria-controls", layer.id);
    button.innerHTML = `<span aria-hidden="true">?</span><strong>${label}</strong>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void open(id, { force: true });
    });
    host.append(button);
    return button;
  };

  const advance = () => {
    if (activeIndex >= activeSteps.length - 1) close();
    else setStep(activeIndex + 1, 1);
  };
  layer.addEventListener("click", (event) => {
    if (!activeId) return;
    event.preventDefault();
    event.stopPropagation();
    if (layer.dataset.phase === "title") {
      if (event.target.closest("[data-entry-title-skip]")) finishTitle();
      return;
    }
    if (layer.dataset.phase === "features") {
      if (event.target.closest("[data-feature-start], [data-feature-close]")) {
        const resumeMap = activeId === "map";
        close({ restoreFocus: !resumeMap });
        // Both welcome exits enter the map with autoplay on, even during loading.
        if (resumeMap) {
          globalThis.GaiaMapPicker?.close();
          document.querySelector('#japan-close')?.focus({ preventScroll: true });
          globalThis.GaiaMapPlayback?.start({ waitForReady: true });
        }
      }
      else if (event.target.closest("[data-feature-guide]")) void beginGuide();
      return;
    }
    if (event.target.closest("[data-mode-guide-skip]")) close();
    else if (event.target.closest("[data-mode-guide-back]")) setStep(activeIndex - 1, -1);
    else advance();
  });
  layer.addEventListener("keydown", (event) => {
    if (!activeId) return;
    if (event.key === "Tab") {
      const controls = [...layer.querySelectorAll("button:not(:disabled)")].filter(isVisible);
      const index = controls.indexOf(document.activeElement);
      event.preventDefault();
      event.stopPropagation();
      controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length]?.focus();
      return;
    }
    if (layer.dataset.phase !== "guide") { event.stopPropagation(); return; }
    if ((event.key !== "Enter" && event.key !== " ") || event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    event.stopPropagation();
    advance();
  });
  document.addEventListener("keydown", (event) => {
    if (!activeId || event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  }, true);
  document.addEventListener("focusin", (event) => {
    if (activeId && !layer.contains(event.target)) {
      (layer.dataset.phase === "title" ? entryTitle.querySelector("button") : layer.dataset.phase === "features" ? featureIntro.querySelector("[data-feature-start]") : card.dataset.positioned ? layer.querySelector("[data-mode-guide-next]") : layer).focus({ preventScroll: true });
    }
  });
  addEventListener("resize", schedulePosition, { passive: true });
  addEventListener("scroll", schedulePosition, { passive: true, capture: true });

  globalThis.GaiaModeEntryGuide = Object.freeze({
    register,
    mountReplay,
    open,
    close: (id = null, options = {}) => (!id || !activeId || id === activeId ? close(options) : false),
    getState: () => ({ active: Boolean(activeId), id: activeId, index: activeIndex, phase: activeId ? layer.dataset.phase : null }),
  });
  dispatchEvent(new CustomEvent("gaia:mode-entry-guide-ready"));
})();
