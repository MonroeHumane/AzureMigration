# Puppy Skater sprite + cover generator — same pipeline as Shelter Run's
# gen_obstacles.py: supersample 3x, cel ink outline, one shared palette.
#
#   python tools/gen_puppy_skater.py
#
# Outputs into ../public/games/puppy-skater/assets and
# ../public/assets/game-covers/cover-puppyskater.png.
from PIL import Image, ImageDraw
import math, os, random

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(ROOT, "..", "public", "games", "puppy-skater", "assets"))
COVERS = os.path.normpath(os.path.join(ROOT, "..", "public", "assets", "game-covers"))
SS = 3
INK = (44, 34, 30, 255)


def S(v):
    return int(round(v * SS))


def canvas(w, h):
    return Image.new("RGBA", (S(w), S(h)), (0, 0, 0, 0))


def dn(img, w=None, h=None):
    w = w or img.width // SS
    h = h or img.height // SS
    return img.resize((w, h), Image.LANCZOS)


def ellipse(d, cx, cy, rx, ry, fill, outline=INK, ow=2):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill, outline=outline, width=S(ow) if outline else 0)


def rr(d, x, y, w, h, r, fill, outline=INK, ow=2):
    d.rounded_rectangle([x, y, x + w, y + h], radius=S(r), fill=fill,
                        outline=outline, width=S(ow) if outline else 0)


def rot_ellipse(rx, ry, angle_deg, fill, outline=INK, ow=2):
    """A rotated ellipse as its own layer (for ears, fins, tails)."""
    pad = S(6)
    w, h = S(rx * 2) + pad * 2, S(ry * 2) + pad * 2
    lay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.ellipse([pad, pad, pad + S(rx * 2), pad + S(ry * 2)], fill=fill,
              outline=outline, width=S(ow) if outline else 0)
    return lay.rotate(angle_deg, expand=True, resample=Image.BICUBIC)


def paste_center(dst, lay, cx, cy):
    dst.alpha_composite(lay, (int(cx - lay.width / 2), int(cy - lay.height / 2)))


# ── Dog on skateboard ────────────────────────────────────────────────────────
# Frame: 170x150, dog faces right. Board deck top ~y=124.
DOGS = {
    "barnaby": dict(body=(214, 158, 84), belly=(238, 196, 138), ear=(178, 120, 58),
                    helmet=(226, 72, 66), spots=None, muzzle=(238, 196, 138)),
    "daisy":   dict(body=(232, 206, 160), belly=(246, 232, 200), ear=(196, 158, 110),
                    helmet=(64, 160, 172), spots="tail", muzzle=(246, 232, 200)),
    "pepper":  dict(body=(88, 88, 96), belly=(170, 172, 178), ear=(64, 64, 72),
                    helmet=(240, 178, 60), spots=None, muzzle=(170, 172, 178)),
    "patches": dict(body=(240, 238, 230), belly=(248, 246, 240), ear=(146, 96, 60),
                    helmet=(96, 132, 220), spots="eye", muzzle=(248, 246, 240)),
}

FW, FH = 170, 150


def draw_board(tilt=0.0):
    """Skateboard as a separate layer so the ollie frame can tilt it."""
    lay = canvas(FW, FH)
    d = ImageDraw.Draw(lay)
    # wheels first (deck overlaps hubs)
    for wx in (58, 122):
        ellipse(d, S(wx), S(136), S(7), S(7), (58, 56, 60), ow=2)
        ellipse(d, S(wx), S(136), S(2.5), S(2.5), (160, 158, 164), outline=None)
    # deck: rounded plank with upturned nose (right)
    d.rounded_rectangle([S(38), S(122), S(148), S(131)], radius=S(4),
                        fill=(58, 140, 150), outline=INK, width=S(2))
    d.polygon([(S(146), S(122)), (S(158), S(114)), (S(162), S(119)), (S(150), S(131))],
              fill=(58, 140, 150), outline=INK)
    d.line([S(44), S(125), S(140), S(125)], fill=(120, 205, 210), width=S(2))
    if abs(tilt) > 0.01:
        lay = lay.rotate(tilt, expand=False, resample=Image.BICUBIC, center=(S(58), S(128)))
    return lay


def draw_dog(pal, pose):
    """pose: dict(bob, leg_phase, tail, ear, crouch, board_tilt). Returns frame img."""
    img = canvas(FW, FH)
    d = ImageDraw.Draw(img)
    bob = pose.get("bob", 0.0)
    crouch = pose.get("crouch", 0.0)
    leg = pose.get("leg_phase", 0.0)
    tail = pose.get("tail", 0.0)
    earf = pose.get("ear", 0.0)

    body_cx, body_cy = 84, 86 + bob + 13 * crouch
    body_rx, body_ry = 44, 24 * (1 - 0.30 * crouch)
    head_cx, head_cy = 120 - 5 * crouch, 55 + bob * 0.6 + 17 * crouch

    img.alpha_composite(draw_board(pose.get("board_tilt", 0.0)))

    # tail (behind body) — wags with `tail`
    tail_lay = rot_ellipse(7, 17, -38 - tail * 26 + 40 * crouch, pal["body"], ow=2)
    paste_center(img, tail_lay, S(45), S(body_cy - 14))
    d = ImageDraw.Draw(img)

    # back leg + front leg (near side), paws planted on the deck
    leg_top = body_cy + body_ry * 0.5
    back_x = 62 + leg * 4
    front_x = 102 - leg * 4
    for lx in (back_x, front_x):
        rr(d, S(lx - 5), S(leg_top), S(10), S(124 - leg_top - 8 * crouch), 4, pal["body"], ow=2)
        ellipse(d, S(lx + 1), S(123), S(8), S(5), pal["belly"], ow=2)

    # body + chest/belly
    ellipse(d, S(body_cx), S(body_cy), S(body_rx), S(body_ry), pal["body"], ow=3)
    ellipse(d, S(body_cx + 10), S(body_cy + body_ry * 0.38), S(body_rx * 0.55), S(body_ry * 0.55),
            pal["belly"], outline=None)
    if pal["spots"] == "tail":
        ellipse(d, S(body_cx - 18), S(body_cy - 8), S(11), S(8), (168, 110, 62), ow=2)

    # head
    ellipse(d, S(head_cx), S(head_cy), S(21), S(20), pal["body"], ow=3)
    if pal["spots"] == "eye":
        ellipse(d, S(head_cx + 6), S(head_cy - 6), S(9), S(8), (168, 110, 62), ow=2)
    # muzzle + nose + tongue
    rr(d, S(head_cx + 6), S(head_cy + 2), S(24), S(13), 6, pal["muzzle"], ow=2)
    ellipse(d, S(head_cx + 30), S(head_cy + 5), S(4), S(4), (40, 32, 32), outline=None)
    ellipse(d, S(head_cx + 24), S(head_cy + 14), S(5), S(6), (240, 130, 140), ow=1)  # tongue
    # eye
    ellipse(d, S(head_cx + 7), S(head_cy - 5), S(3.4), S(3.8), (34, 28, 28), outline=None)
    ellipse(d, S(head_cx + 8), S(head_cy - 6.4), S(1.2), S(1.3), (255, 255, 255), outline=None)

    # floppy ear — sweeps back when crouched
    ear_lay = rot_ellipse(8, 16, 24 + earf * 14 + 68 * crouch, pal["ear"], ow=2)
    paste_center(img, ear_lay, S(head_cx - 12), S(head_cy - 6 + 3 * crouch))
    d = ImageDraw.Draw(img)

    # helmet dome + brim + strap (the 9-Volt homage — safety first)
    d.pieslice([S(head_cx - 23), S(head_cy - 22), S(head_cx + 23), S(head_cy + 20)],
               start=180, end=360, fill=pal["helmet"], outline=INK, width=S(3))
    rr(d, S(head_cx + 8), S(head_cy - 12), S(16), S(6), 3, pal["helmet"], ow=2)
    d.line([S(head_cx - 10), S(head_cy - 2), S(head_cx + 4), S(head_cy + 10)],
           fill=INK, width=S(2))

    return dn(img)


def dog_sheets():
    sheets = {}
    for name, pal in DOGS.items():
        sheet = Image.new("RGBA", (FW * 8, FH), (0, 0, 0, 0))
        for i in range(8):
            if i < 6:  # ride cycle: bob + leg sway + tail wag + ear flap
                ph = i / 6 * math.tau
                pose = dict(bob=math.sin(ph * 2) * 2.2, leg_phase=math.sin(ph),
                            tail=math.sin(ph * 2 + 1.2), ear=math.sin(ph * 2 + 0.6))
            elif i == 6:  # ollie: board kicked up, knees tucked
                pose = dict(bob=-4, leg_phase=0.4, tail=-0.9, ear=-0.5, crouch=0.42, board_tilt=-14)
            else:        # crouch/duck
                pose = dict(bob=0, leg_phase=0, tail=-0.8, ear=0.4, crouch=0.78)
            frame = draw_dog(pal, pose)
            sheet.paste(frame, (i * FW, 0))
        sheets[name] = sheet
    return sheets


# ── Block tile (the reference game's literal colored cubes) ─────────────────
def block_tile(face, light, dark):
    img = canvas(64, 64)
    d = ImageDraw.Draw(img)
    rr(d, S(2), S(2), S(60), S(60), 7, face, ow=3)
    # top + left light bevel, bottom + right shade — chunky cel cube
    d.line([S(9), S(9), S(55), S(9)], fill=light, width=S(4))
    d.line([S(9), S(9), S(9), S(55)], fill=light, width=S(4))
    d.line([S(9), S(55), S(55), S(55)], fill=dark, width=S(4))
    d.line([S(55), S(9), S(55), S(55)], fill=dark, width=S(4))
    rr(d, S(16), S(16), S(32), S(32), 5, tuple(max(0, c - 14) for c in face[:3]) + (255,), ow=2)
    return dn(img)


def blocks():
    return {
        "pink":   block_tile((224, 84, 158), (250, 168, 208), (148, 44, 96)),
        "yellow": block_tile((234, 196, 54), (250, 232, 140), (164, 126, 22)),
        "teal":   block_tile((64, 182, 168), (150, 228, 216), (30, 118, 108)),
        "purple": block_tile((152, 110, 208), (200, 170, 238), (94, 60, 140)),
    }


# ── Flyers (face LEFT — they approach the player) ───────────────────────────
def draw_fish(body, belly, fin):
    img = canvas(72, 44)
    d = ImageDraw.Draw(img)
    # tail fluke at right (fish faces left)
    d.polygon([(S(52), S(22)), (S(68), S(9)), (S(68), S(35))], fill=fin, outline=INK)
    d.line([(S(52), S(22)), (S(68), S(9)), (S(68), S(35))], fill=INK, width=S(2))
    # body
    ellipse(d, S(32), S(22), S(24), S(15), body, ow=3)
    ellipse(d, S(30), S(27), S(18), S(8), belly, outline=None)
    # dorsal + pectoral fin
    d.polygon([(S(24), S(9)), (S(34), S(2)), (S(42), S(10))], fill=fin, outline=INK)
    fin_lay = rot_ellipse(8, 4, -30, fin, ow=2)
    paste_center(img, fin_lay, S(30), S(26))
    d = ImageDraw.Draw(img)
    # eye + lips (left = front)
    ellipse(d, S(15), S(17), S(3.4), S(3.4), (250, 250, 250), ow=1)
    ellipse(d, S(15), S(17), S(1.8), S(1.8), (30, 26, 26), outline=None)
    ellipse(d, S(7), S(22), S(3.4), S(2.8), fin, ow=2)
    return dn(img)


def draw_whale():
    img = canvas(180, 120)
    d = ImageDraw.Draw(img)
    body = (240, 246, 250)
    shade_c = (200, 216, 230)
    # tail fluke (right = rear)
    d.polygon([(S(148), S(46)), (S(172), S(26)), (S(176), S(48)), (S(168), S(58))],
              fill=body, outline=INK)
    # body
    ellipse(d, S(88), S(60), S(72), S(44), body, ow=3)
    # belly curves
    for i in range(3):
        d.arc([S(30 + i * 8), S(64), S(150 - i * 4), S(104)], start=10, end=80,
              fill=shade_c, width=S(3))
    # pectoral fin
    fin_lay = rot_ellipse(16, 8, -30, shade_c, ow=2)
    paste_center(img, fin_lay, S(82), S(88))
    d = ImageDraw.Draw(img)
    # eye + smile + spout
    ellipse(d, S(36), S(52), S(4), S(4.4), (34, 30, 30), outline=None)
    d.arc([S(24), S(52), S(56), S(78)], start=30, end=110, fill=INK, width=S(2))
    d.line([S(58), S(18), S(58), S(8)], fill=(140, 200, 235), width=S(4))
    ellipse(d, S(58), S(8), S(5), S(4), (170, 220, 245), outline=None)
    return dn(img)


# ── Sky / parallax tiles ────────────────────────────────────────────────────
def puff_cloud(seed, w=130, h=62):
    rng = random.Random(seed)
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    bumps = [(0.28, 0.62, 0.20), (0.5, 0.45, 0.26), (0.72, 0.6, 0.19), (0.5, 0.68, 0.3)]
    for bx, by, br in bumps:
        ellipse(d, S(w * bx), S(h * by), S(w * br), S(h * br * 0.9), (255, 255, 255, 235),
                outline=(210, 228, 240, 255), ow=2)
    rr(d, S(w * 0.2), S(h * 0.6), S(w * 0.6), S(h * 0.28), 10, (255, 255, 255, 235),
       outline=(210, 228, 240, 255), ow=2)
    return dn(img)


def fish_cloud():
    img = canvas(110, 52)
    d = ImageDraw.Draw(img)
    ellipse(d, S(48), S(27), S(30), S(16), (255, 255, 255, 235), outline=(210, 228, 240, 255), ow=2)
    d.polygon([(S(70), S(27)), (S(96), S(13)), (S(96), S(41))], fill=(255, 255, 255, 235),
              outline=(210, 228, 240, 255))
    d.polygon([(S(36), S(13)), (S(48), S(5)), (S(58), S(14))], fill=(255, 255, 255, 235),
              outline=(210, 228, 240, 255))
    ellipse(d, S(32), S(23), S(2.6), S(2.6), (190, 210, 226), outline=None)
    return dn(img)


def skyline_tile(w=512, h=170):
    """Tileable city skyline — mirrored halves so the wrap is seamless."""
    rng = random.Random(11)
    half = Image.new("RGBA", (S(w // 2), S(h)), (0, 0, 0, 0))
    d = ImageDraw.Draw(half)
    tones = [(46, 96, 150), (36, 78, 128), (58, 116, 176)]
    x = 0
    while x < S(w // 2):
        bw = rng.randint(S(26), S(58))
        bh = rng.randint(S(52), S(h - 30))
        tone = tones[rng.randrange(3)]
        d.rectangle([x, S(h) - bh, x + bw, S(h)], fill=tone + (255,))
        # windows
        for wy in range(S(h) - bh + S(8), S(h) - S(8), S(14)):
            for wx in range(x + S(5), x + bw - S(5), S(11)):
                if rng.random() < 0.55:
                    d.rectangle([wx, wy, wx + S(4), wy + S(6)], fill=(140, 190, 235, 200))
        x += bw + rng.randint(S(4), S(12))
    strip = Image.new("RGBA", (S(w), S(h)), (0, 0, 0, 0))
    strip.paste(half, (0, 0))
    strip.paste(half.transpose(Image.FLIP_LEFT_RIGHT), (S(w // 2), 0))
    return dn(strip)


def hedge_tile(w=256, h=64):
    rng = random.Random(7)
    half = Image.new("RGBA", (S(w // 2), S(h)), (0, 0, 0, 0))
    d = ImageDraw.Draw(half)
    d.rectangle([0, S(h * 0.45), S(w // 2), S(h)], fill=(70, 140, 74, 255))
    for i in range(6):
        bx = rng.randint(0, S(w // 2))
        ellipse(d, bx, S(h * 0.5), S(rng.randint(18, 34)), S(h * 0.34), (88, 168, 88, 255), outline=None)
    for i in range(26):  # leaf speckle
        x, y = rng.randint(0, S(w // 2)), rng.randint(S(h * 0.35), S(h * 0.9))
        ellipse(d, x, y, S(3), S(2), (110, 190, 100, 220), outline=None)
    strip = Image.new("RGBA", (S(w), S(h)), (0, 0, 0, 0))
    strip.paste(half, (0, 0))
    strip.paste(half.transpose(Image.FLIP_LEFT_RIGHT), (S(w // 2), 0))
    return dn(strip)


def fence_tile(w=128, h=56):
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    picket = (250, 250, 246)
    d.rectangle([0, S(20), S(w), S(28)], fill=picket, outline=None)
    d.rectangle([0, S(40), S(w), S(48)], fill=picket, outline=None)
    for px in range(S(6), S(w), S(24)):
        d.polygon([(px, S(8)), (px + S(6), S(2)), (px + S(12), S(8)),
                   (px + S(12), S(h)), (px, S(h))], fill=picket, outline=(200, 196, 190))
    return dn(img)


# ── Cover ───────────────────────────────────────────────────────────────────
def cover():
    W, H = 720, 400
    img = Image.new("RGBA", (S(W), S(H)))
    d = ImageDraw.Draw(img)
    for y in range(S(H)):
        t = y / S(H)
        col = (int(110 + 130 * t), int(200 + 40 * t), int(215 + 30 * t))
        d.line([(0, y), (S(W), y)], fill=col)
    # sun
    ellipse(d, S(120), S(86), S(46), S(46), (255, 246, 200, 255), outline=None)
    sky = dn(skyline_tile(512, 170))
    big_sky = sky.resize((S(W) * 2, S(170)), Image.LANCZOS)
    img.alpha_composite(big_sky, (0, S(H - 170 - 66)))
    # ground
    d.rectangle([0, S(H - 66), S(W), S(H)], fill=(150, 158, 168))
    d.rectangle([0, S(H - 66), S(W), S(H - 58)], fill=(186, 194, 202))
    # props: block stack + fish + clouds
    pink = block_tile((224, 84, 158), (250, 168, 208), (148, 44, 96))
    for bx, by in [(0, 0), (1, 0), (0, 1), (1, 1), (0, 2)]:
        b = pink.resize((S(64), S(64)), Image.LANCZOS)
        img.alpha_composite(b, (S(560 + bx * 62), S(H - 66 - 64 - by * 62)))
    fish = draw_fish((226, 92, 84), (250, 208, 190), (178, 60, 54))
    img.alpha_composite(fish.resize((S(72), S(44)), Image.LANCZOS), (S(420), S(150)))
    img.alpha_composite(puff_cloud(3), (S(300), S(60)))
    img.alpha_composite(fish_cloud(), (S(520), S(40)))
    # hero: dog mid-ollie, drawn big
    hero = draw_dog(DOGS["barnaby"], dict(bob=0, leg_phase=0.3, tail=-0.4, ear=-0.3,
                                          crouch=0.2, board_tilt=-8))
    hero = hero.resize((S(255), S(225)), Image.LANCZOS)
    img.alpha_composite(hero, (S(90), S(H - 66 - 215)))
    return dn(img)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(COVERS, exist_ok=True)
    for name, sheet in dog_sheets().items():
        sheet.save(os.path.join(OUT, f"dog_{name}.png"))
    for name, tile in blocks().items():
        tile.save(os.path.join(OUT, f"block_{name}.png"))
    draw_fish((226, 92, 84), (250, 208, 190), (178, 60, 54)).save(os.path.join(OUT, "fish_red.png"))
    draw_fish((90, 160, 226), (200, 232, 250), (56, 110, 180)).save(os.path.join(OUT, "fish_blue.png"))
    draw_whale().save(os.path.join(OUT, "whale.png"))
    puff_cloud(3).save(os.path.join(OUT, "cloud1.png"))
    puff_cloud(8).save(os.path.join(OUT, "cloud2.png"))
    puff_cloud(14, w=150, h=70).save(os.path.join(OUT, "cloud3.png"))
    fish_cloud().save(os.path.join(OUT, "cloud_fish.png"))
    skyline_tile().save(os.path.join(OUT, "skyline.png"))
    hedge_tile().save(os.path.join(OUT, "hedge.png"))
    fence_tile().save(os.path.join(OUT, "fence.png"))
    cover().save(os.path.join(COVERS, "cover-puppyskater.png"))
    print("wrote assets to", OUT)


if __name__ == "__main__":
    main()
