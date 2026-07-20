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

Everything above is committed to `main` and green under `node src/harness.js`.

## Known gaps vs. the game spec (not started)

1. **Real art** — BamBam and all enemies are still placeholders (one static hero pose, flat-color
   enemy shapes). The four named enemy types now read apart from each other by silhouette/color/
   accessory (see above), but none of them are real generated sprites yet. `.mcp.json` has a
   PixelLab MCP server already configured for generating this — see the README's "Art pipeline"
   section for the direction-count rules before generating more (don't generate 8 directions for
   a 3-direction need).
2. **Music** — no soundtrack system at all, only WebAudio SFX blips (`blip()` in `src/game.html`).
   The spec calls for a jazz/hip-hop soundtrack that evolves per stage.
3. **Kick** — the combo string is punch-only (jab, jab 2, cross, launcher — see `COMBO` in
   `src/game.html`). The spec lists punch *and* kick.
4. **XP-unlocked movement abilities** — XP currently only unlocks combo steps and stats
   (`xpToLevel()`/`maxComboStep()`), no dash/double-jump/etc.

That's the natural next-priority list.
