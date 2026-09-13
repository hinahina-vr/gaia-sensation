// Anchors and picking stay at the source coordinate. Decorative marks are
// bounded in screen pixels; they do not represent ecological/chemical extent.
export function drawRecordMarker(ctx, { x, y, radius, color, animation, time, index, selected, arrival, reduced, value, detailed }) {
  const r = radius * arrival.scale;
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  if (animation.endsWith('flow') && detailed) {
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else ctx.arc(x, y, r, 0, Math.PI * 2);
  if (value === null || value === 0) ctx.stroke(); else ctx.fill();
  if (arrival.progress < 1 || value === null || value === 0 || !detailed) return;
  ctx.save();
  const phase = reduced ? .4 : (time / 3000 + index * .618) % 1;
  ctx.globalAlpha *= selected ? .9 : .62;
  ctx.lineWidth = selected ? 1.7 : 1.2;
  if (animation.endsWith('flow')) {
    const length = selected ? 32 : 20;
    const direction = animation === 'air-flow' ? -1 : animation === 'water-flow' ? 1 : 0;
    for (let lane = -1; lane <= 1; lane++) {
      const p = (phase + (lane + 1) * .27) % 1;
      const from = radius + 3 + p * length;
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha *= Math.sin(p * Math.PI);
      ctx.beginPath();
      if (direction) {
        const dx = lane * 4 + Math.sin(p * 3 + lane) * 2;
        ctx.moveTo(x + dx, y + direction * from);
        ctx.lineTo(x + dx + 1, y + direction * (from + 5));
      } else {
        const sign = lane < 0 ? -1 : 1;
        ctx.moveTo(x + sign * from, y + lane * 4);
        ctx.lineTo(x + sign * (from + 4), y + lane * 4 - 3);
        ctx.lineTo(x + sign * (from + 4), y + lane * 4 + 3);
        ctx.closePath();
      }
      ctx.stroke(); ctx.globalAlpha = alpha;
    }
  } else {
    // A few glyphs, not a one-glyph-per-individual claim.
    const count = selected ? 3 : 1;
    for (let n = 0; n < count; n++) {
      const angle = index * 1.2 + n * Math.PI * 2 / count + (reduced ? 0 : Math.sin(time / 2200 + n) * .22);
      const reach = radius + 10 + n * 3;
      ctx.save(); ctx.translate(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
      ctx.rotate(animation === 'fish' ? angle + Math.PI / 2 : angle);
      const wiggle = reduced ? 0 : Math.sin(time / 230 + n) * 1.2;
      ctx.beginPath();
      if (animation === 'fish') {
        ctx.ellipse(0, 0, selected ? 6 : 4.5, 2.5, 0, 0, Math.PI * 2);
        ctx.moveTo(-4, 0); ctx.lineTo(-8, -3 + wiggle); ctx.lineTo(-8, 3 + wiggle); ctx.closePath();
      } else {
        ctx.ellipse(0, 0, 2.5, 4.5, 0, 0, Math.PI * 2);
        for (let leg = -1; leg <= 1; leg++) {
          ctx.moveTo(-2, leg * 2); ctx.lineTo(-5, leg * 3 + wiggle);
          ctx.moveTo(2, leg * 2); ctx.lineTo(5, leg * 3 - wiggle);
        }
      }
      ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
}
