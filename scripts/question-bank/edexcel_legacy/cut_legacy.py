"""Cut the legacy-only manifest with the existing Edexcel cutter (four workers).

Regional modules are legacy too, even though their component ID has a suffix.
"""
from concurrent.futures import ProcessPoolExecutor
import json
from pathlib import Path
import re
import sys

WORK = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import cut_edexcel as cutter  # noqa: E402

original_open = cutter.open_upright


def open_legacy(path):
    doc = original_open(path)
    for page in doc:
        # Pearson's 2010 PDFs put an unscaled A4 page in the centre of A3.
        # Crop the in-memory view; never rewrite the downloaded source PDF.
        box = page.rect
        if box.width > 800 and box.height > 1100:
            x, y = (box.width - 595) / 2, (box.height - 842) / 2
            page.set_cropbox(cutter.pymupdf.Rect(x, y, x + 595, y + 842))
    return doc


cutter.open_upright = open_legacy
original_marks = cutter.qp_marks


def legacy_marks(doc, labels):
    marks = original_marks(doc, labels)
    # Single-part legacy questions sometimes print only '(3)', with no Total.
    sums = {}
    for pg, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(span["text"] for span in line["spans"]).strip()
                match = re.fullmatch(r"\(\s*(\d{1,2})\s*\)", text)
                if not match or line["bbox"][0] < 430:
                    continue
                before = [q for p, y, q in labels if (p, y) < (pg, line["bbox"][1])]
                if before:
                    sums[before[-1]] = sums.get(before[-1], 0) + int(match[1])
    return {**sums, **marks}


cutter.qp_marks = legacy_marks


def main():
    manifest = json.loads((WORK / "manifest.json").read_text())
    sets = {}
    for record in manifest:
        sets.setdefault((record["component"], record["series"]), {})[record["kind"]] = record
    jobs = []
    for (component, series), files in sorted(sets.items()):
        if "qp" in files:
            meta = dict(component=component, spec=component.split("-")[0], series=series,
                        paperTitle=files["qp"].get("title", ""))
            jobs.append((f"{component}-{series}".lower(), files, meta, True))
    parts, audit = [], []
    with ProcessPoolExecutor(max_workers=4) as pool:
        for set_id, rows, error in pool.map(cutter.run_set, jobs):
            parts.extend(rows)
            result = dict(set=set_id, count=len(rows), error=error,
                          missingMarks=sum(p["marks"] is None for p in rows),
                          missingSchemes=sum(not p.get("ms") for p in rows))
            audit.append(result)
            print(result, flush=True)
    (WORK / "parts.json").write_text(json.dumps(parts, ensure_ascii=False))
    (WORK / "cut-audit.json").write_text(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
