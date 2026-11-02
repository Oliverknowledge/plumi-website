"""Write the Edexcel International A Level science banks' data files from the cut parts and their topic tags.

    python3 scripts/question-bank/edexcel_ial/build_ial.py [work-dir]   # default scripts/question-bank/.work/edexcel-ial

edexcel_igcse/build_igcse.py for the International A Level units, writing the same shapes to
src/content/questionBank/edexcel-ial-<subject>.json and public/question-bank/edexcel-ial-<subject>/
{parts,text,reports}.json. What differs: the papers are the six units, Units 1 to 3 the International
AS (`as`, "AS Unit 1", as the A-Level banks mark their AS papers) and Units 3 and 6 the practical
skills papers; the series are January, June and October; and a sitting with a second paper sat in
other time zones has it as its own series ("JUN24R", "June 2024 (R)"; "JUN25A", "June 2025 (A)").
A part whose sitting has no public mark scheme (Pearson never published a few) is left out.
A multiple-choice part (its own words set out options A to D) keeps its answer letter as `k`: where
cut_pearson.py's reader ("The only correct answer is C") misses it, it is read off the part's scheme
row, which Biology and Physics word many ways ("1(a)(i) B A is incorrect because…", "Computer C …",
"Choose an item. (1) C is the correct answer", "• D is the correct answer"); a letter on any other
part ("1 A description that includes…") is no answer and is dropped. A letter no scheme row gives can
be set by hand in labels/<set>.json's "keys", by the part's label ("1(a)": "D"); cut_pearson.py
reads a whole question's ("1": "D") itself. A part whose scheme row Pearson lays out across a table
rule (an equation or diagram drawn over the border, a merged "clip with" row) is listed in that
file's "wholeScheme" and links the whole scheme rather than a crop cut through its row. Whole
papers are linked from edexcel-ial/ on R2 (upload_r2.py --pdf-prefix=edexcel-ial/).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-ial")
sys.argv[1:] = [WORK]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from build_pearson import BOILERPLATE, CALC, clean_report, label_order, own_text, slug  # noqa: E402

SUBJECTS = [("edexcel-ial-biology", "Biology", "WBI"), ("edexcel-ial-chemistry", "Chemistry", "WCH"), ("edexcel-ial-physics", "Physics", "WPH")]
UNITS = {
    "WBI": ["Molecules, Diet, Transport and Health", "Cells, Development, Biodiversity and Conservation", "Practical Skills in Biology I",
            "Energy, Environment, Microbiology and Immunity", "Respiration, Internal Environment, Coordination and Gene Technology",
            "Practical Skills in Biology II"],
    "WCH": ["Structure, Bonding and Introduction to Organic Chemistry", "Energetics, Group Chemistry, Halogenoalkanes and Alcohols",
            "Practical Skills in Chemistry I", "Rates, Equilibria and Further Organic Chemistry", "Transition Metals and Organic Nitrogen Chemistry",
            "Practical Skills in Chemistry II"],
    "WPH": ["Mechanics and Materials", "Waves and Electricity", "Practical Skills in Physics I", "Further Mechanics, Fields and Particles",
            "Thermodynamics, Radiation, Oscillations and Cosmology", "Practical Skills in Physics II"],
}
MONTH = {"JAN": "January", "JUN": "June", "OCT": "October"}
NOTE = ("A sitting marked (R) or (A) is a second paper Pearson set for it, sat in other time zones. Pearson keeps its newest papers "
        "(October 2025 on) for schools, and hasn’t published October 2019’s papers.")


MCQ = re.compile(r"(?:^|\s)A\s.+\sB\s.+\sC\s.+\sD(?:\s|$)", re.S)
# What can stand between a scheme row's label and its letter.
LEAD = re.compile(r"\s*(?:Computer|Choose an item[.:]?|\.|\(1\)|[•\uf0b7]|An answer that includes the following points?:?|"
                  r"(?:The only )?correct answer(?: is)?:?|Answer:?)\s*", re.I)


def hand(p):
    path = os.path.join(HERE, "..", "labels", f"{p['set']}.json")
    return json.load(open(path)) if os.path.exists(path) else {}


def hand_key(p):
    return hand(p).get("keys", {}).get(p["label"])


def scheme_key(p):
    """A multiple-choice part's letter, read off its scheme row: after its label ("1(a)(i)", "1 (a)(i)", "1ai"),
    past any lead-in words, or from "B is the correct answer" where the row sets its words before its label."""
    ms = p.get("msText", "")
    subs = re.findall(r"\(([a-z]+)\)", p["label"])
    pat = rf"(?<![\d(])\*?{int(p['question'])}\*?\s*" + "".join(rf"\(?\s*{x}\s*\)?\s*" for x in subs)
    m = re.search(pat, ms)
    if m:
        rest = ms[m.end():m.end() + 160]
        while (n := LEAD.match(rest)) and n.group(0):
            rest = rest[n.end():]
        k = re.match(r"([A-D])(?=[\s.,;:)]|$)", rest.lstrip())
        if k:
            return k.group(1)
    k = re.search(r"\b([A-D]) is (?:the )?(?:only )?correct\b|only correct answer is\s*\(?([A-D])\b", ms[:400])
    return (k.group(1) or k.group(2)) if k else None


def series_label(s):
    return f"{MONTH[s[:3]]} 20{s[3:5]}" + (f" ({s[5:]})" if s[5:] else "")


def series_rank(s):
    return int("20" + s[3:5]) * 100 + {"JAN": 1, "JUN": 6, "OCT": 10}[s[:3]] - (0.5 if s[5:] else 0)


def paper_for(comp, code):
    """wch1101 (WCH11/01) -> AS Unit 1, wch1401 -> Unit 4."""
    unit = int(comp[4])
    return {"id": comp, "name": f"{'AS ' if unit <= 3 else ''}Unit {unit}", "title": UNITS[code][unit - 1], "as": unit <= 3}


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    tags_path = os.path.join(WORK, "tags.json")
    tags = json.load(open(tags_path)) if os.path.exists(tags_path) else {}

    wholes, whole_ms = {}, {}
    for f in manifest:
        comp = f["component"].replace("-", "")
        wholes.setdefault(f"{comp}-{f['series']}", {})[f["kind"]] = f"edexcel-ial/{f['file']}"
        if f["kind"] == "ms":
            whole_ms[(comp, f["series"])] = f"edexcel-ial/{f['file']}"
    seen = {}
    for p in parts:
        seen[p["id"]] = seen.get(p["id"], 0) + 1
    out_dir = os.path.join(ROOT, "src", "content", "questionBank")
    for subj_slug, name, code in SUBJECTS:
        # A label read twice on one page gives two parts one id (and one image): leave both out.
        mine = [p for p in parts if p["component"][:3].upper() == code and p.get("qp") and p["h"] > 0 and seen[p["id"]] == 1]
        tree = spec[code]
        valid = {n["code"] for n in tree["topics"]}
        rows, text, reports, unschemed, keyless = [], {}, {}, 0, []
        for p in mine:
            own = own_text(p["text"], p["label"])
            row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"],
                   "t": [c for c in tags.get(p["id"], []) if c in valid], "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
            if p.get("stem"):
                row["st"] = 1
            if p.get("ms") and p["label"] not in hand(p).get("wholeScheme", []):
                row["ms"] = 1
            elif (p["component"], p["series"]) in whole_ms:
                row["msf"] = whole_ms[(p["component"], p["series"])]  # no crop: link the whole scheme
            if MCQ.search(own) and p["marks"] == 1:
                key = p.get("key") or hand_key(p) or scheme_key(p)
                if key:
                    row["k"] = key
                else:
                    keyless.append(p["id"])  # (counted below only if the part stays in)
            if not (row.get("ms") or row.get("msf") or row.get("k")):
                unschemed += 1
                continue  # no mark scheme published for its sitting
            if p.get("er"):
                row["er"] = 1
                reports.setdefault(f"{p['set']}-{p['question']}", clean_report(p["er"]))
            if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
                row["calc"] = 1
            rows.append(row)
            text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
        rows.sort(key=lambda r: (-series_rank(r["s"]), r["p"], label_order(r["l"])))
        counts = {}
        for r in rows:
            for c in r["t"]:
                counts[c] = counts.get(c, 0) + 1
        topics = [{"code": n["code"], "ref": n["ref"], "points": n["points"], "title": n["title"], "section": n["section"], "slug": slug(n["title"]),
                   "count": counts.get(n["code"], 0), "year": n["year"]} for n in tree["topics"]]
        for t in topics:
            if not t["points"]:
                del t["points"]
        assert len({t["slug"] for t in topics}) == len(topics), f"{subj_slug}: two topics share an address"
        comps = sorted({r["p"] for r in rows})
        series = sorted({r["s"] for r in rows}, key=series_rank, reverse=True)
        years = [int("20" + s[3:5]) for s in series]
        meta = {
            "slug": subj_slug, "board": "Edexcel", "level": "IAL", "subject": name, "specs": [f"{code}1{u}" for u in range(1, 7)],
            "sections": [{"code": s["code"], "title": s["title"]} for s in tree["sections"]], "topics": topics,
            "papers": [paper_for(c, code) for c in comps],
            "series": [{"id": s, "label": series_label(s)} for s in series],
            "wholes": {k: v for k, v in sorted(wholes.items()) if k.split("-")[0] in comps and k.split("-")[1] in series},
            "note": NOTE,
            "count": len(rows), "firstYear": min(years), "lastYear": max(years),
            "sample": rows[:20],
        }
        json.dump(meta, open(os.path.join(out_dir, f"{subj_slug}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        pub = os.path.join(ROOT, "public", "question-bank", subj_slug)
        os.makedirs(pub, exist_ok=True)
        for fname, data in (("parts", rows), ("text", text), ("reports", reports)):
            json.dump(data, open(os.path.join(pub, f"{fname}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
        tagged = sum(1 for r in rows if r["t"])
        print(f"{subj_slug}: {len(rows)} parts, {tagged} tagged, {len(reports)} reports, {len(series)} series, "
              f"{sum(1 for r in rows if not r.get('ms'))} without a scheme crop, {unschemed} left out with no scheme, "
              f"{sum(1 for r in rows if r.get('k'))} multiple choice with a letter, {len(set(keyless) & set(text))} without: {sorted(set(keyless) & set(text))[:12]}", file=sys.stderr)


if __name__ == "__main__":
    main()
