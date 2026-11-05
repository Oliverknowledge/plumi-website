"""Split the cut GCSE PE questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_pe/tag_gcse_pe.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_gcse_pe/tag_gcse_pe.py merge [work-dir]

tag_pe.py's sibling for AQA GCSE PE; the brief is tag.md's, with its AQA GCSE Physical Education section.
split writes <work-dir>/tag/gcse-gcse-pe-topics.txt and batch-NN-gcse-gcse-pe.jsonl, one question per line (the papers
have no sections); each batch is tagged into batch-NN-gcse-pe.tags.json, and merge collects them
into <work-dir>/tags.json for build_gcse_pe.py.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-gcse-pe")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 150
TAG = os.path.join(WORK, "tag")


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def strip_levels(ms):
    """A 6- or 9-mark scheme: the levels table says little about the topic; keep what it credits."""
    return re.sub(r"Level\s+Marks?\s+Descript.*?No relevant content\.?", " ", ms)


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8582"]
    names = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {names[t['section']]} | {t['title']} — {clip(t['text'], 3000)}" for t in tree["topics"]]
    open(os.path.join(TAG, "gcse-pe-topics.txt"), "w").write("\n".join(lines) + "\n")
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-gcse-pe.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                text = re.sub(r"Extra space|Do not write outside the box|Turn over ►?|You may use this space to plan your answer\.?", " ", p["text"])
                f.write(json.dumps({"id": p["id"], "paper": "Paper " + p["component"][-1], "marks": p["marks"], "question": clip(text, 700),
                                    "scheme": (f"Answer: {p['key']}" if p.get("key") else clip(strip_levels(p.get("msText", "")), 400))},
                                   ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(parts)} questions in {TAG}", file=sys.stderr)


def merge():
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8582"]
    valid = {t["code"] for t in tree["topics"]}
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
                print(f"  {pid}: {got.get(pid)}", file=sys.stderr)
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
