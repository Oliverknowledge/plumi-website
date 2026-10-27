"""Read AQA's A-Level Philosophy specification (7172) into the bank's topic tree.

    python3 scripts/question-bank/aqa_philosophy/spec_philosophy.py [work-dir]   # default scripts/question-bank/.work/aqa-philosophy

The specification numbers only its four areas (3.1 Epistemology, 3.2 Moral
philosophy, 3.3 Metaphysics of God, 3.4 Metaphysics of mind) and their topics
(3.1.2 Perception as a source of knowledge); under a topic, unnumbered headings
name what is taught (Direct realism, Indirect realism, Berkeley's Idealism), and
those are what the papers ask about. So the tree, in the shape the Psychology bank
uses ({"7172": {"sections": [...], "topics": [...]}}), is:

  sections  the four areas, one per half paper (Paper 1: Epistemology, Moral
            philosophy; Paper 2: Metaphysics of God, Metaphysics of mind)
  topics    each unnumbered heading, numbered on from its topic (3.1.2.1 Direct
            realism), or the topic itself where it has none (3.1.4 The limits of
            knowledge). A topic's opening words, before its first heading, go
            with each heading under it, for tagging only.

Two exceptions: "What is knowledge?" stays whole (its one heading, "The tripartite
view", is most of it), and Meta-ethics' opening (the origins of moral principles,
cognitivism and non-cognitivism) is a topic of its own, 3.2.3. Every topic is
year 0: the bank has no AS papers to split by.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-philosophy")]
sys.path.insert(0, os.path.dirname(HERE))
import spec  # noqa: E402

URL = "https://filestore.aqa.org.uk/resources/philosophy/specifications/AQA-7172-SP-2017.PDF"
WHOLE = {"3.1.1"}
OWN_OPENING = {"3.2.3": "Cognitivism and non-cognitivism"}
TITLES = {"Berkeley's Idealism": "Berkeley's idealism", "The Problem of Evil": "The problem of evil",
          "Physicalism": "Philosophical behaviourism", "Issues": "Issues facing dualism",
          "What do we mean by ‘mind’?": "What do we mean by 'mind'?"}


def read(path):
    """[(kind, code, title, text)]: kind is "area" (19pt), "topic" (16pt, numbered) or "heading" (13pt)."""
    nodes, current, started = [], None, False
    for page in pymupdf.open(path):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                text = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                size = max(s["size"] for s in spans)
                if size >= 18 and (m := re.match(r"^(3\.\d)\s+(.+)$", text)):
                    started, current = True, None
                    nodes.append(["area", m.group(1), m.group(2), ""])
                elif started and size >= 18:
                    return nodes  # 4 Scheme of assessment
                elif started and size >= 15:
                    m = re.match(r"^(3\.\d\.\d)\s+(.+)$", text)
                    current = ["topic", m.group(1), m.group(2), ""] if m else None  # "Set texts": not content
                    if current:
                        nodes.append(current)
                elif started and size >= 12.5 and current:
                    current = ["heading", "", text, ""]
                    nodes.append(current)
                elif started and current and size > 9:
                    current[3] += " " + text
    return nodes


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", os.path.basename(URL)))
    sections, topics = [], []
    area = parent = None
    n = 0
    for kind, code, title, text in read(path):
        text = re.sub(r"\s*•\s*", " • ", text).strip(" •")
        if kind == "area":
            area = code
            sections.append({"code": code, "title": title})
        elif kind == "topic":
            parent, n = {"code": code, "title": title, "text": text}, 0
            topics.append({"code": code, "title": TITLES.get(title, title), "section": area, "year": 0, "text": text})
        elif parent["code"] in WHOLE:
            topics[-1]["text"] += f" {title}: {text}"
        else:
            if n == 0:  # the topic had a heading after all: its opening goes with each heading, or is a topic of its own
                topics.pop()
                if parent["code"] in OWN_OPENING:
                    topics.append({"code": parent["code"], "title": OWN_OPENING[parent["code"]], "section": area, "year": 0, "text": parent["text"]})
            n += 1
            opening = "" if parent["code"] in OWN_OPENING else parent["text"]
            topics.append({"code": f"{parent['code']}.{n}", "title": TITLES.get(title, title), "section": area, "year": 0,
                           "text": re.sub(r"\s+", " ", f"{parent['title']}: {opening} {title}: {text}").strip()})
    for t in topics:
        t["text"] = t["text"][:1500]
    json.dump({"7172": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"7172: {len(topics)} topics in {len(sections)} sections", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:9} {t['section']} {t['title']} ({len(t['text'])})", file=sys.stderr)


if __name__ == "__main__":
    main()
