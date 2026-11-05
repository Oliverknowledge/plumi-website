"""Split the cut Edexcel GCSE Religious Studies parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_gcse_rs/tag_gcse_rs.py split [work-dir]
    python3 scripts/question-bank/edexcel_gcse_rs/tag_gcse_rs.py merge [work-dir]

The brief is tag.md's, with its Edexcel GCSE Religious Studies section. A part's section is fixed by its paper and
question (spec.json's map: 1RB0 Paper 2F's question 3 is Judaism's "Living the Jewish Life"), so each batch is tagged
against that section's eight items only. Many of Pearson's reports name the item a part tested ("Bullet point 2.5", "This
referred to the specification: 1.3 - Creation"): those parts take it, and so do word-for-word repeats of them in the same
section, and aren't sent out. Repeats of one question are sent once. split writes <work-dir>/tag/topics-<section>.txt
and batch-<section>.jsonl; merge collects batch-<section>.tags.json into <work-dir>/tags.json for build_gcse_rs.py.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
MODE = ARGS[0] if ARGS else "split"
WORK = os.path.abspath(ARGS[1]) if len(ARGS) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-rs")
TAG = os.path.join(WORK, "tag")


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def section(p, tree):
    return tree["map"][p["component"]][int(p["question"]) - 1]


def said(p, tree):
    """The topic the report names for this part, or None: the item's number in its stretch of the report, "2.5" for question 2."""
    q, letter = int(p["question"]), p["part"]
    m = re.search(rf"(?:^|\n)Question\s+{q}\s*\(?{letter}\)?\s*\n(.*?)(?=\nQuestion\s+\d\s*\(?[a-d]\)?\s*\n|\Z)", p.get("er") or "", re.S)
    if not m:
        return None
    body = m.group(1)
    r = re.search(r"(?:[Bb]ullet\s*point|[Ss]pecification(?:\s+(?:point|content|reference))?:?)\s*([1-4])\.([1-8])\b", body) \
        or re.search(r"(?<![\d.:])([1-4])\.([1-8])\*?\s*[-–:]?\s+[A-Z]", body[:300])
    if not r or int(r.group(1)) != q:
        return None
    return f"{section(p, tree)}.{r.group(2)}"


def words(p):
    return re.sub(r"\s+", " ", re.sub(r"\(\d{1,2}\)|\(Total for[^)]*\)", "", p.get("ask") or p["text"])).strip()


def same_key(p, tree):
    return section(p, tree), re.sub(r"[^a-z0-9]", "", re.sub(r"^\d?\s*\*?\([a-d]\)", "", words(p)).lower())


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p.get("ms")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    # What the reports say, carried across repeats; each remaining question sent once
    named, by_words = {}, {}
    for p in parts:
        hit = said(p, tree)
        if hit:
            named[p["id"]] = hit
            by_words.setdefault(same_key(p, tree), hit)
    first, repeats = {}, {}
    for p in parts:
        k = same_key(p, tree)
        if p["id"] in named:
            continue
        if k in by_words:
            named[p["id"]] = by_words[k]
        elif k in first:
            repeats[p["id"]] = first[k]
        else:
            first[k] = p["id"]
    json.dump({"named": named, "repeats": repeats}, open(os.path.join(TAG, "named.json"), "w"), indent=0)
    print(f"{len(named)} parts named by a report, {len(repeats)} repeats of a part sent out, {len(first)} to tag", file=sys.stderr)
    for sec in tree["sections"]:
        code = sec["code"]
        open(os.path.join(TAG, f"topics-{code}.txt"), "w").write(
            "\n".join(f"{t['code']} | {t['title']} — {clip(t['text'], 3000)}" for t in tree["topics"] if t["section"] == code) + "\n")
        mine = [p for p in parts if section(p, tree) == code and p["id"] in first.values()]
        with open(os.path.join(TAG, f"batch-{code}.jsonl"), "w") as f:
            for p in mine:
                scheme = re.sub(r"^.*?(Award [^.]*\.|Arguments for the statement:?)", "", p.get("msText", ""), count=1)
                row = {"id": p["id"], "question": clip(words(p), 240), "scheme": clip(scheme, 240)}
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"{code}: {len(mine)} parts", file=sys.stderr)


def merge():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p.get("ms")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))
    valid = {t["code"] for t in tree["topics"]}
    known = json.load(open(os.path.join(TAG, "named.json")))
    got = {pid: [code] for pid, code in known["named"].items()}
    for path in glob.glob(os.path.join(TAG, "batch-*.tags.json")):
        got.update(json.load(open(path)))
    got.update({pid: got.get(src, []) for pid, src in known["repeats"].items()})
    tags, missing, dropped = {}, [], []
    for p in parts:
        code = section(p, tree)
        codes = []
        for c in got.get(p["id"], [])[:2]:
            if c in valid and c.startswith(code + "."):
                codes.append(c)
            else:
                dropped.append(f"{p['id']}: {c}")
        if codes:
            tags[p["id"]] = codes
        else:
            missing.append(p["id"])
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {len(missing)} without a valid topic; dropped {len(dropped)}", file=sys.stderr)
    for d in dropped[:40] + missing[:40]:
        print("  ", d, file=sys.stderr)


if __name__ == "__main__":
    split() if MODE == "split" else merge()
