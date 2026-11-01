"""Split the cut AQA GCSE Business parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_business/tag_gcse_business.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_gcse_business/tag_gcse_business.py merge [work-dir]

tag_gcse_geography.py for Business: split writes <work-dir>/tag/gcse-business-topics.txt and
<work-dir>/tag/batch-NN-gcse-business.jsonl, one part per line with the codes it may take, and
each batch is tagged following ../tag.md's "AQA GCSE Business" section into
batch-NN-gcse-business.tags.json. merge writes <work-dir>/tags.json.

A paper's topics are the specification's: both papers take 3.1 Business in the real world and
3.2 Influences on business; Paper 1 adds 3.3 Business operations and 3.4 Human resources,
Paper 2 adds 3.5 Marketing and 3.6 Finance.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-gcse-business")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 110
TAG = os.path.join(WORK, "tag")
AREAS = {"81321": ("3.1.", "3.2.", "3.3.", "3.4."), "81322": ("3.1.", "3.2.", "3.5.", "3.6.")}
PAPER = {"81321": "Paper 1", "81322": "Paper 2"}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8132"]
    return parts, tree


def allowed(p, codes):
    return [c for c in codes if c.startswith(AREAS[p["component"]])]


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    codes = [t["code"] for t in tree["topics"]]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {sections[t['section']]} | {t['title']} — {clip(t['text'], 500)}" for t in tree["topics"]]
    open(os.path.join(TAG, "gcse-business-topics.txt"), "w").write("\n".join(lines) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    parts.sort(key=lambda p: (p["component"], p["series"], p["id"]))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-gcse-business.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                # The part's own words come first in its text, then its question's items.
                marks = re.search(r"\[\d+ marks?\]", p["text"])
                own, items = (p["text"][:marks.end()], p["text"][marks.end():]) if marks else (p["text"], "")
                f.write(json.dumps({"id": p["id"], "paper": PAPER[p["component"]], "label": p["label"], "marks": p["marks"], "allowed": allowed(p, codes),
                                    "question": clip(own, 600), "items": clip(items, 300),
                                    "scheme": f"Answer: {p['key']}" if p.get("key") else clip(p.get("msText", ""), 450)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of up to {SIZE} in {TAG}", file=sys.stderr)


def merge():
    parts, tree = load()
    codes = [t["code"] for t in tree["topics"]]
    by_id = {p["id"]: p for p in parts}
    tags, problems = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            ok = allowed(by_id[pid], codes)
            mine = [c for c in got.get(pid, []) if c in ok][:2]
            if not mine:
                problems.append(f"{pid}: {got.get(pid)} (must be one of {ok})")
                continue
            tags[pid] = list(dict.fromkeys(mine))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} of {len(parts)} tagged; {len(problems)} problems", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
