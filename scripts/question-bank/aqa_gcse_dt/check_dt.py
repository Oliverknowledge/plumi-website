"""Check the cut GCSE Design and Technology questions for what a reader would miss.

    python3 scripts/question-bank/aqa_gcse_dt/check_dt.py [work-dir]   # default scripts/question-bank/.work/aqa-gcse-dt

Lists each part that names a figure or table its crop and stem don't print (add it to cut_dt.py's SHARED), and
one that speaks of a picture or answer space it may not have ("shown above", "the diagram", "drawing below").
"""
import glob, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cut_dt  # noqa: E402  (reads the work dir from argv and patches cut.py; must come first)
import pymupdf  # noqa: E402

cut = cut_dt.cut
NAME = re.compile(r"\b(?:Figure|Table)s? \d+(?: and \d+)?")
SOFT = re.compile(r"\b(?:shown|above|below|opposite|diagram|drawing|photograph|image|picture)\b", re.I)


def own_lines(doc, pieces):
    return [t for pg, r in pieces for y, x, t in cut.text_lines(doc[pg], r)]


def main():
    for path in sorted(glob.glob(os.path.join(cut.WORK, "pdf", "*-QP-*.pdf"))):
        doc = pymupdf.open(path)
        out = cut.regions(doc, 75, True, True)
        stems = {key[0]: own_lines(doc, pieces) for key, pieces, _ in out if key[1] is None}
        for key, pieces, _ in out:
            if key[1] is None and any(k[0] == key[0] and k[1] for k, _, _ in out):
                continue
            lines = own_lines(doc, pieces)
            stem = stems.get(key[0], []) if key[1] else []
            printed = {t for t in lines + stem if re.fullmatch(r"(?:Figure|Table) \d+.{0,60}", t)}
            printed = {re.match(r"(?:Figure|Table) \d+", t).group() for t in printed}
            said = {m for t in lines for m in NAME.findall(t)}
            for name in said:
                nums = re.findall(r"\d+", name)
                kind = name.split()[0].rstrip("s")
                for n in nums:
                    if f"{kind} {n}" not in printed:
                        print(f"{os.path.basename(path)[11:-4]} {'.'.join(k for k in key if k)}: names {kind} {n}, not printed: {' '.join(lines)[:110]}")
            if not said and not stem and key[1] and any(SOFT.search(t) for t in lines):
                print(f"   soft {os.path.basename(path)[11:-4]} {'.'.join(k for k in key if k)}: {' '.join(lines)[:110]}")


if __name__ == "__main__":
    main()
