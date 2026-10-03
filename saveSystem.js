/* =========================================================
   saveSystem.js - cloud sync on top of game.js's localStorage save
   * game.js keeps writing localStorage exactly as before.
   * Every saveGame() call calls SaveSystem.schedulePush() (debounced).
   * On login: sync() compares cloud vs local and keeps the newer one.
   * Table: player_saves(user_id, data jsonb, updated_at) - supabase/schema.sql
========================================================= */
const SaveSystem = (() => {
    const TABLE = "player_saves";
    const DEBOUNCE_MS = 2500;
    let timer = null, status = "local";
    const listeners = [];

    const setStatus = s => { status = s; listeners.forEach(fn => fn(s)); };
    const onStatus = fn => listeners.push(fn);
    const ready = () => Auth.client && Auth.user;

    /* Plain JSON snapshot (numbers/strings/booleans/arrays/objects only). */
    function serialize() {
        const p = Auth.profile();
        save.profile = { name: p.name, avatar: p.avatar, method: p.method, userId: Auth.user ? Auth.user.id : "" };
        return JSON.parse(JSON.stringify(save));
    }

    function schedulePush() {
        if (!ready()) return;
        setStatus("pending");
        clearTimeout(timer);
        timer = setTimeout(pushNow, DEBOUNCE_MS);
    }

    async function pushNow() {
        clearTimeout(timer);
        if (!ready()) return;
        setStatus("syncing");
        const data = serialize();
        const { error } = await Auth.client.from(TABLE)
            .upsert({ user_id: Auth.user.id, data, updated_at: new Date().toISOString() });
        if (error) { console.warn("Cloud save failed:", error.message); setStatus("error"); }
        else setStatus("synced");
    }

    /* Called after login/startup: reconcile cloud and local. */
    async function sync() {
        if (!ready()) return;
        setStatus("syncing");
        const { data: row, error } = await Auth.client.from(TABLE)
            .select("data").eq("user_id", Auth.user.id).maybeSingle();
        if (error) { console.warn("Cloud load failed:", error.message); setStatus("error"); return; }

        if (!row) { await pushNow(); return; }                    // first time: upload local progress

        const cloud = row.data || {};
        const localHasProgress = Object.keys(save.completedLevels).length > 0 || save.unlockedHeroes.length > 1;
        const otherAccount = save.profile.userId && save.profile.userId !== Auth.user.id;

        if ((cloud.savedAt || 0) >= (save.savedAt || 0)) {
            if (otherAccount && localHasProgress &&
                !confirm("A cloud save exists for this account. OK = load the cloud save, Cancel = keep this device's progress and overwrite the cloud.")) {
                await pushNow(); return;
            }
            applySave(cloud);                                     // cloud is newer -> load it
            setStatus("synced");
        } else {
            await pushNow();                                      // local is newer -> upload it
        }
    }

    /* Best-effort flush when the tab is hidden / closed. */
    document.addEventListener("visibilitychange", () => { if (document.hidden) pushNow(); });

    return { schedulePush, pushNow, sync, serialize, onStatus, get status() { return status; } };
})();
window.SaveSystem = SaveSystem;
