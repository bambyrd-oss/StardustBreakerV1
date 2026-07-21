# Handoff — 2026-07-20

**Live build:** https://samayiat.github.io/bambam/ (auto-deploys on push to `main` via
`.github/workflows/pages.yml`, gated by the test harness — a failing build does not ship)

**Build locally:** `python3 src/build.py` (packs `art/` into the atlas, inlines everything into
`index.html`, then runs `node src/harness.js` — the build fails if any scenario fails).

## What's done

- Hero placeholder sprite + a dedicated HUD portrait, cropped from uploaded reference art
  (`art/BamBamHero/`, `art/BamBamPortrait/`).
- Full daytime reskin: sunset sky that drifts hue with world-x (no hard seams), saturated
  tall/skinny apartment towers with cafe storefronts (coffee/matcha/smoothie names), awnings,
  stoop steps, crosswalks, and street furniture — a Scott Pilgrim commercial-strip look.
- Street enemies and crowd bystanders are placeholder silhouettes now — the old
  vampire/Darnell FATBACK art is fully unpacked (not just hidden) in `src/pack.py`.
- Street enemies are differentiated into the four named types from the spec (Security
  Guards, Corrupt Politicians, Corporate Mascots, Robotic Police) — distinct flat-color
  bodies plus a small accessory each (cap+badge, tie+gray hair, bowtie+big eyes,
  visor+antenna), see `ENEMY_PAL`/`REGULAR_TYPES` and `drawFoePlaceholder()` in
  `src/game.html`. Robotic Police is still the rarer "mixed in" unit and the only type
  with an elite dark/hovering drone form (ranged plasma) — same slot the old Darnell
  reskin used, just renamed (`e.type==='robocop'`).
- Boss-backup mobs reskinned from a walking burger to a living eviction notice
  (`drawSammich()` in `src/game.html`).
- Finger guns: every punch pops a small dot projectile. "POW" is the only combat floating-text
  left — `say()` drops every other call (see `src/game.html`, search `say(x,z,txt,col)`).
- Title screen simplified to a single START (no SOLO/CO-OP choice), "STARDUST BREAKER" in pink
  on a flat blue background, no level rendered behind it.
- HUD health is the spec's 4-heart bar (a battery-bar experiment was tried and reverted).
- Cars/roadkill mechanic removed entirely. Bam and enemies can walk the whole street width;
  the grab-toss move now ends in a ground slam (`slamDown()`) instead of a car finishing the job.
- Sidewalk narrowed, street widened (`FLOOR_S`/`CURB`/`ROAD` in `src/game.html`).
- Background art overhaul, daytime palette kept: departed from the flat-shape "fatback engine"
  look toward an inked pixel-art rendering technique closer to Scott Pilgrim vs. The World: The
  Game's backgrounds — dark ink outlines, one-light-source gradient shading, baked brick/asphalt/
  sidewalk texture patterns, per-building roofline variety (parapet/setback/gable/cornice),
  window mullions, porch railings, road cracks and worn crosswalk paint, and outlined/shaded
  procedural props (trees, benches, crates, etc). All new visual variety is derived at draw time
  via `hsh()` — never by adding `R()` calls inside `genChunk()` — since that shared per-chunk
  counter drives gate placement/wave timing and any extra draw shifts it (see the toolkit note
  in `src/game.html` above the `inkRect`/`shadedRect`/pattern helpers). Still 100% procedural
  canvas, still infinite chunk-streamed, still bright daytime — only the rendering technique
  changed, not the architecture or the color story.

- **Merged in real hero animation art, kick, and uppercut from `bambyrd-oss/StardustBreakerV1`**
  — a sibling fork of this exact project (its own `HANDOFF.md` says it was "imported with full
  history from the old `samayiat/bambam`" mid-rename, then developed independently). No git
  history was available (the user provided a zip snapshot), so this was a deliberate content
  merge, not a mechanical `git merge` — every change was individually verified against bambam's
  current code before porting. Brought in:
  - **Real hero animation** — six drawn sets (`art/BamBam{Run,Punch,Jump,Uppercut,Kick,Swag}/`,
    4 frames each) replacing the single static placeholder pose, packed via new `pack_frames()`/
    `pack_one()`/`reframe_fixed()`/`reframe_centered()` helpers in `src/pack.py`. New hero
    portrait + PWA icons to match.
  - **Kick** (`KeyI` / gamepad LB / touch KICK) — an alt-input on the existing dive-attack `air`
    state (`P.airPunch` flag branches dive-punch vs. drop-kick).
  - **Uppercut** (`W`+`J`, hold up + punch on the ground) — a new `upper` state, a grounded
    launcher. Uses a dedicated un-mirrored west-facing BAM frame (`hero.uppercutL.2`) so the
    lettering doesn't read backwards when flipped.
  - **FIGHT/SHOOT toggle** (`KeyU` / gamepad LT / touch SHOOT) — bambam's finger-guns were
    unconditional before this; now `P.gunMode` (default `true`, matching prior behavior) gates
    them, togglable mid-run.
  - **Retired the last FATBACK-era props** — `hydrant`/`mailbox`/`sign`/`dumpster` sprites all
    dated to the repo's very first commit ("Seed bambam from the FATBACK engine", confirmed via
    `git log --diff-filter=A`), same vintage as the already-retired enemy art. `dumpster` falls
    back to its (already inked-pixel-art-styled) procedural draw; `hydrant`/`mailbox`/`sign` had
    no procedural equivalent, so — matching the sibling's own approach rather than inventing new
    art — they're dropped from `genChunk()`'s street-furniture spawn table entirely (swapped for
    duplicate tree/bench/newsbox/bikerack entries, same array length and `R()` draw count, so
    gate/wave positions are unaffected).
  - **Explicitly not ported**: the sibling's co-op "deprecation" (bambam's co-op is already
    unreachable from the title UI the same way — a no-op either way) and its title-screen
    SOLO/CO-OP-choice removal (bambam already did this independently, same end state).

- **Landing-hold "super armor"** — the jump/drop-kick/uppercut states used to snap straight to
  `idle` the instant BamBam touched down. Now `P.landHold` freezes him in the landing pose for
  ~1s (with damage still applying via `hurtPlayer`, but no stagger/knockback/knockdown while
  frozen — see the `armored` branch there) so the landing frame actually reads before it's cut
  short. `src/harness.js`'s `scene()` cleanup resets `landHold`/`jump`/`air`/`upper`/`y`/`vy`
  between scenarios to avoid cross-scene leakage.
- **Jump animation is physics-driven**, not elapsed-time-driven — frame selection in
  `drawPlayer()` now checks real `P.y`/`P.vy` instead of `P.airT`, so he no longer crouches into
  the landing frame mid-arc, well before he's actually near the ground.
- **Standing kick** — `I`/LB/KICK with feet on the ground now throws a front kick (`P.state==='kick'`,
  new `art/BamBamKickStand/` sheet, 4 frames: ready stance, knee-raise windup, mid-extend, peak
  extend). It's a solid non-launching hit, distinct from the airborne drop kick (`jump` then
  `kick`, which still uses `art/BamBamKick/` and launches). New harness scene: "standing kick: I
  with feet on the ground connects without launching".

Everything above is committed to `main` and green under `node src/harness.js`.

## Known gaps vs. the game spec (not started)

1. **Enemy art** — the four named enemy types (Security Guards, Corrupt Politicians, Corporate
   Mascots, Robotic Police) read apart from each other by silhouette/color/accessory (see above)
   but are still flat-color placeholders, not real generated sprites. The three bosses (Landlord
   D. Evict, B.I.G. Farma, The President) are also still placeholders. `.mcp.json` has a PixelLab
   MCP server already configured for generating this — see the README's "Art pipeline" section
   for the direction-count rules before generating more (don't generate 8 directions for a
   3-direction need). BamBam's own hero art is done (see above).
2. **Music** — no soundtrack system at all, only WebAudio SFX blips (`blip()` in `src/game.html`).
   The spec calls for a jazz/hip-hop soundtrack that evolves per stage.
3. **XP-unlocked movement abilities** — XP currently only unlocks combo steps and stats
   (`xpToLevel()`/`maxComboStep()`), no dash/double-jump/etc.

That's the natural next-priority list.
