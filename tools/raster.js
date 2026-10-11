/* tools/raster.js - a tiny software Canvas2D for offline art checks.
   Enough of the real API to run js/art.js outside a browser and write PNGs,
   so character and mob art can be reviewed (and iterated on) without a
   browser. Supports: transforms, paths, quadratic/bezier curves, arcs,
   ellipse, roundRect, fill/stroke, gradients, globalAlpha, drawImage, text
   placeholders. 2x supersampling for clean edges.
   Not shipped to the browser; used only by tools/sheet.js. */
const zlib = require("zlib");

/* ---------------------------------------------------------------- colour */
function parseColor(str) {
  if (typeof str !== "string") return [0, 0, 0, 0];
  str = str.trim();
  if (str[0] === "#") {
    if (str.length === 4) return [parseInt(str[1] + str[1], 16), parseInt(str[2] + str[2], 16), parseInt(str[3] + str[3], 16), 1];
    return [parseInt(str.slice(1, 3), 16), parseInt(str.slice(3, 5), 16), parseInt(str.slice(5, 7), 16), 1];
  }
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map(v => parseFloat(v));
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
  }
  return [0, 0, 0, 0];
}

/* ---------------------------------------------------------------- canvas */
function createCanvas(w, h) {
  const cv = {
    _w: Math.max(1, w | 0), _h: Math.max(1, h | 0), _ctx: null,
    get width() { return this._w; },
    set width(v) { this._w = Math.max(1, v | 0); if (this._ctx) this._ctx.__resize(this._w, this._h); },
    get height() { return this._h; },
    set height(v) { this._h = Math.max(1, v | 0); if (this._ctx) this._ctx.__resize(this._w, this._h); },
    getContext() { return this._ctx || (this._ctx = makeCtx(this)); }
  };
  return cv;
}

function makeCtx(cv) {
  let W = cv.width, H = cv.height;
  let buf = new Float32Array(W * H * 4);                   // premultiplied-ish RGBA 0..1
  let m = [1, 0, 0, 1, 0, 0], stack = [];
  let path = [], cur = null;
  const st = {
    fillStyle: "#000", strokeStyle: "#000", globalAlpha: 1, lineWidth: 1,
    lineCap: "butt", lineJoin: "miter", font: "", textAlign: "left",
    shadowColor: "#000", shadowBlur: 0
  };

  const apply = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mul = n => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
  const scaleOf = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  const P = (x, y) => apply(x, y);

  function moveTo(x, y) { cur = [P(x, y)]; path.push(cur); }
  function lineTo(x, y) { if (!cur) return moveTo(x, y); cur.push(P(x, y)); }
  function quadTo(cx, cy, x, y) {
    if (!cur) return moveTo(x, y);
    const a = cur[cur.length - 1], b = P(cx, cy), e = P(x, y);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, u = 1 - t;
      cur.push([u * u * a[0] + 2 * u * t * b[0] + t * t * e[0], u * u * a[1] + 2 * u * t * b[1] + t * t * e[1]]);
    }
  }
  function bezTo(c1x, c1y, c2x, c2y, x, y) {
    if (!cur) return moveTo(x, y);
    const a = cur[cur.length - 1], b = P(c1x, c1y), c = P(c2x, c2y), e = P(x, y);
    for (let i = 1; i <= 10; i++) {
      const t = i / 10, u = 1 - t;
      cur.push([
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1]
      ]);
    }
  }
  const TAU = Math.PI * 2;
  function arc(x, y, r, a0, a1, ccw) {
    let span = a1 - a0;
    /* Canvas clamps the sweep to one full turn - never wraps it. */
    if (Math.abs(span) >= TAU - 1e-6) span = ccw ? -TAU : TAU;
    else if (ccw) while (span > 0) span -= TAU; else while (span < 0) span += TAU;
    const n = Math.max(8, Math.min(90, Math.ceil(Math.abs(span) * Math.max(2, r) / 1.2)));
    const c = P(x, y), sc = scaleOf();
    for (let i = 0; i <= n; i++) {
      const a = a0 + span * (i / n);
      const p = [c[0] + Math.cos(a) * r * sc, c[1] + Math.sin(a) * r * sc];
      if (i === 0 && !cur) { cur = [p]; path.push(cur); } else if (i === 0) cur.push(p); else cur.push(p);
    }
  }
  function ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
    let span = (a1 === undefined ? TAU : a1) - (a0 || 0);
    if (Math.abs(span) >= TAU - 1e-6) span = ccw ? -TAU : TAU;
    else if (ccw) while (span > 0) span -= TAU; else while (span < 0) span += TAU;
    const n = Math.max(10, Math.min(120, Math.ceil(Math.abs(span) * Math.max(rx, ry) / 1.1)));
    const c = P(x, y), sc = scaleOf(), cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    const start = a0 || 0;
    for (let i = 0; i <= n; i++) {
      const a = start + span * (i / n), ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      const p = [c[0] + (ex * cr - ey * sr) * sc, c[1] + (ex * sr + ey * cr) * sc];
      if (i === 0 && !cur) { cur = [p]; path.push(cur); } else cur.push(p);
    }
  }
  function rect(x, y, w, h) {
    moveTo(x, y); lineTo(x + w, y); lineTo(x + w, y + h); lineTo(x, y + h);
    if (cur) cur.push(cur[0].slice());
  }
  function roundRect(x, y, w, h, r) {
    r = Math.min(Math.abs(r) || 0, Math.abs(w) / 2, Math.abs(h) / 2);
    moveTo(x + r, y); lineTo(x + w - r, y); quadTo(x + w, y, x + w, y + r);
    lineTo(x + w, y + h - r); quadTo(x + w, y + h, x + w - r, y + h);
    lineTo(x + r, y + h); quadTo(x, y + h, x, y + h - r);
    lineTo(x, y + r); quadTo(x, y, x + r, y);
    if (cur) cur.push(cur[0].slice());
  }

  /* ------------------------------------------------------------ painting */
  function stylePaint(style, alpha) {
    if (style && style.__grad) return { grad: style, alpha };
    const c = parseColor(style);
    return { col: c, alpha: alpha * c[3] };
  }
  function gradAt(g, x, y) {
    const t = g.type === "linear"
      ? ((x - g.x0) * g.dx + (y - g.y0) * g.dy) / (g.len * g.len || 1)
      : Math.hypot(x - g.x1, y - g.y1) / (g.r1 || 1);
    const k = Math.max(0, Math.min(1, g.type === "linear" ? t : t));
    const stops = g.stops;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (k >= a[0] && k <= b[0]) {
        const f = (k - a[0]) / ((b[0] - a[0]) || 1);
        return [
          a[1][0] + (b[1][0] - a[1][0]) * f, a[1][1] + (b[1][1] - a[1][1]) * f,
          a[1][2] + (b[1][2] - a[1][2]) * f, a[1][3] + (b[1][3] - a[1][3]) * f
        ];
      }
    }
    const s = stops[stops.length - 1];
    return s ? s[1] : [0, 0, 0, 1];
  }
  let comp = "source-over";
  function blend(x, y, r, g, b, a) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4;
    if (comp === "destination-out") {                    // erase where the source is opaque
      const k = 1 - a;
      buf[i] *= k; buf[i + 1] *= k; buf[i + 2] *= k; buf[i + 3] *= k;
      return;
    }
    if (comp === "lighter") {                            // additive light
      buf[i] = Math.min(1, buf[i] + r / 255 * a);
      buf[i + 1] = Math.min(1, buf[i + 1] + g / 255 * a);
      buf[i + 2] = Math.min(1, buf[i + 2] + b / 255 * a);
      buf[i + 3] = Math.min(1, buf[i + 3] + a);
      return;
    }
    buf[i] += (r / 255 - buf[i]) * a;
    buf[i + 1] += (g / 255 - buf[i + 1]) * a;
    buf[i + 2] += (b / 255 - buf[i + 2]) * a;
    buf[i + 3] += (1 - buf[i + 3]) * a;
  }

  function fillPath(useFill, style, alpha) {
    const paint = stylePaint(style, alpha);
    const subs = path.filter(s => s && s.length > 2);
    if (!subs.length) return;
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (const s of subs) for (const p of s) {
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
    const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(W - 1, Math.ceil(maxX));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + .5; xs.length = 0;
      for (const s of subs) {
        for (let i = 0; i < s.length; i++) {
          const a = s[i], b = s[(i + 1) % s.length];
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) {
            xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
          }
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const ax = Math.max(x0, Math.ceil(xs[i] - .5)), bx = Math.min(x1, Math.floor(xs[i + 1] - .5));
        for (let x = ax; x <= bx; x++) {
          if (paint.grad) { const c = gradAt(paint.grad, x, y); blend(x, y, c[0], c[1], c[2], paint.alpha * c[3]); }
          else blend(x, y, paint.col[0], paint.col[1], paint.col[2], paint.alpha);
        }
      }
    }
  }
  function strokePath(style, alpha, width) {
    const paint = stylePaint(style, alpha);
    const hw = Math.max(.5, (width || 1) * scaleOf() / 2);
    for (const s of path) {
      if (!s || s.length < 2) continue;
      for (let i = 0; i + 1 < s.length; i++) {
        const a = s[i], b = s[i + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L * hw, ny = dx / L * hw;
        const quad = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
        const save = path.slice(); path.length = 0; path.push(quad);
        fillPath(true, style, alpha);
        path.length = 0; save.forEach(p => path.push(p));
      }
      if (s.length > 2) continue;
    }
  }

  const api = {
    canvas: cv,
    save() { stack.push({ m: m.slice(), st: Object.assign({}, st), comp }); },
    restore() { const s = stack.pop(); if (s) { m = s.m; Object.assign(st, s.st); comp = s.comp || "source-over"; } },
    translate(x, y) { m = mul([1, 0, 0, 1, x || 0, y || 0]); },
    scale(x, y) { m = mul([x || 0, 0, 0, y === undefined ? (x || 0) : y, 0, 0]); },
    rotate(a) { const c = Math.cos(a || 0), s = Math.sin(a || 0); m = mul([c, s, -s, c, 0, 0]); },
    transform(a, b, c, d, e, f) { m = mul([a, b, c, d, e, f]); },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
    beginPath() { path = []; cur = null; },
    closePath() { if (cur && cur.length) cur.push(cur[0].slice()); },
    moveTo, lineTo, quadraticCurveTo: quadTo, bezierCurveTo: bezTo,
    arc, ellipse, rect,
    roundRect(x, y, w, h, r) { roundRect(x, y, w, h, r); },
    fill() { fillPath(true, st.fillStyle, st.globalAlpha); },
    stroke() { strokePath(st.strokeStyle, st.globalAlpha, st.lineWidth); },
    clip() { },
    fillRect(x, y, w, h) {
      const a = P(x, y), b = P(x + w, y + h);
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
      const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      const paint = stylePaint(st.fillStyle, st.globalAlpha);
      for (let py = Math.max(0, Math.floor(y0)); py <= Math.min(H - 1, Math.ceil(y1)); py++)
        for (let px = Math.max(0, Math.floor(x0)); px <= Math.min(W - 1, Math.ceil(x1)); px++) {
          if (paint.grad) { const c = gradAt(paint.grad, px, py); blend(px, py, c[0], c[1], c[2], paint.alpha * c[3]); }
          else blend(px, py, paint.col[0], paint.col[1], paint.col[2], paint.alpha);
        }
    },
    strokeRect(x, y, w, h) { api.beginPath(); api.rect(x, y, w, h); api.stroke(); },
    clearRect(x, y, w, h) { const a = P(x, y), b = P(x + w, y + h);
      for (let py = Math.max(0, Math.floor(a[1])); py <= Math.min(H - 1, Math.ceil(b[1])); py++)
        for (let px = Math.max(0, Math.floor(a[0])); px <= Math.min(W - 1, Math.ceil(b[0])); px++) {
          const i = (py * W + px) * 4; buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
        } },
    setLineDash() { }, getLineDash() { return []; },
    createLinearGradient(x0, y0, x1, y1) {
      const a = P(x0, y0), b = P(x1, y1);
      const g = { __grad: 1, type: "linear", x0: a[0], y0: a[1], dx: b[0] - a[0], dy: b[1] - a[1], len: Math.hypot(b[0] - a[0], b[1] - a[1]), stops: [], addColorStop(t, c) { g.stops.push([t, parseColor(c)]); g.stops.sort((p, q) => p[0] - q[0]); } };
      return g;
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      const a = P(x1, y1);
      const g = { __grad: 1, type: "radial", x1: a[0], y1: a[1], r1: Math.max(1, r1 * scaleOf()), stops: [], addColorStop(t, c) { g.stops.push([t, parseColor(c)]); g.stops.sort((p, q) => p[0] - q[0]); } };
      return g;
    },
    createPattern() { return null; },
    drawImage(img, ...a) {
      const src = img && img.getContext ? { _buf: img.getContext("2d").__buf(), width: img.width, height: img.height } : null;
      if (!src || !src._buf || src.width < 1 || src.height < 1) return;
      let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw, dh;
      if (a.length <= 3) { dx = a[0]; dy = a[1]; dw = a[2] === undefined ? sw : a[2]; dh = a[3] === undefined ? sh : a[3]; }
      else { sx = a[0]; sy = a[1]; sw = a[2]; sh = a[3]; dx = a[4]; dy = a[5]; dw = a[6]; dh = a[7]; }
      const A = P(dx, dy), B = P(dx + dw, dy + dh);
      const x0 = Math.min(A[0], B[0]), x1 = Math.max(A[0], B[0]);
      const y0 = Math.min(A[1], B[1]), y1 = Math.max(A[1], B[1]);
      const ga = st.globalAlpha;
      for (let py = Math.max(0, Math.floor(y0)); py <= Math.min(H - 1, Math.ceil(y1)); py++) {
        const v = (py - y0) / ((y1 - y0) || 1);
        for (let px = Math.max(0, Math.floor(x0)); px <= Math.min(W - 1, Math.ceil(x1)); px++) {
          const u = (px - x0) / ((x1 - x0) || 1);
          const ix = Math.min(src.width - 1, Math.max(0, Math.floor(sx + u * sw)));
          const iy = Math.min(src.height - 1, Math.max(0, Math.floor(sy + v * sh)));
          const j = (iy * src.width + ix) * 4;
          blend(px, py, src._buf[j] * 255, src._buf[j + 1] * 255, src._buf[j + 2] * 255, src._buf[j + 3] * ga);
        }
      }
    },
    fillText() { }, strokeText() { }, measureText: () => ({ width: 8 }),
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    putImageData() { },
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    __buf: () => buf,
    composite(op) {
      const prev = comp; comp = op || "source-over";
      api.__restoreComp = () => { comp = prev; };
    },
    __resize(w, h) {                                  // same as setting canvas.width/height
      W = Math.max(1, w | 0); H = Math.max(1, h | 0);
      buf = new Float32Array(W * H * 4);
      m = [1, 0, 0, 1, 0, 0]; stack = []; path = []; cur = null;
    }
  };

  /* style properties live on the context object (art.js reads them back) */
  Object.defineProperties(api, {
    globalCompositeOperation: { get: () => comp, set: v => { comp = v || "source-over"; } },
    fillStyle: { get: () => st.fillStyle, set: v => st.fillStyle = v },
    strokeStyle: { get: () => st.strokeStyle, set: v => st.strokeStyle = v },
    globalAlpha: { get: () => st.globalAlpha, set: v => st.globalAlpha = Math.max(0, Math.min(1, v)) },
    lineWidth: { get: () => st.lineWidth, set: v => st.lineWidth = v },
    lineCap: { get: () => st.lineCap, set: v => st.lineCap = v },
    lineJoin: { get: () => st.lineJoin, set: v => st.lineJoin = v },
    font: { get: () => st.font, set: v => st.font = v },
    textAlign: { get: () => st.textAlign, set: v => st.textAlign = v },
    textBaseline: { get: () => "alphabetic", set: () => { } },
    shadowColor: { get: () => st.shadowColor, set: v => st.shadowColor = v },
    shadowBlur: { get: () => st.shadowBlur, set: v => st.shadowBlur = v },
    imageSmoothingEnabled: { get: () => true, set: () => { } }
  });
  api.__buf = () => buf;
  return api;
}

/* ---------------------------------------------------------------- PNG out */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, cv) {
  const W = cv.width, H = cv.height, ctx = cv.getContext("2d"), buf = ctx.__buf();
  const raw = Buffer.alloc((W * 4 + 1) * H);
  let o = 0;
  for (let y = 0; y < H; y++) {
    raw[o++] = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, a = Math.max(0, Math.min(1, buf[i + 3]));
      const un = a > .001 ? 1 / a : 0;
      raw[o++] = Math.max(0, Math.min(255, Math.round(buf[i] * 255 * Math.min(1, un))));
      raw[o++] = Math.max(0, Math.min(255, Math.round(buf[i + 1] * 255 * Math.min(1, un))));
      raw[o++] = Math.max(0, Math.min(255, Math.round(buf[i + 2] * 255 * Math.min(1, un))));
      raw[o++] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  require("fs").writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]));
  return file;
}

/* Downsample a supersampled canvas by an integer factor (anti-aliasing). */
function downsample(cv, f) {
  if (f <= 1) return cv;
  const W = Math.floor(cv.width / f), H = Math.floor(cv.height / f);
  const out = createCanvas(W, H), s = cv.getContext("2d"), d = out.getContext("2d");
  const sb = s.__buf(), db = d.__buf();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const k = ((y * f + j) * cv.width + (x * f + i)) * 4;
      r += sb[k]; g += sb[k + 1]; b += sb[k + 2]; a += sb[k + 3];
    }
    const n = f * f, o = (y * W + x) * 4;
    db[o] = r / n; db[o + 1] = g / n; db[o + 2] = b / n; db[o + 3] = a / n;
  }
  return out;
}

module.exports = { createCanvas, makeCtx, writePNG, downsample, parseColor };
