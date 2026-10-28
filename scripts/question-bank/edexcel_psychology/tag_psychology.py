"""Split the cut Psychology parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/edexcel_psychology/tag_psychology.py split [work-dir]
    python3 scripts/question-bank/edexcel_psychology/tag_psychology.py merge [work-dir]

split writes <work-dir>/tag/topics.txt (each topic's code, its section and what the
specification says under it) and <work-dir>/tag/batch-NN.jsonl, one part per line with
the `sections` it may be tagged to: a paper only examines its own topics, and Paper 2's
options are kept apart, so a student who studies child psychology never meets a health
question under it.
  AS Paper 1: 1 Social, 2 Cognitive. AS Paper 2: 3 Biological, 4 Learning theories.
  A-Level Paper 1: 1-4. Paper 2: Section A 5 Clinical; Section B Option 1 6 Criminological,
  Option 2 7 Child, Option 3 8 Health (read off each paper's own headings, "OPTION 1:
  CRIMINOLOGICAL PSYCHOLOGY", into paper2-options.json). Paper 3: 9 Psychological
  skills first, with a second code from any topic (a classic study's own topic).
Each batch is tagged following ../tag.md's "Edexcel Psychology" section into
batch-NN.answers.json, {"<part id>": ["1.3"], ...}. merge writes <work-dir>/tags.json,
refusing a first code outside the part's sections.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "edexcel-psychology")
TAG = os.path.join(WORK, "tag")
SIZE = 160
PAPERS = {"8ps001": ["1", "2"], "8ps002": ["3", "4"], "9ps001": ["1", "2", "3", "4"], "9ps003": ["9"]}
OPTION = {"A": "5", "1": "6", "2": "7", "3": "8"}


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def paper2_options():
    """{set: {question: "A" or the option's number}}, from each Paper 2's headings, in reading order."""
    import pymupdf
    out = {}
    for f in json.load(open(os.path.join(WORK, "manifest.json"))):
        if f["component"] != "9ps0-02" or f["kind"] != "qp":
            continue
        text = "\n".join(p.get_text() for p in pymupdf.open(os.path.join(WORK, "pdf", f["file"])))
        cur, m = "A", {}
        for x in re.finditer(r"OPTION ([123]):\s*(?:CRIMINOLOGICAL|CHILD|HEALTH)|Total for Question\s*(\d+)\s*=", text):
            if x.group(1):
                cur = x.group(1)
            else:
                m[str(int(x.group(2)))] = cur
        out[f"9ps002-{f['series'].lower()}"] = m
    json.dump(out, open(os.path.join(WORK, "paper2-options.json"), "w"))
    return out


def allowed(p, options):
    paper = p["set"].split("-")[0]
    if paper == "9ps002":
        return [OPTION[options[p["set"]][str(int(p["question"]))]]]
    return PAPERS[paper]


def split():
    os.makedirs(TAG, exist_ok=True)
    spec = json.load(open(os.path.join(WORK, "spec.json")))["9PS0"]
    secs = {s["code"]: s["short"] for s in spec["sections"]}
    open(os.path.join(TAG, "topics.txt"), "w").write("\n".join(
        f"{t['code']} | {secs[t['section']]} | {t['title']} — {clip(t['text'], 300)}" for t in spec["topics"]) + "\n")
    options = paper2_options()
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")]
    for old in glob.glob(os.path.join(TAG, "batch-*.jsonl")):
        os.remove(old)
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                f.write(json.dumps({"id": p["id"], "paper": p.get("paperTitle", "") or p["set"], "marks": p["marks"],
                                    "sections": [f"{s} {secs[s]}" for s in allowed(p, options)],
                                    "question": clip(p["text"], 700), "scheme": clip(p.get("msText", ""), 300)}, ensure_ascii=False) + "\n")
    print(f"{len(parts)} parts in {n} batches in {TAG}", file=sys.stderr)


def merge():
    spec = json.load(open(os.path.join(WORK, "spec.json")))["9PS0"]
    valid = {t["code"]: t["section"] for t in spec["topics"]}
    options = json.load(open(os.path.join(WORK, "paper2-options.json")))
    parts = {p["id"]: p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp")}
    tags, refused, missing = {}, [], 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        ans_path = path.replace(".jsonl", ".answers.json")
        got = json.load(open(ans_path)) if os.path.exists(ans_path) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if not codes:
                missing += 1
                continue
            ok = allowed(parts[pid], options)
            if valid[codes[0]] not in ok or (parts[pid]["set"].split("-")[0] != "9ps003" and any(valid[c] not in ok for c in codes)):
                refused.append((pid, codes, ok))
                continue
            tags[pid] = codes
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} with no answer, {len(refused)} refused", file=sys.stderr)
    for r in refused[:20]:
        print("  refused", r, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
