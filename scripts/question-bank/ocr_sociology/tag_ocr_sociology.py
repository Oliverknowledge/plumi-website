"""Split the cut OCR Sociology (or, with --psychology, Psychology) questions into batches for topic
tagging, and merge the answers back.

    python3 scripts/question-bank/ocr_sociology/tag_ocr_sociology.py split [batch-size] [--psychology]
    python3 scripts/question-bank/ocr_sociology/tag_ocr_sociology.py merge [--psychology]

ocr_law/tag_ocr_law.py's sibling; the brief is tag.md's, with its OCR Sociology and Psychology section.
split writes tag/<subject>-topics.txt and batch-NN-<subject>.jsonl; each batch is tagged into
batch-NN-<subject>.tags.json, and merge collects them into tags.json for the build, with
tag/overrides.json's corrections over them. A question already in tags.json isn't batched again.
merge keeps a question to its paper's sections (ALLOWED), and an option's question to its option's.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PSY = "--psychology" in sys.argv
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
mode = ARGS[0] if ARGS else "split"
SIZE = int(ARGS[1]) if len(ARGS) > 1 else 80
NAME, SPEC = ("psychology", "H567") if PSY else ("sociology", "H580")
WORK = os.path.join(HERE, "..", ".work", f"ocr-{NAME}")
TAG = os.path.join(WORK, "tag")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from tag_pearson import clip  # noqa: E402

NOISE = re.compile(r"© OCR \d{4}|\.{6,}|Turn over ►?|Your answer", re.I)
# The sections a paper's questions can be tagged to (a research methods question can come up on any
# Psychology paper; an option's sections only on its own questions).
ALLOWED = {"h56701": {"1"}, "h56702": {"1", "2A", "2B", "2C"}, "h56703": {"1", "2B", "3A"},
           "h58001": {"1A"}, "h58002": {"2A", "2B"}, "h58003": {"3A"}}


def tree():
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    return spec[SPEC]


def split():
    os.makedirs(TAG, exist_ok=True)
    t = tree()
    sections = {s["code"]: s for s in t["sections"]}
    lines = [f"{x['code']} | {sections[x['section']]['title']}" + (f" [option: {sections[x['section']]['option']}]" if sections[x['section']].get("option") else "")
             + f" | {x['title']} — {clip(x['text'], 400)}" for x in t["topics"]]
    open(os.path.join(TAG, f"{NAME}-topics.txt"), "w").write("\n".join(lines) + "\n")
    done = json.load(open(os.path.join(WORK, "tags.json"))) if os.path.exists(os.path.join(WORK, "tags.json")) else {}
    parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if p.get("qp") and p["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)-", f).group(1)) for f in glob.glob(os.path.join(TAG, f"batch-*-{NAME}.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(parts), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}-{NAME}.jsonl"), "w") as f:
            for p in parts[i:i + SIZE]:
                own = NOISE.sub(" ", p.get("own") or p["text"])
                setup = NOISE.sub(" ", p["text"][len(p.get("own") or ""):]) if p.get("stem") else ""
                f.write(json.dumps({"id": p["id"], "paper": int(p["component"][-2:]), "option": p.get("option"), "label": p["label"], "marks": p["marks"],
                                    "setup": clip(setup, 300), "question": clip(own, 500), "scheme": clip(p.get("msText", ""), 400)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n} for {len(parts)} questions not yet tagged, in {TAG}", file=sys.stderr)


def merge():
    t = tree()
    section_of = {x["code"]: x["section"] for x in t["topics"]}
    option_of = {s["code"]: s["option"] for s in t["sections"] if s.get("option")}
    parts = {p["id"]: p for p in json.load(open(os.path.join(WORK, "parts.json")))}
    tags, missing, dropped = {}, [], 0
    for path in sorted(glob.glob(os.path.join(TAG, f"batch-*-{NAME}.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            p = parts.get(pid)
            if not p:
                continue
            ok = ALLOWED[p["component"]] | {s for s, o in option_of.items() if o == p.get("option")}
            raw = [c for c in got.get(pid, []) if c in section_of]
            codes = [c for c in raw if section_of[c] in ok][:2]
            dropped += len(raw) - len([c for c in raw if section_of[c] in ok])
            if codes:
                tags[pid] = codes
            else:
                missing.append(pid)
    overrides = os.path.join(TAG, "overrides.json")  # corrections made on review, {id: [codes]}
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} tagged, {dropped} codes off the paper dropped, {len(missing)} without a valid topic" + (f": {missing[:10]}" if missing else ""), file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
