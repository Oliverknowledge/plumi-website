"""Split the cut Edexcel GCSE History parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_gcse_history/tag_gcse_history.py split [work-dir]
    python3 scripts/question-bank/edexcel_gcse_history/tag_gcse_history.py merge [work-dir]

The brief is tag.md's, with its Edexcel GCSE History section. A part's section is its paper's option
("10", "P4", "B1", "31"), so each batch is tagged against its own option's topics only. Paper 1's
Section A, questions 1 and 2, is always the historic environment: those parts are tagged <option>.site
here, not sent out. split writes <work-dir>/tag/topics-<option>.txt and batch-<option>.jsonl; merge
collects batch-<option>.tags.json into <work-dir>/tags.json for build_gcse_history.py.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MODE = ARGS[0] if ARGS else "split"
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-history")
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, HERE)
from build_gcse_history import asked  # noqa: E402


def section(p):
    return p["component"][4:].upper()


def site(p):
    return section(p) in ("10", "11", "12", "13") and int(p["question"]) <= 2


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    for sec in tree["sections"]:
        code = sec["code"]
        topics = [t for t in tree["topics"] if t["section"] == code]
        open(os.path.join(TAG, f"topics-{code}.txt"), "w").write(
            "\n".join(f"{t['code']} | {sec['title']} | {t['title']} — {clip(t['text'], 900)}" for t in topics) + "\n")
        mine = [p for p in parts if section(p) == code and not site(p)]
        with open(os.path.join(TAG, f"batch-{code}.jsonl"), "w") as f:
            for p in mine:
                words = re.sub(r"\(\d{1,2}\)|\(Total for[^)]*\)", "", asked(p))
                row = {"id": p["id"], "paper": f"{code} {p['series']}", "part": p["label"], "question": clip(words, 500),
                       "scheme": clip(re.sub(r"^.*?(Indicative content|Relevant points|e\.g\.)", r"\1", p.get("msText", "")), 400)}
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"{code}: {len(mine)} parts to tag, {len(topics)} topics", file=sys.stderr)


def merge():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    valid = {t["code"] for t in tree["topics"]}
    tags = {p["id"]: [f"{section(p)}.site"] for p in parts if site(p)}
    missing, dropped = [], []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        code = os.path.basename(path)[6:-6]
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = []
            for c in got.get(pid, [])[:2]:
                if c in valid and c.startswith(code + "."):
                    codes.append(c)
                else:
                    dropped.append(f"{pid}: {c}")
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
