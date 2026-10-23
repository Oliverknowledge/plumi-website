"""Split the cut parts into batches for topic tagging, and merge the answers back.

    python3 scripts/question-bank/tag_batches.py split [work-dir] [batch-size]
    python3 scripts/question-bank/tag_batches.py merge [work-dir]

split writes <work-dir>/tag/<subject>-topics.txt (the spec's topics, one per
line) and <work-dir>/tag/batch-NN.jsonl, one part per line: its id, the start of
its question, its own words and the start of its mark scheme. Each batch is then
tagged (see tag.md) into batch-NN.tags.json: {"<part id>": ["3.2.2"], ...}.
merge combines them into <work-dir>/tags.json for build_bank.py, dropping any
code that is not a topic of that part's specification.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
WORK = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(HERE, ".work")
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 260
TAG = os.path.join(WORK, "tag")
SUBJECT = {"7401": "biology", "7402": "biology", "7404": "chemistry", "7405": "chemistry", "7407": "physics", "7408": "physics"}
# Edexcel (work dir .work-edexcel): topics come from edexcel_topics.json, by subject.
EDEXCEL = os.path.exists(os.path.join(WORK, "manifest.json")) and "edexcel" in os.path.basename(WORK)
if EDEXCEL:
    sys.path.insert(0, HERE)
    from build_bank_edexcel import SUBJECTS as EDX_SUBJECTS  # noqa: E402
    SUBJECT = {spec: key for _, _, key, specs in EDX_SUBJECTS for spec in specs}
    EDX_TOPICS = json.load(open(os.path.join(HERE, "edexcel_topics.json")))


# AQA GCSE (work dir .work-gcse): spec.json is keyed by the GCSE spec codes.
GCSE = "gcse" in os.path.basename(WORK)
if GCSE:
    SUBJECT = {"8461": "biology", "8462": "chemistry", "8463": "physics"}


def topics_for(subject):
    """[{code, title, level, text}] for a subject key."""
    if EDEXCEL:
        return EDX_TOPICS[subject]
    spec = json.load(open(os.path.join(WORK, "spec.json")))
    if GCSE:
        return spec[{v: k for k, v in SUBJECT.items()}[subject]]
    return spec[{"biology": "7402", "chemistry": "7405", "physics": "7408"}[subject]]


def scheme_refs(parts):
    """GCSE mark schemes print each row's specification reference ("AO1 4.3.1.1"): the
    board's own tag. {part id: ["4.3.1"]}, read from the part's own row only, since a
    scheme crop can run into the next one. June 2019's schemes print "1.1" for "01.1"."""
    labels, valid, out = {}, {}, {}
    for p in parts:
        labels.setdefault(p["set"], set()).update({p["label"], p["label"].lstrip("0")})
    for p in parts:
        ms, label = p.get("msText", ""), p["label"]
        at = ms.find(label) if label in ms else ms.find(label.lstrip("0"))
        if at < 0:
            continue
        rest = ms[at + len(label):]
        ends = [m.start() for m in re.finditer(r"(?<![\d.])(\d{1,2}\.\d{1,2})(?![\d.])", rest)
                if m.group(1) in labels[p["set"]] and m.group(1) not in (label, label.lstrip("0"))]
        row = rest[:min(ends)] if ends else rest
        if p["spec"] not in valid:
            valid[p["spec"]] = {n["code"] for n in topics_for(SUBJECT[p["spec"]]) if n["level"] == 2}
        codes = [c for c in dict.fromkeys(re.findall(r"(?<![\d.])(4\.\d{1,2}\.\d{1,2})", row)) if c in valid[p["spec"]]]
        if codes:
            out[p["id"]] = codes[:2]
    return out


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(TAG, exist_ok=True)
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    subjects = sorted(set(SUBJECT.values()))
    for subject in subjects:
        lines = [f"{n['code']} {n['title']}" + (f" — {clip(n['text'], 220)}" if n["level"] == 2 else "")
                 for n in topics_for(subject) if n["level"] <= 2]
        open(os.path.join(TAG, f"{subject}-topics.txt"), "w").write("\n".join(lines) + "\n")
    n = 0
    refs = {}
    if GCSE:  # parts the scheme already tags need no tagger
        refs = scheme_refs([p for p in parts if p["spec"] in SUBJECT])
        json.dump(refs, open(os.path.join(TAG, "refs.json"), "w"), indent=0)
        print(f"{len(refs)} parts tagged by their scheme's spec reference", file=sys.stderr)
    for subject in subjects:
        mine = [p for p in parts if SUBJECT.get(p["spec"]) == subject and p.get("qp") and p["id"] not in refs]
        for i in range(0, len(mine), SIZE):
            n += 1
            with open(os.path.join(TAG, f"batch-{n:02d}-{subject}.jsonl"), "w") as f:
                for p in mine[i:i + SIZE]:
                    own = p["text"]
                    if EDEXCEL:  # a whole question: give the tagger more of it, and the paper it's from
                        f.write(json.dumps({"id": p["id"], "paper": p.get("paperTitle", "")[:90], "question": clip(own, 520),
                                            "scheme": clip(p.get("msText", ""), 200)}, ensure_ascii=False) + "\n")
                        continue
                    q, _, part = p["label"].partition(".")
                    m = re.search(r"\s*".join(q) + (r"\s*\.\s*" + r"\s*".join(part) if part else "") + r"\s+(.*)", own)
                    setup = own[: m.start()] if m and part else ""
                    f.write(json.dumps({"id": p["id"], "setup": clip(setup, 160), "question": clip(m.group(1) if m else own, 320),
                                        "scheme": clip(p.get("msText", ""), 160)}, ensure_ascii=False) + "\n")
    print(f"{n} batches in {TAG}", file=sys.stderr)


def merge():
    tags, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        ids = [json.loads(line)["id"] for line in open(path)]
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for pid in ids:
            spec = pid[:4].upper() if EDEXCEL else pid[:4]
            if spec not in SUBJECT:  # a spec since dropped from the bank
                continue
            valid = {n["code"] for n in topics_for(SUBJECT[spec]) if n["level"] == 2}
            codes = [c for c in got.get(pid, []) if c in valid][:2]
            if codes:
                tags[pid] = codes
            else:
                missing += 1
    # GCSE: the scheme's own spec references, from split.
    refs = os.path.join(TAG, "refs.json")
    if GCSE and os.path.exists(refs):
        tags.update(json.load(open(refs)))
    # Hand corrections, applied last: {"<part id>": ["3.6.2"]}.
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        for pid, codes in json.load(open(overrides)).items():
            tags[pid] = codes
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    print(f"{len(tags)} parts tagged, {missing} without a valid topic", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
