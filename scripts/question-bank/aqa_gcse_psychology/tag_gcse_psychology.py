"""Split the cut AQA GCSE Psychology questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_psychology/tag_gcse_psychology.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_gcse_psychology/tag_gcse_psychology.py merge [work-dir]

tag_gcse_business.py for Psychology: split writes <work-dir>/tag/gcse-psychology-topics.txt and
<work-dir>/tag/batch-NN-gcse-psychology.jsonl, one question per line with the codes it may take,
and each batch is tagged following ../tag.md's "AQA GCSE Psychology" section into
batch-NN-gcse-psychology.tags.json. merge writes <work-dir>/tags.json.

Any question may take any topic: research methods (3.1.4) is examined in both papers, and each
paper's synoptic 9-mark question draws on the other paper's content too.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from build_bank import own_text  # noqa: E402

mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-gcse-psychology")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 95
TAG = os.path.join(WORK, "tag")
PAPER = {"81821": "Paper 1", "81822": "Paper 2"}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8182"]
    return parts, tree


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {sections[t['section']]} | {t['title']} — {clip(t['text'], 3000)}" for t in tree["topics"]]
    open(os.path.join(TAG, "gcse-psychology-topics.txt"), "w").write("\n".join(lines) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    parts.sort(key=lambda p: (p["component"], p["series"], p["id"]))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-gcse-psychology.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                own = own_text(p["text"], p["label"])
                setup = p["text"][:p["text"].find(own[:40])] if p["part"] and own[:40] in p["text"] else ""
                f.write(json.dumps({"id": p["id"], "paper": PAPER[p["component"]], "label": p["label"], "marks": p["marks"],
                                    "setup": clip(setup, 300), "question": clip(own, 600),
                                    "scheme": f"Answer: {p['key']}" if p.get("key") else clip(p.get("msText", ""), 450)}, ensure_ascii=False) + "\n")
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
