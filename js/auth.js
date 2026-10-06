/* =========================================================
   auth.js - accounts via Supabase Auth
   * Guest  : Supabase *anonymous* sign-in (+ a UUID in localStorage as
             a display id / offline fallback).
   * OAuth  : Google / Discord. A guest is UPGRADED with linkIdentity(),
             which keeps the same user id, so the guest's cloud save
             automatically belongs to the new account.
   * If Supabase is not configured the game simply runs local-only.
========================================================= */
const Auth = (() => {
    let client = null, user = null;
    const listeners = [];

    const cfg = () => window.MILO_CONFIG || {};
    const hasKeys = () =>
        !!(cfg().SUPABASE_URL && cfg().SUPABASE_ANON_KEY && !cfg().SUPABASE_URL.includes("YOUR_"));
    const configured = () => hasKeys() && !!client;

    /* Never let a slow network freeze the game: every cloud call gets a timeout. */
    const withTimeout = (promise, ms = 8000) =>
        Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

    /* The Supabase library (110 KB, self-hosted in /vendor) is only loaded AFTER the
       game is on screen, and only if keys are configured. */
    function loadLibrary() {
        if (window.supabase) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "vendor/supabase.js"; s.async = true;
            s.onload = resolve; s.onerror = () => reject(new Error("could not load vendor/supabase.js"));
            document.head.appendChild(s);
        });
    }

    function guestId() {
        let id = localStorage.getItem("miloGuestId");
        if (!id) {
            id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
            localStorage.setItem("miloGuestId", id);
        }
        return id;
    }

    function profile() {
        if (!user) return { name: "Guest-" + guestId().slice(0, 4), avatar: "", method: "guest", cloud: false };
        const m = user.user_metadata || {};
        return {
            name: user.is_anonymous ? "Guest-" + user.id.slice(0, 4)
                                    : (m.full_name || m.name || m.user_name || user.email || "Player"),
            avatar: m.avatar_url || "",
            method: user.is_anonymous ? "guest" : ((user.app_metadata || {}).provider || "oauth"),
            cloud: true
        };
    }

    const emit = () => listeners.forEach(fn => fn(profile(), user));
    const onChange = fn => listeners.push(fn);

    async function init() {
        guestId();
        if (!hasKeys()) { emit(); return; }
        try {
            await withTimeout(loadLibrary(), 10000);
            client = window.supabase.createClient(cfg().SUPABASE_URL, cfg().SUPABASE_ANON_KEY);
            const { data } = await withTimeout(client.auth.getSession());
            user = data.session ? data.session.user : null;
            if (!user && cfg().ALLOW_GUEST_CLOUD !== false) {
                const res = await withTimeout(client.auth.signInAnonymously());   // needs "Anonymous sign-ins" enabled
                if (res.error) console.warn("Anonymous sign-in failed:", res.error.message);
                else user = res.data.user;
            }
        } catch (e) {
            console.warn("Cloud saves unavailable, playing local-only:", e.message);
            client = null; user = null; emit(); return;
        }
        client.auth.onAuthStateChange((event, session) => {
            const newUser = session ? session.user : null;
            const changed = (newUser && newUser.id) !== (user && user.id) || event === "USER_UPDATED";
            user = newUser;
            if (changed) { emit(); if (user) SaveSystem.sync(); }
        });
        emit();
        if (user) await SaveSystem.sync();
    }

    async function signInWithProvider(provider) {
        if (!client) return { error: "Cloud saves are not available (check config.js / connection)." };
        const options = { redirectTo: location.origin + location.pathname };
        if (user && user.is_anonymous) {
            await SaveSystem.pushNow();                               // make sure the guest save is uploaded first
            const { error } = await client.auth.linkIdentity({ provider, options });
            if (!error) return {};                                    // browser redirects to the provider
            console.warn("linkIdentity failed, falling back to normal sign-in:", error.message);
        }
        const { error } = await client.auth.signInWithOAuth({ provider, options });
        return error ? { error: error.message } : {};
    }

    async function signOut() {
        if (!client) return;
        await SaveSystem.pushNow();
        await client.auth.signOut();
        applySave(cloneDefault());                  // don't leak this account's save to the next guest
        const res = await client.auth.signInAnonymously();
        user = res.error ? null : res.data.user;
        emit();
    }

    return { init, onChange, profile, signInWithProvider, signOut,
             get client() { return client; }, get user() { return user; }, configured };
})();
window.Auth = Auth;
