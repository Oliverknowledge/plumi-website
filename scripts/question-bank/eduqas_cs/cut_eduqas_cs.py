"""Cut Eduqas's Computer Science papers into question parts, each paired with its mark scheme rows.

    python3 scripts/question-bank/eduqas_cs/cut_eduqas_cs.py [work-dir] [--only=a500u10-jun24] [--debug]
    # default work dir: scripts/question-bank/.work/eduqas-cs
    # needs: pip install pymupdf pillow

eduqas/cut_eduqas.py as a library, unchanged, for the question papers and examiner's reports, and
the same shapes out. Two things are this subject's own, and two small patches to the shared reading
stay here too: a line with no letters at a page's foot (area) and 2017's reports (examiner_report).

  - Mark schemes: not the sciences' "Question | Marking details" table but "Q | Answer | Mark | AO1
    AO2 AO3 | Total", whose heads change by year ("Qu", "Tot", a head with no words over its first
    two columns) and whose labels are written every way ("1(a)", "1cii", "1. (a)", "(b) (i)",
    "(a)(ii)", "3(b)" and "(i)" in two columns, "5aiii 5biii 5ciii" stacked in one cell for one row).
    ms_rows here reads the label column by its rules. A band table's "3", "2", "1", "0" sit in the
    same column, so bare numbers counting down, or a number with "7-9 marks" or "The candidate has"
    beside it, aren't questions. A band table stays in its question's crop.
  - AS Component 2 (b500u20) is sat on screen, around a scenario printed before question 1 and a
    last question at the computer. The scenario goes in every question's stem. The last question
    prints the same task once per language in some years, with one scheme row for all three: Python's
    copy is kept. Its "Open the file X … Complete this code", and any annotating of that code, needs a
    program only centres are given, so those parts are left out, as AQA Paper 1's Skeleton Program is.
"""
import glob, json, os, re, sys
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
ONLY = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")), None)
DEBUG = "--debug" in sys.argv
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-cs")
sys.argv = [sys.argv[0], WORK] + (["--debug"] if DEBUG else [])  # (the workers read their flags from here too)
sys.path.insert(0, os.path.join(HERE, "..", "eduqas"))
import cut_eduqas as c  # noqa: E402
import pymupdf  # noqa: E402

IMG = os.path.join(WORK, "img")
BAND_ROW = re.compile(r"^(?:award\s+)?\d+\s*[-–]\s*\d+\s*marks?\b|^(?:award\s+)?\d+\s*marks?\s*(?:the candidate has|$)|^the candidate has", re.I)
ON_SCREEN = "b500u20"
NEEDS_FILE = re.compile(r"Open the file|code from question \d+\([a-c]\)\(i\)(?!i)", re.I)


# ---------- mark schemes ----------

def segments(doc, i):
    """The straight lines a page draws, from its paths' pieces and its boxes' edges."""
    out = []
    for d in doc.draws(i):
        for item in d["items"]:
            if item[0] == "l":
                out.append((item[1], item[2]))
            elif item[0] == "re":
                r = item[1]
                if r.width < 3 or r.height < 3:
                    out.append((r.tl, r.br))
                else:
                    out += [(r.tl, r.tr), (r.bl, r.br), (r.tl, r.bl), (r.tr, r.br)]
    return out


def page_table(doc, i):
    """A scheme page's table: {x0, x1, rules, verticals, head}, or None where it has no ruled table."""
    page = doc.doc[i]
    v, h, across = {}, {}, []
    # (Some schemes draw a table's rules as one path, whose box is the whole table: read its pieces.)
    for a, b in segments(doc, i):
        if abs(a.x - b.x) < 3 and abs(a.y - b.y) > 8:
            v[round(a.x)] = v.get(round(a.x), 0) + abs(a.y - b.y)
        if abs(a.y - b.y) < 3 and abs(a.x - b.x) > 8:
            h[round(a.y, 1)] = h.get(round(a.y, 1), 0) + abs(a.x - b.x)
            across.append((round(a.y, 1), min(a.x, b.x), max(a.x, b.x)))
    verticals = sorted(x for x, tall in v.items() if tall > page.rect.height * 0.08)
    if len(verticals) < 2 or not h:
        return None
    x0, x1 = verticals[0] - 2, verticals[-1] + 2
    rules = sorted(y for y, w in h.items() if w > 0.3 * (x1 - x0))
    if not rules:
        return None
    # The head row: where "AO1", "AO2" and "AO3" sit together (a band table's "AO1b - Max 12 marks" has just the one).
    # By those words, not "Mark" or "Answer", which the rows under it can start with too.
    words = page.get_text("words")
    aos = [w for w in words if w[4] in ("AO1", "AO2", "AO3")]
    row = next((w for w in sorted(aos, key=lambda w: w[1]) if {o[4] for o in aos if abs(o[1] - w[1]) < 30} == {"AO1", "AO2", "AO3"}), None)
    cells = [o for o in aos if row and abs(o[1] - row[1]) < 30]
    if not row:  # (June 2018 sets one merged "AO" cell: "Qu | Answer | Mark | AO | Tot")
        marks = [w for w in words if w[4] in ("Mark", "Marks") and any(o[4] in ("Tot", "TOT", "Total") and abs(o[1] - w[1]) < 5 for o in words) and any(o[4] in ("Answer", "Answers") and abs(o[1] - w[1]) < 5 for o in words)]
        row = marks[0] if marks else None
        cells = [row] if row else []
    head, answer = None, None
    if row:
        top, foot = min(o[1] for o in cells), max(o[3] for o in cells)
        above = [y for y in rules if y <= top + 3]
        below = [y for y in rules if y >= foot - 2]
        if below:
            head = pymupdf.Rect(x0, (above[-1] - 1) if above else top - 3, x1, below[0] + 1)
        answer = next((w for w in words if w[4] in ("Answer", "Answers") and top - 25 < w[1] < foot + 5), None)
    return {"x0": x0, "x1": x1, "rules": rules, "verticals": verticals, "head": head, "answer_x": answer[0] if answer else None, "across": across}


def foot_of(doc, i):
    """Where a scheme page's table can't reach: its footer, "© WJEC CBAC Ltd." and the page number on a line of its own."""
    page = doc.doc[i]
    words = page.get_text("words")
    h = page.rect.height
    foot = [w[1] for w in words if w[4] == "©" and w[1] > h - 130]
    # (the page number is centred: a band table's "0" stands alone too, at the left)
    foot += [w[1] for w in words if w[1] > h - 130 and re.fullmatch(r"\d{1,2}", w[4]) and abs((w[0] + w[2]) / 2 - page.rect.width / 2) < page.rect.width * 0.2 and sum(1 for o in words if abs(o[1] - w[1]) < 5) == 1]
    foot += [l["y0"] for l in doc.lines(i) if l["y0"] > h - 130 and re.search(r"\b(?:EDUQAS|Eduqas)\b", l["text"])]  # ("A500U10-1 EDUQAS A LEVEL COMPUTER SCIENCE - COMPONENT 1", on a scheme's last page)
    return min(foot + [h - 40])


def band_lines(lines):
    """The ids of the lines that are a band table's "3", "2", "1", "0": bare numbers counting down, which questions never do. A number
    above 3 starting the run is the question the table belongs to."""
    bare = [(n, int(re.sub(r"\s", "", t))) for n, t in lines if re.fullmatch(r"\s*\d{1,2}\s*", t)]
    out = set()
    k = 0
    while k < len(bare):
        j = k
        while j + 1 < len(bare) and bare[j + 1][1] == bare[j][1] - 1:
            j += 1
        if j > k or bare[k][1] == 0:
            out |= {n for n, v in bare[k:j + 1] if v <= 3}
        k = j + 1
    return out


def label_edge(doc, tables):
    """Where a scheme's label column ends: the rule left of its "Answer" where a head has one, else the
    table's second rule, as most pages have it. The same on all a scheme's pages, near enough."""
    edges = []
    for t in tables.values():
        if t["answer_x"]:
            edges += [v for v in t["verticals"] if v < t["answer_x"] - 2][-1:]
    common = max(set(edges), key=edges.count) if edges else None
    out = {}
    for i, t in tables.items():
        second = next((v for v in t["verticals"] if v > t["verticals"][0] + 12), t["verticals"][-1])
        out[i] = next((v for v in t["verticals"] if common and abs(v - common) <= 8), second)
    return out


def tokens(text):
    """'1cii' -> ('1', ['c', 'ii']); '1. (a)' -> ('1', ['a']); '(b) (i)' -> (None, ['b', 'i']); 'Band' -> None."""
    s = re.sub(r"[\s.*]", "", text).lower()
    m = re.fullmatch(r"(\d{1,2})?((?:\([a-z]{1,5}\))*|[a-z]{1,5}|[a-z]\([a-z]{1,5}\))", s)
    if not m or not (m.group(1) or m.group(2)):
        return None
    rest = m.group(2)
    subs = re.findall(r"[a-z]{1,5}", rest)
    if len(subs) == 1 and "(" not in rest and len(subs[0]) > 1 and not re.fullmatch(r"[ivx]+", subs[0]):
        subs = [subs[0][0], subs[0][1:]]  # "cii": part c, sub-part ii. ("ii" alone is a sub-part.)
    if len(subs) > 2 or (len(subs) == 2 and not re.fullmatch(r"[ivx]+", subs[1])):
        return None
    if any(s not in c.LETTERS and s not in c.ROMANS for s in subs):
        return None
    return m.group(1), subs


def keys_for(q, subs, letter_now, order, seen, aliases):
    """The parts a label names, given the paper's. "(i)" is a sub-part where the paper has one here, else part (i);
    "4 (i)" where the paper has 4(a)(i), 4(b)(i) and 4(c)(i) is all three, as a language question's scheme has it."""
    def ok(key):
        return aliases.get(key, key) in order and aliases.get(key, key) not in seen
    if not subs:
        return [(q, None, None)] if ok((q, None, None)) else []
    if len(subs) == 2:
        key = (q, subs[0], subs[1])
        if ok(key):
            return [key]
        return [(q, subs[0], None)] if subs[1] == "i" and ok((q, subs[0], None)) else []  # "5 (a) (i)" where the paper's (a) has no sub-parts
    s = subs[0]
    if s in c.ROMANS:
        if ok((q, letter_now, s)):
            return [(q, letter_now, s)]
        if ok((q, None, s)):
            return [(q, None, s)]
        across = [(q, x, s) for x in c.LETTERS if ok((q, x, s))]
        if across:
            return across
    return [(q, s, None)] if ok((q, s, None)) else []


def ms_rows(doc, expected, aliases=None):
    """cut_eduqas.ms_rows for this table: {(q, letter, roman): {"pieces", "head", "text", "prac", "total"}}."""
    order = {k: n for n, k in enumerate(expected)}
    aliases = aliases or {}
    tables = {i: t for i in range(1, len(doc)) if (t := page_table(doc, i))}
    # (The rules on the guidance pages before the table aren't a table: it starts at the first head.)
    first = min((i for i, t in tables.items() if t["head"]), default=min(tables, default=0))
    tables = {i: t for i, t in tables.items() if i >= first}
    edges = label_edge(doc, tables)
    found, seen = [], set()
    q_now, letter_now = 0, None
    head_src = {}
    last_head = None
    page_lines = []
    for i in sorted(tables):
        t = tables[i]
        if t["head"]:
            last_head = (i, t["head"])
        head_src[i] = last_head or (i, pymupdf.Rect(t["x0"], t["rules"][0] - 1, t["x1"], t["rules"][0]))
        body_top = t["head"].y1 - 2 if t["head"] else 0
        words = sorted((w for w in doc.doc[i].get_text("words") if w[1] > body_top and w[0] >= t["x0"] - 1 and w[1] < foot_of(doc, i)
                        and (w[0] < edges[i] - 1 or w[0] < edges[i] + 14 and re.fullmatch(r"\([ivx]{1,4}\)", w[4]))), key=lambda w: (w[1], w[0]))
        lines = []
        for w in words:
            if lines and abs(lines[-1]["y0"] - w[1]) < 5:
                lines[-1]["bits"].append(w)
            else:
                lines.append({"y0": w[1], "bits": [w]})
        for line in lines:
            page_lines.append((i, line, " ".join(w[4] for w in sorted(line["bits"], key=lambda w: w[0]))))
    bands = band_lines([(n, text) for n, (_, _, text) in enumerate(page_lines)])
    prev = None
    for n, (i, line, text) in enumerate(page_lines):
        t = tables[i]
        tok = tokens(text)
        if DEBUG:
            print(f"  ms p{i} y{line['y0']:.0f} {text!r} -> {tok}{' band' if n in bands else ''}", file=sys.stderr)
        if not tok or n in bands:
            continue
        num, subs = tok
        # A sub-part's label can open the row's answer instead ("(ii) Distance ="): only as a part the paper has here.
        if min(w[0] for w in line["bits"]) >= edges[i] - 1 and (num or (q_now, letter_now, subs[0]) not in order or (q_now, letter_now, subs[0]) in seen):
            continue
        q = int(num) if num else q_now
        if not q or q < q_now:
            continue
        if num and not subs:
            beside = " ".join(w[4] for w in sorted((w for w in doc.doc[i].get_text("words") if abs(w[1] - line["y0"]) < 5 and w[0] >= edges[i] - 1), key=lambda w: w[0]))
            if BAND_ROW.search(beside.strip()) or q > q_now + 1:
                continue
        if q != q_now:
            letter_now = None
        keys = keys_for(q, subs, letter_now, order, seen, aliases)
        if num:
            q_now = q  # (a question whose rows don't match the paper's still moves on: the next number follows from it)
        if not keys:
            continue
        q_now = q
        letter_now = keys[0][1] if len(keys) == 1 else None
        # A row's top is the rule across the label column: an answer's own table has rules too, but none out there.
        lx0, lx1 = t["verticals"][0] + 2, edges[i] - 2
        above = sorted({y for y, a, b in t["across"] if y <= line["y0"] + 2.5 and a < lx1 and b > lx0})
        top = above[-1] if above else line["y0"] - 4
        stacked = prev and prev[0] == i and line["y0"] - prev[1] < 16
        # A row the table leaves unruled from the one before starts at its own words, unless it's stacked in that one's cell.
        if stacked:
            top = found[-1][1]
        elif line["y0"] - top > 30:
            # (from the row's highest word: an answer's first line can start above its label)
            top = min(w[1] for w in doc.doc[i].get_text("words") if abs(w[1] - line["y0"]) < 6) - 1
        prev = (i, line["y0"])
        for key in keys:
            key = aliases.get(key, key)
            seen.add(key)
            found.append((i, top, key))
    out = {}
    for n, (pg, top, key) in enumerate(found):
        nxt = next((f for f in found[n + 1:] if (f[0], f[1]) != (pg, top)), None)
        end = (nxt[0], nxt[1]) if nxt else (len(doc), 0)
        pieces, p = [], pg
        while p < len(doc) and (p, 0) < end:
            t = tables.get(p)
            if t is None:
                break
            start = top if p == pg else (t["head"].y1 - 1 if t["head"] else t["rules"][0] - 1)
            foot = foot_of(doc, p)
            words = [w[3] for w in doc.doc[p].get_text("words") if w[0] > t["x0"] and w[1] > start and w[1] < foot]
            table_end = min(max([y for y in t["rules"] if y < foot] + [max(words, default=0) + 3]), foot - 1)
            bottom = end[1] if end[0] == p else table_end
            if bottom > start + 4 and c.BOILER.sub("", doc.text(p, pymupdf.Rect(t["x0"], start, t["x1"], bottom))).strip():
                rect = pymupdf.Rect(t["x0"], start, t["x1"], bottom + 0.8)
                inked = c.trim(doc.crop(p, rect), keep=4)  # (a table can stop well above its last rule, or the page's: no white under it)
                if inked is not None:
                    rect.y1 = min(rect.y1, rect.y0 + inked.height / c.SCALE)
                pieces.append((p, rect))
            if end[0] == p:
                break
            p += 1
        if pieces:
            text = " ".join(doc.text(p, r) for p, r in pieces)
            out[key] = {"pieces": pieces, "head": head_src[pg], "text": re.sub(r"\s+", " ", text), "prac": 0, "total": 0}
    return out


c.ms_rows = ms_rows


# ---------- question papers ----------

shared_area = c.area


def area(doc, i):
    """cut_eduqas.area, and a line with no letters that the page's foot runs through stays whole: "£275.50. [1]" lost its foot."""
    r = shared_area(doc, i)
    crossing = [l["y1"] for l in doc.lines(i) if l["y0"] < r.y1 < l["y1"] and not re.search(r"©|Turn over|\([AB]\d{3}U", l["text"]) and "=" not in l["text"]]
    furniture = [l["y0"] for l in doc.lines(i) if re.search(r"©|Turn over|\([AB]\d{3}U", l["text"]) and l["y0"] > r.y1 - 2]
    if crossing:
        r.y1 = min([max(crossing)] + [y - 1 for y in furniture])
    return r


c.area = area


# ---------- examiner's reports ----------

shared_report = c.examiner_report


def examiner_report(path, section):
    """cut_eduqas.examiner_report, and where it finds nothing for a question, 2017's way of setting one out: under "Individual
    Questions", "1. The majority of candidates…", a number that starts its own sentence and that only counts as the next one."""
    out = shared_report(path, section)
    if not path or not os.path.exists(path):
        return out
    text = "\n".join(p.get_text() for p in pymupdf.open(path))
    text = re.sub(r"\n\s*©\s*WJEC CBAC Ltd\.?\s*(?:\d{4})?\s*\n(?:\s*\d{1,3}\s*\n)?", "\n", text)
    want = section.split()[-1]
    heads = list(re.finditer(r"\n\s*(?:AS |A LEVEL |[A-Z]{5,10} )?(COMPONENT|Component) (\d)\b[^\n]*\n(?!\s*\d{1,3}\s*\n)", text))
    mine = [m for m in heads if m.group(2) == want]
    if not mine:
        return out
    start = mine[-1].end()
    later = [m.start() for m in heads if m.start() > start and m.group(2) != want]
    body = text[start:min(later) if later else len(text)]
    at = body.find("Individual Questions")
    if at < 0:
        return out
    body = re.split(r"\n\s*(?:Supporting you|Summary of key points)\b", body[at:])[0]
    found, nxt = {}, 1
    pos = [(m.start(), m.end(), int(m.group(1))) for m in re.finditer(r"\n\s*(\d{1,2})\.[ \t]+(?=[A-Z(])", body)]
    keep = []
    for a, b, n in pos:
        if n == nxt or n == nxt - 1:
            keep.append((a, b, n))
            nxt = max(nxt, n + 1)
    for k, (a, b, n) in enumerate(keep):
        rest = body[b:keep[k + 1][0] if k + 1 < len(keep) else len(body)]
        rest = re.sub(r"(?<!\n)\n(?!\n)", " ", rest)
        paras = [p.strip() for p in re.split(r"\n\s*\n", re.sub(r"[ \t]+", " ", rest)) if len(p.strip()) > 30]
        if paras:
            key = f"{n:02d}"
            found[key] = found.get(key, f"Question {n}") + "\n\n" + "\n\n".join(paras)
    return {**found, **out}


c.examiner_report = examiner_report


# ---------- AS Component 2 ----------

def scenario(qp_path):
    """(image, the question labels, the page the questions end): the pages before question 1 and what is above it on its own page."""
    qp = c.Doc(qp_path)
    labels, end_page = c.qp_labels(qp)
    pg, y = labels[0][0], labels[0][1]
    pieces = []
    for i in range(1, pg):
        if not c.blank(qp, i):
            pieces.append((i, c.area(qp, i)))
    f = c.area(qp, pg)
    if c.label_top(qp, pg, y) > f.y0 + 10:
        pieces.append((pg, pymupdf.Rect(f.x0, f.y0, f.x1, c.label_top(qp, pg, y))))
    return c.stack([c.trim(qp.crop(p, r), 14) for p, r in c.tidy(qp, pieces, keep_first=False)]), qp, labels, end_page


def on_screen(qp_path, set_id, parts):
    """Leave off what needs the program centres are given and all but Python's copy, and put the scenario in every stem."""
    from PIL import Image  # noqa: PLC0415
    image, qp, labels, end_page = scenario(qp_path)
    last_q = max(p["question"] for p in parts)
    sections = {p["part"][0] for p in parts if p["question"] == last_q and p["part"]} if any("section (a), (b) or (c)" in p["text"] for p in parts if p["question"] == last_q) else set()
    keep = None
    lead = None
    if sections:
        keep = next(p["part"][0] for p in parts if p["question"] == last_q and "using Python" in p["text"])
        # The section's opening words, up to its "(i)": they name the language and what the system is for.
        at = [n for n, (_, _, q, letter, _) in enumerate(labels) if q == int(last_q) and letter == keep]
        a, b = labels[at[0]], labels[at[0] + 1]
        lead = c.stack([c.trim(qp.crop(pg, r), 14) for pg, r in c.tidy(qp, c.region(qp, (a[0], a[1]), (b[0], b[1]), end_page), keep_first=False)])
    out, dropped = [], []
    for p in parts:
        own = p["text"]
        if p["question"] == last_q and (keep and p["part"][0] != keep):
            continue
        if p["question"] == last_q and NEEDS_FILE.search(own):
            dropped.append(p["label"])
            continue
        out.append(p)
    for q in sorted({p["question"] for p in out}):
        name = f"{set_id}-{q}-stem.webp"
        path = os.path.join(IMG, name)
        own = Image.open(path).convert("RGB") if os.path.exists(path) else None
        c.save(c.stack([image, own, lead if q == last_q else None]), name)
    for p in out:
        p["stem"] = f"{set_id}-{p['question']}-stem.webp"
        if not p["part"]:
            p["sk"] = p["id"]  # (the site finds a stem by taking the part off an id: this one has none to take off)
    for f in glob.glob(os.path.join(IMG, f"{set_id}-{last_q}-*-qp.webp")) + glob.glob(os.path.join(IMG, f"{set_id}-{last_q}-*-ms.webp")):
        if not any(os.path.basename(f).startswith(p["id"] + "-") for p in out):
            os.remove(f)
    print(f"{set_id}: left out {dropped}, kept section {keep}", file=sys.stderr, flush=True)
    return out


# ---------- one paper ----------

def run_set(job):
    set_id, files, meta = job
    pdf = lambda k: os.path.join(WORK, "pdf", files[k]["file"]) if k in files else None  # noqa: E731
    try:
        for stale in glob.glob(os.path.join(IMG, f"{set_id}-*-stem.webp")):
            os.remove(stale)
        parts = c.cut_set(pdf("qp"), pdf("ms"), pdf("er"), set_id, meta, files.get("er", {}).get("section"))
        if meta["component"] == ON_SCREEN:
            parts = on_screen(pdf("qp"), set_id, parts)
        return set_id, parts, None
    except Exception:  # noqa: BLE001
        import traceback  # noqa: PLC0415
        return set_id, [], traceback.format_exc(limit=6)


def main():
    os.makedirs(IMG, exist_ok=True)
    manifest = json.load(open(os.path.join(WORK, "manifest.json")))
    sets = {}
    for f in manifest:
        sets.setdefault((f["component"], f["series"]), {})[f["kind"]] = f
    jobs = []
    for (comp, series), files in sorted(sets.items()):
        set_id = f"{comp}-{series}".lower()
        if "qp" in files and (not ONLY or set_id.startswith(ONLY)):
            jobs.append((set_id, files, {"component": comp, "spec": comp[:4].upper(), "series": series, "paperTitle": files["qp"].get("title", ""), "subject": files["qp"]["subject"]}))
    all_parts, problems = [], []
    if ONLY and os.path.exists(os.path.join(WORK, "parts.json")):
        all_parts = [p for p in json.load(open(os.path.join(WORK, "parts.json"))) if not p["set"].startswith(ONLY)]
    with ProcessPoolExecutor(max_workers=max(2, (os.cpu_count() or 4) - 1)) as pool:
        for set_id, parts, err in pool.map(run_set, jobs):
            if err:
                problems.append(f"{set_id}: {err}")
                continue
            no_ms = [p["label"] for p in parts if not p["ms"]]
            print(f"{set_id}: {len(parts)} parts, {sum(p['marks'] or 0 for p in parts)} marks, {len(no_ms)} without scheme {no_ms or ''}, "
                  f"{sum(1 for p in parts if p['marks'] is None)} without marks, {len({p['question'] for p in parts if not p['er']})} questions without report", file=sys.stderr, flush=True)
            if not parts or no_ms:
                problems.append(f"{set_id}: {len(parts)} parts, {len(no_ms)} without scheme")
            all_parts += parts
    json.dump(all_parts, open(os.path.join(WORK, "parts.json"), "w"), ensure_ascii=False)
    print(f"{len(all_parts)} parts; problems: {len(problems)}", file=sys.stderr)
    for p in problems:
        print("  ", p, file=sys.stderr)


if __name__ == "__main__":
    main()
