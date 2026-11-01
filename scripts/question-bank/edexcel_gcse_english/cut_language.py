"""Cut Pearson Edexcel's GCSE English Language (1EN0) papers into questions, each with its mark scheme and report.

    python3 scripts/question-bank/edexcel_gcse_english/cut_language.py [work-dir] [--only=1en002-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-english-lang

edexcel_sciences/cut_pearson.py does the work, with --extracts (a long answer is cropped to its question, not its pages
of answer lines; the other essay choice starts at its "OR"): Pearson sets these papers and schemes as it does its
sciences, a question per label down the left and the scheme a table row per question, "Question Number". What is
done here, so no other bank's crops move:
  - The sources are printed in a booklet bound into the question paper (fetch_english.py splits it out as the
    paper's insert, which each reading question links to). It is cut out of the copy the cutter reads, so its
    line numbers aren't taken for questions: .work/.../cut/1en0-01-qp-jun24.pdf.
  - Paper 1 is four questions on one fiction extract and a choice of two imaginative writing tasks (5 or 6);
    Paper 2 is seven on two non-fiction texts (7 in two parts, (a) and (b)) and a choice of two transactional
    writing tasks (8 or 9). Ids are cut_pearson's, "1en001-jun24-03", "1en002-jun24-07-a".
  - A levels grid's level numbers aren't read as labels (grids.py), so a scheme keeps its levels.
  - Paper 1's picture task ("Look at the images provided") has its two images on a page of their own, after
    the tasks: that page goes under the question's crop.
  - The two writing tasks share the "Writing assessment grids" (AO5 and AO6) printed after the second, so the
    first (Paper 1's 5, Paper 2's 8) is given them too: every Section B row without a grid of its own.
November 2019's Paper 1 is set in outlines, with no text to read: cut_pearson reads it by OCR, as its scans.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse-english-lang")
sys.argv[1:] = [WORK, "--extracts"] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
sys.path.insert(0, HERE)
import cut_pearson as cp  # noqa: E402
import grids  # noqa: E402

grids.patch(cp)

CUT = os.path.join(WORK, "cut")
_run_set, _ms_tables = cp.run_set, cp.ms_tables


def ms_tables(doc):
    out = _ms_tables(doc)
    at = lambda pattern: next(((i, l["y0"]) for i in range(len(doc)) for l in doc.lines(i) if re.match(pattern, l["text"], re.I)), None)  # noqa: E731
    section_b, head = at(r"Section B\b"), at(r"Writing assessment grids")
    if not (section_b and head):
        return out
    shared = next(([(p, r) for p, r in pieces if (p, r.y1) > head] for pieces, _, _ in out.values() if any((p, r.y1) > head for p, r in pieces)), [])
    shared = [(p, cp.pymupdf.Rect(r.x0, max(r.y0, head[1] - 4) if p == head[0] else r.y0, r.x1, r.y1)) for p, r in shared]
    for key, (pieces, text, ans) in out.items():
        if pieces and section_b < (pieces[0][0], pieces[0][1].y0) < head and not grids.GRID_ROW.search(text):
            out[key] = (pieces + shared, text + " " + " ".join(doc.text(p, r) for p, r in shared), ans)
    return out


cp.ms_tables = ms_tables
_cut_set = cp.cut_set


def cut_set(qp_path, ms_path, er_path, set_id, meta):
    parts = _cut_set(qp_path, ms_path, er_path, set_id, meta)
    pictures = [p for p in parts if p["qp"] and re.search(r"Look at the images", p["text"])]
    if not pictures:
        return parts
    doc = cp.Doc(qp_path)
    # The page after the tasks' that has pictures of its own: captioned "Image 1" and "Image 2", or not at all.
    tasks = next((i for i in range(len(doc)) if any(l["text"] == "EITHER" for l in doc.lines(i))), None)
    page = next((i for i in range(tasks + 1, min(tasks + 3, len(doc))) if any(re.fullmatch(r"Image 1", l["text"]) for l in doc.lines(i))
                 or len(doc[i].get_images()) > len(doc[tasks].get_images())), None) if tasks is not None else None
    if page is None:
        print(f"{set_id}: no page of images", file=sys.stderr)
        return parts
    images = cp.trim(doc.crop(page, doc.frame(page)), sides=True)
    from PIL import Image  # noqa: PLC0415

    for p in pictures:
        img = cp.stack([Image.open(os.path.join(cp.IMG, p["qp"])).convert("RGB"), images])
        cp.save(img, p["qp"])
        p["w"], p["h"] = img.width, img.height
    return parts


cp.cut_set = cut_set


def run_set(job):
    set_id, files, meta = job
    if "qp" in files and os.path.exists(os.path.join(CUT, files["qp"]["file"])):
        files = {**files, "qp": {**files["qp"], "file": os.path.join("..", "cut", files["qp"]["file"])}}
    return _run_set((set_id, files, meta))


cp.run_set = run_set


def without_booklets():
    """A copy of each question paper without its source booklet (the insert's `pages`, 1-based)."""
    import pymupdf  # noqa: PLC0415

    os.makedirs(CUT, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    qps = {(f["component"], f["series"]): f for f in manifest if f["kind"] == "qp"}
    for f in manifest:
        if f["kind"] != "ins" or (f["component"], f["series"]) not in qps:
            continue
        qp = qps[(f["component"], f["series"])]
        out = os.path.join(CUT, qp["file"])
        if os.path.exists(out):
            continue
        first, last = (int(x) for x in f["pages"].split("-"))
        doc = pymupdf.open(os.path.join(WORK, "pdf", qp["file"]))
        doc.select([i for i in range(len(doc)) if not first - 1 <= i < last])
        doc.save(out, garbage=3, deflate=True)


if __name__ == "__main__":
    without_booklets()
    cp.main()
