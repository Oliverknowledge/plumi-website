"""Mark the A-Level Physics banks' questions Year 12 or Year 13, for the bank's "Year" filter.

    python3 scripts/question-bank/physics_years.py            # write year13.json for every Physics bank
    python3 scripts/question-bank/physics_years.py --check    # only print the counts

Physics topics belong to one year or the other, so the split is by rule, not by reading each question.
Each topic in a bank's meta carries a `year` (1 = the AS content, 2 = A-Level only, 3 = a Paper 3
option, A-Level only too), taken from the board's own specification and checked against its AS papers
(every topic an AS paper asks about is year 1, and every year 1 topic turns up in an AS paper, except
OCR A's "Circuit symbols", one question). The topic years, by board:

    AQA 7407/7408      3.1-3.5 are AS; 3.6-3.13 are marked "(A-level only)" in the specification
    Edexcel 8PH0/9PH0  Topics 1-5 are AS; 6-13 are A-Level only
    OCR A H156/H556    Modules 1-4 are AS; 5-6 are A-Level only
    OCR B H157/H557    "The first four modules comprise the AS"; modules 5-6 are A-Level only
    Eduqas A420/B420   the AS lists 1.1-1.4, 2.1-2.3, 2.5, 2.7, 3.1-3.5, 3.7; the rest, and the options 3.A-3.D, are A-Level only
    WJEC 1420/2420     Units 1-2 are AS; Units 3-4 are A2
    Cambridge 9702     syllabus topics 1-11 are AS (Papers 1-2); 12-25 are A Level (Papers 4-5)

A question is Year 12 when:
  1. it sits on an AS paper (an AS paper asks only AS content: always Year 12), or
  2. it sits on a full A-Level paper, every one of its topic tags is a year 1 topic, and its text
     (question and scheme) has none of the second-year terms in A2_TERMS.
Otherwise it is Year 13. Two more rules make a whole paper Year 13 (ALL_YEAR_13), as maths does for
WJEC Units 3-4 and Cambridge Papers 3 and 6:
  - aqa-a-level-physics also holds the 2010-2016 Physics A papers (specification 2450). Its AS units
    PHYA1 and PHYA2 are AS papers, so Year 12. Its A2 units PHYA4 and PHYA5 are all Year 13: their
    questions are tagged to the current specification's topics, and the tags are unreliable there (a
    magnetic force on a wire tagged "Current electricity", say), so a topic rule would let A2 questions
    through; the cost is a hundred or so momentum and photoelectric questions that were A2 then but are AS now.
  - WJEC Units 3 and 4 are the A2 units, and their year 1 tagged questions are mostly comprehension
    articles that mix both years, so every question on them is Year 13.
Rule 2's terms catch what the topic tag misses: a practical or data-analysis question tagged "Limitation
of physical measurements" that is about a capacitor discharge or a current balance. It errs towards
Year 13 (a Year 12 student should not meet second-year content), so some AS questions that merely
mention a term in their stem or scheme also land in Year 13.

year13.json (the ids of the Year 13 parts) goes beside the bank's data, as maths_years.py's does; run
upload_data.py afterwards to put it on R2 and its hash in the meta.
"""
import json, os, re, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BANKS = ["aqa-a-level-physics", "edexcel-a-level-physics", "ocr-a-level-physics-a", "ocr-a-level-physics-b",
         "eduqas-a-level-physics", "wjec-a-level-physics", "caie-a-level-physics"]


ALL_YEAR_13 = {"aqa-a-level-physics": {"PHYA4A", "PHYA4B", "PHYA5A", "PHYA5BA", "PHYA5BB", "PHYA5BC", "PHYA5BD"},
               "wjec-a-level-physics": {"1420u30", "1420u40"}}
# Terms that mean second-year content on a full A-Level paper.
A2_TERMS = (r"simple harmonic|\bshm\b|centripetal|circular motion|angular (?:velocity|speed|frequency|displacement)"
            r"|capacitor|capacitance|time constant|gravitational field|gravitational potential(?! energy)|\bkepler"
            r"|electric field|field strength|(?<!electro)magnetic|flux|induced (?:e\.?m\.?f|current|voltage)|faraday|lenz"
            r"|transformer|alternating|\br\.?m\.?s\b|half-life|half life|decay constant|binding energy|mass defect"
            r"|\bfission|\bfusion\b|ideal gas|boltzmann|kinetic theory|specific heat|specific latent|latent heat"
            r"|internal energy|black.?body|wien|stefan|red.?shift|hubble|big bang|hertzsprung|\bdamp|forced oscillation"
            r"|exponential|natural log")
# Terms that are in a board's AS content, so they say nothing on that board's papers.
AS_TERMS = {"eduqas-a-level-physics": r"black.?body|wien|stefan", "wjec-a-level-physics": r"black.?body|wien|stefan",
            "ocr-a-level-physics-b": r"internal energy"}


def year13_ids(slug, meta, parts, text):
    topic_year = {t["code"]: t["year"] for t in meta["topics"]}
    as_papers = {p["id"] for p in meta["papers"] if p.get("as")}
    terms = re.compile(A2_TERMS, re.I)
    exempt = re.compile(AS_TERMS[slug], re.I) if slug in AS_TERMS else None
    ids, why = [], Counter()
    for part in parts:
        if part["p"] in as_papers:
            continue
        if part["p"] in ALL_YEAR_13.get(slug, ()):
            ids.append(part["id"]); why["paper"] += 1
        elif any(topic_year[t] != 1 for t in part["t"]):
            ids.append(part["id"]); why["topic"] += 1
        elif any(not (exempt and exempt.fullmatch(m.group(0))) for m in terms.finditer(text.get(part["id"], part["x"]))):
            ids.append(part["id"]); why["term"] += 1
    return ids, why


def main():
    check = "--check" in sys.argv
    for slug in BANKS:
        meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
        pub = os.path.join(ROOT, "public", "question-bank", slug)
        parts = json.load(open(os.path.join(pub, "parts.json")))
        assert all(t["year"] in (1, 2, 3) for t in meta["topics"]), slug
        text = json.load(open(os.path.join(pub, "text.json")))
        ids, why = year13_ids(slug, meta, parts, text)
        if not check:
            json.dump(ids, open(os.path.join(pub, "year13.json"), "w"), separators=(",", ":"))
        print(f"{slug}: {len(parts) - len(ids)} Year 12, {len(ids)} Year 13  (Year 13 by: {dict(why)})", file=sys.stderr)


if __name__ == "__main__":
    main()
