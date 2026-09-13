import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "assets", "audio", "gaia-map-ambient-harp-felt-piano.wav");
const sampleRate = 24_000;
const durationSeconds = 40;
const frameCount = sampleRate * durationSeconds;
const musicLeft = new Float32Array(frameCount);
const musicRight = new Float32Array(frameCount);
const foundationLeft = new Float32Array(frameCount);
const foundationRight = new Float32Array(frameCount);
const twoPi = Math.PI * 2;

let randomState = 0x4d415031;
const random = () => {
  randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
  return randomState / 0x1_0000_0000;
};

const midiFrequency = (note) => 440 * (2 ** ((note - 69) / 12));
const panGains = (pan) => {
  const position = Math.max(-1, Math.min(1, pan));
  const angle = (position + 1) * Math.PI * 0.25;
  return [Math.cos(angle), Math.sin(angle)];
};

const addFeltPiano = ({ at, note, amplitude, pan }) => {
  const frequency = midiFrequency(note);
  const start = Math.round(at * sampleRate);
  const length = Math.min(frameCount - start, Math.round(15.5 * sampleRate));
  const [leftGain, rightGain] = panGains(pan);
  const phaseOffset = random() * twoPi;

  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const attack = 1 - Math.exp(-time / 0.026);
    const body = Math.exp(-time / 7.8);
    const felt = Math.exp(-time / 0.22);
    const fundamental = Math.sin(twoPi * frequency * time + phaseOffset);
    const second = Math.sin(twoPi * frequency * 2 * time + phaseOffset * 0.43) * Math.exp(-time / 2.8);
    const third = Math.sin(twoPi * frequency * 3 * time + phaseOffset * 0.21) * Math.exp(-time / 1.35);
    const softImpact = Math.sin(twoPi * frequency * 0.5 * time) * felt;
    const sample = amplitude * attack * body * (
      fundamental * 0.88
      + second * 0.11
      + third * 0.026
      + softImpact * 0.09
    );
    const frame = start + index;
    musicLeft[frame] += sample * leftGain;
    musicRight[frame] += sample * rightGain;
  }
};

const addHarpNote = ({ at, note, amplitude, pan, decay = 5.6 }) => {
  const frequency = midiFrequency(note);
  const start = Math.round(at * sampleRate);
  const length = Math.min(frameCount - start, Math.round(11 * sampleRate));
  const [leftGain, rightGain] = panGains(pan);
  const phaseOffset = random() * twoPi;

  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const attack = 1 - Math.exp(-time / 0.007);
    const envelope = attack * Math.exp(-time / decay);
    const shimmerEnvelope = Math.exp(-time / 1.9);
    const fundamental = Math.sin(twoPi * frequency * time + phaseOffset);
    const second = Math.sin(twoPi * frequency * 2.002 * time + phaseOffset * 0.61);
    const third = Math.sin(twoPi * frequency * 2.997 * time + phaseOffset * 0.27);
    const fourth = Math.sin(twoPi * frequency * 3.996 * time + phaseOffset * 0.14);
    const tone = fundamental * 0.82
      + second * 0.18 * shimmerEnvelope
      + third * 0.055 * shimmerEnvelope
      + fourth * 0.014 * shimmerEnvelope;
    const sample = amplitude * envelope * tone;
    const frame = start + index;
    musicLeft[frame] += sample * leftGain;
    musicRight[frame] += sample * rightGain;
  }
};

const harpPhrases = [
  { at: 4.2, notes: [62, 69, 74, 78], step: 0.5, direction: 1 },
  { at: 18.5, notes: [67, 74, 81, 86], step: 0.58, direction: -1 },
  { at: 30.4, notes: [57, 64, 71, 78], step: 0.52, direction: 1 },
];

for (const phrase of harpPhrases) {
  phrase.notes.forEach((note, index) => addHarpNote({
    at: phrase.at + index * phrase.step,
    note,
    amplitude: 0.036 - index * 0.0024,
    pan: phrase.direction * (-0.58 + index * (1.16 / Math.max(1, phrase.notes.length - 1))),
    decay: 5.2 + index * 0.52,
  }));
}

const glissandoNotes = [62, 64, 67, 69, 71, 74, 76, 78, 81];
glissandoNotes.forEach((note, index) => addHarpNote({
  at: 12.6 + index * 0.19,
  note,
  amplitude: 0.0155,
  pan: -0.72 + index * 0.18,
  decay: 4.4,
}));

[
  { at: 8.8, note: 50, amplitude: 0.064, pan: -0.18 },
  { at: 21.6, note: 57, amplitude: 0.052, pan: 0.22 },
  { at: 32.7, note: 52, amplitude: 0.058, pan: -0.32 },
].forEach(addFeltPiano);

const addStringLayer = ({ note, amplitude, pan, phase }) => {
  const frequency = midiFrequency(note);
  const [leftGain, rightGain] = panGains(pan);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / sampleRate;
    const movement = 0.46 + 0.22 * Math.sin(twoPi * time / 20 + phase)
      + 0.12 * Math.sin(twoPi * time / 40 - phase * 0.7);
    const bow = 0.88 * Math.sin(twoPi * frequency * time + phase)
      + 0.1 * Math.sin(twoPi * frequency * 2 * time + phase * 0.31)
      + 0.025 * Math.sin(twoPi * frequency * 3 * time + phase * 0.13);
    const sample = amplitude * Math.max(0.12, movement) * bow;
    musicLeft[frame] += sample * leftGain;
    musicRight[frame] += sample * rightGain;
  }
};

[
  { note: 50, amplitude: 0.012, pan: -0.62, phase: 0.2 },
  { note: 57, amplitude: 0.0095, pan: 0.58, phase: 1.7 },
  { note: 59, amplitude: 0.007, pan: -0.24, phase: 2.8 },
  { note: 64, amplitude: 0.006, pan: 0.31, phase: 4.1 },
  { note: 67, amplitude: 0.0042, pan: 0.68, phase: 5.2 },
].forEach(addStringLayer);

let oceanSlowLeft = 0;
let oceanBodyLeft = 0;
let oceanSlowRight = 0;
let oceanBodyRight = 0;
let airLowLeft = 0;
let airBodyLeft = 0;
let airLowRight = 0;
let airBodyRight = 0;

for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / sampleRate;
  const tide = 0.5 - 0.5 * Math.cos(twoPi * time / 10);
  const slowerTide = 0.5 + 0.5 * Math.sin(twoPi * time / 20 - 0.7);
  const sub = (
    Math.sin(twoPi * 36.7081 * time) * 0.033
    + Math.sin(twoPi * 55 * time + 0.8) * 0.009
  ) * (0.24 + tide * tide * 0.76);
  const drone = (
    Math.sin(twoPi * 73.4162 * time + 0.3) * 0.012
    + Math.sin(twoPi * 82.4069 * time + 2.1) * 0.006
  ) * (0.45 + slowerTide * 0.38);

  const whiteLeft = random() * 2 - 1;
  const whiteRight = random() * 2 - 1;
  oceanBodyLeft += 0.006 * (whiteLeft - oceanBodyLeft);
  oceanSlowLeft += 0.00034 * (whiteLeft - oceanSlowLeft);
  oceanBodyRight += 0.0063 * (whiteRight - oceanBodyRight);
  oceanSlowRight += 0.00031 * (whiteRight - oceanSlowRight);
  const oceanLeft = (oceanBodyLeft - oceanSlowLeft) * (0.014 + tide * 0.008);
  const oceanRight = (oceanBodyRight - oceanSlowRight) * (0.014 + tide * 0.008);

  airLowLeft += 0.105 * (whiteLeft - airLowLeft);
  airBodyLeft += 0.011 * (airLowLeft - airBodyLeft);
  airLowRight += 0.098 * (whiteRight - airLowRight);
  airBodyRight += 0.0105 * (airLowRight - airBodyRight);
  const airMotion = 0.58 + 0.42 * Math.sin(twoPi * time / 20 + 1.1) ** 2;
  const airLeft = (airLowLeft - airBodyLeft) * 0.0022 * airMotion;
  const airRight = (airLowRight - airBodyRight) * 0.0022 * airMotion;

  foundationLeft[frame] += sub + drone * 0.92 + oceanLeft + airLeft;
  foundationRight[frame] += sub + drone * 1.04 + oceanRight + airRight;
}

const combDelays = [0.0297, 0.0371, 0.0411, 0.0437, 0.0499, 0.0531, 0.0593, 0.0677];
const allpassDelays = [0.0126, 0.0099, 0.0077, 0.0051];

const combBank = (input, stereoOffset) => {
  const output = new Float32Array(frameCount);
  combDelays.forEach((delaySeconds, combIndex) => {
    const delay = Math.max(1, Math.round(delaySeconds * sampleRate) + stereoOffset * (combIndex + 1));
    const buffer = new Float32Array(delay);
    const feedback = 0.947 - combIndex * 0.0031;
    const damping = 0.34 + combIndex * 0.012;
    let cursor = 0;
    let filterStore = 0;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const delayed = buffer[cursor];
      filterStore = delayed * (1 - damping) + filterStore * damping;
      buffer[cursor] = input[frame] + filterStore * feedback;
      output[frame] += delayed * 0.125;
      cursor = cursor + 1 === delay ? 0 : cursor + 1;
    }
  });
  return output;
};

const diffuse = (input, stereoOffset) => {
  let signal = input;
  allpassDelays.forEach((delaySeconds, index) => {
    const delay = Math.max(1, Math.round(delaySeconds * sampleRate) + stereoOffset * (index + 1));
    const buffer = new Float32Array(delay);
    const output = new Float32Array(frameCount);
    let cursor = 0;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const delayed = buffer[cursor];
      const sample = signal[frame];
      output[frame] = delayed - sample * 0.5;
      buffer[cursor] = sample + delayed * 0.5;
      cursor = cursor + 1 === delay ? 0 : cursor + 1;
    }
    signal = output;
  });
  return signal;
};

const reverberatedLeft = diffuse(combBank(musicLeft, 0), 0);
const reverberatedRight = diffuse(combBank(musicRight, 17), 11);
const finalLeft = new Float32Array(frameCount);
const finalRight = new Float32Array(frameCount);
const lowPassAlpha = 1 - Math.exp((-twoPi * 6_500) / sampleRate);
const highPassCoefficient = Math.exp((-twoPi * 18) / sampleRate);
let lowOneLeft = 0;
let lowTwoLeft = 0;
let lowOneRight = 0;
let lowTwoRight = 0;
let previousInputLeft = 0;
let previousOutputLeft = 0;
let previousInputRight = 0;
let previousOutputRight = 0;

for (let frame = 0; frame < frameCount; frame += 1) {
  const mixedLeft = foundationLeft[frame]
    + musicLeft[frame] * 0.76
    + reverberatedLeft[frame] * 0.68
    + reverberatedRight[frame] * 0.09;
  const mixedRight = foundationRight[frame]
    + musicRight[frame] * 0.76
    + reverberatedRight[frame] * 0.68
    + reverberatedLeft[frame] * 0.09;

  lowOneLeft += lowPassAlpha * (mixedLeft - lowOneLeft);
  lowTwoLeft += lowPassAlpha * (lowOneLeft - lowTwoLeft);
  lowOneRight += lowPassAlpha * (mixedRight - lowOneRight);
  lowTwoRight += lowPassAlpha * (lowOneRight - lowTwoRight);

  const highPassedLeft = lowTwoLeft - previousInputLeft + highPassCoefficient * previousOutputLeft;
  const highPassedRight = lowTwoRight - previousInputRight + highPassCoefficient * previousOutputRight;
  previousInputLeft = lowTwoLeft;
  previousOutputLeft = highPassedLeft;
  previousInputRight = lowTwoRight;
  previousOutputRight = highPassedRight;
  finalLeft[frame] = highPassedLeft;
  finalRight[frame] = highPassedRight;
}

for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / sampleRate;
  const fadeInProgress = Math.max(0, Math.min(1, time / 2.5));
  const fadeOutProgress = Math.max(0, Math.min(1, (durationSeconds - time) / 4.5));
  const fadeIn = fadeInProgress * fadeInProgress * (3 - 2 * fadeInProgress);
  const fadeOut = fadeOutProgress * fadeOutProgress * (3 - 2 * fadeOutProgress);
  const seamEnvelope = fadeIn * fadeOut;
  finalLeft[frame] *= seamEnvelope;
  finalRight[frame] *= seamEnvelope;
}

let peak = 0;
let squareSum = 0;
for (let frame = 0; frame < frameCount; frame += 1) {
  peak = Math.max(peak, Math.abs(finalLeft[frame]), Math.abs(finalRight[frame]));
  squareSum += finalLeft[frame] ** 2 + finalRight[frame] ** 2;
}
const rawRms = Math.sqrt(squareSum / (frameCount * 2));
const normalization = Math.min(0.82 / Math.max(peak, 1e-9), 0.105 / Math.max(rawRms, 1e-9));
peak = 0;
squareSum = 0;
for (let frame = 0; frame < frameCount; frame += 1) {
  finalLeft[frame] *= normalization;
  finalRight[frame] *= normalization;
  peak = Math.max(peak, Math.abs(finalLeft[frame]), Math.abs(finalRight[frame]));
  squareSum += finalLeft[frame] ** 2 + finalRight[frame] ** 2;
}

const bytesPerSample = 2;
const channelCount = 2;
const dataSize = frameCount * channelCount * bytesPerSample;
const wav = Buffer.allocUnsafe(44 + dataSize);
wav.write("RIFF", 0, "ascii");
wav.writeUInt32LE(36 + dataSize, 4);
wav.write("WAVE", 8, "ascii");
wav.write("fmt ", 12, "ascii");
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(channelCount, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
wav.writeUInt16LE(channelCount * bytesPerSample, 32);
wav.writeUInt16LE(bytesPerSample * 8, 34);
wav.write("data", 36, "ascii");
wav.writeUInt32LE(dataSize, 40);

let byteOffset = 44;
for (let frame = 0; frame < frameCount; frame += 1) {
  const ditherLeft = (random() - random()) / 65_536;
  const ditherRight = (random() - random()) / 65_536;
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, finalLeft[frame] + ditherLeft)) * 32_767), byteOffset);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, finalRight[frame] + ditherRight)) * 32_767), byteOffset + 2);
  byteOffset += 4;
}

fs.writeFileSync(outputPath, wav);
console.log(JSON.stringify({
  status: "generated",
  output: path.relative(root, outputPath).split(path.sep).join("/"),
  sampleRate,
  durationSeconds,
  channels: channelCount,
  bitsPerSample: bytesPerSample * 8,
  bytes: wav.length,
  peak: Number(peak.toFixed(6)),
  rms: Number(Math.sqrt(squareSum / (frameCount * 2)).toFixed(6)),
  normalization: Number(normalization.toFixed(6)),
}, null, 2));
