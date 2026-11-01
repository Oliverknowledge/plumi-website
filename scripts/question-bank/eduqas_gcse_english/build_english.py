"""Write the Eduqas GCSE English Language or English Literature bank's data files from the cut questions.

    python3 scripts/question-bank/eduqas_gcse_english/build_english.py lang|lit

edexcel_english_lit/build_english_lit.py's build(), at GCSE: reads .work/eduqas-gcse-english-<lang|lit>'s parts.json
(cut_english_<lang|lit>.py) and manifest.json (fetch_english.py), and writes src/content/questionBank/<slug>.json and
public/question-bank/<slug>/{parts,text,reports}.json. The topics are texts.py's: Literature's set texts, each question
tagged to the text whose heading it sits under; Language's question types, each question tagged by its number. The
whole papers, schemes, reports and Language's inserts are the fetched copies on R2 (eduqas/c700u10-ins-jun24.pdf),
uploaded with the crops (upload_r2.py --pdf-prefix=eduqas/).
"""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import texts  # noqa: E402

# The Edexcel builder, loaded from its file: its folder has a texts.py too, so it can't simply be imported by name.
_spec = importlib.util.spec_from_file_location("edexcel_build", os.path.join(HERE, "..", "edexcel_english_lit", "build_english_lit.py"))
edexcel_build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(edexcel_build)

BANKS = {
    "lang": {
        "slug": "eduqas-gcse-english-language", "subject": "English Language", "specs": ["C700"], "spec": texts.LANG,
        "papers": {"c700u10": ("Component 1", "20th Century Literature Reading and Creative Prose Writing"),
                   "c700u20": ("Component 2", "19th and 21st Century Non-Fiction Reading and Transactional/Persuasive Writing")},
        "note": ("Eduqas publishes these papers from the first exams (June 2017) to June 2025, with every November resit to 2024. "
                 "Each paper's reading questions are on texts printed in its separate resource insert: open it from any question "
                 "that reads it. Component 2's 19th-century text is printed in the paper itself, and shown with the questions on it. "
                 "Component 3, spoken language, is assessed in school and has no paper."),
    },
    "lit": {
        "slug": "eduqas-gcse-english-literature", "subject": "English Literature", "specs": ["C720"], "spec": texts.LIT,
        "papers": {"c720u10": ("Component 1", "Shakespeare and Poetry"),
                   "c720u20": ("Component 2", "Post-1914 Prose/Drama, 19th Century Prose and Unseen Poetry"),
                   "c722u10a": ("Component 1A (2022)", "Shakespeare"), "c722u10b": ("Component 1B (2022)", "Post-1914 Prose/Drama"),
                   "c722u20a": ("Component 2A (2022)", "Poetry Anthology"), "c722u20b": ("Component 2B (2022)", "19th Century Prose"),
                   "c722u20c": ("Component 2C (2022)", "Unseen Poetry")},
        "note": ("Eduqas publishes these papers from the first exams (June 2017) to June 2025. Of the November resits it has "
                 "published Component 2 for 2020 and Component 1 for 2021 (Shakespeare and post-1914 prose or drama that year, "
                 "with no mark scheme), and in June 2022 each section was a paper of its own. Each paper asks about every set "
                 "text, so the topics here are the texts: pick the ones you studied. An extract question shows its extract, and "
                 "a question that compares two poems shows the first above it."),
    },
}


def main():
    bank = BANKS[sys.argv[1] if len(sys.argv) > 1 else "lang"]
    key = "lang" if bank["subject"] == "English Language" else "lit"
    edexcel_build.build(bank["slug"], "Eduqas", bank["subject"], bank["specs"], bank["spec"], bank["papers"], bank["note"],
                        os.path.join(HERE, "..", ".work", f"eduqas-gcse-english-{key}"), lambda c: False, extra={"level": "GCSE"})


if __name__ == "__main__":
    main()
