"""Cut WJEC's Level 3 Applied Diploma in Criminology papers (4543UB0 Unit 2, 4543UD0 Unit 4): cut_wjec.py with Criminology's own schemes.

    python3 scripts/question-bank/wjec/cut_wjec_criminology.py [work-dir] [--only=4543ub0-jun24]
    # work-dir: .work/wjec-criminology (fetch_wjec.py --only=criminology)

The papers are WJEC's usual layout, which cut_wjec.py reads as it is: "1." and the question's
scenario (from 2020 headed "Scenario:"), the stem of every part, then "(a)", "(b) (i)". What differs:
  - every part is written in the booklet, under its marks ("[6]") on a page of dotted lines with
    "Additional space for Question 1(a) only:" below: a part's crop ends just under its marks;
  - the schemes for 2017-2019 are ruled tables ("Question | Answer | Mark | LO"), which cut_wjec.py
    reads, but from Autumn 2020 a part's scheme is a block, not a table: its label in the margin
    ("1." at x 72, "(a)" at 108, "(i)" at 144, the letter printed again beside each sub-part from 2023),
    the question again, the levels grid and the indicative content, to the next label. Summer 2023's
    Unit 2 scheme lists every question first, then the blocks: a label's last block is its own.
cut_wjec.py and cut_pearson.py are unchanged; the patches sit at the top level, so the worker
processes cut_pearson.py starts (which re-run this file) get them too.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(HERE, "..", ".work", "wjec-criminology")]
sys.path.insert(0, HERE)
import cut_wjec as cw  # noqa: E402  (patches cut_pearson for WJEC)

import pymupdf  # noqa: E402

cp = cw.cp
_region = cp.region
_table_ms = cp.ms_tables  # cut_wjec's ruled-table reader
MARKS = re.compile(r"\[\d{1,2}\]\s*$")
LABEL = re.compile(r"^(?:(\d{1,2})\.|\(([a-h])\)|\(([ivx]+)\))$")


SLOT = re.compile(r"^\(([ivx]+)\)[\s.…]*(\[\d{1,2}\])?$")  # "(ii) ........ [5]": an answer's place, not a question
_full = {}  # a part cut short at its answer slots: its whole region, for its marks


def is_slot(doc, pg, y, roman):
    """Summer 2017's Unit 4 asks for two things and numbers the answer lines for each, "(i) ....... [5]", "(ii) ……"."""
    row = [l for l in doc.lines(pg) if abs(l["y0"] - y) < 3]  # (a label is a line of its own, its words beside it)
    return any(SLOT.match(l["text"]) and l["text"].startswith(f"({roman})") for l in row) \
        and not any(re.search(r"[A-Za-z]{2}", l["text"]) and not re.fullmatch(r"\([a-h]\)|\([ivx]+\)", l["text"]) for l in row)


def labels(doc):
    found, end_page = _labels(doc)
    return [k for k in found if not (k[4] and is_slot(doc, k[0], k[1], k[4]))], end_page


def region(doc, start, end, end_page):
    """cut_pearson's region, to just under the part's marks: the answer lines and their additional space aren't shown.
    A part with answer slots ends above its first slot, and its marks are every slot's."""
    pieces = _region(doc, start, end, end_page)
    for n, (pg, r) in enumerate(pieces):
        for l in doc.lines(pg):
            if not cp.inside(l, r) or l["y0"] <= r.y0 + 2:
                continue
            if SLOT.match(l["text"]) and is_slot(doc, pg, l["y0"], SLOT.match(l["text"]).group(1)):
                cut = pieces[:n] + [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, l["y0"] - 4))]
                _full[(id(doc), cut[0][0], round(cut[0][1].y0))] = pieces
                return cut
            if MARKS.search(l["text"]):
                return pieces[:n] + [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, l["y1"] + 6))]
    return pieces


def marks_in(doc, pieces):
    return _marks_in(doc, _full.get((id(doc), pieces[0][0], round(pieces[0][1].y0)), pieces) if pieces else pieces)


def block_ms(doc):
    """{(q, letter, roman): ([(page, rect)], text, None)}: each label's block, to the next label."""
    found, q, letter = [], 0, None
    for i in range(1, len(doc)):
        rows = {}
        for l in doc.lines(i):
            m = LABEL.match(l["text"])
            if not m or l["x0"] > 150:
                continue
            if m.group(1) and l["x0"] < 80:  # (bold, but for Autumn 2020 and January 2022)
                rows.setdefault(round(l["y0"]), {})["q"] = int(m.group(1))
            elif m.group(2) and 100 < l["x0"] < 120:
                rows.setdefault(round(l["y0"]), {})["letter"] = m.group(2)
            elif m.group(3) and 135 < l["x0"] < 150:
                rows.setdefault(round(l["y0"]), {})["roman"] = m.group(3)
        for y in sorted(rows):
            row = rows[y]
            if "q" in row:
                q, letter = row["q"], None
            if "letter" in row:
                letter = row["letter"]
            if not q or ("roman" in row and not letter):
                continue
            key = (q, row.get("letter") or (letter if "roman" in row else None), row.get("roman"))
            if "q" in row and "letter" not in row:
                key = (q, None, None)
            found.append((i, y, key))
    out = {}
    for n, (i, y, key) in enumerate(found):
        nxt = found[n + 1] if n + 1 < len(found) else (len(doc) - 1, None, None)
        pieces = []
        for pg in range(i, nxt[0] + 1):
            page = doc.doc[pg]
            h, w = page.rect.height, page.rect.width
            foot = min([h - 30] + [l["y0"] - 4 for l in doc.lines(pg) if l["y0"] > h - 90 and ("WJEC CBAC" in l["text"] or re.fullmatch(r"\d{1,2}", l["text"]))])
            top = y - 3 if pg == i else 40
            bottom = min(nxt[1] - 3, foot) if pg == nxt[0] and nxt[1] is not None else foot
            if bottom > top + 10 and doc.text(pg, pymupdf.Rect(36, top, w - 36, bottom)).strip():
                pieces.append((pg, pymupdf.Rect(36, top, w - 36, bottom)))
        if pieces:
            out[key] = (pieces, " ".join(doc.text(p, r) for p, r in pieces), None)  # the last block wins (Summer 2023's list comes first)
    return out


def criminology_ms(doc):
    tables = any(re.search(r"^Question$", l["text"]) and any(o["text"] == "Answer" and abs(o["y0"] - l["y0"]) < 6 for o in doc.lines(i))
                 for i in range(len(doc)) for l in doc.lines(i))
    return _table_ms(doc) if tables else block_ms(doc)


def criminology_report(path, section=None):
    """cut_wjec's report reader, from the unit's own heading on. The report covers all four units, and its contents
    list ends "Unit 4 – Crime and Punishment" right above the general comments, which would otherwise be read as
    Unit 4's: the pages before the unit's heading ("UNIT 4 – CRIME AND PUNISHMENT", the last) are left out."""
    if not path or not os.path.exists(path) or not section:
        return _report(path, section)
    doc = pymupdf.open(path)
    at = [i for i, page in enumerate(doc) if re.search(rf"(?m)^[ \t]*UNIT {section}\b", page.get_text())]
    if not at or at[-1] == 0:
        return _report(path, section)
    part = os.path.join(cp.WORK, "er-units", f"{os.path.basename(path)[:-4]}-u{section}.pdf")
    if not os.path.exists(part):
        os.makedirs(os.path.dirname(part), exist_ok=True)
        out = pymupdf.open()
        out.insert_pdf(doc, from_page=at[-1])
        out.save(part)
    return _report(part, section)


_report, _labels, _marks_in = cp.examiner_report, cp.qp_labels, cp.marks_in
cp.qp_labels, cp.marks_in = labels, marks_in
cp.region = region
cp.ms_tables = criminology_ms
cp.examiner_report = criminology_report


if __name__ == "__main__":
    cw.main()
