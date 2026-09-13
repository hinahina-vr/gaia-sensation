// The exhibit category is realtime; the displayed payload may still be a
// delayed public feed, a saved observation, or a generated fallback. Never
// infer a live connection from an animated map or from its exhibit number.
export const sourceStateJa = state => ({ LIVE: "ライブ取得", "LIVE CACHE": "取得済みデータ", "SAVED SNAPSHOT": "保存データ", "SAVED VALUES": "参考値", FETCHING: "取得中", ERROR: "取得不可" }[state] || "未確認");
export function realtimeStatus({ sourceState = "FETCHING", observedAt, now = Date.now(), online = true } = {}) {
  const timestamp = Date.parse(observedAt);
  const validTime = Number.isFinite(timestamp);
  const delayed = validTime && now - timestamp > 24 * 60 * 60 * 1000;
  let state = "loading", label = "公開データを取得中";
  if (sourceState === "SAVED VALUES") { state = "sample"; label = "参考値を表示 · ライブ取得不可"; }
  else if (sourceState === "SAVED SNAPSHOT") { state = "saved"; label = "保存観測を表示 · ライブ未接続"; }
  else if (sourceState === "ERROR") { state = "error"; label = "データを取得できません"; }
  else if (["LIVE", "LIVE CACHE"].includes(sourceState)) {
    state = delayed || !validTime ? "delayed" : "live";
    label = !validTime ? "公開データ · 時刻不明" : delayed ? "公開データ · 時刻に遅れ" : "ライブ · 公開データ";
  }
  if (!online && ["live", "loading"].includes(state)) { state = "offline"; label = "接続停止 · 前回の取得値"; }
  const time = validTime && !["loading", "sample", "error"].includes(state)
    ? new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo" }).format(timestamp) + "（日本時間）" : "—";
  return { state, label, time, iso: time === "—" ? "" : new Date(timestamp).toISOString() };
}

const records = new Map();
const badges = new Map();
const credits = new WeakMap();
const isVisible = element => element.isConnected && !element.closest("[hidden]") && element.getClientRects().length > 0;
const badgeLabels = { live: "LIVE", loading: "取得中", saved: "保存値", sample: "参考値", delayed: "時刻に遅れ", error: "取得不可", offline: "接続停止" };
const paintBadge = (badge, payload) => {
  const status = realtimeStatus({ ...payload, online: navigator.onLine });
  if (badge.dataset.broadcastState !== status.state) badge.dataset.broadcastState = status.state;
  if (badge.textContent !== badgeLabels[status.state]) badge.textContent = badgeLabels[status.state];
  if (badge.getAttribute("aria-label") !== status.label) badge.setAttribute("aria-label", status.label);
};
export function createBroadcastBadge() {
  const badge = document.createElement("span");
  badge.className = "gaia-broadcast-badge";
  return badge;
}
export function updateBroadcastBadge(badge, payload) {
  badges.set(badge, payload);
  paintBadge(badge, payload);
}
let freshnessClock = null;
const refreshVisible = () => {
  if (document.hidden) return;
  for (const [element, payload] of records) {
    const visible = isVisible(element);
    const credit = credits.get(element);
    if (credit) credit.hidden = !visible || !payload.source;
    if (visible) paintStatus(element, payload);
  }
  for (const [element, payload] of badges) if (element.isConnected) paintBadge(element, payload);
};
for (const name of ["online", "offline", "gaia:japan-mode-change", "gaia:live-exhibit-change", "gaia:estat-exhibit-change", "gaia:firms-change", "gaia:planet-signals-change"]) globalThis.addEventListener?.(name, () => requestAnimationFrame(refreshVisible));

export function createRealtimeStatus() {
  const element = document.createElement("div");
  element.className = "gaia-realtime-status";
  element.setAttribute("aria-label", "リアルタイム展示のデータ接続状況");
  element.innerHTML = `
    <h3><span>リアルタイム展示</span></h3>
    <p class="gaia-realtime-state"><b data-realtime-state></b><span data-realtime-kind></span></p>
    <p class="gaia-realtime-time"><span data-realtime-time-label>データ時刻</span><time data-realtime-time></time></p>`;
  element.querySelector("h3").append(createBroadcastBadge());
  updateRealtimeStatus(element);
  if (freshnessClock === null) {
    // This only ages the displayed timestamp; it does not pretend to poll a
    // provider. A long-running installation must not retain a stale LIVE badge.
    freshnessClock = setInterval(refreshVisible, 60_000);
    document.addEventListener("visibilitychange", refreshVisible);
  }
  return element;
}

const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
function paintCredit(element, source, sourceUrl) {
  const footer = document.querySelector("#japan-layer .japan-credits");
  if (!footer) return;
  let credit = credits.get(element);
  if (!credit) {
    credit = document.createElement("a");
    credit.className = "gaia-realtime-credit";
    credit.setAttribute("data-realtime-source", "");
    credit.target = "_blank";
    credit.rel = "noopener noreferrer";
    credit.hidden = true;
    footer.append(credit);
    credits.set(element, credit);
  }
  setText(credit, source);
  // URLs come from the existing exhibit definitions, never from feed values.
  if (/^https:\/\//u.test(sourceUrl)) {
    if (credit.getAttribute("href") !== sourceUrl) credit.href = sourceUrl;
  } else credit.removeAttribute("href");
  credit.hidden = !source || !isVisible(element);
}
function paintStatus(element, { source = "", sourceUrl = "", kind = "", timeLabel = "データ時刻", ...payload } = {}) {
  if (!element) return;
  const status = realtimeStatus({ ...payload, online: navigator.onLine });
  updateBroadcastBadge(element.querySelector(".gaia-broadcast-badge"), payload);
  if (element.dataset.realtimeState !== status.state) element.dataset.realtimeState = status.state;
  setText(element.querySelector("[data-realtime-state]"), status.label);
  setText(element.querySelector("[data-realtime-kind]"), kind);
  setText(element.querySelector("[data-realtime-time-label]"), status.state === "sample" ? "現在値ではありません" : timeLabel);
  const time = element.querySelector("[data-realtime-time]");
  setText(time, status.time);
  if (status.iso && time.dateTime !== status.iso) time.dateTime = status.iso;
  else if (!status.iso && time.hasAttribute("datetime")) time.removeAttribute("datetime");
  paintCredit(element, source, sourceUrl);
}

export function updateRealtimeStatus(element, payload = {}) {
  if (!element) return;
  records.set(element, payload);
  paintStatus(element, payload);
  // A selection can hide the previous readout before its provider resolves.
  // Synchronize all credits immediately on the next paint, including loading.
  requestAnimationFrame(refreshVisible);
}
