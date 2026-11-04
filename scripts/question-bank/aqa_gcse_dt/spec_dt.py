"""Read AQA's GCSE Design and Technology specification (8552) into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_dt/spec_dt.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-dt

Writes <work-dir>/spec.json as {"8552": {"sections": [...], "topics": [...]}}, the shape the PE
and Food banks use. The sections are the three the paper's Sections A, B and C are set on:

  3.1 Core technical principles, 3.2 Specialist technical principles, 3.3 Designing and making principles

and the topics their numbered headings ("3.2.7 Scales of production"), with 3.1.6 Materials and their
working properties split into its two ("3.1.6.1 Material categories"). The body text under each
heading is kept for tagging, never shown.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-dt")
# AQA's specification page links the PDF (AQA-8552-SP-2017.PDF) from its content store.
URL = "https://cdn.sanity.io/files/p28bar15/green/db64d96d05315e9adcaff43690b58b17be11b5e3.pdf"
HEADING = re.compile(r"^(3\.[1-3](?:\.\d+){0,2})\s+(.+)$")
SECTIONS = [
    ("3.1", "Core technical principles"),
    ("3.2", "Specialist technical principles"),
    ("3.3", "Designing and making principles"),
]
# Sections B and C each have a "Selection of materials" and a "Specialist techniques and processes": short names say which.
TITLES = {}
SHORT = {"3.2.1": "Factors in choosing materials", "3.2.8": "Shaping, forming and fabricating materials",
         "3.3.7": "Materials for a prototype", "3.3.11": "Techniques for making a prototype"}


def read(path):
    """Numbered headings under 3.1 to 3.3, each with the text under it: [{code, title, text}]."""
    nodes, current = [], None
    for page in pymupdf.open(path):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                t = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                # Headings are set at 13pt (the two material topics), 16pt (topics) and 19pt (the sections); the body at 11pt.
                if nodes and re.match(r"^4 Scheme of assessment", t) and spans[0]["size"] >= 12.5:
                    return nodes
                if (m := HEADING.match(t)) and spans[0]["size"] >= 12.5:
                    current = {"code": m.group(1), "title": m.group(2).strip(), "text": ""}
                    nodes.append(current)
                elif current is not None and spans[0]["size"] < 12 and not re.match(r"^(\d+|.*Visit aqa\.org\.uk.*|AQA GCSE Design and Technology 8552.*)$", t):
                    current["text"] += " " + t
    return nodes


def main():
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, "AQA-8552-SP.pdf")
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    nodes = read(path)
    codes = {n["code"] for n in nodes}
    topics = []
    for n in nodes:
        code, depth = n["code"], n["code"].count(".")
        # A topic is a 3.x.y heading with none under it, or one of those under it.
        if depth == 3 or (depth == 2 and not any(c.startswith(code + ".") for c in codes)):
            topics.append({"code": code, "title": TITLES.get(code, n["title"]), **({"short": SHORT[code]} if code in SHORT else {}),
                           "section": code[:3], "year": 0, "text": re.sub(r"\s+", " ", n["text"]).strip()[:4000]})
    out = {"8552": {"sections": [{"code": c, "title": t} for c, t in SECTIONS], "topics": topics}}
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"8552: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:9} {t['title']}  ({len(t['text'])} chars)", file=sys.stderr)


if __name__ == "__main__":
    main()
