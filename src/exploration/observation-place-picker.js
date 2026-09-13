import { OBSERVATION_CITIES, findObservationCity } from "./observation-cities.js?v=gaia-exhibit-catalog-1";
import { formatPrefecturePlace } from "./observation-place-label.js?v=gaia-place-inline-1";

const REGIONS = [
  { id: "north", label: "北海道・東北", first: 1, last: 7 },
  { id: "kanto", label: "関東", first: 8, last: 14 },
  { id: "chubu", label: "中部", first: 15, last: 23 },
  { id: "kinki", label: "近畿", first: 24, last: 30 },
  { id: "chugoku", label: "中国地方", first: 31, last: 35 },
  { id: "shikoku", label: "四国", first: 36, last: 39 },
  { id: "south", label: "九州・沖縄", first: 40, last: 47 },
];
const normalize = value => value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");

export const createObservationPlacePicker = ({ container, trigger, getSelected, onSelect, onOpen, onClose }) => {
  const dialog = document.createElement("dialog");
  dialog.id = "gaia-observation-place-picker";
  dialog.className = "gaia-place-picker";
  dialog.setAttribute("aria-labelledby", "gaia-place-picker-title");
  dialog.innerHTML = `
    <header class="gaia-place-picker-heading">
      <div><p>OBSERVATION POINT</p><h2 id="gaia-place-picker-title">都道府県を選ぶ</h2></div>
      <button type="button" data-place-close aria-label="都道府県の選択を閉じる">閉じる <span aria-hidden="true">×</span></button>
    </header>
    <div class="gaia-place-picker-search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
      <input type="search" aria-label="都道府県・都市名を検索" placeholder="都道府県・都市名を検索" autocomplete="off" spellcheck="false">
      <button type="button" data-place-clear hidden>クリア</button>
    </div>
    <nav class="gaia-place-picker-regions" aria-label="地域で絞り込む">
      ${[{ id: "all", label: "すべて" }, ...REGIONS].map(region => `<button type="button" data-place-region="${region.id}" aria-pressed="${region.id === "all"}">${region.label}</button>`).join("")}
    </nav>
    <div class="gaia-place-picker-results" aria-label="観測地点の一覧"></div>
    <footer class="gaia-place-picker-footer"><span data-place-current></span><span data-place-count role="status" aria-live="polite" aria-atomic="true"></span></footer>
  `;
  container.append(dialog);
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", dialog.id);
  trigger.setAttribute("aria-expanded", "false");
  const search = dialog.querySelector("input");
  const results = dialog.querySelector(".gaia-place-picker-results");
  const clearButton = dialog.querySelector("[data-place-clear]");
  const regionButtons = [...dialog.querySelectorAll("[data-place-region]")];
  let selectedId = "";
  let regionId = "all";

  const markSelected = () => {
    const selected = findObservationCity(selectedId);
    dialog.querySelectorAll("[data-place-city]").forEach(button => {
      const current = button.dataset.placeCity === selectedId;
      button.setAttribute("aria-current", String(current));
      button.querySelector("[data-place-selected]").hidden = !current;
    });
    dialog.querySelector("[data-place-current]").textContent = selected ? `選択中：${formatPrefecturePlace(selected.prefecture, selected.city)}` : "";
  };
  const sync = cityId => {
    if (!findObservationCity(cityId) || cityId === selectedId) return;
    selectedId = cityId;
    const city = findObservationCity(cityId);
    trigger.dataset.city = cityId;
    trigger.setAttribute("aria-label", `${formatPrefecturePlace(city.prefecture, city.city)}。都道府県を選ぶ`);
    if (dialog.open) markSelected();
  };
  const render = () => {
    const query = normalize(search.value.trim());
    results.replaceChildren();
    let count = 0;
    for (const region of REGIONS) {
      if (regionId !== "all" && region.id !== regionId) continue;
      const cities = OBSERVATION_CITIES.filter(city => Number(city.code) >= region.first && Number(city.code) <= region.last
        && (!query || normalize(`${city.code}${city.prefecture}${city.city}${city.id}${formatPrefecturePlace(city.prefecture, city.city)}`).includes(query)));
      if (!cities.length) continue;
      count += cities.length;
      const section = document.createElement("section");
      section.className = "gaia-place-picker-region";
      section.setAttribute("aria-labelledby", `gaia-place-region-${region.id}`);
      section.innerHTML = `<h3 id="gaia-place-region-${region.id}">${region.label}<span>${cities.length} 地点</span></h3>
        <div class="gaia-place-picker-grid">${cities.map(city => `
          <button type="button" data-place-city="${city.id}" aria-label="${city.code} ${formatPrefecturePlace(city.prefecture, city.city)}">
            <span class="gaia-place-picker-code">${city.code}</span>
            <span class="gaia-place-picker-name"><strong>${formatPrefecturePlace(city.prefecture, city.city)}</strong></span>
            <span data-place-selected hidden>選択中</span>
          </button>`).join("")}</div>`;
      results.append(section);
    }
    if (!count) {
      const empty = document.createElement("p");
      empty.className = "gaia-place-picker-empty";
      empty.innerHTML = "見つかりませんでした<small>都道府県名や都市名を変えて検索してください。</small>";
      results.append(empty);
    }
    dialog.querySelector("[data-place-count]").textContent = `${count} 地点`;
    clearButton.hidden = !search.value;
    regionButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.placeRegion === regionId)));
    markSelected();
    results.scrollTop = 0;
  };
  const position = () => {
    if (!dialog.open) return;
    const viewport = window.visualViewport;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    dialog.style.maxHeight = `${height - 24}px`;
    dialog.style.width = `${Math.min(680, width - 24)}px`;
    const box = dialog.getBoundingClientRect(), anchor = trigger.getBoundingClientRect();
    dialog.style.left = `${left + Math.max(12, Math.min(anchor.left - left - 20, width - box.width - 12))}px`;
    dialog.style.top = `${top + (width <= 720 ? height - box.height - 12 : Math.max(12, Math.min(anchor.top - top - box.height - 12, height - box.height - 12)))}px`;
  };
  const close = ({ restoreFocus = true } = {}) => {
    if (!dialog.open) return;
    dialog.close();
    trigger.setAttribute("aria-expanded", "false");
    onClose?.();
    if (restoreFocus && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
  };
  const open = () => {
    if (dialog.open) return;
    sync(getSelected());
    regionId = "all";
    search.value = "";
    render();
    onOpen?.();
    dialog.showModal();
    trigger.setAttribute("aria-expanded", "true");
    position();
    // Keep the mobile keyboard closed until the visitor chooses to search.
    const current = results.querySelector('[aria-current="true"]');
    (current || dialog.querySelector("[data-place-close]")).focus({ preventScroll: true });
    current?.scrollIntoView({ block: "nearest" });
  };
  trigger.addEventListener("click", open);
  dialog.querySelector("[data-place-close]").addEventListener("click", () => close());
  regionButtons.forEach(button => button.addEventListener("click", () => {
    regionId = button.dataset.placeRegion;
    search.value = "";
    render();
  }));
  search.addEventListener("input", () => { regionId = "all"; render(); });
  clearButton.addEventListener("click", () => { search.value = ""; render(); search.focus(); });
  results.addEventListener("click", event => {
    const button = event.target.closest("[data-place-city]");
    if (!button) return;
    close();
    onSelect(button.dataset.placeCity);
  });
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  // MAP shortcuts must never receive text, number keys, arrows or Escape.
  addEventListener("keydown", event => {
    if (!dialog.open || event.key !== "Escape") return;
    event.preventDefault(); event.stopImmediatePropagation(); close();
  }, true);
  dialog.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.isComposing) return;
    const cityButtons = [...results.querySelectorAll("[data-place-city]")];
    if (event.target === search) {
      if (event.key === "ArrowDown" && cityButtons.length) { event.preventDefault(); cityButtons[0].focus(); }
      if (event.key === "Enter" && cityButtons.length === 1) { event.preventDefault(); cityButtons[0].click(); }
    }
    const index = cityButtons.indexOf(event.target);
    if (index >= 0 && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const columns = getComputedStyle(event.target.parentElement).gridTemplateColumns.split(" ").length;
      const next = event.key === "Home" ? 0 : event.key === "End" ? cityButtons.length - 1
        : index + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key]);
      cityButtons[Math.max(0, Math.min(cityButtons.length - 1, next))].focus();
    }
    if (event.key === "Tab") {
      const targets = [...dialog.querySelectorAll("button, input")].filter(node => !node.hidden && !node.disabled && node.getClientRects().length);
      if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0].focus(); }
    }
  });
  let backdropDown = false;
  const outside = event => {
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };
  dialog.addEventListener("pointerdown", event => { backdropDown = outside(event); });
  dialog.addEventListener("click", event => { if (backdropDown && outside(event)) close(); backdropDown = false; });
  addEventListener("resize", position, { passive: true });
  window.visualViewport?.addEventListener("resize", position, { passive: true });
  window.visualViewport?.addEventListener("scroll", position, { passive: true });
  addEventListener("gaia:japan-close", () => close({ restoreFocus: false }));
  sync(getSelected());
  return { close, sync };
};
