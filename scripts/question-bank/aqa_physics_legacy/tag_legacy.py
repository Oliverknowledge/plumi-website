"""Split the legacy Physics A parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_physics_legacy/tag_legacy.py split [work-dir]
    python3 scripts/question-bank/aqa_physics_legacy/tag_legacy.py merge [work-dir]

The legacy units are tagged to the current specification's (7408) topics, so the old
questions sit beside the new ones under the same topics (tag.md, "AQA Physics A legacy").
split writes <work-dir>/tag/topics.txt (7408's topics with what they cover, from the main
work dir's spec.json) and batch-NN.jsonl, one part per line: id, unit, its setup, its own
words and the start of its scheme (or, for a multiple-choice question, its key). Each batch
is tagged into batch-NN.tags.json: {"<id>": ["3.4.1"], ...}, [] for a part whose physics
isn't on the 7408 specification, with the reason in batch-NN.off.json: {"<id>": "why"}.
merge writes <work-dir>/tags.json and off.json, keeping only 7408 topic codes.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
QB = os.path.dirname(HERE)
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(QB, ".work", "phya")
TAG = os.path.join(WORK, "tag")
SIZE = 230
UNIT = {"PHYA1": "PHYA1 Particles, quantum phenomena and electricity (AS)", "PHYA2": "PHYA2 Mechanics, materials and waves (AS)",
        "PHYA4A": "PHYA4 Fields and further mechanics, Section A (multiple choice)", "PHYA4B": "PHYA4 Fields and further mechanics, Section B",
        "PHYA5A": "PHYA5 Section A: Nuclear and thermal physics", "PHYA5BA": "PHYA5 option A: Astrophysics",
        "PHYA5BB": "PHYA5 option B: Medical physics", "PHYA5BC": "PHYA5 option C: Applied physics",
        "PHYA5BD": "PHYA5 option D: Turning points in physics"}


def topics():
    spec = json.load(open(os.path.join(QB, ".work", "spec.json")))["7408"]
    out = []
    for n in spec:
        if n["level"] == 1:
            out.append(f"{n['code']} {n['title']}")
        elif n["level"] == 2:
            text = re.sub(r"Content Opportunities for skills development|AQA AS and A-level Physics.*?\d+ ", " ", n.get("text", ""))
            out.append(f"{n['code']} {n['title']} — {re.sub(r'\s+', ' ', text).strip()[:500]}")
    return out


def split():
    os.makedirs(TAG, exist_ok=True)
    open(os.path.join(TAG, "topics.txt"), "w").write("\n".join(topics()) + "\n")
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    for f in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(f)
    rows = []
    dots = lambda t: re.sub(r"\s*(?:\.{4,}\s*)+", " … ", t)  # noqa: E731  answer lines
    for p in parts:
        rows.append({"id": p["id"], "unit": UNIT[p["component"]], "label": p["label"], "setup": dots(p["setupText"])[-700:], "question": dots(p["ownText"]),
                     **({"key": p["key"]} if p.get("key") else {"scheme": dots(p["msText"])[:400]})})
    for n in range(0, len(rows), SIZE):
        with open(os.path.join(TAG, f"batch-{n // SIZE + 1:02d}.jsonl"), "w") as fh:
            for r in rows[n:n + SIZE]:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(rows)} parts in {(len(rows) + SIZE - 1) // SIZE} batches in {TAG}", file=sys.stderr)


def merge():
    valid = {l.split(" ", 1)[0] for l in open(os.path.join(TAG, "topics.txt")) if l.count(".") >= 2}
    want = {json.loads(l)["id"] for f in glob.glob(os.path.join(TAG, "batch-*.jsonl")) for l in open(f)}
    tags, off = {}, {}
    for f in sorted(glob.glob(os.path.join(TAG, "batch-*.tags.json"))):
        for pid, codes in json.load(open(f)).items():
            tags[pid] = [c for c in codes if c in valid]
    for f in sorted(glob.glob(os.path.join(TAG, "batch-*.off.json"))):
        off.update(json.load(open(f)))
    missing = sorted(want - set(tags))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    json.dump(off, open(os.path.join(WORK, "off.json"), "w"), indent=1)
    print(f"{len(tags)} tagged, {sum(1 for v in tags.values() if not v)} off the 7408 spec, {len(missing)} missing {missing[:10]}", file=sys.stderr)


if __name__ == "__main__":
    {"split": split, "merge": merge}[mode]()
