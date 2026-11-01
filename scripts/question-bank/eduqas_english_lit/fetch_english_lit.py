"""Download Eduqas's A Level English Literature (A720QS) papers, mark schemes and examiner's reports from eduqas.co.uk.

    python3 scripts/question-bank/eduqas_english_lit/fetch_english_lit.py [work-dir]
    # default work dir: scripts/question-bank/.work/eduqas-english-lit
    # needs: pip install pymupdf

eduqas/fetch_eduqas.py, run on the English Literature qualification page (QualificationId 38425):
its file names are the sciences' ("s18-8721-01.pdf" is A Level paper 1, "S24-A720U10-1.pdf"
component 1; 2017's Unseen Texts scheme, "s17-english-literature9-ms.pdf", is placed by its
listed title) and its report title is the sciences' ("A Level English Literature Examiners'
Report Summer 2024"). Only eduqas.co.uk and the files it links to on pastpapers.download.wjec.co.uk.

The A Level is four components: 1 Poetry (A720U10), 2 Drama (A720U20), 3 Unseen Texts (A720U30)
and 4, the Prose Study, which is non-exam assessment and has no paper. The page also lists the AS
(B720), whose files are downloaded with the rest and then left out of the manifest.

Writes <work-dir>/pdf/<component>-<kind>-<series>.pdf ("a720u10-qp-jun24.pdf"), uploaded as
eduqas/<that name>; <work-dir>/manifest.json, each file with its "r2" name; <work-dir>/specs/
english-literature.pdf, the specification, for texts.py's list.
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
WORK = os.path.abspath(ARGS[0]) if ARGS else os.path.join(HERE, "..", ".work", "eduqas-english-lit")

# The sciences' fetcher, loaded from its file and pointed at this qualification.
_spec = importlib.util.spec_from_file_location("fetch_eduqas", os.path.join(HERE, "..", "eduqas", "fetch_eduqas.py"))
fetch_eduqas = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fetch_eduqas)
fetch_eduqas.QUALIFICATIONS = {"english-literature": (38425, "A720", "B720")}
fetch_eduqas.WORK, fetch_eduqas.PDF = WORK, os.path.join(WORK, "pdf")
fetch_eduqas.ONLY = None


def main():
    fetch_eduqas.main()
    path = os.path.join(WORK, "manifest.json")
    out = [f for f in json.load(open(path)) if f["spec"] == "A720"]
    for f in out:
        f["r2"] = f"eduqas/{f['file']}"
    json.dump(out, open(path, "w"), indent=1)
    n = {k: sum(1 for f in out if f["kind"] == k) for k in ("qp", "ms", "er")}
    print(f"A Level: {n['qp']} papers, {n['ms']} schemes, {n['er']} report rows", file=sys.stderr)


if __name__ == "__main__":
    main()
