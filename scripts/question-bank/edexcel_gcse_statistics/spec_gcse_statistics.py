"""Read Pearson Edexcel's GCSE (9-1) Statistics specification (1ST0) into a topic tree.

    python3 scripts/question-bank/edexcel_gcse_statistics/spec_gcse_statistics.py [work-dir]

Writes <work-dir>/spec.json in spec_pearson.py's shape, under 1ST0. The specification numbers its content in three
areas ("1. The collection of data", "2. Processing, representing and analysing data", "3. Probability"), each in
lettered groups ("(c) Population and sampling"), each statement coded ("1c.01"). Sections are the three areas, shown
as the bank's tiles; topics are the lettered groups ("2e Scatter diagrams and correlation") with every statement's
words and its guidance under them ("text"), for tagging only. Probability is one group in the specification
("3p.01" to "3p.13", thirteen statements): it is split here by what the statements are about, into 3a to 3c, so that
its page isn't a third of the bank. Read from the Higher tier content, which prints every statement, those only
Higher students are assessed on in bold: the two tiers' papers take the same codes. Each statement sits in a left
column and its guidance in a right one, so the columns are told apart by position. A GCSE has no AS split, so
every topic is "year 0".
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-statistics")
URL = "https://qualifications.pearson.com/content/dam/pdf/GCSE/Statistics/2017/specification-and-sample-assessments/gcse-9-1-statistics-specification.pdf"
SECTIONS = {"1": ("The collection of data", "Collecting data"),
            "2": ("Processing, representing and analysing data", "Analysing data"),
            "3": ("Probability", "Probability")}
CODE = re.compile(r"^(\d[a-z])\.(\d\d)\b\s*(.*)", re.S)
GROUP = re.compile(r"^\(([a-h])\)\s+(.{3,60}?)\s*(continued)?\s*$")
AREA = re.compile(r"^([123])\.\s+(.{3,60}?)\s*(continued)?\s*$")
# Probability is one group in the specification ("3p"); its statements are split by what they are about.
PROBABILITY = [("3a", "Estimating and comparing probabilities", range(1, 7)),
               ("3b", "Combined events and conditional probability", range(7, 10)),
               ("3c", "Binomial and normal distributions", range(10, 14))]


def fetch(path):
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    doc = fetch(os.path.join(WORK, "spec", "statistics.pdf"))
    start = next(i for i, p in enumerate(doc) if "Higher tier content" in p.get_text()[:80] and "1a.01" in p.get_text())
    area, group, tops, order = None, None, {}, []
    cur = None  # the code of the statement being read
    for page in list(doc)[start:]:
        if "Higher tier content" not in page.get_text()[:80]:
            break
        blocks = sorted(page.get_text("blocks"), key=lambda b: (round(b[1]), b[0]))
        for b in blocks:
            text = re.sub(r"\s+", " ", b[4]).strip()
            if not text or b[1] < 60 or b[1] > 540 or text.startswith(("What students need to learn", "Higher tier content", "Pearson Edexcel")):
                continue
            if b[0] < 100:
                m = AREA.match(text)
                if m:
                    area = m.group(1)
                    continue
                m = GROUP.match(text)
                if m:
                    group = f"{area}{m.group(1)}"
                    if group not in tops:
                        tops[group] = {"code": group, "ref": group, "title": m.group(2).strip(), "section": area, "text": "", "year": 0}
                        order.append(group)
                    continue
                m = CODE.match(re.sub(r"^(\d[a-z]\.\d\d)", r"\1 ", text))
                if m:
                    cur = m.group(1) + "." + m.group(2)
                    g = group if m.group(1) != "3p" else next(c for c, _, r in PROBABILITY if int(m.group(2)) in r)
                    if g not in tops:
                        title = next(t for c, t, _ in PROBABILITY if c == g)
                        tops[g] = {"code": g, "ref": g, "title": title, "section": "3", "text": "", "year": 0}
                        order.append(g)
                    tops[g].setdefault("parts", []).append([cur, m.group(3), ""])
                    cur_top = g
                    continue
            if cur is not None and b[0] >= 100:
                tops[cur_top]["parts"][-1][2] += " " + text
    topics = [tops[c] for c in order]
    for t in topics:
        # Every statement shows, at 3,000 characters at most: guidance is clipped, evenly, where the topic is longer.
        parts = [[c, re.sub(r"\s+", " ", a.replace("●", "•")).strip(), re.sub(r"\s+", " ", g).strip()] for c, a, g in t.pop("parts")]
        room = 3000 - sum(len(c) + len(a) + 6 for c, a, _ in parts)
        each = max(0, room // len(parts))
        t["text"] = " ".join(f"[{c}] {a} " + (g if len(g) <= each else g[:each].rsplit(" ", 1)[0] + "…") for c, a, g in parts)[:3000]
        t["title"] = t["title"][0].upper() + t["title"][1:]
    sections = [{"code": c, "title": f"{c}. {full}", "short": short, "year": 0} for c, (full, short) in SECTIONS.items()]
    json.dump({"1ST0": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for t in topics:
        print(f"{t['code']:3} {t['title'][:55]:55} {len(t['text'])} chars", file=sys.stderr)


if __name__ == "__main__":
    main()
