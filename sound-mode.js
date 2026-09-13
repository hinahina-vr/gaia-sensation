/**
 * 概要: 音楽鑑賞画面。共通の音声再生処理と連携し、曲選択・再生操作・曲情報の表示をまとめる。
 */
(() => {
  "use strict";

  const layer = document.querySelector("#sound-layer");
  if (!layer) return;

  const closeButton = document.querySelector("#sound-close");
  const playButton = document.querySelector("#sound-play");
  const progress = document.querySelector("#sound-progress");
  const currentTime = document.querySelector("#sound-current-time");
  const duration = document.querySelector("#sound-duration");
  const volume = document.querySelector("#sound-volume");
  const volumeValue = document.querySelector("#sound-volume-value");
  const trackNumber = document.querySelector("#sound-track-number");
  const trackTitle = document.querySelector("#sound-track-title");
  const description = document.querySelector("#sound-mode-description");
  const visualizerCanvas = document.querySelector("#sound-visualizer");
  const trackButtons = Array.from(document.querySelectorAll("[data-sound-track]"));
  const openButtons = Array.from(document.querySelectorAll("[data-sound-gallery-open]"));

  const constellationPatterns = Object.freeze([
    // Original asterisms, not astronomical identifications. The last coordinate
    // is visual magnitude: 2 = principal star, 1 = companion, 0 = distant star.
    { name: "dawn-wing", stars: [[12,61,2],[23,31,1],[39,43,0],[54,18,2],[70,34,1],[87,28,0],[64,64,0],[81,60,1]], paths: [[0,1,2,3,4,5],[2,6,7]] },
    { name: "window-lyre", stars: [[12,29,1],[28,12,2],[47,27,0],[76,18,1],[66,47,0],[45,68,2],[24,55,0],[47,45,1]], paths: [[0,1,2,3],[2,7,5,6,0],[7,4,3]] },
    { name: "quiet-swan", stars: [[13,50,1],[32,42,0],[49,31,2],[56,12,1],[64,45,0],[88,57,2],[50,63,1],[30,67,0]], paths: [[0,1,2,3],[2,4,5],[2,6,7]] },
    { name: "first-light", stars: [[12,62,1],[16,39,0],[34,19,1],[56,12,2],[77,23,1],[88,45,0],[80,63,2],[54,44,0]], paths: [[0,1,2,3,4,5,6],[3,7]] },
    { name: "folded-wind", stars: [[11,25,1],[40,16,0],[59,30,2],[84,12,1],[75,48,0],[88,67,1],[52,60,2],[32,45,0]], paths: [[0,1,2,3],[2,4,5,6,7,0],[7,2]] },
    { name: "snow-flame", stars: [[21,64,1],[40,47,2],[29,26,0],[54,10,2],[73,29,1],[61,47,0],[82,62,1]], paths: [[0,1,2,3,4,5,6],[1,5]] },
    { name: "departing-orbit", stars: [[10,59,0],[29,47,1],[42,27,2],[60,16,0],[79,24,1],[87,45,2],[67,64,0],[50,51,1]], paths: [[0,1,2,3,4,5],[2,7,6]] },
    { name: "moon-notebook", stars: [[75,12,2],[49,10,0],[27,22,1],[16,43,2],[28,63,0],[54,70,1],[74,56,0],[43,43,1]], paths: [[0,1,2,3,4,5,6],[3,7,0]] },
    { name: "woven-world", stars: [[49,10,2],[77,29,1],[86,54,0],[60,68,2],[27,60,0],[12,38,1],[32,30,0],[52,42,1]], paths: [[0,1,2,3,4,5,6,0],[6,7,3]] },
    { name: "blue-tide", stars: [[14,59,2],[26,36,0],[43,24,1],[35,10,0],[68,18,2],[82,38,0],[63,55,1],[85,66,0]], paths: [[0,1,2,4,5,6,7],[2,3]] },
    { name: "afterglow", stars: [[15,19,1],[45,11,2],[68,23,0],[78,52,1],[56,68,2],[24,62,1],[35,42,0]], paths: [[0,1,2,6,0],[6,3,4,5,6]] },
    { name: "horizon-bird", stars: [[10,49,1],[31,26,0],[52,32,2],[74,15,1],[91,26,0],[72,49,2],[58,67,0],[36,60,1]], paths: [[0,1,2,3,4],[2,5,6,7],[5,4]] },
  ]);

  const setupSoundMorphPrototype = () => {
    const svgNamespace = "http://www.w3.org/2000/svg";
    layer.classList.add("sound-morph-prototype");

    const nowPlaying = layer.querySelector(".sound-now-playing");
    if (nowPlaying instanceof HTMLElement && !nowPlaying.querySelector(".sound-cover-art")) {
      const cover = document.createElement("span");
      cover.className = "sound-cover-art";
      cover.setAttribute("aria-hidden", "true");
      const coverImage = document.createElement("img");
      coverImage.alt = "";
      coverImage.decoding = "async";
      cover.append(coverImage);
      nowPlaying.prepend(cover);
    }

    const transport = layer.querySelector(".sound-transport");
    if (transport instanceof HTMLElement && !transport.querySelector(".sound-player-signal")) {
      const signalCanvas = document.createElement("canvas");
      signalCanvas.className = "sound-player-signal";
      signalCanvas.setAttribute("aria-hidden", "true");
      signalCanvas.dataset.renderer = "audio-waveform-ribbon";
      transport.append(signalCanvas);
    }

    trackButtons.forEach((button, index) => {
      const number = button.querySelector(":scope > span");
      const copy = button.querySelector(":scope > div");
      const title = copy?.querySelector("strong");
      const meta = copy?.querySelector("small");
      if (!(number instanceof HTMLElement) || !(copy instanceof HTMLElement) || !(title instanceof HTMLElement)) return;

      number.classList.add("sound-track-index");
      copy.classList.add("sound-track-copy");
      title.classList.add("sound-track-name");
      meta?.classList.add("sound-track-meta");
      button.setAttribute("aria-label", `${number.textContent?.trim() || ""} ${title.textContent?.trim() || ""}`.trim());

      const glyph = document.createElement("span");
      glyph.className = "sound-track-constellation";
      glyph.setAttribute("aria-hidden", "true");
      glyph.style.setProperty("--constellation-drift-duration", `${9.2 + (index % 5) * 0.83}s`);
      glyph.style.setProperty("--constellation-drift-delay", `${-0.61 * index}s`);
      const glyphSvg = document.createElementNS(svgNamespace, "svg");
      glyphSvg.setAttribute("viewBox", "0 0 100 80");
      const pattern = constellationPatterns[index % constellationPatterns.length];
      glyph.dataset.asterism = pattern.name;
      const makeSvg = (tag, attributes) => {
        const element = document.createElementNS(svgNamespace, tag);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
        return element;
      };
      const defs = makeSvg("defs", {});
      const haloId = `sound-star-halo-${index}`;
      const halo = makeSvg("radialGradient", { id: haloId });
      [[0,.95],[.12,.62],[.34,.2],[.66,.045],[1,0]].forEach(([offset, opacity]) => {
        halo.append(makeSvg("stop", { offset, "stop-color": "currentColor", "stop-opacity": opacity }));
      });
      const inkId = `sound-star-ink-${index}`;
      const ink = makeSvg("linearGradient", { id: inkId, gradientUnits: "userSpaceOnUse", x1: 12, y1: 0, x2: 80, y2: 80 });
      [[0,.4],[.4,.95],[1,.45]].forEach(([offset, opacity]) => {
        ink.append(makeSvg("stop", { offset, "stop-color": "currentColor", "stop-opacity": opacity }));
      });
      defs.append(halo, ink); glyphSvg.append(defs);
      pattern.paths.forEach((indices, pathIndex) => {
        const points = indices.map(i => pattern.stars[i].slice(0, 2).join(",")).join(" ");
        const trace = makeSvg("polyline", { points, stroke: `url(#${inkId})`, "vector-effect": "non-scaling-stroke", class: `sound-star-trace${pathIndex ? " is-branch" : ""}` });
        const glow = makeSvg("polyline", { points, "vector-effect": "non-scaling-stroke", class: "sound-star-thread-light" });
        glyphSvg.append(glow, trace);
      });
      let glintIndex = 0;
      pattern.stars.forEach(([cx, cy, magnitude], pointIndex) => {
        const principal = magnitude === 2;
        const star = makeSvg("g", { transform: `translate(${cx} ${cy})`, class: `sound-constellation-star${principal ? " is-principal" : magnitude === 0 ? " is-distant" : ""}` });
        star.style.setProperty("--star-period", `${5.4 + ((index * 3 + pointIndex * 2) % 9) * .47}s`);
        star.style.setProperty("--star-delay", `${-((index * 1.31 + pointIndex * 1.79) % 9)}s`);
        star.append(makeSvg("circle", { r: principal ? 12.5 : magnitude === 1 ? 6.5 : 3.4, fill: `url(#${haloId})`, class: "sound-star-halo" }));
        if (principal) {
          star.append(makeSvg("path", { d: "M0-4.3 .42-.45 3.2 0 .42.45 0 4.3-.42.45-3.2 0-.42-.45Z", class: "sound-star-rays" }));
          const glint = makeSvg("path", { d: "M0-6.5C.4-1 .7-.5 4.5 0C.7.5 .4 1 0 6.5C-.4 1-.7.5-4.5 0C-.7-.5-.4-1 0-6.5Z", class: "sound-constellation-glint" });
          glint.style.setProperty("--glint-duration", `${6.4 + ((index * 3 + glintIndex * 5) % 9) * .43}s`);
          glint.style.setProperty("--glint-delay", `${-((index * 1.73 + glintIndex * 3.19) % 9)}s`);
          star.append(glint); glintIndex++;
        }
        star.append(makeSvg("circle", { r: principal ? 1.5 : magnitude === 1 ? 1.03 : .66, class: "sound-star-core" }));
        glyphSvg.append(star);
      });
      [[12 + index % 4 * 4, 11], [88, 67 - index % 3 * 4]].forEach(([cx, cy]) => {
        glyphSvg.append(makeSvg("circle", { cx, cy, r: .45, class: "sound-star-background" }));
      });
      glyph.append(glyphSvg);

      const morphCanvas = document.createElement("canvas");
      morphCanvas.className = "sound-track-morph-canvas";
      morphCanvas.dataset.title = title.textContent?.trim() || "";
      morphCanvas.setAttribute("aria-hidden", "true");
      copy.prepend(morphCanvas);
      button.prepend(glyph);
    });

    const trackPanel = layer.querySelector(".sound-track-panel");
    window.GaiaSoundConstellation.mount(layer, trackButtons, trackPanel);
  };

  setupSoundMorphPrototype();
  const signalRibbonCanvas = layer.querySelector(".sound-player-signal");
  let signalLayout = null;
  const measureSignalLayout = () => {
    if (!signalRibbonCanvas || !progress) return;
    const canvasRect = signalRibbonCanvas.getBoundingClientRect();
    const inputRect = progress.getBoundingClientRect();
    signalLayout = {
      width: Math.round(canvasRect.width), height: Math.round(canvasRect.height),
      start: inputRect.left - canvasRect.left + 8.5,
      end: inputRect.right - canvasRect.left - 8.5,
      centerY: inputRect.top - canvasRect.top + inputRect.height / 2,
    };
  };
  const signalResizeObserver = new ResizeObserver(measureSignalLayout);
  if (signalRibbonCanvas) signalResizeObserver.observe(signalRibbonCanvas);
  if (progress) signalResizeObserver.observe(progress);

  const tracks = Object.freeze({
    opening: {
      number: "TRACK 01 / OPENING THEME",
      title: "Planet Forecast - Hope",
      description: "『惑星の放課後』オープニングテーマ。地球と生命、そして私たちの物語への入口をひらく。",
      planet: "PLANET 01",
      signal: "FORECAST SIGNAL",
      cover: "./assets/visuals-07/opening-keyvisual-v2-834.webp",
      coverPosition: "72% 44%",
    },
    story: {
      number: "TRACK 02 / STORY THEME",
      title: "Planet Forecast — Windowlight",
      description: "カーテン越しの木漏れ日から、あの日をふと思い出す。",
      planet: "PLANET 02",
      signal: "STORY RESONANCE",
      cover: "./assets/visuals-07/sound-archive-bg-v3.png?v=gaia-sound-selected-20260913",
      coverPosition: "68% 48%",
    },
    windowlight: {
      number: "TRACK 03 / OBSERVATION ROOM",
      title: "Planet Forecast — Calm",
      description: "水面へ柔らかに射す午後の光が、世界を包む。",
      planet: "PLANET 03",
      signal: "WINDOWLIGHT TRACE",
      cover: "./assets/visuals-07/novel-bg-workroom-v2.png",
      coverPosition: "42% 50%",
    },
    firstlight: {
      number: "TRACK 04 / DAWN THEME",
      title: "Planet Forecast — First Light",
      description: "碧へ溶ける水平線、小さな依り代が新しい朝を捉える。",
      planet: "PLANET 04",
      signal: "FIRST LIGHT TRACE",
      cover: "./assets/visuals-07/novel-bg-mizuha-room-morning-v1.png",
      coverPosition: "60% 44%",
    },
    foldedwind: {
      number: "TRACK 05 / UNSENT RECORD",
      title: "折り目の向こうの風",
      description: "潮風に解かれた記録が、誰かの手元へそっと舞い降りる。",
      planet: "PLANET 05",
      signal: "FOLDED WIND TRACE",
      cover: "./assets/visuals-07/novel-bg-production-return-train-v1.png",
      coverPosition: "54% 48%",
    },
    snowfire: {
      number: "TRACK 06 / UNKNOWN SIGNAL",
      title: "雪火の観測信号",
      description: "冷たい数値の底に揺らぐ、微かな熱に耳を澄ます。",
      planet: "PLANET 06",
      signal: "SNOWFIRE SIGNAL",
      cover: "./assets/visuals-07/novel-bg-production-night-v2.png",
      coverPosition: "52% 55%",
    },
    snowafter: {
      number: "TRACK 07 / BRANCHING LIGHT",
      title: "雪火、軌道の外へ",
      description: "決定論的な世界から、まだ見ぬ方角へ光の筋がこぼれる。",
      planet: "PLANET 07",
      signal: "SNOWFIRE AFTERIMAGE",
      cover: "./assets/true-end/true-end-bg-pregeometry-loom-v1.webp",
      coverPosition: "64% 40%",
    },
    moonbook: {
      number: "TRACK 08 / NIGHT NOTE",
      title: "月明かりの観測ノート",
      description: "夜の机に月光を落とし、事実と思索のあわいを辿る。",
      planet: "PLANET 08",
      signal: "MOONLIT NOTE",
      cover: "./assets/visuals-07/novel-bg-sakuya-room-night-v1.png",
      coverPosition: "54% 50%",
    },
    senseware: {
      number: "TRACK 09 / SYSTEM THEME",
      title: "GAIA SENSEWARE",
      description: "ピアノと大気の吐息が、巡る星の記憶を包み込む。",
      planet: "PLANET 09",
      signal: "SOURCE SAVE",
      cover: "./assets/visuals-07/open-data-archive-bg-v1-834.webp",
      coverPosition: "44% 46%",
    },
    moonreopen: {
      number: "TRACK 10 / BLUE GLASS TIDE",
      title: "青硝子の潮汐",
      description: "玻璃の波打ち際から、記録を読み解いていく。",
      planet: "PLANET 10",
      signal: "BLUE GLASS TIDE",
      cover: "./assets/visuals-07/novel-bg-zushi-coast-night-v2.png",
      coverPosition: "38% 48%",
    },
    ending: {
      number: "TRACK 11 / ENDING THEME",
      title: "AfterSchool, AfterGlow",
      description: "茜色の名残を胸に、次の時代へと針を進める。",
      planet: "PLANET 11",
      signal: "AFTERGLOW SIGNAL",
      cover: "./assets/ending-candidates-20260909/01-turning-in-the-sunset.webp",
      coverPosition: "66% 46%",
    },
    trueend: {
      number: "TRACK 12 / Beyond",
      title: "Sensory Horizon",
      description: "惑星と無限の彼方、無数の星へ溶けていく意識の涯。",
      planet: "PLANET 12",
      signal: "SENSORY HORIZON",
      cover: "./assets/true-end/true-end-bg-galactic-senses-v1.webp",
      coverPosition: "56% 44%",
    },
  });
  const trackKeys = Object.freeze(Object.keys(tracks));

  let isOpen = false;
  let isScrubbing = false;
  let animationFrame = 0;
  let lastInterfaceRenderAt = -Infinity;
  let lastSignalRibbonDrawAt = -Infinity;
  let visualizerVisibleUntil = 0;
  let lastFocused = null;
  let visualizerRuntime = null;
  let visualizerState = {
    playing: false,
    volume: 0.1,
    outputVolume: 0,
    currentTime: 0,
    duration: 0,
    track: "opening",
    bands: [0, 0, 0],
    spectrum: Array(32).fill(0),
    waveform: Array(64).fill(0),
    peak: 0,
    rms: 0,
    analysisActive: false,
    analysisSupported: false,
  };

  const getAudio = () => window.GaiaOpeningAudio;
  const archiveTrack = (track) => track === "sensorfield" ? "moonbook" : track;
  // Catalog availability is independent of listening history. Keep that history
  // truthful: showing every track must not mark unplayed recordings as heard.
  const isAvailable = (track) => Object.hasOwn(tracks, track);
  const activeAvailableTrack = (state) => {
    const track = archiveTrack(state?.track);
    return isAvailable(track) ? track : "";
  };
  const emptyPresentation = {
    number: "全12曲",
    title: "曲を選んでください",
    description: "作品を彩る全12曲を、最初から自由に聴くことができます。",
  };
  const syncTrackAvailability = () => {
    trackButtons.forEach((button, index) => {
      const track = button.dataset.soundTrack;
      const available = isAvailable(track);
      const title = available ? tracks[track].title : "収録曲ではありません";
      button.disabled = !available;
      button.setAttribute("aria-disabled", String(!available));
      button.classList.toggle("is-locked", !available);
      button.setAttribute("aria-label", `${String(index + 1).padStart(2, "0")} ${title}`);
      button.querySelector(".sound-track-name").textContent = title;
      button.querySelector(".sound-track-meta").textContent = available
        ? tracks[track].number.split(" / ")[1] : "";
      const canvas = button.querySelector(".sound-track-morph-canvas");
      canvas.dataset.title = available ? title : "";
      const glyph = button.querySelector(".sound-track-constellation");
      glyph.dataset.asterism = available ? constellationPatterns[index].name : "locked";
    });
    const count = trackKeys.filter(isAvailable).length;
    layer.querySelector(".sound-track-heading strong").textContent = `全${count}曲`;
  };

  const nowPlaying = layer.querySelector(".sound-now-playing");
  // A second control for the same audio state stays reachable after scrolling the track list.
  const miniPlayer = document.createElement('div');miniPlayer.id='sound-mini-player';
  miniPlayer.innerHTML='<span id="sound-mini-title"></span><button type="button" id="sound-mini-play" aria-describedby="sound-mini-title"></button>';
  layer.append(miniPlayer);
  const miniTitle=miniPlayer.querySelector('span'),miniPlay=miniPlayer.querySelector('button');
  const playerPanel = layer.querySelector(".sound-player");
  const coverImage = nowPlaying?.querySelector(".sound-cover-art img");
  const presentationMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coverCache = new Map();
  let requestedPresentation = "";
  let presentedTrack = "";
  let presentationGeneration = 0;
  let presentationEcho = null;
  let presentationTimer = 0;
  let presentationMeasureFrame = 0;
  let presentationWidth = 0;

  const prepareCover = (track) => {
    if (!isAvailable(track)) return Promise.resolve(null);
    if (coverCache.has(track)) return coverCache.get(track);
    const artwork = new Image();
    artwork.decoding = "async";
    artwork.src = tracks[track].cover;
    const ready = artwork.decode().then(() => artwork, () => artwork.naturalWidth ? artwork : null);
    coverCache.set(track, ready);
    return ready;
  };

  const clearPresentationMotion = () => {
    window.clearTimeout(presentationTimer);
    presentationTimer = 0;
    presentationEcho?.remove();
    presentationEcho = null;
    nowPlaying?.classList.remove("is-track-changing");
    playerPanel?.classList.remove("is-track-changing");
  };

  const makePresentationCopy = () => {
    const copy = nowPlaying.cloneNode(true);
    copy.removeAttribute("id");
    copy.removeAttribute("aria-live");
    copy.removeAttribute("aria-busy");
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    copy.classList.remove("is-track-changing");
    copy.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    return copy;
  };

  // Reserve the tallest recording's copy at this width. Changing from a long
  // English title to a short Japanese one must not move the seek/volume controls.
  const measurePresentation = () => {
    presentationMeasureFrame = 0;
    if (!isOpen || !nowPlaying || !playerPanel) return;
    const width = nowPlaying.offsetWidth;
    if (!width) return;
    presentationWidth = width;
    const probe = makePresentationCopy();
    probe.classList.add("sound-player-measure");
    probe.style.width = `${width}px`;
    playerPanel.append(probe);
    let height = 0;
    for (const metadata of [emptyPresentation, ...trackKeys.filter(isAvailable).map(track => tracks[track])]) {
      probe.querySelector("p:first-of-type").textContent = metadata.number;
      probe.querySelector("h3").textContent = metadata.title;
      probe.querySelector("p:last-child").textContent = metadata.description;
      height = Math.max(height, probe.offsetHeight);
    }
    probe.remove();
    nowPlaying.style.minHeight = `${Math.ceil(height)}px`;
    measureSignalLayout();
  };

  const requestPresentationMeasure = () => {
    cancelAnimationFrame(presentationMeasureFrame);
    presentationMeasureFrame = requestAnimationFrame(measurePresentation);
  };
  const presentationResizeObserver = new ResizeObserver(() => {
    if (!isOpen || !nowPlaying) return;
    if (nowPlaying.offsetWidth === presentationWidth) return;
    clearPresentationMotion();
    requestPresentationMeasure();
  });
  if (nowPlaying) presentationResizeObserver.observe(nowPlaying);
  document.fonts?.ready.then(requestPresentationMeasure);
  presentationMotion.addEventListener("change", () => {
    if (presentationMotion.matches) clearPresentationMotion();
  });

  const presentTrack = (track) => {
    if (!nowPlaying || !coverImage || requestedPresentation === track) return;
    requestedPresentation = track;
    const generation = ++presentationGeneration;
    const animate = Boolean(isOpen && presentedTrack && layer.classList.contains("is-open"));
    nowPlaying.setAttribute("aria-busy", "true");
    void prepareCover(track).then(artwork => {
      // A late image decode must never restore an older selection or reopen a
      // closed player. Only the latest audible track owns this presentation.
      if (generation !== presentationGeneration || !isOpen || !isAvailable(track)) return;
      let echo = null;
      if (animate && !presentationMotion.matches) {
        echo = makePresentationCopy();
        echo.classList.add("sound-player-echo");
        echo.style.left = `${nowPlaying.offsetLeft}px`;
        echo.style.top = `${nowPlaying.offsetTop}px`;
        echo.style.width = `${nowPlaying.offsetWidth}px`;
        echo.style.height = `${nowPlaying.offsetHeight}px`;
        // Capture a partially revealed recording when selections come quickly.
        [".sound-cover-art img", "p:first-of-type", "h3", "p:last-child"].forEach(selector => {
          const live = nowPlaying.querySelector(selector);
          echo.querySelector(selector)?.style.setProperty("--sound-release-opacity", getComputedStyle(live).opacity);
        });
      }
      clearPresentationMotion();
      const metadata = tracks[track];
      trackNumber.textContent = metadata.number;
      trackTitle.textContent = metadata.title;
      description.textContent = metadata.description;
      coverImage.hidden = !artwork;
      if (artwork) coverImage.src = artwork.src;
      else coverImage.removeAttribute("src");
      coverImage.style.objectPosition = metadata.coverPosition;
      nowPlaying.dataset.track = track;
      nowPlaying.setAttribute("aria-busy", "false");
      presentedTrack = track;
      if (!echo) return;
      presentationEcho = echo;
      playerPanel.append(echo);
      // Establish the incoming animation's first frame in the same task; the
      // controls themselves never transform, disappear, or stop receiving input.
      void nowPlaying.offsetWidth;
      nowPlaying.classList.add("is-track-changing");
      playerPanel.classList.add("is-track-changing");
      presentationTimer = window.setTimeout(clearPresentationMotion, 1800);
    });
  };

  const presentEmpty = () => {
    if (requestedPresentation === "empty") return;
    requestedPresentation = "empty";
    presentedTrack = "";
    presentationGeneration += 1;
    clearPresentationMotion();
    trackNumber.textContent = emptyPresentation.number;
    trackTitle.textContent = emptyPresentation.title;
    description.textContent = emptyPresentation.description;
    coverImage.hidden = true;
    coverImage.removeAttribute("src");
    nowPlaying.removeAttribute("data-track");
    nowPlaying.setAttribute("aria-busy", "false");
  };

  const createSoundVisualizer = (canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smoothedBands = new Float32Array(3);
    const smoothedTimbreBins = new Float32Array(8);
    const visualResponses = new Float32Array(3);
    const previousSpectrum = new Float32Array(32);
    let smoothedEnergy = 0;
    let smoothedPulse = 0;
    let smoothedFlux = 0;
    let smoothedWave = 0;
    let previousBass = 0;
    let automaticGain = 1;
    let lastDrawAt = -Infinity;
    let gl = null;
    let program = null;
    let pointBuffer = null;
    let pointCount = 0;
    let attributes = null;
    let uniforms = null;
    let fallback = null;
    let renderedFrames = 0;
    let visualStartedAt = performance.now();
    const viewRotation = new Float32Array(2);
    const targetViewRotation = new Float32Array(2);
    let dragPointerId = null;
    let dragX = 0;
    let dragY = 0;

    const vertexSource = `
      precision highp float;

      attribute vec3 position;
      attribute float seed;
      attribute float kind;
      attribute float pointSize;
      attribute float tone;
      attribute float temperature;

      uniform vec2 resolution;
      uniform float time;
      uniform float bass;
      uniform float mid;
      uniform float high;
      uniform float pulse;
      uniform float flux;
      uniform float wave;
      uniform float densityResponse;
      uniform float meanderResponse;
      uniform float causticResponse;
      uniform float playing;
      uniform float trackHue;
      uniform vec2 viewRotation;
      uniform vec4 timbreLow;
      uniform vec4 timbreHigh;

      varying vec3 lightColor;
      varying float lightAlpha;
      varying float lightKind;
      varying float sparkle;
      varying float bandActivity;

      vec3 stellarPalette(float phase) {
        float spectralClass = fract(phase) * 7.0;
        // Approximate visible colours of the O, B, A, F, G, K and M stellar
        // temperature classes. Most stars remain close to white; temperature
        // is expressed as a restrained warm/cool bias instead of neon colour.
        vec3 oStar = vec3(0.46, 0.58, 1.18);
        vec3 bStar = vec3(0.58, 0.69, 1.12);
        vec3 aStar = vec3(0.73, 0.81, 1.06);
        vec3 fStar = vec3(0.97, 0.97, 1.00);
        vec3 gStar = vec3(1.00, 0.92, 0.78);
        vec3 kStar = vec3(1.08, 0.68, 0.36);
        vec3 mStar = vec3(1.16, 0.36, 0.20);
        if (spectralClass < 1.0) return mix(oStar, bStar, spectralClass);
        if (spectralClass < 2.0) return mix(bStar, aStar, spectralClass - 1.0);
        if (spectralClass < 3.0) return mix(aStar, fStar, spectralClass - 2.0);
        if (spectralClass < 4.0) return mix(fStar, gStar, spectralClass - 3.0);
        if (spectralClass < 5.0) return mix(gStar, kStar, spectralClass - 4.0);
        if (spectralClass < 6.0) return mix(kStar, mStar, spectralClass - 5.0);
        return mStar;
      }

      vec3 nebulaPalette(float phase) {
        float emissionClass = fract(phase) * 4.0;
        vec3 hydrogenAlpha = vec3(0.68, 0.07, 0.14);
        vec3 oxygenThree = vec3(0.08, 0.58, 0.55);
        vec3 reflectionBlue = vec3(0.20, 0.36, 0.78);
        vec3 sulphurGold = vec3(0.82, 0.46, 0.14);
        if (emissionClass < 1.0) return mix(hydrogenAlpha, oxygenThree, emissionClass);
        if (emissionClass < 2.0) return mix(oxygenThree, reflectionBlue, emissionClass - 1.0);
        if (emissionClass < 3.0) return mix(reflectionBlue, sulphurGold, emissionClass - 2.0);
        return mix(sulphurGold, hydrogenAlpha, emissionClass - 3.0);
      }

      float sampleTimbre(float selector) {
        float cursor = fract(selector) * 8.0;
        float blend = fract(cursor);
        if (cursor < 1.0) return mix(timbreLow.x, timbreLow.y, blend);
        if (cursor < 2.0) return mix(timbreLow.y, timbreLow.z, blend);
        if (cursor < 3.0) return mix(timbreLow.z, timbreLow.w, blend);
        if (cursor < 4.0) return mix(timbreLow.w, timbreHigh.x, blend);
        if (cursor < 5.0) return mix(timbreHigh.x, timbreHigh.y, blend);
        if (cursor < 6.0) return mix(timbreHigh.y, timbreHigh.z, blend);
        if (cursor < 7.0) return mix(timbreHigh.z, timbreHigh.w, blend);
        return mix(timbreHigh.w, timbreLow.x, blend);
      }

      void main() {
        float travelSpeed = mix(0.035, 0.16, playing);
        float depth = mod(-position.z - time * travelSpeed, 66.0) + 2.8;
        vec3 world = vec3(position.xy, -depth);
        float yawCos = cos(viewRotation.x);
        float yawSin = sin(viewRotation.x);
        world = vec3(
          yawCos * world.x + yawSin * world.z,
          world.y,
          -yawSin * world.x + yawCos * world.z
        );
        float pitchCos = cos(viewRotation.y);
        float pitchSin = sin(viewRotation.y);
        world = vec3(
          world.x,
          pitchCos * world.y - pitchSin * world.z,
          pitchSin * world.y + pitchCos * world.z
        );
        float cameraDepth = -world.z;
        float visible = step(0.9, cameraDepth);
        float focalLength = 1.34;
        vec2 projected = world.xy * focalLength / max(0.9, cameraDepth);
        float aspect = resolution.x / max(1.0, resolution.y);
        projected.x /= aspect;
        gl_Position = visible > 0.5 ? vec4(projected, 0.0, 1.0) : vec4(3.0, 3.0, 0.0, 1.0);

        float depthPulse = exp(-pow(fract(depth * 0.048 - time * 0.035) - 0.5, 2.0) * 48.0);
        float twinkle = 0.58 + 0.42 * sin(time * (0.42 + seed * 0.82) + seed * 47.0 + depth * 0.11);
        twinkle = max(0.0, twinkle);
        float fieldClass = 1.0 - step(0.5, kind);
        float armClass = step(0.5, kind) * (1.0 - step(1.5, kind));
        float nebulaClass = step(1.5, kind) * (1.0 - step(2.5, kind));
        float nurseryClass = step(2.5, kind) * (1.0 - step(3.5, kind));
        float dustClass = step(3.5, kind);
        // The FFT is split into eight timbre bins. Each arm segment, cloud and
        // nursery owns a different bin, so equal-coloured objects do not flash
        // together just because one broad bass/mid/high value moved.
        float localTimbre = sampleTimbre(tone);
        float neighbourTimbre = sampleTimbre(tone + 0.137);
        float spectralEdge = max(0.0, localTimbre - neighbourTimbre * 0.62);
        float spatialPhase = 0.5 + 0.5 * sin(tone * 51.0 + seed * 19.0 + depth * 0.083 + wave * tone * 1.2);
        float localGate = mix(0.28, 1.0, smoothstep(0.18, 0.88, spatialPhase));
        float localActivity = clamp((localTimbre * (1.02 + pulse * 0.14) + spectralEdge * 0.74) * localGate, 0.0, 1.58);
        float materialAffinity = fieldClass * 0.56
          + armClass * (0.62 + mid * 0.10 + meanderResponse * 0.08)
          + nebulaClass * (0.64 + bass * 0.10 + densityResponse * 0.08)
          + nurseryClass * (0.72 + high * 0.20)
          + dustClass * (0.52 + causticResponse * 0.18);
        bandActivity = 0.035 + localActivity * materialAffinity;

        float perspectiveSize = pointSize * (112.0 / max(2.2, cameraDepth));
        float pixelScale = clamp(resolution.y / 900.0, 0.82, 1.55);
        float audioSize = 1.0
          + localActivity * (
            nebulaClass * (0.08 + bass * 0.08)
            + armClass * (0.04 + mid * 0.05)
            + nurseryClass * (0.12 + high * 0.16)
            + dustClass * (0.04 + high * 0.07)
          );
        float classScale = dustClass > 0.5
          ? 0.48
          : (nebulaClass > 0.5 ? 1.62 : (nurseryClass > 0.5 ? 0.72 : 1.0));
        float pointSizeLimit = nebulaClass > 0.5 ? 190.0 : (nurseryClass > 0.5 ? 22.0 : 42.0);
        gl_PointSize = clamp(perspectiveSize * pixelScale * audioSize * classScale, 1.05, pointSizeLimit);

        float nearFade = smoothstep(1.9, 4.5, depth);
        float farFade = 1.0 - smoothstep(52.0, 68.0, depth);
        float classLift = fieldClass * 0.52
          + armClass * 0.72
          + nebulaClass * 0.15
          + nurseryClass * 0.68
          + dustClass * 0.20;
        float dustReveal = dustClass > 0.5
          ? smoothstep(0.78 - localActivity * 0.32, 0.98, seed)
          : 1.0;
        lightAlpha = visible * nearFade * farFade * classLift * dustReveal
          * (0.30 + bandActivity * 0.86);
        lightAlpha *= 0.42 + playing * 0.58;
        sparkle = twinkle * (
          fieldClass * (0.08 + localActivity * 0.16)
          + armClass * (0.06 + localActivity * 0.11)
          + nebulaClass * (0.035 + localActivity * 0.05)
          + nurseryClass * (0.08 + localActivity * 0.38)
          + dustClass * (0.05 + localActivity * 0.38)
        ) + depthPulse * flux * localGate * (nurseryClass + dustClass * 0.45);
        lightKind = kind;
        // Temperature colour and audio-bin ownership are intentionally
        // independent. Two stars with the same colour can therefore listen to
        // different spectral components and never have to flash in unison.
        float localHue = fract(temperature * 0.88 + trackHue * 0.08 + seed * 0.02);
        vec3 starRestingColor = stellarPalette(localHue);
        vec3 starActiveColor = pow(stellarPalette(localHue + spectralEdge * 0.018), vec3(1.42));
        vec3 gasColor = nebulaPalette(fract(temperature * 0.73 + seed * 0.05));
        vec3 restingColor = mix(starRestingColor * 0.68, gasColor * 0.34, nebulaClass);
        vec3 activeColor = mix(starActiveColor, gasColor * 0.88, nebulaClass);
        lightColor = mix(restingColor, activeColor, clamp(0.24 + localActivity * 0.48, 0.0, 0.92));
        lightColor *= 0.76 + bandActivity * 0.42;
      }
    `;

    const fragmentSource = `
      precision highp float;

      varying vec3 lightColor;
      varying float lightAlpha;
      varying float lightKind;
      varying float sparkle;
      varying float bandActivity;

      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float radius = length(point) * 2.0;
        if (radius > 1.0) discard;
        float angle = atan(point.y, point.x);
        float halo = exp(-radius * radius * 2.45) * (1.0 - smoothstep(0.76, 1.0, radius));
        float pearl = 1.0 - smoothstep(0.045, 0.19, radius);
        float cross = (
          exp(-abs(point.x) * 34.0) + exp(-abs(point.y) * 34.0)
        ) * exp(-radius * 2.6) * (0.045 + sparkle * 0.075);
        float faceted = 0.93 + 0.07 * cos(atan(point.y, point.x) * (4.0 + mod(lightKind, 3.0)));
        float nebulaClass = step(1.5, lightKind) * (1.0 - step(2.5, lightKind));
        float cloudGrain = 0.72 + 0.28 * sin(angle * 5.0 + radius * 16.0 + sparkle * 2.0);
        float nebulaAlpha = halo * halo * cloudGrain * (0.38 + bandActivity * 0.18);
        float starAlpha = halo * (0.45 + sparkle * 0.24) + pearl * 0.92 + cross;
        float alpha = mix(starAlpha, nebulaAlpha, nebulaClass) * lightAlpha * faceted;
        vec3 color = lightColor * mix(0.84 + halo * 1.02 + sparkle * 0.34, 0.54 + halo * 1.18, nebulaClass);
        color += lightColor * pearl * (0.38 + sparkle * 0.12) * (1.0 - nebulaClass);
        color = min(color, vec3(2.4));
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
      }
    `;

    const compile = (context, type, source) => {
      const shader = context.createShader(type);
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        canvas.dataset.shaderError = (context.getShaderInfoLog(shader) || "compile-failed").slice(0, 180);
        context.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const createPointGeometry = () => {
      const points = [];
      let randomState = 0x6d2b79f5;
      const random = () => {
        randomState = Math.imul(randomState ^ (randomState >>> 15), randomState | 1);
        randomState ^= randomState + Math.imul(randomState ^ (randomState >>> 7), randomState | 61);
        return ((randomState ^ (randomState >>> 14)) >>> 0) / 4294967296;
      };
      const push = (x, y, z, kind, size = 1, tone = random(), temperature = random()) => {
        points.push(
          x,
          y,
          z,
          random(),
          kind,
          size,
          Math.max(0, Math.min(0.999, tone)),
          Math.max(0, Math.min(0.999, temperature)),
        );
      };
      // A broad 3D star volume keeps the frame populated while the camera
      // rotates. The distribution widens with depth, like looking through a
      // real galactic field rather than at a flat particle curtain.
      for (let index = 0; index < 7800; index += 1) {
        const z = -2.8 - random() * 65.8;
        const depthSpread = 8 + (-z / 66) * 21;
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random()) * depthSpread;
        push(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.62,
          z,
          random() > 0.94 ? 3 : 0,
          0.34 + Math.pow(random(), 2.4) * 1.46,
        );
      }

      // Four loose logarithmic arms. Every arm has a different depth and
      // thickness, so a left-drag exposes genuine parallax between layers.
      const armCount = 4;
      for (let arm = 0; arm < armCount; arm += 1) {
        for (let index = 0; index < 1450; index += 1) {
          const radius = 1.1 + Math.pow(random(), 0.72) * 17.5;
          const angle = arm / armCount * Math.PI * 2 + radius * 0.52 + (random() - 0.5) * (0.34 + radius * 0.018);
          const thickness = 0.24 + radius * 0.045;
          const x = Math.cos(angle) * radius + (random() - 0.5) * thickness;
          const y = Math.sin(angle) * radius * 0.54 + (random() - 0.5) * thickness * 0.72;
          const z = -3.2 - random() * 65.0 + Math.sin(angle * 1.7) * 1.8;
          const tone = (arm * 0.19 + radius * 0.041) % 1;
          const temperature = (arm * 0.27 + radius * 0.073 + 0.31) % 1;
          push(x, y, z, 1, 0.52 + random() * 1.26, tone, temperature);
        }
      }

      // Coloured gaseous knots sit inside the arms. Large, soft point sprites
      // overlap into painterly nebulae without introducing a costly texture.
      for (let index = 0; index < 1500; index += 1) {
        const arm = index % armCount;
        const radius = 2.4 + Math.pow(random(), 0.78) * 15.5;
        const angle = arm / armCount * Math.PI * 2 + radius * 0.52 + (random() - 0.5) * 0.52;
        const cloud = 0.5 + radius * 0.07;
        push(
          Math.cos(angle) * radius + (random() - 0.5) * cloud,
          Math.sin(angle) * radius * 0.54 + (random() - 0.5) * cloud * 0.72,
          -4.0 - random() * 63.0,
          2,
          7.0 + random() * 11.0,
          (arm * 0.23 + radius * 0.037) % 1,
          (arm * 0.31 + radius * 0.089 + 0.17) % 1,
        );
      }

      // Loose stellar associations add regional structure without collapsing
      // into bright round clumps. Their long axis, depth and brightness vary,
      // leaving visible gaps inside every group.
      for (let cluster = 0; cluster < 12; cluster += 1) {
        const centerAngle = random() * Math.PI * 2;
        const centerRadius = 3 + random() * 16;
        const centerX = Math.cos(centerAngle) * centerRadius;
        const centerY = Math.sin(centerAngle) * centerRadius * 0.55;
        const centerZ = -5 - random() * 60;
        const associationAngle = random() * Math.PI * 2;
        const clusterTone = 0.02 + random() * 0.96;
        const clusterTemperature = 0.02 + random() * 0.96;
        for (let index = 0; index < 30; index += 1) {
          const along = (random() - 0.5) * 4.8;
          const across = (random() - 0.5) * (0.38 + random() * 0.92);
          const size = 0.48 + Math.pow(random(), 3.2) * 1.34;
          push(
            centerX + Math.cos(associationAngle) * along - Math.sin(associationAngle) * across,
            centerY + (Math.sin(associationAngle) * along + Math.cos(associationAngle) * across) * 0.72,
            centerZ + (random() - 0.5) * 7.5,
            3,
            size,
            clusterTone + (random() - 0.5) * 0.06,
            clusterTemperature + (random() - 0.5) * 0.045,
          );
        }
      }

      // Fine dust is the only population whose visible density follows audio.
      for (let index = 0; index < 3600; index += 1) {
        const z = -2.8 - random() * 65.5;
        const spread = 9 + (-z / 66) * 18;
        push(
          (random() * 2 - 1) * spread,
          (random() * 2 - 1) * spread * 0.58,
          z,
          4,
          0.34 + random() * 0.72,
        );
      }
      return new Float32Array(points);
    };

    const initWebGL = () => {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      });
      if (!gl) return false;
      const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
      if (!vertex || !fragment) return false;
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        canvas.dataset.shaderError = (gl.getProgramInfoLog(program) || "link-failed").slice(0, 180);
        return false;
      }

      const geometry = createPointGeometry();
      pointCount = geometry.length / 8;
      pointBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
      attributes = {
        position: gl.getAttribLocation(program, "position"),
        seed: gl.getAttribLocation(program, "seed"),
        kind: gl.getAttribLocation(program, "kind"),
        pointSize: gl.getAttribLocation(program, "pointSize"),
        tone: gl.getAttribLocation(program, "tone"),
        temperature: gl.getAttribLocation(program, "temperature"),
      };
      canvas.dataset.attributeLocations = Object.values(attributes).join(",");
      uniforms = {
        resolution: gl.getUniformLocation(program, "resolution"),
        time: gl.getUniformLocation(program, "time"),
        bass: gl.getUniformLocation(program, "bass"),
        mid: gl.getUniformLocation(program, "mid"),
        high: gl.getUniformLocation(program, "high"),
        pulse: gl.getUniformLocation(program, "pulse"),
        flux: gl.getUniformLocation(program, "flux"),
        wave: gl.getUniformLocation(program, "wave"),
        densityResponse: gl.getUniformLocation(program, "densityResponse"),
        meanderResponse: gl.getUniformLocation(program, "meanderResponse"),
        causticResponse: gl.getUniformLocation(program, "causticResponse"),
        playing: gl.getUniformLocation(program, "playing"),
        trackHue: gl.getUniformLocation(program, "trackHue"),
        viewRotation: gl.getUniformLocation(program, "viewRotation"),
        timbreLow: gl.getUniformLocation(program, "timbreLow"),
        timbreHigh: gl.getUniformLocation(program, "timbreHigh"),
      };
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.disable(gl.DEPTH_TEST);
      canvas.dataset.renderer = "webgl";
      canvas.dataset.visualizer = "audio-reactive-deep-galaxy";
      canvas.dataset.presentation = "full-screen-webgl";
      canvas.dataset.audioAnalysis = "fft-spectrum-flux-waveform";
      canvas.dataset.reactivity = "fft8-local-timbre-regions";
      canvas.dataset.motionProfile = "fourfold-single-direction-galactic-drift";
      canvas.dataset.formLanguage = "spiral-nebula-starfield";
      canvas.dataset.palette = "stellar-obafgkm-and-emission-nebulae";
      canvas.dataset.illumination = "per-cluster-spectral-bin";
      canvas.dataset.timbreBins = "8";
      canvas.dataset.motionRate = "4x";
      canvas.dataset.dragControl = "left-pointer-orbit-3d";
      canvas.dataset.geometryPoints = String(pointCount);
      return true;
    };

    const initFallback = () => {
      fallback = canvas.getContext("2d");
      canvas.dataset.renderer = fallback ? "canvas2d" : "unavailable";
      canvas.dataset.visualizer = "audio-reactive-deep-galaxy";
      canvas.dataset.presentation = "full-screen-webgl";
      canvas.dataset.audioAnalysis = "fft-spectrum-flux-waveform";
      canvas.dataset.reactivity = "fft8-local-timbre-regions";
      canvas.dataset.motionProfile = "fourfold-single-direction-galactic-drift";
      canvas.dataset.formLanguage = "spiral-nebula-starfield";
      canvas.dataset.palette = "stellar-obafgkm-and-emission-nebulae";
      canvas.dataset.illumination = "per-cluster-spectral-bin";
      canvas.dataset.timbreBins = "8";
      canvas.dataset.motionRate = "4x";
      canvas.dataset.dragControl = "left-pointer-orbit-3d";
      return Boolean(fallback);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(reduced ? 1 : 1.15, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const easeBand = (current, target, attack, release) => (
      current + (target - current) * (target > current ? attack : release)
    );

    const updateAudioState = (state) => {
      const active = Boolean(state.analysisActive);
      const strongestBand = active ? Math.max(0, ...(state.bands || [0, 0, 0])) : 0;
      const targetGain = active
        ? Math.max(1, Math.min(3.2, 0.48 / Math.max(0.08, strongestBand)))
        : 1;
      const gainEase = targetGain < automaticGain ? 0.12 : (active ? 0.04 : 0.018);
      automaticGain += (targetGain - automaticGain) * gainEase;
      for (let index = 0; index < 3; index += 1) {
        const boosted = active ? Math.max(0, (state.bands?.[index] || 0) * automaticGain) : 0;
        const compressed = boosted / (0.52 + boosted);
        const shaped = Math.pow(Math.min(0.96, compressed), 0.78);
        smoothedBands[index] = easeBand(smoothedBands[index], shaped, reduced ? 0.16 : 0.34, reduced ? 0.055 : 0.12);
      }
      const activeEnergy = active
        ? Math.min(1, (state.rms || 0) * automaticGain * 2.7 + smoothedBands[0] * 0.32 + smoothedBands[1] * 0.20)
        : 0;
      smoothedEnergy = easeBand(smoothedEnergy, activeEnergy, reduced ? 0.11 : 0.20, reduced ? 0.040 : 0.065);

      const spectrum = active && Array.isArray(state.spectrum) ? state.spectrum : [];
      for (let bin = 0; bin < smoothedTimbreBins.length; bin += 1) {
        let squaredEnergy = 0;
        for (let offset = 0; offset < 4; offset += 1) {
          const sample = Math.max(0, Math.min(1, spectrum[bin * 4 + offset] || 0));
          squaredEnergy += sample * sample;
        }
        const rootMeanSquare = Math.sqrt(squaredEnergy / 4);
        const boosted = active ? rootMeanSquare * automaticGain * 1.45 : 0;
        const compressed = boosted / (0.34 + boosted);
        const shaped = Math.pow(Math.min(0.98, compressed), 0.82);
        smoothedTimbreBins[bin] = easeBand(
          smoothedTimbreBins[bin],
          shaped,
          reduced ? 0.14 : 0.38,
          reduced ? 0.035 : 0.085,
        );
      }
      let spectralFlux = 0;
      for (let index = 0; index < previousSpectrum.length; index += 1) {
        const sample = Math.max(0, Math.min(1, spectrum[index] || 0));
        spectralFlux += Math.max(0, sample - previousSpectrum[index]);
        previousSpectrum[index] += (sample - previousSpectrum[index]) * (sample > previousSpectrum[index] ? 0.38 : 0.08);
      }
      spectralFlux = Math.min(1, spectralFlux * automaticGain * 0.32);
      smoothedFlux = easeBand(smoothedFlux, spectralFlux, reduced ? 0.16 : 0.32, reduced ? 0.045 : 0.09);

      const waveform = active && Array.isArray(state.waveform) ? state.waveform : [];
      let waveProjection = 0;
      for (let index = 0; index < waveform.length; index += 1) {
        waveProjection += (waveform[index] || 0) * Math.sin(index * 0.71 + 0.4);
      }
      const projectedWave = waveform.length > 0
        ? Math.max(-1, Math.min(1, waveProjection / Math.sqrt(waveform.length) * 0.72))
        : 0;
      smoothedWave += (projectedWave - smoothedWave) * (reduced ? 0.05 : 0.085);

      const bassAttack = Math.max(0, smoothedBands[0] - previousBass);
      previousBass = smoothedBands[0];
      const pulseTarget = active
        ? Math.min(1, bassAttack * 2.2 + smoothedFlux * 0.55 + (state.peak || 0) * automaticGain * 0.16)
        : 0;
      smoothedPulse = easeBand(smoothedPulse, pulseTarget, reduced ? 0.16 : 0.34, reduced ? 0.035 : 0.065);
      visualResponses[0] = Math.min(1, smoothedBands[0] * 0.62 + smoothedEnergy * 0.42 + smoothedPulse * 0.92);
      visualResponses[1] = Math.min(1, smoothedBands[1] * 0.94 + smoothedFlux * 0.82 + Math.abs(smoothedWave) * 0.34);
      visualResponses[2] = Math.min(1, smoothedBands[2] * 1.18 + smoothedFlux * 1.32);
      canvas.dataset.analysisActive = String(active);
      canvas.dataset.bass = smoothedBands[0].toFixed(3);
      canvas.dataset.mid = smoothedBands[1].toFixed(3);
      canvas.dataset.high = smoothedBands[2].toFixed(3);
      canvas.dataset.energy = smoothedEnergy.toFixed(3);
      canvas.dataset.pulse = smoothedPulse.toFixed(3);
      canvas.dataset.flux = smoothedFlux.toFixed(3);
      canvas.dataset.wave = smoothedWave.toFixed(3);
      canvas.dataset.densityResponse = visualResponses[0].toFixed(3);
      canvas.dataset.meanderResponse = visualResponses[1].toFixed(3);
      canvas.dataset.causticResponse = visualResponses[2].toFixed(3);
      canvas.dataset.timbreProfile = Array.from(smoothedTimbreBins, (value) => value.toFixed(3)).join(",");
      let dominantTimbre = 0;
      for (let index = 1; index < smoothedTimbreBins.length; index += 1) {
        if (smoothedTimbreBins[index] > smoothedTimbreBins[dominantTimbre]) dominantTimbre = index;
      }
      canvas.dataset.dominantTimbre = String(dominantTimbre);
    };

    const drawFallback = (state, now) => {
      if (!fallback) return;
      updateAudioState(state);
      const width = canvas.width;
      const height = canvas.height;
      const t = (now - visualStartedAt) * 0.001 * (reduced ? 0.16 : 2.08);
      const centerX = width * (0.5 + Math.sin(t * 0.12) * 0.012);
      const centerY = height * (0.5 + Math.cos(t * 0.10) * 0.01);
      const background = fallback.createRadialGradient(centerX, centerY, 0, centerX, centerY, width * 0.72);
      background.addColorStop(0, "rgba(10, 74, 122, .18)");
      background.addColorStop(0.35, "rgba(3, 17, 48, .2)");
      background.addColorStop(1, "rgba(0, 2, 16, .05)");
      fallback.globalCompositeOperation = "source-over";
      fallback.fillStyle = background;
      fallback.fillRect(0, 0, width, height);

      fallback.save();
      fallback.globalCompositeOperation = "screen";
      const zoneColors = ["#9bb0ff", "#aabfff", "#cad7ff", "#f8f7ff", "#fff4ea", "#ffd2a1", "#ff8c52", "#9adbd7"];
      for (let depth = 0; depth < 15; depth += 1) {
        const travel = (depth / 15 + t * (0.018 + smoothedBands[1] * 0.025)) % 1;
        const zone = depth % smoothedTimbreBins.length;
        const zoneResponse = smoothedTimbreBins[zone];
        const scale = 0.04 + travel * travel * 1.05;
        const halfW = width * scale;
        const halfH = height * scale * 0.58;
        fallback.strokeStyle = zoneColors[zone];
        fallback.globalAlpha = 0.025 + travel * 0.09 + zoneResponse * 0.12;
        fallback.lineWidth = 0.6 + travel * 1.1;
        fallback.strokeRect(centerX - halfW, centerY - halfH, halfW * 2, halfH * 2);
        const columns = 12;
        const rows = 7;
        for (let column = 0; column <= columns; column += 1) {
          for (let row = 0; row <= rows; row += 1) {
            const x = centerX - halfW + (column / columns) * halfW * 2;
            const y = centerY - halfH + (row / rows) * halfH * 2;
            const shimmer = 0.42 + 0.58 * Math.sin(t * 1.7 + depth * 1.9 + column * 2.3 + row);
            const size = 0.45 + travel * 2.2 + zoneResponse * (zone >= 5 ? 1.5 : 1.15);
            fallback.globalAlpha = 0.06 + travel * 0.20 + zoneResponse * 0.30 * Math.max(0.24, shimmer);
            fallback.fillStyle = zoneColors[zone];
            fallback.shadowColor = fallback.fillStyle;
            fallback.shadowBlur = 5 + size * 4;
            fallback.beginPath();
            fallback.arc(x, y, size, 0, Math.PI * 2);
            fallback.fill();
          }
        }
      }
      fallback.restore();
      fallback.globalAlpha = 1;
    };

    const draw = (state, now = performance.now()) => {
      const frameInterval = reduced ? 84 : (innerWidth <= 720 ? 22 : 16);
      if (now - lastDrawAt < frameInterval) return;
      lastDrawAt = now;
      resize();
      if (!gl || !program || gl.isContextLost()) {
        drawFallback(state, now);
        return;
      }

      updateAudioState(state);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
      const stride = 8 * Float32Array.BYTES_PER_ELEMENT;
      gl.enableVertexAttribArray(attributes.position);
      gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(attributes.seed);
      gl.vertexAttribPointer(attributes.seed, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
      gl.enableVertexAttribArray(attributes.kind);
      gl.vertexAttribPointer(attributes.kind, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
      gl.enableVertexAttribArray(attributes.pointSize);
      gl.vertexAttribPointer(attributes.pointSize, 1, gl.FLOAT, false, stride, 5 * Float32Array.BYTES_PER_ELEMENT);
      gl.enableVertexAttribArray(attributes.tone);
      gl.vertexAttribPointer(attributes.tone, 1, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);
      gl.enableVertexAttribArray(attributes.temperature);
      gl.vertexAttribPointer(attributes.temperature, 1, gl.FLOAT, false, stride, 7 * Float32Array.BYTES_PER_ELEMENT);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, (now - visualStartedAt) * 0.001 * (reduced ? 0.16 : 2.08));
      gl.uniform1f(uniforms.bass, smoothedBands[0]);
      gl.uniform1f(uniforms.mid, smoothedBands[1]);
      gl.uniform1f(uniforms.high, smoothedBands[2]);
      gl.uniform1f(uniforms.pulse, smoothedPulse);
      gl.uniform1f(uniforms.flux, smoothedFlux);
      gl.uniform1f(uniforms.wave, smoothedWave);
      gl.uniform1f(uniforms.densityResponse, visualResponses[0]);
      gl.uniform1f(uniforms.meanderResponse, visualResponses[1]);
      gl.uniform1f(uniforms.causticResponse, visualResponses[2]);
      gl.uniform1f(uniforms.playing, state.playing ? 1 : 0);
      const trackIndex = Math.max(0, Object.keys(tracks).indexOf(state.track));
      gl.uniform1f(uniforms.trackHue, trackIndex / Math.max(1, Object.keys(tracks).length - 1));
      gl.uniform4f(uniforms.timbreLow, smoothedTimbreBins[0], smoothedTimbreBins[1], smoothedTimbreBins[2], smoothedTimbreBins[3]);
      gl.uniform4f(uniforms.timbreHigh, smoothedTimbreBins[4], smoothedTimbreBins[5], smoothedTimbreBins[6], smoothedTimbreBins[7]);
      viewRotation[0] += (targetViewRotation[0] - viewRotation[0]) * 0.13;
      viewRotation[1] += (targetViewRotation[1] - viewRotation[1]) * 0.13;
      gl.uniform2f(uniforms.viewRotation, viewRotation[0], viewRotation[1]);
      gl.drawArrays(gl.POINTS, 0, pointCount);
      if (renderedFrames === 0) {
        canvas.dataset.webglError = String(gl.getError());
      }
      renderedFrames += 1;
      canvas.dataset.webglFrame = String(renderedFrames);
      canvas.dataset.viewYaw = viewRotation[0].toFixed(4);
      canvas.dataset.viewPitch = viewRotation[1].toFixed(4);
    };

    const finishDrag = (event) => {
      if (event.pointerId !== dragPointerId) return;
      if (layer.hasPointerCapture?.(event.pointerId)) layer.releasePointerCapture(event.pointerId);
      dragPointerId = null;
      layer.classList.remove("is-dragging-visualizer");
      canvas.dataset.dragging = "false";
    };

    layer.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if (event.target.closest("button, input, label, a, select, textarea")) return;
      dragPointerId = event.pointerId;
      dragX = event.clientX;
      dragY = event.clientY;
      layer.setPointerCapture?.(event.pointerId);
      layer.classList.add("is-dragging-visualizer");
      canvas.dataset.dragging = "true";
      event.preventDefault();
    });
    layer.addEventListener("pointermove", (event) => {
      if (event.pointerId !== dragPointerId) return;
      const deltaX = event.clientX - dragX;
      const deltaY = event.clientY - dragY;
      dragX = event.clientX;
      dragY = event.clientY;
      targetViewRotation[0] = Math.max(-0.42, Math.min(0.42, targetViewRotation[0] + deltaX / Math.max(480, innerWidth) * 1.22));
      targetViewRotation[1] = Math.max(-0.30, Math.min(0.30, targetViewRotation[1] - deltaY / Math.max(360, innerHeight) * 0.94));
      event.preventDefault();
    });
    layer.addEventListener("pointerup", finishDrag);
    layer.addEventListener("pointercancel", finishDrag);

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      canvas.dataset.renderer = "context-lost";
    });
    canvas.addEventListener("webglcontextrestored", () => {
      program = null;
      pointBuffer = null;
      pointCount = 0;
      attributes = null;
      uniforms = null;
      visualStartedAt = performance.now();
      initWebGL();
    });
    if (!initWebGL()) initFallback();
    return { draw };
  };

  const signalRibbonMotion = {
    energy: 0,
    bass: 0,
    mid: 0,
    high: 0,
  };
  // Reuse a tiny light texture instead of blurring individual particles per frame.
  const signalGlow = document.createElement("canvas");
  signalGlow.width = signalGlow.height = 64;
  const signalGlowContext = signalGlow.getContext("2d");
  const signalGlowGradient = signalGlowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  signalGlowGradient.addColorStop(0, "rgba(214,255,246,.85)");
  signalGlowGradient.addColorStop(.08, "rgba(172,248,233,.5)");
  signalGlowGradient.addColorStop(.3, "rgba(108,220,205,.15)");
  signalGlowGradient.addColorStop(1, "rgba(90,210,199,0)");
  signalGlowContext.fillStyle = signalGlowGradient;
  signalGlowContext.fillRect(0, 0, 64, 64);

  const drawSignalRibbon = (state, now = performance.now()) => {
    if (!(signalRibbonCanvas instanceof HTMLCanvasElement)) return;
    const frameInterval = state?.playing ? 33 : 66;
    if (now - lastSignalRibbonDrawAt < frameInterval) return;
    lastSignalRibbonDrawAt = now;
    if (!signalLayout) measureSignalLayout();
    if (!signalLayout || signalLayout.width < 2 || signalLayout.height < 2) return;
    const dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const { width, height } = signalLayout;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (signalRibbonCanvas.width !== pixelWidth || signalRibbonCanvas.height !== pixelHeight) {
      signalRibbonCanvas.width = pixelWidth;
      signalRibbonCanvas.height = pixelHeight;
    }
    const context = signalRibbonCanvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = "lighter";

    const clock = now * 0.001;
    const waveform = state?.waveform;
    const active = Boolean(state?.analysisActive && waveform?.length);
    const playing = Boolean(state?.playing);
    const bands = Array.isArray(state?.bands) ? state.bands : [0, 0, 0];
    const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
    const targets = {
      energy: active && playing ? Math.max(0.1, clamp01((state?.rms || 0) * 5.6)) : 0.055,
      bass: active && playing ? clamp01((bands[0] || 0) * 2.8) : 0.08,
      mid: active && playing ? clamp01((bands[1] || 0) * 3.1) : 0.06,
      high: active && playing ? clamp01((bands[2] || 0) * 3.8) : 0.04,
    };
    const response = playing ? 0.075 : 0.035;
    Object.keys(signalRibbonMotion).forEach((key) => {
      signalRibbonMotion[key] += (targets[key] - signalRibbonMotion[key]) * response;
    });
    const { energy, bass, mid, high } = signalRibbonMotion;
    const fract = (value) => value - Math.floor(value);
    const seeded = (index, salt = 0) => fract(Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453);
    const sampleAt = (position) => {
      if (active) {
        const cursor = Math.max(0, Math.min(1, position)) * (waveform.length - 1);
        const sampleIndex = Math.floor(cursor);
        const fraction = cursor - sampleIndex;
        let weighted = 0;
        let weights = 0;
        for (let offset = -2; offset <= 2; offset += 1) {
          const index = Math.min(waveform.length - 1, Math.max(0, sampleIndex + offset));
          const weight = 3 - Math.abs(offset);
          const next = Math.min(waveform.length - 1, index + 1);
          const value = (Number(waveform[index]) || 0) * (1 - fraction) + (Number(waveform[next]) || 0) * fraction;
          weighted += (Math.abs(value) <= 1 ? value : (value - 128) / 128) * weight;
          weights += weight;
        }
        return weighted / Math.max(1, weights);
      }
      return Math.sin(position * 17.4 + clock * 0.38) * 0.12
        + Math.sin(position * 39.0 - clock * 0.21) * 0.04;
    };

    const waveY = (position, { baseline, amplitude, phase = 0, speed = 1, density = 1, signal = 1 }) => {
      const edgeEase = 0.56 + Math.sin(Math.max(0, Math.min(1, position)) * Math.PI) * 0.44;
      const slow = Math.sin(position * Math.PI * 2 * (1.72 + mid * 0.42) * density + clock * 0.34 * speed + phase);
      const crossing = Math.sin(position * Math.PI * 2 * (4.12 + high * 0.88) * density - clock * 0.19 * speed + phase * 1.61);
      const undertow = Math.sin(position * Math.PI * 2 * 0.57 + clock * 0.12 * speed - phase * 0.34);
      const signalPacket = Math.sin(position * Math.PI * 2 * (7.4 + high * 1.8) - clock * 0.72 * speed + phase * 2.3)
        * Math.pow(Math.sin(Math.max(0, Math.min(1, position)) * Math.PI), 2)
        * (0.035 + high * 0.14);
      const liveSignal = sampleAt(position) * signal * (0.08 + energy * 0.18);
      const body = slow * (0.5 + bass * 0.32) + crossing * (0.19 + mid * 0.16) + undertow * 0.12 + signalPacket + liveSignal;
      return baseline + body * amplitude * edgeEase;
    };

    const drawWave = (options) => {
      const {
        alpha,
        width: strokeWidth,
        hue = "126, 242, 220",
        glow = false,
      } = options;
      const gradient = context.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, `rgba(${hue}, 0)`);
      gradient.addColorStop(0.12, `rgba(${hue}, .8)`);
      gradient.addColorStop(0.3, "rgba(206,255,246,1)");
      gradient.addColorStop(0.68, `rgba(${hue}, .8)`);
      gradient.addColorStop(0.92, `rgba(${hue}, .3)`);
      gradient.addColorStop(1, `rgba(${hue}, 0)`);
      context.beginPath();
      // Bounded geometry, even on 4K. Broad curves do not need a vertex per pixel.
      const step = Math.max(3, width / 240);
      for (let x = -step; x <= width + step; x += step) {
        const position = Math.max(0, Math.min(1, x / Math.max(1, width)));
        const y = waveY(position, options);
        if (x > -step) context.lineTo(x, y);
        else context.moveTo(x, y);
      }
      context.strokeStyle = gradient;
      context.shadowBlur = 0;
      if (glow) {
        // A few translucent strokes give the ribbon a soft halo without a live blur.
        for (const [spread, opacity] of [[22, .02], [10, .045], [3, .1]]) {
          context.globalAlpha = alpha * opacity;
          context.lineWidth = strokeWidth * spread;
          context.stroke();
        }
      }
      context.globalAlpha = alpha;
      context.lineWidth = strokeWidth;
      context.stroke();
      context.globalAlpha = 1;
    };

    const ribbonScale = Math.max(.65, Math.min(1.7, width / 900));
    const primary = {
      baseline: signalLayout.centerY,
      amplitude: (12 + energy * 12 + bass * 4) * ribbonScale,
      alpha: playing ? 0.92 : 0.48,
      width: playing ? 1.15 : 0.85,
      phase: 0.1,
      speed: 1,
      density: 1,
      signal: 0.42,
      glow: true,
    };

    drawWave({ baseline: primary.baseline - 3, amplitude: (23 + energy * 12) * ribbonScale, alpha: playing ? 0.17 : 0.065, width: 0.65, phase: 1.84, speed: 0.58, density: 0.76, signal: 0.18 });
    drawWave({ baseline: primary.baseline + 4, amplitude: (19 + mid * 12) * ribbonScale, alpha: playing ? 0.2 : 0.08, width: 0.72, phase: 3.18, speed: 0.74, density: 1.08, signal: 0.2 });
    drawWave(primary);
    const lowerBaseline = Math.min(height - 22, primary.baseline + 94 * ribbonScale);
    drawWave({ baseline: lowerBaseline, amplitude: (12 + bass * 10) * ribbonScale, alpha: playing ? 0.19 : 0.07, width: 0.75, phase: 4.46, speed: 0.43, density: 0.64, signal: 0.2, hue: "117, 214, 203" });
    drawWave({ baseline: lowerBaseline + 7, amplitude: (8 + mid * 8) * ribbonScale, alpha: playing ? 0.055 : 0.025, width: 0.55, phase: 2.38, speed: 0.31, density: 0.91, signal: 0.1, hue: "94, 182, 184" });

    const particleCount = playing ? 48 : 18;
    for (let index = 0; index < particleCount; index += 1) {
      const driftSpeed = 0.008 + seeded(index, 1) * 0.021;
      const position = Math.pow(fract(seeded(index, 2) + clock * driftSpeed), 1.65);
      const x = position * width;
      const spread = (seeded(index, 3) - 0.5) * (24 + seeded(index, 4) * 46);
      const orbit = Math.sin(clock * (0.52 + seeded(index, 5) * 1.12) + seeded(index, 6) * Math.PI * 2) * (2 + seeded(index, 7) * 6);
      const y = waveY(position, primary) + spread + orbit;
      const twinkle = 0.28 + Math.pow((Math.sin(clock * (1.1 + seeded(index, 8) * 2.6) + seeded(index, 9) * 12) + 1) * 0.5, 3) * 0.72;
      const proximity = Math.max(0.16, 1 - Math.abs(spread) / 54);
      const particleAlpha = (playing ? 0.48 : 0.1) * twinkle * proximity;
      const radius = 0.3 + seeded(index, 10) * .55;
      context.globalAlpha = particleAlpha;
      const lightSize = 6 + radius * 5;
      context.drawImage(signalGlow, x - lightSize / 2, y - lightSize / 2, lightSize, lightSize);
      context.fillStyle = "rgba(199,255,244,.7)";
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    const progressRatio = isScrubbing ? Number(progress.value) / 1000 : state?.duration > 0 ? clamp01(state.currentTime / state.duration) : 0;
    const headStart = signalLayout.start;
    const headEnd = signalLayout.end;
    const headX = headStart + (headEnd - headStart) * progressRatio;
    const headY = waveY(headX / Math.max(1, width), primary);
    progress.style.setProperty("--sound-wave-y", `${(headY - signalLayout.centerY).toFixed(2)}px`);
    if (playing) {
      const haloSize = 74 + energy * 18;
      context.globalAlpha = .6;
      context.drawImage(signalGlow, headX - haloSize / 2, headY - haloSize / 2, haloSize, haloSize);
      context.globalAlpha = 1;
    }

    signalRibbonCanvas.dataset.active = String(active);
    signalRibbonCanvas.dataset.frame = String((Number(signalRibbonCanvas.dataset.frame) || 0) + 1);
    signalRibbonCanvas.dataset.waveform = "live-signal-ribbon";
    signalRibbonCanvas.dataset.layers = "5";
    signalRibbonCanvas.dataset.particles = String(particleCount);
    signalRibbonCanvas.dataset.energy = energy.toFixed(3);
    signalRibbonCanvas.dataset.progress = progressRatio.toFixed(4);
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  };

  const render = (state = getAudio()?.getPlaybackState?.(), updateInterface = true) => {
    const activeTrack = activeAvailableTrack(state);
    const volumePercent = Math.round(Math.max(0, Math.min(1, state?.volume ?? 0.1)) * 100);
    const trackDuration = activeTrack ? state?.duration || 0 : 0;
    const elapsed = activeTrack ? state?.currentTime || 0 : 0;
    const isPlaying = Boolean(activeTrack && state?.playing && !state?.muted);
    const analysis = getAudio()?.getAnalysisFrame?.();

    visualizerState = {
      playing: isPlaying,
      volume: state?.volume ?? 0.1,
      outputVolume: state?.outputVolume ?? 0,
      currentTime: elapsed,
      duration: trackDuration,
      track: activeTrack,
      bands: analysis?.bands || [0, 0, 0],
      spectrum: analysis?.spectrum || Array(32).fill(0),
      waveform: analysis?.waveform || Array(64).fill(0),
      peak: analysis?.peak || 0,
      rms: analysis?.rms || 0,
      analysisActive: Boolean(analysis?.active),
      analysisSupported: Boolean(analysis?.supported),
    };

    if (!updateInterface) return;

    const setAttribute = (element, name, value) => { if (element && element.getAttribute(name) !== value) element.setAttribute(name, value); };
    const setText = (element, value) => { if (element && element.textContent !== value) element.textContent = value; };
    setAttribute(layer, "data-playing", String(isPlaying));
    setAttribute(layer, "data-analysis", analysis?.active ? "live" : (analysis?.supported ? "ready" : "unavailable"));
    setAttribute(layer, "data-track", activeTrack);
    setAttribute(playButton, "aria-pressed", String(isPlaying));
    playButton.disabled = !activeTrack;
    setAttribute(playButton, "aria-label", !activeTrack ? "曲を選んでください" : isPlaying ? "一時停止する" : "再生する");
    const miniLabel=globalThis.GaiaI18n?.t?.(!activeTrack ? '曲を選んでください' : isPlaying ? '一時停止する' : '再生する') || (!activeTrack ? '曲を選んでください' : isPlaying ? '一時停止する' : '再生する');
    miniPlay.disabled=!activeTrack;setAttribute(miniPlay,'aria-label',miniLabel);setAttribute(miniPlay,'aria-pressed',String(isPlaying));
    setText(miniPlay,isPlaying?'Ⅱ':'▶');setText(miniTitle,globalThis.GaiaI18n?.t?.(tracks[activeTrack]?.title||emptyPresentation.title)||tracks[activeTrack]?.title||emptyPresentation.title);
    if (!activeTrack) presentEmpty();
    else if (isOpen) presentTrack(activeTrack);
    setText(currentTime, formatTime(elapsed));
    setText(duration, trackDuration > 0 ? formatTime(trackDuration) : "—:—");
    if (volume instanceof HTMLInputElement) volume.value = String(volumePercent);
    setText(volumeValue, `${volumePercent}%`);

    if (progress instanceof HTMLInputElement) progress.disabled = trackDuration <= 0;
    if (!isScrubbing && progress instanceof HTMLInputElement) {
      progress.value = trackDuration > 0 ? String(Math.round((elapsed / trackDuration) * 1000)) : "0";
    }

    trackButtons.forEach((button) => {
      setAttribute(button, "aria-current", String(button.dataset.soundTrack === activeTrack));
    });
  };

  const tick = (now = performance.now()) => {
    const shouldUpdateInterface = now - lastInterfaceRenderAt >= 100;
    render(undefined, shouldUpdateInterface);
    if (shouldUpdateInterface) lastInterfaceRenderAt = now;
    if (visualizerState.playing) visualizerVisibleUntil = now + 2400;
    if (visualizerState.playing || now < visualizerVisibleUntil) visualizerRuntime?.draw?.(visualizerState, now);
    drawSignalRibbon(visualizerState, now);
    if (isOpen) animationFrame = requestAnimationFrame(tick);
  };

  const open = () => {
    if (isOpen) return;
    if (window.location.hash !== "#sound") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#sound`);
    }
    isOpen = true;
    lastFocused = document.activeElement;
    layer.hidden = false;
    layer.setAttribute("aria-hidden", "false");
    document.body.classList.add("sound-mode-open");
    visualizerRuntime ||= createSoundVisualizer(visualizerCanvas);
    measurePresentation();
    render();
    requestAnimationFrame(() => {
      layer.classList.add("is-open");
      closeButton?.focus({ preventScroll: true });
    });
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(tick);
  };

  const close = ({ updateHash = true } = {}) => {
    if (!isOpen) return;
    isOpen = false;
    presentationGeneration += 1;
    requestedPresentation = "";
    presentedTrack = "";
    clearPresentationMotion();
    cancelAnimationFrame(presentationMeasureFrame);
    presentationMeasureFrame = 0;
    nowPlaying?.setAttribute("aria-busy", "false");
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sound-mode-open");
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    window.setTimeout(() => {
      if (!isOpen) layer.hidden = true;
    }, 260);
    if (updateHash && window.location.hash === "#sound") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#top`);
    }
    if (lastFocused instanceof HTMLElement) lastFocused.focus({ preventScroll: true });
  };

  const togglePlayback = async () => {
    const api = getAudio();
    if (!api) return;
    const state = api.getState();
    if (!activeAvailableTrack(state)) return;
    const analysisReady = api.enableAnalysis?.();
    if (state.playing && !state.muted) {
      await api.setMuted(true);
    } else {
      await api.start(state.volume);
    }
    await analysisReady;
    render();
  };

  openButtons.forEach((button) => button.addEventListener("click", open));
  closeButton?.addEventListener("click", close);
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#sound") open();
    else if (isOpen) close({ updateHash: false });
  });
  playButton?.addEventListener("click", togglePlayback);
  miniPlay.addEventListener('click',togglePlayback);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else if (isOpen && animationFrame === 0) {
      animationFrame = requestAnimationFrame(tick);
    }
  });

  trackButtons.forEach((button) => {
    // Warm only the intended recording; keep twelve full-size backgrounds out
    // of the initial sound-mode load and out of the animation's critical path.
    const warmCover = () => { if (isOpen && !button.disabled) void prepareCover(button.dataset.soundTrack); };
    button.addEventListener("pointerenter", warmCover);
    button.addEventListener("focus", warmCover);
    button.addEventListener("click", async () => {
      const track = button.dataset.soundTrack;
      if (!isOpen || !isAvailable(track)) return;
      warmCover();
      const api = getAudio();
      const analysisReady = api?.enableAnalysis?.();
      await api?.switchTrack?.(track, 0.35);
      const state = api?.getState?.();
      if (state?.muted || !state?.playing) await api?.start?.(state?.volume);
      await analysisReady;
      render();
    });
  });

  progress?.addEventListener("pointerdown", () => { isScrubbing = !progress.disabled; });
  progress?.addEventListener("input", () => {
    if (!(progress instanceof HTMLInputElement) || progress.disabled) return;
    const state = getAudio()?.getPlaybackState?.();
    const previewTime = (Number(progress.value) / 1000) * (state?.duration || 0);
    if (currentTime) currentTime.textContent = formatTime(previewTime);
  });
  progress?.addEventListener("change", () => {
    if (!(progress instanceof HTMLInputElement) || progress.disabled) return;
    const state = getAudio()?.getPlaybackState?.();
    if (!activeAvailableTrack(state)) return;
    getAudio()?.seek?.((Number(progress.value) / 1000) * (state?.duration || 0));
    isScrubbing = false;
    render();
  });
  progress?.addEventListener("pointerup", () => { isScrubbing = false; });

  volume?.addEventListener("input", () => {
    if (!(volume instanceof HTMLInputElement)) return;
    getAudio()?.setVolume?.(Number(volume.value) / 100, 0.08);
    render();
  });

  window.addEventListener("gaia:audio-state", () => render());
  document.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.code === "Space" && !event.target.closest("button, input, a")) {
      event.preventDefault();
      void togglePlayback();
    }
  });

  syncTrackAvailability();
  render();
  if (window.location.hash === "#sound") {
    open();
  }
})();
