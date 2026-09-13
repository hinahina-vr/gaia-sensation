/**
 * 概要: センサー参加のフロントエンド。公開地図と認証を伴う機器管理を分け、API応答を登録・設定・観測表示へ反映する。
 */
import { initSensorSenseField } from "./sensor-field.js?v=gaia-real-sensor-field-1";
import { initSetupRequests, renderCompactMeasurementPicker, syncCompactMeasurementPicker } from "./sensor-onboarding.js?v=gaia-onboarding-1-i18n-20260913";
import { aiProviderPresets, readAiConfiguration, saveAiConfiguration, clearAiKey, endAiSession, confirmAiDestination, validatedAiEndpoint, requestAiAnswer } from "../byok-ai.js?v=gaia-hardening-1-i18n-20260913";

const views = new Map(Array.from(document.querySelectorAll("[data-view]"), (element) => [element.dataset.view, element]));
const statusRegion = document.querySelector("#sensor-status");
const markerLabelValues = new WeakMap();
const bindSensorLabel = (element, source, values = {}, attribute = null) => {
  if (!element) return;
  if (window.GaiaI18n) window.GaiaI18n.bind(element, source, values, attribute);
  else {
    const text = source.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
    if (attribute) element.setAttribute(attribute, text); else element.textContent = text;
  }
};
const loginButton = document.querySelector("#google-login");
const trialLoginButton = document.querySelector("#trial-login");
const participationInfoOpen = document.querySelector("#participation-info-open");
const participationDialog = document.querySelector("#participation-info");
const publicOwnerProfileDialog = document.querySelector("#public-owner-profile");
const publicOwnerProfileAvatar = document.querySelector("#public-owner-profile-avatar");
const publicOwnerProfileName = document.querySelector("#public-owner-profile-name");
const publicOwnerProfileSensor = document.querySelector("#public-owner-profile-sensor");
const publicOwnerProfileRegion = document.querySelector("#public-owner-profile-region");
const publicOwnerProfileNote = document.querySelector("#public-owner-profile-note");
const publicOwnerProfileLinks = document.querySelector("#public-owner-profile-links");
const analysisDialog = document.querySelector("#sensor-analysis-dialog");
const analysisClose = document.querySelector("#sensor-analysis-close");
const analysisTarget = document.querySelector("#sensor-analysis-target");
const analysisBadge = document.querySelector("#sensor-analysis-badge");
const analysisStats = document.querySelector("#sensor-analysis-stats");
const analysisSummary = document.querySelector("#sensor-analysis-summary");
const aiForm = document.querySelector("#sensor-ai-form");
const aiProvider = document.querySelector("#sensor-ai-provider");
const aiModel = document.querySelector("#sensor-ai-model");
const aiEndpoint = document.querySelector("#sensor-ai-endpoint");
const aiKey = document.querySelector("#sensor-ai-key");
const aiAnswer = document.querySelector("#sensor-ai-answer");
const aiClearKey = document.querySelector("#sensor-ai-clear-key");
const logoutButton = document.querySelector("#sensor-logout");
const profileNav = document.querySelector("#profile-nav");
const accountNote = document.querySelector("#sensor-account-note");
const upgradeGoogleButton = document.querySelector("#upgrade-google");
const showAddButton = document.querySelector("#show-add");
const deviceList = document.querySelector("#device-list");
const emptyState = document.querySelector("#device-empty");
const deviceForm = document.querySelector("#device-form");
const locationForm = document.querySelector("#location-form");
const pairingCode = document.querySelector("#pairing-code");
const pairingExpiry = document.querySelector("#pairing-expiry");
const pairingPanel = document.querySelector("#sensor-pairing-panel");
document.querySelector("#sensor-pairing-slot").append(pairingPanel);
let pendingPairing = null;
let pairingExpiryTimer = 0;
const cardTemplate = document.querySelector("#device-card-template");
const historyList = document.querySelector("#history-list");
const historyChart = document.querySelector("#history-chart");
const latestMetrics = document.querySelector("#latest-metrics");
const measurementCatalogSummary = document.querySelector("#measurement-catalog-summary");
const measurementCatalogGroups = document.querySelector("#measurement-catalog-groups");
const measurementCatalogDisclaimer = document.querySelector("#measurement-catalog-disclaimer");
const measurementCatalogSearch = document.querySelector("#measurement-catalog-search");
const measurementCatalogEmpty = document.querySelector("#measurement-catalog-empty");
const publicSensorMap = document.querySelector("#public-sensor-map");
const publicSensorNetwork = document.querySelector("#public-sensor-network");
const publicSensorMarkers = document.querySelector("#public-sensor-markers");
const publicSensorList = document.querySelector("#public-sensor-list");
const publicSensorDetail = document.querySelector("#public-sensor-detail");
const publicSensorDirectory = document.querySelector("#public-sensor-directory");
const publicSensorDirectoryClose = document.querySelector("#public-sensor-directory-close");
const publicSensorQuery = document.querySelector("#public-sensor-query");
const publicSensorResults = document.querySelector("#public-sensor-results");
const publicSensorEmpty = document.querySelector("#public-sensor-empty");
const publicMapDirectoryToggle = document.querySelector("#public-map-directory-toggle");
const publicMapDirectoryCount = document.querySelector("#public-map-directory-count");
const publicMapRefresh = document.querySelector("#refresh-map");
const publicMapZoomIn = document.querySelector("#public-map-zoom-in");
const publicMapZoomOut = document.querySelector("#public-map-zoom-out");
const publicMapReset = document.querySelector("#public-map-reset");
const publicMapZoomOutput = document.querySelector("#public-map-zoom");
const publicMapLocationEditor = document.querySelector("#public-map-location-editor");
const publicMapLocationTitle = document.querySelector("#public-map-location-title");
const publicMapLocationOutput = document.querySelector("#public-map-location-output");
const publicMapLocationCancel = document.querySelector("#public-map-location-cancel");
const publicMapLocationSave = document.querySelector("#public-map-location-save");
const publicSyncRate = document.querySelector("#public-sync-rate");
const publicActiveNodes = document.querySelector("#public-active-nodes");
const publicPacketCount = document.querySelector("#public-packet-count");
const publicDataVolume = document.querySelector("#public-data-volume");
const publicDepthFill = document.querySelector("#public-depth-fill");
const publicDepthValue = document.querySelector("#public-depth-value");
const profileForm = document.querySelector("#profile-form");
const profileAvatarPreview = document.querySelector("#profile-avatar-preview");
const profileAvatarInput = document.querySelector("#profile-avatar-input");
const publicSensorCount = document.querySelector("#public-sensor-count");
const analyzeDetailButton = document.querySelector("#analyze-detail");
const detailLatestPollIntervalMs = 30_000;
const naturalEarthCountriesUrl = "../data/natural-earth-50m-countries.geojson?v=gaia-1";
const japanPrefectureUrl = "../data/japan-prefectures.topojson?v=gaia-1";
const publicMapMinZoom = 1;
const publicMapMaxZoom = 96;
const publicMapLongitudeScale = Math.cos(36 * Math.PI / 180);
const publicMapHome = Object.freeze({ longitude: 137.5, latitude: 36, zoom: 4.2 });
const publicMapOverscanRatio = .22;
const publicMapDragRebaseRatio = .18;
const publicMapFocusMinZoom = 7.2;
const publicMapPoiFocusDurationMs = 720;
const publicUiDismissDurationMs = 190;
const publicMapReturnDurationMs = 360;
const publicMapPollIntervalMs = 60_000;
const publicMapCanvasPixelBudget = 12_000_000;
const publicMapMarkerCollisionDistance = 50;
const resonanceDistanceKm = 1_800;
const regionNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["ja"], { type: "region" }) : null;
const worldMapView = Object.freeze({ west: -180, east: 180, south: -90, north: 90, key: "WORLD" });
const countryMapViews = Object.freeze({
  JP: Object.freeze({
    west: 105, east: 173, south: 20, north: 48,
    selectionWest: 122, selectionEast: 154, selectionSouth: 20, selectionNorth: 48,
    key: "JP",
  }),
});
const regionCache = new Map();
const regionLocationCache = new Map();
const regionPlotVersions = new WeakMap();
const mapObservers = [];
const mapViewports = new WeakMap();
const mapRenderers = new WeakMap();
const publicMapCamera = { ...publicMapHome };
const publicMapPointers = new Map();
let publicMapDrag = null;
let publicMapDragFrame = 0;
let publicMapPinch = null;
let publicMapPinchFrame = 0;
let publicMapWheelFrame = 0;
let publicMapWheel = null;
let publicMapViewportFrame = 0;
let publicMapFocusFrame = 0;
let publicMapFocusToken = 0;
let publicSensorDismissTimer = 0;
let publicOwnerProfileDismissTimer = 0;
let publicMapReturnTimer = 0;
let publicMapHoverTimer = 0;
let publicMapPollTimer = 0;
let publicMarkerDrag = null;
let publicMarkerDragFrame = 0;
let publicSensorDetailNeedsScrollReset = false;
let publicSensorFilter = "ALL";
let publicSensorQueryText = "";
let countries = [];
let devices = [];
let selectedDevice = null;
let publicSensors = [];
let socialBySensor = new Map();
let publicNetworkStats = { observationPackets: 0, payloadBytes: 0 };
let publicResonancePairs = [];
let selectedPublicSensorId = publicSensorIdFromHash();
let publicSensorSelectionDismissed = false;
let oracleDepthBoost = 0;
let currentProfile = null;
let analysisContext = null;
let selectedDeviceTelemetry = [];
let customAiEndpoint = "";
let customAiModel = "";
let authenticated = false;
let sessionUser = null;
let pollTimer = 0;
let detailRefreshPromise = null;
let statusTimer = 0;
let publicLocationEdit = null;
let measurementCategories = [];
let measurementCatalog = new Map();

publicSensorDetail?.addEventListener("scroll", () => {
  publicSensorDetailNeedsScrollReset = publicSensorDetail.scrollTop > 0;
}, { passive: true });

publicMapLocationCancel?.addEventListener("click", () => closePublicLocationEditor());
publicMapLocationSave?.addEventListener("click", () => { void savePublicLocationEdit(); });

const api = async (path, options = {}) => {
  const { body: requestBody, rawBody, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  if (requestBody !== undefined) headers.set("Content-Type", "application/json");
  if (options.method && options.method !== "GET" && options.method !== "HEAD") {
    const csrf = readCookie("__Host-gaia_sensor_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(path, {
    credentials: "include",
    ...requestOptions,
    headers,
    body: rawBody ?? (requestBody === undefined ? undefined : JSON.stringify(requestBody)),
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message || "通信に失敗しました。");
    error.code = body?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return body;
};

const stopDetailPolling = () => {
  window.clearInterval(pollTimer);
  pollTimer = 0;
};

const stopPublicMapPolling = () => {
  window.clearInterval(publicMapPollTimer);
  publicMapPollTimer = 0;
};

const startDetailPolling = () => {
  stopDetailPolling();
  if (document.visibilityState !== "visible" || document.documentElement.dataset.sensorView !== "detail" || !selectedDevice) return;
  pollTimer = window.setInterval(() => {
    if (document.visibilityState !== "visible" || document.documentElement.dataset.sensorView !== "detail") return;
    void refreshDetail({ quiet: true, includeHistory: false });
  }, detailLatestPollIntervalMs);
};

const startPublicMapPolling = () => {
  stopPublicMapPolling();
  if (document.visibilityState !== "visible" || document.documentElement.dataset.sensorView !== "map") return;
  publicMapPollTimer = window.setInterval(() => {
    if (document.visibilityState !== "visible" || document.documentElement.dataset.sensorView !== "map") return;
    void loadPublicSensors({ preserveSelection: true, quiet: true }).catch(() => {});
  }, publicMapPollIntervalMs);
};

const guideAnchor = () => {
  const anchorIds = ["sensor-kit-title", "measurement-catalog-title", "sensor-connect-path", "sensor-trouble-title"];
  const id = location.hash.slice(1);
  return anchorIds.includes(id) ? document.getElementById(id) : null;
};

const showView = (name) => {
  if (name !== "map" && publicLocationEdit) closePublicLocationEditor();
  document.documentElement.dataset.sensorView = name;
  if (participationDialog?.open && name !== "login") participationDialog.close();
  stopDetailPolling();
  stopPublicMapPolling();
  for (const [key, element] of views) element.hidden = key !== name;
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.toggleAttribute("aria-current", link.dataset.nav === name);
  });
  requestAnimationFrame(() => {
    if (document.documentElement.dataset.sensorView !== name) return;
    const anchor = name === "guide" ? guideAnchor() : null;
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    if (anchor) anchor.scrollIntoView({ block: "start", behavior });
    else if (window.scrollY > 0) window.scrollTo({ top: 0, behavior });
  });
  if (name === "map") {
    queuePublicMapViewportUpdate();
    startPublicMapPolling();
  }
  window.dispatchEvent(new CustomEvent("gaia:sensor-view-changed", { detail: { name } }));
};

document.addEventListener("visibilitychange", () => {
  const view = document.documentElement.dataset.sensorView;
  if (document.visibilityState !== "visible") {
    stopDetailPolling();
    stopPublicMapPolling();
    return;
  }
  if (view === "detail" && selectedDevice) {
    startDetailPolling();
    void refreshDetail({ quiet: true, includeHistory: false });
  } else if (view === "map") {
    startPublicMapPolling();
    void loadPublicSensors({ preserveSelection: true, quiet: true }).catch(() => {});
  }
});

const showStatus = (message, kind = "info") => {
  window.clearTimeout(statusTimer);
  statusRegion.hidden = false;
  statusRegion.dataset.kind = kind;
  statusRegion.textContent = message;
  statusTimer = window.setTimeout(() => { statusRegion.hidden = true; }, kind === "error" ? 6_000 : 2_800);
};

const boot = async () => {
  initSetupRequests(showStatus);
  const publicView = location.hash.startsWith("#map")
    ? "map"
    : location.hash === "#guide" || guideAnchor()
      ? "guide"
      : location.hash === "#terms"
        ? "terms"
        : null;
  showView(publicView || "loading");
  restoreAiConfiguration();
  initPublicMapNavigation();
  initPublicSensorDirectory();
  initSensorSenseField(publicSensorMap);
  void mountMapSurfaces();
  initLocationPickers();
  initRegionFields();
  await loadMeasurementCatalog().catch((error) => {
    if (measurementCatalogSummary) measurementCatalogSummary.textContent = "項目を読み込めませんでした。再読み込みしてください。";
    if (measurementCatalogSearch) measurementCatalogSearch.disabled = true;
    showStatus(error.message, "error");
  });
  await loadPublicSensors().catch((error) => showStatus(error.message, "error"));
  try {
    const session = await api("../api/web/v1/session");
    authenticated = true;
    sessionUser = session.user;
    syncAccountUi();
    const accountLoads = [loadCountries(), loadDevices(), loadSocial()];
    if (sessionUser.accountKind !== "trial") accountLoads.push(loadProfile());
    await Promise.all(accountLoads);
    routeFromHash();
  } catch (error) {
    authenticated = false;
    sessionUser = null;
    socialBySensor = new Map();
    syncAccountUi();
    if (error.status === 401) {
      if (location.hash.startsWith("#map")) showView("map");
      else if (location.hash === "#guide") showView("guide");
      else if (guideAnchor()) showView("guide");
      else if (location.hash === "#terms") showView("terms");
      else showView("login");
    }
    else {
      // A failed session lookup must not redirect public map visitors to signup.
      routeFromHash();
      showStatus(error.message, "error");
    }
  }
};

const loadCountries = async () => {
  const response = await api("../api/web/v1/countries");
  countries = response.countries;
  document.querySelectorAll("select[name='countryCode']").forEach((select) => {
    const initial = select.value;
    select.replaceChildren();
    if (select.closest("#device-form")) select.append(new Option("選択してください", ""));
    countries.forEach((country) => {
      const localized = country.nameLocal || (country.nameEn === country.code ? regionNames?.of(country.code) : country.nameEn);
      select.append(new Option(localized || country.code, country.code));
    });
    select.value = initial;
  });
};

const loadDevices = async () => {
  const response = await api("../api/web/v1/devices");
  devices = response.devices;
  deviceList.replaceChildren();
  emptyState.hidden = devices.length > 0;
  devices.forEach((device, index) => {
    const fragment = cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector("article");
    card.dataset.nodeIndex = String(index + 1).padStart(2, "0");
    card.dataset.state = device.state;
    const state = fragment.querySelector(".sensor-state");
    state.textContent = device.state;
    state.dataset.state = device.state;
    fragment.querySelector("small").textContent = device.deviceId;
    fragment.querySelector("h2").textContent = device.name;
    fragment.querySelector("h2").translate = false;
    fragment.querySelector("p").textContent = locationLabel(device);
    fragment.querySelector("button").addEventListener("click", () => openDetail(device.deviceId));
    card.dataset.deviceId = device.deviceId;
    deviceList.append(fragment);
  });
  if (publicSensors.length) renderPublicSensors();
};

const loadMeasurementCatalog = async () => {
  const response = await api("../api/public/v1/measurement-types");
  measurementCategories = Array.isArray(response.categories) ? response.categories : [];
  const definitions = Array.isArray(response.measurements) ? response.measurements : [];
  measurementCatalog = new Map(definitions.map((definition) => [definition.key, definition]));
  renderMeasurementPickers();
  renderMeasurementCatalog(response);
};

const renderMeasurementPickers = () => {
  document.querySelectorAll("[data-measurement-picker]").forEach((container) => {
    renderCompactMeasurementPicker(container, measurementCategories, measurementCatalog);
  });
};

const filterMeasurementCatalog = () => {
  if (!measurementCatalogGroups) return;
  const query = (measurementCatalogSearch?.value || "").normalize("NFKC").trim().toLocaleLowerCase();
  let matches = 0;
  let categories = 0;
  measurementCatalogGroups.querySelectorAll(".sensor-measurement-group").forEach((group) => {
    let count = 0;
    group.querySelectorAll(".sensor-measurement-item").forEach((item) => {
      const searchText = `${item.dataset.search} ${item.textContent}`.normalize('NFKC').toLocaleLowerCase();
      item.hidden = Boolean(query) && !searchText.includes(query);
      if (!item.hidden) count += 1;
    });
    if (query) {
      if (!Object.hasOwn(group.dataset, "beforeSearchOpen")) group.dataset.beforeSearchOpen = String(group.open);
      group.open = count > 0;
    } else if (Object.hasOwn(group.dataset, "beforeSearchOpen")) {
      group.open = group.dataset.beforeSearchOpen === "true";
      delete group.dataset.beforeSearchOpen;
    }
    group.hidden = count === 0;
    group.querySelector("summary b").textContent = `${count}項目`;
    matches += count;
    if (count) categories += 1;
  });
  if (measurementCatalogSummary) measurementCatalogSummary.textContent = query
    ? `${measurementCatalog.size}項目中 ${matches}項目が一致`
    : `${categories}つの分野 · ${matches}の観測項目`;
  if (measurementCatalogEmpty) measurementCatalogEmpty.hidden = !query || matches > 0;
};

measurementCatalogSearch?.addEventListener("input", filterMeasurementCatalog);

const renderMeasurementCatalog = (response) => {
  if (measurementCatalogDisclaimer && response.disclaimerJa) measurementCatalogDisclaimer.textContent = response.disclaimerJa;
  if (!measurementCatalogGroups) return;
  measurementCatalogGroups.replaceChildren();
  measurementCategories.forEach((category) => {
    const definitions = [...measurementCatalog.values()].filter((definition) => definition.category === category.id);
    if (!definitions.length) return;
    const details = document.createElement("details");
    details.className = "sensor-measurement-group";
    const summary = document.createElement("summary");
    summary.append(
      Object.assign(document.createElement("strong"), { textContent: category.labelJa }),
      Object.assign(document.createElement("b"), { textContent: `${definitions.length}項目` }),
      Object.assign(document.createElement("small"), { textContent: `${definitions.slice(0, 4).map((definition) => definition.labelJa).join("・")}${definitions.length > 4 ? " ほか" : ""}` }),
    );
    const list = document.createElement("div");
    list.className = "sensor-measurement-list";
    definitions.forEach((definition) => {
      const article = document.createElement("article");
      article.className = "sensor-measurement-item";
      article.dataset.search = [category.labelJa, definition.labelJa, definition.labelEn, definition.key, definition.unit, ...definition.interfaces, ...definition.exampleSensors].join(" ").normalize("NFKC").toLocaleLowerCase();
      const header = document.createElement("header");
      header.append(
        Object.assign(document.createElement("strong"), { textContent: `${definition.labelJa} / ${definition.unit}` }),
        Object.assign(document.createElement("code"), { textContent: definition.key }),
      );
      const description = Object.assign(document.createElement("p"), { textContent: `接続方式：${definition.interfaces.join("・")}` });
      const examples = Object.assign(document.createElement("p"), { textContent: `センサーの例：${definition.exampleSensors.join("、")}` });
      article.append(header, description, examples);
      if (definition.noteJa) article.append(Object.assign(document.createElement("p"), { className: "sensor-measurement-note", textContent: definition.noteJa }));
      list.append(article);
    });
    details.append(summary, list);
    measurementCatalogGroups.append(details);
  });
  if (measurementCatalogSearch) measurementCatalogSearch.disabled = false;
  filterMeasurementCatalog();
};

const loadPublicSensors = async ({ preserveSelection = true, quiet = false } = {}) => {
  const response = await api("../api/public/v1/sensors");
  publicSensors = response.sensors;
  publicNetworkStats = response.stats ?? { observationPackets: 0, payloadBytes: 0 };
  if (!preserveSelection) selectedPublicSensorId = null;
  renderPublicSensors();
  if (!quiet && views.get("map") && !views.get("map").hidden) queuePublicMapViewportUpdate();
};

const loadSocial = async () => {
  const response = await api("../api/web/v1/social");
  socialBySensor = new Map((response.sensors ?? []).map((social) => [social.sensorId, {
    favorite: social.favorite === true,
    liked: social.liked === true,
  }]));
  if (publicSensors.length) renderPublicSensors();
};

const renderPublicSensors = () => {
  const hadSelection = Boolean(selectedPublicSensorId);
  publicSensorMarkers.replaceChildren();
  publicSensorList.replaceChildren();
  const linkedSensorId = publicSensorIdFromHash();
  let linkedSensorFound = !linkedSensorId;
  publicSensors.forEach((sensor) => {
    sensor.visualType = publicSensorType(sensor);
    sensor.visualObservations = publicObservationsFor(sensor);
  });
  publicResonancePairs = buildPublicResonancePairs(publicSensors);
  const onlineCount = publicSensors.filter((sensor) => !sensor.isDemo && sensor.state === "ONLINE").length;
  const demoCount = publicSensors.filter((sensor) => sensor.isDemo).length;
  const offlineCount = publicSensors.length - onlineCount - demoCount;
  publicSensorCount.textContent = `${String(publicSensors.length).padStart(3, "0")} NODES · ${onlineCount} ONLINE · ${demoCount} DEMO · ${offlineCount} OFFLINE`;
  renderPublicNetworkStats();
  if (!publicSensors.length) {
    selectedPublicSensorId = null;
    if (linkedSensorId) setPublicSensorHash(null, { replace: true });
    publicSensorNetwork?.replaceChildren();
    publicSensorDetail.replaceChildren(
      Object.assign(document.createElement("small"), { className: "sensor-console-label", textContent: "SIGNAL STATUS" }),
      Object.assign(document.createElement("p"), { textContent: "公開中のセンサーはまだありません。最初の信号を待っています。" }),
    );
    applyPublicSensorFilters({ deferLayout: true });
    return;
  }
  let initialSelection = null;
  publicSensors.forEach((sensor) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "sensor-map-marker";
    marker.hidden = true;
    marker.dataset.sensorId = sensor.id;
    marker.dataset.sensorType = sensor.visualType;
    marker.dataset.longitude = String(sensor.location.longitude);
    marker.dataset.latitude = String(sensor.location.latitude);
    marker.dataset.state = sensor.state;
    marker.dataset.active = String(publicSensorIsActive(sensor));
    const activity = publicSensorActivity(sensor);
    marker.style.setProperty("--sensor-activity", String(activity));
    marker.style.setProperty("--sensor-glow", `${Math.round(13 + activity * 22)}px`);
    marker.style.setProperty("--sensor-pulse-duration", `${(3.1 - activity * 1.2).toFixed(2)}s`);
    marker.style.setProperty("--sensor-pulse-scale", String(1.32 + activity * .5));
    const markerLabel = `${sensor.owner.displayName}さんの${sensor.sensorName}、${publicSensorStateLabel(sensor)}`;
    const labelValues = { owner: sensor.owner.displayName, sensor: sensor.sensorName, state: publicSensorStateLabel(sensor) };
    markerLabelValues.set(marker, labelValues);
    marker.dataset.baseAriaLabel = markerLabel;
    bindSensorLabel(marker, '{owner}さんの{sensor}、{state}', labelValues, 'aria-label');
    marker.append(avatarElement(sensor.owner, "span"));
    marker.append(Object.assign(document.createElement("span"), {
      className: "sensor-map-marker-cluster-count",
      hidden: true,
    }));
    const primaryMetric = publicPrimaryMetric(sensor);
    const markerStateLabel = [publicSensorStateLabel(sensor), primaryMetric?.compact].filter(Boolean).join(" · ");
    marker.dataset.baseStateLabel = markerStateLabel;
    marker.append(Object.assign(document.createElement("span"), {
      className: "sensor-map-marker-state",
      textContent: markerStateLabel,
    }));
    marker.addEventListener("pointerdown", (event) => startPublicLocationMarkerDrag(event, sensor, marker));
    marker.addEventListener("pointermove", (event) => movePublicLocationMarkerDrag(event));
    marker.addEventListener("pointerup", (event) => finishPublicLocationMarkerDrag(event));
    marker.addEventListener("pointercancel", (event) => finishPublicLocationMarkerDrag(event, false));
    marker.addEventListener("click", (event) => {
      if (marker.dataset.skipLocationClick === "true") {
        delete marker.dataset.skipLocationClick;
        event.stopPropagation();
        return;
      }
      if (activatePublicSensorCluster(marker)) return;
      selectPublicSensor(sensor, marker, { historyMode: "push" });
      focusPublicSensor(sensor, { minimumZoom: publicMapFocusMinZoom, duration: publicMapPoiFocusDurationMs });
    });
    publicSensorMarkers.append(marker);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "sensor-public-card";
    card.dataset.sensorId = sensor.id;
    card.dataset.state = sensor.state;
    card.dataset.sensorType = sensor.visualType;
    card.append(avatarElement(sensor.owner, "span"));
    const text = document.createElement("span");
    text.append(
      Object.assign(document.createElement("strong"), { textContent: sensor.sensorName, translate: false }),
      Object.assign(document.createElement("small"), { textContent: `${sensor.owner.displayName} / ${publicSensorStateLabel(sensor)}`, translate: false }),
    );
    if (primaryMetric) text.append(Object.assign(document.createElement("em"), { textContent: primaryMetric.full }));
    card.append(text);
    card.addEventListener("pointerenter", () => {
      window.clearTimeout(publicMapHoverTimer);
      publicMapHoverTimer = window.setTimeout(() => focusPublicSensor(sensor, { minimumZoom: 5.2 }), 150);
    });
    card.addEventListener("pointerleave", () => window.clearTimeout(publicMapHoverTimer));
    card.addEventListener("focus", () => focusPublicSensor(sensor, { minimumZoom: 5.2 }));
    card.addEventListener("click", () => {
      selectPublicSensor(sensor, marker, { historyMode: "push" });
      focusPublicSensor(sensor, { minimumZoom: publicMapFocusMinZoom, duration: publicMapPoiFocusDurationMs });
      if (matchMedia("(max-width: 760px)").matches) {
        requestAnimationFrame(() => publicSensorDetail?.querySelector(".sensor-map-card-expand")?.focus({ preventScroll: true }));
      }
    });
    publicSensorList.append(card);
    if (sensor.id === linkedSensorId) linkedSensorFound = true;
    if (sensor.id === selectedPublicSensorId) initialSelection = { sensor, marker };
    else if (!initialSelection && !selectedPublicSensorId && !publicSensorSelectionDismissed && !sensor.isDemo) initialSelection = { sensor, marker };
  });
  if (!initialSelection && !publicSensorSelectionDismissed && publicSensors.length) {
    const sensor = publicSensors[0];
    initialSelection = { sensor, marker: publicSensorMarkers.querySelector(`[data-sensor-id="${CSS.escape(sensor.id)}"]`) };
  }
  if (linkedSensorId && !linkedSensorFound) setPublicSensorHash(null, { replace: true });
  if (initialSelection) {
    selectPublicSensor(initialSelection.sensor, initialSelection.marker);
    if (linkedSensorId === initialSelection.sensor.id) {
      requestAnimationFrame(() => focusPublicSensor(initialSelection.sensor, { minimumZoom: publicMapFocusMinZoom }));
    } else if (!hadSelection && matchMedia("(max-width: 760px)").matches) {
      requestAnimationFrame(() => focusPublicSensor(initialSelection.sensor, { minimumZoom: publicMapCamera.zoom }));
    }
  }
  applyPublicSensorFilters({ deferLayout: true });
};

function initPublicSensorDirectory() {
  document.querySelector("#public-map-search-open")?.addEventListener("click", () => {
    setPublicSensorDirectoryOpen(true, { focus: true });
  });
  // Reuse map updates and card resizing; the selection leader needs no animation loop.
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(renderPublicSelectionLink);
    observer.observe(publicSensorDetail);
    mapObservers.push(observer);
  }
  publicSensorQuery?.addEventListener("input", () => {
    publicSensorQueryText = publicSensorQuery.value;
    applyPublicSensorFilters();
  });
  document.querySelectorAll("[data-public-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      publicSensorFilter = button.dataset.publicFilter || "ALL";
      document.querySelectorAll("[data-public-filter]").forEach((option) => {
        option.setAttribute("aria-pressed", String(option === button));
      });
      applyPublicSensorFilters();
    });
  });
  publicMapDirectoryToggle?.addEventListener("click", () => {
    setPublicSensorDirectoryOpen(publicSensorDirectory?.dataset.open !== "true", { focus: true });
  });
  publicSensorDirectoryClose?.addEventListener("click", () => {
    setPublicSensorDirectoryOpen(false, { focus: true });
  });
  document.addEventListener("keydown", (event) => {
    if (views.get("map")?.hidden) return;
    if (publicOwnerProfileDialog?.open || analysisDialog?.open) return;
    const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
    if (event.key === "/" && !editing) {
      event.preventDefault();
      setPublicSensorDirectoryOpen(true, { focus: true });
      return;
    }
    if (event.key !== "Escape") return;
    if (publicLocationEdit) {
      event.preventDefault();
      closePublicLocationEditor();
    } else if (publicSensorDirectory?.dataset.open === "true") {
      event.preventDefault();
      setPublicSensorDirectoryOpen(false, { focus: true });
    } else if (publicSensorQueryText) {
      event.preventDefault();
      publicSensorQueryText = "";
      if (publicSensorQuery) publicSensorQuery.value = "";
      applyPublicSensorFilters();
    } else if (publicSensorDetail?.dataset.expanded === "true" && matchMedia("(max-width: 760px)").matches) {
      event.preventDefault();
      setPublicSensorDetailExpanded(false, { focus: true });
    } else if (selectedPublicSensorId) {
      event.preventDefault();
      dismissPublicSensorSelection({ historyMode: "push", focusMap: true });
    }
  });
}

function applyPublicSensorFilters({ deferLayout = false } = {}) {
  const query = normalizePublicSensorSearch(publicSensorQueryText);
  let visibleCount = 0;
  let selectedVisible = !selectedPublicSensorId;
  publicSensors.forEach((sensor) => {
    const stateMatches = publicSensorFilter === "ALL"
      || (publicSensorFilter === "DEMO" && sensor.isDemo)
      || (publicSensorFilter === "ONLINE" && !sensor.isDemo && sensor.state === "ONLINE")
      || (publicSensorFilter === "OFFLINE" && !sensor.isDemo && sensor.state !== "ONLINE");
    const searchText = normalizePublicSensorSearch([
      sensor.sensorName,
      sensor.owner?.displayName,
      sensor.region?.countryCode,
      sensor.region?.subdivisionCode,
      sensor.region?.subdivisionName,
      sensor.region?.municipalityCode,
      sensor.region?.municipalityName,
      sensor.demoLocationLabel,
      publicSensorStateLabel(sensor),
    ].filter(Boolean).join(" "));
    const visible = stateMatches && (!query || searchText.includes(query));
    visibleCount += Number(visible);
    if (visible && sensor.id === selectedPublicSensorId) selectedVisible = true;
    const marker = publicSensorMarkers?.querySelector(`[data-sensor-id="${CSS.escape(sensor.id)}"]`);
    const card = publicSensorList?.querySelector(`[data-sensor-id="${CSS.escape(sensor.id)}"]`);
    if (marker) marker.dataset.filtered = String(!visible);
    if (card) card.hidden = !visible;
  });
  if (!selectedVisible) clearPublicSensorSelection({ hideDetail: true, historyMode: "replace" });
  if (publicSensorResults) publicSensorResults.value = `${visibleCount} / ${publicSensors.length}件`;
  if (publicMapDirectoryCount) publicMapDirectoryCount.textContent = String(publicSensors.length);
  if (publicSensorEmpty) publicSensorEmpty.hidden = visibleCount !== 0;
  if (deferLayout) queuePublicMapViewportUpdate();
  else positionPublicSensorMarkers();
}

function normalizePublicSensorSearch(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/gu, " ").trim();
}

function publicSensorIdFromHash() {
  const prefix = "#map/sensor=";
  if (!location.hash.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(location.hash.slice(prefix.length)) || null;
  } catch {
    return null;
  }
}

function setPublicSensorHash(sensorId, { replace = false } = {}) {
  const nextHash = sensorId ? `#map/sensor=${encodeURIComponent(sensorId)}` : "#map";
  if (location.hash === nextHash) return;
  history[replace ? "replaceState" : "pushState"](null, "", nextHash);
}

function restorePublicSensorSelectionFromHash() {
  const sensorId = publicSensorIdFromHash();
  if (!sensorId) {
    if (selectedPublicSensorId) dismissPublicSensorSelection();
    return;
  }
  const sensor = publicSensors.find((candidate) => candidate.id === sensorId);
  const marker = publicSensorMarkers?.querySelector(`[data-sensor-id="${CSS.escape(sensorId)}"]`);
  if (!sensor || !marker) {
    setPublicSensorHash(null, { replace: true });
    return;
  }
  selectPublicSensor(sensor, marker);
  focusPublicSensor(sensor, { minimumZoom: publicMapFocusMinZoom });
}

function setPublicSensorDirectoryOpen(open, { focus = false } = {}) {
  if (!publicSensorDirectory || !publicMapDirectoryToggle) return;
  publicSensorDirectory.dataset.open = String(open);
  publicSensorDirectory.setAttribute("aria-hidden", String(!open));
  publicSensorDirectory.toggleAttribute("inert", !open);
  publicMapDirectoryToggle.setAttribute("aria-expanded", String(open));
  document.querySelector("#public-map-search-open")?.setAttribute("aria-expanded", String(open));
  if (matchMedia("(max-width: 760px)").matches) {
    if (open) {
      setPublicSensorDetailExpanded(false);
      publicSensorDetail.hidden = true;
    } else if (selectedPublicSensorId) {
      publicSensorDetail.hidden = false;
      setPublicSensorDetailExpanded(false);
    }
  }
  if (focus) {
    if (open) requestAnimationFrame(() => requestAnimationFrame(() => {
      if (publicSensorDirectory.dataset.open === "true") publicSensorQuery?.focus({ preventScroll: true });
    }));
    else publicMapDirectoryToggle.focus({ preventScroll: true });
  }
  renderPublicSelectionLink();
}

function setPublicSensorDetailExpanded(expanded, { focus = false } = {}) {
  if (!publicSensorDetail) return;
  publicSensorDetail.dataset.expanded = String(expanded);
  const toggle = publicSensorDetail.querySelector(".sensor-map-card-expand");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "たたむ" : "詳細を見る";
    if (focus) toggle.focus({ preventScroll: true });
  }
  if (!expanded && publicSensorDetailNeedsScrollReset) {
    publicSensorDetailNeedsScrollReset = false;
    requestAnimationFrame(() => { publicSensorDetail.scrollTop = 0; });
  }
}

function clearPublicSensorSelection({ hideDetail = false, historyMode = null } = {}) {
  window.clearTimeout(publicSensorDismissTimer);
  publicSensorDismissTimer = 0;
  publicSensorDetail?.removeAttribute("data-closing");
  selectedPublicSensorId = null;
  publicSensorSelectionDismissed = true;
  if (historyMode) setPublicSensorHash(null, { replace: historyMode === "replace" });
  document.querySelectorAll(".sensor-map-marker[aria-current], .sensor-public-card[aria-current]").forEach((element) => element.removeAttribute("aria-current"));
  publicSensorMap?.dispatchEvent(new CustomEvent("gaia:sensor-focus", { detail: { sensorId: null } }));
  if (!publicSensorDetail) return;
  setPublicSensorDetailExpanded(false);
  publicSensorDetail.hidden = hideDetail;
  publicSensorDetail.replaceChildren(
    Object.assign(document.createElement("small"), { className: "sensor-console-label", textContent: "SELECTED SIGNAL" }),
    Object.assign(document.createElement("p"), { textContent: "地図上のアイコンまたは観測点一覧から選んでください。" }),
  );
}

function animatePublicMapReturn() {
  if (!publicSensorMap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.clearTimeout(publicMapReturnTimer);
  publicSensorMap.classList.remove("is-returning");
  void publicSensorMap.offsetWidth;
  publicSensorMap.dataset.uiReturn = "fade-in";
  publicSensorMap.classList.add("is-returning");
  publicMapReturnTimer = window.setTimeout(() => {
    publicMapReturnTimer = 0;
    publicSensorMap.classList.remove("is-returning");
    publicSensorMap.dataset.uiReturn = "idle";
  }, publicMapReturnDurationMs);
}

function dismissPublicSensorSelection({ historyMode = null, focusMap = false } = {}) {
  if (!selectedPublicSensorId || publicSensorDetail?.dataset.closing === "true") return;
  const finish = () => {
    publicSensorDismissTimer = 0;
    clearPublicSensorSelection({ hideDetail: true, historyMode });
    animatePublicMapReturn();
    if (focusMap) publicSensorMap?.focus({ preventScroll: true });
  };
  if (!publicSensorDetail || publicSensorDetail.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }
  publicSensorDetail.dataset.closing = "true";
  publicSensorDismissTimer = window.setTimeout(finish, publicUiDismissDurationMs);
}

const selectPublicSensor = (sensor, marker, { historyMode = null } = {}) => {
  if (!marker) return;
  window.clearTimeout(publicSensorDismissTimer);
  publicSensorDismissTimer = 0;
  publicSensorDetail.removeAttribute("data-closing");
  publicSensorDetail.hidden = false;
  publicSensorDetail.dataset.expanded = "false";
  if (publicSensorDetailNeedsScrollReset) {
    publicSensorDetailNeedsScrollReset = false;
    requestAnimationFrame(() => {
      if (selectedPublicSensorId === sensor.id) publicSensorDetail.scrollTop = 0;
    });
  }
  setPublicSensorDirectoryOpen(false);
  selectedPublicSensorId = sensor.id;
  publicSensorSelectionDismissed = false;
  if (historyMode) setPublicSensorHash(sensor.id, { replace: historyMode === "replace" });
  document.querySelectorAll(".sensor-map-marker[aria-current]").forEach((element) => element.removeAttribute("aria-current"));
  document.querySelectorAll(".sensor-public-card[aria-current]").forEach((element) => element.removeAttribute("aria-current"));
  marker.setAttribute("aria-current", "true");
  publicSensorList.querySelector(`[data-sensor-id="${CSS.escape(sensor.id)}"]`)?.setAttribute("aria-current", "true");
  publicSensorMap?.dispatchEvent(new CustomEvent("gaia:sensor-focus", {
    detail: { sensorId: sensor.id },
  }));
  publicSensorDetail.replaceChildren();
  const consoleLabel = Object.assign(document.createElement("small"), { className: "sensor-console-label", textContent: "SELECTED SIGNAL" });
  const toolbar = document.createElement("header");
  toolbar.className = "sensor-map-card-toolbar";
  const actions = document.createElement("span");
  actions.className = "sensor-map-card-actions";
  const expand = Object.assign(document.createElement("button"), { type: "button", className: "sensor-map-card-expand", textContent: "詳細を見る" });
  expand.setAttribute("aria-controls", "public-sensor-detail");
  expand.setAttribute("aria-expanded", "false");
  expand.addEventListener("click", () => {
    setPublicSensorDetailExpanded(publicSensorDetail.dataset.expanded !== "true");
  });
  const share = Object.assign(document.createElement("button"), { type: "button", className: "sensor-map-card-share", textContent: "共有" });
  bindSensorLabel(share, '{name}の共有リンクをコピー', { name: sensor.sensorName }, 'aria-label');
  share.addEventListener("click", async () => {
    setPublicSensorHash(sensor.id, { replace: true });
    try {
      await navigator.clipboard.writeText(location.href);
      share.textContent = "コピー済み";
      window.setTimeout(() => { share.textContent = "共有"; }, 1_600);
    } catch {
      showStatus("アドレスバーのURLをコピーしてください。", "error");
    }
  });
  const close = Object.assign(document.createElement("button"), { type: "button", textContent: "閉じる" });
  close.className = "sensor-map-card-close";
  close.setAttribute("aria-label", "選択中のセンサー詳細を閉じる");
  close.addEventListener("click", () => {
    dismissPublicSensorSelection({ historyMode: "push", focusMap: true });
  });
  actions.append(expand, share, close);
  toolbar.append(consoleLabel, actions);
  const owner = document.createElement("div");
  owner.className = "sensor-map-owner";
  const ownerProfile = Object.assign(document.createElement("button"), {
    type: "button",
    className: "sensor-owner-profile-trigger",
    title: `${sensor.owner.displayName}さんのプロフィールを見る`,
  });
  bindSensorLabel(ownerProfile, '{name}さんのプロフィールを見る', { name: sensor.owner.displayName }, 'title');
  bindSensorLabel(ownerProfile, '{name}さんの公開プロフィールを見る', { name: sensor.owner.displayName }, 'aria-label');
  ownerProfile.setAttribute("aria-haspopup", "dialog");
  ownerProfile.setAttribute("aria-controls", "public-owner-profile");
  ownerProfile.append(avatarElement(sensor.owner, "span"));
  ownerProfile.addEventListener("click", () => openPublicOwnerProfile(sensor));
  owner.append(ownerProfile);
  const heading = document.createElement("div");
  heading.append(Object.assign(document.createElement("small"), { textContent: sensor.owner.displayName, translate: false }));
  heading.append(Object.assign(document.createElement("h2"), { textContent: sensor.sensorName, translate: false }));
  owner.append(heading);
  const state = Object.assign(document.createElement("span"), { className: "sensor-state", textContent: publicSensorStateLabel(sensor) });
  state.dataset.state = sensor.isDemo ? "DEMO" : sensor.state;
  owner.append(state);
  const social = document.createElement("div");
  social.className = "sensor-map-socials";
  [["X", sensor.owner.xUrl], ["GitHub", sensor.owner.githubUrl], ["Instagram", sensor.owner.instagramUrl]].forEach(([label, url]) => {
    if (!url) return;
    const link = Object.assign(document.createElement("a"), { href: url, textContent: label, target: "_blank", rel: "noopener noreferrer" });
    social.append(link);
  });
  const note = document.createElement("p");
  const region = [sensor.region?.subdivisionName, sensor.region?.municipalityName].filter(Boolean).join(" / ") || sensor.region?.countryCode || "地域未設定";
  note.textContent = `${region} · POIは参加者が地図上で選んだ公開位置です。実際の設置場所を示すとは限りません。`;
  const content = [toolbar, owner, createPublicMetricHud(sensor), createPublicRelationshipBar(sensor), createPublicNodeMeta(sensor), createPublicOracle(sensor)];
  if (sensor.isDemo) {
    const disclosure = document.createElement("p");
    disclosure.className = "sensor-demo-disclosure";
    const demoRegion = [sensor.region?.subdivisionName, sensor.demoLocationLabel].filter(Boolean).join("・");
    disclosure.textContent = "展示用のダミーセンサーです。実機の観測値ではありません。";
    disclosure.title = demoRegion ? `${demoRegion}に置いた展示用センサー` : "展示用センサー";
    content.push(disclosure);
  }
  content.push(note);
  const ownedDevice = ownedDeviceForPublicSensor(sensor);
  if (ownedDevice) content.push(createPublicLocationEditAction(sensor, ownedDevice));
  if (social.childElementCount) content.push(social);
  publicSensorDetail.append(...content);
  renderPublicSelectionLink();
};

function ownedDeviceForPublicSensor(sensor) {
  if (!authenticated || !sensor?.id) return null;
  return devices.find((device) => device.publicId === sensor.id) ?? null;
}

function createPublicLocationEditAction(sensor, device) {
  const wrapper = document.createElement("div");
  wrapper.className = "sensor-public-location-action";
  const button = Object.assign(document.createElement("button"), {
    type: "button",
    className: "sensor-secondary",
    textContent: "このPOIを大地図で動かす",
  });
  button.addEventListener("click", () => openPublicLocationEditor(sensor, device));
  wrapper.append(button);
  return wrapper;
}

function openPublicLocationEditor(sensor, device) {
  if (!sensor?.location || !device || !publicMapLocationEditor) return;
  publicLocationEdit = {
    sensorId: sensor.id,
    deviceId: device.deviceId,
    sensorName: sensor.sensorName,
    latitude: roundPublicLocationCoordinate(sensor.location.latitude),
    longitude: roundPublicLocationCoordinate(sensor.location.longitude),
  };
  publicMapLocationEditor.hidden = false;
  publicSensorMap.dataset.locationEditing = "true";
  setPublicSensorDirectoryOpen(false);
  publicSensorDetail.hidden = true;
  updatePublicLocationEditor();
  positionPublicSensorMarkers();
  publicSensorMap.focus({ preventScroll: true });
  showStatus("地図をクリックするか、アイコンをドラッグして公開POIを動かしてください。");
}

function closePublicLocationEditor() {
  publicLocationEdit = null;
  publicMarkerDrag = null;
  if (publicMarkerDragFrame) cancelAnimationFrame(publicMarkerDragFrame);
  publicMarkerDragFrame = 0;
  publicMapLocationEditor.hidden = true;
  delete publicSensorMap.dataset.locationEditing;
  publicSensorMap.classList.remove("is-location-dragging");
  if (selectedPublicSensorId) publicSensorDetail.hidden = false;
  positionPublicSensorMarkers();
}

function updatePublicLocationEditor() {
  if (!publicLocationEdit) return;
  bindSensorLabel(publicMapLocationTitle, '{name}の公開POI', { name: publicLocationEdit.sensorName });
  if (publicMapLocationOutput) {
    publicMapLocationOutput.value = `${publicLocationEdit.latitude.toFixed(5)}, ${publicLocationEdit.longitude.toFixed(5)}`;
  }
}

function setPublicLocationEditPoint(latitude, longitude) {
  if (!publicLocationEdit) return;
  publicLocationEdit.latitude = roundPublicLocationCoordinate(clamp(Number(latitude), -90, 90));
  publicLocationEdit.longitude = roundPublicLocationCoordinate(normalizeLongitude(Number(longitude)));
  updatePublicLocationEditor();
  positionPublicSensorMarkers();
}

function setPublicLocationEditPointFromClient(clientX, clientY) {
  if (!publicLocationEdit) return;
  const point = publicMapCoordinateAtClient(clientX, clientY);
  setPublicLocationEditPoint(point.latitude, point.longitude);
}

function publicMapCoordinateAtClient(clientX, clientY) {
  const rect = publicSensorMap.getBoundingClientRect();
  const view = publicMapView();
  const xRatio = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const yRatio = clamp((clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
  return {
    latitude: view.north - yRatio * (view.north - view.south),
    longitude: normalizeLongitude(view.west + xRatio * (view.east - view.west)),
  };
}

function startPublicLocationMarkerDrag(event, sensor, marker) {
  if (event.button !== 0 || publicLocationEdit?.sensorId !== sensor.id) return;
  event.preventDefault();
  event.stopPropagation();
  publicMarkerDrag = { pointerId: event.pointerId, marker, clientX: event.clientX, clientY: event.clientY, moved: false };
  try { marker.setPointerCapture(event.pointerId); } catch {}
  publicSensorMap.classList.add("is-location-dragging");
}

function movePublicLocationMarkerDrag(event) {
  if (!publicMarkerDrag || publicMarkerDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  publicMarkerDrag.clientX = event.clientX;
  publicMarkerDrag.clientY = event.clientY;
  publicMarkerDrag.moved = true;
  if (publicMarkerDragFrame) return;
  publicMarkerDragFrame = requestAnimationFrame(() => {
    publicMarkerDragFrame = 0;
    if (publicMarkerDrag) setPublicLocationEditPointFromClient(publicMarkerDrag.clientX, publicMarkerDrag.clientY);
  });
}

function finishPublicLocationMarkerDrag(event, commit = true) {
  if (!publicMarkerDrag || publicMarkerDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const { marker, moved } = publicMarkerDrag;
  if (publicMarkerDragFrame) cancelAnimationFrame(publicMarkerDragFrame);
  publicMarkerDragFrame = 0;
  if (commit) setPublicLocationEditPointFromClient(event.clientX, event.clientY);
  publicMarkerDrag = null;
  publicSensorMap.classList.remove("is-location-dragging");
  if (moved) marker.dataset.skipLocationClick = "true";
}

async function savePublicLocationEdit() {
  if (!publicLocationEdit || !publicMapLocationSave) return;
  const edit = { ...publicLocationEdit };
  const device = devices.find((candidate) => candidate.deviceId === edit.deviceId && candidate.publicId === edit.sensorId);
  if (!device) {
    showStatus("この観測点の編集権限を確認できませんでした。", "error");
    closePublicLocationEditor();
    return;
  }
  publicMapLocationSave.disabled = true;
  try {
    const body = {
      name: device.name,
      countryCode: device.countryCode,
      subdivisionCode: device.subdivisionCode,
      municipalityCode: device.municipalityCode,
      admin1Code: device.subdivisionCode ? null : device.admin1Code,
      localityName: device.municipalityCode ? null : device.localityName,
      isPublic: true,
      publicLatitude: edit.latitude,
      publicLongitude: edit.longitude,
      measurementKeys: device.measurementKeys,
    };
    const response = await api(`../api/web/v1/devices/${encodeURIComponent(device.deviceId)}`, { method: "PATCH", body });
    devices = devices.map((candidate) => candidate.deviceId === device.deviceId ? response.device : candidate);
    if (selectedDevice?.deviceId === device.deviceId) selectedDevice = response.device;
    const sensor = publicSensors.find((candidate) => candidate.id === edit.sensorId);
    if (sensor) sensor.location = { latitude: edit.latitude, longitude: edit.longitude, precision: "PUBLIC_REFERENCE_POINT" };
    closePublicLocationEditor();
    renderPublicSensors();
    showStatus("公開POIを更新しました。");
    void loadPublicSensors({ preserveSelection: true, quiet: true }).catch((error) => showStatus(error.message, "error"));
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    publicMapLocationSave.disabled = false;
  }
}

function roundPublicLocationCoordinate(value) {
  return Math.round(Number(value) * 100_000) / 100_000;
}

function createPublicRelationshipBar(sensor) {
  const bar = document.createElement("div");
  bar.className = "sensor-relationship-bar";
  const like = Object.assign(document.createElement("button"), {
    type: "button",
    className: "sensor-like-trigger",
  });
  like.dataset.relationship = "like";
  like.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>';
  const analyze = Object.assign(document.createElement("button"), {
    type: "button",
    className: "sensor-analyze-trigger",
    textContent: "分析・AI質問",
  });
  const refresh = () => {
    const social = socialBySensor.get(sensor.id) ?? { favorite: false, liked: false };
    const likeCount = Number(sensor.likeCount || 0).toLocaleString("ja-JP");
    like.setAttribute("aria-pressed", String(social.liked));
    like.setAttribute("aria-label", social.liked ? `応援を取り消す（現在${likeCount}件）` : `この観測点を応援する（現在${likeCount}件）`);
    like.title = social.liked ? `応援済み · ${likeCount}` : `応援する · ${likeCount}`;
  };
  like.addEventListener("click", () => togglePublicLike(sensor, like, refresh));
  analyze.addEventListener("click", () => openSensorAnalysis({
    id: sensor.id,
    name: sensor.sensorName,
    region: [sensor.region?.subdivisionName, sensor.region?.municipalityName, sensor.region?.countryCode].filter(Boolean).join(" / "),
    observations: sensor.visualObservations,
    isDemo: sensor.isDemo,
    source: "public",
  }));
  refresh();
  bar.append(like, analyze);
  return bar;
}

async function togglePublicLike(sensor, button, refresh) {
  if (!authenticated) {
    showStatus("応援するには、Googleまたはおためし参加でログインしてください。", "error");
    showView("login");
    history.replaceState(null, "", "#login");
    return;
  }
  const current = socialBySensor.get(sensor.id) ?? { favorite: false, liked: false };
  const enabled = !current.liked;
  button.disabled = true;
  try {
    const response = await api(`../api/web/v1/sensors/${encodeURIComponent(sensor.id)}/like`, {
      method: enabled ? "PUT" : "DELETE",
    });
    socialBySensor.set(sensor.id, {
      favorite: response.social.favorite === true,
      liked: response.social.liked === true,
    });
    sensor.likeCount = Number(response.social.likeCount) || 0;
    refresh();
    showStatus(enabled ? "この観測点を応援しました。" : "応援を取り消しました。");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function openPublicOwnerProfile(sensor) {
  if (!publicOwnerProfileDialog) return;
  window.clearTimeout(publicOwnerProfileDismissTimer);
  publicOwnerProfileDismissTimer = 0;
  publicOwnerProfileDialog.removeAttribute("data-closing");
  const owner = sensor.owner ?? {};
  const region = [sensor.region?.subdivisionName, sensor.region?.municipalityName, sensor.region?.countryCode].filter(Boolean).join(" / ") || "地域未設定";
  publicOwnerProfileAvatar.replaceChildren(avatarElement(owner, "span"));
  publicOwnerProfileName.textContent = owner.displayName || "GAIA参加者";
  publicOwnerProfileSensor.textContent = sensor.sensorName;
  publicOwnerProfileName.translate = !owner.displayName;
  publicOwnerProfileSensor.translate = false;
  publicOwnerProfileRegion.textContent = region;
  publicOwnerProfileNote.textContent = sensor.isDemo
    ? "展示用ダミーセンサーのプロフィールです。実機の観測者ではありません。"
    : "地図の位置は参加者が設定した公開用の目安です。実際の設置場所とは異なる場合があります。";
  publicOwnerProfileDialog.dataset.demo = String(Boolean(sensor.isDemo));
  publicOwnerProfileLinks.replaceChildren();
  const linkIcons = {
    X: '<path d="M4 3h4l12 18h-4L4 3Zm16 0L4 21"/>',
    GitHub: '<path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5v-3.4c0-1 .1-1.6-.5-2.2 3.2-.4 6.5-1.5 6.5-7a5.4 5.4 0 0 0-1.5-3.7c.2-.9.2-2.3-.2-3.3 0 0-1.2-.4-3.8 1.4a13 13 0 0 0-7 0C5.9 1.3 4.7 1.7 4.7 1.7c-.4 1-.4 2.4-.2 3.3A5.4 5.4 0 0 0 3 8.7c0 5.5 3.3 6.6 6.5 7-.5.5-.6 1.1-.5 2.2v3.4"/>',
    Instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  };
  [["X", owner.xUrl], ["GitHub", owner.githubUrl], ["Instagram", owner.instagramUrl]].forEach(([label, url]) => {
    if (!url) return;
    const link = Object.assign(document.createElement("a"), {
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
    });
    link.setAttribute("aria-label", `${label}の公開プロフィールを開く（新しいタブ）`);
    link.innerHTML = `<svg class="sensor-profile-social-icon" viewBox="0 0 24 24" aria-hidden="true">${linkIcons[label]}</svg>`;
    link.append(Object.assign(document.createElement("span"), { textContent: label }));
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("viewBox", "0 0 24 24");
    arrow.setAttribute("class", "sensor-profile-link-arrow");
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = '<path d="M7 17 17 7M7 7h10v10"/>';
    link.append(arrow);
    publicOwnerProfileLinks.append(link);
  });
  if (!publicOwnerProfileLinks.childElementCount) {
    publicOwnerProfileLinks.append(Object.assign(document.createElement("p"), { textContent: "SNSリンクは登録されていません。" }));
  }
  if (publicOwnerProfileDialog.open) publicOwnerProfileDialog.close();
  publicOwnerProfileDialog.showModal();
}

function dismissPublicOwnerProfile() {
  if (!publicOwnerProfileDialog?.open || publicOwnerProfileDialog.dataset.closing === "true") return;
  const finish = () => {
    publicOwnerProfileDismissTimer = 0;
    publicOwnerProfileDialog.removeAttribute("data-closing");
    publicOwnerProfileDialog.close();
    animatePublicMapReturn();
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }
  publicOwnerProfileDialog.dataset.closing = "true";
  publicOwnerProfileDismissTimer = window.setTimeout(finish, publicUiDismissDurationMs);
}

function publicSensorType(sensor) {
  const source = `${sensor.id} ${sensor.sensorName} ${sensor.owner?.displayName}`.toLowerCase();
  if (/あめ|ame/u.test(source)) return "ame";
  if (/みず|mizu/u.test(source)) return "mizu";
  if (/saku|サクヤ|咲夜/u.test(source)) return "saku";
  return "custom";
}

function publicSensorIsActive(sensor) {
  return sensor.isDemo || sensor.state === "ONLINE";
}

function publicSensorStateLabel(sensor) {
  return sensor.isDemo ? "DEMO LIVE" : sensor.state;
}

function publicObservationsFor(sensor) {
  if (sensor.isDemo) return createDemoObservationSeries(sensor);
  if (!Array.isArray(sensor.observations)) return [];
  return sensor.observations
    .map((observation) => ({ data: sanitizePublicMeasurements(observation?.data) }))
    .filter((observation) => Object.keys(observation.data).length);
}

function sanitizePublicMeasurements(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, measurement]) => Number.isFinite(Number(measurement))).map(([key, measurement]) => [key, Number(measurement)]));
}

function createDemoObservationSeries(sensor, count = 18) {
  const seed = hashPublicSensorId(sensor.id);
  const phase = (Math.floor(Date.now() / 300_000) + seed) * .17;
  return Array.from({ length: count }, (_, index) => {
    const t = count - index - 1;
    const wave = Math.sin(phase - t * .46);
    const slower = Math.cos(phase * .61 - t * .27);
    const ripple = Math.sin(phase * 1.37 - t * .81);
    if (sensor.visualType === "ame") return { data: {
      electric_field: rounded(1.8 + wave * .72 + ripple * .18, 2),
      pressure: rounded(1007.4 + slower * 5.6 - wave * 2.1, 1),
      radio_noise: rounded(-72 + ripple * 8 + wave * 3, 1),
    } };
    if (sensor.visualType === "mizu") return { data: {
      water_temperature: rounded(13.2 + slower * 2.4 + ripple * .3, 1),
      humidity: rounded(78 + wave * 8 + ripple * 2, 1),
      groundwater_level: rounded(1.62 + slower * .24 + wave * .08, 2),
    } };
    if (sensor.visualType === "saku") return { data: {
      spatial_noise: rounded(.018 + Math.abs(ripple) * .024 + Math.abs(wave) * .007, 3),
      illuminance: Math.round(470 + slower * 210 + ripple * 45),
      sync_rate: rounded(89 + wave * 5 + slower * 2, 1),
    } };
    return { data: {
      temperature: rounded(24.8 + wave * 2.2 + ripple * .35, 1),
      humidity: rounded(54 + slower * 7 + ripple * 1.8, 1),
      pm25: rounded(9.4 + Math.abs(wave) * 4.2 + ripple * .8, 1),
    } };
  });
}

function hashPublicSensorId(value) {
  let hash = 2166136261;
  for (const character of String(value)) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return hash >>> 0;
}

function rounded(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const fallbackMetricMetadata = Object.freeze({
  temperature: { label: "気温", console: "TEMP", unit: "°C", digits: 1 },
  humidity: { label: "湿度", console: "HUM", unit: "%", digits: 1 },
  pm25: { label: "PM2.5", console: "PM2.5", unit: "µg/m³", digits: 1 },
  pressure: { label: "気圧", console: "PRESS", unit: "hPa", digits: 1 },
  illuminance: { label: "照度", console: "LUX", unit: "lx", digits: 0 },
  rssi: { label: "電波強度", console: "RSSI", unit: "dBm", digits: 0 },
  geomagnetic: { label: "地磁気変動", console: "MAG", unit: "µT", digits: 2 },
  electric_field: { label: "電界変動", console: "E-FIELD", unit: "kV/m", digits: 2 },
  radio_noise: { label: "電波ノイズ", console: "RF NOISE", unit: "dBm", digits: 1 },
  water_temperature: { label: "水温", console: "WATER", unit: "°C", digits: 1 },
  groundwater_level: { label: "地下水位", console: "GROUND", unit: "m", digits: 2 },
  spatial_noise: { label: "空間ノイズ", console: "SPACE Δ", unit: "Δ", digits: 3 },
  sync_rate: { label: "識理層シンクロ率", console: "SYNC", unit: "%", digits: 1 },
});

function metricDefinition(key) {
  const registered = measurementCatalog.get(key);
  if (registered) return {
    label: registered.labelJa,
    console: String(registered.labelEn || key).toUpperCase(),
    unit: registered.unit,
    digits: registered.digits,
  };
  return fallbackMetricMetadata[key] ?? { label: key, console: key.toUpperCase(), unit: "", digits: 2 };
}

function publicMetricDefinitions(sensor) {
  const latest = sensor.visualObservations?.[0]?.data ?? {};
  const preferred = sensor.visualType === "ame"
    ? ["electric_field", "pressure", "radio_noise"]
    : sensor.visualType === "mizu"
      ? ["water_temperature", "humidity", "groundwater_level"]
      : sensor.visualType === "saku"
        ? ["spatial_noise", "illuminance", "sync_rate"]
        : ["temperature", "humidity", "pm25", "pressure", "illuminance", "rssi", "geomagnetic"];
  const orderedKeys = [...preferred.filter((key) => key in latest), ...Object.keys(latest).filter((key) => !preferred.includes(key))];
  return orderedKeys.slice(0, 6).map((key) => ({ key, ...metricDefinition(key) }));
}

function formatPublicMetric(definition, value, compact = false) {
  if (!Number.isFinite(value)) return "--";
  const text = Number(value).toLocaleString("ja-JP", { minimumFractionDigits: definition.digits, maximumFractionDigits: definition.digits });
  return compact ? `${text}${definition.unit}` : `${text} ${definition.unit}`.trim();
}

function publicPrimaryMetric(sensor) {
  const definition = publicMetricDefinitions(sensor)[0];
  if (!definition) return null;
  const value = sensor.visualObservations?.[0]?.data?.[definition.key];
  if (!Number.isFinite(value)) return null;
  return {
    compact: formatPublicMetric(definition, value, true),
    full: `${definition.label} ${formatPublicMetric(definition, value)}`,
  };
}

function publicSensorActivity(sensor) {
  if (!publicSensorIsActive(sensor)) return .18;
  const definitions = publicMetricDefinitions(sensor);
  const latest = sensor.visualObservations?.[0]?.data ?? {};
  const value = definitions.length ? Math.abs(Number(latest[definitions[0].key])) : 0;
  return rounded(clamp(.48 + (value % 19) / 50, .48, .88), 2);
}

function createPublicMetricHud(sensor) {
  const section = document.createElement("section");
  section.className = "sensor-observation-hud";
  const header = document.createElement("header");
  header.append(
    Object.assign(document.createElement("span"), { textContent: sensor.isDemo ? "SIMULATED METRICS" : "LIVE METRICS" }),
    Object.assign(document.createElement("b"), { textContent: publicSensorTypeLabel(sensor.visualType) }),
  );
  section.append(header);
  const grid = document.createElement("div");
  grid.className = "sensor-metric-hud-grid";
  const definitions = publicMetricDefinitions(sensor).slice(0, 3);
  if (!definitions.length) {
    grid.append(Object.assign(document.createElement("p"), { className: "sensor-metric-awaiting", textContent: "最初の観測値を待っています。" }));
  }
  definitions.forEach((definition) => {
    const card = document.createElement("article");
    const latest = sensor.visualObservations[0]?.data?.[definition.key];
    const label = Object.assign(document.createElement("small"), { textContent: definition.label, title: `${definition.label}（${definition.console}）` });
    label.dataset.console = definition.console;
    const reading = document.createElement("strong");
    const formatted = formatPublicMetric(definition, latest);
    if (Number.isFinite(latest) && definition.unit) {
      reading.append(
        Object.assign(document.createElement("span"), { textContent: formatted.slice(0, -definition.unit.length).trim() }),
        document.createTextNode(" "),
        Object.assign(document.createElement("span"), { className: "sensor-reading-unit", textContent: definition.unit }),
      );
    } else reading.textContent = formatted;
    card.append(
      label,
      reading,
      createPublicSparkline(sensor.visualObservations, definition.key),
    );
    grid.append(card);
  });
  section.append(grid);
  return section;
}

function publicSensorTypeLabel(type) {
  return ({ ame: "ATMOSPHERIC / RF", mizu: "HYDROLOGICAL", saku: "SPATIAL SYNC", custom: "ENVIRONMENTAL" })[type] ?? "ENVIRONMENTAL";
}

function createPublicSparkline(observations, key) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.classList.add("sensor-sparkline");
  svg.setAttribute("viewBox", "0 0 100 28");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const values = observations.slice(0, 12).map((observation) => Number(observation.data?.[key])).filter(Number.isFinite).reverse();
  if (values.length < 2) return svg;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, Math.abs(max || 1) * .02, .001);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${24 - ((value - min) / span) * 20}`).join(" ");
  const polyline = document.createElementNS(namespace, "polyline");
  polyline.setAttribute("points", points);
  polyline.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(polyline);
  return svg;
}

function createPublicNodeMeta(sensor) {
  const wrapper = document.createElement("div");
  wrapper.className = "sensor-node-meta";
  const resonanceCount = publicResonancePairs.filter((pair) => pair.from.id === sensor.id || pair.to.id === sensor.id).length;
  const duration = sensor.isDemo ? 259_200 + (hashPublicSensorId(sensor.id) % 86_400) : Number(sensor.observationSpanSeconds) || 0;
  const packetCount = sensor.isDemo ? `${sensor.visualObservations.length} SIM` : Number(sensor.observationCount || 0).toLocaleString("ja-JP");
  [["UPTIME / 観測期間", formatPublicDuration(duration)], ["OBS WINDOW", packetCount], ["RESONANCE", `${resonanceCount} NODES`]].forEach(([label, value]) => {
    const item = document.createElement("span");
    item.append(Object.assign(document.createElement("small"), { textContent: label }), Object.assign(document.createElement("b"), { textContent: value }));
    wrapper.append(item);
  });
  return wrapper;
}

function formatPublicDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value >= 86_400) return `${Math.floor(value / 86_400)}d ${Math.floor((value % 86_400) / 3_600)}h`;
  if (value >= 3_600) return `${Math.floor(value / 3_600)}h ${Math.floor((value % 3_600) / 60)}m`;
  if (value >= 60) return `${Math.floor(value / 60)}m`;
  return value ? `${Math.floor(value)}s` : "WAITING";
}

function createPublicOracle(sensor) {
  const section = document.createElement("section");
  section.className = "sensor-oracle";
  const button = Object.assign(document.createElement("button"), { type: "button", className: "sensor-oracle-trigger" });
  button.append(
    Object.assign(document.createElement("span"), { textContent: "OBSERVE FROM THIS NODE" }),
    Object.assign(document.createElement("strong"), { textContent: "世界を観測する" }),
    Object.assign(document.createElement("b"), { textContent: "→" }),
  );
  const receipt = Object.assign(document.createElement("output"), { className: "sensor-oracle-receipt", hidden: true });
  button.addEventListener("click", () => {
    button.disabled = true;
    receipt.hidden = false;
    receipt.classList.remove("is-received");
    receipt.textContent = "NODE HANDSHAKE... 直近の観測ログを受信中";
    oracleDepthBoost = Math.min(12, oracleDepthBoost + 1.5);
    renderPublicNetworkStats();
    publicSensorMap?.dispatchEvent(new CustomEvent("gaia:sensor-sense", {
      detail: { sensorId: sensor.id, phase: "receiving" },
    }));
    window.setTimeout(() => {
      if (!receipt.isConnected) return;
      receipt.textContent = generatePublicOracle(sensor);
      receipt.classList.add("is-received");
      button.disabled = false;
      publicSensorMap?.dispatchEvent(new CustomEvent("gaia:sensor-sense", {
        detail: { sensorId: sensor.id, phase: "received" },
      }));
    }, 520);
  });
  section.append(button, receipt);
  return section;
}

function generatePublicOracle(sensor) {
  const data = sensor.visualObservations?.[0]?.data ?? {};
  const prefix = sensor.isDemo ? "SIMULATION LOG" : "OBSERVATION LOG";
  if (sensor.visualType === "ame") {
    return `${prefix} / 気圧 ${formatOracleValue(data.pressure, 1, "hPa")}、電波ノイズ ${formatOracleValue(data.radio_noise, 1, "dBm")}。空の縁で、嵐の気配を拾っています。`;
  }
  if (sensor.visualType === "mizu") {
    return `${prefix} / 水温 ${formatOracleValue(data.water_temperature, 1, "°C")}、地下水位 ${formatOracleValue(data.groundwater_level, 2, "m")}。水の層は静かに地表の変化を記録しています。`;
  }
  if (sensor.visualType === "saku") {
    return `${prefix} / 識理層シンクロ率 ${formatOracleValue(data.sync_rate, 1, "%")}、空間ノイズ ${formatOracleValue(data.spatial_noise, 3, "Δ")}。座標は安定、微小なゆらぎだけを検出。`;
  }
  const temperature = formatOracleValue(data.temperature, 1, "°C");
  const humidity = formatOracleValue(data.humidity, 1, "%");
  const pm25 = formatOracleValue(data.pm25, 1, "µg/m³");
  return `${prefix} / 気温 ${temperature}、湿度 ${humidity}、PM2.5 ${pm25}。この場所の現在が、地球の感覚器へ届きました。`;
}

function formatOracleValue(value, digits, unit) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(digits)}${unit}` : `--${unit}`;
}

function buildPublicResonancePairs(sensors) {
  const active = sensors.filter(publicSensorIsActive);
  const candidates = [];
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      const distance = publicSensorDistanceKm(active[left], active[right]);
      if (distance <= resonanceDistanceKm) candidates.push({ from: active[left], to: active[right], distance });
    }
  }
  const selected = new Map();
  active.forEach((sensor) => {
    candidates
      .filter((pair) => pair.from === sensor || pair.to === sensor)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 2)
      .forEach((pair) => {
        const key = [pair.from.id, pair.to.id].sort().join("::");
        selected.set(key, pair);
      });
  });
  return [...selected.values()].sort((left, right) => left.distance - right.distance).slice(0, 80);
}

function publicSensorDistanceKm(left, right) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitude1 = toRadians(left.location.latitude);
  const latitude2 = toRadians(right.location.latitude);
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = toRadians(right.location.longitude - left.location.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function renderPublicResonanceNetwork() {
  if (!publicSensorNetwork) return;
  const namespace = "http://www.w3.org/2000/svg";
  const markerById = new Map([...publicSensorMarkers.querySelectorAll(".sensor-map-marker")].map((marker) => [marker.dataset.sensorId, marker]));
  const paths = [];
  publicResonancePairs.forEach((pair, index) => {
    const from = markerById.get(pair.from.id);
    const to = markerById.get(pair.to.id);
    if (!from || !to || from.hidden || to.hidden) return;
    const x1 = Number.parseFloat(from.style.left);
    const y1 = Number.parseFloat(from.style.top);
    const x2 = Number.parseFloat(to.style.left);
    const y2 = Number.parseFloat(to.style.top);
    if (![x1, y1, x2, y2].every(Number.isFinite)) return;
    const bend = ((hashPublicSensorId(`${pair.from.id}:${pair.to.id}`) % 11) - 5) * .35;
    const midpointX = (x1 + x2) / 2 - (y2 - y1) * .025 + bend;
    const midpointY = (y1 + y2) / 2 + (x2 - x1) * .025 - bend;
    const path = document.createElementNS(namespace, "path");
    path.classList.add("sensor-resonance-link");
    path.toggleAttribute("data-demo", pair.from.isDemo || pair.to.isDemo);
    path.setAttribute("d", `M ${x1} ${y1} Q ${midpointX} ${midpointY} ${x2} ${y2}`);
    path.setAttribute("pathLength", "1");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.style.setProperty("--resonance-delay", `${-(index * .43)}s`);
    path.style.setProperty("--resonance-strength", String(clamp(1 - pair.distance / resonanceDistanceKm, .24, .88)));
    paths.push(path);
  });
  publicSensorNetwork.replaceChildren(...paths);
}

function renderPublicNetworkStats() {
  const activeNodes = publicSensors.filter(publicSensorIsActive).length;
  const packets = Math.max(0, Number(publicNetworkStats.observationPackets) || 0);
  const payloadBytes = Math.max(0, Number(publicNetworkStats.payloadBytes) || 0);
  const resonance = publicResonancePairs.length;
  const sync = publicSensors.length
    ? clamp(16 + activeNodes * 7.2 + resonance * 3.4 + Math.log10(packets + 1) * 8 + oracleDepthBoost * .35, 0, 99.8)
    : 0;
  const depth = publicSensors.length
    ? clamp(8 + Math.log10(packets + 1) * 19 + activeNodes * 3.8 + oracleDepthBoost, 0, 100)
    : 0;
  if (publicSyncRate) publicSyncRate.textContent = `${sync.toFixed(1)}%`;
  if (publicActiveNodes) publicActiveNodes.textContent = `${activeNodes}/${publicSensors.length}`;
  if (publicPacketCount) publicPacketCount.textContent = packets.toLocaleString("ja-JP");
  if (publicDataVolume) publicDataVolume.textContent = formatPublicDataVolume(payloadBytes);
  if (publicDepthFill) publicDepthFill.style.width = `${depth.toFixed(1)}%`;
  if (publicDepthValue) publicDepthValue.textContent = `${depth.toFixed(1)}%`;
}

function formatPublicDataVolume(bytes) {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(3)} GB`;
}

function easeOutQuint(progress) {
  return 1 - (1 - progress) ** 5;
}

function focusPublicSensor(sensor, { minimumZoom = publicMapFocusMinZoom, duration = 460 } = {}) {
  window.clearTimeout(publicMapHoverTimer);
  if (!sensor?.location || !publicSensorMap) return;
  const from = { ...publicMapCamera };
  let targetLongitude = Number(sensor.location.longitude);
  while (targetLongitude - from.longitude > 180) targetLongitude -= 360;
  while (targetLongitude - from.longitude < -180) targetLongitude += 360;
  const target = {
    longitude: targetLongitude,
    latitude: clamp(Number(sensor.location.latitude), -85, 85),
    zoom: Math.max(from.zoom, minimumZoom),
  };
  if (matchMedia("(max-width: 760px)").matches && !publicSensorDetail.hidden && publicSensorDetail.dataset.expanded !== "true") {
    const mapBounds = publicSensorMap.getBoundingClientRect();
    const cardBounds = publicSensorDetail.getBoundingClientRect();
    const headingBounds = views.get("map").querySelector(".sensor-page-head").getBoundingClientRect();
    const lead = views.get("map").querySelector(".sensor-map-lead");
    const leadBounds = lead.getBoundingClientRect();
    const clearTop = Math.max(headingBounds.bottom, leadBounds.height ? leadBounds.bottom : 0) + 26;
    const clearBottom = cardBounds.top - 32;
    const anchorY = clearBottom > clearTop ? (clearTop + clearBottom) / 2 : clearBottom;
    const anchorRatio = clamp((anchorY - mapBounds.top) / Math.max(mapBounds.height, 1), .1, .5);
    // Move the camera, not the data: keep the selected POI above the mobile sheet.
    target.latitude += (anchorRatio - .5) * Math.min(180, 180 / target.zoom);
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animationDuration = clamp(Number(duration) || 460, 160, 1_200);
  const token = ++publicMapFocusToken;
  if (publicMapFocusFrame) cancelAnimationFrame(publicMapFocusFrame);
  publicSensorMap.dataset.cameraEasing = "ease-out-quint";
  if (reducedMotion) {
    Object.assign(publicMapCamera, target);
    updatePublicMapViewport();
    publicSensorMap.dataset.cameraMotion = "idle";
    return;
  }
  publicSensorMap.dataset.cameraMotion = "ease-out";
  const startedAt = performance.now();
  const animate = (now) => {
    if (token !== publicMapFocusToken) return;
    const progress = clamp((now - startedAt) / animationDuration, 0, 1);
    const eased = easeOutQuint(progress);
    publicMapCamera.longitude = from.longitude + (target.longitude - from.longitude) * eased;
    publicMapCamera.latitude = from.latitude + (target.latitude - from.latitude) * eased;
    publicMapCamera.zoom = from.zoom + (target.zoom - from.zoom) * eased;
    updatePublicMapViewport();
    if (progress < 1) publicMapFocusFrame = requestAnimationFrame(animate);
    else {
      publicMapFocusFrame = 0;
      Object.assign(publicMapCamera, target);
      publicSensorMap.dataset.cameraMotion = "idle";
    }
  };
  publicMapFocusFrame = requestAnimationFrame(animate);
}

function initPublicMapNavigation() {
  resetPublicMapView(false);
  publicMapZoomIn?.addEventListener("click", () => zoomPublicMapBy(1.6));
  publicMapZoomOut?.addEventListener("click", () => zoomPublicMapBy(1 / 1.6));
  publicMapReset?.addEventListener("click", () => resetPublicMapView());
  publicSensorMap.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = Math.exp(-clamp(event.deltaY, -240, 240) * (event.ctrlKey ? .008 : .0036));
    if (!publicMapWheel) publicMapWheel = { factor: 1, clientX: event.clientX, clientY: event.clientY };
    publicMapWheel.factor = clamp(publicMapWheel.factor * factor, .2, 5);
    publicMapWheel.clientX = event.clientX;
    publicMapWheel.clientY = event.clientY;
    if (publicMapWheelFrame) return;
    publicMapWheelFrame = requestAnimationFrame(() => {
      publicMapWheelFrame = 0;
      const pending = publicMapWheel;
      publicMapWheel = null;
      if (pending) zoomPublicMapBy(pending.factor, pending.clientX, pending.clientY);
    });
  }, { passive: false });
  publicSensorMap.addEventListener("dblclick", (event) => {
    if (event.target.closest("button, a")) return;
    event.preventDefault();
    zoomPublicMapBy(2, event.clientX, event.clientY);
  });
  publicSensorMap.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, a")) return;
    event.preventDefault();
    cancelPublicMapFocus();
    publicMapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { publicSensorMap.setPointerCapture(event.pointerId); } catch {}
    publicSensorMap.classList.add("is-dragging");
    if (publicMapPointers.size >= 2) {
      finishPublicMapDrag(true);
      startPublicMapPinch();
      return;
    }
    publicMapDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, deltaX: 0, deltaY: 0, moved: false };
  });
  publicSensorMap.addEventListener("pointermove", (event) => {
    if (!publicMapPointers.has(event.pointerId)) return;
    publicMapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (publicMapPointers.size >= 2) {
      queuePublicMapPinch();
      return;
    }
    if (!publicMapDrag || publicMapDrag.pointerId !== event.pointerId) return;
    publicMapDrag.deltaX = event.clientX - publicMapDrag.startX;
    publicMapDrag.deltaY = event.clientY - publicMapDrag.startY;
    if (Math.hypot(publicMapDrag.deltaX, publicMapDrag.deltaY) > 6) publicMapDrag.moved = true;
    queuePublicMapDragPreview();
  });
  const release = (event, commit = true) => {
    if (!publicMapPointers.has(event.pointerId)) return;
    const wasPinching = Boolean(publicMapPinch);
    publicMapPointers.delete(event.pointerId);
    if (wasPinching) {
      stopPublicMapPinch();
      const remaining = [...publicMapPointers.entries()][0];
      if (remaining) {
        const [pointerId, point] = remaining;
        publicMapDrag = { pointerId, startX: point.x, startY: point.y, deltaX: 0, deltaY: 0, moved: true };
        publicSensorMap.classList.add("is-dragging");
      } else publicSensorMap.classList.remove("is-dragging");
      return;
    }
    const placePublicPoi = commit && Boolean(publicLocationEdit) && publicMapDrag?.pointerId === event.pointerId && !publicMapDrag.moved;
    if (publicMapDrag?.pointerId === event.pointerId) finishPublicMapDrag(commit);
    if (!publicMapPointers.size) publicSensorMap.classList.remove("is-dragging");
    if (placePublicPoi) setPublicLocationEditPointFromClient(event.clientX, event.clientY);
  };
  publicSensorMap.addEventListener("pointerup", release);
  publicSensorMap.addEventListener("pointercancel", (event) => release(event, false));
  publicSensorMap.addEventListener("keydown", (event) => {
    if (event.target !== publicSensorMap) return;
    if (publicLocationEdit && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      setPublicLocationEditPoint(publicMapCamera.latitude, publicMapCamera.longitude);
      return;
    }
    if (["+", "="].includes(event.key)) { event.preventDefault(); zoomPublicMapBy(1.6); return; }
    if (event.key === "-") { event.preventDefault(); zoomPublicMapBy(1 / 1.6); return; }
    if (event.key === "Home") { event.preventDefault(); resetPublicMapView(); return; }
    const moves = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
    if (moves[event.key]) { event.preventDefault(); panPublicMap(...moves[event.key]); }
  });
  window.addEventListener("resize", queuePublicMapViewportUpdate, { passive: true });
}

function cancelPublicMapFocus() {
  publicMapFocusToken += 1;
  if (publicMapFocusFrame) cancelAnimationFrame(publicMapFocusFrame);
  publicMapFocusFrame = 0;
  if (publicSensorMap) publicSensorMap.dataset.cameraMotion = "idle";
}

function finishPublicMapDrag(commit = true) {
  if (!publicMapDrag) return;
  const { deltaX, deltaY } = publicMapDrag;
  publicMapDrag = null;
  if (publicMapDragFrame) cancelAnimationFrame(publicMapDragFrame);
  publicMapDragFrame = 0;
  publicSensorMap.style.removeProperty("--sensor-map-drag-x");
  publicSensorMap.style.removeProperty("--sensor-map-drag-y");
  if (commit && (Math.abs(deltaX) > .5 || Math.abs(deltaY) > .5)) panPublicMap(deltaX, deltaY);
}

function startPublicMapPinch() {
  const geometry = publicMapPinchGeometry();
  if (!geometry) return;
  publicMapPinch = geometry;
  publicSensorMap.dataset.gesture = "pinch";
}

function stopPublicMapPinch() {
  if (publicMapPinchFrame) cancelAnimationFrame(publicMapPinchFrame);
  publicMapPinchFrame = 0;
  publicMapPinch = null;
  delete publicSensorMap.dataset.gesture;
}

function publicMapPinchGeometry() {
  const points = [...publicMapPointers.values()].slice(0, 2);
  if (points.length < 2) return null;
  const [first, second] = points;
  return {
    distance: Math.max(Math.hypot(second.x - first.x, second.y - first.y), 1),
    clientX: (first.x + second.x) / 2,
    clientY: (first.y + second.y) / 2,
  };
}

function queuePublicMapPinch() {
  if (!publicMapPinch || publicMapPinchFrame) return;
  publicMapPinchFrame = requestAnimationFrame(() => {
    publicMapPinchFrame = 0;
    const current = publicMapPinchGeometry();
    if (!current || !publicMapPinch) return;
    const previous = publicMapPinch;
    publicMapPinch = current;
    panPublicMap(current.clientX - previous.clientX, current.clientY - previous.clientY, false);
    zoomPublicMapBy(clamp(current.distance / previous.distance, .5, 2), current.clientX, current.clientY, false);
    updatePublicMapViewport();
  });
}

function queuePublicMapDragPreview() {
  if (publicMapDragFrame) return;
  publicMapDragFrame = requestAnimationFrame(() => {
    publicMapDragFrame = 0;
    if (!publicMapDrag) return;
    const rect = publicSensorMap.getBoundingClientRect();
    const needsRebase = Math.abs(publicMapDrag.deltaX) > rect.width * publicMapDragRebaseRatio
      || Math.abs(publicMapDrag.deltaY) > rect.height * publicMapDragRebaseRatio;
    if (needsRebase) {
      const { deltaX, deltaY } = publicMapDrag;
      publicMapDrag.startX += deltaX;
      publicMapDrag.startY += deltaY;
      publicMapDrag.deltaX = 0;
      publicMapDrag.deltaY = 0;
      publicSensorMap.style.removeProperty("--sensor-map-drag-x");
      publicSensorMap.style.removeProperty("--sensor-map-drag-y");
      panPublicMap(deltaX, deltaY);
      return;
    }
    publicSensorMap.style.setProperty("--sensor-map-drag-x", `${publicMapDrag.deltaX}px`);
    publicSensorMap.style.setProperty("--sensor-map-drag-y", `${publicMapDrag.deltaY}px`);
  });
}

function resetPublicMapView(render = true) {
  Object.assign(publicMapCamera, publicMapHome);
  if (render) updatePublicMapViewport();
}

function publicMapView() {
  const rect = publicSensorMap.getBoundingClientRect();
  const width = Math.max(rect.width, window.innerWidth, 1);
  const height = Math.max(rect.height, window.innerHeight, 1);
  const verticalSpan = Math.min(180, 180 / publicMapCamera.zoom);
  const horizontalSpan = Math.min(360, verticalSpan * (width / height) / publicMapLongitudeScale);
  publicMapCamera.latitude = clamp(publicMapCamera.latitude, -90 + verticalSpan / 2, 90 - verticalSpan / 2);
  publicMapCamera.longitude = normalizeLongitude(publicMapCamera.longitude);
  return {
    west: publicMapCamera.longitude - horizontalSpan / 2,
    east: publicMapCamera.longitude + horizontalSpan / 2,
    south: publicMapCamera.latitude - verticalSpan / 2,
    north: publicMapCamera.latitude + verticalSpan / 2,
    key: "PUBLIC",
  };
}

function updatePublicMapViewport() {
  const view = publicMapView();
  mapViewports.set(publicSensorMap, view);
  publicSensorMap.dataset.mapView = "PUBLIC";
  mapRenderers.get(publicSensorMap)?.();
  positionPublicSensorMarkers();
  if (publicMapZoomOutput) publicMapZoomOutput.value = `${publicMapCamera.zoom.toFixed(1)}×`;
  const basis = publicSensorMap.querySelector("[data-map-basis]");
  if (basis) basis.textContent = `JAPAN CENTER / ZOOM ${publicMapCamera.zoom.toFixed(1)}× / NE 1:50m / 境界: 地球地図日本`;
}

function queuePublicMapViewportUpdate() {
  if (publicMapViewportFrame) return;
  publicMapViewportFrame = requestAnimationFrame(() => {
    publicMapViewportFrame = requestAnimationFrame(() => {
      publicMapViewportFrame = 0;
      updatePublicMapViewport();
    });
  });
}

function positionPublicSensorMarkers() {
  const view = mapViewFor(publicSensorMap);
  const bounds = publicSensorMarkers.getBoundingClientRect();
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const entries = [];
  publicSensorMarkers.querySelectorAll(".sensor-map-marker").forEach((marker) => {
    const editing = publicLocationEdit?.sensorId === marker.dataset.sensorId;
    const longitude = editing ? publicLocationEdit.longitude : Number(marker.dataset.longitude);
    const latitude = editing ? publicLocationEdit.latitude : Number(marker.dataset.latitude);
    const left = longitudeToPercent(longitudeNearestToView(longitude, view), view);
    const top = latitudeToPercent(latitude, view);
    marker.style.left = `${left}%`;
    marker.style.top = `${top}%`;
    delete marker.dataset.clusterGroup;
    delete marker.dataset.clusterMember;
    delete marker.dataset.clusterMembers;
    delete marker.dataset.clusterSize;
    marker.dataset.locationEditing = String(editing);
    const clusterCount = marker.querySelector(".sensor-map-marker-cluster-count");
    if (clusterCount) {
      clusterCount.hidden = true;
      clusterCount.textContent = "";
    }
    const state = marker.querySelector(".sensor-map-marker-state");
    if (state) state.textContent = editing ? "MOVE POI" : marker.dataset.baseStateLabel || "";
    if (markerLabelValues.has(marker)) bindSensorLabel(marker, '{owner}さんの{sensor}、{state}', markerLabelValues.get(marker), 'aria-label');
    marker.removeAttribute("aria-description");
    marker.hidden = (!editing && marker.dataset.filtered === "true") || left < -3 || left > 103 || top < -3 || top > 103;
    if (!marker.hidden) entries.push({ marker, baseX: left / 100 * width, baseY: top / 100 * height, editing });
  });
  const remaining = new Set(entries.filter((entry) => !entry.editing));
  while (remaining.size) {
    const seed = remaining.values().next().value;
    remaining.delete(seed);
    const group = [seed];
    for (let cursor = 0; cursor < group.length; cursor += 1) {
      const current = group[cursor];
      for (const candidate of [...remaining]) {
        if (Math.hypot(candidate.baseX - current.baseX, candidate.baseY - current.baseY) > publicMapMarkerCollisionDistance) continue;
        remaining.delete(candidate);
        group.push(candidate);
      }
    }
    if (group.length < 2) continue;
    group.sort((left, right) => String(left.marker.dataset.sensorId).localeCompare(String(right.marker.dataset.sensorId)));
    const groupId = group.map((entry) => entry.marker.dataset.sensorId).join(":");
    const representative = group.find((entry) => entry.marker.dataset.sensorId === selectedPublicSensorId) || group[0];
    const clusterLabel = formatPublicSensorClusterCount(group.length);
    const memberIds = group.map((entry) => entry.marker.dataset.sensorId);
    group.forEach((entry) => {
      entry.marker.dataset.clusterGroup = groupId;
      if (entry !== representative) {
        entry.marker.dataset.clusterMember = representative.marker.dataset.sensorId;
        entry.marker.hidden = true;
      }
    });
    representative.marker.dataset.clusterSize = String(group.length);
    representative.marker.dataset.clusterMembers = memberIds.join(",");
    representative.marker.setAttribute("aria-label", `${group.length}件の観測点。選択するとこの位置を拡大します。`);
    representative.marker.setAttribute("aria-description", "この縮尺で重なる観測点を、実座標から動かさずひとつにまとめています。");
    const clusterCount = representative.marker.querySelector(".sensor-map-marker-cluster-count");
    if (clusterCount) {
      clusterCount.hidden = false;
      clusterCount.textContent = clusterLabel;
    }
    const state = representative.marker.querySelector(".sensor-map-marker-state");
    if (state) state.textContent = `${group.length} NODES`;
  }
  renderPublicResonanceNetwork();
  renderPublicSelectionLink();
  publicSensorMap?.dispatchEvent(new CustomEvent("gaia:sensor-field", {
    detail: {
      nodes: entries.map((entry) => {
        const sensor = publicSensors.find((candidate) => candidate.id === entry.marker.dataset.sensorId);
        return {
          id: entry.marker.dataset.sensorId,
          name: sensor?.sensorName || "観測点",
          x: clamp((entry.baseX + (entry.offsetX || 0)) / width, 0, 1),
          y: clamp((entry.baseY + (entry.offsetY || 0)) / height, 0, 1),
          activity: Number.parseFloat(entry.marker.style.getPropertyValue("--sensor-activity")) || .35,
          selected: entry.marker.hasAttribute("aria-current"),
        };
      }),
    },
  }));
}

function renderPublicSelectionLink() {
  const link = document.querySelector(".sensor-selection-link");
  if (!link) return;
  const marker = publicSensorMarkers?.querySelector('.sensor-map-marker[aria-current]:not([hidden])');
  const show = marker && !publicSensorDetail?.hidden && selectedPublicSensorId && !publicLocationEdit
    && publicSensorDirectory?.dataset.open !== "true" && !matchMedia("(max-width: 760px)").matches;
  link.dataset.visible = String(Boolean(show));
  if (!show) return;
  const map = link.getBoundingClientRect();
  const point = marker.getBoundingClientRect();
  const card = publicSensorDetail.getBoundingClientRect();
  const startX = point.x + point.width / 2 - map.x;
  const startY = point.y + point.height / 2 - map.y;
  // A leader identifies the selected node. It never repositions a public POI.
  const endX = card.left - map.x;
  const endY = Math.max(card.top + 40, Math.min(card.bottom - 40, point.y)) - map.y;
  if (startX >= endX - 28) { link.dataset.visible = "false"; return; }
  link.querySelector("path").setAttribute("d", `M ${startX + 24} ${startY} L ${endX} ${endY}`);
}

function formatPublicSensorClusterCount(count) {
  const circled = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
  return circled[count] || String(count);
}

function activatePublicSensorCluster(marker) {
  const clusterSize = Number(marker?.dataset.clusterSize) || 0;
  if (clusterSize < 2) return false;
  if (publicMapCamera.zoom >= publicMapMaxZoom - .05) {
    setPublicSensorDirectoryOpen(true, { focus: true });
    return true;
  }
  const bounds = marker.getBoundingClientRect();
  zoomPublicMapBy(1.8, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  return true;
}

function zoomPublicMapBy(factor, clientX, clientY, render = true) {
  const rect = publicSensorMap.getBoundingClientRect();
  const before = publicMapView();
  const xRatio = Number.isFinite(clientX) ? clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1) : .5;
  const yRatio = Number.isFinite(clientY) ? clamp((clientY - rect.top) / Math.max(rect.height, 1), 0, 1) : .5;
  const anchorLongitude = before.west + xRatio * (before.east - before.west);
  const anchorLatitude = before.north - yRatio * (before.north - before.south);
  publicMapCamera.zoom = clamp(publicMapCamera.zoom * factor, publicMapMinZoom, publicMapMaxZoom);
  const after = publicMapView();
  publicMapCamera.longitude += anchorLongitude - (after.west + xRatio * (after.east - after.west));
  publicMapCamera.latitude += anchorLatitude - (after.north - yRatio * (after.north - after.south));
  if (render) updatePublicMapViewport();
}

function panPublicMap(deltaX, deltaY, render = true) {
  const rect = publicSensorMap.getBoundingClientRect();
  const view = publicMapView();
  publicMapCamera.longitude -= (deltaX / Math.max(rect.width, 1)) * (view.east - view.west);
  publicMapCamera.latitude += (deltaY / Math.max(rect.height, 1)) * (view.north - view.south);
  if (render) updatePublicMapViewport();
}

const avatarInitial = (owner) => Array.from(owner?.displayName || "?")[0] || "?";

const showAvatarFallback = (wrapper, owner) => {
  wrapper.replaceChildren();
  wrapper.textContent = avatarInitial(owner);
  wrapper.dataset.avatarState = "fallback";
};

const mountAvatar = (wrapper, owner, { loading = "eager" } = {}) => {
  wrapper.replaceChildren();
  if (!owner?.avatarUrl) {
    showAvatarFallback(wrapper, owner);
    return;
  }
  const image = Object.assign(document.createElement("img"), {
    src: owner.avatarUrl,
    alt: "",
    loading,
    decoding: "async",
  });
  let retried = false;
  wrapper.dataset.avatarState = "loading";
  image.addEventListener("load", () => {
    if (image.isConnected) wrapper.dataset.avatarState = "ready";
  });
  image.addEventListener("error", () => {
    if (!retried) {
      retried = true;
      wrapper.dataset.avatarState = "retrying";
      const retryUrl = new URL(owner.avatarUrl, document.baseURI);
      retryUrl.searchParams.set("gaiaAvatarRetry", Date.now().toString(36));
      image.src = retryUrl.href;
      return;
    }
    showAvatarFallback(wrapper, owner);
  });
  wrapper.append(image);
};

const avatarElement = (owner, tagName = "span") => {
  const wrapper = document.createElement(tagName);
  wrapper.className = "sensor-owner-avatar";
  mountAvatar(wrapper, owner);
  return wrapper;
};

const loadProfile = async () => {
  const response = await api("../api/web/v1/profile");
  currentProfile = response.profile;
  profileForm.elements.displayName.value = currentProfile.displayName;
  profileForm.elements.xUrl.value = currentProfile.xUrl || "";
  profileForm.elements.githubUrl.value = currentProfile.githubUrl || "";
  profileForm.elements.instagramUrl.value = currentProfile.instagramUrl || "";
  renderProfileAvatar();
};

const renderProfileAvatar = () => {
  mountAvatar(profileAvatarPreview, currentProfile);
  document.querySelector("#profile-avatar-delete").disabled = !currentProfile?.avatarUrl;
};

const openDetail = async (deviceId) => {
  try {
    showView("loading");
    const [latest, historyResponse] = await Promise.all([
      api(`../api/web/v1/devices/${encodeURIComponent(deviceId)}/latest`),
      api(`../api/web/v1/devices/${encodeURIComponent(deviceId)}/telemetry?limit=48`),
    ]);
    selectedDevice = latest.device;
    renderDetail(latest, historyResponse.telemetry);
    showView("detail");
    history.replaceState(null, "", `#device=${encodeURIComponent(deviceId)}`);
    startDetailPolling();
  } catch (error) {
    showStatus(error.message, "error");
    await showDevices();
  }
};

const refreshDetail = async ({ quiet = false, includeHistory = true } = {}) => {
  if (!selectedDevice) return;
  if (detailRefreshPromise) {
    await detailRefreshPromise;
    if (!includeHistory || !selectedDevice || document.documentElement.dataset.sensorView !== "detail") return;
  }
  const deviceId = selectedDevice.deviceId;
  const task = (async () => {
    try {
      const [latest, historyResponse] = await Promise.all([
        api(`../api/web/v1/devices/${encodeURIComponent(deviceId)}/latest`),
        includeHistory
          ? api(`../api/web/v1/devices/${encodeURIComponent(deviceId)}/telemetry?limit=48`)
          : Promise.resolve(null),
      ]);
      if (selectedDevice?.deviceId !== deviceId || document.documentElement.dataset.sensorView !== "detail") return;
      selectedDevice = latest.device;
      if (historyResponse) renderDetail(latest, historyResponse.telemetry);
      else renderLatestDetail(latest);
      if (!quiet) showStatus("最新の測定値へ更新しました。");
    } catch (error) {
      if (!quiet) showStatus(error.message, "error");
    }
  })();
  detailRefreshPromise = task;
  try {
    await task;
  } finally {
    if (detailRefreshPromise === task) detailRefreshPromise = null;
  }
};

const renderDetail = ({ device, latest }, telemetry) => {
  selectedDeviceTelemetry = Array.isArray(telemetry) ? telemetry : [];
  renderLatestDetail({ device, latest });
  renderHistory(telemetry);
  if (!locationForm.contains(document.activeElement)) {
    locationForm.elements.name.value = device.name;
    locationForm.elements.countryCode.value = device.countryCode;
    locationForm.elements.admin1Code.value = device.admin1Code || "";
    locationForm.elements.localityName.value = device.localityName || "";
    locationForm.elements.isPublic.value = "true";
    setMeasurementSelection(locationForm, device.measurementKeys);
    locationForm.dataset.savedRegion = regionSelectionKey(
      device.countryCode,
      device.subdivisionCode,
      device.municipalityCode,
    );
    syncPickerViewport(locationForm, device.countryCode);
    setPickerLocation(locationForm, device.publicLatitude, device.publicLongitude, {
      basis: "stored",
    });
    locationForm.querySelector("[data-location-picker]").dataset.regionPlot = "stored";
    syncPickerEnabled(locationForm);
    void populateRegionFields(locationForm, {
      subdivisionCode: device.subdivisionCode || "",
      municipalityCode: device.municipalityCode || "",
    });
  }
};

const renderLatestDetail = ({ device, latest }) => {
  document.querySelector("#detail-id").textContent = device.deviceId;
  document.querySelector("#detail-name").textContent = device.name;
  document.querySelector("#detail-name").translate = false;
  const state = document.querySelector("#detail-state");
  state.textContent = device.state;
  state.dataset.state = device.state;
  document.querySelector("#detail-location").textContent = locationLabel(device);
  document.querySelector("#detail-updated").textContent = latest ? formatRelative(latest.receivedAt) : "まだデータがありません";
  latestMetrics.replaceChildren();
  if (!latest) latestMetrics.append(Object.assign(document.createElement("p"), { textContent: "最初のデータを待っています。" }));
  else Object.entries(latest.data).slice(0, 6).forEach(([key, value]) => latestMetrics.append(metric(key, value)));
};

function openSensorAnalysis(context) {
  if (!analysisDialog || !analysisStats || !analysisSummary) return;
  const observations = (Array.isArray(context.observations) ? context.observations : [])
    .slice(0, 120)
    .map((observation) => ({
      data: sanitizePublicMeasurements(observation?.data),
      observedAt: validIsoTimestamp(observation?.observedAt),
      receivedAt: validIsoTimestamp(observation?.receivedAt),
    }))
    .filter((observation) => Object.keys(observation.data).length);
  analysisContext = { ...context, observations };
  const report = analyzeSensorObservations(observations);
  bindSensorLabel(analysisTarget, "{name} · {region} · {count}件", {
    name: context.name,
    get region() { return window.GaiaI18n?.t(context.region || "地域情報なし") || context.region || "地域情報なし"; },
    count: observations.length,
  });
  analysisBadge.textContent = context.isDemo ? "DEMO DATA" : "LOCAL ANALYSIS";
  analysisBadge.dataset.demo = String(context.isDemo === true);
  renderSensorAnalysisReport(report);
  aiAnswer.textContent = "質問すると、ここに回答が表示されます。";
  aiAnswer.dataset.state = "idle";
  if (analysisDialog.open) analysisDialog.close();
  analysisDialog.showModal();
}

function validIsoTimestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function analyzeSensorObservations(observations) {
  const chronological = observations.slice().reverse();
  const metricKeys = [...new Set(chronological.flatMap((observation) => Object.keys(observation.data)))];
  const metrics = metricKeys.map((key) => {
    const values = chronological.map((observation) => Number(observation.data[key])).filter(Number.isFinite);
    if (!values.length) return null;
    const latest = values.at(-1);
    const oldest = values[0];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const delta = latest - oldest;
    const tolerance = Math.max((maximum - minimum) * .08, Math.abs(average) * .005, .001);
    const trend = Math.abs(delta) <= tolerance ? "stable" : delta > 0 ? "rising" : "falling";
    return { key, count: values.length, latest, oldest, minimum, maximum, average, delta, trend };
  }).filter(Boolean);
  const times = observations.flatMap((observation) => [observation.observedAt, observation.receivedAt]).filter(Boolean).map(Date.parse).filter(Number.isFinite);
  return {
    sampleCount: observations.length,
    metricCount: metrics.length,
    metrics,
    firstAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
    lastAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
  };
}

function renderSensorAnalysisReport(report) {
  analysisStats.replaceChildren();
  if (!report.metrics.length) {
    analysisStats.append(Object.assign(document.createElement("p"), { textContent: "数値データがまだありません。" }));
    analysisSummary.textContent = "観測値が届くと、平均・範囲・変化方向を自動集計します。";
    return;
  }
  report.metrics.slice(0, 8).forEach((item) => {
    const metadata = fallbackMetricMetadata[item.key] ?? { label: item.key, unit: "", digits: 2 };
    const article = document.createElement("article");
    article.dataset.trend = item.trend;
    article.append(
      Object.assign(document.createElement("small"), { textContent: metadata.label }),
      Object.assign(document.createElement("strong"), { textContent: analysisValue(item.latest, metadata) }),
      Object.assign(document.createElement("span"), { textContent: `平均 ${analysisValue(item.average, metadata)} · 範囲 ${analysisValue(item.minimum, metadata)}–${analysisValue(item.maximum, metadata)}` }),
      Object.assign(document.createElement("b"), { textContent: analysisTrendLabel(item.trend, item.delta, metadata) }),
    );
    analysisStats.append(article);
  });
  const notable = report.metrics
    .filter((item) => item.trend !== "stable")
    .sort((left, right) => Math.abs(right.delta / (Math.abs(right.average) || 1)) - Math.abs(left.delta / (Math.abs(left.average) || 1)))
    .slice(0, 2);
  const period = report.firstAt && report.lastAt ? `（${formatAnalysisPeriod(report.firstAt, report.lastAt)}）` : "";
  bindSensorLabel(analysisSummary, "{count}件{period}から{metrics}項目を集計。{summary}", {
    count: report.sampleCount, metrics: report.metricCount,
    get period() { return window.GaiaI18n?.get() === "en" ? period.replace("（", " (").replace("）", ")") : period; },
    get summary() {
      const language = window.GaiaI18n?.get() || "ja";
      if (!notable.length) return window.GaiaI18n?.t("大きな方向変化は見られません。") || "大きな方向変化は見られません。";
      const descriptions = notable.map(item => {
        const source = fallbackMetricMetadata[item.key]?.label ?? item.key;
        const label = window.GaiaI18n?.t(source) || source;
        if (language === "en") return `${label} is ${item.trend === "rising" ? "rising" : "falling"}`;
        if (language === "zh-CN") return `${label}${item.trend === "rising" ? "上升" : "下降"}`;
        return `${label}は${item.trend === "rising" ? "上昇" : "低下"}`;
      });
      return language === "en" ? `${descriptions.join("; ")}.` : language === "zh-CN" ? `${descriptions.join("，")}。` : `${descriptions.join("、")}しています。`;
    },
  });
}

function analysisValue(value, metadata) {
  const digits = Number.isInteger(metadata.digits) ? metadata.digits : 2;
  return `${Number(value).toLocaleString("ja-JP", { maximumFractionDigits: digits, minimumFractionDigits: digits })}${metadata.unit ? ` ${metadata.unit}` : ""}`;
}

function analysisTrendLabel(trend, delta, metadata) {
  const arrow = trend === "rising" ? "↗" : trend === "falling" ? "↘" : "→";
  const label = trend === "rising" ? "上昇" : trend === "falling" ? "低下" : "横ばい";
  return `${arrow} ${label} ${trend === "stable" ? "" : analysisValue(Math.abs(delta), metadata)}`.trim();
}

function formatAnalysisPeriod(firstAt, lastAt) {
  const seconds = Math.max(0, (Date.parse(lastAt) - Date.parse(firstAt)) / 1000);
  return formatPublicDuration(seconds);
}

function restoreAiConfiguration() {
  if (!aiForm || !aiProvider || !aiEndpoint || !aiModel || !aiKey) return;
  const saved = readAiConfiguration();
  const provider = saved.provider;
  aiProvider.value = provider;
  const preset = aiProviderPresets[provider];
  aiEndpoint.value = typeof saved?.endpoint === "string" ? saved.endpoint : preset.endpoint;
  aiModel.value = typeof saved?.model === "string" ? saved.model : preset.model;
  if (provider === "custom") {
    customAiEndpoint = aiEndpoint.value;
    customAiModel = aiModel.value;
  }
  aiKey.value = saved.apiKey;
  aiForm.elements.rememberKey.checked = saved.rememberKey;
}

function parseStoredJson(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storageRead(storage, key) {
  try { return storage.getItem(key) || ""; } catch { return ""; }
}

function storageRemove(storage, key) {
  try { storage.removeItem(key); } catch { /* Storage may be disabled by browser policy. */ }
}

function selectAiProvider(provider) {
  const preset = aiProviderPresets[provider] ?? aiProviderPresets.custom;
  if (provider === "custom") {
    aiEndpoint.value = customAiEndpoint;
    aiModel.value = customAiModel;
  } else {
    aiEndpoint.value = preset.endpoint;
    aiModel.value = preset.model;
  }
}


let sensorAiController = null;
let sensorAiRequestId = 0;
function abortSensorAi() {
  sensorAiRequestId += 1;
  sensorAiController?.abort(); sensorAiController = null;
  if (aiForm) aiForm.querySelector("button[type='submit']").disabled = false;
}
async function askSensorAi(event) {
  event.preventDefault();
  if (sensorAiController) return;
  if (!analysisContext) {
    showStatus("先に分析するセンサーを選んでください。", "error");
    return;
  }
  const formData = new FormData(aiForm);
  const provider = String(formData.get("provider") || "custom");
  const preset = aiProviderPresets[provider] ?? aiProviderPresets.custom;
  const endpoint = String(formData.get("endpoint") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const apiKey = String(formData.get("apiKey") || "").trim();
  const question = String(formData.get("question") || "").trim();
  const rememberKey = formData.get("rememberKey") === "on";
  const submit = aiForm.querySelector("button[type='submit']");
  const id = ++sensorAiRequestId;
  try {
    if (!apiKey) throw new Error("APIキーを入力してください。");
    if (!model) throw new Error("モデル名を入力してください。");
    if (!question) throw new Error("質問を入力してください。");
    const requestUrl = validatedAiEndpoint(endpoint, model, preset.adapter);
    await confirmAiDestination(requestUrl, apiKey);
    if (id !== sensorAiRequestId || !analysisDialog.open) return;
    saveAiConfiguration({ provider, endpoint, model, apiKey, rememberKey });
    if (provider === "custom") {
      customAiEndpoint = endpoint;
      customAiModel = model;
    }
    submit.disabled = true;
    sensorAiController = new AbortController();
    aiAnswer.dataset.state = "loading";
    aiAnswer.textContent = `${preset.label}へ質問を送信しています…`;
    const answer = await fetchAiAnswer({ requestUrl, preset, model, apiKey, question, signal: sensorAiController.signal });
    if (id !== sensorAiRequestId || !analysisDialog.open) return;
    aiAnswer.dataset.state = "complete";
    aiAnswer.textContent = answer;
  } catch (error) {
    if (id !== sensorAiRequestId || !analysisDialog.open) return;
    aiAnswer.dataset.state = "error";
    aiAnswer.textContent = error instanceof Error ? error.message : "AIへの質問に失敗しました。";
  } finally {
    if (id === sensorAiRequestId) { sensorAiController = null; submit.disabled = false; }
  }
}


function fetchAiAnswer({ requestUrl, preset, model, apiKey, question, signal }) {
  return requestAiAnswer({ requestUrl, preset, model, apiKey, signal, prompt: buildSensorAiPrompt(question) });
}

function buildSensorAiPrompt(question) {
  const report = analyzeSensorObservations(analysisContext.observations);
  const dataset = {
    sensor: {
      name: analysisContext.name,
      region: analysisContext.region || null,
      isDemo: analysisContext.isDemo === true,
      source: analysisContext.source,
    },
    summary: {
      sampleCount: report.sampleCount,
      firstAt: report.firstAt,
      lastAt: report.lastAt,
      metrics: report.metrics,
    },
    samplesNewestFirst: analysisContext.observations.slice(0, 48),
  };
  const responseLanguage = ({ en: "英語", "zh-CN": "簡体字中国語" })[window.GaiaI18n?.get()] || "日本語";
  const system = `あなたは環境センサーの分析支援者です。提示データだけを根拠に${responseLanguage}で答え、実測・模擬の区別、欠測、短い観測期間、不確実性を明示してください。医療・防災・安全判断を断定せず、追加確認を具体的に提案してください。`;
  const user = `質問：${question}\n\nセンサーデータ(JSON)：\n${JSON.stringify(dataset)}`;
  return { system, user };
}


const renderHistory = (telemetry) => {
  historyList.replaceChildren();
  telemetry.slice(0, 12).forEach((entry) => {
    const item = document.createElement("li");
    const values = Object.entries(entry.data).slice(0, 3).map(([key, value]) => `${labelFor(key)} ${formatValue(value)}`).join(" / ");
    item.append(Object.assign(document.createElement("time"), { textContent: new Date(entry.receivedAt).toLocaleTimeString("ja-JP") }));
    item.append(Object.assign(document.createElement("span"), { textContent: values }));
    historyList.append(item);
  });
  const chartKey = preferredHistoryKey(telemetry);
  const definition = chartKey ? metricDefinition(chartKey) : null;
  const chartValues = chartKey ? telemetry.slice().reverse().map((entry) => Number(entry.data[chartKey])).filter(Number.isFinite) : [];
  historyChart.replaceChildren();
  if (!chartValues.length) {
    historyChart.textContent = "観測値の履歴が届くとグラフを表示します。";
    historyChart.setAttribute("aria-label", "観測値の履歴グラフ");
    return;
  }
  historyChart.setAttribute("aria-label", `${definition.label}の履歴グラフ`);
  const minimum = Math.min(...chartValues);
  const maximum = Math.max(...chartValues);
  chartValues.forEach((value) => {
    const bar = document.createElement("i");
    const normalized = maximum === minimum ? 55 : 15 + ((value - minimum) / (maximum - minimum)) * 80;
    bar.style.setProperty("--height", `${normalized}%`);
    bar.title = `${value} ${definition.unit}`.trim();
    historyChart.append(bar);
  });
};

function preferredHistoryKey(telemetry) {
  const present = new Set(telemetry.flatMap((entry) => Object.keys(entry.data || {})));
  return ["temperature", "water_temperature", "ph", "turbidity", "dissolved_oxygen", "soil_moisture", "rainfall_rate", ...present]
    .find((key) => present.has(key)) || null;
}

const metric = (key, value) => {
  const article = document.createElement("article");
  article.className = "sensor-metric";
  const label = document.createElement("span");
  const strong = document.createElement("strong");
  const unit = document.createElement("small");
  label.textContent = labelFor(key);
  strong.textContent = formatValue(value);
  unit.textContent = unitFor(key);
  strong.append(unit);
  article.append(label, strong);
  return article;
};

const showDevices = async () => {
  showView("devices");
  history.replaceState(null, "", "#devices");
  try { await loadDevices(); }
  catch (error) { showStatus(error.message, "error"); }
};

const routeFromHash = () => {
  if (location.hash.startsWith("#map")) showView("map");
  else if (location.hash === "#guide") showView("guide");
  else if (guideAnchor()) showView("guide");
  else if (location.hash === "#terms") showView("terms");
  else if (!authenticated) showView("login");
  else if (location.hash === "#profile" && sessionUser?.accountKind !== "trial") showView("profile");
  else if (location.hash === "#add") {
    if (pendingPairing) { showView("devices"); history.replaceState(null, "", "#devices"); }
    else showView("add");
  }
  else if (location.hash.startsWith("#device=")) openDetail(decodeURIComponent(location.hash.slice(8)));
  else showView("devices");
};

document.querySelector("#sensor-guide-copy")?.addEventListener("click", async () => {
  const text = document.querySelector("#sensor-guide-request-text");
  const status = document.querySelector("#sensor-guide-copy-status");
  if (!text || !status) return;
  try {
    await navigator.clipboard.writeText(text.textContent.trim());
    status.textContent = "コピーしました。PCのCodexへ貼り付けてください。";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(text);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    status.textContent = "自動コピーが使えません。選択された依頼文を手動でコピーしてください。";
  }
});

loginButton.addEventListener("click", () => { location.assign("../api/auth/google/start?returnTo=%2Fsensors%2F"); });
participationInfoOpen?.addEventListener("click", () => participationDialog?.showModal());
participationDialog?.addEventListener("click", (event) => {
  if (event.target === participationDialog) participationDialog.close();
});
publicOwnerProfileDialog?.addEventListener("click", (event) => {
  const dismissButton = event.target instanceof Element ? event.target.closest("button[value='close']") : null;
  if (dismissButton && publicOwnerProfileDialog.contains(dismissButton)) {
    event.preventDefault();
    dismissPublicOwnerProfile();
  } else if (event.target === publicOwnerProfileDialog) {
    dismissPublicOwnerProfile();
  }
});
publicOwnerProfileDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  dismissPublicOwnerProfile();
});
analysisClose?.addEventListener("click", () => analysisDialog?.close());
analysisDialog?.addEventListener("close", abortSensorAi);
analysisDialog?.addEventListener("cancel", abortSensorAi);
analysisDialog?.addEventListener("click", (event) => {
  if (event.target === analysisDialog) analysisDialog.close();
});
aiProvider?.addEventListener("change", () => selectAiProvider(aiProvider.value));
aiEndpoint?.addEventListener("input", () => {
  if (aiProvider.value === "custom") customAiEndpoint = aiEndpoint.value;
});
aiModel?.addEventListener("input", () => {
  if (aiProvider.value === "custom") customAiModel = aiModel.value;
});
aiForm?.addEventListener("submit", askSensorAi);
aiClearKey?.addEventListener("click", () => {
  clearAiKey();
  aiKey.value = "";
  aiForm.elements.rememberKey.checked = false;
  aiAnswer.dataset.state = "idle";
  aiAnswer.textContent = "この端末に保存されたAPIキーを削除しました。";
});
document.querySelector("#sensor-ai-end")?.addEventListener("click", endAiSession);
globalThis.addEventListener("gaia-ai-cleared", event => {
  abortSensorAi(); aiKey.value = ""; aiForm.elements.rememberKey.checked = false;
  aiAnswer.dataset.state = "idle"; aiAnswer.textContent = "APIキーと、この画面の回答を消去しました。";
  if (event.detail?.ended) {
    aiForm.elements.question.value = ""; customAiEndpoint = ""; customAiModel = "";
    restoreAiConfiguration(); analysisContext = null; analysisDialog.close();
  }
});
upgradeGoogleButton.addEventListener("click", () => {
  upgradeGoogleButton.disabled = true;
  location.assign("../api/auth/google/start?returnTo=%2Fsensors%2F");
});
trialLoginButton.addEventListener("click", async () => {
  trialLoginButton.disabled = true;
  loginButton.disabled = true;
  try {
    const session = await api("../api/auth/trial", { method: "POST" });
    authenticated = true;
    sessionUser = session.user;
    syncAccountUi();
    await Promise.all([loadCountries(), loadDevices(), loadSocial()]);
    history.replaceState(null, "", "#devices");
    showView("devices");
    showStatus("匿名のおためし利用を開始しました。");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    trialLoginButton.disabled = false;
    loginButton.disabled = false;
  }
});
logoutButton.addEventListener("click", async () => {
  const isTrial = sessionUser?.accountKind === "trial";
  const message = "おためし利用をログアウトすると、登録したセンサーと観測データをすべて削除します。ログアウトしますか？";
  if (isTrial && !confirm(window.GaiaI18n?.t(message) || message)) return;
  logoutButton.disabled = true;
  try {
    await api("../api/web/v1/logout", { method: "POST" });
    clearAccountState();
    showStatus(isTrial ? "おためしデータを削除してログアウトしました。" : "ログアウトしました。");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    logoutButton.disabled = false;
  }
});
function clearAccountState() {
  clearPendingPairing();
  abortSensorAi(); analysisContext = null; analysisDialog?.close();
  authenticated = false; sessionUser = null; devices = []; selectedDevice = null;
  selectedDeviceTelemetry = []; currentProfile = null; socialBySensor = new Map();
  syncAccountUi(); history.replaceState(null, "", "#login"); showView("login");
}
const syncAccountDeleteConfirmation = () => {
  const input = document.querySelector('#sensor-account-delete-form input[name="confirmation"]');
  if (!input) return;
  const token = ({ en: 'DELETE', 'zh-CN': '删除' })[window.GaiaI18n?.get()] || '削除';
  input.pattern = token;
  input.maxLength = token.length;
};
syncAccountDeleteConfirmation();
window.addEventListener('gaia:language-change', syncAccountDeleteConfirmation);
document.querySelector("#sensor-account-delete-form")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!authenticated || !form.reportValidity()) return;
  const message = "このGAIAアカウント、登録センサー、観測値、プロフィールを削除します。取り消せません。削除しますか？";
  if (!confirm(window.GaiaI18n?.t(message) || message)) return;
  const button = form.querySelector("button[type=submit]"); button.disabled = true;
  try {
    await api("../api/web/v1/account", { method: "DELETE", body: { confirmation: "DELETE_MY_ACCOUNT" } });
    form.reset(); clearAccountState(); await loadPublicSensors();
    showStatus("アカウントと観測データを削除しました。Googleアカウント自体は削除されません。");
  } catch (error) { showStatus(error.message, "error"); }
  finally { button.disabled = false; }
});
const showAdd = () => {
  if (pendingPairing) {
    showView("devices"); history.replaceState(null, "", "#devices");
    showStatus("発行済みの接続コードがあります。先に接続確認を行ってください。");
    pairingPanel.scrollIntoView({ block: "start" });
    return;
  }
  showView("add"); history.replaceState(null, "", "#add");
};
showAddButton.addEventListener("click", showAdd);
document.querySelectorAll("[data-action='show-add']").forEach((button) => button.addEventListener("click", showAdd));
document.querySelectorAll("[data-action='refresh-devices']").forEach(button => button.addEventListener("click", showDevices));
document.querySelectorAll("[data-action='prepare']").forEach(button => button.addEventListener("click", async () => {
  await showDevices();
  const help = document.querySelector("#sensor-prepare-help"); help.open = true;
  help.querySelector("summary").focus(); help.scrollIntoView({ block: "start" });
}));
document.querySelectorAll("[data-action='devices']").forEach((button) => button.addEventListener("click", showDevices));
document.querySelectorAll("[data-action='map']").forEach((button) => button.addEventListener("click", () => { showView("map"); history.replaceState(null, "", "#map"); }));
document.querySelectorAll("[data-nav]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  const destination = link.dataset.nav;
  if (!new Set(["map", "guide", "terms"]).has(destination) && !authenticated) { showView("login"); history.replaceState(null, "", "#login"); return; }
  if (destination === "profile" && sessionUser?.accountKind === "trial") { void showDevices(); return; }
  if (destination === "devices") showDevices();
  else { showView(destination); history.replaceState(null, "", `#${destination}`); }
}));
publicMapRefresh.addEventListener("click", async () => {
  const label = publicMapRefresh.querySelector("span");
  publicMapRefresh.disabled = true;
  publicMapRefresh.setAttribute("aria-busy", "true");
  publicMapRefresh.dataset.compactLabel = "更新中";
  label.textContent = "更新中…";
  try {
    await loadPublicSensors();
    publicMapRefresh.dataset.compactLabel = "完了";
    label.textContent = "更新しました";
    window.setTimeout(() => {
      if (label.textContent === "更新しました") {
        publicMapRefresh.dataset.compactLabel = "更新";
        label.textContent = "地図を更新";
      }
    }, 1_800);
  } catch (error) {
    publicMapRefresh.dataset.compactLabel = "更新";
    label.textContent = "地図を更新";
    showStatus(error.message, "error");
  } finally {
    publicMapRefresh.disabled = false;
    publicMapRefresh.removeAttribute("aria-busy");
  }
});

deviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pendingPairing || !deviceForm.reportValidity()) return;
  const submit = deviceForm.querySelector("button[type='submit']");
  submit.disabled = true;
  try {
    const body = await formDeviceForSubmission(deviceForm);
    const response = await api("../api/web/v1/devices/pairing", { method: "POST", body });
    pairingCode.value = response.pairingCode;
    pairingCode.textContent = response.pairingCode;
    pendingPairing = { name: body.name, expiresAt: Date.parse(response.expiresAt) };
    pairingPanel.hidden = false;
    document.querySelector("#pairing-connection-status").textContent = "";
    updatePairingExpiry();
    window.clearInterval(pairingExpiryTimer);
    pairingExpiryTimer = window.setInterval(updatePairingExpiry, 1000);
    await showDevices();
    pairingPanel.scrollIntoView({ block: "start" });
  } catch (error) { showStatus(error.message, "error"); }
  finally { submit.disabled = false; }
});

document.querySelector("#copy-pairing").addEventListener("click", async () => {
  if (!pendingPairing || Date.now() >= pendingPairing.expiresAt) return;
  try { await navigator.clipboard.writeText(pairingCode.value); showStatus("Pairing Codeをコピーしました。"); }
  catch { showStatus("コードを選択してコピーしてください。", "error"); }
});
document.querySelector("#pairing-complete").addEventListener("click", async (event) => {
  const button = event.currentTarget; button.disabled = true;
  const status = document.querySelector("#pairing-connection-status");
  try {
    await loadDevices();
    const matchingDevices = devices.filter(item => item.name === pendingPairing?.name);
    status.textContent = matchingDevices.length
      ? "一覧を更新しました。登録したセンサーの詳細を開き、ONLINE・最終更新・観測値を確認してください。同じ名前の端末がある場合はPC側のDevice IDと照合してください。"
      : "まだこの名前のセンサーが一覧にありません。ESP32がコードを受け付け、サーバーへの登録に成功すると表示されます。PC側の接続結果を確認してから再度更新してください。";
  } catch (error) { status.textContent = `接続状態を取得できませんでした。${error.message}`; }
  finally { button.disabled = false; }
});

function updatePairingExpiry() {
  if (!pendingPairing) return;
  const remaining = Math.max(0, Math.ceil((pendingPairing.expiresAt - Date.now()) / 1000));
  document.querySelector("#copy-pairing").disabled = !remaining;
  pairingExpiry.textContent = remaining
    ? `残り ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} · 1回限りのPairing Code`
    : "コードの有効期限が切れました。接続済みなら再発行は不要です。まだ接続していない場合だけ、同じ入力内容で発行し直せます。端末の削除は不要です。";
  document.querySelector("#pairing-retry").hidden = Boolean(remaining);
  if (!remaining) { pairingCode.value = ""; pairingCode.textContent = "期限切れ"; window.clearInterval(pairingExpiryTimer); }
}

function clearPendingPairing() {
  pendingPairing = null; window.clearInterval(pairingExpiryTimer);
  pairingCode.value = ""; pairingCode.textContent = "—"; pairingPanel.hidden = true;
}

document.querySelector("#pairing-retry").addEventListener("click", () => {
  if (!pendingPairing || Date.now() < pendingPairing.expiresAt) return;
  clearPendingPairing(); showAdd();
});
document.querySelector("#pairing-dismiss").addEventListener("click", () => {
  const message = "コード表示を閉じると、このコードは再表示できません。接続済み、または表示を終了してよいことを確認してください。未使用のコードは有効期限まで残ります。";
  if (pendingPairing && Date.now() < pendingPairing.expiresAt && !confirm(window.GaiaI18n?.t(message) || message)) return;
  clearPendingPairing();
});
document.querySelector("#refresh-detail").addEventListener("click", () => refreshDetail());
analyzeDetailButton?.addEventListener("click", () => {
  if (!selectedDevice) return;
  openSensorAnalysis({
    id: selectedDevice.deviceId,
    name: selectedDevice.name,
    region: locationLabel(selectedDevice),
    observations: selectedDeviceTelemetry,
    isDemo: false,
    source: "owner",
  });
});

locationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedDevice) return;
  const submit = locationForm.querySelector("button[type='submit']");
  submit.disabled = true;
  try {
    const response = await api(`../api/web/v1/devices/${encodeURIComponent(selectedDevice.deviceId)}`, {
      method: "PATCH",
      body: await formDeviceForSubmission(locationForm),
    });
    selectedDevice = response.device;
    locationForm.dataset.savedRegion = formRegionSelectionKey(locationForm);
    locationForm.querySelector("[data-location-picker]").dataset.regionPlot = "stored";
    showStatus("計測項目・地域・公開位置を更新しました。");
    await Promise.all([refreshDetail({ quiet: true, includeHistory: false }), loadPublicSensors()]);
  } catch (error) { showStatus(error.message, "error"); }
  finally { submit.disabled = false; }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = profileForm.querySelector("button[type='submit']");
  submit.disabled = true;
  try {
    const data = new FormData(profileForm);
    const response = await api("../api/web/v1/profile", { method: "PATCH", body: {
      displayName: String(data.get("displayName") || "").trim(),
      xUrl: String(data.get("xUrl") || "").trim() || null,
      githubUrl: String(data.get("githubUrl") || "").trim() || null,
      instagramUrl: String(data.get("instagramUrl") || "").trim() || null,
    } });
    currentProfile = response.profile;
    renderProfileAvatar();
    showStatus("プロフィールを保存しました。");
    await loadPublicSensors();
  } catch (error) { showStatus(error.message, "error"); }
  finally { submit.disabled = false; }
});

profileAvatarInput.addEventListener("change", async () => {
  const file = profileAvatarInput.files?.[0];
  if (!file) return;
  profileAvatarInput.disabled = true;
  try {
    const png = await normalizeAvatar(file);
    const response = await api("../api/web/v1/profile/avatar", { method: "PUT", rawBody: png, headers: { "Content-Type": "image/png" } });
    currentProfile = response.profile;
    renderProfileAvatar();
    showStatus("アイコンを保存しました。");
    await loadPublicSensors();
  } catch (error) { showStatus(error.message, "error"); }
  finally { profileAvatarInput.value = ""; profileAvatarInput.disabled = false; }
});

document.querySelector("#profile-avatar-delete").addEventListener("click", async () => {
  try {
    await api("../api/web/v1/profile/avatar", { method: "DELETE" });
    currentProfile = { ...currentProfile, avatarUrl: null };
    renderProfileAvatar();
    showStatus("アイコンを削除しました。");
    await loadPublicSensors();
  } catch (error) { showStatus(error.message, "error"); }
});

document.querySelector("#revoke-device").addEventListener("click", async () => {
  if (!selectedDevice) return;
  const message = window.GaiaI18n?.t('{name} を削除しますか？Device Tokenは直ちに無効になります。', { name: selectedDevice.name })
    || `${selectedDevice.name} を削除しますか？Device Tokenは直ちに無効になります。`;
  if (!confirm(message)) return;
  try {
    await api(`../api/web/v1/devices/${encodeURIComponent(selectedDevice.deviceId)}`, { method: "DELETE" });
    selectedDevice = null;
    showStatus("センサーを削除しました。");
    await showDevices();
  } catch (error) { showStatus(error.message, "error"); }
});

window.addEventListener("hashchange", () => {
  routeFromHash();
  if (location.hash.startsWith("#map")) restorePublicSensorSelectionFromHash();
});
const firstVisibleSensorGuideTarget = (...selectors) => selectors
  .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
  .find((element) => element instanceof HTMLElement && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0)
  || null;
let sensorModeGuideTimer = 0;
window.GaiaModeEntryGuide?.register?.("sensor", {
  version: "v3",
  kicker: "みずとあめのセンサー操作ガイド",
  focusTarget: () => firstVisibleSensorGuideTarget("[data-gaia-mode-guide-replay='sensor']", ".sensor-login-actions button", "[data-nav='map']"),
  features: {
    illustrated: true,
    kicker: "みずとあめがご案内！ / 見る・つなぐ・深める",
    title: "あなたのいつもの場所も、地球の観測点に！",
    copy: "みんなの観測を見るだけでも、自分のセンサーで参加しても。小さな気づきが、地球につながる。",
    startLabel: "観測の世界へ",
    note: "",
    items: [
      { icon: "live", image: "../assets/modes/guide-sensor-live-mizu-ame-v1.webp", tag: "みんなの観測をチェック", title: "みんなの観測が届く。", copy: "公開地図の観測点を選んで、最新の温度や湿度などを確認。更新時刻と接続状態も分かります。" },
      { icon: "sensor", image: "../assets/modes/guide-sensor-connect-mizu-ame-v1.webp", tag: "自分の機器で参加", title: "いつもの場所を、観測点に。", copy: "ESP32とセンサーをつないで、身近な環境を記録。準備・登録・接続はガイドに沿って進められます。" },
      { icon: "analysis", image: "../assets/modes/guide-sensor-analysis-mizu-ame-v1.webp", tag: "記録の分析・AIへの質問", title: "たまった記録が、発見になる。", copy: "観測履歴の平均・範囲・変化を分析できます。「どう変わった？」をAIに質問して、記録を深く読み解けます。" },
    ],
  },
  // Guide the current screen; viewing public observations must not require login.
  available: () => ["map", "login", "devices"].includes(document.documentElement.dataset.sensorView),
  steps: [
    {
      target: () => firstVisibleSensorGuideTarget("#public-map-zoom-in"),
      title: "地図を動かして、気になる場所へ",
      copy: "地図はドラッグで移動できます。＋／−で拡大・縮小し、スマホでは2本指でも操作できます。的のボタンで日本を中心に戻せます。",
    },
    {
      target: () => firstVisibleSensorGuideTarget("#public-map-search-open"),
      title: "観測点を探してみよう",
      copy: "虫めがねから、センサー名・参加者・地域で検索できます。観測点一覧では稼働中・展示・停止の状態でも絞り込めます。見るだけなら登録は不要です。",
    },
    {
      target: () => firstVisibleSensorGuideTarget(".sensor-map-marker:not([hidden])", "#public-map-directory-toggle"),
      title: "観測点の「いま」を見る",
      copy: "アイコンか一覧で観測点を選び、最新値・更新時刻・接続状態を確認。「展示」は模擬データです。地図の位置は公開用の目印です。",
    },
    {
      target: () => firstVisibleSensorGuideTarget("#refresh-map"),
      title: "新しい観測が届いているかな？",
      copy: "更新ボタンで公開地図を読み直せます。表示された値がいつの観測か、更新時刻も確認しましょう。通信が止まっている観測点では、最後に届いた値が表示されます。",
    },
    {
      target: () => firstVisibleSensorGuideTarget("#public-sensor-detail .sensor-analyze-trigger"),
      title: "記録から、発見を広げよう",
      copy: "「分析・AI質問」で、観測履歴の平均・範囲・変化を確認できます。数値分析はAPIキーなしで使えます。AIに質問するときだけ、ご自身のAPIキーを設定してください。",
    },
    {
      target: () => firstVisibleSensorGuideTarget(".sensor-login-actions button", "[data-view='devices'] [data-action='show-add']", "html[data-sensor-view='map'] [data-nav='devices']"),
      title: "観測への参加を始める",
      copy: "自分の機器で参加するときは「マイセンサー」へ。初めてならGoogleまたは匿名のおためしを選べます。新しいESP32の準備と、登録済み機器の接続確認を順に進められます。",
    },
    {
      target: () => firstVisibleSensorGuideTarget(".sensor-login-utility [data-action='map']", "html:not([data-sensor-view='map']) [data-nav='map']"),
      title: "公開中の観測点を見る",
      copy: "参加前でも公開地図を見られます。観測点を選ぶと、地域・最新値・つながりを確認できます。",
    },
    {
      target: () => firstVisibleSensorGuideTarget(".sensor-guide-cta", "[data-nav='guide']"),
      title: "接続手順を確認する",
      copy: "ESP32のバックアップ、ファームウェア書き込み、Wi-Fi設定までを接続ガイドで順番に確認できます。",
    },
  ],
});
window.GaiaModeEntryGuide?.mountReplay?.("sensor", document.querySelector(".sensor-header-guide"), { label: "センサーガイド" });
window.addEventListener("gaia:sensor-view-changed", (event) => {
  window.clearTimeout(sensorModeGuideTimer);
  if (!["map", "login", "devices"].includes(event.detail?.name)) {
    window.GaiaModeEntryGuide?.close?.("sensor", { restoreFocus: false });
    return;
  }
  sensorModeGuideTimer = window.setTimeout(() => {
    void window.GaiaModeEntryGuide?.open?.("sensor");
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 650);
});
void boot();

function syncAccountUi() {
  logoutButton.hidden = !authenticated;
  const trial = sessionUser?.accountKind === "trial";
  profileNav.hidden = trial;
  upgradeGoogleButton.hidden = !authenticated || !trial;
  upgradeGoogleButton.disabled = false;
  accountNote.hidden = !authenticated;
  const accountMessage = trial
    ? '{name}としておためし利用中。修正・削除できます。Google登録するとセンサーと履歴を保持し、ログアウトすると削除します。'
    : '{name}としてGoogle連携中。Googleの名前・メールアドレスは保存していません。';
  const accountName = sessionUser?.displayName || (trial ? '匿名参加者' : 'GAIA参加者');
  accountNote.translate = false; // Keep participant-provided names verbatim; bind only the surrounding UI.
  if (window.GaiaI18n) window.GaiaI18n.bind(accountNote, accountMessage, { name: accountName });
  else accountNote.textContent = accountMessage.replace('{name}', accountName);
}

function formDevice(form) {
  const data = new FormData(form);
  const subdivisionCode = String(data.get("subdivisionCode") || "").trim() || null;
  const municipalityCode = String(data.get("municipalityCode") || "").trim() || null;
  const measurementKeys = data.getAll("measurementKeys").map((key) => String(key));
  if (measurementKeys.length < 1 || measurementKeys.length > 16) throw new Error("測る項目を1〜16個選んでください。");
  return {
    name: String(data.get("name") || "").trim(),
    countryCode: String(data.get("countryCode") || "").trim(),
    subdivisionCode,
    municipalityCode,
    admin1Code: subdivisionCode ? null : String(data.get("admin1Code") || "").trim() || null,
    localityName: municipalityCode ? null : String(data.get("localityName") || "").trim() || null,
    isPublic: true,
    publicLatitude: numberOrNull(data.get("publicLatitude")),
    publicLongitude: numberOrNull(data.get("publicLongitude")),
    measurementKeys,
  };
}

function setMeasurementSelection(form, keys) {
  const selected = new Set(Array.isArray(keys) ? keys : []);
  const container = form.querySelector("[data-measurement-picker]");
  if (!container) return;
  container.querySelectorAll("input[name='measurementKeys']").forEach((input) => {
    input.checked = selected.has(input.value);
    input.disabled = false;
  });
  if (container.querySelector(".sensor-selected-measurements")) syncCompactMeasurementPicker(container);
}

function initRegionFields() {
  document.querySelectorAll("form [data-region-fields]").forEach((group) => {
    const form = group.closest("form");
    form.elements.countryCode.addEventListener("change", () => {
      form.elements.subdivisionCode.value = "";
      form.elements.municipalityCode.value = "";
      form.elements.admin1Code.value = "";
      form.elements.localityName.value = "";
      syncPickerViewport(form, form.elements.countryCode.value, { ensureLocation: true });
      void plotSelectedRegion(form);
      void populateRegionFields(form);
    });
    form.elements.subdivisionCode.addEventListener("change", () => {
      form.elements.municipalityCode.value = "";
      form.elements.admin1Code.value = "";
      form.elements.localityName.value = "";
      void plotSelectedRegion(form);
      void populateRegionFields(form, { subdivisionCode: form.elements.subdivisionCode.value });
    });
    form.elements.municipalityCode.addEventListener("change", () => {
      if (form.elements.municipalityCode.value) form.elements.localityName.value = "";
      void plotSelectedRegion(form);
    });
  });
}

async function populateRegionFields(form, selection = {}) {
  const countryCode = form.elements.countryCode.value;
  const subdivisionSelect = form.elements.subdivisionCode;
  const municipalitySelect = form.elements.municipalityCode;
  const municipalityField = municipalitySelect.closest("[data-municipality-field]");
  const note = form.querySelector("[data-region-note]");
  const requestedSubdivision = selection.subdivisionCode ?? subdivisionSelect.value;
  const requestedMunicipality = selection.municipalityCode ?? municipalitySelect.value;
  const requestKey = `${countryCode}:${requestedSubdivision}`;
  form.dataset.regionRequest = requestKey;
  subdivisionSelect.disabled = true;
  municipalitySelect.disabled = true;
  municipalityField.hidden = countryCode !== "JP";
  if (!countryCode) {
    replaceOptions(subdivisionSelect, "国を選択してください", []);
    replaceOptions(municipalitySelect, "都道府県を選択してください", []);
    note.textContent = "地域はISOの正式コードで保存します。住所は入力・保存しません。";
    return;
  }
  try {
    const base = await loadRegions(countryCode);
    if (form.dataset.regionRequest !== requestKey) return;
    subdivisionSelect.required = countryCode === "JP";
    replaceOptions(subdivisionSelect, countryCode === "JP" ? "都道府県を選択" : "指定しない", base.subdivisions);
    subdivisionSelect.disabled = base.subdivisions.length === 0;
    subdivisionSelect.value = requestedSubdivision;
    if (requestedSubdivision && !subdivisionSelect.value) appendCurrentOption(subdivisionSelect, requestedSubdivision);
    if (countryCode === "JP" && subdivisionSelect.value) {
      const scoped = await loadRegions(countryCode, subdivisionSelect.value);
      if (form.dataset.regionRequest !== requestKey) return;
      replaceOptions(municipalitySelect, "指定しない", scoped.municipalities);
      municipalitySelect.disabled = false;
      municipalitySelect.value = requestedMunicipality;
      if (requestedMunicipality && !municipalitySelect.value) appendCurrentOption(municipalitySelect, requestedMunicipality);
    } else {
      replaceOptions(municipalitySelect, "都道府県を選択してください", []);
    }
    const legacy = !subdivisionSelect.value && (form.elements.admin1Code.value || form.elements.localityName.value);
    note.textContent = legacy
      ? `既存の地域表記「${[form.elements.admin1Code.value, form.elements.localityName.value].filter(Boolean).join(" / ")}」を保持中です。正式コードを選ぶと正規化されます。`
      : countryCode === "JP"
        ? "都道府県は必須、市区町村は任意です。役所位置を初期表示し、公開POIは地図上で自由に調整できます。実際の設置住所は保存しません。"
        : "地域は国コードを含む完全なISO 3166-2コードで保存します。住所は保存しません。";
  } catch (error) {
    if (form.dataset.regionRequest !== requestKey) return;
    replaceOptions(subdivisionSelect, "地域コードを読み込めません", []);
    replaceOptions(municipalitySelect, "市区町村コードを読み込めません", []);
    note.textContent = error.message;
  }
}

async function loadRegions(countryCode, subdivisionCode = "") {
  const key = `${countryCode}:${subdivisionCode}`;
  if (!regionCache.has(key)) {
    const query = new URLSearchParams({ countryCode });
    if (subdivisionCode) query.set("subdivisionCode", subdivisionCode);
    regionCache.set(key, api(`../api/web/v1/regions?${query}`));
  }
  try { return await regionCache.get(key); }
  catch (error) { regionCache.delete(key); throw error; }
}

async function plotSelectedRegion(form) {
  const version = (regionPlotVersions.get(form) ?? 0) + 1;
  regionPlotVersions.set(form, version);
  const countryCode = form.elements.countryCode.value;
  const subdivisionCode = form.elements.subdivisionCode.value;
  const municipalityCode = form.elements.municipalityCode.value;
  const picker = form.querySelector("[data-location-picker]");
  if (countryCode !== "JP") {
    picker.dataset.regionPlot = "idle";
    return true;
  }
  if (!subdivisionCode) {
    setPickerLocation(form, null, null);
    picker.dataset.regionPlot = "waiting";
    return false;
  }
  picker.dataset.regionPlot = "loading";
  const query = new URLSearchParams({ countryCode, subdivisionCode, municipalityCode });
  const cacheKey = query.toString();
  if (!regionLocationCache.has(cacheKey)) {
    regionLocationCache.set(cacheKey, api(`../api/web/v1/region-location?${query}`));
  }
  try {
    const response = await regionLocationCache.get(cacheKey);
    if (regionPlotVersions.get(form) !== version) return;
    const basis = response.location.precision === "MUNICIPAL_MAIN_OFFICE" ? "municipal-main-office" : "prefectural-office";
    setPickerLocation(form, response.location.latitude, response.location.longitude, { basis });
    picker.dataset.regionPlot = "ready";
    return true;
  } catch {
    regionLocationCache.delete(cacheKey);
    if (regionPlotVersions.get(form) === version) {
      picker.dataset.regionPlot = "fallback";
      setPickerLocation(form, null, null);
      const output = form.querySelector("[data-location-output]");
      if (output) output.textContent = "役所の公開座標を取得できません。もう一度地域を選択してください。";
    }
    return false;
  }
}

function cancelRegionPlot(form) {
  regionPlotVersions.set(form, (regionPlotVersions.get(form) ?? 0) + 1);
  const picker = form.querySelector("[data-location-picker]");
  if (picker) picker.dataset.regionPlot = "manual";
}

function replaceOptions(select, emptyLabel, options) {
  select.replaceChildren(new Option(emptyLabel, ""));
  options.forEach((option) => select.append(new Option(`${option.name} / ${option.code}`, option.code)));
}

function appendCurrentOption(select, code) {
  select.append(new Option(`${code} / 現在の登録値`, code));
  select.value = code;
}

function initLocationPickers() {
  document.querySelectorAll(".sensor-public-location").forEach((fieldset) => {
    const form = fieldset.closest("form");
    const picker = fieldset.querySelector("[data-location-picker]");
    picker.addEventListener("pointerdown", (event) => {
      cancelRegionPlot(form);
      const rect = picker.getBoundingClientRect();
      const view = mapViewFor(picker);
      const bounds = selectionBoundsFor(view);
      setPickerLocation(
        form,
        clamp(view.north - ((event.clientY - rect.top) / rect.height) * (view.north - view.south), bounds.south, bounds.north),
        clamp(view.west + ((event.clientX - rect.left) / rect.width) * (view.east - view.west), bounds.west, bounds.east),
      );
    });
    picker.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      cancelRegionPlot(form);
      const view = mapViewFor(picker);
      const bounds = selectionBoundsFor(view);
      const latitude = numberOrNull(form.elements.publicLatitude.value) ?? ((view.north + view.south) / 2);
      const longitude = numberOrNull(form.elements.publicLongitude.value) ?? ((view.east + view.west) / 2);
      const step = event.shiftKey ? .1 : .01;
      setPickerLocation(
        form,
        clamp(latitude + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0), bounds.south, bounds.north),
        clamp(longitude + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), bounds.west, bounds.east),
      );
    });
    syncPickerViewport(form, form.elements.countryCode.value);
    syncPickerEnabled(form);
  });
}

function syncPickerViewport(form, countryCode, { ensureLocation = false } = {}) {
  const picker = form.querySelector("[data-location-picker]");
  if (!picker) return;
  const view = countryMapViews[countryCode] || worldMapView;
  mapViewports.set(picker, view);
  picker.dataset.mapView = view.key;
  const basis = picker.querySelector("[data-map-basis]");
  if (basis) basis.textContent = view.key === "WORLD" ? "BASEMAP / NATURAL EARTH 1:50m" : `BASEMAP / NATURAL EARTH / ${view.key}`;
  const latitude = numberOrNull(form.elements.publicLatitude.value);
  const longitude = numberOrNull(form.elements.publicLongitude.value);
  const bounds = selectionBoundsFor(view);
  const outsideView = latitude !== null && longitude !== null
    && (latitude < bounds.south || latitude > bounds.north || longitude < bounds.west || longitude > bounds.east);
  if (ensureLocation && (latitude === null || longitude === null || outsideView)) {
    setPickerLocation(form, (bounds.north + bounds.south) / 2, (bounds.east + bounds.west) / 2);
  } else {
    setPickerLocation(form, latitude, longitude);
  }
  mapRenderers.get(picker)?.();
}

function mapViewFor(surface) {
  return mapViewports.get(surface) || worldMapView;
}

function selectionBoundsFor(view) {
  return {
    west: view.selectionWest ?? view.west,
    east: view.selectionEast ?? view.east,
    south: view.selectionSouth ?? view.south,
    north: view.selectionNorth ?? view.north,
  };
}

async function formDeviceForSubmission(form) {
  const picker = form.querySelector("[data-location-picker]");
  const regionChanged = form.dataset.savedRegion !== undefined
    && form.dataset.savedRegion !== formRegionSelectionKey(form);
  if (picker?.dataset.regionPlot === "loading" || (regionChanged && picker?.dataset.regionPlot !== "manual")) {
    await plotSelectedRegion(form);
  }
  return formDevice(form);
}

function formRegionSelectionKey(form) {
  return regionSelectionKey(
    form.elements.countryCode.value,
    form.elements.subdivisionCode.value,
    form.elements.municipalityCode.value,
  );
}

function regionSelectionKey(countryCode, subdivisionCode, municipalityCode) {
  return [countryCode, subdivisionCode, municipalityCode].map((value) => String(value || "").trim()).join(":");
}

function syncPickerEnabled(form) {
  const picker = form.querySelector("[data-location-picker]");
  picker.dataset.locationLocked = "false";
  picker.removeAttribute("aria-disabled");
  picker.tabIndex = 0;
  if (form.elements.countryCode.value !== "JP" && numberOrNull(form.elements.publicLatitude.value) === null) setPickerLocation(form, 0, 0);
}

function setPickerLocation(form, rawLatitude, rawLongitude, { basis = "" } = {}) {
  const precisionFactor = 100_000;
  const latitude = rawLatitude === null || rawLatitude === undefined ? null : Math.max(-90, Math.min(90, Math.round(Number(rawLatitude) * precisionFactor) / precisionFactor));
  const longitude = rawLongitude === null || rawLongitude === undefined ? null : Math.max(-180, Math.min(180, Math.round(Number(rawLongitude) * precisionFactor) / precisionFactor));
  form.elements.publicLatitude.value = latitude ?? "";
  form.elements.publicLongitude.value = longitude ?? "";
  const picker = form.querySelector("[data-location-picker]");
  if (basis) picker.dataset.locationBasis = basis;
  else delete picker.dataset.locationBasis;
  picker.querySelector(".sensor-picker-pin")?.remove();
  const output = form.querySelector("[data-location-output]");
  if (latitude === null || longitude === null) { output.textContent = "位置は未選択です"; return; }
  const pin = document.createElement("i");
  pin.className = "sensor-picker-pin";
  const view = mapViewFor(picker);
  pin.style.left = `${longitudeToPercent(longitude, view)}%`;
  pin.style.top = `${latitudeToPercent(latitude, view)}%`;
  picker.append(pin);
  const basisLabel = {
    "prefectural-office": "都道府県庁所在地",
    "municipal-main-office": "本庁所在地",
    "stored": "現在の公開位置",
  }[basis] || "公開POI";
  output.textContent = `${basisLabel} ${latitude.toFixed(5)}, ${longitude.toFixed(5)}（公開）`;
}

async function mountMapSurfaces() {
  const surfaces = [...document.querySelectorAll(".sensor-world-map, .sensor-location-picker")];
  surfaces.forEach((surface) => { surface.dataset.basemap = "loading"; });
  try {
    const [countryResponse, prefectureLines] = await Promise.all([
      fetch(naturalEarthCountriesUrl),
      fetch(japanPrefectureUrl)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
        .then(extractSharedTopologyArcs)
        .catch(() => []),
    ]);
    if (!countryResponse.ok) throw new Error(`HTTP ${countryResponse.status}`);
    const countryLines = prepareMapLines(extractLandRings(await countryResponse.json()));
    if (countryLines.length < 200) throw new Error("country geometry is incomplete");
    surfaces.forEach((surface) => mountMapCanvas(surface, countryLines, prefectureLines));
  } catch {
    surfaces.forEach((surface) => {
      surface.dataset.basemap = "unavailable";
      const basis = surface.querySelector("[data-map-basis]");
      if (basis) basis.textContent = "BASEMAP / UNAVAILABLE";
    });
  }
}

function extractSharedTopologyArcs(topology) {
  if (topology?.type !== "Topology" || !Array.isArray(topology.arcs)) return [];
  const referenceCounts = new Uint16Array(topology.arcs.length);
  const visitArcReferences = (value) => {
    if (Array.isArray(value)) { value.forEach(visitArcReferences); return; }
    if (!Number.isInteger(value)) return;
    const index = value < 0 ? ~value : value;
    if (index >= 0 && index < referenceCounts.length) referenceCounts[index] += 1;
  };
  Object.values(topology.objects ?? {}).forEach((object) => {
    if (object?.type === "GeometryCollection") object.geometries?.forEach((geometry) => visitArcReferences(geometry.arcs));
    else visitArcReferences(object?.arcs);
  });

  const scale = topology.transform?.scale ?? [1, 1];
  const translate = topology.transform?.translate ?? [0, 0];
  const sharedArcs = [];
  topology.arcs.forEach((arc, index) => {
    if (referenceCounts[index] < 2 || !Array.isArray(arc)) return;
    let x = 0;
    let y = 0;
    const points = [];
    arc.forEach((delta) => {
      x += Number(delta?.[0]) || 0;
      y += Number(delta?.[1]) || 0;
      points.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
    });
    if (points.length > 1) sharedArcs.push(points);
  });
  return prepareMapLines(sharedArcs);
}

function extractLandRings(geojson) {
  const rings = [];
  for (const feature of geojson?.features ?? []) {
    const geometry = feature?.geometry;
    if (geometry?.type === "Polygon") rings.push(...geometry.coordinates);
    else if (geometry?.type === "MultiPolygon") geometry.coordinates.forEach((polygon) => rings.push(...polygon));
  }
  return rings;
}

function prepareMapLines(lines) {
  return lines.map((line) => {
    const points = [];
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (const coordinate of line ?? []) {
      const longitude = Number(coordinate?.[0]);
      const latitude = Number(coordinate?.[1]);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
      points.push([longitude, latitude]);
      west = Math.min(west, longitude);
      east = Math.max(east, longitude);
      south = Math.min(south, latitude);
      north = Math.max(north, latitude);
    }
    return { points, west, east, south, north };
  }).filter((line) => line.points.length > 1);
}

function mountMapCanvas(surface, countryLines, prefectureLines) {
  const canvas = document.createElement("canvas");
  canvas.className = "sensor-map-canvas";
  if (surface === publicSensorMap) canvas.classList.add("sensor-map-canvas--overscan");
  canvas.setAttribute("aria-hidden", "true");
  surface.prepend(canvas);
  surface.dataset.countryBoundaries = String(countryLines.length);
  surface.dataset.prefectureBoundaries = String(prefectureLines.length);
  const render = () => renderMapCanvas(canvas, countryLines, prefectureLines, mapViewFor(surface));
  mapRenderers.set(surface, render);
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(render);
    observer.observe(surface);
    mapObservers.push(observer);
  } else {
    window.addEventListener("resize", render, { passive: true });
  }
  surface.dataset.basemap = "ready";
  render();
}

function renderMapCanvas(canvas, countryLines, prefectureLines, view = worldMapView) {
  const overscan = canvas.classList.contains("sensor-map-canvas--overscan") ? publicMapOverscanRatio : 0;
  const { width, height } = (overscan ? canvas : canvas.parentElement).getBoundingClientRect();
  if (width < 1 || height < 1) return;
  if (overscan) {
    const longitudeMargin = (view.east - view.west) * overscan;
    const latitudeMargin = (view.north - view.south) * overscan;
    view = {
      ...view,
      west: view.west - longitudeMargin,
      east: view.east + longitudeMargin,
      south: view.south - latitudeMargin,
      north: view.north + latitudeMargin,
    };
  }
  const requestedPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelBudgetRatio = overscan ? Math.sqrt(publicMapCanvasPixelBudget / Math.max(width * height, 1)) : requestedPixelRatio;
  const dimensionRatio = overscan ? 8_192 / Math.max(width, height, 1) : requestedPixelRatio;
  const pixelRatio = Math.max(.35, Math.min(requestedPixelRatio, pixelBudgetRatio, dimensionRatio));
  const canvasWidth = Math.round(width * pixelRatio);
  const canvasHeight = Math.round(height * pixelRatio);
  canvas.dataset.renderScale = pixelRatio.toFixed(3);
  canvas.dataset.renderPixels = String(canvasWidth * canvasHeight);
  if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.save();
  const publicMap = canvas.parentElement === publicSensorMap;
  context.strokeStyle = publicMap ? "rgba(126, 230, 214, .08)" : "rgba(126, 230, 214, .16)";
  context.lineWidth = 1;
  context.setLineDash([2, 7]);
  const span = view.east - view.west;
  const longitudeStep = view.key === "WORLD" ? 30 : span > 100 ? 10 : span > 35 ? 5 : span > 15 ? 2 : 1;
  const latitudeStep = longitudeStep;
  for (let longitude = Math.ceil(view.west / longitudeStep) * longitudeStep; longitude < view.east; longitude += longitudeStep) {
    const x = ((longitude - view.west) / (view.east - view.west)) * width;
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let latitude = Math.ceil(view.south / latitudeStep) * latitudeStep; latitude < view.north; latitude += latitudeStep) {
    const y = ((view.north - latitude) / (view.north - view.south)) * height;
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.restore();

  const land = new Path2D();
  for (const ring of countryLines) {
    for (const longitudeOffset of mapLongitudeOffsets(view)) {
      if (ring.east + longitudeOffset < view.west || ring.west + longitudeOffset > view.east || ring.north < view.south || ring.south > view.north) continue;
      let started = false;
      let previousLongitude = null;
      for (const [longitude, latitude] of ring.points) {
        const shiftedLongitude = longitude + longitudeOffset;
        const x = ((shiftedLongitude - view.west) / (view.east - view.west)) * width;
        const y = ((view.north - latitude) / (view.north - view.south)) * height;
        if (!started || (previousLongitude !== null && Math.abs(longitude - previousLongitude) > 180)) {
          land.moveTo(x, y);
          started = true;
        } else land.lineTo(x, y);
        previousLongitude = longitude;
      }
      if (started) land.closePath();
    }
  }
  context.fillStyle = publicMap ? "rgba(13, 62, 53, .17)" : "rgba(30, 103, 99, .34)";
  context.fill(land, "evenodd");
  context.strokeStyle = publicMap ? "rgba(116, 225, 201, .65)" : "rgba(137, 244, 216, .72)";
  context.lineWidth = publicMap ? .85 : Math.max(.65, width / 1_900);
  context.shadowColor = "rgba(86, 255, 223, .2)";
  context.shadowBlur = publicMap || width > 2_200 ? 0 : 5;
  context.stroke(land);

  const prefectures = new Path2D();
  for (const line of prefectureLines) {
    for (const longitudeOffset of mapLongitudeOffsets(view)) {
      if (line.east + longitudeOffset < view.west || line.west + longitudeOffset > view.east || line.north < view.south || line.south > view.north) continue;
      let started = false;
      for (const [longitude, latitude] of line.points) {
        const x = ((longitude + longitudeOffset - view.west) / (view.east - view.west)) * width;
        const y = ((view.north - latitude) / (view.north - view.south)) * height;
        if (!started) { prefectures.moveTo(x, y); started = true; }
        else prefectures.lineTo(x, y);
      }
    }
  }
  context.strokeStyle = publicMap ? "rgba(175, 231, 215, .36)" : "rgba(213, 255, 244, .58)";
  context.lineWidth = publicMap ? .65 : Math.max(.7, Math.min(1.35, width / 1_700));
  context.shadowColor = "rgba(119, 255, 225, .28)";
  context.shadowBlur = publicMap || width > 2_200 ? 0 : 3;
  context.stroke(prefectures);
}

async function normalizeAvatar(file) {
  if (file.type !== "image/png" || file.size > 8 * 1024 * 1024) throw new Error("8MB以下のPNGを選んでください。");
  const bitmap = await createImageBitmap(file);
  const sourceEdge = Math.min(bitmap.width, bitmap.height);
  const outputEdge = Math.min(512, sourceEdge);
  if (sourceEdge < 1) { bitmap.close(); throw new Error("画像を読み込めませんでした。"); }
  const canvas = document.createElement("canvas");
  canvas.width = outputEdge; canvas.height = outputEdge;
  const context = canvas.getContext("2d", { alpha: true });
  context.drawImage(bitmap, (bitmap.width - sourceEdge) / 2, (bitmap.height - sourceEdge) / 2, sourceEdge, sourceEdge, 0, 0, outputEdge, outputEdge);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNGを作成できませんでした。")), "image/png"));
  if (blob.size > 1024 * 1024) throw new Error("変換後のPNGが1MBを超えています。");
  return blob;
}

function numberOrNull(value) { const number = Number(value); return value === null || value === "" || !Number.isFinite(number) ? null : number; }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function normalizeLongitude(longitude) { return ((Number(longitude) + 180) % 360 + 360) % 360 - 180; }
function mapLongitudeOffsets(view) { return view.key === "PUBLIC" ? [-360, 0, 360] : [0]; }
function longitudeNearestToView(longitude, view) {
  const viewCenter = (view.west + view.east) / 2;
  return Number(longitude) + 360 * Math.round((viewCenter - Number(longitude)) / 360);
}
function longitudeToPercent(longitude, view = worldMapView) { return ((Number(longitude) - view.west) / (view.east - view.west)) * 100; }
function latitudeToPercent(latitude, view = worldMapView) { return ((view.north - Number(latitude)) / (view.north - view.south)) * 100; }

function readCookie(name) {
  const prefix = `${name}=`;
  const pair = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : "";
}

function locationLabel(device) {
  const country = device.countryName === device.countryCode ? regionNames?.of(device.countryCode) : device.countryName;
  const subdivision = device.subdivisionCode
    ? `${device.subdivisionName || device.subdivisionCode} (${device.subdivisionCode})`
    : device.admin1Code;
  const municipality = device.municipalityCode
    ? `${device.municipalityName || device.localityName || device.municipalityCode} (${device.municipalityCode})`
    : device.localityName;
  return [country || device.countryCode, subdivision, municipality].filter(Boolean).join(" / ");
}
function formatValue(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 2 }) : "—"; }
function formatRelative(iso) { const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000)); return seconds < 60 ? `${seconds}秒前` : seconds < 3600 ? `${Math.floor(seconds / 60)}分前` : new Date(iso).toLocaleString("ja-JP"); }
function labelFor(key) { return metricDefinition(key).label; }
function unitFor(key) { return metricDefinition(key).unit; }
