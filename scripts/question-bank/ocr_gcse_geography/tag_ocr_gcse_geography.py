"""Split the cut OCR GCSE Geography B (J384) parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/ocr_gcse_geography/tag_ocr_gcse_geography.py split [work-dir] [batch-size]
    python3 scripts/question-bank/ocr_gcse_geography/tag_ocr_gcse_geography.py merge [work-dir]

aqa_gcse_geography/tag_gcse_geography.py for OCR's J384: split writes <work-dir>/tag/geography-b-topics.txt and
<work-dir>/tag/batch-NN-geography-b.jsonl, one part per line with the codes it may take ("first", "second"), and
each batch is tagged following ../tag.md's "OCR GCSE Geography B" section into batch-NN-geography-b.tags.json.
merge writes <work-dir>/tags.json for build_ocr_gcse_geography.py.

A question's area is the topic heading it is printed under (cut_ocr_gcse_geography.py's "area": "Global Hazards",
"Option B – Sustaining Ecosystems", "Human Geography Fieldwork"): its parts take that topic's codes first, so a
student who skips an option never meets it. Fieldwork questions take F1-F6 first. Geographical Exploration
(Paper 3) is synoptic and prints no headings: its parts take any content topic. A second code comes from
Geographical Skills (9.x) or, for fieldwork and Paper 3, from the content topics.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "ocr-gcse-geography")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 110
TAG = os.path.join(WORK, "tag")
PAPER = {"j38401": "Paper 1 Our Natural World", "j38402": "Paper 2 People and Society", "j38403": "Paper 3 Geographical Exploration"}
NOISE = re.compile(r"© OCR \d{4}|\.{6,}|…{3,}|Turn over", re.I)


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def allowed(p, tree):
    """(first, second): the codes a part may take."""
    sections = {s["title"].lower(): s["code"] for s in tree["sections"]}
    content = [t["code"] for t in tree["topics"] if t["section"] in "12345678"]
    skills = [t["code"] for t in tree["topics"] if t["section"] == "9"]
    field = [t["code"] for t in tree["topics"] if t["section"] == "F"]
    area = (p.get("area") or "").lower()
    if "fieldwork" in area:
        return field, content + skills
    sec = next((code for title, code in sections.items() if title in area), None)
    if sec:
        return [t["code"] for t in tree["topics"] if t["section"] == sec], skills
    return content, content + skills  # Paper 3


def split():
    os.makedirs(TAG, exist_ok=True)
    tree = json.load(open(os.path.join(WORK, "spec.json")))["J384"]
    sections = {s["code"]: s["title"] for s in tree["sections"]}
    open(os.path.join(TAG, "geography-b-topics.txt"), "w").write("".join(
        f"{t['code']} | {t['section']} {sections[t['section']]} | {t['title']} — {clip(t['text'], 420)}\n" for t in tree["topics"]))
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)-", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*-geography-b.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-geography-b.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                a, b = allowed(p, tree)
                f.write(json.dumps({"id": p["id"], "paper": PAPER[p["component"]], "area": p.get("area") or "synoptic (no topic heading)",
                                    "first": a, "second": b, "marks": p["marks"], "question": clip(NOISE.sub(" ", p["text"]), 700),
                                    "scheme": clip(p.get("msText", ""), 400)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(parts)} parts not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    tags = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    missing = []
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*-geography-b.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            row = json.loads(line)
            codes = got.get(row["id"], [])
            first = [c for c in codes[:1] if c in row["first"]]
            second = [c for c in codes[1:2] if c in row["second"] and c not in first]
            if first:
                tags[row["id"]] = first + second
            else:
                missing.append(row["id"])
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {len(missing)} without a valid first topic", file=sys.stderr)
    for m in missing:
        print("  ", m, file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
