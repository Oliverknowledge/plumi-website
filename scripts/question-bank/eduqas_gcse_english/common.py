"""What the English Language and English Literature cutters share: Eduqas's GCSE page layout and its reports.

eduqas_rs/cut_eduqas_rs.py's crop helpers (lines, crop, trim, stack, save), loaded from its file, with:
  - frame(): a page's text area, between its page number and its footer ("© WJEC CBAC Ltd.", "(C700U10-1)",
    "Turn over."), clear of the paper's barcode in the right margin ("C720 U101" "03");
  - pieces(), text_of(), render(): a stretch of a document from (page, y) to (page, y), across pages;
  - boxed(): question numbers in two boxes, "0" "1", printed as two digits or one line "0 1";
  - chapter(): a component's chapter of a series' examiner's report.
"""
import importlib.util, os, re

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("cut_eduqas_rs", os.path.join(HERE, "..", "eduqas_rs", "cut_eduqas_rs.py"))
rs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rs)
lines, crop, trim, stack = rs.lines, rs.crop, rs.trim, rs.stack
FOOTER = re.compile(r"©.*|\(?C7\d\dU\w+(-\w+)?\)?|Turn over\.?|[A-Z]{2}\*\(.*|C7\d\d ?U\w+|C7\d\dU\S*\s+EDUQAS .*")


def use(img_dir):
    rs.IMG = img_dir


def save(img, name):
    return rs.save(img, name)


def frame(page, qp=True):
    w, h = page.rect.width, page.rect.height
    top, bottom = 30, h - 25
    for l in lines(page):
        t, mid = l["text"], abs((l["x0"] + 6) - w / 2) < 45
        if not (FOOTER.fullmatch(t) or mid and re.fullmatch(r"\d{1,3}", t)):
            continue
        if l["x0"] > w - 40:
            continue  # the barcode's code, printed down the margin
        if l["y1"] < 100:
            top = max(top, l["y1"] + 2)
        elif l["y0"] > h - 100:
            bottom = min(bottom, l["y0"] - 2)
    return pymupdf.Rect(30, top, 562 if qp and w < 700 else w - 20, bottom)


def blank(page):
    t = page.get_text()
    return "BLANK PAGE" in t and len(t.strip()) < 90


def pieces(doc, start, end, qp=True, skip=()):
    """[(page, rect)] from (page, y) down to (page, y), inside each page's text area; blank pages, the pages in
    `skip` and stretches with no words are left out."""
    out = []
    for pg in range(start[0], end[0] + 1):
        page = doc[pg]
        if pg in skip or blank(page):
            continue
        f = frame(page, qp)
        y0 = max(f.y0, start[1]) if pg == start[0] else f.y0
        y1 = min(f.y1, end[1]) if pg == end[0] else f.y1
        if y1 > y0 + 6:
            r = pymupdf.Rect(f.x0, y0, f.x1, y1)
            if re.search(r"[A-Za-z]{3,}", page.get_text("text", clip=r)):
                out.append((pg, r))
    return out


def text_of(doc, ps):
    return re.sub(r"\s+", " ", " ".join(doc[pg].get_text("text", clip=r) for pg, r in ps)).strip()


def render(doc, ps, keep=24):
    return stack([trim(crop(doc, pg, r), keep) for pg, r in ps])


def boxed(ls, max_x=100):
    """Question numbers in two boxes: [(line, "01")], left of max_x. The digits are two lines a box apart
    ("0", "1") or one ("0 1")."""
    out = []
    for l in ls:
        m = re.fullmatch(r"\*?(\d) ?(\d)", l["text"])
        if m and l["x0"] < max_x and " " in l["text"]:
            out.append((l, m.group(1) + m.group(2)))
    digits = [l for l in ls if re.fullmatch(r"\*?\d", l["text"]) and l["x0"] < max_x]
    for a in digits:
        b = next((o for o in digits if o is not a and abs(o["y0"] - a["y0"]) < 3 and 12 < o["x0"] - a["x0"] < 35), None)
        if b and not any(abs(o["x0"] - b["x0"]) < 3 and abs(o["y0"] - a["y0"]) < 3 for o, _ in out):
            out.append((a, a["text"].lstrip("*") + b["text"]))
    return sorted(out, key=lambda o: o[0]["y0"])


def own_text(doc, ps, start):
    """A question's own words: its lines from (page, y), its number's row, on; not the boxed digits."""
    out = []
    for pg, r in ps:
        for l in lines(doc[pg], r):
            if (pg, l["y1"]) > (start[0], start[1] - 2) and not re.fullmatch(r"\*?\d( \d)?", l["text"]):
                out.append(l["text"])
    return re.sub(r"\s+", " ", " ".join(out)).strip()


def report_text(path):
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    return re.sub(r"(?m)^[ \t]*© WJEC CBAC Ltd\.?.*$", "", text)


def chapter(text, key):
    """A component's chapter of a report: from its heading ("COMPONENT 1", "Component 2: 19th and 21st Century…",
    "COMPONENT 1A (SHAKESPEARE)" for key "1A") to the next component's. The contents list names each too, so the
    longest run wins."""
    heads = list(re.finditer(r"(?im)^[ \t]*COMP?ONENT\s*(\d)([ABC])?\b[^\n]{0,80}$", text))
    chunk = ""
    for n, m in enumerate(heads):
        if m.group(1) + (m.group(2) or "").upper() == key:
            c = text[m.end(): heads[n + 1].start() if n + 1 < len(heads) else len(text)]
            chunk = c if len(c) > len(chunk) else chunk
    return re.split(r"(?m)^[ \t]*Supporting you", chunk)[0]


def cap(text, limit=6000):
    if len(text) <= limit:
        return text
    cut_at = text.rfind(". ", 0, limit)
    return text[:cut_at + 1 if cut_at > limit // 2 else limit] + " …"
