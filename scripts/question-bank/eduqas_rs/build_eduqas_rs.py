"""Write the Eduqas A Level Religious Studies bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/eduqas_rs/build_eduqas_rs.py [work-dir]   # default .work/eduqas-rs

eduqas/build_eduqas.py for Religious Studies, in the same shapes. Reads <work-dir>/parts.json
(cut_eduqas_rs.py), spec.json (spec_eduqas_rs.py), manifest.json (fetch_eduqas_rs.py) and
tags.json (tag_eduqas_rs.py merge). Writes src/content/questionBank/eduqas-a-level-religious-studies.json
and public/question-bank/eduqas-a-level-religious-studies/{parts,text,reports}.json. What differs:
  - A paper is a component, and Component 1 is six papers, one per religion ("Component 1B",
    Islam): each carries its `option`, and the bank its `options`, so the page can offer a
    Religion filter that keeps a student's own religion and the two components everyone sits.
    The sections (the specification's areas) carry theirs too, so the topic list follows it.
  - The topics are A Level's; AS papers are tagged to the same ones (spec_eduqas_rs.py says
    which are AS content), so one bank serves both levels.
  - Essays: no calculations (noCalc). Reports are by question (both parts share one).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "eduqas-rs")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import clean_report, slug  # noqa: E402

SLUG = "eduqas-a-level-religious-studies"
MONTH = {"JUN": "June", "OCT": "Autumn"}  # Eduqas calls its October 2020 and 2021 sittings "Autumn"
ORDER = "abcdef23"  # Component 1's options A-F, then Components 2 and 3
# Eduqas's scheme answers another question here: June 2018 Sikhism 4(b) asks whether festivals are social rather than
# religious events, and the scheme's 4(b) is "The gurdwara is a social rather than a religious institution". No crop:
# the part links the whole scheme instead.
WRONG_SCHEME = {"a120uf0-jun18-04-b"}
BOILER = re.compile(r"©\s*WJEC CBAC Ltd\.?|\([AB]120U\w0-1\)", re.I)


def series_rank(s):
    return int("20" + s[3:]) * 100 + (10 if s.startswith("OCT") else 6)


def own(text):
    """A part's own words: no box digits or label ("0 3 a)", "3. (a)"), no marks."""
    return re.sub(r"\s+", " ", re.sub(r"\[\d+\]", "", re.sub(r"^(\d\s?\d|\d\.)?\s*\(?[ab]\)\s*", "", BOILER.sub(" ", text)))).strip()


def paper_for(comp, names):
    """'a120ub0' -> {id, name: 'Component 1B', title: 'Islam', as: False, option: 'B'}; 'b120u20' is AS Component 2."""
    as_level, c = comp.startswith("b"), comp[5]
    option = c.upper() if c in "abcdef" else None
    name = f"{'AS ' if as_level else ''}Component {'1' + option if option else c}"
    return {"id": comp, "name": name, "title": names[option or {"2": "P", "3": "R"}[c]], "as": as_level, **({"option": option} if option else {})}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["A120"]
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    names = {s["code"]: s["title"] for s in tree["sections"]}
    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f["r2"]
    valid = {t["code"] for t in tree["topics"]}
    rows, text, reports = [], {}, {}
    for p in parts:
        if not p.get("qp") or not p["h"]:
            continue
        words = own(p["text"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
               "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": words[:160]}
        if p.get("ms") and p["id"] not in WRONG_SCHEME:
            row["ms"] = 1
        elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
            row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower()
    rank = lambda c: (c.startswith("b"), ORDER.index(c[5]))  # noqa: E731
    rows.sort(key=lambda r: (-series_rank(r["s"]), rank(r["p"]), r["l"]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    used, topics = set(), []
    for t in tree["topics"]:
        s = slug(t["title"])
        if s in used:
            s = slug(f"{names[t['section']]} {t['ref']} {t['title']}")
        used.add(s)
        topics.append({"code": t["code"], "ref": t["ref"], "title": t["title"], "section": t["section"], "slug": s,
                       "count": counts.get(t["code"], 0), "year": t["year"]})
    comps = sorted({r["p"] for r in rows}, key=rank)
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "Eduqas", "level": "A-Level", "subject": "Religious Studies", "specs": sorted({c[:4].upper() for c in comps}),
        "sections": [{"code": s["code"], "title": s["title"], **({"option": s["code"]} if s["code"] in "ABCDEF" else {})} for s in tree["sections"]],
        "topics": topics,
        "papers": [paper_for(c, names) for c in comps],
        "options": {"label": "Religion", "list": [{"id": s["code"], "name": s["title"]} for s in tree["sections"] if s["code"] in "ABCDEF"]},
        "series": [{"id": s, "label": f"{MONTH[s[:3]]} 20{s[3:]}"} for s in series],
        "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps and k.split("-")[1] in series},
        "noCalc": True,
        "count": len(rows), "firstYear": min(years), "lastYear": max(years), "sample": rows[:20],
    }
    json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    os.makedirs(pub, exist_ok=True)
    for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
        json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{SLUG}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, "
          f"{len(comps)} papers, series {series}", file=sys.stderr)


if __name__ == "__main__":
    main()
