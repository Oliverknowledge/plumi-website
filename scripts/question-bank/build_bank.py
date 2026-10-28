"""Write the question bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/build_bank.py [work-dir]

Reads <work-dir>/parts.json (cut.py), spec.json (spec.py), manifest.json
(fetch_aqa.py) and, if present, tags.json ({part id: ["3.2.2", ...]}, see
tag.md). Writes, per subject:
  src/content/questionBank/<slug>.json   topics, papers, series, the newest 20 parts
  public/question-bank/<slug>/parts.json the whole list, fetched by the browser
  public/question-bank/<slug>/text.json  search text, fetched when someone types
  public/question-bank/<slug>/reports.json  examiner's reports, by question
and src/content/questionBank/files.json, every whole paper we host (the past
paper library's AQA A-Level science pages are built from it).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, ".work")

SUBJECTS = [("aqa-a-level-biology", "Biology", ("7401", "7402")),
            ("aqa-a-level-chemistry", "Chemistry", ("7404", "7405")),
            ("aqa-a-level-physics", "Physics", ("7407", "7408"))]
MONTH = {"JUN": "June", "NOV": "November"}
OPTIONS = {"A": "Section A", "BA": "Astrophysics", "BB": "Medical physics", "BC": "Engineering physics", "BD": "Turning points", "BE": "Electronics"}
# A bank re-cut under the same crop names gets a new version, so browsers fetch the new crops:
# Biology for AS June 2016, whose crops had lost the end of every "[n marks]" (28 October 2026).
CROP_VERSION = {"aqa-a-level-biology": 1}
CALC = re.compile(r"\bcalculate\b|\bshow your working\b|\bgive your answer to \d|\bsignificant figures\b|\bdetermine the value\b", re.I)


def series_label(s):
    return "Specimen" if s == "SPEC" else f"{MONTH[s[:3]]} 20{s[3:]}"


def series_rank(s):
    return 0 if s == "SPEC" else int("20" + s[3:]) * 100 + (11 if s.startswith("NOV") else 6)


def paper_for(comp, titles):
    spec, rest = comp[:4], comp[4:]
    as_level = spec in ("7401", "7404", "7407")
    num = rest[0]
    title = ""
    for t in titles:
        m = re.search(r"Paper \d\w*\s+(.*?)\s+-\s+(?:June|November|Sample)", t)
        if m and not re.match(r"^(?:Section|Option)", m.group(1)):
            title = m.group(1)
            break
    if len(rest) > 1:  # Physics Paper 3: Section A, or one of the options
        name = f"Paper 3 {OPTIONS.get(rest[1:], rest[1:])}" if rest[1:] != "A" else "Paper 3A"
        return {"id": comp, "name": name, "title": OPTIONS.get(rest[1:], title), "as": as_level}
    return {"id": comp, "name": f"{'AS ' if as_level else ''}Paper {num}", "title": title, "as": as_level}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def own_text(text, label):
    """The part's own words: everything after its printed label ("0 1 . 4")."""
    q, _, p = label.partition(".")
    pat = r"\s*".join(list(q)) + (r"\s*\.\s*" + r"\s*".join(list(p)) if p else "")
    m = re.search(pat + r"\s+(.*)", text)
    return BOILERPLATE.sub(" ", m.group(1) if m else text).strip()


BOILERPLATE = re.compile(r"Question \d+ continues on the next page|Turn over ►?|Do not write outside the box|Extra space|END OF QUESTIONS", re.I)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    titles = {}
    for f in manifest:
        if f["kind"] == "qp" and f.get("title"):
            titles.setdefault(f["component"], []).append(f["title"])

    # The past paper library lists AQA's own copies only: the Biology papers taken from PMT
    # (fetch_pmt_aqa_biology.py) are for the question bank, as the founder asked.
    files = [{"component": f["component"], "series": f["series"], "kind": f["kind"], "file": f"aqa/{f['file']}", "title": f.get("title", "")}
             for f in manifest if f["component"][:4] in ("7401", "7402", "7404", "7405", "7407", "7408") and len(f["component"]) >= 5
             and "physicsandmathstutor" not in f.get("source", "")]
    os.makedirs(os.path.join(ROOT, "src", "content", "questionBank"), exist_ok=True)
    json.dump(files, open(os.path.join(ROOT, "src", "content", "questionBank", "files.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    whole_ms = {(f["component"], f["series"]): f"aqa/{f['file']}" for f in manifest if f["kind"] == "ms"}
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    for subj_slug, name, specs in SUBJECTS:
        # A label read twice on one page gives two parts one id (and one image): leave both out.
        seen = {}
        for p in parts:
            seen[p["id"]] = seen.get(p["id"], 0) + 1
        mine = [p for p in parts if p["spec"] in specs and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        nodes = spec[specs[1]]
        # Year 1 is the AS content; Year 2 is "A-level only" (a section marked so makes all its topics Year 2).
        # Physics 3.9 onwards are the Paper 3 options.
        def year_of(n):
            if name == "Physics" and int(n["code"].split(".")[1]) >= 9:
                return 3
            sec = next((x for x in nodes if x["level"] == 1 and x["code"] == ".".join(n["code"].split(".")[:2])), None)
            return 2 if n.get("alevelOnly") or (sec and sec.get("alevelOnly")) else 1
        sections = [{"code": n["code"], "title": n["title"]} for n in nodes if n["level"] == 1]
        topic_nodes = [n for n in nodes if n["level"] == 2]
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
            if not p.get("ms") and not p.get("key") and (p["component"], p["series"]) in whole_ms:
                row["msf"] = whole_ms[(p["component"], p["series"])]  # no crop: link the whole scheme
            if p.get("key"):
                row["k"] = p["key"]  # a multiple-choice answer, shown instead of a scheme crop
            if p.get("er"):
                row["er"] = 1
                reports.setdefault(p["id"].rsplit("-", 1)[0] if p["part"] else p["id"], p["er"])
            if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
                row["calc"] = 1
            rows.append(row)
            text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
        rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"][:4] in ("7401", "7404", "7407"), r["p"], [int(x) for x in r["l"].split(".")]))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        used = set()
        topics = []
        for n in topic_nodes:
            s = slug(n["title"])
            if s in used:
                s = slug(n["code"] + " " + n["title"])
            used.add(s)
            topics.append({"code": n["code"], "title": n["title"], "section": n["code"].rsplit(".", 1)[0], "slug": s, "count": counts.get(n["code"], 0), "year": year_of(n)})
        comps = sorted({r["p"] for r in rows}, key=lambda c: (c[:4] not in ("7402", "7405", "7408"), c))
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series if s != "SPEC"]
        meta = {
            "slug": subj_slug, "board": "AQA", "level": "A-Level", "subject": name, "specs": list(specs),
            **({"cropVersion": CROP_VERSION[subj_slug]} if subj_slug in CROP_VERSION else {}),
            "sections": sections, "topics": topics,
            "papers": [paper_for(c, titles.get(c, [])) for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            # Whole files we host per sitting, for "the whole paper" links: {"74051-JUN23": {"qp": "aqa/...", ...}}.
            "wholes": {f"{f['component']}-{f['series']}": {**wholes.get(f"{f['component']}-{f['series']}", {})}
                       for f in manifest if f["component"] in comps},
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        os.makedirs(os.path.join(ROOT, "src", "content", "questionBank"), exist_ok=True)
        json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{subj_slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", subj_slug)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        tagged = sum(1 for r in rows if r["t"])
        print(f"{subj_slug}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, papers {[p for p in comps]}", file=sys.stderr)


if __name__ == "__main__":
    main()
