# Handoff — The big Freedom attack: "Overdrive" transformation

**Status:** idea only, not built yet. This note captures the plan so we can pick
it up later. Nothing here is wired into the game.

## The vision

Right now a **full Freedom bar + the imagine/shoot button** fires the old
"Imagination attack" (a one-shot burst). We want to replace that payoff with a
**transformation**: BamBam becomes wildly overpowered for about **10 seconds**.

While transformed:

- **Every punch is explosive / super-animated** — bigger hits, screen shake,
  particle bursts, maybe a shockwave that catches nearby enemies.
- **The shoot button sends enemies flying** — the finger-gun blast becomes a
  cannon that launches whatever it hits (big knockback + launch).
- Generally "OP mode": more damage, maybe invincibility or heavy armor, a
  visual glow/tint on the character so it's obvious it's active.
- When the 10 seconds run out, he returns to normal and the Freedom bar is
  spent.

Think of it as the game's "super mode," not a single attack.

## How it works today (what we'd be replacing / building on)

The Freedom Meter is already doing double duty as of the latest changes:

- It **fills** as you clear enemies (`gainFreedom()` in `src/game.html`).
- **Shooting** spends 5% of it per shot (the swag-pose finger-gun blast).
- A **completely full** bar + the imagine button currently triggers the old
  one-shot `imagine` burst. **This full-bar behavior is the thing the
  transformation would replace.**

Key spots in `src/game.html` to look at when we build this (line numbers drift
as the file changes — search for the quoted text, don't trust the numbers):

- **The trigger** — search for `a FULL bar still unleashes the big Imagination`.
  This is the `jDrink` block. Today: full meter → `P.state='imagine'`. This is
  where we'd instead flip on the transformation (e.g. set a timer like
  `P.overdrive = 600` for ~10s at 60fps, and drain the meter).
- **The current one-shot attack** — search for `P.state==='imagine'`. That's the
  existing burst handler. The transformation is a *timed buff*, not a state, so
  it'd more likely live as a countdown that other systems check, rather than a
  single animation state.
- **Punches becoming explosive** — search for `if(active && !P.hitDone)` (the
  punch hit resolution) and `function connect`. While `P.overdrive>0` we'd boost
  `dmg`, force `launch:true`, and add extra shake/particles.
- **Shots sending enemies flying** — search for `P.state==='shoot'` (the shoot
  handler that pushes a `dot` into `fires`). While transformed, the projectile
  would carry big `push`/`launch`.
- **The existing "Fists of Fire" power-up** — search for `P.fireT`. This is
  already a temporary "every swing hurls a fireball" buff granted by the old
  imagine burst. It's a good working example of exactly the timed-buff pattern
  the transformation needs, and we may fold it in.
- **Visual tint while active** — search for `P.state==='imagine'` in the draw
  code (there's a `tint`/`amt` block). Same idea: while `P.overdrive>0`, tint
  the character so the mode reads at a glance.

## Open questions for later

- **Duration & cost:** 10s confirmed. Does it cost the *whole* bar, and can it
  be re-triggered immediately if the bar refills, or is there a cooldown?
- **Invincibility?** Fully invincible, armored (takes hits but no stagger), or
  just more powerful?
- **Does shooting still cost 5% *during* the transformation,** or is it free
  while OP?
- **What happens to the current shoot/5% mechanic** — does it stay exactly as-is
  when *not* transformed? (Assumed yes.)
- **Art:** does BamBam need a distinct transformed look (new sprites), or is a
  glow/tint on the existing sprites enough for now?

## Testing reminder

Whatever we build has to keep the headless harness green
(`node src/harness.js index.html`, or just `python3 src/build.py` which runs it).
There's a scene named *"Freedom Meter: fills on kills, and a full meter
unleashes the Imagination attack"* that currently asserts the old full-bar
behavior — that scene will need updating to match the transformation.
