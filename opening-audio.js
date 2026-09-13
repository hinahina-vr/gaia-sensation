(() => {
  "use strict";

  const TRACKS = Object.freeze({
    opening: "./assets/audio/satellite-forecast-hope.mp3",
    story: "./assets/audio/planet-forecast-windowlight.mp3",
    windowlight: "./assets/audio/satellite-forecast-calm.mp3",
    firstlight: "./assets/audio/planet-forecast-first-light.mp3",
    foldedwind: "./assets/audio/folded-wind-message.mp3",
    snowfire: "./assets/audio/snowfire-signal.mp3",
    snowafter: "./assets/audio/snowfire-afterimage.mp3",
    moonbook: "./assets/audio/moonlit-observation-notebook.mp3",
    sensorfield: "./assets/audio/moonlit-observation-notebook.mp3",
    senseware: "./assets/audio/moonlit-source-save.mp3",
    mapambient: "./assets/audio/gaia-map-ambient-harp-felt-piano.wav",
    moonreopen: "./assets/audio/moonlit-reopen.mp3?v=gaia-blue-glass-tide-1",
    ending: "./assets/audio/after-school-afterglow.mp3",
    trueend: "./assets/audio/sensory-horizon.wav",
  });
  const DEFAULT_VOLUME = 0.1;
  const VOLUME_STORAGE_KEY = "gaia-senseware-bgm-volume";
  const HEARD_STORAGE_KEY = "gaia-senseware-heard-tracks:v1";
  const NAVIGATION_STATE_KEY = "gaia-senseware-bgm-navigation:v1";
  const NAVIGATION_STATE_MAX_AGE_MS = 30_000;
  const TRACK_SWITCH_FADE_MULTIPLIER = 2;
  const TRACK_SWITCH_FADE_IN_SECONDS = 0.8 * TRACK_SWITCH_FADE_MULTIPLIER;
  const scriptBaseUrl = new URL("./", document.currentScript?.src || document.baseURI);

  let audio = null;
  let activeTrack = "opening";
  const players = new Map();
  const preloadPromises = new Map();
  let fadeFrame = 0;
  let stopTimer = 0;
  let switchSerial = 0;
  let preferredVolume = DEFAULT_VOLUME;
  let mixGain = 1;
  const duckGains = new Map();
  let muted = true;
  let navigationStatePersisted = false;
  let navigationTransitionPending = false;
  let analysisContext = null;
  let analysisNode = null;
  let analysisBins = null;
  let analysisWaveformBins = null;
  let analysisLastSampledAt = -Infinity;
  const ANALYSIS_FFT_SIZE = 512;
  const ANALYSIS_SPECTRUM_BANDS = 32;
  const ANALYSIS_WAVEFORM_SAMPLES = 64;
  const ANALYSIS_INTERVAL_MS = 30;
  const silentAnalysisFrame = () => ({
    supported: Boolean(window.AudioContext || window.webkitAudioContext),
    active: false,
    fftSize: ANALYSIS_FFT_SIZE,
    bands: [0, 0, 0],
    spectrum: Array(ANALYSIS_SPECTRUM_BANDS).fill(0),
    waveform: Array(ANALYSIS_WAVEFORM_SAMPLES).fill(0),
    peak: 0,
    rms: 0,
  });
  let analysisFrame = silentAnalysisFrame();
  const analysisSources = new WeakMap();
  // Keep the visitor's choice separate from the instantaneous player state.
  // A scene transition may pause a player for a moment; that must not be
  // mistaken for the visitor choosing "sound off".
  let playbackRequested = false;

  const duckGain = () => [...duckGains.values()].reduce((gain, value) => gain * value, 1);
  const effectiveVolume = () => preferredVolume * mixGain * duckGain();

  // Scene visits, preloads and completion flags are not proof of listening.
  // Only advancing, audible media can add a recording to this local archive.
  const canonicalTrack = (track) => track === "sensorfield" ? "moonbook" : track;
  const parseHeardTracks = (value) => {
    try {
      const saved = JSON.parse(value || "null");
      if (saved?.version !== 1 || !Array.isArray(saved.tracks)) return [];
      return saved.tracks.filter(track => typeof track === "string" && Object.hasOwn(TRACKS, track)).map(canonicalTrack);
    } catch { return []; }
  };
  const readHeardTracks = () => {
    try { return parseHeardTracks(window.localStorage.getItem(HEARD_STORAGE_KEY)); }
    catch { return []; }
  };
  let heardTracks = new Set(readHeardTracks());
  let listeningEpoch = 0;
  const hasTrackBeenHeard = (track) => heardTracks.has(canonicalTrack(track));
  const getHeardTracks = () => [...heardTracks];
  const emitHeardTracks = () => window.dispatchEvent(new CustomEvent("gaia:audio-heard", {
    detail: { tracks: getHeardTracks() },
  }));
  const rememberHeardTrack = (track) => {
    if (hasTrackBeenHeard(track)) return;
    // Merge other tabs' progress before writing. Storage is optional.
    readHeardTracks().forEach(key => heardTracks.add(key));
    heardTracks.add(canonicalTrack(track));
    try {
      window.localStorage.setItem(HEARD_STORAGE_KEY, JSON.stringify({ version: 1, tracks: getHeardTracks() }));
    } catch { /* Keep this session's verified listening when storage is blocked. */ }
    emitHeardTracks();
  };
  window.addEventListener("storage", event => {
    if (event.key !== HEARD_STORAGE_KEY && event.key !== null) return;
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    heardTracks = new Set(parseHeardTracks(event.newValue));
    emitHeardTracks();
  });
  const observeListening = (player, track) => {
    let lastTime = null;
    let audibleSeconds = 0;
    let epoch = listeningEpoch;
    const reset = () => { lastTime = null; audibleSeconds = 0; };
    ["playing", "pause", "seeking", "seeked", "emptied", "waiting"].forEach(name => player.addEventListener(name, reset));
    player.addEventListener("timeupdate", () => {
      if (hasTrackBeenHeard(track)) return;
      if (epoch !== listeningEpoch) { reset(); epoch = listeningEpoch; }
      const audible = player === audio && !player.paused && !player.seeking && !player.muted
        && !muted && effectiveVolume() > 0 && player.volume > 0
        && (!analysisSources.has(player) || analysisContext?.state === "running");
      if (!audible) { reset(); return; }
      const time = player.currentTime;
      const delta = lastTime === null ? 0 : time - lastTime;
      lastTime = time;
      // Ignore seeking and discontinuities, not just successful play() calls.
      if (delta > 0 && delta < 2) audibleSeconds += delta;
      else audibleSeconds = 0;
      if (audibleSeconds >= 0.35) rememberHeardTrack(track);
    });
  };

  const connectAnalysisSource = (player) => {
    if (!analysisContext || !analysisNode || analysisSources.has(player)) return;
    try {
      const source = analysisContext.createMediaElementSource(player);
      source.connect(analysisNode);
      analysisSources.set(player, source);
    } catch {
      // Playback remains available if a browser refuses a media-element source.
    }
  };

  const ensureAnalysis = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!analysisContext) {
      try {
        // Analysis is opt-in from the sound archive. When it is enabled, favor
        // a stable playback buffer over interactive latency on mobile devices.
        analysisContext = new AudioContextClass({ latencyHint: "playback" });
        analysisNode = analysisContext.createAnalyser();
        analysisNode.fftSize = ANALYSIS_FFT_SIZE;
        analysisNode.minDecibels = -90;
        analysisNode.maxDecibels = -12;
        analysisNode.smoothingTimeConstant = 0.7;
        analysisNode.connect(analysisContext.destination);
        analysisBins = new Uint8Array(analysisNode.frequencyBinCount);
        analysisWaveformBins = new Uint8Array(analysisNode.fftSize);
        analysisFrame = silentAnalysisFrame();
        players.forEach(connectAnalysisSource);
      } catch {
        analysisContext = null;
        analysisNode = null;
        analysisBins = null;
        analysisWaveformBins = null;
        analysisFrame = silentAnalysisFrame();
        return null;
      }
    }
    return analysisContext;
  };

  const enableAnalysis = async () => {
    const context = ensureAnalysis();
    if (!context) return false;
    players.forEach(connectAnalysisSource);
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }
    return context.state === "running";
  };

  const getAnalysisFrame = () => {
    if (!analysisNode || !analysisBins || !analysisWaveformBins) return analysisFrame;
    const sampledAt = performance.now();
    if (sampledAt - analysisLastSampledAt < ANALYSIS_INTERVAL_MS) return analysisFrame;
    analysisLastSampledAt = sampledAt;
    analysisNode.getByteFrequencyData(analysisBins);
    analysisNode.getByteTimeDomainData(analysisWaveformBins);

    const frequencyStep = analysisContext.sampleRate / analysisNode.fftSize;
    const averageFrequencyRange = (startFrequency, endFrequency) => {
      const start = Math.max(0, Math.floor(startFrequency / frequencyStep));
      const end = Math.min(analysisBins.length, Math.max(start + 1, Math.ceil(endFrequency / frequencyStep)));
      let squareSum = 0;
      for (let index = start; index < end; index += 1) {
        const normalized = analysisBins[index] / 255;
        squareSum += normalized * normalized;
      }
      return Math.sqrt(squareSum / Math.max(1, end - start));
    };

    const spectrum = Array.from({ length: ANALYSIS_SPECTRUM_BANDS }, (_, index) => {
      const startRatio = index / ANALYSIS_SPECTRUM_BANDS;
      const endRatio = (index + 1) / ANALYSIS_SPECTRUM_BANDS;
      const startFrequency = 38 * ((16_000 / 38) ** startRatio);
      const endFrequency = 38 * ((16_000 / 38) ** endRatio);
      return averageFrequencyRange(startFrequency, endFrequency);
    });

    const waveform = Array.from({ length: ANALYSIS_WAVEFORM_SAMPLES }, (_, index) => {
      const sourceIndex = Math.min(
        analysisWaveformBins.length - 1,
        Math.round((index / (ANALYSIS_WAVEFORM_SAMPLES - 1)) * (analysisWaveformBins.length - 1)),
      );
      return (analysisWaveformBins[sourceIndex] - 128) / 128;
    });

    let peak = 0;
    let squareSum = 0;
    analysisWaveformBins.forEach((value) => {
      const normalized = (value - 128) / 128;
      peak = Math.max(peak, Math.abs(normalized));
      squareSum += normalized * normalized;
    });
    analysisFrame = {
      supported: true,
      active: analysisContext?.state === "running" && Boolean(audio && !audio.paused && !muted),
      fftSize: analysisNode.fftSize,
      bands: [
        averageFrequencyRange(38, 250),
        averageFrequencyRange(250, 2_500),
        averageFrequencyRange(2_500, 16_000),
      ],
      spectrum,
      waveform,
      peak,
      rms: Math.sqrt(squareSum / analysisWaveformBins.length),
    };
    return analysisFrame;
  };

  try {
    const savedValue = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    const savedVolume = savedValue === null ? Number.NaN : Number(savedValue);
    if (Number.isFinite(savedVolume)) preferredVolume = Math.max(0, Math.min(1, savedVolume));
  } catch {
    // Storage is optional. The experience still starts at the safe default.
  }

  const emitState = () => {
    window.dispatchEvent(
      new CustomEvent("gaia:audio-state", {
        detail: {
          volume: preferredVolume,
          muted,
          playing: Boolean(audio && !audio.paused),
          track: activeTrack,
        },
      }),
    );
  };

  const cancelFade = () => {
    if (fadeFrame) cancelAnimationFrame(fadeFrame);
    fadeFrame = 0;
    window.clearTimeout(stopTimer);
  };

  const ensureAudio = (track = activeTrack) => {
    if (!TRACKS[track]) throw new Error(`Unknown BGM track: ${track}`);
    if (players.has(track)) return players.get(track);

    const player = new Audio(new URL(TRACKS[track], scriptBaseUrl).href);
    player.preload = "auto";
    player.playsInline = true;
    // The soundtrack belongs to the whole experience, not only the opening.
    // Keep one player alive while the visitor moves between every mode.
    player.loop = true;
    player.volume = 0;
    observeListening(player, track);
    player.load();
    players.set(track, player);
    connectAnalysisSource(player);
    if (track === activeTrack) audio = player;
    return player;
  };

  const fadeTo = (target, durationSeconds, afterFade, smooth = false) => {
    const player = ensureAudio();
    cancelFade();

    const from = player.volume;
    const startedAt = performance.now();
    const duration = Math.max(40, durationSeconds * 1000);

    const draw = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = smooth ? progress * progress * (3 - 2 * progress) : 1 - (1 - progress) ** 3;
      player.volume = Math.max(0, Math.min(1, from + (target - from) * eased));

      if (progress < 1) {
        fadeFrame = requestAnimationFrame(draw);
      } else {
        fadeFrame = 0;
        afterFade?.();
      }
    };

    fadeFrame = requestAnimationFrame(draw);
  };

  const preloadTrack = (track = activeTrack) => {
    if (!TRACKS[track]) return Promise.resolve(false);
    if (preloadPromises.has(track)) return preloadPromises.get(track);
    const player = ensureAudio(track);

    const preloadPromise = new Promise((resolve) => {
      if (player.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        resolve(true);
        return;
      }

      let settled = false;
      const complete = (ready) => {
        if (settled) return;
        settled = true;
        player.removeEventListener("canplay", handleReady);
        player.removeEventListener("error", handleError);
        window.clearTimeout(timeout);
        resolve(ready);
      };
      const handleReady = () => complete(true);
      const handleError = () => complete(false);
      const timeout = window.setTimeout(() => complete(player.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA), 4800);

      player.addEventListener("canplay", handleReady, { once: true });
      player.addEventListener("error", handleError, { once: true });
    });

    preloadPromises.set(track, preloadPromise);
    return preloadPromise;
  };

  const preload = () => preloadTrack("opening");

  const setVolume = (value, fadeSeconds = 0.22) => {
    const nextVolume = Math.max(0, Math.min(1, Number(value) || 0));
    preferredVolume = nextVolume;
    if (preferredVolume === 0) listeningEpoch += 1;
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(preferredVolume));
    } catch {
      // Ignore private-mode and storage-policy failures.
    }
    if (audio && !audio.paused && !muted) fadeTo(effectiveVolume(), fadeSeconds);
    emitState();
    return preferredVolume;
  };

  const start = async (volume = preferredVolume) => {
    setVolume(volume, 0);
    const player = ensureAudio();
    cancelFade();
    muted = false;
    playbackRequested = true;

    if (!player.paused) {
      fadeTo(effectiveVolume(), 0.35, emitState);
      emitState();
      return true;
    }

    player.volume = 0;

    try {
      // play() is deliberately called before awaiting anything so Chrome keeps
      // the user's click as the audio permission gesture.
      await player.play();
      fadeTo(effectiveVolume(), 1.2, emitState);
      emitState();
      return true;
    } catch {
      muted = true;
      playbackRequested = false;
      emitState();
      return false;
    }
  };

  const setMuted = async (nextMuted) => {
    muted = Boolean(nextMuted);
    if (muted) {
      listeningEpoch += 1;
      playbackRequested = false;
      if (audio && !audio.paused) fadeTo(0, 0.24, emitState);
      emitState();
      return true;
    }

    playbackRequested = true;
    if (!audio || audio.paused) return start(preferredVolume);
    fadeTo(effectiveVolume(), 0.24, emitState);
    emitState();
    return true;
  };

  const toggleMuted = () => setMuted(!muted);

  const switchTrack = async (track, fadeSeconds = 0.5) => {
    if (!TRACKS[track]) return false;
    const serial = ++switchSerial;
    const switchFadeOutSeconds = Math.max(0, fadeSeconds) * TRACK_SWITCH_FADE_MULTIPLIER;
    if (track === activeTrack) {
      if (playbackRequested && !muted && audio?.paused) {
        try {
          audio.volume = 0;
          await audio.play();
          fadeTo(effectiveVolume(), 0.45, emitState);
        } catch {
          muted = true;
          playbackRequested = false;
          emitState();
          return false;
        }
      }
      if (audio && !audio.paused && !muted && audio.volume < effectiveVolume()) {
        fadeTo(effectiveVolume(), 0.25, emitState);
      }
      emitState();
      return true;
    }

    const previousTrack = activeTrack;
    const previousPlayer = players.get(previousTrack) || null;
    const nextPlayer = ensureAudio(track);
    const shouldResume = playbackRequested && !muted;

    if (!shouldResume) {
      if (previousPlayer) {
        previousPlayer.pause();
        previousPlayer.currentTime = 0;
      }
      activeTrack = track;
      audio = nextPlayer;
      nextPlayer.currentTime = 0;
      nextPlayer.volume = 0;
      emitState();
      void preloadTrack(track);
      return true;
    }

    const activateNextPlayer = async () => {
      if (serial !== switchSerial) return;
      if (previousPlayer) {
        previousPlayer.pause();
        previousPlayer.currentTime = 0;
      }
      activeTrack = track;
      audio = nextPlayer;
      nextPlayer.currentTime = 0;
      nextPlayer.volume = 0;
      emitState();

      await preloadTrack(track);
      if (serial !== switchSerial) return;
      try {
        await nextPlayer.play();
        if (serial !== switchSerial) return;
        fadeTo(effectiveVolume(), TRACK_SWITCH_FADE_IN_SECONDS, emitState);
        emitState();
      } catch {
        if (!previousPlayer) {
          muted = true;
          playbackRequested = false;
        } else {
          activeTrack = previousTrack;
          audio = previousPlayer;
          try {
            await previousPlayer.play();
            fadeTo(effectiveVolume(), 0.3, emitState);
          } catch {
            muted = true;
            playbackRequested = false;
          }
        }
        emitState();
      }
    };

    if (previousPlayer && !previousPlayer.paused && previousPlayer.volume > 0.001) {
      fadeTo(0, switchFadeOutSeconds, () => { void activateNextPlayer(); });
    } else {
      void activateNextPlayer();
    }
    return true;
  };

  const getState = () => ({
    volume: preferredVolume,
    mixGain,
    duckGain: duckGain(),
    muted,
    playing: Boolean(audio && !audio.paused),
    track: activeTrack,
  });

  const getPlaybackState = () => ({
    ...getState(),
    outputVolume: Number.isFinite(audio?.volume) ? audio.volume : 0,
    currentTime: Number.isFinite(audio?.currentTime) ? audio.currentTime : 0,
    duration: Number.isFinite(audio?.duration) ? audio.duration : 0,
  });

  const seek = (seconds) => {
    const player = ensureAudio();
    if (!Number.isFinite(player.duration) || player.duration <= 0) return false;
    player.currentTime = Math.max(0, Math.min(player.duration, Number(seconds) || 0));
    emitState();
    return true;
  };

  const persistNavigationState = () => {
    if (navigationStatePersisted) return true;
    try {
      window.sessionStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify({
        savedAt: Date.now(),
        track: activeTrack,
        currentTime: Number.isFinite(audio?.currentTime) ? audio.currentTime : 0,
        volume: preferredVolume,
        muted,
        playing: Boolean(audio && !audio.paused),
        playbackRequested,
      }));
      navigationStatePersisted = true;
      return true;
    } catch {
      return false;
    }
  };

  const transitionToPage = (track, destination, fadeOutSeconds = 0.65, fadeInSeconds = 1.2) => {
    if (!TRACKS[track] || navigationTransitionPending) return false;
    navigationTransitionPending = true;
    const shouldResume = playbackRequested && !muted;
    const currentPlayer = audio;
    void preloadTrack(track);

    const navigate = () => {
      currentPlayer?.pause();
      try {
        window.sessionStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify({
          savedAt: Date.now(),
          track,
          currentTime: 0,
          volume: preferredVolume,
          muted,
          playing: false,
          playbackRequested: shouldResume,
          fadeInSeconds,
        }));
        navigationStatePersisted = true;
      } catch {
        // Navigation still proceeds when storage is unavailable.
      }
      window.location.assign(destination);
    };

    if (shouldResume && currentPlayer && !currentPlayer.paused && currentPlayer.volume > 0.001) {
      fadeTo(0, fadeOutSeconds, navigate);
    } else {
      navigate();
    }
    return true;
  };

  const restoreNavigationState = async (destinationTrack = null) => {
    let snapshot = null;
    try {
      snapshot = JSON.parse(window.sessionStorage.getItem(NAVIGATION_STATE_KEY) || "null");
      window.sessionStorage.removeItem(NAVIGATION_STATE_KEY);
    } catch {
      snapshot = null;
    }
    if (!snapshot || !TRACKS[snapshot.track] || Date.now() - Number(snapshot.savedAt || 0) > NAVIGATION_STATE_MAX_AGE_MS) {
      emitState();
      return { restored: false, playing: false, blocked: false };
    }

    const restoredTrack = TRACKS[destinationTrack] ? destinationTrack : snapshot.track;
    const changedTrackForDestination = restoredTrack !== snapshot.track;
    activeTrack = restoredTrack;
    audio = ensureAudio(activeTrack);
    preferredVolume = Math.max(0, Math.min(1, Number(snapshot.volume) || 0));
    muted = Boolean(snapshot.muted);
    playbackRequested = Boolean(snapshot.playbackRequested || snapshot.playing) && !muted;
    const navigationElapsedSeconds = snapshot.playing && !muted && !changedTrackForDestination
      ? Math.max(0, Math.min(NAVIGATION_STATE_MAX_AGE_MS, Date.now() - Number(snapshot.savedAt || 0))) / 1000
      : 0;
    const resumeAt = changedTrackForDestination
      ? 0
      : Math.max(0, Number(snapshot.currentTime) || 0) + navigationElapsedSeconds;
    const applyResumeTime = () => {
      try {
        audio.currentTime = Number.isFinite(audio.duration) && audio.duration > 0 ? resumeAt % audio.duration : resumeAt;
      } catch {
        // A browser may defer seeking until metadata is ready.
      }
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) applyResumeTime();
    else audio.addEventListener("loadedmetadata", applyResumeTime, { once: true });

    if (!playbackRequested) {
      audio.volume = 0;
      emitState();
      return { restored: true, playing: false, blocked: false };
    }

    audio.volume = 0;
    try {
      await audio.play();
      applyResumeTime();
      const fadeInSeconds = Math.max(0, Number(snapshot.fadeInSeconds) || (changedTrackForDestination ? 0.8 : 0));
      if (fadeInSeconds > 0) fadeTo(effectiveVolume(), fadeInSeconds, emitState);
      else audio.volume = effectiveVolume();
      emitState();
      return { restored: true, playing: true, blocked: false };
    } catch {
      // Keep the visitor's sound-on intent. A visible control on the destination
      // page can resume playback with the next click if autoplay is restricted.
      playbackRequested = true;
      muted = false;
      emitState();
      return { restored: true, playing: false, blocked: true };
    }
  };

  const stop = (fadeSeconds = 1.1) => {
    if (!audio) return;
    const player = audio;
    fadeTo(0, fadeSeconds, () => {
      player.pause();
      player.currentTime = 0;
      emitState();
    });
  };

  const setMixGain = (value, fadeSeconds = 0.35) => {
    mixGain = Math.max(0, Math.min(1, Number(value) || 0));
    if (mixGain === 0) listeningEpoch += 1;
    if (audio && !audio.paused && !muted) fadeTo(effectiveVolume(), fadeSeconds, emitState);
    else emitState();
    return mixGain;
  };

  // A temporary entry curtain must not overwrite another scene's mix or the
  // listener's saved preference. Each owner releases only its own attenuation.
  const setDuckGain = (owner, value, fadeSeconds = 0.35) => {
    const gain = Math.max(0, Math.min(1, Number(value) || 0));
    if (gain === 1) duckGains.delete(owner);
    else duckGains.set(owner, gain);
    if (gain === 0) listeningEpoch += 1;
    if (audio && !audio.paused && !muted) fadeTo(effectiveVolume(), fadeSeconds, emitState, true);
    else emitState();
  };

  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const destination = new URL(anchor.href, document.baseURI);
    const isPrimaryNavigation = event.button === 0
      && !event.metaKey
      && !event.ctrlKey
      && !event.shiftKey
      && !event.altKey
      && !anchor.download
      && (!anchor.target || anchor.target === "_self");
    const transitionTrack = anchor.dataset.gaiaAudioTransition;
    if (
      isPrimaryNavigation
      && TRACKS[transitionTrack]
      && destination.origin === location.origin
      && destination.pathname !== location.pathname
    ) {
      event.preventDefault();
      transitionToPage(transitionTrack, destination.href);
      return;
    }
    if (
      isPrimaryNavigation
      && anchor.matches("[data-sensor-platform-link]")
      && destination.origin === location.origin
      && destination.pathname !== location.pathname
    ) {
      event.preventDefault();
      transitionToPage("sensorfield", destination.href);
      return;
    }
    if (destination.origin === location.origin && destination.pathname !== location.pathname) persistNavigationState();
  }, { capture: true });
  window.addEventListener("pagehide", persistNavigationState);

  window.GaiaOpeningAudio = Object.freeze({
    preload,
    preloadTrack,
    start,
    stop,
    switchTrack,
    setVolume,
    setMixGain,
    setDuckGain,
    setMuted,
    toggleMuted,
    getState,
    getPlaybackState,
    getHeardTracks,
    hasTrackBeenHeard,
    enableAnalysis,
    getAnalysisFrame,
    seek,
    persistNavigationState,
    restoreNavigationState,
    transitionToPage,
  });
})();
