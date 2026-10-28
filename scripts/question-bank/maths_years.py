"""Mark the A-Level Maths banks' questions Year 12 or Year 13, for the bank's "Year" filter.

    python3 scripts/question-bank/maths_years.py split
    python3 scripts/question-bank/maths_years.py merge
    python3 scripts/question-bank/maths_years.py split-further   # A-Level Further Maths, the same way
    python3 scripts/question-bank/maths_years.py merge-further

A Year 12 student wants the questions they can already do: ones that need only the AS
(first-year) content. Where a paper says which it is, the paper decides: every AS paper
question is Year 12, and WJEC's A2 units and Cambridge's Papers 3 and 6, which test only
second-year content, are Year 13. A full A-Level paper (Edexcel 9MA0, OCR H240, OCR MEI
H640, AQA 7357) mixes both, so each of its questions is read against tag.md's "Year 12
or Year 13 (A-Level Maths)" brief.

split writes those questions to .work/maths-years/batch-NN.jsonl ({id, course, paper,
text}: the question, then its scheme); a reader writes batch-NN.answers.json,
{"<id>": 12 or 13} for every id. merge writes public/question-bank/<slug>/year13.json,
the ids that need Year 13 content, beside the bank's data rather than in it, so
rebuilding a bank leaves it alone (as practicals.json is). After a new series, split
again, read the new batches, and merge: what was read before is kept.

Further Maths (split-further, merge-further; .work/fm-years) is read the same way against each
board's own AS Further Maths specification (Pearson 8FM0, OCR H235, OCR MEI H635, kept as text in
.work/fm-years/spec/): a question is Year 12 when the AS core pure, and the AS paper of the same
option (a Further Statistics question against AS Further Statistics), cover every part, alongside
Year 12 Maths. Every AS paper question is Year 12. Cambridge's 9231 has no AS, so it isn't split.
"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.join(HERE, ".work", "maths-years")
SIZE = 200
READ = ["edexcel-a-level-maths", "ocr-a-level-maths", "ocr-mei-a-level-maths", "aqa-a-level-maths"]
# Papers that test only second-year content: every question on them is Year 13.
SECOND_YEAR = {"wjec-a-level-maths": {"1300u30", "1300u40"}, "caie-a-level-maths": {"97093", "97096"}}
BANKS = READ + list(SECOND_YEAR)
FM_WORK = os.path.join(HERE, ".work", "fm-years")
# Each Further Maths bank and its board's AS specification, as text, for the reader.
FM = {"edexcel-a-level-further-maths": "spec/edexcel-as-fm.txt", "ocr-a-level-further-maths": "spec/ocr-as-fm.txt",
      "ocr-mei-a-level-further-maths": "spec/mei-as-fm.txt"}
FM_SIZE = 180


def load(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    pub = os.path.join(ROOT, "public", "question-bank", slug)
    return meta, json.load(open(os.path.join(pub, "parts.json"))), pub


def clip(s, n):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"


def split():
    os.makedirs(WORK, exist_ok=True)
    lines = []
    for slug in READ:
        meta, parts, pub = load(slug)
        text = json.load(open(os.path.join(pub, "text.json")))
        papers = {p["id"]: p for p in meta["papers"]}
        for part in parts:
            paper = papers[part["p"]]
            if paper.get("as"):
                continue
            lines.append({"id": part["id"], "course": f"{meta['board']} A-Level Maths", "paper": paper["name"],
                          "text": clip(text.get(part["id"], part["x"]), 2400)})
    for old in glob.glob(os.path.join(WORK, "batch-*.jsonl")):
        os.remove(old)
    n = 0
    for i in range(0, len(lines), SIZE):
        n += 1
        with open(os.path.join(WORK, f"batch-{n:02d}.jsonl"), "w") as f:
            f.writelines(json.dumps(x, ensure_ascii=False) + "\n" for x in lines[i:i + SIZE])
    print(f"{len(lines)} questions in {n} batches in {WORK}", file=sys.stderr)


def merge():
    answers, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(WORK, "batch-*.jsonl"))):
        ans_path = path.replace(".jsonl", ".answers.json")
        got = json.load(open(ans_path)) if os.path.exists(ans_path) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            if got.get(pid) in (12, 13):
                answers[pid] = got[pid]
            else:
                missing += 1
    for slug in BANKS:
        meta, parts, pub = load(slug)
        papers = {p["id"]: p for p in meta["papers"]}
        path = os.path.join(pub, "year13.json")
        before = set(json.load(open(path))) if os.path.exists(path) else set()
        ids = []
        for p in parts:
            if papers[p["p"]].get("as"):
                continue
            if p["p"] in SECOND_YEAR.get(slug, ()) or answers.get(p["id"]) == 13 or (p["id"] not in answers and p["id"] in before):
                ids.append(p["id"])
        json.dump(ids, open(path, "w"), separators=(",", ":"))
        print(f"{slug}: {len(parts) - len(ids)} Year 12, {len(ids)} Year 13", file=sys.stderr)
    print(f"{len(answers)} read, {missing} not yet read", file=sys.stderr)


def split_further():
    os.makedirs(FM_WORK, exist_ok=True)
    for old in glob.glob(os.path.join(FM_WORK, "batch-*.jsonl")):
        os.remove(old)
    n = 0
    for slug, spec in FM.items():  # a batch is one board's, so its reader keeps one specification open
        meta, parts, pub = load(slug)
        text = json.load(open(os.path.join(pub, "text.json")))
        papers = {p["id"]: p for p in meta["papers"]}
        lines = [{"id": p["id"], "course": f"{meta['board']} A-Level Further Maths", "paper": papers[p["p"]]["name"],
                  "as_spec": os.path.join(FM_WORK, spec), "text": clip(text.get(p["id"], p["x"]), 2400)}
                 for p in parts if not papers[p["p"]].get("as")]
        for i in range(0, len(lines), FM_SIZE):
            n += 1
            with open(os.path.join(FM_WORK, f"batch-{n:02d}.jsonl"), "w") as f:
                f.writelines(json.dumps(x, ensure_ascii=False) + "\n" for x in lines[i:i + FM_SIZE])
        print(f"{slug}: {len(lines)} questions to read", file=sys.stderr)
    print(f"{n} batches in {FM_WORK}", file=sys.stderr)


def merge_further():
    answers, missing = {}, 0
    for path in sorted(glob.glob(os.path.join(FM_WORK, "batch-*.jsonl"))):
        got = json.load(open(path.replace(".jsonl", ".answers.json"))) if os.path.exists(path.replace(".jsonl", ".answers.json")) else {}
        for line in open(path):
            pid = json.loads(line)["id"]
            if got.get(pid) in (12, 13):
                answers[pid] = got[pid]
            else:
                missing += 1
    for slug in FM:
        meta, parts, pub = load(slug)
        papers = {p["id"]: p for p in meta["papers"]}
        path = os.path.join(pub, "year13.json")
        before = set(json.load(open(path))) if os.path.exists(path) else set()
        ids = [p["id"] for p in parts if not papers[p["p"]].get("as")
               and (answers.get(p["id"]) == 13 or (p["id"] not in answers and p["id"] in before))]
        json.dump(ids, open(path, "w"), separators=(",", ":"))
        print(f"{slug}: {len(parts) - len(ids)} Year 12, {len(ids)} Year 13", file=sys.stderr)
    print(f"{len(answers)} read, {missing} not yet read", file=sys.stderr)


if __name__ == "__main__":
    {"split": split, "merge": merge, "split-further": split_further, "merge-further": merge_further}[sys.argv[1] if len(sys.argv) > 1 else "split"]()
