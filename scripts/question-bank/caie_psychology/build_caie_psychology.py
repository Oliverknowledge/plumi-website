"""Write the CAIE AS & A Level Psychology bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/caie_psychology/build_caie_psychology.py [work-dir]
    # work-dir: .work/caie-psychology

caie/build_caie.py's sibling, in the same shapes, for Psychology (9990). Reads <work-dir>/parts.json
(cut_caie_psychology.py), spec.json (spec_caie_psychology.py), manifest.json (fetch_caie_psychology.py) and tags.json
(tag_caie_psychology.py merge). Writes
  src/content/questionBank/caie-a-level-psychology.json       topics, papers, series, the newest 20 parts
  public/question-bank/caie-a-level-psychology/parts.json     the whole list, fetched by the browser
  public/question-bank/caie-a-level-psychology/text.json      search text, fetched when someone types
  public/question-bank/caie-a-level-psychology/reports.json   examiners' reports, by question

Papers 1 and 2 are AS (Approaches, Issues and Debates; Research Methods). Papers 3 and 4 hold four specialist options
(Clinical, Consumer, Health and Organisational psychology), a student answering two, so, as in OCR Psychology's
Paper 3, each option's questions are a paper of their own ("Paper 3 (Clinical psychology)", `99903cli`) carrying its
`option`: the bank's Option filter and the paper filter both pick a student's, and the option's topics are in a section
with that `option`. Every option paper links its whole paper (the same PDF for all four). A paper is its syllabus and
number, the same for the June 2024 sitting (9990/31) and the specimen (9990/03): `99903cli`.
Cambridge publishes only that one series and the specimens, which `scope` says wherever other banks give a range of years.
Where a paper has no usable scheme (June 2024 Paper 4: Cambridge's public file is the 2023 one, and the real one is on
the School Support Hub) its 51 questions are cut and kept in the work folder but left out of the bank, since a question
with no scheme fails bank:check; --keep-unmarked builds them in anyway.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(next(a for a in sys.argv[1:] if not a.startswith("--"))) if [a for a in sys.argv[1:] if not a.startswith("--")] else os.path.join(HERE, "..", ".work", "caie-psychology")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, clean_report, label_order, own_text, slug  # noqa: E402

SLUG = "caie-a-level-psychology"
KEEP = "--keep-unmarked" in sys.argv
BOILER = re.compile(r"© UCLES \d{4}|\d{4}/\d{2}/[A-Z/]+/\d{2}|\[Turn over|\.{6,}|…{3,}")
SERIES = {"JUN24": "June 2024", "SPEC": "Specimen"}
SCOPE = "June 2024 and the specimen papers"
OPTIONS = [("clinical", "cli", "Clinical psychology"), ("consumer", "con", "Consumer psychology"), ("health", "hea", "Health psychology"),
           ("organisational", "org", "Organisational psychology")]
SHORT = {o: s for o, s, _ in OPTIONS}
TITLES = {"1": "Approaches, Issues and Debates", "2": "Research Methods", "3": "Specialist Options: Approaches, Issues and Debates",
          "4": "Specialist Options: Application and Research Methods"}
NOTE = ("Cambridge publishes only May/June 2024 and the specimen papers on its own site; the rest are on its School Support Hub, for schools. "
        "In Papers 3 and 4 you answer two of the four options: pick yours with the Option filter or the paper filter. "
        "Paper 4's June 2024 questions are not here: Cambridge's public mark scheme for it is the 2023 one.")


def paper_number(component):
    num = component[4:]
    return num[1] if num.startswith("0") else num[0]


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))["9990"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    valid = {t["code"] for t in spec["topics"]}

    def paper_id(p):
        n = paper_number(p["component"])
        return f"9990{n}" + (SHORT[p["option"]] if p.get("option") else "")

    wholes = {}
    for f in manifest:
        n = paper_number(f["component"].replace("-", ""))
        for pid in [f"9990{n}"] if n in "12" else [f"9990{n}{s}" for _, s, _ in OPTIONS]:
            wholes.setdefault(f"{pid}-{f['series']}", {})[f["kind"]] = f["r2"]
    marked = {(f["component"].replace("-", ""), f["series"]) for f in manifest if f["kind"] == "ms"}
    unmarked = [p for p in parts if (p["component"], p["series"]) not in marked]
    mine = [p for p in parts if p.get("qp") and p["h"] > 0 and (KEEP or (p["component"], p["series"]) in marked)]
    if unmarked and not KEEP:
        print(f"left out: {len(unmarked)} parts of {sorted({p['set'] for p in unmarked})} (no mark scheme)", file=sys.stderr)
    rows, text, reports = [], {}, {}
    for p in mine:
        words = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", BOILER.sub(" ", p["text"].replace("\b", " ")))).strip()
        own = own_text(words, p["label"])
        pid = paper_id(p)
        row = {"id": p["id"], "p": pid, "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        elif wholes.get(f"{pid}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{pid}-{p['series']}"]["ms"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
        rows.append(row)
        text[p["id"]] = (words + " " + re.sub(r"\s+", " ", p.get("msText", ""))).lower()
    papers = []
    for n in "1234":
        for opt, short, name in ([(None, "", "")] if n in "12" else OPTIONS):
            pid = f"9990{n}{short}"
            if any(r["p"] == pid for r in rows):
                papers.append({"id": pid, "name": f"Paper {n}" + (f" ({name})" if opt else ""), "title": TITLES[n], "as": n in "12", **({"option": opt} if opt else {})})
    rows.sort(key=lambda r: (list(SERIES).index(r["s"]), next(i for i, p in enumerate(papers) if p["id"] == r["p"]), label_order(r["l"])))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics, used = [], set()
    for t in spec["topics"]:
        s = slug(t["title"])
        if s in used:
            s = slug(t["code"] + " " + t["title"])
        used.add(s)
        topics.append({"code": t["code"], "ref": "", "title": t["title"], "section": t["section"], "slug": s, "count": counts.get(t["code"], 0), "year": t["year"]})
    meta = {
        "slug": SLUG, "board": "CAIE", "level": "A-Level", "subject": "Psychology", "fullName": "Psychology (9990)", "specs": ["9990"],
        "note": NOTE,
        "sections": [{"code": s["code"], "title": s["title"], **({"option": s["option"]} if s.get("option") else {})} for s in spec["sections"]],
        "topics": topics, "papers": papers,
        "options": {"label": "Option", "list": [{"id": o, "name": name} for o, _, name in OPTIONS]},
        "series": [{"id": s, "label": SERIES[s]} for s in SERIES if any(r["s"] == s for r in rows)],
        "wholes": {k: v for k, v in wholes.items() if (k.split("-")[0], k.split("-")[1]) in {(r["p"], r["s"]) for r in rows}},
        "scope": SCOPE, "count": len(rows), "firstYear": 2024, "lastYear": 2024, "sample": rows[:20],
    }
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    path = os.path.join(out_dir, f"{SLUG}.json")
    if os.path.exists(path):  # keep the data hashes upload_data.py wrote
        meta = {**meta, **({"data": json.load(open(path))["data"]} if "data" in json.load(open(path)) else {})}
    json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, papers {[p['id'] for p in papers]}", file=sys.stderr)


if __name__ == "__main__":
    main()
