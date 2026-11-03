"""Read AQA's A-Level Physical Education specification (7582) into the bank's topic tree.

    python3 scripts/question-bank/aqa_pe/spec_pe.py [work-dir]   # default scripts/question-bank/.work/aqa-pe

Writes <work-dir>/spec.json as {"7582": {"sections": [...], "topics": [...]}}, the shape the
Psychology bank uses. The sections are the specification's seven areas, three a paper:

  3.1.1 Applied anatomy and physiology, 3.1.2 Skill acquisition, 3.1.3 Sport and society (Paper 1)
  3.2.1 Exercise physiology, 3.2.2 Biomechanical movement, 3.2.3 Sport psychology,
  3.2.4 Sport and society and the role of technology (Paper 2)

and the topics their numbered headings ("3.1.1.2 Cardiovascular system"). Two headings are split
into the ones numbered under them, since the papers ask about each on its own: Sport psychology's
one heading (3.2.3.1, five pages) into its fourteen (3.2.3.1.1 Aspects of personality ...
3.2.3.1.14 Stress management), and the history of sport (3.1.3.1) into its three eras.
The body text under each heading is kept for tagging, never shown.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-pe")
# AQA's specification page links the PDF from its content store.
URL = "https://cdn.sanity.io/files/p28bar15/green/ac0993cafe5952fb8a486440e0ee643fd66c4b7d.pdf"
HEADING = re.compile(r"^(3\.[12](?:\.\d+){2,3})\s+(.+)$")
SECTIONS = [
    ("3.1.1", "Applied anatomy and physiology"),
    ("3.1.2", "Skill acquisition"),
    ("3.1.3", "Sport and society"),
    ("3.2.1", "Exercise physiology"),
    ("3.2.2", "Biomechanical movement"),
    ("3.2.3", "Sport psychology"),
    ("3.2.4", "Sport, society and technology"),
]
SPLIT = {"3.2.3.1", "3.1.3.1"}  # read as the headings numbered under them
TITLES = {
    "3.1.1.5": "Musculo-skeletal system and analysis of movement",
    "3.1.1.6": "Energy systems",
    "3.1.2.2": "Skill classification and the structure of practice",
    "3.1.3.1.1": "Pre-industrial sport (pre-1780)",
    "3.1.3.1.2": "Industrial and post-industrial sport (1780–1900)",
    "3.1.3.1.3": "Post World War II sport (1950 to present)",
    "3.1.3.2": "Impact of sport on society and society on sport",
    "3.2.1.1": "Diet and nutrition",
    "3.2.1.2": "Preparation and training methods",
    "3.2.1.3": "Injury prevention and rehabilitation",
    "3.2.4.7": "Commercialisation and the media",
    "3.2.4.8": "Technology in sport",
}


def read(path):
    doc = pymupdf.open(path)
    nodes, current = [], None
    for page in doc:
        text = page.get_text()
        if nodes and re.search(r"^4 Scheme of assessment", text, re.M):
            break  # past the subject content (the contents page lists the heading too, before any topic)
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                t = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                # A topic's heading is set large (13pt), a heading numbered under it bold at the body's size.
                head = spans[0]["size"] >= 12.5 or all("Bold" in s["font"] for s in spans)
                if (m := HEADING.match(t)) and head:
                    current = {"code": m.group(1), "title": m.group(2).rstrip(":").strip(), "text": "", "size": spans[0]["size"]}
                    nodes.append(current)
                elif current is not None and not current["text"] and current["size"] >= 12.5 and abs(spans[0]["size"] - current["size"]) < 0.5:
                    current["title"] += " " + t  # a heading wrapped onto a second line
                elif current is not None and t not in ("Content", "Additional information") and not re.match(r"^(\d+|Visit aqa\.org\.uk.*|AQA A-level Physical Education 7582.*)$", t):
                    current["text"] += " " + t
    return nodes


def main():
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, "AQA-7582-SP.pdf")
    if not os.path.exists(path):
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    nodes = read(path)
    topics = []
    for n in nodes:
        code, depth = n["code"], n["code"].count(".")
        parent = code.rsplit(".", 1)[0]
        if depth == 3 and code in SPLIT:
            continue
        if depth == 4 and parent not in SPLIT:
            # A numbered sub-heading of a topic kept whole ("3.1.2.5.1 General information processing model"): its text is the topic's.
            next(t for t in topics if t["code"] == parent)["text"] += f" {n['title']}: {n['text']}"
            continue
        topics.append({"code": code, "title": TITLES.get(code, n["title"]), "section": code[:5], "year": 0, "text": n["text"]})
    for t in topics:
        # The page footer, read into the text where a topic crosses a page.
        t["text"] = re.sub(r"\s*\d* Visit aqa\.org\.uk/7582 for the most up-to-date specification, resources, support and administration", " ", t["text"])
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()[:4000]
    out = {"7582": {"sections": [{"code": c, "title": t} for c, t in SECTIONS], "topics": topics}}
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"7582: {len(topics)} topics in {len(SECTIONS)} sections", file=sys.stderr)
    for t in topics:
        print(f"  {t['code']:10} {t['title']}  ({len(t['text'])} chars)", file=sys.stderr)


if __name__ == "__main__":
    main()
