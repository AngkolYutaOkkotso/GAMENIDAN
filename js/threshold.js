/* =========================================================
   threshold.js - atmosphere for the loading + login screens
   * "Veil" canvases: rising soul motes and a few pale moths.
   * One shared requestAnimationFrame loop that only draws the
     canvases whose screen is visible, and stops entirely when
     none are (so the game itself never pays for it).
   * Gentle pointer parallax + rotating lore lines on the login art.
   * Honours prefers-reduced-motion: draws one still frame instead.
========================================================= */
(function () {
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const veils = [];
    let raf = 0, last = 0, pointer = { x: -9999, y: -9999 };

    /* One pre-rendered glow sprite: no per-frame gradients or shadowBlur. */
    const sprite = (() => {
        const c = document.createElement("canvas"), s = 64; c.width = c.height = s;
        const g = c.getContext("2d"), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        gr.addColorStop(0, "rgba(255,255,255,1)");
        gr.addColorStop(.18, "rgba(220,234,255,.85)");
        gr.addColorStop(.45, "rgba(150,180,230,.25)");
        gr.addColorStop(1, "rgba(120,150,210,0)");
        g.fillStyle = gr; g.fillRect(0, 0, s, s);
        return c;
    })();

    const rand = (a, b) => a + Math.random() * (b - a);

    function mote(v, anywhere) {
        return {
            x: rand(0, v.w), y: anywhere ? rand(0, v.h) : v.h + rand(10, 80),
            r: rand(.6, 2.3), vy: -rand(.12, .55), sway: rand(.4, 1.6), ph: rand(0, 6.28),
            tw: rand(.01, .035), a: rand(.25, .9)
        };
    }
    function moth(v) {
        return {
            x: rand(0, v.w), y: rand(v.h * .15, v.h * .85), vx: rand(-.4, .4), vy: rand(-.3, .3),
            s: rand(5, 9), ph: rand(0, 6.28), flap: rand(.18, .3), wander: rand(0, 6.28)
        };
    }

    function setup(canvas) {
        const v = {
            canvas, ctx: canvas.getContext("2d"), screen: canvas.closest(".screen"),
            kind: canvas.dataset.veil, w: 0, h: 0, motes: [], moths: []
        };
        resize(v);
        const n = Math.round(Math.min(90, (v.w * v.h) / 16000));
        for (let i = 0; i < n; i++) v.motes.push(mote(v, true));
        const m = v.kind === "login" ? 4 : 2;
        for (let i = 0; i < m; i++) v.moths.push(moth(v));
        veils.push(v);
    }

    function resize(v) {
        const r = v.canvas.getBoundingClientRect();
        v.w = Math.max(1, r.width || innerWidth); v.h = Math.max(1, r.height || innerHeight);
        v.canvas.width = Math.round(v.w * DPR); v.canvas.height = Math.round(v.h * DPR);
        v.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    const visible = v => v.screen && !v.screen.classList.contains("hidden") && v.screen.style.display !== "none";

    function drawMoth(ctx, m, t) {
        const flap = Math.abs(Math.sin(t * m.flap + m.ph));
        const ang = Math.atan2(m.vy, m.vx) + Math.PI / 2;
        ctx.save();
        ctx.translate(m.x, m.y); ctx.rotate(ang);
        ctx.globalAlpha = .55;
        ctx.drawImage(sprite, -m.s * 2.2, -m.s * 2.2, m.s * 4.4, m.s * 4.4);
        ctx.globalAlpha = .9;
        ctx.fillStyle = "rgba(232,238,248,.85)";
        const w = m.s * (.35 + flap * .9);
        ctx.beginPath(); ctx.ellipse(-w * .6, 0, w * .7, m.s * .6, -.5, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w * .6, 0, w * .7, m.s * .6, .5, 0, 6.283); ctx.fill();
        ctx.fillStyle = "#0b1019";
        ctx.fillRect(-.8, -m.s * .55, 1.6, m.s * 1.1);
        ctx.restore();
    }

    function step(v, dt, t) {
        const ctx = v.ctx;
        ctx.clearRect(0, 0, v.w, v.h);
        ctx.globalCompositeOperation = "lighter";

        const rect = v.canvas.getBoundingClientRect();
        const px = pointer.x - rect.left, py = pointer.y - rect.top;

        for (const p of v.motes) {
            if (!reduce) {
                p.y += p.vy * dt;
                p.x += Math.sin(t * .001 * p.sway + p.ph) * .25 * dt;
                const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
                if (d2 < 9000) { const f = (1 - d2 / 9000) * .9; p.x += dx / 60 * f * dt; p.y += dy / 60 * f * dt; }
                if (p.y < -20) Object.assign(p, mote(v, false));
            }
            const a = p.a * (.55 + .45 * Math.sin(t * p.tw * .06 + p.ph));
            const s = p.r * 7;
            ctx.globalAlpha = Math.max(0, a);
            ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
        }

        ctx.globalCompositeOperation = "source-over";
        for (const m of v.moths) {
            if (!reduce) {
                m.wander += rand(-.08, .08) * dt;
                m.vx += Math.cos(m.wander) * .012 * dt; m.vy += Math.sin(m.wander) * .012 * dt;
                const dx = px - m.x, dy = py - m.y, d = Math.hypot(dx, dy);
                if (d < 260 && d > 40) { m.vx += dx / d * .01 * dt; m.vy += dy / d * .01 * dt; }   // moths drift toward light
                const sp = Math.hypot(m.vx, m.vy), max = 1.1;
                if (sp > max) { m.vx *= max / sp; m.vy *= max / sp; }
                m.x += m.vx * dt; m.y += m.vy * dt;
                if (m.x < -30) m.x = v.w + 30; if (m.x > v.w + 30) m.x = -30;
                if (m.y < -30) m.y = v.h + 30; if (m.y > v.h + 30) m.y = -30;
            }
            drawMoth(ctx, m, t * .06);
        }
        ctx.globalAlpha = 1;
    }

    function frame(now) {
        raf = 0;
        const dt = Math.min(3, last ? (now - last) / 16.67 : 1); last = now;
        let any = false;
        for (const v of veils) if (visible(v)) { any = true; step(v, dt, now); }
        if (any && !reduce && !document.hidden) raf = requestAnimationFrame(frame);
        else last = 0;
    }
    function wake() {
        if (raf) return;
        if (reduce) { veils.forEach(v => visible(v) && step(v, 1, 0)); return; }
        raf = requestAnimationFrame(frame);
    }

    /* Login art: pointer parallax and a slowly changing line of lore. */
    const LORE = [
        "“Every vessel begins at the gate. Few remember the way back.”",
        "“The lantern does not light the road. It lights the one who walks it.”",
        "“Seven realms sleep below. Each one dreams of you.”",
        "“Geo is only stone. What you carry down is what you keep.”",
        "“The moths follow light. Be the light.”"
    ];
    function loreCycle() {
        const el = document.getElementById("threshold-lore");
        if (!el || reduce) return;
        let i = 0;
        setInterval(() => {
            const screen = document.getElementById("login-screen");
            if (!screen || screen.classList.contains("hidden") || document.hidden) return;
            el.classList.add("swap");
            setTimeout(() => { i = (i + 1) % LORE.length; el.textContent = LORE[i]; el.classList.remove("swap"); }, 600);
        }, 7000);
    }

    function init() {
        document.querySelectorAll("canvas[data-veil]").forEach(setup);
        const obs = new MutationObserver(() => { veils.forEach(v => visible(v) && resize(v)); wake(); });
        veils.forEach(v => v.screen && obs.observe(v.screen, { attributes: true, attributeFilter: ["class", "style"] }));
        addEventListener("resize", () => { veils.forEach(resize); wake(); });
        document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
        addEventListener("pointermove", e => {
            pointer.x = e.clientX; pointer.y = e.clientY;
            const login = document.getElementById("login-screen");
            if (login && !login.classList.contains("hidden") && !reduce) {
                login.style.setProperty("--mx", (e.clientX / innerWidth - .5).toFixed(3));
                login.style.setProperty("--my", (e.clientY / innerHeight - .5).toFixed(3));
            }
        }, { passive: true });
        addEventListener("pointerleave", () => { pointer.x = pointer.y = -9999; });
        loreCycle();
        wake();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
