"""What the question bank already has, so nobody has to ask a session "if you haven't already".

    npm run bank:status                     # every bank, by board and level, with the totals
    npm run bank:status -- ocr economics    # the banks matching all those words, and open PRs that mention them
    npm run bank:status -- --check          # are the metas sound, with notes? exits 1 if not (CI runs this)

It reads this checkout's src/content/questionBank/*.json, so a stale checkout gives a
stale answer: it says when the checkout is behind origin/main as last fetched. Open PRs come from `gh`,
and are skipped with a note where it isn't available. Needs nothing installed.
"""
import glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
META = os.path.join(ROOT, "src", "content", "questionBank")
TYPES = os.path.join(ROOT, "src", "content", "questionBank.ts")
NOTES = os.path.join(ROOT, "docs", "question-bank", "banks")
REQUIRED = ("slug", "board", "level", "subject", "topics", "papers", "series", "count")
args = [a for a in sys.argv[1:] if not a.startswith("--")]


def metas():
    """Each bank's meta. The folder also holds lists that aren't banks, which have no slug."""
    out = {}
    for path in sorted(glob.glob(os.path.join(META, "*.json"))):
        meta = json.load(open(path))
        if isinstance(meta, dict) and "slug" in meta:
            out[os.path.basename(path)[:-5]] = meta
    return out


def allowed(field):
    """The values questionBank.ts's BankSubject allows for a field. Importing a meta doesn't check them."""
    return set(re.findall(r'"([^"]+)"', re.search(rf'^  {field}: (.+);$', open(TYPES).read(), re.M).group(1)))


def with_notes():
    """The banks with notes: a file named for the bank, or one listing it on its "Banks:" line."""
    out = set()
    for path in glob.glob(os.path.join(NOTES, "*.md")):
        out.add(os.path.basename(path)[:-3])
        for line in open(path, encoding="utf8"):
            if line.startswith("Banks: "):
                out.update(re.findall(r"`([^`]+)`", line))
    return out


def problems(banks):
    boards, levels, notes = allowed("board"), allowed("level"), with_notes()
    out = []
    for file, meta in banks.items():
        slug = meta["slug"]
        if slug != file:
            out.append(f"{file}.json: its slug says {slug}")
        for key in REQUIRED:
            if not meta.get(key):
                out.append(f"{slug}: no {key}")
        if meta.get("board") not in boards:
            out.append(f"{slug}: board {meta.get('board')} isn't one questionBank.ts knows")
        if meta.get("level") not in levels:
            out.append(f"{slug}: level {meta.get('level')} isn't one questionBank.ts knows")
        if not (meta.get("data") or {}).get("parts"):
            out.append(f"{slug}: no data hashes, so `next build` stops at its topic pages (run upload_data.py {slug})")
        if slug not in notes:
            out.append(f"{slug}: no notes (write docs/question-bank/banks/{slug}.md)")
    return out


def words(text):
    return set(re.sub(r"[^a-z0-9]+", " ", str(text).lower()).split())


def line(meta):
    years = meta.get("scope") or f"{meta.get('firstYear', '?')}-{meta.get('lastYear', '?')}"
    return f"  {meta['slug']:<52} {meta.get('count', 0):>7,} parts  {years}"


def behind():
    try:
        n = subprocess.run(["git", "rev-list", "--count", "HEAD..origin/main"], cwd=ROOT, capture_output=True, text=True, timeout=20).stdout.strip()
        return int(n or 0)
    except (OSError, subprocess.SubprocessError, ValueError):
        return 0


def open_prs(query):
    """Open PRs whose title or branch has all the words: a bank someone is already building."""
    try:
        r = subprocess.run(["gh", "pr", "list", "--state", "open", "--limit", "100", "--json", "number,title,headRefName,isDraft,url"],
                           cwd=ROOT, capture_output=True, text=True, timeout=30)
        if r.returncode:
            raise OSError(r.stderr.strip())
        return [p for p in json.loads(r.stdout) if query <= words(p["title"]) | words(p["headRefName"])]
    except (OSError, subprocess.SubprocessError, ValueError) as e:
        print(f"(open PRs not checked: {e})")
        return []


def main():
    banks = metas()
    if "--check" in sys.argv:
        found = problems(banks)
        for p in found:
            print(p)
        print(f"{len(banks)} banks: {len(found)} problem{'' if len(found) == 1 else 's'}")
        sys.exit(1 if found else 0)

    late = behind()
    if late:
        print(f"This checkout is {late} commits behind origin/main, so a bank merged since isn't counted.\n")
    if args:
        query = words(" ".join(args))
        match = [m for m in banks.values() if query <= words(f"{m['board']} {m['level']} {m['subject']} {m['slug']} {' '.join(map(str, m.get('specs') or []))}")]
        print(f"Live on this checkout: {len(match)} matching \"{' '.join(args)}\"")
        for meta in match:
            print(line(meta))
        prs = open_prs(query)
        print(f"Open PRs: {len(prs)}")
        for p in prs:
            print(f"  #{p['number']}{' (draft)' if p['isDraft'] else ''} {p['title']}  {p['url']}")
        return

    groups = {}
    for meta in banks.values():
        groups.setdefault((meta["board"], meta["level"]), []).append(meta)
    for (board, level), group in sorted(groups.items()):
        print(f"{board} {level}: {len(group)}")
        for meta in sorted(group, key=lambda m: m["slug"]):
            print(line(meta))
    print(f"\n{len(banks)} banks, {sum(m.get('count') or 0 for m in banks.values()):,} question parts")


if __name__ == "__main__":
    main()
