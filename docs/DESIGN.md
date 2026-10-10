# Hollow Milo — "The Hollow Descent" Design Plan

Status legend: **[BUILT]** in the code today · **[STAGE n]** scheduled for implementation stage n · **[PLANNED]** designed here, implemented later.

---

## 1. Summary of the existing game (what is preserved)

| Area | What exists today | Where |
|---|---|---|
| Engine | None: vanilla JavaScript + HTML5 Canvas, static site, no build step | `index.html`, `js/*.js` |
| Playable character | **Milo**, a moth-capped vessel; other vessels are unlocked by the Wish system | `heroes` in `js/game.js`, `drawPlayer` in `js/metroid.js` |
| Story | Descend through seven forgotten realms, defeat guardians, gather Geo, awaken vessels at the shrine | Home subtitle, `worlds`, `levelNames` |
| Currency | **Geo (◈)**, shared between the Levels mode, the Wish shop and the Descent | `save.coins` |
| Modes | **Levels** (side-scroll levels), **Wish** (gacha), **Vessels**, **Settings**, **Descent** (Metroidvania) | `index.html`, `js/game.js`, `js/gacha*.js` |
| Descent world | 8 rooms in a 40×24-tile grid, 3 abilities (Shade Cloak / Wall Claw / Moth Wing), 3 charms, Glow Shards, Mask Shards, Whetstone, Old Wick NPC, bench, Hollow Warden boss | `js/metroid.js` `ROOMS` |
| Saves | `localStorage` + optional Supabase cloud sync, debounced; Descent saves to `save.metro` | `js/saveSystem.js`, `supabase/schema.sql` |
| Ambience | Procedural audio + fog/particles per world | `js/scenery.js` |
| Tests | 19 headless simulation tests | `tests/metro.test.js` |
| Controls | A/D or arrows · Space jump · F/J attack (↑/↓ aim, ↓ in air = pogo) · Shift/L dash · E soul bolt · hold Q heal · ↑ rest/talk · M map · C charms · Esc pause | README |

**Preserved without change:** the name *Hollow Milo*, Milo and the Vessel roster, the Geo economy, the Old Wick quest, the Hollow Warden and its door, the three original abilities and their rooms, every existing control, the bench/rest/Soul/Mask systems, cloud saves, the Wish system, and the Levels mode.

**Gaps found during review (fixed in the stages below):**
- The Descent has **no sound effects**; the Sound toggle does nothing in it. → Stage 1.
- Screen shake and the white rest flash cannot be turned off; no accessibility options exist. → Stage 1.
- Telegraphs for the boss are colour/pose only (crouch + pale tint). → Stage 1 (shape markers).
- Only one boss, three abilities, eight rooms. → Stages 2–3 and backlog.
- `docs/DESIGN.md` was referenced by the README but missing. → This document.
- Touch controls have no Heal button, so touch players cannot heal. → Stage 1.

---

## 2. Visual pillars and originality rules

### 2.1 Pillars
1. **Lamp in the dark.** Each zone is mostly dark. Milo carries a lantern, and every important thing (platform, hazard, enemy, attack, interactable) must read in silhouette at normal play distance.
2. **Worn, not ruined.** Materials show repair: stitched stone, brass patches, moth-silk bunting. Decay is never random noise.
3. **Silhouette first.** Colour is a bonus, never the only signal. Danger always has a shape cue (spikes, dashed outline, `!` marker).
4. **A breathing world.** Motion is slow and continuous in the background. Flashes are rare, short and optional.

### 2.2 Originality rules (we do not copy another game)
- No Team Cherry art, names, enemy shapes, or map layout. Milo, the Hollow Warden, Old Wick and all zone names are original.
- The player silhouette is a round moth-cap on a small body, not a horned helmet with a blade.
- No zone is a plain cave with vines. Each zone has one material idea (silk, brass, salt, glass, ember-ash, bone-ribs, spores).
- Abilities use new metaphors (Lantern Sight, Bell Hook, Sinking Weight) rather than generic "dash/double jump" names where possible. Original abilities keep their names.

### 2.3 Shape language
| Element | Rule |
|---|---|
| Player | Rounded moth-cap (semi-ellipse), compact body, 20×30 hitbox. Dash = a trailing ghost rectangle. |
| Normal enemies | One silhouette family each: crawler = low dome, flyer = wide wings, spitter = tall with a tail, sentry = angular frame. |
| Bosses | Each has a signature element: Warden = tall helm with horns, Ribkeeper = a spine-cage, Matron = a broad wing span, Tollkeeper = a bell hanging from a chain. |
| Hazards | Spikes = triangles on the floor. Shot projectiles = filled ellipses; ground shockwaves = flat bars. |
| Interactables | Benches = ring with a dot. Items = diamonds (ability = gold diamond with a ring; charm = violet; Geo = pale blue). NPCs = tall rectangle with a face. |
| **Ability gates (seals)** | One glyph per ability, drawn on a stone block. Shape + colour: **Shade = `››` chevrons**, **Claw = three slashes**, **Wing = feather leaf**, **Lantern = ring with a flame notch**, **Sinking = downward triangle**, **Bell = ring with a clapper dot**. A seal is solid until its ability is owned, then it dissolves for good. |
| Dynamic tiles | Lumen platforms (from Lantern Sight) are dashed-outline one-way platforms that flicker in the last second. Brittle floor (`B`) is cracked stone with pale hairline cracks. Bell anchors are small brass rings with a tick. |

### 2.4 Zone palettes (base / shadow / accent / hazard)
Shared across zones: **Lantern gold `#f2b84b`** (rewards, Milo's light), **Hollow white `#e8edf3`** (text, UI), **Danger coral `#ff6b6b`** (always with a shape cue).

| # | Zone | Base | Shadow | Zone accent | Hazard |
|---|---|---|---|---|---|
| 1 | Hollow Gate | `#3a4658` ash-blue stone | `#141a25` | `#9fb4cf` | none |
| 2 | Fungal Warrens | `#4b3a58` violet-brown | `#1e1626` | `#7ef0d2` teal glow | spore clouds |
| 3 | The Chasm | `#2a3f5c` deep slate | `#0e1a2c` | `#cfe9ff` pale dust | spike pit |
| 4 | The Climb | `#5b5a64` bone-grey | `#24232b` | `#e9e2cf` ivory | falling ribs |
| 5 | The Spire | `#4f4a3a` moth-dust gold-brown | `#1f1c14` | `#f6e7ae` | updraft |
| 6 | Warden's Hall | `#2e2a45` iron-violet | `#121022` | `#ff8a8a` (phase 2 only) | slam shock |
| 7 | Bellwork Ravine | `#5a3f2c` rust | `#24180f` | `#c9a35a` brass / `#5fb3a1` verdigris | swinging bells |
| 8 | Veil Marsh | `#2f4a48` teal-grey | `#132221` | `#b8ff9a` | sinking mud |
| 9 | Choir of Salt | `#6a6a74` salt-white | `#2b2b33` | `#ffd1e0` | beat-timed salt jets |
| 10 | Glass Reservoir | `#2a3d52` blue-glass | `#0d1826` | `#9fe3ff` | rising water |
| 11 | Ember Crypts | `#4a2a24` ember-brown | `#1d0f0c` | `#ff9a4d` | fire lanes |
| 12 | Unlit Crown | `#15131f` near-black | `#000000` | `#f2b84b` gold only | everything |

### 2.5 Materials, lighting, background, foreground, parallax
- **Materials:** two-tone blocks with a top highlight (ground line) and a dark bottom edge — existing style, kept. Each zone adds one material motif on its wall tiles (stitched, brass-rivet, salt-crust, glass-seam, ember-vein, rib-line, silk-pleat, spore-pore, etc.).
- **Lighting:** the existing Scenery vignette around Milo stays. Lantern Sight creates a short, brighter circle; it never blacks out the screen.
- **Background (far):** silhouetted pillars at 0.3× parallax. **Midground:** zone landmark at 0.6×. **Foreground:** hanging strings, drifting motes, fog at 1.0–1.2× but **never** in the top 2 tiles of a room and never over a seal, bench, anchor or enemy's telegraph.
- **Readability rule:** foreground decoration may not cover any tile type that matters. Enforced by a test (see §8).

### 2.6 UI, map, icons, fonts, ability unlock
- **Fonts:** Cinzel (existing, self-hosted) for titles; Inter/system sans for body.
- **HUD:** mask pips (health), soul orb, Geo counter, boss bar at the bottom. Health pips already show by shape (filled vs outlined), so colour is not needed.
- **Map:** existing grid. [STAGE 2] adds seal glyphs on rooms with gates, a gold ring for unclaimed abilities, and a bell icon for anchors.
- **Ability unlock:** a gold ring expands from Milo, the popup shows the ability's glyph, and a chime plays. The seal it opens dissolves in the same room later.
- **Menus:** existing `.menu-card` / `.setting-row` styling. Descent options live in Settings and in the pause menu.

### 2.7 Animation principles
- **Idle:** Milo breathes (1 px, 40-frame cycle). Enemies have 1 idle loop.
- **Movement:** squash on landing (≤ 2 px), stretch on jump (existing).
- **Attacks:** anticipation ≥ 8 frames for melee, ≥ 24 frames for boss attacks (the telegraph). Active frames are a bright arc.
- **Hits:** 3-frame hit-stop on player hits, 6 on boss hits; knockback on both sides. Hit-stop can be turned off.
- **Damage:** invulnerability flicker (existing) plus a sound and HUD pip pulse. Full-screen flashes are never used for damage.
- **Healing:** a rising ring around Milo while holding Q (existing), plus a soft chime.
- **Death:** fade to black and "YOU FELL" (existing), then return to the bench.
- **Interaction:** a 1-line prompt above the bench or NPC (existing).

---

## 3. Zone-by-zone world plan and connection map

Map coordinates are `(gx, gy)` in the existing room grid. Each zone has an original name, mood, landmark, traversal challenge, enemy roster, hazard, resource, and a reason to return.

### 3.1 Zones

**Z1 — Hollow Gate (hub) · [BUILT: r0, r1, r7]**
- Mood: quiet, the first lantern in the dark. Traversal: basic jumps, one gap. Enemies: crawler, flyer. Hazard: none.
- Resource: Glow Shards (3, for Old Wick). Landmark: the Gate lantern post (cracked glass; gold flame).
- Connections: r1 → Z2 (right), r1 ↑ Hidden Loft r7 (gives **Lantern Sight** in Stage 2).
- Return reason: Hidden Loft's Lantern Sight unlocks Z7 and the Chasm's bridge.

**Z2 — Fungal Warrens · [BUILT: r2]**
- Mood: damp, violet, humming. Traversal: a moving-floor corridor and a cracked secret wall (`W`).
- Enemies: crawler, spitter. Hazard: spore clouds [PLANNED]. Resource: Heavy Blade charm (secret pocket).
- Ability: **Shade Cloak** (dash) at the end of the corridor.
- Return: Shade Cloak opens the Chasm and the cracked-wall shortcut.

**Z3 — The Chasm · [BUILT: r3]**
- Mood: open air, pale dust. Traversal: 9-tile spike gap (dash needed) with a bench at its edge.
- Enemies: flyer. Hazard: spike pit. Resource: Geo.
- Connections: r3 ← Z2 (left), r3 → Z4 (right). [STAGE 2] Lantern Sight (Lumen platform) gives a non-dash crossing → optional route.
- Return: alternate route for speedrunners; Lumen bridge puzzle.

**Z4 — The Climb · [BUILT: r4]**
- Mood: bone and ribs. Traversal: wall-jump shaft (cols 30–33) with Wall Claw at its base.
- Enemies: crawler, spitter. Hazard: falling ribs [PLANNED]. Resource: Glow Shard, Whetstone.
- Connections: r4 ← Z3 (left), r4 ↑ Z5 Spire (via shaft), **r4 → Z7 Ravine (right) [STAGE 2, behind the Lantern seal]**.

**Z5 — The Spire · [BUILT: r5]**
- Mood: gold moth-dust, a steady updraft. Traversal: a double-jump ledge; Moth Wing item.
- Enemies: flyer, spitter. Hazard: updraft [PLANNED]. Resource: Mask Shard (+1 max health).
- Connections: r5 ↓ Z4 (shaft), r5 ← Warden's Hall (left).
- Return: Moth Wing unlocks the Ravine's high ledge (Sinking Weight).

**Z6 — Warden's Hall · [BUILT: r6]**
- Mood: iron and violet. Single arena with a locking door.
- Boss: **Hollow Warden** (see §5). Reward: Heart of the Hollow, opens the way onward.

**Z7 — Bellwork Ravine · [STAGE 2: r8, r9, r10]**
- Mood: rust, verdigris, bells that keep ringing. Traversal: a Lumen ledge, a brittle floor column, bell anchors over a gap.
- Enemies: crawler, flyer, new **Bell-sentry** (swings a clapper; a shape-coded telegraph). Hazard: swinging bell ring in r10 [PLANNED].
- Resources: Sinking Weight (r8 ledge), Bell Hook (r10), Mask/Geo.
- Connections: r8 ← Z4 (left, behind **Lantern seal**), r8 → r9 (right, behind the **brittle column**, needs Sinking Weight), r9 ↑ r10.
- Return: Sinking Weight and Bell Hook are both needed to reach the rest of r9/r10 items.

**Z8 — Veil Marsh · [PLANNED, stage 4]**
- Mood: teal mist, slow water. Traversal: mud that slows; veil platforms.
- Enemies: Coil Mother's burrowers; Fogwing flyers. Hazard: sinking mud. Resource: Veil Silk (new charm crafting).
- Connections: Warden's Hall gate (via Warden's Hall's new north exit) → Veil Marsh → Choir of Salt.
- Ability reward: **Silk Hook** (not a new ability; a Hook upgrade).

**Z9 — Choir of Salt · [PLANNED, stage 4]**
- Mood: white, rhythmic; the environment ticks to a beat. Traversal: beat-timed salt jets.
- Hazard: salt jets (tick → jet). Resource: Salt Crystal → charm slot upgrade.

**Z10 — Glass Reservoir · [PLANNED, stage 5]**
- Mood: blue-glass pools; water level rises and falls. Traversal: swim-like floating (water physics), mid-air.
- Hazard: rising water. Resource: Reservoir Pearl.

**Z11 — Ember Crypts · [PLANNED, stage 5]**
- Mood: ember and old stone. Traversal: fire lanes timed to flame cycles.
- Hazard: fire lanes. Resource: Ember Core (charm).

**Z12 — Unlit Crown · [PLANNED, endgame]**
- Mood: no lantern light except Milo's. Final route through all zones.
- Boss: **The Unlit Crown** and the endgame (§5).

### 3.2 Connection map (text)

```
                    Z5 Spire (Moth Wing) ──────┐
                       ▲ shaft (Wall Claw)     │
Z1 Hub ── Z2 Warrens ── Z3 Chasm ── Z4 Climb ─┤ Lantern seal
  │         (Shade)      (dash)      (Claw)    │
  └ Hidden Loft (Lantern)                      └── Z7 Ravine ──┐   (Sinking, Bell)
                                                               │
Z5 ── Z6 Warden's Hall (boss) ── Z8 Veil Marsh ── Z9 Choir of Salt
                                    │
                         Z10 Glass Reservoir ── Z11 Ember Crypts ── Z12 Unlit Crown
```
Shortcuts and hidden routes:
- **Chasm bridge (Z3):** Lantern Sight can make a platform under you to skip the dash requirement.
- **Cracked wall (Z2):** existing secret pocket.
- **Ravine rope (Z7):** Bell Hook from r9 to r10 ceiling anchors — a shortcut back to Z4.
- **Hidden Loft (Z1):** Lantern-lit route; leads to the Mask Shard.

### 3.3 Revisit rewards (examples)
- Lantern Sight → reveals and opens the Chasm bridge, Z7 seal, Hidden Loft.
- Moth Wing → Ravine ledge (Sinking Weight) + Spire upper room.
- Sinking Weight → Ravine column (Bell Hook room) + Fungal brittle floor.
- Bell Hook → Ravine high ceiling shortcut + Veil Marsh anchors.

---

## 4. Ability list and progression dependency chart

### 4.1 Abilities (six required; three new)

| # | Ability | Found in | Movement use | Combat use | Gate glyph |
|---|---|---|---|---|---|
| 1 | **Shade Cloak** (dash) [BUILT] | Z2 Warrens | Air dash, i-frames, crosses 9-tile gaps | Dash through shots; i-frames on contact | `››` chevrons |
| 2 | **Wall Claw** (wall jump) [BUILT] | Z4 Climb | Wall slide + wall jump, climbs shafts | Wall-kick hits from a wall | three slashes |
| 3 | **Moth Wing** (double jump) [BUILT] | Z5 Spire | One extra mid-air jump, refreshed on wall/ground | Air hop after a pogo hit | feather leaf |
| 4 | **Lantern Sight** (R) [STAGE 2] | Z1 Hidden Loft | Creates a **Lumen platform** under Milo (3-s one-way platform) to catch falls or bridge gaps | **Lantern pulse**: 3-tile radius, stuns enemies for 1.5 s, shatters shot projectiles | ring + flame notch |
| 5 | **Sinking Weight** (↓ + Jump in air) [STAGE 2] | Z7 Ravine ledge (r8) | Fast dive (16 px/frame); cannot be cancelled once started | Landing **shockwave**: 2-tile radius hits, breaks brittle floor (`B`) | downward triangle |
| 6 | **Bell Hook** (G) [STAGE 2] | Z7 Ravine (r10) | Latch to a bell anchor (`A`) within 10 tiles along the aim line, pulled at 11 px/frame; jump to release | Hook yanks a hit enemy toward you (1 dmg + stagger) | ring with clapper dot |

Balance rules: each ability's combat use is optional but rewarding; no ability is only a key; no ability is needed for a boss.

### 4.2 Dependency chart

```
Start ──► Z1 Hidden Loft ─► [Lantern Sight]
                              │
Start ──► Z2 Warrens ─► [Shade Cloak] ─► Z3 Chasm (dash or Lantern) ─► Z4 Climb ─► [Wall Claw]
                                                                              │
                                                       ┌──────────────────────┤
                                                       │                      │
                                       Lantern seal ◄──┘          Z5 shaft (Wall Claw) ─► [Moth Wing]
                                       │                                      │
                                       ▼                                      ▼
                          Z7 r8 ─ Ravine ledge (Moth Wing) ─► [Sinking Weight]
                                       │
                                       ▼ (brittle column: Sinking Weight)
                          Z7 r9 ─► r10 ─► [Bell Hook]
```

| Route | Requires | Boss needed? |
|---|---|---|
| Main (Warden → rest) | Shade Cloak, Wall Claw, Moth Wing | Warden is the first required boss |
| Ravine (Z7) | Lantern Sight (seal), Moth Wing (ledge) | no |
| Ravine deep (r9–r10) | Sinking Weight | no |
| Veil Marsh (Z8) [PLANNED] | Warden defeated, Bell Hook (anchor bridge) | Warden |
| Late zones (Z9–Z11) [PLANNED] | Tollkeeper + Choir Keeper | Yes, two required |
| Crown (Z12) [PLANNED] | All six abilities + 3 Lanterns | Endgame |

### 4.3 Required / optional routes
- **Required main route:** Shade → Claw → Wing → Warden → Z8 → Z9 → Z10 → Z11 → Crown.
- **Optional:** Lantern Sight (Loft), Ravine (Z7), charms, cracked walls, Mask Shards, hidden bosses.
- **Secrets:** cracked walls, Lumen-only ledges, hidden bosses (see §5).

### 4.4 Checkpoints, saves, health, resources
- **Bench:** full heal, saves, respawn point, resets room enemies (existing). Each zone has at least one bench [STAGE 2 adds one bench in Ravine r9].
- **Save behaviour:** every bench rest, pickup, ability unlock and door opening writes `save.metro` (debounced cloud sync) (existing + new keys).
- **Health:** Mask Shards (+1 max), 5 starting masks (existing).
- **Soul:** hits fill Soul; 33 Soul heals 1 mask (existing). Soul Catcher charm (existing).
- **Geo:** shared Geo (existing), dropped by enemies and bosses, auto-saved.
- **Difficulty curve:** early zones teach one skill each; boss HP and damage scale per zone; charms can be swapped at benches.

---

## 5. Boss roster (32 encounters)

Role groups: **R** = Required story · **O** = Optional regional · **H** = Hidden · **V** = Rematch / evolved · **E** = Endgame.
Difficulty: 1 (intro) · 2 (standard) · 3 (hard) · 4 (very hard) · 5 (endgame).
Status: **[BUILT]** · **[STAGE 3]** · **[PLANNED]**.

Each boss has: role/difficulty, zone, purpose, how to reach, arena, silhouette/audio, attack patterns with tells, phases, skill tested, reward, access options.

### 5.1 Required story bosses (R)

**R1 — Hollow Warden** · Z6 Warden's Hall · Difficulty 2 · [BUILT]
- Purpose: the first guardian; teaches reading wind-ups.
- Reach: the corridor from the Spire (Moth Wing).
- Arena: a single flat hall; the door locks; one bench outside.
- Silhouette: tall helm with horns, iron armor; audio: deep drum + low bell.
- Attacks: **Charge** (crouch tell, pale tint, floor line), **Slam** (leap + twin ground shockwaves; telegraph is a dashed ring), **Rain** (phase 2; falling shot columns with tick tells). Phase 2 at 50% HP: faster charge, rain added, eye turns red + shape change (crack lines on the body).
- Skill: space vs charge, jump over the slam shockwave.
- Reward: Heart of the Hollow (+ kingdom pulse), access to Z8. Optional: Warden Seal (cosmetic).
- Access: retry = bench, 80-frame death fade.

**R2 — Ribkeeper** · Z4 The Climb (upper shaft) · 2 · [PLANNED: stage 4]
- Purpose: teaches wall climbing under pressure. Arena: a tall shaft; the boss climbs the walls.
- Silhouette: a spine cage with rib bars; audio: rhythmic clicks (bones).
- Attacks: rib volleys in straight lines (tell: bones rattle one row before), wall-dash (tell: shoulders lean). Phase 2 at 40%: ribs fall from the top in alternating columns.
- Skill: wall jump timing; reading vertical lanes.
- Reward: +1 charm notch; opens the Spire upper door.

**R3 — Pale Matron of Moths** · Z5 The Spire · 3 · [PLANNED: stage 4]
- Purpose: teaches aerial dodging with Moth Wing. Arena: open tall room, boss airborne.
- Silhouette: wide wing span; audio: soft wing flutter (tempo change marks phase).
- Attacks: dust bursts (circle tells), dive-bombs (line tell), summon two moth flyers (phase 2).
- Phase 2 at 50%: wind gusts push Milo sideways — the gust is shown as stripes.
- Skill: double-jump timing; use the updraft.
- Reward: Moth Wing upgrade (+1 air hop after a pogo).

**R4 — Tollkeeper** · Z7 Bellwork Ravine (r10) · 3 · [STAGE 3]
- Purpose: teaches Bell Hook (hook the anchor to stop its charge; pull it into spikes).
- Arena: bell anchors on the ceiling; a central pillar with bells that swing.
- Silhouette: a bell hanging from a chain body; audio: a bell ring on each attack.
- Attacks: **Toll charge** (tell: bell rocks); if you hook it while it charges, the anchor drags it into the ceiling and it is stunned for 2 s. **Chime waves** (rings expanding, dashed ring tell).
- Phase 2 at 50%: adds swinging clappers; anchors move.
- Reward: Bell Hook upgrade (range +2 tiles); opens Z8 route (Veil Marsh anchors).

**R5 — Choir of Salt** · Z9 Choir of Salt · 4 · [PLANNED: stage 5]
- Purpose: beat-timed attacks. Arena: flat hall with salt jets in lanes.
- Silhouette: a column of hooded figures; audio: a metronome pulse that matches attacks.
- Attacks on beat: jets (rhythm tell 1 beat early), sweeping choir-note (dashed arc).
- Assist: Visual beat ring (on by default if telegraphs assist).
- Reward: Salt Crystal (+1 charm notch).

**R6 — Sunken Sentinel** · Z10 Glass Reservoir · 4 · [PLANNED: stage 5]
- Purpose: tests environmental change. Arena: water rises during the fight.
- Silhouette: a diving-helmet sentinel; audio: bubbles, muffled low tones.
- Attacks: harpoon lines, bubble rings; water level shifts platform availability (phase at 25%, 50%, 75% water).
- Reward: Reservoir Pearl (+5 Soul capacity).

**R7 — Ember Regent** · Z11 Ember Crypts · 4 · [PLANNED: stage 5]
- Purpose: lane reading under fire. Arena: long crypt with fire lanes.
- Silhouette: a robe with a flame crown; audio: crackle + drum.
- Attacks: fire lanes that scroll (tell: lane shows coal); fireball arcs (dashed tell).
- Reward: Ember Core (charm: short-range burn).

### 5.2 Optional regional bosses (O)

**O1 — Mother of Caps** · Z2 Fungal Warrens · 2 · [PLANNED: stage 4]
- Purpose: area control; teaches moving through clouds. Arena: a mushroom-cap room.
- Silhouette: a dome cap with stalk legs; audio: wet thump.
- Attacks: spore clouds (grey discs, slow down Milo on contact — visible shape), spore hops.
- Reward: Spore Rune (charm: spore-immune).

**O2 — Stiltwalker** · Z3 The Chasm · 2 · [PLANNED: stage 4]
- Purpose: pogo timing. Arena: pillars over the chasm.
- Silhouette: long legs; audio: metallic clicks.
- Attacks: stomp shockwaves across pillars (flat bar tell), leg swipes (arc).
- Reward: pogo refresh upgrade (+ height on pogo).

**O3 — Lamplighter Hound** · Z1 Mossed Passage · 1 · [PLANNED: stage 4]
- Purpose: dash-timing duel. Arena: a short corridor.
- Silhouette: lantern hound; audio: quick yips.
- Attacks: dashes (tell: lantern flickers), bites.
- Reward: Lamp Collar (charm: +1 dash charge).

**O4 — Coil Mother** · Z8 Veil Marsh · 3 · [PLANNED]
- Purpose: reading ground tremors. Arena: marsh with burrowing paths.
- Silhouette: segmented worm; audio: rumble.
- Attacks: surfacing with tremor tells; spit clusters.
- Reward: Veil Silk.

**O5 — Glass Hermit** · Z10 Glass Reservoir · 3 · [PLANNED]
- Purpose: attack from behind. Arena: mirrored walls.
- Silhouette: glass shell; audio: chime.
- Attacks: only attacks when facing away from it (indicated by a cracked reflection).
- Reward: Glass Shard (charm: +damage when hit from behind).

**O6 — Crypt Mason** · Z11 Ember Crypts · 3 · [PLANNED]
- Purpose: brittle-floor breaking. Arena: a wall builder.
- Silhouette: hooded mason with a brick cart; audio: hammering.
- Attacks: builds brittle columns (teaches Sinking Weight).
- Reward: Mason's Trowel (charm: break walls faster).

**O7 — Gilded Beetle Pair** · Z9 Choir of Salt · 3 · [PLANNED]
- Purpose: target priority. Arena: two beetles.
- Silhouette: gold armour; audio: different tones per beetle.
- Attacks: kill one, the other changes pattern.
- Reward: Gilded Carapace (charm: +1 mask hit reduction).

**O8 — Fogwing** · Z8 Veil Marsh · 2 · [PLANNED]
- Purpose: aerial tracking. Arena: fog-lit sky.
- Silhouette: broad, thin wings; audio: airy whistle.
- Attacks: dive with a fog trail.
- Reward: Fog Feather (charm: longer air time).

**O9 — Cistern Heron** · Z10 Glass Reservoir · 2 · [PLANNED]
- Purpose: swim-platforming. Arena: rising water.
- Silhouette: tall bird, thin neck; audio: call.
- Attacks: dive, shallow strikes; water rise changes tempo.
- Reward: Heron Plume (charm: float on water).

### 5.3 Hidden bosses (H)

**H1 — Mirror Wick** · Z1 Hollow Gate (after shards + Old Wick talks) · 3 · [PLANNED]
- Trigger: collect 3 shards; talk to Old Wick 3 times.
- Arena: Gate room with a reflection.
- Attacks: copies your last action with a 1-second delay (dash → dash). Teaches reading and reacting.
- Reward: Old Wick's Lamp (cosmetic + Lantern pulse +1 range).

**H2 — Null Moth** · Z5 Spire · 4 · [PLANNED]
- Trigger: defeat R3 without taking damage.
- Attacks: flickering lights (accessibility: flicker is off by default), instant teleports with tells.
- Reward: Null Dust (charm: ignore one hit per room).

**H3 — The Echo in the Bell** · Z7 Ravine (r9) · 3 · [PLANNED]
- Trigger: hook 3 anchors in order (tutorial lamp hints).
- Attacks: reverses your last attack direction.
- Reward: Echo Anchor (anchors pull you 1 tile further).

**H4 — The Unheard Chorister** · Z9 Choir of Salt · 4 · [PLANNED]
- Trigger: use Lantern pulse in a dark room with no enemies.
- Attacks: silent (no audio); visual cues only.
- Reward: Silent Lantern (charm: pulse range +1).

**H5 — Milo's Shadow** · Z12 (optional, after Crown) · 4 · [PLANNED]
- Trigger: equip 3 charms.
- Attacks: uses your abilities; same moves as you.
- Reward: Shadow Cloak (dash skin + i-frames +1).

**H6 — Kiln Hermit** · Z8 Veil Marsh · 2 · [PLANNED]
- Trigger: give 50 Geo to a kiln.
- Attacks: heat waves (wave tells).
- Reward: Kiln Coin (+10% Geo drop).

### 5.4 Rematches and evolved forms (V)

**V1 — Warden, Shelled** · Z6 · 4 · [PLANNED] — phase 3 with faster rain; enter via a Crown door.
**V2 — Ribkeeper, Unbound** · Z4 · 4 · [PLANNED] — bone-hook throws; wall-dash chain.
**V3 — Matron, Storm Form** · Z5 · 4 · [PLANNED] — wind arena; gusts cover the room.
**V4 — Tollkeeper, Double Bell** · Z7 · 4 · [PLANNED] — two anchors; hook-to-hook duel.
**V5 — Mother of Caps, Blooming** · Z2 · 3 · [PLANNED] — spore flood; flooding fills lanes.
**V6 — Choir Reprise** · Z9 · 4 · [PLANNED] — no beat: random timing; accessibility toggle restores beat.

### 5.5 Endgame (E)

**E1 — The Unlit Crown** · Z12 · 5 · [PLANNED] — 3 phases: the crown orbits; lights switch off in phase 2 (Lantern pulse is the only light); phase 3 combines all earlier attacks at 2× speed with a 10 s rest.
**E2 — Milo, Reflected** · Z12 · 5 · [PLANNED] — uses your ability set against you (dash, claw, wing, sink, hook, lantern).
**E3 — Gauntlet of Lanterns** · Z12 · 5 · [PLANNED] — sequential mini-fights (one of each R boss move) in one arena; timed challenge.
**E4 — The Last Lantern** · Z12 · 5 · [PLANNED] — true final boss; optional, requires all 3 lanterns.

Count: R 7 · O 9 · H 6 · V 6 · E 4 = **32**.

### 5.6 Boss design rules
- Each boss has a unique mechanic set; no two bosses share the same main loop.
- Every attack has a telegraph ≥ 24 frames (0.4 s) for boss attacks, ≥ 8 frames for normal enemies.
- Rewards are balanced: required bosses give progression or charm slots; optional/hidden give cosmetic or small upgrades; none grants an ability needed for a required route.
- Phase transitions are announced (flash only if flashing is allowed; always a sound + banner).
- Retry: death returns to the bench within 80 frames; the boss room resets on rest. [STAGE 1 adds an optional "reduced downtime" setting: the death fade is shortened to 40 frames.]

---

## 6. Gameplay, art, VFX, audio, UI, accessibility plan

### 6.1 Gameplay
- Keep existing physics, values and controls. Add: Lantern Sight (R), Bell Hook (G), Sinking Weight (↓ + Jump in air).
- Touch: add buttons for Lantern (✺) and Hook (⟲) and Heal (♥). Touch layout stays compact.
- Enemy telegraph: a 24-frame window before any boss attack and an 8-frame window before enemy attacks.
- Hitbox and collision: existing; verified by tests (see §8).

### 6.2 Visual effects (VFX)
- **Attack:** white arc (existing) + 1-frame flash only when flashing is allowed.
- **Hit:** particle burst (existing) + hit-stop (existing, can be turned off).
- **Dodge (dash):** ghost rectangle (existing).
- **Landing:** dust puff (existing); Sinking Weight adds a shockwave ring.
- **Healing:** rising ring (existing).
- **Ability:** gold ring expansion + glyph (Stage 1 for unlock; Stage 2 glyph per ability).
- **Damage:** HUD pip pulse + particle burst; no full-screen flash.
- **Death:** fade to black (existing).
- **Boss phase:** banner + low rumble + short ring; flash only if allowed.
- **Telegraph:** dashed outline/line, `!` marker above boss (assist on by default).
- **Seal dissolve:** stone block crumbles into motes (Stage 2).

### 6.3 Audio
- **SFX (Stage 1):** procedural WebAudio — jump, land, dash, swing, hit, hurt, heal, pickup, unlock chime, bench rest, boss telegraph tick, boss phase rumble, death. All synthesized (no asset files), so offline caching stays small.
- **Ambient:** existing Scenery layer (wind/drone/echoes) per zone.
- **Levels:** Master (on/off, existing Sound toggle), SFX volume (0–100), Music/ambience volume (0–100, existing Music toggle + slider).
- **Music direction (planned):** each zone gets a 2-note motif on the root of Scenery's `THEMES` drone; bosses add a rhythm layer. Music is not motion-related, so the reduced-motion options do not affect it.

### 6.4 UI
- Settings → **Descent** section (new): Screen shake, Flashing effects, Hit-stop, Telegraph assist, Reduced downtime, SFX volume, Ambient volume.
- Pause menu → **Options** button opens the same controls.
- Map: seal glyphs [Stage 2], unclaimed-ability ring [Stage 2].

### 6.5 Accessibility
| Option | Default | Effect |
|---|---|---|
| Screen shake | Low | Off / Low (50%) / Full |
| Flashing effects | On | Off removes rest flash, boss-phase flash, unlock flash |
| Hit-stop | On | Off removes freeze frames on hits |
| Telegraph assist | On | Adds `!` markers and dashed danger shapes |
| Reduced downtime | Off | Death fade 40 frames instead of 80 |
| SFX volume | 100 | 0–100 |
| Ambient volume | 100 | 0–100 |
| Sound on/off | On | Existing Sound toggle now applies to the Descent |

Plus: no colour-only information (shapes and icons carry danger and item meaning), and visible focus outlines for menu buttons (existing `button:focus-visible`).

---

## 7. Staged implementation plan

Each stage ends with a passing `node tests/metro.test.js`, a commit, and a push to `arena/b571fec1-gamenidan`.

| Stage | Scope | Files | Status |
|---|---|---|---|
| 0 | This design plan | `docs/DESIGN.md`, `README.md` (link) | this turn |
| 1 | Descent options (shake, flash, hit-stop, telegraph assist, reduced downtime, SFX and ambient volume), SFX + unlock feedback, touch Heal button, Settings and Pause UI — **done** (commit `a82ebe9`) | new `js/metroFx.js`; `js/metroid.js`; `index.html`; `sw.js`; `tests/metro.test.js` | this turn |
| 2 | Lantern Sight (R), Sinking Weight, Bell Hook (G), seal gates, brittle floor, Bellwork Ravine r8–r10, map glyphs, save keys, tests — **done** (commit `f04349b`) | `js/metroid.js`; `tests/metro.test.js`; README | done |
| 3 | Boss framework refactor (`BOSSES` table with step/phase hooks), Tollkeeper (R4), telegraph shapes | `js/metroid.js`; tests | next |
| 4 | Remaining Z2/Z3/Z4/Z5/Z8 bosses and rooms; Ribkeeper, Matron, Mirror Wick | `js/metroid.js` | later |
| 5 | Zones Z9–Z11, water/fire/beat mechanics | `js/metroid.js`, `js/metroFx.js` | later |
| 6 | Endgame Z12, final bosses, credits, balance pass | all | later |
| 7 | Performance + polish pass; mobile test | all | later |

Files and systems that change:
- `js/metroid.js` — `ROOMS` data, `ensure()` save normalisation, physics (`solid`, one-way, brittle), player abilities, boss step, render, HUD, input keys, touch buttons, panels.
- `js/metroFx.js` — new: settings normalisation, SFX synth, feedback helpers.
- `js/scenery.js` — ambient volume multiplier (`setVolume`).
- `js/game.js` — `toggleSetting` untouched; `defaultSave.settings` untouched; Descent settings stored under `settings.descent`.
- `index.html` — Descent settings rows; script tag for `metroFx.js`; touch layout unchanged in HTML.
- `style.css` — minimal rules for new rows (reuses `.setting-row`, `.toggle-button`).
- `sw.js` — cache list + version bump.
- `tests/metro.test.js` — new tests.
- `README.md` — controls, abilities, new settings.

---

## 8. Testing checklist

### 8.1 Automated (`node tests/metro.test.js`)
- Room data: exits symmetrical, items/enemies/benches not inside walls, unique item ids (existing).
- Seal gates: each seal is solid without its ability and removed with it; seal glyph types are one per ability.
- Lantern Sight: Lumen platform appears under Milo, catches a fall, expires after 3 s, is removed on room change.
- Sinking Weight: dive shockwave damages enemies within 2 tiles; brittle tiles break and persist.
- Bell Hook: fires along the aim line, latches to an anchor, releases on jump, does not latch through walls.
- Descent options: defaults are applied; corrupt values fall back to defaults; settings survive `normalize`.
- Progression: Ravine is unreachable without Lantern Sight; the r9 path is unreachable without Sinking Weight; Hidden Loft is reachable at start.
- Combat: existing boss test still passes; telegraph flags are set before each boss attack.
- Fuzz: all rooms with random input, no NaN or exceptions (existing; extended to new rooms).
- Readability: no decoration overlaps a seal, bench, anchor, or hazard tile (foreground placement is static, so this is checked on data).

### 8.2 Manual checklist (browser)
- Movement: coyote jump, variable jump height, wall slide/jump, dash i-frames, double jump, pogo.
- New: Lantern pulse creates a platform, Sinking Weight dive and shockwave, Bell Hook latch and release.
- Combat: hit-stop on/off, screen shake off/low/full, flash off removes the rest flash, damage feedback audible.
- Boss (Warden): telegraph markers visible in both assist modes; phase 2 at 50% announced.
- Saving: rest, quit to Home, reload → abilities, seals, broken walls and charms persist. Sign in on another device → same progress.
- Settings: Descent options persist, apply immediately in the pause menu, and sync to the cloud.
- Touch: Heal, Lantern, Hook buttons work; no stuck inputs after pointer cancel.
- Performance: about 60 fps in a room with pulses and sounds; no GC spikes from SFX (nodes are disconnected after use).
- Accessibility: keyboard focus visible on all new buttons; text readable at 1× scale.

### 8.3 Known gaps (for transparency)
- Only 1 of 32 bosses is built; only 8 + 3 rooms are built. Stages 3–7 cover the rest.
- No music tracks; SFX are synthesized, music direction is a plan.
- The README "Extend it" section describes adding rooms; the seal and zone conventions in §2.3 apply to new rooms.
