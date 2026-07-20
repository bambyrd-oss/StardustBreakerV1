# FATBACK

A drunk side-scrolling beat 'em up. The street doesn't end.

**The drunker you get, the harder you hit. And the less you land.**

---

## Play

Open `index.html`. That's it — no server, no build, no install. The spritesheet is
baked into the file as base64, so it runs off a double-click, a USB stick, or GitHub
Pages identically.

Hosted, it's also an installable PWA (**Add to Home Screen**). Fullscreen is the only
place the landscape lock behaves properly, so on a phone, install it.

## Controls

| | Keyboard | Xbox | Touch |
|---|---|---|---|
| Move | `WASD` / arrows | Stick / D-pad | Left stick |
| Punch | `J` | **X** (or RB / RT) | PUNCH |
| Jump | `K` / `Space` | **A** | JUMP |
| Drink | `L` | **B** | DRINK |
| Talk / Eat | `E` | **Y** | TALK |
| Pause | `Esc` / `P` | Menu | `⏸` |

Plug in a pad and the touch controls hide themselves. Unplug and they come back.

**Mash punch** — it's a 4-hit string, not one button. **Jump then punch** is a dive attack.

## The design

Two meters that both cost you something. That's the whole game.

**DRUNK** buys crit chance. It charges you accuracy, control, and judgment.

| drunk | what it does |
|---|---|
| 0–38 | clean |
| 30–60 | **the sweet spot** — real crit, no penalty. Landing hits sobers you 0.5, so a good player *rides* this band. |
| 38+ | the lean. You physically cannot hold a straight line. |
| 55+ | punches start whiffing |
| 60+ | the tell on a woman starts lying to you |
| 78+ | stumbles |
| 22+ | the screen: saturation → ghosting → roll → slice warp → triple vision → tunnel |

**CONFIDENCE** buys damage and access to higher tiers. It charges you money and pride.

The trap: **liquid courage is the only way to reach the top tier, and it's the same
thing that ruins your ability to evaluate her.** Drunk inflates her *apparent* rating
(`shown = true + drunk/25`), so "10/10" is frequently a lie you told yourself. Talking
takes 170 ticks of standing still in a street fight — enemies do 1.5× to you and close
2.5× faster while you do it. Get knocked down in front of her and she's done with you
permanently.

**LIVER** at the burger shop is the signature upgrade. It doesn't add a number — it
widens the sweet spot from 38% of the meter to 59%.

## Build

```bash
python3 src/build.py        # pack art -> inline atlas -> index.html -> run tests
```

Needs Python 3 + Pillow, and Node for the test harness. The build **fails if the
harness fails**, which is deliberate.

```bash
node src/harness.js index.html    # tests only
```

The harness stubs the DOM, canvas, gamepad and audio, then actually *executes* the
game headless and drives it through 18 scenarios: 4000 ticks of walking, the full
combo, drinking dry, drunk at 100, fire rats, the big rat, the talk channel completing
and being interrupted, buying every upgrade, dying, and 600 frames of full render.

This exists because syntax-checking isn't testing. Every real bug in this project
shipped as a black screen first: a TDZ violation, a `const` shadowing a parameter.
The harness has since caught fire rats that could never breathe fire and burger shops
that rolled but never spawned.

## Layout

```
index.html               the game — built, single file, ~290KB
manifest.webmanifest     PWA manifest
sw.js                    service worker (offline + installability)
icon-*.png               app icons, cut from the spritesheet
src/
  game.html              source template (__ATLAS__ / __INDEX__ placeholders)
  build.py               pack + inject + test
  pack.py                spritesheet packer
  harness.js             headless test harness
  atlas.png              packed spritesheet (generated)
  atlas.json             frame index (generated)
art/
  This_character_is_5_11_._He/   player — walk, cross punch, drinking, jumping, scary walk
  This_character_is_a_6_3/       vampire enemy — walk, hurricane kick
  Smoking_a_cigarette./          bystander (crowd outside the clubs)
```

Everything under `art/` is the raw generator export, untouched. `pack.py` is the only
thing that reads it.

## Art pipeline — read this before generating more

Frames are 92×92 with **feet on row 70 and the crown on row 23**. `game.html` hardcodes
`FOOT=70, HEAD=47` and everything (ground contact, health bar placement, shadows) hangs
off those two numbers. The generator has been consistent about it across all three
characters. **If you regenerate art with different framing, re-measure and update those
constants** — this is what caused every sprite to float 16px above its own shadow for
several builds.

East-facing frames are mirrored in-engine for west. The atlas mirrors each cell *in
place*, so the flipped sheet uses identical coordinates.

### Sprite directions — how many to actually generate

**Do not generate 8 directions for a sprite that doesn't move in 8 directions.** Every
direction is a separate PixelLab generation; on the standing NPCs it was pure waste.
What the engine actually renders:

| sprite kind | directions the engine uses | generate |
|---|---|---|
| **Player / walking enemies** | east/west movement (flipped), plus south/north for facing | **`east`, `south`, `north`** — mirror east→west in-engine. 3 gens, not 8. |
| **Standing NPCs (the women)** | `south` (facing you), `south-east`/`south-west` when you're close, `north` once she's done with you | **`south`, `south-east`, `north`** — mirror south-east→south-west. Skip east/west/north-east/north-west entirely. |
| **Attack / reaction anims** | whatever facing the action reads in | usually just **`south`** or **`east`** (mirrored), one direction |

Rules of thumb:
- **Mirroring is free.** The atlas mirrors each cell in place (same coords, flipped
  sheet), so any east-facing frame gives you west for zero cost. Never generate `west`.
- **`pack.py` only packs the directions it's told to.** `NPC_DIRS` lists the 4 the
  women use; add a direction there only if `drawNPC` (or the relevant draw fn) actually
  references it.
- **Prefer `standard` mode at `n_directions=4` for standing NPCs.** `v3` *always* emits
  8 directions (3–4 generations each) whether you want them or not — reserve it for the
  hero/enemies where the extra quality earns its cost.
- **Always spell out clothing including shoes** in the character prompt. PixelLab will
  otherwise leave a sprite half-dressed.

### What's still missing

The player's combo still leans on **one** built-in attack animation (`Cross_Punch`, 6
frames, contact on frame 5) plus the south-facing punch for the hook. Four of Fatback's
real fighting animations **have been generated and are in the repo** but are **not yet
wired into the engine** (see below).

| animation | status |
|---|---|
| **Knockdown / fall** | ✅ generated — `art/This_character_is_5_11_._He/animations/knockdown/south/` (6f). Not wired; the down state still fakes it with a rotated jump frame. |
| **Hit stagger** | ✅ generated — `.../animations/hit_stagger/south/` (6f). Not wired; there's still no hit reaction. |
| **Jab** | ✅ generated — `.../animations/jab/south/` (6f). Not wired. |
| **Finger guns** (flirt/taunt) | ✅ generated — `.../animations/finger_guns/south/` (6f). Not wired. |
| Uppercut / Kick / Bottle smash | ❌ not generated yet |

**Wiring caveat:** these four came from the PixelLab re-import of Fatback
(`6e4391e0…`, built v3-from-reference off his own `south.png`) and are **south-facing,
160×160**. Combat is side-on, so `jab` wants an `east`-facing version before it fits the
combo; `knockdown` and `hit_stagger` read fine south-facing (a falling/recoiling body
has no strong facing) but still need the 160→92 reframe (crop to figure, seat feet on
row 70) that `pack.py`'s `reframe()` does for the women.

**Women:** done. 13 NPC women are wired (`w0`–`w12`) — 4 originals (dancing), 4 new
(Nova/Mei/Camila/Priya, talk + laugh), and 5 pulled from earlier generations
(Glamorous/Radiant/Elegant-Samoa/Vibrant-Latina/Sleek-Pro). They spawn in **groups**:
each woman at a door gets 0–2 companions playing talk/laugh loops, and the whole crew
turns to laugh at you when you blow it with the target.

The big rat is drawn procedurally from rectangles. It reads fine, but it's not art.

## Known issues

- Burger shops appear on 55% of chunks (~1378px mean gap), but the worst case is a
  4.6-block dry spell.
- The hook borrowing the south-facing punch sheet is a guess. One word in the `COMBO`
  table turns it off.
- Rats are procedural boxes.
- Deploying to a subpath (e.g. `user.github.io/fatback/`) works; the manifest and SW
  use relative paths.

## Credits

Character sprites generated, then packed and animated by hand. Everything else —
street, buildings, club lighting, traffic, rats, fire, UI — is drawn procedurally
in canvas.
