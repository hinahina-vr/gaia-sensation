// Shared browser-only BYOK transport from sensor analysis. Never embed a GAIA service key.
// Wire format: https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create

export const aiConfigStorageKey = "gaia-senseware-ai-config-v1";
export const aiKeyStorageKey = "gaia-senseware-ai-key-v1";
export const aiSessionKeyStorageKey = "gaia-senseware-ai-session-key-v1";
const destinationStorageKey = "gaia-senseware-ai-destination-v1";
const activeRequests = new Set();
let confirmedDestination = "";
let clearGeneration = 0;
export async function confirmAiDestination(requestUrl, apiKey) {
  const generation = clearGeneration;
  const origin = new URL(requestUrl).origin;
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey))), byte => byte.toString(16).padStart(2, "0")).join("");
  const binding = JSON.stringify({ origin, fingerprint });
  if (generation !== clearGeneration) throw new DOMException("送信を中止しました。", "AbortError");
  if (confirmedDestination === binding || storageRead("sessionStorage", destinationStorageKey) === binding) return;
  const source = "APIキーと選択した観測データを、次の送信先へ直接送ります。\n\n{origin}\n\nこの送信先を信頼し、送信を許可しますか？ キーまたは送信先が変わると再確認します。";
  const message = globalThis.GaiaI18n?.t(source, { origin }) || source.replace("{origin}", origin);
  if (!globalThis.confirm(message)) {
    throw new DOMException("送信先の確認を取り消しました。", "AbortError");
  }
  storageWrite("sessionStorage", destinationStorageKey, binding);
  confirmedDestination = binding;
}
function notifyAiCleared(ended = false) {
  clearGeneration += 1; confirmedDestination = "";
  for (const controller of activeRequests) controller.abort();
  globalThis.dispatchEvent?.(new CustomEvent("gaia-ai-cleared", { detail: { ended } }));
}
globalThis.addEventListener?.("pagehide", () => { for (const controller of activeRequests) controller.abort(); });
globalThis.addEventListener?.("storage", event => {
  if (event.key === aiKeyStorageKey && !event.newValue) notifyAiCleared();
});
export const aiProviderPresets = Object.freeze({
  openrouter: { label: "OpenRouter", adapter: "openai", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "deepseek/deepseek-v4-flash" },
  openai: { label: "OpenAI", adapter: "openai", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4.1-mini" },
  xai: { label: "xAI", adapter: "openai", endpoint: "https://api.x.ai/v1/chat/completions", model: "grok-3-mini" },
  gemini: { label: "Google Gemini", adapter: "gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
  anthropic: { label: "Anthropic", adapter: "anthropic", endpoint: "https://api.anthropic.com/v1/messages", model: "claude-sonnet-4-20250514" },
  mistral: { label: "Mistral AI", adapter: "openai", endpoint: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
  groq: { label: "Groq", adapter: "openai", endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
  deepseek: { label: "DeepSeek", adapter: "openai", endpoint: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
  together: { label: "Together AI", adapter: "openai", endpoint: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  fireworks: { label: "Fireworks AI", adapter: "openai", endpoint: "https://api.fireworks.ai/inference/v1/chat/completions", model: "accounts/fireworks/models/llama-v3p3-70b-instruct" },
  cerebras: { label: "Cerebras", adapter: "openai", endpoint: "https://api.cerebras.ai/v1/chat/completions", model: "llama-3.3-70b" },
  perplexity: { label: "Perplexity", adapter: "openai", endpoint: "https://api.perplexity.ai/chat/completions", model: "sonar" },
  cohere: { label: "Cohere", adapter: "cohere", endpoint: "https://api.cohere.com/v2/chat", model: "command-a-03-2025" },
  custom: { label: "任意エンドポイント", adapter: "openai", endpoint: "", model: "" },
});
export function validatedAiEndpoint(endpoint, model, adapter) {
  if (!endpoint) throw new Error("エンドポイントを入力してください。");
  let resolved = endpoint.replaceAll("{model}", encodeURIComponent(model));
  if (adapter === "gemini" && !/:generateContent(?:\?|$)/u.test(resolved)) {
    resolved = `${resolved.replace(/\/+$/u, "")}/models/${encodeURIComponent(model)}:generateContent`;
  }
  let url;
  try { url = new URL(resolved); } catch { throw new Error("エンドポイントURLが正しくありません。"); }
  const localEndpoint = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(url.hostname);
  const localPage = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(location.hostname);
  if (url.protocol !== "https:" && !(localPage && localEndpoint && url.protocol === "http:")) {
    throw new Error("APIキーを保護するため、HTTPSエンドポイントだけを使用できます。");
  }
  if (url.username || url.password) throw new Error("認証情報をURLへ埋め込まないでください。");
  if (url.origin === location.origin) throw new Error("APIキーをGAIAへ誤送信しないよう、GAIA自身のURLは指定できません。");
  return url.toString();
}

export function buildAiRequest(adapter, model, apiKey, prompt) {
  if (adapter === "gemini") return {
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { temperature: .2, maxOutputTokens: 1200 },
    },
  };
  if (adapter === "anthropic") return {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: { model, system: prompt.system, messages: [{ role: "user", content: prompt.user }], max_tokens: 1200, temperature: .2 },
  };
  if (adapter === "cohere") return {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: { model, messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }], temperature: .2, max_tokens: 1200 },
  };
  return {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: { model, messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }], temperature: .2, max_tokens: 1200 },
  };
}

export function extractAiText(payload, adapter) {
  if (!payload || typeof payload !== "object") return "";
  if (adapter === "gemini") return payload.candidates?.[0]?.content?.parts?.map((part) => part?.text).filter(Boolean).join("\n").trim() || "";
  if (adapter === "anthropic") return payload.content?.map((part) => part?.text).filter(Boolean).join("\n").trim() || "";
  if (adapter === "cohere") return payload.message?.content?.map((part) => part?.text).filter(Boolean).join("\n").trim() || "";
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part) => part?.text || part?.content).filter(Boolean).join("\n").trim();
  return "";
}

function extractAiError(payload) {
  const value = payload?.error?.message ?? payload?.message ?? payload?.error;
  return typeof value === "string" ? value.replace(/\s+/gu, " ").slice(0, 240) : "";
}


function storageRead(storage, key) {
  try { return globalThis[storage]?.getItem(key) || ""; } catch { return ""; }
}
function storageWrite(storage, key, value) {
  try { globalThis[storage]?.setItem(key, value); } catch { /* Storage may be disabled. */ }
}
function storageRemove(storage, key) {
  try { globalThis[storage]?.removeItem(key); } catch { /* Storage may be disabled. */ }
}
export function readAiConfiguration() {
  let saved;
  try { saved = JSON.parse(storageRead("localStorage", aiConfigStorageKey)); } catch { /* Use defaults. */ }
  const provider = saved && Object.hasOwn(aiProviderPresets, saved.provider) ? saved.provider : "openrouter";
  const persistentKey = storageRead("localStorage", aiKeyStorageKey);
  return {
    provider,
    endpoint: typeof saved?.endpoint === "string" ? saved.endpoint : aiProviderPresets[provider].endpoint,
    model: typeof saved?.model === "string" ? saved.model : aiProviderPresets[provider].model,
    apiKey: persistentKey || storageRead("sessionStorage", aiSessionKeyStorageKey),
    rememberKey: Boolean(persistentKey),
  };
}
export function saveAiConfiguration({ provider, endpoint, model, apiKey, rememberKey }) {
  storageWrite("localStorage", aiConfigStorageKey, JSON.stringify({ provider, endpoint, model }));
  storageWrite(rememberKey ? "localStorage" : "sessionStorage", rememberKey ? aiKeyStorageKey : aiSessionKeyStorageKey, apiKey);
  storageRemove(rememberKey ? "sessionStorage" : "localStorage", rememberKey ? aiSessionKeyStorageKey : aiKeyStorageKey);
}
export function clearAiKey() {
  storageRemove("localStorage", aiKeyStorageKey);
  storageRemove("sessionStorage", aiSessionKeyStorageKey);
  storageRemove("sessionStorage", destinationStorageKey);
  notifyAiCleared();
}
export function endAiSession() {
  clearAiKey();
  storageRemove("localStorage", aiConfigStorageKey);
  notifyAiCleared(true);
}
export async function requestAiAnswer({ requestUrl, preset, model, apiKey, prompt, signal }) {
  requestUrl = validatedAiEndpoint(requestUrl, model, preset.adapter);
  await confirmAiDestination(requestUrl, apiKey);
  if (signal?.aborted) throw new DOMException("送信を中止しました。", "AbortError");
  const { headers, body } = buildAiRequest(preset.adapter, model, apiKey, prompt);
  const controller = new AbortController();
  activeRequests.add(controller);
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; cancel(); }, 45_000);
  try {
    const response = await fetch(requestUrl, {
      method: "POST", mode: "cors", credentials: "omit", cache: "no-store",
      referrerPolicy: "no-referrer", redirect: "error",
      headers, body: JSON.stringify(body), signal: controller.signal,
    });
    // Bound streamed responses as well as declared lengths. Do not accumulate
    // an unbounded answer from an arbitrary participant-selected endpoint.
    const reader = response.body?.getReader();
    let raw = "", bytes = 0;
    const decoder = new TextDecoder();
    if (reader) try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 2_000_000) { await reader.cancel(); throw new Error("API応答が上限（2MB）を超えました。"); }
        raw += decoder.decode(part.value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    let payload = null;
    try { payload = JSON.parse(raw); } catch { /* Invalid JSON is handled below. */ }
    if (!response.ok) {
      const detail = extractAiError(payload).replaceAll(apiKey, "[非表示]");
      throw new Error(`APIが${response.status}を返しました${detail ? `：${detail}` : "。"}`);
    }
    const answer = extractAiText(payload, preset.adapter);
    if (!answer) throw new Error("APIの応答から回答文を読み取れませんでした。モデルまたは互換形式を確認してください。");
    return answer.replaceAll(apiKey, "[非表示]");
  } catch (error) {
    if (controller.signal.aborted) {
      if (!timedOut) throw new DOMException("送信を中止しました。", "AbortError");
      throw new Error("API応答が45秒以内に返りませんでした。");
    }
    if (error instanceof TypeError) throw new Error("APIへ接続できません。URL、CORS許可、ブラウザ拡張の遮断を確認してください。");
    throw error;
  } finally {
    activeRequests.delete(controller);
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
