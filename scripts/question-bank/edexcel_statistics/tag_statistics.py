"""Split the cut Statistics questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_statistics/tag_statistics.py split <work-dir> [batch-size]
    python3 scripts/question-bank/edexcel_statistics/tag_statistics.py merge <work-dir>

split writes <work-dir>/tag/statistics-topics.txt (the specification's 21 topics, one per line, with their
wording) and batch-NN-statistics.jsonl, one whole question per line: its id, marks, its words, the start of its
scheme and the path of its crop. Each batch is tagged (brief: tag.md, with tag/edexcel-statistics.md) into
batch-NN-statistics.tags.json, and merge collects them into <work-dir>/tags.json for build_statistics.py, keeping
only codes that are topics of the bank.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2])
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 100
TAG = os.path.join(WORK, "tag")
NOISE = re.compile(r"DO NOT WRITE IN THIS AREA|Leave blank|Turn over|\.{4,}|_{4,}", re.I)


def nodes():
    return [n for n in json.load(open(os.path.join(HERE, "statistics_topics.json")))["statistics"] if n["level"] == 2]


def clip(s, n):
    s = re.sub(r"\s+", " ", NOISE.sub(" ", s or "")).strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(TAG, exist_ok=True)
    open(os.path.join(TAG, "statistics-topics.txt"), "w").write(
        "\n".join(f"{n['code']} {n['title']} — {clip(n['text'], 3000)}" for n in nodes()) + "\n")
    rows = [{"id": p["id"], "paper": p["component"], "marks": p["marks"], "question": clip(p["text"], 1500),
             "scheme": clip(p.get("msText", ""), 600), "image": os.path.join(WORK, "img", p["qp"])}
            for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    n = 0
    for i in range(0, len(rows), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-statistics.jsonl"), "w") as f:
            for r in rows[i:i + SIZE]:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(rows)} questions in {TAG}", file=sys.stderr)


def merge():
    valid = {n["code"] for n in nodes()}
    tags, missing = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = list(dict.fromkeys(c for c in got.get(pid, []) if c in valid))[:2]
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {len(missing)} without a valid topic {missing[:10]}", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
