"""Check the legacy Physics crops (cut_legacy.py) before they go up.

    python3 scripts/question-bank/aqa_physics_legacy/check_legacy.py [work-dir]

Flags:
  - a crop whose edge runs through a line of text (clipped at the bottom, or starting mid-line),
  - a stem (the setups above a part) taller than a phone screen's worth (2,400px),
  - a part without a scheme crop or key, or without marks,
  - a set whose marks don't add up to the unit's total.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "phya")
TOTAL = {"PHYA1": 70, "PHYA2": 70, "PHYA4A": 25, "PHYA4B": 50, "PHYA5A": 40, "PHYA5BA": 35, "PHYA5BB": 35, "PHYA5BC": 35, "PHYA5BD": 35}
BOILER = re.compile(r"^(Turn over|Do not write|outside the|box|Areas outside|the box will|not be scanned|for marking|PMT|WMP/|G/|\(\d\d\)$|\d+ of \d+$)")


def straddles(page, rect):
    """Text lines the rect's top or bottom edge cuts through."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            t = "".join(s["text"] for s in line["spans"]).strip()
            if not t or BOILER.match(t):
                continue
            x0, y0, x1, y1 = line["bbox"]
            ink0 = max(y0, min(s["origin"][1] - s["size"] * 0.75 for s in line["spans"]))
            ink1 = max(s["origin"][1] + s["size"] * 0.15 for s in line["spans"])
            if x1 < rect.x0 or x0 > rect.x1:
                continue
            for edge in (rect.y0, rect.y1):
                if ink0 + 2 < edge < ink1 - 2:
                    out.append(t[:40])
    return out


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    docs = {}
    manifest = {(f["component"], f["series"], f["kind"]): f["file"] for f in json.load(open(os.path.join(WORK, "manifest.json")))}

    def doc(comp, series, kind):
        key = (comp, series, kind)
        if key not in docs:
            d = pymupdf.open(os.path.join(WORK, "pdf", manifest[key]))
            for page in d:
                if page.rotation:
                    page.remove_rotation()
            docs[key] = d
        return docs[key]

    issues, sums = [], {}
    for p in parts:
        sums[(p["component"], p["series"])] = sums.get((p["component"], p["series"]), 0) + (p["marks"] or 0)
        for kind, field in (("qp", "qpRects"), ("ms", "msRects"), ("qp", "stemRects")):
            for pg, *r in p.get(field, []):
                cut = straddles(doc(p["component"], p["series"], kind)[pg], pymupdf.Rect(*r))
                if cut:
                    issues.append(f"{p['id']} {field} p{pg}: edge cuts {cut[:2]}")
        if not p.get("ms") and not p.get("key"):
            issues.append(f"{p['id']}: no scheme crop or key")
        if p["marks"] is None:
            issues.append(f"{p['id']}: no marks")
        if p.get("stem"):
            from PIL import Image
            h = Image.open(os.path.join(WORK, "img", p["stem"])).height
            if h > 2400:
                issues.append(f"{p['id']}: stem {h}px tall")
    for (comp, series), total in sorted(sums.items()):
        if total != TOTAL[comp]:
            issues.append(f"{comp}-{series}: marks add up to {total}, not {TOTAL[comp]}")
    for i in sorted(set(issues)):
        print(i)
    print(f"{len(parts)} parts, {len(set(issues))} issues", file=sys.stderr)


if __name__ == "__main__":
    main()
