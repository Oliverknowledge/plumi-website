"""Read Pearson Edexcel's International GCSE Biology, Chemistry and Physics specifications into a topic tree.

    python3 scripts/question-bank/edexcel_igcse/spec_igcse.py [work-dir]   # default scripts/question-bank/.work/edexcel-igcse

Writes <work-dir>/spec.json in spec_pearson.py's shape: { "4BI1": { "sections": [...], "topics": [...] }, ... }.
Each specification is printed as numbered topics ("2 Structure and functions in living organisms"),
the bank's tiles, each split into lettered sub-topics ("(e) Nutrition") with numbered statements
under them (2.33, 2.36B: a letter marks a statement examined on Paper 2 only). The sub-topics are
the bank's topics, coded "2e", with their statement numbers as `points` and their statements' words
for tagging. Physics opens each topic with a "Units" sub-topic, the units the rest of it uses; those
are left out, as a question on them is a question on the sub-topic that uses them. Not split by year (`year` 0).
"""
import json, os, re, sys, urllib.parse, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-igcse")
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
from spec_pearson import clean, sentence_case  # noqa: E402

BASE = "https://qualifications.pearson.com/content/dam/pdf/International GCSE/"
SPECS = {
    "4BI1": "Biology/2017/specification-and-sample-assessments/international-gcse-biology-2017-specification1.pdf",
    "4CH1": "Chemistry/2017/specification-and-sample-assessments/international-gcse-chemistry-2017-specification.pdf",
    "4PH1": "Physics/2017/specification-and-sample-assessments/international-gcse-physics-2017-specification.pdf",
}
FOOTER = re.compile(r"Pearson Edexcel International GCSE in \w+\s*\nSpecification – Issue \d+ – [^\n]+\n\s*\d+\s*\n")
SECTION = re.compile(r"^[ \t]*(\d{1,2})[ \t]*\n?[ \t]*([A-Z][^\n]+(?:\n(?!The following)[^\n]+)?)\s*\nThe following sub-topics are covered in this section[.:]", re.M)
SUB = re.compile(r"^\s*\(([a-n])\)\s*\n\s*([^\n]+)\s*\n(?=(?:\s*\n)*\s*(?:Students should|[A-Z][^\n]*\n\s*Students should))", re.M)
STATEMENT = re.compile(r"^\s*(\d{1,2})\.(\d{1,3})[BCP]?\s", re.M)


def content(path):
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = FOOTER.sub("\n", text)
    start = SECTION.search(text).start()
    end = min(i for i in (text.find(w, start) for w in ("Assessment information", "Appendices")) if i > 0)
    return text[start:end]


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    out = {}
    for code, name in SPECS.items():
        path = os.path.join(WORK, "spec", f"{code}.pdf")
        if not os.path.exists(path):
            req = urllib.request.Request(urllib.parse.quote(BASE + name, safe=":/"), headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                open(path, "wb").write(r.read())
        body = content(path)
        heads = list(SECTION.finditer(body))
        sections, topics = [], []
        for k, h in enumerate(heads):
            n, title = int(h.group(1)), sentence_case(re.sub(r"\s+", " ", h.group(2)).strip())
            sections.append({"code": str(n), "title": f"Topic {n}: {title}", "short": title, "year": 0})
            chunk = body[h.end():heads[k + 1].start() if k + 1 < len(heads) else None]
            subs = list(SUB.finditer(chunk))
            for j, s in enumerate(subs):
                text = chunk[s.end():subs[j + 1].start() if j + 1 < len(subs) else None]
                nums = [int(m.group(2)) for m in STATEMENT.finditer(text) if int(m.group(1)) == n]
                if not nums or s.group(2).strip() == "Units":
                    continue  # Physics opens each topic with its units, which every question in the topic uses
                points = f"{n}.{min(nums)}–{n}.{max(nums)}" if len(nums) > 1 else f"{n}.{nums[0]}"
                topics.append({"code": f"{n}{s.group(1)}", "ref": "", "title": sentence_case(re.sub(r"\s+", " ", s.group(2)).strip()),
                               "section": str(n), "points": points, "year": 0, "text": clean(text)})
        out[code] = {"sections": sections, "topics": topics}
        print(f"{code}: {len(sections)} topics, {len(topics)} sub-topics", file=sys.stderr)
        for t in topics:
            print(f"   {t['code']:4} {t['title'][:50]:50} {t['points']:12} {len(t['text'])}", file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
