"""Packs art/ into src/atlas.png + src/atlas.json.\n\nFeet sit on row 70 of each 92px cell and the crown on row 23 — the generator\nis consistent about this, and game.html depends on it (FOOT=70, HEAD=47).\nIf you regenerate art with different framing, re-measure those two numbers.\n"""
from PIL import Image
import json, os, base64, io

import os
ROOT=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),"art")
S=92
COLS=10

# (key, path)
entries=[]
def add(key, path):
    entries.append((key, os.path.join(ROOT,path)))

# --- hero: a single placeholder pose (no animation set yet) ---
# Stands in for every hero.* key game.html actually needs unguarded: hero.rot.south
# (portrait()/buildManifest() read it directly, no fallback), hero.rot.east (idle/walk
# facing), hero.walk.*/hero.jump.* (repeated — static, no cycle), and hero.punch.*
# (comboKey()'s hard fallback when a named combat sheet isn't packed). Everything else
# (hero.swag.*, hero.uppercut.*, hero.knockback.*, hero.jab.*, hero.cross.*, hero.swing.*)
# is deliberately left unpacked — drawPlayer() already guards those with IDX[...] checks
# and falls back to rot.east/jump cleanly. West-facing is free: spr() mirrors east frames
# into a pre-flipped atlas canvas at load time.
PREFRAMED={}
FOOT=70
def reframe_solo(path, hero_h=46):   # same anchor-and-scale approach as the combat anims below, for one frame
    im=Image.open(path).convert("RGBA")
    bb=im.getchannel("A").getbbox()
    if not bb: return im.resize((S,S),Image.LANCZOS)
    f=hero_h/(bb[3]-bb[1])
    cx=(bb[0]+bb[2])/2
    foot=bb[3]
    sm=im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
    cell=Image.new("RGBA",(S,S),(0,0,0,0))
    cell.paste(sm,(round(S/2-cx*f),round(FOOT-foot*f)),sm)
    return cell

HB=os.path.join(ROOT,"BamBamHero","placeholder.png")
_hero_cell=reframe_solo(HB)
for key in (["hero.rot.south","hero.rot.east"]
            + [f"hero.walk.{i}" for i in range(6)]
            + [f"hero.jump.{i}" for i in range(8)]
            + [f"hero.punch.{i}" for i in range(6)]):
    PREFRAMED[key]=_hero_cell; add(key, HB)
# combat-specific sheets (hero.jab.*, hero.cross.*, hero.uppercut.*, hero.knockback.*,
# hero.swing.*) aren't packed yet — comboKey() falls back to hero.punch.* until BamBam
# has real combat frames to reframe the same way reframe_solo() does above.

V="This_character_is_a_6_3"
for d in ["south","south-east","east","north-east","north","north-west","west","south-west"]:
    add(f"vamp.rot.{d}", f"{V}/rotations/{d}.png")
for i in range(4):
    add(f"vamp.walk.{i}", f"{V}/animations/Walking/west/frame_{i:03d}.png")
for i in range(4):
    add(f"vamp.kick.{i}", f"{V}/animations/Hurricane_Kick/west/frame_{i:03d}.png")

# second vampire variant (VampTeal) reverted per request — back to one vampire
# sprite only. Art stays on disk under art/VampTeal/ in case it's wanted later,
# but it's no longer packed into the atlas or referenced by drawVamp.

# Darnell — a regular street enemy alongside vampires. Normal form (darnell.*)
# walks/punches/gets hit like any other mook; his dark/evil sibling (shade.*,
# from the same PixelLab character group) is the "elite" roll — same slot
# vampires use for their tougher 1-in-6 spawn, reused here instead of a new
# mechanic. Both are 136px source, resized generically like the women/vamp art.
D="Darnell"
for d in ["south","south-east","east","north-east","north","north-west","west","south-west"]:
    add(f"darnell.rot.{d}", f"{D}/rotations/{d}.png")
for i in range(6):
    p=f"{D}/animations/walking/west/frame_{i:03d}.png"
    if os.path.exists(os.path.join(ROOT,p)): add(f"darnell.walk.{i}", p)
for i in range(7):   # replaced the old 5-frame straight punch with a proper west-sourced haymaker
    p=f"{D}/animations/punch/west/frame_{i:03d}.png"
    if os.path.exists(os.path.join(ROOT,p)): add(f"darnell.punch.{i}", p)
for i in range(7):   # replaced the subtle 5-frame flinch with a more dynamic 7-frame reaction (head snap, impact stars)
    p=f"{D}/animations/hit_reaction/west/frame_{i:03d}.png"
    if os.path.exists(os.path.join(ROOT,p)): add(f"darnell.hit.{i}", p)
for i in range(7):
    p=f"{D}/animations/knockback/west/frame_{i:03d}.png"
    if os.path.exists(os.path.join(ROOT,p)): add(f"darnell.knockback.{i}", p)

DD="DarnellDark"
for d in ["south","south-east","east","north-east","north","north-west","west","south-west"]:
    add(f"shade.rot.{d}", f"{DD}/rotations/{d}.png")
for i in range(7):   # west-sourced haymaker — fixes the earlier direction gap (old cross-punch had no west sheet)
    p=f"{DD}/animations/haymaker/west/frame_{i:03d}.png"
    if os.path.exists(os.path.join(ROOT,p)): add(f"shade.haymaker.{i}", p)
# old knockback + south/east/north cross-punch kept on disk but no longer packed — the dark
# form doesn't play a hit-reaction pose anymore (just glows), so knockback is unused too

K="Smoking_a_cigarette."
for d in ["south","south-east","east","north-east","north","north-west","west","south-west"]:
    add(f"smoke.rot.{d}", f"{K}/rotations/{d}.png")

# environment props (92x92)
PROPS=["dumpster","hydrant","mailbox","sign"]
for prop in PROPS:
    if os.path.exists(os.path.join(ROOT,f"props/{prop}.png")):
        add(f"prop.{prop}", f"props/{prop}.png")

FOOT=70   # matches game.html: feet sit on this row of the 92px cell

n=len(entries)
rows=(n+COLS-1)//COLS
sheet=Image.new("RGBA",(COLS*S,rows*S),(0,0,0,0))
index={}
for i,(key,path) in enumerate(entries):
    if key in PREFRAMED: im=PREFRAMED[key]           # hero combat anims, already reframed to 92px
    else:
        im=Image.open(path).convert("RGBA")
        if im.size!=(S,S): im=im.resize((S,S), Image.NEAREST)
    cx,cy=(i%COLS)*S,(i//COLS)*S
    sheet.paste(im,(cx,cy))
    index[key]=[cx,cy]

OUT=os.path.dirname(os.path.abspath(__file__))
sheet.save(os.path.join(OUT,"atlas.png"),"PNG",optimize=True)
open(os.path.join(OUT,"atlas.json"),"w").write(json.dumps(index,separators=(",",":")))
sz=os.path.getsize(os.path.join(OUT,"atlas.png"))
print(f"  {n} frames -> atlas.png {sheet.size[0]}x{sheet.size[1]}, {sz//1024} KB")
