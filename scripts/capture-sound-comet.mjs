import { chromium } from "playwright-core";
import { seedHeardSoundArchive } from "./sound-archive-fixture.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [url = "http://127.0.0.1:4173/?soundMorph=1#sound", output = "artifacts/sound-comet-writing"] = process.argv.slice(2);
const outputDir = path.resolve(output);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 3840, height: 2088 } });
  await seedHeardSoundArchive(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#sound-layer.is-open");
  const recording = await page.evaluate(async () => {
    const target = document.querySelector('[data-sound-track="snowafter"]');
    target.focus();
    const canvas = target.querySelector("canvas");
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 1600000 });
    const chunks = [], frames = [];
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.ondataavailable = event => chunks.push(event.data);
    recorder.start();
    const start = performance.now();
    for (const time of [200, 580, 1060, 1550, 2400]) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, time - (performance.now() - start))));
      frames.push({ time, data: canvas.toDataURL(), ...canvas.dataset });
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());
    return { frames, video: Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())) };
  });
  await writeFile(path.join(outputDir, "shooting-star.webm"), Buffer.from(recording.video));
  const sheet = await browser.newPage({ viewport: { width: 1200, height: 740 } });
  await sheet.setContent('<body style="margin:0;background:#061420;color:#a6cac2;font:13px monospace;padding:28px"><main></main></body>');
  await sheet.evaluate(frames => {
    for (const frame of frames) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:30px;height:126px;border-bottom:1px solid #16313c";
      const label = document.createElement("span"); label.textContent = `${(frame.time / 1000).toFixed(2)}s`;
      const image = new Image(); image.src = frame.data;
      image.style.cssText = "width:100%;min-width:0;object-fit:contain";
      row.append(label, image); document.querySelector("main").append(row);
    }
  }, recording.frames);
  await sheet.screenshot({ path: path.join(outputDir, "shooting-star-sequence.png") });
  await writeFile(path.join(outputDir, "shooting-star-frames.json"), JSON.stringify(recording.frames.map(({data, ...frame}) => frame), null, 2));
  console.log(`Recorded actual Canvas animation and five phases in ${outputDir}`);
} finally {
  await browser.close();
}
