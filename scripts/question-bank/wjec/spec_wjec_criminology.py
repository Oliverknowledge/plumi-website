"""Read WJEC's Level 3 Applied Diploma in Criminology specification into a topic tree.

    python3 scripts/question-bank/wjec/spec_wjec_criminology.py [work-dir]
    # reads <work-dir>/spec/criminology.pdf (fetch_wjec.py --only=criminology); writes <work-dir>/spec.json

Only the two examined units are the bank's, Unit 2 (Criminological Theories) and Unit 4 (Crime
and Punishment); Units 1 and 3 are controlled assessments. Each unit's content is a table,
"learning outcomes | Assessment criteria | Content | Amplification": a learning outcome
("LO1 Understand social constructions of criminality") is a section, and each of its assessment
criteria ("AC1.1 Compare criminal behaviour and deviance") a topic, as the mark schemes of
2017-2019 and the examiners' reports refer to them. Codes are the unit's and then the AC's,
"2.1.1" (Unit 2, AC1.1), with `ref` the AC as printed, "AC1.1"; sections "2.1" (Unit 2, LO1).
The titles come from the assessment grids in section 3, where each AC is set on a line of its own.

Writes spec.json in spec_wjec.py's shape: {"criminology": {"sections": [...], "topics": [...]}}.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "wjec-criminology")
UNITS = {"2": "Criminological Theories", "4": "Crime and Punishment"}
HEADER = re.compile(r"Unit \d learning\s+outcomes\s+Assessment criteria\s+Content\s+Amplification\s+The learner will:\s+The learner can:")


def main():
    doc = pymupdf.open(os.path.join(WORK, "spec", "criminology.pdf"))
    pages = [re.sub(r"[ \t]+", " ", p.get_text()) for p in doc]
    sections, topics = [], []
    for unit, name in UNITS.items():
        # The assessment grid: "For Unit 2: Criminological Theories, the assessment criteria (AC) will be covered…" (Unit 4: "the AC")
        grid = next(t for t in pages if re.search(rf"For Unit {unit}:\s+{name}, the ", t))
        grid = re.sub(r"\s+", " ", grid.split("TOTAL")[0])
        titles = {m.group(1): m.group(2).strip() for m in re.finditer(r"AC(\d\.\d)\s+(.*?)(?=\s+(?:\d{2}-\d{2}|LO\d|AC\d\.\d)\b|$)", grid)}
        # The unit's content: from its "5.n Unit 2:" page to the next unit's, its table's own headings left out.
        start = next(i for i, t in enumerate(pages) if re.search(rf"^5\.\d Unit {unit}:", t, re.M))
        stop = next((i for i in range(start + 1, len(pages)) if re.search(r"^5\.\d Unit \d:", pages[i], re.M)), len(pages))
        body = "\n".join(HEADER.sub(" ", re.sub(r"\s+", " ", t)) for t in pages[start:stop] if HEADER.search(re.sub(r"\s+", " ", t)))
        body = re.split(r"\bMaking contacts\b|\bDelivery of the unit\b", body)[0]
        body = re.sub(r"WJEC Level 3 Applied Diploma in Criminology \d+ © WJEC CBAC Ltd\.", " ", body)  # each page's running head
        los = {m.group(1): re.sub(r"\s+", " ", m.group(2)).strip() for m in re.finditer(r"LO(\d)\s+(.*?)\s+AC\1\.1\b", body)}
        for lo, lo_title in los.items():
            sections.append({"code": f"{unit}.{lo}", "title": f"Unit {unit}, LO{lo}: {lo_title}"})
        chunks = re.split(r"\bAC(\d\.\d)\b", body)
        for k in range(1, len(chunks), 2):
            ac, text = chunks[k], chunks[k + 1]
            text = re.sub(r"LO\d\s+.*$", "", text).strip()  # the next learning outcome's name, above its first AC
            title = titles[ac]
            text = text[len(title):].strip() if text.startswith(title) else text
            topics.append({"code": f"{unit}.{ac}", "ref": f"AC{ac}", "title": title, "section": f"{unit}.{ac[0]}", "year": 0,
                           "text": re.sub(r"\s+", " ", text)[:1500]})
    tree = {"sections": sections, "topics": topics}
    json.dump({"criminology": tree}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        print(s["code"], s["title"], [f"{t['ref']} {t['title']}" for t in topics if t["section"] == s["code"]], file=sys.stderr)


if __name__ == "__main__":
    main()
