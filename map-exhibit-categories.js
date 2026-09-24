(() => {
  "use strict";

  // The five global spectacles lead the route; the remaining exhibits retain
  // their relative order within the subject groups. IDs/renderer indices stay stable.
  const definitions = Object.freeze([
    { id: "planet", label: "惑星のいま", summary: "火災・風・大気・地震・雲を世界から", color: "#9ee4dc", numbers: [1, 2, 3, 4, 5] },
    { id: "climate", label: "気候と炭素", summary: "CO₂濃度・長期の気温変化", color: "#f3b48f", numbers: [6, 16, 24, 25, 26] },
    { id: "weather", label: "空と天気", summary: "風・雲・気温・空気の状態", color: "#9ed5ed", numbers: [15, 18, 19, 20, 27, 28, 38, 39, 40, 41, 42, 43] },
    { id: "air", label: "大気と汚染", summary: "SO₂・NOx・Ox・粒子・炭化水素の実測", color: "#d7c3ed", numbers: [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54] },
    { id: "water", label: "水と森", summary: "海流・雨・森林・海川湖の水質", color: "#95d8c2", numbers: [7, 8, 12, 17, 29, 30, 31, 32, 33, 34, 35, 36, 37] },
    { id: "water-quality", label: "水質と汚濁", summary: "BOD・COD・SS・栄養塩・油分・金属・界面活性剤", color: "#a7d9c7", numbers: [55, 56, 57, 58, 59, 60, 61, 62, 63, 64] },
    { id: "chemicals", label: "化学物質の行方", summary: "PRTR事業所の届出排出量・移動量", color: "#d6b8ec", numbers: [65, 66, 67] },
    { id: "biology", label: "生きものの記録", summary: "河川の魚類・底生生物の確認分類群", color: "#bae6cd", numbers: [68, 69] },
    { id: "food", label: "食卓と世界", summary: "食料の生産・貿易と、供給を支える構造", color: "#e5d5a8", numbers: [70, 71] },
    { id: "people", label: "人口と暮らし", summary: "人口・移動・旅・住まい", color: "#e8cf9b", numbers: [14, 21, 22, 23] },
    { id: "resources", label: "資源とエネルギー", summary: "再資源化・排出・再生可能電力", color: "#b8c9ef", numbers: [9, 10, 13] },
    { id: "earth", label: "大地の活動", summary: "世界の大地震、その時と場所", color: "#d7abd8", numbers: [11] },
  ].map(category => Object.freeze({ ...category, numbers: Object.freeze(category.numbers) })));
  const byNumber = new Map(definitions.flatMap(category => category.numbers.map(number => [number, category])));
  const get = number => byNumber.get(Number(number)) || null;
  const buttons = (root = document) => [...root.querySelectorAll(".map-mode-bank .map-mode-button")]
    .sort((a, b) => Number(a.textContent.trim()) - Number(b.textContent.trim()));
  const standardButtons = () => buttons().filter(button => button.hasAttribute("data-map-standard-index"));
  // Classify the main dataset, not its animation or current connection state.
  // A country ranking is not a chronological series; a saved live-feed value
  // does not become historical playback merely because the network is offline.
  const timeTypes = Object.freeze({ realtime: "リアルタイム", series: "時系列", comparison: "比較", simulation: "試算" });
  const exhibitCount = Math.max(...byNumber.keys());
  const profiles = new Map(Array.from({ length: exhibitCount }, (_, index) => {
    const number = index + 1;
    const scope = number <= 14 || number >= 70 ? "world" : "japan";
    const time = number <= 5 || (number >= 15 && number <= 20) ? "realtime"
      : number === 7 ? "simulation" : [8, 9, 12, 13, 65, 66, 67].includes(number) ? "comparison" : "series";
    return [number, Object.freeze({ scope, time, scopeLabel: scope === "world" ? "世界" : "日本", timeLabel: timeTypes[time] })];
  }));
  const getProfile = number => profiles.get(Number(number)) || null;
  const profileGuide = "LIVEは定期更新の展示（保存値を含む）。接続状態・測定条件・出典は展示内で確認できます。";
  // These are measured quantities or concise exhibit subjects, not invented
  // element symbols. Small qualifiers distinguish otherwise identical tiles.
  const tileDefinitions = Object.freeze([
    ["風速"], ["地震"], ["PM2.5"], ["火災"], ["雲量"],
    ["CO₂"], ["海流"], ["森林"], ["再生", "資源"], ["CO₂", "排出量"],
    ["地震", "記録"], ["生態", "3つの層"], ["電力", "再エネ率"], ["人口"],
    ["風速"], ["CO₂"], ["降水"], ["気温"], ["雲量"], ["PM2.5"],
    ["転入", "超過数"], ["宿泊", "延べ人数"], ["住宅", "着工数"],
    ["気温", "年平均"], ["気温", "日最高平均"], ["気温", "日最低平均"],
    ["湿度", "年平均"], ["日照", "時間"], ["降水", "年合計"], ["降水", "日数"],
    ["COD", "海"], ["pH", "海"], ["DO", "海"], ["pH", "川"], ["DO", "川"], ["pH", "湖"], ["DO", "湖"],
    ["気温", "観測点"], ["湿度", "観測点"], ["気圧"], ["降水", "観測点"], ["風速", "年平均"], ["日射"],
    ["SO₂"], ["NO"], ["NO₂"], ["NOx"], ["CO"], ["Ox"], ["NMHC"], ["CH₄"], ["THC"], ["SPM"], ["PM2.5"],
    ["BOD", "川"], ["COD", "川"], ["COD", "湖"], ["SS"], ["T-N"], ["T-P"],
    ["油分", "n-Hex抽出"], ["Zn", "全亜鉛"], ["LAS"], ["NP"],
    ["PRTR", "大気"], ["PRTR", "水域"], ["PRTR", "移動"],
    ["底生", "分類群数"], ["魚類", "分類群数"], ["需給", "食料"], ["供給", "食料指標"],
  ].map(([symbol, detail = ""]) => Object.freeze({ symbol, detail })));
  const getTile = number => tileDefinitions[Number(number) - 1] || null;
  const decorateTile = (button, number) => {
    const tile = getTile(number), profile = getProfile(number);
    if (!tile || !profile) return;
    button.classList.add("map-periodic-tile");
    button.dataset.mapSymbol = tile.symbol;
    button.dataset.mapDetail = tile.detail;
    button.dataset.mapSymbolSize = tile.symbol.length >= 4 ? "long" : "normal";
    button.dataset.mapScope = profile.scope;
    button.dataset.mapTime = profile.time;
    // All added nodes have empty textContent. The original numeric text stays
    // intact for existing routing, hover previews, next/previous and providers.
    if (tile.detail && !button.querySelector(".map-tile-detail")) {
      const detail = document.createElement("span");
      detail.className = "map-tile-detail";
      detail.dataset.label = tile.detail;
      detail.setAttribute("aria-hidden", "true");
      button.append(detail);
    }
    if (profile.time === "realtime" && !button.querySelector(".map-tile-live")) {
      const live = document.createElement("span");
      live.className = "map-tile-live";
      live.setAttribute("aria-hidden", "true");
      button.append(live);
    }
  };
  const scopedSummaries = {
    world: { climate: "世界のCO₂濃度の推移", water: "海流・森林・地球の生態系", people: "世界の人口の推移" },
    japan: { climate: "日本のCO₂観測・長期の気温変化", water: "雨・海川湖の水質", people: "日本の人口・移動・旅・住まい" },
  };
  // Retain one subject identity and the numeric route. Scope is the picker's
  // primary level; mixed subjects are split without duplicating real buttons.
  const scopes = Object.freeze(["world", "japan"].map(id => {
    const categories = definitions.map(category => Object.freeze({
      ...category,
      summary: scopedSummaries[id][category.id] || category.summary,
      numbers: Object.freeze(category.numbers.filter(number => getProfile(number).scope === id)),
    })).filter(category => category.numbers.length);
    return Object.freeze({ id, label: id === "world" ? "世界" : "日本", categories: Object.freeze(categories), count: categories.reduce((sum, category) => sum + category.numbers.length, 0) });
  }));
  const pickerMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pickerAnimations = new Set();
  const stopPickerAnimations = () => {
    for (const animation of pickerAnimations) animation.cancel();
    pickerAnimations.clear();
  };
  pickerMotion.addEventListener('change', () => { if (pickerMotion.matches) stopPickerAnimations(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPickerAnimations(); });
  const createScopePicker = (prefix, initialScope, onSelect = () => {}) => {
    const element = document.createElement("div");
    element.className = "map-scope-picker";
    const tabs = document.createElement("div");
    tabs.className = "map-scope-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "展示の対象エリア");
    element.append(tabs);
    const panels = new Map();
    const controls = new Map();
    let selectedScope = null;
    let revealFrame = 0;
    const animations = new Set();
    const cancelReveal = () => {
      cancelAnimationFrame(revealFrame); revealFrame = 0;
      for (const animation of animations) { pickerAnimations.delete(animation); animation.cancel(); }
      animations.clear();
    };
    const reveal = ({ includeTabs = false } = {}) => {
      cancelReveal();
      if (pickerMotion.matches || document.hidden) return;
      revealFrame = requestAnimationFrame(() => {
        revealFrame = 0;
        if (pickerMotion.matches || document.hidden || !element.isConnected || !element.checkVisibility({ visibilityProperty: true })) return;
        const panel = panels.get(selectedScope);
        if (!panel || panel.hidden) return;
        // Measure first, then animate in visual reading order, not category DOM
        // order. Depth and a traveling flash finish in 0.8 s even for 55 tiles.
        const targets = [...(includeTabs ? controls.values() : []), ...panel.querySelectorAll('.map-periodic-tile, .map-mobile-category-nav button')]
          .map(button => {
            const style = getComputedStyle(button);
            return { button, rect: button.getBoundingClientRect(), rest: {
              boxShadow: style.boxShadow, borderColor: style.borderColor,
              backgroundColor: style.backgroundColor, textShadow: style.textShadow,
            } };
          })
          .filter(({ rect }) => rect.width && rect.height)
          .sort((a, b) => Math.abs(a.rect.top - b.rect.top) > 8 ? a.rect.top - b.rect.top : a.rect.left - b.rect.left);
        const stagger = Math.min(26, 360 / Math.max(1, targets.length - 1));
        targets.forEach(({ button, rect, rest }, index) => {
          // Wide scope tabs need less tilt to keep their edges on screen.
          const tilt = rect.width > 240 ? 3 : 12;
          const animation = button.animate([
            { ...rest, opacity: 0, transform: `perspective(700px) translate3d(0, 24px, -320px) rotateX(28deg) rotateY(-${tilt}deg)`, offset: 0, easing: 'cubic-bezier(.2,.7,.3,1)' },
            { opacity: 1, transform: `perspective(700px) translate3d(0, 4px, -65px) rotateX(10deg) rotateY(-${tilt / 2}deg)`,
              borderColor: '#baffff', backgroundColor: '#256779', textShadow: '0 0 8px #a5ffff',
              boxShadow: 'inset 0 0 16px #adffff66, 0 0 18px #66edffaa', offset: .28, easing: 'cubic-bezier(.16,.8,.3,1)' },
            { opacity: 1, transform: 'perspective(700px) translate3d(0, -3px, 48px) rotateX(-4deg) rotateY(1deg)',
              borderColor: '#f1ffff', backgroundColor: '#398697', textShadow: '0 0 12px #d9ffff',
              boxShadow: 'inset 0 0 0 1px #eeffff, inset 0 0 26px #baffff99, 0 0 12px #e4ffff, 0 0 34px #59e9ffdd', offset: .48, easing: 'cubic-bezier(.3,0,.3,1)' },
            { ...rest, opacity: 1, transform: 'perspective(700px) translate3d(0, 1px, -8px) rotateX(2deg) rotateY(0deg)',
              borderColor: '#91e9ee', boxShadow: 'inset 0 0 8px #a4ffff33, 0 0 14px #59e9ff66', offset: .76, easing: 'cubic-bezier(.2,.7,.3,1)' },
            { ...rest, opacity: 1, transform: 'perspective(700px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)', offset: 1 },
          ], { duration: 440, delay: index * stagger, easing: 'linear', fill: 'backwards' });
          animation.id = 'map-picker-reveal';
          animations.add(animation); pickerAnimations.add(animation);
          const forget = () => { animations.delete(animation); pickerAnimations.delete(animation); };
          animation.onfinish = forget; animation.oncancel = forget;
        });
      });
    };
    const select = id => {
      if (!panels.has(id) || selectedScope === id) return;
      selectedScope = id;
      for (const scope of scopes) {
        const selected = scope.id === id;
        const button = controls.get(scope.id);
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
        panels.get(scope.id).hidden = !selected;
      }
      onSelect(id);
      reveal();
    };
    for (const scope of scopes) {
      const button = document.createElement("button");
      button.type = "button";
      button.id = `${prefix}-${scope.id}-tab`;
      button.dataset.mapScope = scope.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `${prefix}-${scope.id}-panel`);
      const label = document.createElement("strong");
      label.textContent = scope.label;
      const count = document.createElement("small");
      count.textContent = `${scope.count} 展示`;
      button.append(label, count);
      button.addEventListener("click", () => select(scope.id));
      const panel = document.createElement("div");
      panel.className = "map-scope-panel";
      panel.id = `${prefix}-${scope.id}-panel`;
      panel.dataset.mapScope = scope.id;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id);
      panels.set(scope.id, panel);
      controls.set(scope.id, button);
      tabs.append(button);
      element.append(panel);
    }
    tabs.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const index = scopes.findIndex(scope => scope.id === selectedScope);
      const next = event.key === "Home" ? 0 : event.key === "End" ? scopes.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + scopes.length) % scopes.length;
      select(scopes[next].id);
      controls.get(scopes[next].id).focus({ preventScroll: true });
    });
    select(initialScope || "world");
    return { element, tabs, panels, select, reveal, cancelReveal };
  };
  let desktopPicker = null;
  const showCurrentScope = () => {
    const number = document.querySelector("#japan-mode-number")?.textContent.trim();
    desktopPicker?.select(getProfile(number)?.scope || "world");
    desktopPicker?.reveal({ includeTabs: true });
    const popover = document.querySelector(".map-dock-bank-popover");
    if (popover) popover.scrollTop = 0;
  };
  globalThis.GaiaMapCategories = Object.freeze({ definitions, scopes, get, buttons, standardButtons, getProfile, getTile, decorateTile, profileGuide, exhibitCount, createScopePicker, showCurrentScope, cancelReveal: () => desktopPicker?.cancelReveal() });

  const layer = document.querySelector("#japan-layer");
  const groups = layer?.querySelector(".map-mode-groups");
  if (!layer || !groups) return;
  const guide = document.createElement("p");
  guide.className = "map-picker-profile-guide";
  guide.textContent = profileGuide;
  desktopPicker = createScopePicker("map-picker", "world", () => {
    const popover = layer.querySelector(".map-dock-bank-popover");
    if (popover) popover.scrollTop = 0;
    groups.scrollTop = 0;
  });
  desktopPicker.tabs.after(guide);
  groups.prepend(desktopPicker.element);
  const descriptions = new Map();
  const sections = new Map();
  let scheduled = false;
  let currentNumber = null;
  const setText = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  const sync = () => {
    scheduled = false;
    for (const scope of scopes) for (const category of scope.categories) {
      const sectionKey = `${scope.id}-${category.id}`;
      if (!sections.has(sectionKey)) {
        const section = document.createElement("section");
        section.className = "map-mode-group map-category-group";
        section.dataset.mapCategory = category.id;
        section.dataset.mapScope = scope.id;
        section.style.setProperty("--map-category-color", category.color);
        section.style.setProperty("--map-category-columns", category.numbers.length === 6 ? "3" : "5");
        const heading = document.createElement("p");
        heading.className = "map-mode-group-label";
        heading.id = `map-category-${sectionKey}-label`;
        const title = document.createElement("strong");
        title.textContent = category.label;
        const count = document.createElement("small");
        count.textContent = `${category.numbers.length} 展示`;
        heading.append(title, count);
        const summary = document.createElement("p");
        summary.className = "map-category-summary";
        summary.textContent = category.summary;
        const grid = document.createElement("div");
        grid.className = "map-mode-list map-category-list";
        section.setAttribute("aria-labelledby", heading.id);
        section.append(heading, summary, grid);
        desktopPicker.panels.get(scope.id).append(section);
        sections.set(sectionKey, section);
      }
    }
    for (const button of buttons()) {
      const category = get(button.textContent.trim());
      if (!category) continue;
      const profile = getProfile(button.textContent.trim());
      const grid = sections.get(`${profile.scope}-${category.id}`).querySelector(".map-category-list");
      if (button.parentElement !== grid) {
        // Lazy providers can mount out of exhibit order (fire before wind).
        const next = [...grid.children].find(item => Number(item.textContent.trim()) > Number(button.textContent.trim()));
        grid.insertBefore(button, next || null);
      }
      if (button.dataset.mapCategory !== category.id) button.dataset.mapCategory = category.id;
      decorateTile(button, Number(button.textContent.trim()));
      if (profile) {
        for (const [key, value] of Object.entries({ mapScope: profile.scope, mapTime: profile.time,
          mapScopeLabel: profile.scopeLabel, mapTimeLabel: profile.timeLabel })) {
          if (button.dataset[key] !== value) button.dataset[key] = value;
        }
        // Preserve the numeric text node used by routing and renderer indices.
        // CSS supplies the visible caption; this shared text supplies its
        // screen-reader equivalent without changing any button's identity.
        const id = `map-profile-${profile.scope}-${profile.time}`;
        if (!descriptions.has(id)) {
          const description = document.createElement("span");
          description.id = id;
          description.hidden = true;
          description.textContent = `${profile.scopeLabel}展示・${profile.timeLabel}${profile.time === "realtime" ? "型。接続状態や保存値は展示内で確認できます。" : "展示"}`;
          groups.append(description);
          descriptions.set(id, description);
        }
        const describedBy = new Set((button.getAttribute("aria-describedby") || "").split(/\s+/u).filter(Boolean));
        describedBy.add(id);
        const nextDescription = [...describedBy].join(" ");
        if (button.getAttribute("aria-describedby") !== nextDescription) button.setAttribute("aria-describedby", nextDescription);
      }
    }
    // Keep the original mounting points for lazy-loaded providers. Relocating
    // the real buttons preserves their listeners, references and accessibility.
    for (const section of groups.querySelectorAll(":scope > .map-mode-group:not(.map-category-group)")) {
      section.hidden = true;
      section.dataset.mapSourceMount = "true";
    }
    groups.classList.add("is-themed");
    for (const section of sections.values()) section.hidden = !section.querySelector(".map-mode-button");
    const number = layer.querySelector("#japan-mode-number")?.textContent.trim();
    const category = get(number);
    if (!category) return;
    const profile = getProfile(number);
    if (currentNumber !== number) {
      currentNumber = number;
      desktopPicker.select(profile.scope);
    }
    layer.dataset.mapCategory = category.id;
    for (const section of sections.values()) {
      section.classList.toggle("is-current-category", section.dataset.mapCategory === category.id && section.dataset.mapScope === profile.scope);
    }
    for (const chapter of layer.querySelectorAll(".gaia-live-deck-chapter, .gaia-estat-chapter, .gaia-firms-chapter, .gaia-planet-chapter, .gaia-marine-cod-chapter, .gaia-food-chapter")) {
      if (!chapter.querySelector("[data-map-category-label]")) {
        const label = document.createElement("p");
        label.className = "map-category-eyebrow";
        label.dataset.mapCategoryLabel = "";
        chapter.prepend(label);
        chapter.classList.add("has-map-category");
      }
    }
    for (const label of layer.querySelectorAll("[data-map-category-label]")) {
      setText(label, `${profile.scopeLabel} · ${category.label}`);
      label.style.setProperty("--map-category-color", category.color);
    }
    // App startup precedes the lazy renderers. Apply the requested public
    // chapter only once all real buttons exist, through the normal click path.
    const pending = layer.dataset.mapEntryExhibit;
    if (pending && layer.getAttribute("aria-hidden") === "false" && buttons().length === profiles.size) {
      const target = buttons().find(button => Number(button.textContent.trim()) === Number(pending));
      delete layer.dataset.mapEntryExhibit;
      if (target && (!target.hasAttribute("data-map-standard-index") || target.getAttribute("aria-current") !== "true")) target.click();
      schedule();
      return;
    }
    // Wait for the real selection, not the temporary base chapter rendered
    // during lazy loading. replaceState keeps autoplay out of Back history.
    if (!pending && buttons().length === profiles.size && layer.getAttribute("aria-hidden") === "false"
      && location.hash === handledHash && globalThis.GaiaMapRoute.isMapHash(location.hash) && location.hash !== "#data"
      && !document.body.matches(".novel-open, .novel-mode-detour, .gaia-tour-open")) {
      const hash = globalThis.GaiaMapRoute.hashForNumber(number);
      if (hash && location.hash !== hash) {
        history.replaceState(history.state, "", `${location.pathname}${location.search}${hash}`);
        handledHash = hash;
      }
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  };
  // A render frame may run between location.hash changing and hashchange.
  // Never overwrite that incoming address with the still-visible old chapter.
  let handledHash = location.hash;
  const handleRoute = () => { handledHash = location.hash; schedule(); };
  addEventListener("hashchange", handleRoute);
  addEventListener("gaia:japan-open", handleRoute);
  new MutationObserver(schedule).observe(layer, { childList: true, subtree: true });
  for (const event of ["gaia:app-ready", "gaia:japan-open", "gaia:map-route-change", "gaia:japan-mode-change", "gaia:live-exhibit-change", "gaia:estat-exhibit-change", "gaia:firms-change", "gaia:planet-signals-change"]) {
    addEventListener(event, schedule);
  }
  groups.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest(".map-mode-button")) delete layer.dataset.mapEntryExhibit;
  }, { capture: true });
  schedule();
})();
