import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = "https://www.data.jma.go.jp/eqdb/data/shindo/api/";
const EVENT_IDS = [
  "20110311144618",
  "20160416012505",
  "20180906030759",
  "20240101161022",
  "20240417231448",
  "20240808164255",
];
const INCLUDED_INTENSITIES = new Set(["C", "D", "7"]);

const fetchEvent = async (eventId) => {
  const form = new FormData();
  form.append("mode", "event");
  form.append("id", eventId);

  const response = await fetch(API_URL, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(`JMA request failed for ${eventId}: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.res || !Array.isArray(payload.res.hyp) || !Array.isArray(payload.res.int)) {
    throw new Error(`Unexpected JMA response for ${eventId}`);
  }

  const hypocenter = payload.res.hyp[0];
  const observations = payload.res.int
    .filter((station) => INCLUDED_INTENSITIES.has(station.char))
    .map((station) => ({
      name: station.name,
      latitude: Number(station.lat),
      longitude: Number(station.lon),
      intensity: station.int.replace("震度", "").normalize("NFKC"),
      intensityCode: station.char,
    }))
    .sort((first, second) => {
      const rank = { C: 0, D: 1, 7: 2 };
      return rank[second.intensityCode] - rank[first.intensityCode];
    });

  return {
    id: hypocenter.id,
    occurredAt: hypocenter.ot.replace("/", "-").replace("/", "-").replace(" ", "T") + "+09:00",
    name: hypocenter.name,
    latitude: Number(hypocenter.lat),
    longitude: Number(hypocenter.lon),
    depthKm: Number.parseInt(hypocenter.dep, 10),
    magnitude: Number(hypocenter.mag),
    maximumIntensity: hypocenter.maxI.replace("震度", "").normalize("NFKC"),
    observations,
  };
};

const events = [];
for (const eventId of EVENT_IDS) {
  events.push(await fetchEvent(eventId));
}

const output = {
  source: "気象庁 震度データベース検索",
  sourceUrl: "https://www.data.jma.go.jp/eqdb/data/shindo/",
  retrievedAt: new Date().toISOString(),
  selection:
    "最大震度6弱以上を観測した代表6地震。各イベントの観測点は震度6弱・6強・7を全件収録。",
  caveat:
    "震度データベースは後日更新される場合があります。防災判断には最新の気象庁・自治体情報を利用してください。",
  events,
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "..", "data", "jma-intensity-history.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${events.length} events and ${events.reduce(
    (total, event) => total + event.observations.length,
    0,
  )} observations to ${outputPath}`,
);
