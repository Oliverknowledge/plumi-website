"""Find the GCSE questions printed on both tiers, for the bank's "On both tiers: show once" switch.

    python3 scripts/question-bank/tiers.py [<bank slug> ...]   # default: every bank with Higher and Foundation papers

A GCSE sitting's Foundation and Higher papers share some questions: AQA prints the Foundation paper's
last few as the Higher paper's first few, and Pearson shares one or two. A student working through both
tiers met them twice and asked for a way to see each once (29 October 2026). For each sitting, each
Foundation part is matched to the Higher part with the same wording (the part's own words and the
start of its scheme, numbers and labels left out, as the two papers number them differently) and the
same marks, one to one, in order.

A paper's tier is in its name ("Paper 1 Foundation"), and a sitting's Foundation papers pair with its
Higher ones in the bank's order: Paper 1F with 1H, and OCR GCSE Maths' Papers 1, 2 and 3 with 4, 5 and 6.
Maths keeps its numbers (and leaves out only the question's own number): a shared maths question is the
same sum, while a neighbour on the same topic ("Work out 3/4 of 120") differs from it only in them. And
as a maths question's text layer comes out in a different order on the two papers often enough (a
fraction, a table, the scheme's rows), maths also takes a pair whose words match as a count, in any
order, with its numbers: of 1 November 2026's pairs, every one checked against its crops by eye. (Two
Edexcel questions on different triangles, worded alike, score 0.79 on words: the bar is 0.85.)

Writes public/question-bank/<slug>/tiers.json, {Foundation part id: Higher part id}, beside the bank's
data so a rebuild leaves it alone; run it again after a new series.
"""
import collections, difflib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(ROOT, "public", "question-bank")
MIN = 0.86  # a shared question's wording matches almost word for word; neighbours on one topic score ~0.5
BAG, NUMBERS = 0.85, 0.8  # maths, in any order: the words' count, and the numbers' alone
HEADINGS = {"question", "answer", "marks", "mark", "part", "and", "guidance", "comments", "additional", "scheme", "notes", "q"}


def words(text, numbers=False, label=None, n=120):
    """The part's words without numbers or labels ("0 1 . 6", "(b)(ii)", "(1)"): the tiers number them differently.
    With `numbers` (maths), every number but the question's own (`label`, "17") stays in."""
    if numbers:
        t = re.sub(r"\([a-z]{1,4}\)|[^a-z0-9 ]", " ", text.lower())
        return [w for w in t.split() if (len(w) > 1 or w.isdigit()) and w != label][:n]
    t = re.sub(r"\([a-z]{1,4}\)|\b\d+\b|[^a-z ]", " ", text.lower())
    return [w for w in t.split() if len(w) > 1][:120]


def dice(a, b):
    """How much of two word counts is shared, 0 to 1."""
    return 2 * sum((a & b).values()) / (sum(a.values()) + sum(b.values()) or 1)


def tier_of(paper):
    return "H" if re.search(r"\bHigher\b", paper["name"]) else "F" if re.search(r"\bFoundation\b", paper["name"]) else None


def tiered(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    tiers = {tier_of(p) for p in meta["papers"]}
    return meta.get("level") in ("GCSE", "IGCSE") and {"H", "F"} <= tiers


def pairs(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    rows = json.load(open(os.path.join(PUB, slug, "parts.json")))
    text = json.load(open(os.path.join(PUB, slug, "text.json")))
    maths = meta.get("subject") == "Maths"
    higher = [p["id"] for p in meta["papers"] if tier_of(p) == "H"]
    foundation = [p["id"] for p in meta["papers"] if tier_of(p) == "F"]
    assert len(higher) == len(foundation), (slug, higher, foundation)
    twin = dict(zip(foundation, higher))  # "84611F" → "84611H", "j56001" → "j56004"
    by = {}
    for r in rows:
        by.setdefault((r["p"], r["s"]), []).append(r)
    label = lambda r: r["l"].split(".")[0].lstrip("0") if maths else None
    text_of = lambda r: words(text.get(r["id"], r.get("x", "")), maths, label(r))

    def counts(r):
        """Maths: its words (the scheme's headings left out) and its numbers, as counts."""
        ws = [w for w in words(text.get(r["id"], r.get("x", "")), True, label(r), 400) if w not in HEADINGS]
        return collections.Counter(ws), collections.Counter(w for w in ws if w.isdigit())
    out = {}
    for (paper, series), fparts in by.items():
        if paper not in twin:
            continue
        hparts = by.get((twin[paper], series), [])
        hwords = {h["id"]: text_of(h) for h in hparts}
        hcounts = {h["id"]: counts(h) for h in hparts} if maths else {}
        used = set()
        for f in fparts:
            fw = text_of(f)
            if len(fw) < 6:
                continue  # too few words to tell one question from another
            fc = counts(f) if maths else None
            best, score = None, 0.0
            for h in hparts:
                if h["id"] in used or (f.get("m") is not None and h.get("m") is not None and f["m"] != h["m"]):
                    continue
                r = 0.0
                if maths:
                    (fb, fn), (hb, hn) = fc, hcounts[h["id"]]
                    if dice(fb, hb) >= BAG and dice(fn, hn) >= NUMBERS:
                        r = max(MIN, dice(fb, hb))
                sm = difflib.SequenceMatcher(None, fw, hwords[h["id"]], autojunk=False)
                if sm.real_quick_ratio() >= MIN and sm.quick_ratio() >= MIN:
                    r = max(r, sm.ratio())
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
        meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
        f = sum(1 for r in rows if r["p"] in {p["id"] for p in meta["papers"] if tier_of(p) == "F"})
        print(f"{slug}: {len(out)} of {f} Foundation parts are also on the Higher paper", file=sys.stderr)


if __name__ == "__main__":
    main()
