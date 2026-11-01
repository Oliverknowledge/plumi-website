"""Split the cut OCR History A questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/ocr_history/tag_ocr_history.py split [batch-size]
    python3 scripts/question-bank/ocr_history/tag_ocr_history.py merge

ocr_law/tag_ocr_law.py's sibling for .work/ocr-history; the brief is tag.md's, with its OCR History
section. A question can only test its own unit, so each line carries the codes it may choose from
(`topics`): a Unit 1 source question (1) its enquiry topic's key topics, a Unit 1 essay its British
period study's, a Unit 3 interpretations question (1) its three depth studies, a Unit 3 essay its
thematic study's key topics, and a Unit 2 question its unit's. split writes tag/history-topics.txt
(every topic, for reference) and batch-NN-history.jsonl; each batch is tagged into
batch-NN-history.tags.json, and merge collects them into tags.json for build_ocr_history.py, with
tag/overrides.json's corrections over them, keeping only codes a line was offered. A part already in
tags.json isn't batched again.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 140
WORK = os.path.join(HERE, "..", ".work", "ocr-history")
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip  # noqa: E402

NOISE = re.compile(r"© OCR \d{4}|\.{6,}|Turn over ►?|Y\d{3}/01 (Jun|Nov)\d\d", re.I)


def offered(topics, part):
    """The codes a question may take: its unit's, of the kind its question tests."""
    unit = part["component"][:4].upper()
    mine = [t for t in topics if t["section"] == unit]
    q = int(part["question"])
    if unit[1] == "1":
        want = "enquiry" if q == 1 else "period"
    elif unit[1] == "3":
        want = "depth" if q == 1 else "theme"
    else:
        want = None
    return [t for t in mine if not want or t["kind"] == want] or mine


def split():
    os.makedirs(TAG, exist_ok=True)
    tree = json.load(open(os.path.join(WORK, "spec.json")))["H505"]
    units = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {t['section']} {units[t['section']]} | [{t['kind']}] {t['title']} — {clip(t['text'], 500)}" for t in tree["topics"]]
    open(os.path.join(TAG, "history-topics.txt"), "w").write("\n".join(lines) + "\n")
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)-history", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*-history.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-history.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                unit = p["component"][:4].upper()
                f.write(json.dumps({"id": p["id"], "unit": f"{unit} {units[unit]}", "marks": p["marks"],
                                    "question": clip(NOISE.sub(" ", p["text"]), 450), "scheme": clip(NOISE.sub(" ", p.get("msText", "")), 500),
                                    "topics": {t["code"]: t["title"] for t in offered(tree["topics"], p)}}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(parts)} parts not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    tags, missing = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*-history.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            row = json.loads(line)
            codes = [c for c in got.get(row["id"], []) if c in row["topics"]][:2]
            if codes:
                tags[row["id"]] = codes
            else:
                missing.append(row["id"])
    overrides = os.path.join(TAG, "overrides.json")  # corrections made on review, {id: [codes]}
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {len(missing)} without a valid topic" + (f": {missing[:10]}" if missing else ""), file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
