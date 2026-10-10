/* Run:  node tests/metro.test.js
   Simulates the real physics headlessly to verify room data, ability gating, combat and robustness. */
const fs = require("fs"), vm = require("vm"), path = require("path");
global.window = global; global.save = { coins: 0, selectedHero: "milo" }; global.saveGame = () => {};
global.stopGame = () => {}; global.hideScreens = () => {};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "../js/metroFx.js"), "utf8"));
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "../js/metroid.js"), "utf8"));
const T = Metro._test, TS = T.TS;
let pass = 0, fail = 0;
const ok = (c, name) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + name); };
const fresh = ab => { global.save = { coins: 0, selectedHero: "milo" }; return T.init(ab); };

/* ---- 1. room data ---- */
{
  const R = T.ROOMS; let good = true, msg = "";
  for (const r of Object.values(R)) {
    for (const [dir, back] of [["left", "right"], ["right", "left"]]) if (r.ex[dir]) { if (!R[r.ex[dir]] || R[r.ex[dir]].ex[back] !== r.id) { good = false; msg += `${r.id}.${dir} `; } }
    if (r.ex.up) { const o = R[r.ex.up.to]; if (!o.ex.down || o.ex.down.to !== r.id || o.ex.down.col !== r.ex.up.col) { good = false; msg += `${r.id}.up `; } }
    if (r.ex.down) { const o = R[r.ex.down.to]; if (!o.ex.up || o.ex.up.to !== r.id || o.ex.up.col !== r.ex.down.col) { good = false; msg += `${r.id}.down `; } }
    const gx = r.gx, gy = r.gy; if (r.ex.right && (R[r.ex.right].gx !== gx + 1 || R[r.ex.right].gy !== gy)) { good = false; msg += `${r.id}.mapRight `; }
    if (r.ex.up && (R[r.ex.up.to].gy !== gy - 1 || R[r.ex.up.to].gx !== gx)) { good = false; msg += `${r.id}.mapUp `; }
  }
  ok(good, "exits are symmetrical and consistent with the map grid " + msg);
  let bad = [];
  for (const r of Object.values(R)) {
    const solid = (x, y) => T.SOLID_CH.has(r.g[Math.floor(y / TS)][Math.floor(x / TS)]);
    r.items.forEach(i => solid(i.x, i.y) && bad.push(r.id + ":" + i.id));
    r.enemies.forEach(e => solid(e.x, e.y - 4) && bad.push(r.id + ":enemy@" + e.x));
    if (r.bench && solid(r.bench.x, 22 * TS - 10)) bad.push(r.id + ":bench");
  }
  ok(!bad.length, "no item / enemy / bench is inside a wall " + bad.join(","));
  const ids = Object.values(R).flatMap(r => r.items.map(i => i.id)); ok(new Set(ids).size === ids.length, "item ids are unique");
}

/* ---- helpers ---- */
const run = (frames, ctl) => { for (let f = 0; f < frames; f++) T.step(ctl(f, T.P) || {}); };

/* ---- 2. chasm needs dash ---- */
function chasm(dash) {
  fresh({ dash }); T.load("r3", 10 * TS, 22 * TS - 31); T.P.vx = 0; T.S.enemies.length = 0;   // isolate the platforming
  let dashed = false, jumped = false, hp0 = T.P.hp, teleported = false;
  run(160, (f, p) => {
    const edge = p.x + p.w >= 14 * TS - 6;
    const c = { right: 1 };
    if (edge && !jumped && p.onGround) { c.jumpP = 1; c.jump = 1; jumped = true; }
    if (jumped && (p.vy < 0 || !p.onGround)) c.jump = 1;      // hold jump while rising (p.onGround is one frame stale)
    if (jumped && !dashed && p.vy > -1.5 && !p.onGround) { c.dashP = 1; dashed = true; }
    return c;
  });
  return T.P.x > 23 * TS && T.R.id === "r3" && T.P.hp === hp0;
}
ok(chasm(true) === true, "chasm: dash + jump crosses the 9-tile spike gap");
ok(chasm(false) === false, "chasm: without dash you cannot cross");

/* ---- 3. r1 ledge needs double jump ---- */
function ledge(dbl) {
  fresh({ dbl }); T.load("r1", 21 * TS - 4, 13 * TS - 31);
  let jumped = false, reached = false;
  run(100, (f, p) => {
    if (p.onGround && Math.abs(p.y + p.h - 8 * TS) < 3 && p.x > 24 * TS - 8 && p.x < 28 * TS) reached = true;
    const c = { right: 1 };
    if (!jumped) { c.jumpP = 1; c.jump = 1; jumped = true; return c; }
    c.jump = f < 30; if (f === 14) c.jumpP = 1;
    return c;
  });
  return reached;
}
ok(ledge(true) === true, "r1: double jump reaches the 5-tile-high ledge");
ok(ledge(false) === false, "r1: single jump cannot reach it");

/* ---- 4. r4 shaft needs wall jump ---- */
function shaft(wall) {
  fresh({ wall }); T.load("r4", 31 * TS, 22 * TS - 31);
  let last = 1, reached = false;
  run(1400, (f, p) => {
    if (T.R.id === "r5") reached = true;
    const c = {};
    if (T.R.id !== "r4") return c;
    if (p.onGround) { c.right = 1; c.jumpP = 1; c.jump = 1; last = 1; }
    else if (p.wallDir) { c.jumpP = 1; c.jump = 1; c[p.wallDir > 0 ? "left" : "right"] = 1; last = -p.wallDir; }
    else { c.jump = 1; c[last > 0 ? "right" : "left"] = 1; }
    return c;
  });
  return reached;
}
ok(shaft(true) === true, "r4: wall jump climbs the shaft to r5");
ok(shaft(false) === false, "r4: without wall jump the shaft is unreachable");

/* ---- 5. secret wall breaks, pocket holds the charm ---- */
{
  fresh({}); T.load("r2", 10 * TS, 14 * TS - 31);
  T.step({ left: 1 }); T.step({ left: 1, atkP: 1 }); run(10, () => ({ left: 0 }));
  ok(T.R.g[12][8] === "." && T.R.g[11][8] === ".", "r2: attacking the cracked wall opens the secret pocket");
}

/* ---- 6. combat + soul + geo ---- */
{
  const { m } = fresh({}); T.load("r0", 100, 22 * TS - 31); T.S.enemies.length = 0;
  const e = (T.S.enemies.push({ t: "crawler", x: 140, y: 22 * TS - 20, w: 26, h: 20, hp: 3, hpMax: 3, vx: 0, vy: 0, st: "idle", tm: 99, flash: 0, face: -1, home: { x: 150, y: 0 } }), T.S.enemies[0]);
  for (let i = 0; i < 3; i++) { T.step({ right: 1, atkP: 1 }); run(24, () => ({})); T.S.enemies[0] && (T.S.enemies[0].x = 140); }
  ok(e.dead === true, "combat: crawler dies after 3 hits");
  ok(T.P.soul >= 33, "combat: hitting enemies builds Soul");
  run(120, () => ({})); ok(save.coins > 0, "combat: enemies drop Geo that is added to the shared save");
  T.P.hp = 2; T.P.soul = 40; run(60, () => ({ heal: 1 })); ok(T.P.hp === 3 && T.P.soul === 7, "heal: holding Q spends 33 Soul for +1 health");
}

/* ---- 7. boss fight is winnable, phases switch, door locks ---- */
{
  const { m } = fresh({ dash: true, wall: true, dbl: true }); T.load("r6", 36 * TS, 22 * TS - 31);
  run(5, () => ({ left: 1 })); run(60, () => ({ left: 1 }));
  const boss = T.S.enemies.find(e => e.t === "warden");
  ok(!!boss && T.S.lock === true && T.R.g[19][39] === "#", "boss: fight starts and the door locks");
  const seen = new Set(); let hurt = 0;
  for (let f = 0; f < 9000 && !boss.dead; f++) {
    const p = T.P; seen.add(boss.st); p.hp = 99;                        // test the AI, not the player's skill
    const dx = boss.x + boss.w / 2 - (p.x + p.w / 2); T.step({ right: dx > 40 ? 1 : 0, left: dx < -40 ? 1 : 0, atkP: Math.abs(dx) < 90 && f % 22 === 0 ? 1 : 0 });
    if (boss.hp <= 22) seen.add("phase2");
  }
  ok(boss.dead && m.bossDead === true, "boss: can be defeated and progress is flagged");
  ok(seen.has("charge") && seen.has("slam") && seen.has("phase2"), "boss: uses charge + slam, enters phase 2 [" + [...seen].join(",") + "]");
  ok(T.R.g[19][39] === "." , "boss: door unlocks after victory");
}

/* ---- 7b. Descent options + feedback (Stage 1) ---- */
{
  const F = MetroFx;
  const d = F.normalize({});
  ok(d.fx.shake === 1 && d.fx.flash && d.fx.hitstop && d.fx.telegraph && !d.fx.fastDeath && d.audio.sfx === 100 && d.audio.ambient === 100, "options: defaults when settings are missing");
  const bad = F.normalize({ fx: { shake: "huge", flash: 0, fastDeath: "yes" }, audio: { sfx: 999, ambient: -5 } });
  ok(bad.fx.shake === 1 && bad.fx.flash === true && bad.fx.fastDeath === false && bad.audio.sfx === 100 && bad.audio.ambient === 0, "options: corrupt values fall back or clamp");
  global.save = { coins: 0, selectedHero: "milo", settings: {} };
  F.cycle("shake");
  ok(F.get().fx.shake === 2 && save.settings.fx.shake === 2, "options: shake cycles Low -> Full and is written to the save");
  F.cycle("shake"); F.cycle("shake");
  ok(F.get().fx.shake === 1 && F.shakeScale() === .5, "options: shake cycles back around to Low (scale 0.5)");
  F.cycle("shake"); F.cycle("shake"); ok(F.shakeScale() === 0, "options: shake Off removes all camera shake");
  F.cycle("hitstop");
  ok(F.freeze(6) === 0, "options: hit-stop off removes freeze frames");
  F.cycle("hitstop");
  ok(F.freeze(6) === 6, "options: hit-stop on keeps freeze frames");
  F.cycle("flash");
  ok(!F.flashOK(), "options: flashing off disables full-screen flashes");
  F.cycle("sfx"); F.cycle("ambient");
  ok(F.get().audio.sfx === 0 && F.get().audio.ambient === 0 && F.label("sfx") === "0%", "options: effects and ambient volume step down to 0%");
  F.cycle("fastDeath");
  ok(F.deadFrames() === 40, "options: reduced downtime shortens the death fade");
  ok(F.optionsHTML().includes('data-fx="telegraph"'), "options: rows render with data-fx keys");
  global.save = { coins: 0, selectedHero: "milo" };
  let threw = false; try { F.play("hit"); F.play("nope"); } catch (e) { threw = true; }
  ok(!threw, "sound: play() never throws (no AudioContext in Node)");
  const src = fs.readFileSync(path.join(__dirname, "../js/metroid.js"), "utf8");
  const used = [...src.matchAll(/MetroFx\.play\("([a-z]+)"\)/g)].map(m => m[1]);
  const names = [...new Set(used)].filter(n => !F.SFX[n]);
  ok(used.length > 10 && names.length === 0, "sound: every MetroFx.play() name exists in the sound table " + (names.join(",") || "(" + used.length + " calls)"));
}

/* ---- 7c. feedback options change real gameplay ---- */
{
  global.save = { coins: 0, selectedHero: "milo", settings: { fx: { hitstop: false, shake: 0, flash: true, telegraph: true, fastDeath: true }, audio: { sfx: 100, ambient: 100 } } };
  T.init({}); T.load("r0", 100, 22 * TS - 31); T.S.enemies.length = 0; T.P.hp = 5;
  T.S.enemies.push({ t: "crawler", x: T.P.x, y: T.P.y + 4, w: 26, h: 20, hp: 3, hpMax: 3, vx: 0, vy: 0, st: "idle", tm: 99, flash: 0, face: -1, home: { x: 0, y: 0 } });
  T.step({});
  ok(T.P.hp === 4 && T.S.hitstop === 0, "hit-stop off: taking damage does not freeze the game");
  T.S.enemies.length = 0; T.P.invuln = 0; T.P.hp = 1; T.P.x = 100; T.P.vx = 0;
  T.S.enemies.push({ t: "crawler", x: T.P.x, y: T.P.y + 4, w: 26, h: 20, hp: 3, hpMax: 3, vx: 0, vy: 0, st: "idle", tm: 99, flash: 0, face: -1, home: { x: 0, y: 0 } });
  T.step({});
  ok(T.S.dead === 1, "death: hp 0 starts the death sequence");
  for (let i = 0; i < 45; i++) T.step({});
  ok(T.S.dead === 0, "reduced downtime: respawn at the bench after 40 frames");
  save.settings.fx.fastDeath = false; T.init({}); T.load("r0", 100, 22 * TS - 31); T.P.hp = 1; T.S.enemies.length = 0;
  T.S.enemies.push({ t: "crawler", x: T.P.x, y: T.P.y + 4, w: 26, h: 20, hp: 3, hpMax: 3, vx: 0, vy: 0, st: "idle", tm: 99, flash: 0, face: -1, home: { x: 0, y: 0 } });
  T.step({}); for (let i = 0; i < 45; i++) T.step({});
  ok(T.S.dead === 1, "default downtime: still dead after 45 frames (80 frame fade)");
}

/* ---- 7d. Stage 2: Lantern Sight, Sinking Weight, Bell Hook, seals, brittle floor, Bellwork Ravine ---- */
{
  const sealed = Object.values(T.SEAL_AB).sort().join(), abil = T.ABIL_KEYS.slice().sort().join();
  ok(Object.keys(T.SEAL_AB).length === 6 && sealed === abil, "seals: exactly one seal glyph per ability");

  // Lantern seal: blocks the corridor from The Climb until Lantern Sight is owned
  const walkEast = ab => { fresh(ab); T.load("r4", 24 * TS, 22 * TS - 31); T.S.enemies.length = 0; run(260, () => ({ right: 1 })); return T.R.id; };
  ok(walkEast({}) === "r4", "seal: the Lantern seal blocks the Ravine corridor without Lantern Sight");
  ok(walkEast({ lantern: true }) === "r8", "seal: with Lantern Sight the seal is gone and Milo walks into Bellwork Gate");
  fresh({ lantern: true }); T.load("r4", 24 * TS, 22 * TS - 31);
  const ownedOpen = T.R.g[18][35] === ".";
  fresh({}); T.load("r4", 24 * TS, 22 * TS - 31);
  ok(ownedOpen && T.R.g[18][35] === "l", "seal: an owned seal is removed on load, an unowned one stays solid");

  // Lantern Sight: a Lumen platform under a falling Milo catches the fall, then expires
  fresh({ lantern: true }); T.load("r3", 16 * TS, 14 * TS); T.S.enemies.length = 0;
  const hp0 = T.P.hp; let pulsed = false;
  run(120, (f, p) => { if (!pulsed && p.vy > 0 && !p.onGround) { pulsed = true; return { lampP: 1 }; } return {}; });
  const lum = T.S.lumen[0], row = lum && lum.tiles[0][1];
  ok(!!lum && lum.tiles.length === 4 && T.P.onGround && Math.abs(T.P.y + T.P.h - row * TS) < 2 && T.P.hp === hp0,
     "lantern: a pulse under a falling Milo makes a 4-tile platform that catches the fall (no spike damage)");
  const tiles = lum ? lum.tiles : [];
  run(80, () => ({}));
  ok(T.S.lumen.length === 0 && tiles.every(([x, y]) => T.R.g[y][x] === "."), "lantern: Lumen expires after about 3 seconds and the tiles return to air");

  fresh({ lantern: true }); T.load("r3", 16 * TS, 14 * TS); T.S.enemies.length = 0;
  T.step({ lampP: 1 }); const cd = T.P.lampCd; T.step({ lampP: 1 }); run(4, () => ({ lampP: 1 }));
  ok(cd > 0 && T.S.lumen.length === 1, "lantern: pulses have a cooldown and cannot be spammed");

  fresh({ lantern: true }); T.load("r0", 100, 22 * TS - 31); T.S.enemies.length = 0; T.P.hp = 3; T.P.invuln = 0;
  const near = { t: "crawler", x: T.P.x + 40, y: 22 * TS - 20, w: 26, h: 20, hp: 3, hpMax: 3, vx: 0, vy: 0, st: "idle", tm: 99, flash: 0, face: -1, home: { x: 0, y: 0 } };
  T.S.enemies.push(near); T.step({ lampP: 1 });
  const x0 = near.x; run(30, () => ({}));
  ok(near.stun > 0 && near.x === x0 && T.P.hp === 3, "lantern: stunned enemies stop moving and do not hurt Milo");

  // Sinking Weight: Down + Jump in mid-air dives; the landing shatters the brittle column's base
  const { m: ms } = fresh({ sink: true }); T.load("r8", 18 * TS + 6, 18 * TS); T.S.enemies.length = 0;
  const shade = { t: "crawler", x: 17 * TS, y: 22 * TS - 20, w: 26, h: 20, hp: 3, hpMax: 3, vx: 0, vy: 0, st: "idle", tm: 99, flash: 0, face: -1, home: { x: 0, y: 0 } };
  T.S.enemies.push(shade);
  T.step({ down: 1, jumpP: 1 }); const dived = T.P.sinking === true;
  run(60, () => ({}));
  ok(dived && T.R.g[21][20] === "." && T.R.g[21][21] === "." && T.R.g[17][20] === "." && T.R.g[16][20] === "B" && T.R.g[10][20] === "B",
     "sinking: the dive breaks the brittle column low down (rows 17-21) and leaves rows 2-16 standing");
  ok(ms.broken.includes("r8:20,21") && shade.hp === 1, "sinking: broken stone is saved to the save; the shockwave hurts enemies within 2 tiles");
  fresh({}); T.load("r8", 18 * TS + 6, 18 * TS); T.step({ down: 1, jumpP: 1 });
  ok(T.P.sinking === false, "sinking: without Sinking Weight, Down + Jump does nothing extra");
  fresh({ dash: true, wall: true, dbl: true, lantern: true, hook: true }); T.load("r8", 10 * TS, 22 * TS - 31); T.S.enemies.length = 0;
  run(200, () => ({ right: 1 }));
  ok(T.P.x < 20 * TS && T.R.id === "r8", "brittle column: holds Milo back until Sinking Weight shatters it");

  // Bellwork ledge: one jump cannot reach it, Moth Wing can
  const ledge = ab => {
    fresh(ab); T.load("r8", 13 * TS, 22 * TS - 31); T.S.enemies.length = 0;
    let jumped = false, winged = false, reached = false;
    run(120, (f, p) => {
      if (p.onGround && Math.abs(p.y + p.h - 16 * TS) < 3) reached = true;
      const c = {};
      if (!jumped && p.onGround) { jumped = true; c.jumpP = 1; c.jump = 1; return c; }
      if (jumped && f < 60) c.jump = 1;
      if (jumped && !winged && !p.onGround && p.vy > -1 && p.vy < 3) { winged = true; c.jumpP = 1; }
      return c;
    });
    return reached;
  };
  ok(ledge({ dbl: true }) === true, "r8: Moth Wing reaches the Bellwork ledge");
  ok(ledge({}) === false, "r8: without Moth Wing the ledge is out of reach");
  const climb = ab => {                                        // wall-jump up the column face to the ledge
    fresh(ab); T.load("r8", 18 * TS, 22 * TS - 31); T.S.enemies.length = 0;
    let last = 1, reached = false;
    for (let f = 0; f < 900 && !reached; f++) {
      const p = T.P; if (p.onGround && Math.abs(p.y + p.h - 16 * TS) < 3) reached = true;
      const c = {};
      if (p.onGround) { c.right = 1; c.jumpP = 1; c.jump = 1; last = 1; }
      else if (p.wallDir) { c.jumpP = 1; c.jump = 1; c[p.wallDir > 0 ? "left" : "right"] = 1; last = -p.wallDir; }
      else { c.jump = 1; c[last > 0 ? "right" : "left"] = 1; }
      T.step(c);
    }
    return reached;
  };
  ok(climb({ wall: true }) === true, "r8: Wall Claw climbs the brittle column face to the ledge (the second route)");

  // Bell Hook: aims along a ray, latches to the anchor, pulls up; jump lets go
  const hookRun = ab => {
    fresh(ab); T.load("r9", 14 * TS + 6, 22 * TS - 31); T.S.enemies.length = 0;
    T.step({ up: 1, hookP: 1 }); const latched = !!T.P.hook;
    let top = T.P.y + T.P.h / 2; run(40, () => { top = Math.min(top, T.P.y + T.P.h / 2); return {}; });
    return { latched, top };
  };
  const h1 = hookRun({ hook: true }), h0 = hookRun({});
  ok(h1.latched && h1.top < 13 * TS, "hook: latches onto the bell anchor and pulls Milo up to it");
  ok(!h0.latched && h0.top > 20 * TS, "hook: without Bell Hook, G does nothing");
  fresh({ hook: true }); T.load("r9", 14 * TS + 6, 22 * TS - 31); T.S.enemies.length = 0;
  T.step({ up: 1, hookP: 1 }); run(5, () => ({}));
  T.step({ jumpP: 1, jump: 1 });
  ok(T.P.hook === null, "hook: jump lets go of the anchor");
  fresh({ hook: true }); T.load("r8", 17 * TS + 6, 22 * TS - 31); T.S.enemies.length = 0;
  T.step({ right: 1, hookP: 1 });
  ok(!T.P.hook && T.S.hookLine && T.S.hookLine.hit === "wall", "hook: stone stops the ray and it never latches through a wall");

  // save normalisation covers the new abilities
  global.save = { coins: 0, selectedHero: "milo", metro: { abilities: { lantern: true, sink: 1, hook: "yes", dash: true } } };
  const { m: mm } = T.init({});
  ok(mm.abilities.lantern === true && mm.abilities.sink === false && mm.abilities.hook === false && mm.abilities.dash === true && mm.abilities.wall === false,
     "save: the six ability flags load; corrupt values fall back to false");
  global.save = { coins: 0, selectedHero: "milo" };
}

/* ---- 8. fuzz: random input in every room for NaN / exceptions ---- */
{
  let bad = null;
  for (const id of Object.keys(T.ROOMS)) {
    fresh({ dash: true, wall: true, dbl: true, lantern: true, sink: true, hook: true }); T.load(id, 6 * TS, 22 * TS - 31); T.P.hp = 999;
    try {
      for (let f = 0; f < 4000; f++) {
        const r = () => Math.random() < .5 ? 1 : 0;
        T.step({ left: r(), right: r(), up: r() && Math.random() < .2, down: r() && Math.random() < .2, jump: r(), jumpP: Math.random() < .08, atkP: Math.random() < .1, dashP: Math.random() < .05, spP: Math.random() < .03, upP: Math.random() < .02 });
        const p = T.P; if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.vx) || !isFinite(p.vy)) { bad = id + " NaN"; break; }
        if (T.S.dialog) T.S.dialog = null;
      }
    } catch (e) { bad = id + ": " + e.message; }
    if (bad) break;
  }
  ok(!bad, "fuzz: every room x 4000 random frames with all abilities, no exceptions / NaN " + (bad || ""));
}

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
