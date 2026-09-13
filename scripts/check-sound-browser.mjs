import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { seedHeardSoundArchive } from "./sound-archive-fixture.mjs";
import { enforceBrowserSecurity } from "./lib/browser-security-qa.mjs";

const [playwrightRoot, chromePath, outputArg = "artifacts/sound-browser", routeUrl = "http://127.0.0.1:4173/#sound"] = process.argv.slice(2);
if (!playwrightRoot || !chromePath) {
  throw new Error("usage: node scripts/check-sound-browser.mjs <playwright-root> <chrome-path> [output-dir] [url]");
}

const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);
const outputDir = path.resolve(outputArg);
await mkdir(outputDir, { recursive: true });

const expectedTracks = [
  ["opening", "Planet Forecast - Hope"],
  ["story", "Planet Forecast — Windowlight"],
  ["windowlight", "Planet Forecast — Calm"],
  ["firstlight", "Planet Forecast — First Light"],
  ["foldedwind", "折り目の向こうの風"],
  ["snowfire", "雪火の観測信号"],
  ["snowafter", "雪火、軌道の外へ"],
  ["moonbook", "月明かりの観測ノート"],
  ["senseware", "GAIA SENSEWARE"],
  ["moonreopen", "青硝子の潮汐"],
  ["ending", "AfterSchool, AfterGlow"],
  ["trueend", "Sensory Horizon"],
];
const report = { status: "running", tracks: [], errors: [], responses404: [] };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

const attachDiagnostics = (page) => {
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") report.errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() === 404) report.responses404.push(response.url()); });
};

const readControlDesign = (page) => page.evaluate(() => {
  const seek = document.querySelector(".sound-progress-group");
  const volume = document.querySelector(".sound-volume");
  const seekInput = document.querySelector("#sound-progress");
  const volumeInput = document.querySelector("#sound-volume");
  const title = document.querySelector("#sound-track-title");
  const volumeLabel = document.querySelector(".sound-volume-label strong");
  const styleValue = (node, name) => getComputedStyle(node).getPropertyValue(name).trim();
  return {
    seekLabel: seek?.textContent?.replace(/\s+/g, " ").trim() || "",
    volumeLabel: volume?.textContent?.replace(/\s+/g, " ").trim() || "",
    seekAccent: styleValue(seekInput, "--sound-control-accent"),
    volumeAccent: styleValue(volumeInput, "--sound-control-accent"),
    seekPattern: styleValue(seekInput, "--sound-track-pattern"),
    volumePattern: styleValue(volumeInput, "--sound-track-pattern"),
    seekBorderLeft: getComputedStyle(seek).borderLeftWidth,
    volumeBorderRight: getComputedStyle(volume).borderRightWidth,
    signalRibbon: document.querySelector(".sound-player-signal")?.dataset.renderer || "",
    titleFont: getComputedStyle(title).fontFamily,
    volumeLabelFont: getComputedStyle(volumeLabel).fontFamily,
  };
});

const assertControlDesign = (design, label) => {
  assert(design.seekLabel.includes("再生位置"), `${label}: seek control label is ambiguous`);
  assert(design.volumeLabel.includes("音量"), `${label}: volume control label is ambiguous`);
  assert(design.seekAccent && design.volumeAccent && design.seekAccent !== design.volumeAccent, `${label}: seek and volume accents are indistinguishable`);
  assert(design.seekAccent.toLowerCase() === "#efc879" && design.volumeAccent.toLowerCase() === "#8ce9cf", `${label}: seek and volume colors were not swapped`);
  assert(design.seekPattern === "dashed" && design.volumePattern === "solid", `${label}: dashed and solid track designs were not swapped`);
  if (design.signalRibbon === "audio-waveform-ribbon") {
    assert(design.seekBorderLeft === "0px" && design.volumeBorderRight === "0px", `${label}: signal-ribbon controls retain the former boxed borders`);
  } else {
    assert(design.seekBorderLeft === "3px" && design.volumeBorderRight === "3px", `${label}: control shapes are not visually separated`);
  }
  assert(design.titleFont.includes("Yu Mincho") && design.titleFont.includes("Noto Serif CJK JP"), `${label}: title font stack does not preserve the PC-first serif fallback`);
  assert(design.volumeLabelFont.includes("Yu Mincho") && design.volumeLabelFont.includes("Noto Serif CJK JP"), `${label}: UI font stack does not preserve the shared Mincho typography`);
};

let context;
try {
  context = await browser.newContext({ viewport: { width: 2048, height: 1114 } });
  await enforceBrowserSecurity(context, new URL(routeUrl).origin);
  await seedHeardSoundArchive(context);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000);
  attachDiagnostics(page);
  const audioRuntime = await page.request.get(new URL("/opening-audio.js", routeUrl).href);
  assert(audioRuntime.ok(), "opening audio runtime is unavailable");
  const audioRuntimeSource = await audioRuntime.text();
  const visualRuntime = await page.request.get(new URL("/sound-mode.js", routeUrl).href);
  const visualStyles = await page.request.get(new URL("/sound-mode.css", routeUrl).href);
  assert(visualRuntime.ok() && visualStyles.ok(), "aurora visualizer runtime is unavailable");
  const visualRuntimeSource = await visualRuntime.text();
  const visualStyleSource = await visualStyles.text();
  assert(!visualRuntimeSource.includes("getAudio()?.setMuted?.(true)"), "opening the sound archive must not mute the current soundtrack");
  assert(/opening:\s*"\.\/assets\/audio\/satellite-forecast-hope\.mp3"/u.test(audioRuntimeSource), "Planet Forecast - Hope is not assigned to the opening");
  assert(/senseware:\s*"\.\/assets\/audio\/moonlit-source-save\.mp3"/u.test(audioRuntimeSource), "GAIA SENSEWARE is not assigned to its original system theme");
  assert(/mapambient:\s*"\.\/assets\/audio\/gaia-map-ambient-harp-felt-piano\.wav"/u.test(audioRuntimeSource), "the map exhibition is not assigned to the transparent harp and felt-piano ambience");
  assert(/ANALYSIS_FFT_SIZE\s*=\s*512/u.test(audioRuntimeSource), "sound analysis does not use the expected 512-point FFT");
  assert(/ANALYSIS_SPECTRUM_BANDS\s*=\s*32/u.test(audioRuntimeSource), "sound analysis does not expose the 32-band spectrum");
  assert(/getByteFrequencyData/u.test(audioRuntimeSource) && /getByteTimeDomainData/u.test(audioRuntimeSource), "visualizer is not backed by real frequency and waveform analysis");
  assert(/new AudioContextClass\(\{\s*latencyHint:\s*"playback"\s*\}\)/u.test(audioRuntimeSource), "Web Audio analysis does not request a mobile-safe playback buffer");
  const startRuntimeSource = audioRuntimeSource.match(/const start = async[\s\S]*?const setMuted = async/u)?.[0] || "";
  const switchRuntimeSource = audioRuntimeSource.match(/const switchTrack = async[\s\S]*?const getState =/u)?.[0] || "";
  assert(!startRuntimeSource.includes("enableAnalysis") && !switchRuntimeSource.includes("enableAnalysis"), "ordinary BGM playback is still forced through Web Audio analysis");
  assert(/uniform float bass;/u.test(visualRuntimeSource) && /uniform float mid;/u.test(visualRuntimeSource) && /uniform float high;/u.test(visualRuntimeSource), "three real audio bands are not connected to the shader");
  assert(/uniform float pulse;/u.test(visualRuntimeSource) && /uniform float flux;/u.test(visualRuntimeSource) && /uniform float wave;/u.test(visualRuntimeSource), "transient, spectral-flux, and waveform motion are not connected to the shader");
  assert(/uniform float densityResponse;/u.test(visualRuntimeSource) && /uniform float meanderResponse;/u.test(visualRuntimeSource) && /uniform float causticResponse;/u.test(visualRuntimeSource), "the three mapped visual response channels are not connected to the shader");
  assert(!/equalizerRuntime|equalizerCanvas/u.test(visualRuntimeSource), "the detached EQ visualizer is still wired into the sound mode");
  assert(/attribute float tone;/u.test(visualRuntimeSource)
    && /uniform vec4 timbreLow;/u.test(visualRuntimeSource)
    && /uniform vec4 timbreHigh;/u.test(visualRuntimeSource)
    && /float sampleTimbre\(float selector\)/u.test(visualRuntimeSource)
    && /float localTimbre = sampleTimbre\(tone\);/u.test(visualRuntimeSource)
    && /float spectralEdge = max/u.test(visualRuntimeSource), "the 32-bin FFT is not mapped into local per-object timbre responses");
  assert(/stellarPalette/u.test(visualRuntimeSource)
    && /oStar = vec3\(0\.46, 0\.58, 1\.18\)/u.test(visualRuntimeSource)
    && /gStar = vec3\(1\.00, 0\.92, 0\.78\)/u.test(visualRuntimeSource)
    && /mStar = vec3\(1\.16, 0\.36, 0\.20\)/u.test(visualRuntimeSource)
    && /hydrogenAlpha/u.test(visualRuntimeSource)
    && /oxygenThree/u.test(visualRuntimeSource), "stellar temperature classes or physical nebula emission colours are missing");
  assert(/attribute float temperature;/u.test(visualRuntimeSource)
    && /const clusterTemperature =/u.test(visualRuntimeSource)
    && /float localHue = fract\(temperature/u.test(visualRuntimeSource)
    && !/float localHue =[^;]*tone/u.test(visualRuntimeSource), "stellar colour is still coupled to FFT-bin ownership, so equal colours would flash together");
  assert(/broad 3D star volume/u.test(visualRuntimeSource)
    && /logarithmic arms/u.test(visualRuntimeSource)
    && /gaseous knots/u.test(visualRuntimeSource)
    && /Loose stellar associations/u.test(visualRuntimeSource)
    && /cluster < 12/u.test(visualRuntimeSource)
    && /index < 30/u.test(visualRuntimeSource)
    && /Fine dust/u.test(visualRuntimeSource), "the galaxy installation is missing a depth layer or particle class");
  assert(!/currentCore|currentContour|paleCore/u.test(visualRuntimeSource), "tube-like cores or vessel contours remain in the sound visualizer");
  assert(!/upperCenter|lowerCenter|upperWidth|lowerWidth/u.test(visualRuntimeSource), "the former two straight slab bands remain in the shader");
  assert(!/spectralRibbons|filament|tremor|interference/u.test(visualRuntimeSource), "the aggressive filament motion remains in the sound visualizer");
  assert(!/earthCenter|earthRadius|earthSurface|earthDisc|earthX|earthY/u.test(visualRuntimeSource), "Earth rendering remains in the WebGL or Canvas visualizer");
  assert(!/gl\.LINES|spectral-weave/u.test(visualRuntimeSource), "legacy line geometry remains in the visualizer");
  assert(!/sound-layer-grid|sound-spectral-grid/u.test(visualStyleSource), "digital grid styling remains in the sound installation");
  assert(/float travelSpeed = mix\(0\.035, 0\.16, playing\);/u.test(visualRuntimeSource), "galaxy field no longer uses slow one-way constant travel");
  assert(/reduced \? 0\.16 : 2\.08/u.test(visualRuntimeSource), "normal galaxy time is not accelerated to exactly four times the previous 0.52 rate");
  assert(/float focalLength = 1\.34;/u.test(visualRuntimeSource), "audio is changing the camera focal length again");
  assert(/uniform vec2 viewRotation;/u.test(visualRuntimeSource)
    && /yawCos/u.test(visualRuntimeSource)
    && /pitchCos/u.test(visualRuntimeSource), "left-drag no longer rotates the galaxy in three dimensions");
  assert(!/bassBreath|room \*=|focalLength\s*=\s*[^;]*(?:bass|pulse|energy)/u.test(visualRuntimeSource), "audio-driven whole-field scaling returned");
  assert(!/lightColor \*=\s*[^;]*energy|0\.78 \+ energy/u.test(visualRuntimeSource), "overall energy is illuminating the whole galaxy again");
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const layer = document.querySelector("#sound-layer");
    return layer instanceof HTMLElement
      && !layer.hidden
      && layer.getAttribute("aria-hidden") === "false"
      && layer.classList.contains("is-open");
  }, null, { timeout: 75000 });
  await page.waitForFunction(() => !["", "pending"].includes(document.querySelector("#sound-visualizer")?.dataset.renderer || "pending"));
  await page.waitForFunction(() => {
    const image = document.querySelector(".sound-character-scene");
    return image?.complete && image.naturalWidth > 0;
  });
  const desktopVisualizer = await page.locator("#sound-visualizer").evaluate((canvas) => {
    const characterScene = document.querySelector(".sound-character-scene");
    const close = document.querySelector("#sound-close");
    const rect = canvas.getBoundingClientRect();
    const sceneRect = characterScene?.getBoundingClientRect();
    const closeRect = close?.getBoundingClientRect();
    return {
      renderer: canvas.dataset.renderer,
      visualizer: canvas.dataset.visualizer,
      presentation: canvas.dataset.presentation,
      audioAnalysis: canvas.dataset.audioAnalysis,
      reactivity: canvas.dataset.reactivity,
      motionProfile: canvas.dataset.motionProfile,
      formLanguage: canvas.dataset.formLanguage,
      palette: canvas.dataset.palette,
      illumination: canvas.dataset.illumination,
      motionRate: canvas.dataset.motionRate,
      timbreBins: canvas.dataset.timbreBins,
      geometryPoints: Number(canvas.dataset.geometryPoints || 0),
      width: rect.width,
      height: rect.height,
      rect: rect.toJSON(),
      legacyPlanetCount: document.querySelectorAll(".sound-planet, .sound-orbit").length,
      planetariumCount: document.querySelectorAll(".sound-planetarium, .sound-analysis-badge, .sound-planet-caption").length,
      guideCount: document.querySelectorAll("[data-gaia-mode-guide-replay='sound'], #gaia-mode-entry-guide[data-mode='sound']").length,
      visualizerOpacity: Number.parseFloat(getComputedStyle(canvas).opacity || "0"),
      visualizerVisibility: getComputedStyle(canvas).visibility,
      visualizerFilter: getComputedStyle(canvas).filter,
      digitalGridCount: document.querySelectorAll(".sound-layer-grid, .sound-spectral-grid").length,
      eqCount: document.querySelectorAll("#sound-eq-visualizer, .sound-eq-visualizer").length,
      characterSceneLoaded: characterScene instanceof HTMLImageElement && characterScene.complete && characterScene.naturalWidth > 0,
      characterSceneOpacity: Number.parseFloat(getComputedStyle(characterScene).opacity || "0"),
      characterSceneFit: getComputedStyle(characterScene).objectFit,
      characterSceneMask: getComputedStyle(characterScene).maskImage,
      characterSceneRect: sceneRect?.toJSON(),
      closeRect: closeRect?.toJSON(),
    };
  });
  assert(
    desktopVisualizer.renderer === "webgl"
      && desktopVisualizer.visualizer === "audio-reactive-deep-galaxy"
      && desktopVisualizer.presentation === "full-screen-webgl"
      && desktopVisualizer.audioAnalysis === "fft-spectrum-flux-waveform"
      && desktopVisualizer.reactivity === "fft8-local-timbre-regions"
      && desktopVisualizer.motionProfile === "fourfold-single-direction-galactic-drift"
      && desktopVisualizer.formLanguage === "spiral-nebula-starfield"
      && desktopVisualizer.palette === "stellar-obafgkm-and-emission-nebulae"
      && desktopVisualizer.illumination === "per-cluster-spectral-bin"
      && desktopVisualizer.motionRate === "4x"
      && desktopVisualizer.timbreBins === "8"
      && desktopVisualizer.geometryPoints >= 19000
      && desktopVisualizer.width > 300
      && desktopVisualizer.height > 280
      && desktopVisualizer.legacyPlanetCount === 0
      && desktopVisualizer.planetariumCount === 0
      && desktopVisualizer.guideCount === 0
      && desktopVisualizer.digitalGridCount === 0
      && desktopVisualizer.visualizerOpacity === 0
      && desktopVisualizer.visualizerVisibility === "hidden"
      && desktopVisualizer.visualizerFilter.includes("blur(16px)")
      && desktopVisualizer.visualizerFilter.includes("saturate"),
    `desktop WebGL deep-galaxy installation failed: ${JSON.stringify(desktopVisualizer)}`,
  );
  assert(desktopVisualizer.eqCount === 0, `the detached desktop EQ visualizer is still present: ${JSON.stringify(desktopVisualizer)}`);
  assert(desktopVisualizer.width >= 2048 && desktopVisualizer.height >= 1114, `desktop WebGL field is not viewport-sized: ${JSON.stringify(desktopVisualizer)}`);
  assert(desktopVisualizer.characterSceneLoaded && desktopVisualizer.characterSceneOpacity > 0.5, `sound-mode characters are not visible: ${JSON.stringify(desktopVisualizer)}`);
  assert(desktopVisualizer.characterSceneFit === "cover" && desktopVisualizer.characterSceneMask === "none", `sound-mode background is not full-screen: ${JSON.stringify(desktopVisualizer)}`);
  // CSS transforms can round viewport edges by fractions of a device pixel.
  assert(desktopVisualizer.characterSceneRect.left <= 0.01 && desktopVisualizer.characterSceneRect.top <= 0.01 && desktopVisualizer.characterSceneRect.right >= 2048 - 0.01 && desktopVisualizer.characterSceneRect.bottom >= 1114 - 0.01, `sound-mode background does not cover the viewport: ${JSON.stringify(desktopVisualizer)}`);
  assert(desktopVisualizer.closeRect.left <= 32 && desktopVisualizer.closeRect.top <= 32, `sound-mode return is not at the upper-left: ${JSON.stringify(desktopVisualizer)}`);
  assert(await page.locator("[data-sound-track]").count() === 12, "sound archive does not contain 12 unique tracks");
  assert((await page.locator(".sound-track-heading strong").textContent())?.trim() === "全12曲", "track count heading is stale");
  assert(await page.locator(".sound-track-chapters").count() === 0, "removed decorative chapter band returned");
  const unusedTrackIds = await page.locator("[data-sound-track]", { hasText: "（未使用曲）" }).evaluateAll((nodes) => nodes.map((node) => node.dataset.soundTrack));
  assert(JSON.stringify(unusedTrackIds) === JSON.stringify([]), `unused track labels are incorrect: ${JSON.stringify(unusedTrackIds)}`);

  const panelGeometry = await page.locator(".sound-track-panel").evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return {
      horizontalScrolls: panel.scrollWidth > panel.clientWidth + 1,
      verticalScrolls: panel.scrollHeight > panel.clientHeight + 1,
      signalRibbon: document.querySelector(".sound-player-signal")?.dataset.renderer || "",
      signalRibbonWidth: document.querySelector(".sound-player-signal")?.getBoundingClientRect().width || 0,
      withinViewport: rect.top >= 0 && rect.bottom <= innerHeight,
    };
  });
  assert(
    !panelGeometry.verticalScrolls
      && panelGeometry.withinViewport
      && panelGeometry.signalRibbon === "audio-waveform-ribbon"
      && panelGeometry.signalRibbonWidth > 500,
    `desktop signal-ribbon archive layout failed: ${JSON.stringify(panelGeometry)}`,
  );
  assertControlDesign(await readControlDesign(page), "desktop");
  await page.screenshot({ path: path.join(outputDir, "sound-desktop-idle.png"), fullPage: true });

  for (const [id, title] of expectedTracks) {
    const button = page.locator(`[data-sound-track="${id}"]`);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.waitForFunction((track) => globalThis.GaiaOpeningAudio?.getState?.().track === track, id, { timeout: 10000 });
    await page.waitForFunction(() => (globalThis.GaiaOpeningAudio?.getPlaybackState?.().duration || 0) > 0, null, { timeout: 10_000 });
    // Audio selection can precede asynchronous artwork decoding and the UI
    // commit. Do not compare the old title while presentation is aria-busy.
    await page.waitForFunction(track => {
      const presentation = document.querySelector('.sound-now-playing');
      return presentation?.dataset.track === track && presentation.getAttribute('aria-busy') === 'false';
    }, id, { timeout: 10_000 });
    const state = await page.evaluate(() => globalThis.GaiaOpeningAudio.getPlaybackState());
    const renderedTitle = await page.locator("#sound-track-title").innerText();
    assert(renderedTitle === title, `${id} rendered the wrong title: ${renderedTitle}`);
    assert(state.duration > 0 && Number.isFinite(state.duration), `${id} has no playable duration`);
    assert(await button.getAttribute("aria-current") === "true", `${id} was not marked current`);
    report.tracks.push({ id, title, duration: state.duration });
  }
  await page.waitForFunction(() => {
    const frame = globalThis.GaiaOpeningAudio?.getAnalysisFrame?.();
    return frame?.supported && frame.active && frame.peak > 0.002 && frame.bands.some((value) => value > 0.001);
  }, null, { timeout: 10_000 });
  const analysisFrame = await page.evaluate(() => globalThis.GaiaOpeningAudio.getAnalysisFrame());
  assert(
    analysisFrame.fftSize === 512
      && analysisFrame.bands.length === 3
      && analysisFrame.spectrum.length === 32
      && analysisFrame.waveform.length === 64
      && analysisFrame.spectrum.some((value) => value > 0.001)
      && analysisFrame.waveform.some((value) => Math.abs(value) > 0.001)
      && analysisFrame.rms > 0,
    `Web Audio analysis is inactive: ${JSON.stringify(analysisFrame)}`,
  );
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#sound-visualizer");
    return [canvas?.dataset.bass, canvas?.dataset.mid, canvas?.dataset.high]
      .some((value) => Number(value) > 0.001)
      && Number(canvas?.dataset.energy) > 0.001;
  }, null, { timeout: 10_000 });
  const shaderBands = await page.locator("#sound-visualizer").evaluate((canvas) => ({
    bass: Number(canvas.dataset.bass),
    mid: Number(canvas.dataset.mid),
    high: Number(canvas.dataset.high),
    energy: Number(canvas.dataset.energy),
    pulse: Number(canvas.dataset.pulse),
    flux: Number(canvas.dataset.flux),
    wave: Number(canvas.dataset.wave),
  }));
  assert(
    [shaderBands.bass, shaderBands.mid, shaderBands.high, shaderBands.energy, shaderBands.pulse, shaderBands.flux, shaderBands.wave].every(Number.isFinite)
      && Math.max(shaderBands.bass, shaderBands.mid, shaderBands.high) > 0.001
      && shaderBands.energy > 0.001
      && shaderBands.pulse >= 0
      && shaderBands.flux >= 0,
    `smoothed audio analysis does not reach the shader: ${JSON.stringify(shaderBands)}`,
  );
  report.shaderBands = shaderBands;
  report.analysisFrame = analysisFrame;
  await page.evaluate(() => window.scrollTo({ left: 0, top: 0, behavior: "instant" }));
  await page.locator('[data-sound-track="ending"]').evaluate((button) => button.click());
  await page.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "ending", null, { timeout: 10000 });
  await page.evaluate(() => globalThis.GaiaOpeningAudio.seek(24));
  await page.waitForTimeout(2600);
  const playingAppearance = await page.evaluate(() => ({
    playing: document.querySelector("#sound-layer")?.dataset.playing,
    visualizerOpacity: Number.parseFloat(getComputedStyle(document.querySelector("#sound-visualizer")).opacity || "0"),
    visualizerVisibility: getComputedStyle(document.querySelector("#sound-visualizer")).visibility,
    visualizerRect: document.querySelector("#sound-visualizer").getBoundingClientRect().toJSON(),
    sceneOpacity: Number.parseFloat(getComputedStyle(document.querySelector(".sound-character-scene")).opacity || "1"),
    sceneFilter: getComputedStyle(document.querySelector(".sound-character-scene")).filter,
    visualizerFilter: getComputedStyle(document.querySelector("#sound-visualizer")).filter,
    signalLayers: Number(document.querySelector(".sound-player-signal")?.dataset.layers || 0),
    signalParticles: Number(document.querySelector(".sound-player-signal")?.dataset.particles || 0),
    signalHeight: document.querySelector(".sound-player-signal")?.getBoundingClientRect().height || 0,
    time: document.querySelector("#sound-current-time").getBoundingClientRect().toJSON(),
    loop: document.querySelector(".sound-time span").getBoundingClientRect().toJSON(),
    volume: document.querySelector(".sound-volume").getBoundingClientRect().toJSON(),
  }));
  assert(playingAppearance.playing === "true" && playingAppearance.visualizerOpacity >= 0.98 && playingAppearance.visualizerVisibility === "visible" && playingAppearance.visualizerRect.left <= 0 && playingAppearance.visualizerRect.top <= 0 && playingAppearance.visualizerRect.right >= 2048 && playingAppearance.visualizerRect.bottom >= 1114 && playingAppearance.sceneOpacity >= 0.22 && playingAppearance.sceneOpacity <= 0.3 && playingAppearance.sceneFilter.includes("brightness(0.43)") && !playingAppearance.sceneFilter.includes("blur") && playingAppearance.visualizerFilter.includes("saturate") && playingAppearance.visualizerFilter.includes("contrast") && playingAppearance.signalLayers >= 5 && playingAppearance.signalParticles > 0 && playingAppearance.signalParticles <= 64 && playingAppearance.signalHeight > 0, `playback reveal failed: ${JSON.stringify(playingAppearance)}`);
  assert(playingAppearance.time.bottom < playingAppearance.loop.top && playingAppearance.loop.bottom < playingAppearance.volume.top, "time, loop, and volume must occupy separate rows");
  await page.screenshot({ path: path.join(outputDir, "sound-desktop.png"), fullPage: true });
  const reactiveRange = await page.evaluate(async () => {
    const samples = [];
    for (let index = 0; index < 18; index += 1) {
      const canvas = document.querySelector("#sound-visualizer");
      samples.push({
        bass: Number(canvas?.dataset.bass || 0),
        mid: Number(canvas?.dataset.mid || 0),
        high: Number(canvas?.dataset.high || 0),
        energy: Number(canvas?.dataset.energy || 0),
        pulse: Number(canvas?.dataset.pulse || 0),
        flux: Number(canvas?.dataset.flux || 0),
        densityResponse: Number(canvas?.dataset.densityResponse || 0),
        meanderResponse: Number(canvas?.dataset.meanderResponse || 0),
        causticResponse: Number(canvas?.dataset.causticResponse || 0),
        timbre: String(canvas?.dataset.timbreProfile || "").split(",").map(Number),
        rawBass: Number(globalThis.GaiaOpeningAudio?.getAnalysisFrame?.().bands?.[0] || 0),
        rawMid: Number(globalThis.GaiaOpeningAudio?.getAnalysisFrame?.().bands?.[1] || 0),
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const range = (key) => {
      const values = samples.map((sample) => sample[key]);
      return { min: Math.min(...values), max: Math.max(...values), delta: Math.max(...values) - Math.min(...values) };
    };
    const timbreRanges = Array.from({ length: 8 }, (_, bin) => {
      const values = samples.map((sample) => Number(sample.timbre[bin] || 0));
      return { min: Math.min(...values), max: Math.max(...values), delta: Math.max(...values) - Math.min(...values) };
    });
    const timbreSpread = Math.max(...samples.map((sample) => Math.max(...sample.timbre) - Math.min(...sample.timbre)));
    return { bass: range("bass"), mid: range("mid"), high: range("high"), energy: range("energy"), pulse: range("pulse"), flux: range("flux"), densityResponse: range("densityResponse"), meanderResponse: range("meanderResponse"), causticResponse: range("causticResponse"), rawBass: range("rawBass"), rawMid: range("rawMid"), timbreRanges, timbreSpread };
  });
  assert(reactiveRange.bass.max >= 0.08 && reactiveRange.energy.max >= 0.08 && reactiveRange.densityResponse.max >= 0.20 && reactiveRange.meanderResponse.max >= 0.20 && reactiveRange.causticResponse.max >= 0.10 && reactiveRange.densityResponse.delta >= 0.015 && reactiveRange.meanderResponse.delta >= 0.035 && reactiveRange.causticResponse.delta >= 0.06 && reactiveRange.timbreSpread >= 0.10 && reactiveRange.timbreRanges.filter((range) => range.delta >= 0.012).length >= 3, `audio response is not locally differentiated across timbre bins: ${JSON.stringify(reactiveRange)}`);
  report.reactiveRange = reactiveRange;
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outputDir, "sound-desktop-later.png"), fullPage: true });
  await page.locator("#sound-play").click();
  await page.waitForFunction(() => document.querySelector("#sound-layer")?.dataset.playing === "false");
  await page.waitForTimeout(2600);
  const stoppedAppearance = await page.evaluate(() => ({
    visualizerOpacity: Number.parseFloat(getComputedStyle(document.querySelector("#sound-visualizer")).opacity || "1"),
    visualizerVisibility: getComputedStyle(document.querySelector("#sound-visualizer")).visibility,
    sceneOpacity: Number.parseFloat(getComputedStyle(document.querySelector(".sound-character-scene")).opacity || "0"),
  }));
  assert(stoppedAppearance.visualizerOpacity === 0 && stoppedAppearance.visualizerVisibility === "hidden" && stoppedAppearance.sceneOpacity > 0.8, `playback reverse transition failed: ${JSON.stringify(stoppedAppearance)}`);
  await context.close();

  context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await enforceBrowserSecurity(context, new URL(routeUrl).origin);
  await seedHeardSoundArchive(context);
  const mobile = await context.newPage();
  mobile.setDefaultNavigationTimeout(90_000);
  attachDiagnostics(mobile);
  await mobile.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await mobile.waitForFunction(() => {
    const layer = document.querySelector("#sound-layer");
    return layer instanceof HTMLElement
      && !layer.hidden
      && layer.getAttribute("aria-hidden") === "false"
      && layer.classList.contains("is-open");
  }, null, { timeout: 75000 });
  await mobile.waitForFunction(() => !["", "pending"].includes(document.querySelector("#sound-visualizer")?.dataset.renderer || "pending"));
  await mobile.waitForFunction(() => {
    const image = document.querySelector(".sound-character-scene");
    return image?.complete && image.naturalWidth > 0;
  });
  const mobileGeometry = await mobile.evaluate(() => ({
    count: document.querySelectorAll("[data-sound-track]").length,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    layoutScrolls: document.querySelector(".sound-layout").scrollHeight > document.querySelector(".sound-layout").clientHeight + 1,
    renderer: document.querySelector("#sound-visualizer")?.dataset.renderer || "",
    visualizer: document.querySelector("#sound-visualizer")?.dataset.visualizer || "",
    presentation: document.querySelector("#sound-visualizer")?.dataset.presentation || "",
    legacyPlanetCount: document.querySelectorAll(".sound-planet, .sound-orbit").length,
    planetariumCount: document.querySelectorAll(".sound-planetarium, .sound-analysis-badge, .sound-planet-caption").length,
    guideCount: document.querySelectorAll("[data-gaia-mode-guide-replay='sound'], #gaia-mode-entry-guide[data-mode='sound']").length,
    visualizerOpacity: Number.parseFloat(getComputedStyle(document.querySelector("#sound-visualizer")).opacity || "0"),
    sceneOpacity: Number.parseFloat(getComputedStyle(document.querySelector(".sound-character-scene")).opacity || "0"),
    digitalGridCount: document.querySelectorAll(".sound-layer-grid, .sound-spectral-grid").length,
    eqCount: document.querySelectorAll("#sound-eq-visualizer, .sound-eq-visualizer").length,
    characterSceneLoaded: document.querySelector(".sound-character-scene")?.complete && document.querySelector(".sound-character-scene")?.naturalWidth > 0,
    characterSceneFit: getComputedStyle(document.querySelector(".sound-character-scene")).objectFit,
    characterSceneMask: getComputedStyle(document.querySelector(".sound-character-scene")).maskImage,
    characterSceneRect: document.querySelector(".sound-character-scene").getBoundingClientRect().toJSON(),
    closeRect: document.querySelector("#sound-close").getBoundingClientRect().toJSON(),
    nowPlayingTop: document.querySelector(".sound-now-playing").getBoundingClientRect().top,
    visualizerTop: document.querySelector("#sound-visualizer").getBoundingClientRect().top,
    visualizerRect: document.querySelector("#sound-visualizer").getBoundingClientRect().toJSON(),
  }));
  assert(mobileGeometry.count === 12 && !mobileGeometry.horizontalOverflow && mobileGeometry.layoutScrolls, `mobile sound archive layout failed: ${JSON.stringify(mobileGeometry)}`);
  assert(mobileGeometry.renderer === "webgl" && mobileGeometry.visualizer === "audio-reactive-deep-galaxy" && mobileGeometry.presentation === "full-screen-webgl" && mobileGeometry.legacyPlanetCount === 0 && mobileGeometry.planetariumCount === 0 && mobileGeometry.guideCount === 0 && mobileGeometry.digitalGridCount === 0, `mobile WebGL audio field failed: ${JSON.stringify(mobileGeometry)}`);
  assert(mobileGeometry.visualizerRect.width >= 390 && mobileGeometry.visualizerRect.height >= 844, `mobile WebGL field is not viewport-sized: ${JSON.stringify(mobileGeometry)}`);
  assert(mobileGeometry.eqCount === 0 && mobileGeometry.characterSceneLoaded, `the mobile EQ remains or the characters are missing: ${JSON.stringify(mobileGeometry)}`);
  assert(mobileGeometry.visualizerOpacity === 0 && mobileGeometry.sceneOpacity > 0.8, `mobile sound mode did not open on the background-only state: ${JSON.stringify(mobileGeometry)}`);
  assert(mobileGeometry.characterSceneFit === "cover" && mobileGeometry.characterSceneMask === "none", `mobile sound background is not full-screen: ${JSON.stringify(mobileGeometry)}`);
  assert(mobileGeometry.characterSceneRect.left <= 0.01 && mobileGeometry.characterSceneRect.top <= 0.01 && mobileGeometry.characterSceneRect.right >= 390 - 0.01 && mobileGeometry.characterSceneRect.bottom >= 844 - 0.01, `mobile sound background does not cover the viewport: ${JSON.stringify(mobileGeometry)}`);
  assert(mobileGeometry.closeRect.left <= 20 && mobileGeometry.closeRect.top <= 20, `mobile sound return is not at the upper-left: ${JSON.stringify(mobileGeometry)}`);
  assertControlDesign(await readControlDesign(mobile), "mobile");
  await mobile.screenshot({ path: path.join(outputDir, "sound-mobile.png"), fullPage: false });
  await mobile.locator('[data-sound-track="ending"]').scrollIntoViewIfNeeded();
  await mobile.locator('[data-sound-track="ending"]').click();
  await mobile.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "ending", null, { timeout: 10_000 });
  await mobile.waitForFunction(() => (globalThis.GaiaOpeningAudio?.getPlaybackState?.().duration || 0) > 0, null, { timeout: 10_000 });
  await mobile.evaluate(() => globalThis.GaiaOpeningAudio.seek(24));
  await mobile.waitForTimeout(1600);
  const mobilePlayingAppearance = await mobile.evaluate(() => ({
    playing: document.querySelector("#sound-layer")?.dataset.playing,
    visualizerOpacity: Number.parseFloat(getComputedStyle(document.querySelector("#sound-visualizer")).opacity || "0"),
    visualizerVisibility: getComputedStyle(document.querySelector("#sound-visualizer")).visibility,
    sceneOpacity: Number.parseFloat(getComputedStyle(document.querySelector(".sound-character-scene")).opacity || "1"),
  }));
  assert(mobilePlayingAppearance.playing === "true" && mobilePlayingAppearance.visualizerOpacity >= 0.98 && mobilePlayingAppearance.visualizerVisibility === "visible" && mobilePlayingAppearance.sceneOpacity >= 0.22 && mobilePlayingAppearance.sceneOpacity <= 0.30, `mobile playback reveal failed: ${JSON.stringify(mobilePlayingAppearance)}`);
  await mobile.screenshot({ path: path.join(outputDir, "sound-mobile-playing.png"), fullPage: false });
  const lastTrack = mobile.locator('[data-sound-track="trueend"]');
  await lastTrack.scrollIntoViewIfNeeded();
  await lastTrack.click();
  await mobile.waitForFunction(() => globalThis.GaiaOpeningAudio?.getState?.().track === "trueend", null, { timeout: 10000 });
  await context.close();

  assert(report.errors.length === 0, `browser errors: ${report.errors.join(" | ")}`);
  assert(report.responses404.length === 0, `404 responses: ${report.responses404.join(" | ")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await context?.close().catch(() => {});
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await browser.close();
}

console.log(`sound browser check passed: ${report.tracks.length} new tracks / desktop + mobile`);
