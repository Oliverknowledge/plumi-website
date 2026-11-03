#!/usr/bin/env python3
"""
Grades the social cut's raw frames toward the lofi.town look, adds the fade, the pixel font captions and the wordmark, and encodes the mp4.

  python3 tools/clip/grade.py --frames DIR/landscape --out OUT.mp4 [--config tools/clip/social.json] [--still a-0080 --out still.png]

The grade is per pixel and per hue (numpy): grass is lifted and softened toward a pale fresh yellow green, gold canopies and orange roofs are
desaturated a notch, shadows are lifted toward cream, highlights warmed, plus a soft vignette. Nothing is filtered or scaled: the art stays
pixel crisp. The captions are drawn in the app's pixel font (Pixelify Sans) at an integer multiple of its grid, 2 px dark outline, no antialiasing.
"""
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def rgb2hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); d = mx - mn
    dd = np.where(d == 0, 1, d)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    h = np.where(d == 0, 0, h)
    s = np.where(mx == 0, 0, d / np.where(mx == 0, 1, mx))
    return h, s, mx

def hsv2rgb(h, s, v):
    c = v * s; hp = (h % 360) / 60; x = c * (1 - np.abs(hp % 2 - 1)); m = v - c
    z = np.zeros_like(h)
    conds = [hp < 1, hp < 2, hp < 3, hp < 4, hp < 5, hp >= 5]
    r = np.select(conds, [c, x, z, z, x, c]); g = np.select(conds, [x, c, c, x, z, z]); b = np.select(conds, [z, z, x, c, c, x])
    return np.stack([r + m, g + m, b + m], -1)

def blend(P, u):
    """The tuned grade at strength u (0 = the raw frame, 1 = the full match to the reference): every parameter moves toward its neutral value."""
    m = lambda x: 1 + (x - 1) * u
    return {"grass": {"sat": m(P["grass"]["sat"]), "val": P["grass"]["val"] * u}, "gold": {"sat": m(P["gold"]["sat"]), "val": P["gold"]["val"] * u},
            "orange": {"sat": m(P["orange"]["sat"]), "val": P["orange"]["val"] * u}, "other_sat": m(P["other_sat"]), "lift": P["lift"] * u,
            "exposure": m(P.get("exposure", 1.0)), "gain": [m(x) for x in P["gain"]], "vignette": P["vignette"]}

def grade(img, P):
    if "strength" in P: P = blend(P, P["strength"])
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    H, W = a.shape[:2]
    h, s, v = rgb2hsv(a)
    wg = smooth(h, 54, 66) * (1 - smooth(h, 100, 114)) * smooth(s, 0.10, 0.22)                 # grass: yellow green
    wy = smooth(h, 30, 38) * (1 - smooth(h, 50, 58)) * smooth(s, 0.40, 0.55)                    # gold canopies, flowers
    wo = smooth(h, 6, 12) * (1 - smooth(h, 30, 36)) * smooth(s, 0.50, 0.65) * smooth(v, 0.55, 0.7)   # orange roofs
    rest = np.clip(1 - wg - wy - wo, 0, 1)
    gs, gv = P["grass"]["sat"], P["grass"]["val"]; ys, yv = P["gold"]["sat"], P["gold"]["val"]; os_, ov = P["orange"]["sat"], P["orange"]["val"]
    s2 = s * (wg * gs + wy * ys + wo * os_ + rest * P["other_sat"])
    v2 = v + wg * gv + wy * yv + wo * ov
    out = hsv2rgb(h, np.clip(s2, 0, 1), np.clip(v2, 0, 1))
    out *= P.get("exposure", 1.0)
    # creamy shadows: lift the darks toward a warm cream instead of crushing them to brown
    lum = (0.2126 * out[..., 0] + 0.7152 * out[..., 1] + 0.0722 * out[..., 2])
    k = (P["lift"] * (1 - lum) ** 2)[..., None]
    cream = np.array([0.93, 0.84, 0.66], np.float32)
    out = out * (1 - k) + cream * k * (0.55 + 0.45 * lum[..., None])
    out *= np.array(P["gain"], np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r2 = ((xx - W / 2) / (W / 2)) ** 2 * 0.6 + ((yy - H / 2) / (H / 2)) ** 2 * 0.9
    vig = 1 - P["vignette"] * np.clip(r2 - 0.25, 0, 1.2) ** 1.2
    out *= vig[..., None] * np.array([1.0, 0.985, 0.95], np.float32) ** (1 - vig[..., None]) if False else vig[..., None]
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))


from PIL import ImageFilter

def chunky(font_path, px, text, scale, outline, fill=(255, 250, 238), ink=(46, 28, 20), maxw=None, alpha=1.0):
    """Big pixel type: the 1 bit glyphs scaled up by a whole number (one font pixel = `scale` screen pixels), a dark outline `outline` px wide and a soft shadow.
    Wraps to two lines (or steps the scale down) when `maxw` would be exceeded."""
    font = ImageFont.truetype(font_path, px)
    def mask_of(t):
        d0 = ImageDraw.Draw(Image.new("L", (1, 1))); d0.fontmode = "1"
        bb = d0.textbbox((0, 0), t, font=font)
        m = Image.new("L", (bb[2] - bb[0] + 2, bb[3] - bb[1] + 2), 0); d = ImageDraw.Draw(m); d.fontmode = "1"
        d.text((1 - bb[0], 1 - bb[1]), t, font=font, fill=255)
        return m
    lines = [text]
    sc = scale
    while True:
        ms = [mask_of(t) for t in lines]
        w = max(m.width for m in ms) * sc
        if maxw is None or w <= maxw: break
        if len(lines) == 1 and " " in text:
            words = text.split(" "); half = len(text) / 2; best = min(range(1, len(words)), key=lambda i: abs(len(" ".join(words[:i])) - half)); lines = [" ".join(words[:best]), " ".join(words[best:])]
        else: sc -= 1
    gap = 2
    H = sum(m.height for m in ms) + gap * (len(ms) - 1); Wd = max(m.width for m in ms)
    base = Image.new("L", (Wd, H), 0); y = 0
    for m in ms: base.paste(m, (0, y)); y += m.height + gap
    big = base.resize((Wd * sc, H * sc), Image.NEAREST)
    pad = outline + 14
    canvas = Image.new("L", (big.width + 2 * pad, big.height + 2 * pad), 0); canvas.paste(big, (pad, pad))
    ol = canvas.filter(ImageFilter.MaxFilter(2 * outline + 1))
    sh = ol.filter(ImageFilter.GaussianBlur(5))
    out = np.zeros((canvas.height, canvas.width, 4), np.float32)
    sha = np.asarray(sh).astype(np.float32) / 255 * 0.45
    out[..., :3] = ink; out[..., 3] = 0
    shifted = np.zeros_like(sha); shifted[6:] = sha[:-6]
    out[..., 3] = shifted
    ola = np.asarray(ol).astype(np.float32) / 255
    out[..., :3] = np.where(ola[..., None] > 0.5, np.array(ink, np.float32), out[..., :3]); out[..., 3] = np.maximum(out[..., 3], ola)
    fa = np.asarray(canvas).astype(np.float32) / 255
    out[..., :3] = np.where(fa[..., None] > 0.5, np.array(fill, np.float32), out[..., :3]); out[..., 3] = np.maximum(out[..., 3], fa)
    out[..., 3] *= 255 * alpha
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA"), pad

def scrim(W, H, pos, strength, a):
    """A soft dark gradient from the top (or bottom) edge, so type over a busy picture always reads."""
    n = int(H * 0.30); ramp = (1 - np.linspace(0, 1, n)) ** 1.6 * strength * a
    arr = np.zeros((H, W), np.float32)
    if pos == "top": arr[:n] = ramp[:, None]
    else: arr[H - n:] = ramp[::-1][:, None]
    rgba = np.zeros((H, W, 4), np.uint8); rgba[..., 0], rgba[..., 1], rgba[..., 2] = 28, 16, 10; rgba[..., 3] = (arr * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")

def aa(img, S):
    """Anti-aliases the picture (the labels are not in it): a light gaussian then an unsharp mask, so stair steps soften but outlines stay readable."""
    if not S: return img
    im = img.filter(ImageFilter.GaussianBlur(S["sigma"]))
    if S.get("unsharp"): im = im.filter(ImageFilter.UnsharpMask(S.get("radius", 1.6), S["unsharp"], 0))
    return im

def add_labels(img, base):
    """The labels (name tags, bubbles) were captured over black and over white: colour and alpha come back from the pair, and go on top unsmoothed."""
    kp, wp = base + "k.png", base + "w.png"
    if not os.path.exists(kp): return img
    k = np.asarray(Image.open(kp).convert("RGB")).astype(np.float32); w = np.asarray(Image.open(wp).convert("RGB")).astype(np.float32)
    al = np.clip(1 - (w - k).mean(-1) / 255, 0, 1)
    rgb = np.where(al[..., None] > 0.003, k / np.maximum(al[..., None], 0.003), 0)
    base_a = np.asarray(img).astype(np.float32)
    out = base_a * (1 - al[..., None]) + np.clip(rgb, 0, 255) * al[..., None]
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))

class Text:
    """Pixel font text, crisp: drawn small with antialiasing off, outlined, then scaled up by a whole number so one font pixel is k art pixels."""
    def __init__(self, font_path, px, k):
        self.font = ImageFont.truetype(font_path, px); self.k = k
    def render(self, text, fill=(255, 250, 238), ink=(58, 38, 28), outline=1, alpha=1.0):
        d0 = ImageDraw.Draw(Image.new("L", (1, 1))); d0.fontmode = "1"
        bb = d0.textbbox((0, 0), text, font=self.font)
        w, h = bb[2] - bb[0] + 2 * outline + 2, bb[3] - bb[1] + 2 * outline + 2
        m = Image.new("L", (w, h), 0); dm = ImageDraw.Draw(m); dm.fontmode = "1"
        dm.text((outline + 1 - bb[0], outline + 1 - bb[1]), text, font=self.font, fill=255)
        mask = np.asarray(m) > 127
        olm = np.zeros_like(mask)
        for dy in range(-outline, outline + 1):
            for dx in range(-outline, outline + 1):
                olm |= np.roll(np.roll(mask, dy, 0), dx, 1)
        rgba = np.zeros((h, w, 4), np.uint8)
        rgba[olm] = (*ink, 255); rgba[mask] = (*fill, 255)
        im = Image.fromarray(rgba, "RGBA").resize((w * self.k, h * self.k), Image.NEAREST)
        if alpha < 1: im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
        return im

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames"); ap.add_argument("--out"); ap.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "social.json"))
    ap.add_argument("--still"); ap.add_argument("--aspect", default=None); ap.add_argument("--crf", default="16"); ap.add_argument("--nograde", action="store_true")
    a = ap.parse_args()
    cfg = json.load(open(a.config)); root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    if a.still:
        img = Image.open(os.path.join(a.frames, a.still + ".png"))
        P = cfg["grade"]["outdoor" if a.still.startswith("a") else "indoor"]
        grade(img, P).save(a.out); return
    meta = json.load(open(os.path.join(a.frames, "meta.json"))); fps = meta["fps"]; na, nb = meta["a"], meta["b"]
    first = Image.open(os.path.join(a.frames, "a-0000.png")); W, H = first.size
    k = 5; cs = cfg["captionStyle"]; F = cfg["fade"]; total = round(cfg["total"] * fps)
    fontp = os.path.join(root, cs["font"]); chunk = cs.get("scale") is not None
    if not chunk: tx = Text(fontp, cs["px"], k)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                           "-c:v", "libx264", "-preset", "slow", "-crf", a.crf, "-pix_fmt", "yuv420p", "-movflags", "+faststart", a.out], stdin=subprocess.PIPE)
    cap_cache = {}
    if chunk:
        msc = max(4, round(cs["scale"] * 0.6)); mark, mpad = chunky(fontp, cs["px"], cfg["wordmark"], msc, max(2, cs["outline"] - 1), alpha=0.92)
    else: mark = tx.render(cfg["wordmark"], alpha=0.85)
    t_cut = na / fps
    flash = F.get("mode") == "flash"
    D0, D1 = (F["down"][0], F["down"][0]) if flash else F["dissolve"]; b0 = round(D0 * fps)          # the cafe's frames start at the dissolve's start
    def frame_at(f):
        t = f / fps
        parts = []
        if f < na and not (flash and f >= b0): parts.append(("a", f))
        if f >= b0: parts.append(("b", min(f - b0, nb - 1)))
        out = []
        for k, j in parts:
            base = os.path.join(a.frames, f"{k}-{j:04d}")
            img = Image.open(base + ".png").convert("RGB")
            P = cfg["grade"]["outdoor" if k == "a" else "indoor"]
            if not a.nograde: img = grade(img, P)
            img = aa(img, cfg.get("smooth"))
            img = add_labels(img, base)
            out.append((k, img))
        if len(out) == 1: return out[0][1]
        s = max(0.0, min(1.0, (t - D0) / (D1 - D0))); s = s * s * (3 - 2 * s)
        m = Image.blend(out[0][1], out[1][1], s)
        v = F["veilPeak"] * np.sin(np.pi * s)                                # a warm light through the doorway at the middle of the dissolve
        return Image.blend(m, Image.new("RGB", m.size, tuple(F["veil"])), float(v))
    def job(f): return frame_at(f).convert("RGB").tobytes()
    from multiprocessing.pool import ThreadPool
    pool = ThreadPool(4)                       # numpy releases the GIL: four frames graded at once
    for f, raw in enumerate(pool.imap(job, range(total))):
        t = f / fps
        g = Image.frombytes("RGB", (W, H), raw).convert("RGBA")
        for c in cfg["captions"]:
            if c["t0"] <= t < c["t1"]:
                al = min(1, (t - c["t0"]) / 0.25, (c["t1"] - t) / 0.25)
                al = round(al * 4) / 4                                           # stepped, like the art
                if al <= 0: continue
                pos = c.get("posVertical", c.get("pos", "top")) if H > W else c.get("pos", "top")
                if chunk:
                    key = (c["text"], al, W)
                    if key not in cap_cache: cap_cache[key] = chunky(fontp, cs["px"], c["text"], cs["scale"], cs["outline"], maxw=int(W * (1 - 2 * cs["left"])), alpha=al)
                    im, pad = cap_cache[key]
                    g.alpha_composite(scrim(W, H, pos, cs.get("scrim", 0.4), al), (0, 0))
                    x = int(W * cs["left"]) - pad; y = int(H * cs["top"]) - pad if pos == "top" else int(H * cs["bottom"]) - im.height + pad
                    g.alpha_composite(im, (x, y))
                else:
                    key = (c["text"], al)
                    if key not in cap_cache: cap_cache[key] = tx.render(c["text"], alpha=al)
                    im = cap_cache[key]
                    y = int(H * cs["top"]) if pos == "top" else int(H * cs.get("bottom", 0.9)) - im.height
                    g.alpha_composite(im, ((W - im.width) // 2, y))
        if chunk: g.alpha_composite(mark, (W - mark.width - int(W * 0.03) + mpad, H - mark.height - int(H * 0.04) + mpad))
        else: g.alpha_composite(mark, (W - mark.width - 3 * k, H - mark.height - 3 * k))
        if flash:
            u0, u1 = F["up"]; d0, d1 = F["down"]; v = 0.0
            if u0 <= t < u1: v = (t - u0) / (u1 - u0); v = v * v
            elif d0 <= t < d1: v = 1 - (t - d0) / (d1 - d0); v = v ** 0.8
            if v > 0: g = Image.blend(g, Image.new("RGBA", (W, H), (*F["color"], 255)), float(min(1.0, v)))
        e = F["end"]
        if t >= cfg["total"] - e:
            veil = (t - (cfg["total"] - e)) / e; veil = max(0.0, min(1.0, veil)); veil = veil * veil * (3 - 2 * veil)
            g = Image.blend(g, Image.new("RGBA", (W, H), (*F["endColor"], 255)), veil)
        ff.stdin.write(g.convert("RGB").tobytes())
    ff.stdin.close(); ff.wait()

if __name__ == "__main__": main()
