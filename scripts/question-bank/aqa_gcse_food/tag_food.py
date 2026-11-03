"""Split the cut AQA GCSE Food Preparation and Nutrition questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_food/tag_food.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_gcse_food/tag_food.py merge [work-dir]

tag_gcse_psychology.py for Food: split writes <work-dir>/tag/gcse-food-topics.txt and
<work-dir>/tag/batch-NN-gcse-food.jsonl, one question per line with the codes it may take,
and each batch is tagged following ../tag.md's "AQA GCSE Food Preparation and Nutrition"
section into batch-NN-gcse-food.tags.json. merge writes <work-dir>/tags.json.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import own_text  # noqa: E402

mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-gcse-food")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 110
TAG = os.path.join(WORK, "tag")


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8585"]
    return parts, tree


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {sections[t['section']]} | {t['title']} — {clip(t['text'], 500)}" for t in tree["topics"]]
    open(os.path.join(TAG, "gcse-food-topics.txt"), "w").write("\n".join(lines) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    parts.sort(key=lambda p: (p["series"], p["id"]))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-gcse-food.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                own = own_text(p["text"], p["label"])
                setup = p["text"][:p["text"].find(own[:40])] if p["part"] and own[:40] in p["text"] else ""
                f.write(json.dumps({"id": p["id"], "label": p["label"], "marks": p["marks"], "setup": clip(setup, 300), "question": clip(own, 600),
                                    "scheme": f"Answer: {p['key']} – {p.get('keyWords', '')}" if p.get("key") else clip(p.get("msText", ""), 450)},
                                   ensure_ascii=False) + "\n")
    print(f"{n} batches of up to {SIZE} in {TAG}", file=sys.stderr)


def merge():
    parts, tree = load()
    codes = {t["code"] for t in tree["topics"]}
    tags, problems = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            mine = [c for c in got.get(pid, []) if c in codes][:2]
            if not mine:
                problems.append(f"{pid}: {got.get(pid)}")
                continue
            tags[pid] = list(dict.fromkeys(mine))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} of {len(parts)} tagged; {len(problems)} problems", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
