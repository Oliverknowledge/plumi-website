"""Split the cut Politics parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_politics/tag_politics.py split [work-dir]
    python3 scripts/question-bank/edexcel_politics/tag_politics.py merge [work-dir]

split writes <work-dir>/tag/topics.txt (each topic's code, its area and what the specification
says under it) and <work-dir>/tag/batch-NN.jsonl, one part per line with the `sections` it may be
tagged to, read off its paper and question: a paper only examines its own areas.
  AS Paper 1: UKP (UK Politics). AS Paper 2: UKG (UK Government).
  A-Level Paper 1: Questions 1 and 2 UKP, Question 3 CPI (core ideas).
  Paper 2: Questions 1 and 2 UKG, Questions 3 to 7 NPI (one non-core idea each).
  Paper 3A: USA. Paper 3B: GLO.
Each batch is tagged following ../tag.md's "Edexcel Politics" section into batch-NN.answers.json,
{"<part id>": ["UKP.1"], ...}. merge writes <work-dir>/tags.json, refusing a code outside the part's sections.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-politics")
TAG = os.path.join(WORK, "tag")
SIZE = 150


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def allowed(p):
    paper, q = p["set"].split("-")[0], int(p["question"])
    return {"8pl001": ["UKP"], "8pl002": ["UKG"], "9pl03a": ["USA"], "9pl03b": ["GLO"],
            "9pl001": ["UKP"] if q <= 2 else ["CPI"], "9pl002": ["UKG"] if q <= 2 else ["NPI"]}[paper]


def split():
    os.makedirs(TAG, exist_ok=True)
    spec = json.load(open(os.path.join(WORK, "spec.json")))["9PL0"]
    secs = {s["code"]: s["title"] for s in spec["sections"]}
    open(os.path.join(TAG, "topics.txt"), "w").write("\n".join(
        f"{t['code']} | {secs[t['section']]} | {t['title']} — {clip(t['text'], 300)}" for t in spec["topics"]) + "\n")
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                f.write(json.dumps({"id": p["id"], "marks": p["marks"], "sections": allowed(p),
                                    "question": clip(p["text"], 600), "scheme": clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{len(parts)} parts in {n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = json.load(open(os.path.join(WORK, "spec.json")))["9PL0"]
    valid = {t["code"]: t["section"] for t in spec["topics"]}
    parts = {p["id"]: p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")}
    tags, refused, missing = {}, [], 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        ans_path = path.replace(".jsonl", ".answers.json")
        got = json.load(open(ans_path)) if os.path.exists(ans_path) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if not codes:
                missing += 1
                continue
            if any(valid[c] not in allowed(parts[pid]) for c in codes):
                refused.append((pid, codes))
                continue
            tags[pid] = codes
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} with no answer, {len(refused)} refused", file=sys.stderr)
    for r in refused[:20]:
        print("  refused", r, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
