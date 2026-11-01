"""Split the cut Religious Studies parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_rs/tag_rs.py split [work-dir]
    python3 scripts/question-bank/aqa_rs/tag_rs.py merge [work-dir]

tag_philosophy.py for AQA Religious Studies; the brief is tag.md's, with its AQA Religious
Studies section. split writes <work-dir>/tag/rs-<area>-topics.txt and batch-<area>.jsonl,
one batch per area a part can be on: 1A (Paper 1 questions 01-02, Philosophy of religion),
1B (Paper 1 questions 03-04, Ethics and religion), and A-E (Paper 2, one per religion).
A Paper 2 batch's topics file lists its religion's topics and Paper 1's, since a dialogue
essay (questions 03-06) is tagged to its dialogue and the Paper 1 topic it debates. Each
batch is tagged into batch-<area>.tags.json, and merge collects them into
<work-dir>/tags.json for build_rs.py, keeping only codes from the batch's own file.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-rs")
TAG = os.path.join(WORK, "tag")


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def area_of(p):
    if p["component"] == "70621":
        return "1A" if p["question"] in ("01", "02") else "1B"
    return p["component"][-1]


def choices(tree, area):
    """The topic codes a part on this area may take."""
    own = [t for t in tree["topics"] if t["section"] == area]
    return own + ([t for t in tree["topics"] if t["section"] in ("1A", "1B")] if area not in ("1A", "1B") else [])


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7062"]
    names = {s["code"]: s["title"] for s in tree["sections"]}
    batches = {}
    for p in parts:
        batches.setdefault(area_of(p), []).append(p)
    for area, ps in sorted(batches.items()):
        lines = [f"{t['code']} | {names[t['section']]} | {t['title']} — {clip(t['text'], 600)}" for t in choices(tree, area)]
        open(os.path.join(TAG, f"rs-{area}-topics.txt"), "w").write("\n".join(lines) + "\n")
        with open(os.path.join(TAG, f"batch-{area}.jsonl"), "w") as f:
            for p in ps:
                kind = "dialogue" if p["component"] != "70621" and p["question"] >= "03" else "knowledge" if p["part"] == "1" else "evaluation"
                f.write(json.dumps({"id": p["id"], "area": f"{area} {names[area]}", "kind": kind, "marks": p["marks"],
                                    "question": clip(re.sub(r"^[\d\s.]+|\[\d+ marks?\]", "", p["text"]), 400),
                                    "scheme": clip(re.sub(r"^.*?indicative rather than prescriptive.*?levels of response\.", "", p.get("msText", "")), 300)},
                                   ensure_ascii=False) + "\n")
    print(f"{len(batches)} batches of {len(parts)} parts in {TAG}", file=sys.stderr)


def merge():
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7062"]
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        area = re.search(r"batch-(\w+)\.jsonl", path).group(1)
        valid = {t["code"] for t in choices(tree, area)}
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
