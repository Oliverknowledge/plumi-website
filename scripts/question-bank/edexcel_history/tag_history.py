"""Split the cut History questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_history/tag_history.py split [work-dir]
    python3 scripts/question-bank/edexcel_history/tag_history.py merge [work-dir]

A question is only ever on its own option, and its section narrows it further:
  Paper 1: Sections A and B, the four themes ("1H.1" to "1H.4"); Section C, the interpretations question ("1H.I"),
           tagged here without asking.
  Paper 2: the four key topics ("2H.1.1" to "2H.1.4").
  Paper 3: Sections A and B, the aspects in depth ("37.1.K1" to "37.1.K5"); Section C, the aspects in breadth
           ("37.1.T1", "37.1.T2").
split writes <work-dir>/tag/batch-NN.jsonl, one question a line with the `topics` it may be tagged to (code,
title and what the specification says under it, given once per option in the batch, on its first question),
grouped by option so a batch covers few. Each batch is tagged following ../tag.md's "Edexcel History" section
into batch-NN.answers.json, {"<id>": ["2H.1.2"], ...}. merge writes <work-dir>/tags.json, refusing a code
the question may not have.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-history")
TAG = os.path.join(WORK, "tag")
SIZE = 170


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def allowed(p, topics):
    """The topic codes a question may be tagged to, read off its option and section."""
    opt, sec = p["option"], p.get("section")
    mine = [t["code"] for t in topics if t["section"] == opt]
    if re.fullmatch(r"1[A-H]", opt):
        return [c for c in mine if c.endswith(".I")] if sec == "C" else [c for c in mine if not c.endswith(".I")]
    if opt.startswith("2"):
        return mine
    return [c for c in mine if (".T" in c) == (sec == "C")]


def load():
    spec = json.load(open(os.path.join(WORK, "spec.json")))["9HI0"]
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    return spec, parts


def split():
    os.makedirs(TAG, exist_ok=True)
    spec, parts = load()
    by_code = {t["code"]: t for t in spec["topics"]}
    order = [s["code"] for s in spec["sections"]]
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    ask = sorted((p for p in parts if len(allowed(p, spec["topics"])) > 1), key=lambda p: (order.index(p["option"]), p["id"]))
    n = 0
    for i in range(0, len(ask), SIZE):
        n += 1
        seen = set()
        with open(os.path.join(TAG, f"batch-{n:02d}.jsonl"), "w") as f:
            for p in ask[i:i + SIZE]:
                codes = allowed(p, spec["topics"])
                line = {"id": p["id"], "option": p["option"], "section": p.get("section"), "topics": codes,
                        "question": clip(re.split(r"\bSource 1:|\bExtract 1:", p["text"])[0], 500), "scheme": clip(p.get("msText", ""), 400)}
                new = [c for c in codes if c not in seen]
                if new:
                    line["topicText"] = {c: f"{by_code[c]['title']}: {clip(by_code[c]['text'], 500)}" for c in new}
                    seen.update(new)
                f.write(json.dumps(line, ensure_ascii=False) + "\n")
    print(f"{len(parts)} questions, {len(ask)} to tag in {n} batches in {TAG}", file=sys.stderr)


def merge():
    spec, parts = load()
    tags, refused, missing = {}, [], []
    answers = {}
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.answers.json"))):
        answers.update(json.load(open(path)))
    for p in parts:
        codes = allowed(p, spec["topics"])
        if len(codes) == 1:
            tags[p["id"]] = codes
            continue
        # (a question tagged before it had its stem keeps its tags: its id has since taken "-q")
        got = [c for c in answers.get(p["id"], answers.get(p["id"].removesuffix("-q"), [])) if isinstance(c, str)][:2]
        if not got:
            missing.append(p["id"])
        elif any(c not in codes for c in got):
            refused.append((p["id"], got))
        else:
            tags[p["id"]] = got
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {len(missing)} with no answer, {len(refused)} refused", file=sys.stderr)
    for r in (refused + missing)[:20]:
        print("  ", r, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
