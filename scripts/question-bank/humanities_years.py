"""Mark the A-Level Psychology, Sociology, Politics, Law and Geography banks' questions Year 12 or Year 13, for the bank's "Year" filter.

    python3 scripts/question-bank/humanities_years.py build            # write public/question-bank/<slug>/year13.json for every bank below
    python3 scripts/question-bank/humanities_years.py build <slug> ... # just those
    python3 scripts/question-bank/humanities_years.py report           # counts per bank, and how each part was decided
    python3 scripts/question-bank/humanities_years.py show <slug> [--why=topic] [--year=12|13] [--paper=ID] [--tag=PREFIX] [--n=40]
                                                                       # parts with their text, to read or spot-check
    python3 scripts/question-bank/humanities_years.py ambiguous <slug> # the parts a rule hands to a reader

Same idea as maths_years.py, same year13.json (the ids that need second-year content, which the site's
"School year" switch reads), but these subjects divide by the board's own AS specification, so the
decision is mostly a map rather than a read:

  Year 12  every question on an AS paper, and every question on a full A-Level paper whose content is
           also in the board's AS specification (a topic, or a whole paper, that the AS covers).
  Year 13  a question that needs content only the A-Level specification has: a whole paper (OCR
           Sociology Paper 3), a topic (Edexcel Politics' USA and global politics), or a named item
           inside an AS topic (AQA Psychology's psychodynamic approach, in the approaches topic).

Where a topic mixes the two (AQA Psychology's research methods, OCR Law's evaluation questions), a
keyword list of the A-Level-only items settles it, or the part goes to `reads` below and is decided
by eye. Reads are kept in humanities_years_reads.json beside this file ({slug: {part id: 12 or 13}}),
and win over every rule.

The AS specifications: AQA 7181 (Psychology), 7191 (Sociology), 7036 (Geography); Pearson 8PS0, 8PL0, 8GE0;
OCR H167 (Psychology), H180 (Sociology), H018 (Law). Skipped, because the board has no AS and no first-year /
second-year split in its A-Level specification: AQA Politics (7152) and AQA Law (7162).
"""
import collections, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
READS = os.path.join(HERE, "humanities_years_reads.json")


def load(slug):
    meta = json.load(open(os.path.join(ROOT, "src", "content", "questionBank", f"{slug}.json")))
    pub = os.path.join(ROOT, "public", "question-bank", slug)
    return meta, json.load(open(os.path.join(pub, "parts.json"))), json.load(open(os.path.join(pub, "text.json"))), pub


def rx(*words):
    return re.compile("|".join(words), re.I)


def starts(tag, *prefixes):
    return any(tag == p or tag.startswith(p + ".") for p in prefixes)


# ---- AQA Psychology 7182 -----------------------------------------------------------------------
# Papers 1 and 2 hold only content the AS (7181) also has, except these items, which only the A-level lists.
AQA_PSY_A2 = rx(
    r"social change", r"cognitive interview", r"internal working model",
    r"psychodynamic", r"humanistic", r"maslow", r"self.actuali", r"conditions? of worth", r"\bid,? ego", r"unconscious",
    r"comparison of (the )?approaches", r"compare .{0,40}approaches",
    r"localis", r"lateralis", r"broca", r"wernicke", r"split.brain", r"plasticity", r"functional recovery",
    r"\bfmri\b", r"\beegs?\b", r"\berps?\b", r"event.related", r"post.?mortem", r"scanning", r"biological rhythm", r"circadian", r"infradian",
    r"ultradian", r"endogenous", r"exogenous", r"zeitgeber", r"pacemaker",
    r"content analysis", r"case stud", r"thematic analysis", r"reliab", r"validity", r"paradigm", r"falsifiab", r"replicab",
    r"objectivity", r"empirical method", r"features of science", r"scientific report", r"histogram", r"co-?efficient", r"ways of studying the brain", r"areas? of the brain", r"cortex", r"hemisphere", r"\blobe",
    r"levels? of measurement", r"\bnominal\b", r"\bordinal\b", r"spearman", r"pearson", r"wilcoxon", r"mann.whitney", r"chi.squared",
    r"\bt.test", r"type (i|1|ii|2) error", r"implications? of .{0,30}economy", r"economy", r"inferential",
)
AQA_PSY_SIGN = rx(r"sign test")  # the AS has the sign test, and with it critical values and significance
AQA_PSY_STATS = rx(r"critical value", r"significan", r"probabilit")


def aqa_psychology(p, paper, text, tags):
    text = text.split("marks for this question")[0]  # the question, not its mark scheme (which names validity etc. as answers)
    if paper["id"] == "71823":
        return 13, "paper"  # Paper 3: issues and debates, and the options, are all A-level only
    if any(t.startswith("4.3") for t in tags):
        return 13, "topic"
    if "4.2.3.3" in tags and not AQA_PSY_SIGN.search(text):
        return 13, "keyword:inferential test choice"  # which test to use (Spearman, Mann-Whitney...) is A-level only
    m = AQA_PSY_A2.search(text) or (None if AQA_PSY_SIGN.search(text) else AQA_PSY_STATS.search(text))
    if m:
        return 13, "keyword:" + m.group(0).lower()
    return 12, "topic"


# ---- Edexcel Psychology 9PS0 -------------------------------------------------------------------
# Topics 1-4 (content, methods, studies, key questions, practical investigation) are the AS's (8PS0) word for word.
# Issues and debates (x.6), Topics 5-8 and Topic 9 are A-level only.
def edexcel_psychology(p, paper, text, tags):
    for t in tags:
        major, minor = t.split(".")
        if int(major) > 4 or minor == "6":
            return 13, "topic"
    return 12, "topic"


# ---- OCR Psychology H567 ------------------------------------------------------------------------
# Paper 1 (research methods) is H167/01. Paper 2 is H167/02 with five of the ten core-study themes: authority,
# memory, external influences on children, regions of the brain, understanding disorders; the AS has the same
# areas / perspectives / debates and practical applications sections. Paper 3 (applied psychology) is A-level only.
OCR_PSY_AS_STUDIES = {"2A.1", "2A.3", "2A.5", "2A.7", "2A.9"}


def ocr_psychology(p, paper, text, tags):
    if paper["id"].startswith("h56703"):
        return 13, "paper"
    if paper["id"] == "h56701":
        return 12, "paper"
    if any(t.startswith("2A.") and t not in OCR_PSY_AS_STUDIES for t in tags):
        return 13, "topic"
    if any(t.startswith(("2B.", "2C.")) for t in tags):
        return 12, "unread"  # areas, perspectives, debates and applications questions can draw on any core study: read (reads file)
    return 12, "topic"


# ---- AQA Sociology 7192 -------------------------------------------------------------------------
# The AS (7191) has Education, Methods in context, Research methods (A-level 4.1.3.1-4.1.3.5) and four of the
# topics (Culture and identity, Families, Health, Work/poverty/welfare). A-level only: Theory and methods
# 4.1.3.6-4.1.3.11, Beliefs, Global development, Media, Stratification, and Crime and deviance (Paper 3).
def aqa_sociology(p, paper, text, tags):
    if any(starts(t, "4.2.5", "4.2.6", "4.2.7", "4.2.8", "4.3") or re.match(r"4\.1\.3\.(6|7|8|9|10|11)$", t) for t in tags):
        return 13, "topic"
    return 12, "topic"


# ---- OCR Sociology H580 -------------------------------------------------------------------------
# "The first year of this course is co-teachable with our AS level specification": Papers 1 and 2 are
# H180/01 and H180/02. Paper 3 (debates in contemporary society) is A-level only.
def ocr_sociology(p, paper, text, tags):
    return (13, "paper") if paper["id"].startswith("h58003") else (12, "paper")


# ---- Edexcel Politics 9PL0 ----------------------------------------------------------------------
# The AS (8PL0) is UK Politics (UKP) and UK Government (UKG). Core and non-core ideas, the USA and global politics are A-level only.
def edexcel_politics(p, paper, text, tags):
    return (12, "topic") if all(t.startswith(("UKP.", "UKG.")) for t in tags) else (13, "topic")


# ---- OCR Law H418 -------------------------------------------------------------------------------
# AS (H018): the legal system, law making, criminal law (rules, general elements, non-fatal offences) and the law of tort
# (rules, negligence, occupiers' liability, compensatory damages). A-level only: fatal and property offences, mental
# capacity, general and preliminary offences; torts connected to land, vicarious liability, defences, injunctions;
# the nature of law, human rights and contract (Paper 3).
OCR_LAW_A2_TOPICS = ("1B.3", "1B.5", "1B.6", "1B.7", "1B.8", "2B.4", "2B.5", "2B.6", "3")
OCR_LAW_MIXED = ("1B.9", "2B.7", "2B.8")  # evaluation and remedies questions: AS for some offences / torts, not for others


def ocr_law(p, paper, text, tags):
    if paper["id"] in ("h41803", "h41804") or any(starts(t, *OCR_LAW_A2_TOPICS) for t in tags):
        return 13, "paper" if paper["id"] in ("h41803", "h41804") else "topic"
    if any(starts(t, *OCR_LAW_MIXED) for t in tags):
        return 12, "unread"  # read (reads file)
    return 12, "topic"


# ---- AQA Geography 7037 -------------------------------------------------------------------------
# The AS (7036) has water and carbon cycles, coasts, glaciers, hazards, changing places and contemporary urban
# environments, worded as the A-level. A-level only: hot deserts (3.1.2), ecosystems under stress (3.1.6), global systems and
# governance (3.2.1), population and the environment (3.2.4), resource security (3.2.5).
def aqa_geography(p, paper, text, tags):
    return (13, "topic") if any(starts(t, "3.1.2", "3.1.6", "3.2.1", "3.2.4", "3.2.5") for t in tags) else (12, "topic")


# ---- Edexcel Geography 9GE0 ---------------------------------------------------------------------
# Topics 1-4 are the AS's (8GE0), word for word. Paper 3 (synoptic) is A-level only. Topics 5-8 (water and carbon cycles, superpowers, global development) are A-level only.
def edexcel_geography(p, paper, text, tags):
    if paper["id"] == "9ge003":
        return 13, "paper"  # the synoptic investigation: every question draws on compulsory content from different parts of the two-year course
    return (13, "topic") if any(int(t.split(".")[0].rstrip("AB")) >= 5 for t in tags) else (12, "topic")


RULES = {
    "aqa-a-level-psychology": aqa_psychology,
    "edexcel-a-level-psychology": edexcel_psychology,
    "ocr-a-level-psychology": ocr_psychology,
    "aqa-a-level-sociology": aqa_sociology,
    "ocr-a-level-sociology": ocr_sociology,
    "edexcel-a-level-politics": edexcel_politics,
    "ocr-a-level-law": ocr_law,
    "aqa-a-level-geography": aqa_geography,
    "edexcel-a-level-geography": edexcel_geography,
}


def reads():
    return json.load(open(READS)) if os.path.exists(READS) else {}


def decide(slug):
    """{part id: (12 or 13, why)} for every part of the bank."""
    meta, parts, text, _ = load(slug)
    papers = {p["id"]: p for p in meta["papers"]}
    read = reads().get(slug, {})
    out = {}
    for p in parts:
        paper = papers[p["p"]]
        if p["id"] in read:
            out[p["id"]] = (read[p["id"]], "read")
        elif paper.get("as"):
            out[p["id"]] = (12, "AS paper")
        else:
            out[p["id"]] = RULES[slug](p, paper, text.get(p["id"], p["x"]), p["t"])
    return out


def build(slugs):
    for slug in slugs or RULES:
        meta, parts, _, pub = load(slug)
        d = decide(slug)
        ids = [p["id"] for p in parts if d[p["id"]][0] == 13]
        json.dump(ids, open(os.path.join(pub, "year13.json"), "w"), separators=(",", ":"))
        print(f"{slug}: {len(parts) - len(ids)} Year 12, {len(ids)} Year 13", file=sys.stderr)


def report(slugs):
    for slug in slugs or RULES:
        meta, parts, _, _ = load(slug)
        d = decide(slug)
        papers = {p["id"]: p for p in meta["papers"]}
        c = collections.Counter((papers[p["p"]]["name"], d[p["id"]][0], d[p["id"]][1].split(":")[0]) for p in parts)
        print(f"== {slug}: {sum(v == 12 for v, _ in d.values())} Year 12, {sum(v == 13 for v, _ in d.values())} Year 13 of {len(parts)}")
        why = collections.Counter(w.split(":")[0] for _, w in d.values())
        print("   decided by:", dict(why))
        for (name, y, w), n in sorted(c.items()):
            print(f"   {name:48} Year {y}  {w:9} {n}")


def show(slug, args):
    opts = dict(a[2:].split("=", 1) for a in args if a.startswith("--") and "=" in a)
    meta, parts, text, _ = load(slug)
    d = decide(slug)
    shown = 0
    for p in parts:
        y, w = d[p["id"]]
        if opts.get("year") and str(y) != opts["year"]:
            continue
        if opts.get("why") and w.split(":")[0] != opts["why"]:
            continue
        if opts.get("paper") and p["p"] != opts["paper"]:
            continue
        if opts.get("tag") and not any(t.startswith(opts["tag"]) for t in p["t"]):
            continue
        t = re.sub(r"\s+", " ", text.get(p["id"], p["x"]))
        print(f"{p['id']} Y{y} {w} {','.join(p['t'])} [{p['m']}] {t[:int(opts.get('len', 230))]}")
        shown += 1
        if shown >= int(opts.get("n", 40)):
            break


def ambiguous(slug):
    meta, parts, text, _ = load(slug)
    d = decide(slug)
    for p in parts:
        if d[p["id"]][1].split(":")[0] in ("keyword", "read", "unread"):
            t = re.sub(r"\s+", " ", text.get(p["id"], p["x"]))
            print(f"{p['id']} Y{d[p['id']][0]} {d[p['id']][1]} {','.join(p['t'])} [{p['m']}] {t[:300]}")


if __name__ == "__main__":
    cmd, rest = (sys.argv[1] if len(sys.argv) > 1 else "report"), sys.argv[2:]
    if cmd == "build":
        build(rest)
    elif cmd == "report":
        report(rest)
    elif cmd == "show":
        show(rest[0], rest[1:])
    elif cmd == "ambiguous":
        ambiguous(rest[0])
