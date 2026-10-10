/* =========================================================
   metroid.js - "The Hollow Descent": Metroidvania mode
   Self-contained. Entry points: openMetro() (home button), Metro.stop().
   Persistent data lives in save.metro (plain JSON -> cloud-synced).
   Sections: DATA (rooms) | PHYSICS | PLAYER | ENEMIES | WORLD | RENDER | UI | LOOP
========================================================= */
const Metro = (() => {

    const TS = 32, COLS = 40, ROWS = 24, RW = COLS * TS, RH = ROWS * TS;
    const G = .62, MAXFALL = 13, RUN = 4.4, JUMP = -12.2, DASH_V = 13, DASH_T = 12, VIEW_H = 560;
    const ABIL = { dash: ["Shade Cloak", "Press Shift / L to dash. Dashing makes you invulnerable."],
                   wall: ["Wall Claw", "Press toward a wall and jump to climb it."],
                   dbl:  ["Moth Wing", "Press jump again in mid-air."] };
    const CHARMS = { swift:   { name: "Swift Cloak",  cost: 1, desc: "Dash recovers faster." },
                     catcher: { name: "Soul Catcher", cost: 1, desc: "Gain more Soul from hits." },
                     heavy:   { name: "Heavy Blade",  cost: 2, desc: "+1 damage, slower swing." } };

    /* =====================================================  DATA  =====
       Rooms are 40x24 tiles. Floor top = row 22. Horizontal exits are
       rows 17-21; vertical exits are 4 columns wide.
       # solid  . air  = one-way platform  ^ spikes  W breakable wall   */
    const ROOMS = {};
    function mk(id, name, gx, gy, theme, ex, fn) {
        const g = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
        const set = (x, y, c) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y][x] = c; };
        const fill = (a, b, c, d, ch = "#") => { for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) set(x, y, ch); };
        fill(0, 0, COLS - 1, 1); fill(0, 22, COLS - 1, 23); fill(0, 0, 1, ROWS - 1); fill(COLS - 2, 0, COLS - 1, ROWS - 1);
        if (ex.left) fill(0, 17, 1, 21, ".");
        if (ex.right) fill(COLS - 2, 17, COLS - 1, 21, ".");
        if (ex.up) fill(ex.up.col, 0, ex.up.col + 3, 1, ".");
        if (ex.down) fill(ex.down.col, 22, ex.down.col + 3, 23, ".");
        const r = { id, name, gx, gy, theme, ex, g, items: [], enemies: [], bench: null, npc: null, boss: null };
        fn({
            fill, set, pl: (a, b, y) => fill(a, y, b, y, "="), spikes: (a, b) => fill(a, 22, b, 22, "^"),
            item: (i, t, x, y) => r.items.push({ id: i, t, x: x * TS + TS / 2, y: y * TS + TS / 2 }),
            en: (t, x, row) => r.enemies.push({ t, x: x * TS + TS / 2, y: row * TS }),
            bench: x => { r.bench = { x: x * TS + TS / 2 }; }, npc: x => { r.npc = { x: x * TS + TS / 2 }; },
            boss: x => { r.boss = { x: x * TS + TS / 2 }; }
        });
        ROOMS[id] = r;
    }

    mk("r0", "Hollow Gate", 0, 1, 0, { right: "r1" }, a => {
        a.pl(10, 13, 19); a.pl(5, 8, 16); a.pl(10, 13, 13); a.pl(5, 8, 10); a.pl(20, 25, 19);
        a.item("shard1", "shard", 6, 9); a.bench(4); a.en("crawler", 22, 22); a.en("crawler", 30, 22);
    });
    mk("r1", "Mossed Passage", 1, 1, 1, { left: "r0", right: "r2", up: { to: "r7", col: 18 } }, a => {
        a.pl(6, 9, 19); a.pl(12, 15, 16); a.pl(18, 21, 13); a.pl(24, 27, 8); a.pl(18, 23, 3);
        a.en("crawler", 14, 22); a.en("crawler", 30, 22); a.en("flyer", 20, 10);
    });
    mk("r2", "Fungal Descent", 2, 1, 1, { left: "r1", right: "r3" }, a => {
        a.pl(6, 9, 19); a.pl(12, 15, 16); a.pl(8, 12, 14);
        a.fill(2, 8, 8, 14, "#"); a.fill(3, 11, 7, 13, "."); a.fill(8, 11, 8, 13, "W");   // secret pocket
        a.item("heavy", "charm:heavy", 5, 13);
        a.item("dash", "ability:dash", 33, 21);
        a.en("crawler", 20, 22); a.en("spitter", 27, 22); a.en("crawler", 36, 22);
    });
    mk("r3", "The Chasm", 3, 1, 2, { left: "r2", right: "r4" }, a => {
        a.spikes(14, 22);                                           // 9-tile gap: needs dash
        a.fill(23, 22, 37, 22, "#");
        a.bench(28); a.npc(33); a.en("flyer", 18, 14); a.en("flyer", 22, 12);
    });
    mk("r4", "The Climb", 4, 1, 3, { left: "r3", up: { to: "r5", col: 30 } }, a => {
        a.fill(22, 2, 29, 17); a.fill(34, 2, 37, 21);               // wall-jump shaft: cols 30-33
        a.pl(4, 7, 19); a.pl(10, 13, 16); a.pl(4, 7, 13); a.pl(10, 13, 10);
        a.item("wall", "ability:wall", 8, 21); a.item("shard2", "shard", 11, 9);
        a.en("crawler", 16, 22); a.en("spitter", 19, 22);
    });
    mk("r5", "The Spire", 4, 0, 5, { down: { to: "r4", col: 30 }, left: "r6" }, a => {
        a.pl(20, 23, 19); a.pl(24, 27, 16); a.pl(20, 23, 13); a.pl(26, 30, 8);
        a.item("dbl", "ability:dbl", 10, 21); a.item("mask1", "hp", 28, 7);
        a.en("flyer", 14, 14); a.en("flyer", 24, 10); a.en("spitter", 6, 22);
    });
    mk("r6", "Warden's Hall", 3, 0, 6, { right: "r5" }, a => {
        a.pl(8, 12, 16); a.pl(27, 31, 16);
        a.boss(10);
    });
    mk("r7", "Hidden Loft", 1, 0, 2, { down: { to: "r1", col: 18 } }, a => {
        a.bench(6); a.item("mask2", "hp", 30, 21); a.item("swift", "charm:swift", 34, 21); a.item("shard3", "shard", 25, 21);
        a.item("whet", "dmg", 14, 21);
    });

    /* ===================================================  STATE  ====== */
    let m = null;                       // = save.metro (persistent)
    let R = null, P = null, S = null;   // room, player, runtime state
    let running = false, raf = 0, cv = null, ctx = null, scale = 1, vw = 0, vh = 0, dpr = 1;
    /* The Descent is the heaviest mode: cap the backing-store resolution
       below the device pixel ratio so phones stay smooth (1.25x is still
       crisp once the room art is scaled up, and costs ~2.5x fewer pixels
       than a 2x retina buffer). */
    const DPR_CAP = 1.25;
    const K = {};                       // input flags
    const TEST = typeof document === "undefined" || !document.getElementById("app");

    function ensure() {
        const base = {
            abilities: { dash: false, wall: false, dbl: false }, visited: ["r0"], collected: [], broken: [],
            hpMax: 5, dmg: 1, notches: 3, charms: { owned: [], on: [] }, quest: 0, bossDead: false,
            bench: { room: "r0", x: 4 * TS + TS / 2 }
        };
        /* Normalise whatever (possibly old / corrupted) data is in the save
           so a bad field can never crash the Descent. */
        const raw = (save.metro && typeof save.metro === "object") ? save.metro : {};
        const arr = (v, keep) => Array.isArray(v) ? v.filter(keep) : [];
        const isStr = v => typeof v === "string";
        const m2 = {
            abilities: {
                dash: !!(raw.abilities && raw.abilities.dash),
                wall: !!(raw.abilities && raw.abilities.wall),
                dbl: !!(raw.abilities && raw.abilities.dbl)
            },
            visited: arr(raw.visited, v => isStr(v) && !!ROOMS[v]),
            collected: arr(raw.collected, isStr),
            broken: arr(raw.broken, v => {
                if (typeof v !== "string" || !ROOMS[v.split(":")[0]]) return false;
                const mm = /^([^:]+):(\d+),(\d+)$/.exec(v);
                return !!mm && inGrid(+mm[2], +mm[3]);
            }),
            hpMax: clampNum(raw.hpMax, 1, 20, base.hpMax),
            dmg: clampNum(raw.dmg, 1, 20, base.dmg),
            notches: clampNum(raw.notches, 0, 20, base.notches),
            charms: {
                owned: arr(raw.charms && raw.charms.owned, isStr),
                on: arr(raw.charms && raw.charms.on, isStr)
            },
            quest: clampNum(raw.quest, 0, 99, 0),
            bossDead: !!raw.bossDead,
            bench: {
                room: (raw.bench && isStr(raw.bench.room) && ROOMS[raw.bench.room]) ? raw.bench.room : base.bench.room,
                x: clampNum(raw.bench && raw.bench.x, 0, RW, base.bench.x)
            }
        };
        if (raw.geoDirty) m2.geoDirty = true;
        if (!m2.visited.includes(m2.bench.room)) m2.visited.push(m2.bench.room);
        if (!m2.visited.includes("r0")) m2.visited.unshift("r0");
        save.metro = m2;
        m = save.metro; return m;
    }
    const inGrid = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < COLS && y >= 0 && y < ROWS;
    const clampNum = (v, min, max, dflt) => (typeof v === "number" && isFinite(v)) ? Math.max(min, Math.min(max, Math.round(v))) : dflt;
    const hasCharm = c => m.charms.on.includes(c);
    const rnd = (a, b) => a + Math.random() * (b - a);

    /* ==================================================  PHYSICS  ===== */
    const tileAt = (x, y) => (R.g[y] && R.g[y][x]) || ".";
    const solid = (tx, ty) => tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && (R.g[ty][tx] === "#" || R.g[ty][tx] === "W");
    function hitsSolid(x, y, w, h) {
        const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - .01) / TS), y0 = Math.floor(y / TS), y1 = Math.floor((y + h - .01) / TS);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return true;
        return false;
    }
    function oneWayBelow(b) {
        const ty = Math.floor((b.y + b.h + 1) / TS);
        if (ty < 0 || ty >= ROWS || b.y + b.h > ty * TS + 1) return false;
        for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w - .01) / TS); tx++) if (R.g[ty][tx] === "=") return true;
        return false;
    }
    const grounded = b => hitsSolid(b.x, b.y + 1, b.w, b.h) || oneWayBelow(b);
    function move(b, dx, dy) {
        let hx = 0, hy = 0, landed = false;
        b.x += dx;
        if (dx && hitsSolid(b.x, b.y, b.w, b.h)) { b.x = dx > 0 ? Math.floor((b.x + b.w) / TS) * TS - b.w - .001 : (Math.floor(b.x / TS) + 1) * TS + .001; hx = Math.sign(dx); }
        const pb = b.y + b.h; b.y += dy;
        if (dy && hitsSolid(b.x, b.y, b.w, b.h)) {
            if (dy > 0) { b.y = Math.floor((b.y + b.h) / TS) * TS - b.h - .001; landed = true; } else b.y = (Math.floor(b.y / TS) + 1) * TS + .001;
            hy = Math.sign(dy);
        } else if (dy > 0) {
            const ty = Math.floor((b.y + b.h) / TS);
            if (ty >= 0 && ty < ROWS && b.y + b.h > ty * TS && pb <= ty * TS + .5)
                for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w - .01) / TS); tx++)
                    if (R.g[ty][tx] === "=") { b.y = ty * TS - b.h - .001; landed = true; hy = 1; break; }
        }
        return { hx, hy, landed };
    }
    const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const spikesTouch = b => { for (let ty = Math.floor(b.y / TS); ty <= Math.floor((b.y + b.h - .01) / TS); ty++) for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w - .01) / TS); tx++) if (ty >= 0 && ty < ROWS && tx >= 0 && tx < COLS && R.g[ty][tx] === "^") return true; return false; };

    /* ==================================================  PLAYER  ====== */
    function newPlayer() {
        return { x: 0, y: 0, w: 20, h: 30, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jumpBuf: 0, airJumps: 0, airDash: 1, jumping: false,
                 dashT: 0, dashCd: 0, dashInv: 0, dashDir: 1, invuln: 0, attackT: 0, attackCd: 0, attackDir: "fwd", hit: new Set(),
                 wallLock: 0, wallDir: 0, healT: 0, safeT: 0, hp: m.hpMax, soul: 0, spCd: 0, safe: { x: 0, y: 0 } };
    }

    function hurtPlayer(fromX) {
        const p = P;
        if (p.invuln > 0 || p.dashInv > 0 || S.dead || S.dialog) return;
        p.hp--; p.invuln = 70; p.healT = 0; p.dashT = 0;
        p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * 5.5; p.vy = -6; p.wallLock = 8;
        S.hitstop = Math.max(S.hitstop, MetroFx.freeze(6)); S.shake = 9; S.hudPulse = 24; burst(p.x + p.w / 2, p.y + p.h / 2, "#e8edf3", 10);
        if (p.hp <= 0) { S.dead = 1; S.deadT = 0; MetroFx.play("bigdeath"); } else MetroFx.play("hurt");
    }

    function stepPlayer() {
        const p = P, ab = m.abilities;
        const dir = (K.right ? 1 : 0) - (K.left ? 1 : 0);
        p.onGround = grounded(p);
        if (p.onGround) { p.coyote = 6; p.airJumps = ab.dbl ? 1 : 0; p.airDash = 1; p.jumping = false; if (p.safeT++ > 8 && !spikesTouch({ x: p.x - 40, y: p.y, w: p.w + 80, h: p.h + 4 })) { p.safe = { x: p.x, y: p.y }; p.safeT = 0; } }
        else p.coyote = Math.max(0, p.coyote - 1);

        let wallDir = 0;
        if (!p.onGround && ab.wall) wallDir = hitsSolid(p.x + 1, p.y, p.w, p.h) ? 1 : hitsSolid(p.x - 1, p.y, p.w, p.h) ? -1 : 0;
        p.wallDir = wallDir;
        if (wallDir) { p.airJumps = ab.dbl ? 1 : 0; p.airDash = 1; }

        p.attackCd--; p.dashCd--; p.invuln--; p.dashInv--; p.spCd--; p.jumpBuf--;
        if (K.jumpP) p.jumpBuf = 6;

        /* heal: hold */
        if (K.heal && p.onGround && p.soul >= 33 && p.hp < m.hpMax && p.attackT <= 0 && p.dashT <= 0) {
            p.healT++; p.vx = 0;
            if (p.healT >= 45) { p.hp++; p.soul -= 33; p.healT = 0; burst(p.x + 10, p.y + 8, "#cfe9ff", 14); MetroFx.play("heal"); }
        } else p.healT = 0;

        /* dash */
        if (K.dashP && ab.dash && p.dashCd <= 0 && p.dashT <= 0 && (p.onGround || p.airDash > 0) && !p.healT) {
            MetroFx.play("dash"); p.dashT = DASH_T; p.dashDir = dir || p.face; p.face = p.dashDir; p.dashCd = hasCharm("swift") ? 24 : 42; p.dashInv = DASH_T + 2;
            if (!p.onGround) p.airDash--; p.vy = 0; burst(p.x + 10, p.y + 15, "#9fb4cf", 8);
        }

        if (p.dashT > 0) {
            p.vx = p.dashDir * DASH_V; p.vy = 0; p.dashT--;
            if (p.dashT === 0) p.vx = p.dashDir * 3;
        } else {
            if (p.wallLock > 0) p.wallLock--;
            else if (!p.healT) { const t = dir * RUN, acc = p.onGround ? 1.3 : .85; p.vx += Math.max(-acc, Math.min(acc, t - p.vx)); }
            if (dir && !p.healT) p.face = dir;
            p.vy = Math.min(p.vy + G, MAXFALL);
            if (wallDir && dir === wallDir && p.vy > 0) p.vy = Math.min(p.vy, 2.2);          // wall slide
            if (p.jumpBuf > 0) {
                if (p.coyote > 0) { p.vy = JUMP; p.coyote = 0; p.jumpBuf = 0; p.jumping = true; dust(p); MetroFx.play("jump"); }
                else if (wallDir) { p.vy = -11.6; p.vx = -wallDir * 6.4; p.wallLock = 10; p.face = -wallDir; p.jumpBuf = 0; p.jumping = true; dust(p); MetroFx.play("jump"); }
                else if (p.airJumps > 0) { p.vy = -10.8; p.airJumps--; p.jumpBuf = 0; p.jumping = true; burst(p.x + 10, p.y + 30, "#cfe9ff", 8); MetroFx.play("wing"); }
            }
            if (!K.jump && p.jumping && p.vy < -4) { p.vy *= .55; p.jumping = false; }        // variable jump height
        }

        /* attack */
        if (K.atkP && p.attackCd <= 0 && p.dashT <= 0 && !p.healT) {
            p.attackDir = K.up ? "up" : (K.down && !p.onGround) ? "down" : "fwd";
            p.attackT = 8; p.attackCd = hasCharm("heavy") ? 28 : 20; p.hit = new Set(); MetroFx.play("swing");
        }
        /* soul bolt */
        if (K.spP && p.soul >= 33 && p.spCd <= 0) { p.soul -= 33; p.spCd = 30; MetroFx.play("shot"); S.shots.push({ x: p.x + 10, y: p.y + 12, vx: p.face * 9, life: 70, w: 18, h: 12, dmg: 3 }); }

        const r = move(p, p.vx, p.vy);
        if (r.hx) { p.vx = 0; if (p.dashT > 0) p.dashT = 0; }
        if (r.hy) { p.vy = 0; if (r.landed && !p.onGround) { dust(p); MetroFx.play("land"); } }

        if (p.attackT > 0) { p.attackT--; playerHits(); }

        if (spikesTouch(p)) { hurtPlayer(p.x + p.w / 2); if (!S.dead) { p.x = p.safe.x; p.y = p.safe.y; p.vx = p.vy = 0; p.invuln = 70; } }

        /* room transitions */
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        if (cx > RW && R.ex.right) enter(R.ex.right, "right");
        else if (cx < 0 && R.ex.left) enter(R.ex.left, "left");
        else if (cy < 0 && R.ex.up) enter(R.ex.up.to, "up");
        else if (p.y > RH && R.ex.down) enter(R.ex.down.to, "down");
        else { p.x = Math.max(p.x, -p.w); if (p.y > RH + 200) { p.x = p.safe.x; p.y = p.safe.y; } }

        K.jumpP = K.dashP = K.atkP = K.spP = false;
    }

    function playerHits() {
        const p = P, d = p.attackDir;
        const rc = d === "fwd" ? { x: p.face > 0 ? p.x + p.w : p.x - 44, y: p.y - 2, w: 44, h: p.h + 4 }
                 : d === "up" ? { x: p.x - 14, y: p.y - 40, w: p.w + 28, h: 40 } : { x: p.x - 14, y: p.y + p.h, w: p.w + 28, h: 40 };
        P.rect = rc;
        const dmg = m.dmg + (hasCharm("heavy") ? 1 : 0);
        let pogo = false;
        S.enemies.forEach(e => {
            if (e.dead || p.hit.has(e) || !overlap(rc, e)) return;
            p.hit.add(e); damageEnemy(e, dmg, p.face);
            p.soul = Math.min(99, p.soul + (hasCharm("catcher") ? 17 : 11)); S.hitstop = Math.max(S.hitstop, MetroFx.freeze(3)); S.shake = Math.max(S.shake, 3); MetroFx.play("hit");
            if (d === "down") pogo = true;
        });
        for (let ty = Math.floor(rc.y / TS); ty <= Math.floor((rc.y + rc.h) / TS); ty++)
            for (let tx = Math.floor(rc.x / TS); tx <= Math.floor((rc.x + rc.w) / TS); tx++) {
                if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) continue;
                if (R.g[ty][tx] === "W") breakWall(tx, ty);
                else if (R.g[ty][tx] === "^" && d === "down") pogo = true;
            }
        if (pogo && p.vy >= -2) { p.vy = -9.5; p.airJumps = m.abilities.dbl ? 1 : 0; p.airDash = 1; p.attackT = 0; }
    }

    function breakWall(x, y) {                       // removes the whole connected cracked wall + remembers it
        const q = [[x, y]];
        while (q.length) {
            const [a, b] = q.pop();
            if (a < 0 || b < 0 || a >= COLS || b >= ROWS || R.g[b][a] !== "W") continue;
            R.g[b][a] = "."; m.broken.push(R.id + ":" + a + "," + b); burst(a * TS + 16, b * TS + 16, "#8a7a68", 6);
            q.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
        }
        S.shake = 6; renderRoomCache(); saveGame(); MetroFx.play("secret");
        toast("A hidden passage opens…");
    }

    /* =================================================  ENEMIES  ====== */
    const E_DEF = { crawler: { hp: 3, w: 26, h: 20, geo: 2 }, flyer: { hp: 2, w: 24, h: 20, geo: 3 },
                    spitter: { hp: 4, w: 28, h: 26, geo: 4 }, warden: { hp: 45, w: 46, h: 64, geo: 0 } };

    function spawnEnemy(t, x, feetY) {
        const d = E_DEF[t];
        const e = { t, x: x - d.w / 2, y: feetY - d.h, w: d.w, h: d.h, hp: d.hp, hpMax: d.hp, vx: t === "crawler" ? -1 : 0, vy: 0, st: "idle", tm: rnd(20, 80), flash: 0, face: -1, home: { x, y: feetY - d.h - (t === "flyer" ? 90 : 0) } };
        if (t === "flyer") { e.y = e.home.y; }
        if (t === "warden") { e.phase = 1; e.tm = 70; e.vx = 0; }
        S.enemies.push(e); return e;
    }

    function damageEnemy(e, dmg, dirFace) {
        e.hp -= dmg; e.flash = 6; burst(e.x + e.w / 2, e.y + e.h / 2, "#e8edf3", 6);
        if (e.t !== "warden") { e.vx = dirFace * 4; e.vy = -3; if (e.t === "flyer") e.st = "recover", e.tm = 40; }
        else if (e.phase === 1 && e.hp <= 22) { e.phase = 2; S.shake = 14; S.phaseFlash = 40; MetroFx.play("phase"); toast("The Warden's hollow shell cracks…"); }
        if (e.hp <= 0) killEnemy(e);
    }
    function killEnemy(e) {
        e.dead = true; burst(e.x + e.w / 2, e.y + e.h / 2, "#cfe9ff", e.t === "warden" ? 60 : 14); S.shake = e.t === "warden" ? 20 : 4; MetroFx.play(e.t === "warden" ? "bigdeath" : "kill");
        const geo = e.t === "warden" ? 150 : E_DEF[e.t].geo, n = e.t === "warden" ? 15 : geo, v = geo / n;
        for (let i = 0; i < n; i++) S.coins.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: rnd(-3, 3), vy: rnd(-7, -2), v, w: 8, h: 8 });
        if (e.t === "warden") {
            m.bossDead = true; S.lock = false; unlockDoor(); saveGame();
            S.items.push({ id: "heart", t: "heart", x: RW / 2, y: 21 * TS + 16, bob: 0 });
            toast("The Hollow Warden falls.");
        }
    }
    function lockDoor() { for (let y = 17; y <= 21; y++) { R.g[y][COLS - 2] = "#"; R.g[y][COLS - 1] = "#"; } renderRoomCache(); }
    function unlockDoor() { for (let y = 17; y <= 21; y++) { R.g[y][COLS - 2] = "."; R.g[y][COLS - 1] = "."; } renderRoomCache(); }

    function shootAt(e, vx, vy, g, r) { S.eshots.push({ x: e.x + e.w / 2 - r, y: e.y + e.h / 2 - r, vx, vy, g, w: r * 2, h: r * 2, life: 160 }); }

    function stepEnemy(e) {
        if (e.dead) return;
        const p = P, dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h / 2) - (e.y + e.h / 2), dist = Math.hypot(dx, dy);
        e.flash--; e.tm--;
        if (e.t === "crawler") {
            if (Math.abs(e.vx) > 1.1) e.vx *= .85; else e.vx = Math.sign(e.vx || -1) * 1;
            const r = move(e, e.vx, 0);
            const aheadX = e.x + (e.vx > 0 ? e.w + 2 : -2);
            const ft = tileAt(Math.floor(aheadX / TS), Math.floor((e.y + e.h + 2) / TS)), floorAhead = ft === "#" || ft === "W" || ft === "=";
            if (r.hx || !floorAhead) e.vx = -Math.sign(e.vx || 1) * 1;
            e.vy = Math.min(e.vy + G, 10); move(e, 0, e.vy); if (grounded(e)) e.vy = 0;
        } else if (e.t === "flyer") {
            if (e.st === "idle") {
                e.x += (e.home.x - e.w / 2 - e.x) * .02; e.y = e.home.y + Math.sin(S.t / 25 + e.home.x) * 14; e.vx *= .8;
                if (dist < 300 && e.tm <= 0) { e.st = "wind"; e.tm = 32; MetroFx.play("tell"); }
            } else if (e.st === "wind") { if (e.tm <= 0) { e.st = "lunge"; e.tm = 26; const n = dist || 1; e.vx = dx / n * 7.5; e.vy = dy / n * 7.5; } }
            else if (e.st === "lunge") { e.x += e.vx; e.y += e.vy; if (e.tm <= 0 || hitsSolid(e.x, e.y, e.w, e.h)) { e.st = "recover"; e.tm = 60; } }
            else if (e.st === "recover") { e.x += (e.home.x - e.w / 2 - e.x) * .04 + e.vx * .1; e.y += (e.home.y - e.y) * .04; e.vx *= .9; if (e.tm <= 0) { e.st = "idle"; e.tm = 90; } }
        } else if (e.t === "spitter") {
            e.face = dx > 0 ? 1 : -1;
            if (e.st === "idle" && dist < 440 && e.tm <= 0) { e.st = "wind"; e.tm = 24; MetroFx.play("tell"); }
            else if (e.st === "wind" && e.tm <= 0) { shootAt(e, e.face * 3.4, -5.2, .26, 6); e.st = "idle"; e.tm = 120; }
            e.vy = Math.min(e.vy + G, 10); move(e, 0, e.vy);
        } else if (e.t === "warden") stepWarden(e, dx);
        if (!e.dead && overlap({ x: P.x + 3, y: P.y + 3, w: P.w - 6, h: P.h - 6 }, { x: e.x + 3, y: e.y + 3, w: e.w - 6, h: e.h - 6 })) hurtPlayer(e.x + e.w / 2);
    }

    /* ---- boss: telegraphed patterns, 2 phases ---- */
    function stepWarden(e, dx) {
        const ph2 = e.phase === 2, ground = grounded(e);
        if (e.st === "idle") {
            e.face = dx > 0 ? 1 : -1; e.vx = 0;
            if (e.tm <= 0) {
                const pick = Math.random(); e.pat = pick < .45 ? "charge" : (ph2 && pick > .75) ? "rain" : "slam";
                e.st = "wind"; e.tm = e.pat === "charge" ? (ph2 ? 30 : 40) : e.pat === "rain" ? 34 : 34; MetroFx.play("tell");
            }
        } else if (e.st === "wind") {                      // telegraph (flashes + crouch)
            if (e.tm <= 0) {
                if (e.pat === "charge") { e.st = "charge"; e.tm = 60; e.vx = e.face * (ph2 ? 11 : 9); }
                else if (e.pat === "slam") { e.st = "slam"; e.vy = -14; e.vx = e.face * 4.2; }
                else { e.st = "rain"; e.tm = 90; }
            }
        } else if (e.st === "charge") {
            const r = move(e, e.vx, 0);
            if (r.hx || e.tm <= 0) { e.vx = 0; e.st = "recover"; e.tm = ph2 ? 24 : 44; S.shake = 6; }
        } else if (e.st === "slam") {
            e.vy = Math.min(e.vy + G, 13); const r = move(e, e.vx, e.vy);
            if (r.hx) e.vx = 0;
            if (r.landed) { e.vx = 0; e.vy = 0; S.shake = 12; for (const s of [-1, 1]) S.eshots.push({ x: e.x + e.w / 2, y: e.y + e.h - 14, vx: s * (ph2 ? 6 : 5), vy: 0, g: 0, w: 22, h: 14, life: 90, ground: true }); e.st = "recover"; e.tm = ph2 ? 30 : 50; }
        } else if (e.st === "rain") {
            if (e.tm % 15 === 0) S.eshots.push({ x: rnd(80, RW - 80), y: 40, vx: 0, vy: 2, g: .3, w: 18, h: 18, life: 140 });
            if (e.tm <= 0) { e.st = "recover"; e.tm = 40; }
        } else if (e.st === "recover") { e.vx = 0; if (e.tm <= 0) { e.st = "idle"; e.tm = ph2 ? 22 : 45; } }
        if (e.st !== "slam") { e.vy = Math.min(e.vy + G, 13); move(e, 0, e.vy); if (grounded(e)) e.vy = 0; }
    }

    function stepShots() {
        S.shots.forEach(s => { s.x += s.vx; s.life--; if (hitsSolid(s.x, s.y, s.w, s.h)) s.life = 0;
            S.enemies.forEach(e => { if (!e.dead && s.life > 0 && overlap(s, e)) { damageEnemy(e, s.dmg, Math.sign(s.vx)); s.life = 0; } }); });
        S.shots = S.shots.filter(s => s.life > 0);
        S.eshots.forEach(s => { s.vy += s.g; s.x += s.vx; s.y += s.vy; s.life--;
            if (hitsSolid(s.x, s.y, s.w, s.h) && !s.ground) s.life = 0;
            if (s.ground && !hitsSolid(s.x, s.y + 8, s.w, s.h)) s.vy = 3;
            if (overlap(s, P)) { hurtPlayer(s.x + s.w / 2); if (!s.ground) s.life = 0; } });
        S.eshots = S.eshots.filter(s => s.life > 0);
    }

    /* =================================================  WORLD  ======== */
    function loadRoom(id, spawn) {
        R = ROOMS[id];
        R.g = mkBase(id);                                               // pristine grid: wall/door edits never leak between visits
        m.broken.forEach(k => {
            /* tolerate corrupt / outdated save entries: never touch a tile
               that is not an actual cracked wall, never index out of range */
            if (typeof k !== "string") return;
            const [rid, c] = k.split(":");
            if (rid !== id || typeof c !== "string") return;
            const [x, y] = c.split(",").map(Number);
            if (!inGrid(x, y) || R.g[y][x] !== "W") return;
            R.g[y][x] = ".";
        });
        S = Object.assign(S || {}, { enemies: [], items: [], coins: [], shots: [], eshots: [], parts: S && S.parts || [], lock: false, banner: 150, t: 0, bossRoom: false, boss: null, dialog: null });
        R.enemies.forEach(en => spawnEnemy(en.t, en.x, en.y));
        R.items.forEach(it => { if (!m.collected.includes(it.id)) S.items.push({ ...it, bob: Math.random() * 6 }); });
        if (R.boss) {
            if (m.bossDead) { if (!m.collected.includes("heart")) S.items.push({ id: "heart", t: "heart", x: RW / 2, y: 21 * TS + 16, bob: 0 }); }
            else S.bossRoom = true;
        }
        if (!m.visited.includes(id)) m.visited.push(id);
        if (spawn) { P.x = spawn.x; P.y = spawn.y; P.vx = spawn.vx || 0; P.vy = spawn.vy || 0; P.safe = { x: P.x, y: P.y }; }
        P.safeT = 0;
        renderRoomCache(); cam.x = P.x + 10 - vw / 2; cam.y = P.y - vh / 2; clampCam();
        if (window.Scenery && !TEST) {
            if (S.theme !== R.theme) Scenery.setWorld(R.theme);
            Scenery.resetCamera(cam.x * scale);          // no fog/particle lurch after a room change
        }
        S.theme = R.theme;
    }
    const PRISTINE = {};
    function mkBase(id) { return PRISTINE[id].map(r => r.slice()); }

    function enter(id, how) {
        const p = P, from = R.id;
        if (m.geoDirty) { saveGame(); m.geoDirty = false; }
        const spawn = { vx: p.vx, vy: p.vy };
        const next = ROOMS[id];
const clampY = y => Math.max(17 * TS, Math.min(22 * TS - p.h - 1, y));
        const clampX = col => Math.max(col * TS + 2, Math.min((col + 4) * TS - p.w - 2, p.x));
        if (how === "right") { spawn.x = 6; spawn.y = clampY(p.y); }
        else if (how === "left") { spawn.x = RW - p.w - 6; spawn.y = clampY(p.y); }
        else if (how === "up") { spawn.x = clampX(R.ex.up.col); spawn.y = RH - p.h - 6; }
        else { spawn.x = clampX(R.ex.down.col); spawn.y = 6; }
        loadRoom(id, spawn);
        P.invuln = Math.max(P.invuln, 20);
    }

    function rest() {
        const p = P;
        p.hp = m.hpMax; m.bench = { room: R.id, x: R.bench.x }; S.restFlash = 50; m.geoDirty = false; MetroFx.play("rest");
        loadRoom(R.id, null);                                           // enemies come back when you rest
        saveGame(); toast("Rested. Progress saved.");
    }

    function collect(it) {
        const t = it.t;
        if (t === "shard") toast("Glow Shard collected (" + (m.collected.filter(c => c.startsWith("shard")).length + 1) + "/3)");
        else if (t.startsWith("ability:")) { const k = t.split(":")[1]; m.abilities[k] = true; S.popup = { title: ABIL[k][0], text: ABIL[k][1], t: 260 }; }
        else if (t.startsWith("charm:")) { const k = t.split(":")[1]; m.charms.owned.push(k); S.popup = { title: "Charm: " + CHARMS[k].name, text: CHARMS[k].desc + " Equip at a bench (press C).", t: 260 }; }
        else if (t === "hp") { m.hpMax++; P.hp = m.hpMax; S.popup = { title: "Mask Shard", text: "Maximum health increased.", t: 200 }; }
        else if (t === "dmg") { m.dmg++; S.popup = { title: "Whetstone", text: "Your blade cuts deeper.", t: 200 }; }
        else if (t === "heart") { S.popup = { title: "Heart of the Hollow", text: "The kingdom's pulse returns. You may keep exploring.", t: 400 }; }
        m.collected.push(it.id); it.gone = true; burst(it.x, it.y, "#f6e7ae", 20); saveGame();
        const big = t.startsWith("ability:") || t.startsWith("charm:") || t === "hp" || t === "dmg" || t === "heart";
        MetroFx.play(big ? "unlock" : "pickup");
        if (big) S.ring = { x: P.x + P.w / 2, y: P.y + P.h / 2, t: 0, max: 60, col: t.startsWith("ability:") ? "#f6e7ae" : "#cfe9ff" };
    }

    const NPC_LINES = q => q === 0 ? ["Old Wick: Another wanderer in the dark…", "Old Wick: Three Glow Shards lie scattered through these halls. Bring them to me.", "Old Wick: I will trade you a charm for them."]
        : q === 1 ? ["Old Wick: Three Glow Shards. Still missing some?"] : ["Old Wick: The shards hum again. Go well, wanderer."];

    function interact() {
        const p = P, cx = p.x + p.w / 2;
        if (R.bench && Math.abs(cx - R.bench.x) < 40 && p.onGround) { rest(); return; }
        if (R.npc && Math.abs(cx - R.npc.x) < 50) {
            const shards = m.collected.filter(c => c.startsWith("shard")).length;
            if (m.quest < 2 && shards >= 3) { m.quest = 2; m.charms.owned.push("catcher"); S.dialog = { lines: ["Old Wick: You found them all!", "Old Wick: Take the Soul Catcher charm. Equip it at a bench (C)."], i: 0 }; saveGame(); }
            else { if (m.quest === 0) m.quest = 1; S.dialog = { lines: NPC_LINES(m.quest), i: 0 }; }
        }
    }

    /* =================================================  STEP  ========= */
    function step() {
        if (S.dialog) { if (K.atkP || K.jumpP || K.upP) { S.dialog.i++; if (S.dialog.i >= S.dialog.lines.length) S.dialog = null; } K.atkP = K.jumpP = K.upP = false; return; }
        if (S.hitstop > 0) { S.hitstop--; return; }
        S.t++;
        if (S.dead) {
            S.deadT++;
            if (S.deadT > MetroFx.deadFrames()) { const b = m.bench; P.hp = m.hpMax; P.soul = 0; P.invuln = 60; P.vx = P.vy = 0; S.dead = 0; loadRoom(b.room, { x: b.x - P.w / 2, y: 22 * TS - P.h - 1 }); }
            return;
        }
        if (K.upP) { K.upP = false; interact(); }
        stepPlayer();
        if (S.bossRoom && !S.lock && !m.bossDead && P.x < RW - 7 * TS) {          // boss fight starts
            S.lock = true; lockDoor(); const b = spawnEnemy("warden", R.boss.x + 14 * TS, 22 * TS); b.face = -1; S.boss = b; toast("Hollow Warden");
        }
        S.enemies.forEach(stepEnemy); stepShots();
        S.items.forEach(it => { it.bob += .06; if (!it.gone && overlap({ x: it.x - 14, y: it.y - 14, w: 28, h: 28 }, P)) collect(it); });
        S.items = S.items.filter(i => !i.gone);
        S.coins.forEach(c => { c.vy += .35; move(c, c.vx, c.vy); c.vx *= .96; if (grounded(c)) c.vy = 0;
            const mx = P.x + P.w / 2 - c.x, my = P.y + P.h / 2 - c.y;                  // Geo drifts toward you when close
            if (Math.hypot(mx, my) < 90) { c.x += mx * .1; c.y += my * .1; c.vy = 0; }
            if (overlap(c, { x: P.x - 6, y: P.y - 6, w: P.w + 12, h: P.h + 12 })) { c.got = true; save.coins += c.v; m.geoDirty = true; } });
        S.coins = S.coins.filter(c => !c.got);
        S.parts.forEach(q => { q.x += q.vx; q.y += q.vy; q.vy += .12; q.life--; });
        S.parts = S.parts.filter(q => q.life > 0).slice(-220);
        if (S.banner > 0) S.banner--; if (S.shake > 0) S.shake *= .85; if (S.restFlash > 0) S.restFlash--;
        if (S.phaseFlash > 0) S.phaseFlash--; if (S.hudPulse > 0) S.hudPulse--; if (S.ring && ++S.ring.t > S.ring.max) S.ring = null;
        if (S.popup && --S.popup.t <= 0) S.popup = null; if (S.toast && --S.toast.t <= 0) S.toast = null;
        S.enemies = S.enemies.filter(e => !e.dead || e.t === "warden");
        updateCam();
    }
    function burst(x, y, col, n) { if (!S) return; for (let i = 0; i < n; i++) S.parts.push({ x, y, vx: rnd(-3, 3), vy: rnd(-4, 1), life: rnd(14, 30), col, s: rnd(1.5, 3.5) }); }
    const dust = p => burst(p.x + p.w / 2, p.y + p.h, "#7c8aa0", 5);
    function toast(t) { if (S) S.toast = { text: t, t: 150 }; }

    /* ================================================  CAMERA  ======== */
    const cam = { x: 0, y: 0 };
    function clampCam() {
        cam.x = vw >= RW ? (RW - vw) / 2 : Math.max(0, Math.min(RW - vw, cam.x));
        cam.y = vh >= RH ? (RH - vh) / 2 : Math.max(0, Math.min(RH - vh, cam.y));
    }
    function updateCam() {
        const tx = P.x + P.w / 2 - vw / 2 + P.face * 40, ty = P.y + P.h / 2 - vh / 2 - 30;
        cam.x += (tx - cam.x) * .12; cam.y += (ty - cam.y) * .12; clampCam();
    }

    /* ================================================  RENDER  ======== */
    let roomCache = null, bgCache = null;
    const pal = () => (typeof worlds !== "undefined" && worlds[R.theme]) || { sky1: "#0f1420", sky2: "#26324a", ground: "#3a4650", dirt: "#1d232b" };
    const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };

    function renderRoomCache() {
        if (TEST) return;
        roomCache = roomCache || document.createElement("canvas"); roomCache.width = RW; roomCache.height = RH;
        const c = roomCache.getContext("2d"), P2 = pal(); c.clearRect(0, 0, RW, RH);
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
            const t = R.g[y][x]; if (t === ".") continue;
            const px = x * TS, py = y * TS;
            if (t === "#" || t === "W") {
                const sh = .85 + hash(x, y) * .3; c.fillStyle = t === "W" ? "#4a3f38" : P2.dirt; c.fillRect(px, py, TS, TS);
                c.fillStyle = `rgba(255,255,255,${(sh - .85) * .18})`; c.fillRect(px, py, TS, TS);
                if (t === "W") { c.strokeStyle = "#1a1512"; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 6, py + 4); c.lineTo(px + 18, py + 16); c.lineTo(px + 12, py + 28); c.moveTo(px + 18, py + 16); c.lineTo(px + 28, py + 12); c.stroke(); }
                else if (!solidIn(x, y - 1)) { c.fillStyle = P2.ground; c.fillRect(px, py, TS, 7); c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(px, py, TS, 2); }
                if (!solidIn(x, y + 1) && t === "#") { c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(px, py + TS - 4, TS, 4); }
            } else if (t === "=") { c.fillStyle = P2.ground; c.fillRect(px, py, TS, 8); c.fillStyle = "rgba(255,255,255,.15)"; c.fillRect(px, py, TS, 2); c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(px + 2, py + 8, 3, 6); c.fillRect(px + TS - 5, py + 8, 3, 6); }
            else if (t === "^") { c.fillStyle = "#cfd8e3"; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(px + i * 8, py + TS); c.lineTo(px + i * 8 + 4, py + 6); c.lineTo(px + i * 8 + 8, py + TS); c.fill(); } }
        }
        bgCache = bgCache || [document.createElement("canvas"), document.createElement("canvas")];
        bgCache.forEach((cv2, li) => {
            cv2.width = RW; cv2.height = RH; const b = cv2.getContext("2d"); b.clearRect(0, 0, RW, RH);
            for (let i = 0; i < 16; i++) {                                    // stalactites / pillars silhouette
                const x = hash(i, li + R.theme * 7) * RW, w = 30 + hash(i, 9 + li) * 90, h = 100 + hash(i, 3 + li) * (li ? 260 : 380);
                b.fillStyle = li ? "rgba(0,0,0,.28)" : "rgba(0,0,0,.18)"; b.beginPath(); b.moveTo(x - w / 2, 0); b.lineTo(x + w / 2, 0); b.lineTo(x, h); b.fill();
                if (li) { b.beginPath(); b.moveTo(x - w / 2, RH); b.lineTo(x + w / 2, RH); b.lineTo(x, RH - h * .6); b.fill(); }
            }
        });
    }
    const solidIn = (x, y) => y >= 0 && y < ROWS && x >= 0 && x < COLS && (R.g[y][x] === "#" || R.g[y][x] === "W");

    let skyCache = { key: "", g: null };
    function draw() {
        const P2 = pal();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        /* sky gradient is rebuilt only when the world or viewport changes */
        const skyKey = R.theme + ":" + innerWidth + "x" + innerHeight;
        if (skyCache.key !== skyKey) {
            const g = ctx.createLinearGradient(0, 0, 0, vh * scale); g.addColorStop(0, P2.sky1); g.addColorStop(1, P2.sky2);
            skyCache = { key: skyKey, g };
        }
        ctx.fillStyle = skyCache.g; ctx.fillRect(0, 0, innerWidth, innerHeight);
        const shk = S.shake * MetroFx.shakeScale(); const sh = shk > .5 ? [rnd(-shk, shk), rnd(-shk, shk)] : [0, 0];
        ctx.save(); ctx.scale(scale, scale); ctx.translate(-Math.round(cam.x) + sh[0], -Math.round(cam.y) + sh[1]);
        ctx.drawImage(bgCache[0], cam.x * .6, cam.y * .6); ctx.drawImage(bgCache[1], cam.x * .3, cam.y * .3);
        ctx.drawImage(roomCache, 0, 0);
        if (R.bench) drawBench(R.bench.x);
        if (R.npc) drawNpc(R.npc.x);
        S.items.forEach(drawItem); S.coins.forEach(c => { ctx.fillStyle = "#cfe3f0"; ctx.beginPath(); ctx.arc(c.x + 4, c.y + 4, 4, 0, 7); ctx.fill(); });
        S.enemies.forEach(drawEnemy); drawTelegraphs();
        S.eshots.forEach(s => { ctx.fillStyle = s.ground ? "#e8edf3" : "#b8ff9a"; ctx.globalAlpha = .9; ctx.beginPath(); ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; });
        S.shots.forEach(s => { ctx.fillStyle = "#cfe9ff"; ctx.shadowColor = "#9fd0ff"; ctx.shadowBlur = 10; ctx.fillRect(s.x, s.y, s.w, s.h); ctx.shadowBlur = 0; });
        drawPlayer(); drawRing();
        S.parts.forEach(q => { ctx.globalAlpha = Math.min(1, q.life / 12); ctx.fillStyle = q.col; ctx.fillRect(q.x, q.y, q.s, q.s); }); ctx.globalAlpha = 1;
        ctx.restore();
        if (window.Scenery) Scenery.draw(ctx, { cameraX: cam.x * scale, world: R.theme, player: { x: (P.x - cam.x) * scale + cam.x * scale, y: (P.y - cam.y) * scale, width: P.w * scale, height: P.h * scale } });
        drawHUD();
    }

    function drawPlayer() {
        const p = P, hero = (typeof heroes !== "undefined" && heroes.find(h => h.id === save.selectedHero)) || { color: "#d94f65", secondary: "#8f2940" };
        if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 && !S.dead) return;
        const cx = p.x + p.w / 2, y = p.y, f = p.face, sq = p.dashT > 0 ? 1.2 : 1;
        ctx.save(); ctx.translate(cx, y + p.h); ctx.scale(f * sq, 1 / sq);
        if (p.dashT > 0) { ctx.globalAlpha = .35; ctx.fillStyle = hero.color; ctx.fillRect(-34, -26, 30, 20); ctx.globalAlpha = 1; }
        ctx.fillStyle = hero.secondary || hero.color; ctx.fillRect(-8, -12, 16, 12);                 // body
        ctx.fillStyle = "#f3d1aa"; ctx.fillRect(-8, -22, 16, 11);                                     // face
        ctx.fillStyle = "#25263a"; ctx.fillRect(1, -19, 3, 5); ctx.fillRect(-5, -19, 3, 5);           // eyes
        ctx.fillStyle = hero.color; ctx.beginPath(); ctx.ellipse(0, -23, 15, 11, 0, Math.PI, 0); ctx.lineTo(15, -22); ctx.lineTo(-15, -22); ctx.fill();   // cap
        if (p.healT > 0) { ctx.strokeStyle = "#cfe9ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -15, 12 + p.healT / 4, 0, 7); ctx.stroke(); }
        ctx.restore();
        if (p.attackT > 0 && p.rect) { ctx.save(); ctx.globalAlpha = .55 * (p.attackT / 8); ctx.fillStyle = "#e8edf3"; ctx.beginPath(); ctx.ellipse(p.rect.x + p.rect.w / 2, p.rect.y + p.rect.h / 2, p.rect.w / 2, p.rect.h / 2, 0, 0, 7); ctx.fill(); ctx.restore(); }
    }
    function drawEnemy(e) {
        if (e.dead) return;
        ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        const fl = e.flash > 0, tele = e.st === "wind", col = fl ? "#fff" : null;
        if (e.t === "crawler") { ctx.scale(e.vx > 0 ? -1 : 1, 1); ctx.fillStyle = col || "#2a2f3d"; ctx.beginPath(); ctx.ellipse(0, 2, 14, 10, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#cfe3f0"; ctx.fillRect(-9, -3, 3, 4); ctx.fillRect(-3, -3, 3, 4); }
        else if (e.t === "flyer") { const w = Math.sin(S.t / 3 + e.home.x) * 8; ctx.fillStyle = col || (tele ? "#ffd0d0" : "#3a3550"); ctx.beginPath(); ctx.ellipse(0, 0, 9, 8, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-18, -10 + w); ctx.lineTo(-8, 4); ctx.moveTo(0, -2); ctx.lineTo(18, -10 + w); ctx.lineTo(8, 4); ctx.fill(); ctx.fillStyle = "#cfe3f0"; ctx.fillRect(-4, -2, 3, 3); ctx.fillRect(2, -2, 3, 3); }
        else if (e.t === "spitter") { ctx.scale(e.face, 1); ctx.fillStyle = col || (tele ? "#e9ffd0" : "#2b4a3a"); ctx.beginPath(); ctx.ellipse(0, 4, 13, 11 + (tele ? 3 : 0), 0, 0, 7); ctx.fill(); ctx.fillStyle = "#b8ff9a"; ctx.beginPath(); ctx.arc(8, -2, tele ? 6 : 4, 0, 7); ctx.fill(); }
        else if (e.t === "warden") {
            ctx.scale(e.face, 1); const crouch = tele ? 8 : 0;
            ctx.fillStyle = col || (tele ? "#f2d6d6" : "#1d1a2b"); ctx.fillRect(-20, -26 + crouch, 40, 58 - crouch);            // armor
            ctx.fillStyle = col || "#2e2a45"; ctx.fillRect(-16, -32 + crouch, 32, 14);                                               // head
            ctx.fillStyle = "#e8edf3"; ctx.beginPath(); ctx.moveTo(-14, -30 + crouch); ctx.lineTo(-22, -46 + crouch); ctx.lineTo(-6, -32 + crouch); ctx.moveTo(14, -30 + crouch); ctx.lineTo(22, -46 + crouch); ctx.lineTo(6, -32 + crouch); ctx.fill();
            ctx.fillStyle = e.phase === 2 ? "#ff8a8a" : "#cfe9ff"; ctx.fillRect(2, -26 + crouch, 8, 4);                               // eye
            if (e.phase === 2) { ctx.strokeStyle = "#cfe9ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(0, 4); ctx.lineTo(-6, 18); ctx.stroke(); }
        }
        ctx.restore();
    }
    /* Telegraph assist: shape cues that never depend on colour. A "!" marker
       above any enemy that is winding up; the Warden also shows a dashed line
       (charge) or ring (slam) where its attack will land. */
    function drawTelegraphs() {
        if (!MetroFx.telegraphOn()) return;
        S.enemies.forEach(e => {
            if (e.dead || e.st !== "wind") return;
            const cx = e.x + e.w / 2, top = e.y - 8;
            ctx.save();
            ctx.beginPath(); ctx.moveTo(cx, top - 20); ctx.lineTo(cx + 8, top - 6); ctx.lineTo(cx - 8, top - 6); ctx.closePath();
            ctx.fillStyle = "#f6e7ae"; ctx.strokeStyle = "#0a0f18"; ctx.lineWidth = 2.5; ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#0a0f18"; ctx.fillRect(cx - 1.5, top - 17, 3, 7); ctx.fillRect(cx - 1.5, top - 9, 3, 2.2);
            if (e.t === "warden") {
                const y = e.y + e.h - 2;
                ctx.setLineDash([8, 6]); ctx.strokeStyle = "#ffd0d0"; ctx.lineWidth = 3;
                if (e.pat === "charge") { ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx + e.face * 9 * TS, y); ctx.stroke(); }
                else if (e.pat === "slam") { ctx.beginPath(); ctx.ellipse(cx, y, 56, 9, 0, 0, 7); ctx.stroke(); }
            }
            ctx.restore();
        });
    }
    /* Unlock / pickup ring: a gold ring that widens from Milo and fades. */
    function drawRing() {
        const r = S.ring; if (!r) return;
        const k = Math.min(1, r.t / r.max), rad = 10 + k * 46;
        ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.col; ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 7); ctx.stroke(); ctx.restore();
    }
    function drawItem(it) {
        const y = it.y + Math.sin(it.bob) * 4; ctx.save(); ctx.translate(it.x, y);
        const col = it.t.startsWith("ability") ? "#f6e7ae" : it.t.startsWith("charm") ? "#a98be0" : it.t === "heart" ? "#ff9aa8" : "#8fc1e3";
        ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = col; ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
    }
    function drawBench(x) { ctx.fillStyle = "#2a3140"; ctx.fillRect(x - 22, 22 * TS - 14, 44, 6); ctx.fillRect(x - 18, 22 * TS - 8, 6, 8); ctx.fillRect(x + 12, 22 * TS - 8, 6, 8); ctx.fillStyle = "#cfe9ff"; ctx.globalAlpha = .6 + Math.sin(S.t / 20) * .2; ctx.beginPath(); ctx.arc(x, 22 * TS - 24, 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    function drawNpc(x) { ctx.fillStyle = "#3a3550"; ctx.fillRect(x - 11, 22 * TS - 34, 22, 34); ctx.fillStyle = "#e8edf3"; ctx.fillRect(x - 9, 22 * TS - 44, 18, 12); ctx.fillStyle = "#25263a"; ctx.fillRect(x - 4, 22 * TS - 40, 3, 4); ctx.fillRect(x + 2, 22 * TS - 40, 3, 4); }

    function drawHUD() {
        const W = innerWidth, H = innerHeight; ctx.save();
        for (let i = 0; i < m.hpMax; i++) {                                         // masks
            const x = 18 + i * 26, y = 22, lost = S.hudPulse > 0 && i === P.hp; ctx.beginPath(); ctx.ellipse(x, y, lost ? 12 : 9, lost ? 14 : 11, 0, 0, 7); ctx.fillStyle = i < P.hp ? "#e8edf3" : "rgba(10,14,22,.8)"; ctx.fill();
            ctx.strokeStyle = "#8d9bb0"; ctx.lineWidth = 2; ctx.stroke();
            if (i < P.hp) { ctx.fillStyle = "#0a0f18"; ctx.fillRect(x - 5, y - 2, 3, 5); ctx.fillRect(x + 2, y - 2, 3, 5); }
        }
        const sx = 22, sy = 62; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, 7); ctx.fillStyle = "rgba(10,14,22,.8)"; ctx.fill(); ctx.strokeStyle = "#8d9bb0"; ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, 13, 0, 7); ctx.clip(); ctx.fillStyle = "#cfe9ff"; ctx.fillRect(sx - 13, sy + 13 - 26 * P.soul / 99, 26, 26); ctx.restore();
        ctx.fillStyle = "#e8edf3"; ctx.font = "700 16px Cinzel, Georgia, serif"; ctx.textAlign = "right"; ctx.fillText("◈ " + save.coins, W - 150, 28);
        ctx.textAlign = "left";
        if (S.bossRoom && S.boss && !S.boss.dead && S.lock) { const bw = Math.min(520, W - 80), bx = (W - bw) / 2; ctx.fillStyle = "rgba(10,14,22,.8)"; ctx.fillRect(bx, H - 40, bw, 12); ctx.fillStyle = "#e8edf3"; ctx.fillRect(bx, H - 40, bw * Math.max(0, S.boss.hp / S.boss.hpMax), 12); ctx.textAlign = "center"; ctx.font = "700 14px Cinzel,serif"; ctx.fillText("HOLLOW WARDEN", W / 2, H - 48); }
        ctx.textAlign = "center";
        if (S.banner > 0) { ctx.globalAlpha = Math.min(1, S.banner / 40); ctx.font = "700 28px Cinzel, Georgia, serif"; ctx.fillStyle = "#e8edf3"; ctx.shadowColor = "#000"; ctx.shadowBlur = 8; ctx.fillText(R.name.toUpperCase(), W / 2, H * .22); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
        const near = (R.bench && Math.abs(P.x + 10 - R.bench.x) < 40) ? "↑ Rest   ·   C: Charms" : (R.npc && Math.abs(P.x + 10 - R.npc.x) < 50) ? "↑ Talk" : "";
        if (near && !S.dialog) { ctx.font = "700 15px Cinzel,serif"; ctx.fillStyle = "#cfe9ff"; ctx.fillText(near, W / 2, H - 70); }
        if (S.toast) { ctx.globalAlpha = Math.min(1, S.toast.t / 30); ctx.font = "600 15px Inter,sans-serif"; ctx.fillStyle = "#e8edf3"; ctx.fillText(S.toast.text, W / 2, H * .3); ctx.globalAlpha = 1; }
        if (S.popup) { const w2 = Math.min(480, W - 40); ctx.fillStyle = "rgba(10,14,22,.9)"; ctx.fillRect((W - w2) / 2, H * .38, w2, 92); ctx.strokeStyle = "#8d9bb0"; ctx.strokeRect((W - w2) / 2, H * .38, w2, 92); ctx.fillStyle = "#f6e7ae"; ctx.font = "700 20px Cinzel,serif"; ctx.fillText(S.popup.title, W / 2, H * .38 + 36); ctx.fillStyle = "#e8edf3"; ctx.font = "14px Inter,sans-serif"; ctx.fillText(S.popup.text, W / 2, H * .38 + 64); }
        if (S.dialog) { const w2 = Math.min(640, W - 30); ctx.fillStyle = "rgba(10,14,22,.94)"; ctx.fillRect((W - w2) / 2, H - 150, w2, 110); ctx.strokeStyle = "#8d9bb0"; ctx.strokeRect((W - w2) / 2, H - 150, w2, 110); ctx.fillStyle = "#e8edf3"; ctx.font = "16px Inter,sans-serif"; ctx.fillText(S.dialog.lines[S.dialog.i], W / 2, H - 92); ctx.fillStyle = "#8d9bb0"; ctx.font = "12px Inter,sans-serif"; ctx.fillText("press attack / jump", W / 2, H - 56); }
        if (S.restFlash > 0 && MetroFx.flashOK()) { ctx.fillStyle = `rgba(207,233,255,${S.restFlash / 120})`; ctx.fillRect(0, 0, W, H); }
        if (S.phaseFlash > 0 && MetroFx.flashOK()) { ctx.fillStyle = `rgba(255,214,214,${S.phaseFlash / 160})`; ctx.fillRect(0, 0, W, H); }
        if (S.dead) { const a = Math.min(1, S.deadT / 40); ctx.fillStyle = `rgba(0,0,0,${a * .85})`; ctx.fillRect(0, 0, W, H); ctx.fillStyle = `rgba(232,237,243,${a})`; ctx.font = "700 34px Cinzel,serif"; ctx.fillText("YOU FELL", W / 2, H / 2); }
        ctx.restore();
    }

    /* ==================================================  MAP  ========= */
    function drawMap(c) {
        const g = c.getContext("2d"), cw = c.width, ch = c.height, cell = Math.min(cw / 6.4, ch / 3.4), ox = cw / 2 - cell * 2.5, oy = ch / 2 - cell;
        g.clearRect(0, 0, cw, ch); g.textAlign = "center";
        const vis = new Set(m.visited), adj = new Set();
        Object.values(ROOMS).forEach(r => { if (vis.has(r.id)) [r.ex.left, r.ex.right, r.ex.up && r.ex.up.to, r.ex.down && r.ex.down.to].forEach(x => x && !vis.has(x) && adj.add(x)); });
        Object.values(ROOMS).forEach(r => {
            const x = ox + r.gx * cell, y = oy + r.gy * cell;
            if (vis.has(r.id)) {
                g.fillStyle = r.id === R.id ? "#cfe9ff" : "#2b3753"; g.fillRect(x + 4, y + 4, cell - 8, cell - 8); g.strokeStyle = "#8d9bb0"; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, cell - 8, cell - 8);
                g.fillStyle = r.id === R.id ? "#0a0f18" : "#e8edf3"; g.font = `${Math.max(10, cell / 9)}px Cinzel,serif`; g.fillText(r.name, x + cell / 2, y + cell / 2 + 4);
                if (r.bench) { g.fillStyle = "#f6e7ae"; g.fillText("◆ bench", x + cell / 2, y + cell - 14); }
                if (r.ex.left) g.fillRect(x, y + cell / 2 - 3, 5, 6); if (r.ex.right) g.fillRect(x + cell - 5, y + cell / 2 - 3, 5, 6);
                if (r.ex.up) g.fillRect(x + cell / 2 - 3, y, 6, 5); if (r.ex.down) g.fillRect(x + cell / 2 - 3, y + cell - 5, 6, 5);
            } else if (adj.has(r.id)) { g.setLineDash([6, 5]); g.strokeStyle = "#5b6a82"; g.strokeRect(x + 4, y + 4, cell - 8, cell - 8); g.setLineDash([]); g.fillStyle = "#5b6a82"; g.font = `${cell / 4}px Cinzel,serif`; g.fillText("?", x + cell / 2, y + cell / 2 + cell / 12); }
        });
    }

    /* ==================================================  UI  ========== */
    function panel(html, after) {
        const p = document.getElementById("metro-panel"); p.innerHTML = html; p.classList.remove("hidden"); S.paused = true; if (after) after(p);
    }
    function closePanel() { const p = document.getElementById("metro-panel"); p.classList.add("hidden"); p.innerHTML = ""; if (S) S.paused = false; }
    function openPause() {
        panel(`<div class="menu-card"><div class="eyebrow">Paused</div><h1>${R.name}</h1>
          <p class="settings-note">Move A/D · Jump Space · Attack F/J (hold ↑/↓ to aim) · Dash Shift · Soul bolt E · Heal hold Q · Map M · Rest/Talk ↑</p>
          <div class="account-actions"><button class="game-button primary" id="mp-res">Resume</button><button class="game-button" id="mp-map">🗺 Map</button><button class="game-button" id="mp-ch">Charms (at benches)</button><button class="game-button" id="mp-opt">⚙ Options</button><button class="game-button" id="mp-exit">Exit to Home</button></div></div>`, p => {
            p.querySelector("#mp-res").onclick = closePanel; p.querySelector("#mp-map").onclick = openMap; p.querySelector("#mp-ch").onclick = openCharms; p.querySelector("#mp-opt").onclick = openOptions;
            p.querySelector("#mp-exit").onclick = () => { stop(); showHome(); };
        });
    }
    function openOptions() {
        panel(`<div class="menu-card" style="width:min(640px,100%)"><div class="eyebrow">Options</div><h1>Descent options</h1>${MetroFx.optionsHTML()}<p class="settings-note">Changes apply immediately and are saved with your progress.</p><button class="game-button primary" id="mo-back">Back</button></div>`, p => { p.querySelector("#mo-back").onclick = openPause; });
    }
    function openMap() {
        panel(`<div class="menu-card" style="width:min(820px,100%)"><div class="eyebrow">Map</div><canvas id="metro-map" width="760" height="380" style="width:100%"></canvas>
          <p class="settings-note">Abilities ${Object.values(m.abilities).filter(Boolean).length}/3 · Items ${m.collected.length}/${Object.values(ROOMS).reduce((n, r) => n + r.items.length, 0) + 1} · Rooms ${m.visited.length}/${Object.keys(ROOMS).length}</p>
          <button class="game-button" id="mm-close">Close (M)</button></div>`, p => { drawMap(p.querySelector("#metro-map")); p.querySelector("#mm-close").onclick = closePanel; });
    }
    function openCharms() {
        const nearBench = R.bench && Math.abs(P.x + 10 - R.bench.x) < 60;
        if (!nearBench) { toast("Charms can only be changed at a bench."); closePanel(); return; }
        const used = () => m.charms.on.reduce((n, c) => n + CHARMS[c].cost, 0);
        const render = () => panel(`<div class="menu-card"><div class="eyebrow">Charms</div><h1>Notches ${used()}/${m.notches}</h1>
          ${m.charms.owned.length ? m.charms.owned.map(c => `<div class="setting-row"><div><strong>${CHARMS[c].name} (${CHARMS[c].cost})</strong><p>${CHARMS[c].desc}</p></div><button class="toggle-button" data-c="${c}" style="background:${m.charms.on.includes(c) ? "#2e9b68" : "#33415f"}">${m.charms.on.includes(c) ? "ON" : "OFF"}</button></div>`).join("") : "<p>You own no charms yet. Explore.</p>"}
          <button class="game-button" id="mc-close" style="margin-top:14px">Close</button></div>`, p => {
            p.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { const c = b.dataset.c; if (m.charms.on.includes(c)) m.charms.on = m.charms.on.filter(x => x !== c); else if (used() + CHARMS[c].cost <= m.notches) m.charms.on.push(c); else toast("Not enough notches."); saveGame(); render(); });
            p.querySelector("#mc-close").onclick = closePanel;
        });
        render();
    }

    /* =================================================  INPUT  ======== */
    const KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
                   " ": "jump", z: "jump", Z: "jump", f: "atk", F: "atk", j: "atk", J: "atk", x: "atk", Shift: "dash", l: "dash", L: "dash", e: "sp", E: "sp", q: "heal", Q: "heal", h: "heal", H: "heal" };
    function onKey(ev, down) {
        if (!running || !S) return;
        if (down && !ev.repeat) {
            if (ev.key === "Escape") { S.paused ? closePanel() : openPause(); ev.preventDefault(); return; }
            if (ev.key === "m" || ev.key === "M") { S.paused ? closePanel() : openMap(); return; }
            if ((ev.key === "c" || ev.key === "C") && !S.paused) { openCharms(); return; }
        }
        if (S.paused) return;
        const k = KEYS[ev.key]; if (!k) return;
        ev.preventDefault();
        if (down) { if (!ev.repeat) { if (k === "jump") K.jumpP = true; if (k === "atk") K.atkP = true; if (k === "dash") K.dashP = true; if (k === "sp") K.spP = true; if (k === "up") K.upP = true; } }
        K[k] = down;
    }
    const kd = e => onKey(e, true), ku = e => onKey(e, false);

    function buildUI() {
        const app = document.getElementById("app");
        app.insertAdjacentHTML("beforeend", `<section id="metro-screen" class="screen hidden game-screen"><canvas id="metroCanvas"></canvas>
          <div class="game-hud" style="justify-content:flex-end"><button class="hud-button" id="mb-map">🗺 Map</button><button class="hud-button" id="mb-pause">☰</button></div>
          <div id="metro-touch" class="hidden"></div><div id="metro-panel" class="modal hidden"></div></section>`);
        document.getElementById("mb-map").onclick = () => S && (S.paused ? closePanel() : openMap());
        document.getElementById("mb-pause").onclick = () => S && (S.paused ? closePanel() : openPause());
        const t = document.getElementById("metro-touch");
        /* Safer pointer handling: capture the pointer on press so the
           release is always received (even outside the button), and treat
           cancel/leave the same as a release — no stuck input. */
        const release = (key, press) => { K[key] = false; if (press) K[press] = false; };
        const btn = (cls, label, key, press) => {
            const b = document.createElement("button");
            b.className = "tbtn " + cls; b.textContent = label;
            b.setAttribute("aria-label", key);
            b.addEventListener("pointerdown", e => {
                e.preventDefault();
                if (e.button != null && e.button !== 0 && e.pointerType === "mouse") return;
                try { b.setPointerCapture(e.pointerId); } catch (err) {}
                K[key] = true; if (press) K[press] = true;
            });
            const up = () => release(key, press);
            b.addEventListener("pointerup", up);
            b.addEventListener("pointercancel", up);
            b.addEventListener("lostpointercapture", up);
            b.addEventListener("contextmenu", e => e.preventDefault());
            t.appendChild(b);
        };
        btn("l", "◀", "left"); btn("r", "▶", "right"); btn("j", "⤒", "jump", "jumpP"); btn("a", "⚔", "atk", "atkP"); btn("d", "≫", "dash", "dashP"); btn("s", "✦", "sp", "spP"); btn("u", "↑", "up", "upP"); btn("h", "♥", "heal");
        if ("ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0) t.classList.remove("hidden");
    }

    /* ==================================================  LOOP  ======== */
    function resize() {
        dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
        cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; scale = Math.max(.7, Math.min(1.6, innerHeight / VIEW_H));
        vw = innerWidth / scale; vh = innerHeight / scale;
    }
    function start() {
        if (running) stop();                // never allow two loops / stale state
        ensure();
        cv = document.getElementById("metroCanvas"); ctx = cv.getContext("2d");
        S = { parts: [], shake: 0, hitstop: 0, paused: false, dead: 0 };
        P = newPlayer(); P.safeT = 0; resize();
        const b = m.bench; loadRoom(b.room, { x: b.x - P.w / 2, y: 22 * TS - P.h - 1 }); P.hp = m.hpMax;
        document.getElementById("metro-screen").classList.remove("hidden");
        Object.keys(K).forEach(k => K[k] = false);
        running = true; addEventListener("keydown", kd); addEventListener("keyup", ku); addEventListener("resize", resize);
        if (window.Scenery) Scenery.setWorld(R.theme);
        const STEP = 1000 / 60; let last = performance.now(), acc = 0;
        const loop = now => {
            if (!running) return;
            let dt = now - last; last = now; if (Math.abs(dt - STEP) < 1.5) dt = STEP; acc += Math.min(dt, 100);
            let n = 0; while (acc >= STEP && n < 5) { if (!S.paused) step(); acc -= STEP; n++; } if (n === 5) acc = 0;
            draw(); raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
    }
    function stop() {
        /* Idempotent: clean up fully even when the loop is already stopped,
           so leaving / restarting can never strand listeners or input. */
        const wasRunning = running;
        running = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("resize", resize);
        Object.keys(K).forEach(k => K[k] = false);                     // no stuck touch / key state
        if (m && (wasRunning || m.geoDirty)) { saveGame(); m.geoDirty = false; }  // persist Geo, visited rooms, charms
        const s = document.getElementById("metro-screen"); if (s) s.classList.add("hidden");
        closePanelSafe(); if (window.Scenery) Scenery.pauseAmbient();
    }
    function closePanelSafe() { const p = document.getElementById("metro-panel"); if (p) { p.classList.add("hidden"); p.innerHTML = ""; } }

    /* ---- init ---- */
    Object.keys(ROOMS).forEach(id => { PRISTINE[id] = ROOMS[id].g.map(r => r.slice()); });
    if (!TEST) {
        buildUI();
        /* Persist live Descent progress when the tab is hidden or closed. */
        const saveIfRunning = () => { if (running && m) { saveGame(); m.geoDirty = false; } };
        document.addEventListener("visibilitychange", () => { if (document.hidden) saveIfRunning(); });
        addEventListener("pagehide", saveIfRunning);
    }

    /* test hooks (used by tests/metro.test.js; harmless in the browser) */
    const _test = {
        ROOMS, TS, COLS, ROWS, RW, RH,
        init(abilities) { ensure(); Object.assign(m.abilities, abilities || {}); S = { parts: [], shake: 0, hitstop: 0, paused: false, dead: 0 }; P = newPlayer(); return { m, P }; },
        load(id, x, y) { loadRoom(id, { x, y }); P.hp = m.hpMax; return P; },
        step(keys) { Object.assign(K, { left: 0, right: 0, up: 0, down: 0, jump: 0, heal: 0, jumpP: 0, atkP: 0, dashP: 0, spP: 0, upP: 0 }, keys || {}); step(); return P; },
        get P() { return P; }, get S() { return S; }, get R() { return R; }, grounded: () => grounded(P)
    };
    return { start, stop, _test };
})();
window.Metro = Metro;
window.openMetro = function () { stopGame(); hideScreens(); Metro.start(); };
