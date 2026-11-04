"""List the cut GCSE French questions for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_gcse_french/tag_gcse_french.py split [work-dir]
    python3 scripts/question-bank/edexcel_gcse_french/tag_gcse_french.py merge [work-dir]

A language question is one text or recording (or one writing task) on one topic, its parts asking about it in turn, so questions are
tagged, not parts: split writes <work-dir>/tag/french-questions.tsv, one question per line (its key, its printed title, the start of its words), and
<work-dir>/tag/french-topics.txt. The answers, following ../tag.md's "Edexcel GCSE French" section, are kept in edexcel_gcse_french/tags_french.json,
{"<set>-<question>": ["2.1"]}, committed because a printed title settles most of them, and many questions are printed on both tiers, with one
answer. merge gives every part its question's topics in <work-dir>/tags.json. A writing task's options are tagged apart ("<set>-<question>.<part>").
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from spec_gcse_french import tree  # noqa: E402

mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-gcse-french")
TAGS = os.path.join(HERE, "tags_french.json")


def key(p):
    return f"{p['set']}-{p['question']}" + (f".{p['part']}" if p.get("or") or (p["part"] and (p["marks"] or 0) >= 10) else "")


def split():
    tag = os.path.join(WORK, "tag")
    os.makedirs(tag, exist_ok=True)
    t = tree()
    open(os.path.join(tag, "french-topics.txt"), "w").write("\n".join(f"{x['code']} | {x['title']}: {x['text']}" for x in t["topics"]) + "\n")
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    seen, lines = set(), []
    for p in parts:
        k = key(p)
        if k in seen:
            continue
        seen.add(k)
        words = re.sub(r"\s+", " ", (p.get("stemText") or "") + " " + p["own"])
        words = re.sub(r"\.{3,}|…+", " ", words)
        lines.append(f"{k}\t{p['title']}\t{words[:170]}")
    open(os.path.join(tag, "french-questions.tsv"), "w").write("\n".join(lines) + "\n")
    print(f"{len(lines)} questions from {len(parts)} parts", file=sys.stderr)


def merge():
    valid = {x["code"] for x in tree()["topics"]}
    answers = json.load(open(TAGS))
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tags = {p["id"]: [c for c in answers.get(key(p), []) if c in valid][:3] for p in parts}
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    missing = sorted({key(p) for p in parts if not tags[p["id"]]})
    print(f"{sum(1 for v in tags.values() if v)} of {len(tags)} parts tagged; {len(missing)} questions untagged: {missing[:20]}", file=sys.stderr)


if __name__ == "__main__":
    {"split": split, "merge": merge}[mode]()
