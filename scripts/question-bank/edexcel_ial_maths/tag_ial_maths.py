"""Split the cut International A Level Maths and Further Maths questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_ial_maths/tag_ial_maths.py split [batch-size]
    python3 scripts/question-bank/edexcel_ial_maths/tag_ial_maths.py merge
    # reads scripts/question-bank/.work/edexcel-ial-maths/parts.json and ial_maths_topics.json

tag_igcse_maths.py for the IAL units; the brief is tag.md's, with its International A Level Maths section. split
writes .work/edexcel-ial-maths/tag/ial-maths-topics.txt (one line per unit topic, P1.1 to D1.5) and
batch-NN-ial-maths.jsonl, one whole question per line with its unit, the topic codes it may take (its own unit's),
its words, the start of its scheme and the path of its crop; each batch is tagged into batch-NN-ial-maths.tags.json,
and merge collects them into tags.json for build_ial_maths.py, keeping only a question's own unit's codes. A unit
both banks count is tagged once.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 120
WORK = os.path.abspath(os.path.join(HERE, "..", ".work", "edexcel-ial-maths"))
TAG = os.path.join(WORK, "tag")
NOISE = re.compile(r"DO NOT WRITE IN THIS AREA|Leave blank|Turn over|\.{4,}|_{4,}", re.I)


def units():
    return {u["code"]: u for u in json.load(open(os.path.join(HERE, "ial_maths_topics.json")))["units"]}


def clip(s, n):
    s = re.sub(r"\s+", " ", NOISE.sub(" ", s or "")).strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(TAG, exist_ok=True)
    us = units()
    lines = [f"{t['code']} | {u['name']} ({u['unit']}) | {t['title']}" for u in us.values() for t in u["topics"]]
    open(os.path.join(TAG, "ial-maths-topics.txt"), "w").write("\n".join(lines) + "\n")
    rows = []
    for p in json.load(open(os.path.join(WORK, "parts.json"))):
        if p.get("qp"):
            u = us[p["component"]]
            rows.append({"id": p["id"], "unit": f"{u['name']} ({u['unit']})", "topics": [f"{t['code']} {t['title']}" for t in u["topics"]],
                         "marks": p["marks"], "question": clip(p["text"], 1200), "scheme": clip(p.get("msText", ""), 500),
                         "image": os.path.join(WORK, "img", p["qp"])})
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    n = 0
    for i in range(0, len(rows), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-ial-maths.jsonl"), "w") as f:
            for r in rows[i:i + SIZE]:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(rows)} questions in {TAG}", file=sys.stderr)


def merge():
    us = units()
    own = {c: {t["code"] for t in u["topics"]} for c, u in us.items()}
    tags, missing = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = list(dict.fromkeys(c for c in got.get(pid, []) if c in own[pid.split("-")[0].upper()]))[:2]
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {len(missing)} without a valid topic {missing[:10]}", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
