"""Split the cut Level 2 Further Maths questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_l2_further_maths/tag_l2fm.py split [batch-size]
    python3 scripts/question-bank/aqa_l2_further_maths/tag_l2fm.py merge
    # reads scripts/question-bank/.work/aqa-l2fm/{parts,spec}.json

gcse_maths/tag_gcse_maths.py for 8365; the brief is tag.md's, with its Level 2 Further Maths
section. split writes .work/aqa-l2fm/tag/l2fm-topics.txt (one line per specification
statement, 1.1 to 6.10, with its area and what the specification says) and
batch-NN-l2fm.jsonl, one whole question per line with its paper, its words, the start of
its scheme and the path of its crop (the papers' maths fonts can come out garbled as text);
each batch is tagged into batch-NN-l2fm.tags.json, and merge collects them into
.work/aqa-l2fm/tags.json for build_l2fm.py.
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "gcse_maths"))
from tag_gcse_maths import clip  # noqa: E402

mode = sys.argv[1] if len(sys.argv) > 1 else "split"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 90
WORK = os.path.abspath(os.path.join(HERE, "..", ".work", "aqa-l2fm"))
TAG = os.path.join(WORK, "tag")
PAPER = {"83651": "Paper 1 (non-calculator)", "83652": "Paper 2 (calculator)"}


def split():
    os.makedirs(TAG, exist_ok=True)
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    names = {s["code"]: s["title"] for s in spec["sections"]}
    lines = [f"{t['code']} | {names[t['section']]} | {t['title']}: {clip(t['text'], 600)}" for t in spec["topics"]]
    open(os.path.join(TAG, "l2fm-topics.txt"), "w").write("\n".join(lines) + "\n")
    rows = [{"id": p["id"], "paper": PAPER[p["component"]], "marks": p["marks"], "question": clip(p["text"], 1200),
             "scheme": clip(p.get("msText", ""), 500), "image": os.path.join(WORK, "img", p["qp"])}
            for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    n = 0
    for i in range(0, len(rows), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-l2fm.jsonl"), "w") as f:
            for r in rows[i:i + SIZE]:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(rows)} questions in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(WORK, "spec.json")))["topics"]}
    tags, missing = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = list(dict.fromkeys(c for c in got.get(pid, []) if c in valid))[:3]
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {len(missing)} without a valid topic {missing[:10]}", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
