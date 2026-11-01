"""Read AQA's A-Level History specification (7042) into the bank's topic tree.

    python3 scripts/question-bank/aqa_history/spec_history.py [work-dir]   # default scripts/question-bank/.work/aqa-history

The specification sets out each option under a 19pt heading ("1H Tsarist and Communist
Russia, 1855–1964"), its two parts under 16pt ones ("Part one: Autocracy, Reform and
Revolution: Russia, 1855–1917") and the part's periods under 13pt ones ("Trying to
preserve autocracy, 1855–1894"), each with its bullets of content.

The tree, in the shape the Eduqas GCSE History bank uses, is:

  sections  one per option, 1A The Age of the Crusades ... 2T The Crisis of Communism,
            each carrying its `option`, so the Option filter keeps a student's own
  topics    each option's periods (1H.1 Trying to preserve autocracy, 1855–1894),
            "(A-level only)" dropped: the bank has no AS papers

Each topic's dates are kept (`from`, `to`) for tagging by the years a question names,
and its words for tagging the rest; neither is shown. Every topic is year 0.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-history")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/history/specifications/AQA-7041-7042-SP-2015.PDF"
OPTION = re.compile(r"^([12][A-T]) (.+)$")
AS_ONLY = re.compile(r"\s*\(A-\s*level only\)\s*", re.I)
# The specification misprints 1C's first period's king ("Henry VIII, 1485–1509"): Henry VII reigned then.
MISPRINTS = {"Henry VIII, 1485–1509": "Henry VII, 1485–1509"}


def years(title):
    """'The collapse of autocracy, 1894–1917' -> (1894, 1917); 'The Church in c1529' -> (1529, 1529)."""
    ys = [int(y) for y in re.findall(r"c?(\d{4})", title.split(",")[-1] if "," in title else title)]
    return (min(ys), max(ys)) if ys else (None, None)


def lines(path):
    """[(size, text)] for the options' content (Component 1 and 2), lines of a heading joined."""
    out = []
    for page in pymupdf.open(path):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans or line["bbox"][1] > page.rect.height - 50:
                    continue
                size = round(max(s["size"] for s in spans))
                text = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                # A heading that wraps ("2F The Sun King: Louis XIV, France and Europe, 1643–" / "1715 (A-level only)").
                if out and size >= 13 and out[-1][0] == size and (out[-1][1].endswith(("–", "-", ",")) or re.match(r"^(\d{4}|c\d{4}|level only|\(A-level only\)|\(A-)", text)
                                                                  or (size >= 16 and not re.match(r"^(Part|[12][A-T] )", text))):
                    out[-1] = (size, out[-1][1] + ("" if out[-1][1].endswith(("–", "-")) else " ") + text)
                else:
                    out.append((size, text))
    start = next(i for i, l in enumerate(out) if l[0] >= 19 and l[1].startswith("1A "))
    end = next(i for i, l in enumerate(out) if i > start and l[0] >= 19 and l[1].startswith("Component 3"))
    return out[start:end]


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL)))
    sections, topics, current, part = [], [], None, ""
    for size, text in lines(path):
        text = AS_ONLY.sub(" ", text).strip()
        text = MISPRINTS.get(text, text)
        if size >= 19:
            m = OPTION.match(text)
            sections.append({"code": m.group(1), "title": m.group(2), "option": m.group(1)})
            current = None
        elif size >= 16:
            part, current = text, None
        elif size >= 13:
            code = sections[-1]["code"]
            n = sum(1 for t in topics if t["section"] == code) + 1
            lo, hi = years(text)
            current = {"code": f"{code}.{n}", "title": text, "section": code, "year": 0, "from": lo, "to": hi, "text": part + ". "}
            topics.append(current)
        elif current is not None and size >= 10:
            current["text"] += " " + text
    for t in topics:
        t["text"] = re.sub(r"\s*•\s*", " • ", re.sub(r"\s+", " ", t["text"])).strip(" •")[:1500]
    json.dump({"7042": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"7042: {len(topics)} topics in {len(sections)} sections", file=sys.stderr)
    for s in sections:
        print(f"  {s['code']} {s['title']}", file=sys.stderr)
        for t in topics:
            if t["section"] == s["code"]:
                print(f"     {t['code']:6} {t['title']} [{t['from']}-{t['to']}] ({len(t['text'])})", file=sys.stderr)


if __name__ == "__main__":
    main()
