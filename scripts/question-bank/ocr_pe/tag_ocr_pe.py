"""Split the cut OCR Physical Education parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/ocr_pe/tag_ocr_pe.py split [batch-size]
    python3 scripts/question-bank/ocr_pe/tag_ocr_pe.py merge

computer_science/tag_cs.py's sibling for .work/ocr-pe; the brief is tag.md's, with tag/ocr-physical-education.md (its
differences). split writes tag/pe-topics.txt and batch-NN-pe.jsonl; each
batch is tagged into batch-NN-pe.tags.json, and merge collects them into tags.json for
build_ocr_pe.py, with tag/overrides.json's corrections over them. A part already in
tags.json isn't batched again.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 120
WORK = os.path.join(HERE, "..", ".work", "ocr-pe")
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip  # noqa: E402

NOISE = re.compile(r"© OCR \d{4}|\.{6,}|Turn over ►?|Your answer", re.I)


def split():
    os.makedirs(TAG, exist_ok=True)
    tree = json.load(open(os.path.join(WORK, "spec.json")))["H555"]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {sections[t['section']]} | {t['title']}" + (" [AS]" if t["year"] == 1 else " [A-Level only]")
             + f" — {clip(t['text'], 3000)}" for t in tree["topics"]]
    open(os.path.join(TAG, "pe-topics.txt"), "w").write("\n".join(lines) + "\n")
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)-pe", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*-pe.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-pe.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                own = NOISE.sub(" ", p.get("own") or p["text"])
                setup = NOISE.sub(" ", p["text"][len(p.get("own") or ""):]) if p.get("stem") else ""
                paper = "A-Level " + str(int(p["component"][-2:]))
                f.write(json.dumps({"id": p["id"], "paper": paper, "marks": p["marks"], "setup": clip(setup, 300), "question": clip(own, 600),
                                    "scheme": clip(p.get("msText", ""), 400)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(parts)} parts not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(WORK, "spec.json")))["H555"]["topics"]}
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
