/* =========================================================
   metroFx.js - feedback layer for "The Hollow Descent"
   * Descent options: screen shake, flashing effects, hit-stop,
     telegraph assist, reduced downtime, effects + ambient volume.
     Stored in save.settings.fx and save.settings.audio (cloud-synced
     with the rest of the save).
   * Procedural sound effects (WebAudio, no asset files). Respects the
     existing Sound toggle (save.settings.sound) and the effects volume.
   * Helpers metroid.js calls so every visual/audio effect has one
     place that checks the player's accessibility choices.
   No DOM is touched at load time, so tests/metro.test.js can load it.
========================================================= */
const MetroFx = (() => {

    const DEFAULTS = { fx: { shake: 1, flash: true, hitstop: true, telegraph: true, fastDeath: false },
                       audio: { sfx: 100, ambient: 100 } };
    const SHAKE_LEVELS = [0, .5, 1];                         // off, low, full
    const SHAKE_NAMES = ["Off", "Low", "Full"];
    const SFX_STEPS = [0, 25, 50, 75, 100];
    const TOGGLES = ["flash", "hitstop", "telegraph", "fastDeath"];
    /* Minimum gap (ms) between two plays of the same sound, so a flurry of
       hits or telegraphs never becomes a wall of noise. */
    const THROTTLE = { tell: 120, hit: 35, swing: 60, jump: 60, land: 90, dash: 60, shot: 80, pickup: 40, tick: 60 };

    /* Options rows shown in Settings and in the pause menu. Titles avoid the
       words "Music" and "Sound" because game.js matches those titles. */
    const ROWS = [
        ["shake", "Screen shake", "Camera shake on hits and heavy attacks."],
        ["flash", "Flashing effects", "Full-screen flashes for rest, boss phases and unlocks."],
        ["hitstop", "Hit-stop", "Brief freeze frames on hits. Off feels smoother for some players."],
        ["telegraph", "Telegraph assist", "Adds ! markers and dashed danger shapes before enemy attacks."],
        ["fastDeath", "Reduced downtime", "Shorter death fade so you return to the bench sooner."],
        ["sfx", "Effects volume", "Combat and interface sounds."],
        ["ambient", "Ambient volume", "Wind, drones and echoes in the Descent and Levels."]
    ];

    const clampInt = (v, lo, hi, d) => (typeof v === "number" && isFinite(v)) ? Math.max(lo, Math.min(hi, Math.round(v))) : d;

    /* Accepts anything (old, partial, corrupt) and returns a complete, valid object. */
    function normalize(raw) {
        raw = raw && typeof raw === "object" ? raw : {};
        const fx = raw.fx && typeof raw.fx === "object" ? raw.fx : {};
        const au = raw.audio && typeof raw.audio === "object" ? raw.audio : {};
        return {
            fx: {
                shake: clampInt(fx.shake, 0, 2, DEFAULTS.fx.shake),
                flash: fx.flash !== false,
                hitstop: fx.hitstop !== false,
                telegraph: fx.telegraph !== false,
                fastDeath: fx.fastDeath === true
            },
            audio: { sfx: clampInt(au.sfx, 0, 100, 100), ambient: clampInt(au.ambient, 0, 100, 100) }
        };
    }

    /* The live save object. game.js registers window.getSaveData; Node tests fall back to a global `save`. */
    const liveSave = () => (typeof window !== "undefined" && typeof window.getSaveData === "function") ? window.getSaveData() : (typeof globalThis.save === "object" ? globalThis.save : null);
    const store = () => { const sv = liveSave(); return (sv && sv.settings && typeof sv.settings === "object") ? sv.settings : null; };
    const get = () => normalize(store() || {});

    function set(group, key, value) {
        const s = store(); if (!s) return;
        const cur = normalize(s);
        cur[group][key] = value;
        s.fx = cur.fx; s.audio = cur.audio;
        if (typeof globalThis.saveGame === "function") globalThis.saveGame();
        applyAudio();
    }

    const nextStep = (steps, v) => steps[(steps.indexOf(steps.reduce((b, s) => Math.abs(s - v) < Math.abs(b - v) ? s : b, steps[0])) + 1) % steps.length];

    /* Called by the option buttons: advance one step / flip one toggle. */
    function cycle(key) {
        const cur = get();
        if (key === "shake") set("fx", "shake", (cur.fx.shake + 1) % SHAKE_LEVELS.length);
        else if (key === "sfx") set("audio", "sfx", nextStep(SFX_STEPS, cur.audio.sfx));
        else if (key === "ambient") set("audio", "ambient", nextStep(SFX_STEPS, cur.audio.ambient));
        else if (TOGGLES.includes(key)) set("fx", key, !cur.fx[key]);
    }

    function label(key) {
        const cur = get();
        if (key === "shake") return SHAKE_NAMES[cur.fx.shake];
        if (key === "sfx") return cur.audio.sfx + "%";
        if (key === "ambient") return cur.audio.ambient + "%";
        return cur.fx[key] ? "ON" : "OFF";
    }
    const isOn = key => key === "shake" ? get().fx.shake > 0 : (key === "sfx" || key === "ambient") ? get().audio[key] > 0 : (key === "fastDeath" ? get().fx.fastDeath : get().fx[key]);

    /* ---- HTML for the rows (used by Settings and the pause menu) ---- */
    function optionsHTML() {
        return ROWS.map(([key, title, desc]) =>
            `<div class="setting-row"><div><strong>${title}</strong><p>${desc}</p></div>` +
            `<button class="toggle-button" type="button" data-fx="${key}" style="background:${isOn(key) ? "#2e9b68" : "#33415f"}">${label(key)}</button></div>`
        ).join("");
    }
    function refreshLabels() {
        if (typeof document === "undefined") return;
        document.querySelectorAll("[data-fx]").forEach(b => {
            const k = b.dataset.fx;
            b.textContent = label(k);
            b.style.background = isOn(k) ? "#2e9b68" : "#33415f";
        });
    }
    /* Adds the rows to the Settings screen once (before its note). */
    function mountSettings() {
        if (typeof document === "undefined") return;
        const card = document.querySelector("#settings-screen .settings-card");
        if (!card || card.querySelector("[data-fx]")) return;
        const note = card.querySelector(".settings-note");
        const head = document.createElement("div");
        head.className = "eyebrow"; head.style.marginTop = "22px"; head.textContent = "Descent & accessibility";
        card.insertBefore(head, note || null);
        const box = document.createElement("div");
        box.innerHTML = optionsHTML();
        while (box.firstChild) card.insertBefore(box.firstChild, note || null);
        refreshLabels();
    }
    if (typeof document !== "undefined") {
        document.addEventListener("click", e => {
            const b = e.target && e.target.closest && e.target.closest("[data-fx]");
            if (!b) return;
            cycle(b.dataset.fx); refreshLabels();
        });
    }

    /* ---- gates used by metroid.js ---- */
    const shakeScale = () => SHAKE_LEVELS[get().fx.shake];
    const freeze = n => get().fx.hitstop ? n : 0;                 // hit-stop frames to apply
    const flashOK = () => get().fx.flash;                         // may we draw full-screen flashes?
    const telegraphOn = () => get().fx.telegraph;
    const deadFrames = () => get().fx.fastDeath ? 40 : 80;

    /* ---- procedural sound ---- */
    let ac = null, out = null;
    const lastPlay = {};

    function ctxGet() {
        if (ac) return ac;
        const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return null;
        try { ac = new AC(); out = ac.createGain(); out.gain.value = 1; out.connect(ac.destination); } catch (e) { ac = null; }
        return ac;
    }

    /* Envelope: quick attack, exponential decay to silence. */
    function env(g, t0, dur, peak) {
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + .005);
        g.gain.exponentialRampToValueAtTime(.0008, t0 + dur);
    }
    function tone(c, dst, t0, f0, f1, dur, type, peak) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t0);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        env(g, t0, dur, peak); o.connect(g).connect(dst);
        o.start(t0); o.stop(t0 + dur + .05);
        o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) {} };
    }
    function noise(c, dst, t0, dur, peak, f0, f1, q) {
        const len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const s = c.createBufferSource(); s.buffer = buf;
        const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q || 1;
        bp.frequency.setValueAtTime(f0, t0); if (f1) bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        const g = c.createGain(); env(g, t0, dur, peak);
        s.connect(bp).connect(g).connect(dst); s.start(t0); s.stop(t0 + dur + .05);
        s.onended = () => { try { s.disconnect(); bp.disconnect(); g.disconnect(); } catch (e) {} };
    }

    /* Each sound: (ctx, destination, start time) -> schedules nodes. */
    const SFX = {
        jump:    (c, d, t) => tone(c, d, t, 330, 560, .09, "sine", .18),
        wing:    (c, d, t) => tone(c, d, t, 520, 780, .08, "triangle", .14),
        dash:    (c, d, t) => noise(c, d, t, .14, .22, 1400, 260, 1.2),
        land:    (c, d, t) => noise(c, d, t, .05, .14, 260, 120, .8),
        swing:   (c, d, t) => noise(c, d, t, .07, .14, 2200, 900, 2),
        hit:     (c, d, t) => { tone(c, d, t, 210, 120, .06, "square", .1); noise(c, d, t, .03, .12, 1800, 900, 1); },
        kill:    (c, d, t) => tone(c, d, t, 520, 200, .14, "triangle", .18),
        hurt:    (c, d, t) => { tone(c, d, t, 240, 90, .24, "sawtooth", .16); noise(c, d, t, .12, .15, 600, 200, 1); },
        heal:    (c, d, t) => { tone(c, d, t, 523, 523, .18, "sine", .16); tone(c, d, t + .1, 784, 784, .2, "sine", .14); },
        pickup:  (c, d, t) => tone(c, d, t, 880, 1320, .12, "sine", .16),
        unlock:  (c, d, t) => [392, 523, 659, 784].forEach((f, i) => tone(c, d, t + i * .12, f, f, .35, "sine", .2)),
        secret:  (c, d, t) => { noise(c, d, t, .3, .18, 300, 1200, 3); tone(c, d, t + .05, 660, 990, .25, "sine", .1); },
        rest:    (c, d, t) => { tone(c, d, t, 660, 660, .35, "sine", .14); tone(c, d, t + .08, 990, 990, .45, "sine", .1); },
        shot:    (c, d, t) => tone(c, d, t, 900, 400, .1, "triangle", .12),
        tell:    (c, d, t) => tone(c, d, t, 1600, 1600, .03, "sine", .07),
        tick:    (c, d, t) => tone(c, d, t, 1000, 1000, .02, "square", .04),
        shock:   (c, d, t) => { noise(c, d, t, .35, .26, 180, 60, .7); tone(c, d, t, 90, 40, .35, "sine", .25); },
        phase:   (c, d, t) => { tone(c, d, t, 110, 55, .7, "sawtooth", .2); noise(c, d, t, .5, .2, 400, 90, .8); },
        death:   (c, d, t) => tone(c, d, t, 200, 40, .9, "sawtooth", .2),
        bigdeath:(c, d, t) => { tone(c, d, t, 140, 30, 1.2, "sawtooth", .25); noise(c, d, t, .8, .18, 300, 60, .7); },
        hook:    (c, d, t) => tone(c, d, t, 600, 1500, .14, "sawtooth", .12),
        latch:   (c, d, t) => tone(c, d, t, 1000, 1000, .05, "square", .1),
        click:   (c, d, t) => tone(c, d, t, 150, 150, .04, "square", .08),
        lantern: (c, d, t) => { tone(c, d, t, 392, 523, .35, "sine", .14); tone(c, d, t + .1, 784, 784, .5, "sine", .05); },
        seal:    (c, d, t) => { noise(c, d, t, .45, .2, 500, 2000, 2); tone(c, d, t + .1, 523, 1046, .4, "sine", .1); },
        ui:      (c, d, t) => tone(c, d, t, 740, 740, .06, "sine", .08)
    };

    /* Play one named sound, honouring the Sound toggle, the effects volume and the throttle. */
    function play(name) {
        const def = SFX[name]; if (!def) return;
        const s = store(); if (s && s.sound === false) return;
        const vol = get().audio.sfx / 100; if (vol <= 0) return;
        const now = Date.now(), gap = THROTTLE[name] || 30;
        if (lastPlay[name] && now - lastPlay[name] < gap) return;
        lastPlay[name] = now;
        const c = ctxGet(); if (!c) return;
        if (c.state === "suspended") c.resume();
        const g = c.createGain(); g.gain.value = vol * .55; g.connect(out);
        try { def(c, g, c.currentTime + .005); } catch (e) { /* audio must never break the game */ }
    }

    /* Push the ambient volume to scenery.js. */
    function applyAudio() {
        if (typeof window !== "undefined" && window.Scenery && Scenery.setVolume) Scenery.setVolume(get().audio.ambient / 100);
    }

    if (typeof document !== "undefined" && document.getElementById("settings-screen")) mountSettings();

    return { DEFAULTS, ROWS, normalize, get, set, cycle, label, isOn, optionsHTML, refreshLabels, mountSettings,
             shakeScale, freeze, flashOK, telegraphOn, deadFrames, play, applyAudio, SFX, SHAKE_NAMES };
})();
if (typeof window !== "undefined") window.MetroFx = MetroFx;
