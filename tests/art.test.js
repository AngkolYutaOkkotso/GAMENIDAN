/* tests/art.test.js - pixel-level checks for the Art Kit.
   Runs the real js/art.js against the software rasterizer in tools/raster.js
   (no browser, no dependencies) and looks at the actual pixels:
     * every mob draws something, within a sane amount of ink
     * no two important mobs share a confusingly similar silhouette
     * feet stay on the feet line, bodies stay in their box
     * the alert / phase-2 eye really changes the drawn sprite (cache regression)
     * the Vessel reads as an asymmetric silhouette (facing is visible)
   Run:  node tests/art.test.js
*/
const fs = require("fs"), path = require("path"), vm = require("vm");
const { createCanvas } = require("../tools/raster.js");

global.window = global;
global.document = { createElement: () => createCanvas(1, 1), getElementById: () => null };
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "../js/art.js"), "utf8"));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };

const PAD = 60;                                    // margin around every probe
const ALPHA = .5;                                  // coverage threshold (ignores the soft contact shadow)

/* ---- rasterize one creature into a coverage bitmap -------------------- */
function shoot(kind, type, opts) {
  const o = Object.assign({ w: 46, h: 46 }, opts);
  const W = o.w + PAD * 2, H = o.h + PAD * 2;
  const cv = createCanvas(W, H);
  const c = cv.getContext("2d");
  c.translate(W / 2, PAD + o.h);                   // centre of the box, feet on the feet line
  const args = Object.assign({ x: -o.w / 2, y: -o.h, feet: 0, ground: false }, o);
  if (kind === "mob") Art.drawMob(c, type, args);
  else Art.drawVessel(c, Object.assign({ x: -o.w / 2, y: -o.h, hero: HERO, face: 1 }, o));
  return { W, H, buf: c.__buf(), w: o.w, h: o.h, feetRow: PAD + o.h };
}
const HERO = { id: "milo", color: "#d94f65", secondary: "#8f2940" };

function stats(s) {
  const { W, H, buf } = s;
  let n = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (buf[(y * W + x) * 4 + 3] > ALPHA) {
      n++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { n, minX, maxX, minY, maxY, W, H };
}
/* Draw every creature on ONE canvas of the same size, at true world scale:
   "do these two look alike on screen?" is the only question that matters, so
   the comparison must not normalise each creature's bounding box. */
const WORLD = 170, WORLD_FEET = 130;
function shootWorld(type, extra) {
  const cv = createCanvas(WORLD, WORLD), c = cv.getContext("2d");
  c.translate(WORLD / 2, WORLD_FEET);
  const [, w, h] = sizeOf(type);
  Art.drawMob(c, type, Object.assign({ x: -w / 2, y: -h, feet: 0, w, h, t: 14, walk: 1.1, ground: false }, extra));
  return { W: WORLD, H: WORLD, buf: c.__buf(), feetRow: WORLD_FEET };
}
function sizeOf(t) {
  const d = DESCENT.find(x => x[0] === t);
  return d ? [t, d[1], d[2]] : [t].concat(SIZE[t] || [46, 46]);
}
/* Mass-based coverage over the whole canvas: a cell counts only when at
   least a third of its pixels are covered, so a thin antenna or a single toe
   does not make two different bodies look alike. */
function shape(s, N = 34) {
  const out = new Float32Array(N * N);
  const cw = s.W / N, chh = s.H / N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    let hit = 0, total = 0;
    for (let y = Math.floor(i * chh); y < Math.floor((i + 1) * chh); y++)
      for (let x = Math.floor(j * cw); x < Math.floor((j + 1) * cw); x++) {
        total++;
        if (s.buf[(y * s.W + x) * 4 + 3] > ALPHA) hit++;
      }
    out[i * N + j] = total && hit / total >= .34 ? 1 : 0;
  }
  return out;
}
function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i] || b[i]) uni++;
  }
  return uni ? inter / uni : 1;
}
const HEX = /^[0-9a-f]{6}$/i;
const rgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
/* mean luminance of the opaque pixels - catches "invisible in a dark zone" */
function luma(s) {
  const { buf } = s;
  let sum = 0, n = 0;
  for (let i = 0; i < buf.length; i += 4) if (buf[i + 3] > .5) { sum += .299 * buf[i] + .587 * buf[i + 1] + .114 * buf[i + 2]; n++; }
  return n ? sum / n : 0;
}

/* ==================================================== 1. every mob draws */
const LEVEL_MOBS = ["slime", "beetle", "mushling", "wolf", "thorn", "forestSpirit", "bat", "rockCrawler",
  "crystalBug", "cloudSpirit", "stormBird", "skyEye", "lavaSlime", "fireBat", "magmaBeast", "iceWolf",
  "frostBat", "iceGolem", "darkMushroom", "knight", "magicGuardian"];
const DESCENT = [["crawler", 26, 20], ["flyer", 26, 20], ["spitter", 28, 26], ["warden", 46, 64]];
const SIZE = { magmaBeast: [58, 58], iceGolem: [60, 60], knight: [52, 60] };
{
  const bad = [];
  const shots = {};
  LEVEL_MOBS.forEach(t => {
    const [w, h] = SIZE[t] || [46, 46];
    shots[t] = shoot("mob", t, { w, h, t: 14, walk: 1.1 });
    const st = stats(shots[t]);
    const area = st.n / (w * h);
    if (!st.n) bad.push(t + ":empty");
    else if (area < .12) bad.push(t + ":too-thin(" + area.toFixed(2) + ")");
    else if (area > .9) bad.push(t + ":solid-block(" + area.toFixed(2) + ")");
  });
  ok(bad.length === 0, "mobs: every type draws a real silhouette (" + LEVEL_MOBS.length + " types) " + bad.join(" | "));
  globalThis.__shots = shots;
}

/* Two mobs that share an arena must never read as the same creature. Mobs
   that live in different zones may share a body plan (a slime is a slime in
   every world) but then they must be unmistakable by colour. */
const ZONES = [
  ["slime", "beetle", "mushling"],
  ["wolf", "thorn", "forestSpirit"],
  ["bat", "rockCrawler", "crystalBug"],
  ["cloudSpirit", "stormBird", "skyEye"],
  ["lavaSlime", "fireBat", "magmaBeast"],
  ["iceWolf", "frostBat", "iceGolem"],
  ["darkMushroom", "knight", "magicGuardian"],
  ["crawler", "flyer", "spitter", "warden"]                 // the Descent
];
{
  const shots = globalThis.__shots;
  const keys = LEVEL_MOBS.concat(DESCENT.map(d => d[0]));
  keys.forEach(t => {
    if (shots[t]) return;
    const d = DESCENT.find(x => x[0] === t);
    shots[t] = shoot("mob", t, { w: d[1], h: d[2], t: 14, walk: 1.1 });
  });
  const shapes = {}, pals = {};
  const world = {};
  keys.forEach(t => { world[t] = shootWorld(t); shapes[t] = shape(world[t]); pals[t] = Art.mobInfo(t).pal.map(h => rgb(h.replace("#", ""))); });
  const palDist = (a, b) => pals[a].reduce((n, c, i) => n + Math.abs(c[0] - pals[b][i][0]) + Math.abs(c[1] - pals[b][i][1]) + Math.abs(c[2] - pals[b][i][2]), 0);
  const sameZone = (a, b) => ZONES.some(z => z.indexOf(a) >= 0 && z.indexOf(b) >= 0);

  const bad = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = keys[i], b = keys[j], v = iou(shapes[a], shapes[b]);
    if (sameZone(a, b) && v > .70) bad.push(a + "~" + b + " " + v.toFixed(2) + " (same arena)");
    else if (!sameZone(a, b) && v > .85 && palDist(a, b) < 150) bad.push(a + "~" + b + " " + v.toFixed(2) + " (same shape + colour)");
  }
  ok(bad.length === 0, "mobs: no two mobs in one arena share a silhouette (and look-alikes elsewhere differ by colour) " + bad.slice(0, 5).join(" | "));

  /* the black-fill test: two mobs of the same arena must differ as flat
     black shapes, because that is all a silhouette shows in a dark room */
  const bad2 = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = keys[i], b = keys[j];
    if (sameZone(a, b) && iou(shapes[a], shapes[b]) > .76) bad2.push(a + "~" + b + " " + iou(shapes[a], shapes[b]).toFixed(2));
  }
  ok(bad2.length === 0, "mobs: no two mobs of one arena are the same flat silhouette " + bad2.join(" | "));

  /* no two mobs are literally the same bitmap: catches copy-paste art */
  const hash = {};
  let dup = [];
  keys.forEach(t => {
    const b = world[t].buf;
    let h = 5381;
    for (let i = 0; i < b.length; i += 7) h = ((h * 33) ^ Math.round(b[i] * 255)) >>> 0;
    if (hash[h] && hash[h] !== t) dup.push(hash[h] + "=" + t);
    hash[h] = t;
  });
  ok(dup.length === 0, "mobs: no two mobs are pixel-identical artwork " + dup.join(" | "));
}

/* ============================================ 2. feet line and body box */
{
  const bad = [];
  LEVEL_MOBS.forEach(t => {
    const sh = globalThis.__shots[t], st = stats(sh);
    if (st.maxY > sh.feetRow + 2) bad.push(t + ":through-floor(" + (st.maxY - sh.feetRow) + "px)");
    if (st.minY < sh.feetRow - sh.h - 16) bad.push(t + ":overshoot-top");
    const cx = st.W / 2;
    const wingSpan = Art.mobInfo(t).fam === "wing" ? 26 : 14;
    if (st.minX < cx - sh.w / 2 - wingSpan || st.maxX > cx + sh.w / 2 + wingSpan) bad.push(t + ":out-of-box");
  });
  ok(bad.length === 0, "mobs: feet stay on the feet line and bodies stay in their box " + bad.join(" | "));
}

/* ============================================ 3. contrast (dark zones) */
{
  const bad = [];
  assertMobLuma("#crawler", "crawler", 26, 20, .12);
  assertMobLuma("#flyer", "flyer", 26, 20, .12);
  assertMobLuma("boss #warden", "warden", 46, 64, .20);          // the boss must not be the darkest thing on screen
  assertMobLuma("hero-size #knight", "knight", 52, 60, .20);
  function assertMobLuma(a, t, w, h, min) {
    const L = luma(shoot("mob", t, { w, h, t: 14, walk: 1 }));
    if (L < min) bad.push(a + ":too-dark(" + L.toFixed(2) + "<" + min + ")");
  }
  LEVEL_MOBS.forEach(t => {
    const L = luma(globalThis.__shots[t]);
    if (L < .10) bad.push(t + ":too-dark(" + L.toFixed(2) + ")");
  });
  ok(bad.length === 0, "contrast: every mob (and especially the boss) is lighter than the floor it stands on " + bad.join(" | "));
}

/* ============================================ 4. alert / phase-2 eye (cache) */
{
  const px = (a, b) => {                     // pixels that differ in colour or coverage
    let n = 0;
    for (let i = 0; i < a.buf.length; i += 4) {
      if (Math.abs(a.buf[i] - b.buf[i]) > .12 || Math.abs(a.buf[i + 1] - b.buf[i + 1]) > .12 ||
        Math.abs(a.buf[i + 2] - b.buf[i + 2]) > .12 || Math.abs(a.buf[i + 3] - b.buf[i + 3]) > .12) n++;
    }
    return n;
  };
  Art._test.clearSprites();
  const calm = shoot("mob", "wolf", { t: 14 });
  const after = shoot("mob", "wolf", { t: 14, alert: true });          // same size: hits the cache
  const d1 = px(calm, after);
  ok(d1 > 4, "alert: a mob that has noticed you re-draws with hot eyes (" + d1 + " px changed; the eye state is part of the cache key)");

  Art._test.clearSprites();
  const p1 = shoot("mob", "warden", { w: 46, h: 64, t: 14 });
  const p2 = shoot("mob", "warden", { w: 46, h: 64, t: 14, phase2: true, alert: true });
  const d2 = px(p1, p2);
  ok(d2 > 20, "phase 2: the Warden's second phase changes its body, not only its eyes (" + d2 + " px)");

  /* the "noticed you" pop */
  Art._test.clearSprites();
  const noNotice = shoot("mob", "slime", { t: 14, alert: true });
  const withNotice = shoot("mob", "slime", { t: 14, alert: true, notice: 1 });
  const d3 = px(noNotice, withNotice);
  ok(d3 > 10, "alert: the notice cue draws above the mob and fades out (" + d3 + " px changed)");
}

/* ============================================ 5. the Vessel */
{
  const s = shoot("vessel", null, { w: 44, h: 64, t: 14, walk: 1.2 });
  const st = stats(s);
  const area = st.n / (44 * 64);
  ok(area > .22 && area < .9, "vessel: Milo's silhouette is neither a stick nor a block (" + area.toFixed(2) + " coverage)");
  /* facing: the lantern is held in front, so the side he faces carries more ink */
  const cx = st.W / 2;
  let right = 0, l = 0;
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    if (s.buf[(y * s.W + x) * 4 + 3] > ALPHA) (x >= cx ? right++ : l++);
  }
  const skew = Math.abs(right - l) / (right + l);
  ok(skew > .04, "vessel: the lantern + cap make the facing side heavier (" + (skew * 100).toFixed(1) + "% skew)");

  const mirror = shoot("vessel", null, { w: 44, h: 64, t: 14, walk: 1.2, face: -1 });
  let flipped = 0;
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) {
    const mx = s.W - 1 - x;
    const a = s.buf[(y * s.W + x) * 4 + 3] > ALPHA, b = mirror.buf[(y * mirror.W + mx) * 4 + 3] > ALPHA;
    if (a !== b) flipped++;
  }
  ok(flipped / st.n < .3, "vessel: facing left really mirrors the character (" + (100 * flipped / st.n).toFixed(0) + "% of px differ from a perfect mirror)");

  /* states must actually differ: idle vs walk vs air vs attack */
  Art._test.clearSprites();
  const a1 = stats(shoot("vessel", null, { t: 14 })).n;
  const a2 = stats(shoot("vessel", null, { t: 14, walk: Math.PI / 2 })).n;
  const a3 = stats(shoot("vessel", null, { t: 14, air: 1, vy: -8 })).n;
  ok(a1 && a2 && a3, "vessel: idle, walk and airborne poses all draw (" + [a1, a2, a3].join("/") + " px)");
  let walkDiff = 0;
  const i1 = shoot("vessel", null, { t: 14 }), i2 = shoot("vessel", null, { t: 14, walk: Math.PI / 2 });
  for (let i = 0; i < i1.buf.length; i += 4) if (Math.abs(i1.buf[i + 3] - i2.buf[i + 3]) > .2) walkDiff++;
  ok(walkDiff > 40, "vessel: the walk cycle visibly changes the pose (" + walkDiff + " px)");
}

/* ============================================ 6. palette discipline */
{
  const bad = [];
  const seen = new Set();
  Object.keys(Art.MOBS).forEach(t => {
    const pal = Art.mobInfo(t).pal;
    pal.forEach(c => { if (typeof c !== "string" || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) bad.push(t + ":" + c); });
    /* a mob whose accent is nearly its body colour has no readable detail */
    const [b, d, a] = pal.map(h => rgb(h.replace("#", "").length === 3 ? h : h.slice(1)));
    const dist = Math.abs(b[0] - d[0]) + Math.abs(b[1] - d[1]) + Math.abs(b[2] - d[2]);
    if (dist < 60) bad.push(t + ":body~shadow(" + dist + ")");
    const adist = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) + Math.abs(b[2] - a[2]);
    if (adist < 60 && !/glow|eye/.test(t)) bad.push(t + ":body~accent(" + adist + ")");
    seen.add(pal.join());
  });
  ok(bad.length === 0, "palette: every mob has body / shadow / accent separation " + bad.join(" | "));
  ok(seen.size >= 18, "palette: mobs are individually coloured (" + seen.size + " distinct palettes of " + Object.keys(Art.MOBS).length + ")");
}

/* ============================================ 7. props never reach a platform */
{
  const bad = [];
  Object.keys(Art.PROPS).forEach(k => {
    const cv = createCanvas(40, 40), c = cv.getContext("2d");
    c.translate(20, 34);                                   // ground line
    Art.prop(c, k, 0, 0, 3.5, 14, 0);
    const b = c.__buf();
    let minY = 1e9, maxY = -1e9, maxX = -1e9;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) if (b[(y * 40 + x) * 4 + 3] > .25) {
      if (y < minY) minY = y; if (y > maxY) maxY = y; if (x > maxX) maxX = x;
    }
    if (minY < 34 - 34) bad.push(k + ":too-tall");                 // > 1 tile above the ground
    if (maxY > 36) bad.push(k + ":sinks-below-ground");
    if (maxX > 20 + 30) bad.push(k + ":too-wide");
  });
  ok(bad.length === 0, "props: every prop stays inside one tile and on the ground line " + bad.join(" | "));
}

/* ============================================ 8. no NaN reaches the canvas */
{
  const bad = [];
  LEVEL_MOBS.concat(DESCENT.map(d => d[0])).forEach(t => {
    const d = DESCENT.find(x => x[0] === t);
    const [w, h] = d ? [d[1], d[2]] : (SIZE[t] || [46, 46]);
    for (const st of [{}, { walk: 3 }, { windup: .8 }, { flash: .6 }, { dead: 1 }, { stun: 1 }, { squash: .3 }, { notice: 1 }]) {
      const s = shoot("mob", t, Object.assign({ w, h, t: 14 }, st));
      for (let i = 0; i < s.buf.length; i++) if (!isFinite(s.buf[i])) { bad.push(t + ":NaN"); break; }
    }
  });
  ok(bad.length === 0, "robustness: every mob in every state rasterizes without NaN " + bad.join(" | "));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
