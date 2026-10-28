"""Cut WJEC's AS/A Level Business papers (2510U10/20, 1510U30/40): cut_wjec.py with Business's own labels.

    python3 scripts/question-bank/wjec/cut_wjec_business.py [work-dir] [--only=2510u20-jun24]
    # work-dir: .work/wjec-business (fetch_wjec.py --only=business)

cut_wjec.py reads Units 1 and 3 as they are ("1. Time for Tea", then "(a)", "(b)"). Units 2 and 4
are answered in a separate booklet and print each part's number in two boxes, "2" then "1", with
the case it is set on headed only by its title ("Ridiculously Rich by Alana"), so here:
  - a boxed pair is part 1 of question 2, cut as part "a" (the label shown is put back to "2.1");
  - the question starts at its "2." where it has one (Unit 4), else at the case's bold title, so
    the case is the part's stem, as in the other Business banks;
  - the mark schemes are not ruled tables but a block per part, each opening with its label, which
    every summer prints differently ("Q3(a)", "1. (a)" and then "(b)", "1 (a)", "1 1", "4."), with
    the levels grid's band numbers (3, 2, 1, 0) down the same column: a part's rows run from its
    label to the next one;
  - the examiners' report can head a part's comments with its boxes run together, "Q.11": they go
    with question 1.
cut_wjec.py and cut_pearson.py are unchanged; the patches sit at the top level, so the worker
processes cut_pearson.py starts (which re-run this file) get them too.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(HERE, "..", ".work", "wjec-business")]
sys.path.insert(0, HERE)
import cut_wjec as cw  # noqa: E402  (patches cut_pearson for WJEC)

import pymupdf  # noqa: E402

cp = cw.cp
_wjec_labels = cw.wjec_labels
LETTERS = "abcdefgh"
NOT_TITLE = re.compile(r"^(Answer|SECTION|Section|Examiner|Read |Additional|END OF|\d|\(|©)")
MS_LABELS = [  # (pattern, how its groups read)
    (re.compile(r"^Q\s*(\d)\s+([1-8])(?=\s|$)"), "boxed"),  # "Q 1 1" (2016-17)
    (re.compile(r"^(\d)\s*[:.]\s*([1-8])\.?(?=\s|$)"), "boxed"),  # "1:1" (2019), "1. 1." (2025)
    (re.compile(r"^Q\.?\s*(\d{1,2})\s*(?:\(([a-h])\))?\s*(?:\(([ivx]+)\))?(?=\s|$)"), "q"),
    (re.compile(r"^(\d{1,2})\s*\.\s*(?:\(([a-h])\))?\s*(?:\(([ivx]+)\))?(?=\s|$)"), "q"),
    (re.compile(r"^(\d{1,2})\s+\(([a-h])\)\s*(?:\(([ivx]+)\))?(?=\s|$)"), "q"),
    (re.compile(r"^(\d)\s+([1-8])(?=\s|$)"), "boxed"),
    (re.compile(r"^\(([a-h])\)\s*(?:\(([ivx]+)\))?(?=\s|$)"), "part"),
    (re.compile(r"^\(([ivx]+)\)(?=\s|$)"), "roman"),  # "(ii)" under "5. (a) (i)" (2024)
]


def bold(l):
    return all("Bold" in s.get("font", "") for s in l["spans"])


def boxed(doc, i):
    """[(y, d1, d2)]: two digits in boxes on one line, "2" at x 60-75 then "1" 15-35pt to its right (bold or not:
    2018's aren't). Usually question 2's part 1; "0 1" is question 1's own number (Unit 4, 2022)."""
    out, lines = [], doc.lines(i)
    for l in lines:
        if not 55 < l["x0"] < 75:
            continue
        m = re.fullmatch(r"(\d)\s+(\d)", l["text"])
        if m and m.group(2) in "12345678":
            out.append((l["y0"], m.group(1), m.group(2)))
        elif re.fullmatch(r"\d", l["text"]):
            nxt = next((o for o in lines if o is not l and abs(o["y0"] - l["y0"]) < 3 and re.fullmatch(r"\d", o["text"]) and 15 < o["x0"] - l["x0"] < 35), None)
            if nxt and nxt["text"] in "12345678":
                out.append((l["y0"], l["text"], nxt["text"]))
    return out


def business_labels(doc):
    labels, end_page = _wjec_labels(doc)
    pairs = [(i, y, a, b) for i in range(1, end_page + 1) for y, a, b in boxed(doc, i)]
    if not pairs:
        return labels, end_page
    if all(a == "0" for _, _, a, _ in pairs):
        return numbered(doc, [(i, y, int(b)) for i, y, _, b in pairs], end_page)
    parts = [(i, y, int(a), b) for i, y, a, b in pairs if a != "0"]
    heads = {q: (i, y) for i, y, q, letter, _ in labels if letter is None}
    out, prev = [], (0, 0)
    for n, (i, y, q, p) in enumerate(parts):
        if n == 0 or parts[n - 1][2] != q:  # the question's first part: where does it start?
            start = heads.get(q) if q in heads and heads[q] < (i, y) and heads[q] > prev else None
            if not start:  # its case's bold title, the first after the part before it
                for pg in range(prev[0], i + 1):
                    f = doc.frame(pg)
                    hit = next((l for l in doc.lines(pg) if (pg, l["y0"]) > prev and (pg, l["y0"]) < (i, y) and f.y0 - 8 < l["y0"] < f.y1
                                and l["x0"] < 62 and bold(l) and len(l["text"]) < 80 and not NOT_TITLE.match(l["text"])), None)
                    if hit:
                        start = (pg, hit["y0"])
                        break
            if start:
                out.append((start[0], start[1], q, None, None))
        out.append((i, y, q, LETTERS[int(p) - 1], None))
        prev = (i, y + 1)
    return out, end_page


def numbered(doc, heads, end_page):
    """Questions numbered in boxes ("0 1"), their parts "a)", "b)" (or "(a)") and "(i)" in the text."""
    out = []
    for n, (i, y, q) in enumerate(heads):
        out.append((i, y, q, None, None))
        nxt = heads[n + 1][:2] if n + 1 < len(heads) else (end_page + 1, 0)
        letter, roman = None, None
        for pg in range(i, min(nxt[0], end_page) + 1):
            f = doc.frame(pg)
            for l in doc.lines(pg):
                if not ((i, y) < (pg, l["y0"]) < nxt) or l["x0"] > f.x0 + 80 or not f.y0 - 8 < l["y0"] < f.y1:
                    continue
                rest = l["text"]
                for _ in range(2):
                    m = re.match(r"\(?([a-h]|[ivx]+)\)\s*", rest)
                    if not m:
                        break
                    tok = m.group(1)
                    want_letter = LETTERS[LETTERS.index(letter) + 1] if letter else "a"
                    want_roman = cp.ROMANS[cp.ROMANS.index(roman) + 1] if roman else "i"
                    if tok == want_letter and not (tok == want_roman and letter):
                        letter, roman = tok, None
                        out.append((pg, l["y0"], q, letter, None))
                    elif tok == want_roman and letter:
                        roman = tok
                        out.append((pg, l["y0"], q, letter, roman))
                    else:
                        break
                    rest = rest[m.end():]
    return out, end_page


def business_ms(doc):
    """{(q, letter, roman): ([(page, rect)], text, None)}: each label's block, to the next label."""
    found, q_now, letter_now = [], 0, None
    summary = next((i for i in range(len(doc)) if cw.SUMMARY.search(doc.text(i))), len(doc))
    for i in range(1, summary):
        lines = doc.lines(i)
        for l in lines:
            text = l["text"]
            # Labels are bold, but for 2018 Unit 1's "4 (a)" onwards: a number with its part is distinctive enough.
            if l["x0"] > 100 or not ("Bold" in l["spans"][0].get("font", "") or re.match(r"\d{1,2}\.? \([a-h]\)", text)):
                continue
            if re.fullmatch(r"\d", text):  # boxes set as two lines, "1" at x 72 and "1" at x 92 (2023)
                nxt = next((o for o in lines if o is not l and abs(o["y0"] - l["y0"]) < 3 and re.fullmatch(r"[1-8]", o["text"])
                            and 12 < o["x0"] - l["x0"] < 30 and "Bold" in o["spans"][0].get("font", "")), None)
                text = f"{text} {nxt['text']}" if nxt else text
                # A question with no parts is just its number, "4" (Unit 3): the next question's, left of the levels
                # grid's band numbers (3, 2, 1, 0), which stand in a column, where it stands alone.
                if not nxt and int(text) == q_now + 1 and l["x0"] < 78 and not any(
                        o is not l and re.fullmatch(r"\d", o["text"]) and abs(o["x0"] - l["x0"]) < 4 for o in lines):
                    q_now, letter_now = int(text), None
                    found.append((i, l["y0"], (q_now, None, None)))
                    continue
            for pat, kind in MS_LABELS:
                m = pat.match(text)
                if not m:
                    continue
                if kind == "part":
                    if not q_now:
                        break
                    key = (q_now, m.group(1), m.group(2))
                elif kind == "roman":
                    if not letter_now:
                        break
                    key = (q_now, letter_now, m.group(1))
                elif kind == "boxed":
                    key = (int(m.group(1)), LETTERS[int(m.group(2)) - 1], None)
                else:
                    key = (int(m.group(1)), m.group(2), m.group(3))
                if key[0] < q_now or key[0] > q_now + 4 or (key[0] == q_now and key[1] and letter_now and key[1] < letter_now and not key[2]):
                    break  # front-page instructions, or a number inside a row
                q_now, letter_now = key[0], key[1] or letter_now if key[0] == q_now else key[1]
                found.append((i, l["y0"], key))
                break
    out = {}
    for n, (i, y, key) in enumerate(found):
        nxt = found[n + 1] if n + 1 < len(found) else (summary, 0, None)
        pieces, pg = [], i
        while pg < min(nxt[0] + 1, summary, len(doc)):
            h, w = doc.page_rect(pg) if hasattr(doc, "page_rect") else (doc.doc[pg].rect.height, doc.doc[pg].rect.width)
            head = max([l["y1"] for l in doc.lines(pg) if l["y0"] < 70 and "WJEC CBAC" in l["text"]] + [36])
            top = y - 3 if pg == i else head + 4
            foot = min([h - 30] + [l["y0"] - 4 for l in doc.lines(pg) if l["y0"] > h - 90 and ("WJEC CBAC" in l["text"] or re.fullmatch(r"\d{1,2}", l["text"]))])
            bottom = min(nxt[1] - 3, foot) if pg == nxt[0] else foot
            if bottom > top + 10:
                pieces.append((pg, pymupdf.Rect(36, top, w - 36, bottom)))
            if pg == nxt[0]:
                break
            pg += 1
        text = " ".join(doc.text(p, r) for p, r in pieces)
        if key not in out:
            out[key] = (pieces, text, None)
    return out


def business_report(path, section=None):
    """cut_wjec's report reader, then a part's own heading folded into its question: 2024's Unit 2 comments
    are headed "Q.11", "Q.12" (question 1, parts 1 and 2), and no Business paper has more than seven questions."""
    out = {}
    for k, v in _report(path, section).items():
        q = f"0{k[0]}" if k.isdigit() and int(k) >= 11 and k[1] in "12345678" else k
        out[q] = (out[q] + "\n\n" + v) if q in out else v
    return out


_report = cp.examiner_report
cp.qp_labels = business_labels
cp.ms_tables = business_ms
cp.examiner_report = business_report


def relabel():
    """A paper that boxes its parts ("2 1") shows "2.1", not the "2(a)" it was cut as."""
    path = os.path.join(cp.WORK, "parts.json")
    parts = json.load(open(path))
    boxed_sets = set()
    for f in json.load(open(os.path.join(cp.WORK, "manifest.json"))):
        set_id = f"{f['component']}-{f['series']}".lower()  # (cut_wjec.main lowercases the component)
        if f["kind"] == "qp" and any(p["set"] == set_id for p in parts):
            doc = cp.Doc(os.path.join(cp.WORK, "pdf", f["file"]))
            if any(boxed(doc, i) for i in range(1, len(doc))):
                boxed_sets.add(set_id)
    for p in parts:
        if p["set"] in boxed_sets and p.get("part") and p["part"] in LETTERS:
            p["label"] = f"{int(p['question'])}.{LETTERS.index(p['part']) + 1}"
    json.dump(parts, open(path, "w"), ensure_ascii=False)
    print(f"{len(boxed_sets)} papers number their parts in boxes", file=sys.stderr)


if __name__ == "__main__":
    cw.main()
    relabel()
