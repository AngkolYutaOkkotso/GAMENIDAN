/* =========================================================
   gachaAnimation.js - Hollow-style wish cinematic, fully synced
   ONE clock drives everything. When the wish is made:
     t = 0            soul-streak starts falling, whoosh audio rises
     t = 55 % fall    streak changes colour to the best rarity + rising "tell" ping
     t = meteor       impact: boom + white flash + particle burst (same instant)
     t = meteor+flash cards flip one by one; each flip has its own chime
                      (CSS animation-delay and audio start time share the
                      same offsets, so picture and sound land together)
   Skip jumps straight to the reveal and fades the audio out.
   Usage: await GachaAnimation.play(results)
========================================================= */
const GachaAnimation = (() => {

    /* ---- EDIT ME: timings in milliseconds ---- */
    const TIMINGS = { meteor: 2600, flash: 600, cardStep: 380 };

    const COLORS = { 3: "#8fc1e3", 4: "#a98be0", 5: "#f6e7ae" };   // pale blue / violet / pale gold
    const CHIME = { 3: [523], 4: [659, 784], 5: [784, 988, 1175] };  // notes per rarity (Hz)
    const ease = t => t * t, easeOut = t => 1 - Math.pow(1 - t, 3);

    const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; };

    /* ---------------- audio (Web Audio, no files) ---------------- */
    let ac = null;
    function audio() {
        if (!save.settings.sound) return null;
        if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
        if (ac.state === "suspended") ac.resume();         // the wish click is the user gesture
        return ac;
    }
    const noiseBuf = c => { const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };

    function tone(c, bus, at, freq, dur, vol, type = "triangle") {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
        o.connect(g).connect(bus); o.start(at); o.stop(at + dur + 0.05);
    }
    function whoosh(c, bus, at, dur) {                     // rising filtered noise, ends exactly at impact
        const n = c.createBufferSource(); n.buffer = noiseBuf(c); n.loop = true;
        const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
        f.frequency.setValueAtTime(180, at); f.frequency.exponentialRampToValueAtTime(3200, at + dur);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.5, at + dur * 0.97); g.gain.linearRampToValueAtTime(0, at + dur + 0.04);
        n.connect(f).connect(g).connect(bus); n.start(at); n.stop(at + dur + 0.1);
    }
    function impact(c, bus, at, rarity) {                  // low boom + noise crack + rarity chord
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(140, at); o.frequency.exponentialRampToValueAtTime(38, at + 0.7);
        g.gain.setValueAtTime(0.9, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.9);
        o.connect(g).connect(bus); o.start(at); o.stop(at + 1);
        const n = c.createBufferSource(); n.buffer = noiseBuf(c); const ng = c.createGain();
        ng.gain.setValueAtTime(0.5, at); ng.gain.exponentialRampToValueAtTime(0.001, at + 0.35);
        n.connect(ng).connect(bus); n.start(at); n.stop(at + 0.4);
        CHIME[rarity].forEach((f, i) => tone(c, bus, at + 0.05 + i * 0.05, f / 2, 1.6, 0.12, "sine"));
    }

    /* ---------------------------- play ---------------------------- */
    function play(results) {
        return new Promise(resolve => {
            const best = Math.max(...results.map(r => r.rarity));
            const color = COLORS[best], baseColor = COLORS[3];
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const { meteor: tMeteor, flash: tFlashLen, cardStep } = TIMINGS;
            const tReveal = tMeteor + tFlashLen;

            const overlay = document.createElement("div");
            overlay.id = "wish-overlay";
            overlay.innerHTML = `<canvas></canvas><button class="wish-skip">Skip ⏭</button><div class="wish-results hidden"></div>`;
            document.body.appendChild(overlay);
            const canvas = overlay.querySelector("canvas"), ctx = canvas.getContext("2d");
            const skipBtn = overlay.querySelector(".wish-skip"), box = overlay.querySelector(".wish-results");
            let W, H, raf, start = performance.now(), revealed = false, done = false, burstDone = false, tellDone = false;

            /* audio timeline: everything scheduled against ONE origin */
            const c = audio();
            const bus = c ? c.createGain() : null;     // cinematic (whoosh/boom) - silenced by Skip
            const cbus = c ? c.createGain() : null;    // card chimes - always audible
            if (c) { bus.gain.value = 0.8; bus.connect(c.destination); cbus.gain.value = 0.8; cbus.connect(c.destination); }
            const A0 = c ? c.currentTime + 0.05 : 0;     // audio origin = animation t=0 (50 ms lead)
            if (c && !reduced) {
                whoosh(c, bus, A0, tMeteor / 1000);
                impact(c, bus, A0 + tMeteor / 1000, best);
                tone(c, bus, A0 + tMeteor * 0.55 / 1000, CHIME[best][0] * 2, 1.0, 0.1);   // rarity "tell" ping
            }

            function resize() {
                const dpr = Math.min(devicePixelRatio || 1, 2);
                W = innerWidth; H = innerHeight; canvas.width = W * dpr; canvas.height = H * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
            resize(); addEventListener("resize", resize);

            const motes = Array.from({ length: 200 }, () => ({ a: Math.random() * 6.283, d: Math.random() * .9 + .05, s: Math.random() * .6 + .2 }));
            const sparks = [];
            const burst = () => { for (let i = 0; i < 150; i++) { const a = Math.random() * 6.283, sp = 2 + Math.random() * 9; sparks.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: 1 + Math.random() * 3 }); } };

            function reveal() {
                if (revealed) return; revealed = true;
                skipBtn.classList.add("hidden"); box.classList.remove("hidden");
                const lead = 60;                                           // ms before the first flip
                box.innerHTML = `
                  <div class="wish-grid ${results.length > 1 ? "multi" : ""}">
                    ${results.map((r, i) => {
                        const hero = Gacha.heroById(r.heroId), col = COLORS[r.rarity], d = lead + i * (reduced ? 0 : cardStep);
                        return `<div class="wish-card r${r.rarity}" style="--c:${col};animation-delay:${d}ms">
                            <i class="wish-flash" style="animation-delay:${d}ms"></i>
                            ${renderPixelHero(hero)}
                            <div class="wish-stars">${"★".repeat(r.rarity)}</div>
                            <strong>${hero.name}</strong>
                            <small>${r.isNew ? "✦ NEW VESSEL" : "Duplicate → +" + r.refund + " ◈"}</small>
                        </div>`; }).join("")}
                  </div>
                  <button class="game-button primary wish-continue" style="animation-delay:${lead + results.length * cardStep + 200}ms">Continue</button>`;
                box.querySelector(".wish-continue").onclick = close;
                /* chimes: same offsets as the CSS delays above */
                if (c) {
                    const base = c.currentTime;
                    results.forEach((r, i) => {
                        const at = base + (lead + i * (reduced ? 0 : cardStep)) / 1000;
                        CHIME[r.rarity].forEach((f, k) => tone(c, cbus, at + k * 0.07, f, r.rarity === 5 ? 1.8 : 0.9, r.rarity === 5 ? 0.16 : 0.1));
                    });
                }
            }

            function close() {
                if (done) return; done = true;
                cancelAnimationFrame(raf); removeEventListener("resize", resize);
                if (bus) { bus.gain.setTargetAtTime(0, c.currentTime, 0.1); cbus.gain.setTargetAtTime(0, c.currentTime, 0.1); }
                overlay.remove(); resolve();
            }

            function frame(now) {
                const t = now - start;
                if (reduced && !revealed) { burst(); reveal(); }

                ctx.clearRect(0, 0, W, H);
                const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .8);
                bg.addColorStop(0, t > tMeteor ? color + "44" : "#0d1420"); bg.addColorStop(1, "#02030a");
                ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

                const zoom = t < tMeteor ? 1 + .12 * ease(t / tMeteor) : 1.12 - .12 * easeOut(Math.min(1, (t - tMeteor) / 1200));
                ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);

                /* drifting soul motes streaming outward (speed follows the whoosh) */
                const speed = .002 + .02 * Math.min(1, t / tMeteor);
                ctx.lineCap = "round";
                motes.forEach(m => {
                    const r0 = m.d * Math.max(W, H) * .6, r1 = r0 + 10 + m.s * 40 * speed * 50;
                    m.d += m.s * speed; if (m.d > 1) m.d = .02;
                    ctx.strokeStyle = `rgba(200,220,240,${.2 + m.s * .5})`; ctx.lineWidth = m.s * 1.6;
                    ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(m.a) * r0, H / 2 + Math.sin(m.a) * r0);
                    ctx.lineTo(W / 2 + Math.cos(m.a) * r1, H / 2 + Math.sin(m.a) * r1); ctx.stroke();
                });

                /* falling soul-streak: pale blue -> rarity colour at 55 % (matches the audio "tell") */
                if (t < tMeteor) {
                    const k = Math.min(1, t / tMeteor), p = ease(k);
                    const col = mix(baseColor, color, Math.min(1, Math.max(0, (k - .55) / .12)));
                    if (!tellDone && k >= .55) tellDone = true;
                    const x = W * .85 + (W * .5 - W * .85) * p, y = -60 + (H * .5 + 60) * p;
                    const tx = x + W * .35 * (1 - p) + 40, ty = y - H * .5 * (1 - p) - 40;
                    const g = ctx.createLinearGradient(x, y, tx, ty); g.addColorStop(0, col); g.addColorStop(1, "transparent");
                    ctx.strokeStyle = g; ctx.lineWidth = 8 + 10 * p; ctx.shadowColor = col; ctx.shadowBlur = 30;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
                    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 6 + 8 * p, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
                }

                if (t >= tMeteor && !burstDone) { burst(); burstDone = true; }       // same instant as the boom
                sparks.forEach(s => { s.x += s.vx; s.y += s.vy; s.vx *= .97; s.vy *= .97; s.life -= .012;
                    if (s.life > 0) { ctx.fillStyle = color; ctx.globalAlpha = s.life; ctx.fillRect(s.x, s.y, s.size, s.size); } });
                ctx.globalAlpha = 1;

                if (t >= tMeteor) {                                                  // slow light rays behind the cards
                    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(t / 5000); ctx.fillStyle = color; ctx.globalAlpha = .06 + (best === 5 ? .05 : 0);
                    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -Math.max(W, H)); ctx.lineTo(40, -Math.max(W, H)); ctx.fill(); }
                    ctx.restore();
                }
                ctx.restore();

                if (t >= tMeteor && t < tReveal + 300) {                              // white flash
                    ctx.fillStyle = `rgba(255,255,255,${1 - Math.min(1, (t - tMeteor) / (tFlashLen + 300))})`; ctx.fillRect(0, 0, W, H);
                }
                if (t >= tReveal && !revealed) reveal();
                raf = requestAnimationFrame(frame);
            }

            skipBtn.onclick = () => {
                start = performance.now() - tReveal;                 // jump visuals to the reveal...
                if (bus) bus.gain.setTargetAtTime(0, c.currentTime, 0.05);   // ...and silence the whoosh/boom
                burstDone = true;
            };
            raf = requestAnimationFrame(frame);
        });
    }

    return { play, TIMINGS };
})();
window.GachaAnimation = GachaAnimation;
