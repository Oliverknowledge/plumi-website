"""Split the cut AQA Maths questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_maths/tag_maths.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_maths/tag_maths.py merge [work-dir]

tag_psychology.py's sibling for AQA A-Level Maths; the brief is tag.md's, with its
AQA Maths section. split writes <work-dir>/tag/maths-topics.txt (one line per
lettered topic, with the specification's statements under it) and
batch-NN-maths.jsonl, one whole question per line with its paper (which section
holds what), its words and the start of its scheme; each batch is tagged into
batch-NN-maths.tags.json, and merge collects them into <work-dir>/tags.json for
build_maths.py.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-maths")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 145
TAG = os.path.join(WORK, "tag")
NOISE = re.compile(r"Do not write outside the box|Turn over ►?|Question \d+ continues on the next page", re.I)


def clip(s, n):
    s = re.sub(r"\s+", " ", NOISE.sub(" ", s or "")).strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def section(part):
    """Paper 1 is all pure; Papers 2 and 3 have pure in Section A and, in Section B, Mechanics (2) or Statistics (3)."""
    paper = part["component"][-1]
    return f"Paper {paper}" if paper == "1" else f"Paper {paper} (Section A pure, Section B {'mechanics' if paper == '2' else 'statistics'})"


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    names = {s["code"]: s["title"] for s in spec["sections"]}
    lines = [f"{t['code']} | {names[t['section']]} | {t['title']} — " + " ".join(f"{s['code']}: {clip(s['text'], 260)}" for s in t["statements"])
             for t in spec["topics"]]
    open(os.path.join(TAG, "maths-topics.txt"), "w").write("\n".join(lines) + "\n")
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-maths.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                f.write(json.dumps({"id": p["id"], "paper": section(p), "marks": p["marks"],
                                    "question": clip(p["text"], 1400), "scheme": clip(p.get("msText", ""), 500)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(parts)} questions in {TAG}", file=sys.stderr)


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
