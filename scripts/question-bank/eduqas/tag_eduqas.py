"""Split the cut Eduqas parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/eduqas/tag_eduqas.py split [work-dir] [batch-size] [--only=physics]
    python3 scripts/question-bank/eduqas/tag_eduqas.py merge [work-dir]
    python3 scripts/question-bank/eduqas/tag_eduqas.py apply <slug>

tag_ocr.py's sibling for Eduqas's specifications; the brief is tag.md's, with its Eduqas
section. split writes <work-dir>/tag/<subject>-topics.txt and batch-NN-<subject>.jsonl;
each batch is tagged into batch-NN-<subject>.tags.json, and merge collects them into
<work-dir>/tags.json for build_eduqas.py. An AS paper's part only takes an AS topic: merge
drops any other.

corrections.json holds tags put right after a bank went live, and merge keeps them. apply
puts them into a live bank without a rebuild: --pull it with upload_data.py, apply, upload.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
CORRECTIONS = os.path.join(HERE, "corrections.json")
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1].split(",") for a in sys.argv[1:] if a.startswith("--only=")), None)
mode = ARGS[0] if ARGS else "split"
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", "eduqas-sciences")
SIZE = int(ARGS[2]) if len(ARGS) > 2 else 240
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip, own  # noqa: E402

# Chemistry prints it without the colon. Options print it once per block, so a topic's words run from the first.
LEARNERS = re.compile(r"Learners should be able to demonstrate and apply their knowledge and understanding of:?")


def paper(p):
    return ("AS " if p["spec"].startswith("B") else "A-Level ") + p["component"][-2] + (f": {p['paperTitle']}" if p.get("paperTitle") else "")


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    n = len(glob.glob(os.path.join(TAG, "batch-*.jsonl")))
    for subject, tree in spec.items():
        if ONLY and subject not in ONLY:
            continue
        sections = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {sections[t['section']]} | {t['title']}"
                 + {1: " [AS]", 2: " [A-Level only]", 3: " [A-Level option]"}[t["year"]]
                 + f" — {clip(LEARNERS.split(t['text'], maxsplit=1)[-1], 3000)}" for t in tree["topics"]]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if p["subject"] == subject and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    setup, question = own(p["text"], p["label"])
                    f.write(json.dumps({"id": p["id"], "paper": paper(p), "setup": clip(setup, 220), "question": clip(question, 380),
                                        "scheme": clip(p.get("msText", ""), 220)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    tags, missing, dropped = {}, 0, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        subject = re.search(r"batch-\d+-(.+)\.jsonl$", path).group(1)
        topics = {t["code"]: t for t in spec[subject]["topics"]}
        got = json.load(open(path.replace(".jsonl", ".tags.json"))) if os.path.exists(path.replace(".jsonl", ".tags.json")) else {}
        for line in open(path):
            row = json.loads(line)
            codes = [c for c in got.get(row["id"], []) if c in topics]
            if row["paper"].startswith("AS "):
                ok = [c for c in codes if topics[c]["year"] == 1]
                dropped += len(codes) - len(ok)
                codes = ok
            codes = codes[:2]
            if codes:
                tags[row["id"]] = codes
            else:
                missing += 1
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    tags.update({k: v for k, v in json.load(open(CORRECTIONS)).items() if k in tags})
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic, {dropped} A-Level codes dropped from AS parts", file=sys.stderr)


def apply():
    corrections = json.load(open(CORRECTIONS))
    slug = ARGS[1]
    path = os.path.join(ROOT, "public", "question-bank", slug, "parts.json")
    meta_path = os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")
    rows, meta = json.load(open(path)), json.load(open(meta_path))
    topics = {t["code"]: t for t in meta["topics"]}
    for row in rows + meta["sample"]:
        codes = corrections.get(row["id"])
        if codes and row["t"] != codes:
            if row["p"].startswith("b") and any(topics[c]["year"] != 1 for c in codes):
                sys.exit(f"{row['id']}: an AS part only takes an AS topic")
            print(f"  {row['id']}: {', '.join(row['t'])} -> {', '.join(codes)}", file=sys.stderr)
            row["t"] = codes
    for t in meta["topics"]:
        t["count"] = sum(t["code"] in row["t"] for row in rows)
    json.dump(rows, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(meta, open(meta_path, "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    {"split": split, "merge": merge, "apply": apply}[mode]()
