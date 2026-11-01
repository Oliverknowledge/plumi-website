"""Fetch AQA's own GCSE French, Spanish and Bengali papers, and the Listening papers' recordings.

    python3 scripts/question-bank/aqa_gcse_languages/fetch_gcse_languages.py [work-dir] [--no-audio]   # default scripts/question-bank/.work/aqa-gcse-languages

fetch_aqa.py run over five assessment-resources pages, with the same <work-dir>/manifest.json:
  - French 8658 and Spanish 8698, examined 2018 to 2025, and their successors French 8652 and
    Spanish 8692, first examined in June 2026, of which AQA has published only the specimens;
  - Bengali 8638, which has no new specification.
Only Paper 1 Listening, Paper 3 Reading and Paper 4 Writing are kept, at both tiers. AQA has
named the papers three ways: "AQA-86583H-QP-NOV21" (paper number 3, November 2020 and 2021),
"AQA-8658RH-QP-JUN24" (from June 2022) and "AQA-8652-RH-SQP" or "86383H-QP-Jun23" (one file
each). All become one component code, "8658RH": the specification, L/R/W, then F/H. French's
June 2023 Higher Reading paper is filed "8658RHR" and read as 8658RH. Specimens (series SPEC)
are kept for 8652 and 8692 only: the old specifications' are superseded, and their Reading
specimens are AQA's copyright-removed copies. June 2018 and June 2019 have been withdrawn
from AQA's site (the file store redirects to its home page); June 2020 and 2021 were cancelled.

The recordings: each Listening paper's "tracked" zip (one MP3 per question, "FREH_007.mp3": AQA's
transcripts, "AQA-8658LH-TR-JUN24", number their items the same way: checked against every French and Spanish one, 1 November 2026),
or where AQA publishes none (November 2020), its one MP3, go to
<work-dir>/audio-src/<component>-<series>/, unmodified. cut_gcse_languages.py pairs tracks with
questions and re-encodes them.
"""
import io, json, os, re, sys, time, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
NO_AUDIO = "--no-audio" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "aqa-gcse-languages")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [f"https://www.aqa.org.uk/subjects/{s}/assessment-resources" for s in (
    "french/gcse/french-8658", "french/gcse/french-8652", "spanish/gcse/spanish-8698", "spanish/gcse/spanish-8692", "bengali/gcse/bengali-8638")]
fetch_aqa.COMPONENTS = {}  # every file is on the resource pages: no file store guesses
NEW = ("8652", "8692")
SKILL = {"1": "L", "3": "R", "4": "W"}


def component(n):
    """'AQA-86583H-…' / 'AQA-8658RHR-…' / 'AQA-8652-RH-…' / '86383H-…' -> ('8658RH', rest of the name)."""
    n = re.sub(r"^AQA-", "", n)
    if m := re.match(r"(\d{4})-?([LRW])([FH])R?-(.*)", n):
        return m.group(1) + m.group(2) + m.group(3), m.group(4)
    if m := re.match(r"(\d{4})([134])([FH])-(.*)", n):
        return m.group(1) + SKILL[m.group(2)] + m.group(3), m.group(4)
    return None, None


def parse_name(name):
    n = name.upper()
    if "MQP" in n or "MODIFIED" in n or not n.endswith(".PDF"):
        return None
    comp, rest = component(n)
    if not comp:
        return None
    cr = "-CR" in rest
    if m := re.match(r"(?:W-)?(QP|MS|WRE)-(JUN|NOV)(\d{2})", rest):
        return comp, fetch_aqa.KINDS[m.group(1)], m.group(2) + m.group(3), cr
    if (m := re.match(r"S(QP|MS)\b", rest)) and comp[:4] in NEW:
        return comp, fetch_aqa.KINDS[m.group(1)], "SPEC", cr
    return None


fetch_aqa.parse_name = parse_name


def recordings():
    """{(component, series): (url, name, tracked)} for every Listening paper, the tracked zip preferred."""
    found = {}
    for page in fetch_aqa.PAGES:
        html, _ = fetch_aqa.get(page)
        for m in re.finditer(r'"originalFilename":"([^"]+)","path":"[^"]+","sha1hash":"[^"]+","size":\d+,"uploadId":"[^"]+","url":"([^"]+)"', (html or "").replace('\\"', '"')):
            name, url = m.group(1), m.group(2)
            n = name.upper()
            if "25PCT" in n:
                continue  # the extra-time copy
            if m2 := re.match(r"AQA-(\d{4})([FH])-SAMS-SF-TR\.ZIP$", n):  # the specimens' tracks, "AQA-8652F-SAMS-SF-TR.zip"
                comp, series, tracked = m2.group(1) + "L" + m2.group(2), "SPEC", True
            else:
                comp, rest = component(n)
                if not comp or comp[4] != "L" or not re.match(r"S?SF\b", rest):
                    continue
                s = re.search(r"(JUN|NOV)(\d{2})", rest)
                series = s.group(1) + s.group(2) if s else ("SPEC" if comp[:4] in NEW else None)
                tracked = "TRACKED" in rest and "UNTRACKED" not in rest
            if series and (tracked or (comp, series) not in found):
                found[(comp, series)] = (url, name, tracked)
        time.sleep(1)
    return found


def fetch_audio(work):
    out = os.path.join(work, "audio-src")
    for (comp, series), (url, name, tracked) in sorted(recordings().items()):
        d = os.path.join(out, f"{comp}-{series}")
        if os.path.isdir(d) and os.listdir(d):
            continue
        body, _ = fetch_aqa.get(url, binary=True)
        if not body:
            print("  failed", name, file=sys.stderr)
            continue
        os.makedirs(d, exist_ok=True)
        if tracked:
            with zipfile.ZipFile(io.BytesIO(body)) as z:
                for info in z.infolist():
                    if info.filename.lower().endswith(".mp3") and not os.path.basename(info.filename).startswith("."):
                        with open(os.path.join(d, os.path.basename(info.filename)), "wb") as fh:
                            fh.write(z.read(info))
        else:
            with open(os.path.join(d, "whole.mp3"), "wb") as fh:
                fh.write(body)
        print(f"  {comp} {series}: {len(os.listdir(d))} {'tracks' if tracked else 'file'}", file=sys.stderr)
        time.sleep(0.5)


if __name__ == "__main__":
    fetch_aqa.main()
    manifest = json.load(open(os.path.join(sys.argv[1], "manifest.json")))
    for comp, series in sorted({(f["component"], f["series"]) for f in manifest if f["kind"] == "qp"}):
        print(f"  {comp} {series}: {' '.join(sorted(f['kind'] + ('-cr' if f['cr'] else '') for f in manifest if f['component'] == comp and f['series'] == series))}", file=sys.stderr)
    if not NO_AUDIO:
        fetch_audio(sys.argv[1])
