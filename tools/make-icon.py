"""Generate the storefront tile (assets/icon.png) from code.

The marketplace tile must be a GitHub-hosted raster image, so this script draws
the same stack light the plugin renders: a light grey head with red, amber and
green ribbed lenses. Run it with the bundled Python (Pillow is available there):

    python tools/make-icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 512
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icon.png"


def vertical_gradient(width: int, height: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    strip = Image.new("RGBA", (1, height))
    for y in range(height):
        t = y / max(1, height - 1)
        strip.putpixel(
            (0, y),
            tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,),
        )
    return strip.resize((width, height))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def paste_gradient(canvas: Image.Image, box: tuple[int, int, int, int], top, bottom, radius: int) -> None:
    width = box[2] - box[0]
    height = box[3] - box[1]
    layer = vertical_gradient(width, height, top, bottom)
    canvas.paste(layer, (box[0], box[1]), rounded_mask((width, height), radius))


def lens(canvas: Image.Image, box: tuple[int, int, int, int], light, dark, radius: int = 8) -> None:
    # soft outer glow first, so the lens looks lit
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle(box, radius=radius, fill=dark + (110,))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))
    paste_gradient(canvas, box, light, dark, radius)
    # vertical highlight on the left third
    shine = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shine).rounded_rectangle(
        (box[0] + 6, box[1] + 6, box[0] + 30, box[3] - 6), radius=10, fill=(255, 255, 255, 70)
    )
    canvas.alpha_composite(shine)


def main() -> None:
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    background = vertical_gradient(SIZE, SIZE, (28, 33, 40), (11, 14, 18))
    canvas.paste(background, (0, 0), rounded_mask((SIZE, SIZE), 112))

    white_top = (250, 251, 252)
    white_bottom = (205, 210, 217)
    left, right = 186, 326

    paste_gradient(canvas, (left, 60, right, 78), white_top, white_bottom, 8)          # cap
    lens(canvas, (left, 88, right, 172), (255, 138, 128), (196, 38, 30))                # red
    paste_gradient(canvas, (left, 172, right, 182), white_top, white_bottom, 3)        # spacer
    lens(canvas, (left, 182, right, 266), (255, 208, 138), (208, 128, 0))              # amber
    paste_gradient(canvas, (left, 266, right, 276), white_top, white_bottom, 3)        # spacer
    lens(canvas, (left, 276, right, 360), (157, 240, 182), (28, 140, 62))              # green
    paste_gradient(canvas, (left, 360, right, 448), white_top, white_bottom, 8)        # body

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, "PNG")
    print(f"wrote {OUT} ({canvas.width}x{canvas.height})")


if __name__ == "__main__":
    main()
