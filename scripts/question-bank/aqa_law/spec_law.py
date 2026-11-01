"""Read AQA's A-Level Law specification (7162) into the bank's topic tree.

    python3 scripts/question-bank/aqa_law/spec_law.py [work-dir]   # default scripts/question-bank/.work/aqa-law

The subject content (3.1 The nature of law and the English legal system, 3.2 Criminal
law, 3.3 Tort, 3.4 Law of contract, 3.5 Human rights) is a table: a topic's heading
on the left ("Fatal offences against the person"), what is taught on the right, kept
as "text" for tagging only. The headings carry no numbers, so, as in the OCR Law and
Edexcel Politics banks, they are coded by section and place: "CR.3" is criminal law's
third. 3.1 is three sections, as its headings name them: the nature of law (NL),
law making (LM) and the legal system (LS). Contract (CO) and Human rights (HR) are
Paper 3's options, so their sections carry the option. There is no AS: every topic is
year 0, but for the options' (3).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-law")]
sys.path.insert(0, os.path.dirname(HERE))
import pymupdf  # noqa: E402
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/law/specifications/AQA-7162-SP-2017.PDF"
SECTIONS = [("NL", "The nature of law", None), ("LM", "Law making", None), ("LS", "The legal system", None),
            ("CR", "Criminal law", None), ("TO", "Tort", None), ("CO", "Contract (Paper 3A)", "contract"), ("HR", "Human rights (Paper 3B)", "human-rights")]
# The bank's title for each heading, in the specification's order, with the section it is in.
TOPICS = [
    ("NL", "Introduction to the nature of law"), ("NL", "Law and society"), ("NL", "Law and morality"), ("NL", "Law and justice"), ("NL", "The rule of law"),
    ("LM", "Parliamentary law making"), ("LM", "Delegated legislation"), ("LM", "Statutory interpretation"), ("LM", "Judicial precedent"),
    ("LM", "Law reform"), ("LM", "The European Union"),
    ("LS", "Civil courts and alternative dispute resolution"), ("LS", "Criminal courts and lay people"), ("LS", "Legal personnel and the judiciary"),
    ("LS", "Access to justice and funding"),
    ("CR", "The rules of criminal law"), ("CR", "Theory in criminal law"), ("CR", "General elements of liability"), ("CR", "Fatal offences against the person"),
    ("CR", "Non-fatal offences against the person"), ("CR", "Property offences"), ("CR", "Attempts"), ("CR", "Capacity defences"), ("CR", "Necessity defences"),
    ("TO", "The rules of tort law"), ("TO", "Theory of tort law"), ("TO", "Negligence: physical injury and damage to property"),
    ("TO", "Negligence: economic loss and psychiatric injury"), ("TO", "Occupiers' liability"), ("TO", "Nuisance and the escape of dangerous things"),
    ("TO", "Vicarious liability"), ("TO", "Defences in tort"), ("TO", "Remedies in tort"),
    ("CO", "The rules of contract law"), ("CO", "Theory of contract law"), ("CO", "Essential requirements of a contract"), ("CO", "Contract terms: general"),
    ("CO", "Terms implied by statute in consumer contracts"), ("CO", "Exclusion clauses"), ("CO", "Vitiating factors"), ("CO", "Discharge of a contract"),
    ("CO", "Remedies in contract"),
    ("HR", "The rules in human rights law"), ("HR", "Theory in human rights"), ("HR", "Human rights in international law"),
    ("HR", "Human rights in the UK before the Human Rights Act 1998"), ("HR", "Human rights in the UK after the Human Rights Act 1998"),
    ("HR", "The European Convention on Human Rights"), ("HR", "Article 2: the right to life"), ("HR", "Article 5: liberty and security"),
    ("HR", "Article 8: private and family life"), ("HR", "Article 10: freedom of expression"), ("HR", "Article 11: assembly and association"),
    ("HR", "Restrictions on Convention rights"), ("HR", "Enforcement of human rights"),
]


def headings(doc):
    """[(the specification's heading, its taught content)] in order, from 3.1 to the end of 3.5."""
    out, last_y, started = [], None, False
    for page in list(doc)[8:18]:
        rows = sorted((round(l["bbox"][1]), l["bbox"][0], re.sub(r"\s+", " ", "".join(s["text"] for s in l["spans"])).strip())
                      for b in page.get_text("dict")["blocks"] for l in b.get("lines", []))
        last_y = None  # a heading never runs on over a page
        for y, x, t in rows:
            started = started or t.startswith("3.1 The nature of law")
            if not started or not t or y < 60 or y > page.rect.height - 50 or t in ("Content", "Additional information") or re.match(r"^3\.\d ", t):
                continue
            if 55 < x < 250:
                if last_y is not None and y - last_y < 17:
                    out[-1][0] += " " + t  # a heading set on two lines, whatever its content's lines beside it
                else:
                    out.append([t, ""])
                last_y = y
            elif out and x >= 250:
                out[-1][1] += " " + t
    # Criminal law's defences are one heading, "Defences", over two: capacity and necessity defences.
    merged = []
    for h in out:
        if merged and merged[-1][0] == "Defences" and h[0].endswith("defences"):
            merged[-1] = [h[0], merged[-1][1] + h[1]]
        else:
            merged.append(h)
    return merged


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    doc = pymupdf.open(spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL))))
    found = headings(doc)
    assert len(found) == len(TOPICS), f"{len(found)} headings, {len(TOPICS)} titles: {[h for h, _ in found]}"
    sections = [{"code": c, "title": t, **({"option": o} if o else {})} for c, t, o in SECTIONS]
    option = {c: o for c, _, o in SECTIONS}
    topics, n = [], {}
    for (heading, text), (sec, title) in zip(found, TOPICS):
        n[sec] = n.get(sec, 0) + 1
        # The table prints Article 2's content beside the Convention's heading and leaves its own row empty.
        text = re.sub(r"\s+", " ", text).strip()[:1500] or topics[-1]["text"]
        topics.append({"code": f"{sec}.{n[sec]}", "ref": "", "title": title, "section": sec, "year": 3 if option[sec] else 0, "heading": heading, "text": text})
    json.dump({"7162": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(sections)} sections, {len(topics)} topics", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:6} {t['title']!r:55} <- {t['heading']!r}: {t['text'][:50]!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
