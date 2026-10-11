/* tools/sheet.js - render the Art Kit to PNG sheets so the art can be reviewed
   offline (no browser needed). Run:  node tools/sheet.js
   Writes into preview/: vessel.png, mobs.png, silhouette.png, props.png */
const fs = require("fs"), path = require("path"), vm = require("vm");
const { createCanvas, writePNG, downsample } = require("./raster.js");

/* The Art Kit expects a browser-ish window/document; give it our canvas. */
global.window = global;
global.document = {
  createElement: (tag) => (tag === "canvas" ? createCanvas(1, 1) : {}),
  getElementById: () => null
};
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "../js/art.js"), "utf8"));

const SS = 2;                                  // supersample factor (anti-aliasing)
const mk = (w, h) => createCanvas(w * SS, h * SS);

const ZONES = [
  { name: "Forgotten Crossroads", ground: "#1d232b", sky: "#1a2230", dark: .35 },
  { name: "Mossy Greenpath", ground: "#1a2a1f", sky: "#0f2a24", dark: .45 },
  { name: "Crystal Depths", ground: "#272a45", sky: "#1b1840", dark: .55 },
  { name: "City of Rain", ground: "#38424f", sky: "#1a2438", dark: .35 },
  { name: "Ashen Basin", ground: "#21130f", sky: "#1c0f12", dark: .45 },
  { name: "Pale Peaks", ground: "#5a7384", sky: "#2a3d52", dark: .25 },
  { name: "Hollow Castle", ground: "#15131d", sky: "#0b0a14", dark: .62 }
];
const HEROES = [
  { id: "milo", color: "#d94f65", secondary: "#8f2940" }, { id: "luna", color: "#8f6ee8", secondary: "#5540a6" },
  { id: "rocco", color: "#9b6948", secondary: "#5b3828" }, { id: "zuki", color: "#55b85c", secondary: "#28723a" },
  { id: "blaze", color: "#ed6638", secondary: "#a92d20" }, { id: "taro", color: "#54bce5", secondary: "#267ba5" },
  { id: "koko", color: "#e7b83c", secondary: "#9b6b1e" }, { id: "piko", color: "#478de0", secondary: "#25549b" },
  { id: "mimi", color: "#ed80aa", secondary: "#a93d68" }, { id: "bruno", color: "#a56d46", secondary: "#583521" }
];
const LEVEL_MOBS = ["slime", "beetle", "mushling", "wolf", "thorn", "forestSpirit", "bat", "rockCrawler",
  "crystalBug", "cloudSpirit", "stormBird", "skyEye", "lavaSlime", "fireBat", "magmaBeast", "iceWolf",
  "frostBat", "iceGolem", "darkMushroom", "knight", "magicGuardian"];
const MOB_SIZE = { magmaBeast: [58, 58], iceGolem: [60, 60], knight: [52, 60] };

function zoneGround(c, x, y, w, h, zone) {
  c.fillStyle = zone.ground; c.fillRect(x, y, w, h);
  c.fillStyle = zone.sky; c.globalAlpha = .5; c.fillRect(x, y, w, h * .34); c.globalAlpha = 1;
  c.fillStyle = "rgba(255,255,255,.05)"; c.fillRect(x, y, w, 1);
}
/* Scenery's darkness pass, reproduced: judge the art as the player sees it. */
function darkness(c, x, y, w, h, amount, px, py) {
  const g = c.createRadialGradient(px, py, 30, px, py, Math.max(w, h));
  g.addColorStop(0, "rgba(5,8,20," + (amount * .3).toFixed(2) + ")");
  g.addColorStop(1, "rgba(5,8,20," + amount.toFixed(2) + ")");
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function silhouette(ctx, on) {
  if (!on) return ctx;
  return new Proxy(ctx, {
    get(t, p) { if (p === "fillStyle" || p === "strokeStyle") return "#05070c"; if (p === "globalAlpha") return 1; const v = t[p]; return typeof v === "function" ? v.bind(t) : v; },
    set(t, p, v) { if (p === "globalAlpha") return true; if (p === "fillStyle" || p === "strokeStyle") v = "#05070c"; t[p] = v; return true; }
  });
}

/* ---------------------------------------------------------------- 1. Vessel sheet */
function vesselSheet(sil) {
  const CW = 96, CH = 104, COLS = 4;
  const states = [
    ["idle", {}], ["walk", { walk: 2.6 }], ["dash", { dash: 1, walk: 2.6 }], ["air up", { air: 1, vy: -9 }],
    ["air down", { air: 1, vy: 8 }], ["land", { squash: .26 }], ["attack", { attack: 1, walk: 1.2 }], ["hurt", { hurt: 1 }]
  ];
  const rows = 3 + Math.ceil(HEROES.length / COLS);
  const cv = mk(CW * COLS, CH * rows + 26 * 4);
  const c = cv.getContext("2d");
  c.scale(SS, SS);

  states.forEach(([name, st], i) => {
    const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
    const zone = ZONES[6];
    zoneGround(c, x, y, CW, 72, zone);
    darkness(c, x, y, CW, 72, zone.dark, x + CW / 2, y + 62);
    c.save(); c.translate(x + CW / 2, y + 66);
    Art.drawVessel(silhouette(c, sil), Object.assign({ x: -22, y: -64, w: 44, h: 64, hero: HEROES[0], face: 1, t: 14, blink: false }, st));
    c.restore();
  });

  /* every Vessel on the darkest ground */
  let row = Math.ceil(states.length / COLS);
  HEROES.forEach((h, i) => {
    const x = (i % COLS) * CW, y = (row + Math.floor(i / COLS)) * CH;
    const zone = ZONES[6];
    zoneGround(c, x, y, CW, 72, zone);
    c.save(); c.translate(x + CW / 2, y + 66);
    Art.drawVessel(silhouette(c, sil), { x: -22, y: -64, w: 44, h: 64, hero: h, face: 1, t: 14, walk: 1.6, blink: false });
    c.restore();
    darkness(c, x, y, CW, 72, zone.dark, x + CW / 2, y + 62);
  });
  return downsample(cv, SS);
}

/* ---------------------------------------------------------------- 2. mob sheet */
function mobSheet(sil, only) {
  const types = (only ? only : LEVEL_MOBS.concat(["crawler", "flyer", "spitter", "warden"]))
    .filter(t => Art.MOBS[t]);
  const CW = 118, CH = 96, COLS = 4;
  const cv = mk(CW * COLS, CH * Math.ceil(types.length / COLS));
  const c = cv.getContext("2d");
  c.scale(SS, SS);
  types.forEach((t, i) => {
    const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH;
    const zc = t === "crawler" || t === "flyer" || t === "spitter" ? ZONES[0] : t === "warden" ? ZONES[6] : ZONES[Math.min(6, Math.floor(i / 3))];
    zoneGround(c, x, y, CW, 74, zc);
    const size = MOB_SIZE[t] || (t === "crawler" || t === "flyer" ? [26, 20] : t === "spitter" ? [28, 26] : t === "warden" ? [46, 64] : [46, 46]);
    const [w, h] = size;
    c.save();
    c.translate(x + CW / 2, y + 70);
    if (t === "warden") Art.drawMob(silhouette(c, sil), t, { x: -w / 2, y: -h, feet: 0, w, h, t: 14, walk: 1, alert: true });
    else if (t === "magmaBeast" || t === "iceGolem" || t === "knight") Art.drawMob(silhouette(c, sil), t, { x: -w / 2, y: -h, feet: 0, w, h, t: 14, walk: 1, alert: true, windup: .7 });
    else Art.drawMob(silhouette(c, sil), t, { x: -w / 2, y: -h, feet: 0, w, h, t: 14, walk: 1, alert: true, windup: t === "thorn" || t === "skyEye" || t === "magicGuardian" || t === "spitter" ? .8 : 0 });
    c.restore();
    darkness(c, x, y, CW, 74, zc.dark, x + CW / 2, y + 62);
  });
  return downsample(cv, SS);
}

/* ---------------------------------------------------------------- 3. props sheet */
function propSheet() {
  const kinds = Object.keys(Art.PROPS);
  const CW = 96, CH = 76, cv = mk(CW * kinds.length, CH);
  const c = cv.getContext("2d"); c.scale(SS, SS);
  const zoneOf = { grass: 1, mushroom: 1, spore: 1, reed: 4, pebble: 0, crystal: 2, ice: 5, chain: 3, rib: 6 };
  kinds.forEach((k, i) => {
    const x = i * CW, z = ZONES[zoneOf[k] === undefined ? 0 : zoneOf[k]];
    zoneGround(c, x, 0, CW, CH, z);
    c.save(); c.translate(x, 0);
    Art.prop(c, k, CW / 2, 56, 3.2, 14, zoneOf[k] || 0);
    c.restore();
    darkness(c, x, 0, CW, CH, z.dark, x + CW / 2, 52);
  });
  return downsample(cv, SS);
}

/* ---------------------------------------------------------------- run */
/* `node tools/sheet.js crystalBug rockCrawler` renders just those mobs large */
const only = process.argv.slice(2);
const out = path.join(__dirname, "../preview");
fs.mkdirSync(out, { recursive: true });
writePNG(path.join(out, "sheet-vessel.png"), vesselSheet(false));
if (only.length) {
  writePNG(path.join(out, "sheet-mobcheck.png"), mobSheet(false, only));
  console.log("wrote sheet-mobcheck.png for " + only.join(", "));
} else {
  writePNG(path.join(out, "sheet-mobs.png"), mobSheet(false));
writePNG(path.join(out, "sheet-silhouette.png"), mobSheet(true));
writePNG(path.join(out, "sheet-props.png"), propSheet());
console.log("wrote sheet-vessel.png, sheet-mobs.png, sheet-silhouette.png, sheet-props.png into preview/");
}
