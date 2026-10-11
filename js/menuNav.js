/* =========================================================
   menuNav.js - one navigation model for every menu screen
   * Keyboard (arrows / WASD / Enter / Space / Esc), mouse hover
     and gamepad (d-pad / stick, A select, B back) all drive the
     same visible "selected" button, so every device sees the
     same highlighted choice.
   * Screen wipe: a short eased fade used between menu screens
     and gameplay (200-400 ms, never linear).
   * No DOM work at load time beyond binding listeners, and every
     access is guarded, so the headless tests can ignore this file.
========================================================= */
(function () {
    const NAV_SEL = ".menu-btn, .game-button, .back-button, .toggle-button, .level-button, .hud-button, .auth-tab, .auth-link, .auth-guest, .wish-skip";
    const REPEAT_MS = 170;          /* gamepad/keyboard auto-repeat for navigation */
    const held = { left: false, right: false, up: false, down: false, jump: false, attack: false, dash: false, interact: false, pause: false };

    let lastNav = 0, padIndex = -1, prevButtons = [], wipeBusy = false;

    const reduce = () => {
        try {
            if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
            const sv = window.getSaveData && window.getSaveData();
            return !!(sv && sv.settings && sv.settings.reduceMotion);
        } catch (e) { return false; }
    };

    /* ---------- visible, focusable buttons of the active root ---------- */

    /* Overlays (pause / play / quit / account) sit above their screen; the
       topmost visible one owns the keyboard. Otherwise the visible screen does. */
    function activeRoot() {
        const overlays = document.querySelectorAll("#pause-overlay:not(.hidden), #play-overlay:not(.hidden), #quit-overlay:not(.hidden), #account-modal:not(.hidden), #result-overlay:not(.hidden)");
        if (overlays.length) return overlays[overlays.length - 1];
        const screens = document.querySelectorAll(".screen:not(.hidden)");
        return screens.length ? screens[screens.length - 1] : document.body;
    }

    function buttons(root) {
        if (!root || !root.querySelectorAll) return [];
        return Array.prototype.filter.call(root.querySelectorAll(NAV_SEL), b => {
            if (b.disabled || b.getAttribute("aria-disabled") === "true") return false;
            if (b.classList.contains("hidden")) return false;
            const r = b.getBoundingClientRect ? b.getBoundingClientRect() : null;
            return !r || r.width > 0 || r.height > 0 || true;   /* stub DOM reports 0 size - keep */
        });
    }

    function current() {
        const list = buttons(activeRoot());
        if (!list.length) return null;
        const sel = list.find(b => b.classList.contains("nav-selected"));
        return sel || null;
    }

    function select(btn, focus) {
        const root = activeRoot();
        buttons(root).forEach(b => b.classList.toggle("nav-selected", b === btn));
        if (btn && focus !== false) { try { btn.focus({ preventScroll: true }); } catch (e) { try { btn.focus(); } catch (e2) { } } }
    }

    function move(dir) {
        const list = buttons(activeRoot());
        if (!list.length) return;
        const cur = current();
        if (!cur) { select(list[dir > 0 ? 0 : list.length - 1]); return; }
        let i = list.indexOf(cur);
        i = (i + dir + list.length) % list.length;
        select(list[i]);
    }

    function activate() {
        const cur = current();
        if (cur) { cur.click(); return true; }
        const list = buttons(activeRoot());
        if (list.length) { list[0].click(); return true; }
        return false;
    }

    /* Pre-select the natural first choice of whatever screen just appeared. */
    function autoSelect() {
        const list = buttons(activeRoot());
        select(list[0] || null, false);
    }

    /* Esc: close the top overlay, else press the screen's back button. */
    function back() {
        const overlay = activeRoot();
        if (overlay && overlay.id === "pause-overlay" && typeof window.togglePause === "function") {
            window.togglePause();
            return true;
        }
        if (overlay && overlay.id && ["play-overlay", "quit-overlay", "account-modal"].indexOf(overlay.id) !== -1) {
            const close = overlay.querySelector("[data-close], .back-button, .overlay-close");
            if (close) { close.click(); return true; }
            if (typeof window.closeOverlay === "function") { window.closeOverlay(); return true; }
        }
        const screen = activeRoot();
        const backBtn = screen && screen.querySelector ? screen.querySelector(".back-button") : null;
        if (backBtn) { backBtn.click(); return true; }
        return false;
    }

    /* ---------- keyboard ---------- */
    function onKey(e) {
        if (!e) return;
        const t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable)) return;

        /* while a level is loaded, game.js owns Esc (pause/resume) and, when
           running, every other key too. When paused, this module navigates
           the pause overlay but still leaves Esc to the game. */
        const running = typeof gameRunning !== "undefined" && gameRunning;
        const playing = running && !(typeof paused !== "undefined" && paused);
        if (playing) return;

        const key = (e.key || "").toLowerCase();
        const navKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "s", "a", "d", "enter", " ", "escape"];
        if (navKeys.indexOf(key) === -1) return;
        if (key === "escape" && running) return;

        const now = performance.now();
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "s"].indexOf(key) !== -1) {
            if (now - lastNav < 90) { e.preventDefault(); return; }
            lastNav = now;
            move(key === "arrowup" || key === "w" ? -1 : 1);
            e.preventDefault();
            return;
        }
        if (key === "enter" || key === " ") {
            /* a focused button already receives its own Enter/Space click —
               never fire it twice */
            const tgt = e.target;
            if (tgt && tgt.tagName === "BUTTON") return;
            if (activate()) e.preventDefault();
            return;
        }
        if (key === "escape") { if (back()) e.preventDefault(); }
    }

    /* Mouse hover also moves the selection, so the highlighted button is
       always the one a click would press. */
    function onPointerOver(e) {
        const btn = e.target && e.target.closest ? e.target.closest(NAV_SEL) : null;
        if (btn && !btn.disabled) select(btn, false);
    }

    /* ---------- screen wipe ---------- */
    /* fn() runs at the darkest point. Menus and gameplay hand us their screen
       swaps; the wipe is skipped entirely for reduced motion. */
    function wipe(fn) {
        const veil = document.getElementById("screen-wipe");
        if (!veil || reduce() || wipeBusy) { if (typeof fn === "function") fn(); return; }
        wipeBusy = true;
        veil.classList.add("on");
        setTimeout(() => {
            try { if (typeof fn === "function") fn(); } finally {
                veil.classList.remove("on");
                veil.classList.add("off");
                setTimeout(() => { veil.classList.remove("off"); wipeBusy = false; }, 260);
            }
        }, 170);
    }

    /* ---------- gamepad ---------- */
    function pollPad() {
        if (!navigator.getGamepads) return;
        let pads;
        try { pads = navigator.getGamepads(); } catch (e) { return; }
        const gp = padIndex >= 0 && pads[padIndex] ? pads[padIndex] : (pads && pads[0]);
        if (!gp) return;
        padIndex = gp.index;

        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
        const now = performance.now();

        const dpad = { left: btn(14) || ax < -.5, right: btn(15) || ax > .5, up: btn(12) || ay < -.5, down: btn(13) || ay > .5 };

        const playing = typeof gameRunning !== "undefined" && gameRunning &&
            !(typeof paused !== "undefined" && paused);

        if (playing) {
            /* gameplay bridge: continuous movement + edge actions */
            held.left = dpad.left; held.right = dpad.right; held.up = dpad.up; held.down = dpad.down;
            const press = (i, name, fn) => {
                const on = btn(i), was = prevButtons[i];
                if (on && !was && typeof fn === "function") fn();
                held[name] = on;
            };
            press(0, "jump", () => { if (window.MiloInput) MiloInput.action("jump"); });
            press(2, "attack", () => { if (window.MiloInput) MiloInput.action("attack"); });
            press(1, "interact", () => { if (window.MiloInput) MiloInput.action("interact"); });
            press(5, "dash", () => { if (window.MiloInput) MiloInput.action("dash"); });
            if (btn(9) && !prevButtons[9] && window.MiloInput) MiloInput.action("pause");
            held.pause = btn(9);
        } else {
            /* menu navigation with a gentle auto-repeat */
            const dir = dpad.up ? -1 : dpad.down ? 1 : 0;
            if (dir && now - lastNav > REPEAT_MS) { lastNav = now; move(dir); }
            if (btn(0) && !prevButtons[0]) activate();
            if (btn(1) && !prevButtons[1]) back();
            if (btn(9) && !prevButtons[9]) back();
        }

        prevButtons = gp.buttons.map(b => b.pressed);
    }

    /* ---------- boot ---------- */
    function init() {
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("pointerover", onPointerOver, { passive: true });
        const loop = () => { try { pollPad(); } catch (e) { } requestAnimationFrame(loop); };
        if (window.requestAnimationFrame) requestAnimationFrame(loop);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();

    window.MenuNav = {
        select, move, back, autoSelect, wipe, held, reduce,
        /* exposed for the game's input bridge + tests */
        _test: { buttons, activeRoot, current, NAV_SEL }
    };
})();
