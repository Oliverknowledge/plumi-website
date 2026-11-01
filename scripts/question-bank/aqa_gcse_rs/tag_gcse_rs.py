"""Split the cut AQA GCSE Religious Studies A parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_rs/tag_gcse_rs.py split [work-dir]
    python3 scripts/question-bank/aqa_gcse_rs/tag_gcse_rs.py merge [work-dir]

eduqas_gcse/tag_eduqas_gcse.py for AQA: split writes <work-dir>/tag/topics-<section>.txt and
batch-<section>.jsonl, one batch per section of spec_gcse_rs.py's tree, and each batch is tagged
following ../tag.md's "AQA GCSE Religious Studies" section into batch-<section>.tags.json. merge
writes <work-dir>/tags.json. A part's section is fixed by its paper and question: Component 1's
question 1 is its religion's beliefs and teachings, question 2 its practices; 2A's questions 1-6
are themes A-F, and 2B's 7 and 8 themes G and H.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MODE = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-gcse-rs")
TAG = os.path.join(WORK, "tag")
RELIGION = {"806211": "BU", "806212": "CA", "806213": "CH", "806214": "HI", "806215": "IS", "806216": "JU", "806217": "SI"}


def section(p):
    """"CH1", "BU2", "TA", "TG"."""
    if p["component"] in RELIGION:
        return RELIGION[p["component"]] + str(int(p["question"]))
    return "T" + "ABCDEFGH"[int(p["question"]) - 1]


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def own(text):
    """The part's words, from its label ("0 1 . 3") to its marks."""
    m = re.search(r"0\s*\d\s*\.\s*\d\s+(.*)", text)
    words = m.group(1) if m else text
    marks = re.search(r"\[\d+ marks?\]", words)
    return clip(words[:marks.start()] if marks else words, 500)


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8062"]
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    for sec in tree["sections"]:
        code = sec["code"]
        topics = [t for t in tree["topics"] if t["section"] == code]
        open(os.path.join(TAG, f"topics-{code}.txt"), "w").write(
            "\n".join(f"{t['code']} | {sec['title']} | {t['title']} — {clip(t['text'], 700)}" for t in topics) + "\n")
        mine = sorted((p for p in parts if section(p) == code), key=lambda p: p["id"])
        with open(os.path.join(TAG, f"batch-{code}.jsonl"), "w") as f:
            for p in mine:
                scheme = re.sub(r"^.*?\[\d+ marks?\](\s*\[(Plus )?SPaG \d marks\])?", "", p.get("msText", ""), count=1, flags=re.I)
                scheme = re.sub(r"^\s*Target:.*?(authority|societies|beliefs|influence)\.?", "", scheme)
                f.write(json.dumps({"id": p["id"], "part": p["label"], "marks": p["marks"], "question": own(p["text"]),
                                    "scheme": clip(scheme, 500)}, ensure_ascii=False) + "\n")
        print(f"{code} {sec['title']}: {len(mine)} parts, {len(topics)} topics", file=sys.stderr)


def merge():
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8062"]
    valid = {t["code"] for t in tree["topics"]}
    tags, missing, dropped = {}, [], []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        code = os.path.basename(path)[6:-6]
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = []
            for c in got.get(pid, [])[:2]:
                ok = c in valid and c.startswith(code + ".")
                (codes if ok else dropped).append(c if ok else f"{pid}: {c}")
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {len(missing)} without a valid topic; dropped {len(dropped)}", file=sys.stderr)
    for d in dropped[:40] + missing[:40]:
        print("  ", d, file=sys.stderr)


if __name__ == "__main__":
    split() if MODE == "split" else merge()
