import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "assets", "audio", "sensory-horizon.wav");
const sampleRate = 22_050;
const durationSeconds = 72;
const sampleCount = sampleRate * durationSeconds;
const bytesPerSample = 2;
const dataSize = sampleCount * bytesPerSample;
const buffer = Buffer.alloc(44 + dataSize);

const writeAscii = (offset, value) => buffer.write(value, offset, "ascii");
writeAscii(0, "RIFF");
buffer.writeUInt32LE(36 + dataSize, 4);
writeAscii(8, "WAVE");
writeAscii(12, "fmt ");
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
buffer.writeUInt16LE(bytesPerSample, 32);
buffer.writeUInt16LE(16, 34);
writeAscii(36, "data");
buffer.writeUInt32LE(dataSize, 40);

const midiToFrequency = (note) => 440 * 2 ** ((note - 69) / 12);
const chordRoots = [43, 46, 39, 41, 43, 48];
const chordShape = [0, 7, 12, 16, 19];
const chimeNotes = [74, 79, 81, 86, 77, 84, 88, 79, 82, 89, 86, 91];
const chimeTimes = [4.5, 9.2, 15.4, 20.1, 27.2, 32.8, 39.5, 45.3, 51.7, 57.4, 63.6, 68.1];

let noiseState = 0x5a17c9e3;
let smoothedNoise = 0;
const nextNoise = () => {
  noiseState ^= noiseState << 13;
  noiseState ^= noiseState >>> 17;
  noiseState ^= noiseState << 5;
  return ((noiseState >>> 0) / 0xffffffff) * 2 - 1;
};

for (let index = 0; index < sampleCount; index += 1) {
  const time = index / sampleRate;
  const chordIndex = Math.min(chordRoots.length - 1, Math.floor(time / 12));
  const chordTime = time - chordIndex * 12;
  const chordFade = Math.min(1, chordTime / 2.2, (12 - chordTime) / 2.2);
  const root = chordRoots[chordIndex];
  let sample = 0;

  chordShape.forEach((interval, voiceIndex) => {
    const frequency = midiToFrequency(root + interval);
    const drift = 1 + 0.0018 * Math.sin(2 * Math.PI * (0.017 + voiceIndex * 0.003) * time + voiceIndex);
    const phase = 2 * Math.PI * frequency * drift * time + voiceIndex * 0.91;
    const breath = 0.72 + 0.28 * Math.sin(2 * Math.PI * (0.031 + voiceIndex * 0.004) * time + voiceIndex * 1.7);
    sample += Math.sin(phase) * (0.064 / (1 + voiceIndex * 0.34)) * breath * chordFade;
    sample += Math.sin(phase * 2 + 0.3) * (0.012 / (1 + voiceIndex)) * chordFade;
  });

  chimeTimes.forEach((start, chimeIndex) => {
    const age = time - start;
    if (age < 0 || age > 5.8) return;
    const frequency = midiToFrequency(chimeNotes[chimeIndex]);
    const envelope = Math.exp(-age * 0.72) * Math.min(1, age * 14);
    sample += Math.sin(2 * Math.PI * frequency * age + chimeIndex * 0.47) * 0.082 * envelope;
    sample += Math.sin(2 * Math.PI * frequency * 2.01 * age + 0.9) * 0.024 * envelope;
  });

  smoothedNoise += (nextNoise() - smoothedNoise) * 0.0014;
  sample += smoothedNoise * 0.055;
  sample += Math.sin(2 * Math.PI * 0.071 * time) * Math.sin(2 * Math.PI * 0.113 * time) * 0.011;

  const edgeFade = Math.min(1, time / 1.8, (durationSeconds - time) / 1.8);
  const mastered = Math.tanh(sample * 2.7) * 0.66 * Math.max(0, edgeFade);
  buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mastered)) * 32767), 44 + index * 2);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buffer);
console.log(`Wrote ${path.relative(root, outputPath)} (${durationSeconds}s, ${sampleRate}Hz mono PCM)`);
