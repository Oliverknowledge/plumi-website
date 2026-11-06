"""Cut Pearson Edexcel Statistics (9ST0 and AS 8ST0) papers into questions, each with its mark scheme rows.

    python3 scripts/question-bank/edexcel_statistics/cut_statistics.py <work-dir> [--only=9st0-01]

Reuses cut_edexcel.py (marks, mark schemes, examiner reports, rendering), with one change to where a question
ends. Maths papers keep their lined answer space for the end of a question, so cut_edexcel.py stops at the first
answer line. Statistics papers print answer lines after every part, so stopping there lost the later parts
(9ST0/01 November 2021 question 4 came out as part (a) only). Here a question runs to its
"(Total for Question N is M marks)" line, the answer lines are cut out of it, and the text on a
"Question N continued" page is kept, because there it is part of the question.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import cut_edexcel as ce  # noqa: E402  (reads its work dir from argv[1])

pymupdf, re = ce.pymupdf, ce.re
from PIL import Image  # noqa: E402
ce.TOTAL_NEW = re.compile(r"\(Total (?:Marks )?for Question (\d+) is (\d+)\s*marks?\)", re.I)  # a few print "10\xa0marks" or "Total Marks for"
PAPER_END = re.compile(r"\(TOTAL (?:FOR PAPER )?IS \d+ MARKS\)", re.I)


def qp_frame(page, legacy):
    """Statistics papers print up to x=563 (a wide table or chart), so the frame runs to 567, short of the "DO NOT WRITE
    IN THIS AREA" margin at 571. Three papers (9ST0/01 June 2023, 9ST0/02 November 2021, 9ST0/03 June 2023) are the
    same layout centred on a bigger page, so the frame moves with the padding."""
    dx, dy = (page.rect.width - 595.28) / 2, (page.rect.height - 841.89) / 2
    dx, dy = (dx if dx > 5 else 0), (dy if dy > 5 else 0)
    return pymupdf.Rect(36 + dx, 36 + dy, 567 + dx, page.rect.height - 50 - dy)


RUN_GAP = 30  # answer lines closer than this belong to one block of answer space


def without_answer_lines(page, rect):
    """`rect` minus its blocks of answer lines: the pieces of it that are question text."""
    ys = sorted((s["bbox"][1], s["bbox"][3]) for s in ce.spans(page)
                if ce.ANSWER_LINE.match(s["text"].strip()) and rect.y0 <= s["bbox"][1] <= rect.y1)
    runs = []
    for y0, y1 in ys:
        if runs and y0 - runs[-1][1] < RUN_GAP:
            runs[-1][1] = y1
        else:
            runs.append([y0, y1])
    pieces, y = [], rect.y0
    for r0, r1 in runs:
        if r0 - 1 - y > 8:
            pieces.append(pymupdf.Rect(rect.x0, y, rect.x1, r0 - 1))
        y = max(y, r1 + 3)
    if rect.y1 - y > 8:
        pieces.append(pymupdf.Rect(rect.x0, y, rect.x1, rect.y1))
    return pieces


def qp_regions(doc, legacy):
    labels = []  # (page, y, q)
    seen = set()
    for i, page in enumerate(doc):
        for s in ce.spans(page):
            m = ce.QP_LABEL.match(s["text"].strip())
            if m and "Bold" in s["font"] and s["bbox"][0] < 75 and s["size"] >= 10.5 and 30 < s["bbox"][1] < page.rect.height - 60:
                q = f"{int(m.group(1)):02d}"
                if q not in seen:
                    seen.add(q)
                    labels.append((i, s["bbox"][1], q))
    # A question number whose font prints a stray symbol instead of the digit (8ST0/02 June 2018's "7" is "൱"):
    # the next number, if the paper has a total for it, at the first bold single symbol in the margin after the last label.
    if labels:
        nxt_q = int(labels[-1][2]) + 1
        if any(re.search(rf"Total (?:Marks )?for Question {nxt_q} is", pg.get_text()) for pg in doc):
            for i in range(labels[-1][0], len(doc)):
                for sp in ce.spans(doc[i]):
                    t = sp["text"].strip()
                    if (len(t) == 1 and not (t.isascii() and t.isalnum()) and "Bold" in sp["font"] and sp["bbox"][0] < 75 and sp["size"] >= 10.5
                            and 30 < sp["bbox"][1] < 200 and (i, sp["bbox"][1]) > (labels[-1][0], labels[-1][1])):
                        labels.append((i, sp["bbox"][1], f"{nxt_q:02d}"))
                        break
                else:
                    continue
                break
    out = []
    for n, (pg0, y0, q) in enumerate(labels):
        nxt = labels[n + 1] if n + 1 < len(labels) else None
        pieces, pg, top = [], pg0, ce.label_top(doc[pg0], y0, ce.qp_frame(doc[pg0], legacy))
        while pg < len(doc):
            page = doc[pg]
            f = ce.qp_frame(page, legacy)
            stops = [s["bbox"][1] for s in ce.spans(page) if s["bbox"][1] > top + 10 and (ce.TOTAL_NEW.search(s["text"]) or ce.TOTAL_OLD.search(s["text"]) or PAPER_END.search(s["text"]))]
            if nxt and nxt[0] == pg:
                stops.append(ce.label_top(page, nxt[1], f) + 4)
            end = min(stops) - 4 if stops else f.y1
            if end > top + 8:
                for r in without_answer_lines(page, pymupdf.Rect(f.x0, max(top, f.y0), f.x1, end)):
                    pieces.append((pg, r))
            if stops:
                break
            pg += 1
            if pg >= len(doc) or (nxt and pg > nxt[0]):
                break
            top = ce.qp_frame(doc[pg], legacy).y0
            # A "Question N continued" heading is skipped; the text under it goes on with the question.
            head = next((s for s in ce.spans(doc[pg]) if s["bbox"][1] < 120 and ce.CONTINUED.match(s["text"].strip())), None)
            if head:
                top = head["bbox"][3] + 2
        text = "\n".join(doc[p].get_text("text", clip=r) for p, r in pieces)
        out.append((q, pieces, text))
    return out


BLANK_RUN, KEEP_RUN = 110, 50  # px at cut.SCALE: a blank stretch longer than this (unlined answer space) is cut down to KEEP_RUN
_trim_bottom = ce.cut.trim_bottom


def trim_bottom(img, keep=36):
    """cut.trim_bottom, and for a question's own crop (keep=36; a scheme's is 12) also squeeze blank answer space."""
    img = _trim_bottom(img, keep)
    if img is None or keep != 36:
        return img
    w, h = img.size
    gray = img.convert("L")
    ink = bytes(1 if v <= 235 else 0 for v in range(256))
    cols = gray.transpose(Image.Transpose.ROTATE_90).tobytes()  # column x, bottom to top, is cols[(w - 1 - x) * h:(w - x) * h]
    for x in range(w):  # the page frame's edge runs the whole height: it is not content
        if cols[(w - 1 - x) * h:(w - x) * h].translate(ink).count(1) > 0.6 * h and h > 400:
            gray.paste(255, (x, 0, x + 1, h))
    data = gray.tobytes()
    blank = [min(data[y * w + 10:(y + 1) * w - 10]) > 235 for y in range(h)]
    if all(blank):
        return None  # only the page frame's edge: blank answer space
    keep_rows, y = [], 0  # source rows to keep, as (start, end)
    while y < h:
        end = y
        while end < h and blank[end] == blank[y]:
            end += 1
        if blank[y] and end - y > BLANK_RUN:
            end_keep = y + KEEP_RUN
        else:
            end_keep = end
        keep_rows.append((y, end_keep))
        y = end
    if sum(b - a for a, b in keep_rows) == h:
        return img
    out = Image.new("RGB", (w, sum(b - a for a, b in keep_rows)), (255, 255, 255))
    at = 0
    for a, b in keep_rows:
        out.paste(img.crop((0, a, w, b)), (0, at))
        at += b - a
    return out


ce.cut.trim_bottom = trim_bottom
ce.qp_frame = qp_frame
ce.qp_regions = qp_regions  # also applied in the worker processes, which import this module again

if __name__ == "__main__":
    ce.main()
