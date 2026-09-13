(() => {
  "use strict";
  const ns = "http://www.w3.org/2000/svg";
  const svgElement = (tag, attrs, text) => {
    const element = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const nearestUrban = (rows, selected) => rows.filter(row => row.iso3 !== selected.iso3)
    .sort((a, b) => Math.abs(a.urbanPercent - selected.urbanPercent) - Math.abs(b.urbanPercent - selected.urbanPercent)
      || a.iso3.localeCompare(b.iso3))[0];

  const mount = (host, actions) => {
    const panel = document.createElement("section");
    panel.id = "ecologies-exhibit";
    panel.className = "ecologies-exhibit";
    panel.hidden = true;
    panel.setAttribute("aria-label", "三つの生態系：森・都市・文化を読み解く");
    panel.innerHTML = `
      <p class="eco-eyebrow">THREE ECOLOGIES <span>自然 · 社会 · 文化</span></p>
      <h2 class="eco-question">都市人口率が高い国は、<br>森が少ない？</h2>
      <div class="eco-tabs" role="tablist" aria-label="展示の見方">
        <button type="button" id="eco-tab-compare" role="tab" aria-controls="eco-pane-compare" data-eco-view="compare">01 国を比べる</button>
        <button type="button" id="eco-tab-pattern" role="tab" aria-controls="eco-pane-pattern" data-eco-view="pattern">02 関係を見る</button>
        <button type="button" id="eco-tab-culture" role="tab" aria-controls="eco-pane-culture" data-eco-view="culture">03 文化・記憶</button>
      </div>
      <div class="eco-controls">
        <label>選ぶ国 <select class="eco-country" aria-label="比較する国"></select></label>
        <button type="button" class="eco-play" aria-pressed="false">自動で比べる</button>
      </div>
      <div id="eco-pane-compare" role="tabpanel" aria-labelledby="eco-tab-compare">
        <p class="eco-prompt">似た都市人口率の国を、並べてみる。</p>
        <div class="eco-country-pair"></div>
        <p class="eco-insight" aria-live="polite"></p>
        <p class="eco-definition">緑は<strong>陸地</strong>に占める森林。青は<strong>人口</strong>に占める都市居住者。二つを足して100%にはなりません。</p>
      </div>
      <div id="eco-pane-pattern" role="tabpanel" aria-labelledby="eco-tab-pattern" hidden>
        <p class="eco-prompt">一つの点が、一つの国。</p>
        <p class="eco-pattern-reading"></p>
        <div class="eco-chart"></div>
        <p class="eco-chart-caption">右ほど都市人口率が高く、上ほど森林率が高い。点を選ぶと地図と国の表示が連動します。</p>
        <details class="eco-method"><summary>傾向線と相関係数を読む</summary><p class="eco-correlation"></p></details>
      </div>
      <div id="eco-pane-culture" role="tabpanel" aria-labelledby="eco-tab-culture" hidden>
        <p class="eco-prompt">割合では語れない、場所の意味。</p>
        <p class="eco-culture-reading">森と暮らしの関係には、文化や記憶もあります。世界遺産の例から、数値だけでは見えない側面を考えます。</p>
        <label class="eco-site-label">場所を選ぶ <select class="eco-site" aria-label="世界遺産の例を選ぶ"></select></label>
        <article class="eco-site-card"><span>WORLD HERITAGE / EXAMPLE</span><h3></h3><p></p></article>
        <p class="eco-definition">紫の菱形は自然遺産も含む展示用の24例。文化の豊かさを点数化したものではなく、相関計算にも含めません。</p>
        <a href="https://whc.unesco.org/en/list/" target="_blank" rel="noopener noreferrer">UNESCOの世界遺産一覧 ↗</a>
      </div>
      <p class="eco-scope"></p>
      <div class="eco-source-links"><a href="https://data.worldbank.org/indicator/AG.LND.FRST.ZS" target="_blank" rel="noopener noreferrer">森林率の出典 ↗</a><a href="https://data.worldbank.org/indicator/SP.URB.TOTL.IN.ZS" target="_blank" rel="noopener noreferrer">都市人口率の出典 ↗</a></div>`;
    host.append(panel);
    const find = selector => panel.querySelector(selector);
    let state = null, view = "compare", signature = "", catalogSignature = "", cultureIndex = 0;
    const setView = next => {
      view = next;
      for (const button of panel.querySelectorAll("[data-eco-view]")) {
        const current = button.dataset.ecoView === view;
        button.setAttribute("aria-selected", String(current)); button.tabIndex = current ? 0 : -1;
        document.getElementById(button.getAttribute("aria-controls")).hidden = !current;
      }
      panel.dataset.view = view;
      find(".eco-question").replaceChildren(document.createTextNode(view === "culture"
        ? "数字だけで、その場所を語れるだろうか？" : "都市人口率が高い国は、森が少ない？"));
      find(".eco-controls").hidden = view === "culture";
      find(".eco-source-links").hidden = view === "culture";
      actions.view(view);
      panel.scrollTop = 0;
      signature = "";
      if (state) update(state);
    };
    for (const button of panel.querySelectorAll("[data-eco-view]")) {
      button.addEventListener("click", () => setView(button.dataset.ecoView));
      button.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...panel.querySelectorAll("[data-eco-view]")];
        const index = event.key === "Home" ? 0 : event.key === "End" ? 2 : (tabs.indexOf(button) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
        setView(tabs[index].dataset.ecoView); tabs[index].focus();
      });
    }
    find(".eco-country").addEventListener("change", event => actions.select(event.target.value));
    find(".eco-play").addEventListener("click", () => actions.play());
    find(".eco-site").addEventListener("change", event => { cultureIndex = Number(event.target.value); signature = ""; update(state); actions.site(cultureIndex); });

    const countryCard = (row, role) => {
      const card = document.createElement("article");
      card.className = "eco-country-card";
      card.dataset.country = row.iso3;
      const label = document.createElement("small"); label.textContent = role;
      const name = document.createElement("h3"); name.textContent = row.nameJa;
      card.append(label, name);
      for (const metric of [{ key: "forest", label: "森林率", value: row.forestPercent, year: row.forestYear }, { key: "urban", label: "都市人口率", value: row.urbanPercent, year: row.urbanYear }]) {
        const item = document.createElement("div"); item.className = `eco-metric eco-${metric.key}`;
        const heading = document.createElement("div"), title = document.createElement("span"), value = document.createElement("strong");
        title.textContent = metric.label; value.textContent = `${metric.value.toFixed(1)}%`;
        heading.append(title, value);
        const rail = document.createElement("div"), bar = document.createElement("i"); rail.className = "eco-rail";
        rail.setAttribute("role", "meter"); rail.setAttribute("aria-label", `${row.nameJa} ${metric.label} ${metric.year}年`);
        rail.setAttribute("aria-valuemin", "0"); rail.setAttribute("aria-valuemax", "100"); rail.setAttribute("aria-valuenow", String(metric.value));
        bar.style.width = `${metric.value}%`; rail.append(bar);
        item.append(heading, rail); card.append(item);
      }
      return card;
    };
    const drawChart = current => {
      const svg = svgElement("svg", { viewBox: "0 0 440 300", role: "group", "aria-label": `${current.rows.length}の国・地域の森林率と都市人口率。横軸と縦軸は0から100パーセント` });
      const x = value => 48 + value * 3.64, y = value => 246 - value * 1.96;
      for (const value of [0, 25, 50, 75, 100]) {
        svg.append(svgElement("line", { x1: x(value), y1: y(0), x2: x(value), y2: y(100), class: "eco-grid" }));
        svg.append(svgElement("line", { x1: x(0), y1: y(value), x2: x(100), y2: y(value), class: "eco-grid" }));
        svg.append(svgElement("text", { x: x(value), y: 265, "text-anchor": "middle", class: "eco-tick" }, value));
        svg.append(svgElement("text", { x: 38, y: y(value) + 4, "text-anchor": "end", class: "eco-tick" }, value));
      }
      svg.append(svgElement("text", { x: 48, y: 26, class: "eco-axis eco-forest" }, "森林率（陸地の割合）% ↑"));
      svg.append(svgElement("text", { x: 412, y: 292, "text-anchor": "end", class: "eco-axis eco-urban" }, "都市人口率（人の割合）% →"));
      // Draw the regression only inside the 0–100% plot, without clamping its ends into a false slope.
      const defs = svgElement("defs", {}), clip = svgElement("clipPath", { id: "eco-scatter-clip" });
      clip.append(svgElement("rect", { x: x(0), y: y(100), width: 364, height: 196 })); defs.append(clip); svg.append(defs);
      svg.append(svgElement("line", { x1: x(0), y1: y(current.intercept), x2: x(100), y2: y(current.intercept + current.slope * 100), class: "eco-regression", "clip-path": "url(#eco-scatter-clip)" }));
      const sorted = [...current.rows].sort((a, b) => Number(a.iso3 === current.selected.iso3) - Number(b.iso3 === current.selected.iso3));
      for (const row of sorted) {
        const selected = row.iso3 === current.selected.iso3;
        const group = svgElement("g", { role: "button", tabindex: 0, "aria-label": `${row.nameJa}：都市人口率${row.urbanPercent.toFixed(1)}%、森林率${row.forestPercent.toFixed(1)}%`, "aria-pressed": selected, "data-eco-country": row.iso3, class: selected ? "eco-scatter-point is-selected" : "eco-scatter-point" });
        group.append(svgElement("circle", { cx: x(row.urbanPercent), cy: y(row.forestPercent), r: 10, class: "eco-point-hit" }));
        group.append(svgElement("circle", { cx: x(row.urbanPercent), cy: y(row.forestPercent), r: selected ? 6 : 4, class: "eco-point-dot" }));
        group.addEventListener("click", () => actions.select(row.iso3));
        group.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); actions.select(row.iso3); } });
        svg.append(group);
        if (selected) svg.append(svgElement("text", { x: Math.min(x(row.urbanPercent), 365), y: Math.max(44, y(row.forestPercent) - 13), "text-anchor": "middle", class: "eco-point-name" }, row.nameJa));
      }
      const focusedCountry = document.activeElement?.getAttribute("data-eco-country");
      find(".eco-chart").replaceChildren(svg);
      if (focusedCountry) find(`[data-eco-country="${focusedCountry}"]`)?.focus();
    };
    const update = next => {
      state = next;
      if (!state?.selected) return;
      const nextSignature = `${view}:${state.selected.iso3}:${state.playing}:${cultureIndex}:${state.correlation}`;
      if (signature === nextSignature) return;
      signature = nextSignature;
      const catalog = state.rows.map(row => row.iso3).join();
      if (catalogSignature !== catalog) {
        catalogSignature = catalog;
        find(".eco-country").replaceChildren(...state.rows.map(row => new Option(row.nameJa, row.iso3)));
        find(".eco-site").replaceChildren(...state.culture.map((row, index) => new Option(row.nameJa, index)));
      }
      find(".eco-country").value = state.selected.iso3;
      find(".eco-play").textContent = state.playing ? "一時停止" : "自動で比べる";
      find(".eco-play").setAttribute("aria-pressed", String(state.playing));
      find(".eco-play").disabled = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const peer = nearestUrban(state.rows, state.selected);
      panel.dataset.selected = state.selected.iso3; panel.dataset.peer = peer.iso3;
      const pair = [state.selected, peer];
      find(".eco-country-pair").replaceChildren(countryCard(pair[0], "選んだ国"), countryCard(pair[1], "都市人口率が最も近い国"));
      find(".eco-insight").textContent = `都市人口率の差は${Math.abs(pair[0].urbanPercent - pair[1].urbanPercent).toFixed(1)}ポイント。森林率の差は${Math.abs(pair[0].forestPercent - pair[1].forestPercent).toFixed(1)}ポイント。`;
      find(".eco-pattern-reading").textContent = Math.abs(state.correlation) < .4
        ? "収録した国・地域では点が広く散らばり、一方向の強い関係は見られません。"
        : "国ごとに二つの割合を対応させ、点の並び方を比べます。";
      find(".eco-correlation").textContent = `細い破線は${state.rows.length}の国・地域の直線的な傾向。相関係数 r = ${state.correlation.toFixed(2)}（${state.correlationLabel}）です。都市化が森林を増減させたという因果関係や、同じ国の時間変化は示しません。`;
      if (view === "pattern") drawChart(state);
      const site = state.culture[cultureIndex] || state.culture[0];
      if (site) { find(".eco-site-card h3").textContent = site.nameJa; find(".eco-site-card p").textContent = `${site.categoryJa} / ${site.regionJa}`; }
      find(".eco-scope").textContent = view === "culture" ? "24例の選択標本 / 件数で国を順位づけしません。"
        : `両指標のある${state.rows.length}の国・地域。世界・地域合計と欠測を除外。森林率 ${state.selected.forestYear}年 / 都市人口率 ${state.selected.urbanYear}年。基準年と都市の定義が異なります。`;
    };
    setView("compare");
    // Live exhibits can take over without changing the underlying standard mode.
    // Clear our layout class as soon as that happens, including its hidden legend rules.
    new MutationObserver(() => {
      if (host.matches(".is-live-exhibit, .is-firms-exhibit, .is-estat-exhibit, .is-planet-signals-exhibit, .is-marine-cod-exhibit, .is-food-exhibit")
        && host.classList.contains("is-ecologies-exhibit")) {
        panel.hidden = true; host.classList.remove("is-ecologies-exhibit");
      }
    }).observe(host, { attributes: true, attributeFilter: ["class"] });
    const refreshOverflow = () => panel.classList.toggle("eco-has-more", panel.scrollHeight - panel.scrollTop > panel.clientHeight + 8);
    panel.addEventListener("scroll", refreshOverflow, { passive: true });
    new ResizeObserver(refreshOverflow).observe(panel);
    return { update, view: () => view, siteIndex: () => cultureIndex,
      reset: () => setView("compare"),
      selectSite: index => { cultureIndex = index; find(".eco-site").value = String(index); signature = ""; if (state) update(state); },
      setActive: active => {
        const visible = active && !host.matches(".is-live-exhibit, .is-firms-exhibit, .is-estat-exhibit, .is-planet-signals-exhibit, .is-marine-cod-exhibit, .is-food-exhibit");
        if (panel.hidden !== !visible) panel.hidden = !visible;
        if (host.classList.contains("is-ecologies-exhibit") !== visible) host.classList.toggle("is-ecologies-exhibit", visible);
      },
      element: panel };
  };
  globalThis.GaiaEcologiesExhibit = Object.freeze({ mount, nearestUrban });
})();
