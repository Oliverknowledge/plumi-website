"""Split the cut OCR parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/ocr/tag_ocr.py split [work-dir] [batch-size]
    python3 scripts/question-bank/ocr/tag_ocr.py merge [work-dir]

tag_pearson.py's sibling for OCR's specifications; the brief is tag.md's, with its
OCR section. split writes <work-dir>/tag/<subject>-topics.txt and
batch-NN-<subject>.jsonl; each batch is tagged into batch-NN-<subject>.tags.json,
and merge collects them into <work-dir>/tags.json for build_ocr.py.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "ocr-sciences")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
TAG = os.path.join(WORK, "tag")
SUBJECTS = {"biology": ("H020", "H420"), "chemistry": ("H032", "H432"), "physics": ("H156", "H556")}
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip, own  # noqa: E402


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    n = 0
    for subject, specs in SUBJECTS.items():
        tree = spec[specs[1]]
        sections = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {t['section']} {sections[t['section']]} | {t['title']}" + (" [AS]" if t["year"] == 1 else " [A-Level only]")
                 + f" — {clip(t['text'].split('Learners should be able to demonstrate and apply their knowledge and understanding of:')[-1], 420)}"
                 for t in tree["topics"]]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if p["spec"] in specs and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    setup, question = own(re.sub(r"© OCR \d{4}|\.{6,}", " ", p["text"]), p["label"])
                    f.write(json.dumps({"id": p["id"], "paper": ("AS " if p["spec"] in ("H020", "H032", "H156") else "A-Level ") + p["component"][-1],
                                        "setup": clip(setup, 200), "question": clip(question, 360),
                                        "scheme": clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        subject = re.search(r"batch-\d+-(.+)\.jsonl$", path).group(1)
        valid = {t["code"] for t in spec[SUBJECTS[subject][1]]["topics"]}
        got = json.load(open(path.replace(".jsonl", ".tags.json"))) if os.path.exists(path.replace(".jsonl", ".tags.json")) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
