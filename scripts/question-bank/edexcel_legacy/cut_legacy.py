"""Cut the legacy-only manifest with the existing Edexcel cutter (four workers).

Regional modules are legacy too, even though their component ID has a suffix.
"""
from concurrent.futures import ProcessPoolExecutor
import json
from pathlib import Path
import re
import sys
from labels import MS_LABEL

WORK = Path(sys.argv[1]).resolve()
OPTIONS = sys.argv[2:]
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import cut_edexcel as cutter  # noqa: E402
cutter.MS_LABEL = MS_LABEL

original_open = cutter.open_upright


def open_legacy(path):
    alternate = WORK / "ocr-pdf" / Path(path).name
    if alternate.exists():
        path = str(alternate)
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
    sums, totals = {}, {}
    for pg, page in enumerate(doc):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(span["text"] for span in line["spans"]).strip()
                before = [q for p, y, q in labels if (p, y) < (pg, line["bbox"][1])]
                total = re.search(r"Total\s+(\d{1,2})\s+marks", text, re.I)
                if total and before:
                    totals[before[-1]] = int(total[1])
                match = re.fullmatch(r"\(\s*(\d{1,2})\s*\)", text)
                if not match or line["bbox"][0] < 430:
                    continue
                if before:
                    sums[before[-1]] = sums.get(before[-1], 0) + int(match[1])
    return {**sums, **marks, **totals}


cutter.qp_marks = legacy_marks
original_spans = cutter.spans


def legacy_spans(page):
    flags = cutter.pymupdf.TEXTFLAGS_DICT & ~cutter.pymupdf.TEXT_PRESERVE_IMAGES
    for block in page.get_text("dict", flags=flags)["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                if not span["text"].strip():
                    continue
                if span["font"] == "GlyphLessFont" and cutter.QP_LABEL.match(span["text"].strip()) and span["bbox"][0] < 75:
                    span = dict(span, font="LegacyOCR-Bold", size=max(11, span["size"]))
                yield span


cutter.spans = legacy_spans
original_top = cutter.label_top


def legacy_top(page, y, frame):
    top = original_top(page, y, frame)
    spans = list(legacy_spans(page))
    line = [s["bbox"] for s in spans if s["bbox"][1] <= y + 18 and s["bbox"][3] >= y - 2]
    for span in spans:
        box, text = span["bbox"], span["text"].strip()
        mathematical = (bool(re.search(r"[\d∫√Σ]", text)) or "Symbol" in span["font"])
        mark = re.fullmatch(r"\(\s*\d+\s*\)", text)
        if (y - 35 < box[1] < y - 5 and box[3] > y - 28 and frame.x0 <= box[0] <= frame.x1
                and len(text) < 24 and mathematical and not mark
                and any(box[0] < anchor[2] + 12 and box[2] > anchor[0] - 12 for anchor in line)):
            top = min(top, box[1] - 6)
    return max(frame.y0 - 4, top)


cutter.label_top = legacy_top
original_regions = cutter.qp_regions


def legacy_regions(doc, legacy):
    regions = original_regions(doc, legacy)
    if "ocr-pdf" not in str(doc.name):
        # These papers align the final part's marks with the Total line. The
        # normal stop above Total clipped the bottom of the printed marks.
        repairs = {"EDX-6666-QP-JUN14.pdf": "06", "EDX-6666-QP-JUN15.pdf": "06", "EDX-6677-QP-JUN18.pdf": "02"}
        repaired = []
        for question, pieces, text in regions:
            if question == repairs.get(Path(doc.name).name) and pieces:
                pg, rect = pieces[-1]
                near = [s["bbox"][3] for s in legacy_spans(doc[pg]) if rect.y1 - 10 <= s["bbox"][1] <= rect.y1 + 12]
                end = max([rect.y1] + near) + 8
                pieces[-1] = (pg, cutter.pymupdf.Rect(rect.x0, rect.y0, rect.x1, min(end, doc[pg].rect.height - 40)))
                text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
            repaired.append((question, pieces, text))
        return repaired
    out = []
    for question, pieces, text in regions:
        bounded = []
        for pg, rect in pieces:
            # OCR does not retain underscore text. Detect the first answer rule
            # in pixels, matching the native cutter's stop at printed underscores.
            pix = doc[pg].get_pixmap(matrix=cutter.pymupdf.Matrix(1, 1), clip=rect,
                                    colorspace=cutter.pymupdf.csGRAY, alpha=False)
            samples = pix.samples
            candidates = []
            for y in range(30, pix.height):
                row = samples[y * pix.stride:y * pix.stride + pix.width]
                if sum(value < 245 for value in row) > pix.width * .78 and sum(value < 150 for value in row) < pix.width * .4:
                    if not candidates or y - candidates[-1] > 3:
                        candidates.append(y)
            edge = next((y for i, y in enumerate(candidates[:-2])
                         if 8 < candidates[i + 1] - y < 35 and 8 < candidates[i + 2] - candidates[i + 1] < 35), None)
            bounded.append((pg, cutter.pymupdf.Rect(rect.x0, rect.y0, rect.x1,
                           rect.y0 + edge - 3 if edge is not None else rect.y1)))
            if edge is not None:
                break
        pieces = bounded
        text = "\n".join(doc[pg].get_text("text", clip=rect) for pg, rect in pieces)
        out.append((question, pieces, text))
    return out


cutter.qp_regions = legacy_regions


def main():
    manifest = json.loads((WORK / "manifest.json").read_text())
    sets = {}
    for record in manifest:
        sets.setdefault((record["component"], record["series"]), {})[record["kind"]] = record
    jobs = []
    only = next((a.split("=", 1)[1] for a in OPTIONS if a.startswith("--only=")), None)
    for (component, series), files in sorted(sets.items()):
        if "qp" in files:
            if only and f"{component}-{series}".lower() != only:
                continue
            if "--ocr" in OPTIONS:
                source = original_open(str(WORK / "pdf" / files["qp"]["file"]))
                target = cutter.pymupdf.open()
                for page in source:
                    body = page.get_pixmap(dpi=180).pdfocr_tobytes(language="eng", tessdata="/usr/share/tesseract-ocr/5/tessdata")
                    target.insert_pdf(cutter.pymupdf.open("pdf", body))
                folder = WORK / "ocr-pdf"
                folder.mkdir(exist_ok=True)
                target.save(str(folder / files["qp"]["file"]))
            meta = dict(component=component, spec=component.split("-")[0], series=series,
                        paperTitle=files["qp"].get("title", ""))
            jobs.append((f"{component}-{series}".lower(), files, meta, True))
    parts = [p for p in json.loads((WORK / "parts.json").read_text()) if p["set"] != only] if only else []
    audit = [a for a in json.loads((WORK / "cut-audit.json").read_text()) if a["set"] != only] if only else []
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
