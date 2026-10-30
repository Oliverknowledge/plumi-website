"""Split the cut GCSE Religious Studies or History parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/eduqas_gcse/tag_eduqas_gcse.py split rs|history [work-dir]
    python3 scripts/question-bank/eduqas_gcse/tag_eduqas_gcse.py merge rs|history [work-dir]

The brief is tag.md's, with its Eduqas GCSE section. split writes, to <work-dir>/tag/,
topics-<section>.txt and batch-<section>.jsonl, one part per line. A part's section is fixed by
its paper and question, so each batch is tagged against its own section's topics only:
  - Religious Studies: Route A Component 1's question 1 is Theme 1 (Issues of Relationships) to
    question 4, Theme 4; Component 2 is Christianity; Component 3 the paper's faith; Route B's
    Component 1 questions 1 and 2 are Origins and Meaning and Good and Evil, Component 2's Life
    and Death and Sin and Forgiveness;
  - History: the paper's option (1A … 2H).
merge collects the batches' batch-<section>.tags.json into <work-dir>/tags.json for
build_eduqas_gcse.py, dropping a code outside the part's section.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MODE = ARGS[0] if ARGS else "split"
SUBJECT = ARGS[1] if len(ARGS) > 1 else "rs"
WORK = os.path.abspath(ARGS[2]) if len(ARGS) > 2 else os.path.join(HERE, "..", ".work", f"eduqas-gcse-{SUBJECT}")
TAG = os.path.join(WORK, "tag")
FAITH = {"3": "BU", "4": "HI", "5": "IS", "6": "JU", "7": "SI"}


def section(p):
    """The specification section a part is set on: "T2", "CH", "IS", "B3", "1G"."""
    c, q = p["component"], int(p["question"])
    if SUBJECT == "history":
        return f"1{c[5].upper()}" if c[5] in "abcdefgh" else f"2{'ABCDEFGH'[int(c[5]) - 1]}"
    return {"1": f"T{q}", "2": "CH", "8": f"B{q}", "9": f"B{q + 2}"}.get(c[5]) or FAITH[c[5]]


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def own(text):
    """The part's words, without its labels ("1.", "QUESTION 4", "(a)") and marks."""
    text = re.sub(r"\[\d+\]", "", text)
    text = re.sub(r"^(QUESTION \d+|\d\.)\s*", "", text)
    return clip(text, 500)


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    for sec in tree["sections"]:
        code = sec["code"]
        topics = [t for t in tree["topics"] if t["section"] == code]
        open(os.path.join(TAG, f"topics-{code}.txt"), "w").write(
            "\n".join(f"{t['code']} | {sec['title']} | {t['title']} — {clip(t['text'], 700)}" for t in topics) + "\n")
        mine = [p for p in parts if section(p) == code]
        with open(os.path.join(TAG, f"batch-{code}.jsonl"), "w") as f:
            for p in mine:
                row = {"id": p["id"], "paper": f"{p['paperTitle']} {p['series']}", "part": p["label"], "question": own(p["text"])}
                if p.get("stemText"):
                    row["sources"] = clip(p["stemText"], 600)
                if p.get("hint"):
                    row["report_says"] = clip(p["hint"], 600)
                scheme = re.sub(r"^This content is not prescriptive.*?(consider are:?|identified below\.)\s*", "", p.get("msText", ""))
                row["scheme"] = clip(scheme if SUBJECT == "history" else re.sub(r"^.*?\[\d+\]", "", scheme, count=1), 400)
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"{code} {sec['title']}: {len(mine)} parts, {len(topics)} topics", file=sys.stderr)


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
                (codes if c in valid and c.startswith(code + ".") else dropped).append(c if c in valid and c.startswith(code + ".") else f"{pid}: {c}")
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
