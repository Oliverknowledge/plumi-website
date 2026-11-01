"""Write OCR's GCSE Gateway science banks' data files from the cut parts and their topic tags.

    python3 scripts/question-bank/ocr_gcse/build_ocr_gcse.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse

ocr/build_ocr.py for the GCSE specifications, in edexcel_gcse/build_gcse.py's shapes: one bank each for
Biology A (J247), Chemistry A (J248), Physics A (J249) and Combined Science A (J250), written to
src/content/questionBank/ocr-gcse-<subject>.json and public/question-bank/ocr-gcse-<subject>/
{parts,text,reports}.json. Papers keep OCR's numbers and say their tier ("Paper 3 Higher"; in Combined
Science A, "Chemistry Paper 9 Higher"), so the paper filter is the tier filter, and a Foundation paper's
id is its Higher partner's with the last letter changed (j2471f, j2471h), as tiers.py reads them.
Whole papers link to the past paper library's copies on R2 (manifest `r2`; J250's uploaded by
upload_r2.py --pdf-prefix=ocr/ under the same names).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.join(HERE, "..", "ocr"))
from build_pearson import BOILERPLATE, CALC, label_order, own_text, slug  # noqa: E402
from build_ocr import OCR_BOILER, ocr_report, series_label, series_rank  # noqa: E402

# slug, subject, specification, the specification's longer name.
SUBJECTS = [("ocr-gcse-biology-a", "Biology A", "J247", "Biology A (Gateway Science)"),
            ("ocr-gcse-chemistry-a", "Chemistry A", "J248", "Chemistry A (Gateway Science)"),
            ("ocr-gcse-physics-a", "Physics A", "J249", "Physics A (Gateway Science)"),
            ("ocr-gcse-combined-science-a", "Combined Science A", "J250", "Combined Science A (Gateway Science)")]
TIER = {"f": "Foundation", "h": "Higher"}
SCIENCE = {"b": "Biology", "c": "Chemistry", "p": "Physics"}
CROP_VERSION = None  # set when the banks are cut again under the same names (questionBank.ts partImage)


def number(comp):
    """OCR's own paper number: j2471h -> 3 (J247/03), j250c1h -> 9 (J250/09)."""
    if comp.startswith("j250"):
        return "bcp".index(comp[4]) * 2 + int(comp[5]) + (6 if comp[6] == "h" else 0)
    return int(comp[4]) + (2 if comp[5] == "h" else 0)


def paper_name(comp):
    """j2471h -> "Paper 3 Higher"; j250c1h -> "Chemistry Paper 9 Higher"."""
    name = f"Paper {number(comp)} {TIER[comp[-1]]}"
    return f"{SCIENCE[comp[4]]} {name}" if comp.startswith("j250") else name


def paper_order(comp):
    return number(comp)  # OCR's order: the Foundation papers, then the Higher


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}
    wholes, whole_ms = {}, {}
    for f in manifest:
        wholes.setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f["r2"]
        if f["kind"] == "ms":
            whole_ms[(f["component"], f["series"])] = f["r2"]
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    for subj_slug, name, code, long_name in SUBJECTS:
        # A label read twice on one page gives two parts one id (and one image): leave both out.
        mine = [p for p in parts if p["spec"] == code and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        tree = spec[code]
        valid = {t["code"] for t in tree["topics"]}
        rows, text, reports = [], {}, {}
        for p in mine:
            own = own_text(OCR_BOILER.sub(" ", p["text"]), p["label"])
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
            if p.get("stem"):
                row["st"] = 1
            if p.get("ms"):
                row["ms"] = 1
            elif (p["component"], p["series"]) in whole_ms:
                row["msf"] = whole_ms[(p["component"], p["series"])]  # no crop: link the whole scheme
            if p.get("key"):
                row["k"] = p["key"]
            if p.get("er"):
                row["er"] = 1
                reports.setdefault(f"{p['set']}-{p['question']}", ocr_report(p["er"]))
            if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
                row["calc"] = 1
            rows.append(row)
            text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", OCR_BOILER.sub(" ", p["text"] + " " + p.get("msText", ""))).lower())
        rows.sort(key=lambda r: (-series_rank(r["s"]), paper_order(r["p"]), label_order(r["l"])))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        used, topics = set(), []
        for t in tree["topics"]:
            s = slug(t["title"])
            if s in used:  # Combined Science A's "The particle model" is C1.1 and P1.1
                s = slug(t["code"] + " " + t["title"])
            used.add(s)
            topics.append({"code": t["code"], "title": t["title"], "section": t["section"], "slug": s, "count": counts.get(t["code"], 0), "year": 0})
        comps = sorted({r["p"] for r in rows}, key=paper_order)
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:]) for s in series]
        meta = {
            "slug": subj_slug, "board": "OCR", "level": "GCSE", "subject": name, "fullName": long_name, "specs": [code],
            **({"cropVersion": CROP_VERSION} if CROP_VERSION else {}),
            "sections": tree["sections"], "topics": topics,
            "papers": [{"id": c, "name": paper_name(c), "title": "", "as": False} for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps},
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(out_dir, f"{subj_slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", subj_slug)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{subj_slug}: {len(rows)} parts, {sum(1 for r in rows if r['t'])} tagged, {len(reports)} reports, {len(comps)} papers, "
              f"{len(series)} series, {sum(1 for r in rows if not r.get('ms'))} without a scheme crop", file=sys.stderr)


if __name__ == "__main__":
    main()
