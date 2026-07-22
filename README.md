# BamBam: Warrior of Liberation

A 2D side-scrolling beat 'em up. The city lost its color, its culture, and its
corner stores — BamBam fights to bring them back.

**Walk the block. Clear two waves. Beat the boss. Spend what you earned. Get stronger.**

---

## Story

The city was once full of life — packed courts, corner stores that knew your
name, music on every block, art on every wall. A mysterious organization has
been buying up neighborhoods, closing local businesses, and replacing them
with identical gray developments. As the creativity disappears, so does the
color, the culture, and the hope.

BamBam becomes the Warrior of Liberation, fighting to restore imagination and
free the city from a colorless future.

## Play

Open `index.html`. That's it — no server, no build, no install. The spritesheet
is baked into the file as base64, so it runs off a double-click, a USB stick, or
GitHub Pages identically.

Hosted, it's also an installable PWA (**Add to Home Screen**). Fullscreen is the
only place the landscape lock behaves properly, so on a phone, install it.

## Controls

| | Keyboard | Xbox | Touch |
|---|---|---|---|
| Move | `WASD` / arrows | Stick / D-pad | D-pad (bottom-left) |
| Punch | `J` | **X** (or RB / RT) | PUNCH |
| Kick | `I` | **LB** | KICK |
| Shoot (hold) | `U` | **LT** | SHOOT |
| Jump | `K` / `Space` | **A** | JUMP |
| Imagination attack | `L` | **B** | IMAGINE |
| Interact / eat | `E` | **Y** | TALK |
| Pause | `Esc` / `P` | Menu | `⏸` |

Plug in a pad and the touch controls hide themselves. Unplug and they come back.

**Mash punch** — it's a 4-hit string, not one button, and the last hit launches
enemies into the air. Punches come out as fast as you press them, alternating
left and right fists. Special attacks come off direction + button:

- **Uppercut** — hold **up** and punch (`W`+`J`). BamBam crouches and launches
  straight up with a rising fist, popping enemies into the air.
- **Sprint** — **double-tap a direction** (`A` or `D`). BamBam breaks into a run.
- **Kick** on its own, feet on the ground (`I`) — a mid-range standing front kick.
- **Drop kick** — **jump, then kick** (`K` then `I`), or **attack mid-sprint**
  (`J`/`I` while sprinting). A feet-first flying kick that sends enemies flying.
- **Dive punch** — **jump, then punch** (`K` then `J`). A downward air punch.

**Shoot** — *hold* `U` (**LT** / the SHOOT button) to spray finger-gun dots. He
fires standing still with a planted point, auto-aiming the nearest enemy; walk
while firing and he moves at a slower walk instead of a run. Punch is always the
melee combo — no mode to switch. The **Imagination** special (`L`, on a full
Freedom Meter) is the finger gun's ultimate: a huge plasma beam straight ahead.

## The design

**Health** is a 4-heart bar. Attacks take either half a heart or a full heart
depending on how hard they land.

**The Freedom Meter** is BamBam's imagination. It fills as you clear out
enemies who've lost theirs to greed and control, and spending it unleashes a
huge imagination-made-literal plasma beam straight out in front of him —
long range, hits everything in its path, can turn a fight around.

**XP and Bammy Bucks** are the two currencies. XP unlocks new combo strings,
stronger attacks, movement abilities, and stat increases as you level up.
Bammy Bucks are earned from enemies and spent at the **item store** — a
storefront on the block with a flashing neon **OPEN** sign and a lit doorway.
Walk into the door and you're inside, browsing the shelves in-world: **FOOD**
(heal), an **EXTRA LIFE**, and a wall of permanent upgrades — **BIG SHOTS** and
**RAPID FIRE** for the finger guns, **BODY** (more health), **HANDS** (more
damage), **SPIRIT**/**POCKETS** (more Freedom / imagination charges), plus
speed, crit, hustle, and toughness. Browse left/right, a face button buys, jump
walks you back out. It also opens automatically between stages when you clear a
boss.

Each level is two enemy waves — the screen locks until every enemy is down —
followed by a boss fight with its own moves and a weakness to find.

## Enemies & bosses

Instead of monsters, BamBam fights ghosts corrupted by greed, power, and
control: Security Guards, Corrupt Politicians, Corporate Mascots, Robotic
Police, and other corrupted spirits.

| boss | theme | weakness |
|---|---|---|
| **Landlord D. Evict** | Greed / housing — throws eviction notices, summons security guards | Dizzy once he's exhausted his energy summoning guards and throwing notices |
| **B.I.G. Farma** | Pharmaceutical industry — throws pills and syringes, injects himself for a temporary strength boost, summons nurses | Dizzy once the power-up wears off |
| **The President** | Abuse of power — summons police and soldiers, calls in missile strikes, runs from the fight | Survive his attacks, then one punch ends it |

## Build

```bash
python3 src/build.py        # pack art -> inline atlas -> index.html -> run tests
```

Needs Python 3 + Pillow, and Node for the test harness. The build **fails if the
harness fails**, which is deliberate.

```bash
node src/harness.js index.html    # tests only
```

The harness stubs the DOM, canvas, gamepad and audio, then actually *executes*
the game headless and drives it through scenarios covering movement, the full
combo, waves, boss phases, the Freedom Meter, heart damage, XP leveling, and
the shop.

This exists because syntax-checking isn't testing. Every real bug in this
project shipped as a black screen first: a TDZ violation, a `const` shadowing
a parameter.

## Layout

```
index.html               the game — built, single file
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
art/                     raw art generator exports (see below)
```

Everything under `art/` is the raw generator export, untouched. `pack.py` is the
only thing that reads it.

## Art pipeline — read this before generating more

This project was forked from an earlier game built on the same engine.
**BamBam's hero has real drawn animation now** — six sets under
`art/BamBam{Run,Punch,Jump,Uppercut,Kick,Swag}/`, packed by `src/pack.py` into
`hero.walk/punch/jump/uppercut/kick/swag.*`. The enemy roster (Security
Guards, Corrupt Politicians, Corporate Mascots, Robotic Police) and the three
bosses (Landlord D. Evict, B.I.G. Farma, The President) still need real art —
see `.mcp.json` for the PixelLab MCP server already configured for this.

The last leftover art from the original FATBACK-engine fork —
`hydrant`/`mailbox`/`sign`/`dumpster` prop sprites — has been retired
regardless of visual quality (same reasoning as the earlier enemy-art
retirement): `src/pack.py` no longer packs them, they render procedurally
(or, for hydrant/mailbox/sign, don't spawn at all — dropped from
`genChunk()`'s street-furniture table). Source PNGs stay on disk under
`art/props/` in case they're wanted again.

Frames are 92×92 with **feet on row 70 and the crown on row 23**. `game.html`
hardcodes `FOOT=70, HEAD=47` and everything (ground contact, health bar
placement, shadows) hangs off those two numbers. **If you generate art with
different framing, re-measure and update those constants.**

East-facing frames are mirrored in-engine for west. The atlas mirrors each cell
*in place*, so the flipped sheet uses identical coordinates.

### Sprite directions — how many to actually generate

**Do not generate 8 directions for a sprite that doesn't move in 8 directions.**
Every direction is a separate PixelLab generation. What the engine actually
renders:

| sprite kind | directions the engine uses | generate |
|---|---|---|
| **Player / walking enemies** | east/west movement (flipped), plus south/north for facing | **`east`, `south`, `north`** — mirror east→west in-engine. 3 gens, not 8. |
| **Standing NPCs / shopkeepers** | `south` (facing you), `south-east`/`south-west` when close | **`south`, `south-east`** — mirror south-east→south-west. Skip east/west/north-east/north-west entirely. |
| **Attack / reaction anims** | whatever facing the action reads in | usually just **`south`** or **`east`** (mirrored), one direction |

Rules of thumb:
- **Mirroring is free.** The atlas mirrors each cell in place (same coords,
  flipped sheet), so any east-facing frame gives you west for zero cost. Never
  generate `west`.
- **`pack.py` only packs the directions it's told to.** Add a direction to its
  direction list only if the relevant draw function actually references it.
- **Prefer `standard` mode at `n_directions=4` for standing NPCs.** `v3`
  *always* emits 8 directions (3–4 generations each) whether you want them or
  not — reserve it for the hero/enemies where the extra quality earns its cost.
- **Always spell out clothing including shoes** in the character prompt.
  PixelLab will otherwise leave a sprite half-dressed.

## Credits

Character sprites generated, then packed and animated by hand. Everything
else — street, buildings, props, UI — is drawn procedurally in canvas.
