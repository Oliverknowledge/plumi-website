"""Split the cut Edexcel GCSE Geography B parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_gcse_geography/tag_gcse_geography.py split [work-dir] [batch-size]
    python3 scripts/question-bank/edexcel_gcse_geography/tag_gcse_geography.py merge [work-dir]

aqa_gcse_geography/tag_gcse_geography.py for Pearson's 1GB0: split writes
<work-dir>/tag/geography-b-topics.txt and <work-dir>/tag/batch-NN-geography-b.jsonl, one part
per line with the codes it may take ("first", "second"), and each batch is tagged following
../tag.md's "Edexcel GCSE Geography B" section into batch-NN-geography-b.tags.json. merge
writes <work-dir>/tags.json.

A question's topic is fixed by its paper and number, the same in every series from 2018 (AREA):
Paper 1's Question 2 is Development dynamics, Paper 2's Questions 8 and 9 the physical fieldwork
(one of coasts or rivers), Paper 3's Question 3 energy. A second code comes from the same topic,
or, for fieldwork, the content topic the investigation is about; Paper 3's decision question
(Question 4) takes any of Topics 7 to 9 first and anything second, and Paper 3's other parts, all set on
one resource booklet, may take a second code from any of Topics 7 to 9.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-gcse-geography")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 185
TAG = os.path.join(WORK, "tag")
# The topic (section) a question's parts are tagged to first, by paper and question number.
AREA = {"1gb001": {1: ["1"], 2: ["2"], 3: ["3"]},
        "1gb002": {1: ["4"], 2: ["4"], 3: ["4"], 4: ["4"], 5: ["5"], 6: ["5"], 7: ["5"],
                   8: ["6.1", "6.2"], 9: ["6.1", "6.2"], 10: ["6.3", "6.4"], 11: ["6.3", "6.4"]},
        "1gb003": {1: ["7"], 2: ["8"], 3: ["9"], 4: ["7", "8", "9"]}}
SECTION = {"1gb002": {1: "A", 2: "A", 3: "A", 4: "A", 5: "B", 6: "B", 7: "B", 8: "C1", 9: "C1", 10: "C2", 11: "C2"},
           "1gb003": {1: "A", 2: "B", 3: "C", 4: "D"}}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["1GB0"]
    return parts, tree


def allowed(p, codes):
    """(first, second): the codes a part may take first, and second."""
    area = AREA[p["component"]][int(p["question"])]
    inside = lambda c, a: c == a or "." not in a and c.split(".")[0] == a  # noqa: E731
    first = [c for c in codes if any(inside(c, a) for a in area)]
    if p["component"] == "1gb003" and int(p["question"]) == 4:
        return first, codes  # the decision question draws on the whole course
    if p["component"] == "1gb003":
        return first, first + [c for c in codes if c.split(".")[0] in ("7", "8", "9") and c not in first]  # one booklet, three topics
    if first and first[0].startswith("6."):
        return first, first + [c for c in codes if c.split(".")[0] in ("4", "5")]  # what the investigation is about
    return first, first


def own(text, label):
    """The part's own words, and what comes before them (the question's opening, its figures)."""
    sub = re.findall(r"\(([a-z]+)\)", label)
    for tok in reversed(sub):
        m = re.search(r"\(" + tok + r"\)\s+(.*)", text)
        if m:
            return text[:m.start()], m.group(1)
    return "", text


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    codes = [t["code"] for t in tree["topics"]]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {sections[t['section']]} | {t['title']} — {clip(t['text'], 420)}" for t in tree["topics"]]
    open(os.path.join(TAG, "geography-b-topics.txt"), "w").write("\n".join(lines) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    parts.sort(key=lambda p: (p["component"], int(p["question"]), p["id"]))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-geography-b.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                first, second = allowed(p, codes)
                setup, question = own(p["text"], p["label"])
                sec = SECTION.get(p["component"], {}).get(int(p["question"]))
                f.write(json.dumps({"id": p["id"], "paper": f"Paper {p['component'][-1]}" + (f" Section {sec}" if sec else ""),
                                    "label": p["label"], "marks": p["marks"], "first": first, "second": second,
                                    "question": clip(question, 500), "setup": clip(setup, 300),
                                    "scheme": clip(p.get("msText", ""), 500)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of up to {SIZE} in {TAG}", file=sys.stderr)


def merge():
    parts, tree = load()
    codes = [t["code"] for t in tree["topics"]]
    by_id = {p["id"]: p for p in parts}
    tags, problems = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            first, second = allowed(by_id[pid], codes)
            got_codes = got.get(pid, [])
            if not got_codes or got_codes[0] not in first:
                problems.append(f"{pid}: {got_codes} (first must be one of {first})")
                continue
            tags[pid] = [got_codes[0]] + [c for c in got_codes[1:2] if c in second and c != got_codes[0]]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} of {len(parts)} tagged; {len(problems)} problems", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
