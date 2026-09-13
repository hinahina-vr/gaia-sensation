(() => {
  "use strict";

  // Original single-line lettering for the twelve recordings. These are stroke
  // paths, not font outlines: closed bowls and Japanese counters stay intact.
  const glyph = (advance, ...strokes) => ({ advance, strokes });
  const glyphs = {
    " ": glyph(32),
    A: glyph(72, "M5 84 L35 12 L65 84", "M16 58 L54 58"),
    B: glyph(67, "M10 84 L10 14 L36 14 C63 14 63 47 36 47 L10 47", "M36 47 C68 47 67 84 36 84 L10 84"),
    C: glyph(72, "M64 23 C49 3 10 9 10 49 C10 90 49 96 65 75"),
    D: glyph(73, "M10 84 L10 14 L31 14 C76 14 76 84 31 84 L10 84"),
    E: glyph(62, "M55 14 L10 14 L10 84 L55 84", "M10 47 L48 47"),
    F: glyph(62, "M10 84 L10 14 L55 14", "M10 47 L47 47"),
    G: glyph(76, "M66 24 C48 3 10 9 10 49 C10 90 49 94 65 78 L65 52 L42 52"),
    H: glyph(73, "M10 14 L10 84", "M63 14 L63 84", "M10 48 L63 48"),
    I: glyph(32, "M16 14 L16 84"),
    J: glyph(56, "M46 14 L46 65 C46 91 13 93 7 72"),
    K: glyph(69, "M10 14 L10 84", "M62 14 L10 60", "M32 40 L64 84"),
    L: glyph(59, "M10 14 L10 84 L53 84"),
    M: glyph(89, "M10 84 L10 14 L44 64 L78 14 L78 84"),
    N: glyph(76, "M10 84 L10 14 L65 84 L65 14"),
    O: glyph(78, "M39 13 C0 13 0 85 39 85 C78 85 78 13 39 13 Z"),
    P: glyph(67, "M10 84 L10 14 L36 14 C70 14 70 50 36 50 L10 50"),
    Q: glyph(78, "M39 13 C0 13 0 85 39 85 C78 85 78 13 39 13 Z", "M46 66 L73 91"),
    R: glyph(69, "M10 84 L10 14 L36 14 C70 14 70 49 36 49 L10 49", "M34 49 L64 84"),
    S: glyph(66, "M57 23 C39 2 8 12 10 34 C13 55 57 44 58 66 C60 90 23 93 8 76"),
    T: glyph(68, "M4 14 L64 14", "M34 14 L34 84"),
    U: glyph(73, "M10 14 L10 61 C10 94 63 94 63 61 L63 14"),
    V: glyph(72, "M5 14 L36 84 L67 14"),
    W: glyph(102, "M6 14 L26 84 L51 23 L76 84 L96 14"),
    X: glyph(70, "M7 14 L63 84", "M63 14 L7 84"),
    Y: glyph(70, "M5 14 L35 49 L65 14", "M35 49 L35 84"),
    Z: glyph(65, "M7 14 L58 14 L7 84 L59 84"),
    a: glyph(57, "M46 48 C40 31 9 31 8 60 C7 90 40 92 46 72", "M46 37 L46 84"),
    b: glyph(59, "M10 10 L10 84", "M10 48 C19 27 51 34 51 60 C51 88 20 92 10 73"),
    c: glyph(54, "M46 43 C30 27 8 35 8 61 C8 85 30 93 46 77"),
    d: glyph(59, "M49 10 L49 84", "M49 48 C40 27 8 34 8 60 C8 88 39 92 49 73"),
    e: glyph(55, "M8 59 L47 59 C49 30 9 26 8 59 C6 88 32 93 47 77"),
    f: glyph(38, "M32 12 C16 6 14 22 14 35 L14 84", "M3 37 L32 37"),
    g: glyph(59, "M48 47 C33 27 8 35 8 59 C8 87 39 91 48 70", "M48 37 L48 81 C48 107 21 110 11 98"),
    h: glyph(59, "M10 10 L10 84", "M10 49 C21 27 48 33 48 52 L48 84"),
    i: glyph(26, "M13 38 L13 84", "M13 17 L13 18"),
    j: glyph(30, "M19 38 L19 89 C19 103 10 108 2 102", "M19 17 L19 18"),
    k: glyph(54, "M10 10 L10 84", "M47 37 L10 66", "M29 53 L49 84"),
    l: glyph(28, "M12 10 L12 77 Q12 85 21 84"),
    m: glyph(87, "M10 37 L10 84", "M10 49 C19 28 43 33 43 51 L43 84", "M43 49 C54 28 77 33 77 51 L77 84"),
    n: glyph(59, "M10 37 L10 84", "M10 49 C21 27 48 33 48 52 L48 84"),
    o: glyph(58, "M29 35 C1 35 1 86 29 86 C57 86 57 35 29 35 Z"),
    p: glyph(59, "M10 37 L10 105", "M10 48 C20 28 51 34 51 60 C51 88 20 92 10 72"),
    q: glyph(59, "M48 37 L48 105", "M48 48 C39 28 8 34 8 60 C8 88 39 92 48 72"),
    r: glyph(43, "M10 37 L10 84", "M10 53 C15 37 25 32 36 38"),
    s: glyph(49, "M41 42 C29 28 7 35 8 48 C10 63 40 54 41 71 C42 88 18 91 7 79"),
    t: glyph(39, "M16 20 L16 72 C16 85 25 88 33 81", "M4 38 L33 38"),
    u: glyph(59, "M10 37 L10 69 C10 91 38 91 48 71", "M48 37 L48 84"),
    v: glyph(54, "M5 37 L27 84 L49 37"),
    w: glyph(79, "M5 37 L21 84 L40 43 L58 84 L74 37"),
    x: glyph(51, "M6 37 L45 84", "M45 37 L6 84"),
    y: glyph(54, "M5 37 L28 83", "M49 37 L27 86 Q20 106 8 105"),
    z: glyph(49, "M6 38 L43 38 L6 84 L44 84"),
    "-": glyph(48, "M7 52 L41 52"),
    "—": glyph(91, "M5 52 L86 52"),
    ",": glyph(25, "M15 79 Q16 91 8 96"),
    ":": glyph(25, "M13 37 L13 38", "M13 77 L13 78"),
    "、": glyph(42, "M10 73 Q21 79 29 91"),
    "（": glyph(43, "M33 5 C9 28 9 74 33 98"),
    "）": glyph(43, "M10 5 C34 28 34 74 10 98"),
    "月": glyph(97, "M24 12 L77 12 L77 87 Q77 94 65 89", "M24 12 L24 58 Q24 82 12 92", "M25 38 L76 38", "M24 64 L76 64"),
    "明": glyph(100, "M9 22 L38 22 L38 74 L9 74 Z", "M9 47 L38 47", "M56 11 L88 11 L88 88 Q88 94 76 89", "M56 11 L56 57 Q56 82 43 93", "M56 37 L88 37", "M56 63 L88 63"),
    "か": glyph(100, "M39 12 Q37 55 13 87", "M12 40 Q45 32 52 38 C61 46 53 77 45 85 Q39 90 29 82", "M71 29 Q83 43 89 61"),
    "り": glyph(73, "M19 15 Q13 38 18 53 L25 39", "M54 12 C59 50 56 74 32 89"),
    "の": glyph(100, "M51 21 C49 45 32 79 21 76 C4 72 9 38 31 24 C54 9 88 25 87 52 C87 76 71 86 53 89"),
    "観": glyph(100, "M19 8 L10 25", "M17 17 L47 17", "M30 17 L26 35", "M6 35 L49 35", "M23 35 Q17 50 7 58", "M21 48 L47 48", "M20 48 L20 91", "M34 40 L34 88", "M20 61 L45 61", "M20 75 L45 75", "M20 88 L49 88", "M58 12 L87 12 L87 59 L58 59 Z", "M58 28 L87 28", "M58 43 L87 43", "M66 59 Q65 80 50 92", "M78 60 L78 84 Q78 94 93 87 L94 77"),
    "測": glyph(100, "M9 15 L19 23", "M6 39 L17 46", "M9 88 L24 64", "M33 14 L60 14 L60 68 L33 68 Z", "M33 32 L60 32", "M33 50 L60 50", "M40 76 L28 92", "M53 76 L65 88", "M74 24 L74 68", "M88 9 L88 87 Q88 94 76 89"),
    "ノ": glyph(87, "M69 14 C65 47 47 72 15 87"),
    "ー": glyph(100, "M9 51 Q46 49 91 50"),
    "ト": glyph(76, "M24 10 L24 92", "M25 39 Q45 43 65 57"),
    "雪": glyph(100, "M19 12 L81 12", "M11 39 L11 25 L89 25 L89 39", "M50 13 L50 47", "M21 34 L38 34", "M21 44 L38 44", "M62 34 L79 34", "M62 44 L79 44", "M20 57 L80 57 L80 89 L18 89", "M23 73 L80 73"),
    "火": glyph(100, "M50 9 C51 46 43 79 9 93", "M49 44 Q62 79 92 92", "M22 31 Q24 46 17 58", "M79 27 L65 53"),
    "信": glyph(100, "M29 9 Q23 31 8 49", "M21 32 L21 94", "M57 8 L65 17", "M34 25 L94 25", "M42 40 L86 40", "M42 55 L86 55", "M42 69 L86 69 L86 91 L42 91 Z"),
    "号": glyph(100, "M26 10 L74 10 L74 33 L26 33 Z", "M8 47 L92 47", "M32 47 L25 65 L79 65 Q76 96 59 91 L47 89"),
    "折": glyph(100, "M8 29 L41 29", "M26 8 L26 87 Q26 93 14 89", "M8 61 L43 45", "M87 11 L53 21 L53 54 Q53 78 40 93", "M53 42 L94 42", "M76 42 L76 94"),
    "目": glyph(92, "M22 11 L73 11 L73 91 L22 91 Z", "M22 37 L73 37", "M22 64 L73 64"),
    "向": glyph(100, "M49 7 L40 23", "M12 91 L12 24 L89 24 L89 87 Q89 93 76 89", "M33 44 L66 44 L66 72 L33 72 Z"),
    "こ": glyph(87, "M20 24 Q42 18 67 22 L55 31", "M19 59 C5 82 40 88 74 80"),
    "う": glyph(82, "M28 10 Q44 14 57 12", "M13 40 C57 20 76 41 59 67 Q47 84 29 91"),
    "風": glyph(100, "M20 12 L82 12 Q79 59 88 84 Q94 100 96 76", "M20 12 L20 54 Q20 78 8 93", "M68 26 L33 32", "M31 46 L68 46 L68 69 L31 69 Z", "M50 30 L50 83", "M26 86 L75 80", "M66 73 L78 90"),
    "軌": glyph(100, "M7 22 L43 22", "M11 35 L39 35 L39 66 L11 66 Z", "M11 50 L39 50", "M25 9 L25 94", "M5 79 L45 79", "M47 34 L77 34 L75 81 Q75 96 91 86 L93 75", "M60 12 Q63 72 44 93"),
    "道": glyph(100, "M10 16 L23 30", "M6 48 L23 48 L23 77 Q29 94 91 88", "M23 77 L7 91", "M46 8 L52 19", "M77 8 L67 22", "M32 24 L94 24", "M60 24 L54 35", "M41 36 L84 36 L84 76 L41 76 Z", "M41 49 L84 49", "M41 63 L84 63"),
    "外": glyph(100, "M32 9 Q26 34 8 50", "M27 27 L51 27 Q45 68 10 91", "M22 44 L40 58", "M65 9 L65 94", "M65 37 Q79 44 92 57"),
    "へ": glyph(100, "M9 59 L32 34 Q36 30 42 37 Q63 62 91 72"),
    "未": glyph(100, "M19 25 L81 25", "M8 48 L92 48", "M50 8 L50 94", "M47 48 Q33 73 9 89", "M53 48 Q70 76 93 87"),
    "使": glyph(100, "M29 8 Q23 31 8 50", "M21 31 L21 93", "M35 23 L94 23", "M41 38 L87 38 L87 60 L41 60 Z", "M65 10 L65 58 Q65 82 31 94", "M43 70 Q60 85 94 93"),
    "用": glyph(100, "M18 13 L84 13 L84 89 Q84 96 70 89", "M18 13 L18 65 Q18 85 9 94", "M18 39 L84 39", "M18 65 L84 65", "M50 13 L50 89"),
    "曲": glyph(100, "M12 30 L88 30 L88 90 L12 90 Z", "M12 60 L88 60", "M37 8 L37 90", "M64 8 L64 90"),
    "青": glyph(100, "M18 17 L82 17", "M24 31 L76 31", "M9 45 L91 45", "M50 6 L50 45", "M27 95 L27 57 L74 57 L74 88 Q74 94 62 89", "M27 69 L74 69", "M27 81 L74 81"),
    "硝": glyph(100, "M7 17 L40 17", "M25 17 Q21 45 6 62", "M18 48 L37 48 L37 81 L18 81 Z", "M49 15 L55 29", "M68 8 L68 35", "M89 14 L80 30", "M48 94 L48 38 L89 38 L89 87 Q89 95 77 89", "M48 56 L89 56", "M48 74 L89 74"),
    "子": glyph(100, "M21 14 L78 14 L51 37 L51 86 Q51 96 36 89", "M8 52 L92 52"),
    "潮": glyph(100, "M7 15 L17 24", "M5 39 L16 46", "M8 88 L23 64", "M29 22 L64 22", "M46 7 L46 36", "M32 36 L60 36 L60 66 L32 66 Z", "M32 51 L60 51", "M27 79 L65 79", "M46 66 L46 94", "M72 13 L92 13 L92 89 Q92 95 83 89", "M72 13 L72 62 Q72 83 63 94", "M72 38 L92 38", "M72 64 L92 64"),
    "汐": glyph(100, "M10 16 L22 24", "M6 40 L19 47", "M10 89 L28 64", "M60 9 Q53 33 36 49", "M54 28 L87 28 Q79 74 38 93", "M49 47 L69 61"),
  };

  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const sampledGlyphs = new Map();
  const sampleGlyph = (character) => {
    if (sampledGlyphs.has(character)) return sampledGlyphs.get(character);
    const definition = glyphs[character];
    if (!definition) throw new Error(`Missing constellation glyph: ${character}`);
    const strokes = definition.strokes.map((d) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      const length = path.getTotalLength();
      const count = Math.max(2, Math.ceil(length / 2));
      const points = Array.from({ length: count + 1 }, (_, i) => {
        const p = path.getPointAtLength(length * i / count);
        return { x: p.x, y: p.y };
      });
      return { points, length, closed: /Z\s*$/i.test(d) };
    });
    const result = { ...definition, strokes };
    sampledGlyphs.set(character, result);
    return result;
  };

  const makeSprite = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradient.addColorStop(0, "rgba(239,255,250,1)");
    gradient.addColorStop(0.065, "rgba(213,255,243,.94)");
    gradient.addColorStop(0.18, "rgba(141,239,218,.28)");
    gradient.addColorStop(0.5, "rgba(112,225,205,.055)");
    gradient.addColorStop(1, "rgba(112,225,205,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 48, 48);
    return canvas;
  };
  const sprite = makeSprite();
  const MORPH_DURATION = 1.25;
  const STAR_LEAD = MORPH_DURATION + .16;
  const FLIGHT_DURATION = 1.9;
  const REVEAL_DURATION = STAR_LEAD + FLIGHT_DURATION;

  // Sample the cached flight by distance, including the uninked hops between
  // pen strokes. Binary search keeps both the head and its short tail cheap.
  const flightPoint = (route, distance) => {
    let low = 0, high = route.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (route[mid].distance < distance) low = mid + 1; else high = mid;
    }
    const b = route[low], a = route[Math.max(0, low - 1)];
    const t = clamp((distance - a.distance) / Math.max(.001, b.distance - a.distance));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };

  const drawComet = (ctx, geometry, distance, visibility) => {
    const { route, width, scale } = geometry;
    const tailLength = clamp(width * .072, 24, 58);
    const head = flightPoint(route, distance);
    let previous = flightPoint(route, Math.max(0, distance - tailLength));
    // Fixed 18 segments; no particle simulation, full-canvas blur, or history buffer.
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      const point = flightPoint(route, Math.max(0, distance - tailLength * (1 - t)));
      ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y);
      ctx.globalAlpha = visibility * t * t;
      ctx.strokeStyle = "rgba(112,235,219,.12)"; ctx.lineWidth = 1.5 + t * 4; ctx.stroke();
      ctx.strokeStyle = "rgba(209,255,246,.88)"; ctx.lineWidth = .35 + t * .95; ctx.stroke();
      previous = point;
    }
    ctx.globalAlpha = visibility;
    const halo = clamp(32 + scale * 18, 38, 50);
    ctx.drawImage(sprite, head.x - halo / 2, head.y - halo / 2, halo, halo);
    // A small white-hot nucleus and tapered rays distinguish the moving star
    // from the quieter, stationary constellation nodes.
    ctx.fillStyle = "#f0fff9";
    ctx.beginPath(); ctx.arc(head.x, head.y, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(225,255,249,.75)"; ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(head.x - 4.5, head.y); ctx.lineTo(head.x + 4.5, head.y);
    ctx.moveTo(head.x, head.y - 5.5); ctx.lineTo(head.x, head.y + 5.5); ctx.stroke();
    ctx.globalAlpha = 1;
    return head;
  };

  const titleMetrics = new Map();
  const hasAuthoredGlyphs = title => Array.from(title).every(character => glyphs[character]);
  const titleFontFamily = () => getComputedStyle(document.documentElement).getPropertyValue("--font-ja").trim() || "serif";
  const measureTitle = (title) => {
    const key = `${titleFontFamily()}:${title}`;
    if (titleMetrics.has(key)) return titleMetrics.get(key);
    // Authored Japanese lettering remains unchanged. Translated characters
    // outside that finite alphabet use the selected language's actual font.
    if (!hasAuthoredGlyphs(title)) {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `400 100px ${titleFontFamily()}`;
      const measured = ctx.measureText(title);
      const metrics = { nativeText: true, width: measured.width, height: 100 };
      titleMetrics.set(key, metrics);
      return metrics;
    }
    const letters = Array.from(title).map(sampleGlyph);
    let cursor = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const letter of letters) {
      for (const stroke of letter.strokes) for (const point of stroke.points) {
        minX = Math.min(minX, cursor + point.x); maxX = Math.max(maxX, cursor + point.x);
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      }
      cursor += letter.advance + 6;
    }
    const metrics = { letters, minX, minY, width: maxX - minX, height: maxY - minY };
    titleMetrics.set(key, metrics);
    return metrics;
  };

  const build = (title, width, height) => {
    const metrics = measureTitle(title);
    if (metrics.nativeText) {
      const fontSize = Math.min(height - 24, (width - 32) / metrics.width * 100);
      const y = height / 2;
      const length = width - 32;
      const font = `400 ${fontSize}px ${titleFontFamily()}`;
      const mask = document.createElement('canvas'); mask.width = width; mask.height = height;
      const ctx = mask.getContext('2d'); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(title, width / 2, y, width - 32);
      const pixels = ctx.getImageData(0, 0, width, height).data, candidates = [];
      for (let x = 16; x < width - 16; x += 3) for (let py = 8; py < height - 8; py += 3) {
        if (pixels[(py * width + x) * 4 + 3] > 100) candidates.push({ x, y: py });
      }
      const stride = Math.max(1, Math.ceil(candidates.length / 140));
      const nodes = candidates.filter((_, i) => i % stride === 0).map((p, i) => ({ ...p, arrival: p.x - 16, phase: i * 1.73, strength: .74 }));
      return { nativeText: title, font, strokes: [], nodes,
        route: [{ x: 16, y, distance: 0 }, { x: width - 16, y, distance: length }],
        length, path: new Path2D(), width, height, scale: fontSize / 100 };
    }
    const { letters } = metrics;
    // Center the actual strokes, not a nominal em box plus legacy offsets.
    const scale = Math.min((width - 32) / metrics.width, (height - 24) / metrics.height);
    const left = (width - metrics.width * scale) / 2 - metrics.minX * scale;
    const top = (height - metrics.height * scale) / 2 - metrics.minY * scale;
    const strokes = [];
    const nodes = [];
    const route = [];
    let cursor = left;
    let distance = 0;
    const appendFlight = (point) => {
      const previous = route.at(-1);
      if (previous) distance += Math.hypot(point.x - previous.x, point.y - previous.y);
      route.push({ ...point, distance });
    };
    const hopTo = (destination) => {
      if (!route.length) appendFlight(destination);
      const origin = route.at(-1);
      const gap = Math.hypot(destination.x - origin.x, destination.y - origin.y);
      if (gap < .1) return;
      const bend = Math.min(9, gap * .23);
      const control = { x: (origin.x + destination.x) / 2, y: Math.max(5, (origin.y + destination.y) / 2 - bend) };
      const steps = Math.max(4, Math.ceil(gap / 2));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        appendFlight({ x: u*u*origin.x + 2*u*t*control.x + t*t*destination.x,
          y: u*u*origin.y + 2*u*t*control.y + t*t*destination.y });
      }
    };
    for (const [letterIndex, letter] of letters.entries()) {
      const candidates = [];
      const node = (p, priority, arrival) => {
        if (candidates.some(n => Math.hypot(n.x - p.x, n.y - p.y) < 7)) return;
        candidates.push({ ...p, priority, arrival });
      };
      for (const source of letter.strokes) {
        const points = source.points.map(p => ({ x: cursor + p.x * scale, y: top + p.y * scale }));
        // Letters retain their authored strokes and reading order. Travel
        // between disconnected strokes belongs only to the temporary comet.
        hopTo(points[0]);
        const start = distance;
        const distances = [0];
        for (const point of points.slice(1)) {
          appendFlight(point);
          distances.push(distance - start);
        }
        const length = distance - start;
        const stroke = { points, distances, length, start, end: distance };
        strokes.push(stroke);
        node(source.points[0], 3, start);
        if (!source.closed) node(source.points.at(-1), 2, distance);
        for (let i = 3; i < source.points.length - 3; i += 3) {
          const a = source.points[i - 3], b = source.points[i], c = source.points[i + 3];
          const dot = ((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)) / Math.max(.01, Math.hypot(b.x-a.x,b.y-a.y)*Math.hypot(c.x-b.x,c.y-b.y));
          if (dot < .68) node(b, 1, start + distances[i]);
        }
        if (source.closed) node(source.points[Math.floor(source.points.length / 2)], 2, start + length / 2);
      }
      candidates.sort((a,b) => b.priority - a.priority);
      for (const [i,n] of candidates.slice(0, letter.advance > 80 ? 13 : 7).entries()) {
        nodes.push({ x: cursor + n.x * scale, y: top + n.y * scale, arrival: n.arrival,
          phase: letterIndex * 2.39 + i * 1.73, strength: n.priority === 3 ? 1 : .74 });
      }
      cursor += (letter.advance + 6) * scale;
    }
    hopTo({ x: width - 4, y: Math.max(7, route.at(-1).y - 10) });
    const path = new Path2D();
    for (const stroke of strokes) {
      path.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points.slice(1)) path.lineTo(p.x, p.y);
    }
    return { strokes, nodes, route, length: distance, path, width, height, scale };
  };

  // Capture the actual, gently drifting SVG before hiding it. Do not invent a
  // second starting constellation: these are the stars the listener just saw.
  const captureConstellation = (button, geometry) => {
    const copy = button.querySelector('.sound-track-copy').getBoundingClientRect();
    const center = { x: (copy.left + copy.right) / 2, y: (copy.top + copy.bottom) / 2 };
    const local = (element, x = 0, y = 0) => {
      const p = new DOMPoint(x, y).matrixTransform(element.getScreenCTM());
      return { x: p.x - center.x + geometry.width / 2, y: p.y - center.y + geometry.height / 2 };
    };
    const stars = [...button.querySelectorAll('.sound-constellation-star')].map(el => ({
      ...local(el), strength: el.classList.contains('is-principal') ? 1 : el.classList.contains('is-distant') ? .45 : .72,
    }));
    const edges = [];
    const nearest = p => stars.reduce((best, n, i) => Math.hypot(n.x-p.x, n.y-p.y) < Math.hypot(stars[best].x-p.x, stars[best].y-p.y) ? i : best, 0);
    for (const path of button.querySelectorAll('.sound-star-trace')) {
      const points = [...path.points].map(p => nearest(local(path, p.x, p.y)));
      for (let i = 1; i < points.length; i++) edges.push([points[i-1], points[i]]);
    }
    const targets = geometry.nodes.map((n, i) => ({ ...n, index: i })).sort((a, b) => a.x - b.x || a.y - b.y);
    const orderedStars = stars.map((n, i) => ({ ...n, index: i })).sort((a, b) => a.x - b.x || a.y - b.y);
    const leaders = new Map(), assignments = new Map();
    orderedStars.forEach((star, i) => {
      const target = targets[Math.round(i * (targets.length - 1) / Math.max(1, stars.length - 1))];
      if (target) { leaders.set(star.index, target.index); assignments.set(target.index, star.index); }
    });
    const nodes = geometry.nodes.map((n, i) => {
      const leader = assignments.has(i);
      const sourceIndex = leader ? assignments.get(i) : orderedStars[Math.min(orderedStars.length - 1, Math.floor(targets.findIndex(t => t.index === i) / Math.max(1, targets.length) * stars.length))]?.index;
      return { from: stars[sourceIndex] || { x: geometry.width / 2, y: geometry.height / 2, strength: .7 },
        to: n, leader, delay: leader ? 0 : .10 + (i % 7) * .018,
        bend: Math.sin(i * 2.39) * Math.min(8, Math.abs(n.x - (stars[sourceIndex]?.x || n.x)) * .08) };
    });
    return { stars, edges, leaders, nodes };
  };
  const morphPoint = (node, age) => {
    const t = clamp((age - node.delay) / (MORPH_DURATION - node.delay));
    // Quintic easing starts and lands with zero velocity and acceleration.
    const p = t * t * t * (t * (t * 6 - 15) + 10);
    return { x: node.from.x + (node.to.x - node.from.x) * p,
      y: node.from.y + (node.to.y - node.from.y) * p + Math.sin(Math.PI * p) * node.bend,
      birth: node.leader ? 1 : smooth(t / .32), progress: p };
  };

  const mount = (layer, buttons, panel) => {
    const desktop = matchMedia("(min-width: 921px)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const cache = new Map();
    let active = null;
    let frame = 0;
    let started = 0;
    let lastDraw = -Infinity;
    let hoverTimer = 0;
    let hoverX = -Infinity;
    let hoverY = -Infinity;
    const clear = () => {
      clearTimeout(hoverTimer);
      cancelAnimationFrame(frame);
      frame = 0;
      for (const button of buttons) button.classList.remove("is-morph-focus", "is-morph-settled");
      active = null;
    };
    const dimensions = (button) => {
      const title = button.querySelector(".sound-track-name").textContent.trim();
      const metrics = measureTitle(title);
      const available = panel.clientWidth - 28;
      const inkHeight = clamp(innerWidth * .014, 18, 30);
      const width = Math.ceil(Math.min(metrics.width * inkHeight / metrics.height + 32, available - 11 * 44, available * .44));
      return {
        title,
        width: Math.max(120, width),
        height: Math.round(inkHeight + 24),
      };
    };
    const layout = (button = null) => {
      if (!desktop.matches) { panel.style.removeProperty("grid-template-columns"); return; }
      const available = panel.clientWidth - 28;
      const wide = button ? dimensions(button).width : available / buttons.length;
      const narrow = button ? (available - wide) / (buttons.length - 1) : wide;
      panel.style.gridTemplateColumns = buttons.map(b => `${b === button ? wide : narrow}px`).join(" ");
    };
    const prepare = (button) => {
      const { title, width, height } = dimensions(button);
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const key = `${titleFontFamily()}:${title}:${width}:${height}:${dpr}`;
      let geometry = cache.get(key);
      if (!geometry) {
        geometry = build(title, width, height);
        const ink = document.createElement("canvas");
        ink.width = Math.ceil(width * dpr); ink.height = Math.ceil(height * dpr);
        const ctx = ink.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(98,224,203,.13)"; ctx.lineWidth = 4.6;
        ctx.stroke(geometry.path);
        if (geometry.nativeText) {
          ctx.font = geometry.font;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(202,255,242,.96)";
          ctx.fillText(geometry.nativeText, width / 2, height / 2, width - 32);
        }
        ctx.shadowColor = "rgba(117,246,219,.4)"; ctx.shadowBlur = 3;
        ctx.strokeStyle = "rgba(202,255,242,.88)"; ctx.lineWidth = Math.max(.9, geometry.scale * 1.1);
        ctx.stroke(geometry.path);
        geometry.ink = ink;
        cache.set(key, geometry);
      }
      const canvas = button.querySelector(".sound-track-morph-canvas");
      const iconHeight = button.querySelector('.sound-track-constellation').getBoundingClientRect().height;
      const canvasHeight = Math.ceil(Math.max(height, iconHeight + 12));
      canvas.dataset.title = title;
      canvas.dataset.reveal = '0.000';
      canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(canvasHeight * dpr);
      canvas.style.width = `${width}px`; canvas.style.height = `${canvasHeight}px`;
      return { geometry, canvas, dpr, canvasHeight };
    };
    const draw = (now) => {
      frame = 0;
      if (!active || document.hidden || layer.getAttribute("aria-hidden") === "true" || !desktop.matches) return;
      const age = reduced.matches ? 5 : (now - started) / 1000;
      const finished = age >= REVEAL_DURATION;
      // Full-rate formation; only the small star sprites need 24fps afterwards.
      if (now - lastDraw >= (finished ? 40 : 15)) {
        lastDraw = now;
        const { canvas, geometry: g, dpr, button, canvasHeight, constellation } = active;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, g.width, canvasHeight);
        ctx.translate(0, (canvasHeight - g.height) / 2);
        const handoff = smooth(age / .14);
        const points = constellation.nodes.map(n => morphPoint(n, age));
        // The old links stretch with their original stars, then quietly loosen.
        const linkAlpha = (1 - smooth(age / .85)) * handoff;
        if (linkAlpha > 0) {
          ctx.globalAlpha = linkAlpha;
          ctx.strokeStyle = 'rgba(183,238,225,.65)'; ctx.lineWidth = .7;
          ctx.beginPath();
          for (const [a, b] of constellation.edges) {
            const from = points[constellation.leaders.get(a)], to = points[constellation.leaders.get(b)];
            if (from && to) { ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); }
          }
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        const progress = clamp((age - STAR_LEAD) / FLIGHT_DURATION);
        const distance = progress * g.length;
        ctx.lineCap = ctx.lineJoin = "round";
        if (finished) ctx.drawImage(g.ink, 0, 0, g.width, g.height);
        else if (progress > 0 && g.nativeText) {
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 16 + progress * (g.width - 32), g.height); ctx.clip();
          ctx.drawImage(g.ink, 0, 0, g.width, g.height); ctx.restore();
        } else if (progress > 0) {
          const trace = new Path2D();
          for (const stroke of g.strokes) {
            if (distance <= stroke.start) break;
            const visibleLength = Math.min(stroke.length, distance - stroke.start);
            let count = 0;
            trace.moveTo(stroke.points[0].x, stroke.points[0].y);
            while (count + 1 < stroke.points.length && stroke.distances[count + 1] <= visibleLength) {
              count++; trace.lineTo(stroke.points[count].x, stroke.points[count].y);
            }
            if (count + 1 < stroke.points.length) {
              const a = stroke.points[count], b = stroke.points[count + 1];
              const fraction = (visibleLength - stroke.distances[count]) / Math.max(.001, stroke.distances[count + 1] - stroke.distances[count]);
              trace.lineTo(a.x + (b.x-a.x)*fraction, a.y + (b.y-a.y)*fraction);
            }
          }
          ctx.strokeStyle = "rgba(98,224,203,.13)"; ctx.lineWidth = 4.6; ctx.stroke(trace);
          ctx.strokeStyle = "rgba(202,255,242,.88)"; ctx.lineWidth = Math.max(.9, g.scale * 1.1); ctx.stroke(trace);
        }
        let lit = 0;
        for (const [i,n] of g.nodes.entries()) {
          const point = points[i], seed = constellation.nodes[i];
          const birth = point.birth * handoff;
          if (!birth) continue;
          lit++;
          const t = now * .001;
          const twinkle = .48 + .28 * Math.sin(t*(.65+(i%7)*.067)+n.phase) + .1 * Math.sin(t*1.27+n.phase*2.1);
          const arrival = progress > 0 && !finished ? Math.exp(-Math.pow((distance-n.arrival)/Math.max(5,g.length*.008),2)) * .62 : 0;
          const size = (13 + n.strength * 6 + arrival * 10) * (.82 + twinkle*.24);
          const reached = finished ? 1 : smooth((distance - n.arrival) / Math.max(5, g.length * .012));
          const initialGlimmer = 1 - smooth((age - MORPH_DURATION) / .35);
          const nodeVisibility = Math.max(.3 + reached * .7, initialGlimmer * .9);
          if (point.progress > .015 && point.progress < .99) {
            const tail = morphPoint(seed, age - .07);
            ctx.globalAlpha = birth * .23;
            ctx.strokeStyle = 'rgba(179,255,233,.8)'; ctx.lineWidth = .7;
            ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(point.x, point.y); ctx.stroke();
          }
          ctx.globalAlpha = birth * nodeVisibility * clamp(.45 + twinkle*.5 + arrival*.35);
          ctx.drawImage(sprite,point.x-size/2,point.y-size/2,size,size);
          ctx.beginPath(); ctx.arc(point.x,point.y,.65+n.strength*.36+arrival*.35,0,Math.PI*2);
          ctx.fillStyle="rgba(230,255,248,.9)"; ctx.fill();
          if (i%4 === 0 || arrival > .7) {
            const ray = 2 + n.strength * 1.9 + arrival*2;
            ctx.strokeStyle="rgba(214,255,245,.55)"; ctx.lineWidth=.55;
            ctx.beginPath(); ctx.moveTo(point.x-ray,point.y); ctx.lineTo(point.x+ray,point.y);
            ctx.moveTo(point.x,point.y-ray); ctx.lineTo(point.x,point.y+ray); ctx.stroke();
          }
        }
        ctx.globalAlpha=1;
        const cometVisibility = !finished && progress > 0
          ? smooth(progress / .055) * (1 - smooth((progress - .96) / .04)) : 0;
        const cometHead = cometVisibility > 0 ? drawComet(ctx, g, distance, cometVisibility) : null;
        // A quiet phosphor trace; no vertical scanner or fake waveform slabs.
        const analysis = window.GaiaOpeningAudio?.getAnalysisFrame?.();
        const wave = analysis?.active ? analysis.waveform : null;
        ctx.beginPath();
        for (let x=16;x<=g.width-16;x+=3) {
          const p=(x-16)/(g.width-32);
          const sample = wave?.length ? Number(wave[Math.min(wave.length-1,Math.floor(p*wave.length))])||0 : Math.sin(p*34+now*.001)*.09;
          const y=g.height-4 + sample*2;
          if(x===16)ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.globalAlpha = smooth((age - MORPH_DURATION) / .3);
        ctx.strokeStyle="rgba(119,223,204,.22)"; ctx.lineWidth=.8; ctx.stroke(); ctx.globalAlpha = 1;
        canvas.dataset.rendered="true"; canvas.dataset.reveal=clamp(age/REVEAL_DURATION).toFixed(3);
        canvas.dataset.sequence="constellation-morph-then-stroke-trace";
        canvas.dataset.morphProgress=clamp(age/MORPH_DURATION).toFixed(3);
        canvas.dataset.sourceStars=String(constellation.stars.length);
        canvas.dataset.morphPhase=age < MORPH_DURATION ? 'constellation-to-letter-nodes' : age < STAR_LEAD ? 'letter-nodes' : finished ? 'settled' : 'tracing';
        canvas.dataset.revealStyle="shooting-star-strokes";
        canvas.dataset.cometVisible=String(Boolean(cometHead));
        canvas.dataset.cometX=cometHead ? cometHead.x.toFixed(2) : "";
        canvas.dataset.cometY=cometHead ? cometHead.y.toFixed(2) : "";
        canvas.dataset.geometry=g.nativeText ? "localized-font" : "authored-strokes";
        canvas.dataset.connectionProgress=progress.toFixed(3);
        canvas.dataset.starPhase=clamp(age/STAR_LEAD).toFixed(3);
        canvas.dataset.linePhase=progress.toFixed(3);
        canvas.dataset.litNodes=String(lit); canvas.dataset.nodes=String(g.nodes.length);
        canvas.dataset.paths=String(g.strokes.length); canvas.dataset.frame=String(Number(canvas.dataset.frame||0)+1);
        button.classList.toggle("is-morph-settled",finished);
      }
      if (!reduced.matches) frame=requestAnimationFrame(draw);
    };
    const activate = (button) => {
      clearTimeout(hoverTimer);
      if (button.disabled) { clear(); layout(); return; }
      if (!desktop.matches || active?.button===button) return;
      clear();
      active={ button, ...prepare(button) };
      active.constellation=captureConstellation(button, active.geometry);
      button.classList.add("is-morph-focus");
      layout(button);
      started=performance.now(); lastDraw=-Infinity;
      frame=requestAnimationFrame(draw);
    };
    buttons.forEach((button,i) => {
      button.addEventListener("focus",()=>activate(button));
      button.addEventListener("pointermove",event=>{
        if(event.pointerType==="touch" || (Math.abs(event.clientX-hoverX)+Math.abs(event.clientY-hoverY)<2))return;
        hoverX=event.clientX; hoverY=event.clientY;
        clearTimeout(hoverTimer);
        hoverTimer=setTimeout(()=>activate(button),75);
      });
      button.addEventListener("keydown",event=>{
        const step=event.key==="ArrowRight"?1:event.key==="ArrowLeft"?-1:0;
        if(step){
          event.preventDefault();
          const available=buttons.filter(b=>!b.disabled);
          const index=available.indexOf(button);
          if(available.length)available[(index+step+available.length)%available.length].focus({preventScroll:true});
        }
      });
    });
    panel.addEventListener("pointerleave",()=>{
      clearTimeout(hoverTimer);
      const focused=buttons.find(b=>b===document.activeElement);
      if(focused)activate(focused); else {clear();layout();}
    });
    panel.addEventListener("focusout",()=>{
      queueMicrotask(()=>{if(!panel.contains(document.activeElement)&&!panel.matches(":hover")){clear();layout();}});
    });
    const resizeObserver=new ResizeObserver(()=>{
      const button=active?.button;
      if(button){clear();activate(button);} else layout();
    });
    resizeObserver.observe(panel);
    document.addEventListener("visibilitychange",()=>{
      cancelAnimationFrame(frame);frame=0;
      if(!document.hidden&&active)frame=requestAnimationFrame(draw);
    });
    new MutationObserver(()=>{
      if(layer.getAttribute("aria-hidden")==="true" || active?.button.disabled){clear();layout();}
    }).observe(layer,{attributes:true,subtree:true,attributeFilter:["aria-hidden","disabled"]});
    window.addEventListener("gaia:language-change",()=>{
      const button=active?.button;
      clear(); cache.clear();
      if(button)activate(button); else layout();
    });
    const warm=()=>{ if(desktop.matches) for(const b of buttons.filter(b=>!b.disabled)) for(const c of b.querySelector(".sound-track-name").textContent.trim())if(glyphs[c])sampleGlyph(c); };
    if("requestIdleCallback" in window)requestIdleCallback(warm,{timeout:1500});else setTimeout(warm,400);
    layout();
    return { activate, clear };
  };
  window.GaiaSoundConstellation = { mount };
})();
