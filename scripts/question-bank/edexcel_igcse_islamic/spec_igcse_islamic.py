"""Read Pearson Edexcel's International GCSE Islamic Studies (4IS1) specification into a topic tree.

    python3 scripts/question-bank/edexcel_igcse_islamic/spec_igcse_islamic.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-igcse-islamic

Writes <work-dir>/spec.json in spec_igcse.py's shape: {"4IS1": {"sections": [...], "topics": [...]}}. The paper's
three sections (A: the life, teachings and achievements of the Prophet; B: the beliefs, practices and features of
the early Muslim community; C: living the Muslim life today) are the bank's sections, and their numbered subject
content, 1.1 to 3.9, its topics, coded as printed ("2.7 Shari'ah"), each with its lettered statements' words for
tagging. A question in Section A is on a 1.x topic, and so on, as the paper sets them. Not split by year (`year` 0).
"""
import json, os, re, sys, urllib.parse, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-igcse-islamic")
URL = "https://qualifications.pearson.com/content/dam/pdf/International GCSE/islamic-studies/2017/specification-and-sample-assessments/international-gcse-islamic-studies-specification.pdf"
SECTIONS = {
    "A": "The life, teachings and achievements of the Prophet Muhammad (pbuh)",
    "B": "The key beliefs, practices and features of the early Muslim community",
    "C": "Living the Muslim life today",
}
FOOTER = re.compile(r"Pearson Edexcel International GCSE in Islamic Studies\s*[–-]\s*\n?\s*Specification\s*[–-]\s*Issue \d+[^\n]*\n(?:\s*\d+\s*\n)?")
TOPIC = re.compile(r"^\s*([123])\.([1-9])\s+(.+?)\s*\n(?=(?:.*\n){0,4}?\s*a\)\s)", re.M)


def content(path):
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = FOOTER.sub("\n", text)
    start = text.index("Section A: The life, teachings", text.index("Paper 1: Islamic Studies\nExternally assessed"))
    return text[start:re.search(r"Assessment information\s*\nAssessment requirements", text[start:]).start() + start]


def main():
    os.makedirs(os.path.join(WORK, "spec"), exist_ok=True)
    path = os.path.join(WORK, "spec", "4IS1.pdf")
    if not os.path.exists(path):
        req = urllib.request.Request(urllib.parse.quote(URL, safe=":/"), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            open(path, "wb").write(r.read())
    body = content(path)
    heads = list(TOPIC.finditer(body))
    topics = []
    for k, h in enumerate(heads):
        rest = body[h.end():heads[k + 1].start() if k + 1 < len(heads) else None]
        # The title wraps in its narrow column ("1.1 Personal aspects of / the Prophet's (pbuh) / life") until "a)".
        title_rest, _, statements = rest.partition("a)")
        title = re.sub(r"\s+", " ", f"{h.group(3)} {title_rest}").strip()
        statements = re.sub(r"Please see related passages.*?Appendix 5: Passages\s*from the Qur.an and Hadith\.", " ", "a)" + statements, flags=re.S)
        statements = re.split(r"\n\s*Section [BC]: |Subject content\s*\nWhat students need to learn:", statements)[0]
        topics.append({"code": f"{h.group(1)}.{h.group(2)}", "title": title[0].upper() + title[1:], "section": "ABC"[int(h.group(1)) - 1],
                       "year": 0, "text": re.sub(r"\s+", " ", statements.replace("•", ";")).strip()})
    assert [t["code"] for t in topics] == [f"{s}.{n}" for s in (1, 2, 3) for n in range(1, 10)], [t["code"] for t in topics]
    sections = [{"code": c, "title": f"Section {c}: {t}", "short": t, "year": 0} for c, t in SECTIONS.items()]
    json.dump({"4IS1": {"sections": sections, "topics": topics}}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for t in topics:
        print(f"   {t['code']:4} {t['title'][:70]:70} {len(t['text'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
