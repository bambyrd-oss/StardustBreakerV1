# FATBACK Co-Op & Environment Sprites Handoff

**Date:** July 18, 2026  
**Status:** Partial implementation — environment sprites packed but not rendering  

## What's Done ✅

### PlayroomKit Co-Op Integration
- ✅ PlayroomKit loaded from jsDelivr CDN
- ✅ `insertCoin()` working — players can connect to multiplayer lobby
- ✅ Player join event handler wired (`onPlayerJoin`)
- ✅ CO-OP button on title screen (D key toggles, button click works)
- ✅ Playroom.myPlayer() race condition fixed (null check added)
- ✅ Enemy spawning disabled in CO-OP mode for clean testing

**Known issue:** Remote players not rendering on same screen (position sync may need work)

### Environment Sprites (PixelLab)
- ✅ 9 sprites downloaded and committed to `art/props/`:
  - `hydrant.png` — red fire hydrant
  - `mailbox.png` — blue USPS mailbox
  - `sign.png` — one-way street sign
  - `gate.png` — security gate/shutter
  - `dumpster.png` — green metal dumpster
  - `fireescalpe.png` — rusty fire escape
  - `lamp.png` — ornate street lamp (NEW)
  - `crate2.png` — weathered wooden crate (NEW)
  - `tree2.png` — wooden tree sprite (NEW)

- ✅ All 9 sprites packed into atlas (117 frames total)
- ✅ Atlas updated in `index.html` with sprite coordinates
- ✅ `pack.py` updated to include props in packing
- ✅ `drawProp()` updated to render sprites with fallback to procedural
- ✅ `drawCan()` updated to render dumpster as sprite
- ✅ Prop generation expanded to include: tree, tree2, hydrant, bench, mailbox, sign, gate, lamp, crate2

## What's Broken ❌

### Environment Sprites Not Rendering
**Problem:** Sprites are in atlas and code looks correct, but they're not visible in game.

**Symptoms:**
- Atlas has 117 frames (includes props)
- `IDX` has prop sprite keys (prop.lamp, prop.tree2, etc.)
- Prop generation code exists and should create props with those types
- `drawProp()` checks for sprites and falls back to procedural
- But sprites don't appear on screen

**Debugging added:**
- Console logging for new prop types (lamp, tree2, crate2) creation
- Console logging when sprites are found/not found in `drawProp()`
- Lists last 10 available prop keys in IDX

**To diagnose:** Open browser console (F12), hard refresh, look for:
- `PROP created: type=lamp has sprite? true/false`
- `✓ Drawing sprite prop.lamp` (if rendering)
- `✗ SPRITE NOT FOUND: prop.lamp` (if not found)

### Remote Player Sync (Co-Op)
**Problem:** Players connect to lobby but don't see each other on screen.

**Status:**
- Playroom connection works (player join event fires)
- Position state publishing code exists (`setState("pos", {...})`)
- Remote player retrieval code exists (`o.getState("pos")`)
- `drawRemotePlayer()` function exists and renders with color tints
- Debug logs show `others.length` and position data

**Likely issue:** Position sync timing or the `others` array not being populated correctly from player join events.

## Code Locations

**Co-Op:** `src/game.html`
- Line 3521: `startCoop()` function
- Line 3534: `onPlayerJoin()` handler
- Line 3305-3317: Remote player state sync and rendering in render loop
- Line 2530: `drawRemotePlayer()` function

**Environment Sprites:** `src/game.html`
- Line 701: Prop type generation in `genChunk()`
- Line 2455: `drawProp()` function (sprite lookup + procedural fallback)
- Line 2429: `drawCan()` function (dumpster sprite)

**Atlas:** `src/pack.py`
- Lines 44-47: Prop list and packing logic

## Next Steps

1. **Debug environment sprites rendering:**
   - Check browser console output after hard refresh
   - Verify props are being created with correct types
   - Confirm sprites exist in IDX and can be looked up
   - Test if `spr()` function can draw the props

2. **Debug co-op player sync:**
   - Verify `others` array is populated when players join
   - Check position data is being published/retrieved correctly
   - Ensure remote player positions are valid coordinates

3. **Consider workarounds if CDN/UMD issues persist:**
   - Test different PlayroomKit CDN sources
   - Check if different UMD export names needed
   - Consider npm + bundler approach if CDN cannot be made reliable

## Assets Reference

**PixelLab Objects (Approved):**
- ID: 46c8e158 — Ornate street lamp (lamp.png)
- ID: 27765064 — Weathered wooden crate (crate2.png)
- ID: be094455 — Old wooden tree (tree2.png)

More approved assets available on PixelLab (trees, benches, etc.) if needed.

## Testing Commands

```bash
# Rebuild atlas
python3 src/build.py

# Push to GitHub Pages
git push

# Check what sprites are packed
grep '"prop\.' src/atlas.json

# Check what prop types are generated
grep "const ty=\[" src/game.html
```

## Deployment Status

- **Live:** https://samayiat.github.io/fatback-the-game/
- **Branch:** main
- **Last commit:** Environment sprites packed (but not rendering)
- **Ready to ship:** No — environment sprites and co-op player sync need debugging
