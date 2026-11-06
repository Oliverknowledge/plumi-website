"""Write a question bank's MadAsMaths questions: the rows its "Add MadAsMaths questions" switch mixes in.

    python3 scripts/booklets/bank.py <bank slug>     # after cut.py and tag.py merge; the bank needs a map in topics.json
    python3 scripts/question-bank/upload_r2.py scripts/booklets/.work/bank-upload --crops-only
    python3 scripts/question-bank/upload_data.py <bank slug> --verify

Reads <work-dir>/questions/questions.json (cut.py), scripts/booklets/tags.json (tag.py merge, committed), topics.json
(the shared topics and each bank's map from them) and src/content/booklets.json (each booklet's name). A question
goes in where any of its topics maps to one of the bank's (topics that map to null, Poisson for Edexcel A-Level
Maths, are beyond its specification); it carries the bank's codes its topics map to.

Writes public/question-bank/<slug>/madas.json, in the bank's own row shape (BankPart) so every crop, scheme
reveal, saved question and downloaded set works on it as it is:
  id   madas-<booklet>-<NNN>      its crops are bank/<id>-qp.webp and -ms.webp, beside the bank's own
  p    madas-<booklet>[-<k>]      its "paper": the booklet, and k for its k-th run of numbers (Poisson's sections
                                  each start at Question 1, so a question's number is unique within its p)
  s    MADAS                      its "series"
  l    the number it's printed with; m null (MadAsMaths prints no marks); ms 1 (its answers and worked solution)
  t    the bank's topic codes; w, h its question crop's size; x its opening words
  mm   the booklet's name, for the row's label ("Logarithms (exam questions)"); mst its stars as printed ("***+")
and copies their crops to <work-dir>/bank-upload/img/ for upload_r2.py (which puts img/*.webp under bank/).
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.join(HERE, ".work")
Q = os.path.join(WORK, "questions")
UPLOAD = os.path.join(WORK, "bank-upload", "img")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    slug = sys.argv[1]
    spec = json.load(open(os.path.join(HERE, "topics.json")))
    if slug not in spec["banks"]:
        sys.exit(f"{slug}: no map in topics.json")
    mapping = spec["banks"][slug]
    bank = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    codes = {t["code"] for t in bank["topics"]}
    unknown = sorted({c for c in mapping.values() if c and c not in codes})
    if unknown:
        sys.exit(f"{slug}: the map names codes the bank doesn't have: {unknown}")
    meta = json.load(open(os.path.join(ROOT, "src", "content", "booklets.json")))
    names = {b["slug"]: b["title"] + (f" ({b['kind'].lower()})" if b.get("kind") else "") + (f", {'/'.join(b['modules'])}" if b.get("modules") else "")
             for g in meta["groups"] for s in g["shelves"] for b in s["booklets"]}
    tags = json.load(open(os.path.join(HERE, "tags.json")))
    questions = json.load(open(os.path.join(Q, "questions.json")))
    rows, runs, last = [], {}, {}
    shutil.rmtree(os.path.dirname(UPLOAD), ignore_errors=True)
    os.makedirs(UPLOAD)
    for q in questions:  # in booklet order, so a fall in the printed number starts a new run
        b = q["booklet"]
        if q["n"] <= last.get(b, 0):
            runs[b] = runs.get(b, 0) + 1
        last[b] = q["n"]
        topics = tags.get(q["id"])
        if not topics:
            continue
        mapped = [mapping.get(t) for t in topics]
        # Every topic it needs must be in the specification: a question that also needs Poisson isn't for this bank.
        if not mapped or any(m is None for m in mapped):
            continue
        row = {"id": q["id"], "p": f"madas-{b}" + (f"-{runs[b] + 1}" if runs.get(b) else ""), "s": "MADAS", "l": str(q["n"]), "m": None,
               "t": list(dict.fromkeys(mapped)), "w": q["w"], "h": q["h"], "ms": 1,
               "x": re.sub(r"\s+", " ", q["text"]).strip()[:160], "mm": names[b]}
        if q["stars"]:
            row["mst"] = q["stars"]
        rows.append(row)
        for kind in ("qp", "ms"):
            shutil.copyfile(os.path.join(Q, "img", f"{q['id']}-{kind}.webp"), os.path.join(UPLOAD, f"{q['id']}-{kind}.webp"))
    out = os.path.join(ROOT, "public", "question-bank", slug)
    os.makedirs(out, exist_ok=True)
    json.dump(rows, open(os.path.join(out, "madas.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    counts = {}
    for r in rows:
        for c in r["t"]:
            counts[c] = counts.get(c, 0) + 1
    tagged = sum(1 for q in questions if q["id"] in tags)
    print(f"{slug}: {len(rows)} MadAsMaths questions of {tagged} tagged ({tagged - len(rows)} need content beyond its specification); "
          f"{len(rows) * 2} crops in {os.path.dirname(UPLOAD)}", file=sys.stderr)
    print("  by topic: " + ", ".join(f"{c} {n}" for c, n in sorted(counts.items(), key=lambda kv: (kv[0][0], int(kv[0].split('.')[1])))), file=sys.stderr)


if __name__ == "__main__":
    main()
