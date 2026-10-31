"""Recut the scheme crops that a row carried over a page cut short.

    python3 scripts/question-bank/ms_carryover.py cut [--bank=<slug>] [work-dir]   # needs: pip install pymupdf pillow
    python3 scripts/question-bank/upload_r2.py <work-dir> --crops-only --checksum
    python3 scripts/question-bank/ms_carryover.py apply [--bank=<slug>] [work-dir]

Pearson repeats a row's label on the page it runs on to ("*7(d)" over "contd"). Until 31 October 2026
cut_pearson.py's scheme reader took the repeat for a new row, so the crop stopped at the page break: a
6-mark question showed its levels grid and not the indicative content overleaf (a student's report).
cut_pearson.carried now reads it as one row; this recuts the crops made before that, so no bank needs
cutting again from scratch.

`cut` reads each bank's schemes both ways and, for every part whose rows differ, recuts its crop under
the same name, but only where the old reading reproduces the crop the site serves, to the pixel in each
dimension. A crop cut some other way (by another cutter, or by ms_fallback.py) is left alone and listed
in <work-dir>/report.json. `apply` bumps each changed bank's cropVersion, so browsers fetch the new crops.
"""
import io, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(ROOT, "public", "question-bank")
META = os.path.join(ROOT, "src", "content", "questionBank")
R2 = "https://pub-e8a9dbab8e2a4d089f52b2a45e0d0b50.r2.dev/"
MODE = sys.argv[1] if len(sys.argv) > 1 else ""
ARGS = [a for a in sys.argv[2:] if not a.startswith("--")]
BANKS = [a.split("=", 1)[1] for a in sys.argv if a.startswith("--bank=")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, ".work", "ms-carryover")
MS_VERSION = 2  # questionBank.ts: a scheme crop's ?v= is at least this

sys.argv = [sys.argv[0], WORK]  # cut_pearson reads its work dir from the command line
sys.path.insert(0, os.path.join(HERE, "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402
from PIL import Image  # noqa: E402

cp.IMG = os.path.join(WORK, "img")
os.makedirs(cp.IMG, exist_ok=True)


def fetch(path):
    req = urllib.request.Request(R2 + path, headers={"User-Agent": "Mozilla/5.0"})  # r2.dev turns away a bare client
    try:
        return urllib.request.urlopen(req, timeout=60).read()
    except Exception:
        return None


def scheme(path):
    local = os.path.join(WORK, "pdf", path.replace("/", "__"))
    if not os.path.exists(local):
        data = fetch(path)
        if not data:
            return None
        os.makedirs(os.path.dirname(local), exist_ok=True)
        open(local, "wb").write(data)
    return local


def keys(label):
    """The scheme keys a part's label can be read as, most likely first: "7(d)" -> (7, "d", None);
    "3(b)(ii)" -> (3, "b", "ii"); "2(i)" -> (2, "i", None) or (2, None, "i")."""
    m = re.match(r"^\*?0?(\d{1,2})\*?((?:\([a-z]+\))*)\*?$", label.strip())
    if not m:
        return []
    q, subs = int(m.group(1)), re.findall(r"[a-z]+", m.group(2))
    if not subs:
        return [(q, None, None)]
    if len(subs) == 2:
        return [(q, subs[0], subs[1])]
    out = [(q, subs[0], None)] if subs[0] in cp.LETTERS else []
    return out + ([(q, None, subs[0])] if subs[0] in cp.ROMANS else [])


def hit(ms, key):
    """cut_pearson.cut_set's lookup: the part's own row, else its parent's."""
    q, letter, roman = key
    return ms.get(key) or (ms.get((q, letter, None)) if roman else None) or (ms.get((q, None, None)) if not letter else None) \
        or (ms.get((q, None, "i")) if letter == "i" and not roman else None)


def render(doc, pieces, squash):
    img = cp.stack([cp.trim(doc.crop(pg, r), 10, sides=True) for pg, r in pieces])
    img = cp.squash(img) if squash and img else img
    if img is not None and img.height > 16000:  # as cut_pearson.save
        img = img.resize((round(img.width * 16000 / img.height), 16000))
    return img


def cut():
    report = {}
    carried = cp.carried
    for name in sorted(os.listdir(META)):
        meta = json.load(open(os.path.join(META, name)))
        if not isinstance(meta, dict) or not isinstance(meta.get("wholes"), dict) or (BANKS and meta.get("slug") not in BANKS):
            continue
        slug = meta["slug"]
        path = os.path.join(PUB, slug, "parts.json")
        if not os.path.exists(path):
            continue
        by_set = {}
        for p in json.load(open(path)):
            if p.get("ms") and not p.get("msq"):
                by_set.setdefault(f"{p['p']}-{p['s']}", []).append(p)
        done, kept = [], []
        for set_id, parts in sorted(by_set.items()):
            ms_path = (meta["wholes"].get(set_id) or {}).get("ms")
            local = scheme(ms_path) if ms_path else None
            if not local:
                continue
            try:
                doc = cp.Doc(local)
                new = cp.ms_tables(doc)
                cp.carried = lambda found, doc: found
                old = cp.ms_tables(doc)
            except Exception as e:  # a scheme cut_pearson can't read was cut some other way
                print(f"{slug} {set_id}: {e}", file=sys.stderr)
                continue
            finally:
                cp.carried = carried
            rows = lambda h: [(pg, tuple(round(v, 1) for v in r)) for pg, r in h[0]] if h else []  # noqa: E731
            if all(rows(old.get(k)) == rows(new.get(k)) for k in set(old) | set(new)):
                continue
            for p in parts:
                change = next(((hit(old, k), hit(new, k)) for k in keys(p["l"]) if rows(hit(old, k)) != rows(hit(new, k))), None)
                if not change:
                    continue
                data = fetch(f"bank/{p['id']}-ms.webp")
                live = Image.open(io.BytesIO(data)).size if data else None
                squash = next((s for s in (False, True) if live and (im := render(doc, change[0][0], s)) is not None and im.size == live), None)
                if squash is None:
                    kept.append(p["id"])
                    continue
                img = render(doc, change[1][0], squash)
                img.save(os.path.join(cp.IMG, f"{p['id']}-ms.webp"), "WEBP", quality=72, method=4)
                done.append(p["id"])
        if done or kept:
            report[slug] = {"recut": done, "left": kept}
            print(f"{slug}: {len(done)} recut, {len(kept)} left (served crop not cut this way)", file=sys.stderr, flush=True)
    json.dump(report, open(os.path.join(WORK, "report.json"), "w"), indent=1)
    print(f"total: {sum(len(r['recut']) for r in report.values())} recut, {sum(len(r['left']) for r in report.values())} left", file=sys.stderr)


def apply():
    report = json.load(open(os.path.join(WORK, "report.json")))
    for slug, r in report.items():
        if not r["recut"] or (BANKS and slug not in BANKS):
            continue
        path = os.path.join(META, f"{slug}.json")
        meta = json.load(open(path))
        meta["cropVersion"] = max(meta.get("cropVersion") or 0, MS_VERSION) + 1
        json.dump(meta, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
        print(f"{slug}: cropVersion {meta['cropVersion']}", file=sys.stderr)


if __name__ == "__main__":
    {"cut": cut, "apply": apply}[MODE]()
