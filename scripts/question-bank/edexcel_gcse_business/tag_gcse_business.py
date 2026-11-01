"""Split the cut Edexcel GCSE Business parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_gcse_business/tag_gcse_business.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_gcse_business/tag_gcse_business.py merge [work-dir]

split writes <work-dir>/tag/business-topics.txt and <work-dir>/tag/batch-NN-business.jsonl, one part per
line with the codes it may take first ("first"), and each batch is tagged following ../tag.md's
"Edexcel GCSE Business" section into batch-NN-business.tags.json. merge writes <work-dir>/tags.json.

Paper 1 tests Theme 1, Investigating small business, so its parts take a Theme 1 sub-topic (1.x.x) first.
Paper 2 tests Theme 2, Building a business, on the knowledge Theme 1 gives: a Theme 2 sub-topic first,
and a second code from either theme.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-gcse-business")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 130
TAG = os.path.join(WORK, "tag")


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["1BS0"]
    return parts, tree


def first(p, codes):
    """The codes a part may take first: its paper's theme."""
    return [c for c in codes if c.startswith(p["component"][-1] + ".")]


def own(text, label):
    """The part's own words, and what comes before them."""
    sub = re.findall(r"\(([a-z]+)\)", label)
    for tok in reversed(sub):
        m = re.search(r"\(" + tok + r"\)\s+(.*)", text)
        if m:
            return text[:m.start()], m.group(1)
    return "", text


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    codes = [t["code"] for t in tree["topics"]]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {sections[t['section']]} | {t['title']} — {clip(t['text'], 420)}" for t in tree["topics"]]
    open(os.path.join(TAG, "business-topics.txt"), "w").write("\n".join(lines) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    parts.sort(key=lambda p: (p["component"], p["id"]))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-business.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                setup, question = own(p["text"], p["label"])
                # (a case study's part carries the extract after its own words: that is setup, not the question)
                question, _, case = question.partition(" Read the following extract")
                question, _, booklet = question.partition(" In the Source Booklet")
                q = int(p["question"])
                f.write(json.dumps({"id": p["id"], "paper": f"Paper {p['component'][-1]} Section {'A' if q <= 3 else 'B' if q <= 6 else 'C'}",
                                    "label": p["label"], "marks": p["marks"], "first": first(p, codes),
                                    "question": clip(question, 500), "setup": clip(setup + " " + case + booklet, 300),
                                    "scheme": clip(p.get("msText", ""), 500)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of up to {SIZE} in {TAG}", file=sys.stderr)


def merge():
    parts, tree = load()
    codes = [t["code"] for t in tree["topics"]]
    by_id = {p["id"]: p for p in parts}
    tags, problems = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            got_codes = got.get(pid, [])
            if not got_codes or got_codes[0] not in first(by_id[pid], codes):
                problems.append(f"{pid}: {got_codes}")
                continue
            tags[pid] = [got_codes[0]] + [c for c in got_codes[1:2] if c in codes and c != got_codes[0]]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} of {len(parts)} tagged; {len(problems)} problems", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
