"""Split the cut OCR GCSE Economics parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/ocr_gcse_economics/tag_ocr_gcse_economics.py split [batch-size]
    python3 scripts/question-bank/ocr_gcse_economics/tag_ocr_gcse_economics.py merge

ocr_economics/tag_ocr_economics.py for .work/ocr-gcse-economics; the brief is tag.md's, with its
OCR GCSE Economics section. split writes tag/economics-topics.txt and batch-NN-economics.jsonl; each
batch is tagged into batch-NN-economics.tags.json, and merge collects them into tags.json for
build_ocr_gcse_economics.py, with tag/overrides.json's corrections over them. A part already in
tags.json isn't batched again.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 100
WORK = os.path.join(HERE, "..", ".work", "ocr-gcse-economics")
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip  # noqa: E402

NOISE = re.compile(r"© OCR \d{4}|\.{6,}|Turn over ►?|Your answer", re.I)


def split():
    os.makedirs(TAG, exist_ok=True)
    tree = json.load(open(os.path.join(WORK, "spec.json")))["J205"]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {sections[t['section']]} | {t['title']} — {clip(t['text'], 600)}" for t in tree["topics"]]
    open(os.path.join(TAG, "economics-topics.txt"), "w").write("\n".join(lines) + "\n")
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)-economics", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*-economics.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-economics.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                own = NOISE.sub(" ", p.get("own") or p["text"])
                setup = NOISE.sub(" ", p["text"][len(p.get("own") or ""):]) if p.get("stem") else ""
                scheme = (f"Key: {p['key']}. " if p.get("key") else "") + p.get("msText", "")
                f.write(json.dumps({"id": p["id"], "paper": int(p["component"][-2:]), "marks": p["marks"], "setup": clip(setup, 300),
                                    "question": clip(own, 600), "scheme": clip(scheme, 400)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(parts)} parts not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(WORK, "spec.json")))["J205"]["topics"]}
    tags, missing = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    overrides = os.path.join(TAG, "overrides.json")  # corrections made on review, {id: [codes]}
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {len(missing)} without a valid topic" + (f": {missing[:10]}" if missing else ""), file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
