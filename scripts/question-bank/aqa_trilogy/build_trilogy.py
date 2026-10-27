"""Write the GCSE Combined Science: Trilogy bank's data files from the cut parts and their tags.

    python3 scripts/question-bank/aqa_trilogy/build_trilogy.py [work-dir]   # default scripts/question-bank/.work-gcse-trilogy

build_gcse.py for one bank of three sciences: src/content/questionBank/aqa-gcse-combined-science.json
and public/question-bank/aqa-gcse-combined-science/{parts,text,reports}.json. Its papers are
"Biology Paper 1 Higher" and so on, its sections the specification's Biology (4.x), Chemistry
(5.x) and Physics (6.x) topics. Long topic titles get the separate sciences' short names
(build_gcse.SHORT) for page titles and addresses; the specimen papers aren't in (their pages run past
the cutter's margin, clipping each question's right edge).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, CALC, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work-gcse-trilogy")
SLUG = "aqa-gcse-combined-science"
SERIES = {"JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"}
SCIENCE = {"B": "Biology", "C": "Chemistry", "P": "Physics"}
TIER = {"H": "Higher", "F": "Foundation"}
# Short names for long topic titles, for "<short>: AQA GCSE Combined Science Exam Questions" and the
# address: the separate sciences' (build_gcse.SHORT) where the topic is the same.
SHORT = {
    "4.2.2": "Animal tissues and organs", "4.2.3": "Plant tissues and organs", "4.5.3": "Hormonal coordination",
    "4.6.3": "Understanding evolution", "4.6.4": "Classification", "4.7.1": "Adaptations and competition",
    "4.7.3": "Biodiversity and humans", "5.1.1": "Atomic structure", "5.2.1": "Chemical bonding",
    "5.2.2": "Structure and properties", "5.2.3": "Structures of carbon", "5.3.1": "Conservation of mass",
    "5.3.2": "Moles and masses", "5.5.1": "Exothermic and endothermic", "5.6.2": "Reversible reactions",
    "5.7.1": "Crude oil and hydrocarbons", "5.8.1": "Purity and chromatography", "5.8.2": "Testing for gases",
    "5.9.1": "The Earth's atmosphere", "5.9.2": "Greenhouse gases", "5.9.3": "Atmospheric pollutants",
    "5.10.1": "Earth's resources and water", "5.10.2": "Life cycle assessment", "6.1.1": "Energy stores and transfers",
    "6.1.2": "Conservation of energy", "6.1.3": "Energy resources", "6.2.1": "Current, p.d. and resistance",
    "6.3.1": "Changes of state", "6.3.2": "Internal energy", "6.5.1": "Forces and interactions",
    "6.5.2": "Work done", "6.6.1": "Properties of waves", "6.7.1": "Magnets and magnetic fields",
}


def paper_for(comp):
    """8464B1H -> Biology Paper 1 Higher."""
    return {"id": comp, "name": f"{SCIENCE[comp[4]]} Paper {comp[5]} {TIER[comp[6]]}", "title": "", "as": False}


def paper_order(comp):
    return ("BCP".index(comp[4]), comp[5], comp[6] != "H")


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    nodes = json.load(open(os.path.join(WORK, "spec.json")))["8464"]
    manifest = [f for f in json.load(open(os.path.join(WORK, "manifest.json"))) if f["series"] in SERIES]
    tags = json.load(open(os.path.join(WORK, "tags.json")))

    whole_ms = {(f["component"], f["series"]): f"aqa/{f['file']}" for f in manifest if f["kind"] == "ms"}
    wholes = {}
    for f in manifest:
        if f["kind"] in ("qp", "ms", "er"):
            wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    mine = [p for p in parts if p["series"] in SERIES and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
    topic_nodes = [n for n in nodes if n["level"] == 2]
    sections = [{"code": n["code"], "title": n["title"]} for n in nodes if n["level"] == 1 and any(t["code"].startswith(n["code"] + ".") for t in topic_nodes)]
    valid = {n["code"] for n in topic_nodes}
    rows, text, reports = [], {}, {}
    for p in mine:
        own = own_text(p["text"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": [c for c in tags.get(p["id"], []) if c in valid],
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
        if not p.get("ms") and not p.get("key") and (p["component"], p["series"]) in whole_ms:
            row["msf"] = whole_ms[(p["component"], p["series"])]
        if p.get("er"):
            row["er"] = 1
            reports.setdefault(p["id"].rsplit("-", 1)[0] if p["part"] else p["id"], p["er"])
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        rows.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
    rows.sort(key=lambda r: (-series_rank(r["s"]), paper_order(r["p"]), [int(x) for x in r["l"].split(".")]))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    topics = []
    for n in topic_nodes:
        short = SHORT.get(n["code"])
        topics.append({"code": n["code"], "title": n["title"], **({"short": short} if short else {}), "section": n["code"].rsplit(".", 1)[0],
                       "slug": slug(short or n["title"]), "count": counts.get(n["code"], 0), "year": 0})
    assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
    comps = sorted({r["p"] for r in rows}, key=paper_order)
    series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
    years = [int("20" + s[3:]) for s in series]
    meta = {
        "slug": SLUG, "board": "AQA", "level": "GCSE", "subject": "Combined Science", "fullName": "Combined Science: Trilogy", "specs": ["8464"],
        "sections": sections, "topics": topics,
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
    print(f"{SLUG}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, {len(comps)} papers, series {series}", file=sys.stderr)
    for t in topics:
        if not t["count"]:
            print("  no questions:", t["code"], t["title"], file=sys.stderr)


if __name__ == "__main__":
    main()
