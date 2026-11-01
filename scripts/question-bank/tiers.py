"""Find the GCSE questions printed on both tiers, for the bank's "On both tiers: show once" switch.

    python3 scripts/question-bank/tiers.py [<bank slug> ...]   # default: every bank with Higher and Foundation papers

A GCSE sitting's Foundation and Higher papers share some questions: AQA prints the Foundation paper's
last few as the Higher paper's first few, and Pearson shares one or two. A student working through both
tiers met them twice and asked for a way to see each once (29 October 2026). For each sitting, each
Foundation part is matched to the Higher part with the same wording (the part's own words and the
start of its scheme, numbers and labels left out, as the two papers number them differently) and the
same marks, one to one, in order.

Writes public/question-bank/<slug>/tiers.json, {Foundation part id: Higher part id}, beside the bank's
data so a rebuild leaves it alone; run it again after a new series.
"""
import difflib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(ROOT, "public", "question-bank")
MIN = 0.86  # a shared question's wording matches almost word for word; neighbours on one topic score ~0.5


def words(text):
    """The part's words without numbers or labels ("0 1 . 6", "(b)(ii)", "(1)"): the tiers number them differently."""
    t = re.sub(r"\([a-z]{1,4}\)|\b\d+\b|[^a-z ]", " ", text.lower())
    return [w for w in t.split() if len(w) > 1][:120]


def tiered(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    ids = [p["id"] for p in meta["papers"]]
    return meta.get("level") in ("GCSE", "IGCSE") and any(i.upper().endswith("H") for i in ids) and any(i.upper().endswith("F") for i in ids)


def pairs(slug):
    rows = json.load(open(os.path.join(PUB, slug, "parts.json")))
    text = json.load(open(os.path.join(PUB, slug, "text.json")))
    by = {}
    for r in rows:
        tier = r["p"][-1].upper()
        if tier in "HF":
            by.setdefault((r["p"][:-1].upper(), r["s"], tier), []).append(r)
    out = {}
    for (paper, series, tier), fparts in by.items():
        if tier != "F":
            continue
        hparts = by.get((paper, series, "H"), [])
        hwords = {h["id"]: words(text.get(h["id"], h.get("x", ""))) for h in hparts}
        used = set()
        for f in fparts:
            fw = words(text.get(f["id"], f.get("x", "")))
            if len(fw) < 6:
                continue  # too few words to tell one question from another
            best, score = None, 0.0
            for h in hparts:
                if h["id"] in used or (f.get("m") is not None and h.get("m") is not None and f["m"] != h["m"]):
                    continue
                sm = difflib.SequenceMatcher(None, fw, hwords[h["id"]], autojunk=False)
                if sm.real_quick_ratio() < MIN or sm.quick_ratio() < MIN:
                    continue
                r = sm.ratio()
                if r > score:
                    best, score = h, r
            if best and score >= MIN:
                out[f["id"]] = best["id"]
                used.add(best["id"])
    return out


def main():
    slugs = sys.argv[1:] or sorted(s for s in os.listdir(PUB) if os.path.exists(os.path.join(ROOT, "src", "content", "questionBank", f"{s}.json")) and tiered(s))
    for slug in slugs:
        out = pairs(slug)
        json.dump(out, open(os.path.join(PUB, slug, "tiers.json"), "w"), separators=(",", ":"))
        rows = json.load(open(os.path.join(PUB, slug, "parts.json")))
        f = sum(1 for r in rows if r["p"][-1].upper() == "F")
        print(f"{slug}: {len(out)} of {f} Foundation parts are also on the Higher paper", file=sys.stderr)


if __name__ == "__main__":
    main()
