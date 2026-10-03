/* =========================================================
   ui.js - Wish (gacha) screen, account panel, toasts.
   Screens are injected here so index.html stays small.
   openGacha() / openAccount() are called from the home buttons.
========================================================= */
(function () {
    const app = document.getElementById("app");
    let bannerId = Gacha.BANNERS[0].id, busy = false;

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

    function toast(msg) {
        const t = $q("toast"); t.textContent = msg; t.classList.remove("hidden");
        clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add("hidden"), 3500);
    }

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
        await GachaAnimation.play(out.results);
        ["wish-1", "wish-10"].forEach(id => $q(id).disabled = false);
        renderGacha(); busy = false;      // pity bars / history refresh once the reveal is closed
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
            ((window.MILO_CONFIG || {}).PROVIDERS || []).forEach(prov => {
                const b = document.createElement("button"); b.className = "game-button primary";
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

    window.openAccount = () => { renderAccount(); $q("account-modal").classList.remove("hidden"); };
    $q("account-close").onclick = () => $q("account-modal").classList.add("hidden");
    Auth.onChange(() => { renderAccount(); updateChip(); });
    SaveSystem.onStatus(() => { renderAccount(); });

    function updateChip() { const c = document.getElementById("account-chip"); if (c) c.textContent = "👤 " + Auth.profile().name; }
    updateChip();

    /* start auth after all scripts are loaded */
    window.addEventListener("load", () => Auth.init().catch(e => console.warn("Auth init failed:", e)));
})();
