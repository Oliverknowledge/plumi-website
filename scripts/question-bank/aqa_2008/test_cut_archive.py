"""Small synthetic regressions for the older paper formats; no source PDFs needed."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


class ArchiveCutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        path = Path(__file__).with_name("cut_archive.py")
        spec = importlib.util.spec_from_file_location("archive_cut_test", path)
        cls.module = importlib.util.module_from_spec(spec)
        with patch.object(sys, "argv", [str(path), cls.temp.name]):
            spec.loader.exec_module(cls.module)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_inherits_question_and_letter(self):
        m = self.module
        doc = m.fitz.open()
        doc.new_page()
        p = doc.new_page()
        for y, text in [(90, "1 The experiment."), (130, "(a) The first part."),
                        (180, "(i) State the observation."), (230, "(ii) Explain it."),
                        (280, "(b) Another part.")]:
            p.insert_text((60, y), text, fontname="hebo", fontsize=11)
        self.assertEqual([k for _, _, k in m.labels(doc)],
                         [(1, None, None), (1, "a", None), (1, "a", "i"), (1, "a", "ii"), (1, "b", None)])

    def test_combines_shared_award_without_inventing_marks(self):
        m = self.module
        regions = [((1, None, None), [], "The experiment."),
                   ((1, "a", None), [], "Use the graph."),
                   ((1, "a", "i"), [], "State the value."),
                   ((1, "a", "ii"), [], "Explain the result. (3 marks)"),
                   ((1, "b", None), [], "Another question. (2 marks)")]
        result = m.combine_awards(regions)
        self.assertEqual([k for k, _, _ in result], [(1, None, None), (1, "a", None), (1, "b", None)])
        self.assertIn("State the value.", result[1][2])
        self.assertEqual(m.MARKS.findall(result[1][2]), ["3"])

    def test_separates_global_writing_award_from_question(self):
        m = self.module
        doc = m.fitz.open()
        doc.new_page()
        p = doc.new_page()
        p.insert_text((60, 90), "1 (a) Explain the experiment.", fontname="hebo", fontsize=11)
        p.insert_text((90, 115), "quality of written communication in your answer.", fontsize=11)
        p.insert_text((480, 160), "(3 marks)", fontsize=11)
        p.insert_text((90, 220), "Quality of Written Communication (2 marks)", fontsize=11)
        result = m.regions(doc)
        self.assertEqual(len(result), 1)
        self.assertIn("quality of written communication in your answer", result[0][2])
        self.assertEqual(m.MARKS.findall(result[0][2]), ["3"])

    def test_reads_both_objective_key_layouts(self):
        m = self.module
        doc = m.fitz.open()
        p = doc.new_page()
        p.insert_text((60, 90), "Keys to Objective Test Questions", fontsize=11)
        p.insert_text((70, 150), "1", fontsize=11)
        p.insert_text((150, 150), "C", fontsize=11)
        p.insert_text((230, 200), "2", fontsize=11)
        p.insert_text((230, 220), "B", fontsize=11)
        self.assertEqual(m.mcq_keys(doc), {1: "C", 2: "B"})


if __name__ == "__main__":
    unittest.main()
