// Browser-owned resource, not Worker request state. Each immutable mode is
// fetched/decoded once, shared by on-demand MAP and complete analysis loads.
export function validateSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.modes) || !snapshot.modes.length) throw new Error("Invalid GAIA snapshot: modes missing");
  const ids = new Set();
  for (const mode of snapshot.modes) {
    if (!mode || typeof mode.id !== "string" || !/^[a-z0-9-]+$/.test(mode.id) || ids.has(mode.id)
      || !mode.signals || typeof mode.signals !== "object" || Array.isArray(mode.signals) || !Array.isArray(mode.datasets)) {
      throw new Error("Invalid GAIA snapshot: duplicate or malformed mode");
    }
    ids.add(mode.id);
  }
  return snapshot;
}

export function createSnapshotStore({ manifestUrl, fetchImpl = globalThis.fetch.bind(globalThis), timeoutMs = 20000, concurrency = 3 }) {
  let pending = null, manifestPending = null, disposed = false;
  const chunks = new Map(), singleModes = new Map(), controllers = new Set();
  const assertActive = () => { if (disposed) throw new DOMException("Snapshot store disposed", "AbortError"); };
  const requestJson = async url => {
    assertActive();
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { cache: "default", signal: controller.signal });
      if (!response.ok) throw new Error(`GAIA snapshot ${response.status}`);
      const value = await response.json();
      if (controller.signal.aborted) throw new DOMException("Snapshot load aborted", "AbortError");
      return value;
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  };
  const getManifest = () => {
    if (!manifestPending) manifestPending = requestJson(manifestUrl).then(value => {
      if (value?.schemaVersion !== 1 || !Array.isArray(value.chunks) || !value.chunks.length
        || value.chunks.length > 64 || !value.metadata || typeof value.metadata !== "object") throw new Error("Invalid GAIA runtime manifest");
      const ids = new Set();
      for (const chunk of value.chunks) {
        // A manifest cannot turn this loader into a cross-origin fetcher.
        if (!/^[a-z0-9-]+\.[a-f0-9]{16}\.json$/.test(chunk?.file || "")) throw new Error("Invalid GAIA chunk path");
        if (!/^[a-z0-9-]+$/.test(chunk.id || "") || ids.has(chunk.id)) throw new Error("Invalid GAIA chunk identity");
        ids.add(chunk.id);
      }
      return value;
    }).catch(error => { manifestPending = null; throw error; });
    return manifestPending;
  };
  const loadChunk = chunk => {
    if (!chunks.has(chunk.id)) chunks.set(chunk.id, requestJson(new URL(chunk.file, manifestUrl).href).then(mode => {
      if (mode.id !== chunk.id) throw new Error("GAIA chunk identity mismatch");
      validateSnapshot({ modes: [mode] });
      return mode;
    }).catch(error => { chunks.delete(chunk.id); throw error; }));
    return chunks.get(chunk.id);
  };
  const loadMode = id => {
    if (disposed) return Promise.reject(new DOMException("Snapshot store disposed", "AbortError"));
    if (!singleModes.has(id)) singleModes.set(id, (async () => {
      const source = await getManifest();
      const chunk = source.chunks.find(item => item.id === id);
      if (!chunk) throw new Error(`Unknown GAIA mode: ${id}`);
      return validateSnapshot({ ...source.metadata, modes: [await loadChunk(chunk)] });
    })().catch(error => { singleModes.delete(id); throw error; }));
    return singleModes.get(id);
  };
  const load = () => {
    if (disposed) return Promise.reject(new DOMException("Snapshot store disposed", "AbortError"));
    if (pending) return pending;
    pending = (async () => {
        const manifest = await getManifest();
        const modes = new Array(manifest.chunks.length);
        let cursor = 0;
        const next = async () => {
          while (cursor < manifest.chunks.length) {
            const index = cursor++, chunk = manifest.chunks[index];
            modes[index] = await loadChunk(chunk);
          }
        };
        await Promise.all(Array.from({ length: Math.max(1, Math.min(6, concurrency, modes.length)) }, next));
        assertActive();
        return validateSnapshot({ ...manifest.metadata, modes });
    })().catch(error => { pending = null; throw error; });
    return pending;
  };
  return Object.freeze({
    load, loadMode,
    // Only the owning application disposes the shared resource. One panel
    // closing must not cancel another consumer's in-flight snapshot.
    dispose() { disposed = true; controllers.forEach(controller => controller.abort()); pending = null; manifestPending = null; chunks.clear(); singleModes.clear(); },
  });
}
