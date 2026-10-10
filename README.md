# Hollow Milo

A dark, Hollow-Knight-*inspired* browser platformer (vanilla JS + Canvas; original names and art, no Team Cherry assets) with **cloud saves**, **accounts**, a **Genshin-style hero wish system** and an **atmospheric scenery layer**. Static site – deploys on Vercel with no build step.

```
index.html        page + script loading order
config.js         <-- your Supabase URL / anon key
sw.js             offline cache (repeat visits load instantly)
vercel.json       long cache headers for fonts/vendor
fonts/ vendor/    self-hosted Cinzel font + Supabase library (no third-party requests)
style.css         UI + wish animation styles
js/game.js        original game (small hooks added, see "What changed")
js/auth.js        login / sign-up (email + password), guest / Google / Discord auth
js/saveSystem.js  serialize, debounced auto-save, cloud sync
js/gacha.js       banners, rarity pools, pity, history
js/gachaAnimation.js  cinematic wish canvas animation
js/ui.js          wish screen, account panel, toasts
js/metroid.js     "The Hollow Descent" Metroidvania mode (rooms, physics, abilities, combat, boss, map, charms)
js/metroFx.js     Descent feedback: screen shake, flashes, hit-stop, telegraph assist, sound effects, Options rows
docs/DESIGN.md    full design doc. Tags show what is built: [BUILT], [STAGE n] (scheduled), [PLANNED]
tests/metro.test.js  automated simulation tests for the Descent (node tests/metro.test.js)
js/scenery.js     particles, fog, lighting, procedural ambient audio
supabase/schema.sql   database table + security policies
```

## Run locally
```bash
npx http-server -p 8080     # then open http://localhost:8080
```
Without Supabase configured the game works exactly as before (local save only) and the Wish screen still works.

## Set up accounts + cloud saves (Supabase, free tier)
1. Create a project at supabase.com.
2. **SQL Editor** → paste and run `supabase/schema.sql`.
3. **Authentication → Providers → Anonymous Sign-Ins** → enable (used for guest accounts).
4. **Authentication → Sign In / Providers** → enable **Manual linking** (lets a guest upgrade without losing the save).
5. Enable **Google** and/or **Discord** providers (create OAuth apps in each console; the callback URL is shown in the Supabase provider page).
6. **Authentication → URL Configuration** → set *Site URL* to your Vercel URL and add `http://localhost:8080` to *Redirect URLs*.
7. Copy **Project URL** and **anon public key** (Project Settings → API) into `config.js`.

The anon key is meant to be public; Row Level Security in `schema.sql` restricts every player to their own row. **Never** put the `service_role` key in this project.

### Testing guest vs logged-in
- Open the game to see the login screen. Choose **Continue with Google** to create or access an account, or use email/password, Discord, or **Continue as Guest**.
- Guest mode uses a local UUID in `localStorage.miloGuestId`; when configured, pressing **Continue as Guest** also creates a Supabase anonymous user for cloud saves.
- From Home → 👤 chip, choose **Log in with email** or **Save progress with Google** to back up a guest save.
- Open the site in a private window, sign in with the same account → the cloud save loads.
- If a device has local progress and logs into a different account that already has a cloud save, you are asked which to keep.

## How saving works
`game.js` still writes `localStorage` (key `miloMushroomSave`) on every `saveGame()`. That function now stamps `savedAt` and calls `SaveSystem.schedulePush()`, which uploads after 2.5 s of quiet (level complete, coin pickup, purchase, wish, hero select, settings) and also when the tab is hidden or on sign-out. On login `SaveSystem.sync()` keeps whichever of cloud/local has the newer `savedAt`.

### Player data (one JSON document in `player_saves.data`)
```json
{
  "coins": 1000, "selectedHero": "milo", "unlockedHeroes": ["milo"],
  "completedLevels": { "0-0": true },
  "settings": { "music": true, "sound": true },
  "savedAt": 1767000000000,
  "profile": { "name": "Guest-ab12", "avatar": "", "method": "guest", "userId": "..." },
  "gacha": {
    "totalPulls": 12,
    "banners": { "standard": { "pity5": 12, "pity4": 2, "guaranteed": false } },
    "history": [ { "t": 1767000000000, "banner": "standard", "hero": "luna", "rarity": 3, "isNew": true } ]
  }
}
```
History is capped at 100 entries. Level/position/health are not persisted because the game restarts levels from the beginning; progress = `completedLevels`.

## Theme
Currency is **Geo (◈)**, heroes are **Vessels**, and the seven worlds are renamed/recoloured (Forgotten Crossroads, Mossy Greenpath, Crystal Depths, City of Rain, Ashen Basin, Pale Peaks, Hollow Castle) in `worlds` / `levelNames` / `heroes` in `js/game.js`. The palette lives in the "HOLLOW THEME" block at the bottom of `style.css`.

## Wish system
Currency is Geo (100 per wish). Edit everything at the top of `js/gacha.js`:
- `CONFIG` – cost, base rates, soft pity (74), hard pity (90), 4★ guarantee (10), 50/50 chance.
- `POOL` – which hero ids are 3★ / 4★ / 5★. `RARITY` – colours and duplicate refunds.
- `BANNERS` – add a banner with `featured5` / `featured4`; pity is tracked per banner.

Duplicates refund Geo.

### Animation sync
When you press Wish, the result is rolled, Geo is deducted, the save is written locally **and pushed to the cloud immediately** (so closing the tab mid-animation can never lose or re-roll a wish). The cinematic then runs on one clock: the whoosh audio, streak, colour change to the best rarity (with a "tell" ping), impact boom, white flash and particle burst all fire at the same instants, and each card's flip animation and chime share the same offsets (`cardStep`). Skip jumps to the reveal and silences the whoosh but keeps the chimes. Sound follows the Sound setting; reduced-motion users skip to the results. Tune it in `TIMINGS` (`meteor`, `flash`, `cardStep`) in `js/gachaAnimation.js`.

## Scenery
`js/scenery.js` draws fog (darker, mossier, ashier per world), drifting particles and dynamic lighting over the existing parallax backgrounds, and runs generated ambient audio (wind, drone pad, echoing plinks) that glides between worlds. Tweak per-world mood in `THEMES`. The ambience follows the Music setting. No audio files or tilesets are required; to use your own art, replace the `draw*Background` functions in `game.js`.

## What changed in game.js
Search for `SaveSystem`, `Scenery`, `applySave`, `normalizeSave` and `"gacha-screen"` – about 50 added lines; gameplay is untouched.

## Deploy on Vercel
Push the folder to GitHub → import in Vercel → Framework preset **Other**, no build command → Deploy. Then add your Vercel URL to Supabase *Site URL / Redirect URLs*.

## Performance (why it loads fast now)
- **Nothing third-party blocks startup.** The old build waited on a CDN script and Google Fonts before `game.js` could run, so a slow or blocked connection froze the loading screen at 0 %. Fonts and the Supabase library are now self-hosted, and Supabase only loads *after* the menu is on screen (and only if `config.js` has keys). Every cloud call has an 8 s timeout, so a bad connection can never freeze the game.
- **Real loading screen:** about 0.5 s, hard cap 1.5 s. If the game still fails to boot, a "Reload" link appears after 6 s (it also clears the service worker cache).
- **Fixed 60 Hz game logic:** the game no longer runs 2.4x too fast on 144 Hz monitors.
- **Cheaper drawing:** off-screen platforms, enemies and coins are skipped, HUD text is only written when it changes, particles are capped, and the scenery layer uses pre-rendered sprites instead of per-frame gradients / `shadowBlur`. It lowers its own quality automatically if FPS drops.
- **Offline / repeat visits:** `sw.js` caches static files. When you deploy changes, bump `VERSION` in `sw.js`.

### Troubleshooting
- Stuck on loading after an update: hard-refresh (Ctrl+Shift+R) or click the Reload link; an old cached version can be the cause.
- Cloud saves unavailable: the game keeps working locally; check `config.js` and that Anonymous sign-ins are enabled in Supabase.

## The Hollow Descent (Metroidvania mode)
Home -> **Descend**. Your normal level mode is untouched (now called **Levels**). The Descent uses your selected hero's look, shares Geo with the shrine, and saves into `save.metro` (so it syncs to the cloud like everything else). Design and staging: `docs/DESIGN.md`.

**Controls:** A/D or arrows move · Space jump (hold = higher) · F/J attack (hold Up/Down to aim; Down in the air = pogo) · Shift/L dash · E soul bolt · hold Q heal · **R Lantern Sight** · **G Bell Hook** (aims with the held direction) · **Down + Space in the air = Sinking Weight dive** · Up = rest at bench / talk · M map · C charms (at benches) · Esc pause.
Touch devices get on-screen buttons, including ✺ Lantern, ⟲ Hook and ▼ Down.

### Abilities
| Ability | Control | Found in | Used for |
|---|---|---|---|
| Shade Cloak | Shift / L | Fungal Descent (r2) | the Chasm gap (r3) |
| Wall Claw | jump into a wall | The Climb (r4) | the wall-jump shaft to the Spire (r5) |
| Moth Wing | jump again in the air | The Spire (r5) | the Bellwork ledge (r8); a Wall Claw climb up the brittle column also reaches it |
| Lantern Sight | R | Hidden Loft (r7, above Moss) | the seal at the east end of The Climb |
| Sinking Weight | Down + Space in the air | Bellwork Gate ledge (r8) | breaking the brittle column into Anchor Hall (r9) |
| Bell Hook | G | Clapper Loft (r10) | the bell anchor in Anchor Hall, and the mask shard above it |

- **Lantern Sight:** places a 4-tile Lumen platform in the air under your feet. It can catch a fall, lasts about 3 seconds and flickers in its last second. Enemies within 4.5 tiles are stunned for 1.5 s and nearby shots are cleared. 1.5 s cooldown.
- **Sinking Weight:** Down + Space in the air starts a straight dive. The landing shockwave hurts enemies within 2 tiles and shatters brittle stone (`B`) within 3 tiles sideways and 5 tiles up. Broken stone stays broken.
- **Bell Hook:** an instant ray up to 11 tiles along your aim. Stone stops it; a bell anchor (`A`) pulls you to it, and jump lets go. A hit enemy takes 1 damage and is stunned for about 0.7 s.
- **Seals** are stone blocks with a glyph for one ability: Shade `››`, Claw `///`, Wing leaf, Lantern ring with flame, Sinking downward triangle, Bell ring with dot. A seal is solid until you own its ability, then it is removed for good. Gold markers on the map show sealed gates, bell anchors and abilities you have not found yet.

### Route
Gate → Moss → Fungal (Shade Cloak) → Chasm (dash) → Climb (Wall Claw) → shaft → Spire (Moth Wing) → Warden's Hall (boss).
Ravine: the east corridor of The Climb is sealed by Lantern Sight (from the Hidden Loft). Beyond it: Bellwork Gate (ledge with Sinking Weight) → brittle column → Anchor Hall (bell anchor, mask shard) → Clapper Loft (Bell Hook). Backtrack with new abilities for the cracked wall in Fungal, Mask Shards, Whetstone, charms, and Old Wick's Glow Shard quest.

### Options
Home → **Settings** → Descent rows, or **⚙ Options** in the pause menu (same rows; changes apply at once and are saved with your progress in `save.settings.fx` and `save.settings.audio`):
- Screen shake (Off / Low / Full)
- Flashing effects (rest, boss phases, unlocks)
- Hit-stop (freeze frames on hits)
- Telegraph assist (`!` markers and dashed danger shapes)
- Reduced downtime (shorter death fade)
- Effects volume and Ambient volume (0–100%)

Enemy and boss danger is shown by shape as well as colour, and the Sound toggle also applies to the Descent.

**Extend it:** rooms are helper calls in `js/metroid.js`: `mk("id", "Name", gridX, gridY, worldTheme, exits, a => { a.pl(...); a.item(...); a.en(...) })`. Add a room, link `exits` both ways, and run the tests (they check exits, map placement, items and enemies outside walls, and every ability gate). Tile legend: `#` solid, `=` one-way platform, `^` spikes, `W` cracked wall (attack), `B` brittle stone (Sinking Weight), `A` bell anchor, and one seal letter per ability (`d c w l k h`, see `SEAL_AB`). A new seal needs a `SEAL_AB` entry, an ability in `ABIL`, and a branch in `drawSeal`.

### Testing
```bash
node tests/metro.test.js
```
Runs the real Descent physics headlessly (no browser needed) and prints one PASS/FAIL line per check (56 at the moment). It covers room data, each ability gate (dash chasm, double-jump ledge, wall shaft, Lantern seal, Lumen catch, Moth Wing and Wall Claw ledge, brittle column, dive shockwave, Bell Hook latch/release/wall stop), combat, the Warden fight, the options, save normalisation, and a random-input fuzz in every room with all abilities. When you add a room or ability, add a check next to the related block, run the file, then commit. Visual changes (art, seals, map) still need a quick look in a browser.

### Manual test checklist
- Movement: coyote jump, variable jump height, wall slide/jump, dash i-frames, double jump, pogo on enemy and spikes, dive and hook.
- Lantern Sight: pulse under a fall catches you; stunned enemies stop; Lumen flickers and disappears.
- Ravine: the seal opens with Lantern Sight; the dive breaks the column low down; Bell Hook pulls you to the anchor and jump lets go.
- Combat: hit-stop/knockback, 70-frame invulnerability, Soul gain, heal interrupted by damage, soul bolt cost.
- Boss: telegraphs readable, door locks, phase 2 at 50 %, death drops Geo + Heart.
- Options: each row changes its effect immediately and survives a reload.
- Saving: rest at bench, quit to Home, reload page -> same bench, abilities, seals, broken stone, charms, items. Sign in -> same progress on another device.
- UI: map shows markers and reveals rooms as visited (dashed `?` for unexplored neighbours), charm notches limit, pause menu, touch buttons (✺ ⟲ ▼ included) with no stuck input after release.
- Performance: stays ~60 fps (rooms render from a cached canvas; Scenery lowers its quality automatically if FPS drops).

### Status
Built: the Descent rooms from Hollow Gate to Clapper Loft (including Bellwork Ravine r8–r10) and Warden's Hall, six abilities, and the feedback options. Not built yet: the remaining zones, most bosses, the full art overhaul, and touch controls beyond R, G and Down. Those are staged in `docs/DESIGN.md`.
