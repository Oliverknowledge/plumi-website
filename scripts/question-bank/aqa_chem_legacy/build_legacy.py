"""Add the legacy Chemistry units (CHEM1, 2, 4, 5; 2010-2016) to the AQA A-Level Chemistry bank.

    python3 scripts/question-bank/aqa_chem_legacy/build_legacy.py [work-dir]
    python3 scripts/question-bank/aqa_chem_legacy/build_legacy.py <new-work-dir> --append

build_bank.py writes the bank from the current specification's work folder; this adds the old
units' parts to what it wrote, so neither has to be re-run for the other. Re-running replaces
the legacy rows (any paper id starting "CHEM") and leaves every 7405/7404 row as it is.
--append instead preserves all earlier rows, search text and whole-paper links, and
rejects changes to an existing part rather than silently re-cutting published crops.

Reads <work-dir>/parts.json (cut_legacy.py), tags.json and off.json (tag_legacy.py) and
manifest.json (fetch_pmt.py). A part tagged "off" (its content isn't on 7405) or with no topic
is left out; one with no scheme crop links the whole scheme (`msf`). Updates
src/content/questionBank/aqa-a-level-chemistry.json (papers, series, wholes, topic counts,
count, firstYear, note) and public/question-bank/aqa-a-level-chemistry/{parts,text}.json, and
prints what it added and left out per unit and series (the PR's table). The PMT copies are linked
as whole papers in the bank only: files.json, the past paper library's list, is not touched.
"""
import collections, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work-chem-legacy")
APPEND = "--append" in sys.argv
SLUG = "aqa-a-level-chemistry"
UNITS = {"CHEM1": ("Foundation Chemistry", True), "CHEM2": ("Chemistry in Action", True),
         "CHEM4": ("Kinetics, Equilibria and Organic Chemistry", False), "CHEM5": ("Energetics, Redox and Inorganic Chemistry", False)}
MONTH = {"JAN": "January", "JUN": "June", "NOV": "November"}
CALC = re.compile(r"\bcalculate\b|\bshow your working\b|\bgive your answer to \d|\bsignificant figures\b|\bdetermine the value\b", re.I)
BOILERPLATE = re.compile(r"Question \d+ continues on the next page|Turn over ►?|Do not write outside the box|Areas outside the box will not be scanned for marking|"
                         r"\(?Extra space\)?|END\s+OF\s+QUESTIONS|\.{4,}|_{4,}", re.I)
NOTE = ("Questions from 2010 to 2016 come from AQA's old specification (units CHEM1, CHEM2, CHEM4 and CHEM5), "
        "sorted into today's topics; the few on content no longer taught, such as extracting metals, are left out.")


def rank(s):
    return 0 if s == "SPEC" else int("20" + s[3:]) * 100 + {"JAN": 1, "JUN": 6, "NOV": 11}[s[:3]]


def label_key(l):
    q, *rest = re.findall(r"\d+|[a-z]+", l)
    return [int(q)] + rest


def own_words(text, label):
    """The part's words after its printed label ("2 (b) (ii)")."""
    q, *rest = re.findall(r"\d+|[a-z]+", label)
    pat = r"\b" + q + r"".join(r"\s*\(\s*" + t + r"\s*\)" for t in rest)
    m = None
    for m in re.finditer(pat + r"\s+", text):
        pass  # the last one: the part's own label, after any stem and part opening it repeats
    return BOILERPLATE.sub(" ", text[m.end():] if m else text).strip()


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json")))
    off = json.load(open(os.path.join(WORK, "off.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    meta_path = os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    meta = json.load(open(meta_path))
    rows = [r for r in json.load(open(os.path.join(pub, "parts.json"))) if APPEND or not r["p"].startswith("CHEM")]
    text = {k: v for k, v in json.load(open(os.path.join(pub, "text.json"))).items() if APPEND or not k.startswith("chem")}
    existing = {r["id"]: r for r in rows}
    missing = [p["id"] for p in parts if p["id"] not in tags and p["id"] not in off]
    if missing:
        sys.exit(f"{len(missing)} parts have no tagging decision: {missing[:10]}")
    valid = {t["code"] for t in meta["topics"]}

    whole_ms = {(f["component"], f["series"]): f"aqa/{f['file']}" for f in manifest if f["kind"] == "ms"}
    seen = collections.Counter(p["id"] for p in parts)
    report = collections.defaultdict(lambda: collections.Counter())
    new = []
    for p in parts:
        r = report[(p["component"], p["series"])]
        r["cut"] += 1
        if seen[p["id"]] > 1 or not p.get("qp") or not p["h"]:
            r["unreadable"] += 1
            continue
        if p["id"] in off:
            r["off"] += 1
            continue
        t = [c for c in tags.get(p["id"], []) if c in valid]
        if not t:
            r["untagged"] += 1
            continue
        own = own_words(p["own"], p["label"])
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": t,
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own)[:160]}
        if p.get("stem"):
            row["st"] = 1
        if p.get("ms"):
            row["ms"] = 1
            if p.get("msq"):
                row["msq"] = 1
        else:
            row["msf"] = whole_ms[(p["component"], p["series"])]
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        search = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", p["text"] + " " + p.get("msText", "")).lower())
        if p["id"] in existing:
            owned = set(row) | {"st", "ms", "msq", "msf", "calc"}
            if any(row.get(k) != existing[p["id"]].get(k) for k in owned) or search != text.get(p["id"]):
                sys.exit(f"{p['id']}: --append cannot change an existing part; use the re-cut workflow")
            continue
        new.append(row)
        r["added"] += 1
        r["marks"] += p["marks"] or 0
        r["msf"] += "msf" in row
        text[p["id"]] = search
    new.sort(key=lambda r: (-rank(r["s"]), UNITS[r["p"]][1], r["p"], label_key(r["l"])))
    rows += new

    counts = collections.Counter(c for r in rows for c in r["t"])
    for t in meta["topics"]:
        t["count"] = counts.get(t["code"], 0)
    meta["papers"] = [p for p in meta["papers"] if not p["id"].startswith("CHEM")] + [
        {"id": u, "name": f"{u} (old spec)", "title": title, "as": as_level} for u, (title, as_level) in UNITS.items()]
    series = sorted({r["s"] for r in rows}, key=rank, reverse=True)
    meta["series"] = [{"id": s, "label": "Specimen" if s == "SPEC" else f"{MONTH[s[:3]]} 20{s[3:]}"} for s in series]
    meta["wholes"] = {k: v for k, v in meta["wholes"].items() if APPEND or not k.startswith("CHEM")}
    for f in sorted(manifest, key=lambda f: (f["component"], -rank(f["series"]))):
        meta["wholes"].setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    years = [int("20" + s[3:]) for s in series if s != "SPEC"]
    meta["count"], meta["firstYear"], meta["lastYear"] = len(rows), min(years), max(years)
    legacy_years = [int("20" + r["s"][3:]) for r in rows if r["p"].startswith("CHEM")]
    meta["note"] = NOTE.replace("2010 to 2016", f"{min(legacy_years)} to {max(legacy_years)}") if legacy_years else NOTE
    # Keep the key order build_bank.py writes: "note" before the counts.
    order = ["slug", "board", "level", "subject", "specs", "cropVersion", "sections", "topics", "papers", "series", "wholes", "note", "count", "firstYear", "lastYear", "sample"]
    meta = {k: meta[k] for k in order if k in meta} | {k: v for k, v in meta.items() if k not in order}
    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(rows, open(os.path.join(pub, "parts.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(text, open(os.path.join(pub, "text.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    print("| Unit | Series | Parts cut | Added | Marks added | Whole-scheme link | Left out: off spec | Left out: other |")
    print("|---|---|---|---|---|---|---|---|")
    total = collections.Counter()
    for (u, s), r in sorted(report.items(), key=lambda kv: (kv[0][0], rank(kv[0][1]))):
        print(f"| {u} | {MONTH[s[:3]]} 20{s[3:]} | {r['cut']} | {r['added']} | {r['marks']} | {r['msf']} | {r['off']} | {r['untagged'] + r['unreadable']} |")
        total.update(r)
    print(f"| **All** | | {total['cut']} | {total['added']} | {total['marks']} | {total['msf']} | {total['off']} | {total['untagged'] + total['unreadable']} |")
    print(f"\n{SLUG}: {len(rows)} parts ({len(new)} legacy), firstYear {meta['firstYear']}", file=sys.stderr)


if __name__ == "__main__":
    main()
