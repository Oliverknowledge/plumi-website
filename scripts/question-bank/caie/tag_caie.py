"""Split the cut CAIE parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/caie/tag_caie.py split [work-dir] [batch-size]
    python3 scripts/question-bank/caie/tag_caie.py merge [work-dir]
    # work-dir: .work/caie-sciences (default), .work/caie-maths, .work/caie-igcse-sciences or .work/caie-igcse-maths

tag_ocr.py's sibling; the brief is tag.md's, with its CAIE section. split writes
<work-dir>/tag/<syllabus>-topics.txt and batch-NN-<syllabus>.jsonl; each batch is tagged
into batch-NN-<syllabus>.tags.json, and merge collects them into <work-dir>/tags.json
for build_caie.py.

The sciences are tagged part by part, maths a whole question at a time. Cambridge sets
its maths syllabus out by paper, so a maths question only takes topics of its own
paper's area (a Paper 3 question 3.x, never 1.x); merge holds every tag to that.

IGCSE maths (0580, 0606) is tagged a whole question at a time too, but by topic, not
paper. 0980's June 2024 papers (another variant of 0580's) are batched with 0580's and
take its topics; a Core paper (1 or 3) never takes a sub-topic marked Extended only.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "caie-sciences")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 200
TAG = os.path.join(WORK, "tag")
MATHS = ("9709", "9231")  # set out by paper
WHOLE = MATHS + ("0580", "0606")  # tagged a whole question at a time
SAME = {"0980": "0580"}  # a syllabus whose papers take another's topics


def syllabus(part):
    return SAME.get(part["spec"], part["spec"])
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip, own  # noqa: E402

BOILER = re.compile(r"© UCLES \d{4}|\d{4}/\d{2}/[A-Z/]+/\d{2}|\[Turn over|\.{6,}|…{3,}")


def paper_of(component):
    """'970931' -> '3'; a specimen's '970903' -> '3'."""
    num = component[4:]
    return num[1] if num.startswith("0") else num[0]


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    titles = {f["component"].replace("-", ""): f for f in json.load(open(os.path.join(WORK, "manifest.json"))) if f["kind"] == "qp"}
    n = 0
    for code, tree in spec.items():
        sections = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {t['section']} {sections[t['section']]} | {t['title']}"
                 + ("" if t["year"] == 0 else " [AS]" if t["year"] == 1 else " [A Level only]") + (" [Extended only]" if t.get("extended") else "")
                 + f" — {clip(t['text'].replace('Candidates should be able to:', ''), 420)}"
                 for t in tree["topics"]]
        open(os.path.join(TAG, f"{code}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if syllabus(p) == code and p.get("qp")]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{code}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    m = titles[p["component"]]
                    words = BOILER.sub(" ", p["text"])
                    if code in WHOLE:
                        row = {"id": p["id"], "paper": m["title"], **({"only": f"{paper_of(p['component'])}.x"} if code in MATHS else {}),
                               "question": clip(words, 700), "scheme": clip(p.get("msText", ""), 300)}
                    else:
                        setup, question = own(words, p["label"])
                        row = {"id": p["id"], "paper": ("" if code.startswith("0") else "AS " if m["as"] else "A Level ") + m["title"],
                               "setup": clip(setup, 200), "question": clip(question, 360), "scheme": clip(p.get("msText", ""), 200)}
                        if p.get("key"):
                            row["answer"] = p["key"]
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        code = re.search(r"batch-\d+-(\d{4})\.jsonl$", path).group(1)
        valid = {t["code"] for t in spec[code]["topics"]}
        extended = {t["code"] for t in spec[code]["topics"] if t.get("extended")}
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid]
            if code in MATHS:  # only the question's own paper's topics
                codes = [c for c in codes if c.split(".")[0] == paper_of(pid.split("-")[0])]
            if paper_of(pid.split("-")[0]) in ("1", "3") and extended:  # an IGCSE Core paper
                codes = [c for c in codes if c not in extended]
            codes = codes[:3 if code in WHOLE else 2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
