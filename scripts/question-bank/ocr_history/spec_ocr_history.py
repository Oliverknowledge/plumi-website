"""Read OCR's A-Level History A specification (H505) into the bank's topic tree.

    python3 scripts/question-bank/ocr_history/spec_ocr_history.py [work-dir]   # default .work/ocr-history

Writes <work-dir>/spec.json in spec_ocr.py's shape, under H505. The specification gives each unit
(Y101-Y113, Y201-Y224, Y301-Y321) its pages: a table of bold key topics, left, with what learners
should have studied, right ("text", for tagging only). A Unit 1 unit has two tables, its enquiry
topic ("Enquiry Topic: Alfred the Great", the source question's) and its British period study; a
Unit 3 unit has its thematic study's key topics and then its three depth studies (the
interpretations question's). Each unit is a section, with the unit as its `option` so the bank's
"Unit" filter keeps a student's own; its topics are coded by unit and place, "Y101.1", with an
empty `ref` (the bank shows no code). `kind` is "enquiry", "period", "theme" or "depth".
"""
import json, os, re, sys, urllib.request

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-history"))
URL = "https://www.ocr.org.uk/Images/170128-specification-accredited-a-level-gce-history-a-h505.pdf"
UNIT = re.compile(r"^Unit (Y[123]\d\d): (.+)$")
BLOCK = re.compile(r"^(Enquiry Topic|British Period Study|Non-British Period Study|Thematic Study)\b|^(Key Topics?|Depth [Ss]tudies)$")
SKIP = re.compile(r"^(Content|Learners should|outlined for each|Key Topics$)")


def fetch():
    path = os.path.join(WORK, "spec", "h505.pdf")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
            f.write(r.read())
    return pymupdf.open(path)


def main():
    doc = fetch()
    units, topics, unit, kind, cur, last_bold = [], [], None, None, None, None
    for page in doc:
        text = page.get_text()
        if units and re.search(r"^2d\.", text, re.M):
            break  # the topic-based essay (NEA) follows the last unit
        rows = sorted(((l["bbox"][0], l["bbox"][1], "".join(s["text"] for s in l["spans"]).strip(), "Bold" in l["spans"][0]["font"])
                       for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) if l["spans"]), key=lambda r: (round(r[1]), r[0]))
        last_bold = None
        rows = [r for r in rows if r[2] and 70 < r[1] < page.rect.height - 50 and 30 < r[0] < page.rect.width - 40]
        for n, (x, y, t, bold) in enumerate(rows):
            m = UNIT.match(t)
            if m and bold:
                unit = m.group(1)
                units.append({"code": unit, "title": re.sub(r"\s+", " ", m.group(2)).strip()})
                kind, cur = None, None
                continue
            if bold and t.startswith("Introduction to unit group"):
                unit = None
            if not unit:
                continue
            if bold and x < 120:
                b = BLOCK.match(t)
                if b:
                    head = b.group(1) or b.group(2)
                    kind = {"Enquiry Topic": "enquiry", "British Period Study": "period", "Non-British Period Study": "period",
                            "Thematic Study": "theme"}.get(head, "depth" if head.lower().startswith("depth") else kind)
                    cur = None
                    continue
                # a page's running title over a continued table ("The Early Anglo-Saxons c.400–800", then "Depth studies")
                after = next((r for r in rows[n + 1:] if r[0] < 120 and r[3]), None)
                if after and BLOCK.match(after[2]) and y < 125:
                    continue
                if cur and (last_bold is not None and 0 < y - last_bold < 16 or re.fullmatch(r"(c\.)?\d{3,4}[–-]\d{3,4}", t)):
                    cur["title"] += " " + t  # a heading over two lines
                else:
                    cur = {"unit": unit, "kind": kind or ("theme" if unit[1] == "3" else "period"), "title": t, "text": ""}
                    topics.append(cur)
                last_bold = y
                continue
            if cur is not None and x > 200 and not (bold and SKIP.match(t)):
                cur["text"] = (cur["text"] + " " + t).strip()
    topics = [t for t in topics if t["text"]]
    out, n = {"sections": [], "topics": []}, {}
    for u in units:
        out["sections"].append({"code": u["code"], "title": u["title"], "option": u["code"]})
    for t in topics:
        n[t["unit"]] = n.get(t["unit"], 0) + 1
        out["topics"].append({"code": f"{t['unit']}.{n[t['unit']]}", "ref": "", "title": re.sub(r"\s+", " ", t["title"]).strip(),
                              "section": t["unit"], "kind": t["kind"], "text": re.sub(r"\s+", " ", t["text"]).strip()[:1500], "year": 0})
    json.dump({"H505": out}, open(os.path.join(WORK, "spec.json"), "w"), ensure_ascii=False, indent=1)
    print(f"{len(units)} units, {len(out['topics'])} topics", file=sys.stderr)
    for u in units:
        ts = [t for t in out["topics"] if t["section"] == u["code"]]
        print(f" {u['code']} {u['title']}: " + "; ".join(f"[{t['kind'][0]}] {t['title']}" for t in ts), file=sys.stderr)


if __name__ == "__main__":
    main()
