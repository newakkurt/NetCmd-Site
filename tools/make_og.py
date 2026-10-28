#!/usr/bin/env python3
"""assets/og.png (1200x630) üretir. Gereken: Pillow. Çalıştır: python3 tools/make_og.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "assets" / "og.png"
W, H = 1200, 630
BG, FG, MUT, AC, AC2 = (5, 10, 15), (226, 240, 234), (143, 168, 160), (61, 224, 255), (57, 255, 156)
FD = "/usr/share/fonts/truetype/dejavu/"


def font(name, size):
    try:
        return ImageFont.truetype(FD + name, size)
    except OSError:
        return ImageFont.load_default()


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
for x in range(0, W, 40):
    d.line([(x, 0), (x, H)], fill=(10, 24, 30), width=1)
for y in range(0, H, 40):
    d.line([(0, y), (W, y)], fill=(10, 24, 30), width=1)
d.rectangle([0, 0, 10, H], fill=AC2)
d.text((70, 90), "$ netcmd", font=font("DejaVuSansMono.ttf", 40), fill=AC2)
d.text((70, 170), "NetCmd", font=font("DejaVuSans-Bold.ttf", 130), fill=FG)
d.text((70, 330), "Network Command Equivalents", font=font("DejaVuSans-Bold.ttf", 48), fill=AC)
d.text((70, 400), "VLAN · OSPF · BGP · ACL · STP · L2 Security", font=font("DejaVuSansMono.ttf", 32), fill=MUT)
x = 70
for name in ("Cisco", "Huawei", "Aruba", "Juniper", "MikroTik"):
    f = font("DejaVuSans-Bold.ttf", 30)
    w = d.textlength(name, font=f) + 44
    d.rounded_rectangle([x, 490, x + w, 548], radius=14, outline=AC, width=2, fill=(9, 20, 26))
    d.text((x + 22, 504), name, font=f, fill=FG)
    x += w + 16
d.text((W - 70, H - 50), "netcmd-site.onrender.com", font=font("DejaVuSansMono.ttf", 26), fill=MUT, anchor="rs")
img.save(OUT, optimize=True)
print("yazıldı:", OUT, OUT.stat().st_size, "bayt")
