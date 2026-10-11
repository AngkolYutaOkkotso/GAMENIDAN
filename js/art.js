/* =========================================================
   art.js - "The Art Kit": one place that decides how Hollow Milo looks.
   * The style guide as code: palette, outline/rim/shading rules, glow tiers.
   * MOBS: role + silhouette family + palette for every enemy in the game
     (Levels and the Descent share the same table, so nothing reads twice).
   * Every static shape is pre-rendered ONCE into an offscreen canvas and
     then blitted; only limbs, wings, tells and flashes are drawn per frame.
     No shadowBlur, no per-frame gradients => the art pass is cheaper than
     the old one, not heavier.
   * FX: shake / hit-stop / flashes / damage numbers, all gated by the
     MetroFx options (Descent settings) so the Levels mode honours them too.
   Headless-safe: with no `document` every draw call becomes a no-op, so
   tests/metro.test.js can load this file in Node.
   Sections: STYLE | TABLE | CACHE | MOB FAMILIES | MOBS | VESSEL | PROPS | FX
========================================================= */
const Art = (() => {

    const HAS_DOC = typeof document !== "undefined" && typeof document.createElement === "function";

    /* ================================================  STYLE  =========
       Locked palette. Nothing in the game invents a colour outside this list
       (zone tones live in `worlds` / Scenery THEMES and are backgrounds only). */
    const INK = "#0b0e16";              // outline ink: every character and mob
    const GOLD = "#f2b84b";             // lamplight: rewards, lantern, checkpoints
    const RIM = "#ffd9a8";              // warm rim light on the lantern side
    const WHITE = "#e8edf3";            // UI, enemy eyes, clean stone
    const SOUL = "#8fc1e3";             // soul, Geo, altar light
    const DANGER = "#ff6b6b";           // hazards and enemy attacks (shape-coded)
    const CREAM = "#f2d3ab";            // vessel face and hands
    const BRASS = "#c9a35a";            // friendly props: lamps, benches, bells
    const EYE_CALM = "#ffe9c9", EYE_HOT = "#ff8a6b";
    const SHADOW = "rgba(0,0,0,.28)";
    const OUTLINE_W = 2, RIM_W = 2, PAD = 10;   // sprite padding for antennas/wings

    const STYLE = { INK, GOLD, RIM, WHITE, SOUL, DANGER, CREAM, BRASS, EYE_CALM, EYE_HOT, SHADOW, OUTLINE_W, RIM_W };

    /* ================================================  TABLE  =========
       fam   : silhouette family (see MOB FAMILIES below)
       role  : melee | ranged | fast | tank | ambush | support | flying | boss | hazard
       pal   : [body, dark, accent] - cold, desaturated bodies, one warm eye
       hw    : drawn height / width ratio target (shape language, §5.1)
       flags : cap (fungal lid), veins (lava seams), spine (ice spines),
               crown (ice crown), plume (knight helm), orbs (rune caster),
               maw (ambush cap), float (hovering spirit), calm (soft flyer) */
    const MOBS = {
        /* --- Levels: Forgotten Crossroads --- */
        slime:        { fam: "dome",   role: "melee",  pal: ["#67c75a", "#2c6029", "#b8ff9a"], hw: .55, flags: { liquid: 1 } },
        beetle:       { fam: "shell",  role: "melee",  pal: ["#6a5c96", "#2b2440", "#c0a9ff"], hw: .45, flags: { split: 1 } },
        mushling:     { fam: "dome",   role: "melee",  pal: ["#c95662", "#7a2c37", "#ffd7d0"], hw: .95, flags: { cap: 1 } },
        /* --- Levels: Mossy Greenpath --- */
        wolf:         { fam: "beast",  role: "fast",   pal: ["#6b7674", "#2f3838", "#cfd8d6"], hw: .62 },
        thorn:        { fam: "turret", role: "ranged", pal: ["#4d9a55", "#215227", "#d7f07b"], hw: 1.15 },
        forestSpirit: { fam: "eye",    role: "support",pal: ["#75c47b", "#2c6335", "#d9ffd0"], hw: .95, flags: { float: 1 } },
        /* --- Levels: Crystal Depths --- */
        bat:          { fam: "wing",   role: "flying", pal: ["#6f5b96", "#2f2547", "#d8c9ff"], hw: .5 },
        rockCrawler:  { fam: "shell",  role: "tank",   pal: ["#72717d", "#34333d", "#b9b6c4"], hw: .5, flags: { boulder: 1 } },
        crystalBug:   { fam: "shell",  role: "fast",   pal: ["#52c4da", "#1f5f6d", "#c8f8ff"], hw: .5, flags: { facet: 1 } },
        /* --- Levels: City of Rain --- */
        cloudSpirit:  { fam: "wing",   role: "flying", pal: ["#e9eefb", "#9fb0c9", "#8fc1e3"], hw: .52, flags: { calm: 1 } },
        stormBird:    { fam: "wing",   role: "fast",   pal: ["#7164bc", "#2c2456", "#cfc4ff"], hw: .42, flags: { bird: 1 } },
        skyEye:       { fam: "eye",    role: "ranged", pal: ["#d65d78", "#6d2537", "#ffd9e2"], hw: .9, flags: { rings: 1 } },
        /* --- Levels: Ashen Basin --- */
        lavaSlime:    { fam: "dome",   role: "melee",  pal: ["#ef5b2f", "#6d2010", "#ffd166"], hw: .55, flags: { liquid: 1, veins: 1 } },
        fireBat:      { fam: "wing",   role: "flying", pal: ["#c9492e", "#5e1d11", "#ffb03a"], hw: .5 },
        magmaBeast:   { fam: "brute",  role: "tank",   pal: ["#71352c", "#341609", "#ff9a4d"], hw: .9, flags: { veins: 1 } },
        /* --- Levels: Pale Peaks --- */
        iceWolf:      { fam: "beast",  role: "fast",   pal: ["#8ccbdf", "#39708a", "#e8fbff"], hw: .62, flags: { spine: 1 } },
        frostBat:     { fam: "wing",   role: "flying", pal: ["#72a9d4", "#2c5578", "#dff4ff"], hw: .5, flags: { frost: 1 } },
        iceGolem:     { fam: "brute",  role: "tank",   pal: ["#7dc7d9", "#2b6377", "#eaffff"], hw: 1.0, flags: { crown: 1 } },
        /* --- Levels: Hollow Castle --- */
        darkMushroom: { fam: "dome",   role: "ambush", pal: ["#733d67", "#33132c", "#ff9ae0"], hw: 1.0, flags: { cap: 1, maw: 1 } },
        knight:       { fam: "sentry", role: "tank",   pal: ["#5f6875", "#272c35", "#c8d2e0"], hw: 1.3, flags: { plume: 1 } },
        magicGuardian:{ fam: "turret", role: "ranged", pal: ["#8a5ed1", "#3a2668", "#e0c9ff"], hw: 1.3, flags: { orbs: 1 } },
        /* --- The Hollow Descent (26/24 px boxes: contrast first) --- */
        crawler:      { fam: "dome",   role: "melee",  pal: ["#49536a", "#1f2531", "#cfe3f0"], hw: .77 },
        flyer:        { fam: "wing",   role: "flying", pal: ["#544c78", "#241f36", "#d0c6ff"], hw: .8 },
        spitter:      { fam: "turret", role: "ranged", pal: ["#41664f", "#1b2f22", "#b8ff9a"], hw: 1.1 },
        warden:       { fam: "warden", role: "boss",   pal: ["#5c5680", "#241d38", "#ff9a7a"], hw: 1.6 }
    };
    const ROLES = ["melee", "ranged", "fast", "tank", "ambush", "support", "flying", "boss", "hazard"];
    const FAMILY_NAMES = ["dome", "shell", "beast", "brute", "wing", "eye", "turret", "sentry", "warden"];

    const FALLBACK = { fam: "dome", role: "melee", pal: ["#7b6a9e", "#332c47", "#cfc4ff"], hw: .6, flags: {} };
    function mobInfo(type) {
        const def = MOBS[type];
        if (!def) return FALLBACK;
        return { pal: def.pal, hw: def.hw || .6, flags: def.flags || {}, fam: def.fam, role: def.role };
    }
    /* Small helper: the body/dark/accent triple for a type. */
    const pal3 = type => (MOBS[type] ? MOBS[type].pal : FALLBACK.pal);

    /* ================================================  CACHE  =========
       One offscreen canvas per unique static shape. Canvas creation is the
       only expensive part, so it happens on first use and never again. */
    const SPR = new Map();
    let SPR_MAX = 220;                       // hard cap: a runaway table can never leak memory

    function sprite(key, w, h, paint) {
        if (!HAS_DOC) return null;
        const hit = SPR.get(key);
        if (hit) return hit;
        if (SPR.size >= SPR_MAX) SPR.clear();       // pathological case: start over once
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
        const c = cv.getContext("2d");
        if (!c) return null;
        paint(c);
        const s = { cv, w: cv.width, h: cv.height };
        SPR.set(key, s);
        return s;
    }

    /* One cached soft-glow sprite for every light in the game (lantern, bench,
       checkpoint, seal, torch). Blitting is ~20x cheaper than shadowBlur and
       keeps the glow identical everywhere. */
    function glow(ctx, x, y, size, alpha) {
        if (!ctx) return;
        const s = sprite("glow:radial", 92, 92, c => {
            const g = c.createRadialGradient(46, 46, 0, 46, 46, 46);
            g.addColorStop(0, "rgba(255,217,168,.62)");
            g.addColorStop(.42, "rgba(242,184,75,.24)");
            g.addColorStop(1, "rgba(242,184,75,0)");
            c.fillStyle = g; c.fillRect(0, 0, 92, 92);
        });
        if (!s) return;
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? .8 : alpha;
        ctx.drawImage(s.cv, x - size / 2, y - size / 2, size, size);
        ctx.restore();
    }

    /* Warm rim light: one cached soft sheen per body height. A gradient that
       fades on every side reads as light falling on the body - a hard bar
       (what this replaced) read as a stray mark on wide silhouettes. */
    function rimSprite(h) {
        h = Math.max(8, Math.min(180, Math.round(h)));
        const W = 18;
        return sprite("rim:" + h, W, h, c => {
            const v = c.createLinearGradient(0, 0, 0, h);
            v.addColorStop(0, "rgba(255,217,168,0)");
            v.addColorStop(.30, "rgba(255,217,168,.50)");
            v.addColorStop(.70, "rgba(255,217,168,.34)");
            v.addColorStop(1, "rgba(255,217,168,0)");
            c.fillStyle = v; c.fillRect(0, 0, W, h);
            const m = c.createLinearGradient(0, 0, W, 0);          // erase both sides
            m.addColorStop(0, "rgba(0,0,0,1)");
            m.addColorStop(.5, "rgba(0,0,0,0)");
            m.addColorStop(1, "rgba(0,0,0,1)");
            c.globalCompositeOperation = "destination-out";
            c.fillStyle = m; c.fillRect(0, 0, W, h);
            c.globalCompositeOperation = "source-over";
        });
    }

    /* ---------- tiny path helpers (roundRect fallback for old browsers) ---------- */
    function rr(c, x, y, w, h, r) {
        r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        c.beginPath();
        if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
    }
    const ellipse = (c, x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, Math.max(.5, rx), Math.max(.5, ry), rot || 0, 0, 7); };
    function poly(c, pts) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }
    /* Ink outline: drawn as a stroke behind/over the fill so shapes stay separate
       from the background even when Scenery darkens them. */
    function ink(c, w) { c.strokeStyle = INK; c.lineWidth = w || OUTLINE_W; c.stroke(); }

    /* ==========================================  MOB FAMILIES  ========
       Every family draws in a local space where (0,0) is the FEET LINE and
       y is negative upwards, x is right of centre. `s` = { w, h, b, d, a,
       f: flags, rnd }. Each family provides:
         core(c, s)   static body  -> cached  |  back/front: dynamic limbs/wings
       Family silhouettes are separated by height:width ratio and leg count. */
    const FAM = {};

    /* --- dome: slimes (liquid) and mushroom caps (stalk + lid) --- */
    FAM.dome = {
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a];
            if (s.f.cap) {                                          // fungal: stalk + lid
                const lid = h * .48, stalk = h - lid, lw = w * .98;
                c.fillStyle = d; rr(c, -w * .16, -stalk, w * .32, stalk, w * .12); c.fill(); ink(c, 1.5);
                c.fillStyle = b; rr(c, -w * .13, -stalk + 1, w * .26, stalk - 1, w * .11); c.fill();
                c.fillStyle = a; c.globalAlpha = .5;                    // gills
                for (let i = -1; i <= 1; i++) { rr(c, i * w * .055 - 1.4, -stalk + 2, 2.8, stalk * .5, 1.4); c.fill(); }
                c.globalAlpha = 1;
                ellipse(c, 0, -h + lid * .42, lw / 2, lid * .72); c.fillStyle = d; c.fill(); ink(c);
                ellipse(c, 0, -h + lid * .38, lw / 2 - 1.5, lid * .62); c.fillStyle = b; c.fill();
                if (s.f.maw) {                                      // ambush cap: dark underside
                    ellipse(c, 0, -stalk, lw * .33, lid * .2); c.fillStyle = INK; c.globalAlpha = .8; c.fill(); c.globalAlpha = 1;
                } else {
                    ellipse(c, -lw * .2, -h + lid * .3, lw * .12, lid * .2); c.fillStyle = "rgba(255,255,255,.30)"; c.fill();
                }
                return;
            }
            const dome = h * .9;                                    // liquid: a tall gelatinous blob
            ellipse(c, 0, -dome * .5 + 1, w * .46, dome * .5); c.fillStyle = d; c.fill(); ink(c);
            ellipse(c, 0, -dome * .52, w * .46 - 1.4, dome * .48); c.fillStyle = b; c.fill();
            c.fillStyle = a; c.globalAlpha = .35;                   // core glow inside
            ellipse(c, 0, -dome * .42, w * .17, dome * .3); c.fill();
            if (s.f.veins) {                                        // lava seams
                c.globalAlpha = .9; c.strokeStyle = a; c.lineWidth = 1.6; c.beginPath();
                c.moveTo(-w * .28, -dome * .28); c.lineTo(-w * .06, -dome * .62); c.lineTo(w * .18, -dome * .34);
                c.moveTo(w * .30, -dome * .16); c.lineTo(w * .12, -dome * .5); c.stroke();
            }
            c.globalAlpha = 1;
            ellipse(c, -w * .18, -dome * .74, w * .1, dome * .12); c.fillStyle = "rgba(255,255,255,.65)"; c.fill();
        },
        back(c, s) {                                                // two stubby feet under the dome
            const w = s.w, h = s.h * .82, sw = Math.sin(s.walk) * 2.5;
            c.fillStyle = INK;
            ellipse(c, -w * .2 + sw, -2, w * .13, 3.2); c.fill();
            ellipse(c, w * .2 - sw, -2, w * .13, 3.2); c.fill();
        },
        eye(c, s) {                                                 // calm round eyes + glint
            const y = -s.h * (s.f.cap ? .62 : .48), dx = s.w * .14;
            c.fillStyle = INK; ellipse(c, -dx, y, 2.6, 3.1); c.fill(); ellipse(c, dx, y, 2.6, 3.1); c.fill();
            c.fillStyle = s.eye; ellipse(c, -dx + .5, y - .6, 1, 1.2); c.fill(); ellipse(c, dx + .5, y - .6, 1, 1.2); c.fill();
        }
    };

    /* --- shell: beetles and crawlers (angular carapace, 6 legs) --- */
    FAM.shell = {
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a], body = h * .8;
            if (s.f.boulder) {                                      // angular boulder: chipped rock, not an egg
                poly(c, [[-w * .5, -body * .12], [-w * .46, -body * .52], [-w * .26, -body * .74],
                         [-w * .1, -body * .98], [w * .16, -body * .9], [w * .4, -body * .72],
                         [w * .5, -body * .34], [w * .44, -body * .04], [w * .1, -body * .02], [-w * .22, -body * .04]]);
                c.fillStyle = d; c.fill(); ink(c);
                poly(c, [[-w * .4, -body * .22], [-w * .36, -body * .56], [-w * .16, -body * .7],
                         [w * .08, -body * .8], [w * .32, -body * .6], [w * .38, -body * .3], [w * .2, -body * .16], [-w * .14, -body * .14]]);
                c.fillStyle = b; c.fill();
                c.fillStyle = "rgba(255,255,255,.18)";               // chipped facets
                poly(c, [[-w * .3, -body * .6], [-w * .12, -body * .7], [-w * .24, -body * .4]]); c.fill();
                poly(c, [[w * .1, -body * .74], [w * .3, -body * .58], [w * .12, -body * .5]]); c.fill();
                c.strokeStyle = INK; c.lineWidth = 1.4;              // fissures
                c.beginPath(); c.moveTo(-w * .28, -body * .34); c.lineTo(-w * .06, -body * .46); c.lineTo(w * .16, -body * .32); c.stroke();
                c.beginPath(); c.moveTo(w * .06, -body * .74); c.lineTo(w * .12, -body * .52); c.stroke();
                return;
            }
            if (s.f.facet) {                                        // crystal bug: a TALL shard cluster
                const shard = (cx, wide, tall, pal) => {            // 3 shards of different heights
                    poly(c, [[cx - wide, 0], [cx - wide * .55, -tall * .72], [cx, -tall], [cx + wide * .55, -tall * .68], [cx + wide, 0]]);
                    c.fillStyle = pal; c.fill(); ink(c, 1.5);
                };
                shard(-w * .24, w * .13, h * .8, d);
                shard(w * .24, w * .12, h * .62, d);
                shard(-w * .02, w * .13, h * 1.0, b);
                poly(c, [[-w * .08, -h * .16], [0, -h * .92], [w * .08, -h * .54], [w * .03, -h * .14]]);
                c.fillStyle = a; c.globalAlpha = .8; c.fill(); c.globalAlpha = 1;   // inner light
                /* a narrow chitin base carrying the shards */
                ellipse(c, 0, -h * .07, w * .3, h * .075);
                c.fillStyle = d; c.fill(); ink(c, 1.5);
                return;
            }
            /* Beetle: FLAT and WIDE - a low carapace carried on splayed
               legs, with a pronotum shield and a head at the front. The
               opposite of a slime's tall dome, on the same screen. */
            const bw = w * .46, ch = h * .30;                           // carapace half width / height
            const cy = -ch - 3.5;                                       // carried low, on the legs
            ellipse(c, 0, cy, bw, ch);                                  // shell
            c.fillStyle = d; c.fill(); ink(c);
            ellipse(c, 0, cy - ch * .12, bw - 1.6, ch - 1.4);           // lit upper plate
            c.fillStyle = b; c.fill();
            c.save();
            ellipse(c, 0, cy - ch * .12, bw - 1.6, ch - 1.4); c.clip();
            c.fillStyle = "rgba(0,0,0,.22)";                            // rim shadow inside the shell
            ellipse(c, 0, cy + ch * .9, bw, ch); c.fill();
            c.fillStyle = a; c.globalAlpha = .55;                       // sheen patch
            ellipse(c, -bw * .38, cy - ch * .42, bw * .32, ch * .3); c.fill();
            c.globalAlpha = 1;
            c.restore();
            c.strokeStyle = INK; c.lineWidth = 1.6;                     // wing-case split
            c.beginPath(); c.moveTo(-bw * .06, cy - ch * .62); c.lineTo(-bw * .06, cy + ch * .74); c.stroke();
            c.strokeStyle = a; c.lineWidth = 1.1; c.globalAlpha = .6;   // case edge lines
            c.beginPath();
            c.moveTo(-bw * .66, cy - ch * .1); c.lineTo(-bw * .34, cy + ch * .62);
            c.moveTo(bw * .6, cy - ch * .12); c.lineTo(bw * .3, cy + ch * .62); c.stroke();
            c.globalAlpha = 1;
            /* pronotum: a smaller shield clipped over the front of the shell */
            ellipse(c, bw * .62, cy - ch * .06, bw * .42, ch * .62);
            c.fillStyle = d; c.fill(); ink(c, 1.4);
            ellipse(c, bw * .58, cy - ch * .2, bw * .28, ch * .38);
            c.fillStyle = b; c.fill();
            /* head: a small box poking out in front, with a mandible */
            /* rim light across the top of the shell (reads on dark floors) */
            c.strokeStyle = "rgba(255,217,168,.5)"; c.lineWidth = 1.6;
            c.beginPath(); c.ellipse(0, cy, bw - 1, ch - 1, 0, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
            const hx = bw * .92, hy = cy + ch * .34;
            rr(c, hx - bw * .2, hy - ch * .16, bw * .44, ch * .34, ch * .12);
            c.fillStyle = d; c.fill(); ink(c, 1.3);
            c.fillStyle = INK;
            ellipse(c, hx + bw * .26, hy + ch * .04, bw * .09, ch * .12); c.fill();
            /* the eye: one bright pinpoint on the head, facing the player */
            c.fillStyle = WHITE; ellipse(c, hx - bw * .02, hy - ch * .04, 1.5, 1.7); c.fill();
            c.fillStyle = INK; ellipse(c, hx + .4, hy - ch * .02, .8, .9); c.fill();
        },
        back(c, s) {                                                // 6 splayed legs: tripod gait + feet
            const w = s.w, ch = s.h * .30, cy = -ch - 3.5, body = cy + ch * .5;
            const g = s.walk, swing = Math.sin(g) * 2.6, cross = Math.sin(g + Math.PI) * 2.6;
            c.strokeStyle = INK; c.lineWidth = 2.6; c.lineCap = "round";
            for (let i = 0; i < 3; i++) {
                const k = i - 1;                                        // -1 rear, 0 middle, +1 front
                const hipX = k * w * .2, footX = k * w * .58;           // feet show outside the shell
                const lift = (i % 2 ? swing : cross);
                c.strokeStyle = s.d; c.beginPath(); c.moveTo(hipX, body); c.lineTo(k * footX + lift, -1.5); c.stroke();
                c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(hipX, body); c.lineTo(k * footX + lift, -1.5); c.stroke();
                c.fillStyle = INK;
                ellipse(c, k * footX + lift, -1.5, 2.7, 2.2); c.fill(); // feet: widen the base
                c.lineWidth = 2.6;
            }
        },
        front(c, s) {                                               // antennae, live sway + front legs
            const w = s.w, ch = s.h * .30, cy = -ch - 3.5, body = cy + ch * .5;
            const g = s.walk, lift = Math.sin(g) * 2.6;
            c.strokeStyle = INK; c.lineWidth = 1.8; c.lineCap = "round";
            c.beginPath(); c.moveTo(w * .2, body); c.lineTo(w * .5 + lift, -2); c.stroke();
            c.beginPath(); c.moveTo(-w * .18, body + 1); c.lineTo(-w * .46 - lift, -2); c.stroke();
            const sway = Math.sin(s.t / 17 + 1) * 1.3;
            const bx = w * .3, by = cy - ch * .5;
            c.strokeStyle = INK; c.lineWidth = 1.6; c.lineCap = "round";
            c.beginPath();
            c.moveTo(bx - 2, by); c.lineTo(bx + 5, by - 6 + sway);
            c.moveTo(bx + .5, by + 2); c.lineTo(bx + 8, by - 3 + sway * .8);
            c.stroke();
            c.fillStyle = s.a;
            ellipse(c, bx + 5, by - 6 + sway, 1.5, 1.5); c.fill();
            ellipse(c, bx + 8, by - 3 + sway * .8, 1.3, 1.3); c.fill();
        },
        eye(c, s) {
            if (!s.f.facet && !s.f.boulder) return;          // the beetle draws its own eye
            const y = -s.h * .5, dx = s.w * .2;
            c.fillStyle = s.f.facet ? s.a : WHITE; ellipse(c, -dx, y, 2.2, 2.6); c.fill(); ellipse(c, dx, y, 2.2, 2.6); c.fill();
            c.fillStyle = INK; ellipse(c, -dx, y + .4, 1.1, 1.4); c.fill(); ellipse(c, dx, y + .4, 1.1, 1.4); c.fill();
        }
    };

    /* --- beast: wolves. Long quadruped, pointed muzzle, ears, tail --- */
    FAM.beast = {
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a], body = h * .58, bY = -h * .46;
            poly(c, [[-w * .42, bY - body * .1], [-w * .3, bY - body * .9], [0, bY - body], [w * .3, bY - body * .85], [w * .46, bY - body * .2], [w * .34, bY + body * .55], [-w * .3, bY + body * .55]]);
            c.fillStyle = d; c.fill(); ink(c);
            poly(c, [[-w * .36, bY - body * .18], [-w * .26, bY - body * .8], [0, bY - body * .88], [w * .26, bY - body * .76], [w * .38, bY - body * .2], [w * .28, bY + body * .45], [-w * .26, bY + body * .45]]);
            c.fillStyle = b; c.fill();
            poly(c, [[w * .3, bY - body * .7], [w * .56, bY - body * .55], [w * .52, bY - body * .18], [w * .3, bY - body * .2]]);   // muzzle
            c.fillStyle = b; c.fill(); ink(c, 1.6);
            c.fillStyle = INK; ellipse(c, w * .54, bY - body * .3, 1.6, 1.6); c.fill();                                            // nose
            poly(c, [[-w * .18, bY - body * .82], [-w * .22, bY - body * 1.5], [-w * .02, bY - body * .95]]);                      // ears
            c.fillStyle = d; c.fill(); ink(c, 1.5);
            poly(c, [[w * .02, bY - body * .9], [w * .1, bY - body * 1.5], [w * .24, bY - body * .82]]);
            c.fillStyle = d; c.fill(); ink(c, 1.5);
            if (s.f.spine) { c.fillStyle = a; c.globalAlpha = .95;                                                                 // ice spines
                for (let i = -1; i <= 1; i++) { poly(c, [[i * w * .16 - 3, bY - body * .82], [i * w * .16, bY - body * 1.42], [i * w * .16 + 3, bY - body * .8]]); c.fill(); }
                c.globalAlpha = 1; }
            c.fillStyle = "rgba(255,255,255,.14)"; ellipse(c, -w * .06, bY - body * .74, w * .2, body * .16); c.fill();
        },
        back(c, s) {                                                // 4 legs + tail
            const w = s.w, h = s.h, body = h * .58, bY = -h * .46 + body * .5;
            const sw = Math.sin(s.walk) * 3, cr = Math.sin(s.walk + Math.PI) * 3;
            c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = "round";
            c.beginPath();
            c.moveTo(-w * .3, bY); c.lineTo(-w * .3 + sw, 0);
            c.moveTo(-w * .14, bY); c.lineTo(-w * .14 + cr, 0);
            c.moveTo(w * .18, bY); c.lineTo(w * .18 + cr, 0);
            c.moveTo(w * .34, bY); c.lineTo(w * .34 + sw, 0);
            c.stroke();
            c.strokeStyle = s.d; c.lineWidth = 2; c.lineCap = "butt";
            c.beginPath(); c.moveTo(-w * .42, bY - body * .3); c.quadraticCurveTo(-w * .62, bY - body * .8, -w * .5, bY - body * 1.1 - Math.sin(s.walk) * 2); c.stroke();
        },
        eye(c, s) {
            c.fillStyle = s.eye; ellipse(c, s.w * .42, -s.h * .58, 2.2, 2.4); c.fill();
            c.fillStyle = INK; ellipse(c, s.w * .43, -s.h * .58, 1, 1.6); c.fill();
        }
    };

    /* --- brute: hunched bulk, big shoulders, small head (tanks) --- */
    FAM.brute = {
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a];
            poly(c, [[-w * .46, 0], [-w * .48, -h * .45], [-w * .34, -h * .82], [-w * .06, -h * .9], [w * .3, -h * .8], [w * .44, -h * .42], [w * .42, 0]]);
            c.fillStyle = d; c.fill(); ink(c);
            poly(c, [[-w * .38, -h * .04], [-w * .4, -h * .44], [-w * .28, -h * .74], [-w * .04, -h * .8], [w * .26, -h * .72], [w * .36, -h * .4], [w * .34, -h * .04]]);
            c.fillStyle = b; c.fill();
            c.fillStyle = d; ellipse(c, w * .2, -h * .86, w * .17, h * .12); c.fill(); ink(c, 1.6);       // small head
            c.fillStyle = s.eye; ellipse(c, w * .26, -h * .88, 1.8, 2); c.fill();
            if (s.f.veins) {                                                                              // molten seams
                c.strokeStyle = a; c.lineWidth = 1.8; c.globalAlpha = .85;
                c.beginPath(); c.moveTo(-w * .3, -h * .18); c.lineTo(-w * .14, -h * .5); c.lineTo(w * .04, -h * .26); c.lineTo(w * .2, -h * .56); c.stroke();
                c.globalAlpha = 1;
            }
            if (s.f.crown) {                                                                              // ice crown
                c.fillStyle = a;
                for (let i = -2; i <= 2; i++) poly(c, [[i * w * .1 - 3, -h * .92], [i * w * .1, -h * (1.06 + Math.abs(i) * -.04)], [i * w * .1 + 3, -h * .92]]), c.fill();
            }
            c.fillStyle = "rgba(255,255,255,.12)"; ellipse(c, -w * .1, -h * .66, w * .22, h * .06); c.fill();
        },
        back(c, s) {                                                                                      // two heavy arms + feet
            const w = s.w, h = s.h, sw = Math.sin(s.walk) * 2;
            c.strokeStyle = INK; c.lineWidth = 5; c.lineCap = "round";
            c.beginPath(); c.moveTo(-w * .4, -h * .7); c.lineTo(-w * .5 - sw, -h * .1); c.stroke();
            c.beginPath();
            c.moveTo(w * .38, -h * .68); c.lineTo(w * .5 + sw, -h * .12); c.stroke();
            c.fillStyle = INK; ellipse(c, -w * .2, -2.5, w * .14, 3.4); c.fill(); ellipse(c, w * .2, -2.5, w * .14, 3.4); c.fill();
        },
        eye() {}
    };

    /* --- wing: bats, birds, puffs. Wide thin wings, small body --- */
    FAM.wing = {
        back(c, s) {                                              // wings behind the body
            const w = s.w, h = s.h, flap = Math.sin(s.walk) * .55;
            c.fillStyle = s.f.calm ? s.b : s.d;
            for (const dir of [-1, 1]) {
                c.save(); c.translate(dir * w * .18, -h * .62); c.rotate(dir * (.35 - flap * (s.f.calm ? .5 : 1)));
                if (s.f.bird) poly(c, [[0, 0], [dir * w * .62, -h * .1], [dir * w * .5, h * .12], [0, h * .1]]);
                else poly(c, [[0, 0], [dir * w * .58, -h * .18], [dir * w * .44, h * .18], [0, h * .12]]);
                c.fill(); ink(c, 1.6); c.restore();
            }
        },
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a];
            if (s.f.calm) {                                       // soft puff: rounded, tail droops
                ellipse(c, 0, -h * .6, w * .3, h * .28); c.fillStyle = d; c.fill(); ink(c);
                ellipse(c, 0, -h * .62, w * .28, h * .25); c.fillStyle = b; c.fill();
                ellipse(c, -w * .2, -h * .72, w * .12, h * .1); c.fillStyle = a; c.globalAlpha = .55; c.fill(); c.globalAlpha = 1;
                return;
            }
            poly(c, [[-w * .22, -h * .75], [w * .22, -h * .78], [w * .18, -h * .38], [0, -h * .3], [-w * .18, -h * .38]]);
            c.fillStyle = d; c.fill(); ink(c, 1.6);
            poly(c, [[-w * .18, -h * .72], [w * .18, -h * .74], [w * .14, -h * .44], [0, -h * .37], [-w * .14, -h * .44]]);
            c.fillStyle = b; c.fill();
            if (s.f.bird) { poly(c, [[-w * .1, -h * .3], [0, -h * .05], [w * .16, -h * .32]]); c.fillStyle = a; c.fill(); }   // forked tail
            else { c.fillStyle = d; poly(c, [[-w * .1, -h * .34], [0, -h * .12], [w * .12, -h * .34]]); c.fill(); }
            if (s.f.frost) { c.fillStyle = a; c.globalAlpha = .8;
                for (let i = -1; i <= 1; i++) poly(c, [[i * w * .12, -h * .78], [i * w * .12 + 2, -h * .96], [i * w * .12 + 5, -h * .78]]), c.fill();
                c.globalAlpha = 1; }
        },
        eye(c, s) {
            const y = -s.h * .66, dx = s.w * .08;
            c.fillStyle = s.f.calm ? INK : s.eye; ellipse(c, -dx, y, 2, 2.4); c.fill(); ellipse(c, dx, y, 2, 2.4); c.fill();
            c.fillStyle = INK; if (s.f.calm) { ellipse(c, -dx, y, .9, 1.2); c.fill(); ellipse(c, dx, y, .9, 1.2); c.fill(); }
        }
    };

    /* --- eye: a single huge eye (ranged) or a hovering wisp (support) --- */
    FAM.eye = {
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a];
            if (s.f.float) {                                       // wisp: teardrop body, open bottom
                poly(c, [[-w * .2, -h * .1], [-w * .3, -h * .55], [-w * .12, -h * .9], [w * .12, -h * .9], [w * .3, -h * .55], [w * .2, -h * .1], [0, -h * .02]]);
                c.fillStyle = d; c.fill(); ink(c);
                poly(c, [[-w * .14, -h * .18], [-w * .22, -h * .54], [-w * .08, -h * .82], [w * .08, -h * .82], [w * .22, -h * .54], [w * .14, -h * .18], [0, -h * .1]]);
                c.fillStyle = b; c.fill();
                c.fillStyle = a; c.globalAlpha = .8; ellipse(c, 0, -h * .5, w * .1, h * .14); c.fill(); c.globalAlpha = 1;
                return;
            }
            ellipse(c, 0, -h * .58, w * .42, h * .42); c.fillStyle = d; c.fill(); ink(c);
            ellipse(c, 0, -h * .58, w * .38, h * .38); c.fillStyle = b; c.fill();
            ellipse(c, 0, -h * .58, w * .22, h * .24); c.fillStyle = WHITE; c.fill();
            ellipse(c, w * .04, -h * .57, w * .1, h * .12); c.fillStyle = INK; c.fill();     // pupil
            ellipse(c, w * .07, -h * .61, w * .035, h * .04); c.fillStyle = "rgba(255,255,255,.9)"; c.fill();
            c.strokeStyle = d; c.lineWidth = 2;                                               // lashes
            for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * w * .14, -h * .88); c.lineTo(i * w * .17, -h * 1.04); c.stroke(); }
        },
        back(c, s) {
            if (!s.f.float) return;
            c.fillStyle = s.a; c.globalAlpha = .5;                 // drifting motes
            for (let i = 0; i < 2; i++) { const a = s.t / 26 + i * 3.1; ellipse(c, Math.cos(a) * s.w * .42, -s.h * .5 + Math.sin(a) * 5, 2.2, 2.2); c.fill(); }
            c.globalAlpha = 1;
        },
        eye() {}
    };

    /* --- turret: rooted stalk + pod (ranged), robe + rune orbs (caster) --- */
    FAM.turret = {
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a];
            if (s.f.orbs) {                                        // hooded caster
                poly(c, [[-w * .28, 0], [-w * .34, -h * .55], [-w * .18, -h * .84], [0, -h * .92], [w * .18, -h * .84], [w * .34, -h * .55], [w * .28, 0]]);
                c.fillStyle = d; c.fill(); ink(c);
                poly(c, [[-w * .22, -h * .06], [-w * .27, -h * .54], [-w * .12, -h * .78], [0, -h * .84], [w * .12, -h * .78], [w * .27, -h * .54], [w * .22, -h * .06]]);
                c.fillStyle = b; c.fill();
                c.fillStyle = INK; ellipse(c, 0, -h * .6, w * .17, h * .2); c.fill();        // hood shadow
                c.fillStyle = a; ellipse(c, 0, -h * .6, w * .05, h * .06); c.fill();         // rune eye
                c.strokeStyle = a; c.lineWidth = 1.4; c.globalAlpha = .7;
                for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-w * .3 + i * w * .3, -h * .2); c.lineTo(-w * .26 + i * w * .3, -h * .06); c.stroke(); }
                c.globalAlpha = 1;
                return;
            }
            const pod = h * .42;                                   // thorn pod on a stalk
            c.fillStyle = d; rr(c, -w * .07, -h + pod, w * .14, h - pod, 3); c.fill(); ink(c, 1.5);   // stalk
            c.fillStyle = b; rr(c, -w * .05, -h + pod + 1, w * .1, h - pod, 2.5); c.fill();
            ellipse(c, 0, -h + pod * .42, w * .34, pod * .46); c.fillStyle = d; c.fill(); ink(c);     // pod
            ellipse(c, 0, -h + pod * .42, w * .3, pod * .4); c.fillStyle = b; c.fill();
            c.fillStyle = a; ellipse(c, w * .12, -h + pod * .5, w * .11, pod * .18); c.fill();        // glowing sac
            c.fillStyle = "rgba(255,255,255,.2)"; ellipse(c, -w * .12, -h + pod * .3, w * .08, pod * .1); c.fill();
        },
        back(c, s) {                                               // leaves / robe hem
            const w = s.w, h = s.h;
            c.fillStyle = s.d; c.globalAlpha = .85;
            for (const dir of [-1, 1]) { poly(c, [[dir * w * .1, -h * .12], [dir * w * .48, -h * .3], [dir * w * .16, -h * .02]]); c.fill(); }
            c.globalAlpha = 1;
        },
        front(c, s) {                                              // rune orbs orbit the caster
            if (!s.f.orbs) return;
            for (let i = 0; i < 3; i++) {
                const a = s.t / 30 + i * 2.1, x = Math.cos(a) * s.w * .46, y = -s.h * .58 + Math.sin(a) * s.h * .16;
                c.fillStyle = s.a; c.globalAlpha = .9; ellipse(c, x, y, 3, 3); c.fill(); c.globalAlpha = 1;
            }
        },
        eye(c, s) { if (s.f.orbs) return;
            c.fillStyle = s.eye; ellipse(c, s.w * .1, -s.h * .62, 2.4, 2.6); c.fill();
            c.fillStyle = INK; ellipse(c, s.w * .11, -s.h * .62, 1, 1.5); c.fill();
        }
    };

    /* --- sentry: upright knight. Helm, plume, tall shield, sword --- */
    FAM.sentry = {
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a];
            poly(c, [[-w * .3, 0], [-w * .34, -h * .5], [-w * .26, -h * .78], [0, -h * .84], [w * .26, -h * .78], [w * .34, -h * .5], [w * .3, 0]]);
            c.fillStyle = d; c.fill(); ink(c);
            poly(c, [[-w * .24, -h * .04], [-w * .28, -h * .5], [-w * .2, -h * .72], [0, -h * .78], [w * .2, -h * .72], [w * .28, -h * .5], [w * .24, -h * .04]]);
            c.fillStyle = b; c.fill();
            c.fillStyle = d; rr(c, -w * .2, -h * .96, w * .4, h * .2, w * .05); c.fill(); ink(c);       // helm
            c.fillStyle = INK; rr(c, -w * .14, -h * .88, w * .28, h * .07, 2); c.fill();               // visor slit
            c.fillStyle = a; ellipse(c, w * .06, -h * .85, 2.4, 2.4); c.fill();                          // eye light
            if (s.f.plume) { c.fillStyle = a; c.globalAlpha = .95;
                poly(c, [[-w * .04, -h * .98], [-w * .1 - 3, -h * 1.22], [w * .02, -h * 1.04], [w * .1, -h * 1.2], [w * .1, -h * .96]]); c.fill(); c.globalAlpha = 1; }
            c.strokeStyle = INK; c.lineWidth = 1.6;                                                      // shield + strap
            rr(c, -w * .46, -h * .62, w * .22, h * .48, 3); c.fillStyle = b; c.fill(); c.stroke();
            c.strokeStyle = a; c.globalAlpha = .6; rr(c, -w * .41, -h * .57, w * .12, h * .38, 2); c.stroke(); c.globalAlpha = 1;
        },
        back(c, s) {                                                // cape + sword arm + boots
            const w = s.w, h = s.h, sw = Math.sin(s.walk) * 3;
            c.fillStyle = s.d; c.globalAlpha = .9;
            poly(c, [[-w * .3, -h * .72], [-w * .5, -h * .1], [-w * .22, -h * .18]]); c.fill(); c.globalAlpha = 1;
            c.strokeStyle = INK; c.lineWidth = 3.4; c.lineCap = "round";
            c.beginPath(); c.moveTo(w * .3, -h * .6); c.lineTo(w * .42 + sw, -h * .18); c.stroke();
            c.strokeStyle = WHITE; c.lineWidth = 2;
            c.beginPath(); c.moveTo(w * .42 + sw, -h * .22); c.lineTo(w * .5 + sw, -h * .62); c.stroke();
            c.fillStyle = INK; ellipse(c, -w * .16, -2.5, w * .12, 3.4); c.fill(); ellipse(c, w * .16, -2.5, w * .12, 3.4); c.fill();
        },
        eye() {}
    };

    /* --- warden: the Hollow Warden (boss). Iron slabs, tall helm, horns. --- */
    FAM.warden = {
        core(c, s) {
            const w = s.w, h = s.h, [b, d, a] = [s.b, s.d, s.a];
            rr(c, -w * .38, -h * .74, w * .76, h * .74, w * .06); c.fillStyle = b; c.fill(); ink(c);
            rr(c, -w * .3, -h * .68, w * .6, h * .62, w * .05); c.fillStyle = d; c.globalAlpha = .5; c.fill(); c.globalAlpha = 1;
            rr(c, -w * .3, -h, w * .6, h * .3, w * .07); c.fillStyle = b; c.fill(); ink(c);               // helm
            poly(c, [[-w * .26, -h], [-w * .5, -h * 1.34], [-w * .14, -h * 1.06]]); c.fillStyle = d; c.fill(); ink(c, 1.6);
            poly(c, [[w * .36, -h], [w * .6, -h * 1.34], [w * .24, -h * 1.06]]); c.fillStyle = d; c.fill(); ink(c, 1.6);
            c.fillStyle = INK; rr(c, -w * .22, -h * .84, w * .44, h * .08, 2); c.fill();
            c.fillStyle = a; c.fillRect(w * .04, -h * .84, w * .14, h * .08);                             // eye
            /* Brass keeper's trim: the boss reads at a glance, warm against
               the cold iron, and it echoes the bench and Old Wick. */
            c.fillStyle = BRASS; rr(c, -w * .36, -h * .96, w * .72, h * .045, 2); c.fill();
            rr(c, -w * .2, -h * .58, w * .4, h * .03, 1.5); c.fill();
            c.strokeStyle = a; c.lineWidth = 2; c.globalAlpha = .8;
            c.beginPath(); c.moveTo(-w * .2, -h * .3); c.lineTo(0, -h * .12); c.lineTo(-w * .12, h * -.02); c.stroke(); c.globalAlpha = 1;
        },
        back(c, s) {
            const w = s.w, h = s.h, sw = Math.sin(s.walk) * 4;
            c.strokeStyle = INK; c.lineWidth = 7; c.lineCap = "round";
            c.beginPath(); c.moveTo(-w * .4, -h * .6); c.lineTo(-w * .5 - sw, -h * .06); c.stroke();
            c.beginPath(); c.moveTo(w * .4, -h * .6); c.lineTo(w * .5 + sw, -h * .06); c.stroke();
            c.fillStyle = INK; ellipse(c, -w * .2, -3, w * .14, 4); c.fill(); ellipse(c, w * .2, -3, w * .14, 4); c.fill();
        },
        eye() {}
    };

    /* ================================================  MOBS  =========
       drawMob: the one entry point both game modes use.
       o = { x, y|feet, w, h, face, t, walk, state, flash, alpha, squash,
             windup (0..1), hurt (0..1), dead (0..1), stun, ground (bool) } */
    function drawMob(ctx, type, o) {
        if (!ctx || !o) return;
        const info = mobInfo(type), fam = FAM[info.fam] || FAM.dome;
        const pal = info.pal, w = o.w || 40, h = o.h || 40;
        const feet = (o.feet !== undefined) ? o.feet : (o.y + h);
        const face = o.face === -1 ? -1 : 1;
        const t = o.t || 0, walk = o.walk || 0;

        /* contact shadow (grounded things only) */
        if (o.ground !== false) {
            ctx.save();
            ctx.fillStyle = SHADOW;
            ellipse(ctx, o.x + w / 2, feet - 2, w * .46, Math.max(2.5, w * .1)); ctx.fill();
            ctx.restore();
        }

        const hot = !!(o.alert || o.phase2);
        const s = { w, h, b: pal[0], d: pal[1], a: pal[2], eye: hot ? EYE_HOT : EYE_CALM, f: info.flags, walk, t, state: o.state };

        ctx.save();
        ctx.translate(o.x + w / 2, feet);
        if (face < 0) ctx.scale(-1, 1);
        if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
        const sq = o.squash || 0;
        if (sq) ctx.scale(1 + sq * .5, 1 - sq * .5);

        /* Idle life: a 2 % breath squash keeps even a still silhouette moving. */
        const breath = o.dead ? 0 : Math.sin(t / 34 + (o.seed || 0)) * .022;
        if (breath) ctx.scale(1 + breath, 1 - breath);

        /* Static body core: rendered once per type/size, then blitted. */
        /* hot = "has noticed you / phase 2": its eye colour is part of the
           cached sprite, so it must be part of the key. */
        const key = "mob:" + type + ":" + Math.round(w) + "x" + Math.round(h) + (hot ? ":hot" : "");
        const spr = sprite(key, w + PAD * 2, h + PAD * 2, c => {
            c.translate(PAD + w / 2, PAD + h);
            fam.core(c, { ...s, walk: 0, t: 0 });
            fam.eye(c, s);
        });
        /* Dynamic layers: wings and tails sit behind the body, orbs and limbs
           in front, so their timing can be smooth at any frame rate. */
        if (fam.back) fam.back(ctx, s);
        if (spr) ctx.drawImage(spr.cv, -(w / 2 + PAD), -(h + PAD));
        else { fam.core(ctx, s); fam.eye(ctx, s); }
        if (fam.front) fam.front(ctx, s);
        /* Warm rim light on the facing side: what survives the darkness pass. */
        if (!o.flash && !o.dead) {
            const sh = rimSprite(h);
            if (sh) {
                ctx.globalAlpha *= .9;
                ctx.drawImage(sh.cv, -sh.w / 2 + w * .32, -h * .80);
                ctx.globalAlpha = 1;
            }
        }
        /* "noticed you" pop: one short cue when a mob first spots the player,
           so awareness itself is a tell and not just an eye colour. */
        if (o.notice) {
            const k = Math.max(0, Math.min(1, o.notice));
            const pop = 1 + (1 - k) * .55;
            ctx.save();
            ctx.globalAlpha = .25 + .75 * k;
            ctx.translate(0, -h - 9 - (1 - k) * 3);
            ctx.scale(pop, pop);
            ctx.fillStyle = INK; rr(ctx, -1.9, -8.6, 3.8, 9.4, 1.9); ctx.fill();
            ctx.fillStyle = EYE_HOT; rr(ctx, -1.2, -7.8, 2.4, 7.6, 1.2); ctx.fill();
            ctx.fillStyle = INK; ellipse(ctx, 0, 1.6, 1.9, 1.9); ctx.fill();
            ctx.fillStyle = EYE_HOT; ellipse(ctx, 0, 1.5, 1.1, 1.1); ctx.fill();
            ctx.restore();
        }
        /* attack tell: the shape brightens and grows a hot rim */
        if (o.windup) {
            ctx.globalAlpha = .35 + .45 * o.windup;
            ctx.strokeStyle = DANGER; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.ellipse(0, -h * .5, w * .56, h * .56, 0, 0, 7); ctx.stroke();
            ctx.globalAlpha = 1;
        }
        if (o.stun) {
            ctx.fillStyle = GOLD;
            for (let i = 0; i < 3; i++) { const a2 = t / 10 + i * 2.1; ellipse(ctx, Math.cos(a2) * 12, -h - 8 + Math.sin(a2) * 3, 2.2, 2.2); ctx.fill(); }
        }
        if (o.phase2) {                                      // phase 2: cracks + a hot pulse
            ctx.save();
            ctx.strokeStyle = EYE_HOT;
            ctx.globalAlpha = .45 + Math.sin(t / 11) * .18;
            ctx.lineWidth = 2; ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(-w * .24, -h * .34); ctx.lineTo(-w * .04, -h * .16); ctx.lineTo(-w * .16, -h * .02);
            ctx.moveTo(w * .18, -h * .62); ctx.lineTo(w * .32, -h * .44);
            ctx.stroke();
            ctx.restore();
        }
        if (o.flash) {                                       // white hit flash (shape preserved)
            ctx.globalAlpha = Math.min(.85, o.flash);
            ctx.fillStyle = WHITE;
            ctx.beginPath(); ctx.ellipse(0, -h * .5, w * .52, h * .5, 0, 0, 7); ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    /* ================================================  VESSEL  ========
       The player character: "Milo, the Lantern Vessel". Wide moth cap with
       antennae (1), teardrop cloak with a split hem (2), lantern held
       forward (3) - the three cues that survive a solid-black fill test.
       o = { x, y, w, h, hero:{color,secondary}, face, t, walk (phase),
             air (bool), vy, dash, attack (0..1), hurt (0..1), heal (0..1),
             dead (0..1), blink (bool), sit, simple (quality: skip tiny details) } */
    function drawVessel(ctx, o) {
        if (!ctx || !o) return;
        const w = o.w || 44, h = o.h || 64;
        const hero = o.hero || {}, cape = hero.color || "#d94f65", mantle = hero.secondary || "#8f2940";
        const face = o.face === -1 ? -1 : 1, t = o.t || 0, walk = o.walk || 0;
        const simple = o.simple === true;
        const dead = o.dead || 0;

        /* breathing + gait */
        const air = !!o.air, dashing = (o.dash || 0) > 0, climbing = (o.climb || 0) > 0;
        const breath = air ? 0 : climbing ? Math.sin(t / 32) * .8 : Math.sin(t / 32) * 1.2;
        const bob = air ? 0 : climbing ? Math.abs(Math.sin(t / 7)) * 1.1 : Math.abs(Math.sin(walk)) * 1.4;
        const legA = air ? -2 : climbing ? Math.sin(t / 7) * 4.5 : Math.sin(walk) * 5;
        const legB = air ? 2 : climbing ? -Math.sin(t / 7) * 4.5 : -Math.sin(walk) * 5;
        const sway = Math.sin(t / 40) * 1.4;
        const lean = dashing ? .16 : climbing ? .1 : (air ? Math.max(-.12, Math.min(.12, (o.vy || 0) / 90)) : 0);
        const stretch = air ? (o.vy < 0 ? 1.07 : 1.04) : 1;

        /* shadow: shrinks while airborne (and on ladders) so height reads */
        ctx.save();
        ctx.fillStyle = SHADOW;
        const sc = (air || climbing) ? Math.max(.4, 1 - Math.abs(o.y - (o.groundY || o.y)) / 400) : 1;
        ellipse(ctx, o.x + w / 2, (o.groundY || o.y + h) - 3, w * .34 * sc, 4 * sc); ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(o.x + w / 2, o.y + h);
        ctx.globalAlpha = 1 - dead * .35;
        ctx.rotate(face * lean * .6);
        ctx.scale(face, 1);
        ctx.scale(1 / stretch, stretch);
        ctx.scale(1 + (o.squash || 0) * .5, 1 - (o.squash || 0) * .5);

        const hy = -h;                                   /* handy: top of the hitbox */
        const capY = hy + 12 + breath + bob * .4;        /* cap centre */
        const bodyY = hy + 26 + breath * .6 + bob;       /* shoulders */
        const hemY = -18 - bob;                          /* cloak hem */

        /* --- cloak tail, behind everything, lags on movement --- */
        const trailing = Math.max(-6, Math.min(6, -(o.vx || 0) * .55));
        ctx.fillStyle = mantle;
        poly(ctx, [[-6, bodyY], [-12, hemY], [-16 - trailing, hemY + 4], [-10 - trailing * .6, hemY - 12], [-4, bodyY - 10]]);
        ctx.fill();
        ink(ctx, 1.4);

        /* --- legs + boots --- */
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-5, hemY + 6); ctx.lineTo(-5 + legA, 0);
        ctx.moveTo(6, hemY + 6); ctx.lineTo(6 + legB, 0);
        ctx.stroke();
        ctx.fillStyle = "#3a2a26";
        rr(ctx, -10 + legA, -7, 11, 7, 3); ctx.fill();
        rr(ctx, 1 + legB, -7, 11, 7, 3); ctx.fill();

        /* --- cloak (teardrop with a split hem) --- */
        ctx.fillStyle = cape;
        poly(ctx, [[-11, bodyY], [-15 + sway * .4, hemY + 6], [-7, hemY + 2], [0, hemY + 8], [7, hemY + 2], [15 - sway * .4, hemY + 6], [11, bodyY]]);
        ctx.fill(); ink(ctx);
        /* hem lining + ladder stitch (detail 1) */
        ctx.fillStyle = mantle; ctx.globalAlpha = .85;
        ctx.fillRect(-13, hemY + 1, 26, 4); ctx.globalAlpha = 1;
        if (!simple) {
            ctx.strokeStyle = RIM; ctx.globalAlpha = .45; ctx.lineWidth = 1;
            for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 6 - 1.5, hemY + 1); ctx.lineTo(i * 6 - 1.5, hemY + 5); ctx.stroke(); }
            ctx.globalAlpha = 1;
        }

        /* --- shoulders / mantle --- */
        ctx.fillStyle = mantle;
        rr(ctx, -13, bodyY - 10, 26, 16, 7); ctx.fill(); ink(ctx);
        if (!simple) {                                   /* clasp bell (detail 2) */
            ctx.fillStyle = BRASS; ellipse(ctx, 2, bodyY - 1, 2.6, 2.6); ctx.fill(); ink(ctx, 1);
        }

        /* --- face under the cap brim --- */
        ctx.fillStyle = CREAM;
        rr(ctx, -9, hy + 15 + breath * .6, 18, 14, 6); ctx.fill();
        ctx.fillStyle = INK;
        const eyeY = hy + 22 + breath * .6;
        const blink = o.blink;
        if (blink) { ctx.fillRect(-6, eyeY, 5, 1.6); ctx.fillRect(2, eyeY, 5, 1.6); }
        else { rr(ctx, -6, eyeY - 2, 3.4, 4.6, 1.6); ctx.fill(); rr(ctx, 2.6, eyeY - 2, 3.4, 4.6, 1.6); ctx.fill(); }

        /* --- moth cap: wide dome, front brim dip, antennae (cue 2) --- */
        const capW = 17, capH = 9.5;
        ctx.fillStyle = cape;
        ctx.beginPath();
        ctx.ellipse(1.5, capY, capW, capH, 0, Math.PI * 1.02, Math.PI * 1.98);   // dome
        ctx.lineTo(capW + 1, capY + 2 + 2.5); ctx.lineTo(-capW - 1, capY + 2 - 2.5);  // brim edge (dips forward)
        ctx.closePath(); ctx.fill(); ink(ctx);
        ctx.fillStyle = mantle;                                   /* brim shadow band */
        ctx.globalAlpha = .7; rr(ctx, -capW, capY + 1, capW * 2, 3.5, 2); ctx.fill(); ctx.globalAlpha = 1;
        if (!simple) { ellipse(ctx, -6, capY - 3.4, 3.4, 2.2); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fill(); }  // pale patch (3)
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = "round";
        const ant = Math.sin(t / 26) * 1.6 + (air ? -1.5 : climbing ? -1 : 0);
        ctx.beginPath();
        ctx.moveTo(-3, capY - capH + 1); ctx.quadraticCurveTo(-6, capY - capH - 6, -9 - ant, capY - capH - 9 - ant);
        ctx.moveTo(5, capY - capH + 1); ctx.quadraticCurveTo(8, capY - capH - 6, 11 + ant, capY - capH - 8 - ant);
        ctx.stroke();
        ctx.fillStyle = cape; ellipse(ctx, -9 - ant, capY - capH - 9 - ant, 2, 2); ctx.fill();
        ellipse(ctx, 11 + ant, capY - capH - 8 - ant, 2, 2); ctx.fill();

        /* --- lantern arm + lantern held forward (cue 1: facing) --- */
        const lantX = 13, lantY = bodyY + 10 - bob * .6, swing = Math.sin(t / 24 + 1) * (air ? 2.2 : 1.2);
        const atk = o.attack || 0;
        const armX = 11 + atk * 6, armY = bodyY - 2 - atk * 6 + swing * .6;
        ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(9, bodyY - 4); ctx.lineTo(armX, armY + 4); ctx.stroke();
        ctx.strokeStyle = CREAM; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(9, bodyY - 5); ctx.lineTo(armX, armY + 4); ctx.stroke();
        /* cord (detail 5) */
        ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(armX, armY + 4); ctx.lineTo(lantX + 1, lantY - 8 + swing); ctx.stroke();
        /* lantern glow: one cached sprite, never shadowBlur */
        const flick = 1 + Math.sin(t / 7) * .04 + Math.sin(t / 3.3) * .02;
        glow(ctx, lantX + 1, lantY + swing, 96 * flick, .9);
        ctx.save();
        ctx.translate(lantX, lantY + swing); ctx.rotate(Math.sin(t / 30) * .16 + lean * .5);
        ctx.fillStyle = BRASS; rr(ctx, -6, -9, 12, 14, 2.5); ctx.fill(); ink(ctx, 1.6);      // frame
        ctx.fillStyle = "#2b2016"; rr(ctx, -4, -7, 8, 11, 1.5); ctx.fill();                   // glass well
        ctx.fillStyle = GOLD; ellipse(ctx, 0, -1, 2.6 * flick, 4 * flick); ctx.fill();        // flame
        ctx.fillStyle = RIM; ellipse(ctx, 0, -2, 1.1, 1.8); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(6, -9); ctx.stroke();                 // hood
        if (!simple) { ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(3, -12); ctx.stroke(); } // wick (4)
        ctx.restore();

        /* --- warm rim light on the facing side (survives the darkness pass) --- */
        ctx.strokeStyle = RIM; ctx.globalAlpha = .5 + (o.heal || 0) * .35; ctx.lineWidth = RIM_W;
        ctx.beginPath();
        ctx.ellipse(3, capY, capW + .6, capH + .6, 0, Math.PI * 1.35, Math.PI * 1.98);
        ctx.stroke();
        ctx.globalAlpha = 1;

        /* --- hurt / heal overlays --- */
        if (o.hurt) {
            ctx.globalAlpha = o.hurt * .75; ctx.fillStyle = WHITE;
            rr(ctx, -16, hy + 8, 32, h - 12, 10); ctx.fill(); ctx.globalAlpha = 1;
        }
        if (o.heal) {
            ctx.globalAlpha = o.heal * .8; ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, -h * .5, 18 + (1 - o.heal) * 16, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.restore();

        /* --- attack arc (drawn unmirrored so it always sweeps forward) --- */
        if (atk > 0) {
            ctx.save();
            ctx.translate(o.x + w / 2 + face * 16, o.y + h * .52);
            ctx.scale(face, 1);
            ctx.globalAlpha = .28 + atk * .5;
            ctx.strokeStyle = WHITE; ctx.lineWidth = 4.5 * atk + 1.5; ctx.lineCap = "round";
            ctx.beginPath(); ctx.arc(0, 0, 26 + (1 - atk) * 12, -1.1 + (1 - atk) * .8, .9 + (1 - atk) * .6); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    /* ================================================  PROPS  ========
       Small living details that never move above a mob's feet line and are
       always < 1 tile tall, so they can never hide gameplay. */
    function prop(ctx, kind, x, groundY, seed, t, world) {
        if (!ctx) return;
        const sway = Math.sin(t / 46 + seed * 3) * (1.6 + (seed % 1));
        const key = "prop:" + kind + ":" + (world || 0) + ":" + (seed | 0);
        const s = sprite(key, 34, 26, c => { PROPS[kind] ? PROPS[kind](c, 17, 26, world || 0) : PROPS.grass(c, 17, 26, world || 0); });
        ctx.save();
        ctx.translate(x, groundY);
        ctx.transform(1, 0, sway * .012, 1, 0, 0);
        if (s) ctx.drawImage(s.cv, -17, -26); else if (PROPS[kind]) PROPS[kind](ctx, 0, 0, world || 0);
        ctx.restore();
    }
    const PROPS = {
        /* grass tufts: 3 blades, darker at the base so they sit on the ground */
        grass(c, x, y, wd) {
            const cols = [["#4d8f52", "#2d5c34"], ["#5a9b58", "#2f5f36"], ["#6fae63", "#37703c"]][wd % 3] || ["#4d8f52", "#2d5c34"];
            for (const [dx, hh, bend] of [[-7, 11, -3], [0, 17, 1], [7, 9, 3]]) {
                c.strokeStyle = cols[1]; c.lineWidth = 2.6; c.lineCap = "round";
                c.beginPath(); c.moveTo(x + dx, y); c.quadraticCurveTo(x + dx + bend, y - hh * .6, x + dx + bend * 2, y - hh); c.stroke();
                c.strokeStyle = cols[0]; c.lineWidth = 1.2;
                c.beginPath(); c.moveTo(x + dx, y); c.quadraticCurveTo(x + dx + bend, y - hh * .6, x + dx + bend * 2, y - hh); c.stroke();
            }
        },
        /* ash reeds: thin, scorched, with one ember tip */
        reed(c, x, y) {
            for (const [dx, hh] of [[-6, 16], [1, 21], [7, 13]]) {
                c.strokeStyle = "#2a1c17"; c.lineWidth = 2; c.lineCap = "round";
                c.beginPath(); c.moveTo(x + dx, y); c.quadraticCurveTo(x + dx + 4, y - hh * .6, x + dx + 6, y - hh); c.stroke();
                c.fillStyle = "#ff9a4d"; c.beginPath(); c.arc(x + dx + 6, y - hh, 1.8, 0, 7); c.fill();
            }
        },
        /* ice spikes + a dust of frost */
        ice(c, x, y) {
            for (const [dx, hh, ww] of [[-7, 12, 5], [0, 19, 6], [8, 10, 4]]) {
                c.fillStyle = "#bfe6f2";
                c.beginPath(); c.moveTo(x + dx - ww / 2, y); c.lineTo(x + dx, y - hh); c.lineTo(x + dx + ww / 2, y); c.fill();
                c.strokeStyle = "#6fa9c4"; c.lineWidth = 1; c.stroke();
            }
        },
        /* crystal shards with a glint */
        crystal(c, x, y) {
            for (const [dx, hh] of [[-6, 13], [2, 19], [8, 9]]) {
                c.fillStyle = "#5f7fd8";
                c.beginPath(); c.moveTo(x + dx, y - hh); c.lineTo(x + dx + 4, y - hh * .35); c.lineTo(x + dx, y); c.lineTo(x + dx - 4, y - hh * .35); c.fill();
                c.fillStyle = "rgba(200,248,255,.85)"; c.fillRect(x + dx - 1, y - hh * .8, 1.6, hh * .5);
            }
        },
        /* small mushroom cluster (meadow/forest/desert floors) */
        mushroom(c, x, y) {
            for (const [dx, hh, r] of [[-6, 8, 5], [2, 12, 6.5], [8, 7, 4]]) {
                c.fillStyle = "#e6dfd0"; c.fillRect(x + dx - 1.6, y - hh, 3.2, hh);
                c.fillStyle = "#c95662"; c.beginPath(); c.ellipse(x + dx, y - hh, r, r * .62, 0, Math.PI, 0); c.fill();
                c.fillStyle = "rgba(255,255,255,.5)"; c.fillRect(x + dx - 1, y - hh - r * .3, 1.6, 1.6);
            }
        },
        /* rubble stones with a chalk cap */
        pebble(c, x, y) {
            for (const [dx, r] of [[-6, 5], [3, 7.5], [10, 4]]) {
                c.fillStyle = "#43485a"; c.beginPath(); c.ellipse(x + dx, y - r * .5, r, r * .62, 0, 0, 7); c.fill();
                c.fillStyle = "rgba(255,255,255,.14)"; c.beginPath(); c.ellipse(x + dx, y - r * .75, r * .7, r * .24, 0, 0, 7); c.fill();
            }
        },
        /* hanging chain: two links + a hook (City of Rain) */
        chain(c, x, y) {
            c.strokeStyle = "#4c5566"; c.lineWidth = 2.4;
            for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x, y - 4 - i * 6, 3, 4.2, 0, 0, 7); c.stroke(); }
        },
        /* bone rib shard (Hollow Castle / The Climb) */
        rib(c, x, y) {
            c.strokeStyle = "#8d8a7e"; c.lineWidth = 3.4; c.lineCap = "round";
            c.beginPath(); c.moveTo(x - 6, y); c.quadraticCurveTo(x - 2, y - 14, x + 5, y - 17); c.stroke();
            c.strokeStyle = "#c7c3b3"; c.lineWidth = 1.4;
            c.beginPath(); c.moveTo(x - 6, y); c.quadraticCurveTo(x - 2, y - 14, x + 5, y - 17); c.stroke();
        },
        /* spore pod (Fungal / Mossy): pulses on its own rhythm */
        spore(c, x, y) {
            c.fillStyle = "#3f2a4c"; c.beginPath(); c.ellipse(x, y - 6, 7, 6.5, 0, 0, 7); c.fill();
            c.fillStyle = "#7ef0d2"; c.globalAlpha = .7; c.beginPath(); c.ellipse(x, y - 7, 3.4, 3.2, 0, 0, 7); c.fill(); c.globalAlpha = 1;
            c.strokeStyle = "#2a1b34"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x - 2, y - 16); c.stroke();
        }
    };

    /* ================================================  FX  ===========
       One feedback bus for both modes. Every effect is gated by the
       MetroFx options (shake / flash / hit-stop) so nothing here can
       ignore an accessibility setting. */
    const gates = () => (typeof MetroFx !== "undefined" ? MetroFx : null);
    const FX = {
        shake: 0, hitstop: 0, sx: 0, sy: 0, t: 0,
        flashA: 0, flashCol: WHITE, flashMax: 1, vignette: 0,
        numbers: [], rings: [],

        reset() { this.shake = 0; this.hitstop = 0; this.sx = 0; this.sy = 0; this.flashA = 0; this.vignette = 0; this.numbers.length = 0; this.rings.length = 0; },
        addShake(mag) { const g = gates(); const k = g ? g.shakeScale() : 1; this.shake = Math.min(9, Math.max(this.shake, mag * k)); },
        freeze(n) { const g = gates(); const k = g ? g.freeze(n) : n; this.hitstop = Math.max(this.hitstop, k | 0); },
        flash(col, a, frames, vig) { const g = gates(); if (g && !g.flashOK()) return; this.flashCol = col || WHITE; this.flashA = Math.max(this.flashA, a === undefined ? .5 : a); this.flashMax = frames || 10; if (vig) this.vignette = Math.max(this.vignette, vig); },
        number(x, y, text, col) {
            if (this.numbers.length > 26) this.numbers.shift();
            this.numbers.push({ x, y, text: String(text), col: col || WHITE, life: 44, vy: -1.1 });
        },
        ring(x, y, r, col) { this.rings.push({ x, y, r: r || 10, col: col || GOLD, life: 18, max: 18 }); },
        frozen() { return this.hitstop > 0; },

        /* one call per 60 Hz logic frame (called by each mode's update loop) */
        step() {
            this.t++;
            if (this.hitstop > 0) this.hitstop--;
            this.shake *= .82;
            if (this.shake < .12) this.shake = 0;
            this.sx = this.shake ? (Math.random() * 2 - 1) * this.shake : 0;
            this.sy = this.shake ? (Math.random() * 2 - 1) * this.shake : 0;
            if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - this.flashA / this.flashMax * 1.15 - .002);
            this.vignette = Math.max(0, this.vignette - .04);
            this.numbers = this.numbers.filter(n => (n.life--, n.y += n.vy, n.vy += .04, n.life > 0));
            this.rings = this.rings.filter(r => (r.life--, r.r += (r.max - r.life) * .12 + 1.4, r.life > 0));
        },
        /* world-space overlays; call inside the camera transform */
        drawWorld(ctx) {
            if (!ctx) return;
            for (const r of this.rings) {
                ctx.save(); ctx.globalAlpha = r.life / r.max * .7;
                ctx.strokeStyle = r.col; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * .55, 0, 0, 7); ctx.stroke(); ctx.restore();
            }
            if (!this.numbers.length) return;
            ctx.save();
            ctx.font = "bold 15px Inter, system-ui, sans-serif";
            ctx.textAlign = "center"; ctx.lineJoin = "round";
            for (const n of this.numbers) {
                ctx.globalAlpha = Math.min(1, n.life / 26);
                ctx.lineWidth = 3; ctx.strokeStyle = INK;
                ctx.strokeText(n.text, n.x, n.y);
                ctx.fillStyle = n.col; ctx.fillText(n.text, n.x, n.y);
            }
            ctx.restore();
        },
        /* screen-space overlays; call after everything else */
        drawScreen(ctx, w, h) {
            if (!ctx) return;
            if (this.vignette > 0) {
                const g = sprite("fx:vignette", 128, 128, c => {
                    const rg = c.createRadialGradient(64, 64, 20, 64, 64, 64);
                    rg.addColorStop(0, "rgba(255,80,80,0)"); rg.addColorStop(1, "rgba(255,60,60,.55)");
                    c.fillStyle = rg; c.fillRect(0, 0, 128, 128);
                });
                if (g) { ctx.save(); ctx.globalAlpha = Math.min(.8, this.vignette); ctx.drawImage(g.cv, 0, 0, w, h); ctx.restore(); }
            }
            if (this.flashA > 0.004) {
                ctx.save(); ctx.globalAlpha = Math.min(.85, this.flashA); ctx.fillStyle = this.flashCol;
                ctx.fillRect(0, 0, w, h); ctx.restore();
            }
        }
    };

    /* ================================================  HUD GLUE  ======
       Cooldown ring sweep + count-up used by the HUD (shape cue, not colour). */
    function ringSweep(ctx, x, y, r, pct, col) {
        if (!ctx) return;
        ctx.save();
        ctx.strokeStyle = "rgba(232,237,243,.25)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
        if (pct > 0) {
            ctx.strokeStyle = col || GOLD; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pct)); ctx.stroke();
        }
        ctx.restore();
    }

    const API = {
        STYLE, SIDE: { INK, GOLD, RIM, WHITE, SOUL, DANGER, CREAM, BRASS, EYE_CALM, EYE_HOT, SHADOW },
        MOBS, ROLES, FAMILY_NAMES, mobInfo, pal3,
        drawMob, drawVessel, prop, PROPS, ringSweep, FX, glow,
        /* test hooks */
        _test: { spriteCount: () => SPR.size, clearSprites: () => SPR.clear(), FAM, sprite }
    };
    return API;
})();
if (typeof window !== "undefined") window.Art = Art;
