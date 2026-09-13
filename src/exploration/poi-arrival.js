export const POI_ARRIVAL_LIFETIME_MS = 1650;
const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const p = clamp01(value); return p * p * (3 - 2 * p); };

export const createPoiArrival = (points, startedAt, reducedMotion = false) => {
  // The ordering is a stable visual sequence, not a new observation timestamp.
  const order = points.map((point, index) => ({ index,
    key: ((Math.sin(point.lon * 12.9898 + point.lat * 78.233 + index) * 43758.5453) % 1 + 1) % 1,
  })).sort((a, b) => a.key - b.key || a.index - b.index).map(item => item.index);
  const spread = Math.min(5400, Math.max(600, points.length * 22));
  const startsAt = startedAt + (reducedMotion ? 0 : 900);
  const bornAt = new Float64Array(points.length);
  order.forEach((index, rank) => { bornAt[index] = startsAt + (points.length > 1 ? rank / (points.length - 1) * spread : 0); });
  const settlesAt = reducedMotion ? startedAt : startsAt + (points.length > 1 ? spread : 0) + POI_ARRIVAL_LIFETIME_MS;
  return {
    points, order, bornAt, startsAt, settlesAt, reducedMotion,
    opacity: (index, now) => reducedMotion || now >= settlesAt ? 1 : smooth((now - bornAt[index]) / 220),
    phase: now => reducedMotion ? "reduced" : now < startsAt ? "waiting" : now >= settlesAt ? "settled" : "entering",
  };
};

const glow = (ctx, sprite, x, y, width, height = width, alpha = 1) => {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(sprite, x - width / 2, y - height / 2, width, height);
  ctx.restore();
};

const drawLightBloom = (ctx, point, p, sprite, kind) => {
  // A point opens into light, then releases a few detached glints. No stalks,
  // connected strands, outlined petals or repeated target rings.
  const unfold = 1 - (1 - p) ** 3;
  const spread = kind === "air" ? 38 : kind === "cloud" ? 32 : 42;
  const bloom = 30 + unfold * 74;
  glow(ctx, sprite, 0, 0, bloom, bloom, .5 * (1 - p * .4));
  glow(ctx, sprite, 0, 0, 20 + Math.sin(p * Math.PI) * 24, undefined, .85);
  const seed = Math.abs(Math.sin(point.lon * 2.31 + point.lat * 7.17));
  const direction = ((point.windDirection || 0) + 180) * Math.PI / 180;
  for (let i = 0; i < 5; i++) {
    const progress = clamp01((p - i * .045) / (1 - i * .045));
    const angle = seed * Math.PI * 2 + i * 2.39996;
    const distance = (7 + spread * (1 - (1 - progress) ** 2)) * (.6 + i * .085);
    const drift = kind === "wind" ? progress * 10 : 0;
    const x = Math.cos(angle) * distance + Math.sin(direction) * drift;
    const y = Math.sin(angle) * distance - Math.cos(direction) * drift;
    const shine = Math.sin(progress * Math.PI) ** 2 * (.6 + (i % 2) * .2);
    const size = 6 + (1 - progress) * 10;
    glow(ctx, sprite, x, y, size, size, shine);
  }
};

const drawQuakeArrival = (ctx, p, sprite, rgb) => {
  for (let wave = 0; wave < 2; wave++) {
    const travel = clamp01((p - wave * .16) / (1 - wave * .16));
    if (!travel) continue;
    ctx.beginPath();
    ctx.arc(0, 0, 3 + (1 - (1 - travel) ** 2) * 72, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb}, ${(1 - travel) * .72})`;
    ctx.lineWidth = 1.8 - travel;
    ctx.stroke();
  }
  glow(ctx, sprite, 0, 0, 58 * (1 - p * .4), 58 * (1 - p * .4), .9);
};

export const drawPoiArrivals = (ctx, arrival, { now, view, project, kind, rgb, sprite }) => {
  const limit = view.rect.width < 720 ? 6 : 20;
  const result = { count: 0, limit, indices: [] };
  if (!arrival || arrival.phase(now) !== "entering") return result;
  const size = view.rect.width >= 2400 ? 1.6 : view.rect.width < 720 ? .85 : 1;
  const occupied = new Set();
  for (let rank = arrival.order.length - 1; rank >= 0 && result.count < limit; rank--) {
    const index = arrival.order[rank];
    const age = now - arrival.bornAt[index];
    if (age <= 0 || age >= POI_ARRIVAL_LIFETIME_MS) continue;
    const point = arrival.points[index], at = project(point, view);
    if (at.x < 0 || at.y < 0 || at.x > view.rect.width || at.y > view.rect.height) continue;
    const cell = `${Math.floor(at.x / (132 * size))}:${Math.floor(at.y / (132 * size))}`;
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    const p = age / POI_ARRIVAL_LIFETIME_MS;
    const envelope = smooth(age / 180) * (1 - smooth((age - 600) / (POI_ARRIVAL_LIFETIME_MS - 600)));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = envelope;
    ctx.lineCap = "round";
    ctx.translate(at.x, at.y);
    ctx.scale(size, size);
    if (kind === "quake") drawQuakeArrival(ctx, p, sprite, rgb);
    else drawLightBloom(ctx, point, p, sprite, kind);
    ctx.restore();
    result.count++;
    result.indices.push(index);
  }
  return result;
};
