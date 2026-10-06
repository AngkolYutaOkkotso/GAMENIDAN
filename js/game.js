/* =========================================================
   MILO MUSHROOM
   UPGRADED COMPLETE GAME.JS
   Replace your old game.js with this entire file.
========================================================= */

const $ = id => document.getElementById(id);

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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
        sound: true
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
    "home-screen",
    "heroes-screen",
    "settings-screen",
    "gacha-screen",
    "metro-screen",
    "map-screen"
];

let gameRunning = false;
let animationId = null;

function hideScreens() {
    if (window.Metro) Metro.stop();      // leaving the Descent: stop its loop + save
    screenIds.forEach(id => {
        const screen = $(id);

        if (screen) {
            screen.classList.add("hidden");
        }
    });
}

function stopGame() {
    gameRunning = false;
    if (window.Scenery) Scenery.pauseAmbient();

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function showHome() {
    stopGame();

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
}

function openSettings() {
    stopGame();

    hideScreens();

    const screen = $("settings-screen");

    if (screen) {
        screen.classList.remove("hidden");
    }

    updateSettingsButtons();
}

function openMap() {
    stopGame();

    hideScreens();

    const screen = $("map-screen");

    if (screen) {
        screen.classList.remove("hidden");
    }

    showWorldMap();
}

/* =========================================================
   LOADING
========================================================= */

let loadingStarted = false;

function startLoading() {
    if (loadingStarted) return;
    loadingStarted = true;

    const screen = $("loading-screen");
    const bar = $("loading-progress");
    const percent = $("loading-percent");

    if (!screen) { showHome(); return; }

    screen.classList.remove("hidden");
    screen.style.cssText = "display:flex;position:fixed;inset:0;z-index:9999";

    const MIN = 450;      // shortest time the bar is shown
    const MAX = 1500;     // never wait longer than this, whatever the network does
    const t0 = performance.now();
    let finished = false;

    const setProgress = p => {
        p = Math.min(100, Math.round(p));
        if (bar) bar.style.width = p + "%";
        if (percent) percent.textContent = p + "%";
    };

    const tick = setInterval(
        () => setProgress(Math.min(90, (performance.now() - t0) / MIN * 90)), 50);

    const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(tick);
        setProgress(100);
        setTimeout(() => {
            screen.classList.add("hidden");
            screen.style.display = "none";
            showHome();
        }, 200);
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

function toggleSetting(button) {
    if (!button) return;

    const row = button.closest(".setting-row");

    if (!row) return;

    const title =
        row.querySelector("strong")?.textContent || "";

    if (title.includes("Music")) {
        save.settings.music = !save.settings.music;
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
            } else {
                alert(
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
                                            startLevel(
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

let finishLine = null;
let boss = null;

const keys = {};
const justPressed = {};

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

    shield: false
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

    player.x = 120;
    player.y = 300;

    player.vx = 0;
    player.vy = 0;

    player.grounded = false;
    player.climbing = false;

    player.invincible = 90;
    player.hurtTimer = 0;

    player.attackTimer = 0;
    player.dashTimer = 0;
    player.abilityTimer = 0;

    player.checkpointX = 120;
    player.checkpointY = 300;

    player.direction = 1;

    cameraX = 0;
    if (window.Scenery) Scenery.setWorld(world);

    createLevel();

    updateAllHUD();

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
       CHECKPOINTS
    ------------------------- */

    for (
        let x = 1500;
        x < levelWidth - 700;
        x += 1500
    ) {
        checkpoints.push({
            x,
            y: 455,
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
       FINISH LINE
    ------------------------- */

    finishLine = {
        x: levelWidth - 220,
        y: 390,
        width: 80,
        height: 130
    };
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
            Math.random() * 100
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
        y: 360,

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

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();

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
            useSpecial();
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

        keys[
            event.key.toLowerCase()
        ] = false;
    }
);

window.addEventListener("blur", () => {
    Object.keys(keys).forEach(key => {
        keys[key] = false;
    });

    Object.keys(justPressed).forEach(key => {
        justPressed[key] = false;
    });
});

/* =========================================================
   SPACE / JUMP / CLIMB
========================================================= */

function handleSpace() {

    if (!gameRunning) return;

    if (isNearLadder()) {

        player.climbing =
            !player.climbing;

        player.vy = 0;

        return;
    }

    if (player.grounded) {

        player.vy =
            -player.jumpPower;

        player.grounded = false;

        createDust(
            player.x + 20,
            player.y + player.height
        );
    }
}

function isNearLadder() {

    return ladders.some(
        ladder =>
            player.x +
                player.width >
                ladder.x - 25 &&

            player.x <
                ladder.x +
                ladder.width +
                25 &&

            player.y +
                player.height >
                ladder.y - 30 &&

            player.y <
                ladder.y +
                ladder.height
    );
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

    if (enemy.health <= 0) {

        enemy.alive = false;

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

    updateAllHUD();

    if (health <= 0) {
        endLevel(false);
    }
}

/* =========================================================
   UPDATE GAME
========================================================= */

function updateGame() {

    if (!gameRunning) return;

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

    const movingLeft =
        keys["arrowleft"] ||
        keys["a"];

    const movingRight =
        keys["arrowright"] ||
        keys["d"];

    /* Movement */

    if (movingLeft) {

        player.vx =
            -player.speed;

        player.direction = -1;
    }

    else if (movingRight) {

        player.vx =
            player.speed;

        player.direction = 1;
    }

    else if (!player.climbing) {

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

    /* Climbing */

    if (
        player.climbing &&
        isNearLadder()
    ) {

        player.vy = 0;

        player.vx = 0;

        if (
            keys["arrowup"] ||
            keys["w"]
        ) {
            player.y -= 3;
        }

        if (
            keys["arrowdown"] ||
            keys["s"]
        ) {
            player.y += 3;
        }

    } else {

        player.climbing = false;

        player.vy += 0.62;

        player.y += player.vy;
    }

    player.x += player.vx;

    /* Platform collision */

    player.grounded = false;

    platforms.forEach(platform => {
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

function updateEnemies() {

    enemies.forEach(enemy => {

        if (!enemy.alive) return;

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

            if (enemy.y > 460) {
                enemy.y = 460;
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
                430;

            createParticle(
                checkpoint.x,
                checkpoint.y - 30,
                "✓"
            );
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

    player.invincible = 100;
}

/* =========================================================
   FINISH LINE
========================================================= */

function updateFinishLine() {

    if (!finishLine) return;

    /* Boss must be defeated first */

    if (
        currentLevel === 3 &&
        boss &&
        boss.alive
    ) {
        return;
    }

    if (
        player.x >
        finishLine.x
    ) {

        endLevel(true);
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

    cameraX =
        player.x -
        window.innerWidth *
        0.35;

    cameraX =
        clamp(
            cameraX,
            0,
            Math.max(
                0,
                levelWidth -
                window.innerWidth
            )
        );
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

    ctx.translate(
        -cameraX,
        0
    );

    drawHazards();
    drawPlatforms();
    drawLadders();
    drawCheckpoints();
    drawCoins();
    drawEnemies();
    drawProjectiles();
    drawFinishLine();

    drawPlayer();

    drawParticles();

    ctx.restore();

    /* atmosphere: fog, particles, dynamic lighting (js/scenery.js) */
    if (window.Scenery) Scenery.draw(ctx, { cameraX, world: currentWorld, player });

    drawBossBar();
}

/* =========================================================
   SKY
========================================================= */

function drawSky() {

    const world =
        worlds[currentWorld];

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            window.innerHeight
        );

    gradient.addColorStop(
        0,
        world.sky1
    );

    gradient.addColorStop(
        1,
        world.sky2
    );

    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
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

    platforms.forEach(platform => {

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

        ctx.fillStyle =
            "#5b3824";

        ctx.fillRect(
            checkpoint.x,
            checkpoint.y - 60,
            7,
            60
        );

        ctx.fillStyle =
            checkpoint.activated
                ? "#6ee86c"
                : "#d9b85a";

        ctx.beginPath();

        ctx.moveTo(
            checkpoint.x + 7,
            checkpoint.y - 60
        );

        ctx.lineTo(
            checkpoint.x + 55,
            checkpoint.y - 45
        );

        ctx.lineTo(
            checkpoint.x + 7,
            checkpoint.y - 30
        );

        ctx.closePath();

        ctx.fill();
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


        if (!enemy.alive) return;

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

function drawEnemy(enemy) {

    ctx.save();

    const x = enemy.x;
    const y = enemy.y;

    const bob = enemy.flying
        ? Math.sin(enemy.phase) * 5
        : 0;

    ctx.translate(
        x,
        y + bob
    );


    /* =========================
       SHADOW
    ========================= */

    if (!enemy.flying) {

        ctx.fillStyle = "rgba(0,0,0,.25)";

        ctx.beginPath();

        ctx.ellipse(
            enemy.width / 2,
            enemy.height + 4,
            enemy.width / 2,
            7,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    /* =========================
       ENEMY COLORS
    ========================= */

    let bodyColor = "#7b6a9e";

    switch (enemy.type) {

        case "slime":
            bodyColor = "#67c75a";
            break;

        case "beetle":
            bodyColor = "#473d63";
            break;

        case "mushling":
            bodyColor = "#c95662";
            break;

        case "wolf":
            bodyColor = "#66706f";
            break;

        case "thorn":
            bodyColor = "#4d9a55";
            break;

        case "forestSpirit":
            bodyColor = "#75c47b";
            break;

        case "bat":
            bodyColor = "#8068a8";
            break;

        case "rockCrawler":
            bodyColor = "#72717d";
            break;

        case "crystalBug":
            bodyColor = "#52c4da";
            break;

        case "cloudSpirit":
            bodyColor = "#f4f7ff";
            break;

        case "stormBird":
            bodyColor = "#7164bc";
            break;

        case "skyEye":
            bodyColor = "#d65d78";
            break;

        case "lavaSlime":
            bodyColor = "#ef5b2f";
            break;

        case "fireBat":
            bodyColor = "#d94e30";
            break;

        case "magmaBeast":
            bodyColor = "#71352c";
            break;

        case "iceWolf":
            bodyColor = "#86c5dd";
            break;

        case "frostBat":
            bodyColor = "#72a9d4";
            break;

        case "iceGolem":
            bodyColor = "#7dc7d9";
            break;

        case "darkMushroom":
            bodyColor = "#733d67";
            break;

        case "knight":
            bodyColor = "#59616e";
            break;

        case "magicGuardian":
            bodyColor = "#8a5ed1";
            break;
    }


    /* =========================
       WINGS FOR FLYING ENEMIES
    ========================= */

    if (enemy.flying) {

        ctx.fillStyle = bodyColor;

        /* Left wing */

        ctx.beginPath();

        ctx.ellipse(
            3,
            25,
            18,
            12,
            -0.4,
            0,
            Math.PI * 2
        );

        ctx.fill();


        /* Right wing */

        ctx.beginPath();

        ctx.ellipse(
            enemy.width - 3,
            25,
            18,
            12,
            0.4,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    /* =========================
       MAIN BODY
    ========================= */

    ctx.fillStyle = bodyColor;

    ctx.beginPath();

    ctx.roundRect(
        5,
        8,
        enemy.width - 10,
        enemy.height - 8,
        12
    );

    ctx.fill();


    /* =========================
       BODY HIGHLIGHT
    ========================= */

    ctx.fillStyle = "rgba(255,255,255,.16)";

    ctx.beginPath();

    ctx.ellipse(
        enemy.width * 0.35,
        16,
        8,
        5,
        -0.4,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /* =========================
       TYPE DETAILS
    ========================= */

    /* Slime */

    if (
        enemy.type === "slime" ||
        enemy.type === "lavaSlime"
    ) {

        ctx.fillStyle = "rgba(255,255,255,.22)";

        ctx.beginPath();

        ctx.arc(
            enemy.width * 0.30,
            14,
            4,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }


    /* Beetle */

    if (enemy.type === "beetle") {

        ctx.strokeStyle = "#241f35";
        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.moveTo(
            enemy.width / 2,
            12
        );

        ctx.lineTo(
            enemy.width / 2,
            enemy.height - 5
        );

        ctx.stroke();
    }


    /* Wolf */

    if (
        enemy.type === "wolf" ||
        enemy.type === "iceWolf"
    ) {

        ctx.fillStyle = bodyColor;

        /* Ears */

        ctx.beginPath();

        ctx.moveTo(8, 14);
        ctx.lineTo(14, 2);
        ctx.lineTo(20, 14);

        ctx.fill();

        ctx.beginPath();

        ctx.moveTo(enemy.width - 20, 14);
        ctx.lineTo(enemy.width - 14, 2);
        ctx.lineTo(enemy.width - 8, 14);

        ctx.fill();
    }


    /* Thorn */

    if (enemy.type === "thorn") {

        ctx.fillStyle = "#d7f07b";

        ctx.beginPath();

        ctx.moveTo(
            enemy.width / 2,
            3
        );

        ctx.lineTo(
            enemy.width / 2 + 5,
            14
        );

        ctx.lineTo(
            enemy.width / 2 - 5,
            14
        );

        ctx.closePath();

        ctx.fill();
    }


    /* Crystal Bug */

    if (enemy.type === "crystalBug") {

        ctx.fillStyle = "#c8f8ff";

        ctx.beginPath();

        ctx.moveTo(
            enemy.width / 2,
            5
        );

        ctx.lineTo(
            enemy.width / 2 + 7,
            17
        );

        ctx.lineTo(
            enemy.width / 2,
            25
        );

        ctx.lineTo(
            enemy.width / 2 - 7,
            17
        );

        ctx.closePath();

        ctx.fill();
    }


    /* =========================
       EYES
    ========================= */

    const eyeY = 18;

    /* White eyes */

    ctx.fillStyle = "#fff";

    ctx.beginPath();

    ctx.ellipse(
        enemy.width * 0.30,
        eyeY,
        6,
        7,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.ellipse(
        enemy.width * 0.64,
        eyeY,
        6,
        7,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /* Pupils */

    ctx.fillStyle = "#241a1a";

    ctx.beginPath();

    ctx.arc(
        enemy.width * 0.31,
        eyeY + 1,
        3,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        enemy.width * 0.65,
        eyeY + 1,
        3,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /* =========================
       CUTE MOUTH
    ========================= */

    ctx.strokeStyle = "#241a1a";
    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
        enemy.width / 2,
        31,
        5,
        0,
        Math.PI
    );

    ctx.stroke();


    /* =========================
       LITTLE FEET
    ========================= */

    ctx.fillStyle = "#302327";

    ctx.beginPath();

    ctx.ellipse(
        enemy.width * 0.28,
        enemy.height - 2,
        9,
        5,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.ellipse(
        enemy.width * 0.72,
        enemy.height - 2,
        9,
        5,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();


    /* =========================
       HEALTH BAR
    ========================= */

    if (enemy.maxHealth > 1) {

        const barWidth = enemy.width;

        ctx.fillStyle = "#2c2220";

        ctx.fillRect(
            0,
            -10,
            barWidth,
            5
        );

        ctx.fillStyle = "#e65b59";

        ctx.fillRect(
            0,
            -10,
            barWidth *
            Math.max(
                0,
                Math.min(
                    1,
                    enemy.health / enemy.maxHealth
                )
            ),
            5
        );
    }


    /* =========================
       FROZEN EFFECT
    ========================= */

    if (enemy.frozen > 0) {

        ctx.strokeStyle = "#9eeeff";
        ctx.lineWidth = 3;

        ctx.strokeRect(
            -5,
            -5,
            enemy.width + 10,
            enemy.height + 10
        );


        /* Ice sparkles */

        ctx.fillStyle = "#ffffff";

        ctx.fillRect(
            -7,
            10,
            4,
            4
        );

        ctx.fillRect(
            enemy.width + 3,
            25,
            4,
            4
        );
    }


    ctx.restore();
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
   FINISH LINE DRAWING
========================================================= */

function drawFinishLine() {

    if (!finishLine) return;

    const locked =
        currentLevel === 3 &&
        boss &&
        boss.alive;

    ctx.fillStyle =
        "#543522";

    ctx.fillRect(
        finishLine.x,
        finishLine.y,
        7,
        130
    );

    /* Flag */

    ctx.fillStyle =
        locked
            ? "#777"
            : "#e55362";

    ctx.beginPath();

    ctx.moveTo(
        finishLine.x + 7,
        finishLine.y
    );

    ctx.lineTo(
        finishLine.x + 80,
        finishLine.y + 25
    );

    ctx.lineTo(
        finishLine.x + 7,
        finishLine.y + 50
    );

    ctx.closePath();

    ctx.fill();

    ctx.fillStyle =
        "#fff";

    ctx.font =
        "bold 14px Arial";

    ctx.fillText(
        locked
            ? "BOSS"
            : "FINISH",
        finishLine.x + 13,
        finishLine.y + 31
    );
}

/* =========================================================
   PLAYER DRAWING
========================================================= */

function drawPlayer() {

    const hero =
        heroes.find(
            h =>
                h.id ===
                save.selectedHero
        ) || heroes[0];

    const x = player.x;
    const y = player.y;

    ctx.save();

    ctx.translate(
        x,
        y
    );

    if (
        player.direction === -1
    ) {
        ctx.translate(
            player.width,
            0
        );

        ctx.scale(
            -1,
            1
        );
    }

    /* Blink */

    if (
        player.invincible > 0 &&
        Math.floor(
            player.invincible / 5
        ) % 2 === 0
    ) {

        ctx.globalAlpha = 0.55;
    }

    const moving =
        Math.abs(
            player.vx
        ) > 0.5;

    const walking =
        moving &&
        player.grounded &&
        !player.climbing;

    const walk =
        walking
            ? Math.sin(
                player.animation *
                2.5
            ) * 5
            : 0;

    const jump =
        !player.grounded &&
        !player.climbing;

    const bob =
        walking
            ? Math.abs(walk) * 0.25
            : Math.sin(
                player.animation
            ) * 0.5;

    /* Shadow */

    ctx.fillStyle =
        "rgba(0,0,0,.25)";

    ctx.beginPath();

    ctx.ellipse(
        22,
        63,
        18,
        5,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* -------------------------
       LEGS
    ------------------------- */

    ctx.fillStyle =
        "#493226";

    const leftLeg =
        walking
            ? walk
            : 0;

    const rightLeg =
        walking
            ? -walk
            : 0;

    ctx.fillRect(
        9 + leftLeg,
        45,
        10,
        18
    );

    ctx.fillRect(
        27 + rightLeg,
        45,
        10,
        18
    );

    /* Boots */

    ctx.fillStyle =
        "#2f2524";

    ctx.fillRect(
        5 + leftLeg,
        58,
        16,
        7
    );

    ctx.fillRect(
        25 + rightLeg,
        58,
        16,
        7
    );

    /* -------------------------
       BODY
    ------------------------- */

    ctx.fillStyle =
        hero.color;

    ctx.beginPath();

    ctx.roundRect(
        7,
        27 + bob,
        31,
        24,
        7
    );

    ctx.fill();

    /* Clothes */

    ctx.fillStyle =
        hero.secondary;

    ctx.fillRect(
        9,
        42 + bob,
        27,
        7
    );

    /* -------------------------
       ARMS
    ------------------------- */

    let armAngle = 0;

    if (
        player.attackTimer > 0
    ) {

        armAngle =
            player.attackTimer >
            6
                ? -0.8
                : 0.8;
    }

    ctx.save();

    ctx.translate(
        8,
        31 + bob
    );

    ctx.rotate(
        -armAngle
    );

    ctx.fillStyle =
        hero.color;

    ctx.fillRect(
        -8,
        0,
        10,
        22
    );

    ctx.restore();

    ctx.save();

    ctx.translate(
        37,
        31 + bob
    );

    ctx.rotate(
        armAngle
    );

    ctx.fillStyle =
        hero.color;

    ctx.fillRect(
        -2,
        0,
        10,
        22
    );

    ctx.restore();

    /* -------------------------
       HEAD
    ------------------------- */

    ctx.fillStyle =
        "#f4cfae";

    ctx.fillRect(
        8,
        12 + bob,
        28,
        25
    );

    /* Ears */

    ctx.fillRect(
        4,
        20 + bob,
        7,
        10
    );

    ctx.fillRect(
        33,
        20 + bob,
        7,
        10
    );

    /* -------------------------
       MUSHROOM CAP
    ------------------------- */

    ctx.fillStyle =
        hero.color;

    ctx.beginPath();

    ctx.arc(
        22,
        15 + bob,
        23,
        Math.PI,
        0
    );

    ctx.fill();

    ctx.fillRect(
        0,
        13 + bob,
        44,
        10
    );

    /* Cap spots */

    ctx.fillStyle =
        "#fff1dc";

    ctx.beginPath();

    ctx.arc(
        12,
        7 + bob,
        5,
        0,
        Math.PI * 2
    );

    ctx.arc(
        30,
        10 + bob,
        5,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* -------------------------
       FACE
    ------------------------- */

    ctx.fillStyle =
        "#241a19";

    ctx.fillRect(
        14,
        21 + bob,
        4,
        6
    );

    ctx.fillRect(
        27,
        21 + bob,
        4,
        6
    );

    /* Smile */

    ctx.strokeStyle =
        "#6b3931";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
        22,
        27 + bob,
        5,
        0,
        Math.PI
    );

    ctx.stroke();

    /* -------------------------
       HERO ACCESSORIES
    ------------------------- */

    drawHeroAccessory(
        hero,
        bob
    );

    /* -------------------------
       JUMP EFFECT
    ------------------------- */

    if (jump) {

        ctx.strokeStyle =
            hero.color;

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.arc(
            22,
            32,
            30,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }

    /* -------------------------
       SHIELD
    ------------------------- */

    if (
        player.shield
    ) {

        ctx.strokeStyle =
            "#7de4ff";

        ctx.lineWidth = 5;

        ctx.beginPath();

        ctx.arc(
            22,
            32,
            40,
            0,
            Math.PI * 2
        );

        ctx.stroke();

        ctx.strokeStyle =
            "rgba(170,240,255,.35)";

        ctx.lineWidth = 12;

        ctx.stroke();
    }

    ctx.restore();
}

/* =========================================================
   HERO ACCESSORIES
========================================================= */

function drawHeroAccessory(
    hero,
    bob
) {

    if (
        hero.id === "milo"
    ) {

        /* Backpack */

        ctx.fillStyle =
            "#7a4d2f";

        ctx.fillRect(
            34,
            32 + bob,
            8,
            14
        );
    }

    if (
        hero.id === "luna"
    ) {

        ctx.strokeStyle =
            "#c7b7ff";

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.arc(
            32,
            3 + bob,
            7,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }

    if (
        hero.id === "rocco"
    ) {

        ctx.fillStyle =
            "#6c4a35";

        ctx.fillRect(
            0,
            37 + bob,
            9,
            13
        );

        ctx.fillRect(
            35,
            37 + bob,
            9,
            13
        );
    }

    if (
        hero.id === "zuki"
    ) {

        ctx.fillStyle =
            "#5dc65e";

        ctx.beginPath();

        ctx.ellipse(
            37,
            10 + bob,
            12,
            5,
            -0.6,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    if (
        hero.id === "blaze"
    ) {

        ctx.fillStyle =
            "#ff9c2e";

        ctx.beginPath();

        ctx.moveTo(
            14,
            0 + bob
        );

        ctx.lineTo(
            19,
            -13 + bob
        );

        ctx.lineTo(
            23,
            -2 + bob
        );

        ctx.lineTo(
            30,
            -12 + bob
        );

        ctx.lineTo(
            29,
            3 + bob
        );

        ctx.closePath();

        ctx.fill();
    }

    if (
        hero.id === "taro"
    ) {

        ctx.strokeStyle =
            "#8cecff";

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.arc(
            22,
            4 + bob,
            18,
            Math.PI,
            0
        );

        ctx.stroke();
    }

    if (
        hero.id === "koko"
    ) {

        ctx.fillStyle =
            "#f7ca3b";

        ctx.fillRect(
            35,
            30 + bob,
            9,
            9
        );
    }

    if (
        hero.id === "piko"
    ) {

        ctx.fillStyle =
            "#62c8ed";

        ctx.fillRect(
            2,
            34 + bob,
            7,
            15
        );

        ctx.fillRect(
            35,
            34 + bob,
            7,
            15
        );
    }

    if (
        hero.id === "mimi"
    ) {

        ctx.fillStyle =
            "#ff5c91";

        ctx.beginPath();

        ctx.arc(
            22,
            39 + bob,
            5,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    if (
        hero.id === "bruno"
    ) {

        ctx.fillStyle =
            "#6c452f";

        ctx.fillRect(
            0,
            36 + bob,
            10,
            14
        );

        ctx.fillRect(
            34,
            36 + bob,
            10,
            14
        );
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
}

let climbShown = null;

function updateHUDGame() {

    updateAllHUD();

    const show = isNearLadder() && !player.climbing;
    if (show === climbShown) return;
    climbShown = show;

    const msg = $("climb-message");
    if (msg) msg.classList.toggle("hidden", !show);
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

    renderHeroes();

    startLoading();
}

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