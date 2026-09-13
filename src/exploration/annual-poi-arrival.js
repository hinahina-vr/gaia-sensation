// Each source point keeps its own start time. Bound the whole sequence so a
// nationwide dataset does not take minutes to enter, or allocate per-point timers.
const HIDDEN = Object.freeze({ progress: 0, alpha: 0, scale: 0 });
const ARRIVED = Object.freeze({ progress: 1, alpha: 1, scale: 1 });
const LEAD_MS = 110;
const POP_MS = 520;
const spreadMs = count => Math.min(1800, Math.max(0, count - 1) * 40);

export const poiArrivalDuration = count => LEAD_MS + spreadMs(count) + POP_MS;

export const poiArrival = (index, count, elapsedMs, reducedMotion = false) => {
  if (elapsedMs < 0) return HIDDEN;
  if (reducedMotion || elapsedMs >= poiArrivalDuration(count)) return ARRIVED;
  const order = count <= 1 ? 0 : index / (count - 1);
  const progress = Math.max(0, Math.min(1, (elapsedMs - LEAD_MS - order * spreadMs(count)) / POP_MS));
  if (progress === 0) return HIDDEN;
  if (progress === 1) return ARRIVED;
  const eased = 1 - (1 - progress) ** 3;
  return { progress, alpha: Math.min(1, progress * 3),
    scale: eased + Math.sin(progress * Math.PI) * (1 - progress) * .45 };
};
