"""Read AQA's GCSE Psychology specification (8182) into the bank's topic tree.

    python3 scripts/question-bank/aqa_gcse_psychology/spec_gcse_psychology.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-psychology

From the specification linked from AQA's 8182 page (AQA-8182-SP-2017, version 1.1). Writes
<work-dir>/spec.json under 8182, in the GCSE Business bank's shape. Sections are the eight
numbered areas (3.1.1 Memory … 3.2.4 Psychological problems), shown as the bank's tiles: Paper 1
takes 3.1.1-3.1.4, Paper 2 3.2.1-3.2.4, and research methods is examined in both. Topics are the
rows of each area's "Content" column ("Structures of memory", "Visual illusions"), numbered in
order under their area ("3.1.1.2"), with the "Additional information" beside them ("text") for
tagging only. 3.1.4.1 Data handling's rows stay under Research methods.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv[1:2] = [os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "aqa-gcse-psychology")]
sys.path.insert(0, os.path.dirname(HERE))
import pymupdf  # noqa: E402

import spec  # noqa: E402

URL = "https://cdn.sanity.io/files/p28bar15/green/a1264fbdd0f9ec6d8d1c4d2c0008d32e83fd3f8b.pdf"  # AQA-8182-SP-2017
AREA = re.compile(r"^(3\.[12]\.\d)\s+(.+)$")
COLUMN = 200  # the "Content" column's rows start at x 60, the "Additional information" beside them at 271
# Shorter names for the longest rows, for page titles and tiles.
SHORT = {
    "Processes of memory: encoding (input) storage and retrieval (output)": "Processes of memory",
    "Gibson's direct theory of perception: the influence of nature": "Gibson's direct theory of perception",
    "Gregory's constructivist theory of perception: the influence of nurture": "Gregory's constructivist theory of perception",
}


def rows(path):
    """[(area code, area title, [(Content row, its additional information)])], in order. The content tables rule
    off each row: a line belongs to the row between the rules above and below it (a row's additional information
    is a block of its own, read after the next row's title, and may run lower than that title starts). A row can
    hold two titles ("The possible relationship between language and thought", "The effect of language and
    thought on our view of the world"): each is a topic, with the row's information. A row carried over a page
    break (information with no title above it) is the last row's."""
    doc = pymupdf.open(path)
    areas = []
    for page in doc:
        rules = sorted({round(d["rect"].y0) for d in page.get_drawings() if d["rect"].height < 2 and d["rect"].width > 100})
        lines = []
        for b in page.get_text("dict")["blocks"]:
            for line in b.get("lines", []):
                spans = [s for s in line["spans"] if s["text"].strip()]
                if spans and spans[0]["size"] >= 10:  # not the page footer
                    t = re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()
                    lines.append((round(line["bbox"][1]), line["bbox"][0], t, spans[0]["size"], "Bold" in spans[0]["font"]))
        band, titles, last_y = None, None, None
        for y, x, t, size, bold in sorted(lines):
            if size >= 15:
                # An area's heading starts it; any other ("3.2 Social context and behaviour", "4 Scheme of assessment") ends it.
                m = AREA.match(t)
                areas.append((m.group(1), m.group(2), []) if m else (None, None, []))
                continue
            if not areas or areas[-1][0] is None or bold or size >= 12.5:
                continue  # "Content" / "Additional information" heads, "3.1.4.1 Data handling"
            rows_ = areas[-1][2]
            here = sum(1 for r in rules if r <= y + 2)
            if here != band:
                band, titles, last_y = here, None, None
            if x < COLUMN:
                # A title runs over lines no more than ~1.5 lines apart; a gap starts the next title in the row.
                if titles and y - last_y < 16:
                    titles[-1][0].append(t)
                else:
                    shared = titles[-1][1] if titles else []
                    titles = (titles or []) + [[[t], shared]]
                    rows_.append(titles[-1])
                last_y = y
            elif titles:
                titles[-1][1].append(t)
            elif rows_:
                rows_[-1][1].append(t)
    return [(code, title, [(" ".join(r[0]), " ".join(r[1])) for r in rs]) for code, title, rs in areas if code]


def main():
    os.makedirs(os.path.join(spec.WORK, "spec"), exist_ok=True)
    path = spec.fetch(URL, os.path.join(spec.WORK, "spec", "AQA-8182-SP-2017.pdf"))
    sections, topics = [], []
    for code, title, content in rows(path):
        sections.append({"code": code, "title": f"{code} {title}", "short": title})
        for n, (name, text) in enumerate(content, 1):
            name = re.sub(r"\s+([,.:])", r"\1", name).replace(" – ", ": ")  # no dash in a title students see
            topic = {"code": f"{code}.{n}", "ref": f"{code}.{n}", "title": name, "section": code, "text": text[:1500], "year": 0}
            if name in SHORT:
                topic["short"] = SHORT[name]
            topics.append(topic)
    json.dump({"8182": {"sections": sections, "topics": topics}}, open(os.path.join(spec.WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    for s in sections:
        print(s["title"], [t["title"] for t in topics if t["section"] == s["code"]], file=sys.stderr)
    empty = [t["code"] for t in topics if len(t["text"]) < 20]
    print(f"{len(sections)} areas, {len(topics)} topics" + (f"; little text for {empty}" if empty else ""), file=sys.stderr)


if __name__ == "__main__":
    main()
