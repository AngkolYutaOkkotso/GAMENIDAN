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
    let timer = null, status = "local", dirty = false, syncing = null;
    const listeners = [];

    const setStatus = s => { if (s === status) return; status = s; listeners.forEach(fn => fn(s)); };   // only notify on change
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
        dirty = true;
        setStatus("pending");
        clearTimeout(timer);
        timer = setTimeout(pushNow, DEBOUNCE_MS);
    }

    async function pushNow() {
        clearTimeout(timer);
        if (!ready()) return;
        setStatus("syncing");
        try {
            const data = serialize();
            const { error } = await Promise.race([
                Auth.client.from(TABLE).upsert({ user_id: Auth.user.id, data, updated_at: new Date().toISOString() }),
                new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]);
            if (error) throw error;
            dirty = false; setStatus("synced");
        } catch (e) { console.warn("Cloud save failed:", e.message); setStatus("error"); }
    }

    /* Called after login/startup: reconcile cloud and local. */
    function sync() {                                  // de-duplicated: concurrent callers share one run
        if (!syncing) syncing = doSync().finally(() => { syncing = null; });
        return syncing;
    }

    async function doSync() {
        if (!ready()) return;
        setStatus("syncing");
        let row, error;
        try {
            ({ data: row, error } = await Promise.race([
                Auth.client.from(TABLE).select("data").eq("user_id", Auth.user.id).maybeSingle(),
                new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]));
        } catch (e) { error = e; }
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
    document.addEventListener("visibilitychange", () => { if (document.hidden && dirty) pushNow(); });

    return { schedulePush, pushNow, sync, serialize, onStatus, get status() { return status; } };
})();
window.SaveSystem = SaveSystem;
