"""Cut Cambridge International's AS & A Level Psychology (9990) papers: cut_pearson.py's Cambridge mode, plus two things of Psychology's own.

    python3 scripts/question-bank/caie_psychology/cut_caie_psychology.py [work-dir] [--only=999031-jun24]
    # work-dir: .work/caie-psychology (fetch_caie_psychology.py); needs: pip install pymupdf pillow

edexcel_sciences/cut_pearson.py reads Cambridge's layout (the CAIE sciences and maths banks), unchanged; it
cuts every part from its label to the next, with the scheme's rows, the examiner report's section and any
stem. This runs it, then, on the parts it wrote:
  - the levels tables. Papers 3 and 4 mark their long answers by generic grids at the front of the scheme
    ("Use Table A: AO1 Knowledge and understanding to mark candidate responses to this question"), once for every
    question of its kind. A part whose scheme names a table has it under its own rows, like OCR Psychology's
    appendix grids. (Papers 1 and 2 print their grid in the row itself.) The specimen Paper 4's table is
    set sideways on two pages; cut_pearson.Doc turns them, so it reads across here;
  - the option. Papers 3 and 4 are four options (Clinical, Consumer, Health, Organisational), under their own
    headings ("Section A: Clinical Psychology"; in Paper 4 "Clinical Psychology" again over Section B), a student
    answering two. Each part gets `option`, read off the paper's headings, so build_caie_psychology.py can
    make a paper of each option.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "caie-psychology"), *[a for a in sys.argv[1:] if a.startswith("--")]]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402

OPTIONS = {"Clinical": "clinical", "Consumer": "consumer", "Health": "health", "Organisational": "organisational"}
HEADING = re.compile(r"^(?:Section [A-D]:\s*)?(Clinical|Consumer|Health|Organisational) Psychology\s*$")
TABLE = re.compile(r"^Table ([A-D]):")
USES = re.compile(r"Use Table ([A-D])\b")


def options_of(qp_path):
    """{question number: option}, from a Paper 3 or 4 paper's option headings."""
    doc = cp.Doc(qp_path)
    found, cur, last = {}, None, 0
    for i in range(1, len(doc)):
        for l in doc.lines(i):
            m = HEADING.match(l["text"])
            if m:
                cur = OPTIONS[m.group(1)]
                continue
            q = re.match(r"^(\d{1,2})(\s|$)", l["text"])
            if cur and q and l["x0"] < 75 and int(q.group(1)) == last + 1:
                last = int(q.group(1))
                found[last] = cur
    return found


def tables_of(ms_path):
    """{"A": image of Table A's grid, ...}: from its heading to the foot of the table, on to the next page where the grid runs on."""
    doc = cp.Doc(ms_path)
    out = {}
    for i in range(min(len(doc), 12)):
        heads = [l for l in doc.lines(i) if TABLE.match(l["text"])]
        for h in heads:
            box = cp.ms_page_box(doc, i)
            pieces = [cp.trim(doc.crop(i, cp.pymupdf.Rect(box.x0 - 6, h["y0"] - 4, box.x1 + 6, box.y1)), keep=10)]
            j = i + 1
            # a grid that runs on: the next page opens on "Level  Description  Marks" with no new heading
            while j < len(doc) and not any(TABLE.match(l["text"]) for l in doc.lines(j)) and re.search(r"\bLevel\b.*\bDescription\b", doc.text(j)[:400], re.S) and j < 12:
                nb = cp.ms_page_box(doc, j)
                pieces.append(cp.trim(doc.crop(j, cp.pymupdf.Rect(nb.x0 - 6, nb.y0, nb.x1 + 6, nb.y1)), keep=10))
                j += 1
            out[TABLE.match(h["text"]).group(1)] = cp.trim(cp.stack(pieces), keep=14)
    return out


def after():
    only = cp.ONLY
    path = os.path.join(cp.WORK, "parts.json")
    parts = json.load(open(path))
    manifest = json.load(open(os.path.join(cp.WORK, "manifest.json")))
    files = {}
    for f in manifest:
        files[(f["component"].replace("-", "") + "-" + f["series"]).lower(), f["kind"]] = f
    tables, options, added = {}, {}, 0
    for p in parts:
        if only and not p["set"].startswith(only):
            continue
        num = p["set"].split("-")[0][4:]  # "31"; a specimen's "03"
        paper = num[1] if num.startswith("0") else num[0]
        if paper in ("3", "4"):
            if p["set"] not in options:
                options[p["set"]] = options_of(os.path.join(cp.WORK, "pdf", files[p["set"], "qp"]["file"]))
            p["option"] = options[p["set"]].get(int(p["question"]))
            if not p["option"]:
                sys.exit(f"{p['id']}: no option found")
        wanted = sorted(set(USES.findall(p.get("msText", ""))))
        if wanted and p.get("ms") and (p["set"], "ms") in files:
            if p["set"] not in tables:
                tables[p["set"]] = tables_of(os.path.join(cp.WORK, "pdf", files[p["set"], "ms"]["file"]))
            grids = [tables[p["set"]][t] for t in wanted if t in tables[p["set"]]]
            if grids:
                base = cp.Image.open(os.path.join(cp.IMG, p["ms"])).convert("RGB")
                cp.save(cp.stack([base, *grids]), p["ms"])
                p["grids"] = wanted
                added += 1
    json.dump(parts, open(path, "w"), ensure_ascii=False)
    print(f"options set on Papers 3 and 4; levels tables added to {added} scheme crops", file=sys.stderr)


if __name__ == "__main__":
    cp.main()
    after()
