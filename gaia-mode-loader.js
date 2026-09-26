/**
 * 概要: モードごとの依存ファイルを管理し、必要なテンプレート・CSS・JavaScriptを選択時に読み込む。
 */
(() => {
  "use strict";

  const sharedStylesheet = "./styles.css?v=gaia-recycling-country-fill-1-intro-face-clearance-1-mincho-20260912-card-text-fit-20260919-refactor";

  const groups = Object.freeze({
    exploration: {
      templates: ["gaia-template-exploration"],
      styles: [
        sharedStylesheet,
        "./map-theme-background.css?v=theme-background-20260912",
        "./mode-entry-guide.css?v=gaia-map-guide-sequence-1-mincho-20260912",
        "./mode-feature-intro.css?v=gaia-feature-intro-mizu-ame-fit-3-sensor-20260909-observation-portal-20260909-calm-repeat-20260910-feature-night-glint-20260912-title-opacity-20260912-entry-highlights-20260912",
        "./scene-transition.css?v=gaia-52",
        "./data-ledger.css?v=gaia-inline-data-sources-1-mincho-20260912-source-layer-20260912",
        "./data-journey.css?v=gaia-map-polish-1-mincho-20260912",
        "./map-ui-grid-polish.css?v=gaia-place-picker-1-header-cleanup-1-hover-inline-1-population-style-1-separator-hold-20260909-tail-20260909-mincho-20260912-wind-data-intro-20260926-all-exhibit-intros-20260926-1-frameless-dock-20260926-2-reference05-20260926",
        "./estat-exhibits.css?v=gaia-number-stable-1-mincho-20260912",
        "./firms-exhibit.css?v=gaia-firms-readout-fit-1-mincho-20260912",
        "./marine-cod-exhibit.css?v=gaia-marine-cod-1-cod-ui-20260909-japan-sensor-open-1-pollution-1-annual-type-20260909-title-poi-20260909-prtr-biology-1-record-dock-compact-20260909-mincho-20260912-unified-playback-20260912-status-right-20260913",
        "./planet-signals-exhibit.css?v=gaia-epicenter-jump-1-mincho-20260912",
        "./mode-exit.css?v=gaia-story-control-center-2-mincho-20260912",
        "./map-instrument-ui.css?v=gaia-country-emissions-history-1",
        "./map-chapter-navigation.css?v=gaia-estat-copy-wrap-1-copy-transparent-20260909-cod-ui-20260909-annual-type-20260909-title-poi-20260909-title-no-underline-20260910-mincho-20260912",
        "./map-exhibit-actions.css?v=gaia-estat-copy-wrap-1-mincho-20260912",
        "./map-exhibit-categories.css?v=gaia-exhibit-profile-1-scope-groups-20260910-periodic-tiles-20260912-mincho-20260912-live-badge-20260912",
        "./ecologies-exhibit.css?v=gaia-ecologies-reading-1-mincho-20260912",
        "./metric-legend.css?v=gaia-unified-metric-legend-1-mincho-20260912",
        "./map-demo.css?v=gaia-demo-aurora-1-unified-playback-20260912-i18n-20260913",
        "./map-legend-drag.css?v=gaia-movable-legends-1",
        "./live-observation-ui.css?v=gaia-action-corner-1",
        "./observation-place-picker.css?v=gaia-place-inline-1-mincho-20260912",
        "./map-observation-panels.css?v=gaia-observation-panels-jst-1",
        "./story-map-layout.css?v=gaia-story-map-left-ui-1-mincho-20260912",
        "./map-observation-typography.css?v=gaia-lodging-color-1-annual-type-20260909-action-size-20260912",
        "./realtime-exhibits.css?v=gaia-map-polish-1-live-red-1-footer-credit-1-state-below-1-firms-surface-80-1-align-20260909-status-place-20260909-compact-height-20260909-action-size-20260912-prefecture-fill-20260912-stable-next-20260912",
        "./map-mobile-shell.css?v=gaia-mobile-collection-1-plain-panel-edge-1-scope-groups-20260910-periodic-tiles-20260912-unified-playback-20260912",
        "./food-exhibits.css?v=fao-food-1-action-size-20260912-mincho-20260912-compact-legend-20260912",
        "./map-heading-navigation.css?v=gaia-heading-step-1-chevron-20260910",
        "./map-unified-dock.css?v=gaia-unified-action-size-20260912-mincho-20260912-fixed-nav-dock15-20260913-reference05-20260926-type-confirm-2-all-chapters-food-20260926",
        "./map-stable-navigation.css?v=stable-next-20260912-exhibit-navigation-20260912-i18n-20260913-fixed-nav-dock15-20260913-nav-left-align-20260913",
      ],
      scripts: [
        "./mode-entry-guide.js?v=entry-bottom-menu-20260914-gaia-map-guide-sequence-1-feature-intro-mizu-ame-2-observation-portal-20260909-calm-repeat-20260910-entry-highlights-20260912",
        "./scene-transition.js?v=gaia-66",
        "./data-ledger.js?v=gaia-hardening-1",
        "./data-journey.js?v=gaia-01-header-cleanup-1",
        "./app-content.js?v=gaia-recycling-coverage-1-population-style-1-marine-cod-1-prefecture-fill-20260912-i18n-20260913-wind-first-tooltip-20260925",
        "./src/exploration/map-data-intro-catalog.js?v=concise-copy-20260926-1",
        "./ecologies-exhibit.js?v=gaia-country-coverage-1-extended-handoff-20260912",
        "./map-exhibit-categories.js?v=gaia-exhibit-profile-1-marine-cod-1-cod-ui-20260909-japan-sensor-open-1-pollution-1-prtr-biology-1-fao-food-1-scope-groups-20260910-periodic-tiles-20260912-exhibit-links-20260912-i18n-20260913-picker-depth-focus-20260913-wind-first-tooltip-20260925",
        "./app.js?v=entry-ready-20260922-entry-bottom-menu-20260914-gaia-hardening-1-unified-navigation-1-map-polish-1-feature-intro-mizu-ame-2-recycling-coverage-1-hover-inline-1-population-style-1-marine-cod-1-separator-hold-20260909-cod-ui-20260909-japan-sensor-open-1-character-concept-20260909-perf-high-20260909-owner-dispose-20260909-observation-portal-20260909-tail-20260909-fao-food-1-calm-repeat-20260910-food-country-fill-20260910-title-return-dissolve-20260910-story-temperature-20260910-completion-gate-20260910-temperature-autoplay-20260911-periodic-tiles-20260912-unified-dock-20260912-shared-glint-20260912-mincho-20260912-prefecture-fill-20260912-unified-playback-20260912-ending-return-20260912-exhibit-links-20260912-exhibit-navigation-20260912-i18n-20260913-previews-20260913-wind-first-tooltip-20260925-wind-data-intro-20260926-all-exhibit-intros-20260926-1-initial-year-2016-20260926",
        "./map-ui-grid-polish.js?v=entry-bottom-menu-20260914-gaia-story-map-dock-1-map-polish-1-scope-groups-20260910-exhibit-navigation-20260912-i18n-20260913-picker-depth-focus-20260913-fixed-nav-dock15-20260913",
        "./map-legend-drag.js?v=gaia-story-map-left-ui-1-perf-high-20260909-fao-food-1",
        "./map-mobile-shell.js?v=gaia-mobile-collection-1-marine-cod-1-cod-ui-20260909-japan-sensor-open-1-fao-food-1-scope-groups-20260910-periodic-tiles-20260912-unified-playback-20260912-exhibit-navigation-20260912-i18n-20260913-picker-cascade-20260913-responsive-audit",
        "./map-heading-navigation.js?v=gaia-heading-step-1-chevron-20260910",
        "./map-dock-motion.js?v=gaia-map-dock-motion-1-marine-cod-1-fao-food-1",
        "./map-stable-navigation.js?v=stable-next-20260912-exhibit-navigation-20260912-i18n-20260913-picker-depth-focus-20260913-fixed-nav-dock15-20260913-nav-triangles-20260913",
        "./particles-v9.js?v=gaia-light-surface-fps-1",
        "./map-responsive-layout.js?v=mobile-credit-disclosure-top-20260913",
      ],
      modules: [
        "./src/exploration/index.js?v=gaia-firms-cruise-animation-20260914-wind-first-tooltip-20260925-action-icons-ready-20260926-initial-year-2016-20260926",
      ],
    },
    statistics: {
      templates: [],
      styles: [
        "./statistics-lab.css?v=gaia-discovery-1-mincho-20260912",
        "./statistics-workspace.css?v=gaia-readable-comparison-1-mincho-20260912",
        "./statistics-atmosphere.css?v=gaia-observation-studio-1",
        "./statistics-game.css?v=gaia-mizu-ame-discovery-1-recycling-coverage-1-marine-cod-1-observation-portal-20260909-mincho-20260912",
        "./statistics-observatory.css?v=compact-glass-focus-20260912",
        "./statistics-inline.css?v=inline-20260913",
        "./statistics-refinement.css?v=glass-20260913",
      ],
      scripts: [],
      modules: ["./statistics-lab.js?v=inline-workspace-20260913"],
    },
    story: {
      templates: ["gaia-template-story"],
      styles: [
        sharedStylesheet,
        "./scene-transition.css?v=gaia-52",
        "./novel-mode.css?v=gaia-separator-plus-two-1-selected-ending-20260910-direct-expression-20260910-ending-entry-slow-20260910-section-entry-20260911-story-landscape-20260911-mincho-20260912-log-debug-20260912-whiteboard-20260912-chat-gothic-20260912-log-header-20260912-assistant-size-20260912-responsive-followup-1",
        "./story-temperature.css?v=story-temperature-20260910-temperature-autoplay-20260911-skip-20260912-mincho-20260912",
        "./true-end.css?v=gaia-finale-label-mincho-1-reading-breaks-20260911-section-entry-20260911-mincho-20260912",
        "./mode-exit.css?v=gaia-story-control-center-2-mincho-20260912",
      ],
      scripts: [
        "./scene-transition.js?v=gaia-66",
        "./dialogue-typography.js?v=reading-breaks-20260911-i18n-20260913",
        "./novel-story-data.js?v=gaia-story-log-revisions-20260909-afternoon-clock-20260911-log-debug-20260912-closing-clock-20260912-chapter-swap-20260912",
        "./true-end-data.js?v=gaia-beyond-log-20260909-reading-breaks-20260911-final-pages-20260912",
        "./locales/story-festival.js?v=20260912-i18n-20260913",
        "./locales/story-map.js?v=20260912-i18n-20260913",
        "./locales/story-gx.js?v=20260912-i18n-20260913",
        "./locales/story-esp32.js?v=20260912-i18n-20260913",
        "./locales/story-invitation.js?v=20260912-i18n-20260913",
        "./locales/story-chat.js?v=20260912-i18n-20260913",
        "./locales/story-ending-awakening.js?v=20260912-i18n-20260913",
        "./locales/story-ending-civilization.js?v=20260912-i18n-20260913",
        "./locales/story-ending-stars.js?v=20260912-i18n-20260913",
        "./true-end-webgl.js?v=gaia-ambient-motion-1-presence-fade-20260909",
        "./true-end-mode.js?v=gaia-ending-whiteout-1-finale-focus-20260909-completion-gate-20260910-reading-breaks-20260911-section-entry-20260911-finale-no-log-20260912-i18n-20260913",
        "./novel-background-cues.js?v=gaia-story-log-revisions-20260906-1-selected-ending-20260910-story-temperature-20260910-whiteboard-20260912",
        "./novel-back-half-cues.js?v=gaia-story-log-revisions-20260906-1-afternoon-clock-20260911-closing-clock-20260912",
        "./novel-temporal.js?v=gaia-temporal-1",
        "./story-temperature.js?v=story-temperature-20260910-temperature-autoplay-20260911-skip-20260912",
        "./ending-glitch.js?v=gaia-glitch-double-speed-1",
        "./novel-mode.js?v=gaia-separator-plus-two-1-white-prologue-20260909-direct-expression-20260910-story-temperature-20260910-completion-gate-20260910-map-blue-glass-20260910-ending-entry-slow-20260910-temperature-autoplay-20260911-reading-breaks-20260911-section-entry-20260911-sound-all-story-20260911-handoff-expression-20260912-log-debug-20260912-cast-fade-20260912-closing-clock-20260912-chat-gothic-20260912-reaction-spacing-20260912-chat-memo-20260912-assistant-credit-20260912-credits-expanded-20260912-ending-return-20260912-credit-roles-20260912-suno-music-20260912-mic-credit-i18n-20260913",
      ],
      modules: ["./src/exploration/lod-governor.js?v=gaia-budget-devices-1"],
    },
    gx: {
      templates: ["gaia-template-gx"],
      styles: [
        sharedStylesheet,
        "./scene-transition.css?v=gaia-52",
        "./gx-mode.css?v=gaia-gx-reading-1-mincho-20260912",
        "./gx-reading-layout.css?v=gaia-gx-reading-1",
        "./mode-exit.css?v=gaia-story-control-center-2-mincho-20260912",
      ],
      scripts: [
        "./scene-transition.js?v=gaia-66",
        "./gx-mode.js?v=gaia-gx-single-line-titles-1-i18n-20260913",
      ],
      modules: ["./src/exploration/lod-governor.js?v=gaia-budget-devices-1"],
    },
    space: {
      templates: ["gaia-template-space"],
      styles: [
        sharedStylesheet,
        "./scene-transition.css?v=gaia-52",
        "./space-mode.css?v=gaia-102-mincho-20260912",
        "./mode-exit.css?v=gaia-story-control-center-2-mincho-20260912",
      ],
      scripts: [
        "./scene-transition.js?v=gaia-66",
        "./space-scenes.js?v=gaia-98-i18n-20260913",
        "./space-mode.js?v=gaia-no-breathing-flash-1-i18n-20260913",
      ],
      modules: ["./src/exploration/lod-governor.js?v=gaia-budget-devices-1"],
    },
    sound: {
      templates: ["gaia-template-sound"],
      parallel: true,
      styles: [
        sharedStylesheet,
        "./sound-mode.css?v=gaia-sound-lock-1-compact-rail-20260911-sound-all-story-20260911-rail-balance-20260912-mincho-20260912",
        "./mode-exit.css?v=gaia-story-control-center-2-mincho-20260912",
      ],
      scripts: ["./sound-constellation.js?v=gaia-sound-lock-1-sound-all-story-20260911-rail-balance-20260912-i18n-20260913-constellation-morph-20260913", "./sound-mode.js?v=gaia-sound-lock-1-map-polish-1-selected-ending-20260910-compact-rail-20260911-sound-all-story-20260911-copy-20260912-title-space-responsive-followup-1"],
    },
    character: {
      templates: ["gaia-template-character"],
      styles: [
        sharedStylesheet,
        "./mode-entry-guide.css?v=gaia-map-guide-sequence-1-mincho-20260912",
        "./character-mode.css?v=gaia-aoneko-natural-posture-1-sakuya-chin-1-map-polish-1-character-concept-20260909-copy-align-20260910-mincho-20260912",
        "./mode-exit.css?v=gaia-story-control-center-2-mincho-20260912",
      ],
      scripts: [
        "./mode-entry-guide.js?v=entry-bottom-menu-20260914-gaia-map-guide-sequence-1-feature-intro-mizu-ame-2-observation-portal-20260909-calm-repeat-20260910-entry-highlights-20260912",
        "./character-mode.js?v=gaia-aoneko-natural-posture-1-sakuya-chin-1-selected-ending-20260910-copy-align-20260910-i18n-20260913-responsive-audit",
      ],
    },
    tour: {
      templates: [],
      styles: ["./guided-tour.css?v=gaia-tour-compact-safe-area-2-mincho-20260912"],
      scripts: ["./guided-tour.js?v=gaia-tour-compact-safe-area-2-early-pause-20260909"],
    },
  });

  for (const name of ['exploration', 'statistics', 'character', 'sound']) {
    groups[name].styles.push('./responsive-audit-fixes.css?v=mobile-credit-disclosure-top-20260913-unified-food-20260926');
  }
  const assetPromises = new Map();
  const groupPromises = new Map();
  const loadedGroups = new Set();
  const preloadedScripts = new Set();
  const characterPreloader = document.querySelector("#gaia-character-preloader");
  const characterPreloaderStatus = characterPreloader?.querySelector("[data-character-preloader-status]");
  let characterPreloaderShownAt = 0;

  const setCharacterPreloader = (visible, { error = false } = {}) => {
    if (!(characterPreloader instanceof HTMLElement)) return;
    window.clearTimeout(Number(characterPreloader.dataset.hideTimer) || 0);
    if (visible) {
      characterPreloaderShownAt = performance.now();
      characterPreloader.hidden = false;
      characterPreloader.classList.toggle("is-error", error);
      characterPreloader.setAttribute("aria-hidden", "false");
      if (characterPreloaderStatus) characterPreloaderStatus.textContent = error
        ? "PORTRAIT DATA / RETRY AVAILABLE"
        : "PORTRAIT DATA / CONNECTING";
      requestAnimationFrame(() => characterPreloader.classList.add("is-visible"));
      return;
    }
    const delay = Math.max(0, 420 - (performance.now() - characterPreloaderShownAt));
    const timer = window.setTimeout(() => {
      characterPreloader.classList.remove("is-visible");
      characterPreloader.setAttribute("aria-hidden", "true");
      const hideTimer = window.setTimeout(() => {
        if (!characterPreloader.classList.contains("is-visible")) characterPreloader.hidden = true;
      }, 430);
      characterPreloader.dataset.hideTimer = String(hideTimer);
    }, delay);
    characterPreloader.dataset.hideTimer = String(timer);
  };

  const waitForCharacterReady = () => new Promise((resolve) => {
    const layer = document.querySelector("#character-book-layer");
    if (!(layer instanceof HTMLElement)) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      resolve();
    };
    const ready = () => layer.classList.contains("is-open")
      && ["ready", "error"].includes(layer.dataset.imageState || "");
    const observer = new MutationObserver(() => {
      if (ready()) finish();
    });
    const timeout = window.setTimeout(finish, 8000);
    observer.observe(layer, { attributes: true, attributeFilter: ["class", "data-image-state"] });
    if (ready()) finish();
  });

  const mountTemplate = (id) => {
    const template = document.getElementById(id);
    if (!(template instanceof HTMLTemplateElement)) return;
    template.replaceWith(template.content);
  };

  // Styles and classic scripts share a request lifecycle, but not insertion
  // points or ordering. Keep those differences explicit at the call sites.
  const loadElementAsset = (url, { existing, create, parent, label }) => {
    const absolute = new URL(url, document.baseURI).href;
    if (assetPromises.has(absolute)) return assetPromises.get(absolute);
    if (existing(absolute)) return Promise.resolve();
    const promise = new Promise((resolve, reject) => {
      const element = create(url);
      element.onload = () => resolve();
      element.onerror = () => {
        assetPromises.delete(absolute);
        element.remove();
        reject(new Error(`${label} failed: ${url}`));
      };
      parent.append(element);
    });
    assetPromises.set(absolute, promise);
    return promise;
  };

  const loadStyle = (href) => loadElementAsset(href, {
    existing: (absolute) => Array.from(document.styleSheets).some((sheet) => sheet.href === absolute),
    create: (url) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.gaiaLazyAsset = "style";
      return link;
    },
    parent: document.head,
    label: "Stylesheet",
  });

  const loadScript = (src) => loadElementAsset(src, {
    existing: (absolute) => Array.from(document.scripts).some((script) => script.src === absolute),
    create: (url) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.dataset.gaiaLazyAsset = "script";
      return script;
    },
    parent: document.body,
    label: "Script",
  });

  const preloadScript = (src) => {
    const absolute = new URL(src, document.baseURI).href;
    if (assetPromises.has(absolute) || preloadedScripts.has(absolute)) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "script";
    link.href = src;
    link.dataset.gaiaLazyAsset = "preload";
    preloadedScripts.add(absolute);
    document.head.append(link);
  };

  const loadModule = (src) => {
    const absolute = new URL(src, document.baseURI).href;
    if (assetPromises.has(absolute)) return assetPromises.get(absolute);
    const promise = import(absolute);
    assetPromises.set(absolute, promise);
    return promise;
  };

  const waitForGroupReady = (name) => {
    const readiness = name === "entry" ? ["gaiaEntryReady", "gaia:entry-ready"]
      : name === "exploration" ? ["gaiaAppReady", "gaia:app-ready"] : null;
    if (!readiness || ["true", "fallback"].includes(document.documentElement.dataset[readiness[0]])) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener(readiness[1], onReady);
        reject(new Error(`GAIA ${name} runtime did not become ready`));
      }, 15_000);
      const onReady = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      window.addEventListener(readiness[1], onReady, { once: true });
    });
  };

  const loadGroupAssets = async ({ styles, scripts, modules = [], parallel }) => {
    if (parallel) {
      await Promise.all([
        ...styles.map(loadStyle),
        ...modules.map(loadModule),
        ...scripts.map(loadScript),
      ]);
      return;
    }
    // Fetch classic scripts concurrently; evaluate only after styles/modules,
    // and in manifest order. Several modes depend on this exact sequence.
    scripts.forEach(preloadScript);
    await Promise.all(styles.map(loadStyle));
    await Promise.all(modules.map(loadModule));
    for (const script of scripts) await loadScript(script);
  };

  const load = (name) => {
    if (loadedGroups.has(name)) return Promise.resolve();
    if (groupPromises.has(name)) return groupPromises.get(name);
    const group = groups[name === "entry" ? "exploration" : name];
    if (!group) return Promise.reject(new Error(`Unknown GAIA mode group: ${name}`));

    const promise = (async () => {
      performance.mark(`gaia:${name}-load-start`);
      group.templates.forEach(mountTemplate);
      await loadGroupAssets(group);
      await waitForGroupReady(name);
      loadedGroups.add(name);
      performance.mark(`gaia:${name}-load-end`);
      performance.measure(`gaia:${name}-load`, `gaia:${name}-load-start`, `gaia:${name}-load-end`);
      window.dispatchEvent(new CustomEvent("gaia:mode-group-loaded", { detail: { name } }));
    })().catch((error) => {
      groupPromises.delete(name);
      console.error(error);
      throw error;
    });
    groupPromises.set(name, promise);
    return promise;
  };

  const setTriggerPending = (trigger, pending) => {
    if (pending) {
      trigger.dataset.gaiaLazyPending = "true";
      trigger.setAttribute("aria-busy", "true");
    } else {
      delete trigger.dataset.gaiaLazyPending;
      trigger.removeAttribute("aria-busy");
    }
  };

  const interceptClick = (selector, group) => {
    document.addEventListener("click", (event) => {
      const trigger = event.target instanceof Element ? event.target.closest(selector) : null;
      if (!trigger || loadedGroups.has(group)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (trigger.dataset.gaiaLazyPending === "true") return;
      setTriggerPending(trigger, true);
      if (group === "character") setCharacterPreloader(true);
      void load(group).then(() => {
        setTriggerPending(trigger, false);
        trigger.click();
        if (group === "character") void waitForCharacterReady().then(() => setCharacterPreloader(false));
      }).catch(() => {
        setTriggerPending(trigger, false);
        if (group === "character") {
          setCharacterPreloader(true, { error: true });
          window.setTimeout(() => setCharacterPreloader(false), 1200);
        }
      });
    }, true);
  };

  const interceptEvent = (eventName, resolveGroup) => {
    window.addEventListener(eventName, (event) => {
      const group = resolveGroup(event);
      if (!group || loadedGroups.has(group)) return;
      event.stopImmediatePropagation();
      const detail = event.detail;
      void load(group).then(() => {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
      });
    }, true);
  };

  // The data-page footer exists before novel-mode registers its click handler.
  interceptClick('[data-intro-path="map"]', "exploration");
  interceptClick("[data-novel-open]", "story");
  interceptClick("[data-sound-gallery-open]", "sound");
  interceptClick("[data-character-gallery-open]", "character");
  interceptClick("#intro-gx-feature", "gx");
  interceptClick("[data-space-open]", "space");
  interceptClick('#gaia-statistics-button, [data-gaia-statistics-open], .gaia-map-action--analysis:not([aria-disabled="true"]):not(:disabled):not([data-analysis-needs-selection])', "statistics");
  interceptEvent("gaia:gx-open", () => "gx");
  interceptEvent("gaia:space-open-at-mode", () => "space");
  interceptEvent("gaia:novel-open-at-mode", () => "story");
  interceptEvent("gaia:story-mode-open", () => "exploration");
  interceptEvent("gaia:return-to-intro", () => "entry");

  const warmOnIntent = (selector, group) => {
    const warm = (event) => {
      if (loadedGroups.has(group)) return;
      const trigger = event.target instanceof Element ? event.target.closest(selector) : null;
      if (trigger) void load(group).catch(() => {});
    };
    document.addEventListener("pointerover", warm, { passive: true });
    document.addEventListener("focusin", warm);
  };
  warmOnIntent("[data-character-gallery-open]", "character");
  warmOnIntent("[data-sound-gallery-open]", "sound");
  window.addEventListener("gaia:return-to-intro", () => {
    void load("sound").catch(() => {});
  });

  globalThis.GaiaModeLoader = Object.freeze({
    load,
    isLoaded: (name) => loadedGroups.has(name),
  });

  // Stages run in sequence; groups within one stage run concurrently. In
  // particular, the tour must not initialize before exploration is ready.
  const routeStages = new Map([
    ["#top", [["entry"]]],
    ["#sound", [["sound"]]],
    ["#character", [["entry", "character"]]],
    ["#tour", [["exploration"], ["tour"]]],
    ...["#source", "#concept", "#earth", "#japan", "#data"].map((hash) => [hash, [["exploration"]]]),
  ]);

  const resolveRouteStages = ({ hash, pathname, search }) => {
    if (hash === "#story" || /\/story\/?$/iu.test(pathname)) return [["story"]];
    if (globalThis.GaiaMapRoute.isMapHash(hash)) return [["exploration"]];
    if (routeStages.has(hash)) return routeStages.get(hash);
    return new URLSearchParams(search).has("space") ? [["exploration", "space"]] : [];
  };

  const directRouteLoad = async () => {
    const stages = resolveRouteStages(window.location);
    if (!stages.length) return;
    for (const stage of stages) {
      // Preserve the direct await for single-group routes as well as order.
      if (stage.length === 1) await load(stage[0]);
      else await Promise.all(stage.map(load));
    }
    globalThis.__gaiaInitialViewReady = true;
    globalThis.__gaiaBootCheck?.();
  };

  void directRouteLoad().catch((error) => {
    console.error(error);
    globalThis.__gaiaInitialViewReady = true;
    globalThis.__gaiaBootCheck?.();
  });
  window.addEventListener("hashchange", () => {
    void directRouteLoad().catch(console.error);
  });
})();
