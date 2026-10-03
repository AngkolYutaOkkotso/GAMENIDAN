# Hollow Milo

A dark, Hollow-Knight-*inspired* browser platformer (vanilla JS + Canvas; original names and art, no Team Cherry assets) with **cloud saves**, **accounts**, a **Genshin-style hero wish system** and an **atmospheric scenery layer**. Static site – deploys on Vercel with no build step.

```
index.html        page + script loading order
config.js         <-- your Supabase URL / anon key
style.css         UI + wish animation styles
js/game.js        original game (small hooks added, see "What changed")
js/auth.js        guest / Google / Discord login, guest -> OAuth upgrade
js/saveSystem.js  serialize, debounced auto-save, cloud sync
js/gacha.js       banners, rarity pools, pity, history
js/gachaAnimation.js  cinematic wish canvas animation
js/ui.js          wish screen, account panel, toasts
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
- Open the game → Home → 👤 chip. You start as `Guest-xxxx` (local UUID in `localStorage.miloGuestId`, plus a Supabase anonymous user when configured).
- Play a level / wish, then press "Save progress with Google": the guest is *linked* to Google, keeping the same user id and save.
- Open the site in a private window, sign in with the same Google account → the cloud save loads.
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
