# Handoff — 2026-07-20

**Repo note:** this project now lives in `bambyrd-oss/StardustBreakerV1` (imported with full
history from the old `samayiat/bambam`; the game was mid-rename to "Stardust Breaker"). Active
branch: `claude/new-session-qlphac` (also the repo's default branch).

**Live build:** https://bambyrd-oss.github.io/StardustBreakerV1/ — GitHub Pages, deployed by
`.github/workflows/pages.yml` on every push (harness-gated). One-time repo setup was required:
Settings → Pages → Source "GitHub Actions", and the `github-pages` environment's deployment-branch
rule had to allow `claude/new-session-qlphac` (it defaulted to blocking it). Served over HTTPS so
the PWA installs ("Add to Home Screen") and mobile touch controls work there.

**Build locally:** `python3 src/build.py` (packs `art/` into the atlas, inlines everything into
`index.html`, then runs `node src/harness.js` — the build fails if any scenario fails).

## Latest session — real hero art + kick/uppercut, co-op deprecated

- **Real hero sprites are in.** Replaced the single static placeholder pose with six real
  drawn animation sets, cropped/keyed from reference sheets into
  `art/BamBam{Run,Punch,Jump,Uppercut,Kick,Swag}/` and packed by `src/pack.py`:
  - `hero.walk` (run cycle), `hero.punch` (jab combo), `hero.jump`, `hero.swag` (imagination),
    plus two attack sheets below. `hero.rot.east/south` (idle/facing) reuse the punch idle pose.
  - The uppercut sheet's two "burst" frames carry a full comic-book BAM! explosion much bigger
    than the character, so `pack.py` packs those with `reframe_centered()` (whole art fills the
    92px cell) while the clean crouch/landing frames stay foot-anchored. Everything else uses
    `reframe_fixed()` (scaled against the set's neutral frame so limbs don't rescale the body).
  - Atlas cells are now spaced by a 20px `GUTTER` (transparent) so the sheet crops cleanly by
    hand. The game only ever reads a fixed 92×92 region from each recorded (x,y), so the gutter
    is invisible to `spr()` and the in-place flip builder.
- **New KICK button** (`I` / gamepad LB / on-screen KICK), wired alongside punch/jump/etc.
- **Two new moves** (see README + pause menu):
  - **Uppercut** — hold **up + punch** (`W`+`J`): grounded launcher, rises straight up, `upper`
    state, uses the BAM! uppercut art. Connects with a launch.
  - **Drop kick** — **jump then kick** (`K` then `I`): forward-driving aerial kick, reuses the
    old dive `air` state (retriggered on KICK not PUNCH), uses the kick art.
  - The old jump+punch dive is gone; aerial attack is now the drop kick.
- **Animation frame-count formulas fixed** in `drawPlayer()` and `drawRemotePlayer()` for the new
  4-frame sets (walk/jump/swag were assuming 6–8 old placeholder frames; `down` no longer refers
  to removed `hero.jump.5/6`).
- **Env props removed from the atlas** — dumpster/hydrant/mailbox/sign sprites are gone. The
  dumpster falls back to its procedural drawing (`drawCan`); hydrant/mailbox/sign were swapped
  out of `genChunk`'s decorative spawn table for procedural props (**array kept 10 long so the
  shared `R()` call-order — and every downstream gate/wave seed — is unchanged**; see the
  load-bearing `R()` gotcha in the older notes below).
- **Co-op is DEPRECATED (off), not removed.** `startCoop()` is now a shim that starts solo,
  `MP` can never become true, and the PlayroomKit `<script>` is commented out (game is fully
  self-contained/offline again). All the `coop*`/`drawRemotePlayer` machinery is left in place
  and dormant (every branch guards on `MP`), ready to revive later.

Harness stays green; verified the two new moves both trigger + connect in a real browser
(Playwright) as well.

**Still a placeholder / TODO from before:** enemy art (guards/politicians/mascots/police are
still flat silhouettes), music, XP-unlocked movement abilities. A 4-frame **standing/ground
kick** reference sheet was also provided but is NOT wired in yet (the current KICK is the aerial
drop kick) — awaiting direction on whether to add a grounded kick.

## What's done (earlier)

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
- **Imagination special is now a plasma gun beam**, not a radius nova — same trigger (`L`/DRINK/B,
  Freedom Meter full), same `P.state==='imagine'`, but the hit-check (`src/game.html`, `P.st===1`)
  is now a long forward rectangle (`hits()` box, ~460px + reach, `P.beamFace` locks the direction
  at the moment it fires so a hit reaction mid-blast can't swing it) instead of a short
  omnidirectional radius — it only hits what's in front of him now, but at way more range. New
  `drawPlasmaBeam()` renders it: layered additive-blend glow (outer soft glow → mid saturated
  cyan → white-hot core, same technique as the robocop dark form's plasma lob in `drawFires()`,
  just stretched into a beam and tinted electric-blue instead of magenta so the two read as
  clearly different) plus a burst of `puff()` sparks along its length. Fully procedural, no new
  art. The title screen's idle demo loop already triggers `imagine` periodically, so the beam
  shows up there too, for free.

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
