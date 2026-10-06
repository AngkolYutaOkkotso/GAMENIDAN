/* =========================================================
   scenery.js - atmosphere on top of the existing parallax art
   * drifting particles per world (pollen, spores, embers, snow...)
   * fog bands that scroll at their own parallax speed
   * dynamic lighting: darkness + vignette with a glow around the player
   * procedural ambient audio (wind + drone + distant echoes) that
     cross-fades between worlds. No audio files needed.
   Called from game.js: setWorld(), draw(), pauseAmbient().
========================================================= */
const Scenery = (() => {

    /* ---- EDIT ME: one entry per world (same order as `worlds` in game.js) ----
       dark = how dark the level is (0-1), fog = fog colour,
       p = particle style, root = drone note (Hz), wind = wind filter (Hz) */
    const THEMES = [
        { dark: .35, fog: "150,170,190", glow: "200,220,255", p: { c: "200,215,235", n: 45, vy: -.25, vx: .2,  s: 2.2 }, root: 196, wind: 500 },  // meadows: pollen
        { dark: .45, fog: "120,170,130", glow: "200,255,180", p: { c: "170,255,150", n: 60, vy: -.12, vx: .1,  s: 2.6 }, root: 147, wind: 380 },  // forest: spores
        { dark: .55, fog: "110,120,200", glow: "150,190,255", p: { c: "150,200,255", n: 55, vy: -.05, vx: .05, s: 2.0, twinkle: 1 }, root: 110, wind: 220 }, // caves: crystal dust
        { dark: .35, fog: "160,180,200", glow: "210,225,245", p: { c: "255,255,255", n: 35, vy: -.1,  vx: .6,  s: 3.0 }, root: 220, wind: 700 },  // clouds: wisps
        { dark: .45, fog: "200,90,60",   glow: "255,160,80",  p: { c: "255,150,60",  n: 70, vy: -1.1, vx: .3,  s: 2.4 }, root: 98,  wind: 300 },  // volcano: embers
        { dark: .25, fog: "230,245,255", glow: "220,240,255", p: { c: "255,255,255", n: 90, vy: .9,   vx: -.35, s: 2.4 }, root: 175, wind: 800 }, // ice: snow
        { dark: .62, fog: "140,100,170", glow: "230,180,255", p: { c: "220,170,255", n: 50, vy: -.15, vx: .1,  s: 2.4, twinkle: 1 }, root: 87,  wind: 260 }   // castle: motes
    ];

    let world = 0, lastCam = 0, parts = [];

    /* ------------------------- visuals -------------------------
       Everything expensive (gradients, glows, fog, vignette) is rendered ONCE
       into small offscreen canvases and then just blitted with drawImage.
       No per-frame gradients and no shadowBlur -> much cheaper than before.
       An FPS monitor lowers `quality` automatically on slow devices.      */
    let quality = 2;                 // 2 = full, 1 = lighter, 0 = minimal
    let ema = 16.7, lastNow = 0, frames = 0;
    let cache = { key: "", sprite: null, light: null, glow: null, fog: null, vignette: null, W: 0, H: 0 };

    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

    function buildCache(w, h) {
        const t = THEMES[world] || THEMES[0], g0 = mk(1, 1).getContext("2d");
        const c = { key: world + ":" + w + "x" + h, W: w, H: h };

        /* particle sprite: soft glowing dot */
        c.sprite = mk(32, 32); let g = c.sprite.getContext("2d");
        let rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        rg.addColorStop(0, `rgba(${t.p.c},1)`); rg.addColorStop(.35, `rgba(${t.p.c},.55)`); rg.addColorStop(1, `rgba(${t.p.c},0)`);
        g.fillStyle = rg; g.fillRect(0, 0, 32, 32);

        /* light mask: transparent centre -> dark edge. Drawn centred on the player. */
        const R = Math.max(w, h) * .6;
        c.R = R; c.light = null;
        if (t.dark > 0) {
            c.light = mk(Math.ceil(R * 2), Math.ceil(R * 2)); g = c.light.getContext("2d");
            rg = g.createRadialGradient(R, R, 40, R, R, R);
            rg.addColorStop(0, "rgba(5,8,20,0)"); rg.addColorStop(1, `rgba(5,8,20,${t.dark})`);
            g.fillStyle = rg; g.fillRect(0, 0, R * 2, R * 2);
        }

        /* warm/cool glow around the player */
        c.glow = mk(320, 320); g = c.glow.getContext("2d");
        rg = g.createRadialGradient(160, 160, 0, 160, 160, 150);
        rg.addColorStop(0, `rgba(${t.glow},${t.dark > 0 ? .24 : .1})`); rg.addColorStop(1, `rgba(${t.glow},0)`);
        g.fillStyle = rg; g.fillRect(0, 0, 320, 320);

        /* fog texture: tileable row of soft puffs (seamless horizontally) */
        c.fog = mk(1024, 200); g = c.fog.getContext("2d");
        for (let i = 0; i < 9; i++) {
            const x = i * 128 + (i * 53 % 40), y = 70 + (i * 37 % 60), r = 90 + (i * 29 % 50);
            for (const dx of [-1024, 0, 1024]) {
                rg = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
                rg.addColorStop(0, `rgba(${t.fog},.5)`); rg.addColorStop(1, `rgba(${t.fog},0)`);
                g.fillStyle = rg; g.fillRect(x + dx - r, y - r, r * 2, r * 2);
            }
        }

        /* static vignette */
        c.vignette = mk(w, h); g = c.vignette.getContext("2d");
        rg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .45, w / 2, h / 2, Math.max(w, h) * .8);
        rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(1, "rgba(0,0,0,.4)");
        g.fillStyle = rg; g.fillRect(0, 0, w, h);
        cache = c;
    }

    function spawn(theme, w, h, anywhere) {
        const p = theme.p;
        return { x: Math.random() * w, y: anywhere ? Math.random() * h : (p.vy < 0 ? h + 10 : -10),
                 z: .3 + Math.random() * .7, ph: Math.random() * 6.28, r: p.s * (.5 + Math.random()) };
    }
    function rebuild() {
        const t = THEMES[world] || THEMES[0];
        parts = Array.from({ length: t.p.n }, () => spawn(t, innerWidth, innerHeight, true));
        cache.key = "";                                     // force cache rebuild
    }

    function adaptQuality(now) {                            // called once per frame
        if (lastNow) ema += ((now - lastNow) - ema) * .05;
        lastNow = now;
        if (++frames % 90) return;
        if (ema > 24 && quality > 0) quality--;             // < ~42 fps  -> cheaper
        else if (ema < 17.5 && quality < 2 && frames % 540 === 0) quality++;   // healthy for a while -> richer again
    }

    function draw(ctx, { cameraX, world: wi, player }) {
        const now = performance.now();
        adaptQuality(now);
        if (wi !== world) { world = wi; rebuild(); }
        if (!parts.length) rebuild();
        const w = innerWidth, h = innerHeight, sec = now / 1000, t = THEMES[world] || THEMES[0];
        if (cache.key !== world + ":" + w + "x" + h) buildCache(w, h);
        const dCam = cameraX - lastCam; lastCam = cameraX;

        /* fog: 3 layers, each with its own parallax + drift speed */
        if (quality >= 2) {
            for (let i = 0; i < 3; i++) {
                const y = h * (.5 + i * .16) - 100, sc = 1 + i * .35, tw = 1024 * sc;
                const off = -(((cameraX * (.12 + i * .1) + sec * (6 + i * 5)) % tw + tw) % tw);
                ctx.globalAlpha = .55 - i * .12;
                for (let x = off; x < w; x += tw) ctx.drawImage(cache.fog, x, y, tw, 200 * sc);
            }
            ctx.globalAlpha = 1;
        }

        /* particles: pre-rendered sprite, no shadowBlur */
        if (quality >= 1) {
            const step = quality === 2 ? 1 : 2;
            for (let i = 0; i < parts.length; i += step) {
                const p = parts[i];
                p.x += t.p.vx * p.z - dCam * p.z * .6 + Math.sin(sec + p.ph) * .15;
                p.y += t.p.vy * p.z;
                if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
                if (p.y < -12 || p.y > h + 12) Object.assign(p, spawn(t, w, h, false));
                ctx.globalAlpha = (.3 + .5 * p.z) * (t.p.twinkle ? .5 + .5 * Math.sin(sec * 3 + p.ph) : 1);
                const d = p.r * p.z * 6;
                ctx.drawImage(cache.sprite, p.x - d / 2, p.y - d / 2, d, d);
            }
            ctx.globalAlpha = 1;
        }

        /* dynamic lighting: dark mask follows the player (sprite + 4 solid rects) */
        const px = player.x - cameraX + player.width / 2, py = player.y + player.height / 2;
        if (cache.light) {
            const R = cache.R, L = px - R, T = py - R, col = `rgba(5,8,20,${t.dark})`;
            ctx.drawImage(cache.light, L, T);
            ctx.fillStyle = col;
            ctx.fillRect(0, 0, w, Math.max(0, T));                         // above
            ctx.fillRect(0, T + R * 2, w, Math.max(0, h - T - R * 2));    // below
            const y0 = Math.max(0, T), y1 = Math.min(h, T + R * 2);
            if (y1 > y0) {
                ctx.fillRect(0, y0, Math.max(0, L), y1 - y0);                       // left
                ctx.fillRect(L + R * 2, y0, Math.max(0, w - L - R * 2), y1 - y0);   // right
            }
        }
        if (quality >= 1) {
            const f = 1 + Math.sin(sec * 7) * .04, s = 320 * f;
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(cache.glow, px - s / 2, py - s / 2, s, s);
            ctx.globalCompositeOperation = "source-over";
        }
        ctx.drawImage(cache.vignette, 0, 0);
    }

    /* -------------------------- audio -------------------------- */
    let ac, master, windGain, windFilter, drones = [], echoTimer, delay;

    function initAudio() {
        if (ac) return;
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ac = new AC(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);

        /* wind = looping noise -> band-pass, slowly modulated by an LFO */
        const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
        let last = 0; for (let i = 0; i < d.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        const noise = ac.createBufferSource(); noise.buffer = buf; noise.loop = true;
        windFilter = ac.createBiquadFilter(); windFilter.type = "bandpass"; windFilter.Q.value = .8;
        windGain = ac.createGain(); windGain.gain.value = .5;
        const lfo = ac.createOscillator(), lfoAmt = ac.createGain(); lfo.frequency.value = .12; lfoAmt.gain.value = .25;
        lfo.connect(lfoAmt).connect(windGain.gain); lfo.start();
        noise.connect(windFilter).connect(windGain).connect(master); noise.start();

        /* soft detuned drone pad */
        [1, 1.5, 2].forEach((mult, i) => {
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = "sine"; g.gain.value = .045 / (i + 1); o.connect(g).connect(master); o.start();
            drones.push({ o, mult });
        });

        /* distant echoing "plinks" through a feedback delay */
        delay = ac.createDelay(2); delay.delayTime.value = .55;
        const fb = ac.createGain(); fb.gain.value = .5; const wet = ac.createGain(); wet.gain.value = .5;
        delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
        echoTimer = setInterval(() => {
            if (!ac || master.gain.value < .01 || Math.random() < .5) return;
            const t = THEMES[world] || THEMES[0], o = ac.createOscillator(), g = ac.createGain();
            o.type = "triangle"; o.frequency.value = t.root * [2, 3, 4, 5][Math.floor(Math.random() * 4)];
            g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(.06, ac.currentTime + .02);
            g.gain.exponentialRampToValueAtTime(.0005, ac.currentTime + 1.2);
            o.connect(g); g.connect(delay); g.connect(master); o.start(); o.stop(ac.currentTime + 1.3);
        }, 3500);
    }

    /* Smoothly move wind/drone pitch to the new world's values (cross-fade). */
    function applyWorldAudio(ramp) {
        if (!ac) return;
        const t = THEMES[world] || THEMES[0], now = ac.currentTime;
        windFilter.frequency.cancelScheduledValues(now); windFilter.frequency.linearRampToValueAtTime(t.wind, now + ramp);
        drones.forEach(({ o, mult }) => { o.frequency.cancelScheduledValues(now); o.frequency.linearRampToValueAtTime(t.root * mult, now + ramp); });
    }
    function fadeTo(v, s) { if (!ac) return; const n = ac.currentTime; master.gain.cancelScheduledValues(n); master.gain.setTargetAtTime(v, n, s); }

    function setWorld(i) {
        world = i; rebuild();
        initAudio(); if (!ac) return;
        if (ac.state === "suspended") ac.resume();
        applyWorldAudio(2.5);
        fadeTo(save.settings.music ? .5 : 0, .8);        // ambience follows the Music toggle
    }
    function pauseAmbient() { fadeTo(0, .4); }

    /* Browsers only allow audio after a user gesture. */
    ["pointerdown", "keydown"].forEach(ev => addEventListener(ev, () => { if (ac && ac.state === "suspended") ac.resume(); }, { passive: true }));

    return { draw, setWorld, pauseAmbient, THEMES };
})();
window.Scenery = Scenery;
