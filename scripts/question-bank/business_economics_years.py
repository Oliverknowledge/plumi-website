"""Mark the A-Level Business and Economics banks' questions Year 12 or Year 13, for the bank's "Year" filter.

    python3 scripts/question-bank/business_economics_years.py build            # write year13.json for each bank
    python3 scripts/question-bank/business_economics_years.py build aqa-a-level-economics
    python3 scripts/question-bank/business_economics_years.py sample <slug> [n]  # n questions from each side, to read

The same filter and file as maths_years.py (public/question-bank/<slug>/year13.json, the ids of the
questions that need second-year content, then upload_data.py), but nothing is read question by
question: Business and Economics specifications are built from topics, and each part carries its
topic tags, so the topic decides. A part is Year 12 unless it is Year 13 by one of these:

  * every part of an AS paper is Year 12 (the AS exists to be the first year);
  * a part of a full A-Level paper is Year 13 when any of its topics is second-year content in the
    board's own specification, and Year 12 when all of them are first-year content;
  * WJEC's Unit 3 tests only A2 content, so all of it is Year 13 (its Unit 4 is synoptic, so it goes
    by topic like the A-Level papers of the other boards).

Which topics are second year, from each board's own public specification (kept as text out of tree):

  AQA Business 7131/7132      3.1-3.6 are the AS; 3.7-3.10 are marked "(A-level only)" in the specification.
  AQA Economics 7135/7136     The AS section 3 lists the first-year topics; the bank's topic `year` (1 = AS) was
                              checked against it, topic by topic.
  Edexcel Economics A 9EC0    The AS (8EC0) is Themes 1 and 2; Themes 3 and 4 are A-Level only.
  Edexcel Business 9BS0       Themes 1 and 2 are the AS (8BS0): every Theme 1 and 2 sub-topic is in the AS
                              specification. Themes 3 and 4 are the second year. No AS papers in the bank.
  Edexcel Economics B 9EB0    No AS paper in the bank, and no AS qualification any more. Pearson's Getting Started
                              Guide has centres deliver Themes 1 and 2 in the first year (what the AS covered)
                              and Themes 3 and 4 in the second.
  OCR Economics H060/H460     The AS specification's content list, topic by topic (the bank's `year` follows it:
                              the multiplier, the margin, information failure, public goods, business
                              objectives, costs, market structures, the labour market, the Phillips curve,
                              income distribution, globalisation, trade policy and the financial sector are
                              A-Level only).
  OCR Business H031/H431      The AS specification's list of topics (YEAR_12 below); the rest are A-Level only.
  WJEC Business               AS Units 1 and 2 (topics 1 and 2.x) against A2 Units 3 and 4 (topics 3 and 4).

Where the topic map can't say, a few parts are decided by hand (HAND below, each with its reason).
"""
import json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
META = os.path.join(ROOT, "src", "content", "questionBank")
DATA = os.path.join(ROOT, "public", "question-bank")

# OCR Business: the topics the AS specification (H031) lists, by the bank's topic codes. Everything else
# in the A-Level specification (franchises, size and growth, mission statements, strategy models,
# forecasting, decision trees, Ansoff, the EU and emerging markets, change, accounting concepts,
# communication, workforce planning, project management, R&D and the rest) is second year.
OCR_BUS_YEAR_12 = {
    "1.1", "1.2", "1.3", "1.5",
    "2.1", "2.2", "2.4", "2.6", "2.7", "2.11", "2.13",
    "3.1", "3.2", "3.4", "3.5", "3.6", "3.7", "3.11", "3.12", "3.13", "3.14", "3.16", "3.17", "3.18",
    "5.2", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11", "5.12",
    "6.2", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "6.12", "6.13",
    "7.2", "7.3", "7.4", "7.6", "7.7", "7.8", "7.9", "7.10", "7.11", "7.14",
    "8.2", "8.4", "8.5", "8.7", "8.8", "8.9", "8.10", "8.11", "8.13", "8.14",
}
# OCR's AS asks "explain what is meant by an exchange rate" and the effect on a business, so a calculation
# or effect of an exchange rate is first-year content even where the bank filed it under 3.8 (international
# trade and free trade, which is second year). Read by hand: each is exchange-rate arithmetic or the effect of
# the rupee's value on a business.
OCR_BUS_HAND_12 = {"h43102-jun25-03", "h43101-jun24-13", "h43103-jun23-08-a", "h43103-jun22-07"}

AQA_BUS_YEAR_13 = ("3.7", "3.8", "3.9", "3.10")  # section of the topic code, "3.8.2" -> "3.8"


def topic13(slug, code, topics):
    if slug == "aqa-a-level-business":
        return ".".join(code.split(".")[:2]) in AQA_BUS_YEAR_13
    if slug in ("edexcel-a-level-business", "edexcel-a-level-economics-b"):
        return code[0] in "34"
    if slug == "ocr-a-level-business":
        return code not in OCR_BUS_YEAR_12
    # AQA Economics, Edexcel Economics A, OCR Economics, WJEC Business: the bank's topic `year`, 1 = AS, checked against the specs
    return topics[code]["year"] == 2


SECOND_YEAR_PAPERS = {"wjec-a-level-business": {"1510u30"}}
HAND_12 = {"ocr-a-level-business": OCR_BUS_HAND_12}
BANKS = ["aqa-a-level-business", "edexcel-a-level-business", "ocr-a-level-business", "wjec-a-level-business",
         "aqa-a-level-economics", "edexcel-a-level-economics-a", "edexcel-a-level-economics-b", "ocr-a-level-economics"]


def load(slug):
    meta = json.load(open(os.path.join(META, f"{slug}.json")))
    parts = json.load(open(os.path.join(DATA, slug, "parts.json")))
    return meta, parts, os.path.join(DATA, slug)


def classify(slug):
    meta, parts, pub = load(slug)
    papers = {p["id"]: p for p in meta["papers"]}
    topics = {t["code"]: t for t in meta["topics"]}
    y13, rule = [], {"as": 0, "paper": 0, "topic": 0, "hand": 0}
    for p in parts:
        paper = papers[p["p"]]
        if paper.get("as"):
            rule["as"] += 1
        elif p["p"] in SECOND_YEAR_PAPERS.get(slug, ()):
            rule["paper"] += 1
            y13.append(p["id"])
        elif p["id"] in HAND_12.get(slug, ()):
            rule["hand"] += 1
        else:
            rule["topic"] += 1
            if any(topic13(slug, t, topics) for t in p["t"]):
                y13.append(p["id"])
    return meta, parts, pub, y13, rule


def build(slugs):
    for slug in slugs:
        meta, parts, pub, y13, rule = classify(slug)
        json.dump(y13, open(os.path.join(pub, "year13.json"), "w"), separators=(",", ":"))
        print(f"{slug}: {len(parts) - len(y13)} Year 12, {len(y13)} Year 13   "
              f"(AS paper {rule['as']}, whole-paper {rule['paper']}, by topic {rule['topic']}, by hand {rule['hand']})", file=sys.stderr)


def sample(slug, n):
    meta, parts, pub, y13, rule = classify(slug)
    text = json.load(open(os.path.join(pub, "text.json")))
    papers = {p["id"]: p for p in meta["papers"]}
    ids, rnd = set(y13), random.Random(7)
    for label, keep in (("YEAR 12 (full A-Level papers only)", lambda p: p["id"] not in ids and not papers[p["p"]].get("as")),
                        ("YEAR 13", lambda p: p["id"] in ids)):
        pool = [p for p in parts if keep(p)]
        print(f"\n===== {label}: {len(pool)}")
        for p in rnd.sample(pool, min(n, len(pool))):
            print(f"- {p['id']} {p['t']} [{papers[p['p']]['name']}] {' '.join(text.get(p['id'], p['x']).split())[:330]}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "sample":
        sample(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 12)
    else:
        build(sys.argv[2:] or BANKS)
