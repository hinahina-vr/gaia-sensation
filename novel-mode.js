/**
 * 概要: 台本と演出情報を使う物語プレイヤー。ページ送り、場面転換、既読ログ、保存・読込、エンディングを管理する。
 */
(() => {
  "use strict";

  const authoredStory = globalThis.GAIA_NOVEL_STORY || globalThis.GAIA_NOVEL_STORY_V6;
  const story = globalThis.GaiaI18n?.view(authoredStory) || authoredStory;
  const translate = (text, values) => globalThis.GaiaI18n?.t(text, values) ?? text;
  const backgroundCues = globalThis.GAIA_NOVEL_BACKGROUND_CUES;
  const backHalfCues = globalThis.GAIA_NOVEL_BACK_HALF_CUES;
  const layer = document.querySelector("#novel-layer");
  if (!story || !layer) return;
  if (!backgroundCues) throw new Error("[GAIA novel] Background cue data is unavailable");
  if (!backHalfCues) throw new Error("[GAIA novel] Back-half staging cue data is unavailable");

  const STORAGE_KEY = "gaiaSensewareNovel:progress";
  const MANUAL_SAVE_KEY = "gaiaSensewareNovel:manual-saves";
  const CONFIG_KEY = "gaiaSensewareNovel:config:v4";
  const LEGACY_CONFIG_KEYS = ["gaiaSensewareNovel:config:v3", "gaiaSensewareNovel:config:v2"];
  const GALLERY_KEY = "gaiaSensewareNovel:cg-gallery:v1";
  const LOG_COMMENT_KEY = "gaiaSensewareNovel:log-comments:v1";
  const TRUE_END_PENDING_KEY = "gaiaSensewareTrueEnd:pending:v1";
  const LEGACY_PROGRESS_KEYS = ["gaia_novel_save_v6", "gaiaSensewareNovel:v5"];
  const LEGACY_MANUAL_KEYS = ["gaia_novel_manual_saves_v6", "gaiaSensewareNovel:manual-saves:v1"];
  const explicitBuildProfile = globalThis.GAIA_BUILD_PROFILE;
  const isProductionPagesHost = (
    location.hostname === "gaia-senseware.pages.dev"
    || location.hostname.endsWith(".gaia-senseware.pages.dev")
  );
  const BUILD_PROFILE = explicitBuildProfile === "release" || explicitBuildProfile === "debug"
    ? explicitBuildProfile
    : (document.documentElement.dataset.buildProfile === "release" || isProductionPagesHost ? "release" : "debug");
  const APEIRONCENE_SCENE_JUMP_ENABLED = BUILD_PROFILE !== "release";
  const SLOT_COUNT = 6;
  const PC_CANVAS_WIDTH = 1920;
  const PC_CANVAS_HEIGHT = 1080;
  const syncPcCanvas = () => {
    const enabled = window.innerWidth >= PC_CANVAS_WIDTH && window.innerHeight >= PC_CANVAS_HEIGHT;
    const scale = enabled
      ? Math.min(window.innerWidth / PC_CANVAS_WIDTH, window.innerHeight / PC_CANVAS_HEIGHT)
      : 1;
    const stageWidth = enabled ? window.innerWidth / scale : PC_CANVAS_WIDTH;
    const stageHeight = enabled ? window.innerHeight / scale : PC_CANVAS_HEIGHT;
    document.body.classList.toggle("novel-pc-canvas", enabled);
    document.body.style.setProperty("--novel-pc-scale", scale.toFixed(6));
    document.body.style.setProperty("--novel-pc-stage-width", `${stageWidth.toFixed(3)}px`);
    document.body.style.setProperty("--novel-pc-stage-height", `${stageHeight.toFixed(3)}px`);
    layer.dataset.pcCanvas = enabled ? `${PC_CANVAS_WIDTH}x${PC_CANVAS_HEIGHT}` : "fluid";
    layer.dataset.pcCanvasFrame = enabled ? `${Math.round(stageWidth)}x${Math.round(stageHeight)}` : "fluid";
  };
  syncPcCanvas();
  const BASE_INTERFACE_SELECTOR = [
    "#gaia-canvas",
    ".abstract-mode-background",
    "#intro-layer",
    ".status",
    "#guide",
    "#mode-caption",
    ".signal-console-main",
    ".mode-nav",
    ".actions",
    "#source-scrim",
    "#concept-panel",
    "#source-panel",
    "#error-panel",
  ].join(",");
  const baseInterfaceRestore = new Map();
  const suppressBaseInterface = ({ preserveOpening = false } = {}) => {
    const opening = document.querySelector("#gaia-opening");
    if (!preserveOpening && opening instanceof HTMLElement) {
      opening.inert = true;
      opening.setAttribute("aria-hidden", "true");
      opening.hidden = true;
    }
    document.querySelectorAll(BASE_INTERFACE_SELECTOR).forEach((node) => {
      if (!(node instanceof HTMLElement) || layer.contains(node)) return;
      if (!baseInterfaceRestore.has(node)) {
        baseInterfaceRestore.set(node, {
          hidden: node.hidden,
          inert: node.inert,
          ariaHidden: node.getAttribute("aria-hidden"),
        });
      }
      node.inert = true;
      node.setAttribute("aria-hidden", "true");
      node.hidden = true;
    });
  };
  const restoreBaseInterface = () => {
    baseInterfaceRestore.forEach((previous, node) => {
      node.hidden = previous.hidden;
      node.inert = previous.inert;
      if (previous.ariaHidden === null) node.removeAttribute("aria-hidden");
      else node.setAttribute("aria-hidden", previous.ariaHidden);
    });
    baseInterfaceRestore.clear();
  };
  const SYSTEM_REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AUTO_DELAY_MS = 3600;
  const TEMPORAL_TRANSITION_MS = 2400;
  const REVEAL_BASE_MS = 64;
  const REVEAL_MIN_GLYPH_MS = 20;
  const REVEAL_MIN_LINE_MS = 120;
  const DEFAULT_MESSAGE_SPEED_PERCENT = 270;
  const LEGACY_MESSAGE_SPEED_SCALE = 2 / 3;
  const TEXT_PAGE_MAX_LINES = 3;
  const TEXT_PAGE_HEIGHT_BUFFER_PX = 4;
  const TEXT_PAGE_INDICATOR_SAFETY_PX = 12;
  const SECTION_SEPARATOR_MS = 4200;
  const SECTION_SEPARATOR_REDUCED_MOTION_MS = 4900;
  const SECTION_ENTRY_FADE_MS = 1100;
  const ENTRY_REVEAL_MS = 620;
  const ENTRY_REVEAL_FALLBACK_MS = ENTRY_REVEAL_MS + 160;
  const BACKGROUND_RELEASE_MS = 820;
  const BACKGROUND_RELEASE_FALLBACK_MS = BACKGROUND_RELEASE_MS + 160;
  const FAST_FORWARD_HOLD_DELAY_MS = 180;
  const FAST_FORWARD_STEP_MS = 90;
  const REACTION_STAGE_INITIAL_MS = 1200;
  const REACTION_STAGE_STEP_MS = 320;
  const SLACK_ENTER_MS = 760;
  const SLACK_EXIT_MS = 460;
  const STAFF_ROLL_THANK_YOU_DELAY_MS = 920;
  const STAFF_ROLL_THANK_YOU_HOLD_MS = 4_200;
  const STAFF_ROLL_FINALIZE_MS = 640;
  const STAFF_ROLL_EXIT_COVER_MS = 215;
  const STAFF_ROLL_EXIT_HOLD_MS = 250;
  const STAFF_ROLL_EXIT_REVEAL_MS = 2700;
  const STAFF_ROLL_ENTRY_BACKGROUND_HOLD_MS = 120;
  const LOG_FOLLOW_THRESHOLD_PX = 72;
  const SLACK_ATTACHMENT_ASSETS = Object.freeze({
    BASIL: {
      src: "./assets/visuals-07/slack-attachment-basil-v1.webp",
      label: "IMG_1812.JPG",
    },
    FLOWERBED: {
      src: "./assets/visuals-07/slack-attachment-flowerbed-v1.webp",
      label: "IMG_0031.JPG",
    },
    MEETING_MAP: {
      src: "./assets/visuals-07/slack-attachment-venue-map-v1.svg",
      label: "meeting-place.png",
    },
    VENUE: {
      src: "./assets/visuals-07/slack-attachment-venue-v1.webp",
      label: "entrance-reference.jpg",
    },
    GAIA_CONNECTION_DIAGRAM: {
      src: "./assets/architecture/gaia-field-sensor-whiteboard-20260912.png",
      label: "ESP32_GAIA_SENSEWARE_接続図.png",
    },
  });
  const CAMPUS_CHAT_SCHOOL_CHANNELS = Object.freeze([
    Object.freeze({ id: "大学からのお知らせ_公式", label: "大学からのお知らせ_公式" }),
    Object.freeze({ id: "class_ネットワーク産業論", label: "class_ネットワーク産業論" }),
    Object.freeze({ id: "class_数理構造の発見と活用", label: "class_数理構造の発見と活用" }),
    Object.freeze({
      id: "26_2年春21クラス",
      label: "26_2年春21クラス",
      private: true,
      description: "春21クラスのメンバーだけが参加するプライベートチャネル",
      memberLabel: "21 members",
      notice: "このチャネルは、26_2年春21クラスのメンバーだけが閲覧できます。",
    }),
  ]);
  const CAMPUS_CHAT_DIRECT_MESSAGES = Object.freeze([
    Object.freeze({ id: "cc_hinahina", label: "cc_hinahina", presence: "online" }),
  ]);
  const CAMPUS_CHAT_STORY_CHANNEL = Object.freeze({
    id: "惑星の放課後_雑談",
    label: "惑星の放課後_雑談",
    description: "まだ名前のない変化を見つけて、記録する場所",
    memberLabel: "9 members",
  });
  const CAMPUS_CHAT_SENSOR_CHANNEL = Object.freeze({
    id: "惑星の放課後_センサー",
    label: "惑星の放課後_センサー",
    description: "センサー観測とGAIA SENSEWARE接続の試作相談",
    memberLabel: "9 members",
  });
  const CHARACTER_VIEW = Object.freeze({ mizuha: "minamo", amane: "sora" });
  const SCENE_SOUNDTRACK = Object.freeze({
    map_mode01: "moonreopen",
    gx_experience: "snowfire",
    esp32_pitch: "firstlight",
    circle_invitation: "foldedwind",
    welcome_chat: "moonbook",
  });
  const WELCOME_SOUNDTRACK_CUES = Object.freeze([
    { from: "welcome_chat_021", track: "senseware" },
    { from: "welcome_chat_075", track: "snowafter" },
  ]);
  const BACKGROUND_SOUNDTRACK = Object.freeze([
    ["event-cg-festival-map-transition-five-plane", "mapambient"],
    ["modis-land-cover-2023.png", "mapambient"],
    ["novel-bg-map01-data-provenance", "mapambient"],
    ["event-cg-first-encounter-five-plane", "windowlight"],
    ["event-cg-amane-closeup-five-plane", "windowlight"],
    ["event-cg-mizuha-closeup-five-plane", "windowlight"],
    ["novel-bg-workroom-v2.png", "windowlight"],
    ["novel-bg-online-night-v2.png", "moonbook"],
    ["novel-bg-garden-center-v2.png", "firstlight"],
    ["novel-bg-coastal-venue-v2.png", "foldedwind"],
    ["novel-bg-zushi-coast-night-v2.png", "snowfire"],
    ["novel-bg-exhibition-v3.png", "story"],
  ]);
  const CHAT_CAST_MEETING_GATES = Object.freeze({
    mizuha: Object.freeze({ completedAt: "first_meeting_hall_032", visibleFrom: "first_meeting_hall_033" }),
    amane: Object.freeze({ completedAt: "first_meeting_hall_032", visibleFrom: "first_meeting_hall_033" }),
    sakuya: Object.freeze({ completedAt: "first_meeting_hall_066", visibleFrom: "first_meeting_hall_067" }),
  });
  const CHAT_DEVICE_MOBILE_RANGES = Object.freeze({
    first_meeting_hall: Object.freeze([[21, 23], [42, 48]]),
    production_year: Object.freeze([[125, 127], [196, 198]]),
    absence: Object.freeze([[40, 40], [61, 63]]),
  });
  const SPEAKERS = Object.freeze({
    narrator: { name: "", glyph: "◌" },
    mizuha: { name: "みず", formalName: "瑞葉", reading: "ミズハ", glyph: "≈" },
    amane: { name: "あめ", formalName: "雨音", reading: "アマネ", glyph: "△" },
    sakuya: { name: "saku", formalName: "咲弥", reading: "サクヤ", glyph: "＊" },
    visitor: { name: "あなた", glyph: "◇" },
    lou: { name: "ルウ", glyph: "∞" },
    system: { name: "GAIA SENSEWARE", glyph: "◎" },
  });
  const INTRODUCTION_STEPS = Object.freeze({ amane: 21, mizuha: 23 });
  const ANONYMOUS_SPEAKER_NAMES = Object.freeze({ amane: "短髪の女性", mizuha: "長髪の女性" });
  const ABSTRACT_AVATAR_SUPPRESSED_STEP_IDS = new Set(["festival_concept_048", "gx_experience_001"]);
  const speakerDisplayName = (step) => {
    const speaker = step?.speaker || "narrator";
    if (speaker === "visitor") {
      return step?.type === "chat" ? (step.speakerLabel || "青猫") : SPEAKERS.visitor.name;
    }
    if (speaker === "amane" || speaker === "mizuha") {
      const festivalStep = /^festival_concept_(\d+)$/.exec(String(step?.id || ""));
      if (festivalStep && Number(festivalStep[1]) <= INTRODUCTION_STEPS[speaker]) {
        return ANONYMOUS_SPEAKER_NAMES[speaker];
      }
      return SPEAKERS[speaker].name;
    }
    if (speaker === "system") return step?.speakerLabel || "SYSTEM";
    return step?.speakerLabel || SPEAKERS[speaker]?.name || "";
  };
  const RECORD_LABELS = Object.freeze({
    SOURCE: "観測記録 / SOURCE",
    LOCAL_SOURCE: "その場の観測 / LOCAL SOURCE",
    DERIVED: "計算・解釈 / DERIVED",
    SCENARIO: "仮定 / SCENARIO",
    VISITOR_TRACE: "操作記録 / VISITOR TRACE",
    BEYOND: "遠未来観測 / APEIRONCENE",
  });
  const RECORD_SPEAKER_LABELS = Object.freeze({
    SOURCE: "観測メモ",
    LOCAL_SOURCE: "観測メモ",
    DERIVED: "解析メモ",
    SCENARIO: "仮定メモ",
    VISITOR_TRACE: "選択の記録",
  });
  const getRecordPresenter = (step) => (
    step.sceneId === "prologue_basil" && step.recordType === "LOCAL_SOURCE"
      ? "amane"
      : "narrator"
  );
  const SAKUYA_STEP_EXPRESSIONS = Object.freeze({
    prologue_basil_007: "worried",
    first_meeting_promise_010: "teasing",
    first_meeting_promise_012: "teasing",
    first_meeting_promise_014: "teasing",
    first_meeting_hall_014: "teasing",
    first_meeting_hall_016: "teasing",
    festival_walk_004: "teasing",
    festival_walk_006: "worried",
    production_year_018: "worried",
    production_year_022: "worried",
    production_year_024: "worried",
    production_year_032: "teasing",
    production_year_042: "worried",
    absence_003: "worried",
    absence_004: "sad",
    mode10_space_012: "sad",
  });
  const AMANE_STEP_EXPRESSIONS = Object.freeze({
    festival_concept_021: "soft",
    festival_concept_new_019: "exasperated",
    festival_concept_057: "soft",
    map_mode01_016: "calm",
    map_mode01_018: "exasperated",
    gx_experience_006: "soft",
    gx_experience_025: "exasperated",
    gx_experience_058: "soft",
    esp32_pitch_011: "startled",
    esp32_pitch_016b: "exasperated",
    esp32_pitch_016d: "exasperated",
    esp32_pitch_016i: "soft",
    esp32_pitch_021: "soft",
    circle_invitation_055: "soft",
    circle_invitation_059: "soft",
    circle_invitation_new_022: "startled",
    circle_invitation_new_026: "soft",
    circle_invitation_new_029: "soft",
    welcome_chat_060: "soft",
  });
  const MIZUHA_STEP_EXPRESSIONS = Object.freeze({
    festival_concept_023: "worried",
    festival_concept_039: "teasing",
    festival_concept_new_018: "teasing",
    festival_concept_064: "worried",
    map_mode01_017: "teasing",
    map_mode01_019: "teasing",
    gx_experience_014: "teasing",
    gx_experience_022: "teasing",
    gx_experience_026: "worried",
    esp32_pitch_018: "worried",
    esp32_pitch_020: "teasing",
    circle_invitation_008: "sad",
    circle_invitation_043: "worried",
    circle_invitation_058: "teasing",
    circle_invitation_060: "teasing",
    circle_invitation_new_027: "teasing",
    welcome_chat_055: "worried",
    welcome_chat_058: "worried",
    welcome_chat_072: "teasing",
  });
  const CHARACTER_STEP_EXPRESSIONS = Object.freeze({
    amane: AMANE_STEP_EXPRESSIONS,
    mizuha: MIZUHA_STEP_EXPRESSIONS,
    sakuya: SAKUYA_STEP_EXPRESSIONS,
  });
  const CHARACTER_EXPRESSION_ALIASES = Object.freeze({
    amane: Object.freeze({ bright: "calm", smile: "soft", teasing: "soft", worried: "exasperated", sad: "soft" }),
    mizuha: Object.freeze({ bright: "teasing", smile: "teasing", soft: "calm", startled: "teasing", exasperated: "worried" }),
  });
  const CHARACTER_EXPRESSION_ASSETS = Object.freeze({
    amane: Object.freeze({
      calm: "assets/characters/amane-calm-07-v3.png",
      startled: "assets/characters/amane-startled-07-v3.png",
      exasperated: "assets/characters/amane-exasperated-07-v3.png",
      soft: "assets/characters/amane-soft-07-v3.png",
    }),
    mizuha: Object.freeze({
      calm: "assets/characters/mizuha-calm-07-v2.png",
      teasing: "assets/characters/mizuha-teasing-07-v2.png",
      worried: "assets/characters/mizuha-worried-07-v2.png",
      sad: "assets/characters/mizuha-sad-07-v2.png",
    }),
    sakuya: Object.freeze({
      calm: "assets/characters/sakuya-calm-07-v1.png",
      teasing: "assets/characters/sakuya-teasing-07-v1.png",
      worried: "assets/characters/sakuya-worried-07-v1.png",
      sad: "assets/characters/sakuya-sad-07-v1.png",
    }),
  });
  const expressionForStep = (step) => {
    const scriptedExpression = step?.expression
      || CHARACTER_STEP_EXPRESSIONS[step?.speaker]?.[step?.id]
      || "calm";
    return CHARACTER_EXPRESSION_ALIASES[step?.speaker]?.[scriptedExpression] || scriptedExpression;
  };
  const portraitAssetForStep = (step) => (
    CHARACTER_EXPRESSION_ASSETS[step?.speaker]?.[expressionForStep(step)] || ""
  );
  const VIEWED_DEFAULTS = Object.freeze({
    gxDeepTime: false,
    mode03Forest: false,
    mode03Rain: false,
    mode03Overlay: false,
    mode07AbstractPoint: false,
    mode07Source: false,
    mode07Derived: false,
    mode08Nature: false,
    mode08Life: false,
    mode08Memory: false,
    mode10SpaceOverview: false,
  });

  const elements = {
    particles: layer.querySelector("#novel-particles"),
    titleScreen: layer.querySelector("#novel-title-screen"),
    runtime: layer.querySelector("#novel-runtime"),
    start: layer.querySelector("#novel-start-button"),
    resume: layer.querySelector("#novel-resume-button"),
    titleGallery: layer.querySelector("#novel-title-gallery-button"),
    titleGalleryProgress: layer.querySelector("#novel-title-gallery-progress"),
    close: layer.querySelector("#novel-close-button"),
    home: layer.querySelector("#novel-home-button"),
    restart: layer.querySelector("#novel-restart-button"),
    auto: layer.querySelector("#novel-auto-button"),
    fastForward: layer.querySelector("#novel-fast-forward-button"),
    fastForwardLabel: layer.querySelector("#novel-fast-forward-label"),
    jumpButton: layer.querySelector("#novel-jump-button"),
    jumpPanel: layer.querySelector("#novel-jump-panel"),
    jumpList: layer.querySelector("#novel-jump-list"),
    jumpCurrent: layer.querySelector("#novel-jump-current"),
    jumpClose: layer.querySelector("#novel-jump-close"),
    logButton: layer.querySelector("#novel-log-button"),
    logPanel: layer.querySelector("#novel-log-panel"),
    logClose: layer.querySelector("#novel-log-close"),
    logTitle: layer.querySelector("#novel-log-title"),
    logViewHeard: layer.querySelector("#novel-log-view-heard"),
    logViewScript: layer.querySelector("#novel-log-view-script"),
    logContent: layer.querySelector("#novel-log-content"),
    logCommentCount: layer.querySelector("#novel-log-comment-count"),
    logDeleteAll: layer.querySelector("#novel-log-delete-all"),
    logExport: layer.querySelector("#novel-log-export"),
    logScriptExport: layer.querySelector("#novel-log-script-export"),
    logStatus: layer.querySelector("#novel-log-status"),
    saveButton: layer.querySelector("#novel-save-button"),
    loadButton: layer.querySelector("#novel-load-button"),
    savePanel: layer.querySelector("#novel-save-panel"),
    saveClose: layer.querySelector("#novel-save-close"),
    saveTitle: layer.querySelector("#novel-save-title"),
    saveTab: layer.querySelector("#novel-save-tab"),
    loadTab: layer.querySelector("#novel-load-tab"),
    saveStatus: layer.querySelector("#novel-save-status"),
    saveSlots: layer.querySelector("#novel-save-slots"),
    configButton: layer.querySelector("#novel-config-button"),
    configPanel: layer.querySelector("#novel-config-panel"),
    configClose: layer.querySelector("#novel-config-close"),
    configReset: layer.querySelector("#novel-config-reset"),
    messageSpeed: layer.querySelector("#novel-message-speed"),
    messageSpeedValue: layer.querySelector("#novel-message-speed-value"),
    reducedMotion: layer.querySelector("#novel-reduced-motion"),
    evesButton: layer.querySelector("#novel-eves-button"),
    evesCount: layer.querySelector("#novel-eves-count"),
    evesPanel: layer.querySelector("#novel-eves-panel"),
    evesClose: layer.querySelector("#novel-eves-close"),
    evesCurrent: layer.querySelector("#novel-eves-current"),
    evesGraph: layer.querySelector("#novel-eves-graph"),
    evesHistory: layer.querySelector("#novel-eves-history"),
    evesRewind: layer.querySelector("#novel-eves-rewind"),
    evesRewindNote: layer.querySelector("#novel-eves-rewind-note"),
    galleryButton: layer.querySelector("#novel-gallery-button"),
    galleryCount: layer.querySelector("#novel-gallery-count"),
    galleryPanel: layer.querySelector("#novel-gallery-panel"),
    galleryClose: layer.querySelector("#novel-gallery-close"),
    galleryProgressValue: layer.querySelector("#novel-gallery-progress-value"),
    galleryProgressCopy: layer.querySelector("#novel-gallery-progress-copy"),
    galleryProgressBar: layer.querySelector("#novel-gallery-progress-bar"),
    galleryGrid: layer.querySelector("#novel-gallery-grid"),
    galleryViewer: layer.querySelector("#novel-gallery-viewer"),
    galleryViewerClose: layer.querySelector("#novel-gallery-viewer-close"),
    galleryViewerPrevious: layer.querySelector("#novel-gallery-viewer-previous"),
    galleryViewerNext: layer.querySelector("#novel-gallery-viewer-next"),
    galleryViewerCount: layer.querySelector("#novel-gallery-viewer-count"),
    galleryViewerFigure: layer.querySelector("#novel-gallery-viewer-figure"),
    galleryViewerImage: layer.querySelector("#novel-gallery-viewer-image"),
    galleryViewerChapter: layer.querySelector("#novel-gallery-viewer-chapter"),
    galleryViewerTitle: layer.querySelector("#novel-gallery-viewer-title"),
    modeReadout: layer.querySelector("#novel-mode-readout"),
    progress: layer.querySelector("#novel-progress-bar"),
    temporalTransition: layer.querySelector("#novel-temporal-transition"),
    chapterCard: layer.querySelector("#novel-chapter-card"),
    chapterIndex: layer.querySelector("#novel-chapter-index"),
    chapterTitle: layer.querySelector("#novel-chapter-title"),
    cast: layer.querySelector("#novel-cast"),
    characterSora: layer.querySelector("#novel-character-sora"),
    characterMinamo: layer.querySelector("#novel-character-minamo"),
    characterSakuya: layer.querySelector("#novel-character-sakuya"),
    avatar: layer.querySelector("#novel-avatar"),
    avatarGlyph: layer.querySelector("#novel-avatar-glyph"),
    dataKind: layer.querySelector("#novel-data-kind"),
    signalTitle: layer.querySelector("#novel-signal-title"),
    sourceLabel: layer.querySelector("#novel-source-label"),
    dialogue: layer.querySelector("#novel-dialogue"),
    speaker: layer.querySelector("#novel-speaker"),
    text: layer.querySelector("#novel-text"),
    cursor: layer.querySelector("#novel-cursor"),
    continueMark: layer.querySelector("#novel-continue"),
    choices: layer.querySelector("#novel-choices"),
    location: layer.querySelector("#novel-location"),
    slackSurface: layer.querySelector("#novel-slack-surface"),
    operationsPhoneSurface: layer.querySelector("#novel-operations-phone-surface"),
    operationsPhoneClock: layer.querySelector("#novel-operations-phone-clock"),
    operationsPhoneNoticeTime: layer.querySelector("#novel-operations-phone-notice-time"),
    operationsPhoneNoticeSender: layer.querySelector("#novel-operations-phone-notice-sender"),
    operationsPhoneNoticeBody: layer.querySelector("#novel-operations-phone-notice-body"),
    operationsPhoneAudioSpeaker: layer.querySelector("#novel-operations-phone-audio-speaker"),
    operationsPhoneAudioStatus: layer.querySelector("#novel-operations-phone-audio-status"),
    evidenceSurface: layer.querySelector("#novel-evidence-surface"),
    reflectionSurface: layer.querySelector("#novel-reflection-surface"),
    resultSurface: layer.querySelector("#novel-result-surface"),
  };

  const scenes = story.scenes;
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  const allSteps = scenes.flatMap((scene) => scene.steps);
  const stepMap = new Map(allSteps.map((step) => [step.id, step]));
  const stepIndexMap = new Map(allSteps.map((step, index) => [step.id, index]));
  const trueEndStory = globalThis.GaiaI18n?.view(globalThis.GAIA_TRUE_END_STORY) || globalThis.GAIA_TRUE_END_STORY;
  const beyondSteps = Object.freeze((trueEndStory?.scenes || [])
    .flatMap((scene) => scene.steps || []));
  const beyondStepMap = new Map(beyondSteps.map((step) => [step.id, step]));
  const logSteps = Object.freeze([...allSteps, ...beyondSteps]);
  const logStepMap = new Map(logSteps.map((step) => [step.id, step]));
  if (logStepMap.size !== logSteps.length) throw new Error("[GAIA novel] Duplicate story/TRANSMISSION LOG step IDs");
  const scriptArchiveSections = Object.freeze([
    ...scenes.map((scene, index) => Object.freeze({
      id: `story-${scene.id}`,
      source: "story",
      get eyebrow() { return scene.chapter || `STORY ${String(index + 1).padStart(2, "0")}`; },
      get title() { return scene.title || scene.id; },
      steps: scene.steps || [],
    })),
    ...(trueEndStory?.scenes || []).map((scene, index) => Object.freeze({
      id: `apeironcene-${scene.id}`,
      source: "apeironcene",
      eyebrow: `APEIRONCENE ${scene.number || String(index + 1).padStart(2, "0")}`,
      get title() { return scene.title || scene.id; },
      steps: scene.steps || [],
    })),
  ]);
  const scriptArchiveStepCount = scriptArchiveSections.reduce((count, section) => count + section.steps.length, 0);
  if (scriptArchiveStepCount !== logSteps.length) throw new Error("[GAIA novel] Complete script archive is missing steps");
  const galleryEntries = Object.freeze([...(backgroundCues.gallery || [])]);
  const galleryEntryMap = new Map(galleryEntries.map((entry) => [entry.id, entry]));
  const galleryPresentations = Object.freeze([
    Object.freeze({ tone: "arrival", label: "FIRST LIGHT" }),
    Object.freeze({ tone: "halo", label: "TURNING LIGHT" }),
    Object.freeze({ tone: "tide", label: "OCEAN GAZE" }),
    Object.freeze({ tone: "circuit", label: "SHARED PROTOTYPE" }),
    Object.freeze({ tone: "orbit", label: "SAME CIRCLE" }),
    Object.freeze({ tone: "horizon", label: "NEXT HORIZON" }),
  ]);
  if (!galleryEntries.length || galleryEntryMap.size !== galleryEntries.length) {
    throw new Error("[GAIA novel] CG gallery data is unavailable or contains duplicate IDs");
  }
  galleryEntries.forEach((entry) => {
    if (!stepMap.has(entry.unlockStepId) || !entry.assetPath) {
      throw new Error(`[GAIA novel] Invalid CG gallery entry: ${entry.id}`);
    }
  });
  if (stepMap.size !== allSteps.length) {
    const seenStepIds = new Set();
    const duplicateStepIds = allSteps
      .map((step) => step.id)
      .filter((stepId) => seenStepIds.has(stepId) || !seenStepIds.add(stepId));
    throw new Error(`[GAIA novel] Duplicate story step IDs: ${[...new Set(duplicateStepIds)].join(", ")}`);
  }
  const scriptIndexMap = new Map(allSteps.map((step, index) => [step.id, index + 1]));
  const ENDING_JUMP_ID = "ending";
  const ENDING_STEP_ID = "welcome_chat_095";
  const TRUE_END_JUMP_ID = "true-end";
  const storySceneJumpEntries = scenes.map((scene, index) => {
    const firstStep = scene.steps?.[0];
    const scriptIndex = scriptIndexMap.get(firstStep?.id);
    if (!firstStep || !Number.isInteger(scriptIndex)) throw new Error(`[GAIA novel] Scene has no valid first step: ${scene.id}`);
    return Object.freeze({ scene, sceneId: scene.id, firstStepId: firstStep.id, scriptIndex, index: index + 1 });
  });
  const endingScriptIndex = scriptIndexMap.get(ENDING_STEP_ID);
  if (!stepMap.has(ENDING_STEP_ID) || !Number.isInteger(endingScriptIndex)) {
    throw new Error(`[GAIA novel] Ending jump target is unavailable: ${ENDING_STEP_ID}`);
  }
  const endingSceneJumpEntry = Object.freeze({
    scene: Object.freeze({ id: ENDING_JUMP_ID, chapter: "07 / ENDING", title: "エンディング" }),
    sceneId: ENDING_JUMP_ID,
    firstStepId: ENDING_STEP_ID,
    scriptIndex: endingScriptIndex,
    index: scenes.length + 1,
    isEnding: true,
  });
  const trueEndSceneJumpEntry = Object.freeze({
    scene: Object.freeze({ id: TRUE_END_JUMP_ID, chapter: "08 / APEIRONCENE", title: globalThis.GAIA_TRUE_END_STORY?.title || "APEIRONCENE" }),
    sceneId: TRUE_END_JUMP_ID,
    scriptIndex: endingScriptIndex + 1,
    scriptLabel: "APEIRONCENE #001",
    index: scenes.length + 2,
    isTrueEnd: true,
  });
  const sceneJumpEntries = Object.freeze([
    ...storySceneJumpEntries,
    endingSceneJumpEntry,
    ...(APEIRONCENE_SCENE_JUMP_ENABLED ? [trueEndSceneJumpEntry] : []),
  ]);
  if (new Set(sceneJumpEntries.map((entry) => entry.sceneId)).size !== sceneJumpEntries.length) {
    throw new Error("[GAIA novel] Duplicate scene IDs in debug jump map");
  }
  if (!globalThis.GaiaNovelTemporal?.create) throw new Error("[GAIA temporal metadata] runtime is not loaded");
  const temporalRuntime = globalThis.GaiaNovelTemporal.create(story);
  const firstStepForScene = (sceneId) => sceneMap.get(sceneId)?.steps?.[0]?.id || null;
  const reflectionStep = allSteps.find((step) => step.type === "reflectionChoice");
  const reflectionOptionMap = new Map((reflectionStep?.options || []).map((option) => [option.id, option]));

  const defaultState = () => ({
    storyVersion: story.storyVersion,
    stepId: firstStepForScene(story.startSceneId),
    reachedSceneIds: [],
    viewed: { ...VIEWED_DEFAULTS },
    evesRoute: [],
    observationOrder: "LOCAL_FIRST",
    editorialChoice: null,
    reflectionIds: [],
    resultTone: null,
    demoInterest: "",
    metCharacters: { mizuha: false, amane: false, sakuya: false },
    audio: { muted: false, volume: 0.1 },
    readStepIds: [],
    clear: false,
    archivesUnlocked: false,
    sessionId: "",
  });

  let state = defaultState();
  let isOpen = false;
  let novelEntryPending = null;
  let hasStarted = false;
  let runtimeRevealPending = false;
  let pendingPortraitAdvance = null;
  let isRevealing = false;
  let fullText = "";
  let dialoguePages = [];
  let dialoguePageLayouts = [];
  let dialoguePageIndex = 0;
  let dialoguePageReveal = true;
  let dialogueSourceText = "";
  let dialoguePaginationGeneration = 0;
  let dialogueResizeTimer = 0;
  let dialogueObservedWidth = 0;
  let dialogueReflowActive = false;
  let dialogueReflowPending = false;
  let dialogueForceFallbackForInspection = false;
  let revealTimer = 0;
  let revealFrame = 0;
  let revealGeneration = 0;
  let autoTimer = 0;
  const reactionTimers = new Set();
  const fastForwardState = {
    timer: 0,
    holdTimer: 0,
    controlDown: false,
    keyActive: false,
    buttonActive: false,
    blocked: false,
  };
  let slackTransitionTimer = 0;
  let slackScrollGuardUntil = 0;
  let sectionSeparatorTimer = 0;
  let sectionEntryTimer = 0;
  let staffRollFinaleTimer = 0;
  let sectionSeparatorActive = false;
  let sectionSkipPending = false;
  let sceneJumpTransitionPending = false;
  let temporalTransitionTimer = 0;
  let temporalTransitionActive = false;
  let previousFocus = null;
  let galleryPreviousFocus = null;
  let galleryViewerPreviousFocus = null;
  let galleryViewerCloseTimer = 0;
  let galleryViewerTransitionGeneration = 0;
  let galleryViewerPointerStart = null;
  let archivePreviousFocus = null;
  let archiveMode = "save";
  let pendingSlotAction = "";
  let pendingSlotTimer = 0;
  let pendingInteraction = null;
  let detourState = null;
  let detourDock = null;
  let detourDockObserver = null;
  let detourAutoReturnTimer = 0;
  let detourSkipFallbackTimer = 0;
  let interactionLifecycle = "idle";
  let backgroundTransitionPending = false;
  let backgroundCastEntrance = null;
  let deferredSectionBackgroundTransition = null;
  let deferredOpeningBackground = null;
  let requestedStoryTrack = null;
  let logFollowLatest = true;
  let logView = "heard";
  let logDebugMode = false;
  let logDebugKeys = "";
  let logDebugKeyTime = 0;
  let debugJumpActive = false;
  let jumpOutsidePointerBlocked = false;
  let scriptCopyFeedbackTimer = 0;
  let config = { messageSpeedPercent: DEFAULT_MESSAGE_SPEED_PERCENT, reducedMotion: false };

  const getScriptDebugElements = () => ({
    root: document.querySelector("#novel-script-debug"),
    number: document.querySelector("#novel-script-debug-number"),
    stepId: document.querySelector("#novel-script-debug-step-id"),
    copyButton: document.querySelector("#novel-script-debug-copy-button"),
    copyStatus: document.querySelector("#novel-script-debug-copy-status"),
  });

  const clearScriptCopyFeedback = () => {
    window.clearTimeout(scriptCopyFeedbackTimer);
    scriptCopyFeedbackTimer = 0;
    const debug = getScriptDebugElements();
    if (debug.copyStatus) debug.copyStatus.textContent = "COPY";
    if (debug.copyButton) {
      debug.copyButton.dataset.copyState = "idle";
      debug.copyButton.setAttribute("aria-label", "現在のスクリプト位置をコピー");
    }
  };

  const closeSceneJump = ({ restoreFocus = true } = {}) => {
    if (!elements.jumpPanel || !elements.jumpButton) return;
    const wasOpen = !elements.jumpPanel.hidden;
    elements.jumpPanel.hidden = true;
    elements.jumpButton.setAttribute("aria-expanded", "false");
    if (wasOpen && restoreFocus) elements.jumpButton.focus({ preventScroll: true });
  };

  const syncSceneJumpCurrent = (step) => {
    if (!elements.jumpList || !elements.jumpCurrent) return;
    const scene = sceneMap.get(step?.sceneId);
    const entry = step?.id === ENDING_STEP_ID
      ? sceneJumpEntries.find((candidate) => candidate.isEnding)
      : sceneJumpEntries.find((candidate) => candidate.sceneId === scene?.id);
    elements.jumpList.querySelectorAll(".novel-jump-item").forEach((button) => {
      const current = button.dataset.sceneId === entry?.sceneId;
      button.classList.toggle("is-current", current);
      if (current) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    elements.jumpCurrent.textContent = entry
      ? `${String(entry.index).padStart(2, "0")} / ${entry.scene.chapter}｜${entry.scene.title} / SCRIPT #${String(entry.scriptIndex).padStart(4, "0")}`
      : "現在位置を特定できません";
  };

  const renderSceneJumpList = () => {
    if (!elements.jumpList) return;
    const fragment = document.createDocumentFragment();
    sceneJumpEntries.forEach((entry) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const index = document.createElement("span");
      const label = document.createElement("span");
      const chapter = document.createElement("small");
      const title = document.createElement("strong");
      const script = document.createElement("span");
      button.type = "button";
      button.className = "novel-jump-item";
      button.dataset.sceneId = entry.sceneId;
      index.className = "novel-jump-index";
      index.textContent = String(entry.index).padStart(2, "0");
      label.className = "novel-jump-label";
      chapter.textContent = entry.scene.chapter;
      title.textContent = entry.scene.title;
      label.append(chapter, title);
      script.className = "novel-jump-script";
      script.textContent = entry.scriptLabel || `SCRIPT #${String(entry.scriptIndex).padStart(4, "0")}`;
      button.append(index, label, script);
      item.append(button);
      fragment.append(item);
    });
    elements.jumpList.replaceChildren(fragment);
  };

  const setSceneJumpAvailability = (available) => {
    if (!elements.jumpButton) return;
    elements.jumpButton.hidden = !available;
    elements.jumpButton.disabled = !available;
    if (!available) closeSceneJump({ restoreFocus: false });
  };

  const openSceneJump = () => {
    if (!isOpen || !hasStarted || elements.runtime.hidden || !elements.jumpPanel || !elements.jumpButton) return;
    closeGallery({ restoreFocus: false });
    closeLog();
    closeManualArchive();
    closeConfig();
    closeEves();
    resetFastForward();
    syncSceneJumpCurrent(currentStep());
    elements.jumpPanel.hidden = false;
    elements.jumpButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      const current = elements.jumpList?.querySelector(".novel-jump-item.is-current")
        || elements.jumpList?.querySelector(".novel-jump-item");
      current?.scrollIntoView?.({ block: "nearest" });
      current?.focus?.({ preventScroll: true });
    });
  };

  const toggleSceneJump = () => {
    if (!elements.jumpPanel) return;
    if (elements.jumpPanel.hidden) openSceneJump();
    else closeSceneJump();
  };

  const clearScriptDebug = () => {
    clearScriptCopyFeedback();
    const debug = getScriptDebugElements();
    if (!debug.root) return;
    if (debug.number) debug.number.textContent = "";
    if (debug.stepId) debug.stepId.textContent = "";
    debug.root.removeAttribute("aria-label");
    debug.root.hidden = true;
    debug.root.setAttribute("aria-hidden", "true");
  };

  const syncScriptDebug = (step) => {
    clearScriptCopyFeedback();
    const debug = getScriptDebugElements();
    if (!debug.root) return;
    const index = scriptIndexMap.get(step?.id);
    const valid = Boolean(isOpen
      && hasStarted
      && !elements.runtime.hidden
      && Number.isInteger(index)
      && stepMap.get(step.id) === step
      && state.stepId === step.id
      && debug.number
      && debug.stepId);
    if (!valid) {
      clearScriptDebug();
      return;
    }
    debug.number.textContent = String(index).padStart(4, "0");
    debug.stepId.textContent = step.id;
    debug.root.setAttribute("aria-label", `スクリプト位置 ${index}、${step.id}`);
    debug.root.hidden = false;
    debug.root.setAttribute("aria-hidden", "false");
    syncSceneJumpCurrent(step);
  };

  const particleSystem = window.GaiaParticles?.create?.(elements.particles, {
    variant: "story",
    intensity: 0.62,
  }) || { start() {}, stop() {} };

  const runSceneTransition = (swapScene, event = null, tone = "novel") => {
    pendingPortraitAdvance = null;
    const transition = window.GaiaSceneTransition;
    if (!transition) return Promise.resolve(swapScene());
    const hasOrigin = Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY);
    return transition.run(swapScene, {
      tone,
      origin: hasOrigin ? { x: event.clientX, y: event.clientY } : undefined,
    });
  };

  const motionReduced = () => SYSTEM_REDUCED_MOTION || config.reducedMotion;
  const safeJson = (value) => {
    try { return JSON.parse(value); } catch { return null; }
  };
  const readStorage = (key) => {
    try { return window.localStorage.getItem(key); } catch { return null; }
  };
  const writeStorage = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };
  const readSessionStorage = (key) => {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  };
  const writeSessionStorage = (key, value) => {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };
  const normalizeLogComments = (candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};
    return Object.fromEntries(Object.entries(candidate)
      .filter(([id, comment]) => stepMap.has(id) && typeof comment === "string" && comment.trim())
      .map(([id, comment]) => [id, comment]));
  };
  let logComments = normalizeLogComments(safeJson(readSessionStorage(LOG_COMMENT_KEY)));
  const persistLogComments = () => writeSessionStorage(LOG_COMMENT_KEY, JSON.stringify(logComments));
  const getGalleryUnlocks = () => {
    const candidate = safeJson(readStorage(GALLERY_KEY));
    const ids = Array.isArray(candidate) ? candidate : candidate?.unlocked;
    return new Set((Array.isArray(ids) ? ids : []).filter((id) => galleryEntryMap.has(id)));
  };
  const writeGalleryUnlocks = (unlocked) => writeStorage(GALLERY_KEY, JSON.stringify({
    version: 1,
    unlocked: galleryEntries.filter((entry) => unlocked.has(entry.id)).map((entry) => entry.id),
  }));
  const galleryProgress = () => {
    const unlocked = getGalleryUnlocks();
    const total = galleryEntries.length;
    const count = unlocked.size;
    return { unlocked, total, count, percentage: total ? Math.round((count / total) * 100) : 0 };
  };
  const renderGalleryControls = () => {
    const { count, total, percentage } = galleryProgress();
    if (elements.galleryCount) elements.galleryCount.textContent = `${count} / ${total}`;
    if (elements.titleGalleryProgress) elements.titleGalleryProgress.textContent = `${count} / ${total}｜${percentage}%`;
    if (elements.galleryProgressValue) elements.galleryProgressValue.textContent = `${percentage}%`;
    if (elements.galleryProgressCopy) elements.galleryProgressCopy.textContent = `${count} / ${total} UNLOCKED`;
    if (elements.galleryProgressBar) elements.galleryProgressBar.style.width = `${percentage}%`;
  };
  const unlockedGalleryEntries = () => {
    const unlocked = getGalleryUnlocks();
    return galleryEntries.filter((entry) => unlocked.has(entry.id));
  };
  const syncGalleryViewerNavigation = () => {
    if (!elements.galleryViewer) return;
    const entries = unlockedGalleryEntries();
    const index = entries.findIndex((entry) => entry.id === elements.galleryViewer.dataset.galleryId);
    const previousEntry = index > 0 ? entries[index - 1] : null;
    const nextEntry = index >= 0 && index < entries.length - 1 ? entries[index + 1] : null;
    const activeControl = document.activeElement;
    if (elements.galleryViewerPrevious) {
      elements.galleryViewerPrevious.disabled = !previousEntry;
      elements.galleryViewerPrevious.setAttribute("aria-label", previousEntry ? `前のCG「${previousEntry.title}」へ` : "前のCGはありません");
    }
    if (elements.galleryViewerNext) {
      elements.galleryViewerNext.disabled = !nextEntry;
      elements.galleryViewerNext.setAttribute("aria-label", nextEntry ? `次のCG「${nextEntry.title}」へ` : "次のCGはありません");
    }
    if (activeControl === elements.galleryViewerPrevious && !previousEntry) {
      (nextEntry ? elements.galleryViewerNext : elements.galleryViewerClose)?.focus({ preventScroll: true });
    } else if (activeControl === elements.galleryViewerNext && !nextEntry) {
      (previousEntry ? elements.galleryViewerPrevious : elements.galleryViewerClose)?.focus({ preventScroll: true });
    }
    if (elements.galleryViewerCount) {
      const current = index >= 0 ? index + 1 : 0;
      elements.galleryViewerCount.textContent = `${String(current).padStart(2, "0")} / ${String(entries.length).padStart(2, "0")}`;
    }
  };
  const renderGalleryViewerEntry = (entry) => {
    if (!entry || !elements.galleryViewer) return;
    elements.galleryViewer.dataset.galleryId = entry.id;
    const portraitViewer = window.matchMedia("(max-width: 720px)").matches && entry.mobileAssetPath;
    elements.galleryViewerImage.src = `./${portraitViewer ? entry.mobileAssetPath : entry.assetPath}`;
    elements.galleryViewerImage.alt = entry.alt;
    elements.galleryViewerChapter.textContent = entry.chapter;
    elements.galleryViewerTitle.textContent = entry.title;
    syncGalleryViewerNavigation();
  };
  const finishGalleryViewerClose = ({ restoreFocus = true } = {}) => {
    if (!elements.galleryViewer) return;
    window.clearTimeout(galleryViewerCloseTimer);
    galleryViewerCloseTimer = 0;
    elements.galleryViewer.hidden = true;
    elements.galleryViewer.classList.remove("is-closing");
    delete elements.galleryViewer.dataset.transitionState;
    delete elements.galleryViewer.dataset.galleryId;
    elements.galleryViewerImage?.removeAttribute("src");
    if (elements.galleryViewerImage) elements.galleryViewerImage.alt = "";
    if (restoreFocus) galleryViewerPreviousFocus?.focus?.({ preventScroll: true });
    galleryViewerPreviousFocus = null;
  };
  const closeGalleryViewer = ({ restoreFocus = true, immediate = false } = {}) => {
    if (!elements.galleryViewer) return;
    const wasOpen = !elements.galleryViewer.hidden;
    if (!wasOpen) return;
    if (elements.galleryViewer.classList.contains("is-closing") && !immediate) return;
    galleryViewerTransitionGeneration += 1;
    elements.galleryViewerFigure?.getAnimations?.().forEach((animation) => animation.cancel());
    if (immediate || motionReduced()) {
      finishGalleryViewerClose({ restoreFocus });
      return;
    }
    elements.galleryViewer.classList.add("is-closing");
    elements.galleryViewer.dataset.transitionState = "closing";
    galleryViewerCloseTimer = window.setTimeout(() => finishGalleryViewerClose({ restoreFocus }), 380);
  };
  const turnGalleryViewer = async (offset) => {
    if (!elements.galleryViewer || elements.galleryViewer.hidden || elements.galleryViewer.classList.contains("is-closing")) return;
    if (elements.galleryViewer.dataset.transitionState === "turning") return;
    const entries = unlockedGalleryEntries();
    const currentIndex = entries.findIndex((entry) => entry.id === elements.galleryViewer.dataset.galleryId);
    const nextEntry = entries[currentIndex + offset];
    if (!nextEntry) return;
    const generation = ++galleryViewerTransitionGeneration;
    const figure = elements.galleryViewerFigure;
    const direction = offset > 0 ? 1 : -1;
    elements.galleryViewer.dataset.transitionState = "turning";
    elements.galleryViewer.dataset.turnDirection = direction > 0 ? "next" : "previous";
    if (!motionReduced() && figure?.animate) {
      let outgoingAnimation;
      try {
        outgoingAnimation = figure.animate([
          { opacity: 1, transform: "translateX(0) scale(1)", filter: "blur(0)" },
          { opacity: 0, transform: `translateX(${-18 * direction}px) scale(0.992)`, filter: "blur(2px)" },
        ], { duration: 150, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
        await outgoingAnimation.finished;
      } catch {}
      outgoingAnimation?.cancel();
    }
    if (generation !== galleryViewerTransitionGeneration || elements.galleryViewer.hidden) return;
    renderGalleryViewerEntry(nextEntry);
    if (!motionReduced() && figure?.animate) {
      let incomingAnimation;
      try {
        incomingAnimation = figure.animate([
          { opacity: 0, transform: `translateX(${22 * direction}px) scale(0.992)`, filter: "blur(2px)" },
          { opacity: 1, transform: "translateX(0) scale(1)", filter: "blur(0)" },
        ], { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" });
        await incomingAnimation.finished;
      } catch {}
      incomingAnimation?.cancel();
    }
    if (generation === galleryViewerTransitionGeneration) {
      delete elements.galleryViewer.dataset.transitionState;
      delete elements.galleryViewer.dataset.turnDirection;
    }
  };
  const openGalleryViewer = (entry) => {
    if (!entry || !elements.galleryViewer || !getGalleryUnlocks().has(entry.id)) return;
    galleryViewerPreviousFocus = document.activeElement;
    window.clearTimeout(galleryViewerCloseTimer);
    galleryViewerCloseTimer = 0;
    galleryViewerTransitionGeneration += 1;
    elements.galleryViewer.classList.remove("is-closing");
    delete elements.galleryViewer.dataset.transitionState;
    renderGalleryViewerEntry(entry);
    elements.galleryViewer.hidden = false;
    requestAnimationFrame(() => elements.galleryViewerClose.focus({ preventScroll: true }));
  };
  const renderGallery = () => {
    if (!elements.galleryGrid) return;
    const { unlocked } = galleryProgress();
    const fragment = document.createDocumentFragment();
    galleryEntries.forEach((entry, index) => {
      const available = unlocked.has(entry.id);
      const presentation = galleryPresentations[index] || { tone: "memory", label: "VISUAL MEMORY" };
      const card = document.createElement("button");
      const visual = document.createElement("span");
      const number = document.createElement("small");
      const stateLabel = document.createElement("span");
      const copy = document.createElement("span");
      const chapter = document.createElement("small");
      const title = document.createElement("strong");
      card.type = "button";
      card.className = `novel-gallery-card ${available ? "is-unlocked" : "is-locked"}`;
      card.dataset.galleryId = entry.id;
      card.dataset.galleryTone = presentation.tone;
      card.dataset.unlocked = String(available);
      card.style.setProperty("--gallery-order", String(index));
      card.setAttribute("aria-label", available ? `${entry.title}を拡大表示` : `CG ${index + 1}、未解放`);
      visual.className = "novel-gallery-card-visual";
      number.className = "novel-gallery-card-number";
      number.textContent = String(index + 1).padStart(2, "0");
      stateLabel.className = "novel-gallery-card-state";
      stateLabel.textContent = available ? presentation.label : "SIGNAL LOCKED";
      visual.append(number, stateLabel);
      if (available) {
        const image = document.createElement("img");
        image.src = `./${entry.assetPath}`;
        image.alt = entry.alt;
        image.loading = "lazy";
        image.decoding = "async";
        visual.prepend(image);
      } else {
        const lock = document.createElement("i");
        lock.className = "novel-gallery-lock-symbol";
        lock.setAttribute("aria-hidden", "true");
        visual.append(lock);
      }
      copy.className = "novel-gallery-card-copy";
      chapter.textContent = available ? entry.chapter : "LOCKED MEMORY";
      title.textContent = available ? entry.title : "物語を進めると解放";
      copy.append(chapter, title);
      card.append(visual, copy);
      if (available) card.addEventListener("click", () => openGalleryViewer(entry));
      else card.disabled = true;
      fragment.append(card);
    });
    elements.galleryGrid.replaceChildren(fragment);
    renderGalleryControls();
  };
  const unlockGalleryCue = (cue) => {
    if (debugJumpActive || !cue?.galleryId || !galleryEntryMap.has(cue.galleryId)) return false;
    const unlocked = getGalleryUnlocks();
    if (unlocked.has(cue.galleryId)) return false;
    unlocked.add(cue.galleryId);
    writeGalleryUnlocks(unlocked);
    renderGalleryControls();
    if (!elements.galleryPanel?.hidden) renderGallery();
    return true;
  };
  const seedGalleryFromProgress = (progress) => {
    if (!progress) return false;
    const unlocked = getGalleryUnlocks();
    const before = unlocked.size;
    if (progress.clear) galleryEntries.forEach((entry) => unlocked.add(entry.id));
    else {
      const read = new Set(progress.readStepIds || []);
      const reached = new Set(progress.reachedSceneIds || []);
      const currentIndex = stepIndexMap.get(progress.stepId) ?? -1;
      galleryEntries.forEach((entry) => {
        const unlockStep = stepMap.get(entry.unlockStepId);
        const unlockIndex = stepIndexMap.get(entry.unlockStepId) ?? Number.POSITIVE_INFINITY;
        if (read.has(entry.unlockStepId) || (reached.has(unlockStep?.sceneId) && currentIndex >= unlockIndex)) unlocked.add(entry.id);
      });
    }
    if (unlocked.size !== before) writeGalleryUnlocks(unlocked);
    renderGalleryControls();
    return unlocked.size !== before;
  };
  const closeGallery = ({ restoreFocus = true } = {}) => {
    if (!elements.galleryPanel) return;
    const wasOpen = !elements.galleryPanel.hidden;
    closeGalleryViewer({ restoreFocus: false, immediate: true });
    elements.galleryPanel.hidden = true;
    elements.galleryPanel.setAttribute("aria-hidden", "true");
    elements.galleryButton?.setAttribute("aria-expanded", "false");
    elements.titleGallery?.setAttribute("aria-expanded", "false");
    if (wasOpen && restoreFocus) galleryPreviousFocus?.focus?.({ preventScroll: true });
    galleryPreviousFocus = null;
  };
  const openGallery = () => {
    if (!isOpen || !elements.galleryPanel) return;
    galleryPreviousFocus = document.activeElement;
    resetFastForward();
    closeSceneJump({ restoreFocus: false });
    closeLog();
    closeManualArchive();
    closeConfig();
    closeEves();
    closeGallery({ restoreFocus: false });
    renderGallery();
    elements.galleryPanel.hidden = false;
    elements.galleryPanel.setAttribute("aria-hidden", "false");
    elements.galleryButton?.setAttribute("aria-expanded", "true");
    elements.titleGallery?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => elements.galleryClose.focus({ preventScroll: true }));
  };
  const readAudioState = () => {
    const volumeInput = document.querySelector("#gaia-audio-volume");
    const volume = Number(volumeInput?.value);
    const volumeMaximum = Number(volumeInput?.max);
    const normalizedVolume = volumeMaximum > 1 ? volume / volumeMaximum : volume;
    const muted = document.querySelector("#gaia-audio-toggle")?.getAttribute("aria-pressed") === "true";
    return {
      muted,
      volume: Number.isFinite(normalizedVolume) ? Math.max(0, Math.min(1, normalizedVolume)) : state.audio.volume,
    };
  };

  const version7To8StepIds = new Map([
    ["current_exhibition_005", "current_exhibition_005"],
    ["current_exhibition_006", "current_exhibition_005"],
    ["current_exhibition_007", "current_exhibition_005"],
    ["current_exhibition_008", "current_exhibition_006"],
    ["current_exhibition_009", "current_exhibition_007"],
    ["current_exhibition_010", "current_exhibition_008"],
    ["current_exhibition_011", "current_exhibition_009"],
    ["current_exhibition_012", "current_exhibition_012"],
    ["current_exhibition_013", "current_exhibition_013"],
    ["current_exhibition_014", "current_exhibition_014"],
    ["current_exhibition_015", "current_exhibition_015"],
    ["current_exhibition_016", "current_exhibition_016"],
    ["current_exhibition_017", "opening_empty_seat_001"],
    ["prologue_basil_001", "prologue_basil_001"],
    ["prologue_basil_002", "prologue_basil_002"],
    ["prologue_basil_003", "prologue_basil_002"],
    ["prologue_basil_004", "prologue_basil_004"],
    ["prologue_basil_005", "prologue_basil_005"],
    ["prologue_basil_006", "prologue_basil_006"],
    ["prologue_basil_007", "prologue_basil_006"],
    ["prologue_basil_008", "prologue_basil_006"],
    ["prologue_basil_009", "prologue_basil_007"],
    ["prologue_basil_010", "prologue_basil_008"],
    ["prologue_basil_011", "prologue_basil_008"],
    ["prologue_basil_012", "prologue_basil_008"],
    ["prologue_basil_013", "prologue_basil_008"],
    ["prologue_basil_014", "prologue_basil_008"],
    ["prologue_basil_015", "prologue_basil_008"],
    ["prologue_basil_016", "prologue_basil_008"],
    ["prologue_basil_017", "prologue_basil_008"],
    ["prologue_basil_018", "prologue_basil_010"],
    ["prologue_basil_019", "prologue_basil_010"],
    ["prologue_basil_020", "prologue_basil_010"],
    ["prologue_basil_021", "prologue_basil_010"],
    ["prologue_basil_022", "prologue_basil_010"],
    ["prologue_basil_023", "prologue_basil_010"],
    ["choice_observation_order_001", "choice_observation_order_001"],
    ["choice_observation_order_002", "choice_observation_order_002"],
    ["choice_observation_order_003", "choice_observation_order_002"],
    ["choice_observation_order_004", "choice_observation_order_003"],
    ["choice_observation_order_005", "choice_observation_order_003"],
    ["choice_observation_order_006", "choice_observation_order_003"],
    ["choice_observation_order_007", "choice_observation_order_004"],
    ["choice_observation_order_008", "choice_observation_order_004"],
    ["choice_observation_order_009", "choice_observation_order_004"],
    ["choice_observation_order_010", "choice_observation_order_005"],
    ["choice_observation_order_011", "choice_observation_order_005"],
    ["choice_observation_order_012", "choice_observation_order_005"],
    ["choice_editorial_001", "choice_editorial_001"],
    ["choice_editorial_002", "choice_editorial_001"],
    ["choice_editorial_003", "choice_editorial_002"],
    ["choice_editorial_004", "choice_editorial_003"],
    ["choice_editorial_005", "choice_editorial_004"],
    ["choice_editorial_006", "choice_editorial_005"],
    ["choice_editorial_007", "choice_editorial_006"],
    ["epilogue_reflection_field_001", "epilogue_reflection_field_001"],
    ["epilogue_reflection_field_002", "epilogue_reflection_field_001"],
    ["choice_reflection_001", "choice_reflection_001"],
    ["choice_reflection_002", "choice_reflection_001"],
    ["choice_reflection_003", "choice_reflection_002"],
  ]);
  const registerShiftedInteractionMigration = (sceneId, total) => {
    version7To8StepIds.set(`${sceneId}_001`, `${sceneId}_001`);
    version7To8StepIds.set(`${sceneId}_002`, `${sceneId}_003`);
    for (let index = 3; index < total; index += 1) {
      const from = `${sceneId}_${String(index).padStart(3, "0")}`;
      const to = `${sceneId}_${String(index + 1).padStart(3, "0")}`;
      version7To8StepIds.set(from, to);
    }
    const last = `${sceneId}_${String(total).padStart(3, "0")}`;
    version7To8StepIds.set(last, last);
  };
  [
    ["gx_deep_time", 26],
    ["mode03_map", 20],
    ["mode07_abstract", 54],
    ["mode08_map_layers", 19],
    ["mode10_space", 18],
  ].forEach(([sceneId, total]) => registerShiftedInteractionMigration(sceneId, total));

  const version8To9StepIds = new Map([
    ["gx_deep_time_017", "gx_deep_time_017"],
    ["gx_deep_time_018", "gx_deep_time_017"],
    ["gx_deep_time_019", "gx_deep_time_017"],
    ["gx_deep_time_020", "gx_deep_time_018"],
    ["gx_deep_time_021", "gx_deep_time_019"],
    ["gx_deep_time_022", "gx_deep_time_020"],
    ["gx_deep_time_023", "gx_deep_time_021"],
    ["gx_deep_time_024", "gx_deep_time_022"],
    ["gx_deep_time_025", "gx_deep_time_023"],
    ["gx_deep_time_026", "gx_deep_time_024"],
  ]);

  const migrateStepId = (stepId, sourceVersion = story.storyVersion) => {
    if (typeof stepId !== "string") return null;
    if (Number(sourceVersion) < 13) return firstStepForScene(story.startSceneId);
    let migratedStepId = stepId;
    if (Number(sourceVersion) < 8 && version7To8StepIds.has(stepId)) {
      migratedStepId = version7To8StepIds.get(stepId);
    }
    if (Number(sourceVersion) < 9 && version8To9StepIds.has(migratedStepId)) {
      migratedStepId = version8To9StepIds.get(migratedStepId);
    }
    if (/^gx_experience_0(?:4[5-9]|5[0-4])$/u.test(migratedStepId)) return "gx_experience_055";
    if (migratedStepId === "festival_concept_new_030") return "festival_concept_new_031";
    if (migratedStepId === "welcome_chat_092") return "welcome_chat_094";
    if (migratedStepId === "current_exhibition_017") return "opening_empty_seat_001";
    if (stepMap.has(migratedStepId)) return migratedStepId;
    const mappings = [
      ["current_notice_", "current_exhibition_"],
      ["epilogue_visitor_field_", "epilogue_reflection_field_"],
      ["choice_visitor_action_", "choice_reflection_"],
      ["final_record_", "final_record_"],
    ];
    for (const [from, to] of mappings) {
      if (!migratedStepId.startsWith(from)) continue;
      const mapped = `${to}${migratedStepId.slice(from.length)}`;
      if (stepMap.has(mapped)) return mapped;
      const sceneId = to.slice(0, -1);
      return firstStepForScene(sceneId);
    }
    return firstStepForScene(story.startSceneId);
  };

  const normalizeState = (candidate) => {
    const sourceVersion = Number.isFinite(Number(candidate?.storyVersion)) ? Number(candidate.storyVersion) : 7;
    const resetsLegacyProgress = sourceVersion < 13;
    const legacyIndexStep = Number.isInteger(candidate?.stepIndex)
      ? allSteps[Math.max(0, Math.min(allSteps.length - 1, candidate.stepIndex))]?.id
      : null;
    const stepId = migrateStepId(candidate?.stepId || legacyIndexStep, sourceVersion);
    if (!candidate || !stepId) return null;
    const migratedReadStepIds = !resetsLegacyProgress && Array.isArray(candidate.readStepIds)
      ? [...new Set(candidate.readStepIds
        .map((id) => {
          if (id === "current_exhibition_017") return null;
          return beyondStepMap.has(id) ? id : migrateStepId(id, sourceVersion);
        })
        .filter((id) => logStepMap.has(id) && logStepMap.get(id)?.type !== "phase"))].slice(-260)
      : [];
    const normalized = defaultState();
    normalized.stepId = stepId;
    normalized.reachedSceneIds = !resetsLegacyProgress && Array.isArray(candidate.reachedSceneIds)
      ? candidate.reachedSceneIds.filter((id) => sceneMap.has(id))
      : [];
    normalized.viewed = resetsLegacyProgress ? { ...VIEWED_DEFAULTS } : { ...VIEWED_DEFAULTS, ...(candidate.viewed || {}) };
    normalized.evesRoute = !resetsLegacyProgress && Array.isArray(candidate.evesRoute)
      ? candidate.evesRoute.filter((entry) => ["editorial_choice", "reflection_choice"].includes(entry?.decisionId)).slice(0, 2)
      : [];
    normalized.observationOrder = !resetsLegacyProgress && ["LOCAL_FIRST", "STATION_FIRST"].includes(candidate.observationOrder)
      ? candidate.observationOrder : normalized.observationOrder;
    normalized.editorialChoice = !resetsLegacyProgress && ["SOURCE_RECORD", "DISCLOSE_DERIVATION"].includes(candidate.editorialChoice)
      ? candidate.editorialChoice : null;
    normalized.reflectionIds = !resetsLegacyProgress && Array.isArray(candidate.reflectionIds)
      ? [...new Set(candidate.reflectionIds.filter((id) => reflectionOptionMap.has(id)))].slice(0, 3)
      : [];
    normalized.resultTone = !resetsLegacyProgress && ["LAW", "NEUTRAL", "CHAOS", "UNANSWERED"].includes(candidate.resultTone)
      ? candidate.resultTone : null;
    normalized.demoInterest = !resetsLegacyProgress && ["太古の海", "CO2の季節変動", "気温偏差の地図"].includes(candidate.demoInterest)
      ? candidate.demoInterest : "";
    const currentStepIndex = stepIndexMap.get(stepId) ?? -1;
    normalized.metCharacters = Object.fromEntries(Object.entries(CHAT_CAST_MEETING_GATES).map(([speaker, gate]) => {
      if (resetsLegacyProgress) return [speaker, false];
      const savedFlag = candidate.metCharacters?.[speaker];
      if (typeof savedFlag === "boolean") return [speaker, savedFlag];
      const visibleFromIndex = stepIndexMap.get(gate.visibleFrom) ?? Number.POSITIVE_INFINITY;
      const legacyProgressPassedGate = currentStepIndex >= visibleFromIndex
        && migratedReadStepIds.includes(migrateStepId(gate.completedAt, sourceVersion));
      return [speaker, legacyProgressPassedGate];
    }));
    normalized.audio = {
      muted: Boolean(candidate.audio?.muted),
      volume: Number.isFinite(candidate.audio?.volume) ? Math.max(0, Math.min(1, candidate.audio.volume)) : 0.1,
    };
    normalized.readStepIds = migratedReadStepIds;
    normalized.clear = resetsLegacyProgress ? false : candidate.clear === true;
    normalized.archivesUnlocked = resetsLegacyProgress ? false : Boolean(candidate.archivesUnlocked);
    normalized.sessionId = typeof candidate.sessionId === "string" ? candidate.sessionId.slice(0, 80) : "";
    const knownSaveFields = new Set(story.saveFields || []);
    for (const [key, value] of Object.entries(candidate)) {
      if (knownSaveFields.has(key) || ["__proto__", "prototype", "constructor"].includes(key)) continue;
      normalized[key] = value;
    }
    return normalized;
  };

  const getStoredProgress = () => {
    const current = normalizeState(safeJson(readStorage(STORAGE_KEY)));
    if (current) {
      seedGalleryFromProgress(current);
      return current;
    }
    for (const key of LEGACY_PROGRESS_KEYS) {
      const migrated = normalizeState(safeJson(readStorage(key)));
      if (!migrated) continue;
      writeStorage(STORAGE_KEY, JSON.stringify(migrated));
      seedGalleryFromProgress(migrated);
      return migrated;
    }
    return null;
  };
  const exitDebugJumpSession = () => { debugJumpActive = false; };
  const completionProgress = () => hasStarted && !debugJumpActive ? state : getStoredProgress();
  const getCompletionState = () => {
    const progress = completionProgress();
    return { mainEndingComplete: progress?.clear === true, apeironceneComplete: progress?.trueEndComplete === true };
  };
  const saveProgress = () => {
    if (debugJumpActive) return false;
    state.audio = readAudioState();
    writeStorage(STORAGE_KEY, JSON.stringify(state));
    if (state.clear !== true) {
      // A fresh run or an earlier manual save cannot inherit a previous run's
      // post-credits destination. Keep manual saves, gallery and read history.
      try { window.localStorage.removeItem(TRUE_END_PENDING_KEY); } catch { /* Storage is optional. */ }
    }
    return true;
  };

  const loadConfig = () => {
    const candidate = safeJson(readStorage(CONFIG_KEY));
    const legacy = candidate
      ? null
      : LEGACY_CONFIG_KEYS.map((key) => safeJson(readStorage(key))).find(Boolean);
    const legacySpeed = Number(legacy?.messageSpeedPercent);
    const migratedLegacySpeed = Number.isFinite(legacySpeed)
      ? Math.round((legacySpeed * LEGACY_MESSAGE_SPEED_SCALE) / 10) * 10
      : DEFAULT_MESSAGE_SPEED_PERCENT;
    config = {
      messageSpeedPercent: Math.max(50, Math.min(400, Number(candidate?.messageSpeedPercent) || migratedLegacySpeed)),
      reducedMotion: Boolean(candidate?.reducedMotion ?? legacy?.reducedMotion),
    };
  };
  const saveConfig = () => writeStorage(CONFIG_KEY, JSON.stringify(config));
  const syncConfig = () => {
    if (elements.messageSpeed) elements.messageSpeed.value = String(config.messageSpeedPercent);
    if (elements.messageSpeedValue) {
      const label = `${(config.messageSpeedPercent / 100).toFixed(1)}×`;
      elements.messageSpeedValue.value = label;
      elements.messageSpeedValue.textContent = label;
    }
    if (elements.reducedMotion) elements.reducedMotion.checked = config.reducedMotion;
    layer.classList.toggle("is-motion-reduced", motionReduced());
  };

  const clearReactionTimers = () => {
    reactionTimers.forEach((timer) => window.clearTimeout(timer));
    reactionTimers.clear();
  };

  const clearTimers = () => {
    pendingPortraitAdvance = null;
    revealGeneration += 1;
    window.clearTimeout(revealTimer);
    window.cancelAnimationFrame(revealFrame);
    window.clearTimeout(autoTimer);
    clearReactionTimers();
    window.clearTimeout(sectionSeparatorTimer);
    window.clearTimeout(staffRollFinaleTimer);
    window.clearTimeout(temporalTransitionTimer);
    revealTimer = 0;
    revealFrame = 0;
    autoTimer = 0;
    sectionSeparatorTimer = 0;
    staffRollFinaleTimer = 0;
    temporalTransitionTimer = 0;
    temporalTransitionActive = false;
  };

  const resetDialoguePagination = () => {
    dialoguePaginationGeneration += 1;
    window.clearTimeout(dialogueResizeTimer);
    dialogueResizeTimer = 0;
    dialogueSourceText = "";
    dialoguePages = [];
    dialoguePageLayouts = [];
    dialoguePageIndex = 0;
    dialoguePageReveal = true;
    dialogueReflowPending = false;
    delete elements.text.dataset.characterCount;
    delete elements.text.dataset.explicitLineCount;
    delete elements.text.dataset.measuredLineCount;
    delete elements.text.dataset.maxLineCount;
    delete elements.text.dataset.pageCount;
    delete elements.text.dataset.pageIndex;
    elements.continueMark.textContent = "▼";
  };

  const dialogueTextCapacity = () => {
    const dialogueStyle = getComputedStyle(elements.dialogue);
    const verticalPadding = (Number.parseFloat(dialogueStyle.paddingTop) || 0)
      + (Number.parseFloat(dialogueStyle.paddingBottom) || 0);
    return Math.max(1, elements.dialogue.clientHeight - verticalPadding - TEXT_PAGE_HEIGHT_BUFFER_PX);
  };

  const hideSpecialSurfaces = ({ preserveSlack = false } = {}) => {
    [elements.slackSurface, elements.evidenceSurface, elements.reflectionSurface, elements.resultSurface].forEach((surface) => {
      if (preserveSlack && surface === elements.slackSurface) return;
      surface.hidden = true;
      surface.replaceChildren();
    });
    if (elements.operationsPhoneSurface) elements.operationsPhoneSurface.hidden = true;
    layer.classList.remove("is-slack", "is-evidence", "is-editorial-evidence", "is-reflection", "is-result", "is-demo-results", "is-staff-roll", "is-true-end");
  };

  const showRuntime = () => {
    hasStarted = true;
    layer.classList.remove("is-title");
    elements.titleScreen.hidden = true;
    elements.runtime.hidden = false;
    elements.restart.hidden = true;
    if (elements.fastForward) elements.fastForward.hidden = false;
    setSceneJumpAvailability(true);
    elements.saveButton.hidden = false;
    elements.loadButton.hidden = false;
    elements.logButton.hidden = false;
    elements.configButton.hidden = false;
    elements.auto.hidden = false;
    elements.galleryButton.hidden = false;
    elements.close.hidden = false;
    syncSectionSkipControl();
    renderGalleryControls();
  };

  const currentStep = () => stepMap.get(state.stepId) || null;
  const currentScene = () => sceneMap.get(currentStep()?.sceneId) || null;
  const syncSectionSkipControl = () => {
    const isRuntime = hasStarted && !layer.classList.contains("is-title");
    elements.home.hidden = !isRuntime;
    if (!isRuntime) {
      elements.close.textContent = "戻る";
      elements.close.dataset.controlMode = "return";
      elements.close.setAttribute("aria-label", "ストーリーメニューを閉じる");
      elements.close.title = "ストーリーメニューを閉じる";
      return;
    }
    const scene = currentScene();
    const nextScene = sceneMap.get(scene?.nextSceneId) || null;
    const description = nextScene
      ? `現在のセクションをスキップして「${nextScene.title}」へ進む`
      : "現在のセクションをスキップしてエンディングへ進む";
    elements.close.textContent = "スキップ▶";
    elements.close.dataset.controlMode = "skip";
    elements.close.setAttribute("aria-label", description);
    elements.close.title = description;
  };
  const conditionMatches = (step) => !step.condition || state[step.condition.key] === step.condition.value;
  const chatDeviceForStep = (step) => {
    const cueDevice = backHalfCues.forStep(step)?.device || "";
    if (cueDevice === "mobile-campus-chat") return "mobile";
    if (cueDevice === "wide-campus-chat") return "wide";
    const sequence = Number(step?.id?.match(/_(\d{3})$/u)?.[1]);
    const ranges = CHAT_DEVICE_MOBILE_RANGES[step?.sceneId] || [];
    return Number.isInteger(sequence) && ranges.some(([start, end]) => sequence >= start && sequence <= end)
      ? "mobile"
      : "wide";
  };

  const getFollowingStepId = (step) => {
    const scene = sceneMap.get(step.sceneId);
    const localIndex = scene.steps.findIndex((candidate) => candidate.id === step.id);
    if (localIndex >= 0 && localIndex + 1 < scene.steps.length) return scene.steps[localIndex + 1].id;
    return firstStepForScene(scene.nextSceneId);
  };

  const backgroundAssetForCue = (cue) => (
    window.matchMedia("(max-width: 720px)").matches && cue?.mobileAssetPath
      ? cue.mobileAssetPath
      : cue?.assetPath
  );

  const applyBackgroundCueForStep = (step) => {
    const cue = backgroundCues.forStep(step);
    if (!cue) {
      layer.style.removeProperty("--novel-scene-background");
      delete layer.dataset.backgroundCue;
      delete layer.dataset.backgroundMotion;
      delete layer.dataset.backgroundPresentation;
      return null;
    }
    const assetPath = backgroundAssetForCue(cue);
    layer.style.setProperty("--novel-scene-background", `url("./${assetPath}")`);
    layer.dataset.backgroundCue = cue.id;
    layer.dataset.backgroundMotion = cue.motion;
    const presentation = cue.presentation || (/(?:^|\/)event-cg-/u.test(assetPath) ? "event-cg" : "");
    if (presentation) layer.dataset.backgroundPresentation = presentation;
    else delete layer.dataset.backgroundPresentation;
    return cue;
  };

  const backgroundPresentationForStep = (step) => {
    const previousSceneId = layer.dataset.sceneId;
    const previousStepId = layer.dataset.stepId;
    const previousCue = layer.dataset.backgroundCue;
    const previousMotion = layer.dataset.backgroundMotion;
    const previousPresentation = layer.dataset.backgroundPresentation;
    const previousBackground = layer.style.getPropertyValue("--novel-scene-background");
    const previousBackgroundPriority = layer.style.getPropertyPriority("--novel-scene-background");
    try {
      layer.dataset.sceneId = step.sceneId;
      layer.dataset.stepId = step.id;
      const cue = applyBackgroundCueForStep(step);
      const computed = getComputedStyle(layer);
      return {
        image: computed.backgroundImage,
        position: computed.backgroundPosition,
        size: computed.backgroundSize,
        repeat: computed.backgroundRepeat,
        transition: cue?.transition || "scene",
      };
    } finally {
      if (previousSceneId) layer.dataset.sceneId = previousSceneId;
      else delete layer.dataset.sceneId;
      if (previousStepId) layer.dataset.stepId = previousStepId;
      else delete layer.dataset.stepId;
      if (previousCue) layer.dataset.backgroundCue = previousCue;
      else delete layer.dataset.backgroundCue;
      if (previousMotion) layer.dataset.backgroundMotion = previousMotion;
      else delete layer.dataset.backgroundMotion;
      if (previousPresentation) layer.dataset.backgroundPresentation = previousPresentation;
      else delete layer.dataset.backgroundPresentation;
      if (previousBackground) layer.style.setProperty("--novel-scene-background", previousBackground, previousBackgroundPriority);
      else layer.style.removeProperty("--novel-scene-background");
    }
  };

  const soundtrackForBackground = (backgroundImage) => BACKGROUND_SOUNDTRACK
    .find(([filename]) => String(backgroundImage).includes(filename))?.[1] || "story";

  // A chapter cue stays intact across its backgrounds and embedded demos.
  // Pass the target step explicitly: during a transition state can still be outgoing.
  const soundtrackForStep = (step, presentation) => {
    if (step?.sceneId === "welcome_chat") {
      // Resolve from the target's script order, never from the previously heard
      // cue: reload, save/load and backwards navigation must agree with reading.
      const index = scriptIndexMap.get(step.id);
      for (let i = WELCOME_SOUNDTRACK_CUES.length - 1; i >= 0; i -= 1) {
        const cue = WELCOME_SOUNDTRACK_CUES[i];
        const start = scriptIndexMap.get(cue.from);
        if (start !== undefined && index >= start) return cue.track;
      }
    }
    return SCENE_SOUNDTRACK[step?.sceneId] || soundtrackForBackground(presentation?.image);
  };

  const requestStoryTrack = (track, fadeSeconds = 0.55) => {
    if (!track || requestedStoryTrack === track) return;
    requestedStoryTrack = track;
    void window.GaiaOpeningAudio?.switchTrack?.(track, fadeSeconds);
  };

  const requestTrackForStep = (step, presentation, fadeSeconds = 0.55) => {
    requestStoryTrack(soundtrackForStep(step, presentation), fadeSeconds);
  };

  const backgroundPreloadCache = new Map();
  const settledBackgroundUrls = new Set();

  const preloadBackgroundUrl = (url) => {
    if (backgroundPreloadCache.has(url)) return backgroundPreloadCache.get(url);
    const pending = new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        settledBackgroundUrls.add(url);
        resolve();
      };
      const decode = () => {
        if (typeof image.decode === "function") image.decode().catch(() => {}).finally(finish);
        else finish();
      };
      image.addEventListener("load", decode, { once: true });
      image.addEventListener("error", finish, { once: true });
      image.src = url;
      if (image.complete) {
        if (image.naturalWidth > 0) decode();
        else finish();
      }
    });
    backgroundPreloadCache.set(url, pending);
    return pending;
  };

  const preloadBackground = async (backgroundImage) => {
    const urls = [...String(backgroundImage).matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^'"\)]+))\)/g)]
      .map((match) => match[1] || match[2] || match[3])
      .filter(Boolean);
    await Promise.all(urls.map(preloadBackgroundUrl));
  };

  const preloadCharacterPortrait = (step) => {
    const assetPath = portraitAssetForStep(step);
    return assetPath ? preloadBackgroundUrl(`./${assetPath}`) : Promise.resolve();
  };

  const nextPaint = () => new Promise((resolve) => requestAnimationFrame(resolve));

  const waitForBackgroundPaint = async () => {
    await nextPaint();
    await nextPaint();
  };

  const waitForEntryReveal = () => {
    if (motionReduced()) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        layer.removeEventListener("transitionend", handleTransitionEnd);
        resolve();
      };
      const handleTransitionEnd = (event) => {
        if (event.target !== layer || event.propertyName !== "opacity" || event.pseudoElement) return;
        finish();
      };
      const fallbackTimer = window.setTimeout(finish, ENTRY_REVEAL_FALLBACK_MS);
      layer.addEventListener("transitionend", handleTransitionEnd);
    });
  };

  const waitForBackgroundRelease = () => {
    if (motionReduced()) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        layer.removeEventListener("transitionend", handleTransitionEnd);
        resolve();
      };
      const handleTransitionEnd = (event) => {
        if (event.target !== layer || event.propertyName !== "opacity" || event.pseudoElement !== "::before") return;
        finish();
      };
      const fallbackTimer = window.setTimeout(finish, BACKGROUND_RELEASE_FALLBACK_MS);
      layer.addEventListener("transitionend", handleTransitionEnd);
    });
  };

  const clearBackgroundTransitionVisuals = () => {
    layer.classList.remove("is-background-buffered", "is-background-releasing");
    layer.style.removeProperty("--novel-transition-background");
    layer.style.removeProperty("--novel-transition-background-position");
    layer.style.removeProperty("--novel-transition-background-size");
    layer.style.removeProperty("--novel-transition-background-repeat");
  };

  const runtimePresentationForStep = (step) => {
    const cue = backgroundCues?.forStep?.(step);
    return cue?.assetPath
      ? { image: `url("./${backgroundAssetForCue(cue)}")`, cueId: cue.id }
      : backgroundPresentationForStep(step);
  };

  const preloadRuntimeStep = async (step) => {
    if (!step) return null;
    const presentation = runtimePresentationForStep(step);
    await Promise.all([
      preloadBackground(presentation.image),
      preloadCharacterPortrait(step),
    ]);
    return presentation;
  };

  const revealRuntimeForStep = async (step, reveal, { transition = false } = {}) => {
    const target = resolveVisibleStep(step?.id) || step;
    if (!target || runtimeRevealPending) return false;
    pendingPortraitAdvance = null;
    runtimeRevealPending = true;
    layer.dataset.runtimeReveal = "preparing";
    layer.dataset.runtimeTransition = transition ? "preparing" : "none";
    layer.setAttribute("aria-busy", "true");
    [elements.start, elements.resume].forEach((control) => { control.disabled = true; });
    try {
      const presentation = await preloadRuntimeStep(target);
      let presentationApplied = false;
      const applyPresentationOnce = async () => {
        if (presentationApplied) return;
        presentationApplied = true;
        layer.dataset.sceneId = target.sceneId;
        layer.dataset.stepId = target.id;
        layer.dataset.stepType = target.type;
        applyBackgroundCueForStep(target);
        requestTrackForStep(target, presentation);
        layer.dataset.runtimeReveal = "paint-ready";
        await waitForBackgroundPaint();
      };
      let revealed = false;
      const revealOnce = () => {
        if (revealed) return;
        revealed = true;
        reveal();
      };
      if (transition && !motionReduced()) {
        layer.dataset.runtimeTransition = "covering";
        await runSceneTransition(async () => {
          await applyPresentationOnce();
          revealOnce();
          layer.dataset.runtimeTransition = "revealing";
          await nextPaint();
        }, null, "novel");
        if (!revealed) {
          await applyPresentationOnce();
          revealOnce();
          await nextPaint();
        }
        layer.dataset.runtimeTransition = "complete";
      } else {
        await applyPresentationOnce();
        revealOnce();
        await nextPaint();
        layer.dataset.runtimeTransition = transition ? "reduced" : "none";
      }
      layer.dataset.runtimeReveal = "revealed";
      window.dispatchEvent(new CustomEvent("gaia:novel-runtime-revealed", {
        detail: {
          stepId: target.id,
          backgroundCue: layer.dataset.backgroundCue || "",
          transition: layer.dataset.runtimeTransition,
        },
      }));
      return true;
    } finally {
      runtimeRevealPending = false;
      layer.removeAttribute("aria-busy");
      [elements.start, elements.resume].forEach((control) => { control.disabled = false; });
    }
  };

  const warmUpcomingBackground = (step) => {
    const currentPresentation = backgroundPresentationForStep(step);
    const currentIndex = stepIndexMap.get(step.id) ?? -1;
    const followingStep = resolveVisibleStep(allSteps[currentIndex + 1]?.id);
    if (!followingStep) return;
    if (followingStep.id === "welcome_chat_095") void window.GaiaOpeningAudio?.preloadTrack?.("ending");
    const followingPresentation = backgroundPresentationForStep(followingStep);
    const currentTrack = soundtrackForStep(step, currentPresentation);
    const followingTrack = soundtrackForStep(followingStep, followingPresentation);
    if (followingTrack !== currentTrack) void window.GaiaOpeningAudio?.preloadTrack?.(followingTrack);
    const backgroundChanged = currentPresentation.image !== followingPresentation.image;
    const portraitAsset = portraitAssetForStep(followingStep);
    if (!backgroundChanged && !portraitAsset) return;
    const warm = () => {
      if (backgroundChanged) void preloadBackground(followingPresentation.image);
      if (portraitAsset) void preloadBackgroundUrl(`./${portraitAsset}`);
    };
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(warm, { timeout: 1200 });
    else window.setTimeout(warm, 0);
  };

  const runBackgroundTransition = async (
    currentBackground,
    nextBackground,
    applyIncomingBackground,
    revealIncomingContent,
    { crossfadeOnly = false, fromStepId = "", toStepId = "" } = {},
  ) => {
    if (backgroundTransitionPending) return false;
    backgroundCastEntrance?.cancel();
    backgroundCastEntrance = null;
    backgroundTransitionPending = true;
    layer.classList.add("is-background-transitioning");
    layer.dataset.backgroundTransitionPhase = "preloading";
    layer.setAttribute("aria-busy", "true");
    let incomingApplied = false;
    const applyIncomingOnce = async () => {
      if (incomingApplied) return;
      applyIncomingBackground();
      incomingApplied = true;
      layer.dataset.backgroundTransitionPhase = "paint-pending";
      await waitForBackgroundPaint();
      layer.dataset.backgroundTransitionPhase = "painted";
    };
    const beginRelease = () => {
      const released = waitForBackgroundRelease();
      layer.classList.add("is-background-releasing");
      layer.dataset.backgroundTransitionPhase = "releasing";
      return released;
    };
    try {
      await preloadBackground(nextBackground.image);
      layer.style.setProperty("--novel-transition-background", currentBackground.image);
      layer.style.setProperty("--novel-transition-background-position", currentBackground.position);
      layer.style.setProperty("--novel-transition-background-size", currentBackground.size);
      layer.style.setProperty("--novel-transition-background-repeat", currentBackground.repeat);
      layer.classList.remove("is-background-releasing");
      layer.classList.add("is-background-buffered");
      await nextPaint();
      layer.dataset.backgroundTransitionPhase = "buffered";
      if (motionReduced()) {
        await applyIncomingOnce();
      } else if (crossfadeOnly) {
        await applyIncomingOnce();
        await beginRelease();
      } else {
        let releaseComplete = Promise.resolve();
        await runSceneTransition(async () => {
          await applyIncomingOnce();
          releaseComplete = beginRelease();
        }, null, "novel");
        if (!incomingApplied) {
          await applyIncomingOnce();
          releaseComplete = beginRelease();
        }
        await releaseComplete;
      }
      clearBackgroundTransitionVisuals();
      layer.dataset.backgroundTransitionPhase = "release-complete";
      revealIncomingContent();
      await nextPaint();
      layer.classList.remove("is-background-transitioning");
      // Pose changes are committed behind the transition curtain. Fade the
      // cast wrapper only after that curtain releases, independently of poses.
      if (!motionReduced() && getComputedStyle(elements.cast).visibility === "visible") {
        backgroundCastEntrance = elements.cast.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 620, easing: "ease-in-out" },
        );
      }
      layer.dataset.backgroundTransitionPhase = "complete";
      await nextPaint();
      window.dispatchEvent(new CustomEvent("gaia:novel-background-transition-complete", {
        detail: { fromStepId, toStepId, crossfadeOnly, reducedMotion: motionReduced() },
      }));
      return true;
    } finally {
      backgroundTransitionPending = false;
      clearBackgroundTransitionVisuals();
      layer.classList.remove("is-background-transitioning");
      layer.removeAttribute("aria-busy");
    }
  };

  const applyOperationsPhonePresentation = (cue) => {
    const phone = cue?.phone;
    const visible = cue?.device === "portrait-operations-phone" && Boolean(phone);
    if (!elements.operationsPhoneSurface) return;
    elements.operationsPhoneSurface.hidden = !visible;
    if (!visible) return;
    elements.operationsPhoneClock.textContent = phone.clock;
    elements.operationsPhoneNoticeTime.textContent = phone.noticeTime;
    elements.operationsPhoneNoticeSender.textContent = phone.noticeSender;
    elements.operationsPhoneNoticeBody.textContent = phone.noticeBody;
    elements.operationsPhoneAudioSpeaker.textContent = phone.audioSpeaker;
    elements.operationsPhoneAudioStatus.textContent = phone.audioStatus;
  };

  const applyBackHalfCueForStep = (step) => {
    const cue = backHalfCues.forStep(step);
    const cueKeys = [
      "storyContext", "storyDate", "storyTime", "storyDayPeriod", "storyLocation",
      "storyDevice", "storyDevicePhase", "storyViewpoint", "storyCastMode", "storyAudioCue",
    ];
    if (!cue) {
      cueKeys.forEach((key) => { delete layer.dataset[key]; });
      layer.classList.remove("is-cast-suppressed", "is-central-entrance-distance");
      applyOperationsPhonePresentation(null);
      return null;
    }
    layer.dataset.storyContext = cue.temporal.context;
    layer.dataset.storyDate = cue.temporal.date;
    layer.dataset.storyTime = step.displayTime || cue.temporal.time;
    layer.dataset.storyDayPeriod = cue.temporal.dayPeriod;
    layer.dataset.storyLocation = cue.temporal.location;
    layer.dataset.storyDevice = cue.device;
    layer.dataset.storyDevicePhase = cue.devicePhase;
    layer.dataset.storyViewpoint = cue.viewpoint;
    layer.dataset.storyCastMode = cue.castMode;
    layer.dataset.storyAudioCue = cue.audio;
    const isEventCg = layer.dataset.backgroundPresentation === "event-cg";
    layer.classList.toggle("is-cast-suppressed", isEventCg || ["archived-voice-no-cast", "remote-sakuya-no-cast", "sakuya-unseen"].includes(cue.castMode));
    layer.classList.toggle("is-central-entrance-distance", cue.castMode === "central-entrance-distance");
    applyOperationsPhonePresentation(cue);
    return cue;
  };

  const resolveVisibleStep = (stepId) => {
    let candidate = stepMap.get(stepId);
    let guard = 0;
    while (candidate?.type === "phase" && guard < allSteps.length) {
      candidate = stepMap.get(getFollowingStepId(candidate));
      guard += 1;
    }
    return candidate || null;
  };

  const moveToFollowingStep = (step = currentStep(), { portraitPrepared = false } = {}) => {
    if (pendingPortraitAdvance) return;
    const rawNextStep = step ? stepMap.get(getFollowingStepId(step)) : null;
    const nextStep = resolveVisibleStep(rawNextStep?.id);
    const next = nextStep?.id || null;
    if (!next) {
      renderEnd(step);
      return;
    }
    const portraitAsset = portraitAssetForStep(nextStep);
    if (!portraitPrepared && portraitAsset && !settledBackgroundUrls.has(`./${portraitAsset}`)) {
      // Keep the current line intact until the next face can actually be drawn.
      // Repeated advances share this wait; load/jump/close invalidate it through
      // clearTimers, so a late image cannot advance a different reading session.
      const pending = {};
      pendingPortraitAdvance = pending;
      let timeout;
      return Promise.race([
        preloadCharacterPortrait(nextStep),
        new Promise(resolve => { timeout = window.setTimeout(resolve, 5000); }),
      ]).then(() => {
        window.clearTimeout(timeout);
        if (pendingPortraitAdvance !== pending) return;
        pendingPortraitAdvance = null;
        if (isOpen && hasStarted && currentStep()?.id === step.id && progressionPanelsClosed()) {
          moveToFollowingStep(step, { portraitPrepared: true });
        }
      });
    }
    const commitStep = () => {
      Object.entries(CHAT_CAST_MEETING_GATES).forEach(([speaker, gate]) => {
        if (step.id === gate.completedAt) state.metCharacters[speaker] = true;
      });
      state.stepId = next;
      saveProgress();
    };
    const renderStep = () => {
      if (step.sceneId !== nextStep?.sceneId) renderSectionSeparator(nextStep);
      else if (temporalRuntime.contextTransitionForStep(nextStep)) renderTemporalTransitionCard(nextStep);
      else renderCurrentStep();
    };
    const applyIncomingBackground = () => {
      layer.dataset.sceneId = nextStep.sceneId;
      layer.dataset.stepId = nextStep.id;
      applyBackgroundCueForStep(nextStep);
      requestTrackForStep(nextStep, { image: getComputedStyle(layer).backgroundImage });
    };
    const swapStep = () => {
      commitStep();
      renderStep();
    };
    const currentBackground = backgroundPresentationForStep(step);
    const nextBackground = backgroundPresentationForStep(nextStep);
    const backgroundChanges = currentBackground.image !== nextBackground.image;
    const crossfadeOnly = nextBackground.transition === "crossfade";
    if (backgroundChanges && nextStep?.id === "opening_empty_seat_001") {
      deferredOpeningBackground = {
        stepId: nextStep.id,
        fromStepId: step.id,
        current: currentBackground,
        next: nextBackground,
      };
      layer.dataset.openingTransitionStage = "awaiting-record";
      layer.dataset.openingCue = "record-transition";
      swapStep();
      return;
    }
    const shouldTransitionBackground = backgroundChanges;
    if (shouldTransitionBackground) {
      if (backgroundTransitionPending) return;
      if (crossfadeOnly && step.sceneId !== nextStep?.sceneId) {
        deferredSectionBackgroundTransition = { stepId: next, fromStepId: step.id, currentBackground, nextBackground };
        swapStep();
        return;
      }
      return runBackgroundTransition(
        currentBackground,
        nextBackground,
        () => {
          commitStep();
          applyIncomingBackground();
        },
        renderStep,
        { crossfadeOnly, fromStepId: step.id, toStepId: nextStep.id },
      );
    }
    swapStep();
  };

  const updateProgress = () => {
    const index = stepIndexMap.get(state.stepId) || 0;
    elements.progress.style.width = `${Math.max(2, ((index + 1) / allSteps.length) * 100)}%`;
  };

  function renderTemporalHeading(value) {
    const title = String(value || "");
    const [temporal = "", ...locationParts] = title.split("｜");
    const unit = (text, kind) => {
      const node = document.createElement("span");
      node.className = "novel-temporal-heading-unit";
      node.dataset.temporalHeadingUnit = kind;
      node.textContent = translate(text.trim());
      return node;
    };
    const clockMatch = temporal.match(/(?:^|\s)([0-2]?\d:\d{2})(?=\s*(?:〜|～|–|—|-)|\s*$)/u);
    const units = [unit(clockMatch?.[1] || temporal, "time")];
    if (locationParts.length) {
      const tail = document.createElement("span");
      tail.className = "novel-temporal-heading-tail";
      tail.append(unit("｜", "separator"), unit(locationParts.join("｜"), "location"));
      units.push(tail);
    }
    elements.location.setAttribute("aria-label", units.map(node => node.textContent).join(" "));
    elements.location.replaceChildren(...units);
    elements.location.classList.remove("is-signal-reveal");
    void elements.location.offsetWidth;
    elements.location.classList.add("is-signal-reveal");
  }

  const applyTemporalPresentation = (step) => {
    const scene = sceneMap.get(step.sceneId);
    const presentation = temporalRuntime.presentationForStep(step);
    const cueTemporal = backHalfCues.forStep(step)?.temporal;
    const displayTitle = step.displayTime
      ? `${cueTemporal?.date || scene.date} ${step.displayTime}｜${cueTemporal?.location || scene.location}`
      : cueTemporal?.time && cueTemporal.time !== scene.time
      ? `${cueTemporal.date} ${cueTemporal.time}｜${cueTemporal.location}`
      : presentation.displayTitle;
    layer.dataset.temporalContext = presentation.temporalContext;
    layer.dataset.timePrecision = presentation.timePrecision;
    layer.dataset.temporalPeriod = String(presentation.isPeriod);
    layer.dataset.temporalSource = presentation.source;
    elements.modeReadout.textContent = `${scene.chapter} — ${displayTitle}`;
    renderTemporalHeading(displayTitle);
    return { ...presentation, displayTitle };
  };

  function finishTemporalTransitionCard() {
    if (!temporalTransitionActive) return false;
    window.clearTimeout(temporalTransitionTimer);
    temporalTransitionTimer = 0;
    temporalTransitionActive = false;
    elements.chapterCard.hidden = true;
    const deferred = deferredOpeningBackground;
    if (deferred?.stepId === currentStep()?.id) {
      deferredOpeningBackground = null;
      const step = currentStep();
      requestTrackForStep(step, deferred.next);
      void runBackgroundTransition(
        deferred.current,
        deferred.next,
        () => {
          delete layer.dataset.openingTransitionStage;
          layer.dataset.sceneId = step.sceneId;
          layer.dataset.stepId = step.id;
          applyBackgroundCueForStep(step);
          requestTrackForStep(step, { image: getComputedStyle(layer).backgroundImage });
        },
        renderStepAfterSection,
        { fromStepId: deferred.fromStepId || "", toStepId: step.id },
      );
    } else {
      renderStepAfterSection();
    }
    return true;
  }

  function renderTemporalTransitionCard(step = currentStep()) {
    const transition = temporalRuntime.contextTransitionForStep(step);
    if (!step || !transition) return renderCurrentStep();
    clearSectionEntry();
    clearTimers();
    closeLog();
    showRuntime();
    syncScriptDebug(step);
    hideSpecialSurfaces();
    isRevealing = false;
    layer.dataset.sceneId = step.sceneId;
    layer.dataset.stepId = step.id;
    layer.dataset.stepType = "temporal-transition";
    applyTemporalPresentation(step);
    elements.dialogue.hidden = true;
    elements.choices.replaceChildren();
    elements.choices.classList.remove("is-visible");
    elements.sourceLabel.hidden = true;
    elements.chapterIndex.textContent = `${transition.fromTemporalContext} → ${transition.toTemporalContext}`;
    renderChapterTitleUnits(transition.displayTitle);
    elements.chapterCard.dataset.transitionFrom = transition.fromTemporalContext;
    elements.chapterCard.dataset.transitionTo = transition.toTemporalContext;
    elements.chapterCard.setAttribute("role", "status");
    elements.chapterCard.setAttribute("aria-live", "polite");
    elements.chapterCard.setAttribute("aria-label", `${transition.fromTemporalContext}から${transition.toTemporalContext}へ。${transition.displayTitle}`);
    elements.chapterCard.hidden = false;
    setCharacterPresentation("chapter");
    if (isPreMeetingRecordPresentation(step)) elements.avatar.hidden = true;
    selectMode(sceneMap.get(step.sceneId)?.modeIndex);
    updateProgress();
    temporalTransitionActive = true;
    temporalTransitionTimer = window.setTimeout(
      finishTemporalTransitionCard,
      motionReduced() ? 600 : TEMPORAL_TRANSITION_MS,
    );
  }

  const selectMode = (index) => {
    if (!Number.isInteger(index)) return;
    window.dispatchEvent(new CustomEvent("gaia:select-mode", { detail: { index, source: "novel-v6" } }));
  };

  const isObjectiveOpeningRecord = (step) => step?.sceneId === "opening_empty_seat";
  const isPreMeetingRecordPresentation = (step) => (
    isObjectiveOpeningRecord(step) || step?.sceneId === "prologue_online_circle"
  );
  const openingCueForStep = (step) => {
    if (step?.id === "current_exhibition_015") return "start-ready";
    if (step?.id === "current_exhibition_016") return "terminal-focus";
    if (step?.id === "current_exhibition_017") return "material-index";
    if (isObjectiveOpeningRecord(step)) return "objective-record";
    if (step?.sceneId === "prologue_online_circle") return step.type === "chat" ? "circle-chat" : "circle-context";
    return "";
  };

  const setCharacterPresentation = (speaker, expression = "calm") => {
    const legacySpeaker = CHARACTER_VIEW[speaker] || speaker || "narrator";
    const figure = {
      sora: elements.characterSora,
      minamo: elements.characterMinamo,
      sakuya: elements.characterSakuya,
    }[legacySpeaker];
    // Apply the requested pose before making the speaker visible. Replaying a
    // hidden figure's old expression made every entrance start with the wrong
    // face; expressions now switch directly, independent of the cast entrance.
    if (figure) figure.dataset.expression = expression;
    elements.cast.dataset.speaker = legacySpeaker;
    elements.avatar.dataset.speaker = legacySpeaker;
    elements.avatarGlyph.textContent = SPEAKERS[speaker]?.glyph || "◌";
    elements.avatar.hidden = true;
  };

  const suppressCharacterPresentation = () => {
    setCharacterPresentation("chapter");
    elements.avatar.hidden = true;
  };

  const setSlackCastVisibility = (step) => {
    const gate = CHAT_CAST_MEETING_GATES[step?.speaker];
    const currentIndex = stepIndexMap.get(step?.id) ?? -1;
    const visibleFromIndex = gate ? (stepIndexMap.get(gate.visibleFrom) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    const visible = Boolean(gate && state.metCharacters[step.speaker] && currentIndex >= visibleFromIndex);
    elements.cast.dataset.slackCast = visible ? "visible" : "hidden";
  };

  const updateSignalLabel = (step) => {
    const kind = step.recordType || (step.type === "choice" ? "VISITOR_TRACE" : "SOURCE");
    const label = RECORD_LABELS[kind] || RECORD_LABELS.SOURCE;
    elements.dataKind.textContent = label;
    elements.dataKind.dataset.kind = kind;
    elements.signalTitle.textContent = step.type === "record" ? "記録の分類と作者を分けて表示しています。" : "物語台本に記録された場面です。";
  };

  const finishReveal = () => {
    revealGeneration += 1;
    window.clearTimeout(revealTimer);
    window.cancelAnimationFrame(revealFrame);
    revealTimer = 0;
    revealFrame = 0;
    isRevealing = false;
    elements.text.classList.remove("is-preparing", "is-revealing");
    const tokens = elements.text.querySelectorAll(".novel-phrase-token, .novel-space-token");
    if (tokens.length > 0) {
      elements.text.classList.add("is-revealed");
    } else {
      elements.text.textContent = fullText;
    }
    elements.text.dataset.revealState = "complete";
    elements.text.dataset.revealCount = String(Array.from(fullText).length);
    elements.cursor.hidden = true;
    elements.continueMark.classList.add("is-visible");
    scheduleAutoAdvance();
    if (dialogueReflowPending) {
      dialogueReflowPending = false;
      window.requestAnimationFrame(repaginateVisibleDialogue);
    }
  };

  const segmentDialoguePhrases = (source, options = {}) => globalThis.GaiaDialogueTypography.segment(source, {
    forceFallback: dialogueForceFallbackForInspection, ...options,
  });
  const buildDialogueTokenLayout = (text, options = {}) => globalThis.GaiaDialogueTypography.createLayout(text, {
    forceFallback: dialogueForceFallbackForInspection, ...options,
  });

  const measureNativeLines = (text, preparedLayout = null) => {
    const layout = preparedLayout || buildDialogueTokenLayout(text);
    layout.querySelectorAll("[data-dialogue-wrap]").forEach((node) => node.remove());
    elements.text.replaceChildren(layout);
    globalThis.GaiaDialogueTypography.wrapLayout(elements.text, layout);
    const lines = [];
    let current = [];
    let lineTop = null;

    const commitLine = () => {
      if (current.length) lines.push(current);
      current = [];
      lineTop = null;
    };

    const appendGlyph = (glyph, rect) => {
      if (rect.width > 0 || rect.height > 0) {
        if (lineTop === null) lineTop = rect.top;
        else if (Math.abs(rect.top - lineTop) > 2) commitLine();
        if (lineTop === null) lineTop = rect.top;
      }
      current.push(glyph);
    };

    layout.childNodes.forEach((node) => {
      if (node instanceof HTMLBRElement) {
        commitLine();
        return;
      }
      if (!(node instanceof HTMLElement)) return;

      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        let offset = 0;
        Array.from(textNode.nodeValue || "").forEach((glyph) => {
          const nextOffset = offset + glyph.length;
          const range = document.createRange();
          range.setStart(textNode, offset);
          range.setEnd(textNode, nextOffset);
          appendGlyph(glyph, range.getBoundingClientRect());
          range.detach();
          offset = nextOffset;
        });
      }
    });
    commitLine();
    return lines.length ? lines : [Array.from(text)];
  };

  const dialoguePageMetrics = (text, preparedLayout = null) => {
    const normalized = String(text || "").replace(/\n+$/u, "");
    const measuredLines = measureNativeLines(normalized, preparedLayout);
    const textStyle = getComputedStyle(elements.text);
    const fontSize = Number.parseFloat(textStyle.fontSize) || 16;
    const lineHeight = Number.parseFloat(textStyle.lineHeight) || fontSize * 1.6;
    const maxLines = Math.min(TEXT_PAGE_MAX_LINES, Math.max(1, Math.floor(dialogueTextCapacity() / lineHeight)));
    const estimatedCharactersPerLine = Math.max(8, Math.floor(elements.text.clientWidth / Math.max(1, fontSize * 0.92)));
    const characterBudget = Math.max(16, estimatedCharactersPerLine * maxLines);
    const characterCount = Array.from(normalized.replace(/\s/gu, "")).length;
    const renderedHeight = Math.max(elements.text.scrollHeight, measuredLines.length * lineHeight);
    const textRect = elements.text.getBoundingClientRect();
    const indicatorRect = elements.continueMark.getBoundingClientRect();
    const indicatorSafety = indicatorRect.top - textRect.bottom;
    // The desktop marker sits to the RIGHT of the text column. Requiring a
    // vertical gap there needlessly rejected a third line that never touches it.
    const indicatorClearance = Math.max(indicatorSafety, indicatorRect.left - textRect.right);
    const layoutRect = elements.text.firstElementChild?.getBoundingClientRect() || textRect;
    const horizontalOverflow = Math.max(0, layoutRect.right - textRect.right);
    return {
      measuredLines,
      maxLines,
      characterCount,
      characterBudget,
      indicatorSafety,
      indicatorClearance,
      horizontalOverflow,
      fits: characterCount <= characterBudget
        && measuredLines.length <= maxLines
        && renderedHeight <= dialogueTextCapacity()
        && horizontalOverflow <= 1
        && indicatorClearance >= TEXT_PAGE_INDICATOR_SAFETY_PX,
    };
  };

  const sentenceBoundaryOffset = (glyphs) => {
    const sentenceMarks = new Set(["。", "！", "？"]);
    const closingMarks = new Set(["」", "』", "】", "》", "〉", "］", "〕", "）", "”", "’", "\"", "'"]);
    let boundary = 0;
    glyphs.forEach((glyph, index) => {
      if (!sentenceMarks.has(glyph)) return;
      let next = index + 1;
      while (next < glyphs.length && closingMarks.has(glyphs[next])) next += 1;
      boundary = next;
    });
    return boundary;
  };

  const preferredPageBreak = (prefix, glyphs, maximum) => {
    const prefixGlyphs = Array.from(prefix);
    const maximumGlyphs = [...prefixGlyphs, ...glyphs.slice(0, maximum)];
    const sentenceBoundary = sentenceBoundaryOffset(maximumGlyphs);
    if (sentenceBoundary >= prefixGlyphs.length && sentenceBoundary > 0) {
      const sentenceCandidate = maximumGlyphs.slice(0, sentenceBoundary).join("").trimEnd();
      if (dialoguePageMetrics(sentenceCandidate).fits) return sentenceBoundary - prefixGlyphs.length;
    }

    const maximumText = maximumGlyphs.join("").trimEnd();
    const occupiedLineCount = dialoguePageMetrics(maximumText).measuredLines.length;
    const minimum = Math.floor(maximum * 0.58);
    for (let index = maximum - 1; index >= minimum; index -= 1) {
      if (!/[、，,；;：:\s]/u.test(glyphs[index])) continue;
      const candidate = `${prefix}${glyphs.slice(0, index + 1).join("")}`.trimEnd();
      if (dialoguePageMetrics(candidate).measuredLines.length === occupiedLineCount) return index + 1;
    }
    return maximum;
  };

  const largestFittingPrefix = (text, prefix = "") => {
    const glyphs = Array.from(text);
    let low = 1;
    let high = glyphs.length;
    let best = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = `${prefix}${glyphs.slice(0, middle).join("")}`.trimEnd();
      if (candidate && dialoguePageMetrics(candidate).fits) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (!best) return 0;
    return preferredPageBreak(prefix, glyphs, best);
  };

  const paginateDialogueText = (text) => {
    const normalized = String(text || "").trim();
    if (!normalized) return [""];
    const units = normalized.match(/[^\n。！？]+(?:[。！？][」』】）》〉］〕）”’"']*)?|\n+/gu) || [normalized];
    const pages = [];
    let page = "";

    const commitPage = () => {
      const committed = page.trim();
      if (committed) pages.push(committed);
      page = "";
    };

    for (const unit of units) {
      if (/^\n+$/u.test(unit)) {
        const candidate = `${page}${unit}`;
        if (page && dialoguePageMetrics(candidate).fits) page = candidate;
        else commitPage();
        continue;
      }

      let remainder = unit;
      while (remainder) {
        const candidate = `${page}${remainder}`;
        if (dialoguePageMetrics(candidate).fits) {
          page = candidate;
          remainder = "";
          continue;
        }
        if (page) {
          const breakAt = largestFittingPrefix(remainder, page);
          if (breakAt > 0) {
            page += Array.from(remainder).slice(0, breakAt).join("");
            commitPage();
            remainder = Array.from(remainder).slice(breakAt).join("").trimStart();
            continue;
          }
          commitPage();
          continue;
        }
        const breakAt = largestFittingPrefix(remainder);
        page = Array.from(remainder).slice(0, Math.max(1, breakAt)).join("");
        commitPage();
        remainder = Array.from(remainder).slice(Math.max(1, breakAt)).join("").trimStart();
      }
    }
    commitPage();
    return pages.length ? pages : [normalized];
  };

  const isStructuredDialogueLine = (line) => /^\s*(?:[-*+>\u30fb\u2022\u25cf\u25a0\u25c6\u25c7\u25cb\u3010]|\d+[.\)\u3001\uff09]|[A-Z][.\uff1a:])/u.test(line)
    || /^\s*[^\u3002\uff01\uff1f!?\n]{1,16}[|\uff5c\uff1a:]/u.test(line)
    || /^\s*(?:\u300c[^\n]*\u300d|\u300e[^\n]*\u300f)\s*$/u.test(line);

  const semanticDialogueUnits = (text) => {
    const glyphs = Array.from(String(text || ""));
    const sentenceMarks = new Set(["\u3002", "\uff01", "\uff1f", "!", "?"]);
    const closingMarks = new Set(["\u300d", "\u300f", "\u3011", "\u3015", "\uff3d", "\uff09", ")", "\u3009", "\u300b", "\u201d", "\u2019", "\"", "'"]);
    const units = [];
    let lineStart = 0;

    const appendLine = (lineGlyphs, newlineGlyphs) => {
      const newline = newlineGlyphs.join("");
      if (!lineGlyphs.length) {
        if (newline) units.push(newline);
        return;
      }
      const line = lineGlyphs.join("");
      if (isStructuredDialogueLine(line)) {
        units.push(`${line}${newline}`);
        return;
      }
      let start = 0;
      for (let index = 0; index < lineGlyphs.length; index += 1) {
        if (!sentenceMarks.has(lineGlyphs[index])) continue;
        let end = index + 1;
        while (end < lineGlyphs.length && closingMarks.has(lineGlyphs[end])) end += 1;
        while (end < lineGlyphs.length && /[ \t\u3000]/u.test(lineGlyphs[end])) end += 1;
        units.push(lineGlyphs.slice(start, end).join(""));
        start = end;
        index = end - 1;
      }
      if (start < lineGlyphs.length) units.push(lineGlyphs.slice(start).join(""));
      if (newline) units[units.length - 1] += newline;
    };

    for (let index = 0; index <= glyphs.length; index += 1) {
      if (index < glyphs.length && glyphs[index] !== "\n") continue;
      let newlineEnd = index;
      while (newlineEnd < glyphs.length && glyphs[newlineEnd] === "\n") newlineEnd += 1;
      appendLine(glyphs.slice(lineStart, index), glyphs.slice(index, newlineEnd));
      if (newlineEnd >= glyphs.length) break;
      lineStart = newlineEnd;
      index = newlineEnd - 1;
    }
    return units.filter((unit) => unit.length > 0);
  };

  const dialogueBoundaryCandidates = (text) => {
    const glyphs = Array.from(text);
    const tokenBoundaries = new Set();
    let tokenOffset = 0;
    segmentDialoguePhrases(text).forEach((token) => {
      tokenOffset += Array.from(token).length;
      tokenBoundaries.add(tokenOffset);
    });
    const structuredRanges = [];
    let rangeStart = 0;
    for (let index = 0; index <= glyphs.length; index += 1) {
      if (index < glyphs.length && glyphs[index] !== "\n") continue;
      if (isStructuredDialogueLine(glyphs.slice(rangeStart, index).join(""))) structuredRanges.push({ start: rangeStart, end: index });
      rangeStart = index + 1;
    }
    const splitsStructuredLine = (offset) => structuredRanges.some((range) => offset > range.start && offset < range.end);
    const semanticOffsets = new Set();
    let semanticOffset = 0;
    semanticDialogueUnits(text).forEach((unit) => {
      semanticOffset += Array.from(unit).length;
      if (semanticOffset > 0 && semanticOffset < glyphs.length && tokenBoundaries.has(semanticOffset)) semanticOffsets.add(semanticOffset);
    });
    const safeOffsets = new Set();
    glyphs.forEach((glyph, index) => {
      if (/[\u3001\uff0c,\u30fb\uff1a:；;\s]/u.test(glyph) && tokenBoundaries.has(index + 1) && !splitsStructuredLine(index + 1)) safeOffsets.add(index + 1);
    });
    const lineOffsets = new Set();
    let lineOffset = 0;
    measureNativeLines(text).forEach((line) => {
      lineOffset += line.length;
      if (lineOffset > 0 && lineOffset < glyphs.length && tokenBoundaries.has(lineOffset) && !splitsStructuredLine(lineOffset)) lineOffsets.add(lineOffset);
    });
    return { glyphs, semanticOffsets, safeOffsets, lineOffsets };
  };

  const balanceDialoguePagePair = (left, right, { requireRightTwoLines = false } = {}) => {
    const combined = `${left}${right}`;
    if (dialoguePageMetrics(combined).fits) return [combined];
    const sentenceBoundary = /[。！？!?][」』）】］〉》〕]*$/u;
    const safeBoundary = /[、。，．？！…!?,：:；;][」』）】］〉》〕]*$/u;
    const combinedTokens = segmentDialoguePhrases(combined);
    const originalBoundary = Array.from(left).length;
    const candidates = [];
    for (let splitIndex = 1; splitIndex < combinedTokens.length; splitIndex += 1) {
      const before = combinedTokens.slice(0, splitIndex).join("");
      const after = combinedTokens.slice(splitIndex).join("");
      if (`${before}${after}` !== combined) continue;
      const beforeMetrics = dialoguePageMetrics(before);
      const afterMetrics = dialoguePageMetrics(after);
      if (!beforeMetrics.fits || !afterMetrics.fits) continue;
      if (beforeMetrics.measuredLines.length > TEXT_PAGE_MAX_LINES || afterMetrics.measuredLines.length > TEXT_PAGE_MAX_LINES) continue;
      // A complete closing sentence can naturally occupy one line. Do not
      // turn a 3+1 sentence split into a sparse 1+3 split just to pad the end.
      const independentClosingSentence = sentenceBoundary.test(before.trimEnd()) && afterMetrics.characterCount >= 8;
      if (requireRightTwoLines && afterMetrics.measuredLines.length < 2 && !independentClosingSentence) continue;
      const beforeLines = beforeMetrics.measuredLines.length;
      const afterLines = afterMetrics.measuredLines.length;
      const boundaryOffset = Array.from(before).length;
      candidates.push({
        before,
        after,
        sentencePenalty: sentenceBoundary.test(before.trimEnd()) ? 0 : 1,
        unsafeBoundaryCount: safeBoundary.test(before.trimEnd()) ? 0 : 1,
        oneLinePageCount: Number(beforeLines < 2) + Number(afterLines < 2),
        lineBalance: Math.abs(beforeLines - afterLines),
        boundaryDistance: Math.abs(boundaryOffset - originalBoundary),
      });
    }
    candidates.sort((a, b) => a.sentencePenalty - b.sentencePenalty
      || a.unsafeBoundaryCount - b.unsafeBoundaryCount
      || a.oneLinePageCount - b.oneLinePageCount
      || a.lineBalance - b.lineBalance
      || a.boundaryDistance - b.boundaryDistance);
    return candidates.length ? [candidates[0].before, candidates[0].after] : [left, right];
  };

  const balanceDialoguePages = (inputPages) => {
    const pages = [...inputPages];
    for (let index = 1; index < pages.length;) {
      const combined = `${pages[index - 1]}${pages[index]}`;
      if (dialoguePageMetrics(combined).fits) {
        pages.splice(index - 1, 2, combined);
        index = Math.max(1, index - 1);
      } else {
        index += 1;
      }
    }
    for (let index = pages.length - 1; index > 0; index -= 1) {
      const previousMetrics = dialoguePageMetrics(pages[index - 1]);
      const currentMetrics = dialoguePageMetrics(pages[index]);
      const sparseAdjacentPage = previousMetrics.measuredLines.length < 2 || currentMetrics.measuredLines.length < 2;
      const unsafeBoundary = !/[。！？!?、，,・：:；;\s][」』）】］〉》〕]*$/u.test(pages[index - 1].trimEnd());
      const explicitLineNeedsBalance = pages[index - 1].endsWith("\n")
        && previousMetrics.measuredLines.length < 3
        && currentMetrics.measuredLines.length > 2;
      if (!sparseAdjacentPage && !unsafeBoundary && !explicitLineNeedsBalance) continue;
      const balanced = balanceDialoguePagePair(
        pages[index - 1],
        pages[index],
        { requireRightTwoLines: index === pages.length - 1 },
      );
      pages.splice(index - 1, 2, ...balanced);
    }
    return pages;
  };

  const paginateDialogueTextBalanced = (text) => {
    const normalized = String(text || "");
    if (!normalized) return [""];
    if (dialoguePageMetrics(normalized).fits) return [normalized];
    const pages = [];
    const units = semanticDialogueUnits(normalized);
    let page = "";

    const commitPage = () => {
      if (page) pages.push(page);
      page = "";
    };

    const largestSafePrefix = (value) => {
      const glyphs = Array.from(value);
      const tokenOffsets = [];
      let tokenOffset = 0;
      segmentDialoguePhrases(value).forEach((token) => {
        tokenOffset += Array.from(token).length;
        tokenOffsets.push(tokenOffset);
      });
      let low = 1;
      let high = tokenOffsets.length;
      let maximum = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidateOffset = tokenOffsets[middle - 1];
        if (dialoguePageMetrics(glyphs.slice(0, candidateOffset).join("")).fits) {
          maximum = candidateOffset;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      const usedGlyphFallback = !maximum;
      if (usedGlyphFallback) {
        low = 1;
        high = glyphs.length;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          if (dialoguePageMetrics(glyphs.slice(0, middle).join("")).fits) {
            maximum = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }
      }
      if (!maximum) throw new Error(`VN glyph exceeds one page: ${value.slice(0, 80)}`);
      const sentenceOffsets = new Set();
      const safeOffsets = new Set();
      const sentenceMarks = new Set(["\u3002", "\uff01", "\uff1f", "!", "?"]);
      const closingMarks = new Set(["\u300d", "\u300f", "\u3011", "\u3015", "\uff3d", "\uff09", ")", "\u3009", "\u300b", "\u201d", "\u2019", "\"", "'"]);
      glyphs.slice(0, maximum).forEach((glyph, index) => {
        if (sentenceMarks.has(glyph)) {
          let offset = index + 1;
          while (offset < maximum && closingMarks.has(glyphs[offset])) offset += 1;
          sentenceOffsets.add(offset);
        }
        if (/[\u3001\uff0c,\u30fb\uff1a:；;\s]/u.test(glyph)) safeOffsets.add(index + 1);
      });
      const maximumMetrics = dialoguePageMetrics(glyphs.slice(0, maximum).join(""));
      const preferredMinimumLines = maximumMetrics.measuredLines.length >= 2 ? 2 : 1;
      const fittingOffset = (offsets, minimumLines = 1) => [...offsets]
        .filter((offset) => {
          if (offset <= 0 || offset > maximum) return false;
          const metrics = dialoguePageMetrics(glyphs.slice(0, offset).join(""));
          return metrics.fits && metrics.measuredLines.length >= minimumLines;
        })
        .sort((left, right) => right - left)[0];
      const tokenBoundarySet = new Set(tokenOffsets);
      const tokenBoundaryOffsets = (offsets) => new Set([...offsets].filter((offset) => tokenBoundarySet.has(offset)));
      return fittingOffset(usedGlyphFallback ? sentenceOffsets : tokenBoundaryOffsets(sentenceOffsets))
        || fittingOffset(usedGlyphFallback ? safeOffsets : tokenBoundaryOffsets(safeOffsets))
        || fittingOffset(tokenBoundarySet, preferredMinimumLines)
        || maximum;
    };

    units.forEach((unit) => {
      let remainder = unit;
      while (remainder) {
        if (dialoguePageMetrics(`${page}${remainder}`).fits) {
          page += remainder;
          remainder = "";
          continue;
        }
        if (page) {
          if (dialoguePageMetrics(remainder).fits) {
            commitPage();
            page = remainder;
            remainder = "";
            continue;
          }
          commitPage();
          continue;
        }
        const breakAt = largestSafePrefix(remainder);
        page = Array.from(remainder).slice(0, breakAt).join("");
        commitPage();
        remainder = Array.from(remainder).slice(breakAt).join("");
      }
    });
    commitPage();
    const balanced = balanceDialoguePages(pages.length ? pages : [normalized]);
    return balanced.join("") === normalized ? balanced : [normalized];
  };

  const buildMeasuredLineLayout = (text, preparedLayout = null) => {
    const layout = preparedLayout || buildDialogueTokenLayout(text);
    const measuredLines = measureNativeLines(text, layout);
    const glyphs = [];
    layout.querySelectorAll(".novel-phrase-token, .novel-space-token").forEach((token) => {
      const fragment = document.createDocumentFragment();
      Array.from(token.textContent || "").forEach((glyph) => {
        const span = document.createElement("span");
        span.className = "novel-reveal-glyph";
        span.textContent = glyph;
        span.dataset.revealIndex = String(glyphs.length);
        span.setAttribute("aria-hidden", "true");
        glyphs.push(span);
        fragment.append(span);
      });
      token.replaceChildren(fragment);
    });
    elements.text.replaceChildren(layout);
    elements.text.dataset.measuredNodeIdentity = layout.dataset.layoutIdentity || "";
    elements.text.dataset.measuredLineCount = String(measuredLines.length);
    elements.text.dataset.revealCount = "0";
    elements.text.dataset.revealSourceLength = String(glyphs.length);
    elements.text.dataset.revealState = "running";
    window.clearTimeout(dialogueResizeTimer);
    dialogueResizeTimer = 0;
    dialogueObservedWidth = elements.text.getBoundingClientRect().width;
    return glyphs;
  };

  const revealDelayForGlyph = () => Math.max(
    REVEAL_MIN_GLYPH_MS,
    REVEAL_BASE_MS * (100 / config.messageSpeedPercent),
  );

  const revealText = (text, preparedLayout = null) => {
    clearTimers();
    const generation = revealGeneration;
    fullText = text;
    elements.text.setAttribute("aria-label", text);
    elements.text.classList.remove("is-preparing", "is-revealing", "is-revealed");
    elements.text.dataset.revealState = "preparing";
    elements.text.dataset.revealCount = "0";
    elements.continueMark.classList.remove("is-visible");
    if (motionReduced() || !text) {
      elements.text.replaceChildren(preparedLayout || buildDialogueTokenLayout(text));
      finishReveal();
      return;
    }

    isRevealing = true;
    elements.text.replaceChildren(preparedLayout || buildDialogueTokenLayout(text));
    elements.text.classList.add("is-preparing");
    elements.cursor.hidden = true;

    const startMeasuredReveal = () => {
      if (generation !== revealGeneration || !isRevealing) return;
      revealFrame = window.requestAnimationFrame(() => {
        revealFrame = window.requestAnimationFrame(() => {
          if (generation !== revealGeneration || !isRevealing) return;
          revealFrame = 0;
          const glyphs = buildMeasuredLineLayout(text, preparedLayout);
          elements.text.classList.remove("is-preparing");
          elements.text.classList.add("is-revealing");
          elements.text.dataset.revealCadence = "timer-steady";
          elements.cursor.hidden = false;
          let nextGlyphIndex = 0;
          const revealNextGlyph = () => {
            revealTimer = 0;
            if (generation !== revealGeneration || !isRevealing) return;
            const glyph = glyphs[nextGlyphIndex];
            if (!glyph) {
              finishReveal();
              return;
            }
            glyph.classList.add("is-visible");
            nextGlyphIndex += 1;
            elements.text.dataset.revealCount = String(nextGlyphIndex);
            if (nextGlyphIndex >= glyphs.length) {
              revealTimer = window.setTimeout(finishReveal, REVEAL_MIN_LINE_MS);
              return;
            }
            revealTimer = window.setTimeout(revealNextGlyph, revealDelayForGlyph());
          };
          revealNextGlyph();
        });
      });
    };

    const fontsReady = document.fonts?.ready || Promise.resolve();
    Promise.resolve(fontsReady).then(startMeasuredReveal, startMeasuredReveal);
  };

  const renderDialoguePage = ({ reveal = dialoguePageReveal } = {}) => {
    const page = (dialoguePages[dialoguePageIndex] || "").replace(/\n+$/u, "");
    const layout = dialoguePageLayouts[dialoguePageIndex] || buildDialogueTokenLayout(page);
    const metrics = dialoguePageMetrics(page, layout);
    elements.text.dataset.pageCount = String(dialoguePages.length);
    elements.text.dataset.pageIndex = String(dialoguePageIndex + 1);
    elements.text.dataset.measuredLineCount = String(metrics.measuredLines.length);
    elements.text.dataset.maxLineCount = String(metrics.maxLines);
    elements.continueMark.textContent = "▼";
    if (reveal) {
      revealText(page, layout);
      return;
    }
    clearTimers();
    fullText = page;
    isRevealing = false;
    elements.text.classList.remove("is-preparing", "is-revealing", "is-revealed");
    elements.text.replaceChildren(layout);
    elements.text.classList.add("is-revealed");
    elements.text.dataset.revealState = "complete";
    elements.text.dataset.revealCount = String(Array.from(page).length);
    elements.text.dataset.measuredNodeIdentity = layout.dataset.layoutIdentity || "";
    elements.text.setAttribute("aria-label", page);
    elements.cursor.hidden = true;
    elements.continueMark.classList.add("is-visible");
    scheduleAutoAdvance();
  };

  const renderDialoguePages = (text, { reveal = true } = {}) => {
    const normalized = String(text || "");
    resetDialoguePagination();
    const paginationGeneration = dialoguePaginationGeneration;
    dialogueSourceText = normalized;
    dialoguePageReveal = reveal;
    elements.text.dataset.characterCount = String(Array.from(normalized.replace(/\s/gu, "")).length);
    elements.text.dataset.explicitLineCount = String(Math.max(1, normalized.split("\n").length));
    const renderMeasuredPages = () => {
      if (paginationGeneration !== dialoguePaginationGeneration || dialogueSourceText !== normalized) return;
      dialoguePages = paginateDialogueTextBalanced(normalized);
      dialoguePageLayouts = dialoguePages.map((page, index) => {
        const layout = buildDialogueTokenLayout(page.replace(/\n+$/u, ""));
        layout.dataset.layoutIdentity = `${currentStep()?.id || "step"}:${paginationGeneration}:${index}`;
        dialoguePageMetrics(page.replace(/\n+$/u, ""), layout);
        layout.remove();
        return layout;
      });
      elements.text.dataset.pageCount = String(dialoguePages.length);
      renderDialoguePage();
    };
    if (!document.fonts || document.fonts.status === "loaded") {
      renderMeasuredPages();
      return;
    }
    elements.text.textContent = normalized;
    elements.text.setAttribute("aria-label", normalized);
    elements.text.classList.add("is-preparing");
    elements.continueMark.classList.remove("is-visible");
    Promise.resolve(document.fonts.ready).then(renderMeasuredPages, renderMeasuredPages);
  };

  const advanceDialoguePage = () => {
    if (dialoguePageIndex + 1 >= dialoguePages.length) return false;
    dialoguePageIndex += 1;
    renderDialoguePage();
    return true;
  };

  const repaginateVisibleDialogue = () => {
    if (isRevealing
      || elements.text.dataset.revealState === "preparing"
      || elements.text.classList.contains("is-preparing")) {
      dialogueReflowPending = true;
      return;
    }
    if (dialogueReflowActive) return;
    dialogueReflowPending = false;
    window.clearTimeout(dialogueResizeTimer);
    dialogueResizeTimer = window.setTimeout(() => {
      dialogueResizeTimer = 0;
      const step = currentStep();
      if (!isOpen || !hasStarted || !["narration", "dialogue"].includes(step?.type) || !dialogueSourceText) return;
      const generation = dialoguePaginationGeneration;
      const source = dialogueSourceText;
      const anchorOffset = dialoguePages.slice(0, dialoguePageIndex).reduce((total, page) => total + Array.from(page).length, 0);
      const apply = () => {
        if (generation !== dialoguePaginationGeneration || source !== dialogueSourceText || currentStep()?.id !== step.id) return;
        dialogueReflowActive = true;
        const nextPages = paginateDialogueTextBalanced(source);
        let nextIndex = 0;
        let offset = 0;
        while (nextIndex + 1 < nextPages.length && anchorOffset >= offset + Array.from(nextPages[nextIndex]).length) {
          offset += Array.from(nextPages[nextIndex]).length;
          nextIndex += 1;
        }
        dialoguePages = nextPages;
        dialoguePageLayouts = nextPages.map((page, index) => {
          const layout = buildDialogueTokenLayout(page.replace(/\n+$/u, ""));
          layout.dataset.layoutIdentity = `${step.id}:${generation}:reflow:${index}`;
          dialoguePageMetrics(page.replace(/\n+$/u, ""), layout);
          layout.remove();
          return layout;
        });
        dialoguePageIndex = nextIndex;
        elements.text.dataset.pageCount = String(dialoguePages.length);
        renderDialoguePage({ reveal: false });
        dialogueObservedWidth = elements.text.getBoundingClientRect().width;
        window.requestAnimationFrame(() => {
          dialogueReflowActive = false;
        });
      };
      const fontsReady = document.fonts?.ready || Promise.resolve();
      Promise.resolve(fontsReady).then(apply, apply);
    }, 120);
  };

  function clearSectionEntry() {
    window.clearTimeout(sectionEntryTimer);
    sectionEntryTimer = 0;
    delete layer.dataset.sectionEntry;
  }

  function renderStepAfterSection() {
    renderCurrentStep();
    if (motionReduced() || !isOpen) return;
    // Fade the containing surfaces, preserving their own typography, portrait
    // opacity and positioning. Start only after the title/background release.
    layer.dataset.sectionEntry = "revealing";
    sectionEntryTimer = window.setTimeout(() => {
      clearSectionEntry();
      if (!isRevealing) scheduleAutoAdvance();
    }, SECTION_ENTRY_FADE_MS);
  }

  function finishSectionSeparator() {
    if (!sectionSeparatorActive) return false;
    window.clearTimeout(sectionSeparatorTimer);
    sectionSeparatorTimer = 0;
    sectionSeparatorActive = false;
    elements.chapterCard.hidden = true;
    const step = currentStep();
    if (temporalRuntime.contextTransitionForStep(step)) renderTemporalTransitionCard(step);
    else if (deferredSectionBackgroundTransition?.stepId === step?.id) {
      const transition = deferredSectionBackgroundTransition;
      deferredSectionBackgroundTransition = null;
      void runBackgroundTransition(
        transition.currentBackground,
        transition.nextBackground,
        () => {
          layer.dataset.sceneId = step.sceneId;
          layer.dataset.stepId = step.id;
          applyBackgroundCueForStep(step);
          requestTrackForStep(step, { image: getComputedStyle(layer).backgroundImage });
        },
        renderStepAfterSection,
        { crossfadeOnly: true, fromStepId: transition.fromStepId || "", toStepId: step.id },
      );
    } else {
      deferredSectionBackgroundTransition = null;
      renderStepAfterSection();
    }
    return true;
  }

  function renderChapterTitleUnits(value) {
    const title = String(value || "");
    const labels = title.split("｜");
    const longestLabel = labels.reduce((longest, label) => Math.max(longest, Array.from(label).length), 0);
    elements.chapterTitle.dataset.titleDensity = longestLabel >= 23
      ? "dense"
      : longestLabel >= 17
        ? "compact"
        : "regular";
    elements.chapterTitle.setAttribute("aria-label", title);
    const labelUnit = (label) => {
      const unit = document.createElement("span");
      unit.className = "novel-chapter-title-unit";
      unit.dataset.titleUnit = "label";
      unit.textContent = label;
      return unit;
    };
    const units = [labelUnit(labels.shift() || "")];
    labels.forEach((label) => {
      const tail = document.createElement("span");
      tail.className = "novel-chapter-title-tail";
      const separator = document.createElement("span");
      separator.className = "novel-chapter-title-unit is-separator";
      separator.dataset.titleUnit = "separator";
      separator.textContent = "｜";
      tail.append(separator, labelUnit(label));
      units.push(tail);
    });
    elements.chapterTitle.replaceChildren(...units);
  }

  function renderSectionSeparator(step = currentStep()) {
    clearSectionEntry();
    if (!step) {
      clearScriptDebug();
      return;
    }
    const scene = sceneMap.get(step.sceneId);
    if (!scene) return renderCurrentStep();
    endControlFastForward();
    clearTimers();
    closeLog();
    showRuntime();
    syncScriptDebug(step);
    requestTrackForStep(step, backgroundPresentationForStep(step));
    hideSpecialSurfaces();
    resetDialoguePagination();
    isRevealing = false;
    layer.dataset.sceneId = step.sceneId;
    layer.dataset.stepId = step.id;
    layer.dataset.stepType = "section-separator";
    elements.dialogue.hidden = true;
    elements.choices.replaceChildren();
    elements.choices.classList.remove("is-visible");
    elements.sourceLabel.hidden = true;
    elements.modeReadout.textContent = `${scene.chapter} — ${scene.title}`;
    renderTemporalHeading(scene.title);
    elements.chapterIndex.textContent = scene.chapter;
    renderChapterTitleUnits(scene.title);
    elements.chapterCard.dataset.sceneId = scene.id;
    elements.chapterCard.hidden = false;
    setCharacterPresentation("chapter");
    if (isPreMeetingRecordPresentation(step)) elements.avatar.hidden = true;
    selectMode(scene.modeIndex);
    updateProgress();
    sectionSeparatorActive = true;
    sectionSeparatorTimer = window.setTimeout(
      finishSectionSeparator,
      motionReduced() ? SECTION_SEPARATOR_REDUCED_MOTION_MS : SECTION_SEPARATOR_MS,
    );
  }
  const markRead = (step) => {
    let addedToLog = false;
    if (!["choice", "reflectionChoice", "interaction", "phase", "result", "end"].includes(step.type)
      && !state.readStepIds.includes(step.id)) {
      state.readStepIds.push(step.id);
      state.readStepIds = state.readStepIds.slice(-260);
      addedToLog = true;
    }
    if (!state.reachedSceneIds.includes(step.sceneId)) state.reachedSceneIds.push(step.sceneId);
    saveProgress();
    if (addedToLog && !elements.logPanel.hidden) renderLog();
  };

  const clearSlackSurface = () => {
    elements.slackSurface.hidden = true;
    elements.slackSurface.replaceChildren();
    delete layer.dataset.slackTerminal;
    slackScrollGuardUntil = 0;
  };

  const prepareSlackTransition = (nextStepType) => {
    window.clearTimeout(slackTransitionTimer);
    slackTransitionTimer = 0;
    if (layer.classList.contains("is-slack-exiting")) clearSlackSurface();
    const wasSlack = layer.classList.contains("is-slack");
    const entersSlack = !wasSlack && nextStepType === "chat";
    const exitsSlack = wasSlack && nextStepType !== "chat";
    layer.classList.remove("is-slack-entering", "is-slack-exiting");
    if (entersSlack) layer.classList.add("is-slack-entering");
    if (exitsSlack) layer.classList.add("is-slack-exiting");
    if (!entersSlack && !exitsSlack) return false;

    const transitionDuration = exitsSlack ? SLACK_EXIT_MS : SLACK_ENTER_MS;
    slackTransitionTimer = window.setTimeout(() => {
      if (exitsSlack) clearSlackSurface();
      layer.classList.remove("is-slack-entering", "is-slack-exiting");
      slackTransitionTimer = 0;
    }, motionReduced() ? 0 : transitionDuration);
    return exitsSlack;
  };

  const prepareStepFrame = (step) => {
    const scene = sceneMap.get(step.sceneId);
    const chatDevice = chatDeviceForStep(step);
    const preserveSlack = prepareSlackTransition(step.type);
    layer.dataset.sceneId = step.sceneId;
    layer.dataset.stepId = step.id;
    layer.dataset.stepType = step.type;
    layer.dataset.slackDevice = chatDevice;
    const openingCue = openingCueForStep(step);
    if (openingCue) layer.dataset.openingCue = openingCue;
    else delete layer.dataset.openingCue;
    if (isObjectiveOpeningRecord(step)) layer.dataset.openingPresentation = "objective-record";
    else delete layer.dataset.openingPresentation;
    delete layer.dataset.recordPresentation;
    if (step.type !== "chat") delete elements.cast.dataset.slackCast;
    const backgroundCue = applyBackgroundCueForStep(step);
    unlockGalleryCue(backgroundCue);
    requestTrackForStep(step, { image: getComputedStyle(layer).backgroundImage });
    sectionSeparatorActive = false;
    showRuntime();
    warmUpcomingBackground(step);
    hideSpecialSurfaces({ preserveSlack });
    applyBackHalfCueForStep(step);
    elements.chapterCard.hidden = true;
    elements.dialogue.hidden = false;
    elements.choices.replaceChildren();
    elements.choices.classList.remove("is-visible", "is-mode08-optional");
    delete elements.choices.dataset.interactionKind;
    delete elements.choices.dataset.interactionOptional;
    elements.sourceLabel.hidden = false;
    resetDialoguePagination();
    applyTemporalPresentation(step);
    selectMode(scene.modeIndex);
    updateProgress();
    updateSignalLabel(step);
    markRead(step);
  };

  const appendLines = (container, text) => {
    String(text).split("\n").forEach((line, index) => {
      if (index) container.append(document.createElement("br"));
      container.append(document.createTextNode(line));
    });
  };

  const recordTextForDisplay = (text) => {
    const normalized = String(text || "")
      .replace(/\s*\/\s*(?:LOCAL SOURCE|SOURCE|DERIVED|SCENARIO|VISITOR TRACE|CONTEXT|AUTHOR|GENERATED TEXT|RESPONSIBLE|EDITORIAL CHOICE|SAKUYA SOURCE|PUBLIC BUILD CHANGED)(?=：|$)/gm, "")
      .replace(/SOURCE RECORD または DISCLOSE DERIVATION/g, "原文を残す／生成経緯を開示する")
      .replace(/：NO(?=$|\n)/g, "：なし")
      .trim();
    const lines = normalized.split("\n");
    if (lines.length > 1 && ["観測記録", "その場の観測", "計算・解釈", "操作記録"].includes(lines[0].trim())) lines.shift();
    return lines.join("\n").trim();
  };

  const canonicalStepTextForCopy = (step) => {
    const source = String(step?.text ?? step?.prompt ?? "");
    if (!source) return "";
    if (!/<[a-z][^>]*>/iu.test(source)) return recordTextForDisplay(source);
    const template = document.createElement("template");
    template.innerHTML = source;
    return recordTextForDisplay(template.content.textContent || "");
  };

  const fallbackClipboardWrite = (text) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    Object.assign(textarea.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0" });
    document.body.append(textarea);
    textarea.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    textarea.remove();
    return copied;
  };

  const writeClipboardText = async (payload) => {
    let copied = false;
    try {
      await navigator.clipboard?.writeText?.(payload);
      copied = Boolean(navigator.clipboard?.writeText);
    } catch {
      copied = false;
    }
    return copied || fallbackClipboardWrite(payload);
  };

  const setScriptCopyFeedback = (copied) => {
    clearScriptCopyFeedback();
    const debug = getScriptDebugElements();
    if (!debug.copyButton || !debug.copyStatus) return;
    debug.copyStatus.textContent = copied ? "コピー済み" : "コピー失敗";
    debug.copyButton.dataset.copyState = copied ? "copied" : "error";
    debug.copyButton.setAttribute("aria-label", copied ? "スクリプト位置をコピーしました" : "スクリプト位置をコピーできませんでした");
    scriptCopyFeedbackTimer = window.setTimeout(clearScriptCopyFeedback, 1200);
  };

  const copyCurrentScriptPosition = async () => {
    const debug = getScriptDebugElements();
    const step = currentStep();
    const expectedIndex = scriptIndexMap.get(step?.id);
    const number = debug.number?.textContent || "";
    const stepId = debug.stepId?.textContent || "";
    if (!step || !Number.isInteger(expectedIndex) || stepId !== step.id || number !== String(expectedIndex).padStart(4, "0")) {
      setScriptCopyFeedback(false);
      return false;
    }
    const header = `SCRIPT #${number}｜${stepId}`;
    const body = canonicalStepTextForCopy(step);
    const payload = body ? `${header}\n${body}` : header;
    const copied = await writeClipboardText(payload);
    setScriptCopyFeedback(copied);
    return copied;
  };

  const slackTimelineFor = (step) => {
    const scene = sceneMap.get(step.sceneId);
    const localIndex = scene?.steps.findIndex((candidate) => candidate.id === step.id) ?? -1;
    if (!scene || localIndex < 0) return { messages: [step], typing: null };
    const messages = scene.steps
      .slice(0, localIndex + 1)
      .filter((candidate) => candidate.type === "chat" && conditionMatches(candidate));
    const following = scene.steps[localIndex + 1];
    return { messages, typing: following?.type === "chat" && conditionMatches(following) ? following : null };
  };

  const SLACK_SYMBOLS = Object.freeze({
    amane: Object.freeze({ id: "cloud", label: "あめの雲", src: "./assets/visuals-07/slack-avatar-amane-v2.webp" }),
    mizuha: Object.freeze({ id: "water", label: "みずの水滴", src: "./assets/visuals-07/slack-avatar-mizuha-v2.webp" }),
    sakuya: Object.freeze({ id: "flower", label: "sakuの花", src: "./assets/visuals-07/slack-avatar-sakuya-flower-v3.webp" }),
    visitor: Object.freeze({ id: "green-apple", label: "青猫の緑のりんご", kind: "green-apple" }),
    bluecat: Object.freeze({ id: "green-apple", label: "青猫の緑のりんご", kind: "green-apple" }),
  });
  const createSlackSymbol = (speakerId) => {
    const avatar = document.createElement("span");
    const symbol = SLACK_SYMBOLS[speakerId];
    avatar.className = "novel-slack-avatar";
    avatar.dataset.symbol = symbol?.id || "system";
    avatar.setAttribute("role", "img");
    avatar.setAttribute("aria-label", symbol?.label || "SYSTEMの記号");
    if (symbol?.kind === "green-apple") {
      avatar.innerHTML = `<svg class="novel-slack-symbol novel-slack-symbol--green-apple" viewBox="0 0 48 48" aria-hidden="true"><path class="novel-slack-apple-body" d="M24 15c-4.2-4.1-12.8-2.2-15.1 4.9-3.2 9.7 3.2 20.5 10.1 20.5 2.2 0 3.5-1 5-1s2.8 1 5 1c6.9 0 13.3-10.8 10.1-20.5C36.8 12.8 28.2 10.9 24 15Z"/><path class="novel-slack-apple-leaf" d="M25.3 12.7c2.5-5.2 7.2-7.1 11.8-5.5-1.6 4.6-5.3 7.2-11.8 5.5Z"/><path class="novel-slack-apple-stem" d="M24.4 14.7c-.5-4.2.6-7 2.5-9"/><ellipse class="novel-slack-apple-highlight" cx="15.3" cy="22.4" rx="2.6" ry="4.4" transform="rotate(24 15.3 22.4)"/></svg>`;
    } else if (symbol) {
      const image = document.createElement("img");
      image.className = "novel-slack-symbol";
      image.src = symbol.src;
      image.alt = "";
      image.decoding = "async";
      image.loading = "eager";
      avatar.append(image);
    } else {
      avatar.textContent = SPEAKERS[speakerId]?.glyph || "◎";
    }
    return avatar;
  };
  if (elements.galleryButton) {
    elements.galleryButton.hidden = true;
    elements.galleryButton.tabIndex = -1;
    elements.galleryButton.setAttribute("aria-hidden", "true");
    elements.galleryButton.inert = true;
    elements.galleryButton.remove();
  }

  const createSlackAttachment = (attachment) => {
    const identifier = String(attachment?.id || "").toUpperCase();
    const asset = SLACK_ATTACHMENT_ASSETS[identifier];
    const figure = document.createElement("figure");
    const status = document.createElement("p");
    figure.className = "novel-slack-attachment";
    figure.dataset.attachment = identifier;
    status.className = "novel-slack-attachment-error";
    status.setAttribute("role", "status");
    status.textContent = "画像を読み込めませんでした。";
    status.hidden = true;

    if (!asset) {
      figure.classList.add("is-error");
      status.hidden = false;
      figure.append(status);
      return figure;
    }

    const image = document.createElement("img");
    const caption = document.createElement("figcaption");
    const icon = document.createElement("span");
    const label = document.createElement("strong");
    const kind = document.createElement("small");
    image.src = asset.src;
    image.alt = attachment.description || asset.label;
    image.decoding = "async";
    image.loading = "eager";
    image.addEventListener("error", () => {
      figure.classList.add("is-error");
      status.hidden = false;
    });
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▣";
    label.textContent = asset.label;
    kind.textContent = "画像";
    caption.append(icon, label, kind);
    figure.append(image, status, caption);
    return figure;
  };

  const chatMessagePresentation = (message) => {
    if (Array.isArray(message.reactions) && message.reactions.length > 0) {
      return { text: String(message.text || ""), reactions: message.reactions };
    }
    const lines = String(message.text || "").split("\n");
    const reactionTokens = String(lines.at(-1) || "").trim().split(/\s+(?=\p{Extended_Pictographic})/u).filter(Boolean);
    const reactions = reactionTokens.map((token) => {
      const match = token.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s+(\d+)$/u);
      return match ? { emoji: match[1], count: Number(match[2]) } : null;
    });
    if (reactions.length < 2 || reactions.some((reaction) => !reaction)) {
      return { text: String(message.text || ""), reactions: [] };
    }
    return { text: lines.slice(0, -1).join("\n"), reactions };
  };

  const createSlackReactionItem = (reaction) => {
    const item = document.createElement("span");
    item.className = "novel-slack-reaction";
    item.dataset.emoji = reaction.emoji;
    item.setAttribute("aria-label", `${reaction.emoji} ${reaction.count}件`);
    item.textContent = `${reaction.emoji} ${reaction.count}`;
    return item;
  };

  const renderSlackReactionFrame = (container, frame, frameIndex, frameCount) => {
    const thread = container.closest(".novel-slack-thread");
    const followsLatest = Boolean(thread && (thread.scrollHeight - thread.scrollTop - thread.clientHeight) <= LOG_FOLLOW_THRESHOLD_PX);
    container.hidden = frame.length === 0;
    frame.forEach((reaction, index) => {
      let item = container.children[index];
      if (!item) {
        item = createSlackReactionItem(reaction);
        item.classList.add("is-arriving");
        container.append(item);
      } else if (item.textContent !== `${reaction.emoji} ${reaction.count}`) {
        item.setAttribute("aria-label", `${reaction.emoji} ${reaction.count}件`);
        item.textContent = `${reaction.emoji} ${reaction.count}`;
        item.classList.add("is-counting");
      }
    });
    while (container.children.length > frame.length) container.lastElementChild.remove();
    container.dataset.reactionStage = frameIndex === frameCount - 1 ? "complete" : `${frameIndex + 1}/${frameCount}`;
    if (followsLatest && thread) requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
  };

  const reactionFramesFor = (reactions) => {
    const frames = [];
    const settled = [];
    reactions.forEach((reaction) => {
      const count = Math.max(1, Number(reaction.count) || 1);
      frames.push([...settled, { ...reaction, count: 1 }]);
      if (count > 1) frames.push([...settled, { ...reaction, count: Math.min(2, count) }]);
      if (count > 2) frames.push([...settled, { ...reaction, count }]);
      settled.push({ ...reaction, count });
    });
    const finalFrame = reactions.map((reaction) => ({ ...reaction, count: Math.max(1, Number(reaction.count) || 1) }));
    if (JSON.stringify(frames.at(-1)) !== JSON.stringify(finalFrame)) frames.push(finalFrame);
    return frames;
  };

  const stageSlackReactions = (article, reactions) => {
    const container = article.querySelector(".novel-slack-reactions");
    if (!container) return;
    const frames = reactionFramesFor(reactions);
    article.dataset.reactions = "staging";
    frames.forEach((frame, index) => {
      const timer = window.setTimeout(() => {
        reactionTimers.delete(timer);
        if (!article.isConnected) return;
        renderSlackReactionFrame(container, frame, index, frames.length);
        if (index === frames.length - 1) article.dataset.reactions = "complete";
      }, REACTION_STAGE_INITIAL_MS + (index * REACTION_STAGE_STEP_MS));
      reactionTimers.add(timer);
    });
  };

  const createSlackPost = (message, { root = false, current = false, stageReactions = false } = {}) => {
    const presentation = chatMessagePresentation(message);
    const article = document.createElement("article");
    article.className = `novel-slack-post ${root ? "is-root" : "is-reply"}${current ? " is-new" : ""}`;
    article.dataset.speaker = message.speaker || "system";
    const body = document.createElement("div");
    body.className = "novel-slack-post-body";
    const meta = document.createElement("p");
    const speaker = document.createElement("strong");
    const time = document.createElement("time");
    const text = document.createElement("div");
    speaker.textContent = speakerDisplayName(message) || "SYSTEM";
    time.textContent = message.time || "";
    text.className = "novel-slack-message";
    appendLines(text, presentation.text);
    meta.append(speaker, time);
    body.append(meta, text);
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      const attachments = document.createElement("div");
      attachments.className = "novel-slack-attachments";
      message.attachments.forEach((attachment) => attachments.append(createSlackAttachment(attachment)));
      body.append(attachments);
    }
    if (presentation.reactions.length > 0) {
      const reactions = document.createElement("div");
      reactions.className = "novel-slack-reactions";
      reactions.setAttribute("aria-label", "メッセージへのリアクション");
      reactions.setAttribute("aria-live", "polite");
      reactions.hidden = stageReactions;
      if (!stageReactions) presentation.reactions.forEach((reaction) => reactions.append(createSlackReactionItem(reaction)));
      body.append(reactions);
      article.dataset.reactions = stageReactions ? "pending" : "complete";
      if (stageReactions) article.dataset.stagedReactionValues = JSON.stringify(presentation.reactions);
    }
    article.append(createSlackSymbol(message.speaker || "system"));
    article.append(body);
    return article;
  };

  const createCampusSidebarEntry = (channel, { current = false, interactive = false } = {}) => {
    const entry = document.createElement(interactive ? "button" : "span");
    if (interactive) entry.type = "button";
    entry.className = "novel-slack-channel";
    entry.classList.toggle("novel-slack-school-channel", CAMPUS_CHAT_SCHOOL_CHANNELS.includes(channel));
    entry.classList.toggle("is-private", channel.private === true);
    entry.classList.toggle("is-current", current);
    entry.dataset.channel = channel.id;
    entry.title = channel.private ? `${channel.label}（プライベート）` : channel.label;
    if (current) entry.setAttribute("aria-current", "page");
    if (channel.private) entry.setAttribute("aria-label", `${channel.label}、鍵付きプライベートチャネル`);
    const icon = document.createElement("i");
    const label = document.createElement("span");
    icon.className = "novel-slack-channel-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = channel.private ? "🔒 " : "# ";
    label.className = "novel-slack-channel-label";
    label.textContent = channel.label;
    entry.append(icon, label);
    return entry;
  };

  const createCampusChatWorkspace = ({ timeline, step, mobileDevice = false, stageCurrentReactions = false }) => {
    const workspace = document.createElement("div");
    workspace.className = "novel-slack-workspace";
    workspace.classList.toggle("is-mobile-device", mobileDevice);
    workspace.dataset.device = mobileDevice ? "mobile" : "wide";
    workspace.innerHTML = `<header><b><span class="novel-slack-app-name">学内チャット</span><i aria-hidden="true">◀　▶　◷</i></b><span>⌕　惑星の放課後を検索</span><i aria-hidden="true">?　◉</i></header><aside aria-label="学内チャットのチャンネル一覧"></aside><main><header><div><strong class="novel-slack-channel-title"></strong><small class="novel-slack-channel-description"></small></div><span class="novel-slack-channel-members"></span></header><section class="novel-slack-thread" aria-label="メッセージスレッド" aria-live="polite"></section><footer><span>＋</span><span class="novel-slack-compose-target"></span><b aria-hidden="true">Aa　☺　🎙</b></footer></main>`;

    const aside = workspace.querySelector("aside");
    const thread = workspace.querySelector(".novel-slack-thread");
    const title = workspace.querySelector(".novel-slack-channel-title");
    const description = workspace.querySelector(".novel-slack-channel-description");
    const members = workspace.querySelector(".novel-slack-channel-members");
    const composeTarget = workspace.querySelector(".novel-slack-compose-target");
    const schoolHeading = document.createElement("small");
    const circleHeading = document.createElement("small");
    const directHeading = document.createElement("small");
    const workspaceName = document.createElement("strong");
    workspaceName.textContent = "惑星の放課後";
    schoolHeading.textContent = "大学・授業";
    circleHeading.textContent = "サークル";
    directHeading.textContent = "ダイレクトメッセージ";
    aside.append(workspaceName, schoolHeading);

    const selectableChannels = new Map();
    CAMPUS_CHAT_SCHOOL_CHANNELS.forEach((channel) => {
      const entry = createCampusSidebarEntry(channel, { interactive: channel.private === true });
      aside.append(entry);
      if (channel.private) selectableChannels.set(channel.id, entry);
    });

    aside.append(circleHeading);
    const storyEntry = createCampusSidebarEntry(CAMPUS_CHAT_STORY_CHANNEL, { current: true, interactive: true });
    storyEntry.classList.add("novel-slack-story-channel");
    aside.append(storyEntry);
    selectableChannels.set(CAMPUS_CHAT_STORY_CHANNEL.id, storyEntry);

    const sensorChannelVisible = timeline.messages.some((message) => message.id === "welcome_chat_022");
    if (sensorChannelVisible) {
      const sensorEntry = createCampusSidebarEntry(CAMPUS_CHAT_SENSOR_CHANNEL, { interactive: true });
      sensorEntry.classList.add("novel-slack-circle-channel");
      aside.append(sensorEntry);
      selectableChannels.set(CAMPUS_CHAT_SENSOR_CHANNEL.id, sensorEntry);
    }

    aside.append(directHeading);
    CAMPUS_CHAT_DIRECT_MESSAGES.forEach((directMessage) => {
      const entry = document.createElement("span");
      const status = document.createElement("i");
      const label = document.createElement("b");
      entry.className = "novel-slack-dm";
      entry.dataset.directMessage = directMessage.id;
      status.className = "novel-slack-dm-presence";
      status.dataset.presence = directMessage.presence;
      status.setAttribute("aria-hidden", "true");
      label.textContent = directMessage.label;
      entry.append(status, label);
      aside.append(entry);
    });

    const messageSequence = (message) => Number((message.cueFromStepId || message.id)?.match(/^welcome_chat_(\d{3})$/u)?.[1]) || 0;
    const messageBelongsToSensorChannel = (message) => messageSequence(message) >= 23;
    let reactionSequenceStarted = false;
    const renderChannelMessages = (messages, typingMessage = null) => {
      thread.replaceChildren();
      messages.forEach((message, index) => {
        const current = message.id === step.id;
        const stageReactions = current && stageCurrentReactions && !reactionSequenceStarted;
        const article = createSlackPost(message, { root: index === 0, current, stageReactions });
        thread.append(article);
        if (stageReactions) {
          reactionSequenceStarted = true;
          stageSlackReactions(article, JSON.parse(article.dataset.stagedReactionValues || "[]"));
          delete article.dataset.stagedReactionValues;
        }
      });
      if (typingMessage) {
        const typingNode = document.createElement("div");
        typingNode.className = "novel-slack-typing";
        typingNode.dataset.speaker = typingMessage.speaker || "system";
        typingNode.setAttribute("role", "status");
        typingNode.innerHTML = `<span><b>${speakerDisplayName(typingMessage) || "誰か"}</b> が入力しています</span><i aria-hidden="true"><b></b><b></b><b></b></i>`;
        typingNode.prepend(createSlackSymbol(typingMessage.speaker || "system"));
        thread.append(typingNode);
      }
      requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
    };

    const renderStoryChannel = () => renderChannelMessages(
      timeline.messages.filter((message) => !messageBelongsToSensorChannel(message)),
      timeline.typing && !messageBelongsToSensorChannel(timeline.typing) ? timeline.typing : null,
    );

    const renderSensorChannel = () => renderChannelMessages(
      timeline.messages.filter(messageBelongsToSensorChannel),
      timeline.typing && messageBelongsToSensorChannel(timeline.typing) ? timeline.typing : null,
    );

    const renderPrivateChannel = (channel) => {
      const notice = document.createElement("article");
      const icon = document.createElement("span");
      const heading = document.createElement("strong");
      const copy = document.createElement("p");
      notice.className = "novel-slack-private-notice";
      notice.setAttribute("role", "status");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "🔒";
      heading.textContent = channel.label;
      copy.textContent = channel.notice;
      notice.append(icon, heading, copy);
      thread.replaceChildren(notice);
      thread.scrollTop = 0;
    };

    const selectChannel = (channel) => {
      selectableChannels.forEach((entry, channelId) => {
        const selected = channelId === channel.id;
        entry.classList.toggle("is-current", selected);
        if (selected) entry.setAttribute("aria-current", "page");
        else entry.removeAttribute("aria-current");
      });
      workspace.dataset.activeChannel = channel.id;
      title.textContent = `${channel.private ? "🔒" : "#"} ${channel.label}`;
      description.textContent = channel.description || "";
      members.textContent = channel.private ? `🔒 ${channel.memberLabel}` : `♟ ${channel.memberLabel.replace(/\D+/gu, "")}　⌕`;
      composeTarget.textContent = `${channel.private ? "🔒" : "#"} ${channel.label} へのメッセージ`;
      thread.setAttribute("aria-label", `${channel.label}のメッセージスレッド`);
      if (channel.private) renderPrivateChannel(channel);
      else if (channel.id === CAMPUS_CHAT_SENSOR_CHANNEL.id) renderSensorChannel();
      else renderStoryChannel();
    };

    selectableChannels.forEach((entry, channelId) => {
      const channel = channelId === CAMPUS_CHAT_STORY_CHANNEL.id
        ? CAMPUS_CHAT_STORY_CHANNEL
        : channelId === CAMPUS_CHAT_SENSOR_CHANNEL.id
          ? CAMPUS_CHAT_SENSOR_CHANNEL
        : CAMPUS_CHAT_SCHOOL_CHANNELS.find((candidate) => candidate.id === channelId);
      entry.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (reactionSequenceStarted && reactionTimers.size > 0) clearReactionTimers();
        if (channel) selectChannel(channel);
      });
    });
    thread.addEventListener("scroll", () => {
      slackScrollGuardUntil = performance.now() + 220;
    }, { passive: true });
    const currentSequence = messageSequence(step);
    selectChannel(sensorChannelVisible && currentSequence >= 23
      ? CAMPUS_CHAT_SENSOR_CHANNEL
      : CAMPUS_CHAT_STORY_CHANNEL);
    return workspace;
  };

  const renderSimpleStep = (step) => {
    prepareStepFrame(step);
    const speaker = step.speaker || "narrator";
    const visualSpeaker = step.visualSpeaker || speaker;
    if (isPreMeetingRecordPresentation(step)) {
      suppressCharacterPresentation();
      elements.speaker.textContent = "";
    } else {
      setCharacterPresentation(visualSpeaker, expressionForStep(step));
      if (speaker === "visitor" || ABSTRACT_AVATAR_SUPPRESSED_STEP_IDS.has(step.id)) elements.avatar.hidden = true;
      elements.speaker.textContent = speakerDisplayName(step);
    }
    renderDialoguePages(String(step.text || ""));
  };

  const renderRichStep = (step) => {
    const stageCurrentReactions = step.type === "chat"
      && !state.readStepIds.includes(step.id)
      && !fastForwardEnabled();
    prepareStepFrame(step);
    clearTimers();
    isRevealing = false;
    elements.cursor.hidden = true;
    elements.continueMark.classList.add("is-visible");
    if (step.type === "chat") {
      const timeline = slackTimelineFor(step);
      const followingStep = stepMap.get(getFollowingStepId(step));
      const terminalChat = Boolean(!timeline.typing && followingStep && followingStep.sceneId !== step.sceneId);
      layer.dataset.slackTerminal = String(terminalChat);
      if (isPreMeetingRecordPresentation(step)) {
        suppressCharacterPresentation();
        elements.cast.dataset.slackCast = "hidden";
      } else {
        setCharacterPresentation(step.speaker, expressionForStep(step));
        setSlackCastVisibility(step);
      }
      elements.dialogue.hidden = true;
      elements.speaker.textContent = "";
      elements.text.replaceChildren();
      elements.text.removeAttribute("aria-label");
      elements.sourceLabel.hidden = true;
      elements.slackSurface.hidden = false;
      layer.classList.add("is-slack");
      const workspace = createCampusChatWorkspace({
        timeline,
        step,
        mobileDevice: layer.dataset.slackDevice === "mobile",
        stageCurrentReactions,
      });
      elements.slackSurface.append(workspace);
      scheduleAutoAdvance();
      return;
    }

    if (step.type === "record") {
      const presenter = getRecordPresenter(step);
      setCharacterPresentation(presenter);
      if (presenter === "narrator") elements.avatar.hidden = true;
      elements.dialogue.hidden = false;
      elements.sourceLabel.hidden = false;
      elements.speaker.textContent = presenter === "amane"
        ? "あめの観測メモ"
        : RECORD_SPEAKER_LABELS[step.recordType] || "記録メモ";
      elements.text.classList.remove("is-preparing", "is-revealing", "is-revealed");
      const displayText = recordTextForDisplay(step.text);
      elements.text.replaceChildren();
      appendLines(elements.text, displayText);
      elements.text.setAttribute("aria-label", displayText);
      elements.cursor.hidden = true;
      elements.continueMark.classList.add("is-visible");
      scheduleAutoAdvance();
      return;
    }

    const speaker = step.speaker || "system";
    if (["current_exhibition_016", "current_exhibition_017"].includes(step.id)) {
      suppressCharacterPresentation();
    } else {
      const presentationSpeaker = step.id === "current_exhibition_015" ? "amane" : speaker;
      setCharacterPresentation(presentationSpeaker, expressionForStep(step));
    }
    elements.speaker.textContent = speakerDisplayName(step) || "GAIA SENSEWARE";
    revealText(step.text || "");
  };

  const renderGenerationDetails = (step) => {
    prepareStepFrame(step);
    clearTimers();
    setCharacterPresentation("system");
    elements.speaker.textContent = "GAIA SENSEWARE";
    elements.cursor.hidden = true;
    elements.continueMark.classList.add("is-visible");
    const details = document.createElement("details");
    details.className = "novel-generation-details";
    const summary = document.createElement("summary");
    summary.textContent = step.text;
    const list = document.createElement("dl");
    const labels = {
      referencePostCount: "参照投稿件数",
      similarPostCount: "類似投稿件数",
      candidateCount: "生成候補数",
      model: "モデル名",
      temperature: "temperature",
      seed: "seed",
      generatedAt: "生成時刻",
      exclusions: "除外範囲",
      edited: "編集の有無",
    };
    Object.entries(labels).forEach(([key, label]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const value = document.createElement("dd");
      term.textContent = label;
      value.textContent = story.generationDetails[key];
      row.append(term, value);
      list.append(row);
    });
    details.append(summary, list);
    elements.text.replaceChildren(details);
  };

  const choiceStateKey = (choiceId) => ({
    observation_order: "observationOrder",
    editorial_choice: "editorialChoice",
  })[choiceId];

  const renderEditorialChoice = (step) => {
    prepareStepFrame(step);
    clearTimers();
    elements.dialogue.hidden = true;
    elements.sourceLabel.hidden = true;
    elements.evidenceSurface.hidden = false;
    layer.classList.add("is-evidence", "is-editorial-evidence");
    const compare = document.createElement("div");
    compare.className = "novel-evidence-compare";
    compare.innerHTML = `<article class="is-source"><header><span>観測記録 / SOURCE</span><time>02:14　SAKUYA</time></header><small>最後に届いたメッセージ</small><p>もし地球の声が聞こえたと思ったら、すぐに意味を決めるんじゃなくて――</p><footer><span>このあとに届いたメッセージ<br><b>0</b></span><span>本人の確認<br><b>受信済み原文</b></span></footer></article><article class="is-derived"><header><span>計算・解釈 / DERIVED</span><time>PRODUCTION RECORD</time></header><small>生成された制作過程</small><p>「聞こえたつもりになってない？」って、三人で確かめたい。</p><footer><span>生成実行・選定責任<br><b>MIZUHA</b></span><span>サクヤ本人の確認<br><b>なし</b></span></footer></article>`;
    const actions = document.createElement("nav");
    actions.setAttribute("aria-label", step.prompt);
    step.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label.split(" / ")[0];
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        state.editorialChoice = option.value;
        state.evesRoute = state.evesRoute.filter((entry) => entry.decisionId !== step.choiceId);
        state.evesRoute.push({ decisionId: step.choiceId, value: option.value, label: option.label, stepId: step.id });
        state.evesRoute = state.evesRoute.slice(0, 2);
        saveProgress();
        renderEves();
        moveToFollowingStep(step);
      });
      actions.append(button);
    });
    elements.evidenceSurface.append(compare, actions);
    requestAnimationFrame(() => actions.querySelector("button")?.focus({ preventScroll: true }));
  };

  const renderChoice = (step) => {
    if (step.choiceId === "editorial_choice") return renderEditorialChoice(step);
    prepareStepFrame(step);
    clearTimers();
    setCharacterPresentation("visitor");
    elements.speaker.textContent = "あなたの選択";
    elements.text.textContent = step.prompt;
    elements.cursor.hidden = true;
    elements.continueMark.classList.remove("is-visible");
    elements.dataKind.textContent = "操作記録 / VISITOR TRACE";
    elements.dataKind.dataset.kind = "VISITOR_TRACE";
    step.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      const title = document.createElement("strong");
      const code = document.createElement("small");
      const parts = option.label.split(" / ");
      title.textContent = parts[0];
      if (parts.length > 1) {
        code.textContent = parts.slice(1).join(" / ");
        button.append(title, code);
      } else {
        button.append(title);
      }
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const key = choiceStateKey(step.choiceId);
        if (key) state[key] = option.value;
        if (step.trackedByEves) {
          state.evesRoute = state.evesRoute.filter((entry) => entry.decisionId !== step.choiceId);
          state.evesRoute.push({ decisionId: step.choiceId, value: option.value, label: option.label, stepId: step.id });
          state.evesRoute = state.evesRoute.slice(0, 2);
        }
        saveProgress();
        renderEves();
        moveToFollowingStep(step);
      });
      elements.choices.append(button);
    });
    elements.choices.classList.add("is-visible");
    renderEves();
    requestAnimationFrame(() => elements.choices.querySelector("button")?.focus({ preventScroll: true }));
  };

  const scoreReflection = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return "UNANSWERED";
    const score = { LAW: 0, NEUTRAL: 0, CHAOS: 0 };
    ids.forEach((id) => {
      const weights = reflectionOptionMap.get(id)?.weights;
      if (!weights) return;
      score.LAW += Number(weights.law) || 0;
      score.NEUTRAL += Number(weights.neutral) || 0;
      score.CHAOS += Number(weights.chaos) || 0;
    });
    const maximum = Math.max(score.LAW, score.NEUTRAL, score.CHAOS);
    const leaders = Object.keys(score).filter((key) => score[key] === maximum);
    return leaders.length === 1 ? leaders[0] : "NEUTRAL";
  };

  const renderReflectionChoice = (step) => {
    prepareStepFrame(step);
    clearTimers();
    elements.dialogue.hidden = true;
    elements.sourceLabel.hidden = true;
    elements.reflectionSurface.hidden = false;
    layer.classList.add("is-reflection");

    const shell = document.createElement("div");
    shell.className = "novel-reflection-shell";
    const header = document.createElement("header");
    header.innerHTML = `<div><span>REFLECTION FIELD</span><h2>次へ渡したい姿勢を選ぶ</h2></div><p>最大3つ。選ばずに進むこともできます。</p>`;
    const grid = document.createElement("div");
    grid.className = "novel-reflection-grid";
    const status = document.createElement("p");
    status.className = "novel-reflection-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const proceed = document.createElement("button");
    proceed.type = "button";
    proceed.className = "novel-reflection-proceed";

    const update = (message = "") => {
      const selected = new Set(state.reflectionIds);
      grid.querySelectorAll("button").forEach((button) => {
        const active = selected.has(button.dataset.choiceId);
        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("is-selected", active);
      });
      status.textContent = message || `選択 ${selected.size} / ${step.maxSelections}`;
      proceed.textContent = selected.size ? "選んだ姿勢で進む" : "選ばずに進む";
    };

    const createOptionButton = (option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.choiceId = option.id;
      button.setAttribute("aria-pressed", "false");
      const text = document.createElement("strong");
      text.textContent = option.text;
      button.append(text);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const selected = new Set(state.reflectionIds);
        if (selected.has(option.id)) selected.delete(option.id);
        else if (selected.size >= step.maxSelections) {
          update(`最大${step.maxSelections}つまでです。いずれかを外してから選んでください。`);
          return;
        } else selected.add(option.id);
        state.reflectionIds = [...selected];
        state.resultTone = null;
        saveProgress();
        update();
      });
      return button;
    };

    const reflectionNumber = (option) => Number(/^R(\d{2})$/.exec(option.id)?.[1] || Number.MAX_SAFE_INTEGER);
    const orderedOptions = [...step.options].sort((left, right) => (
      reflectionNumber(left) - reflectionNumber(right)
      || String(left.id).localeCompare(String(right.id))
    ));
    grid.classList.add("is-flat");
    orderedOptions.forEach((option) => grid.append(createOptionButton(option)));

    proceed.addEventListener("click", (event) => {
      event.stopPropagation();
      state.resultTone = scoreReflection(state.reflectionIds);
      state.evesRoute = state.evesRoute.filter((entry) => entry.decisionId !== step.choiceId);
      state.evesRoute.push({
        decisionId: step.choiceId,
        value: state.reflectionIds.length ? "SELECTED" : "UNANSWERED",
        label: state.reflectionIds.length ? "観測姿勢を選ぶ" : "観測姿勢を選ばない",
        stepId: step.id,
      });
      state.evesRoute = state.evesRoute.slice(0, 2);
      saveProgress();
      renderEves();
      moveToFollowingStep(step);
    });
    const footer = document.createElement("footer");
    footer.append(status, proceed);
    shell.append(header, grid, footer);
    elements.reflectionSurface.append(shell);
    update();
    requestAnimationFrame(() => grid.querySelector("button")?.focus({ preventScroll: true }));
  };

  const detourDefinitions = Object.freeze({
    map01: {
      kicker: "MODE 01 / MAP",
      title: "年代の変化を続けて見る",
      guide: "1958年から2050年まで自動再生します。終了すると物語へ戻ります。",
    },
    gx: {
      kicker: "GX / DEEP TIME",
      title: "太古の海へ触れる",
      guide: "八つの時代を順にたどります。最後のGXを完了すると、自動で物語へ戻ります。",
    },
    map03: {
      kicker: "MODE 03 / MAP",
      title: "森と雨を、場所へ戻す",
      guide: "既存の地図を動かし、森林と降水量を別々に開いてから重ねてください。重なりだけで因果は決めません。",
    },
    abstract07: {
      kicker: "MODE 07 / ABSTRACT",
      title: "届いた時刻、開いた時刻",
      guide: "既存の抽象表示へ触れ、P波とS波の到着差を確認したあと、SOURCEとDERIVEDを別々に開いてください。",
    },
    map08: {
      kicker: "MODE 08 / MAP LAYERS",
      title: "同じ場所の三つの層",
      guide: "自然環境、人の暮らし、土地の記憶を一つずつ開いてください。数値のない欄も消しません。",
    },
    space10: {
      kicker: "MODE 10 / SPACE",
      title: "地球全体から見直す",
      guide: "既存の宇宙表示で視点または対象を一度操作し、ここまで触れた記録を地球規模へつないでください。",
    },
  });

  const detourCompletion = () => {
    if (!pendingInteraction) return false;
    switch (pendingInteraction.interaction.kind) {
      case "map01": return (pendingInteraction.interaction.requiredViews || [])
        .every((view) => detourState?.views?.has(view));
      case "gx": return state.viewed.gxDeepTime;
      case "map03": return state.viewed.mode03Forest && state.viewed.mode03Rain && state.viewed.mode03Overlay;
      case "abstract07": return state.viewed.mode07AbstractPoint && state.viewed.mode07Source && state.viewed.mode07Derived;
      case "map08": return state.viewed.mode08Nature && state.viewed.mode08Life && state.viewed.mode08Memory;
      case "space10": return state.viewed.mode10SpaceOverview;
      default: return false;
    }
  };

  const detourProgressText = () => {
    if (!pendingInteraction) return "";
    const kind = pendingInteraction.interaction.kind;
    if (kind === "map01") {
      if (pendingInteraction.interaction.phase === "temperature-anomaly") {
        const moved = detourState?.views?.has("long_term");
        const touched = detourState?.views?.has("temperature_anomaly");
        return `年代 ${moved ? "✓" : "○"}　地点 ${touched ? "✓" : "○"}`;
      }
      return detourState?.views?.has("timeline_complete") ? "自動再生が完了しました" : "年代を自動再生中";
    }
    if (kind === "gx") {
      if (state.viewed.gxDeepTime) return "全時代の観察が完了しました";
      return `時代 ${detourState?.phaseIndex || 1} / ${detourState?.phaseCount || 8}`;
    }
    if (kind === "map03") return `森林 ${state.viewed.mode03Forest ? "✓" : "○"}　降水量 ${state.viewed.mode03Rain ? "✓" : "○"}　重ね合わせ ${state.viewed.mode03Overlay ? "✓" : "○"}`;
    if (kind === "abstract07") return `観測点 ${state.viewed.mode07AbstractPoint ? "✓" : "○"}　SOURCE ${state.viewed.mode07Source ? "✓" : "○"}　DERIVED ${state.viewed.mode07Derived ? "✓" : "○"}`;
    if (kind === "map08") return `自然環境 ${state.viewed.mode08Nature ? "✓" : "○"}　人の暮らし ${state.viewed.mode08Life ? "✓" : "○"}　土地の記憶 ${state.viewed.mode08Memory ? "✓" : "○"}`;
    return state.viewed.mode10SpaceOverview ? "視点操作を確認しました" : "地球を回すか、対象へ触れてください";
  };

  const addDetourControl = (label, action, pressed) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(pressed));
    if (pressed) button.classList.add("is-complete");
    button.addEventListener("click", action);
    detourDock.querySelector(".story-detour-controls").append(button);
  };

  const updateDetourDock = () => {
    if (!pendingInteraction || !detourDock) return;
    const kind = pendingInteraction.interaction.kind;
    detourDock.querySelector(".story-detour-progress").textContent = detourProgressText();
    const returnButton = detourDock.querySelector("#story-detour-return");
    if (returnButton) returnButton.disabled = !detourCompletion();
    detourDock.querySelector(".story-detour-controls").replaceChildren();
    if (kind === "map03") {
      const controls = [
        ["森林を開く", "mode03Forest", "forest"],
        ["降水量を開く", "mode03Rain", "rain"],
        ["二つを重ねる", "mode03Overlay", "overlay"],
      ];
      controls.forEach(([label, key, layerName], index) => addDetourControl(label, () => {
        if (index === 2 && (!state.viewed.mode03Forest || !state.viewed.mode03Rain)) return;
        state.viewed[key] = true;
        window.dispatchEvent(new CustomEvent("gaia:story-mode-layer", { detail: { kind, layer: layerName } }));
        saveProgress();
        updateDetourDock();
      }, state.viewed[key]));
    } else if (kind === "abstract07") {
      addDetourControl("SOURCE｜受信 02:14", () => {
        state.viewed.mode07Source = true;
        saveProgress();
        updateDetourDock();
      }, state.viewed.mode07Source);
      addDetourControl("DERIVED｜開封 10:27 / P波→S波", () => {
        state.viewed.mode07Derived = true;
        saveProgress();
        updateDetourDock();
      }, state.viewed.mode07Derived);
    } else if (kind === "map08") {
      [
        ["自然環境", "mode08Nature", "nature"],
        ["人の暮らし", "mode08Life", "life"],
        ["土地の記憶", "mode08Memory", "memory"],
      ].forEach(([label, key, layerName]) => addDetourControl(label, () => {
        state.viewed[key] = true;
        window.dispatchEvent(new CustomEvent("gaia:story-mode-layer", { detail: { kind, layer: layerName } }));
        saveProgress();
        updateDetourDock();
      }, state.viewed[key]));
    }
  };

  const detourParent = (kind) => {
    if (kind === "gx") return document.querySelector("#gx-layer");
    if (kind === "space10") return document.querySelector("#space-layer");
    if (kind === "map01" || kind === "map03" || kind === "map08") return document.querySelector("#japan-layer");
    return document.querySelector(".experience");
  };

  const setInteractionLifecycle = (phase) => {
    interactionLifecycle = phase;
    const exclusive = phase === "open" || phase === "closing";
    const preservesStoryUnderlay = exclusive
      && ["gx", "map01"].includes(pendingInteraction?.interaction?.kind);
    if (phase === "idle") {
      delete layer.dataset.interactionState;
      delete document.body.dataset.novelInteractionState;
    } else {
      layer.dataset.interactionState = phase;
      document.body.dataset.novelInteractionState = phase;
    }
    document.body.classList.toggle("novel-interaction-exclusive", exclusive);
    layer.inert = exclusive;
    if (exclusive && !preservesStoryUnderlay) {
      layer.hidden = true;
      layer.setAttribute("aria-hidden", "true");
    } else if (isOpen) {
      layer.hidden = false;
      layer.setAttribute("aria-hidden", String(exclusive));
    }
  };

  const closeDetourDock = () => {
    detourDock?.remove();
    detourDock = null;
    document.body.classList.remove("novel-mode-detour");
    layer.classList.remove("is-mode-detour");
  };

  const requestDetourReturn = () => {
    if (!pendingInteraction || !detourCompletion()) return;
    window.clearTimeout(detourAutoReturnTimer);
    detourAutoReturnTimer = 0;
    const kind = pendingInteraction.interaction.kind;
    setInteractionLifecycle("closing");
    if (kind === "gx") window.GaiaGX?.close?.();
    else if (kind === "space10") window.GaiaSpace?.close?.({ returnToTop: false });
    else {
      window.dispatchEvent(new CustomEvent("gaia:story-mode-close", { detail: { kind } }));
    }
  };
  const markBeyondRead = (step) => {
    if (!step?.id || !beyondStepMap.has(step.id) || state.readStepIds.includes(step.id)) return;
    state.readStepIds.push(step.id);
    state.readStepIds = state.readStepIds.slice(-260);
    saveProgress();
    if (!elements.logPanel.hidden) renderLog();
  };

  const clearDetourSkipFallback = () => {
    window.clearTimeout(detourSkipFallbackTimer);
    detourSkipFallbackTimer = 0;
  };

  const storyMapModalSkip = () => document.querySelector("#story-map-modal-skip");
  document.addEventListener("click", (event) => {
    const control = event.target instanceof Element
      ? event.target.closest("#story-map-modal-skip")
      : null;
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    if (pendingInteraction?.interaction?.kind !== "map01" || interactionLifecycle !== "open") return;
    control.disabled = true;
    (pendingInteraction.interaction.requiredViews || []).forEach((view) => detourState?.views?.add(view));
    const skippedStepId = pendingInteraction.id;
    clearDetourSkipFallback();
    requestDetourReturn();
    detourSkipFallbackTimer = window.setTimeout(() => {
      detourSkipFallbackTimer = 0;
      if (pendingInteraction?.id !== skippedStepId || interactionLifecycle !== "closing") return;
      completePendingInteraction();
    }, 1100);
  });
  const openDetour = (step) => {
    if (pendingInteraction || interactionLifecycle !== "prep") return;
    window.clearTimeout(detourAutoReturnTimer);
    detourAutoReturnTimer = 0;
    clearDetourSkipFallback();
    pendingInteraction = step;
    detourState = { gestureCount: 0, phaseIndex: 1, phaseCount: 8, views: new Set() };
    const mapSkipControl = storyMapModalSkip();
    if (mapSkipControl) mapSkipControl.disabled = false;
    const definition = detourDefinitions[step.interaction.kind];
    closeDetourDock();
    if (!["map01", "gx"].includes(step.interaction.kind)) {
      detourDock = document.createElement("aside");
      detourDock.className = "story-detour-dock";
      detourDock.dataset.kind = step.interaction.kind;
      detourDock.innerHTML = `<header><span>${definition.kicker}</span><h2>${definition.title}</h2></header><p>${definition.guide}</p><p class="story-detour-progress" role="status" aria-live="polite"></p><div class="story-detour-controls"></div><button id="story-detour-return" type="button" disabled>操作を保存して物語へ戻る</button>`;
      detourDock.querySelector("#story-detour-return").addEventListener("click", requestDetourReturn);
      detourParent(step.interaction.kind)?.append(detourDock);
    }
    document.body.classList.add("novel-mode-detour");
    layer.classList.add("is-mode-detour");
    updateDetourDock();
    setInteractionLifecycle("open");
    const detail = {
      kind: step.interaction.kind,
      index: Number.isInteger(step.interaction.modeIndex) ? step.interaction.modeIndex : (currentScene()?.modeIndex || 0),
      modeId: step.interaction.modeId || null,
      phase: step.interaction.phase || null,
      returnTo: "novel",
      storyMode: `v${story.storyVersion}`,
      reducedMotion: motionReduced(),
    };
    if (step.interaction.kind === "gx") {
      window.dispatchEvent(new CustomEvent("gaia:gx-open", { detail: { ...detail, phase: 0 } }));
    } else if (step.interaction.kind === "space10") {
      window.dispatchEvent(new CustomEvent("gaia:space-open-at-mode", { detail }));
    } else {
      window.dispatchEvent(new CustomEvent("gaia:story-mode-open", { detail }));
    }
    requestAnimationFrame(() => detourDock?.querySelector(".story-detour-controls button, #story-detour-return")?.focus({ preventScroll: true }));
  };

  const completePendingInteraction = () => {
    if (!pendingInteraction || !detourCompletion()) return;
    window.clearTimeout(detourAutoReturnTimer);
    detourAutoReturnTimer = 0;
    clearDetourSkipFallback();
    const step = pendingInteraction;
    pendingInteraction = null;
    detourState = null;
    closeDetourDock();
    setInteractionLifecycle("idle");
    saveProgress();
    moveToFollowingStep(step);
    requestAnimationFrame(() => {
      if (!elements.dialogue.hidden) elements.dialogue.focus({ preventScroll: true });
    });
  };

  const renderInteraction = (step) => {
    prepareStepFrame(step);
    clearTimers();
    setCharacterPresentation("visitor");
    elements.speaker.textContent = "INTERACTIVE DISPLAY";
    elements.text.textContent = step.text;
    elements.cursor.hidden = true;
    elements.continueMark.classList.remove("is-visible");
    setInteractionLifecycle("prep");
    const autoOpenInteraction = ["gx", "map01"].includes(step.interaction?.kind);
    if (autoOpenInteraction) {
      requestAnimationFrame(() => {
        if (currentStep()?.id === step.id && interactionLifecycle === "prep" && !pendingInteraction) openDetour(step);
      });
      return;
    }
    const button = document.createElement("button");
    const isMode08Optional = step.type === "interaction"
      && step.interaction?.kind === "map08"
      && step.interaction?.optional === true;
    button.type = "button";
    button.className = "novel-interaction-open";
    button.textContent = isMode08Optional ? "表示モードを見る" : "既存の表示モードを開く";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openDetour(step);
    });
    elements.choices.append(button);
    if (isMode08Optional) {
      elements.choices.classList.add("is-mode08-optional");
      elements.choices.dataset.interactionKind = "map08";
      elements.choices.dataset.interactionOptional = "true";
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "novel-interaction-skip";
      skip.textContent = "選ばずに進む";
      skip.addEventListener("click", (event) => {
        event.stopPropagation();
        skip.disabled = true;
        moveToFollowingStep(step);
      }, { once: true });
      elements.choices.append(skip);
    }
    elements.choices.classList.add("is-visible");
    requestAnimationFrame(() => button.focus({ preventScroll: true }));
  };

  let activeTrueEndRuntime = null;
  const launchTrueEnd = ({ persistClear = true, onReady, deferInterfaceReveal = false } = {}) => {
    const persistProgress = persistClear && !debugJumpActive;
    if (persistProgress) {
      state.clear = true;
      state.archivesUnlocked = true;
      saveProgress();
    }
    activeTrueEndRuntime?.destroy?.();
    activeTrueEndRuntime = null;
    clearTimers();
    resetDialoguePagination();
    resetFastForward();
    closeSceneJump({ restoreFocus: false });
    setSceneJumpAvailability(false);
    hideSpecialSurfaces();
    elements.close.hidden = true;
    elements.home.hidden = true;
    suppressCharacterPresentation();
    elements.chapterCard.hidden = true;
    elements.dialogue.hidden = true;
    elements.choices.replaceChildren();
    elements.choices.classList.remove("is-visible", "is-mode08-optional");
    elements.sourceLabel.hidden = true;
    elements.resultSurface.hidden = false;
    elements.resultSurface.setAttribute("aria-label", "惑星の放課後 GAIA SENSATION APEIRONCENE");
    layer.classList.add("is-result", "is-true-end");
    layer.dataset.sceneId = TRUE_END_JUMP_ID;
    layer.dataset.stepType = "true-end";
    layer.dataset.storyAudioCue = "true-end-sensory-horizon";
    requestStoryTrack("trueend", 1.45);
    activeTrueEndRuntime = window.GaiaTrueEnd?.start?.({
      host: elements.resultSurface,
      layer,
      onStepRead: markBeyondRead,
      onLogOpen: () => openLog(),
      onReady: () => {
        if (persistProgress) window.GaiaTrueEnd?.markReached?.();
        onReady?.();
      },
      deferInterfaceReveal,
      persistProgress,
      onComplete: () => {
        if (!persistProgress) return;
        state.trueEndComplete = true;
        saveProgress();
        window.dispatchEvent(new CustomEvent("gaia:story-progression-change", {
          detail: { mainEndingComplete: true, apeironceneComplete: true },
        }));
      },
      onExit: () => {
        activeTrueEndRuntime?.destroy?.();
        activeTrueEndRuntime = null;
        closeNovelNow();
      },
    }) || null;
    if (activeTrueEndRuntime) return true;
    layer.classList.remove("is-true-end");
    requestStoryTrack("story", 1.1);
    return false;
  };

  const renderStaffRoll = (step) => {
    prepareStepFrame(step);
    clearTimers();
    resetFastForward();
    if (!debugJumpActive) {
      state.clear = true;
      state.archivesUnlocked = true;
      writeStorage(TRUE_END_PENDING_KEY, new Date().toISOString());
      saveProgress();
      window.dispatchEvent(new CustomEvent("gaia:story-progression-change", {
        detail: { mainEndingComplete: true, apeironceneComplete: false },
      }));
    }
    elements.close.hidden = true;
    elements.home.hidden = true;
    suppressCharacterPresentation();
    elements.dialogue.hidden = true;
    elements.sourceLabel.hidden = true;
    elements.resultSurface.hidden = false;
    elements.resultSurface.setAttribute("aria-label", "惑星の放課後 GAIA SENSATION スタッフロール");
    layer.classList.add("is-result", "is-staff-roll");
    layer.dataset.storyAudioCue = "ending-credits";
    requestStoryTrack("ending", 1.35);
    void window.GaiaOpeningAudio?.preloadTrack?.("trueend");
    const continueIntoData = (control) => {
      control.disabled = true;
      saveProgress();
      closeNovelNow();
    };

    const shell = document.createElement("section");
    shell.className = "novel-staff-roll";
    shell.tabIndex = 0;
    shell.setAttribute("role", "region");
    shell.setAttribute("aria-label", "エンディングスタッフロール。右上のスキップボタンでデータ画面へ進めます");
    shell.dataset.phase = motionReduced() ? "reduced" : "whiteout";

    const whiteout = document.createElement("div");
    whiteout.className = "novel-staff-roll-whiteout";
    whiteout.setAttribute("aria-hidden", "true");

    const dataSkip = document.createElement("button");
    dataSkip.type = "button";
    dataSkip.className = "novel-staff-roll-data-skip";
    dataSkip.textContent = "スキップ▶";
    dataSkip.title = "データを見てみる";
    dataSkip.setAttribute("aria-label", "エンディングをスキップして「データを見てみる」へ進む");
    dataSkip.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      continueIntoData(dataSkip);
    });

    const stage = document.createElement("div");
    stage.className = "novel-staff-roll-stage";
    const viewport = document.createElement("div");
    viewport.className = "novel-staff-roll-viewport";
    const track = document.createElement("div");
    track.className = "novel-staff-roll-track";

    const heading = document.createElement("header");
    heading.className = "novel-staff-roll-title";
    const title = document.createElement("h2");
    const titleLogo = document.createElement("img");
    title.className = "novel-staff-roll-title-accessible";
    title.textContent = "惑星の放課後 — GAIA SENSATION";
    titleLogo.className = "novel-staff-roll-title-logo";
    titleLogo.src = "./assets/brand/brand-logo-light-surface.png";
    titleLogo.width = 2172;
    titleLogo.height = 724;
    titleLogo.alt = "";
    titleLogo.setAttribute("aria-hidden", "true");
    titleLogo.decoding = "async";
    titleLogo.draggable = false;
    heading.append(title, titleLogo);

    const creditsHeading = document.createElement("p");
    creditsHeading.className = "novel-staff-roll-credits-heading";
    creditsHeading.textContent = "STAFF & CREDITS";

    const credits = document.createElement("dl");
    credits.className = "novel-staff-roll-credits";
    [
      { role: "企画・原案", department: "ORIGINAL CONCEPT & PLANNING", names: ["ひなひな"] },
      { role: "総合調整", department: "THE ARCHITECT", names: ["ひなひな"] },
      { role: "脚本", department: "SCENARIO", names: ["ひなひな"] },
      { role: "キャラクター原案", department: "CHARACTER CONCEPT", names: ["ひなひな"] },
      { role: "アートディレクター", department: "ART DIRECTOR", names: ["ひなひな"] },
      { role: "テクニカルディレクター", department: "TECHNICAL DIRECTOR", names: ["ひなひな"] },
      {
        role: "アシスタント",
        department: "ASSISTANT",
        names: [
          "OpenAI Codex (Code Implementation)",
          "OpenAI ImageGen (Visual Assets)",
          "Suno AI (Music Composition)",
        ],
      },
      {
        role: "音楽",
        department: "MUSIC",
        names: [
          { label: "オープニングテーマ", title: "『Planet Forecast - Hope』" },
          { label: "エンディングテーマ", title: "『AfterSchool, AfterGlow』" },
        ],
      },
      {
        role: "学術的着想",
        department: "ACADEMIC INSPIRATION",
        names: [
          "ZEN大学『共創地球論』",
          "ZEN大学『人新世の人類学』",
          "ZEN大学『リテラシーと応用のための物語理論』",
          "ZEN大学『統計学入門』",
          "ZEN大学『ビッグデータ分析概論』",
        ],
      },
      { role: "観測データ", department: "DATA SOURCES", names: ["NASA / NOAA / JAXA", "FAO / World Bank / Open-Meteo", "気象庁 / 環境省 / 総務省  ほか"] },
    ].forEach(({ role, department, names, note = "" }) => {
      const row = document.createElement("div");
      row.className = "novel-staff-roll-credit";
      row.dataset.creditRole = department;
      const term = document.createElement("dt");
      const roleLabel = document.createElement("span");
      const departmentLabel = document.createElement("small");
      const description = document.createElement("dd");
      roleLabel.className = "novel-staff-roll-credit-role";
      departmentLabel.className = "novel-staff-roll-credit-department";
      roleLabel.textContent = role;
      departmentLabel.textContent = department;
      term.append(roleLabel, departmentLabel);
      names.forEach((name) => {
        const creditName = document.createElement("span");
        creditName.className = "novel-staff-roll-credit-name";
        if (name && typeof name === "object") {
          creditName.classList.add("is-music-track");
          const trackLabel = document.createElement("span");
          const trackTitle = document.createElement("span");
          trackLabel.className = "novel-staff-roll-music-label";
          trackTitle.className = "novel-staff-roll-music-title";
          trackLabel.textContent = name.label;
          trackTitle.textContent = name.title;
          creditName.append(trackLabel, trackTitle);
        } else {
          creditName.textContent = name;
        }
        description.append(creditName);
      });
      if (note) {
        const creditNote = document.createElement("small");
        creditNote.className = "novel-staff-roll-credit-note";
        creditNote.textContent = note;
        description.append(creditNote);
      }
      const divider = document.createElement("span");
      divider.className = "novel-staff-roll-credit-divider";
      divider.setAttribute("aria-hidden", "true");
      row.append(term, description, divider);
      credits.append(row);
    });

    const closing = document.createElement("footer");
    closing.className = "novel-staff-roll-closing";
    const closingLead = document.createElement("p");
    const closingLine = document.createElement("strong");
    const closingCopyright = document.createElement("small");
    const closingAction = document.createElement("div");
    const closingMark = document.createElement("span");
    closingAction.className = "novel-staff-roll-closing-action";
    closingMark.className = "novel-staff-roll-closing-mark";
    closingLead.textContent = "その選択の中に、今日から私たちもいる。";
    closingLine.textContent = "物語は、ここからも続いていく。";
    closingCopyright.textContent = "© 2026 惑星の放課後 / GAIA SENSATION";
    "Thank you for playing".split(" ").forEach((word, index) => {
      if (index) closingMark.append(" ");
      const part = document.createElement("span");
      part.className = "novel-staff-roll-closing-word";
      part.style.setProperty("--thank-you-word-delay", `${150 + index * 110}ms`);
      part.textContent = word;
      closingMark.append(part);
    });
    closingAction.append(closingMark, closingCopyright);
    closing.append(closingLead, closingLine, closingAction);

    const finale = document.createElement("div");
    finale.className = "novel-staff-roll-finale";
    finale.hidden = true;
    finale.setAttribute("aria-hidden", "true");
    const next = document.createElement("button");
    next.type = "button";
    next.tabIndex = -1;
    next.textContent = "世界の続きを紡ぐ";
    next.setAttribute("aria-label", "スタッフロールを終えてAPEIRONCENEへ進む");
    const continueIntoTrueEnd = (control) => {
      if (shell.dataset.phase === "departing") return;
      control.disabled = true;
      dataSkip.disabled = true;
      shell.dataset.phase = "departing";
      if (!motionReduced()) window.GaiaEndingGlitch?.randomize(layer);
      shell.classList.add("is-departing");
      layer.classList.add("is-true-end-transitioning");
      layer.dataset.trueEndTransitionPhase = "covering";

      const veil = document.createElement("div");
      veil.className = "novel-staff-roll-transition-veil";
      veil.setAttribute("aria-hidden", "true");
      if (!motionReduced()) {
        const noise = document.createElement("div");
        noise.className = "novel-staff-roll-transition-noise";
        veil.append(noise);
      }
      layer.append(veil);

      const finishTransition = () => {
        veil.remove();
        layer.classList.remove("is-true-end-transitioning");
        layer.dataset.trueEndTransitionPhase = "complete";
      };
      const completeTrueEndEntry = () => {
        finishTransition();
        activeTrueEndRuntime?.revealEntry?.();
      };
      const holdFullBackground = () => {
        veil.remove();
        layer.dataset.trueEndTransitionPhase = "background";
        staffRollFinaleTimer = window.setTimeout(() => {
          staffRollFinaleTimer = 0;
          completeTrueEndEntry();
        }, STAFF_ROLL_ENTRY_BACKGROUND_HOLD_MS);
      };
      const revealTrueEnd = () => {
        if (!veil.isConnected) return;
        layer.dataset.trueEndTransitionPhase = "revealing";
        if (motionReduced()) {
          completeTrueEndEntry();
          return;
        }
        veil.classList.remove("is-covering", "is-holding");
        window.GaiaEndingGlitch?.randomize(veil);
        veil.classList.add("is-revealing");
        staffRollFinaleTimer = window.setTimeout(() => {
          staffRollFinaleTimer = 0;
          holdFullBackground();
        }, STAFF_ROLL_EXIT_REVEAL_MS);
      };
      const switchToTrueEnd = () => {
        staffRollFinaleTimer = 0;
        layer.dataset.trueEndTransitionPhase = "switching";
        const launched = launchTrueEnd({ onReady: revealTrueEnd, deferInterfaceReveal: true });
        if (launched) return;
        veil.remove();
        layer.classList.remove("is-true-end-transitioning");
        delete layer.dataset.trueEndTransitionPhase;
        continueIntoData(control);
      };
      const holdBeforeTrueEnd = () => {
        staffRollFinaleTimer = 0;
        layer.dataset.trueEndTransitionPhase = "holding";
        veil.classList.add("is-holding");
        staffRollFinaleTimer = window.setTimeout(switchToTrueEnd, STAFF_ROLL_EXIT_HOLD_MS);
      };

      if (motionReduced()) {
        switchToTrueEnd();
        return;
      }
      requestAnimationFrame(() => veil.classList.add("is-covering"));
      staffRollFinaleTimer = window.setTimeout(holdBeforeTrueEnd, STAFF_ROLL_EXIT_COVER_MS);
    };
    next.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      continueIntoTrueEnd(next);
    });
    finale.append(next);
    closingAction.append(finale);

    // The title is a stationary introduction, not part of the moving credits.
    // Reduced motion keeps one readable, manually scrollable document instead.
    if (motionReduced()) track.append(heading);
    track.append(creditsHeading, credits, closing);
    viewport.append(track);
    stage.append(viewport);
    if (!motionReduced()) stage.append(heading);
    shell.append(whiteout, stage, dataSkip);
    elements.resultSurface.append(shell);

    let endingReached = false;
    let completed = false;
    const revealFinalAction = ({ focus = true } = {}) => {
      if (completed) return;
      completed = true;
      shell.dataset.phase = "complete";
      shell.classList.add("is-complete");
      finale.hidden = false;
      finale.setAttribute("aria-hidden", "false");
      closingMark.setAttribute("aria-hidden", "true");
      next.tabIndex = 0;
      if (focus) requestAnimationFrame(() => next.focus({ preventScroll: true }));
    };

    const beginFinalActionTransition = ({ focus = true } = {}) => {
      shell.dataset.phase = "finalizing";
      shell.classList.add("is-finalizing");
      staffRollFinaleTimer = window.setTimeout(() => {
        staffRollFinaleTimer = 0;
        revealFinalAction({ focus });
      }, STAFF_ROLL_FINALIZE_MS);
    };

    const holdOnEnd = ({ delay = true, focus = true } = {}) => {
      if (endingReached) return;
      endingReached = true;
      shell.dataset.phase = delay ? "end-hold" : "complete";
      shell.classList.add("is-at-end");
      if (!delay) {
        revealFinalAction({ focus });
        return;
      }
      staffRollFinaleTimer = window.setTimeout(() => {
        staffRollFinaleTimer = 0;
        shell.dataset.phase = "thank-you";
        shell.classList.add("is-thank-you-visible");
        staffRollFinaleTimer = window.setTimeout(() => {
          staffRollFinaleTimer = 0;
          beginFinalActionTransition({ focus });
        }, STAFF_ROLL_THANK_YOU_HOLD_MS);
      }, STAFF_ROLL_THANK_YOU_DELAY_MS);
    };

    track.addEventListener("animationend", (event) => {
      if (event.animationName === "novel-staff-roll-rise") holdOnEnd();
    });
    whiteout.addEventListener("animationend", (event) => {
      if (event.animationName === "novel-staff-roll-whiteout" && !endingReached && shell.dataset.phase === "whiteout") shell.dataset.phase = "title";
    });
    heading.addEventListener("animationend", (event) => {
      if (event.animationName === "novel-staff-roll-title-focus" && !endingReached && shell.dataset.phase !== "departing") shell.dataset.phase = "rolling";
    });
    shell.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      event.stopPropagation();
    });
    shell.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      event.preventDefault();
      event.stopPropagation();
    });

    if (motionReduced()) {
      shell.classList.add("is-reduced-motion");
      whiteout.hidden = true;
      holdOnEnd({ delay: false, focus: false });
    }
    requestAnimationFrame(() => shell.focus({ preventScroll: true }));
  };

  const renderResult = (step) => {
    prepareStepFrame(step);
    clearTimers();
    state.resultTone = state.resultTone || scoreReflection(state.reflectionIds);
    saveProgress();
    elements.dialogue.hidden = true;
    elements.sourceLabel.hidden = true;
    elements.resultSurface.hidden = false;
    layer.classList.add("is-result");
    const result = document.createElement("div");
    result.className = `novel-result-shell is-${state.resultTone.toLowerCase()}`;
    const content = document.createElement("article");
    const eyebrow = document.createElement("span");
    const heading = document.createElement("h2");
    const copy = document.createElement("p");
    const next = document.createElement("button");
    eyebrow.textContent = "THE RECORD REMAINS OPEN";
    heading.textContent = "地球は答えず、次の観測を待つ。";
    copy.textContent = story.resultCopy[state.resultTone];
    next.type = "button";
    next.textContent = "記録を閉じる";
    next.addEventListener("click", () => moveToFollowingStep(step));
    content.append(eyebrow, heading, copy, next);
    result.append(content);
    elements.resultSurface.append(result);
    requestAnimationFrame(() => next.focus({ preventScroll: true }));
  };

  const renderEnd = () => {
    clearTimers();
    if (!debugJumpActive) {
      state.clear = true;
      state.archivesUnlocked = true;
      saveProgress();
    }
    requestStoryTrack("story", 1.1);
    closeNovelNow();
  };

  function renderCurrentStep() {
    clearSectionEntry();
    clearTimers();
    closeLog();
    let step = currentStep();
    let guard = 0;
    while (step && (!conditionMatches(step) || ["phase", "chatSurface"].includes(step.type)) && guard < allSteps.length) {
      state.stepId = getFollowingStepId(step);
      step = currentStep();
      guard += 1;
    }
    if (!step) {
      clearScriptDebug();
      return;
    }
    syncScriptDebug(step);
    if (!canAdvanceStep(step) && fastForwardEnabled()) stopFastForwardAtBarrier();
    saveProgress();
    window.dispatchEvent(new CustomEvent("gaia:novel-step-rendered", {
      detail: { stepId: step.id, type: step.type },
    }));
    if (step.id === "welcome_chat_095") return renderStaffRoll(step);
    if (["narration", "dialogue"].includes(step.type)) return renderSimpleStep(step);
    if (["chat", "record", "ui", "transition"].includes(step.type)) return renderRichStep(step);
    if (step.type === "details") return renderGenerationDetails(step);
    if (step.type === "choice") return renderChoice(step);
    if (step.type === "reflectionChoice") return renderReflectionChoice(step);
    if (step.type === "interaction") return renderInteraction(step);
    if (step.type === "result") return renderResult(step);
    if (step.type === "end") return renderEnd(step);
    return renderSimpleStep(step);
  }

  const canAdvanceStep = (step) => ["narration", "dialogue", "chat", "record", "ui", "transition", "details"].includes(step?.type);
  const endingPresentationActive = () => layer.classList.contains("is-staff-roll")
    || layer.classList.contains("is-true-end-transitioning")
    || layer.classList.contains("is-true-end");
  const progressionPanelsClosed = () => [elements.logPanel, elements.savePanel, elements.configPanel, elements.evesPanel, elements.jumpPanel]
    .concat(elements.galleryPanel ? [elements.galleryPanel] : [])
    .every((panel) => panel.hidden);

  const updateFastForwardInterface = () => {
    const active = !fastForwardState.blocked && (fastForwardState.keyActive || fastForwardState.buttonActive);
    elements.fastForward?.setAttribute("aria-pressed", String(fastForwardState.buttonActive));
    elements.fastForward?.classList.toggle("is-active", active);
    elements.fastForward?.classList.toggle("is-control-held", active && fastForwardState.keyActive);
    if (elements.fastForwardLabel) elements.fastForwardLabel.textContent = active ? "早送り中" : "早送り";
    layer.classList.toggle("is-fast-forwarding", active);
  };

  const disableAutoForFastForward = () => {
    elements.auto.setAttribute("aria-pressed", "false");
    elements.auto.classList.remove("is-active");
    window.clearTimeout(autoTimer);
    autoTimer = 0;
  };

  const clearFastForwardTimer = () => {
    window.clearTimeout(fastForwardState.timer);
    fastForwardState.timer = 0;
  };

  const clearFastForwardHoldTimer = () => {
    window.clearTimeout(fastForwardState.holdTimer);
    fastForwardState.holdTimer = 0;
  };

  const resetFastForward = () => {
    clearFastForwardTimer();
    clearFastForwardHoldTimer();
    Object.assign(fastForwardState, {
      controlDown: false,
      keyActive: false,
      buttonActive: false,
      blocked: false,
    });
    updateFastForwardInterface();
  };

  const stopFastForwardAtBarrier = () => {
    clearFastForwardTimer();
    fastForwardState.buttonActive = false;
    fastForwardState.blocked = true;
    updateFastForwardInterface();
  };

  const fastForwardEnabled = () => !fastForwardState.blocked && (fastForwardState.keyActive || fastForwardState.buttonActive);

  const scheduleFastForward = (delay = FAST_FORWARD_STEP_MS) => {
    clearFastForwardTimer();
    if (!fastForwardEnabled()) return;
    if (endingPresentationActive()) {
      stopFastForwardAtBarrier();
      return;
    }
    fastForwardState.timer = window.setTimeout(() => {
      fastForwardState.timer = 0;
      if (!fastForwardEnabled()) return;
      if (endingPresentationActive()) {
        stopFastForwardAtBarrier();
        return;
      }
      if (backgroundTransitionPending) {
        scheduleFastForward();
        return;
      }
      if (!isOpen || !hasStarted || pendingInteraction || !progressionPanelsClosed()) {
        stopFastForwardAtBarrier();
        return;
      }
      if (!canAdvanceStep(currentStep())) {
        stopFastForwardAtBarrier();
        return;
      }
      advance();
      scheduleFastForward();
    }, delay);
  };

  const endControlFastForward = (event) => {
    if (event?.key && event.key !== "Control") return;
    fastForwardState.controlDown = false;
    clearFastForwardHoldTimer();
    fastForwardState.keyActive = false;
    fastForwardState.blocked = false;
    if (!fastForwardState.buttonActive) clearFastForwardTimer();
    updateFastForwardInterface();
  };

  const beginControlFastForward = (event) => {
    if (event.key !== "Control" || event.repeat || fastForwardState.controlDown || !isOpen || !hasStarted || endingPresentationActive()) return;
    if (event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
    fastForwardState.controlDown = true;
    clearFastForwardHoldTimer();
    fastForwardState.holdTimer = window.setTimeout(() => {
      fastForwardState.holdTimer = 0;
      if (!fastForwardState.controlDown || !isOpen || !hasStarted || endingPresentationActive()) return;
      fastForwardState.blocked = false;
      fastForwardState.keyActive = true;
      disableAutoForFastForward();
      updateFastForwardInterface();
      scheduleFastForward(0);
    }, FAST_FORWARD_HOLD_DELAY_MS);
  };

  const handleFastForwardKeyDown = (event) => {
    if (event.key === "Control") {
      beginControlFastForward(event);
      return;
    }
    if (event.ctrlKey && (fastForwardState.controlDown || fastForwardState.keyActive)) endControlFastForward();
  };

  const isVisibleKeyboardControl = (target) => {
    const control = target?.closest?.("button, a, input, select, textarea, summary, [role='button'], [contenteditable='true']");
    if (!control || control.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    const style = getComputedStyle(control);
    return style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity || 1) > 0
      && control.getClientRects().length > 0;
  };

  const handleDocumentDialogueEnter = (event) => {
    if (event.key !== "Enter" || event.repeat || event.isComposing || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!isOpen || !hasStarted || pendingInteraction || backgroundTransitionPending || !progressionPanelsClosed()) return;
    if (layer.contains(event.target) || isVisibleKeyboardControl(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    advance();
  };

  function advance() {
    if (!isOpen || !hasStarted || pendingInteraction || backgroundTransitionPending || sectionEntryTimer || endingPresentationActive()) return;
    if (!progressionPanelsClosed()) return;
    if (finishSectionSeparator()) return;
    if (finishTemporalTransitionCard()) return;
    const step = currentStep();
    if (!canAdvanceStep(step)) return;
    if (isRevealing) {
      finishReveal();
      return;
    }
    if (["narration", "dialogue"].includes(step.type) && advanceDialoguePage()) return;
    moveToFollowingStep(step);
  }

  function scheduleAutoAdvance() {
    window.clearTimeout(autoTimer);
    if (sectionEntryTimer) return;
    if (elements.auto.getAttribute("aria-pressed") !== "true" || !canAdvanceStep(currentStep())) return;
    autoTimer = window.setTimeout(advance, AUTO_DELAY_MS);
  }

  const startNewSession = async ({ transition = true, skipSeparator = false } = {}) => {
    exitDebugJumpSession();
    state = defaultState();
    state.sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await revealRuntimeForStep(currentStep(), () => {
      renderEves();
      saveProgress();
      if (skipSeparator) renderCurrentStep();
      else renderSectionSeparator();
    }, { transition });
  };

  const resumeStoredSession = async () => {
    const stored = getStoredProgress();
    if (!stored || getManualSaves().some(Boolean)) {
      openManualArchive("load");
      return;
    }
    exitDebugJumpSession();
    state = stored;
    await revealRuntimeForStep(currentStep(), () => {
      renderEves();
      saveProgress();
      renderCurrentStep();
    });
  };

  const resumeWithoutTitle = async ({ transition = false } = {}) => {
    const stored = getStoredProgress();
    const latestManual = getManualSaves()
      .filter(Boolean)
      .sort((left, right) => right.savedAt - left.savedAt)[0]?.progress || null;
    const progress = stored || latestManual;
    if (!progress) {
      await startNewSession({ transition });
      return;
    }
    exitDebugJumpSession();
    state = progress;
    await revealRuntimeForStep(currentStep(), () => {
      renderEves();
      saveProgress();
      renderCurrentStep();
    });
  };

  const restartStory = async () => {
    exitDebugJumpSession();
    const sessionId = state.sessionId || `${Date.now().toString(36)}-restart`;
    state = defaultState();
    state.sessionId = sessionId;
    resetFastForward();
    closeConfig();
    await revealRuntimeForStep(currentStep(), () => {
      showRuntime();
      renderEves();
      saveProgress();
      renderSectionSeparator();
    }, { transition: true });
  };

  const jumpToSceneStart = (sceneId, event = null) => {
    if (sceneJumpTransitionPending) return false;
    const entry = sceneJumpEntries.find((candidate) => candidate.sceneId === sceneId);
    const target = entry?.isTrueEnd ? null : stepMap.get(entry?.firstStepId);
    if (!entry || (!entry.isTrueEnd && !target)) {
      console.error(`[GAIA novel] Unknown debug scene jump target: ${String(sceneId)}`);
      return false;
    }
    closeSceneJump({ restoreFocus: false });
    sceneJumpTransitionPending = true;
    const commitJump = () => {
      const detourKind = pendingInteraction?.interaction?.kind;
      pendingInteraction = null;
      detourState = null;
      closeDetourDock();
      setInteractionLifecycle("idle");
      if (detourKind === "gx") window.GaiaGX?.close?.();
      else if (detourKind === "space10") window.GaiaSpace?.close?.({ returnToTop: false });
      else if (detourKind) window.dispatchEvent(new CustomEvent("gaia:story-mode-close", { detail: { kind: detourKind } }));
      resetFastForward();
      elements.auto.setAttribute("aria-pressed", "false");
      elements.auto.classList.remove("is-active");
      closeLog();
      closeManualArchive();
      closeConfig();
      closeEves();
      hideSpecialSurfaces();
      clearTimers();
      window.clearTimeout(slackTransitionTimer);
      slackTransitionTimer = 0;
      layer.classList.remove("is-slack-entering", "is-slack-exiting");
      if (entry.isTrueEnd) {
        const previousClear = state.clear;
        const previousArchivesUnlocked = state.archivesUnlocked;
        debugJumpActive = true;
        if (launchTrueEnd({ persistClear: false })) return true;
        state.clear = previousClear;
        state.archivesUnlocked = previousArchivesUnlocked;
        debugJumpActive = false;
        showRuntime();
        renderCurrentStep();
        return false;
      }
      const targetIndex = stepIndexMap.get(target.id);
      const priorReadableSteps = allSteps
        .slice(Math.max(0, targetIndex - 260), targetIndex)
        .filter((step) => step.text && !["choice", "reflectionChoice", "interaction", "result", "end"].includes(step.type))
        .map((step) => step.id);
      state = {
        ...state,
        stepId: target.id,
        reachedSceneIds: sceneJumpEntries
          .filter((candidate) => !candidate.isEnding && !candidate.isTrueEnd && stepIndexMap.get(candidate.firstStepId) <= targetIndex)
          .map((candidate) => candidate.sceneId),
        readStepIds: priorReadableSteps,
        metCharacters: Object.fromEntries(Object.entries(CHAT_CAST_MEETING_GATES).map(([speaker, gate]) => [
          speaker,
          targetIndex >= (stepIndexMap.get(gate.visibleFrom) ?? Number.POSITIVE_INFINITY),
        ])),
      };
      debugJumpActive = true;
      showRuntime();
      renderEves();
      applyBackgroundCueForStep(target);
      if (entry.isEnding) renderCurrentStep();
      else renderSectionSeparator(target);
      return true;
    };
    Promise.resolve(runSceneTransition(commitJump, event)).finally(() => {
      sceneJumpTransitionPending = false;
    });
    return true;
  };

  const logStepText = (step) => String(step?.text || "");
  const scriptStepText = (step) => {
    const text = logStepText(step).trim();
    if (text) return text;
    if (step?.interaction) {
      const interaction = step.interaction;
      const details = [
        interaction.kind ? `${translate("展示操作")} ${String(interaction.kind).toUpperCase()}` : translate("展示操作"),
        interaction.modeId ? `MODE ${interaction.modeId}` : "",
        interaction.phase ? `PHASE ${interaction.phase}` : "",
        Array.isArray(interaction.requiredViews) && interaction.requiredViews.length
          ? `REQUIRED ${interaction.requiredViews.join(", ")}`
          : "",
        Number.isFinite(interaction.requiredGestures) ? `GESTURES ${interaction.requiredGestures}` : "",
      ].filter(Boolean);
      return `[${details.join(" / ")}]`;
    }
    return `[${String(step?.type || "step").toUpperCase()} / ${translate("本文なし")}]`;
  };
  const scriptStepMetadata = (step) => {
    const metadataKeys = ["time", "displayTime", "expression", "cueFromStepId", "interaction", "attachments", "readout", "pages"];
    return Object.fromEntries(metadataKeys
      .filter((key) => step?.[key] !== undefined)
      .map((key) => [key, step[key]]));
  };
  const commentedLogEntries = () => logSteps
    .filter((step) => typeof logComments[step.id] === "string" && logComments[step.id].trim())
    .map((step) => ({ step, comment: logComments[step.id].trim() }));
  const setLogStatus = (message, stateName = "") => {
    elements.logStatus.textContent = message;
    if (stateName) elements.logStatus.dataset.state = stateName;
    else delete elements.logStatus.dataset.state;
  };
  const syncLogCommentSummary = () => {
    const count = commentedLogEntries().length;
    const commentsHidden = logView !== "heard";
    elements.logCommentCount.textContent = `コメント ${count}件`;
    elements.logCommentCount.hidden = commentsHidden;
    elements.logDeleteAll.hidden = commentsHidden || count === 0;
    elements.logDeleteAll.disabled = count === 0;
    elements.logDeleteAll.setAttribute("aria-label", `コメント済み${count}件をすべて削除`);
    elements.logExport.disabled = false;
    elements.logExport.hidden = commentsHidden;
    elements.logExport.setAttribute("aria-label", `コメント済み${count}件をCodex用Markdownで出力`);
    elements.logScriptExport.disabled = false;
    elements.logScriptExport.setAttribute("aria-label", `未読とAPEIRONCENEを含む全台本${scriptArchiveStepCount}stepをMarkdownで出力`);
  };
  const markdownBlockquote = (value) => String(value).split("\n").map((line) => `> ${line}`).join("\n");
  const buildFullScriptMarkdown = () => {
    const sections = scriptArchiveSections.map((section) => {
      const steps = section.steps.map((step, index) => {
        const speaker = translate(speakerDisplayName(step) || (step.speaker === "narrator" || !step.speaker ? "地の文" : "SYSTEM"));
        const metadata = scriptStepMetadata(step);
        const metadataBlock = Object.keys(metadata).length
          ? ["", `#### ${translate("演出メタデータ")}`, "", "```json", JSON.stringify(metadata, null, 2), "```"].join("\n")
          : "";
        return [
          `### ${String(index + 1).padStart(3, "0")} / \`${step.id}\``,
          "",
          `- ${translate("話者")}: ${speaker}`,
          `- ${translate("種別")}: ${step.recordType || step.type || "step"}`,
          "",
          markdownBlockquote(scriptStepText(step)),
          metadataBlock,
        ].join("\n");
      }).join("\n\n---\n\n");
      return [
        `## ${section.eyebrow}｜${section.title}`,
        "",
        `- ${translate("区分")}: ${section.source === "apeironcene" ? "TRUE END / APEIRONCENE" : "MAIN STORY"}`,
        `- ${translate("step数")}: ${section.steps.length}`,
        "",
        steps,
      ].join("\n");
    }).join("\n\n---\n\n");
    return [
      `# ${translate("『惑星の放課後 ～GAIA SENSATION～』全台本")}`,
      "",
      translate("Log画面から出力した、表示進捗に左右されない現行実行データの全台本です。未読stepとTRUE END『APEIRONCENE』を含みます。"),
      "",
      `- ${translate("出力日時")}: ${new Date().toISOString()}`,
      `- ${translate("本編")}: ${allSteps.length} step`,
      `- APEIRONCENE: ${beyondSteps.length} step`,
      `- ${translate("合計")}: ${scriptArchiveStepCount} step`,
      `- ${translate("本編バージョン")}: ${story.storyVersion}`,
      `- ${translate("TRUE ENDバージョン")}: ${trueEndStory?.storyVersion || "unknown"}`,
      "",
      sections,
      "",
    ].join("\n");
  };
  const downloadLogMarkdown = (markdown, filename) => {
    const blob = new Blob(["\uFEFF", markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const buildLogCommentMarkdown = () => {
    const entries = commentedLogEntries();
    const sections = entries.map(({ step, comment }, index) => [
      `## ${index + 1}. \`${step.id}\``,
      "",
      `- LOG ID: \`${step.id}\``,
      `- ${translate("話者")}: ${translate(speakerDisplayName(step) || step.type.toUpperCase())}`,
      "",
      `### ${translate("現在の本文")}`,
      "",
      markdownBlockquote(logStepText(step)),
      "",
      `### ${translate("修正指示")}`,
      "",
      comment,
    ].join("\n"));
    return [
      `# ${translate("GAIA SENSEWARE Codex修正指示")}`,
      "",
      translate("以下はOBSERVATION LOGで指定したstep別の修正指示です。各LOG IDの現在の本文を確認し、修正指示を反映してください。"),
      "",
      `- ${translate("出力日時")}: ${new Date().toISOString()}`,
      `- ${translate("対象件数")}: ${entries.length}`,
      "",
      sections.join("\n\n---\n\n"),
      "",
    ].join("\n");
  };
  const exportLogComments = () => {
    const entries = commentedLogEntries();
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    downloadLogMarkdown(buildLogCommentMarkdown(), `gaia-codex-log-comments-${stamp}.md`);
    setLogStatus(`${entries.length}件を書き出しました`, "success");
    return true;
  };
  const exportFullScript = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    downloadLogMarkdown(buildFullScriptMarkdown(), `gaia-senseware-complete-script-${stamp}.md`);
    setLogStatus(`全台本 ${scriptArchiveStepCount}stepを書き出しました`, "success");
    return true;
  };
  const deleteAllLogComments = () => {
    const entries = commentedLogEntries();
    if (!entries.length) return false;
    const ids = entries.map(({ step }) => step.id);
    const confirmed = window.confirm([
      translate("{count}件のコメントをすべて削除しますか？", { count: entries.length }),
      `${translate("対象step")}: ${ids.join("、")}`,
      translate("本文・step IDは変更されません。"),
    ].join("\n"));
    if (!confirmed) {
      setLogStatus(`${entries.length}件のコメント全削除をキャンセルしました`);
      return false;
    }
    const previous = logComments;
    logComments = {};
    if (!persistLogComments()) {
      logComments = previous;
      setLogStatus("コメントを全削除できませんでした", "error");
      return false;
    }
    renderLog();
    setLogStatus(`${entries.length}件のコメントをすべて削除しました`, "success");
    return true;
  };
  const renderHeardLog = () => {
    elements.logContent.replaceChildren();
    state.readStepIds.forEach((id) => {
      const step = logStepMap.get(id);
      if (!step?.text) return;
      const article = document.createElement("article");
      const entryHeader = document.createElement("div");
      const header = document.createElement("p");
      const actions = document.createElement("div");
      const copyId = document.createElement("button");
      const copyEntry = document.createElement("button");
      const deleteComment = document.createElement("button");
      const text = document.createElement("p");
      const commentField = document.createElement("label");
      const commentLabel = document.createElement("span");
      const comment = document.createElement("textarea");
      const speaker = speakerDisplayName(step) || step.type.toUpperCase();
      const displayText = logStepText(step);
      article.dataset.stepId = id;
      article.dataset.kind = step.recordType || "SOURCE";
      article.dataset.speaker = step.speaker || "system";
      article.classList.toggle("has-comment", logDebugMode && Boolean(logComments[id]?.trim()));
      entryHeader.className = "novel-log-entry-header";
      header.className = "novel-log-entry-meta";
      header.textContent = `${speaker || "観測記録"} / ${RECORD_LABELS[step.recordType] || step.type}${logDebugMode ? " / " : ""}`;
      const visibleId = document.createElement("code");
      visibleId.className = "novel-log-entry-id";
      visibleId.textContent = id;
      header.append(visibleId);
      actions.className = "novel-log-entry-actions";
      copyId.type = "button";
      copyId.className = "novel-log-copy";
      copyId.textContent = "IDをコピー";
      copyId.setAttribute("aria-label", `${id}のLOG IDをコピー`);
      copyEntry.type = "button";
      copyEntry.className = "novel-log-copy";
      copyEntry.textContent = "ID＋本文";
      copyEntry.setAttribute("aria-label", `${id}のLOG IDと本文をコピー`);
      deleteComment.type = "button";
      deleteComment.className = "novel-log-delete";
      deleteComment.textContent = "コメントを削除";
      deleteComment.setAttribute("aria-label", `${id}のコメントを削除`);
      deleteComment.hidden = !Boolean(logComments[id]?.trim());
      copyId.addEventListener("click", async () => {
        const copied = await writeClipboardText(id);
        setLogStatus(copied ? `${id} のIDをコピーしました` : "コピーできませんでした", copied ? "success" : "error");
      });
      copyEntry.addEventListener("click", async () => {
        const copied = await writeClipboardText(`${id}\n${displayText}`);
        setLogStatus(copied ? `${id} のIDと本文をコピーしました` : "コピーできませんでした", copied ? "success" : "error");
      });
      deleteComment.addEventListener("click", () => {
        const previous = logComments[id];
        if (typeof previous !== "string" || !previous.trim()) return;
        const confirmed = window.confirm([
          translate("{id} のコメントを削除しますか？", { id }),
          translate("本文・step ID・ほかのコメントは変更されません。"),
        ].join("\n"));
        if (!confirmed) {
          setLogStatus(`${id} のコメント削除をキャンセルしました`);
          return;
        }
        delete logComments[id];
        if (!persistLogComments()) {
          logComments[id] = previous;
          setLogStatus("コメントを削除できませんでした", "error");
          return;
        }
        comment.value = "";
        article.classList.remove("has-comment");
        deleteComment.hidden = true;
        syncLogCommentSummary();
        setLogStatus(`${id} のコメントを削除しました`, "success");
      });
      actions.append(copyId, copyEntry, deleteComment);
      entryHeader.append(header, actions);
      text.className = "novel-log-entry-text";
      text.textContent = displayText;
      commentField.className = "novel-log-comment-field";
      commentLabel.textContent = "このstepへの修正指示";
      comment.rows = 3;
      comment.value = logComments[id] || "";
      comment.dataset.stepId = id;
      comment.placeholder = "例：語尾を短くする／背景との整合を確認する";
      comment.setAttribute("aria-label", `${id}への修正コメント`);
      comment.addEventListener("input", () => {
        const value = comment.value;
        if (value.trim()) logComments[id] = value;
        else delete logComments[id];
        article.classList.toggle("has-comment", Boolean(value.trim()));
        deleteComment.hidden = !Boolean(value.trim());
        const persisted = persistLogComments();
        syncLogCommentSummary();
        setLogStatus(persisted ? `${id} のコメントを保存しました` : "コメントを保存できませんでした", persisted ? "success" : "error");
      });
      commentField.append(commentLabel, comment);
      article.append(entryHeader, text, commentField);
      elements.logContent.append(article);
    });
    syncLogCommentSummary();
  };
  const renderScriptArchive = () => {
    const fragment = document.createDocumentFragment();
    const readStepIds = new Set(state.readStepIds);
    elements.logContent.replaceChildren();
    scriptArchiveSections.forEach((section, sectionIndex) => {
      const sectionElement = document.createElement("section");
      const sectionHeader = document.createElement("div");
      const sectionHeading = document.createElement("div");
      const eyebrow = document.createElement("span");
      const title = document.createElement("h2");
      const summary = document.createElement("p");
      const headingId = `novel-script-section-${sectionIndex + 1}`;
      const readCount = section.steps.filter((step) => readStepIds.has(step.id)).length;
      sectionElement.className = "novel-script-section";
      sectionElement.dataset.source = section.source;
      sectionElement.setAttribute("aria-labelledby", headingId);
      sectionHeader.className = "novel-script-section-header";
      sectionHeading.className = "novel-script-section-heading";
      eyebrow.textContent = section.eyebrow;
      title.id = headingId;
      title.textContent = section.title;
      summary.textContent = `${section.steps.length} STEP / 既読 ${readCount} / 未読 ${section.steps.length - readCount}`;
      sectionHeading.append(eyebrow, title);
      sectionHeader.append(sectionHeading, summary);
      sectionElement.append(sectionHeader);

      section.steps.forEach((step, index) => {
        const article = document.createElement("article");
        const entryHeader = document.createElement("div");
        const meta = document.createElement("p");
        const readState = document.createElement("span");
        const visibleId = document.createElement("code");
        const copy = document.createElement("button");
        const text = document.createElement("p");
        const details = document.createElement("ul");
        const speaker = speakerDisplayName(step) || (step.speaker === "narrator" || !step.speaker ? "地の文" : "SYSTEM");
        const isRead = readStepIds.has(step.id);
        article.className = "novel-script-entry";
        article.dataset.stepId = step.id;
        article.dataset.kind = step.recordType || step.type || "step";
        article.dataset.speaker = step.speaker || "narrator";
        article.dataset.readState = isRead ? "read" : "unread";
        entryHeader.className = "novel-log-entry-header";
        meta.className = "novel-log-entry-meta";
        meta.append(document.createTextNode(`${String(index + 1).padStart(3, "0")} / ${speaker} / ${step.recordType || step.type || "step"} / `));
        visibleId.className = "novel-log-entry-id";
        visibleId.textContent = step.id;
        meta.append(visibleId);
        readState.className = "novel-script-read-state";
        readState.textContent = isRead ? "既読" : "未読";
        copy.type = "button";
        copy.className = "novel-log-copy novel-script-copy";
        copy.textContent = "ID＋本文";
        copy.setAttribute("aria-label", `${step.id}の台本IDと本文をコピー`);
        copy.addEventListener("click", async () => {
          const copied = await writeClipboardText(`${step.id}\n${scriptStepText(step)}`);
          setLogStatus(copied ? `${step.id} をコピーしました` : "コピーできませんでした", copied ? "success" : "error");
        });
        entryHeader.append(meta, readState, copy);
        text.className = "novel-log-entry-text";
        text.textContent = scriptStepText(step);
        details.className = "novel-script-entry-details";
        const detailLines = [
          step.time ? `TIME / ${step.time}` : "",
          step.expression ? `EXPRESSION / ${step.expression}` : "",
          Array.isArray(step.readout) && step.readout.length ? `READOUT / ${step.readout.join(" | ")}` : "",
          step.interaction ? `INTERACTION / ${JSON.stringify(step.interaction)}` : "",
          Array.isArray(step.attachments) && step.attachments.length ? `ATTACHMENT / ${JSON.stringify(step.attachments)}` : "",
        ].filter(Boolean);
        detailLines.forEach((line) => {
          const item = document.createElement("li");
          item.textContent = line;
          details.append(item);
        });
        article.append(entryHeader, text);
        if (detailLines.length) article.append(details);
        sectionElement.append(article);
      });
      fragment.append(sectionElement);
    });
    elements.logContent.append(fragment);
  };
  const syncLogViewControls = () => {
    const scriptView = logView === "script";
    elements.logPanel.dataset.logView = logView;
    elements.logTitle.textContent = scriptView
      ? `全台本 ${scriptArchiveStepCount} STEP`
      : "ここまでに聞いた言葉";
    elements.logViewHeard.setAttribute("aria-selected", String(!scriptView));
    elements.logViewScript.setAttribute("aria-selected", String(scriptView));
    elements.logViewHeard.tabIndex = scriptView ? -1 : 0;
    elements.logViewScript.tabIndex = scriptView ? 0 : -1;
    elements.logContent.dataset.view = logView;
    elements.logContent.setAttribute("aria-labelledby", logDebugMode ? (scriptView ? "novel-log-view-script" : "novel-log-view-heard") : "novel-log-title");
  };
  const renderLog = () => {
    syncLogViewControls();
    if (logView === "script") {
      renderScriptArchive();
      syncLogCommentSummary();
    } else {
      renderHeardLog();
    }
  };
  const setLogView = (view) => {
    if (view === "script" && !logDebugMode) return false;
    if (!new Set(["heard", "script"]).has(view) || view === logView) return false;
    logView = view;
    logFollowLatest = view === "heard";
    setLogStatus("");
    renderLog();
    requestAnimationFrame(() => {
      elements.logContent.scrollTop = view === "heard" ? elements.logContent.scrollHeight : 0;
    });
    return true;
  };
  const logDistanceFromBottom = () => Math.max(0,
    elements.logContent.scrollHeight - elements.logContent.clientHeight - elements.logContent.scrollTop);
  const scrollLogToLatest = () => {
    elements.logContent.scrollTop = elements.logContent.scrollHeight;
    logFollowLatest = true;
  };
  elements.logContent.addEventListener("scroll", () => {
    logFollowLatest = logDistanceFromBottom() <= LOG_FOLLOW_THRESHOLD_PX;
  }, { passive: true });
  new MutationObserver(() => {
    if (elements.logPanel.hidden || logView !== "heard" || !logFollowLatest) return;
    requestAnimationFrame(scrollLogToLatest);
  }).observe(elements.logContent, { childList: true });
  const closeLog = () => {
    document.body.classList.remove("gaia-log-open");
    elements.logPanel.hidden = true;
    elements.logPanel.setAttribute("aria-hidden", "true");
    elements.logButton.setAttribute("aria-expanded", "false");
  };
  const openLog = () => {
    if (!elements.logPanel.hidden) return;
    closeGallery({ restoreFocus: false });
    closeEves();
    setLogStatus("");
    logFollowLatest = true;
    renderLog();
    document.body.classList.add("gaia-log-open");
    elements.logPanel.hidden = false;
    elements.logPanel.setAttribute("aria-hidden", "false");
    elements.logButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      if (logView === "heard") scrollLogToLatest();
      else elements.logContent.scrollTop = 0;
    });
    elements.logClose.focus({ preventScroll: true });
  };
  const toggleLog = () => {
    if (elements.logPanel.hidden) openLog();
    else closeLog();
  };

  // A display-only developer switch. Never clear comments or persist the switch.
  document.addEventListener("keydown", (event) => {
    if (layer.hidden || elements.logPanel.hidden || event.isComposing || event.repeat
      || event.ctrlKey || event.altKey || event.metaKey
      || event.target?.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) {
      logDebugKeys = "";
      return;
    }
    if (event.key.length !== 1) { logDebugKeys = ""; return; }
    const now = performance.now();
    if (now - logDebugKeyTime > 2000) logDebugKeys = "";
    logDebugKeyTime = now;
    logDebugKeys = (logDebugKeys + event.key.toLowerCase()).slice(-3);
    if (logDebugKeys !== "ruu") return;
    logDebugKeys = "";
    logDebugMode = !logDebugMode;
    elements.logPanel.dataset.debugMode = String(logDebugMode);
    if (!logDebugMode) logView = "heard";
    renderLog();
    elements.logClose.focus({ preventScroll: true });
  }, true);

  const evesEditorialLabel = (choice) => ({
    SOURCE_RECORD: "本人から届いた記録だけを表示",
    DISCLOSE_DERIVATION: "本人の記録と生成した部分を分けて表示",
  })[choice] || "最終画面の表示を選択前";

  const evesPostureResultLabel = (posture) => {
    if (posture !== "SELECTED") return "何も選ばずに進んだ";
    const confirmed = state.evesRoute.some((entry) => entry.decisionId === "reflection_choice" && entry.value === "SELECTED");
    return confirmed ? `姿勢を${state.reflectionIds.length}件選択` : "姿勢を1〜3件選択";
  };

  const evesProgress = () => {
    const posture = state.evesRoute.find((entry) => entry.decisionId === "reflection_choice")?.value || "";
    const count = state.editorialChoice ? (posture ? 2 : 1) : 0;
    const label = [
      "0 / 2｜まだ選択前です",
      "1 / 2｜最終画面の表示を選びました",
      "2 / 2｜二つの選択が完了しました",
    ][count];
    return { count, label, posture };
  };

  const renderEvesGraph = () => {
    const editorial = state.editorialChoice;
    const { posture } = evesProgress();
    const result = editorial && posture ? `${editorial}_${posture}` : "";
    const currentNode = result || (editorial ? "editorial_choice" : "intro");
    const visited = new Set(["intro"]);
    if (editorial) visited.add("editorial_choice");
    if (posture) visited.add("reflection_choice");
    if (result) visited.add(result);
    const resultLabels = {
      SOURCE_RECORD_SELECTED: [evesEditorialLabel("SOURCE_RECORD"), evesPostureResultLabel("SELECTED")],
      SOURCE_RECORD_UNANSWERED: [evesEditorialLabel("SOURCE_RECORD"), evesPostureResultLabel("UNANSWERED")],
      DISCLOSE_DERIVATION_SELECTED: [evesEditorialLabel("DISCLOSE_DERIVATION"), evesPostureResultLabel("SELECTED")],
      DISCLOSE_DERIVATION_UNANSWERED: [evesEditorialLabel("DISCLOSE_DERIVATION"), evesPostureResultLabel("UNANSWERED")],
    };
    const textLines = (lines, x, y, gap = 14) => lines
      .map((line, index) => `<tspan x="${x}" y="${y + (index * gap)}">${line}</tspan>`)
      .join("");
    const node = (id, x, y, width, eyebrow, lines) => {
      const current = currentNode === id;
      const labels = Array.isArray(lines) ? lines : [lines];
      const labelY = labels.length > 1 ? y + 32 : y + 39;
      return `<g class="eves-node ${visited.has(id) ? "is-visited" : ""} ${current ? "is-current" : ""}" data-node="${id}"><rect x="${x}" y="${y}" width="${width}" height="54" rx="8"></rect><text class="eves-node-eyebrow" x="${x + 12}" y="${y + 16}">${current ? "現在｜" : ""}${eyebrow}</text><text class="eves-node-label">${textLines(labels, x + 12, labelY)}</text></g>`;
    };
    const edge = (active, d, labels, x, y) => {
      const lines = Array.isArray(labels) ? labels : [labels];
      return `<g class="eves-edge ${active ? "is-active" : ""}"><path d="${d}"></path><text>${textLines(lines, x, y, 12)}</text></g>`;
    };
    elements.evesGraph.innerHTML = `<svg viewBox="0 0 1120 390" role="img" aria-label="左からプレイ開始、選択1、選択2、今回の選択結果の順です。箱は選択する場所と結果、線は選べる内容と進む順番を表します。">
      ${edge(Boolean(editorial), "M130 195 H200", "", 0, 0)}
      ${edge(editorial === "SOURCE_RECORD", "M360 185 C400 185 400 90 450 90", ["本人から届いた記録", "だけを表示"], 360, 124)}
      ${edge(editorial === "DISCLOSE_DERIVATION", "M360 205 C400 205 400 295 450 295", ["本人の記録と生成した部分を", "分けて表示"], 365, 242)}
      ${edge(Boolean(posture), "M610 90 C650 90 650 50 690 50", "1〜3件選んで進む", 610, 65)}
      ${edge(Boolean(posture), "M610 90 C650 90 650 135 690 135", "何も選ばず進む", 615, 126)}
      ${edge(Boolean(posture), "M610 295 C650 295 650 250 690 250", "1〜3件選んで進む", 610, 267)}
      ${edge(Boolean(posture), "M610 295 C650 295 650 335 690 335", "何も選ばず進む", 615, 328)}
      ${node("intro", 20, 168, 110, "開始", "プレイ開始")}
      ${node("editorial_choice", 200, 168, 160, "選択1", ["最終画面に", "何を表示するか"])}
      ${node("reflection_choice", 450, 63, 160, "選択2", ["次へ持ち帰りたい", "姿勢"])}
      ${node("reflection_choice", 450, 268, 160, "選択2", ["次へ持ち帰りたい", "姿勢"])}
      ${node("SOURCE_RECORD_SELECTED", 690, 23, 310, "今回の選択結果", resultLabels.SOURCE_RECORD_SELECTED)}
      ${node("SOURCE_RECORD_UNANSWERED", 690, 108, 310, "今回の選択結果", resultLabels.SOURCE_RECORD_UNANSWERED)}
      ${node("DISCLOSE_DERIVATION_SELECTED", 690, 223, 390, "今回の選択結果", resultLabels.DISCLOSE_DERIVATION_SELECTED)}
      ${node("DISCLOSE_DERIVATION_UNANSWERED", 690, 308, 390, "今回の選択結果", resultLabels.DISCLOSE_DERIVATION_UNANSWERED)}
    </svg>`;
  };

  const renderEves = () => {
    const { count, label, posture } = evesProgress();
    elements.evesCount.textContent = `${count} / 2`;
    elements.evesCurrent.textContent = label;
    elements.evesHistory.replaceChildren();
    if (count === 0) {
      const item = document.createElement("li");
      item.className = "is-empty";
      const span = document.createElement("span");
      const strong = document.createElement("strong");
      const small = document.createElement("small");
      span.textContent = "選択前";
      strong.textContent = "まだ選択はありません";
      small.textContent = "物語を進めると、ここに選んだ内容が表示されます。";
      item.append(span, strong, small);
      elements.evesHistory.append(item);
    } else {
      const historyEntries = [
        { decisionId: "editorial_choice" },
        ...(posture ? [{ decisionId: "reflection_choice" }] : []),
      ];
      historyEntries.forEach((entry, index) => {
        const item = document.createElement("li");
        const span = document.createElement("span");
        const strong = document.createElement("strong");
        const small = document.createElement("small");
        const editorialEntry = entry.decisionId === "editorial_choice";
        span.textContent = `選択${index + 1}`;
        strong.textContent = editorialEntry
          ? evesEditorialLabel(state.editorialChoice)
          : posture === "SELECTED"
            ? `次へ持ち帰りたい姿勢を${state.reflectionIds.length}件選んだ`
            : "何も選ばずに進んだ";
        small.textContent = editorialEntry ? "最終画面の表示" : "次へ持ち帰る姿勢";
        item.append(span, strong, small);
        elements.evesHistory.append(item);
      });
    }
    elements.evesRewind.disabled = count === 0;
    elements.evesRewindNote.textContent = count === 0
      ? "まだやり直せる選択はありません。"
      : count === 1
        ? "「最終画面の表示」の選択を取り消し、その選択画面へ戻ります。物語の既読記録は残ります。"
        : "「次へ持ち帰りたい姿勢」の選択と結果演出を取り消し、その選択画面へ戻ります。「最終画面の表示」の選択は残ります。";
    renderEvesGraph();
  };
  const closeEves = () => {
    elements.evesPanel.hidden = true;
    elements.evesPanel.setAttribute("aria-hidden", "true");
    elements.evesButton.setAttribute("aria-expanded", "false");
  };
  const toggleEves = () => {
    closeEves();
  };
  const rewindEves = () => {
    const entry = state.evesRoute.pop();
    if (!entry) return;
    if (entry.decisionId === "reflection_choice") {
      state.reflectionIds = [];
      state.resultTone = null;
    }
    if (entry.decisionId === "editorial_choice") {
      state.editorialChoice = null;
      state.reflectionIds = [];
      state.resultTone = null;
      state.evesRoute = [];
    }
    state.stepId = entry.stepId;
    saveProgress();
    closeEves();
    renderEves();
    renderCurrentStep();
  };

  const emptySlots = () => Array.from({ length: SLOT_COUNT }, () => null);
  const getManualSaves = () => {
    let candidate = safeJson(readStorage(MANUAL_SAVE_KEY));
    if (!Array.isArray(candidate)) {
      for (const key of LEGACY_MANUAL_KEYS) {
        const legacy = safeJson(readStorage(key));
        if (!Array.isArray(legacy)) continue;
        candidate = legacy;
        break;
      }
    }
    if (!Array.isArray(candidate)) return emptySlots();
    const migrated = emptySlots().map((_, index) => {
      const saved = candidate[index];
      const progress = normalizeState(saved?.progress || saved);
      return progress ? { progress, savedAt: Number(saved.savedAt) || 0, meta: saved.meta || {} } : null;
    });
    writeStorage(MANUAL_SAVE_KEY, JSON.stringify(migrated));
    return migrated;
  };
  const writeManualSaves = (slots) => writeStorage(MANUAL_SAVE_KEY, JSON.stringify(slots));
  const renderManualSlots = () => {
    const slots = getManualSaves();
    elements.saveSlots.replaceChildren();
    slots.forEach((saved, index) => {
      const article = document.createElement("article");
      const header = document.createElement("header");
      const label = document.createElement("span");
      const time = document.createElement("time");
      const title = document.createElement("h3");
      const excerpt = document.createElement("p");
      const actions = document.createElement("footer");
      const primary = document.createElement("span");
      const slotDisabled = archiveMode === "load" && !saved;
      const activateSlot = () => {
        if (slotDisabled) return;
        if (archiveMode === "save") saveManualSlot(index);
        else loadManualSlot(index);
      };
      article.className = "novel-save-slot";
      article.dataset.empty = String(!saved);
      article.dataset.disabled = String(slotDisabled);
      article.dataset.slotIndex = String(index);
      article.setAttribute("role", "button");
      article.setAttribute("aria-disabled", String(slotDisabled));
      article.setAttribute("aria-label", archiveMode === "save"
        ? `スロット${index + 1}へ保存`
        : saved ? `スロット${index + 1}から読み込む` : `スロット${index + 1}は空です`);
      article.tabIndex = slotDisabled ? -1 : 0;
      label.textContent = `SLOT ${String(index + 1).padStart(2, "0")}`;
      time.textContent = saved?.savedAt ? new Date(saved.savedAt).toLocaleString(globalThis.GaiaI18n?.get() || "ja-JP") : "EMPTY";
      const savedStep = logStepMap.get(saved?.progress?.stepId);
      const savedScene = savedStep && (sceneMap.get(savedStep.sceneId) || trueEndStory?.scenes.find(scene => scene.steps.some(step => step.id === savedStep.id)));
      title.textContent = savedScene?.title || translate(saved?.meta?.title || "空の記録領域");
      excerpt.textContent = savedStep?.text
        ? Array.from(savedStep.text).slice(0, 120).join("")
        : translate(saved?.meta?.excerpt || "ここにはまだ物語の現在地が保存されていません。");
      header.append(label, time);
      primary.className = "novel-save-primary";
      if (archiveMode === "save") {
        primary.textContent = saved ? (pendingSlotAction === `save:${index}` ? "もう一度押して上書き" : "上書き保存") : "このスロットに保存";
      } else {
        primary.textContent = saved ? "ここから再開" : "記録なし";
      }
      article.addEventListener("click", (event) => {
        if (event.target.closest(".novel-save-delete")) return;
        activateSlot();
      });
      article.addEventListener("keydown", (event) => {
        if (event.target !== article || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        activateSlot();
      });
      actions.append(primary);
      article.append(header, title, excerpt, actions);
      elements.saveSlots.append(article);
    });
  };
  const armSlotAction = (key, message) => {
    window.clearTimeout(pendingSlotTimer);
    pendingSlotAction = key;
    elements.saveStatus.textContent = message;
    renderManualSlots();
    pendingSlotTimer = window.setTimeout(() => {
      pendingSlotAction = "";
      renderManualSlots();
    }, 3200);
  };
  function saveManualSlot(index) {
    const slots = getManualSaves();
    if (slots[index] && pendingSlotAction !== `save:${index}`) {
      armSlotAction(`save:${index}`, "上書きする場合は、もう一度押してください");
      return;
    }
    pendingSlotAction = "";
    const step = currentStep();
    slots[index] = {
      progress: { ...state, audio: readAudioState() },
      savedAt: Date.now(),
      meta: {
        title: currentScene()?.title || "惑星の放課後",
        excerpt: String(step?.text || step?.prompt || "物語の現在地").slice(0, 120),
      },
    };
    writeManualSaves(slots);
    elements.saveStatus.textContent = `SLOT ${index + 1}へ現在地と選択を保存しました。`;
    renderManualSlots();
  }
  function deleteManualSlot(index) {
    const slots = getManualSaves();
    if (pendingSlotAction !== `delete:${index}`) {
      armSlotAction(`delete:${index}`, "消去する場合は、もう一度押してください");
      return;
    }
    slots[index] = null;
    pendingSlotAction = "";
    writeManualSaves(slots);
    renderManualSlots();
  }
  async function loadManualSlot(index) {
    const saved = getManualSaves()[index];
    if (!saved) return;
    exitDebugJumpSession();
    state = saved.progress;
    seedGalleryFromProgress(state);
    closeManualArchive({ restoreFocus: false });
    await revealRuntimeForStep(currentStep(), () => {
      renderEves();
      saveProgress();
      renderCurrentStep();
    });
  }
  const setArchiveMode = (mode) => {
    archiveMode = mode === "load" || !hasStarted ? "load" : "save";
    elements.saveTitle.textContent = archiveMode.toUpperCase();
    elements.saveTab.setAttribute("aria-selected", String(archiveMode === "save"));
    elements.loadTab.setAttribute("aria-selected", String(archiveMode === "load"));
    elements.saveTab.disabled = !hasStarted;
    elements.saveStatus.textContent = archiveMode === "save" ? "現在地と選択を保存するスロットを選んでください。" : "再開する記録を選んでください。";
    renderManualSlots();
  };
  const openManualArchive = (mode) => {
    closeGallery({ restoreFocus: false });
    archivePreviousFocus = document.activeElement;
    setArchiveMode(mode);
    elements.saveButton.setAttribute("aria-expanded", String(archiveMode === "save"));
    elements.loadButton.setAttribute("aria-expanded", String(archiveMode === "load"));
    elements.resume.setAttribute("aria-expanded", String(!hasStarted && archiveMode === "load"));
    elements.savePanel.hidden = false;
    elements.savePanel.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => elements.saveSlots.querySelector('.novel-save-slot[tabindex="0"]')?.focus({ preventScroll: true }));
  };
  const closeManualArchive = ({ restoreFocus = true } = {}) => {
    elements.savePanel.hidden = true;
    elements.savePanel.setAttribute("aria-hidden", "true");
    elements.saveButton.setAttribute("aria-expanded", "false");
    elements.loadButton.setAttribute("aria-expanded", "false");
    elements.resume.setAttribute("aria-expanded", "false");
    if (restoreFocus && archivePreviousFocus?.isConnected && !archivePreviousFocus.hidden) {
      archivePreviousFocus.focus({ preventScroll: true });
    }
    archivePreviousFocus = null;
  };

  const openConfig = () => {
    closeGallery({ restoreFocus: false });
    syncConfig();
    elements.configPanel.hidden = false;
    elements.configPanel.setAttribute("aria-hidden", "false");
    elements.configButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => elements.messageSpeed.focus({ preventScroll: true }));
  };
  const closeConfig = () => {
    elements.configPanel.hidden = true;
    elements.configPanel.setAttribute("aria-hidden", "true");
    elements.configButton.setAttribute("aria-expanded", "false");
  };
  const prepareFreshRuntime = () => {
    hasStarted = false;
    layer.classList.remove("is-title");
    elements.titleScreen.hidden = true;
    elements.runtime.hidden = true;
    elements.restart.hidden = true;
    if (elements.fastForward) elements.fastForward.hidden = true;
    setSceneJumpAvailability(false);
    elements.saveButton.hidden = true;
    elements.loadButton.hidden = true;
    elements.logButton.hidden = true;
    elements.configButton.hidden = true;
    elements.auto.hidden = true;
    elements.galleryButton.hidden = true;
    elements.close.hidden = true;
  };

  const storyEntryStep = ({ fresh = false } = {}) => {
    if (fresh) return stepMap.get(defaultState().stepId) || null;
    const latestManual = getManualSaves()
      .filter(Boolean)
      .sort((left, right) => right.savedAt - left.savedAt)[0]?.progress || null;
    const progress = getStoredProgress() || latestManual || defaultState();
    return resolveVisibleStep(progress.stepId) || stepMap.get(defaultState().stepId) || null;
  };

  const prepareStoryEntry = ({ fresh = false } = {}) => preloadRuntimeStep(storyEntryStep({ fresh }));

  const revealPreparedNovelLayer = async () => {
    layer.dataset.entryTransition = "paint-ready";
    await waitForBackgroundPaint();
    layer.style.setProperty("visibility", "visible");
    layer.style.setProperty("opacity", "0");
    layer.style.setProperty("transition", "none");
    await nextPaint();
    const revealComplete = waitForEntryReveal();
    layer.style.removeProperty("opacity");
    layer.style.removeProperty("transition");
    layer.classList.add("is-open");
    layer.dataset.entryTransition = "revealing";
    await revealComplete;
    await nextPaint();
    layer.style.removeProperty("visibility");
    layer.dataset.entryTransition = "visible";
  };

  function openNovel(event = null, {
    resumeStored = true,
    autoStartFresh = false,
    deferReveal = false,
    deferOpenEvent = false,
    entryPrepared = false,
    prologueReveal = null,
  } = {}) {
    event?.preventDefault?.();
    if (novelEntryPending) return novelEntryPending;
    novelEntryPending = (async () => {
      if (!entryPrepared && (resumeStored || autoStartFresh)) await prepareStoryEntry({ fresh: autoStartFresh });
      previousFocus = document.activeElement;
      suppressBaseInterface({ preserveOpening: deferOpenEvent });
      particleSystem.start();
      requestedStoryTrack = "story";
      void window.GaiaOpeningAudio?.switchTrack?.("story", 0.16);
      if (!deferOpenEvent) window.dispatchEvent(new CustomEvent("gaia:novel-open"));
      isOpen = true;
      setInteractionLifecycle("idle");
      layer.classList.remove("is-open");
      layer.dataset.entryTransition = "preparing";
      layer.hidden = false;
      layer.setAttribute("aria-hidden", "false");
      document.body.classList.add("novel-open");
      document.body.classList.remove("gaia-route-handoff");
      prepareFreshRuntime();
      if (autoStartFresh && prologueReveal) {
        // Paint only the entrance beneath the white curtain. Do not create a
        // fresh save, run a chapter timer or type the first line off screen.
        applyBackgroundCueForStep(storyEntryStep({ fresh: true }));
        await revealPreparedNovelLayer();
        await prologueReveal();
        // 本文を走らせる前に操作面を揃える。透明な間のクリックでも進行させない。
        layer.dataset.uiArrival = 'revealing';
        layer.inert = true;
        showRuntime();
        await nextPaint();
        const surfaces = [...layer.querySelectorAll(':scope > .novel-runtime, :scope > .novel-topbar, :scope > .novel-progress'), ...document.querySelectorAll('.gaia-audio-dock')];
        const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1800;
        const arrivals = surfaces.map(node => node.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-in-out', fill: 'both' }));
        await Promise.all(arrivals.map(animation => animation.finished));
        arrivals.forEach(animation => animation.cancel());
        layer.inert = false;
        delete layer.dataset.uiArrival;
        await startNewSession({ transition: false, skipSeparator: true });
      } else if (autoStartFresh) await startNewSession({ transition: false });
      else if (resumeStored) await resumeWithoutTitle({ transition: false });
      if (!deferReveal && !prologueReveal) await revealPreparedNovelLayer();
      if (window.location.hash !== "#story" && !/\/story\/?$/i.test(window.location.pathname)) {
        history.replaceState(null, "", "#story");
      }
      return true;
    })().catch(error => {
      if (prologueReveal) {
        clearTimers();
        particleSystem.stop();
        isOpen = false;
        requestedStoryTrack = null;
        layer.hidden = true;
        layer.classList.remove("is-open");
        layer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("novel-open");
        restoreBaseInterface();
        void window.GaiaOpeningAudio?.switchTrack?.("opening", .2);
      }
      throw error;
    }).finally(() => {
      novelEntryPending = null;
    });
    return novelEntryPending;
  }
  const openTrueEnd = async (event = null) => {
    const progress = completionProgress();
    if (progress?.clear !== true) return openNovel(event, { resumeStored: true });
    exitDebugJumpSession();
    state = progress;
    await openNovel(event, { resumeStored: false, deferReveal: true });
    showRuntime();
    if (!launchTrueEnd()) await resumeWithoutTitle({ transition: false });
    await revealPreparedNovelLayer();
  };
  function closeNovelNow() {
    clearSectionEntry();
    clearTimers();
    resetFastForward();
    closeDetourDock();
    particleSystem.stop();
    requestedStoryTrack = null;
    void window.GaiaOpeningAudio?.switchTrack?.("senseware");
    isOpen = false;
    setInteractionLifecycle("idle");
    sectionSkipPending = false;
    deferredSectionBackgroundTransition = null;
    elements.close.disabled = false;
    clearScriptDebug();
    setSceneJumpAvailability(false);
    layer.classList.remove("is-open", "is-mode-detour", "is-true-end", "is-staff-roll");
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("novel-open", "novel-mode-detour");
    restoreBaseInterface();
    window.setTimeout(() => { if (!isOpen) layer.hidden = true; }, motionReduced() ? 0 : 260);
    if (window.location.hash === "#story") history.replaceState(null, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new CustomEvent("gaia:return-to-intro"));
    previousFocus?.focus?.({ preventScroll: true });
  }
  const closeNovel = (event = null) => isOpen && runSceneTransition(closeNovelNow, event);

  const skipCurrentSection = (event = null) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!isOpen || !hasStarted || sectionSkipPending || runtimeRevealPending || backgroundTransitionPending || sectionEntryTimer || pendingInteraction) return;
    const scene = currentScene();
    if (!scene) return;
    const nextScene = sceneMap.get(scene.nextSceneId) || null;
    const target = nextScene
      ? resolveVisibleStep(firstStepForScene(nextScene.id))
      : resolveVisibleStep(scene.steps.at(-1)?.id);
    if (!target) return;

    const sourceStep = currentStep();
    const currentBackground = backgroundPresentationForStep(sourceStep);
    const nextBackground = backgroundPresentationForStep(target);
    const backgroundChanges = currentBackground.image !== nextBackground.image;

    sectionSkipPending = true;
    pendingPortraitAdvance = null;
    elements.close.disabled = true;
    resetFastForward();
    disableAutoForFastForward();
    const swapSection = () => {
      if (!state.reachedSceneIds.includes(scene.id)) state.reachedSceneIds.push(scene.id);
      state.stepId = target.id;
      saveProgress();
      if (nextScene) {
        deferredSectionBackgroundTransition = backgroundChanges
          ? {
            stepId: target.id,
            fromStepId: sourceStep.id,
            currentBackground,
            nextBackground,
          }
          : null;
        renderSectionSeparator(target);
      }
      else renderCurrentStep();
    };
    Promise.resolve(runSceneTransition(swapSection, event)).finally(() => {
      sectionSkipPending = false;
      elements.close.disabled = false;
      syncSectionSkipControl();
    });
  };

  const handleStoryExitControl = (event) => {
    if (hasStarted && !layer.classList.contains("is-title")) skipCurrentSection(event);
    else closeNovel(event);
  };

  document.querySelectorAll("[data-novel-open]").forEach((button) => {
    button.addEventListener("click", (event) => runSceneTransition(() => openNovel(event, { autoStartFresh: true }), event));
  });
  window.addEventListener("gaia:novel-open-at-mode", async (event) => {
    if (event.detail?.source === "opening") {
      await openNovel(null, { autoStartFresh: true });
      return;
    }
    if (event.detail?.source === "title-menu") {
      await openNovel(null, { autoStartFresh: true });
      return;
    }
    if (event.detail?.source === "apeironcene") {
      await openTrueEnd();
      return;
    }
    const index = Number(event.detail?.index);
    const target = scenes.find((scene) => scene.modeIndex === index && [2, 6, 7, 9].includes(index));
    exitDebugJumpSession();
    state = defaultState();
    if (target) state.stepId = target.steps[0].id;
    state.sessionId = `${Date.now().toString(36)}-entry`;
    await preloadRuntimeStep(currentStep());
    await openNovel(null, { resumeStored: false, deferReveal: true });
    await revealRuntimeForStep(currentStep(), () => {
      showRuntime();
      renderSectionSeparator();
    }, { transition: false });
    await revealPreparedNovelLayer();
  });

  window.addEventListener("gaia:gx-story-progress", (event) => {
    if (pendingInteraction?.interaction.kind !== "gx") return;
    detourState.gestureCount = Math.max(detourState.gestureCount || 0, Number(event.detail?.count) || 0);
    detourState.phaseIndex = Math.max(detourState.phaseIndex || 1, Number(event.detail?.phase) || 1);
    detourState.phaseCount = Math.max(1, Number(event.detail?.phaseCount) || 8);
    if (event.detail?.complete === true) state.viewed.gxDeepTime = true;
    saveProgress();
    updateDetourDock();
  });
  window.addEventListener("gaia:gx-return-to-novel", () => completePendingInteraction());
  window.addEventListener("gaia:story-mode-return-to-novel", (event) => {
    if (!pendingInteraction || event.detail?.kind !== pendingInteraction.interaction.kind) return;
    completePendingInteraction();
  });
  window.addEventListener("gaia:story-map-interaction", (event) => {
    if (!pendingInteraction) return;
    if (pendingInteraction.interaction.kind === "map01") {
      const view = String(event.detail?.view || "");
      if ((pendingInteraction.interaction.requiredViews || []).includes(view)) detourState?.views?.add(view);
      // Intermediate years/points only record exploration. The temperature player
      // emits a phase-specific completion after holding the final annual frame.
    }
    updateDetourDock();
  });
  window.addEventListener("gaia:story-mode-auto-complete", (event) => {
    if (pendingInteraction?.interaction.kind !== "map01" || event.detail?.kind !== "map01") return;
    if (interactionLifecycle !== "open") return;
    const phase = pendingInteraction.interaction.phase;
    if (phase === "temperature-anomaly" && event.detail?.phase !== phase) return;
    if (event.detail?.phase && event.detail.phase !== phase) return;
    const view = String(event.detail?.view || "timeline_complete");
    if ((pendingInteraction.interaction.requiredViews || []).includes(view)) detourState?.views?.add(view);
    requestDetourReturn();
  });
  window.addEventListener("gaia:story-abstract-interaction", () => {
    if (pendingInteraction?.interaction.kind !== "abstract07") return;
    state.viewed.mode07AbstractPoint = true;
    saveProgress();
    updateDetourDock();
  });
  window.addEventListener("gaia:space-story-progress", (event) => {
    if (pendingInteraction?.interaction.kind !== "space10") return;
    if (event.detail?.complete) state.viewed.mode10SpaceOverview = true;
    saveProgress();
    updateDetourDock();
  });
  window.addEventListener("gaia:space-return-to-novel", () => completePendingInteraction());

  elements.start.addEventListener("click", startNewSession);
  elements.resume.addEventListener("click", () => { void resumeStoredSession(); });
  elements.titleGallery?.addEventListener("click", openGallery);
  elements.close.addEventListener("click", handleStoryExitControl);
  elements.home.addEventListener("click", closeNovel);
  elements.restart.addEventListener("click", restartStory);
  elements.logButton.addEventListener("click", toggleLog);
  elements.logClose.addEventListener("click", closeLog);
  elements.logViewHeard.addEventListener("click", () => setLogView("heard"));
  elements.logViewScript.addEventListener("click", () => setLogView("script"));
  [elements.logViewHeard, elements.logViewScript].forEach((tab) => {
    tab.addEventListener("keydown", (event) => {
      if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return;
      event.preventDefault();
      const view = event.key === "ArrowLeft" || event.key === "Home" ? "heard" : "script";
      setLogView(view);
      (view === "heard" ? elements.logViewHeard : elements.logViewScript).focus();
    });
  });
  elements.logDeleteAll.addEventListener("click", deleteAllLogComments);
  elements.logExport.addEventListener("click", exportLogComments);
  elements.logScriptExport.addEventListener("click", exportFullScript);
  elements.saveButton.addEventListener("click", () => openManualArchive("save"));
  elements.loadButton.addEventListener("click", () => openManualArchive("load"));
  elements.saveClose.addEventListener("click", closeManualArchive);
  elements.saveTab.addEventListener("click", () => setArchiveMode("save"));
  elements.loadTab.addEventListener("click", () => setArchiveMode("load"));
  elements.configButton.addEventListener("click", openConfig);
  elements.configClose.addEventListener("click", closeConfig);
  elements.configReset.addEventListener("click", () => {
    config = { messageSpeedPercent: DEFAULT_MESSAGE_SPEED_PERCENT, reducedMotion: false };
    saveConfig();
    syncConfig();
  });
  elements.messageSpeed.addEventListener("input", () => {
    config.messageSpeedPercent = Number(elements.messageSpeed.value);
    saveConfig();
    syncConfig();
  });
  elements.reducedMotion?.addEventListener("change", () => {
    config.reducedMotion = elements.reducedMotion.checked;
    saveConfig();
    syncConfig();
  });
  elements.evesButton.addEventListener("click", toggleEves);
  elements.evesClose.addEventListener("click", closeEves);
  elements.evesRewind.addEventListener("click", rewindEves);
  elements.galleryButton?.addEventListener("click", openGallery);
  elements.galleryClose?.addEventListener("click", () => closeGallery());
  elements.galleryViewerClose?.addEventListener("click", closeGalleryViewer);
  elements.galleryViewerPrevious?.addEventListener("click", () => { void turnGalleryViewer(-1); });
  elements.galleryViewerNext?.addEventListener("click", () => { void turnGalleryViewer(1); });
  elements.galleryViewerFigure?.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button > 0) return;
    galleryViewerPointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  elements.galleryViewerFigure?.addEventListener("pointerup", (event) => {
    if (!galleryViewerPointerStart || galleryViewerPointerStart.id !== event.pointerId) return;
    const deltaX = event.clientX - galleryViewerPointerStart.x;
    const deltaY = event.clientY - galleryViewerPointerStart.y;
    galleryViewerPointerStart = null;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
    void turnGalleryViewer(deltaX < 0 ? 1 : -1);
  });
  elements.galleryViewerFigure?.addEventListener("pointercancel", () => { galleryViewerPointerStart = null; });
  elements.galleryViewer?.addEventListener("click", (event) => {
    if (event.target === elements.galleryViewer) closeGalleryViewer();
  });
  elements.galleryPanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
  elements.galleryPanel?.addEventListener("click", (event) => event.stopPropagation());
  elements.jumpButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleSceneJump();
  });
  elements.jumpClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSceneJump();
  });
  elements.jumpList?.addEventListener("click", (event) => {
    const button = event.target.closest("button.novel-jump-item[data-scene-id]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    jumpToSceneStart(button.dataset.sceneId, event);
  });
  elements.jumpPanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
  elements.jumpPanel?.addEventListener("click", (event) => event.stopPropagation());
  elements.jumpPanel?.addEventListener("wheel", (event) => {
    const list = elements.jumpList;
    if (!list || event.ctrlKey) {
      event.stopPropagation();
      return;
    }
    const maximum = Math.max(0, list.scrollHeight - list.clientHeight);
    const canScroll = maximum > 0 && (event.deltaY > 0 ? list.scrollTop < maximum : list.scrollTop > 0);
    if (canScroll) {
      event.preventDefault();
      list.scrollBy({ top: event.deltaY, behavior: "auto" });
    }
    event.stopPropagation();
  }, { passive: false });
  document.addEventListener("pointerdown", (event) => {
    if (elements.jumpPanel?.hidden || elements.jumpPanel?.contains(event.target) || elements.jumpButton?.contains(event.target)) return;
    jumpOutsidePointerBlocked = true;
    closeSceneJump();
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener("click", (event) => {
    if (jumpOutsidePointerBlocked) {
      jumpOutsidePointerBlocked = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (elements.jumpPanel?.hidden || elements.jumpPanel?.contains(event.target) || elements.jumpButton?.contains(event.target)) return;
    closeSceneJump();
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  const scriptCopy = getScriptDebugElements().copyButton;
  scriptCopy?.addEventListener("pointerdown", (event) => event.stopPropagation());
  scriptCopy?.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.stopPropagation();
  });
  scriptCopy?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void copyCurrentScriptPosition();
  });
  elements.auto.addEventListener("click", () => {
    const enabled = elements.auto.getAttribute("aria-pressed") !== "true";
    elements.auto.setAttribute("aria-pressed", String(enabled));
    elements.auto.classList.toggle("is-active", enabled);
    if (enabled) scheduleAutoAdvance();
    else window.clearTimeout(autoTimer);
  });
  elements.fastForward?.addEventListener("click", () => {
    fastForwardState.buttonActive = !fastForwardState.buttonActive;
    fastForwardState.blocked = false;
    if (fastForwardState.buttonActive) {
      disableAutoForFastForward();
      updateFastForwardInterface();
      scheduleFastForward(0);
    } else {
      if (!fastForwardState.keyActive) clearFastForwardTimer();
      updateFastForwardInterface();
    }
  });
  document.addEventListener("keydown", handleFastForwardKeyDown, true);
  document.addEventListener("keydown", handleDocumentDialogueEnter, true);
  document.addEventListener("keyup", endControlFastForward, true);
  window.addEventListener("blur", () => endControlFastForward());
  document.addEventListener("visibilitychange", () => endControlFastForward());
  window.addEventListener("resize", syncPcCanvas, { passive: true });
  window.addEventListener("resize", repaginateVisibleDialogue, { passive: true });
  document.fonts?.addEventListener?.("loadingdone", repaginateVisibleDialogue);
  window.addEventListener("gaia:language-change", () => {
    renderSceneJumpList();
    renderManualSlots();
    renderEves();
    if (!isOpen || !hasStarted || endingPresentationActive() || pendingInteraction) return;
    const step = currentStep();
    // Keep the same story step and saved route. A translated paragraph starts
    // at its first page because page boundaries differ across languages.
    if (["narration", "dialogue"].includes(step?.type)) renderSimpleStep(step);
    else if (["chat", "record", "ui", "transition"].includes(step?.type)) renderRichStep(step);
    else if (step?.type === "choice") renderChoice(step);
    else if (step?.type === "reflectionChoice") renderReflectionChoice(step);
    if (!elements.logPanel.hidden) renderLog();
  });
  if (globalThis.ResizeObserver) {
    const dialogueTextResizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || elements.text.getBoundingClientRect().width;
      if (Math.abs(width - dialogueObservedWidth) < 0.5) return;
      dialogueObservedWidth = width;
      if (dialogueReflowActive) return;
      window.requestAnimationFrame(repaginateVisibleDialogue);
    });
    dialogueTextResizeObserver.observe(elements.text);
  }
  elements.dialogue.addEventListener("click", (event) => {
    if (event.target.closest("button, textarea, input, details, summary")) return;
    event.stopPropagation();
    advance();
  });
  layer.addEventListener("click", (event) => {
    if (event.target.closest("button, a, input, select, textarea, details, summary, [role='button']")) return;
    if (layer.classList.contains("is-slack") && performance.now() < slackScrollGuardUntil) return;
    advance();
  });
  layer.addEventListener("wheel", (event) => {
    if (!elements.jumpPanel?.hidden || event.target.closest?.("#novel-jump-panel")) return;
    if (event.deltaY >= 0 || event.ctrlKey || !hasStarted || elements.runtime.hidden || !elements.logPanel.hidden) return;
    if (![elements.logPanel, elements.savePanel, elements.configPanel, elements.evesPanel, elements.jumpPanel, elements.galleryPanel].every((panel) => panel.hidden)) return;
    event.preventDefault();
    event.stopPropagation();
    openLog();
  }, { passive: false });
  layer.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (!elements.galleryViewer?.hidden) closeGalleryViewer();
      else if (!elements.galleryPanel?.hidden) closeGallery();
      else if (!elements.jumpPanel?.hidden) closeSceneJump();
      else if (!elements.configPanel.hidden) closeConfig();
      else if (!elements.savePanel.hidden) closeManualArchive();
      else if (!elements.evesPanel.hidden) closeEves();
      else if (!elements.logPanel.hidden) closeLog();
      else closeNovel();
      return;
    }
    if (!elements.galleryViewer?.hidden && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      void turnGalleryViewer(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (!elements.jumpPanel?.hidden) return;
    const dialogueAdvanceKey = (event.key === " " || event.key === "Enter")
      && !(event.key === "Enter" && event.repeat)
      && !event.isComposing
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey;
    if (dialogueAdvanceKey && !isVisibleKeyboardControl(event.target)) {
      event.preventDefault();
      advance();
    }
    if (event.key.toLowerCase() === "l" && !isVisibleKeyboardControl(event.target)) {
      event.preventDefault();
      toggleLog();
    }
  });

  globalThis.GaiaNovel = Object.freeze({
    open: openNovel,
    close: closeNovel,
    prepareEntry: prepareStoryEntry,
    getState: () => structuredClone(state),
    getCompletionState,
    scoreReflection: (ids) => scoreReflection(ids),
    getBackgroundCue: (stepId) => {
      const step = stepMap.get(stepId);
      if (!step) return null;
      const cue = backgroundCues.forStep(step);
      return cue ? { ...cue } : null;
    },
    getGalleryState: () => {
      const { unlocked, total, count, percentage } = galleryProgress();
      return { unlocked: [...unlocked], total, count, percentage };
    },
    inspectDialoguePagination: (text, { forceFallback = false } = {}) => {
      const source = String(text || "");
      const renderedChildren = Array.from(elements.text.childNodes);
      dialogueForceFallbackForInspection = forceFallback;
      try {
        const pages = paginateDialogueTextBalanced(source);
        return {
        source,
        forceFallback,
        tokens: segmentDialoguePhrases(source, { forceFallback }),
        units: semanticDialogueUnits(source).map((unit) => {
          const metrics = dialoguePageMetrics(unit);
          return {
            text: unit,
            lines: metrics.measuredLines.length,
            fits: metrics.fits,
            indicatorSafety: metrics.indicatorSafety,
            indicatorClearance: metrics.indicatorClearance,
          };
        }),
        pages: pages.map((page) => {
          const layout = buildDialogueTokenLayout(page, { forceFallback });
          const metrics = dialoguePageMetrics(page, layout);
          const textRect = elements.text.getBoundingClientRect();
          const indicatorRect = elements.continueMark.getBoundingClientRect();
          const tokenRows = metrics.measuredLines.map((line, index) => ({
            top: textRect.top + (index * (Number.parseFloat(getComputedStyle(elements.text).lineHeight) || 0)),
            text: line.join(""),
            tokens: [],
          }));
          layout.querySelectorAll(".novel-phrase-token, .novel-space-token").forEach((token) => {
            const rects = Array.from(token.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
            rects.forEach((rect) => {
              let row = tokenRows.find((candidate) => Math.abs(candidate.top - rect.top) <= 2);
              if (!row) return;
              row.tokens.push({
                text: token.textContent || "",
                start: Number(token.dataset.sourceStart),
                end: Number(token.dataset.sourceEnd),
                top: rect.top,
                bottom: rect.bottom,
              });
            });
          });
          return {
            text: page,
            lines: metrics.measuredLines.length,
            maxLines: metrics.maxLines,
            fits: metrics.fits,
            characters: metrics.characterCount,
            indicatorSafety: indicatorRect.top - textRect.bottom,
            indicatorClearance: metrics.indicatorClearance,
            horizontalOverflow: metrics.horizontalOverflow,
            tokenSource: Array.from(layout.childNodes, (node) => node instanceof HTMLBRElement ? node.dataset.sourceBreak || "" : node.textContent || "").join(""),
            tokenLines: tokenRows.sort((left, right) => left.top - right.top),
          };
        }),
        };
      } finally {
        elements.text.replaceChildren(...renderedChildren);
        dialogueForceFallbackForInspection = false;
      }
    },
    storageKey: STORAGE_KEY,
    buildProfile: BUILD_PROFILE,
  });

  loadConfig();
  renderSceneJumpList();
  syncConfig();
  renderManualSlots();
  renderEves();
  renderGalleryControls();
  prepareFreshRuntime();
  const directStoryRoute = /\/story\/?$/i.test(window.location.pathname);
  if (directStoryRoute) {
    const opening = document.querySelector("#gaia-opening");
    if (opening) opening.hidden = true;
    document.body.classList.remove("gaia-opening-active");
  }
  if (window.location.hash === "#story" || directStoryRoute) openNovel();
})();
