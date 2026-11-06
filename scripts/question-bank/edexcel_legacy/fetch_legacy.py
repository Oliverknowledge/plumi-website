"""Fetch public UK Edexcel Maths legacy modules from Pearson (2010–2018).

Never use third-party mirrors or teacher-only material. January, June and
regional papers keep separate identities. Existing PDFs are reused.
"""
import argparse
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
MODULES = {"6663": "C1", "6664": "C2", "6665": "C3", "6666": "C4", "6683": "S1", "6677": "M1"}
NAME = re.compile(r"/(\d{4})[_-](\w+)[_-](que|rms|msc|pef)[_-](\d{8})[^/]*\.pdf$", re.I)


def listing(index, first=2010, last=2018):
    files = {}
    for code in MODULES:
        for hit in index[code]:
            url = hit.get("url", "")
            match = NAME.search(url)
            if not re.search(r"/A[ -]Level/Mathematics/", url, re.I) or "exam" not in url.lower():
                continue
            # Schemes/reports are published later; the title identifies the sitting.
            title = hit.get("title", "")
            sitting = re.search(r"\b(January|June|November)\s+(20\d{2})\b", title, re.I)
            if not sitting or not first <= int(sitting[2]) <= last:
                continue
            if match and match[1] == code:
                _, variant, kind, date = match.groups()
                # Pearson's indexed June 2011 C1 QP has a mistyped filename year.
                known_typo = code == "6663" and date == "00110518" and sitting[1].lower() == "june" and sitting[2] == "2011"
                if int(sitting[2]) != int(date[:4]) and not known_typo:
                    continue
            elif f"({code})" in title and url.lower().endswith(".pdf"):
                # Pearson's 2014 files use descriptive names rather than dates.
                variant = "01R" if re.search(r"Paper[- ]1R", title, re.I) else "01"
                kind = "que" if title.lower().startswith("question paper") else "rms" if title.lower().startswith("mark scheme") else "pef" if title.lower().startswith("examiner report") else None
                if kind is None:
                    continue
            else:
                continue
            series = sitting[1][:3].upper() + sitting[2][2:]
            variant = variant.upper()
            component = code if variant == "01" else f"{code}-{variant}"
            slot = (component, {"que": "qp", "rms": "ms", "msc": "ms", "pef": "er"}[kind.lower()], series)
            if slot in files and kind.lower() == "msc":
                continue
            files[slot] = dict(component=component, spec=code, kind=slot[1], series=series,
                               title=title, source="https://qualifications.pearson.com" + url)
    return list(files.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("work", type=Path)
    parser.add_argument("--index", type=Path, help="reuse a saved Pearson index response")
    parser.add_argument("--list-only", action="store_true")
    args = parser.parse_args()
    args.work.mkdir(parents=True, exist_ok=True)
    if args.index:
        index = json.loads(args.index.read_text())
    else:
        # Reuse the board's public-index client without invoking its downloader.
        sys.argv = [sys.argv[0], str(args.work)]
        spec = importlib.util.spec_from_file_location("edexcel_fetch", HERE.parent / "fetch_edexcel.py")
        fetch = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(fetch)
        index = {code: fetch.search(code) for code in MODULES}
    (args.work / "source-index.json").write_text(json.dumps(index))
    files = listing(index)
    (args.work / "listed.json").write_text(json.dumps(files, indent=2))
    print(f"{len(files)} public source records listed", flush=True)
    if args.list_only:
        return
    pdf = args.work / "pdf"
    pdf.mkdir(exist_ok=True)

    def download(record):
        path = pdf / f"EDX-{record['component']}-{record['kind'].upper()}-{record['series']}.pdf"
        if not path.exists():
            request = urllib.request.Request(urllib.parse.quote(record["source"], safe=":/%"),
                                             headers={"User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    body = response.read()
                if not body.startswith(b"%PDF"):
                    return None
                path.write_bytes(body)
            except (OSError, urllib.error.URLError):
                return None
        if not path.read_bytes().startswith(b"%PDF"):
            return None
        return dict(record, file=path.name, bytes=path.stat().st_size)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(download, files))
    manifest = [record for record in results if record]
    (args.work / "manifest.json").write_text(json.dumps(manifest, indent=2))
    failed = [record for record, result in zip(files, results) if result is None]
    (args.work / "unavailable.json").write_text(json.dumps(failed, indent=2))
    print(f"{len(manifest)} PDFs available; {len(failed)} unavailable", flush=True)


if __name__ == "__main__":
    main()
