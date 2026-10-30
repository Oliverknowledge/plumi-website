"""Split the cut GCSE Computer Science (1CP2) parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_cs/tag_cs.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_cs/tag_cs.py merge [work-dir]

computer_science/tag_cs.py's sibling; the brief is tag.md's, with its Edexcel GCSE Computer
Science section. split writes <work-dir>/tag/cs-topics.txt and batch-NN-cs.jsonl; each batch is
tagged into batch-NN-cs.tags.json, and merge collects them into <work-dir>/tags.json for
build_cs.py. A part already in tags.json isn't batched again, and new batches number on from
the old ones, so a later series is tagged on its own.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-cs")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 110
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip, own  # noqa: E402

NOISE = re.compile(r"\.{6,}|Turn over|DO NOT WRITE IN THIS AREA|P\d{5}[A-Z]{1,2}\d*", re.I)


def split():
    os.makedirs(TAG, exist_ok=True)
    tree = json.load(open(os.path.join(WORK, "spec.json")))["1CP2"]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    open(os.path.join(TAG, "cs-topics.txt"), "w").write("".join(
        f"{t['code']} | {t['section']} {sections[t['section']]} | {t['title']} — {clip(t['text'], 400)}\n" for t in tree["topics"]))
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)-cs", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*-cs.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-cs.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                setup, question = own(NOISE.sub(" ", p["text"]), p["label"])
                f.write(json.dumps({"id": p["id"], "paper": int(p["component"][-1]), "marks": p["marks"], "setup": clip(setup, 300),
                                    "question": clip(question, 700), "scheme": clip(p.get("msText", ""), 400)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(parts)} parts not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(WORK, "spec.json")))["1CP2"]["topics"]}
    tags, missing = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*-cs.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            row = json.loads(line)
            # Paper 1 sets Topics 1 to 5, Paper 2 Topic 6
            codes = [c for c in got.get(row["id"], []) if c in valid and (c[0] == "6") == (row["paper"] == 2)][:2]
            if codes:
                tags[row["id"]] = codes
            else:
                missing += 1
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
