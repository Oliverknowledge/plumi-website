"""Split the cut Computer Science parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/computer_science/tag_cs.py split [batch-size]
    python3 scripts/question-bank/computer_science/tag_cs.py merge

tag_ocr.py's sibling for OCR's (.work/ocr-cs) and AQA's (.work/aqa-cs) Computer Science;
the brief is tag.md's, with its Computer Science section. split writes, in each work
dir, tag/cs-topics.txt and batch-NN-cs.jsonl; each batch is tagged into
batch-NN-cs.tags.json, and merge collects them into <work-dir>/tags.json for build_cs.py.
A part already in tags.json isn't batched again, and new batches number on from the old
ones, so a later series (OCR's older ones, added from PMT) is tagged on its own.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 150
BOARDS = {"ocr-cs": ("H446", ("H046",)), "aqa-cs": ("7517", ("7516",))}
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, os.path.join(HERE, ".."))
from tag_pearson import clip, own  # noqa: E402
from build_bank import own_text  # noqa: E402

NOISE = re.compile(r"© OCR \d{4}|\.{6,}|Turn over ►?|Do not write outside the box|Question \d+ continues on the next page|Copy the contents of[^.]*\.", re.I)


def split():
    for work, (spec, as_specs) in BOARDS.items():
        d = os.path.join(HERE, "..", ".work", work)
        if not os.path.isdir(d):
            continue
        tag = os.path.join(d, "tag")
        os.makedirs(tag, exist_ok=True)
        tree = json.load(open(os.path.join(d, "spec.json")))[spec]
        sections = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {t['section']} {sections[t['section']]} | {t['title']}" + (" [AS]" if t["year"] == 1 else " [A-Level only]")
                 + f" — {clip(t['text'], 600)}" for t in tree["topics"]]
        open(os.path.join(tag, "cs-topics.txt"), "w").write("\n".join(lines) + "\n")
        done = json.load(open(os.path.join(d, "tags.json"))) if os.path.exists(os.path.join(d, "tags.json")) else {}
        parts = [p for p in json.load(open(os.path.join(d, "parts.json"))) if p.get("qp") and p["id"] not in done]
        n = max([int(re.search(r"batch-(\d+)-cs", f).group(1)) for f in glob.glob(os.path.join(tag, "batch-*-cs.jsonl"))] or [0])
        first = n + 1
        for i in range(0, len(parts), SIZE):
            n += 1
            with open(os.path.join(tag, f"batch-{n:02d}-cs.jsonl"), "w") as f:
                for p in parts[i:i + SIZE]:
                    text = NOISE.sub(" ", p["text"])
                    if work == "aqa-cs":
                        question = own_text(text, p["label"])
                        setup = text[:max(0, text.find(question[:40]))] if question[:40] in text else ""
                    else:
                        setup, question = own(text, p["label"])
                    paper = ("AS " if p["spec"].upper() in as_specs else "A-Level ") + str(int(p["component"][-2:] if work == "ocr-cs" else p["component"][-1]))
                    f.write(json.dumps({"id": p["id"], "paper": paper, "setup": clip(setup, 300), "question": clip(question, 500),
                                        "scheme": clip(p.get("msText", ""), 300)}, ensure_ascii=False) + "\n")
        print(f"{work}: batches {first}-{n} for {len(parts)} parts not yet tagged, in {tag}", file=sys.stderr)


def merge():
    for work, (spec, _) in BOARDS.items():
        d = os.path.join(HERE, "..", ".work", work)
        if not os.path.isdir(d):
            continue
        valid = {t["code"] for t in json.load(open(os.path.join(d, "spec.json")))[spec]["topics"]}
        tags, missing = {}, 0
        for path in sorted(glob.glob(os.path.join(d, "tag", "batch-*.jsonl"))):
            out = path.replace(".jsonl", ".tags.json")
            got = json.load(open(out)) if os.path.exists(out) else {}
            for line in open(path):
                pid = json.loads(line)["id"]
                codes = [c for c in got.get(pid, []) if c in valid][:2]
                if codes:
                    tags[pid] = codes
                else:
                    missing += 1
        overrides = os.path.join(d, "tag", "overrides.json")
        if os.path.exists(overrides):
            tags.update(json.load(open(overrides)))
        json.dump(tags, open(os.path.join(d, "tags.json"), "w"), indent=0)
        print(f"{work}: {len(tags)} parts tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
