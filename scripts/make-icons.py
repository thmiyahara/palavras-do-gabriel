"""Build the PWA icons from public/img/teddy.png with Pillow (pip install pillow)."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "img" / "teddy.png"
OUT = ROOT / "public"
BG = (255, 209, 102, 255)  # #ffd166, same as the manifest theme_color


def build(size: int, scale: float, radius: float, name: str, opaque: bool = False) -> None:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * radius), fill=BG
    )
    icon = Image.open(SRC).convert("RGBA")
    side = int(size * scale)
    icon = icon.resize((side, side), Image.LANCZOS)
    canvas.alpha_composite(icon, ((size - side) // 2, (size - side) // 2))
    if opaque:
        canvas = canvas.convert("RGB")
    canvas.save(OUT / name, optimize=True)
    print("ok", name)


build(192, 0.80, 0.22, "pwa-192x192.png")
build(512, 0.80, 0.22, "pwa-512x512.png")
build(512, 0.62, 0.00, "pwa-maskable-512x512.png")  # full-bleed, icon inside the safe zone
build(180, 0.80, 0.00, "apple-touch-icon.png", opaque=True)  # iOS rounds the corners itself
