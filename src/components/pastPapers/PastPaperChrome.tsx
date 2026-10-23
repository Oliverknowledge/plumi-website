import Image from "next/image";
import { AppStoreBadge } from "@/components/home/AppStoreBadge";
import { DiscordButton } from "@/components/cosy/DiscordButton";
import { Tape } from "@/components/cosy/Chrome";
import { site } from "@/config/site";
import { pastPaperSource, type Level } from "@/content/pastPapers";

/**
 * The pieces every past paper page shares: the "now get it marked" card that turns
 * a paper download into a reason to open Plumi, the three-step way to use a paper,
 * and the credit line. Copy follows the homepage's truth rules (src/content/home.ts):
 * A-Level papers are in the app's Papers tab and Pro marks a whole paper; a GCSE
 * paper goes in as a PDF to write on. Nothing here claims more than that.
 */
export function MarkItCard({ level, placement }: { level: Level; placement: string }) {
  return (
    <aside className="lp-card pp-mark" aria-labelledby={`${placement}-title`}>
      <Tape />
      <div className="pp-mark-copy">
        <span className="lp-eyebrow">Done a paper?</span>
        <h2 id={`${placement}-title`}>Sit it on iPad, and <em>get it marked.</em></h2>
        <p className="lp-lead">
          {level === "A-Level"
            ? "Your board’s A‑Level papers are already in Plumi’s Papers tab, with their mark schemes. Write your answers with Apple Pencil, and with Pro Plumi marks the whole paper and gives it a grade."
            : "Put the PDF in your Plumi notebook and write on it like any page. Then practise the questions you dropped: Plumi writes new ones in your board’s style and marks your handwritten working."}
        </p>
        <div className="lp-cta-row">
          <AppStoreBadge placement={placement} height={52} />
          <DiscordButton placement={`${placement}-discord`} />
        </div>
        <p className="lp-cta-note">Free to download, with 10 answers marked free every week. The Discord is a study room for revising together.</p>
      </div>
      <figure className="pp-mark-shot">
        <Image src="/site/tile-papers2.webp" width={1442} height={550} sizes="(max-width: 980px) 90vw, 520px"
          alt="Plumi's past papers for OCR A-Level Physics, June 2023: three papers, each with the paper, mark scheme and examiner report." />
      </figure>
    </aside>
  );
}

const steps = [
  { title: "Sit it like the real thing.", line: "Timed, by hand, with the formula sheet and nothing else. A paper you peek at teaches you the mark scheme, not the topic." },
  { title: "Mark it honestly.", line: "Go line by line with the mark scheme. Method marks are where most lost marks hide, so check your working, not just the answer." },
  { title: "Go back to what you dropped.", line: "Your board publishes an examiner report for each paper: it says what most students wrote and why it didn’t score. Redo those questions a week later." },
];

export function HowToUse({ subject }: { subject: string }) {
  return (
    <section aria-labelledby="use-title" className="pp-use">
      <div className="lp-wrap">
        <div className="lp-sec-head">
          <span className="lp-eyebrow">Using past papers</span>
          <h2 id="use-title">How to get the most out of {subject} past papers</h2>
        </div>
        <ol className="lp-sp-steps">
          {steps.map((s, i) => (
            <li key={s.title} className="lp-card lp-step">
              <span className="lp-num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.line}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Who holds the files, and whose papers they are. */
export function SourceCredit({ source }: { source?: string }) {
  return (
    <p className="pp-credit">
      Past papers and mark schemes are © their exam boards. The files open from{" "}
      <a href={source ?? pastPaperSource.url} rel="noopener" target="_blank">{pastPaperSource.name}</a>, who host them.
      Plumi isn’t affiliated with any exam board. Something missing or broken? <a href={`mailto:${site.contactEmail}`}>Tell us</a>.
    </p>
  );
}
