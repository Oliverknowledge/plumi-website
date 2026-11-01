"""Tag the cut History questions to their option's periods, by the years they name.

    python3 scripts/question-bank/aqa_history/tag_history.py [work-dir]   # default scripts/question-bank/.work/aqa-history

Every period in the specification is dated ("The collapse of autocracy, 1894–1917"), and
almost every essay names its years ("in the years 1855 to 1881"), so a question is tagged
to the periods of its own option that its years overlap. Where two periods share their
dates (1B's 'Golden Age' and 'Great Power', both 1556–1598; 2T's Soviet Union and Soviet
Empire strands), the one whose words the question and its scheme share most is kept, with
any other close behind it.

A question that names no span of years (most of Question 01: "the reasons for the
abdication of Tsar Nicholas II") is tagged by the years its question, extracts and scheme
mention, to the period most of them fall in, or failing that by its words alone.

Writes <work-dir>/tags.json ({id: [codes]}) for build_history.py, and prints what it did.
"""
import collections, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-history")
SPAN = re.compile(r"(?:in the |between |from )?(?:years? )?c?(\d{4})\s*(?:to|and|–|-)\s*c?(\d{4})", re.I)
YEAR = re.compile(r"(?<![\d£$])(?:c)?(1[0-9]\d{2}|200\d)(?!\d)")
STOP = set("the of and to in a an by for on was were with as at its it this that from be or how far what extent which their his her they these those years year assess validity view why did students may refer argument arguments question extract extracts source sources".split())


def words(s):
    return [w for w in re.findall(r"[a-z']{3,}", s.lower()) if w not in STOP]


def overlap(a, b):
    """Years two spans share; a single year inside a span counts as one."""
    lo, hi = max(a[0], b[0]), min(a[1], b[1])
    if lo > hi:
        return -1
    return hi - lo if a[0] != a[1] and b[0] != b[1] else 1


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    tree = json.load(open(os.path.join(WORK, "spec.json")))["7042"]
    by_option = collections.defaultdict(list)
    for t in tree["topics"]:
        by_option[t["section"]].append(t)
    # Words that mark one period from another: weighted by how few periods use them.
    df = collections.Counter(w for t in tree["topics"] for w in set(words(t["title"] + " " + t["text"])))
    idf = {w: math.log(len(tree["topics"]) / n) for w, n in df.items()}
    bag = {t["code"]: collections.Counter(words(t["title"] + " " + t["text"])) for t in tree["topics"]}

    def score(text, t):
        got = collections.Counter(words(text))
        return sum(idf.get(w, 0) * min(n, 3) for w, n in got.items() if w in bag[t["code"]])

    tags, how = {}, collections.Counter()
    for p in parts:
        option = p["component"][4:]
        topics = by_option[option]
        question = re.sub(r"\[\d+ marks?\]", "", p["text"])
        everything = " ".join([question, p.get("stemText", ""), p.get("msText", "")])
        spans = [(int(a), int(b)) for a, b in SPAN.findall(question) if int(a) <= int(b)]
        picked = []
        if spans:
            span = (min(a for a, b in spans), max(b for a, b in spans))
            picked = [t for t in topics if overlap(span, (t["from"], t["to"])) > 0 or (span[0] == span[1] and overlap(span, (t["from"], t["to"])) >= 0)]
            how["span"] += bool(picked)
        if not picked:
            # The years the question, its extracts and its scheme mention, inside the option's own dates.
            lo, hi = min(t["from"] for t in topics), max(t["to"] for t in topics)
            years = [int(y) for y in YEAR.findall(everything) if lo <= int(y) <= hi]
            if years:
                votes = collections.Counter()
                for y in years:
                    for t in topics:
                        if t["from"] <= y <= t["to"]:
                            votes[t["code"]] += 1
                if votes:
                    best = max(votes.values())
                    picked = [t for t in topics if votes[t["code"]] >= max(2, best * 0.6) or votes[t["code"]] == best]
                    how["years"] += 1
        if not picked:
            picked = topics
            how["words"] += 1
        # Periods with the same dates, or too many to be useful: keep the ones whose words fit.
        if len({(t["from"], t["to"]) for t in picked}) < len(picked) or len(picked) > 3:
            scored = sorted(((score(everything, t), t) for t in picked), key=lambda st: -st[0])
            top = scored[0][0]
            picked = [t for s, t in scored if s >= top * 0.8][:3] if top > 0 else picked[:3]
        tags[p["id"]] = [t["code"] for t in sorted(picked, key=lambda t: t["code"])]
    json.dump(tags, open(os.path.join(WORK, "tags.json"), "w"), indent=0)
    sizes = collections.Counter(len(v) for v in tags.values())
    print(f"{len(tags)} questions tagged: {dict(how)} (span: by its years; years: by the years it mentions; words: by words alone); "
          f"topics per question {dict(sorted(sizes.items()))}", file=sys.stderr)


if __name__ == "__main__":
    main()
