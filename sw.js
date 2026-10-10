/* Offline cache. Static files only: stale-while-revalidate, so repeat visits load instantly
   and updates arrive on the next reload. Bump VERSION on each deploy to purge old files. */
const VERSION = "hollow-milo-v7";
const CORE = ["./", "index.html", "style.css", "config.js", "js/game.js", "js/scenery.js", "js/gachaAnimation.js",
              "js/gacha.js", "js/auth.js", "js/saveSystem.js", "js/ui.js", "js/metroid.js", "js/metroFx.js",
              "fonts/cinzel-latin-500-normal.woff2", "fonts/cinzel-latin-700-normal.woff2"];

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
    const req = e.request, url = new URL(req.url);
    if (req.method !== "GET" || url.origin !== location.origin) return;     // never touch Supabase / OAuth calls
    e.respondWith(caches.open(VERSION).then(async cache => {
        const hit = await cache.match(req);
        const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
    }));
});
