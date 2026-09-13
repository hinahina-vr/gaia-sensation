/**
 * 概要: データ探索画面の制御。公開データの読み込み、展示切替、観測点の選択と出典表示を結び付ける。
 */
(async () => {
  "use strict";
  const { japanPrefectureView } = await import('./src/exploration/japan-prefecture-view.js');
  const { animateMetricText } = await import("./src/shared/animated-metric.js");

  const { renderPoiPreviewReadings, renderPoiPreviewTitle } = await import("./src/exploration/poi-preview-readings.js?v=large-values-20260912-i18n-20260913");
  const { formatCoordinatesJa } = await import("./src/shared/coordinates.js");

  const { createSnapshotStore } = await import("./src/data/snapshot-store.js?v=gaia-hardening-1-perf-high-20260909");
  const { recyclingSourceId, recyclingSourceLabel, recyclingDefinition, recyclingScope, recyclingYearNote, recyclingDetails, RECYCLING_COMPARABILITY } = await import("./src/data/recycling-provenance.js?v=recycling-coverage-1");
  const snapshotStore = createSnapshotStore({ manifestUrl: new URL("./data/runtime/gaia-manifest.json?v=recycling-coverage-1", document.baseURI).href });
  let snapshotOwnerDisposed = false;
  window.addEventListener("pagehide", event => {
    if (!event.persisted) { snapshotOwnerDisposed = true; snapshotStore.dispose(); }
  });

  const canvas = document.querySelector("#gaia-canvas");
  const canvasHomeParent = canvas.parentElement;
  const canvasHomeNextSibling = canvas.nextElementSibling;
  const experience = document.querySelector(".experience");
  const errorPanel = document.querySelector("#error-panel");
  const modeList = document.querySelector("#mode-list");
  const modeNumber = document.querySelector("#mode-number");
  const modeTitle = document.querySelector("#mode-title");
  const modeTitleJa = document.querySelector("#mode-title-ja");
  const modeDescription = document.querySelector("#mode-description");
  const conceptOpen = document.querySelector("#concept-open");
  const conceptPanel = document.querySelector("#concept-panel");
  const conceptClose = document.querySelector("#concept-close");
  const conceptNumber = document.querySelector("#concept-number");
  const conceptTitle = document.querySelector("#concept-title");
  const conceptTitleEn = document.querySelector("#concept-title-en");
  const conceptLead = document.querySelector("#concept-lead");
  const conceptSeeing = document.querySelector("#concept-seeing");
  const conceptTouch = document.querySelector("#concept-touch");
  const conceptContext = document.querySelector("#concept-context");
  const conceptQuestion = document.querySelector("#concept-question");
  const conceptScroll = document.querySelector("#concept-scroll");
  const conceptPosition = document.querySelector("#concept-position");
  const conceptPrevious = document.querySelector("#concept-previous");
  const conceptNext = document.querySelector("#concept-next");
  const conceptModeList = document.querySelector("#concept-mode-list");
  const previousModeButton = document.querySelector("#previous-mode");
  const nextModeButton = document.querySelector("#next-mode");
  const autoButton = document.querySelector("#auto-button");
  const resetButton = document.querySelector("#reset-button");
  const sourceButton = document.querySelector("#source-button");
  const sourceClose = document.querySelector("#source-close");
  const sourcePanel = document.querySelector("#source-panel");
  const sourceScrim = document.querySelector("#source-scrim");
  const sourceCode = document.querySelector("#source-code");
  const sourceTitle = document.querySelector("#source-title");
  const sourceFile = document.querySelector("#source-file");
  const sourceLanguage = document.querySelector("#source-language");
  const sourceTabs = Array.from(document.querySelectorAll("[data-source-tab]"));
  const signalConsoles = Array.from(document.querySelectorAll("[data-signal-console]"));
  const signalTimeInputs = Array.from(document.querySelectorAll("[data-signal-time]"));
  const mapSignalEncodingLegendTitle = document.querySelector("[data-signal-encoding-legend-title]");
  const mapSignalEncodingLegend = document.querySelector("[data-signal-encoding-legend]");
  const mapMobileLegendToggle = document.querySelector("#map-mobile-legend-toggle");
  const introLayer = document.querySelector("#intro-layer");
  const openingLayer = document.querySelector("#gaia-opening");
  const introPathStage = document.querySelector("#intro-path-stage");
  const introSenseStage = document.querySelector("#intro-sense-stage");
  const introPathGrid = document.querySelector("#intro-path-grid");
  const introPathButtons = Array.from(document.querySelectorAll("[data-intro-path]"));
  const introStoryReturn = document.querySelector(".intro-story-return[data-primary-action=\"true\"]");
  const createIntroApeironceneParticles = () => {
    if (!(introStoryReturn instanceof HTMLButtonElement) || introStoryReturn.querySelector(".intro-apeironcene-particle-field")) return;

    const field = document.createElement("i");
    field.className = "intro-apeironcene-particle-field";
    field.setAttribute("aria-hidden", "true");

    // Keep the field deterministic for screenshots, but distribute particles in
    // deliberately uneven shoals. Depth controls size, blur, speed and travel,
    // so the lights no longer read as one flat layer moving in lockstep.
    let seed = 0x7a31c4ef;
    const random = () => {
      seed = ((seed * 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const clusters = [
      { center: 7.5, spread: 6.8, count: 34 },
      { center: 35, spread: 5.6, count: 34 },
      { center: 71.5, spread: 4.7, count: 18 },
      { center: 96.5, spread: 3.8, count: 31 },
    ];
    const positions = clusters.flatMap(({ center, spread, count }) => (
      Array.from({ length: count }, () => center + ((random() - 0.5) * spread * 2))
    ));
    positions.push(20 + random() * 2, 55 + random() * 2, 85 + random() * 2);

    const fragment = document.createDocumentFragment();
    positions.forEach((rawX, index) => {
      const depthRoll = random();
      const depth = depthRoll < 0.22 ? "near" : depthRoll < 0.62 ? "mid" : "far";
      const particle = document.createElement("i");
      const duration = depth === "near"
        ? 4.8 + random() * 3.6
        : depth === "mid"
          ? 8 + random() * 6.5
          : 14 + random() * 10;
      const size = depth === "near"
        ? 2.1 + random() * 2.2
        : depth === "mid"
          ? 1 + random() * 1.25
          : 0.45 + random() * 0.72;
      const driftScale = depth === "near" ? 1 : depth === "mid" ? 0.62 : 0.34;
      const opacity = depth === "near"
        ? 0.66 + random() * 0.32
        : depth === "mid"
          ? 0.38 + random() * 0.34
          : 0.16 + random() * 0.24;

      particle.className = `intro-apeironcene-particle intro-apeironcene-particle--${depth}`;
      particle.style.setProperty("--particle-x", `${Math.min(99.7, Math.max(0.3, rawX)).toFixed(2)}%`);
      particle.style.setProperty("--particle-y", `${(-8 + random() * 116).toFixed(2)}%`);
      particle.style.setProperty("--particle-size", `${size.toFixed(2)}px`);
      particle.style.setProperty("--particle-opacity", opacity.toFixed(3));
      particle.style.setProperty("--particle-duration", `${duration.toFixed(2)}s`);
      particle.style.setProperty("--particle-delay", `${(-random() * duration).toFixed(2)}s`);
      particle.style.setProperty("--particle-drift", `${((random() - 0.5) * 88 * driftScale).toFixed(2)}px`);
      particle.style.setProperty("--particle-twinkle", `${(1.7 + random() * 4.8).toFixed(2)}s`);
      particle.style.setProperty("--particle-twinkle-delay", `${(-random() * 5.6).toFixed(2)}s`);
      particle.dataset.particle = String(index + 1);
      fragment.append(particle);
    });

    field.append(fragment);
    introStoryReturn.prepend(field);
  };
  const createIntroApeironceneTransition = (refresh = false) => {
    if (!(introStoryReturn instanceof HTMLButtonElement)) return;
    const previous = introStoryReturn.querySelector(".intro-story-transition");
    if (previous && !refresh) return;
    // Measure at reveal time, so stars stay round on narrow screens too.
    // This bounded SVG plays once; no render loop or permanent ornament is added.
    const width = introStoryReturn.clientWidth || 1000;
    const height = introStoryReturn.clientHeight || 58;
    const x = (fraction) => Number((width * fraction).toFixed(2));
    const cy = height / 2;
    const field = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    field.classList.add("intro-story-transition");
    field.setAttribute("viewBox", `0 0 ${width} ${height}`);
    field.setAttribute("preserveAspectRatio", "none");
    field.setAttribute("aria-hidden", "true");
    const star = '<path d="M-1.1-1.1L0-7L1.1-1.1L6 0L1.1 1.1L0 7L-1.1 1.1L-6 0Z" fill="white"/>';
    let seed = 0x26ae91;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const splash = Array.from({ length: 76 }, (_, index) => {
      const origin = x(.36 + random() * .28);
      const destination = x(.035 + random() * .93);
      const dx = destination - origin;
      const dy = (index % 2 ? -1 : 1) * (18 + random() * 63);
      const size = index % 3 === 0 ? .45 + random() * .65 : .25 + random() * .35;
      const color = ["#d8faff", "#d5c2ff", "#fff0c9"][index % 3];
      return `<g transform="translate(${origin} ${cy})">
        <g class="intro-entry-splash" style="--burst-x:${dx.toFixed(2)}px;--burst-y:${dy.toFixed(2)}px;--fall-x:${(dx * 1.03).toFixed(2)}px;--fall-y:${(dy + 24).toFixed(2)}px;--reveal-at:${(.48 + random() * .32).toFixed(2)}s;--life:${(1.3 + random() * .65).toFixed(2)}s">
          <g transform="scale(${size.toFixed(2)})">
            <circle r="15" fill="url(#intro-entry-glow)"/>
            ${index % 3 === 0 ? star : `<circle r="2.3" fill="${color}"/><circle r=".85" fill="white"/>`}
          </g>
        </g>
      </g>`;
    }).join("");
    const petals = Array.from({ length: 12 }, (_, index) => {
      const side = index % 2 ? -1 : 1;
      const lift = (index % 4 < 2 ? -1 : 1) * (30 + random() * 44);
      const reach = x(.22 + random() * .23) * side;
      const curve = `M${x(.5)} ${cy}Q${x(.5) + reach * .48} ${cy + lift * .1} ${x(.5) + reach} ${cy + lift}`;
      return `<path class="intro-entry-petal" d="${curve}" fill="none" stroke="url(#intro-entry-ribbon)" stroke-width="${index % 3 ? 1 : 2.5}" stroke-linecap="round" pathLength="100" style="--reveal-at:${(.44 + random() * .2).toFixed(2)}s"/>`;
    }).join("");
    const streak = (curve, echo = false) => `
      <g class="intro-entry-streak${echo ? " intro-entry-streak--echo" : ""}">
        <path d="${curve}" fill="none" stroke="url(#intro-entry-ribbon)" stroke-width="${echo ? "3" : "6"}" opacity=".4"/>
        <path d="${curve}" fill="none" stroke="url(#intro-entry-ribbon)"
          stroke-width="${echo ? ".85" : "1.5"}" vector-effect="non-scaling-stroke"
          pathLength="1000" stroke-dasharray="210 1100">
          <animate data-intro-comet-motion data-intro-delay="${echo ? ".64" : ".44"}"
            attributeName="stroke-dashoffset" from="210" to="-1000"
            dur="1.5s" begin="indefinite" fill="freeze"/>
        </path>
        <g opacity="${echo ? ".65" : "1"}">
          <circle r="${echo ? "18" : "26"}" fill="url(#intro-entry-glow)"/>
          ${star}
          <circle r="1.2" fill="#fff"/>
          <animateMotion data-intro-comet-motion data-intro-delay="${echo ? ".64" : ".44"}"
            path="${curve}" dur="1.5s" begin="indefinite" fill="freeze" rotate="auto"/>
        </g>
      </g>`;
    const glints = [[.08, -14, .95], [.19, 62, 1.12], [.35, -30, .82], [.53, 86, 1.38], [.72, -18, 1.55], [.9, 69, 1.3]]
      .map(([px, py, delay]) => `
        <g transform="translate(${x(px)} ${py})">
          <g class="intro-entry-glint" style="--reveal-at:${delay}s">
            <circle r="24" fill="url(#intro-entry-glow)"/>${star}
          </g>
        </g>`).join("");
    field.innerHTML = `
      <defs>
        <radialGradient id="intro-entry-glow">
          <stop stop-color="#fff" stop-opacity=".95"/>
          <stop offset=".12" stop-color="#e8f9ff" stop-opacity=".72"/>
          <stop offset=".38" stop-color="#abdfff" stop-opacity=".18"/>
          <stop offset="1" stop-color="#c9b6ff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="intro-entry-pearl">
          <stop stop-color="#fff" stop-opacity=".96"/>
          <stop offset=".14" stop-color="#f4f4ff" stop-opacity=".86"/>
          <stop offset=".4" stop-color="#c6c0ff" stop-opacity=".47"/>
          <stop offset=".68" stop-color="#86e7ff" stop-opacity=".16"/>
          <stop offset="1" stop-color="#b2c9ff" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="intro-entry-ribbon">
          <stop stop-color="#b7f9ff" stop-opacity="0"/>
          <stop offset=".22" stop-color="#b7f9ff" stop-opacity=".6"/>
          <stop offset=".5" stop-color="#fff"/>
          <stop offset=".78" stop-color="#dfc7ff" stop-opacity=".65"/>
          <stop offset="1" stop-color="#ffedbf" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g transform="translate(${x(.5)} ${cy})">
        <g class="intro-entry-bloom">
          <ellipse rx="${x(.5)}" ry="106" fill="url(#intro-entry-pearl)"/>
          <ellipse rx="${x(.43)}" ry="22" fill="url(#intro-entry-glow)"/>
        </g>
        <g class="intro-entry-flare">
          <circle r="45" fill="url(#intro-entry-glow)"/>
          <path d="M${-x(.43)} 0Q-8-1-3-3Q-1-8 0-48Q1-8 3-3Q8-1 ${x(.43)} 0Q8 1 3 3Q1 8 0 48Q-1 8-3 3Q-8 1 ${-x(.43)} 0Z" fill="url(#intro-entry-ribbon)"/>
          <circle r="3" fill="white"/>
        </g>
      </g>
      ${petals}
      ${streak(`M${x(.03)} ${cy + 4}C${x(.24)} ${cy - 51} ${x(.58)} ${cy + 60} ${x(.96)} ${cy - 24}`)}
      ${streak(`M${x(.04)} ${cy + 16}C${x(.32)} ${cy + 64} ${x(.69)} ${cy - 59} ${x(.97)} ${cy + 10}`, true)}
      ${splash}
      ${glints}
    `;
    if (previous) previous.replaceWith(field);
    else introStoryReturn.prepend(field);
  };
  const introTitleReturn = document.querySelector("#intro-title-return");
  const introEntryGuideReplay = document.querySelector("#intro-entry-guide-replay");
  const introScrollCue = document.querySelector("#intro-lp-scroll");
  const introAfterfold = document.querySelector(".intro-lp-afterfold");
  const introSoundPreviewButton = document.querySelector(".intro-path-card--sound");
  const introVisuals = Array.from(document.querySelectorAll("[data-intro-visual]"));
  const introPathBack = document.querySelector("#intro-path-back");
  const introPathKicker = document.querySelector("#intro-path-kicker");
  const introSenseTitle = document.querySelector("#intro-sense-title");
  const introSenseLead = document.querySelector("#intro-sense-lead");
  const introSelectionPrompt = document.querySelector("#intro-selection-prompt");
  const introPathNote = document.querySelector("#intro-path-note");
  const introModeList = document.querySelector("#intro-mode-list");
  const introSelectionPreview = document.querySelector(".intro-selection-preview");
  const introSelectionNumber = document.querySelector("#intro-selection-number");
  const introSelectionTitle = document.querySelector("#intro-selection-title");
  const introSelectionCopy = document.querySelector("#intro-selection-copy");
  const introCharacterJump = document.querySelector("#intro-character-jump");
  const introArchitectureJump = document.querySelector("#intro-architecture-jump");
  const introArchitectureBack = document.querySelector("#intro-architecture-back");
  const introOpenDataExhibit = document.querySelector("#intro-open-data-exhibit");
  const introButton = document.querySelector("#intro-button");
  const japanButton = document.querySelector("#japan-button");
  const japanLayer = document.querySelector("#japan-layer");
  const japanMap = document.querySelector("#japan-map");
  const japanTiles = document.querySelector("#japan-tiles");
  const japanOverlay = document.querySelector("#japan-overlay");
  // Canvas annotations share the same typefaces as the surrounding map UI.
  const mapRootStyle = getComputedStyle(document.documentElement);
  const mapHeadingFont = mapRootStyle.getPropertyValue("--font-ja").trim() || '"Yu Mincho", serif';
  const mapMetricFont = mapHeadingFont;
  const mapUnitFont = mapHeadingFont;
  const mapZoomControls = document.querySelector("#gaia-map-zoom-controls");
  const mapZoomIn = document.querySelector("#gaia-map-zoom-in");
  const mapZoomOut = document.querySelector("#gaia-map-zoom-out");
  const mapZoomReset = document.querySelector("#gaia-map-zoom-reset");
  const japanMapStatus = document.querySelector("#japan-map-status");
  const mapScopeKicker = document.querySelector("#map-scope-kicker");
  const mapScopeNote = document.querySelector("#map-scope-note");
  const japanTitle = document.querySelector("#japan-title");
  const mapTitleTransition = document.querySelector("#map-title-transition");
  const mapTitleTransitionText = document.querySelector("#map-title-transition-text");
  const mapTitleTransitionSubtitle = document.querySelector("#map-title-transition-subtitle");
  const japanDescription = document.querySelector("#japan-description");
  const mapMobileHeadingToggle = document.querySelector("#map-mobile-heading-toggle");
  const japanModeBank = document.querySelector(".map-mode-bank");
  const mapMobileBankToggle = document.querySelector("#map-mobile-bank-toggle");
  const mapModePreview = document.querySelector("#map-mode-preview");
  const mapModePreviewNumber = document.querySelector("#map-mode-preview-number");
  const mapModePreviewLabel = document.querySelector("#map-mode-preview-label");
  const mapModePreviewCopy = document.querySelector("#map-mode-preview-copy");
  const japanModeList = document.querySelector("#japan-mode-list");
  const japanModeNumber = document.querySelector("#japan-mode-number");
  const japanModeTitle = document.querySelector("#japan-mode-title");
  const japanClose = document.querySelector("#japan-close");
  const japanDataButton = document.querySelector("#japan-data-button");
  const japanDataPanel = document.querySelector("#japan-data-panel");
  const japanDataClose = document.querySelector("#japan-data-close");
  const japanDataScrim = document.querySelector("#japan-data-scrim");
  const japanDataState = document.querySelector("#japan-data-state");
  const japanDataUpdated = document.querySelector("#japan-data-updated");
  const japanHistoryState = document.querySelector("#japan-history-state");
  const japanHistoryUpdated = document.querySelector("#japan-history-updated");
  const japanObservationKicker = document.querySelector("#japan-observation-kicker");
  const japanObservationCopy = document.querySelector("#japan-observation-copy");
  const mapGuideTitle = document.querySelector("#map-guide-title");
  const mapReadingGuide = document.querySelector("#map-reading-guide");
  const mapReadingGuideBody = mapReadingGuide?.querySelector(".map-reading-guide-body");
  const mapGuideSubject = document.querySelector("#map-guide-subject");
  const mapGuideReading = document.querySelector("#map-guide-reading");
  const mapGuideAction = document.querySelector("#map-guide-action");
  const co2TimelineDisplay = document.querySelector("#co2-timeline-display");
  const co2TimelinePhase = document.querySelector("#co2-timeline-phase");
  const co2TimelineYear = document.querySelector("#co2-timeline-year");
  const co2TimelinePpm = document.querySelector("#co2-timeline-ppm");
  const co2TimelineMethod = document.querySelector("#co2-timeline-method");
  const japanHistoryLayerButton = document.querySelector("#japan-history-layer");
  const japanLiveLayerButton = document.querySelector("#japan-live-layer");
  const historyLayerLabel = document.querySelector("#history-layer-label");
  const liveLayerLabel = document.querySelector("#live-layer-label");
  const japanPoiCard = document.querySelector("#japan-poi-card");
  const japanPoiClose = document.querySelector("#japan-poi-close");
  const japanPoiType = document.querySelector("#japan-poi-type");
  const japanPoiMeta = document.querySelector("#japan-poi-meta");
  const japanPoiHistory = document.querySelector("#japan-poi-history");
  const japanPoiSource = document.querySelector("#japan-poi-source");
  const japanPoiPreview = document.querySelector("#japan-poi-preview");
  const japanPoiPreviewKicker = document.querySelector("#japan-poi-preview-kicker");
  const japanPoiPreviewTitle = document.querySelector("#japan-poi-preview-title");
  const japanPoiPreviewMeta = document.querySelector("#japan-poi-preview-meta");
  const dataLedger = window.GaiaDataLedger.create();

  const TRAIL_COUNT = 16;
  // NOAA's MAP02 snapshot currently contains 79 POIs. Keep enough uniform
  // capacity for every visible point so the GPU never silently drops a brush
  // because it happened to be slower than another observation.
  const CURRENT_FIELD_SAMPLE_LIMIT = 96;
  const MODE_COUNT = 9;
  const TRANSITION_DURATION = 1500;
  const AUTO_INTERVAL = 18000;
  const CO2_TIMELINE_START_YEAR = 1958;
  const CO2_TIMELINE_END_YEAR = 2050;
  const CO2_TIMELINE_DURATION_MS = 60000;
  const CO2_EXPLORATION_TIMELINE_SPEED = 3;
  const STORY_MAP_TIMELINE_SPEED = 3;
  const STORY_MAP_FINAL_FRAME_MS = 650;
  const CO2_TIMELINE_STEPS_PER_YEAR = 4;
  const CO2_TIMELINE_MANUAL_PAUSE_MS = 8000;
  const CIRCULATION_TIMELINE_DURATION_MS = 45000;
  const CIRCULATION_TIMELINE_HOURS = 24 * 14;
  const CIRCULATION_TIMELINE_STEPS = 112;
  const MODE_SEQUENCE_DURATION_MS = 48000;
  const ECOLOGIES_SEQUENCE_DURATION_MS = MODE_SEQUENCE_DURATION_MS * 2;
  const ECOLOGIES_SELECTION_TRANSITION_MS = 920;
  const RENEWABLE_COUNTRY_DISPLAY_MS = 2400;
  const MODE_SEQUENCE_STEPS = 96;
  const MAP_TILE_SIZE = 256;
  const JAPAN_ZOOM = 5;
  const JAPAN_MOBILE_ZOOM = 4;
  const EARTH_ZOOM = 2;
  const EARTH_MOBILE_ZOOM = 1;
  // Keep in sync with src/exploration/world-projection.js: Japan near the
  // centre, with the Atlantic cut between South America and Africa.
  const EARTH_INITIAL_CENTER_LONGITUDE = 150;
  const BLUE_CIRCULATION_FOCUS = Object.freeze({
    label: "tokyo",
    lon: 139.6503,
    lat: 35.6762,
  });
  const EARTH_RADIUS_KM = 6371;
  const P_WAVE_SPEED_KM_S = 7;
  const S_WAVE_SPEED_KM_S = 4;
  const JAPAN_WAVE_VISUAL_LIMIT_KM = 2500;
  const GLOBAL_EARTHQUAKE_MIN_MAGNITUDE = 7.5;
  const GLOBAL_EARTHQUAKE_MAX_MAGNITUDE = 9.1;
  const GLOBAL_EARTHQUAKE_MIN_IMPACT_RADIUS_KM = 500;
  const GLOBAL_EARTHQUAKE_MAX_IMPACT_RADIUS_KM = 2000;
  const GLOBAL_EARTHQUAKE_WAVE_MIN_DURATION_MS = 2200;
  const GLOBAL_EARTHQUAKE_WAVE_MAX_DURATION_MS = 3600;
  const GLOBAL_EARTHQUAKE_EVENT_APPEAR_MS = 460;
  const GLOBAL_EARTHQUAKE_EVENT_EXIT_STAGGER_MS = 0;
  const GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS = 320;
  const GLOBAL_EARTHQUAKE_RING_DELAY_MS = 90;
  const GLOBAL_EARTHQUAKE_CAMERA_FLY_MS = 780;
  const GLOBAL_EARTHQUAKE_MARKER_DELAY_MS = 500;
  const GLOBAL_EARTHQUAKE_CALLOUT_DELAY_MS = 900;
  const GLOBAL_EARTHQUAKE_CALLOUT_FADE_MS = 260;
  const GLOBAL_EARTHQUAKE_APPEAR_LEAD_MS =
    GLOBAL_EARTHQUAKE_CAMERA_FLY_MS + GLOBAL_EARTHQUAKE_MARKER_DELAY_MS;
  const GLOBAL_EARTHQUAKE_EVENT_HOLD_MS = 2000;
  const GLOBAL_EARTHQUAKE_EVENT_STAGGER_MS =
    GLOBAL_EARTHQUAKE_APPEAR_LEAD_MS + GLOBAL_EARTHQUAKE_CALLOUT_DELAY_MS + GLOBAL_EARTHQUAKE_EVENT_HOLD_MS;
  const GLOBAL_EARTHQUAKE_CAMERA_RETURN_DELAY_MS =
    GLOBAL_EARTHQUAKE_EVENT_HOLD_MS +
    GLOBAL_EARTHQUAKE_CALLOUT_DELAY_MS -
    GLOBAL_EARTHQUAKE_EVENT_APPEAR_MS;
  const GLOBAL_EARTHQUAKE_CAMERA_RETURN_MS = 620;
  const GLOBAL_EARTHQUAKE_YEAR_BUFFER_MS = 200;
  const GLOBAL_EARTHQUAKE_INITIAL_LEAD_MS = 1600;
  const GLOBAL_EARTHQUAKE_CAMERA_DESKTOP_ZOOM = 3.05;
  const GLOBAL_EARTHQUAKE_CAMERA_MOBILE_ZOOM = 2.45;
  const GLOBAL_EARTHQUAKE_YEAR_COUNT = 27;
  const ANTHROPOCENE_EMISSIONS_SCALE_MT = 12000;
  const JAPAN_HISTORY_CARD_DELAY = 8000;
  const OVATION_AURORA_LIVE_DATA = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
  const OVATION_AURORA_FALLBACK_DATA = "./data/ovation-aurora-snapshot.json?v=gaia-ovation-aurora-1";
  const OVATION_AURORA_REFRESH_MS = 5 * 60 * 1000;
  const NATURAL_EARTH_LAND_DATA = "./data/natural-earth-50m-land.geojson?v=gaia-27";
  const NATURAL_EARTH_COUNTRY_DATA = "./data/natural-earth-50m-countries.geojson?v=gaia-1";
  const JAPAN_PREFECTURE_DATA = "./data/japan-prefectures.topojson?v=gaia-prefecture-boundaries-1";

  const MAP_READING_GUIDES = [
    {
      title: "CO₂の長い変化と、いまのオーロラ",
      subject: "CO₂の記録と2050年の試算に、\nNOAAの30〜90分先の\nオーロラ予報を重ねます。",
      reading: "地図色はCO₂、極域の光は\nオーロラ予報。斜線の値は\n周辺8地点からの補完です。",
      action: "年表示・マスでCO₂を操作。\nオーロラは5分ごとに更新。\n雲・地上の見え方は対象外。",
    },
    {
      title: "この海流は、14日でどこまで進む？",
      subject: "色付きの矢印が海流です。点から伸びる線は、同じ速さと向きが続くと仮定した移動先です。右下の「○日後」と一緒に読みます。",
      reading: "青→水色→黄→橙の順に海流が速くなります。背景の帯は観測点の間を補間した流れのイメージで、予報や実測の軌跡ではありません。白い矢印は比較用の風です。",
      action: "色付きの点を押すと自動再生が止まり、その地点の速さ・向き・○日後の計算距離を読めます。スライダーでも日数を動かせます。",
    },
    {
      title: "森林と、雨の多い場所はどこで重なる？",
      subject: "緑の森林分布と、世界の国・地域に広げた参照地点の平均降水量を見比べます。国平均や、森林が雨を起こす因果関係を示す図ではありません。",
      reading: "大きな水色円が降水量です。直径が大きいほど雨が多く、雨の多い円にはmm/日を直接表示します。ブラジルのアマゾン付近は5.33 mm/日です。",
      action: "水色円を押すと自動走査が止まり、参照地点名と平均降水量をカードで読めます。円のない場所は『雨がない』のではなく、この資料では表示していない場所です。",
    },
    {
      title: "再資源化率は、国ごとにどう違うのか？",
      subject: "各国の再資源化率を、国土の青の明るさで比べます。国連の公表値に、世界銀行の再資源化向け回収率を補足しています。",
      reading: "国土の青が明るいほど再資源化率が高く、0〜100%の同じ色尺度で比べます。無着色は未収録で、0%とは異なります。報告年は国・地域で異なります。",
      action: "左右ボタンかスライダーで国・地域を切り替えます。国土を押すと、割合、資料の年、出典・対象範囲を確認できます。未収録はゼロや推定値で埋めません。年度・定義が異なるため厳密な順位にはできません。",
    },
    {
      title: "化石燃料由来CO₂は、1945年からどこで増えたのか？",
      subject: "Global Carbon Projectの国別化石燃料由来CO₂を1945〜2023年で送り、NASA VIIRS 2016の夜間光を固定参照として重ねます。",
      reading: "国土の色は選択年の国全体の化石燃料由来CO₂です。全年度共通の固定対数尺度で、濃紺→紫→赤→橙→淡黄の順に排出量が多くなります。白い発光は2016年固定です。",
      action: "スライダーで年を動かし、色の付いた国土を押して一つの国を追えます。地図を0.65秒以上長押しすると、白い夜間光だけが6秒間薄れます。",
    },
    {
      title: "大地震は、年ごとに世界のどこで起きたのか？",
      subject: "世界表示を基準に、USGSが記録した2000〜2026年のM7.5以上を年度ごとに切り替えます。別年度の震源は同時表示しません。",
      reading: "橙の点がその年の震源です。年度が変わるたび全点から輪がゆっくり広がり、Magnitudeから見積もった可感半径の目安で止まります。M7.5は約500km、M9.1は約2,000kmです。",
      action: "2000〜2026年を約4.6秒ずつ自動再生します。スライダーで年度を切り替えるか、震源を押して日付・深さ・Magnitudeを読めます。輪は推定可感半径で、実際の震度分布・被害範囲・津波範囲ではありません。日本の実測震度は別層です。",
    },
    {
      title: "都市人口率が高い国は、森が少ない？",
      subject: "まず都市人口率が最も近い二国を比べ、両指標のある世界の国・地域の傾向、文化・記憶の順に見ていきます。",
      reading: "緑の棒は陸地に占める森林率、青の棒は人口に占める都市居住者の割合です。散布図・回帰線・相関係数rは「関係を見る」へ。文化・記憶は別タブです。",
      action: "地図の棒か国の選択欄で比較し、散布図の点からも選べます。国は自動では切り替わりません。自動で比べる場合は再生ボタンを押します。",
    },
    {
      title: "再生可能エネルギーの発電割合は、どの国で高いか？",
      subject: "31か国の総発電量に占める再生可能エネルギーの割合を、国土の青い濃淡で直接比べる地図です。",
      reading: "暗い青ほど比率が低く、明るい水色ほど高い国です。黄色い輪と緑の矢印は選択国の代表地点の日射・風で、国の青色とは別の自然条件です。",
      action: "自動再生とスライダーは、発電割合の高い国から低い国へ進みます。青く塗られた国の代表点を押して現在値も読めます。二地点を結ぶ仮想線は廃止しました。",
    },
    {
      title: "人口の重心は、1960年からどこへ動いたのか？",
      subject: "世界銀行の217の国・地域を対象に、1960〜2025年の人口を全年共通の面積尺度で比べます。欠測年は表示しません。",
      reading: "淡青の円は選択年の国別人口です。円の面積が人口に比例します。国の代表位置に置いた比較円で、都市位置や人口密度ではありません。",
      action: "スライダーで年を動かし、円を押して選んだ国の人口を年ごとに追えます。人口の多さを豊かさや環境負荷へは変換しません。",
    },
  ];
  const JMA_HISTORY_DATA = "./data/jma-intensity-history.json";
  const JAPAN_DATA_BOUNDS = {
    west: 122,
    east: 154,
    south: 20,
    north: 48,
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const supportsHover = window.matchMedia("(hover: hover)").matches;
  const usesCompactMapUi = () => window.innerWidth <= 720 || (window.innerHeight <= 520 && coarsePointer);
  const usesCompactMapBank = () => window.innerWidth <= 900;
  const resolveMapOverlayQuality = () => {
    const memory = Number(navigator.deviceMemory) || 0;
    const cores = Number(navigator.hardwareConcurrency) || 0;
    const saveData = navigator.connection?.saveData === true;
    const constrained = saveData
      || (memory > 0 && memory <= 4)
      || (cores > 0 && cores <= 4);
    const nativeQuality = memory >= 8 && cores >= 8;

    if (constrained) {
      return {
        tier: "compact",
        ratioCap: 1,
        maxPixels: coarsePointer ? 650000 : 1600000,
      };
    }
    if (nativeQuality) {
      return { tier: "native", ratioCap: 3, maxPixels: 9000000 };
    }
    return {
      tier: "balanced",
      ratioCap: 2,
      maxPixels: coarsePointer ? 3200000 : 5000000,
    };
  };
  const mapOverlayQuality = resolveMapOverlayQuality();
  const runSceneTransition = (swapScene, tone = "default", event = null) => {
    const hasPointerOrigin = Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY) &&
      (event.clientX !== 0 || event.clientY !== 0);
    const transition = window.GaiaSceneTransition;
    if (!transition) return Promise.resolve(swapScene());
    return transition.run(swapScene, {
      tone,
      origin: hasPointerOrigin ? { x: event.clientX, y: event.clientY } : undefined,
    });
  };
  const MAP_POI_HIT_RADII = {
    fine: { history: 34, earthquake: 30, node: 32 },
    coarse: { history: 46, earthquake: 42, node: 44 },
  };
  const japanNativeContext = japanOverlay.getContext("2d");
  const japanContext = globalThis.GaiaI18nCanvas?.context(japanNativeContext) || japanNativeContext;
  const countryHitTestContext = document.createElement("canvas").getContext("2d");
  const gosatHeatmapCanvas = document.createElement("canvas");
  const gosatHeatmapContext = gosatHeatmapCanvas.getContext("2d");
  const ovationAuroraCanvas = document.createElement("canvas");
  const ovationAuroraContext = ovationAuroraCanvas.getContext("2d");
  const ovationAuroraRawCanvas = document.createElement("canvas");
  const ovationAuroraRawContext = ovationAuroraRawCanvas.getContext("2d");
  const referenceWorldCanvas = document.createElement("canvas");
  const referenceWorldContext = referenceWorldCanvas.getContext("2d");
  const japanPoiFocusCanvas = document.createElement("canvas");
  const japanPoiFocusContext = japanPoiFocusCanvas.getContext("2d");
  let gosatHeatmapCacheKey = "";
  let referenceWorldCacheKey = "";
  const gosatImputedIndexCache = new WeakMap();

  const appContent = window.GaiaAppContent;
  if (!appContent) {
    throw new Error("app-content.js must load before app.js");
  }
  const {
    JAPAN_NODES,
    JMA_CO2_SITES,
    EARTH_NODES,
    SIMPLE_WORLD_LANDMASSES,
    SIMPLE_WORLD_ISLAND_LINES,
    JMA_EVENT_TITLES,
    INTRO_PATHS,
    INTRO_MODE_CHOICES,
    MAP_MODE_DESCRIPTIONS,
    MAP_TITLE_SUBTITLES,
    SPACE_MODE_CHOICES,
    modes,
    modeConcepts,
    modeDataNarratives,
    lectureResumeLinks,
  } = appContent;
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    globalThis.GaiaFrameBudgetGovernor?.reportFailure?.("webgl-unavailable");
    errorPanel.hidden = false;
    globalThis.GaiaMapObservationAdapter = Object.freeze({
      waitSignalsReady: () => Promise.reject(new Error("WebGL2 unavailable")),
      selectMode: () => false,
      setSignalTime: () => 0,
      focusEarthLocation: () => false,
      zoomEarthBy: () => false,
      zoomEarthAtLocation: () => false,
      openMap: () => false,
      closeMap: () => false,
      showIntro: () => { errorPanel.hidden = false; },
      focusControl: () => false,
      clearFocus: () => {},
      openSourceTab: () => false,
      closeSource: () => {},
      getTourReceipt: () => { throw new Error("WebGL2 unavailable"); },
      getState: () => ({ fallback: true, mapOpen: false, introOpen: false }),
    });
    window.dispatchEvent(new CustomEvent("gaia:map-adapter-ready", { detail: { fallback: true } }));
    document.documentElement.dataset.gaiaAppReady = "fallback";
    window.dispatchEvent(new CustomEvent("gaia:app-ready", { detail: { fallback: true } }));
    return;
  }
  const parallelShaderCompile = gl.getExtension("KHR_parallel_shader_compile");

  const vertexSource = `#version 300 es
    in vec2 aPosition;

    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentSource = `#version 300 es
    precision highp float;
    precision highp int;

    out vec4 fragColor;

    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec4 uPointer;
    uniform vec2 uVelocity;
    uniform vec4 uTrail[${TRAIL_COUNT}];
    uniform float uTrailActive;
    uniform float uModeMemory[${MODE_COUNT}];
    uniform int uModeFrom;
    uniform int uModeTo;
    uniform float uTransition;
    uniform vec4 uSignal;
    uniform float uSourceSignals[9];
    uniform vec4 uCurrentSamples[${CURRENT_FIELD_SAMPLE_LIMIT}];
    uniform int uCurrentSampleCount;
    uniform sampler2D uCurrentVectorField;
    uniform sampler2D uCurrentWeave;
    uniform vec3 uCurrentGeoView;
    uniform float uCurrentWeaveReady;

    mat2 rot(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c);
    }

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    vec2 hash22(vec2 p) {
      float n = hash21(p);
      return vec2(n, hash21(p + n + 19.19));
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += noise(p) * amplitude;
        p = rot(0.72) * p * 2.03 + 17.3;
        amplitude *= 0.52;
      }
      return value;
    }

    float lineGlow(float value, float width) {
      return exp(-abs(value) / max(width, 0.0001));
    }

    float sdSegment(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float denominator = max(dot(ba, ba), 0.0001);
      float h = clamp(dot(pa, ba) / denominator, 0.0, 1.0);
      return length(pa - ba * h);
    }

    vec2 toScene(vec2 normalizedPoint) {
      vec2 pixelPoint = normalizedPoint * uResolution;
      return (pixelPoint * 2.0 - uResolution) / uResolution.y;
    }

    vec3 baseGradient(vec2 p, vec3 tint) {
      float radial = length(p * vec2(0.72, 1.0));
      float haze = fbm(p * vec2(0.72, 0.54) + 6.7);
      vec3 deep = vec3(0.002, 0.006, 0.012);
      vec3 color = mix(deep, tint, haze * 0.34 + 0.04);
      color += tint * max(0.0, 1.0 - radial) * 0.08;
      return color;
    }

    vec2 trailResponse(vec2 p) {
      if (uTrailActive < 0.5) return vec2(0.0);
      float bloomField = 0.0;
      float ringField = 0.0;
      for (int i = 0; i < ${TRAIL_COUNT}; i++) {
        vec4 trailPoint = uTrail[i];
        vec2 point = toScene(trailPoint.xy);
        float age = trailPoint.z;
        float strength = trailPoint.w;
        float life = 1.0 - smoothstep(0.12, 3.1, age);
        vec2 local = p - point;
        float bloom = exp(-dot(local, local) * (31.0 + age * 9.0));
        float ringRadius = age * (0.2 + strength * 0.045);
        float ring = lineGlow(length(local) - ringRadius, 0.015 + age * 0.007);
        bloomField += bloom * life * strength * 0.2;
        ringField += ring * life * strength * 0.12;
      }

      if (uPointer.z > 0.0) {
        vec2 local = p - toScene(uPointer.xy);
        bloomField += exp(-dot(local, local) * 24.0) * (0.28 + uPointer.w * 0.24);
        ringField += lineGlow(length(local) - 0.09, 0.018) * 0.12;
      }

      return vec2(bloomField, ringField);
    }

    ${modes.map((mode) => mode.source).join("\n\n    ")}

    vec3 evaluateMode(int mode, vec2 p, float t, vec2 response) {
      if (mode == 0) return modeBreathingEarth(p, t, response, uModeMemory[0]);
      if (mode == 1) return modeBlueCirculation(p, t, response, uModeMemory[1]);
      if (mode == 2) return modeForestCloudEngine(p, t, response, uModeMemory[2]);
      if (mode == 3) return modeNothingIsWaste(p, t, response, uModeMemory[3]);
      if (mode == 4) return modeAnthropoceneScar(p, t, response, uModeMemory[4]);
      if (mode == 5) return modeRhythmOfDisaster(p, t, response, uModeMemory[5]);
      if (mode == 6) return modeThreeEcologies(p, t, response, uModeMemory[6]);
      if (mode == 7) return modeEarthOrgan(p, t, response, uModeMemory[7]);
      return modePopulationTide(p, t, response, uModeMemory[8]);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
      vec2 response = trailResponse(uv);
      vec2 dataResponse = response + uSignal.zw * 0.08;
      float signalTime = uTime + uSignal.y * 1.6;
      vec3 color = evaluateMode(uModeFrom, uv, signalTime, dataResponse);
      if (uModeFrom != uModeTo) {
        vec3 toColor = evaluateMode(uModeTo, uv, signalTime, dataResponse);
        color = mix(color, toColor, smoothstep(0.0, 1.0, uTransition));
      }
      color *= 0.84 + uSignal.x * 0.32;
      color += vec3(uSignal.y * 0.025, uSignal.z * 0.02, uSignal.w * 0.025);

      float radial = length(uv * vec2(0.72, 1.0));
      float vignette = smoothstep(1.78, 0.4, radial);
      float grainTime = uTime * 12.0;
      float grainFrame = floor(grainTime);
      float grainBlend = smoothstep(0.0, 1.0, fract(grainTime));
      float grain = mix(
        hash21(gl_FragCoord.xy + grainFrame),
        hash21(gl_FragCoord.xy + grainFrame + 1.0),
        grainBlend
      ) - 0.5;
      color *= mix(0.48, 1.0, vignette);
      color += grain * 0.008;
      color = color / (vec3(1.0) + color * 0.42);
      color = pow(max(color, 0.0), vec3(0.88));

      fragColor = vec4(color, 1.0);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };

  const createProgram = async () => {
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const nextProgram = gl.createProgram();

    gl.attachShader(nextProgram, vertexShader);
    gl.attachShader(nextProgram, fragmentShader);
    gl.linkProgram(nextProgram);

    // Querying COMPILE_STATUS or LINK_STATUS immediately forces Chromium to
    // wait for the GPU process. The full ten-mode shader can take seconds on
    // software or older GPUs, freezing the sound prompt before first input.
    // KHR_parallel_shader_compile lets the browser finish in the background;
    // yielding a timer turn also keeps parsing, layout, and input responsive.
    if (parallelShaderCompile) {
      while (!gl.getProgramParameter(nextProgram, parallelShaderCompile.COMPLETION_STATUS_KHR)) {
        await new Promise((resolve) => window.setTimeout(resolve, 16));
      }
    }

    const shaderError = [vertexShader, fragmentShader]
      .find((shader) => !gl.getShaderParameter(shader, gl.COMPILE_STATUS));
    if (shaderError) {
      const message = gl.getShaderInfoLog(shaderError) || "Shader compilation failed.";
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(nextProgram);
      throw new Error(message);
    }

    if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(nextProgram) || "Shader link failed.";
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(nextProgram);
      throw new Error(message);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return nextProgram;
  };

  let program;

  try {
    program = await createProgram();
  } catch (error) {
    console.error(error);
    errorPanel.querySelector("p").textContent = "シェーダーの初期化に失敗しました。";
    errorPanel.querySelector("small").textContent = error.message;
    errorPanel.hidden = false;
    return;
  }

  const fullscreenTriangle = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenTriangle);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    pointer: gl.getUniformLocation(program, "uPointer"),
    velocity: gl.getUniformLocation(program, "uVelocity"),
    trail: gl.getUniformLocation(program, "uTrail[0]"),
    trailActive: gl.getUniformLocation(program, "uTrailActive"),
    modeMemory: gl.getUniformLocation(program, "uModeMemory[0]"),
    modeFrom: gl.getUniformLocation(program, "uModeFrom"),
    modeTo: gl.getUniformLocation(program, "uModeTo"),
    transition: gl.getUniformLocation(program, "uTransition"),
    signal: gl.getUniformLocation(program, "uSignal"),
    sourceSignals: gl.getUniformLocation(program, "uSourceSignals[0]"),
    currentSamples: gl.getUniformLocation(program, "uCurrentSamples[0]"),
    currentSampleCount: gl.getUniformLocation(program, "uCurrentSampleCount"),
    currentVectorField: gl.getUniformLocation(program, "uCurrentVectorField"),
    currentWeave: gl.getUniformLocation(program, "uCurrentWeave"),
    currentGeoView: gl.getUniformLocation(program, "uCurrentGeoView"),
    currentWeaveReady: gl.getUniformLocation(program, "uCurrentWeaveReady"),
  };

  // Geographic textures are generated once per data snapshot in a worker.
  // Pan, zoom and the date slider only change uniforms; they never rebuild it.
  const createCurrentTexture = (unit, floating) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, floating ? gl.RGBA16F : gl.RGBA,
      1, 1, 0, gl.RGBA, floating ? gl.FLOAT : gl.UNSIGNED_BYTE,
      floating ? new Float32Array(4) : new Uint8Array(4));
    return texture;
  };
  const currentVectorTexture = createCurrentTexture(0, true);
  const currentWeaveTexture = createCurrentTexture(1, false);
  let currentWeaveRows = null;
  let currentWeaveWorker = null;
  let currentWeaveGeneration = 0;
  let currentWeaveReadyAt = Infinity;
  const prepareCurrentWeave = (rows) => {
    if (rows === currentWeaveRows || !rows.length) return;
    if (naturalEarthLandState !== "ready") return;
    currentWeaveRows = rows;
    currentWeaveReadyAt = Infinity;
    currentWeaveWorker?.terminate();
    const generation = ++currentWeaveGeneration;
    canvas.dataset.currentWeaveState = "building";
    try {
      const worker = new Worker("./current-flow-worker.js?v=gaia-current-weave-1", { type: "module" });
      currentWeaveWorker = worker;
      worker.onmessage = ({ data }) => {
        if (data.generation !== currentWeaveGeneration) return;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, currentVectorTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, data.field.width, data.field.height,
          0, gl.RGBA, gl.FLOAT, data.field.data);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, currentWeaveTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, data.weave.width, data.weave.height,
          0, gl.RGBA, gl.UNSIGNED_BYTE, data.weave.data);
        currentWeaveReadyAt = performance.now();
        canvas.dataset.currentWeaveState = "ready";
        canvas.dataset.currentWeaveGeneration = String(generation);
        canvas.dataset.currentWeaveBuildMs = data.buildMs.toFixed(1);
        canvas.dataset.currentWeaveSourceCount = String(data.field.sampleCount);
        canvas.dataset.currentWeaveSize = `${data.weave.width}x${data.weave.height}`;
        canvas.dataset.currentWeaveMethod = "cached-rk2-streamline-convolution";
        worker.terminate();
        currentWeaveWorker = null;
      };
      worker.onerror = () => {
        canvas.dataset.currentWeaveState = "unavailable";
        worker.terminate();
        currentWeaveWorker = null;
      };
      worker.postMessage({ rows, generation, landRings: naturalEarthLandRings });
    } catch {
      // Keep the original measured brushes available when workers are blocked.
      canvas.dataset.currentWeaveState = "unavailable";
    }
  };

  const pointer = {
    id: null,
    x: 0.5,
    y: 0.5,
    down: false,
    energy: 0,
    velocityX: 0,
    velocityY: 0,
    previousX: 0.5,
    previousY: 0.5,
    previousTime: performance.now(),
  };

  const trail = Array.from({ length: TRAIL_COUNT }, () => ({
    x: -10,
    y: -10,
    bornAt: -100,
    strength: 0,
  }));

  const modeMemory = new Float32Array(MODE_COUNT);
  const trailData = new Float32Array(TRAIL_COUNT * 4);
  const modeButtons = [];
  const introModeButtons = [];
  const conceptModeButtons = [];
  const japanModeButtons = [];
  const japanTileElements = new Map();
  const japanPulses = [];
  let japanEarthquakes = [];
  let japanHistoryEvents = [];
  let trailCursor = 0;
  let previousTrailX = -10;
  let previousTrailY = -10;
  let lastTrailAt = 0;
  let animationFrame = 0;
  let startTime = performance.now();
  let hiddenAt = 0;
  let hiddenDuration = 0;
  let sourceIsOpen = false;
  let conceptIsOpen = false;
  let introIsOpen = false;
  let introStage = "path";
  let introSelectedPath = null;
  let introRestoreFocus = false;
  let introCloseTimer = 0;
  let introStoryRevealStartTimer = 0;
  let introStoryRevealCommitTimer = 0;
  let introStoryRevealSettleTimer = 0;
  let introStoryRevealObserver = null;
  let introApeironceneRevealed = false;
  let introRevealGeneration = 0;
  let introScrambleGeneration = 0;
  const introRevealTimers = new Set();
  let japanIsOpen = false;
  let japanDataIsOpen = false;
  let japanDataReturnFocus = null;
  let japanRestoreFocus = true;
  let japanCloseTimer = 0;
  let japanTilesDirty = true;
  let mapPlotRevealStartedAt = performance.now();
  let mapPlotRevealBlockedUntil = 0;
  let mapPlotRevealGeneration = 0;
  let mapPlotRevealReason = "initial";
  const forestRasterReveal = { generation: -1, startedAt: null };
  const ecologiesSelectionTransition = {
    generation: -1,
    currentIso3: "",
    previousIso3: "",
    changedAt: performance.now(),
  };
  const earthquakeYearTransition = {
    generation: -1,
    currentYear: "",
    currentEvents: [],
    pendingYear: "",
    pendingEvents: [],
    phase: "enter",
    exitStartReveals: [],
    exitOrderIndices: [],
    changedAt: performance.now(),
  };
  const earthquakeCameraSequence = {
    generation: -1,
    year: "",
    phase: "idle",
    activeIndex: -1,
    activeEventId: "",
    arrivals: new Map(),
    completedAt: 0,
    returned: false,
    suppressed: false,
  };
  const earthquakePlaybackScheduleCache = new WeakMap();
  let nextJapanOverlayRenderAt = 0;
  let lastJapanOverlayTargetFps = 60;
  const STATIC_MAP_FRAME_INTERVAL_MS = 500;
  let nextShaderRenderAt = 0;
  let lastShaderTargetFps = 60;
  let japanTileErrors = 0;
  let japanEarthquakeDataState = "idle";
  let japanHistoryDataState = "idle";
  let japanDataLayer = "history";
  let storyModeDetour = null;
  let storyModeGlobalSignalConsoleState = null;
  let storyMapTimelineCompleted = false;
  let storyMapReturnTimer = 0;
  let storyMapAivaBackdrop = null;
  let storyMapAivaRuntime = null;
  let mapScope = "earth";
  let japanDataUpdatedAt = null;
  let japanHistoryUpdatedAt = null;
  let selectedJapanPoi = null;
  let japanPoiHistoryRequest = 0;
  let hoveredJapanPoi = null;
  let hoveredJapanPoiKey = "";
  let hoveredJapanPoiContent = "";
  let hoveredJapanPoiStartedAt = 0;
  let japanWaveReplay = null;
  let gaiaSnapshot = null;
  let gaiaSnapshotError = null;
  let gaiaModeById = new Map();
  let ovationAuroraState = {
    status: "loading",
    source: "pending",
    observationTime: "",
    forecastTime: "",
    pointCount: 0,
    maximum: 0,
  };
  let ovationAuroraReloadTimer = 0;
  const gaiaSignalLoads = new Map();
  let gaiaAllSignalsLoaded = false;
  let naturalEarthLandState = "loading";
  let naturalEarthLandError = null;
  let naturalEarthLandRings = [];
  const naturalEarthPathCache = new Map();
  let naturalEarthCountryState = "loading";
  let naturalEarthCountryError = null;
  let naturalEarthCountryRings = new Map();
  let naturalEarthCountryRecords = Object.freeze([]);
  let naturalEarthCountryBoundaryRings = [];
  const naturalEarthCountryPathCache = new Map();
  let japanPrefectureBoundaryState = "loading";
  let japanPrefectureBoundaryError = null;
  let japanPrefectureBoundaryArcs = [];
  const japanPrefectureBoundaryPathCache = new Map();
  let signalTimePosition = 100;
  let co2TimelineStartedAt = performance.now();
  let co2TimelinePausedUntil = 0;
  let co2TimelineLastStep = -1;
  let co2TimelineHeld = false;
  let mapTimelineManuallyPaused = false;
  let mapTimelineExplicitPlayback = false;
  const requestedSourceTab = new URLSearchParams(window.location.search).get("code");
  let activeSourceTab = ["visual", "transform", "raw"].includes(requestedSourceTab)
    ? requestedSourceTab
    : "visual";
  let anthropocenePeelUntil = 0;
  let anthropoceneSelectedIso3 = "JPN";
  let populationSelectedIso3 = "JPN";
  // Presentation-only count: retain exact source values for analysis/export.
  let populationCount = { key: '', from: 0, target: 0, at: 0, frame: 0 };
  const animatedPopulation = (row) => {
    const target = Number(row?.population);
    if (!Number.isFinite(target)) return target;
    const now = performance.now();
    const valueAt = () => {
      const p = reducedMotion ? 1 : clamp((now - populationCount.at) / 760, 0, 1);
      const eased = p === 1 ? 1 : Math.floor((1 - (1-p) ** 3) * 32) / 32;
      return Math.round(populationCount.from + (populationCount.target - populationCount.from) * eased);
    };
    const key = `${row.iso3}:${row.year}:${target}`;
    if (populationCount.key !== key) {
      const from = populationCount.key ? valueAt() : 0;
      cancelAnimationFrame(populationCount.frame);
      populationCount = { key, from, target, at: now, frame: 0 };
      const tick = () => {
        if (getActiveSignalMode()?.id !== 'population-tide') return;
        const value = animatedPopulation(row);
        japanLayer.querySelectorAll('.signal-value-primary > span').forEach(el => { el.textContent = formatObservationNumber(value, 0); });
        if (!reducedMotion && performance.now() - populationCount.at < 760) populationCount.frame = requestAnimationFrame(tick);
      };
      populationCount.frame = requestAnimationFrame(tick);
    }
    return valueAt();
  };
  let ecologiesView = "compare";
  let ecologiesPlaying = false;
  let ecologiesCultureIndex = 0;
  let wasteSelectedIndex = 0;
  let timelineDisplayTransitionKey = "";
  let japanPoiRevealTimer = 0;
  let japanDeepLinkHandled = false;
  let mapHasOpened = false;
  let earthViewAnimationFrame = 0;
  let earthViewAnimationTimer = 0;
  let autoEnabled = false;
  let nextAutoAt = performance.now() + AUTO_INTERVAL;
  const requestedModeNumber = Number.parseInt(new URLSearchParams(window.location.search).get("mode"), 10);
  const initialModeIndex = Number.isFinite(requestedModeNumber)
    ? Math.min(MODE_COUNT - 1, Math.max(0, requestedModeNumber - 1))
    : 0;
  let modeFromIndex = initialModeIndex;
  let modeToIndex = initialModeIndex;
  let mapModeIndex = initialModeIndex;
  let transitionStartedAt = performance.now();
  const getThemeIndex = (index = modeToIndex) => index;
  const isTheme = (themeIndex, index = modeToIndex) => getThemeIndex(index) === themeIndex;
  const japanView = {
    zoom: JAPAN_ZOOM,
    centerX: 0,
    centerY: 0,
    earthZoom: 1,
    earthOffsetX: 0,
    earthOffsetY: 0,
    pointerId: null,
    pointers: new Map(),
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    dragged: false,
    gesture: false,
    pinchDistance: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,
    pressStartedAt: 0,
    width: 0,
    height: 0,
    earthProjection: null,
  };

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const getEcologiesSelectionTransition = (rows, selected, now) => {
    const nextIso3 = selected?.iso3 || "";
    if (
      ecologiesSelectionTransition.generation !== mapPlotRevealGeneration
      || !ecologiesSelectionTransition.currentIso3
    ) {
      ecologiesSelectionTransition.generation = mapPlotRevealGeneration;
      ecologiesSelectionTransition.currentIso3 = nextIso3;
      ecologiesSelectionTransition.previousIso3 = "";
      ecologiesSelectionTransition.changedAt = now - ECOLOGIES_SELECTION_TRANSITION_MS;
    } else if (nextIso3 && nextIso3 !== ecologiesSelectionTransition.currentIso3) {
      ecologiesSelectionTransition.previousIso3 = ecologiesSelectionTransition.currentIso3;
      ecologiesSelectionTransition.currentIso3 = nextIso3;
      ecologiesSelectionTransition.changedAt = now;
    }

    const linearProgress = reducedMotion
      ? 1
      : clamp((now - ecologiesSelectionTransition.changedAt) / ECOLOGIES_SELECTION_TRANSITION_MS, 0, 1);
    const progress = linearProgress * linearProgress * (3 - 2 * linearProgress);
    const previousIso3 = linearProgress < 1 ? ecologiesSelectionTransition.previousIso3 : "";
    if (linearProgress >= 1) ecologiesSelectionTransition.previousIso3 = "";
    return {
      progress,
      currentIso3: ecologiesSelectionTransition.currentIso3,
      previousIso3,
      current: rows.find((row) => row.iso3 === ecologiesSelectionTransition.currentIso3) || selected,
      previous: rows.find((row) => row.iso3 === previousIso3) || null,
    };
  };
  const compareEarthquakeOccurrence = (a, b) => (
    String(a?.occurredAt || "").localeCompare(String(b?.occurredAt || ""))
    || String(a?.id || "").localeCompare(String(b?.id || ""))
  );
  const getEarthquakeStaggerDuration = (eventCount, staggerMs, animationMs) => Math.max(
    animationMs,
    Math.max(0, eventCount - 1) * staggerMs + animationMs,
  );
  const getGlobalEarthquakePlaybackSchedule = (events = []) => {
    const rows = Array.isArray(events) ? events : [];
    const cached = earthquakePlaybackScheduleCache.get(rows);
    if (cached) return cached;
    const years = [...new Set(
      rows.map((row) => String(row?.occurredAt || "").slice(0, 4)).filter(Boolean),
    )].sort((a, b) => Number(a) - Number(b));
    const counts = new Map(years.map((year) => [
      year,
      rows.filter((row) => String(row?.occurredAt || "").startsWith(year)).length,
    ]));
    let cursorMs = 0;
    const entries = years.map((year, index) => {
      const eventCount = counts.get(year) || 0;
      const previousEventCount = index > 0 ? counts.get(years[index - 1]) || 0 : 0;
      const exitDurationMs = index > 0
        ? getEarthquakeStaggerDuration(
          previousEventCount,
          GLOBAL_EARTHQUAKE_EVENT_EXIT_STAGGER_MS,
          GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS,
        )
        : GLOBAL_EARTHQUAKE_INITIAL_LEAD_MS;
      const enterDurationMs = getEarthquakeStaggerDuration(
        eventCount,
        GLOBAL_EARTHQUAKE_EVENT_STAGGER_MS,
        GLOBAL_EARTHQUAKE_APPEAR_LEAD_MS + GLOBAL_EARTHQUAKE_EVENT_APPEAR_MS,
      );
      const durationMs = exitDurationMs
        + enterDurationMs
        + GLOBAL_EARTHQUAKE_CAMERA_RETURN_DELAY_MS
        + GLOBAL_EARTHQUAKE_CAMERA_RETURN_MS
        + GLOBAL_EARTHQUAKE_YEAR_BUFFER_MS;
      const entry = {
        index,
        year,
        eventCount,
        startMs: cursorMs,
        durationMs,
        endMs: cursorMs + durationMs,
      };
      cursorMs += durationMs;
      return entry;
    });
    const schedule = { years, entries, durationMs: Math.max(1, cursorMs) };
    earthquakePlaybackScheduleCache.set(rows, schedule);
    return schedule;
  };
  const getGlobalEarthquakePlaybackEntry = (signalMode, position = signalTimePosition) => {
    const schedule = getGlobalEarthquakePlaybackSchedule(signalMode?.signals?.globalEvents || []);
    const index = schedule.entries.length
      ? Math.min(
        schedule.entries.length - 1,
        Math.floor((clamp(position, 0, 99.999) / 100) * schedule.entries.length),
      )
      : 0;
    return { schedule, entry: schedule.entries[index] || null };
  };
  const getEarthquakeEnterReveals = (events, changedAt, now) => {
    const durationMs = getEarthquakeStaggerDuration(
      events.length,
      GLOBAL_EARTHQUAKE_EVENT_STAGGER_MS,
      GLOBAL_EARTHQUAKE_APPEAR_LEAD_MS + GLOBAL_EARTHQUAKE_EVENT_APPEAR_MS,
    );
    const eventReveals = events.map((event, index) => {
      const localElapsedMs = reducedMotion
        ? durationMs
        : now - changedAt - index * GLOBAL_EARTHQUAKE_EVENT_STAGGER_MS;
      const sequenceMatches = earthquakeCameraSequence.generation === earthquakeYearTransition.generation
        && earthquakeCameraSequence.year === earthquakeYearTransition.currentYear;
      const arrivedAt = sequenceMatches ? earthquakeCameraSequence.arrivals.get(index) : undefined;
      // Camera completion, not its nominal duration, starts the half-second pause.
      const markerElapsedMs = earthquakeCameraSequence.suppressed
        ? localElapsedMs - GLOBAL_EARTHQUAKE_APPEAR_LEAD_MS
        : arrivedAt === undefined ? -Infinity : now - arrivedAt - GLOBAL_EARTHQUAKE_MARKER_DELAY_MS;
      const progress = reducedMotion
        ? 1
        : clamp(markerElapsedMs / GLOBAL_EARTHQUAKE_EVENT_APPEAR_MS, 0, 1);
      const labelProgress = reducedMotion ? 1 : clamp(
        (markerElapsedMs - GLOBAL_EARTHQUAKE_CALLOUT_DELAY_MS) / GLOBAL_EARTHQUAKE_CALLOUT_FADE_MS, 0, 1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      const bounce = Math.sin(progress * Math.PI) * (1 - progress) * 0.2;
      return {
        event,
        index,
        phase: "enter",
        started: localElapsedMs >= 0,
        progress,
        labelAlpha: 1 - Math.pow(1 - labelProgress, 3),
        alpha: clamp(progress * 2.35, 0, 1),
        scale: 0.14 + eased * 0.86 + bounce,
        waveElapsedMs: reducedMotion
          ? GLOBAL_EARTHQUAKE_WAVE_MAX_DURATION_MS
          : Math.max(0, markerElapsedMs - GLOBAL_EARTHQUAKE_RING_DELAY_MS),
      };
    });
    return { durationMs, eventReveals };
  };
  const getEarthquakeYearTransition = (selectedYear, yearEvents, now) => {
    const nextYear = String(selectedYear || "");
    const nextEvents = Array.isArray(yearEvents)
      ? [...yearEvents].sort(compareEarthquakeOccurrence)
      : [];
    if (
      earthquakeYearTransition.generation !== mapPlotRevealGeneration
      || !earthquakeYearTransition.currentYear
    ) {
      earthquakeYearTransition.generation = mapPlotRevealGeneration;
      earthquakeYearTransition.currentYear = nextYear;
      earthquakeYearTransition.currentEvents = nextEvents;
      earthquakeYearTransition.pendingYear = "";
      earthquakeYearTransition.pendingEvents = [];
      earthquakeYearTransition.phase = "enter";
      earthquakeYearTransition.exitStartReveals = [];
      earthquakeYearTransition.exitOrderIndices = [];
      earthquakeYearTransition.changedAt = Math.max(now, mapPlotRevealStartedAt);
    } else if (earthquakeYearTransition.phase === "exit") {
      const exitDurationMs = getEarthquakeStaggerDuration(
        earthquakeYearTransition.exitOrderIndices.length,
        GLOBAL_EARTHQUAKE_EVENT_EXIT_STAGGER_MS,
        GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS,
      );
      if (now - earthquakeYearTransition.changedAt >= exitDurationMs) {
        earthquakeYearTransition.currentYear = earthquakeYearTransition.pendingYear;
        earthquakeYearTransition.currentEvents = earthquakeYearTransition.pendingEvents;
        earthquakeYearTransition.pendingYear = "";
        earthquakeYearTransition.pendingEvents = [];
        earthquakeYearTransition.phase = "enter";
        earthquakeYearTransition.exitStartReveals = [];
        earthquakeYearTransition.exitOrderIndices = [];
        earthquakeYearTransition.changedAt += exitDurationMs;
      }
    }

    if (
      nextYear
      && nextYear !== earthquakeYearTransition.currentYear
      && earthquakeYearTransition.phase !== "exit"
    ) {
      const outgoing = getEarthquakeEnterReveals(
        earthquakeYearTransition.currentEvents,
        earthquakeYearTransition.changedAt,
        now,
      ).eventReveals;
      earthquakeYearTransition.pendingYear = nextYear;
      earthquakeYearTransition.pendingEvents = nextEvents;
      earthquakeYearTransition.phase = "exit";
      earthquakeYearTransition.exitStartReveals = outgoing;
      earthquakeYearTransition.exitOrderIndices = outgoing
        .filter(({ alpha }) => alpha > 0.01)
        .map(({ index }) => index);
      earthquakeYearTransition.changedAt = now;
    } else if (
      earthquakeYearTransition.phase === "exit"
      && nextYear === earthquakeYearTransition.currentYear
    ) {
      earthquakeYearTransition.pendingYear = "";
      earthquakeYearTransition.pendingEvents = [];
      earthquakeYearTransition.phase = "enter";
      earthquakeYearTransition.exitStartReveals = [];
      earthquakeYearTransition.exitOrderIndices = [];
      earthquakeYearTransition.changedAt = now - getEarthquakeStaggerDuration(
        earthquakeYearTransition.currentEvents.length,
        GLOBAL_EARTHQUAKE_EVENT_STAGGER_MS,
        GLOBAL_EARTHQUAKE_APPEAR_LEAD_MS + GLOBAL_EARTHQUAKE_EVENT_APPEAR_MS,
      );
    } else if (earthquakeYearTransition.phase === "exit") {
      earthquakeYearTransition.pendingYear = nextYear;
      earthquakeYearTransition.pendingEvents = nextEvents;
    } else if (nextYear === earthquakeYearTransition.currentYear) {
      earthquakeYearTransition.currentEvents = nextEvents;
    }

    const eventCount = earthquakeYearTransition.currentEvents.length;
    const elapsedMs = Math.max(0, now - earthquakeYearTransition.changedAt);
    let durationMs;
    let eventReveals;
    if (earthquakeYearTransition.phase === "exit") {
      durationMs = getEarthquakeStaggerDuration(
        earthquakeYearTransition.exitOrderIndices.length,
        GLOBAL_EARTHQUAKE_EVENT_EXIT_STAGGER_MS,
        GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS,
      );
      eventReveals = earthquakeYearTransition.exitStartReveals.map((startReveal) => {
        const exitRank = earthquakeYearTransition.exitOrderIndices.indexOf(startReveal.index);
        const localElapsedMs = exitRank < 0
          ? GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS
          : reducedMotion
            ? durationMs
            : elapsedMs;
        const progress = clamp(localElapsedMs / GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS, 0, 1);
        const eased = progress * progress * (3 - 2 * progress);
        return {
          ...startReveal,
          phase: "exit",
          progress,
          alpha: startReveal.alpha * (1 - eased),
          labelAlpha: startReveal.labelAlpha * (1 - eased),
          scale: startReveal.scale,
          waveElapsedMs: startReveal.waveElapsedMs,
        };
      });
    } else {
      const entering = getEarthquakeEnterReveals(
        earthquakeYearTransition.currentEvents,
        earthquakeYearTransition.changedAt,
        now,
      );
      durationMs = entering.durationMs;
      eventReveals = entering.eventReveals;
    }
    const visibleEventCount = eventReveals.filter(({ alpha }) => alpha > 0.01).length;
    const activeReveal = earthquakeYearTransition.phase === "exit"
      ? eventReveals.find(({ progress }) => progress > 0 && progress < 1) || null
      : [...eventReveals].reverse().find(({ alpha }) => alpha > 0.01) || null;
    const activeEvent = activeReveal?.event || null;
    return {
      progress: reducedMotion ? 1 : clamp(elapsedMs / durationMs, 0, 1),
      durationMs,
      phase: earthquakeYearTransition.phase,
      targetYear: earthquakeYearTransition.pendingYear || earthquakeYearTransition.currentYear,
      visibleEventCount,
      activeEvent,
      activeReveal,
      eventReveals,
      currentYear: earthquakeYearTransition.currentYear,
      currentEvents: earthquakeYearTransition.currentEvents,
      exitOrderIndices: [...earthquakeYearTransition.exitOrderIndices],
    };
  };
  const MAP_TITLE_SEPARATOR_DURATION_MS = 3000;
  const MAP_TITLE_SEPARATOR_REDUCED_DURATION_MS = 1960;
  const MAP_PLOT_REVEAL_LEAD_MS = 110;
  const MAP_PLOT_REVEAL_SPREAD_MS = 980;
  const MAP_PLOT_REVEAL_DURATION_MS = 520;
  const FOREST_RASTER_REVEAL_DURATION_MS = 1000;
  const getMapPlotRevealTotalMs = () => reducedMotion
    ? 0
    : MAP_PLOT_REVEAL_LEAD_MS + MAP_PLOT_REVEAL_SPREAD_MS + MAP_PLOT_REVEAL_DURATION_MS;
  const isMapPlotRevealComplete = (now) => (
    mapPlotRevealBlockedUntil === 0 && now >= mapPlotRevealStartedAt + getMapPlotRevealTotalMs()
  );
  const restartMapPlotReveal = (reason = "mode-change") => {
    const now = performance.now();
    const waitsForSeparator = mapPlotRevealBlockedUntil > 0;
    mapPlotRevealStartedAt = waitsForSeparator ? mapPlotRevealBlockedUntil : now;
    mapPlotRevealGeneration += 1;
    mapPlotRevealReason = reason;
    japanOverlay.dataset.plotRevealState = waitsForSeparator
      ? "waiting-for-separator"
      : reducedMotion
        ? "complete"
        : "running";
    japanOverlay.dataset.plotRevealReason = reason;
    japanOverlay.dataset.plotRevealGeneration = String(mapPlotRevealGeneration);
    japanOverlay.dataset.plotRevealProgress = waitsForSeparator ? "0.000" : reducedMotion ? "1.000" : "0.000";
    japanOverlay.dataset.plotRevealWaitsForSeparator = String(waitsForSeparator);
    japanOverlay.dataset.plotRevealScheduledAt = mapPlotRevealStartedAt.toFixed(1);
    japanOverlay.dataset.plotRevealFirstVisibleAt = (
      mapPlotRevealStartedAt + (reducedMotion ? 0 : MAP_PLOT_REVEAL_LEAD_MS)
    ).toFixed(1);
    japanOverlay.dataset.plotRevealCompletedAt = (
      mapPlotRevealStartedAt + getMapPlotRevealTotalMs()
    ).toFixed(1);
  };
  const getMapPlotReveal = (index, count, now) => {
    if (mapPlotRevealBlockedUntil > 0 || now < mapPlotRevealStartedAt) {
      return { progress: 0, alpha: 0, scale: 0.14 };
    }
    if (reducedMotion) return { progress: 1, alpha: 1, scale: 1 };
    const safeCount = Math.max(1, count);
    const order = safeCount === 1 ? 0 : index / (safeCount - 1);
    const delay = MAP_PLOT_REVEAL_LEAD_MS + order * MAP_PLOT_REVEAL_SPREAD_MS;
    const progress = clamp((now - mapPlotRevealStartedAt - delay) / MAP_PLOT_REVEAL_DURATION_MS, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const bounce = Math.sin(progress * Math.PI) * (1 - progress) * 0.24;
    return {
      progress,
      alpha: clamp(progress * 2.4, 0, 1),
      scale: 0.14 + eased * 0.86 + bounce,
    };
  };
  const getForestRasterRevealAlpha = (now, rasterReady) => {
    if (forestRasterReveal.generation !== mapPlotRevealGeneration) {
      forestRasterReveal.generation = mapPlotRevealGeneration;
      forestRasterReveal.startedAt = null;
      delete japanOverlay.dataset.forestRevealStartedAt;
    }
    const waitingForSeparator = mapPlotRevealBlockedUntil > 0 || now < mapPlotRevealStartedAt;
    let progress = 0;
    if (!waitingForSeparator && rasterReady) {
      // Start on the first drawable frame, including a late image load. Using
      // the separator's scheduled end alone would let a cold raster pop in.
      forestRasterReveal.startedAt ??= now;
      progress = reducedMotion ? 1
        : clamp((now - forestRasterReveal.startedAt) / FOREST_RASTER_REVEAL_DURATION_MS, 0, 1);
      japanOverlay.dataset.forestRevealStartedAt = forestRasterReveal.startedAt.toFixed(1);
    }
    const alpha = progress * progress * (3 - 2 * progress);
    japanOverlay.dataset.forestRevealState = waitingForSeparator ? "waiting-for-separator"
      : !rasterReady ? "waiting-for-raster" : progress < 1 ? "running" : "complete";
    japanOverlay.dataset.forestRevealProgress = progress.toFixed(3);
    japanOverlay.dataset.forestRevealAlpha = alpha.toFixed(3);
    return alpha;
  };
  const applyMapPlotReveal = (ctx, point, reveal) => {
    ctx.globalAlpha *= reveal.alpha;
    ctx.translate(point.x, point.y);
    ctx.scale(reveal.scale, reveal.scale);
    ctx.translate(-point.x, -point.y);
  };
  const syncMapPlotRevealState = (now) => {
    const total = getMapPlotRevealTotalMs();
    const waitingForSeparator = mapPlotRevealBlockedUntil > 0 || now < mapPlotRevealStartedAt;
    const progress = waitingForSeparator
      ? 0
      : reducedMotion
        ? 1
        : clamp((now - mapPlotRevealStartedAt) / total, 0, 1);
    japanOverlay.dataset.plotRevealState = waitingForSeparator
      ? "waiting-for-separator"
      : progress >= 1
        ? "complete"
        : "running";
    japanOverlay.dataset.plotRevealReason = mapPlotRevealReason;
    japanOverlay.dataset.plotRevealGeneration = String(mapPlotRevealGeneration);
    japanOverlay.dataset.plotRevealProgress = progress.toFixed(3);
    japanOverlay.dataset.plotRevealWaitsForSeparator = String(waitingForSeparator);
    japanOverlay.dataset.plotRevealCompletedAt = (mapPlotRevealStartedAt + total).toFixed(1);
  };
  const getGlobalEarthquakeImpactRadiusKm = (magnitude) => {
    const value = clamp(Number(magnitude) || GLOBAL_EARTHQUAKE_MIN_MAGNITUDE, 7, GLOBAL_EARTHQUAKE_MAX_MAGNITUDE);
    // USGS PP 1074 gives approximate perceptibility distances of 400 km at M7
    // and 600 km at M8. The M9.1 anchor reflects documented cross-country felt
    // reports for the 2004 Sumatra and 2011 Tohoku events. This remains an
    // educational estimate, not a ShakeMap, intensity, damage, or tsunami area.
    if (value <= 8) return 400 + (value - 7) * 200;
    return 600 + ((value - 8) / (GLOBAL_EARTHQUAKE_MAX_MAGNITUDE - 8)) * 1400;
  };
  const getGlobalEarthquakeWaveDurationMs = (impactRadiusKm) => {
    const radiusProgress = clamp(
      (impactRadiusKm - GLOBAL_EARTHQUAKE_MIN_IMPACT_RADIUS_KM) /
        (GLOBAL_EARTHQUAKE_MAX_IMPACT_RADIUS_KM - GLOBAL_EARTHQUAKE_MIN_IMPACT_RADIUS_KM),
      0,
      1,
    );
    return GLOBAL_EARTHQUAKE_WAVE_MIN_DURATION_MS +
      radiusProgress * (GLOBAL_EARTHQUAKE_WAVE_MAX_DURATION_MS - GLOBAL_EARTHQUAKE_WAVE_MIN_DURATION_MS);
  };
  const getGlobalEarthquakeImpactEllipse = (event, impactRadiusKm, projection) => {
    const radiusDegrees = (impactRadiusKm / (2 * Math.PI * EARTH_RADIUS_KM)) * 360;
    const verticalRadius = radiusDegrees * projection.scale;
    const latitudeScale = Math.max(0.28, Math.cos(toRadians(event.latitude)));
    return {
      x: verticalRadius / latitudeScale,
      y: verticalRadius,
    };
  };
  const FOREST_RAIN_REFERENCE_MAX_MM_DAY = 6.5;
  const FOREST_RAIN_MIN_RADIUS = 10;
  const FOREST_RAIN_MAX_RADIUS = 54;
  const getForestRainRadius = (precipitationMmDay) => {
    const ratio = Math.sqrt(clamp(
      (Number(precipitationMmDay) || 0) / FOREST_RAIN_REFERENCE_MAX_MM_DAY,
      0,
      1,
    ));
    return FOREST_RAIN_MIN_RADIUS + ratio * (FOREST_RAIN_MAX_RADIUS - FOREST_RAIN_MIN_RADIUS);
  };
  const getForestRainSiteName = (row) => row?.id === "brazil"
    ? `${getCountryNameJa(row)}（アマゾン付近）`
    : row ? getCountryNameJa(row) : "代表地点";
  const wrapLongitude = (longitude) => ((longitude + 540) % 360) - 180;
  const earthLongitudeToMapX = (longitude) =>
    wrapLongitude(longitude - EARTH_INITIAL_CENTER_LONGITUDE) + 180;
  const formatModeNumber = (index) => String(index + 1).padStart(2, "0");
  // Public map chapters differ from the unchanged shader/story mode indices.
  const formatMapModeNumber = (index) => modes[index].mapNumber;
  const observationNumberFormatters = new Map();
  const formatObservationNumber = (value, maximumFractionDigits = 2) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    if (!observationNumberFormatters.has(maximumFractionDigits)) {
      observationNumberFormatters.set(maximumFractionDigits, new Intl.NumberFormat("ja-JP", { maximumFractionDigits }));
    }
    return observationNumberFormatters.get(maximumFractionDigits).format(numeric);
  };
  const japaneseRegionNames = typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["ja"], { type: "region" })
    : null;
  const getCountryNameJa = (row) => {
    if (row?.countryJa) return row.countryJa;
    const iso2 = String(row?.iso2 || row?.countryCode || "").toUpperCase();
    if (japaneseRegionNames && /^[A-Z]{2}$/u.test(iso2)) {
      try {
        return japaneseRegionNames.of(iso2) || row?.country || row?.name || iso2;
      } catch {
        // Fall through to the source label when the region code is unknown.
      }
    }
    return row?.country || row?.name || row?.iso3 || "国名不明";
  };
  const CULTURE_SITE_NAMES_JA = new Map([
    ["L'Anse aux Meadows", "ランス・オ・メドー"],
    ["Yellowstone", "イエローストーン"],
    ["Teotihuacan", "テオティワカン"],
    ["Tikal", "ティカル"],
    ["Galápagos Islands", "ガラパゴス諸島"],
    ["Machu Picchu", "マチュ・ピチュ"],
    ["Los Glaciares", "ロス・グラシアレス"],
    ["Stonehenge", "ストーンヘンジ"],
    ["Historic Centre of Rome", "ローマ歴史地区"],
    ["Thingvellir", "シンクヴェトリル"],
    ["Memphis and its Necropolis", "メンフィスとその墓地遺跡"],
    ["Timbuktu", "トンブクトゥ"],
    ["Serengeti", "セレンゲティ"],
    ["Robben Island", "ロベン島"],
    ["Petra", "ペトラ"],
    ["Persepolis", "ペルセポリス"],
    ["Taj Mahal", "タージ・マハル"],
    ["Sagarmatha", "サガルマータ"],
    ["Angkor", "アンコール"],
    ["Borobudur", "ボロブドゥール"],
    ["Great Wall", "万里の長城"],
    ["Shirakami-Sanchi", "白神山地"],
    ["Great Barrier Reef", "グレート・バリア・リーフ"],
    ["Tongariro", "トンガリロ"],
  ]);
  const CULTURE_CATEGORY_NAMES_JA = Object.freeze({ Cultural: "文化遺産", Natural: "自然遺産", Mixed: "複合遺産" });
  const CULTURE_REGION_NAMES_JA = Object.freeze({
    "North America": "北アメリカ",
    "Central America": "中央アメリカ",
    "South America": "南アメリカ",
    Europe: "ヨーロッパ",
    "North Africa": "北アフリカ",
    "West Africa": "西アフリカ",
    "East Africa": "東アフリカ",
    "Southern Africa": "南部アフリカ",
    "West Asia": "西アジア",
    "South Asia": "南アジア",
    "Southeast Asia": "東南アジア",
    "East Asia": "東アジア",
    Oceania: "オセアニア",
  });
  const getCultureSiteNameJa = (row) => CULTURE_SITE_NAMES_JA.get(row?.name) || row?.name || "世界遺産";
  const earthquakeDateFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
    weekday: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });
  const formatEarthquakeDateJa = (value, fallback = "日時不明") => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    const parts = Object.fromEntries(earthquakeDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
    return `${parts.year}年${parts.month}月${parts.day}日（${parts.weekday}）${parts.dayPeriod}${parts.hour}時${parts.minute}分`;
  };
  const formatCoordinateJa = (latitude, longitude) => {
    return formatCoordinatesJa(latitude, longitude, 2, '・');
  };
  const formatPopulationCompact = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    if (numeric >= 100_000_000) return `${(numeric / 100_000_000).toFixed(1)}億`;
    if (numeric >= 10_000) return `${Math.round(numeric / 10_000)}万`;
    return formatObservationNumber(numeric, 0);
  };
  const formatPopulationScaleJa = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "—";
    if (numeric >= 100_000_000) return `${(numeric / 100_000_000).toFixed(1)}億人`;
    if (numeric >= 10_000) return `${(numeric / 10_000).toFixed(0)}万人`;
    return `${formatObservationNumber(numeric, 0)}人`;
  };
  const lonLatToWorld = (lon, lat, zoom = japanView.zoom) => {
    const worldSize = MAP_TILE_SIZE * 2 ** zoom;
    const latitude = clamp(lat, -85.0511, 85.0511);
    const sinLatitude = Math.sin((latitude * Math.PI) / 180);
    return {
      x: ((lon + 180) / 360) * worldSize,
      y:
        (0.5 -
          Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
        worldSize,
    };
  };

  const earthBaseScale = ({ width, height }) =>
    Math.max(0.1, width >= 901 ? width / 360 : Math.max(width / 360, height / 180));

  const getEarthOverviewTarget = (rect) => {
    const scale = earthBaseScale(rect);
    return { focus: "global", zoom: 1,
      offsetX: rect.width / 2 - ((rect.width - 360 * scale) / 2 + earthLongitudeToMapX(138) * scale),
      offsetY: 0 };
  };

  // Station-level coastal observations need kilometre-scale picking. Keep
  // the established limit for every other exhibit and all zoom entry paths.
  const getEarthZoomLimit = () => japanLayer.classList.contains("is-marine-cod-exhibit") ? 512 : 8;
  const getEarthProjection = (rect) => {
    const baseScale = earthBaseScale(rect);
    const zoom = clamp(japanView.earthZoom, 1, getEarthZoomLimit());
    const scale = baseScale * zoom;
    const width = 360 * scale;
    const height = 180 * scale;
    // Desktop overview fits the full world horizontally; portrait keeps the
    // existing cover/pan behaviour. At higher zoom both can pan as usual.
    const maximumOffsetX = Math.abs(width - rect.width) / 2;
    // COD's phone overview is framed in the exposed area between legend and
    // dock. Allow that centre even near 1x, where world-cover clamping would
    // otherwise put all Japanese stations back underneath the legend.
    const maximumOffsetY = Math.abs(height - rect.height) / 2
      + (getEarthZoomLimit() > 8 ? rect.height / 2 : 0);
    japanView.earthZoom = zoom;
    japanView.earthOffsetX = clamp(
      japanView.earthOffsetX,
      -maximumOffsetX,
      maximumOffsetX,
    );
    japanView.earthOffsetY = clamp(
      japanView.earthOffsetY,
      -maximumOffsetY,
      maximumOffsetY,
    );
    const projection = {
      scale,
      width,
      height,
      originX: (rect.width - width) / 2 + japanView.earthOffsetX,
      originY: (rect.height - height) / 2 + japanView.earthOffsetY,
    };
    const japanX = projection.originX + earthLongitudeToMapX(138) * projection.scale;
    const japanY = projection.originY + (90 - 36) * projection.scale;
    const tokyoX = projection.originX
      + earthLongitudeToMapX(BLUE_CIRCULATION_FOCUS.lon) * projection.scale;
    const tokyoY = projection.originY
      + (90 - BLUE_CIRCULATION_FOCUS.lat) * projection.scale;
    japanOverlay.dataset.earthZoom = zoom.toFixed(4);
    japanOverlay.dataset.earthCenterLongitude = String(EARTH_INITIAL_CENTER_LONGITUDE);
    japanOverlay.dataset.earthOffsetX = japanView.earthOffsetX.toFixed(2);
    japanOverlay.dataset.earthOffsetY = japanView.earthOffsetY.toFixed(2);
    japanOverlay.dataset.japanScreenX = japanX.toFixed(2);
    japanOverlay.dataset.japanScreenY = japanY.toFixed(2);
    japanOverlay.dataset.tokyoScreenX = tokyoX.toFixed(2);
    japanOverlay.dataset.tokyoScreenY = tokyoY.toFixed(2);
    mapZoomControls.dataset.zoom = zoom.toFixed(2);
    mapZoomIn.disabled = zoom >= getEarthZoomLimit() - .005;
    mapZoomOut.disabled = zoom <= 1.005;
    const japanOverview = Number(japanModeNumber.textContent) >= 15 && Number(japanModeNumber.textContent) <= 69;
    const overviewKind = japanOverview ? 'japan' : 'world';
    if (mapZoomReset.dataset.overview !== overviewKind) {
      mapZoomReset.dataset.overview = overviewKind;
      const explanation = japanOverview ? '日本全体が見える位置に戻す' : '世界全体が見える位置に戻す';
      mapZoomReset.setAttribute('aria-label', explanation);
      mapZoomReset.dataset.tooltip = explanation;
    }
    // 全体表示からズーム・移動したときだけ、同じ操作欄に帰り道を出す。
    const homeView = japanPrefectureView(innerWidth);
    const homeScale = earthBaseScale(rect) * homeView.zoom;
    const homeX = rect.width * (homeView.targetX - .5) - (earthLongitudeToMapX(homeView.lon) - 180) * homeScale;
    const homeY = rect.height * (homeView.targetY - .5) + homeView.lat * homeScale;
    mapZoomReset.disabled = japanOverview ? Math.abs(zoom - homeView.zoom) < .005
      && Math.abs(japanView.earthOffsetX - clamp(homeX, -maximumOffsetX, maximumOffsetX)) < .5
      && Math.abs(japanView.earthOffsetY - clamp(homeY, -maximumOffsetY, maximumOffsetY)) < .5 : zoom <= 1.005
      && Math.abs(japanView.earthOffsetX - clamp(getEarthOverviewTarget(rect).offsetX, -maximumOffsetX, maximumOffsetX)) < 0.5
      && Math.abs(japanView.earthOffsetY) < 0.5;
    mapZoomReset.hidden = mapZoomReset.disabled;
    return projection;
  };

  // Rotate the canonical textures into one bounded 360° frame. These two
  // adjacent texture pieces meet without overlap; all vector paths are clipped
  // to that frame, so no additional world can appear at either edge.
  const getEarthWorldCopies = (projection) => [0, 360].map((repeat) => ({
    repeat,
    x: projection.originX + (repeat - EARTH_INITIAL_CENTER_LONGITUDE) * projection.scale,
    y: projection.originY,
    width: 360 * projection.scale,
    height: 180 * projection.scale,
  }));

  const getEarthViewTarget = (index, rect) => {
    if (modes[index]?.id === "three-ecologies" && rect.width < 680) {
      const zoom = 1.35;
      const scale = earthBaseScale(rect) * zoom;
      return { focus: "ecologies-japan", zoom,
        offsetX: rect.width / 2 - ((rect.width - 360 * scale) / 2 + earthLongitudeToMapX(138) * scale),
        offsetY: rect.height * .18 - ((rect.height - 180 * scale) / 2 + (90 - 36) * scale) };
    }
    const focusJapan = modes[index]?.id === "blue-circulation";
    const zoom = focusJapan ? (rect.width <= 720 ? 3.35 : 4.15) : 1;
    if (!focusJapan) return getEarthOverviewTarget(rect);

    const baseScale = earthBaseScale(rect);
    const scale = baseScale * zoom;
    const width = 360 * scale;
    const height = 180 * scale;
    const targetX = rect.width * 0.5;
    const targetY = rect.height * 0.46;
    return {
      focus: BLUE_CIRCULATION_FOCUS.label,
      zoom,
      offsetX: targetX - (
        (rect.width - width) / 2
        + earthLongitudeToMapX(BLUE_CIRCULATION_FOCUS.lon) * scale
      ),
      offsetY: targetY - (
        (rect.height - height) / 2
        + (90 - BLUE_CIRCULATION_FOCUS.lat) * scale
      ),
    };
  };

  const cancelEarthViewAnimation = (reason = "cancelled") => {
    if (earthViewAnimationFrame) cancelAnimationFrame(earthViewAnimationFrame);
    if (earthViewAnimationTimer) window.clearTimeout(earthViewAnimationTimer);
    earthViewAnimationFrame = 0;
    earthViewAnimationTimer = 0;
    if (japanOverlay.dataset.viewAnimation === "running") {
      japanOverlay.dataset.viewAnimation = reason;
    }
    if (String(reason).startsWith("user-") && getActiveSignalMode()?.id === "rhythm-of-disaster") {
      earthquakeCameraSequence.suppressed = true;
      japanOverlay.dataset.earthquakeCameraState = "user-controlled";
    }
  };

  const applyEarthViewState = ({ zoom, offsetX, offsetY }, rect) => {
    japanView.earthZoom = zoom;
    japanView.earthOffsetX = offsetX;
    japanView.earthOffsetY = offsetY;
    japanView.earthProjection = getEarthProjection(rect);
    japanTilesDirty = true;
  };

  const animateEarthViewToTarget = (
    target,
    rect = japanMap.getBoundingClientRect(),
    { durationMs = 1150, easing = "smoothstep", onComplete } = {},
  ) => {
    if (!japanIsOpen || mapScope !== "earth") return;
    if (rect.width < 1 || rect.height < 1) return;
    cancelEarthViewAnimation("replaced");
    const start = {
      zoom: japanView.earthZoom,
      offsetX: japanView.earthOffsetX,
      offsetY: japanView.earthOffsetY,
    };
    japanOverlay.dataset.viewTarget = target.focus;
    japanOverlay.dataset.viewAnimation = reducedMotion ? "idle" : "running";
    japanOverlay.dataset.viewEasing = easing;
    if (reducedMotion) {
      applyEarthViewState(target, rect);
      onComplete?.(performance.now());
      return true;
    }

    const duration = clamp(Number(durationMs) || 1150, 120, 2400);
    let previousFrameAt = performance.now();
    let elapsed = 0;
    const scheduleStep = (step) => {
      const run = (now) => {
        if (!earthViewAnimationFrame && !earthViewAnimationTimer) return;
        if (earthViewAnimationFrame) cancelAnimationFrame(earthViewAnimationFrame);
        if (earthViewAnimationTimer) window.clearTimeout(earthViewAnimationTimer);
        earthViewAnimationFrame = 0;
        earthViewAnimationTimer = 0;
        step(now);
      };
      earthViewAnimationFrame = requestAnimationFrame(run);
      earthViewAnimationTimer = window.setTimeout(() => run(performance.now()), 34);
    };
    const step = (now) => {
      const frameDelta = clamp(now - previousFrameAt, 0, 64);
      previousFrameAt = now;
      elapsed = Math.min(duration, elapsed + frameDelta);
      const progress = elapsed / duration;
      const eased = easing === "ease-out-cubic"
        ? 1 - Math.pow(1 - progress, 3)
        : progress * progress * (3 - 2 * progress);
      japanOverlay.dataset.viewAnimationProgress = progress.toFixed(3);
      japanOverlay.dataset.viewAnimationEasedProgress = eased.toFixed(3);
      applyEarthViewState({
        zoom: start.zoom + (target.zoom - start.zoom) * eased,
        offsetX: start.offsetX + (target.offsetX - start.offsetX) * eased,
        offsetY: start.offsetY + (target.offsetY - start.offsetY) * eased,
      }, rect);
      if (progress < 1) {
        scheduleStep(step);
      } else {
        earthViewAnimationFrame = 0;
        earthViewAnimationTimer = 0;
        japanOverlay.dataset.viewAnimation = "idle";
        onComplete?.(now);
      }
    };
    scheduleStep(step);
    return true;
  };

  const animateEarthViewForMode = (index = modeToIndex) => {
    const rect = japanMap.getBoundingClientRect();
    return animateEarthViewToTarget(getEarthViewTarget(index, rect), rect);
  };

  const focusEarthLocation = ({
    lon,
    lat,
    zoom = 3.65,
    targetX = 0.5,
    targetY = 0.43,
    label = "location",
    durationMs = 1150,
    easing = "smoothstep",
    onComplete,
  } = {}) => {
    const longitude = Number(lon);
    const latitude = Number(lat);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !japanIsOpen || mapScope !== "earth") return false;
    const rect = japanMap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const resolvedZoom = clamp(Number(zoom) || 3.65, 1, getEarthZoomLimit());
    const baseScale = earthBaseScale(rect);
    const scale = baseScale * resolvedZoom;
    const width = 360 * scale;
    const height = 180 * scale;
    return animateEarthViewToTarget({
      focus: String(label || "location"),
      zoom: resolvedZoom,
      offsetX: rect.width * clamp(Number(targetX) || 0.5, 0.2, 0.8)
        - ((rect.width - width) / 2 + earthLongitudeToMapX(longitude) * scale),
      offsetY: rect.height * clamp(Number(targetY) || 0.43, 0.2, 0.8)
        - ((rect.height - height) / 2 + (90 - clamp(latitude, -85, 85)) * scale),
    }, rect, { durationMs, easing, onComplete });
  };

  const syncEarthquakeCameraSequence = (yearTransition, now) => {
    const year = String(yearTransition?.currentYear || "");
    const phase = String(yearTransition?.phase || "idle");
    const isNewSequence = earthquakeCameraSequence.generation !== mapPlotRevealGeneration
      || earthquakeCameraSequence.year !== year;
    if (isNewSequence) {
      earthquakeCameraSequence.generation = mapPlotRevealGeneration;
      earthquakeCameraSequence.year = year;
      earthquakeCameraSequence.phase = phase;
      earthquakeCameraSequence.activeIndex = -1;
      earthquakeCameraSequence.activeEventId = "";
      earthquakeCameraSequence.arrivals.clear();
      earthquakeCameraSequence.completedAt = 0;
      earthquakeCameraSequence.returned = false;
      earthquakeCameraSequence.suppressed = false;
    }

    const eventReveals = yearTransition?.eventReveals || [];
    const activeReveal = phase === "enter"
      ? [...eventReveals].reverse().find(({ started }) => started) || null
      : null;
    const allEventsVisible = eventReveals.length > 0
      && eventReveals.every(({ progress }) => progress >= 0.999);

    japanOverlay.dataset.earthquakeCameraMode = "chronological-epicenter-flyover";
    japanOverlay.dataset.earthquakeCameraFlyMs = String(GLOBAL_EARTHQUAKE_CAMERA_FLY_MS);
    japanOverlay.dataset.earthquakeCameraHoldMs = String(GLOBAL_EARTHQUAKE_EVENT_HOLD_MS);
    japanOverlay.dataset.earthquakeCameraReturnDelayMs = String(GLOBAL_EARTHQUAKE_CAMERA_RETURN_DELAY_MS);
    japanOverlay.dataset.earthquakeCameraReturnMs = String(GLOBAL_EARTHQUAKE_CAMERA_RETURN_MS);
    japanOverlay.dataset.earthquakeCameraSequenceYear = year;
    japanOverlay.dataset.earthquakeMarkerDelayMs = String(GLOBAL_EARTHQUAKE_MARKER_DELAY_MS);
    japanOverlay.dataset.earthquakeCalloutDelayMs = String(GLOBAL_EARTHQUAKE_CALLOUT_DELAY_MS);
    japanOverlay.dataset.earthquakeCameraSuppressed = String(earthquakeCameraSequence.suppressed);

    if (reducedMotion) {
      earthquakeCameraSequence.phase = phase;
      earthquakeCameraSequence.returned = true;
      japanOverlay.dataset.earthquakeCameraState = "reduced-motion-global";
      japanOverlay.dataset.earthquakeCameraEventIndex = "-1";
      japanOverlay.dataset.earthquakeCameraEventId = "";
      return earthquakeCameraSequence;
    }

    if (phase === "exit") {
      earthquakeCameraSequence.phase = phase;
      earthquakeCameraSequence.completedAt = 0;
      if (!earthquakeCameraSequence.returned && !earthquakeCameraSequence.suppressed) {
        const rect = japanMap.getBoundingClientRect();
        animateEarthViewToTarget(
          getEarthViewTarget(modeToIndex, rect),
          rect,
          { durationMs: GLOBAL_EARTHQUAKE_CAMERA_RETURN_MS },
        );
        earthquakeCameraSequence.returned = true;
      }
      japanOverlay.dataset.earthquakeCameraState = earthquakeCameraSequence.suppressed
        ? "user-controlled"
        : japanView.earthZoom <= 1.01 && japanOverlay.dataset.viewAnimation === "idle"
          ? "global-overview"
          : "returning-global";
      return earthquakeCameraSequence;
    }

    earthquakeCameraSequence.phase = phase;
    if (
      activeReveal
      && !earthquakeCameraSequence.suppressed
      && activeReveal.index !== earthquakeCameraSequence.activeIndex
    ) {
      const event = activeReveal.event;
      const rect = japanMap.getBoundingClientRect();
      const magnitudeRatio = clamp(
        (Number(event.magnitude) - GLOBAL_EARTHQUAKE_MIN_MAGNITUDE)
          / (GLOBAL_EARTHQUAKE_MAX_MAGNITUDE - GLOBAL_EARTHQUAKE_MIN_MAGNITUDE),
        0,
        1,
      );
      const baseZoom = rect.width <= 720
        ? GLOBAL_EARTHQUAKE_CAMERA_MOBILE_ZOOM
        : GLOBAL_EARTHQUAKE_CAMERA_DESKTOP_ZOOM;
      const zoom = baseZoom - magnitudeRatio * 0.32;
      const generation = mapPlotRevealGeneration;
      japanOverlay.dataset.earthquakeCameraArrivedAt = "";
      focusEarthLocation({
        lon: event.longitude,
        lat: event.latitude,
        zoom,
        targetX: 0.5,
        targetY: rect.width <= 720 ? 0.44 : 0.46,
        label: `earthquake-${year}-${activeReveal.index + 1}`,
        durationMs: GLOBAL_EARTHQUAKE_CAMERA_FLY_MS,
        easing: "ease-out-cubic",
        onComplete: (arrivedAt) => {
          if (earthquakeCameraSequence.generation !== generation
            || earthquakeCameraSequence.year !== year
            || earthquakeYearTransition.phase !== "enter") return;
          earthquakeCameraSequence.arrivals.set(activeReveal.index, arrivedAt);
          japanOverlay.dataset.earthquakeCameraArrivedAt = arrivedAt.toFixed(1);
        },
      });
      earthquakeCameraSequence.activeIndex = activeReveal.index;
      earthquakeCameraSequence.activeEventId = String(event.id || "");
      earthquakeCameraSequence.completedAt = 0;
      earthquakeCameraSequence.returned = false;
    }

    if (allEventsVisible) {
      if (!earthquakeCameraSequence.completedAt) earthquakeCameraSequence.completedAt = now;
      if (
        !earthquakeCameraSequence.returned
        && !earthquakeCameraSequence.suppressed
        && now - earthquakeCameraSequence.completedAt >= GLOBAL_EARTHQUAKE_CAMERA_RETURN_DELAY_MS
      ) {
        const rect = japanMap.getBoundingClientRect();
        animateEarthViewToTarget(
          getEarthViewTarget(modeToIndex, rect),
          rect,
          { durationMs: GLOBAL_EARTHQUAKE_CAMERA_RETURN_MS },
        );
        earthquakeCameraSequence.returned = true;
      }
    }

    japanOverlay.dataset.earthquakeCameraState = earthquakeCameraSequence.suppressed
      ? "user-controlled"
      : earthquakeCameraSequence.returned
        ? japanView.earthZoom <= 1.01 && japanOverlay.dataset.viewAnimation === "idle"
          ? "global-overview"
          : "returning-global"
        : activeReveal
          ? "following-epicenter"
          : "waiting-for-event";
    japanOverlay.dataset.earthquakeCameraEventIndex = String(earthquakeCameraSequence.activeIndex);
    japanOverlay.dataset.earthquakeCameraEventId = earthquakeCameraSequence.activeEventId;
    return earthquakeCameraSequence;
  };

  const setEarthZoom = (nextZoom, clientX, clientY) => {
    const rect = japanMap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const current = getEarthProjection(rect);
    const anchorX = clamp(clientX - rect.left, 0, rect.width);
    const anchorY = clamp(clientY - rect.top, 0, rect.height);
    const mapX = (anchorX - current.originX) / current.scale;
    const mapY = (anchorY - current.originY) / current.scale;

    japanView.earthZoom = clamp(nextZoom, 1, getEarthZoomLimit());
    const baseScale = earthBaseScale(rect);
    const nextScale = baseScale * japanView.earthZoom;
    const nextWidth = 360 * nextScale;
    const nextHeight = 180 * nextScale;
    japanView.earthOffsetX =
      anchorX - mapX * nextScale - (rect.width - nextWidth) / 2;
    japanView.earthOffsetY =
      anchorY - mapY * nextScale - (rect.height - nextHeight) / 2;
    japanView.earthProjection = getEarthProjection(rect);
    japanTilesDirty = true;
  };

  const zoomEarthBy = (factor = 1) => {
    if (!japanIsOpen || mapScope !== "earth") return false;
    const multiplier = Number(factor);
    if (!Number.isFinite(multiplier) || multiplier <= 0) return false;
    cancelEarthViewAnimation("control-zoom");
    const rect = japanMap.getBoundingClientRect();
    setEarthZoom(japanView.earthZoom * multiplier, rect.left + rect.width / 2, rect.top + rect.height / 2);
    return true;
  };

  const zoomEarthAtLocation = ({ lon, lat, factor = 1, targetX = 0.5, targetY = 0.43 } = {}) => {
    if (!japanIsOpen || mapScope !== "earth") return false;
    const longitude = Number(lon);
    const latitude = Number(lat);
    const multiplier = Number(factor);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(multiplier) || multiplier <= 0) return false;
    cancelEarthViewAnimation("location-zoom");
    const rect = japanMap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const nextZoom = clamp(japanView.earthZoom * multiplier, 1, getEarthZoomLimit());
    const baseScale = earthBaseScale(rect);
    const nextScale = baseScale * nextZoom;
    const nextWidth = 360 * nextScale;
    const nextHeight = 180 * nextScale;
    const anchorX = rect.width * clamp(Number(targetX) || 0.5, 0.2, 0.8);
    const anchorY = rect.height * clamp(Number(targetY) || 0.43, 0.2, 0.8);
    japanView.earthZoom = nextZoom;
    japanView.earthOffsetX = anchorX
      - ((rect.width - nextWidth) / 2 + earthLongitudeToMapX(longitude) * nextScale);
    japanView.earthOffsetY = anchorY
      - ((rect.height - nextHeight) / 2 + (90 - clamp(latitude, -85, 85)) * nextScale);
    japanView.earthProjection = getEarthProjection(rect);
    japanTilesDirty = true;
    return true;
  };

  const resetJapanView = () => {
    cancelEarthViewAnimation("reset");
    const isMobile = window.innerWidth <= 720;
    const nextZoom = isMobile ? EARTH_MOBILE_ZOOM : EARTH_ZOOM;
    const center = lonLatToWorld(15, 18, nextZoom);
    japanView.zoom = nextZoom;
    japanView.centerX = center.x;
    japanView.centerY = center.y;
    japanView.earthZoom = 1;
    japanView.earthOffsetX = getEarthOverviewTarget(japanMap.getBoundingClientRect()).offsetX;
    japanView.earthOffsetY = 0;
    japanView.earthProjection = null;
    japanTilesDirty = true;
  };

  const getActiveMapNodes = () => modes[modeToIndex]?.id === "three-ecologies" ? [] : EARTH_NODES;

  // Camera pan/zoom changes projection, not the map element's bounds. Share
  // one measured viewport with annual overlays until layout can change.
  let cachedJapanMapRect = null;
  const invalidateJapanMapRect = () => { cachedJapanMapRect = null; };
  const readJapanMapRect = () => cachedJapanMapRect || (cachedJapanMapRect = japanMap.getBoundingClientRect());
  new ResizeObserver(invalidateJapanMapRect).observe(japanMap);
  for (const event of ["resize", "pageshow", "gaia:japan-open", "gaia:japan-close"]) addEventListener(event, invalidateJapanMapRect);
  addEventListener("scroll", invalidateJapanMapRect, { capture: true, passive: true });
  window.visualViewport?.addEventListener("resize", invalidateJapanMapRect);
  window.visualViewport?.addEventListener("scroll", invalidateJapanMapRect);

  const getJapanViewport = () => {
    const rect = readJapanMapRect();
    if (mapScope === "earth") {
      japanView.earthProjection = getEarthProjection(rect);
      return { rect, left: 0, top: 0 };
    }
    return {
      rect,
      left: japanView.centerX - rect.width / 2,
      top: japanView.centerY - rect.height / 2,
    };
  };

  const renderJapanTiles = () => {
    if (!japanIsOpen || !japanTilesDirty) {
      return;
    }

    const { rect, left, top } = getJapanViewport();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }

    if (mapScope === "earth") {
      japanTiles.hidden = true;
      for (const tile of japanTileElements.values()) tile.remove();
      japanTileElements.clear();
      dataLedger.updateOsm({ scope: mapScope, zoom: japanView.zoom, urls: [] });
      japanTilesDirty = false;
      return;
    }
    japanTiles.hidden = false;

    const tileCount = 2 ** japanView.zoom;
    const minimumX = Math.floor(left / MAP_TILE_SIZE);
    const maximumX = Math.floor((left + rect.width - 1) / MAP_TILE_SIZE);
    const minimumY = Math.max(0, Math.floor(top / MAP_TILE_SIZE));
    const maximumY = Math.min(
      tileCount - 1,
      Math.floor((top + rect.height - 1) / MAP_TILE_SIZE),
    );
    const visibleKeys = new Set();
    const visibleTileUrls = [];

    for (let tileY = minimumY; tileY <= maximumY; tileY += 1) {
      for (let tileX = minimumX; tileX <= maximumX; tileX += 1) {
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
        const key = `${japanView.zoom}/${tileX}/${tileY}`;
        const tileUrl = `https://tile.openstreetmap.org/${japanView.zoom}/${wrappedX}/${tileY}.png`;
        visibleKeys.add(key);
        visibleTileUrls.push(tileUrl);

        let tile = japanTileElements.get(key);
        if (!tile) {
          tile = document.createElement("img");
          tile.className = "japan-tile";
          tile.alt = "";
          tile.draggable = false;
          tile.decoding = "async";
          tile.src = tileUrl;
          tile.addEventListener(
            "load",
            () => {
              tile.classList.add("is-loaded");
            },
            { once: true },
          );
          tile.addEventListener(
            "error",
            () => {
              japanTileErrors += 1;
              japanMapStatus.textContent =
                "MAP TILE OFFLINE / VECTOR EARTH MODEL ACTIVE";
            },
            { once: true },
          );
          japanTileElements.set(key, tile);
          japanTiles.append(tile);
        }

        tile.style.transform = `translate3d(${tileX * MAP_TILE_SIZE - left}px, ${
          tileY * MAP_TILE_SIZE - top
        }px, 0)`;
      }
    }

    dataLedger.updateOsm({
      scope: mapScope,
      zoom: japanView.zoom,
      urls: visibleTileUrls,
    });

    for (const [key, tile] of japanTileElements) {
      if (!visibleKeys.has(key)) {
        tile.remove();
        japanTileElements.delete(key);
      }
    }

    japanTilesDirty = false;
  };

  const resizeJapanOverlay = (rect) => {
    const deviceRatio = Math.min(Math.max(1, window.devicePixelRatio || 1), globalThis.GaiaFrameBudgetGovernor?.getDprCap?.() || Infinity);
    const nativeRatio = Math.min(deviceRatio, mapOverlayQuality.ratioCap);
    const rawWidth = Math.max(1, rect.width * nativeRatio);
    const rawHeight = Math.max(1, rect.height * nativeRatio);
    const cssPixels = Math.max(1, rect.width * rect.height);
    const maxPixels = Math.max(cssPixels, mapOverlayQuality.maxPixels);
    const pixelScale = Math.min(1, Math.sqrt(maxPixels / (rawWidth * rawHeight)));
    const width = Math.max(1, Math.floor(rawWidth * pixelScale));
    const height = Math.max(1, Math.floor(rawHeight * pixelScale));
    const ratio = width / Math.max(1, rect.width);

    if (japanOverlay.width !== width || japanOverlay.height !== height) {
      japanOverlay.width = width;
      japanOverlay.height = height;
      japanView.width = rect.width;
      japanView.height = rect.height;
      japanTilesDirty = true;
    }

    const renderedRatio = ratio.toFixed(3);
    const deviceRatioLabel = deviceRatio.toFixed(3);
    if (japanOverlay.dataset.renderQuality !== mapOverlayQuality.tier) {
      japanOverlay.dataset.renderQuality = mapOverlayQuality.tier;
    }
    if (japanOverlay.dataset.renderPixelRatio !== renderedRatio) {
      japanOverlay.dataset.renderPixelRatio = renderedRatio;
    }
    if (japanOverlay.dataset.devicePixelRatio !== deviceRatioLabel) {
      japanOverlay.dataset.devicePixelRatio = deviceRatioLabel;
    }

    return ratio;
  };

  const japanWorldToScreen = (lon, lat, left, top) => {
    if (mapScope === "earth") {
      const projection = japanView.earthProjection || getEarthProjection(japanMap.getBoundingClientRect());
      return {
        x: projection.originX + earthLongitudeToMapX(clamp(lon, -180, 180)) * projection.scale,
        y: projection.originY + (90 - clamp(lat, -90, 90)) * projection.scale,
      };
    }
    const world = lonLatToWorld(lon, lat);
    return {
      x: world.x - left,
      y: world.y - top,
    };
  };

  const getNaturalEarthLandPath = (zoom) => {
    if (naturalEarthLandState !== "ready" || typeof Path2D === "undefined") {
      return null;
    }

    if (naturalEarthPathCache.has(zoom)) {
      return naturalEarthPathCache.get(zoom);
    }

    const path = new Path2D();
    for (const ring of naturalEarthLandRings) {
      if (ring.length < 3) continue;
      ring.forEach(([longitude, latitude], pointIndex) => {
        const world = lonLatToWorld(longitude, latitude, zoom);
        if (pointIndex === 0) path.moveTo(world.x, world.y);
        else path.lineTo(world.x, world.y);
      });
      path.closePath();
    }
    naturalEarthPathCache.set(zoom, path);
    return path;
  };

  const getNaturalEarthGeographicPath = () => {
    const cacheKey = "earth-geographic";
    if (naturalEarthLandState !== "ready" || typeof Path2D === "undefined") return null;
    if (naturalEarthPathCache.has(cacheKey)) return naturalEarthPathCache.get(cacheKey);
    const path = new Path2D();
    for (const ring of naturalEarthLandRings) {
      if (ring.length < 3) continue;
      ring.forEach(([longitude, latitude], pointIndex) => {
        const x = longitude + 180;
        const y = 90 - latitude;
        if (pointIndex === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.closePath();
    }
    naturalEarthPathCache.set(cacheKey, path);
    return path;
  };

  const getNaturalEarthCountryGeographicPath = (iso3) => {
    if (naturalEarthCountryState !== "ready" || typeof Path2D === "undefined") return null;
    const cacheKey = `earth-country-${iso3}`;
    if (naturalEarthCountryPathCache.has(cacheKey)) return naturalEarthCountryPathCache.get(cacheKey);
    const rings = naturalEarthCountryRings.get(iso3) || [];
    if (!rings.length) return null;
    const path = new Path2D();
    for (const ring of rings) {
      if (ring.length < 3) continue;
      ring.forEach(([longitude, latitude], pointIndex) => {
        const x = longitude + 180;
        const y = 90 - latitude;
        if (pointIndex === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.closePath();
    }
    naturalEarthCountryPathCache.set(cacheKey, path);
    return path;
  };

  const getNaturalEarthCountryBoundaryGeographicPath = () => {
    if (naturalEarthCountryState !== "ready" || typeof Path2D === "undefined") return null;
    const cacheKey = "earth-country-boundaries";
    if (naturalEarthCountryPathCache.has(cacheKey)) return naturalEarthCountryPathCache.get(cacheKey);
    const path = new Path2D();
    for (const ring of naturalEarthCountryBoundaryRings) {
      if (ring.length < 3) continue;
      ring.forEach(([longitude, latitude], pointIndex) => {
        const x = longitude + 180;
        const y = 90 - latitude;
        if (pointIndex === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.closePath();
    }
    naturalEarthCountryPathCache.set(cacheKey, path);
    return path;
  };

  const getJapanPrefectureBoundaryGeographicPath = () => {
    if (japanPrefectureBoundaryState !== "ready" || typeof Path2D === "undefined") return null;
    const cacheKey = "earth-prefecture-boundaries";
    if (japanPrefectureBoundaryPathCache.has(cacheKey)) {
      return japanPrefectureBoundaryPathCache.get(cacheKey);
    }
    const path = new Path2D();
    for (const arc of japanPrefectureBoundaryArcs) {
      arc.forEach(([longitude, latitude], pointIndex) => {
        const x = longitude + 180;
        const y = 90 - latitude;
        if (pointIndex === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
    }
    japanPrefectureBoundaryPathCache.set(cacheKey, path);
    return path;
  };

  const getJapanPrefectureBoundaryMercatorPath = (zoom) => {
    if (japanPrefectureBoundaryState !== "ready" || typeof Path2D === "undefined") return null;
    const cacheKey = `mercator-prefecture-boundaries-${zoom}`;
    if (japanPrefectureBoundaryPathCache.has(cacheKey)) {
      return japanPrefectureBoundaryPathCache.get(cacheKey);
    }
    const path = new Path2D();
    for (const arc of japanPrefectureBoundaryArcs) {
      arc.forEach(([longitude, latitude], pointIndex) => {
        const point = lonLatToWorld(longitude, latitude, zoom);
        if (pointIndex === 0) path.moveTo(point.x, point.y);
        else path.lineTo(point.x, point.y);
      });
    }
    japanPrefectureBoundaryPathCache.set(cacheKey, path);
    return path;
  };

  const drawPercentageCountryChoropleth = (ctx, rect, rows, selectedIso3, now, valueKey, emphasizeSelection = true) => {
    if (mapScope !== "earth" || naturalEarthCountryState !== "ready") {
      return { filledCount: 0, visibleCount: 0 };
    }
    const projection = japanView.earthProjection || getEarthProjection(rect);
    const { originX, originY, width, height, scale } = projection;
    const worldCopies = getEarthWorldCopies(projection);
    let filledCount = 0;
    let visibleCount = 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(originX, originY, width, height);
    ctx.clip();
    rows.forEach((row, index) => {
      if (!Number.isFinite(row[valueKey]) || row[valueKey] < 0 || row[valueKey] > 100) return;
      const path = getNaturalEarthCountryGeographicPath(row.mapIso3 || row.iso3);
      if (!path) return;
      const reveal = getMapPlotReveal(index, rows.length, now);
      if (reveal.progress <= 0) return;
      filledCount += 1;
      visibleCount += reveal.alpha >= 0.12 ? 1 : 0;
      const ratio = clamp(row[valueKey] / 100, 0, 1);
      const selected = row.iso3 === selectedIso3;
      const red = Math.round(14 + ratio * 32);
      const green = Math.round(72 + ratio * 158);
      const blue = Math.round(150 + ratio * 105);
      for (const copy of worldCopies) {
        ctx.save();
        ctx.translate(copy.x, copy.y);
        ctx.scale(scale, scale);
        ctx.fillStyle = `rgba(${red},${green},${blue},${reveal.alpha * (selected && emphasizeSelection ? 0.94 : 0.38 + ratio * 0.5)})`;
        ctx.fill(path, "evenodd");
        ctx.strokeStyle = selected
          ? `rgba(255,239,146,${reveal.alpha * 0.98})`
          : `rgba(110,210,255,${reveal.alpha * (0.28 + ratio * 0.5)})`;
        ctx.lineWidth = (selected ? 2.8 : 0.8) / scale;
        ctx.stroke(path);
        ctx.restore();
      }
    });
    ctx.restore();
    return { filledCount, visibleCount };
  };

  const drawRenewableCountryChoropleth = (ctx, rect, rows, selectedIso3, now) =>
    drawPercentageCountryChoropleth(ctx, rect, rows, selectedIso3, now, "renewablePercent");

  const drawAnthropoceneCountryChoropleth = (ctx, rect, rows, selectedIso3, now) => {
    if (mapScope !== "earth" || naturalEarthCountryState !== "ready") {
      return { filledCount: 0, visibleCount: 0, heatSum: 0, maximumHeat: 0 };
    }
    const projection = japanView.earthProjection || getEarthProjection(rect);
    const { originX, originY, width, height, scale } = projection;
    const worldCopies = getEarthWorldCopies(projection);
    let filledCount = 0;
    let visibleCount = 0;
    let heatSum = 0;
    let maximumHeat = 0;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.rect(originX, originY, width, height);
    ctx.clip();
    rows.forEach((row, index) => {
      const path = getNaturalEarthCountryGeographicPath(row.mapIso3 || row.iso3);
      if (!path) return;
      const reveal = getMapPlotReveal(index, rows.length, now);
      if (reveal.progress <= 0) return;
      const heat = getAnthropoceneEmissionHeat(row.emissionsMtCo2);
      const selected = row.iso3 === selectedIso3;
      const [red, green, blue] = getAnthropoceneHeatColor(heat);
      filledCount += 1;
      visibleCount += reveal.alpha >= 0.12 ? 1 : 0;
      heatSum += heat;
      maximumHeat = Math.max(maximumHeat, heat);
      for (const copy of worldCopies) {
        ctx.save();
        ctx.translate(copy.x, copy.y);
        ctx.scale(scale, scale);
        ctx.fillStyle = `rgba(${red},${green},${blue},${reveal.alpha * (0.4 + heat * 0.52)})`;
        ctx.fill(path, "evenodd");
        ctx.strokeStyle = selected
          ? "rgba(255,242,178,.98)"
          : `rgba(${Math.min(255, red + 30)},${Math.min(255, green + 20)},${Math.min(255, blue + 12)},${reveal.alpha * (0.22 + heat * 0.42)})`;
        ctx.lineWidth = (selected ? 2.8 : 0.72) / scale;
        ctx.stroke(path);
        ctx.restore();
      }
    });
    ctx.restore();
    return { filledCount, visibleCount, heatSum, maximumHeat };
  };

  // The current field is already behind this canvas. An opaque land surface
  // prevents its ribbons from showing through Japan, without covering sea POIs.
  const currentMapHasOpaqueLand = () => canvas.dataset.integratedMapMode === "02";
  const CURRENT_MAP_LAND_FILL = "#153d40";

  const renderReferenceLand = (ctx, repeatOffset, left, top) => {
    const referencePath = getNaturalEarthLandPath(japanView.zoom);
    if (referencePath) {
      ctx.save();
      ctx.translate(repeatOffset - left, -top);
      ctx.fillStyle = currentMapHasOpaqueLand() ? CURRENT_MAP_LAND_FILL : "rgba(29, 86, 84, 0.2)";
      ctx.fill(referencePath, "evenodd");
      ctx.strokeStyle = "rgba(135, 244, 216, 0.56)";
      ctx.lineWidth = japanView.zoom >= 2 ? 1.05 : 0.78;
      ctx.stroke(referencePath);
      ctx.restore();
      return true;
    }

    for (const landmass of SIMPLE_WORLD_LANDMASSES) {
      ctx.beginPath();
      landmass.points.forEach(([longitude, latitude], pointIndex) => {
        const world = lonLatToWorld(longitude, latitude);
        const x = world.x - left + repeatOffset;
        const y = world.y - top;
        if (pointIndex === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = currentMapHasOpaqueLand() ? CURRENT_MAP_LAND_FILL : "rgba(29, 86, 84, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "rgba(135, 244, 216, 0.52)";
      ctx.lineWidth = japanView.zoom >= 2 ? 1.15 : 0.9;
      ctx.stroke();
    }

    for (const islandLine of SIMPLE_WORLD_ISLAND_LINES) {
      ctx.beginPath();
      islandLine.forEach(([longitude, latitude], pointIndex) => {
        const world = lonLatToWorld(longitude, latitude);
        const x = world.x - left + repeatOffset;
        const y = world.y - top;
        if (pointIndex === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "rgba(151, 247, 220, 0.58)";
      ctx.lineWidth = japanView.zoom >= 2 ? 1.05 : 0.8;
      ctx.stroke();
    }
    return false;
  };

  const updateMapBasisNote = () => {
    if (naturalEarthLandState === "ready") {
      const boundariesReady = naturalEarthCountryState === "ready"
        && japanPrefectureBoundaryState === "ready";
      mapScopeNote.innerHTML =
        mapScope === "earth"
          ? `BASEMAP / NATURAL EARTH 1:50m<br />${boundariesReady
            ? "COUNTRY BORDERS · PREFECTURES / GLOBAL MAP JAPAN"
            : "LOCAL BOUNDARY VECTORS LOADING"}`
          : `BASEMAP / NATURAL EARTH 1:50m<br />${boundariesReady
            ? "PREFECTURES / GLOBAL MAP JAPAN"
            : "LOCAL BOUNDARY VECTORS LOADING"}`;
      return;
    }
    if (naturalEarthLandState === "error") {
      mapScopeNote.innerHTML =
        "BASEMAP / EMBEDDED FALLBACK<br />NATURAL EARTH FILE COULD NOT LOAD";
      return;
    }
    mapScopeNote.innerHTML = "BASEMAP / NATURAL EARTH 1:50m<br />LOCAL VECTOR LOADING";
  };

  const renderReferenceWorldModel = (ctx, rect, left, top) => {
    if (mapScope === "earth") {
      const warmStatMap = japanLayer.classList.contains("is-estat-exhibit");
      const opaqueCurrentLand = currentMapHasOpaqueLand();
      const projection = japanView.earthProjection || getEarthProjection(rect);
      const { originX, originY, width, height, scale } = projection;
      const worldCopies = getEarthWorldCopies(projection);
      japanOverlay.dataset.vectorWorldCopies = worldCopies
        .map((copy) => copy.x.toFixed(2))
        .join(",");
      const geographicPath = getNaturalEarthGeographicPath();
      const countryBoundaryPath = getNaturalEarthCountryBoundaryGeographicPath();
      const prefectureBoundaryPath = getJapanPrefectureBoundaryGeographicPath();
      const prefectureBoundaryOpacity = clamp((japanView.earthZoom - 1.65) / 0.8, 0, 1);
      const showPrefectureBoundaries = Boolean(prefectureBoundaryPath && prefectureBoundaryOpacity > 0);
      japanOverlay.dataset.worldBoundaryLayer = countryBoundaryPath ? "country" : naturalEarthCountryState;
      japanOverlay.dataset.worldBoundaryRingCount = String(naturalEarthCountryBoundaryRings.length);
      japanOverlay.dataset.prefectureBoundaryLayer = showPrefectureBoundaries
        ? "prefecture"
        : japanPrefectureBoundaryState === "ready" ? "hidden-global" : japanPrefectureBoundaryState;
      japanOverlay.dataset.prefectureBoundaryArcCount = String(japanPrefectureBoundaryArcs.length);

      ctx.save();
      ctx.beginPath();
      ctx.rect(originX, originY, width, height);
      ctx.clip();
      ctx.fillStyle = warmStatMap ? "rgba(27, 66, 69, 0.18)" : "rgba(7, 25, 43, 0.46)";
      ctx.fillRect(originX, originY, width, height);

      ctx.setLineDash([2, 9]);
      ctx.lineWidth = 0.55;
      ctx.strokeStyle = "rgba(135, 224, 211, 0.105)";
      for (let longitude = -180; longitude <= 180; longitude += 30) {
        const x = originX + earthLongitudeToMapX(longitude) * scale;
        ctx.beginPath();
        ctx.moveTo(x, originY);
        ctx.lineTo(x, originY + height);
        ctx.stroke();
      }
      for (let latitude = -90; latitude <= 90; latitude += 30) {
        const y = originY + (90 - latitude) * scale;
        ctx.beginPath();
        ctx.moveTo(originX, y);
        ctx.lineTo(originX + width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      if (geographicPath) {
        for (const copy of worldCopies) {
          ctx.save();
          ctx.translate(copy.x, copy.y);
          ctx.scale(scale, scale);
          ctx.fillStyle = opaqueCurrentLand ? CURRENT_MAP_LAND_FILL
            : warmStatMap ? "rgba(116, 163, 140, 0.68)" : "rgba(29, 86, 84, 0.28)";
          ctx.fill(geographicPath, "evenodd");
          ctx.strokeStyle = warmStatMap ? "rgba(207, 226, 193, 0.74)" : "rgba(135, 244, 216, 0.68)";
          ctx.lineWidth = 1.05 / scale;
          ctx.stroke(geographicPath);
          ctx.restore();
        }
      } else {
        for (const copy of worldCopies) {
          for (const landmass of SIMPLE_WORLD_LANDMASSES) {
            ctx.beginPath();
            landmass.points.forEach(([longitude, latitude], pointIndex) => {
              const x = copy.x + (longitude + 180) * scale;
              const y = originY + (90 - latitude) * scale;
              if (pointIndex === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fillStyle = opaqueCurrentLand ? CURRENT_MAP_LAND_FILL
              : warmStatMap ? "rgba(116, 163, 140, 0.64)" : "rgba(29, 86, 84, 0.24)";
            ctx.fill();
            ctx.strokeStyle = warmStatMap ? "rgba(207, 226, 193, 0.64)" : "rgba(135, 244, 216, 0.58)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      if (countryBoundaryPath) {
        for (const copy of worldCopies) {
          ctx.save();
          ctx.translate(copy.x, copy.y);
          ctx.scale(scale, scale);
          ctx.strokeStyle = warmStatMap ? "rgba(206, 221, 184, 0.46)" : "rgba(194, 241, 229, 0.48)";
          ctx.lineWidth = 0.58 / scale;
          ctx.stroke(countryBoundaryPath);
          ctx.restore();
        }
      }

      if (showPrefectureBoundaries) {
        for (const copy of worldCopies) {
          ctx.save();
          ctx.translate(copy.x, copy.y);
          ctx.scale(scale, scale);
          ctx.strokeStyle = `rgba(226, 255, 246, ${0.42 + prefectureBoundaryOpacity * 0.42})`;
          ctx.lineWidth = (0.72 + prefectureBoundaryOpacity * 0.22) / scale;
          ctx.stroke(prefectureBoundaryPath);
          ctx.restore();
        }
      }

      if (rect.width >= 760) {
        for (const landmass of SIMPLE_WORLD_LANDMASSES) {
          const labelX = originX + earthLongitudeToMapX(landmass.labelAt[0]) * scale;
          const labelY = originY + (90 - landmass.labelAt[1]) * scale;
          ctx.fillStyle = "rgba(187, 240, 226, 0.34)";
          ctx.font = '6px Consolas, "Courier New", monospace';
          ctx.textAlign = "center";
          ctx.fillText(landmass.label, labelX, labelY);
        }
      }

      const equatorY = originY + 90 * scale;
      ctx.setLineDash([8, 12]);
      ctx.strokeStyle = "rgba(164, 244, 221, 0.22)";
      ctx.beginPath();
      ctx.moveTo(originX, equatorY);
      ctx.lineTo(originX + width, equatorY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(135, 244, 216, 0.3)";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(originX, originY, width, height);
      ctx.textAlign = "start";
      ctx.restore();
      return;
    }

    const worldSize = MAP_TILE_SIZE * 2 ** japanView.zoom;
    const firstRepeat = Math.floor(left / worldSize) - 1;
    const lastRepeat = Math.ceil((left + rect.width) / worldSize) + 1;
    const northY = lonLatToWorld(0, 80).y - top;
    const southY = lonLatToWorld(0, -80).y - top;
    const prefectureBoundaryPath = getJapanPrefectureBoundaryMercatorPath(japanView.zoom);
    japanOverlay.dataset.worldBoundaryLayer = "hidden-japan";
    japanOverlay.dataset.worldBoundaryRingCount = String(naturalEarthCountryBoundaryRings.length);
    japanOverlay.dataset.prefectureBoundaryLayer = prefectureBoundaryPath
      ? "prefecture"
      : japanPrefectureBoundaryState;
    japanOverlay.dataset.prefectureBoundaryArcCount = String(japanPrefectureBoundaryArcs.length);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, rect.width, rect.height);
    ctx.clip();

    ctx.setLineDash([2, 9]);
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = "rgba(135, 224, 211, 0.105)";
    for (let repeat = firstRepeat; repeat <= lastRepeat; repeat += 1) {
      const repeatOffset = repeat * worldSize;
      for (let longitude = -180; longitude < 180; longitude += 30) {
        const x = lonLatToWorld(longitude, 0).x - left + repeatOffset;
        ctx.beginPath();
        ctx.moveTo(x, northY);
        ctx.lineTo(x, southY);
        ctx.stroke();
      }
      for (let latitude = -60; latitude <= 60; latitude += 30) {
        const y = lonLatToWorld(0, latitude).y - top;
        ctx.beginPath();
        ctx.moveTo(-left + repeatOffset, y);
        ctx.lineTo(worldSize - left + repeatOffset, y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    for (let repeat = firstRepeat; repeat <= lastRepeat; repeat += 1) {
      const repeatOffset = repeat * worldSize;
      renderReferenceLand(ctx, repeatOffset, left, top);

      if (prefectureBoundaryPath) {
        ctx.save();
        ctx.translate(repeatOffset - left, -top);
        ctx.strokeStyle = "rgba(226, 255, 246, 0.82)";
        ctx.lineWidth = japanView.zoom >= 4 ? 0.95 : 0.78;
        ctx.stroke(prefectureBoundaryPath);
        ctx.restore();
      }

      if (japanView.zoom >= 2 && rect.width >= 760) {
        for (const landmass of SIMPLE_WORLD_LANDMASSES) {
          const labelWorld = lonLatToWorld(...landmass.labelAt);
          const labelX = labelWorld.x - left + repeatOffset;
          const labelY = labelWorld.y - top;
          if (labelX > -120 && labelX < rect.width + 120) {
            ctx.fillStyle = "rgba(187, 240, 226, 0.32)";
            ctx.font = '6px Consolas, "Courier New", monospace';
            ctx.textAlign = "center";
            ctx.fillText(landmass.label, labelX, labelY);
          }
        }
      }

      ctx.strokeStyle = "rgba(135, 224, 211, 0.16)";
      ctx.lineWidth = 0.7;
      ctx.strokeRect(-left + repeatOffset, northY, worldSize, southY - northY);
    }

    const equatorY = lonLatToWorld(0, 0).y - top;
    ctx.setLineDash([8, 12]);
    ctx.strokeStyle = "rgba(164, 244, 221, 0.18)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, equatorY);
    ctx.lineTo(rect.width, equatorY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "start";
    ctx.restore();
  };

  const renderCachedReferenceWorldModel = (ctx, rect, left, top) => {
    japanOverlay.dataset.referenceLandSurface = currentMapHasOpaqueLand() ? "opaque-current-land" : "translucent";
    if (!referenceWorldContext || referenceWorldContext.isContextLost?.()) {
      japanOverlay.dataset.referenceWorldCache = "direct-fallback";
      renderReferenceWorldModel(ctx, rect, left, top);
      return;
    }

    const logicalWidth = Math.max(1, Math.ceil(rect.width));
    const logicalHeight = Math.max(1, Math.ceil(rect.height));
    const cacheScale = Math.min(1, 2048 / logicalWidth, 2048 / logicalHeight);
    const width = Math.max(1, Math.ceil(logicalWidth * cacheScale));
    const height = Math.max(1, Math.ceil(logicalHeight * cacheScale));
    const projection = mapScope === "earth"
      ? japanView.earthProjection || getEarthProjection(rect)
      : null;
    const cacheKey = [
      mapScope,
      japanLayer.classList.contains("is-estat-exhibit") ? "warm-stat-map" : "default-map",
      currentMapHasOpaqueLand() ? "opaque-current-land" : "translucent-land",
      naturalEarthLandState,
      naturalEarthLandRings.length,
      naturalEarthCountryState,
      naturalEarthCountryBoundaryRings.length,
      japanPrefectureBoundaryState,
      japanPrefectureBoundaryArcs.length,
      logicalWidth,
      logicalHeight,
      Math.round(cacheScale * 1000),
      width,
      height,
      japanView.zoom,
      Math.round(left),
      Math.round(top),
      projection ? Math.round(projection.scale * 1000) : 0,
      projection ? Math.round(projection.originX) : 0,
      projection ? Math.round(projection.originY) : 0,
    ].join("/");

    if (cacheKey !== referenceWorldCacheKey) {
      if (referenceWorldCanvas.width !== width || referenceWorldCanvas.height !== height) {
        referenceWorldCanvas.width = width;
        referenceWorldCanvas.height = height;
      }
      referenceWorldContext.setTransform(1, 0, 0, 1, 0, 0);
      referenceWorldContext.clearRect(0, 0, width, height);
      referenceWorldContext.setTransform(cacheScale, 0, 0, cacheScale, 0, 0);
      renderReferenceWorldModel(referenceWorldContext, {
        width: logicalWidth,
        height: logicalHeight,
      }, left, top);
      referenceWorldContext.setTransform(1, 0, 0, 1, 0, 0);
      referenceWorldCacheKey = cacheKey;
    }

    japanOverlay.dataset.referenceWorldCache = "ready";
    japanOverlay.dataset.referenceWorldPalette = japanLayer.classList.contains("is-estat-exhibit") ? "warm-sage" : "default";
    japanOverlay.dataset.referenceWorldRenderScale = cacheScale.toFixed(4);
    japanOverlay.dataset.referenceWorldBackingSize = `${width}x${height}`;
    ctx.drawImage(referenceWorldCanvas, 0, 0, width, height, 0, 0, rect.width, rect.height);
  };

  const invalidateReferenceWorldCache = () => {
    referenceWorldCacheKey = "";
    japanTilesDirty = true;
  };

  const japanScreenToLonLat = (x, y, left, top) => {
    if (mapScope === "earth") {
      const projection = japanView.earthProjection || getEarthProjection(japanMap.getBoundingClientRect());
      const mapLongitude = (x - projection.originX) / projection.scale - 180;
      return {
        lon: wrapLongitude(mapLongitude + EARTH_INITIAL_CENTER_LONGITUDE),
        lat: clamp(90 - (y - projection.originY) / projection.scale, -90, 90),
      };
    }
    const worldSize = MAP_TILE_SIZE * 2 ** japanView.zoom;
    const worldX = left + x;
    const worldY = top + y;
    const unwrappedLongitude = (worldX / worldSize) * 360 - 180;
    const longitude = ((unwrappedLongitude + 540) % 360) - 180;
    const mercatorN = Math.PI - (2 * Math.PI * worldY) / worldSize;
    return {
      lon: longitude,
      lat: (Math.atan(Math.sinh(mercatorN)) * 180) / Math.PI,
    };
  };

  const getJmaEventTitle = (event) => JMA_EVENT_TITLES[event.id] || event.name;
  const getMaximumIntensityText = (event) =>
    String(event.maximumIntensity || "—").normalize("NFKC");
  const getIntensityColor = (intensityCode, alpha = 1) => {
    if (intensityCode === "7") {
      return `rgba(255, 80, 121, ${alpha})`;
    }
    if (intensityCode === "D") {
      return `rgba(255, 141, 72, ${alpha})`;
    }
    return `rgba(255, 209, 102, ${alpha})`;
  };
  const getIntensityShortLabel = (intensityCode) =>
    intensityCode === "7" ? "7" : intensityCode === "D" ? "6+" : "6-";

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const toDegrees = (radians) => (radians * 180) / Math.PI;
  const getSurfaceDistanceKm = (lonA, latA, lonB, latB) => {
    const latitudeA = toRadians(latA);
    const latitudeB = toRadians(latB);
    const latitudeDelta = latitudeB - latitudeA;
    const longitudeDelta = toRadians(lonB - lonA);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
  };
  const getDestinationLonLat = (lon, lat, bearingDegrees, distanceKm) => {
    const angularDistance = distanceKm / EARTH_RADIUS_KM;
    const bearing = toRadians(bearingDegrees);
    const latitude = toRadians(lat);
    const longitude = toRadians(lon);
    const destinationLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const destinationLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude),
      );
    return {
      lon: ((toDegrees(destinationLongitude) + 540) % 360) - 180,
      lat: toDegrees(destinationLatitude),
    };
  };
  const getSurfaceWaveRadiusKm = (travelDistanceKm, depthKm) =>
    Math.sqrt(Math.max(0, travelDistanceKm ** 2 - depthKm ** 2));
  const drawGeodesicWaveRing = (
    ctx,
    event,
    radiusKm,
    left,
    top,
    strokeStyle,
    lineWidth,
  ) => {
    if (radiusKm <= 0 || radiusKm > JAPAN_WAVE_VISUAL_LIMIT_KM) {
      return null;
    }
    let labelPoint = null;
    ctx.beginPath();
    for (let bearing = 0; bearing <= 360; bearing += 5) {
      const destination = getDestinationLonLat(
        event.longitude,
        event.latitude,
        bearing,
        radiusKm,
      );
      const point = japanWorldToScreen(destination.lon, destination.lat, left, top);
      if (bearing === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
      if (bearing === 75) {
        labelPoint = point;
      }
    }
    ctx.closePath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    return labelPoint;
  };

  const renderJapanHistoryReplay = (ctx, rect, left, top, now) => {
    if (japanDataLayer !== "history" || japanWaveReplay?.kind !== "history") {
      return;
    }

    const event = japanWaveReplay.event;
    const source = japanWorldToScreen(event.longitude, event.latitude, left, top);
    const elapsedSeconds = reducedMotion
      ? Number.POSITIVE_INFINITY
      : Math.max(0, now - japanWaveReplay.bornAt) / 1000;
    const pTravelDistanceKm = elapsedSeconds * P_WAVE_SPEED_KM_S;
    const sTravelDistanceKm = elapsedSeconds * S_WAVE_SPEED_KM_S;
    const pSurfaceRadiusKm = getSurfaceWaveRadiusKm(pTravelDistanceKm, event.depthKm);
    const sSurfaceRadiusKm = getSurfaceWaveRadiusKm(sTravelDistanceKm, event.depthKm);

    if (!reducedMotion) {
      const pLabelPoint = drawGeodesicWaveRing(
        ctx,
        event,
        pSurfaceRadiusKm,
        left,
        top,
        "rgba(121, 222, 255, 0.64)",
        1.3,
      );
      if (pLabelPoint) {
        ctx.fillStyle = "rgba(174, 235, 255, 0.88)";
        ctx.font = '7px Consolas, "Courier New", monospace';
        ctx.fillText("P / 7.0 KM/S", pLabelPoint.x + 6, pLabelPoint.y - 5);
      }

      const sLabelPoint = drawGeodesicWaveRing(
        ctx,
        event,
        sSurfaceRadiusKm,
        left,
        top,
        "rgba(255, 126, 97, 0.82)",
        1.8,
      );
      if (sLabelPoint) {
        ctx.fillStyle = "rgba(255, 184, 139, 0.92)";
        ctx.font = '7px Consolas, "Courier New", monospace';
        ctx.fillText("S / 4.0 KM/S", sLabelPoint.x + 6, sLabelPoint.y + 11);
      }
    }

    const sourcePulse = reducedMotion ? 4 : 4 + Math.sin(now * 0.012) * 1.5;
    ctx.beginPath();
    ctx.arc(source.x, source.y, sourcePulse, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 240, 209, 0.95)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 240, 209, 0.82)";
    ctx.font = '7px Consolas, "Courier New", monospace';
    ctx.fillText(
      reducedMotion
        ? `出典値 / 深さ ${event.depthKm} km / 静止表示`
        : `出典値 / 深さ ${event.depthKm} km / 発生後${Math.floor(elapsedSeconds)}秒`,
      source.x + 9,
      source.y + 15,
    );

    const occupiedLabelCells = new Set();
    let arrivedCount = 0;
    for (const observation of event.observations) {
      const point = japanWorldToScreen(
        observation.longitude,
        observation.latitude,
        left,
        top,
      );
      const surfaceDistanceKm = getSurfaceDistanceKm(
        event.longitude,
        event.latitude,
        observation.longitude,
        observation.latitude,
      );
      const hypocentralDistanceKm = Math.hypot(surfaceDistanceKm, event.depthKm);
      if (!reducedMotion && sTravelDistanceKm < hypocentralDistanceKm) {
        continue;
      }
      arrivedCount += 1;
      if (
        point.x < -24 ||
        point.x > rect.width + 24 ||
        point.y < -24 ||
        point.y > rect.height + 24
      ) {
        continue;
      }

      const arrival = reducedMotion
        ? 1
        : clamp((sTravelDistanceKm - hypocentralDistanceKm) / 24, 0.12, 1);
      const pointRadius = observation.intensityCode === "7" ? 5.2 : observation.intensityCode === "D" ? 4 : 3.2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, pointRadius + (1 - arrival) * 7, 0, Math.PI * 2);
      ctx.fillStyle = getIntensityColor(observation.intensityCode, 0.32 + arrival * 0.58);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(point.x, point.y, pointRadius + 5 + (1 - arrival) * 8, 0, Math.PI * 2);
      ctx.strokeStyle = getIntensityColor(observation.intensityCode, 0.12 + arrival * 0.28);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const cell = `${Math.round(point.x / 58)}:${Math.round(point.y / 30)}`;
      if (observation.intensityCode === "7" || !occupiedLabelCells.has(cell)) {
        occupiedLabelCells.add(cell);
        ctx.fillStyle = getIntensityColor(observation.intensityCode, 0.9);
        ctx.font = '7px Consolas, "Courier New", monospace';
        ctx.fillText(getIntensityShortLabel(observation.intensityCode), point.x + 7, point.y - 5);
      }
    }
    japanWaveReplay.arrivedCount = arrivedCount;
  };

  const nightLightsImage = new Image();
  nightLightsImage.src = "./assets/data/viirs-night-lights-2016.png";
  const landCoverImage = new Image();
  landCoverImage.src = "./assets/data/modis-land-cover-2023.png";
  const geographicRasterCache = new WeakMap();
  const forestRasterCache = new WeakMap();

  const getRasterDimensions = (image) => ({
    width: image?.naturalWidth || image?.videoWidth || image?.width || 0,
    height: image?.naturalHeight || image?.videoHeight || image?.height || 0,
  });

  const getGeographicRaster = (image) => {
    const source = getRasterDimensions(image);
    if (!source.width || !source.height) return null;
    const aspectRatio = source.width / source.height;
    if (aspectRatio > 1.5) return image;

    const cached = geographicRasterCache.get(image);
    if (
      cached?.sourceWidth === source.width &&
      cached?.sourceHeight === source.height
    ) {
      return cached.canvas;
    }

    // The local NASA land-cover and night-light snapshots are square Web
    // Mercator rasters. Convert each one only once to the same geographic
    // 2:1 projection used by the vector coastline, then reuse that canvas.
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, source.width * 2);
    canvas.height = Math.max(1, source.height);
    const rasterContext = canvas.getContext("2d");
    if (!rasterContext) return image;

    const latitudeLimit = 85.05112878;
    const latitudeBands = Math.min(720, canvas.height);
    const mercatorY = (latitude) => {
      const radians = clamp(latitude, -latitudeLimit, latitudeLimit) * Math.PI / 180;
      return (
        1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI
      ) / 2;
    };

    for (let index = 0; index < latitudeBands; index += 1) {
      const latitudeTop = latitudeLimit - (index / latitudeBands) * latitudeLimit * 2;
      const latitudeBottom = latitudeLimit - ((index + 1) / latitudeBands) * latitudeLimit * 2;
      const sourceTop = mercatorY(latitudeTop) * source.height;
      const sourceBottom = mercatorY(latitudeBottom) * source.height;
      const targetTop = ((90 - latitudeTop) / 180) * canvas.height;
      const targetBottom = ((90 - latitudeBottom) / 180) * canvas.height;

      rasterContext.drawImage(
        image,
        0,
        sourceTop,
        source.width,
        Math.max(0.001, sourceBottom - sourceTop),
        0,
        targetTop,
        canvas.width,
        Math.max(0.001, targetBottom - targetTop + 0.5),
      );
    }

    geographicRasterCache.set(image, {
      canvas,
      sourceWidth: source.width,
      sourceHeight: source.height,
    });
    return canvas;
  };

  const parseOvationAuroraPayload = (payload) => {
    const coordinates = Array.isArray(payload?.coordinates)
      ? payload.coordinates
        .map((row) => [Number(row?.[0]), Number(row?.[1]), Number(row?.[2])])
        .filter(([lon, lat, value]) =>
          Number.isFinite(lon) && Number.isFinite(lat) && Number.isFinite(value)
          && Math.abs(lat) >= 40 && value > 0,
        )
      : [];
    if (coordinates.length < 80) throw new Error("Invalid OVATION aurora grid");
    const maximum = Math.max(1, ...coordinates.map((row) => row[2]));
    return {
      coordinates,
      maximum,
      observationTime: String(payload["Observation Time"] || payload.observationTime || ""),
      forecastTime: String(payload["Forecast Time"] || payload.forecastTime || ""),
      sampleStep: payload.sampleStep || null,
    };
  };

  const mixOvationColor = (value, maximum, alpha) => {
    const normalized = clamp(value / Math.max(1, maximum), 0, 1);
    const stops = normalized < 0.56
      ? { from: [71, 255, 181], to: [105, 222, 255], mix: normalized / 0.56 }
      : { from: [105, 222, 255], to: [255, 231, 153], mix: (normalized - 0.56) / 0.44 };
    const color = stops.from.map((component, index) =>
      Math.round(component + (stops.to[index] - component) * stops.mix),
    );
    return `rgba(${color.join(",")},${alpha})`;
  };

  const rebuildOvationAuroraRaster = (forecast) => {
    if (!ovationAuroraContext || !ovationAuroraRawContext) return;
    const width = 720;
    const height = 360;
    ovationAuroraCanvas.width = width;
    ovationAuroraCanvas.height = height;
    ovationAuroraRawCanvas.width = width;
    ovationAuroraRawCanvas.height = height;
    const longitudeStep = Math.max(1, Number(forecast.sampleStep?.longitudeDegrees) || 1);
    const latitudeStep = Math.max(1, Number(forecast.sampleStep?.latitudeDegrees) || 1);

    ovationAuroraRawContext.clearRect(0, 0, width, height);
    ovationAuroraRawContext.globalCompositeOperation = "source-over";
    for (const [sourceLongitude, latitude, value] of forecast.coordinates) {
      const visibilityFloor = Math.max(2, forecast.maximum * 0.08);
      if (value < visibilityFloor) continue;
      const longitude = ((sourceLongitude + 540) % 360) - 180;
      const x = ((longitude + 180) / 360) * width;
      const y = ((90 - latitude) / 180) * height;
      const normalized = clamp(
        (value - visibilityFloor) / Math.max(1, forecast.maximum - visibilityFloor),
        0,
        1,
      );
      const alpha = 0.12 + Math.pow(normalized, 0.88) * 0.82;
      const cellWidth = Math.max(2.2, longitudeStep * width / 360 + 0.8);
      const cellHeight = Math.max(2.2, latitudeStep * height / 180 + 0.8);
      ovationAuroraRawContext.fillStyle = mixOvationColor(value, forecast.maximum, alpha);
      ovationAuroraRawContext.fillRect(
        x - cellWidth / 2,
        y - cellHeight / 2,
        cellWidth,
        cellHeight,
      );
    }

    ovationAuroraContext.clearRect(0, 0, width, height);
    ovationAuroraContext.globalCompositeOperation = "lighter";
    ovationAuroraContext.filter = "blur(12px)";
    ovationAuroraContext.globalAlpha = 0.76;
    for (const offset of [-width, 0, width]) {
      ovationAuroraContext.drawImage(ovationAuroraRawCanvas, offset, 0);
    }
    ovationAuroraContext.filter = "blur(3px)";
    ovationAuroraContext.globalAlpha = 0.58;
    for (const offset of [-width, 0, width]) {
      ovationAuroraContext.drawImage(ovationAuroraRawCanvas, offset, 0);
    }
    ovationAuroraContext.filter = "none";
    ovationAuroraContext.globalAlpha = 1;
    ovationAuroraContext.globalCompositeOperation = "source-over";
  };

  const loadOvationAuroraForecast = async () => {
    window.clearTimeout(ovationAuroraReloadTimer);
    let payload;
    let source = "live";
    try {
      payload = await fetchJsonWithTimeout(OVATION_AURORA_LIVE_DATA, 7000);
    } catch {
      source = "snapshot";
      try {
        payload = await fetchJsonWithTimeout(OVATION_AURORA_FALLBACK_DATA, 3500);
      } catch {
        payload = null;
      }
    }
    try {
      const forecast = parseOvationAuroraPayload(payload);
      rebuildOvationAuroraRaster(forecast);
      ovationAuroraState = {
        status: "ready",
        source,
        observationTime: forecast.observationTime,
        forecastTime: forecast.forecastTime,
        pointCount: forecast.coordinates.length,
        maximum: forecast.maximum,
      };
    } catch {
      ovationAuroraState = { ...ovationAuroraState, status: "offline", source };
    }
    ovationAuroraReloadTimer = window.setTimeout(
      loadOvationAuroraForecast,
      OVATION_AURORA_REFRESH_MS,
    );
  };

  const getForestGeographicRaster = (image) => {
    const geographicRaster = getGeographicRaster(image);
    if (!geographicRaster) return null;
    const cached = forestRasterCache.get(image);
    if (
      cached?.source === geographicRaster &&
      cached.canvas.width === geographicRaster.width &&
      cached.canvas.height === geographicRaster.height
    ) {
      return cached.canvas;
    }

    const canvas = document.createElement("canvas");
    canvas.width = geographicRaster.width;
    canvas.height = geographicRaster.height;
    const forestContext = canvas.getContext("2d", { willReadFrequently: true });
    if (!forestContext) return geographicRaster;
    forestContext.drawImage(geographicRaster, 0, 0);
    try {
      const pixels = forestContext.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const alpha = data[index + 3];
        const greenness = green - Math.max(red, blue);
        const isForest = alpha > 0 && green >= 65 && greenness >= 14;
        if (!isForest) {
          data[index + 3] = 0;
          continue;
        }
        data[index] = 24;
        data[index + 1] = 230;
        data[index + 2] = 126;
        data[index + 3] = Math.round(alpha * clamp(0.45 + greenness / 95, 0.45, 0.96));
      }
      forestContext.putImageData(pixels, 0, 0);
      japanOverlay.dataset.forestMask = "ready";
    } catch {
      japanOverlay.dataset.forestMask = "fallback";
      return geographicRaster;
    }
    forestRasterCache.set(image, { canvas, source: geographicRaster });
    return canvas;
  };

  let forestRasterPreparationScheduled = false;
  let forestRasterPreparationAwaitingImage = false;
  const scheduleForestRasterPreparation = () => {
    if (
      japanOverlay.dataset.forestMask === "ready"
      || japanOverlay.dataset.forestMask === "fallback"
      || forestRasterPreparationScheduled
    ) return;
    if (!landCoverImage.complete || !landCoverImage.naturalWidth) {
      if (!forestRasterPreparationAwaitingImage) {
        forestRasterPreparationAwaitingImage = true;
        landCoverImage.addEventListener("load", () => {
          forestRasterPreparationAwaitingImage = false;
          scheduleForestRasterPreparation();
        }, { once: true });
      }
      return;
    }
    forestRasterPreparationScheduled = true;
    const prepare = () => {
      try {
        getForestGeographicRaster(landCoverImage);
      } finally {
        forestRasterPreparationScheduled = false;
      }
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(prepare, { timeout: 1800 });
    } else {
      window.setTimeout(prepare, 0);
    }
  };
  let forestPreparationQueuedForOpening = false;
  const scheduleForestRasterWhenUncovered = () => {
    if (document.body.classList.contains("gaia-opening-active")) {
      if (forestPreparationQueuedForOpening) return;
      forestPreparationQueuedForOpening = true;
      window.addEventListener("gaia:opening-complete", () => {
        forestPreparationQueuedForOpening = false;
        scheduleForestRasterPreparation();
      }, { once: true });
      return;
    }
    scheduleForestRasterPreparation();
  };
  landCoverImage.addEventListener("load", scheduleForestRasterWhenUncovered, { once: true });
  if (landCoverImage.complete && landCoverImage.naturalWidth) scheduleForestRasterWhenUncovered();

  const drawVectorArrow = (ctx, x, y, u, v, color, scale = 34) => {
    const speed = Math.hypot(u, v);
    if (!Number.isFinite(speed) || speed < 0.001) return;
    const nx = u / speed;
    const ny = -v / speed;
    const length = clamp(speed * scale, 7, 42);
    const endX = x + nx * length;
    const endY = y + ny * length;
    const angle = Math.atan2(endY - y, endX - x);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - Math.cos(angle - 0.5) * 5, endY - Math.sin(angle - 0.5) * 5);
    ctx.lineTo(endX - Math.cos(angle + 0.5) * 5, endY - Math.sin(angle + 0.5) * 5);
    ctx.stroke();
  };

  const getClosestTemperature = (rows, year) =>
    (rows || []).reduce(
      (closest, row) =>
        !closest || Math.abs(row.year - year) < Math.abs(closest.year - year) ? row : closest,
      null,
    );

  const getJmaCo2Observation = (rows, site, selectedYear) => {
    let current = null;
    let previous = null;
    for (const row of rows || []) {
      if (row.year > selectedYear) break;
      if (!Number.isFinite(row[site.valueKey])) continue;
      previous = current;
      current = row;
    }
    if (!current) {
      return { site, selectedYear, row: null, valuePpm: null, previousPpm: null, deltaPpm: null };
    }
    return {
      site,
      selectedYear,
      row: current,
      valuePpm: current[site.valueKey],
      previousPpm: previous?.[site.valueKey] ?? null,
      deltaPpm: Number.isFinite(previous?.[site.valueKey])
        ? current[site.valueKey] - previous[site.valueKey]
        : null,
      flag: current[site.flagKey] || null,
    };
  };

  const frameDateToDecimalYear = (date) => {
    const [year, month = 1] = String(date).split("-").map(Number);
    return year + (month - 1) / 12;
  };

  const rowDateToDecimalYear = (row) =>
    Number(row?.year || 0) + (Number(row?.month || 1) - 1) / 12;

  const getFrameMeanPpm = (frame) => {
    if (!frame) return null;
    if (Number.isFinite(frame.meanPpm)) return frame.meanPpm;
    let total = 0;
    let count = 0;
    for (const value of frame.values || []) {
      if (!Number.isFinite(value)) continue;
      total += value;
      count += 1;
    }
    frame.meanPpm = count ? total / count : null;
    return frame.meanPpm;
  };

  const getClosestCo2Row = (rows, decimalYear) =>
    (rows || []).reduce(
      (closest, row) =>
        !closest ||
        Math.abs(rowDateToDecimalYear(row) - decimalYear) <
          Math.abs(rowDateToDecimalYear(closest) - decimalYear)
          ? row
          : closest,
      null,
    );

  const formatTimelineDate = (decimalYear, includeMonth = false) => {
    const year = Math.floor(decimalYear);
    if (!includeMonth) return `${year}年`;
    const month = clamp(Math.floor((decimalYear - year) * 12) + 1, 1, 12);
    return `${year}年${month}月`;
  };

  const getFrameImputedIndices = (frame) => {
    if (!frame) return new Set();
    if (!gosatImputedIndexCache.has(frame)) {
      gosatImputedIndexCache.set(frame, new Set(frame.imputedIndices || []));
    }
    return gosatImputedIndexCache.get(frame);
  };

  const timelineCellUsesSpatialImputation = (timeline, index) =>
    getFrameImputedIndices(timeline?.frameA).has(index) ||
    getFrameImputedIndices(timeline?.frameB).has(index);

  const getOlsTrendProjection = (model, year) => {
    if (!model || !Number.isFinite(model.slopePpmYear)) return null;
    const estimate =
      model.levelAtReferencePpm + model.slopePpmYear * (year - model.referenceYear);
    const standardError = model.residualStandardErrorPpm * Math.sqrt(
      1 +
        1 / model.trainingMonths +
        ((year - model.referenceYear) ** 2) / Math.max(model.sxx, 0.000001),
    );
    const halfWidth = model.tCritical95 * standardError;
    return {
      estimate,
      lower95Ppm: estimate - halfWidth,
      upper95Ppm: estimate + halfWidth,
      halfWidth95Ppm: halfWidth,
    };
  };

  const getCo2TimelineState = (signalMode) => {
    const grid = signalMode?.signals?.gosat;
    const frames = grid?.frames || [];
    if (!frames.length) return null;
    const decimalYear =
      CO2_TIMELINE_START_YEAR +
      ((CO2_TIMELINE_END_YEAR - CO2_TIMELINE_START_YEAR) * signalTimePosition) / 100;
    const firstFrame = frames[0];
    const lastFrame = frames.at(-1);
    const firstYear = frameDateToDecimalYear(firstFrame.date);
    const lastYear = frameDateToDecimalYear(lastFrame.date);
    const co2Rows = signalMode?.signals?.co2 || [];
    const timelineStep = Math.round(
      (decimalYear - CO2_TIMELINE_START_YEAR) * CO2_TIMELINE_STEPS_PER_YEAR,
    );

    if (decimalYear < firstYear) {
      const reference = getClosestCo2Row(co2Rows, decimalYear);
      const referencePpm = reference?.deseasonalizedPpm ?? reference?.averagePpm ?? 315;
      const offsetPpm = referencePpm - (getFrameMeanPpm(firstFrame) || referencePpm);
      return {
        kind: "reconstruction",
        phaseLabel: "過去 / 記録から再現",
        yearLabel: formatTimelineDate(decimalYear),
        dateLabel: formatTimelineDate(decimalYear),
        methodLabel: "昔の濃度記録 × 最初の衛星地図",
        warning: "この時代には世界全体を測った地図がありません。昔の濃度記録と、後年の衛星地図を組み合わせた再現です。",
        decimalYear,
        referencePpm,
        frameA: firstFrame,
        frameB: firstFrame,
        mix: 0,
        offsetPpm,
        availableCells: firstFrame.availableCells,
        observedCells: firstFrame.observedCells ?? firstFrame.availableCells,
        imputedCells: firstFrame.imputedCells || 0,
        rangeMinimumPpm: firstFrame.minimumPpm + offsetPpm,
        rangeMaximumPpm: firstFrame.maximumPpm + offsetPpm,
        cacheKey: `past-${timelineStep}`,
      };
    }

    if (decimalYear <= lastYear) {
      let upperIndex = frames.findIndex(
        (frame) => frameDateToDecimalYear(frame.date) >= decimalYear,
      );
      if (upperIndex < 0) upperIndex = frames.length - 1;
      const lowerIndex = Math.max(0, upperIndex - 1);
      const frameA = frames[lowerIndex];
      const frameB = frames[upperIndex];
      const yearA = frameDateToDecimalYear(frameA.date);
      const yearB = frameDateToDecimalYear(frameB.date);
      const mix = yearB === yearA ? 0 : clamp((decimalYear - yearA) / (yearB - yearA), 0, 1);
      const meanA = getFrameMeanPpm(frameA) || 0;
      const meanB = getFrameMeanPpm(frameB) || meanA;
      return {
        kind: "observed",
        phaseLabel: "GOSAT / 観測値・補完値",
        yearLabel: formatTimelineDate(decimalYear, true),
        dateLabel: formatTimelineDate(decimalYear, true),
        methodLabel: "実際に測った色 + まわりから補った斜線",
        warning: "色の濃いマスは衛星地図から読んだ値、斜線のマスは近くの8地点から補った値です。",
        decimalYear,
        referencePpm: meanA + (meanB - meanA) * mix,
        frameA,
        frameB,
        mix,
        offsetPpm: 0,
        availableCells: Math.round(
          frameA.availableCells + (frameB.availableCells - frameA.availableCells) * mix,
        ),
        observedCells: Math.round(
          (frameA.observedCells ?? frameA.availableCells) +
            ((frameB.observedCells ?? frameB.availableCells) -
              (frameA.observedCells ?? frameA.availableCells)) *
              mix,
        ),
        imputedCells: Math.round(
          (frameA.imputedCells || 0) + ((frameB.imputedCells || 0) - (frameA.imputedCells || 0)) * mix,
        ),
        rangeMinimumPpm:
          frameA.minimumPpm + (frameB.minimumPpm - frameA.minimumPpm) * mix,
        rangeMaximumPpm:
          frameA.maximumPpm + (frameB.maximumPpm - frameA.maximumPpm) * mix,
        cacheKey: `observed-${timelineStep}`,
      };
    }

    const validRows = co2Rows.filter((row) => Number.isFinite(row.deseasonalizedPpm));
    const latest = validRows.at(-1);
    const forecastModel = signalMode?.signals?.co2ForecastModel;
    const projection = getOlsTrendProjection(forecastModel, decimalYear);
    const baseProjection = getOlsTrendProjection(forecastModel, lastYear);
    const recentTrendPpmYear = forecastModel?.slopePpmYear || 0;
    const offsetPpm = projection && baseProjection
      ? projection.estimate - baseProjection.estimate
      : recentTrendPpmYear * (decimalYear - lastYear);
    const lastMean = getFrameMeanPpm(lastFrame) || latest.deseasonalizedPpm;
    const referencePpm = lastMean + offsetPpm;
    return {
      kind: "scenario",
      phaseLabel: "未来 / この増加傾向が続く場合",
      yearLabel: formatTimelineDate(decimalYear),
      dateLabel: formatTimelineDate(decimalYear),
      methodLabel: `直近10年の増え方を延長 / 年 +${recentTrendPpmYear.toFixed(2)} ppm`,
      warning: "これまでと同じ増え方が続いた場合の『もしも』です。未来を言い当てる予言ではありません。",
      decimalYear,
      referencePpm,
      frameA: lastFrame,
      frameB: lastFrame,
      mix: 0,
      offsetPpm,
      recentTrendPpmYear,
      forecastModel,
      lower95Ppm: referencePpm - (projection?.halfWidth95Ppm || 0),
      upper95Ppm: referencePpm + (projection?.halfWidth95Ppm || 0),
      predictionHalfWidth95Ppm: projection?.halfWidth95Ppm || 0,
      availableCells: lastFrame.availableCells,
      observedCells: lastFrame.observedCells ?? lastFrame.availableCells,
      imputedCells: lastFrame.imputedCells || 0,
      rangeMinimumPpm: lastFrame.minimumPpm + offsetPpm,
      rangeMaximumPpm: lastFrame.maximumPpm + offsetPpm,
      cacheKey: `future-${timelineStep}`,
    };
  };

  const getTimelineCellValue = (timeline, index) => {
    if (!timeline) return null;
    const valueA = timeline.frameA?.values?.[index];
    const valueB = timeline.frameB?.values?.[index];
    let value = null;
    if (Number.isFinite(valueA) && Number.isFinite(valueB)) {
      value = valueA + (valueB - valueA) * timeline.mix;
    } else if (timeline.mix < 0.5 && Number.isFinite(valueA)) {
      value = valueA;
    } else if (timeline.mix >= 0.5 && Number.isFinite(valueB)) {
      value = valueB;
    }
    return Number.isFinite(value) ? value + timeline.offsetPpm : null;
  };

  const getBreathingEarthState = (signalMode) => {
    const co2 = pickByPosition(signalMode?.signals?.co2);
    const timeline = getCo2TimelineState(signalMode);
    const gosatFrame = timeline?.frameA || pickByPosition(signalMode?.signals?.gosat?.frames);
    const selectedYear = japanIsOpen && timeline
      ? Math.floor(timeline.decimalYear)
      : co2?.year ?? new Date().getFullYear();
    const temperature = getClosestTemperature(signalMode?.signals?.temperature, selectedYear);
    const seasonalPpm = co2 ? co2.averagePpm - co2.deseasonalizedPpm : 0;
    return {
      co2,
      gosat: signalMode?.signals?.gosat || null,
      gosatFrame,
      timeline,
      selectedYear,
      temperature,
      seasonalPpm,
      seasonalUnit: clamp(seasonalPpm / 5, -1, 1),
      globalGrowthUnit: co2
        ? clamp((co2.deseasonalizedPpm - 315) / 120, 0, 1)
        : 0,
      japan: JMA_CO2_SITES.map((site) =>
        getJmaCo2Observation(signalMode?.signals?.japanCo2, site, selectedYear),
      ),
    };
  };

  let circulationSourceTime;
  let circulationSourceDateLabel = "観測時刻不明";
  const getBlueCirculationState = (signalMode) => {
    const currents = signalMode?.signals?.currents || [];
    if (!currents.length) return null;
    const speeds = currents.map((row) => Math.hypot(row.uMs, row.vMs));
    const horizonHours = (signalTimePosition / 100) * CIRCULATION_TIMELINE_HOURS;
    const meanSpeedMs = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const maximumSpeedMs = Math.max(...speeds);
    // This state is read every frame; format the source date only when it changes.
    if (circulationSourceTime !== currents[0]?.time) {
      circulationSourceTime = currents[0]?.time;
      const sourceDate = new Date(circulationSourceTime);
      circulationSourceDateLabel = circulationSourceTime && Number.isFinite(sourceDate.getTime())
        ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })
          .format(sourceDate).replaceAll("/", ".") + " JST"
        : "観測時刻不明";
    }
    const day = horizonHours / 24;
    return {
      kind: "transport",
      phaseLabel: "ある1日の海流 × 移動距離の計算",
      yearLabel: `${day.toFixed(1)}日後`,
      dateLabel: circulationSourceDateLabel,
      methodLabel: "海流の速さ × 経過時間（風は計算に未使用）",
      warning:
        "ある一日の海流が同じ速さと向きで続くと仮定した距離です。実際の14日後を予報するものではありません。",
      horizonHours,
      meanSpeedMs,
      maximumSpeedMs,
      meanDistanceKm: meanSpeedMs * horizonHours * 3.6,
      vectorCount: currents.length,
      currents,
    };
  };

  const getSequenceIndex = (length) => {
    if (!length) return 0;
    return Math.min(length - 1, Math.floor((clamp(signalTimePosition, 0, 99.999) / 100) * length));
  };

  const describeCorrelation = (value) => {
    const magnitude = Math.abs(value);
    const strength = magnitude >= 0.7
      ? "強い"
      : magnitude >= 0.4
        ? "中程度の"
        : magnitude >= 0.2
          ? "弱い"
          : "ほぼない";
    if (magnitude < 0.1) return `${strength}相関`;
    return `${strength}${value < 0 ? "負" : "正"}の相関`;
  };

  const ecologiesComparisonCache = new WeakMap();
  const getThreeEcologiesComparison = (signals) => {
    const cached = ecologiesComparisonCache.get(signals);
    if (cached) {
      const selectedIndex = getSequenceIndex(cached.rows.length);
      return { ...cached, selectedIndex, selected: cached.rows[selectedIndex] };
    }
    const pairedRows = (signals.pairedCountries || []).length
      ? signals.pairedCountries
      : (signals.social || []).map((urban) => {
        const forest = (signals.ecological || []).find((row) => row.iso3 === urban.iso3);
        return forest
          ? {
            ...urban,
            urbanYear: urban.year,
            forestYear: forest.year,
            forestPercent: forest.forestPercent,
          }
          : null;
      }).filter(Boolean);
    if (pairedRows.length < 2) return null;

    const meanUrban = pairedRows.reduce((sum, row) => sum + row.urbanPercent, 0) / pairedRows.length;
    const meanForest = pairedRows.reduce((sum, row) => sum + row.forestPercent, 0) / pairedRows.length;
    const sums = pairedRows.reduce((result, row) => {
      const urbanDelta = row.urbanPercent - meanUrban;
      const forestDelta = row.forestPercent - meanForest;
      result.covariance += urbanDelta * forestDelta;
      result.urbanVariance += urbanDelta ** 2;
      result.forestVariance += forestDelta ** 2;
      return result;
    }, { covariance: 0, urbanVariance: 0, forestVariance: 0 });
    const correlation = sums.covariance / Math.sqrt(sums.urbanVariance * sums.forestVariance);
    const slope = sums.urbanVariance ? sums.covariance / sums.urbanVariance : 0;
    const intercept = meanForest - slope * meanUrban;
    const rows = pairedRows
      .map((row) => {
        const expectedForestPercent = intercept + slope * row.urbanPercent;
        return {
          ...row,
          expectedForestPercent,
          residualPercent: row.forestPercent - expectedForestPercent,
        };
      })
      .sort((a, b) => a.urbanPercent - b.urbanPercent);
    const selectedIndex = getSequenceIndex(rows.length);
    const comparison = {
      rows,
      selectedIndex,
      selected: rows[selectedIndex],
      correlation,
      correlationLabel: describeCorrelation(correlation),
      slope,
      intercept,
      meanUrban,
      meanForest,
    };
    ecologiesComparisonCache.set(signals, comparison);
    return comparison;
  };

  const populationYearCache = new WeakMap();
  const POPULATION_AREA_REFERENCE = 1_500_000_000;
  // MAP-only palette: the separate abstract Population Tide artwork is unchanged.
  const POPULATION_MAP_STYLE = Object.freeze({
    accent: "#ade0d3", accentRgb: "173, 224, 211",
    fill: "rgba(155,191,205,.065)", selectedFill: "rgba(173,224,211,.12)",
    ring: "rgba(166,197,211,.5)", selectedRing: "rgba(206,238,229,.94)",
    center: "rgba(177,208,219,.8)", selectedCenter: "#e0f2eb",
    number: "#e8f1f3", unit: "#aac2ca",
  });
  const getPopulationRadius = (population, rect) =>
    clamp(rect.width * 0.065, 86, 240) * Math.sqrt(Math.max(0, population) / POPULATION_AREA_REFERENCE);
  const getPopulationYearIndex = (rows) => {
    if (populationYearCache.has(rows)) return populationYearCache.get(rows);
    const byYear = new Map();
    for (const row of rows) {
      if (!byYear.has(row.year)) byYear.set(row.year, []);
      byYear.get(row.year).push(row);
    }
    const index = { byYear, years: [...byYear.keys()].sort((a, b) => a - b) };
    populationYearCache.set(rows, index);
    return index;
  };
  const getMapSequenceState = (signalMode) => {
    if (!signalMode) return null;
    const { signals } = signalMode;

    if (signalMode.id === "forest-cloud-engine") {
      const rows = signals.precipitation || [];
      const index = getSequenceIndex(rows.length);
      const row = rows[index];
      if (!row) return null;
      return {
        kind: "forest",
        phaseLabel: `${rows.length}参照地点 / ${String(index + 1).padStart(2, "0")} / ${String(rows.length).padStart(2, "0")}`,
        yearLabel: row.precipitationMmDay?.toFixed(2) || "—",
        valueLabel: `mm/日 · ${getForestRainSiteName(row)}`,
        methodLabel: "大きな水色円＝降水量 × 緑＝森林分布",
        timeLabel: `代表地点 / 自動 01→${String(rows.length).padStart(2, "0")}`,
        selectedIndex: index,
        selected: row,
        legend: [
          "大きな水色円 / 降水量",
          "緑の面 / 森林域",
          "円内の数字 / mm/日",
          `${rows.length}地点 / 国平均ではない`,
        ],
      };
    }

    if (signalMode.id === "pollination-protocol") {
      const occurrences = signals.occurrences || [];
      const relations = (signals.interactions || []).filter((row) => row.targetTaxon);
      const stageIndex = getSequenceIndex(3);
      const stages = [
        {
          key: "records",
          yearLabel: String(occurrences.length),
          valueLabel: "GBIF観察記録",
          methodLabel: "黄色い点＝人が登録した記録（生息分布ではない）",
          note: "点はミツバチの個体数や生息域ではありません。点がない場所にもミツバチはいる可能性があります。",
          legend: [
            "黄点 / GBIF記録",
            "空白 / 不在ではない",
            "押す / 1件を読む",
            "次へ / 標本の制約",
          ],
        },
        {
          key: "sampling",
          yearLabel: "2",
          valueLabel: "1か国あたり最大件数",
          methodLabel: "31か国 × 最大2件に揃えた展示用標本",
          note: "国ごとの点数を最大2件に揃えています。点の多さから、ミツバチの多さや観察活動の差は比較できません。",
          legend: [
            "線で結ぶ2点 / 同じ国",
            "31か国 / 選択標本",
            "点の数 / 比較不可",
            "次へ / 花との関係",
          ],
        },
        {
          key: "relations",
          yearLabel: String(relations.length),
          valueLabel: "花との記録関係",
          methodLabel: "GloBI文献関係網（地理配置ではない）",
          note: "枝はGloBIに残るミツバチと植物の関係です。場所・頻度・強さを持たないため、地図の観察点へは結びません。",
          legend: [
            "中央 / Apis mellifera",
            "外側 / 植物名",
            "枝 / pollinates",
            "配置 / 非地理",
          ],
        },
      ];
      const stage = stages[stageIndex];
      return {
        kind: "pollination",
        phaseLabel: `3つの読み方 / ${stageIndex + 1} / 3`,
        yearLabel: stage.yearLabel,
        valueLabel: stage.valueLabel,
        methodLabel: stage.methodLabel,
        timeLabel: "読み方 / ①観察点 → ②標本 → ③関係網",
        selectedIndex: stageIndex,
        selected: stage,
        stageIndex,
        stageKey: stage.key,
        note: stage.note,
        occurrences,
        relations,
        legend: stage.legend,
      };
    }

    if (signalMode.id === "nothing-is-waste") {
      const rows = signals.countryWaste || [];
      const index = clamp(wasteSelectedIndex, 0, Math.max(0, rows.length - 1));
      const selected = rows[index];
      const sourceRecycle = selected?.recyclePercent || 0;
      return {
        kind: "waste",
        phaseLabel: `${recyclingSourceLabel(selected)} · ${String(index + 1).padStart(2, "0")} / ${String(rows.length).padStart(2, "0")}`,
        yearLabel: `${sourceRecycle.toFixed(1)}%`,
        valueLabel: `${selected ? getCountryNameJa(selected) : "—"} · ${selected?.year || "—"}年公表値`,
        methodLabel: "国別塗り分け / 再資源化・再資源化向け回収率",
        timeLabel: `国・地域 / 01→${String(rows.length).padStart(2, "0")}`,
        sourceRecycle,
        selectedIndex: index,
        selected,
        legend: [
          "国土の青 / 再資源化率",
          "無着色 / 未収録",
          "黄色の枠 / 選択中",
          "濃い青 / 0%",
        ],
      };
    }

    if (signalMode.id === "anthropocene-scar") {
      const rows = signals.emissions || [];
      const { years, byYear } = getPopulationYearIndex(rows);
      const yearIndex = getSequenceIndex(years.length);
      const selectedYear = years[yearIndex];
      const yearRows = byYear.get(selectedYear) || [];
      const selected = yearRows.find((row) => row.iso3 === anthropoceneSelectedIso3)
        || yearRows.find((row) => row.iso3 === "JPN")
        || yearRows[0];
      if (!selected) return null;
      const selectedIndex = yearRows.indexOf(selected);
      const totalMtCo2 = yearRows.reduce((sum, row) => sum + Number(row.emissionsMtCo2 || 0), 0);
      return {
        kind: "anthropocene",
        phaseLabel: `化石燃料由来CO₂の推移 / ${String(yearIndex + 1).padStart(2, "0")} / ${String(years.length).padStart(2, "0")}`,
        yearLabel: `${selectedYear}年`,
        valueLabel: `${getCountryNameJa(selected)} · ${selected.emissionsMtCo2.toFixed(1)} Mt CO₂`,
        methodLabel: `GCP国別合計 / ${yearRows.length}国・地域 · 年別欠測は非表示`,
        timeLabel: `年 / ${years[0]}年 → ${years.at(-1)}年`,
        selectedIndex,
        selected,
        selectedYear,
        yearIndex,
        years,
        yearRows,
        totalMtCo2,
        legend: [
          "濃紺→淡黄 / 年別化石CO₂",
          "白い発光 / 2016固定",
          "長押し / 6秒比較",
          "色尺度 / 全年度共通・対数",
        ],
      };
    }

    if (signalMode.id === "rhythm-of-disaster") {
      const rows = signals.globalEvents || [];
      const playback = getGlobalEarthquakePlaybackEntry(signalMode, signalTimePosition);
      const years = playback.schedule.years;
      const index = playback.entry?.index ?? 0;
      const year = playback.entry?.year;
      const yearEvents = rows
        .filter((row) => String(row.occurredAt || "").startsWith(year))
        .sort(compareEarthquakeOccurrence);
      const strongest = yearEvents.reduce(
        (current, row) => !current || row.magnitude > current.magnitude ? row : current,
        null,
      );
      if (!year || !strongest) return null;
      return {
        kind: "earthquake",
        phaseLabel: `USGS年別 M7.5以上 / ${String(index + 1).padStart(2, "0")} / ${String(years.length).padStart(2, "0")}`,
        yearLabel: `${year}年`,
        valueLabel: `${yearEvents.length}件 · 最大 M${strongest.magnitude.toFixed(1)}`,
        methodLabel: "年別表示 / 発生日時順に出現・一斉にフェードアウト",
        timeLabel: `年次自動再生 / ${years[0]} → ${years.at(-1)} · 吹き出し後${(
          GLOBAL_EARTHQUAKE_EVENT_HOLD_MS / 1000
        ).toFixed(0)}秒静止`,
        selectedIndex: index,
        selected: strongest,
        selectedYear: year,
        yearEvents,
        years,
        playbackDurationMs: playback.entry?.durationMs || 0,
        legend: [
          "赤い× / この年の震源",
          "同心円 / ゆっくり伝播",
          "推定可感半径 / Magnitude",
          "重要 / 推定値",
        ],
      };
    }

    if (signalMode.id === "three-ecologies") {
      const comparison = getThreeEcologiesComparison(signals);
      if (!comparison) return null;
      const { rows, selectedIndex, selected, correlation, correlationLabel } = comparison;
      return {
        kind: "ecologies",
        phaseLabel: `森林率 × 都市人口率 / ${String(selectedIndex + 1).padStart(2, "0")} / ${String(rows.length).padStart(2, "0")}`,
        yearLabel: getCountryNameJa(selected),
        valueLabel: `森林率 ${selected.forestPercent.toFixed(1)}% · 都市人口率 ${selected.urbanPercent.toFixed(1)}%`,
        methodLabel: `同一国の2指標 / ピアソン相関 r ${correlation.toFixed(2)}`,
        timeLabel: `比較国 / 都市人口率が低い → 高い ${String(selectedIndex + 1).padStart(2, "0")}/${String(rows.length).padStart(2, "0")}`,
        selectedIndex,
        selected,
        rows,
        correlation,
        correlationLabel,
        slope: comparison.slope,
        intercept: comparison.intercept,
        legend: [
          "緑の棒 / 森林率（陸地）",
          "青の棒 / 都市人口率（人）",
          "2つの割合 / 足して100%ではない",
          `${rows.length}国・地域 / 両指標のある範囲`,
        ],
      };
    }

    if (signalMode.id === "earth-organ") {
      const rows = (signals.current || [])
        .map((current) => ({
          ...current,
          countryJa: getCountryNameJa(current),
          potential: (signals.potential || []).find((row) => row.iso3 === current.iso3) || null,
        }))
        .sort((a, b) => b.renewablePercent - a.renewablePercent);
      const index = getSequenceIndex(rows.length);
      const row = rows[index];
      if (!row) return null;
      return {
        kind: "energy",
        phaseLabel: `再生可能エネルギー発電割合 / ${String(rows.length)}の国・地域中 ${String(index + 1)}`,
        yearLabel: `${row.renewablePercent.toFixed(1)}%`,
        valueLabel: `${row.countryJa} · 再生可能エネルギー発電割合 ${row.renewablePercent.toFixed(1)}% · ${row.year}年`,
        methodLabel: "国別塗り分け / 総発電量に占める割合",
        timeLabel: `国 / 再生可能エネルギー発電割合が高い → 低い ${String(index + 1).padStart(2, "0")}/${String(rows.length).padStart(2, "0")}`,
        selectedIndex: index,
        selected: row,
        rows,
        legend: [
          "国土の青 / 発電割合",
          "明るさ / 比率",
          "日射・風 / 31代表地点のみ",
          "無着色 / 値の収録なし",
        ],
      };
    }

    if (signalMode.id === "population-tide") {
      const rows = signals.population || [];
      const { years, byYear } = getPopulationYearIndex(rows);
      const yearIndex = getSequenceIndex(years.length);
      const selectedYear = years[yearIndex];
      const yearRows = byYear.get(selectedYear) || [];
      const selected = yearRows.find((row) => row.iso3 === populationSelectedIso3)
        || yearRows.find((row) => row.iso3 === "JPN")
        || yearRows[0];
      if (!selected) return null;
      const selectedIndex = yearRows.indexOf(selected);
      const totalPopulation = yearRows.reduce((sum, row) => sum + Number(row.population || 0), 0);
      return {
        kind: "population",
        phaseLabel: `人口の推移 / ${String(yearIndex + 1).padStart(2, "0")} / ${String(years.length).padStart(2, "0")}`,
        yearLabel: `${selectedYear}年`,
        valueLabel: `${getCountryNameJa(selected)} · ${formatObservationNumber(selected.population, 0)} 人`,
        methodLabel: `世界銀行 / ${yearRows.length}国・地域 · 全年共通の面積尺度`,
        timeLabel: `年 / ${years[0]}年 → ${years.at(-1)}年`,
        selectedIndex,
        selected,
        selectedYear,
        yearIndex,
        years,
        yearRows,
        totalPopulation,
        legend: [
          "淡青の円 / 国別人口",
          "面積 / 人口に比例・全年共通",
          "中心点 / 国の代表位置",
          "重要 / 人口密度ではない",
        ],
      };
    }

    return null;
  };

  const ANTHROPOCENE_HEAT_STOPS = Object.freeze([
    { at: 0, color: [18, 30, 65] },
    { at: 0.22, color: [58, 38, 105] },
    { at: 0.45, color: [142, 43, 91] },
    { at: 0.68, color: [226, 67, 58] },
    { at: 0.84, color: [255, 132, 56] },
    { at: 1, color: [255, 226, 142] },
  ]);

  const getAnthropoceneEmissionHeat = (emissionsMtCo2) => (
    clamp(
      Math.log1p(Math.max(0, Number(emissionsMtCo2 || 0)))
        / Math.log1p(ANTHROPOCENE_EMISSIONS_SCALE_MT),
      0,
      1,
    )
  );

  const getAnthropoceneHeatColor = (heat) => {
    const value = clamp(heat, 0, 1);
    const upperIndex = Math.max(1, ANTHROPOCENE_HEAT_STOPS.findIndex((stop) => stop.at >= value));
    const lower = ANTHROPOCENE_HEAT_STOPS[upperIndex - 1];
    const upper = ANTHROPOCENE_HEAT_STOPS[upperIndex];
    const mix = clamp((value - lower.at) / Math.max(0.0001, upper.at - lower.at), 0, 1);
    return lower.color.map((channel, index) => Math.round(
      channel + (upper.color[index] - channel) * mix,
    ));
  };

  const getAdvectedCurrentPosition = (row, horizonHours) => {
    const elapsedSeconds = horizonHours * 3600;
    const latitudeRadians = (row.lat * Math.PI) / 180;
    const longitudeMetersPerDegree = 111_320 * Math.max(0.2, Math.cos(latitudeRadians));
    return {
      lon: row.lon + (row.uMs * elapsedSeconds) / longitudeMetersPerDegree,
      lat: clamp(row.lat + (row.vMs * elapsedSeconds) / 111_320, -84, 84),
    };
  };

  const XCO2_COLOR_STOPS = Object.freeze([
    { value: 300, color: [40, 17, 95] },
    { value: 320, color: [40, 39, 154] },
    { value: 340, color: [21, 84, 199] },
    { value: 360, color: [15, 177, 217] },
    { value: 380, color: [30, 211, 167] },
    { value: 400, color: [179, 233, 63] },
    { value: 420, color: [255, 151, 31] },
    { value: 440, color: [239, 48, 36] },
    { value: 460, color: [200, 42, 132] },
    { value: 480, color: [213, 113, 224] },
    { value: 500, color: [255, 244, 255] },
  ]);

  const getXco2Color = (value, alpha = 1) => {
    const clamped = clamp(value, 300, 500);
    let upperIndex = XCO2_COLOR_STOPS.findIndex((stop) => stop.value >= clamped);
    if (upperIndex <= 0) upperIndex = 1;
    const lower = XCO2_COLOR_STOPS[upperIndex - 1];
    const upper = XCO2_COLOR_STOPS[upperIndex];
    const mix = clamp((clamped - lower.value) / Math.max(0.001, upper.value - lower.value), 0, 1);
    const color = lower.color.map((component, index) =>
      Math.round(component + (upper.color[index] - component) * mix),
    );
    return `rgba(${color.join(",")},${alpha})`;
  };

  const getCurrentSpeedColor = (speed, alpha = 1) => {
    const stops = [
      { value: 0, color: [13, 42, 104] },
      { value: 0.25, color: [14, 123, 190] },
      { value: 0.5, color: [39, 219, 226] },
      { value: 0.85, color: [119, 255, 194] },
      { value: 1.2, color: [255, 228, 91] },
      { value: 1.5, color: [255, 118, 61] },
    ];
    const clamped = clamp(speed, 0, 1.5);
    let upperIndex = stops.findIndex((stop) => stop.value >= clamped);
    if (upperIndex <= 0) upperIndex = 1;
    const lower = stops[upperIndex - 1];
    const upper = stops[upperIndex];
    const mix = clamp((clamped - lower.value) / Math.max(0.001, upper.value - lower.value), 0, 1);
    const color = lower.color.map((component, index) =>
      Math.round(component + (upper.color[index] - component) * mix),
    );
    return `rgba(${color.join(",")},${alpha})`;
  };

  const renderGosatHeatmap = (ctx, rect, left, top, state) => {
    const grid = state.gosat;
    const timeline = state.timeline;
    if (!grid || !timeline || !gosatHeatmapContext) return;
    const projection = mapScope === "earth"
      ? japanView.earthProjection || getEarthProjection(rect)
      : null;
    const cacheKey = [
      timeline.cacheKey,
      mapScope,
      japanView.zoom,
      Math.round(left * 10),
      Math.round(top * 10),
      Math.round(rect.width),
      Math.round(rect.height),
      projection ? projection.scale.toFixed(6) : "",
      projection ? projection.originX.toFixed(3) : "",
      projection ? projection.originY.toFixed(3) : "",
    ].join("/");
    if (cacheKey !== gosatHeatmapCacheKey) {
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));
      if (gosatHeatmapCanvas.width !== width || gosatHeatmapCanvas.height !== height) {
        gosatHeatmapCanvas.width = width;
        gosatHeatmapCanvas.height = height;
      }
      const heatmap = gosatHeatmapContext;
      heatmap.clearRect(0, 0, width, height);
      heatmap.globalCompositeOperation = "source-over";
      const resolution = grid.resolutionDegrees || 2.5;
      const longitudeCopies = [0];
      heatmap.beginPath();
      for (let row = 0; row < grid.height; row += 1) {
        const north = 90 - row * resolution;
        const south = north - resolution;
        for (let column = 0; column < grid.width; column += 1) {
          const cellIndex = row * grid.width + column;
          const value = getTimelineCellValue(timeline, cellIndex);
          if (!Number.isFinite(value)) continue;
          const imputed = timelineCellUsesSpatialImputation(timeline, cellIndex);
          const baseWest = -180 + column * resolution;
          for (const longitudeCopy of longitudeCopies) {
            const west = baseWest + longitudeCopy;
            const east = west + resolution;
            const northWest = japanWorldToScreen(west, north, left, top);
            const southEast = japanWorldToScreen(east, south, left, top);
            const cellLeft = Math.min(northWest.x, southEast.x);
            const cellTop = Math.min(northWest.y, southEast.y);
            const cellWidth = Math.abs(southEast.x - northWest.x);
            const cellHeight = Math.abs(southEast.y - northWest.y);
            if (
              cellLeft > width ||
              cellTop > height ||
              cellLeft + cellWidth < 0 ||
              cellTop + cellHeight < 0
            ) continue;
            heatmap.fillStyle = getXco2Color(value, imputed ? 0.34 : 0.6);
            heatmap.fillRect(cellLeft - 0.35, cellTop - 0.35, cellWidth + 0.7, cellHeight + 0.7);
            if (imputed) {
              heatmap.moveTo(cellLeft, cellTop + cellHeight);
              heatmap.lineTo(cellLeft + cellWidth, cellTop);
            }
          }
        }
      }
      heatmap.strokeStyle = "rgba(236, 251, 247, 0.2)";
      heatmap.lineWidth = 0.45;
      heatmap.stroke();
      gosatHeatmapCacheKey = cacheKey;
      const anchor = japanWorldToScreen(138, 36, left, top);
      japanOverlay.dataset.gosatAnchorScreenX = anchor.x.toFixed(2);
      japanOverlay.dataset.gosatAnchorScreenY = anchor.y.toFixed(2);
      japanOverlay.dataset.gosatProjectionKey = cacheKey;
    }
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(gosatHeatmapCanvas, 0, 0, rect.width, rect.height);
    ctx.restore();
  };

  const getGosatCellRecord = (signalMode, longitude, latitude) => {
    const state = getBreathingEarthState(signalMode);
    const grid = state.gosat;
    const timeline = state.timeline;
    if (!grid || !timeline) return null;
    const resolution = grid.resolutionDegrees || 2.5;
    const column = clamp(Math.floor((longitude + 180) / resolution), 0, grid.width - 1);
    const row = clamp(Math.floor((90 - latitude) / resolution), 0, grid.height - 1);
    const west = -180 + column * resolution;
    const north = 90 - row * resolution;
    const cellIndex = row * grid.width + column;
    const valuePpm = getTimelineCellValue(timeline, cellIndex);
    const hasValue = Number.isFinite(valuePpm);
    const spatiallyImputed = timelineCellUsesSpatialImputation(timeline, cellIndex);
    const temporallyInterpolated =
      timeline.kind === "observed" && timeline.mix > 0.001 && timeline.mix < 0.999;
    const provenance = timeline.kind === "scenario"
      ? "SCENARIO / これまでの傾向が続いた場合"
      : timeline.kind === "reconstruction"
        ? "DERIVED / 昔の記録から再現"
        : spatiallyImputed
          ? "DERIVED / 近くの8地点から補完"
          : temporallyInterpolated
            ? "DERIVED / 二つの時点のあいだ"
            : "SOURCE / 衛星地図から読み取った値";
    return {
      kind: "gosat-grid",
      lon: west + resolution / 2,
      lat: north - resolution / 2,
      meta: hasValue
        ? `約 ${valuePpm.toFixed(1)} ppm / ${timeline.dateLabel} / ${provenance}`
        : `NO DATA / ${timeline.dateLabel}`,
      previewReadings: { context: `${timeline.dateLabel} / ${provenance}`, readings: [{ label: '約・CO₂濃度', value: hasValue ? valuePpm.toFixed(1) : 'NO DATA', unit: 'ppm' }] },
      valuePpm: hasValue ? valuePpm : null,
      provenance,
      frameDate: timeline.dateLabel,
      bounds: { west, east: west + resolution, south: north - resolution, north },
    };
  };

  const getModeDataPois = () => {
    const signalMode = getActiveSignalMode();
    if (!signalMode) return [];
    const { signals } = signalMode;
    if (signalMode.id === "breathing-earth") {
      return [];
    }
    if (signalMode.id === "blue-circulation") {
      const state = getBlueCirculationState(signalMode);
      return (signals.currents || []).map((row) => {
        const speed = Math.hypot(row.uMs, row.vMs);
        const bearing = (toDegrees(Math.atan2(row.uMs, row.vMs)) + 360) % 360;
        const direction = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"][
          Math.round(bearing / 45) % 8
        ];
        return {
          kind: "current-vector",
          lon: row.lon,
          lat: row.lat,
          meta: `${state?.dateLabel || row.time} / 海流 ${speed.toFixed(2)} m/s / ${direction}方向`,
          previewReadings: { context: `${state?.dateLabel || row.time} / ${direction}方向`, readings: [{ label: '海流', value: speed.toFixed(2), unit: 'm/s' }] },
        };
      });
    }
    if (signalMode.id === "forest-cloud-engine") {
      const rows = signals.precipitation || [];
      return rows.map((row, sequenceIndex) => ({
        ...row,
        nameJa: getForestRainSiteName(row),
        kind: "sequence-poi",
        sequenceIndex,
        sequenceLength: rows.length,
        lon: row.lon,
        lat: row.lat,
        meta: `年平均 ${row.precipitationMmDay?.toFixed(2) || "—"} mm/日 / NASA POWER`,
        previewReadings: { context: 'NASA POWER', readings: [{ label: '年平均降水量', value: row.precipitationMmDay?.toFixed(2) || '—', unit: 'mm/日' }] },
      }));
    }
    if (signalMode.id === "pollination-protocol") {
      const rows = signals.occurrences || [];
      return rows.map((row) => ({
        ...row,
        countryJa: getCountryNameJa(row),
        kind: "sequence-poi",
        lon: row.lon,
        lat: row.lat,
        meta: `${row.species || "セイヨウミツバチ"} / ${row.eventDate?.slice(0, 10) || "日付不明"} / GBIF記録 ${row.key}`,
      }));
    }
    if (signalMode.id === "nothing-is-waste") {
      const rows = signals.countryWaste || [];
      return rows.map((row, sequenceIndex) => {
        return {
          ...row,
          countryJa: getCountryNameJa(row),
          kind: "sequence-poi",
          sequenceIndex,
          sequenceLength: rows.length,
          meta: `${getCountryNameJa(row)} / ${row.year}年 / 再資源化率 ${row.recyclePercent.toFixed(1)}% / ${recyclingDetails(row)}`,
          previewReadings: { context: `${row.year}年`, readings: [{ label: '再資源化率', value: row.recyclePercent.toFixed(1), unit: '%' }] },
        };
      });
    }
    if (signalMode.id === "anthropocene-scar") {
      const state = getMapSequenceState(signalMode);
      return (state?.yearRows || []).map((row) => ({
        ...row,
        countryJa: getCountryNameJa(row),
        kind: "sequence-poi",
        lon: row.lon,
        lat: row.lat,
        meta: `${row.year}年 / ${row.emissionsMtCo2.toFixed(1)} Mt CO₂ / 化石燃料・セメント由来`,
        previewReadings: { context: `${row.year}年 / 化石燃料・セメント由来`, readings: [{ label: 'CO₂排出量', value: row.emissionsMtCo2.toFixed(1), unit: 'Mt CO₂' }] },
      }));
    }
    if (signalMode.id === "rhythm-of-disaster") {
      if (japanDataLayer === "history") return [];
      const state = getMapSequenceState(signalMode);
      return (state?.yearEvents || []).map((row) => ({
        ...row,
        lon: row.longitude,
        lat: row.latitude,
        kind: "sequence-poi",
        meta: `${String(row.occurredAt).slice(0, 10)} / M${row.magnitude.toFixed(1)} / 深さ ${row.depthKm?.toFixed(0) || "—"} km`,
        previewReadings: { context: String(row.occurredAt).slice(0, 10), readings: [{ label: '規模', value: row.magnitude.toFixed(1), unit: 'M', prefix: true }, { label: '深さ', value: row.depthKm?.toFixed(0) || '—', unit: 'km' }] },
      }));
    }
    if (signalMode.id === "three-ecologies") {
      const state = getMapSequenceState(signalMode);
      return ecologiesView !== "culture"
        ? (state?.rows || []).map((row) => ({
          ...row,
          countryJa: getCountryNameJa(row),
          kind: "sequence-poi",
          meta: `森林率 ${row.forestPercent.toFixed(1)}% / 都市人口率 ${row.urbanPercent.toFixed(1)}%`,
          previewReadings: { readings: [{ label: '森林率', value: row.forestPercent.toFixed(1), unit: '%' }, { label: '都市人口率', value: row.urbanPercent.toFixed(1), unit: '%' }] },
        }))
        : (signals.culture || []).map((row) => ({
          ...row,
          nameJa: getCultureSiteNameJa(row),
          kind: "sequence-poi",
          meta: `世界遺産の例 / ${CULTURE_CATEGORY_NAMES_JA[row.category] || row.category} / ${CULTURE_REGION_NAMES_JA[row.region] || row.region}`,
        }));
    }
    if (signalMode.id === "earth-organ") {
      const state = getMapSequenceState(signalMode);
      return (state?.rows || []).map((row, sequenceIndex) => ({
        ...row,
        kind: "sequence-poi",
        sequenceIndex,
        sequenceLength: state.rows.length,
        lon: row.lon,
        lat: row.lat,
        meta: `${row.year || "—"}年 / 再生可能エネルギー発電割合 ${row.renewablePercent.toFixed(1)}%`,
        previewReadings: { context: `${row.year || '—'}年`, readings: [{ label: '再生可能エネルギー発電割合', value: row.renewablePercent.toFixed(1), unit: '%' }] },
      }));
    }
    if (signalMode.id === "population-tide") {
      const state = getMapSequenceState(signalMode);
      return (state?.yearRows || []).map((row) => ({
        ...row,
        countryJa: getCountryNameJa(row),
        kind: "sequence-poi",
        lon: row.lon,
        lat: row.lat,
        meta: `${row.year}年 / ${formatObservationNumber(row.population, 0)}人 / 世界銀行`,
        previewReadings: { context: `${row.year}年 / 世界銀行`, readings: [{ label: '人口', value: formatObservationNumber(row.population, 0), unit: '人' }] },
      }));
    }
    return [];
  };

  const renderMapInstallationEffect = (ctx, rect, nodePoints, now) => {
    const signalMode = getActiveSignalMode();
    if (!signalMode) return;
    syncMapPlotRevealState(now);
    const { left, top } = getJapanViewport();
    const time = reducedMotion ? 1.8 : now / 1000;
    const rgb = modes[modeToIndex].rgb;
    const center = { x: rect.width * 0.54, y: rect.height * 0.5 };
    const stroke = (alpha) => `rgba(${rgb}, ${alpha})`;
    const pointFor = (row) => japanWorldToScreen(row.lon, row.lat, left, top);
    const visible = (point, margin = 45) => point.x > -margin && point.x < rect.width + margin && point.y > -margin && point.y < rect.height + margin;
    // Draw annotations last so the fixed instruments participate in placement.
    const observationLabels = [];
    const magnitudeObstacles = [];
    const drawObservationLabel = ({ point, primary, secondary, detail, radius = 8, alpha = 1, renewable = false }) => {
      const compact = rect.width < 600, expansive = rect.width >= 2400;
      const short = rect.height < 500 || (compact && rect.height < 650);
      const padding = short ? 12 : compact ? 16 : expansive ? 26 : 22;
      const landscape = rect.width < 900 && rect.height < 420;
      const maximumWidth = Math.min(landscape ? 210 : compact ? 390 : expansive ? 1200 : 900, rect.width - 32);
      const fonts = landscape ? [14, 12, 10] : short ? [16, 13, 11] : [compact ? 19 : expansive ? 30 : 23, compact ? 14 : expansive ? 22 : 17, compact ? 11 : expansive ? 16 : 12];
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha;
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      const blocks = (renewable ? [primary, secondary] : [primary, secondary, detail]).map((text, index) => ({
        text: globalThis.GaiaI18n?.t(String(text || "—")) || String(text || "—"), font: `400 ${fonts[index]}px ${mapHeadingFont}`, size: fonts[index],
      }));
      const columnGap = short ? 14 : compact ? 16 : expansive ? 32 : 24;
      const stackedDetail = rect.width < 900 && !renewable;
      const earthquakeLabel = String(secondary).startsWith("マグニチュード");
      // Earthquake dates, measurements and provenance are separate reading units.
      // Stack the fields instead of squeezing a date into a proportional column.
      const rows = earthquakeLabel ? [[0], [1], [2]] : stackedDetail ? [[0, 1], [2]] : [blocks.map((_, index) => index)];
      const naturalWidths = blocks.map(block => { ctx.font = block.font; return ctx.measureText(block.text).width; });
      const naturalWidth = Math.max(...rows.map(row => row.reduce((sum, index) => sum + naturalWidths[index], 0) + columnGap * (row.length - 1)));
      const width = Math.min(maximumWidth, Math.max(compact ? 270 : 360, naturalWidth + padding * 2));
      const bodyWidth = width - padding * 2;
      const lines = [];
      let offset = padding;
      const wrapBlock = (index, columnWidth, left) => {
        const block = blocks[index], blockLines = [];
        ctx.font = block.font;
        let line = "";
        // Keep ordinary numbers/units together; break exceptionally long tokens.
        // No fillText maxWidth: Japanese glyphs must never be squeezed.
        const tokens = block.text.match(/\d{4}年\d{1,2}月\d{1,2}日(?:\s*（[^）]+）)?|(?:午前|午後)?\d{1,2}時\s*\d{1,2}分|\d+(?:\.\d+)?\s*km|日本時間|マグニチュード\s*M\d+(?:\.\d+)?|[A-Za-z0-9.,%/㎡²µ°+−-]+[。、，．！？）〉》」』】]*|.[。、，．！？）〉》」』】]*/gu) || [];
        const addLine = () => {
          if (!line.trim()) { line = ""; return; }
          blockLines.push({ text: line.trim(), font: block.font, left, offset: blockLines.length * block.size * (short ? 1.4 : 1.6), width: ctx.measureText(line.trim()).width, columnWidth, index });
          line = "";
        };
        for (const token of tokens) {
          const parts = ctx.measureText(token).width > columnWidth ? Array.from(token) : [token];
          for (const part of parts) {
            if (line && ctx.measureText(line + part).width > columnWidth) addLine();
            line += part;
          }
        }
        addLine();
        return { lines: blockLines, height: block.size + Math.max(0, blockLines.length - 1) * block.size * (short ? 1.4 : 1.6) };
      };
      for (const [rowIndex, row] of rows.entries()) {
        const available = bodyWidth - columnGap * (row.length - 1);
        const natural = row.reduce((sum, index) => sum + naturalWidths[index], 0);
        // Reserve a readable minimum for each field, then share the remaining
        // space by text length. Never squeeze glyphs or drop a country/value.
        const minimums = row.map(index => Math.min(naturalWidths[index], blocks[index].size * 4, available / row.length));
        const minimumTotal = minimums.reduce((sum, value) => sum + value, 0);
        const flexibleTotal = natural - minimumTotal;
        let left = 0;
        const columns = row.map((index, column) => {
          const columnWidth = natural <= available ? naturalWidths[index] + (available - natural) / row.length
            : minimums[column] + (available - minimumTotal) * (naturalWidths[index] - minimums[column]) / Math.max(1, flexibleTotal);
          const wrapped = wrapBlock(index, columnWidth, left);
          left += columnWidth + columnGap;
          return wrapped;
        });
        const rowHeight = Math.max(...columns.map(column => column.height));
        for (const column of columns) for (const line of column.lines) {
          lines.push({ ...line, offset: offset + (rowHeight - column.height) / 2 + line.offset });
        }
        offset += rowHeight + (rowIndex < rows.length - 1 ? (short ? 8 : 12) : 0);
      }
      const height = offset + padding;
      const obstacles = [...document.querySelectorAll(
        ".signal-encoding-legend-dock, .map-command-dock, .signal-console-map, .japan-heading, .map-mode-bank, #gaia-map-zoom-controls, #co2-timeline-display, .japan-map-actions, #map-reading-guide, .ecologies-exhibit, #japan-poi-panel, .gaia-mode-entry-guide-replay, #gaia-audio-toggle, #map-mobile-toolbar, .map-mobile-ecology-summary"
      )].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden" && Number(getComputedStyle(node).opacity) !== 0)
        .map(node => { const box = node.getBoundingClientRect(); return { x: box.left - rect.left, y: box.top - rect.top, width: box.width, height: box.height }; });
      if (japanOverlay.dataset.auxiliaryPanelId) {
        const data = japanOverlay.dataset;
        obstacles.push({ x: Number(data.auxiliaryPanelScreenLeft) - rect.left, y: Number(data.auxiliaryPanelScreenTop) - rect.top,
          width: Number(data.auxiliaryPanelScreenRight) - Number(data.auxiliaryPanelScreenLeft),
          height: Number(data.auxiliaryPanelScreenBottom) - Number(data.auxiliaryPanelScreenTop) });
      }
      for (const box of magnitudeObstacles) {
        const extra = Math.max(0, box.gap - 8);
        obstacles.push({ x: box.x-extra, y: box.y-extra, width: box.width+extra*2, height: box.height+extra*2 });
      }
      obstacles.push({ x: point.x - radius - 6, y: point.y - radius - 6, width: radius * 2 + 12, height: radius * 2 + 12 });
      const xs = [point.x + radius + 20, point.x - radius - 20 - width, point.x - width / 2, 16, rect.width - width - 16,
        ...obstacles.flatMap(box => [box.x + box.width + 12, box.x - width - 12])];
      const ys = [point.y - height * .4, point.y + radius + 20, point.y - radius - height - 20, 16, rect.height - height - 16,
        ...obstacles.flatMap(box => [box.y + box.height + 12, box.y - height - 12])];
      const candidates = xs.flatMap(candidateX => ys.map(candidateY => {
        const x = clamp(candidateX, 16, rect.width - width - 16), y = clamp(candidateY, 16, rect.height - height - 16);
        const overlap = obstacles.reduce((total, box) => total
          + Math.max(0, Math.min(x + width, box.x + box.width + 8) - Math.max(x, box.x - 8))
          * Math.max(0, Math.min(y + height, box.y + box.height + 8) - Math.max(y, box.y - 8)), 0);
        return { x, y, score: overlap * 1000 + Math.hypot(x + width / 2 - point.x, y + height / 2 - point.y) };
      }));
      const { x, y } = candidates.sort((a, b) => a.score - b.score)[0];
      const edgeX = clamp(point.x, x, x + width), edgeY = clamp(point.y, y, y + height);
      const distance = Math.hypot(edgeX - point.x, edgeY - point.y);
      if (distance > radius + 8) {
        const start = (radius + 8) / distance;
        ctx.beginPath(); ctx.moveTo(point.x + (edgeX - point.x) * start, point.y + (edgeY - point.y) * start); ctx.lineTo(edgeX, edgeY);
        ctx.strokeStyle = "rgba(170,204,195,.38)"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.beginPath(); ctx.roundRect(x, y, width, height, 5);
      ctx.fillStyle = "rgba(5,19,26,.8)"; ctx.fill();
      ctx.strokeStyle = "rgba(159,192,183,.26)"; ctx.lineWidth = 1; ctx.stroke();
      for (const line of lines) {
        ctx.font = line.font;
        ctx.fillStyle = ["rgba(229,237,220,.98)", "rgba(206,223,211,.96)", "rgba(160,185,176,.94)"][line.index];
        ctx.fillText(line.text, x + padding + line.left, y + line.offset);
      }
      ctx.restore();
      const serializedLines = JSON.stringify(lines);
      Object.assign(japanOverlay.dataset, {
        selectionLabelShape: "observation-card", selectionLabelVisible: "true", selectionLabelTypography: "mincho",
        selectionLabelLayout: stackedDetail ? "inline-wrap" : "inline", selectionLabelBackgroundAlpha: "0.8",
        selectionLabelWidthPx: width.toFixed(1), selectionLabelHeightPx: height.toFixed(1),
        selectionLabelLeftPx: x.toFixed(1), selectionLabelTopPx: y.toFixed(1),
        selectionLabelPrimaryFontPx: String(fonts[0]), selectionLabelSecondaryFontPx: String(fonts[1]),
        selectionLabelPrimary: primary, selectionLabelSecondary: secondary, selectionLabelDetail: detail,
        selectionLabelLines: serializedLines, selectionLabelBodyWidth: String(bodyWidth), selectionLabelShadowBlur: "0",
        selectionLabelFullName: primary, selectionLabelDisplayName: primary,
      });
      if (renewable) Object.assign(japanOverlay.dataset, {
        renewableSelectionLabelPrimary: primary, renewableSelectionLabelSecondary: secondary, renewableSelectionLabelDetail: detail,
        renewableSelectionLabelLines: serializedLines, renewableSelectionLabelBodyWidth: String(bodyWidth),
        renewableSelectionLabelVisible: "true",
      });
    };
    const drawSelectionLabel = (point, primary, secondary, color, motion = {}) => {
      if (motion.allowDuringPlotReveal !== true && !isMapPlotRevealComplete(now)) return null;
      observationLabels.push({ point: motion.anchor || point, primary, secondary, detail: motion.detail || "",
        radius: motion.radius || 8, alpha: ctx.globalAlpha * clamp(Number(motion.alpha ?? 1), 0, 1), renewable: motion.renewable === true });
      return null;
    };
    const drawRainSelectionLabel = (point, row, radius) => drawSelectionLabel(point, getForestRainSiteName(row),
      `降水量　${row.precipitationMmDay?.toFixed(2) || "—"} mm/日`, null,
      { radius, detail: "NASA POWER · 気候平均値" });
    const drawRenewableObservationLabel = (point, selected, radius = 8) => drawSelectionLabel(point,
      selected.countryJa || selected.country, `再生可能エネルギー発電割合　${selected.renewablePercent.toFixed(1)}%`, null,
      { radius, renewable: true });
    delete japanOverlay.dataset.selectionLabelWidthPx;
    delete japanOverlay.dataset.selectionLabelHeightPx;
    delete japanOverlay.dataset.selectionLabelPrimaryFontPx;
    delete japanOverlay.dataset.selectionLabelSecondaryFontPx;
    delete japanOverlay.dataset.selectionLabelShape;
    delete japanOverlay.dataset.selectionLabelTailSide;
    delete japanOverlay.dataset.selectionLabelTailLengthPx;
    delete japanOverlay.dataset.selectionLabelCornerRadiusPx;
    delete japanOverlay.dataset.selectionLabelLeftPx;
    delete japanOverlay.dataset.selectionLabelTopPx;
    delete japanOverlay.dataset.selectionLabelPlacement;
    delete japanOverlay.dataset.selectionLabelFullName;
    delete japanOverlay.dataset.selectionLabelDisplayName;
    delete japanOverlay.dataset.selectionLabelTypography;
    for (const key of ["selectionLabelPrimary", "selectionLabelSecondary", "selectionLabelDetail", "selectionLabelLines", "selectionLabelBodyWidth", "selectionLabelShadowBlur", "selectionLabelLayout", "selectionLabelBackgroundAlpha"]) delete japanOverlay.dataset[key];
    japanOverlay.dataset.renewableSelectionLabelVisible = "false";
    japanOverlay.dataset.selectionLabelVisible = "false";
    delete japanOverlay.dataset.earthquakeSelectionLabelWidthPx;
    delete japanOverlay.dataset.earthquakeSelectionLabelHeightPx;
    delete japanOverlay.dataset.earthquakeSelectionPrimaryFontPx;
    delete japanOverlay.dataset.earthquakeSelectionLabelProfile;
    delete japanOverlay.dataset.earthquakeYearSummary;
    delete japanOverlay.dataset.earthquakeActiveLabelPrimary;
    delete japanOverlay.dataset.earthquakeMagnitudeLabelMaxFontPx;
    delete japanOverlay.dataset.earthquakeMagnitudeLabelCount;
    delete japanOverlay.dataset.earthquakeActiveMagnitudeLabel;
    delete japanOverlay.dataset.earthquakeMarkerStyle;
    delete japanOverlay.dataset.earthquakeMarkerColor;
    delete japanOverlay.dataset.earthquakeMarkerMaxLineWidthPx;
    delete japanOverlay.dataset.auxiliaryPanelId;
    delete japanOverlay.dataset.auxiliaryPanelScreenLeft;
    delete japanOverlay.dataset.auxiliaryPanelScreenTop;
    delete japanOverlay.dataset.auxiliaryPanelScreenRight;
    delete japanOverlay.dataset.auxiliaryPanelScreenBottom;
    delete japanOverlay.dataset.auxiliaryPanelLegendClearance;
    delete japanOverlay.dataset.quantitativeLegendId;
    delete japanOverlay.dataset.quantitativeLegendTitle;
    delete japanOverlay.dataset.quantitativeLegendCurrent;
    delete japanOverlay.dataset.quantitativeLegendMinimum;
    delete japanOverlay.dataset.quantitativeLegendMaximum;
    delete japanOverlay.dataset.quantitativeLegendProgress;
    ecologiesExhibit?.setActive(signalMode.id === "three-ecologies" && now >= mapPlotRevealStartedAt);
    for (const key of Object.keys(japanOverlay.dataset)) {
      if (key.startsWith("population") || key.startsWith("ecologies")) delete japanOverlay.dataset[key];
    }
    const getLegendSafePanelY = (panelX, panelWidth, defaultY, clearance = 12) => {
      const legendDock = mapSignalEncodingLegend?.closest(".signal-encoding-legend-dock");
      if (!legendDock?.getClientRects().length) return defaultY;
      const legendRect = legendDock.getBoundingClientRect();
      const panelLeft = rect.left + panelX;
      const panelRight = panelLeft + panelWidth;
      const overlapsHorizontally = panelLeft < legendRect.right && panelRight > legendRect.left;
      return overlapsHorizontally
        ? Math.max(defaultY, legendRect.bottom - rect.top + clearance)
        : defaultY;
    };
    const recordAuxiliaryPanel = (id, x, y, width, height) => {
      const legendDock = mapSignalEncodingLegend?.closest(".signal-encoding-legend-dock");
      const legendRect = legendDock?.getClientRects().length
        ? legendDock.getBoundingClientRect()
        : null;
      japanOverlay.dataset.auxiliaryPanelId = id;
      japanOverlay.dataset.auxiliaryPanelScreenLeft = (rect.left + x).toFixed(2);
      japanOverlay.dataset.auxiliaryPanelScreenTop = (rect.top + y).toFixed(2);
      japanOverlay.dataset.auxiliaryPanelScreenRight = (rect.left + x + width).toFixed(2);
      japanOverlay.dataset.auxiliaryPanelScreenBottom = (rect.top + y + height).toFixed(2);
      japanOverlay.dataset.auxiliaryPanelLegendClearance = legendRect
        ? (rect.top + y - legendRect.bottom).toFixed(2)
        : "legend-hidden";
    };
    const drawQuantitativeLegendPanel = ({
      id,
      title,
      current,
      value,
      minimum,
      maximum,
      minimumLabel,
      maximumLabel,
      colors,
      scale = "linear",
      markerColor = "rgba(255,240,152,.98)",
      defaultY,
    }) => {
      if (
        now < mapPlotRevealStartedAt
        || !Number.isFinite(value)
        || !Number.isFinite(minimum)
        || !Number.isFinite(maximum)
        || maximum <= minimum
        || !Array.isArray(colors)
        || colors.length < 2
      ) return null;
      const compact = rect.width < 680;
      if (globalThis.GaiaMobileMap?.isActive()) {
        const normalized = scale === "log"
          ? Math.log1p(Math.max(0, value - minimum)) / Math.log1p(maximum - minimum)
          : (value - minimum) / (maximum - minimum);
        globalThis.GaiaMobileMap.setMetric({ id, title, current, minimumLabel, maximumLabel, colors, scale, progress: clamp(normalized, 0, 1) });
        return null;
      }
      const legendDock = mapSignalEncodingLegend?.closest(".signal-encoding-legend-dock");
      const legendRect = legendDock?.getClientRects().length ? legendDock.getBoundingClientRect() : null;
      const storyMap = storyModeDetour?.kind === "map01";
      const alignWithLegend = (rect.width > 900 || storyMap) && legendRect?.width > 0;
      const panelWidth = alignWithLegend ? legendRect.width : compact ? Math.min(216, rect.width - 28) : 330;
      const panelHeight = 102;
      let panelX = alignWithLegend ? legendRect.left - rect.left : compact ? (storyMap ? 14 : rect.width - panelWidth - 14) : rect.width - panelWidth - 30;
      // On narrow layouts the title and timeline cards occupy the first ~210px.
      // Story observations follow the left-hand key, including narrow dialogs.
      const compactPanelY = storyMap ? 76 : 228;
      let panelY = getLegendSafePanelY(panelX, panelWidth, defaultY ?? (compact ? compactPanelY : 54), 8);
      const draggedPanel = globalThis.GaiaMapLegendDrag?.placeMetric({
        left: rect.left + panelX, top: rect.top + panelY, width: panelWidth, height: panelHeight,
      });
      if (draggedPanel) {
        panelX = draggedPanel.left - rect.left;
        panelY = draggedPanel.top - rect.top;
      }
      const gradientX = panelX + 18;
      const gradientY = panelY + 65;
      const gradientWidth = panelWidth - 36;
      const normalized = scale === "log"
        ? Math.log1p(Math.max(0, value - minimum)) / Math.log1p(maximum - minimum)
        : (value - minimum) / (maximum - minimum);
      const progress = clamp(normalized, 0, 1);
      recordAuxiliaryPanel(`quantitative-${id}`, panelX, panelY, panelWidth, panelHeight);
      japanOverlay.dataset.quantitativeLegendId = id;
      japanOverlay.dataset.quantitativeLegendTitle = title;
      japanOverlay.dataset.quantitativeLegendCurrent = current;
      japanOverlay.dataset.quantitativeLegendMinimum = minimumLabel;
      japanOverlay.dataset.quantitativeLegendMaximum = maximumLabel;
      japanOverlay.dataset.quantitativeLegendProgress = progress.toFixed(3);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const plate = ctx.createLinearGradient(panelX, panelY, panelX + panelWidth, panelY + panelHeight);
      plate.addColorStop(0, "rgba(19,40,53,.97)");
      plate.addColorStop(1, "rgba(6,21,32,.97)");
      ctx.fillStyle = plate;
      ctx.strokeStyle = "rgba(171,205,216,.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(panelX + .5, panelY + .5, panelWidth - 1, panelHeight - 1, 12);
      ctx.fill(); ctx.stroke();
      const scope = title.includes(" / ") ? title.split(" / ").slice(1).join(" / ") : "";
      ctx.font = `400 10px ${mapHeadingFont}`;
      const scopeWidth = scope ? Math.min(ctx.measureText(scope).width, panelWidth * .46) : 0;
      ctx.fillStyle = "#a7bec8";
      ctx.font = `400 11px ${mapHeadingFont}`;
      ctx.textAlign = "left";
      ctx.fillText(title.split(" / ")[0], panelX + 18, panelY + 22, panelWidth - 36 - (scope ? scopeWidth + 10 : 0));
      ctx.fillStyle = "#e3eef0";
      ctx.font = `400 21px ${mapHeadingFont}`;
      ctx.fillText(current.replace(/^平均\s*/u, ""), panelX + 18, panelY + 49, panelWidth - 36);
      if (scope) {
        ctx.textAlign = "right";
        ctx.fillStyle = "#829eaa";
        ctx.font = `400 10px ${mapHeadingFont}`;
        ctx.fillText(scope, panelX + panelWidth - 18, panelY + 22, scopeWidth);
      }
      const gradient = ctx.createLinearGradient(gradientX, 0, gradientX + gradientWidth, 0);
      colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.roundRect(gradientX, gradientY, gradientWidth, 6, 3); ctx.fill();
      const markerX = gradientX + progress * gradientWidth;
      ctx.strokeStyle = "rgba(5,20,30,.7)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(markerX, gradientY - 4); ctx.lineTo(markerX, gradientY + 10); ctx.stroke();
      ctx.strokeStyle = markerColor; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = markerColor;
      ctx.beginPath(); ctx.arc(markerX, gradientY - 4, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#93afbb";
      ctx.font = `400 9px ${mapHeadingFont}`;
      ctx.textAlign = "left";
      ctx.fillText(minimumLabel, gradientX, gradientY + 23);
      ctx.textAlign = "right";
      ctx.fillText(maximumLabel, gradientX + gradientWidth, gradientY + 23);
      ctx.restore();
      return { id, progress, panelX, panelY, panelWidth, panelHeight };
    };
    const drawGlobalRaster = (image, alpha, { forestOnly = false, fadeAfterSeparator = false } = {}) => {
      const rasterAlpha = (ready) => fadeAfterSeparator
        ? alpha * getForestRasterRevealAlpha(now, ready) : alpha;
      const source = getRasterDimensions(image);
      if (!source.width || !source.height) { rasterAlpha(false); return; }
      if (mapScope === "earth") {
        if (
          forestOnly &&
          japanOverlay.dataset.viewAnimation === "running" &&
          !forestRasterCache.has(image)
        ) { rasterAlpha(false); return; }
        const projection = japanView.earthProjection || getEarthProjection(rect);
        const geographicRaster = forestOnly
          ? getForestGeographicRaster(image)
          : getGeographicRaster(image);
        if (!geographicRaster) { rasterAlpha(false); return; }
        const drawAlpha = rasterAlpha(true);
        if (drawAlpha <= 0) return;
        const worldCopies = getEarthWorldCopies(projection);
        japanOverlay.dataset.rasterWorldCopies = worldCopies
          .map((copy) => copy.x.toFixed(2))
          .join(",");
        ctx.globalAlpha = drawAlpha;
        for (const copy of worldCopies) {
          ctx.drawImage(geographicRaster, copy.x, copy.y, copy.width, copy.height);
        }
        ctx.globalAlpha = 1;
        return;
      }
      const drawAlpha = rasterAlpha(true);
      if (drawAlpha <= 0) return;
      const northWest = pointFor({ lon: -180, lat: 85.0511 });
      const southEast = pointFor({ lon: 180, lat: -85.0511 });
      const worldWidth = southEast.x - northWest.x;
      ctx.globalAlpha = drawAlpha;
      for (const offset of [-worldWidth, 0, worldWidth]) {
        ctx.drawImage(image, northWest.x + offset, northWest.y, worldWidth, southEast.y - northWest.y);
      }
      ctx.globalAlpha = 1;
    };
    const drawNightLightsLayer = (image, dimmed) => {
      if (!image.complete || !image.naturalWidth) {
        japanOverlay.dataset.nightLightsLayer = "loading";
        return;
      }
      japanOverlay.dataset.nightLightsLayer = dimmed ? "dimmed" : "visible";
      japanOverlay.dataset.nightLightsSource = "NASA-VIIRS-2016";
      japanOverlay.dataset.nightLightsProjection = "web-mercator-to-geographic";
      japanOverlay.dataset.nightLightsDisplay = "glow-plus-radiance-core";

      ctx.save();
      ctx.filter = "brightness(3.4) contrast(1.25) blur(2.6px)";
      drawGlobalRaster(image, dimmed ? 0.015 : 0.78);
      ctx.restore();

      ctx.save();
      ctx.filter = "brightness(2.7) contrast(1.45)";
      drawGlobalRaster(image, dimmed ? 0.03 : 1);
      ctx.restore();
    };

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (signalMode.id === "breathing-earth") {
      const state = getBreathingEarthState(signalMode);
      renderGosatHeatmap(ctx, rect, left, top, state);
      japanOverlay.dataset.auroraForecast = ovationAuroraState.status;
      japanOverlay.dataset.auroraForecastSource = ovationAuroraState.source;
      japanOverlay.dataset.auroraForecastTime = ovationAuroraState.forecastTime;
      japanOverlay.dataset.auroraForecastPointCount = String(ovationAuroraState.pointCount);
      japanOverlay.dataset.auroraForecastMaximum = String(ovationAuroraState.maximum);
      if (ovationAuroraState.status === "ready") {
        const auroraBreath = reducedMotion ? 0.5 : 0.46 + Math.sin(time * 0.42) * 0.06;
        ctx.save();
        ctx.filter = "saturate(1.18) brightness(1.08)";
        ctx.globalCompositeOperation = "source-over";
        drawGlobalRaster(ovationAuroraCanvas, auroraBreath);
        ctx.globalCompositeOperation = "screen";
        drawGlobalRaster(ovationAuroraCanvas, auroraBreath * 0.58);
        ctx.restore();
      }
      drawQuantitativeLegendPanel({
        id: "co2-concentration",
        title: "大気CO₂濃度 / 全球平均",
        current: `${state.timeline?.yearLabel || state.selectedYear || "—"}　${state.timeline?.referencePpm?.toFixed(1) || "—"} ppm`,
        value: Number(state.timeline?.referencePpm),
        minimum: 300,
        maximum: 500,
        minimumLabel: "300 ppm",
        maximumLabel: "500 ppm",
        colors: XCO2_COLOR_STOPS.map((stop) => `rgb(${stop.color.join(",")})`),
      });
      ctx.textAlign = "left";
    } else if (signalMode.id === "blue-circulation") {
      const state = getBlueCirculationState(signalMode);
      const longitudeCopies = [0];
      const pulse = reducedMotion ? 0.68 : 0.62 + Math.sin(time * 1.15) * 0.12;
      const arrowStride = rect.width <= 720 ? 6 : 5;
      let currentVisiblePoiCount = 0;
      let currentPoiMarkerCount = 0;
      japanOverlay.dataset.currentVisualLanguage = "continuous-interpolated-current-brush";
      japanOverlay.dataset.currentArrowStride = String(arrowStride);

      for (const [currentIndex, row] of (state?.currents || []).entries()) {
        const speed = Math.hypot(row.uMs, row.vMs);
        if (speed < 0.001) continue;
        const reveal = getMapPlotReveal(currentIndex, state.currents.length, now);
        if (reveal.progress <= 0) continue;
        const destination = getAdvectedCurrentPosition(row, state.horizonHours);
        for (const longitudeCopy of longitudeCopies) {
          const point = pointFor({ lon: row.lon + longitudeCopy, lat: row.lat });
          if (!visible(point, 80)) continue;
          currentVisiblePoiCount += 1;
          ctx.save();
          applyMapPlotReveal(ctx, point, reveal);
          const end = pointFor({ lon: destination.lon + longitudeCopy, lat: destination.lat });
          const speedUnit = clamp(speed / 1.5, 0, 1);
          const directionX = row.uMs / speed;
          const directionY = -row.vMs / speed;
          const normalX = -directionY;
          const normalY = directionX;
          const strandLength = 18 + speedUnit * 28;
          const bend = Math.sin(row.lon * 0.17 + row.lat * 0.11 + time * 0.2) * (3 + speedUnit * 6);
          const strandStart = {
            x: point.x - directionX * strandLength * 0.56,
            y: point.y - directionY * strandLength * 0.56,
          };
          const strandEnd = {
            x: point.x + directionX * strandLength * 0.44,
            y: point.y + directionY * strandLength * 0.44,
          };
          const strandControl = {
            x: point.x + normalX * bend,
            y: point.y + normalY * bend,
          };

          ctx.beginPath();
          ctx.moveTo(strandStart.x, strandStart.y);
          ctx.quadraticCurveTo(strandControl.x, strandControl.y, strandEnd.x, strandEnd.y);
          ctx.strokeStyle = getCurrentSpeedColor(speed, 0.035 + speedUnit * 0.045);
          ctx.lineWidth = 3 + speedUnit * 2.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(strandStart.x, strandStart.y);
          ctx.quadraticCurveTo(strandControl.x, strandControl.y, strandEnd.x, strandEnd.y);
          ctx.strokeStyle = getCurrentSpeedColor(speed, 0.12 + speedUnit * 0.12);
          ctx.lineWidth = 0.5 + speedUnit * 0.65;
          ctx.stroke();

          const pearlProgress = reducedMotion
            ? 0.58
            : (time * (0.055 + speedUnit * 0.04) + currentIndex * 0.173) % 1;
          const inversePearlProgress = 1 - pearlProgress;
          const pearlX = inversePearlProgress * inversePearlProgress * strandStart.x
            + 2 * inversePearlProgress * pearlProgress * strandControl.x
            + pearlProgress * pearlProgress * strandEnd.x;
          const pearlY = inversePearlProgress * inversePearlProgress * strandStart.y
            + 2 * inversePearlProgress * pearlProgress * strandControl.y
            + pearlProgress * pearlProgress * strandEnd.y;
          ctx.beginPath();
          ctx.arc(pearlX, pearlY, 0.8 + speedUnit * 1.15, 0, Math.PI * 2);
          ctx.fillStyle = getCurrentSpeedColor(speed, 0.26 + speedUnit * 0.2);
          ctx.fill();

          if (state.horizonHours > 0.25) {
            const distanceX = end.x - point.x;
            const distanceY = end.y - point.y;
            const distance = Math.hypot(distanceX, distanceY);
            const advectionBend = Math.min(38, distance * 0.18)
              * Math.sin(row.lon * 0.13 - row.lat * 0.09);
            const advectionControlX = (point.x + end.x) * 0.5 + normalX * advectionBend;
            const advectionControlY = (point.y + end.y) * 0.5 + normalY * advectionBend;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.quadraticCurveTo(advectionControlX, advectionControlY, end.x, end.y);
            ctx.strokeStyle = getCurrentSpeedColor(speed, 0.2 + speedUnit * 0.42);
            ctx.lineWidth = 0.65 + speedUnit * 1.25;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(end.x, end.y, 1.25 + speed * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = getCurrentSpeedColor(speed, pulse);
            ctx.fill();
          }
          if (currentIndex % arrowStride === 0 || speed >= 0.9) {
            drawVectorArrow(
              ctx,
              point.x,
              point.y,
              row.uMs,
              row.vMs,
              getCurrentSpeedColor(speed, 0.25 + speedUnit * 0.2),
              20,
            );
          }
          const markerRadius = 3.4 + speedUnit * 2.8;
          const markerPulse = reducedMotion ? 1 : 1 + Math.sin(time * 1.6 + currentIndex * 0.73) * 0.08;
          const markerGlow = ctx.createRadialGradient(
            point.x,
            point.y,
            0,
            point.x,
            point.y,
            markerRadius * 3.2,
          );
          markerGlow.addColorStop(0, getCurrentSpeedColor(speed, 0.98));
          markerGlow.addColorStop(0.34, getCurrentSpeedColor(speed, 0.48));
          markerGlow.addColorStop(1, getCurrentSpeedColor(speed, 0));
          ctx.beginPath();
          ctx.arc(point.x, point.y, markerRadius * 3.2 * markerPulse, 0, Math.PI * 2);
          ctx.fillStyle = markerGlow;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(point.x, point.y, markerRadius * markerPulse, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(3,20,34,.9)";
          ctx.fill();
          ctx.strokeStyle = getCurrentSpeedColor(speed, 0.96);
          ctx.lineWidth = 1.25;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(point.x, point.y, Math.max(1.2, markerRadius * 0.32), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(234,255,255,.98)";
          ctx.fill();
          currentPoiMarkerCount += 1;
          ctx.restore();
        }
      }
      japanOverlay.dataset.currentVisiblePoiCount = String(currentVisiblePoiCount);
      japanOverlay.dataset.currentPoiMarkerCount = String(currentPoiMarkerCount);
      japanOverlay.dataset.currentPoiMarkerStyle = "luminous-ring-above-data-brush";
      for (const [windIndex, row] of (signalMode.signals.climate || []).entries()) {
        if (!Number.isFinite(row.windSpeedMs)) continue;
        if (windIndex % (rect.width <= 720 ? 8 : 7) !== 0) continue;
        const reveal = getMapPlotReveal(windIndex, signalMode.signals.climate.length, now);
        if (reveal.progress <= 0) continue;
        for (const longitudeCopy of longitudeCopies) {
          const point = pointFor({ lon: row.lon + longitudeCopy, lat: row.lat });
          if (!visible(point)) continue;
          ctx.save();
          applyMapPlotReveal(ctx, point, reveal);
          const angle = ((row.windDirectionDeg || 0) - 90) * (Math.PI / 180);
          drawVectorArrow(
            ctx,
            point.x,
            point.y,
            Math.cos(angle) * row.windSpeedMs,
            -Math.sin(angle) * row.windSpeedMs,
            "rgba(235,250,255,.15)",
            2.8,
          );
          ctx.restore();
        }
      }
      drawQuantitativeLegendPanel({
        id: "ocean-current-speed",
        title: "海流速度 / 観測点平均",
        current: `平均 ${state?.meanSpeedMs?.toFixed(2) || "—"} m/s`,
        value: Number(state?.meanSpeedMs),
        minimum: 0,
        maximum: 1.5,
        minimumLabel: "0 m/s",
        maximumLabel: "1.5 m/s以上",
        colors: [
          getCurrentSpeedColor(0, 1),
          getCurrentSpeedColor(0.5, 1),
          getCurrentSpeedColor(0.85, 1),
          getCurrentSpeedColor(1.2, 1),
          getCurrentSpeedColor(1.5, 1),
        ],
      });
    } else if (signalMode.id === "forest-cloud-engine") {
      const sequence = getMapSequenceState(signalMode);
      const precipitationRows = signalMode.signals.precipitation || [];
      const visibleRainIndexes = precipitationRows
        .map((row, index) => ({ index, point: pointFor(row) }))
        .filter(({ point }) => visible(point))
        .map(({ index }) => index);
      const rainRevealOrder = new Map(visibleRainIndexes.map((index, order) => [index, order]));
      const brazilRain = precipitationRows.find((row) => row.id === "brazil");
      japanOverlay.dataset.forestRainCircleRange = `${FOREST_RAIN_MIN_RADIUS}-${FOREST_RAIN_MAX_RADIUS}px radius`;
      japanOverlay.dataset.forestRainBrazil = brazilRain
        ? `${brazilRain.precipitationMmDay.toFixed(2)} mm/日`
        : "missing";
      drawGlobalRaster(landCoverImage, 0.5, { forestOnly: true, fadeAfterSeparator: true });
      const drawRainCircle = (row, index) => {
        const point = pointFor(row);
        if (!visible(point)) return;
        const reveal = getMapPlotReveal(
          rainRevealOrder.get(index) ?? index,
          Math.max(1, visibleRainIndexes.length),
          now,
        );
        if (reveal.progress <= 0) return;
        const precipitationMmDay = Number(row.precipitationMmDay) || 0;
        const rain = clamp(precipitationMmDay / FOREST_RAIN_REFERENCE_MAX_MM_DAY, 0, 1);
        const radius = getForestRainRadius(precipitationMmDay);
        const selected = index === sequence?.selectedIndex;
        ctx.save();
        applyMapPlotReveal(ctx, point, reveal);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,18,35,${selected ? 0.82 : 0.62})`;
        ctx.fill();

        const fill = ctx.createRadialGradient(
          point.x - radius * 0.24,
          point.y - radius * 0.28,
          Math.max(2, radius * 0.08),
          point.x,
          point.y,
          radius,
        );
        fill.addColorStop(0, `rgba(226,252,255,${selected ? 0.98 : 0.9})`);
        fill.addColorStop(0.18, `rgba(91,218,255,${selected ? 0.9 : 0.78})`);
        fill.addColorStop(1, `rgba(25,125,255,${selected ? 0.52 : 0.3 + rain * 0.25})`);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = selected ? "rgba(222,251,255,.98)" : "rgba(151,225,255,.82)";
        ctx.lineWidth = selected ? 2.4 : 1.4;
        ctx.stroke();

        if (selected) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius + 10 + Math.sin(time * 2.2) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(153,220,255,.88)";
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        if (selected || precipitationMmDay >= 3.5) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0,10,24,.96)";
          ctx.shadowBlur = 7;
          ctx.fillStyle = "rgba(240,253,255,.98)";
          ctx.font = `400 ${selected ? 11 : 10}px ${mapHeadingFont}`;
          ctx.fillText(precipitationMmDay.toFixed(1), point.x, point.y - 4);
          ctx.font = `400 7px ${mapHeadingFont}`;
          ctx.fillText(row.id === "brazil" ? "ブラジル" : getCountryNameJa(row), point.x, point.y + 8);
        } else {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(236,253,255,.94)";
          ctx.fill();
        }
        ctx.restore();

      };
      precipitationRows.forEach((row, index) => {
        if (index !== sequence?.selectedIndex) drawRainCircle(row, index);
      });
      if (sequence?.selected) drawRainCircle(sequence.selected, sequence.selectedIndex);
      drawQuantitativeLegendPanel({
        id: "precipitation",
        title: `降水量 / ${precipitationRows.length}参照地点`,
        current: `選択地点 ${sequence?.selected?.precipitationMmDay?.toFixed(2) || "—"} mm/日`,
        value: Number(sequence?.selected?.precipitationMmDay),
        minimum: 0,
        maximum: FOREST_RAIN_REFERENCE_MAX_MM_DAY,
        minimumLabel: "0 mm/日",
        maximumLabel: `${FOREST_RAIN_REFERENCE_MAX_MM_DAY.toFixed(1)} mm/日以上`,
        colors: ["rgb(25,125,255)", "rgb(91,218,255)", "rgb(226,252,255)"],
      });
      if (sequence?.selected) {
        const row = sequence.selected;
        const point = pointFor(row);
        if (visible(point)) drawRainSelectionLabel(point, row, getForestRainRadius(row.precipitationMmDay));
      }
    } else if (signalMode.id === "pollination-protocol") {
      const sequence = getMapSequenceState(signalMode);
      const records = getModeDataPois();
      const stageKey = sequence?.stageKey || "records";
      const relations = sequence?.relations || [];
      japanOverlay.dataset.pollinationStage = stageKey;
      japanOverlay.dataset.pollinationOccurrenceCount = String(records.length);
      japanOverlay.dataset.pollinationRelationCount = String(relations.length);
      japanOverlay.dataset.pollinationSampling = "max-2-per-country";
      const points = records.map((row, index) => ({ row, index, point: pointFor(row) }));

      if (stageKey === "sampling") {
        const byCountry = new Map();
        points.forEach((entry) => {
          const key = entry.row.countryCode || entry.row.country || "unknown";
          const group = byCountry.get(key) || [];
          group.push(entry);
          byCountry.set(key, group);
        });
        ctx.save();
        ctx.setLineDash([4, 5]);
        byCountry.forEach((group) => {
          if (group.length < 2 || !visible(group[0].point) || !visible(group[1].point)) return;
          ctx.beginPath();
          ctx.moveTo(group[0].point.x, group[0].point.y);
          ctx.lineTo(group[1].point.x, group[1].point.y);
          ctx.strokeStyle = "rgba(255,210,112,.48)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
        ctx.restore();
      }

      const activeRecordIndex = records.length
        ? Math.floor(time * 0.72) % records.length
        : -1;
      points.forEach(({ row, index, point }) => {
        if (!visible(point)) return;
        const reveal = getMapPlotReveal(index, points.length, now);
        if (reveal.progress <= 0) return;
        const active = stageKey === "records" && index === activeRecordIndex;
        const radius = stageKey === "sampling" ? 4.2 : active ? 4.8 : 2.4;
        ctx.save();
        applyMapPlotReveal(ctx, point, reveal);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = stageKey === "relations"
          ? "rgba(255,219,109,.16)"
          : active
            ? "rgba(255,247,190,.98)"
            : "rgba(255,219,109,.8)";
        ctx.fill();
        if (stageKey === "sampling") {
          ctx.strokeStyle = "rgba(255,245,192,.86)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        if (active) {
          for (let ring = 0; ring < 3; ring += 1) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 12 + ring * 8 + Math.sin(time * 2 + ring) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,${210 - ring * 18},112,${0.58 - ring * 0.13})`;
            ctx.stroke();
          }
        }
        ctx.restore();
        if (active) {
          drawSelectionLabel(
            point,
            `${getCountryNameJa(row)}の観察記録`,
            row.species === "Apis mellifera" ? "セイヨウミツバチ" : row.species || "ミツバチ",
            "rgba(255,223,112,.96)",
            { detail: `${row.eventDate?.slice(0, 10) || "日付不明"} · GBIF · 生息数ではなく観察記録` },
          );
        }
      });

      const drawEvidencePanel = (code, title, copy) => {
        if (rect.width < 760) return;
        const width = Math.min(430, rect.width * 0.34);
        const x = clamp(rect.width * 0.62 - width / 2, 24, rect.width - width - 24);
        const y = Math.max(94, rect.height * 0.15);
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "rgba(2,15,24,.88)";
        ctx.fillRect(x, y, width, 88);
        ctx.strokeStyle = "rgba(255,211,112,.42)";
        ctx.strokeRect(x, y, width, 88);
        ctx.fillStyle = "rgba(255,220,126,.9)";
        ctx.font = `400 8px ${mapHeadingFont}`;
        ctx.fillText(code, x + 16, y + 20);
        ctx.fillStyle = "rgba(246,252,247,.96)";
        ctx.font = `400 16px ${mapHeadingFont}`;
        ctx.fillText(title, x + 16, y + 46, width - 32);
        ctx.fillStyle = "rgba(218,235,232,.68)";
        ctx.font = `400 10px ${mapHeadingFont}`;
        ctx.fillText(copy, x + 16, y + 69, width - 32);
        ctx.restore();
      };

      if (stageKey === "records") {
        drawEvidencePanel(
          "STEP 1 / POINT ≠ HABITAT",
          "点は、ミツバチではなく観察記録",
          `${records.length}件のGBIF記録。空白は「いない場所」を意味しません。`,
        );
      } else if (stageKey === "sampling") {
        drawEvidencePanel(
          "STEP 2 / SAMPLING LIMIT",
          "各国から最大2件に揃えた標本",
          "線で結ばれた二点は同じ国。点の数では生息数を比較できません。",
        );
      } else if (stageKey === "relations" && relations.length) {
        const centerX = rect.width * (rect.width >= 1000 ? 0.64 : 0.56);
        const centerY = rect.height * 0.47;
        const networkRadius = Math.min(190, Math.max(100, Math.min(rect.width * 0.15, rect.height * 0.21)));
        const activeRelationIndex = Math.floor(time * 0.45) % relations.length;
        const rotation = reducedMotion ? -Math.PI / 2 : time * 0.025;
        let activeNode = null;
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        relations.forEach((relation, index) => {
          const angle = rotation + (index / relations.length) * Math.PI * 2;
          const radius = networkRadius * (0.78 + (index % 3) * 0.1);
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          const active = index === activeRelationIndex;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = active ? "rgba(255,226,120,.92)" : "rgba(139,232,178,.24)";
          ctx.lineWidth = active ? 2.2 : 0.9;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, active ? 7 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = active ? "rgba(255,230,134,.98)" : "rgba(118,235,173,.78)";
          ctx.fill();
          if (active) activeNode = { x, y, relation };
        });
        ctx.beginPath();
        ctx.arc(centerX, centerY, 34, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(24,34,25,.95)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,221,116,.92)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,231,146,.98)";
        ctx.font = `400 10px ${mapHeadingFont}`;
        ctx.fillText("Apis", centerX, centerY - 3);
        ctx.fillStyle = "rgba(235,246,226,.82)";
        ctx.font = `400 8px ${mapHeadingFont}`;
        ctx.fillText("mellifera", centerX, centerY + 11);
        ctx.fillStyle = "rgba(255,220,118,.92)";
        ctx.font = `400 9px ${mapHeadingFont}`;
        ctx.fillText("NON-GEOGRAPHIC / GloBI RELATION NETWORK", centerX, centerY - networkRadius - 28);
        ctx.fillStyle = "rgba(218,236,224,.66)";
        ctx.font = `400 9px ${mapHeadingFont}`;
        ctx.fillText("枝の位置・長さは、場所・頻度・強さを表しません", centerX, centerY - networkRadius - 12);
        if (activeNode) {
          const labelWidth = Math.min(360, rect.width - 40);
          const labelX = clamp(centerX - labelWidth / 2, 20, rect.width - labelWidth - 20);
          const labelY = Math.min(rect.height - 72, centerY + networkRadius + 18);
          ctx.fillStyle = "rgba(2,15,20,.9)";
          ctx.fillRect(labelX, labelY, labelWidth, 48);
          ctx.strokeStyle = "rgba(142,236,179,.42)";
          ctx.strokeRect(labelX, labelY, labelWidth, 48);
          ctx.fillStyle = "rgba(151,239,185,.9)";
          ctx.font = `400 8px ${mapHeadingFont}`;
          ctx.fillText(`送粉関係 / ${activeRelationIndex + 1} / ${relations.length}`, centerX, labelY + 17);
          ctx.fillStyle = "rgba(242,250,236,.96)";
          ctx.font = `400 12px ${mapHeadingFont}`;
          ctx.fillText(activeNode.relation.targetTaxon, centerX, labelY + 35, labelWidth - 24);
        }
        ctx.restore();
      }
    } else if (signalMode.id === "nothing-is-waste") {
      const sequence = getMapSequenceState(signalMode);
      const rows = signalMode.signals.countryWaste || [];
      const selectedIndex = sequence?.selectedIndex ?? 0;
      const selected = sequence?.selected;
      const heatmap = drawPercentageCountryChoropleth(ctx, rect, rows, selected?.iso3, now, "recyclePercent", false);
      japanOverlay.dataset.recyclingEncoding = "country-choropleth";
      japanOverlay.dataset.recyclingPieCount = "0";
      japanOverlay.dataset.recyclingCountryCount = String(rows.length);
      japanOverlay.dataset.recyclingCountryFillCount = String(heatmap.filledCount);
      japanOverlay.dataset.recyclingVisibleCountryFillCount = String(heatmap.visibleCount);
      japanOverlay.dataset.recyclingFillScale = "country-blue-0-100";
      japanOverlay.dataset.recyclingOfficialCount = String(rows.length);
      japanOverlay.dataset.recyclingImputedCount = "0";
      japanOverlay.dataset.recyclingSelectedRate = selected?.recyclePercent.toFixed(1) ?? "";
      japanOverlay.dataset.recyclingSelectedIndex = String(selectedIndex);
      japanOverlay.dataset.recyclingSelectedIso3 = selected?.iso3 || "";
      japanOverlay.dataset.recyclingSelectedStatus = selected ? "official" : "missing";
      japanOverlay.dataset.recyclingSelectedSource = selected ? recyclingSourceId(selected) : "";
      japanOverlay.dataset.countryGeometryState = naturalEarthCountryState;

      // Country polygons carry the value. Only a small locator marks the selection.
      if (selected) {
        const point = pointFor(selected);
        const reveal = getMapPlotReveal(selectedIndex, rows.length, now);
        if (visible(point) && reveal.progress > 0) {
          ctx.save();
          applyMapPlotReveal(ctx, point, reveal);
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,239,146,.98)";
          ctx.fill();
          ctx.restore();
          drawSelectionLabel(point, getCountryNameJa(selected),
            `再資源化率　${selected.recyclePercent.toFixed(1)}%`, null,
            { radius: 8, detail: `${selected.year}年 · ${recyclingSourceLabel(selected)}` });
        }
      }
      drawQuantitativeLegendPanel({
        id: "recycling-rate",
        title: `再資源化率 / ${rows.length}の国・地域`,
        current: `${selected?.year || "—"}年　${selected?.recyclePercent.toFixed(1) ?? "—"}%`,
        value: selected?.recyclePercent,
        minimum: 0,
        maximum: 100,
        minimumLabel: "0%",
        maximumLabel: "100%",
        colors: ["rgb(14,72,150)", "rgb(30,151,203)", "rgb(46,230,255)"],
        markerColor: "rgba(244,255,250,.98)",
      });
    } else if (signalMode.id === "anthropocene-scar") {
      const sequence = getMapSequenceState(signalMode);
      const nightLightsDimmed = now < anthropocenePeelUntil;
      const emissionRows = sequence?.yearRows || [];
      const heatmap = drawAnthropoceneCountryChoropleth(
        ctx,
        rect,
        emissionRows,
        sequence?.selected?.iso3,
        now,
      );
      drawNightLightsLayer(nightLightsImage, nightLightsDimmed);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = nightLightsDimmed ? 1 : 0.88;
      renderCachedReferenceWorldModel(ctx, rect, left, top);
      ctx.restore();
      japanOverlay.dataset.nightLightsBoundaryOverlay = "coast-and-country";
      japanOverlay.dataset.emissionsCountryFillCount = String(heatmap.filledCount);
      japanOverlay.dataset.emissionsVisibleCountryFillCount = String(heatmap.visibleCount);
      japanOverlay.dataset.emissionsHeatSum = heatmap.heatSum.toFixed(4);
      japanOverlay.dataset.emissionsMaximumHeat = heatmap.maximumHeat.toFixed(4);
      japanOverlay.dataset.emissionsTotalMtCo2 = Number(sequence?.totalMtCo2 || 0).toFixed(3);
      japanOverlay.dataset.emissionsSelectedCountryMtCo2 = Number(
        sequence?.selected?.emissionsMtCo2 || 0,
      ).toFixed(3);
      japanOverlay.dataset.emissionsScaleMtCo2 = String(ANTHROPOCENE_EMISSIONS_SCALE_MT);
      japanOverlay.dataset.emissionsEncoding = "country-fixed-log-color";
      japanOverlay.dataset.emissionsGeometry = "natural-earth-country-choropleth";
      japanOverlay.dataset.emissionsHitSurface = "country-regions";
      japanOverlay.dataset.emissionsSelectedYear = String(sequence?.selectedYear || "");
      japanOverlay.dataset.nightLightsReferenceYear = "2016";
      delete japanOverlay.dataset.emissionsCircleCount;
      delete japanOverlay.dataset.emissionsVisibleCircleCount;
      delete japanOverlay.dataset.emissionsRadiusSum;
      delete japanOverlay.dataset.emissionsMaximumRadius;
      const selected = sequence?.selected;
      // The open detail card owns the country's readout; keep the map clear
      // of the duplicate canvas speech bubble until the card is closed.
      if (selected && !selectedJapanPoi) {
        const point = pointFor(selected);
        if (visible(point)) {
          drawSelectionLabel(
            { x: point.x + 18, y: point.y },
            getCountryNameJa(selected),
            `化石燃料由来CO₂　${selected.emissionsMtCo2.toFixed(1)} Mt`,
            "rgba(255,190,133,.98)",
            { anchor: point, detail: `${selected.year}年の排出量` },
          );
        }
      }
      drawQuantitativeLegendPanel({
        id: "fossil-co2",
        title: "化石燃料由来CO₂ / 国別",
        current: `${sequence?.selectedYear || "—"}年　${formatObservationNumber(selected?.emissionsMtCo2, 1)} Mt`,
        value: Number(selected?.emissionsMtCo2),
        minimum: 0,
        maximum: ANTHROPOCENE_EMISSIONS_SCALE_MT,
        minimumLabel: "0 Mt",
        maximumLabel: "12,000 Mt以上",
        colors: ANTHROPOCENE_HEAT_STOPS.map((stop) => `rgb(${stop.color.join(",")})`),
        scale: "log",
      });
    } else if (signalMode.id === "rhythm-of-disaster") {
      const sequence = getMapSequenceState(signalMode);
      const selectedYear = sequence?.selectedYear || "";
      const yearEvents = sequence?.yearEvents || [];
      if (japanDataLayer === "history") {
        japanOverlay.dataset.earthquakeLayer = "japan-history";
      } else {
        const yearTransition = getEarthquakeYearTransition(selectedYear, yearEvents, now);
        const displayedYear = yearTransition.currentYear;
        const displayedEvents = yearTransition.currentEvents;
        const cameraSequence = syncEarthquakeCameraSequence(yearTransition, now);
        const strongest = displayedEvents.reduce(
          (current, event) => !current || event.magnitude > current.magnitude ? event : current,
          null,
        );
        const earthProjection = japanView.earthProjection || getEarthProjection(rect);
        const strongestMagnitude = strongest?.magnitude || GLOBAL_EARTHQUAKE_MIN_MAGNITUDE;
        const strongestImpactRadiusKm = getGlobalEarthquakeImpactRadiusKm(strongestMagnitude);
        const strongestDurationMs = getGlobalEarthquakeWaveDurationMs(strongestImpactRadiusKm);
        const waveProgress = yearTransition.eventReveals.reduce((maximum, reveal) => {
          const eventImpactRadiusKm = getGlobalEarthquakeImpactRadiusKm(reveal.event.magnitude);
          const eventDurationMs = getGlobalEarthquakeWaveDurationMs(eventImpactRadiusKm);
          return Math.max(maximum, clamp(reveal.waveElapsedMs / eventDurationMs, 0, 1));
        }, 0);
        const strongestImpactEllipse = getGlobalEarthquakeImpactEllipse(
          strongest || { latitude: 0 },
          strongestImpactRadiusKm,
          earthProjection,
        );
        japanOverlay.dataset.earthquakeLayer = "world-year";
        japanOverlay.dataset.earthquakeYear = displayedYear;
        japanOverlay.dataset.earthquakeYearEventCount = String(displayedEvents.length);
        japanOverlay.dataset.earthquakeTotalEventCount = String(signalMode.signals.globalEvents?.length || 0);
        japanOverlay.dataset.earthquakeWaveSync = "chronological-sequential-distance-limited";
        japanOverlay.dataset.earthquakeWaveModel = "usgs-estimated-felt-radius";
        japanOverlay.dataset.earthquakeWaveProjection = "equirectangular-geodesic-distance";
        japanOverlay.dataset.earthquakeWaveEllipseReason = "longitude-distance-cos-latitude";
        japanOverlay.dataset.earthquakeMarkerStyle = "red-heavy-cross";
        japanOverlay.dataset.earthquakeMarkerColor = "rgb(255,43,51)";
        japanOverlay.dataset.earthquakeWaveProgress = waveProgress.toFixed(3);
        japanOverlay.dataset.earthquakeWaveRadiusMaxKm = strongestImpactRadiusKm.toFixed(0);
        japanOverlay.dataset.earthquakeWaveRadiusMaxPx = strongestImpactEllipse.y.toFixed(1);
        japanOverlay.dataset.earthquakeWaveRadiusMaxXPx = strongestImpactEllipse.x.toFixed(1);
        japanOverlay.dataset.earthquakeWaveDurationMaxMs = strongestDurationMs.toFixed(0);
        japanOverlay.dataset.earthquakeTimelinePlayback = "auto-loop";
        japanOverlay.dataset.earthquakeYearDwellMs = String(sequence?.playbackDurationMs || 0);
        japanOverlay.dataset.earthquakeEventHoldMs = String(GLOBAL_EARTHQUAKE_EVENT_HOLD_MS);
        japanOverlay.dataset.earthquakeYearTransitionMode = "chronological-in-simultaneous-fade-out";
        japanOverlay.dataset.earthquakeYearTransitionPhase = yearTransition.phase;
        japanOverlay.dataset.earthquakeYearTransitionMs = String(yearTransition.durationMs);
        japanOverlay.dataset.earthquakeYearTransitionProgress = yearTransition.progress.toFixed(3);
        japanOverlay.dataset.earthquakeYearTransitionTo = yearTransition.targetYear;
        japanOverlay.dataset.earthquakeRevealOrder = "occurred-at-ascending";
        japanOverlay.dataset.earthquakeExitOrder = "simultaneous";
        japanOverlay.dataset.earthquakeOrderedEventTimes = displayedEvents
          .map((event) => event.occurredAt || "")
          .join(",");
        japanOverlay.dataset.earthquakeExitOrderedEventTimes = yearTransition.exitOrderIndices
          .map((index) => displayedEvents[index]?.occurredAt || "")
          .filter(Boolean)
          .join(",");
        japanOverlay.dataset.earthquakeEventStaggerMs = String(GLOBAL_EARTHQUAKE_EVENT_STAGGER_MS);
        japanOverlay.dataset.earthquakeEventAppearMs = String(GLOBAL_EARTHQUAKE_EVENT_APPEAR_MS);
        japanOverlay.dataset.earthquakeEventExitStaggerMs = String(GLOBAL_EARTHQUAKE_EVENT_EXIT_STAGGER_MS);
        japanOverlay.dataset.earthquakeEventDisappearMs = String(GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS);
        japanOverlay.dataset.earthquakeVisibleEventCount = String(yearTransition.visibleEventCount);
        japanOverlay.dataset.earthquakeActiveEventIndex = String(yearTransition.activeReveal?.index ?? -1);
        japanOverlay.dataset.earthquakeActiveEventOccurredAt = yearTransition.activeEvent?.occurredAt || "";
        japanOverlay.dataset.earthquakeActiveEventProgress = (yearTransition.activeReveal?.progress || 0).toFixed(3);
        japanOverlay.dataset.earthquakeEventAlphas = yearTransition.eventReveals.map(({ alpha }) => alpha.toFixed(3)).join(",");
        japanOverlay.dataset.earthquakeEventScales = yearTransition.eventReveals.map(({ scale }) => scale.toFixed(3)).join(",");
        const cameraEvent = displayedEvents[cameraSequence.activeIndex] || null;
        const cameraEventPoint = cameraEvent
          ? pointFor({ lon: cameraEvent.longitude, lat: cameraEvent.latitude })
          : null;
        japanOverlay.dataset.earthquakeCameraEventOccurredAt = cameraEvent?.occurredAt || "";
        japanOverlay.dataset.earthquakeCameraEventScreenX = cameraEventPoint?.x.toFixed(1) || "";
        japanOverlay.dataset.earthquakeCameraEventScreenY = cameraEventPoint?.y.toFixed(1) || "";
        japanOverlay.dataset.earthquakeCameraTargetX = (rect.width * 0.5).toFixed(1);
        japanOverlay.dataset.earthquakeCameraTargetY = (
          rect.height * (rect.width <= 720 ? 0.44 : 0.46)
        ).toFixed(1);
        japanOverlay.dataset.earthquakeSelectionLabelWidthPx = "0";
        japanOverlay.dataset.earthquakeSelectionLabelHeightPx = "0";
        japanOverlay.dataset.earthquakeSelectionPrimaryFontPx = "0";
        japanOverlay.dataset.earthquakeYearSummary = "hidden";

        const activeCameraReveal = yearTransition.eventReveals[cameraSequence.activeIndex] || null;
        const activeCameraLabelAlpha = activeCameraReveal?.labelAlpha || 0;
        japanOverlay.dataset.earthquakeActiveMarkerAlpha = (activeCameraReveal?.alpha || 0).toFixed(3);
        japanOverlay.dataset.earthquakeActiveCalloutAlpha = activeCameraLabelAlpha.toFixed(3);
        japanOverlay.dataset.earthquakeMagnitudePosition = "below";
        const activeCameraLabelPoint = activeCameraReveal
          ? pointFor({
            lon: activeCameraReveal.event.longitude,
            lat: activeCameraReveal.event.latitude,
          })
          : null;
        const activeCameraLabelVisible = Boolean(
          activeCameraReveal
          && activeCameraLabelAlpha > 0.01
          && (!cameraSequence.returned || yearTransition.phase === "exit")
          && !cameraSequence.suppressed
          && activeCameraLabelPoint
          && visible(activeCameraLabelPoint, 110)
        );
        japanOverlay.dataset.earthquakeActiveMagnitudeLabel = "below-marker";
        japanOverlay.dataset.earthquakeMagnitudeLabelCount = "0";
        const magnitudeLabels = [];

        const drawEarthquakeEvent = (event, {
          reveal = null,
          strongest = false,
        } = {}) => {
          if (reveal && reveal.alpha <= 0.01) return;
          const point = pointFor({ lon: event.longitude, lat: event.latitude });
          const magnitudeScale = clamp(
            (event.magnitude - GLOBAL_EARTHQUAKE_MIN_MAGNITUDE) /
              (GLOBAL_EARTHQUAKE_MAX_MAGNITUDE - GLOBAL_EARTHQUAKE_MIN_MAGNITUDE),
            0,
            1,
          );
          const impactRadiusKm = getGlobalEarthquakeImpactRadiusKm(event.magnitude);
          const eventDurationMs = getGlobalEarthquakeWaveDurationMs(impactRadiusKm);
          const eventProgress = reducedMotion
            ? 1
            : clamp((reveal?.waveElapsedMs || 0) / eventDurationMs, 0, 1);
          const easedProgress = eventProgress * eventProgress * (3 - 2 * eventProgress);
          const targetEllipse = getGlobalEarthquakeImpactEllipse(event, impactRadiusKm, earthProjection);
          const radiusX = targetEllipse.x * easedProgress;
          const radiusY = targetEllipse.y * easedProgress;
          const waveOpacity = 0.88 - eventProgress * 0.56;
          if (!visible(point, Math.max(targetEllipse.x, targetEllipse.y) + 12)) return;

          const appearance = reveal?.alpha ?? 1;
          const scale = reveal?.scale ?? 1;
          ctx.save();
          ctx.globalAlpha *= clamp(appearance, 0, 1);
          ctx.translate(point.x, point.y);
          ctx.scale(scale, scale);
          ctx.translate(-point.x, -point.y);

          if (radiusX > 2 && radiusY > 2) {
            [1, 0.72, 0.44].forEach((ringScale, ringIndex) => {
              ctx.beginPath();
              ctx.ellipse(
                point.x,
                point.y,
                radiusX * ringScale,
                radiusY * ringScale,
                0,
                0,
                Math.PI * 2,
              );
              ctx.strokeStyle = ringIndex === 0
                ? `rgba(255,177,86,${waveOpacity * (strongest ? 0.96 : 0.72)})`
                : `rgba(255,116,76,${waveOpacity * (ringIndex === 1 ? 0.38 : 0.2)})`;
              ctx.lineWidth = ringIndex === 0 ? 1.4 + magnitudeScale * 1.8 : 0.8 + magnitudeScale;
              ctx.stroke();
            });
          }

          const markerViewportScale = rect.width >= 2400 ? 1.35 : rect.width < 600 ? 0.9 : 1;
          const sourceRadius = (strongest
            ? 8.5 + magnitudeScale * 4.5
            : 7 + magnitudeScale * 3.5) * markerViewportScale;
          const markerLineWidth = Math.max(4, (strongest
            ? 5.2 + magnitudeScale * 1.6
            : 4.2 + magnitudeScale * 1.3) * markerViewportScale);
          const traceEpicenterCross = (halfSize) => {
            ctx.beginPath();
            ctx.moveTo(point.x - halfSize, point.y - halfSize);
            ctx.lineTo(point.x + halfSize, point.y + halfSize);
            ctx.moveTo(point.x + halfSize, point.y - halfSize);
            ctx.lineTo(point.x - halfSize, point.y + halfSize);
          };
          const popStrength = reveal?.phase === "enter" && reveal.progress < 1
            ? Math.sin(reveal.progress * Math.PI)
            : 0;
          if (popStrength > 0.01) {
            ctx.save();
            ctx.lineCap = "round";
            ctx.shadowColor = "rgba(255,22,34,.92)";
            ctx.shadowBlur = 11 + popStrength * 16;
            traceEpicenterCross(sourceRadius + 4 + reveal.progress * (5 + magnitudeScale * 3));
            ctx.strokeStyle = `rgba(255,58,65,${popStrength * 0.5})`;
            ctx.lineWidth = Math.max(2.4, markerLineWidth * 0.58);
            ctx.stroke();
            ctx.restore();
          }
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          traceEpicenterCross(sourceRadius);
          ctx.strokeStyle = "rgba(36,2,7,.9)";
          ctx.lineWidth = markerLineWidth + Math.max(2.4, markerViewportScale * 2.2);
          ctx.stroke();
          traceEpicenterCross(sourceRadius);
          ctx.strokeStyle = strongest ? "rgba(255,43,51,1)" : "rgba(238,35,45,.98)";
          ctx.lineWidth = markerLineWidth;
          ctx.shadowColor = strongest ? "rgba(255,25,36,.98)" : "rgba(255,28,40,.8)";
          ctx.shadowBlur = strongest ? 16 * markerViewportScale : 10 * markerViewportScale;
          ctx.stroke();
          ctx.restore();
          japanOverlay.dataset.earthquakeMarkerMaxLineWidthPx = String(
            Math.max(Number(japanOverlay.dataset.earthquakeMarkerMaxLineWidthPx) || 0, markerLineWidth),
          );

          magnitudeLabels.push({ event, point, appearance, scale, sourceRadius, markerLineWidth });
          ctx.restore();
        };

        yearTransition.eventReveals.forEach((reveal) => drawEarthquakeEvent(reveal.event, {
          reveal,
          strongest: reveal.event.id === strongest?.id,
        }));

        if (
          activeCameraLabelVisible
        ) {
          const event = activeCameraReveal.event;
          const point = activeCameraLabelPoint;
          ctx.save();
          ctx.globalAlpha *= activeCameraLabelAlpha;
          const activeLabel = formatEarthquakeDateJa(event.occurredAt, displayedYear);
          const magnitudeLabel = `マグニチュード M${event.magnitude.toFixed(1)}　深さ ${formatObservationNumber(event.depthKm, 1)} km`;
          japanOverlay.dataset.earthquakeActiveLabelPrimary = activeLabel;
          japanOverlay.dataset.earthquakeActiveLabelSecondary = magnitudeLabel;
          japanOverlay.dataset.earthquakeActiveLabelTimeZone = "Asia/Tokyo";
          drawSelectionLabel(
            { x: point.x + 16, y: point.y },
            activeLabel,
            magnitudeLabel,
            "rgba(232,243,242,.98)",
            { tone: "quiet", prominent: true, compactProminent: true, anchor: point, allowDuringPlotReveal: true,
              detail: `震源 ${formatCoordinateJa(event.latitude, event.longitude)} · USGS · 日本時間`, preferBelow: true },
          );
          ctx.restore();
        }

        // Keep each M value with its cross throughout the reveal and overview.
        // Draw above the delayed callout's tail so it cannot cover the digits.
        magnitudeLabels.forEach(({ event, point, appearance, scale, sourceRadius, markerLineWidth }) => {
          ctx.save();
          ctx.globalAlpha *= clamp(appearance, 0, 1);
          ctx.translate(point.x, point.y);
          ctx.scale(scale, scale);
          ctx.translate(-point.x, -point.y);
          const magnitudeFontPx = rect.width >= 2400 ? 18 : rect.width < 600 ? 12 : 14;
          const magnitudeY = point.y + sourceRadius + markerLineWidth / 2 + 3;
          ctx.font = `400 ${magnitudeFontPx}px ${mapHeadingFont}`;
          const magnitudeWidth = ctx.measureText(`M${event.magnitude.toFixed(1)}`).width * scale;
          magnitudeObstacles.push({ x: point.x-magnitudeWidth/2, y: point.y+(magnitudeY-point.y)*scale,
            width: magnitudeWidth, height: magnitudeFontPx*scale, gap: magnitudeFontPx });
          japanOverlay.dataset.earthquakeMagnitudeBoxes = JSON.stringify(magnitudeObstacles);
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(8,16,22,.95)";
          ctx.fillStyle = "rgba(255,218,211,.98)";
          ctx.shadowBlur = 0;
          ctx.strokeText(`M${event.magnitude.toFixed(1)}`, point.x, magnitudeY);
          ctx.fillText(`M${event.magnitude.toFixed(1)}`, point.x, magnitudeY);
          japanOverlay.dataset.earthquakeMagnitudeLabelMaxFontPx = String(magnitudeFontPx);
          japanOverlay.dataset.earthquakeMagnitudeLabelCount = String(
            Number(japanOverlay.dataset.earthquakeMagnitudeLabelCount) + 1,
          );
          ctx.restore();
        });

        drawQuantitativeLegendPanel({
          id: "earthquake-magnitude",
          title: "マグニチュード / この年最大",
          current: `${displayedYear}年　M${strongestMagnitude.toFixed(1)}`,
          value: strongestMagnitude,
          minimum: GLOBAL_EARTHQUAKE_MIN_MAGNITUDE,
          maximum: GLOBAL_EARTHQUAKE_MAX_MAGNITUDE,
          minimumLabel: `M${GLOBAL_EARTHQUAKE_MIN_MAGNITUDE.toFixed(1)}`,
          maximumLabel: `M${GLOBAL_EARTHQUAKE_MAX_MAGNITUDE.toFixed(1)}`,
          colors: ["rgb(238,35,45)", "rgb(255,116,76)", "rgb(255,232,151)"],
          markerColor: "rgba(255,255,236,.98)",
        });
      }
      ctx.fillStyle = "rgba(255,190,108,.74)";
      ctx.font = `400 8px ${mapHeadingFont}`;
      ctx.fillText("USGS年別 M7.5以上 / 推定可感半径 / 気象庁詳細は別レイヤー", 22, rect.height - 26);
    } else if (signalMode.id === "three-ecologies") {
      const state = getMapSequenceState(signalMode);
      const rows = state?.rows || [];
      const selected = state?.selected;
      const cultureRows = signalMode.signals.culture || [];
      const cultureView = ecologiesView === "culture";
      const selectionTransition = getEcologiesSelectionTransition(rows, selected, now);
      const currentSelectionWeight = selectionTransition.previousIso3 ? selectionTransition.progress : 1;
      const previousSelectionWeight = selectionTransition.previousIso3 ? 1 - selectionTransition.progress : 0;
      const peer = selected && globalThis.GaiaEcologiesExhibit?.nearestUrban(rows, selected);
      japanOverlay.dataset.ecologiesPlot = "paired-bars-with-linked-scatter";
      japanOverlay.dataset.ecologiesView = ecologiesView;
      japanOverlay.dataset.ecologiesPairCount = String(rows.length);
      japanOverlay.dataset.ecologiesCorrelation = Number.isFinite(state?.correlation) ? state.correlation.toFixed(3) : "";
      japanOverlay.dataset.ecologiesSelectedCountry = selected ? getCountryNameJa(selected) : "";
      japanOverlay.dataset.ecologiesSelectedIso3 = selected?.iso3 || "";
      japanOverlay.dataset.ecologiesCultureCount = String(cultureView ? cultureRows.length : 0);
      japanOverlay.dataset.ecologiesCountryDisplayMs = "4000";
      japanOverlay.dataset.ecologiesSelectionTransitionMs = String(ECOLOGIES_SELECTION_TRANSITION_MS);
      japanOverlay.dataset.ecologiesSelectionTransitionProgress = selectionTransition.progress.toFixed(3);
      japanOverlay.dataset.ecologiesPlaying = String(ecologiesPlaying);
      // Keep the map quiet: no unrelated forest raster, residual colour, or cultural
      // symbols until their view is explicitly selected.
      const mapRows = cultureView ? cultureRows : rows;
      const barWidth = clamp(rect.width * .025, 28, 82);
      const barHeight = rect.width >= 2400 ? 6 : 4;
      japanOverlay.dataset.ecologiesBarWidth = barWidth.toFixed(2);
      mapRows.forEach((row, index) => {
        const point = pointFor(row);
        if (!visible(point, barWidth)) return;
        const reveal = getMapPlotReveal(index, mapRows.length, now);
        if (reveal.progress <= 0) return;
        ctx.save();
        ctx.globalAlpha *= reveal.alpha;
        if (cultureView) {
          const isSelected = index === ecologiesCultureIndex;
          const size = rect.width >= 2400 ? 9 : 6;
          ctx.translate(point.x, point.y); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = isSelected ? "rgba(241,219,255,.98)" : "rgba(198,153,225,.7)";
          ctx.strokeStyle = "rgba(223,184,244,.8)"; ctx.lineWidth = 1.2;
          ctx.fillRect(-size, -size, size * 2, size * 2);
          if (isSelected) ctx.strokeRect(-size - 6, -size - 6, size * 2 + 12, size * 2 + 12);
        } else {
          const selectionWeight = row.iso3 === selectionTransition.currentIso3 ? currentSelectionWeight
            : row.iso3 === selectionTransition.previousIso3 ? previousSelectionWeight : 0;
          const isPeer = row.iso3 === peer?.iso3;
          const left = point.x - barWidth / 2, top = point.y - barHeight - 3;
          if (row.iso3 === selected?.iso3) {
            japanOverlay.dataset.ecologiesSelectedScreenX = point.x.toFixed(2);
            japanOverlay.dataset.ecologiesSelectedScreenY = point.y.toFixed(2);
          }
          ctx.fillStyle = "rgba(3,18,25,.82)";
          ctx.strokeStyle = selectionWeight > .01 ? `rgba(252,230,153,${.3 + selectionWeight * .65})`
            : isPeer ? "rgba(193,218,210,.65)" : "rgba(112,152,152,.3)";
          ctx.lineWidth = 1 + selectionWeight;
          ctx.shadowColor = "rgba(213,226,146,.4)";
          ctx.shadowBlur = reducedMotion ? 0 : selectionWeight * 12;
          ctx.beginPath(); ctx.roundRect(left - 5, top - 5, barWidth + 10, barHeight * 2 + 14, 5); ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
          [[row.forestPercent, "rgba(145,229,177,.95)"], [row.urbanPercent, "rgba(131,213,245,.95)"]].forEach(([value, color], metric) => {
            const y = top + metric * (barHeight + 4);
            ctx.fillStyle = "rgba(171,204,196,.18)"; ctx.fillRect(left, y, barWidth, barHeight);
            ctx.fillStyle = color; ctx.fillRect(left, y, barWidth * clamp(value / 100, 0, 1), barHeight);
          });
          if (selectionWeight > .5 || isPeer) {
            ctx.font = `400 ${rect.width >= 2400 ? 22 : rect.width < 680 ? 12 : 14}px ${mapHeadingFont}`;
            ctx.textAlign = "center"; ctx.textBaseline = "bottom";
            ctx.strokeStyle = "rgba(3,15,23,.95)"; ctx.lineWidth = 4;
            const name = getCountryNameJa(row);
            ctx.strokeText(name, point.x, top - 10);
            ctx.fillStyle = selectionWeight > .5 ? "rgba(255,239,174,.98)" : "rgba(210,230,222,.92)";
            ctx.fillText(name, point.x, top - 10);
          }
        }
        ctx.restore();
      });
      if (state && now >= mapPlotRevealStartedAt) {
        const namedRows = rows.map(row => ({ ...row, nameJa: getCountryNameJa(row) }));
        ecologiesExhibit?.update({ ...state, rows: namedRows,
          selected: namedRows.find(row => row.iso3 === selected.iso3), playing: ecologiesPlaying,
          culture: cultureRows.map(row => ({ ...row, nameJa: getCultureSiteNameJa(row),
            categoryJa: CULTURE_CATEGORY_NAMES_JA[row.category] || row.category,
            regionJa: CULTURE_REGION_NAMES_JA[row.region] || row.region })) });
      }
    } else if (signalMode.id === "earth-organ") {
      const state = getMapSequenceState(signalMode);
      const rows = state?.rows || [];
      const selected = state?.selected;
      const heatmap = drawRenewableCountryChoropleth(ctx, rect, rows, selected?.iso3, now);
      const selectedIndex = Math.max(0, rows.findIndex((row) => row.iso3 === selected?.iso3));
      const selectedReveal = getMapPlotReveal(selectedIndex, Math.max(1, rows.length), now);
      japanOverlay.dataset.renewableCountryFillCount = String(heatmap.filledCount);
      japanOverlay.dataset.renewableVisibleCountryFillCount = String(heatmap.visibleCount);
      japanOverlay.dataset.renewableFillScale = "country-blue-0-100";
      japanOverlay.dataset.renewableSelectedCountry = selected?.countryJa || selected?.country || "";
      japanOverlay.dataset.renewableSelectedIso3 = selected?.iso3 || "";
      japanOverlay.dataset.renewableCountryCount = String(rows.length);
      japanOverlay.dataset.renewableCountryDisplayMs = String(RENEWABLE_COUNTRY_DISPLAY_MS);
      japanOverlay.dataset.renewableSelectedPercent = Number.isFinite(selected?.renewablePercent)
        ? selected.renewablePercent.toFixed(1)
        : "";
      japanOverlay.dataset.energyConnectionRemoved = "true";
      japanOverlay.dataset.countryGeometryState = naturalEarthCountryState;
      japanOverlay.dataset.renewableSelectedPoiVisible = "false";
      delete japanOverlay.dataset.renewableSelectionLabelPrimary;
      delete japanOverlay.dataset.renewableSelectionLabelSecondary;
      delete japanOverlay.dataset.renewableSelectionLabelDetail;
      delete japanOverlay.dataset.renewableSelectionLabelLines;
      delete japanOverlay.dataset.renewableSelectionLabelBodyWidth;
      let readout = null;
      let energyPanel = null;

      if (selected) {
        const point = pointFor(selected);
        const potential = selected.potential;
        if (visible(point) && selectedReveal.progress > 0) {
          const hasPotential = Number.isFinite(potential?.solarKwhM2Day) && Number.isFinite(potential?.windSpeedMs);
          const solar = hasPotential ? clamp(potential.solarKwhM2Day / 7, 0, 1) : 0;
          const radius = hasPotential ? 18 + solar * 28 : 6;
          const pulse = 1 + Math.sin(now / 520) * 0.08;
          ctx.save();
          applyMapPlotReveal(ctx, point, selectedReveal);
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius * pulse, 0, Math.PI * 2);
          ctx.fillStyle = hasPotential ? "rgba(255,222,86,.12)" : "rgba(220,238,222,.65)";
          ctx.fill();
          ctx.strokeStyle = hasPotential ? "rgba(255,236,126,.98)" : "rgba(230,242,227,.96)";
          ctx.lineWidth = 2.4;
          ctx.stroke();
          if (hasPotential) drawVectorArrow(
            ctx,
            point.x,
            point.y,
            potential.windSpeedMs,
            0.12,
            "rgba(113,255,211,.96)",
            8,
          );
          ctx.restore();
          japanOverlay.dataset.renewableSelectedPoiVisible = "true";
          readout = { point, selected: { ...selected, potential: hasPotential ? potential : null }, radius };
        }
      }
      if (state && now >= mapPlotRevealStartedAt) {
        const panel = drawQuantitativeLegendPanel({
          id: "renewable-electricity",
          title: `再生可能エネルギー発電割合 / ${selected?.countryJa || selected?.country || "国別"}`,
          current: `${selected?.year || "—"}　${selected?.renewablePercent?.toFixed(1) ?? "—"}%`,
          value: selected?.renewablePercent,
          minimum: 0, maximum: 100, minimumLabel: "0%", maximumLabel: "100%",
          colors: ["rgb(14,72,150)", "rgb(30,151,203)", "rgb(46,230,255)"],
        });
        if (panel) {
          energyPanel = panel;
          japanOverlay.dataset.energyPanelScreenLeft = (rect.left + panel.panelX).toFixed(2);
          japanOverlay.dataset.energyPanelScreenTop = (rect.top + panel.panelY).toFixed(2);
          japanOverlay.dataset.energyPanelScreenRight = (rect.left + panel.panelX + panel.panelWidth).toFixed(2);
          japanOverlay.dataset.energyPanelScreenBottom = (rect.top + panel.panelY + panel.panelHeight).toFixed(2);
          japanOverlay.dataset.energyPanelLegendClearance = japanOverlay.dataset.auxiliaryPanelLegendClearance;
        }
      }
      if (readout) drawRenewableObservationLabel(readout.point, readout.selected, readout.radius, energyPanel);
      japanOverlay.dataset.renewableSelectionLabelVisible = japanOverlay.dataset.selectionLabelVisible;
    } else if (signalMode.id === "population-tide") {
      const state = getMapSequenceState(signalMode);
      const rows = state?.yearRows || [];
      const selected = state?.selected;
      const maximumPopulation = Math.max(1, ...rows.map((row) => Number(row.population || 0)));
      const orderedRows = [...rows].sort((leftRow, rightRow) => {
        const leftSelected = leftRow.iso3 === selected?.iso3;
        const rightSelected = rightRow.iso3 === selected?.iso3;
        if (leftSelected !== rightSelected) return Number(leftSelected) - Number(rightSelected);
        return Number(rightRow.population || 0) - Number(leftRow.population || 0);
      });
      japanOverlay.dataset.populationCircleCount = String(rows.length);
      japanOverlay.dataset.populationSelectedYear = String(state?.selectedYear || "");
      japanOverlay.dataset.populationEncoding = "circle-area-proportional-to-population";
      japanOverlay.dataset.populationVisualStyle = "porcelain-celadon";
      japanOverlay.dataset.populationAreaReference = String(POPULATION_AREA_REFERENCE);
      japanOverlay.dataset.populationReferenceRadius = getPopulationRadius(POPULATION_AREA_REFERENCE, rect).toFixed(2);
      japanOverlay.dataset.populationSelectedIso3 = selected?.iso3 || "";
      japanOverlay.dataset.populationSelectedRadius = getPopulationRadius(selected?.population || 0, rect).toFixed(2);
      japanOverlay.dataset.populationMissingCount = String((signalMode.signals.populationCoverage?.countryCount || rows.length) - rows.length);
      japanOverlay.dataset.populationSampleTotal = String(state?.totalPopulation || 0);
      let visiblePopulationCircleCount = 0;
      const populationLabels = [];
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      orderedRows.forEach((row, index) => {
        const point = pointFor(row);
        const radius = getPopulationRadius(row.population, rect);
        if (!visible(point, radius + 12)) return;
        visiblePopulationCircleCount += 1;
        if (row.iso3 === selected?.iso3) {
          japanOverlay.dataset.populationSelectedScreenX = point.x.toFixed(2);
          japanOverlay.dataset.populationSelectedScreenY = point.y.toFixed(2);
        }
        const reveal = getMapPlotReveal(index, orderedRows.length, now);
        if (reveal.progress <= 0) return;
        const selectedRow = row.iso3 === selected?.iso3;
        ctx.save();
        // Reveal opacity never changes the data area. A flat, low-alpha surface
        // keeps dense countries legible without an additive bloom at overlaps.
        ctx.globalAlpha *= reveal.alpha;
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = selectedRow ? POPULATION_MAP_STYLE.selectedFill : POPULATION_MAP_STYLE.fill;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = selectedRow ? POPULATION_MAP_STYLE.selectedRing : POPULATION_MAP_STYLE.ring;
        ctx.lineWidth = selectedRow ? (rect.width >= 2400 ? 1.8 : 1.5) : rect.width >= 2400 ? 1.25 : .85;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(point.x, point.y, selectedRow ? 3.2 : 1.8, 0, Math.PI * 2);
        ctx.fillStyle = selectedRow ? POPULATION_MAP_STYLE.selectedCenter : POPULATION_MAP_STYLE.center;
        ctx.fill();
        if (!selectedRow && rect.width >= 760 && row.population >= maximumPopulation * 0.12) {
          populationLabels.push({ point, radius, text: formatPopulationCompact(row.population), alpha: reveal.alpha });
        }
        if (selectedRow) {
          drawSelectionLabel(point, getCountryNameJa(row),
            `人口　${formatObservationNumber(animatedPopulation(row), 0)} 人`, null,
            { radius, detail: `${row.year}年 · 円の面積が人口に比例` });
        }
        ctx.restore();
      });
      // Draw numeric labels after every circle so neighboring rings cannot
      // strike through them. Keep the rounded number and its unit distinct.
      const numberSize = rect.width >= 2400 ? 22 : 13;
      const unitSize = rect.width >= 2400 ? 14 : 9;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.lineJoin = "round";
      ctx.shadowBlur = 0;
      for (const label of populationLabels) {
        const [, number, unit = ""] = label.text.match(/^([\d.,]+)(.*)$/u) || ["", label.text, ""];
        ctx.font = `400 ${numberSize}px ${mapMetricFont}`;
        const numberWidth = ctx.measureText(number).width;
        ctx.font = `500 ${unitSize}px ${mapUnitFont}`;
        const gap = unit ? (rect.width >= 2400 ? 5 : 3) : 0;
        const totalWidth = numberWidth + gap + ctx.measureText(unit).width;
        const x = label.point.x - totalWidth / 2;
        const y = label.point.y - label.radius * .24 + numberSize * .35;
        ctx.save();
        ctx.globalAlpha *= label.alpha;
        ctx.strokeStyle = "rgba(5,19,26,.82)";
        ctx.lineWidth = rect.width >= 2400 ? 3 : 2;
        ctx.font = `400 ${numberSize}px ${mapMetricFont}`;
        ctx.strokeText(number, x, y);
        ctx.fillStyle = POPULATION_MAP_STYLE.number;
        ctx.fillText(number, x, y);
        if (unit) {
          ctx.font = `500 ${unitSize}px ${mapUnitFont}`;
          ctx.strokeText(unit, x + numberWidth + gap, y);
          ctx.fillStyle = POPULATION_MAP_STYLE.unit;
          ctx.fillText(unit, x + numberWidth + gap, y);
        }
        ctx.restore();
      }
      ctx.restore();
      japanOverlay.dataset.populationVisibleCircleCount = String(visiblePopulationCircleCount);
      drawQuantitativeLegendPanel({
        id: "population",
        title: `人口 / ${rows.length}国・地域 · 全年共通`,
        current: `選択国 ${formatPopulationScaleJa(selected?.population)}`,
        value: Number(selected?.population),
        minimum: 0,
        maximum: POPULATION_AREA_REFERENCE,
        minimumLabel: "0人",
        maximumLabel: formatPopulationScaleJa(POPULATION_AREA_REFERENCE),
        colors: ["rgb(64,101,119)", "rgb(145,188,200)", "rgb(206,238,229)"],
      });
    }

    observationLabels.forEach(drawObservationLabel);

    const revealRows = getModeDataPois()
      .slice(0, 48)
      .map((row) => ({ row, point: pointFor(row) }))
      .filter(({ point }) => visible(point, 36));
    japanOverlay.dataset.plotRevealCount = String(revealRows.length);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    revealRows.forEach(({ point }, index) => {
      const reveal = getMapPlotReveal(index, revealRows.length, now);
      if (reveal.progress <= 0 || reveal.progress >= 1) return;
      const ringProgress = clamp(reveal.progress * 1.18, 0, 1);
      const ringRadius = 4 + ringProgress * 28;
      ctx.beginPath();
      ctx.arc(point.x, point.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(170,255,229,${(1 - ringProgress) * 0.72})`;
      ctx.lineWidth = 1.6 - ringProgress * 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.2 + reveal.scale * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,255,246,${Math.sin(reveal.progress * Math.PI) * 0.76})`;
      ctx.fill();
    });
    ctx.restore();

    ctx.restore();
  };

  const getJapanPoiCoordinates = (poi) => {
    if (poi?.type === "data" || poi?.type === "exhibit") return { lon: poi.record?.lon, lat: poi.record?.lat };
    if (poi?.type === "history" || poi?.type === "earthquake") {
      return { lon: poi.event?.longitude, lat: poi.event?.latitude };
    }
    return { lon: poi?.node?.lon, lat: poi?.node?.lat };
  };

  const getJapanPoiFocusRadius = (poi, rect) => {
    const signalModeId = getActiveSignalMode()?.id;
    if (poi?.type === "data" && signalModeId === "nothing-is-waste") {
      return 16;
    }
    if (poi?.type === "data" && signalModeId === "forest-cloud-engine") {
      return Math.max(24, getForestRainRadius(poi.record?.precipitationMmDay) + 7);
    }
    if (poi?.type === "data" && signalModeId === "anthropocene-scar") {
      const selected = poi.record?.iso3 === anthropoceneSelectedIso3;
      return selected ? 34 : 26;
    }
    if (poi?.type === "data" && signalModeId === "population-tide") {
      return Math.max(12, getPopulationRadius(poi.record?.population || 0, rect) + 7);
    }
    if (poi?.type === "history" || poi?.type === "earthquake") return 22;
    return 25;
  };

  const renderJapanPoiFocus = (ctx, rect, left, top, now, ratio) => {
    if (!hoveredJapanPoi || selectedJapanPoi || japanLayer.classList.contains("is-live-exhibit") || japanLayer.classList.contains("is-firms-exhibit")) {
      return;
    }
    const coordinates = getJapanPoiCoordinates(hoveredJapanPoi);
    if (!Number.isFinite(coordinates.lon) || !Number.isFinite(coordinates.lat)) return;
    const point = japanWorldToScreen(coordinates.lon, coordinates.lat, left, top);
    if (point.x < 0 || point.x > rect.width || point.y < 0 || point.y > rect.height) return;

    const elapsed = Math.max(0, now - hoveredJapanPoiStartedAt);
    const progress = reducedMotion ? 1 : clamp(elapsed / 320, 0, 1);
    const eased = 1 - (1 - progress) ** 3;
    const baseRadius = getJapanPoiFocusRadius(hoveredJapanPoi, rect);
    const sourceRadius = baseRadius + 4;
    const magnification = 1 + eased * 0.16;
    const focusRadius = sourceRadius * magnification;
    const pulse = reducedMotion ? 0.35 : 0.5 + Math.sin(now * 0.0042) * 0.5;

    japanOverlay.dataset.hoveredPoiKey = hoveredJapanPoiKey;
    japanOverlay.dataset.hoveredPoiProgress = progress.toFixed(3);
    japanOverlay.dataset.hoveredPoiScale = magnification.toFixed(3);
    japanOverlay.dataset.hoveredPoiScreenX = point.x.toFixed(2);
    japanOverlay.dataset.hoveredPoiScreenY = point.y.toFixed(2);

    const sourceLeft = (point.x - sourceRadius) * ratio;
    const sourceTop = (point.y - sourceRadius) * ratio;
    const sourceSize = sourceRadius * 2 * ratio;
    if (
      japanPoiFocusContext
      && sourceLeft >= 0
      && sourceTop >= 0
      && sourceLeft + sourceSize <= japanOverlay.width
      && sourceTop + sourceSize <= japanOverlay.height
    ) {
      const focusSize = Math.max(2, Math.ceil(sourceSize));
      if (japanPoiFocusCanvas.width !== focusSize || japanPoiFocusCanvas.height !== focusSize) {
        japanPoiFocusCanvas.width = focusSize;
        japanPoiFocusCanvas.height = focusSize;
      }
      japanPoiFocusContext.setTransform(1, 0, 0, 1, 0, 0);
      japanPoiFocusContext.clearRect(0, 0, focusSize, focusSize);
      japanPoiFocusContext.drawImage(
        japanOverlay,
        sourceLeft,
        sourceTop,
        sourceSize,
        sourceSize,
        0,
        0,
        focusSize,
        focusSize,
      );

      ctx.save();
      ctx.beginPath();
      ctx.arc(point.x, point.y, focusRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.96;
      ctx.drawImage(
        japanPoiFocusCanvas,
        0,
        0,
        focusSize,
        focusSize,
        point.x - focusRadius,
        point.y - focusRadius,
        focusRadius * 2,
        focusRadius * 2,
      );
      const lensLight = ctx.createRadialGradient(
        point.x - focusRadius * 0.28,
        point.y - focusRadius * 0.32,
        0,
        point.x,
        point.y,
        focusRadius,
      );
      lensLight.addColorStop(0, `rgba(222,255,247,${0.12 * eased})`);
      lensLight.addColorStop(0.58, "rgba(118,246,213,0)");
      lensLight.addColorStop(1, `rgba(78,220,194,${0.08 * eased})`);
      ctx.fillStyle = lensLight;
      ctx.fillRect(
        point.x - focusRadius,
        point.y - focusRadius,
        focusRadius * 2,
        focusRadius * 2,
      );
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = "rgba(126,255,224,.72)";
    ctx.shadowBlur = 12 + eased * 12;
    ctx.beginPath();
    ctx.arc(point.x, point.y, focusRadius + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(190,255,238,${0.46 + eased * 0.34})`;
    ctx.lineWidth = 1.2 + eased * 0.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(point.x, point.y, focusRadius + 6 + pulse * 7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(104,244,209,${(0.2 + (1 - pulse) * 0.18) * eased})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  };

  const renderJapanOverlay = (now) => {
    if (!japanIsOpen || !japanContext || japanLayer.classList.contains("is-story-temperature")) {
      return;
    }

    const { rect, left, top } = getJapanViewport();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }

    const ratio = resizeJapanOverlay(rect);
    const ctx = japanContext;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const nodePoints = getActiveMapNodes().map((node) => ({
      ...node,
      ...japanWorldToScreen(node.lon, node.lat, left, top),
    }));

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    renderCachedReferenceWorldModel(ctx, rect, left, top);
    const liveBackdropOnly = japanLayer.classList.contains("is-live-exhibit");
    const estatBackdropOnly = japanLayer.classList.contains("is-estat-exhibit");
    const firmsBackdropOnly = japanLayer.classList.contains("is-firms-exhibit");
    const marineCodBackdropOnly = japanLayer.classList.contains("is-marine-cod-exhibit");
    const foodBackdropOnly = japanLayer.classList.contains("is-food-exhibit");
    const referenceBackdropOnly = liveBackdropOnly || estatBackdropOnly || firmsBackdropOnly || marineCodBackdropOnly || foodBackdropOnly;
    japanOverlay.dataset.liveBackdrop = liveBackdropOnly
      ? "reference-map-only"
      : estatBackdropOnly
        ? "estat-reference-map-only"
        : firmsBackdropOnly
          ? "firms-reference-map-only"
          : marineCodBackdropOnly ? "marine-cod-reference-map-only" : foodBackdropOnly ? "food-reference-map-only" : "standard-mode";
    if (referenceBackdropOnly) {
      globalThis.GaiaMapLegendDrag?.beginFrame();
      globalThis.GaiaMapLegendDrag?.endFrame();
      ctx.restore();
      return;
    }

    if (mapScope === "japan" && isTheme(5)) {
      const plateCenter = { x: rect.width * 0.6, y: rect.height * 0.52 };
      const plateVectors = [
        { label: "CONTINENTAL", x: rect.width * 0.08, y: rect.height * 0.63 },
        { label: "NORTHERN", x: rect.width * 0.58, y: rect.height * 0.08 },
        { label: "PACIFIC", x: rect.width * 0.94, y: rect.height * 0.35 },
        { label: "PHILIPPINE SEA", x: rect.width * 0.76, y: rect.height * 0.92 },
      ];

      ctx.font = '6px Consolas, "Courier New", monospace';
      for (const vector of plateVectors) {
      const directionX = plateCenter.x - vector.x;
      const directionY = plateCenter.y - vector.y;
      const length = Math.max(1, Math.hypot(directionX, directionY));
      const endX = plateCenter.x - (directionX / length) * 34;
      const endY = plateCenter.y - (directionY / length) * 34;
      const angle = Math.atan2(endY - vector.y, endX - vector.x);

      ctx.beginPath();
      ctx.moveTo(vector.x, vector.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = "rgba(124, 239, 209, 0.1)";
      ctx.lineWidth = 0.65;
      ctx.setLineDash([3, 8]);
      ctx.lineDashOffset = -(now / 130);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - Math.cos(angle - 0.48) * 8, endY - Math.sin(angle - 0.48) * 8);
      ctx.lineTo(endX - Math.cos(angle + 0.48) * 8, endY - Math.sin(angle + 0.48) * 8);
      ctx.closePath();
      ctx.fillStyle = "rgba(136, 246, 216, 0.17)";
      ctx.fill();
      ctx.fillStyle = "rgba(196, 244, 232, 0.24)";
        ctx.fillText(vector.label, vector.x + 7, vector.y - 7);
      }
    }

    globalThis.GaiaMapLegendDrag?.beginFrame();
    renderMapInstallationEffect(ctx, rect, nodePoints, now);
    globalThis.GaiaMapLegendDrag?.endFrame();

    if (isTheme(5) && japanDataLayer === "history") {
      renderJapanHistoryReplay(ctx, rect, left, top, now);
      japanHistoryEvents.forEach((event, index) => {
        const point = japanWorldToScreen(event.longitude, event.latitude, left, top);
        if (
          point.x < -34 ||
          point.x > rect.width + 34 ||
          point.y < -34 ||
          point.y > rect.height + 34
        ) {
          return;
        }
        const reveal = getMapPlotReveal(index, japanHistoryEvents.length, now);
        if (reveal.progress <= 0) return;
        ctx.save();
        applyMapPlotReveal(ctx, point, reveal);

        const isSelected = selectedJapanPoi?.type === "history" && selectedJapanPoi.event.id === event.id;
        const phase = reducedMotion ? 0.4 : 0.5 + Math.sin(now * 0.0012 + index * 0.9) * 0.5;
        const maximumIntensity = getMaximumIntensityText(event);
        const radius = maximumIntensity === "7" ? 6.2 : 5;
        const colorCode = maximumIntensity === "7" ? "7" : "C";
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = getIntensityColor(colorCode, isSelected ? 1 : 0.82);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius + 5 + phase * (isSelected ? 8 : 4), 0, Math.PI * 2);
        ctx.strokeStyle = getIntensityColor(colorCode, isSelected ? 0.62 : 0.24);
        ctx.lineWidth = isSelected ? 1.5 : 0.8;
        ctx.stroke();
        ctx.fillStyle = getIntensityColor(colorCode, isSelected ? 1 : 0.72);
        ctx.font = '7px Consolas, "Courier New", monospace';
        ctx.fillText(
          `${String(event.occurredAt).slice(0, 4)} / ${maximumIntensity}`,
          point.x + radius + 6,
          point.y - 6,
        );
        ctx.restore();
      });
    }

    if (!isTheme(0) && !isTheme(8) && !isTheme(9)) nodePoints.forEach((node, index) => {
      if (
        node.x < -40 ||
        node.x > rect.width + 40 ||
        node.y < -40 ||
        node.y > rect.height + 40
      ) {
        return;
      }
      const reveal = getMapPlotReveal(index, nodePoints.length, now);
      if (reveal.progress <= 0) return;
      ctx.save();
      applyMapPlotReveal(ctx, node, reveal);

      const phase = now * 0.0014 + index * 0.83;
      const pulse = 0.5 + Math.sin(phase) * 0.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(174, 255, 230, 0.92)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, 9 + pulse * 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(113, 239, 204, ${0.12 + (1 - pulse) * 0.12})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = "rgba(207, 249, 238, 0.52)";
      ctx.font = '7px Consolas, "Courier New", monospace';
      if (mapScope === "earth" || japanView.zoom >= JAPAN_ZOOM || index % 2 === 0) {
        ctx.fillText(node.name, node.x + 10, node.y - 7);
      }
      ctx.restore();
    });

    const pulseLifetime = reducedMotion ? 6500 : 4200;
    for (let index = japanPulses.length - 1; index >= 0; index -= 1) {
      const pulse = japanPulses[index];
      const age = now - pulse.bornAt;
      if (age > pulseLifetime) {
        japanPulses.splice(index, 1);
        continue;
      }
      if (isTheme(8) || isTheme(9)) continue;

      const progress = clamp(age / pulseLifetime, 0, 1);
      const x = pulse.worldX - left;
      const y = pulse.worldY - top;
      const disturbanceProgress = clamp(progress / 0.24, 0, 1);
      const regenerationProgress = clamp((progress - 0.12) / 0.88, 0, 1);
      const disturbanceRadius = 8 + disturbanceProgress * 46;
      const regenerationRadius =
        10 + regenerationProgress * Math.min(170, rect.width * 0.34);
      const disturbanceAlpha = (1 - disturbanceProgress) * 0.78;
      const regenerationAlpha = (1 - regenerationProgress) * 0.62;

      if (pulse.nodeIndex !== undefined) {
        const node = nodePoints[pulse.nodeIndex];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(node.x, node.y);
        ctx.setLineDash([2, 8]);
        ctx.lineDashOffset = -(now / 80);
        ctx.strokeStyle = `rgba(126, 241, 211, ${regenerationAlpha * 0.42})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (disturbanceAlpha > 0.01) {
        ctx.beginPath();
        ctx.arc(x, y, disturbanceRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(126, 221, 255, ${disturbanceAlpha})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        ctx.arc(
          x,
          y,
          Math.max(2, regenerationRadius - ring * 18),
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = `rgba(135, 255, 219, ${
          regenerationAlpha * (1 - ring * 0.22)
        })`;
        ctx.lineWidth = ring === 0 ? 1.3 : 0.65;
        ctx.stroke();
      }
    }

    if (japanTileErrors === 0) {
      const latestPulse = japanPulses.at(-1);
      if (isTheme(8) || isTheme(9) || !latestPulse) {
        japanMapStatus.textContent = getJapanObservationStatus();
      } else if (now - latestPulse.bornAt < pulseLifetime * 0.24) {
        japanMapStatus.textContent = "QUESTION SENT / CONNECTING TO A LISTENING NODE";
      } else {
        japanMapStatus.textContent = "CO-CREATION SIGNAL / RELATION TRACE ACTIVE";
      }
    }

    renderJapanPoiFocus(ctx, rect, left, top, now, ratio);

    if (!reducedMotion) {
      const scanX = ((now * 0.032) % (rect.width + 240)) - 120;
      const scanGradient = ctx.createLinearGradient(scanX - 60, 0, scanX + 60, 0);
      scanGradient.addColorStop(0, "rgba(112, 239, 205, 0)");
      scanGradient.addColorStop(0.5, "rgba(112, 239, 205, 0.09)");
      scanGradient.addColorStop(1, "rgba(112, 239, 205, 0)");
      ctx.fillStyle = scanGradient;
      ctx.fillRect(scanX - 60, 0, 120, rect.height);
    }
    ctx.restore();
  };

  const syncExclusiveMapExhibit = () => {
    if (japanIsOpen) {
      clearJapanPoiHover();
      closeJapanPoi();
      restartMapPlotReveal("exhibit-change");
    }
    renderJapanOverlay(performance.now());
  };
  [
    "gaia:live-exhibit-change",
    "gaia:estat-exhibit-change",
    "gaia:firms-exhibit-change",
    "gaia:planet-signals-change",
    "gaia:marine-cod-change",
    "gaia:food-change",
  ].forEach((eventName) => window.addEventListener(eventName, syncExclusiveMapExhibit));
  window.addEventListener("gaia:signals-ready", () => {
    if (japanIsOpen) restartMapPlotReveal("data-ready");
  });

  const addJapanPulse = (clientX, clientY) => {
    const { rect, left, top } = getJapanViewport();
    const worldX = left + clientX - rect.left;
    const worldY = top + clientY - rect.top;
    let nearestNodeIndex = 0;
    let nearestNodeDistance = Number.POSITIVE_INFINITY;

    getActiveMapNodes().forEach((node, index) => {
      const nodeWorld = lonLatToWorld(node.lon, node.lat);
      const distance = Math.hypot(worldX - nodeWorld.x, worldY - nodeWorld.y);
      if (distance < nearestNodeDistance) {
        nearestNodeDistance = distance;
        nearestNodeIndex = index;
      }
    });

    japanPulses.push({
      worldX,
      worldY,
      nodeIndex: nearestNodeIndex,
      bornAt: performance.now(),
    });
    if (japanPulses.length > 18) {
      japanPulses.shift();
    }
  };

  const japanCoordinateIsVisible = (longitude, latitude) =>
    longitude >= JAPAN_DATA_BOUNDS.west &&
    longitude <= JAPAN_DATA_BOUNDS.east &&
    latitude >= JAPAN_DATA_BOUNDS.south &&
    latitude <= JAPAN_DATA_BOUNDS.north;

  const getVisibleEarthquakes = () => {
    if (mapScope === "earth") {
      return japanEarthquakes.slice(0, 320);
    }
    return japanEarthquakes
      .filter((event) => japanCoordinateIsVisible(event.longitude, event.latitude))
      .slice(0, 40);
  };

  const normalizeJapanEarthquake = (event) => {
    if (event.geometry?.coordinates && event.properties) {
      const [longitude, latitude, depthKm] = event.geometry.coordinates;
      return {
        id: event.id,
        time: new Date(event.properties.time).toISOString(),
        magnitude: Number(event.properties.mag),
        place: event.properties.place || "Japan region",
        longitude: Number(longitude),
        latitude: Number(latitude),
        depthKm: Number(depthKm),
      };
    }

    return {
      id: event.id,
      time: event.time,
      magnitude: Number(event.magnitude),
      place: event.place || "Japan region",
      longitude: Number(event.longitude),
      latitude: Number(event.latitude),
      depthKm: Number(event.depthKm),
    };
  };

  const getJapanObservationStatus = () => {
    if (japanTileErrors > 0) {
      return "MAP TILE OFFLINE / VECTOR EARTH MODEL ACTIVE";
    }
    if (!isTheme(5)) {
      const readout = getSignalReadout(getActiveSignalMode());
      return `${modes[modeToIndex].title.toUpperCase()} / ${readout.value}`;
    }
    if (japanDataLayer === "history") {
      if (japanHistoryDataState === "loading") {
        return "気象庁地震史 / 観測震度を読み込み中";
      }
      if (japanHistoryDataState === "ready") {
        const observationCount = japanHistoryEvents.reduce(
          (total, event) => total + event.observations.length,
          0,
        );
        if (selectedJapanPoi?.type === "history") {
          const siteCount = selectedJapanPoi.event.observations.length;
          if (reducedMotion) {
            return `気象庁観測震度 / ${siteCount}地点 / 静止表示`;
          }
          const elapsedSeconds = japanWaveReplay
            ? Math.max(0, performance.now() - japanWaveReplay.bornAt) / 1000
            : 0;
          return `発生後${Math.floor(elapsedSeconds)}秒 / P波 7.0 km/s / S波 4.0 km/s / 到達 ${
            japanWaveReplay?.arrivedCount || 0
          }/${siteCount}地点`;
        }
        return `気象庁地震史 / ${japanHistoryEvents.length}件 / 震度6〜7の観測 ${observationCount}地点`;
      }
      if (japanHistoryDataState === "offline") {
        return "気象庁地震史はオフライン / 演出用地点は表示可能";
      }
      return "気象庁地震史 / 待機中";
    }
    const annualState = getMapSequenceState(getActiveSignalMode());
    return annualState
      ? `USGS ${annualState.selectedYear}年 / ${annualState.yearEvents.length}件 / 最大 M${annualState.selected.magnitude.toFixed(1)} / 世界表示`
      : "USGS年別 M7.5以上 / 読み込み中";
  };

  const formatJapanDataTime = (value) => {
    if (!value) {
      return "UPDATED —";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "UPDATED —";
    }
    return `UPDATED ${new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
      timeZoneName: "short",
    }).format(date)}`;
  };

  const formatJapanDataTimestamp = (value) =>
    value ? formatJapanDataTime(value).replace("UPDATED ", "") : "—";

  const updateJapanDataInterface = () => {
    const observationCount = japanHistoryEvents.reduce(
      (total, event) => total + event.observations.length,
      0,
    );
    const historyTimestamp = formatJapanDataTimestamp(japanHistoryUpdatedAt);
    const earthquakeTimestamp = formatJapanDataTimestamp(japanDataUpdatedAt);

    if (japanHistoryDataState === "loading") {
      japanHistoryState.textContent = "過去の震度：気象庁データを読み込み中";
    } else if (japanHistoryDataState === "ready") {
      japanHistoryState.textContent = `過去の震度：読み込み済み（代表${japanHistoryEvents.length}地震・${observationCount}地点）`;
    } else if (japanHistoryDataState === "offline") {
      japanHistoryState.textContent = "過去の震度：読み込めませんでした";
    } else {
      japanHistoryState.textContent = "過去の震度：地図を開くと読み込みます";
    }
    japanHistoryUpdated.textContent = japanHistoryUpdatedAt
      ? `保存データ作成日：${historyTimestamp}`
      : "保存データ作成日：—";
    dataLedger.updateJma({
      state: japanHistoryDataState,
      eventCount: japanHistoryEvents.length,
      observationCount,
      retrievedAt: historyTimestamp,
    });

    if (japanEarthquakeDataState === "loading") {
      japanDataState.textContent = "世界の震源：作品内データを読み込み中";
    } else if (japanEarthquakeDataState === "snapshot") {
      japanDataState.textContent = `世界の震源：保存データを表示中（M7.5以上・${japanEarthquakes.length}件）`;
    } else if (japanEarthquakeDataState === "offline") {
      japanDataState.textContent = "世界の震源：作品内データを読み込めませんでした";
    } else {
      japanDataState.textContent = "世界の震源：地図を開くと作品内データを読み込みます";
    }
    japanDataUpdated.textContent = japanDataUpdatedAt
      ? `保存データ作成日：${earthquakeTimestamp}`
      : "保存データ作成日：—";
    dataLedger.updateUsgs({
      state: japanEarthquakeDataState,
      scope: mapScope,
      totalCount: japanEarthquakes.length,
      visibleCount: getVisibleEarthquakes().length,
      retrievedAt: earthquakeTimestamp,
    });
  };

  const MAP_GUIDE_SCRAMBLE_ALPHABET = Array.from(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/:.-+◇○△□惑星地球観測光風海森",
  );
  let mapGuideScrambleGeneration = 0;
  let mapGuideAnimationTimer = 0;

  const revealMapGuideText = (target, finalText, duration, delay, generation) => {
    const characters = Array.from(finalText);
    const startedAt = performance.now() + delay;
    const draw = (now) => {
      if (generation !== mapGuideScrambleGeneration) return;
      if (now < startedAt) {
        requestAnimationFrame(draw);
        return;
      }
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const settledCount = Math.floor(characters.length * eased);
      target.textContent = characters.map((character, index) => {
        if (index < settledCount || /[\s、。・「」『』（）()／/:：—–!?！？]/u.test(character)) {
          return character;
        }
        return MAP_GUIDE_SCRAMBLE_ALPHABET[
          Math.floor(Math.random() * MAP_GUIDE_SCRAMBLE_ALPHABET.length)
        ];
      }).join("");
      if (progress < 1) requestAnimationFrame(draw);
      else target.textContent = finalText;
    };
    requestAnimationFrame(draw);
  };

  const animateMapReadingGuide = (guide) => {
    if (!guide || !mapReadingGuide) return;
    const texts = [
      [mapGuideTitle, guide.title || modes[modeToIndex].titleJa, 420, 40],
      [mapGuideSubject, guide.subject, 560, 90],
      [mapGuideReading, guide.reading, 620, 130],
      [mapGuideAction, guide.action, 680, 170],
    ];
    mapGuideScrambleGeneration += 1;
    const generation = mapGuideScrambleGeneration;
    window.clearTimeout(mapGuideAnimationTimer);
    mapReadingGuide.classList.remove("is-mode-entering");
    if (reducedMotion) {
      texts.forEach(([target, finalText]) => { target.textContent = finalText; });
      mapReadingGuideBody?.setAttribute("aria-busy", "false");
      return;
    }
    void mapReadingGuide.offsetWidth;
    mapReadingGuide.classList.add("is-mode-entering");
    mapReadingGuideBody?.setAttribute("aria-busy", "true");
    texts.forEach(([target, finalText, duration, delay]) => {
      revealMapGuideText(target, finalText, duration, delay, generation);
    });
    mapGuideAnimationTimer = window.setTimeout(() => {
      if (generation !== mapGuideScrambleGeneration) return;
      texts.forEach(([target, finalText]) => { target.textContent = finalText; });
      mapReadingGuide.classList.remove("is-mode-entering");
      mapReadingGuideBody?.setAttribute("aria-busy", "false");
      mapGuideAnimationTimer = 0;
    }, 900);
  };

  let mapTitleTransitionTimer = 0;
  let mapEntryGuidePending = true;
  let pendingMapTitle = null;
  let mapTitleTransitionEnd = null;
  const getMapTitleSubtitle = number => MAP_TITLE_SUBTITLES[number]
    || globalThis.GaiaMarineCod?.definitions?.find(item => item.number === number)?.subtitle
    || globalThis.GaiaFoodExhibits?.definitions?.find(item => item.number === number)?.subtitle || "";
  let mapTitleTransitionTitle = `${japanTitle.dataset.exhibitNumber}　${japanTitle.textContent}`;
  const cancelMapTitleTransition = () => {
    window.clearTimeout(mapTitleTransitionTimer);
    mapTitleTransitionTimer = 0;
    if (mapTitleTransitionEnd) mapTitleTransition.removeEventListener("animationend", mapTitleTransitionEnd);
    mapTitleTransitionEnd = null;
    mapPlotRevealBlockedUntil = 0;
    japanLayer.classList.remove("is-map-title-transitioning");
    if (japanOverlay.dataset.titleSeparatorState === "running") {
      japanOverlay.dataset.titleSeparatorState = "cancelled";
    }
  };

  const animateMapTitleTransition = (title) => {
    if (!mapTitleTransition || !mapTitleTransitionText || !japanIsOpen) return;
    if (mapEntryGuidePending || window.GaiaModeEntryGuide?.getState?.().id === "map") {
      pendingMapTitle = title;
      return;
    }
    if (mapTitleTransitionTitle === title) return;
    mapTitleTransitionTitle = title;
    cancelMapTitleTransition();
    const separatorStartedAt = performance.now();
    const separatorDuration = reducedMotion
      ? MAP_TITLE_SEPARATOR_REDUCED_DURATION_MS
      : MAP_TITLE_SEPARATOR_DURATION_MS;
    mapPlotRevealBlockedUntil = separatorStartedAt + separatorDuration;
    // Keep the numbered identity for transition deduplication, but the
    // separator itself presents only the exhibit name.
    mapTitleTransitionText.textContent = japanTitle.textContent;
    if (mapTitleTransitionSubtitle) {
      mapTitleTransitionSubtitle.textContent = getMapTitleSubtitle(japanTitle.dataset.exhibitNumber);
    }
    // Keep the CSS stages and the plot-reveal gate on the same clock.
    mapTitleTransition.style.setProperty("--map-title-duration", `${separatorDuration}ms`);
    void mapTitleTransition.offsetWidth;
    japanLayer.classList.add("is-map-title-transitioning");
    japanOverlay.dataset.titleSeparatorState = "running";
    japanOverlay.dataset.titleSeparatorStartedAt = separatorStartedAt.toFixed(1);
    japanOverlay.dataset.titleSeparatorEndsAt = mapPlotRevealBlockedUntil.toFixed(1);
    const finish = () => {
      window.clearTimeout(mapTitleTransitionTimer);
      mapTitleTransitionTimer = 0;
      mapTitleTransition.removeEventListener("animationend", mapTitleTransitionEnd);
      mapTitleTransitionEnd = null;
      mapPlotRevealBlockedUntil = 0;
      // CSS starts on the next rendered frame. Reveal plots only after its
      // afterglow actually finishes, not at the earlier scheduled timer edge.
      mapPlotRevealStartedAt = Math.max(mapPlotRevealStartedAt, performance.now());
      japanLayer.classList.remove("is-map-title-transitioning");
      japanOverlay.dataset.titleSeparatorState = "complete";
      japanOverlay.dataset.titleSeparatorCompletedAt = performance.now().toFixed(1);
    };
    mapTitleTransitionEnd = event => {
      if (event.target !== mapTitleTransition || event.pseudoElement) return;
      if (event.animationName !== (reducedMotion ? "map-title-separator-still" : "map-title-separator-crossfade")) return;
      finish();
    };
    mapTitleTransition.addEventListener("animationend", mapTitleTransitionEnd);
    // Cleanup remains bounded if animations are disabled or the tab is hidden.
    mapTitleTransitionTimer = window.setTimeout(finish, separatorDuration + 250);
  };

  // Extension exhibits own their headings without entering updateModeInterface.
  // Observe the settled heading so every exhibition shares the same separator.
  // Repeated source/POI updates and intermediate heading restores do not replay it.
  const mapTitleObserver = new MutationObserver(() => {
    if (japanTitle.getAttribute("aria-label") !== japanTitle.textContent) japanTitle.setAttribute("aria-label", japanTitle.textContent);
    const title = `${japanTitle.dataset.exhibitNumber}　${japanTitle.textContent}`;
    // The persistent header and chapter separator share the same reason to look.
    // Extension providers keep their measurements and source notes in the readout.
    const subtitle = getMapTitleSubtitle(japanTitle.dataset.exhibitNumber);
    if (subtitle) japanDescription.textContent = subtitle;
    if (!japanIsOpen) {
      mapTitleTransitionTitle = title;
      return;
    }
    animateMapTitleTransition(title);
  });
  mapTitleObserver.observe(japanTitle, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-exhibit-number"],
  });

  const updateMapObservationNarrative = () => {
    const signalMode = getActiveSignalMode();
    const guide = MAP_READING_GUIDES[getThemeIndex()];
    if (guide) animateMapReadingGuide(guide);
    if (!isTheme(5)) {
      if (signalMode?.id === "breathing-earth") {
        japanObservationKicker.textContent = "CO₂の推移 / 1958年 → 2050年 / 20秒ループ";
        japanObservationCopy.textContent =
          "色はCO₂濃度です。斜線のマスは近くの8地点から計算しました。2026年以降は、最近10年と同じ増え方が続いた場合の試算です。マスを押すと詳しい数字が出ます。";
      } else if (signalMode?.id === "blue-circulation") {
        japanObservationKicker.textContent = "海流の速さを0〜14日まで延長 / 45秒ループ";
        japanObservationCopy.textContent =
          "色付きの矢印が海流です。点から伸びる線は、その流れが変わらないと仮定した移動距離です。白い矢印は比較用の風で、距離計算には使いません。色付きの点を押すと詳しい数字が出ます。";
      } else if (signalMode) {
        const narratives = {
          "forest-cloud-engine": ["森林 × 雨 / 世界の参照地点", "緑は森林域、水色円は世界の国・地域に置いた参照地点の平均降水量です。直径が大きいほど雨が多く、国平均ではありません。円のない場所を雨量ゼロとは扱いません。"],
          "pollination-protocol": ["観察点と生息分布は異なります / 三つの読み方", "①黄色はGBIF観察点、②各国最大2件の標本制約、③場所のないGloBI花関係を非地理ネットワークで示します。点の空白はミツバチの不在ではありません。"],
          "nothing-is-waste": ["再資源化率 / 国・地域別", "国土の青が明るいほど再資源化率が高く、0〜100%の同じ色尺度で比較します。国土を押すか、左右ボタンとスライダーで公表値のある国・地域を切り替えます。無着色は未収録で、0%とは異なります。報告年は国ごとに異なります。"],
          "anthropocene-scar": ["1945—2023年 化石燃料由来CO₂ × 2016年固定夜間光", "国土の濃紺→紫→赤→橙→淡黄は、選択年の国別化石燃料由来CO₂です。1945〜2023年で共通の固定対数尺度を使います。白い発光はNASA VIIRS 2016を固定した比較用レイヤーです。"],
          "three-ecologies": ["都市人口率が高い国は、森が少ない？", "緑は陸地の森林率、青は人口の都市居住率。都市人口率が近い二国、収録国・地域の散布図、文化・記憶を切り替えて比較します。欠測を除外し基準年も異なるため、因果関係の結論ではありません。"],
          "earth-organ": ["再生可能エネルギー発電割合 / 世界の国・地域", "国土の青が明るいほど、総発電量に占める再生可能エネルギーの割合が高い国です。公表値のある国・地域を、高い国から低い国へ移動します。年は国ごとに異なります。日射・風は31代表地点のみの補足で、未収録値は補いません。"],
          "population-tide": ["1960—2025年 人口 / 世界の国・地域", "淡青の円は選択年の人口です。217の国・地域を対象に、円の面積が人口に比例する全年共通尺度で比較します。欠測年は非表示。点は代表位置で、都市の位置や人口密度ではありません。"],
        };
        const [kicker, copy] = narratives[signalMode.id] || [
          `ACT ${signalMode.act.number} / ${signalMode.act.en}`,
          signalMode.question,
        ];
        japanObservationKicker.textContent = kicker;
        japanObservationCopy.textContent = copy;
      }
      return;
    }
    if (japanDataLayer === "history") {
      japanObservationKicker.textContent = "気象庁地震史 / 最大震度6弱以上";
      japanObservationCopy.textContent =
        "日本の代表6地震と、震度6弱以上を記録した地点を表示します。地震を選ぶと、P波とS波が届く目安を再生します。";
    } else {
      japanObservationKicker.textContent = "USGS YEARLY WAVES / M7.5+ / 2000–2026";
      japanObservationCopy.textContent =
        "年度ごとに世界のM7.5以上だけを表示します。輪は全震源からゆっくり広がり、Magnitudeから見積もった可感半径の目安で止まります。実際の震度・被害・津波範囲ではありません。";
    }
  };

  const setJapanDataLayer = (layer) => {
    const previousLayer = japanDataLayer;
    japanDataLayer = layer === "snapshot" ? "snapshot" : "history";
    japanHistoryLayerButton.setAttribute(
      "aria-pressed",
      japanDataLayer === "history" ? "true" : "false",
    );
    japanLiveLayerButton.setAttribute(
      "aria-pressed",
      japanDataLayer === "snapshot" ? "true" : "false",
    );
    closeJapanPoi();
    updateMapObservationNarrative();
    japanMapStatus.textContent = getJapanObservationStatus();
    if (japanIsOpen && previousLayer !== japanDataLayer) restartMapPlotReveal("layer-change");
    if (japanIsOpen && isTheme(5)) {
      void (japanDataLayer === "history" ? loadJapanHistory() : loadJapanEarthquakes());
    }
  };

  const setMapScope = (_scope = "earth", { resetLayer = true } = {}) => {
    mapScope = "earth";
    japanLayer.dataset.mapScope = mapScope;
    mapScopeKicker.textContent = "Planetary lens / Open map";
    const mapHeadingNumber = formatMapModeNumber(mapModeIndex);
    const mapHeadingTitle = modes[modeToIndex]?.titleJa || "積み重なるCO₂";
    japanTitle.dataset.exhibitNumber = mapHeadingNumber;
    japanTitle.textContent = mapHeadingTitle;
    japanTitle.setAttribute("aria-label", `${mapHeadingNumber} ${mapHeadingTitle}`);
    japanDescription.textContent = getMapTitleSubtitle(mapHeadingNumber) || "暮らしと地球のつながりを、記録から確かめます。";
    updateMapBasisNote();
    japanMap.setAttribute(
      "aria-label",
      "世界の観測地図。ドラッグで移動、ホイールまたはピンチで拡大縮小し、地点を押すとデータの解説を読めます",
    );
    historyLayerLabel.textContent = "日本の震度6弱+";
    liveLayerLabel.textContent = "世界 M7.5+";
    closeJapanPoi();
    japanPulses.length = 0;
    resetJapanView();
    if (resetLayer) {
      setJapanDataLayer("snapshot");
    } else {
      setJapanDataLayer(japanDataLayer);
    }
    updateJapanDataInterface();
    updateSignalInterface();
  };

  const formatJapanEventTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value).replace("T", " ").replace("+09:00", " JST");
    }
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
      timeZoneName: "short",
    }).format(date);
  };

  const getJapanPoiKey = (poi) => {
    if (poi?.type === "exhibit") return `exhibit:${poi.record.exhibitId}:${poi.record.id}`;
    if (poi?.type === "data") {
      const recordKey = poi.record?.id
        || poi.record?.iso3
        || poi.record?.key
        || poi.record?.name
        || poi.record?.country
        || `${poi.record?.lon}:${poi.record?.lat}`;
      return `data:${getActiveSignalMode()?.id || modeToIndex}:${recordKey}:${poi.index}`;
    }
    if (poi?.type === "history") return `history:${poi.event?.id || poi.index}`;
    if (poi?.type === "earthquake") return `earthquake:${poi.event?.id || poi.index}`;
    return `node:${poi?.node?.id || poi?.node?.name || poi?.index}`;
  };

  const getJapanPoiPreviewContent = (poi) => {
    if (poi.type === "exhibit") {
      return { kicker: poi.record.kicker, title: poi.record.title, originalSourceName: poi.record.originalSourceName, meta: poi.record.preview, readings: poi.record.previewReadings };
    }
    if (poi.type === "data") {
      const record = poi.record || {};
      return {
        kicker: `${formatMapModeNumber(modeToIndex)} / ${modes[modeToIndex].titleJa}`,
        title: record.nameJa
          || record.countryJa
          || (record.iso2 || record.countryCode ? getCountryNameJa(record) : "")
          || record.name
          || record.country
          || record.place
          || record.species
          || record.iso3
          || "観測データ",
        meta: record.meta || "この地点の観測値と出典を表示します。",
        readings: record.previewReadings,
      };
    }
    if (poi.type === "history") {
      const event = poi.event;
      return {
        kicker: "気象庁 / 過去の地震",
        title: getJmaEventTitle(event),
        meta: `${String(event.occurredAt).slice(0, 4)} / M${event.magnitude.toFixed(1)} / 最大震度 ${getMaximumIntensityText(event)}`,
        readings: { context: `${String(event.occurredAt).slice(0, 4)} / 最大震度 ${getMaximumIntensityText(event)}`, readings: [{ label: '規模', value: event.magnitude.toFixed(1), unit: 'M', prefix: true }] },
      };
    }
    if (poi.type === "earthquake") {
      const event = poi.event;
      return {
        kicker: "USGS / 世界の地震",
        title: `震源 ${formatCoordinateJa(event.latitude, event.longitude)}`,
        meta: `M${event.magnitude.toFixed(1)} / 深さ ${Math.round(event.depthKm)} km / ${formatJapanEventTime(event.time)}`,
        readings: { context: formatJapanEventTime(event.time), readings: [{ label: '規模', value: event.magnitude.toFixed(1), unit: 'M', prefix: true }, { label: '深さ', value: String(Math.round(event.depthKm)), unit: 'km' }] },
      };
    }
    const node = poi.node;
    return {
      kicker: "地図 / 観測地点",
      title: node.nameJa || node.name,
      meta: `${node.nameJa || node.name || "観測地点"} / ${formatCoordinateJa(node.lat, node.lon)}`,
    };
  };

  const positionJapanPoiPreview = (clientX, clientY) => {
    const layerRect = japanLayer.getBoundingClientRect();
    const width = Math.min(japanPoiPreview.offsetWidth || 330, layerRect.width - 36);
    const height = Math.min(japanPoiPreview.offsetHeight || 150, layerRect.height - 36);
    const localX = clientX - layerRect.left;
    const localY = clientY - layerRect.top;
    const left = clamp(
      localX + width + 28 > layerRect.width ? localX - width - 24 : localX + 24,
      18,
      layerRect.width - width - 18,
    );
    const top = clamp(
      localY - height - 20 >= 18 ? localY - height - 20 : localY + 24,
      18,
      layerRect.height - height - 18,
    );
    japanPoiPreview.style.left = `${left}px`;
    japanPoiPreview.style.top = `${top}px`;
  };

  const clearJapanPoiHover = () => {
    hoveredJapanPoi = null;
    hoveredJapanPoiKey = "";
    hoveredJapanPoiContent = "";
    hoveredJapanPoiStartedAt = 0;
    japanMap.classList.remove("has-poi-hover");
    japanPoiPreview.classList.remove("is-visible");
    japanPoiPreview.setAttribute("aria-hidden", "true");
    delete japanOverlay.dataset.hoveredPoiKey;
    delete japanOverlay.dataset.hoveredPoiProgress;
    delete japanOverlay.dataset.hoveredPoiScale;
    delete japanOverlay.dataset.hoveredPoiScreenX;
    delete japanOverlay.dataset.hoveredPoiScreenY;
  };

  const showJapanPoiPreview = (poi, clientX, clientY) => {
    const key = getJapanPoiKey(poi);
    const changed = key !== hoveredJapanPoiKey;
    hoveredJapanPoi = poi;
    const content = getJapanPoiPreviewContent(poi);
    const signature = JSON.stringify(content);
    if (signature !== hoveredJapanPoiContent) {
      hoveredJapanPoiContent = signature;
      japanPoiPreviewKicker.textContent = content.kicker;
      renderPoiPreviewTitle(japanPoiPreviewTitle, content.title, content.originalSourceName);
      renderPoiPreviewReadings(japanPoiPreviewMeta, content.readings, content.meta);
    }
    if (changed) {
      hoveredJapanPoiKey = key;
      hoveredJapanPoiStartedAt = performance.now();
      japanPoiPreview.classList.remove("is-visible");
      void japanPoiPreview.offsetWidth;
    }
    positionJapanPoiPreview(clientX, clientY);
    japanMap.classList.add("has-poi-hover");
    japanPoiPreview.setAttribute("aria-hidden", "false");
    japanPoiPreview.classList.add("is-visible");
  };

  const updateJapanPoiHover = (event) => {
    if (
      !supportsHover
      || event.pointerType === "touch"
      || event.pointerType === "pen"
      || selectedJapanPoi
      || japanView.dragged
      || japanLayer.classList.contains("is-live-exhibit")
      || japanLayer.classList.contains("is-estat-exhibit")
    ) {
      clearJapanPoiHover();
      return;
    }
    const poi = findJapanPoiAt(event.clientX, event.clientY, event.pointerType, {
      allowGridFallback: false,
    });
    if (!poi) {
      clearJapanPoiHover();
      return;
    }
    showJapanPoiPreview(poi, event.clientX, event.clientY);
  };

  const resetJapanPoiHistory = () => {
    japanPoiHistoryRequest += 1;
    japanPoiHistory.hidden = true;
    japanPoiHistory.replaceChildren();
    japanPoiHistory.removeAttribute("aria-busy");
    delete japanPoiHistory.dataset.state;
    delete japanPoiHistory.dataset.country;
    japanPoiCard.classList.remove("has-country-history");
    japanPoiCard.style.removeProperty("max-height");
  };

  const loadJapanPoiHistory = (poi, signalMode, clientX, clientY) => {
    const request = ++japanPoiHistoryRequest;
    japanPoiCard.classList.add("has-country-history");
    japanPoiHistory.hidden = false;
    japanPoiHistory.dataset.state = "loading";
    japanPoiHistory.dataset.country = poi.record.iso3;
    japanPoiHistory.setAttribute("aria-busy", "true");
    const status = document.createElement("p");
    status.className = "country-emissions-status";
    status.textContent = "年ごとの排出量を読み込んでいます…";
    japanPoiHistory.replaceChildren(status);
    const isCurrent = () => request === japanPoiHistoryRequest
      && selectedJapanPoi === poi && japanIsOpen;
    // Paint the country and selected-year value first. The chart module is
    // fetched only on demand; the annual records reuse the loaded snapshot.
    requestAnimationFrame(() => window.setTimeout(async () => {
      if (!isCurrent()) return;
      try {
        const { renderCountryEmissionsHistory } = await import("./src/exploration/country-emissions-history.js?v=gaia-render-refactor-1");
        if (!isCurrent()) return;
        renderCountryEmissionsHistory(japanPoiHistory, {
          rows: signalMode.signals.emissions,
          iso3: poi.record.iso3,
          country: getCountryNameJa(poi.record),
          selectedYear: Number(poi.record.year),
        });
      } catch {
        if (!isCurrent()) return;
        status.textContent = "経年グラフを読み込めませんでした。下のリンクから元データを確認できます。";
        japanPoiHistory.replaceChildren(status);
        japanPoiHistory.dataset.state = "error";
      } finally {
        if (isCurrent()) {
          japanPoiHistory.setAttribute("aria-busy", "false");
          positionJapanPoiCard(clientX, clientY);
        }
      }
    }, 0));
  };

  const closeJapanPoi = ({ restoreFocus = false } = {}) => {
    resetJapanPoiHistory();
    window.clearTimeout(japanPoiRevealTimer);
    japanPoiRevealTimer = 0;
    if (!selectedJapanPoi) {
      japanPoiCard.hidden = true;
      japanPoiCard.setAttribute("aria-hidden", "true");
      japanLayer.classList.remove("japan-poi-open");
      return;
    }
    selectedJapanPoi = null;
    japanWaveReplay = null;
    if (co2TimelineHeld && !mapTimelineManuallyPaused) {
      co2TimelineHeld = false;
      if (getActiveSignalMode()?.id === "rhythm-of-disaster") {
        resumeTimelineAfterManualSeek();
      } else {
        co2TimelineStartedAt =
          performance.now() - (signalTimePosition / 100) * getActiveTimelineDuration();
      }
      updateSignalInterface();
    }
    japanPoiCard.hidden = true;
    japanPoiCard.setAttribute("aria-hidden", "true");
    japanLayer.classList.remove("japan-poi-open");
    if (restoreFocus) {
      japanMap.focus({ preventScroll: true });
    }
  };

  const positionJapanPoiCard = (clientX, clientY) => {
    const layerRect = japanLayer.getBoundingClientRect();
    const countryHistory = japanPoiCard.classList.contains("has-country-history");
    const mobileCard = window.innerWidth <= 720 || (countryHistory && window.innerWidth <= 900);
    if (countryHistory) {
      // The mobile map may be shorter than the viewport. Bound the chart to
      // its actual layer, leaving the top toolbar and bottom controls free.
      const reservedHeight = mobileCard ? 180 : 40;
      japanPoiCard.style.maxHeight = `${Math.max(140, layerRect.height - reservedHeight)}px`;
    }
    if (mobileCard) {
      japanPoiCard.style.removeProperty("left");
      japanPoiCard.style.removeProperty("top");
      return;
    }
    const cardWidth = Math.min(japanPoiCard.offsetWidth || 480, layerRect.width - 40);
    const cardHeight = Math.min(japanPoiCard.offsetHeight || 330, layerRect.height - 40);
    const localX = clientX - layerRect.left;
    const localY = clientY - layerRect.top;
    const left = clamp(
      localX + 22 + cardWidth > layerRect.width ? localX - cardWidth - 22 : localX + 22,
      20,
      layerRect.width - cardWidth - 20,
    );
    const commandDock = japanLayer.querySelector(".map-command-dock");
    const dockTop = commandDock?.getClientRects().length ? commandDock.getBoundingClientRect().top - layerRect.top : layerRect.height;
    const bottomEdge = Math.min(layerRect.height - 20, dockTop - 12);
    const top = clamp(localY - 70, 20, Math.max(20, bottomEdge - cardHeight));
    japanPoiCard.style.left = `${left}px`;
    japanPoiCard.style.top = `${top}px`;
  };

  const showJapanPoiCard = (clientX, clientY, { focusClose = true } = {}) => {
    // Keep source values accessible while giving structured observations a
    // compact hierarchy instead of treating every provenance token as a cell.
    const separator = () => {
      const el = document.createElement("span");
      el.className = "japan-poi-separator"; el.textContent = " / "; return el;
    };
    const title = japanPoiType.textContent.split(/\s+\/\s+/u);
    if (title.length > 1) {
      const category = document.createElement("span"); category.className = "japan-poi-category";
      category.textContent = title.pop();
      const name = document.createElement("span"); name.className = "japan-poi-name"; name.textContent = title.join(" / ");
      japanPoiType.replaceChildren(name, separator(), category);
    }
    const details = selectedJapanPoi?.type === "exhibit" ? selectedJapanPoi.record.cardDetails : null;
    japanPoiCard.classList.toggle("has-observation-summary", Boolean(details));
    if (details) {
      const span = (className, text) => {
        const el = document.createElement("span");
        el.className = className;
        if (text) el.textContent = text;
        return el;
      };
      const location = span("japan-poi-location");
      if (details.location) location.append(span("japan-poi-place", details.location), separator());
      location.append(span("japan-poi-coordinates", details.coordinates));
      const metrics = span("japan-poi-metrics");
      details.metrics.forEach(([label, value], index) => {
        const fact = span("japan-poi-fact");
        const number = document.createElement("strong");
        number.textContent = value;
        fact.append(span("japan-poi-metric-label", `${label} `), number);
        if (index) metrics.append(separator());
        metrics.append(fact);
      });
      const note = span("japan-poi-observation-note");
      note.append(span("japan-poi-observed-time", details.time), separator(), span("japan-poi-data-state", details.state));
      const provenance = span("japan-poi-provenance", details.source);
      if (details.model) provenance.append(document.createTextNode(` / ${details.model}`));
      japanPoiMeta.replaceChildren(location, separator(), metrics, separator(), note, separator(), provenance);
    } else {
      const facts = japanPoiMeta.textContent.split(/\s+\/\s+/u);
      japanPoiMeta.replaceChildren(...facts.flatMap((fact, index) => {
        const el = document.createElement("span");
        el.className = "japan-poi-fact";
        el.classList.toggle("is-time", /^\d{4}[./-]/u.test(fact));
        el.classList.toggle("is-wide", fact.length > 27);
        el.textContent = fact;
        return index ? [separator(), el] : [el];
      }));
    }
    japanPoiCard.hidden = false;
    japanPoiCard.scrollTop = 0;
    japanPoiCard.setAttribute("aria-hidden", "false");
    japanLayer.classList.add("japan-poi-open");
    requestAnimationFrame(() => {
      positionJapanPoiCard(clientX, clientY);
      if (focusClose) {
        japanPoiClose.focus({ preventScroll: true });
      }
    });
  };

  const JAPAN_POI_SOURCE_DATASET_IDS = Object.freeze({
    "breathing-earth": "gosat-l3-xco2",
    "blue-circulation": "noaa-current-fallback",
    "forest-cloud-engine": "nasa-power-precip",
    "pollination-protocol": "gbif",
    "nothing-is-waste": "un-sdg",
    "anthropocene-scar": "gcp-fossil-co2",
    "rhythm-of-disaster": "usgs-earthquakes",
    "three-ecologies": "worldbank-forest",
    "earth-organ": "worldbank-renewable",
    "population-tide": "worldbank-population",
  });

  const getJapanPoiSourceUrl = (poi) => {
    if (poi.type === "exhibit") return poi.record.url || "";
    const signalMode = getActiveSignalMode();
    const datasets = signalMode?.datasets || [];
    const datasetUrl = (id) => datasets.find((dataset) => dataset.id === id)?.url || "";
    if (poi.type === "history") return datasetUrl("jma-shindo");
    if (poi.type === "earthquake") {
      return poi.event?.url || datasetUrl("usgs-earthquakes");
    }
    if (poi.type === "data") {
      if (poi.record?.url) return poi.record.url;
      if (signalMode?.id === "three-ecologies" && poi.record?.category) {
        return datasetUrl("unesco-whc");
      }
    }
    return datasetUrl(JAPAN_POI_SOURCE_DATASET_IDS[signalMode?.id])
      || datasets.find((dataset) => dataset.kind === "SOURCE" && /^https?:/u.test(dataset.url))?.url
      || "";
  };

  const setJapanPoiSource = (poi) => {
    const sourceUrl = getJapanPoiSourceUrl(poi);
    japanPoiSource.hidden = !sourceUrl;
    japanPoiSource.href = sourceUrl || "#";
  };

  const openJapanPoi = (poi, clientX, clientY) => {
    if (globalThis.GaiaFoodExhibits?.definitions?.some(item => item.id === poi.record?.exhibitId)) {
      globalThis.GaiaFoodExhibits?.selectCountry?.(poi.record.id, { focus: false });
    }
    if (globalThis.GaiaMarineCod?.definitions?.some(item => item.id === poi.record?.exhibitId)) {
      globalThis.GaiaMarineCod?.selectStation?.(poi.record.id, { focus: false });
      return;
    }
    pauseMapTimeline();
    if (japanLayer.classList.contains("is-firms-exhibit")) globalThis.GaiaFirmsExhibit?.pausePlayback?.();
    if (getActiveSignalMode()?.id === "three-ecologies" && poi.type === "data") {
      if (poi.record.iso3) selectEcologiesCountry(poi.record.iso3, { focus: false });
      else {
        ecologiesCultureIndex = Math.max(0, getActiveSignalMode().signals.culture.findIndex(row => row.name === poi.record.name));
        ecologiesExhibit?.selectSite(ecologiesCultureIndex);
      }
      return;
    }
    window.clearTimeout(japanPoiRevealTimer);
    japanPoiRevealTimer = 0;
    clearJapanPoiHover();
    resetJapanPoiHistory();
    selectedJapanPoi = poi;
    japanPoiCard.hidden = true;
    japanPoiCard.setAttribute("aria-hidden", "true");
    japanLayer.classList.remove("japan-poi-open");

    if (poi.type === "exhibit") {
      japanPoiType.textContent = `${poi.record.kicker} / 地点データ`;
      japanPoiMeta.textContent = poi.record.meta;
      setJapanPoiSource(poi);
      japanWaveReplay = null;
      showJapanPoiCard(clientX, clientY);
    } else if (poi.type === "data") {
      const record = poi.record;
      const activeSignalMode = getActiveSignalMode();
      if (activeSignalMode) {
        co2TimelineHeld = true;
        if (activeSignalMode.id === "anthropocene-scar" && record.iso3) {
          anthropoceneSelectedIso3 = record.iso3;
        } else if (activeSignalMode.id === "population-tide" && record.iso3) {
          populationSelectedIso3 = record.iso3;
        }
        if (Number.isInteger(record.sequenceIndex) && record.sequenceLength > 0) {
          if (activeSignalMode.id === "nothing-is-waste") {
            wasteSelectedIndex = record.sequenceIndex;
            signalTimePosition = record.sequenceLength > 1
              ? (record.sequenceIndex / (record.sequenceLength - 1)) * 100
              : 0;
          } else {
            signalTimePosition = clamp(
              ((record.sequenceIndex + 0.5) / record.sequenceLength) * 100,
              0,
              99.999,
            );
            signalTimeInputs.forEach((input) => {
              input.value = String(signalTimePosition);
            });
          }
        }
        updateSignalInterface();
      }
      japanPoiType.textContent = activeSignalMode?.id === "anthropocene-scar"
        ? `${getCountryNameJa(record)} / ${modes[modeToIndex].titleJa} · 観測データ`
        : `${modes[modeToIndex].titleJa} / 観測データ`;
      japanPoiMeta.textContent = record.meta;
      setJapanPoiSource(poi);
      japanWaveReplay = null;
      showJapanPoiCard(clientX, clientY);
      if (activeSignalMode?.id === "anthropocene-scar" && record.iso3) {
        loadJapanPoiHistory(poi, activeSignalMode, clientX, clientY);
      }
    } else if (poi.type === "history") {
      const event = poi.event;
      co2TimelineHeld = true;
      updateSignalInterface();
      japanPoiType.textContent = `${String(event.occurredAt).slice(0, 4)} ${getJmaEventTitle(event)} / JMA`;
      japanPoiMeta.textContent = `${formatJapanEventTime(event.occurredAt)} / M${event.magnitude.toFixed(
        1,
      )} / 深さ ${event.depthKm} km / 最大震度 ${getMaximumIntensityText(
        event,
      )} / P波 7.0・S波 4.0 km/s`;
      setJapanPoiSource(poi);
      japanWaveReplay = {
        kind: "history",
        event,
        bornAt: performance.now(),
        arrivedCount: 0,
      };
      japanMapStatus.textContent = getJapanObservationStatus();
      const revealDelay = reducedMotion ? 0 : JAPAN_HISTORY_CARD_DELAY;
      japanPoiRevealTimer = window.setTimeout(() => {
        japanPoiRevealTimer = 0;
        if (japanIsOpen && selectedJapanPoi === poi) {
          showJapanPoiCard(clientX, clientY, { focusClose: reducedMotion });
        }
      }, revealDelay);
    } else if (poi.type === "earthquake") {
      const event = poi.event;
      co2TimelineHeld = true;
      updateSignalInterface();
      japanPoiType.textContent = `M${event.magnitude.toFixed(1)} / 震源 ${formatCoordinateJa(event.latitude, event.longitude)} / USGS`;
      japanPoiMeta.textContent = `${formatJapanEventTime(event.time)} / 深さ ${Math.round(
        event.depthKm,
      )} km`;
      setJapanPoiSource(poi);
      japanWaveReplay = null;
      showJapanPoiCard(clientX, clientY);
    } else {
      const node = poi.node;
      co2TimelineHeld = true;
      updateSignalInterface();
      japanPoiType.textContent = `${node.nameJa} / 地図上の観測地点`;
      japanPoiMeta.textContent = `${formatCoordinateJa(node.lat, node.lon)}`;
      setJapanPoiSource(poi);
      japanWaveReplay = null;
      showJapanPoiCard(clientX, clientY);
    }
  };

  const findJapanPoiAt = (
    clientX,
    clientY,
    pointerType = "",
    { allowGridFallback = true } = {},
  ) => {
    // Exclusive exhibits must pick their own rendered data, never the base
    // chapter's invisible POIs or CO2 grid fallback.
    if (japanLayer.classList.contains("is-food-exhibit")) {
      return globalThis.GaiaFoodExhibits?.findPoiAt?.(clientX, clientY, pointerType) || null;
    }
    if (japanLayer.classList.contains("is-marine-cod-exhibit")) {
      return globalThis.GaiaMarineCod?.findPoiAt?.(clientX, clientY, pointerType) || null;
    }
    if (japanLayer.classList.contains("is-planet-signals-exhibit")) {
      return globalThis.GaiaPlanetSignals?.findPoiAt?.(clientX, clientY, pointerType) || null;
    }
    if (japanLayer.classList.contains("is-firms-exhibit")) {
      return globalThis.GaiaFirmsExhibit?.findPoiAt?.(clientX, clientY, pointerType) || null;
    }
    if (japanLayer.classList.contains("is-live-exhibit") || japanLayer.classList.contains("is-estat-exhibit")) return null;
    const firstPoiVisibleAt = mapPlotRevealStartedAt + (reducedMotion ? 0 : MAP_PLOT_REVEAL_LEAD_MS);
    if (mapPlotRevealBlockedUntil > 0 || performance.now() < firstPoiVisibleAt) return null;
    const { rect, left, top } = getJapanViewport();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const touchLikePointer =
      coarsePointer || pointerType === "touch" || pointerType === "pen";
    const hitRadii = MAP_POI_HIT_RADII[touchLikePointer ? "coarse" : "fine"];
    const signalModeId = getActiveSignalMode()?.id;
    let closest = null;

    const considerCandidate = (candidate, point, hitRadius) => {
      const distance = Math.hypot(localX - point.x, localY - point.y);
      if (distance <= hitRadius && (!closest || distance < closest.distance)) {
        closest = { ...candidate, distance };
      }
    };

    const modeDataPois = getModeDataPois();
    if (
      // Use the same geographic paths as the country fills, including islands
      // and interior holes, rather than only the representative POI radius.
      ["anthropocene-scar", "nothing-is-waste", "earth-organ"].includes(signalModeId)
      && mapScope === "earth"
      && naturalEarthCountryState === "ready"
      && countryHitTestContext
    ) {
      const projection = japanView.earthProjection || getEarthProjection(rect);
      const worldCopies = getEarthWorldCopies(projection);
      for (const [index, record] of modeDataPois.entries()) {
        const path = getNaturalEarthCountryGeographicPath(record.mapIso3 || record.iso3);
        if (!path) continue;
        const countryHit = worldCopies.some((copy) => countryHitTestContext.isPointInPath(
          path,
          (localX - copy.x) / projection.scale,
          (localY - copy.y) / projection.scale,
          "evenodd",
        ));
        if (countryHit) return { type: "data", record, index, distance: 0 };
      }
    }

    modeDataPois.forEach((record, index) => {
      const point = japanWorldToScreen(record.lon, record.lat, left, top);
      let hitRadius = hitRadii.node;
      if (signalModeId === "forest-cloud-engine") {
        hitRadius = Math.max(hitRadius, getForestRainRadius(record.precipitationMmDay));
      } else if (signalModeId === "three-ecologies" && ecologiesView !== "culture") {
        hitRadius = Math.max(hitRadius, clamp(rect.width * .025, 28, 82) / 2 + 9);
      } else if (signalModeId === "population-tide") {
        hitRadius = Math.max(hitRadius, getPopulationRadius(record.population, rect));
      } else if (signalModeId === "nothing-is-waste") {
        // Small territories retain a point fallback; larger countries use their borders.
        hitRadius = touchLikePointer ? 12 : 6;
      }
      considerCandidate({ type: "data", record, index }, point, hitRadius);
    });

    if (isTheme(5)) {
      if (japanDataLayer === "history") {
        japanHistoryEvents.forEach((event, index) => {
          const point = japanWorldToScreen(event.longitude, event.latitude, left, top);
          considerCandidate({ type: "history", event, index }, point, hitRadii.history);
        });
      }
    }

    if (modes[modeToIndex].id !== "breathing-earth") {
      getActiveMapNodes().forEach((node, index) => {
        const point = japanWorldToScreen(node.lon, node.lat, left, top);
        considerCandidate({ type: "node", node, index }, point, hitRadii.node);
      });
    }

    if (!closest && allowGridFallback && modes[modeToIndex].id === "breathing-earth") {
      const signalMode = getActiveSignalMode();
      const location = japanScreenToLonLat(localX, localY, left, top);
      const record = signalMode
        ? getGosatCellRecord(signalMode, location.lon, location.lat)
        : null;
      if (record) closest = { type: "data", record, index: -1, distance: 0 };
    }

    return closest;
  };

  const fetchJsonWithTimeout = async (url, timeout = 6500) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        cache: "default",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const maybeOpenJapanEventFromUrl = () => {
    if (japanDeepLinkHandled || !japanIsOpen || japanHistoryDataState !== "ready") {
      return;
    }
    const eventId = new URLSearchParams(window.location.search).get("event");
    const event = japanHistoryEvents.find((candidate) => candidate.id === eventId);
    if (!event) {
      return;
    }
    japanDeepLinkHandled = true;
    setMapScope("japan", { resetLayer: false });
    setJapanDataLayer("history");
    requestAnimationFrame(() => {
      const { rect, left, top } = getJapanViewport();
      const point = japanWorldToScreen(event.longitude, event.latitude, left, top);
      openJapanPoi(
        { type: "history", event },
        rect.left + clamp(point.x, 24, rect.width - 24),
        rect.top + clamp(point.y, 24, rect.height - 24),
      );
    });
  };

  const loadJapanHistory = async () => {
    if (japanHistoryDataState === "loading" || japanHistoryDataState === "ready") {
      maybeOpenJapanEventFromUrl();
      return;
    }
    japanHistoryDataState = "loading";
    updateJapanDataInterface();
    japanMapStatus.textContent = getJapanObservationStatus();
    try {
      const data = await fetchJsonWithTimeout(JMA_HISTORY_DATA, 3500);
      if (!Array.isArray(data.events)) {
        throw new Error("Invalid JMA history payload");
      }
      dataLedger.setJsonPreview("jma", data, "data/jma-intensity-history.json");
      japanHistoryEvents = data.events.filter(
        (event) =>
          Number.isFinite(event.longitude) &&
          Number.isFinite(event.latitude) &&
          Array.isArray(event.observations),
      );
      japanHistoryUpdatedAt = data.retrievedAt || null;
      japanHistoryDataState = "ready";
    } catch {
      japanHistoryEvents = [];
      japanHistoryUpdatedAt = null;
      japanHistoryDataState = "offline";
      dataLedger.setPreviewError("jma", "JMA JSON LOAD FAILED");
    }
    updateJapanDataInterface();
    japanMapStatus.textContent = getJapanObservationStatus();
    maybeOpenJapanEventFromUrl();
  };

  const loadJapanEarthquakes = async () => {
    if (
      japanEarthquakeDataState === "loading" ||
      japanEarthquakeDataState === "snapshot"
    ) {
      return;
    }

    japanEarthquakeDataState = "loading";
    japanDataUpdatedAt = null;
    updateJapanDataInterface();
    if (japanTileErrors === 0) {
      japanMapStatus.textContent = getJapanObservationStatus();
    }

    try {
      const snapshot = await snapshotStore.loadMode("rhythm-of-disaster");
      const earthquakeMode = snapshot.modes?.find((mode) => mode.id === "rhythm-of-disaster");
      const globalEvents = earthquakeMode?.signals?.globalEvents || [];
      dataLedger.setJsonPreview(
        "usgs-earthquakes",
        globalEvents,
        "data/gaia-signals.json / 07 globalEvents",
      );
      japanEarthquakes = globalEvents
        .map((event) =>
          normalizeJapanEarthquake({
            id: event.id,
            time: event.occurredAt,
            magnitude: event.magnitude,
            place: event.name,
            longitude: event.longitude,
            latitude: event.latitude,
            depthKm: event.depthKm,
          }),
        )
        .filter(
          (event) =>
            Number.isFinite(event.longitude) &&
            Number.isFinite(event.latitude) &&
            Number.isFinite(event.magnitude) &&
            event.magnitude >= 7.5,
        )
        .sort((first, second) => Date.parse(second.time) - Date.parse(first.time))
        .slice(0, 320);
      if (japanEarthquakes.length === 0) {
        throw new Error("USGS globalEvents snapshot is empty");
      }
      japanEarthquakeDataState = "snapshot";
      japanDataUpdatedAt = snapshot.generatedAt || null;
    } catch {
      japanEarthquakes = [];
      japanEarthquakeDataState = "offline";
      japanDataUpdatedAt = null;
      dataLedger.setPreviewError("usgs-earthquakes", "LOCAL USGS SNAPSHOT LOAD FAILED");
    }

    updateJapanDataInterface();

    if (japanPulses.length === 0 || japanTileErrors > 0) {
      japanMapStatus.textContent = getJapanObservationStatus();
    }
  };

  const clearTrail = () => {
    for (const point of trail) {
      point.x = -10;
      point.y = -10;
      point.bornAt = -100;
      point.strength = 0;
    }

    trailCursor = 0;
    previousTrailX = -10;
    previousTrailY = -10;
    pointer.energy = 0;
  };

  const clearSession = () => {
    clearTrail();
    modeMemory.fill(0);
    experience.classList.remove("has-interacted");
  };

  const addTrailPoint = (x, y, now, strength, force = false) => {
    const distance = Math.hypot(x - previousTrailX, y - previousTrailY);

    if (!force && distance < 0.018 && now - lastTrailAt < 42) {
      return;
    }

    const point = trail[trailCursor];
    point.x = x;
    point.y = y;
    point.bornAt = now;
    point.strength = clamp(strength, 0.28, 1.35);

    trailCursor = (trailCursor + 1) % TRAIL_COUNT;
    previousTrailX = x;
    previousTrailY = y;
    lastTrailAt = now;
    modeMemory[modeToIndex] = clamp(
      modeMemory[modeToIndex] + 0.012 + point.strength * 0.008,
      0,
      1,
    );
  };

  const updatePointer = (event, forceTrail = false) => {
    const rect = canvas.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
    const y = clamp(1 - (event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
    const now = performance.now();
    const elapsed = Math.max(now - pointer.previousTime, 8);

    pointer.velocityX = clamp(((x - pointer.previousX) * 1000) / elapsed, -1.8, 1.8);
    pointer.velocityY = clamp(((y - pointer.previousY) * 1000) / elapsed, -1.8, 1.8);
    const speed = Math.hypot(pointer.velocityX, pointer.velocityY);
    pointer.energy = clamp(pointer.energy + speed * 0.17 + (pointer.down ? 0.08 : 0), 0, 1.35);
    pointer.x = x;
    pointer.y = y;
    pointer.previousX = x;
    pointer.previousY = y;
    pointer.previousTime = now;

    if (pointer.down || event.pointerType === "mouse") {
      addTrailPoint(x, y, now, 0.48 + speed * 0.36 + (pointer.down ? 0.18 : 0), forceTrail);
      experience.classList.add("has-interacted");
    }
  };

  const getActiveSignalMode = (index = modeToIndex) => {
    const visualMode = modes[index];
    return gaiaModeById.get(visualMode.dataModeId || visualMode.id) || null;
  };

  const pickByPosition = (values, position = signalTimePosition) => {
    if (!Array.isArray(values) || values.length === 0) return null;
    const index = Math.round(clamp(position / 100, 0, 1) * (values.length - 1));
    return values[index];
  };

  const getSignalReadout = (signalMode) => {
    if (!signalMode) {
      if (gaiaSnapshotError) {
        return {
          output: "ERROR",
          value: "公開データの読み込みエラー",
          note: `公開データを読み込めませんでした。再読み込みしてください。 (${gaiaSnapshotError})`,
          temporal: false,
        };
      }
      return { output: "—", value: "公開データを読み込み中", note: "公開データを読み込んでいます。", temporal: false };
    }
    const { signals } = signalMode;
    if (signalMode.id === "breathing-earth") {
      const state = getBreathingEarthState(signalMode);
      const { co2, temperature } = state;
      if (japanIsOpen) {
        const timeline = state.timeline;
        const grid = state.gosat;
        return {
          output: timeline
            ? `${timeline.dateLabel} / ${timeline.kind.toUpperCase()}`
            : "時系列を読み込み中",
          value: timeline
            ? timeline.kind === "scenario"
              ? `${timeline.referencePpm.toFixed(1)} ppm / 予想の幅 ${timeline.lower95Ppm.toFixed(1)}–${timeline.upper95Ppm.toFixed(1)}`
              : `${timeline.referencePpm.toFixed(1)} ppm / 実測 ${timeline.observedCells || 0} + 補完 ${timeline.imputedCells || 0}`
            : "CO₂時系列を読み込み中",
          primaryValue: timeline ? `${timeline.referencePpm.toFixed(1)} ppm` : null,
          dockMetric: timeline ? { label: "CO₂濃度", value: timeline.referencePpm.toFixed(1), unit: "ppm" } : null,
          detailValues: timeline ? timeline.kind === "scenario"
            ? ["予想の幅", `${timeline.lower95Ppm.toFixed(1)}–${timeline.upper95Ppm.toFixed(1)}`]
            : [`実測 ${timeline.observedCells || 0}`, `+ 補完 ${timeline.imputedCells || 0}`] : null,
          note: timeline
            ? `${timeline.warning} 世界地図をタップすると${grid?.resolutionDegrees || 2.5}°セルの値を表示します。`
            : "1958〜2050の時系列を準備しています。",
          temporal: true,
        };
      }
      return {
        output: `${co2.year}-${String(co2.month).padStart(2, "0")}`,
        value: `${co2.averagePpm.toFixed(2)} ppm / ΔT ${temperature?.anomalyC?.toFixed(2) ?? "—"} ℃`,
        note: "球体の動きはCO₂の季節変化、明るさは長期的な増加、背景色はNASAがまとめた気温の変化です。",
        temporal: true,
      };
    }
    if (signalMode.id === "blue-circulation") {
      const state = getBlueCirculationState(signalMode);
      return {
        output: `${state?.dateLabel || "観測時点"} / 計算 ${((state?.horizonHours || 0) / 24).toFixed(1)}日後`,
        value: `海流 ${state?.vectorCount || 0}地点 / 平均 ${state?.meanSpeedMs.toFixed(2) || "—"} m/s`,
        dockMetric: { label: "平均海流速度", value: state?.meanSpeedMs.toFixed(2) || "—", unit: "m/s", detail: `海流 ${state?.vectorCount || 0}地点` },
        note: `${state?.warning || "海流を読み込んでいます。"} 色付きは海流、白い矢印は比較用の平均風です。風は距離計算に使いません。`,
        temporal: true,
      };
    }
    if (signalMode.id === "forest-cloud-engine") {
      const state = getMapSequenceState(signalMode);
      const rain = state?.selected;
      return {
        output: state?.phaseLabel || "世界の参照地点",
        location: getForestRainSiteName(rain),
        value: `降水量 ${rain?.precipitationMmDay?.toFixed(2) ?? "—"} mm/日`,
        dockMetric: { label: "降水量", value: rain?.precipitationMmDay?.toFixed(2) ?? "—", unit: "mm/日" },
        note: "大きな水色円が降水量、緑が森林域です。円の直径で雨量を比べ、地点間は推測で埋めません。相関係数や因果関係を示す図ではありません。",
        temporal: true,
      };
    }
    if (signalMode.id === "pollination-protocol") {
      const state = getMapSequenceState(signalMode);
      return {
        output: state?.phaseLabel || "3つの読み方",
        value: `${state?.yearLabel || "—"} / ${state?.valueLabel || "記録を読み込み中"}`,
        note: state?.note || "観察記録と生息分布の違いを読み込んでいます。",
        temporal: true,
      };
    }
    if (signalMode.id === "nothing-is-waste") {
      const state = getMapSequenceState(signalMode);
      return {
        output: state?.phaseLabel || "国・地域別の値",
        location: state?.selected ? getCountryNameJa(state.selected) : "—",
        value: `再資源化率 ${state?.sourceRecycle.toFixed(1) || "—"}% / ${recyclingSourceLabel(state?.selected)}`,
        dockMetric: { label: "再資源化率", value: state?.sourceRecycle.toFixed(1) || "—", unit: "%", detail: recyclingSourceLabel(state?.selected) },
        note: `${state?.selected ? getCountryNameJa(state.selected) : "この国"} ${state?.selected?.year || "報告年不明"}。${recyclingDetails(state?.selected)} ${RECYCLING_COMPARABILITY} 無着色は未収録です。`,
        temporal: true,
      };
    }
    if (signalMode.id === "anthropocene-scar") {
      const state = getMapSequenceState(signalMode);
      const emission = state?.selected;
      return {
        output: state?.phaseLabel || "化石燃料由来CO₂の推移",
        location: emission ? getCountryNameJa(emission) : "—",
        value: `${state?.selectedYear || "—"} / ${emission?.emissionsMtCo2?.toFixed(1) || "—"} Mt CO₂`,
        dockMetric: { label: "化石燃料由来CO₂", value: emission?.emissionsMtCo2?.toFixed(1) || "—", unit: "Mt CO₂" },
        note: "国土の濃紺→紫→赤→橙→淡黄は、全年度共通の固定対数尺度で示す選択年の化石燃料由来CO₂です。白い発光は2016年のNASA VIIRS夜間光を固定した参照です。",
        temporal: true,
      };
    }
    if (signalMode.id === "rhythm-of-disaster") {
      const state = getMapSequenceState(signalMode);
      return {
        output: state?.phaseLabel || "USGS世界地震史",
        value: state ? `${state.selectedYear}年 / ${state.yearEvents.length}件 / 最大 M${state.selected.magnitude.toFixed(1)}` : "年次データなし",
        dockMetric: { label: "地震の件数", value: state ? String(state.yearEvents.length) : "—", unit: "件", detail: state ? `最大 M${state.selected.magnitude.toFixed(1)}` : "年次データなし" },
        note: "この年度の震源だけを発生日時順に世界表示します。各点に続く輪は約2.2〜3.6秒で広がり、Magnitudeから見積もった可感半径で止まります。実際の震度・被害・津波範囲ではありません。",
        temporal: true,
      };
    }
    if (signalMode.id === "three-ecologies") {
      const state = getMapSequenceState(signalMode);
      return {
        output: state?.phaseLabel || "森林率 × 都市人口率",
        location: state?.selected ? getCountryNameJa(state.selected) : "",
        value: state
          ? `森林率 ${state.selected.forestPercent.toFixed(1)}% / 都市人口率 ${state.selected.urbanPercent.toFixed(1)}%`
          : "比較できる国別データなし",
        note: state
          ? `緑は陸地の森林率、青は人口の都市居住率。別の分母なので足して100%にはなりません。散布図の r ${state.correlation.toFixed(2)} は${state.correlationLabel}で、文化・記憶は別表示です。`
          : "同じ国の森林率と都市人口率を組にして比較します。",
        temporal: true,
      };
    }
    if (signalMode.id === "earth-organ") {
      const state = getMapSequenceState(signalMode);
      const current = state?.selected;
      return {
        output: state?.phaseLabel || "再生可能エネルギー発電割合",
        location: current?.countryJa || current?.country || "—",
        value: `再生可能エネルギー発電割合 ${current?.renewablePercent?.toFixed(1) || "—"}%`,
        dockMetric: { label: "再生可能エネルギー発電割合", value: current?.renewablePercent?.toFixed(1) || "—", unit: "%" },
        note: "国土の青が明るいほど、総発電量に占める再生可能エネルギーの割合が高い国です。黄色の日射と緑の風は選択国の補足で、現在の比率を決める因果表示ではありません。",
        temporal: true,
      };
    }
    if (signalMode.id === "population-tide") {
      const state = getMapSequenceState(signalMode);
      const population = state?.selected;
      return {
        output: state?.phaseLabel || "人口の推移",
        location: population ? getCountryNameJa(population) : "—",
        value: `${state?.selectedYear || "—"} / ${formatObservationNumber(population?.population, 0)} 人`,
        dockMetric: { label: "人口", value: formatObservationNumber(animatedPopulation(population), 0), unit: "人" },
        note: "淡青の円は選択年の国別人口で、面積が人口に比例します。国の代表位置へ置いた比較円で、都市位置や人口密度ではありません。",
        temporal: true,
      };
    }
    const state = getMapSequenceState(signalMode);
    return {
      output: state?.phaseLabel || "EARTH OBSERVATION ATLAS",
      value: state?.selected
        ? `${state.selected.number} ${state.selected.metric} / ${state.selected.value}`
        : "9 MEASUREMENTS ≠ 1 SCORE",
      note: state?.selected
        ? `${state.selected.scope}。9枚は同時表示しますが、単位と意味が違うため足し算や総合順位にはしません。`
        : "各展示の測るもの・代表値・単位を同時に並べます。",
      temporal: true,
    };
  };

  const getShaderSignalVector = (modeIndex = modeToIndex) => {
    const signalMode = getActiveSignalMode(modeIndex);
    if (!signalMode) return [0.35, 0.25, 0.15, 0.1];
    const { signals } = signalMode;
    if (signalMode.id === "breathing-earth") {
      const state = getBreathingEarthState(signalMode);
      const row = state.co2;
      const temperature = state.temperature;
      return [
        clamp(((row?.deseasonalizedPpm || 315) - 315) / 120, 0, 1),
        state.seasonalUnit * 0.5 + 0.5,
        clamp(((temperature?.anomalyC || 0) + 0.5) / 2, 0, 1),
        0.2,
      ];
    }
    if (signalMode.id === "blue-circulation") {
      const state = getBlueCirculationState(signalMode);
      const meanStrength = clamp((state?.meanSpeedMs || 0) / 1, 0, 1);
      const peakStrength = clamp((state?.maximumSpeedMs || 0) / 1.5, 0, 1);
      const sampleDensity = clamp((state?.vectorCount || 0) / CURRENT_FIELD_SAMPLE_LIMIT, 0, 1);
      const horizonUnit = clamp((state?.horizonHours || 0) / CIRCULATION_TIMELINE_HOURS, 0, 1);
      canvas.dataset.currentMeanSpeedMs = (state?.meanSpeedMs || 0).toFixed(4);
      canvas.dataset.currentMaximumSpeedMs = (state?.maximumSpeedMs || 0).toFixed(4);
      canvas.dataset.currentStrength = meanStrength.toFixed(4);
      canvas.dataset.currentVectorCount = String(state?.vectorCount || 0);
      canvas.dataset.currentBrushLanguage = "continuous-interpolated-field-with-poi-anchors";
      canvas.dataset.currentCoverageMode = "gapless-idw-vector-field";
      canvas.dataset.currentInterpolationSource = "inverse-distance-weighted-noaa-vectors";
      canvas.dataset.currentAmbientMotion = "continuous-timeline-independent-gradient";
      return [meanStrength, peakStrength, sampleDensity, horizonUnit];
    }
    if (signalMode.id === "forest-cloud-engine") {
      const row = getMapSequenceState(signalMode)?.selected || pickByPosition(signals.precipitation);
      return [clamp((row?.precipitationMmDay || 0) / 8, 0, 1), 0.42, 0.7, 0.25];
    }
    if (signalMode.id === "pollination-protocol") {
      return [
        clamp((signals.interactions?.length || 0) / 30, 0, 1),
        clamp((signals.occurrences?.length || 0) / 30, 0, 1),
        0.55,
        0.35,
      ];
    }
    if (signalMode.id === "nothing-is-waste") {
      const state = getMapSequenceState(signalMode);
      const recycling = state?.sourceRecycle || 0;
      const selectionProgress = (state?.selectedIndex || 0)
        / Math.max(1, (signalMode.signals.countryWaste?.length || 1) - 1);
      return [recycling / 100, selectionProgress, 0.46, 0.24];
    }
    if (signalMode.id === "anthropocene-scar") {
      const row = getMapSequenceState(signalMode)?.selected;
      const emission = clamp(Math.log10(Math.max(1, row?.emissionsMtCo2 || 1)) / 4.2, 0, 1);
      return [emission, 0.78, anthropocenePeelUntil > performance.now() ? 0.05 : 0.8, 0.18];
    }
    if (signalMode.id === "rhythm-of-disaster") {
      const event = getMapSequenceState(signalMode)?.selected;
      return [
        clamp(((event?.magnitude || 7.5) - 7.5) / 2, 0, 1),
        clamp((event?.depthKm || 0) / 700, 0, 1),
        0.84,
        0.22,
      ];
    }
    if (signalMode.id === "three-ecologies") {
      const state = getMapSequenceState(signalMode);
      return [
        clamp((state?.selected?.forestPercent || 0) / 100, 0, 1),
        clamp((state?.selected?.urbanPercent || 0) / 100, 0, 1),
        clamp(((state?.correlation || 0) + 1) / 2, 0, 1),
        clamp((signals.culture?.length || 0) / 30, 0, 1),
      ];
    }
    if (signalMode.id === "earth-organ") {
      const state = getMapSequenceState(signalMode);
      const row = state?.selected;
      return [
        clamp((row?.renewablePercent || 0) / 100, 0, 1),
        clamp((row?.potential?.solarKwhM2Day || 0) / 7, 0, 1),
        clamp((row?.potential?.windSpeedMs || 0) / 10, 0, 1),
        1,
      ];
    }
    if (signalMode.id === "population-tide") {
      const state = getMapSequenceState(signalMode);
      const selectedPopulation = Number(state?.selected?.population || 0);
      const sampleTotal = Number(state?.totalPopulation || 1);
      const timeProgress = state?.years?.length > 1
        ? state.yearIndex / (state.years.length - 1)
        : 0;
      return [
        clamp(Math.log10(Math.max(1, selectedPopulation)) / 10, 0, 1),
        clamp(selectedPopulation / sampleTotal, 0, 1),
        timeProgress,
        0.58,
      ];
    }
    return [0.72, 0.48, pointer.energy, modeMemory[modeIndex]];
  };

  const observationMetric = (key, label, value, unit = "") => Number.isFinite(Number(value))
    ? { key, label, value: Number(value), unit }
    : null;

  const captureMapObservation = () => {
    const signalMode = getActiveSignalMode();
    if (!signalMode) throw new Error(gaiaSnapshotError || "公開データを読み込んでいます。少し待ってから保存してください。");
    const visualMode = modes[modeToIndex];
    const readout = getSignalReadout(signalMode);
    const sequence = getMapSequenceState(signalMode);
    const metrics = [];
    if (signalMode.id === "breathing-earth") {
      const state = getBreathingEarthState(signalMode);
      const ppm = japanIsOpen ? state.timeline?.referencePpm : state.co2?.averagePpm;
      metrics.push(
        observationMetric("co2_ppm", "CO₂濃度", ppm, "ppm"),
        observationMetric("temperature_anomaly_c", "気温偏差", state.temperature?.anomalyC, "℃"),
      );
    } else if (signalMode.id === "blue-circulation") {
      const state = getBlueCirculationState(signalMode);
      metrics.push(
        observationMetric("mean_speed_ms", "平均海流速度", state?.meanSpeedMs, "m/s"),
        observationMetric("mean_distance_km", "計算上の平均移動距離", state?.meanDistanceKm, "km"),
        observationMetric("horizon_hours", "経過時間", state?.horizonHours, "h"),
      );
    } else if (signalMode.id === "forest-cloud-engine") {
      metrics.push(observationMetric("precipitation_mm_day", "降水量", sequence?.selected?.precipitationMmDay, "mm/日"));
    } else if (signalMode.id === "pollination-protocol") {
      metrics.push(sequence?.stageKey === "relations"
        ? observationMetric("relation_count", "花との記録関係", sequence?.relations?.length, "件")
        : observationMetric("occurrence_count", "GBIF観察記録", sequence?.occurrences?.length, "件"));
    } else if (signalMode.id === "nothing-is-waste") {
      metrics.push(observationMetric("recycle_percent", "再資源化率", sequence?.sourceRecycle, "%"));
    } else if (signalMode.id === "anthropocene-scar") {
      metrics.push(
        observationMetric("fossil_co2_mt", "化石燃料由来CO₂", sequence?.selected?.emissionsMtCo2, "Mt CO₂"),
        observationMetric("selected_year", "表示年", sequence?.selectedYear, "年"),
      );
    } else if (signalMode.id === "rhythm-of-disaster") {
      metrics.push(
        observationMetric("event_count", "M7.5以上の地震", sequence?.yearEvents?.length, "件"),
        observationMetric("maximum_magnitude", "最大マグニチュード", sequence?.selected?.magnitude, "M"),
      );
    } else if (signalMode.id === "three-ecologies") {
      metrics.push(
        observationMetric("forest_percent", "森林率", sequence?.selected?.forestPercent, "%"),
        observationMetric("urban_percent", "都市人口率", sequence?.selected?.urbanPercent, "%"),
        observationMetric("correlation", "相関係数", sequence?.correlation, "r"),
      );
    } else if (signalMode.id === "earth-organ") {
      metrics.push(
        observationMetric("renewable_percent", "再生可能エネルギー発電割合", sequence?.selected?.renewablePercent, "%"),
        observationMetric("solar_kwh_m2_day", "日射条件", sequence?.selected?.potential?.solarKwhM2Day, "kWh/m²/day"),
        observationMetric("wind_speed_ms", "風速条件", sequence?.selected?.potential?.windSpeedMs, "m/s"),
      );
    } else if (signalMode.id === "population-tide") {
      metrics.push(
        observationMetric("population", "人口", sequence?.selected?.population, "人"),
        observationMetric("selected_year", "表示年", sequence?.selectedYear, "年"),
      );
    }
    const normalizedMetrics = metrics.filter(Boolean);
    if (!normalizedMetrics.length) throw new Error("この時点には保存できる数値がありません。");
    return {
      version: 1,
      source: "map",
      capturedAt: new Date().toISOString(),
      title: visualMode.titleJa,
      subtitle: readout.output,
      compareKey: `map:${signalMode.id}`,
      metrics: normalizedMetrics,
      context: signalMode.id === "nothing-is-waste"
        ? [
          { label: "表示", value: readout.value },
          { label: "対象国", value: sequence?.selected?.country || "—" },
          { label: "データ区分", value: `${recyclingSourceLabel(sequence?.selected)} / ${sequence?.selected?.year || "報告年不明"}` },
          { label: "定義", value: recyclingDefinition(sequence?.selected) },
          { label: "対象・算定", value: recyclingScope(sequence?.selected) },
          { label: "年の意味", value: recyclingYearNote(sequence?.selected) },
          { label: "比較の注意", value: RECYCLING_COMPARABILITY },
        ]
        : [
          { label: "表示", value: readout.value },
          { label: "観測位置", value: `${Math.round(signalTimePosition)}%` },
        ],
      provenance: {
        classification: signalMode.id === "nothing-is-waste" ? "SOURCE" : [...new Set((signalMode.datasets || []).map((dataset) => dataset.kind).filter(Boolean))].join(" + "),
        datasetIds: signalMode.id === "nothing-is-waste" ? [recyclingSourceId(sequence?.selected)] : (signalMode.datasets || []).map((dataset) => dataset.id).filter(Boolean),
      },
    };
  };

  const mapTransformationReceipt = document.querySelector("#map-transformation-receipt");
  const updateMapTransformationReceipt = () => {
    if (!(mapTransformationReceipt instanceof HTMLElement)) return;
    const signalMode = getActiveSignalMode();
    const visualMode = modes[modeToIndex];
    const sourceOutput = mapTransformationReceipt.querySelector("[data-map-receipt-source]");
    const providerOutput = mapTransformationReceipt.querySelector("[data-map-receipt-provider]");
    const transformOutput = mapTransformationReceipt.querySelector("[data-map-receipt-transform]");
    const visualOutput = mapTransformationReceipt.querySelector("[data-map-receipt-visual]");
    if (!signalMode || !visualMode) {
      sourceOutput.textContent = gaiaSnapshotError ? "公開データを読み込めませんでした。" : "公開データを読み込んでいます。";
      providerOutput.textContent = gaiaSnapshotError || "LOCAL JSON / SNAPSHOT";
      return;
    }
    try {
      const observation = captureMapObservation();
      sourceOutput.textContent = observation.metrics
        .map((metric) => `${metric.label} ${formatObservationNumber(metric.value, 2)}${metric.unit ? ` ${metric.unit}` : ""}`)
        .join(" / ");
      providerOutput.textContent = [...new Set((signalMode.datasets || []).map((dataset) => dataset.organisation).filter(Boolean))].join(" / ");
      transformOutput.textContent = modeDataNarratives[visualMode.id] || "保存済みの公開記録を表示用の尺度へ変換します。";
      visualOutput.textContent = visualMode.description;
    } catch (error) {
      sourceOutput.textContent = "この時点の数値を準備しています。";
      providerOutput.textContent = error instanceof Error ? error.message : "LOCAL JSON / SNAPSHOT";
    }
  };

  let sourceSignalSnapshot = null;
  const sourceSignalVector = new Float32Array(MODE_COUNT);
  const getSourceSignalVector = () => {
    if (!gaiaSnapshot || sourceSignalSnapshot === gaiaSnapshot) return sourceSignalVector;
    const modeSignals = (id) => gaiaModeById.get(id)?.signals || {};
    const mean = (rows, selector) => rows.length
      ? rows.reduce((sum, row) => sum + selector(row), 0) / rows.length
      : 0;
    const air = modeSignals("breathing-earth");
    const currents = modeSignals("blue-circulation");
    const forest = modeSignals("forest-cloud-engine");
    const waste = modeSignals("nothing-is-waste");
    const city = modeSignals("anthropocene-scar");
    const quake = modeSignals("rhythm-of-disaster");
    const ecologies = modeSignals("three-ecologies");
    const energy = modeSignals("earth-organ");
    const population = modeSignals("population-tide");
    const latestCo2 = air.co2?.at(-1)?.deseasonalizedPpm || 315;
    sourceSignalVector.set([
      clamp((latestCo2 - 315) / 120, 0, 1),
      clamp(mean(currents.currents || [], (row) => Math.hypot(row.uMs, row.vMs)) / 0.7, 0, 1),
      clamp(mean(forest.precipitation || [], (row) => row.precipitationMmDay || 0) / 8, 0, 1),
      clamp(mean(waste.countryWaste || [], (row) => row.recyclePercent || 0) / 100, 0, 1),
      clamp(mean(city.emissions || [], (row) => Math.log10(Math.max(1, row.emissionsMtCo2 || 1))) / 4.2, 0, 1),
      clamp((Math.max(...(quake.globalEvents || []).map((row) => row.magnitude || 7.5), 7.5) - 7.5) / 2, 0, 1),
      clamp(mean(ecologies.social || [], (row) => row.urbanPercent || 0) / 100, 0, 1),
      clamp(mean(energy.current || [], (row) => row.renewablePercent || 0) / 100, 0, 1),
      clamp(mean(population.population || [], (row) => Math.log10(Math.max(1, row.population || 1))) / 10, 0, 1),
    ]);
    sourceSignalSnapshot = gaiaSnapshot;
    return sourceSignalVector;
  };

  const updateSignalInterface = () => {
    const signalMode = getActiveSignalMode();
    const readout = getSignalReadout(signalMode);
    const isStoryTemperatureInteraction = storyModeDetour?.kind === "map01"
      && storyModeDetour.phase === "temperature-anomaly";
    const isBreathingTimeline = signalMode?.id === "breathing-earth";
    const isCirculationTimeline = signalMode?.id === "blue-circulation";
    const isWasteCountrySelector = signalMode?.id === "nothing-is-waste";
    const sequenceState = !isBreathingTimeline && !isCirculationTimeline
      ? getMapSequenceState(signalMode)
      : null;
    const breathingState = isBreathingTimeline ? getBreathingEarthState(signalMode) : null;
    const timelineState = isBreathingTimeline
      ? breathingState.timeline
      : isCirculationTimeline
        ? getBlueCirculationState(signalMode)
        : sequenceState;
    const showTimeline = Boolean(japanIsOpen && timelineState);
    co2TimelineDisplay.hidden = !showTimeline;
    japanLayer.classList.toggle("is-co2-timeline", showTimeline);
    if (showTimeline) {
      co2TimelineDisplay.dataset.phase = timelineState.kind;
      const timelineTransport = mapTimelineManuallyPaused
        ? "手動選択"
        : reducedMotion && !mapTimelineExplicitPlayback
        ? signalMode?.id === "rhythm-of-disaster"
          ? "自動 · 簡易演出"
          : "静止"
        : co2TimelineHeld || performance.now() < co2TimelinePausedUntil
          ? "一時停止"
          : "自動";
      co2TimelinePhase.textContent = `${timelineState.phaseLabel} · ${timelineTransport}`;
      co2TimelineYear.textContent = timelineState.yearLabel;
      co2TimelinePpm.textContent = isCirculationTimeline
        ? timelineState.dateLabel
        : sequenceState
          ? timelineState.valueLabel
          : timelineState.kind === "scenario"
            ? `${timelineState.referencePpm.toFixed(1)} ppm · 幅 ${timelineState.lower95Ppm.toFixed(1)}–${timelineState.upper95Ppm.toFixed(1)}`
            : `${timelineState.referencePpm.toFixed(1)} ppm`;
      co2TimelineMethod.textContent = timelineState.methodLabel;
      const transitionKey = `${signalMode?.id || "unknown"}:${timelineState.yearLabel}`;
      if (signalMode?.id === "rhythm-of-disaster" && transitionKey !== timelineDisplayTransitionKey) {
        timelineDisplayTransitionKey = transitionKey;
        co2TimelineDisplay.dataset.timeTransitionKey = transitionKey;
        co2TimelineDisplay.classList.remove("is-time-changing");
        if (!reducedMotion) {
          void co2TimelineDisplay.offsetWidth;
          co2TimelineDisplay.classList.add("is-time-changing");
        }
      }
    }
    const activeSignalConsoles = storyModeDetour && japanIsOpen
      ? signalConsoles.filter((consoleElement) => consoleElement.classList.contains("signal-console-map"))
      : signalConsoles.filter((consoleElement) => !consoleElement.hidden && consoleElement.isConnected);
    activeSignalConsoles.forEach((consoleElement) => {
      consoleElement.querySelector("[data-signal-act]").textContent = signalMode
        ? `ACT ${signalMode.act.number} / ${signalMode.act.title}`
        : "観測データ";
      const signalValue = consoleElement.querySelector("[data-signal-value]");
      signalValue.classList.toggle("has-long-metric-label", signalMode?.id === "earth-organ");
      const signalLocation = isStoryTemperatureInteraction ? "" : readout.location || "";
      const hasBreakdown = !isStoryTemperatureInteraction && consoleElement.classList.contains("signal-console-map")
        && Boolean(readout.primaryValue && readout.detailValues?.length);
      signalValue.classList.toggle("has-breakdown", hasBreakdown);
      const dockMetric = !isStoryTemperatureInteraction && consoleElement.classList.contains("signal-console-map") && readout.dockMetric;
      signalValue.classList.toggle("has-dock-metric", Boolean(dockMetric));
      if (dockMetric) {
        consoleElement.querySelector("[data-signal-act]").textContent = [signalLocation, dockMetric.label].filter(Boolean).join(" / ");
        let primary = signalValue.querySelector('.signal-value-primary');
        let details = signalValue.querySelector('.signal-value-details');
        if (!primary || !details || !primary.querySelector('small')) {
          primary = document.createElement('b'); primary.className = 'signal-value-primary';
          primary.append(document.createElement('span'), document.createElement('small'));
          details = document.createElement('small'); details.className = 'signal-value-details';
          signalValue.replaceChildren(primary, details);
        }
        if (signalMode?.id === 'population-tide') primary.querySelector('span').textContent = dockMetric.value;
        else animateMetricText(primary.querySelector('span'), dockMetric.value, signalMode?.id);
        primary.querySelector('small').textContent = ` ${dockMetric.unit}`;
        const detailValues = readout.detailValues || [dockMetric.detail].filter(Boolean);
        if (details.children.length !== detailValues.length) details.replaceChildren(...detailValues.map(() => document.createElement('span')));
        [...details.children].forEach((item, index) => { item.textContent = detailValues[index]; });
        details.hidden = !detailValues.length;
        signalValue.setAttribute('aria-label', [signalLocation, readout.value].filter(Boolean).join(' / '));
      } else if (hasBreakdown) {
        let primary = signalValue.querySelector(".signal-value-primary");
        let details = signalValue.querySelector(".signal-value-details");
        if (!primary || !details) {
          primary = document.createElement("b");
          primary.className = "signal-value-primary";
          details = document.createElement("small");
          details.className = "signal-value-details";
          signalValue.replaceChildren(primary, details);
        }
        primary.textContent = readout.primaryValue;
        if (details.children.length !== readout.detailValues.length) {
          details.replaceChildren(...readout.detailValues.map(() => document.createElement("span")));
        }
        [...details.children].forEach((item, index) => { item.textContent = readout.detailValues[index]; });
        signalValue.setAttribute("aria-label", readout.value);
      } else {
        signalValue.removeAttribute("aria-label");
        const metricText = isStoryTemperatureInteraction
          ? `${breathingState?.timeline?.referencePpm?.toFixed(1) || "—"} ppm / 気温偏差 ${breathingState?.temperature?.anomalyC?.toFixed(2) ?? "—"} ℃`
          : signalLocation
            ? `${signalLocation}\n${readout.value}`
            : readout.value;
        if (consoleElement.classList.contains('signal-console-map') && !isStoryTemperatureInteraction) animateMetricText(signalValue, metricText, signalMode?.id);
        else signalValue.textContent = metricText;
      }
      signalValue.classList.toggle("has-location", Boolean(signalLocation));
      consoleElement.querySelector("[data-signal-time-output]").textContent = readout.output;
      consoleElement.querySelector("[data-signal-time-label]").textContent = showTimeline
        ? isStoryTemperatureInteraction
          ? "年代を動かす"
          : timelineState.timeLabel || (isCirculationTimeline
            ? "経過日数 / 0→14日（自動）"
            : `時点 / 自動 1958年→2050年${storyModeDetour?.kind === "map01" ? " · 3倍速" : ""}`)
        : "観測時点";
      const input = consoleElement.querySelector("[data-signal-time]");
      if (isWasteCountrySelector) {
        const rowCount = signalMode.signals.countryWaste?.length || 1;
        input.min = "0";
        input.max = String(Math.max(0, rowCount - 1));
        input.step = "1";
        input.value = String(sequenceState?.selectedIndex || 0);
      } else if (signalMode?.id === "earth-organ") {
        input.min = "0";
        input.max = String(Math.max(0, sequenceState.rows.length - 1));
        input.step = "1";
        input.value = String(sequenceState.selectedIndex);
      } else {
        input.min = "0";
        input.max = "100";
        input.step = "0.01";
        input.value = String(signalTimePosition);
      }
      input.disabled = !readout.temporal;
      const stepCount = signalMode?.id === "forest-cloud-engine"
        ? signalMode.signals.precipitation?.length
        : isWasteCountrySelector
          ? signalMode.signals.countryWaste?.length
          : signalMode?.id === "earth-organ"
            ? sequenceState?.rows?.length
            : 0;
      if (stepCount && Number.isInteger(sequenceState?.selectedIndex)) {
        input.dataset.mapStepCount = String(stepCount);
        input.dataset.mapStepIndex = String(sequenceState.selectedIndex);
      } else {
        delete input.dataset.mapStepCount;
        delete input.dataset.mapStepIndex;
      }
      if (isWasteCountrySelector) {
        input.setAttribute("aria-label", "表示する国・地域を選ぶ");
        input.setAttribute("aria-valuetext", `${sequenceState.selectedIndex + 1}番目、${getCountryNameJa(sequenceState.selected)}、再資源化率 ${sequenceState.sourceRecycle.toFixed(1)}%、${sequenceState.selected.year}年、${recyclingSourceLabel(sequenceState.selected)}`);
      } else {
        if (signalMode?.id === "earth-organ") {
          input.setAttribute("aria-label", "再生可能電力の国・地域を選ぶ");
          input.setAttribute("aria-valuetext", `${sequenceState.selectedIndex + 1} / ${sequenceState.rows.length}、${sequenceState.selected.countryJa}、${sequenceState.selected.year}年、発電割合 ${sequenceState.selected.renewablePercent.toFixed(1)}%`);
        } else {
          input.removeAttribute("aria-label");
          input.removeAttribute("aria-valuetext");
        }
      }
      consoleElement.classList.toggle("is-static", !readout.temporal);
    });
    if (mapSignalEncodingLegend) {
      const liveExhibitId = japanLayer.dataset.liveExhibit || "";
      const showEncodingLegend = Boolean(timelineState || liveExhibitId);
      if (mapSignalEncodingLegendTitle) mapSignalEncodingLegendTitle.hidden = !showEncodingLegend;
      mapSignalEncodingLegend.hidden = !showEncodingLegend;
      if (mapMobileLegendToggle) {
        mapMobileLegendToggle.hidden = !showEncodingLegend;
        if (!showEncodingLegend) {
          mapMobileLegendToggle.setAttribute("aria-expanded", "false");
          japanLayer.classList.remove("is-mobile-legend-expanded");
        }
      }
      mapSignalEncodingLegend.dataset.mode = liveExhibitId ? `live-${liveExhibitId}` : timelineState?.kind || "co2";
      if (showEncodingLegend) {
        const setEncodingLabel = (key, value) => {
          const element = mapSignalEncodingLegend.querySelector(`[data-encoding-label="${key}"]`);
          if (element) element.lastChild.textContent = value;
        };

        if (liveExhibitId) {
          const signal = globalThis.GaiaLiveExhibits?.definitions?.find(item => item.id === liveExhibitId)?.signalLabel || "選択中のモデル値";
          const labels = [`県の色 / ${signal}`, "灰色 / データなし", "値 / 代表都市のモデル値", "都道府県平均ではありません"];
          ["heatmap", "nodata", "estimate", "resolution"].forEach((key, index) => setEncodingLabel(key, labels[index]));
        } else if (sequenceState) {
          const keys = ["heatmap", "nodata", "estimate", "resolution"];
          sequenceState.legend.forEach((label, index) => setEncodingLabel(keys[index], label));
        } else if (isCirculationTimeline) {
          setEncodingLabel("heatmap", "色付き矢印 / 海流");
          setEncodingLabel("nodata", "背景の流れ / 観測点間の補間");
          setEncodingLabel("estimate", "点から伸びる線 / 仮定の移動");
          setEncodingLabel("resolution", "白い矢印 / 風（比較用）");
        } else {
          setEncodingLabel("heatmap", isStoryTemperatureInteraction ? "背景色 / 気温偏差" : "色 / CO₂濃度");
          setEncodingLabel("nodata", isStoryTemperatureInteraction ? "地図セル / CO₂濃度" : "斜線 / まわりから補った値");
          setEncodingLabel("estimate", isStoryTemperatureInteraction ? "年代 / 同じ時点" : "表示 / データの種類");
          setEncodingLabel("resolution", isStoryTemperatureInteraction ? "地点 / 地図に触れる" : "1セル / 2.5°");
        }
      }
    }
    updateMapTransformationReceipt();
  };

  const getActiveTimelineDuration = () => {
    const signalMode = getActiveSignalMode();
    const id = signalMode?.id;
    const baseDuration = id === "breathing-earth"
      ? CO2_TIMELINE_DURATION_MS
      : id === "blue-circulation"
        ? CIRCULATION_TIMELINE_DURATION_MS
        : id === "rhythm-of-disaster"
          ? getGlobalEarthquakePlaybackSchedule(signalMode?.signals?.globalEvents || []).durationMs
          : id === "three-ecologies"
            ? Math.max(1, getThreeEcologiesComparison(signalMode.signals)?.rows.length || 0) * 4000
            : id === "forest-cloud-engine"
              ? Math.max(MODE_SEQUENCE_DURATION_MS, (signalMode.signals.precipitation?.length || 0) * 2000)
            : id === "earth-organ"
              ? Math.max(1, signalMode.signals.current?.length || 0) * RENEWABLE_COUNTRY_DISPLAY_MS
              : MODE_SEQUENCE_DURATION_MS;
    if (storyModeDetour?.kind === "map01") {
      return storyModeDetour.phase !== "temperature-anomaly"
        ? baseDuration / STORY_MAP_TIMELINE_SPEED
        : baseDuration;
    }
    return id === "breathing-earth"
      ? baseDuration / CO2_EXPLORATION_TIMELINE_SPEED
      : baseDuration;
  };
  const getTimelineElapsedForPosition = (signalMode, position, duration) => {
    if (signalMode?.id === "nothing-is-waste") return wasteSelectedIndex * 4000;
    if (signalMode?.id === "rhythm-of-disaster") {
      return getGlobalEarthquakePlaybackEntry(signalMode, position).entry?.startMs || 0;
    }
    return (clamp(position, 0, 100) / 100) * duration;
  };

  const pauseMapTimeline = ({ transport = false } = {}) => {
    // Story detours keep their existing completion lifecycle; exploration stays manual.
    if (!storyModeDetour) mapTimelineManuallyPaused = true;
    co2TimelineHeld = true;
    co2TimelinePausedUntil = 0;
    ecologiesPlaying = false;
    if (!transport) globalThis.GaiaMapDemo?.stop?.("interaction");
  };

  const resumeMapTimeline = ({ transport = false } = {}) => {
    if (!japanIsOpen || storyModeDetour) return;
    mapTimelineManuallyPaused = false;
    mapTimelineExplicitPlayback = transport;
    co2TimelineHeld = false;
    co2TimelinePausedUntil = 0;
    co2TimelineLastStep = -1;
    const signalMode = getActiveSignalMode();
    if (signalMode?.id === "three-ecologies") ecologiesPlaying = true;
    co2TimelineStartedAt = performance.now() - getTimelineElapsedForPosition(signalMode, signalTimePosition, getActiveTimelineDuration());
    updateSignalInterface();
  };
  addEventListener("gaia:map-playback-resume", resumeMapTimeline);

  const resumeTimelineAfterManualSeek = (now = performance.now()) => {
    co2TimelineLastStep = -1;
    const signalMode = getActiveSignalMode();
    if (signalMode?.id !== "rhythm-of-disaster") {
      co2TimelinePausedUntil = now + CO2_TIMELINE_MANUAL_PAUSE_MS;
      return;
    }
    const { entry } = getGlobalEarthquakePlaybackEntry(signalMode, signalTimePosition);
    const continuingYear = entry?.year === earthquakeYearTransition.currentYear
      && earthquakeYearTransition.generation === mapPlotRevealGeneration
      && earthquakeYearTransition.phase === "enter";
    const leadMs = entry?.index > 0
      ? GLOBAL_EARTHQUAKE_EVENT_DISAPPEAR_MS : GLOBAL_EARTHQUAKE_INITIAL_LEAD_MS;
    const playedMs = continuingYear
      ? clamp(now - earthquakeYearTransition.changedAt + leadMs, 0, entry.durationMs - 1)
      : 0;
    // The POI sequence already plays while a year is manually selected. Anchor
    // the timeline to it instead of waiting, then replaying the entire dwell.
    co2TimelineStartedAt = now - (entry?.startMs || 0) - playedMs;
    co2TimelinePausedUntil = 0;
  };

  const destroyStoryMapAivaBackdrop = () => {
    storyMapAivaRuntime?.destroy?.();
    storyMapAivaRuntime = null;
    storyMapAivaBackdrop?.remove();
    storyMapAivaBackdrop = null;
  };

  const mountStoryMapAivaBackdrop = () => {
    destroyStoryMapAivaBackdrop();
    const shell = document.createElement("div");
    const universe = document.createElement("canvas");
    shell.className = "story-map-aiva-backdrop";
    shell.setAttribute("aria-hidden", "true");
    universe.className = "story-map-aiva-universe";
    universe.setAttribute("aria-hidden", "true");
    shell.append(universe);
    experience.append(shell);
    storyMapAivaBackdrop = shell;

    const createRuntime = () => {
      if (!shell.isConnected) return;
      storyMapAivaRuntime = globalThis.GaiaTrueEndWebGL?.create?.({
        canvas: universe,
        shell,
        onRestore: () => {
          storyMapAivaRuntime?.destroy?.();
          storyMapAivaRuntime = null;
          createRuntime();
        },
      }) || null;
      if (!storyMapAivaRuntime) {
        shell.dataset.webglState = "fallback";
        return;
      }
      shell.dataset.webglState = "active";
      void storyMapAivaRuntime.setScene?.("reconstruction", { immediate: true });
      void storyMapAivaRuntime.setPresence?.("system", {
        emphasis: true,
        signal: "map01-co2-timeline",
        immediate: true,
      });
    };

    createRuntime();
    requestAnimationFrame(() => shell.classList.add("is-visible"));
  };

  const completeStoryMapTimeline = ({ finalFrameMs = STORY_MAP_FINAL_FRAME_MS } = {}) => {
    if (storyModeDetour?.kind !== "map01" || storyModeDetour.phase === "temperature-anomaly" || storyMapTimelineCompleted) return;
    storyMapTimelineCompleted = true;
    signalTimePosition = 100;
    co2TimelineLastStep = -1;
    updateSignalInterface();
    window.clearTimeout(storyMapReturnTimer);
    storyMapReturnTimer = window.setTimeout(() => {
      storyMapReturnTimer = 0;
      if (storyModeDetour?.kind !== "map01") return;
      window.dispatchEvent(new CustomEvent("gaia:story-mode-auto-complete", {
        detail: { kind: "map01", view: "timeline_complete" },
      }));
    }, finalFrameMs);
  };

  const restartCo2Timeline = (position = 0) => {
    const now = performance.now();
    const activeId = getActiveSignalMode()?.id;
    const reducedMotionPosition = activeId === "breathing-earth"
      ? ((2025.9 - CO2_TIMELINE_START_YEAR) /
          (CO2_TIMELINE_END_YEAR - CO2_TIMELINE_START_YEAR)) *
        100
      : activeId === "blue-circulation"
        ? 50
        : 0;
    signalTimePosition = clamp(reducedMotion ? reducedMotionPosition : position, 0, 100);
    const activeSignalMode = getActiveSignalMode();
    if (activeId === "three-ecologies") {
      ecologiesPlaying = false;
      ecologiesExhibit?.reset();
      const rows = getThreeEcologiesComparison(activeSignalMode.signals)?.rows || [];
      const japanIndex = Math.max(0, rows.findIndex(row => row.iso3 === "JPN"));
      signalTimePosition = ((japanIndex + .5) / Math.max(1, rows.length)) * 100;
    }
    const timelineDuration = getActiveTimelineDuration();
    co2TimelineStartedAt = now - getTimelineElapsedForPosition(
      activeSignalMode,
      signalTimePosition,
      timelineDuration,
    );
    co2TimelinePausedUntil = 0;
    co2TimelineLastStep = -1;
    co2TimelineHeld = false;
    mapTimelineManuallyPaused = false;
    earthquakeYearTransition.generation = -1;
    earthquakeYearTransition.currentYear = "";
    earthquakeYearTransition.currentEvents = [];
    earthquakeYearTransition.pendingYear = "";
    earthquakeYearTransition.pendingEvents = [];
    earthquakeYearTransition.phase = "enter";
    earthquakeYearTransition.exitStartReveals = [];
    earthquakeYearTransition.exitOrderIndices = [];
    gosatHeatmapCacheKey = "";
    updateSignalInterface();
  };

  const updateCo2TimelineAnimation = (now) => {
    const signalMode = getActiveSignalMode();
    const isTimelineMode = Boolean(signalMode);
    const reducedMotionStillAdvances = signalMode?.id === "rhythm-of-disaster";
    if (
      (reducedMotion && !reducedMotionStillAdvances && !mapTimelineExplicitPlayback) ||
      !japanIsOpen ||
      !isTimelineMode ||
      (signalMode.id === "three-ecologies" && !ecologiesPlaying) ||
      co2TimelineHeld
    ) return;

    // This slider selects countries, not years. Advance the actual selection
    // and let the shared interface update its thumb and country readout together.
    if (signalMode.id === "nothing-is-waste") {
      const count = signalMode.signals.countryWaste?.length || 0;
      if (!count) return;
      const index = Math.floor(Math.max(0, now - co2TimelineStartedAt) / 4000) % count;
      if (index !== wasteSelectedIndex) {
        wasteSelectedIndex = index;
        signalTimePosition = count > 1 ? index / (count - 1) * 100 : 0;
        updateSignalInterface();
      }
      return;
    }
    const duration = getActiveTimelineDuration();

    if (co2TimelinePausedUntil > 0) {
      if (now < co2TimelinePausedUntil) return;
      co2TimelineStartedAt = now - getTimelineElapsedForPosition(
        signalMode,
        signalTimePosition,
        duration,
      );
      co2TimelinePausedUntil = 0;
    }

      const totalSteps = signalMode.id === "breathing-earth"
        ? (CO2_TIMELINE_END_YEAR - CO2_TIMELINE_START_YEAR) *
          CO2_TIMELINE_STEPS_PER_YEAR
        : signalMode.id === "blue-circulation"
          ? CIRCULATION_TIMELINE_STEPS
          : signalMode.id === "rhythm-of-disaster"
            ? GLOBAL_EARTHQUAKE_YEAR_COUNT
            : signalMode.id === "earth-organ"
              ? Math.max(1, signalMode.signals.current?.length || 0)
              : signalMode.id === "three-ecologies"
                ? Math.max(1, getThreeEcologiesComparison(signalMode.signals)?.rows.length || 0)
                : MODE_SEQUENCE_STEPS;
    const elapsed = now - co2TimelineStartedAt;
    if (storyModeDetour?.kind === "map01" && storyModeDetour.phase !== "temperature-anomaly" && elapsed >= duration) {
      completeStoryMapTimeline();
      return;
    }
    const loopElapsed = ((elapsed % duration) + duration) % duration;
    const loopProgress = loopElapsed / duration;
    const earthquakeSchedule = signalMode.id === "rhythm-of-disaster"
      ? getGlobalEarthquakePlaybackSchedule(signalMode.signals.globalEvents || [])
      : null;
    const step = earthquakeSchedule
      ? earthquakeSchedule.entries.find(({ endMs }) => loopElapsed < endMs)?.index
        ?? Math.max(0, earthquakeSchedule.entries.length - 1)
      : Math.floor(loopProgress * totalSteps);
    // Continuous timelines move the thumb every rendered frame, while heavier
    // labels/data panels still refresh at their existing observation steps.
    const continuous = !earthquakeSchedule && !["earth-organ", "three-ecologies"].includes(signalMode.id);
    if (continuous) {
      signalTimePosition = loopProgress * 100;
      signalTimeInputs.forEach(input => { input.value = String(signalTimePosition); });
    }
    if (step === co2TimelineLastStep) return;
    co2TimelineLastStep = step;
    // Use the interior of a year bin: 9 / 27 * 100 rounds below the 2009
    // boundary, otherwise replaying 2008's completed overview for another year.
    signalTimePosition = earthquakeSchedule
      ? ((step + 0.5) / earthquakeSchedule.entries.length) * 100
      : ["earth-organ", "three-ecologies"].includes(signalMode.id)
        ? ((step + .5) / totalSteps) * 100
        : loopProgress * 100;
    updateSignalInterface();
    if (signalMode.id === "three-ecologies" && ecologiesPlaying) {
      const row = getThreeEcologiesComparison(signalMode.signals)?.rows[step];
      if (row) focusEcologiesLocation(row, "ecologies-playback");
    }
  };

  const DATA_TRANSFORMS = Object.freeze({
    "breathing-earth": `// SPATIAL IMPUTATION / DERIVED
// Keep every observed cell; fill only null cells with k=8 inverse-distance weights.
const donors = nearestObservedCells(cell, 8, { wrapLongitude: true });
const imputed = sum(donors, d => d.value / d.distance ** 2)
              / sum(donors, d => 1 / d.distance ** 2);
// Validation: hide up to 128 observed cells, predict them, report RMSE and MAE.

const year = mix(1958, 2050, timelinePosition);

if (year < firstGosatYear) {
  value = earliestGosatPattern + (noaaBaseline(year) - earliestGridMean); // DERIVED
} else if (year <= lastGosatYear) {
  value = linearInterpolate(imputedGosatFrames, year); // DERIVED
} else {
  // OLS on the latest 120 deseasonalized NOAA monthly observations.
  // y_hat(t) = y_bar + beta1 * (t - t_bar)
  const projection = olsTrend.predict(year, { predictionInterval: 0.95 });
  value = lastGosatGrid + projection.changeSince(lastGosatYear); // SCENARIO
  showPredictionInterval(projection.lower95, projection.upper95);
}

drawGridCell(lon, lat, 2.5, fixedColorScale(value, 300, 500), {
  hatch: cell.wasSpatiallyImputed,
});
// The OLS projection assumes an unchanged linear trend; it is not a climate model.

// SOURCE: NOAA SWPC OVATION 30–90 minute forecast, refreshed every five minutes.
// The grid remains a forecast/model layer: cloud and daylight visibility are not inferred.
drawSoftPolarRibbon(ovationAuroraGrid, {
  palette: ["emerald", "cyan", "pale-gold"],
  composite: "screen",
});`,
    "blue-circulation": `// SOURCE: NOAA CoastWatch daily u/v snapshot (OSCAR timeout fallback)
const speedMs = Math.hypot(uMs, vMs);
drawSpeedHalo(fixedColorScale(speedMs, 0, 1.5));

// DERIVED: local constant-vector transport, 0–14 days
const seconds = timelineDays * 24 * 60 * 60;
const deltaLat = vMs * seconds / 111320;
const deltaLon = uMs * seconds / (111320 * Math.cos(latitudeRadians));
drawActualScaleTrack(lon, lat, lon + deltaLon, lat + deltaLat);

// NASA POWER wind climatology stays a separate white-arrow layer.
// This is not an ocean forecast or a drift prediction.`,
    "forest-cloud-engine": `const selectedSite = precipitationSites[sequenceIndex];
const vaporDensity = normalize(selectedSite.precipitationMmDay, 0, 8);
drawLargeRainCircle(selectedSite, vaporDensity); // larger diameter = more mm/day
drawMercatorRaster(modisIgbpLandCover2023); // GLOBAL rendered classification
// Reference points across countries/territories, not national averages or a causal model.`,
    "pollination-protocol": `const stages = ["records", "sampling", "relations"];
drawGbifObservationPoints(gbifOccurrences); // records, not a habitat map
showSamplingRule("31 selected countries", "max 2 records per country");

const documented = globi.filter(row => row.interaction === "pollinates");
drawNonGeographicRelationNetwork(documented); // no location, frequency, or strength
// A blank map area is not absence. Never connect a GloBI relation to a GBIF point.`,
    "nothing-is-waste": `const observed = latestPublishedCountryValues(unSdgAllPages); // SOURCE
// Exclude regional aggregates; keep missing countries missing, never zero or neighbor-filled.
// Percentages outside 0–100 remain in the source audit, not clamped into the map.
const country = observed[countrySelectorIndex]; // slider or arrow buttons
drawCountryChoropleth(observed, { key: "recyclePercent", range: [0, 100], palette: "blue" });
highlightCountry(country.iso3); // Selection changes the outline, not the percentage.
// Reporting years and definitions differ; source estimates retain Nature/footnotes.
showCountryValue({
  country: country.country,
  recyclePercent: country.recyclePercent,
  year: country.year,
  sourceStatus: country.valueStatus, // Published by UN, not necessarily direct measurement
});`,
    "anthropocene-scar": `const year = mix(1945, 2023, timelinePosition);
const countryValues = gcpFossilCo2.filter(row => row.year === year);
for (const country of countryValues) {
  drawEmissionRing(Math.log10(country.emissionsMtCo2)); // COUNTRY VALUE / year snapshot
}

const viirsGeographic = projectWebMercatorRasterToGeographic(viirsNightLights2016);
drawRadianceGlow(viirsGeographic); // FIXED 2016 REFERENCE; not historical night lights
const nightLightOpacity = longPress ? 0.04 : 0.5;
// Night-light radiance is never converted to emissions.`,
    "rhythm-of-disaster": `const years = groupByYear(usgsM75Since2000); // 2000–2026\nconst events = years[selectedYear].sort(byOccurredAt); // this year only; default view is global\nfor (const [index, event] of events.entries()) {\n  await delay(index * 220); // reveal chronologically, one epicenter at a time\n  const feltRadiusKm = estimateFeltRadiusKm(event.magnitude); // M7.5 ≈ 500 km; M9.1 ≈ 2,000 km\n  const durationMs = scale(feltRadiusKm, 500, 2000, 2200, 3600);\n  drawEstimatedFeltRing(event, feltRadiusKm, durationMs);\n}\n// Estimated felt radius is not a ShakeMap, damage zone, or tsunami extent.\n// Only the optional JMA detail layer owns observed intensity:\nconst distanceKm = Math.hypot(greatCircleKm(epicenter, station), depthKm);\nconst pArrivalSec = distanceKm / 7.0;\nconst sArrivalSec = distanceKm / 4.0;\nif (elapsedSec >= sArrivalSec) drawObservedJmaIntensity(station.intensity);`,
    "three-ecologies": `const paired = joinByIso3(countryForestPercent, countryUrbanPercent); // same countries only
const relation = pearson(paired.map(row => [row.urbanPercent, row.forestPercent]));
const trend = linearRegression(paired); // display the tendency and each residual
drawPairedBars(paired, { green: "forest / land", blue: "urban / people", range: [0, 100] });
if (view === "pattern") drawScatterPlot(paired, trend, relation); // x = urban %, y = forest %

compare(selected, nearestUrbanShareCountry(selected)); // same 0–100% rails; no automatic country change
if (view === "culture") drawMemoryContext(unescoGlobalSample); // separate view, excluded from r
// COUNTRY VALUES with different latest years. Correlation is not causation.`,
    "earth-organ": `const countries = joinByIso3(countryRenewableShare, naturalEarthCountries);
drawCountryChoropleth(countries, { scale: "dark-blue 0% → cyan 100%" });
const selected = countries.slice().sort((a, b) => b.renewablePercent - a.renewablePercent)[sequenceIndex];
drawSelectedPotential(selected.solarKwhM2Day, selected.windSpeedMs);
// Solar and wind are context, not a causal model of the current electricity share.`,
    "population-tide": `const year = mix(1960, 2025, timelinePosition);
const countryValues = worldBankPopulation.filter(row => row.year === year);
const reference = 1_500_000_000; // fixed for every year, never the selected-year maximum
const referenceRadius = clamp(mapWidth * 0.065, 86, 240);
for (const country of countryValues) {
  const radius = Math.sqrt(country.population / reference) * referenceRadius;
  drawPopulationCircle(country, radius); // circle area ∝ population
}
// Representative country points: not cities, population density, or environmental load.`,
  });

  const renderCodeLines = (text) => {
    sourceCode.replaceChildren();
    const fragment = document.createDocumentFragment();

    for (const line of text.split("\n")) {
      const lineElement = document.createElement("span");
      lineElement.className = "code-line";
      lineElement.textContent = line || " ";
      fragment.append(lineElement);
    }
    sourceCode.append(fragment);
  };

  const renderSource = () => {
    const mode = modes[modeToIndex];
    const signalMode = getActiveSignalMode();
    sourceTabs.forEach((tab) =>
      tab.setAttribute("aria-selected", tab.dataset.sourceTab === activeSourceTab ? "true" : "false"),
    );
    if (activeSourceTab === "transform") {
      renderCodeLines(DATA_TRANSFORMS[mode.id] || "// No transform registered.");
      sourceFile.textContent = `${formatModeNumber(modeToIndex)}-${mode.id}.transform.js`;
      sourceLanguage.textContent = "VANILLA JAVASCRIPT";
    } else if (activeSourceTab === "raw") {
      const rawPreview = signalMode
        ? {
            notice: "FIRST 10 ROWS PER DATASET / full snapshot: data/gaia-signals.json",
            statisticalMethods: signalMode.statisticalMethods || [],
            statisticalPolicy: gaiaSnapshot?.statisticalPolicy || null,
            datasets: signalMode.datasets.map((dataset) => ({
              id: dataset.id,
              kind: dataset.kind,
              organisation: dataset.organisation,
              url: dataset.url,
              unit: dataset.unit,
              resolution: dataset.resolution,
              preview: (dataset.preview || []).slice(0, 10),
            })),
          }
        : {
            state: gaiaSnapshotError ? "公開データの読み込みエラー" : "公開データを読み込み中",
            error: gaiaSnapshotError || undefined,
          };
      renderCodeLines(
        JSON.stringify(rawPreview, null, 2),
      );
      sourceFile.textContent = `${formatModeNumber(modeToIndex)}-${mode.id}.snapshot.json`;
      sourceLanguage.textContent = "JSON / FIRST-PARTY SNAPSHOT";
    } else {
      renderCodeLines(mode.source);
      sourceFile.textContent = `${formatModeNumber(modeToIndex)}-${mode.id}.frag`;
      sourceLanguage.textContent = "GLSL ES 3.00";
    }
    sourceTitle.textContent = mode.title;
  };

  const loadGaiaSignals = async ({ all = false, modeId = modes[modeToIndex].dataModeId || modes[modeToIndex].id } = {}) => {
    if (gaiaAllSignalsLoaded || (!all && gaiaModeById.has(modeId))) return gaiaSnapshot;
    const key = all ? "all" : modeId;
    if (gaiaSignalLoads.has(key)) return gaiaSignalLoads.get(key);
    const loading = (async () => {
    try {
      gaiaSnapshotError = null;
      const snapshot = await (all ? snapshotStore.load() : snapshotStore.loadMode(modeId));
      for (const mode of snapshot.modes) gaiaModeById.set(mode.id, mode);
      gaiaSnapshot = { ...snapshot, modes: [...gaiaModeById.values()] };
      if (all) gaiaAllSignalsLoaded = true;
      if (all || modeId === (modes[modeToIndex].dataModeId || modes[modeToIndex].id)) {
        updateModeInterface();
        window.dispatchEvent(new CustomEvent("gaia:signals-ready", { detail: { modeId, all } }));
      }
      return gaiaSnapshot;
    } catch (error) {
      // Navigation owns this cancellation; timeouts and failures while the
      // application is still active must retain their normal error reporting.
      if (snapshotOwnerDisposed && error?.name === "AbortError") return null;
      console.error(error);
      if (all || modeId === (modes[modeToIndex].dataModeId || modes[modeToIndex].id)) {
        gaiaSnapshotError = error instanceof Error ? error.message : String(error);
        updateSignalInterface();
        window.dispatchEvent(new CustomEvent("gaia:signals-error", { detail: { error: gaiaSnapshotError } }));
      }
      return null;
    } finally { gaiaSignalLoads.delete(key); }
    })();
    gaiaSignalLoads.set(key, loading);
    return loading;
  };

  const loadNaturalEarthLand = async () => {
    try {
      naturalEarthLandState = "loading";
      naturalEarthLandError = null;
      updateMapBasisNote();
      const response = await fetch(NATURAL_EARTH_LAND_DATA, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Natural Earth land ${response.status}`);
      const geojson = await response.json();
      const rings = [];

      for (const feature of geojson.features || []) {
        const { geometry } = feature;
        if (!geometry) continue;
        const polygons = geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.type === "MultiPolygon"
            ? geometry.coordinates
            : [];
        for (const polygon of polygons) {
          for (const ring of polygon) {
            if (Array.isArray(ring) && ring.length >= 3) rings.push(ring);
          }
        }
      }

      if (rings.length < 1000) {
        throw new Error(`Natural Earth geometry incomplete (${rings.length} rings)`);
      }
      naturalEarthLandRings = rings;
      naturalEarthPathCache.clear();
      naturalEarthLandState = "ready";
      updateMapBasisNote();
    } catch (error) {
      console.error(error);
      naturalEarthLandError = error instanceof Error ? error.message : String(error);
      naturalEarthLandState = "error";
      updateMapBasisNote();
    }
  };

  const loadNaturalEarthCountries = async () => {
    try {
      naturalEarthCountryState = "loading";
      naturalEarthCountryError = null;
      const response = await fetch(NATURAL_EARTH_COUNTRY_DATA, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Natural Earth countries ${response.status}`);
      const geojson = await response.json();
      const countryRings = new Map();
      const countryRecords = new Map();
      const boundaryRings = [];

      for (const feature of geojson.features || []) {
        const { geometry, properties = {} } = feature;
        if (!geometry) continue;
        const polygons = geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.type === "MultiPolygon"
            ? geometry.coordinates
            : [];
        for (const polygon of polygons) {
          for (const ring of polygon) {
            if (Array.isArray(ring) && ring.length >= 3) boundaryRings.push(ring);
          }
        }
        const iso3 = [properties.ADM0_A3, properties.ISO_A3, properties.SOV_A3, properties.BRK_A3, properties.WB_A3]
          .find((code) => typeof code === "string" && /^[A-Z]{3}$/.test(code) && code !== "-99");
        if (!iso3) continue;
        // FAOSTAT uses numeric M49 IDs. Keep each feature's own identity; do
        // not transfer a territory or historical country's value to a parent.
        // Natural Earth's explicit EH identity restores France and Norway,
        // whose primary ISO fields are -99, without borrowing sovereign codes.
        const primaryM49 = /^[0-9]{3}$/.test(String(properties.ISO_N3)) && properties.ISO_A3 !== "-99" ? String(properties.ISO_N3) : null;
        const equivalentM49 = properties.ADM0_A3 === properties.ISO_A3_EH && /^[0-9]{3}$/.test(String(properties.ISO_N3_EH)) ? String(properties.ISO_N3_EH) : null;
        const m49 = primaryM49 || equivalentM49;
        if (m49 && m49 !== "010" && !countryRecords.has(m49)) {
          const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
          for (const polygon of polygons) for (const ring of polygon) for (const [lon,lat] of ring) {
            bounds.left = Math.min(bounds.left,lon+180); bounds.right = Math.max(bounds.right,lon+180);
            bounds.top = Math.min(bounds.top,90-lat); bounds.bottom = Math.max(bounds.bottom,90-lat);
          }
          countryRecords.set(m49, Object.freeze({ id: m49, iso3, lon: properties.LABEL_X, lat: properties.LABEL_Y, bounds: Object.freeze(bounds) }));
        }
        const rings = countryRings.get(iso3) || [];
        for (const polygon of polygons) {
          for (const ring of polygon) {
            if (Array.isArray(ring) && ring.length >= 3) rings.push(ring);
          }
        }
        if (rings.length) countryRings.set(iso3, rings);
      }

      if (countryRings.size < 200) {
        throw new Error(`Natural Earth country geometry incomplete (${countryRings.size} countries)`);
      }
      if (boundaryRings.length < 400) {
        throw new Error(`Natural Earth boundary geometry incomplete (${boundaryRings.length} rings)`);
      }
      naturalEarthCountryRings = countryRings;
      naturalEarthCountryRecords = Object.freeze([...countryRecords.values()]);
      naturalEarthCountryBoundaryRings = boundaryRings;
      naturalEarthCountryPathCache.clear();
      naturalEarthCountryState = "ready";
      referenceWorldCacheKey = "";
      japanTilesDirty = true;
      updateMapBasisNote();
    } catch (error) {
      console.error(error);
      naturalEarthCountryError = error instanceof Error ? error.message : String(error);
      naturalEarthCountryState = "error";
      referenceWorldCacheKey = "";
      updateMapBasisNote();
    }
  };

  const loadJapanPrefectureBoundaries = async () => {
    try {
      japanPrefectureBoundaryState = "loading";
      japanPrefectureBoundaryError = null;
      updateMapBasisNote();
      const response = await fetch(JAPAN_PREFECTURE_DATA, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Japan prefectures ${response.status}`);
      const topology = await response.json();
      const geometries = topology?.objects?.japan?.geometries || [];
      const topologyArcs = topology?.arcs || [];
      const scale = topology?.transform?.scale;
      const translate = topology?.transform?.translate;
      if (topology?.type !== "Topology" || geometries.length !== 47
        || !Array.isArray(scale) || !Array.isArray(translate)) {
        throw new Error("Japan prefecture topology is incomplete");
      }

      const referencedArcIndexes = new Set();
      const collectArcIndexes = (value) => {
        if (Number.isInteger(value)) {
          referencedArcIndexes.add(value < 0 ? ~value : value);
          return;
        }
        if (Array.isArray(value)) value.forEach(collectArcIndexes);
      };
      geometries.forEach(({ arcs }) => collectArcIndexes(arcs));

      const decodedArcs = [];
      for (const arcIndex of referencedArcIndexes) {
        const rawArc = topologyArcs[arcIndex];
        if (!Array.isArray(rawArc) || rawArc.length < 2) continue;
        let x = 0;
        let y = 0;
        const arc = rawArc.map(([deltaX, deltaY]) => {
          x += deltaX;
          y += deltaY;
          return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
        });
        if (arc.every(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))) {
          decodedArcs.push(arc);
        }
      }
      if (decodedArcs.length < 1000) {
        throw new Error(`Japan prefecture boundary geometry incomplete (${decodedArcs.length} arcs)`);
      }

      japanPrefectureBoundaryArcs = decodedArcs;
      japanPrefectureBoundaryPathCache.clear();
      japanPrefectureBoundaryState = "ready";
      referenceWorldCacheKey = "";
      japanTilesDirty = true;
      updateMapBasisNote();
    } catch (error) {
      console.error(error);
      japanPrefectureBoundaryError = error instanceof Error ? error.message : String(error);
      japanPrefectureBoundaryState = "error";
      referenceWorldCacheKey = "";
      updateMapBasisNote();
    }
  };

  sourceTabs.forEach((button) => {
    button.addEventListener("click", () => {
      activeSourceTab = button.dataset.sourceTab;
      sourceTabs.forEach((tab) =>
        tab.setAttribute("aria-selected", tab === button ? "true" : "false"),
      );
      renderSource();
    });
  });

  signalTimeInputs.forEach((input) => {
    input.addEventListener("pointerdown", () => { if (!storyModeDetour) pauseMapTimeline(); });
    input.addEventListener("keydown", (event) => {
      if (!storyModeDetour && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) pauseMapTimeline();
    });
    input.addEventListener("input", () => {
      const activeSignalMode = getActiveSignalMode();
      const isWasteCountrySelector = activeSignalMode?.id === "nothing-is-waste";
      if (isWasteCountrySelector) {
        const rowCount = activeSignalMode.signals.countryWaste?.length || 1;
        wasteSelectedIndex = clamp(Math.round(Number(input.value)), 0, rowCount - 1);
        signalTimePosition = rowCount > 1
          ? (wasteSelectedIndex / (rowCount - 1)) * 100
          : 0;
      } else if (activeSignalMode?.id === "earth-organ") {
        const rowCount = activeSignalMode.signals.current?.length || 1;
        const index = clamp(Math.round(Number(input.value)), 0, rowCount - 1);
        signalTimePosition = ((index + .5) / rowCount) * 100;
      } else {
        signalTimePosition = Number(input.value);
      }
      if (japanIsOpen) {
        if (getActiveSignalMode()?.id === "three-ecologies") ecologiesPlaying = false;
        if (storyModeDetour) {
          co2TimelineHeld = storyModeDetour.phase === "temperature-anomaly";
          resumeTimelineAfterManualSeek();
        } else {
          pauseMapTimeline();
          closeJapanPoi();
          clearJapanPoiHover();
        }
      }
      signalTimeInputs.forEach((peer) => {
        if (peer !== input) peer.value = String(isWasteCountrySelector ? wasteSelectedIndex : signalTimePosition);
      });
      if (storyModeDetour?.kind === "map01") storyModeDetour.views.add("long_term");
      updateSignalInterface();
      if (storyModeDetour?.kind === "map01") {
        window.dispatchEvent(new CustomEvent("gaia:story-map-interaction", {
          detail: { kind: "map01", view: "long_term", position: signalTimePosition },
        }));
      }
    });
  });

  const renderConcept = () => {
    const mode = modes[modeToIndex];
    const concept = modeConcepts[mode.id];
    const position = `${formatModeNumber(modeToIndex)} / ${MODE_COUNT}`;

    conceptNumber.textContent = position;
    conceptPosition.textContent = position;
    conceptTitle.textContent = mode.titleJa;
    conceptTitleEn.textContent = mode.title;
    conceptLead.textContent = concept.lead;
    conceptSeeing.textContent = `${concept.seeing}\n\n${modeDataNarratives[mode.id]}`;
    conceptTouch.textContent = concept.touch;
    conceptContext.textContent = `${concept.context}\n\n${lectureResumeLinks[mode.id]}`;
    conceptQuestion.textContent = concept.question;
  };

  const clearIntroPanelReveal = () => {
    introRevealGeneration += 1;
    introRevealTimers.forEach((timer) => window.clearTimeout(timer));
    introRevealTimers.clear();
    [...introPathButtons, ...introModeButtons].forEach((panel) => {
      panel.classList.remove("is-awaiting-reveal", "is-depth-arriving");
    });
  };

  const setIntroVisual = (key = "default") => {
    const selectedKey = introVisuals.some((visual) => visual.dataset.introVisual === key)
      ? key
      : "default";
    introLayer.dataset.preview = selectedKey;
    introVisuals.forEach((visual) => {
      visual.classList.toggle("is-active", visual.dataset.introVisual === selectedKey);
    });
  };

  const revealIntroPanels = (stageElement) => {
    clearIntroPanelReveal();
    const generation = introRevealGeneration;
    const panels = Array.from(
      stageElement.querySelectorAll(".intro-path-card, .intro-mode-choice"),
    );
    if (reducedMotion || panels.length === 0) return;

    panels.forEach((panel) => panel.classList.add("is-awaiting-reveal"));
    requestAnimationFrame(() => {
      panels.forEach((panel, index) => {
        const jitter = index ? (index * 11) % 17 : 0;
        const timer = window.setTimeout(() => {
          introRevealTimers.delete(timer);
          if (generation !== introRevealGeneration || !panel.isConnected) return;
          panel.classList.remove("is-awaiting-reveal");
          panel.classList.add("is-depth-arriving");
          const cleanupTimer = window.setTimeout(() => {
            introRevealTimers.delete(cleanupTimer);
            if (panel.isConnected) panel.classList.remove("is-depth-arriving");
          }, 820);
          introRevealTimers.add(cleanupTimer);
        }, 80 + index * 52 + jitter);
        introRevealTimers.add(timer);
      });
    });
  };

  const animateIntroStage = (stageElement, { revealPanels = true } = {}) => {
    stageElement.classList.remove("is-entering");
    if (revealPanels) {
      revealIntroPanels(stageElement);
    } else {
      clearIntroPanelReveal();
    }
    if (reducedMotion) return;
    void stageElement.offsetWidth;
    stageElement.classList.add("is-entering");
  };

  const showIntroStage = (stage, { focus = true, revealPanels = true } = {}) => {
    introStage = stage;
    const showingPath = stage === "path";
    introPathStage.hidden = !showingPath;
    introSenseStage.hidden = showingPath;
    introPathBack.hidden = showingPath;
    introLayer.scrollTop = 0;
    introLayer.scrollLeft = 0;
    setIntroVisual(showingPath ? "default" : introSelectedPath);
    const visibleStage = showingPath ? introPathStage : introSenseStage;
    animateIntroStage(visibleStage, { revealPanels });
    if (!focus) return;
    requestAnimationFrame(() => {
      const target = showingPath
        ? introPathButtons[0]
        : introModeButtons.find((button) => button.getAttribute("aria-selected") === "true" && !button.hidden)
          || introPathBack;
      target?.focus({ preventScroll: true });
      if (showingPath) setIntroVisual("default");
    });
  };

  const selectIntroPath = (path) => {
    const pathConfig = INTRO_PATHS[path];
    if (!pathConfig) return;
    introSelectedPath = path;
    introLayer.dataset.path = path;
    setIntroVisual(path);
    introPathButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.introPath === path));
    });
    introPathKicker.textContent = pathConfig.kicker;
    introSenseTitle.innerHTML = pathConfig.title;
    introSenseLead.textContent = pathConfig.lead;
    introSelectionPrompt.textContent = pathConfig.prompt;
    introPathNote.textContent = pathConfig.note;
    updateIntroSelection();
    showIntroStage("sense");
  };

  const enterIntroSelection = (event = null) => {
    const selectedPath = introSelectedPath;
    if (!INTRO_PATHS[selectedPath]) return;
    runSceneTransition(async () => {
      if (selectedPath === "abstract") {
        closeIntro();
        return;
      }
      if (selectedPath === "map") {
        closeIntro({ restoreFocus: false });
        openJapan({ respectUrlMode: false });
        return;
      }
      if (selectedPath === "space") {
        closeIntro({ restoreFocus: false });
        window.dispatchEvent(new CustomEvent("gaia:space-open-at-mode", {
          detail: { index: modeToIndex % SPACE_MODE_CHOICES.length },
        }));
        return;
      }
      await window.GaiaModeLoader?.load?.("story");
      closeIntro({ restoreFocus: false });
      if (window.GaiaNovel?.open) {
        await window.GaiaNovel.open(null, { autoStartFresh: true });
      } else {
        window.dispatchEvent(new CustomEvent("gaia:novel-open-at-mode", {
          detail: { index: modeToIndex, source: "title-menu" },
        }));
      }
    }, selectedPath, event);
  };

  const INTRO_SCRAMBLE_ALPHABET = Array.from(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/:.-+◇○△□",
  );

  const revealIntroText = (target, finalText, duration, delay, generation) => {
    const characters = Array.from(finalText);
    const startedAt = performance.now() + delay;

    const draw = (now) => {
      if (generation !== introScrambleGeneration) return;
      if (now < startedAt) {
        requestAnimationFrame(draw);
        return;
      }

      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const settledCount = Math.floor(characters.length * eased);
      target.textContent = characters
        .map((character, index) => {
          if (
            index < settledCount ||
            /[\s、。・「」『』（）()／/:：—–-]/u.test(character)
          ) {
            return character;
          }
          return INTRO_SCRAMBLE_ALPHABET[
            Math.floor(Math.random() * INTRO_SCRAMBLE_ALPHABET.length)
          ];
        })
        .join("");
      target.classList.remove("is-intro-scramble-pending");

      if (progress < 1) {
        requestAnimationFrame(draw);
      } else {
        target.textContent = finalText;
        if (target === introSelectionCopy) {
          introSelectionPreview.setAttribute("aria-busy", "false");
        }
      }
    };

    requestAnimationFrame(draw);
  };

  const animateIntroSelectionText = (number, title, copy) => {
    introScrambleGeneration += 1;
    const generation = introScrambleGeneration;

    introSelectionPreview.classList.remove("is-decoding");
    if (reducedMotion) {
      introSelectionNumber.classList.remove("is-intro-scramble-pending");
      introSelectionTitle.classList.remove("is-intro-scramble-pending");
      introSelectionCopy.classList.remove("is-intro-scramble-pending");
      introSelectionNumber.textContent = number;
      introSelectionTitle.textContent = title;
      introSelectionCopy.textContent = copy;
      introSelectionPreview.setAttribute("aria-busy", "false");
      return;
    }

    void introSelectionPreview.offsetWidth;
    introSelectionNumber.classList.add("is-intro-scramble-pending");
    introSelectionTitle.classList.add("is-intro-scramble-pending");
    introSelectionCopy.classList.add("is-intro-scramble-pending");
    introSelectionPreview.classList.add("is-decoding");
    introSelectionPreview.setAttribute("aria-busy", "true");
    revealIntroText(introSelectionNumber, number, 280, 0, generation);
    revealIntroText(introSelectionTitle, title, 440, 35, generation);
    revealIntroText(introSelectionCopy, copy, 680, 90, generation);
  };

  const updateIntroSelection = (previewIndex = modeToIndex) => {
    const choices = introSelectedPath === "space" ? SPACE_MODE_CHOICES : INTRO_MODE_CHOICES;
    const normalizedIndex = ((previewIndex % choices.length) + choices.length) % choices.length;
    const choice = choices[normalizedIndex];
    if (!choice) return;

    animateIntroSelectionText(
      `${formatModeNumber(normalizedIndex)} / ${choice.code}`,
      `${choice.label}の声`,
      choice.copy,
    );
    introPathBack.hidden = introStage === "path";
    introModeButtons.forEach((button, index) => {
      const option = choices[index];
      const label = button.querySelector("strong");
      const cue = button.querySelector("small");
      button.hidden = !option;
      button.disabled = !option;
      if (option && label && cue) {
        label.textContent = option.label;
        cue.textContent = option.cue;
        button.setAttribute(
          "aria-label",
          `${formatModeNumber(index)} ${option.label}、${option.cue}`,
        );
      }
      button.setAttribute("aria-selected", option && index === normalizedIndex ? "true" : "false");
      button.tabIndex = option && index === normalizedIndex ? 0 : -1;
    });
  };

  const updateModeInterface = () => {
    const mode = modes[modeToIndex];
    const selectedMapMode = modes[mapModeIndex];
    const extensionOwnsMap = japanLayer.matches(".is-live-exhibit, .is-estat-exhibit, .is-firms-exhibit, .is-planet-signals-exhibit, .is-marine-cod-exhibit, .is-food-exhibit");
    modeNumber.textContent = formatModeNumber(modeToIndex);
    modeTitle.textContent = mode.title;
    modeTitleJa.textContent = mode.titleJa;
    modeDescription.textContent = mode.description;
    experience.style.setProperty("--accent", mode.accent);
    experience.style.setProperty("--accent-rgb", mode.rgb);
    // The original snapshot may finish loading after the featured entry opens.
    // Refresh its background state without replacing the active provider's UI.
    if (!extensionOwnsMap) {
      japanLayer.style.setProperty("--map-accent", mode.id === "population-tide" ? POPULATION_MAP_STYLE.accent : mode.accent);
      japanLayer.style.setProperty("--map-accent-rgb", mode.id === "population-tide" ? POPULATION_MAP_STYLE.accentRgb : mode.rgb);
      japanLayer.classList.toggle("is-earthquake-mode", isTheme(5));
      japanModeNumber.textContent = formatMapModeNumber(mapModeIndex);
      japanModeTitle.textContent = selectedMapMode.titleJa;
      japanModeBank.dataset.activeMode = formatMapModeNumber(mapModeIndex);
      const mapHeadingNumber = formatMapModeNumber(mapModeIndex);
      const mapTitleChanged = japanTitle.textContent !== selectedMapMode.titleJa
        || japanTitle.dataset.exhibitNumber !== mapHeadingNumber;
      japanTitle.dataset.exhibitNumber = mapHeadingNumber;
      japanTitle.textContent = selectedMapMode.titleJa;
      japanTitle.setAttribute("aria-label", `${mapHeadingNumber} ${selectedMapMode.titleJa}`);
      if (mapTitleChanged) animateMapTitleTransition(`${mapHeadingNumber}　${selectedMapMode.titleJa}`);
    }
    document.querySelector('meta[name="theme-color"]').setAttribute("content", "#03070d");

    modeButtons.forEach((button, index) => {
      button.setAttribute("aria-current", index === modeToIndex ? "true" : "false");
    });
    conceptModeButtons.forEach((button, index) => {
      button.setAttribute("aria-current", index === modeToIndex ? "true" : "false");
    });
    japanModeButtons.forEach((button, index) => {
      button.setAttribute("aria-current", !extensionOwnsMap && index === mapModeIndex ? "true" : "false");
    });
    updateIntroSelection();

    renderSource();
    renderConcept();
    if (extensionOwnsMap) return;
    updateSignalInterface();
    const signalMode = getActiveSignalMode();
    if (
      signalMode?.id === "forest-cloud-engine"
      && japanOverlay.dataset.forestMask !== "ready"
      && japanOverlay.dataset.forestMask !== "fallback"
    ) {
      scheduleForestRasterPreparation();
    }
    if (signalMode && gaiaSnapshot) {
      updateMapObservationNarrative();
      dataLedger.updateMode(
        { ...signalMode, titleJa: mode.titleJa },
        formatMapModeNumber(modeToIndex),
        gaiaSnapshot.generatedAt,
      );
    }
    window.dispatchEvent(new CustomEvent("gaia:japan-mode-change"));
  };

  const readIntroStoryDestination = () => {
    const runtimeCompletion = globalThis.GaiaNovel?.getCompletionState?.();
    let mainEndingComplete = runtimeCompletion?.mainEndingComplete === true;
    let apeironceneComplete = runtimeCompletion?.apeironceneComplete === true;
    let apeironcenePending = false;
    try {
      const progress = JSON.parse(window.localStorage.getItem("gaiaSensewareNovel:progress") || "null");
      // A legacy save is reset by the story runtime; it must not unlock the
      // ending while that runtime is still lazy. Debug previews are not clears.
      if (!runtimeCompletion) mainEndingComplete = Number(progress?.storyVersion) >= 13 && progress?.clear === true;
      apeironceneComplete = Boolean(
        apeironceneComplete
        || (!runtimeCompletion && Number(progress?.storyVersion) >= 13 && progress?.trueEndComplete === true)
        || window.localStorage.getItem("gaiaSensewareTrueEnd:complete:v1")
        || globalThis.GaiaTrueEnd?.isComplete?.(),
      );
      apeironcenePending = Boolean(window.localStorage.getItem("gaiaSensewareTrueEnd:pending:v1"));
    } catch {
      // Storage is optional; the ordinary story route remains available.
    }
    // Pending is only a continuation hint after a genuine main-story clear.
    // Old markers must never promote an unfinished/restarted/loaded playthrough.
    return mainEndingComplete && (apeironcenePending || !apeironceneComplete)
      ? "apeironcene"
      : "story";
  };

  const clearIntroStoryRevealTimers = () => {
    window.clearTimeout(introStoryRevealStartTimer);
    window.clearTimeout(introStoryRevealCommitTimer);
    window.clearTimeout(introStoryRevealSettleTimer);
    introStoryRevealStartTimer = 0;
    introStoryRevealCommitTimer = 0;
    introStoryRevealSettleTimer = 0;
    introStoryRevealObserver?.disconnect();
    introStoryRevealObserver = null;
    introStoryReturn?.querySelectorAll("[data-intro-comet-motion]").forEach((motion) => {
      try { motion.endElement(); } catch { /* No active SVG interval to end. */ }
    });
  };

  const renderIntroStoryDestination = (destination) => {
    const isApeironcene = destination === "apeironcene";
    introStoryReturn.dataset.storyDestination = destination;
    introStoryReturn.querySelector(".intro-story-kicker")?.replaceChildren(isApeironcene ? "TRUE END / UNLOCKED" : "MAIN STORY");
    const title = introStoryReturn.querySelector(".intro-story-title");
    title?.replaceChildren(isApeironcene ? "星々の放課後 ～APEIRONCENE～" : "物語をはじめる");
    introStoryReturn.setAttribute("aria-label", isApeironcene ? "星々の放課後 APEIRONCENEへ進む" : "物語をはじめる");
  };

  const syncIntroStoryReturn = () => {
    if (!(introStoryReturn instanceof HTMLButtonElement)) return;
    const destination = readIntroStoryDestination();
    if (destination !== "apeironcene") {
      clearIntroStoryRevealTimers();
      introApeironceneRevealed = false;
      introStoryReturn.classList.remove("is-apeironcene-awakening", "is-apeironcene");
      renderIntroStoryDestination("story");
      return;
    }
    createIntroApeironceneParticles();
    createIntroApeironceneTransition();
    // Progress/storage notifications must not reset a reveal already in flight.
    if (introStoryRevealStartTimer || introStoryRevealCommitTimer || introStoryRevealSettleTimer || introStoryRevealObserver) return;
    if (introApeironceneRevealed) {
      introStoryReturn.classList.remove("is-apeironcene-awakening");
      introStoryReturn.classList.add("is-apeironcene");
      renderIntroStoryDestination("apeironcene");
      return;
    }

    introStoryReturn.classList.remove("is-apeironcene-awakening", "is-apeironcene");
    // The unlocked destination must not depend on a visibility/animation timer.
    // In particular, returning via the credits skip may leave this entry offscreen.
    renderIntroStoryDestination("apeironcene");
    if (!introIsOpen || introLayer.hidden || document.hidden || introLayer.getAttribute("aria-hidden") !== "false") return;

    const commit = () => {
      introStoryRevealCommitTimer = 0;
      if (!introIsOpen || document.hidden || readIntroStoryDestination() !== "apeironcene") {
        clearIntroStoryRevealTimers();
        introStoryReturn.classList.remove("is-apeironcene-awakening");
        if (introIsOpen) syncIntroStoryReturn();
        return;
      }
      introApeironceneRevealed = true;
      renderIntroStoryDestination("apeironcene");
      introStoryReturn.classList.add("is-apeironcene");
      window.dispatchEvent(new CustomEvent("gaia:apeironcene-entry-revealed"));
    };
    if (reducedMotion) {
      window.dispatchEvent(new CustomEvent("gaia:apeironcene-entry-reveal-start"));
      commit();
      return;
    }
    // Wait until this below-the-cards entry is visible, including on mobile.
    introStoryRevealObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < .6) {
        window.clearTimeout(introStoryRevealStartTimer);
        introStoryRevealStartTimer = 0;
        return;
      }
      if (introStoryRevealStartTimer) return;
      introStoryRevealStartTimer = window.setTimeout(() => {
        introStoryRevealStartTimer = 0;
        introStoryRevealObserver?.disconnect();
        introStoryRevealObserver = null;
        if (!introIsOpen || document.hidden || readIntroStoryDestination() !== "apeironcene") return;
        createIntroApeironceneTransition(true);
        introStoryReturn.classList.add("is-apeironcene-awakening");
        introStoryReturn.querySelectorAll("[data-intro-comet-motion]").forEach((motion) => motion.beginElementAt(Number(motion.dataset.introDelay)));
        window.dispatchEvent(new CustomEvent("gaia:apeironcene-entry-reveal-start"));
        introStoryRevealCommitTimer = window.setTimeout(commit, 900);
        introStoryRevealSettleTimer = window.setTimeout(() => {
          introStoryRevealSettleTimer = 0;
          introStoryReturn.classList.remove("is-apeironcene-awakening");
        }, 2800);
      }, 850);
    }, { threshold: [.6] });
    introStoryRevealObserver.observe(introStoryReturn);
  };
  document.addEventListener("visibilitychange", () => {
    introStoryReturn?.toggleAttribute("data-page-hidden", document.hidden);
    if (document.hidden) {
      clearIntroStoryRevealTimers();
      introStoryReturn?.classList.remove("is-apeironcene-awakening");
    } else if (introIsOpen) {
      syncIntroStoryReturn();
    }
  });

  window.addEventListener("gaia:story-progression-change", syncIntroStoryReturn);
  window.addEventListener("gaia:true-end-complete", syncIntroStoryReturn);
  window.addEventListener("storage", (event) => {
    if (["gaiaSensewareNovel:progress", "gaiaSensewareTrueEnd:complete:v1", "gaiaSensewareTrueEnd:pending:v1"].includes(event.key)) {
      syncIntroStoryReturn();
    }
  });

  const selectMode = (index, { resetAutoTimer = true } = {}) => {
    delete japanLayer.dataset.mapEntryExhibit;
    globalThis.GaiaLiveExhibits?.deactivate?.();
    globalThis.GaiaEstatExhibits?.deactivate?.();
    globalThis.GaiaFirmsExhibit?.deactivate?.();
    globalThis.GaiaPlanetSignals?.deactivate?.();
    globalThis.GaiaMarineCod?.deactivate?.();
    globalThis.GaiaFoodExhibits?.deactivate?.();
    const normalizedIndex = (index + MODE_COUNT) % MODE_COUNT;
    void loadGaiaSignals({ modeId: modes[normalizedIndex].dataModeId || modes[normalizedIndex].id });
    if (modes[normalizedIndex].id === "breathing-earth" && !ovationAuroraReloadTimer && ovationAuroraState.source === "pending") {
      ovationAuroraState.source = "loading";
      void loadOvationAuroraForecast();
    }
    if (japanIsOpen) clearJapanPoiHover();
    if (normalizedIndex === modeToIndex) {
      // Extension exhibits replace the map UI without changing the base mode.
      // Re-selecting that mode must restore its headings and current button too.
      updateModeInterface();
      if (japanIsOpen) {
        restartMapPlotReveal("mode-reselect");
        restartCo2Timeline(0);
        if (isTheme(5, normalizedIndex)) setJapanDataLayer("snapshot");
        animateEarthViewForMode(normalizedIndex);
      }
      if (resetAutoTimer) {
        nextAutoAt = performance.now() + AUTO_INTERVAL;
      }
      return;
    }

    modeFromIndex = modeToIndex;
    modeToIndex = normalizedIndex;
    transitionStartedAt = performance.now();
    if (resetAutoTimer) {
      nextAutoAt = transitionStartedAt + AUTO_INTERVAL;
    }
    updateModeInterface();
    if (japanIsOpen) {
      restartMapPlotReveal("mode-change");
      restartCo2Timeline(0);
      if (isTheme(5, normalizedIndex)) setJapanDataLayer("snapshot");
      animateEarthViewForMode(normalizedIndex);
    }
    if (conceptIsOpen) {
      conceptScroll.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    }
  };

  window.addEventListener("gaia:select-mode", (event) => {
    const requestedIndex = Number(event.detail?.index);
    if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < MODE_COUNT) {
      selectMode(requestedIndex);
    }
  });

  const setMobileMapLegendExpanded = (expanded) => {
    const shouldExpand = Boolean(expanded && usesCompactMapUi() && !mapMobileLegendToggle?.hidden);
    japanLayer.classList.toggle("is-mobile-legend-expanded", shouldExpand);
    mapMobileLegendToggle?.setAttribute("aria-expanded", String(shouldExpand));
    mapMobileLegendToggle?.querySelector("strong")?.replaceChildren(shouldExpand ? "閉じる" : "凡例");
  };

  const setMobileMapHeadingExpanded = (expanded) => {
    const shouldExpand = Boolean(expanded && usesCompactMapUi());
    japanLayer.classList.toggle("is-mobile-heading-expanded", shouldExpand);
    mapMobileHeadingToggle?.setAttribute("aria-expanded", String(shouldExpand));
    mapMobileHeadingToggle?.querySelector("strong")?.replaceChildren(shouldExpand ? "閉じる" : "詳細");
    if (shouldExpand) {
      japanLayer.classList.remove("is-mobile-bank-expanded");
      mapMobileBankToggle?.setAttribute("aria-expanded", "false");
      mapMobileBankToggle?.querySelector("strong")?.replaceChildren("展示一覧");
      mapReadingGuide.open = false;
      setMobileMapLegendExpanded(false);
    }
  };

  const setMobileMapBankExpanded = (expanded, { restoreFocus = false } = {}) => {
    const shouldExpand = Boolean(expanded && usesCompactMapBank());
    japanLayer.classList.toggle("is-mobile-bank-expanded", shouldExpand);
    mapMobileBankToggle?.setAttribute("aria-expanded", String(shouldExpand));
    mapMobileBankToggle?.querySelector("strong")?.replaceChildren(shouldExpand ? "閉じる" : "展示一覧");
    if (shouldExpand) {
      setMobileMapHeadingExpanded(false);
      setMobileMapLegendExpanded(false);
      mapReadingGuide.open = false;
    } else if (restoreFocus && usesCompactMapBank()) {
      requestAnimationFrame(() => mapMobileBankToggle?.focus({ preventScroll: true }));
    }
  };

  const resetMobileMapUi = () => {
    setMobileMapHeadingExpanded(false);
    setMobileMapBankExpanded(false);
    setMobileMapLegendExpanded(false);
    if (usesCompactMapUi()) {
      mapReadingGuide.open = false;
    }
  };

  let mapModePreviewAnchor = null;

  const positionMapModeTooltip = (tooltip, button = mapModePreviewAnchor) => {
    const bankRect = japanModeBank.getBoundingClientRect();
    const mobile = usesCompactMapUi();
    const width = mobile
      ? bankRect.width
      : Math.min(430, Math.max(320, innerWidth - 24));
    tooltip.style.width = `${Math.round(width)}px`;
    const tooltipHeight = tooltip.getBoundingClientRect().height;
    const buttonRect = button?.getBoundingClientRect?.();
    let left = bankRect.left;
    let top = Math.max(12, bankRect.top - tooltipHeight - 8);
    let placement = "right";
    if (!mobile && buttonRect) {
      const rightCandidate = buttonRect.right + 10;
      const leftCandidate = buttonRect.left - width - 10;
      const opensRight = rightCandidate + width <= innerWidth - 12;
      left = opensRight ? rightCandidate : Math.max(12, leftCandidate);
      placement = opensRight ? "right" : "left";
      top = Math.max(12, Math.min(
        buttonRect.top + (buttonRect.height - tooltipHeight) / 2,
        innerHeight - tooltipHeight - 12,
      ));
    } else if (!mobile) {
      left = Math.min(bankRect.right + 12, innerWidth - width - 12);
      top = Math.max(12, Math.min(bankRect.bottom - tooltipHeight, innerHeight - tooltipHeight - 12));
    }
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.dataset.placement = placement;
    if (buttonRect && !mobile) {
      const anchorY = Math.max(18, Math.min(tooltipHeight - 18, buttonRect.top + buttonRect.height / 2 - top));
      tooltip.style.setProperty("--map-tooltip-anchor-y", `${Math.round(anchorY)}px`);
    } else {
      tooltip.style.removeProperty("--map-tooltip-anchor-y");
    }
  };

  const scheduleMapModeTooltipPosition = (tooltip, button = mapModePreviewAnchor) => {
    const position = () => positionMapModeTooltip(tooltip, button);
    requestAnimationFrame(() => {
      position();
      requestAnimationFrame(position);
    });
    window.setTimeout(position, 260);
  };

  const syncMapModePreviewContainer = () => {
    // Match the inline preview's CSS breakpoint, not the wider bank breakpoint.
    // Otherwise tablet previews are trapped beneath the bank's sibling panels.
    const target = usesCompactMapUi() ? japanModeBank : japanLayer;
    if (mapModePreview.parentElement !== target) target.append(mapModePreview);
  };

  syncMapModePreviewContainer();

  const getMapModePreviewContent = (button) => {
    if (button?.dataset.foodExhibit) {
      const exhibit = globalThis.GaiaFoodExhibits?.definitions?.find(item => item.id === button.dataset.foodExhibit);
      return exhibit ? { number: `${exhibit.number} / ${exhibit.signalLabel}`, label: exhibit.shortTitle, copy: exhibit.picker } : null;
    }
    if (button?.dataset.marineCodExhibit) {
      const exhibit = globalThis.GaiaMarineCod?.definitions?.find(item => item.id === button.dataset.marineCodExhibit);
      return exhibit ? { number: `${exhibit.number} / ${exhibit.signalLabel}`, label: exhibit.shortTitle, copy: MAP_MODE_DESCRIPTIONS[exhibit.id] || exhibit.picker || exhibit.caption } : null;
    }
    if (button?.dataset.planetExhibit) {
      const exhibit = globalThis.GaiaPlanetSignals?.definitions?.find(({ id }) => id === button.dataset.planetExhibit);
      if (!exhibit) return null;
      return {
        number: `${exhibit.number} / ${exhibit.signalLabel}`,
        label: exhibit.shortTitle,
        copy: MAP_MODE_DESCRIPTIONS[exhibit.id] || exhibit.caption,
      };
    }
    if (button?.dataset.firmsExhibit) {
      const exhibit = globalThis.GaiaFirmsExhibit?.definition;
      if (!exhibit || exhibit.id !== button.dataset.firmsExhibit) return null;
      return {
        number: `${exhibit.number} / NASA FIRMS 24H`,
        label: exhibit.shortTitle,
        copy: MAP_MODE_DESCRIPTIONS[exhibit.id] || exhibit.caption,
      };
    }
    if (button?.dataset.estatExhibit) {
      const exhibit = globalThis.GaiaEstatExhibits?.definitions?.find(({ id }) => id === button.dataset.estatExhibit);
      if (!exhibit) return null;
      return {
        number: `${exhibit.number} / ${exhibit.provider || "e-Stat"} ${exhibit.frequency.toUpperCase()}`,
        label: exhibit.shortTitle,
        copy: MAP_MODE_DESCRIPTIONS[exhibit.id] || exhibit.caption,
      };
    }
    if (button?.dataset.liveExhibit) {
      const exhibit = globalThis.GaiaLiveExhibits?.definitions?.find(({ id }) => id === button.dataset.liveExhibit);
      if (!exhibit) return null;
      return {
        number: `${exhibit.number} / ${exhibit.signalLabel}`,
        label: exhibit.shortTitle,
        copy: MAP_MODE_DESCRIPTIONS[exhibit.id] || exhibit.caption,
      };
    }
    const index = japanModeButtons.indexOf(button);
    const choice = INTRO_MODE_CHOICES[index];
    const mode = modes[index];
    if (!choice || !mode) return null;
    return {
      number: `${formatMapModeNumber(index)} / ${choice.code}`,
      label: mode.titleJa,
      copy: MAP_MODE_DESCRIPTIONS[mode.id] || choice.copy,
    };
  };

  const setMapModePreviewOpen = (open, button = null) => {
    if (open) {
      const content = getMapModePreviewContent(button);
      if (!content) return;
      mapModePreviewAnchor = button;
      mapModePreviewNumber.textContent = content.number;
      mapModePreviewLabel.textContent = content.label;
      mapModePreviewCopy.textContent = content.copy;
    } else {
      mapModePreviewAnchor = null;
    }
    mapModePreview.classList.toggle("is-open", Boolean(open));
    mapModePreview.setAttribute("aria-hidden", String(!open));
    if (open && usesCompactMapUi()) {
      mapModePreview.style.removeProperty("width");
      mapModePreview.style.removeProperty("left");
      mapModePreview.style.removeProperty("top");
      requestAnimationFrame(() => mapModePreview.scrollIntoView({ block: "nearest", inline: "nearest" }));
    } else if (open) {
      scheduleMapModeTooltipPosition(mapModePreview, button);
    }
  };

  const closeMapModePreview = () => setMapModePreviewOpen(false);
  const syncMapModePreviewIntent = (scope) => {
    requestAnimationFrame(() => {
      const keyboardButton = scope?.querySelector?.(".map-mode-button:focus-visible");
      const hoverButton = supportsHover
        ? scope?.querySelector?.(".map-mode-button:hover")
        : null;
      const button = keyboardButton || hoverButton;
      if (button) setMapModePreviewOpen(true, button);
      else closeMapModePreview();
    });
  };

  const setLightCanvasMounted = (mounted) => {
    if (mounted) {
      if (canvas.parentElement !== japanMap || canvas.nextElementSibling !== japanOverlay) {
        japanOverlay.before(canvas);
      }
      canvas.dataset.mapLayer = "below-reference-map-and-poi";
      return;
    }
    if (canvas.parentElement === canvasHomeParent) return;
    delete canvas.dataset.mapLayer;
    canvasHomeParent.insertBefore(canvas, canvasHomeNextSibling);
  };

  const MAP_LIGHT_OPACITIES = Object.freeze([0.09, 0.72, 0.14, 0.13, 0.15, 0.18, 0.14, 0.17, 0.15]);
  const syncIntegratedMapLight = () => {
    const active = japanIsOpen
      && !japanLayer.classList.contains("is-live-exhibit")
      && !japanLayer.classList.contains("is-estat-exhibit")
      && !japanLayer.matches(".is-firms-exhibit, .is-marine-cod-exhibit, .is-food-exhibit");
    japanLayer.classList.toggle("has-integrated-map-light", active);
    japanModeBank.dataset.mapSurface = "map";
    japanModeBank.dataset.lightIntegration = active ? "mode-matched" : "off";
    if (active) {
      const modeNumber = formatModeNumber(mapModeIndex);
      japanLayer.style.setProperty("--map-light-opacity", String(MAP_LIGHT_OPACITIES[mapModeIndex] ?? 0.15));
      canvas.dataset.integratedMapMode = modeNumber;
      japanOverlay.dataset.layerOrder = "reference-map-and-poi-above-webgl";
        if (modeNumber !== "02") {
        delete canvas.dataset.currentMeanSpeedMs;
        delete canvas.dataset.currentMaximumSpeedMs;
        delete canvas.dataset.currentStrength;
          delete canvas.dataset.currentVectorCount;
          delete canvas.dataset.currentVisiblePoiCount;
          delete canvas.dataset.currentRevealedPoiCount;
          delete canvas.dataset.currentRenderedSampleCount;
          delete canvas.dataset.currentBrushStrokeCount;
          delete canvas.dataset.currentOneStrokePerPoi;
          delete canvas.dataset.currentAllVisiblePoiPainted;
          delete canvas.dataset.currentSampleSelection;
          delete canvas.dataset.currentBrushLanguage;
          delete canvas.dataset.currentCoverageMode;
          delete canvas.dataset.currentInterpolationSource;
          delete canvas.dataset.currentAmbientMotion;
          delete japanOverlay.dataset.currentVisiblePoiCount;
          delete japanOverlay.dataset.currentPoiMarkerCount;
          delete japanOverlay.dataset.currentPoiMarkerStyle;
      }
      setLightCanvasMounted(true);
    } else {
      japanLayer.style.removeProperty("--map-light-opacity");
      delete canvas.dataset.integratedMapMode;
      delete canvas.dataset.currentMeanSpeedMs;
      delete canvas.dataset.currentMaximumSpeedMs;
      delete canvas.dataset.currentStrength;
      delete canvas.dataset.currentVectorCount;
      delete canvas.dataset.currentVisiblePoiCount;
      delete canvas.dataset.currentRevealedPoiCount;
      delete canvas.dataset.currentRenderedSampleCount;
      delete canvas.dataset.currentBrushStrokeCount;
      delete canvas.dataset.currentOneStrokePerPoi;
      delete canvas.dataset.currentAllVisiblePoiPainted;
      delete canvas.dataset.currentSampleSelection;
      delete canvas.dataset.currentBrushLanguage;
      delete canvas.dataset.currentCoverageMode;
      delete canvas.dataset.currentInterpolationSource;
      delete canvas.dataset.currentAmbientMotion;
      delete japanOverlay.dataset.currentVisiblePoiCount;
      delete japanOverlay.dataset.currentPoiMarkerCount;
      delete japanOverlay.dataset.currentPoiMarkerStyle;
      delete japanOverlay.dataset.layerOrder;
      setLightCanvasMounted(false);
    }
  };

  mapMobileHeadingToggle?.addEventListener("click", () => {
    setMobileMapHeadingExpanded(mapMobileHeadingToggle.getAttribute("aria-expanded") !== "true");
  });
  mapMobileBankToggle?.addEventListener("click", () => {
    setMobileMapBankExpanded(mapMobileBankToggle.getAttribute("aria-expanded") !== "true");
  });
  mapMobileLegendToggle?.addEventListener("click", () => {
    const expand = mapMobileLegendToggle.getAttribute("aria-expanded") !== "true";
    if (expand) {
      setMobileMapHeadingExpanded(false);
      setMobileMapBankExpanded(false);
      mapReadingGuide.open = false;
    }
    setMobileMapLegendExpanded(expand);
  });
  mapReadingGuide.addEventListener("toggle", () => {
    if (!usesCompactMapUi() || !mapReadingGuide.open) return;
    setMobileMapHeadingExpanded(false);
    setMobileMapBankExpanded(false);
    setMobileMapLegendExpanded(false);
  });
  japanModeBank.addEventListener("pointerover", (event) => {
    if (!supportsHover) return;
    const button = event.target.closest?.(".map-mode-button");
    if (button) setMapModePreviewOpen(true, button);
  });
  japanModeBank.addEventListener("pointerout", () => syncMapModePreviewIntent(japanModeBank));
  japanModeBank.addEventListener("focusin", () => syncMapModePreviewIntent(japanModeBank));
  japanModeBank.addEventListener("focusout", () => syncMapModePreviewIntent(japanModeBank));
  japanModeBank.addEventListener("click", (event) => {
    const button = event.target.closest?.(".map-mode-button");
    if (!button) return;
    syncMapModePreviewIntent(japanModeBank);
  }, true);
  japanModeBank.addEventListener("click", (event) => {
    if (event.target.closest?.(".map-mode-button")) setMobileMapBankExpanded(false);
  });
  window.addEventListener("gaia:live-exhibit-mounted", () => {
    japanModeBank.querySelectorAll("[data-live-exhibit]").forEach((button) => {
      button.dataset.mapPreviewSurface = "map";
      button.setAttribute("aria-describedby", "map-mode-preview");
    });
  });
  window.addEventListener("gaia:live-exhibit-change", (event) => {
    if (event.detail?.id) {
      setMobileMapBankExpanded(false, { restoreFocus: true });
    }
    syncIntegratedMapLight();
  });
  window.addEventListener("gaia:marine-cod-change", () => {
    setMobileMapBankExpanded(false);
    syncIntegratedMapLight();
  });
  window.addEventListener("gaia:food-change", () => {
    setMobileMapBankExpanded(false);
    syncIntegratedMapLight();
  });
  window.addEventListener("gaia:estat-exhibit-change", (event) => {
    if (event.detail?.id) setMobileMapBankExpanded(false, { restoreFocus: true });
    syncIntegratedMapLight();
  });
  window.addEventListener("gaia:estat-exhibit-mounted", () => {
    japanModeBank.querySelectorAll("[data-estat-exhibit]").forEach((button) => {
      button.dataset.mapPreviewSurface = "map";
      button.setAttribute("aria-describedby", "map-mode-preview");
    });
  });
  let compactMapUiWasActive = usesCompactMapUi();
  window.addEventListener("resize", () => {
    const compactMapUiIsActive = usesCompactMapUi();
    if (compactMapUiIsActive && !compactMapUiWasActive) resetMobileMapUi();
    if (!compactMapUiIsActive && compactMapUiWasActive) resetMobileMapUi();
    compactMapUiWasActive = compactMapUiIsActive;
    if (!usesCompactMapBank()) setMobileMapBankExpanded(false);
    syncMapModePreviewContainer();
    if (mapModePreview.classList.contains("is-open") && !usesCompactMapUi()) {
      scheduleMapModeTooltipPosition(mapModePreview, mapModePreviewAnchor);
    }
  }, { passive: true });

  modes.forEach((mode, index) => {
    const introChoice = INTRO_MODE_CHOICES[index];
    const introModeButton = document.createElement("button");
    const introModeNumber = document.createElement("span");
    const introModeLabel = document.createElement("strong");
    const introModeCue = document.createElement("small");
    const introModeReveal = document.createElement("span");
    introModeButton.className = "intro-mode-choice";
    introModeButton.type = "button";
    introModeButton.setAttribute("role", "option");
    introModeButton.setAttribute("aria-selected", index === modeToIndex ? "true" : "false");
    introModeButton.setAttribute(
      "aria-label",
      `${formatModeNumber(index)} ${introChoice.label}、${introChoice.cue}`,
    );
    introModeButton.tabIndex = index === modeToIndex ? 0 : -1;
    introModeReveal.className = "intro-card-reveal-fx";
    introModeReveal.setAttribute("aria-hidden", "true");
    introModeNumber.textContent = formatModeNumber(index);
    introModeLabel.textContent = introChoice.label;
    introModeCue.textContent = introChoice.cue;
    introModeButton.append(introModeReveal, introModeNumber, introModeLabel, introModeCue);
    const previewIntroMode = () => {
      updateIntroSelection(index);
    };
    introModeButton.addEventListener("pointerenter", previewIntroMode);
    introModeButton.addEventListener("focus", previewIntroMode);
    introModeButton.addEventListener("click", (event) => {
      selectMode(index);
      updateIntroSelection(index);
      enterIntroSelection(event);
    });
    introModeButtons.push(introModeButton);
    introModeList.append(introModeButton);

    const button = document.createElement("button");
    button.className = "mode-button";
    button.type = "button";
    button.textContent = formatModeNumber(index);
    button.setAttribute("aria-label", `${formatModeNumber(index)} ${mode.title} ${mode.titleJa}`);
    button.setAttribute("aria-current", index === 0 ? "true" : "false");
    button.addEventListener("click", () => selectMode(index));
    modeButtons.push(button);
    modeList.append(button);

    const conceptButton = document.createElement("button");
    conceptButton.className = "concept-mode-button";
    conceptButton.type = "button";
    conceptButton.textContent = formatModeNumber(index);
    conceptButton.setAttribute(
      "aria-label",
      `${formatModeNumber(index)} ${mode.titleJa}の解説を読む`,
    );
    conceptButton.setAttribute("aria-current", index === 0 ? "true" : "false");
    conceptButton.addEventListener("click", () => {
      selectMode(index);
      conceptScroll.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
    conceptModeButtons.push(conceptButton);
    conceptModeList.append(conceptButton);

    const japanModeButton = document.createElement("button");
    japanModeButton.className = "map-mode-button";
    japanModeButton.type = "button";
    japanModeButton.textContent = formatMapModeNumber(index);
    japanModeButton.setAttribute(
      "aria-label",
      `${formatMapModeNumber(index)} ${mode.titleJa}の地図演出へ切り替える`,
    );
    japanModeButton.dataset.mapPreviewSurface = "map";
    japanModeButton.setAttribute("aria-describedby", "map-mode-preview");
    japanModeButton.setAttribute("aria-current", index === 0 ? "true" : "false");
    japanModeButton.addEventListener("click", () => {
      mapModeIndex = index;
      selectMode(mapModeIndex);
      syncIntegratedMapLight();
      setMobileMapBankExpanded(false, { restoreFocus: true });
    });
    japanModeButton.dataset.mapStandardIndex = String(index);
    japanModeButtons.push(japanModeButton);
    japanModeList.append(japanModeButton);
  });

  introPathButtons.forEach((button) => {
    button.setAttribute("aria-pressed", "false");
    const previewPath = () => setIntroVisual(button.dataset.introPath);
    button.addEventListener("pointerenter", previewPath);
    button.addEventListener("focus", previewPath);
    button.addEventListener("click", (event) => {
      const path = button.dataset.introPath;
      if (path === "novel") {
        const source = readIntroStoryDestination() === "apeironcene" ? "apeironcene" : "title-menu";
        runSceneTransition(async () => {
          await window.GaiaModeLoader?.load?.("story");
          closeIntro({ restoreFocus: false });
          if (source === "title-menu" && window.GaiaNovel?.open) {
            await window.GaiaNovel.open(null, { autoStartFresh: true });
          } else {
            window.dispatchEvent(new CustomEvent("gaia:novel-open-at-mode", {
              detail: { index: 0, source },
            }));
          }
        }, path, event);
        return;
      }
      if (path === "map") {
        runSceneTransition(() => {
          closeIntro({ restoreFocus: false });
          openJapan({ respectUrlMode: false, focusModeBank: true, entryExhibit: 1 });
        }, path, event);
        return;
      }
      runSceneTransition(() => selectIntroPath(path), path, event);
    });
  });

  const previewIntroSound = () => setIntroVisual("sound");
  introSoundPreviewButton?.addEventListener("pointerenter", previewIntroSound);
  introSoundPreviewButton?.addEventListener("focus", previewIntroSound);

  introPathGrid?.addEventListener("pointerleave", () => {
    if (introStage === "path") setIntroVisual("default");
  });
  introPathGrid?.addEventListener("focusout", (event) => {
    if (introStage === "path" && !introPathGrid.contains(event.relatedTarget)) {
      setIntroVisual("default");
    }
  });

  previousModeButton.addEventListener("click", () => selectMode(modeToIndex - 1));
  nextModeButton.addEventListener("click", () => selectMode(modeToIndex + 1));

  const updateAutoInterface = () => {
    autoButton.setAttribute("aria-pressed", autoEnabled ? "true" : "false");
    autoButton.title = autoEnabled ? "Exhibition mode: on" : "Exhibition mode: off";
    experience.classList.toggle("is-auto", autoEnabled);
  };

  autoButton.addEventListener("click", () => {
    autoEnabled = !autoEnabled;
    nextAutoAt = performance.now() + AUTO_INTERVAL;
    updateAutoInterface();
  });

  resetButton.addEventListener("click", clearSession);

  japanMap.addEventListener("pointerdown", (event) => {
    if (!japanIsOpen) {
      return;
    }
    clearJapanPoiHover();
    cancelEarthViewAnimation("user-pointer");
    event.preventDefault();
    japanMap.setPointerCapture(event.pointerId);
    japanView.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (japanView.pointerId === null) {
      japanView.pointerId = event.pointerId;
      japanView.startX = event.clientX;
      japanView.startY = event.clientY;
      japanView.lastX = event.clientX;
      japanView.lastY = event.clientY;
      japanView.dragged = false;
      japanView.gesture = false;
      japanView.pressStartedAt = performance.now();
    }

    if (mapScope === "earth" && japanView.pointers.size === 2) {
      const [first, second] = [...japanView.pointers.values()];
      japanView.pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      japanView.pinchCenterX = (first.x + second.x) / 2;
      japanView.pinchCenterY = (first.y + second.y) / 2;
      japanView.dragged = true;
      japanView.gesture = true;
      japanMap.classList.add("is-dragging");
    }
  });

  japanMap.addEventListener("pointermove", (event) => {
    if (!japanIsOpen) {
      return;
    }
    if (!japanView.pointers.has(event.pointerId)) {
      updateJapanPoiHover(event);
      return;
    }
    clearJapanPoiHover();
    event.preventDefault();
    japanView.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (mapScope === "earth" && japanView.pointers.size >= 2) {
      const [first, second] = [...japanView.pointers.values()];
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      japanView.earthOffsetX += centerX - japanView.pinchCenterX;
      japanView.earthOffsetY += centerY - japanView.pinchCenterY;
      setEarthZoom(
        japanView.earthZoom * (distance / Math.max(1, japanView.pinchDistance)),
        centerX,
        centerY,
      );
      japanView.pinchDistance = distance;
      japanView.pinchCenterX = centerX;
      japanView.pinchCenterY = centerY;
      japanView.gesture = true;
      closeJapanPoi();
      return;
    }

    if (japanView.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - japanView.lastX;
    const deltaY = event.clientY - japanView.lastY;
    const totalDistance = Math.hypot(
      event.clientX - japanView.startX,
      event.clientY - japanView.startY,
    );

    if (totalDistance > 5) {
      japanView.dragged = true;
      japanMap.classList.add("is-dragging");
    }

    if (japanView.dragged) {
      if (mapScope === "earth") {
        japanView.earthOffsetX += deltaX;
        japanView.earthOffsetY += deltaY;
        japanView.earthProjection = getEarthProjection(japanMap.getBoundingClientRect());
      } else {
        const worldSize = MAP_TILE_SIZE * 2 ** japanView.zoom;
        japanView.centerX = clamp(japanView.centerX - deltaX, 0, worldSize);
        japanView.centerY = clamp(japanView.centerY - deltaY, 0, worldSize);
      }
      japanTilesDirty = true;
      closeJapanPoi();
    }

    japanView.lastX = event.clientX;
    japanView.lastY = event.clientY;
  });

  const releaseJapanPointer = (event, createPulse) => {
    if (!japanView.pointers.has(event.pointerId)) {
      return;
    }
    if (japanMap.hasPointerCapture(event.pointerId)) {
      japanMap.releasePointerCapture(event.pointerId);
    }
    const isPrimaryPointer = japanView.pointerId === event.pointerId;
    if (isPrimaryPointer) {
      const pressDuration = performance.now() - japanView.pressStartedAt;
      if (
        createPulse &&
        !japanView.dragged &&
        !japanView.gesture &&
        isTheme(4) &&
        !japanLayer.matches(".is-firms-exhibit, .is-marine-cod-exhibit, .is-food-exhibit") &&
        pressDuration >= 650
      ) {
        anthropocenePeelUntil = performance.now() + 6000;
        japanMapStatus.textContent = "NIGHT LIGHT PEELED / EMISSIONS LAYER REMAINS";
      } else if (createPulse && !japanView.dragged && !japanView.gesture) {
        const exclusiveExhibit = japanLayer.classList.contains("is-live-exhibit")
          || japanLayer.classList.contains("is-estat-exhibit")
          || japanLayer.matches(".is-firms-exhibit, .is-marine-cod-exhibit, .is-food-exhibit");
        const poi = findJapanPoiAt(event.clientX, event.clientY, event.pointerType);
        if (poi) {
          openJapanPoi(poi, event.clientX, event.clientY);
        } else {
          closeJapanPoi();
          if (!exclusiveExhibit) addJapanPulse(event.clientX, event.clientY);
        }
      }
    }
    japanView.pointers.delete(event.pointerId);

    if (japanView.pointers.size > 0) {
      const [pointerId, point] = japanView.pointers.entries().next().value;
      japanView.pointerId = pointerId;
      japanView.startX = point.x;
      japanView.startY = point.y;
      japanView.lastX = point.x;
      japanView.lastY = point.y;
      japanView.dragged = true;
      return;
    }

    japanView.pointerId = null;
    japanView.dragged = false;
    japanView.gesture = false;
    japanView.pinchDistance = 0;
    japanMap.classList.remove("is-dragging");
    if (createPulse && ["map01", "map03", "map08"].includes(storyModeDetour?.kind)) {
      if (storyModeDetour.kind === "map01") storyModeDetour.views.add("temperature_anomaly");
      updateSignalInterface();
      window.dispatchEvent(new CustomEvent("gaia:story-map-interaction", {
        detail: {
          kind: storyModeDetour.kind,
          ...(storyModeDetour.kind === "map01" ? { view: "temperature_anomaly" } : {}),
        },
      }));
    }
  };

  japanMap.addEventListener("pointerup", (event) => releaseJapanPointer(event, true));
  japanMap.addEventListener("pointercancel", (event) =>
    releaseJapanPointer(event, false),
  );
  japanMap.addEventListener("pointerleave", () => {
    if (japanView.pointers.size === 0) clearJapanPoiHover();
  });

  const shouldPreserveMapUiWheel = (target) => target instanceof Element && Boolean(target.closest([
    "#japan-data-panel",
    "#gaia-statistics-lab",
    ".gaia-live-exhibit-readout",
    ".map-mode-groups",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
  ].join(",")));

  japanMap.addEventListener(
    "wheel",
    (event) => {
      if (!japanIsOpen || mapScope !== "earth") return;
      if (shouldPreserveMapUiWheel(event.target)) return;
      clearJapanPoiHover();
      cancelEarthViewAnimation("user-wheel");
      event.preventDefault();
      const deltaUnit = event.deltaMode === 1
        ? 18
        : event.deltaMode === 2
          ? Math.max(1, japanMap.getBoundingClientRect().height)
          : 1;
      const delta = clamp(event.deltaY * deltaUnit, -240, 240);
      if (Math.abs(delta) < 0.01) return;
      const factor = Math.exp(-delta * (event.ctrlKey ? 0.006 : 0.0024));
      setEarthZoom(japanView.earthZoom * factor, event.clientX, event.clientY);
      closeJapanPoi();
    },
    { capture: true, passive: false },
  );

  mapZoomIn.addEventListener("click", () => zoomEarthBy(1.35));
  mapZoomOut.addEventListener("click", () => zoomEarthBy(1 / 1.35));
  mapZoomReset.addEventListener("click", () => {
    if (mapZoomReset.dataset.overview === 'japan') focusEarthLocation({ ...japanPrefectureView(innerWidth), durationMs: 450 });
    else resetJapanView();
    japanMap.focus({ preventScroll: true });
  });

  japanMap.addEventListener("keydown", (event) => {
    // POI buttons and sliders own their keys; map panning must not cancel
    // native activation or turn a manual range adjustment into a map gesture.
    if (event.target instanceof Element && event.target !== japanMap
      && event.target.closest("button, input, select, textarea, [role='button'], [role='slider'], a[href], [contenteditable='true']")) return;
    const movement = event.shiftKey ? 110 : 46;
    if (
      mapScope === "earth" &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "0"].includes(event.key)
    ) {
      cancelEarthViewAnimation("user-keyboard");
    }
    if (event.key === "ArrowLeft") {
      if (mapScope === "earth") japanView.earthOffsetX += movement;
      else japanView.centerX -= movement;
    } else if (event.key === "ArrowRight") {
      if (mapScope === "earth") japanView.earthOffsetX -= movement;
      else japanView.centerX += movement;
    } else if (event.key === "ArrowUp") {
      if (mapScope === "earth") japanView.earthOffsetY += movement;
      else japanView.centerY -= movement;
    } else if (event.key === "ArrowDown") {
      if (mapScope === "earth") japanView.earthOffsetY -= movement;
      else japanView.centerY += movement;
    } else if ((event.key === "+" || event.key === "=") && mapScope === "earth") {
      const rect = japanMap.getBoundingClientRect();
      setEarthZoom(japanView.earthZoom * 1.35, rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else if ((event.key === "-" || event.key === "_") && mapScope === "earth") {
      const rect = japanMap.getBoundingClientRect();
      setEarthZoom(japanView.earthZoom / 1.35, rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else if (event.key === "0" && mapScope === "earth") {
      event.preventDefault();
      event.stopPropagation();
      resetJapanView();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const rect = japanMap.getBoundingClientRect();
      addJapanPulse(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (["map01", "map03", "map08"].includes(storyModeDetour?.kind)) {
        if (storyModeDetour.kind === "map01") storyModeDetour.views.add("temperature_anomaly");
        updateSignalInterface();
        window.dispatchEvent(new CustomEvent("gaia:story-map-interaction", {
          detail: {
            kind: storyModeDetour.kind,
            keyboard: true,
            ...(storyModeDetour.kind === "map01" ? { view: "temperature_anomaly" } : {}),
          },
        }));
      }
      return;
    } else {
      return;
    }
    event.preventDefault();
    if (mapScope === "earth") {
      japanView.earthProjection = getEarthProjection(japanMap.getBoundingClientRect());
    }
    japanTilesDirty = true;
  });

  canvas.addEventListener("pointerdown", (event) => {
    pointer.id = event.pointerId;
    pointer.down = true;
    canvas.setPointerCapture(event.pointerId);
    updatePointer(event, true);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (pointer.id !== null && pointer.id !== event.pointerId) {
      return;
    }
    updatePointer(event);
  });

  const releasePointer = (event) => {
    if (pointer.id !== null && pointer.id !== event.pointerId) {
      return;
    }
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    pointer.down = false;
    pointer.id = null;
    if (event.type === "pointerup" && storyModeDetour?.kind === "abstract07") {
      window.dispatchEvent(new CustomEvent("gaia:story-abstract-interaction", {
        detail: { kind: "abstract07" },
      }));
    }
  };

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("keydown", (event) => {
    if (storyModeDetour?.kind !== "abstract07" || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    pointer.energy = Math.max(pointer.energy, 1);
    window.dispatchEvent(new CustomEvent("gaia:story-abstract-interaction", {
      detail: { kind: "abstract07", keyboard: true },
    }));
  });
  canvas.addEventListener("pointerleave", (event) => {
    if (!pointer.down && event.pointerType === "mouse") {
      pointer.energy *= 0.6;
    }
  });

  const updateSourceHash = (isOpen) => {
    const nextHash = isOpen ? "#source" : "#top";
    if (window.location.hash === nextHash) {
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash}`,
    );
  };

  const openSource = ({ updateHash = true } = {}) => {
    if (sourceIsOpen) {
      return;
    }
    if (japanIsOpen) {
      closeJapan({ restoreFocus: false, updateHash: false });
    }
    if (conceptIsOpen) {
      closeConcept({ restoreFocus: false, updateHash: false });
    }
    sourceIsOpen = true;
    experience.classList.add("source-open");
    sourceButton.setAttribute("aria-expanded", "true");
    sourceButton.setAttribute("aria-label", "GLSLコードを閉じる");
    sourcePanel.setAttribute("aria-hidden", "false");
    sourceScrim.setAttribute("aria-hidden", "false");
    sourcePanel.inert = false;
    if (updateHash) {
      updateSourceHash(true);
    }
    requestAnimationFrame(() => sourceClose.focus({ preventScroll: true }));
  };

  const closeSource = ({ restoreFocus = true, updateHash = true } = {}) => {
    if (!sourceIsOpen) {
      return;
    }
    sourceIsOpen = false;
    experience.classList.remove("source-open");
    sourceButton.setAttribute("aria-expanded", "false");
    sourceButton.setAttribute("aria-label", "GLSLコードを表示");
    sourcePanel.setAttribute("aria-hidden", "true");
    sourceScrim.setAttribute("aria-hidden", "true");
    sourcePanel.inert = true;
    if (updateHash) {
      updateSourceHash(false);
    }
    if (restoreFocus) {
      sourceButton.focus({ preventScroll: true });
    }
  };

  const updateConceptHash = (isOpen) => {
    const nextHash = isOpen ? "#concept" : "#top";
    if (window.location.hash === nextHash) {
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash}`,
    );
  };

  const openConcept = ({ updateHash = true } = {}) => {
    if (conceptIsOpen) {
      return;
    }
    if (sourceIsOpen) {
      closeSource({ restoreFocus: false, updateHash: false });
    }
    if (japanIsOpen) {
      closeJapan({ restoreFocus: false, updateHash: false });
    }
    if (introIsOpen) {
      closeIntro({ restoreFocus: false });
    }

    conceptIsOpen = true;
    experience.classList.add("concept-open");
    conceptOpen.setAttribute("aria-expanded", "true");
    conceptPanel.setAttribute("aria-hidden", "false");
    sourceScrim.setAttribute("aria-hidden", "false");
    conceptPanel.inert = false;
    renderConcept();
    conceptScroll.scrollTop = 0;
    if (updateHash) {
      updateConceptHash(true);
    }
    requestAnimationFrame(() => conceptClose.focus({ preventScroll: true }));
  };

  const closeConcept = ({ restoreFocus = true, updateHash = true } = {}) => {
    if (!conceptIsOpen) {
      return;
    }
    conceptIsOpen = false;
    experience.classList.remove("concept-open");
    conceptOpen.setAttribute("aria-expanded", "false");
    conceptPanel.setAttribute("aria-hidden", "true");
    sourceScrim.setAttribute("aria-hidden", "true");
    conceptPanel.inert = true;
    if (updateHash) {
      updateConceptHash(false);
    }
    if (restoreFocus) {
      conceptOpen.focus({ preventScroll: true });
    }
  };

  const updateJapanHash = (isOpen) => {
    const nextHash = isOpen ? "#world" : "#top";
    if (window.location.hash === nextHash) {
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash}`,
    );
  };

  const setEarthControlsDisabled = (disabled) => {
    previousModeButton.disabled = disabled;
    nextModeButton.disabled = disabled;
    autoButton.disabled = disabled;
    sourceButton.disabled = disabled;
    conceptOpen.disabled = disabled;
    resetButton.disabled = disabled;
    modeButtons.forEach((button) => {
      button.disabled = disabled;
    });
  };

  const openJapanData = () => {
    if (!japanIsOpen || japanDataIsOpen) {
      return;
    }
    const activeLiveId = japanLayer.dataset.liveExhibit;
    const liveExhibit = globalThis.GaiaLiveExhibits?.definitions?.find?.((candidate) => candidate.id === activeLiveId);
    const exhibitSources = globalThis.GaiaFoodExhibits?.getSourceInfo?.() || globalThis.GaiaMarineCod?.getSourceInfo?.()
      || globalThis.GaiaEstatExhibits?.getSourceInfo?.()
      || globalThis.GaiaFirmsExhibit?.getSourceInfo?.()
      || globalThis.GaiaPlanetSignals?.getSourceInfo?.();
    if (exhibitSources) {
      dataLedger.updateExhibitSources(exhibitSources);
    } else if (liveExhibit) {
      dataLedger.updateLiveExhibit(liveExhibit, globalThis.GaiaLiveData?.getState?.() || {});
    } else {
      const signalMode = getActiveSignalMode();
      if (signalMode && gaiaSnapshot) {
        dataLedger.updateMode(
          { ...signalMode, titleJa: modes[modeToIndex].titleJa },
          formatMapModeNumber(modeToIndex),
          gaiaSnapshot.generatedAt,
        );
      }
    }
    japanDataReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : japanDataButton;
    japanDataIsOpen = true;
    japanDataPanel.inert = false;
    japanDataPanel.setAttribute("aria-hidden", "false");
    japanDataScrim.setAttribute("aria-hidden", "false");
    japanDataScrim.tabIndex = 0;
    japanLayer.querySelectorAll('[aria-controls="japan-data-panel"]').forEach(button => button.setAttribute("aria-expanded", "true"));
    japanDataPanel.querySelector(".japan-data-scroll").scrollTop = 0;
    japanLayer.classList.add("japan-data-open");
    requestAnimationFrame(() => japanDataClose.focus({ preventScroll: true }));
  };

  const closeJapanData = ({ restoreFocus = true } = {}) => {
    if (!japanDataIsOpen) {
      return;
    }
    const focusTarget = japanDataReturnFocus?.isConnected ? japanDataReturnFocus : japanDataButton;
    if (japanDataPanel.contains(document.activeElement)) {
      if (restoreFocus) {
        focusTarget.focus({ preventScroll: true });
      } else {
        document.activeElement?.blur?.();
      }
    }
    japanDataIsOpen = false;
    japanDataPanel.inert = true;
    japanDataPanel.setAttribute("aria-hidden", "true");
    japanDataScrim.setAttribute("aria-hidden", "true");
    japanDataScrim.tabIndex = -1;
    japanLayer.querySelectorAll('[aria-controls="japan-data-panel"]').forEach(button => button.setAttribute("aria-expanded", "false"));
    japanLayer.classList.remove("japan-data-open");
    if (restoreFocus && document.activeElement !== focusTarget) {
      focusTarget.focus({ preventScroll: true });
    }
  };

  const openJapan = ({
    updateHash = true,
    restoreFocusOnClose = true,
    respectUrlMode = true,
    focusModeBank = false,
    entryExhibit = null,
  } = {}) => {
    const hashExhibit = respectUrlMode ? globalThis.GaiaMapRoute.numberFromHash(window.location.hash) : null;
    if (japanIsOpen) {
      const requestedEntry = Number(entryExhibit) || hashExhibit;
      if (requestedEntry) {
        // Hash navigation is an explicit selection, including while cruising.
        globalThis.GaiaMapCruise?.stop?.();
        window.clearTimeout(mapModeGuideTimer);
        mapModeGuideRequest += 1;
        mapEntryGuidePending = false;
        pendingMapTitle = null;
        window.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
        closeJapanData({ restoreFocus: false });
        closeJapanPoi();
        japanLayer.dataset.mapEntryExhibit = String(requestedEntry);
        window.dispatchEvent(new CustomEvent("gaia:map-route-change"));
      }
      return;
    }
    const previousExhibit = Number(japanModeNumber.textContent);
    const usesExplorationSoundtrack = !document.body.classList.contains("novel-open")
      && !experience.classList.contains("gx-story-open");
    if (usesExplorationSoundtrack) {
      void window.GaiaOpeningAudio?.switchTrack?.("moonreopen", 0.6);
    }
    if (sourceIsOpen) {
      closeSource({ restoreFocus: false, updateHash: false });
    }
    if (conceptIsOpen) {
      closeConcept({ restoreFocus: false, updateHash: false });
    }
    if (introIsOpen) {
      closeIntro({ restoreFocus: false });
    }

    window.clearTimeout(japanCloseTimer);
    japanIsOpen = true;
    japanRestoreFocus = restoreFocusOnClose;
    japanLayer.hidden = false;
    japanLayer.inert = false;
    japanLayer.setAttribute("aria-hidden", "false");
    japanLayer.classList.remove("is-closing");
    resetMobileMapUi();
    japanButton.setAttribute("aria-pressed", "true");
    japanButton.title = "Close map";
    experience.classList.add("japan-open");
    setEarthControlsDisabled(true);
    japanTilesDirty = true;
    nextAutoAt = performance.now() + AUTO_INTERVAL;
    const mapParameters = new URLSearchParams(window.location.search);
    const requestedDataLayer = mapParameters.get("layer");
    const requestedMode = Number(mapParameters.get("mode"));
    const requestedTimelinePosition = Number(mapParameters.get("time"));
    if (
      respectUrlMode &&
      Number.isInteger(requestedMode) &&
      requestedMode >= 1 &&
      requestedMode <= MODE_COUNT
    ) {
      mapModeIndex = requestedMode - 1;
      selectMode(mapModeIndex);
    }
    syncIntegratedMapLight();
    setMapScope("earth");
    restartCo2Timeline(
      Number.isFinite(requestedTimelinePosition)
        ? clamp(requestedTimelinePosition, 0, 100)
        : 0,
    );
    if (requestedDataLayer === "history" || requestedDataLayer === "snapshot") {
      setJapanDataLayer(requestedDataLayer);
    } else if (requestedDataLayer === "live") {
      setJapanDataLayer("snapshot");
    } else if (isTheme(5)) {
      setJapanDataLayer("snapshot");
    }
    updateJapanDataInterface();
    restartMapPlotReveal("map-open");

    if (updateHash) {
      updateJapanHash(true);
    }

    // Keep old ?mode= links tied to their stable 1–9 renderer IDs. The public
    // ?exhibit= follows the public catalogue, including lazy providers. The
    // numbered hash takes priority so a copied URL always matches the screen.
    const publicExhibit = Number(mapParameters.get("exhibit"));
    const legacyMode = respectUrlMode && Number.isInteger(requestedMode) && requestedMode >= 1 && requestedMode <= MODE_COUNT;
    const requestedEntry = Number(entryExhibit) || hashExhibit || (respectUrlMode && Number.isInteger(publicExhibit) && publicExhibit >= 1 && publicExhibit <= globalThis.GaiaMapCategories.exhibitCount
      ? publicExhibit : legacyMode ? Number(formatMapModeNumber(mapModeIndex)) : mapHasOpened ? previousExhibit : 1);
    // The category router intentionally doesn't re-click an already-current
    // base chapter. A direct entry to that chapter still needs its lazy data.
    const currentBaseEntry = japanModeButtons.find(button => Number(button.textContent) === requestedEntry && button.getAttribute("aria-current") === "true");
    if (currentBaseEntry) {
      void loadGaiaSignals();
      if (modes[modeToIndex].id === "breathing-earth" && ovationAuroraState.source === "pending") {
        ovationAuroraState.source = "loading";
        void loadOvationAuroraForecast();
      }
    }
    if (!storyModeDetour) japanLayer.dataset.mapEntryExhibit = String(requestedEntry);
    else delete japanLayer.dataset.mapEntryExhibit;
    mapHasOpened = true;
    window.dispatchEvent(new CustomEvent("gaia:japan-open", { detail: { skipGuide: hashExhibit !== null } }));
    requestAnimationFrame(() => {
      renderJapanTiles();
      if (!japanLayer.matches(".is-marine-cod-exhibit, .is-food-exhibit")) animateEarthViewForMode(modeToIndex);
      if (document.body.classList.contains("gaia-tour-open")) return;
      if (new URLSearchParams(window.location.search).get("panel") === "data") {
        openJapanData();
      } else if (focusModeBank) {
        globalThis.GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === requestedEntry)?.focus({ preventScroll: true });
      } else {
        japanClose.focus({ preventScroll: true });
      }
    });
  };

  const closeJapan = ({
    restoreFocus = japanRestoreFocus,
    updateHash = true,
  } = {}) => {
    if (!japanIsOpen) {
      return;
    }
    window.GaiaModeEntryGuide?.close?.("map", { restoreFocus: false });
    const usesExplorationSoundtrack = !document.body.classList.contains("novel-open")
      && !experience.classList.contains("gx-story-open");
    if (usesExplorationSoundtrack) {
      void window.GaiaOpeningAudio?.switchTrack?.("senseware", 0.6);
    }

    closeJapanData({ restoreFocus: false });
    clearJapanPoiHover();
    closeJapanPoi();
    cancelMapTitleTransition();
    cancelEarthViewAnimation("map-closed");
    japanIsOpen = false;
    window.dispatchEvent(new CustomEvent("gaia:japan-close"));
    syncIntegratedMapLight();
    japanLayer.classList.add("is-closing");
    japanLayer.setAttribute("aria-hidden", "true");
    japanLayer.inert = true;
    japanButton.setAttribute("aria-pressed", "false");
    japanButton.title = "Earth map";
    experience.classList.remove("japan-open");
    setEarthControlsDisabled(false);
    nextAutoAt = performance.now() + AUTO_INTERVAL;

    if (updateHash) {
      updateJapanHash(false);
    }
    if (restoreFocus) {
      japanButton.focus({ preventScroll: true });
    }

    const closeDelay = reducedMotion ? 0 : 420;
    japanCloseTimer = window.setTimeout(() => {
      if (!japanIsOpen) {
        japanLayer.hidden = true;
      }
    }, closeDelay);
  };

  let mapModeGuideTimer = 0;
  let mapModeGuideRequest = 0;
  const firstVisibleMapGuideTarget = (...selectors) => selectors
    .flatMap((selector) => [...japanLayer.querySelectorAll(selector)])
    .find((element) => {
      if (!(element instanceof HTMLElement) || element.closest("[hidden], [inert]")) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }) || null;
  const mapGuideSelector = () => firstVisibleMapGuideTarget('[data-map-menu-toggle]', '[data-mobile-sheet="exhibits"]', '[data-map-bank-toggle]', ".map-dock-bank-trigger", ".gaia-live-deck-selector-toggle", ".gaia-estat-selector-toggle", "#map-mobile-bank-toggle");
  window.GaiaModeEntryGuide?.register?.("map", {
    version: "v5",
    repeatEveryEntry: true,
    kicker: "地図 / 操作ガイド",
    finishLabel: "地図を楽しむ",
    focusTarget: mapGuideSelector,
    features: {
      illustrated: true,
      entryTitle: "世界を観測する",
      imageWidth: 1774,
      imageHeight: 887,
      visitNote: "地図を開くたびにご案内します。",
      kicker: "みずとあめがご案内！ / 3つの楽しみ方",
      title: "さあ、地球のふしぎを見つけにいこう！",
      copy: `動く地球をながめる。時間を旅する。「なぜ？」を探る。${globalThis.GaiaMapCategories.exhibitCount}の展示を、自分の手で楽しもう。`,
      startLabel: "地球を見にいく",
      note: "",
      items: [
        { icon: "live", image: "./assets/modes/guide-map-live-mizu-ame-v2.webp", tag: "リアルタイムの演出", title: "いま、地球で何が起きてる？", copy: "火災・風・地震が、地図の光や動きに。公開データで地球のいまを発見！ ライブと保存値の違いも確認できます。" },
        { icon: "timeline", image: "./assets/modes/guide-map-time-mizu-ame-v2.webp", tag: "時間を動かしてみよう", title: "過去から、変化をたどろう！", copy: "年を動かすと、CO₂や気温の色・数値も変化。気になる年へ移動して、世界の変わり方を見つけよう。" },
        { icon: "analysis", image: "./assets/modes/guide-map-discovery-mizu-ame-v2.webp", tag: "統計分析・AI分析", title: "「なぜ？」が、次の発見に。", copy: "グラフで違いやつながりを比べよう。\n気になることはAIにも質問して、考察を広げよう。\n※ AIへの質問には、ご自身のAPIキーが必要です。" },
      ],
    },
    avoid: ".gaia-live-exhibit-readout, .gaia-firms-readout, .gaia-planet-signals-readout, .gaia-estat-readout, #map-mobile-toolbar",
    available: () => japanIsOpen && !japanLayer.hidden && !japanLayer.dataset.storyMode
      && !japanLayer.classList.contains("japan-data-open")
      && !document.body.matches(".gaia-tour-open, .novel-open, .gaia-statistics-open"),
    ready: () => Boolean(mapGuideSelector() && window.GaiaMapDemo),
    steps: [
      {
        target: mapGuideSelector,
        title: "左下から、展示を選ぶ",
        copy: `左下の「展示メニュー」から全${globalThis.GaiaMapCategories.exhibitCount}展示を選べます。「次の展示へ」「前の展示へ」でも順に巡れます。赤いLIVEは定期更新の展示です（保存値を含みます）。`,
      },
      {
        target: () => firstVisibleMapGuideTarget('.gaia-firms-primary', '.gaia-planet-primary', '.gaia-estat-primary', '.gaia-live-exhibit-value', '.signal-console-map [data-signal-value]'),
        title: "観測値と単位を読む",
        copy: "下のパネルは、いま表示している展示の観測値です。数値だけでなく、単位・対象地域・観測時点を合わせて確認できます。",
      },
      {
        target: () => firstVisibleMapGuideTarget('.signal-console-map [data-signal-time]', '[data-estat-month]', '[data-firms-progress]'),
        title: "時間をたどる",
        copy: "スライダーを動かすと、表示する時点と地図の観測値が連動して変わります。対象期間は展示ごとに異なります。",
      },
      {
        target: () => firstVisibleMapGuideTarget('[data-mobile-sheet="tools"]', ".gaia-map-action--source", ".map-dock-action--source", "[data-live-deck-source]", "#japan-data-button"),
        title: "データの出典を確認する",
        copy: "表示中の数値がどの公開データから来たか、実測・補完・試算の区分まで確認できます。スマホでは「操作」から出典や統計分析を開きます。",
      },
      {
        target: () => firstVisibleMapGuideTarget('[data-mobile-sheet="tools"]', ".gaia-map-action--analysis", ".map-dock-action--statistics", "[data-live-deck-analysis]", "#gaia-statistics-button", "#gaia-statistics-button-mobile"),
        title: "データを詳しく分析する",
        copy: "「統計分析」から、グラフの見た目と調べたい問いを選べます。チャート・数値一覧・元データ・解説で詳しく確認できます。スマホでは「操作」内にあります。",
      },
      {
        target: () => firstVisibleMapGuideTarget('[data-mobile-sheet="reading"]', '.gaia-firms-legend', '.gaia-planet-signals-legend', '.gaia-live-metric-legend', '.gaia-estat-heat-legend', '.signal-encoding-legend-dock', '#map-reading-guide'),
        title: "色と記号の意味を知る",
        copy: "凡例で、色や点の大きさが何を表すか確認できます。スマホでは下の「読み方・凡例」から開けます。地図はドラッグで移動し、ホイールや2本指で拡大・縮小できます。",
      },
      {
        target: () => firstVisibleMapGuideTarget('#gaia-map-cruise-toggle', '[data-mobile-sheet="tools"]'),
        title: "展示を巡る・一つの展示を再生する",
        copy: `「自動表示」は一つの展示の年・時刻などを再生します。「クルージングモード」は展示も順に切り替えて巡ります。スマホでは「操作」内にあります。`,
      },
    ],
  });
  window.GaiaModeEntryGuide?.mountReplay?.("map", japanLayer, { label: "地図ガイド" });
  const scheduleMapModeGuide = (event) => {
    const skipGuide = event?.detail?.skipGuide === true;
    const request = ++mapModeGuideRequest;
    mapEntryGuidePending = true;
    pendingMapTitle = `${japanTitle.dataset.exhibitNumber}　${japanTitle.textContent}`;
    cancelMapTitleTransition();
    window.clearTimeout(mapModeGuideTimer);
    mapModeGuideTimer = window.setTimeout(async () => {
      if (!skipGuide && !document.body.classList.contains("gaia-tour-open")) await window.GaiaModeEntryGuide?.open?.("map");
      const waitForGuide = () => {
        if (request !== mapModeGuideRequest || !japanIsOpen) return;
        const guide = document.querySelector('#gaia-mode-entry-guide');
        if (window.GaiaModeEntryGuide?.getState?.().id === 'map' || (guide && !guide.hidden)) {
          window.setTimeout(waitForGuide, 50);
          return;
        }
        mapEntryGuidePending = false;
        const title = pendingMapTitle;
        pendingMapTitle = null;
        if (japanIsOpen && title) { mapTitleTransitionTitle = ''; animateMapTitleTransition(title); }
      };
      waitForGuide();
    }, reducedMotion ? 80 : 650);
  };
  window.addEventListener("gaia:japan-open", scheduleMapModeGuide);
  if (japanIsOpen) scheduleMapModeGuide();

  const introEntryGuideSteps = Object.freeze([
    {
      target: document.querySelector("[data-intro-guide='map']"),
      copy: "世界の公開観測データを地図に重ね、地点・年代・変化をたどれます。",
      preview: "./assets/guide-previews/map.jpg?v=current-guide-20260906-previews-20260913",
      previewAlt: "風速と展示移動ボタンを表示した世界観測マップの画面",
    },
    {
      target: document.querySelector("[data-intro-guide='sensor']"),
      copy: "実物のセンサーをつなぎ、自分の観測点を地球の感覚器として追加できます。",
      preview: "./assets/guide-previews/sensor.jpg?v=current-guide-20260906-previews-20260913",
      previewAlt: "公開された観測点を表示した、みんなのセンサーの地図画面",
    },
    {
      target: document.querySelector("[data-intro-guide='character']"),
      copy: "物語に登場する4人の設定やビジュアル資料を確認できます。",
      preview: "./assets/guide-previews/character.jpg?v=current-guide-20260906-previews-20260913",
      previewAlt: "雨宮周のプロフィールを表示したキャラクター設定画面",
    },
    {
      target: document.querySelector("[data-intro-guide='sound']"),
      copy: "作品の音楽を一覧で再生し、シーンを支えるサウンドを鑑賞できます。",
      preview: "./assets/guide-previews/sound.jpg?v=current-guide-20260906-previews-20260913",
      previewAlt: "収録曲一覧と再生パネルを表示したサウンド鑑賞画面",
    },
  ].filter(({ target }) => target instanceof Element));
  const introEntryGuide = document.createElement("section");
  introEntryGuide.className = "intro-entry-guide";
  introEntryGuide.id = "intro-entry-guide";
  introEntryGuide.hidden = true;
  introEntryGuide.inert = true;
  introEntryGuide.tabIndex = 0;
  introEntryGuide.setAttribute("role", "dialog");
  introEntryGuide.setAttribute("aria-modal", "false");
  introEntryGuide.setAttribute("aria-label", "データ入口ガイド");
  introEntryGuide.setAttribute("aria-describedby", "intro-entry-guide-copy");
  introEntryGuide.innerHTML = `
    <div class="intro-entry-guide-shade" aria-hidden="true"></div>
    <article class="intro-entry-guide-bubble" aria-live="polite" aria-atomic="true">
      <div class="intro-entry-guide-surface">
        <figure class="intro-entry-guide-preview">
          <img data-intro-entry-guide-preview width="1440" height="810" decoding="async" alt="" />
        </figure>
        <p class="intro-entry-guide-copy" id="intro-entry-guide-copy" data-intro-entry-guide-copy></p>
      </div>
    </article>`;
  introLayer.append(introEntryGuide);

  const introEntryGuideShade = introEntryGuide.querySelector(".intro-entry-guide-shade");
  const introEntryGuideBubble = introEntryGuide.querySelector(".intro-entry-guide-bubble");
  const introEntryGuideSurface = introEntryGuide.querySelector(".intro-entry-guide-surface");
  const introEntryGuidePreview = introEntryGuide.querySelector(".intro-entry-guide-preview");
  const introEntryGuidePreviewImage = introEntryGuide.querySelector("[data-intro-entry-guide-preview]");
  let introEntryGuideActive = false;
  let introEntryGuideIndex = 0;
  let introEntryGuidePositionFrame = 0;
  let introEntryGuideStartTimer = 0;
  let introEntryGuideSettleTimer = 0;
  let introEntryGuideRevealFrame = 0;
  let introEntryGuideCloseTimer = 0;
  let introEntryGuideGeneration = 0;
  let introEntryGuideEcho = null;
  let introEntryGuideEchoTimer = 0;
  let introEntryGuideImagesWarmed = false;
  const introEntryGuideMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const clearIntroEntryGuideEcho = () => {
    window.clearTimeout(introEntryGuideEchoTimer);
    introEntryGuideEchoTimer = 0;
    introEntryGuideEcho?.remove();
    introEntryGuideEcho = null;
  };
  const releaseIntroEntryGuideSurface = (nextTarget) => {
    clearIntroEntryGuideEcho();
    if (introEntryGuideMotion.matches || !introEntryGuide.classList.contains("is-presented")) return;
    const opacity = Number(getComputedStyle(introEntryGuideSurface).opacity);
    if (opacity < 0.05) return;
    const rect = introEntryGuideSurface.getBoundingClientRect();
    const destination = nextTarget?.getBoundingClientRect();
    const drift = destination ? Math.max(-18, Math.min(18, (destination.left + destination.width / 2 - rect.left - rect.width / 2) * 0.06)) : 0;
    const echo = introEntryGuideSurface.cloneNode(true);
    echo.classList.add("intro-entry-guide-echo");
    echo.setAttribute("aria-hidden", "true");
    echo.inert = true;
    // A visual afterimage must never duplicate live descriptions or selectors.
    echo.querySelectorAll("*").forEach((element) => {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name === "id" || attribute.name.startsWith("data-intro-entry-guide")) element.removeAttribute(attribute.name);
      }
    });
    Object.assign(echo.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    echo.style.setProperty("--intro-guide-echo-opacity", String(opacity));
    echo.style.setProperty("--intro-guide-echo-x", `${drift}px`);
    const previewHeight = introEntryGuideBubble.style.getPropertyValue("--intro-guide-preview-height");
    if (previewHeight) echo.style.setProperty("--intro-guide-preview-height", previewHeight);
    introEntryGuide.append(echo);
    introEntryGuideEcho = echo;
    introEntryGuideEchoTimer = window.setTimeout(clearIntroEntryGuideEcho, 640);
  };

  const clearIntroEntryGuideTarget = () => {
    introEntryGuideSteps.forEach(({ target }) => target.classList.remove("is-intro-entry-guide-target"));
  };
  const positionIntroEntryGuide = () => {
    introEntryGuidePositionFrame = 0;
    if (!introEntryGuideActive || !(introEntryGuideBubble instanceof HTMLElement)) return;
    const target = introEntryGuideSteps[introEntryGuideIndex]?.target;
    if (!(target instanceof HTMLElement) || target.getClientRects().length === 0) return;
    const targetRect = target.getBoundingClientRect();
    if (introEntryGuideShade instanceof HTMLElement) {
      introEntryGuideShade.style.setProperty("--intro-guide-focus-left", `${targetRect.left}px`);
      introEntryGuideShade.style.setProperty("--intro-guide-focus-top", `${targetRect.top}px`);
      introEntryGuideShade.style.setProperty("--intro-guide-focus-width", `${targetRect.width}px`);
      introEntryGuideShade.style.setProperty("--intro-guide-focus-height", `${targetRect.height}px`);
      introEntryGuideShade.style.setProperty("--intro-guide-focus-radius", getComputedStyle(target).borderRadius || "0px");
    }
    const compactLandscape = innerHeight <= 430 && innerWidth > innerHeight;
    const viewportInset = compactLandscape ? 8 : 12;
    const gap = compactLandscape ? 12 : 18;
    introEntryGuideBubble.style.setProperty("--intro-guide-gap", `${gap}px`);
    // Keep the photograph and its target visible even on short portrait phones.
    introEntryGuideBubble.style.removeProperty("--intro-guide-preview-height");
    let bubbleRect = introEntryGuideBubble.getBoundingClientRect();
    if (!introEntryGuidePreview.hidden) {
      const previewHeight = introEntryGuidePreview.getBoundingClientRect().height;
      const available = Math.max(targetRect.top - gap - viewportInset, innerHeight - targetRect.bottom - gap - viewportInset);
      const roomForPreview = Math.max(48, available - (bubbleRect.height - previewHeight));
      if (roomForPreview < previewHeight) {
        introEntryGuideBubble.style.setProperty("--intro-guide-preview-height", `${Math.floor(roomForPreview)}px`);
        bubbleRect = introEntryGuideBubble.getBoundingClientRect();
      }
    }
    const preferredLeft = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2;
    const left = Math.max(viewportInset, Math.min(innerWidth - bubbleRect.width - viewportInset, preferredLeft));
    const below = targetRect.bottom + gap;
    const above = targetRect.top - bubbleRect.height - gap;
    const placeBelow = below + bubbleRect.height <= innerHeight - viewportInset;
    const preferredTop = placeBelow ? below : above;
    const top = Math.max(
      viewportInset,
      Math.min(innerHeight - bubbleRect.height - viewportInset, preferredTop),
    );
    const arrowLeft = Math.max(24, Math.min(bubbleRect.width - 24, targetRect.left + targetRect.width / 2 - left));
    introEntryGuideBubble.style.left = `${Math.round(left)}px`;
    introEntryGuideBubble.style.top = `${Math.round(top)}px`;
    introEntryGuideBubble.style.setProperty("--intro-guide-arrow-left", `${Math.round(arrowLeft)}px`);
    introEntryGuideBubble.dataset.placement = placeBelow ? "below" : "above";
  };
  const scheduleIntroEntryGuidePosition = () => {
    cancelAnimationFrame(introEntryGuidePositionFrame);
    introEntryGuidePositionFrame = requestAnimationFrame(() => {
      introEntryGuidePositionFrame = requestAnimationFrame(positionIntroEntryGuide);
    });
  };
  const reflowIntroEntryGuide = () => {
    clearIntroEntryGuideEcho();
    if (introEntryGuideActive) {
      const target = introEntryGuideSteps[introEntryGuideIndex]?.target;
      if (target instanceof HTMLElement) {
        const targetRect = target.getBoundingClientRect();
        if (targetRect.top < 12 || targetRect.bottom > innerHeight - 12) {
          target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        }
      }
    }
    scheduleIntroEntryGuidePosition();
    window.clearTimeout(introEntryGuideSettleTimer);
    introEntryGuideSettleTimer = window.setTimeout(scheduleIntroEntryGuidePosition, reducedMotion ? 0 : 120);
  };
  const setIntroEntryGuideStep = (nextIndex) => {
    if (!introEntryGuideActive || introEntryGuideSteps.length === 0) return;
    const generation = ++introEntryGuideGeneration;
    cancelAnimationFrame(introEntryGuideRevealFrame);
    cancelAnimationFrame(introEntryGuidePositionFrame);
    introEntryGuideIndex = Math.max(0, Math.min(introEntryGuideSteps.length - 1, nextIndex));
    const step = introEntryGuideSteps[introEntryGuideIndex];
    releaseIntroEntryGuideSurface(step.target);
    introEntryGuide.classList.remove("is-presented");
    introEntryGuide.classList.toggle("is-changing", Boolean(introEntryGuideEcho));
    clearIntroEntryGuideTarget();
    step.target.classList.add("is-intro-entry-guide-target");
    introEntryGuide.querySelector("[data-intro-entry-guide-copy]").textContent = step.copy;
    if (introEntryGuidePreviewImage instanceof HTMLImageElement) {
      introEntryGuidePreviewImage.src = step.preview;
      introEntryGuidePreviewImage.alt = step.previewAlt;
    }
    if (introEntryGuidePreview instanceof HTMLElement) {
      introEntryGuidePreview.hidden = !step.preview;
    }
    introEntryGuide.dataset.step = String(introEntryGuideIndex + 1);
    const targetRect = step.target.getBoundingClientRect();
    if (targetRect.top < 12 || targetRect.bottom > innerHeight - 12) {
      step.target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    }
    positionIntroEntryGuide();
    // Decode the next real screenshot before it emerges. Superseded image
    // completions cannot reveal the wrong step or reopen a dismissed guide.
    const imageReady = introEntryGuidePreviewImage instanceof HTMLImageElement
      ? introEntryGuidePreviewImage.decode().catch(() => {}) : Promise.resolve();
    void imageReady.then(() => {
      if (!introEntryGuideActive || generation !== introEntryGuideGeneration) return;
      positionIntroEntryGuide();
      introEntryGuideRevealFrame = requestAnimationFrame(() => {
        introEntryGuideRevealFrame = 0;
        if (introEntryGuideActive && generation === introEntryGuideGeneration) {
          introEntryGuide.classList.add("is-visible", "is-presented");
        }
      });
    });
    window.clearTimeout(introEntryGuideSettleTimer);
    introEntryGuideSettleTimer = window.setTimeout(scheduleIntroEntryGuidePosition, reducedMotion ? 0 : 420);
  };
  const closeIntroEntryGuide = ({ restoreFocus = true } = {}) => {
    window.clearTimeout(introEntryGuideStartTimer);
    window.clearTimeout(introEntryGuideSettleTimer);
    introEntryGuideStartTimer = 0;
    introEntryGuideSettleTimer = 0;
    if (!introEntryGuideActive) return;
    ++introEntryGuideGeneration;
    cancelAnimationFrame(introEntryGuideRevealFrame);
    cancelAnimationFrame(introEntryGuidePositionFrame);
    introEntryGuideRevealFrame = 0;
    introEntryGuidePositionFrame = 0;
    releaseIntroEntryGuideSurface();
    introEntryGuideActive = false;
    clearIntroEntryGuideTarget();
    introLayer.classList.remove("is-intro-entry-guide-active");
    introEntryGuide.classList.remove("is-visible", "is-presented", "is-changing");
    introEntryGuide.inert = true;
    introEntryGuide.setAttribute("aria-hidden", "true");
    window.clearTimeout(introEntryGuideCloseTimer);
    introEntryGuideCloseTimer = window.setTimeout(() => {
      introEntryGuideCloseTimer = 0;
      if (!introEntryGuideActive) {
        introEntryGuide.hidden = true;
        clearIntroEntryGuideEcho();
      }
    }, introEntryGuideMotion.matches ? 0 : 640);
    if (restoreFocus) introEntryGuideReplay?.focus({ preventScroll: true });
  };
  const openIntroEntryGuide = () => {
    if (introEntryGuideActive || introEntryGuideSteps.length === 0 || !introIsOpen || introStage !== "path") return;
    window.clearTimeout(introEntryGuideCloseTimer);
    introEntryGuideCloseTimer = 0;
    clearIntroEntryGuideEcho();
    if (!introEntryGuideImagesWarmed) {
      introEntryGuideImagesWarmed = true;
      introEntryGuideSteps.forEach(({ preview }) => { const image = new Image(); image.src = preview; });
    }
    introEntryGuideActive = true;
    introEntryGuide.hidden = false;
    introEntryGuide.inert = false;
    introEntryGuide.setAttribute("aria-hidden", "false");
    introLayer.classList.add("is-intro-entry-guide-active");
    setIntroEntryGuideStep(0);
    introEntryGuide.focus({ preventScroll: true });
  };
  const scheduleIntroEntryGuide = (delay = 2000) => {
    window.clearTimeout(introEntryGuideStartTimer);
    introEntryGuideStartTimer = window.setTimeout(() => {
      introEntryGuideStartTimer = 0;
      openIntroEntryGuide();
    }, delay);
  };
  const advanceIntroEntryGuide = () => {
    if (!introEntryGuideActive) return;
    if (introEntryGuideIndex >= introEntryGuideSteps.length - 1) closeIntroEntryGuide();
    else setIntroEntryGuideStep(introEntryGuideIndex + 1);
  };
  introEntryGuide.addEventListener("click", (event) => {
    if (!introEntryGuideActive) return;
    event.preventDefault();
    advanceIntroEntryGuide();
  });
  introEntryGuide.addEventListener("keydown", (event) => {
    if (!introEntryGuideActive) return;
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); closeIntroEntryGuide(); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); advanceIntroEntryGuide(); }
    else if (event.key === "Tab") { event.preventDefault(); introEntryGuide.focus({ preventScroll: true }); }
  });
  introLayer.addEventListener("keydown", (event) => {
    if (!introEntryGuideActive || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeIntroEntryGuide();
  }, true);
  introEntryGuideReplay?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openIntroEntryGuide();
  });
  introLayer.addEventListener("scroll", scheduleIntroEntryGuidePosition, { passive: true });
  window.addEventListener("resize", reflowIntroEntryGuide, { passive: true });
  introEntryGuideMotion.addEventListener("change", () => {
    if (introEntryGuideMotion.matches) clearIntroEntryGuideEcho();
  });
  globalThis.GaiaIntroEntryGuide = Object.freeze({
    open: openIntroEntryGuide,
    close: closeIntroEntryGuide,
    getState: () => ({
      active: introEntryGuideActive,
      index: introEntryGuideIndex,
      target: introEntryGuideSteps[introEntryGuideIndex]?.target?.dataset.introGuide || null,
    }),
  });

  const openIntro = ({ restoreFocusOnClose = true } = {}) => {
    if (introIsOpen) {
      return;
    }
    if (sourceIsOpen) {
      closeSource({ restoreFocus: false });
    }
    if (conceptIsOpen) {
      closeConcept({ restoreFocus: false });
    }
    if (japanIsOpen) {
      closeJapan({ restoreFocus: false });
    }
    window.clearTimeout(introCloseTimer);
    introIsOpen = true;
    introRestoreFocus = restoreFocusOnClose;
    introLayer.hidden = false;
    introLayer.inert = false;
    introLayer.setAttribute("aria-hidden", "false");
    introLayer.classList.remove("is-closing");
    experience.classList.add("intro-open");
    introSelectedPath = null;
    delete introLayer.dataset.path;
    setIntroVisual();
    syncIntroStoryReturn();
    introPathButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
    updateIntroSelection();
    // During the opening dissolve the next screen is already visible behind it.
    // Present complete cards there instead of exposing staggered empty frames.
    const enteringFromOpening = document.body.classList.contains("gaia-opening-active");
    showIntroStage("path", { revealPanels: !enteringFromOpening });
  };

  const closeIntro = ({ restoreFocus = introRestoreFocus } = {}) => {
    closeIntroEntryGuide({ restoreFocus: false });
    if (!introIsOpen) {
      return;
    }
    introIsOpen = false;
    clearIntroStoryRevealTimers();
    introStoryReturn?.classList.remove("is-apeironcene-awakening");
    clearIntroPanelReveal();
    introLayer.classList.add("is-closing");
    introLayer.setAttribute("aria-hidden", "true");
    introLayer.inert = true;
    experience.classList.remove("intro-open");
    nextAutoAt = performance.now() + AUTO_INTERVAL;

    if (restoreFocus) {
      introButton.focus({ preventScroll: true });
    }

    const closeDelay = reducedMotion ? 0 : 520;
    introCloseTimer = window.setTimeout(() => {
      if (!introIsOpen) {
        introLayer.hidden = true;
      }
    }, closeDelay);
  };

  const clearTourFocus = () => {
    document.querySelectorAll(".gaia-tour-highlight-target").forEach((element) => {
      element.classList.remove("gaia-tour-highlight-target");
      element.removeAttribute("data-gaia-tour-target");
    });
  };
  const focusTourControl = (name) => {
    clearTourFocus();
    const target = {
      start: document.querySelector("[data-intro-path='map']"),
      map: japanMap,
      timeline: japanLayer.querySelector("[data-signal-time]"),
      source: sourcePanel.querySelector("[data-source-tab='raw']"),
      transform: sourcePanel.querySelector("[data-source-tab='transform']"),
      visual: sourcePanel.querySelector("[data-source-tab='visual']"),
      story: document.querySelector("[data-intro-path='novel']"),
      credits: introOpenDataExhibit,
    }[name];
    if (!(target instanceof Element)) return false;
    target.classList.add("gaia-tour-highlight-target");
    target.setAttribute("data-gaia-tour-target", name);
    if (name === "credits") target.scrollIntoView({ block: "center", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    return true;
  };
  const getTourReceipt = () => {
    const signalMode = getActiveSignalMode();
    const visualMode = modes[modeToIndex];
    if (!signalMode || !visualMode) throw new Error(gaiaSnapshotError || "公開データを読み込めませんでした。");
    const observation = captureMapObservation();
    return {
      title: visualMode.titleJa,
      source: observation.metrics.map((metric) => `${metric.label} ${formatObservationNumber(metric.value, 2)}${metric.unit ? ` ${metric.unit}` : ""}`).join(" / "),
      at: observation.subtitle,
      provider: [...new Set((signalMode.datasets || []).map((dataset) => dataset.organisation).filter(Boolean))].join(" / "),
      classification: observation.provenance.classification || "SOURCE",
      transform: modeDataNarratives[visualMode.id] || "保存済みの公開記録を表示用の尺度へ変換します。",
      visual: visualMode.description,
    };
  };

  const mapObservationAdapter = Object.freeze({
    getViewportRect: readJapanMapRect,
    getTimelineDuration: getActiveTimelineDuration,
    previewCruisePoi: poi => {
      const rect = japanMap.getBoundingClientRect();
      showJapanPoiPreview(poi, rect.left + rect.width * .5, rect.top + rect.height * .55);
    },
    // Lazy exhibits reuse the exact cached polygons already used by exhibit 13.
    getCountryGeometry: () => ({ state: naturalEarthCountryState, error: naturalEarthCountryError, countries: naturalEarthCountryRecords }),
    getCountryPath: getNaturalEarthCountryGeographicPath,
    retryCountryGeometry: () => { if (naturalEarthCountryState === "error") void loadNaturalEarthCountries(); },
    waitSignalsReady: async () => {
      // Complete data is requested explicitly by analysis/export consumers;
      // merely opening an annual or live map never starts these ten chunks.
      const snapshot = await loadGaiaSignals({ all: true });
      if (!snapshot) throw new Error(gaiaSnapshotError || "公開データを読み込めませんでした。");
      return snapshot;
    },
    selectMode: (index) => {
      const requested = Number(index);
      if (!Number.isInteger(requested) || requested < 0 || requested >= MODE_COUNT) return false;
      mapModeIndex = requested;
      selectMode(requested);
      return true;
    },
    setSignalTime: (position) => {
      signalTimePosition = clamp(Number(position) || 0, 0, 100);
      if (storyModeDetour) {
        co2TimelineHeld = false;
        resumeTimelineAfterManualSeek();
      } else {
        pauseMapTimeline();
        closeJapanPoi();
        clearJapanPoiHover();
      }
      signalTimeInputs.forEach((input) => { input.value = String(signalTimePosition); });
      updateSignalInterface();
      return signalTimePosition;
    },
    focusEarthLocation,
    closePoi: () => { clearJapanPoiHover(); closeJapanPoi(); },
    getPoiInteraction: () => {
      const identity = (poi) => poi?.type === "exhibit"
        ? { index: poi.index, exhibitId: poi.record.exhibitId }
        : null;
      return { hovered: identity(hoveredJapanPoi), selected: identity(selectedJapanPoi) };
    },
    zoomEarthBy,
    zoomEarthAtLocation,
    openMap: () => {
      if (!japanIsOpen) openJapan({ updateHash: false, restoreFocusOnClose: false, respectUrlMode: false, entryExhibit: Number(formatMapModeNumber(mapModeIndex)) });
    },
    closeMap: () => {
      if (japanIsOpen) closeJapan({ restoreFocus: false, updateHash: false });
    },
    showIntro: () => {
      if (japanIsOpen) closeJapan({ restoreFocus: false, updateHash: false });
      if (sourceIsOpen) closeSource({ restoreFocus: false, updateHash: false });
      if (!introIsOpen) openIntro({ restoreFocusOnClose: false });
      introLayer.scrollLeft = 0;
      document.scrollingElement?.scrollTo?.({ left: 0, top: 0, behavior: "auto" });
    },
    focusControl: focusTourControl,
    clearFocus: clearTourFocus,
    openSourceTab: (tab = "visual") => {
      if (!sourceTabs.some((button) => button.dataset.sourceTab === tab)) return false;
      activeSourceTab = tab;
      renderSource();
      if (!sourceIsOpen) openSource({ updateHash: false });
      focusTourControl(tab === "raw" ? "source" : tab);
      return true;
    },
    closeSource: () => {
      clearTourFocus();
      if (sourceIsOpen) closeSource({ restoreFocus: false, updateHash: false });
    },
    getTourReceipt,
    captureObservation: captureMapObservation,
    pauseTimeline: pauseMapTimeline,
    resumeTimeline: resumeMapTimeline,
    setPlayback: value => value ? resumeMapTimeline({ transport: true }) : pauseMapTimeline({ transport: true }),
    getPlaybackState: () => ({ ready: Boolean(getActiveSignalMode()), supported: getActiveSignalMode()?.id === 'nothing-is-waste' ? (getActiveSignalMode().signals.countryWaste?.length || 0) > 1 : Boolean(getActiveSignalMode()),
      playing: !co2TimelineHeld && !mapTimelineManuallyPaused && (getActiveSignalMode()?.id !== 'three-ecologies' || ecologiesPlaying),
      detail: ['nothing-is-waste', 'three-ecologies', 'forest-cloud-engine', 'earth-organ'].includes(getActiveSignalMode()?.id) ? '同じ展示の国・地点を順に表示します。' : '同じ展示の時系列を再生します。',
      reason: '' }),
    getState: () => ({ modeIndex: modeToIndex, signalTimePosition, mapOpen: japanIsOpen, introOpen: introIsOpen, timelineManuallyPaused: mapTimelineManuallyPaused, timelineHeld: co2TimelineHeld, signalReady: Boolean(getActiveSignalMode()) }),
  });
  globalThis.GaiaMapObservationAdapter = mapObservationAdapter;
  const focusEcologiesLocation = (row, label) => {
    const rect = japanMap.getBoundingClientRect();
    const targetX = rect.width < 680 ? .48 : .38, targetY = rect.width < 680 ? .2 : .44;
    const mapX = earthLongitudeToMapX(row.lon), mapY = 90 - row.lat;
    const baseScale = earthBaseScale(rect);
    // The map clamps pan to its edges. Zoom enough to put western/eastern
    // sites in the open reading area, not underneath the inspector.
    const requiredScale = Math.max(rect.width * targetX / Math.max(1, mapX),
      rect.width * (1 - targetX) / Math.max(1, 360 - mapX),
      rect.height * targetY / Math.max(1, mapY), rect.height * (1 - targetY) / Math.max(1, 180 - mapY));
    focusEarthLocation({ lon: row.lon, lat: row.lat, zoom: clamp(Math.max(1.35, requiredScale / baseScale + .04), 1, 8),
      targetX, targetY, durationMs: reducedMotion ? 0 : 650, label });
  };
  const selectEcologiesCountry = (iso3, { focus = true } = {}) => {
    const mode = getActiveSignalMode();
    if (mode?.id !== "three-ecologies") return;
    const rows = getThreeEcologiesComparison(mode.signals)?.rows || [];
    const index = rows.findIndex(row => row.iso3 === iso3);
    if (index < 0) return;
    pauseMapTimeline();
    closeJapanPoi(); clearJapanPoiHover();
    ecologiesPlaying = false; co2TimelineHeld = true;
    signalTimePosition = ((index + .5) / rows.length) * 100;
    signalTimeInputs.forEach(input => { input.value = String(signalTimePosition); });
    updateSignalInterface();
    if (focus) focusEcologiesLocation(rows[index], "ecologies-country");
  };
  const ecologiesExhibit = globalThis.GaiaEcologiesExhibit?.mount(japanLayer, {
    select: selectEcologiesCountry,
    view: view => {
      pauseMapTimeline();
      ecologiesView = view; ecologiesPlaying = false; co2TimelineHeld = true; closeJapanPoi(); clearJapanPoiHover();
      const heading = japanLayer.querySelector("#map-guide-title");
      if (heading) heading.textContent = view === "culture" ? "割合では語れない、場所の意味。" : "都市人口率が高い国は、森が少ない？";
    },
    play: () => {
      mapTimelineManuallyPaused = false;
      ecologiesPlaying = !ecologiesPlaying; co2TimelineHeld = !ecologiesPlaying;
      co2TimelinePausedUntil = 0;
      co2TimelineStartedAt = performance.now() - (signalTimePosition / 100) * getActiveTimelineDuration();
    },
    site: index => {
      pauseMapTimeline();
      ecologiesCultureIndex = index;
      const site = getActiveSignalMode()?.signals?.culture?.[index];
      if (site) focusEcologiesLocation(site, "ecologies-culture");
    },
  });
  window.dispatchEvent(new CustomEvent("gaia:map-adapter-ready"));

  window.addEventListener("gaia:novel-open", () => {
    stopRendering();
    if (introIsOpen) closeIntro({ restoreFocus: false });
    if (sourceIsOpen) closeSource({ restoreFocus: false });
    if (conceptIsOpen) closeConcept({ restoreFocus: false });
    if (autoEnabled) {
      autoEnabled = false;
      updateAutoInterface();
    }
  });

  window.addEventListener("gaia:story-mode-open", (event) => {
    const kind = event.detail?.kind;
    const index = Number(event.detail?.index);
    const phase = String(event.detail?.phase || "timeline");
    if (!["map01", "map03", "abstract07", "map08"].includes(kind) || !Number.isInteger(index)) return;
    if (kind === "map01" && (index !== 0 || event.detail?.modeId !== "breathing-earth")) return;
    storyModeDetour = { kind, index, phase, views: new Set() };
    startRendering();
    storyMapTimelineCompleted = false;
    window.clearTimeout(storyMapReturnTimer);
    storyMapReturnTimer = 0;
    experience.dataset.storyMode = kind;
    const globalSignalConsole = experience.querySelector(".signal-console-main");
    if (globalSignalConsole) {
      storyModeGlobalSignalConsoleState = {
        hidden: globalSignalConsole.hidden,
        inert: globalSignalConsole.inert,
        ariaHidden: globalSignalConsole.getAttribute("aria-hidden"),
      };
      globalSignalConsole.hidden = true;
      globalSignalConsole.inert = true;
      globalSignalConsole.setAttribute("aria-hidden", "true");
    }
    if (kind !== "abstract07") mapModeIndex = index;
    selectMode(index, { resetAutoTimer: false });
    if (introIsOpen) closeIntro({ restoreFocus: false });
    if (sourceIsOpen) closeSource({ restoreFocus: false, updateHash: false });
    if (conceptIsOpen) closeConcept({ restoreFocus: false, updateHash: false });
    if (kind === "abstract07") {
      if (japanIsOpen) closeJapan({ restoreFocus: false, updateHash: false });
      requestAnimationFrame(() => canvas.focus({ preventScroll: true }));
      return;
    }
    if (!japanIsOpen) {
      openJapan({ updateHash: false, restoreFocusOnClose: false, respectUrlMode: false });
    }
    japanClose.disabled = true;
    japanLayer.dataset.storyMode = kind;
    japanLayer.dataset.storyPhase = phase;
    if (kind === "map01") {
      mountStoryMapAivaBackdrop();
      japanLayer.setAttribute("role", "dialog");
      japanLayer.setAttribute("aria-modal", "true");
      if (phase === "temperature-anomaly") {
        restartCo2Timeline(50);
        co2TimelineHeld = true;
        updateSignalInterface();
        void window.GaiaStoryTemperature?.open(japanLayer, { reducedMotion: event.detail?.reducedMotion === true });
      } else {
        restartCo2Timeline(0);
        if (reducedMotion) {
          requestAnimationFrame(() => completeStoryMapTimeline({ finalFrameMs: 900 }));
        }
      }
    }
    requestAnimationFrame(() => {
      const focusTarget = phase === "temperature-anomaly"
        ? japanLayer.querySelector("[data-signal-time]")
        : japanMap;
      focusTarget?.focus({ preventScroll: true });
    });
  });

  window.addEventListener("gaia:story-mode-layer", (event) => {
    if (!storyModeDetour || event.detail?.kind !== storyModeDetour.kind) return;
    const storyLayer = String(event.detail?.layer || "");
    japanLayer.dataset.storyLayer = storyLayer;
    const labels = {
      forest: "森林分布を表示",
      rain: "降水量を表示",
      overlay: "森林と降水量を重ねて表示",
      nature: "自然環境",
      life: "人の暮らし",
      memory: "土地の記憶",
    };
    if (labels[storyLayer]) japanMapStatus.textContent = labels[storyLayer];
  });

  window.addEventListener("gaia:story-mode-close", (event) => {
    if (!storyModeDetour || (event.detail?.kind && event.detail.kind !== storyModeDetour.kind)) return;
    const closedDetour = storyModeDetour;
    if (japanIsOpen) closeJapan({ restoreFocus: false, updateHash: false });
    japanClose.disabled = false;
    delete japanLayer.dataset.storyLayer;
    delete japanLayer.dataset.storyPhase;
    window.clearTimeout(storyMapReturnTimer);
    storyMapReturnTimer = 0;
    storyMapTimelineCompleted = false;
    destroyStoryMapAivaBackdrop();
    delete experience.dataset.storyMode;
    storyModeDetour = null;
    const globalSignalConsole = experience.querySelector(".signal-console-main");
    if (globalSignalConsole && storyModeGlobalSignalConsoleState) {
      globalSignalConsole.hidden = storyModeGlobalSignalConsoleState.hidden;
      globalSignalConsole.inert = storyModeGlobalSignalConsoleState.inert;
      if (storyModeGlobalSignalConsoleState.ariaHidden === null) globalSignalConsole.removeAttribute("aria-hidden");
      else globalSignalConsole.setAttribute("aria-hidden", storyModeGlobalSignalConsoleState.ariaHidden);
      storyModeGlobalSignalConsoleState = null;
      updateSignalInterface();
    }
    const storyReturnDelay = ["map01", "map03", "map08"].includes(closedDetour.kind) && !reducedMotion ? 420 : 0;
    window.setTimeout(() => {
      window.GaiaStoryTemperature?.close();
      if (japanLayer.dataset.storyMode === closedDetour.kind) {
        delete japanLayer.dataset.storyMode;
        japanLayer.removeAttribute("role");
        japanLayer.removeAttribute("aria-modal");
      }
      window.dispatchEvent(new CustomEvent("gaia:story-mode-return-to-novel", {
        detail: { kind: closedDetour.kind },
      }));
      stopRendering();
    }, storyReturnDelay);
  });

  window.addEventListener("keydown", (event) => {
    if (!storyModeDetour || event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const fallbackControl = storyModeDetour.kind === "map01"
      ? japanLayer.querySelector("[data-temperature-return]") || document.querySelector("#story-map-modal-skip")
      : document.querySelector("#story-detour-return");
    fallbackControl?.focus({ preventScroll: true });
  }, true);

  window.addEventListener("gaia:opening-complete", (event) => {
    if (event.detail?.destination !== "menu") return;
    const hasDirectDestination =
      ["#source", "#concept", "#world", "#earth", "#japan", "#data", "#story"].includes(
        window.location.hash,
      ) || globalThis.GaiaMapRoute.isMapHash(window.location.hash) || new URLSearchParams(window.location.search).has("space");
    if (hasDirectDestination) return;
    openIntro({ restoreFocusOnClose: false });
    scheduleIntroEntryGuide();
  });

  window.addEventListener("gaia:return-to-intro", () => {
    startRendering();
    openIntro({ restoreFocusOnClose: false });
  });

  introTitleReturn?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("gaia:return-to-title", { detail: {
      onCovered: () => {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        closeIntro({ restoreFocus: false });
      },
    } }));
  });

  sourcePanel.inert = true;
  conceptPanel.inert = true;
  introLayer.inert = true;
  japanLayer.inert = true;
  japanDataPanel.inert = true;
  japanButton.addEventListener("click", (event) => {
    runSceneTransition(
      () => japanIsOpen
        ? openIntro({ restoreFocusOnClose: false })
        : openJapan(),
      "map",
      event,
    );
  });
  japanClose.addEventListener("click", (event) => {
    if (storyModeDetour) {
      event.preventDefault();
      document.querySelector("#story-detour-return")?.focus({ preventScroll: true });
      return;
    }
    runSceneTransition(() => openIntro(), "map", event);
  });
  japanDataButton.addEventListener("click", openJapanData);
  japanDataClose.addEventListener("click", () => closeJapanData());
  japanDataScrim.addEventListener("click", () => closeJapanData());
  japanPoiClose.addEventListener("click", () => closeJapanPoi({ restoreFocus: true }));
  japanHistoryLayerButton.addEventListener("click", () => setJapanDataLayer("history"));
  japanLiveLayerButton.addEventListener("click", () => setJapanDataLayer("snapshot"));
  sourceButton.addEventListener("click", (event) => {
    if (sourceIsOpen) {
      runSceneTransition(
        () => openIntro({ restoreFocusOnClose: false }),
        "abstract",
        event,
      );
    } else {
      openSource();
    }
  });
  sourceClose.addEventListener("click", (event) => {
    runSceneTransition(
      () => openIntro({ restoreFocusOnClose: false }),
      "abstract",
      event,
    );
  });
  sourceScrim.addEventListener("click", (event) => {
    runSceneTransition(
      () => openIntro({ restoreFocusOnClose: false }),
      "abstract",
      event,
    );
  });
  conceptOpen.addEventListener("click", (event) => {
    if (conceptIsOpen) {
      runSceneTransition(
        () => openIntro({ restoreFocusOnClose: false }),
        "abstract",
        event,
      );
    } else {
      openConcept();
    }
  });
  conceptClose.addEventListener("click", (event) => {
    runSceneTransition(
      () => openIntro({ restoreFocusOnClose: false }),
      "abstract",
      event,
    );
  });
  conceptPrevious.addEventListener("click", () => selectMode(modeToIndex - 1));
  conceptNext.addEventListener("click", () => selectMode(modeToIndex + 1));
  introButton.addEventListener("click", (event) => {
    if (window.GaiaSceneTransition?.running) {
      openIntro();
      return;
    }
    runSceneTransition(() => openIntro(), "abstract", event);
  });
  introPathBack.addEventListener("click", (event) => {
    runSceneTransition(
      () => showIntroStage("path"),
      introSelectedPath || "default",
      event,
    );
  });
  introScrollCue?.addEventListener("click", () => {
    introAfterfold?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    window.setTimeout(() => {
      introArchitectureJump?.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 460);
  });
  introArchitectureJump.addEventListener("click", () => {
    introOpenDataExhibit.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    introOpenDataExhibit.focus({ preventScroll: true });
  });
  introArchitectureBack.addEventListener("click", () => {
    introLayer.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    showIntroStage("path");
  });
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#source") {
      closeIntro({ restoreFocus: false });
      closeJapan({ restoreFocus: false, updateHash: false });
      closeConcept({ restoreFocus: false, updateHash: false });
      openSource({ updateHash: false });
    } else if (window.location.hash === "#concept") {
      closeIntro({ restoreFocus: false });
      closeJapan({ restoreFocus: false, updateHash: false });
      closeSource({ restoreFocus: false, updateHash: false });
      openConcept({ updateHash: false });
    } else if (globalThis.GaiaMapRoute.isMapHash(window.location.hash)) {
      closeIntro({ restoreFocus: false });
      closeSource({ restoreFocus: false, updateHash: false });
      closeConcept({ restoreFocus: false, updateHash: false });
      openJapan({ updateHash: false, restoreFocusOnClose: false });
      if (window.location.hash === "#data") openJapanData();
    } else {
      closeSource({ restoreFocus: false, updateHash: false });
      closeConcept({ restoreFocus: false, updateHash: false });
      closeJapan({ restoreFocus: false, updateHash: false });
      if (
        ["", "#top"].includes(window.location.hash)
        && !document.body.classList.contains("novel-open")
        && !new URLSearchParams(window.location.search).has("space")
      ) {
        openIntro({ restoreFocusOnClose: false });
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    // The foreground character reader owns its focus loop and shortcuts.
    if (document.body.classList.contains("character-mode-open")) return;
    if (introIsOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (introStage === "sense") {
          showIntroStage("path");
        } else {
          introPathButtons[0]?.focus({ preventScroll: true });
        }
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) &&
        (introStage === "path" ? introPathButtons : introModeButtons).includes(document.activeElement)
      ) {
        event.preventDefault();
        const activeButtons = (introStage === "path" ? introPathButtons : introModeButtons)
          .filter((button) => !button.hidden && !button.disabled);
        const currentIndex = activeButtons.indexOf(document.activeElement);
        const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const nextIndex = (currentIndex + direction + activeButtons.length) % activeButtons.length;
        activeButtons[nextIndex].focus({ preventScroll: true });
      } else if (event.key === "Tab") {
        event.preventDefault();
        const targets = (introStage === "path"
          ? [
              introTitleReturn,
              ...introPathButtons,
              introScrollCue,
              introCharacterJump,
              introArchitectureJump,
              introArchitectureBack,
            ]
          : [...introModeButtons, introPathBack]
        ).filter((element) => !element.hidden && element.getClientRects().length > 0);
        const currentIndex = targets.indexOf(document.activeElement);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex =
          currentIndex === -1
            ? 0
            : (currentIndex + direction + targets.length) % targets.length;
        targets[nextIndex].focus();
      }
      return;
    }
    if (japanIsOpen) {
      if (japanDataIsOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeJapanData();
        } else if (event.key === "Tab") {
          const targets = [...japanDataPanel.querySelectorAll('button, a[href], [tabindex="0"]')]
            .filter(element => !element.disabled && element.getClientRects().length > 0);
          const first = targets[0], last = targets.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last?.focus({ preventScroll: true });
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus({ preventScroll: true });
          }
        }
        return;
      }
      if (event.key === "Escape" && selectedJapanPoi) {
        closeJapanPoi({ restoreFocus: true });
      } else if (event.key === "Escape" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        openIntro({ restoreFocusOnClose: false });
      } else if (/^[1-9]$/.test(event.key)) {
        selectMode(Number(event.key) - 1);
      } else if (event.key === "0") {
        selectMode(9);
      }
      return;
    }
    if (event.key === "Escape" && sourceIsOpen) {
      event.preventDefault();
      openIntro({ restoreFocusOnClose: false });
      return;
    }
    if (event.key === "Escape" && conceptIsOpen) {
      event.preventDefault();
      openIntro({ restoreFocusOnClose: false });
      return;
    }
    if (sourceIsOpen || conceptIsOpen || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === "ArrowLeft") {
      selectMode(modeToIndex - 1);
    } else if (event.key === "ArrowRight") {
      selectMode(modeToIndex + 1);
    } else if (event.key.toLowerCase() === "c") {
      openSource();
    } else if (event.key.toLowerCase() === "n") {
      openConcept();
    } else if (event.key.toLowerCase() === "i") {
      openIntro();
    } else if (event.key.toLowerCase() === "j") {
      openJapan();
    } else if (/^[1-9]$/.test(event.key)) {
      selectMode(Number(event.key) - 1);
    } else if (event.key === "0") {
      selectMode(9);
    }
  });

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const lodProfile = globalThis.GaiaFrameBudgetGovernor?.getProfile?.() || {};
    const compactRendering = coarsePointer || window.innerWidth <= 720;
    const ratioCap = Math.min(compactRendering ? 1.0 : 1.35, lodProfile.dprCap || Infinity);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, ratioCap);
    const renderScale = Math.max(compactRendering ? 0.58 : 0.35, lodProfile.renderScale || 1);
    const rawWidth = Math.max(1, rect.width * pixelRatio * renderScale);
    const rawHeight = Math.max(1, rect.height * pixelRatio * renderScale);
    const maxPixels = compactRendering ? 560000 : 1300000;
    const pixelScale = Math.min(1, Math.sqrt(maxPixels / (rawWidth * rawHeight)));
    const width = Math.max(1, Math.floor(rawWidth * pixelScale));
    const height = Math.max(1, Math.floor(rawHeight * pixelScale));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const isMobileMap = window.innerWidth <= 720;
    const desiredMapZoom = isMobileMap ? EARTH_MOBILE_ZOOM : EARTH_ZOOM;
    if (japanView.zoom !== desiredMapZoom) {
      resetJapanView();
    }
    gl.viewport(0, 0, width, height);
  };

  const currentFieldData = new Float32Array(CURRENT_FIELD_SAMPLE_LIMIT * 4);
  const getCurrentFieldUniformData = () => {
    currentFieldData.fill(0);
    if (
      !japanIsOpen
      || japanLayer.classList.contains("is-live-exhibit")
      || japanLayer.matches(".is-firms-exhibit, .is-marine-cod-exhibit, .is-food-exhibit")
      || getActiveSignalMode()?.id !== "blue-circulation"
    ) {
      delete canvas.dataset.currentVisiblePoiCount;
      delete canvas.dataset.currentRevealedPoiCount;
      delete canvas.dataset.currentRenderedSampleCount;
      delete canvas.dataset.currentBrushStrokeCount;
      delete canvas.dataset.currentOneStrokePerPoi;
      delete canvas.dataset.currentAllVisiblePoiPainted;
      delete canvas.dataset.currentSampleSelection;
      delete canvas.dataset.currentDirectionTransform;
      delete canvas.dataset.currentCoverageMode;
      delete canvas.dataset.currentInterpolationSource;
      return { count: 0, data: currentFieldData };
    }
    const rect = japanMap.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return { count: 0, data: currentFieldData };
    const { left, top } = getJapanViewport();
    const currentRows = getActiveSignalMode()?.signals?.currents || [];
    prepareCurrentWeave(currentRows);
    const projection = japanView.earthProjection || getEarthProjection(rect);
    gl.uniform3f(uniforms.currentGeoView,
      (rect.width / 2 - projection.originX) / projection.scale + EARTH_INITIAL_CENTER_LONGITUDE - 180,
      90 - (rect.height / 2 - projection.originY) / projection.scale,
      rect.height / (2 * projection.scale));
    const visibleSamples = currentRows
      .map((row, index) => {
        const point = japanWorldToScreen(row.lon, row.lat, left, top);
        return { row, index, point, speed: Math.hypot(row.uMs, row.vMs) };
      })
      .filter(({ point }) => (
        point.x > -80
        && point.x < rect.width + 80
        && point.y > -80
        && point.y < rect.height + 80
      ));
    const now = performance.now();
    const revealedSamples = visibleSamples.filter(({ index }) => (
      getMapPlotReveal(index, currentRows.length, now).progress > 0
    ));
    const samples = revealedSamples.slice(0, CURRENT_FIELD_SAMPLE_LIMIT);

    samples.forEach(({ row, point, speed }, index) => {
      const offset = index * 4;
      currentFieldData[offset] = (point.x * 2 - rect.width) / rect.height;
      currentFieldData[offset + 1] = ((rect.height - point.y) * 2 - rect.height) / rect.height;
      currentFieldData[offset + 2] = clamp(speed / 1.5, 0, 1);
      currentFieldData[offset + 3] = Math.atan2(row.vMs, row.uMs);
    });
    canvas.dataset.currentVisiblePoiCount = String(visibleSamples.length);
    canvas.dataset.currentRevealedPoiCount = String(revealedSamples.length);
    canvas.dataset.currentRenderedSampleCount = String(samples.length);
    canvas.dataset.currentBrushStrokeCount = String(samples.length);
    canvas.dataset.currentOneStrokePerPoi = String(samples.length === revealedSamples.length);
    canvas.dataset.currentAllVisiblePoiPainted = String(samples.length === visibleSamples.length);
    canvas.dataset.currentSampleSelection = "all-visible-poi-stable-order";
    canvas.dataset.currentDirectionTransform = "noaa-east-north-to-gl-local-positive-rotation";
    return { count: samples.length, data: currentFieldData, active: true };
  };

  const render = (now) => {
    // The geographic base must keep following the shared projection in every
    // chapter. Live chapters render their own data canvas, but the coastlines
    // still need to redraw after wheel, pinch, drag, and control-button input.
    const mapSurfaceIsVisible = japanIsOpen;
    const lodProfile = globalThis.GaiaFrameBudgetGovernor?.getProfile?.() || { targetFps: 60 };
    const lodTarget = lodProfile.targetFps ?? 60;

    if (lodTarget === 0) {
      const enteringStaticFallback = japanOverlay.dataset.renderLoopMode !== "static-fallback";
      japanOverlay.dataset.renderLoopMode = "static-fallback";
      if (
        mapSurfaceIsVisible
        && (enteringStaticFallback || now + 0.5 >= nextJapanOverlayRenderAt)
      ) {
        renderJapanTiles();
        renderJapanOverlay(now);
        nextJapanOverlayRenderAt = now + STATIC_MAP_FRAME_INTERVAL_MS;
      }
      animationFrame = requestAnimationFrame(render);
      return;
    }
    japanOverlay.dataset.renderLoopMode = "dynamic";
    if (!japanIsOpen && lodTarget < 60) {
      if (lodTarget !== lastShaderTargetFps) {
        lastShaderTargetFps = lodTarget;
        nextShaderRenderAt = now;
      }
      if (now + 0.25 < nextShaderRenderAt) {
        animationFrame = requestAnimationFrame(render);
        return;
      }
      const frameInterval = 1000 / lodTarget;
      do nextShaderRenderAt += frameInterval;
      while (nextShaderRenderAt <= now);
    } else {
      lastShaderTargetFps = lodTarget;
      nextShaderRenderAt = now;
    }

    if (japanIsOpen) {
      const brushCurrentIsActive = getActiveSignalMode()?.id === "blue-circulation";
      const mapTargetFps = brushCurrentIsActive
        ? (lodTarget >= 45 ? 60 : Math.max(30, lodTarget))
        : reducedMotion ? 15 : lodTarget >= 45 ? 60 : lodTarget;
      if (mapTargetFps < 60) {
        if (mapTargetFps !== lastJapanOverlayTargetFps) {
          lastJapanOverlayTargetFps = mapTargetFps;
          nextJapanOverlayRenderAt = now;
        }
        if (now + 0.5 < nextJapanOverlayRenderAt) {
          animationFrame = requestAnimationFrame(render);
          return;
        }
        const mapFrameInterval = 1000 / mapTargetFps;
        do nextJapanOverlayRenderAt += mapFrameInterval;
        while (nextJapanOverlayRenderAt <= now);
      } else {
        lastJapanOverlayTargetFps = mapTargetFps;
        nextJapanOverlayRenderAt = now;
      }
    }

    resize();
    updateCo2TimelineAnimation(now);
    if (mapSurfaceIsVisible) {
      renderJapanTiles();
      renderJapanOverlay(now);
    }

    // These chapters own a bounded WebGL atmosphere. Do not also submit the
    // concealed base exhibit shader while their reference map stays active.
    if (mapSurfaceIsVisible && japanLayer.classList.contains("is-planet-signals-exhibit")) {
      canvas.dataset.renderSuppressed = "planet-atmosphere";
      animationFrame = requestAnimationFrame(render);
      return;
    }
    delete canvas.dataset.renderSuppressed;

    if (
      autoEnabled &&
      !sourceIsOpen &&
      !conceptIsOpen &&
      !introIsOpen &&
      !japanIsOpen &&
      now >= nextAutoAt
    ) {
      selectMode(modeToIndex + 1, { resetAutoTimer: false });
      nextAutoAt = now + AUTO_INTERVAL;
    }

    const elapsed = Math.max(0, (now - startTime - hiddenDuration) / 1000);
    const timeScale = reducedMotion ? 0.32 : 1;
    const transitionDuration = reducedMotion ? 30 : TRANSITION_DURATION;
    const transition = clamp((now - transitionStartedAt) / transitionDuration, 0, 1);

    if (transition >= 1) {
      modeFromIndex = modeToIndex;
    }

    pointer.energy *= pointer.down ? 0.985 : 0.955;
    pointer.velocityX *= 0.9;
    pointer.velocityY *= 0.9;

    for (let index = 0; index < trail.length; index += 1) {
      const point = trail[index];
      const offset = index * 4;
      trailData[offset] = point.x;
      trailData[offset + 1] = point.y;
      trailData[offset + 2] = Math.max(0, (now - point.bornAt) / 1000);
      trailData[offset + 3] = point.strength;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenTriangle);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, elapsed * timeScale);
    gl.uniform4f(
      uniforms.pointer,
      pointer.x,
      pointer.y,
      pointer.down ? 1 : 0,
      pointer.energy,
    );
    gl.uniform2f(uniforms.velocity, pointer.velocityX, pointer.velocityY);
    gl.uniform4fv(uniforms.trail, trailData);
    const trailActive = pointer.down || trail.some((point) => point.strength > 0.001 && now - point.bornAt < 3_100);
    gl.uniform1f(uniforms.trailActive, trailActive ? 1 : 0);
    gl.uniform1fv(uniforms.modeMemory, modeMemory);
    gl.uniform1i(uniforms.modeFrom, modeFromIndex);
    gl.uniform1i(uniforms.modeTo, modeToIndex);
    gl.uniform1f(uniforms.transition, transition);
    const signalVector = getShaderSignalVector(modeToIndex);
    gl.uniform4f(uniforms.signal, signalVector[0], signalVector[1], signalVector[2], signalVector[3]);
    gl.uniform1fv(uniforms.sourceSignals, getSourceSignalVector());
    const currentField = getCurrentFieldUniformData();
    gl.uniform4fv(uniforms.currentSamples, currentField.data);
    gl.uniform1i(uniforms.currentSampleCount, currentField.count);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentVectorTexture);
    gl.uniform1i(uniforms.currentVectorField, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, currentWeaveTexture);
    gl.uniform1i(uniforms.currentWeave, 1);
    gl.uniform1f(uniforms.currentWeaveReady,
      currentField.active ? clamp((now - currentWeaveReadyAt) / 900, 0, 1) : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (getActiveSignalMode()?.id === "blue-circulation") {
      canvas.dataset.currentAmbientPhase = (elapsed * timeScale).toFixed(4);
    } else {
      delete canvas.dataset.currentAmbientPhase;
    }

    animationFrame = requestAnimationFrame(render);
  };

  let renderingEnabled = false;

  function startRendering() {
    renderingEnabled = true;
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(render);
  }

  function stopRendering() {
    renderingEnabled = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = performance.now();
      cancelAnimationFrame(animationFrame);
    } else if (renderingEnabled) {
      if (hiddenAt > 0) {
        const hiddenElapsed = performance.now() - hiddenAt;
        hiddenDuration += hiddenElapsed;
        co2TimelineStartedAt += hiddenElapsed;
        hiddenAt = 0;
      }
      nextAutoAt = performance.now() + AUTO_INTERVAL;
      startRendering();
    }
  });

  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      errorPanel.querySelector("p").textContent = "描画コンテキストが失われました。";
      errorPanel.querySelector("small").textContent = "ページを再読み込みしてください。";
      errorPanel.hidden = false;
      globalThis.GaiaFrameBudgetGovernor?.reportFailure?.("context-lost");
    },
    false,
  );

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("focus", invalidateReferenceWorldCache, { passive: true });
  window.addEventListener("pageshow", invalidateReferenceWorldCache, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) invalidateReferenceWorldCache();
  });
  referenceWorldCanvas.addEventListener("contextlost", (event) => {
    event.preventDefault();
    invalidateReferenceWorldCache();
  });
  referenceWorldCanvas.addEventListener("contextrestored", invalidateReferenceWorldCache);

  clearSession();
  setMapScope("earth");
  updateModeInterface();
  updateAutoInterface();
  resize();
  const openingCoversCanvas = document.body.classList.contains("gaia-opening-active");
  const novelCoversCanvas = document.body.classList.contains("novel-open")
    && !document.body.classList.contains("novel-mode-detour");
  if (!openingCoversCanvas && !novelCoversCanvas) {
    startRendering();
  } else if (openingCoversCanvas) {
    window.addEventListener("gaia:opening-complete", () => {
      const coveredByNovel = document.body.classList.contains("novel-open")
        && !document.body.classList.contains("novel-mode-detour");
      if (!coveredByNovel) startRendering();
    }, { once: true });
  }
  document.documentElement.dataset.gaiaAppReady = "true";
  window.dispatchEvent(new CustomEvent("gaia:app-ready"));
  // Map entry selects its own provider below. Non-map shader/source routes
  // still need the current mode, but not every unrelated snapshot chunk.
  if (!globalThis.GaiaMapRoute.isMapHash(window.location.hash)) void loadGaiaSignals();
  loadNaturalEarthLand();
  loadNaturalEarthCountries();
  loadJapanPrefectureBoundaries();

  if (window.location.hash === "#source") {
    openSource({ updateHash: false });
  } else if (window.location.hash === "#concept") {
    openConcept({ updateHash: false });
  } else if (globalThis.GaiaMapRoute.isMapHash(window.location.hash)) {
    openJapan({ updateHash: false, restoreFocusOnClose: false });
    if (window.location.hash === "#data") openJapanData();
  } else if (
    (!openingLayer || openingLayer.hidden)
    && window.location.hash !== "#story"
    && !/\/story\/?$/iu.test(window.location.pathname)
    && !new URLSearchParams(window.location.search).has("space")
  ) {
    openIntro({ restoreFocusOnClose: false });
  }
  if (openingLayer?.hidden && window.location.hash !== "#tour") {
    requestAnimationFrame(() => document.body.classList.remove("gaia-route-handoff"));
  }
})();
