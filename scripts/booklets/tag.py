"""Tag the cut MadAsMaths questions to the shared topic list (topics.json), in batches, and merge the answers.

    python3 scripts/booklets/tag.py split [--groups=basic,standard,statistics,mechanics:M1+M2] [--size=300]
    python3 scripts/booklets/tag.py merge

split writes <work-dir>/tag/topics.txt (the shared topics, one per line, with what each covers) and
batch-NN.jsonl, one question per line: its id, the booklet it's from (a strong hint: "Logarithms (exam
questions)"), its words and its answers' words, each clipped. A question already in tags.json isn't batched
again, so a later split (Further Maths, say) only adds batches. Each batch is tagged by a reader following
BRIEF below into batch-NN.tags.json, {"<id>": ["<topic code>", ...]}. merge collects them into
scripts/booklets/tags.json (committed), keeping only codes in topics.json, with tag/overrides.json's corrections over them.

--groups picks the booklets: a group's slug, or "mechanics:M1+M2" for the Mechanics booklets written for
those modules (the rest are Further Maths).

BRIEF (what each reader is told):
  For each line, choose the topic code(s) the question mainly tests, from topics.txt: the one a student would
  have to know to answer it. Add a second only where the question needs two in equal measure (a
  differentiation question about logarithms: differentiation-techniques and exponentials-logs). At most two.
  Judge by what the question asks and its answers; the booklet's name is a strong hint but not the answer (a
  "Functions" booklet question that is really about the modulus graph is still functions; one that is really
  a differentiation question is differentiation). Where a question needs Further Maths content, give that
  Further topic (complex-numbers, further-calculus, ...), even in a pure booklet. Every id gets a list.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.join(HERE, ".work")
TAG = os.path.join(WORK, "tag")
QUESTIONS = os.path.join(WORK, "questions", "questions.json")
TAGS = os.path.join(HERE, "tags.json")  # committed: the tagging can't be redone cheaply, unlike the cut
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
opt = dict(a[2:].split("=", 1) for a in sys.argv[2:] if a.startswith("--") and "=" in a)
SIZE = int(opt.get("size", 300))
GROUPS = opt.get("groups", "basic,standard,statistics,mechanics:M1+M2").split(",")


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + " …"


def chosen(meta):
    """{booklet slug: its label} for the booklets --groups picks."""
    out = {}
    for g in meta["groups"]:
        for rule in GROUPS:
            slug, _, mods = rule.partition(":")
            if slug != g["slug"]:
                continue
            for shelf in g["shelves"]:
                for b in shelf["booklets"]:
                    if mods and not set(b.get("modules") or []) & set(mods.split("+")):
                        continue
                    out[b["slug"]] = b["title"] + (f" ({b['kind'].lower()})" if b.get("kind") else "") + (f" [{'/'.join(b['modules'])}]" if b.get("modules") else "")
    return out


def split():
    os.makedirs(TAG, exist_ok=True)
    topics = json.load(open(os.path.join(HERE, "topics.json")))["topics"]
    open(os.path.join(TAG, "topics.txt"), "w").write("\n".join(
        f"{t['code']} | {t['title']}{' [Further Maths]' if t['level'] == 'further' else ''} — {t['text']}" for t in topics) + "\n")
    meta = json.load(open(os.path.join(ROOT, "src", "content", "booklets.json")))
    labels = chosen(meta)
    done = json.load(open(TAGS)) if os.path.exists(TAGS) else {}
    qs = [q for q in json.load(open(QUESTIONS)) if q["booklet"] in labels and q["id"] not in done]
    n = max([int(re.search(r"batch-(\d+)", f).group(1)) for f in glob.glob(os.path.join(TAG, "batch-*.jsonl"))] or [0])
    first = n + 1
    for i in range(0, len(qs), SIZE):
        n += 1
        with open(os.path.join(TAG, f"batch-{n:02d}.jsonl"), "w") as f:
            for q in qs[i:i + SIZE]:
                f.write(json.dumps({"id": q["id"], "booklet": labels[q["booklet"]], "question": clip(q["text"], 700),
                                    "answers": clip(q["answer"], 160)}, ensure_ascii=False) + "\n")
    print(f"batches {first}-{n}: {len(qs)} questions from {len(labels)} booklets, in {TAG}", file=sys.stderr)


def merge():
    valid = {t["code"] for t in json.load(open(os.path.join(HERE, "topics.json")))["topics"]}
    tags = json.load(open(TAGS)) if os.path.exists(TAGS) else {}
    missing, bad = [], 0
    for path in sorted(glob.glob(os.path.join(TAG, "batch-*.jsonl"))):
        out = path.replace(".jsonl", ".tags.json")
        got = json.load(open(out)) if os.path.exists(out) else {}
        for line in open(path):
            qid = json.loads(line)["id"]
            codes = [c for c in got.get(qid, []) if c in valid][:2]
            bad += len(got.get(qid, [])) - len([c for c in got.get(qid, []) if c in valid])
            if codes:
                tags[qid] = codes
            elif qid not in tags:
                missing.append(qid)
    overrides = os.path.join(TAG, "overrides.json")
    if os.path.exists(overrides):
        tags.update(json.load(open(overrides)))
    json.dump(tags, open(TAGS, "w"), indent=0)
    print(f"{len(tags)} questions tagged, {len(missing)} without a valid topic, {bad} unknown codes dropped"
          + (f": {missing[:8]}" if missing else ""), file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
