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
    const configured = () =>
        !!(window.supabase && cfg().SUPABASE_URL && cfg().SUPABASE_ANON_KEY &&
           !cfg().SUPABASE_URL.includes("YOUR_"));

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
        if (!configured()) { emit(); return; }
        client = window.supabase.createClient(cfg().SUPABASE_URL, cfg().SUPABASE_ANON_KEY);

        const { data } = await client.auth.getSession();
        user = data.session ? data.session.user : null;
        if (!user && cfg().ALLOW_GUEST_CLOUD !== false) {
            const res = await client.auth.signInAnonymously();   // needs "Anonymous sign-ins" enabled
            if (res.error) console.warn("Anonymous sign-in failed:", res.error.message);
            else user = res.data.user;
        }
        client.auth.onAuthStateChange((event, session) => {
            const newUser = session ? session.user : null;
            const changed = (newUser && newUser.id) !== (user && user.id) || event === "USER_UPDATED";
            user = newUser;
            if (changed) { emit(); if (user && window.SaveSystem) SaveSystem.sync(); }
        });
        emit();
        if (user && window.SaveSystem) await SaveSystem.sync();
    }

    async function signInWithProvider(provider) {
        if (!client) return { error: "Cloud saves are not configured yet (see README)." };
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
