"""Is a new public address for the bucket ready to take the site's traffic? Read-only, about 50 requests.

    python3 scripts/question-bank/check_papers_host.py https://papers.example.com

Run before NEXT_PUBLIC_PAPERS_URL moves to the address (docs/question-bank-domain.md). For a crop, a bank's data
file, a whole paper and a recording, it compares the address with r2.dev and checks that:
  - the bytes and the type are the same, and a range request works (the audio player and PDF viewers send them)
  - each of the site's origins gets its own CORS answer, also from the cache: the data is read with fetch(), and a
    plain <img> (no Origin) asks for the same crops
  - the second ask is a cache HIT, a new ?v= is not served as the old one's entry, and a missing file is a plain 404
  - the clients that are not browsers get through: the build (node), the upload scripts and Discord's image proxy
Exits 1 if anything failed. Pointed at r2.dev itself, the cache checks fail, as they should: it has no cache.
"""
import gzip, json, os, sys, time, urllib.error, urllib.request

from papers_url import R2_DEV_URL

HERE = os.path.dirname(os.path.abspath(__file__))
META = os.path.join(HERE, "..", "..", "src", "content", "questionBank")
BROWSER = "Mozilla/5.0"
ORIGINS = ["https://tryplumi.app", "https://study.tryplumi.app"]
failed = 0


def ask(url, origin=None, agent=BROWSER, range_=None):
    """(status, headers, body); r2.dev is asked gently, the limit it rate-limits at is the reason for the move."""
    time.sleep(0.15)
    head = {"User-Agent": agent, "Accept-Encoding": "gzip"}
    if origin:
        head["Origin"] = origin
    if range_:
        head["Range"] = range_
    req = urllib.request.Request(url, headers=head)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            return r.status, r.headers, gzip.decompress(body) if r.headers.get("Content-Encoding") == "gzip" else body
    except urllib.error.HTTPError as e:
        return e.code, e.headers, b""


def check(ok, what, detail=""):
    global failed
    failed += not ok
    print(f"  {'ok  ' if ok else 'FAIL'} {what}{f'  ({detail})' if detail and not ok else ''}")


def sample():
    """One of each kind of file, read from a bank's own meta so they all exist."""
    m = json.load(open(os.path.join(META, "aqa-gcse-spanish.json")))
    part = m["sample"][0]
    return {
        "crop": f"bank/{part['id']}-qp.webp",
        "data": f"bank-data/{m['slug']}/parts.{m['data']['parts']}.json",
        "paper": next(iter(m["wholes"].values()))["qp"],
        "audio": part["au"],
    }


def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
        sys.exit(__doc__)
    base = sys.argv[1].rstrip("/")
    files = sample()
    big = {"audio", "paper"}
    for kind, key in files.items():
        url, ref = f"{base}/{key}", f"{R2_DEV_URL}/{key}"
        print(f"{kind}: {key}")
        rng = "bytes=0-1023" if kind in big else None
        got, want = ask(url, range_=rng), ask(ref, range_=rng)
        check(got[0] == want[0] and got[0] in (200, 206), "answers as r2.dev does", f"{got[0]} vs {want[0]}")
        check(got[2] == want[2], "same bytes")
        check(got[1].get("Content-Type") == want[1].get("Content-Type"), "same type", f"{got[1].get('Content-Type')} vs {want[1].get('Content-Type')}")
        if kind in big:
            check(got[0] == 206, "range request gives a part", str(got[0]))
        again = ask(url, range_=rng)
        check(again[1].get("cf-cache-status") == "HIT", "second ask comes from the cache", str(again[1].get("cf-cache-status")))
        check("max-age=31536000" in (again[1].get("Cache-Control") or ""), "kept a year in browsers", str(again[1].get("Cache-Control")))
        for origin in ORIGINS:
            ask(url, origin, range_=rng)   # fill the cache for this origin
            s, h, _ = ask(url, origin, range_=rng)
            allowed = h.get("Access-Control-Allow-Origin")
            check(allowed in (origin, "*"), f"CORS for {origin}, from the cache", f"{s} {allowed} {h.get('cf-cache-status')}")

    crop = f"{base}/{files['crop']}"
    print("around the crop:")
    plain, versioned = ask(crop), ask(f"{crop}?v=99{int(time.time())}")
    check(versioned[0] == 200 and versioned[2] == plain[2], "a new ?v= finds the file")
    check(versioned[1].get("cf-cache-status") in ("MISS", "EXPIRED", "REVALIDATED", "DYNAMIC"), "a new ?v= is its own cache entry", str(versioned[1].get("cf-cache-status")))
    check(ask(f"{base}/bank/no-such-crop-{int(time.time())}.webp")[0] == 404, "a missing file is a 404")
    for agent in ["node", "plumi-upload-data", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"]:
        check(ask(crop, agent=agent)[0] == 200, f"lets in {agent.split(';')[-2].strip() if ';' in agent else agent}")

    print(f"\n{'NOT READY: ' + str(failed) + ' failed' if failed else 'Ready.'}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
