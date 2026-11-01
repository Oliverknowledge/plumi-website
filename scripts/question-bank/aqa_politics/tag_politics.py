"""Split the cut AQA Politics questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_politics/tag_politics.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_politics/tag_politics.py merge [work-dir]

split writes <work-dir>/tag/politics-topics.txt (each topic's code, its section, its
title and the specification's words) and <work-dir>/tag/batch-NN-politics.jsonl, one
question per line. Each batch is tagged following ../tag.md's "AQA Politics" section
into batch-NN-politics.tags.json: {"<id>": ["3.1.2.2"], ...}. merge combines them
into <work-dir>/tags.json for build_politics.py.

A question's codes must be in its paper's area (PAPER_SECTIONS): Paper 1 the UK, Paper 2
the USA and comparative politics, Paper 3 political ideas.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-politics")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 60
TAG = os.path.join(WORK, "tag")
PAPER_SECTIONS = {"71521": ("3.1.1", "3.1.2"), "71522": ("3.2.1", "3.2.2"), "71523": ("3.3.1", "3.3.2")}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7152"]
    return parts, tree


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    sections = {s["code"]: s["short"] for s in tree["sections"]}
    open(os.path.join(TAG, "politics-topics.txt"), "w").write(
        "\n".join(f"{t['code']} | {sections[t['section']]} | {t['title']} — {clip(t['text'], 300)}" for t in tree["topics"]) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*")):
        os.remove(old)
    parts.sort(key=lambda p: p["id"])
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-politics.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                m = re.search(r"\[\d+ marks?\]", p["text"])
                f.write(json.dumps({"id": p["id"], "paper": f"Paper {p['component'][4]}", "sections": list(PAPER_SECTIONS[p["component"]]),
                                    "marks": p["marks"], "question": clip(p["text"][:m.end()] if m else p["text"], 400),
                                    "scheme": clip(re.sub(r"^.*?Indicative content", "", p.get("msText", "")), 400)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of up to {SIZE} in {TAG}", file=sys.stderr)


def merge():
    parts, tree = load()
    by_id = {p["id"]: p for p in parts}
    tags, problems = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            ok = {t["code"] for t in tree["topics"] if t["section"] in PAPER_SECTIONS[by_id[pid]["component"]]}
            codes = [c for c in got.get(pid, []) if c in ok]
            if not codes:
                problems.append(f"{pid}: {got.get(pid)}")
                continue
            tags[pid] = codes[:2]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} of {len(parts)} tagged; {len(problems)} problems", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
