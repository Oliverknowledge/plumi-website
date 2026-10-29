"""Split the cut Religious Studies parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/eduqas_rs/tag_eduqas_rs.py split [work-dir]
    python3 scripts/question-bank/eduqas_rs/tag_eduqas_rs.py merge [work-dir]

The brief is tag.md's, with its Eduqas Religious Studies section. split writes, to
<work-dir>/tag/, rs-<area>-topics.txt (the area's 24 topics) and batch-<area>.jsonl, one
part per line: the area is the paper's (Component 1's option, or Components 2 and 3), so
each batch is tagged against its own area's topics only. merge collects the batches'
batch-<area>.tags.json into <work-dir>/tags.json for build_eduqas_rs.py, dropping a code
outside the part's area and, for an AS paper, one the AS specification doesn't teach.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "eduqas-rs")
TAG = os.path.join(WORK, "tag")


def area(component):
    """"a120ub0" -> "B" (Option B), "a120u20" -> "P", "a120u30" -> "R"."""
    c = component[5].upper()
    return {"2": "P", "3": "R"}.get(c, c)


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def own(text):
    """The part's words, without its labels ("0 3 a)", "3. (a)") and marks."""
    return clip(re.sub(r"\[\d+\]", "", re.sub(r"^(\d\s?\d|\d\.)?\s*\(?[ab]\)\s*", "", text)), 400)


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["A120"]
    names = {s["code"]: s["title"] for s in tree["sections"]}
    by_q = {(p["set"], p["question"]): p for p in parts if p["part"] == "a"}
    for code, name in names.items():
        topics = [t for t in tree["topics"] if t["section"] == code]
        lines = [f"{t['code']} | Theme {t['theme']}: {t['themeTitle']} | {t['title']} {'[AS]' if t['year'] == 1 else '[A-Level only]'} — {clip(t['text'], 500)}"
                 for t in topics]
        open(os.path.join(TAG, f"rs-{code}-topics.txt"), "w").write("\n".join(lines) + "\n")
        mine = [p for p in parts if area(p["component"]) == code]
        with open(os.path.join(TAG, f"batch-{code}.jsonl"), "w") as f:
            for p in mine:
                row = {"id": p["id"], "paper": f"{'AS' if p['spec'] == 'B120' else 'A-Level'} {name} {p['series']}", "part": p["label"],
                       "question": own(p["text"])}
                if p["part"] == "b" and (p["set"], p["question"]) in by_q:
                    row["part_a"] = own(by_q[(p["set"], p["question"])]["text"])  # the same question's (a), for context
                if p.get("hint"):
                    row["report_says"] = f"Theme {p['hint']['theme']}: {p['hint']['title']}" + (" (AS numbering)" if p["spec"] == "B120" else "")
                row["scheme"] = clip(re.sub(r"^.*?responses should be credited\.?", "", p.get("msText", "")), 300)
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"{code} {name}: {len(mine)} parts", file=sys.stderr)


def merge():
    tree = json.load(open(os.path.join(WORK, "spec.json")))["A120"]
    year = {t["code"]: t["year"] for t in tree["topics"]}
    tags, missing, dropped = {}, 0, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            row = json.loads(line)
            pid, code = row["id"], os.path.basename(path)[6:-6]
            as_paper = row["paper"].startswith("AS ")
            codes = []
            for c in got.get(pid, [])[:2]:
                if c in year and c.startswith(code + ".") and (year[c] == 1 or not as_paper):
                    codes.append(c)
                else:
                    dropped.append(f"{pid}: {c}")
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic; dropped {len(dropped)}", file=sys.stderr)
    for d in dropped[:40]:
        print("  dropped", d, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
