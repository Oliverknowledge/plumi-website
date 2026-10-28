"""Cut Pearson Edexcel's GCSE science papers into question parts, each with its mark scheme rows.

    python3 scripts/question-bank/edexcel_gcse/cut_gcse.py [work-dir] [--only=1ph02f-jun24]
    # default work dir: scripts/question-bank/.work/edexcel-gcse

edexcel_sciences/cut_pearson.py does the work: Pearson sets its GCSE papers and schemes as it
does its A-Levels. Two differences are handled here, so no other bank's crops move:
  - some schemes (Physics 2F June 2024) head their tables "Question Answer" on one line, which
    reads here as a "Question" header the width of that word, so the labels under it are found;
  - a question set on both tiers is marked once, its row labelled with both numbers, "8c(i)(F)"
    over "2(ai)(H)": each scheme keeps the number for its own tier.
Writes <work-dir>/img/*.webp and <work-dir>/parts.json, as cut_pearson.py.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-gcse")] + [a for a in sys.argv[1:] if a.startswith("--")]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402

_init, _lines = cp.Doc.__init__, cp.Doc.lines
# A question set on both tiers can be marked once, its row labelled with both numbers: "8c(i)(F)" over "2(ai)(H)".
TIERED = re.compile(r"(.{1,16}?)\s*\(([FH])\)")


def init(self, path):
    _init(self, path)
    m = re.search(r"-[12]([fh])-ms-", os.path.basename(path))
    self.tier = m.group(1).upper() if m else None  # a scheme's own tier


def lines(self, i):
    if i not in self._lines:
        out = []
        for l in _lines(self, i):
            if l["text"] == "Question Answer" and len(l["spans"]) == 1:
                l = {**l, "text": "Question", "x1": l["x0"] + (l["x1"] - l["x0"]) * len("Question") / len("Question Answer")}
            m = TIERED.fullmatch(l["text"].strip()) if self.tier else None
            if m and m.group(2) != self.tier:
                continue  # the other tier's number for this row
            if m:
                l = {**l, "text": m.group(1)}
            out.append(l)
        self._lines[i] = out
    return self._lines[i]


cp.Doc.__init__, cp.Doc.lines = init, lines

if __name__ == "__main__":
    cp.main()
