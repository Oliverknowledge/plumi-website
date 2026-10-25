"""Mark the science banks' practical questions, for the bank's "Practicals" filter.

    python3 scripts/question-bank/practicals.py split [--parts=<cut parts.json> ...] [--only=<bank slug>[,<bank slug>...]]
    python3 scripts/question-bank/practicals.py merge

A practical question is one about doing an experiment: planning or describing a
method, apparatus and techniques, variables and controls, taking measurements,
errors, uncertainty and precision, safety, or improving an experiment, and any
question set on a named required, core or PAG practical (see tag.md's "Practical
questions" section for the whole brief).

split reads every science bank's public/question-bank/<slug>/{parts,text}.json,
keeps the parts whose question or scheme mentions something practical (apparatus,
a method, variables, uncertainty, safety, a technique: PRACTICAL below, a wide net),
and writes them to .work/practicals/batch-NN.jsonl for a reader to judge one by one,
each answer going into batch-NN.answers.json ({"<part id>": true or false}). Pass the
cut parts.json files (--parts=) to give the reader each part's own words and its
scheme separately; without them it gets the search text, question and scheme run
together.

merge writes public/question-bank/<slug>/practicals.json, the ids judged practical,
keeping any judged before that weren't judged again. It is a file of its own, beside
the bank's data rather than in it, so rebuilding a bank leaves it alone; after a new
series, split with --only=<slug>, judge the batches, and merge.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.join(HERE, ".work", "practicals")
SIZE = 300
mode = sys.argv[1] if len(sys.argv) > 1 else "split"
PARTS = [a.split("=", 1)[1] for a in sys.argv[2:] if a.startswith("--parts=")]
ONLY = next((a.split("=", 1)[1].split(",") for a in sys.argv[2:] if a.startswith("--only=")), None)

PRACTICAL = re.compile(
    r"required practical|core practical|\brpa ?\d|\bpractical\b|apparatus|equipment|procedure|"
    r"describe (a|an|the) (method|procedure|experiment|investigation)|outline (a|the) method|describe how (you|the|a|they)\b|plan (an|a) (investigation|experiment)|"
    r"suggest (an?|one|two|how|why) (improvement|the student|the method)|improve (the|this|their) (method|experiment|investigation|accuracy|precision|reliability)|improvement|"
    r"(independent|dependent|control|controlled) variables?|fair test|"
    r"uncertaint|percentage error|precision|\bprecise\b|resolution|systematic error|random error|anomal|repeatab|reproducib|zero error|parallax|calibrat|"
    r"hazard|safety|risk assessment|precaution|goggles|fume cupboard|"
    r"burette|pipette|measuring cylinder|volumetric flask|thermometer|stopwatch|stop clock|metre rule|micrometer|vernier|calipers|data ?logger|light gate|"
    r"oscilloscope|voltmeter|ammeter|multimeter|newtonmeter|spring balance|colorimeter|water bath|bunsen|conical flask|boiling tube|"
    r"titrat|chromatograph|distillation|reflux|recrystalli|aseptic|serial dilution|quadrat|transect|potometer|respirometer|electrophoresis|eyepiece graticule|stage micrometer")


def banks():
    """The science banks: every subject whose name is Biology, Chemistry or Physics (any board, any letter)."""
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, "src", "content", "questionBank", "*.json"))):
        meta = json.load(open(path))
        if isinstance(meta, dict) and re.match(r"(Biology|Chemistry|Physics)\b", meta.get("subject", "")) and (not ONLY or meta["slug"] in ONLY):
            out.append(meta)
    return out


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(WORK, exist_ok=True)
    cut = {}
    for path in PARTS:
        for p in json.load(open(path)):
            cut.setdefault(p["id"], p)
    lines = []
    for meta in banks():
        pub = os.path.join(ROOT, "public", "question-bank", meta["slug"])
        text = json.load(open(os.path.join(pub, "text.json")))
        papers = {p["id"]: (p["name"] + (f": {p['title']}" if p.get("title") else "")) for p in meta["papers"]}
        for part in json.load(open(os.path.join(pub, "parts.json"))):
            words = text.get(part["id"], "")
            if not PRACTICAL.search(words):
                continue
            own = cut.get(part["id"])
            line = {"id": part["id"], "course": f"{meta['board']} {meta['level']} {meta['subject']}", "paper": papers.get(part["p"], part["p"])}
            if own:
                line["question"] = clip(own.get("text", ""), 650)
                line["scheme"] = clip(own.get("msText", ""), 260)
            else:
                line["text"] = clip(words, 900)
            lines.append(line)
    for old in glob.glob(os.path.join(WORK, "batch-*.jsonl")):
        os.remove(old)
    n = 0
    for i in range(0, len(lines), SIZE):
        n += 1
        with open(os.path.join(WORK, f"batch-{n:02d}.jsonl"), "w") as f:
            f.writelines(json.dumps(x, ensure_ascii=False) + "\n" for x in lines[i:i + SIZE])
    print(f"{len(lines)} candidates in {n} batches in {WORK} ({sum(1 for x in lines if 'question' in x)} with their own words)", file=sys.stderr)


def merge():
    yes, no, judged, missing = set(), set(), 0, 0
    for path in sorted(glob.glob(os.path.join(WORK, "batch-*.jsonl"))):
        ans_path = path.replace(".jsonl", ".answers.json")
        answers = json.load(open(ans_path)) if os.path.exists(ans_path) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            if pid not in answers:
                missing += 1
                continue
            judged += 1
            (yes if answers[pid] is True else no).add(pid)
    for meta in banks():
        pub = os.path.join(ROOT, "public", "question-bank", meta["slug"])
        # What was judged before and not judged again this time stays as it was.
        path = os.path.join(pub, "practicals.json")
        before = set(json.load(open(path))) if os.path.exists(path) else set()
        keep = (before - no) | yes
        ids = [p["id"] for p in json.load(open(os.path.join(pub, "parts.json"))) if p["id"] in keep]
        json.dump(ids, open(path, "w"), separators=(",", ":"))
        print(f"{meta['slug']}: {len(ids)} practical", file=sys.stderr)
    print(f"{judged} judged, {len(yes)} practical, {missing} not yet judged", file=sys.stderr)


if __name__ == "__main__":
    split() if mode == "split" else merge()
