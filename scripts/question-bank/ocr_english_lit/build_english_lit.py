"""Write the OCR A-Level English Literature bank's data files from the cut questions.

    python3 scripts/question-bank/ocr_english_lit/build_english_lit.py

edexcel_english_lit/build_english_lit.py's build(), with OCR's papers: reads .work/ocr-english-lit's parts.json
(cut_english_lit.py) and manifest.json (fetch_english_lit.py) and writes src/content/questionBank/ocr-a-level-english-literature.json
and public/question-bank/ocr-a-level-english-literature/{parts,text,reports}.json. The topics are the set texts (texts.py);
the whole papers are the past paper library's copies on R2 (ocr/OCR-H472-01-QP-JUN24.pdf).
"""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import texts  # noqa: E402

# The Edexcel builder, loaded from its file: both folders have a texts.py, so it can't simply be imported by name.
_spec = importlib.util.spec_from_file_location("edexcel_build", os.path.join(HERE, "..", "edexcel_english_lit", "build_english_lit.py"))
edexcel_build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(edexcel_build)

PAPERS = {"h47201": ("Component 1", "Drama and poetry pre-1900"), "h47202": ("Component 2", "Comparative and contextual study"),
          "h07201": ("AS Component 1", "Shakespeare and poetry pre-1900"), "h07202": ("AS Component 2", "Drama and prose post-1900")}
NOTE = ("OCR publishes these papers from November 2021 (AS: June 2022) on. Each paper asks about every set text, so the topics here "
        "are the texts: pick the ones you studied. Component 2 is sat on one of five topics, each with an unseen passage and an "
        "essay comparing two of its texts, so those are topics too. Component 3, the coursework, has no paper.")


def main():
    edexcel_build.build("ocr-a-level-english-literature", "OCR", "English Literature", ["H472", "H072"], texts.SPEC, PAPERS, NOTE,
                        os.path.join(HERE, "..", ".work", "ocr-english-lit"), lambda c: c.startswith("h072"))


if __name__ == "__main__":
    main()
