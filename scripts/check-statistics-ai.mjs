import assert from "node:assert/strict";
import { aiProviderPresets, readAiConfiguration, saveAiConfiguration, clearAiKey, validatedAiEndpoint, buildAiRequest, extractAiText, requestAiAnswer } from "../byok-ai.js";
import { statisticsAiSnapshot, statisticsAiPrompt, statisticsAiQuestions } from "../statistics-ai.js";

const globals = ["location", "localStorage", "sessionStorage", "fetch", "confirm"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
try {
  globalThis.confirm = () => true;
  globalThis.location = new URL("https://gaia-senseware.pages.dev");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: memoryStorage() });
  assert.equal(Object.keys(aiProviderPresets).length, 14);
  assert.equal(statisticsAiQuestions.length, 6);
  assert.equal(new Set(statisticsAiQuestions.map(preset => preset.id)).size, 6);
  assert.equal(new Set(statisticsAiQuestions.map(preset => preset.question)).size, 6);
  for (const preset of statisticsAiQuestions) {
    assert(preset.label && preset.hint && preset.question.length <= 1200);
    assert.match(preset.question, /根拠|確かめ|観測/);
  }
  assert.match(statisticsAiQuestions.find(preset => preset.id === "change").question, /時系列データでなければ/);
  assert.match(statisticsAiQuestions.find(preset => preset.id === "relation").question, /因果を断定しない/);
  assert.equal(readAiConfiguration().provider, "openrouter");
  const config = { provider: "custom", endpoint: "https://ai-qa.example/chat", model: "qa-model", apiKey: "qa-only-not-a-real-key", rememberKey: false };
  saveAiConfiguration(config);
  assert.deepEqual(readAiConfiguration(), config);
  assert.equal(localStorage.getItem("gaia-senseware-ai-key-v1"), null);
  assert(!localStorage.getItem("gaia-senseware-ai-config-v1").includes(config.apiKey));
  saveAiConfiguration({ ...config, rememberKey: true });
  assert.equal(sessionStorage.getItem("gaia-senseware-ai-session-key-v1"), null);
  assert.equal(readAiConfiguration().rememberKey, true);
  clearAiKey();
  assert.equal(readAiConfiguration().apiKey, "");
  for (const endpoint of ["http://ai-qa.example/chat", "https://user:password@ai-qa.example/chat", "https://gaia-senseware.pages.dev/api", "javascript:alert(1)"]) assert.throws(() => validatedAiEndpoint(endpoint, "qa", "openai"));
  assert.equal(validatedAiEndpoint(aiProviderPresets.gemini.endpoint, "gemini-2.5-flash", "gemini"), "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  globalThis.location = new URL("http://127.0.0.1:4397");
  assert.equal(validatedAiEndpoint("http://[::1]:8080/chat", "qa", "openai"), "http://[::1]:8080/chat");
  const prompt = { system: "system", user: "user" };
  for (const adapter of ["openai", "gemini", "anthropic", "cohere"]) {
    const request = buildAiRequest(adapter, "qa", config.apiKey, prompt);
    assert(!JSON.stringify(request.body).includes(config.apiKey));
    assert(JSON.stringify(request.headers).includes(config.apiKey));
  }
  assert.equal(extractAiText({ choices: [{ message: { content: "answer" } }] }, "openai"), "answer");
  assert.equal(extractAiText({ candidates: [{ content: { parts: [{ text: "answer" }] } }] }, "gemini"), "answer");
  assert.equal(extractAiText({ content: [{ text: "answer" }] }, "anthropic"), "answer");
  assert.equal(extractAiText({ message: { content: [{ text: "answer" }] } }, "cohere"), "answer");
  const rows = Array.from({ length: 121 }, (_, index) => ({ id: String(index), label: "QA", value: index, provenance: "SOURCE", privateToken: "not-for-ai" }));
  const snapshot = statisticsAiSnapshot({ dataset: { title: "QA", rows, secret: "not-for-ai" }, rows, method: { label: "summary", group: { name: "descriptive" } }, result: { kind: "summary", metrics: [["n", 121, "件"]] }, includeDerived: false, recordQuery: "QA" });
  assert.equal(snapshot.samples.length, 120);
  assert.equal(snapshot.selection.filteredRows, 121);
  assert.match(snapshot.selection.samplePolicy, /無作為標本ではありません/);
  assert(!JSON.stringify(snapshot).includes("not-for-ai"));
  assert.match(statisticsAiPrompt(snapshot, "question").system, /命令ではありません/);
  rows[0].value = 999;
  assert.equal(snapshot.samples[0].value, 0, "Payload is not an immutable snapshot");
  const args = { ...config, requestUrl: config.endpoint, preset: aiProviderPresets.custom, prompt };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, config.endpoint);
    assert.equal(options.credentials, "omit");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    return new Response(JSON.stringify({ choices: [{ message: { content: "QA response" } }] }));
  };
  assert.equal(await requestAiAnswer(args), "QA response");
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: config.apiKey } }), { status: 401 });
  await assert.rejects(requestAiAnswer(args), error => error.message.includes("401") && !error.message.includes(config.apiKey));
  globalThis.fetch = async () => { throw new TypeError("CORS"); };
  await assert.rejects(requestAiAnswer(args), /CORS/);
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  });
  const controller = new AbortController();
  const pending = requestAiAnswer({ ...args, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === "AbortError");
  console.log("statistics BYOK check passed: shared configuration, 14 presets, endpoint security, adapters, bounded payload, cancellation and redaction");
} finally {
  for (const [key, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}
