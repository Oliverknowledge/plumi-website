"""Split the cut Engineering Manufacture (J823, unit R014) parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/ocr_cn_engineering/tag_ocr_cn_engineering.py split [work-dir] [batch-size]
    python3 scripts/question-bank/ocr_cn_engineering/tag_ocr_cn_engineering.py merge [work-dir]

ocr_gcse_cs/tag_ocr_gcse_cs.py for R014; the brief is tag.md's, with its OCR Cambridge National Engineering
Manufacture section. split writes <work-dir>/tag/eng-topics.txt and batch-NN-eng.jsonl; each batch is tagged
into batch-NN-eng.tags.json, and merge collects them into <work-dir>/tags.json for build_ocr_cn_engineering.py.
A part already in tags.json isn't batched again, and new batches number on from the old ones, so a later
series is tagged on its own. One paper: any topic can be set anywhere in it.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "ocr-cn-engineering")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 170
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip, own  # noqa: E402

NOISE = re.compile(r"© OCR \d{4}|\.{6,}|…{3,}|Turn over ►?", re.I)


def split():
    os.makedirs(TAG, exist_ok=True)
    tree = json.load(open(os.path.join(WORK, "spec.json")))["R014"]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    open(os.path.join(TAG, "eng-topics.txt"), "w").write("".join(
        f"{t['code']} | {t['section']} {sections[t['section']]} | {t['title']} — {clip(t['text'], 3000)}\n" for t in tree["topics"]))
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)-eng", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*-eng.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-eng.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                setup, question = own(NOISE.sub(" ", p["text"]), p["label"])
                f.write(json.dumps({"id": p["id"], "marks": p["marks"], "setup": clip(setup, 300),
                                    "question": clip(question, 700), "scheme": clip(p.get("msText", ""), 400)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(parts)} parts not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(WORK, "spec.json")))["R014"]["topics"]}
    tags, missing = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*-eng.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            row = json.loads(line)
            codes = [c for c in got.get(row["id"], []) if c in valid][:2]
            if codes:
                tags[row["id"]] = codes
            else:
                missing += 1
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
