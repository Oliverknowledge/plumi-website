"""Write the Edexcel science banks' data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_sciences/build_pearson.py [work-dir]

build_bank.py's sibling, writing the same shapes for Pearson's papers. Reads
<work-dir>/parts.json (cut_pearson.py), spec.json (spec_pearson.py), manifest.json
(fetch_pearson.py) and, if present, tags.json ({part id: ["6.B", ...]}). Writes, per subject:
  src/content/questionBank/<slug>.json      topics, papers, series, the newest 20 parts
  public/question-bank/<slug>/parts.json    the whole list, fetched by the browser
  public/question-bank/<slug>/text.json     search text, fetched when someone types
  public/question-bank/<slug>/reports.json  examiner's reports, by question
and src/content/questionBank/files-edexcel-sciences.json, every whole paper we host (the
past paper library's Edexcel A-Level science pages are built from it).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-sciences")

SUBJECTS = [("edexcel-a-level-biology-a", "Biology A", "Biology A (Salters-Nuffield)", ("8BN0", "9BN0")),
            ("edexcel-a-level-biology-b", "Biology B", "Biology B", ("8BI0", "9BI0")),
            ("edexcel-a-level-chemistry", "Chemistry", "Chemistry", ("8CH0", "9CH0")),
            ("edexcel-a-level-physics", "Physics", "Physics", ("8PH0", "9PH0"))]
TITLES = {
    "9BN0": ["The Natural Environment and Species Survival", "Energy, Exercise and Co-ordination", "General and Practical Applications in Biology"],
    "8BN0": ["Lifestyle, Transport, Genes and Health", "Development, Plants and the Environment"],
    "9BI0": ["Advanced Biochemistry, Microbiology and Genetics", "Advanced Physiology, Evolution and Ecology", "General and Practical Principles in Biology"],
    "8BI0": ["Core Cellular Biology and Microbiology", "Core Physiology and Ecology"],
    "9CH0": ["Advanced Inorganic and Physical Chemistry", "Advanced Organic and Physical Chemistry", "General and Practical Principles in Chemistry"],
    "8CH0": ["Core Inorganic and Physical Chemistry", "Core Organic and Physical Chemistry"],
    "9PH0": ["Advanced Physics I", "Advanced Physics II", "General and Practical Principles in Physics"],
    "8PH0": ["Core Physics I", "Core Physics II"],
}
MONTH = {"JUN": "June", "OCT": "October", "NOV": "November"}
CALC = re.compile(r"\bcalculate\b|\bshow your working\b|\bgive your answer to \d|\bsignificant figures\b|\bdetermine the value\b", re.I)
BOILERPLATE = re.compile(r"DO NOT WRITE IN THIS AREA|Turn over|\(Total for Question \d+ = \d+ marks?\)|TOTAL FOR SECTION [A-C] = \d+ MARKS", re.I)


# Pearson's reports talk about sample answers printed beside them ("This response scores two
# marks."); without the scans those sentences mean nothing, so they go.
EXEMPLAR = re.compile(r"(?:^|(?<=[.!?]\s))[^.!?]*\b(?:(?:[Tt]his|[Tt]hese|[Tt]he following|[Hh]ere,? the) (?:is (?:a |an )?)?(?:fully |partially )?(?:correct |incorrect |good |typical |strong |weak )?"
                      r"(?:response|responses|answer|answers|example|examples|candidate|script|extract)s?|[Tt]his (?:scored|gained|achieved|was awarded))\b[^.!?]*[.!?]\s*")


def clean_report(text):
    paras = [EXEMPLAR.sub("", p).strip() for p in text.split("\n\n")]
    return "\n\n".join(p for p in paras if p.startswith("Question ") or len(p) > 40)


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return int("20" + s[3:]) * 100 + {"JUN": 6, "OCT": 10, "NOV": 11}[s[:3]]


def paper_for(comp):
    """'9ch001' -> {id, name: 'Paper 1', title, as: False}."""
    spec, num = comp[:4].upper(), int(comp[4:])
    as_level = spec.startswith("8")
    titles = TITLES.get(spec, [])
    return {"id": comp, "name": f"{'AS ' if as_level else ''}Paper {num}", "title": titles[num - 1] if num <= len(titles) else "", "as": as_level}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("’", "")).strip("-")


def own_text(text, label):
    """The part's own words: what follows its printed label, "(b)(i)" or "(ii)"."""
    sub = re.findall(r"\(([a-z]+)\)", label)
    for tok in reversed(sub):
        m = re.search(r"\(" + tok + r"\)\s+(.*)", text)
        if m:
            return BOILERPLATE.sub(" ", m.group(1)).strip()
    m = re.match(r"\s*\d{1,2}\s+(.*)", text)
    return BOILERPLATE.sub(" ", m.group(1) if m else text).strip()


def label_order(label):
    q = int(re.match(r"\d+", label).group(0))
    sub = re.findall(r"\(([a-z]+)\)", label)
    romans = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]
    letter = next((ord(s) for s in sub if s not in romans or len(sub) == 2 and s == sub[0]), 0)
    roman = next((romans.index(s) + 1 for s in sub[1:] if s in romans), 0) if len(sub) > 1 else (romans.index(sub[0]) + 1 if sub and sub[0] in romans and not letter else 0)
    return (q, letter, roman)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    files = [{"component": f["component"].replace("-", ""), "series": f["series"], "kind": f["kind"], "file": f"edexcel/{f['file']}", "title": f.get("title", "")}
             for f in manifest]
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    os.makedirs(out_dir, exist_ok=True)
    json.dump(files, open(os.path.join(out_dir, "files-edexcel-sciences.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    wholes, whole_ms = {}, {}
    for f in files:
        wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f["file"]
        if f["kind"] == "ms":
            whole_ms[(f["component"], f["series"])] = f["file"]
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    for subj_slug, name, long_name, specs in SUBJECTS:
        mine = [p for p in parts if p["spec"] in specs and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        tree = spec[specs[1]]
        topic_nodes = tree["topics"]
        valid = {n["code"] for n in topic_nodes}
        rows, text, reports = [], {}, {}
        for p in mine:
            own = own_text(p["text"], p["label"])
            t = [c for c in tags.get(p["id"], []) if c in valid]
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": t,
                   "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
            if p.get("stem"):
                row["st"] = 1
            if p.get("ms"):
                row["ms"] = 1
            elif (p["component"], p["series"]) in whole_ms:
                row["msf"] = whole_ms[(p["component"], p["series"])]
            if p.get("key"):
                row["k"] = p["key"]
            if p.get("er"):
                row["er"] = 1
                reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
            if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
                row["calc"] = 1
            rows.append(row)
            text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
        rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"].startswith("8"), r["p"], label_order(r["l"])))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        used, topics = set(), []
        for n in topic_nodes:
            s = slug(n["title"])
            if s in used:
                s = slug(n["code"] + " " + n["title"])
            used.add(s)
            topics.append({"code": n["code"], "ref": n["ref"], "title": n["title"], "section": n["section"], "slug": s,
                           "count": counts.get(n["code"], 0), "year": n["year"], **({"points": n["points"]} if n.get("points") else {})})
        comps = sorted({r["p"] for r in rows}, key=lambda c: (c.startswith("8"), c))
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series]
        meta = {
            "slug": subj_slug, "board": "Edexcel", "level": "A-Level", "subject": name, "fullName": long_name, "specs": list(specs),
            "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
            "papers": [paper_for(c) for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(out_dir, f"{subj_slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", subj_slug)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        tagged = sum(1 for r in rows if r["t"])
        print(f"{subj_slug}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
