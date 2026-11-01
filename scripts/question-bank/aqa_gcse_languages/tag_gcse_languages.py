"""Split the cut GCSE language questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_languages/tag_gcse_languages.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_gcse_languages/tag_gcse_languages.py merge [work-dir]

A language question is one text or recording (or one writing task) on one topic, its parts asking
about it in turn, so questions are tagged, not parts: split writes <work-dir>/tag/languages-topics.txt
and <work-dir>/tag/batch-NN-languages.jsonl, one question per line (its paper, its words and its
parts' words, the start of its scheme), each tagged following ../tag.md's "AQA GCSE French, Spanish
and Bengali" section into batch-NN-languages.tags.json, {"<set>-<question>": ["1.3.4"]}. merge gives
every part its question's topics in <work-dir>/tags.json. A writing task's options are tagged apart
("<set>-<question>.<part>"), as each sets its own bullet points.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from spec_gcse_languages import tree  # noqa: E402

mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-gcse-languages")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 150
TAG = os.path.join(WORK, "tag")
LANGUAGE = {"8658": "French", "8652": "French", "8698": "Spanish", "8692": "Spanish", "8638": "Bengali"}
SKILL = {"L": "Paper 1 Listening", "R": "Paper 3 Reading", "W": "Paper 4 Writing"}
TIER = {"F": "Foundation", "H": "Higher"}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def key(p):
    return f"{p['set']}-{p['question']}" + (f".{p['part']}" if p["component"][4] == "W" and p["part"] and (p["marks"] or 0) >= 10 else "")


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    t = tree()
    sections = {s["code"]: s["title"] for s in t["sections"]}
    open(os.path.join(TAG, "languages-topics.txt"), "w").write(
        "\n".join(f"{x['code']} | {sections[x['section']]} | {x['title']}: {x['text']}" for x in t["topics"]) + "\n")
    questions = {}
    for p in sorted(parts, key=lambda p: (p["component"], p["series"], p["id"])):
        questions.setdefault(key(p), []).append(p)
    for old in glob.glob(os.path.join(TAG, "batch-*-languages.jsonl")):
        os.remove(old)
    keys = list(questions)
    for n, i in enumerate(range(0, len(keys), SIZE), 1):
        with open(os.path.join(TAG, f"batch-{n:02d}-languages.jsonl"), "w") as f:
            for k in keys[i:i + SIZE]:
                ps = questions[k]
                c = ps[0]["component"]
                words = " | ".join(clip(p["text"], 700 if j == 0 else 160) for j, p in enumerate(ps[:6]))
                f.write(json.dumps({"key": k, "paper": f"{LANGUAGE[c[:4]]} {SKILL[c[4]]} {TIER[c[5]]} ({c[:4]}, {ps[0]['series']})",
                                    "parts": len(ps), "question": clip(words, 1200), "scheme": clip(ps[0].get("msText", ""), 200)}, ensure_ascii=False) + "\n")
    print(f"{len(keys)} questions from {len(parts)} parts in {n} batches in {TAG}", file=sys.stderr)


def merge():
    valid = {x["code"] for x in tree()["topics"]}
    answers = {}
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*-languages.tags.json"))):
        answers.update(json.load(open(path)))
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tags = {p["id"]: [c for c in answers.get(key(p), []) if c in valid][:3] for p in parts}
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    missing = sorted({key(p) for p in parts if not tags[p["id"]]})
    print(f"{sum(1 for v in tags.values() if v)} of {len(tags)} parts tagged; {len(missing)} questions untagged: {missing[:20]}", file=sys.stderr)


if __name__ == "__main__":
    {"split": split, "merge": merge}[mode]()
