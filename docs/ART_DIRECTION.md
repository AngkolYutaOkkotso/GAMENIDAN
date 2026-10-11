# Hollow Milo — Character, Mob, Animation & Presentation Overhaul

Status legend: **[DONE]** implemented in code · **[STAGE n]** scheduled · **[PLANNED]** designed, not built.

This document is the companion to `docs/DESIGN.md` (world/content plan). This one covers
**how the game looks, moves and feels**: character design, mob design, animation, VFX,
camera/feedback, world life, UI readability and accessibility.

Everything here **preserves** the game's identity: the name *Hollow Milo*, Milo and the
Vessel roster, the moth-cap silhouette, the Geo economy, the seven realms, the Wish system,
the Hollow Descent, Old Wick, the Hollow Warden, and every existing control and mechanic.

---

## 1. Audit of the current presentation

### 1.1 Code / engine facts

| Area | Current state | Where |
|---|---|---|
| Engine | None — vanilla JS + HTML5 Canvas 2D, static site, no build step | `index.html`, `js/*.js` |
| Render order (Levels) | sky → parallax → (hazards, platforms, ladders, checkpoints, coins, enemies, projectiles, finish) → player → particles → Scenery fog/light → boss bar | `drawGame` `js/game.js:3326` |
| Render order (Descent) | sky → 2 parallax layers → cached room canvas → Lumen → bench/NPC → items/coins/enemies/telegraphs → shots → player → hook/ring → particles → Scenery → HUD | `draw` `js/metroid.js:695` |
| Sprite system | **None.** Everything is re-drawn as vector paths every frame | `js/game.js`, `js/metroid.js` |
| Animation state | Per object: `phase`, `animation`, `attackTimer`, `frozen`, `invuln` | `createEnemy` `js/game.js:1270` |
| Authoring style | One-property-per-line formatting, no comments in the big draw functions | `js/game.js` |
| Atmosphere | Fog, particles, vignette, dynamic light, procedural ambient audio | `js/scenery.js` |
| Feedback layer | Screen shake, flashes, hit-stop, telegraphs, SFX, accessibility options — **Descent only** | `js/metroFx.js` |
| Tests | 56 headless checks over the real Descent physics | `tests/metro.test.js` |

### 1.2 What looks dull, unclear, inconsistent or lifeless today

1. **All 21 mobs share one body.** `drawEnemy` (`js/game.js:4533`) renders every mob from the same
   template: a rounded rectangle body, `roundRect(5, 8, w-10, h-8, 12)`, then *one* optional
   detail (slime highlight / beetle stripe / wolf ears / thorn / crystal) and then the **same**
   two white eyes, the **same** smile arc and the **same** two feet ellipses.
   Consequence: a slime, a knight, a bat and a golem read as the same creature recoloured.
   Silhouette carries no role, no threat level and no behaviour.
2. **No attack tell in Levels.** Shooting mobs fire every 120 frames with no wind-up; wolves
   jump with no crouch; contact damage is instant. The player can only learn by being hit.
3. **No hit reaction and no death.** `damageEnemy` subtracts HP, spawns 8 particles and, on
   death, removes the enemy instantly (`alive = false`). There is no flinch, no knockback,
   no death animation, no corpse — enemies pop out of existence.
4. **No feedback layer in Levels.** A grep for `shake|hitstop|flash|damageNumber` in
   `js/game.js` returns **nothing**: no screen shake, no hit-stop, no damage numbers, no
   landing dust of consequence, no sound. Browsers with the Descent options set have already
   opted into these effects, and the Levels mode ignores them entirely.
5. **Player character is a stack of rectangles.** `drawPlayer` (`js/game.js:5717`): two leg
   rects, a `roundRect` torso, a secondary-colour band, two arm rects, a head rect and an
   ellipse cap. No cloak, no lantern, no idle breathing, no blink, no jump/land squash
   beyond a 5 px leg swing. The ten Vessels differ **only** by `color`/`secondary`, so they
   are indistinct from each other and from the world.
6. **Low value contrast under the darkness pass.** `Scenery` darkens each world by
   `dark: .25 – .62` *over* everything. Mobs painted in the world's own hue
   (beetle `#473d63`, knight `#59616e`, darkMushroom `#733d67`, Descent crawler `#2a2f3d`
   on a `#141a25` shadow) sit within a few percent of the background value and vanish.
   There is no rim light, no outline and no accent colour rule.
7. **Nothing in the world moves except the parallax and the player.** Platforms are two
   rectangles plus a dashed "grass" row; ladders are two lines; coins bob; the checkpoint is
   a static rect. No grass sway, no drips, no motes, no torch flicker, no reacting props.
8. **Descent characters are placeholders.** Milo in the Descent is a 16×12 rect, a face rect
   and two 3×5 eye rects: no cap, no lantern, no arms, no legs — it does not match the
   moth-capped Vessel in the Levels mode or the `#milo-glyph` in the login art.
   Bench and Old Wick are single rectangles.
9. **No unified style rules.** Outline weight, shading, rim light, glow radius and particle
   behaviour are decided ad-hoc per function (or not at all). Coins, hearts, seals and
   telegraphs each use a different language.
10. **UI/HUD is thin.** HUD is three pills and a health bar; there is no low-health state,
    no resource/cooldown indication for the special, no enemy threat hint, no damage numbers.
11. **Dead flag.** `forestSpirit` is created with `floating = true` (`js/game.js:1331`) but
    nothing ever reads `floating` — the "floating spirit" walks on the ground.
12. **Ground mobs float.** `createEnemy` puts every mob at `y = 460` whatever its height
    (`js/game.js:1275`), so a 46 px mob's feet are drawn 14 px above the ground line while a
    60 px golem's touch it. Bosses are worse: `createBoss` spawns them at `y = 360`, up to
    60 px in the air. The hitbox and the drawing disagree for most mobs.

### 1.3 What is worth preserving exactly

- The moth-cap + cloak identity of Milo and the 10-Vessel roster with their existing colours.
- Every control, hitbox, speed, cooldown, HP value, Geo reward and level layout.
- `save` schema, cloud sync, Wish/gacha, loading + login art direction (Cinzel, soul motes,
  moon, lantern staff — this art is already good).
- `Scenery` fog/light/audio and `MetroFx` options + SFX (they are the accessibility spine).
- The Descent's shape-coded seals, telegraph `!` markers, Lumen platforms and brittle stone.
- The dark, quiet, Hollow-Knight-adjacent mood. No comic-book saturation, no rewritten story.

---

## 2. Preserve / improve / replace list

| Keep as-is (do not touch) | Improve (same thing, better) | Replace (art only, same role) |
|---|---|---|
| Story, names, worlds, level layout, boss names | Parallax backgrounds (add depth bands + light shafts) | `drawEnemy` body template → role-based silhouette families |
| All controls, physics, speed & damage numbers | Platforms (edge highlight, material motif, sway props) | `drawPlayer` (Levels) → shared Vessel renderer with lantern |
| Save format, Geo economy, Wish system | Ladders (wood, rope, rungs, creak) | Descent Milo rect → the same shared Vessel renderer |
| Bench/rest/Soul/Mask/charm systems | Coins (spin, glow, pickup sparkle) | Descent crawler/flyer/spitter → same mob families |
| Ability set and gates | Checkpoints (beacon, activation burst) | Bench (Descent) → brass bench + lantern post |
| `Scenery` themes and audio | HUD (states, pulse, cooldown ring) | Old Wick rect → hooded keeper with a lantern |
| MetroFx options + all SFX names | Particles (per-material colour, easing) | Descent enemy death (instant) → fade + burst |
| Descent room data and seals | UI cards/buttons (focus, press, transitions) | — |

---

## 3. Art direction: one world, one look

### 3.1 Visual pillars

1. **Lamp in the dark.** Every zone is dark; Milo is the only warm light. Anything that
   matters must read by **silhouette + rim light**, not by hue alone.
2. **Worn, not ruined.** Materials show repairs: stitched cloak, brass patches, chipped
   shell, rusted bells. Decay is deliberate and repeated, never random noise.
3. **Silhouette first, colour second.** Role is carried by shape (rounded = weak/passive,
   angular = dangerous, bulky = tanky, spiked/large = boss). Colour only reinforces it.
4. **A breathing world.** The background moves slowly and continuously (sway, drift, flicker).
   The foreground flashes briefly and rarely, and can be turned off.
5. **Quiet palette, loud moments.** 90 % of the screen lives in 5 desaturated zone tones;
   warm gold is reserved for Milo, rewards and lantern light; coral red is reserved for danger.

### 3.2 Core palette (locked, used by every system)

| Token | Hex | Meaning / use |
|---|---|---|
| Lamplight gold | `#f2b84b` | Milo's lantern, ability items, rewards, checkpoints, seal glyphs |
| Warm rim | `#ffd9a8` | 2 px rim light on the lantern side of characters |
| Hollow white | `#e8edf3` | Text, UI frames, enemy eyes, "clean" stone |
| Soul blue | `#8fc1e3` | Soul, Geo pips, altar light, Descent shot projectiles |
| Danger coral | `#ff6b6b` | Hazards **and** enemy attacks, always with a shape cue |
| Enemy eye | `#ffe9c9` (calm) / `#ff8a6b` (aware/attacking) | Mob awareness state |
| Outline ink | `#0b0e16` | 2 px outline on every character and mob |
| Shadow | `rgba(0,0,0,.28)` | Contact shadow ellipse under grounded things |

Zone colours stay exactly as in `worlds` (`js/game.js:198`) and `THEMES`
(`js/scenery.js:15`); they are the backdrop, not the character palette.

### 3.3 Rules of the look

| Rule | Value |
|---|---|
| Outline | 2 px ink outline on player, mobs, NPCs, bosses. 1 px on props and item sparkles. Environment tiles get **no** outline (they are the wall). |
| Shading | Two-tone only: base colour + one darker band (bottom/back) + one lighter band (top/front). No gradients on characters. |
| Rim light | A single 2 px warm-rim stroke on the lantern-facing side of every character and mob. This is what survives the darkness pass. |
| Texture level | Nothing finer than 3 px. Details must survive at 1× on a 1280×720 viewport. |
| Background contrast | Background layer contrast is capped at ~55 % of the foreground so characters always win. Distant shapes are flat silhouettes. |
| Particles | Square 2–6 px motes, 0.9–1.1 px/frame drift, alpha tied to remaining life. Colour comes from the zone theme, never from `Math.random()` hue. |
| Glow | Only three glow tiers: item (16 px), lantern/attack (12 px), telegraph (8 px). `shadowBlur` is banned in the frame loop; pre-rendered glow sprites are blitted instead. |
| Animation timing | Anticipation ≥ 8 frames for mobs, ≥ 24 for bosses; active frames 2–4; recovery 4–8. Idle cycles 40–80 frames. Easing is sine in/out for scale, linear for position. |
| Performance | Every static drawing is pre-rendered once into an offscreen canvas and blitted. Per-frame path count per entity ≤ 8. |

### 3.4 Element language

| Element | Rule |
|---|---|
| Player | Wide moth cap, teardrop cloak, forward lantern. Warm gold + one hero hue. |
| Friendly (NPC, bench) | Warm, rounded, always carries a light source. Brass + cream + gold. |
| Enemies | Cold, desaturated bodies with one warm eye colour. Angular as threat rises. |
| Bosses | Same language as mobs, but 2× scale, one signature silhouette element and a phase-2 colour shift (coral). |
| Collectibles | Diamond Geo (soul blue) / ability (gold + ring) / charm (violet) / heart (rose). 1 px outline, 16 px glow, 4 px bob. |
| Hazards | Always shape-coded: spike = triangle rows, pit = hazard stripe band, projectile = teardrop with trail. Never colour-only. |
| Interactables | Bench = brass rail + lantern post; door/seal = glyph + dashed frame. |
| UI | Cinzel for titles (already loaded), system sans for numbers. Cards have a 1 px `#e8edf3`@12 % edge, gold 2 px focus ring. Pills pulse on change. |

---

## 4. Player character redesign — "Milo, the Lantern Vessel"

### 4.1 Concept

A small, hopeful light-bearer: a **moth-capped vessel** who walks into the dark on purpose.
Reads as *fragile but determined* — big round cap (curiosity), tapered cloak (motion),
lantern held forward (role: carrier of light, the only bright thing on screen).

### 4.2 Silhouette (black-fill test)

Filled solid black, the shape must still be identifiable:

```
        \|/            <- 2 feather antennae, tips angled outward (unique to Milo)
     .-~~~-.           <- wide moth cap (width 30 px, i.e. 1.4x body width) with a front brim notch
    (  o_o  )          <- cap overhangs the face: no full head, cap = head
     \  |  /           <- shoulder mantle, one shoulder forward
      |==|==|          <- elbow-out arm holding the lantern FORWARD (facing cue)
      /    \           <- lantern hangs 6 px ahead of the feet line
     | cloak |         <- teardrop cloak, hem splits into 2 notches
      \_/\_/           <- two stubby boots
```

Signature black-fill cues, in priority order: **(1) the forward lantern, (2) the wide cap with
antennae, (3) the teardrop cloak with a split hem.** These three are never occluded by effects.

### 4.3 Proportions

| Part | Size (44×64 hitbox) |
|---|---|
| Cap (ellipse) | 34 × 18 px, centred, 4 px overhang each side |
| Antennae | 2 strokes, 10–14 px, tips 8 px apart, sway with velocity |
| Mantle + torso | 26 × 20 px |
| Cloak | 30 px wide at hem, tapers from 22 px, 26 px tall |
| Legs/boots | 8 × 12 px each, 10 px stride |
| Lantern | 10 × 13 px body + 5 px frame + 6 px flame, 8 px glow |
| Held arm | Elbow out, hand at lantern cord |

### 4.4 Palette

| Slot | Colour | Hex |
|---|---|---|
| Cap + cloak outer | hero colour (`heroes[].color`) — Milo `#d94f65` | preserved per Vessel |
| Cloak inner / hood / hem band | hero secondary (`heroes[].secondary`) — Milo `#8f2940` | preserved per Vessel |
| Face / hands | warm cream | `#f2d3ab` |
| Eyes | ink | `#25263a` |
| Lantern frame | brass | `#c9a35a` |
| Flame + glow | lamplight gold | `#f2b84b` → `#ffd9a8` |
| Rim light | warm rim on facing side | `#ffd9a8` @ 55 % |
| Outline | ink | `#0b0e16` |

Contrast checks: hero hue vs. every world ground (`#1d232b`, `#1a2a1f`, `#272a45`, `#38424f`,
`#21130f`, `#5a7384`, `#15131d`) — all ≥ 3:1 against the cloak; the lantern and rim guarantee
separation even in the darkest zone (`#15131d` Hollow Castle). Against hazards (coral) the
player is separated by hue **and** by the gold lantern.

### 4.5 Facing readability

Five independent cues so a 12 px/frame dash cannot hide the direction:
1. The lantern (and its glow) is always 8 px ahead of the body.
2. The cap brim dips 3 px forward and the antennae trail 2 px back.
3. The cloak tail lags behind (up to 6 px) and is drawn *before* the body.
4. One boot is 2 px ahead of the other, the trailing boot lifts.
5. The eyes sit 2 px toward the facing side; the sheet-light rim is on the facing side.

### 4.6 Small memorable details (5, no more)

1. Ladder-stitch on the hem of the cloak (3 short vertical ticks).
2. A tiny brass bell at the cloak clasp — a nod to Bellwork Ravine.
3. A pale patch on the cap's left, so the cap is asymmetric (reads when mirrored).
4. A stub of a candle-wick (2 px) on the lantern hood, always flickering.
5. A thin cord from the hand to the lantern, so the lantern reads as *carried*.

### 4.7 Animation plan

| State | Frames | Description |
|---|---|---|
| idle | 64 (loop) | 2 px breath lift, cap sways 1 px, lantern swings 1.5 px, antennae drift, blink at frame 40 (2 frames) |
| walk | 16 (loop) | 2-frame leg cycle, ±3 px stride, 1 px body bob, cloak hem sway, arm counterswing |
| run/dash | 12 (loop) | 6° forward lean, cloak trails to −6 px, lantern swings up, cap brim compresses |
| jump | 10 | 3 frames anticipation crouch (squash 0.88), stretch 1.12 on take-off, boots tuck |
| fall | loop | arms up, cloak flares, lantern trails upward |
| land | 6 | squash to 0.84 for 2 frames, dust puff ring, cloak settles 4 frames |
| attack | 10 | 3 frames anticipation (arm back, cap back), 2 active (white arc + gold spark), 5 recovery |
| hurt | 12 | 2-frame white flash, 4 px recoil, cloak flutters, HUD pip pulses |
| heal | hold | rising gold ring, lantern brighter, warm rim doubles |
| death | 40 | cap tips off, cloak goes dark, mote burst, fade |
| rest (bench) | loop | sits, lantern set on the floor, glow breathes |

Animations are **procedural** (driven by `walkPhase`, `vy`, `attackTimer`, `invuln`) rather than
frame-sheeted, so timing stays consistent and no new asset files are needed.

### 4.8 Scale test (required)

At 44×64 px on a 1280×720 viewport the character is ~6 % of the screen height. Test protocol:
1. Fill the silhouette solid black against each of the 7 world grounds and both Descent tiles.
2. Run on the darkest zone (Hollow Castle `#15131d`) and the brightest (Pale Peaks `#b9ccd6`).
3. Confirm: lantern glow visible, cap outline unbroken, facing direction readable at 12 px/frame.
4. Reduce the design (drop details 1, 4, 5) rather than enlarge the character if clarity fails —
   the hitbox is never changed. → Implemented as `Art.drawVessel` with a `simple` quality flag.

---

## 5. Mob redesign plan

### 5.1 Roles and silhouette families

| Family | Shape | Used by |
|---|---|---|
| `dome` | low rounded dome, soft, wide base | slime, lavaSlime, mushling, darkMushroom (cap variant) |
| `shell` | angular low carapace, 6 stubby legs | beetle, rockCrawler, crystalBug |
| `beast` | long quadruped, pointed muzzle, ears | wolf, iceWolf |
| `brute` | hunched bulk, big shoulders, small head | magmaBeast, iceGolem |
| `wing` | wide thin wings, small body, sharp tail | bat, fireBat, frostBat, stormBird, cloudSpirit |
| `eye` | one huge eye + lashes + drifting orbs | skyEye, forestSpirit |
| `turret` | rooted stalk + pod, no legs | thorn, magicGuardian |
| `sentry` | upright humanoid, helm, tall | knight |
| Descent `dome`, `wing`, `turret` | as above, tuned to 26/24 px | crawler, flyer, spitter |
| `warden` | tall helm with horns, iron slabs | Hollow Warden (boss) |

Every family has a distinct **height:width ratio** and **leg count** so no two read alike:
dome 0.55, shell 0.45, beast 0.75, brute 1.0, wing 0.55 (airborne), eye 0.9, turret 1.3,
sentry 1.45, brute/boss 1.6.

### 5.2 Per-mob plan

Legend: **Role** · **Silhouette** · **Tell** (pre-attack cue) · **Animations** (idle / move / attack / hit / death).

**Zone 1 — Forgotten Crossroads (ash-blue `#1d232b`)**
| Mob | Role | Silhouette | Tell | Animations |
|---|---|---|---|---|
| `slime` | melee, weak | low dome, translucent, bigger in front | squash before hop (8 f) | breathe-pulse / hop-squash / hop / flatten / melt into goo |
| `beetle` | melee, armoured | angular shell, 6 legs, split wing-case | legs splay + shell glints (8 f) | antenna twitch / scuttle / shell-bash lunge / shell crack / legs curl |
| `mushling` | melee, area | tall stalk + wide cap, spore puff | cap tilts back, spores gather (10 f) | cap sway / waddle / spore burst / cap wobble / cap deflates |

**Zone 2 — Mossy Greenpath (green `#1a2a1f`)**
| Mob | Role | Silhouette | Tell | Animations |
|---|---|---|---|---|
| `wolf` | fast melee | long quadruped, 4 legs, pointed ears, tail | crouch + haunch load (10 f) | ear flick / run 4-leg cycle / pounce (jump) / yelp stagger / collapse |
| `thorn` | ranged turret | rooted stalk, thorn pod barrel aimed at the player | pod petals open + glow (14 f) | sway + close petals / lean aim / spit volley / stem recoil / wilt |
| `forestSpirit` | support, floaty | hovering wisp with 2 drifting motes, no legs | motes converge (12 f) | bob + mote orbit / drift / mote scatter / flicker / mote fade |

**Zone 3 — Crystal Depths (violet `#272a45`)**
| Mob | Role | Silhouette | Tell | Animations |
|---|---|---|---|---|
| `bat` | flying melee | wide thin wings, small body, sharp tail | wings fold back (8 f) | wing flap (variable rate) / glide / dive / tumble / spiral fall |
| `rockCrawler` | tank melee | blocky boulder shell, 6 stubby legs, low | leans back, cracks glow (12 f) | slow breath / heavy walk / boulder roll / chip stagger / crumble |
| `crystalBug` | fast melee | faceted low body + crystal prism on the back | prism flares white (8 f) | prism glint / quick scuttle / charge / prism shatter / fade |

**Zone 4 — City of Rain (slate `#38424f`)**
| Mob | Role | Silhouette | Tell | Animations |
|---|---|---|---|---|
| `cloudSpirit` | flying, calm | soft wide puff with a drooping tail | gathers raindrops (12 f) | breathe + drift / slow float / rain burst / disperse / thin out |
| `stormBird` | fast flying | swept arrow wings, forked tail | wings sweep back + arc (10 f) | soar / fast flap / dive-bomb / tumbling feathers / dive out |
| `skyEye` | flying ranged | one huge eye, lashes, floating rings | pupil narrows, ring charges (16 f) | blink + ring spin / hover drift / eye beam shot / blink shut / eye closes |

**Zone 5 — Ashen Basin (ember `#21130f`)**
| Mob | Role | Silhouette | Tell | Animations |
|---|---|---|---|---|
| `lavaSlime` | melee, hazard | dome with glowing seams, drips | seams brighten, dome swells (10 f) | bubble + glow pulse / ooze / splash lunge / splatter / cool to crust |
| `fireBat` | flying, aggro | bat + ember trail | wings flare, embers brighten (8 f) | flap + ember drift / swoop / dive / ember scatter / burn out |
| `magmaBeast` | tank brute | hunched bulk, molten back seams, small head | hunches, seams glow (16 f) | heavy breath + drip / stomp walk / chest-slam shockwave / stagger / slump and cool |

**Zone 6 — Pale Peaks (ice `#5a7384`)**
| Mob | Role | Silhouette | Tell | Animations |
|---|---|---|---|---|
| `iceWolf` | fast melee | wolf + jagged ice spines | spines frost-flash (10 f) | frost breath / run / frost pounce / frostbite yelp / shatter |
| `frostBat` | flying | bat with icicle fringes | fringe glints (8 f) | flap / swoop / dive / icicle spray / melt |
| `iceGolem` | tank | tall blocky humanoid, ice shard crown | crown shines, arms raise (16 f) | slow breath + frost aura / heavy walk / double slam / crack + stagger / shatter to ice |

**Zone 7 — Hollow Castle (near-black `#15131d`)**
| Mob | Role | Silhouette | Tell | Animations |
|---|---|---|---|---|
| `darkMushroom` | ambush melee | tall stalk + hooded cap that opens like a maw | cap opens + eye lights (14 f) | sway + spores / slow stalk walk / cap lunge / cap recoil / cap closes |
| `knight` | tank/elite melee | upright helm with a plume, tall shield, straight sword | shield raises, plume snaps (14 f) | plume + cape sway / measured step / shield bash / helm dent + stagger / kneel then fall |
| `magicGuardian` | ranged caster | hooded robe + 3 floating rune orbs | orbs align + robe brightens (18 f) | orb orbit / robe drift / rune volley / robe flare / robe collapses empty |

**Descent (Metroidvania)**
| Mob | Role | Silhouette | Tell | Animations |
|---|---|---|---|---|
| `crawler` | melee | 26×20 low dome, 2 legs, 1 pale eye-band | hunches + eye brightens (24 f wind state) | ripple breath / waddle / lunge / flip-over flash / shell pop |
| `flyer` | flying melee | 24×20 wide wings, teardrop body | wings snap back (12 f) | flap (rate from height) / glide / dive swoop / spin / tumble down |
| `spitter` | ranged | tall stalk, glowing sac aimed at Milo | sac swells + glows (20 f) | sac pulse / hop-aim / spit arc / sac deflates / sac bursts |
| `warden` | boss | already good: tall helm + horns | existing `!` + dashed charge line / slam ring → keep, add eye trail + crack lines | idle breath / walk / charge / slam / phase-2 crack pulse / death kneel |

### 5.3 Boss plan (Levels, 7 existing bosses)

Bosses keep their names, HP, attack scripts and arenas. Art changes only:
1. **Silhouette scaling rule** — 2× mob scale, one signature element each (Guardian: stone antlers;
   Beast: root mane; Golem: crystal core; Dragon: storm wings; Lord: magma seams; Titan: ice crown;
   King: mushroom crown).
2. **Phase shift** — at 50 % HP the accent colour shifts to coral `#ff6b6b` and crack lines appear
   (already done for the Descent Warden; extended to Levels bosses).
3. **Attack tell** — 24-frame telegraph: body glow, ground shadow mark under the strike area,
   plus the existing `MetroFx` telegraph layer if the player enabled assist.
4. **Animations** — idle (breath + weight shift), walk (heavy, off-beat), attack (wind-up, 
   strike, recovery), hit (0.08 s flash + 4 px pushback + 6-frame hit-stop), death (3 s: kneel,
   cracking, collapse, mote burst, Geo burst).

### 5.4 Anti-confusion check (one second test)

For each pair of mobs sharing a zone, the silhouettes differ in **at least two** of: family,
leg count, height:width ratio, motion pattern, colour family. Verified pairs:
slime/beetle (dome vs shell), beetle/mushling (legs vs stalk), wolf/thorn (quadruped vs rooted),
thorn/forestSpirit (grounded vs hovering, 1.3 vs 0.9 ratio), bat/rockCrawler (air vs ground),
crystalBug/rockCrawler (fast 0.45-low vs slow 0.6 with boulder), cloudSpirit/stormBird
(round wide vs swept arrow), skyEye/cloudSpirit (single eye vs puff), lavaSlime/magmaBeast
(dome vs bulk), iceWolf/iceGolem (beast vs brute), darkMushroom/knight (stalk vs humanoid),
knight/magicGuardian (plume+shield vs hooded+orbs).

---

## 6. World-life and atmosphere plan

Goal: the world breathes, but nothing ever competes with gameplay readability.

| Layer | What moves | Budget |
|---|---|---|
| Far parallax | existing silhouettes + 2 new depth bands per world, 0.15× and 0.3× | 3 layers, static shapes |
| Mid parallax | existing landmarks, now with slow vertical breathing (±2 px, 240 f) | free (offset math) |
| Ground line | per-platform **sway props**: grass tufts (meadow/forest), ash reeds (basin), icicles (peaks), rope + pegs (city), rib shards (castle) | ≤ 24 props/level, cached sprites |
| Foreground | `Scenery` fog + particles (unchanged) + light shafts in 2–3 spots | 4 shafts max |
| Props | torches/lamps flicker (3-frame rhythm), chains creak-sway, hanging bells swing | props only |
| Reactivity | enemies "notice" Milo (eye brightens + 1 px lean) inside 320 px; coins/hazard/checkpoint pulse when the player is near; checkpoint beacon ignites with a gold burst on activation; dust rings on landings | event-driven |
| Descent zones | drifting motes per theme, hanging bell ropes in Ravine, drips in The Climb, spore puffs in Fungal, dust in the Chasm | ≤ 3 emitters/room, cached |

Readability rules (enforced): props never render above the feet line of a mob, never overlap a
seal, bench, checkpoint, hazard or attack telegraph, and never exceed 45 % alpha in the top
2 tiles of a Descent room or above the ground band of a Level.

---

## 7. VFX, sound, camera and feedback plan

All effects are **gated** by `MetroFx` options (screen shake / flashing / hit-stop), which are
now respected by the Levels mode too.

| Event | VFX | Camera | Sound |
|---|---|---|---|
| Jump | 3 dust motes, 3-frame stretch | none | `jump` |
| Land | dust ring (6 px, elliptical), squash | 1 px dip, big fall = 2 px | `land` |
| Dash | 3 ghost frames + trailing streak | 1.5 px | `dash` |
| Swing | white arc (2 frames) + gold sparks | none | `swing` |
| Hit enemy | 0.08 s white flash, 8 sparks, **damage number**, knockback 3 px | hit-stop 3, shake 2 | `hit` |
| Kill enemy | 14 sparks + coloured burst + 6-frame shrink-away | hit-stop 5, shake 3 | `kill` |
| Take damage | red vignette 12 frames, HUD pip pulse, 6 px recoil, hazard flash | hit-stop 4, shake 4 | `hurt` |
| Heal tick | rising gold ring + 3 hearts | none | `heal` |
| Coin | spin + 4 px bob + sparkle burst, "+Geo" number | none | `pickup` |
| Checkpoint | beacon ignites, gold ring expand, torch flare | shake 2 | `unlock` |
| Ability/special | hero-coloured ring + ring-flash per hero | shake 3 | `unlock` |
| Boss attack tell | ground mark + body glow + eye trail | none | `tell` |
| Boss phase 2 | 12-frame ring + banner | shake 5, flash if allowed | `phase` |
| Death | desaturate + slow fade, lantern dims to nothing | none | `death` |
| Boss death | double mote burst, slow-motion 30 frames | shake 6 | `bigdeath` |

Accessibility: screen shake Off/Low/Full, flashing Off, hit-stop Off, reduced motion (already
implied by shake Off + hit-stop Off + no-flash), reduced downtime — all reachable from
Home → Settings and the Descent pause menu. Effects never delay input: hit-stop pauses the
*world* but queued input still executes on the next frame, and shake is drawn as a camera
offset only (logic untouched).

---

## 8. UI and readability plan

| Item | Change |
|---|---|
| HUD pills | wider, 1 px light edge, gold focus ring; coin count animates on gain (count-up + flash) |
| Health | pips + bar; bar pulses red and the frame shakes at 1 HP; last pip hollow |
| Special/ability | small glyph chip next to the HUD with a cooldown ring sweep (Uses `player.specialCooldown`) |
| Enemy readability | HP bar shown after the first hit only (already), now a 2 px ink-outlined bar with a bright coral fill and a white damage "chip" |
| Damage numbers | 14 px bold, ink outline, rises 22 px, fades in 40 frames, gold on crit/large hits |
| Prompts | ladder/bench/NPC prompt in one line with a key cap glyph, fades in over 8 frames |
| Menus | 8-frame fade/scale-in, `:focus-visible` gold ring everywhere, buttons play `ui` sound, disabled state is visibly dimmed |
| Settings | new "Presentation & accessibility" section (already mounted by `MetroFx.mountSettings`) documenting that the rows apply to Levels too |
| Colour-blind safety | every state has a shape/position cue: danger = red **and** spiked/dashed; low HP = pulsing **and** a hollow pip; cooldown = ring sweep **and** a dimmed glyph |

---

## 9. Staged implementation plan

| Stage | Scope | Files | Status |
|---|---|---|---|
| 1 | This audit + style guide | `docs/ART_DIRECTION.md` | [DONE] |
| 2 | **Art Kit**: palette, offline sprite cache, 8 mob families, Vessel renderer, FX state (shake/hit-stop/flash/damage numbers), ambient prop sprites | new `js/art.js` | [DONE] |
| 3 | Levels mode: player + mobs use the Art Kit; attack tells; hit/death reactions; landing dust; damage numbers; shake/hit-stop/flash via MetroFx; coin/checkpoint feedback | `js/game.js` | [DONE] |
| 4 | Descent: Milo uses the shared Vessel renderer (lantern + cap); crawler/flyer/spitter use the shared families; death/hit animations; bench + Old Wick art; per-room ambient props | `js/metroid.js` | [DONE] |
| 5 | UI/readability: HUD polish, damage numbers, ability chip, prompt fades, menu transitions, settings wording | `style.css`, `index.html`, `js/art.js` | [DONE] |
| 6 | Tests + docs: headless checks for the Art Kit and readability invariants; README/DESIGN updates; `sw.js` version bump | `tests/metro.test.js`, `README.md`, `docs/DESIGN.md`, `sw.js` | [DONE] |
| 7 | Remaining art: boss signature elements (2x scale, phase-2 coral shift, ground shadow mark), light shafts, seasonal particle sets | `js/art.js`, `js/game.js` | [PLANNED] |
| 8 | Performance pass: sprite-cache budget check on low-end mobile, DPR/quality tiers, profiler pass with 12 mobs + effects on screen | all | [PLANNED] |

Interaction with `docs/DESIGN.md` stages 3–7 (new zones, bosses, endgame): new rooms and bosses
must use the Art Kit families and the rules in §3–§5. No new asset files: all art stays procedural,
so the offline cache and the "no third-party requests" property are preserved.

---

## 10. Testing checklist

### 10.1 Automated (`node tests/metro.test.js`)

- Art Kit loads headless (`document` undefined) without throwing, and `Art.draw*` no-ops.
- The mob table covers **every** enemy type created by `createEnemy` plus the Descent mobs
  (crawler, flyer, spitter, warden) → a new mob without art fails the suite.
- Every mob has a role from the allowed set and a family that exists.
- Sprite cache keys are bounded (one entry per family/type/pose key, no unbounded growth).
- Vessel renderer: every hero id renders; unknown id falls back to Milo's palette.
- FX: `Art.FX` shake/hit-stop/flash respect `MetroFx` gates (off = zero effect).
- Existing 56 Descent checks keep passing (physics untouched by the art pass).

### 10.2 Manual (browser)

- **Readability:** in each of the 7 worlds, pause and check that the player, each mob and the
  hazards are identifiable at 1× zoom in under one second; fill test — the mob silhouettes stay
  distinct when the screen is darkened by `Scenery`.
- **Animation smoothness:** idle → walk → jump → land → attack → hurt → heal → death transitions
  with no pops; no animation blocks or delays player input.
- **Collision:** hitboxes visually match new bodies (jump on mobs, attack reach, pogo in the
  Descent, dash i-frames unchanged).
- **Combat clarity:** each mob's tell is visible before its attack; damage numbers and knockback
  match the Health changes; no effect hides a projectile or spike.
- **Feedback:** hit-stop, shake and flash each respond to their Settings rows immediately; turning
  all three off leaves the game playable and readable.
- **Performance:** ≥ 55 fps with 12 mobs + 20 particles + 2 bosses on screen; sprite cache does not
  grow after 5 minutes of play; no `shadowBlur` in the frame loop.
- **Accessibility:** every effect has an off switch; nothing signals by colour alone; menu focus
  rings visible; text readable at 1×.


---

## 11. What was built and how it was verified

### Files touched

| File | Change |
|---|---|
| `js/art.js` | **New.** Style constants and palette (§3.2), the `MOBS` role/family table, the nine silhouette families with dynamic limbs/wings, the shared `drawVessel` character renderer, `glow()` (one cached radial sprite for every light), `prop()` + nine prop kinds, and `FX` (shake, hit-stop, flash, vignette, damage numbers, rings) which reads its gates from `MetroFx`. |
| `js/game.js` | `drawEnemy` and `drawPlayer` are now thin callers of the Art Kit; mobs gained presentation state (`animT, hitFlash, windup, alert, deathT`) and ground-aligned hitboxes (`groundY`); attack tells for shooters and pouncers; per-level `props` + `drawProps`; landing dust, footsteps, squash/stretch, jump streak; hit-stop and camera shake in `updateGame`/`drawGame`; damage numbers, impact rings, damage vignette; coin, checkpoint, special and hurt feedback; HUD low-health state. |
| `js/metroid.js` | Milo now uses the shared Vessel renderer (30x40 art on the unchanged 20x30 hitbox); crawler/flyer/spitter/warden draw from the Art Kit with wind-up, stun, phase-2 and death states; enemies keep a 26-frame (Warden 110) death animation; per-room props; redrawn bench and Old Wick (both carry warm light); damage numbers and impact rings on the same FX bus. |
| `index.html` | Loads `js/art.js` before everything that draws. |
| `style.css` | HUD feedback states (`.hud-hit`, `.hud-coin`, `.hud-pip-low`) with their keyframes and a `prefers-reduced-motion` block. |
| `sw.js` | Cache list + `VERSION` bump (`hollow-milo-v9`) so an old cached page cannot half-load the new art. |
| `preview/art.html` | **New.** The art gallery / silhouette test harness. |
| `tests/levels.test.js`, `tests/metro.test.js`, `tools/fakectx.js` | Levels + Art Kit smoke tests, four new Descent art checks, and the recording canvas stub they share. |

### Verification (no browser in this environment)

```bash
node tests/metro.test.js      # 61 passed, 0 failed
node tests/levels.test.js     # 26 passed, 0 failed
node tests/art.test.js        # 18 passed, 0 failed
node tools/sheet.js           # re-renders preview/sheet-*.png
node tools/frame.js           # renders real frames into preview/frame-*.png
```

* `tests/levels.test.js` builds a fake DOM whose canvas records every call and **flags NaN
  coordinates**, starts the darkest boss level, plays 900 frames of random input through the
  real `updateGame` + `drawGame`, kills a mob by hand, and draws every one of the 21 mob types
  and all ten Vessels. It also asserts the Art Kit covers every type `createEnemy` can make,
  that every palette is valid, that families and height ratios are actually varied, that the
  FX gates really zero the effects out, that props never sit on a hazard and that the sprite
  cache does not grow while the game runs.
* `tests/metro.test.js` renders real Descent frames headlessly (room canvas included) for every
  mob in every AI state plus stun, phase 2 and death, and keeps the draw budget in check.
* `tests/art.test.js` rasterizes the real `js/art.js` with the software Canvas2D in
  `tools/raster.js` and inspects the pixels: every mob draws a silhouette of a sane
  ink/area, no two mobs of the same arena share a flat silhouette (and look-alikes from
  other arenas differ in colour), nothing sinks through the feet line, nothing is darker
  than the floor it stands on, the alert/phase-2 eye really changes the drawn sprite
  (the sprite-cache regression), the notice cue draws, Milo's facing side is heavier
  (lantern + cap) and mirrors when he turns, and the walk cycle changes the pose.
* `tools/frame.js` renders *real game frames* headlessly (same scripts, same draw order)
  and writes `preview/frame-*.png`; `DIFF=<layer> node tools/frame.js` prints how many
  pixels each layer (enemies / props / coins / hazards / player) owns and their bounding
  box, which is how visual regressions and layer collisions get caught.
* `preview/art.html` is the human check in a browser: every silhouette at gameplay scale,
  on every zone background, with the zone's darkness applied, plus the black-fill toggle.

### What the visual review found and fixed

Rendering the game's own frames (not just the gallery) exposed five real defects:

1. **The eye tell never reached the screen.** The airborne state of the eye is baked into
   the cached mob sprite while the cache key was only `mob:<type>:<w>x<h>`, so a mob that
   had already been drawn once kept its calm eyes after noticing the player. The key now
   carries the *hot* state (`:hot`), and the pixel test asserts the sprite really changes.
2. **A grey bar floated beside wide creatures.** The mob rim light was a fixed rectangle
   (`fillRect`) that only lined up with the body on mid-width mobs; it hung off bats, wolves
   and the Warden. It is now a cached, side-faded sheen sprite clipped to the body height.
3. **The beetle was a slime.** On the same screen the two shared 96 % of their silhouette.
   The beetle is now a taller, narrower, squared carapace with a shell-plate split, six
   splayed legs, feet, and swaying antennae; the test now enforces per-arena silhouette
   separation instead of a single global threshold.
4. **The Warden was the darkest thing in its own boss room** (luma 0.16 vs the knight's
   0.33). Its palette was raised and brass keeper's trim added; it now sits at 0.23 and the
   test guards boss contrast separately.
5. **Ground props clumped.** Placement now walks every column down to its first standable
   surface (skipping spikes), so decoration spreads across floors and ledges: 6 props in
   Anchor Hall instead of 2, still never on a hazard.

Also fixed while reviewing frames: the levels mob `y` is now `520 - height` (the hitbox
bottom sits exactly on the ground line the art assumes) and the Vessel's contact shadow
keeps the last ground height while airborne instead of stretching into a searchlight.

### Known limits

* Levels bosses keep their existing art (they gained hit flash, knockback, damage numbers,
  hit-stop, shake and a ground-aligned stance, but no new signature elements yet - stage 7).
* The Vessel's antennae reach ~6 px above the hitbox, as capes and antennae do in most
  platformers; no collision value was changed to accommodate the art.
* Props are decorative by construction: they are placed on real surfaces, never on spikes,
  never taller than one tile, and are drawn before items and enemies so they cannot hide them.
