"""Adding legacy questions must preserve the current bank byte-for-byte as rows."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import append_legacy


class AppendTests(unittest.TestCase):
    def test_append_preserves_current_solutions_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            work = root / "work"
            baseline = work / "baseline"
            baseline.mkdir(parents=True)
            current = dict(id="current-01", p="9MA0-01", s="JUN25", l="1", m=4,
                           t=["P.2"], w=100, h=100, x="current", sol=1, ms=1)
            inputs = {"meta": dict(sections=[], topics=[], papers=[], specs=["9MA0"], wholes={},
                                   data={"solutions": "unchanged"}),
                      "parts": [current], "text": {"current-01": "original search text"},
                      "reports": {"current-01": "original report"}, "year13": ["current-01"]}
            for name, value in inputs.items():
                (baseline / f"{name}.json").write_text(json.dumps(value))
            (work / "parts.json").write_text(json.dumps([dict(id="6663-jan10-01", component="6663", spec="6663",
                series="JAN10", set="6663-jan10", label="1", marks=75, w=100, h=120, qp="crop.webp", ms="scheme.webp",
                text="1. Simplify this expression", msText="answer")] ))
            (work / "manifest.json").write_text("[]")
            (work / "cut-audit.json").write_text("[]")
            with patch.object(append_legacy, "ROOT", root):
                append_legacy.append(work)
                output = root / "public/question-bank/edexcel-a-level-maths/parts.json"
                rows = json.loads(output.read_text())
                self.assertEqual(rows[0], current)
                self.assertEqual(rows[1]["id"], "legacy-edx-6663-jan10-01")
                self.assertEqual(rows[1]["t"], ["L.C1"])
                before = output.read_bytes()
                append_legacy.append(work)
                self.assertEqual(output.read_bytes(), before)
                meta = json.loads((root / "src/content/questionBank/edexcel-a-level-maths.json").read_text())
                self.assertEqual(meta["data"]["solutions"], "unchanged")
                self.assertEqual(meta["firstYear"], 2010)


if __name__ == "__main__":
    unittest.main()
