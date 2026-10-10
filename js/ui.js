/* =========================================================
   ui.js - Wish (gacha) screen, account panel, toasts.
   Screens are injected here so index.html stays small.
   openGacha() / openAccount() are called from the home buttons.
========================================================= */
(function () {
    const app = document.getElementById("app");
    let bannerId = Gacha.BANNERS[0].id, busy = false;
    let loginMode = "login", appReady = false;

    /* ---------- build DOM ---------- */
    app.insertAdjacentHTML("beforeend", `
      <section id="gacha-screen" class="screen hidden menu-screen scroll-screen">
        <div class="content-shell">
          <header class="screen-header">
            <button class="back-button compact" type="button" onclick="showHome()">← Home</button>
            <div><div class="eyebrow">Shrine</div><h1>Vessel Summoning</h1></div>
            <div class="coin-pill">◈ <span id="wish-coins">0</span></div>
          </header>
          <div id="banner-tabs" class="banner-tabs"></div>
          <div class="menu-card banner-card">
            <h2 id="banner-name"></h2><p id="banner-blurb" class="subtitle"></p>
            <div id="pity-info" class="pity-info"></div>
            <div class="menu-actions two">
              <button class="game-button primary" id="wish-1" type="button"></button>
              <button class="game-button primary" id="wish-10" type="button"></button>
            </div>
            <p id="wish-msg" class="settings-note"></p>
            <details><summary>Wish history</summary><div id="wish-history" class="wish-history"></div></details>
          </div>
        </div>
      </section>

      <div id="account-modal" class="modal hidden">
        <div class="menu-card account-card">
          <button class="back-button compact" type="button" id="account-close">✕ Close</button>
          <div class="eyebrow">Account</div>
          <div class="account-who"><img id="acc-avatar" alt="" class="hidden"><div><h2 id="acc-name"></h2><p id="acc-method" class="settings-note"></p></div></div>
          <p id="acc-sync" class="settings-note"></p>
          <div id="acc-actions" class="account-actions"></div>
        </div>
      </div>
      <div id="toast" class="toast hidden"></div>`);

    const $q = id => document.getElementById(id);
    const providerNames = { google: "Google", discord: "Discord" };

    /* ---------- login screen ---------- */
    function setLoginStatus(message, kind = "") {
        const el = $q("login-status");
        if (!el) return;
        el.textContent = message || "";
        el.className = "auth-status" + (kind ? " " + kind : "");
    }

    function renderLogin() {
        const signup = loginMode === "signup";
        const title = $q("login-title");
        const copy = $q("login-copy");
        const submit = $q("login-submit");
        const password = $q("login-password");
        const forgot = $q("login-forgot");
        const switchLabel = $q("login-switch-label");
        const switchButton = $q("login-switch");
        if (!title) return;

        title.textContent = signup ? "Awaken a new vessel" : "Welcome back, vessel";
        copy.textContent = signup
            ? "Create an account to keep your Geo, Vessels and progress safe across every device."
            : "Sign in to pick up where your light went out. New here? Google creates an account for you.";
        submit.innerHTML = "<span>" + (signup ? "Create account" : "Log in") + "</span>";
        const panel = title.closest(".threshold-panel");
        if (panel) panel.classList.toggle("signup", signup);
        document.querySelectorAll(".auth-tab").forEach(tab => {
            const active = tab.dataset.mode === loginMode;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
        });
        password.autocomplete = signup ? "new-password" : "current-password";
        forgot.classList.toggle("hidden", signup);
        switchLabel.textContent = signup ? "Already have an account?" : "New to Hollow Milo?";
        switchButton.textContent = signup ? "Log in" : "Create an account";

        const providers = $q("login-providers");
        providers.innerHTML = "";
        if (!Auth.initialized) {
            providers.innerHTML = '<p class="auth-note">Connecting to account services…</p>';
        } else if (!Auth.configured()) {
            providers.innerHTML = '<p class="auth-note">Cloud sign-in is not configured. You can still play as a guest.</p>';
        } else {
            const available = ((window.MILO_CONFIG || {}).PROVIDERS || [])
                .filter(provider => providerNames[provider])
                .sort((a, b) => (a === "google" ? -1 : b === "google" ? 1 : 0));
            available.forEach(provider => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "game-button" + (provider === "google" ? " google-button" : "");
                button.innerHTML = (provider === "google"
                    ? '<svg class="provider-mark" aria-hidden="true"><use href="#google-mark"/></svg>' : "")
                    + "<span>Continue with " + providerNames[provider] + "</span>";
                button.onclick = async () => {
                    setLoginStatus("Opening " + providerNames[provider] + "…");
                    button.disabled = true;
                    let result;
                    try { result = await Auth.signInWithProvider(provider); }
                    catch (error) { result = { error: error.message || "Provider sign-in failed. Please try again." }; }
                    if (result.error) {
                        setLoginStatus(result.error, "error");
                        button.disabled = false;
                    }
                };
                providers.appendChild(button);
            });
        }
    }

    function openLogin(mode = "login") {
        loginMode = mode === "signup" ? "signup" : "login";
        if (window.stopGame) stopGame();
        if (window.hideScreens) hideScreens();
        $q("login-screen").classList.remove("hidden");
        setLoginStatus("");
        renderLogin();
        setTimeout(() => $q("login-email").focus(), 0);
    }
    window.openLogin = openLogin;

    window.showInitialScreen = function () {
        appReady = true;
        if (Auth.initialized && Auth.user) showHome();
        else openLogin();
    };

    $q("login-form").addEventListener("submit", async event => {
        event.preventDefault();
        const email = $q("login-email").value.trim();
        const password = $q("login-password").value;
        if (!email || !email.includes("@")) {
            setLoginStatus("Enter a valid email address.", "error");
            $q("login-email").focus();
            return;
        }
        if (password.length < 6) {
            setLoginStatus("Your password must be at least 6 characters.", "error");
            $q("login-password").focus();
            return;
        }

        if (!Auth.initialized) {
            setLoginStatus("Account services are still loading. Try again in a moment.", "error");
            return;
        }
        const button = $q("login-submit");
        button.disabled = true;
        setLoginStatus(loginMode === "signup" ? "Creating your account…" : "Signing in…");
        let result;
        try {
            result = loginMode === "signup"
                ? await Auth.signUpWithPassword(email, password)
                : await Auth.signInWithPassword(email, password);
        } catch (error) {
            result = { error: error.message || "Account request failed. Please try again." };
        }
        button.disabled = false;

        if (result.error) {
            setLoginStatus(result.error, "error");
        } else if (result.needsConfirmation) {
            setLoginStatus("Account created. Check your email to confirm it, then log in.", "success");
            loginMode = "login";
            renderLogin();
        } else {
            setLoginStatus("Signed in. Loading your save…", "success");
            showHome();
        }
    });

    document.querySelectorAll(".auth-tab").forEach(tab => {
        tab.onclick = () => {
            if (tab.dataset.mode === loginMode) return;
            loginMode = tab.dataset.mode;
            setLoginStatus("");
            renderLogin();
        };
    });
    const reveal = $q("login-reveal");
    if (reveal) reveal.onclick = () => {
        const input = $q("login-password");
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        reveal.setAttribute("aria-pressed", show ? "true" : "false");
        reveal.setAttribute("aria-label", show ? "Hide password" : "Show password");
        input.focus();
    };
    $q("login-switch").onclick = () => {
        loginMode = loginMode === "login" ? "signup" : "login";
        setLoginStatus("");
        renderLogin();
    };
    $q("login-forgot").onclick = async () => {
        const email = $q("login-email").value.trim();
        if (!email || !email.includes("@")) {
            setLoginStatus("Enter your email address first, then try again.", "error");
            $q("login-email").focus();
            return;
        }
        setLoginStatus("Sending password reset email…");
        let result;
        try { result = await Auth.resetPassword(email); }
        catch (error) { result = { error: error.message || "Password reset failed. Please try again." }; }
        setLoginStatus(result.error || "Password reset email sent. Check your inbox.", result.error ? "error" : "success");
    };
    $q("login-guest").onclick = async () => {
        if (!Auth.initialized) {
            setLoginStatus("Account services are still loading. Try again in a moment.", "error");
            return;
        }
        const button = $q("login-guest");
        button.disabled = true;
        setLoginStatus("Preparing your guest save…");
        let result;
        try { result = await Auth.continueAsGuest(); }
        catch (error) { result = { error: error.message || "Guest sign-in failed. Please try again." }; }
        button.disabled = false;
        if (result.error) setLoginStatus(result.error, "error");
        else { showHome(); toast("Playing as a guest. You can log in any time."); }
    };

    function toast(msg) {
        const t = $q("toast"); if (!t) return;
        t.textContent = msg; t.classList.remove("hidden");
        t.classList.remove("toast-in");
        void t.offsetWidth;                    // restart the entrance animation
        t.classList.add("toast-in");
        clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add("hidden"), 3500);
    }
    window.showToast = toast;                  // shared with game.js (hero shop etc.)

    /* ---------- gacha screen ---------- */
    function renderGacha() {
        const banner = Gacha.BANNERS.find(b => b.id === bannerId), st = Gacha.state(bannerId), C = Gacha.CONFIG;
        $q("wish-coins").textContent = save.coins;
        $q("banner-name").textContent = banner.name;
        $q("banner-blurb").textContent = banner.blurb;
        $q("wish-1").textContent = `🕯 Wish ×1 (◈ ${C.cost})`;
        $q("wish-10").textContent = `🕯 Wish ×10 (◈ ${C.cost * 10})`;
        $q("banner-tabs").innerHTML = Gacha.BANNERS.map(b =>
            `<button class="game-button ${b.id === bannerId ? "primary" : ""}" data-b="${b.id}">${b.name}</button>`).join("");
        $q("banner-tabs").querySelectorAll("button").forEach(b => b.onclick = () => { bannerId = b.dataset.b; renderGacha(); });

        const soft = st.pity5 + 1 >= C.softPity5;
        $q("pity-info").innerHTML = `
          <div>5★ pity <b>${st.pity5}/${C.hardPity5}</b> ${soft ? "🔥 soft pity!" : ""}
            <div class="pity-bar"><i style="width:${st.pity5 / C.hardPity5 * 100}%"></i></div></div>
          <div>4★ pity <b>${st.pity4}/${C.hardPity4}</b>
            <div class="pity-bar p4"><i style="width:${st.pity4 / C.hardPity4 * 100}%"></i></div></div>
          ${banner.featured5 ? `<div>Next 5★ guaranteed featured: <b>${st.guaranteed ? "YES" : "no (50/50)"}</b></div>` : ""}
          <div>Total wishes: <b>${save.gacha.totalPulls}</b></div>`;

        $q("wish-history").innerHTML = save.gacha.history.slice(0, 30).map(h => {
            const hero = Gacha.heroById(h.hero);
            return `<div style="color:${Gacha.RARITY[h.rarity].color}">${"★".repeat(h.rarity)} ${hero ? hero.name : h.hero}${h.isNew ? " (new)" : ""}</div>`;
        }).join("") || "<em>No wishes yet.</em>";
    }

    async function doWish(n) {
        if (busy) return; busy = true;
        const out = Gacha.pull(bannerId, n);
        if (out.error) { $q("wish-msg").textContent = out.error; busy = false; return; }
        $q("wish-msg").textContent = "";
        /* synced to the click: Geo drops immediately, buttons lock, animation starts this frame */
        $q("wish-coins").textContent = save.coins;
        $q("wish-coins").parentElement.classList.add("spent");
        setTimeout(() => $q("wish-coins").parentElement.classList.remove("spent"), 600);
        ["wish-1", "wish-10"].forEach(id => $q(id).disabled = true);
        try { await GachaAnimation.play(out.results); }
        catch (e) { console.error("Wish animation failed:", e); toast("Animation failed, your result was still saved."); }
        finally { ["wish-1", "wish-10"].forEach(id => $q(id).disabled = false); renderGacha(); busy = false; }      // pity bars / history refresh once the reveal is closed
    }

    window.openGacha = function () {
        stopGame(); hideScreens();
        $q("gacha-screen").classList.remove("hidden");
        renderGacha();
    };
    $q("wish-1").onclick = () => doWish(1);
    $q("wish-10").onclick = () => doWish(10);

    /* ---------- account panel ---------- */
    const STATUS = { local: "Local save only.", pending: "Changes waiting to sync…", syncing: "Syncing…", synced: "☁ Cloud save up to date.", error: "⚠ Cloud sync failed – progress is still saved on this device." };

    function renderAccount() {
        if ($q("account-modal").classList.contains("hidden")) return;   // nothing to update while closed
        const p = Auth.profile();
        $q("acc-name").textContent = p.name;
        $q("acc-method").textContent = p.method === "guest" ? "Guest account" : "Signed in with " + p.method;
        const img = $q("acc-avatar");
        if (p.avatar) { img.src = p.avatar; img.classList.remove("hidden"); } else img.classList.add("hidden");
        $q("acc-sync").textContent = Auth.configured() ? STATUS[SaveSystem.status] : "Cloud saves are not configured (see README) – playing local-only.";

        const box = $q("acc-actions"); box.innerHTML = "";
        if (!Auth.configured()) return;
        const names = { google: "Google", discord: "Discord" };
        if (p.method === "guest") {
            const email = document.createElement("button");
            email.className = "game-button primary";
            email.textContent = "Log in with email";
            email.onclick = () => { $q("account-modal").classList.add("hidden"); openLogin("login"); };
            box.appendChild(email);

            ((window.MILO_CONFIG || {}).PROVIDERS || []).forEach(prov => {
                const b = document.createElement("button"); b.className = "game-button";
                b.textContent = "Save progress with " + names[prov];
                b.onclick = async () => { const r = await Auth.signInWithProvider(prov); if (r.error) toast(r.error); };
                box.appendChild(b);
            });
        } else {
            const b = document.createElement("button"); b.className = "game-button";
            b.textContent = "Sign out"; b.onclick = async () => { await Auth.signOut(); toast("Signed out."); renderAccount(); };
            box.appendChild(b);
        }
    }

    window.openAccount = () => { $q("account-modal").classList.remove("hidden"); renderAccount(); };
    $q("account-close").onclick = () => $q("account-modal").classList.add("hidden");
    Auth.onChange(() => {
        renderAccount();
        updateChip();
        renderLogin();
        if (appReady && Auth.initialized && Auth.user) showHome();
    });
    SaveSystem.onStatus(() => { renderAccount(); });

    function updateChip() {
        const profile = Auth.profile();
        const c = document.getElementById("account-chip");
        if (c) c.textContent = "👤 " + profile.name;
        const authButton = document.getElementById("home-auth-button");
        if (authButton) {
            const signedIn = profile.method !== "guest";
            authButton.textContent = signedIn ? "👤 Account" : "👤 Log in";
            authButton.onclick = signedIn ? openAccount : () => openLogin("login");
        }
    }
    updateChip();

    /* cloud + offline cache start AFTER the game is on screen, never blocking it */
    window.addEventListener("load", () => {
        const idle = window.requestIdleCallback || (fn => setTimeout(fn, 300));
        idle(() => Auth.init().catch(e => console.warn("Auth init failed:", e)));
        if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
            navigator.serviceWorker.register("sw.js").catch(() => {});
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") $q("account-modal").classList.add("hidden"); });
})();
