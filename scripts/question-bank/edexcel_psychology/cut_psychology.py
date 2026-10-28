"""Cut Pearson Edexcel's Psychology papers: cut_pearson.py --extracts --figures, with one change of its own.

    python3 scripts/question-bank/edexcel_psychology/cut_psychology.py [work-dir] [--only=9ps001-jun24]

From 2024 Pearson prints the formulae and statistical tables (Spearman's, Mann-Whitney,
chi-squared critical values) at the front of the paper, before Question 1, and a "1" in a
table row read as the first question: Question 1's card held the tables. A page of those
tables with no question on it is taken as blank, here only, so no other bank's crops move.
--figures (Geography's mode) brings its fixes Psychology needs too: a scheme's page number
("13" at the foot of a page) is never read as a question's row, so no scheme is another
question's (15 were), levels grids keep their "0 No rewardable material" row, and a table to
complete printed under a part's marks stays in its crop. Psychology has no Resource Booklet,
so the rest of that mode does nothing here.
The patch is at the top level, so cut_pearson's worker processes (which re-run this file)
have it too.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
sys.argv[1:] = [os.path.abspath(args[0]) if args else os.path.join(HERE, "..", ".work", "edexcel-psychology"), "--extracts", "--figures", *[f for f in flags if f not in ("--extracts", "--figures")]]
sys.path.insert(0, os.path.join(HERE, "..", "edexcel_sciences"))
import cut_pearson as cp  # noqa: E402

TABLES = re.compile(r"Critical values for|Statistical tables|Formulae and statistical tables", re.I)
_blank = cp.Doc.blank


def blank(self, i):
    t = self.text(i)
    return _blank(self, i) or (bool(TABLES.search(t)) and not re.search(r"Total for Question", t, re.I))


cp.Doc.blank = blank

if __name__ == "__main__":
    cp.main()
