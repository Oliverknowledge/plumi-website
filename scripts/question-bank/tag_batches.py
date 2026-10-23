"""Split the cut parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/tag_batches.py split [work-dir] [batch-size]
    python3 scripts/question-bank/tag_batches.py merge [work-dir]

split writes <work-dir>/tag/<subject>-topics.txt (the spec's topics, one per
line) and <work-dir>/tag/batch-NN.jsonl, one part per line: its id, the start of
its question, its own words and the start of its mark scheme. Each batch is then
tagged (see tag.md) into batch-NN.tags.json: {"<part id>": ["3.2.2"], ...}.
merge combines them into <work-dir>/tags.json for build_bank.py, dropping any
code that is not a topic of that part's specification.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, ".work")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
TAG = os.path.join(WORK, "tag")
SUBJECT = {"7401": "biology", "7402": "biology", "7404": "chemistry", "7405": "chemistry", "7407": "physics", "7408": "physics"}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    for code, subject in (("7402", "biology"), ("7405", "chemistry"), ("7408", "physics")):
        lines = [f"{n['code']} {n['title']}" + (f" — {clip(n['text'], 160)}" if n["level"] == 2 else "")
                 for n in spec[code] if n["level"] <= 2]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
    n = 0
    for subject in ("biology", "chemistry", "physics"):
        mine = [p for p in parts if SUBJECT.get(p["spec"]) == subject and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    q, _, part = p["label"].partition(".")
                    own = p["text"]
                    m = re.search(r"\s*".join(q) + (r"\s*\.\s*" + r"\s*".join(part) if part else "") + r"\s+(.*)", own)
                    setup = own[: m.start()] if m and part else ""
                    f.write(json.dumps({"id": p["id"], "setup": clip(setup, 160), "question": clip(m.group(1) if m else own, 320),
                                        "scheme": clip(p.get("msText", ""), 160)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        ids = [json.loads(line)["id"] for line in open(path)]
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for pid in ids:
            valid = {n["code"] for n in spec[pid[:4]] if n["level"] == 2}
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    # Hand corrections, applied last: {"<part id>": ["3.6.2"]}.
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        for pid, codes in json.load(open(overrides)).items():
            tags[pid] = codes
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
