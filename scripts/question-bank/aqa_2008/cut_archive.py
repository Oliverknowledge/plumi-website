"""Cut the approved pre-2009 written papers, preserving inherited part labels.

    python3 scripts/question-bank/aqa_2008/cut_archive.py [work-dir]

Uses the Physics legacy cutter's rendering, frames, safe text boundaries and
whole-question scheme reader. Old papers often omit the question number on
sub-parts and award marks jointly to several prompts; keep those prompts
together. PA04's objective and written sections become separate papers.
"""
import importlib.util
from concurrent.futures import ProcessPoolExecutor
import json
from pathlib import Path
import re
import shutil
import sys
from PIL import ImageDraw

HERE = Path(__file__).resolve().parent
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = Path(ARGS[0]).resolve() if ARGS else HERE.parent / ".work/archive-2008"
ONLY = next((a.split("=", 1)[1].lower() for a in sys.argv[1:] if a.startswith("--only=")), None)
sys.argv = [sys.argv[0], str(WORK)]
spec = importlib.util.spec_from_file_location("physics_legacy", HERE.parent / "aqa_physics_legacy/cut_legacy.py")
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)
fitz, cut = legacy.pymupdf, legacy.cut
ROMAN = legacy.ROMAN
MARKS = legacy.MARKS
END = re.compile(r"END\s+OF\s+QUESTIONS")


def table_schemes(doc, questions):
    """Read the ruled 2009 Chemistry tables with the existing Chemistry reader.

    Only whole-question boundaries are used; no answer is split at a centred
    part label. A missing question retains the whole-scheme link fallback.
    """
    spec = importlib.util.spec_from_file_location("chemistry_legacy", HERE.parent / "aqa_chem_legacy/cut_legacy.py")
    chemistry = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(chemistry)
    wanted = {(q, None, None) for q in questions}
    starts = {}
    for pg, y, key in chemistry.ms_labels(doc, wanted):
        starts.setdefault(key[0], (pg, chemistry.row_top(doc[pg], y)))
    ordered = sorted(starts.items())
    out = {}
    for n, (q, (pg, top)) in enumerate(ordered):
        end_pg, end_y = ordered[n + 1][1] if n + 1 < len(ordered) else (len(doc) - 1, float("inf"))
        pieces = []
        for i in range(pg, end_pg + 1):
            frame = cut.ms_frame(doc[i])
            rect = fitz.Rect(frame.x0, top if i == pg else frame.y0, frame.x1,
                            min(end_y, frame.y1) if i == end_pg else frame.y1)
            if rect.height > 8 and doc[i].get_text("text", clip=rect).strip():
                pieces.append((i, rect))
        out[(q, None, None)] = (pieces, "\n".join(doc[i].get_text("text", clip=r) for i, r in pieces))
    return out


def render_piece(page, rect):
    image = cut.render(page, rect)
    # The previous award can sit above the label at the far right. Its glyph
    # box intersects this crop although its text belongs to the previous item.
    # Remove that small overlap without clipping the new label on the left.
    draw = ImageDraw.Draw(image)
    for x0, y0, x1, y1, text, *_ in legacy.lines_of(page):
        if MARKS.fullmatch(text) and y0 < rect.y0 < y1:
            box = [(x0 - rect.x0) * cut.SCALE - 2, 0,
                   (x1 - rect.x0) * cut.SCALE + 2, (y1 - rect.y0) * cut.SCALE + 2]
            draw.rectangle(box, fill="white")
    return image


def meaningful(text):
    text = re.sub(r"Areas outside\s+the box will\s+not be scanned\s+for marking|LEAVE\s+MARGIN\s+BLANK|Turn over[^\n]*|(?:APW|M|G|WMP)/[^\s]+", "", text)
    return bool(re.search(r"[A-Za-z]{3,}", text))


def data_sheet(text):
    return ("Hydrogen" in text and "Helium" in text and "Lawrencium" in text
            or "Proton n.m.r" in text and re.search(r"[Ww]avenumber", text))


def labels(doc, mcq=False):
    found, prev = [], None
    for pg, page in enumerate(doc):
        text = page.get_text()
        if pg == 0 or legacy.SKIP.search(text) or data_sheet(text):
            continue
        for y, row in legacy.rows_of(page, max_x=180):
            x, first, bold = row[0]
            if x > (90 if mcq else 115):
                continue
            joined = " ".join(t for _, t, _ in row)
            full = re.match(r"^(\d{1,2})(?:\s*\(([a-h])\))?(?:\s*\(([ivx]+)\))?(?=\s|$)", joined)
            inherited = re.match(r"^\(([a-h]|[ivx]+)\)(?:\s*\(([ivx]+)\))?(?=\s|$)", joined)
            key = None
            if full and x < (90 if mcq else 76) and (bold or full.group(2) or mcq):
                key = (int(full.group(1)), full.group(2), full.group(3))
            elif not mcq and inherited and prev:
                token, roman = inherited.groups()
                if token in ROMAN:
                    if prev[1]:
                        key = (prev[0], prev[1], token)
                else:
                    key = (prev[0], token, roman)
            if key and (not prev and key[0] == 1 or prev and legacy.ok_next(prev, key)):
                found.append((pg, y, key))
                prev = key
    return found


def regions(doc, mcq=False):
    marks = labels(doc, mcq)
    out = []
    for n, (pg, y, key) in enumerate(marks):
        nxt = marks[n + 1] if n + 1 < len(marks) else None
        pieces = []
        for i in range(pg, (nxt[0] if nxt else len(doc) - 1) + 1):
            page = doc[i]
            if legacy.SKIP.search(page.get_text()):
                break
            if data_sheet(page.get_text()):
                continue
            frame = legacy.qp_frame(page)
            # Old 'LEAVE MARGIN BLANK' papers have no modern answer frame.
            top = legacy.clear_cut(page, y - 6, y + 1) if i == pg else frame.y0
            end = legacy.clear_cut(page, nxt[1] - 6, nxt[1] + 1) if nxt and nxt[0] == i else frame.y1
            # A chemical structure can start just above its part's baseline.
            crossing = [d["rect"].y0 - 2 for d in page.get_drawings()
                        if d["rect"].y0 < top < d["rect"].y1 and top - d["rect"].y0 < 8 and 3 < d["rect"].height < 100
                        and d["rect"].width < 400 and d["rect"].x0 < 535]
            if crossing:
                top = min(top, min(crossing))
            # Keep the complete award when its font box reaches just below
            # the next label's boundary. render_piece masks it on the next crop.
            awards = [y1 + 1 for _, y0, _, y1, text, *_ in legacy.lines_of(page)
                      if MARKS.fullmatch(text) and y0 < end < y1]
            if awards:
                end = max(end, max(awards))
            if nxt and nxt[0] == i:
                shared_heading = {4: "Questions 4 to 6", 21: "Multiple completion questions", 24: "Questions 24 and 25"}.get(nxt[2][0])
                headers = [y0 - 3 for _, y0, _, _, text, *_ in legacy.lines_of(page) if text == shared_heading]
                if mcq and headers:
                    end = min(end, min(headers))
            endings = [y0 for _, y0, _, _, text, *_ in legacy.lines_of(page)
                       if END.search(text) or re.fullmatch(r"Quality of Written Communication(?:\s*\(\d+ marks?\))?", text, re.I)]
            if endings:
                end = min(end, min(endings) - 2)
            rect = fitz.Rect(frame.x0, top, frame.x1, end)
            body = page.get_text("text", clip=rect)
            if rect.height > 8 and body.strip() and (i == pg or meaningful(body)):
                pieces.append((i, rect))
            if endings:
                break
        body = "\n".join(doc[i].get_text("text", clip=r) for i, r in pieces)
        body = re.sub(r"^\s*\(\d+ marks?\)\s*", "", body)
        out.append((key, pieces, body))
    return out


def combine_awards(items):
    """A markless leaf belongs to a shared award at its nearest parent.

    For example, (b)(i) and (b)(ii) with '(3 marks)' only after (ii) form
    one (b) item. The individual prompts and their images remain complete.
    """
    while True:
        leaves = [(n, k) for n, (k, _, text) in enumerate(items)
                  if not MARKS.search(text) and not (n + 1 < len(items) and legacy.under(k, items[n + 1][0]))]
        changed = False
        for n, key in leaves:
            parent = (key[0], key[1], None) if key[2] else (key[0], None, None)
            if parent == key:
                continue
            indexes = [i for i, (k, _, _) in enumerate(items) if k == parent or legacy.under(parent, k)]
            if len(indexes) < 2 or not any(MARKS.search(items[i][2]) for i in indexes):
                continue
            start, end = min(indexes), max(indexes) + 1
            group = items[start:end]
            items = items[:start] + [(parent, [p for _, ps, _ in group for p in ps], "\n".join(t for _, _, t in group))] + items[end:]
            changed = True
            break
        if not changed:
            return items


def move_trailing_context(doc, items):
    """A figure printed after (a)'s award introduces (b), not (a)'s answer.

    Keep that setup with later siblings in the same question. Explicit parent
    setups are still handled separately. No content or drawings are discarded.
    """
    out, extras, active, question = [], {}, [], None
    for n, (key, pieces, own) in enumerate(items):
        if key[0] != question:
            active, question = [], key[0]
        extras[key] = list(active)
        awards = [(j, y1) for j, (pg, rect) in enumerate(pieces)
                  for x0, y0, x1, y1, text, *_ in legacy.lines_of(doc[pg])
                  if MARKS.fullmatch(text) and rect.y0 <= y0 < rect.y1]
        if awards and n + 1 < len(items) and items[n + 1][0][0] == key[0]:
            j, last_y = max(awards)
            following = []
            for z in range(j, len(pieces)):
                pg, rect = pieces[z]
                floor = last_y + 1 if z == j else rect.y0
                starts = [y0 for x0, y0, x1, y1, text, *_ in legacy.lines_of(doc[pg])
                          if floor < y0 < rect.y1 and x0 < 535 and meaningful(text)
                          and not re.match(r"Question \d+ continues|Turn over|Copyright|Quality of Written", text, re.I)]
                if starts:
                    following.append((z, min(starts) - 3))
                    break
            if following:
                z, top = following[0]
                pg, rect = pieces[z]
                tail = [(pg, fitz.Rect(rect.x0, top, rect.x1, rect.y1))] + pieces[z + 1:]
                before = pieces[:z] + ([(pg, fitz.Rect(rect.x0, rect.y0, rect.x1, top))] if top > rect.y0 + 8 else [])
                if any(r.height > 8 and meaningful(doc[i].get_text("text", clip=r)) for i, r in tail):
                    active += tail
                    pieces = before
                    own = "\n".join(doc[i].get_text("text", clip=r) for i, r in pieces)
                    own = re.sub(r"^\s*\(\d+ marks?\)\s*", "", own)
        out.append((key, pieces, own))
    return out, extras


def mcq_keys(doc):
    keys = {}
    for page in doc:
        text = page.get_text()
        if "Section A" not in text and "objective test" not in text.lower():
            continue
        words = page.get_text("words")
        floor = min((y0 for _, y0, _, _, t, *_ in legacy.lines_of(page) if re.fullmatch(r"Question\s+1", t)), default=float("inf"))
        for x, y, _, _, token, *_ in words:
            if not token.isdigit() or not 1 <= int(token) <= 40 or y < 75 or y >= floor:
                continue
            letters = [(abs(ly - y), lx - x, t) for lx, ly, _, _, t, *_ in words
                       if re.fullmatch("[A-D]", t) and abs(ly - y) < 4 and 0 < lx - x < 110]
            if letters:
                keys[int(token)] = min(letters)[2]
            else:
                below = [(ly - y, t) for lx, ly, _, _, t, *_ in words
                         if re.fullmatch("[A-D]", t) and abs(lx - x) < 8 and 0 < ly - y < 40]
                if below:
                    keys[int(token)] = min(below)[1]
    return keys


def process(qp, ms, entry, mcq=False):
    comp, series = entry["component"], entry["series"]
    set_id = f"{comp}-{series}".lower()
    items = regions(qp, mcq)
    items = items if mcq else combine_awards(items)
    items, extra_setups = (items, {}) if mcq else move_trailing_context(qp, items)
    schemes = legacy.ms_questions_2009(ms) if ms and not mcq else {}
    if ms and not mcq and not schemes:
        schemes = table_schemes(ms, {k[0] for k, _, _ in items})
    keys = mcq_keys(ms) if mcq and ms else {}
    shared = {}
    if comp == "CHM6W":
        positions = {k[0]: (pg, y) for pg, y, k in labels(qp, True)}
        for first, last, heading in [(4, 6, "Questions 4 to 6"), (24, 25, "Questions 24 and 25")]:
            pg, end = positions[first]
            top = next(y0 for _, y0, _, _, text, *_ in legacy.lines_of(qp[pg]) if text == heading)
            frame = legacy.qp_frame(qp[pg])
            for q in range(first, last + 1):
                shared.setdefault(q, []).append((pg, fitz.Rect(frame.x0, top - 2, frame.x1, end - 6)))
        pg = positions[21][0]
        top = next(y0 for _, y0, _, _, text, *_ in legacy.lines_of(qp[pg]) if text == "Multiple completion questions")
        frame = legacy.qp_frame(qp[pg])
        for q in range(21, 41):
            shared.setdefault(q, []).append((pg, fitz.Rect(frame.x0, top - 2, frame.x1, positions[21][1] - 6)))
    setups = {k: (pieces, text) for n, (k, pieces, text) in enumerate(items)
              if not mcq and not MARKS.search(text) and n + 1 < len(items) and legacy.under(k, items[n + 1][0])}
    parts, scheme_cache, stem_cache = [], {}, {}
    for k, pieces, own in items:
        if k in setups:
            continue
        q, a, r = k
        pid = "-".join([set_id, str(q)] + ([a] if a else []) + ([r] if r else []))
        ancestors = [parent for parent in [(q, None, None), (q, a, None)]
                     if parent != k and parent in setups]
        ancestors = list(dict.fromkeys(ancestors))
        stem_pieces = [p for parent in ancestors for p in setups[parent][0]] + extra_setups.get(k, []) + shared.get(q, [])
        setup = "\n".join(qp[i].get_text("text", clip=rect) for i, rect in stem_pieces)
        stem_key = pid + "-setup" if extra_setups.get(k) or shared.get(q) else "-".join([set_id, str(q)] + ([ancestors[-1][1]] if ancestors and ancestors[-1][1] else [])) + "-setup"
        if stem_pieces and stem_key not in stem_cache:
            stem = cut.stack([cut.trim_bottom(render_piece(qp[i], rect), 16) for i, rect in stem_pieces])
            stem_cache[stem_key] = bool(cut.save(stem, f"{stem_key}-stem.webp"))
        has_stem = stem_cache.get(stem_key, False)
        image = cut.stack([cut.trim_bottom(render_piece(qp[i], rect)) for i, rect in pieces])
        scheme_pieces, scheme_text = schemes.get((q, None, None), ([], ""))
        scheme_name = None
        if scheme_pieces:
            scheme_name = f"{pid}-ms.webp"
            if q not in scheme_cache:
                scheme = cut.stack([cut.trim_bottom(cut.render(ms[i], rect), 12) for i, rect in scheme_pieces])
                cut.save(scheme, scheme_name)
                scheme_cache[q] = scheme_name
            else:
                shutil.copyfile(WORK / "img" / scheme_cache[q], WORK / "img" / scheme_name)
        marks = (1 if comp == "CHM6W" else 2) if mcq else sum(map(int, MARKS.findall(own))) or None
        parts.append({"id": pid, "set": set_id, "component": comp, "series": series, "subject": entry["subject"],
                      "question": str(q), "label": legacy.label_str(k), "marks": marks,
                      "qp": cut.save(image, f"{pid}-qp.webp"), "ms": scheme_name,
                      "stem": f"{stem_key}-stem.webp" if has_stem else None, "stemKey": stem_key if has_stem else None,
                      "w": image.width if image else 0, "h": image.height if image else 0,
                      "ownText": re.sub(r"\s+", " ", own), "setupText": re.sub(r"\s+", " ", setup),
                      "text": re.sub(r"\s+", " ", setup + " " + own), "msText": re.sub(r"\s+", " ", scheme_text),
                      "msq": 1 if scheme_pieces else 0, **({"key": keys[q]} if mcq and q in keys else {}),
                      "qpRects": [[i, *rect] for i, rect in pieces], "msRects": [[i, *rect] for i, rect in scheme_pieces],
                      "stemRects": [[i, *rect] for i, rect in stem_pieces]})
    return parts


def run_group(job):
    comp, series, files, shared_scheme = job
    all_parts, sets = [], []
    entry = files["qp"]
    qp = legacy.open_upright(str(WORK / "pdf" / entry["file"]))
    scheme_entry = files.get("ms") or shared_scheme
    ms = legacy.open_upright(str(WORK / "pdf" / scheme_entry["file"])) if scheme_entry else None
    jobs = [(qp, entry, comp == "CHM6W")]
    if comp == "PA04":
        boundary = next((i for i, page in enumerate(qp) if i and "Section B" in page.get_text() and "General" in page.get_text()), len(qp))
        a = fitz.open(); a.insert_pdf(qp, from_page=0, to_page=boundary - 1)
        jobs = [(a, dict(entry, component="PA04A"), True)]
        if boundary < len(qp):
            b = fitz.open(); b.insert_pdf(qp, from_page=boundary)
            jobs.append((b, dict(entry, component="PA04B"), False))
    for doc, meta, objective in jobs:
        parts = process(doc, ms, meta, objective)
        all_parts.extend(parts)
        report = {"component": meta["component"], "series": series, "parts": len(parts),
                  "marks": sum(p["marks"] or 0 for p in parts), "missingMarks": [p["id"] for p in parts if p["marks"] is None],
                  "missingKeys": [p["id"] for p in parts if objective and not p.get("key")]}
        sets.append(report)
        print(json.dumps(report), flush=True)
    return all_parts, sets


def main():
    manifest = json.loads((WORK / "manifest.json").read_text())
    groups = {}
    for entry in manifest:
        groups.setdefault((entry["component"], entry["series"]), {})[entry["kind"]] = entry
    jobs = [(comp, series, files, groups.get(("PA04", series), {}).get("ms") if comp == "PA04B" else None)
            for (comp, series), files in sorted(groups.items()) if "qp" in files and (not ONLY or f"{comp}-{series}".lower().startswith(ONLY))]
    all_parts, sets = [], []
    if ONLY and (WORK / "parts.json").exists():
        all_parts = [p for p in json.loads((WORK / "parts.json").read_text()) if not p["set"].startswith(ONLY)]
        sets = [p for p in json.loads((WORK / "cut-summary.json").read_text())
                if not f"{p['component']}-{p['series']}".lower().startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=4) as pool:
        for parts, reports in pool.map(run_group, jobs):
            all_parts.extend(parts)
            sets.extend(reports)
    (WORK / "parts.json").write_text(json.dumps(all_parts, ensure_ascii=False))
    (WORK / "cut-summary.json").write_text(json.dumps(sets, indent=1))


if __name__ == "__main__":
    main()
