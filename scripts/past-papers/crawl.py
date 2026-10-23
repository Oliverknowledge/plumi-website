"""Read Physics & Maths Tutor's past paper listings for Maths, Further Maths,
Biology, Chemistry and Physics (GCSE, IGCSE and A-Level).

    python3 scripts/past-papers/crawl.py [cache-dir]   # default scripts/past-papers/.cache

Fetches each subject index, then every paper page it links to, one request at a
time with a pause between them. Pages are cached in the cache dir, so a re-run
is free; delete it to pick up a new exam series. Writes <cache-dir>/leaves.json, which build.py turns into
src/content/pastPapers.json. Downloads no PDFs: the site links to PMT's copies.
"""
import hashlib, html, json, os, re, sys, time, urllib.request

BASE = "https://www.physicsandmathstutor.com"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36"
ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
CACHE = os.path.join(ROOT, "cache")
os.makedirs(CACHE, exist_ok=True)

INDEXES = [
    "/past-papers/a-level-biology/",
    "/past-papers/a-level-chemistry/",
    "/past-papers/a-level-physics/",
    "/past-papers/gcse-biology/",
    "/past-papers/gcse-chemistry/",
    "/past-papers/gcse-physics/",
    "/past-papers/gcse-maths/",
    "/a-level-maths-papers/",
]
# Third-party practice sets, solution banks and notes are not past papers.
SKIP = re.compile(r"delphis|bronze-silver-gold|practice|iygb|solomon|elmwood|solutionbank|by-topic|maths-revision/a-level-(core|statistics|mechanics|further-pure|decision)-\d")


def fetch(url):
    key = hashlib.sha1(url.encode()).hexdigest()
    path = os.path.join(CACHE, key + ".html")
    if os.path.exists(path):
        return open(path, encoding="utf-8").read()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode("utf-8", "replace")
                final = r.geturl()
            break
        except Exception as e:  # noqa: BLE001
            print("  retry", url, e, file=sys.stderr)
            time.sleep(3)
    else:
        return ""
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)
    time.sleep(0.6)
    return body


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def content(h):
    # Start after the tutor advert, whose name and university are h4/h5 headings too.
    i = h.find('class="post-entry"')
    if i < 0:
        i = h.find("entry-title")
    j = h.find("Connect with PMT")
    return h[i: j if j > 0 else len(h)]


# No <p> token: PMT wraps whole link grids in an unclosed <p>, which would swallow them.
TOKEN = re.compile(r"<(h[1-6])[^>]*>(.*?)</\1>|<a[^>]+href=\"([^\"]+)\"[^>]*>(.*?)</a>", re.S)


def tokens(h):
    for m in TOKEN.finditer(content(h)):
        if m.group(1):
            yield ("h", m.group(1), text(m.group(2)))
        else:
            yield ("a", html.unescape(m.group(3)), text(m.group(4)))


def norm(href, page):
    href = href.strip()
    if href.startswith("#") or href.startswith("mailto:"):
        return None
    if href.startswith("http"):
        u = href
    elif href.startswith("/"):
        u = BASE + href
    else:
        u = page.rsplit("/", 1)[0] + "/" + href
    u = u.replace("/A-level-maths-papers/", "/a-level-maths-papers/")
    return u


def index_links(url):
    h = fetch(url)
    out, ctx = [], {"h3": "", "h4": "", "h5": ""}
    for kind, tag, val in tokens(h):
        if kind == "h" and tag in ("h3", "h4", "h5"):
            if tag == "h3":
                ctx = {"h3": val, "h4": "", "h5": ""}
            elif tag == "h4":
                ctx.update(h4=val, h5="")
            else:
                ctx["h5"] = val
        elif kind == "a":
            u = norm(tag, url)
            if not u or "physicsandmathstutor.com" not in u or u.startswith("https://pmt."):
                continue
            if "pmt.education" in u or "tutor-profile" in u or SKIP.search(u):
                continue
            if not ("/past-papers/" in u or "/a-level-maths-papers/" in u or "/maths-revision/" in u):
                continue
            if u.rstrip("/") == url.rstrip("/"):
                continue
            out.append({"url": u if u.endswith("/") else u + "/", "label": val, **ctx})
    return out


def parse_leaf(url):
    h = fetch(url)
    m = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
    intro = re.search(r"<p>(You can find[^<]*)</p>", h)
    leaf = {"url": url, "h1": text(m.group(1)) if m else "", "intro": text(intro.group(1)) if intro else "", "sections": [], "children": []}
    sec = {"h4": "", "h5": "", "links": []}
    for kind, tag, val in tokens(h):
        if kind == "h" and tag in ("h4", "h5", "h3"):
            if tag == "h5" and val.endswith(")") and "University" in val:
                continue
            if sec["links"]:
                leaf["sections"].append(sec)
            if tag in ("h3", "h4"):
                sec = {"h4": val, "h5": "", "links": []}
            else:
                sec = {"h4": sec["h4"], "h5": val, "links": []}
        elif kind == "a":
            u = norm(tag, url)
            if not u:
                continue
            if u.lower().endswith(".pdf") and u.startswith("https://pmt.physicsandmathstutor.com/"):
                sec["links"].append({"label": val, "href": u})
            elif "video-solutions" in u:
                sec["links"].append({"label": val, "href": u, "video": True})
            elif ("/past-papers/" in u or "/a-level-maths-papers/" in u) and u.startswith(BASE) and not SKIP.search(u):
                leaf["children"].append(u)
    if sec["links"]:
        leaf["sections"].append(sec)
    return leaf


def main():
    entries = []
    for idx in INDEXES:
        links = index_links(BASE + idx)
        print(idx, len(links), "links", file=sys.stderr)
        for l in links:
            l["index"] = idx
        entries.extend(links)
    seen, leaves = set(), []
    for e in entries:
        if e["url"] in seen:
            continue
        seen.add(e["url"])
        leaf = parse_leaf(e["url"])
        leaf.update(index=e["index"], label=e["label"], h3=e["h3"], h4=e["h4"], h5=e["h5"])
        n = sum(len(s["links"]) for s in leaf["sections"])
        print(f"{n:4d} {e['url']}", file=sys.stderr)
        leaves.append(leaf)
    json.dump(leaves, open(os.path.join(ROOT, "leaves.json"), "w"), indent=1)
    print("leaves", len(leaves), "pdfs", sum(len(s["links"]) for l in leaves for s in l["sections"]), file=sys.stderr)


if __name__ == "__main__":
    main()
