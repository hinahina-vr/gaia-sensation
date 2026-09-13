/** 概要: スマホ用の地図UI。展示一覧・凡例・操作をパネルにまとめ、既存の地図機能につなぐ。 */
(() => {
  "use strict";
  const layer = document.querySelector("#japan-layer");
  if (!layer || globalThis.GaiaMobileMap) return;
  const media = matchMedia("(max-width: 900px)");
  // Small, code-native illustrations: decorative, not simulated observation data.
  const iconPaths = {
    globe: '<circle cx="24" cy="24" r="17"/><ellipse cx="24" cy="24" rx="8" ry="17"/><path d="M8 18h32M8 30h32M24 7v34"/>',
    book: '<path d="M24 13c-6-5-13-5-19-3v27c7-2 13-1 19 4 6-5 12-6 19-4V10c-6-2-13-2-19 3v28M11 18l7 2m-7 6 7 2m12-8 7-2m-7 10 7-2"/>',
    tools: '<circle cx="24" cy="24" r="7"/><path d="m20 5-1 6-5 3-6-2-4 7 5 4v5l-5 4 4 7 6-2 5 3 1 6h8l1-6 5-3 6 2 4-7-5-4v-5l5-4-4-7-6 2-5-3-1-6z"/>',
    fire: '<path d="M27 4c3 11-8 13-5 20 4-2 7-6 8-10 10 10 12 18 5 25-7 7-21 5-25-5-3-8 2-16 8-21-1 9 4 9 9-9Z"/><path d="M24 27c-9 8-5 15 1 15s10-6-1-15Z"/>',
    wind: '<path d="M5 17h26c10 0 10-13 1-13-4 0-6 3-6 5M5 24h33c9 0 9 12 1 12-3 0-5-2-5-4M5 31h14c11 0 11 13 2 13-3 0-5-2-5-4"/>',
    air: '<circle cx="24" cy="24" r="6"/><circle cx="11" cy="10" r="4"/><circle cx="39" cy="15" r="4"/><circle cx="14" cy="40" r="4"/><path d="m14 13 6 7m10 1 5-4M21 30l-5 6M5 23h4m30 12 4 4"/>',
    quake: '<circle cx="24" cy="24" r="18"/><path d="M3 25h10l5-10 7 21 6-16 4 5h10"/>',
    cloud: '<path d="M13 34h23c13 0 12-19 0-19C33 2 13 4 12 19 0 18 0 34 13 34ZM14 40v3m10-3v4m10-4v3"/>',
    climate: '<path d="M20 9a4 4 0 0 1 8 0v21a9 9 0 1 1-8 0ZM24 17v20m10-25h6m-6 8h4m-4 8h6"/>',
    water: '<path d="M24 4S9 21 9 29a15 15 0 0 0 30 0C39 21 24 4 24 4ZM17 28c0 6 3 9 8 9"/>',
    forest: '<path d="m16 5-12 17h7L3 33h12v10m1-38 12 17h-7l8 11H17m17-18-7 12h5l-5 10h15l-5-10h5l-8-12Zm0 22v6"/>',
    current: '<path d="M4 15c7-12 13 12 20 0s13 12 20 0M4 25c7-12 13 12 20 0s13 12 20 0M4 35c7-12 13 12 20 0s13 12 20 0"/>',
    people: '<circle cx="24" cy="13" r="7"/><path d="M11 41v-6a13 13 0 0 1 26 0v6M6 12a5 5 0 0 1 0 10M2 36v-5a8 8 0 0 1 6-7m34-12a5 5 0 0 0 0 10m4 14v-5a8 8 0 0 0-6-7"/>',
    energy: '<path d="M27 3 9 28h14l-2 17 18-25H25l2-17Z"/>',
    recycle: '<path d="m17 13 6-10 10 16m-8-2 8 2 3-8M38 24l7 12H26m5-6-5 6 5 7M17 36H3l10-17m2 8-2-8-8 1"/>',
    chart: '<path d="M7 5v36h36M15 33V23h5v10m6 0V16h5v17m6 0V8h5v25M14 14l10-5 7 2 10-8"/>',
    play: '<circle cx="24" cy="24" r="18"/><path d="m20 15 13 9-13 9Z"/>',
    compass: '<circle cx="24" cy="24" r="18"/><path d="m31 17-4 10-10 4 4-10 10-4ZM24 2v5m0 34v5M2 24h5m34 0h5"/>',
    plus: '<circle cx="21" cy="21" r="14"/><path d="m32 32 11 11M14 21h14m-7-7v14"/>',
    minus: '<circle cx="21" cy="21" r="14"/><path d="m32 32 11 11M14 21h14"/>',
    reset: '<path d="M18 6H6v12m24-12h12v12M6 30v12h12m24-12v12H30"/><circle cx="24" cy="24" r="9"/>',
    sun: '<circle cx="24" cy="24" r="10"/><path d="M24 3v5m0 32v5M3 24h5m32 0h5M9 9l4 4m22 22 4 4M9 39l4-4m22-22 4-4"/>',
    home: '<path d="m4 23 20-18 20 18M10 19v23h28V19M20 42V28h8v14M30 7h7v9"/>',
    left: '<path d="m29 11-13 13 13 13"/>',
    right: '<path d="m19 11 13 13-13 13"/>',
  };
  const icon = kind => `<svg class="map-mobile-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[kind] || iconPaths.globe}</svg>`;
  const categoryIcons = { planet: "globe", climate: "climate", weather: "cloud", water: "water", people: "people", resources: "energy", earth: "quake" };
  const exhibitArt = {
    1: ["fire", "#ffab76"], 2: ["wind", "#70e7ed"], 3: ["air", "#b4bbff"],
    4: ["quake", "#ffc991"], 5: ["cloud", "#a3d4ff"], 6: ["air", "#f3b48f"],
    7: ["current", "#75d7ff"], 8: ["forest", "#75e8d3"], 9: ["recycle", "#a8eaaa"],
    12: ["forest", "#8ce3b7"], 13: ["energy", "#ffe39b"], 15: ["wind", "#70e7ed"],
    16: ["air", "#f3b48f"], 17: ["water", "#75d7ff"], 18: ["climate", "#f3b48f"],
    19: ["cloud", "#a3d4ff"], 20: ["air", "#b4bbff"], 22: ["compass", "#e8cf9b"],
    23: ["home", "#e8cf9b"], 27: ["water", "#95d8c2"], 28: ["sun", "#ffe39b"],
  };
  const artFor = number => {
    const category = globalThis.GaiaMapCategories?.get(number);
    return exhibitArt[number] || [categoryIcons[category?.id] || "globe", category?.color || "#9ee4dc"];
  };
  const toolbar = document.createElement("nav");
  toolbar.id = "map-mobile-toolbar";
  toolbar.setAttribute("aria-label", "地図のメニュー");
  toolbar.innerHTML = `<button type="button" data-mobile-exhibit-step="-1" aria-label="前の展示へ">${icon("left")}<span>前へ</span></button><button type="button" data-mobile-sheet="exhibits" aria-haspopup="dialog" aria-controls="map-mobile-sheet">${icon("globe")}<span>展示一覧</span></button><button type="button" data-mobile-sheet="reading" aria-haspopup="dialog" aria-controls="map-mobile-sheet">${icon("book")}<span>読み方・凡例</span></button><button type="button" data-mobile-sheet="tools" aria-haspopup="dialog" aria-controls="map-mobile-sheet">${icon("tools")}<span>操作</span></button><button type="button" data-mobile-exhibit-step="1" aria-label="次の展示へ">${icon("right")}<span>次へ</span></button>`;
  const sheet = document.createElement("dialog");
  sheet.id = "map-mobile-sheet";
  sheet.setAttribute("aria-labelledby", "map-mobile-sheet-title");
  sheet.innerHTML = `<header><span class="map-mobile-sheet-emblem" aria-hidden="true"></span><h2 id="map-mobile-sheet-title"></h2><button type="button" data-mobile-sheet-close aria-label="パネルを閉じる">×</button></header><div class="map-mobile-sheet-body"></div>`;
  const content = sheet.querySelector(".map-mobile-sheet-body");
  const heading = sheet.querySelector("h2");
  const ecologySummary = document.createElement("section");
  ecologySummary.className = "map-mobile-ecology-summary";
  ecologySummary.innerHTML = `<span>森林率と都市人口率を比べる</span><button type="button" aria-haspopup="dialog" aria-controls="map-mobile-sheet">比較・関係図を開く</button>`;
  layer.append(toolbar, ecologySummary, sheet);
  let opener = null;
  let metric = null;
  let ecologyHome = null;
  let exhibitPicker = null;
  const enabled = () => media.matches && !layer.hidden && layer.getAttribute("aria-hidden") !== "true"
    && !document.body.classList.contains("novel-mode-detour") && !layer.dataset.storyMode;
  const activeReadout = () => [...layer.querySelectorAll(".gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout, .gaia-marine-cod-readout, .gaia-food-readout")]
    .find(node => !node.hidden && getComputedStyle(node).display !== "none");
  const close = (restoreFocus = true) => {
    exhibitPicker?.cancelReveal(); exhibitPicker = null;
    if (!sheet.open) return;
    sheet.close();
    opener?.setAttribute("aria-expanded", "false");
    if (ecologyHome) {
      ecologyHome.placeholder.replaceWith(ecologyHome.panel);
      ecologyHome = null;
    }
    toolbar.querySelectorAll("button").forEach(button => button.setAttribute("aria-expanded", "false"));
    if (restoreFocus && enabled()) opener?.focus({ preventScroll: true });
  };
  const makeButton = (label, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  };
  const addCopy = (text, tag = "p") => {
    if (!text?.trim()) return;
    const node = document.createElement(tag);
    node.textContent = text;
    content.append(node);
  };
  // Read-only copies never move the provider's live nodes: their renderers keep
  // querying those nodes, even while the modal is open. No copied IDs or controls.
  const copy = node => {
    if (!node) return;
    const clone = node.cloneNode(true);
    for (const mark of clone.querySelectorAll("[data-encoding-mark]")) {
      const original = node.querySelector(`[data-encoding-mark="${mark.dataset.encodingMark}"]`);
      const style = getComputedStyle(original);
      for (const property of ["background", "width", "height", "border", "box-shadow"]) mark.style.setProperty(property, style.getPropertyValue(property));
    }
    for (const item of [clone, ...clone.querySelectorAll("*")]) {
      for (const name of [...item.getAttributeNames()]) {
        if (name === "id" || (name === "hidden" && item === clone) || name === "tabindex" || name.startsWith("aria-") || name.startsWith("data-")) item.removeAttribute(name);
      }
      if (item !== clone && item.matches("button, input, select")) item.remove();
    }
    clone.classList.add("map-mobile-reading-copy");
    content.append(clone);
  };
  const renderReading = () => {
    const attribution = document.createElement('details');
    attribution.className = 'map-mobile-source-credits';
    const summary = document.createElement('summary');
    summary.textContent = 'データの出典';
    attribution.append(summary);
    for (const link of layer.querySelectorAll('.japan-credits a[href]')) {
      if (!link.textContent.trim() || link.closest('[hidden]')) continue;
      const clone = link.cloneNode(true);
      clone.removeAttribute('class');
      attribution.append(clone);
    }
    content.append(attribution);
    if (!layer.matches(".is-marine-cod-exhibit, .is-food-exhibit")) addCopy(layer.querySelector("#japan-description")?.textContent);
    addCopy("数値はこのパネルを開いた時点の表示です。");
    const readout = activeReadout();
    if (readout) {
      if (readout.classList.contains("gaia-food-readout")) {
        copy(layer.querySelector(".gaia-food-key"));
        copy(layer.querySelector(".gaia-food-guide"));
        copy(readout.querySelector(".gaia-food-count"));
        return;
      }
      if (readout.classList.contains("gaia-marine-cod-readout")) {
        copy(layer.querySelector(".gaia-annual-metric-legend"));
        copy(readout.querySelector(".gaia-cod-count"));
        return;
      }
      copy(readout.querySelector(".gaia-realtime-status"));
      const legend = [...layer.querySelectorAll(".gaia-firms-legend, .gaia-planet-signals-legend, .gaia-live-metric-legend, .gaia-estat-heat-legend")].find(node => !node.hidden);
      copy(legend);
      for (const selector of [".gaia-live-deck-question", ".gaia-live-exhibit-details", ".gaia-estat-copy", ".gaia-estat-comparison", ".gaia-firms-count", ".gaia-firms-copy", ".gaia-firms-quality", ".gaia-planet-copy", ".gaia-planet-metrics"]) copy(readout.querySelector(selector));
    } else {
      if (metric) {
        addCopy(metric.title, "h3");
        addCopy(metric.current);
        const scale = document.createElement("div");
        scale.className = "map-mobile-metric-scale";
        scale.style.background = `linear-gradient(90deg, ${metric.colors.join(",")})`;
        const marker = document.createElement("i");
        marker.style.left = `${metric.progress * 100}%`;
        scale.append(marker);
        content.append(scale);
        addCopy(`${metric.minimumLabel} — ${metric.maximumLabel}${metric.scale === "log" ? "（対数目盛）" : ""}`);
      }
      copy(layer.querySelector(".map-reading-guide-body"));
      const legend = layer.querySelector("[data-signal-encoding-legend]");
      if (legend && !legend.hidden) { addCopy("凡例", "h3"); copy(legend); }
      const timeline = layer.querySelector("#co2-timeline-display");
      if (timeline && !timeline.hidden) addCopy(timeline.textContent.trim().replace(/\s+/gu, " "));
    }
  };
  const renderExhibits = () => {
    const current = globalThis.GaiaMapCategories?.buttons().find(button => button.getAttribute("aria-current") === "true");
    const intro = document.createElement("div");
    intro.className = "map-mobile-collection-intro";
    intro.innerHTML = `<p>どの地球を、見にいく？</p><span>${globalThis.GaiaMapCategories.buttons().length}<small>の展示</small></span>`;
    content.append(intro);
    const picker = globalThis.GaiaMapCategories.createScopePicker("map-mobile-picker",
      globalThis.GaiaMapCategories.getProfile(current?.textContent)?.scope, () => { content.scrollTop = 0; });
    exhibitPicker = picker;
    content.append(picker.element);
    const guide = document.createElement("details");
    guide.className = "map-picker-profile-guide";
    const summary = document.createElement("summary");
    summary.textContent = "LIVEについて";
    const explanation = document.createElement("p");
    explanation.textContent = globalThis.GaiaMapCategories.profileGuide;
    guide.append(summary, explanation);
    picker.tabs.after(guide);
    for (const scope of globalThis.GaiaMapCategories.scopes) {
      const panel = picker.panels.get(scope.id);
      const jump = document.createElement("nav");
      jump.className = "map-mobile-category-nav";
      jump.setAttribute("aria-label", `${scope.label}展示のテーマへ移動`);
      panel.append(jump);
      for (const category of scope.categories) {
      const section = document.createElement("section");
      section.className = "map-mobile-category";
      section.dataset.mapCategory = category.id;
      section.style.setProperty("--card-accent", category.color);
      const title = document.createElement("h3");
      title.innerHTML = `${icon(categoryIcons[category.id])}<span>${category.label}</span><small>${category.numbers.length} 展示</small>`;
      title.tabIndex = -1;
      const shortcut = makeButton(category.label, () => {
        section.scrollIntoView({ behavior: "instant", block: "start" });
        title.focus({ preventScroll: true });
      });
      shortcut.style.setProperty("--card-accent", category.color);
      jump.append(shortcut);
      section.append(title);
      for (const number of category.numbers) {
        const target = globalThis.GaiaMapCategories.buttons().find(button => Number(button.textContent) === number);
        if (!target) continue;
        // Read the catalog title directly: punctuation can be part of a title.
        const exhibit = [
          ...(globalThis.GaiaAppContent?.modes || []),
          ...(globalThis.GaiaLiveExhibits?.definitions || []),
          ...(globalThis.GaiaEstatExhibits?.definitions || []),
          globalThis.GaiaFirmsExhibit?.definition,
          ...(globalThis.GaiaMarineCod?.definitions || []),
          ...(globalThis.GaiaFoodExhibits?.definitions || []),
          ...(globalThis.GaiaPlanetSignals?.definitions || []),
        ].find(item => item && Number(item.mapNumber || item.number) === number);
        const publicNumber = String(number).padStart(2, "0");
        const name = exhibit?.titleJa || exhibit?.shortTitle || target.getAttribute("aria-label") || publicNumber;
        const button = makeButton("", () => { close(); target.click(); });
        button.style.setProperty("--card-accent", category.color);
        button.textContent = publicNumber;
        const tile = globalThis.GaiaMapCategories.getTile(number);
        button.setAttribute("aria-label", [tile.symbol, tile.detail, name].filter(Boolean).join("・"));
        globalThis.GaiaMapCategories.decorateTile(button, number);
        const profile = globalThis.GaiaMapCategories.getProfile(number);
        const subtitle = globalThis.GaiaAppContent?.MAP_TITLE_SUBTITLES[publicNumber];
        button.setAttribute("aria-description", [profile?.scopeLabel, profile?.timeLabel, subtitle].filter(Boolean).join("。"));
        button.setAttribute("aria-current", String(target === current));
        button.dataset.mobileExhibit = String(number);
        section.append(button);
      }
      panel.append(section);
      }
    }
  };
  const renderTools = () => {
    const readout = activeReadout();
    const actions = document.createElement("div");
    actions.className = "map-mobile-tool-grid";
    const proxy = (label, target, illustration, description, tone) => {
      if (!target) return;
      const button = makeButton(label, () => { close(); target.click(); });
      button.className = "map-mobile-action-card";
      button.setAttribute("aria-label", label);
      button.style.setProperty("--card-accent", tone);
      button.innerHTML = `${icon(illustration)}<span class="map-mobile-action-label"></span><small></small><span class="map-mobile-action-arrow" aria-hidden="true">›</span>`;
      button.querySelector(".map-mobile-action-label").textContent = label;
      button.querySelector("small").textContent = target.dataset.actionDescription || description;
      if (['gaia-map-demo-toggle', 'gaia-map-playback-toggle', 'gaia-map-cruise-toggle'].includes(target.id)) {
        button.dataset.mobileTransport = target.id;
        button.setAttribute('aria-pressed', target.getAttribute('aria-pressed') || 'false');
      }
      if (target.id === 'gaia-map-cruise-toggle') button.dataset.mobileCruise = '';
      if (target.matches('[data-gaia-mode-guide-replay="map"]')) button.dataset.mobileGuide = '';
      button.disabled = target.disabled || target.getAttribute("aria-disabled") === "true";
      if (button.disabled) button.querySelector("small").textContent = target.dataset.disabledReason || "この展示では対象外";
      if (button.disabled && target.dataset.disabledReason) {
        const item = document.createElement("div");
        item.className = "map-mobile-tool-unavailable";
        const reason = document.createElement("small");
        reason.id = `map-mobile-action-reason-${actions.children.length}`;
        reason.textContent = target.dataset.disabledReason;
        button.setAttribute("aria-describedby", reason.id);
        item.append(button, reason);
        actions.append(item);
      } else actions.append(button);
    };
    proxy("データの出典", readout?.querySelector(".gaia-map-action--source") || layer.querySelector("#japan-data-button"), "book", "観測の背景をたどる", "#7adfff");
    proxy("統計分析", readout?.querySelector(".gaia-map-action--analysis") || layer.querySelector("#gaia-statistics-button"), "chart", "データの関係を発見", "#ffe19a");
    const playback = layer.querySelector('#gaia-map-playback-toggle');
    proxy(playback?.getAttribute('aria-pressed') === 'true' ? '自動表示をやめる' : '自動表示する', playback, 'play', '展示内の年・時刻などを進める', '#a1e0d2');
    const cruise = layer.querySelector('#gaia-map-cruise-toggle');
    proxy(cruise?.getAttribute('aria-pressed') === 'true' ? 'クルージング停止' : 'クルージングモード', cruise, 'play', '全展示をデータ・地点に沿って巡る', '#a1e0d2');
    proxy("地図ガイド", layer.querySelector('[data-gaia-mode-guide-replay="map"]'), "compass", "楽しみ方を見つける", "#91ebbe");
    proxy("最大の震源へ", readout?.querySelector("[data-planet-epicenter]:not([hidden])"), "quake", "地図で場所を見る", "#ffbd94");
    content.append(actions);
    addCopy("地図を動かす", "h3");
    const zoom = document.createElement("div");
    zoom.className = "map-mobile-zoom-grid";
    for (const [id, label] of [["in", "＋ 拡大"], ["out", "− 縮小"], ["reset", "全体に戻す"]]) {
      const target = layer.querySelector(`#gaia-map-zoom-${id}`);
      if (id === 'reset' && target?.hidden) continue;
      const button = makeButton(label, () => { close(); target?.click(); });
      button.setAttribute("aria-label", label);
      button.innerHTML = `${icon({ in: "plus", out: "minus", reset: "reset" }[id])}<span>${label}</span>`;
      if (id === 'reset') {
        const kind = target.dataset.overview;
        button.innerHTML = `${target.querySelector(`[data-overview-icon="${kind}"]`).outerHTML}<span>${kind === 'japan' ? '日本全体に戻す' : '世界全体に戻す'}</span>`;
        button.setAttribute('aria-label', target.getAttribute('aria-label'));
        button.title = target.dataset.tooltip;
      }
      button.disabled = target?.disabled ?? true;
      zoom.append(button);
    }
    content.append(zoom);
    addCopy("ドラッグで移動 · 2本指で拡大・縮小");
  };
  const open = (kind, trigger) => {
    if (!enabled()) return;
    close(false);
    opener = trigger;
    content.replaceChildren();
    sheet.dataset.panel = kind;
    heading.textContent = { exhibits: "展示を選ぶ", reading: "読み方・凡例", tools: "地図の操作", ecology: "三つの生態系を比べる" }[kind];
    sheet.querySelector(".map-mobile-sheet-emblem").innerHTML = icon({ exhibits: "globe", reading: "book", tools: "compass", ecology: "forest" }[kind]);
    if (kind === "ecology") {
      const panel = layer.querySelector(".ecologies-exhibit");
      const placeholder = document.createComment("ecology-panel-home");
      panel.before(placeholder);
      ecologyHome = { panel, placeholder };
      content.append(panel);
    } else ({ exhibits: renderExhibits, reading: renderReading, tools: renderTools })[kind]();
    trigger?.setAttribute("aria-expanded", "true");
    sheet.showModal();
    content.scrollTop = 0;
    exhibitPicker?.reveal({ includeTabs: true });
    sheet.querySelector("[data-mobile-sheet-close]").focus({ preventScroll: true });
  };
  toolbar.addEventListener("click", event => {
    const step = event.target.closest("[data-mobile-exhibit-step]");
    if (step && enabled()) {
      close(false);
      const buttons = globalThis.GaiaMapCategories?.buttons() || [];
      const index = buttons.findIndex(button => button.getAttribute("aria-current") === "true");
      if (index >= 0) buttons[(index + Number(step.dataset.mobileExhibitStep) + buttons.length) % buttons.length].click();
      return;
    }
    const trigger = event.target.closest("[data-mobile-sheet]");
    if (trigger) open(trigger.dataset.mobileSheet, trigger);
  });
  ecologySummary.querySelector("button").addEventListener("click", event => open("ecology", event.currentTarget));
  sheet.querySelector("[data-mobile-sheet-close]").addEventListener("click", () => close());
  sheet.addEventListener("cancel", event => { event.preventDefault(); close(); });
  // Keep map-level keyboard shortcuts from closing or changing the underlying
  // map. Native dialog owns the inert background and button activation.
  addEventListener("keydown", event => {
    if (!sheet.open) return;
    if (event.key === "Escape") { event.stopImmediatePropagation(); event.preventDefault(); close(); }
  }, true);
  sheet.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.key !== "Tab") return;
    const targets = [...sheet.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length
        && getComputedStyle(node).visibility !== "hidden" && !node.closest("[inert]"));
    const first = targets[0], last = targets.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  let backdropDown = false;
  const outside = event => { const rect = sheet.getBoundingClientRect(); return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom; };
  sheet.addEventListener("pointerdown", event => { backdropDown = outside(event); });
  sheet.addEventListener("click", event => { if (backdropDown && outside(event)) close(); backdropDown = false; });
  const sync = () => {
    const active = enabled();
    layer.classList.toggle("is-mobile-map-shell", active);
    document.body.classList.toggle("has-mobile-map-shell", active);
    if (!active) close(false);
    if (active) scheduleLayout();
  };
  // Measure the real dock, including changing live status and safe-area sizes.
  // A higher z-index alone merely hides the other card; reserve separate space.
  let layoutFrame = 0;
  const scheduleLayout = () => {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      if (!enabled()) return;
      const current = globalThis.GaiaMapCategories?.buttons().find(button => button.getAttribute("aria-current") === "true");
      layer.style.setProperty("--mobile-exhibit-accent", artFor(Number(current?.textContent))[1]);
      const readout = activeReadout() || (layer.classList.contains("is-ecologies-exhibit") ? ecologySummary : layer.querySelector(".signal-console-map"));
      const top = readout?.getBoundingClientRect().top || toolbar.getBoundingClientRect().top;
      layer.style.setProperty("--mobile-poi-bottom", `${Math.ceil(innerHeight - top + 10)}px`);
      layer.style.setProperty("--mobile-heading-bottom", `${Math.ceil(layer.querySelector(".japan-heading").getBoundingClientRect().bottom + 12)}px`);
    });
  };
  const sizeObserver = new ResizeObserver(scheduleLayout);
  const watchReadouts = () => {
    for (const node of layer.querySelectorAll(".japan-heading, .signal-console-map, .gaia-live-exhibit-readout, .gaia-estat-readout, .gaia-firms-readout, .gaia-planet-signals-readout, .gaia-marine-cod-readout, .gaia-food-readout, .map-mobile-ecology-summary")) sizeObserver.observe(node);
    scheduleLayout();
  };
  new MutationObserver(watchReadouts).observe(layer, { childList: true });
  addEventListener("resize", scheduleLayout);
  const onMode = () => { metric = null; close(); sync(); };
  for (const name of ["gaia:japan-mode-change", "gaia:live-exhibit-change", "gaia:estat-exhibit-change", "gaia:firms-change", "gaia:planet-signals-change", "gaia:marine-cod-change", "gaia:food-change"]) addEventListener(name, onMode);
  new MutationObserver(sync).observe(layer, { attributes: true, attributeFilter: ["hidden", "aria-hidden", "data-story-mode"] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  media.addEventListener("change", sync);
  globalThis.GaiaMobileMap = Object.freeze({ isActive: enabled, setMetric: value => { metric = value; }, close, openExhibits: trigger => open('exhibits', trigger) });
  watchReadouts();
  sync();
})();
