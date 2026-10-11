/* =========================================================
   MILO MUSHROOM
   UPGRADED COMPLETE GAME.JS
   Replace your old game.js with this entire file.
========================================================= */

const $ = id => document.getElementById(id);

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* =========================================================
   FEEDBACK GLUE
   One place that talks to the Art Kit's effect bus (js/art.js) and to the
   procedural sounds (js/metroFx.js). Every call is gated by the player's
   accessibility rows, so nothing here can ignore a setting.
   ========================================================= */

function Sfx(name) {
    if (typeof MetroFx !== "undefined" && MetroFx.play) MetroFx.play(name);
}

/* Small screen-space HUD reaction (used for damage and coin pickups). */
function pulseHud(cls) {
    if (typeof document === "undefined") return;
    const el = document.querySelector(".game-hud");
    if (!el) return;
    el.classList.remove("hud-hit", "hud-coin");
    void el.offsetWidth;                 // restart the CSS animation
    el.classList.add(cls);
}

/* Wrapped so a missing art.js (old cached page) can never break the game. */
function Fx() {
    return (typeof window !== "undefined" && window.Art) ? window.Art.FX : null;
}

/* Small toast notification (shared with ui.js). Replaces blocking alert()
   so gameplay / menus are never interrupted. */
function notify(msg) {
    if (typeof window.showToast === "function") {
        window.showToast(msg);
        return;
    }

    const box = document.createElement("div");
    box.className = "toast";
    box.textContent = msg;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3500);
}

/* =========================================================
   SAVE DATA
========================================================= */

const defaultSave = {
    coins: 1000,
    selectedHero: "milo",
    unlockedHeroes: ["milo"],
    completedLevels: {},
    settings: {
        music: true,
        sound: true,
        /* --- interface & accessibility (polish pass) --- */
        controlHints: true,
        reduceMotion: false,
        highContrast: false
    },
    /* --- added: cloud-save + gacha fields --- */
    savedAt: 0,
    profile: { name: "", avatar: "", method: "guest", userId: "" },
    gacha: { totalPulls: 0, banners: {}, history: [] },
    metro: null          /* "The Hollow Descent" progress (created by js/metroid.js) */
};

function cloneDefault() {
    return JSON.parse(JSON.stringify(defaultSave));
}

/* Merge any (possibly old / partial) save object onto the defaults. */
function normalizeSave(data) {
    const base = cloneDefault();
    data = data || {};
    return {
        ...base,
        ...data,
        settings: { ...base.settings, ...(data.settings || {}) },
        profile: { ...base.profile, ...(data.profile || {}) },
        gacha: { ...base.gacha, ...(data.gacha || {}),
                 banners: (data.gacha && data.gacha.banners) || {},
                 history: (data.gacha && data.gacha.history) || [] },
        unlockedHeroes: Array.isArray(data.unlockedHeroes) ? data.unlockedHeroes : ["milo"],
        completedLevels: data.completedLevels || {}
    };
}

function loadSave() {
    try {
        const raw = localStorage.getItem("miloMushroomSave");
        return raw ? normalizeSave(JSON.parse(raw)) : cloneDefault();
    } catch (error) {
        console.error("Save error:", error);
        return cloneDefault();
    }
}

/* Replace the live save in place (used after a cloud load / logout). */
function applySave(data) {
    const merged = normalizeSave(data);
    Object.keys(save).forEach(k => delete save[k]);
    Object.assign(save, merged);
    try { localStorage.setItem("miloMushroomSave", JSON.stringify(save)); } catch (e) {}
    updateAllHUD();
    renderHeroes();
    updateSettingsButtons();
}

let save = loadSave();
/* Accessor for scripts that load before this file (metroFx.js, scenery.js). Reading the
   global by name from an earlier script is not reliable across environments; this is. */
window.getSaveData = () => save;

function saveGame() {
    save.savedAt = Date.now();
    try {
        localStorage.setItem(
            "miloMushroomSave",
            JSON.stringify(save)
        );
    } catch (error) {
        console.warn("Could not save game data:", error);
    }
    /* cloud sync is debounced inside SaveSystem (js/saveSystem.js) */
    if (window.SaveSystem) SaveSystem.schedulePush();
}

/* =========================================================
   HEROES
========================================================= */

const heroes = [
    {
        id: "milo",
        name: "Milo",
        ability: "Mushroom Shield",
        price: 0,
        color: "#d94f65",
        secondary: "#8f2940"
    },
    {
        id: "luna",
        name: "Pale Luna",
        ability: "Moon Jump",
        price: 250,
        color: "#8f6ee8",
        secondary: "#5540a6"
    },
    {
        id: "rocco",
        name: "Stone Rocco",
        ability: "Earth Smash",
        price: 350,
        color: "#9b6948",
        secondary: "#5b3828"
    },
    {
        id: "zuki",
        name: "Moss Zuki",
        ability: "Leaf Shot",
        price: 450,
        color: "#55b85c",
        secondary: "#28723a"
    },
    {
        id: "blaze",
        name: "Ember Blaze",
        ability: "Fire Burst",
        price: 500,
        color: "#ed6638",
        secondary: "#a92d20"
    },
    {
        id: "taro",
        name: "Frost Taro",
        ability: "Magic Freeze",
        price: 600,
        color: "#54bce5",
        secondary: "#267ba5"
    },
    {
        id: "koko",
        name: "Geo Koko",
        ability: "Coin Magnet",
        price: 700,
        color: "#e7b83c",
        secondary: "#9b6b1e"
    },
    {
        id: "piko",
        name: "Tide Piko",
        ability: "Water Dash",
        price: 800,
        color: "#478de0",
        secondary: "#25549b"
    },
    {
        id: "mimi",
        name: "Soul Mimi",
        ability: "Heart Heal",
        price: 900,
        color: "#ed80aa",
        secondary: "#a93d68"
    },
    {
        id: "bruno",
        name: "Void Bruno",
        ability: "Mega Smash",
        price: 1000,
        color: "#a56d46",
        secondary: "#583521"
    }
];

/* =========================================================
   WORLDS
========================================================= */

const worlds = [
    {
        name: "Forgotten Crossroads",
        icon: "🕳️",
        sky1: "#1a2230",
        sky2: "#3d4a5c",
        ground: "#3a4650",
        dirt: "#1d232b",
        enemy: ["slime", "beetle", "mushling"],
        boss: "meadowGuardian",
        description: "A silent tunnel where the old kingdom begins to crumble."
    },
    {
        name: "Mossy Greenpath",
        icon: "🌿",
        sky1: "#0f2a24",
        sky2: "#3f6b52",
        ground: "#2f5a3a",
        dirt: "#1a2a1f",
        enemy: ["wolf", "thorn", "forestSpirit"],
        boss: "forestBeast",
        description: "Overgrown caverns thick with moss and watchful things."
    },
    {
        name: "Crystal Depths",
        icon: "💎",
        sky1: "#1b1840",
        sky2: "#5b5fa8",
        ground: "#43476b",
        dirt: "#272a45",
        enemy: ["bat", "rockCrawler", "crystalBug"],
        boss: "crystalGolem",
        description: "Glittering tunnels where light bends and echoes."
    },
    {
        name: "City of Rain",
        icon: "🌧️",
        sky1: "#1a2438",
        sky2: "#5d7490",
        ground: "#6b7a8c",
        dirt: "#38424f",
        enemy: ["cloudSpirit", "stormBird", "skyEye"],
        boss: "stormDragon",
        description: "Drowned spires beneath an endless weeping sky."
    },
    {
        name: "Ashen Basin",
        icon: "🔥",
        sky1: "#1c0f12",
        sky2: "#7a3a2a",
        ground: "#3d2622",
        dirt: "#21130f",
        enemy: ["lavaSlime", "fireBat", "magmaBeast"],
        boss: "magmaLord",
        description: "A scorched hollow where embers never stop falling."
    },
    {
        name: "Pale Peaks",
        icon: "❄️",
        sky1: "#2a3d52",
        sky2: "#aac4d6",
        ground: "#b9ccd6",
        dirt: "#5a7384",
        enemy: ["iceWolf", "frostBat", "iceGolem"],
        boss: "frostTitan",
        description: "A bitter, windswept summit above the dark."
    },
    {
        name: "Hollow Castle",
        icon: "🏰",
        sky1: "#0b0a14",
        sky2: "#3a2f55",
        ground: "#2c2838",
        dirt: "#15131d",
        enemy: ["darkMushroom", "knight", "magicGuardian"],
        boss: "mushroomKing",
        description: "The forsaken throne where the last king waits."
    }
];

/* =========================================================
   LEVEL INFORMATION
========================================================= */

const levelNames = [
    [
        "Crossroads Descent",
        "Husk Tunnels",
        "Fallen Shaft",
        "Warden's Vault"
    ],
    [
        "Greenpath Gate",
        "Whispering Moss",
        "Thorn Hollow",
        "Mosscreep Den"
    ],
    [
        "Crystal Gate",
        "Echoing River",
        "Deep Lodes",
        "Crystal Heart"
    ],
    [
        "Rain Gate",
        "Sunken Spires",
        "Weeping Bridge",
        "Tear Throne"
    ],
    [
        "Ash Road",
        "Cinder Fields",
        "Burning Hollow",
        "Ember Throne"
    ],
    [
        "Frozen Trail",
        "Pale Forest",
        "Glacier Pass",
        "Summit of Silence"
    ],
    [
        "Castle Gate",
        "Shadow Court",
        "Forgotten Dungeon",
        "The Hollow Throne"
    ]
];

/* =========================================================
   SCREEN SYSTEM
========================================================= */

const screenIds = [
    "loading-screen",
    "login-screen",
    "home-screen",
    "heroes-screen",
    "settings-screen",
    "controls-screen",
    "credits-screen",
    "gacha-screen",
    "metro-screen",
    "map-screen"
];

let gameRunning = false;
let paused = false;
let animationId = null;

/* Every overlay that floats above a screen (play / quit / pause / result). */
function closeOverlay() {
    ["play-overlay", "quit-overlay", "pause-overlay"].forEach(id => {
        const el = $(id);
        if (el) el.classList.add("hidden");
    });
}

/* Screen swaps that deserve a transition are wrapped in a short wipe
   (js/menuNav.js). Falls back to an instant swap when unavailable. */
function goScreen(fn) {
    if (window.MenuNav && MenuNav.wipe) MenuNav.wipe(fn);
    else if (typeof fn === "function") fn();
}

function playLevel(world, level) {
    goScreen(() => startLevel(world, level));
}

function hideScreens() {
    if (window.Metro) Metro.stop();      // leaving the Descent: stop its loop + save
    clearInput();                        // no key may survive a screen change
    closeOverlay();
    screenIds.forEach(id => {
        const screen = $(id);

        if (screen) {
            screen.classList.add("hidden");
        }
    });
}

function stopGame() {
    gameRunning = false;
    clearInput();
    if (window.Scenery) Scenery.pauseAmbient();

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function menuReady() {
    if (window.MenuNav && MenuNav.autoSelect) MenuNav.autoSelect();
}

function showHome() {
    stopGame();
    paused = false;

    const result = $("result-overlay");
    if (result) result.remove();

    const worldMenu = $("world-map-menu");
    if (worldMenu) worldMenu.remove();

    hideScreens();

    const home = $("home-screen");

    if (home) {
        home.classList.remove("hidden");
    }

    updateAllHUD();
    menuReady();
}

function openHeroes() {
    stopGame();

    hideScreens();

    const screen = $("heroes-screen");

    if (screen) {
        screen.classList.remove("hidden");
    }

    renderHeroes();
    updateAllHUD();
    menuReady();
}

function openSettings() {
    stopGame();

    hideScreens();

    const screen = $("settings-screen");

    if (screen) {
        screen.classList.remove("hidden");
    }

    updateSettingsButtons();
    menuReady();
}

function openControls() {
    stopGame();

    hideScreens();

    const screen = $("controls-screen");

    if (screen) {
        screen.classList.remove("hidden");
    }

    menuReady();
}

function openCredits() {
    stopGame();

    hideScreens();

    const screen = $("credits-screen");

    if (screen) {
        screen.classList.remove("hidden");
    }

    menuReady();
}

function openMap() {
    stopGame();
    paused = false;

    hideScreens();

    const screen = $("map-screen");

    if (screen) {
        screen.classList.remove("hidden");
    }

    showWorldMap();
    menuReady();
}

/* ---------- play / quit overlays (the home screen stays behind them) ---- */

function openPlay() {
    const overlay = $("play-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    Sfx("click");
    menuReady();
}

function openQuit() {
    const overlay = $("quit-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    Sfx("click");
    menuReady();
}

/* Quit = return to the Threshold (a web page cannot close its own tab).
   Progress is already in the save; the gate keeps the fiction intact. */
function confirmQuit() {
    closeOverlay();
    goScreen(() => {
        if (window.openLogin) openLogin();
        else showHome();
    });
}

/* ---------- pause (Levels) --------------------------------------------- */

function togglePause() {

    if (!gameRunning) return;

    paused = !paused;

    const overlay = $("pause-overlay");

    if (overlay) {
        overlay.classList.toggle("hidden", !paused);
    }

    clearInput();

    if (paused) {
        Sfx("click");
        menuReady();
    }
}

function restartLevel() {
    paused = false;
    const overlay = $("pause-overlay");
    if (overlay) overlay.classList.add("hidden");
    goScreen(() => startLevel(currentWorld, currentLevel));
}

/* =========================================================
   LOADING
========================================================= */

let loadingStarted = false;

/* Lines of lore shown under the title while the bar fills (one per stage). */
const LOADING_LORE = [
    "Kindling the lantern…",
    "Waking the old roads…",
    "Gathering scattered Geo…",
    "The vessel stirs…"
];
const LORE_STEP = 600;     // ms each line stays on screen

function startLoading() {
    if (loadingStarted) return;
    loadingStarted = true;

    const screen = $("loading-screen");
    const bar = $("loading-progress");
    const percent = $("loading-percent");
    const ring = $("loading-ring");
    const lore = $("loading-lore");
    const track = screen ? screen.querySelector(".loading-track") : null;

    if (!screen) { showHome(); return; }

    screen.classList.remove("hidden");
    screen.style.cssText = "display:flex;position:fixed;inset:0;z-index:9999";

    /* Long enough to actually see the sigil fill and the title rise, but still
       capped so a slow network can never hold the player here. */
    const MIN = 1900;     // shortest time the loading screen is shown
    const MAX = 3200;     // never wait longer than this, whatever the network does
    const RING = 414.69;  // circumference of the sigil's progress ring (r = 66)
    const t0 = performance.now();
    let finished = false, loreIndex = 0, loreTimer = 0;

    /* One pending swap at a time, so fast progress can never leave the line faded out. */
    const setLore = i => {
        if (!lore || i === loreIndex) return;
        loreIndex = i;
        lore.classList.add("swap");
        clearTimeout(loreTimer);
        loreTimer = setTimeout(() => { lore.textContent = LOADING_LORE[loreIndex]; lore.classList.remove("swap"); }, 180);
    };

    const setProgress = p => {
        p = Math.min(100, Math.round(p));
        if (bar) bar.style.width = p + "%";
        if (percent) percent.textContent = p + "%";
        if (ring) ring.style.strokeDashoffset = (RING * (1 - p / 100)).toFixed(2);
        if (track) track.setAttribute("aria-valuenow", p);
    };

    /* ease-out towards 92% while waiting, then snap to 100% on finish */
    const tick = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / MIN);
        setProgress(92 * (1 - Math.pow(1 - k, 2.2)));
        setLore(Math.min(LOADING_LORE.length - 1, Math.floor((performance.now() - t0) / LORE_STEP)));
    }, 50);

    const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(tick);
        setProgress(100);
        screen.classList.add("done");
        setTimeout(() => {
            screen.classList.add("leaving");
            if (window.showInitialScreen) window.showInitialScreen();
            else showHome();
            /* showInitialScreen() hides every screen; keep the loader painted on top
               while it fades out, then remove it for good. */
            screen.classList.remove("hidden");
            setTimeout(() => {
                screen.classList.add("hidden");
                screen.classList.remove("leaving");
                screen.style.display = "none";
            }, 760);
        }, 380);
    };

    /* Real work: wait for the (self-hosted, tiny) fonts, but give up after 600 ms. */
    const fonts = document.fonts && document.fonts.load
        ? Promise.race([
            Promise.all([document.fonts.load("700 1em Cinzel"), document.fonts.load("500 1em Cinzel")]).catch(() => {}),
            new Promise(r => setTimeout(r, 600))
          ])
        : Promise.resolve();

    fonts.then(() => setTimeout(finish, Math.max(0, MIN - (performance.now() - t0))));
    setTimeout(finish, MAX);
}

/* =========================================================
   SETTINGS
========================================================= */

/* Reflect the interface settings on <html> so CSS can honour them. */
function applySettingsClasses() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!root || !root.classList) return;
    root.classList.toggle("reduce-motion", !!save.settings.reduceMotion);
    root.classList.toggle("high-contrast", !!save.settings.highContrast);
}

function toggleSetting(button) {
    if (!button) return;

    /* Interface rows are driven by data-opt, not by their title text. */
    const opt = button.dataset ? button.dataset.opt : null;

    if (opt) {
        save.settings[opt] = !save.settings[opt];
        applySettingsClasses();
        saveGame();
        updateSettingsButtons();
        return;
    }

    const row = button.closest(".setting-row");

    if (!row) return;

    const title =
        row.querySelector("strong")?.textContent || "";

    if (title.includes("Music")) {
        save.settings.music = !save.settings.music;

        /* ambience follows the toggle right away, not on the next level */
        if (window.Scenery) Scenery.applyMusicPref(save.settings.music);
    }

    if (title.includes("Sound")) {
        save.settings.sound = !save.settings.sound;
    }

    saveGame();
    updateSettingsButtons();
}

function updateSettingsButtons() {
    const rows = document.querySelectorAll(".setting-row");

    rows.forEach(row => {
        const title =
            row.querySelector("strong")?.textContent || "";

        const button = row.querySelector("button");

        if (!button) return;

        if (title.includes("Music")) {
            button.textContent =
                save.settings.music ? "ON" : "OFF";
        }

        if (title.includes("Sound")) {
            button.textContent =
                save.settings.sound ? "ON" : "OFF";
        }
    });

    /* interface rows (control hints, reduce motion, high contrast) */
    document.querySelectorAll("[data-opt]").forEach(button => {
        const opt = button.dataset.opt;
        if (opt in save.settings) {
            button.textContent = save.settings[opt] ? "ON" : "OFF";
        }
    });
}

/* =========================================================
   HERO SHOP
========================================================= */

function renderPixelHero(hero) {
    return `
        <div class="pixel-preview" style="--hero:${hero.color}">
            <div class="pixel-cap"></div>
            <div class="pixel-face"></div>
            <div class="pixel-body"></div>
        </div>
    `;
}

function renderHeroes() {
    const grid = $("hero-grid");

    if (!grid) return;

    grid.innerHTML = "";

    heroes.forEach(hero => {
        const unlocked =
            save.unlockedHeroes.includes(hero.id);

        const selected =
            save.selectedHero === hero.id;

        const card =
            document.createElement("div");

        card.className = "hero-card";

        card.innerHTML = `
            ${renderPixelHero(hero)}

            <h2>${hero.name}</h2>

            <p>✨ ${hero.ability}</p>

            <small>
                ${
                    hero.price === 0
                        ? "Starter Hero"
                        : "◈ " + hero.price
                }
            </small>

            <button class="game-button">
                ${
                    selected
                        ? "SELECTED"
                        : unlocked
                            ? "SELECT"
                            : "BUY"
                }
            </button>
        `;

        const button =
            card.querySelector("button");

        button.addEventListener("click", () => {
            if (unlocked) {
                save.selectedHero = hero.id;
                saveGame();
                renderHeroes();
                updateAllHUD();
                return;
            }

            if (save.coins >= hero.price) {
                save.coins -= hero.price;
                save.unlockedHeroes.push(hero.id);
                save.selectedHero = hero.id;

                saveGame();

                renderHeroes();
                updateAllHUD();

                notify(`${hero.name} joined your party!`);
            } else {
                notify(
                    `You need ${hero.price - save.coins} more Geo!`
                );
            }
        });

        grid.appendChild(card);
    });
}

/* =========================================================
   LEVEL UNLOCKING
========================================================= */

function isLevelUnlocked(world, level) {
    if (world === 0 && level === 0) {
        return true;
    }

    if (level > 0) {
        return !!save.completedLevels[
            `${world}-${level - 1}`
        ];
    }

    return !!save.completedLevels[
        `${world - 1}-3`
    ];
}

/* =========================================================
   WORLD MAP
========================================================= */

function showWorldMap() {
    const map = $("map-screen");

    if (!map) return;

    let menu = $("world-map-menu");

    if (!menu) {
        menu = document.createElement("div");
        menu.id = "world-map-menu";
        map.appendChild(menu);
    }

    menu.classList.remove("hidden");

    menu.innerHTML = `
        <div class="world-map-panel">

            <div class="map-title">
                <span>🗺️</span>

                <div>
                    <h1>MILO WORLD MAP</h1>
                    <p>Explore seven different worlds</p>
                </div>

                <b>◈ ${save.coins}</b>
            </div>

            ${worlds.map((world, wi) => {

                const worldUnlocked =
                    wi === 0 ||
                    !!save.completedLevels[`${wi - 1}-3`];

                return `
                    <div class="world-card">

                        <div class="world-heading">
                            <span>${world.icon}</span>

                            <div>
                                <h2>
                                    WORLD ${wi + 1}
                                    ${
                                        worldUnlocked
                                            ? ""
                                            : " 🔒"
                                    }
                                </h2>

                                <p>${world.name}</p>
                            </div>
                        </div>

                        <p style="
                            opacity:.65;
                            margin-bottom:15px;
                        ">
                            ${world.description}
                        </p>

                        <div class="level-grid">

                            ${[0, 1, 2, 3].map(li => {

                                const unlocked =
                                    worldUnlocked &&
                                    isLevelUnlocked(wi, li);

                                const completed =
                                    !!save.completedLevels[
                                        `${wi}-${li}`
                                    ];

                                const boss =
                                    li === 3;

                                return `
                                    <button
                                        class="level-button ${boss ? "boss" : ""}"
                                        ${
                                            unlocked
                                                ? ""
                                                : "disabled"
                                        }
                                        onclick="
                                            playLevel(
                                                ${wi},
                                                ${li}
                                            )
                                        "
                                    >
                                        ${
                                            completed
                                                ? "⭐ "
                                                : ""
                                        }

                                        LEVEL ${li + 1}

                                        <small>
                                            ${levelNames[wi][li]}
                                        </small>

                                        <em>
                                            ${
                                                boss
                                                    ? "👑 BOSS"
                                                    : unlocked
                                                        ? "PLAY"
                                                        : "🔒 LOCKED"
                                            }
                                        </em>
                                    </button>
                                `;
                            }).join("")}

                        </div>
                    </div>
                `;
            }).join("")}

            <button
                class="back-button"
                onclick="showHome()"
            >
                ← BACK TO HOME
            </button>

        </div>
    `;
}

/* =========================================================
   CANVAS
========================================================= */

const canvas = $("gameCanvas");
const ctx = canvas
    ? canvas.getContext("2d")
    : null;

function resizeCanvas() {
    if (!canvas || !ctx) return;

    const dpr =
        Math.min(window.devicePixelRatio || 1, 2);

    canvas.width =
        window.innerWidth * dpr;

    canvas.height =
        window.innerHeight * dpr;

    canvas.style.width =
        window.innerWidth + "px";

    canvas.style.height =
        window.innerHeight + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}

window.addEventListener(
    "resize",
    resizeCanvas
);

/* =========================================================
   GAME VARIABLES
========================================================= */

let currentWorld = 0;
let currentLevel = 0;

let health = 3;
let maxHealth = 3;

let cameraX = 0;
let levelWidth = 5000;

let platforms = [];
let ladders = [];
let coinsItems = [];
let enemies = [];
let hazards = [];
let particles = [];
let projectiles = [];
let checkpoints = [];
let props = [];                       // living ground detail (see js/art.js)

let finishLine = null;
let boss = null;

const keys = {};
const justPressed = {};

/* Drop every held key / edge press. Called whenever we change screen,
   restart a level or stop the game so no stale input "leaks" into the
   next screen (e.g. a held Space that immediately jumps on restart). */
function clearInput() {
    Object.keys(keys).forEach(key => {
        keys[key] = false;
    });

    Object.keys(justPressed).forEach(key => {
        justPressed[key] = false;
    });
}

/* =========================================================
   PLAYER
========================================================= */

const player = {
    x: 100,
    y: 300,

    width: 44,
    height: 64,

    vx: 0,
    vy: 0,

    speed: 4,
    jumpPower: 12,

    grounded: false,
    climbing: false,

    direction: 1,

    dashCooldown: 0,
    attackCooldown: 0,
    specialCooldown: 0,

    invincible: 0,
    hurtTimer: 0,

    animation: 0,
    animationFrame: 0,

    attackTimer: 0,
    dashTimer: 0,
    abilityTimer: 0,

    checkpointX: 100,
    checkpointY: 300,

    shield: false,

    /* ---- presentation state only (see drawPlayer / Art.drawVessel) ---- */
    squash: 0,
    wasAir: false,
    shadowY: 364,
    stepT: 0,

    /* ---- ladders + input feel (polish pass) ---- */
    climbLadder: null,     /* the ladder currently gripped */
    grabCd: 0,             /* frames before a ladder may be re-grabbed */
    sideHold: 0,           /* frames of sideways pressure while climbing */
    coyote: 0,             /* frames after leaving ground where jump still works */
    jumpBuffer: 0          /* frames a buffered jump press stays live */
};

/* =========================================================
   START LEVEL
========================================================= */

function startLevel(world, level) {
    currentWorld = world;
    currentLevel = level;

    stopGame();

    const menu = $("world-map-menu");

    if (menu) {
        menu.remove();
    }

    const map = $("map-screen");

    if (map) {
        map.classList.remove("hidden");
    }

    health = maxHealth;

    clearInput();

    player.x = 120;
    player.y = 300;

    player.vx = 0;
    player.vy = 0;

    player.grounded = false;
    player.climbing = false;
    player.climbLadder = null;
    player.grabCd = 0;
    player.sideHold = 0;
    player.coyote = 0;
    player.jumpBuffer = 0;

    player.invincible = 90;
    player.hurtTimer = 0;

    player.attackTimer = 0;
    player.dashTimer = 0;
    player.abilityTimer = 0;

    /* cooldowns + shield must never leak from the previous level */
    player.attackCooldown = 0;
    player.dashCooldown = 0;
    player.specialCooldown = 0;
    player.shield = false;

    player.checkpointX = 120;
    player.checkpointY = 300;

    player.direction = 1;

    cameraX = 0;
    if (window.Scenery) {
        Scenery.setWorld(world);
        Scenery.resetCamera(cameraX);      // no particle "jump" on the first frame
    }

    createLevel();

    updateAllHUD();

    /* objective line: the one thing the player is told up front */
    setHud("hud-level", worlds[currentWorld].name + " · Level " + (currentLevel + 1));
    setHud("hud-goal", currentLevel === 3 ? "Defeat the guardian" : "Reach the goal banner");

    paused = false;

    const pauseMenu = $("pause-overlay");
    if (pauseMenu) pauseMenu.classList.add("hidden");

    gameRunning = true;

    startGameLoop();
}

/* =========================================================
   CREATE LEVEL
========================================================= */

function createLevel() {
    platforms = [];
    ladders = [];
    coinsItems = [];
    enemies = [];
    hazards = [];
    particles = [];
    projectiles = [];
    checkpoints = [];

    boss = null;
    finishLine = null;

    const difficulty =
        currentWorld * 1.2 +
        currentLevel * 0.8;

    levelWidth =
        4300 +
        currentWorld * 400 +
        currentLevel * 350;

    /* -------------------------
       MAIN GROUND
    ------------------------- */

    platforms.push({
        x: 0,
        y: 520,
        width: levelWidth,
        height: 120,
        type: "ground"
    });

    /* the floor line: every flag and banner is planted on this surface */
    const GROUND_Y = platforms[0].y;

    /* -------------------------
       PLATFORMS
    ------------------------- */

    let platformX = 400;

    while (platformX < levelWidth - 450) {

        const gap =
            260 +
            Math.random() * 120;

        const platformY =
            350 +
            Math.random() * 100;

        const platformWidth =
            150 +
            Math.random() * 120;

        platforms.push({
            x: platformX,
            y: platformY,
            width: platformWidth,
            height: 25,
            type: "platform"
        });

        /* Coins */

        for (
            let c = 0;
            c < 3;
            c++
        ) {
            coinsItems.push({
                x:
                    platformX +
                    35 +
                    c * 35,
                y:
                    platformY - 35,
                collected: false,
                bob: Math.random() * 10
            });
        }

        /* Ladder */

        if (
            Math.random() >
            0.35
        ) {
            ladders.push({
                x:
                    platformX +
                    platformWidth / 2 -
                    10,
                y: platformY,
                width: 20,
                height:
                    520 - platformY
            });
        }

        platformX += gap;
    }

    /* -------------------------
       COINS ON GROUND
    ------------------------- */

    for (
        let x = 300;
        x < levelWidth - 500;
        x += 260
    ) {
        coinsItems.push({
            x,
            y: 460,
            collected: false,
            bob: Math.random() * 10
        });
    }

    /* -------------------------
       CHECKPOINTS — small goal-style banners, planted on the ground
    ------------------------- */

    for (
        let x = 1500;
        x < levelWidth - 700;
        x += 1500
    ) {
        checkpoints.push({
            x,
            y: GROUND_Y,
            activated: false
        });
    }

    /* -------------------------
       HAZARDS
    ------------------------- */

    const hazardCount =
        2 +
        currentWorld +
        currentLevel;

    for (
        let i = 0;
        i < hazardCount;
        i++
    ) {
        const x =
            700 +
            i *
                (
                    (levelWidth - 1400) /
                    hazardCount
                );

        hazards.push({
            x,
            y: 495,
            width:
                currentWorld >= 4
                    ? 120
                    : 90,
            height: 25,
            type:
                currentWorld === 4
                    ? "lava"
                    : currentWorld === 5
                        ? "ice"
                        : currentWorld === 6
                            ? "dark"
                            : "thorn"
        });
    }

    /* -------------------------
       ENEMIES
    ------------------------- */

    const enemyTypes =
        worlds[currentWorld].enemy;

    const enemyCount =
        7 +
        currentWorld * 2 +
        currentLevel * 2;

    for (
        let i = 0;
        i < enemyCount;
        i++
    ) {
        const type =
            enemyTypes[
                i % enemyTypes.length
            ];

        const x =
            650 +
            i *
                (
                    (levelWidth - 1100) /
                    enemyCount
                );

        enemies.push(
            createEnemy(
                type,
                x,
                difficulty
            )
        );
    }

    /* -------------------------
       BOSS
    ------------------------- */

    if (currentLevel === 3) {
        boss = createBoss(
            worlds[currentWorld].boss
        );

        enemies.push(boss);
    }

    /* -------------------------
       FINISH LINE — the goal banner, planted ON the ground.
       The box below is also the interaction area: it ends exactly on
       the surface so the collider matches what the player sees.
    ------------------------- */

    finishLine = {
        x: levelWidth - 240,
        y: GROUND_Y - 170,
        width: 110,
        height: 170,
        phase: Math.random() * Math.PI * 2   /* pennant wave offset */
    };

    /* -------------------------
       LIVING DETAIL
       Deterministic, cheap ground detail (swaying grass, ash reeds, ice
       spikes, hanging chains...). It is placed before hazards are known to
       be clear, never taller than one tile, and never over a coin row.
    ------------------------- */

    props = [];

    let seed = 1337 + currentWorld * 977 + currentLevel * 131;

    const rand = n => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return (seed / 0x7fffffff) * n;
    };

    const kinds = WORLD_PROPS[currentWorld] || ["pebble"];

    const clearOfHazards = x =>
        !hazards.some(
            h => x > h.x - 46 && x < h.x + h.width + 46
        );

    platforms.forEach(platform => {

        const count =
            platform.type === "ground"
                ? Math.max(8, Math.floor(platform.width / 210))
                : 3;

        const span = Math.max(30, platform.width - 60);

        for (let i = 0; i < count; i++) {

            const x = platform.x + 30 + rand(span);

            if (!clearOfHazards(x)) continue;

            props.push({
                kind: kinds[(rand(97) | 0) % kinds.length],
                x: x,
                y: platform.y + 2,
                seed: rand(1) * 10,
                world: currentWorld
            });
        }
    });
}

/* Per-world prop palette: one material idea per zone (see docs/ART_DIRECTION.md) */
const WORLD_PROPS = [
    ["pebble", "mushroom", "grass"],          // Forgotten Crossroads
    ["grass", "mushroom", "spore"],           // Mossy Greenpath
    ["crystal", "pebble", "spore"],           // Crystal Depths
    ["chain", "pebble", "grass"],             // City of Rain
    ["reed", "pebble"],                       // Ashen Basin
    ["ice", "pebble"],                        // Pale Peaks
    ["rib", "pebble", "crystal"]              // Hollow Castle
];

function drawProps() {

    if (!window.Art || !props.length) return;

    const t = Art.FX.t;

    props.forEach(prop => {

        if (prop.x < cameraX - 60 || prop.x > cameraX + window.innerWidth + 60) return;

        Art.prop(ctx, prop.kind, prop.x, prop.y, prop.seed, t, prop.world);
    });
}

/* =========================================================
   ENEMY CREATION
========================================================= */

function createEnemy(type, x, difficulty) {

    const base = {
        type,
        x,
        y: 460,
        width: 46,
        height: 46,

        vx:
            (Math.random() > 0.5 ? 1 : -1) *
            (
                1.1 +
                difficulty * 0.12
            ),

        speed:
            1.1 +
            difficulty * 0.12,

        health: 1,

        maxHealth: 1,

        alive: true,

        frozen: 0,

        attackTimer:
            70 +
            Math.random() * 70,

        phase:
            Math.random() * 10,

        jumpTimer:
            80 +
            Math.random() * 80,

        shootTimer:
            100 +
            Math.random() * 100,

        /* ---- presentation state only; nothing here changes gameplay ---- */
        vy: 0,
        animT: Math.random() * 60,
        hitFlash: 0,
        windup: 0,
        alert: false,
        deathT: 0
    };

    switch (type) {

        case "slime":
            base.health = 1;
            base.maxHealth = 1;
            break;

        case "beetle":
            base.health = 2;
            base.maxHealth = 2;
            base.speed *= 1.2;
            break;

        case "mushling":
            base.health = 2;
            base.maxHealth = 2;
            break;

        case "wolf":
            base.health = 3;
            base.maxHealth = 3;
            base.speed *= 1.5;
            break;

        case "thorn":
            base.health = 2;
            base.maxHealth = 2;
            base.shooter = true;
            break;

        case "forestSpirit":
            base.health = 3;
            base.maxHealth = 3;
            base.floating = true;
            break;

        case "bat":
            base.health = 2;
            base.maxHealth = 2;
            base.flying = true;
            break;

        case "rockCrawler":
            base.health = 4;
            base.maxHealth = 4;
            base.speed *= 0.7;
            break;

        case "crystalBug":
            base.health = 3;
            base.maxHealth = 3;
            break;

        case "cloudSpirit":
            base.health = 3;
            base.maxHealth = 3;
            base.flying = true;
            break;

        case "stormBird":
            base.health = 4;
            base.maxHealth = 4;
            base.flying = true;
            base.speed *= 1.5;
            break;

        case "skyEye":
            base.health = 3;
            base.maxHealth = 3;
            base.flying = true;
            base.shooter = true;
            break;

        case "lavaSlime":
            base.health = 3;
            base.maxHealth = 3;
            break;

        case "fireBat":
            base.health = 4;
            base.maxHealth = 4;
            base.flying = true;
            break;

        case "magmaBeast":
            base.health = 5;
            base.maxHealth = 5;
            base.width = 58;
            base.height = 58;
            base.speed *= 0.7;
            break;

        case "iceWolf":
            base.health = 4;
            base.maxHealth = 4;
            base.speed *= 1.3;
            break;

        case "frostBat":
            base.health = 4;
            base.maxHealth = 4;
            base.flying = true;
            break;

        case "iceGolem":
            base.health = 6;
            base.maxHealth = 6;
            base.width = 60;
            base.height = 60;
            base.speed *= 0.6;
            break;

        case "darkMushroom":
            base.health = 5;
            base.maxHealth = 5;
            break;

        case "knight":
            base.health = 7;
            base.maxHealth = 7;
            base.width = 52;
            base.height = 60;
            base.speed *= 0.8;
            break;

        case "magicGuardian":
            base.health = 6;
            base.maxHealth = 6;
            base.shooter = true;
            break;
    }

    /* The art anchors to the feet, so hitbox and drawing finally agree:
       every ground mob stands on the ground line at y = 520. */
    base.groundY = 520 - base.height;
    base.y = base.groundY;

    return base;
}

/* =========================================================
   BOSS CREATION
========================================================= */

function createBoss(type) {

    const bossData = {
        meadowGuardian: {
            name: "MEADOW GUARDIAN",
            color: "#9c6845",
            secondary: "#613923",
            width: 100,
            height: 115,
            health: 30,
            speed: 1.3
        },

        forestBeast: {
            name: "FOREST BEAST",
            color: "#4f7045",
            secondary: "#283b2a",
            width: 115,
            height: 100,
            health: 40,
            speed: 1.6
        },

        crystalGolem: {
            name: "CRYSTAL GOLEM",
            color: "#72d4e8",
            secondary: "#315a9c",
            width: 125,
            height: 125,
            health: 50,
            speed: 1
        },

        stormDragon: {
            name: "STORM DRAGON",
            color: "#806be0",
            secondary: "#40366e",
            width: 145,
            height: 120,
            health: 60,
            speed: 1.8
        },

        magmaLord: {
            name: "MAGMA LORD",
            color: "#e95a32",
            secondary: "#7c251b",
            width: 130,
            height: 135,
            health: 70,
            speed: 1.1
        },

        frostTitan: {
            name: "FROST TITAN",
            color: "#9de5f0",
            secondary: "#4e7897",
            width: 140,
            height: 145,
            health: 80,
            speed: 1
        },

        mushroomKing: {
            name: "MUSHROOM KING",
            color: "#9b3e62",
            secondary: "#401f38",
            width: 145,
            height: 150,
            health: 100,
            speed: 1.2
        }
    };

    const data =
        bossData[type];

    return {
        type: "boss",
        bossType: type,

        name: data.name,

        x: levelWidth - 800,
        y: 520 - data.height,        // feet on the ground line (used to float at 360)

        width: data.width,
        height: data.height,

        vx: -data.speed,

        speed: data.speed,

        health: data.health,
        maxHealth: data.health,

        color: data.color,
        secondary: data.secondary,

        alive: true,

        frozen: 0,

        attackTimer: 100,
        shootTimer: 150,
        jumpTimer: 120,

        phase: 0
    };
}

/* =========================================================
   INPUT
========================================================= */

/* True when the event is typing in a form field (which needs its own
   Space / arrow handling). Menus as a whole are covered by the
   !gameRunning check below. */
function isTypingTarget(target) {
    if (!target) return false;
    const tag = (target.tagName || "").toLowerCase();
    return tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable;
}

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();

        /* Esc always works while a level runs: pause / resume. */
        if (key === "escape" && gameRunning) {
            event.preventDefault();
            togglePause();
            return;
        }

        /* Menus own the keyboard: never hijack Space / arrows while the
           game is not running, paused, or while the user is typing. */
        if (!gameRunning || paused || isTypingTarget(event.target)) {
            return;
        }

        if (!keys[key]) {
            justPressed[key] = true;
        }

        keys[key] = true;

        if (
            [
                " ",
                "arrowup",
                "arrowdown",
                "arrowleft",
                "arrowright"
            ].includes(key)
        ) {
            event.preventDefault();
        }

        if (
            key === "f" ||
            key === "j"
        ) {
            attack();
        }

        if (key === "e") {
            /* E interacts with the goal banner; otherwise it is the
               hero's special ability (unchanged behaviour). */
            if (!tryInteract()) useSpecial();
        }

        if (event.key === "Shift") {
            dash();
        }

        if (key === " ") {
            handleSpace();
        }
    }
);

window.addEventListener(
    "keyup",
    event => {

        const key = event.key.toLowerCase();

        keys[key] = false;

        /* variable jump height: releasing Space early cuts the rise */
        if (key === " " && player.vy < -4) {
            player.vy *= 0.55;
        }
    }
);

window.addEventListener("blur", clearInput);

/* Unified held-state: keyboard OR gamepad (js/menuNav.js). */
function inputHeld(name) {
    const pad = window.MenuNav && MenuNav.held;

    switch (name) {
        case "left":
            return keys["arrowleft"] || keys["a"] || (pad && pad.left);
        case "right":
            return keys["arrowright"] || keys["d"] || (pad && pad.right);
        case "up":
            return keys["arrowup"] || keys["w"] || (pad && pad.up);
        case "down":
            return keys["arrowdown"] || keys["s"] || (pad && pad.down);
    }

    return false;
}

/* Gamepad edge actions route through here (js/menuNav.js polls the pad). */
window.MiloInput = {
    action(name) {
        if (name === "pause" && gameRunning) {
            togglePause();
            return;
        }
        if (!gameRunning || paused) return;

        if (name === "jump") handleSpace();
        else if (name === "attack") attack();
        else if (name === "dash") dash();
        else if (name === "interact") { if (!tryInteract()) useSpecial(); }
    }
};

/* =========================================================
   SPACE / JUMP / LADDERS
   Space is ONLY jump (and hop-off while climbing). Ladders are
   used by walking onto them and pressing W/S — no jump toggle.
========================================================= */

const CLIMB_SPEED = 2.7;

function handleSpace() {

    if (!gameRunning || paused) return;

    /* climbing: hop off the ladder in the facing direction */
    if (player.climbing) {
        stopClimb(true);
        return;
    }

    /* buffered jump: consumed by updatePlayer (survives hit-stop) */
    player.jumpBuffer = 7;
}

/* The player's body overlaps a ladder (generous side margin).
   The feet must be clearly below the top: standing on the platform a
   ladder hangs from does NOT count as "on" the ladder. */
function overLadder() {

    return ladders.find(ladder =>
        player.x + player.width > ladder.x - 14 &&
        player.x < ladder.x + ladder.width + 14 &&
        player.y + player.height > ladder.y + 6 &&
        player.y < ladder.y + ladder.height + 8
    ) || null;
}

/* Standing on (or just above) the platform a ladder hangs from. */
function ladderFromTop() {

    return ladders.find(ladder =>
        player.x + player.width > ladder.x - 14 &&
        player.x < ladder.x + ladder.width + 14 &&
        player.y + player.height >= ladder.y - 10 &&
        player.y + player.height <= ladder.y + 16
    ) || null;
}

function startClimb(ladder) {

    if (!ladder) return;

    player.climbing = true;
    player.climbLadder = ladder;
    player.grounded = false;
    player.vy = 0;
    player.sideHold = 0;
    player.squash = 0;

    Sfx("latch");
    createDust(player.x + player.width / 2, player.y + player.height);
}

function stopClimb(hop) {

    player.climbing = false;
    player.climbLadder = null;
    player.grabCd = 12;
    player.sideHold = 0;

    if (hop) {
        player.vy = -player.jumpPower * 0.62;
        player.vx = player.direction * player.speed * 0.9;
        player.squash = -0.1;
        Sfx("wing");
    }
}

function isNearLadder() {
    return !!overLadder() || !!ladderFromTop();
}

/* One ladder state machine, called from updatePlayer. All exits are
   natural (top / ground / sideways / hop-off / leaving the span). */
function updateClimb() {

    const ladder = player.climbLadder;

    if (!ladder) { stopClimb(false); return; }

    /* left the ladder's vertical span: gravity resumes, no sticking */
    const feet = player.y + player.height;

    if (feet < ladder.y - 24 || player.y > ladder.y + ladder.height + 12) {
        stopClimb(false);
        return;
    }

    player.vy = 0;

    const movingLeft = inputHeld("left");
    const movingRight = inputHeld("right");
    const movingUp = inputHeld("up");
    const movingDown = inputHeld("down");

    if (movingLeft || movingRight) {

        /* sideways pressure: step off after a few frames */
        player.x += (movingRight ? 1 : -1) * 1.8;
        player.direction = movingRight ? 1 : -1;
        player.sideHold++;

        if (player.sideHold >= 5) {
            player.vx = player.direction * player.speed * 0.6;
            stopClimb(false);
            return;
        }
    } else {
        player.sideHold = 0;
        /* hands free: ease onto the ladder's axis (stable grip, no jitter) */
        const targetX = ladder.x + ladder.width / 2 - player.width / 2;
        player.x += (targetX - player.x) * 0.25;
    }

    if (movingUp) player.y -= CLIMB_SPEED;
    if (movingDown) player.y += CLIMB_SPEED;

    /* top: step off onto the platform the ladder hangs from
       (only while climbing up — climbing down passes this zone) */
    if (movingUp && player.y + player.height <= ladder.y + 8) {
        player.y = ladder.y - player.height;
        player.grounded = true;
        stopClimb(false);
        player.grabCd = 10;
        return;
    }

    /* ground: step off at the floor line (except while actively climbing
       up from it — W on a ground-level ladder must start an ascent) */
    const groundY = platforms.length ? platforms[0].y : 520;
    const feetNow = player.y + player.height;

    if (feetNow >= groundY && (!movingUp || feetNow > groundY + 4)) {
        player.y = groundY - player.height;
        player.grounded = true;
        stopClimb(false);
        player.grabCd = 10;
    }
}

/* =========================================================
   DASH
========================================================= */

function dash() {

    if (!gameRunning) return;

    if (player.dashCooldown > 0) return;

    player.vx =
        player.direction * 15;

    player.dashCooldown = 40;
    player.dashTimer = 12;
    player.invincible = 15;

    for (let i = 0; i < 5; i++) {
        createParticle(
            player.x,
            player.y + 30,
            "dash"
        );
    }

    Sfx("dash");

    const fx = Fx();
    if (fx) {
        fx.addShake(1.3);
        fx.ring(player.x + player.width / 2, player.y + player.height - 6, 10, "rgba(232,237,243,.55)");
    }
}

/* =========================================================
   ATTACK
========================================================= */

function attack() {

    if (!gameRunning) return;

    if (player.attackCooldown > 0) return;

    player.attackCooldown = 20;
    player.attackTimer = 12;

    const attackRange = 85;

    enemies.forEach(enemy => {

        if (!enemy.alive) return;

        const dx =
            enemy.x -
            player.x;

        const inFront =
            player.direction === 1
                ? dx > -15 && dx < attackRange
                : dx < 15 && dx > -attackRange;

        if (!inFront) return;

        damageEnemy(
            enemy,
            1
        );
    });

    createAttackParticles();

    Sfx("swing");

    const fx = Fx();
    if (fx) fx.addShake(0.7);
}

/* =========================================================
   DAMAGE ENEMY
========================================================= */

function damageEnemy(enemy, amount) {

    if (!enemy.alive) return;

    enemy.health -= amount;

    createHitParticles(
        enemy.x +
            enemy.width / 2,
        enemy.y +
            enemy.height / 2
    );

    /* ---- hit reaction: flash, knockback, number, hit-stop, shake ---- */
    const boss = enemy.type === "boss";

    enemy.hitFlash = 1;
    enemy.windup = 0;

    const away =
        (enemy.x + enemy.width / 2) <
            (player.x + player.width / 2) ? -1 : 1;

    enemy.x += away * (boss ? 1.5 : 4);

    const fx = Fx();

    if (fx) {

        fx.number(
            enemy.x + enemy.width / 2,
            enemy.y - 8,
            "-" + amount,
            boss ? "#ff8a8a" : "#ffd9a8"
        );

        fx.addShake(boss ? 4 : 2.2);
        fx.freeze(boss ? 6 : 3);
        fx.ring(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 6, "#e8edf3");
    }

    Sfx("hit");

    if (enemy.health <= 0) {

        enemy.alive = false;
        enemy.deathT = boss ? 60 : 34;      // the death animation plays first

        const reward =
            enemy.type === "boss"
                ? 250
                : 10 + currentWorld * 3;

        save.coins += reward;

        saveGame();

        createExplosion(
            enemy.x +
                enemy.width / 2,
            enemy.y +
                enemy.height / 2
        );

        updateAllHUD();

        if (fx) {

            fx.freeze(boss ? 12 : 5);
            fx.addShake(boss ? 6 : 3);
            fx.number(enemy.x + enemy.width / 2, enemy.y - 24, "+" + reward + " ◈", "#8fc1e3");
            fx.ring(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 12, "#f2b84b");
            if (boss) fx.flash("#f2b84b", 0.3, 20);
        }

        Sfx(boss ? "bigdeath" : "kill");

        if (enemy.type === "boss") {
            createParticle(
                enemy.x,
                enemy.y - 40,
                "👑"
            );
        }
    }
}

/* =========================================================
   SPECIAL ABILITIES
========================================================= */

function useSpecial() {

    if (!gameRunning) return;

    if (player.specialCooldown > 0) return;

    player.specialCooldown = 110;
    player.abilityTimer = 30;

    Sfx("unlock");

    const fx = Fx();
    if (fx) {
        fx.addShake(2.2);
        fx.ring(player.x + player.width / 2, player.y + player.height - 10, 12, "#f2b84b");
    }

    const hero =
        heroes.find(
            h =>
                h.id ===
                save.selectedHero
        ) || heroes[0];

    switch (hero.id) {

        /* -------------------------
           MILO
        ------------------------- */

        case "milo":

            player.shield = true;
            player.invincible = 180;

            createShieldParticles();

            break;

        /* -------------------------
           LUNA
        ------------------------- */

        case "luna":

            player.vy = -21;

            player.invincible = 35;

            createMoonEffect();

            break;

        /* -------------------------
           ROCCO
        ------------------------- */

        case "rocco":

            player.vy = -9;

            enemies.forEach(enemy => {

                if (!enemy.alive) return;

                const distance =
                    Math.abs(
                        enemy.x -
                        player.x
                    );

                if (distance < 220) {
                    damageEnemy(
                        enemy,
                        4
                    );

                    enemy.vx =
                        player.direction * 6;
                }
            });

            createGroundShockwave();

            break;

        /* -------------------------
           ZUKI
        ------------------------- */

        case "zuki":

            projectiles.push({
                x:
                    player.x +
                    player.width / 2,

                y:
                    player.y + 25,

                vx:
                    player.direction * 12,

                vy: 0,

                type: "leaf",

                damage: 4,

                life: 70
            });

            break;

        /* -------------------------
           BLAZE
        ------------------------- */

        case "blaze":

            for (
                let i = 0;
                i < 10;
                i++
            ) {

                const angle =
                    (
                        Math.PI * 2 / 10
                    ) * i;

                projectiles.push({
                    x:
                        player.x + 20,

                    y:
                        player.y + 25,

                    vx:
                        Math.cos(angle) * 7,

                    vy:
                        Math.sin(angle) * 7,

                    type: "fire",

                    damage: 4,

                    life: 55
                });
            }

            createFireExplosion();

            break;

        /* -------------------------
           TARO
        ------------------------- */

        case "taro":

            enemies.forEach(enemy => {

                if (
                    enemy.alive &&
                    Math.abs(
                        enemy.x -
                        player.x
                    ) < 330
                ) {
                    enemy.frozen = 220;
                }
            });

            createFreezeEffect();

            break;

        /* -------------------------
           KOKO
        ------------------------- */

        case "koko":

            coinsItems.forEach(coin => {

                if (!coin.collected) {

                    coin.x +=
                        (
                            player.x -
                            coin.x
                        ) * 0.7;
                }
            });

            createMagnetEffect();

            break;

        /* -------------------------
           PIKO
        ------------------------- */

        case "piko":

            player.vx =
                player.direction * 25;

            player.dashTimer = 20;

            player.invincible = 35;

            createWaterTrail();

            break;

        /* -------------------------
           MIMI
        ------------------------- */

        case "mimi":

            health =
                Math.min(
                    maxHealth,
                    health + 2
                );

            createHealEffect();

            updateAllHUD();

            break;

        /* -------------------------
           BRUNO
        ------------------------- */

        case "bruno":

            enemies.forEach(enemy => {

                if (!enemy.alive) return;

                const distance =
                    Math.abs(
                        enemy.x -
                        player.x
                    );

                if (distance < 300) {
                    damageEnemy(
                        enemy,
                        8
                    );
                }
            });

            player.vy = -12;

            createMegaSmash();

            break;
    }
}

/* =========================================================
   PLAYER DAMAGE
========================================================= */

function damagePlayer(amount = 1) {

    if (
        player.invincible > 0 ||
        player.shield
    ) {
        return;
    }

    health -= amount;

    player.invincible = 90;
    player.hurtTimer = 25;

    player.vx =
        -player.direction * 6;

    player.vy = -8;

    createHitParticles(
        player.x,
        player.y
    );

    /* ---- damage feedback: red vignette, shake, hit-stop, HUD pulse ---- */
    const fx = Fx();

    if (fx) {
        fx.flash("#ff5a5a", 0.2, 14, 0.9);
        fx.addShake(4);
        fx.freeze(4);
        fx.number(player.x + player.width / 2, player.y + 6, "-" + amount, "#ff8a8a");
    }

    Sfx("hurt");
    pulseHud("hud-hit");

    updateAllHUD();

    if (health <= 0) {
        endLevel(false);
    }
}

/* =========================================================
   UPDATE GAME
========================================================= */

function updateGame() {

    if (!gameRunning || paused) return;

    const fx = Fx();
    if (fx) fx.step();

    /* Hit-stop: the world holds for a few frames on a big impact. Attacks,
       dashes and jumps fire straight from the keydown handler, so queued
       input is never swallowed by the freeze. */
    if (fx && fx.frozen()) return;

    updatePlayer();
    updateEnemies();
    updateProjectiles();
    updateHazards();
    updateCoins();
    updateCheckpoints();
    updateParticles();

    updateFinishLine();

    updateCamera();

    updateCooldowns();

    updateHUDGame();
}

/* =========================================================
   PLAYER UPDATE
========================================================= */

function updatePlayer() {

    const movingLeft = inputHeld("left");
    const movingRight = inputHeld("right");
    const movingUp = inputHeld("up");
    const movingDown = inputHeld("down");

    /* ---- ladders: W/S alone grabs and climbs (no jump-first toggle) ---- */

    if (player.grabCd > 0) player.grabCd--;

    if (player.climbing) {

        updateClimb();

    } else if (player.grabCd === 0) {

        const groundY = platforms.length ? platforms[0].y : 520;
        let ladder = null;

        if (movingUp) {
            /* W anywhere on the ladder grabs it — no jump-first toggle */
            ladder = overLadder();
        }

        else if (movingDown && player.y + player.height < groundY - 4) {
            /* S grabs the ladder under a platform (or one hung in the air),
               but never from solid ground: that is already the bottom */
            ladder = ladderFromTop() || overLadder();
        }

        if (ladder) {
            startClimb(ladder);
        }
    }

    /* ---- horizontal movement: quick accel, clean decel ---- */

    if (player.climbing) {

        player.vx = 0;

    } else {

        const dir = (movingRight ? 1 : 0) - (movingLeft ? 1 : 0);

        if (dir !== 0) {

            player.direction = dir;

            const accel = player.grounded ? 0.55 : 0.32;
            const target = dir * player.speed;

            player.vx += (target - player.vx) * accel;

            if (Math.abs(player.vx - target) < 0.05) {
                player.vx = target;
            }
        }

        else if (player.dashTimer <= 0) {

            player.vx *= 0.78;

            if (
                Math.abs(player.vx) < 0.1
            ) {
                player.vx = 0;
            }
        }

        /* Special movement */

        if (player.dashTimer > 0) {
            player.vx =
                player.direction *
                Math.max(
                    8,
                    Math.abs(player.vx)
                );
        }
    }

    /* ---- jump: buffered, coyote, consumed right here ---- */

    if (player.jumpBuffer > 0) player.jumpBuffer--;
    if (player.coyote > 0) player.coyote--;
    if (player.grounded) player.coyote = 6;

    if (
        !player.climbing &&
        player.jumpBuffer > 0 &&
        (player.grounded || player.coyote > 0)
    ) {

        player.vy =
            -player.jumpPower;

        player.grounded = false;
        player.coyote = 0;
        player.jumpBuffer = 0;

        createDust(
            player.x + 20,
            player.y + player.height
        );

        /* take-off: a little stretch, dust and a sound */
        player.squash = -0.12;
        Sfx("jump");
    }

    /* ---- vertical ---- */

    if (!player.climbing) {

        player.vy += 0.62;

        player.y += player.vy;
    }

    player.x += player.vx;

    /* Platform collision (a climbing player grips the ladder instead:
       the ladder state machine owns its vertical position) */

    const fallSpeed = player.vy;          // remembered for landing feedback

    player.grounded = false;

    if (!player.climbing) platforms.forEach(platform => {
        if (platform.x + platform.width < cameraX - 40 || platform.x > cameraX + window.innerWidth + 40) return;


        const horizontal =
            player.x +
                player.width >
                platform.x &&

            player.x <
                platform.x +
                platform.width;

        const previousBottom =
            player.y +
            player.height -
            player.vy;

        const currentBottom =
            player.y +
            player.height;

        if (
            horizontal &&
            player.vy >= 0 &&
            previousBottom <= platform.y + 8 &&
            currentBottom >= platform.y
        ) {

            player.y =
                platform.y -
                player.height;

            player.vy = 0;

            player.grounded = true;
        }
    });

    /* ---- landing: dust ring, squash, sound (weight without any delay) ---- */

    if (player.grounded && player.wasAir) {

        player.squash = Math.min(0.28, 0.12 + Math.abs(fallSpeed) * 0.013);
        player.shadowY = player.y + player.height;

        createDust(
            player.x + player.width / 2,
            player.y + player.height
        );

        const fx = Fx();

        if (fx) {
            fx.ring(player.x + player.width / 2, player.y + player.height, 9, "rgba(232,237,243,.5)");
            if (Math.abs(fallSpeed) > 7) fx.addShake(1.4);
        }

        Sfx("land");
    }

    if (player.grounded) player.shadowY = player.y + player.height;

    /* footsteps: a small puff every 16 frames of running */
    if (player.grounded && Math.abs(player.vx) > 1.5) {

        player.stepT = (player.stepT || 0) + 1;

        if (player.stepT % 16 === 0) {
            createParticle(
                player.x + player.width / 2 - Math.sign(player.vx) * 8,
                player.y + player.height - 2,
                "dust"
            );
        }
    }

    player.wasAir = !player.grounded;
    player.squash = Math.max(0, player.squash - 0.045);

    /* Ceiling */

    if (player.y < 0) {
        player.y = 0;
        player.vy = 0;
    }

    /* Fall */

    if (player.y > 750) {

        health--;

        updateAllHUD();

        if (health <= 0) {
            endLevel(false);
            return;
        }

        respawnAtCheckpoint();
    }

    /* Boundaries */

    player.x =
        clamp(
            player.x,
            0,
            levelWidth -
                player.width
        );

    /* Animation */

    player.animation +=
        Math.abs(player.vx) *
        0.18 +
        0.04;

    player.animationFrame =
        Math.floor(
            player.animation
        ) % 4;
}

/* =========================================================
   ENEMY UPDATE
========================================================= */

/* frames the "noticed you" cue stays on screen (art only) */
const NOTICE_FRAMES = 26;

function updateEnemies() {

    enemies.forEach(enemy => {

        if (!enemy.alive) {
            if (enemy.deathT > 0) enemy.deathT--;      // the death animation plays out
            return;
        }

        /* ---- presentation state (art only) ---- */
        enemy.animT = (enemy.animT || 0) + 1;
        if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - 0.08);
        if (enemy.windup > 0) enemy.windup = Math.max(0, enemy.windup - 0.07);

        const noticed = Math.abs(player.x - enemy.x) < 320;
        if (noticed && !enemy.alert) enemy.noticeT = NOTICE_FRAMES;   // "it saw you" tell
        enemy.alert = noticed;
        if (enemy.noticeT > 0) enemy.noticeT--;

        if (enemy.frozen > 0) {
            enemy.frozen--;
            return;
        }

        if (enemy.type === "boss") {
            updateBoss(enemy);
            return;
        }

        /* Flying enemies */

        if (enemy.flying) {

            enemy.phase += 0.04;

            enemy.y =
                330 +
                Math.sin(enemy.phase) *
                55;

            const distance =
                player.x -
                enemy.x;

            if (
                Math.abs(distance) <
                500
            ) {
                enemy.vx =
                    Math.sign(distance) *
                    enemy.speed;
            }

            enemy.x += enemy.vx;

        } else {

            /* Ground enemy */

            enemy.x += enemy.vx;

            if (
                Math.abs(
                    enemy.x -
                    player.x
                ) < 500
            ) {

                enemy.vx =
                    Math.sign(
                        player.x -
                        enemy.x
                    ) *
                    enemy.speed;
            }
        }

        /* Shooting enemies */

        if (
            enemy.shooter
        ) {

            enemy.shootTimer--;

            /* Attack tell: the pod swells and glows for ~26 frames first. */
            if (
                enemy.shootTimer > 0 &&
                enemy.shootTimer < 26 &&
                Math.abs(enemy.x - player.x) < 600
            ) {
                enemy.windup = Math.max(
                    enemy.windup,
                    1 - enemy.shootTimer / 26
                );
            }

            if (
                enemy.shootTimer <= 0 &&
                Math.abs(
                    enemy.x -
                    player.x
                ) < 600
            ) {

                projectiles.push({
                    x:
                        enemy.x +
                        enemy.width / 2,

                    y:
                        enemy.y + 20,

                    vx:
                        Math.sign(
                            player.x -
                            enemy.x
                        ) * 5,

                    vy: 0,

                    type: "enemy",

                    damage: 1,

                    life: 120
                });

                enemy.shootTimer =
                    120;
            }
        }

        /* Jumping enemies */

        if (
            enemy.type === "wolf" ||
            enemy.type === "iceWolf"
        ) {

            enemy.jumpTimer--;

            /* Attack tell: the crouch before the pounce. */
            if (enemy.jumpTimer > 0 && enemy.jumpTimer < 22) {
                enemy.windup = Math.max(
                    enemy.windup,
                    1 - enemy.jumpTimer / 22
                );
            }

            if (
                enemy.jumpTimer <= 0
            ) {

                enemy.jumpTimer =
                    120;

                enemy.vy = -9;
            }
        }

        if (
            enemy.vy !== undefined
        ) {

            enemy.vy += 0.5;
            enemy.y += enemy.vy;

            const floorY =
                enemy.groundY !== undefined
                    ? enemy.groundY
                    : 460;

            if (enemy.y > floorY) {
                enemy.y = floorY;
                enemy.vy = 0;
            }
        }

        /* Player collision */

        if (
            rectsOverlap(
                player,
                enemy
            )
        ) {

            damagePlayer();
        }
    });
}

/* =========================================================
   BOSS UPDATE
========================================================= */

function updateBoss(enemy) {

    enemy.phase += 0.03;

    const distance =
        player.x -
        enemy.x;

    if (
        Math.abs(distance) <
        800
    ) {

        enemy.vx =
            Math.sign(distance) *
            enemy.speed;
    }

    enemy.x += enemy.vx;

    /* Boss attack */

    enemy.attackTimer--;

    if (
        enemy.attackTimer <= 0
    ) {

        enemy.attackTimer =
            100 -
            currentWorld * 4;

        bossAttack(enemy);
    }

    /* Boss projectile */

    enemy.shootTimer--;

    if (
        enemy.shootTimer <= 0
    ) {

        enemy.shootTimer =
            150 -
            currentWorld * 5;

        projectiles.push({
            x:
                enemy.x +
                enemy.width / 2,

            y:
                enemy.y + 30,

            vx:
                Math.sign(
                    player.x -
                    enemy.x
                ) * 6,

            vy:
                -2,

            type: "boss",

            damage:
                1 +
                Math.floor(
                    currentWorld / 3
                ),

            life: 150
        });
    }

    if (
        rectsOverlap(
            player,
            enemy
        )
    ) {

        damagePlayer();
    }
}

/* =========================================================
   BOSS ATTACK
========================================================= */

function bossAttack(bossEnemy) {

    const type =
        bossEnemy.bossType;

    if (
        type === "magmaLord"
    ) {

        for (
            let i = 0;
            i < 5;
            i++
        ) {

            hazards.push({
                x:
                    player.x -
                    200 +
                    i * 100,

                y: 495,

                width: 60,

                height: 25,

                type: "lava",

                temporary: true,

                life: 100
            });
        }
    }

    else if (
        type === "frostTitan"
    ) {

        for (
            let i = 0;
            i < 5;
            i++
        ) {

            projectiles.push({
                x:
                    bossEnemy.x,

                y:
                    bossEnemy.y,

                vx:
                    (
                        Math.random() -
                        0.5
                    ) * 6,

                vy:
                    -(
                        5 +
                        Math.random() * 3
                    ),

                type: "ice",

                damage: 1,

                life: 120
            });
        }
    }

    else if (
        type === "stormDragon"
    ) {

        projectiles.push({
            x:
                player.x,

            y: 50,

            vx: 0,

            vy: 8,

            type: "lightning",

            damage: 1,

            life: 70
        });
    }

    else {

        /* Shockwave */

        projectiles.push({
            x:
                bossEnemy.x,

            y:
                490,

            vx:
                Math.sign(
                    player.x -
                    bossEnemy.x
                ) * 8,

            vy: 0,

            type: "shockwave",

            damage: 1,

            life: 100
        });
    }
}

/* =========================================================
   PROJECTILES
========================================================= */

function updateProjectiles() {

    projectiles.forEach(projectile => {

        projectile.x +=
            projectile.vx;

        projectile.y +=
            projectile.vy;

        if (
            projectile.type ===
            "ice"
        ) {
            projectile.vy += 0.15;
        }

        if (
            projectile.type ===
            "lightning"
        ) {
            projectile.vy += 0.2;
        }

        projectile.life--;

        /* Player projectile */

        if (
            projectile.type === "leaf" ||
            projectile.type === "fire"
        ) {

            enemies.forEach(enemy => {

                if (!enemy.alive) return;

                if (
                    pointInside(
                        projectile.x,
                        projectile.y,
                        enemy
                    )
                ) {

                    damageEnemy(
                        enemy,
                        projectile.damage
                    );

                    projectile.life = 0;
                }
            });
        }

        /* Enemy projectile */

        if (
            projectile.type === "enemy" ||
            projectile.type === "boss" ||
            projectile.type === "ice" ||
            projectile.type === "lightning" ||
            projectile.type === "shockwave"
        ) {

            if (
                pointInside(
                    projectile.x,
                    projectile.y,
                    player
                )
            ) {

                damagePlayer(
                    projectile.damage
                );

                projectile.life = 0;
            }
        }
    });

    projectiles =
        projectiles.filter(
            p => p.life > 0
        );
}

/* =========================================================
   HAZARDS
========================================================= */

function updateHazards() {

    hazards.forEach(hazard => {

        if (hazard.temporary) {
            hazard.life--;

            if (hazard.life <= 0) {
                hazard.dead = true;
            }
        }

        if (
            rectsOverlap(
                player,
                hazard
            )
        ) {

            damagePlayer();
        }
    });

    hazards =
        hazards.filter(
            hazard =>
                !hazard.dead
        );
}

/* =========================================================
   COINS
========================================================= */

function updateCoins() {

    coinsItems.forEach(coin => {

        if (coin.collected) return;

        coin.bob += 0.08;

        const magnet =
            save.selectedHero === "koko"
                ? 150
                : 55;

        const dx =
            player.x -
            coin.x;

        const dy =
            player.y -
            coin.y;

        const distance =
            Math.hypot(dx, dy);

        if (
            save.selectedHero === "koko" &&
            distance < magnet
        ) {

            coin.x += dx * 0.08;
            coin.y += dy * 0.08;
        }

        if (
            distance < 45
        ) {

            coin.collected = true;

            save.coins += 10;

            saveGame();

            createCoinParticles(
                coin.x,
                coin.y
            );

            const fx = Fx();
            if (fx) fx.number(coin.x, coin.y - 10, "+10 ◈", "#8fc1e3");

            Sfx("pickup");
            pulseHud("hud-coin");

            updateAllHUD();
        }
    });
}

/* =========================================================
   CHECKPOINTS
========================================================= */

function updateCheckpoints() {

    checkpoints.forEach(checkpoint => {

        if (
            !checkpoint.activated &&
            player.x >
                checkpoint.x
        ) {

            checkpoint.activated = true;

            player.checkpointX =
                checkpoint.x;

            player.checkpointY =
                platforms[0].y - player.height;

            createParticle(
                checkpoint.x,
                checkpoint.y - 110,
                "✓"
            );

            /* the beacon ignites: a gold ring + a warm flash of the world */
            const fx = Fx();

            if (fx) {
                fx.ring(checkpoint.x + 3, checkpoint.y - 8, 14, "#f2b84b");
                fx.flash("#f2b84b", 0.16, 12);
                fx.addShake(1.6);
                fx.number(checkpoint.x, checkpoint.y - 136, "CHECKPOINT", "#f2b84b");
            }

            Sfx("unlock");
        }
    });
}

function respawnAtCheckpoint() {

    player.x =
        player.checkpointX;

    player.y =
        player.checkpointY;

    player.vx = 0;
    player.vy = 0;

    player.climbing = false;
    player.climbLadder = null;
    player.grabCd = 0;

    player.invincible = 100;

    /* snap the camera back so it never drifts across the world */
    cameraX = clamp(
        player.x - window.innerWidth * 0.35,
        0,
        Math.max(0, levelWidth - window.innerWidth)
    );
}

/* =========================================================
   FINISH LINE — touch the banner (or press E near it) to finish.
   Boss levels stay sealed until the guardian falls.
========================================================= */

function finishLocked() {
    return currentLevel === 3 && boss && boss.alive;
}

function nearFinishLine() {
    if (!finishLine) return false;

    return (
        player.x + player.width > finishLine.x - 30 &&
        player.x < finishLine.x + finishLine.width + 30 &&
        player.y + player.height > finishLine.y + 40
    );
}

/* E near the banner completes the level (the interaction key). */
function tryInteract() {
    if (!gameRunning || paused || !finishLine || finishLocked()) return false;
    if (!nearFinishLine()) return false;

    endLevel(true);
    return true;
}

function updateFinishLine() {

    if (!finishLine) return;

    /* Boss must be defeated first */

    if (finishLocked()) return;

    /* Touching the banner completes the level. The pole-crossing test is a
       safety net so a high jump can never skip the goal line. */
    if (
        rectsOverlap(player, finishLine) ||
        player.x > finishLine.x + 16
    ) {

        endLevel(true);
        return;
    }

    /* proximity: the banner brightens as the player approaches */
    if (nearFinishLine() && Math.random() < 0.10) {
        createParticle(
            finishLine.x + 4 + Math.random() * 14,
            finishLine.y + 90 + Math.random() * 60,
            "dust"
        );
    }
}

/* =========================================================
   COLLISION HELPERS
========================================================= */

function rectsOverlap(a, b) {

    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function pointInside(x, y, box) {

    return (
        x >= box.x &&
        x <= box.x + box.width &&
        y >= box.y &&
        y <= box.y + box.height
    );
}

/* =========================================================
   CAMERA
========================================================= */

function updateCamera() {

    /* look-ahead: the camera leans toward where the player is going */
    const lookAhead = player.direction * 60;

    const target = clamp(
        player.x -
            window.innerWidth * 0.35 +
            lookAhead,
        0,
        Math.max(
            0,
            levelWidth -
            window.innerWidth
        )
    );

    const diff = target - cameraX;

    /* ease toward the target; snap after teleports/respawns so the view
       never drifts across the world */
    if (Math.abs(diff) > 420) {
        cameraX = target;
    } else {
        cameraX += diff * 0.12;
    }

    cameraX = clamp(cameraX, 0, Math.max(0, levelWidth - window.innerWidth));
}

/* =========================================================
   COOLDOWNS
========================================================= */

function updateCooldowns() {

    if (player.dashCooldown > 0) {
        player.dashCooldown--;
    }

    if (player.attackCooldown > 0) {
        player.attackCooldown--;
    }

    if (player.specialCooldown > 0) {
        player.specialCooldown--;
    }

    if (player.invincible > 0) {
        player.invincible--;
    }

    if (player.hurtTimer > 0) {
        player.hurtTimer--;
    }

    if (player.attackTimer > 0) {
        player.attackTimer--;
    }

    if (player.dashTimer > 0) {
        player.dashTimer--;
    }

    if (player.abilityTimer > 0) {
        player.abilityTimer--;
    }

    if (
        player.shield &&
        player.invincible <= 0
    ) {
        player.shield = false;
    }
}

/* =========================================================
   PARTICLES
========================================================= */

function createParticle(x, y, type) {
    if (particles.length > 450) return;   // cap: big fights cannot tank the frame rate


    particles.push({
        x,
        y,

        vx:
            (Math.random() - 0.5) *
            3,

        vy:
            -(
                1 +
                Math.random() * 3
            ),

        life: 40,

        type,

        size:
            5 +
            Math.random() * 6
    });
}

function createExplosion(x, y) {

    for (
        let i = 0;
        i < 18;
        i++
    ) {
        createParticle(
            x,
            y,
            "spark"
        );
    }
}

function createHitParticles(x, y) {

    for (
        let i = 0;
        i < 8;
        i++
    ) {
        createParticle(
            x,
            y,
            "hit"
        );
    }
}

function createCoinParticles(x, y) {

    for (
        let i = 0;
        i < 6;
        i++
    ) {
        createParticle(
            x,
            y,
            "coin"
        );
    }
}

function createDust(x, y) {

    for (
        let i = 0;
        i < 5;
        i++
    ) {
        createParticle(
            x,
            y,
            "dust"
        );
    }
}

function createAttackParticles() {

    for (
        let i = 0;
        i < 6;
        i++
    ) {

        createParticle(
            player.x +
                player.direction *
                45,

            player.y + 30,

            "attack"
        );
    }
}

function createShieldParticles() {

    for (
        let i = 0;
        i < 14;
        i++
    ) {

        createParticle(
            player.x + 20,
            player.y + 30,
            "shield"
        );
    }
}

function createMoonEffect() {

    for (
        let i = 0;
        i < 12;
        i++
    ) {

        createParticle(
            player.x + 20,
            player.y + 30,
            "moon"
        );
    }
}

function createGroundShockwave() {

    for (
        let i = 0;
        i < 15;
        i++
    ) {

        createParticle(
            player.x +
                player.direction *
                Math.random() *
                180,

            player.y +
                player.height,

            "rock"
        );
    }
}

function createFireExplosion() {

    for (
        let i = 0;
        i < 20;
        i++
    ) {

        createParticle(
            player.x + 20,
            player.y + 30,
            "fire"
        );
    }
}

function createFreezeEffect() {

    for (
        let i = 0;
        i < 18;
        i++
    ) {

        createParticle(
            player.x + 20,
            player.y + 30,
            "ice"
        );
    }
}

function createMagnetEffect() {

    for (
        let i = 0;
        i < 15;
        i++
    ) {

        createParticle(
            player.x + 20,
            player.y + 30,
            "magnet"
        );
    }
}

function createWaterTrail() {

    for (
        let i = 0;
        i < 20;
        i++
    ) {

        createParticle(
            player.x,
            player.y + 30,
            "water"
        );
    }
}

function createHealEffect() {

    for (
        let i = 0;
        i < 15;
        i++
    ) {

        createParticle(
            player.x + 20,
            player.y + 20,
            "heart"
        );
    }
}

function createMegaSmash() {

    for (
        let i = 0;
        i < 30;
        i++
    ) {

        createParticle(
            player.x + 20,
            player.y + 50,
            "mega"
        );
    }
}

function updateParticles() {

    particles.forEach(p => {

        p.x += p.vx;
        p.y += p.vy;

        p.vy += 0.08;

        p.life--;
    });

    particles =
        particles.filter(
            p => p.life > 0
        );
}

/* =========================================================
   DRAW GAME
========================================================= */

function drawGame() {

    if (!ctx || !canvas) return;

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    drawSky();

    drawParallaxBackground();

    ctx.save();

    /* camera shake moves the world, never the HUD or the menus;
       the camera position is rounded so the world never blurs */
    const fx = Fx();

    ctx.translate(
        -Math.round(cameraX) + (fx ? Math.round(fx.sx) : 0),
        fx ? Math.round(fx.sy) : 0
    );

    drawHazards();
    drawPlatforms();
    drawProps();
    drawLadders();
    drawCheckpoints();
    drawCoins();
    drawEnemies();
    drawProjectiles();
    drawFinishLine();

    drawPlayer();

    drawParticles();

    /* floating damage numbers and shockwave rings live in world space */
    if (fx) fx.drawWorld(ctx);

    ctx.restore();

    /* atmosphere: fog, particles, dynamic lighting (js/scenery.js) */
    if (window.Scenery) Scenery.draw(ctx, { cameraX, world: currentWorld, player });

    /* screen-space feedback: damage vignette and (optional) flashes */
    if (fx) fx.drawScreen(ctx, width, height);

    drawBossBar();
}

/* =========================================================
   SKY
========================================================= */

/* Gradients are cached: rebuilding one every frame is pure waste. */
const skyGradientCache = { key: "", gradient: null };

function drawSky() {

    const world =
        worlds[currentWorld];

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    const key =
        currentWorld +
        ":" +
        width +
        "x" +
        height;

    if (
        skyGradientCache.key !== key ||
        !skyGradientCache.gradient
    ) {
        const gradient =
            ctx.createLinearGradient(
                0,
                0,
                0,
                height
            );

        gradient.addColorStop(
            0,
            world.sky1
        );

        gradient.addColorStop(
            1,
            world.sky2
        );

        skyGradientCache.key = key;
        skyGradientCache.gradient = gradient;
    }

    ctx.fillStyle =
        skyGradientCache.gradient;

    ctx.fillRect(
        0,
        0,
        width,
        height
    );
}

/* =========================================================
   PARALLAX BACKGROUND
========================================================= */

function drawParallaxBackground() {

    const world =
        worlds[currentWorld];

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    const far =
        cameraX * 0.18;

    const near =
        cameraX * 0.35;

    /* Mountains */

    ctx.fillStyle =
        "rgba(40,60,70,.22)";

    ctx.beginPath();

    for (
        let x =
            -600 -
            far % 600;

        x <
        width + 600;

        x += 600
    ) {

        ctx.moveTo(
            x,
            height - 150
        );

        ctx.lineTo(
            x + 300,
            height - 390
        );

        ctx.lineTo(
            x + 600,
            height - 150
        );
    }

    ctx.fill();

    /* World-specific scenery */

    if (currentWorld === 0) {
        drawMeadowBackground(
            near
        );
    }

    else if (currentWorld === 1) {
        drawForestBackground(
            near
        );
    }

    else if (currentWorld === 2) {
        drawCaveBackground(
            near
        );
    }

    else if (currentWorld === 3) {
        drawCloudBackground(
            near
        );
    }

    else if (currentWorld === 4) {
        drawVolcanoBackground(
            near
        );
    }

    else if (currentWorld === 5) {
        drawIceBackground(
            near
        );
    }

    else {
        drawCastleBackground(
            near
        );
    }
}

/* =========================================================
   MEADOW
========================================================= */

function drawMeadowBackground(offset) {

    const height =
        window.innerHeight;

    for (
        let x =
            -400 -
            offset % 400;

        x <
        window.innerWidth + 400;

        x += 400
    ) {

        drawTree(
            x,
            height - 180,
            1
        );

        drawTree(
            x + 160,
            height - 150,
            0.7
        );

        drawMushroom(
            x + 280,
            height - 105,
            1
        );
    }
}

/* =========================================================
   FOREST
========================================================= */

function drawForestBackground(offset) {

    const height =
        window.innerHeight;

    for (
        let x =
            -350 -
            offset % 350;

        x <
        window.innerWidth + 350;

        x += 350
    ) {

        drawPineTree(
            x,
            height - 100,
            1.3
        );

        drawPineTree(
            x + 120,
            height - 100,
            0.9
        );

        drawPineTree(
            x + 250,
            height - 100,
            1.1
        );
    }
}

/* =========================================================
   CAVES
========================================================= */

function drawCaveBackground(offset) {

    const height =
        window.innerHeight;

    ctx.fillStyle =
        "rgba(20,18,45,.35)";

    ctx.fillRect(
        0,
        0,
        window.innerWidth,
        height
    );

    for (
        let x =
            -300 -
            offset % 300;

        x <
        window.innerWidth + 300;

        x += 300
    ) {

        drawCrystal(
            x + 100,
            height - 130,
            1.5
        );

        drawCrystal(
            x + 200,
            height - 170,
            1
        );
    }
}

/* =========================================================
   CLOUD KINGDOM
========================================================= */

function drawCloudBackground(offset) {

    for (
        let x =
            -500 -
            offset % 500;

        x <
        window.innerWidth + 500;

        x += 500
    ) {

        drawCloud(
            x + 100,
            150,
            1.3
        );

        drawCloud(
            x + 350,
            280,
            0.8
        );
    }
}

/* =========================================================
   VOLCANO
========================================================= */

function drawVolcanoBackground(offset) {

    const height =
        window.innerHeight;

    ctx.fillStyle =
        "rgba(255,100,30,.12)";

    ctx.fillRect(
        0,
        0,
        window.innerWidth,
        height
    );

    for (
        let x =
            -600 -
            offset % 600;

        x <
        window.innerWidth + 600;

        x += 600
    ) {

        drawVolcano(
            x + 300,
            height - 100,
            1
        );
    }
}

/* =========================================================
   ICE
========================================================= */

function drawIceBackground(offset) {

    const height =
        window.innerHeight;

    for (
        let x =
            -500 -
            offset % 500;

        x <
        window.innerWidth + 500;

        x += 500
    ) {

        drawIceMountain(
            x + 250,
            height - 100
        );
    }
}

/* =========================================================
   CASTLE
========================================================= */

function drawCastleBackground(offset) {

    const height =
        window.innerHeight;

    for (
        let x =
            -600 -
            offset % 600;

        x <
        window.innerWidth + 600;

        x += 600
    ) {

        drawCastle(
            x + 300,
            height - 110,
            0.8
        );
    }
}

/* =========================================================
   SIMPLE ENVIRONMENT DRAWING
========================================================= */

function drawTree(x, y, scale) {

    ctx.save();

    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle =
        "#6a432a";

    ctx.fillRect(
        -15,
        -100,
        30,
        100
    );

    ctx.fillStyle =
        "#326d39";

    ctx.beginPath();

    ctx.arc(
        0,
        -120,
        60,
        0,
        Math.PI * 2
    );

    ctx.arc(
        -45,
        -90,
        40,
        0,
        Math.PI * 2
    );

    ctx.arc(
        45,
        -90,
        40,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}

function drawPineTree(x, y, scale) {

    ctx.save();

    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle =
        "#4d3827";

    ctx.fillRect(
        -10,
        -100,
        20,
        100
    );

    ctx.fillStyle =
        "#234b38";

    for (
        let i = 0;
        i < 3;
        i++
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            -190 + i * 40
        );

        ctx.lineTo(
            -55,
            -80 + i * 40
        );

        ctx.lineTo(
            55,
            -80 + i * 40
        );

        ctx.closePath();

        ctx.fill();
    }

    ctx.restore();
}

function drawMushroom(x, y, scale) {

    ctx.save();

    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle =
        "#f4dfc4";

    ctx.fillRect(
        -12,
        -45,
        24,
        45
    );

    ctx.fillStyle =
        "#d95763";

    ctx.beginPath();

    ctx.arc(
        0,
        -45,
        35,
        Math.PI,
        0
    );

    ctx.fill();

    ctx.restore();
}

function drawCrystal(x, y, scale) {

    ctx.save();

    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle =
        "#70d9e9";

    ctx.beginPath();

    ctx.moveTo(0, -80);
    ctx.lineTo(30, -25);
    ctx.lineTo(15, 0);
    ctx.lineTo(-15, 0);
    ctx.lineTo(-30, -25);

    ctx.closePath();

    ctx.fill();

    ctx.restore();
}

function drawCloud(x, y, scale) {

    ctx.save();

    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle =
        "rgba(255,255,255,.75)";

    ctx.beginPath();

    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.arc(40, -10, 45, 0, Math.PI * 2);
    ctx.arc(85, 0, 35, 0, Math.PI * 2);

    ctx.fill();

    ctx.restore();
}

function drawVolcano(x, y, scale) {

    ctx.save();

    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle =
        "#382525";

    ctx.beginPath();

    ctx.moveTo(-180, 0);
    ctx.lineTo(-70, -210);
    ctx.lineTo(0, -245);
    ctx.lineTo(70, -210);
    ctx.lineTo(180, 0);

    ctx.closePath();

    ctx.fill();

    ctx.fillStyle =
        "#ed6334";

    ctx.beginPath();

    ctx.moveTo(-25, -210);
    ctx.lineTo(0, -250);
    ctx.lineTo(25, -210);

    ctx.lineTo(15, -170);
    ctx.lineTo(-15, -170);

    ctx.closePath();

    ctx.fill();

    ctx.restore();
}

function drawIceMountain(x, y) {

    ctx.fillStyle =
        "rgba(255,255,255,.8)";

    ctx.beginPath();

    ctx.moveTo(
        x - 200,
        y
    );

    ctx.lineTo(
        x,
        y - 260
    );

    ctx.lineTo(
        x + 200,
        y
    );

    ctx.closePath();

    ctx.fill();

    ctx.fillStyle =
        "rgba(90,130,160,.35)";

    ctx.beginPath();

    ctx.moveTo(
        x,
        y - 260
    );

    ctx.lineTo(
        x + 200,
        y
    );

    ctx.lineTo(
        x + 80,
        y
    );

    ctx.closePath();

    ctx.fill();
}

function drawCastle(x, y, scale) {

    ctx.save();

    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle =
        "#56445e";

    ctx.fillRect(
        -160,
        -180,
        320,
        180
    );

    ctx.fillStyle =
        "#40344b";

    ctx.fillRect(
        -210,
        -240,
        65,
        240
    );

    ctx.fillRect(
        145,
        -240,
        65,
        240
    );

    ctx.fillStyle =
        "#c65c70";

    ctx.beginPath();

    ctx.moveTo(
        -225,
        -240
    );

    ctx.lineTo(
        -177,
        -300
    );

    ctx.lineTo(
        -130,
        -240
    );

    ctx.fill();

    ctx.beginPath();

    ctx.moveTo(
        130,
        -240
    );

    ctx.lineTo(
        177,
        -300
    );

    ctx.lineTo(
        225,
        -240
    );

    ctx.fill();

    ctx.restore();
}

/* =========================================================
   PLATFORMS
========================================================= */

function drawPlatforms() {

    const world =
        worlds[currentWorld];

    /* skip platforms that are completely outside the viewport */
    const viewLeft = cameraX - 40;
    const viewRight =
        cameraX +
        window.innerWidth +
        40;

    platforms.forEach(platform => {

        if (
            platform.x +
                platform.width <
                viewLeft ||
            platform.x > viewRight
        ) {
            return;
        }

        ctx.fillStyle =
            world.dirt;

        ctx.fillRect(
            platform.x,
            platform.y,
            platform.width,
            platform.height
        );

        ctx.fillStyle =
            world.ground;

        ctx.fillRect(
            platform.x,
            platform.y,
            platform.width,
            10
        );

        /* grass details */

        ctx.fillStyle =
            "rgba(255,255,255,.08)";

        for (
            let x =
                platform.x + 15;

            x <
            platform.x +
            platform.width;

            x += 35
        ) {

            ctx.fillRect(
                x,
                platform.y + 12,
                3,
                8
            );
        }
    });
}

/* =========================================================
   LADDERS
========================================================= */

function drawLadders() {

    ladders.forEach(ladder => {

        ctx.strokeStyle =
            "#8a5b32";

        ctx.lineWidth = 6;

        ctx.beginPath();

        ctx.moveTo(
            ladder.x,
            ladder.y
        );

        ctx.lineTo(
            ladder.x,
            ladder.y +
            ladder.height
        );

        ctx.moveTo(
            ladder.x + 20,
            ladder.y
        );

        ctx.lineTo(
            ladder.x + 20,
            ladder.y +
            ladder.height
        );

        ctx.stroke();

        ctx.lineWidth = 4;

        for (
            let y =
                ladder.y;

            y <
            ladder.y +
            ladder.height;

            y += 22
        ) {

            ctx.beginPath();

            ctx.moveTo(
                ladder.x,
                y
            );

            ctx.lineTo(
                ladder.x + 20,
                y
            );

            ctx.stroke();
        }
    });
}

/* =========================================================
   HAZARDS DRAWING
========================================================= */

function drawHazards() {

    hazards.forEach(hazard => {

        if (hazard.type === "lava") {

            ctx.fillStyle =
                "#ef4c28";

            ctx.fillRect(
                hazard.x,
                hazard.y,
                hazard.width,
                hazard.height
            );

            ctx.fillStyle =
                "#ffb52f";

            for (
                let x =
                    hazard.x;

                x <
                hazard.x +
                hazard.width;

                x += 20
            ) {

                ctx.beginPath();

                ctx.arc(
                    x + 10,
                    hazard.y,
                    8,
                    Math.PI,
                    0
                );

                ctx.fill();
            }
        }

        else if (
            hazard.type === "ice"
        ) {

            ctx.fillStyle =
                "#9ee9f4";

            ctx.fillRect(
                hazard.x,
                hazard.y,
                hazard.width,
                hazard.height
            );
        }

        else {

            ctx.fillStyle =
                "#5b8b43";

            ctx.beginPath();

            ctx.moveTo(
                hazard.x,
                hazard.y +
                hazard.height
            );

            for (
                let x =
                    hazard.x;

                x <
                hazard.x +
                hazard.width;

                x += 18
            ) {

                ctx.lineTo(
                    x + 9,
                    hazard.y
                );

                ctx.lineTo(
                    x + 18,
                    hazard.y +
                    hazard.height
                );
            }

            ctx.fill();
        }
    });
}

/* =========================================================
   CHECKPOINT DRAWING
========================================================= */

function drawCheckpoints() {

    checkpoints.forEach(checkpoint => {

        if (checkpoint.x < cameraX - 90 || checkpoint.x > cameraX + window.innerWidth + 90) return;

        const groundY = checkpoint.y;        /* planted on the surface */
        const poleTop = groundY - 118;

        /* stone footing: the pole rests on the ground */
        ctx.fillStyle = "#3a3241";
        ctx.beginPath();
        ctx.ellipse(checkpoint.x + 3.5, groundY - 3, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        /* pole */
        ctx.fillStyle =
            "#5b3824";

        ctx.fillRect(
            checkpoint.x,
            poleTop,
            7,
            groundY - poleTop
        );

        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.fillRect(checkpoint.x + 1, poleTop, 2, groundY - poleTop);

        /* pennant */
        ctx.fillStyle =
            checkpoint.activated
                ? "#6ee86c"
                : "#d9b85a";

        ctx.beginPath();

        ctx.moveTo(
            checkpoint.x + 7,
            poleTop + 4
        );

        ctx.lineTo(
            checkpoint.x + 55,
            poleTop + 18
        );

        ctx.lineTo(
            checkpoint.x + 7,
            poleTop + 32
        );

        ctx.closePath();

        ctx.fill();

        /* shape cue: a check-mark once lit, a dot while dark — the state
           never relies on colour alone */
        ctx.strokeStyle = checkpoint.activated ? "#0d2c14" : "rgba(80,58,20,.85)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        if (checkpoint.activated) {
            ctx.moveTo(checkpoint.x + 16, poleTop + 18);
            ctx.lineTo(checkpoint.x + 22, poleTop + 23);
            ctx.lineTo(checkpoint.x + 33, poleTop + 11);
        } else {
            ctx.arc(checkpoint.x + 22, poleTop + 18, 3.2, 0, Math.PI * 2);
        }

        ctx.stroke();
    });
}

/* =========================================================
   COIN DRAWING
========================================================= */

function drawCoins() {

    coinsItems.forEach(coin => {
        if (coin.x + 30 < cameraX || coin.x - 30 > cameraX + window.innerWidth) return;


        if (coin.collected) return;

        const y =
            coin.y +
            Math.sin(coin.bob) * 5;

        ctx.save();

        ctx.translate(
            coin.x,
            y
        );

        ctx.fillStyle =
            "#f3c63e";

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            11,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.strokeStyle =
            "#fff0a5";

        ctx.lineWidth = 2;

        ctx.stroke();

        ctx.fillStyle =
            "#9b701e";

        ctx.font =
            "bold 13px Arial";

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";

        ctx.fillText(
            "$",
            0,
            1
        );

        ctx.restore();
    });
}

/* =========================================================
   ENEMY DRAWING
========================================================= */

/* =========================================================
   ENEMY DRAWING - CUTE CARTOON STYLE
========================================================= */

function drawEnemies() {

    enemies.forEach(enemy => {
        if (enemy.x + 400 < cameraX || enemy.x - 400 > cameraX + window.innerWidth) return;

        if (!enemy.alive) {

            /* let the death animation finish before the mob disappears */
            if (enemy.deathT > 0) drawEnemy(enemy);

            return;
        }

        if (enemy.type === "boss") {
            drawBoss(enemy);
        } else {
            drawEnemy(enemy);
        }

    });
}


/* =========================================================
   NORMAL ENEMY DRAWING
========================================================= */

/* =========================================================
   NORMAL ENEMY DRAWING
   One call into the Art Kit (js/art.js): role silhouette, idle breath,
   walk cycle, attack tell, hit flash and death animation all come from
   there, so the Levels mode and the Descent draw the same creatures.
   ========================================================= */

function drawEnemy(enemy) {

    if (!window.Art || !Art.drawMob) return;

    const dying = !enemy.alive;

    const fade = dying
        ? Math.max(0, (enemy.deathT || 0) / 34)
        : 1;

    const t = enemy.animT || 0;

    Art.drawMob(ctx, enemy.type, {

        x: enemy.x,
        feet: enemy.y + enemy.height,          // hitbox and art share the feet line
        w: enemy.width,
        h: enemy.height,

        face: enemy.vx >= 0 ? 1 : -1,

        t: t,
        walk: t * (enemy.flying ? 0.17 : 0.12),
        seed: enemy.phase || 0,

        ground: !enemy.flying,                 // no contact shadow for flyers
        alert: !!enemy.alert,                  // warm eye once it has noticed you
        notice: (enemy.noticeT || 0) / NOTICE_FRAMES,   // short "!" pop on first contact
        windup: enemy.windup || 0,             // shape-coded attack tell
        flash: enemy.hitFlash > 0 ? Math.min(0.85, enemy.hitFlash) : 0,

        alpha: fade,
        squash: dying ? (1 - fade) * 0.32 : 0
    });

    /* =========================
       HEALTH BAR
       Only after the first hit, so untouched mobs stay clean.
    ========================= */

    if (!dying && enemy.maxHealth > 1 && enemy.health < enemy.maxHealth) {

        const barWidth = Math.max(30, enemy.width);
        const bx = enemy.x + (enemy.width - barWidth) / 2;
        const by = enemy.y - 13;

        ctx.save();

        ctx.fillStyle = "rgba(11,14,22,.85)";
        ctx.fillRect(bx - 1, by - 1, barWidth + 2, 7);

        ctx.fillStyle = "#e65b59";
        ctx.fillRect(
            bx,
            by,
            barWidth * clamp(enemy.health / enemy.maxHealth, 0, 1),
            5
        );

        ctx.strokeStyle = "rgba(232,237,243,.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 1.5, by - 1.5, barWidth + 3, 8);

        ctx.restore();
    }

    /* =========================
       FROZEN EFFECT (shape-coded: an ice cage)
    ========================= */

    if (enemy.frozen > 0) {

        ctx.save();

        ctx.strokeStyle = "rgba(158,238,255,.9)";
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.roundRect(
            enemy.x - 4,
            enemy.y - 4,
            enemy.width + 8,
            enemy.height + 8,
            6
        );
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(enemy.x - 6, enemy.y + 8, 4, 4);
        ctx.fillRect(enemy.x + enemy.width + 2, enemy.y + enemy.height - 12, 4, 4);

        ctx.restore();
    }
}


/* =========================================================
   BOSS DRAWING
========================================================= */

function drawBoss(enemy) {

    ctx.save();

    const x = enemy.x;
    const y = enemy.y;

    ctx.translate(
        x,
        y
    );


    /* =========================
       SHADOW
    ========================= */

    ctx.fillStyle = "rgba(0,0,0,.35)";

    ctx.beginPath();

    ctx.ellipse(
        enemy.width / 2,
        enemy.height + 8,
        enemy.width * 0.55,
        10,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /* =========================
       LEGS
    ========================= */

    ctx.fillStyle = enemy.secondary;

    ctx.fillRect(
        enemy.width * 0.20,
        enemy.height - 20,
        22,
        25
    );

    ctx.fillRect(
        enemy.width * 0.65,
        enemy.height - 20,
        22,
        25
    );


    /* =========================
       BODY
    ========================= */

    ctx.fillStyle = enemy.color;

    ctx.beginPath();

    ctx.roundRect(
        12,
        35,
        enemy.width - 24,
        enemy.height - 45,
        18
    );

    ctx.fill();


    /* =========================
       BIG MUSHROOM HEAD
    ========================= */

    ctx.fillStyle = enemy.color;

    ctx.beginPath();

    ctx.arc(
        enemy.width / 2,
        35,
        enemy.width * 0.52,
        Math.PI,
        0
    );

    ctx.fill();


    /* =========================
       HEAD SPOTS
    ========================= */

    ctx.fillStyle = "rgba(255,255,255,.22)";

    ctx.beginPath();

    ctx.arc(
        enemy.width * 0.28,
        25,
        8,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        enemy.width * 0.72,
        22,
        6,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /* =========================
       DARK UNDERSIDE
    ========================= */

    ctx.fillStyle = enemy.secondary;

    ctx.fillRect(
        18,
        35,
        enemy.width - 36,
        12
    );


    /* =========================
       BIG EYES
    ========================= */

    ctx.fillStyle = "#f7f0d7";

    ctx.beginPath();

    ctx.ellipse(
        enemy.width * 0.35,
        56,
        8,
        11,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.ellipse(
        enemy.width * 0.65,
        56,
        8,
        11,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /* Pupils */

    ctx.fillStyle = "#21151a";

    ctx.beginPath();

    ctx.arc(
        enemy.width * 0.36,
        57,
        4,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        enemy.width * 0.66,
        57,
        4,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /* =========================
       BOSS MOUTH
    ========================= */

    ctx.strokeStyle = "#21151a";
    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.arc(
        enemy.width / 2,
        75,
        9,
        0,
        Math.PI
    );

    ctx.stroke();


    /* =========================
       BOSS ARMS
    ========================= */

    ctx.strokeStyle = enemy.secondary;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";

    ctx.beginPath();

    ctx.moveTo(
        15,
        enemy.height * 0.65
    );

    ctx.lineTo(
        -10,
        enemy.height * 0.80
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
        enemy.width - 15,
        enemy.height * 0.65
    );

    ctx.lineTo(
        enemy.width + 10,
        enemy.height * 0.80
    );

    ctx.stroke();


    /* =========================
       CROWN
    ========================= */

    if (
        enemy.bossType === "mushroomKing"
    ) {

        ctx.fillStyle = "#e9b938";

        ctx.beginPath();

        ctx.moveTo(
            enemy.width / 2 - 35,
            -5
        );

        ctx.lineTo(
            enemy.width / 2 - 20,
            -35
        );

        ctx.lineTo(
            enemy.width / 2 - 5,
            -10
        );

        ctx.lineTo(
            enemy.width / 2 + 10,
            -40
        );

        ctx.lineTo(
            enemy.width / 2 + 22,
            -8
        );

        ctx.lineTo(
            enemy.width / 2 + 40,
            -30
        );

        ctx.lineTo(
            enemy.width / 2 + 34,
            5
        );

        ctx.closePath();

        ctx.fill();


        /* Crown jewels */

        ctx.fillStyle = "#fff2a6";

        ctx.beginPath();

        ctx.arc(
            enemy.width / 2 - 18,
            -15,
            4,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.beginPath();

        ctx.arc(
            enemy.width / 2 + 10,
            -20,
            4,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    /* =========================
       BOSS HEALTH BAR
    ========================= */

    ctx.fillStyle = "#241b20";

    ctx.fillRect(
        0,
        -55,
        enemy.width,
        9
    );

    ctx.fillStyle = "#e74d55";

    ctx.fillRect(
        0,
        -55,
        enemy.width *
        Math.max(
            0,
            Math.min(
                1,
                enemy.health / enemy.maxHealth
            )
        ),
        9
    );


    /* =========================
       BOSS FROZEN EFFECT
    ========================= */

    if (enemy.frozen > 0) {

        ctx.strokeStyle = "#9eeeff";
        ctx.lineWidth = 4;

        ctx.strokeRect(
            -8,
            -8,
            enemy.width + 16,
            enemy.height + 16
        );
    }


    ctx.restore();
}



/* =========================================================
   PROJECTILE DRAWING
========================================================= */

function drawProjectiles() {

    projectiles.forEach(p => {

        ctx.save();

        ctx.translate(
            p.x,
            p.y
        );

        if (
            p.type === "leaf"
        ) {

            ctx.fillStyle =
                "#63c95d";

            ctx.rotate(
                p.vx * 0.08
            );

            ctx.beginPath();

            ctx.ellipse(
                0,
                0,
                15,
                7,
                0,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        else if (
            p.type === "fire"
        ) {

            ctx.fillStyle =
                "#ff6b28";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                9,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.fillStyle =
                "#ffd34d";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                4,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        else if (
            p.type === "ice"
        ) {

            ctx.fillStyle =
                "#a8efff";

            ctx.beginPath();

            for (
                let i = 0;
                i < 6;
                i++
            ) {

                const angle =
                    i *
                    Math.PI /
                    3;

                const r =
                    i % 2 === 0
                        ? 12
                        : 5;

                const px =
                    Math.cos(angle) *
                    r;

                const py =
                    Math.sin(angle) *
                    r;

                if (i === 0)
                    ctx.moveTo(px, py);
                else
                    ctx.lineTo(px, py);
            }

            ctx.closePath();

            ctx.fill();
        }

        else if (
            p.type === "lightning"
        ) {

            ctx.fillStyle =
                "#f5ed7c";

            ctx.fillRect(
                -4,
                -18,
                8,
                36
            );
        }

        else {

            ctx.fillStyle =
                "#c85e71";

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                9,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        ctx.restore();
    });
}

/* =========================================================
   FINISH LINE DRAWING — the goal banner.
   A stone footing plants the pole on the ground, the pennant waves
   slowly, and unlocked banners glow with drifting motes so the goal
   is unmistakable without covering the play area.
========================================================= */

function drawFinishLine() {

    if (!finishLine) return;

    const locked = finishLocked();

    const t = window.Art ? Art.FX.t : performance.now() / 16;

    const x = finishLine.x;
    const groundY = finishLine.y + finishLine.height;
    const poleTop = groundY - 152;

    /* stone footing: the pole visibly rests on the surface */
    ctx.fillStyle = "#37343f";
    ctx.beginPath();
    ctx.ellipse(x + 7.5, groundY - 3, 23, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#48444f";
    ctx.beginPath();
    ctx.ellipse(x + 7.5, groundY - 7, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* warm pool of light on the ground (locked banners stay cold) */
    if (!locked) {
        const pulse = 0.42 + Math.sin(t / 42) * 0.08;
        const pool = ctx.createRadialGradient(x + 7.5, groundY - 2, 2, x + 7.5, groundY - 2, 72);
        pool.addColorStop(0, "rgba(242,184,75," + pulse.toFixed(3) + ")");
        pool.addColorStop(1, "rgba(242,184,75,0)");
        ctx.fillStyle = pool;
        ctx.fillRect(x - 72, groundY - 30, 160, 34);
    }

    /* pole */
    ctx.fillStyle = "#543522";
    ctx.fillRect(x + 4, poleTop, 7, groundY - poleTop);

    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fillRect(x + 5, poleTop, 2, groundY - poleTop);

    /* finial */
    ctx.fillStyle = locked ? "#5d5d67" : "#f2b84b";
    ctx.beginPath();
    ctx.arc(x + 7.5, poleTop - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    if (!locked) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(t / 30) * 0.15;
        ctx.fillStyle = "#ffe9b8";
        ctx.beginPath();
        ctx.arc(x + 7.5, poleTop - 5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /* pennant: a slow wave, different phase along its length */
    const wave = Math.sin(t / 22 + (finishLine.phase || 0));
    const wave2 = Math.sin(t / 17 + (finishLine.phase || 0) + 1.3);

    ctx.fillStyle = locked ? "#6d6d78" : "#e55362";
    ctx.beginPath();
    ctx.moveTo(x + 11, poleTop + 6);
    ctx.quadraticCurveTo(x + 42, poleTop + 12 + wave * 3.2, x + 76, poleTop + 20 + wave2 * 4.2);
    ctx.quadraticCurveTo(x + 52, poleTop + 31 + wave * 3, x + 11, poleTop + 42);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = locked ? "rgba(255,255,255,.16)" : "rgba(255,214,170,.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    /* pale soul-mark on the cloth (not colour alone: shape + glyph) */
    ctx.fillStyle = locked ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.82)";
    ctx.beginPath();
    ctx.arc(x + 30, poleTop + 22, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 30, poleTop + 22, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = locked ? "rgba(120,120,130,.4)" : "#b33345";
    ctx.fill();

    /* soft halo + rising motes so the banner reads as the goal */
    if (!locked) {
        const halo = ctx.createRadialGradient(x + 32, poleTop + 22, 3, x + 32, poleTop + 22, 62);
        halo.addColorStop(0, "rgba(246,231,174,.20)");
        halo.addColorStop(1, "rgba(246,231,174,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(x - 38, poleTop - 44, 142, 124);

        ctx.fillStyle = "rgba(246,231,174,.65)";

        for (let i = 0; i < 5; i++) {
            const ph = (t * 0.55 + i * 71 + (finishLine.phase || 0) * 30) % 150;
            const mx = x + 2 + Math.sin(t / 30 + i * 1.7) * 9 + i * 4;
            const my = groundY - 8 - ph * 0.92;
            const ma = Math.max(0, 1 - ph / 150) * 0.75;

            ctx.globalAlpha = ma;
            ctx.beginPath();
            ctx.arc(mx, my, 1.7 + (i % 2) * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }
}

/* =========================================================
   PLAYER DRAWING
========================================================= */

/* =========================================================
   PLAYER DRAWING  (Milo, the Lantern Vessel)
   The same renderer the Descent uses (Art.drawVessel), so Milo looks like
   one character in every mode: wide moth cap + antennae, teardrop cloak
   with a split hem, and a lantern held forward - the three cues that keep
   the silhouette readable as a solid black shape and that show facing
   even at dash speed.
   ========================================================= */

/* Everything the renderer needs, derived from the live player object. */
function vesselState(hero, over) {

    const grounded = player.grounded && !player.climbing;
    const walking = grounded && Math.abs(player.vx) > 0.5;

    const base = {

        hero: hero,

        x: player.x,
        y: player.y,
        w: player.width,
        h: player.height,

        face: player.direction,

        /* one shared clock for breath, blink and lantern flicker */
        t: window.Art ? Art.FX.t : 0,

        walk: walking ? player.animation * 2.2 : 0,
        vx: player.vx,
        vy: player.vy,

        air: !grounded && !player.climbing,
        climb: player.climbing ? 1 : 0,

        dash: player.dashTimer > 0 ? 1 : 0,
        attack: player.attackTimer > 0 ? player.attackTimer / 12 : 0,
        hurt: player.hurtTimer > 0 ? Math.min(1, player.hurtTimer / 14) : 0,

        heal: hero.id === "mimi" && player.abilityTimer > 0 ? 0.7 : 0,

        /* every Vessel blinks on its own rhythm */
        blink: window.Art ? ((Art.FX.t + hero.id.charCodeAt(0) * 3) % 235) < 5 : false,

        squash: player.squash || 0,
        groundY: player.shadowY || (player.y + player.height)
    };

    return Object.assign(base, over || {});
}

function drawPlayer() {

    if (!window.Art || !Art.drawVessel) return;

    const hero =
        heroes.find(h => h.id === save.selectedHero) || heroes[0];

    /* Dash after-images: three ghosts trailing the player, fading out. */
    if (player.dashTimer > 0) {

        for (let i = 1; i <= 3; i++) {

            ctx.save();
            ctx.globalAlpha = 0.26 * (1 - i / 4) * (player.dashTimer / 12);

            Art.drawVessel(ctx, vesselState(hero, {
                x: player.x - player.direction * i * 13,
                dash: 0,
                simple: true
            }));

            ctx.restore();
        }
    }

    /* Invulnerability blink, kept from the original: the player must always
       see that the hit registered and that i-frames are running. */
    const blinking =
        player.invincible > 0 &&
        Math.floor(player.invincible / 5) % 2 === 0;

    ctx.save();
    if (blinking) ctx.globalAlpha = 0.62;

    Art.drawVessel(ctx, vesselState(hero));

    ctx.restore();

    /* Jump arc: a short motion streak under the feet while moving fast. */
    if (!player.grounded && !player.climbing && Math.abs(player.vy) > 9) {

        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = player.vy < 0 ? "#e8edf3" : "#ffd9a8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y + player.height + 4);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height + 14 + Math.abs(player.vy));
        ctx.stroke();
        ctx.restore();
    }
}


/* =========================================================
   PARTICLE DRAWING
========================================================= */

function drawParticles() {

    particles.forEach(p => {

        ctx.save();

        ctx.globalAlpha =
            clamp(
                p.life / 40,
                0,
                1
            );

        if (
            p.type === "fire"
        ) {

            ctx.fillStyle =
                "#ff762e";

            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                p.size,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        else if (
            p.type === "ice"
        ) {

            ctx.fillStyle =
                "#a8ecff";

            ctx.fillRect(
                p.x,
                p.y,
                p.size,
                p.size
            );
        }

        else if (
            p.type === "coin"
        ) {

            ctx.fillStyle =
                "#ffd348";

            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                p.size,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        else if (
            p.type === "heart"
        ) {

            ctx.fillStyle =
                "#ff668f";

            ctx.font =
                "20px Arial";

            ctx.fillText(
                "♥",
                p.x,
                p.y
            );
        }

        else if (
            p.type === "water"
        ) {

            ctx.fillStyle =
                "#65d5f5";

            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                p.size,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        else {

            ctx.fillStyle =
                "#f7d36c";

            ctx.beginPath();

            ctx.arc(
                p.x,
                p.y,
                p.size,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        ctx.restore();
    });
}

/* =========================================================
   BOSS HUD
========================================================= */

function drawBossBar() {

    if (
        currentLevel !== 3 ||
        !boss ||
        !boss.alive
    ) {
        return;
    }

    const width =
        Math.min(
            600,
            window.innerWidth - 80
        );

    const x =
        window.innerWidth / 2 -
        width / 2;

    const y = 105;

    ctx.save();

    ctx.fillStyle =
        "rgba(30,20,25,.85)";

    ctx.fillRect(
        x,
        y,
        width,
        28
    );

    ctx.fillStyle =
        "#d94e58";

    ctx.fillRect(
        x + 4,
        y + 4,
        (width - 8) *
            (
                boss.health /
                boss.maxHealth
            ),
        20
    );

    ctx.strokeStyle =
        "#f0ca67";

    ctx.lineWidth = 3;

    ctx.strokeRect(
        x,
        y,
        width,
        28
    );

    ctx.fillStyle =
        "#fff";

    ctx.font =
        "bold 15px Fredoka, Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        boss.name,
        window.innerWidth / 2,
        y - 8
    );

    ctx.restore();
}

/* =========================================================
   HUD
========================================================= */

const hudCache = {};

/* Only touch the DOM when a value really changed (this ran 60x/second before). */
function setHud(id, value) {
    if (hudCache[id] === value) return;
    const el = $(id);
    if (!el) return;
    hudCache[id] = value;
    el.textContent = value;
}

function updateAllHUD() {

    ["home-coins", "hero-coins", "game-coins"].forEach(id => setHud(id, save.coins));

    const hero = heroes.find(h => h.id === save.selectedHero) || heroes[0];
    setHud("current-hero", hero.name);
    setHud("health", health);

    const pct = (health / maxHealth * 100) + "%";
    if (hudCache.healthFill !== pct) {
        hudCache.healthFill = pct;
        const fill = $("health-fill");
        if (fill) fill.style.width = pct;
    }

    /* mask pips: filled = current health. The numeric count beside them is
       the shape-independent cue, so state never relies on colour alone. */
    const masks = $("hud-masks");
    if (masks) {
        const sig = maxHealth + ":" + health;
        if (hudCache.masks !== sig) {
            hudCache.masks = sig;
            const list = masks.querySelectorAll ? masks.querySelectorAll(".hud-mask") : [];

            if (list.length !== maxHealth) {
                let html = "";
                for (let i = 0; i < maxHealth; i++) {
                    html += '<svg class="hud-mask' + (i < health ? "" : " empty") +
                        '" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-heart"/></svg>';
                }
                masks.innerHTML = html;
            } else {
                list.forEach((el, i) => el.classList.toggle("empty", i >= health));
            }
        }
    }

    /* Low health gets a slow pulse *and* a hollow last pip (never colour alone). */
    const low = health <= 1;
    if (hudCache.healthLow !== low) {
        hudCache.healthLow = low;
        const pill = document.querySelector(".hud-group .hud-pill");
        if (pill) pill.classList.toggle("hud-pip-low", low);
        const vitals = document.querySelector(".hud-vitals");
        if (vitals) vitals.classList.toggle("hud-pip-low", low);
    }
}

let promptState = null;

function updateHUDGame() {

    updateAllHUD();

    /* context prompts: one small chip, only while it is useful */
    const hints = save.settings.controlHints !== false;
    let kind = "";

    if (hints && gameRunning && !paused) {
        if (finishLine && !finishLocked() && nearFinishLine()) kind = "flag";
        else if (isNearLadder() && !player.climbing) kind = "ladder";
    }

    if (kind !== promptState) {
        promptState = kind;

        const msg = $("context-prompt");

        if (msg) {
            if (kind === "flag") msg.innerHTML = "<kbd>E</kbd> — touch the banner";
            else if (kind === "ladder") msg.innerHTML = "<kbd>W</kbd>/<kbd>S</kbd> — climb";
            msg.classList.toggle("hidden", kind === "");
        }
    }

    /* objective flips the moment the guardian falls */
    if (currentLevel === 3 && boss && !boss.alive) {
        setHud("hud-goal", "Reach the goal banner");
    }
}

/* =========================================================
   GAME LOOP
========================================================= */

function startGameLoop() {

    if (animationId) cancelAnimationFrame(animationId);

    /* The game logic was written "per frame at 60 fps", so on a 144 Hz monitor it
       ran 2.4x too fast. Update at a fixed 60 Hz, draw once per display frame. */
    const STEP = 1000 / 60;
    let last = performance.now();
    let acc = 0;

    function loop(now) {

        if (!gameRunning) { animationId = null; return; }

        let dt = now - last;
        last = now;
        if (Math.abs(dt - STEP) < 1.5) dt = STEP;     // remove 60 Hz jitter
        acc += Math.min(dt, 100);                      // clamp after tab switches

        let steps = 0;
        while (acc >= STEP && steps < 5 && gameRunning) {
            updateGame();
            acc -= STEP;
            steps++;
        }
        if (steps === 5) acc = 0;                      // too slow: drop the backlog

        drawGame();

        animationId = requestAnimationFrame(loop);
    }

    animationId = requestAnimationFrame(loop);
}

/* =========================================================
   LEVEL END
========================================================= */

function endLevel(success) {

    if (!gameRunning) return;

    gameRunning = false;

    clearInput();

    if (animationId) {

        cancelAnimationFrame(
            animationId
        );

        animationId = null;
    }

    if (success) {

        save.completedLevels[
            `${currentWorld}-${currentLevel}`
        ] = true;

        save.coins += 50;

        saveGame();

        /* restrained celebration: one ring, one soft flash, one chime */
        const fx = Fx();

        if (fx) {
            fx.ring(player.x + player.width / 2, player.y + player.height - 8, 16, "#f2b84b");
            fx.flash("#f2b84b", 0.16, 14);
            fx.number(player.x + player.width / 2, player.y - 30, "LEVEL COMPLETE", "#f2b84b");
        }

        Sfx("unlock");
    }

    showResult(success);
}

/* =========================================================
   RESULT SCREEN
========================================================= */

function showResult(success) {

    let overlay =
        $("result-overlay");

    if (!overlay) {

        overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            "result-overlay";

        overlay.innerHTML = `
            <div class="result-card">

                <div
                    class="result-icon"
                    id="result-icon"
                ></div>

                <h1
                    id="result-title"
                ></h1>

                <p
                    id="result-message"
                ></p>

                <button
                    class="game-button"
                    id="result-button"
                ></button>

            </div>
        `;

        $("map-screen")
            .appendChild(
                overlay
            );
    }

    overlay.classList.remove(
        "hidden"
    );

    $("result-icon").textContent =
        success
            ? "🏆"
            : "💔";

    $("result-title").textContent =
        success
            ? currentLevel === 3
                ? "BOSS DEFEATED!"
                : "LEVEL COMPLETE!"
            : "GAME OVER";

    $("result-message").textContent =
        success
            ? "You earned 50 Geo!"
            : "Don't give up! Try again.";

    const button =
        $("result-button");

    button.textContent =
        success
            ? "WORLD MAP"
            : "TRY AGAIN";

    button.onclick = () => {

        /* guard: the button can be clicked twice (or after a screen
           change) while the first restart is still being set up */
        if (!overlay.isConnected) return;

        button.disabled = true;

        overlay.remove();

        if (success) {
            showWorldMap();
        } else {
            startLevel(
                currentWorld,
                currentLevel
            );
        }
    };
}

/* =========================================================
   STARTUP
========================================================= */

function initializeGame() {
    window.__miloBooted = true;      // tells the safety net in index.html we started

    resizeCanvas();

    updateAllHUD();

    updateSettingsButtons();
    applySettingsClasses();

    renderHeroes();

    startLoading();
}

/* Pause the level when the tab hides: no surprise deaths while away. */
document.addEventListener("visibilitychange", () => {
    if (document.hidden && gameRunning && !paused) togglePause();
});

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeGame,
        {
            once: true
        }
    );

} else {

    initializeGame();
}