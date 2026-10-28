"""Split the cut GCSE Maths questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/gcse_maths/tag_gcse_maths.py split [batch-size]
    python3 scripts/question-bank/gcse_maths/tag_gcse_maths.py merge
    # reads scripts/question-bank/.work/gcse-maths/<board>/parts.json for aqa, edexcel and ocr

tag_maths.py's sibling for the three GCSE Maths Higher banks; the brief is tag.md's,
with its GCSE Maths section. split writes .work/gcse-maths/tag/gcse-maths-topics.txt
(one line per DfE statement, N1 to S6, with its area and what the specification says)
and batch-NN-gcse-maths.jsonl, one whole question per line with its board and paper,
its words, the start of its scheme and the path of its crop (the papers' maths fonts
can come out garbled as text); each batch is tagged into batch-NN-gcse-maths.tags.json,
and merge collects them into <board>/tags.json for build_gcse_maths.py.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 110
WORK = os.path.abspath(os.path.join(HERE, "..", ".work", "gcse-maths"))
TAG = os.path.join(WORK, "tag")
BOARDS = ("aqa", "edexcel", "ocr")
NOISE = re.compile(r"Do not write outside the box|Turn over ►?|Question \d+ continues on the next page|DO NOT WRITE IN THIS AREA|\.{4,}|_{4,}", re.I)
# Which paper allows a calculator: AQA and Pearson Papers 2 and 3, OCR Papers 4 and 6.
CALCULATOR = {"83002H", "83003H", "1ma12h", "1ma13h", "j56004", "j56006"}


def clip(s, n):
    s = re.sub(r"\s+", " ", NOISE.sub(" ", s or "")).strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def paper(board, comp):
    name = {"aqa": f"AQA Paper {comp[4]}H", "edexcel": f"Edexcel Paper {comp[4]}H", "ocr": f"OCR Paper {comp[-1]}"}[board]
    return f"{name} ({'calculator' if comp in CALCULATOR else 'non-calculator'})"


def split():
    os.makedirs(TAG, exist_ok=True)
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    names = {s["code"]: s["title"] for s in spec["sections"]}
    lines = [f"{t['code']} | {names[t['section']]} | {t['title']} — {clip(t['text'], 600)}" for t in spec["topics"]]
    open(os.path.join(TAG, "gcse-maths-topics.txt"), "w").write("\n".join(lines) + "\n")
    rows = []
    for board in BOARDS:
        for p in json.load(open(os.path.join(WORK, board, "parts.json"))):
            if p.get("qp"):
                rows.append({"id": p["id"], "paper": paper(board, p["component"]), "marks": p["marks"],
                             "question": clip(p["text"], 1200), "scheme": clip(p.get("msText", ""), 500),
                             "image": os.path.join(WORK, board, "img", p["qp"])})
    n = 0
    for i in range(0, len(rows), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-gcse-maths.jsonl"), "w") as f:
            for r in rows[i:i + SIZE]:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(rows)} questions in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(WORK, "spec.json")))["topics"]}
    tags, missing = {b: {} for b in BOARDS}, []
    prefix = {"8300": "aqa", "1ma1": "edexcel", "j560": "ocr"}
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = list(dict.fromkeys(c for c in got.get(pid, []) if c in valid))[:3]
            if codes:
                tags[prefix[pid[:4]]][pid] = codes
            else:
                missing.append(pid)
    for b in BOARDS:
        json.dump(tags[b], open(os.path.join(WORK, b, "tags.json"), "w"), indent=0)
    print(f"{sum(len(t) for t in tags.values())} questions tagged, {len(missing)} without a valid topic {missing[:10]}", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
