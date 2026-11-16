"""Render the plugin promo clip (frames + audio) and mux it with ffmpeg.

    python tools/make-promo.py            # full render -> promo/dsh-status-light-promo.mp4
    python tools/make-promo.py --test     # six sample frames -> promo/_test/

The tower comes from assets/tower-source.png; bands are detected from the image,
so the recolor follows the screenshot instead of hard-coded coordinates.
"""

from __future__ import annotations

import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "tower-source.png"
OUT = ROOT / "promo"
FRAMES = OUT / "frames"
AUDIO = OUT / "audio.wav"
VIDEO = OUT / "dsh-status-light-promo.mp4"
POSTER = OUT / "poster.png"
FFMPEG = Path(r"C:\Program Files\File Converter\ffmpeg.exe")

W, H = 1280, 720
FPS = 24
SR = 44100

BG_TOP = (20, 20, 22)
BG_BOTTOM = (20, 20, 22)
TEXT = (238, 241, 245)
MUTED = (154, 164, 178)
RED = (255, 59, 48)
AMBER = (255, 176, 32)
GREEN = (52, 199, 89)

HEAD = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 46)
TITLE = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 62)
BODY = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 26)
SMALL = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 20)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 22)


# --------------------------------------------------------------------------- art
def background() -> Image.Image:
    image = Image.new("RGBA", (W, H), BG_TOP + (255,))
    return image


def detect_bands(tower: Image.Image) -> dict[str, tuple[int, int]]:
    array = np.asarray(tower.convert("RGB"), dtype=float)
    height = array.shape[0]
    rows = array.mean(axis=1)
    labels = []
    for red, green, blue in rows:
        if min(red, green, blue) > 95:
            labels.append("white")
        elif red > green * 1.35 and red > blue * 1.6:
            labels.append("red")
        elif green > red * 1.15 and green > blue * 1.3:
            labels.append("green")
        elif red > blue * 1.4 and green > blue * 1.2:
            labels.append("amber")
        else:
            labels.append("other")

    bands: dict[str, tuple[int, int]] = {}
    start = 0
    for index in range(1, height + 1):
        if index == height or labels[index] != labels[start]:
            if labels[start] in ("red", "amber", "green") and index - start >= 30:
                bands.setdefault(labels[start], (start, index))
            start = index
    return bands


def trim_source(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    background_color = tuple(int(sum(channel[i] for channel in [rgb.getpixel((0, 0)), rgb.getpixel((rgb.width - 1, 0))]) / 2) for i in range(3))
    array = np.asarray(rgb, dtype=float)
    diff = np.abs(array - np.array(background_color, dtype=float)).sum(axis=2)
    ys, xs = np.where(diff > 24)
    if len(xs) == 0:
        return rgb
    return rgb.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


TOWER_BASE = trim_source(Image.open(SRC))
BANDS = detect_bands(TOWER_BASE)


def tower_for(state: str) -> tuple[Image.Image, Image.Image]:
    """Return (tower, bloom) for one lamp state; bloom is additive light on top."""
    rgb = np.asarray(TOWER_BASE, dtype=float)
    result = rgb.copy()
    targets = {"red": RED, "amber": AMBER, "green": GREEN}
    band_box = None

    for name, (top, bottom) in BANDS.items():
        band = rgb[top:bottom]
        if name == state:
            # keep the photo's own shading: just lift the exposure of that lens
            result[top:bottom] = np.clip(band * LIT_BOOST[name], 0, 255)
            band_box = (top, bottom)
        else:
            result[top:bottom] = band * 0.34

    tower = Image.fromarray(result.astype(np.uint8), "RGB").convert("RGBA")
    bloom = Image.new("RGBA", (TOWER_BASE.width + BLOOM_PAD * 2, TOWER_BASE.height), (0, 0, 0, 0))
    if band_box is not None:
        top, bottom = band_box
        colour = targets[state]
        centre = (top + bottom) / 2
        half = (bottom - top) * 0.55
        width = TOWER_BASE.width * 1.3
        cx = TOWER_BASE.width / 2 + BLOOM_PAD
        ImageDraw.Draw(bloom).ellipse((cx - width / 2, centre - half, cx + width / 2, centre + half), fill=colour + (120,))
        bloom = bloom.filter(ImageFilter.GaussianBlur(24))
    return tower, bloom


BLOOM_PAD = 60
LIT_BOOST = {"red": 2.8, "amber": 2.8, "green": 1.6}
TOWER_STATES = {name: tower_for(name) for name in ("red", "amber", "green", "off")}
TOWER_H = 566
TOWER_W = round(TOWER_BASE.width * TOWER_H / TOWER_BASE.height)
TOWER_X = 958
TOWER_Y = 74


def build_scaled() -> dict[str, tuple[Image.Image, Image.Image, int, int]]:
    scale = TOWER_H / TOWER_BASE.height
    scaled = {}
    for name, (tower, bloom) in TOWER_STATES.items():
        bloom_width = round((TOWER_BASE.width + BLOOM_PAD * 2) * scale)
        scaled[name] = (
            tower.resize((TOWER_W, TOWER_H), Image.LANCZOS),
            bloom.resize((bloom_width, TOWER_H), Image.LANCZOS),
            TOWER_X - round(BLOOM_PAD * scale),
            TOWER_Y,
        )
    return scaled


SCALED = build_scaled()


def draw_tower(canvas: Image.Image, state: str) -> None:
    tower, bloom, bloom_x, bloom_y = SCALED[state]
    canvas.alpha_composite(tower, (TOWER_X, TOWER_Y))
    canvas.alpha_composite(bloom, (bloom_x, bloom_y))


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def text_block(canvas: Image.Image, lines, x: int, y: int, progress: float) -> int:
    """Draw [(text, font, color, gap_after), ...] with a fade + slide."""
    alpha = ease(progress)
    if alpha <= 0:
        return y
    offset = round((1 - alpha) * 16)
    for text, font, color, gap in lines:
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((x, y + offset), text, font=font, fill=color + (round(255 * alpha),))
        canvas.alpha_composite(layer)
        y += font.size + gap
    return y


def chip(canvas: Image.Image, x: int, y: int, color, label: str, font, progress: float) -> None:
    alpha = ease(progress)
    if alpha <= 0:
        return
    draw = ImageDraw.Draw(canvas)
    width = draw.textlength(label, font=font) + 44
    box = (x, y, x + width, y + 34)
    draw.rounded_rectangle(box, radius=17, fill=color + (round(52 * alpha),), outline=color + (round(200 * alpha),), width=1)
    draw.ellipse((x + 14, y + 12, x + 24, y + 22), fill=color + (round(255 * alpha),))
    draw.text((x + 32, y + 5), label, font=font, fill=TEXT + (round(255 * alpha),))


def scene_fade(local: float, duration: float) -> float:
    """Black overlay alpha: dip in over the first frames and out over the last."""
    fade = 0.28
    if local < fade:
        return 1 - local / fade
    if local > duration - fade:
        return (local - (duration - fade)) / fade
    return 0.0


# ------------------------------------------------------------------------- audio
def synth_square(start: float, duration: float, frequency: float, amplitude: float) -> np.ndarray:
    total = int(SR * duration)
    time = np.arange(total) / SR
    wave_data = np.sign(np.sin(2 * math.pi * frequency * time))
    # one-pole low-pass so the square does not sound like a chirp
    alpha = 1 - math.exp(-2 * math.pi * 3200 / SR)
    smoothed = np.empty_like(wave_data)
    acc = 0.0
    for index, sample in enumerate(wave_data):
        acc += alpha * (sample - acc)
        smoothed[index] = acc
    envelope = np.ones_like(smoothed)
    attack = int(SR * 0.012)
    release = int(SR * 0.06)
    envelope[:attack] = np.linspace(0, 1, attack)
    envelope[-release:] = np.linspace(1, 0, release)
    tone = smoothed * envelope * amplitude
    buffer = np.zeros(int(SR * start) + total)
    buffer[int(SR * start) : int(SR * start) + total] = tone
    return buffer


def build_audio(total_seconds: float) -> None:
    length = int(SR * total_seconds)
    track = np.zeros(length)
    events = []
    # red scene: two 1 s bursts with a 0.6 s gap
    events.append((3.0, 1.0))
    events.append((4.6, 1.0))
    # idle chime: the plugin's 0.3 / 0.4 / 1.0 / 1.4 pattern
    for offset in (0.0, 0.4, 1.0, 1.4):
        events.append((10.0 + offset, 0.3))

    for start, duration in events:
        tone = synth_square(start, duration, 2100, 0.16)
        end = min(length, len(tone))
        track[:end] += tone[:end]

    peak = float(np.max(np.abs(track))) or 1.0
    track = track / peak * 0.85
    stereo = np.repeat((track * 32767).astype(np.int16)[:, None], 2, axis=1)
    with wave.open(str(AUDIO), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(stereo.tobytes())


# ------------------------------------------------------------------------ scenes
def scene_intro(t: float, duration: float) -> Image.Image:
    canvas = background()
    draw_tower(canvas, "off")
    draw = ImageDraw.Draw(canvas)
    draw.text((96, 210), "工作区对话信号灯", font=TITLE, fill=TEXT)
    draw.text((100, 292), "Workspace Status Light", font=BODY, fill=MUTED)
    text_block(
        canvas,
        [
            ("把 Harness 里所有对话的状态，收进一座工厂信号塔", BODY, MUTED, 14),
            ("红灯等你 · 黄灯在跑 · 绿灯空闲", SMALL, MUTED, 0),
        ],
        100,
        380,
        (t - 0.35) / 0.5,
    )
    return canvas


def scene_state(t: float, duration: float, state: str, kind: str, heading: str, lines, tone) -> Image.Image:
    canvas = background()
    if kind == "green":
        # three blinks, then steady
        local = t
        on = True
        if local < 5.0:
            phase = (local % 1.7)
            on = phase < 1.2
        draw_tower(canvas, state if on else "off")
    elif kind == "red":
        # flash with the buzzer: 1 s lit, 0.6 s dark
        phase = t % 1.6
        draw_tower(canvas, state if phase < 1.0 else "off")
    else:
        draw_tower(canvas, state)

    chip(canvas, 96, 120, tone, heading, BODY, (t - 0.1) / 0.4)
    text_block(canvas, lines, 96, 200, (t - 0.25) / 0.5)
    return canvas


def scene_settings(t: float, duration: float) -> Image.Image:
    canvas = background()
    draw_tower(canvas, "green")
    draw = ImageDraw.Draw(canvas, "RGBA")

    x, y, width, height = 96, 110, 540, 440
    draw.rounded_rectangle((x, y, x + width, y + height), radius=18, fill=(24, 28, 34, 235), outline=(70, 78, 90, 255), width=1)
    draw.text((x + 24, y + 20), "信号灯设置", font=HEAD, fill=TEXT)

    rows = [
        ("蜂鸣器", "switch"),
        ("红灯音效音量", "45%"),
        ("红灯音效", "默认"),
        ("转绿提示音量", "45%"),
        ("转绿提示音", "默认"),
        ("信号塔大小", "40px"),
    ]
    cursor = y + 92
    for label, value in rows:
        draw.text((x + 24, cursor), label, font=SMALL, fill=MUTED)
        if value == "switch":
            draw.rounded_rectangle((x + width - 86, cursor - 2, x + width - 46, cursor + 18), radius=10, fill=(77, 141, 255, 255))
            draw.ellipse((x + width - 66, cursor, x + width - 48, cursor + 16), fill=(255, 255, 255, 255))
        elif value.endswith("%") or value.endswith("px"):
            track_x0, track_x1 = x + 250, x + width - 96
            draw.line((track_x0, cursor + 9, track_x1, cursor + 9), fill=(78, 86, 98, 255), width=4)
            fraction = 0.45 if value.endswith("%") else 0.35
            knob = track_x0 + (track_x1 - track_x0) * fraction
            draw.line((track_x0, cursor + 9, knob, cursor + 9), fill=(77, 141, 255, 255), width=4)
            draw.ellipse((knob - 7, cursor + 2, knob + 7, cursor + 16), fill=(240, 244, 250, 255))
            draw.text((x + width - 88, cursor), value, font=SMALL, fill=TEXT)
        else:
            draw.text((x + width - 88, cursor), value, font=SMALL, fill=TEXT)
        cursor += 52

    text_block(
        canvas,
        [
            ("右键灯塔，实时调整", HEAD, TEXT, 12),
            ("两种音效音量分开调，可换成本地音频文件", SMALL, MUTED, 4),
            ("信号塔大小 16–160 px 随心缩放", SMALL, MUTED, 0),
        ],
        96,
        568,
        (t - 0.4) / 0.6,
    )
    return canvas


def scene_outro(t: float, duration: float) -> Image.Image:
    canvas = background()
    draw_tower(canvas, "green")
    draw = ImageDraw.Draw(canvas)
    draw.text((96, 250), "工厂式状态灯", font=HEAD, fill=TEXT)
    draw.text((96, 316), "github.com/YunJianFengYin/dsh-status-light", font=MONO, fill=(150, 200, 255))
    text_block(
        canvas,
        [
            ("一行插件命令即装 · 无需构建 · 无第三方依赖", SMALL, MUTED, 6),
            ("GPL-3.0 · 开源免费", SMALL, MUTED, 0),
        ],
        96,
        380,
        (t - 0.3) / 0.6,
    )
    return canvas


SCENES = [
    (2.6, scene_intro),
    (4.2, lambda t, d: scene_state(t, d, "red", "red", "有对话在等你", [("红灯闪烁 + 蜂鸣（响 1 s / 停 0.6 s）", BODY, TEXT, 16), ("多个对话自动合并：等待 > 运行 > 空闲", SMALL, MUTED, 0)], RED)),
    (2.8, lambda t, d: scene_state(t, d, "amber", "amber", "有对话正在运行", [("黄灯闪烁，忙而不扰", BODY, TEXT, 16), ("其余对话空闲时自动回落", SMALL, MUTED, 0)], AMBER)),
    (3.2, lambda t, d: scene_state(t, d, "green", "green", "全部空闲", [("绿灯先闪 3 下，再常亮", BODY, TEXT, 16), ("任一对话转为空闲，短促提示两声", SMALL, MUTED, 0)], GREEN)),
    (3.6, scene_settings),
    (2.6, scene_outro),
]


def compose(seconds: float) -> Image.Image:
    elapsed = 0.0
    for duration, draw_scene in SCENES:
        if seconds < elapsed + duration or draw_scene is SCENES[-1][1]:
            local = min(seconds - elapsed, duration)
            canvas = draw_scene(max(0.0, local), duration)
            alpha = scene_fade(max(0.0, local), duration)
            if alpha > 0:
                overlay = Image.new("RGBA", canvas.size, (0, 0, 0, round(255 * alpha)))
                canvas.alpha_composite(overlay)
            return canvas
        elapsed += duration
    return SCENES[-1][1](0, SCENES[-1][0])


def total_seconds() -> float:
    return sum(duration for duration, _ in SCENES)


def render() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    total = total_seconds()
    count = int(total * FPS)
    for index in range(count):
        frame = compose(index / FPS)
        frame.convert("RGB").save(FRAMES / f"{index:04d}.png", compress_level=3)
    print(f"frames: {count} -> {FRAMES}")
    build_audio(total + 0.5)
    compose(1.2).convert("RGB").save(POSTER)

    subprocess.run(
        [
            str(FFMPEG), "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", str(FPS), "-i", str(FRAMES / "%04d.png"),
            "-i", str(AUDIO),
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
            str(VIDEO),
        ],
        check=True,
    )
    print(f"video: {VIDEO} ({VIDEO.stat().st_size / 1e6:.1f} MB)")


def render_test() -> None:
    target = OUT / "_test"
    target.mkdir(parents=True, exist_ok=True)
    for seconds in (1.4, 3.2, 7.4, 10.2, 13.9, 17.4):
        compose(seconds).convert("RGB").save(target / f"t{seconds:05.1f}.png")
    print(f"test frames -> {target}")


if __name__ == "__main__":
    if "--test" in sys.argv:
        render_test()
    else:
        render()
