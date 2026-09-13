// Reproduce the public Ministry of the Environment download form. Raw ZIPs
// are retained unchanged; building the display dataset is a separate step.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve("data/sources/japan-marine-cod");
const endpoint = "https://water-pub.env.go.jp/water-pub/mizu-site/zip_create/";
const years = [2020, 2021, 2022, 2023, 2024];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const post = async (method, body) => {
  const response = await fetch(`${endpoint}WebService.asmx/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  return (await response.json()).d;
};
await fs.mkdir(root, { recursive: true });
const sources = [];
for (const year of years) {
  const filename = `${year}.zip`, target = path.join(root, filename);
  const query = { featureClassName: "p_kosui_y02", whereClause: `nendo=${year} and '600' <= suiikicode`, extension: "csv" };
  let bytes;
  try { bytes = await fs.readFile(target); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!bytes) {
    const token = await post("StartCreation", query);
    if (!token || ["RecordNotFound", "BadRequest"].includes(token)) throw new Error(`${year}: ${token}`);
    let status = "Running";
    for (let attempt = 0; attempt < 45 && status === "Running"; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      status = await post("GetThreadStatus", { resultFileName: token });
    }
    if (status !== "Stopped") throw new Error(`${year}: download generation ${status}`);
    const response = await fetch(`${endpoint}download.aspx?id=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${year}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 5_000_000 || bytes.readUInt32LE(0) !== 0x04034b50) throw new Error(`${year}: unexpected ZIP response`);
    await fs.writeFile(target, bytes, { flag: "wx" });
  }
  sources.push({ year, file: filename, bytes: bytes.length, sha256: sha256(bytes), query });
  console.log(`${year}: ${bytes.length} bytes; raw ZIP preserved`);
}
const manifest = {
  source: "環境省 水環境総合情報サイト 公共用水域水質測定データ（年間値・生活環境項目・海域）",
  sourceUrl: "https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/download.asp",
  manualUrl: "https://water-pub.env.go.jp/water-pub/mizu-site/mizu/download/kousui/kousui_y_manual.pdf",
  licenseUrl: "https://www.env.go.jp/mail.html",
  sourceCrs: "JGD2000 (EPSG:4612)",
  crsReference: "https://water-pub.env.go.jp/water-pub/mizu-site/mizu/script/mizu-common.js",
  retrievedOn: "2026-09-08",
  sources,
};
await fs.writeFile(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
