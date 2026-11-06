"""Download the MadAsMaths booklets from the shared Google Drive folder.

    python3 scripts/booklets/fetch.py [work-dir]   # default scripts/booklets/.work

The booklets are MadAsMaths' own (madasmaths.com), hosted here with permission (6 November 2026): free and open, with
a note that they're from MadAsMaths and a link to its site. The copy we were given is a Google Drive folder,
"Madas Maths booklets" (1NZIl94mXVGrC3bBCKWDPLa6lhfgDh8AA), shared by link; drive-files.json lists its PDFs
(folder, file name, Drive id, size), read from the folder on 6 November 2026.

Writes <work-dir>/pdf/<folder>/<file>, unmodified, and checks each against the size Drive reports. Files Drive
won't scan for viruses (large ones) answer with a confirmation page first; its form is followed. Cached: a file
already there at the right size isn't fetched again.
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, ".work")
URL = "https://drive.usercontent.google.com/download?id={}&export=download"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=600) as r:
        return r.read()


def fetch(row):
    dest = os.path.join(WORK, "pdf", row["folder"], row["file"])
    if os.path.exists(dest) and os.path.getsize(dest) == row["bytes"]:
        return "cached"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(4):
        try:
            body = get(URL.format(row["id"]))
            if not body.startswith(b"%PDF"):  # "Google Drive can't scan this file for viruses": follow its form
                page = body.decode("utf-8", "replace")
                form = re.search(r'<form[^>]+action="([^"]+)"', page)
                fields = dict(re.findall(r'<input type="hidden" name="([^"]+)" value="([^"]*)"', page))
                if not form:
                    raise ValueError("neither a PDF nor a confirmation page")
                body = get(html.unescape(form.group(1)) + "?" + urllib.parse.urlencode(fields))
            if not body.startswith(b"%PDF") or len(body) != row["bytes"]:
                raise ValueError(f"got {len(body)} bytes, expected {row['bytes']}")
            open(dest + ".part", "wb").write(body)
            os.replace(dest + ".part", dest)
            return "fetched"
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(2 ** attempt)
    return f"FAILED {err}"


def main():
    rows = json.load(open(os.path.join(HERE, "drive-files.json")))
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(fetch, rows))
    for row, res in zip(rows, results):
        if res.startswith("FAILED"):
            print(f"  {row['folder']}/{row['file']}: {res}", file=sys.stderr)
    counts = {k: sum(r.split()[0] == k for r in results) for k in ("fetched", "cached", "FAILED")}
    print(f"{len(rows)} files: {counts}", file=sys.stderr)
    sys.exit(1 if counts["FAILED"] else 0)


if __name__ == "__main__":
    main()
