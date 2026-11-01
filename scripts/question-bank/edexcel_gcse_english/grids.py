"""What cut_language.py and cut_literature.py change in edexcel_sciences/cut_pearson.py's reading, so no other bank's crops move.

English schemes set each question's levels grid in the table under its indicative content, a row a level: the
level's number ("0", "1" to "5") sits in the "Question Number" column, where ms_tables reads it as the next
question's label, so the question's row stopped at "0 | No rewardable material" and lost its levels. A lone digit
with a mark range ("1–4") or "No rewardable material" beside it, or "Level" over it, is a grid's, and is left out of the scheme's lines.
(cut_pearson skips only the "0" row, and only for geography's --figures.)

Literature's schemes until 2020 print a number with a full stop, and the text's name on the same line: "9.", "11. Blood"
(over "Brothers"), or November 2020's "8 An" (over "Inspector"). In a scheme the number is read as the label, "9", and the name stays a line of its own beside it.
"""
import os, re

GRID_ROW = re.compile(r"No rewardable material|^\d{1,2}\s*[–‒-]+\s*\d{1,2}\b", re.I)
DOTTED = re.compile(r"^(\d{1,2})(?:\.|\s+(?=[A-Z]))\s*(\S.*)?$")


def patch(cp):
    _lines = cp.Doc.lines

    def lines(self, i):
        if i not in self._lines:
            raw = _lines(self, i)
            if "-ms-" in os.path.basename(self.doc.name):
                raw = [x for l in raw for x in dotted(l)]
            self._lines[i] = [l for l in raw if not (re.fullmatch(r"\d", l["text"]) and any(
                o is not l and (abs(o["y0"] - l["y0"]) < 5 and o["x0"] > l["x0"] and GRID_ROW.search(o["text"])
                or o["text"] == "Level" and 0 < l["y0"] - o["y0"] < 16 and abs(o["x0"] - l["x0"]) < 30) for o in raw))]
        return self._lines[i]

    cp.Doc.lines = lines


def dotted(l):
    """A scheme line "11. Blood" as the label "11" and the line "Blood"."""
    m = DOTTED.match(l["text"]) if l["x0"] < 120 else None
    if not m:
        return [l]
    width = (l["x1"] - l["x0"]) / max(1, len(l["text"]))
    label = {**l, "text": m.group(1), "x1": l["x0"] + width * len(m.group(1)), "spans": l["spans"][:1]}
    return [label] + ([{**l, "text": m.group(2), "x0": l["x0"] + width * (len(l["text"]) - len(m.group(2)))}] if m.group(2) else [])
