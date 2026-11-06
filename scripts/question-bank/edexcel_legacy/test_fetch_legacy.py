"""Regression checks for Pearson's mixed legacy source formats."""
import unittest
from fetch_legacy import MODULES, listing
from labels import MS_LABEL


def index(*hits):
    return {code: list(hits) if code == "6663" else [] for code in MODULES}


class SourceListingTests(unittest.TestCase):
    def test_pearson_mistyped_2011_c1_filename_uses_verified_sitting(self):
        hit = dict(title="Question paper - Unit C1 (6663) - June 2011",
                   url="/content/dam/pdf/A Level/Mathematics/2013/Exam materials/6663_01_que_00110518.pdf")
        row, = listing(index(hit))
        self.assertEqual(row["series"], "JUN11")

    def test_scheme_labels_accept_subparts_but_reject_prose(self):
        for label in ["2", "2.", "2(a)(ii)", "4a", "Qu 2", "Question 2", "4 (b) (iv)"]:
            self.assertIsNotNone(MS_LABEL.match(label), label)
        self.assertIsNone(MS_LABEL.match("1 " + "a" * 1000 + ": examiner guidance"))

    def test_january_and_june_and_regional_papers_stay_distinct(self):
        hits = []
        for month, date, variant in [("January", "20100113", "01"), ("June", "20100524", "01"), ("June", "20130513", "01R")]:
            hits.append(dict(title=f"Question paper - Unit C1 (6663) - {month} {date[:4]}",
                             url=f"/content/dam/pdf/A Level/Mathematics/2013/Exam materials/6663_{variant}_que_{date}.pdf"))
        self.assertEqual({(r["component"], r["series"]) for r in listing(index(*hits))},
                         {("6663", "JAN10"), ("6663", "JUN10"), ("6663-01R", "JUN13")})

    def test_2014_descriptive_names_include_regional_mark_schemes(self):
        hit = dict(title="Mark scheme - Unit C1 (6663) - Paper 1R - June 2014",
                   url="/content/dam/pdf/A Level/Mathematics/2013/Exam materials/Mark-scheme-Unit-C1-(6663)-Paper-1R-June-2014.pdf")
        row, = listing(index(hit))
        self.assertEqual((row["component"], row["series"], row["kind"]), ("6663-01R", "JUN14", "ms"))

    def test_international_and_out_of_range_results_are_excluded(self):
        hits = [dict(title="Question paper - Unit C1 (6663) - June 2010",
                     url="/content/dam/pdf/International Advanced Level/Mathematics/2013/Exam materials/6663_01_que_20100524.pdf"),
                dict(title="Question paper - Unit C1 (6663) - June 2009",
                     url="/content/dam/pdf/A Level/Mathematics/2013/Exam materials/6663_01_que_20090524.pdf")]
        self.assertEqual(listing(index(*hits)), [])


if __name__ == "__main__":
    unittest.main()
