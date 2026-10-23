"""Read AQA's A-Level Biology, Chemistry and Physics specifications into a topic tree.

    python3 scripts/question-bank/spec.py [work-dir]

Downloads the three specification PDFs from AQA and writes <work-dir>/spec.json:
{ "7405": [{ "code": "3.1.2", "title": "Amount of substance", "level": 2, "text": "..." }, ...] }
Level 1 is a section (3.1 Physical chemistry), 2 a topic, 3 a sub-topic. The body
text under each heading is kept for tagging questions, never shown.
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, ".work")
SPECS = {
    "biology": "https://filestore.aqa.org.uk/resources/biology/specifications/AQA-7401-7402-SP-2015.PDF",
    "chemistry": "https://filestore.aqa.org.uk/resources/chemistry/specifications/AQA-7404-7405-SP-2015.PDF",
    "physics": "https://filestore.aqa.org.uk/resources/physics/specifications/AQA-7407-7408-SP-2015.PDF",
}
HEADING = re.compile(r"^(3(?:\.\d+){1,3})\s+(.+)$")
LEVEL_BY_SIZE = [(18, 1), (15, 2), (12.5, 3)]


def fetch(url, path):
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def read(path):
    doc = pymupdf.open(path)
    nodes, current = [], None
    started = False
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                text = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                size = max(s["size"] for s in spans)
                m = HEADING.match(text)
                level = next((lv for floor, lv in LEVEL_BY_SIZE if size >= floor), None)
                if m and level and m.group(1).count(".") == level:
                    started = True
                    current = {"code": m.group(1), "title": m.group(2).strip(), "level": level, "text": "", "size": size}
                    if not any(n["code"] == current["code"] for n in nodes):
                        nodes.append(current)
                    continue
                if current is not None and not current["text"] and level and abs(size - current["size"]) < 0.5 and not HEADING.match(text):
                    current["title"] += " " + text  # a heading that wraps onto a second line
                    continue
                if started and current is not None and size < 12 and len(current["text"]) < 4000:
                    current["text"] += " " + text
        if started and re.search(r"^4 Scheme of assessment|^4\.1 ", page.get_text(), re.M) and nodes and nodes[-1]["code"].startswith("3"):
            # Past the subject content: stop before the assessment section's numbering.
            if "Scheme of assessment" in page.get_text()[:400]:
                break
    for n in nodes:
        n["text"] = n["text"].strip()
        n.pop("size", None)
        # "(A-level only)" marks second-year content: keep the fact, drop it from the title.
        n["alevelOnly"] = bool(re.search(r"\(A-\s?level only\)", n["title"]))
        n["title"] = re.sub(r"\s*\((?:A-\s?level only|AS and A-level)\)\s*$", "", n["title"]).strip()
    return nodes


def main():
    os.makedirs(WORK, exist_ok=True)
    out = {}
    for subject, url in SPECS.items():
        nodes = read(fetch(url, os.path.join(WORK, os.path.basename(url))))
        for spec in {"biology": ("7401", "7402"), "chemistry": ("7404", "7405"), "physics": ("7407", "7408")}[subject]:
            out[spec] = nodes
        print(f"{subject}: {len(nodes)} headings, {sum(1 for n in nodes if n['level'] == 3)} sub-topics", file=sys.stderr)
    json.dump(out, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
