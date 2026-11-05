"""Fetch Pearson Edexcel's own GCSE Spanish papers and the Listening papers' recordings.

    python3 scripts/question-bank/edexcel_gcse_spanish/fetch_gcse_spanish.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-gcse-spanish

Pearson's search service files 1SP0's exam materials under no specification code ("gcse16-spanish" lists
ten training files), so fetch_pearson.listed finds nothing: a free-text search does, and each file's name
says what it is. From qualifications.pearson.com only:
  - 1SP0 (2016 specification, examined 2018 to 2025): Paper 1 Listening, Paper 3 Reading, Paper 4 Writing at
    both tiers, June 2018, June 2019, November 2020, November 2021, June 2022 to June 2025. Paper 2 (Speaking)
    is left out, as are the modified papers and the extra-time recordings.
    Pearson publishes no separate Listening transcripts: each is bound in at the back of its mark scheme, and split out here.
  - 1SP1 (2024 specification, first examined June 2026): Pearson keeps June 2026 and both secure mock sets
    for teachers (they redirect to its login, and are skipped); its Sample Assessment Materials are public.
    Their Papers 2, 3 and 4 are Listening, Reading and Writing, and each is one collated PDF (the paper, then
    any transcript, then its mark scheme) with its recording in a zip.

PDFs go to <work-dir>/pdf/<component>-<kind>-<series>.pdf, recordings to <work-dir>/audio-src/<component>-<series>/
(a tracked zip's tracks, else whole.mp3), both unmodified, and <work-dir>/manifest.json lists them. Component codes
are "1sp0-1f". Polite: a few threads, cached, so a re-run fetches only what is missing.
"""
import io, json, os, re, subprocess, sys, time, urllib.parse, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-gcse-spanish")
PDF, AUDIO, CACHE = os.path.join(WORK, "pdf"), os.path.join(WORK, "audio-src"), os.path.join(WORK, "download")
BASE = "https://qualifications.pearson.com"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
SERIES = {"June-2018": "JUN18", "June-2019": "JUN19", "November-2020": "NOV20", "November-2021": "NOV21",
          "June-2022": "JUN22", "June-2023": "JUN23", "June-2024": "JUN24", "June-2025": "JUN25"}
KINDS = {"que": "qp", "rms": "ms", "msc": "ms", "pef": "er"}
SEARCHES = ["1SP0"] + [f"1sp0 {w}" for w in ("question paper", "mark scheme", "examiner report", "recording")] \
    + [f"1SP0 {y}" for y in range(2018, 2026)] + [f"gcse spanish {s}" for s in (
        "june 2018", "june 2019", "november 2020", "november 2021", "june 2022", "june 2023", "june 2024", "june 2025", "recording", "listening")] \
    + ["gcse spanish sample assessment materials", "1sp1 paper 2 listening sample"]
# 1SP1's Sample Assessment Materials: a file per paper, and a zip per Listening recording
SAMS = "/content/dam/pdf/GCSE/Spanish/2024/specification-and-sample-assessments/"
SAM_PDFS = {"1sp1-2f": "3-collated-gcse-spanish-sams-paper-2-foundation.pdf", "1sp1-2h": "4-collated-gcse-spanish-sams-paper-2-higher.pdf",
            "1sp1-3f": "5-collated-gcse-spanish-sams-paper-3-foundation.pdf", "1sp1-3h": "3-collated-gcse-spanish-sams-paper-3-higher.pdf",
            "1sp1-4f": "7-collated-gcse-spanish-sams-paper-4-foundation.pdf", "1sp1-4h": "8-collated-gcse-spanish-sams-paper-4-higher.pdf"}
SAM_AUDIO = {"1sp1-2f": "gcse-spanish-paper-2-listening-foundation-audio-recording.zip", "1sp1-2h": "gcse-spanish-paper-2-listening-higher-audio-recording.zip"}


def text(query):
    url = f"{BASE}/services/pearson/algolia/GET.servlet?" + urllib.parse.quote("q=" + query.replace(" ", "+"), safe="=&+:")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return json.loads(r.read().decode())["searchResults"].get("algoliaRecords", [])


def curl(url):
    """A file's bytes, through curl (Pearson's server drops long downloads part way under urllib), cached by its name."""
    out = os.path.join(CACHE, os.path.basename(url))
    if not os.path.exists(out):
        r = subprocess.run(["curl", "-sfL", "--retry", "4", "--retry-all-errors", "-A", UA, "-o", out + ".part", BASE + url.replace(" ", "%20")], capture_output=True)
        if r.returncode:
            return None
        os.replace(out + ".part", out)
    return out


def parse(name):
    """(component, what) from a file name, or None: 1SP0_1F_que_20180519.pdf, 1sp0-4h-rms-20220825.pdf,
    1sp0-1f-recording-tracked-2206.zip, 1SP0_1F_aud_1806.mp3, 1906-1SP0-1F-recording-_Spanish.mp3, 2006-1SP0-1F-E1.mp3, 1SP0_1F_E2.mp3."""
    n = name.lower()
    if "extra" in n or "modified" in n or "errata" in n:
        return None
    m = re.search(r"1sp0[-_]([134][fh])[-_](que|rms|msc|pef|aud|recording|e\d)", n)
    if not m:
        return None
    what = m.group(2)
    comp = f"1sp0-{m.group(1)}"
    if what in KINDS and n.endswith(".pdf"):
        return comp, KINDS[what]
    if n.endswith(".zip") and "tracked" in n:
        return comp, "tracked"
    if n.endswith(".mp3"):
        return comp, "whole"
    return None


def extract(zip_path, d):
    """A tracked recording's MP3s, unmodified, under their own names, in order."""
    with zipfile.ZipFile(zip_path) as z:
        for info in sorted(z.infolist(), key=lambda i: i.filename):
            base = os.path.basename(info.filename)
            if base.lower().endswith(".mp3") and not base.startswith("."):
                with open(os.path.join(d, base), "wb") as fh:
                    fh.write(z.read(info))


def split_sam(f):
    """A collated Sample Assessment PDF as manifest entries for its transcript (Listening only), its paper and its scheme:
    the paper is the pages with its barcode ("*S78274A0116*"), the transcript what comes before, the scheme what comes after."""
    import pymupdf  # noqa: PLC0415
    doc = pymupdf.open(os.path.join(PDF, f["file"]))
    coded = [n for n, p in enumerate(doc) if re.search(r"\*S\d{5}A\d{4,5}\*", p.get_text())]
    ranges = {"qp": (coded[0], coded[-1]), "ms": (coded[-1] + 1, len(doc) - 1)}
    if coded[0] > 2:  # (page 0 is Pearson's cover, page 1 the set's title page)
        ranges["tr"] = (2, coded[0] - 1)
    out = []
    for kind, (a, b) in ranges.items():
        name = f"{f['component']}-{kind}-spec.pdf"
        path = os.path.join(PDF, name)
        if not os.path.exists(path):
            piece = pymupdf.open()
            piece.insert_pdf(doc, from_page=a, to_page=b)
            piece.save(path, garbage=3, deflate=True)
        out.append({**f, "kind": kind, "file": name, "bytes": os.path.getsize(path), "pages": [a, b]})
    return out


def transcript_pages(path):
    """The pages of the transcript bound in at the back of a 1SP0 Listening scheme: (first, last), or None."""
    import pymupdf  # noqa: PLC0415
    doc = pymupdf.open(path)
    for n in range(3, len(doc)):
        if re.search(r"\bTranscript\b", re.sub(r"\s+", " ", doc[n].get_text())[:140]):
            last = len(doc) - 1
            while last > n and (not doc[last].get_text().strip() or "Registered company number" in doc[last].get_text()):
                last -= 1
            return doc, n, last
    return None


def split_transcript(f):
    """A Listening scheme, and its transcript as a file of its own: Pearson publishes 1SP0's only there."""
    found = transcript_pages(os.path.join(PDF, f["file"])) if f["kind"] == "ms" and f["component"][5] == "1" else None
    if not found:
        return [f]
    import pymupdf  # noqa: PLC0415
    doc, a, b = found
    name = f"{f['component']}-tr-{f['series'].lower()}.pdf"
    path = os.path.join(PDF, name)
    if not os.path.exists(path):
        piece = pymupdf.open()
        piece.insert_pdf(doc, from_page=a, to_page=b)
        piece.save(path, garbage=3, deflate=True)
    return [f, {**f, "kind": "tr", "file": name, "bytes": os.path.getsize(path), "pages": [a, b]}]


def main():
    for d in (PDF, AUDIO, CACHE):
        os.makedirs(d, exist_ok=True)
    records = {}
    for q in SEARCHES:
        for r in text(q):
            records[r.get("url", "")] = r
        time.sleep(0.3)
    jobs = {}
    for url, r in records.items():
        if not re.search(r"/GCSE/Spanish/2016/[Ee]xam[- ]materials/", url, re.I):
            continue
        found = parse(os.path.basename(url))
        series = next((c.split("/")[-1] for c in r.get("category", []) if c.startswith("Pearson-UK:Exam-Series/")), None)
        if found and series in SERIES:
            jobs[(found[0], found[1], SERIES[series])] = (url, re.sub(r"\s+", " ", r.get("title", "")).strip())
    for comp, name in SAM_PDFS.items():
        jobs[(comp, "sam", "SPEC")] = (SAMS + name, f"Sample Assessment Materials {comp}")
    for comp, name in SAM_AUDIO.items():
        jobs[(comp, "tracked", "SPEC")] = (SAMS + name, f"Sample Assessment recording {comp}")
    with ThreadPoolExecutor(5) as pool:
        got = dict(zip(jobs, pool.map(curl, [u for u, _ in jobs.values()])))
    manifest, skipped = [], []
    for slot in sorted(jobs):
        comp, what, series = slot
        url, title = jobs[slot]
        path = got[slot]
        head = open(path, "rb").read(4) if path else b""
        if not path or head.startswith(b"<") or head[:2] == b"\n<":
            skipped.append(slot)
            continue
        entry = {"component": comp, "spec": comp[:4].upper(), "series": series, "title": title, "source": BASE + url, "pearsonName": os.path.basename(url)}
        if what in ("qp", "ms", "er", "sam"):
            if head != b"%PDF":
                skipped.append(slot)
                continue
            out = os.path.join(PDF, f"{comp}-{what}-{series.lower()}.pdf")
            if not os.path.exists(out):
                os.link(path, out)
            manifest.append({**entry, "kind": what, "file": os.path.basename(out), "bytes": os.path.getsize(out)})
        else:
            d = os.path.join(AUDIO, f"{comp}-{series}")
            # A tracked zip beats the whole recording, wherever Pearson gives both.
            if what == "whole" and (comp, "tracked", series) in jobs:
                continue
            os.makedirs(d, exist_ok=True)
            if not os.listdir(d):
                if what == "tracked":
                    extract(path, d)
                else:
                    os.link(path, os.path.join(d, "whole.mp3"))
            manifest.append({**entry, "kind": "audio", "tracked": what == "tracked", "tracks": sorted(os.listdir(d)), "file": None})
    manifest = [m for f in manifest for m in (split_sam(f) if f["kind"] == "sam" else split_transcript(f))]
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    by = {}
    for f in manifest:
        by.setdefault(f["series"], {}).setdefault(f["component"], []).append(f["kind"] + (f":{len(f['tracks'])}" if f["kind"] == "audio" else ""))
    for s in sorted(by):
        print(s, {c: " ".join(sorted(k)) for c, k in sorted(by[s].items())}, file=sys.stderr)
    print(f"{len(manifest)} files; not public or missing: {skipped}", file=sys.stderr)


if __name__ == "__main__":
    main()
