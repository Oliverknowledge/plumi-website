"""Cut AQA's GCSE Psychology (8182) papers into questions, each with its mark scheme and its report.

    python3 scripts/question-bank/aqa_gcse_psychology/cut_gcse_psychology.py [work-dir] [--only=81821]   # default scripts/question-bank/.work/aqa-gcse-psychology

The A-Level Psychology cutter (aqa_psychology/cut_psychology.py, so cut.py with its patches):
the GCSE papers are set the same way. Questions are numbered through the paper ("0 5"), with
parts ("0 4 . 2") now and then under a stimulus ("Read the following information."); each
scheme reprints its question in a box under its label, then its guidance, and for an extended
answer the whole levels grid and the possible content, up to the next label. What differs:
  - A multiple-choice part keeps all its options (move_setups).
  - Paper 2's Section B heading is cut off the question under it (below_heading).
  - The scheme pages' frame runs wider and lower than the A-Level's (see ms_frame).
  - Multiple choice ("Shade one box.", "Shade two boxes.") is marked by its letters: the
    scheme's "Answer: B (…)" or "Answers: B (…) E (…)" becomes the part's key ("B", "B and E")
    and it has no scheme crop.
  - The specimen papers are left out, as in the other AQA banks.
  - A set's problems are listed: a part with neither key nor scheme, a multiple-choice part
    with no letter read (or the wrong number of them), an extended answer (9 marks, or any
    scheme with a levels grid) whose scheme lacks its whole grid or its possible content, and
    a paper whose questions don't add up to 100 marks. Most 6-mark "design a study" questions
    are marked point by point, with no grid.
"""
import json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-psychology")] + flags
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "aqa_psychology"))
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402
import cut_psychology  # noqa: E402  (patches cut's frames, regions and report reader for Psychology)

WORK, IMG, ONLY = cut.WORK, cut.IMG, cut.ONLY
COMPONENTS = ("81821", "81822")
MCQ = re.compile(r"Shade (one|two|three) (box|boxes|circles?)\b", re.I)
# The scheme's marks line ("Marks for this question: AO2 – 2 marks", November 2020's "AO2 – 1"), then its letters,
# each with or without its option's words: "Answer: B (…)", "Answers – A (…) and E (…)", "A, E", "C (2:3)".
MARKS_LINE = re.compile(r"Marks for this question:\s*(?:AO\d\s*[–-]\s*\d+(?:\s*marks?)?\s*(?:and\s*)?)+")
LETTER = re.compile(r"([A-F])\b(?:\s*\([^)]*\))?\s*(?:,|and\b)?\s*")
# Schemes that pass on what the checks look for: AQA set them out another way.
KNOWN = {"81822-jun23-05-3": "a 4-mark levels grid followed by what a procedure needs, with no 'Possible content' heading"}
_cut_set, _regions = cut.cut_set, cut.regions


ASKED = set()  # the question paper's labels, (q, part), while its scheme is read: set by cut_set


def regions(doc, max_x, bold_only, portrait):
    """cut_psychology's regions, with a scheme's labels read bold only and kept only where its question paper
    has them. An answer at the scheme's margin ("81.6", "28", "36", "19.075", regular weight at x 43-48, where
    the boxed labels are bold at 58-62) would otherwise end the scheme above it there: anything left that isn't
    a question's label, or repeats the one above (November 2021's "18" twice at one height), joins the region above."""
    found = _regions(doc, max_x, bold_only or not portrait, portrait)
    if portrait:
        return [below_heading(doc, r) for r in found]
    if not ASKED:
        return found
    out = []
    for key, pieces, text in found:
        if out and (key not in ASKED or key == out[-1][0]):
            prev = out[-1][1]
            if prev and pieces and prev[-1][0] == pieces[0][0] and abs(prev[-1][1].y1 - pieces[0][1].y0) < 13:
                pg, r = prev.pop()
                pieces = [(pg, pymupdf.Rect(r.x0, r.y0, r.x1, pieces[0][1].y1))] + pieces[1:]
            out[-1][1] = prev + pieces
            out[-1][2] += "\n" + text
        elif key in ASKED and pieces:
            out.append([key, pieces, text])
    on_box_rule(doc, out)
    return out


def on_box_rule(doc, out):
    """Each scheme question opens in a box whose top rule sits a few points above where its region starts (its label
    less 6pt): move the boundary up onto the rule, so the scheme above doesn't end with a sliver of the next box.
    A table's rule there (November 2021's 22.4 reprints Table 2) is left alone if the new edge would cross its text."""
    for n in range(1, len(out)):
        if not out[n][1] or not out[n - 1][1]:
            continue
        pg, r = out[n][1][0]
        rules = [d["rect"].y0 for d in doc[pg].get_drawings() if d["rect"].height < 2 and d["rect"].width > 30 and d["rect"].x0 < 100 and r.y0 - 9 < d["rect"].y0 < r.y0 + 1]
        if not rules:
            continue
        y = min(rules) - 1.5
        if any(y0 < y < y1 for b in doc[pg].get_text("dict")["blocks"] for l in b.get("lines", []) for _, y0, _, y1 in [l["bbox"]]
               if "".join(s["text"] for s in l["spans"]).strip()):
            continue
        out[n][1][0] = (pg, pymupdf.Rect(r.x0, y, r.x1, r.y1))
        ppg, pr = out[n - 1][1][-1]
        if ppg == pg and abs(pr.y1 - r.y0) < 2:
            out[n - 1][1][-1] = (ppg, pymupdf.Rect(pr.x0, pr.y0, pr.x1, y))


_move_setups = cut.move_setups


def move_setups(doc, out):
    """cut.py's move_setups, sparing multiple choice as it spares "Tick" parts: an option ("B Participants were
    shown an unambiguous image as the test stimulus.") is a full sentence at the margin after the marks, and was
    moved down to the next part as its setup. move_setups passes over a stem (part None), so each multiple-choice
    part is shown to it as one while it runs."""
    mc = [n for n, (key, pieces, text) in enumerate(out) if key[1] is not None and MCQ.search(text)]
    keys = {n: out[n][0] for n in mc}
    for n in mc:
        out[n][0] = (keys[n][0], None)
    _move_setups(doc, out)
    for n in mc:
        out[n][0] = keys[n]


cut.move_setups = move_setups


def below_heading(doc, region):
    """A question paper's region that opens with a section's heading block (Paper 2's Section B: "Language, thought
    and communication / Answer all questions in the spaces provided.", which cut_psychology's skip_heading misses,
    its "Section B" being in the margin): start it at the first line under the block."""
    key, pieces, text = region
    if not pieces:
        return region
    pg, rect = pieces[0]
    lines = cut.text_lines(doc[pg], rect)
    at = next((n for n, (y, x, t) in enumerate(lines) if re.match(r"Answer all questions", t)), None)
    if at is None or at + 1 >= len(lines):
        return region
    first = [(pg, pymupdf.Rect(rect.x0, lines[at + 1][0] - 6, rect.x1, rect.y1))]
    return [key, first + pieces[1:], "\n".join(doc[p].get_text("text", clip=r) for p, r in first + pieces[1:])]


def asked(qp):
    """The labels a question paper prints, for reading its scheme."""
    ASKED.clear()
    ASKED.update(key for key, _, _ in _regions(qp, 75, True, True))


cut.regions = regions


def ms_frame(page):
    """A scheme page's content: below the running header (to 70pt, as the A-Level's), out to 565pt and down to the
    footer rule (785 or 791pt). The A-Level frame stops at 541 by 766pt, which cut off the ends of the GCSE schemes'
    wider lines and the last row of a levels grid at the foot of a page ("0 | 0 | No relevant content")."""
    w, h = page.rect.width, page.rect.height
    rules = [d["rect"].y0 for d in page.get_drawings() if d["rect"].height < 2 and d["rect"].width > w / 2 and d["rect"].y0 > h - 80]
    return pymupdf.Rect(38, 70, w - 30, (min(rules) if rules else h - 60) - 1)


cut.ms_frame = ms_frame
# June 2024 Paper 2's report heads each comment "Q3.1" or "Q4", not "Question 3.1".
_head = cut_psychology.REPORT_HEADING.pattern
cut_psychology.REPORT_HEADING = re.compile(_head.replace(r"\n\s*Questions? (\d{1,2})", r"\n\s*(?:Questions? |Q)(\d{1,2})", 1))
assert cut_psychology.REPORT_HEADING.pattern != _head


def key_of(ms_text):
    m = MARKS_LINE.search(ms_text)
    if not m:
        return None
    rest = re.sub(r"^Answers?\s*[:–-]?\s*", "", ms_text[m.end():])
    letters = []
    while (l := LETTER.match(rest)):
        letters.append(l.group(1))
        rest = rest[l.end():]
    return " and ".join(dict.fromkeys(letters)) or None


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    """cut.py's parts, with multiple choice keyed, and {id: its scheme's whole text} for the checks (msText is its first 800 characters)."""
    asked(pymupdf.open(qp_path))
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    full = {}
    if ms_path and os.path.exists(ms_path):
        for (q, p), pieces, text in cut.regions(pymupdf.open(ms_path), 110, False, False):
            full.setdefault(f"{set_id}-{q}-{p}" if p else f"{set_id}-{q}", re.sub(r"\s+", " ", text))
    for p in parts:
        if MCQ.search(p["text"]) and (key := key_of(full.get(p["id"], ""))):
            p["key"] = key
            if p["ms"]:
                os.remove(os.path.join(IMG, p["ms"]))
                p["ms"] = None
    return parts, full


def problems_of(set_id, parts, full):
    out = []
    for p in parts:
        pid, ms = p["id"], full.get(p["id"], "")
        if not p["ms"] and not p.get("key"):
            out.append(f"{pid}: no scheme")
        if MCQ.search(p["text"]) and not p.get("key"):
            out.append(f"{pid}: multiple choice, no key")
        if p.get("key") and len(p["key"].split(" and ")) != {"one": 1, "two": 2, "three": 3}[MCQ.search(p["text"]).group(1).lower()]:
            out.append(f"{pid}: {MCQ.search(p['text']).group(0)}, key {p['key']}")
        # An extended answer's scheme (every 9-mark one, and any other marked by levels) needs the whole grid and its content.
        if p["ms"] and pid not in KNOWN and ((p["marks"] or 0) >= 9 or re.search(r"Level\s+Marks\s+Description", ms)):
            if not re.search(r"Level\s+Marks\s+Description", ms) or not re.search(r"No relevant content", ms):
                out.append(f"{pid}: {p['marks']}-mark scheme without its whole levels grid")
            if not re.search(r"Possible content|Indicative content|\bAO[123]\s*•", ms, re.I):
                out.append(f"{pid}: {p['marks']}-mark scheme without its possible content")
        if not p["qp"] or not p["h"]:
            out.append(f"{pid}: no crop")
    marks = sum(p["marks"] or 0 for p in parts)
    if marks != 100:
        out.append(f"{set_id}: {marks} marks, not 100")
    return out


def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        parts, full = cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta)
        return set_id, parts, problems_of(set_id, parts, full), None
    except Exception as e:  # noqa: BLE001
        return set_id, [], [], repr(e)


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        if f["series"] != "SPEC" and f["component"] in COMPONENTS:
            sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = [(f"{comp}-{series}".lower(), files, {"component": comp, "spec": comp[:4], "series": series, "paperTitle": files["qp"].get("title", "")})
            for (comp, series), files in sorted(sets.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, issues, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            print(f"{set_id}: {len(parts)} questions, {sum(1 for p in parts if p.get('key'))} keys, {sum(1 for p in parts if p['ms'])} schemes, "
                  f"{len({p['question'] for p in parts if p['er']})} reported, {sum(p['marks'] or 0 for p in parts)} marks", file=sys.stderr, flush=True)
            problems += issues
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
