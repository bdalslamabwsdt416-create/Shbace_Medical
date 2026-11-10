#!/usr/bin/env python3
"""Generate Android launcher icons for every density from the OFFICIAL logo (branding/logo-source.png).
The logo is only scaled (Lanczos); it is never redrawn or altered.
Usage: python3 tools/make_icons.py"""
import os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
logo = Image.open(os.path.join(ROOT, 'branding', 'logo-source.png')).convert('RGBA')
BG = (3, 11, 31, 255)   # #030B1F  = app background colour
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def scaled(px):
    return logo.resize((px, px), Image.LANCZOS)

for d, k in DENS.items():
    out = os.path.join(RES, 'mipmap-' + d); os.makedirs(out, exist_ok=True)
    # legacy square icon: the full logo (it already has its own rounded corners / transparency)
    size = int(round(48 * k))
    scaled(size).save(os.path.join(out, 'ic_launcher.png'), optimize=True)
    # legacy round icon: logo on a navy disc, scaled to sit inside the circle
    big = size * 4
    disc = Image.new('RGBA', (big, big), (0, 0, 0, 0)); ImageDraw.Draw(disc).ellipse((0, 0, big - 1, big - 1), fill=BG)
    inner = int(big * 0.86); l = logo.resize((inner, inner), Image.LANCZOS)
    disc.alpha_composite(l, ((big - inner) // 2, (big - inner) // 2))
    mask = Image.new('L', (big, big), 0); ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    disc.putalpha(Image.composite(disc.getchannel('A'), Image.new('L', (big, big), 0), mask))
    disc.resize((size, size), Image.LANCZOS).save(os.path.join(out, 'ic_launcher_round.png'), optimize=True)
    # adaptive foreground: 108dp canvas, logo inside the 72dp safe zone (about 70 % of the canvas)
    fg = int(round(108 * k)); canvas = Image.new('RGBA', (fg, fg), (0, 0, 0, 0))
    inner = int(round(fg * 0.70)); canvas.alpha_composite(scaled(inner), ((fg - inner) // 2, (fg - inner) // 2))
    canvas.save(os.path.join(out, 'ic_launcher_foreground.png'), optimize=True)

# Play Store listing icon (512x512, full-bleed on navy)
os.makedirs(os.path.join(ROOT, 'branding'), exist_ok=True)
store = Image.new('RGBA', (512, 512), BG); store.alpha_composite(logo.resize((512, 512), Image.LANCZOS))
store.convert('RGB').save(os.path.join(ROOT, 'branding', 'play-store-icon-512.png'), optimize=True)
print('icons written to', RES)
