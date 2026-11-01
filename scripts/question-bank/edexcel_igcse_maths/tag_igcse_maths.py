"""Split the cut International GCSE Maths A (4MA1) questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_igcse_maths/tag_igcse_maths.py split [batch-size]
    python3 scripts/question-bank/edexcel_igcse_maths/tag_igcse_maths.py merge
    # reads scripts/question-bank/.work/edexcel-igcse-maths/{parts,spec}.json

tag_gcse_maths.py for 4MA1; the brief is tag.md's, with its International GCSE Maths section. split writes
.work/edexcel-igcse-maths/tag/igcse-maths-topics.txt (one line per specification topic, 1.1 to 6.3, with
its area and what the specification says) and batch-NN-igcse-maths.jsonl, one whole question per line with
its paper and tier, its words, the start of its scheme and the path of its crop; each batch is tagged into
batch-NN-igcse-maths.tags.json, and merge collects them into tags.json for build_igcse_maths.py. A Foundation
question its Higher paper prints too (tiers.json, tiers.py: run after a first build) isn't batched; merge gives it
its Higher twin's tags.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 110
WORK = os.path.abspath(os.path.join(HERE, "..", ".work", "edexcel-igcse-maths"))
TAG = os.path.join(WORK, "tag")
TIERS = os.path.join(HERE, "..", "..", "..", "public", "question-bank", "edexcel-igcse-maths", "tiers.json")
NOISE = re.compile(r"DO NOT WRITE IN THIS AREA|Turn over|\.{4,}|_{4,}", re.I)


def twins():
    return json.load(open(TIERS)) if os.path.exists(TIERS) else {}


def clip(s, n):
    s = re.sub(r"\s+", " ", NOISE.sub(" ", s or "")).strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(TAG, exist_ok=True)
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    names = {s["code"]: s["title"] for s in spec["sections"]}
    lines = [f"{t['code']} | {names[t['section']]} | {t['title']} — {clip(t['text'], 700)}" for t in spec["topics"]]
    open(os.path.join(TAG, "igcse-maths-topics.txt"), "w").write("\n".join(lines) + "\n")
    rows, twin = [], twins()
    for p in json.load(open(os.path.join(WORK, "parts.json"))):
        if p.get("qp") and p["id"] not in twin:
            c = p["component"]
            rows.append({"id": p["id"], "paper": f"Paper {c[4]} {'Higher' if c[5] == 'h' else 'Foundation'} tier (calculator)", "marks": p["marks"],
                         "question": clip(p["text"], 1200), "scheme": clip(p.get("msText", ""), 500),
                         "image": os.path.join(WORK, "img", p["qp"])})
    n = 0
    for i in range(0, len(rows), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-igcse-maths.jsonl"), "w") as f:
            for r in rows[i:i + SIZE]:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(rows)} questions in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(WORK, "spec.json")))["topics"]}
    tags, missing = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = list(dict.fromkeys(c for c in got.get(pid, []) if c in valid))[:3]
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    for f, h in twins().items():
        if h in tags:
            tags[f] = tags[h]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {len(missing)} without a valid topic {missing[:10]}", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
