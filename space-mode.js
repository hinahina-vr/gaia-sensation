(() => {
  "use strict";

  const layer = document.querySelector("#space-layer");
  const canvas = document.querySelector("#space-canvas");
  if (!layer || !canvas) return;

  const nativeContext = canvas.getContext("2d", { alpha: false });
  const context = globalThis.GaiaI18nCanvas?.context(nativeContext) || nativeContext;
  const ui = {
    close: document.querySelector("#space-close"),
    previous: document.querySelector("#space-previous"),
    next: document.querySelector("#space-next"),
    release: document.querySelector("#space-launch"),
    phase: document.querySelector("#space-phase"),
    modeList: document.querySelector("#space-mode-list"),
    number: document.querySelector("#space-number"),
    code: document.querySelector("#space-code"),
    title: document.querySelector("#space-mode-title"),
    titleEn: document.querySelector("#space-mode-title-en"),
    narrative: document.querySelector("#space-narrative"),
    visualGuide: document.querySelector("#space-visual-guide"),
    interaction: document.querySelector("#space-interaction"),
    recordTitle: document.querySelector("#space-record-title"),
    recordDetail: document.querySelector("#space-record-detail"),
    effectRow: document.querySelector("#space-effect-row"),
    effect: document.querySelector("#space-effect"),
    metricLabel: document.querySelector("#space-metric-label"),
    metricValue: document.querySelector("#space-metric-value"),
    metricUnit: document.querySelector("#space-metric-unit"),
    metricDetail: document.querySelector("#space-metric-detail"),
    dateNote: document.querySelector("#space-date-note"),
    dataButton: document.querySelector("#space-data-button"),
    dataPanel: document.querySelector("#space-data-panel"),
    dataClose: document.querySelector("#space-data-close"),
    dataTitle: document.querySelector("#space-data-title"),
    dataContent: document.querySelector("#space-data-content"),
    intro: document.querySelector("#intro-button"),
  };

  const openButtons = Array.from(document.querySelectorAll("[data-space-open]"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const DATA_URL = "./data/space-signals.json?v=gaia-97";
  const AU_KM = 149_597_870.7;
  const TAU = Math.PI * 2;
  const scenes = window.GaiaSpaceScenes;
  let returnToNovel = false;
  let storyMode = "";
  let storyInteractionComplete = false;

  const state = {
    snapshot: null,
    loadPromise: null,
    open: false,
    width: 1,
    height: 1,
    dpr: 1,
    frame: null,
    modeIndex: 0,
    recordIndex: 0,
    pointer: { x: 0.5, y: 0.5, down: false, visible: false },
    particles: [],
    dust: [],
    solarGranules: [],
    solarFibers: [],
    ripples: [],
    pulses: [],
    gestures: [],
    draftGesture: null,
    response: 0,
    lastTime: 0,
    lastTouchRipple: 0,
    lastAutoPulse: 0,
    interfaceTimer: 0,
    effectTimer: 0,
    scene: null,
  };

  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const smooth = (value) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  const formatNumber = (value, digits = 1) => {
    if (value == null || value === "") return "—";
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits }).format(number);
  };
  const formatIndex = (index) => String(index + 1).padStart(2, "0");
  const currentMode = () => state.snapshot?.modes?.[state.modeIndex] || null;
  const currentRecord = () => {
    const records = currentMode()?.records || [];
    return records.length ? records[state.recordIndex % records.length] : null;
  };
  const LUNAR_DISTANCE_KM = 384_400;
  const PARSEC_LIGHT_YEARS = 3.26156;
  const VISUAL_GUIDES = {
    "solar-flare": "開く光の大きさ＝観測されたX線の強さ。開く位置と白い波紋＝観客が触れた場所です。",
    "coronal-mass-ejection": "左の太陽から進む円弧＝噴き出したガスの波。移動の速さ＝解析速度、扇の幅＝噴出範囲です。",
    "geomagnetic-storm": "中央の球＝地球、周囲の曲線＝磁力線。線の震えと光の帯の太さ＝Kp指数の大きさです。",
    "energetic-particles": "細い光の列＝粒子増加を捉えた観測機器。列の本数は、宇宙を飛ぶ粒子の総数ではありません。",
    "close-approach": "青い球＝地球、点線の円＝月の軌道、白い点＝小惑星、斜めの線＝通過経路、短い縦線＝最接近距離です。距離は対数で圧縮し、天体の大きさとは同じ縮尺にしていません。",
    fireball: "明るい線＝火球、光が最も強い位置＝ピーク発光高度。明るさと残光の長さ＝推定エネルギーです。",
    "nearby-worlds": "中心＝地球から見た現在地、光点＝確認済みの系外惑星。中心に近い点ほど、地球から近い惑星です。",
    "earth-scale-worlds": "円の大きさ＝地球を1とした惑星半径、色＝計算上の平衡温度。白く強調された円が選択中の惑星です。",
    "ryugu-lidar": "輪郭＝リュウグウ、光点＝レーザー測距点、探査機から伸びる線＝選択した測距です。起伏は測定値から強調しています。",
    "cosmic-senseware": "節点＝01〜09のデータ源、節点の色＝異なる観測分野、節点を結ぶ線＝観客が作った仮想の関係です。",
  };

  const dateLabel = (value) => {
    if (!value) return "日時不明";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  };

  const recordDescription = (mode, record) => {
    if (!mode) return { title: "記録を読み込んでいます", detail: "少し待ってください。" };
    if (!record) return {
      title: `${mode.title}をまとめて表示`,
      detail: "複数のデータ源を同じ画面へ重ねています。個別の数値を一つの総合点にはしていません。",
    };
    switch (mode.id) {
      case "solar-flare":
        return {
          title: `${record.classType || "等級不明"}級の太陽フレア`,
          detail: `${dateLabel(record.peakTime || record.beginTime)}にX線が最大になった記録です。等級が高いほど光が大きく開きます。`,
        };
      case "coronal-mass-ejection":
        return {
          title: `速度 ${formatNumber(record.speedKmS, 0)}km/sのCME`,
          detail: `${dateLabel(record.startTime)}の解析記録です。円弧の速度に${formatNumber(record.speedKmS, 0)}km/s、広がりに半角${formatNumber(record.halfAngleDeg, 0)}度を使っています。`,
        };
      case "geomagnetic-storm":
        return {
          title: `Kp ${formatNumber(record.kp, 1)}の磁気嵐`,
          detail: `${dateLabel(record.startTime || record.observedTime || record.timeTag)}の記録です。Kpは0〜9で地球全体の磁気活動を表します。`,
        };
      case "energetic-particles":
        return {
          title: `${record.instruments?.length || 0}台の観測機器に結びついた通知`,
          detail: `${dateLabel(record.eventTime || record.startTime)}に粒子増加が確認された記録です。光の列は粒子数ではなく観測機器を表します。`,
        };
      case "close-approach": {
        const lunarDistance = record.distanceLunar == null ? NaN : Number(record.distanceLunar);
        const distanceKm = lunarDistance * LUNAR_DISTANCE_KM;
        return {
          title: `小惑星 ${record.designation || "名称不明"}`,
          detail: `${dateLabel(record.date)}に、地球から${formatNumber(lunarDistance, 3)}月距離（約${formatNumber(distanceKm, 0)}km）まで接近した記録です。通過速度は${formatNumber(record.velocityKmS, 1)}km/sです。`,
        };
      }
      case "fireball":
        return {
          title: `${formatNumber(record.impactKilotons, 2)}kt相当の火球`,
          detail: `${dateLabel(record.date || record.dateTime)}の記録です。ピーク発光高度は${formatNumber(record.altitudeKm, 1)}km、速度は${formatNumber(record.velocityKmS, 1)}km/sです。`,
        };
      case "nearby-worlds":
        return {
          title: record.planet || record.name || record.planetName || "名称不明の系外惑星",
          detail: `地球から約${formatNumber(record.distancePc == null ? NaN : Number(record.distancePc) * PARSEC_LIGHT_YEARS, 1)}光年。発見方法は${record.discoveryMethod || record.discoverymethod || "記録なし"}です。`,
        };
      case "earth-scale-worlds":
        return {
          title: record.planet || record.name || record.planetName || "名称不明の系外惑星",
          detail: `半径は地球の${formatNumber(record.radiusEarth, 2)}倍、平衡温度は${formatNumber(record.equilibriumK, 0)}Kです。生命の有無や実際の地表温度を示す値ではありません。`,
        };
      case "ryugu-lidar":
        return {
          title: `リュウグウまで${formatNumber(record.rangeM, 0)}m`,
          detail: `${dateLabel(record.shotTime)}のレーザー測距です。光が戻るまでの時間から、探査機と天体の間の距離を求めています。`,
        };
      default:
        return { title: mode.title, detail: mode.narrative };
    }
  };
  const parseAccent = (mode = currentMode()) => {
    const values = String(mode?.accent || "144, 226, 255").split(",").map((value) => Number(value.trim()));
    return values.length === 3 && values.every(Number.isFinite) ? values : [144, 226, 255];
  };
  const rgba = (color, alpha) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  const mixColor = (first, second, amount) => first.map((value, index) => Math.round(lerp(value, second[index], amount)));

  const runSceneTransition = (swapScene, event = null) => {
    const transition = window.GaiaSceneTransition;
    const hasOrigin = Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY) &&
      (event.clientX !== 0 || event.clientY !== 0);
    if (!transition) return Promise.resolve(swapScene());
    return transition.run(swapScene, {
      tone: "space",
      origin: hasOrigin ? { x: event.clientX, y: event.clientY } : undefined,
    });
  };

  const loadSnapshot = () => {
    if (state.snapshot) return Promise.resolve(state.snapshot);
    if (state.loadPromise) return state.loadPromise;
    state.loadPromise = fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`space data ${response.status}`);
        return response.json();
      })
      .then((snapshot) => {
        state.snapshot = snapshot;
        buildModeList();
        updateInterface();
        return snapshot;
      })
      .catch((error) => {
        ui.narrative.textContent = "保存した宇宙データを読み込めませんでした。再読み込みしてください。";
        ui.phase.textContent = error.message;
        throw error;
      });
    return state.loadPromise;
  };

  const seededRandom = (() => {
    let seed = 0x6a09e667;
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  })();

  const buildParticles = () => {
    const count = reducedMotion ? 300 : coarsePointer ? 620 : Math.round(clamp(state.width / 1400, 0.75, 1.25) * 1100);
    state.particles = Array.from({ length: count }, (_, index) => ({
      x: seededRandom() * 1.18 - 0.1,
      y: seededRandom(),
      lane: seededRandom() * 2 - 1,
      phase: seededRandom() * TAU,
      speed: 0.55 + seededRandom() * 0.9,
      size: 0.3 + seededRandom() * 1.35,
      depth: 0.35 + seededRandom() * 0.65,
      warm: index % 11 === 0,
    }));
    state.dust = Array.from({ length: reducedMotion ? 45 : 110 }, () => ({
      x: seededRandom(),
      y: seededRandom(),
      size: 0.25 + seededRandom() * 0.85,
      alpha: 0.08 + seededRandom() * 0.25,
      phase: seededRandom() * TAU,
    }));
    state.solarGranules = Array.from({ length: reducedMotion ? 150 : coarsePointer ? 260 : 430 }, (_, index) => ({
      angle: lerp(-1.08, 1.08, seededRandom()),
      radial: Math.sqrt(0.2 + seededRandom() * 0.76),
      size: 0.7 + seededRandom() * 2.5,
      alpha: 0.025 + seededRandom() * 0.09,
      phase: seededRandom() * TAU,
      hot: index % 9 === 0,
    }));
    state.solarFibers = Array.from({ length: reducedMotion ? 18 : 34 }, (_, index) => ({
      angle: lerp(-1.02, 1.02, (index + 0.5) / (reducedMotion ? 18 : 34)),
      radial: 0.68 + seededRandom() * 0.28,
      span: 0.018 + seededRandom() * 0.055,
      alpha: 0.018 + seededRandom() * 0.05,
      phase: seededRandom() * TAU,
    }));
  };

  const modeParameters = () => {
    const mode = currentMode();
    const record = currentRecord() || {};
    const parameters = {
      speed: 0.035,
      turbulence: 0.5,
      density: 0.7,
      response: 0.45,
      spread: 0.55,
      pulseDuration: 6200,
    };
    switch (mode?.id) {
      case "solar-flare": {
        const match = String(record.classType || "C1").match(/([ABCMX])(\d+(?:\.\d+)?)/i);
        const levels = { A: 0.05, B: 0.12, C: 0.28, M: 0.62, X: 1 };
        parameters.density = clamp((levels[match?.[1]?.toUpperCase()] || 0.25) + Number(match?.[2] || 1) * 0.025, 0.2, 1);
        parameters.turbulence = 0.38 + parameters.density * 0.5;
        parameters.response = 0.35 + parameters.density * 0.45;
        break;
      }
      case "coronal-mass-ejection": {
        const speed = Number(record.speedKmS) || 600;
        parameters.speed = lerp(0.026, 0.075, clamp((speed - 250) / 1200));
        parameters.spread = clamp((Number(record.halfAngleDeg) || 30) / 90, 0.18, 1);
        parameters.pulseDuration = lerp(7800, 4300, clamp((speed - 250) / 1200));
        parameters.response = 0.72;
        break;
      }
      case "geomagnetic-storm": {
        const kp = clamp((Number(record.kp) || 4) / 9, 0, 1);
        parameters.response = 0.3 + kp * 0.7;
        parameters.turbulence = 0.28 + kp * 0.72;
        break;
      }
      case "energetic-particles":
        parameters.density = clamp((record.instruments?.length || 2) / 6, 0.35, 1);
        parameters.speed = 0.075;
        parameters.turbulence = 0.22;
        break;
      case "close-approach":
        parameters.spread = clamp(Number(record.distanceLunar) / 20, 0.15, 1);
        parameters.speed = clamp(Number(record.velocityKmS) / 500, 0.02, 0.08);
        parameters.turbulence = 0.2;
        break;
      case "fireball":
        parameters.density = clamp(Math.log10((Number(record.impactKilotons) || 0.1) + 1) / 2, 0.25, 1);
        parameters.turbulence = 0.82;
        parameters.response = 0.8;
        break;
      case "nearby-worlds":
        parameters.speed = 0.018;
        parameters.turbulence = 0.16;
        parameters.spread = 0.9;
        break;
      case "earth-scale-worlds":
        parameters.speed = 0.024;
        parameters.density = clamp(Number(record.radiusEarth) || 1, 0.55, 1.15);
        parameters.response = clamp((Number(record.equilibriumK) || 260) / 600, 0.3, 1);
        break;
      case "ryugu-lidar":
        parameters.speed = 0.028;
        parameters.turbulence = 0.1;
        parameters.spread = 0.2;
        parameters.pulseDuration = 4800;
        break;
      case "cosmic-senseware":
        parameters.speed = 0.042;
        parameters.turbulence = 0.74;
        parameters.density = 1;
        parameters.response = 1;
        parameters.spread = 0.82;
        break;
      default:
        break;
    }
    return parameters;
  };

  const recordLabel = (mode = currentMode(), record = currentRecord()) => {
    if (!mode || !record) return "保存済み公開記録";
    switch (mode.id) {
      case "solar-flare": return `${record.classType || "—"} / ${record.peakTime || record.beginTime || "—"}`;
      case "coronal-mass-ejection": return `${formatNumber(record.speedKmS, 0)} km/s / ${record.startTime || "—"}`;
      case "geomagnetic-storm": return `Kp ${formatNumber(record.kp)} / ${record.startTime || record.observedTime || record.timeTag || "—"}`;
      case "energetic-particles": return `${record.instruments?.length || 0}台の観測機器 / ${record.eventTime || record.startTime || "—"}`;
      case "close-approach": return `${formatNumber(record.distanceLunar, 3)}月距離 / ${record.date || record.closeApproachDate || "—"}`;
      case "fireball": return `${formatNumber(record.impactKilotons, 2)} kt / ${record.date || record.dateTime || "—"}`;
      case "nearby-worlds": return `${record.planet || record.name || record.planetName || "系外惑星"} / ${formatNumber(record.distancePc, 2)}pc`;
      case "earth-scale-worlds": return `${record.planet || record.name || record.planetName || "系外惑星"} / 地球半径の${formatNumber(record.radiusEarth, 2)}倍`;
      case "ryugu-lidar": return `${formatNumber(record.rangeM, 0)} m / ${record.shotTime || "—"}`;
      default: return `${state.gestures.length} gestures / ${state.pulses.length} signals`;
    }
  };

  const interactionFeedback = (mode, record, point = null) => {
    const position = point ? `${Math.round(point.x * 100)}%地点` : "画面中央";
    switch (mode?.id) {
      case "solar-flare":
        return `${position}から${record?.classType || "選択中"}級のフレアを再生しました。光の場所はあなたの操作、光の大きさはNASAの観測等級です。`;
      case "coronal-mass-ejection":
        return `波を見る方向を動かしました。円弧の向きだけが観客の操作で、${formatNumber(record?.speedKmS, 0)}km/sという速度と噴出範囲は公開記録のままです。`;
      case "geomagnetic-storm":
        return `触れた場所の磁力線を一時的にたわませました。白い波紋はあなたの操作、線全体の震え方はKp ${formatNumber(record?.kp, 1)}の公開記録です。`;
      case "energetic-particles":
        return "指で引いた線を仮想シールドとして残しました。粒子の光が線を避けますが、観測記録そのものを書き換えたわけではありません。";
      case "close-approach":
        return `白い小惑星を通過経路の${Math.round((point?.x ?? 0.5) * 100)}%の位置へ動かしました。横位置は時間の操作です。最接近距離と速度は変えていません。`;
      case "fireball":
        return "ドラッグ方向を火球の仮想的な進入角へ反映しました。流れる向きだけが観客の操作で、明るさ・高度・速度は公開記録から決まります。";
      case "nearby-worlds":
        return `${record?.planet || record?.name || record?.planetName || "惑星"}を選びました。白く強い光が選択中の天体です。星図上の距離は比較しやすいよう圧縮しています。`;
      case "earth-scale-worlds":
        return `${record?.planet || record?.name || record?.planetName || "惑星"}を選びました。白い縁は選択表示です。円の大きさと色は公開された半径と平衡温度から変えていません。`;
      case "ryugu-lidar":
        return "触れた方向に最も近いレーザー測距点を選びました。白い点と探査機から伸びる線が、現在選択している測定です。";
      case "cosmic-senseware":
        return "データ源の節点を選びました。二つ目の節点を選ぶと線で結ばれます。この線は観客が作る仮想の関係で、物理的な因果関係ではありません。";
      default:
        return "白い波紋は、公開データではなく観客が触れた位置を示す操作の印です。";
    }
  };

  const showInteractionFeedback = (message) => {
    if (!ui.effect || !ui.effectRow) return;
    ui.effect.textContent = message;
    ui.effectRow.classList.remove("is-updated");
    void ui.effectRow.offsetWidth;
    ui.effectRow.classList.add("is-updated");
    window.clearTimeout(state.effectTimer);
    state.effectTimer = window.setTimeout(() => ui.effectRow.classList.remove("is-updated"), 1500);
  };

  const buildSpaceReceipt = () => {
    const mode = currentMode();
    const record = currentRecord();
    if (!mode || !state.snapshot) throw new Error("宇宙データを読み込めませんでした。");
    const sources = (mode.sourceIds || [])
      .map((sourceId) => state.snapshot.sources.find((source) => source.id === sourceId))
      .filter(Boolean);
    return {
      title: mode.title,
      source: `${mode.metric?.label || "観測値"} ${formatNumber(mode.metric?.value, 2)} ${mode.metric?.unit || ""}`.trim(),
      at: recordLabel(mode, record),
      provider: [...new Set(sources.map((source) => source.organisation).filter(Boolean))].join(" / "),
      classification: [...new Set(sources.map((source) => source.kind || "SOURCE"))].join(" + "),
      transform: (scenes?.encoding(mode, record) || []).map(([label, value]) => `${label}=${value}`).join(" / ") || mode.narrative,
      visual: mode.visualGuide || VISUAL_GUIDES[mode.id] || mode.narrative,
    };
  };
  const updateSpaceTransformationReceipt = () => {
    const root = document.querySelector("#space-transformation-receipt");
    if (!(root instanceof HTMLElement)) return;
    try {
      const value = buildSpaceReceipt();
      root.querySelector("[data-space-receipt-source]").textContent = [value.source, value.at].filter(Boolean).join(" / ");
      root.querySelector("[data-space-receipt-provider]").textContent = value.provider || "保存済み公開データ";
      root.querySelector("[data-space-receipt-transform]").textContent = value.transform;
      root.querySelector("[data-space-receipt-visual]").textContent = value.visual;
    } catch {
      root.querySelector("[data-space-receipt-source]").textContent = "宇宙データを読み込んでいます。";
    }
  };

  const updateInterface = () => {
    const mode = currentMode();
    if (!mode) return;
    const metric = mode.metric || {};
    const records = mode.records || [];
    const recordPosition = records.length ? (state.recordIndex % records.length) + 1 : 0;
    const accent = parseAccent(mode);
    const interaction = scenes?.interaction(mode);
    layer.dataset.scene = mode.id;
    layer.style.setProperty("--space-rgb", accent.join(", "));
    ui.number.textContent = formatIndex(state.modeIndex);
    ui.code.textContent = mode.code || mode.id;
    ui.title.textContent = mode.title;
    ui.titleEn.textContent = mode.titleEn || mode.code;
    ui.narrative.textContent = mode.narrative;
    ui.visualGuide.textContent = VISUAL_GUIDES[mode.id] || "光・線・色を、選択中の公開記録に対応させています。";
    ui.interaction.textContent = mode.interaction || interaction?.prompt || "画面に触れると、観測記録が光へ変わります。";
    const description = recordDescription(mode, currentRecord());
    ui.recordTitle.textContent = description.title;
    ui.recordDetail.textContent = description.detail;
    ui.metricLabel.textContent = metric.label || "SOURCE";
    ui.metricValue.textContent = formatNumber(metric.value, 2);
    ui.metricUnit.textContent = metric.unit || "";
    ui.metricDetail.textContent = recordLabel();
    ui.dateNote.textContent = state.snapshot.dateNote;
    ui.release.textContent = interaction?.button || (records.length ? "この記録を再生" : "信号を再生");
    ui.release.setAttribute(
      "aria-label",
      records.length ? `${mode.title}の現在の観測記録を再生` : `${mode.title}の信号を再生`,
    );
    ui.phase.textContent = records.length
      ? `記録 ${recordPosition} / ${records.length}　${interaction?.prompt || mode.interaction || "画面に触れて観測値を再生します。"}`
      : (interaction?.prompt || mode.interaction || "画面に触れると公開記録が波になります。");
    ui.modeList.querySelectorAll(".space-mode-option").forEach((button, index) => {
      button.setAttribute("aria-current", String(index === state.modeIndex));
    });
    if (!ui.dataPanel.hidden) renderDataPanel();
    updateSpaceTransformationReceipt();
  };

  function buildModeList() {
    ui.modeList.replaceChildren();
    state.snapshot.modes.forEach((mode, index) => {
      const button = document.createElement("button");
      const number = document.createElement("span");
      const title = document.createElement("strong");
      const code = document.createElement("small");
      button.type = "button";
      button.className = "space-mode-option";
      button.setAttribute("aria-label", `${formatIndex(index)} ${mode.title}`);
      button.setAttribute("aria-current", String(index === state.modeIndex));
      number.textContent = formatIndex(index);
      title.textContent = mode.title;
      code.textContent = mode.code;
      button.append(number, title, code);
      button.addEventListener("click", () => selectMode(index, true));
      ui.modeList.append(button);
    });
  }

  const selectMode = (index, release = false) => {
    const count = state.snapshot?.modes?.length || 10;
    state.modeIndex = (index + count) % count;
    state.recordIndex = 0;
    state.response = Math.max(state.response, 0.28);
    state.pulses = [];
    state.ripples = [];
    scenes?.resetMode(state);
    updateInterface();
    showInteractionFeedback("まだ操作していません。「図の読み方」を見ながら画面へ触れてください。白い波紋は観客の操作を示します。");
    if (release) launchSignal(state.pointer.y, "SOURCE");
  };

  const selectRecord = (direction) => {
    const records = currentMode()?.records || [];
    if (!records.length) return;
    state.recordIndex = (state.recordIndex + direction + records.length) % records.length;
    updateInterface();
    showInteractionFeedback(`${direction > 0 ? "次" : "前"}の公開記録へ切り替えました。図形の大きさ・速さ・色も、選んだ記録の値に合わせて変わります。`);
    launchSignal(0.36 + (state.recordIndex % 7) * 0.045, "SOURCE");
  };

  const resize = () => {
    const rectangle = layer.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, globalThis.GaiaFrameBudgetGovernor?.getDprCap?.() || 2);
    state.width = Math.max(1, rectangle.width);
    state.height = Math.max(1, rectangle.height);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    buildParticles();
  };

  const layout = () => {
    const compact = state.width < 700;
    const sourceRadius = compact
      ? Math.max(state.height * 0.82, state.width * 1.35)
      : Math.max(state.height * 0.86, state.width * 0.46);
    return {
      sourceX: -sourceRadius * (compact ? 0.78 : 0.58),
      sourceY: state.height * 0.52,
      sourceRadius,
      earthX: state.width * (compact ? 0.74 : 0.78),
      earthY: state.height * 0.5,
      earthRadius: Math.max(26, Math.min(state.width, state.height) * 0.048),
    };
  };

  const addRipple = (x, y, strength = 1, kind = "SCENARIO") => {
    state.ripples.push({ x, y, strength, kind, born: performance.now() });
    if (state.ripples.length > 28) state.ripples.shift();
  };

  const launchSignal = (targetY = 0.5, kind = "SOURCE") => {
    if (!state.snapshot) return;
    const parameters = modeParameters();
    const now = performance.now();
    state.pulses.push({
      born: now,
      duration: reducedMotion ? 2500 : parameters.pulseDuration,
      targetY: clamp(targetY, 0.15, 0.85),
      strength: parameters.density,
      spread: parameters.spread,
      kind,
      arrived: false,
      label: recordLabel(),
    });
    if (state.pulses.length > 10) state.pulses.shift();
    state.lastAutoPulse = now;
    layer.classList.add("has-interacted");
    ui.phase.textContent = `${recordLabel()} が、地球へ向かう光になりました。`;
  };

  const pointerPoint = (event) => {
    const rectangle = canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rectangle.left) / Math.max(1, rectangle.width)),
      y: clamp((event.clientY - rectangle.top) / Math.max(1, rectangle.height)),
    };
  };

  const revealInterface = () => {
    layer.classList.add("show-interface");
    window.clearTimeout(state.interfaceTimer);
    state.interfaceTimer = window.setTimeout(() => layer.classList.remove("show-interface"), 1800);
  };

  const flowPosition = (particle, time, parameters, scene) => {
    const cycle = (particle.x + time * parameters.speed * particle.speed) % 1.18;
    const x = (cycle - 0.08) * state.width;
    const baseY = particle.y * state.height;
    const breathing = Math.sin(time * (0.35 + particle.depth * 0.2) + particle.phase) * state.height * 0.014 * parameters.turbulence;
    const current = Math.sin(cycle * 10 + time * 0.55 + particle.phase) * state.height * 0.011 * parameters.turbulence;
    let y = baseY + breathing + current;

    const earthDistanceX = (x - scene.earthX) / (scene.earthRadius * 4.8);
    const earthInfluence = Math.exp(-earthDistanceX * earthDistanceX * 1.9);
    const side = Math.sign(y - scene.earthY) || particle.lane || 1;
    const verticalDistance = Math.abs(y - scene.earthY) / (scene.earthRadius * 4.2);
    const shell = Math.exp(-verticalDistance * verticalDistance * 1.35);
    y += side * earthInfluence * shell * scene.earthRadius * (1.25 + parameters.response * 1.2);

    state.ripples.forEach((ripple) => {
      const age = performance.now() - ripple.born;
      const radius = age * 0.11 * ripple.strength;
      const distance = Math.hypot(x - ripple.x, y - ripple.y);
      const band = Math.abs(distance - radius);
      if (band < 34) y += Math.sin((1 - band / 34) * Math.PI) * 12 * ripple.strength * Math.sign(y - ripple.y || 1);
    });
    return { x, y };
  };

  const drawBackground = (time, accent) => {
    const gradient = context.createLinearGradient(0, 0, state.width, state.height);
    gradient.addColorStop(0, "#02040a");
    gradient.addColorStop(0.48, "#030912");
    gradient.addColorStop(1, "#02060c");
    context.fillStyle = gradient;
    context.fillRect(0, 0, state.width, state.height);

    state.dust.forEach((star) => {
      const flicker = 0.45 + Math.sin(time * 0.6 + star.phase) * 0.3;
      context.fillStyle = `rgba(222,239,255,${star.alpha * flicker})`;
      context.fillRect(star.x * state.width, star.y * state.height, star.size, star.size);
    });
  };

  const drawSource = (time, accent, parameters, scene) => {
    const solarWhite = [255, 247, 204];
    const solarGold = [255, 190, 70];
    const solarOrange = [255, 101, 29];
    const solarRed = [132, 31, 19];
    const activity = clamp(0.35 + parameters.density * 0.65, 0.35, 1.15);
    const limbX = scene.sourceX + scene.sourceRadius;

    // Corona and long streamers sit behind the photosphere.
    context.save();
    context.globalCompositeOperation = "lighter";
    const corona = context.createRadialGradient(
      scene.sourceX,
      scene.sourceY,
      scene.sourceRadius * 0.78,
      scene.sourceX,
      scene.sourceY,
      scene.sourceRadius * 1.46,
    );
    corona.addColorStop(0, rgba(solarGold, 0.34 * activity));
    corona.addColorStop(0.22, rgba(solarOrange, 0.17 * activity));
    corona.addColorStop(0.58, rgba(solarGold, 0.055 * activity));
    corona.addColorStop(1, rgba(solarOrange, 0));
    context.fillStyle = corona;
    context.fillRect(0, 0, Math.min(state.width, limbX + scene.sourceRadius * 0.5), state.height);

    for (let ray = 0; ray < 58; ray += 1) {
      const angle = lerp(-1.12, 1.12, ray / 57) + Math.sin(time * 0.09 + ray * 0.73) * 0.004;
      const startRadius = scene.sourceRadius * (1.005 + (ray % 6) * 0.003);
      const reach = scene.sourceRadius * (1.1 + ((ray * 17) % 19) * 0.012 * activity);
      const startX = scene.sourceX + Math.cos(angle) * startRadius;
      const startY = scene.sourceY + Math.sin(angle) * startRadius;
      const endX = scene.sourceX + Math.cos(angle * 0.92) * reach;
      const endY = scene.sourceY + Math.sin(angle) * reach;
      context.strokeStyle = rgba(ray % 11 === 0 ? solarWhite : solarGold, ray % 11 === 0 ? 0.075 : 0.024);
      context.lineWidth = ray % 11 === 0 ? 1.1 : 0.55;
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(
        lerp(startX, endX, 0.38),
        lerp(startY, endY, 0.32) + Math.sin(ray * 0.81 + time * 0.16) * 12,
        lerp(startX, endX, 0.72),
        lerp(startY, endY, 0.74),
        endX,
        endY,
      );
      context.stroke();
    }
    context.restore();

    // The stable body of the Sun: a huge sphere mostly outside the viewport.
    context.save();
    context.beginPath();
    context.arc(scene.sourceX, scene.sourceY, scene.sourceRadius, 0, TAU);
    context.clip();
    const photosphere = context.createRadialGradient(
      scene.sourceX - scene.sourceRadius * 0.18,
      scene.sourceY - scene.sourceRadius * 0.14,
      scene.sourceRadius * 0.04,
      scene.sourceX,
      scene.sourceY,
      scene.sourceRadius * 1.03,
    );
    photosphere.addColorStop(0, "#fff6b6");
    photosphere.addColorStop(0.42, "#ffd45a");
    photosphere.addColorStop(0.72, "#ff9a2f");
    photosphere.addColorStop(0.91, "#ec591f");
    photosphere.addColorStop(1, "#7d2118");
    context.fillStyle = photosphere;
    context.fillRect(0, 0, Math.max(0, limbX + 2), state.height);

    context.globalCompositeOperation = "lighter";
    state.solarFibers.forEach((fiber, index) => {
      const angle = fiber.angle + Math.sin(time * 0.07 + fiber.phase) * 0.004;
      const radius = scene.sourceRadius * fiber.radial;
      context.strokeStyle = rgba(index % 7 === 0 ? solarWhite : solarGold, fiber.alpha);
      context.lineWidth = index % 7 === 0 ? 1.15 : 0.65;
      context.beginPath();
      context.arc(
        scene.sourceX,
        scene.sourceY,
        radius,
        angle - fiber.span,
        angle + fiber.span * 2.4,
      );
      context.stroke();
    });

    state.solarGranules.forEach((granule) => {
      const radius = scene.sourceRadius * granule.radial;
      const angle = granule.angle + Math.sin(time * 0.08 + granule.phase) * 0.002;
      const x = scene.sourceX + Math.cos(angle) * radius;
      const y = scene.sourceY + Math.sin(angle) * radius;
      if (x < -8 || x > limbX + 8 || y < -8 || y > state.height + 8) return;
      const limbFade = clamp((limbX - x) / Math.max(1, scene.sourceRadius * 0.34), 0.18, 1);
      context.fillStyle = rgba(granule.hot ? solarWhite : solarGold, granule.alpha * limbFade);
      context.beginPath();
      context.ellipse(x, y, granule.size * 2.3, granule.size * 0.72, angle, 0, TAU);
      context.fill();
    });

    // A few quiet sunspot groups keep the surface from reading as a flat disc.
    context.globalCompositeOperation = "source-over";
    const spotGroups = [
      { angle: -0.42, radial: 0.86, size: 0.016 },
      { angle: 0.08, radial: 0.79, size: 0.022 },
      { angle: 0.52, radial: 0.9, size: 0.013 },
    ];
    spotGroups.forEach((spot, index) => {
      const x = scene.sourceX + Math.cos(spot.angle) * scene.sourceRadius * spot.radial;
      const y = scene.sourceY + Math.sin(spot.angle) * scene.sourceRadius * spot.radial;
      if (x < -20 || x > state.width + 20) return;
      const size = scene.sourceRadius * spot.size;
      context.fillStyle = rgba(solarRed, 0.24);
      context.beginPath();
      context.ellipse(x, y, size * 2.4, size * 1.25, spot.angle, 0, TAU);
      context.fill();
      context.fillStyle = "rgba(48, 15, 13, 0.7)";
      context.beginPath();
      context.ellipse(x + index * 1.7, y, size, size * 0.55, spot.angle, 0, TAU);
      context.fill();
    });
    context.restore();

    // Hot limb and animated prominences are drawn last so the scale remains legible.
    context.save();
    context.globalCompositeOperation = "lighter";
    context.shadowColor = rgba(solarOrange, 0.72);
    context.shadowBlur = 24;
    context.strokeStyle = rgba(solarWhite, 0.72);
    context.lineWidth = 1.7;
    context.beginPath();
    context.arc(scene.sourceX, scene.sourceY, scene.sourceRadius, -1.04, 1.04);
    context.stroke();
    context.shadowBlur = 12;
    context.strokeStyle = rgba(solarOrange, 0.5);
    context.lineWidth = 4.5;
    context.beginPath();
    context.arc(scene.sourceX, scene.sourceY, scene.sourceRadius * 1.006, -1.02, 1.02);
    context.stroke();

    const drawProminence = (angle, span, height, phase) => {
      const animatedHeight = height * (0.92 + Math.sin(time * 0.35 + phase) * 0.08) * activity;
      const startAngle = angle - span;
      const endAngle = angle + span;
      const startX = scene.sourceX + Math.cos(startAngle) * scene.sourceRadius;
      const startY = scene.sourceY + Math.sin(startAngle) * scene.sourceRadius;
      const endX = scene.sourceX + Math.cos(endAngle) * scene.sourceRadius;
      const endY = scene.sourceY + Math.sin(endAngle) * scene.sourceRadius;
      const apexX = scene.sourceX + Math.cos(angle) * scene.sourceRadius * (1 + animatedHeight);
      const apexY = scene.sourceY + Math.sin(angle) * scene.sourceRadius * (1 + animatedHeight);
      context.strokeStyle = rgba(solarOrange, 0.44);
      context.lineWidth = 2.2;
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(apexX, apexY, apexX, apexY, endX, endY);
      context.stroke();
      context.strokeStyle = rgba(solarWhite, 0.2);
      context.lineWidth = 0.7;
      context.stroke();
    };
    drawProminence(-0.58, 0.055, 0.075, 0.2);
    drawProminence(0.34, 0.07, 0.1, 1.7);
    drawProminence(0.72, 0.045, 0.06, 3.1);
    context.restore();
  };

  const drawMagnetosphere = (time, accent, parameters, scene) => {
    const cyan = mixColor(accent, [156, 247, 255], 0.55);
    const response = clamp(parameters.response * 0.34 + state.response * 0.86, 0.08, 1.2);
    context.save();
    context.globalCompositeOperation = "lighter";

    for (let line = -18; line <= 18; line += 1) {
      const lane = line / 18;
      const distance = Math.abs(lane);
      const y = scene.earthY + lane * scene.earthRadius * 5.4;
      const bend = (1 - distance * 0.58) * scene.earthRadius * (1.6 + response * 1.2);
      const shimmer = Math.sin(time * 0.7 + line * 0.43) * scene.earthRadius * 0.08 * response;
      context.strokeStyle = rgba(cyan, (0.032 + (1 - distance) * 0.052) * response);
      context.lineWidth = line % 5 === 0 ? 1.05 : 0.55;
      context.beginPath();
      context.moveTo(scene.earthX - scene.earthRadius * 7.5, y);
      context.bezierCurveTo(
        scene.earthX - scene.earthRadius * 2.4,
        y - Math.sign(lane || 1) * bend + shimmer,
        scene.earthX + scene.earthRadius * 1.6,
        y - Math.sign(lane || 1) * bend * 0.45,
        state.width + 40,
        y + Math.sign(lane || 1) * scene.earthRadius * 0.7,
      );
      context.stroke();
    }

    const coreGlow = context.createRadialGradient(scene.earthX, scene.earthY, scene.earthRadius * 0.3, scene.earthX, scene.earthY, scene.earthRadius * 5.5);
    coreGlow.addColorStop(0, rgba(cyan, 0.055 + state.response * 0.15));
    coreGlow.addColorStop(0.18, rgba(cyan, 0.035 + state.response * 0.075));
    coreGlow.addColorStop(1, rgba(cyan, 0));
    context.fillStyle = coreGlow;
    context.fillRect(scene.earthX - scene.earthRadius * 6, 0, scene.earthRadius * 12, state.height);

    context.strokeStyle = rgba([210, 248, 255], 0.08 + state.response * 0.18);
    context.lineWidth = 0.7;
    context.beginPath();
    context.arc(scene.earthX, scene.earthY, scene.earthRadius, -1.2, 1.2);
    context.stroke();

    if (state.response > 0.05) {
      for (let ribbon = 0; ribbon < 7; ribbon += 1) {
        const start = -Math.PI * 0.86 + ribbon * 0.09;
        const end = -Math.PI * 0.18 + ribbon * 0.07;
        context.strokeStyle = rgba(ribbon % 2 ? cyan : accent, (0.07 + ribbon * 0.014) * state.response);
        context.lineWidth = 1.2 + ribbon * 0.45;
        context.beginPath();
        context.arc(scene.earthX, scene.earthY, scene.earthRadius * (1.15 + ribbon * 0.09), start, end);
        context.stroke();
      }
    }
    context.restore();
  };

  const drawFlow = (time, accent, parameters, scene) => {
    const pale = mixColor(accent, [235, 249, 255], 0.7);
    const visibleCount = Math.round(state.particles.length * clamp(parameters.density, 0.28, 1));
    const solarLimbX = Math.max(0, scene.sourceX + scene.sourceRadius * 0.985);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    for (let index = 0; index < visibleCount; index += 1) {
      const particle = state.particles[index];
      const point = flowPosition(particle, time, parameters, scene);
      if (point.x < solarLimbX || point.x > state.width + 20 || point.y < -30 || point.y > state.height + 30) continue;
      const trail = (10 + particle.speed * 28) * particle.depth * (1 + parameters.speed * 9);
      const color = particle.warm ? pale : accent;
      const alpha = (0.075 + particle.depth * 0.2) * (state.modeIndex === 9 ? 1.2 : 1);
      context.strokeStyle = rgba(color, alpha);
      context.lineWidth = Math.max(0.35, particle.size * 0.55);
      context.beginPath();
      context.moveTo(point.x - trail, point.y);
      context.quadraticCurveTo(point.x - trail * 0.35, point.y - particle.lane * 2.5, point.x, point.y);
      context.stroke();
    }
    context.restore();
  };

  const pulsePosition = (pulse, progress, scene) => {
    const eased = smooth(progress);
    const startX = Math.max(0, Math.min(state.width * 0.34, scene.sourceX + scene.sourceRadius * 0.99));
    const endX = scene.earthX - scene.earthRadius * 1.1;
    const startY = scene.sourceY;
    const endY = scene.earthY;
    const controlY = pulse.targetY * state.height;
    const oneMinus = 1 - eased;
    return {
      x: lerp(startX, endX, eased),
      y: oneMinus * oneMinus * startY + 2 * oneMinus * eased * controlY + eased * eased * endY,
    };
  };

  const drawPulses = (now, accent, scene) => {
    context.save();
    context.globalCompositeOperation = "lighter";
    state.pulses.forEach((pulse) => {
      const progress = clamp((now - pulse.born) / pulse.duration);
      const point = pulsePosition(pulse, progress, scene);
      const frontHeight = lerp(74, state.height * (0.27 + pulse.spread * 0.29), smooth(progress));
      const hot = pulse.kind === "SCENARIO" ? [255, 255, 255] : mixColor(accent, [255, 248, 230], 0.45);
      const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, frontHeight * 0.95);
      glow.addColorStop(0, rgba(hot, 0.48));
      glow.addColorStop(0.16, rgba(accent, 0.21));
      glow.addColorStop(1, rgba(accent, 0));
      context.fillStyle = glow;
      context.beginPath();
      context.arc(point.x, point.y, frontHeight, 0, TAU);
      context.fill();

      for (let echo = 0; echo < 5; echo += 1) {
        const echoX = point.x - echo * 15;
        context.strokeStyle = rgba(echo ? accent : hot, (0.34 - echo * 0.048) * (1 - progress * 0.18));
        context.lineWidth = echo === 0 ? 1.5 : 0.7;
        context.beginPath();
        context.ellipse(echoX, point.y, 7 + echo * 2, frontHeight * (1 - echo * 0.07), 0, -Math.PI / 2, Math.PI / 2);
        context.stroke();
      }

      const trail = Math.max(80, state.width * 0.22);
      const trailGradient = context.createLinearGradient(point.x - trail, point.y, point.x, point.y);
      trailGradient.addColorStop(0, rgba(accent, 0));
      trailGradient.addColorStop(1, rgba(hot, 0.4));
      context.strokeStyle = trailGradient;
      context.lineWidth = 0.9;
      context.beginPath();
      context.moveTo(point.x - trail, point.y);
      context.bezierCurveTo(point.x - trail * 0.6, point.y + Math.sin(now * 0.005) * 16, point.x - trail * 0.25, point.y - 10, point.x, point.y);
      context.stroke();

      if (progress >= 1 && !pulse.arrived) {
        pulse.arrived = true;
        pulse.arrivedAt = now;
        state.response = clamp(state.response + 0.75 * pulse.strength, 0, 1.4);
        addRipple(scene.earthX, scene.earthY, 1.5, pulse.kind);
        ui.phase.textContent = "届いた信号に、地球の磁気圏が光で応えています。";
      }
    });
    context.restore();
    state.pulses = state.pulses.filter((pulse) => !pulse.arrivedAt || now - pulse.arrivedAt < 3200);
  };

  const drawRipples = (now, accent) => {
    context.save();
    context.globalCompositeOperation = "lighter";
    state.ripples.forEach((ripple) => {
      const age = now - ripple.born;
      const progress = clamp(age / 2400);
      const radius = lerp(8, Math.min(state.width, state.height) * 0.24 * ripple.strength, smooth(progress));
      const alpha = (1 - progress) * (ripple.kind === "SCENARIO" ? 0.38 : 0.2);
      context.strokeStyle = rgba(ripple.kind === "SCENARIO" ? [245, 253, 255] : accent, alpha);
      context.lineWidth = 0.8;
      context.beginPath();
      context.arc(ripple.x, ripple.y, radius, 0, TAU);
      context.stroke();
    });
    context.restore();
    state.ripples = state.ripples.filter((ripple) => now - ripple.born < 2400);
  };

  const drawGestures = (now, accent) => {
    const gestures = state.draftGesture ? [...state.gestures, state.draftGesture] : state.gestures;
    context.save();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    context.lineJoin = "round";
    gestures.forEach((gesture) => {
      if (gesture.modeIndex !== undefined && gesture.modeIndex !== state.modeIndex && currentMode()?.id !== "cosmic-senseware") return;
      if (gesture.points.length < 2) return;
      const age = now - gesture.born;
      const alpha = state.draftGesture === gesture ? 0.7 : clamp(1 - age / 12000) * 0.32;
      context.strokeStyle = rgba([235, 252, 255], alpha);
      context.lineWidth = state.draftGesture === gesture ? 1.5 : 0.8;
      context.shadowColor = rgba(accent, alpha);
      context.shadowBlur = state.draftGesture === gesture ? 18 : 8;
      context.beginPath();
      gesture.points.forEach((point, index) => {
        const x = point.x * state.width;
        const y = point.y * state.height;
        if (!index) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    });
    context.restore();
    state.gestures = state.gestures.filter((gesture) => now - gesture.born < 12000);
  };

  const draw = (timestamp) => {
    if (!state.open) {
      state.frame = null;
      return;
    }
    const now = reducedMotion ? 0 : timestamp;
    const time = now / 1000;
    const parameters = modeParameters();
    const accent = parseAccent();
    const scene = layout();
    const delta = state.lastTime ? Math.min(48, timestamp - state.lastTime) : 16;
    state.lastTime = timestamp;
    state.response = Math.max(0, state.response - delta * 0.000055);

    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    const rendered = scenes?.render({
      ctx: context,
      state,
      now: timestamp,
      time,
      accent,
      mode: currentMode(),
      record: currentRecord(),
      parameters,
    });
    if (!rendered) {
      drawBackground(time, accent);
      drawSource(time, accent, parameters, scene);
      drawMagnetosphere(time, accent, parameters, scene);
      drawFlow(time, accent, parameters, scene);
      drawPulses(timestamp, accent, scene);
    } else {
      state.pulses = state.pulses.filter((pulse) => timestamp - pulse.born < pulse.duration + 2200);
    }
    drawRipples(timestamp, accent);
    if (!rendered || currentMode()?.id === "energetic-particles") drawGestures(timestamp, accent);
    if (currentMode()?.id === "solar-flare" && !state.pulses.length && timestamp - state.lastAutoPulse > 10500 && layer.classList.contains("has-interacted")) {
      launchSignal(0.35 + ((state.recordIndex + state.modeIndex) % 7) * 0.05, "SOURCE");
      state.recordIndex = (state.recordIndex + 1) % Math.max(1, currentMode()?.records?.length || 1);
      updateInterface();
    }
    state.frame = requestAnimationFrame(draw);
  };

  const addDefinition = (list, term, value) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    if (value instanceof Node) dd.append(value);
    else dd.textContent = value ?? "—";
    list.append(dt, dd);
  };

  const renderDataPanel = () => {
    const mode = currentMode();
    if (!mode || !state.snapshot) return;
    ui.dataContent.replaceChildren();
    ui.dataTitle.textContent = `${formatIndex(state.modeIndex)} ${mode.title}のデータ`;

    const derived = document.createElement("article");
    derived.className = "space-source-entry";
    const derivedKind = document.createElement("p");
    const derivedTitle = document.createElement("h4");
    const derivedList = document.createElement("dl");
    derivedKind.textContent = "DERIVED / DATA → LIGHT";
    derivedTitle.textContent = "この数字を、どう光へ変えたか";
    addDefinition(derivedList, "公開記録", recordLabel());
    addDefinition(derivedList, "作品化", mode.narrative);
    addDefinition(derivedList, "触れると", scenes?.interaction(mode)?.prompt || mode.interaction);
    (scenes?.encoding(mode, currentRecord()) || []).forEach(([label, value]) => {
      addDefinition(derivedList, label, value);
    });
    addDefinition(derivedList, "注意", "距離と時間は画面に収まるよう圧縮しています。公開値そのものと、観客が残した軌跡は混ぜていません。");
    derived.append(derivedKind, derivedTitle, derivedList);
    ui.dataContent.append(derived);

    const sources = (mode.sourceIds || [])
      .map((sourceId) => state.snapshot.sources.find((source) => source.id === sourceId))
      .filter(Boolean);
    sources.forEach((source) => {
      const article = document.createElement("article");
      article.className = "space-source-entry";
      const kind = document.createElement("p");
      const title = document.createElement("h4");
      const list = document.createElement("dl");
      const link = document.createElement("a");
      const previewTitle = document.createElement("p");
      const preview = document.createElement("pre");
      kind.textContent = `${source.kind || "SOURCE"} / ${source.status || "SNAPSHOT"}`;
      title.textContent = source.title;
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = source.url;
      addDefinition(list, "提供機関", source.organisation);
      addDefinition(list, "データ元", link);
      addDefinition(list, "取得日", source.retrievedAt);
      addDefinition(list, "期間", source.period);
      addDefinition(list, "単位", source.unit);
      addDefinition(list, "解像度", source.resolution);
      addDefinition(list, "加工", source.transformation);
      addDefinition(list, "注意事項", source.caveat);
      previewTitle.className = "space-source-preview-title";
      previewTitle.textContent = "RAW DATA / 先頭10行プレビュー";
      preview.textContent = JSON.stringify((source.preview || []).slice(0, 10), null, 2);
      article.append(kind, title, list, previewTitle, preview);
      ui.dataContent.append(article);
    });

    const scenario = document.createElement("article");
    scenario.className = "space-source-entry";
    const scenarioKind = document.createElement("p");
    const scenarioTitle = document.createElement("h4");
    const scenarioList = document.createElement("dl");
    scenarioKind.textContent = "SCENARIO / YOUR TRACE";
    scenarioTitle.textContent = "あなたが光へ残したもの";
    addDefinition(scenarioList, "軌跡", `${state.gestures.length}本`);
    addDefinition(scenarioList, "波", `${state.pulses.filter((pulse) => pulse.kind === "SCENARIO").length}回`);
    addDefinition(scenarioList, "意味", "観客の操作で生まれた仮想の痕跡です。NASA・JAXAの観測値ではありません。");
    scenario.append(scenarioKind, scenarioTitle, scenarioList);
    ui.dataContent.append(scenario);
  };

  const openDataPanel = () => {
    renderDataPanel();
    ui.dataPanel.hidden = false;
    ui.dataPanel.setAttribute("aria-hidden", "false");
    ui.dataButton.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => ui.dataClose.focus({ preventScroll: true }));
  };

  const closeDataPanel = ({ restoreFocus = true } = {}) => {
    ui.dataPanel.hidden = true;
    ui.dataPanel.setAttribute("aria-hidden", "true");
    ui.dataButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) ui.dataButton.focus({ preventScroll: true });
  };

  const openSpace = async (index = 0, options = {}) => {
    // Snapshot loading may outlive the shared transition cover. Suppress the
    // abstract WebGL base until the opaque space layer has claimed the screen.
    document.body.classList.add("gaia-space-preparing");
    try {
      await loadSnapshot();
    } catch (error) {
      document.body.classList.remove("gaia-space-preparing");
      throw error;
    }
    returnToNovel = options.returnTo === "novel";
    storyMode = returnToNovel && options.storyMode === "v6" ? "v6" : "";
    storyInteractionComplete = false;
    layer.dataset.returnTo = returnToNovel ? "novel" : "intro";
    if (storyMode) layer.dataset.storyMode = storyMode;
    else delete layer.dataset.storyMode;
    ui.close.textContent = returnToNovel ? "ストーリーへ戻る" : "戻る";
    ui.close.setAttribute("aria-label", returnToNovel ? "ストーリーへ戻る" : "宇宙モードを閉じてトップへ戻る");
    ui.close.disabled = storyMode === "v6";
    state.open = true;
    state.modeIndex = clamp(Number(index) || 0, 0, state.snapshot.modes.length - 1);
    state.recordIndex = 0;
    scenes?.resetMode(state);
    state.lastAutoPulse = performance.now();
    state.lastTime = 0;
    layer.hidden = false;
    layer.setAttribute("aria-hidden", "false");
    layer.classList.remove("has-interacted", "show-interface");
    document.body.classList.add("space-mode-open");
    document.body.classList.remove("gaia-space-preparing");
    document.body.classList.remove("gaia-route-handoff");
    resize();
    updateInterface();
    showInteractionFeedback("まだ操作していません。「図の読み方」を見ながら画面へ触れてください。白い波紋は観客の操作を示します。");
    layer.classList.remove("is-entering");
    void layer.offsetWidth;
    layer.classList.add("is-entering");
    window.setTimeout(() => layer.classList.remove("is-entering"), 1900);
    if (state.frame === null) state.frame = requestAnimationFrame(draw);
    requestAnimationFrame(() => ui.close.focus({ preventScroll: true }));
  };

  const closeSpaceNow = ({ returnToTop = true } = {}) => {
    if (!state.open) return;
    if (storyMode === "v6" && !storyInteractionComplete) return;
    const shouldReturnToNovel = returnToNovel;
    if (!ui.dataPanel.hidden) closeDataPanel({ restoreFocus: false });
    window.clearTimeout(state.interfaceTimer);
    window.clearTimeout(state.effectTimer);
    state.open = false;
    state.pointer.down = false;
    state.draftGesture = null;
    layer.hidden = true;
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("space-mode-open");
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    state.frame = null;
    delete layer.dataset.returnTo;
    delete layer.dataset.storyMode;
    returnToNovel = false;
    storyMode = "";
    storyInteractionComplete = false;
    if (shouldReturnToNovel) window.dispatchEvent(new CustomEvent("gaia:space-return-to-novel"));
    else if (returnToTop) ui.intro?.click();
  };

  const closeSpace = (options = {}, event = null) => runSceneTransition(() => closeSpaceNow(options), event);

  canvas.addEventListener("pointermove", (event) => {
    const point = pointerPoint(event);
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    state.pointer.visible = true;
    if (point.x < 0.25 || point.x > 0.86 || point.y > 0.84) revealInterface();
    if (!state.pointer.down || !state.draftGesture) return;
    const previous = state.draftGesture.points[state.draftGesture.points.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.005) {
      state.draftGesture.points.push(point);
    }
    if (performance.now() - state.lastTouchRipple > 95) {
      addRipple(point.x * state.width, point.y * state.height, 0.52, "SCENARIO");
      state.lastTouchRipple = performance.now();
    }
  });

  canvas.addEventListener("pointerleave", () => {
    if (!state.pointer.down) state.pointer.visible = false;
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const point = pointerPoint(event);
    state.pointer.x = point.x;
    state.pointer.y = point.y;
    state.pointer.down = true;
    state.pointer.visible = true;
    state.draftGesture = { born: performance.now(), points: [point], modeIndex: state.modeIndex };
    addRipple(point.x * state.width, point.y * state.height, 1, "SCENARIO");
    const sceneResult = scenes?.pointerDown({ state, mode: currentMode(), point });
    if (sceneResult?.changedRecord) updateInterface();
    launchSignal(point.y, "SCENARIO");
    showInteractionFeedback(interactionFeedback(currentMode(), currentRecord(), point));
    const interaction = scenes?.interaction(currentMode());
    if (interaction) ui.phase.textContent = interaction.prompt;
    canvas.setPointerCapture?.(event.pointerId);
    if (storyMode === "v6" && !storyInteractionComplete) {
      storyInteractionComplete = true;
      ui.close.disabled = false;
      window.dispatchEvent(new CustomEvent("gaia:space-story-progress", { detail: { complete: true } }));
    }
  });

  const finishGesture = () => {
    state.pointer.down = false;
    if (state.draftGesture?.points.length > 1) {
      state.gestures.push(state.draftGesture);
      if (state.gestures.length > 12) state.gestures.shift();
    }
    state.draftGesture = null;
  };
  canvas.addEventListener("pointerup", finishGesture);
  canvas.addEventListener("pointercancel", finishGesture);

  ui.release.addEventListener("click", () => {
    const result = scenes?.activate({ state, mode: currentMode() });
    if (result?.changedRecord) updateInterface();
    launchSignal(0.5, "SOURCE");
    showInteractionFeedback(interactionFeedback(currentMode(), currentRecord()));
    const interaction = scenes?.interaction(currentMode());
    if (interaction) ui.phase.textContent = interaction.prompt;
    if (storyMode === "v6" && !storyInteractionComplete) {
      storyInteractionComplete = true;
      ui.close.disabled = false;
      window.dispatchEvent(new CustomEvent("gaia:space-story-progress", { detail: { complete: true } }));
    }
  });
  ui.previous.addEventListener("click", () => selectRecord(-1));
  ui.next.addEventListener("click", () => selectRecord(1));
  ui.close.addEventListener("click", (event) => closeSpace({}, event));
  ui.dataButton.addEventListener("click", () => ui.dataPanel.hidden ? openDataPanel() : closeDataPanel());
  ui.dataClose.addEventListener("click", () => closeDataPanel());
  openButtons.forEach((button) => {
    button.addEventListener("click", (event) => runSceneTransition(() => openSpace(), event));
  });

  window.addEventListener("gaia:space-open-at-mode", (event) => {
    const index = Number(event.detail?.index);
    openSpace(Number.isInteger(index) ? index : 0, event.detail || {});
  });

  window.addEventListener("gaia:space-close", (event) => {
    closeSpaceNow({ returnToTop: Boolean(event.detail?.returnToTop) });
  });

  window.addEventListener("resize", () => {
    if (state.open) resize();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state.frame !== null) cancelAnimationFrame(state.frame);
      state.frame = null;
      return;
    }
    if (state.open && state.frame === null) {
      state.lastTime = 0;
      state.frame = requestAnimationFrame(draw);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!state.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (!ui.dataPanel.hidden) closeDataPanel();
      else closeSpace();
    } else if (event.key === "ArrowLeft" && ui.dataPanel.hidden) {
      event.preventDefault();
      selectRecord(-1);
    } else if (event.key === "ArrowRight" && ui.dataPanel.hidden) {
      event.preventDefault();
      selectRecord(1);
    } else if (/^[1-9]$/.test(event.key) && ui.dataPanel.hidden) {
      selectMode(Number(event.key) - 1, true);
    } else if (event.key === "0" && ui.dataPanel.hidden) {
      selectMode(9, true);
    } else if ((event.key === " " || event.key === "Enter") && event.target === canvas) {
      event.preventDefault();
      launchSignal(state.pointer.y, "SCENARIO");
      if (storyMode === "v6" && !storyInteractionComplete) {
        storyInteractionComplete = true;
        ui.close.disabled = false;
        window.dispatchEvent(new CustomEvent("gaia:space-story-progress", { detail: { complete: true } }));
      }
    }
  });

  const requestedMode = Number.parseInt(new URLSearchParams(window.location.search).get("space"), 10);
  if (Number.isInteger(requestedMode) && requestedMode >= 1 && requestedMode <= 10) {
    const launchRequestedMode = () => {
      if (!state.open) openSpace(requestedMode - 1);
    };
    window.addEventListener("gaia:opening-complete", launchRequestedMode, { once: true });
    window.setTimeout(launchRequestedMode, 6200);
  }

  const clearTourFocus = () => {
    layer.querySelectorAll(".gaia-tour-highlight-target").forEach((element) => {
      element.classList.remove("gaia-tour-highlight-target");
      element.removeAttribute("data-gaia-tour-target");
    });
  };
  const focusTourControl = (name) => {
    clearTourFocus();
    const target = { canvas, launch: ui.release, data: ui.dataButton }[name];
    if (!(target instanceof HTMLElement)) return false;
    target.classList.add("gaia-tour-highlight-target");
    target.setAttribute("data-gaia-tour-target", name);
    target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    return true;
  };
  const getTourReceipt = buildSpaceReceipt;

  loadSnapshot().catch(() => {});
  window.GaiaSpace = { open: openSpace, close: closeSpaceNow };
  window.GaiaSpaceTourAdapter = Object.freeze({
    waitReady: loadSnapshot,
    openAtMode: (index = 0) => openSpace(index, { returnToTop: false, source: "tour" }),
    close: () => { clearTourFocus(); closeSpaceNow({ returnToTop: false }); },
    focusControl: focusTourControl,
    clearFocus: clearTourFocus,
    launch: () => { ui.release.click(); return getTourReceipt(); },
    getTourReceipt,
    getState: () => ({ open: state.open, modeIndex: state.modeIndex, recordIndex: state.recordIndex, frameActive: state.frame !== null }),
  });
  window.dispatchEvent(new CustomEvent("gaia:space-tour-adapter-ready"));
})();
