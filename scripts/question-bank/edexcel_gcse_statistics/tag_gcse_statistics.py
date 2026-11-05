"""Split the cut Edexcel GCSE Statistics questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_gcse_statistics/tag_gcse_statistics.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_gcse_statistics/tag_gcse_statistics.py merge [work-dir]

split writes <work-dir>/tag/statistics-topics.txt (one line per topic: `code | area | title — the specification's
statements and guidance`) and batch-NN-statistics.jsonl, one whole question per line with its paper, its words, the
start of its scheme and the path of its crop (the papers' tables and graphs, and the maths in them, can come out garbled
as text, so read the crop where the words don't say); each batch is tagged into batch-NN-statistics.tags.json following
tag/edexcel-gcse-statistics.md, and merge collects them into <work-dir>/tags.json for build_gcse_statistics.py.
split leaves out the questions tags.json already has, numbering its batches on from the last.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-gcse-statistics")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 60
TAG = os.path.join(WORK, "tag")
NOISE = re.compile(r"DO NOT WRITE IN THIS AREA|Turn over|\.{4,}|_{4,}|P\d{5}[A-Z]{1,2}\d*", re.I)


def clip(s, n):
    s = re.sub(r"\s+", " ", NOISE.sub(" ", s or "")).strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load_spec():
    return json.load(open(os.path.join(WORK, "spec.json")))["1ST0"]


def split():
    os.makedirs(TAG, exist_ok=True)
    spec = load_spec()
    names = {s["code"]: s["title"] for s in spec["sections"]}
    lines = [f"{t['code']} | {names[t['section']]} | {t['title']} — {clip(t['text'], 3000)}" for t in spec["topics"]]
    open(os.path.join(TAG, "statistics-topics.txt"), "w").write("\n".join(lines) + "\n")
    path = os.path.join(WORK, "tags.json")
    done = json.load(open(path)) if os.path.exists(path) else {}
    rows = []
    for p in sorted(json.load(open(os.path.join(WORK, "parts.json"))), key=lambda p: (p["component"], p["series"], p["id"])):
        if p.get("qp") and p["id"] not in done:
            tier = "Higher" if p["component"][-1] in "hH" else "Foundation"
            rows.append({"id": p["id"], "paper": f"Paper {p['component'][4]} {tier}", "marks": p["marks"],
                         "question": clip(p["text"], 1200), "scheme": clip(p.get("msText", ""), 500),
                         "image": os.path.join(WORK, "img", p["qp"])})
    n = max([int(re.match(r"batch-(\d+)", os.path.basename(f)).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(rows), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-statistics.jsonl"), "w") as f:
            for r in rows[i:i + SIZE]:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"batches {first} to {n}: {len(rows)} questions in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in load_spec()["topics"]}
    path = os.path.join(WORK, "tags.json")
    tags = json.load(open(path)) if os.path.exists(path) else {}  # what's tagged already stays (a batch's answers win)
    missing = []
    for batch in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = batch.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(batch):
            pid = json.loads(line)["id"]
            codes = list(dict.fromkeys(c for c in got.get(pid, []) if c in valid))[:3]
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    json.dump(tags, open(path, "w"), indent=0)
    print(f"{len(tags)} questions tagged, {len(missing)} without a valid topic {missing[:10]}", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
