"""Write the AQA A-Level Psychology bank's data files from the cut questions and their tags.

    python3 scripts/question-bank/aqa_psychology/build_psychology.py [work-dir]   # default scripts/question-bank/.work/aqa-psychology

build_bank.py for Psychology: the same rows and files
(src/content/questionBank/aqa-a-level-psychology.json and
public/question-bank/aqa-a-level-psychology/{parts,text,reports}.json). What differs:
the topic tree is spec_psychology.py's (sections and topics as the papers arrange
them), and AQA's Psychology papers number whole questions ("07"), with parts
("06.1") only now and then.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, CALC, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-psychology")
SLUG = "aqa-a-level-psychology"
# AQA publishes Psychology from November 2020 on; June 2017-2019 are no longer on its site.
SERIES = {"NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}
PAPERS = {"71821": "Introductory topics in psychology", "71822": "Psychology in context", "71823": "Issues and options in psychology",
          "71811": "Introductory topics in psychology", "71812": "Psychology in context"}


def paper_for(comp):
    as_level = comp.startswith("7181")
    return {"id": comp, "name": f"{'AS ' if as_level else ''}Paper {comp[4]}", "title": PAPERS[comp], "as": as_level}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7182"]
    manifest = [f for f in json.load(open(os.path.join(WORK, "manifest.json"))) if f["series"] in SERIES]
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    whole_ms = {(f["component"], f["series"]): f"aqa/{f['file']}" for f in manifest if f["kind"] == "ms"}
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    # A label read twice on one page gives two parts one id (and one image): leave both out.
    mine = [p for p in parts if p["series"] in SERIES and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in mine:
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if not p.get("ms") and (p["component"], p["series"]) in whole_ms:
            row["msf"] = whole_ms[(p["component"], p["series"])]  # no crop: link the whole scheme
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(p["id"].rsplit("-", 1)[0] if p["part"] else p["id"], p["er"])
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"].startswith("7181"), r["p"], [int(x) for x in r["l"].split(".")]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = [{"code": t["code"], "title": t["title"], "section": t["section"], "slug": slug(t["title"]),
               "count": counts.get(t["code"], 0), "year": t["year"]} for t in tree["topics"]]
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=lambda c: (c.startswith("7181"), c))
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "A-Level", "subject": "Psychology", "specs": ["7182", "7181"],
        "sections": tree["sections"], "topics": topics,
        "papers": [paper_for(c) for c in comps],
        "series": [{"id": s, "label": series_label(s)} for s in series],
        "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
        "count": len(rows), "firstYear": min(years), "lastYear": max(years),
        "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    tagged = sum(1 for r in rows if r["t"])
    print(f"{SLUG}: {len(rows)} questions, {tagged} tagged, {len(reports)} reports, "
          f"{sum(1 for r in rows if r.get('ms'))} scheme crops, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
