import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("assets/audio");
const mode = process.argv.includes("--check")
  ? "check"
  : process.argv.includes("--inspect")
    ? "inspect"
    : "strip";

const isMarker = (buffer, offset, marker) => (
  offset >= 0
  && offset + marker.length <= buffer.length
  && buffer.subarray(offset, offset + marker.length).equals(Buffer.from(marker, "ascii"))
);

const readSynchsafe = (buffer, offset) => {
  const bytes = buffer.subarray(offset, offset + 4);
  if (bytes.length !== 4 || bytes.some((byte) => byte > 0x7f)) return null;
  return ((bytes[0] << 21) | (bytes[1] << 14) | (bytes[2] << 7) | bytes[3]) >>> 0;
};

const stripLeadingId3v2 = (buffer, tags) => {
  let start = 0;
  while (isMarker(buffer, start, "ID3") && start + 10 <= buffer.length) {
    const payloadSize = readSynchsafe(buffer, start + 6);
    if (payloadSize === null) break;
    const footerSize = (buffer[start + 5] & 0x10) !== 0 ? 10 : 0;
    const tagSize = 10 + payloadSize + footerSize;
    if (tagSize < 10 || start + tagSize > buffer.length) break;
    tags.push({ type: `ID3v2.${buffer[start + 3]}`, bytes: tagSize });
    start += tagSize;
  }
  return start;
};

const stripTrailingId3v1 = (buffer, end, tags) => {
  if (end >= 128 && isMarker(buffer, end - 128, "TAG")) {
    end -= 128;
    tags.push({ type: "ID3v1", bytes: 128 });
    if (end >= 227 && isMarker(buffer, end - 227, "TAG+")) {
      end -= 227;
      tags.push({ type: "ID3v1 extended", bytes: 227 });
    }
  }
  return end;
};

const stripTrailingLyrics3 = (buffer, end, tags) => {
  if (end >= 15 && isMarker(buffer, end - 9, "LYRICS200")) {
    const sizeText = buffer.subarray(end - 15, end - 9).toString("ascii");
    if (/^\d{6}$/u.test(sizeText)) {
      const payloadSize = Number(sizeText);
      const start = end - 15 - payloadSize;
      if (start >= 0 && isMarker(buffer, start, "LYRICSBEGIN")) {
        tags.push({ type: "Lyrics3v2", bytes: end - start });
        return start;
      }
    }
  }
  if (end >= 9 && isMarker(buffer, end - 9, "LYRICSEND")) {
    const searchStart = Math.max(0, end - 5200);
    const start = buffer.lastIndexOf(Buffer.from("LYRICSBEGIN", "ascii"), end - 9);
    if (start >= searchStart) {
      tags.push({ type: "Lyrics3v1", bytes: end - start });
      return start;
    }
  }
  return end;
};

const stripTrailingApev2 = (buffer, end, tags) => {
  if (end < 32 || !isMarker(buffer, end - 32, "APETAGEX")) return end;
  const footer = end - 32;
  const tagSize = buffer.readUInt32LE(footer + 12);
  if (tagSize < 32 || tagSize > end) return end;
  let start = end - tagSize;
  if (start >= 32 && isMarker(buffer, start - 32, "APETAGEX")) start -= 32;
  tags.push({ type: "APEv2", bytes: end - start });
  return start;
};

const locateAudio = (buffer) => {
  const tags = [];
  const start = stripLeadingId3v2(buffer, tags);
  let end = buffer.length;
  let previousEnd = -1;
  while (end !== previousEnd) {
    previousEnd = end;
    end = stripTrailingId3v1(buffer, end, tags);
    end = stripTrailingLyrics3(buffer, end, tags);
    end = stripTrailingApev2(buffer, end, tags);
  }
  assert.ok(start < end, "metadata occupies the complete file");
  return { start, end, tags };
};

const bitrates = {
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2-3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

const readFrame = (buffer, offset) => {
  if (offset + 4 > buffer.length || buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
    return null;
  }
  const versionBits = (buffer[offset + 1] >> 3) & 0x03;
  const layerBits = (buffer[offset + 1] >> 1) & 0x03;
  const bitrateIndex = (buffer[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x03;
  if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    return null;
  }
  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const layer = 4 - layerBits;
  const tableVersion = version === 1 ? 1 : 2;
  const bitrate = bitrates[`${tableVersion}-${layer}`][bitrateIndex] * 1000;
  const baseSampleRates = [44100, 48000, 32000];
  const sampleRate = baseSampleRates[sampleRateIndex] / (version === 1 ? 1 : version === 2 ? 2 : 4);
  const padding = (buffer[offset + 2] >> 1) & 1;
  const length = layer === 1
    ? Math.floor((12 * bitrate) / sampleRate + padding) * 4
    : Math.floor(((layer === 3 && version !== 1 ? 72 : 144) * bitrate) / sampleRate) + padding;
  return length >= 24 && offset + length <= buffer.length ? { length, version, layer } : null;
};

const validateFrames = (buffer) => {
  let offset = 0;
  let frames = 0;
  while (offset + 4 <= buffer.length) {
    const frame = readFrame(buffer, offset);
    if (!frame) break;
    offset += frame.length;
    frames += 1;
  }
  assert.ok(frames >= 3, "fewer than three valid MPEG audio frames");
  const trailing = buffer.subarray(offset);
  assert.ok(
    trailing.length === 0 || trailing.every((byte) => byte === 0),
    `non-audio data remains after MPEG frame ${frames} at byte ${offset}`,
  );
  return { frames, trailingBytes: trailing.length };
};

const listMp3Files = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listMp3Files(target));
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".mp3") files.push(target);
  }
  return files.sort();
};

const replaceAtomically = async (file, contents) => {
  const temporary = `${file}.strip-meta.tmp`;
  const backup = `${file}.strip-meta.bak`;
  await fs.writeFile(temporary, contents, { flag: "wx" });
  try {
    await fs.rename(file, backup);
    try {
      await fs.rename(temporary, file);
    } catch (error) {
      await fs.rename(backup, file);
      throw error;
    }
    await fs.rm(backup);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
};

const files = await listMp3Files(root);
assert.ok(files.length > 0, "no MP3 files found");
const report = [];

for (const file of files) {
  const original = await fs.readFile(file);
  const { start, end, tags } = locateAudio(original);
  const audio = original.subarray(start, end);
  const validatedFrames = validateFrames(audio);
  if (mode === "strip" && tags.length > 0) await replaceAtomically(file, audio);
  if (mode === "check") assert.equal(tags.length, 0, `${file}: metadata remains`);
  report.push({
    file: path.relative(process.cwd(), file),
    originalBytes: original.length,
    audioBytes: audio.length,
    removedBytes: original.length - audio.length,
    tags,
    validatedFrames,
  });
}

console.log(JSON.stringify({ status: "passed", mode, files: report }, null, 2));
