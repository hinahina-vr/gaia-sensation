export const MAP_DEMO_INTERVAL_MS = 25_000;

// One deadline, independent of frame rate. Injecting the clock keeps the full
// loop and lifecycle testable without mounting a map or waiting 12.5 minutes.
export function createMapDemoController({
  getItems, getCurrent, select, isAvailable = () => true, onChange = () => {},
  now = () => performance.now(),
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = (timer) => clearTimeout(timer),
}) {
  let active = false;
  let paused = false;
  let timer = null;
  let deadline = 0;
  let remaining = MAP_DEMO_INTERVAL_MS;
  let reason = "idle";
  const getState = () => ({
    active, paused, reason, intervalMs: MAP_DEMO_INTERVAL_MS,
    remainingMs: active && !paused ? Math.max(0, deadline - now()) : remaining,
  });
  const publish = () => onChange(getState());
  const clear = () => { if (timer !== null) cancel(timer); timer = null; };
  const stop = (cause = "stop") => {
    if (!active) return false;
    clear();
    active = false;
    paused = false;
    remaining = MAP_DEMO_INTERVAL_MS;
    reason = cause;
    publish();
    return true;
  };
  const arm = () => {
    clear();
    if (active && !paused) timer = schedule(tick, Math.min(1000, Math.max(0, deadline - now())));
  };
  function tick() {
    timer = null;
    if (!active || paused) return;
    if (!isAvailable()) { stop("unavailable"); return; }
    if (now() >= deadline) {
      const items = getItems();
      if (items.length < 2) { stop("unavailable"); return; }
      const index = items.indexOf(getCurrent());
      // Selection may pause synchronously while the next dataset loads. Give
      // that chapter its own full interval before any pause captures it.
      remaining = MAP_DEMO_INTERVAL_MS;
      deadline = now() + remaining;
      try {
        if (select(items[(index + 1) % items.length]) === false) { stop("unavailable"); return; }
      } catch {
        stop("error");
        return;
      }
      // A selection can synchronously close the map or stop the demo.
      if (!active || paused) return;
      // Never replay overdue transitions in a burst after a suspended tab.
      deadline = now() + MAP_DEMO_INTERVAL_MS;
      reason = "advance";
    }
    publish();
    arm();
  }
  const start = () => {
    if (active || !isAvailable() || getItems().length < 2) return false;
    active = true;
    paused = false;
    remaining = MAP_DEMO_INTERVAL_MS;
    deadline = now() + remaining;
    reason = "start";
    publish();
    arm();
    return true;
  };
  const setPaused = (value) => {
    if (!active || paused === Boolean(value)) return;
    if (!isAvailable()) { stop("unavailable"); return; }
    if (value) remaining = Math.max(0, deadline - now());
    paused = Boolean(value);
    if (!paused) deadline = now() + remaining;
    reason = paused ? "hidden" : "resume";
    publish();
    arm();
  };
  return Object.freeze({ start, stop, setPaused, getState });
}
