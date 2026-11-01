"""Split the cut GCSE Computer Science (8525) parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_cs/tag_gcse_cs.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_gcse_cs/tag_gcse_cs.py merge [work-dir]

edexcel_cs/tag_cs.py's sibling; the brief is tag.md's, with its AQA GCSE Computer Science
section. split writes <work-dir>/tag/cs-topics.txt and batch-NN-cs.jsonl; each batch is tagged
into batch-NN-cs.tags.json, and merge collects them into <work-dir>/tags.json for build_gcse_cs.py.

Paper 1's three languages (1A C#, 1B Python, 1C VB.NET) set the same questions, each in its
own language: only the Python paper's parts are batched, and merge gives a C# or VB.NET part
the tags of the Python part with its series and label. A part with no Python twin (where the
papers' numbering parts company) is batched on its own. A part already in tags.json isn't
batched again, and new batches number on from the old ones, so a later series is tagged on its own.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-gcse-cs")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 110
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.join(HERE, ".."))
from tag_pearson import clip  # noqa: E402
from build_bank import own_text  # noqa: E402

NOISE = re.compile(r"Turn over ►?|Do not write outside the box|Question \d+ continues on the next page|\*\d{2}\*|IB/[A-Z]/[^\s]+", re.I)
TWINS = ("85251a", "85251c")


def twin(pid):
    """The Python paper's copy of a C# or VB.NET part: "85251a-jun24-03-2" -> "85251b-jun24-03-2"."""
    return "85251b" + pid[6:] if pid[:6] in TWINS else None


def split():
    os.makedirs(TAG, exist_ok=True)
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8525"]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    open(os.path.join(TAG, "cs-topics.txt"), "w").write("".join(
        f"{t['code']} | {t['section']} {sections[t['section']]} | {t['title']} — {clip(t['text'], 500)}\n" for t in tree["topics"]))
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    ids = {p["id"] for p in parts}
    todo = [p for p in parts if p["id"] not in done and twin(p["id"]) not in ids]
    n = max([int(re.search(r"batch-(\d+)-cs", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*-cs.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(todo), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-cs.jsonl"), "w") as f:
            for p in todo[i:i + SIZE]:
                text = NOISE.sub(" ", p["text"])
                question = own_text(text, p["label"])
                setup = text[:max(0, text.find(question[:40]))] if question[:40] in text else ""
                f.write(json.dumps({"id": p["id"], "paper": int(p["component"][4]), "marks": p["marks"], "setup": clip(setup, 300),
                                    "question": clip(question, 700), "scheme": clip(p.get("msText", ""), 400)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(todo)} parts not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(WORK, "spec.json")))["8525"]["topics"]}
    tags, missing = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*-cs.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    copied = 0
    for p in json.load(open(os.path.join(WORK, "parts.json"))):
        if twin(p["id"]) in tags and p["id"] not in tags:
            tags[p["id"]] = tags[twin(p["id"])]
            copied += 1
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged ({copied} from their Python twin), {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
