# Hollow Milo — Presentation & Feel Polish Plan

Scope: menus, HUD, movement/ladder controls, the goal flag, and game feel.
**Nothing about the story, characters, worlds, levels, economy, save format or core
mechanics changes.** This document is the pre-implementation deliverable: current
state, what is preserved vs. changed, the design proposals, the exact control and
ladder logic, the flag plan, affected files, staged plan and the testing checklist.

---

## 1. Current state summary

### Main menu (`#home-screen`)
- Centered "menu card" on a gradient background with a CSS mist layer.
- Title "Hollow Milo" (Cinzel, no entrance animation) + subtitle + stats row
  (Geo, Vessel, account chip).
- Six equal-weight buttons in a 3-column grid: **Levels**, **Descend** (styled
  primary), **Wish**, **Vessels**, **Log in**, **Settings**. No play/quit/credits/
  controls entry points; a static `controls-card` paragraph sits under the buttons.
- No keyboard/controller menu navigation (only Tab), no selected-button state,
  no screen transitions (screens hard-swap on `hideScreens()`), Settings has only
  Music + Sound toggles (the Descent accessibility rows are injected by
  `metroFx.mountSettings`).

### In-game HUD (`#map-screen`)
- Top row: `❤️ 3` pill + a thin health bar, a Geo pill, a Map button.
- `pulseHud()` already adds `hud-hit` / `hud-coin` classes but **style.css has no
  keyframes for them** (feedback silently does nothing).
- A floating "Press Space to use ladder" banner (`#climb-message`) appears near
  ladders. Boss levels draw a boss bar on canvas. No level/objective display,
  no pause button, no pause menu at all (Esc is unbound in Levels mode).

### Player controls (Levels mode, `js/game.js`)
- Move: `A`/`D` or `←`/`→` (instant velocity, light friction when idle).
- Jump: `Space` (fixed power, gravity 0.62).
- Ladder: must press `Space` **near** a ladder to toggle `player.climbing` on/off,
  then `W`/`S` (or arrows) move along it. Pressing Space to *jump* near a ladder
  instead toggles climbing — the game's most common friction point.
- Attack `F`/`J`, special ability `E`, dash `Shift`, fall-out-of-world respawn,
  checkpoints auto-activate. No interact key, no Esc/pause.

### Ladder behaviour
- Ladders hang from floating platforms down to the ground (`y = platformY`,
  `height = 520 - platformY`). `isNearLadder()` uses a generous ±25 px box.
- While `climbing`: gravity off, `W`/`S` move at 3 px/frame, any other logic
  cancels climbing (`player.climbing = false` whenever the toggle is off or the
  near-box is lost). No grip to the ladder axis, no top/bottom exit logic, no
  re-grab guard — sticky toggles and mid-air drops are possible.

### Flag (`finishLine`)
- Created at `x = levelWidth − 220`, `y = 390`, box `80×130`: a 7 px pole drawn
  from y 390→520 with a red triangle and plain Arial "FINISH"/"BOSS" text.
- Trigger is a bare x-plane test (`player.x > finishLine.x`) — the declared box
  is never used, so the collider does not match the visual; there is no footing
  where the pole meets the ground, no highlight, no animation, no sound, and
  nothing tells the player the flag is the goal until they stumble into it.
- Boss levels (level 4 of each world) lock it (grey + "BOSS") until the boss dies.

---

## 2. Preserved / changed / removed

### Preserved (untouched)
- Story, worlds, level names, heroes/vessels and abilities, Geo economy, wish
  banners/pity/history, accounts + cloud saves, save format, level generation
  (platforms, coins, hazards, enemies, checkpoints, props, boss levels),
  physics constants (speed 4, jump 12, gravity 0.62), attack/dash/special,
  the Descent (metroid.js) and its own controls, all art-rendering systems
  (Art Kit silhouettes, Vessel renderer, props, Scenery atmosphere), procedural
  audio library, loading/login screens, existing sprites/preview assets.

### Changed (presentation & feel)
- **Main menu**: layered animated background (soul motes + moths via the existing
  `threshold.js` veil canvas), animated title entrance, grouped button hierarchy
  with Play as the clear primary, full hover/press/selected feedback, 200–400 ms
  eased screen transitions, keyboard + mouse + gamepad navigation.
- **New menu screens**: Play (mode select), Controls, Credits, Quit-to-title
  confirmation; Settings gains interface/accessibility rows.
- **HUD**: restyled vitals (mask pips + soul bar), Geo counter, world/level +
  objective line, pause + map buttons, working hit/coin feedback animations,
  context prompts ("W / S — climb", "E — touch the banner") with keycaps.
- **Controls**: ladders are used with `W`/`S` alone (Space is only jump), Esc
  pauses, `E` interacts where an interaction exists (flag) and otherwise keeps
  its current special-ability role. Smooth accel/decel, coyote time, jump
  buffering, variable jump height, smoothed camera.
- **Flag**: rebuilt as a grounded goal banner with footing, aligned collider and
  interaction zone, waving pennant, glow/particles, proximity cue and a full
  level-complete feedback burst.
- **Feel**: scene wipes between menu ↔ gameplay, auto-pause on tab blur, landing
  dust/footsteps kept and polished, ladder grab/hop feedback.

### Removed
- The "Press Space to use ladder" toggle requirement (and its banner text).
- The static controls paragraph on the home screen (replaced by the Controls
  screen; the same information, properly presented).
- The flat Arial "FINISH" text (replaced by the styled banner + HUD objective).
  Nothing else is removed.

---

## 3. Main-menu layout & UI style guide

### Layout (top → bottom)
```
[ veil canvas: soul motes + drifting moths · layered gradients + fog · vignette ]

        ✦ A FORGOTTEN KINGDOM AWAITS ✦            (eyebrow)
              H O L L O W   M I L O               (title, per-letter entrance)
     "Descend through seven forgotten realms…"     (subtitle)

        ◈ 1,000    Vessel: Milo    👤 Guest       (stats row)

                  [ ▶  PLAY  ]                    (primary — largest,
                                                   shimmer + glow)

            [ 🕯 Wish ]   [ 🗝 Vessels ]          (journey group)

        [ ⚙ Settings ]  [ 🎮 Controls ]           (system group)
        [ 📜 Credits ]  [ 🚪 Quit ]

   ↑↓ navigate · Enter select · Esc back · gamepad supported   (hint bar)
```
- **Play** opens a mode-select overlay: *Levels* (classic platform journey) and
  *Descend* (the Hollow Descent) — both existing modes, both preserved.
- **Quit** asks for confirmation, then returns to the Threshold (title/login
  screen — a web game cannot close its own tab); progress is already saved.

### Style guide (applies to every menu screen)
- **Palette**: ink `#07090f` / panels `rgba(10,14,22,.9)` / bone text `#e8edf3`
  / muted `#8d9bb0` / soul-light `#cfe2ff` / lantern gold `#f2b84b` / danger
  `#e55362`. Existing HOLLOW THEME tokens stay authoritative.
- **Type**: Cinzel 700 for titles (letter-spacing .08–.34em), Cinzel 500 for
  eyebrows/buttons, system sans for body copy. Keycaps (`kbd`) for input hints.
- **Buttons**: one component (`.menu-btn`), 4–6 px radius, 1 px soul-light border,
  icon + label + optional sub-label. States — hover: lift 2 px + glow + icon
  slide; press: scale .97 + darken; **selected**: bright ring + diamond marker +
  left light-bar (shape cues, never colour alone); focus-visible matches
  selected. Disabled: dimmed + lock icon + `aria-disabled`.
- **Hierarchy**: Play is ~1.5× taller, gradient-filled, shimmer animation;
  journey buttons medium; system buttons compact/ghost.
- **Transitions**: 220–320 ms, `cubic-bezier(.2,.8,.2,1)` / ease-out — screen
  content fades+rises 14 px; a full-screen wipe (160 ms in / 240 ms out)
  bridges menu ↔ gameplay and mode switches.
- **Backgrounds**: animated but quiet — motes ≤ 90, moths 2–4, fog drift 40 s,
  vignette keeps text contrast ≥ 4.5:1; panels use translucent dark glass with
  blur so text never sits raw on motion.
- **Navigation**: arrows/`W`/`S` move the visible selection (wraps), Enter/Space
  activates, Esc goes back/closes; mouse hover updates the selection; gamepad
  d-pad/left stick navigates, A selects, B backs out. All screens use the same
  model.

---

## 4. HUD layout & interaction feedback

```
┌────────────────────────────────────────────────────────────────┐
│ ◈ 1,040   [mask][mask][mask░]  ████████░░   │  Forgotten Crossroads · Level 2
│  Geo      vitals (pips + soul bar)          │  Reach the goal banner
│                                             │            [ ⏸ Pause ] [ 🗺 Map ]
└────────────────────────────────────────────────────────────────┘
                (bottom-centre)  ⌨ W / S — climb      ⌨ E — touch the banner
```
- **Vitals**: 3 mask pips (filled/empty shapes — not colour-only) + slim soul
  bar; low health adds a slow pulse and the bar turns danger-red *plus* a
  "!" marker. Damage: `hud-hit` shake + red edge flash + hurt SFX (already
  fired by `damagePlayer`). Heal: green shimmer.
- **Geo**: pulses `hud-coin` with a "+10" float on pickup (SFX already plays).
- **Objective**: world · level name + one goal line; becomes "Defeat the
  guardian" on boss levels and flips to "Reach the goal banner" when the boss
  falls. Completing it bursts a gold ring + flash + chime.
- **Context prompts**: bottom-centre keycap chips, fade 160 ms in/out, only
  while relevant (near ladder / near banner / low cooldowns ready). Suppressed
  by the "Control hints" setting.
- **Ability feedback**: dash/special already animate; cooldowns show as a small
  dimming pip beside the prompt area only while cooling down (minimal).
- **Pause** (`Esc` or ⏸): glass overlay — Resume / Settings / Controls / Restart
  level / World map / Home, same button system, navigable like the main menu;
  the world keeps drawing behind but does not update.
- UI animations ≤ 300 ms, ease-out, non-blocking; all feedback respects
  "Reduced downtime", "Flashing effects", "Screen shake" and "Reduce motion".

---

## 5. Control scheme & ladder logic (exact)

### Levels mode
| Input | Action |
|---|---|
| `A` / `←` | Move left (accelerated, snappy decel) |
| `D` / `→` | Move right |
| `W` / `↑` | On/near a ladder: climb up (auto-grab, no jump first) |
| `S` / `↓` | On/near a ladder: climb down (also grabs from the ladder's top platform) |
| `Space` | Jump (grounded or coyote window) · while climbing: hop off the ladder |
| `F` / `J` | Attack (unchanged) |
| `E` | Interact (goal banner) — otherwise Special ability (unchanged) |
| `Shift` | Dash (unchanged) |
| `Esc` | Pause / back |
| Gamepad | Stick/d-pad move · A jump · X attack · B interact/special · RB dash · Start pause |

### Ladder state machine
- `overLadder()` — player body overlaps a ladder (±18 px side margin).
- **Grab** (only while `grabCd == 0`): holding `W`/`↑` while overlapping any
  part of a ladder, **or** holding `S`/`↓` while standing on the platform a
  ladder hangs from (or overlapping it from above). Sets `climbing`, zeroes
  velocity, stores `climbLadder`, plays a soft latch sound + 2 dust motes.
- **While climbing**: gravity off; `W`/`S` move at 2.7 px/frame; the player
  x eases toward the ladder centre (lerp .25) so the grip is stable.
- **Exits** (all natural, no key required):
  1. *Top*: feet reach the ladder's top (`player.bottom ≤ ladder.y + 6`) →
     snap onto the platform, `grounded`, `grabCd = 10`.
  2. *Ground*: feet reach the ground line → snap, `grounded`, `grabCd = 10`.
  3. *Sideways*: `A`/`D` held with the player's centre leaving the ladder
     margin for 4 frames → exit with that horizontal velocity, `grabCd = 12`.
  4. *Hop off*: `Space` while climbing → exit + small jump in facing direction.
  5. *Ladder ends*: if the player leaves the ladder's vertical span, climbing
     simply ends (gravity resumes) — the previous "toggle" trap is gone.
- `grabCd` prevents instant re-grab jitter; exit snaps are one-frame, so there
  is no bouncing between states and no input delay (grab is edge-evaluated every
  frame).

### Movement feel
- Acceleration 0.55/frame toward target speed (air 0.32), friction 0.78 —
  reaches full speed in ~5 frames, never slippery.
- Coyote time 6 frames; jump buffer 7 frames; releasing `Space` early cuts the
  rise (variable jump). Landing squash/dust/footsteps kept.
- Camera: smoothed follow (lerp .12) with 60 px look-ahead; snaps after
  respawn/teleport so it never drifts or jitters.

---

## 6. Flag plan

- **Position**: `x = levelWidth − 240` (same goal location), pole planted on the
  ground line — `finishLine = { x, y: groundY − 170, w: 110, h: 170 }` so the
  declared box ends exactly on the surface; a stone footing is drawn so the pole
  visually *rests* on the ground without clipping.
- **Checkpoint banners** (the other flags in the level) get the same grounding
  pass: their poles hung at y = 455 — visibly floating — and respawn dropped
  the player into mid-air. They now stand on the ground line with a stone
  footing, the respawn point lands the player on the surface, and lit/unlit
  states differ by a check-mark vs dot glyph, not colour alone.
- **Collider / interaction**: one rect (the same box) drives both the touch
  trigger (`rectsOverlap(player, finishLine)` **or** the player's centre
  crossing the pole x — jumping over the flag can never skip the goal) and the
  `E`-interact proximity test. No more invisible x-plane mismatch.
- **Reachability**: ground level, right of every platform/hazard; normal walking
  reaches it; boss levels stay locked (grey pennant + "SEALED") until the boss
  dies, then it re-ignites with a burst.
- **Readability**: animated waving pennant (sin fold), warm soul glow, slow
  rising motes, a gold pool of light on the ground; proximity increases the
  glow and shows `E — touch the banner` (touch alone still completes).
- **Completion**: gold ring + soft flash + "LEVEL COMPLETE" number + chime, then
  the existing result screen (+50 Geo, world map) — restrained, readable.

---

## 7. Affected files

| File | Change |
|---|---|
| `index.html` | Home/menu rebuild, Play + Quit overlays, Controls & Credits screens, pause overlay, HUD markup, context prompt, script tag for `js/menuNav.js` |
| `style.css` | Menu button system + states, title entrance, overlays, HUD restyle + `hud-hit`/`hud-coin` keyframes, context prompts, keycaps, screen wipe, reduce-motion/high-contrast modifiers, Controls/Credits screens |
| `js/menuNav.js` *(new)* | Keyboard/mouse/gamepad menu navigation, selection state, screen wipe helper |
| `js/game.js` | Input mapping (W/S ladders, Space jump only, E interact-or-special, Esc pause), ladder state machine, accel/coyote/buffer, camera smoothing, flag collider/visual/finish effects, HUD data (pips, objective), settings rows (reduce motion / high contrast / control hints), pause system, screen ids + openControls/openCredits/openPlay/openQuit |
| `js/art.js` | `drawVessel` accepts a `climb` pose (legs alternate, slight lean) |
| `js/metroFx.js` | unchanged (its options rows already mount into Settings) |
| `js/threshold.js` | unchanged (auto-picks up the home veil canvas) |
| `sw.js` | VERSION bump + `js/menuNav.js` in CORE |
| `tests/levels.test.js` | New assertions: ladder auto-grab/top & side exits, flag on the ground, aligned trigger, E-interact, pause freeze |
| `docs/POLISH_PLAN.md` *(new)* | This document |
| `README.md` | Controls + polish notes |

No sprite/asset files change; all new visuals are code-drawn in the existing
style (consistent with the Art Kit's procedural approach).

---

## 8. Staged implementation plan

1. **Stage 1 — Menu foundation**: `menuNav.js`, home-screen rebuild, Play/Quit
   overlays, Controls + Credits screens, screen wipe, menu button system,
   Settings additions. *Testable: mouse + keyboard + gamepad navigate every
   screen; transitions 200–400 ms; Quit returns to the Threshold.*
2. **Stage 2 — HUD + pause**: HUD markup/styles, working hit/coin feedback,
   objective line, mask pips, context prompt component, pause overlay + Esc +
   auto-pause on tab blur. *Testable: HUD readable at a glance; Esc pauses and
   resumes; feedback on damage/coins.*
3. **Stage 3 — Controls + ladders**: new input mapping, ladder state machine,
   movement feel (accel, coyote, buffer, variable jump), climb pose, prompts.
   *Testable: W/S climb with no jump-first; clean exits; Space only jumps.*
4. **Stage 4 — Flag**: grounded banner, aligned collider, E-interact, glow /
   particles / completion burst. *Testable: banner on the ground; touch or E
   completes; sealed on boss levels.*
5. **Stage 5 — Feel + polish**: camera smoothing, scene wipes at all entry
   points, small VFX/SFX touches, settings wiring (reduce motion etc.),
   performance pass (no new per-frame allocations in the hot path).
6. **Stage 6 — Tests, docs, deploy**: extend `tests/levels.test.js`, run all
   three suites, regenerate preview frames, update README + sw.js, push.

---

## 9. Testing checklist

### Menu
- [ ] Title animates in; background motes/fog move gently; text stays readable.
- [ ] Play is visually dominant; groups read Play → journey → system.
- [ ] Hover, selected, pressed and disabled states are distinct and never
      colour-only; focus ring visible for keyboard users.
- [ ] Arrow keys / W-S / Enter / Space / Esc navigate and activate; selection
      wraps; Esc backs out of overlays and sub-screens.
- [ ] Gamepad d-pad/stick + A/B navigate the same way (browser with a pad).
- [ ] Play → Levels/Descend; Settings/Controls/Credits/Quit open the right
      screens; Quit confirms first and lands on the Threshold.
- [ ] Transitions run 200–400 ms with easing, no flashing.
- [ ] Settings rows all work (Music, Sound, shake, flashing, hit-stop,
      telegraph, reduced downtime, volumes, reduce motion, high contrast,
      control hints) and persist across reloads.

### HUD
- [ ] Health/Geo/objective readable at a glance over bright and dark worlds.
- [ ] Damage shakes the HUD + plays sound; coins pulse + "+10" float.
- [ ] Objective updates on boss levels; prompts appear only near ladders/banner.
- [ ] Pause button reachable by mouse; HUD never covers the play area.

### Movement & ladders
- [ ] A/D/←/→ move with quick accel/decel; no slipperiness, no input lag.
- [ ] Jump feels responsive (buffer + coyote); short taps give short hops.
- [ ] W/↑ near/on a ladder climbs with **no** jump press; S/↓ climbs down and
      grabs from the top platform.
- [ ] Exits work at top (onto platform), at ground, sideways, and via Space
      hop-off; no sticking, jitter or mid-air toggling after leaving.
- [ ] Esc pauses; movement keys do nothing while paused; resume is instant.

### Flag & collision
- [ ] Banner rests on the ground in every world; footing visible; no clipping.
- [ ] Walking into it (or pressing E near it) completes the level; running past
      the pole from the air also completes; +50 Geo awarded once.
- [ ] Boss levels: sealed grey until the boss dies, then ignites.
- [ ] Platforms/ladders/hazards collision unchanged and stable at high speed.

### Performance & accessibility
- [ ] 60 fps on a mid laptop; no console errors; draw-call budget held.
- [ ] Reduce motion removes entrance/wipe animations; flashing/shake toggles
      respected everywhere (menus + Levels + Descent).
- [ ] High-contrast HUD boosts outlines; control hints hide prompts when off.
- [ ] All three node suites pass (`levels`, `art`, `metro`).
