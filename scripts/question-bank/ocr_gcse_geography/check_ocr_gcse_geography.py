"""Check the cut J384 parts against each paper.

    python3 scripts/question-bank/ocr_gcse_geography/check_ocr_gcse_geography.py [work-dir]   # default scripts/question-bank/.work/ocr-gcse-geography

For each paper: the parts' marks (with SPaG) against "The total mark for this paper is 70" on its cover; every
part has a scheme crop; a part of 6 marks or more has levels in its scheme, and one of 8 or more its indicative
content too; a part that names a Resource Booklet figure has a stem showing it; a part that names the booklet
has a stem; a starred question with SPaG has the SPaG grid. Prints each problem; exits 1 if there are any.
"""
import json, os, re, sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "ocr-gcse-geography")


def own_label(ms):
    """The last label piece a scheme crop's text opens with: "Question Answer Mark Guidance 4 (a) (i) June" -> "i"."""
    m = re.match(r"(?:Question Answer Mark Guidance\s*)?\*?\d{0,2}\*?((?:\s*\([a-z]{1,4}\)\*?)+(?:\s+(?:i{1,3}|iv|vi{0,3})\b)?)", ms)
    return re.findall(r"[a-z]+", m.group(1))[-1] if m else None


def main():
    parts = json.load(open(os.path.join(WORK, "parts.json")))
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    qps = {f"{f['component'].replace('-', '')}-{f['series'].lower()}": f["file"] for f in manifest if f["kind"] == "qp"}
    problems, ids = [], {}
    for p in parts:
        ids[p["id"]] = ids.get(p["id"], 0) + 1
    for set_id, name in sorted(qps.items()):
        mine = [p for p in parts if p["set"] == set_id]
        cover = pymupdf.open(os.path.join(WORK, "pdf", name))[0].get_text()
        total = re.search(r"total mark for this paper is (\d+)", re.sub(r"\s+", " ", cover))
        got = sum((p["marks"] or 0) + p.get("spag", 0) for p in mine)
        if re.search(r"Choose one option", cover):
            print(f"{set_id}: {got} marks cut, with a choice of options; the paper says {total.group(1) if total else '?'}", file=sys.stderr)
        elif not total or int(total.group(1)) != got:
            problems.append(f"{set_id}: parts add up to {got}, the paper says {total.group(1) if total else '?'}")
        for p in mine:
            ms = p.get("msText", "")
            if not p["ms"]:
                problems.append(f"{p['id']}: no scheme crop")
            if p["marks"] and p["marks"] >= 6 and not re.search(r"Level \d", ms):
                problems.append(f"{p['id']}: {p['marks']} marks, no levels in its scheme")
            if p["marks"] and p["marks"] >= 8 and not re.search(r"[Ii]ndicative content|[Ee]xamples? of|may include|could include", ms + p.get("msTail", "")):
                problems.append(f"{p['id']}: {p['marks']} marks, no indicative content found in its scheme's first 800 characters")
            if p.get("spag") and not p.get("spagGrid"):
                problems.append(f"{p['id']}: SPaG, no SPaG grid")
            if re.search(r"Resource Booklet", p["text"]) and not p.get("stem"):
                problems.append(f"{p['id']}: names the Resource Booklet, no stem")
            opens = own_label(ms)
            own = (p["part"] or "")[1:] or (p["part"] or "")  # "aiii" -> "iii", "b" -> "b"
            hand = os.path.join(HERE, "..", "labels", f"{set_id}.json")
            aliased = os.path.exists(hand) and [int(p["question"]), p["part"][0] if p["part"] else None, p["part"][1:] or None] in [a[0] for a in json.load(open(hand)).get("ms_alias", [])]
            single = opens == "i" and len(p["part"] or "") <= 1  # "4 (a) (i)" printed for the paper's 4(a), as cut_ocr_gcse_geography.tables reads it
            if p["ms"] and opens and own and opens != own and not aliased and not single:
                problems.append(f"{p['id']}: its scheme crop opens with \"({opens})\": another part's row")
            if ids[p["id"]] > 1:
                problems.append(f"{p['id']}: id cut twice")
            if p["marks"] is None:
                problems.append(f"{p['id']}: no marks")
    for p in problems:
        print(p)
    print(f"{len(parts)} parts, {len(qps)} papers, {len(problems)} problems", file=sys.stderr)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
