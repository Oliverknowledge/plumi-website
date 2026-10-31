#!/usr/bin/env python3
"""Writes src/app/dark-surfaces.css: for every rule in the page stylesheets that paints a light surface (`background: #fff` and
the cream, yellow, teal and pink of the notebook), a `html[data-theme="dark"]` rule that paints the dark equivalent, and the same for
the pale dashed rules and borders between things, which would glare on the dark paper. Real paper
(the exam sheets, scans, the marked page, stamps) is skipped: it stays white, as the embed does, because the scans are black on white.

    python3 scripts/gen-dark-surfaces.py

Run it again after adding a light surface to a page stylesheet. The tokens (cosy.css, dark.css) do everything else."""
import re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent / "src" / "app"
FILES = ["question-bank.css", "question-bank-hub.css", "pages.css", "past-papers.css", "practice-packs.css", "parents.css", "landing.css", "send-to-ipad.css", "android-cta.css"]
SKIP = re.compile(r"\bimg\b|\.qb-sheet|\.lp-sp-paper|\.lp-sp-screen|\.lp-page\b|\.lp-stamp|\.pk-stamp|\.qb-zoom-inner|\.qb-sq|\.lp-meter|\.lp-ring")
CARD = "var(--lp-card-bg)"
MAP = {"#fff": CARD, "#ffffff": CARD, "#fffdf8": CARD, "#fdf9f1": CARD, "#fffdf6": CARD, "#fcfcf9": CARD,
       "#fff4dd": "#3a2f25", "#fffbf1": "#332a24", "#fff1c2": "#4a3d22", "#dff0ee": "#23423f", "#f9dcd5": "#4a2b27",
       "#fde3c4": "#4a3424", "#fdecea": "#4a2b27", "#f8e3a8": "#5a4720", "#bfe3b4": "#2f4a2c", "#f6c3bf": "#4a2b27",
       "#cfe8d0": "#2f4a2c", "#ece4d4": "var(--lp-paper-2)"}
# the light colours inside a mapped background's gradient (the answer box's ruled lines)
REST = {"%235b4741": "%23bcab9b", "#dfe8f3": "#3d332d"}
# the pale rules and borders: one quiet line
LINE = {c: "#4a3e38" for c in ("#e2d6c2", "#d8c8ad", "#e6d9c3", "#ece2cf", "#e2c98f", "#e2d5bf", "#cdbda3")}
BG = re.compile(r"(background(?:-color)?)\s*:\s*(#[0-9a-fA-F]{3,6})(?![0-9a-fA-F])([^;}]*)")
BORDER = re.compile(r"(border(?:-top|-right|-bottom|-left)?(?:-color)?)\s*:\s*([^;}]*)")
HEX = re.compile(r"#[0-9a-fA-F]{3,6}(?![0-9a-fA-F])")


def blocks(css):
    """Yield (prelude, body) for each top-level block."""
    depth, start, prelude, last = 0, 0, "", 0
    for i, ch in enumerate(css):
        if ch == "{":
            if depth == 0:
                prelude, start = css[last:i].strip(), i + 1
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                yield prelude, css[start:i]
        if depth == 0 and ch == "}":
            last = i + 1
        elif depth == 0 and ch == ";":
            last = i + 1


def surface(body):
    out = []
    for m in BG.finditer(body):
        colour = m.group(2).lower()
        if colour in MAP:
            rest = m.group(3)
            for light, dark in REST.items():
                rest = rest.replace(light, dark)
            out.append(f"{m.group(1)}: {MAP[colour]}{rest}")
    for m in BORDER.finditer(body):  # the colour alone, so a later `border-bottom: 0` still takes the line away
        colour = next((LINE[h.lower()] for h in HEX.findall(m.group(2)) if h.lower() in LINE), None)
        if colour:
            prop = m.group(1) if m.group(1).endswith("-color") else m.group(1) + "-color"
            out.append(f"{prop}: {colour}")
    return "; ".join(out)


def last_classes(selector):
    """The classes of a selector's last compound: `.lp .qb-self-key.is-on:hover` -> {qb-self-key, is-on}."""
    return set(re.findall(r"\.([\w-]+)", re.split(r"[\s>+~]+", selector.strip())[-1]))


def restated(body, painted):
    """A state rule (`.is-on`, `:hover`) of a class painted above, restated with the same prefix: the dark rules weigh one class
    and one element more than the light ones, so without this `.qb-self-key`'s dark card would cover `.qb-self-key.is-on`'s gold.
    Only a value in tokens or keywords is restated; a written-out colour is mapped above or left to dark.css."""
    out = []
    for family, pattern in (("background", r"background(?:-color)?"), ("border", r"border(?:-top|-right|-bottom|-left)?(?:-color)?")):
        if family not in painted:
            continue
        for m in re.finditer(rf"(?<![\w-])({pattern})\s*:\s*([^;}}]*)", body):
            if not re.search(r"#|rgb|hsl", m.group(2)):
                out.append(f"{m.group(1)}: {m.group(2).strip()}")
    return "; ".join(out)


def painted_classes(css, found=None):
    """class -> the property families ("background", "border") some rule above darkens on it."""
    found = {} if found is None else found
    for prelude, body in blocks(css):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            painted_classes(body, found)
        elif not prelude.startswith("@"):
            paint = surface(body)
            families = {f for f in ("background", "border") if f in paint}
            for s in prelude.split(","):
                if s.strip() and not SKIP.search(s):
                    for c in last_classes(s):
                        found.setdefault(c, set()).update(families)
    return found


def rules(css, painted, indent=""):
    result = []
    for prelude, body in blocks(css):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            inner = rules(body, painted, indent + "  ")
            if inner:
                result.append(f"{indent}{prelude} {{\n" + "\n".join(inner) + f"\n{indent}}}")
        elif prelude.startswith("@"):
            continue
        else:
            selectors = [s.strip() for s in prelude.split(",") if s.strip() and not SKIP.search(s)]
            paint = surface(body)
            if not selectors:
                continue
            if not paint:  # every selector a painted class (its state, mostly), so nothing else is pulled into the dark rules
                families = [set().union(*(painted.get(c, set()) for c in last_classes(s))) for s in selectors]
                if all(families):
                    paint = restated(body, set.intersection(*families))
            if not paint:
                continue
            joined = ",\n".join(f'{indent}html[data-theme="dark"] {s if s.startswith(".lp") or s.startswith("html") else ".lp " + s}' for s in selectors)
            result.append(f"{joined} {{ {paint}; }}")
    return result


out = ["/* GENERATED by scripts/gen-dark-surfaces.py: do not edit. The light surfaces of the page stylesheets, darkened for html[data-theme=\"dark\"]. */"]
for name in FILES:
    css = re.sub(r"/\*.*?\*/", "", (root / name).read_text(), flags=re.S)
    found = rules(css, painted_classes(css))
    if found:
        out.append(f"/* {name} */")
        out.extend(found)
(root / "dark-surfaces.css").write_text("\n".join(out) + "\n")
print(f"wrote {sum(len(x.splitlines()) for x in out)} lines")
