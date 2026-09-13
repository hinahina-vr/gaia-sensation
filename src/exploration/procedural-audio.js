import { toSoundParameters } from "./transforms.js";

const MODE_PROFILES = Object.freeze({
  "wind-field": Object.freeze({
    key: "weatherWindSpeed",
    root: 146.83,
    chord: [0, 4, 7, 14],
    scale: [0, 2, 4, 7, 9, 14],
    tempo: [54, 112],
    fallback: 0.14,
    noteLength: 1.2,
    mapping: "風速 → テンポ・高域・風の粒子音",
  }),
  "carbon-pulse": Object.freeze({
    key: "forecastCo2",
    root: 130.81,
    chord: [0, 4, 7, 11],
    scale: [0, 2, 4, 7, 9, 11],
    tempo: [42, 62],
    fallback: 0.4,
    noteLength: 2.8,
    mapping: "CO₂ → 和音の呼吸周期・微細なピッチ変化",
  }),
  "rain-chorus": Object.freeze({
    key: "weatherPrecipitation",
    root: 110,
    chord: [0, 3, 7, 10],
    scale: [0, 3, 5, 7, 10, 12],
    tempo: [58, 148],
    fallback: 0.08,
    noteLength: 0.72,
    mapping: "降水量 → 音符密度・残響・水滴の明るさ",
  }),
  "temperature-field": Object.freeze({
    key: "weatherTemperature",
    root: 164.81,
    chord: [0, 4, 7, 12],
    scale: [0, 2, 4, 7, 9, 12],
    tempo: [48, 106],
    fallback: 0.58,
    noteLength: 1.5,
    mapping: "気温 → 音域・明るさ・等温線の周期",
  }),
  "cloud-drift": Object.freeze({
    key: "cloudCover",
    root: 123.47,
    chord: [0, 5, 7, 10],
    scale: [0, 2, 5, 7, 10, 12],
    tempo: [34, 70],
    fallback: 0.45,
    noteLength: 3.2,
    mapping: "雲量 → 音の密度・帯域・残響",
  }),
  "pm25-haze": Object.freeze({
    key: "pm25",
    root: 146.83,
    chord: [0, 5, 7, 12],
    scale: [0, 2, 5, 7, 9, 12],
    tempo: [38, 82],
    fallback: 0.16,
    noteLength: 2.1,
    mapping: "PM2.5 → 共鳴・高域の霞 / 欠測時は走査待機音",
  }),
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const clamp01 = (value) => clamp(Number(value) || 0, 0, 1);
const semitone = (offset) => 2 ** (offset / 12);

class ProceduralAudio {
  constructor() {
    this.context = null;
    this.enabled = false;
    this.nodes = null;
    this.measurements = {};
    this.parameters = toSoundParameters({});
    this.focus = null;
    this.telemetry = Object.freeze({ level: 0, tempo: 0, chord: [], missing: true, mapping: "" });
    this.sequenceTimer = 0;
    this.sequenceStep = 0;
    this.touchCount = 0;
    this.lastTouchAt = 0;
    this.lastNoteFrequency = 0;
    this.voices = new Set();
    document.addEventListener("visibilitychange", () => void this.syncVisibility());
    globalThis.addEventListener("gaia:audio-state", () => this.syncMaster());
    globalThis.addEventListener("gaia:live-update", (event) => this.update(event.detail?.measurements || {}));
    globalThis.addEventListener("gaia:live-exhibit-change", (event) => this.setFocus(event.detail?.id || null));
    globalThis.addEventListener("gaia:live-touch", (event) => this.triggerTouch(event.detail || {}));
  }

  profile() {
    return MODE_PROFILES[this.focus] || null;
  }

  emit() {
    globalThis.dispatchEvent(new CustomEvent("gaia:procedural-audio-state", { detail: this.getState() }));
  }

  async enable() {
    if (!this.context) this.createGraph();
    this.enabled = true;
    if (this.focus) globalThis.GaiaOpeningAudio?.setMixGain?.(0.28);
    await this.syncVisibility();
    this.applyParameters();
    this.syncMaster();
    this.emit();
  }

  disable() {
    this.enabled = false;
    globalThis.GaiaOpeningAudio?.setMixGain?.(1);
    clearTimeout(this.sequenceTimer);
    this.sequenceTimer = 0;
    this.setTarget(this.nodes?.master?.gain, 0, 0.18);
    this.emit();
  }

  setFocus(focus) {
    const nextFocus = MODE_PROFILES[focus] ? focus : null;
    if (nextFocus === this.focus) return;
    this.focus = nextFocus;
    globalThis.GaiaOpeningAudio?.setMixGain?.(this.enabled && this.focus ? 0.28 : 1);
    this.sequenceStep = 0;
    this.applyParameters();
    this.syncMaster();
    this.scheduleSequence(true);
    this.emit();
  }

  createGraph() {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API is not available");
    const context = new AudioContextClass({ latencyHint: "interactive" });
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const analyser = context.createAnalyser();
    const dry = context.createGain();
    const reverbInput = context.createGain();
    const reverb = context.createConvolver();
    const wet = context.createGain();
    const padBus = context.createGain();
    const padFilter = context.createBiquadFilter();
    const breath = context.createOscillator();
    const breathDepth = context.createGain();
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const noisePan = context.createStereoPanner ? context.createStereoPanner() : context.createGain();

    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.04;
    compressor.release.value = 1.4;
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.84;
    master.gain.value = 0;
    dry.gain.value = 0.82;
    wet.gain.value = 0.28;
    reverb.buffer = this.createImpulse(context, 3.6, 3.1);
    padBus.gain.value = 0.82;
    padFilter.type = "lowpass";
    padFilter.Q.value = 0.72;
    padFilter.frequency.value = 1_200;
    breath.type = "sine";
    breath.frequency.value = 0.08;
    breathDepth.gain.value = 0.035;
    breath.connect(breathDepth).connect(padBus.gain);

    const padOscillators = [
      this.createPadVoice(context, padBus, "sine", -0.34, 0.07),
      this.createPadVoice(context, padBus, "triangle", 0.12, 0.046),
      this.createPadVoice(context, padBus, "sine", 0.38, 0.032),
      this.createPadVoice(context, padBus, "sine", -0.08, 0.021),
    ];

    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let seed = 0x51633;
    for (let index = 0; index < channel.length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      channel[index] = seed / 0xffffffff * 2 - 1;
    }
    noise.buffer = buffer;
    noise.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 540;
    noiseFilter.Q.value = 0.7;
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter).connect(noiseGain).connect(noisePan);

    padBus.connect(padFilter);
    padFilter.connect(dry);
    padFilter.connect(reverbInput);
    noisePan.connect(dry);
    noisePan.connect(reverbInput);
    dry.connect(master);
    reverbInput.connect(reverb).connect(wet).connect(master);
    master.connect(compressor).connect(analyser).connect(context.destination);

    breath.start();
    noise.start();
    this.context = context;
    this.nodes = {
      master,
      compressor,
      analyser,
      dry,
      reverbInput,
      reverb,
      wet,
      padBus,
      padFilter,
      padOscillators,
      breath,
      breathDepth,
      noise,
      noiseFilter,
      noiseGain,
      noisePan,
    };
  }

  createPadVoice(context, destination, type, pan, gainValue) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = 110;
    gain.gain.value = gainValue;
    if ("pan" in panner) panner.pan.value = pan;
    oscillator.connect(gain).connect(panner).connect(destination);
    oscillator.start();
    return { oscillator, gain, panner, gainValue };
  }

  createImpulse(context, seconds, decay) {
    const length = Math.round(context.sampleRate * seconds);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    let seed = 0x19d27;
    for (let channelIndex = 0; channelIndex < impulse.numberOfChannels; channelIndex += 1) {
      const channel = impulse.getChannelData(channelIndex);
      for (let index = 0; index < length; index += 1) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const noise = seed / 0x7fffffff * 2 - 1;
        channel[index] = noise * ((1 - index / length) ** decay);
      }
    }
    return impulse;
  }

  update(measurements) {
    this.measurements = measurements;
    this.parameters = toSoundParameters(measurements);
    this.applyParameters();
    this.scheduleSequence();
    this.emit();
  }

  applyParameters() {
    const profile = this.profile();
    if (!profile) {
      this.telemetry = Object.freeze({ level: 0, tempo: 0, chord: [], missing: true, mapping: "" });
      if (this.nodes) {
        this.nodes.padOscillators.forEach((voice) => this.setTarget(voice.gain.gain, 0, 0.8));
        this.setTarget(this.nodes.noiseGain.gain, 0, 0.8);
      }
      return;
    }

    const measurement = this.measurements[profile.key];
    const missing = !measurement || !Number.isFinite(Number(measurement.value));
    const level = missing ? profile.fallback : clamp01(measurement.normalized);
    const tempo = Math.round(profile.tempo[0] + (profile.tempo[1] - profile.tempo[0]) * level);
    const root = profile.root * semitone((level - 0.5) * 1.8);
    const chord = profile.chord.map((offset) => root * semitone(offset));
    this.telemetry = Object.freeze({ level, tempo, chord, missing, mapping: profile.mapping, key: profile.key });
    if (!this.nodes || !this.context) return;

    this.nodes.padOscillators.forEach((voice, index) => {
      const frequency = chord[index % chord.length] / (index === 3 ? 2 : 1);
      this.setTarget(voice.oscillator.frequency, frequency, 1.4);
      const modeGain = this.focus === "rain-chorus" ? 0.72 : this.focus === "pm25-haze" && missing ? 0.54 : 1;
      this.setTarget(voice.gain.gain, voice.gainValue * modeGain, 0.9);
    });

    const brightness = this.focus === "wind-field" ? 1_000 : this.focus === "rain-chorus" ? 720 : this.focus === "temperature-field" ? 920 : this.focus === "cloud-drift" ? 420 : 520;
    this.setTarget(this.nodes.padFilter.frequency, brightness + level * 2_300, 1.2);
    this.setTarget(this.nodes.padFilter.Q, this.focus === "pm25-haze" ? (this.parameters.resonance ?? 0.9) : 0.72 + level * 0.8, 1.2);
    this.setTarget(this.nodes.breath.frequency, this.focus === "carbon-pulse" ? (this.parameters.lfoFrequency ?? 0.06) : tempo / 240, 1.4);
    this.setTarget(this.nodes.breathDepth.gain, 0.018 + level * 0.026, 1.2);
    const windNoise = this.focus === "wind-field" ? 0.006 + level * 0.038 : this.focus === "rain-chorus" ? 0.002 + level * 0.009 : 0.0015;
    this.setTarget(this.nodes.noiseGain.gain, missing && this.focus === "pm25-haze" ? 0.0008 : windNoise, 1.1);
    this.setTarget(this.nodes.noiseFilter.frequency, this.parameters.noiseCutoff ?? 360 + level * 1_900, 1.1);
    this.setTarget(this.nodes.noiseFilter.Q, this.focus === "pm25-haze" ? 1.2 + level * 4 : 0.7 + level, 1.1);
    if ("pan" in this.nodes.noisePan) this.setTarget(this.nodes.noisePan.pan, this.focus === "wind-field" ? -0.28 + level * 0.56 : 0, 1.4);
    this.setTarget(this.nodes.wet.gain, this.focus === "rain-chorus" ? 0.32 + level * 0.24 : this.focus === "carbon-pulse" ? 0.38 : 0.26 + level * 0.12, 1.1);
  }

  scheduleSequence(immediate = false) {
    clearTimeout(this.sequenceTimer);
    this.sequenceTimer = 0;
    const profile = this.profile();
    if (!this.enabled || !profile || document.hidden || this.context?.state !== "running") return;
    if (immediate) this.playSequenceNote();
    const beat = 60_000 / Math.max(1, this.telemetry.tempo);
    const missingFactor = this.telemetry.missing ? 2.4 : this.focus === "carbon-pulse" ? 1.7 : 1;
    this.sequenceTimer = window.setTimeout(() => {
      this.playSequenceNote();
      this.scheduleSequence();
    }, Math.max(360, beat * missingFactor));
  }

  playSequenceNote() {
    const profile = this.profile();
    if (!profile || !this.context || this.context.state !== "running") return;
    const level = this.telemetry.level;
    const offsetIndex = (this.sequenceStep + Math.round(level * 3)) % profile.scale.length;
    const octave = this.focus === "rain-chorus" && this.sequenceStep % 4 === 3 ? 2 : this.sequenceStep % 6 === 5 ? 2 : 1;
    const frequency = profile.root * semitone(profile.scale[offsetIndex]) * octave;
    const pan = Math.sin(this.sequenceStep * 1.7 + level * 2) * 0.42;
    const velocity = this.telemetry.missing ? 0.04 : 0.07 + level * (this.focus === "rain-chorus" ? 0.085 : 0.05);
    this.playTone(frequency, profile.noteLength, velocity, pan, this.focus === "rain-chorus" ? "sine" : "triangle");
    this.sequenceStep += 1;
  }

  playTone(frequency, duration, velocity, pan, type = "sine") {
    if (!this.context || !this.nodes || this.context.state !== "running") return;
    const context = this.context;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const harmonic = context.createOscillator();
    const voiceGain = context.createGain();
    const harmonicGain = context.createGain();
    const filter = context.createBiquadFilter();
    const panner = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    oscillator.type = type;
    harmonic.type = "sine";
    oscillator.frequency.value = frequency;
    harmonic.frequency.value = frequency * 2;
    harmonicGain.gain.value = 0.14;
    filter.type = "lowpass";
    filter.frequency.value = Math.min(8_000, frequency * 9);
    filter.Q.value = 0.7;
    if ("pan" in panner) panner.pan.value = clamp(pan, -0.86, 0.86);
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity), now + 0.035);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.18, duration));
    oscillator.connect(filter);
    harmonic.connect(harmonicGain).connect(filter);
    filter.connect(voiceGain).connect(panner);
    panner.connect(this.nodes.dry);
    panner.connect(this.nodes.reverbInput);
    const voice = { oscillator, harmonic, voiceGain, frequency };
    this.voices.add(voice);
    oscillator.onended = () => this.voices.delete(voice);
    oscillator.start(now);
    harmonic.start(now);
    oscillator.stop(now + duration + 0.08);
    harmonic.stop(now + duration + 0.08);
    this.lastNoteFrequency = frequency;
  }

  triggerTouch(detail) {
    const profile = this.profile();
    if (!this.enabled || !profile || detail.id !== this.focus || !this.context || this.context.state !== "running") return;
    const now = performance.now();
    if (now - this.lastTouchAt < 88) return;
    this.lastTouchAt = now;
    const x = clamp01(detail.x);
    const y = clamp01(detail.y);
    const degree = profile.scale[Math.min(profile.scale.length - 1, Math.floor(x * profile.scale.length))];
    const octave = y < 0.34 ? 2 : y > 0.72 ? 0.5 : 1;
    const frequency = profile.root * semitone(degree) * octave;
    const strength = clamp(Number(detail.strength) || 1, 0.4, 1.5);
    this.playTone(frequency, 1.4 + strength * 0.65, 0.11 + strength * 0.07, x * 1.6 - 0.8, "sine");
    if (strength > 1.15) this.playTone(frequency * 1.5, 1.1, 0.045, x * 1.4 - 0.7, "triangle");
    this.touchCount += 1;
    this.emit();
  }

  setTarget(parameter, value, seconds) {
    if (!parameter || !this.context || !Number.isFinite(Number(value))) return;
    parameter.cancelScheduledValues(this.context.currentTime);
    parameter.setTargetAtTime(Number(value), this.context.currentTime, Math.max(0.02, Number(seconds) || 0.1));
  }

  syncMaster() {
    if (!this.nodes) return;
    const opening = globalThis.GaiaOpeningAudio?.getState?.() || { muted: true, volume: 0.1 };
    const audible = this.enabled && Boolean(this.focus) && !document.hidden && !opening.muted;
    const volume = clamp01(opening.volume || 0.1);
    const target = audible ? Math.min(0.56, 0.18 + Math.sqrt(volume) * 0.38) : 0;
    this.setTarget(this.nodes.master.gain, target, audible ? 0.45 : 0.2);
  }

  async syncVisibility() {
    if (!this.context) return;
    if (document.hidden || !this.enabled) await this.context.suspend();
    else await this.context.resume();
    this.syncMaster();
    this.scheduleSequence(true);
  }

  sampleLevel() {
    if (!this.nodes?.analyser) return 0;
    const values = new Uint8Array(this.nodes.analyser.fftSize);
    this.nodes.analyser.getByteTimeDomainData(values);
    let sum = 0;
    for (const value of values) sum += Math.abs(value - 128);
    return Number((sum / Math.max(1, values.length) / 128).toFixed(4));
  }

  getState() {
    return Object.freeze({
      enabled: this.enabled,
      active: this.enabled && Boolean(this.focus) && !document.hidden && this.context?.state === "running",
      contextState: this.context?.state || "uninitialized",
      focus: this.focus,
      parameters: this.parameters,
      level: this.telemetry.level,
      tempo: this.telemetry.tempo,
      chordFrequencies: [...this.telemetry.chord],
      missing: this.telemetry.missing,
      mapping: this.telemetry.mapping,
      sequenceStep: this.sequenceStep,
      touchCount: this.touchCount,
      liveVoiceCount: this.voices.size,
      lastNoteFrequency: this.lastNoteFrequency,
      outputLevel: this.sampleLevel(),
    });
  }
}

const proceduralAudio = globalThis.GaiaProceduralAudio || new ProceduralAudio();
globalThis.GaiaProceduralAudio = proceduralAudio;
export default proceduralAudio;
