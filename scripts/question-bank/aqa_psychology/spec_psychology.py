"""Read AQA's A-Level Psychology specification (7181/7182) into the bank's topic tree.

    python3 scripts/question-bank/aqa_psychology/spec_psychology.py [work-dir]   # default scripts/question-bank/.work/aqa-psychology

spec.py's reader, over the A-Level subject content (numbered 4: 4.1.1 Social
influence; the AS content, numbered 3, is the same topics again). Writes
<work-dir>/spec.json as {"7182": {"sections": [...], "topics": [...]}}, the shape
the OCR bank uses, arranged the way the papers are:

  4.1  Introductory topics (Paper 1): Social influence, Memory, Attachment, Psychopathology
  4.2  Psychology in context (Paper 2): Approaches, Biopsychology, and Research
       methods split into its own four (methods, scientific processes, data
       handling and analysis, inferential testing), since it is a quarter of the marks
  4.3  Issues and debates (Paper 3 Section A)
  4.3B, 4.3C, 4.3D  the Paper 3 options, one tile per section a student picks from
       (year 3, "Paper 3 options"); everything else is year 0, by area.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-psychology")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/psychology/specifications/AQA-7181-7182-SP-2015.PDF"
spec.HEADING = re.compile(r"^(4(?:\.\d+){1,3})\s+(.+)$")
SECTIONS = [
    ("4.1", "Introductory topics"),
    ("4.2", "Psychology in context"),
    ("4.3", "Issues and debates"),
    ("4.3B", "Relationships, gender, cognition"),
    ("4.3C", "Schizophrenia, eating, stress"),
    ("4.3D", "Aggression, forensic, addiction"),
]
OPTION = {"4.3.2": "4.3B", "4.3.3": "4.3B", "4.3.4": "4.3B", "4.3.5": "4.3C", "4.3.6": "4.3C", "4.3.7": "4.3C",
          "4.3.8": "4.3D", "4.3.9": "4.3D", "4.3.10": "4.3D"}
TITLES = {"4.2.1": "Approaches in psychology", "4.3.1": "Issues and debates", "4.3.9": "Forensic psychology"}


def main():
    os.makedirs(spec.WORK, exist_ok=True)
    nodes = spec.read(spec.fetch(URL, os.path.join(spec.WORK, os.path.basename(URL))))
    topics = []
    for n in nodes:
        if n["level"] == 1:
            continue
        code = n["code"]
        text = re.split(r"\s5 Scheme of assessment|\s5\.1 ", n["text"])[0]
        # The page footer, read into the text where a topic crosses a page.
        text = re.sub(r"AQA AS and A-level Psychology 7181, 7182\..*?administration( \d+)?", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        if code == "4.2.3":
            text = "Research methods: " + text
        topics.append({"code": code, "title": TITLES.get(code, n["title"]), "section": OPTION.get(code, code[:3]),
                       "year": 3 if code in OPTION else 0, "text": text})
    out = {"7182": {"sections": [{"code": c, "title": t} for c, t in SECTIONS], "topics": topics}}
    json.dump(out, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"7182: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)


if __name__ == "__main__":
    main()
