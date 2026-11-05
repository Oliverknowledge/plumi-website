"""Mark the A-Level Biology banks' questions Year 12 or Year 13, for the bank's "Year" filter.

    python3 scripts/question-bank/biology_years.py            # write year13.json for every Biology bank
    python3 scripts/question-bank/biology_years.py --check    # print the counts and what each rule did, write nothing
    python3 scripts/question-bank/biology_years.py --sample N # print N random parts from each side of each rule

A Year 12 student wants the questions they can already do: ones that need only the AS
(first-year) content. Biology, unlike maths, is split by topic: each board's specification
puts every topic in the AS (first year) or the second-year content, and the bank's meta
records that as the topic's `year` (1 AS, 2 second year, 3 Eduqas's second-year options
Immunology, Musculoskeletal Anatomy, Neurobiology). So, per part:

  1. a part on an AS paper is Year 12 (an AS paper can't test second-year content);
  2. a part on a full A-Level paper is Year 13 when any of its topics is second-year
     content, and Year 12 when all its topics are AS content;
  3. a part whose tag is wrong, found by reading, goes by what it asks (HAND_READ below).

Hand-read (not every part: the tags are right far more often than not): every WJEC Unit 3/4
and Cambridge Paper 4/5 part tagged only AS topics (27 + 16, the odd ones out on papers that
test second-year content); AQA's full-paper 3.7.3 "Evolution may lead to speciation" parts (21:
several are only natural selection, which AQA examines at AS under 3.4.4); and the full-paper
parts whose wording used second-year terms that no AS paper of the bank uses while tagged AS
(about 60, across all eight banks, of which none besides those below were wrong); plus about
12 random parts from each side of each rule per bank (96 in all), none wrong.

The maths banks' year13.json is the same file in the same place (the ids of the Year 13
parts, beside the bank's data so a rebuild leaves it alone); maths_years.py is untouched.

Why the tags can be trusted: for every one of the eight banks, each AS topic is drawn on by
the board's AS papers and no second-year topic is, bar AQA's 3.5.1, 3.5.2, 3.7.2, 3.7.3 and
3.7.4 (21 parts on AS papers, kept Year 12 by rule 1). Boards' specifications checked
(public pages only): AQA 7401/7402 (AS 3.1-3.4), Pearson Edexcel 9BN0 (Topics 1-4) and
9BI0 (Topics 1-4), OCR H020/H420 (modules 1-4) and H022/H422 (modules 1-3), WJEC / Eduqas
(AS Units 1-2), Cambridge 9700 (AS topics 1-11, A Level 12-19).
"""
import json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BANKS = ["aqa-a-level-biology", "edexcel-a-level-biology-a", "edexcel-a-level-biology-b", "ocr-a-level-biology-a",
         "ocr-a-level-biology-b", "eduqas-a-level-biology", "wjec-a-level-biology", "caie-a-level-biology"]


# Parts read by hand whose topic tag puts them in the wrong year. {part id: year}
HAND_READ = {
    # AQA: natural selection, adaptation or reading a figure, tagged 3.7.3 (second-year speciation) but AS content (3.4.3, 3.4.4).
    "74022-nov20-10-4": 12, "74022-nov20-10-5": 12, "74021-jun23-03-4": 12, "74021-jun23-03-5": 12,
    "74022-jun18-09-1": 12, "74022-spec-06-2": 12, "74022-jun24-10-1": 12, "74022-jun24-10-2": 12,
    "74022-jun22-05-1": 12, "74023-jun22-05-6": 12,
    # WJEC A2 units, tagged with AS topics but asking second-year content: ATP as the energy currency, photosynthetic pigments'
    # action spectrum, the electron transport chain, the kidney and dialysis, the options (musculoskeletal anatomy, immunology:
    # AS Unit 2 has no immunology), proto-oncogenes.
    "1400u30-jun23-02-d": 13, "1400u30-jun23-03-ai": 13, "1400u30-jun19-04-avi": 13, "1400u30-jun18-06-bi": 13,
    "1400u30-jun18-06-bii": 13, "1400u30-jun17-03-bi": 13, "1400u40-jun18-07-ai": 13, "1400u40-jun18-07-aii": 13,
    "1400u40-jun18-07-bi": 13, "1400u40-jun17-07-bi": 13, "1400u40-jun17-07-bii": 13, "1400u40-jun17-08-ai": 13,
    "1400u40-jun19-04-ai": 13,
}


def load(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    pub = os.path.join(ROOT, "public", "question-bank", slug)
    return meta, json.load(open(os.path.join(pub, "parts.json"))), pub


def classify(slug):
    """-> (meta, pub, {part id: (year, rule)}), rule one of "as-paper", "as-topics", "second-year-topic", "hand-read"."""
    meta, parts, pub = load(slug)
    papers = {p["id"]: p for p in meta["papers"]}
    topic_year = {t["code"]: t["year"] for t in meta["topics"]}
    out = {}
    for p in parts:
        if p["id"] in HAND_READ and not papers[p["p"]].get("as"):
            out[p["id"]] = (HAND_READ[p["id"]], "hand-read")
        elif papers[p["p"]].get("as"):
            out[p["id"]] = (12, "as-paper")
        elif any(topic_year[t] >= 2 for t in p["t"]):  # a KeyError here is a topic the meta doesn't list: stop and look
            out[p["id"]] = (13, "second-year-topic")
        else:
            out[p["id"]] = (12, "as-topics")
    return meta, pub, out


def main():
    args = sys.argv[1:]
    check = "--check" in args
    sample = int(args[args.index("--sample") + 1]) if "--sample" in args else 0
    for slug in BANKS:
        meta, pub, out = classify(slug)
        ids13 = [i for i, (y, _) in out.items() if y == 13]
        by_rule = {}
        for _, r in out.values():
            by_rule[r] = by_rule.get(r, 0) + 1
        print(f"{slug}: {len(out) - len(ids13)} Year 12, {len(ids13)} Year 13  {by_rule}", file=sys.stderr)
        if sample:
            text = json.load(open(os.path.join(pub, "text.json")))
            rnd = random.Random(slug)
            for rule in ("as-topics", "second-year-topic", "hand-read"):
                pool = [i for i, (_, r) in out.items() if r == rule]
                for i in rnd.sample(pool, min(sample, len(pool))):
                    print(f"[{slug}] {rule} {i}: {' '.join((text.get(i) or '').split())[:420]}")
        if not check and not sample:
            # Parts are written in parts.json order, as maths_years.py writes them.
            parts = json.load(open(os.path.join(pub, "parts.json")))
            json.dump([p["id"] for p in parts if out[p["id"]][0] == 13], open(os.path.join(pub, "year13.json"), "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
