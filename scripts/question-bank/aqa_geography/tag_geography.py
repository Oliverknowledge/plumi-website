"""Split the cut AQA Geography parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_geography/tag_geography.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_geography/tag_geography.py merge [work-dir]

split writes <work-dir>/tag/geography-topics.txt (each topic's code, its area, its
title and the specification's words) and <work-dir>/tag/batch-NN-geography.jsonl,
one part per line, grouped by area. Each batch is tagged following ../tag.md's
"AQA Geography" section into batch-NN-geography.tags.json: {"<id>": ["3.1.3.2"], ...}.
merge combines them into <work-dir>/tags.json for build_geography.py.

Every question sits in one area, fixed by its paper and number (AREA): an option's
questions are always tagged to that option, and merge rejects any code outside the
part's area, so a coasts question can never show under glaciers.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-geography")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 140
TAG = os.path.join(WORK, "tag")
# The area each question is set on, the same in every series (check_geography.py lists the choices).
AREA = {"70371": {"01": "3.1.1", "02": "3.1.2", "03": "3.1.3", "04": "3.1.4", "05": "3.1.5", "06": "3.1.6"},
        "70372": {"01": "3.2.1", "02": "3.2.2", "03": "3.2.3", "04": "3.2.4", "05": "3.2.5"},
        "70361": {"01": "3.1.1", "02": "3.1.3", "03": "3.1.4", "04": "3.1.5", "05": "3.2.3"},
        "70362": {"01": "3.2.2", "02": "3.3", "03": "3.3", "04": "3.3"}}
PAPER = {"70371": "A-Level Paper 1", "70372": "A-Level Paper 2", "70361": "AS Paper 1", "70362": "AS Paper 2"}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7037"]
    return parts, tree


def area_of(p):
    return AREA[p["component"]][p["question"]]


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    areas = {s["code"]: s["short"] for s in tree["sections"]}
    lines = [f"{t['code']} | {areas[t['section']]} | {t['title']} — {clip(t['text'], 400)}" for t in tree["topics"]]
    open(os.path.join(TAG, "geography-topics.txt"), "w").write("\n".join(lines) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    parts.sort(key=lambda p: (area_of(p), p["id"]))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-geography.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                area = area_of(p)
                # The setup and the part's own words, from the label on.
                m = re.search(r"0\s*" + p["question"][1] + r"\s*\.\s*" + p["part"] + r"\s", p["text"])
                setup, own = (p["text"][:m.start()], p["text"][m.end():]) if m else ("", p["text"])
                f.write(json.dumps({"id": p["id"], "paper": PAPER[p["component"]], "area": f"{area} {areas[area]}", "marks": p["marks"],
                                    "question": clip(own, 500), "setup": clip(setup, 300), "figures": p.get("figures") or [],
                                    "scheme": clip(re.sub(r"^0\d \d+ ", "", p.get("msText", "")), 500)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of up to {SIZE} in {TAG}", file=sys.stderr)


def merge():
    parts, tree = load()
    by_id = {p["id"]: p for p in parts}
    in_area = {}
    for t in tree["topics"]:
        in_area.setdefault(t["section"], set()).add(t["code"])
    tags, problems = {}, []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            own = in_area[area_of(by_id[pid])]
            codes = got.get(pid, [])
            if not codes or codes[0] not in own:
                problems.append(f"{pid}: {codes} (first must be in {area_of(by_id[pid])})")
                continue
            tags[pid] = [codes[0]] + [c for c in codes[1:2] if c in own and c != codes[0]]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} of {len(parts)} tagged; {len(problems)} problems", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
