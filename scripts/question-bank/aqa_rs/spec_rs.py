"""Read AQA's A-Level Religious Studies specification (7062) into the bank's topic tree.

    python3 scripts/question-bank/aqa_rs/spec_rs.py [work-dir]   # default scripts/question-bank/.work/aqa-rs

The specification sets out Component 1 (Paper 1, everyone's) under 13pt headings
(Arguments for the existence of God, Conscience), and Component 2 once per religion
(3.2.1 2A Buddhism ... 3.2.5 2E Judaism), each with a Section A of bold topics
(Sources of wisdom and authority, Buddhism and science) and a Section B of two
dialogues (The dialogue between Buddhism and philosophy, ... and ethics). AQA's
specification has no Sikhism option (2F): there are five religions.

The tree, in the shape the Eduqas Religious Studies bank uses, is:

  sections  1A Philosophy of religion and 1B Ethics and religion (Paper 1's two
            sections, no option), then one per religion (A Buddhism ... E Judaism),
            each carrying its `option`, so the Religion filter keeps a student's own
  topics    Paper 1's headings (1A.1 Arguments for the existence of God), and each
            religion's nine Section A topics and two dialogues (B.1 Sources of
            wisdom and authority ... B.10 The dialogue between Christianity and
            philosophy, B.11 ... and ethics)

Two of Paper 1's headings aren't topics of their own: "Verifying religious experiences"
is the second half of Religious experience, and "The application of natural moral
law, situation ethics and virtue ethics to:" heads two topics, its bullets "Issues of
human life and death" and "Issues of animal life and death" (as the specification's
own summary of the paper lists them). Each topic's words are kept for tagging,
never shown. Every topic is year 0: the bank has no AS papers to split by.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-rs")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/rs/specifications/AQA-7062-SP-2016.PDF"
RELIGIONS = {"A": "Buddhism", "B": "Christianity", "C": "Hinduism", "D": "Islam", "E": "Judaism"}
PAPER1 = [("1A", "Philosophy of religion"), ("1B", "Ethics and religion")]
TITLES = {"Introduction to meta ethics: the meaning of right and wrong": "Meta-ethics: the meaning of right and wrong"}


def lines(path):
    """[(page, size, bold, x, text)] for the subject content (section 3), footers dropped."""
    out = []
    for n, page in enumerate(pymupdf.open(path)):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans or line["bbox"][1] > page.rect.height - 50:
                    continue
                text = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                out.append((n, max(s["size"] for s in spans), all("Bold" in s["font"] for s in spans), line["bbox"][0], text))
    start = next(i for i, l in enumerate(out) if l[1] >= 18 and l[4].startswith("3.1 "))
    end = next(i for i, l in enumerate(out) if i > start and l[1] >= 30)  # 4 Scheme of assessment
    return out[start:end]


def read(path):
    """[(section, title, text)] in the specification's order."""
    nodes, section, current = [], None, None
    for pg, size, bold, x, text in lines(path):
        if size >= 15.5:
            m = re.match(r"3\.1\.(\d) Section ([AB])", text)
            r = re.match(r"3\.2\.\d 2([A-E]) ", text)
            section = f"1{m.group(2)}" if m else r.group(1) if r else None
            current = None
        elif size >= 12.5:
            # Component 2's "Section A: Buddhism" / "Section B: Dialogues" are just dividers.
            current = None if text.startswith("Section ") else [section, text, ""]
            if current and section:
                nodes.append(current)
        elif bold and size >= 10.5 and section in RELIGIONS:
            current = [section, text, ""]
            nodes.append(current)
        elif current is not None and size > 9:
            current[2] += " " + text
    return nodes


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL)))
    sections = [{"code": c, "title": t} for c, t in PAPER1] + [{"code": c, "title": t, "option": c} for c, t in RELIGIONS.items()]
    topics, n = [], {}
    for section, title, text in read(path):
        text = re.sub(r"\s*•\s*", " • ", text).strip(" •")
        if title.startswith("Verifying religious experiences"):
            topics[-1]["text"] += f" {title}: {text}"
            continue
        if title.startswith("The application of natural moral law"):
            # Its two bullets, each with what it covers: "Issues of human life and death: • embryo research ..."
            human, animal = re.split(r"(?=Issues of non-human life and death)", text, maxsplit=1)
            for t, body in (("Issues of human life and death", human), ("Issues of animal life and death", animal)):
                n[section] = n.get(section, 0) + 1
                topics.append({"code": f"{section}.{n[section]}", "title": t, "section": section, "year": 0,
                               "text": f"Natural moral law, situation ethics and virtue ethics applied to {body.strip(' •')}"})
            continue
        n[section] = n.get(section, 0) + 1
        topics.append({"code": f"{section}.{n[section]}", "title": TITLES.get(title, title), "section": section, "year": 0, "text": text})
    for t in topics:
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()[:1500]
    json.dump({"7062": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"7062: {len(topics)} topics in {len(sections)} sections", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:5} {t['title']} ({len(t['text'])})", file=sys.stderr)


if __name__ == "__main__":
    main()
