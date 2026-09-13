// Local glyphs, not bilateral trade paths or measured agricultural locations.
export function drawFoodMark(ctx, { x, y, radius, color, kind, row, value, time, selected, reduced, index, scale }) {
  const phase = reduced ? .35 : (time / 3600 + index * .618) % 1;
  const detailed = selected || scale > 7;
  const size = radius * (detailed ? 1.45 : .8);
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color;
  if (!Number.isFinite(value)) {
    ctx.globalAlpha *= .7; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.stroke();
  } else if (kind === 'harvest-exchange') {
    if (!reduced) ctx.rotate(Math.sin(time / 1800 + index * .63) * .1);
    // A sprouting stalk is distinct from the security exhibit's circular tide.
    ctx.lineWidth = detailed ? 1.5 : 1;
    ctx.beginPath(); ctx.moveTo(0, size * .55); ctx.lineTo(0, -size); ctx.stroke();
    for (let leaf = 0; leaf < (detailed ? 3 : 2); leaf++) for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(side * size * .24, -leaf * size * .4, size * .4, size * .17, side * -.55, 0, Math.PI * 2); ctx.fill();
    }
    if (detailed || index % 4 === 0) for (const [column, ink, inward, angle] of [[2, '#78def4', true, 2.5], [3, '#ffc580', false, -.6]]) {
      const amount = row?.[column];
      if (!(amount > 0)) continue;
      const count = Math.min(detailed ? 5 : 2, 1 + Math.floor(Math.log10(1 + amount)));
      ctx.fillStyle = ink;
      for (let k = 0; k < count; k++) {
        const t = (phase + k / count) % 1, r = size + 4 + (inward ? 1 - t : t) * (detailed ? 16 : 8);
        ctx.beginPath(); ctx.arc(Math.cos(angle + k * .15) * r, Math.sin(angle + k * .15) * r, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else {
    ctx.lineWidth = detailed ? 2 : 1.2;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(3, size), 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
    const inward = value > 0;
    for (let k = 0; k < (detailed ? 3 : 1); k++) {
      const t = (phase + k / 3) % 1;
      ctx.globalAlpha *= .65;
      ctx.beginPath(); ctx.arc(0, 0, size + 2 + (inward ? 1 - t : t) * (detailed ? 19 : 6), -.7 + index, 3.9 + index); ctx.stroke();
    }
    if (value < 0 && detailed) {
      ctx.globalAlpha = .9; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.stroke();
    }
  }
  if (selected) {
    ctx.globalAlpha = 1; ctx.strokeStyle = '#fff5cc'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, size + 8, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
