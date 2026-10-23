"""Write the GCSE question bank's data files from the cut parts and their topic tags.

    python3 scripts/question-bank/aqa_gcse/build_gcse.py [work-dir]   # default scripts/question-bank/.work-gcse

build_bank.py for AQA GCSE Biology, Chemistry and Physics: the same rows, the same
files (src/content/questionBank/aqa-gcse-<subject>.json and
public/question-bank/aqa-gcse-<subject>/{parts,text,reports}.json). What differs:
papers come in two tiers ("Paper 1 Higher"), topics aren't split by year, and a
long topic title gets a short name (SHORT) for its page title and address, so the
<title> stays under 60 characters. The whole spec title is still shown on the page.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import BOILERPLATE, CALC, own_text, series_label, series_rank, slug  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work-gcse")

SUBJECTS = [("aqa-gcse-biology", "Biology", "8461"), ("aqa-gcse-chemistry", "Chemistry", "8462"), ("aqa-gcse-physics", "Physics", "8463")]
SERIES = {"JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25", "SPEC"}
TIER = {"H": "Higher", "F": "Foundation"}
# Short names, for "<short>: AQA GCSE Chemistry Exam Questions" and the topic's address.
SHORT = {
    "8461": {
        "4.2.2": "Animal tissues and organs", "4.2.3": "Plant tissues and organs", "4.5.3": "Hormonal coordination",
        "4.6.3": "Understanding evolution", "4.6.4": "Classification", "4.7.1": "Adaptations and competition",
        "4.7.2": "Organising an ecosystem", "4.7.3": "Biodiversity and humans", "4.7.4": "Trophic levels",
    },
    "8462": {
        "4.1.1": "Atomic structure", "4.1.3": "Transition metals", "4.2.1": "Chemical bonding", "4.2.2": "Structure and properties",
        "4.2.3": "Structures of carbon", "4.2.4": "Nanoparticles", "4.3.1": "Conservation of mass", "4.3.2": "Moles and masses",
        "4.3.3": "Yield and atom economy", "4.3.4": "Concentrations in mol/dm3", "4.3.5": "Moles and gas volumes",
        "4.5.1": "Exothermic and endothermic", "4.6.2": "Reversible reactions", "4.7.1": "Crude oil and hydrocarbons",
        "4.7.2": "Alkenes and alcohols", "4.7.3": "Polymers", "4.8.1": "Purity and chromatography", "4.8.2": "Testing for gases",
        "4.8.3": "Identifying ions", "4.9.1": "The Earth's atmosphere", "4.9.2": "Greenhouse gases", "4.9.3": "Atmospheric pollutants",
        "4.10.1": "Earth's resources and water", "4.10.2": "Life cycle assessment", "4.10.4": "Haber process and fertilisers",
    },
    "8463": {
        "4.1.1": "Energy stores and transfers", "4.1.2": "Conservation of energy", "4.1.3": "Energy resources",
        "4.2.1": "Current, p.d. and resistance", "4.2.3": "Mains electricity", "4.2.4": "Electrical power and energy",
        "4.3.1": "Changes of state", "4.3.2": "Internal energy", "4.4.3": "Uses and hazards of radiation",
        "4.5.5": "Pressure in fluids", "4.7.1": "Magnets and magnetic fields", "4.7.3": "Induction and transformers",
        "4.8.1": "Solar system and orbits",
    },
}


def paper_for(comp):
    """84611H -> Paper 1 Higher."""
    return {"id": comp, "name": f"Paper {comp[4]} {TIER[comp[5]]}", "title": "", "as": False}


def paper_order(comp):
    return (comp[4], comp[5] != "H")  # Paper 1 Higher, Paper 1 Foundation, Paper 2 Higher...


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
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
    for subj_slug, name, code in SUBJECTS:
        # A label read twice on one page gives two parts one id (and one image): leave both out.
        mine = [p for p in parts if p["spec"] == code and p["series"] in SERIES and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        nodes = spec[code]
        topic_nodes = [n for n in nodes if n["level"] == 2]
        # "Key ideas" closes each specification: a section with no topics, never tagged.
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
                row["msf"] = whole_ms[(p["component"], p["series"])]  # no crop: link the whole scheme
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
            short = SHORT[code].get(n["code"])
            topics.append({"code": n["code"], "title": n["title"], **({"short": short} if short else {}), "section": n["code"].rsplit(".", 1)[0],
                           "slug": slug(short or n["title"]), "count": counts.get(n["code"], 0), "year": 0})
        assert len({t["slug"] for t in topics}) == len(topics), f"{subj_slug}: two topics share an address"
        comps = sorted({r["p"] for r in rows}, key=paper_order)
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series if s != "SPEC"]
        meta = {
            "slug": subj_slug, "board": "AQA", "level": "GCSE", "subject": name, "specs": [code],
            "sections": sections, "topics": topics,
            "papers": [paper_for(c) for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            "wholes": {k: v for k, v in wholes.items() if k.split("-")[0] in comps},
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(ROOT, "src", "content", "questionBank", f"{subj_slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", subj_slug)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        tagged = sum(1 for r in rows if r["t"])
        print(f"{subj_slug}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, papers {comps}", file=sys.stderr)


if __name__ == "__main__":
    main()
