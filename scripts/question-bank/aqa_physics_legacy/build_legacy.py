"""Add the legacy Physics A (2450) parts to the AQA A-Level Physics bank.

    python3 scripts/question-bank/aqa_physics_legacy/build_legacy.py [work-dir]   # default scripts/question-bank/.work/phya

Reads <work-dir>/parts.json (cut_legacy.py), tags.json and off.json (tag_legacy.py) and
manifest.json (fetch_pmt.py), and merges the parts into the bank build_bank.py wrote:
  src/content/questionBank/aqa-a-level-physics.json   papers, series, wholes, counts
  public/question-bank/aqa-a-level-physics/parts.json and text.json
Earlier legacy rows (ids "phya...") are replaced, so a re-run is safe, and the 7407/7408
rows are left as they are. The legacy papers sit after the current ones, named for the
old spec ("PHYA1 (old spec)"). A part tagged [] (its physics isn't on 7408) is left out.
The past paper library's files.json is not touched: these are PMT's copies, for the bank only.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
QB = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(QB, "..", ".."))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(QB, ".work", "phya")
SLUG = "aqa-a-level-physics"
sys.path.insert(0, QB)
from build_bank import BOILERPLATE, CALC  # noqa: E402

# (id, name, title, AS): in the order the filter lists them, after 7408's and 7407's.
PAPERS = [("PHYA4A", "PHYA4 Section A (old spec)", "Fields and further mechanics: multiple choice", False),
          ("PHYA4B", "PHYA4 Section B (old spec)", "Fields and further mechanics", False),
          ("PHYA5A", "PHYA5 Section A (old spec)", "Nuclear and thermal physics", False),
          ("PHYA5BA", "PHYA5 Astrophysics (old spec)", "Astrophysics", False),
          ("PHYA5BB", "PHYA5 Medical physics (old spec)", "Medical physics", False),
          ("PHYA5BC", "PHYA5 Applied physics (old spec)", "Applied physics", False),
          ("PHYA5BD", "PHYA5 Turning points (old spec)", "Turning points in physics", False),
          ("PHYA1", "PHYA1 (old spec)", "Particles, quantum phenomena and electricity", True),
          ("PHYA2", "PHYA2 (old spec)", "Mechanics, materials and waves", True)]
ORDER = {p[0]: n for n, p in enumerate(PAPERS)}
MONTH = {"JAN": "January", "JUN": "June", "NOV": "November"}
LABEL = re.compile(r"^\d{1,2}(?:\s*\([a-h]\))?(?:\s*\([ivx]{1,4}\))?\s*")
ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]


def rank(s):
    return 0 if s == "SPEC" else int("20" + s[3:]) * 100 + {"JAN": 1, "JUN": 6, "NOV": 11}[s[:3]]


def label_key(label):
    """"7(a)(iii)" -> (7, 1, 3), "3(i)" -> (3, 0, 1)."""
    q, a, r = re.match(r"^(\d+)(?:\(([a-h])\))?(?:\(([ivx]+)\))?$", label).groups()
    return (int(q), ord(a) - 96 if a else 0, ROMAN.index(r) + 1 if r else 0)


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tags = json.load(open(os.path.join(WORK, "tags.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    meta_path = os.path.join(ROOT, "src", "content", "questionBank", f"{SLUG}.json")
    pub = os.path.join(ROOT, "public", "question-bank", SLUG)
    meta = json.load(open(meta_path))
    rows = [r for r in json.load(open(os.path.join(pub, "parts.json"))) if not r["id"].startswith("phya")]
    text = {k: v for k, v in json.load(open(os.path.join(pub, "text.json"))).items() if not k.startswith("phya")}
    whole_ms = {(f["component"], f["series"]): f"aqa/{f['file']}" for f in manifest if f["kind"] == "ms"}

    legacy, off = [], []
    for p in parts:
        t = tags.get(p["id"])
        if t is None:
            sys.exit(f"{p['id']} has no tags: run tag_legacy.py merge first")
        if not t:
            off.append(p["id"])
            continue
        own = LABEL.sub("", p["ownText"]).strip()
        own = BOILERPLATE.sub(" ", re.sub(r"\s*(?:\.{4,}\s*)+", " ", own))
        row = {"id": p["id"], "p": p["component"], "s": p["series"], "l": p["label"], "m": p["marks"], "t": t,
               "w": p["w"], "h": p["h"], "x": re.sub(r"\s+", " ", own).strip()[:160]}
        if p.get("stem"):
            row["st"] = 1
            if p.get("stemKey"):
                row["sk"] = p["stemKey"]
        if p.get("ms"):
            row["ms"] = 1
            if p.get("msq"):
                row["msq"] = 1
        if not p.get("ms") and not p.get("key"):
            row["msf"] = whole_ms[(p["component"], p["series"])]  # no crop: link the whole scheme
        if p.get("key"):
            row["k"] = p["key"]
        if CALC.search(own) or CALC.search(p.get("msText", "")[:300]):
            row["calc"] = 1
        legacy.append(row)
        text[p["id"]] = re.sub(r"\s+", " ", BOILERPLATE.sub(" ", re.sub(r"\.{4,}", " ", p["text"] + " " + p.get("msText", ""))).lower()).strip()
    legacy.sort(key=lambda r: (-rank(r["s"]), ORDER[r["p"]], label_key(r["l"])))
    rows += legacy

    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    for t in meta["topics"]:
        t["count"] = counts.get(t["code"], 0)
    used = {r["p"] for r in legacy}
    meta["specs"] = [s for s in meta["specs"] if s != "2450"] + ["2450"]
    meta["papers"] = [x for x in meta["papers"] if not x["id"].startswith("PHYA")] + \
        [{"id": i, "name": n, "title": t, "as": a} for i, n, t, a in PAPERS if i in used]
    series = sorted({r["s"] for r in rows}, key=rank, reverse=True)
    meta["series"] = [{"id": s, "label": "Specimen" if s == "SPEC" else f"{MONTH[s[:3]]} 20{s[3:]}"} for s in series]
    meta["wholes"] = {k: v for k, v in meta["wholes"].items() if not k.startswith("PHYA")}
    for f in manifest:
        if f["component"] in used and f["kind"] in ("qp", "ms"):
            meta["wholes"].setdefault(f"{f['component']}-{f['series']}", {})[f["kind"]] = f"aqa/{f['file']}"
    years = [int("20" + s[3:]) for s in series if s != "SPEC"]
    meta["count"], meta["firstYear"], meta["lastYear"] = len(rows), min(years), max(years)

    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(rows, open(os.path.join(pub, "parts.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(text, open(os.path.join(pub, "text.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    by_set = {}
    for r in legacy:
        by_set[(r["p"], r["s"])] = by_set.get((r["p"], r["s"]), 0) + 1
    json.dump({"added": {f"{p}-{s}": n for (p, s), n in sorted(by_set.items())}, "off": off},
              open(os.path.join(WORK, "build-summary.json"), "w"), indent=1)
    print(f"{SLUG}: {len(rows)} parts ({len(legacy)} legacy, {len(off)} off the 7408 spec left out), "
          f"{len(meta['papers'])} papers, {len(series)} series, {meta['firstYear']}-{meta['lastYear']}", file=sys.stderr)


if __name__ == "__main__":
    main()
