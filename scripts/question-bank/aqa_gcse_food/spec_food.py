"""Read AQA's GCSE Food Preparation and Nutrition specification (8585) into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_food/spec_food.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-food

Writes <work-dir>/spec.json as {"8585": {"sections": [...], "topics": [...]}}, the shape the PE
bank uses. The sections are the specification's five areas of content:

  3.2 Food, nutrition and health, 3.3 Food science, 3.4 Food safety, 3.5 Food choice, 3.6 Food provenance

and the topics their numbered headings ("3.2.1.1 Protein"); British and international cuisines
(3.5.2) and Sensory evaluation (3.5.3) have no headings under them and are topics themselves.
The food preparation skills (3.1) and techniques (3.7) run through the whole specification and
are left out as topics, as the brief asked. The body text under each heading is kept for tagging,
never shown.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-food")
# AQA's specification page links the PDF (AQA-8585-SP-2016.PDF) from its content store.
URL = "https://cdn.sanity.io/files/p28bar15/green/a4c15e7bbb429c2ed8b5964d97f01ad22cdb61a3.pdf"
HEADING = re.compile(r"^(3\.[2-7](?:\.\d+){0,2})\s+(.+)$")
SECTIONS = [
    ("3.2", "Food, nutrition and health"),
    ("3.3", "Food science"),
    ("3.4", "Food safety"),
    ("3.5", "Food choice"),
    ("3.6", "Food provenance"),
]
# Two areas each have a "Carbohydrates" and a "Protein(s)": the food science ones are named for what they're about.
TITLES = {
    "3.2.3.1": "Making informed choices for a varied and balanced diet",
    "3.3.1.1": "Why food is cooked and how heat is transferred",
    "3.3.2.1": "Functional and chemical properties of proteins",
    "3.3.2.2": "Functional and chemical properties of carbohydrates",
    "3.3.2.3": "Functional and chemical properties of fats and oils",
    "3.3.2.4": "Functional and chemical properties of fruit and vegetables",
    "3.6.1.1": "Food sources",
    "3.6.2.2": "Technological developments for better health and food production",
}
SHORT = {"3.3.2.1": "Proteins in cooking", "3.3.2.2": "Carbohydrates in cooking", "3.3.2.3": "Fats and oils in cooking",
         "3.3.2.4": "Fruit and vegetables in cooking", "3.6.2.2": "Technological developments"}


def read(path):
    """Numbered headings from 3.2 to 3.7, each with the text under it: [{code, title, text}]."""
    nodes, current = [], None
    for page in pymupdf.open(path):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                t = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                # Headings are set at 13pt (topics), 16pt (their groups) and 19pt (the areas); the body at 11pt.
                if (m := HEADING.match(t)) and spans[0]["size"] >= 12.5:
                    if m.group(1) == "3.7":
                        return nodes
                    current = {"code": m.group(1), "title": m.group(2).strip(), "text": ""}
                    nodes.append(current)
                elif current is not None and spans[0]["size"] < 12 and not re.match(r"^(\d+|.*Visit aqa\.org\.uk.*|AQA GCSE Food Preparation and Nutrition 8585.*)$", t):
                    current["text"] += " " + t
    return nodes


def main():
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, "AQA-8585-SP.pdf")
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    nodes = read(path)
    codes = {n["code"] for n in nodes}
    topics = []
    for n in nodes:
        code, depth = n["code"], n["code"].count(".")
        # A topic is a 3.x.y.z heading, or a 3.x.y one with none under it.
        if depth == 3 or (depth == 2 and not any(c.startswith(code + ".") for c in codes)):
            topics.append({"code": code, "title": TITLES.get(code, n["title"]), **({"short": SHORT[code]} if code in SHORT else {}),
                           "section": code[:3], "year": 0, "text": re.sub(r"\s+", " ", n["text"]).strip()[:4000]})
    out = {"8585": {"sections": [{"code": c, "title": t} for c, t in SECTIONS], "topics": topics}}
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"8585: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:9} {t['title']}  ({len(t['text'])} chars)", file=sys.stderr)


if __name__ == "__main__":
    main()
