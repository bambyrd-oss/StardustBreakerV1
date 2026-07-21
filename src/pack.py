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

# --- hero: real drawn frames, one folder of raw crops per animation ---
# Each key game.html needs unguarded (hero.rot.south/east, hero.walk.*, hero.jump.*,
# hero.punch.*) plus the ones it guards with IDX[...] checks (hero.uppercut.*,
# hero.kick.*, hero.swag.*) now come from art/BamBam{Run,Punch,Jump,Uppercut,Kick,Swag}.
# hero.knockback.*/hero.jab.*/hero.cross.*/hero.swing.* stay unpacked — comboKey()
# falls back to hero.punch.* until BamBam has dedicated combat sheets for those.
PREFRAMED={}
FOOT=70
def reframe_solo(path, hero_h=46):
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

def bbox_h(path):
    im=Image.open(path).convert("RGBA")
    bb=im.getchannel("A").getbbox()
    return (bb[3]-bb[1]) if bb else S

def reframe_fixed(path, ref_h, hero_h=46):
    # same anchor as reframe_solo, but scaled against a shared reference height
    # (usually the set's own standing/neutral frame) instead of this frame's own
    # bbox — a horizontal kick or a raised fist would otherwise have a short/tall
    # bbox and get scaled to the wrong size relative to its neighbours.
    im=Image.open(path).convert("RGBA")
    bb=im.getchannel("A").getbbox()
    if not bb: return im.resize((S,S),Image.LANCZOS)
    f=hero_h/ref_h
    cx=(bb[0]+bb[2])/2
    foot=bb[3]
    sm=im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
    cell=Image.new("RGBA",(S,S),(0,0,0,0))
    cell.paste(sm,(round(S/2-cx*f),round(FOOT-foot*f)),sm)
    return cell

def pack_frames(prefix, folder, frame_files, ref_file=None):
    ref_h=bbox_h(os.path.join(ROOT,folder,ref_file or frame_files[0]))
    for i,fname in enumerate(frame_files):
        p=os.path.join(ROOT,folder,fname)
        key=f"{prefix}.{i}"
        PREFRAMED[key]=reframe_fixed(p,ref_h); add(key,p)

def reframe_centered(path, cell_h):
    # scale the whole art (character + any comic-book burst) to cell_h and
    # centre it in the 92px cell. used for the uppercut burst frames, whose art
    # is much taller than the character — foot-anchoring would clip the burst off
    # the top, and shrinking to the normal 46px hero height leaves the character
    # tiny. centring at a near-full-cell height keeps the whole thing as big as
    # the cell allows, so these frames read slightly larger than the rest.
    im=Image.open(path).convert("RGBA")
    bb=im.getchannel("A").getbbox()
    if not bb: return im.resize((S,S),Image.LANCZOS)
    crop=im.crop(bb)
    f=cell_h/crop.height
    w=max(1,round(crop.width*f)); h=max(1,round(crop.height*f))
    sm=crop.resize((w,h),Image.LANCZOS)
    cell=Image.new("RGBA",(S,S),(0,0,0,0))
    cell.paste(sm,(round((S-w)/2),round((S-h)/2)),sm)
    return cell

def pack_one(key, folder, fname, im):
    PREFRAMED[key]=im; add(key, os.path.join(ROOT,folder,fname))

pack_frames("hero.walk", "BamBamRun",      ["frame0.png","frame1.png","frame2.png","frame3.png"])
pack_frames("hero.punch","BamBamPunch",    ["frame0.png","frame1.png","frame2.png","frame2.png","frame3.png","frame3.png"])
pack_frames("hero.jab",  "BamBamJab",      ["frame0.png","frame1.png","frame2.png","frame2.png","frame3.png","frame3.png"])  # COMBO's jab step (sheet:'jab') — right hand
pack_frames("hero.jabL", "BamBamJabL",     ["frame0.png","frame0.png","frame1.png","frame1.png","frame2.png","frame2.png"])  # COMBO's jab-2 step (sheet:'jabL') — left hand; only 3 source frames (idle/extend/recover), no dedicated wind-up, so idle doubles as its own wind-up
pack_frames("hero.jump", "BamBamJump",     ["frame0.png","frame1.png","frame2.png","frame3.png"])
# uppercut: crouch/landing are clean (just the character) so foot-anchor them a
# touch bigger than the normal 46px hero; the two burst frames fill the cell.
UC="BamBamUppercut"
pack_one("hero.uppercut.0", UC, "frame0.png", reframe_solo(os.path.join(ROOT,UC,"frame0.png")))   # crouch: normal 46px hero, foot-anchored
pack_one("hero.uppercut.1", UC, "frame1.png", reframe_centered(os.path.join(ROOT,UC,"frame1.png"), 90))
pack_one("hero.uppercut.2", UC, "frame2.png", reframe_centered(os.path.join(ROOT,UC,"frame2.png"), 90))
pack_one("hero.uppercut.3", UC, "frame3.png", reframe_solo(os.path.join(ROOT,UC,"frame3.png"), hero_h=54))
# dedicated WEST-facing BAM! peak: the engine mirrors east->west for everything, which
# would flip the "BAM!" lettering backwards. This frame already faces left with correct
# text, so drawPlayer draws it un-mirrored when facing left instead of the flipped frame2.
pack_one("hero.uppercutL.2", UC, "frame2_left.png", reframe_centered(os.path.join(ROOT,UC,"frame2_left.png"), 90))
pack_frames("hero.kick", "BamBamKick",     ["frame1.png","frame2.png","frame2.png","frame3.png"], ref_file="frame3.png")  # frame0 (run start) is grounded, never shown — 'kick' state starts mid-air
pack_frames("hero.kickstand", "BamBamKickStand", ["frame1.png","frame2.png","frame3.png","frame3.png"], ref_file="frame0.png")  # grounded front kick — I with feet on the ground (frame0, the ready stance, is only used as the scale reference)
pack_frames("hero.swag", "BamBamSwag",     ["frame0.png","frame1.png","frame2.png","frame3.png"])
pack_frames("hero.shoot","BamBamShoot",    ["frame0.png","frame1.png","frame2.png","frame3.png"])  # finger-gun point-and-step cycle, used for punch while FIGHT/SHOOT is in SHOOT mode

HB=os.path.join(ROOT,"BamBamPunch","frame0.png")   # idle stance doubles as both facings
_hero_cell=reframe_solo(HB)
for key in ("hero.rot.south","hero.rot.east"):
    PREFRAMED[key]=_hero_cell; add(key, HB)

# a dedicated face-only crop for the HUD portrait / PWA icon (portrait()/buildManifest() in
# game.html) — a plain body-sprite crop reads muddy at 28px, so this is packed separately
# instead of zooming into hero.rot.south.
def reframe_portrait(path, pad=6):
    im=Image.open(path).convert("RGBA")
    bb=im.getchannel("A").getbbox()
    if bb: im=im.crop(bb)
    avail=S-pad*2
    f=min(avail/im.width, avail/im.height)
    sm=im.resize((max(1,round(im.width*f)),max(1,round(im.height*f))),Image.LANCZOS)
    cell=Image.new("RGBA",(S,S),(0,0,0,0))
    cell.paste(sm,(round((S-sm.width)/2),round((S-sm.height)/2)),sm)
    return cell

PB=os.path.join(ROOT,"BamBamPortrait","face.png")
PREFRAMED["hero.portrait"]=reframe_portrait(PB); add("hero.portrait", PB)

# Street enemies (formerly vamp/Darnell/DarnellDark FATBACK art) and the crowd bystander
# sprite (Smoking_a_cigarette) are no longer packed — drawVamp()/drawCrowd() draw a generic
# procedural placeholder shape instead, until real BamBam enemy art (Security Guards, Corrupt
# Politicians, Corporate Mascots, Robotic Police — see README) gets generated. Source art for
# all of them stays on disk under art/ in case it's wanted again.

# environment props (dumpster/hydrant/mailbox/sign) are no longer packed either — all four
# were seeded from the original FATBACK engine (git log --diff-filter=A confirms all four
# date to the "Seed bambam from the FATBACK engine" commit), the same vintage as the retired
# enemy art above, and are retired for the same reason regardless of visual quality. The
# dumpster still renders via its procedural fallback (drawCan); hydrant/mailbox/sign were
# swapped out of genChunk's spawn table for procedural props, so nothing references the
# dropped keys anymore. Source art stays on disk under art/props/ in case it's wanted again.

FOOT=70   # matches game.html: feet sit on this row of the 92px cell

# each sprite still occupies a 92x92 region, but cells are spaced apart by GUTTER
# transparent pixels so the sheet is easy to eyeball / crop by hand. The game only
# ever reads a fixed 92x92 region from each recorded (x,y), so the gutter is
# invisible to spr() and the in-place flip builder alike.
GUTTER=20
CW=S+GUTTER
n=len(entries)
rows=(n+COLS-1)//COLS
sheet=Image.new("RGBA",(COLS*CW-GUTTER, rows*CW-GUTTER),(0,0,0,0))
index={}
for i,(key,path) in enumerate(entries):
    if key in PREFRAMED: im=PREFRAMED[key]           # hero combat anims, already reframed to 92px
    else:
        im=Image.open(path).convert("RGBA")
        if im.size!=(S,S): im=im.resize((S,S), Image.NEAREST)
    cx,cy=(i%COLS)*CW,(i//COLS)*CW
    sheet.paste(im,(cx,cy))
    index[key]=[cx,cy]

OUT=os.path.dirname(os.path.abspath(__file__))
sheet.save(os.path.join(OUT,"atlas.png"),"PNG",optimize=True)
open(os.path.join(OUT,"atlas.json"),"w").write(json.dumps(index,separators=(",",":")))
sz=os.path.getsize(os.path.join(OUT,"atlas.png"))
print(f"  {n} frames -> atlas.png {sheet.size[0]}x{sheet.size[1]}, {sz//1024} KB")
