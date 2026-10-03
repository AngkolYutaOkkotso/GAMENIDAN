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

    /* ------------------------- visuals ------------------------- */
    function spawn(theme, w, h, anywhere) {
        const p = theme.p;
        return { x: Math.random() * w, y: anywhere ? Math.random() * h : (p.vy < 0 ? h + 10 : -10),
                 z: .3 + Math.random() * .7, ph: Math.random() * 6.28, r: p.s * (.5 + Math.random()) };
    }
    function rebuild() {
        const t = THEMES[world] || THEMES[0], w = innerWidth, h = innerHeight;
        parts = Array.from({ length: t.p.n }, () => spawn(t, w, h, true));
    }

    function draw(ctx, { cameraX, world: wi, player }) {
        if (wi !== world) { world = wi; rebuild(); }
        if (!parts.length) rebuild();
        const t = THEMES[world] || THEMES[0], w = innerWidth, h = innerHeight, now = performance.now() / 1000;
        const dCam = cameraX - lastCam; lastCam = cameraX;

        /* fog bands (3 layers, each with its own parallax) */
        for (let i = 0; i < 3; i++) {
            const y = h * (.45 + i * .17), off = ((cameraX * (.1 + i * .08) + now * (8 + i * 6)) % w);
            const g = ctx.createLinearGradient(0, y - 90, 0, y + 90);
            g.addColorStop(0, `rgba(${t.fog},0)`); g.addColorStop(.5, `rgba(${t.fog},${.07 + i * .02})`); g.addColorStop(1, `rgba(${t.fog},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(-off, y - 90, w * 2, 180); ctx.fillRect(w * 2 - off, y - 90, w * 2, 180);
        }

        /* particles (screen-space, drift + camera parallax) */
        ctx.save();
        parts.forEach(p => {
            p.x += t.p.vx * p.z - dCam * p.z * .6 + Math.sin(now + p.ph) * .15;
            p.y += t.p.vy * p.z;
            if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
            if (p.y < -12 || p.y > h + 12) Object.assign(p, spawn(t, w, h, false));
            const a = (.25 + .5 * p.z) * (t.p.twinkle ? .5 + .5 * Math.sin(now * 3 + p.ph) : 1);
            ctx.globalAlpha = a; ctx.fillStyle = `rgb(${t.p.c})`;
            ctx.shadowColor = `rgb(${t.p.c})`; ctx.shadowBlur = 6 * p.z;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.z, 0, 6.283); ctx.fill();
        });
        ctx.restore();

        /* dynamic lighting: darkness with a lit hole around the player + vignette */
        const px = player.x - cameraX + player.width / 2, py = player.y + player.height / 2;
        if (t.dark > 0) {
            const g = ctx.createRadialGradient(px, py, 40, px, py, Math.max(w, h) * .6);
            g.addColorStop(0, "rgba(5,8,20,0)"); g.addColorStop(1, `rgba(5,8,20,${t.dark})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }
        const flicker = 1 + Math.sin(now * 7) * .04;
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 150 * flicker);
        glow.addColorStop(0, `rgba(${t.glow},${t.dark > 0 ? .22 : .08})`); glow.addColorStop(1, `rgba(${t.glow},0)`);
        ctx.fillStyle = glow; ctx.fillRect(px - 160, py - 160, 320, 320);
        ctx.restore();
        const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .45, w / 2, h / 2, Math.max(w, h) * .8);
        v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.35)");
        ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
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
