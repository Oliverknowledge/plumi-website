"""Split the cut AQA GCSE Geography parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_gcse_geography/tag_gcse_geography.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_gcse_geography/tag_gcse_geography.py merge [work-dir]

tag_geography.py for the GCSE: split writes <work-dir>/tag/gcse-geography-topics.txt and
<work-dir>/tag/batch-NN-gcse-geography.jsonl, one part per line with the codes it may take
("first", "second"), and each batch is tagged following ../tag.md's "AQA GCSE Geography"
section into batch-NN-gcse-geography.tags.json. merge writes <work-dir>/tags.json.

A question's area is fixed by its paper and number (FIRST): Paper 1's coasts question takes
coastal topics, never rivers, so a student who skips an option never meets it. A second
code comes from the same area or from Geographical skills (3.4); Paper 3's issue evaluation
parts (Section A) take 3.3.1 first and, second, the content topic the issue is about.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-gcse-geography")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 210
TAG = os.path.join(WORK, "tag")
# The topics a question's parts are tagged to first, the same in every series (check_gcse_geography.py lists the choices).
FIRST = {"80351": {"01": ["3.1.1."], "02": ["3.1.2."], "03": ["3.1.3.1", "3.1.3.2"], "04": ["3.1.3.1", "3.1.3.3"], "05": ["3.1.3.1", "3.1.3.4"]},
         "80352": {"01": ["3.2.1."], "02": ["3.2.2."], "03": ["3.2.3.1"], "04": ["3.2.3.2"], "05": ["3.2.3.3"], "06": ["3.2.3.4"]},
         "80353": {"01": ["3.3.1"], "02": ["3.3.1"], "03": ["3.3.1"], "04": ["3.3.2."], "05": ["3.3.2."]}}
PAPER = {"80351": "Paper 1", "80352": "Paper 2", "80353": "Paper 3"}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def load():
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["8035"]
    return parts, tree


def allowed(p, codes):
    """(first, second): the codes a part may take first, and second."""
    first = [c for c in codes if any(c == f or (f.endswith(".") and c.startswith(f)) for f in FIRST[p["component"]][p["question"]])]
    skills = [c for c in codes if c.startswith("3.4.")]
    if first == ["3.3.1"]:  # the issue evaluation: second, what the issue is about
        return first, [c for c in codes if c.startswith(("3.1.", "3.2."))] + skills
    return first, first + skills


def split():
    os.makedirs(TAG, exist_ok=True)
    parts, tree = load()
    codes = [t["code"] for t in tree["topics"]]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {sections[t['section']]} | {t['title']} — {clip(t['text'], 400)}" for t in tree["topics"]]
    open(os.path.join(TAG, "gcse-geography-topics.txt"), "w").write("\n".join(lines) + "\n")
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    parts.sort(key=lambda p: (p["component"], p["question"], p["id"]))
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-gcse-geography.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                first, second = allowed(p, codes)
                label = r"0\s*" + p["question"][1] + (r"\s*\.\s*" + r"\s*".join(p["part"]) if p["part"] else "") + r"\s"  # "0 1 . 1 0"
                m = re.search(label, p["text"])
                setup, own = (p["text"][:m.start()], p["text"][m.end():]) if m else ("", p["text"])
                f.write(json.dumps({"id": p["id"], "paper": PAPER[p["component"]], "marks": p["marks"], "first": first, "second": second,
                                    "question": clip(own, 500), "setup": clip(setup, 300),
                                    "scheme": clip(re.sub(r"^0\d \d+ ", "", p.get("msText", "")), 500)}, ensure_ascii=False) + "\n")
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
