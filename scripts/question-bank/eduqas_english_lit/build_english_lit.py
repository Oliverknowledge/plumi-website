"""Write the Eduqas A Level English Literature bank's data files from the cut questions.

    python3 scripts/question-bank/eduqas_english_lit/build_english_lit.py

edexcel_english_lit/build_english_lit.py's build(), with Eduqas's components: reads .work/eduqas-english-lit's
parts.json (cut_english_lit.py) and manifest.json (fetch_english_lit.py) and writes
src/content/questionBank/eduqas-a-level-english-literature.json and
public/question-bank/eduqas-a-level-english-literature/{parts,text,reports}.json. The topics are the set texts
(texts.py), each question tagged to the one whose heading it sits under; the whole papers are the fetched
copies on R2 (eduqas/a720u10-qp-jun24.pdf), uploaded with the crops (upload_r2.py --pdf-prefix=eduqas/).
"""
import importlib.util, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import texts  # noqa: E402

# The Edexcel builder, loaded from its file: both folders have a texts.py, so it can't simply be imported by name.
_spec = importlib.util.spec_from_file_location("edexcel_build", os.path.join(HERE, "..", "edexcel_english_lit", "build_english_lit.py"))
edexcel_build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(edexcel_build)

PAPERS = {"a720u10": ("Component 1", "Poetry"), "a720u20": ("Component 2", "Drama"), "a720u30": ("Component 3", "Unseen Texts")}
NOTE = ("Eduqas publishes these papers from the first exams (June 2017) to June 2025, with the autumn 2020 and 2021 sittings. "
        "Each paper asks about every set text, so the topics here are the texts: pick the ones you studied. Component 1 Section B "
        "and Component 2 Section B are set on pairs of texts, so each pair is a topic. Component 3's unseen prose is from one of two "
        "periods, and its poems are unseen. Component 4, the prose study, is coursework and has no paper.")


def own_words(text, label):
    """A question's own words: no number ("6.", "0 6") or part ("(i)", "ii)"), up to its marks."""
    t = re.sub(r"\s+", " ", text).strip()
    t = re.sub(r"^(?:\d{1,2}\.|\d \d)?\s*(?:\(?i{1,2}\))?\s*", "", t)
    return re.split(r"\[\d+\]", t)[0].strip()


def main():
    edexcel_build.MONTH["OCT"] = "Autumn"  # Eduqas calls its October 2020 and 2021 sittings "Autumn"
    edexcel_build.own_words = own_words
    edexcel_build.build("eduqas-a-level-english-literature", "Eduqas", "English Literature", ["A720"], texts.SPEC, PAPERS, NOTE,
                        os.path.join(HERE, "..", ".work", "eduqas-english-lit"), lambda c: False)


if __name__ == "__main__":
    main()
