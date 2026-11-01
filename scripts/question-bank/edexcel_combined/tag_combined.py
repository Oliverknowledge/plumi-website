"""Tag the cut Edexcel GCSE Combined Science parts to the specification's topics.

    python3 scripts/question-bank/edexcel_combined/tag_combined.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_combined/tag_combined.py merge [work-dir]

Pearson prints many 1SC0 questions on the separate sciences' papers of the same sitting too
(Biology Paper 1 Higher's and 1BI0 Paper 1 Higher's share their opening questions). split
finds them: a part with the wording and marks of a part on the same paper and tier of
edexcel-gcse-biology, -chemistry or -physics (tiers.py's match, against those banks' public
data) is a crossover, and takes that part's tags, its separate-science sub-topic codes turned
into this bank's (spec.json's `separate`), into tag/carried.json, and its practical verdict
into tag/practicals.json. The rest go to tag/batch-NN-<science>.jsonl, with
<science>-topics.txt to choose from, tagged following ../tag.md ("Edexcel GCSE Combined
Science") into batch-NN-<science>.tags.json. merge joins both into <work-dir>/tags.json, as
tag_pearson.py does. The banks stay apart: the match only saves tagging the same question twice.
"""
import difflib, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-combined")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
sys.argv[2:] = [WORK, str(SIZE)]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.dirname(HERE))
import tag_pearson as tp  # noqa: E402
from tiers import MIN, words  # noqa: E402

TAG = os.path.join(WORK, "tag")
SCIENCES = {"b": ("biology", "1bi0"), "c": ("chemistry", "1ch0"), "p": ("physics", "1ph0")}
TIER = {"f": "Foundation", "h": "Higher"}
PAPER_1 = {"b": range(1, 6), "c": range(1, 6), "p": range(1, 8)}  # topics on Paper 1; Topic 1 is on both


def separate(science):
    """The separate science bank's public parts by (paper and tier, series), with their words."""
    pub = os.path.join(ROOT, "public", "question-bank", f"edexcel-gcse-{science}")
    rows = json.load(open(os.path.join(pub, "parts.json")))
    text = json.load(open(os.path.join(pub, "text.json")))
    practical = os.path.join(pub, "practicals.json")
    practical = set(json.load(open(practical))) if os.path.exists(practical) else set()
    out = {}
    for r in rows:
        out.setdefault((r["p"], r["s"]), []).append({**r, "w": words(text.get(r["id"], r["x"])), "pr": r["id"] in practical})
    return out


def crossover(part, own_words, pool):
    """The separate-science part this one is, or None."""
    if len(own_words) < 6:
        return None
    best, score = None, 0.0
    for s in pool:
        if part["marks"] is not None and s["m"] is not None and part["marks"] != s["m"]:
            continue
        sm = difflib.SequenceMatcher(None, own_words, s["w"], autojunk=False)
        if sm.real_quick_ratio() < MIN or sm.quick_ratio() < MIN:
            continue
        r = sm.ratio()
        if r > score:
            best, score = s, r
    return best if score >= MIN else None


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["1SC0"]
    titles = {s["code"]: s["title"] for s in tree["sections"]}
    carried, practicals, rest = {}, {}, {}
    for letter, (science, code) in SCIENCES.items():
        mine = [t for t in tree["topics"] if t["code"][0] == letter.upper()]
        to_mine = {t["separate"]: t["code"] for t in mine}
        papers = lambda t: "Papers 1 and 2" if int(t["section"][1:]) == 1 else "Paper 1" if int(t["section"][1:]) in PAPER_1[letter] else "Paper 2"  # noqa: E731
        open(os.path.join(TAG, f"{science}-topics.txt"), "w").write("\n".join(
            f"{t['code']} | {titles[t['section']]} | {t['title']} (statements {t['points']}) [{papers(t)}] — {tp.clip(t['text'], 420)}" for t in mine) + "\n")
        pools = separate(science)
        for p in parts:
            if p["component"][5] != letter:
                continue
            twin = crossover(p, words(p["text"] + " " + p.get("msText", "")), pools.get((code + p["component"][4] + p["component"][6], p["series"]), []))
            if twin:
                practicals[p["id"]] = twin["pr"]
                codes = [to_mine[c] for c in twin["t"] if c in to_mine]
                if codes:
                    carried[p["id"]] = codes
                    continue
            rest.setdefault(science, []).append(p)
    json.dump(carried, open(os.path.join(TAG, "carried.json"), "w"), indent=0)
    json.dump(practicals, open(os.path.join(TAG, "practicals.json"), "w"), indent=0)
    n = 0
    for science, mine in rest.items():
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{science}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    setup, question = tp.own(p["text"], p["label"])
                    c = p["component"]
                    f.write(json.dumps({"id": p["id"], "paper": f"{science.title()} Paper {c[4]} {TIER[c[6]]}",
                                        "setup": tp.clip(setup, 200), "question": tp.clip(question, 360),
                                        "scheme": tp.clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{len(practicals)} of {len(parts)} parts are on a separate science's paper too; {len(carried)} take its tags; "
          f"{sum(len(v) for v in rest.values())} in {n} batches in {TAG}", file=sys.stderr)


def merge():
    tree = json.load(open(os.path.join(WORK, "spec.json")))["1SC0"]
    tp.SUBJECTS = {s: (None, "1SC0") for s, _ in SCIENCES.values()}
    tp.merge()  # the batches' tags, into tags.json
    tags = json.load(open(os.path.join(WORK, "tags.json")))
    valid = {t["code"] for t in tree["topics"]}
    for pid, codes in json.load(open(os.path.join(TAG, "carried.json"))).items():
        if pid not in tags:
            tags[pid] = [c for c in codes if c in valid][:2]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged with the carried ones", file=sys.stderr)


if __name__ == "__main__":
    tp.TAG = TAG
    tp.WORK = WORK
    split() if mode == "split" else merge()
