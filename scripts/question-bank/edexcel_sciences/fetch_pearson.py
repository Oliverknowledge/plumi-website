"""Fetch Pearson Edexcel's own A-Level Biology A, Biology B, Chemistry and Physics papers.

    python3 scripts/question-bank/edexcel_sciences/fetch_pearson.py [work-dir]
    # default work dir: scripts/question-bank/.work/edexcel-sciences

Source: Pearson's past paper search (qualifications.pearson.com), whose search
service lists every question paper, mark scheme, examiner report and pre-release
scientific article for a specification. Pearson keeps the most recent series for
teachers only, so those files come back as a page rather than a PDF and are skipped.

Downloads each file unmodified to <work-dir>/pdf/<component>-<kind>-<series>.pdf and writes
<work-dir>/manifest.json, in the same shape as fetch_aqa.py's: component
("9ch0-01"), kind (qp, ms, er, ins), series ("JUN23"), title, source. Polite: one
request at a time, cached, so a re-run fetches only what is missing.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, "..", ".work", "edexcel-sciences")
PDF = os.path.join(WORK, "pdf")
os.makedirs(PDF, exist_ok=True)

BASE = "https://qualifications.pearson.com"
SPECS = ["al15-biology-a", "al15-biology-b", "al15-chemistry", "al15-physics"]
CODES = {"al15-biology-a": ("8bn0", "9bn0"), "al15-biology-b": ("8bi0", "9bi0"), "al15-chemistry": ("8ch0", "9ch0"), "al15-physics": ("8ph0", "9ph0")}
DOC_TYPES = {"Question-paper": "qp", "Mark-scheme": "ms", "Examiner-report": "er", "Scientific-article": "ins"}
MONTHS = {"June": "JUN", "October": "OCT", "November": "NOV"}
# 9ch0-01-que-20230613.pdf, 9CH0_01_que_20190605.pdf, "Scientific Article-Paper 3 (9BN0_03)-June 2017.pdf"
NAME = re.compile(r"([89](?:bn|bi|ch|ph)0)[-_ ]?(\d{2})(?!\d)", re.I)


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
                return body if binary else body.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return None
            time.sleep(2)
        except Exception:  # noqa: BLE001
            time.sleep(2)
    return None


def listed(spec):
    types = "+OR+".join(f'category:"Pearson-UK:Document-Type/{t}"' for t in DOC_TYPES)
    q = f'fq={types}&fq=category:"Pearson-UK:Specification-Code/{spec}"'
    url = f"{BASE}/services/pearson/algolia/GET.servlet?" + urllib.parse.quote(q, safe="=&+:")
    body = get(url)
    return json.loads(body)["searchResults"]["algoliaRecords"] if body else []


def main():
    files = {}
    for spec in SPECS:
        records = listed(spec)
        print(f"{spec}: {len(records)} documents listed", file=sys.stderr)
        for r in records:
            cats = r.get("category", [])
            kind = next((DOC_TYPES[c.split("/")[-1]] for c in cats if c.startswith("Pearson-UK:Document-Type/") and c.split("/")[-1] in DOC_TYPES), None)
            series = next((c.split("/")[-1] for c in cats if c.startswith("Pearson-UK:Exam-Series/")), None)
            name = os.path.basename(r.get("url", ""))
            m = NAME.search(name)
            if not m and series:
                # A few files carry no code in their name ("a-level-chemistry-Mark-Scheme-Paper-1.pdf");
                # the title says which paper, and in June 2016 only AS was sat.
                t = re.search(r"\b(AS|A ?level)?\s*Paper (\d)\b", r.get("title", ""), re.I)
                if t and (t.group(1) or series == "June-2016"):
                    level = 0 if series == "June-2016" or (t.group(1) or "").upper() == "AS" else 1
                    m = re.match(r"(\w+)-(\d+)", f"{CODES[spec][level]}-0{t.group(2)}")
            if not (kind and series and m and name.lower().endswith(".pdf")):
                continue  # the endorsement report, modified papers and the like
            # Pearson's search sometimes files a document under the wrong type (a 2016 mark
            # scheme as a question paper); its file name says what it is.
            named = re.search(r"[-_](que|rms|msc|pef|sca)[-_]", name.lower())
            if named:
                kind = {"que": "qp", "rms": "ms", "msc": "ms", "pef": "er", "sca": "ins"}[named.group(1)]
            mon, year = series.split("-")
            code = MONTHS[mon] + year[2:]
            comp = f"{m.group(1).lower()}-{m.group(2)}"
            slot = (comp, kind, code)
            if slot in files:
                continue
            files[slot] = {"component": comp, "spec": m.group(1).upper(), "kind": kind, "series": code,
                           "title": re.sub(r"\s+", " ", r.get("title", "")).strip(), "source": BASE + r["url"], "pearsonName": name}
        time.sleep(1)
    manifest, restricted = [], 0
    # A cached file whose slot now points at a different Pearson file is stale.
    old_path = os.path.join(WORK, "manifest.json")
    before = {f["file"]: f["pearsonName"] for f in json.load(open(old_path))} if os.path.exists(old_path) else {}
    for slot, f in sorted(files.items()):
        out = os.path.join(PDF, f"{f['component']}-{f['kind']}-{f['series'].lower()}.pdf")
        if os.path.exists(out) and before.get(os.path.basename(out), f["pearsonName"]) != f["pearsonName"]:
            os.remove(out)
        if not os.path.exists(out):
            body = get(f["source"], binary=True)
            if not body or not body.startswith(b"%PDF"):
                restricted += 1
                continue
            with open(out, "wb") as fh:
                fh.write(body)
            time.sleep(0.4)
        f["file"] = os.path.basename(out)
        f["bytes"] = os.path.getsize(out)
        manifest.append(f)
    keep = {f["file"] for f in manifest}
    for name in os.listdir(PDF):
        if name not in keep:
            os.remove(os.path.join(PDF, name))  # filed under a slot it no longer belongs to
    json.dump(manifest, open(os.path.join(WORK, "manifest.json"), "w"), indent=1)
    print(f"{len(manifest)} files, {sum(f['bytes'] for f in manifest) / 1e6:.0f} MB in {PDF}; "
          f"{restricted} not public (teachers only, or missing)", file=sys.stderr)


if __name__ == "__main__":
    main()
