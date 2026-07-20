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
