"""Split the cut Edexcel parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_sciences/tag_pearson.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_sciences/tag_pearson.py merge [work-dir]

As tag_batches.py, for Pearson's specifications. split writes
<work-dir>/tag/<subject>-topics.txt (each sub-topic's code, its topic, its title and
what the specification says under it) and <work-dir>/tag/batch-NN-<subject>.jsonl,
one part per line. Each batch is tagged following ../tag.md into
batch-NN-<subject>.tags.json: {"<part id>": ["6.B"], ...}. merge combines them into
<work-dir>/tags.json for build_pearson.py, dropping any code that is not a
sub-topic of that part's specification.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-sciences")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
TAG = os.path.join(WORK, "tag")
SUBJECTS = {"biology-a": ("8BN0", "9BN0"), "biology-b": ("8BI0", "9BI0"), "chemistry": ("8CH0", "9CH0"), "physics": ("8PH0", "9PH0")}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def own(text, label):
    sub = re.findall(r"\(([a-z]+)\)", label)
    for tok in reversed(sub):
        m = re.search(r"\(" + tok + r"\)\s+(.*)", text)
        if m:
            return text[: m.start()], m.group(1)
    return "", text


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    n = 0
    for subject, specs in SUBJECTS.items():
        tree = spec[specs[1]]
        titles = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {titles[t['section']]} | {(t['ref'] + ' ') if t['ref'] else ''}{t['title']}"
                 + (f" (statements {t['points']})" if t.get("points") else "")
                 + (" [AS]" if t["year"] == 1 else " [A-Level only]") + f" — {clip(t['text'].split('Students should:')[-1], 420)}"
                 for t in tree["topics"]]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if p["spec"] in specs and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    setup, question = own(p["text"], p["label"])
                    f.write(json.dumps({"id": p["id"], "paper": ("AS " if p["spec"].startswith("8") else "A-Level ") + p["component"][-1],
                                        "setup": clip(setup, 200), "question": clip(question, 360),
                                        "scheme": clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        subject = re.search(r"batch-\d+-(.+)\.jsonl$", path).group(1)
        valid = {t["code"] for t in spec[SUBJECTS[subject][1]]["topics"]}
        ids = [json.loads(line)["id"] for line in open(path)]
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for pid in ids:
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
