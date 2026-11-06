#!/usr/bin/env python3
"""Self-test for the segment finder (synthetic text, no network):  python3 scripts/question-bank/markpacks/pdf_text_test.py"""
import sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from pdf_text import label_regex, segment

AQA = """Question   Marking Guidance        Mark   Comments

           Strong negative correlation;    1
  08.3                                      (1 x AO3)

                                                  15
Question   Marking Guidance        Mark   Comments

           Tissue and organ;               1
  09.1                                      (1 x AO1)
"""
def test():
    # the row's words sit ABOVE the label line: the segment must reach back to just after the previous part's label
    seg = segment(AQA, "08.3", ["08.2", "09.1"])
    assert "Strong negative correlation" in seg      # no previous label in the text: a window before the label is used
    seg = segment(AQA.replace("Question   Marking", "  08.2   x\nQuestion   Marking", 1), "08.3", ["08.2", "09.1"])
    assert "Strong negative correlation" in seg, seg
    # known looseness: the NEXT part's words also sit above its own label line, so they are inside this segment too
    assert label_regex("09").search("  0 9     According to") is not None             # "09" printed as "0 9"
    assert label_regex("3(b)").search("  3(b)      Ionic") is not None                 # a closing bracket after the label
    assert label_regex("20").search("20\n") is not None
    plain = "text\n 20\n\x0c\n 2 0     Which of the following\n  Answer D\n"
    seg = segment(plain, "20", [])
    assert seg is not None and "Which of the following" in seg                        # a lone page number is not the question's row
    print("ok")

if __name__ == "__main__": test()
