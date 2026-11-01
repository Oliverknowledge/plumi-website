"""Fetch AQA's own A-Level and AS French (7652, 7651) and Spanish (7692, 7691) papers, and their listening audio.

    python3 scripts/question-bank/aqa_languages/fetch_languages.py [work-dir] [--audio]   # default scripts/question-bank/.work/aqa-languages

--audio fetches only the recordings (the papers' file-store checks take minutes).

The A-Level fetcher (fetch_aqa.py) run over the four specifications: the same two sources (each
specification's assessment-resources page, then AQA's file store for older series), the same
file names and the same <work-dir>/manifest.json. Paper 1 (Listening, Reading and Writing) prints
its reading texts in the question paper and sometimes an insert; Paper 2 (Writing) is the set
texts and films. Paper 3 (Speaking) is left out.

Paper 1's listening section is played from a recording, which AQA publishes beside the paper:
"SF-TRACKED" zips (one MP3 per question) and the transcript ("TR"). Both are fetched to
<work-dir>/audio/<component>-<series>/ and <work-dir>/pdf/, so each listening question can carry
its own track. June 2017 to June 2019 are no longer on AQA's site; the file store is tried for
them all the same, so a re-run picks them up if AQA restores them.
"""
import io, json, os, re, sys, time, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO_ONLY = "--audio" in sys.argv
rest = [a for a in sys.argv[1:] if a != "--audio"]
sys.argv[1:] = [os.path.abspath(rest[0]) if rest else os.path.join(HERE, "..", ".work", "aqa-languages")]
sys.path.insert(0, os.path.dirname(HERE))
import fetch_aqa  # noqa: E402

fetch_aqa.PAGES = [
    "https://www.aqa.org.uk/subjects/french/a-level/french-7652/assessment-resources",
    "https://www.aqa.org.uk/subjects/french/as-level/french-7651/assessment-resources",
    "https://www.aqa.org.uk/subjects/spanish/a-level/spanish-7692/assessment-resources",
    "https://www.aqa.org.uk/subjects/spanish/as-level/spanish-7691/assessment-resources",
]
fetch_aqa.COMPONENTS = {"7651": ["76511", "76512"], "7652": ["76521", "76522"], "7691": ["76911", "76912"], "7692": ["76921", "76922"]}
# First sat in June 2017 (AS in June 2016); June 2020 and 2021 were cancelled.
fetch_aqa.SERIES = ["JUN16", "JUN17", "JUN18", "JUN19", "NOV20", "NOV21", "JUN22", "JUN23", "JUN24", "JUN25"]
fetch_aqa.KINDS = {**fetch_aqa.KINDS, "TR": "tr"}
SPOKEN = re.compile(r"^AQA-(\d{5})-SF-TRACKED-(JUN|NOV)(\d{2})\.ZIP$", re.I)
WHOLE = re.compile(r"^AQA-(\d{5})-SF-(?:UNTRACKED-)?(JUN|NOV)(\d{2})\.MP3$", re.I)
_parse = fetch_aqa.parse_name


def parse_name(name):
    """Speaking (Paper 3) and the specimens are left out. Spanish June 2024 Paper 1's scheme and
    report carry their own names ("AQA-7692-1-Final-MS-Jun24-v2.0.pdf"); the transcript is "TR"."""
    n = name.upper()
    m = re.match(r"AQA-(\d{4})-([12])-(?:FINAL-)?(MS|WRE)-(JUN|NOV)(\d{2})", n)
    if m:
        return m.group(1) + m.group(2), fetch_aqa.KINDS[m.group(3)], m.group(4) + m.group(5), False
    m = re.match(r"AQA-(\d{5})-TR-(JUN|NOV)(\d{2})\.PDF$", n)
    if m and "MQP" not in n:
        return m.group(1), "tr", m.group(2) + m.group(3), False
    key = _parse(name)
    if not key or key[0][4] == "3" or key[2] == "SPEC":
        return None
    return key


def audio():
    """Each Paper 1 sitting's tracked recording, unzipped to <work-dir>/audio/<component>-<series>/.
    November 2020 was published only untracked, as one MP3: saved as untracked.mp3 there, for
    audio_languages.py to split at its silences."""
    out = os.path.join(fetch_aqa.WORK, "audio")
    found, whole = {}, {}
    for page in fetch_aqa.PAGES:
        html, _ = fetch_aqa.get(page)
        for m in re.finditer(r'"originalFilename":"([^"]+)","path":"[^"]+","sha1hash":"[^"]+","size":(\d+),"uploadId":"[^"]+","url":"([^"]+)"', (html or "").replace('\\"', '"')):
            k = SPOKEN.match(m.group(1))
            if k:
                found[f"{k.group(1)}-{k.group(2).upper()}{k.group(3)}"] = m.group(3)
            k = WHOLE.match(m.group(1))
            if k:
                whole[f"{k.group(1)}-{k.group(2).upper()}{k.group(3)}"] = m.group(3)
        time.sleep(1)
    for key, url in sorted(whole.items()):
        d = os.path.join(out, key)
        if key in found or (os.path.isdir(d) and os.listdir(d)):
            continue
        body, _ = fetch_aqa.get(url, binary=True)
        if body:
            os.makedirs(d, exist_ok=True)
            open(os.path.join(d, "untracked.mp3"), "wb").write(body)
            found[key] = url
    listing = []
    for key, url in sorted(found.items()):
        d = os.path.join(out, key)
        if not os.path.isdir(d) or not os.listdir(d):
            body, _ = fetch_aqa.get(url, binary=True)
            if not body:
                print("  failed", url, file=sys.stderr)
                continue
            os.makedirs(d, exist_ok=True)
            with zipfile.ZipFile(io.BytesIO(body)) as z:
                for info in z.infolist():
                    if info.filename.lower().endswith(".mp3") and not info.filename.startswith("__MACOSX"):
                        with open(os.path.join(d, os.path.basename(info.filename)), "wb") as fh:
                            fh.write(z.read(info))
            time.sleep(0.5)
        listing.append({"set": key, "source": url, "tracks": sorted(os.listdir(d))})
    json.dump(listing, open(os.path.join(fetch_aqa.WORK, "audio.json"), "w"), indent=1)
    print(f"{len(listing)} recordings in {out}", file=sys.stderr)


fetch_aqa.parse_name = parse_name

if __name__ == "__main__":
    if not AUDIO_ONLY:
        fetch_aqa.main()
    audio()
