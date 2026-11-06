"""Split the cut OCR GCSE Design and Technology (J310) parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/ocr_gcse_dt/tag_ocr_gcse_dt.py split [work-dir] [batch-size]
    python3 scripts/question-bank/ocr_gcse_dt/tag_ocr_gcse_dt.py merge [work-dir]

ocr_gcse_classics/tag_ocr_gcse_classics.py for J310: split writes <work-dir>/tag/dt-topics.txt and
<work-dir>/tag/batch-NN-dt.jsonl, one part per line, and each batch is tagged following ../tag/ocr-gcse-design-and-technology.md
(and tag.md's brief) into batch-NN-dt.tags.json. merge writes <work-dir>/tags.json for build_ocr_gcse_dt.py.
The first code is the topic a part mainly tests; a second is for a part that plainly tests another topic as well.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "ocr-gcse-dt")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 200
TAG = os.path.join(WORK, "tag")
PAPER = {"j31001": "dt"}
NOISE = re.compile(r"© OCR \d{4}|\.{6,}|…{3,}|Turn over", re.I)


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(TAG, exist_ok=True)
    tree = json.load(open(os.path.join(WORK, "spec.json")))["J310"]
    titles = {s["code"]: s["title"] for s in tree["sections"]}
    open(os.path.join(TAG, "dt-topics.txt"), "w").write("".join(
        f"{t['code']} | {titles[t['section']]} | {t['title']} — {clip(t['text'], 3000)}\n" for t in tree["topics"]))
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)-", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*.jsonl"))] or [0])
    first = n + 1
    for comp, option in PAPER.items():
        mine = [p for p in parts if p["component"] == comp]
        codes = [t["code"] for t in tree["topics"]]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{option}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    f.write(json.dumps({"id": p["id"], "paper": "Principles of Design and Technology", "area": "", "codes": codes, "marks": p["marks"],
                                        "question": clip(NOISE.sub(" ", p["text"]), 900), "scheme": clip(p.get("msText", ""), 400)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(parts)} parts not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    missing = []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            row = json.loads(line)
            codes = [c for c in got.get(row["id"], []) if c in row["codes"]][:2]
            if codes:
                tags[row["id"]] = list(dict.fromkeys(codes))
            else:
                missing.append(row["id"])
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {len(missing)} without a valid topic", file=sys.stderr)
    for m in missing:
        print("  ", m, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
