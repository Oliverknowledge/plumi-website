"""Regression checks for adding older papers without replacing a live bank.

    python3 -m unittest discover -s scripts/question-bank -p test_legacy_append.py
"""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent


class LegacyAppendTest(unittest.TestCase):
    def fixture(self, subject, root):
        spec = importlib.util.spec_from_file_location(
            f"legacy_{subject}", HERE / f"aqa_{subject}_legacy" / "build_legacy.py")
        module = importlib.util.module_from_spec(spec)
        with patch.object(sys, "argv", [str(spec.origin)]):
            spec.loader.exec_module(module)
        module.ROOT, module.WORK, module.APPEND = str(root), str(root / "work"), True
        physics = subject == "physics"
        comp = "PHYA1" if physics else "CHEM1"
        current = "74081" if physics else "74051"
        slug = module.SLUG
        old_id = f"{comp.lower()}-jun10-1"
        old = {"id": old_id, "p": comp, "s": "JUN10", "t": ["3.1.1"], "m": 2,
               "w": 120, "h": 100, "ms": 1, "x": "Existing legacy part", "cv": 2}
        modern = dict(old, id=f"{current}-jun25-01-1", p=current, s="JUN25")
        meta = {"slug": slug, "specs": [current[:4]], "cropVersion": 3,
                "topics": [{"code": "3.1.1", "count": 2}],
                "papers": [{"id": comp}, {"id": current}],
                "wholes": {f"{comp}-JUN10": {"ms": "aqa/old-ms.pdf"}},
                "data": {"parts": "baseline"}, "count": 2, "firstYear": 2010}
        part_id = f"{comp.lower()}-jun09-1-a"
        part = {"id": part_id, "component": comp, "series": "JUN09", "label": "1(a)",
                "marks": 2, "w": 120, "h": 100, "ms": "new-ms.webp", "qp": "new-qp.webp",
                "text": "1 (a) Explain the observation.", "ownText": "1 (a) Explain the observation.",
                "own": "1 (a) Explain the observation.", "msText": "An explanation."}
        def write(path, data):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data))
        meta_path = root / "src/content/questionBank" / f"{slug}.json"
        pub = root / "public/question-bank" / slug
        write(meta_path, meta)
        write(pub / "parts.json", [modern, old])
        write(pub / "text.json", {modern["id"]: "Modern search text", old_id: "Legacy search text"})
        work = root / "work"
        write(work / "parts.json", [part])
        write(work / "tags.json", {part_id: ["3.1.1"]})
        write(work / "off.json", {})
        write(work / "manifest.json", [{"component": comp, "series": "JUN09", "kind": "ms", "file": "new-ms.pdf"}])
        return module, meta_path, pub, [modern, old]

    def test_preserves_live_rows_and_is_idempotent(self):
        for subject in ("physics", "chem"):
            with self.subTest(subject=subject), tempfile.TemporaryDirectory() as temp:
                module, meta_path, pub, baseline = self.fixture(subject, Path(temp))
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    module.main()
                    first = (pub / "parts.json").read_bytes()
                    module.main()
                rows = json.loads(first)
                self.assertEqual(rows[:2], baseline)
                self.assertEqual(len(rows), 3)
                self.assertEqual((pub / "parts.json").read_bytes(), first)
                text = json.loads((pub / "text.json").read_text())
                self.assertEqual(text[baseline[1]["id"]], "Legacy search text")
                meta = json.loads(meta_path.read_text())
                self.assertEqual(meta["firstYear"], 2009)
                self.assertEqual(meta["cropVersion"], 3)
                self.assertEqual(meta["topics"][0]["count"], 3)
                self.assertIn(f"{baseline[1]['p']}-JUN10", meta["wholes"])

    def test_refuses_to_change_existing_part(self):
        for subject in ("physics", "chem"):
            with self.subTest(subject=subject), tempfile.TemporaryDirectory() as temp:
                module, _, pub, _ = self.fixture(subject, Path(temp))
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    module.main()
                before = (pub / "parts.json").read_bytes()
                parts_path = Path(module.WORK) / "parts.json"
                parts = json.loads(parts_path.read_text())
                parts[0]["marks"] = 5
                parts_path.write_text(json.dumps(parts))
                with self.assertRaisesRegex(SystemExit, "cannot change an existing part"):
                    module.main()
                self.assertEqual((pub / "parts.json").read_bytes(), before)

    def test_preserves_annotations_added_after_import(self):
        for subject in ("physics", "chem"):
            with self.subTest(subject=subject), tempfile.TemporaryDirectory() as temp:
                module, _, pub, _ = self.fixture(subject, Path(temp))
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    module.main()
                    path = pub / "parts.json"
                    rows = json.loads(path.read_text())
                    rows[-1].update(er=1, cv=4)
                    path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
                    before = path.read_bytes()
                    module.main()
                self.assertEqual(path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
