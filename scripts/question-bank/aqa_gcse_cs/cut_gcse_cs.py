"""Cut AQA's GCSE Computer Science (8525) papers into question parts, each with its mark scheme.

    python3 scripts/question-bank/aqa_gcse_cs/cut_gcse_cs.py [work-dir] [--only=85251b]   # default scripts/question-bank/.work/aqa-gcse-cs

cut_aqa_cs.py (the A-Level's: cut.py with Computer Science's scheme tables, setups and
reports), imported unchanged, with these differences for the GCSE:
  - The schemes print a row's question and part in two columns, "Question" | "Part"
    ("01" at x 68, "5" at x 119) or "Qu Part" ("01" at x 44, "7" at x 76), further apart
    than cut.py joins a label's boxes, and bold in some years, not in others: read the
    part off the second column, on the question's baseline.
  - Paper 1 is set once per language (8525/1A C#, 1B Python, 1C VB.NET) under one mark
    scheme, which follows a program's marking points with model answers in each language
    in turn, each under a bold heading: "C# Example 1 (fully correct)", "Python", "VB.NET
    Example 2 (partially correct – 4 marks)". A language's paper keeps its own language's
    examples and drops the others', so a Python student reads only Python.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-cs")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "computer_science"))
import cut_aqa_cs  # noqa: E402,F401  (patches cut on import)
import cut  # noqa: E402
import pymupdf  # noqa: E402

LANGUAGE = {"85251a": "cs", "85251b": "py", "85251c": "vb"}
HEADING = re.compile(r"^(C#|Python|VB(?:\.NET)?)(?:\s+Example\b.*)?$", re.I)
_left_labels, _regions, _cut_set = cut.left_labels, cut.regions, cut.cut_set
lang = None  # the language of the paper being cut


def left_labels(page, max_x, bold_only, with_x=False):
    """A question paper's boxed labels as cut_aqa_cs reads them; a scheme's "Question" | "Part" columns read together."""
    spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
             if s["text"].strip() and s["bbox"][1] < page.rect.height - 60]
    if bold_only:
        found = _left_labels(page, max_x, bold_only, True)
        taken = lambda y: any(abs(y - f[0]) < 4 for f in found)  # noqa: E731
        # A label run into the words after it in one span: "0 9 . 2 Table 1" (June 2024 Paper 2).
        for s in spans:
            m = re.match(r"(\d) (\d) \. (\d{1,2}) +\D", s["text"])
            if m and "Bold" in s["font"] and s["bbox"][0] < max_x and not taken(s["bbox"][1]):
                found.append((s["bbox"][1], m.group(1) + m.group(2), m.group(3), s["bbox"][0]))
        # A label whose point isn't set bold, "0" "1" "." "1" (June 2025 Python, 01.1): its digits are.
        for s in spans:
            if s["bbox"][0] < max_x and "Bold" in s["font"] and re.fullmatch(r"\d\s*", s["text"]) and s["size"] >= 9 and not taken(s["bbox"][1]):
                row = sorted((t for t in spans if abs(t["bbox"][1] - s["bbox"][1]) < 4 and t["bbox"][0] >= s["bbox"][0]), key=lambda t: t["bbox"][0])
                label, x1 = "", s["bbox"][0]
                for t in row:
                    if not re.fullmatch(r"[\d.\s]+", t["text"]) or t["bbox"][0] - x1 > 25 or (t["text"].strip() != "." and "Bold" not in t["font"]):
                        break
                    label, x1 = label + t["text"], t["bbox"][2]
                m = re.fullmatch(r"(\d{2})\.(\d{1,2})", cut.norm(label))
                if m:
                    found.append((s["bbox"][1], m.group(1), m.group(2), s["bbox"][0]))
        return [lab if with_x else lab[:3] for lab in sorted(found)]
    # The "Part" column's heading ("Part", or "Qu Part" in one span): a part number sits left of its
    # right edge, the answer column's opening digits ("2;", "7") right of it. A page that runs a table
    # on without its heading reads the one on the scheme's first table page.
    heads = part_heads(page)
    if not heads:
        if page.parent.name not in first_table:
            first_table[page.parent.name] = next(((p.number, part_heads(p)) for p in page.parent if part_heads(p)), (None, []))
        first, heads = first_table[page.parent.name]
        if first is None or first > page.number:
            return []  # the marking guidance at the front, not a table
    return _labels(page, spans, heads, with_x)


first_table = {}  # a scheme's first table page and its "Part" heading, by file


def part_heads(page):
    return [s["bbox"][2] for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
            if "Bold" in s["font"] and re.fullmatch(r"(Qu\s+)?Part", s["text"].strip())]


def _labels(page, spans, heads, with_x):
    out = []
    for s in spans:
        m = re.fullmatch(r"(\d{2})\s+(\d{1,2})", s["text"].strip())  # "04 1" in one span (the specimens)
        if s["bbox"][0] < 75 and m:
            out.append((s["bbox"][1], m.group(1), m.group(2), *((s["bbox"][0],) if with_x else ())))
        # A question printed "5" for "05" (the Paper 2 specimens) sits at the column's left edge, where no part does.
        elif (s["bbox"][0] < 75 and re.fullmatch(r"\d{2}", s["text"].strip())) or (s["bbox"][0] < 60 and re.fullmatch(r"\d", s["text"].strip())):
            part = next((t["text"].strip() for t in spans if s["bbox"][2] < t["bbox"][0] < max(heads) + 5 and abs(t["bbox"][1] - s["bbox"][1]) < 4
                         and re.fullmatch(r"\d{1,2}", t["text"].strip())), None)
            out.append((s["bbox"][1], f"{int(s['text']):02d}", part, *((s["bbox"][0],) if with_x else ())))
    return sorted(out)


def language_of(text):
    m = HEADING.match(text)
    return None if not m else "cs" if m.group(1) == "C#" else "py" if m.group(1).lower() == "python" else "vb"


def own_language(doc, pieces):
    """A scheme row's pieces without the other languages' examples: a language's block runs from
    its heading to the next language's, across pages; what comes before the first is everyone's."""
    out, current = [], None
    for pg, rect in pieces:
        cuts = [(y - 4, language_of(t)) for y, x, t in cut.text_lines(doc[pg], rect) if language_of(t)]
        bounds = [(rect.y0, current)] + cuts + [(rect.y1, None)]
        for (y0, l), (y1, _) in zip(bounds, bounds[1:]):
            if y1 - y0 > 6 and l in (None, lang):
                if out and out[-1][0] == pg and abs(out[-1][1].y1 - y0) < 1:
                    out[-1] = (pg, pymupdf.Rect(rect.x0, out[-1][1].y0, rect.x1, y1))
                else:
                    out.append((pg, pymupdf.Rect(rect.x0, y0, rect.x1, y1)))
        current = bounds[-2][1]
    return out


def regions(doc, max_x, bold_only, portrait):
    out = _regions(doc, max_x, bold_only, portrait)
    if portrait or not lang:
        return out
    for r in out:
        pieces = own_language(doc, r[1])
        if pieces != r[1]:
            r[1] = pieces
            r[2] = "\n".join(doc[p].get_text("text", clip=c) for p, c in pieces)
    return out


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    global lang
    lang = LANGUAGE.get(set_id.split("-")[0])
    return _cut_set(qp_path, ms_path, er_path, set_id, meta)


cut.left_labels, cut.regions, cut.cut_set = left_labels, regions, cut_set

if __name__ == "__main__":
    cut.main()
