"""Build the plugin icon (.ico) from the captured tower image.

Source: assets/tower-source.png (a screenshot of the rendered tower). The script
trims its background, composes a rounded 512 px tile with the tower centred, and
writes assets/icon.ico with the usual Windows sizes plus a PNG preview.

    python tools/make-ico.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "tower-source.png"
ICO = ROOT / "assets" / "icon.ico"
PREVIEW = ROOT / "assets" / "icon-256.png"

MASTER = 512
RADIUS = 112
# Keep the whole device; the tile is rounded, so leave a little margin around it.
CROP_RATIO = 1.0
HEIGHT_RATIO = 0.88
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def background_color(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    corners = [
        image.getpixel((0, 0)),
        image.getpixel((width - 1, 0)),
        image.getpixel((0, height - 1)),
        image.getpixel((width - 1, height - 1)),
    ]
    return tuple(sum(channel[i] for channel in corners) // len(corners) for i in range(3))


def trim(image: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    width, height = image.size
    pixels = image.load()
    left, top, right, bottom = width, height, -1, -1
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            if abs(pixel[0] - background[0]) + abs(pixel[1] - background[1]) + abs(pixel[2] - background[2]) > 24:
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
    if right < 0:
        return image
    return image.crop((left, top, right + 1, bottom + 1))


def main() -> None:
    source = Image.open(SRC).convert("RGB")
    background = background_color(source)
    tower = trim(source, background)
    tower = tower.crop((0, 0, tower.width, max(1, round(tower.height * CROP_RATIO))))
    print(f"source {source.size} background {background} trimmed {tower.size}")

    target_height = round(MASTER * HEIGHT_RATIO)
    target_width = max(1, round(tower.width * target_height / tower.height))
    tower = tower.resize((target_width, target_height), Image.LANCZOS)

    canvas = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle((0, 0, MASTER - 1, MASTER - 1), radius=RADIUS, fill=background + (255,))
    canvas.alpha_composite(tower.convert("RGBA"), ((MASTER - target_width) // 2, (MASTER - target_height) // 2))

    canvas.resize((256, 256), Image.LANCZOS).save(PREVIEW)
    canvas.save(ICO, sizes=ICO_SIZES)
    print(f"wrote {ICO} and {PREVIEW}")


if __name__ == "__main__":
    main()
