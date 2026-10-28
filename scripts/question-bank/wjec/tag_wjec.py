"""Split the cut WJEC parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/wjec/tag_wjec.py split [work-dir] [batch-size]
    python3 scripts/question-bank/wjec/tag_wjec.py merge [work-dir]
    # work-dir: .work/wjec (cut_wjec.py's parts.json and parts-maths.json, spec_wjec.py's spec.json)

tag_ocr.py's sibling; the brief is tag.md's, with its WJEC section. split writes
<work-dir>/tag/<subject>-topics.txt and batch-NN-<subject>.jsonl; each batch is tagged
into batch-NN-<subject>.tags.json, and merge collects them into <work-dir>/tags.json
for build_wjec.py.

The sciences are tagged part by part. WJEC's units are its papers, so an AS paper's part
only takes topics of its own unit (a Unit 1 part 1.x); the A2 papers draw on the AS
units too, so take any. Unit 4's option questions are tagged without a reader: every
part of "Option B – Medical Physics" is topic 4.B, the option's only one. Maths is
tagged a whole question at a time against the Edexcel maths bank's topics
(edexcel_topics.json), as the OCR and CAIE maths banks are.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "wjec")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 200
TAG = os.path.join(WORK, "tag")
SUBJECTS = {"400": "biology", "410": "chemistry", "420": "physics", "300": "maths", "510": "business"}
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip, own  # noqa: E402
sys.path.insert(0, os.path.join(HERE, "..", "ocr"))
from maths_ocr import topic_lists  # noqa: E402

BOILER = re.compile(r"© WJEC CBAC Ltd\.?|\([12]\d{3}U\d0-\d\)|Turn over\.?|Examiner only|\.{6,}|…{3,}|\x08", re.I)
OPTION = re.compile(r"^\s*Option\s+([A-F])\s*[–:-]")


def subject(part):
    return SUBJECTS[part["component"][1:4]]


def unit(part):
    """'2420u10' -> '1'."""
    return part["component"][5]


def option(part):
    m = OPTION.match(part["text"])
    return f"4.{m.group(1)}" if unit(part) == "4" and m else None


def parts():
    out = []
    for name in ("parts.json", "parts-maths.json"):
        path = os.path.join(WORK, name)
        out += [p for p in json.load(open(path)) if p.get("qp")] if os.path.exists(path) else []
    return out


def trees():
    spec = json.load(open(os.path.join(WORK, "spec.json")))  # Business's own work dir: spec_wjec_business.py's
    spec["maths"] = topic_lists()["maths"]
    return spec


def split():
    os.makedirs(TAG, exist_ok=True)
    spec, everything = trees(), parts()
    n = 0
    for subj, tree in spec.items():
        names = {s["code"]: s["title"] for s in tree["sections"]}
        lines = [f"{t['code']} | {names[t['section']]} | {t['title']}"
                 + ({1: " [AS]", 2: " [A2]", 3: " [A2 option]"}.get(t.get("year"), "")) + f" — {clip(t['text'], 420)}"
                 for t in tree["topics"]]
        open(os.path.join(TAG, f"{subj}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in everything if subject(p) == subj and not option(p)]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subj}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    words = BOILER.sub(" ", p["text"])
                    paper = f"{'AS' if unit(p) in '12' else 'A2'} Unit {unit(p)}"
                    if subj == "maths":
                        row = {"id": p["id"], "paper": f"{paper}: {p['paperTitle'].split(':')[-1].strip()}",
                               "question": clip(words, 700), "scheme": clip(p.get("msText", ""), 300)}
                    else:
                        setup, question = own(words, p["label"])
                        row = {"id": p["id"], "paper": paper, "setup": clip(setup, 200), "question": clip(question, 360),
                               "scheme": clip(p.get("msText", ""), 200)}
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = trees()
    tags, missing = {}, 0
    for p in parts():
        if option(p):
            tags[p["id"]] = [option(p)]
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        subj = re.search(r"batch-\d+-(\w+)\.jsonl$", path).group(1)
        topics = spec[subj]["topics"]
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            if pid in tags:
                continue  # an option's part, already its option's
            u = pid[5]
            # An AS paper tests its own unit; maths and the A2 papers any topic (an option's only on its own paper).
            # (a topic's unit is its code's first number: Business's Unit 2 is four sections, "2.1 Marketing"…)
            valid = {t["code"] for t in topics if subj == "maths" or (t["code"].split(".")[0] == u if u in "12" else t.get("year") != 3)}
            codes = [c for c in got.get(pid, []) if c in valid][:3 if subj == "maths" else 2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
