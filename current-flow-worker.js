// Display-only interpolation. Never feed this field into POIs or the 14-day
// constant-vector displacement calculation. Build once, off the UI thread.
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => { const x = clamp01(value); return x * x * (3 - 2 * x); };
const wrap = (value, size) => ((value % size) + size) % size;

export function buildVectorGrid(rows, width = 360, height = 180, land = null) {
  const samples = rows.filter((row) => [row.lon, row.lat, row.uMs, row.vMs].every(Number.isFinite));
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const lat = (y + 0.5) / height * 180 - 90;
    const cosLat = Math.max(0.3, Math.cos(lat * Math.PI / 180));
    for (let x = 0; x < width; x += 1) {
      const lon = (x + 0.5) / width * 360 - 180;
      let u = 0, v = 0, weightSum = 0, nearest = Infinity;
      for (const row of samples) {
        const dx = (wrap(lon - row.lon + 180, 360) - 180) * cosLat;
        const dy = lat - row.lat;
        const distance2 = dx * dx + dy * dy;
        nearest = Math.min(nearest, distance2);
        // Compact support: distant isolated samples cannot colour an entire
        // ocean. Interpolate the actual u/v, not the angle or scalar speed.
        if (distance2 >= 144) continue;
        const support = 1 - distance2 / 144;
        const weight = support * support / (0.4 + distance2);
        u += row.uMs * weight;
        v += row.vMs * weight;
        weightSum += weight;
      }
      const offset = (y * width + x) * 4;
      if (land?.[y * width + x]) continue;
      data[offset] = weightSum ? u / weightSum : 0;
      data[offset + 1] = weightSum ? v / weightSum : 0;
      data[offset + 2] = 1 - smooth((Math.sqrt(nearest) - 4) / 8);
      data[offset + 3] = Math.hypot(data[offset], data[offset + 1]);
    }
  }
  return { data, width, height, sampleCount: samples.length };
}

function sampleGrid(grid, lon, lat, out) {
  const x = wrap((lon + 180) / 360 * grid.width - 0.5, grid.width);
  const y = Math.max(0, Math.min(grid.height - 1.001, (lat + 90) / 180 * grid.height - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const a = (y0 * grid.width + x0) * 4;
  const b = (y0 * grid.width + (x0 + 1) % grid.width) * 4;
  const c = a + grid.width * 4, d = b + grid.width * 4;
  for (let channel = 0; channel < 4; channel += 1) {
    out[channel] = (grid.data[a + channel] * (1 - fx) + grid.data[b + channel] * fx) * (1 - fy)
      + (grid.data[c + channel] * (1 - fx) + grid.data[d + channel] * fx) * fy;
  }
  return out;
}

// Spatially periodic noise, so the date-line has no texture seam.
function grain(lon, lat) {
  const x = wrap((lon + 180) * 1.5, 540), y = (lat + 90) * 1.5;
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const hash = (a, b) => {
    let n = Math.imul(wrap(a, 540), 374761393) + Math.imul(b, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  return (hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx) * (1 - fy)
    + (hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx) * fy;
}

export function buildCurrentWeave(grid, width = 1024, height = 512, land = null, { steps = 24, step = 0.24 } = {}) {
  const data = new Uint8Array(width * height * 4);
  const vector = new Float32Array(4);
  const midpoint = new Float32Array(4);
  const kernels = Array.from({ length: steps }, (_, i) => {
    const phase = i / steps * Math.PI;
    return { weight: 0.5 + 0.5 * Math.cos(phase), cos: Math.cos(phase * 2), sin: Math.sin(phase * 2) };
  });
  for (let y = 0; y < height; y += 1) {
    const lat = (y + 0.5) / height * 180 - 90;
    for (let x = 0; x < width; x += 1) {
      const lon = (x + 0.5) / width * 360 - 180;
      sampleGrid(grid, lon, lat, vector);
      const support = vector[2] * smooth(vector[3] / 0.055);
      const offset = (y * width + x) * 4;
      if (support < 0.005 || land?.[y * width + x]) continue;
      let mean = 0, cosine = 0, sine = 0, total = 0;
      for (const sign of [-1, 1]) {
        let px = lon, py = lat;
        for (let i = 0; i < steps; i += 1) {
          const kernel = kernels[i];
          const ink = grain(px, py) - 0.5;
          mean += ink * kernel.weight;
          cosine += ink * kernel.weight * kernel.cos;
          sine += ink * kernel.weight * kernel.sin * sign;
          total += kernel.weight;
          sampleGrid(grid, px, py, vector);
          if (vector[2] < 0.05) break;
          const speed = Math.max(0.025, Math.hypot(vector[0], vector[1]));
          sampleGrid(grid, px + vector[0] / speed * step * sign * 0.5,
            py + vector[1] / speed * step * sign * 0.5, midpoint);
          const midSpeed = Math.max(0.025, Math.hypot(midpoint[0], midpoint[1]));
          px += midpoint[0] / midSpeed * step * sign;
          py += midpoint[1] / midSpeed * step * sign;
        }
      }
      // Store the convolution's Fourier terms. Animation then needs only one
      // texture lookup, not particle updates or re-integration every frame.
      data[offset] = Math.round(clamp01(0.5 + mean / total * 3.2) * 255);
      data[offset + 1] = Math.round(clamp01(0.5 + cosine / total * 4) * 255);
      data[offset + 2] = Math.round(clamp01(0.5 + sine / total * 4) * 255);
      data[offset + 3] = Math.round(support * 255);
    }
  }
  return { data, width, height };
}

function rasterizeLand(rings, width, height) {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.beginPath();
  for (const ring of rings) {
    ring.forEach(([lon, lat], index) => {
      const x = (lon + 180) / 360 * width, y = (lat + 90) / 180 * height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
  }
  context.fill("evenodd");
  const pixels = context.getImageData(0, 0, width, height).data;
  return Uint8Array.from({ length: width * height }, (_, i) => pixels[i * 4 + 3] > 127 ? 1 : 0);
}

if (typeof self !== "undefined" && typeof self.document === "undefined"
  && self.location.pathname.endsWith("/current-flow-worker.js")) {
  self.onmessage = ({ data: { rows, generation, landRings } }) => {
    const started = performance.now();
    const field = buildVectorGrid(rows, 360, 180, rasterizeLand(landRings, 360, 180));
    const weave = buildCurrentWeave(field, 1024, 512, rasterizeLand(landRings, 1024, 512));
    self.postMessage({ generation, field, weave, buildMs: performance.now() - started },
      [field.data.buffer, weave.data.buffer]);
  };
}
