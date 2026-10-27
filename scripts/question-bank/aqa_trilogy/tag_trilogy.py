"""Tag AQA's GCSE Combined Science: Trilogy parts to the specification's topics.

    python3 scripts/question-bank/aqa_trilogy/tag_trilogy.py split [work-dir]   # default scripts/question-bank/.work-gcse-trilogy
    python3 scripts/question-bank/aqa_trilogy/tag_trilogy.py merge [work-dir]

tag_batches.py's GCSE way, for Trilogy's numbering (4 Biology, 5 Chemistry, 6 Physics):
AQA's schemes print each row's specification reference ("AO1 5.2.3.3"), the board's own
tag, read from the part's own row only (refs.json). split writes the parts with no
reference to <work-dir>/tag/batch-NN.jsonl, with topics.txt to choose from; whoever tags
them writes batch-NN.answers.json ({"<part id>": ["5.2.1"]}, one to two codes, main
first, following tag.md). merge joins both into <work-dir>/tags.json.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work-gcse-trilogy")
TAG = os.path.join(WORK, "tag")
SIZE = 200


def topics():
    return json.load(open(os.path.join(WORK, "spec.json")))["8464"]


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def scheme_refs(parts, valid):
    """{part id: ["5.2.3"]} from the references in the part's own scheme row."""
    labels, out = {}, {}
    for p in parts:
        labels.setdefault(p["set"], set()).update({p["label"], p["label"].lstrip("0")})
    for p in parts:
        ms, label = p.get("msText", ""), p["label"]
        at = ms.find(label) if label in ms else ms.find(label.lstrip("0"))
        if at < 0:
            continue
        rest = ms[at + len(label):]
        ends = [m.start() for m in re.finditer(r"(?<![\d.])(\d{1,2}\.\d{1,2})(?![\d.])", rest)
                if m.group(1) in labels[p["set"]] and m.group(1) not in (label, label.lstrip("0"))]
        row = rest[:min(ends)] if ends else rest
        codes = [c for c in dict.fromkeys(re.findall(r"(?<![\d.])([456]\.\d{1,2}\.\d{1,2})", row)) if c in valid]
        if codes:
            out[p["id"]] = codes[:2]
    return out


def split():
    os.makedirs(TAG, exist_ok=True)
    nodes = topics()
    valid = {n["code"] for n in nodes if n["level"] == 2}
    open(os.path.join(TAG, "topics.txt"), "w").write("\n".join(
        f"{n['code']} {n['title']}" + (f" — {clip(n['text'], 220)}" if n["level"] == 2 else "") for n in nodes if n["level"] <= 2) + "\n")
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["series"] != "SPEC"]
    refs = scheme_refs(parts, valid)
    json.dump(refs, open(os.path.join(TAG, "refs.json"), "w"), indent=0)
    rest = [p for p in parts if p["id"] not in refs]
    n = 0
    for i in range(0, len(rest), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}.jsonl"), "w") as f:
            for p in rest[i:i + SIZE]:
                science = {"B": "Biology", "C": "Chemistry", "P": "Physics"}[p["component"][4]]
                f.write(json.dumps({"id": p["id"], "science": science, "question": clip(p["text"], 420),
                                    "scheme": clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{len(refs)} of {len(parts)} parts tagged by their scheme's reference; {len(rest)} in {n} batches", file=sys.stderr)


def merge():
    valid = {n["code"] for n in topics() if n["level"] == 2}
    tags = json.load(open(os.path.join(TAG, "refs.json")))
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.answers.json"))):
        for pid, codes in json.load(open(path)).items():
            good = [c for c in codes if c in valid]
            if good:
                tags[pid] = good[:2]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged", file=sys.stderr)


if __name__ == "__main__":
    {"split": split, "merge": merge}[mode]()
