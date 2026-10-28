"""Split the cut Philosophy questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_philosophy/tag_philosophy.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_philosophy/tag_philosophy.py merge [work-dir]

tag_psychology.py for AQA Philosophy; the brief is tag.md's, with its AQA Philosophy
section. split writes <work-dir>/tag/philosophy-topics.txt and batch-NN-philosophy.jsonl,
one question per line with the area of the paper it sits in (questions 01-05 are
the paper's first area, 06-10 its second); each batch is tagged into
batch-NN-philosophy.tags.json, and merge collects them into <work-dir>/tags.json
for build_philosophy.py.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-philosophy")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 120
TAG = os.path.join(WORK, "tag")
# Each paper's two areas: questions 01-05, then 06-10.
AREAS = {"71721": ("3.1", "3.2"), "71722": ("3.3", "3.4")}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def indicative(ms):
    """A levels-of-response scheme: the levels grid is the same for every question of its marks; keep what it credits."""
    m = re.search(r"Indicative content", ms)
    return ms[m.end():] if m else ms


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7172"]
    names = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {names[t['section']]} | {t['title']} — {clip(t['text'], 600)}" for t in tree["topics"]]
    open(os.path.join(TAG, "philosophy-topics.txt"), "w").write("\n".join(lines) + "\n")
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-philosophy.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                area = AREAS[p["component"]][int(p["question"]) > 5]
                f.write(json.dumps({"id": p["id"], "paper": p["component"][-1], "area": f"{area} {names[area]}", "marks": p["marks"],
                                    "question": clip(re.sub(r"^\d ?\d\s*", "", p["text"]), 400),
                                    "scheme": clip(indicative(p.get("msText", "")), 360)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(parts)} questions in {TAG}", file=sys.stderr)


def merge():
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7172"]
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
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
