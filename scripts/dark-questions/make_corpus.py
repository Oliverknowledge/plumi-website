#!/usr/bin/env python3
"""
A synthetic corpus of exam-question crops with known figure boxes, to score the dark-mode segmentation (src/lib/darkQuestions.ts).

The crops imitate the bank's AQA crops: about 1086 px wide, a boxed question number, Arial-like print at about 20 px, marks at the
right, ruled answer lines, tables, equations, and figures drawn the way the papers draw them (graphs, circuits, apparatus, skeletal
structures, charts, a photograph). Each comes with `<name>.json`: the boxes of the figures (what must stay as printed), and the boxes
of tables that have coloured fills (also kept). Everything else is print, which must be turned to white ink on black.

    python3 scripts/dark-questions/make_corpus.py <out dir> [count]

Generated pictures are not committed (a few before/after examples are, under docs/dark-questions/).
"""
import json
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

W = 1086
MX = 150  # where the print starts, right of the question number
S = 2  # drawn at twice the size, then shrunk: anti-aliased like a rendered PDF
FD = "/usr/share/fonts/truetype/liberation/"


def font(size, bold=False, italic=False, serif=False):
    name = "LiberationSerif" if serif else "LiberationSans"
    style = ("BoldItalic" if bold and italic else "Bold" if bold else "Italic" if italic else "Regular")
    return ImageFont.truetype(f"{FD}{name}-{style}.ttf", int(size * S))


SENTENCES = [
    "A student investigated how the resistance of a wire depends on its length.",
    "Explain why the temperature of the water does not change while the ice is melting.",
    "The graph shows how the velocity of a trolley changes with time.",
    "Calculate the kinetic energy of the car when it is travelling at 24 m/s.",
    "Describe how the student should repeat the experiment to improve the accuracy of the results.",
    "The diagram shows the apparatus used to measure the specific heat capacity of a metal block.",
    "Compare the structure of the two compounds and suggest why their boiling points are different.",
    "Use the data in the table to determine the rate of reaction after 30 seconds.",
    "Give one reason why the experiment should be carried out in a fume cupboard.",
    "The rate of photosynthesis was measured at different distances from a lamp.",
    "State two conclusions that can be drawn from the information in the graph.",
    "Show that the mean speed of the object is about 3.6 m/s.",
]
MARKS = ["[1 mark]", "[2 marks]", "[3 marks]", "[4 marks]", "[6 marks]"]


class Page:
    def __init__(self, height, rng):
        self.h = height
        self.rng = rng
        self.im = Image.new("RGB", (W * S, 1100 * S), "white")
        self.d = ImageDraw.Draw(self.im)
        self.figs = []   # figure boxes (x0,y0,x1,y1) at 1x
        self.keep = []   # tables with colour fills etc: also kept

    # -- print ---------------------------------------------------------------------------------------------------------
    def text(self, x, y, s, size=20, bold=False, italic=False, serif=False, fill=0):
        self.d.text((x * S, y * S), s, font=font(size, bold, italic, serif), fill=fill)

    def width(self, s, size=20, bold=False):
        return font(size, bold).getlength(s) / S

    def para(self, x, y, text, width, size=20, leading=1.35, bold=False):
        words, line, yy = text.split(), "", y
        for w in words:
            t = (line + " " + w).strip()
            if self.width(t, size, bold) > width and line:
                self.text(x, yy, line, size, bold); yy += int(size * leading); line = w
            else:
                line = t
        if line:
            self.text(x, yy, line, size, bold); yy += int(size * leading)
        return yy

    def qnum(self, label="0 1 . 2"):
        a, b, _, c = label.split()
        x, y = 4, 6
        for i, ch in enumerate((a, b)):
            self.d.rectangle([(x + i * 36) * S, y * S, (x + i * 36 + 36) * S, (y + 34) * S], outline=(110, 110, 110), width=2)
            self.text(x + i * 36 + 12, y + 5, ch, 22, bold=True)
        self.text(x + 77, y + 17, ".", 22, bold=True)
        x2 = x + 92
        self.d.rectangle([x2 * S, y * S, (x2 + 36) * S, (y + 34) * S], outline=(110, 110, 110), width=2)
        self.text(x2 + 12, y + 5, c, 22, bold=True)

    def marks(self, y, label):
        self.text(W - 20 - self.width(label, 19, True), y, label, 19, bold=True)

    def answer_lines(self, y, n, x0=150):
        for i in range(n):
            self.d.line([(x0 * S, (y + i * 26) * S), ((W - 20) * S, (y + i * 26) * S)], fill=(170, 170, 170), width=2)
        return y + n * 26

    def equation(self, x, y):
        # a stacked fraction and a bracket, in serif
        self.text(x, y, "v =", 22, italic=True, serif=True)
        self.text(x + 40, y - 14, "2", 20, serif=True); self.d.line([((x + 34) * S, (y + 12) * S), ((x + 64) * S, (y + 12) * S)], fill=0, width=2)
        self.text(x + 40, y + 14, "3", 20, serif=True)
        self.text(x + 74, y - 6, "( x² + 4x − 7 )", 24, serif=True)
        self.text(x + 230, y - 8, "∫", 36, serif=True)
        self.text(x + 252, y, "f(x) dx", 22, italic=True, serif=True)

    # -- figures -------------------------------------------------------------------------------------------------------
    def paste(self, img, x, y, box_from_ink=True, keep=False):
        """Paste a figure (an RGB image at S times size) with its top-left at (x, y); record its tight box."""
        arr = np.asarray(img.convert("L"))
        ys, xs = np.where(arr < 235)
        self.im.paste(img, (int(x * S), int(y * S)))
        b = (x + xs.min() / S, y + ys.min() / S, x + (xs.max() + 1) / S, y + (ys.max() + 1) / S)
        (self.keep if keep else self.figs).append(tuple(int(round(v)) for v in b))
        return img.size[0] // S, img.size[1] // S

    def save(self, path, name):
        out = self.im.crop((0, 0, W * S, self.h * S)).resize((W, self.h), Image.LANCZOS)
        out.save(os.path.join(path, name + ".png"))
        json.dump({"figures": self.figs, "keep": self.keep}, open(os.path.join(path, name + ".json"), "w"))


def dtext(d, x, y, *a, **k):
    d.text((x, y), *a, **k)


def mpl_fig(w, h, draw, color_axes="black"):
    fig = plt.figure(figsize=(w / 100, h / 100), dpi=100 * S)
    ax = fig.add_axes([0.16, 0.18, 0.78, 0.74])
    plt.rcParams["font.family"] = "Liberation Sans"
    draw(ax)
    fig.canvas.draw()
    img = Image.fromarray(np.asarray(fig.canvas.buffer_rgba())[:, :, :3])
    plt.close(fig)
    return img


def fig_line_graph(w, h, rng, grid=False):
    def d(ax):
        t = np.linspace(0, 6, 60)
        ax.plot(t, 2.4 * (1 - np.exp(-t / 1.4)), color="black", lw=1.4)
        ax.set_xlim(0, 6); ax.set_ylim(0, 3)
        ax.set_xlabel("Time / minutes", fontsize=11); ax.set_ylabel("Mass / g", fontsize=11)
        if grid:
            ax.grid(True, color="#bdbdbd", lw=0.5); ax.minorticks_on(); ax.grid(True, which="minor", color="#dcdcdc", lw=0.4)
        for s in ("top", "right"): ax.spines[s].set_visible(False)
    return mpl_fig(w, h, d)


def fig_scatter(w, h, rng):
    def d(ax):
        x = np.linspace(1, 9, 16); y = 0.7 * x + np.array([rng.gauss(0, 0.5) for _ in range(16)])
        ax.scatter(x, y, s=14, color="black", marker="x"); ax.plot([1, 9], [0.7, 6.3], color="black", lw=1)
        ax.set_xlabel("Concentration / mol dm$^{-3}$", fontsize=11); ax.set_ylabel("Rate / cm$^3$ s$^{-1}$", fontsize=11)
    return mpl_fig(w, h, d)


def fig_bar(w, h, rng):
    def d(ax):
        ax.bar(["A", "B", "C", "D"], [3, 5, 2, 4], color=["#d94b4b", "#3f7fd9", "#47a35a", "#e0a82e"], edgecolor="black", lw=0.8)
        ax.set_ylabel("Number of organisms", fontsize=11)
        for s in ("top", "right"): ax.spines[s].set_visible(False)
    return mpl_fig(w, h, d)


def fig_circuit(w, h):
    im = Image.new("RGB", (w * S, h * S), "white"); d = ImageDraw.Draw(im)
    def L(*p): d.line([(a * S, b * S) for a, b in p], fill=0, width=2 * S // 2 + 1)
    m = 24
    L((m, m), (w - m, m), (w - m, h - m), (m, h - m), (m, m))
    # battery
    d.rectangle([(w // 2 - 30) * S, (m - 3) * S, (w // 2 + 30) * S, (m + 3) * S], fill="white")
    L((w // 2 - 8, m - 16), (w // 2 - 8, m + 16)); L((w // 2 + 8, m - 8), (w // 2 + 8, m + 8))
    # resistor
    d.rectangle([(w - m - 12) * S, (h // 2 - 30) * S, (w - m + 12) * S, (h // 2 + 30) * S], fill="white", outline=0, width=2)
    # ammeter and lamp
    for cx, cy, lab in ((m + 0, h // 2, "A"), (w // 2, h - m, "")):
        r = 20
        d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill="white", outline=0, width=2)
        if lab: dtext(d, (cx - 6) * S, (cy - 11) * S, lab, font=font(20), fill=0)
        else: L((cx - 14, cy - 14), (cx + 14, cy + 14)); L((cx - 14, cy + 14), (cx + 14, cy - 14))
    dtext(d, (w - m + 20) * S, (h // 2 - 12) * S, "R", font=font(20, italic=True), fill=0)
    return im


def fig_apparatus(w, h):
    im = Image.new("RGB", (w * S, h * S), "white"); d = ImageDraw.Draw(im)
    def L(*p, width=3): d.line([(a * S, b * S) for a, b in p], fill=0, width=width)
    bx0, bx1, by0, by1 = 40, w - 150, 70, h - 30
    L((bx0, by0), (bx0, by1), (bx1, by1), (bx1, by0))
    d.rectangle([(bx0 + 2) * S, (by0 + 60) * S, (bx1 - 2) * S, (by1 - 2) * S], fill=(222, 232, 244))
    L((bx0, by0), (bx0, by1), (bx1, by1), (bx1, by0))
    # thermometer
    tx = (bx0 + bx1) // 2
    d.rectangle([(tx - 6) * S, 10 * S, (tx + 6) * S, (by1 - 30) * S], outline=0, width=3, fill="white")
    d.ellipse([(tx - 10) * S, (by1 - 40) * S, (tx + 10) * S, (by1 - 14) * S], fill=(180, 40, 40), outline=0, width=3)
    f = font(18)
    for yy, s in ((24, "Thermometer"), (by0 + 40, "Water"), (by1 - 20, "Heater")):
        L((tx + 8 if s == "Thermometer" else bx1 - 6, yy + 9), (bx1 + 20, yy + 9), width=2)
        dtext(d, (bx1 + 26) * S, yy * S, s, font=f, fill=0)
    return im


def fig_structure(w, h):
    im = Image.new("RGB", (w * S, h * S), "white"); d = ImageDraw.Draw(im)
    cx, cy, r = w // 2, h // 2, 52
    pts = [(cx + r * math.cos(math.radians(60 * i - 30)), cy + r * math.sin(math.radians(60 * i - 30))) for i in range(6)]
    for i in range(6):
        a, b = pts[i], pts[(i + 1) % 6]
        d.line([a[0] * S, a[1] * S, b[0] * S, b[1] * S], fill=0, width=3)
        if i % 2 == 0:
            ox, oy = (a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy
            n = math.hypot(ox, oy); ox, oy = ox / n * 6, oy / n * 6
            d.line([(a[0] - ox) * S, (a[1] - oy) * S, (b[0] - ox) * S, (b[1] - oy) * S], fill=0, width=3)
    f = font(22)
    x, y = pts[0]; d.line([x * S, y * S, (x + 34) * S, (y + 20) * S], fill=0, width=3); dtext(d, (x + 36) * S, (y + 8) * S, "OH", font=f, fill=0)
    x, y = pts[3]; d.line([x * S, y * S, (x - 34) * S, (y - 20) * S], fill=0, width=3); dtext(d, (x - 62) * S, (y - 42) * S, "CH", font=f, fill=0)
    dtext(d, (x - 20) * S, (y - 34) * S, "3", font=font(14), fill=0)
    x, y = pts[5]; d.line([x * S, y * S, x * S, (y - 36) * S], fill=0, width=3); dtext(d, (x - 12) * S, (y - 64) * S, "Cl", font=f, fill=0)
    return im


def fig_forces(w, h):
    im = Image.new("RGB", (w * S, h * S), "white"); d = ImageDraw.Draw(im)
    cx, cy = w // 2, h // 2
    d.rectangle([(cx - 40) * S, (cy - 25) * S, (cx + 40) * S, (cy + 25) * S], outline=0, width=3)
    def arrow(x0, y0, x1, y1):
        d.line([x0 * S, y0 * S, x1 * S, y1 * S], fill=0, width=3)
        a = math.atan2(y1 - y0, x1 - x0)
        for da in (2.7, -2.7):
            d.line([x1 * S, y1 * S, (x1 + 14 * math.cos(a + da)) * S, (y1 + 14 * math.sin(a + da)) * S], fill=0, width=3)
    arrow(cx, cy - 25, cx, cy - 95); arrow(cx, cy + 25, cx, cy + 80); arrow(cx + 40, cy, cx + 110, cy - 40); arrow(cx - 40, cy, cx - 110, cy)
    f = font(19)
    dtext(d, (cx + 8) * S, (cy - 100) * S, "R", font=f, fill=0); dtext(d, (cx + 8) * S, (cy + 70) * S, "W", font=f, fill=0)
    dtext(d, (cx + 100) * S, (cy - 70) * S, "F", font=f, fill=0); dtext(d, (cx - 132) * S, (cy - 26) * S, "T", font=f, fill=0)
    return im


def fig_photo(w, h, rng, colour=False):
    nrng = np.random.default_rng(rng.randint(0, 10**9))
    n = np.zeros((h, w, 3))
    for oct_ in range(5):
        k = 2 ** (oct_ + 2)
        small = nrng.random((k, k, 3))
        n += np.asarray(Image.fromarray((small * 255).astype("uint8")).resize((w, h), Image.BICUBIC)) / 255 / (oct_ + 1)
    n = (n - n.min()) / (n.max() - n.min())
    yy, xx = np.mgrid[0:h, 0:w]
    vign = 1 - 0.5 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    n = np.clip(n * vign[..., None] * 1.1, 0, 1)
    if not colour:
        n[:] = n.mean(axis=2, keepdims=True)
    else:
        n *= np.array([0.9, 1.0, 0.6])
    im = Image.fromarray((n * 255).astype("uint8")).resize((w * S, h * S), Image.BICUBIC)
    return im


def table(page, x, y, rows, colw, rowh=34, head=None, header_fill=None, size=18):
    d = page.d
    H = rowh * len(rows); Wt = sum(colw)
    if header_fill:
        d.rectangle([x * S, y * S, (x + Wt) * S, (y + rowh) * S], fill=header_fill)
    yy = y
    for r in range(len(rows) + 1):
        d.line([x * S, (y + r * rowh) * S, (x + Wt) * S, (y + r * rowh) * S], fill=(90, 90, 90), width=2)
    xx = x
    for c in range(len(colw) + 1):
        d.line([xx * S, y * S, xx * S, (y + H) * S], fill=(90, 90, 90), width=2)
        if c < len(colw): xx += colw[c]
    xx = x
    for c, cw in enumerate(colw):
        for r, row in enumerate(rows):
            t = row[c]
            page.text(xx + (cw - page.width(t, size, r == 0)) / 2, y + r * rowh + 7, t, size, bold=(r == 0))
        xx += cw
    return y + H


def build(i, rng):
    kinds = ["text", "beside", "inline", "full", "two", "table", "photo", "mixed"]
    spec = SPECS[i % len(SPECS)]
    return spec


# each spec: a function that builds a page and returns it
def mk_text(rng, n):
    p = Page(330 + rng.randint(0, 80), rng)
    p.qnum("0 1 . 1"); y = p.para(MX, 10, " ".join(rng.sample(SENTENCES, 2)), 800); p.marks(y - 6, rng.choice(MARKS))
    y = p.answer_lines(y + 40, rng.randint(3, 6)); p.h = y + 14
    return p


def mk_equation(rng, n):
    p = Page(260, rng); p.qnum("0 3 . 2"); y = p.para(MX, 10, SENTENCES[3], 800)
    p.equation(300, y + 36); y = p.para(MX, y + 90, "Use the equation to find the value of v when x = 2.", 800); p.marks(y - 6, "[3 marks]")
    p.d.line([70 * S, (y + 50) * S, (W - 20) * S, (y + 50) * S], fill=(170, 170, 170), width=2)
    p.text(520, y + 20, "v =", 20); p.d.line([560 * S, (y + 40) * S, 800 * S, (y + 40) * S], fill=(120, 120, 120), width=2); p.text(900, y + 20, "m s⁻¹", 20)
    p.h = y + 70
    return p


def mk_beside(rng, n):
    p = Page(520, rng); p.qnum("0 2 . 3")
    figs = [lambda: fig_apparatus(420, 260), lambda: fig_circuit(360, 250), lambda: fig_structure(300, 220), lambda: fig_forces(320, 230)]
    f = figs[n % 4]()
    right = n % 2 == 0
    fw = f.size[0] // S
    fx = (W - fw - 40) if right else MX
    tx, tw = (MX, W - fw - MX - 90) if right else (MX + fw + 36, W - fw - MX - 90)
    y = p.para(tx, 10, " ".join(rng.sample(SENTENCES, 3)), tw)
    p.paste(f, fx, 90)
    p.marks(max(y, 40), "[2 marks]")
    y2 = max(y + 10, 90 + f.size[1] // S + 30)
    y2 = p.para(MX, y2, rng.choice(SENTENCES), 800); y2 = p.answer_lines(y2 + 30, 3); p.h = y2 + 14
    return p


def mk_inline(rng, n):
    p = Page(700, rng); p.qnum("0 4 . 1"); y = p.para(MX, 10, " ".join(rng.sample(SENTENCES, 2)), 800)
    kind = n % 5
    if kind == 0: f, gap = fig_line_graph(560, 340, rng, grid=True), 14
    elif kind == 1: f, gap = fig_line_graph(520, 320, rng), 8
    elif kind == 2: f, gap = fig_scatter(520, 330, rng), 30
    elif kind == 3: f, gap = fig_circuit(420, 250), 30
    else: f, gap = fig_structure(340, 230), 30
    p.text(W // 2 - 30, y + gap - 4, "Figure 2", 19, bold=True)   # a caption above
    fx = (W - f.size[0] // S) // 2
    fw, fh = p.paste(f, fx, y + gap + 28)
    y = y + gap + 28 + fh + 14
    y = p.para(MX, y, rng.choice(SENTENCES), 800); p.marks(y - 6, "[4 marks]"); y = p.answer_lines(y + 32, 4); p.h = y + 14
    return p


def mk_full(rng, n):
    p = Page(620, rng); p.qnum("0 5 . 4")
    y = p.para(MX, 10, rng.choice(SENTENCES), 800)
    f = [lambda: fig_line_graph(980, 400, rng, grid=True), lambda: fig_bar(900, 380, rng), lambda: fig_apparatus(900, 340)][n % 3]()
    fw, fh = p.paste(f, (W - f.size[0] // S) // 2, y + 20)
    p.text(W // 2 - 40, y + 20 + fh + 8, "Figure 4", 19, bold=True)   # a caption below
    y = y + 20 + fh + 50
    y = p.para(MX, y, rng.choice(SENTENCES), 800); p.marks(y - 6, "[3 marks]"); p.h = y + 30
    return p


def mk_two(rng, n):
    p = Page(560, rng); p.qnum("0 6 . 2"); y = p.para(MX, 10, "Which graph shows the relationship? Tick one box.", 800)
    xs = (190, 600)
    for k, x in enumerate(xs):
        f = fig_line_graph(380, 250, rng) if k == 0 else fig_forces(380, 250)
        p.paste(f, x, y + 30)
        p.d.rectangle([(x + 400) * S, (y + 140) * S, (x + 430) * S, (y + 170) * S], outline=(110, 110, 110), width=2)
        p.text(x - 48, y + 140, "AB"[k], 20, bold=True)
    y = y + 30 + 260
    p.h = y + 30; p.marks(p.h - 30, "[1 mark]")
    return p


def mk_table(rng, n):
    p = Page(520, rng); p.qnum("0 7 . 3"); y = p.para(MX, 10, "Table 1 shows the results of the experiment.", 800)
    rows = [["Time / s", "Mass / g", "Rate"]] + [[str(10 * j), f"{rng.uniform(1, 9):.1f}", f"{rng.uniform(0.1, 0.9):.2f}"] for j in range(1, 5 + n % 3)]
    shade = [(217, 217, 217), None, (232, 232, 232)][n % 3]
    y = table(p, 220, y + 30, rows, [210, 210, 210], header_fill=shade)
    y = p.para(MX, y + 24, rng.choice(SENTENCES), 800); p.marks(y - 6, "[2 marks]"); y = p.answer_lines(y + 30, 3); p.h = y + 14
    return p


def mk_table_colour(rng, n):
    p = Page(440, rng); p.qnum("0 7 . 4"); y = p.para(MX, 10, "Table 2 shows the colour change for each indicator.", 800)
    rows = [["Indicator", "Acid", "Alkali"], ["Litmus", "red", "blue"], ["Methyl orange", "red", "yellow"], ["Phenolphthalein", "colourless", "pink"]]
    y0 = y + 30; y1 = table(p, 190, y0, rows, [250, 220, 220], rowh=38)
    for (cx, cy, col) in ((440 + 220, y0 + 38, (214, 70, 70)), (660 + 110, y0 + 38, (70, 110, 214))):
        pass
    p.d.rectangle([(190 + 250 + 3) * S, (y0 + 38 + 3) * S, (190 + 250 + 220 - 3) * S, (y0 + 76 - 3) * S], fill=(228, 90, 90))
    p.d.rectangle([(190 + 470 + 3) * S, (y0 + 38 + 3) * S, (190 + 690 - 3) * S, (y0 + 76 - 3) * S], fill=(90, 130, 228))
    p.d.rectangle([(190 + 250 + 3) * S, (y0 + 76 + 3) * S, (190 + 470 - 3) * S, (y0 + 114 - 3) * S], fill=(228, 90, 90))
    p.d.rectangle([(190 + 470 + 3) * S, (y0 + 76 + 3) * S, (190 + 690 - 3) * S, (y0 + 114 - 3) * S], fill=(236, 200, 70))
    for r, row in enumerate(rows[1:3]):
        for c in (1, 2):
            p.text(190 + 250 + (c - 1) * 220 + (220 - p.width(row[c], 18)) / 2, y0 + (r + 1) * 38 + 8, row[c], 18)
    p.keep.append((190, y0, 190 + 690, y1))
    y = p.para(MX, y1 + 20, rng.choice(SENTENCES), 800); p.marks(y - 6, "[2 marks]"); p.h = y + 20
    return p


def mk_photo(rng, n):
    p = Page(640, rng); p.qnum("0 8 . 1"); y = p.para(MX, 10, "Figure 3 shows a photograph of the apparatus used.", 800)
    f = fig_photo(520, 320, rng, colour=bool(n % 2))
    p.paste(f, 300, y + 30)
    p.text(480, y + 30 + 330, "Figure 3", 19, bold=True)
    y = p.para(MX, y + 400, rng.choice(SENTENCES), 800); p.marks(y - 6, "[2 marks]"); y = p.answer_lines(y + 28, 2); p.h = y + 14
    return p


def mk_mixed(rng, n):
    p = Page(760, rng); p.qnum("0 9 . 2"); y = p.para(MX, 10, " ".join(rng.sample(SENTENCES, 2)), 800)
    f1 = fig_apparatus(520, 280); p.paste(f1, MX, y + 20)
    f2 = fig_bar(380, 280, rng); p.paste(f2, 640, y + 20)
    y += 20 + 290
    p.text(MX, y, "Figure 5", 19, bold=True); p.text(640, y, "Figure 6", 19, bold=True)
    y = p.para(MX, y + 40, rng.choice(SENTENCES), 800); p.marks(y - 6, "[5 marks]")
    rows = [["x", "y"], ["1", "2.4"], ["2", "4.1"]]
    y = table(p, MX, y + 20, rows, [90, 110]) + 10
    y = p.answer_lines(y + 24, 2); p.h = y + 14
    return p



def mk_tight(rng, n):
    """Print only 10 to 14 px from the figure, above, below and beside it; the caption hard under it."""
    p = Page(620, rng); p.qnum("1 0 . 1")
    y = p.para(MX, 10, " ".join(rng.sample(SENTENCES, 2)), 800)
    f = [lambda: fig_apparatus(460, 270), lambda: fig_line_graph(480, 300, rng), lambda: fig_circuit(400, 240)][n % 3]()
    fw, fh = p.paste(f, MX + 10, y + 12)
    p.text(MX + 10 + fw // 2 - 28, y + 12 + fh + 2, "Figure 1", 19, bold=True)
    side = MX + 10 + fw + 14
    p.para(side, y + 20, " ".join(rng.sample(SENTENCES, 2)), W - side - 40)
    y2 = y + 12 + fh + 32
    y2 = p.para(MX, y2, rng.choice(SENTENCES), 800); p.marks(y2 - 6, "[3 marks]"); p.h = y2 + 14
    return p


def mk_small(rng, n):
    p = Page(400, rng); p.qnum("1 1 . 2")
    y = p.para(MX, 10, "The symbol for a component is shown.", 800)
    f = fig_circuit(150, 110) if n % 2 else fig_structure(170, 140)
    p.paste(f, MX + 40, y + 24)
    y = p.para(MX, y + 24 + 150, rng.choice(SENTENCES), 800); p.marks(y - 6, "[1 mark]"); y = p.answer_lines(y + 28, 2); p.h = y + 12
    return p


def mk_dense(rng, n):
    p = Page(520, rng); p.qnum("1 2 . 1")
    y = 10
    for k in range(5):
        y = p.para(MX, y, " ".join(rng.sample(SENTENCES, 2)), 800, leading=1.22) + 3
    p.equation(MX + 120, y + 26); y += 70
    y = p.para(MX, y, "Use the equation to calculate the value.", 800); p.marks(y - 6, "[2 marks]"); y = p.answer_lines(y + 28, 2); p.h = y + 12
    return p


def mk_edge(rng, n):
    p = Page(460, rng); p.qnum("1 3 . 1")
    y = p.para(MX, 10, rng.choice(SENTENCES), 800)
    f = fig_line_graph(700, 300, rng, grid=bool(n % 2))
    fw, fh = p.paste(f, W - fw_of(f) - 2, y + 20)
    p.text(MX, y + 40, "Figure 1", 19, bold=True)
    y = y + 20 + fh + 14
    y = p.para(MX, y, rng.choice(SENTENCES), 800); p.marks(y - 6, "[2 marks]"); p.h = y + 12
    return p


def fw_of(f):
    return f.size[0] // S


def mk_numberline(rng, n):
    p = Page(380, rng); p.qnum("1 4 . 1"); y = p.para(MX, 10, "A student plots the readings on the line below.", 800)
    f = Image.new("RGB", (700 * S, 90 * S), "white"); d = ImageDraw.Draw(f)
    d.line([20 * S, 30 * S, 680 * S, 30 * S], fill=0, width=3)
    for i in range(0, 11):
        x = 20 + i * 66
        d.line([x * S, 20 * S, x * S, 40 * S], fill=0, width=3); dtext(d, (x - 8) * S, 46 * S, str(i * 10), font=font(18), fill=0)
    for x in (118, 250, 414): d.ellipse([(x - 6) * S, 24 * S, (x + 6) * S, 36 * S], fill=0)
    p.paste(f, MX + 20, y + 24)
    y = p.para(MX, y + 150, rng.choice(SENTENCES), 800); p.marks(y - 6, "[2 marks]"); p.h = y + 12
    return p


SPECS = [mk_text, mk_equation, mk_beside, mk_inline, mk_full, mk_two, mk_table, mk_table_colour, mk_photo, mk_mixed, mk_tight, mk_small, mk_dense, mk_edge, mk_numberline]


def main():
    out = sys.argv[1]; count = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    os.makedirs(out, exist_ok=True)
    for i in range(count):
        rng = random.Random(1000 + i)
        spec = SPECS[i % len(SPECS)]
        p = spec(rng, i // len(SPECS) + i)
        p.save(out, f"syn{i:02d}_{spec.__name__[3:]}")
    print("wrote", count, "crops to", out)


if __name__ == "__main__":
    main()
