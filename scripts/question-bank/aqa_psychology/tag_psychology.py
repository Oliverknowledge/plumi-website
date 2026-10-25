"""Split the cut Psychology questions into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/aqa_psychology/tag_psychology.py split [work-dir] [batch-size]
    python3 scripts/question-bank/aqa_psychology/tag_psychology.py merge [work-dir]

tag_ocr.py's sibling for AQA Psychology; the brief is tag.md's, with its AQA
Psychology section. split writes <work-dir>/tag/psychology-topics.txt and
batch-NN-psychology.jsonl, one question per line with the paper section it sits
in ("Section C: Schizophrenia", read from the paper's headings, which the crops
leave out); each batch is tagged into batch-NN-psychology.tags.json, and merge
collects them into <work-dir>/tags.json for build_psychology.py.
"""
import glob, json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, "..", ".work", "aqa-psychology")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 170
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.dirname(HERE))
import cut  # noqa: E402
from build_psychology import SERIES  # noqa: E402


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def sections(qp_path):
    """{question: "Section C: Schizophrenia"}, from the paper's section headings and "Topic:" lines."""
    doc = pymupdf.open(qp_path)
    out, current = {}, ""
    for page in doc:
        events = [(y, "label", q) for y, q, p in cut.left_labels(page, 75, True)]
        lines = cut.text_lines(page, page.rect)
        for k, (y, x, t) in enumerate(lines):
            if m := re.match(r"^Section ([A-D])\s*$", t):
                title = next((t2 for y2, x2, t2 in lines[k + 1:] if y2 > y + 4 and not re.match(r"Do not write|outside the|box$", t2)), "")
                events.append((y, "section", f"Section {m.group(1)}: {title}"))
            if m := re.match(r"^Topic:\s*(.+)$", t):
                events.append((y, "topic", m.group(1).strip()))
        # Top to bottom: a heading changes the current section, and each label takes it.
        for y, kind, val in sorted(events, key=lambda e: e[0]):
            if kind == "section":
                current = val
            elif kind == "topic":
                current = re.sub(r":.*$", "", current) + f": {val}"
            else:
                out.setdefault(val, current)
    return out


def strip_levels(ms):
    """A levels-of-response scheme: the levels table is the same for every essay; keep what it credits."""
    return re.sub(r"Level Marks Description.*?(?=Possible content|Possible application|$)", " ", ms)


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p["series"] in SERIES and p.get("qp")]
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7182"]
    names = {s["code"]: s["title"] for s in tree["sections"]}
    lines = [f"{t['code']} | {names[t['section']]} | {t['title']} — {clip(t['text'], 600)}" for t in tree["topics"]]
    open(os.path.join(TAG, "psychology-topics.txt"), "w").write("\n".join(lines) + "\n")
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    qp = {f"{f['component']}-{f['series']}".lower(): os.path.join(WORK, "pdf", f["file"]) for f in manifest if f["kind"] == "qp"}
    secs = {s: sections(qp[s]) for s in {p["set"] for p in parts}}
    n = 0
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-psychology.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                text = re.sub(r"Extra space|Do not write outside the box|Turn over ►?|You may use this space to plan your answer\.?", " ", p["text"])
                f.write(json.dumps({"id": p["id"], "paper": ("AS " if p["spec"] == "7181" else "A-Level ") + p["component"][-1],
                                    "section": secs[p["set"]].get(p["question"], ""), "marks": p["marks"],
                                    "question": clip(text, 700), "scheme": clip(strip_levels(p.get("msText", "")), 360)}, ensure_ascii=False) + "\n")
    print(f"{n} batches of {len(parts)} questions in {TAG}", file=sys.stderr)


def merge():
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7182"]
    valid = {t["code"] for t in tree["topics"]}
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} questions tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
