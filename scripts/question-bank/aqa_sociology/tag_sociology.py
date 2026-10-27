"""Split the cut AQA Sociology questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_sociology/tag_sociology.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_sociology/tag_sociology.py merge [work-dir]

split writes <work-dir>/tag/sociology-topics.txt (each topic's code, its area, its
title and the specification's words) and <work-dir>/tag/batch-NN-sociology.jsonl,
one question per line. Each batch is tagged following ../tag.md's "AQA Sociology"
section into batch-NN-sociology.tags.json: {"<id>": ["4.2.2.4"], ...}. merge
combines them into <work-dir>/tags.json for build_sociology.py.

Every question sits in one area of the specification, fixed by its paper, number
and option (AREA_OF), and its first code must be one of that area's topics: an
option question is always tagged to its option. A Methods in Context question is
4.1.2 first, with the research-methods topic it turns on second.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-sociology")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 60
TAG = os.path.join(WORK, "tag")
# A-Level Paper 2's topics; AS Paper 2 numbers its four (the A-Level's Section A) B1-B4.
OPTIONS = {"71922": {"a1": "4.2.1", "a2": "4.2.2", "a3": "4.2.3", "a4": "4.2.4", "b1": "4.2.5", "b2": "4.2.6", "b3": "4.2.7", "b4": "4.2.8"},
           "71912": {"a": "4.1.3", "b1": "4.2.1", "b2": "4.2.2", "b3": "4.2.3", "b4": "4.2.4"}}
PAPER = {"71921": "A-Level 1", "71922": "A-Level 2", "71923": "A-Level 3", "71911": "AS 1", "71912": "AS 2"}


def area_of(p):
    """The specification area a question is set in: its option's, or by number (Paper 1: 01-04 Education, 05
    Methods in Context, 06 Theory and Methods; Paper 3: 01-04 Crime and Deviance, 05-06 Theory and Methods;
    AS Paper 1: 01-05 Education, 06 Methods in Context)."""
    comp, q = p["component"], int(p["question"])
    if comp in OPTIONS:
        return OPTIONS[comp][p["option"]]
    if comp == "71921":
        return "4.1.1" if q <= 4 else "4.1.2" if q == 5 else "4.1.3"
    if comp == "71923":
        return "4.3.1" if q <= 4 else "4.1.3"
    return "4.1.1" if q <= 5 else "4.1.2"


def allowed(area, topics):
    """(codes a first tag may be, codes a second tag may be)."""
    tm = {t["code"] for t in topics if t["section"] == "4.1.3" and t["code"] != "4.1.2"}
    if area == "4.1.2":
        return {"4.1.2"}, tm | {t["code"] for t in topics if t["section"] == "4.1.1"}
    own = tm if area == "4.1.3" else {t["code"] for t in topics if t["section"] == area}
    return own, own


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7192"]
    return parts, tree


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    areas = {s["code"]: s["short"] for s in tree["sections"]}
    areas["4.1.2"] = "Methods in Context"
    lines = [f"{t['code']} | {areas[t['section']]} | {t['title']} — {clip(t['text'], 300)}" for t in tree["topics"]]
    open(os.path.join(TAG, "sociology-topics.txt"), "w").write("\n".join(lines) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    parts.sort(key=lambda p: (area_of(p), p["id"]))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-sociology.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                area = area_of(p)
                # The text is the question's own words, ending at its marks, then its Item's.
                m = re.search(r"\[\d+ marks?\]", p["text"])
                own_words, item = p["text"][:m.end()], p["text"][m.end():]
                f.write(json.dumps({"id": p["id"], "paper": PAPER[p["component"]], "area": f"{area} {areas[area]}", "marks": p["marks"],
                                    "question": clip(own_words, 400), "item": clip(item, 400),
                                    "scheme": clip(re.sub(r"^Qu Marking guidance Total marks ", "", p.get("msText", "")), 400)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of up to {SIZE} in {TAG}", file=sys.stderr)


def merge():
    parts, tree = load()
    by_id = {p["id"]: p for p in parts}
    tags, problems = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            first, second = allowed(area_of(by_id[pid]), tree["topics"])
            codes = got.get(pid, [])
            if not codes or codes[0] not in first:
                problems.append(f"{pid}: {codes} (first must be in {area_of(by_id[pid])})")
                continue
            tags[pid] = [codes[0]] + [c for c in codes[1:2] if c in second and c != codes[0]]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} of {len(parts)} tagged; {len(problems)} problems", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
