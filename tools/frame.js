/* tools/frame.js - render real game frames to PNG (no browser).
   Builds a DOM whose canvases are the software rasterizer, loads the actual
   game scripts, plays the level for a while and writes the frame the player
   would see into preview/frame-*.png. This is the visual smoke test the
   pixel tests cannot replace: platforms, props, mobs, Milo, particles and the
   HUD composited exactly as the game does.
   Run:  node tools/frame.js  [frames-to-fast-forward] */
const fs = require("fs"), vm = require("vm"), path = require("path");
const { createCanvas, writePNG, downsample } = require("./raster.js");

const SS = 1;                                   // game canvases are already 1:1
const store = {};

/* ---------------- minimal DOM, canvases are raster canvases ---------------- */
function el(tag) {
  const node = {
    tagName: (tag || "div").toUpperCase(), style: {}, dataset: {}, children: [], textContent: "",
    nodeName: (tag || "div").toUpperCase(), innerHTML: "", value: "", disabled: false,
    offsetWidth: 1280, isConnected: true, hidden: false, width: 300, height: 150,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); }
    },
    appendChild(ch) { this.children.push(ch); return ch; },
    removeChild(ch) { this.children = this.children.filter(c => c !== ch); return ch; },
    remove() { this.isConnected = false; },
    insertBefore(ch) { this.children.push(ch); return ch; },
    setAttribute() { }, getAttribute() { return null; }, removeAttribute() { },
    addEventListener() { }, removeEventListener() { }, focus() { }, click() { },
    insertAdjacentHTML(pos, html) { this.innerHTML += html; for (const id of String(html).matchAll(/id="([^"]+)"/g)) ensure(id[1]); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 1280, height: 720, top: 0, left: 0 }; },
    closest() { return null; }
  };
  if (tag === "canvas") {
    const cv = createCanvas(1280, 720);
    node.getContext = () => cv.getContext("2d");
    Object.defineProperty(node, "width", { get: () => cv.width, set: v => { cv.width = v; } });
    Object.defineProperty(node, "height", { get: () => cv.height, set: v => { cv.height = v; } });
    node.__canvas = cv;
  }
  return node;
}
const nodes = {};
function ensure(id) { return (nodes[id] = nodes[id] || el(id === "metroCanvas" ? "canvas" : "div")); }
global.ensureNode = ensure;
global.document = {
  readyState: "loading", hidden: false,
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), addEventListener() { } },
  documentElement: el(), body: el("body"),
  createElement: el,
  createTextNode: t => ({ textContent: t }),
  getElementById: id => (nodes[id] = nodes[id] || (["gameCanvas"].includes(id) ? el("canvas") : el())),
  querySelector: sel => (nodes[sel] = nodes[sel] || (sel.includes("canvas") ? el("canvas") : el())),
  querySelectorAll: () => [],
  addEventListener() { }, removeEventListener() { }
};
global.window = global;
global.innerWidth = 1280; global.innerHeight = 720; global.devicePixelRatio = 1;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => { };
global.performance = global.performance || { now: () => Date.now() };
global.alert = () => { }; global.confirm = () => false;
global.addEventListener = () => { };
global.matchMedia = () => ({ matches: false, addEventListener() { }, addListener() { } });
global.showHome = () => { }; global.hideScreens = () => { }; global.stopGame = () => { }; global.notify = () => { };

const load = f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), { filename: f });
load("js/art.js"); load("js/scenery.js"); load("js/metroFx.js"); load("js/game.js");

/* ---------------- paint a level ------------------------------------------- */
function renderLevel(world, level, frames, action, file) {
  startLevel(world, level);
  const keys0 = {};
  for (let f = 0; f < frames; f++) {
    Object.keys(keys).forEach(k => { keys[k] = false; });
    const k = action(f);
    Object.keys(k || {}).forEach(key => { if (k[key]) keys[key] = true; });
    if (k && k.space) handleSpace();
    if (k && k.attack) attack();
    updateGame();
  }
  drawGame();
  if (process.env.MODE === "hero") {
    /* a clean stage: one creature, flat ground, nothing else */
    enemies.length = 0; props.length = 0; coinsItems.length = 0; hazards.length = 0;
    checkpoints.forEach(c => { c.activated = true; });
    player.x = 700; player.y = 400; player.vx = 0; player.vy = 0;
    for (let f = 0; f < 40; f++) { Object.keys(keys).forEach(k => { keys[k] = false; }); keys["d"] = process.env.WALKBACK ? false : (process.env.WALKWALK ? true : f > 20); updateGame(); }
    cameraX = player.x - 600;
    drawGame();
    const cv = nodes["gameCanvas"].__canvas;
    writePNG(path.join(__dirname, "../preview", "stage-" + (process.env.TAG || "hero") + ".png"), cv);
    console.log("wrote stage-" + (process.env.TAG || "hero") + ".png  player@x" + Math.round(player.x - cameraX) + " y" + Math.round(player.y) + " " + player.width + "x" + player.height);
    if (process.env.STAGE_ONLY) throw { stageDone: true };
    return;
  }
  if (process.env.DIFF) {
    /* same process, same state: hide one layer and compare the pixels */
    const cv0 = nodes["gameCanvas"].__canvas, b0 = cv0.getContext("2d").__buf().slice();
    const layer = process.env.DIFF;
    if (layer === "enemies") enemies.forEach(e => { e.alive = false; e.deathT = 0; });
    else if (layer.startsWith("enemies:")) { const t = layer.slice(8); enemies.forEach(e => { if (e.type === t) { e.alive = false; e.deathT = 0; } }); }
    else if (layer === "props") props.length = 0;
    else if (layer === "coins") coinsItems.length = 0;
    else if (layer === "checkpoints") checkpoints.forEach(c => { c.activated = true; });
    else if (layer === "hazards") hazards.length = 0;
    else if (layer === "player") player.x = -9999;
    drawGame();
    const b1 = cv0.getContext("2d").__buf();
    let n = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let y = 0; y < cv0.height; y++) for (let x = 0; x < cv0.width; x++) {
      const i = (y * cv0.width + x) * 4;
      if (Math.abs(b0[i] - b1[i]) > .05 || Math.abs(b0[i + 1] - b1[i + 1]) > .05 || Math.abs(b0[i + 2] - b1[i + 2]) > .05 || Math.abs(b0[i + 3] - b1[i + 3]) > .05) {
        n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    console.log(layer.padEnd(12), "px", String(n).padStart(7), n ? "bbox " + minX + "," + minY + " -> " + maxX + "," + maxY : "(nothing drawn)");
    return;
  }
  if (process.env.SKIP) {
    if (process.env.SKIP === "enemies") enemies.forEach(e => { e.alive = false; e.deathT = 0; });
    if (process.env.SKIP === "checkpoints") checkpoints.forEach(c => { c.activated = true; });
    if (process.env.SKIP === "props") props.length = 0;
    if (process.env.SKIP === "coins") coinsItems.length = 0;
    if (process.env.SKIP === "hazards") hazards.length = 0;
    drawGame();
    writePNG(path.join(__dirname, "../preview", "skip-" + process.env.SKIP + ".png"), nodes["gameCanvas"].__canvas);
    console.log("wrote preview/skip-" + process.env.SKIP + ".png");
    return;
  }
  if (process.env.DUMP) {
    const cam = cameraX || 0;
    console.log("world/level", world, level, "camera.x", cam);
    console.log("player:", "x" + Math.round(player.x - cam) + " y" + Math.round(player.y) + " " + player.width + "x" + player.height + " onGround=" + player.onGround);
    console.log("enemies:", enemies.slice(0, 8).map(e => e.type + "@" + Math.round(e.x - cam) + "(" + e.width + "x" + e.height + ")").join(" "));
    console.log("props:", (typeof props !== "undefined" ? props.slice(0, 6) : []).map(pr => pr.kind + "@" + Math.round(pr.x - cam)).join(" "));
  }
  const cv = nodes["gameCanvas"].__canvas;
  writePNG(path.join(__dirname, "../preview", file), cv);
  return cv;
}

/* run right, then hold still: a mob walks into attack range and the
   "!" notice cue plus the wind-up tell are on screen when the shot is taken */
const scenes = [
  [0, 1, 300, f => ({ d: true, attack: f > 250 && f % 20 === 0 }), "frame-levels-world1.png"],
  [6, 3, 470, f => ({ d: true, attack: f > 430 && f % 18 === 0 }), "frame-levels-boss.png"]
];
try {
  scenes.forEach(([w, l, n, act, file]) => {
    if (process.env.MODE === "hero" && process.env.STAGE_ONLY) { renderLevel(0, 1, 0, () => ({}), "unused.png"); return; }
    renderLevel(w, l, n, act, file);
    console.log("wrote preview/" + file);
  });
} catch (e) { if (!e || !e.stageDone) throw e; }

/* ---------------- the Descent --------------------------------------------- */
function renderDescent(file) {
  const canvas = el("canvas");
  global.document.getElementById = id => (id === "metroCanvas" ? canvas : ensure(id));
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", "metroid.js"), "utf8"), { filename: "js/metroid.js" });
  /* top-level `const Metro` lives in the global lexical scope, not on window */
  const M = vm.runInThisContext("typeof Metro !== 'undefined' ? Metro : null");
  if (!M || !M._test || !M._test.render) { console.log("note: Metro test hooks missing; skipped " + file); return; }
  const T = M._test;
  global.innerWidth = 1280; global.innerHeight = 720; global.devicePixelRatio = 1;
  T.init({ dash: 1, wall: 1, dbl: 1, lantern: 1, sink: 1, hook: 1 });
  T.resize();                                        // the real game sizes the view on start
  T.load("r0", 100, 22 * 32 - 31);
  T.buildCaches();
  T.spawn("crawler", 420, 22 * 32); T.spawn("flyer", 620, 12 * 32);
  for (let f = 0; f < 120; f++) T.step({ right: f < 70, atkP: f % 14 === 0, jumpP: f === 40 || f === 44 });
  for (let f = 0; f < 40; f++) T.step({});
  if (process.env.DUMP) {
    const S = T.S, P = T.P;
    console.log("descent player", Math.round(P.x), Math.round(P.y), "onGround", T.grounded(), "cam", S.camX, S.camY, "room", T.R.id, "grid", T.COLS + "x" + T.ROWS, "TS", T.TS);
    for (const row of [0, 1, 2, 3, 21, 22, 23]) console.log(String(row).padStart(2), JSON.stringify(T.R.g[row].join("").slice(0, 64)));
    console.log("enemies", S.enemies.map(e => e.t + "@" + Math.round(e.x) + "," + Math.round(e.y)).join(" "));
  }
  T.render(canvas.getContext("2d"), 1280, 720);
  writePNG(path.join(__dirname, "../preview", file), canvas.__canvas);
  if (process.env.DUMP) {
    console.log("cam", Math.round(T.cam.x), Math.round(T.cam.y), "scale", T.scale, "vp", global.innerWidth + "x" + global.innerHeight);
    if (T.roomCanvas) writePNG(path.join(__dirname, "../preview", "dbg-roomcache.png"), T.roomCanvas);
  }
  console.log("wrote preview/" + file);
}
try { renderDescent("frame-descent.png"); } catch (e) { console.log("descent frame skipped: " + e.message); }
