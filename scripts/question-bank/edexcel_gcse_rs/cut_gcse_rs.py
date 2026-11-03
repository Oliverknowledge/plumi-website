"""Cut Pearson Edexcel's GCSE Religious Studies A (1RA0) and B (1RB0) papers: edexcel_gcse_history/cut_gcse_history.py's reader.

    python3 scripts/question-bank/edexcel_gcse_rs/cut_gcse_rs.py [work-dir] [--only=1rb02f-jun23]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-rs

Every question runs (a) to (d) and is answered in the paper, on pages of dotted lines, as in GCSE History: that
cutter's reader, answer-line closing and levels-grid masking are used as they are. What Religious Studies adds:
  - The paper's furniture: the heading over each question ("Question 1: Beliefs and Teachings") and the notice
    over a *(d) ("In this question, 3 of the marks awarded...") belong to no part's words.
  - Mark schemes that print a label with a Q: "Q2(b)", "Q1 (a)", or a level in two lines, "Level" over "1".
  - Reports head a part many ways: "1RA0_1A_Q01a", "Question 1a:", "2b:", "1a   Outline three ways…", "2 (a) Outline…", and "Question one"
    over a question's parts; each is read as "Question 1 (a)" or "Question 1". --reports reads every report again, without
    cutting anything.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-rs"), *flags]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_gcse_history"))
import cut_gcse_history as ch  # noqa: E402

cp = ch.cp
ch.FURNITURE = re.compile(ch.FURNITURE.pattern[:-2] + r"|Question \d: .*|Section \d: .*|\(Total for Question \d+ = \d+ marks?\)|"
                          r"In this question, \d of the marks awarded.*|punctuation and grammar and your use of specialist terminology.*|"
                          r"Answer ALL questions.*)$")


_ms_tables = cp.ms_tables
# A scheme's misprinted label, by file and page: November 2020's 1RB0 3G prints 4(b) as "3(b)"
MISPRINTS = {("1rb0-3g-ms-nov20.pdf", 17): ("3(b)", "4(b)")}
# Pearson's footer on a scheme's last page, under the last levels grid
cp.BACK_BLOCK = re.compile(cp.BACK_BLOCK.pattern[:-2] + r"|Pearson Education Limited\. Registered)")


def ms_tables(doc):
    """A scheme's "Q2(b)" in the Question column, read as "2(b)"; a levels grid's "Level" over "1" (a narrow column), no label."""
    for i in range(len(doc)):
        out = []
        wrong = MISPRINTS.get((os.path.basename(doc.doc.name), i))
        for l in doc.lines(i):
            if wrong and l["text"].strip() == wrong[0]:
                l = {**l, "text": wrong[1]}
            elif l["x0"] < 130 and re.fullmatch(r"\s*Q\s*\d\s*\(?[a-d]\)?\*?\s*", l["text"]):
                l = {**l, "text": l["text"].strip()[1:].strip()}
            elif re.fullmatch(r"\s*\d\s*", l["text"]) and any(o["text"].strip() == "Level" and abs(o["x0"] - l["x0"]) < 6 and 0 < l["y0"] - o["y0"] < 18 for o in out):
                l = {**l, "text": "· " + l["text"].strip()}
            out.append(l)
        doc._lines[i] = out
    # (--extracts steps over a blank page between a long answer's content and its levels grid: 1RB0 3D, June 2019)
    cp.EXTRACTS = True
    try:
        return _ms_tables(doc)
    finally:
        cp.EXTRACTS = False


cp.ms_tables = ms_tables


_report_pages = ch.report_pages
WORDS = {"one": 1, "two": 2, "three": 3, "four": 4}


def heading(q, letter=None):
    return f"\n\nQuestion {int(q)}" + (f" ({letter})" if letter else "") + "\n\n"


def report_pages(path):
    out = []
    for t in _report_pages(path):
        # A page's number and running head: cut_pearson would read a bare "1" over "Introduction" as Question 1's heading
        t = re.sub(r"(?:^|\n)[ \t]*(?:\d{1,2}[ \t]*\n[ \t]*)?(?:\d{1,2}[ \t]+)?GCSE Religious Studies(?: [AB])? 1R[AB]0 \d[A-G][ \t]*(?:\n[ \t]*\d{1,2}[ \t]*)?(?=\n|$)", "\n", t)
        t = re.sub(r"(?:^|\n)[ \t]*\d{1,2}[ \t]*(?=\n|$)", "\n", t)
        t = re.sub(r"\n[ \t]*1R[AB]0_\d[A-G]_Q0?(\d)([a-d])[ \t]*(?=\n)", lambda m: heading(m.group(1), m.group(2)), t)
        t = re.sub(r"\n[ \t]*Question[ \t]+(\d)([a-d])[ \t]*:?[ \t]*(?=\n)", lambda m: heading(m.group(1), m.group(2)), t)
        t = re.sub(r"\n[ \t]*(\d)([a-d])[ \t]*:[ \t]*(?=\n)", lambda m: heading(m.group(1), m.group(2)), t)
        # (where its first part's heading follows at once, that heading says it)
        t = re.sub(r"\n[ \t]*Question (one|two|three|four)[ \t]*(?=\n\s*\d\s*\(?[a-d]\b)", "", t, flags=re.I)
        t = re.sub(r"\n[ \t]*Question (one|two|three|four)[ \t]*(?=\n\s*Outline)", lambda m: heading(WORDS[m.group(1).lower()], "a"), t, flags=re.I)
        t = re.sub(r"\n[ \t]*Question (one|two|three|four)[ \t]*(?=\n)", lambda m: heading(WORDS[m.group(1).lower()]), t, flags=re.I)
        # ("1a Outline…", "2 (a) Outline…", and once "2b b) Explain…", "2c(c) Explain…")
        t = re.sub(r"\n[ \t]*(\d)[ \t]*\(?([a-d])\)?(?:[ \t]*\(?[a-d]\))?[ \t:–-]+(?=[A-Z“‘\"])", lambda m: heading(m.group(1), m.group(2)), t)
        out.append(t)
    return out


ch.report_pages = report_pages


def reread_reports(parts):
    """Each part's report comments, from report_pages: its question's, as cut_set takes them."""
    done = {}
    for p in parts:
        comp, series = p["component"], p["series"]
        path = os.path.join(cp.WORK, "pdf", f"{comp[:4]}-{comp[4:]}-er-{series.lower()}.pdf")
        if p["set"] not in done:
            done[p["set"]] = cp.examiner_report(path)
        p["er"] = done[p["set"]].get(p["question"])
    return parts


def main():
    if "--reports" not in flags:
        return cp.main()
    path = os.path.join(cp.WORK, "parts.json")
    parts = reread_reports(json.load(open(path)))
    json.dump(parts, open(path, "w"), ensure_ascii=False)
    print(f"{len(parts)} parts, {sum(1 for p in parts if p.get('er'))} with report comments", file=sys.stderr)


if __name__ == "__main__":
    main()
