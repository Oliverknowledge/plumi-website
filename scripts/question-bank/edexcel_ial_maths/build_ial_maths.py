"""Write the Edexcel International A Level Maths and Further Maths banks' data files.

    python3 scripts/question-bank/edexcel_ial_maths/build_ial_maths.py
    # reads scripts/question-bank/.work/edexcel-ial-maths/{parts,tags,manifest}.json and ial_maths_topics.json

build_igcse_maths.py's rows and files, for two banks cut from the same unit papers:
  edexcel-ial-maths           Mathematics (YMA01): P1-P4 and the applied units it counts, M1, M2, S1, S2, D1
  edexcel-ial-further-maths   Further Mathematics (YFM01): FP1-FP3 and the applied units it counts, M1-M3, S1-S3, D1
A unit both count (M1, say) is in both banks, under the same crops. Each unit is a paper; the AS units (P1, P2, M1,
S1, D1) are marked so ("AS Pure 1 (P1)", `as`). Each unit is a topic area, its topics the specification's numbered
ones ("P3.4 Differentiation"). The applied units are options: a student picks the ones they sit ("M1 and S1"), and
the bank keeps those, the pure units and their topics. A series' second paper (01R, 01A: sat in another time zone)
is a series of its own, "JUN25A", "June 2025 (A)". No question goes in without its scheme, cropped or whole.

The whole papers are the past paper library's copies where the bucket has them (manifest `r2`,
library_ial_maths.py); the rest go up under edexcel-ial/ (upload_r2.py <work-dir>/upload --pdf-prefix=edexcel-ial/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.join(HERE, "..", ".work", "edexcel-ial-maths")
MONTH_RANK = {"JAN": 1, "JUN": 6, "OCT": 10}
MONTH = {"JAN": "January", "JUN": "June", "OCT": "October"}
FURNITURE = re.compile(rf"{BOILERPLATE.pattern}|\(Total for Question \d+ (is|=) \d+ marks?\)|\(Total \d+ marks?\)|DO NOT WRITE IN THIS AREA|Leave blank|\.{{4,}}|_{{4,}}|\(\d+\)", re.I)
NOTE = ("Since June 2024 some units have a second paper, sat in another time zone (Pearson's 01R and 01A papers). "
        "Each is listed as a series of its own, such as June 2025 (A).")
BANKS = [
    {"slug": "edexcel-ial-maths", "subject": "Maths", "fullName": "Mathematics (YMA01)", "spec": "YMA01",
     "units": ["P1", "P2", "P3", "P4", "M1", "M2", "S1", "S2", "D1"],
     # The applied units International A Level Mathematics allows (specification, Qualification overview), then
     # International AS's one applied unit.
     "options": [("M1S1", "M1 and S1", ["M1", "S1"]), ("M1D1", "M1 and D1", ["M1", "D1"]), ("M1M2", "M1 and M2", ["M1", "M2"]),
                 ("S1D1", "S1 and D1", ["S1", "D1"]), ("S1S2", "S1 and S2", ["S1", "S2"]),
                 ("M1", "M1 only (AS)", None), ("S1", "S1 only (AS)", None), ("D1", "D1 only (AS)", None)]},
    {"slug": "edexcel-ial-further-maths", "subject": "Further Maths", "fullName": "Further Mathematics (YFM01)", "spec": "YFM01",
     "units": ["FP1", "FP2", "FP3", "M1", "M2", "M3", "S1", "S2", "S3", "D1"],
     # Further Mathematics takes FP1, FP2 or FP3, and any of the applied units: picked by strand, as students choose them.
     "options": [("M", "Mechanics (M1 to M3)", ["M1", "M2", "M3"]), ("S", "Statistics (S1 to S3)", ["S1", "S2", "S3"]),
                 ("D", "Decision (D1)", ["D1"]), ("MS", "Mechanics and Statistics", ["M1", "M2", "M3", "S1", "S2", "S3"]),
                 ("MD", "Mechanics and Decision", ["M1", "M2", "M3", "D1"]), ("SD", "Statistics and Decision", ["S1", "S2", "S3", "D1"]),
                 ("FP", "Further Pure only", [])]},
]
SHORT = {"Pure Mathematics": "Pure", "Further Pure Mathematics": "Further Pure", "Decision Mathematics": "Decision"}


def applied(unit):
    return unit[0] in "MSD"


def series_rank(s):
    return int("20" + s[3:5]) * 100 + MONTH_RANK[s[:3]] + (-0.5 if len(s) > 5 else 0)  # the main paper first, then its second ("JUN25", "JUN25A")


def label(s):
    return f"{MONTH[s[:3]]} 20{s[3:5]}" + (f" ({s[5:]})" if len(s) > 5 else "")


def own_text(p):
    """The question's words, after its number."""
    return re.sub(r"\s+", " ", FURNITURE.sub(" ", re.sub(rf"^.*?\b{int(p['question'])}\.\s*", "", p["text"], count=1))).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    spec = json.load(open(os.path.join(HERE, "ial_maths_topics.json")))["units"]
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    unit_of = {u["code"]: u for u in spec}  # "WMA11" -> P1
    by_unit = {u["unit"]: u for u in spec}

    wholes = {}
    for f in manifest:
        wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f.get("r2") or f"edexcel-ial/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    assert all(n == 1 for n in seen.values()), [k for k, n in seen.items() if n > 1]

    for bank in BANKS:
        units = [by_unit[u] for u in bank["units"]]
        codes = {u["code"] for u in units}
        valid = {t["code"] for u in units for t in u["topics"]}
        rows, text, reports, dropped = [], {}, {}, []
        for p in parts:
            if p["component"] not in codes or not p.get("qp") or not p["h"]:
                continue
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": str(int(p["question"])), "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": own_text(p)[:160]}
            if p.get("ms"):
                row["ms"] = 1
            elif wholes.get(f"{p['component']}-{p['series']}", {}).get("ms"):
                row["msf"] = wholes[f"{p['component']}-{p['series']}"]["ms"]  # no crop: link the whole scheme
            else:
                dropped.append(p["id"])  # no scheme at all: left out, as every bank leaves such questions out
                continue
            if p.get("er"):
                row["er"] = 1
                reports[p["id"]] = p["er"]
            rows.append(row)
            text[p["id"]] = re.sub(r"\s+", " ", FURNITURE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
        order = [u["code"] for u in units]
        rows.sort(key=lambda r: (-series_rank(r["s"]), order.index(r["p"]), int(r["l"])))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        sections = [{"code": u["unit"], "title": f"{u['name']} ({u['unit']}{', AS' if u['as'] else ''})",
                     **({"option": u["unit"]} if applied(u["unit"]) else {})} for u in units]
        topics = [{"code": t["code"], "title": t["title"], "section": u["unit"], "slug": slug(f"{u['unit']} {t['title']}"),
                   "count": counts.get(t["code"], 0), "year": 0} for u in units for t in u["topics"]]
        assert len({t["slug"] for t in topics}) == len(topics), "two topics share an address"
        comps = [c for c in order if any(r["p"] == c for r in rows)]
        papers = []
        for c in comps:
            u = unit_of[c]
            name = re.sub(r"^(\w+(?: \w+)?) Mathematics", lambda m: SHORT.get(m.group(0), m.group(1)), u["name"])
            papers.append({"id": c, "name": f"{'AS ' if u['as'] else ''}{name} ({u['unit']})", "title": f"{c}/01", "as": u["as"],
                           **({"option": u["unit"]} if applied(u["unit"]) else {})})
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:5]) for s in series]
        meta = {
            "slug": bank["slug"], "board": "Edexcel", "level": "IAL", "subject": bank["subject"], "fullName": bank["fullName"],
            "specs": [bank["spec"], *comps],
            "sections": sections, "topics": topics, "papers": papers,
            "series": [{"id": s, "label": label(s)} for s in series],
            "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
            "options": {"label": "Applied units", "list": [{"id": i, "name": n, **({"takes": t} if t is not None else {})} for i, n, t in bank["options"]]},
            "noCalc": True, "reportsBy": "question", "note": NOTE,
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{bank['slug']}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", bank["slug"])
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{bank['slug']}: {len(rows)} questions from {len({(r['p'], r['s']) for r in rows})} papers, {sum(1 for r in rows if r['t'])} tagged, "
              f"{len(reports)} reports, {sum(1 for r in rows if r.get('ms'))} scheme crops, {sum(1 for r in rows if r.get('msf'))} whole schemes, "
              f"{len(series)} series, {len(dropped)} left out without a scheme {dropped[:5]}", file=sys.stderr)


if __name__ == "__main__":
    main()
