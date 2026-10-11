/* Run:  node tests/levels.test.js
   Headless smoke test for the Levels mode *and* the Art Kit.
   There is no browser here, so this file builds a tiny fake DOM whose canvas
   context records every call and flags NaN coordinates, then plays a real
   level: movement, jumping, attacking, killing mobs, damage, coins,
   checkpoints, a boss and the draw path. Anything that would throw in a
   browser - a missing function, a bad property, a NaN - fails the run. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const { makeFakeCtx } = require("../tools/fakectx.js");

let pass = 0, fail = 0;
const ok = (c, name) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + name); };

/* ---------------------------------------------------------------- fake DOM */
const store = {};
function el(tag) {
  const node = {
    tagName: (tag || "div").toUpperCase(), style: {}, dataset: {}, children: [], textContent: "",
    nodeName: (tag || "div").toUpperCase(), innerHTML: "", value: "", disabled: false,
    offsetWidth: 10, isConnected: true, hidden: false,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); }
    },
    appendChild(ch) { this.children.push(ch); return ch; },
    removeChild(ch) { this.children = this.children.filter(c => c !== ch); return ch; },
    remove() { this.isConnected = false; },
    insertBefore(ch) { this.children.push(ch); return ch; },
    setAttribute() { }, getAttribute() { return null; }, removeAttribute() { },
    addEventListener() { }, removeEventListener() { }, focus() { }, click() { },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 1280, height: 720, top: 0, left: 0 }; },
    closest() { return null; }
  };
  if (tag === "canvas") {
    node.width = 300; node.height = 150;
    node.getContext = () => { node._ctx = node._ctx || makeFakeCtx(); return node._ctx; };
  }
  return node;
}
const nodes = {};
const doc = {
  readyState: "loading",           // game.js only registers DOMContentLoaded, so we drive it
  hidden: false,
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), addEventListener() { } },
  documentElement: el(), body: el("body"),
  createElement: el,
  createTextNode: t => ({ textContent: t }),
  getElementById: id => (nodes[id] = nodes[id] || (["gameCanvas"].includes(id) ? el("canvas") : el())),
  querySelector: sel => (nodes[sel] = nodes[sel] || (sel.includes("canvas") ? el("canvas") : el())),
  querySelectorAll: () => [],
  addEventListener() { }, removeEventListener() { },
  fonts: { load: () => Promise.resolve(), ready: Promise.resolve() }
};
global.document = doc;
global.window = global;
global.innerWidth = 1280; global.innerHeight = 720;
global.devicePixelRatio = 1;
global.localStorage = {
  _d: store,
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => { };
global.performance = global.performance || { now: () => Date.now() };
global.setTimeout = global.setTimeout;
global.alert = () => { };
global.confirm = () => false;
global.addEventListener = () => { };
global.matchMedia = () => ({ matches: false, addEventListener() { }, addListener() { } });

/* ---------------------------------------------------------------- load modules */
const load = f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), { filename: f });
load("js/art.js");
load("js/metroFx.js");
load("js/game.js");

/* game.js boots on DOMContentLoaded; these are the globals it expects from
   the other screens (index.html loads ui.js / threshold.js). */
global.showHome = () => { }; global.hideScreens = () => { }; global.stopGame = global.stopGame || (() => { });
global.notify = () => { };

/* ---------------------------------------------------------------- helpers */
/* game.js closed over this context at load, so it is the recording one. */
const gameCtx = () => nodes["gameCanvas"]._ctx;
const nanSeen = () => (gameCtx() ? gameCtx().calls.nan : []);
const nanTotal = () => nanSeen().length;
const randomKeys = () => ({
  a: Math.random() < .3, d: Math.random() < .3, w: Math.random() < .05,
  " ": Math.random() < .08, arrowup: Math.random() < .03
});

/* ---------------------------------------------------------------- 1. start a level */
let err = null;
try {
  startLevel(6, 3);                 // Hollow Castle, boss level: darkest zone
} catch (e) { err = e; }
ok(!err, "level: startLevel(6,3) runs without throwing " + (err ? err.stack.split("\n")[0] : ""));

/* ---------------------------------------------------------------- 2. play 900 frames */
err = null;
let killed = 0, hurt = 0;
const hp0 = health;
try {
  for (let f = 0; f < 900; f++) {
    const k = randomKeys();
    Object.keys(keys).forEach(key => { keys[key] = false; });
    Object.keys(k).forEach(key => { if (k[key]) keys[key] = true; });
    if (k[" "]) handleSpace();
    if (Math.random() < .12) attack();
    if (Math.random() < .04) dash();
    if (Math.random() < .02) useSpecial();
    if (Math.random() < .02 && typeof damagePlayer === "function") { damagePlayer(); hurt++; }
    updateGame();
    drawGame();
    if (enemies.some(e => !e.alive && e.deathT > 0)) killed = 1;
  }
} catch (e) { err = e; }
ok(!err, "level: 900 frames of update + draw never throw " + (err ? err.stack.split("\n")[0] : ""));
ok(nanTotal() === 0, "level: no NaN ever reaches the canvas " + [...new Set(nanSeen())].join(","));
ok(hurt === 0 || health < hp0, "level: taking damage reduces health");

/* a killed mob keeps a corpse animation, and its Geo reaches the save */
{
  const coins0 = save.coins, e = enemies.find(x => x.alive && x.type !== "boss") || enemies[0];
  const hp = e.health;
  for (let i = 0; i < hp + 2; i++) damageEnemy(e, 1);
  ok(!e.alive && e.deathT > 0, "combat: a killed mob plays a death animation before it disappears");
  ok(save.coins > coins0, "combat: the reward still lands in the save");
  gameCtx().calls.reset();
  drawGame();
  ok(gameCtx().calls.n > 50, "combat: the death frame still draws (" + gameCtx().calls.n + " calls)");
}

/* ---------------------------------------------------------------- 3. every mob type draws */
{
  const types = [...new Set(worlds.flatMap(w => w.enemy))];
  let bad = [];
  types.forEach(t => {
    const e = createEnemy(t, 500 + types.indexOf(t) * 30, 3);
    e.animT = 40; e.hitFlash = 1; e.windup = .7; e.alert = true;
    try {
      enemies.length = 0; enemies.push(e);
      gameCtx().calls.reset();
      drawEnemy(e);
      if (gameCtx().calls.nan.length) bad.push(t + ":NaN");
    } catch (ex) { bad.push(t + ":" + ex.message); }
  });
  ok(bad.length === 0, "mobs: every enemy type draws through the Art Kit " + bad.join(" | "));
}

/* ---------------------------------------------------------------- 3b. silhouettes stay in their box */
{
  const bad = [];
  /* x = -w/2 puts the creature's own origin at the world origin, so the
     recorded bounds can be compared with the box directly. (Anchors are
     centres, not extents, so the bounds are a smoke test for gross errors.) */
  Object.keys(Art.MOBS).forEach(t => {
    const w = 46, h = t === "warden" ? 64 : 46;
    const c = makeFakeCtx();
    Art.drawMob(c, t, { x: -w / 2, y: 0, feet: 0, w: w, h: h, t: 20, walk: 1.5, windup: .8, ground: true });
    const b = c.calls.bbox;
    /* wings are the family's signature: they may span wider than the body */
    const wingSpan = Art.mobInfo(t).fam === "wing" ? 18 : 8;
    if (b.minX < -w / 2 - wingSpan || b.maxX > w / 2 + wingSpan) bad.push(t + ":x(" + b.minX.toFixed(0) + "," + b.maxX.toFixed(0) + ")");
    if (b.minY < -h - 12 || b.maxY > 6) bad.push(t + ":y(" + b.minY.toFixed(0) + "," + b.maxY.toFixed(0) + ")");
  });
  ok(bad.length === 0, "silhouettes: every mob is anchored inside its own box " + bad.join(" | "));

  const c2 = makeFakeCtx();
  Art.drawVessel(c2, { x: -22, y: -64, w: 44, h: 64, hero: heroes[0], t: 12, walk: 1.4 });
  const b2 = c2.calls.bbox;
  ok(b2.minY >= -64 - 12 && b2.maxY <= 6 && b2.minX >= -22 - 26 && b2.maxX <= 22 + 26,
    "silhouettes: the Vessel fits its box, antennae and lantern included (" +
    b2.minX.toFixed(0) + "," + b2.minY.toFixed(0) + " -> " + b2.maxX.toFixed(0) + "," + b2.maxY.toFixed(0) + ")");
}

/* ---------------------------------------------------------------- 4. Vessels: every hero */
{
  const bad = [];
  heroes.forEach(h => {
    const real = save.selectedHero;
    save.selectedHero = h.id;
    try {
      gameCtx().calls.reset();
      drawPlayer();
      if (gameCtx().calls.nan.length) bad.push(h.id + ":NaN");
    } catch (e) { bad.push(h.id + ":" + e.message); }
    save.selectedHero = real;
  });
  ok(bad.length === 0, "vessel: all ten heroes render " + bad.join(" | "));
}

/* ---------------------------------------------------------------- 5. Art Kit contract */
{
  const src = fs.readFileSync(path.join(__dirname, "../js/game.js"), "utf8");
  const body = src.slice(src.indexOf("function createEnemy("), src.indexOf("function createBoss("));
  const used = [...new Set([...body.matchAll(/case "([a-zA-Z]+)":/g)].map(m => m[1]))];
  const missing = used.filter(t => !Art.MOBS[t]);
  ok(used.length >= 20 && missing.length === 0, "art kit: every createEnemy type has a role, family and palette " + (missing.join(",") || "(" + used.length + " types)"));

  const badRole = Object.entries(Art.MOBS).filter(([, v]) => !Art.ROLES.includes(v.role) || !Art.FAMILY_NAMES.includes(v.fam) || !Art._test.FAM[v.fam]);
  ok(badRole.length === 0, "art kit: every mob has a valid role and an existing silhouette family " + badRole.map(b => b[0]).join(","));

  const badPal = Object.entries(Art.MOBS).filter(([, v]) => !Array.isArray(v.pal) || v.pal.length !== 3 || v.pal.some(c => !/^#[0-9a-f]{6}$/i.test(c)));
  ok(badPal.length === 0, "art kit: every palette is 3 valid hex colours " + badPal.map(b => b[0]).join(","));

  const fams = new Set(Object.values(Art.MOBS).map(m => m.fam));
  ok(fams.size >= 8, "art kit: at least 8 distinct silhouette families in use (" + fams.size + ")");

  /* families must differ in shape language, not only in colour: the height to
     width ratio is the cheap proxy the design doc uses. */
  const ratios = new Set(Object.values(Art.MOBS).map(m => m.hw));
  ok(ratios.size >= 6, "art kit: mobs use at least 6 different height/width ratios (" + ratios.size + ")");

  ok(typeof Art.drawMob === "function" && typeof Art.drawVessel === "function" && typeof Art.prop === "function",
    "art kit: drawMob / drawVessel / prop are exported");
}

/* ---------------------------------------------------------------- 6. FX honours the options */
{
  const F = Art.FX;
  F.reset();
  save.settings = save.settings || {};
  save.settings.fx = { shake: 0, flash: false, hitstop: false, telegraph: true, fastDeath: false };
  save.settings.audio = { sfx: 100, ambient: 100 };
  F.addShake(6); F.freeze(6); F.flash("#fff", .5, 10, 1);
  ok(F.shake === 0 && F.hitstop === 0 && F.flashA === 0, "fx: shake / hit-stop / flash off really mean zero effect");

  save.settings.fx = { shake: 1, flash: true, hitstop: true, telegraph: true, fastDeath: false };
  F.reset(); F.addShake(6); F.freeze(6); F.flash("#fff", .5, 10, 1);
  ok(F.shake > 0 && F.hitstop === 6 && F.flashA > 0, "fx: shake / hit-stop / flash on are applied");
  F.reset();
  F.number(0, 0, "-1"); F.ring(0, 0, 5);
  for (let i = 0; i < 60; i++) F.step();
  ok(F.numbers.length === 0 && F.rings.length === 0 && F.shake === 0, "fx: every effect expires on its own (no leaks)");
  ok(F.number === Art.FX.number && typeof Art.FX.step === "function", "fx: the Descent and the Levels share one feedback bus");
}

/* ---------------------------------------------------------------- 7. props never sit on a hazard */
{
  let bad = 0;
  for (let w = 0; w < worlds.length; w++) {
    startLevel(w, 0);
    props.forEach(p => {
      const onHazard = hazards.some(hz => p.x > hz.x - 30 && p.x < hz.x + hz.width + 30);
      if (onHazard) bad++;
    });
  }
  ok(bad === 0, "props: living detail is never placed on a hazard (" + props.length + " props in the last level)");
  ok(props.length > 8, "props: each level gets living ground detail");
}

/* ---------------------------------------------------------------- 8. performance guard */
{
  /* Budget: the cached sprite path must keep the per-frame canvas calls per
     mob in the same order as the old hand-drawn one (~90). */
  const c = makeFakeCtx();
  Art.drawMob(c, "knight", { x: 0, y: 0, feet: 60, w: 52, h: 60, t: 30, walk: 1, ground: true });
  const perMob = c.calls.n;
  const c2 = makeFakeCtx();
  Art.drawVessel(c2, { x: 0, y: 0, w: 44, h: 64, hero: heroes[0], t: 10, walk: 1 });
  const perPlayer = c2.calls.n;
  ok(perMob < 130 && perPlayer < 200, "performance: draw calls stay in budget (mob " + perMob + ", vessel " + perPlayer + ")");

  const before = Art._test.spriteCount();
  for (let i = 0; i < 400; i++) Art.drawMob(makeFakeCtx(), "slime", { x: 0, y: 0, feet: 40, w: 46, h: 46, t: i, walk: i * .1 });
  ok(Art._test.spriteCount() <= 300, "performance: the sprite cache stays bounded (" + Art._test.spriteCount() + ")");
  ok(Art._test.spriteCount() === before, "performance: the sprite cache does not grow while the game runs");
}

/* ---------------------------------------------------------------- 9. polish pass
   Ladders without the jump-first toggle, the grounded goal banner,
   E-interact, and the pause freeze. */
{
  /* goal banner: planted on the ground at the end of the level */
  startLevel(0, 0);
  enemies.length = 0;
  player.invincible = 9999;

  const groundY = platforms[0].y;
  ok(!!finishLine && finishLine.y + finishLine.height === groundY,
    "flag: the goal banner's box ends exactly on the ground line");
  ok(!!finishLine && finishLine.x > levelWidth - 400 && finishLine.x < levelWidth,
    "flag: the banner stands near the end of the level");
  ok(ladders.length > 0, "ladder: levels generate ladders to climb");
  ok(checkpoints.length > 0 && checkpoints.every(c => c.y === groundY),
    "flag: checkpoint banners are planted on the ground line too");

  /* W alone grabs a ladder — the jump-first toggle is gone */
  const ladder = ladders.reduce((best, l) => (l.height > best.height ? l : best), ladders[0]);
  /* start with the feet inside the ladder span (the body is 64px tall) */
  const midY = Math.min(platforms[0].y, ladder.y + ladder.height - 16) - player.height;
  player.x = ladder.x + ladder.width / 2 - player.width / 2;
  player.y = midY; player.vx = 0; player.vy = 0;
  player.climbing = false; player.climbLadder = null; player.grabCd = 0; player.sideHold = 0;
  Object.keys(keys).forEach(k => keys[k] = false);
  keys["w"] = true;
  updateGame();
  ok(player.climbing === true && player.climbLadder === ladder,
    "ladder: W on a ladder starts climbing without pressing jump first");

  const yBefore = player.y;
  updateGame();
  ok(player.y < yBefore, "ladder: holding W climbs upward");

  /* Space hops off instead of toggling */
  handleSpace();
  ok(player.climbing === false && player.vy < 0,
    "ladder: Space hops off the ladder with a small jump");

  /* sideways pressure steps off */
  player.x = ladder.x + ladder.width / 2 - player.width / 2;
  player.y = midY; player.vx = 0; player.vy = 0;
  player.climbing = true; player.climbLadder = ladder; player.grabCd = 0; player.sideHold = 0;
  Object.keys(keys).forEach(k => keys[k] = false);
  keys["d"] = true;
  for (let i = 0; i < 10; i++) updateGame();
  ok(player.climbing === false, "ladder: pressing sideways steps off the ladder");

  /* climbing to the top lands on the platform */
  player.x = ladder.x + ladder.width / 2 - player.width / 2;
  player.y = midY; player.vx = 0; player.vy = 0;
  player.climbing = true; player.climbLadder = ladder; player.grabCd = 0; player.sideHold = 0;
  Object.keys(keys).forEach(k => keys[k] = false);
  keys["w"] = true;
  for (let i = 0; i < 80 && player.climbing; i++) updateGame();
  ok(player.climbing === false && player.grounded &&
     Math.abs(player.y + player.height - ladder.y) <= 2,
    "ladder: reaching the top steps the player onto the platform");

  /* S at that platform grabs the ladder again to climb down */
  Object.keys(keys).forEach(k => keys[k] = false);
  keys["s"] = true;
  player.grabCd = 0;
  updateGame();
  ok(player.climbing === true,
    "ladder: S at the top platform grabs the ladder to climb down");
  const yTop = player.y;
  for (let i = 0; i < 20; i++) updateGame();
  ok(player.climbing === true && player.y > yTop + 30,
    "ladder: holding S climbs downward through the span");

  /* pause freezes the level */
  Object.keys(keys).forEach(k => keys[k] = false);
  togglePause();
  const px = player.x, py = player.y;
  keys["d"] = true;
  for (let i = 0; i < 10; i++) updateGame();
  ok(paused === true && player.x === px && player.y === py,
    "pause: the level does not update while paused");
  togglePause();
  ok(paused === false, "pause: resuming returns to the game");
  Object.keys(keys).forEach(k => keys[k] = false);
}

{
  /* Space is a pure jump again */
  startLevel(0, 0);
  enemies.length = 0;
  player.invincible = 9999;
  player.x = 200; player.y = platforms[0].y - player.height;
  player.vx = 0; player.vy = 0; player.climbing = false;
  Object.keys(keys).forEach(k => keys[k] = false);
  updateGame();                       /* settle: feet on the ground */
  handleSpace();
  updateGame();
  ok(player.vy < 0, "controls: Space jumps without touching any ladder");
}

{
  /* touching the banner completes the level */
  startLevel(1, 0);
  enemies.length = 0;
  player.invincible = 9999;
  player.x = finishLine.x + finishLine.width / 2 - player.width / 2;
  player.y = platforms[0].y - player.height;
  player.vx = 0; player.vy = 0;
  updateGame();
  ok(gameRunning === false, "flag: touching the banner completes the level");
}

{
  /* E near the banner is the interaction; walking up to it does not auto-win */
  startLevel(1, 1);
  enemies.length = 0;
  player.invincible = 9999;
  player.x = finishLine.x - 60;
  player.y = platforms[0].y - player.height;
  player.vx = 0; player.vy = 0;
  updateGame();
  ok(gameRunning === true, "flag: the banner does not finish the level before contact");
  const interacted = tryInteract();
  ok(interacted === true && gameRunning === false,
    "flag: E near the banner completes the level");
}

{
  /* boss levels seal the banner until the guardian falls */
  startLevel(0, 3);
  enemies.length = 0;
  player.invincible = 9999;
  player.x = finishLine.x + 20;
  player.y = platforms[0].y - player.height;
  player.vx = 0; player.vy = 0;
  updateGame();
  ok(gameRunning === true && finishLocked(),
    "flag: the banner stays sealed while the guardian lives");
  boss.alive = false;
  ok(tryInteract() === true && gameRunning === false,
    "flag: defeating the guardian releases the banner");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
