"""Mark the A-Level Chemistry banks' questions Year 12 or Year 13, for the bank's "School year" filter.

    python3 scripts/question-bank/chemistry_years.py          # write year13.json for each bank, print the counts
    python3 scripts/question-bank/chemistry_years.py --dry    # just print the counts

Needs the banks' data in public/question-bank/<slug>/ (upload_data.py --pull <slug>). After writing, run
upload_data.py <slug> ... so the file reaches R2, and commit the metas it changes. Same file and filter as the
Maths banks' (maths_years.py): year13.json lists the ids of the questions that need second-year content.

Unlike maths, a chemistry bank's topics already say which year teaches them: every topic in
src/content/questionBank/<slug>.json has a `year` (1 or 2), assigned from the board's own specification
(AQA 7405 3.1.1-3.1.7, 3.2.1-3.2.3, 3.3.1-3.3.6 are AS; Edexcel 9CH0 topics 1-10; OCR A modules 2-4; OCR B
storylines Elements of Life, Developing Fuels, Elements from the Sea, The Ozone Story, What's in a Medicine?;
Eduqas/WJEC AS Components/Units 1 and 2; Cambridge 9701 topics 1-22 / AS). So the rule is deterministic:

  1. A question on an AS paper (`as` in the bank's meta) is Year 12, whatever its tag.
  2. Any other question is Year 13 if any of its topic tags is a year-2 topic, else Year 12. That covers the
     full A-Level papers (AQA Papers 1-3, Edexcel 9CH0, OCR H432/H433, Eduqas A410, Cambridge Papers 4-5),
     the A2-only units (WJEC Units 3-4, AQA's old CHEM4/CHEM5) and the legacy 2010-2016 AQA papers, which
     were sorted into today's topics and so take today's year for their topic. AQA's CHEM1/CHEM2 are old AS
     units, so Year 12. A year-2 paper's year-1-topic question stays Year 12 where an AS student can do it
     (a yield calculation, naming an isomer): the filter is about what the student can already do, not
     which paper it was printed on.
  3. OVERRIDES below: parts read by hand where the tag and the specification disagree. They came from a
     keyword sweep of the year-1-tagged parts on full A-Level papers (second-year terms such as NMR splitting,
     chromatography, rate equations, arenes, carbonyls, entropy, weak-acid pH in the part's own question, then
     in its scheme: about 330 parts across the seven banks read, 5 needed a change) plus a random read of
     about 12 parts on each side of the rule per bank. Year-2-tagged parts were only sampled: roughly 1 in 10
     of those read were first-year content (a Year 12 student misses them; none the other way round).
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BANKS = ["aqa-a-level-chemistry", "edexcel-a-level-chemistry", "ocr-a-level-chemistry-a", "ocr-a-level-chemistry-b",
         "eduqas-a-level-chemistry", "wjec-a-level-chemistry", "caie-a-level-chemistry"]

# id -> 12 or 13, read against the board's specification.
OVERRIDES = {
    # Year 13: tagged with a first-year topic, but the content is second-year.
    "74052-jun25-07-1": 13,      # AQA: 1H NMR singlet and precise Mr (AQA's NMR is 3.3.15, A-level only)
    "a410u20-jun25-02-b": 13,    # Eduqas: benzene + chlorine in UV light (the AS spec has no arenes)
    "a410u20-oct20-04-bii": 13,  # Eduqas: gas chromatography (chromatography is A-level only)
    "a410u20-jun19-12-bv": 13,   # Eduqas: reading a gas chromatogram
    "a410u20-jun17-12-biii": 13,  # Eduqas: soil analysed by gas chromatography
    # Year 12: tagged with a second-year topic, but an AS student can do it.
    "1410u40-jun22-07-ai": 12,   # WJEC: an isomer that gives CO2 with NaHCO3 (carboxylic acids are AS Unit 2)
    "a410u20-oct21-06-bii": 12,  # Eduqas: name the separating funnel, tell which layer is which
}


def load(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    pub = os.path.join(ROOT, "public", "question-bank", slug)
    return meta, json.load(open(os.path.join(pub, "parts.json"))), pub


def year13_ids(meta, parts):
    papers = {p["id"]: p for p in meta["papers"]}
    topic_year = {t["code"]: t["year"] for t in meta["topics"]}
    ids = []
    for part in parts:
        if part["id"] in OVERRIDES:
            thirteen = OVERRIDES[part["id"]] == 13
        elif papers[part["p"]].get("as"):
            thirteen = False
        else:
            thirteen = any(topic_year[t] == 2 for t in part["t"])
        if thirteen:
            ids.append(part["id"])
    return ids


def main():
    dry = "--dry" in sys.argv
    for slug in BANKS:
        meta, parts, pub = load(slug)
        ids = year13_ids(meta, parts)
        if not dry:
            json.dump(ids, open(os.path.join(pub, "year13.json"), "w"), separators=(",", ":"))
        print(f"{slug}: {len(parts) - len(ids)} Year 12, {len(ids)} Year 13", file=sys.stderr)


if __name__ == "__main__":
    main()
