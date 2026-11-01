"""Write the Edexcel A-Level History bank's data files from the cut questions and their topic tags.

    python3 scripts/question-bank/edexcel_history/build_history.py [work-dir]

edexcel_sciences/build_pearson.py, pointed at History: the same shapes, written to
src/content/questionBank/edexcel-a-level-history.json and public/question-bank/edexcel-a-level-history/.
Then, History's own:
  - every option is a paper of its own (cut_history.py splits Paper 2's and Papers 34 to 39's two sub-options):
    "Paper 1H", "Paper 2H.1", "Paper 37.2", titled with the option's name;
  - the options filter is the route ("Route H: Democracies in change…"): Papers 1 and 2 belong to one, and
    picking it keeps its Paper 1 and Paper 2 options and every Paper 3 option (which most routes can take);
  - each question paper's Sources or Extracts Booklet, bound in at its back, is split out as its own PDF
    (<component>-ins-<series>.pdf) and hosted as the paper's insert, beside the paper, scheme and report;
  - every question is an essay choice, "EITHER 3 OR 4": each after the first of a section and option carries
    "or", so a paper's marks count one essay.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-history")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import build_pearson as bp  # noqa: E402

SLUG = "edexcel-a-level-history"
bp.SUBJECTS = [(SLUG, "History", "History", ("9HI0", "9HI0"))]
bp.FILES_JSON = None  # the past paper library has no History page yet
SPEC = json.load(open(os.path.join(bp.WORK, "spec.json")))["9HI0"]
OPTIONS = {s["code"]: s for s in SPEC["sections"]}
CODE = {s["code"].replace(".", "").lower(): s["code"] for s in SPEC["sections"]}  # "2h1" -> "2H.1"


def paper_for(comp):
    """'9hi02h1' -> {id, name: 'Paper 2H.1', title: 'The USA, c1920–55: boom, bust and recovery', as: False, option: 'H'}."""
    s = OPTIONS[CODE[comp[4:]]]
    return {"id": comp, "name": f"Paper {s['code']}", "title": s["title"], "as": False, **({"option": s["option"]} if s.get("option") else {})}


bp.paper_for = paper_for


def booklets():
    """Split each question paper's booklet out of it: {(component, series): file name}."""
    sys.path.insert(0, HERE)
    out = {}
    for f in json.load(open(os.path.join(bp.WORK, "manifest.json"))):
        if f["kind"] != "qp":
            continue
        name = f["file"].replace("-qp-", "-ins-")
        path = os.path.join(bp.WORK, "pdf", name)
        if not os.path.exists(path):
            doc = pymupdf.open(os.path.join(bp.WORK, "pdf", f["file"]))
            # The booklet's cover, after the paper's "TOTAL FOR PAPER": "…Sources Booklet" or "…Extracts Booklet".
            end = next((i for i in range(len(doc)) if re.search(r"TOTAL FOR PAPER", doc[i].get_text())), None)
            start = next((i for i in range(end + 1, len(doc)) if re.search(r"(Sources?|Extracts?) Booklet", doc[i].get_text())), None) if end is not None else None
            if start is None:
                continue
            ins = pymupdf.open()
            ins.insert_pdf(doc, from_page=start, to_page=len(doc) - 1)
            ins.save(path, garbage=3, deflate=True)
        out[(f["component"].replace("-", ""), f["series"])] = name
    return out


def no_report(path):
    """October 2020 and November 2021's "reports" for papers with few entries are a page saying there is none."""
    doc = pymupdf.open(path)
    return len(doc) == 1 and "will not publish" in doc[0].get_text()


def finish():
    meta_path = os.path.join(bp.ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    rows_path = os.path.join(bp.ROOT, "public", "question-bank", SLUG, "parts.json")
    meta, rows = json.load(open(meta_path)), json.load(open(rows_path))
    parts = {p["id"]: p for p in json.load(open(os.path.join(bp.WORK, "parts.json")))}
    meta["specs"] = ["9HI0"]
    meta["sections"] = [{"code": s["code"], "title": f"{s['code']}: {s['title']}", **({"option": s["option"]} if s.get("option") else {})} for s in SPEC["sections"]]
    meta["options"] = {"label": "Route", "list": [{"id": k, "name": f"Route {k}: {v}"} for k, v in SPEC["routes"].items()]}
    # The papers in the specification's order: Paper 1's options, then Paper 2's, then Paper 3's.
    order = [s["code"].replace(".", "").lower() for s in SPEC["sections"]]
    order = sorted(order, key=lambda c: (c[0], order.index(c)))
    meta["papers"] = sorted(meta["papers"], key=lambda p: order.index(p["id"][4:]))
    # Each paper's whole files are its question paper's: both sub-options of 2H share 9hi02h's.
    ins = booklets()
    printed = {}  # build_pearson keeps only the papers' own codes, so the PDFs are read off the manifest again
    for f in json.load(open(os.path.join(bp.WORK, "manifest.json"))):
        if f["kind"] == "er" and no_report(os.path.join(bp.WORK, "pdf", f["file"])):
            continue
        printed.setdefault(f"{f['component'].replace('-', '')}-{f['series']}", {})[f["kind"]] = f"edexcel/{f['file']}"
    wholes = {}
    for key, files in printed.items():
        comp, series = key.split("-")
        if (comp, series) in ins:
            files = {**files, "ins": f"edexcel/{ins[(comp, series)]}"}
        for p in meta["papers"]:
            if p["id"].startswith(comp):
                wholes[f"{p['id']}-{series}"] = files
    meta["wholes"] = {k: v for k, v in sorted(wholes.items()) if any(r["p"] == k.split("-")[0] and r["s"] == k.split("-")[1] for r in rows)}
    meta["note"] = ("Every Paper 1, 2 and 3 option (the coursework is not an exam). Pick your route for your Paper 1 and Paper 2 "
                    "options, then your Paper 3 option under Paper; a question's sources or extracts are shown above it.")
    # An essay choice counts once: after the first question of each section of each option's paper and series.
    first = {}
    for r in sorted(rows, key=lambda r: (r["p"], r["s"], bp.label_order(r["l"]))):
        first.setdefault((r["p"], r["s"], parts[r["id"]].get("section")), r["id"])
    alt = {r["id"] for r in rows if first[(r["p"], r["s"], parts[r["id"]].get("section"))] != r["id"]}
    # A question's opening words are its own, not the option heading and its number set over them. Its "Study
    # Sources 1 and 2…" goes too, unless its words don't name them (Paper 1's interpretations question): the row
    # links the paper's booklet where they do (QuestionRow's `insert`).
    over = re.compile(r"^(?:Option [^:]+:.*?)?((?:Study|Read) .*?before you answer this question\.\s*)?\d{1,2}\s+(?=\S)")
    names = re.compile(r"\bsources?\b|\bextracts?\b", re.I)
    for r in rows + meta["sample"]:
        if r["id"] in alt:
            r["or"] = 1
        text = re.split(r"\(Total for Question", parts[r["id"]]["text"])[0]
        m = over.match(text)
        if m:
            own = re.sub(r"\s+", " ", text[m.end():]).strip()
            r["x"] = (own if not m.group(1) or names.search(own[:160]) else m.group(1).strip() + " " + own)[:160]
    json.dump(rows, open(rows_path, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(meta['papers'])} papers, {len(meta['wholes'])} sittings ({sum(1 for v in meta['wholes'].values() if 'ins' in v)} with a booklet), "
          f"{len(alt)} essay choices marked as alternatives", file=sys.stderr)


if __name__ == "__main__":
    bp.main()
    finish()
