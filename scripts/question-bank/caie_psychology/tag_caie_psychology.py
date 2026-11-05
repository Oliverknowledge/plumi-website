"""Split the cut CAIE Psychology parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/caie_psychology/tag_caie_psychology.py split [work-dir]
    python3 scripts/question-bank/caie_psychology/tag_caie_psychology.py merge [work-dir]
    # work-dir: .work/caie-psychology

split writes <work-dir>/tag/topics.txt (each topic's code, its section and the syllabus's words for it) and
<work-dir>/tag/batch-NN.jsonl, one part per line with the `sections` it may be tagged to; each batch is tagged
into batch-NN.answers.json ({"<part id>": ["1.1", "7.5"], ...}, one or two codes, the main one first), following
tag/caie-a-level-psychology.md, and merge collects them into <work-dir>/tags.json for build_caie_psychology.py.

What each paper may take (the syllabus is by section, and the papers' own content):
  AS Papers 1 and 2: sections 1-7 (core studies, issues and debates, research methods, methodological concepts).
  A Level Papers 3 and 4: the part's option's own section first (a Clinical question is A1-A5, never a Health
  topic), and a second code from sections 5-7 or the option's own: the issue, method or concept it also tests.
merge refuses any answer that breaks that.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "caie-psychology")
TAG = os.path.join(WORK, "tag")
SIZE = 85
LETTER = {"clinical": "A", "consumer": "B", "health": "C", "organisational": "D"}
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip, own  # noqa: E402

BOILER = re.compile(r"© UCLES \d{4}|\d{4}/\d{2}/[A-Z/]+/\d{2}|\[Turn over|\.{6,}|…{3,}")


def paper_of(part):
    num = part["component"][4:]
    return num[1] if num.startswith("0") else num[0]


def allowed(part):
    """Sections a part's codes may come from: (first code's, second code's)."""
    if paper_of(part) in ("1", "2"):
        return ["1", "2", "3", "4", "5", "6", "7"], ["1", "2", "3", "4", "5", "6", "7"]
    own_section = LETTER[part["option"]]
    return [own_section], [own_section, "5", "6", "7"]


def split():
    os.makedirs(TAG, exist_ok=True)
    spec = json.load(open(os.path.join(WORK, "spec.json")))["9990"]
    secs = {s["code"]: s["title"] for s in spec["sections"]}
    open(os.path.join(TAG, "topics.txt"), "w").write("\n".join(
        f"{t['code']} | {t['section']} {secs[t['section']]} | {t['title']}{' [A Level only]' if t['year'] == 2 else ' [AS]'} — {clip(t['text'], 3000)}"
        for t in spec["topics"]) + "\n")
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                setup, question = own(BOILER.sub(" ", p["text"]), p["label"])
                first, second = allowed(p)
                f.write(json.dumps({"id": p["id"], "paper": p.get("paperTitle", "") or p["set"], "marks": p["marks"],
                                    **({"option": p["option"]} if p.get("option") else {}),
                                    "first_code_from_sections": first, "second_code_from_sections": second,
                                    "setup": clip(setup, 260), "question": clip(question, 420),
                                    "scheme": clip(p.get("msText", ""), 240)}, ensure_ascii=False) + "\n")
    print(f"{len(parts)} parts in {n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = json.load(open(os.path.join(WORK, "spec.json")))["9990"]
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
            first, second = allowed(parts[pid])
            if valid[codes[0]] not in first or any(valid[c] not in second for c in codes[1:]):
                refused.append((pid, codes, first, second))
                continue
            tags[pid] = codes
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} with no answer, {len(refused)} refused", file=sys.stderr)
    for r in refused[:20]:
        print("  refused", r, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
