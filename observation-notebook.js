(() => {
  "use strict";

  const core = globalThis.GaiaObservationCore;
  if (!core || typeof document === "undefined" || globalThis.GaiaObservationNotebook) return;

  const providers = new Map();
  const selectedIds = new Set();
  let sharedRecords = [];
  let returnFocus = null;

  const launcher = document.createElement("button");
  launcher.className = "gaia-observation-launcher";
  launcher.type = "button";
  launcher.innerHTML = '<span aria-hidden="true">◎</span><strong>観測ノート</strong><small data-observation-count>0</small>';
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-controls", "gaia-observation-drawer");
  launcher.hidden = true;
  launcher.tabIndex = -1;
  launcher.setAttribute("aria-hidden", "true");

  const drawer = document.createElement("section");
  drawer.className = "gaia-observation-drawer";
  drawer.id = "gaia-observation-drawer";
  drawer.hidden = true;
  drawer.inert = true;
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-labelledby", "gaia-observation-title");
  drawer.innerHTML = `
    <div class="gaia-observation-scrim" data-observation-close aria-hidden="true"></div>
    <div class="gaia-observation-panel">
      <header class="gaia-observation-head">
        <div><p>GAIA FIELD NOTES / LOCAL</p><h2 id="gaia-observation-title">観測ノート</h2></div>
        <button type="button" data-observation-close aria-label="観測ノートを閉じる">×</button>
      </header>
      <p class="gaia-observation-privacy">観測はこのブラウザだけに保存されます。共有URLには端末ID・所有者情報・正確な位置を含めません。</p>
      <div class="gaia-observation-status" role="status" aria-live="polite" hidden></div>
      <section class="gaia-observation-shared" data-observation-shared hidden></section>
      <section class="gaia-observation-compare" data-observation-compare hidden></section>
      <div class="gaia-observation-list" data-observation-list></div>
      <footer class="gaia-observation-footer">
        <p data-observation-selection>比較する観測を2件まで選べます。</p>
        <div>
          <button type="button" data-observation-compare-action disabled>2件を比較</button>
          <button type="button" data-observation-share-action disabled>選択を共有</button>
        </div>
      </footer>
      <div class="gaia-observation-url" data-observation-url hidden>
        <label>共有URL<input type="text" readonly data-observation-url-input /></label>
      </div>
    </div>`;

  const panel = drawer.querySelector(".gaia-observation-panel");
  const list = drawer.querySelector("[data-observation-list]");
  const status = drawer.querySelector(".gaia-observation-status");
  const shared = drawer.querySelector("[data-observation-shared]");
  const comparison = drawer.querySelector("[data-observation-compare]");
  const selection = drawer.querySelector("[data-observation-selection]");
  const compareButton = drawer.querySelector("[data-observation-compare-action]");
  const shareButton = drawer.querySelector("[data-observation-share-action]");
  const urlBox = drawer.querySelector("[data-observation-url]");
  const urlInput = drawer.querySelector("[data-observation-url-input]");

  document.body.append(launcher, drawer);

  const formatNumber = (value) => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 }).format(value);
  const formatDate = (value) => new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));

  const announce = (message, kind = "info") => {
    status.hidden = false;
    status.dataset.kind = kind;
    status.textContent = message;
  };

  const clearAnnouncement = () => {
    status.hidden = true;
    status.removeAttribute("data-kind");
    status.textContent = "";
  };

  const shareBaseUrl = () => {
    const configured = document.documentElement.dataset.gaiaShareBase || "./";
    const url = new URL(configured, document.baseURI);
    url.search = "";
    url.hash = "";
    return url;
  };

  const buildShareUrl = (records) => {
    const url = shareBaseUrl();
    url.hash = `observation=${core.encodeShare(records)}`;
    return url.toString();
  };

  const metricsElement = (record) => {
    const metrics = document.createElement("dl");
    metrics.className = "gaia-observation-metrics";
    record.metrics.forEach((metric) => {
      const row = document.createElement("div");
      const term = Object.assign(document.createElement("dt"), { textContent: metric.label });
      const value = Object.assign(document.createElement("dd"), { textContent: `${formatNumber(metric.value)}${metric.unit ? ` ${metric.unit}` : ""}` });
      row.append(term, value);
      metrics.append(row);
    });
    return metrics;
  };

  const recordCard = (record, { readOnly = false } = {}) => {
    const article = document.createElement("article");
    article.className = "gaia-observation-card";
    article.dataset.source = record.source;
    const header = document.createElement("header");
    const copy = document.createElement("div");
    const kind = Object.assign(document.createElement("p"), { textContent: record.source === "map" ? "MAP OBSERVATION" : "ESP32 SENSOR" });
    const title = Object.assign(document.createElement("h3"), { textContent: record.title });
    const time = Object.assign(document.createElement("time"), { textContent: formatDate(record.capturedAt), dateTime: record.capturedAt });
    copy.append(kind, title, time);
    header.append(copy);
    if (!readOnly) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selectedIds.has(record.id);
      checkbox.setAttribute("aria-label", `${record.title}を比較・共有対象に選ぶ`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked && selectedIds.size >= 2) {
          checkbox.checked = false;
          announce("比較・共有に選べる観測は2件までです。", "error");
          return;
        }
        if (checkbox.checked) selectedIds.add(record.id);
        else selectedIds.delete(record.id);
        updateSelection();
      });
      header.append(checkbox);
    }
    article.append(header);
    if (record.subtitle) article.append(Object.assign(document.createElement("p"), { className: "gaia-observation-subtitle", textContent: record.subtitle }));
    article.append(metricsElement(record));
    if (record.provenance.datasetIds.length) {
      article.append(Object.assign(document.createElement("p"), {
        className: "gaia-observation-source",
        textContent: `${record.provenance.classification || "SOURCE"} / ${record.provenance.datasetIds.join(" · ")}`,
      }));
    }
    if (!readOnly) {
      const actions = document.createElement("footer");
      const shareOne = Object.assign(document.createElement("button"), { type: "button", textContent: "共有" });
      shareOne.addEventListener("click", () => void shareRecords([record]));
      const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "削除" });
      remove.addEventListener("click", () => {
        selectedIds.delete(record.id);
        core.remove(record.id);
        announce("観測を削除しました。");
        render();
      });
      actions.append(shareOne, remove);
      article.append(actions);
    }
    return article;
  };

  const updateSelection = () => {
    const records = core.list().filter((record) => selectedIds.has(record.id));
    for (const id of selectedIds) {
      if (!records.some((record) => record.id === id)) selectedIds.delete(id);
    }
    selection.textContent = selectedIds.size
      ? `${selectedIds.size}件を選択中。${selectedIds.size === 2 ? (core.isComparable(records[0], records[1]) ? "比較できます。" : "単位や観測条件が異なるため比較できません。") : "もう1件選ぶと比較できます。"}`
      : "比較する観測を2件まで選べます。";
    compareButton.disabled = records.length !== 2 || !core.isComparable(records[0], records[1]);
    shareButton.disabled = records.length < 1 || records.length > 2;
  };

  const render = () => {
    const records = core.list();
    launcher.querySelector("[data-observation-count]").textContent = String(records.length);
    list.replaceChildren();
    if (!records.length) {
      const empty = document.createElement("div");
      empty.className = "gaia-observation-empty";
      empty.innerHTML = "<strong>まだ観測はありません</strong><span>世界地図の「この時点を保存」またはセンサー履歴から追加できます。</span>";
      list.append(empty);
    } else records.forEach((record) => list.append(recordCard(record)));
    updateSelection();
  };

  const renderComparison = (records) => {
    const rows = core.compare(records[0], records[1]);
    comparison.replaceChildren();
    const heading = document.createElement("header");
    heading.innerHTML = `<p>COMPARE / A → B</p><h3>${records[0].title} と ${records[1].title}</h3>`;
    const table = document.createElement("div");
    table.className = "gaia-observation-comparison-grid";
    rows.forEach((row) => {
      const item = document.createElement("p");
      const sign = row.delta > 0 ? "+" : "";
      item.innerHTML = "<span></span><strong></strong><small></small>";
      item.querySelector("span").textContent = row.label;
      item.querySelector("strong").textContent = `A ${formatNumber(row.first)} → B ${formatNumber(row.second)} ${row.unit}`;
      item.querySelector("small").textContent = `差分 ${sign}${formatNumber(row.delta)} ${row.unit}`;
      table.append(item);
    });
    const note = Object.assign(document.createElement("p"), {
      className: "gaia-observation-comparison-note",
      textContent: "差分は二つの値の引き算です。因果関係や優劣を示すものではありません。",
    });
    comparison.append(heading, table, note);
    comparison.hidden = false;
    comparison.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  };

  const showShareFallback = (url, message) => {
    urlInput.value = url;
    urlBox.hidden = false;
    urlInput.focus({ preventScroll: true });
    urlInput.select();
    announce(message);
  };

  const shareRecords = async (records) => {
    try {
      const url = buildShareUrl(records);
      const shareData = { title: "GAIA SENSEWARE 観測ノート", text: "地球の観測記録を共有します。", url };
      if (typeof navigator.share === "function") {
        try {
          await navigator.share(shareData);
          announce("共有画面を開きました。");
          return url;
        } catch (error) {
          if (error?.name === "AbortError") return url;
        }
      }
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          announce("共有URLをコピーしました。");
          return url;
        } catch {}
      }
      showShareFallback(url, "URLを選択してコピーしてください。");
      return url;
    } catch (error) {
      announce(error instanceof Error ? error.message : String(error), "error");
      return "";
    }
  };

  const renderShared = (records) => {
    sharedRecords = records;
    shared.replaceChildren();
    const header = document.createElement("header");
    header.innerHTML = "<p>SHARED FIELD NOTE / READ ONLY</p><h3>共有された観測</h3><span>内容を確認してから、このブラウザへ保存できます。</span>";
    shared.append(header);
    records.forEach((record) => shared.append(recordCard(record, { readOnly: true })));
    const importButton = Object.assign(document.createElement("button"), { type: "button", textContent: "自分の観測ノートに保存" });
    importButton.addEventListener("click", () => {
      const persistent = records.map((record) => core.save(record).persistent).every(Boolean);
      sharedRecords = [];
      shared.hidden = true;
      announce(persistent ? "共有された観測を保存しました。" : "保存領域を使えないため、このタブの間だけ保持します。", persistent ? "info" : "error");
      render();
    });
    shared.append(importButton);
    shared.hidden = false;
  };

  const open = ({ shared: incoming = null } = {}) => {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : launcher;
    clearAnnouncement();
    urlBox.hidden = true;
    comparison.hidden = true;
    drawer.hidden = false;
    drawer.inert = false;
    document.body.classList.add("gaia-observation-open");
    render();
    if (incoming?.length) renderShared(incoming);
    else if (!sharedRecords.length) shared.hidden = true;
    requestAnimationFrame(() => drawer.querySelector("[data-observation-close]")?.focus({ preventScroll: true }));
  };

  const close = () => {
    drawer.hidden = true;
    drawer.inert = true;
    document.body.classList.remove("gaia-observation-open");
    if (location.hash.startsWith("#observation=")) {
      location.assign(shareBaseUrl().toString());
      return;
    }
    returnFocus?.focus?.({ preventScroll: true });
  };

  const saveRecord = (record, { openAfterSave = false } = {}) => {
    try {
      const result = core.save(record);
      render();
      if (openAfterSave) open();
      announce(result.persistent ? "観測をノートへ保存しました。" : "保存領域を使えないため、このタブの間だけ保持します。", result.persistent ? "info" : "error");
      return result.record;
    } catch (error) {
      if (!drawer.hidden) announce(error instanceof Error ? error.message : String(error), "error");
      throw error;
    }
  };

  const registerCaptureProvider = (source, provider) => {
    if ((source === "map" || source === "sensor") && typeof provider === "function") providers.set(source, provider);
  };

  const capture = async (source, options = {}) => {
    const provider = providers.get(source)
      || (source === "map" ? globalThis.GaiaMapObservationAdapter?.captureObservation : null);
    if (typeof provider !== "function") throw new Error("観測データの準備が完了していません。");
    const record = await provider();
    return saveRecord(record, options);
  };

  const openSharedHash = () => {
    if (!location.hash.startsWith("#observation=")) return false;
    try {
      const records = core.decodeShare(location.hash.slice("#observation=".length));
      open({ shared: records });
    } catch (error) {
      open();
      announce(error instanceof Error ? error.message : "共有URLを読み取れませんでした。", "error");
    }
    return true;
  };

  launcher.addEventListener("click", () => open());
  drawer.querySelectorAll("[data-observation-close]").forEach((button) => button.addEventListener("click", close));
  compareButton.addEventListener("click", () => {
    const records = core.list().filter((record) => selectedIds.has(record.id));
    if (records.length === 2 && core.isComparable(records[0], records[1])) renderComparison(records);
  });
  shareButton.addEventListener("click", () => {
    const records = core.list().filter((record) => selectedIds.has(record.id));
    void shareRecords(records);
  });
  drawer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(panel.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);

  const addMapCaptureButton = () => {
    const actions = document.querySelector("#japan-layer .japan-map-actions");
    if (!actions || actions.querySelector("[data-observation-capture-map]")) return;
    const button = Object.assign(document.createElement("button"), {
      className: "gaia-observation-capture gaia-observation-capture--map",
      type: "button",
      textContent: "この時点を保存",
    });
    button.dataset.observationCaptureMap = "";
    button.addEventListener("click", async () => {
      try { await capture("map", { openAfterSave: true }); }
      catch (error) { open(); announce(error instanceof Error ? error.message : String(error), "error"); }
    });
    actions.append(button);
  };

  const addSensorLauncher = () => {
    const nav = document.querySelector(".sensor-topbar nav");
    if (!nav || nav.querySelector("[data-observation-open]")) return;
    const button = Object.assign(document.createElement("button"), { type: "button", textContent: "観測ノート" });
    button.dataset.observationOpen = "";
    button.addEventListener("click", () => open());
    nav.insertBefore(button, nav.querySelector("[data-nav='guide']"));
  };

  const publicApi = Object.freeze({
    open,
    close,
    saveRecord,
    capture,
    registerCaptureProvider,
    shareRecords,
    buildShareUrl,
    openSharedHash,
    refresh: render,
  });
  globalThis.GaiaObservationNotebook = publicApi;

  addMapCaptureButton();
  addSensorLauncher();
  render();
  window.addEventListener("gaia:app-ready", addMapCaptureButton);
  window.addEventListener("gaia:observation-capture", (event) => {
    if (event.detail?.record) saveRecord(event.detail.record, { openAfterSave: Boolean(event.detail.open) });
  });
  window.addEventListener("hashchange", openSharedHash);
  requestAnimationFrame(openSharedHash);
  window.dispatchEvent(new CustomEvent("gaia:observation-notebook-ready"));
})();
