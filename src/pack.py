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

F="This_character_is_5_11_._He"
for d in ["south","south-east","east","north-east","north","north-west","west","south-west"]:
    add(f"hero.rot.{d}", f"{F}/rotations/{d}.png")
for name,cnt,folder in [("walk",6,"Walking"),("punch",6,"Cross_Punch"),("drink",6,"Drinking"),("jump",8,"Jumping"),("swag",8,"Scary_Walk")]:
    for i in range(cnt):
        add(f"hero.{name}.{i}", f"{F}/animations/{folder}/east/frame_{i:03d}.png")
for i in range(6):
    add(f"hero.punchS.{i}", f"{F}/animations/Cross_Punch-8c2c64c6/south/frame_{i:03d}.png")
for i in range(4):
    add(f"hero.walkS.{i}", f"{F}/animations/Walking-deb204dd/south/frame_{i:03d}.png")

# --- Fatback's east-facing combat anims (jab/cross/uppercut/knockback/kick) ---
# These came from the 160px PixelLab re-import, not the 92px local export, so they
# need a consistent reframe: one transform (derived from frame 0's body) applied to
# EVERY frame, so the torso stays anchored and only the limbs extend. Per-frame
# bbox centering (what the women use) would make the body jitter as the punch
# reaches. Feet seat on row FOOT, matching the rest of the hero. Held in PREFRAMED
# so the main pack loop uses the already-92px result instead of the raw file.
PREFRAMED={}
FOOT=70
def reframe_hero_anim(paths, hero_h=46):   # measured off the real walk/rotation sprites — was 50, ~9% too tall, made punches jarring next to idle/walk
    ims=[Image.open(p).convert("RGBA") for p in paths]
    bb0=ims[0].getchannel("A").getbbox()          # frame 0 = the standing reference
    if not bb0: return [im.resize((S,S),Image.LANCZOS) for im in ims]
    f=hero_h/(bb0[3]-bb0[1])                       # scale so the body matches the hero
    cx0=(bb0[0]+bb0[2])/2                          # body centre x (fixed anchor)
    foot0=bb0[3]                                    # feet y (fixed ground line)
    out=[]
    for im in ims:
        sm=im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
        cell=Image.new("RGBA",(S,S),(0,0,0,0))
        cell.paste(sm,(round(S/2-cx0*f),round(FOOT-foot0*f)),sm)
        out.append(cell)
    return out

# folder -> hero key stem, all east-facing 6-frame
HERO_COMBAT=[("jab_east","jab"),("cross_east","cross"),("uppercut_east","uppercut"),
             ("knockback_east","knockback"),("flykick_east","kick"),("bigswing_east","swing")]
for folder,stem in HERO_COMBAT:
    fdir=os.path.join(ROOT,F,"animations",folder,"east")
    if os.path.isdir(fdir):
        paths=[os.path.join(fdir,f"frame_{i:03d}.png") for i in range(6)]
        if all(os.path.exists(p) for p in paths):
            frames=reframe_hero_anim(paths)
            for i,img in enumerate(frames):
                key=f"hero.{stem}.{i}"; PREFRAMED[key]=img; add(key, paths[i])

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

# the women outside the clubs. NPCs only ever render 4 of the 8 directions
# (drawNPC uses south, south-east, south-west when you're close, and north once
# she's done with you) — so we pack only those, not the full rotation. Halves
# the atlas cost per woman and matches the "flip east/west, skip the rest" idea.
WOMEN=["Keisha","Marisol","Simone","Tiana","Nova","Mei","Camila","Priya",
       "Glamorous","Radiant","ElegantSamoa","VibrantLatina","SleekPro"]
NPC_DIRS=["south","south-east","south-west","north"]
for wi,Wn in enumerate(WOMEN):
    for d in NPC_DIRS:
        p=f"{Wn}/rotations/{d}.png"
        if os.path.exists(os.path.join(ROOT,p)):
            add(f"w{wi}.rot.{d}", p)

# mood loops (south-facing, 6 frames) for the women who have them. the crew
# system plays talk/laugh; women without a matching loop fall back to their idle
# rotation. keys: w{i}.talk.*, w{i}.laugh.*
for wi,Wn in enumerate(WOMEN):
    for anim,folder in [("talk","talking"),("laugh","laughing")]:
        for fi in range(6):
            p=f"{Wn}/animations/{folder}/south/frame_{fi:03d}.png"
            if os.path.exists(os.path.join(ROOT,p)):
                add(f"w{wi}.{anim}.{fi}", p)

# environment props (92x92)
PROPS=["dumpster","hydrant","mailbox","sign"]
for prop in PROPS:
    if os.path.exists(os.path.join(ROOT,f"props/{prop}.png")):
        add(f"prop.{prop}", f"props/{prop}.png")

FOOT=70   # matches game.html: feet sit on this row of the 92px cell

FIG_H=44   # target figure height in px — just under the men's ~46, regardless of source export size

def reframe(im):
    """The women come from PixelLab at varying export sizes (136 / 180 / 184px)
    with the figure filling most of the frame — dropped straight in they tower
    over the 5'11 hero and their feet land below the FOOT baseline. Crop to the
    actual figure, scale it to a FIXED target height (so every woman is the same
    scale no matter her export size), and seat the feet on row FOOT so spr()
    places them like every other sprite.

    Resize uses NEAREST, not LANCZOS: LANCZOS is built for smooth photographic
    downscaling and blurs flat-color pixel art, and it blurs MORE at steeper
    ratios — so a 184px source (bigger downscale) came out softer than a 136px
    one, on top of the game's canvas already being rendered pixelated everywhere
    else. NEAREST keeps hard edges and reads consistent across every source size."""
    a=im.getchannel("A"); bb=a.getbbox()
    if not bb: return im.resize((S,S), Image.NEAREST)
    fig=im.crop(bb)
    f=FIG_H/fig.height                       # normalize to target height, not a fixed factor
    nw,nh=max(1,round(fig.width*f)),max(1,round(fig.height*f))
    fig=fig.resize((nw,nh), Image.NEAREST)
    cell=Image.new("RGBA",(S,S),(0,0,0,0))
    cell.paste(fig, ((S-nw)//2, FOOT-nh), fig)   # centered, feet on the baseline
    return cell

def is_woman(key): return len(key)>1 and key[0]=="w" and key[1].isdigit()

n=len(entries)
rows=(n+COLS-1)//COLS
sheet=Image.new("RGBA",(COLS*S,rows*S),(0,0,0,0))
index={}
for i,(key,path) in enumerate(entries):
    if key in PREFRAMED: im=PREFRAMED[key]           # hero combat anims, already reframed to 92px
    else:
        im=Image.open(path).convert("RGBA")
        if is_woman(key): im=reframe(im)
        elif im.size!=(S,S): im=im.resize((S,S), Image.NEAREST)
    cx,cy=(i%COLS)*S,(i//COLS)*S
    sheet.paste(im,(cx,cy))
    index[key]=[cx,cy]

OUT=os.path.dirname(os.path.abspath(__file__))
sheet.save(os.path.join(OUT,"atlas.png"),"PNG",optimize=True)
open(os.path.join(OUT,"atlas.json"),"w").write(json.dumps(index,separators=(",",":")))
sz=os.path.getsize(os.path.join(OUT,"atlas.png"))
print(f"  {n} frames -> atlas.png {sheet.size[0]}x{sheet.size[1]}, {sz//1024} KB")
