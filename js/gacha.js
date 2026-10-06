/* =========================================================
   gacha.js - wish logic, banners and pity system
   Currency = in-game coins (save.coins). Hero ids come from game.js.
   Per-banner counters live in save.gacha.banners[bannerId] so they
   are saved to the cloud together with the rest of the save.
========================================================= */
const Gacha = (() => {

    /* ---- EDIT ME: tuning ---- */
    const CONFIG = {
        cost: 100,            // coins per wish
        base5: 0.006,         // 0.6 % base 5-star rate
        softPity5: 74,        // from this pull the 5-star rate ramps up
        softStep: 0.06,       // +6 % per pull after soft pity
        hardPity5: 90,        // guaranteed 5-star
        base4: 0.051,         // 5.1 % base 4-star rate
        hardPity4: 10,        // guaranteed 4-star (or better) every 10 pulls
        featuredChance: 0.5,  // 50/50, then guaranteed next 5-star
        historyLimit: 100
    };

    /* ---- EDIT ME: rarity pools (hero ids from game.js) ---- */
    const RARITY = {
        3: { label: "3★", name: "Rare",      color: "#8fc1e3", refund: 40  },
        4: { label: "4★", name: "Epic",      color: "#a98be0", refund: 100 },
        5: { label: "5★", name: "Legendary", color: "#f6e7ae", refund: 250 }
    };
    const POOL = {
        5: ["koko", "mimi", "bruno"],
        4: ["taro", "piko", "blaze"],
        3: ["luna", "rocco", "zuki"]
    };

    /* ---- EDIT ME: banners ---- */
    const BANNERS = [
        { id: "standard", name: "Wanderer's Shrine", blurb: "All heroes, standard rates.", featured5: null,    featured4: [] },
        { id: "bruno",    name: "Void Bruno Rises",   blurb: "Void Bruno is rate-up (50/50).",   featured5: "bruno", featured4: ["taro", "blaze"] }
    ];

    const heroById = id => heroes.find(h => h.id === id);
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    function state(bannerId) {
        const b = save.gacha.banners;
        if (!b[bannerId]) b[bannerId] = { pity5: 0, pity4: 0, guaranteed: false };
        return b[bannerId];
    }

    /* Probability of a 5-star on the NEXT pull (used by the UI too). */
    function rate5(pity5Next) {
        if (pity5Next >= CONFIG.hardPity5) return 1;
        let p = CONFIG.base5;
        if (pity5Next >= CONFIG.softPity5) p += (pity5Next - CONFIG.softPity5 + 1) * CONFIG.softStep;
        return Math.min(p, 1);
    }

    /* One wish: updates pity, returns { rarity, heroId }. */
    function roll(banner) {
        const st = state(banner.id);
        st.pity5++; st.pity4++;
        const r = Math.random();
        const p5 = rate5(st.pity5);

        if (r < p5) {                                   // ---- 5 star
            st.pity5 = 0;
            let id;
            if (banner.featured5) {
                if (st.guaranteed || Math.random() < CONFIG.featuredChance) { id = banner.featured5; st.guaranteed = false; }
                else { id = pick(POOL[5].filter(x => x !== banner.featured5)); st.guaranteed = true; }
            } else id = pick(POOL[5]);
            return { rarity: 5, heroId: id };
        }
        if (st.pity4 >= CONFIG.hardPity4 || r < p5 + CONFIG.base4) {   // ---- 4 star
            st.pity4 = 0;
            const feat = banner.featured4 || [];
            const id = feat.length && Math.random() < 0.5 ? pick(feat) : pick(POOL[4]);
            return { rarity: 4, heroId: id };
        }
        return { rarity: 3, heroId: pick(POOL[3]) };    // ---- 3 star
    }

    /* Spend coins, roll n times, grant heroes, log history, save. */
    function pull(bannerId, n) {
        const banner = BANNERS.find(b => b.id === bannerId) || BANNERS[0];
        const total = CONFIG.cost * n;
        if (save.coins < total) return { error: `You need ${total - save.coins} more coins.` };

        save.coins -= total;
        const results = [];
        for (let i = 0; i < n; i++) {
            const res = roll(banner);
            const owned = save.unlockedHeroes.includes(res.heroId);
            if (owned) { res.refund = RARITY[res.rarity].refund; save.coins += res.refund; }
            else { save.unlockedHeroes.push(res.heroId); res.isNew = true; }
            res.name = heroById(res.heroId).name;
            save.gacha.history.unshift({ t: Date.now(), banner: banner.id, hero: res.heroId, rarity: res.rarity, isNew: !!res.isNew });
            results.push(res);
        }
        save.gacha.totalPulls += n;
        save.gacha.history = save.gacha.history.slice(0, CONFIG.historyLimit);
        saveGame();            // local save right now (results are final BEFORE the animation plays)
        if (window.SaveSystem) SaveSystem.pushNow();   // and cloud right now, so closing the tab mid-animation never loses/rerolls a wish
        updateAllHUD();
        return { results, banner };
    }

    return { CONFIG, RARITY, BANNERS, state, pull, rate5, heroById };
})();
window.Gacha = Gacha;
