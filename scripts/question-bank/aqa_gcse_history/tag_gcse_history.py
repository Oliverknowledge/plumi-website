"""Split the cut AQA GCSE History questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_history/tag_gcse_history.py split [work-dir]
    python3 scripts/question-bank/aqa_gcse_history/tag_gcse_history.py merge [work-dir]

eduqas_gcse/tag_eduqas_gcse.py's batches for AQA's options; the brief is tag.md's, with its AQA GCSE
History section. A question's section is its paper's option ("81451AB" is 1AB, Germany), so split
writes, to <work-dir>/tag/, topics-<option>.txt and batch-<option>.jsonl, one question per line,
each tagged against its own option's topics only. merge collects batch-<option>.tags.json into
<work-dir>/tags.json for build_gcse_history.py, dropping a code outside the question's option.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MODE = ARGS[0] if ARGS else "split"
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-history")
TAG = os.path.join(WORK, "tag")


def section(p):
    return p["component"][4:]


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def own(text):
    """The question's words, from its label ("0 4") to its marks."""
    m = re.search(r"0 \d\s+(.*)", text)
    return clip(re.sub(r"\[(\d+ marks?|SPaG \d marks?)\]", "", m.group(1) if m else text), 500)


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    for sec in tree["sections"]:
        code = sec["code"]
        topics = [t for t in tree["topics"] if t["section"] == code]
        open(os.path.join(TAG, f"topics-{code}.txt"), "w").write(
            "\n".join(f"{t['code']} | {sec['title']} | {t['part']} | {t['title']} — {clip(t['text'], 700)}" for t in topics) + "\n")
        mine = [p for p in parts if section(p) == code]
        with open(os.path.join(TAG, f"batch-{code}.jsonl"), "w") as f:
            for p in mine:
                row = {"id": p["id"], "paper": f"{p['paperTitle']}", "question": int(p["question"]), "text": own(p["text"])}
                if p.get("stemText"):
                    row["sources"] = clip(p["stemText"], 600)
                row["scheme"] = clip(re.sub(r"^.*?The indicative content is designed.*?should be credited\.?\s*", "", p.get("msText", "")), 500)
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"{code} {sec['title']}: {len(mine)} questions, {len(topics)} topics", file=sys.stderr)


def merge():
    tree = json.load(open(os.path.join(WORK, "spec.json")))
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
    print(f"{len(tags)} questions tagged, {len(missing)} without a valid topic; dropped {len(dropped)}", file=sys.stderr)
    for d in dropped[:40] + missing[:40]:
        print("  ", d, file=sys.stderr)


if __name__ == "__main__":
    split() if MODE == "split" else merge()
