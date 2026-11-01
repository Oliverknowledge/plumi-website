"""Cut OCR's GCSE Geography B (J384) papers into question parts, each with its figures, its mark scheme rows and its report.

    python3 scripts/question-bank/ocr_gcse_geography/cut_ocr_gcse_geography.py [work-dir] [--only=j38403-jun24]
    # default work dir: scripts/question-bank/.work/ocr-gcse-geography

ocr_gcse/cut_ocr_gcse.py (cut_pearson.py with OCR's GCSE patches) does the cutting: J384's papers and schemes
are set as the Gateway sciences', and its scheme reader keeps a row that runs on over pages whole, so a long
answer's crop has its levels and all of its indicative content. What Geography B adds, patched in here so no
other bank's crops move:
  - Every paper's figures are printed in a separate Resource Booklet ("Look at Fig. 3a in the Resource
    Booklet."). Each figure is read from the booklet, from its "Fig. 3a" caption to the next caption or the
    foot of its page (a page with no caption of its own carries on the figure before), and a question's stem
    is its own opening words and every booklet figure its parts name ("Fig. 2" takes 2a and 2b too). A
    question that works from the booklet as a whole ("Using the information in the separate Resource
    Booklet", and Paper 3's 12-mark decision-making essay) has the whole booklet. A landscape page (its
    captions running up the page) is shown whole, turned upright. A "Look at Fig. 8…" line set over a
    question's number starts that question. A one-part question with a stem
    takes the part id "-q", as cut_pearson names it, so the stem keeps the question's name.
  - Topic headings over a question ("Changing Climate", "Section B") end the part before them, not its crop.
  - A case study's heading and name lines ("CASE STUDY", "Name of weather hazard event ....") set above a
    part belong to that part, not to the end of the one before.
  - A question marked with SPaG prints "Spelling, punctuation and grammar and the use of specialist
    terminology [3]" under its own marks: the part's marks are its own, with the SPaG marks as "spag", and
    its scheme crop gains the scheme's SPaG assessment grid.
  - A multiple-choice part carries the scheme's letter as its key, as well as its scheme crop.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import glob, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "ocr-gcse-geography")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "ocr_gcse"))
import cut_ocr_gcse  # noqa: E402  (patches cut_pearson for OCR's GCSE papers)
import cut_pearson as cp  # noqa: E402
import pymupdf  # noqa: E402
from PIL import Image  # noqa: E402

_cut_set, _qp_labels, _STOP, _lines, _region = cp.cut_set, cp.qp_labels, cp.STOP, cp.Doc.lines, cp.region
STARRED = re.compile(r"\(([a-z]{1,4})\*\)")
CAPTION = re.compile(r"^Fig(?:ure|\.)?\s*(\d{1,2}[a-z]?)\b")
# "Fig. 3a", "Figs 3, 4 and 5", "Fig. 6 and 7", "Fig. 1a and Fig. 1b"
NAMED = re.compile(r"\bFig(?:ure)?s?\.?\s*(\d{1,2}[a-z]?(?:(?:\s*,\s*|\s+and\s+|\s*&\s*|\s*[–-]\s*)(?:Fig(?:ure)?s?\.?\s*)?\d{1,2}[a-z]?)*)")
WHOLE = re.compile(r"(information|evidence|resources?) (in|from) the (separate )?Resource Booklet|Resource Booklet and your own", re.I)
SPAG = re.compile(r"Spelling,? punctuation and grammar[^\[]{0,80}\[(\d)\]", re.I)
CASE = re.compile(r"^CASE STUDY\b")
MCQ = re.compile(r"correct letter in the box|Shade one (circle|box)|Tick one box", re.I)
KEY = re.compile(r"(?:Question Answer Mark Guidance\s*)?\*?\d{0,2}\*?(?:\s*\(?[a-z]{1,4}\)?\*?)*\s+([A-D])\b(?![a-z'’])")
INSTRUCTION = re.compile(r"^(Answer (all|one|two|the)\b|Choose one\b|If you (have answered|choose)\b|Do not answer\b)", re.I)
SUB = re.compile(r"\((i{1,3}|iv|vi{0,3}|ix|x)\)")
_tables = cut_ocr_gcse.tables
AREA = {}  # question number -> the topic heading it is printed under ("Global Hazards"), for tagging
ROWS = []  # the scheme's rows' whole text, for the check of a long answer's indicative content (msText keeps 800 characters)


def lines(self, i):
    """A starred part's label as cut_pearson reads one: "(d*)" (June 2022 on) as "(d)*". And in a scheme, a sub-part's
    bare "ii" in plain type in the Question column's third cell, which June 2025 Paper 1's sets at 146pt, past the
    120pt cut_ocr_gcse reads plain label pieces to, and past the end of the "Question" header over the column:
    bold, under its header, as cut_pearson expects a label."""
    if i not in self._lines or not getattr(self, "_starred", set()) >= {i}:
        out = [{**l, "text": STARRED.sub(r"(\1)*", l["text"]), "spans": [{**sp, "text": STARRED.sub(r"(\1)*", sp["text"])} for sp in l["spans"]]}
               if STARRED.search(l["text"]) else l for l in _lines(self, i)]
        if getattr(self, "scheme", False):
            out = [{**l, "spans": [{**l["spans"][0], "font": l["spans"][0]["font"] + ",Bold"}]}
                   if l["x0"] < 160 and len(l["spans"]) == 1 and cut_ocr_gcse.PIECE.fullmatch(l["text"].strip()) and not cp.bold(l["spans"][0]) else l
                   for l in out]
            # Those romans sit right of the "Question" header's span, which cut_pearson takes as the label column:
            # the header spans them.
            romans = [l["x1"] for l in out if l["x0"] < 160 and re.fullmatch(r"\(?(i{1,3}|iv|vi{0,3})\)?", l["text"].strip())]
            out = [{**l, "x1": max([l["x1"]] + romans)} if l["text"].strip() == "Question" and cp.bold(l["spans"][0]) and romans else l for l in out]
            # One-line rows 13pt apart (June 2023 Paper 1, 4(a)): cut_pearson reads "(ii)" with "(iii)" under it as one
            # label wrapped over two lines. A sub-part's label under another's is its own row: marked so it isn't joined
            # (a zero-width space, which the reader then reads off as the start of the row's answer).
            subs = [l for l in out if l["x0"] < 160 and SUB.fullmatch(l["text"].strip())]
            out = [{**l, "text": l["text"] + "\u200b"} if l in subs and any(o is not l and abs(o["x0"] - l["x0"]) < 12 and 0 < l["y0"] - o["y0"] < 16 for o in subs)
                   else l for l in out]
        self._lines[i] = out
        self._starred = getattr(self, "_starred", set()) | {i}
    return self._lines[i]


def tables(doc):
    """cut_ocr_gcse's scheme rows, and a part the scheme prints as its own first sub-part ("4 (a) (i)" for the paper's
    4(a), "4 (a) (i)" for a question with no parts) under the paper's label too."""
    out = _tables(doc)
    ROWS[:] = [text for _, text, _ in out.values()]
    for (q, letter, roman), row in list(out.items()):
        if roman == "i" and (q, letter, "ii") not in out:
            out.setdefault((q, letter, None), row)
            if letter == "a" and not any(k[0] == q and k[1] not in (None, "a") for k in out):
                out.setdefault((q, None, None), row)
    return out


def headings(doc):
    """The bold lines set over a question's number, with no words of the question between ("Section A",
    "Global Hazards", "Changing Climate"): the paper's topic headings."""
    out = set()
    labels, _ = _qp_labels(doc)
    for pg, y, q, letter, roman in labels:
        if letter:
            continue
        above = [l for l in doc.lines(pg) if y - 70 < l["y0"] < y - 2 and l["x0"] < 320]
        for l in reversed(above):
            if not cp.bold(l["spans"][0]) or len(l["text"]) > 60 or re.match(r"[\d(\[]", l["text"]) or CASE.match(l["text"]):
                break
            out.add(l["text"].strip())
    return out


def qp_labels(doc):
    """cut_pearson's labels, each moved up over the lines set above it since the part before ended (its "[2]"): a case
    study's heading and name lines ("CASE STUDY", "Name of weather hazard event ....."), a fieldwork question's
    "Fieldwork title: ....", "Look at Fig. 8 in the Resource Booklet." over a question's number. Topic headings and the
    paper's instructions there ("Changing Climate", "SECTION C", "Answer all the questions.") stay out, and stop a
    part's crop (cp.STOP, read per paper)."""
    labels, end_page = _qp_labels(doc)
    named = headings(doc)
    # Each question's topic: the last heading printed before its number that isn't "Section A".
    AREA.clear()
    marks = sorted((pg, l["y0"], l["text"].strip()) for pg in range(len(doc)) for l in doc.lines(pg)
                   if l["text"].strip() in named and not re.match(r"Section [A-D]$", l["text"].strip(), re.I))
    for pg, y, q, letter, roman in labels:
        if not letter and not roman:
            AREA[f"{q:02d}"] = next((t for p, h, t in reversed(marks) if (p, h) < (pg, y)), None)
    cp.STOP = re.compile(_STOP.pattern + ("|^(" + "|".join(re.escape(h) for h in sorted(named)) + r")\s*$" if named else ""), re.I)
    out = []
    for pg, y, q, letter, roman in labels:
        f = doc.frame(pg)
        above = [l for l in doc.lines(pg) if f.y0 - 2 <= l["y0"] < y - 2 and l["x0"] >= f.x0 - 2]
        # (after the part before's marks, or the last of its answer lines carried over the page)
        ends = [l["y1"] for l in above if re.search(r"\[\d{1,2}\]$", l["text"]) or re.fullmatch(r"[.…\s]+", l["text"])]
        before = max([t for p, t, *_ in out if p == pg] + ends + [0])
        lead = [l for l in above if l["y0"] > before + 2 and not heading(l)]
        out.append((pg, min(l["y0"] for l in lead), q, letter, roman) if lead else (pg, y, q, letter, roman))
    return out, end_page


def heading(l):
    return bool(cp.STOP.match(l["text"]) or INSTRUCTION.match(l["text"]) or re.fullmatch(r"\d{1,2}", l["text"].strip()))


def region(doc, start, end, end_page):
    """cut_pearson's region, less a piece carried over a page that holds only a topic heading: "Changing Climate" at the
    top of the page the next question starts on sits on the frame's edge, above where cp.STOP is looked for."""
    pieces = _region(doc, start, end, end_page)
    return [(pg, r) for n, (pg, r) in enumerate(pieces)
            if n == 0 or not all(heading(l) for l in doc.lines(pg) if cp.inside(l, r)) or not doc.text(pg, r).strip()]


def booklet_figures(path):
    """{"3a": [image, ...], ...} in the booklet's order: each figure from its caption to the next caption, or to the foot of
    the page; a page that opens with no caption carries on the figure before it. Pages that are pictures with no text
    (June 2022 Paper 2's) are read by OCR (cp.Doc)."""
    if not path or not os.path.exists(path):
        return {}, {}
    doc = cp.Doc(path)
    figs, titles, current = {}, {}, None
    for i in range(1, len(doc)):
        page = doc[i]
        w, h = page.rect.width, page.rect.height
        lines = doc.lines(i)
        text = " ".join(l["text"] for l in lines)
        if "BLANK PAGE" in text and len(text) < 200:
            continue
        bottom = h - 64  # above "© OCR 2024" and "Turn over"
        for l in lines:
            if l["y0"] > 50 and (re.match(r"Copyright Information|©", l["text"]) or re.search(r"J384/0\d/RB", l["text"])):
                bottom = min(bottom, l["y0"] - 6)
        turned = sideways(page)
        if turned:
            # A landscape page (June 2024 Paper 2's Figs 1 and 2, side by side): the whole page, upright, for each figure on it.
            img = cp.trim(doc.crop(i, pymupdf.Rect(30, 50, w - 30, bottom)), 14)
            if img is not None:
                img = img.rotate(-90 if turned[0][2] < 0 else 90, expand=True)
                for fig, title, _ in turned:
                    figs.setdefault(fig, []).append(img)
                    titles.setdefault(fig, title)
                current = turned[-1][0]
            continue
        caps = [l for l in lines if CAPTION.match(l["text"]) and l["x0"] < 90 and 46 < l["y0"] < bottom
                and (cp.bold(l["spans"][0]) or i in doc.pictures)]
        cuts = [(50.0, current)] if not caps or caps[0]["y0"] > 80 else []
        for c in caps:
            fig = CAPTION.match(c["text"]).group(1)
            # Its title: the rest of its line ("Fig. 1 Global temperature trends…"), or the bold line under it.
            nxt = next((l for l in lines if 0 < l["y0"] - c["y0"] < 34 and abs(l["x0"] - c["x0"]) < 4 and not CAPTION.match(l["text"])), None)
            rest = CAPTION.sub("", c["text"]).strip()
            titles.setdefault(fig, rest if len(rest) > 3 else nxt["text"] if nxt and cp.bold(nxt["spans"][0]) else "")
            cuts.append((c["y0"] - 6, fig))
        for n, (top, fig) in enumerate(cuts):
            end = cuts[n + 1][0] if n + 1 < len(cuts) else bottom
            if fig is None or end < top + 12:
                continue
            img = cp.trim(doc.crop(i, pymupdf.Rect(36, top, w - 36, end)), 14)
            if img is not None:
                figs.setdefault(fig, []).append(img)
        current = cuts[-1][1] if cuts else current
    return figs, titles


def sideways(page):
    """[(figure, title, direction)] for the captions set running up or down the page, in reading order; [] for an upright page."""
    rows = [(l, "".join(s["text"] for s in l["spans"]).strip()) for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])]
    rows = [(l, t) for l, t in rows if t]
    out = []
    for n, (l, t) in enumerate(rows):
        m = CAPTION.match(t)
        if m and abs(l["dir"][0]) < 0.1:
            title = re.sub(r"^Fig(?:ure|\.)?\s*\d{1,2}[a-z]?\b\s*", "", t) or next((u for k, u in rows[n + 1:n + 4] if abs(k["dir"][0]) < 0.1 and not CAPTION.match(u)), "")
            out.append((m.group(1), title, l["dir"][1]))
    return sorted(out, key=lambda c: c[0])


def named_figures(text, figs):
    """The booklet's figures a question's words name, in the booklet's order."""
    wanted = set()
    for m in NAMED.finditer(text):
        got = re.sub(r"(\d{1,2})\s*[–-]\s*(\d{1,2})", lambda r: " ".join(str(k) for k in range(int(r.group(1)), int(r.group(2)) + 1)), m.group(1))
        wanted |= set(re.findall(r"\d{1,2}[a-z]?", got))
    return [f for f in figs if f in wanted or re.sub(r"[a-z]$", "", f) in wanted]


def spag_grid(ms_path):
    """The scheme's "Spelling, punctuation and grammar … (SPaG) assessment grid", cropped: from its heading to the end of
    its last descriptor, or None."""
    if not ms_path or not os.path.exists(ms_path):
        return None, ""
    doc = cp.Doc(ms_path)
    for i in range(len(doc)):
        lines = doc.lines(i)
        head = next((l for l in lines if re.match(r"Spelling, punctuation and grammar", l["text"])), None)
        if not head or not re.search(r"High performance", doc.text(i)):
            continue
        f = doc.frame(i)
        body = [l for l in lines if l["y0"] >= head["y0"] and not re.match(r"Need to get in touch|©|\d{1,3}$", l["text"].strip())]
        end = max(l["y1"] for l in body) + 8
        img = cp.trim(doc.crop(i, pymupdf.Rect(f.x0, head["y0"] - 6, f.x1, end)), 10, sides=True)
        return img, " ".join(l["text"] for l in body)
    return None, ""


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    for old in glob.glob(os.path.join(cp.IMG, f"{set_id}-*-stem.webp")):
        os.remove(old)  # a stem is saved only if it isn't there yet; the booklet's figures are added to it below
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    for p in parts:
        p["area"] = AREA.get(p["question"])
    for p in parts:
        full = next((t for t in ROWS if p["msText"] and t[:800] == p["msText"]), "")
        if len(full) > 800:
            p["msTail"] = full[800:3000]
    ins = qp_path.replace("-qp-", "-ins-")
    figs, titles = booklet_figures(ins)
    grid, grid_text = spag_grid(ms_path)
    by_q = {}
    for p in parts:
        by_q.setdefault(p["question"], []).append(p)
    for q, ps in by_q.items():
        said = " ".join(p["text"] for p in ps)
        # Paper 3's decision-making essay works from the whole booklet, whatever figure it opens with.
        essay = meta["component"].endswith("03") and any((p["marks"] or 0) >= 12 for p in ps)
        shown = list(figs) if WHOLE.search(said) or essay else named_figures(said, figs)
        if not shown:
            continue
        stem = os.path.join(cp.IMG, f"{set_id}-{q}-stem.webp")
        lead = [Image.open(stem).convert("RGB")] if os.path.exists(stem) else []
        width = max([im.width for p in ps for im in [Image.open(os.path.join(cp.IMG, p["qp"]))] if p["qp"]] + [1000])
        imgs = list({id(im): fit(im, width) for f in shown for im in figs[f]}.values())  # Figs 1 and 2 can share a page
        cp.save(cp.stack(lead + imgs), os.path.basename(stem))
        caption = " ".join(f"Fig. {f} {titles.get(f, '')}".strip() + "." for f in shown)
        for p in ps:
            if p["part"] is None and not p["id"].endswith("-q"):
                # A one-part question: "-q", so its stem keeps the question's name (questionBank.ts partImage).
                new = p["id"] + "-q"
                for kind in ("qp", "ms"):
                    if p[kind]:
                        os.replace(os.path.join(cp.IMG, p[kind]), os.path.join(cp.IMG, f"{new}-{kind}.webp"))
                        p[kind] = f"{new}-{kind}.webp"
                p["id"] = new
            p["stem"] = os.path.basename(stem)
            p["figures"] = shown
            p["text"] = (caption + " " + p["text"])[:1500]
    for p in parts:
        # A multiple-choice part ("Write the correct letter in the box.") carries the scheme's letter ("C destructive", "A: line graph").
        key = mcq_key(p["msText"], p["text"]) if MCQ.search(p["text"]) and p["marks"] == 1 else None
        if key:
            p["key"] = key
    for p in parts:
        m = SPAG.search(p["text"])
        if not m:
            continue
        p["spag"] = int(m.group(1))
        if p["marks"]:
            p["marks"] -= p["spag"]
        if p["ms"] and grid is not None and "High performance" not in p["msText"] + p.get("msTail", ""):
            img = Image.open(os.path.join(cp.IMG, p["ms"])).convert("RGB")
            cp.save(cp.stack([img, fit(grid, img.width)]), p["ms"])
            p["spagGrid"] = grid_text[:300]
    return parts


def mcq_key(ms, text):
    """The letter a multiple-choice part's scheme row gives: first after its label ("(ii) C destructive"), else a letter
    the row prints with its option's own words ("1 () C 16cm" where the paper prints "C 16cm")."""
    ms = ms.replace("\u200b", "")
    m = KEY.match(ms)
    if m:
        return m.group(1)
    for m in re.finditer(r"(?<![\w'’])([A-D])\s*:?\s+(\S+)", ms[:200]):
        if re.search(rf"(?<![\w'’]){m.group(1)}\s+{re.escape(m.group(2)[:6])}", text):
            return m.group(1)
    return None


def fit(img, width):
    """An image no wider than the crops it sits with."""
    return img if img.width <= width else img.resize((width, round(img.height * width / img.width)))


cp.qp_labels, cp.cut_set, cp.Doc.lines, cp.region, cut_ocr_gcse.tables = qp_labels, cut_set, lines, region, tables
# A scheme's last row ends where its appendix starts: the SPaG grid (added above to the parts it marks, and only to
# those) and the notes on scribed and word-processed scripts.
APPENDIX = r"Appendix \d|Spelling, punctuation and grammar and the use of specialist terminology( \(SPaG\))?( assessment grid)?\s*$|High performance \d marks|Awarding Spelling"
cp.BACK_BLOCK = re.compile(cp.BACK_BLOCK.pattern + "|^(" + APPENDIX + ")")
cp.BACK_PAGE = re.compile(cp.BACK_PAGE.pattern + "|^(Appendix \\d|Awarding Spelling)", re.I | re.M)

if __name__ == "__main__":
    cp.main()
